/* The whole handler, with the mail transport and Supabase faked (brief 07).
   Proves: the notification and the leads insert are unchanged and in today's
   order; off production every email goes only to TEST_RECIPIENT (and nothing
   goes if it is unset) and no row reaches the production CRM; a forced insert
   failure, first-email failure and notification failure each log a code and a
   request ID and never the test name, email or phone; the page stamp is
   required; the per-IP cap holds. No credentials, no network.

     npm run test:handler
*/
"use strict";

const path = require("path");

// ---- fakes: nodemailer and fetch --------------------------------------------
let sent = [];
let failSend = null;              // (msg, index) => Error | null
const nm = require.resolve("nodemailer");
require.cache[nm] = { id: nm, filename: nm, loaded: true, exports: {
  createTransport: () => ({ sendMail: async (m) => {
    const e = failSend && failSend(m, sent.length);
    if (e) throw e;
    sent.push(m);
  } }),
} };
let inserts = [];
let insertReply = { status: 201, body: "" };
global.fetch = async (url, opts) => {
  inserts.push({ url, body: JSON.parse(opts.body) });
  return { ok: insertReply.status < 300, status: insertReply.status, text: async () => insertReply.body };
};

// ---- env --------------------------------------------------------------------
Object.assign(process.env, {
  GMAIL_USER: "nickz@thermaldawn.com", GMAIL_APP_PASSWORD: "not-a-real-password",
  SUPABASE_URL: "https://skyequfcoejlhzbyipwt.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "not-a-real-key",
});
delete process.env.TEST_RECIPIENT;
delete process.env.AUTORESPONDER_FROM;

const lead = require(path.join(__dirname, "..", "api", "lead.js"));

let failed = 0;
const check = (label, cond, got) => {
  if (cond) console.log(`ok    ${label}`);
  else { console.error(`FAIL  ${label}${got !== undefined ? ": " + JSON.stringify(got) : ""}`); failed++; }
};

// Identifiable test values: none of these may ever appear in a log line.
const NAME = "Zephyrine", LAST = "Quixotically", EMAIL = "zephyrine.q@example.com", PHONE = "0400000009";
let ipSeq = 0;
function call(body, ip) {
  const req = { method: "POST", body: Object.assign({ ts: Date.now() - 10000 }, body),
                headers: { "x-forwarded-for": ip || `203.0.113.${++ipSeq % 250}` } };
  const res = { code: 0, json: null, headers: {},
    status(c) { this.code = c; return this; }, json(j) { this.json = j; return this; },
    setHeader(k, v) { this.headers[k] = v; } };
  return lead(req, res).then(() => res);
}
let logs = [];
const realErr = console.error, realLog = console.log, realWarn = console.warn;
function capture() { logs = []; console.error = console.warn = (...a) => logs.push(a.join(" ")); }
function release() { console.error = realErr; console.warn = realWarn; console.log = realLog; }
const piiIn = (lines) => lines.filter((l) => [NAME, LAST, EMAIL, PHONE, "203.0.113."].some((v) => l.includes(v)));

const RI = { form: "register-interest", first_name: NAME, last_name: LAST, email: EMAIL, phone: PHONE,
  suburb: "Testville", state: "VIC", heating: "Gas ducted", solar: "No", battery: "No",
  drivers: ["Bills are too high"], timeline: ["Now"], optin: "true" };

