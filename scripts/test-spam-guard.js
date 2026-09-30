/* The form endpoint's spam screens, through the real handler with the mail
   transport faked. No credentials, no network.

     npm run test:spam
*/
"use strict";

const path = require("path");

let sent = [];
const nm = require.resolve("nodemailer");
require.cache[nm] = { id: nm, filename: nm, loaded: true, exports: {
  createTransport: () => ({ sendMail: async (m) => { sent.push(m); } }),
} };
global.fetch = async () => ({ ok: true, status: 201, text: async () => "" });
// Live behaviour: off production the preview guard would send nothing (no TEST_RECIPIENT).
Object.assign(process.env, { GMAIL_USER: "nickz@thermaldawn.com", GMAIL_APP_PASSWORD: "not-a-real-password", VERCEL_ENV: "production" });
delete process.env.SUPABASE_URL;

const lead = require(path.join(__dirname, "..", "api", "lead.js"));

let failed = 0;
const check = (label, cond, got) => {
  if (cond) console.log(`ok    ${label}`);
  else { console.error(`FAIL  ${label}${got !== undefined ? ": " + JSON.stringify(got) : ""}`); failed++; }
};
const OK = { form: "contact", name: "Robin Example", email: "robin@example.com", message: "hello" };
function call(body, ip) {
  const req = { method: "POST", body, headers: { "x-forwarded-for": ip } };
  const res = { code: 0, json: null, status(c) { this.code = c; return this; }, json(j) { this.json = j; return this; }, setHeader() {} };
  return lead(req, res).then(() => res);
}
const stamp = () => Date.now() - 10000;

(async () => {
  let r;
  sent = []; r = await call(Object.assign({ ts: stamp() }, OK), "198.51.100.1");
  check("a real submission (page stamp, no honeypot) goes through", r.code === 200 && sent.length >= 1, [r.code, sent.length]);

  sent = []; r = await call(Object.assign({}, OK), "198.51.100.2");
  check("no page stamp (a direct POST): quiet 200, nothing sent", r.code === 200 && sent.length === 0, [r.code, sent.length]);
  sent = []; r = await call(Object.assign({ ts: "abc" }, OK), "198.51.100.3");
  check("a junk page stamp: screened", r.code === 200 && sent.length === 0);
  sent = []; r = await call(Object.assign({ ts: Date.now() }, OK), "198.51.100.4");
  check("submitted under 3 s after page load: screened", r.code === 200 && sent.length === 0);
  sent = []; r = await call(Object.assign({ ts: stamp(), website: "http://spam.example" }, OK), "198.51.100.5");
  check("honeypot filled: screened", r.code === 200 && sent.length === 0);

  const codes = [];
  sent = [];
  for (let i = 0; i < 12; i++) codes.push((await call(Object.assign({ ts: stamp() }, OK), "192.0.2.9")).code);
  check("per-IP cap: 10 in the window go through, the 11th and 12th get 429",
    codes.slice(0, 10).every((c) => c === 200) && codes[10] === 429 && codes[11] === 429, codes);
  r = await call(Object.assign({ ts: stamp() }, OK), "192.0.2.10");
  check("another IP is not affected", r.code === 200);

  console.log(failed ? `\n${failed} CHECK(S) FAILED` : "\nAll spam-guard checks passed.");
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error("FAIL  harness crashed:", e && e.stack); process.exit(1); });
