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
let hold = null;                  // a promise every sendMail waits on (concurrency tests)
const nm = require.resolve("nodemailer");
require.cache[nm] = { id: nm, filename: nm, loaded: true, exports: {
  createTransport: () => ({ sendMail: async (m) => {
    if (hold) await hold;
    const e = failSend && failSend(m, sent.length);
    if (e) throw e;
    sent.push(m);
  } }),
} };
let inserts = [];
let insertReply = { status: 201, body: "" };
const pgSeen = new Set();        // the unique index on (intake_lead_id, intake_event)
let pgOdd = null;                // a raw reply body to return instead (D6-S2 cases)
global.fetch = async (url, opts) => {
  const body = JSON.parse(opts.body);
  inserts.push({ url, body, prefer: opts.headers && opts.headers.Prefer });
  if (/on_conflict=intake_lead_id,intake_event/.test(url) && insertReply.status < 300) {
    if (pgOdd !== null) { const t = pgOdd; return { ok: true, status: 201, text: async () => t }; }
    const k = body.intake_lead_id + "|" + body.intake_event, fresh = !pgSeen.has(k);
    pgSeen.add(k);
    return { ok: true, status: 201, text: async () => JSON.stringify(fresh ? [{ intake_lead_id: body.intake_lead_id }] : []) };
  }
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
  check("preview with any other Supabase URL (a proxy, an alias): still no insert (B07-N2)", inserts.length === 0, inserts.length);
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
  // The intake now sends the customer a first email too (CTO Re #30), so these
  // count the notifications to Nick; the customer email is checked on its own.
  const notes = () => sent.filter((m) => /^(Re: )?(Website lead|URGENT) · /.test(m.subject));
  const firsts = () => sent.filter((m) => !/^(Re: )?(Website lead|URGENT) · /.test(m.subject));
  const IN = { form: "intake", first_name: NAME, last_name: LAST, email: EMAIL, phone: PHONE, postcode: "3122", state: "VIC",
    heating: ["boiler_radiators"], outcome: "completed", lead_id: "il-0123456789" };
  sent = []; failSend = null;
  capture(); const i1 = await call(IN); const i2 = await call(IN); release();
  check("intake: two taps, one notification (both answered 200)", i1.code === 200 && i2.code === 200 && notes().length === 1, [i1.code, i2.code, notes().length]);
  check("intake: the repeat is logged by code, no PII", logs.some((l) => /screened code=repeat_send/.test(l)) && piiIn(logs).length === 0, logs);
  check("intake: the notification carries the page's lead ID", /il-0123456789/.test(sent[0].subject), sent[0] && sent[0].subject);
  sent = [];
  capture(); await call(Object.assign({}, IN, { lead_id: "il-aaaaaaaaaa", outcome: "urgent_call" }));
  await call(Object.assign({}, IN, { lead_id: "il-aaaaaaaaaa", outcome: "completed", followup: true })); release();
  check("intake: urgent first, then its details: both notifications sent", notes().length === 2, notes().length);
  check("intake: but only one customer email (the details are a follow-up)", firsts().length === 1, firsts().map((m) => m.subject));
  // CTO item 70.1: Nick's notifications for one lead thread in Gmail; the customer still gets one email
  const [n1, n2] = notes();
  check("thread: the first notification's Message-ID comes from the lead ID", n1 && n1.messageId === "<intake-il-aaaaaaaaaa@thermaldawn.com>" && !n1.inReplyTo, n1 && [n1.messageId, n1.inReplyTo]);
  check("thread: the follow-up replies to it, with the same subject and Re:", n2 && n2.inReplyTo === n1.messageId && n2.references === n1.messageId && !n2.messageId && n2.subject === "Re: " + n1.subject, n2 && [n2.inReplyTo, n2.subject]);
  check("thread: the customer's email carries none of the thread headers", firsts().every((m) => !m.messageId && !m.inReplyTo && !m.references));
  check("thread: stable for a lead ID, and only for intake", lead.notificationThread({ form: "intake", lead_id: "il-aaaaaaaaaa" }).messageId === n1.messageId && lead.notificationThread({ form: "contact", lead_id: "il-aaaaaaaaaa" }) === null && lead.notificationThread({ form: "intake", lead_id: "x" }) === null);
  sent = []; failSend = (m, i) => (i === 0 && !failSend.done ? (failSend.done = true, new Error("smtp down")) : null);
  capture(); const f1 = await call(Object.assign({}, IN, { lead_id: "il-bbbbbbbbbb" }));
  const f2 = await call(Object.assign({}, IN, { lead_id: "il-bbbbbbbbbb" })); release();
  check("intake: a failed send can be retried with the same lead ID", f1.code === 500 && f2.code === 200 && notes().length === 1, [f1.code, f2.code, notes().length]);
  failSend = null;
  sent = [];
  capture(); await call(Object.assign({}, IN, { lead_id: "not-an-id" })); await call(Object.assign({}, IN, { lead_id: "not-an-id" })); release();
  check("intake: a malformed lead ID is replaced, never trusted", notes().length === 2 && !/not-an-id/.test(notes()[0].subject), notes().map((m) => m.subject));

  // ---- 5b. stage 1: in-flight dedupe, the sent contract, no-JS errors, the row ----
  const json = (r) => r.json || {};
  sent = []; failSend = null;
  let open; hold = new Promise((r) => { open = r; });
  capture();
  const pa = call(Object.assign({}, IN, { lead_id: "il-cccccccccc" })), pb = call(Object.assign({}, IN, { lead_id: "il-cccccccccc" }));
  await new Promise((r) => setTimeout(r, 20)); open(); hold = null;
  const [ra, rb] = await Promise.all([pa, pb]); release();
  check("I-S2: concurrent repeat waits for the first send: one email, both sent:true",
    notes().length === 1 && json(ra).sent === true && json(rb).sent === true, [notes().length, json(ra), json(rb)]);
  check("I-S2: the waiting repeat is logged as in flight", logs.some((l) => /screened code=repeat_in_flight/.test(l)), logs);
  sent = []; hold = new Promise((r) => { open = r; });
  failSend = (m, i) => (i === 0 ? new Error("smtp down") : null);
  capture();
  const fa = call(Object.assign({}, IN, { lead_id: "il-dddddddddd" })), fb = call(Object.assign({}, IN, { lead_id: "il-dddddddddd" }));
  await new Promise((r) => setTimeout(r, 20)); open(); hold = null;
  const [ra2, rb2] = await Promise.all([fa, fb]);
  failSend = null;
  const rc2 = await call(Object.assign({}, IN, { lead_id: "il-dddddddddd" })); release();
  check("I-S2: if the first send fails, the waiting repeat fails too (no false success)", ra2.code === 500 && rb2.code === 500, [ra2.code, rb2.code]);
  check("I-S2: and a later retry sends", rc2.code === 200 && json(rc2).sent === true && notes().length === 1, [rc2.code, notes().length]);
  capture(); const bot = await call(Object.assign({}, IN, { lead_id: "il-eeeeeeeeee", ts: Date.now() })); release();
  check("I-S3: a bot-screened post gets { ok: true } with no sent flag", bot.code === 200 && json(bot).ok === true && json(bot).sent === undefined, json(bot));
  delete process.env.TEST_RECIPIENT; sent = [];
  capture(); const unset = await call(Object.assign({}, IN, { lead_id: "il-ffffffffff" })); release();
  check("I-S3: nothing sent (no TEST_RECIPIENT) says sent:false", unset.code === 200 && json(unset).sent === false && notes().length === 0, json(unset));
  process.env.TEST_RECIPIENT = "test-inbox@example.com";
  capture(); const noPhone = await call(Object.assign({}, IN, { lead_id: "il-1212121212", phone: "" })); release();
  check("I-S1: a served lead with no phone and no email choice is refused (400)", noPhone.code === 400, noPhone.code);
  const nojsReq = { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded", "x-forwarded-for": "203.0.113.201" },
    body: Object.assign({}, IN, { nojs: "1", phone: "" }) };
  const nojsRes = { code: 0, headers: {}, status(c) { this.code = c; return this; }, json() { return this; }, end() { return this; }, setHeader(k, v) { this.headers[k] = v; } };
  capture(); await lead(nojsReq, nojsRes); release();
  check("I-S1: the long form gets its own page for that (303 to /start/check/)", nojsRes.code === 303 && nojsRes.headers.Location === "/start/check/", [nojsRes.code, nojsRes.headers]);
  // The row, in production with fakes: off by default, then on.
  process.env.VERCEL_ENV = "production"; inserts = []; sent = [];
  capture(); await call(Object.assign({}, IN, { lead_id: "il-3434343434", intent: "urgent", tenure: "owner_occupier" })); release();
  const row1 = inserts[0] && inserts[0].body;
  check("leads row: the intake is recorded, existing columns only while the flag is off",
    row1 && row1.form === "Website Intake" && row1.email === EMAIL && !("lead_id" in row1) && !("answers" in row1), row1);
  process.env.INTAKE_LEAD_COLUMNS = "on"; inserts = [];
  capture(); await call(Object.assign({}, IN, { lead_id: "il-5656565656", intent: "urgent", tenure: "owner_occupier" })); release();
  const row2 = inserts[0] && inserts[0].body;
  check("leads row: with INTAKE_LEAD_COLUMNS=on, the §3.1 columns too",
    row2 && row2.intake_lead_id === "il-5656565656" && row2.intake_event === "complete" && row2.rung_reached === 4 && !("lead_id" in row2) && row2.intent === "urgent" && row2.route === "urgent" && row2.tenure === null &&
    typeof row2.answers === "object" && row2.answers.heating && /^\d{4}-/.test(row2.ts_started) && /^\d{4}-/.test(row2.ts_last), row2);
  check("leads row: an intake row with its columns is inserted once per (intake_lead_id, intake_event)", inserts[0] && /\?on_conflict=intake_lead_id,intake_event&select=intake_lead_id$/.test(inserts[0].url) && inserts[0].prefer === "return=representation,resolution=ignore-duplicates", inserts[0] && inserts[0].url);
  // Same-row path (CTO items 69, 82): the first row stores only the token's hash; a follow-up
  // updates that row through update_intake_details, and falls back to the details insert.
  {
    const TOK = "ab".repeat(32), realFetch = global.fetch; let rpc = [], rpcReply = "true";
    global.fetch = async (u, o) => { if (/\/rpc\/update_intake_details$/.test(u)) { rpc.push(JSON.parse(o.body)); return { ok: rpcReply !== "error", status: rpcReply === "error" ? 404 : 200, text: async () => rpcReply }; } return realFetch(u, o); };
    inserts = []; sent = [];
    capture(); await call(Object.assign({}, IN, { lead_id: "il-5a5a5a5a5a", outcome: "matched", resume_token: TOK })); release();
    const first = inserts[0] && inserts[0].body;
    check("same-row: the first row stores the token's SHA-256, never the token", first && first.intake_resume_hash === require("crypto").createHash("sha256").update(TOK).digest("hex") && !JSON.stringify(first).includes(TOK), first && first.intake_resume_hash);
    inserts = []; rpc = []; sent = [];
    capture(); await call(Object.assign({}, IN, { lead_id: "il-5a5a5a5a5a", outcome: "book_chat", followup: true, exit: "chat", resume_token: TOK })); release();
    check("same-row: a follow-up updates the row (no details insert) and still notifies Nick", rpc.length === 1 && rpc[0].p_lead_id === "il-5a5a5a5a5a" && rpc[0].p_token === TOK && rpc[0].p_details.exit === "chat" && inserts.length === 0 && sent.length === 1, [rpc.length, inserts.length, sent.length]);
    check("same-row: the update is logged by code only", logs.some((l) => /row_updated code=same_row/.test(l)) && !logs.some((l) => l.includes(TOK)), logs);
    for (const reply of ["false", "error"]) {
      inserts = []; rpc = []; rpcReply = reply;
      capture(); await call(Object.assign({}, IN, { lead_id: reply === "false" ? "il-6b6b6b6b6b" : "il-6c6c6c6c6c", outcome: "completed", followup: true, resume_token: TOK })); release();
      check("same-row: if the update can't be confirmed (" + reply + "), the details row is inserted as before", rpc.length === 1 && inserts.length === 1 && inserts[0].body.intake_event === "details", [rpc.length, inserts.length]);
    }
    rpcReply = "true"; inserts = []; rpc = [];
    capture(); await call(Object.assign({}, IN, { lead_id: "il-7c7c7c7c70", outcome: "completed", followup: true, resume_token: "not-a-token" })); release();
    check("same-row: a malformed token never reaches the function", rpc.length === 0 && inserts.length === 1, [rpc.length, inserts.length]);
    global.fetch = realFetch;
  }
  // Migration rev 2 (e7bf423): the values its checks accept.
  inserts = []; capture(); await call(Object.assign({}, IN, { lead_id: "il-7878787878", outcome: "urgent_call" }));
  await call(Object.assign({}, IN, { lead_id: "il-7878787878", outcome: "completed", followup: true })); release();
  const evs = inserts.map((x) => x.body.intake_event);
  check("leads row: urgent then details are two events, complete then details", JSON.stringify(evs) === JSON.stringify(["complete", "details"]), evs);
  check("leads row: every value fits rev 2's checks (il- + 10 hex, event set, rung 1-4, answers an object)", inserts.length === 2 && inserts.every((x) =>
    /^il-[0-9a-f]{10}$/.test(x.body.intake_lead_id) && ["partial", "complete", "details"].indexOf(x.body.intake_event) !== -1 &&
    (x.body.rung_reached === null || (Number.isInteger(x.body.rung_reached) && x.body.rung_reached >= 1 && x.body.rung_reached <= 4)) &&
    x.body.answers && typeof x.body.answers === "object" && !Array.isArray(x.body.answers)), inserts.map((x) => x.body));
  // ---- S1-2: one customer email per lead, whatever the page sends ----
  // Production, columns on: the database's answer decides.
  sent = []; inserts = []; capture();
  await call(Object.assign({}, IN, { lead_id: "il-9a9a9a9a9a", outcome: "urgent_call" }));
  await call(Object.assign({}, IN, { lead_id: "il-9a9a9a9a9a", outcome: "keep_posted" }));   // no followup flag
  release();
  check("S1-2 production: a different outcome, no followup flag: second notification, no second customer email",
    notes().length === 2 && firsts().length === 1, [notes().length, firsts().map((m) => m.subject)]);
  check("S1-2 production: the duplicate is logged by code", logs.some((l) => /insert_skipped code=duplicate_event/.test(l)), logs);
  // D6-S1: production fails closed. The insert fails: notifications, no customer email.
  sent = []; insertReply = { status: 503, body: "" }; capture();
  await call(Object.assign({}, IN, { lead_id: "il-8b8b8b8b8b", outcome: "urgent_call" }));
  await call(Object.assign({}, IN, { lead_id: "il-8b8b8b8b8b", outcome: "keep_posted" }));
  release(); insertReply = { status: 201, body: "" };
  check("D6-S1 production, insert failing: both notifications, no customer email", notes().length === 2 && firsts().length === 0, [notes().length, firsts().length]);
  // ...then the database recovers: the first row that lands sends the one email, and no more.
  sent = []; capture();
  await call(Object.assign({}, IN, { lead_id: "il-8b8b8b8b8b", outcome: "completed" }));
  await call(Object.assign({}, IN, { lead_id: "il-8b8b8b8b8b", outcome: "book_chat" }));
  release();
  check("D6-S1 after recovery: one customer email from the first row that lands, and no second", notes().length === 2 && firsts().length === 1, [notes().length, firsts().length]);
  // Columns off in production: not configured, so no customer email either.
  delete process.env.INTAKE_LEAD_COLUMNS; sent = []; capture();
  await call(Object.assign({}, IN, { lead_id: "il-6d6d6d6d6d", outcome: "completed" })); release();
  check("D6-S1 production, INTAKE_LEAD_COLUMNS off: notification, no customer email", notes().length === 1 && firsts().length === 0, [notes().length, firsts().length]);
  process.env.INTAKE_LEAD_COLUMNS = "on";
  // D6-S2: only exactly our one row is "new"; anything odd is unknown and sends nothing.
  const odd = [["malformed JSON", "[{"], ["null", "null"], ["an object", JSON.stringify({ intake_lead_id: "il-5e5e5e5e5e" })],
               ["a mismatched id", JSON.stringify([{ intake_lead_id: "il-0000000000" }])], ["two rows", JSON.stringify([{ intake_lead_id: "il-5e5e5e5e5e" }, { intake_lead_id: "il-5e5e5e5e5e" }])],
               ["a row without the id", "[{}]"]];
  for (const [n, [what, reply]] of odd.entries()) {
    sent = []; pgOdd = reply; capture();
    await call(Object.assign({}, IN, { lead_id: "il-5e5e5e5e5" + n, outcome: "completed" })); release(); pgOdd = null;
    check(`D6-S2 a reply of ${what}: notification, no customer email, logged as unconfirmed`,
      notes().length === 1 && firsts().length === 0 && logs.some((l) => /insert_unconfirmed code=unexpected_reply/.test(l)), [notes().length, firsts().length]);
  }
  delete process.env.INTAKE_LEAD_COLUMNS; process.env.VERCEL_ENV = "preview";
  // Off production (no insert): the per-lead claim, keyed per lead, not per outcome.
  sent = []; capture();
  await call(Object.assign({}, IN, { lead_id: "il-7c7c7c7c7c", outcome: "book_chat" }));
  await call(Object.assign({}, IN, { lead_id: "il-7c7c7c7c7c", outcome: "completed" }));       // no followup flag
  release();
  check("S1-2 off production: a different outcome, no followup flag: no second customer email", notes().length === 2 && firsts().length === 1, [notes().length, firsts().length]);
  process.env.VERCEL_ENV = "production"; process.env.INTAKE_LEAD_COLUMNS = "on";

  inserts = []; capture(); await call(RI); release();
  check("leads row: the old forms' rows never carry the intake columns", inserts[0] && !("intake_lead_id" in inserts[0].body) && !("answers" in inserts[0].body) && !/on_conflict/.test(inserts[0].url), inserts[0] && Object.keys(inserts[0].body));
  delete process.env.INTAKE_LEAD_COLUMNS; process.env.VERCEL_ENV = "preview";

  sent=[]; capture(); await call(RI); release();
  check("customer transport carries HTML and plain signatures", sent[1] && /Best regards,/.test(sent[1].text) && /<strong>Nick Zeniou<\/strong>/.test(sent[1].html));
  check("internal notification remains plain text only", sent[0] && !sent[0].html && !/Best regards,/.test(sent[0].text));
  // v2 clamps free text before composing the real handler notification.
  sent=[];capture();await call(Object.assign({},IN,{lead_id:"il-abc123abcd",heating_notes:"x".repeat(2100),tenure:"renter"}));release();
  check("v2 handler clamps heating notes and preserves retired tenure label", notes().length===1 && /Heating notes: x{2000}\n/.test(notes()[0].text) && /Is it your home: -/.test(notes()[0].text));
  sent=[];capture();await call(Object.assign({},IN,{lead_id:"il-bcd123abcd",heating_notes:"Hello\nBoiler condition: Forged\nEmail: fake@example.com"}));release();
  check("v2 handler quotes heating notes continuation, no forged contact label", notes().length===1 && /Heating notes: Hello\n> Boiler condition: Forged\n> Email: fake@example.com/.test(notes()[0].text) && (notes()[0].text.match(/^Email: /gm)||[]).length===1);
  // ---- 6. P-S1: nothing but logEvent writes to the logs (codes, never messages) ----
  const fs2 = require("fs");
  const src = ["lead.js", "_intake.js"].map((f) => path.join(__dirname, "..", "api", f))
    .filter((f) => fs2.existsSync(f)).map((f) => fs2.readFileSync(f, "utf8")).join("\n");
  const writes = src.match(/console\.(log|error|warn|info|debug)\(/g) || [];
  check("P-S1: the only log write in the lead path is logEvent's one line", writes.length === 1 && /function logEvent[\s\S]{0,200}console\.error\(`lead req=/.test(src), writes);
  check("P-S1: no error message is ever logged", !/console\.\w+\([^)]*\.message/.test(src));

  console.log(failed ? `\n${failed} CHECK(S) FAILED` : "\nAll handler checks passed.");
  process.exit(failed ? 1 : 0);
})().catch((e) => { release(); console.error("FAIL  harness crashed:", e && e.stack); process.exit(1); });