(async () => {
  // ---- 1. production: unchanged notification and insert, today's order ----
  process.env.VERCEL_ENV = "production";
  sent = []; inserts = []; failSend = null; insertReply = { status: 201, body: "" };
  const order = [];
  global.fetch = (orig => async (u, o) => { order.push("insert"); return orig(u, o); })(global.fetch);
  failSend = (m) => { order.push(m.to === "nickz@thermaldawn.com" ? "notification" : "first_email"); return null; };
  capture(); let r = await call(RI); release();
  check("production: 200", r.code === 200, r.code);
  check("production: notification, then insert, then first email", order.join(",") === "notification,insert,first_email", order);
  const note = sent[0];
  const expected = lead.parseSubmission(RI).data;
  check("notification: to Nick, Reply-To the lead", note.to === "nickz@thermaldawn.com" && note.replyTo === EMAIL);
  check("notification: From unchanged", note.from === '"Thermal Dawn Website" <nickz@thermaldawn.com>', note.from);
  check("notification: subject unchanged", note.subject === lead.formatSubject(expected), note.subject);
  const strip = (t) => t.replace(/Submission Time: .*/, "");
  check("notification: body unchanged (bar the timestamp)", strip(note.text) === strip(lead.formatNotification(expected)));
  check("insert: one row, same shape as leadRow()", inserts.length === 1 &&
    JSON.stringify(Object.keys(inserts[0].body)) === JSON.stringify(Object.keys(lead.leadRow(expected))));
  check("first email: to the lead, Reply-To Nick", sent[1].to === EMAIL && sent[1].replyTo === "nickz@thermaldawn.com");
  check("first email: From 'Nick at Thermal Dawn'", sent[1].from === '"Nick at Thermal Dawn" <nickz@thermaldawn.com>', sent[1].from);
  check("first email: the §1 template", /let's talk about your heating/.test(sent[1].subject));
  process.env.AUTORESPONDER_FROM = '"Nick at Thermal Dawn" <noreply@thermaldawn.com>';
  sent = []; failSend = null; await call(RI);
  check("AUTORESPONDER_FROM switches the From in one env change", sent[1].from === process.env.AUTORESPONDER_FROM, sent[1].from);
  delete process.env.AUTORESPONDER_FROM;

  // deposits: notification and insert, no first email
  sent = []; inserts = []; failSend = null;
  r = await call({ form: "founder-premium", first_name: NAME, last_name: LAST, email: EMAIL, phone: PHONE,
    address: "1 Test Rd", heating: "Gas ducted", timeline: "Now", terms: "true" });
  check("deposit: notification + insert, no first email", sent.length === 1 && inserts.length === 1 && /^td-/.test(r.json.ref || ""));

  // ---- 2. preview: only TEST_RECIPIENT, no production row ---------------
  process.env.VERCEL_ENV = "preview";
  sent = []; inserts = []; failSend = null;
  capture(); r = await call(RI); release();
  check("preview, TEST_RECIPIENT unset: nothing sent", sent.length === 0, sent.map((m) => m.to));
  check("preview, TEST_RECIPIENT unset: still 200", r.code === 200);
  check("preview: no insert into the production CRM", inserts.length === 0);
  check("preview: logs say why, by code", logs.some((l) => /notification_skipped code=test_recipient_unset/.test(l)) &&
    logs.some((l) => /insert_skipped code=non_production/.test(l)), logs);
  process.env.TEST_RECIPIENT = "nickz+b07@thermaldawn.com";
  sent = []; inserts = [];
  await call(RI);
  check("preview: every email goes to TEST_RECIPIENT only", sent.length === 2 && sent.every((m) => m.to === "nickz+b07@thermaldawn.com"), sent.map((m) => m.to));
  process.env.SUPABASE_URL = "https://staging-not-crm.supabase.co";
  inserts = []; await call(RI);
  check("preview with non-production Supabase values: the insert runs", inserts.length === 1);
  process.env.SUPABASE_URL = "https://skyequfcoejlhzbyipwt.supabase.co";
  delete process.env.VERCEL_ENV;
  sent = []; inserts = []; await call(RI);
  check("local run (no VERCEL_ENV) is treated as non-production", sent.every((m) => m.to === "nickz+b07@thermaldawn.com") && inserts.length === 0);
  delete process.env.TEST_RECIPIENT;

  // ---- 3. failures log a code and a request ID, never PII ---------------
  process.env.VERCEL_ENV = "production";
  insertReply = { status: 409, body: JSON.stringify({ code: "23505", message: `duplicate key`, details: `Key (email)=(${EMAIL}) already exists.`, hint: null }) };
  failSend = (m) => (m.to === EMAIL ? Object.assign(new Error(`Can't send mail - all recipients were rejected: 550 5.1.1 <${EMAIL}>: user unknown`), { responseCode: 550, code: "EENVELOPE" }) : null);
  sent = [];
  capture(); r = await call(RI); release();
  check("insert + first-email failure: request still 200", r.code === 200);
  check("insert failure logs its code", logs.some((l) => /insert_failed code=http_409_23505/.test(l)), logs);
  check("first-email failure logs its SMTP code", logs.some((l) => /first_email_failed code=smtp_550/.test(l)), logs);
  check("each line has a request ID and the form key", logs.length > 0 && logs.every((l) => /req=[0-9a-f]{8} form=register-interest /.test(l)), logs);
  check("no log line carries the name, email, phone or IP", piiIn(logs).length === 0, piiIn(logs));

  insertReply = { status: 201, body: "" };
  failSend = (m) => (m.to === "nickz@thermaldawn.com" ? Object.assign(new Error(`Message failed: 553 sender <${EMAIL}> rejected`), { responseCode: 553 }) : null);
  capture(); r = await call(RI); release();
  check("notification failure: 500, generic message", r.code === 500 && !JSON.stringify(r.json).includes(EMAIL));
  check("notification failure logs its code", logs.some((l) => /notification_failed code=smtp_553/.test(l)), logs);
  check("notification failure: no PII in logs", piiIn(logs).length === 0, piiIn(logs));

  const saved = process.env.GMAIL_APP_PASSWORD; delete process.env.GMAIL_APP_PASSWORD; failSend = null;
  capture(); r = await call(RI); release();
  check("missing SMTP env: logged as a code", logs.some((l) => /notification_failed code=smtp_env_missing/.test(l)), logs);
  check("missing SMTP env: no secret name or value dumped", !logs.some((l) => /GMAIL_|not-a-real/.test(l)), logs);
  process.env.GMAIL_APP_PASSWORD = saved;

  // a template that fails to load: the request still succeeds, logged by code
  const fs = require("fs"), realRead = fs.readFileSync;
  fs.readFileSync = function (f, ...rest) {
    if (String(f).includes("_first-emails") && String(f).includes("contact")) throw Object.assign(new Error("ENOENT"), { code: "ENOENT" });
    return realRead.call(this, f, ...rest);
  };
  sent = []; failSend = null;
  capture(); r = await call({ form: "contact", name: NAME, email: EMAIL, message: "hello" }); release();
  fs.readFileSync = realRead;
  check("template unavailable: still 200, notification sent", r.code === 200 && sent.length === 1 && sent[0].to === "nickz@thermaldawn.com", [r.code, sent.length]);
  check("template unavailable: logged by code, no PII", logs.some((l) => /first_email_failed code=template_unavailable/.test(l)) && piiIn(logs).length === 0, logs);

  // ---- 4. abuse screens -----------------------------------------------------
  sent = []; inserts = [];
  const noTs = { method: "POST", body: Object.assign({}, RI), headers: { "x-forwarded-for": "198.51.100.1" } };
  const res4 = { code: 0, status(c) { this.code = c; return this; }, json() { return this; }, setHeader() {} };
  capture(); await lead(noTs, res4); release();
  check("no page stamp: screened (200, nothing sent, nothing inserted)", res4.code === 200 && sent.length === 0 && inserts.length === 0);
  capture(); r = await call(Object.assign({}, RI, { website: "http://spam.example" })); release();
  check("honeypot filled: screened", r.code === 200 && sent.length === 0);
  capture(); r = await call(Object.assign({}, RI, { ts: Date.now() })); release();
  check("stamp under 3 s: screened", r.code === 200 && sent.length === 0);
  const codes = [];
  capture();
  for (let i = 0; i < 12; i++) codes.push((await call(RI, "192.0.2.77")).code);
  release();
  check("per-IP cap: the 11th and 12th in the window are refused (429)", codes.slice(0, 10).every((c) => c === 200) && codes[10] === 429 && codes[11] === 429, codes);
  check("the cap never logs the IP", !logs.some((l) => l.includes("192.0.2.77")), logs.filter((l) => l.includes("192.0.2")));

  // ---- 5. the intake: a repeat of the same send is not sent twice (Sales review, 1) ----
  process.env.VERCEL_ENV = "preview"; process.env.TEST_RECIPIENT = "test-inbox@example.com";
  const IN = { form: "intake", first_name: NAME, last_name: LAST, email: EMAIL, postcode: "3122", state: "VIC",
    heating: ["boiler_radiators"], outcome: "completed", lead_id: "il-0123456789" };
  sent = []; failSend = null;
  capture(); const i1 = await call(IN); const i2 = await call(IN); release();
  check("intake: two taps, one notification (both answered 200)", i1.code === 200 && i2.code === 200 && sent.length === 1, [i1.code, i2.code, sent.length]);
  check("intake: the repeat is logged by code, no PII", logs.some((l) => /screened code=repeat_send/.test(l)) && piiIn(logs).length === 0, logs);
  check("intake: the notification carries the page's lead ID", /il-0123456789/.test(sent[0].subject), sent[0] && sent[0].subject);
  sent = [];
  capture(); await call(Object.assign({}, IN, { lead_id: "il-aaaaaaaaaa", outcome: "urgent_call" }));
  await call(Object.assign({}, IN, { lead_id: "il-aaaaaaaaaa", outcome: "completed" })); release();
  check("intake: urgent first, then its details: both sent", sent.length === 2, sent.length);
  sent = []; failSend = (m, i) => (i === 0 && !failSend.done ? (failSend.done = true, new Error("smtp down")) : null);
  capture(); const f1 = await call(Object.assign({}, IN, { lead_id: "il-bbbbbbbbbb" }));
  const f2 = await call(Object.assign({}, IN, { lead_id: "il-bbbbbbbbbb" })); release();
  check("intake: a failed send can be retried with the same lead ID", f1.code === 500 && f2.code === 200 && sent.length === 1, [f1.code, f2.code, sent.length]);
  failSend = null;
  sent = [];
  capture(); await call(Object.assign({}, IN, { lead_id: "not-an-id" })); await call(Object.assign({}, IN, { lead_id: "not-an-id" })); release();
  check("intake: a malformed lead ID is replaced, never trusted", sent.length === 2 && !/not-an-id/.test(sent[0].subject), sent.map((m) => m.subject));

  console.log(failed ? `\n${failed} CHECK(S) FAILED` : "\nAll handler checks passed.");
  process.exit(failed ? 1 : 0);
})().catch((e) => { release(); console.error("FAIL  harness crashed:", e && e.stack); process.exit(1); });
