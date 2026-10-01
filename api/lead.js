/* =========================================================================
   Thermal Dawn — website form handler
   -------------------------------------------------------------------------
   One Vercel serverless function behind all three site forms. It validates,
   screens obvious bots, and emails a PARSEABLE PLAIN-TEXT notification to
   nickz@thermaldawn.com. Gmail is the intake system of record and the sales
   agent parses these emails, so the layouts in formatNotification() are a
   contract: keep the section headings and field labels byte-stable.

   Transport is Nick's own Google Workspace account over SMTP, chosen so that
   customer PII never passes through a third-party form/email processor.
   Credentials come from Vercel env vars, never the repo.

   Spec: .claude/W1-forms-spec.md
   ========================================================================= */

"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
// The intake prototype (PRD D13): its own module, so this file's diff stays small.
const intake = require("./_intake.js");

const TZ = "Australia/Sydney";
const NOTIFY_TO = "nickz@thermaldawn.com";
const CALENDLY = "https://calendly.com/nickz-thermaldawn/30min";
// Live from 25 Aug 2026. Autoresponders are read outside the site, so links in
// them have to be absolute.
const SITE = "https://www.thermaldawn.com";

/* Config read per call, so tests and the Vercel envs can differ (brief 07).
   - AUTORESPONDER_FROM: the first email's From. Default "Nick at Thermal Dawn"
     <GMAIL_USER>; the later switch to noreply@ is one env change.
   - BOOKING_LINK: the {booking_link} in the first emails. Never written into a
     template; the constant above is only the fallback.
   - VERCEL_ENV !== "production" (preview, local, tests): EVERY outbound email
     goes to TEST_RECIPIENT, and nothing is sent if it is unset; no row goes
     into the production CRM (CTO Re: Web #12, A5). */
const isProduction = () => process.env.VERCEL_ENV === "production";
const bookingLink = () => {
  const v = String(process.env.BOOKING_LINK || "").trim();
  return /^https:\/\/\S+$/.test(v) ? v : CALENDLY;
};
const autoresponderFrom = () =>
  stripHeader(process.env.AUTORESPONDER_FROM) ||
  `"Nick at Thermal Dawn" <${process.env.GMAIL_USER}>`;

/* ---------- small helpers ---------- */

// Subjects are headers: a newline in user input could inject extra headers.
const stripHeader = (s) => String(s == null ? "" : s).replace(/[\r\n]+/g, " ").trim();

const clamp = (s, max) => {
  const t = String(s == null ? "" : s).trim();
  return t.length > max ? t.slice(0, max) : t;
};

const asText = (v, max = 500) => clamp(v, max);

const asList = (v, max = 40) =>
  (Array.isArray(v) ? v : v == null || v === "" ? [] : [v])
    .map((x) => clamp(x, 200))
    .filter(Boolean)
    .slice(0, max);

// "-" keeps every labelled line present even when a field is empty, so the
// parser on the other end never has to cope with a missing line.
const orDash = (s) => (s && String(s).trim() ? String(s).trim() : "-");
const joinList = (a) => (a && a.length ? a.join(", ") : "-");

const isEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(s || "").trim());

/** "31 July 2026 at 2:40 pm AEST" */
function formatTimestamp(d) {
  const when = d instanceof Date ? d : new Date();
  const date = new Intl.DateTimeFormat("en-AU", {
    timeZone: TZ, day: "numeric", month: "long", year: "numeric",
  }).format(when);
  const time = new Intl.DateTimeFormat("en-AU", {
    timeZone: TZ, hour: "numeric", minute: "2-digit", hour12: true,
  }).format(when).toLowerCase().replace(/\s+/g, " ").trim();
  const zonePart = new Intl.DateTimeFormat("en-AU", {
    timeZone: TZ, timeZoneName: "short",
  }).formatToParts(when).find((p) => p.type === "timeZoneName");
  return `${date} at ${time}${zonePart ? " " + zonePart.value : ""}`;
}

/* ---------- validation ---------- */

