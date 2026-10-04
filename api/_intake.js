/* =========================================================================
   The intake (form key "intake"): parse, notify, attach, record. STAGE 1
   (PRD rev A.3 §7)
   -------------------------------------------------------------------------
   Required by api/lead.js; not a route (underscore). One submit at the end:
   one notification to nickz@ (TEST_RECIPIENT off production) in SPEC §7
   order, with any uploads attached (PRD D3), and one `leads` row (§3.1).
   Stage 2 adds intake_sessions, per-screen saves and the resume link.
   ========================================================================= */
"use strict";

const crypto = require("crypto");
const path = require("path");
// The same routing rules the page uses (SPEC §1), so no-JS posts get a route too.
const R = require(path.join(__dirname, "..", "assets", "js", "intake-route.js"));

const clamp = (s, max) => {
  const t = String(s == null ? "" : s).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").trim();
  return t.length > max ? t.slice(0, max) : t;
};
const oneLine = (s) => String(s || "").replace(/[\r\n]+/g, " ").trim();
/* A single-line field: CR/LF and runs of whitespace collapse to one space, so
   no visitor text can start a "Label:" line in the notification (GPT Web S1-3).
   Only the free-text notes keep their lines; they're parsed last, under ANYTHING ELSE. */
const line = (s, max) => clamp(String(s == null ? "" : s).replace(/\s+/g, " "), max);
const list = (v, max = 12) => (Array.isArray(v) ? v : v ? [v] : []).map((x) => line(x, 60)).filter(Boolean).slice(0, max);

// Card values -> the card titles people saw (SPEC rev A). Unknown values are dropped.
const L = {
  intent: { fit: "Help me work out if it fits my home", book: "I'm ready to book", explore: "I'm just exploring", urgent: "My boiler's broken or failing" },
  source: { search: "Google or another search engine", ai: "An AI assistant (ChatGPT, Claude, etc.)", friend: "A friend, family member or neighbour",
            installer: "My installer, plumber or electrician", facebook: "A Facebook group or online forum", event: "An event or expo",
            news: "News, a podcast or an article", other: "Other" },
  call_times: { lunchtime: "Weekdays around lunchtime", after_5: "Weekdays after 5pm", weekends: "Weekends", any: "Any time" },
  heating: { boiler_radiators: "Gas hydronic with radiators", boiler_underfloor: "Gas hydronic with underfloor", lpg_boiler: "LPG hydronic",
             ducted_gas: "Ducted gas", ducted_rc: "Ducted reverse cycle", splits: "Split systems", other: "Something else", none: "No heating yet", not_sure: "Not sure" },
  boiler_condition: { working_fine: "Working fine", getting_on: "Getting on a bit", playing_up: "Playing up", broken: "Broken, or about to go", not_sure: "Not sure" },
  boiler_age: { under_5: "Under 5 years", "5_10": "5–10", "10_15": "10–15", over_15: "Over 15", not_sure: "Not sure" },
  tenure: { owner_occupier: "I own it and live in it", landlord: "I own it and rent it out", renter: "I'm renting", build: "We're building or renovating" },
  scope: { heating: "Heating", hot_water: "Hot water", cooling: "Cooling", not_sure: "Not sure yet" },
  energy: { solar: "Rooftop solar", battery: "A home battery", ev: "An electric vehicle", cheap_window: "A plan with a free or cheap power window",
            none: "None of these yet", not_sure: "Not sure" },
  winter_gas_bill_band: { under_300: "Under $300", "300_600": "$300 to $600", "600_1000": "$600 to $1,000", over_1000: "Over $1,000", not_sure: "Not sure" },
  timing: { asap: "As soon as possible", "3_months": "In the next 3 months", "3_12_months": "In 3 to 12 months", planning: "Just planning ahead" },
  storeys: { single: "Single", double: "Double", split: "Split level", three_plus: "Three or more", not_sure: "Not sure" },
  radiator_band: { "1_5": "1–5", "6_10": "6–10", "11_15": "11–15", "16_plus": "16+", underfloor_only: "Underfloor only", not_sure: "Not sure" },
  underfloor_band: { one_zone: "One room or zone", part: "Part of the house", most: "Most of the house", whole: "The whole house", not_sure: "Not sure" },
  built_band: { pre_1950: "Before 1950", "1950_1990": "1950–1990", "1990_2010": "1990–2010", post_2010: "After 2010", not_sure: "Not sure" },
  off_gas: { everything: "Yes, everything off gas", keep_cooktop: "Yes, but keep the gas cooktop", heating_only: "Just the heating for now", not_sure: "Not sure" },
};
const SLOTS = { winter_gas_bill: "winter gas bill", boiler_compliance_plate: "boiler compliance plate", switchboard: "switchboard", electricity_bill: "electricity bill" };
const ROUTES = ["icp", "icp-check", "explore", "urgent", "out-of-area", "not-our-product", "renter"];
const OUTCOMES = ["matched", "completed", "book_chat", "deposit", "keep_posted", "no_thanks", "urgent_call", "urgent_book", "n1_chat"];
const SCREENS = /^(intro|S\d{1,2}[b-d]?|B2|MATCH|MATCH_SHORT|URGENT|DONE|O1|N1|R1|POSTED)$/;

