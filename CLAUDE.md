# Thermal Dawn, marketing website

Plain static site (no framework, no build step): 27 pages of hand-written
HTML + one shared CSS file + small vanilla JS. `BUILD-NOTES.md` is the full
build/QA history, read it before big changes. `MISSING-MEDIA.md` tracks
images still to be exported.

## Deploy
- Source of truth: `Thermal-Dawn/marketing-website` (this repo), branch `main`.
- Ship with `npm run deploy:live`, re-stamps HEAD as NZEN-7 and force-pushes
  to the `NZEN-7/marketing-website-live` mirror (Vercel Hobby committer-gate
  workaround). Never edit the mirror directly.
- Vercel project: **marketing-website-live** (static, no build command).
  Preview locally with `npm run serve` → http://localhost:8080 (root-relative
  links don't work over file://).
- `vercel.json` and `netlify.toml` are twins (headers, caching, the 18 legacy
  Wix 301s), edit one, mirror the other.

## Hard rules
- **Cache busting:** css/js/animations are plain filenames on a 5-min server
  cache, but browsers may hold them, when you edit `style.css` or any js,
  bump the `?v=` query on every reference (see BUILD-NOTES).
- **Forms post to `api/lead.js`** (Vercel function, Google Workspace SMTP,
  `GMAIL_USER`/`GMAIL_APP_PASSWORD` env vars). Newsletter, contact and
  register-interest are live and verified. The email layout is a contract, the
  sales agent parses it, see BUILD-NOTES before editing. **As of 24 Aug 2026 the
  CRM depends on it too**: `Sales +/CRM/` is rebuilt around parsing these emails
  out of Gmail (its August capture gap was recovered from them), and a subscriber
  capture script is being built on the same layout. Changing a field label now
  breaks lead capture, not just the agent, so **run `npm run test:parser` after
  touching `formatNotification()`**: it feeds real generated emails through the
  real CRM parser (`scripts/apps-script/`) and fails on any label drift. When
  the parser changes, re-paste it into the Apps Script project by hand, nothing
  syncs it (`scripts/apps-script/SETUP.md`). All five forms now post here,
  deposits included: they write the lead, then hand off to the Stripe Payment
  Links in `assets/js/config.js`.
- **Every submission also writes a Supabase row** (`recordLead`, project
  **CRM** `skyequfcoejlhzbyipwt`, `ap-southeast-2`). The email is still sent
  FIRST and is the system of record; the insert runs after and can never fail
  the request. Adding a form field means a **migration before the deploy**:
  `leadRow()` writing a column that does not exist makes PostgREST 400 at
  runtime, silently, which is exactly what `npm run test:leadrow` guards.
  `public.leads` is **inbound only** (25 Aug 2026): as-submitted, never edited,
  free text not enums, because coercing raw form input at capture rejects real
  answers instead of recording them. Exactly two columns are human-written,
  `filed_to_contact_id` and `notes`; the workflow lives in `contacts`. A row
  with neither is one nobody has looked at.
- **Live savings counter:** elements with `data-live-stat` tick up on scroll
  (`assets/js/live-stats.js`) and pull live fleet totals from the platform:
  `https://thermal-dawn-platform.vercel.app/api/public/stats` (public,
  aggregates only, CORS open). The numbers baked into the HTML are the
  audited fallback, keep them plausible, never invent figures. Fleet keys:
  totalSavedAud/gasAvoidedMj/co2AvoidedKg; first install: fi:savedAud etc.
- **Measured vs draft figures:** `class="draft"` marks numbers awaiting
  publisher sign-off (modelled annual range, lead time). Measured savings
  come from the platform audit, if they look stale, ask the platform side,
  don't guess.
- `homepage-flow-v2.html` is **generated**, never hand-edit; change a source
  and re-run `node assets/animations/build-homepage-anim.js assets/animations`.
- Stripe Payment Links are live in `assets/js/config.js`. That file is the
  ONLY place a payment URL is written.
- **Redirect sources need both forms, with and without a trailing slash.**
  `trailingSlash: true` normalises the URL before redirects are matched, so a
  bare `/product` never fires. This silently killed all 18 legacy Wix 301s
  until 25 Aug 2026.

## Domains (LAUNCHED on thermaldawn.com, 25 Aug 2026)
- **Live: https://www.thermaldawn.com**, served by Vercel. `www` is canonical;
  the apex 308s to it. Wix is out of the path entirely (apex A ->
  `76.76.21.21`, `www` CNAME -> `cname.vercel-dns.com`).
- The noindex is **off**. Canonicals, og:url, sitemap and robots.txt all say
  `https://www.thermaldawn.com`. They used to say `www.thermaldawn.com.au`,
  which has never had DNS at all.
- **MX/SPF/DMARC still live in the Wix DNS zone.** Google Workspace mail for
  thermaldawn.com depends on them. Never touch them when changing where the
  website points; they have nothing to do with hosting.
- The domain is still REGISTERED through Wix and renews **3 Nov 2026**.
  Transfer out before then (a transfer adds a year). Rebuild the zone at the
  new host and verify it BEFORE the nameservers change: that is the one moment
  in the plan where email is genuinely at risk.
- freevolt.com.au serves this same build and should redirect to
  thermaldawn.com. Host-conditional rules in `vercel.json` did not fire as
  either `:path*` or a regex capture; do it in Vercel's domain settings.
- Search Console: same domain, same property, history retained. Do NOT use
  Change of Address, that is for moving between domains.
- Portal (separate repo TD-Platform): thermal-dawn-platform.vercel.app.
  td-platform.vercel.app is a STALE alias owned by a lost Vercel account -
  never reference it.
