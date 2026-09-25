# W1 spec · Port the three Wix forms to Vercel + freevolt.com.au cutover prep

Implementation spec for the marketing-website repo. Written 31 Jul 2026 by the
scoping session after reading the Coda PRD (Founder War Room > "PRD · Sales
Funnel & Web"), TD-Platform docs/tooling-migration.md §M1, and the Sales Funnel
Playbook. Field definitions below were pulled from the live Wix form schemas
via the Forms API, not guessed. Follow this spec over memory.

## Non-negotiables (from the PRD)

1. Every submission fires a PARSEABLE PLAIN-TEXT email to nickz@thermaldawn.com.
   Gmail is the intake system of record. The sales agent parses these emails;
   the format in §6 is the contract.
2. Keep the free-text comments field visible and inviting. Do NOT bury it.
   (Nick's call, 31 Jul: keep the current field ORDER as-is; no re-layout.
   That means comments stays last, exactly as on Wix. Don't shrink it, don't
   collapse it, keep it a full-width textarea.)
3. Wix is NOT retired in this work. Retirement happens only after a full
   form → Gmail round trip is verified on the production domain.
4. Secrets live in Vercel env vars only. Never in the repo.
5. Do not touch the live fleet-stats integration
   (assets/js/live-stats.js → thermal-dawn-platform.vercel.app/api/public/stats).
6. Deploy gate: build and commit freely; run tools/deploy-live.mjs ONLY when
   Nick says "deploy".
7. No database. Email is the whole backend.

## Decisions already made with Nick (do not re-litigate)

- Transport: **Google Workspace SMTP** (his own account), NOT Resend/Web3Forms.
  Rationale: the notification's only recipient is Nick himself, so mail never
  touches a new PII processor; the autoresponder rides thermaldawn.com's
  existing sender reputation. Resend rejected on PII grounds (it stores sent
  email content).
- Forms are a FAITHFUL port of the current Wix schemas. Same fields, same
  labels, same option strings, same order, same required flags. "They work,
  don't change too much at once."
- Installer Register Interest form/page: dropped, not ported.
- Basic Reserve / Founder Premium: NOT in scope. They take payment through
  Wix and stay on Wix until Stripe Payment Links exist (config.js is already
  scaffolded for those). Their broken Netlify forms on the Vercel site are a
  known issue, out of W1.
- Autoresponder: ported for Register Interest only. Calendly link prominent.
  The old "Home assessment" (Tally) button is dropped — nobody used it.
- The Wix notification email has a rendering bug (arrays come out as
  `List(Within 3 months)`). The port comma-joins arrays. This is a fix to the
  EMAIL formatting, not a form change.

## 1. Repo context

- Plain static site, no framework, no build step. Vercel project
  `marketing-website-live`, deployed by force-push to the NZEN-7 mirror via
  `npm run deploy:live` (tools/deploy-live.mjs). Live URL:
  https://marketing-website-live-seven.vercel.app
- `vercel.json` has `trailingSlash: true`. VERIFY after first deploy that a
  POST to `/api/lead` is not 308-redirected (a redirect drops the body). If it
  is, adjust (exempt /api from trailing-slash handling or POST to the
  redirected path).
- Local preview: `npm run serve` (static only — it will NOT run the API
  function; that's expected).
- All five current HTML forms use `data-netlify` and 404 on Vercel today.
- House cache-busting rule (BUILD-NOTES): editing shared css/js requires
  bumping `?v=` refs. Currently `?v=6`. A NEW js file needs no global bump.
- Site voice: no em dashes anywhere (recently purged sitewide). Note: some Wix
  OPTION VALUES contain an EN dash ("Within 6–12 months") — keep option
  values byte-identical to Wix so downstream parsing/CRM history stays
  consistent. The em-dash rule is prose, not data.

## 2. Environment variables (Nick creates; names are the contract)

| Var | Value | Notes |
|---|---|---|
| `GMAIL_USER` | `nickz@thermaldawn.com` | plain env |
| `GMAIL_APP_PASSWORD` | 16-char Google app password | mark **Sensitive** in Vercel |

If env vars are missing at runtime, return 500 with a generic message and
`console.error` a clear reason. Never echo submitted PII back in any response.

## 3. Serverless function: `api/lead.js`

- CommonJS (`module.exports`), zero config; Vercel auto-detects `api/*.js`
  even on a static project. Add `nodemailer` to `package.json` dependencies
  (the only dependency in the repo; keep it that way).
- Transport: `smtp.gmail.com`, port 465, secure, auth from env.
  - Notification: From `"Thermal Dawn Website" <nickz@thermaldawn.com>`,
    To `nickz@thermaldawn.com`, Reply-To = customer email (so Nick replies
    straight to the lead from Gmail).
  - Autoresponder (register-interest only): From
    `"Nick at Thermal Dawn" <nickz@thermaldawn.com>`, To = customer.
    If the autoresponder send fails, still return success (the notification
    is the contract; log the failure).
- Accepts POST, JSON body, discriminated by `form` field:
  `register-interest` | `contact` | `subscribe`.
- Reject non-POST (405). Reject unknown `form` (400).
- Spam controls (no captcha):
  - Honeypot: hidden field `website` — if non-empty, return 200 (pretend
    success) and send nothing.
  - Time trap: hidden `ts` set by JS at page load; if `Date.now() - ts <
    3000` ms, treat as honeypot.
- Validation: required fields per form (§4–5); email regex; cap every string
  (comments 5000 chars, others 500); arrays of strings only. Strip `\r` `\n`
  from anything interpolated into the SUBJECT line (header injection).
- Timestamps in `Australia/Sydney`, formatted like `31 July 2026 at 2:40 pm`
  plus the correct `AEST`/`AEDT` suffix (Intl with timeZoneName).
- Export the email-formatting functions on the module (e.g.
  `module.exports.formatNotification = ...`) so a local test harness can
  verify output without SMTP.

## 4. The three forms — field specs (verbatim from Wix schemas)

### 4a. Homeowner Register Interest
Wix form id `383a23dc-a4a6-4857-bc8b-6e92896d2772`, rev 9.
Page: `pre-order/register-interest/index.html` — REPLACE the existing
(outdated) Netlify form. Field order below is the Wix layout order.

| # | Label | Input | Required | JSON key |
|---|---|---|---|---|
| 1 | First name | text | yes | `first_name` |
| 2 | Last name | text | yes | `last_name` |
| 3 | Email | email | yes | `email` |
| 4 | Phone | tel | yes | `phone` |
| 5 | Suburb | text | yes | `suburb` |
| 6 | State | select | yes | `state` |
| 7 | Current heating/cooling system | radio | yes | `heating` |
| 8 | Do you have solar panels? | radio | yes | `solar` |
| 9 | Do you have a home battery? | radio | yes | `battery` |
| 10 | What's driving your interest right now? | checkboxes + Other | yes (≥1) | `drivers` (array) |
| 11 | When are you looking to act? | checkboxes + Other | yes (≥1) | `timeline` (array) |
| 12 | Anything else we should know? | textarea | no | `comments` |

Option strings, byte-identical:

- State: `NSW` `VIC` `QLD` `WA` `TAS` `NT` `Other`
- Heating: `Gas hydronic - radiators or underfloor` · `Gas ducted` ·
  `Gas wall heaters / space heaters` · `Ducted reverse cycle (electric)` ·
  `Split systems only` · `No heating/cooling system` · `Other / not sure`
- Solar: `Yes` `No`   (note: two old submissions show legacy granular values;
  the CURRENT schema is plain Yes/No — use that)
- Battery: `Yes` `No`
- Drivers: `Bills are too high` · `Boiler / system needs replacing` ·
  `Planning a renovation or extension` · `Building a new house` ·
  `Researching for future upgrade` · `Reducing my carbon footprint`
  + an "Other" free-text option (Wix `addOther`): render as a checkbox
  labelled `Other` that reveals a small text input; append its text to the
  array.
- Timeline: `Urgently (boiler broken / system failing)` · `Within 3 months` ·
  `Within 6–12 months` · `12+ months / future planning` + same Other
  treatment. (En dash in `6–12` is intentional — keep it.)

### 4b. Contact Form
Wix form id `ea62614a-eb12-467c-affd-8a0f25b91851`.
Page: `contact/index.html` — swap the Netlify form in place, keep the page's
existing `.form`/`.field` styling classes.

| Label | Input | Required | JSON key |
|---|---|---|---|
| Name | text | yes | `name` |
| Email | email | yes | `email` |
| Message | textarea | no | `message` |

### 4c. Subscribe Form
Wix form id `afdf44dd-b021-4758-9f24-895e9a430798`.
Page: `index.html` newsletter section — swap the Netlify form.

| Label | Input | Required | JSON key |
|---|---|---|---|
| Email | email (placeholder `e.g., email@example.com`) | yes | `email` |
| "Yes, subscribe me to your newsletter." | checkbox | no | `optin` (bool) |

Submit button text: `Subscribe`.

## 5. Client-side: `assets/js/forms.js` (new file)

- Progressive enhancement over `form[data-lead-form]`. Native HTML validation
  first (`required`, `type=email`); on submit: prevent default, disable the
  button with a "Sending..." label, `fetch('/api/lead', {method:'POST',
  headers:{'Content-Type':'application/json'}, body})`, then redirect on
  success to the form's `data-redirect`:
  - register-interest → `/thank-you/registered/`
  - contact → `/thank-you/`
  - subscribe → `/thank-you/`
- On failure: re-enable the button and show an inline error INCLUDING a
  fallback mailto line: "Something went wrong. Email us directly at
  nickz@thermaldawn.com". Never lose a lead to a silent failure.
- Include the honeypot input (`name="website"`, wrapped in the existing `.hp`
  visually-hidden pattern) and set `ts` on DOMContentLoaded.
- Load with `<script src="/assets/js/forms.js" defer></script>` on the three
  pages only.

## 6. Email formats — THE CONTRACT (match exactly)

### 6a. Register Interest notification
Subject: `New website lead: {First} {Last} · {heating} · {email}`

```
Hi Thermal Dawn Team,

Form: Homeowner Register Interest
Submission Time: {31 July 2026 at 2:40 pm AEST}

CONTACT
First name: {first_name}
Last name: {last_name}
Email: {email}
Phone: {phone}

LOCATION
Suburb: {suburb}
State: {state}

CURRENT SETUP
Solar: {solar}
Battery: {battery}
Current heating/cooling system: {heating}

MOTIVATION AND TIMING
What's driving interest: {drivers, comma-joined}
Timeline: {timeline, comma-joined}

CONTEXT
Comments: {comments, or "-" if empty}
```

Section labels and field labels are load-bearing (the sales agent parses
them). `Battery:` is a new line vs older emails — the form gained the field
in June; keep it.

### 6b. Contact notification
Subject: `New website message: {Name} · {email}`

```
Hi Thermal Dawn Team,

Form: Contact Form
Submission Time: {...}

CONTACT
Name: {name}
Email: {email}

MESSAGE
{message, or "-" if empty}
```

### 6c. Subscribe notification
Subject: `New subscriber: {email}`

```
Form: Subscribe Form
Submission Time: {...}

Email: {email}
Newsletter opt-in: {Yes|No}
```

### 6d. Register Interest autoresponder (customer-facing — voice rules apply:
no em dashes, no sentence starting with "I", contractions, plain text)

Subject: `Thanks For Getting in Touch`

```
Hi {first_name},

Thanks for getting in touch. Nick will be back to you within the next few days.

Keen to talk sooner? Book a call at a time that suits you:
https://calendly.com/nickz-thermaldawn/30min

Or call Nick direct on +61 432 395 138.

Keen to chat.

Nick
Thermal Dawn
```

## 7. Testing before deploy

1. Local harness (e.g. `node api/test-format.mjs` or a scripts/ file):
   require the exported formatters, run the three sample payloads (use Nigel
   Gray's real values from the Wix email as the register-interest sample),
   print, and eyeball against §6. Arrays must comma-join (no `List(...)`).
2. Static pages: `npm run serve`, check all three forms render, native
   validation fires, honeypot invisible, keyboard/mobile OK. The POST will
   fail locally (no function) — that's expected; confirm the error fallback
   with the mailto renders.
3. After Nick says deploy: `npm run deploy:live`, then on the live URL —
   confirm `/api/lead` POST is not 308-redirected (trailingSlash), submit
   each form once with obviously-test values, verify all three emails arrive
   in nickz@thermaldawn.com with correct format, verify Reply-To is the
   customer address, verify the autoresponder arrives at the test customer
   address. Delete test rows nowhere — there's nothing to delete; that's the
   point.

## 8. After the forms verify: freevolt.com.au (Nick does DNS, hand him this)

1. Vercel dashboard → marketing-website-live → Settings → Domains → add
   `freevolt.com.au` and `www.freevolt.com.au`.
2. GoDaddy DNS for freevolt.com.au: delete the existing forwarding/redirect
   to thermaldawn.com, then set `A @ 76.76.21.21` and
   `CNAME www cname.vercel-dns.com`. Do NOT touch MX or other records.
3. Keep the `X-Robots-Tag: noindex` header (already in vercel.json) until
   launch. Canonicals still say thermaldawn.com.au — fine for staging.
4. Re-run the three-form round trip ON the freevolt.com.au domain. That
   satisfies the PRD's production-domain verification gate.

## 9. Explicitly out of scope (documented so nobody "helpfully" does them)

- Wix retirement itself. Checklist for that later session: round trip
  verified on production domain → export all Wix form submissions (~154)
  to Drive `Sales +/Consumer/CRM/Archive/` → delete submissions from Wix →
  downgrade Wix plan. Deposits path blocks full retirement until Stripe.
- Stripe Payment Links for basic-reserve / founder-premium (fills the
  existing config.js placeholders; separate task).
- Installer page/form (dropped by Nick, 31 Jul).
- Autoresponder for Contact/Subscribe.
- Any CRM/database/webhook plumbing.

## Reference

- Wix site id: `5018eb88-2805-49bc-8d5c-e9bfad2600b8`
- Form ids: RI `383a23dc-…2772` · Contact `ea62614a-…9851` · Subscribe
  `afdf44dd-…0798` (full ids above)
- Old Wix automation ids: RI `279fad2a-f814-4bbe-ae60-b24ff85f1a19`,
  Contact `77d2ec33-b36b-4570-abaa-a0c1241c12df`, Subscribe
  `a54797b2-e96a-48fc-a91d-61c63f38b635`
- Calendly: https://calendly.com/nickz-thermaldawn/30min
- Vercel URL: https://marketing-website-live-seven.vercel.app
