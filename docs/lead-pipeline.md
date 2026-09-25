# The lead pipeline

A form submission, from the browser to everywhere it ends up.

## The five forms

| `data-lead-form` | Page | What happens after |
|---|---|---|
| `register-interest` | `/pre-order/register-interest/` | Redirect to `/thank-you/registered/` |
| `contact` | `/contact/` | Redirect to `/thank-you/` |
| `subscribe` | newsletter field on `/` | Redirect to `/thank-you/` |
| `founder-premium` | `/pre-order/booking/` | Lead recorded, then the browser goes to the $990 Stripe Payment Link (`data-stripe-key="founderPremium"`); Stripe returns to `/thank-you/founder-premium/` |
| `basic-reserve` | `/pre-order/basic-reserve/` (unlinked, noindexed) | Lead recorded, then the $190 Stripe link; returns to `/thank-you/basic-reserve/` |

The two deposit form keys are internal names and are older than the offers
they now carry. Since 24 Sep 2026 the site sells one $990 refundable booking
deposit, and `/pre-order/founder-premium/` 301s to `/pre-order/booking/`. The
form key stayed `founder-premium` on purpose: it is what `api/lead.js` maps to
a label, what the notification email says, and what the CRM parser expects.
Renaming it would break lead capture silently. The $190 path is kept live but
hidden at Nick's instruction.

## Step by step

1. **Browser.** `forms.js` intercepts the submit after native validation, adds
   the form key and a honeypot field, and POSTs JSON to `/api/lead`. On any
   failure it shows an error with a `mailto:` fallback.
2. **`api/lead.js`.** `parseSubmission()` clamps and normalises every field.
   Obvious bots (honeypot filled, missing email) get a quiet 200 and nothing
   else happens.
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
5. **Autoresponder.** `formatAutoresponder()` sends the customer a short
   acknowledgement from "Nick at Thermal Dawn", with absolute links.
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