const FORMS = {
  "register-interest": {
    label: "Homeowner Register Interest",
    required: ["first_name", "last_name", "email", "phone", "suburb", "state",
               "heating", "solar", "battery"],
    requiredLists: ["drivers", "timeline"],
  },
  contact: { label: "Contact Form", required: ["name", "email"], requiredLists: [] },
  subscribe: { label: "Subscribe Form", required: ["email"], requiredLists: [] },
  // Deposit forms. "basic-reserve" is retired (CEO Option B, 27 Sep 2026): its
  // page now redirects to /interest/, so nothing posts it. Kept so a stale,
  // cached copy of the old page still records rather than erroring. These record INTENT: the email is sent immediately before
  // the visitor is handed to Stripe, so an abandoned checkout still leaves a
  // qualified lead. Stripe remains the source of truth for money.
  "basic-reserve": {
    label: "Basic Reserve ($190 deposit)",
    tier: "Basic Reserve",
    amount: "$190",
    required: ["first_name", "last_name", "email", "phone", "address", "heating", "timeline"],
    requiredLists: [],
    requiresTerms: true,
  },
  // The key stays "founder-premium" (the booking page, forms.js and the Stripe
  // config all name it), but the offer is no longer a tier: one $990 booking
  // deposit since the CEO's Option B (Nick, 27 Sep 2026). Only the label and
  // tier TEXT changed, as ruled; the email field labels did not, so the CRM
  // parser is unaffected. Older rows say "Founder Premium ($990 deposit)".
  "founder-premium": {
    label: "Booking Deposit ($990)",
    tier: "Booking deposit",
    amount: "$990",
    required: ["first_name", "last_name", "email", "phone", "address", "heating", "timeline"],
    requiredLists: [],
    requiresTerms: true,
  },
  // Free register-interest list (CEO Option B, item 4): heating and cooling,
  // hot water, states we don't serve yet, and NZ. No payment, no promise of
  // price or date. It is a demand signal, NOT pipeline: the form label is its
  // own value so lead and pipeline counts can exclude it. No new table or
  // column until the CTO's CRM ruling (4 Oct): it writes the existing leads
  // columns, and its interest:* tags are computed from state + interest, so
  // they can be re-derived from the row at any time (listTags below).
  "interest-list": {
    label: "Interest List",
    required: ["first_name", "email", "state", "postcode", "interest", "heating", "timeline"],
    requiredLists: [],
    requiresConsent: true,
  },
};

/* States we install in today: VIC and NSW, and the ACT, which sits inside
   NSW's climate and installer reach (CTO, Re: Web #4, 27 Sep 2026; Nick can
   overrule). Change here and in /interest/'s SERVED list together;
   test:leadrow fails if they drift. */
const SERVED_STATES = ["VIC", "NSW", "ACT"];
// The interest list's other choices (interest/index.html): known, and not
// served. Anything outside both lists is unrecognised and gets the served
// email (brief 07 decision 1; GPT Web B07-S1).
const UNSERVED_STATES = ["QLD", "SA", "WA", "TAS", "NT", "NZ"];

/** CRM tags for an interest-list signup (CEO ruling, item 4). Pure, so the
    tags can be recomputed from a stored row. Empty when the person is in a
    served state and wants heating only: the ruling sends them to the booking
    funnel, not the list, so Sales treats them as an ordinary lead. */
function listTags(d) {
  const tags = [];
  const interest = String(d.interest || "").toLowerCase();
  const state = String(d.state || "").toUpperCase();
  if (interest === "heating and cooling" || interest === "cooling") tags.push("interest:heating-cooling");
  if (interest === "hot water") tags.push("interest:hot-water");
  if (state === "NZ") tags.push("interest:nz");
  else if (state && SERVED_STATES.indexOf(state) === -1) tags.push("interest:unserved-state");
  return tags;
}

const isDeposit = (form) => form === "basic-reserve" || form === "founder-premium";

/** Short human-quotable reference tying the lead email to the Stripe payment. */
function makeRef() {
  return "td-" + Date.now().toString(36) + Math.floor(Math.random() * 1296).toString(36).padStart(2, "0");
}

/* ---------- lead capture (Supabase) ----------
   Second consumer of a contract that already exists. The notification email
   stays the system of record and is sent FIRST; this runs after it and can
   never fail the request. Worst case we are back to exactly today's behaviour,
   with the lead sitting in the inbox.

   No SDK on purpose. This repo has one dependency and a "no build step" rule;
   PostgREST is a plain HTTP endpoint, and a hand-rolled fetch has no
   supply-chain surface for a 30-line insert.

   The service-role key bypasses RLS, which is why it is server-side only and
   never reaches the browser. The form posts here, exactly as it did before. */


/** Which key the leads insert uses. Keys plan (CTO, 25-27 Sep 2026):
    the website should hold a key that can INSERT into public.leads and do
    nothing else, not the service-role key, which bypasses RLS on every
    table. SUPABASE_LEADS_KEY is a JWT for the `lead_writer` role
    (scripts/supabase/), sent as the bearer; the gateway still wants a
    project key as `apikey`, and the public anon key is the right one.

    Order of preference, so the rollout can happen in any order and a
    half-configured Vercel never drops a row:
      1. SUPABASE_LEADS_KEY + SUPABASE_ANON_KEY   the insert-only role
      2. SUPABASE_SERVICE_ROLE_KEY                 the old way, until removed
      3. neither                                   skip, loudly
    Pure, so test:leadrow checks it without credentials. */
function supabaseAuth(env) {
  const leads = env.SUPABASE_LEADS_KEY, anon = env.SUPABASE_ANON_KEY;
  if (leads && anon) return { via: "lead_writer", apikey: anon, bearer: leads };
  if (env.SUPABASE_SERVICE_ROLE_KEY) {
    return { via: leads ? "service_role (SUPABASE_ANON_KEY missing)" : "service_role",
             apikey: env.SUPABASE_SERVICE_ROLE_KEY, bearer: env.SUPABASE_SERVICE_ROLE_KEY };
  }
  return null;
}