// Which screen asks which key: "Not asked" (screen never shown) vs "Skipped" (shown, no answer).
const ASKED_ON = { phone: "S4", call_times: "S4b", intent: "S5", source: "S6", referrer: "S6", heating: "S7", heating_other_text: "S7", heating_notes: "B2",
  boiler_condition: "S8", boiler_age: "S8", tenure: "S9", scope: "S10", energy: "S11", winter_gas_bill_band: "S12", timing: "S13",
  timing_note: "S13", storeys: "S14", radiator_band: "S14", underfloor_band: "S14", built_band: "S14", off_gas: "S15", uploads: "S16", notes: "S17" };

const LEAD_ID = /^il-[0-9a-f]{10}$/;
// The page's own check (assets/js/intake.js), so both agree on what's valid.
const PHONE_OK = (p) => /^(\+?61|0)[2-478]\d{8}$/.test(String(p).replace(/[\s()-]/g, ""));
const pick = (map, v) => (Object.prototype.hasOwnProperty.call(map, v) ? v : "");

function parseIntake(body) {
  const nojs = String(body.nojs) === "1";
  const d = {
    form: "intake", formLabel: "Website Intake", nojs,
    // The page makes its lead ID once per visit, so a repeat of the same send
    // can be recognised (Sales review, 1). Anything else gets a fresh one.
    lead_id: LEAD_ID.test(String(body.lead_id || "")) ? String(body.lead_id) : "il-" + crypto.randomBytes(5).toString("hex"),
    first_name: line(body.first_name, 120), last_name: line(body.last_name, 120),
    email: line(body.email, 200), phone: line(body.phone, 40),
    // The long form's "I'd prefer email" box posts prefer_email=1.
    contact_pref: pick({ phone: 1, email: 1 }, body.contact_pref) || ([].concat(body.prefer_email || []).indexOf("1") !== -1 ? "email" : ""),
    call_times: list(body.call_times).filter((v) => L.call_times[v]),
    postcode: clamp(body.postcode, 4).replace(/\D/g, ""), suburb: line(body.suburb, 120),
    state: line(body.state, 3).toUpperCase(), remote: body.remote === true || body.remote === "true",
    intent: pick(L.intent, body.intent),
    source: list(body.source).filter((v) => L.source[v]), referrer: line(body.referrer, 200),
    newsletter_opt_in: body.newsletter_opt_in === true || body.newsletter_opt_in === "true",
    heating: list(body.heating).filter((v) => L.heating[v]), heating_other_text: line(body.heating_other_text, 300),
    boiler_condition: pick(L.boiler_condition, body.boiler_condition), boiler_age: pick(L.boiler_age, body.boiler_age),
    tenure: null,
    scope: list(body.scope).filter((v) => L.scope[v]), energy: list(body.energy).filter((v) => L.energy[v]),
    winter_gas_bill_band: pick(L.winter_gas_bill_band, body.winter_gas_bill_band),
    timing: pick(L.timing, body.timing), timing_note: line(body.timing_note, 500),
    storeys: pick(L.storeys, body.storeys), radiator_band: pick(L.radiator_band, body.radiator_band),
    underfloor_band: pick(L.underfloor_band, body.underfloor_band),
    built_band: pick(L.built_band, body.built_band), off_gas: pick(L.off_gas, body.off_gas),
    send_later: list(body.send_later).filter((v) => SLOTS[v]),
    notes: clamp(body.notes, 5000),
    heating_notes: clamp(body.heating_notes, 2000),
    route: ROUTES.indexOf(body.route) !== -1 ? body.route : "", outcome: OUTCOMES.indexOf(body.outcome) !== -1 ? body.outcome : (nojs ? "completed" : ""),
    rung_reached: ["1", "2", "3", "done"].indexOf(String(body.rung_reached)) !== -1 ? String(body.rung_reached) : (nojs ? "done" : ""),
    last_screen: SCREENS.test(String(body.last_screen || "")) ? String(body.last_screen) : "",
    seen: list(body.seen, 40).filter((s) => SCREENS.test(s)),
    uploads: Array.isArray(body.uploads) ? body.uploads.slice(0, 6) : [],
    // Stage 1 has no step-1 save, so the session starts at the page stamp.
    ts_started: Number(body.ts) > 0 ? Number(body.ts) : 0,
    // The details from "Help us prepare" after an earlier exit already sent:
    // a second notification, but never a second customer email.
    followup: body.followup === true || body.followup === "true",
    // The exit chosen after the match (CTO item 69): the strongest signal we get.
    exit: ["chat", "deposit", "keep_posted", "none"].indexOf(body.exit) !== -1 ? body.exit : "",
  };
  if (nojs) d.seen = Object.values(ASKED_ON);       // the long form shows every question
  // The server works out state and route itself: the long form has no script
  // to do it, and a page's own claim is only a hint.
  if (d.state !== "OS" && /^\d{4}$/.test(d.postcode)) d.state = R.stateFor(d.postcode) || d.state;
  // Always the server's own route: it picks the customer's email now, so the
  // page's claim is only ever a hint (GPT Web, intake review).
  d.route = R.route(d);
  if (d.outcome === "completed") d.rung_reached = "done";
  if (!d.first_name || !d.last_name) return { error: "Missing required field: name", why: "name" };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(d.email)) return { error: "Invalid email address", why: "email" };
  if (d.state !== "OS" && !/^\d{4}$/.test(d.postcode)) return { error: "Missing required field: postcode", why: "postcode" };
  // Rule 5 / D16 on the server too (GPT Web I-S1): a served lead gives an
  // Australian phone or chooses email. Out of area and NZ are never asked.
  if (R.inArea(d)) {
    if (d.phone && !PHONE_OK(d.phone)) return { error: "Invalid phone number", why: "phone" };
    if (!d.phone && d.contact_pref !== "email") return { error: "Missing required field: phone, or choose email", why: "phone" };
  }
  return { data: d };
}

