# W1b spec · Deposit flow: reserve forms → /api/lead → Stripe Payment Links

Implementation spec, written 31 Jul 2026 by the scoping session (Fable) after
verifying both live Stripe Payment Links and reading the live Wix Founder
Premium schema (rev 12) via the Forms API. Companion to `.claude/W1-forms-spec.md`,
whose guardrails all still apply (email contract, PII rules, deploy gate,
no database, don't touch live-stats).

This closes the last functional Wix dependency: the two deposit forms.

## The flow (decided: form-then-pay)

1. Visitor fills the reserve form on `/pre-order/basic-reserve/` or
   `/pre-order/founder-premium/`.
2. Form POSTs to the existing `/api/lead` with `form: "basic-reserve"` or
   `"founder-premium"`. Nick gets the parseable lead email BEFORE any payment,
   so an abandoned checkout still yields a fully-qualified lead to chase.
3. On success, the client redirects to the tier's Stripe Payment Link with
   `?prefilled_email={email}&client_reference_id={ref}` appended.
4. Stripe takes the money and (once configured) redirects to the existing
   `/thank-you/basic-reserve/` / `/thank-you/founder-premium/` pages.
5. Payment confirmation reaches Nick via Stripe's own notification email
   (Stripe → Settings → Communication preferences → successful payments ON).
   No webhook. The intent email + Stripe's payment email pair up via the
   Reference line / prefilled email.

**The lead email means intent, not money.** The email body says so explicitly
(see §4). Stripe is the source of truth for payment.

## Verified state of the Stripe links (31 Jul)

| Link | Product | Amount | Phone | Billing address | Business name shown |
|---|---|---|---|---|---|
| `https://buy.stripe.com/5kQbIUcY9dgO37d0Gk4F200` | Basic Reserve | A$190.00 | on | off | **FreeVolt** |
| `https://buy.stripe.com/14A3co4rDgt0bDJagU4F201` | Founder Premium | A$990.00 | on | off | **FreeVolt** |

- Billing address OFF is fine and should STAY off: the form collects the
  install address (required), and a leaner checkout converts better. Do not
  re-add it in Stripe.
- **"FreeVolt" is the Stripe account's public business name** — customers
  would pay a brand that no longer exists, and the card **statement
  descriptor** almost certainly says FREEVOLT too (dispute/chargeback bait).
  Nick action, blocking before launch: Stripe → Settings → Business details →
  set Public business name AND statement descriptor to Thermal Dawn.
- After-payment redirect could not be verified from outside (it only fires
  post-payment). Nick action: confirm each link's confirmation setting is
  "Redirect to your website" → the matching /thank-you/ URL. Note these URLs
  live in Stripe, not the repo — when the domain moves to freevolt.com.au or
  thermaldawn.com, UPDATE THEM IN STRIPE (this is easy to forget; it's also
  listed in BUILD-NOTES' cutover section by this spec's build step).

## 1. Canonical field set (from Wix Founder Premium rev 12, current live)

Discovery that changes earlier assumptions: the June 2026 Wix revision
**slimmed the deposit forms**. Suburb, State, solar, drivers and home-size
were deleted. The current live deposit form is deliberately shorter than
Register Interest — deposit payers get the home-assessment questionnaire
afterwards anyway. Port THIS set, not the old richer one. Both tiers use the
same fields; only price and tier copy differ.

| # | Label | Input | Required | JSON key |
|---|---|---|---|---|
| 1 | First name | text | yes | `first_name` |
| 2 | Last name | text | yes | `last_name` |
| 3 | Email | email | yes | `email` |
| 4 | Phone | tel | yes | `phone` |
| 5 | Address | text (single line) | yes | `address` |
| 6 | Current heating/cooling system | radio, the same 7 options as register-interest, byte-identical | yes | `heating` |
| 7 | When are you looking to act? | **radio (single-select here, unlike RI)** | yes | `timeline` (string) |
| 8 | Anything else we should know? | textarea, full width, generous rows | no | `comments` |
| 9 | T&C checkbox: "I have read and accept the Thermal Dawn Pre-Order Terms and Conditions" (linked) | checkbox | yes (must be ticked) | `terms` (bool, validated true server-side) |

Timeline options: `Urgently (boiler broken / system failing)` ·
`Within 3 months` · `Within 6–12 months` · `12+ months / future planning` ·
`Other` (radio option; when picked, reveal a small text input
`timeline_other` that replaces the value, same pattern forms.js already has
for checkbox groups — extend it for radios or accept the literal "Other").

**Deliberate deviation:** live Wix has the typo `Withing 6-12 months`. Port it
as `Within 6–12 months` to match Register Interest exactly. One consistent
string beats a faithfully copied typo; noted here so nobody "fixes" it back.

Below the button, keep the Wix reassurance line as small print (verbatim):
"After your deposit, we'll send you a home assessment questionnaire (about 10
minutes) so we can give you accurate numbers and confirm fit. Your deposit is
fully refundable."

## 2. The T&C page gap (blocking)

The Wix checkbox links to a Wix page (`/copy-of-english-privacy-policy`,
titled Pre-Order Terms and Conditions). **The Vercel site has no terms page**,
and linking to Wix from the new checkout flow would break at retirement.

