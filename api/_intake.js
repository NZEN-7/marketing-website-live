/* =========================================================================
   The intake (form key "intake"): parse, notify, attach. PROTOTYPE (PRD D13)
   -------------------------------------------------------------------------
   Required by api/lead.js; not a route (underscore). One submit at the end:
   one notification to nickz@ (TEST_RECIPIENT off production) in SPEC §7
   order, with any uploads attached (PRD D3). No leads insert, no customer
   email, no saves: those are phase 1, after the PRD is approved.
   ========================================================================= */
"use strict";

const crypto = require("crypto");

const clamp = (s, max) => {
  const t = String(s == null ? "" : s).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").trim();
  return t.length > max ? t.slice(0, max) : t;
};
const oneLine = (s) => String(s || "").replace(/[\r\n]+/g, " ").trim();
const list = (v, max = 12) => (Array.isArray(v) ? v : v ? [v] : []).map((x) => clamp(x, 60)).filter(Boolean).slice(0, max);

// Card values -> the card titles people saw (SPEC rev A). Unknown values are dropped.
const L = {
  intent: { fit: "Help me work out if it fits my home", book: "I'm ready to book", explore: "I'm just exploring", urgent: "My boiler's broken or failing" },
  source: { search: "Google or another search engine", ai: "An AI assistant (ChatGPT, Claude, etc.)", friend: "A friend, family member or neighbour",
            installer: "My installer, plumber or electrician", facebook: "A Facebook group or online forum", event: "An event or expo",
            news: "News, a podcast or an article", other: "Other" },
  call_times: { lunchtime: "Weekdays around lunchtime", after_5: "Weekdays after 5pm", weekends: "Weekends", any: "Any time" },
  heating: { boiler_radiators: "Gas boiler with radiators", boiler_underfloor: "Gas boiler with underfloor", lpg_boiler: "LPG boiler",
             ducted_gas: "Ducted gas", splits: "Split systems", other: "Something else", none: "No heating yet", not_sure: "Not sure" },
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
  built_band: { pre_1950: "Before 1950", "1950_1990": "1950–1990", "1990_2010": "1990–2010", post_2010: "After 2010", not_sure: "Not sure" },
  off_gas: { everything: "Yes, everything off gas", keep_cooktop: "Yes, but keep the gas cooktop", heating_only: "Just the heating for now", not_sure: "Not sure" },
};
const SLOTS = { winter_gas_bill: "winter gas bill", boiler_compliance_plate: "boiler compliance plate", switchboard: "switchboard", electricity_bill: "electricity bill" };
const ROUTES = ["icp", "explore", "urgent", "out-of-area", "not-our-product", "renter"];
const OUTCOMES = ["completed", "book_chat", "deposit", "keep_posted", "no_thanks", "urgent_call", "urgent_book", "n1_chat", "landlord_share"];
const SCREENS = /^(intro|S\d{1,2}b?|MATCH|MATCH_SHORT|URGENT|DONE|O1|N1|R1|POSTED)$/;

// Which screen asks which key: "Not asked" (screen never shown) vs "Skipped" (shown, no answer).
const ASKED_ON = { phone: "S4", call_times: "S4b", intent: "S5", source: "S6", referrer: "S6", heating: "S7", heating_other_text: "S7",
  boiler_condition: "S8", boiler_age: "S8", tenure: "S9", scope: "S10", energy: "S11", winter_gas_bill_band: "S12", timing: "S13",
  timing_note: "S13", storeys: "S14", radiator_band: "S14", built_band: "S14", off_gas: "S15", uploads: "S16", notes: "S17" };

const pick = (map, v) => (Object.prototype.hasOwnProperty.call(map, v) ? v : "");

