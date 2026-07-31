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

const TZ = "Australia/Sydney";
const NOTIFY_TO = "nickz@thermaldawn.com";
const CALENDLY = "https://calendly.com/nickz-thermaldawn/30min";

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
};

/** Normalise the raw body into a known shape; returns {data} or {error}. */
function parseSubmission(body) {
  const form = String(body && body.form ? body.form : "").trim();
  const spec = FORMS[form];
  if (!spec) return { error: "Unknown form" };

  const data = { form, formLabel: spec.label };

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
      timeline: asList(body.timeline),
      comments: asText(body.comments, 5000),
    });
  } else if (form === "contact") {
    Object.assign(data, {
      name: asText(body.name, 200),
      email: asText(body.email, 200),
      message: asText(body.message, 5000),
    });
  } else {
    Object.assign(data, {
      email: asText(body.email, 200),
      optin: body.optin === true || body.optin === "true" || body.optin === "on",
    });
  }

  for (const key of spec.required) {
    if (!data[key]) return { error: "Missing required field: " + key };
  }
  for (const key of spec.requiredLists) {
    if (!data[key] || !data[key].length) return { error: "Missing required field: " + key };
  }
  if (!isEmail(data.email)) return { error: "Invalid email address" };

  return { data };
}

/* ---------- email bodies (the contract) ---------- */

function formatNotification(d, stamp) {
  const when = stamp || formatTimestamp();

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
  if (d.form === "register-interest") {
    return stripHeader(
      `New website lead: ${d.first_name} ${d.last_name} · ${d.heating} · ${d.email}`
    );
  }
  if (d.form === "contact") {
    return stripHeader(`New website message: ${d.name} · ${d.email}`);
  }
  return stripHeader(`New subscriber: ${d.email}`);
}

/* Customer-facing. Voice rules apply: no em dashes, no sentence opening with
   "I", contractions, plain text. */
function formatAutoresponder(d) {
  return [
    `Hi ${d.first_name},`,
    "",
    "Thanks for getting in touch. Nick will be back to you within the next few days.",
    "",
    "Keen to talk sooner? Book a call at a time that suits you:",
    CALENDLY,
    "",
    "Or call Nick direct on +61 432 395 138.",
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
    throw new Error("GMAIL_USER / GMAIL_APP_PASSWORD are not set in the environment");
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

module.exports = async function handler(req, res) {
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

  // Bot screens. Both return a success shape so a bot learns nothing.
  const trapped =
    (typeof body.website === "string" && body.website.trim() !== "") ||
    (Number(body.ts) > 0 && Date.now() - Number(body.ts) < 3000);
  if (trapped) return res.status(200).json({ ok: true });

  const { data, error } = parseSubmission(body);
  if (error) return res.status(400).json({ ok: false, error });

  try {
    const transport = makeTransport();
    const from = `"Thermal Dawn Website" <${process.env.GMAIL_USER}>`;

    await transport.sendMail({
      from,
      to: NOTIFY_TO,
      replyTo: data.email,
      subject: formatSubject(data),
      text: formatNotification(data),
    });

    // Best effort. The notification above is the contract; a failed
    // autoresponder must not cost us the lead.
    if (data.form === "register-interest") {
      try {
        await transport.sendMail({
          from: `"Nick at Thermal Dawn" <${process.env.GMAIL_USER}>`,
          to: data.email,
          replyTo: NOTIFY_TO,
          subject: "Thanks For Getting in Touch",
          text: formatAutoresponder(data),
        });
      } catch (autoErr) {
        console.error("Autoresponder failed:", autoErr && autoErr.message);
      }
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    // Never echo submitted PII back to the client.
    console.error("Lead notification failed:", err && err.message);
    return res.status(500).json({ ok: false, error: "Could not send. Please email us directly." });
  }
};

/* Exported for the local format harness (scripts/test-email-format.js). */
module.exports.formatNotification = formatNotification;
module.exports.formatSubject = formatSubject;
module.exports.formatAutoresponder = formatAutoresponder;
module.exports.formatTimestamp = formatTimestamp;
module.exports.parseSubmission = parseSubmission;