// ---- attachments (PRD D3): first bytes, not names; 4 MB each; <= 6
const MAX_FILE = 4 * 1024 * 1024;
function sniff(buf) {
  if (buf.length > 4 && buf.slice(0, 4).toString("latin1") === "%PDF") return { type: "application/pdf", ext: "pdf" };
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { type: "image/jpeg", ext: "jpg" };
  if (buf.length > 8 && buf.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { type: "image/png", ext: "png" };
  if (buf.length > 12 && buf.slice(4, 8).toString("latin1") === "ftyp" && /hei[cfsx]|mif1|msf1/.test(buf.slice(8, 12).toString("latin1"))) return { type: "image/heic", ext: "heic" };
  return null;
}
function intakeAttachments(d) {
  const out = [], rejected = [];
  for (const u of d.uploads || []) {
    const slot = SLOTS[u && u.slot] ? u.slot : null;
    if (!slot || typeof u.data !== "string") { rejected.push("unknown slot"); continue; }
    let buf;
    try { buf = Buffer.from(u.data, "base64"); } catch (_) { rejected.push(SLOTS[slot]); continue; }
    const kind = sniff(buf);
    if (!kind || buf.length > MAX_FILE || buf.length === 0) { rejected.push(SLOTS[slot]); continue; }
    const base = oneLine(clamp(u.name, 120)).replace(/[\\/:*?"<>|]+/g, "_").replace(/\.[^.]+$/, "") || slot;
    out.push({ slot, label: SLOTS[slot], filename: `${SLOTS[slot]} - ${base}.${kind.ext}`, content: buf, contentType: kind.type, size: buf.length });
  }
  return { attachments: out, rejected };
}

// ---- the notification (SPEC §7 order; "Not sure" and skips shown as such)
function val(d, key, map) {
  const v = d[key];
  const shown = (d.seen || []).indexOf(ASKED_ON[key]) !== -1;
  if (Array.isArray(v) ? v.length === 0 : !v) return shown ? "Skipped" : "Not asked";
  if (map) return (Array.isArray(v) ? v : [v]).map((x) => map[x] || x).join(", ");
  return v;
}
function formatIntakeNotification(d, when, files) {
  const kb = (n) => (n > 1048576 ? (n / 1048576).toFixed(1) + " MB" : Math.max(1, Math.round(n / 1024)) + " KB");
  const uploads = (files && files.attachments.length ? files.attachments.map((a) => `${a.label} (${a.filename}, ${kb(a.size)})`) : []);
  const later = d.send_later.map((s) => `${SLOTS[s]}: will send later`);
  const upl = uploads.concat(later);
  const lines = [
    "Hi Thermal Dawn Team,",
    "",
    `Form: ${d.formLabel}${d.nojs ? " [no-JS]" : ""}`,
    `Lead ID: ${d.lead_id}`,
    `Submission Time: ${when}`,
    `Rung reached: ${d.rung_reached || "-"}`,
    `Route: ${d.route || "-"}`,
    `Tags: ${d.heating.includes("ducted_rc") ? "interest:ducted-rc, " : ""}source:website`,
    `Path: ${d.intent ? L.intent[d.intent] : "Not answered"}`,
    `Ended on: ${d.outcome || "-"}${d.last_screen ? " (screen " + d.last_screen + ")" : ""}`,
    "",
    "CONTACT",
    `First name: ${d.first_name}`,
    `Last name: ${d.last_name}`,
    `Email: ${d.email}`,
    `Phone: ${val(d, "phone")}`,
    `Best time to call: ${val(d, "call_times", L.call_times)}`,
    `Contact preference: ${d.contact_pref || "-"}`,
    "",
    "LOCATION",
    `Postcode: ${d.state === "OS" ? "Outside Australia" : d.postcode}`,
    `Suburb: ${d.suburb || "-"}`,
    `State: ${d.state || "-"}`,
    `Remote delivery: ${d.remote ? "Yes" : "No"}`,
    "",
    "ABOUT THE ENQUIRY",
    `What brings you here: ${val(d, "intent", L.intent)}`,
    `How you heard: ${val(d, "source", L.source)}`,
    `Who should we thank: ${val(d, "referrer")}`,
    `Monthly update: ${d.newsletter_opt_in ? "Yes" : "No"}`,
    "",
    "YOUR HOME",
    `Heating: ${val(d, "heating", L.heating)}`,
    `Heating, something else: ${val(d, "heating_other_text")}`,
    `Heating notes: ${d.heating_notes ? String(d.heating_notes).split(/\r?\n/).map(l => l.replace(/[^\S\n]+/g, " ").trim()).join("\n> ") : "-"}`,
    `Boiler condition: ${val(d, "boiler_condition", L.boiler_condition)}`,
    `Boiler age: ${val(d, "boiler_age", L.boiler_age)}`,
    `Is it your home: -`,
    `Cover: ${val(d, "scope", L.scope)}`,
    `Energy setup: ${val(d, "energy", L.energy)}`,
    `Winter gas bill: ${val(d, "winter_gas_bill_band", L.winter_gas_bill_band)}`,
    `Timing: ${val(d, "timing", L.timing)}`,
    `Anything driving the timing: ${val(d, "timing_note")}`,
    "",
    "THE DETAILS",
    `Storeys: ${val(d, "storeys", L.storeys)}`,
    `Radiators: ${val(d, "radiator_band", L.radiator_band)}`,
    `Underfloor covers: ${val(d, "underfloor_band", L.underfloor_band)}`,
    `Built: ${val(d, "built_band", L.built_band)}`,
    `Off gas: ${val(d, "off_gas", L.off_gas)}`,
    `Uploads: ${upl.length ? upl.join("; ") : ((d.seen || []).indexOf("S16") !== -1 ? "Skipped" : "Not asked")}`,
  ];
  if (files && files.rejected.length) lines.push(`Uploads not attached (type or size): ${files.rejected.join(", ")}`);
  // Own labels, so the parser never mistakes them for the lead's own Email or Phone.
  // Lines after the first are quoted "> ", so no typed line can pass for a label (D6-S3).
  lines.push("", "ANYTHING ELSE", d.notes ? String(d.notes).split(/\r?\n/).map((l) => l.replace(/[^\S\n]+/g, " ").trim()).join("\n> ") : val(d, "notes"), "");
  return lines.join("\n");
}
function formatIntakeSubject(d) {
  const head = d.route === "urgent" ? "URGENT" : "Website lead";
  const place = d.state === "OS" ? "Outside Australia" : [d.suburb, d.state].filter(Boolean).join(", ") || d.postcode;
  const heat = d.heating.length ? d.heating.map((h) => L.heating[h]).join(" + ") : "heating not given";
  return oneLine(`${head} · ${d.first_name} ${d.last_name} · ${place} · ${d.route || "-"} · ${heat} · ${d.lead_id}${d.nojs ? " [no-JS]" : ""}`);
}

/* ---- a repeat of the same send (Sales review 1; GPT Web I-S2) ----
   The page locks its buttons after the first tap. This is the backstop, per
   (lead ID, outcome):
     - first time:   "new", and the caller sends;
     - while that send is in flight: "pending", with a promise of its result,
       so a repeat waits instead of claiming success early;
     - once it was sent (within 30 minutes): "done";
     - a send that failed is forgotten, so a retry sends.
   An urgent lead's later "Help us prepare" send has a different outcome, so
   it still goes. Memory is per function instance, like the IP cap; stage 2's
   intake_sessions (unique lead ID) makes it hold across instances. */
const REPEAT_MS = 30 * 60 * 1000;
const sends = new Map();   // key -> { done: ms } | { pending: Promise<boolean>, settle }
const keyOf = (d) => `${d.lead_id}|${d.outcome}`;
function claimSend(d, now) {
  for (const [k, v] of sends) if (v.done && now - v.done > REPEAT_MS) sends.delete(k);
  const key = keyOf(d), seen = sends.get(key);
  if (seen && seen.done) return { status: "done" };
  if (seen && seen.pending) return { status: "pending", result: seen.pending };
  let settle;
  const pending = new Promise((r) => { settle = r; });
  sends.set(key, { pending, settle });
  return { status: "new" };
}
/* One customer email per lead OFF PRODUCTION, where nothing is inserted:
   per lead ID, not per outcome (GPT Web S1-2). In production the leads
   row's unique index is the only rule, and no answer means no email (D6-S1). */
const FIRST_MS = 24 * 60 * 60 * 1000;
const emailed = new Map();
function claimFirstEmail(d, now) {
  for (const [k, t] of emailed) if (now - t > FIRST_MS) emailed.delete(k);
  if (emailed.has(d.lead_id)) return false;
  emailed.set(d.lead_id, now);
  return true;
}

/** The claimed send finished: remember a success, forget a failure. */
function settleSend(d, ok, now) {
  const key = keyOf(d), seen = sends.get(key);
  if (!seen || !seen.settle) return;
  if (ok) sends.set(key, { done: now || Date.now() }); else sends.delete(key);
  seen.settle(!!ok);
}

/* ---- the customer's first email (CTO Re #30: stage 1, brief 07's templates) ----
   §2 when the route closes them (O1, N1); §1 on every other route (the
   match, done and urgent screens). One per lead: a follow-up details send
   gets none. No resume link until stage 2. */
const CLOSED = { "out-of-area": 1, "not-our-product": 1 };
function firstEmailKey(d) {
  if (d.followup) return null;
  return CLOSED[d.route] ? "interest-list-unserved" : "register-interest";
}

/* ---- the leads row (PRD §3.1) ----
   The existing columns, filled the way the old forms fill them, so CRM views
   read the same. The intake's own columns, by Platform's names (migration
   efaf42c: intake_lead_id, intake_event, intent, route, rung_reached, tenure,
   boiler_condition, ts_started, ts_last, answers), are added only when
   INTAKE_LEAD_COLUMNS=on, i.e. once the migration is applied: sending a
   column the table doesn't have fails the insert. leads.lead_id is the live
   per-row primary key, so the app's lead_id goes in intake_lead_id. Types
   and checks as migration rev 2 (e7bf423): intake_lead_id text il-+10 hex,
   intake_event partial|complete|details, rung_reached 1-4. */
const RUNG = { 1: 1, 2: 2, 3: 3, done: 4 };   // rung_reached is 1-4, 4 = done (migration rev 2, e7bf423)
const ANSWER_KEYS = ["intent", "source", "referrer", "newsletter_opt_in", "heating", "heating_other_text", "boiler_condition",
  "boiler_age", "heating_notes", "exit", "tenure", "scope", "energy", "winter_gas_bill_band", "timing", "timing_note", "storeys", "radiator_band",
  "underfloor_band", "built_band", "off_gas", "send_later", "contact_pref", "call_times", "remote", "outcome", "last_screen"];
function intakeLeadRow(d, env, now) {
  const at = new Date(now || Date.now()).toISOString();
  const has = (k) => (d.energy || []).indexOf(k) !== -1;
  const row = {
    submitted_at: at,
    form: d.formLabel,
    source_site: "freevolt",
    first_name: d.first_name || null,
    last_name: d.last_name || null,
    email: d.email || null,
    phone: d.phone || null,
    suburb: d.suburb || d.postcode || null,
    state: d.state || null,
    address: null,
    solar: d.energy.length ? (has("solar") ? "Yes" : "No") : null,
    battery: d.energy.length ? (has("battery") ? "Yes" : "No") : null,
    heating_system_type: d.heating.length ? d.heating.map((h) => L.heating[h]).join(", ") : null,
    driver: d.intent ? L.intent[d.intent] : null,
    referral_source: d.source.length ? d.source.map((s) => L.source[s]).join(", ") : null,
    timeline: d.timing ? L.timing[d.timing] : null,
    comments: d.notes || null,
    // The intake asks for the monthly update as its own unticked box (S6).
    newsletter_opt_in: !!d.newsletter_opt_in,
    payment_ref: null,
  };
  if (String((env || {}).INTAKE_LEAD_COLUMNS || "").trim() === "on") {
    const answers = {};
    ANSWER_KEYS.forEach((k) => { const v = d[k]; if (Array.isArray(v) ? v.length : (v !== "" && v != null && v !== false)) answers[k] = v; });
    answers.tags = d.heating.includes("ducted_rc") ? ["interest:ducted-rc"] : [];
    const started = Number(d.ts_started) > 0 ? new Date(Number(d.ts_started)).toISOString() : null;
    Object.assign(row, {
      // Stage 1 sends no partials; a later "Help us prepare" send is its own
      // event, so the unique (intake_lead_id, intake_event) index keeps both rows.
      intake_lead_id: d.lead_id, intake_event: d.followup ? "details" : "complete",
      intent: d.intent || null, route: d.route || null, rung_reached: RUNG[d.rung_reached] || null,
      tenure: d.tenure || null, boiler_condition: d.boiler_condition || null,
      ts_started: started, ts_last: at, answers,
    });
  }
  return row;
}

module.exports = { parseIntake, claimSend, settleSend, claimFirstEmail, intakeLeadRow, firstEmailKey, PHONE_OK, formatIntakeNotification, formatIntakeSubject, intakeAttachments, sniff, LABELS: L, SLOTS };