function parseIntake(body) {
  const nojs = String(body.nojs) === "1";
  const d = {
    form: "intake", formLabel: "Website Intake (prototype)", nojs,
    lead_id: "il-" + crypto.randomBytes(5).toString("hex"),
    first_name: clamp(body.first_name, 120), last_name: clamp(body.last_name, 120),
    email: clamp(body.email, 200), phone: clamp(body.phone, 40),
    contact_pref: pick({ phone: 1, email: 1 }, body.contact_pref),
    call_times: list(body.call_times).filter((v) => L.call_times[v]),
    postcode: clamp(body.postcode, 4).replace(/\D/g, ""), suburb: clamp(body.suburb, 120),
    state: clamp(body.state, 3).toUpperCase(), remote: body.remote === true || body.remote === "true",
    intent: pick(L.intent, body.intent),
    source: list(body.source).filter((v) => L.source[v]), referrer: clamp(body.referrer, 200),
    newsletter_opt_in: body.newsletter_opt_in === true || body.newsletter_opt_in === "true",
    heating: list(body.heating).filter((v) => L.heating[v]), heating_other_text: clamp(body.heating_other_text, 300),
    boiler_condition: pick(L.boiler_condition, body.boiler_condition), boiler_age: pick(L.boiler_age, body.boiler_age),
    tenure: pick(L.tenure, body.tenure),
    scope: list(body.scope).filter((v) => L.scope[v]), energy: list(body.energy).filter((v) => L.energy[v]),
    winter_gas_bill_band: pick(L.winter_gas_bill_band, body.winter_gas_bill_band),
    timing: pick(L.timing, body.timing), timing_note: clamp(body.timing_note, 500),
    storeys: pick(L.storeys, body.storeys), radiator_band: pick(L.radiator_band, body.radiator_band),
    built_band: pick(L.built_band, body.built_band), off_gas: pick(L.off_gas, body.off_gas),
    send_later: list(body.send_later).filter((v) => SLOTS[v]),
    notes: clamp(body.notes, 5000),
    landlord_name: clamp(body.landlord_name, 200), landlord_email: clamp(body.landlord_email, 200),
    route: ROUTES.indexOf(body.route) !== -1 ? body.route : "", outcome: OUTCOMES.indexOf(body.outcome) !== -1 ? body.outcome : (nojs ? "completed" : ""),
    rung_reached: ["1", "2", "3", "done"].indexOf(String(body.rung_reached)) !== -1 ? String(body.rung_reached) : (nojs ? "done" : ""),
    last_screen: SCREENS.test(String(body.last_screen || "")) ? String(body.last_screen) : "",
    seen: list(body.seen, 40).filter((s) => SCREENS.test(s)),
    uploads: Array.isArray(body.uploads) ? body.uploads.slice(0, 6) : [],
  };
  if (nojs) d.seen = Object.values(ASKED_ON);       // the long form shows every question
  if (!d.first_name || !d.last_name) return { error: "Missing required field: name" };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(d.email)) return { error: "Invalid email address" };
  if (d.state !== "OS" && !/^\d{4}$/.test(d.postcode)) return { error: "Missing required field: postcode" };
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
    `Boiler condition: ${val(d, "boiler_condition", L.boiler_condition)}`,
    `Boiler age: ${val(d, "boiler_age", L.boiler_age)}`,
    `Is it your home: ${val(d, "tenure", L.tenure)}`,
    `Cover: ${val(d, "scope", L.scope)}`,
    `Energy setup: ${val(d, "energy", L.energy)}`,
    `Winter gas bill: ${val(d, "winter_gas_bill_band", L.winter_gas_bill_band)}`,
    `Timing: ${val(d, "timing", L.timing)}`,
    `Anything driving the timing: ${val(d, "timing_note")}`,
    "",
    "THE DETAILS",
    `Storeys: ${val(d, "storeys", L.storeys)}`,
    `Radiators: ${val(d, "radiator_band", L.radiator_band)}`,
    `Built: ${val(d, "built_band", L.built_band)}`,
    `Off gas: ${val(d, "off_gas", L.off_gas)}`,
    `Uploads: ${upl.length ? upl.join("; ") : ((d.seen || []).indexOf("S16") !== -1 ? "Skipped" : "Not asked")}`,
  ];
  if (files && files.rejected.length) lines.push(`Uploads not attached (type or size): ${files.rejected.join(", ")}`);
  if (d.landlord_name || d.landlord_email) lines.push("", "LANDLORD", `Name: ${d.landlord_name || "-"}`, `Email: ${d.landlord_email || "-"}`);
  lines.push("", "ANYTHING ELSE", d.notes || val(d, "notes"), "");
  return lines.join("\n");
}
function formatIntakeSubject(d) {
  const head = d.route === "urgent" ? "URGENT" : "Website lead";
  const place = d.state === "OS" ? "Outside Australia" : [d.suburb, d.state].filter(Boolean).join(", ") || d.postcode;
  const heat = d.heating.length ? d.heating.map((h) => L.heating[h]).join(" + ") : "heating not given";
  return oneLine(`${head} · ${d.first_name} ${d.last_name} · ${place} · ${d.route || "-"} · ${heat} · ${d.lead_id}${d.nojs ? " [no-JS]" : ""}`);
}

module.exports = { parseIntake, formatIntakeNotification, formatIntakeSubject, intakeAttachments, sniff, LABELS: L, SLOTS };
