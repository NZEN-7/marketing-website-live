# Keys plan: rollout runbook

*Web Designer, 27 Sep 2026. The CTO's keys plan (status card, "CTO item 1"),
built. Nothing here has been run against production. Every step marked
**Nick** is Nick's: production migrations, creating or rotating keys, and
`deploy:live`.*

The code is written so the steps can happen in any order without dropping a
lead: `api/lead.js` uses the insert-only key when both `SUPABASE_LEADS_KEY` and
`SUPABASE_ANON_KEY` are set, and falls back to the service-role key until it is
removed (`supabaseAuth()`, checked by `npm run test:leadrow`).

## Part A: an insert-only key for the leads table

1. **Nick:** apply `2026-09-27-lead-writer.sql` to the CRM project
   (`skyequfcoejlhzbyipwt`). Run the verify queries at the bottom of the file:
   `lead_writer | INSERT` is the only grant left on `leads`, and the one policy
   is `leads_insert_from_website`.
2. **Nick:** mint the key: `SUPABASE_JWT_SECRET=… node scripts/supabase/mint-leads-key.js > leads-key.txt`.
   Needs the project's legacy JWT secret. If the project has moved to the new
   publishable and secret keys with the legacy secret disabled, stop and tell
   the CTO: the fallback is a Postgres role with the same grants.
3. **Nick:** in Vercel (`marketing-website-live`), add `SUPABASE_LEADS_KEY`
   (the minted token) and `SUPABASE_ANON_KEY` (the project's public anon key).
   Delete `leads-key.txt`.
4. **Nick:** `npm run deploy:live` (only needed if this code is not live yet).
5. Submit the contact form once with test values. The row appears in `leads`;
   the Vercel function log shows no "Supabase lead insert failed".
6. **Nick:** remove `SUPABASE_SERVICE_ROLE_KEY` from Vercel, redeploy, and submit
   once more. Now the website holds no key that can read anything.

## Part B: a send-only mailbox instead of Nick's

**Order matters here.** The CRM's Apps Script finds lead emails by sender. If
the sender changes before the script knows, capture stops with no error.

1. **Nick:** paste the updated `scripts/apps-script/lead-capture.gs` into the
   Apps Script project. Its query now accepts both `nickz@` and `noreply@`
   (`npm run test:parser` fails if either is dropped). Run it once by hand: the
   log shows the usual matching-thread count.
2. **Nick:** create the Workspace user `noreply@thermaldawn.com` (one licence),
   turn on 2-step verification, and generate an app password.
3. **Nick:** in Vercel, set `GMAIL_USER` to `noreply@thermaldawn.com` and
   `GMAIL_APP_PASSWORD` to the new app password. Deploy.
4. Submit the contact form once. The notification still arrives **to**
   `nickz@`, now **from** `noreply@`, with Reply-To the customer. The
   autoresponder arrives from "Nick at Thermal Dawn" `<noreply@…>`, with
   Reply-To `nickz@`, so a customer's reply still reaches Nick. The next
   capture run files it into `leads.csv`.
5. **Nick:** revoke the old app password on `nickz@thermaldawn.com`.

**Check with Sales before step 3:** the sales agent also reads these emails. If
it filters by sender, it needs the same two-sender change.

SPF, DKIM and DMARC are per domain, so nothing changes in the Wix DNS zone.
