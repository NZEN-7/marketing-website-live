/* Intake stage 2 (HoE items 103 to 108): the session layer, end to end, with
   Pete's five functions mocked by the same rules (_sessions.js memoryStore),
   the mail transport faked and Supabase's leads table faked. Proves:
     - the guards: off by default; a preview never touches the production CRM;
     - the sealed token: round trips, refuses tampering and another secret, never leaves the server;
     - /api/intake-save/: nothing before step 1; first save fixes the token; another
       token is refused; hyphenated routes survive Pete's [a-z0-9_] check; bot trap,
       cap and beacon replies; no PII in logs;
     - /api/intake-sweep/: CRON_SECRET required; only sessions idle 30 minutes; Nick's
       notification is the thread's root; the partial row; the customer's one email
       with a working resume link, in area only; done once; a second run sends nothing;
       a failed notification lapses the lease and is retried after 15 minutes; a lost
       done call is closed without a re-send (Pete's at-least-once note);
     - api/lead.js: the first send closes the session (never swept after), and a
       completion after a partial replies in the partial's thread;
     - /api/intake-resume/: answers back without the sealed token; wrong token, finished
       or 30-day-old sessions refused.
   No credentials, no network.

     npm run test:sessions
*/
"use strict";

const path = require("path");
const api = (f) => path.join(__dirname, "..", "api", f);