/** Multi-selects arrive as arrays; leads stores one readable string.
    Deliberately NOT the joinList above: that one returns "-" for empty, which
    is a display convention for the email body. Written into a column it would
    make an unanswered question look answered. Empty means NULL here.
    Also tolerates a plain string, because the deposit forms send timeline as
    text while register-interest sends it as a list. */
const joinForDb = (v) =>
  (Array.isArray(v) ? v.filter(Boolean).join(", ") : (v || "")) || null;

function leadRow(d) {
  return {
    submitted_at: new Date().toISOString(),
    // FORMS[...].label, so these read identically to the Wix-era values
    // ("Homeowner Register Interest", "Contact Form", "Subscribe Form") and the
    // backfill lands in the same vocabulary instead of a parallel one.
    form: d.formLabel,
    source_site: "freevolt",
    // Contact form collects one name field. Wix put the whole name in
    // first_name too, so matching that keeps both eras comparable.
    first_name: d.first_name || d.name || null,
    last_name: d.last_name || null,
    email: d.email || null,
    phone: d.phone || null,
    // Interest-list rows carry a postcode here: the list asks for state and
    // postcode, not suburb, and no column is added before the CRM ruling.
    // form = "Interest List" says which it is.
    suburb: d.suburb || d.postcode || null,
    state: d.state || null,
    address: d.address || null,
    solar: d.solar || null,
    battery: d.battery || null,
    heating_system_type: d.heating || null,
    // Interest-list: what they want (heating and cooling, hot water, ...).
    driver: joinForDb(d.drivers) || d.interest || null,
    // NULL when the question was skipped. It is optional, so an empty
    // answer is not a claim that they came from nowhere.
    referral_source: joinForDb(d.referral),
    timeline: joinForDb(d.timeline),
    comments: d.comments || d.message || null,
    // NULL, not false, on every form that does not ask. Subscribe and
    // register-interest both state consent under their submit button and post
    // optin=true; recording "No" for the rest would assert a refusal nobody
    // made. The form column carries the basis: a Subscribe Form row is someone
    // who came for the newsletter, a quote row is bundled consent.
    // The interest list's required tick is consent to be contacted about the
    // list, not a newsletter opt-in, so it is NULL here too (Platform review
    // S1, 28 Sep 2026). The email still records it; consent gets its own
    // column only after the CTO's CRM ruling (4 Oct).
    newsletter_opt_in:
      d.form === "subscribe" || d.form === "register-interest"
        ? !!d.optin
        : null,
    payment_ref: d.ref || null,
  };
}

/** An insert failure carries an HTTP status and the Postgres or PostgREST
    error CODE only (e.g. 23505, PGRST204). The body's message, detail and hint
    can quote row values, so they are never kept (brief 07, decision 3). */
class InsertError extends Error {
  constructor(status, code) {
    super("insert_failed");
    this.status = status;
    this.pgCode = code;
  }
}

