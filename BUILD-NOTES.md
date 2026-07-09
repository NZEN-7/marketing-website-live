# Thermal Dawn — static site v2 · build notes

A plain static rebuild of the Thermal Dawn website to move off Wix. Semantic HTML + one shared CSS file + minimal vanilla JS. **No framework, no build step** — open it on any static host.

## Visual QA pass (round 3) — from the independent render review
Acting on `site-v2-render-review.md`. Rendered again in headless Chromium at 1280px/390px and verified each fix:

- **Intelligence page scrolled horizontally at every width** (page measured 1750px). Root cause: `.draft` had `white-space:nowrap`, so the long FAQ "servers go down" draft answer couldn't wrap and forced a 1468px span. Changed `.draft` to `white-space:normal; overflow-wrap:break-word`. Page is now 1280/390 with no overflow; the FAQ answer wraps.
- **Embedded animations still said "60 kWh Stored"** while the spec/tables say 35 kWh. Round 2 only fixed the two *unembedded* table animations. Now reconciled **all** animation files (homepage, day-night, gas-replacement, thermal-storage-flow) to **35 kWh**.
- **`style.css` was truncated** (cut off mid-line right after `.site-footer{…}` — same Drive-sync race that hit index.html). This wiped the footer column/social rules and trailing utilities, which is why the footer rendered as raw bulleted lists with "FacebookLinkedIn" jammed together. **Restored the full CSS tail** (footer grid/columns/social, `.hide/.pill/.anchor`, mobile media query). Footer now renders as proper columns with separated social links. *(Lesson: after any edit, I now re-verify file tails end correctly — added to the checks below.)*
- **Ghost buttons were dark-on-dark** on photo heroes. Added `.hero .btn--ghost{color:#fff;border-color:#fff}` (+hover). "See How It Works", "Book Free Site Assessment", "Explore the system" etc. are now readable. (Bottom-CTA ghost buttons sit in `.section--dark`, which was already handled.)
- **Home "solar export" chart:** the −$0.01 value label collided with the "2025" axis label. Moved the −$0.01 label above the axis.
- **Proof section (Home §6):** left column was vertically centred against the tall phone, leaving a big gap. Set the split to `align-items:flex-start` so it top-aligns.
- **Animation caption cards crushed 3-across on mobile.** Added a `@media(max-width:560px)` stack rule inside the two embedded animations — cards now stack vertically.
- **Dead CTA inside the comparison-table animation** (`href="#"`) → repointed to `/pre-order/` with `target="_top"` (that animation isn't currently embedded, but fixed for reuse).
- Confirmed (per the reviewer): the "page restarts mid-scroll" ghosting in full-page captures is a screenshot-stitching artifact, not a site bug — not chased.

Re-verified after: 27 pages, 0 broken links, all HTML balanced, CSS braces balanced and file ends cleanly, no `60kWh` anywhere.

## Visual QA pass (round 2) — what was fixed
Every page was rendered in headless Chromium at desktop (1280px) and mobile (390px), full-page, and reviewed as images. Fixes made:

- **Animation embeds rendered as empty black voids.** Two of the standalone animations (`gas-replacement-interactive`, `thermal-storage-interactive-flow`) only paint on scroll/interaction and collapsed to voids when embedded; others were embedded at a wrong fixed height (clipping or padding with black). Fixed by: sizing each embed to the animation's real rendered height (with separate mobile heights), centring at the animation's natural width, swapping the two flaky animations for reliable ones (How It Works §2 now shows a product photo; §3 and Hydronic §5 use the day-night / flow-cycle animations that render correctly), and removing the oversized comparison-table embed on Pricing (the static comparison table it duplicated stays). Embeds now used: homepage energy-flow (Home), day-night (Hydronic §2, How It Works §3), flow-cycle (Hydronic §5, How It Works §5). `gas-replacement-interactive` and `thermal-storage-interactive-flow` remain in `/assets/animations/` if you later want to fix their scroll-trigger and re-embed.
- **Hero background had "THERMAL DAWN" baked into the photo**, clashing with the headline. Re-cropped the sunrise image below the wordmark — `hero-sunrise-1920/1200.webp` are now clean.
- **Duplicate "Reserve Your System"** appeared in the desktop nav (the mobile-drawer CTA wasn't hidden on wide screens). Hidden at ≥1000px.
- **Emoji showed as empty "tofu" boxes** (hero proof bar, media placeholders, animation caption) because the self-hosted font has no emoji glyphs. Replaced decorative emoji with inline SVG / plain text, switched the media-placeholder icon to an inline SVG, and added an emoji-font fallback to the font stack.
- **Draft-figure markers overlapped neighbouring text** (an absolutely-positioned "draft" badge). Replaced with a subtle dashed-underline highlight — still obvious, no overlap.
- **index.html had truncated** at the bottom CTA (a Drive-sync race during editing dropped its footer + closing tags). Restored and verified balanced; re-scanned all 34 HTML files — all intact.

Re-verified after fixes: 27 pages, 0 broken internal links, all tags balanced, animations render, forms/thank-you/reserve pages clean on desktop and mobile.


## Why plain static (not Eleventy/Astro)
With only 6 blog posts and ~13 marketing pages, a generator would add tooling overhead for little gain. The shared header/footer are handled by a tiny JS include (`assets/js/site.js`), so there's still a single source of truth for nav/footer without a build step. If the blog grows past ~20–30 posts, revisit a generator then.

## Preview locally
Root-relative links (`/assets/…`, `/hydronic/…`) are used throughout so URLs work at any depth on Netlify. They do **not** resolve over `file://`, so preview with a tiny local server:

```
cd site-v2
python3 -m http.server 8080      # then open http://localhost:8080
```

## Deploy to Netlify
- **Drag-and-drop:** drop the whole `site-v2` folder onto the Netlify dashboard.
- **CLI:** `netlify deploy --dir=site-v2 --prod`
- `netlify.toml` is included: asset caching, security headers, and **301 redirects** from the old Wix URLs (`/hydronic-overview`, `/how-it-works`, `/pricing`, `/pre-order-form`, `/register`, `/contact-form`, `/post/<slug>`, …) to the new paths.
- **Forms:** all forms use **Netlify Forms** (`data-netlify="true"` + hidden `form-name` + a honeypot `bot-field`). Netlify auto-detects them on deploy — no config needed. Form names: `newsletter`, `contact`, `register-interest`, `basic-reserve`, `founder-premium`. Each redirects to its own thank-you page.
- Set the production domain to `www.thermaldawn.com.au` (canonical/OG tags and `sitemap.xml` use that host — change them if the domain differs).

## Pages (all built)
Home · Hydronic · Hydronic → How It Works · Hydronic → Pricing · Intelligence · Mission · Contact · Pre-order (tiers) · Register Interest · Basic Reserve · Founder Premium · Blog index · 6 blog posts · 4 "coming soon" blog stubs · 4 thank-you pages · 404. **27 pages total.**

## Verification done
- **Link check (automated):** crawled all 27 pages — **0 broken internal links**, every asset resolves. Only intentional placeholders remain (the two Stripe anchors).
- **Structure check:** every page has exactly one `<h1>`, a unique `<title>` + meta description, canonical, OG tags, the header/footer includes, and balanced structural tags.
- **Content check:** no editorial notes leaked through (`[KEEP]`/`[CHANGED]` tags, "Change notes", "Open items" all absent); no `FreeVolt` in customer-facing copy; no `$199` (all `$190`); no `50kWh` (all `35kWh`).
- **JS:** `site.js` and `config.js` pass `node --check`.
- **Animations:** all 7 are self-contained and load via `<iframe>`; 6 are embedded in pages (see below).
- **Not done:** no live browser/Lighthouse run was possible in this environment — please spot-check in a browser after the first deploy (the local-server command above is enough).

## Stripe (no Payment Links yet)
We don't have Stripe Payment Links. The reserve buttons are normal `<a>` links to placeholder anchors `#STRIPE-BASIC-RESERVE` / `#STRIPE-FOUNDER-PREMIUM`, wired via `data-stripe`. **To go live, edit one file** — `assets/js/config.js` — and paste the two real `buy.stripe.com` URLs. Every reserve button (on the reserve pages and their thank-you pages) updates automatically.

## Draft figures (verify before publishing)
Per your steer, unverified numbers from the copy are shown with a small blue **"draft"** marker (`.draft`) so they're easy to find:
- Week-one: `~$60` saved · `~1,000 MJ` gas avoided · `~55 kg` CO₂ (Home, Hydronic, Mission, case study)
- Annualised: `~$3,000` / `~2.9 tonnes` CO₂
- Locked savings figure default: **`$800–$1,500/yr`** (Hydronic §3 + FAQ, referenced on Pricing) — confirm against current modelling and it will propagate.
- Lead time: `6–10 weeks` (How It Works §10) — keep current.
- Intelligence FAQ "what if servers go down" answer is marked draft (pending engineering confirmation of local-vs-cloud behaviour).

Search the source for `class="draft"` to find them all.

## Typos / label fixes made (per your "fix obvious typos, note them" instruction)
- **"How did you hear about FreeVolt?"** → **"How did you hear about us?"** on the Register Interest form (the copy explicitly flagged this rebrand fix).
- No other copy was altered. All internal editorial notes, section tags, and "Open items" checklists were omitted from the rendered pages (they're guidance, not website copy).

## Decisions the copy left open (for you — not blocking)
These are flagged in the source markdown's "Open items" and carried here so they don't get lost:
- Confirm public contact address (**Lane Cove West** vs **Hornsby**) — currently rendered as written (Lane Cove West).
- Confirm Mike & Kay can be named + quote reproduced publicly.
- Confirm the legal entity name for the footer (currently "© Thermal Dawn, ABN 47 682 866 913").
- Confirm canonical booking path: `/register` (→ Register Interest) vs `/contact`. Currently all "Book a site assessment" CTAs point to Register Interest.
- Mission team section: founder-only (as built) vs a named team strip.
- Missing media + the FreeVolt chart re-export — see `MISSING-MEDIA.md`.

## Animations
Embedded via `<iframe>` (kept as standalone HTML so their JS still runs):
- `homepage_web_animation_new.html` → Home §5 (with/without storage)
- `day-night-storage-animation.html` → Hydronic §2
- `thermal-storage-interactive-flow.html` → Hydronic §5 + How It Works §3
- `gas-replacement-interactive.html` → How It Works §2
- `thermal-dawn-flow-cycle.html` → How It Works §5
- `heating-comparison-table.html` → Pricing §10
- **`heating-tool.html` is available but not embedded** — it's an interactive savings tool; drop it onto Pricing or Hydronic if you want it.
- Fixed **50kWh → 35kWh** in the two animations that displayed the old capacity label (`heating-comparison-table.html`, `heating-tool.html`) to match the locked spec. `web_animation_old.html` was ignored per brief.

## Housekeeping
- Two preview thumbnails (`sheet_build.jpg`, `sheet_misc.jpg`) and two temp OG-build files (`assets/img/_ogbg.png`, `assets/img/_oglogo.png`) got locked by Google Drive sync and couldn't be deleted from here. **Please delete these four files** before deploying (they're unused and just add weight). Everything else in the folder is intentional.

## Tech quick-reference
- Fonts: Montserrat self-hosted as WebFont2 (`assets/fonts/*.woff2`, 6 weights, ~59 KB each, `font-display:swap`, preloaded Black + Regular). No render-blocking Google Fonts.
- Colours/spacing: CSS custom properties at the top of `assets/css/style.css`, taken from the CI guide (primary `#f4921d`/`#eda81d`, sunrise gradient, near-black `#1d1e1c`, blue `#3dafe5` used sparingly).
- Logo variant swaps by background (black logo on light header, white logo in dark footer).
- Images: WebP, sized for web, `loading="lazy"` below the fold, hero uses `fetchpriority="high"`.
- SEO: unique title/description per page, canonical, OpenGraph + Twitter card, `sitemap.xml`, `robots.txt`. Blog stubs and thank-you/404 pages are `noindex`.