Build step: fetch the live Wix page content (https://www.thermaldawn.com/copy-of-english-privacy-policy),
port it to a new static page `/pre-order/terms/` in the site's dark style,
content byte-faithful (it's legal text — no editorial "improvements"), and
point the checkbox link there (`target="_blank"`). If the fetch fails or the
content looks partial, STOP and ask Nick for the text rather than paraphrasing
legal terms.

## 3. Implementation

### config.js (single source for the links)
```js
stripe: {
  basicReserve:  "https://buy.stripe.com/5kQbIUcY9dgO37d0Gk4F200",
  founderPremium: "https://buy.stripe.com/14A3co4rDgt0bDJagU4F201"
}
```
The existing `data-stripe` wiring stays for any remaining direct buttons, but
on the two reserve pages the FORM becomes the only path to Stripe: remove the
standalone "Pay refundable deposit" button/section so no route skips the lead
email. Buttons elsewhere on the site keep pointing at the reserve PAGES (not
raw Stripe links).

### api/lead.js
- Add `basic-reserve` and `founder-premium` to `FORMS`, labels
  `Basic Reserve ($190 deposit)` / `Founder Premium ($990 deposit)`.
- Required: first_name, last_name, email, phone, address, heating, timeline;
  `terms` must be `true` (reject otherwise); comments optional.
- Generate `ref`: `td-` + base36 timestamp (e.g. `td-lxyz123`), include it in
  the response JSON (`{ok:true, ref}`) AND in the email body, so the client
  can append it to the Stripe URL as `client_reference_id`.
- No autoresponder for deposits (Stripe sends the receipt; the thank-you page
  covers the rest). Notification only.

### Notification email (extends the §6 contract of the W1 spec)
Subject: `New deposit intent: {First} {Last} · {Tier} · {email}`

```
Hi Thermal Dawn Team,

Form: Founder Premium ($990 deposit)
Submission Time: {…}

NOTE: This records the form submission, made immediately before Stripe
checkout. Confirm the payment itself in Stripe (reference below).

CONTACT
First name: …
Last name: …
Email: …
Phone: …

PROPERTY
Address: …

CURRENT SETUP
Current heating/cooling system: …

MOTIVATION AND TIMING
Timeline: …

CONTEXT
Comments: …

DEPOSIT
Tier: Founder Premium
Amount: $990
Terms accepted: Yes
Reference: td-…
```

### forms.js
- Support `data-lead-form="basic-reserve|founder-premium"` with
  `data-stripe-key="basicReserve|founderPremium"`: on `{ok:true, ref}`,
  redirect to `window.TD_CONFIG.stripe[key] + "?prefilled_email=" +
  encodeURIComponent(email) + "&client_reference_id=" + ref`
  instead of a thank-you page.
- Radio "Other" reveal for the timeline group (extend the existing
  data-other-for mechanism to radios).
- Everything else (honeypot, ts, error + mailto fallback) unchanged.

### Pages
- `/pre-order/basic-reserve/` and `/pre-order/founder-premium/`: replace the
  dead Netlify forms with the field set above (reuse the .field--group /
  .choice markup and classes from register-interest), tier copy stays,
  reassurance line under the button. Remove the separate pay-button section.
- `/thank-you/basic-reserve/` + `/thank-you/founder-premium/`: review copy so
  it reads as POST-PAYMENT ("deposit received", what happens next: home
  assessment questionnaire, then contact). These pages are now where Stripe
  lands people, not where the form lands them.
- New `/pre-order/terms/` page (§2).
- Cache-bust bump (forms.js + config.js change → v8 across the HTML refs).

## 4. Testing (before Nick says deploy, then after)

1. `npm run test:email` extended with a deposit sample + terms-rejection case.
2. Local: forms render, T&C required client-side, serializer payload correct
   (intercept fetch as the W1 build did), redirect URL correctly composed with
   prefilled_email + client_reference_id.
3. After deploy: submit a real Basic Reserve form with a test identity →
   verify the intent email lands → land on Stripe checkout → verify email is
   prefilled → **abandon it** → confirm the lead email is the only artefact
   (that's the abandoned-checkout feature working).
4. End-to-end payment test, choose one:
   - Preferred: in Stripe create a one-redemption 100%-off coupon + promo
     code, enable "Allow promotion codes" on the Basic link, pay $0, verify
     the redirect to /thank-you/basic-reserve/ and Stripe's notification
     email, then archive the code and switch promo codes back off.
   - Fallback: pay the real $190 and refund it. Stripe keeps the processing
     fee (~$3.50) on refund — acceptable one-off cost, Nick's call.
5. Update BUILD-NOTES: tick "deposit path moved to Stripe" in the Wix
   retirement checklist once verified; add the "update Stripe redirect URLs
   on domain change" reminder to the cutover section.

## Nick's actions (independent of the build)

1. Stripe → Settings → Business details: **Public business name → Thermal
   Dawn**, and **statement descriptor → THERMAL DAWN** (or closest fit).
   Blocking: customers must not pay "FreeVolt".
2. Confirm each Payment Link's after-payment setting redirects to the matching
   /thank-you/ page (Vercel URL for now).
3. Stripe → Communication preferences: turn ON email notifications for
   successful payments (this replaces a webhook).
4. Optional, for the $0 test: create the 100%-off promo code when asked.

## Out of scope

- Webhooks / payment reconciliation automation (Stripe notification email is
  the mechanism at this volume).
- Any change to the three W1 forms.
- Wix retirement itself (checklist in BUILD-NOTES; this unblocks item 3).
- Installer form (dropped), CRM plumbing (never).

## Reference

- Wix Founder Premium form: `1a6a4edc-a77f-4189-9f1d-540543ebebff` (rev 12)
- Wix Basic Reserve form: `a3b1f997-f65a-4c36-9868-9f880bb1c774` (same field
  set assumed; the port makes the two tiers deliberately identical twins)
- Stripe products: Basic `prod_Uz3rmkvuAuT9br` · Premium `prod_Uz3q4Fqm4irfKB`
- Old Wix T&C page: thermaldawn.com/copy-of-english-privacy-policy