async function recordLead(d) {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const auth = supabaseAuth(process.env);
  if (!SUPABASE_URL || !auth) return "skipped (not configured)";
  // A preview or local run never writes a leads row, whatever SUPABASE_URL
  // says: a proxy or custom domain for the production project would not carry
  // its ref (GPT Web B07-N2; the preview-guard rule, folded in 1 Oct).
  if (!isProduction()) return "skipped (non-production)";
  // return=minimal matters for lead_writer: it can insert but not read, so
  // asking for the row back would fail the insert.
  const res = await fetch(`${SUPABASE_URL}/rest/v1/leads`, {
    method: "POST",
    headers: {
      apikey: auth.apikey,
      Authorization: `Bearer ${auth.bearer}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify(leadRow(d)),
  });
  if (!res.ok) {
    let code = "";
    try { code = String((JSON.parse(await res.text()) || {}).code || ""); } catch (_) { /* not JSON */ }
    throw new InsertError(res.status, /^[A-Z0-9]{1,12}$/.test(code) ? code : "");
  }
  return "ok";
}

/** Normalise the raw body into a known shape; returns {data} or {error}. */
function parseSubmission(body) {
  const form = String(body && body.form ? body.form : "").trim();
  if (form === "intake") return intake.parseIntake(body);
  const spec = FORMS[form];
  if (!spec) return { error: "Unknown form" };

  const data = { form, formLabel: spec.label };

  // Subscribe and register-interest both state the consent under their submit
  // button and post a hidden optin field. Normalised once, here, so the two
  // cannot drift apart: a quote form that stated consent but dropped it on the
  // way through would have the site claiming something nothing recorded.
  if (form === "subscribe" || form === "register-interest") {
    data.optin =
      body.optin === true || body.optin === "true" || body.optin === "on";
  }

  if (form === "register-interest") {
    Object.assign(data, {
      first_name: asText(body.first_name, 120),
      last_name: asText(body.last_name, 120),
      email: asText(body.email, 200),
      phone: asText(body.phone, 60),
      suburb: asText(body.suburb, 160),
      state: asText(body.state, 40),
      heating: asText(body.heating, 120),
      solar: asText(body.solar, 40),
      battery: asText(body.battery, 40),
      drivers: asList(body.drivers),
      referral: asList(body.referral),
      timeline: asList(body.timeline),
      comments: asText(body.comments, 5000),
    });
  } else if (isDeposit(form)) {
    Object.assign(data, {
      tier: spec.tier,
      amount: spec.amount,
      first_name: asText(body.first_name, 120),
      last_name: asText(body.last_name, 120),
      email: asText(body.email, 200),
      phone: asText(body.phone, 60),
      address: asText(body.address, 300),
      heating: asText(body.heating, 120),
      timeline: asText(body.timeline, 200),
      comments: asText(body.comments, 5000),
      terms: body.terms === true || body.terms === "true" || body.terms === "on",
      ref: makeRef(),
    });
  } else if (form === "interest-list") {
    Object.assign(data, {
      first_name: asText(body.first_name, 120),
      last_name: asText(body.last_name, 120),
      email: asText(body.email, 200),
      phone: asText(body.phone, 60),
      state: asText(body.state, 40),
      postcode: asText(body.postcode, 20),
      interest: asText(body.interest, 60),
      heating: asText(body.heating, 120),
      timeline: asText(body.timeline, 120),
      referral: asList(body.referral),
      consent: body.consent === true || body.consent === "true" || body.consent === "on",
    });
    data.tags = listTags(data);
  } else if (form === "contact") {
    Object.assign(data, {
      name: asText(body.name, 200),
      email: asText(body.email, 200),
      message: asText(body.message, 5000),
    });
  } else {
    Object.assign(data, {
      email: asText(body.email, 200),
    });
  }

  for (const key of spec.required) {
    if (!data[key]) return { error: "Missing required field: " + key };
  }
  for (const key of spec.requiredLists) {
    if (!data[key] || !data[key].length) return { error: "Missing required field: " + key };
  }
  if (spec.requiresTerms && data.terms !== true) {
    return { error: "The pre-order terms must be accepted" };
  }
  if (spec.requiresConsent && data.consent !== true) {
    return { error: "Consent to be contacted is required to join the list" };
  }
  if (!isEmail(data.email)) return { error: "Invalid email address" };

  return { data };
}

/* ---------- email bodies (the contract) ---------- */

/* The interest list's NOTE says what the customer actually got (CTO Re
   Web #31, item 24): the same rule that picks the first email, so the two
   never disagree. Internal only; prose, not a parser label. */
function listNote(d) {
  if (!isUnservedListLead(d)) return "NOTE: Sent §1, served: treat as a normal lead and invite them to book.";
  const state = String(d.state || "").trim().toUpperCase();
  const reason = state === "NZ" ? "New Zealand"
    : UNSERVED_STATES.indexOf(state) !== -1 ? `${state} is outside our area`
    : "split systems only";
  return `NOTE: Sent §2, interest list: not a fit (${reason}); not pipeline, keep it out of lead counts.`;
}

function formatNotification(d, stamp) {
  const when = stamp || formatTimestamp();
  if (d.form === "intake") return intake.formatIntakeNotification(d, when, d._files);

  // Interest list. New labels (Postcode, Interested in, Consent to be
  // contacted, Tags) and sections (INTEREST, LIST) are in lead-parser.gs;
  // test:parser round-trips this body. The NOTE is prose, not a label.
  if (d.form === "interest-list") {
    const tags = d.tags && d.tags.length ? d.tags : [];
    return [
      "Hi Thermal Dawn Team,",
      "",
      `Form: ${d.formLabel}`,
      `Submission Time: ${when}`,
      "",
      listNote(d),
      "",
      "CONTACT",
      `First name: ${orDash(d.first_name)}`,
      `Last name: ${orDash(d.last_name)}`,
      `Email: ${orDash(d.email)}`,
      `Phone: ${orDash(d.phone)}`,
      "",
      "LOCATION",
      `State: ${orDash(d.state)}`,
      `Postcode: ${orDash(d.postcode)}`,
      "",
      "INTEREST",
      `Interested in: ${orDash(d.interest)}`,
      `Current heating/cooling system: ${orDash(d.heating)}`,
      `Timeline: ${orDash(d.timeline)}`,
      `How did you hear about us: ${joinList(d.referral)}`,
      `Consent to be contacted: ${d.consent ? "Yes" : "No"}`,
      "",
      "LIST",
      `Tags: ${joinList(tags.concat(["source:website"]))}`,
      "",
    ].join("\n");
  }

  if (d.form === "register-interest") {
    return [
      "Hi Thermal Dawn Team,",
      "",
      `Form: ${d.formLabel}`,
      `Submission Time: ${when}`,
      "",
      "CONTACT",
      `First name: ${orDash(d.first_name)}`,
      `Last name: ${orDash(d.last_name)}`,
      `Email: ${orDash(d.email)}`,
      `Phone: ${orDash(d.phone)}`,
      "",
      "LOCATION",
      `Suburb: ${orDash(d.suburb)}`,
      `State: ${orDash(d.state)}`,
      "",
      "CURRENT SETUP",
      `Solar: ${orDash(d.solar)}`,
      `Battery: ${orDash(d.battery)}`,
      `Current heating/cooling system: ${orDash(d.heating)}`,
      "",
      "MOTIVATION AND TIMING",
      `What's driving interest: ${joinList(d.drivers)}`,
      `Timeline: ${joinList(d.timeline)}`,
      "",
      "CONTEXT",
      `Comments: ${orDash(d.comments)}`,
      `How did you hear about us: ${joinList(d.referral)}`,
      `Newsletter opt-in: ${d.optin ? "Yes" : "No"}`,
      "",
    ].join("\n");
  }

  if (isDeposit(d.form)) {
    return [
      "Hi Thermal Dawn Team,",
      "",
      `Form: ${d.formLabel}`,
      `Submission Time: ${when}`,
      "",
      "NOTE: This records the form submission, made immediately before Stripe",
      "checkout. Confirm the payment itself in Stripe (reference below).",
      "",
      "CONTACT",
      `First name: ${orDash(d.first_name)}`,
      `Last name: ${orDash(d.last_name)}`,
      `Email: ${orDash(d.email)}`,
      `Phone: ${orDash(d.phone)}`,
      "",
      "PROPERTY",
      `Address: ${orDash(d.address)}`,
      "",
      "CURRENT SETUP",
      `Current heating/cooling system: ${orDash(d.heating)}`,
      "",
      "MOTIVATION AND TIMING",
      `Timeline: ${orDash(d.timeline)}`,
      "",
      "CONTEXT",
      `Comments: ${orDash(d.comments)}`,
      "",
      "DEPOSIT",
      `Tier: ${orDash(d.tier)}`,
      `Amount: ${orDash(d.amount)}`,
      `Terms accepted: ${d.terms ? "Yes" : "No"}`,
      `Reference: ${orDash(d.ref)}`,
      "",
    ].join("\n");
  }

  if (d.form === "contact") {
    return [
      "Hi Thermal Dawn Team,",
      "",
      `Form: ${d.formLabel}`,
      `Submission Time: ${when}`,
      "",
      "CONTACT",
      `Name: ${orDash(d.name)}`,
      `Email: ${orDash(d.email)}`,
      "",
      "MESSAGE",
      orDash(d.message),
      "",
    ].join("\n");
  }

  return [
    `Form: ${d.formLabel}`,
    `Submission Time: ${when}`,
    "",
    `Email: ${orDash(d.email)}`,
    `Newsletter opt-in: ${d.optin ? "Yes" : "No"}`,
    "",
  ].join("\n");
}

function formatSubject(d) {
  if (d.form === "intake") return intake.formatIntakeSubject(d);
  if (d.form === "register-interest") {
    return stripHeader(
      `New website lead: ${d.first_name} ${d.last_name} · ${d.heating} · ${d.email}`
    );
  }
  if (d.form === "interest-list") {
    return stripHeader(
      `New interest-list signup: ${[d.first_name, d.last_name].filter(Boolean).join(" ")} · ${d.interest} · ${d.state} · ${d.email}`
    );
  }
  if (isDeposit(d.form)) {
    return stripHeader(
      `New deposit intent: ${d.first_name} ${d.last_name} · ${d.tier} · ${d.email}`
    );
  }
  if (d.form === "contact") {
    return stripHeader(`New website message: ${d.name} · ${d.email}`);
  }
  return stripHeader(`New subscriber: ${d.email}`);
}

/* ---------- first emails (brief 07) ----------
   One template per form, in api/_first-emails/, pasted from Sales' HANDOVER
   (Sales +/Consumer/Sales Playbook/_Templates/First emails/). Wording is
   edited there first, never here.

   Deposits get none: that form posts BEFORE the Stripe handoff, and Stripe
   sends the receipt (CTO Re: Web #12, A1). A paid-booking email waits for a
   Stripe-webhook brief of its own. */
const AUTORESPOND = { "register-interest": true, contact: true, subscribe: true, "interest-list": true };

/* Unserved (HANDOVER §2) only when CLEARLY unserved: a known unserved state
   (UNSERVED_STATES, NZ included), or "Split systems only". Anything else,
   including a missing or unrecognised value, is served (§1) and gets a call.
   Not listTags: that one tags served-state cooling and hot-water leads. */
function isUnservedListLead(d) {
  if (d.form !== "interest-list") return false;
  const state = String(d.state || "").trim().toUpperCase();
  if (UNSERVED_STATES.indexOf(state) !== -1) return true;
  return String(d.heating || "").trim() === "Split systems only";
}

function templateKey(d) {
  if (d.form === "interest-list") return isUnservedListLead(d) ? "interest-list-unserved" : "register-interest";
  if (d.form === "register-interest" || d.form === "contact" || d.form === "subscribe") return d.form;
  return null;
}

/* List emails must carry a working unsubscribe (Spam Act; CTO Re: Web #12,
   A2). Until Sales' line is in the HANDOVER and pasted, the template is not
   used and today's email, which has one, goes instead. */
const LIST_TEMPLATES = { subscribe: true, "interest-list-unserved": true };

const TEMPLATE_DIR = path.join(__dirname, "_first-emails");
const templateCache = {};

/** "# " comment lines, then "Subject:" and "Subject-no-name:", a blank line,
    then the body. */
function loadTemplate(key) {
  if (templateCache[key]) return templateCache[key];
  const raw = fs.readFileSync(path.join(TEMPLATE_DIR, key + ".txt"), "utf8").replace(/\r\n/g, "\n");
  const lines = raw.split("\n");
  let i = 0;
  while (i < lines.length && lines[i].startsWith("#")) i++;
  const head = {};
  for (; i < lines.length && lines[i].trim() !== ""; i++) {
    const m = lines[i].match(/^(Subject|Subject-no-name):\s*(.*)$/);
    if (!m) throw new Error(`template ${key}: bad header line ${i + 1}`);
    head[m[1]] = m[2];
  }
  if (!head.Subject) throw new Error(`template ${key}: no Subject`);
  const t = { key, subject: head.Subject, subjectNoName: head["Subject-no-name"] || head.Subject,
              body: lines.slice(i + 1).join("\n").replace(/\s+$/, "") + "\n" };
  templateCache[key] = t;
  return t;
}

/** A first name fit to put in a greeting and a Subject: one word, letters,
    apostrophes and hyphens only. Anything else is dropped for the HANDOVER's
    no-name greeting, so nothing odd reaches a header or the body. */
function firstNameFor(d) {
  const first = String(d.first_name || d.name || "").trim().split(/\s+/)[0] || "";
  return /^[\p{L}][\p{L}'\u2019-]{0,39}$/u.test(first) ? first : "";
}

function renderTemplate(t, d) {
  const name = firstNameFor(d);
  const hasPhone = !!String(d.phone || "").trim();
  let body = t.body
    .replace(/\[phone\]([\s\S]*?)\[\/phone\]\n?/g, hasPhone ? "$1\n" : "")
    .replace(/\[no-phone\]([\s\S]*?)\[\/no-phone\]\n?/g, hasPhone ? "" : "$1\n")
    .split("{first_name}").join(name || "there")
    .split("{booking_link}").join(bookingLink());
  const subject = stripHeader((name ? t.subject : t.subjectNoName).split("{first_name}").join(name));
  return { subject, text: body };
}

/** What the first email to this lead is: {template, subject, text}, or null
    when this form gets none. Pure apart from reading the template file. */
function firstEmail(d) {
  if (!AUTORESPOND[d.form]) return null;
  const key = templateKey(d);
  if (!key) return null;
  const t = loadTemplate(key);
  if (LIST_TEMPLATES[key] && !/unsubscribe/i.test(t.body)) {
    return { template: key + " (held: no unsubscribe line yet; today's email sent)",
             subject: legacySubject(d), text: legacyAutoresponder(d) };
  }
  const r = renderTemplate(t, d);
  return { template: key, subject: r.subject, text: r.text };
}

/** Kept for the tests and the harness: the text of the first email. */
function formatAutoresponder(d) {
  const e = firstEmail(d);
  return e ? e.text : "";
}

/* ---- today's autoresponder, kept only for the list emails held above ---- */
function legacySubject(d) {
  return d.form === "subscribe"
    ? "You're subscribed to Thermal Dawn updates"
    : d.form === "interest-list"
      ? "You're on the Thermal Dawn interest list"
      : "Thanks For Getting in Touch";
}

/** First name only, so "Robin Example" greets as "Robin". Falls back to "there". */
function greetingName(d) {
  var raw = d.first_name || d.name || "";
  var first = String(raw).trim().split(/\s+/)[0];
  return first || "there";
}

function legacyAutoresponder(d) {
  // A subscriber gave us an email address and nothing else. They have not asked
  // to be sold to, so this confirms what they signed up for and then offers the
  // quote path once, rather than opening with it.
  if (d.form === "subscribe") {
    return [
      `Hi ${greetingName(d)},`,
      "",
      "You've subscribed to Thermal Dawn updates: installs, pricing, and what",
      "we're learning as we go. No spam, no sales calls.",
      "",
      "If you'd like to talk about a quote for your home, fill in the form here:",
      `${SITE}/pre-order/register-interest/`,
      "",
      `Or just send me an email at ${NOTIFY_TO}.`,
      "",
      "Nick",
      "Thermal Dawn",
      "",
      // The subscribe form now promises "Unsubscribe any time", and until there
      // is a mailing tool with a real unsubscribe link, this is that mechanism.
      'Want out? Reply with "unsubscribe" and I will take you off the list.',
      "",
    ].join("\n");
  }

  // Interest list: confirm what they joined, and promise nothing about price
  // or date (CEO ruling, item 1). A served-state, heating-only signup is sent
  // to the quote form instead, because that is where the ruling routes them.
  if (d.form === "interest-list") {
    // Only reached for a held unserved email now (served leads get §1).
    const served = !isUnservedListLead(d);
    return [
      `Hi ${greetingName(d)},`,
      "",
      served
        ? "Thanks for registering. Good news: we already install hydronic heating in your area."
        : "Thanks for registering. You're on the Thermal Dawn interest list.",
      "",
      served
        ? "To get a written quote for your home, fill in the short form here:"
        : "We don't offer this in your area yet. When we do, you'll hear from us first.",
      served ? `${SITE}/pre-order/register-interest/` : "There's nothing to pay and nothing you've committed to.",
      "",
      `Questions in the meantime? Just reply, or email ${NOTIFY_TO}.`,
      "",
      "Nick",
      "Thermal Dawn",
      "",
      'Want off the list? Reply with "unsubscribe" and I will take you off it.',
      "",
    ].join("\n");
  }

  return [
    `Hi ${greetingName(d)},`,
    "",
    "Thanks for getting in touch. Nick will be back to you within the next few days.",
    "",
    "Keen to talk sooner? Book a call at a time that suits you:",
    CALENDLY,
    "",
    "Or call Nick direct on (02) 7228 3430.",
    "",
    "Keen to chat.",
    "",
    "Nick",
    "Thermal Dawn",
    "",
  ].join("\n");
}

/* ---------- transport ---------- */

function makeTransport() {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) {
    const e = new Error("GMAIL_USER / GMAIL_APP_PASSWORD are not set in the environment");
    e.code = "smtp_env_missing";
    throw e;
  }
  // Required lazily so the formatters above can be unit-tested without the
  // dependency present.
  const nodemailer = require("nodemailer");
  return nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: { user, pass },
  });
}

