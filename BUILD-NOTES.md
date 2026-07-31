# Thermal Dawn, static site v2 · build notes

A plain static rebuild of the Thermal Dawn website to move off Wix. Semantic HTML + one shared CSS file + minimal vanilla JS. **No framework, no build step**, open it on any static host.

## Visual QA pass (round 3), from the independent render review
Acting on `site-v2-render-review.md`. Rendered again in headless Chromium at 1280px/390px and verified each fix:

- **Intelligence page scrolled horizontally at every width** (page measured 1750px). Root cause: `.draft` had `white-space:nowrap`, so the long FAQ "servers go down" draft answer couldn't wrap and forced a 1468px span. Changed `.draft` to `white-space:normal; overflow-wrap:break-word`. Page is now 1280/390 with no overflow; the FAQ answer wraps.
- **Embedded animations still said "60 kWh Stored"** while the spec/tables say 35 kWh. Round 2 only fixed the two *unembedded* table animations. Now reconciled **all** animation files (homepage, day-night, gas-replacement, thermal-storage-flow) to **35 kWh**.
- **`style.css` was truncated** (cut off mid-line right after `.site-footer{…}`, same Drive-sync race that hit index.html). This wiped the footer column/social rules and trailing utilities, which is why the footer rendered as raw bulleted lists with "FacebookLinkedIn" jammed together. **Restored the full CSS tail** (footer grid/columns/social, `.hide/.pill/.anchor`, mobile media query). Footer now renders as proper columns with separated social links. *(Lesson: after any edit, I now re-verify file tails end correctly, added to the checks below.)*
- **Ghost buttons were dark-on-dark** on photo heroes. Added `.hero .btn--ghost{color:#fff;border-color:#fff}` (+hover). "See How It Works", "Book Free Site Assessment", "Explore the system" etc. are now readable. (Bottom-CTA ghost buttons sit in `.section--dark`, which was already handled.)
- **Home "solar export" chart:** the −$0.01 value label collided with the "2025" axis label. Moved the −$0.01 label above the axis.
- **Proof section (Home §6):** left column was vertically centred against the tall phone, leaving a big gap. Set the split to `align-items:flex-start` so it top-aligns.
- **Animation caption cards crushed 3-across on mobile.** Added a `@media(max-width:560px)` stack rule inside the two embedded animations, cards now stack vertically.
- **Dead CTA inside the comparison-table animation** (`href="#"`) → repointed to `/pre-order/` with `target="_top"` (that animation isn't currently embedded, but fixed for reuse).
- Confirmed (per the reviewer): the "page restarts mid-scroll" ghosting in full-page captures is a screenshot-stitching artifact, not a site bug, not chased.

Re-verified after: 27 pages, 0 broken links, all HTML balanced, CSS braces balanced and file ends cleanly, no `60kWh` anywhere.

## Visual QA pass (round 2), what was fixed
Every page was rendered in headless Chromium at desktop (1280px) and mobile (390px), full-page, and reviewed as images. Fixes made:

- **Animation embeds rendered as empty black voids.** Two of the standalone animations (`gas-replacement-interactive`, `thermal-storage-interactive-flow`) only paint on scroll/interaction and collapsed to voids when embedded; others were embedded at a wrong fixed height (clipping or padding with black). Fixed by: sizing each embed to the animation's real rendered height (with separate mobile heights), centring at the animation's natural width, swapping the two flaky animations for reliable ones (How It Works §2 now shows a product photo; §3 and Hydronic §5 use the day-night / flow-cycle animations that render correctly), and removing the oversized comparison-table embed on Pricing (the static comparison table it duplicated stays). Embeds now used: homepage energy-flow (Home), day-night (Hydronic §2, How It Works §3), flow-cycle (Hydronic §5, How It Works §5). `gas-replacement-interactive` and `thermal-storage-interactive-flow` remain in `/assets/animations/` if you later want to fix their scroll-trigger and re-embed.
- **Hero background had "THERMAL DAWN" baked into the photo**, clashing with the headline. Re-cropped the sunrise image below the wordmark, `hero-sunrise-1920/1200.webp` are now clean.
- **Duplicate "Reserve Your System"** appeared in the desktop nav (the mobile-drawer CTA wasn't hidden on wide screens). Hidden at ≥1000px.
- **Emoji showed as empty "tofu" boxes** (hero proof bar, media placeholders, animation caption) because the self-hosted font has no emoji glyphs. Replaced decorative emoji with inline SVG / plain text, switched the media-placeholder icon to an inline SVG, and added an emoji-font fallback to the font stack.
- **Draft-figure markers overlapped neighbouring text** (an absolutely-positioned "draft" badge). Replaced with a subtle dashed-underline highlight, still obvious, no overlap.
- **index.html had truncated** at the bottom CTA (a Drive-sync race during editing dropped its footer + closing tags). Restored and verified balanced; re-scanned all 34 HTML files, all intact.

Re-verified after fixes: 27 pages, 0 broken internal links, all tags balanced, animations render, forms/thank-you/reserve pages clean on desktop and mobile.


## Why plain static (not Eleventy/Astro)
With only 6 blog posts and ~13 marketing pages, a generator would add tooling overhead for little gain. The shared header/footer are handled by a tiny JS include (`assets/js/site.js`), so there's still a single source of truth for nav/footer without a build step. If the blog grows past ~20–30 posts, revisit a generator then.

## Preview locally
Root-relative links (`/assets/…`, `/hydronic/…`) are used throughout so URLs work at any depth on Netlify. They do **not** resolve over `file://`, so preview with a tiny local server:

```
cd site-v2
python3 -m http.server 8080      # then open http://localhost:8080
```

## Cache busting (IMPORTANT when editing css/js)
`style.css` / `*.js` are plain filenames (not content-hashed), so browsers cache them. Server cache is now short (5 min) for css/js/animations, but **when you edit `style.css` or a js file, bump the `?v=` query on its references across the HTML** (`style.css` is currently `?v=11`; the js files still sit at `?v=8`) so visitors who already cached the old file pick up the change. `site.js` and `config.js` are versioned too, they were missed originally and could serve stale.

Images/fonts keep the **year-long** cache. Either rename the file when you replace one, or version its references: the favicons are replaced in place and carry `?v=` on all three `<link rel="icon">` refs for exactly this reason. **Bump that query whenever the favicon artwork changes** or returning visitors keep the old icon for a year.

## Design system (v5-v7 layers, sitewide 31 Jul 2026)

Three passes, each appended as its own commented block at the foot of
`style.css` rather than editing the v2/v3 rules in place. Read them in order;
later blocks win by source order at equal specificity, which several rules
depend on deliberately.

- **v5, lighter rhythm.** Diffed our computed styles against the live Wix
  homepage: it runs lighter and quieter. h1 dropped from Black 900 to
  ExtraBold 800 and one size step, display tracking tightened to -2.2%,
  and "What's next" was demoted from a second flat-orange band to paper so
  the proof band is the page's only orange moment.
- **v6/v7, accent rationing + two buttons.** From a computed-style teardown
  of tesla.com (their headlines are weight 500, one accent colour, two
  repeated buttons). Kept in our voice, not copied: we stay high-contrast.

**Two buttons, no others.** Every CTA is `btn--primary` (sunrise gradient)
or `btn--ghost` (outline). `btn--dark`, `btn--light`, `btn--flat`,
`btn--blue` and `btn--outline-light` still exist in the CSS but are no
longer used in any page; don't reintroduce them. `btn--rect` is a no-op
(same radius as `.btn`) left in the markup, harmless.

**The secondary button follows its SURFACE, not the page.** This is the
subtle one and it has bitten twice:
- `body.dark .btn--ghost` paints it white. Correct on dark sections, and
  correct on `.section--paper2/paper3` too, because `body.dark` repaints
  *those* with the cocoa gradient.
- Wrong on the surfaces that stay white on every page (`.credstrip`,
  `.showcase`, `.faq-block`) and on flat orange, where white sits at about
  2.2:1. Those are re-inked by name, and each needs `body.dark` in the
  selector to out-specify `body.dark .btn--ghost` (0,3,1 beats 0,2,1).

So: **when you add a new light-on-dark-page surface, add it to that list**,
or any ghost button inside it turns invisible.

**Orange keeps four jobs:** CTAs, heading accent words (`.hl`, `.accent`,
`.h-accent`), the proof numbers (`.figures__v`, `.metric dd`, `.step__n`,
`.tl__label`), and the proof band. It gave up body text, list items,
eyebrows and sub-headings, where it was competing with itself.

**Primary CTA label is "Request a Quote"** (was "Book a Free Site
Assessment"). Prose still describes the free site assessment, because that
is what actually happens; only the buttons and the sentences directly above
them changed. The form key stays `register-interest` and the email contract
is untouched, see Forms below.

## Forms (W1, live 31 Jul 2026)

The three site forms now post to **`api/lead.js`** on Vercel. Wix is no longer
in the path for them. Spec and decision record: `.claude/W1-forms-spec.md`.

- **Transport is Nick's own Google Workspace over SMTP**, deliberately not a
  form/email SaaS: the notification's only recipient is Nick, so customer PII
  never passes through a third-party processor. Needs `GMAIL_USER` and
  `GMAIL_APP_PASSWORD` (a Google **app password**, marked Sensitive) in the
  Vercel env. Revoke from the Google account security page if ever leaked.
- Every submission emails **nickz@thermaldawn.com** in plain text, Reply-To set
  to the customer. Gmail is the intake system of record and the sales agent
  parses these, so **the section headings and field labels in
  `formatNotification()` are a contract**. Don't reword them casually.
- Register Interest also fires the customer autoresponder (Calendly link,
  no Tally). Sent best effort: a failure there is logged, not surfaced, so it
  can't cost a lead.
- Fields were ported verbatim from the live Wix schemas (Forms API), including
  the June revision that added the home-battery question and dropped home-size.
- `npm run test:email` prints all four emails plus rejection cases with no
  credentials and no network. Run it after touching the formatters.
- Spam: honeypot (`website`) plus a 3-second submit-speed trap. Both return a
  success shape so a bot learns nothing.
- **Deposits (W1b, live 31 Jul 2026):** both reserve forms now post to the same
  `/api/lead` and then hand off to Stripe Checkout. **No form on the site posts
  to Wix any more.** Spec: `.claude/W1b-deposits-spec.md`.
  - The lead email fires BEFORE payment and says so on its face ("records the
    form submission... confirm the payment itself in Stripe"). An abandoned
    checkout still leaves a qualified lead. **Stripe is the source of truth for
    money; the email means intent.**
  - Each submission mints a reference (`td-…`) that appears in the email AND is
    passed to Stripe as `client_reference_id`, so a payment can be matched to
    its lead.
  - Payment confirmation arrives via Stripe's own notification email. No
    webhook, deliberately, at this volume.
  - The standalone "pay deposit" buttons are gone from both reserve pages, so
    no route can reach Stripe while skipping the lead email.
  - Payment links live only in `assets/js/config.js`. **The after-payment
    redirect back to /thank-you/ is configured inside Stripe, not the repo, so
    it must be updated in the Stripe dashboard whenever the domain changes.**
  - `/pre-order/terms/` holds the pre-order T&Cs, ported verbatim from Nick's
    text. Legal copy: changes come from Nick, never edited here.

### Wix retirement checklist (do NOT do these until all boxes tick)
1. [x] Form-to-Gmail round trip verified on the Vercel URL (31 Jul 2026).
2. [x] Deposit path moved to Stripe (W1b, 31 Jul 2026). Intent email + Stripe
       hand-off with prefilled email and reference all verified live.
3. [ ] **Stripe public business name still reads "FreeVolt" at checkout**
       (observed 31 Jul). Customers must not pay a brand that no longer
       exists, and the card statement descriptor likely matches. Fix in
       Stripe → Settings → Business details before any real traffic.
4. [ ] One real end-to-end payment verified (100%-off promo code, or pay and
       refund) confirming the /thank-you/ redirect and Stripe's notification.
5. [x] Round trip re-verified on freevolt.com.au (31 Jul 2026): all five
       forms submitted on the new domain, every notification landed in
       Gmail, both deposit intents carried their td- reference into the
       Stripe redirect.
6. [ ] Export all Wix form submissions (~154 across 6 forms) to Drive
       `Sales +/Consumer/CRM/Archive/`, then **delete them from Wix** so
       customer PII doesn't linger in a dormant account.
7. [ ] Downgrade/close the Wix plan.

**Known discrepancies surfaced by the T&C port (Nick to resolve, all legal/
commercial rather than code):**
- T&C clauses 1.2 and 2.1 say Basic Reserve is **$199**; the site, the Stripe
  product and the button all say **$190**.
- T&C is issued by **FreeVolt Pty Ltd trading as Thermal Dawn**, while the site
  footer says **Thermal Dawn Pty Ltd**, same ABN. One of them is wrong.
- T&C gives the refund contact as **nick@thermaldawn.com.au**; the working
  domain is thermaldawn.com and that mailbox is documented as not integrated.

### freevolt.com.au cutover — DONE 31 Jul 2026

Executed same day as the runbook below. GoDaddy's "Create MX records" Gmail
wizard switched the nameservers to ns77/ns78.domaincontrol.com and created
the five Google MX records in one step; the remaining records (A @
76.76.21.21, CNAME www cname.vercel-dns.com, both TXT, DMARC softened from
GoDaddy's default p=quarantine to p=none) were added by hand. Both hostnames
verified in Vercel with SSL, apex 308s to www, noindex header intact.

Still open after the cutover:
- **freevolt.com.au is NOT a domain alias in Google Workspace.** Mail routes
  to Google (MX correct) but Google rejects the recipient: the contact-form
  autoresponder test to nickz@freevolt.com.au bounced "Address not found"
  (31 Jul, 2:01 pm). Fix: admin.google.com → Account → Domains → Manage
  domains → Add a domain → freevolt.com.au as a user alias domain. The
  google-site-verification TXT is already in DNS.
- Stripe after-payment redirect URLs still point at the vercel.app domain
  (runbook step 7).
- Remove freevolt.com.au from Wix → Domains (runbook step 8, safe now).

The "bluehouse6351@gmail.com / John Doe" submissions (31 Jul ~1 pm) were
Nick's own tests — the phone number on the lead is Nick's. Not Wix, no
parallel automation. Mystery closed.

#### Original runbook (kept for reference)

Discovery that changed the plan: **Wix hosts the entire DNS zone**
(nameservers ns2/ns3.wixdns.net). GoDaddy is registrar only and its DNS panel
is inert until the nameservers move. The Google MX records for
nick@freevolt.com.au live inside that Wix zone, so a naive nameserver switch
kills mail unless the records are recreated immediately.

Zone inventory as captured 31 Jul 2026 (everything worth preserving):

| Type | Name | Value | Note |
|---|---|---|---|
| MX | @ | `aspmx.l.google.com` (pri 1) | Google mail, keep |
| MX | @ | `alt1.aspmx.l.google.com` (5) · `alt2` (5) · `alt3` (10) · `alt4` (10) | keep all four |
| TXT | @ | `google-site-verification=LJFNYCH7ofhLyIby-ewU1sqZe5-186YqvVyebgdezMc` | keep |
| TXT | @ | `v=spf1 include:dc-aa8e722993._spfm.freevolt.com.au ~all` | **already broken** — the include target doesn't resolve. Replace with `v=spf1 include:_spf.google.com ~all` |
| — | — | no DMARC, no Google DKIM published | nothing to carry over |

The A records (Wix IPs 185.230.63.x) and `www → cdn1.wixdns.net` CNAME are
what get REPLACED; don't copy those.

Runbook (one sitting, ~15 min active):
1. Vercel → marketing-website-live → Settings → Domains → add
   `freevolt.com.au` and `www.freevolt.com.au` (will show Invalid
   Configuration until step 3 — expected).
2. GoDaddy → freevolt.com.au → DNS → Nameservers → **change to GoDaddy
   defaults**. This detaches the Wix zone.
3. IMMEDIATELY in GoDaddy's now-active DNS Records tab, add:
   - `A @ 76.76.21.21`
   - `CNAME www cname.vercel-dns.com`
   - the five Google MX records from the table above
   - both TXT records (with the fixed SPF)
   Delete any default GoDaddy parking records that conflict.
4. Wait for propagation (minutes to ~1 h; old Wix nameservers keep answering
   for cached resolvers during the overlap, which keeps mail flowing).
5. Vercel shows Valid Configuration and issues SSL automatically.
6. Verify: site over HTTPS on both hostnames, noindex header still present,
   one submission per form on the new domain (closes retirement item 5),
   and send/receive a test mail via nick@freevolt.com.au.
7. Update the two Stripe Payment Link after-payment redirect URLs to the new
   domain (they live in Stripe, not the repo).
8. Housekeeping: remove freevolt.com.au from Wix → Domains once stable.

Rollback: point nameservers back to `ns2.wixdns.net` / `ns3.wixdns.net` and
the old zone (still held by Wix) applies again. thermaldawn.com is untouched
throughout.

### thermaldawn.com launch prep (decided 31 Jul 2026: final domain is thermaldawn.com)

Two launch-gating items beyond the obvious find-replace of canonicals/
sitemap/robots/og:url and removing the noindex header (both tracked in the
Coda Product Backlog, Sales & Web):

1. **Verify the Wix redirect map against the live index before launch.**
   The 18 legacy 301s in `vercel.json`/`netlify.toml` were written from the
   old sitemap, not from what Google actually has. Before indexing turns on,
   diff them against `site:thermaldawn.com` results and Search Console's
   page list; any indexed Wix URL missing from the map 404s and loses its
   equity. Same-domain launch means no site-move processing, so redirect
   coverage is the whole ballgame.
2. **thermaldawn.com is REGISTERED through Wix** (renews 3 Nov 2026), unlike
   freevolt (GoDaddy). Transfer the registration to a normal registrar well
   before the Wix plan is cancelled, or the primary domain ends up living in
   a wound-down account. The launch DNS cutover is the same MX-preserving
   dance as freevolt's (inventory zone first; Google MX for
   nickz@thermaldawn.com lives in Wix DNS).

Also at launch: pick www vs apex to match whatever form Google has indexed,
301 the other to it, and 301 freevolt.com.au across rather than leaving it
serving content.

## Deploy to Vercel (current path)
`vercel.json` twins `netlify.toml` (same caching, security headers, and 301 map), **keep the two in sync** when editing either. Deploys go via `npm run deploy:live`, which re-stamps HEAD as NZEN-7 and force-pushes to `NZEN-7/marketing-website-live` (Vercel Hobby committer-gate workaround, same as TD-Platform). ⚠ **Netlify Forms do NOT run on Vercel**, the 5 forms (`newsletter`, `contact`, `register-interest`, `basic-reserve`, `founder-premium`) submit into a 404 there. Fine for staging; a form backend is required before production traffic moves to Vercel.

## Deploy to Netlify
- **Drag-and-drop:** drop the whole `site-v2` folder onto the Netlify dashboard.
- **CLI:** `netlify deploy --dir=site-v2 --prod`
- `netlify.toml` is included: asset caching, security headers, and **301 redirects** from the old Wix URLs (`/hydronic-overview`, `/how-it-works`, `/pricing`, `/pre-order-form`, `/register`, `/contact-form`, `/post/<slug>`, …) to the new paths.
- **Forms:** all forms use **Netlify Forms** (`data-netlify="true"` + hidden `form-name` + a honeypot `bot-field`). Netlify auto-detects them on deploy, no config needed. Form names: `newsletter`, `contact`, `register-interest`, `basic-reserve`, `founder-premium`. Each redirects to its own thank-you page.
- Set the production domain to `www.thermaldawn.com.au` (canonical/OG tags and `sitemap.xml` use that host, change them if the domain differs).

## Pages (all built)
Home · Hydronic · Hydronic → How It Works · Hydronic → Pricing · Intelligence · Mission · Contact · Pre-order (tiers) · Register Interest · Basic Reserve · Founder Premium · Blog index · 6 blog posts · 4 "coming soon" blog stubs · 4 thank-you pages · 404. **27 pages total.**

## Verification done
- **Link check (automated):** crawled all 27 pages, **0 broken internal links**, every asset resolves. Only intentional placeholders remain (the two Stripe anchors).
- **Structure check:** every page has exactly one `<h1>`, a unique `<title>` + meta description, canonical, OG tags, the header/footer includes, and balanced structural tags.
- **Content check:** no editorial notes leaked through (`[KEEP]`/`[CHANGED]` tags, "Change notes", "Open items" all absent); no `FreeVolt` in customer-facing copy; no `$199` (all `$190`); no `50kWh` (all `35kWh`).
- **JS:** `site.js` and `config.js` pass `node --check`.
- **Animations:** all 7 are self-contained and load via `<iframe>`; 6 are embedded in pages (see below).
- **Not done:** no live browser/Lighthouse run was possible in this environment, please spot-check in a browser after the first deploy (the local-server command above is enough).

## Stripe (no Payment Links yet)
We don't have Stripe Payment Links. The reserve buttons are normal `<a>` links to placeholder anchors `#STRIPE-BASIC-RESERVE` / `#STRIPE-FOUNDER-PREMIUM`, wired via `data-stripe`. **To go live, edit one file**, `assets/js/config.js`, and paste the two real `buy.stripe.com` URLs. Every reserve button (on the reserve pages and their thank-you pages) updates automatically.

## Draft figures (verify before publishing)
Per your steer, unverified numbers from the copy are shown with a small blue **"draft"** marker (`.draft`) so they're easy to find:
- Week-one: `~$60` saved · `~1,000 MJ` gas avoided · `~55 kg` CO₂ (Home, Hydronic, Mission, case study)
- Annualised: `~$3,000` / `~2.9 tonnes` CO₂
- Locked savings figure default: **`$800–$1,500/yr`** (Hydronic §3 + FAQ, referenced on Pricing), confirm against current modelling and it will propagate.
- Lead time: `6–10 weeks` (How It Works §10), keep current.
- Intelligence FAQ "what if servers go down" answer is marked draft (pending engineering confirmation of local-vs-cloud behaviour).

Search the source for `class="draft"` to find them all.

## Typos / label fixes made (per your "fix obvious typos, note them" instruction)
- **"How did you hear about FreeVolt?"** → **"How did you hear about us?"** on the Register Interest form (the copy explicitly flagged this rebrand fix).
- No other copy was altered. All internal editorial notes, section tags, and "Open items" checklists were omitted from the rendered pages (they're guidance, not website copy).

## Conversion review, actioned, and what still needs you

Actioned:
- **Hero leads on gas, not lithium.** "Your Gas Boiler Is the Problem. Your Roof
  Is the Answer." Title/description/OG updated to match. The lithium comparison
  now lives in the economics sections rather than the headline.
- **CTA hierarchy flipped sitewide.** *Book a Free Site Assessment* is primary;
  *Reserve Your System* is the secondary fast-lane for the convinced. Deep
  bottom-of-page CTAs still lead with Reserve, which is the right moment for it.
- **Price anchor added** to the homepage, above the fold-ish, built only from
  figures already in the repo.
- **Chart source lines** added under both price charts.
- **Type hierarchy.** Almost everything sat at 800–900. Chrome steps down to
  700–800; the proof figures keep 900 so they actually pop.
- **Background rhythm calmed.** The founder video moved up to sit right after
  the proof band and is now on white, so proof → founder → quote/photos is a
  quiet stretch and the orange bands read as accents.
- **Tier naming.** "Tier 1, Basic Reserve" → "Basic Reserve"; the Founder
  Premium maths moved out of a mid-bullet into a side-by-side compare table.

Still needs you:
- **A real price.** The anchor says "well below both" because there is no signed-off
  number. Analytical buyers want "from $X installed", swap it in and delete the
  `draft` note on that line.
- **Verify the chart figures.** The source lines credit AER / Solar Victoria, but
  the −$0.01 FiT and $0.35/kWh values are still the originals and are marked
  `draft`. Confirm against the actual publications before indexing.
- **Partner logos** (Startmate, Cicada, NSW OCSE, Investment NSW), still plain
  text spans. Needs permission from each. See MISSING-MEDIA.md.
- **A human face higher up.** The founder video is now mid-page, but the About
  portrait is still a placeholder and there is no face above the fold.
- **A/B testing the hero** was suggested; there is no experiment tooling on this
  static site, so the gas-led hero shipped as the single variant. Needs a tool
  decision (e.g. Vercel edge middleware) if you want a real split test.

## Overnight polish run (29 Jul 2026)

- **Real photos wired in** from `Design/Photos`: founder stage shot (About, Home),
  wide Demo Day + team-at-Hornsby shots (Mission), the June app home screen
  (Intelligence), and the finished **second install** (Home mosaic + Hydronic
  proof). Copy now mentions install two. All converted to WebP via sharp.
- **Partner logos are live**, fetched from each org's own site (see
  `assets/img/partners/README.md` for sources); NSW lockups composed from the
  official waratah per NSW co-branding. Swap for official lockup files if the
  orgs supply them.
- **Em dashes removed sitewide** (copy, meta, animations, docs), contextual
  commas/colons/periods, not blind replacement.
- **noindex staging guard** added (see launch checklist below).
- Cache-buster now `?v=6`.

## Decisions the copy left open (for you, not blocking)
These are flagged in the source markdown's "Open items" and carried here so they don't get lost:
- Public contact address is now **Hornsby, NSW 2077** (footer + Contact page), per Nick. Still needs the **unit/street number**, currently suburb-level only; both spots carry a `TODO`.
- Confirm Mike & Kay can be named + quote reproduced publicly.
- **Site now serves `X-Robots-Tag: noindex` on every page** (vercel.json + netlify.toml twins), per the "keep noindex until launch" staging plan. **Remove both at launch** or the real domain will never index.
- Confirm the legal entity name for the footer (currently "© Thermal Dawn, ABN 47 682 866 913").
- Confirm canonical booking path: `/register` (→ Register Interest) vs `/contact`. Currently all "Book a site assessment" CTAs point to Register Interest.
- Mission team section: founder-only (as built) vs a named team strip.
- Missing media + the FreeVolt chart re-export, see `MISSING-MEDIA.md`.

## Animations
Embedded via `<iframe>` (kept as standalone HTML so their JS still runs):
- **`homepage-flow-v2.html`** → Home, Hydronic, How It Works. This is a
  **generated** file: `build-homepage-anim.js` splices the v2 scene out of
  `thermal-dawn-flow-v2.html` (from TD-Platform) into the shell from
  `homepage_web_animation_new.html` (With/Without Storage toggle, day/night
  buttons, timer bar, three explainer cards). Don't hand-edit it, change a
  source and re-run:
  `node assets/animations/build-homepage-anim.js assets/animations`
- `thermal-dawn-flow-v2.html` → the scene on its own. Still works unmodified
  inside Home Assistant (the postMessage bridge is untouched); on the web it
  self-drives, and `?controls=1` exposes a mode/time/weather control bar.
- `day-night-storage-animation.html` → Hydronic §2 + How It Works §3
- `heating-comparison-table.html` → Pricing §10
- **`heating-tool.html` is available but not embedded**, it's an interactive savings tool; drop it onto Pricing or Hydronic if you want it.

### Outstanding, grid-heating flow is switched off
In the homepage animation, the **night + without-storage** scenario draws no
flow lines. It reused the store-to-home pipework recoloured red, which read
badly: the energy appeared to pour out of a thermal store that isn't there in
that scenario. It needs its own geometry (grid → heat pump → home) drawn into
the v2 scene. The scenario still reads correctly via the heading, the "Grid
heating" chip, the red heat-pump ring and the highlighted card, only the
animated line is missing.
Re-enable with one line once the path exists:
`SHOW_GRID_HEATING_FLOW = true` in `build-homepage-anim.js`, then rebuild.
- Fixed **50kWh → 35kWh** in the two animations that displayed the old capacity label (`heating-comparison-table.html`, `heating-tool.html`) to match the locked spec. `web_animation_old.html` was ignored per brief.

## Housekeeping
- Two preview thumbnails (`sheet_build.jpg`, `sheet_misc.jpg`) and two temp OG-build files (`assets/img/_ogbg.png`, `assets/img/_oglogo.png`) got locked by Google Drive sync and couldn't be deleted from here. **Please delete these four files** before deploying (they're unused and just add weight). Everything else in the folder is intentional.

## Tech quick-reference
- Fonts: Montserrat self-hosted as WebFont2 (`assets/fonts/*.woff2`, 6 weights, ~59 KB each, `font-display:swap`, preloaded Black + Regular). No render-blocking Google Fonts.
- Colours/spacing: CSS custom properties at the top of `assets/css/style.css`, taken from the CI guide (primary `#f4921d`/`#eda81d`, sunrise gradient, near-black `#1d1e1c`, blue `#3dafe5` used sparingly).
- Logo variant swaps by background (black logo on light header, white logo in dark footer).
- Images: WebP, sized for web, `loading="lazy"` below the fold, hero uses `fetchpriority="high"`.
- SEO: unique title/description per page, canonical, OpenGraph + Twitter card, `sitemap.xml`, `robots.txt`. Blog stubs and thank-you/404 pages are `noindex`.
