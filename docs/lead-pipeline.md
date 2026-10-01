# The lead pipeline

A form submission, from the browser to everywhere it ends up.

## The six form keys

| `data-lead-form` | Page | What happens after |
|---|---|---|
| `register-interest` | `/pre-order/register-interest/` | Redirect to `/thank-you/registered/` |
| `contact` | `/contact/` | Redirect to `/thank-you/` |
| `subscribe` | newsletter field on `/` | Redirect to `/thank-you/` |
| `founder-premium` | `/pre-order/booking/` | Lead recorded as "Booking Deposit ($990)", then the browser goes to the $990 Stripe Payment Link (`data-stripe-key="founderPremium"`); Stripe's after-payment redirect still names `/thank-you/founder-premium/`, which 301s to `/thank-you/booking/` |
| `interest-list` | `/interest/` | The free register-interest list. Redirect to `/thank-you/interest/`. Not pipeline: see below |
| `basic-reserve` | none since 27 Sep 2026 | Retired. `/pre-order/basic-reserve/` 301s to `/interest/`. The key stays in `api/lead.js` so a stale cached page still records |

The two deposit form keys are internal names and are older than the offers
they now carry. Since 24 Sep 2026 the site sells one $990 refundable booking
deposit, and `/pre-order/founder-premium/` 301s to `/pre-order/booking/`. The
form key stayed `founder-premium` on purpose: it is what `api/lead.js` maps to
a label, what the notification email says, and what the CRM parser expects.
Renaming it would break lead capture silently.

