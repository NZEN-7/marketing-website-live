/* Intake stage 2 (HoE items 103 to 105): the session layer, end to end, with
   the sessions table mocked (the same five-function contract as _sessions.js),
   the mail transport faked and Supabase's leads insert faked. Proves:
     - the guards: off by default; a preview never touches the production CRM;
     - the resume link: signed, 30 days, tamper and expiry refused;
     - /api/intake-save/: nothing before step 1; first save fixes the token;
       another token is refused; bot trap, cap and beacon replies; no PII in logs;
     - /api/intake-sweep/: CRON_SECRET required; only sessions idle 30 minutes;
       Nick's notification is the thread's root; the partial row; the customer's
       one email with the resume link, in area only; a second run sends nothing;
       a failed notification gives the session back;
     - api/lead.js: the first send closes the session (never swept after), and a
       completion after a partial replies in the partial's thread;
     - /api/intake-resume/: answers back, token rotated, closed sessions refused.
   No credentials, no network.

     npm run test:sessions
*/
"use strict";

const path = require("path");
const api = (f) => path.join(__dirname, "..", "api", f);

// ---- fakes ------------------------------------------------------------------
let sent = [], failSend = null;
const nm = require.resolve("nodemailer");
require.cache[nm] = { id: nm, filename: nm, loaded: true, exports: {
  createTransport: () => ({ sendMail: async (m) => { const e = failSend && failSend(m); if (e) throw e; sent.push(m); } }),
} };
let inserts = [];
global.fetch = async (url, opts) => {
  const body = JSON.parse(opts.body);
  inserts.push({ url, body });
  if (/on_conflict=intake_lead_id,intake_event/.test(url)) return { ok: true, status: 201, text: async () => JSON.stringify([{ intake_lead_id: body.intake_lead_id }]) };
  return { ok: true, status: 201, text: async () => "" };
};

Object.assign(process.env, {
  GMAIL_USER: "nickz@thermaldawn.com", GMAIL_APP_PASSWORD: "not-a-real-password",
  SUPABASE_URL: "https://skyequfcoejlhzbyipwt.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "not-a-real-key",
  INTAKE_LEAD_COLUMNS: "on", INTAKE_TOKEN_SECRET: "test-secret-not-real-0123456789", CRON_SECRET: "cron-secret-not-real-0123",
});
delete process.env.TEST_RECIPIENT; delete process.env.VERCEL_ENV; delete process.env.INTAKE_SESSIONS;

const sessions = require(api("_sessions.js"));
const save = require(api("intake-save.js"));
const sweep = require(api("intake-sweep.js"));
const resume = require(api("intake-resume.js"));
const lead = require(api("lead.js"));

let failed = 0;
const check = (label, cond, got) => {
  if (cond) console.log(`ok    ${label}`);
  else { console.error(`FAIL  ${label}${got !== undefined ? ": " + JSON.stringify(got) : ""}`); failed++; }
};
const NAME = "Zephyrine", LAST = "Quixotically", EMAIL = "zephyrine.q@example.com", PHONE = "0400000009";
let ip = 0;
function call(handler, { method = "POST", body, headers = {} } = {}) {
  const req = { method, body, headers: Object.assign({ "x-forwarded-for": `198.51.100.${++ip % 250}` }, headers) };
  const res = { code: 0, json: null, headers: {}, ended: false,
    status(c) { this.code = c; return this; }, json(j) { this.json = j; return this; },
    end() { this.ended = true; return this; }, setHeader(k, v) { this.headers[k] = v; } };
  return handler(req, res).then(() => res);
}
let logs = [];
const realErr = console.error, realWarn = console.warn;
const capture = () => { logs = []; console.error = console.warn = (...a) => logs.push(a.join(" ")); };
const release = () => { console.error = realErr; console.warn = realWarn; };
const pii = () => logs.filter((l) => [NAME, LAST, EMAIL, PHONE, "198.51.100."].some((v) => l.includes(v)));

const hex = (n, c) => c.repeat(n);
const TOKEN_A = hex(64, "a"), TOKEN_B = hex(64, "b"), TOKEN_C = hex(64, "c");
const STEP1 = { first_name: NAME, last_name: LAST, email: EMAIL, phone: PHONE, postcode: "3122", suburb: "Hawthorn", contact_pref: "phone" };
const saveBody = (leadId, token, extra) => Object.assign({ lead_id: leadId, resume_token: token, ts: Date.now() - 60000, website: "",
  last_screen: "S7", rung_reached: "1", route: "icp", state: "VIC", answers: Object.assign({}, STEP1) }, extra || {});