// ---- fakes ------------------------------------------------------------------
let sent = [], failSend = null, live = null;
const nm = require.resolve("nodemailer");
require.cache[nm] = { id: nm, filename: nm, loaded: true, exports: {
  createTransport: () => ({ sendMail: async (m) => { const e = failSend && failSend(m); if (e) throw e; sent.push(m); } }),
} };
let inserts = [];
global.fetch = async (url, opts) => {
  const body = JSON.parse(opts.body);
  inserts.push({ url, body });
  // The leads table: a partial row is what the sweep and lead.js read back.
  if (body.intake_event === "partial" && live) live.partials.add(body.intake_lead_id);
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
const use = (s) => { live = s; sessions.useStore(s); return s; };

const TOKEN_A = "a".repeat(64), TOKEN_B = "b".repeat(64), TOKEN_C = "c".repeat(64);
const STEP1 = { first_name: NAME, last_name: LAST, email: EMAIL, phone: PHONE, postcode: "3122", suburb: "Hawthorn", contact_pref: "phone" };
const saveBody = (leadId, token, extra) => Object.assign({ lead_id: leadId, resume_token: token, ts: Date.now() - 60000, website: "",
  last_screen: "S7", rung_reached: "1", route: "icp", state: "VIC", answers: Object.assign({}, STEP1) }, extra || {});

(async () => {
  // ---- 1. guards --------------------------------------------------------------
  const base = { SUPABASE_URL: "https://skyequfcoejlhzbyipwt.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "k", INTAKE_TOKEN_SECRET: "s" };
  check("off by default: no INTAKE_SESSIONS, nothing is written", sessions.target(base).skip === "sessions_off");
  check("on without the server key: skipped", sessions.target({ INTAKE_SESSIONS: "on", SUPABASE_URL: base.SUPABASE_URL }).skip === "not_configured");
  check("on without INTAKE_TOKEN_SECRET: skipped", sessions.target(Object.assign({}, base, { INTAKE_SESSIONS: "on", INTAKE_TOKEN_SECRET: "" })).skip === "token_secret_unset");
  check("a preview never writes to the production CRM", sessions.target(Object.assign({ INTAKE_SESSIONS: "on" }, base)).skip === "non_production_guard");
  check("production writes to the production CRM", !sessions.target(Object.assign({ INTAKE_SESSIONS: "on", VERCEL_ENV: "production" }, base)).skip);

  // ---- 2. the sealed token ----------------------------------------------------
  const sealed = sessions.sealToken(TOKEN_A);
  check("the sealed token opens to the same token", sessions.openToken(sealed) === TOKEN_A);
  check("it isn't the token in the clear", sealed.indexOf(TOKEN_A) === -1);
  check("a tampered seal opens to nothing", sessions.openToken(sealed.slice(0, -3) + "AAA") === null);
  check("another secret can't open it", sessions.openToken(sealed, { INTAKE_TOKEN_SECRET: "another-secret-entirely" }) === null);
  check("the link is in the fragment, on the live site in production",
    sessions.resumeUrl("il-0123456789", TOKEN_A, { VERCEL_ENV: "production" }) === "https://www.thermaldawn.com/start/#resume=il-0123456789." + TOKEN_A);
  check("…and on the preview off production",
    sessions.resumeUrl("il-0123456789", TOKEN_A, { VERCEL_URL: "x.vercel.app" }).indexOf("https://x.vercel.app/start/#resume=") === 0);

  // ---- 3. saves -------------------------------------------------------------------
  const mem = use(sessions.memoryStore());
  capture();
  let r = await call(save, { body: saveBody("il-aaaaaaaaaa", TOKEN_A, { answers: { first_name: NAME } }) });
  check("before step 1 is done: not saved", r.json && r.json.saved === false && !mem.rows.has("il-aaaaaaaaaa"), r.json);
  r = await call(save, { body: saveBody("il-aaaaaaaaaa", TOKEN_A) });
  check("step 1 done: the first save makes the row", r.json.saved === true && mem.rows.has("il-aaaaaaaaaa"));
  check("…with the token sealed in the answers, never in the clear",
    sessions.openToken(mem.rows.get("il-aaaaaaaaaa").answers._rt) === TOKEN_A && JSON.stringify(mem.rows.get("il-aaaaaaaaaa")).indexOf(TOKEN_A) === -1);
  r = await call(save, { body: saveBody("il-aaaaaaaaaa", TOKEN_A, { last_screen: "S8", rung_reached: "2", answers: Object.assign({ heating: ["boiler_radiators"] }, STEP1) }) });
  const ra = mem.rows.get("il-aaaaaaaaaa");
  check("a later save merges the answers, moves last_screen and the rung", r.json.saved === true && ra.last_screen === "S8" && ra.rung_reached === 2 && ra.answers.heating[0] === "boiler_radiators");
  r = await call(save, { body: saveBody("il-aaaaaaaaaa", TOKEN_B, { answers: Object.assign({}, STEP1, { email: "other@example.com" }) }) });
  check("another token can't overwrite the row", r.json.saved === false && ra.answers.email === EMAIL);
  r = await call(save, { body: saveBody("il-eeeeeeeeee", TOKEN_A, { route: "out-of-area", last_screen: "O1" }) });
  check("a hyphenated route survives Pete's [a-z0-9_] check", r.json.saved === true && mem.rows.get("il-eeeeeeeeee").route === "out_of_area");
  r = await call(save, { body: saveBody("il-ffffffffff", TOKEN_A, { answers: Object.assign({ _rt: "forged" }, STEP1) }) });
  check("the page can't write its own _rt", sessions.openToken(mem.rows.get("il-ffffffffff").answers._rt) === TOKEN_A);
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

  let clock = Date.now();
  sessions.memoryStore.clock = () => clock;
  const fresh = use(sessions.memoryStore());
  await call(save, { body: saveBody("il-1111111111", TOKEN_A) });                                   // in area
  await call(save, { body: saveBody("il-2222222222", TOKEN_B, { state: "QLD",                         // out of area
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
    n1 && /\nEnded on: partial \(screen S7\)\n/.test(n1.text) && /^Hi Thermal Dawn Team,/.test(n1.text) && /\nRoute: icp-check\n/.test(n1.text));   // the server's own route: no heating answer yet
  check("no token, sealed or not, in Nick's notification", n1 && n1.text.indexOf(TOKEN_A) === -1 && !/_rt/.test(n1.text));
  const rows = inserts.filter((i) => /\/rest\/v1\/leads/.test(i.url));
  check("each gets a leads row with event partial", rows.length === 2 && rows.every((x) => x.body.intake_event === "partial"), rows.map((x) => x.body.intake_event));
  check("…without the sealed token in its answers", rows.every((x) => !("_rt" in (x.body.answers || {}))));
  const toCustomer = sent.filter((m) => m.to === EMAIL);
  check("the in-area customer gets one email; the out-of-area one gets none", toCustomer.length === 1);
  const pe = toCustomer[0] || {};
  check("…with Nick's line", /Thanks for putting down your details, we'll be in touch\./.test(pe.text || ""));
  const m = /https:\/\/www\.thermaldawn\.com\/start\/#resume=(il-[0-9a-f]{10})\.([0-9a-f]{64})/.exec(pe.text || "");
  check("…and a resume link with the lead's own token", m && m[1] === "il-1111111111" && m[2] === TOKEN_A);
  check("…in HTML too, with the signature", /<html/.test(pe.html || "") && /Nick Zeniou/.test(pe.html || ""));
  check("both are marked done", !!fresh.rows.get("il-1111111111").partial_sent_at && !!fresh.rows.get("il-2222222222").partial_sent_at);
  check("sweep logs carry no name, email or phone", pii().length === 0, pii());

  sent = []; clock += 60 * 60000;
  r = await call(sweep, { method: "GET", headers: AUTH });
  check("a later run sends nothing (done once)", r.json.swept === 0 && sent.length === 0);

  // A failed notification: no done, the lease lapses, retried after 15 minutes.
  await call(save, { body: saveBody("il-3333333333", TOKEN_C) });
  clock += 31 * 60000;
  failSend = (msg) => (msg.to === "nickz@thermaldawn.com" ? Object.assign(new Error("smtp"), { responseCode: 451 }) : null);
  capture(); r = await call(sweep, { method: "GET", headers: AUTH }); release();
  check("a failed notification isn't marked done", r.json.lapsed === 1 && !fresh.rows.get("il-3333333333").partial_sent_at);
  failSend = null; sent = [];
  r = await call(sweep, { method: "GET", headers: AUTH });
  check("…inside the 15-minute lease nobody else takes it", r.json.swept === 0 && sent.length === 0);
  clock += 16 * 60000;
  r = await call(sweep, { method: "GET", headers: AUTH });
  check("…after it the next run sends it", r.json.sent === 1 && sent.some((x) => /il-3333333333/.test(x.subject)));

  // A lost done call: the partial row exists, so the retry closes it without a re-send.
  await call(save, { body: saveBody("il-8888888888", TOKEN_A) });
  clock += 31 * 60000;
  fresh.partials.add("il-8888888888");
  sent = [];
  r = await call(sweep, { method: "GET", headers: AUTH });
  check("a lost done call is closed without sending again", r.json.already === 1 && sent.length === 0 && !!fresh.rows.get("il-8888888888").partial_sent_at);
  delete process.env.VERCEL_ENV;

  // Off production: every email only to TEST_RECIPIENT; none and no done when it's unset.
  await call(save, { body: saveBody("il-4444444444", TOKEN_A) }); clock += 31 * 60000; sent = [];
  r = await call(sweep, { method: "GET", headers: AUTH });
  check("off production with no TEST_RECIPIENT: nothing sent, not done", sent.length === 0 && r.json.lapsed === 1 && !fresh.rows.get("il-4444444444").partial_sent_at);
  process.env.TEST_RECIPIENT = "test-inbox@example.com"; clock += 16 * 60000; sent = [];
  r = await call(sweep, { method: "GET", headers: AUTH });
  check("off production with TEST_RECIPIENT: everything goes only there",
    sent.length === 2 && sent.every((x) => x.to === "test-inbox@example.com"), sent.map((x) => x.to));
  delete process.env.TEST_RECIPIENT;

  // ---- 5. lead.js: the first send closes the session; a completion threads under the partial
  const L = use(sessions.memoryStore());
  const full = (leadId, token, extra) => Object.assign({ form: "intake", ts: Date.now() - 60000, lead_id: leadId, resume_token: token,
    first_name: NAME, last_name: LAST, email: EMAIL, phone: PHONE, postcode: "3122", suburb: "Hawthorn", state: "VIC",
    intent: "fit", heating: ["boiler_radiators"], outcome: "matched", last_screen: "MATCH", seen: ["S1", "S2", "S3", "S4", "S5", "S7", "MATCH"] }, extra || {});
  process.env.TEST_RECIPIENT = "test-inbox@example.com";
  await call(save, { body: saveBody("il-5555555555", TOKEN_A) });
  sent = []; await call(lead, { body: full("il-5555555555", TOKEN_A) });
  check("a finished enquiry closes its session", !!L.rows.get("il-5555555555").completed_at);
  const root = sent.find((x) => /il-5555555555/.test(x.subject) && x.messageId);
  check("…its notification is the thread's root, as in stage 1", root && !root.inReplyTo);
  check("…and its route email goes at once", sent.some((x) => x.to === "test-inbox@example.com" && /good fit|let's talk/i.test(x.subject + x.text)));
  clock += 31 * 60000; sent = [];
  r = await call(sweep, { method: "GET", headers: AUTH });
  check("…and the sweep never emails it", r.json.swept === 0 && sent.length === 0);
  await call(save, { body: saveBody("il-6666666666", TOKEN_B) });
  clock += 31 * 60000;
  process.env.VERCEL_ENV = "production"; await call(sweep, { method: "GET", headers: AUTH }); delete process.env.VERCEL_ENV;
  sent = []; await call(lead, { body: full("il-6666666666", TOKEN_B) });
  const reply = sent.find((x) => /il-6666666666/.test(x.subject) && x.inReplyTo);
  check("a completion after a partial replies in the partial's thread",
    reply && reply.inReplyTo === "<intake-il-6666666666@thermaldawn.com>" && /^Re: /.test(reply.subject) && !reply.messageId);
  check("…and still gets its route email (Nick, 11 Oct: both emails)", sent.filter((x) => x.to === "test-inbox@example.com" && !/il-6666666666/.test(x.subject)).length === 1);
  delete process.env.TEST_RECIPIENT;

  // ---- 6. resume ------------------------------------------------------------------
  const Rz = use(sessions.memoryStore());
  await call(save, { body: saveBody("il-7777777777", TOKEN_A, { last_screen: "S10", answers: Object.assign({ heating: ["boiler_underfloor"] }, STEP1) }) });
  r = await call(resume, { body: { lead_id: "il-7777777777", resume_token: TOKEN_A } });
  check("the link's lead and token bring the answers and last screen back",
    r.json.ok === true && r.json.lead_id === "il-7777777777" && r.json.last_screen === "S10" && r.json.answers.heating[0] === "boiler_underfloor");
  check("…without the sealed token", r.json.ok === true && !("_rt" in r.json.answers));
  r = await call(resume, { body: { lead_id: "il-7777777777", resume_token: TOKEN_B } });
  check("a wrong token gets nothing", r.json.ok === false && !r.json.answers);
  clock += 31 * 86400000;
  r = await call(resume, { body: { lead_id: "il-7777777777", resume_token: TOKEN_A } });
  check("after 30 days it can't be reopened", r.json.ok === false);
  clock -= 31 * 86400000;
  await Rz.complete("il-7777777777", TOKEN_A);
  r = await call(resume, { body: { lead_id: "il-7777777777", resume_token: TOKEN_A } });
  check("a completed session can't be reopened", r.json.ok === false);

  sessions.useStore(null);
  console.log(failed ? `${failed} CHECK(S) FAILED` : "All session checks passed.");
  process.exitCode = failed ? 1 : 0;
})().catch((e) => { release(); console.error(e); process.exitCode = 1; });