/* ---------- handler ---------- */

/* ---------- logging (brief 07, decision 3) ----------
   A log line carries the form key, a request ID and an error CODE, nothing
   else: no recipient, name, phone, message, IP, and no Postgres or SMTP
   message text (both can quote the address or the row). */
function errorCode(err) {
  if (!err) return "unknown";
  if (err instanceof InsertError) return `http_${err.status}${err.pgCode ? "_" + err.pgCode : ""}`;
  if (err.code === "smtp_env_missing") return "smtp_env_missing";
  if (Number.isInteger(err.responseCode)) return `smtp_${err.responseCode}`;
  if (typeof err.code === "string" && /^[A-Z0-9_]{1,24}$/.test(err.code)) return err.code;
  return "unknown";
}
function logEvent(reqId, form, event, code) {
  console.error(`lead req=${reqId} form=${/^[a-z-]{1,24}$/.test(form || "") ? form : "unknown"} ${event}${code ? " code=" + code : ""}`);
}

/* ---------- abuse (brief 07) ----------
   Every submission now gets its email, so the form can send ours to any
   address. On top of the honeypot and the (now required) page stamp: a modest
   per-IP cap, per function instance. Instances do not share memory, so this
   slows a burst rather than enforcing a global limit; a shared store is a new
   service and was not chosen (CTO Re: Web #12, 7). The IP is never logged. */
