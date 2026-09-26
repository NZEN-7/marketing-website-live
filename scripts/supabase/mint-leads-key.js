/* Mint the insert-only key for api/lead.js (keys plan, part A).

     SUPABASE_JWT_SECRET=... node scripts/supabase/mint-leads-key.js > leads-key.txt

   For Nick to run, once, after 2026-09-27-lead-writer.sql is applied. Creating
   a key is Nick's (HOW CODE SESSIONS WORK §4), so no session runs this.

   Prints one JWT whose role is `lead_writer`, signed HS256 with the project's
   JWT secret (Supabase dashboard > Project Settings > API > JWT secret; legacy
   JWT keys must still be enabled on the project). Put the output in Vercel as
   SUPABASE_LEADS_KEY, then delete leads-key.txt.

   The secret is read from the environment and never printed or written.
   Node standard library only.

   Lifetime: 1 year by default (--days N to change). A long-lived token is the
   price of a static key in Vercel; what bounds the damage is the role, which
   can insert leads and nothing else. Re-mint and replace before it expires.
*/
"use strict";

const crypto = require("crypto");

const secret = process.env.SUPABASE_JWT_SECRET;
if (!secret) {
  console.error("Set SUPABASE_JWT_SECRET in the environment (never on the command line).");
  process.exit(1);
}

const i = process.argv.indexOf("--days");
const days = i > -1 ? Number(process.argv[i + 1]) : 365;
if (!(days > 0 && days <= 730)) {
  console.error("--days must be between 1 and 730");
  process.exit(1);
}

const b64url = (buf) =>
  Buffer.from(buf).toString("base64").replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");

const now = Math.floor(Date.now() / 1000);
const header = { alg: "HS256", typ: "JWT" };
const payload = { iss: "supabase", ref: "skyequfcoejlhzbyipwt", role: "lead_writer", iat: now, exp: now + days * 86400 };

const unsigned = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`;
const sig = b64url(crypto.createHmac("sha256", secret).update(unsigned).digest());

process.stdout.write(`${unsigned}.${sig}\n`);
console.error(`lead_writer key minted, expires ${new Date((now + days * 86400) * 1000).toISOString().slice(0, 10)}.`);