(async () => {
  // ---- 1. guards --------------------------------------------------------------
  check("off by default: no INTAKE_SESSIONS, nothing is written", sessions.target({}).skip === "sessions_off");
  check("on but unconfigured: skipped", sessions.target({ INTAKE_SESSIONS: "on" }).skip === "not_configured");
  const cfg = { INTAKE_SESSIONS: "on", INTAKE_SESSIONS_KEY: "k", INTAKE_SESSIONS_APIKEY: "a" };
  check("a preview never writes to the production CRM",
    sessions.target(Object.assign({ INTAKE_SESSIONS_URL: "https://skyequfcoejlhzbyipwt.supabase.co" }, cfg)).skip === "non_production_guard");
  check("a preview may write to a non-production scope",
    !sessions.target(Object.assign({ INTAKE_SESSIONS_URL: "https://test-scope.supabase.co" }, cfg)).skip);
  check("production writes to the production CRM",
    !sessions.target(Object.assign({ VERCEL_ENV: "production", INTAKE_SESSIONS_URL: "https://skyequfcoejlhzbyipwt.supabase.co" }, cfg)).skip);

  // ---- 2. the resume link -----------------------------------------------------
  const link = sessions.signResume("il-0123456789");
  check("a signed link verifies to its lead", sessions.verifyResume(link) === "il-0123456789");
  check("a tampered link is refused", sessions.verifyResume(link.replace("il-0123456789", "il-9876543210")) === null);
  check("another secret refuses it", sessions.verifyResume(link, { INTAKE_TOKEN_SECRET: "another-secret-entirely-xyz" }) === null);
  check("it expires after 30 days", sessions.verifyResume(link, null, Date.now() + 31 * 86400000) === null);
  check("no secret, no link", sessions.signResume("il-0123456789", {}) === null);
  check("off production the link points at the preview",
    sessions.resumeUrl("t", { VERCEL_URL: "marketing-website-live-x.vercel.app" }) === "https://marketing-website-live-x.vercel.app/start/?resume=t");
  check("in production it points at the live site", sessions.resumeUrl("t", { VERCEL_ENV: "production" }) === "https://www.thermaldawn.com/start/?resume=t");

  // ---- 3. saves -------------------------------------------------------------------
  const mem = sessions.memoryStore();
  sessions.useStore(mem);
  capture();
  let r = await call(save, { body: saveBody("il-aaaaaaaaaa", TOKEN_A, { answers: { first_name: NAME } }) });
  check("before step 1 is done: not saved", r.json && r.json.saved === false && !mem.rows.has("il-aaaaaaaaaa"), r.json);
  r = await call(save, { body: saveBody("il-aaaaaaaaaa", TOKEN_A) });
  check("step 1 done: the first save makes the row", r.json.saved === true && mem.rows.get("il-aaaaaaaaaa").token_hash === sessions.hashToken(TOKEN_A));
  r = await call(save, { body: saveBody("il-aaaaaaaaaa", TOKEN_A, { last_screen: "S8", answers: Object.assign({ heating: ["boiler_radiators"] }, STEP1) }) });
  check("a later save merges the answers and moves last_screen",
    r.json.saved === true && mem.rows.get("il-aaaaaaaaaa").last_screen === "S8" && mem.rows.get("il-aaaaaaaaaa").answers.heating[0] === "boiler_radiators");
  r = await call(save, { body: saveBody("il-aaaaaaaaaa", TOKEN_B, { answers: Object.assign({}, STEP1, { email: "other@example.com" }) }) });
  check("another token can't overwrite the row", r.json.saved === false && mem.rows.get("il-aaaaaaaaaa").answers.email === EMAIL);
  r = await call(save, { body: saveBody("il-bbbbbbbbbb", TOKEN_B, { website: "bot" }) });
  check("the honeypot screens it", r.json.saved === false && !mem.rows.has("il-bbbbbbbbbb"));
  r = await call(save, { body: saveBody("il-bbbbbbbbbb", TOKEN_B, { ts: Date.now() - 500 }) });
  check("under 3 s from page load: screened", r.json.saved === false);
  r = await call(save, { body: JSON.stringify(saveBody("il-bbbbbbbbbb", TOKEN_B, { beacon: true })) });
  check("a beacon (text body) saves and gets a bare 204", r.code === 204 && r.ended && mem.rows.has("il-bbbbbbbbbb"));
  r = await call(save, { body: saveBody("il-cccccccccc", "not-a-token") });
  check("a malformed token is refused", r.json.saved === false);
  let capped = false;
  for (let i = 0; i < 95; i++) { const x = await call(save, { body: saveBody("il-dddddddddd", TOKEN_A), headers: { "x-forwarded-for": "198.51.100.250" } }); if (x.json && x.json.saved === false) capped = true; }
  check("the per-IP cap holds", capped);
  release();
  check("save logs carry no name, email, phone or IP", pii().length === 0, pii());

  // ---- 4. the sweep -----------------------------------------------------------
  r = await call(sweep, { method: "GET" });
  check("the sweep refuses a call without CRON_SECRET", r.code === 401);
  r = await call(sweep, { method: "GET", headers: { authorization: "Bearer wrong-secret-value-123456" } });
  check("…and a wrong one", r.code === 401);
  const AUTH = { authorization: "Bearer " + process.env.CRON_SECRET };

  // A clock we can move: sessions idle under 30 minutes are left alone.
  let clock = Date.now();
  sessions.memoryStore.clock = () => clock;
  const fresh = sessions.memoryStore(); sessions.useStore(fresh);
  await call(save, { body: saveBody("il-1111111111", TOKEN_A) });                                   // in area
  await call(save, { body: saveBody("il-2222222222", TOKEN_B, { postcode: "4000", state: "QLD",      // out of area
    answers: Object.assign({}, STEP1, { postcode: "4000", suburb: "Brisbane City" }) }) });
  sent = []; inserts = [];
  r = await call(sweep, { method: "GET", headers: AUTH });
  check("idle under 30 minutes: nothing is swept", r.json.swept === 0 && sent.length === 0, r.json);

  clock += 31 * 60000;
  process.env.VERCEL_ENV = "production";            // the partial row is written in production only
  capture();
  r = await call(sweep, { method: "GET", headers: AUTH });
  release();
  check("after 30 minutes both are claimed and sent", r.json.swept === 2 && r.json.sent === 2, r.json);
  const toNick = sent.filter((m) => m.to === "nickz@thermaldawn.com");
  check("Nick gets one notification each", toNick.length === 2);
  const n1 = toNick.find((m) => /il-1111111111/.test(m.subject));
  check("the partial notification is the thread's root (Message-ID from the lead ID)",
    n1 && n1.messageId === "<intake-il-1111111111@thermaldawn.com>" && !n1.inReplyTo && !/^Re:/.test(n1.subject));
  check("it says partial in the Ended on line, layout otherwise unchanged",
    n1 && /\nEnded on: partial \(screen S7\)\n/.test(n1.text) && /^Hi Thermal Dawn Team,/.test(n1.text));
  const rows = inserts.filter((i) => /\/rest\/v1\/leads/.test(i.url));
  check("each gets a leads row with event partial", rows.length === 2 && rows.every((x) => x.body.intake_event === "partial"), rows.map((x) => x.body.intake_event));
  const toCustomer = sent.filter((m) => m.to === EMAIL);
  check("the in-area customer gets one email; the out-of-area one gets none", toCustomer.length === 1);
  const pe = toCustomer[0] || {};
  check("…with Nick's line", /Thanks for putting down your details, we'll be in touch\./.test(pe.text || ""));
  const m = /https:\/\/www\.thermaldawn\.com\/start\/\?resume=([^\s]+)/.exec(pe.text || "");
  check("…and a working resume link", m && sessions.verifyResume(decodeURIComponent(m[1])) === "il-1111111111");
  check("…in HTML too, with the signature", /<html/.test(pe.html || "") && /Nick Zeniou/.test(pe.html || ""));
  check("sweep logs carry no name, email or phone", pii().length === 0, pii());

  sent = [];
  r = await call(sweep, { method: "GET", headers: AUTH });
  check("a second run sends nothing (idempotent)", r.json.swept === 0 && sent.length === 0);

  // A failed notification gives the session back for the next run.
  await call(save, { body: saveBody("il-3333333333", TOKEN_C) });
  clock += 31 * 60000;
  failSend = (msg) => (msg.to === "nickz@thermaldawn.com" ? Object.assign(new Error("smtp"), { responseCode: 451 }) : null);
  capture(); r = await call(sweep, { method: "GET", headers: AUTH }); release();
  check("a failed notification is released, not lost", r.json.released === 1 && fresh.rows.get("il-3333333333").partial_sent_at === null);
  failSend = null; sent = [];
  r = await call(sweep, { method: "GET", headers: AUTH });
  check("…and the next run sends it", r.json.sent === 1 && sent.some((x) => /il-3333333333/.test(x.subject)));
  delete process.env.VERCEL_ENV;

  // Off production: every email only to TEST_RECIPIENT, none when it's unset.
  await call(save, { body: saveBody("il-4444444444", TOKEN_A) }); clock += 31 * 60000; sent = [];
  r = await call(sweep, { method: "GET", headers: AUTH });
  check("off production with no TEST_RECIPIENT: nothing sent, the session is released",
    sent.length === 0 && r.json.released === 1 && fresh.rows.get("il-4444444444").partial_sent_at === null);
  process.env.TEST_RECIPIENT = "test-inbox@example.com"; sent = [];
  r = await call(sweep, { method: "GET", headers: AUTH });
  check("off production with TEST_RECIPIENT: everything goes only there",
    sent.length === 2 && sent.every((x) => x.to === "test-inbox@example.com"), sent.map((x) => x.to));
  delete process.env.TEST_RECIPIENT;

  // ---- 5. lead.js: the first send closes the session; a completion threads under the partial
  const L = sessions.memoryStore(); sessions.useStore(L);
  const full = (leadId, token, extra) => Object.assign({ form: "intake", ts: Date.now() - 60000, lead_id: leadId, resume_token: token,
    first_name: NAME, last_name: LAST, email: EMAIL, phone: PHONE, postcode: "3122", suburb: "Hawthorn", state: "VIC",
    intent: "fit", heating: ["boiler_radiators"], outcome: "matched", last_screen: "MATCH", seen: ["S1", "S2", "S3", "S4", "S5", "S7", "MATCH"] }, extra || {});
  process.env.TEST_RECIPIENT = "test-inbox@example.com";
  // a) finished before 30 minutes: closed, never swept
  await call(save, { body: saveBody("il-5555555555", TOKEN_A) });
  sent = []; await call(lead, { body: full("il-5555555555", TOKEN_A) });
  check("a finished enquiry closes its session", !!L.rows.get("il-5555555555").completed_at);
  const root = sent.find((x) => /il-5555555555/.test(x.subject) && x.messageId);
  check("…its notification is the thread's root, as in stage 1", root && !root.inReplyTo);
  clock += 31 * 60000; sent = [];
  r = await call(sweep, { method: "GET", headers: AUTH });
  check("…and the sweep never emails it", r.json.swept === 0 && sent.length === 0);
  // b) a partial went first: the completion replies in its thread
  await call(save, { body: saveBody("il-6666666666", TOKEN_B) });
  clock += 31 * 60000; await call(sweep, { method: "GET", headers: AUTH });
  sent = []; await call(lead, { body: full("il-6666666666", TOKEN_B) });
  const reply = sent.find((x) => /il-6666666666/.test(x.subject) && x.inReplyTo);
  check("a completion after a partial replies in the partial's thread",
    reply && reply.inReplyTo === "<intake-il-6666666666@thermaldawn.com>" && /^Re: /.test(reply.subject) && !reply.messageId);
  delete process.env.TEST_RECIPIENT;

  // ---- 6. resume ------------------------------------------------------------------
  const Rz = sessions.memoryStore(); sessions.useStore(Rz);
  await call(save, { body: saveBody("il-7777777777", TOKEN_A, { last_screen: "S10", answers: Object.assign({ heating: ["boiler_underfloor"] }, STEP1) }) });
  const t7 = sessions.signResume("il-7777777777");
  r = await call(resume, { body: { t: t7, resume_token: TOKEN_C } });
  check("a good link brings the answers and last screen back",
    r.json.ok === true && r.json.lead_id === "il-7777777777" && r.json.last_screen === "S10" && r.json.answers.heating[0] === "boiler_underfloor");
  r = await call(save, { body: saveBody("il-7777777777", TOKEN_A) });
  check("…the old token can no longer save", r.json.saved === false);
  r = await call(save, { body: saveBody("il-7777777777", TOKEN_C) });
  check("…the new one can", r.json.saved === true);
  r = await call(resume, { body: { t: t7.slice(0, -2) + "xx", resume_token: TOKEN_B } });
  check("a tampered link gets nothing", r.json.ok === false && !r.json.answers);
  await Rz.complete("il-7777777777", sessions.hashToken(TOKEN_C));
  r = await call(resume, { body: { t: t7, resume_token: TOKEN_B } });
  check("a completed session can't be reopened", r.json.ok === false);

  sessions.useStore(null);
  console.log(failed ? `${failed} CHECK(S) FAILED` : "All session checks passed.");
  process.exitCode = failed ? 1 : 0;
})().catch((e) => { release(); console.error(e); process.exitCode = 1; });
