# Pages and content

## The page map

| URL | What it is | Indexed |
|---|---|---|
| `/` | Home: the pitch, the flow animation, proof band, live savings, cost comparison, partners | yes |
| `/hydronic/` | The product for hydronic homes | yes |
| `/hydronic/how-it-works/` | The system explained; before/after animation; the quote-to-first-winter path | yes |
| `/hydronic/pricing/` | Why no list price, what is included, deposit FAQ | yes |
| `/intelligence/` | The control layer and the app; the day-as-planned animation; phone render | yes |
| `/mission/` | Why the company exists | yes |
| `/blog/` and 11 posts | Long-form articles | index yes; **six posts are `noindex`** pending sign-off |
| `/contact/` | Two paths (quote or book) and the contact form | yes |
| `/pre-order/` | The booking hub: one $990 refundable deposit | yes |
| `/pre-order/booking/` | The booking form, then Stripe | yes |
| `/pre-order/register-interest/` | Request a quote (the primary CTA in the header) | yes |
| `/pre-order/terms/` | Booking Terms and Conditions, verbatim | yes |
| `/pre-order/basic-reserve/` | The legacy $190 path. Unlinked, `noindex`, out of the sitemap, still working by direct link | no |
| `/thank-you/`, `/thank-you/registered/`, `/thank-you/founder-premium/`, `/thank-you/basic-reserve/` | Post-submit pages; Stripe returns to the last two | no |
| `/404.html` | Not found | no |

`sitemap.xml` and `robots.txt` are hand-maintained. Canonicals and `og:url`
say `https://www.thermaldawn.com` everywhere.

## Copy rules that are not stylistic

- **`/pre-order/terms/` is legal copy, pasted verbatim from Nick.** Never
  reworded; flag, don't fix. The only thing on that page not in his source file
  is the publication date, which clauses 1 and 7 turn on.
- **The savings figures are derived, not measured.** The platform computes
  them from fleet telemetry and a costing method (gas avoided at a tariff),
  and the numbers baked into `data-live-stat` elements are the audited
  fallback for that derivation. If one looks stale, ask the platform side.
  Never substitute a plausible number, and do not call them "measured" in
  copy: the meter readings are measured; the dollars are derived.
- **`class="draft"`** marks a figure awaiting publisher sign-off (the modelled
  annual range, the lead time). It renders visibly different so nobody mistakes
  it for a claim.
- No rebates, subsidies or VEU are mentioned anywhere; no $/kWh in blog tables;
  the pre-certification position is not explained on the site. These were
  Nick's calls and they stand.
- The deposit is one **$990 refundable booking deposit, inc GST**, since
  24 Sep 2026. No page mentions a $190 offer or a Founder tier.

## The shared chrome

`site.js` injects the header (logo, nav with a hydronic sub-menu, the
"Request a Quote" CTA, mobile toggle) and the footer (columns, social, year)
into every page at load. Editing the nav means editing `site.js` once, then
bumping its `?v=` on all 28 pages.

## Embedded interactives

| Animation | Embedded on | Notes |
|---|---|---|
| `homepage-flow-v2.html` | `/`, `/hydronic/`, `/hydronic/how-it-works/` | **Generated.** Never hand-edit; change `thermal-dawn-flow-v3-marketing.html` or the shell `homepage_web_animation_new.html`, then `node assets/animations/build-homepage-anim.js assets/animations` and commit builder and output together |
| `hydronic-before-after.html` | `/hydronic/how-it-works/`, `/hydronic/pricing/` | Same pipes, new heat source; hand-edited |
| `intelligence-day.html` | `/intelligence/` | One day as the controller planned it; hand-edited |
| YouTube (`youtube-nocookie`) | `/`, `/hydronic/how-it-works/`, `/mission/` | Two videos |

The other files in `assets/animations/` (`thermal-dawn-flow-v3.html`,
`-v2`, `-cycle`, `day-night-storage-animation.html`, `heating-tool.html`,
`heating-comparison-table.html`) are sources, earlier versions or unembedded
tools. The `-v3` scene is the platform's; the `-marketing` variant is the
derived scene the homepage build consumes.

Every embedded animation posts `td:frameHeight` to the parent on load and on
state change; `site.js` sets the iframe height from it. Do not animate the
width of any iframe ancestor, and do not hide one with `display:none`, or the
height never arrives. All three self-host their fonts; none fetches Google
Fonts.

## Images

`assets/img/` holds about 40 files plus 13 partner logos (provenance in
`assets/img/partners/README.md`). Because the folder is cached for a year, a
changed image ships under a new name. The phone render on the home and
intelligence pages (`hp-proof-phone-v3.png`) is composed by
`scripts/compose-phone-mockup.ps1` from a real app screenshot; see
[checks-and-tooling.md](checks-and-tooling.md).

`MISSING-MEDIA.md` lists the images the copy still references that have not
been exported.

## Reviewing copy

Copy lives inside the HTML and only about 38% of those bytes are words, so
reviews work from a generated pack: `npm run copy:dump` writes
`.claude/copy-review/INDEX.md` plus one file per page with a `path:line` on
every block. Reviewers report findings as `path:line`, current text, proposed
replacement, into a dated folder under `feedback/`; nobody edits pages
directly. `feedback/REVIEWER-PROMPT.md` is the prompt to hand a reviewer, and
the `copy-review` skill in `.claude/skills/` runs a review from inside a
session.