**Offer tiers retired, 27 Sep 2026** (CEO's Option B, Nick approved): no Basic
Reserve, no Founder Premium, no discounts. Only the label and tier text in
`api/lead.js` changed ("Booking Deposit ($990)", "Booking deposit"); every email
field label is unchanged. The retired pages are kept, unserved, in
`docs/superseded/2026-09-27-offer-tiers/`.

**The interest list** (`interest-list`) is for heating and cooling, hot water,
states we don't serve yet (anything but VIC and NSW) and NZ. No payment, no
promise of price or date. It uses the existing path and the existing `leads`
columns only, because no new column or table is allowed before the CTO's CRM
ruling (4 Oct 2026):

| Form field | Email label | `leads` column |
|---|---|---|
| first / last name, email, phone | as other forms | as other forms |
| state | `State` | `state` |
| postcode | `Postcode` | `suburb` (the form column says it is a postcode row) |
| interest | `Interested in` | `driver` |
| current system | `Current heating/cooling system` | `heating_system_type` |
| timeframe | `Timeline` | `timeline` |
| how they heard | `How did you hear about us` | `referral_source` |
| consent (required) | `Consent to be contacted` | `newsletter_opt_in` |

Its CRM tags (`interest:heating-cooling`, `interest:hot-water`,
`interest:unserved-state`, `interest:nz`, plus `source:website`) are computed by
`listTags()` from state and interest, printed in the email, and re-derivable
from the row, so nothing stores them yet. A served-state, heating-only signup
gets no interest tag: the email tells Sales to treat it as a normal lead, and
the page and autoresponder point them at the quote form. **Lead and pipeline
counts must exclude `form = 'Interest List'`.**

## Step by step

1. **Browser.** `forms.js` intercepts the submit after native validation, adds
   the form key and a honeypot field, and POSTs JSON to `/api/lead`. On any
   failure it shows an error with a `mailto:` fallback.
2. **`api/lead.js`.** `parseSubmission()` clamps and normalises every field.
   Obvious bots (honeypot filled, no page stamp `ts`, or a stamp under 3 s
   old) get a quiet 200 and nothing else happens. A per-IP cap (10 in 10
   minutes, per function instance, IP never logged) returns 429.
3. **The notification email, first.** `formatNotification()` writes a
   plain-text email with fixed section headings and field labels, and
   `makeTransport()` sends it over SMTP from Nick's Google Workspace account
   (`GMAIL_USER`, `GMAIL_APP_PASSWORD` in Vercel env vars). **This is the system
   of record.** If it fails, the request fails and the browser shows the
   fallback.
4. **Supabase, second.** `recordLead()` inserts `leadRow(d)` into
   `public.leads` over PostgREST with the service-role key. It runs after the
   email and can never fail the request: a bad insert is logged, not returned.
   The table is inbound only: as submitted, free text, never edited. Two
   columns are human-written (`filed_to_contact_id`, `notes`); everything else
   is the form.
5. **The first email** (brief 07, 29 Sep 2026). `firstEmail()` picks one
   template per form from `api/_first-emails/`, pasted verbatim from Sales'
   HANDOVER (`Sales +/Consumer/Sales Playbook/_Templates/First emails/`;
   wording is edited there first, never here). It goes from
   `AUTORESPONDER_FROM` (default "Nick at Thermal Dawn" <`GMAIL_USER`>) with
   Reply-To `nickz@thermaldawn.com`, over the same transport; the booking link
   is `BOOKING_LINK`. Interest-list leads get the unserved template only when
   clearly unserved (a state outside `SERVED_STATES`, or "Split systems
   only"). Deposits get none: that form posts before the Stripe handoff. A
   list email (subscribe, unserved) is held on today's wording until its
   template carries an unsubscribe line. Best effort: a failure never fails
   the request.
6. **Browser, again.** `forms.js` reads the response and redirects: to the
   thank-you page, or, for a deposit, to the Stripe link from `config.js`.
   Stripe's own after-payment redirect brings them back to `/thank-you/...`.
7. **Gmail to the CRM.** A Google Apps Script (`scripts/apps-script/`) runs in
   Nick's account, finds the notification emails by their subject pattern,
   parses the fixed layout with `lead-parser.gs`, and appends rows to
   `Sales +/CRM/leads.csv` in Drive. Nothing syncs the script: when the parser
   changes it is re-pasted into the Apps Script project by hand
   (`scripts/apps-script/SETUP.md`).

## The contract

The email layout is parsed by two readers, the sales agent and the CRM script,
neither of which knows about `api/lead.js`. So:

- **Section headings and field labels in `formatNotification()` are
  byte-stable.** Every labelled line is always present; an empty field prints
  `-`, so the parser never meets a missing line.
- **`npm run test:parser`** feeds real generated emails through the real
  parser and fails on any label drift. Run it after touching
  `formatNotification()`.
- **`npm run test:email`** prints all the emails so the layout can be
  eyeballed, no credentials, no network.
- **`npm run test:leadrow`** checks the Supabase row for every form: no column
  that the table lacks (PostgREST would 400 silently at runtime), every
  form's fields mapped, `payment_ref` null for non-deposits.

Adding a form field therefore touches four places in order: the HTML, the
`parseSubmission()` and `formatNotification()` pair, a Supabase migration
(before deploy), and the Apps Script parser (re-pasted by hand). Then all three
tests.

## Privacy and safety choices

- No third-party form or email processor. PII goes from the function to
  Nick's mailbox and to Supabase, nowhere else.
- Subjects are headers: user input is stripped of newlines before it goes in
  one. Every field is length-clamped.
- Credentials live only in Vercel environment variables.
- **Logs carry a request ID, the form key and an error code, nothing else**
  (brief 07): no recipient, name, phone, message or IP, and no Postgres or
  SMTP message text, which can quote them. `npm run test:handler` forces each
  failure and checks.
- **Off production** (`VERCEL_ENV` not `production`: previews, local runs,
  tests) every email goes only to `TEST_RECIPIENT`, nothing is sent if it is
  unset, and no row is written to the production CRM. Test emails never go by
  submitting the live site's forms.
- The templates ship inside the function (`vercel.json` `includeFiles`) and
  return 404 as pages; `npm run check:templates404 -- <host>` proves it on a
  deployment.
- The Supabase key is the service-role key, used server-side only, and the
  insert is the only operation.

## Specs and history

- `.claude/W1-forms-spec.md`: the port of the three Wix forms to this pipeline
  (31 Jul 2026), including the field definitions pulled from the live Wix
  schemas and the non-negotiables from the PRD.
- `.claude/W1b-deposits-spec.md`: the deposit flow, form-then-pay. Its offer
  section (two tiers) is superseded; its mechanics are what runs.
- `BUILD-NOTES.md`, "Forms (W1, live 31 Jul 2026)" and "Consent stated instead
  of ticked (25 Aug 2026)".
