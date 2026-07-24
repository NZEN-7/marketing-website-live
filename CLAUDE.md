# Thermal Dawn — marketing website

Plain static site (no framework, no build step): 27 pages of hand-written
HTML + one shared CSS file + small vanilla JS. `BUILD-NOTES.md` is the full
build/QA history — read it before big changes. `MISSING-MEDIA.md` tracks
images still to be exported.

## Deploy
- Source of truth: `Thermal-Dawn/marketing-website` (this repo), branch `main`.
- Ship with `npm run deploy:live` — re-stamps HEAD as NZEN-7 and force-pushes
  to the `NZEN-7/marketing-website-live` mirror (Vercel Hobby committer-gate
  workaround). Never edit the mirror directly.
- Vercel project: **marketing-website-live** (static, no build command).
  Preview locally with `npm run serve` → http://localhost:8080 (root-relative
  links don't work over file://).
- `vercel.json` and `netlify.toml` are twins (headers, caching, the 18 legacy
  Wix 301s) — edit one, mirror the other.

## Hard rules
- **Cache busting:** css/js/animations are plain filenames on a 5-min server
  cache, but browsers may hold them — when you edit `style.css` or any js,
  bump the `?v=` query on every reference (see BUILD-NOTES).
- **Netlify Forms don't run on Vercel.** The 5 forms (newsletter, contact,
  register-interest, basic-reserve, founder-premium) 404 on submit until a
  form backend is chosen. Don't launch production traffic here before that.
- **Live savings counter:** elements with `data-live-stat` tick up on scroll
  (`assets/js/live-stats.js`) and pull live fleet totals from the platform:
  `https://thermal-dawn-platform.vercel.app/api/public/stats` (public,
  aggregates only, CORS open). The numbers baked into the HTML are the
  audited fallback — keep them plausible, never invent figures. Fleet keys:
  totalSavedAud/gasAvoidedMj/co2AvoidedKg; first install: fi:savedAud etc.
- **Measured vs draft figures:** `class="draft"` marks numbers awaiting
  publisher sign-off (modelled annual range, lead time). Measured savings
  come from the platform audit — if they look stale, ask the platform side,
  don't guess.
- `homepage-flow-v2.html` is **generated** — never hand-edit; change a source
  and re-run `node assets/animations/build-homepage-anim.js assets/animations`.
- Stripe reserve links are placeholders — real URLs go in `assets/js/config.js`.

## Domains (state as of 24 Jul 2026)
- Live Wix site: thermaldawn.com (untouched until launch).
- This site's Vercel URL: marketing-website-live-*.vercel.app; staging domain
  plan: freevolt.com.au (A 76.76.21.21 apex + www CNAME cname.vercel-dns.com,
  leave MX alone; keep noindex until launch).
- Canonicals/sitemap currently say www.thermaldawn.com.au — domain decision
  (thermaldawn.com vs .com.au) still open; resolve before indexing.
- Portal (separate repo TD-Platform): thermal-dawn-platform.vercel.app.
  td-platform.vercel.app is a STALE alias owned by a lost Vercel account —
  never reference it.