const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_MAX = 10;
const recentByIp = new Map();
function clientIp(req) {
  const h = (req && req.headers) || {};
  const fwd = String(h["x-forwarded-for"] || h["x-real-ip"] || "").split(",")[0].trim();
  return fwd || "unknown";
}
function rateLimited(ip, now) {
  const since = now - RATE_WINDOW_MS;
  const hits = (recentByIp.get(ip) || []).filter((t) => t > since);
  hits.push(now);
  recentByIp.set(ip, hits);
  if (recentByIp.size > 5000) {       // keep the map from growing without bound
    for (const [k, v] of recentByIp) if (!v.some((t) => t > since)) recentByIp.delete(k);
  }
  return hits.length > RATE_MAX;
}

/** Where an email may go. Production: as addressed. Anywhere else: only
    TEST_RECIPIENT, and nothing at all when it is unset. */
function routeTo(addr) {
  if (isProduction()) return addr;
  const t = String(process.env.TEST_RECIPIENT || "").trim();
  return isEmail(t) ? t : null;
}

module.exports = async function handler(req, res) {
  const reqId = crypto.randomBytes(4).toString("hex");
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  let body = req.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch (_) { body = null; }
  }
  if (!body || typeof body !== "object") {
    return res.status(400).json({ ok: false, error: "Invalid request body" });
  }

  // Bot screens. Both return a success shape so a bot learns nothing. The page
  // stamp is required since brief 07: all five forms send it (assets/js/forms.js).
  // The intake's no-JS long form (SPEC rule 11) is a plain form post with no
  // page stamp: it relies on the honeypot and the IP cap, and its subject is
  // tagged [no-JS]. It gets a redirect to the thanks page, not JSON.
  const ct = String((req.headers && req.headers["content-type"]) || "");
  const nojsIntake = body.form === "intake" && String(body.nojs) === "1" && /urlencoded|multipart/.test(ct);
  const reply = (code, json) => {
    if (nojsIntake && code < 400) { res.setHeader("Location", "/start/thanks/"); return res.status(303).end(); }
    return res.status(code).json(json);
  };
  const ts = Number(body.ts);
  const trapped =
    (typeof body.website === "string" && body.website.trim() !== "") ||
    (!nojsIntake && (!(ts > 0) || Date.now() - ts < 3000));
  if (trapped) {
    logEvent(reqId, String(body.form || ""), "screened", "bot_trap");
    return reply(200, { ok: true });
  }
  if (rateLimited(clientIp(req), Date.now())) {
    logEvent(reqId, String(body.form || ""), "screened", "rate_limited");
    return res.status(429).json({ ok: false, error: "Too many submissions. Please email us directly." });
  }

  const { data, error } = parseSubmission(body);
  if (error) return res.status(400).json({ ok: false, error });
  // Intake uploads ride on the notification as attachments (PRD D3).
  if (data.form === "intake") {
    if (!intake.claimSend(data, Date.now())) {
      logEvent(reqId, data.form, "screened", "repeat_send");
      return reply(200, { ok: true });
    }
    data._files = intake.intakeAttachments(data);
  }

  try {
    const transport = makeTransport();
    const from = `"Thermal Dawn Website" <${process.env.GMAIL_USER}>`;

    // 1. The notification: the contract and the system of record, so it goes
    //    FIRST, as it always has (CTO Re: Web #12, A3).
    const notifyTo = routeTo(NOTIFY_TO);
    if (notifyTo) {
      await transport.sendMail({
        from,
        to: notifyTo,
        replyTo: data.email,
        subject: formatSubject(data),
        text: formatNotification(data),
        attachments: data._files ? data._files.attachments.map((a) =>
          ({ filename: a.filename, content: a.content, contentType: a.contentType })) : undefined,
      });
    } else {
      logEvent(reqId, data.form, "notification_skipped", "test_recipient_unset");
    }

    // 2. The leads insert. The email is out and the lead is safe; everything
    //    below is best effort.
    //
    // AWAITED deliberately. Returning before this settles lets Vercel freeze or
    // kill the container mid-flight, and the insert vanishes with no error
    // anywhere: passes every local test, drops rows under real traffic.
    // "Non-fatal" and "fire-and-forget" are not the same thing.
    // The intake prototype writes no leads row: its columns need the PRD's
    // migration first (PRD §3.1).
    if (data.form === "intake") logEvent(reqId, data.form, "insert_skipped", "intake_prototype");
    else try {
      const r = await recordLead(data);
      if (r !== "ok") logEvent(reqId, data.form, "insert_skipped", r === "skipped (non-production)" ? "non_production" : "not_configured");
    } catch (leadErr) {
      logEvent(reqId, data.form, "insert_failed", errorCode(leadErr));
    }

    // Deposits: no first email. Stripe sends the receipt, and the thank-you
    // page covers what happens next. The client needs the ref so it can hand
    // it to Stripe as client_reference_id.
    if (isDeposit(data.form)) {
      return res.status(200).json({ ok: true, ref: data.ref });
    }

    // 3. The first email. Best effort: a failure never costs us the lead,
    //    including a template that fails to load.
    let first = null;
    try { first = firstEmail(data); } catch (tplErr) {
      logEvent(reqId, data.form, "first_email_failed", "template_unavailable");
    }
    if (first) {
      const to = routeTo(data.email);
      if (!to) {
        logEvent(reqId, data.form, "first_email_skipped", "test_recipient_unset");
      } else {
        try {
          await transport.sendMail({
            from: autoresponderFrom(),
            to,
            replyTo: NOTIFY_TO,
            subject: first.subject,
            text: first.text,
          });
        } catch (autoErr) {
          logEvent(reqId, data.form, "first_email_failed", errorCode(autoErr));
        }
      }
    }

    return reply(200, { ok: true });
  } catch (err) {
    // Never echo submitted PII back to the client, and never log it.
    if (data.form === "intake") intake.releaseSend(data);
    logEvent(reqId, data.form, "notification_failed", errorCode(err));
    return res.status(500).json({ ok: false, error: "Could not send. Please email us directly." });
  }
};

/* Exported for the local format harness (scripts/test-email-format.js). */
module.exports.formatNotification = formatNotification;
module.exports.formatSubject = formatSubject;
module.exports.formatAutoresponder = formatAutoresponder;
module.exports.formatTimestamp = formatTimestamp;
module.exports.parseSubmission = parseSubmission;
module.exports.leadRow = leadRow;
module.exports.supabaseAuth = supabaseAuth;
module.exports.listTags = listTags;
module.exports.SERVED_STATES = SERVED_STATES;
module.exports.UNSERVED_STATES = UNSERVED_STATES;
module.exports.firstEmail = firstEmail;
module.exports.isUnservedListLead = isUnservedListLead;
module.exports.firstNameFor = firstNameFor;
module.exports.errorCode = errorCode;
module.exports.InsertError = InsertError;
module.exports.TEMPLATE_DIR = TEMPLATE_DIR;
