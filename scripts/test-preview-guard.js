/* The preview guard: off production, every email goes to TEST_RECIPIENT only
   (or nowhere) and the leads insert is skipped. Production is unchanged.
   Through the real handler, with the mail transport and fetch faked.
   No credentials, no network.

     npm run test:previewguard
*/
"use strict";

const path = require("path");

let sent = [];
let inserts = [];
let logs = [];
const nm = require.resolve("nodemailer");
require.cache[nm] = { id: nm, filename: nm, loaded: true, exports: {
  createTransport: () => ({ sendMail: async (m) => { sent.push(m); } }),
} };
global.fetch = async (url) => { inserts.push(String(url)); return { ok: true, status: 201, text: async () => "" }; };
// SUPABASE_URL is read when the module loads: fake values, so production does insert.
Object.assign(process.env, {
  GMAIL_USER: "nickz@thermaldawn.com", GMAIL_APP_PASSWORD: "not-a-real-password",
  SUPABASE_URL: "https://example.invalid", SUPABASE_LEADS_KEY: "not-a-key", SUPABASE_ANON_KEY: "not-a-key",
});
const realLog = console.log;
console.log = (...a) => { logs.push(a.join(" ")); };

const lead = require(path.join(__dirname, "..", "api", "lead.js"));

let failed = 0;
const check = (label, cond, got) => {
  if (cond) realLog(`ok    ${label}`);
  else { console.error(`FAIL  ${label}${got !== undefined ? ": " + JSON.stringify(got) : ""}`); failed++; }
};
const TEST_TO = "preview-inbox@example.com";
const SUBMITTER = "robin@example.com";
const OK = { form: "contact", name: "Robin Example", email: SUBMITTER, message: "hello" };
let ip = 0;
async function submit(env) {
  delete process.env.VERCEL_ENV; delete process.env.TEST_RECIPIENT;
  Object.assign(process.env, env);
  sent = []; inserts = []; logs = [];
  const req = { method: "POST", body: Object.assign({ ts: Date.now() - 10000 }, OK), headers: { "x-forwarded-for": `198.51.100.${++ip}` } };
  const res = { code: 0, body: null, status(c) { this.code = c; return this; }, json(j) { this.body = j; return this; }, setHeader() {} };
  await lead(req, res);
  return res;
}
const tos = () => sent.map((m) => m.to);

(async () => {
  let r;

  r = await submit({ VERCEL_ENV: "production", TEST_RECIPIENT: TEST_TO });
  check("production: notification to Nick, thanks to the submitter (TEST_RECIPIENT ignored)",
    r.code === 200 && JSON.stringify(tos()) === JSON.stringify(["nickz@thermaldawn.com", SUBMITTER]), tos());
  check("production: the leads row is inserted", inserts.length === 1 && inserts[0].endsWith("/rest/v1/leads"), inserts);
  check("production: no preview_guard log lines", !logs.some((l) => l.includes("preview_guard")), logs);

  for (const envName of ["preview", "development"]) {
    r = await submit({ VERCEL_ENV: envName, TEST_RECIPIENT: TEST_TO });
    check(`${envName} with TEST_RECIPIENT: both emails go to it and only it`,
      r.code === 200 && sent.length === 2 && tos().every((t) => t === TEST_TO), tos());
    check(`${envName}: the notification keeps its layout (same subject and body as live)`,
      sent[0] && sent[0].subject === lead.formatSubject(lead.parseSubmission(Object.assign({ ts: 1 }, OK)).data));
    check(`${envName}: no leads insert, logged as a code`,
      inserts.length === 0 && logs.includes("preview_guard: leads_insert_skipped"), [inserts, logs]);
  }

  r = await submit({ VERCEL_ENV: "preview" });
  check("preview, TEST_RECIPIENT unset: nothing is sent, nothing inserted, still a 200",
    r.code === 200 && sent.length === 0 && inserts.length === 0, [r.code, tos(), inserts]);
  check("preview, TEST_RECIPIENT unset: each skip is logged as a code",
    ["preview_guard: notification_not_sent_no_test_recipient", "preview_guard: leads_insert_skipped",
      "preview_guard: autoresponder_not_sent_no_test_recipient"].every((c) => logs.includes(c)), logs);

  r = await submit({ VERCEL_ENV: "preview", TEST_RECIPIENT: "   " });
  check("preview, TEST_RECIPIENT blank: treated as unset", sent.length === 0 && inserts.length === 0, tos());

  r = await submit({});
  check("VERCEL_ENV unset (a local run): guarded like a preview", sent.length === 0 && inserts.length === 0, tos());

  r = await submit({ VERCEL_ENV: "Production", TEST_RECIPIENT: TEST_TO });
  check("only the exact value 'production' is live", tos().every((t) => t === TEST_TO) && inserts.length === 0, tos());

  check("the codes carry no submitted data", !logs.join("\n").includes(SUBMITTER) && !logs.join("\n").includes("Robin"));

  realLog(failed ? `\n${failed} CHECK(S) FAILED` : "\nAll preview-guard checks passed.");
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error("FAIL  harness crashed:", e && e.stack); process.exit(1); });
