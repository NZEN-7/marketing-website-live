# Design and polish pass, 6 Sept 2026

Branch `design/polish-pass`, 15 commits, not deployed. No copy changed, no
number changed, `pre-order/terms/` untouched, no new dependencies.

Ratios below are WCAG 2.1, computed in the browser against the real composited
backdrop, not estimated. "Bar" is 4.5 for body text, 3.0 for large (>=24px, or
>=18.66px at weight >=700).

---

## A. Readability and contrast

### The two decisions

**The orange band gives up white text, not its colour.** White on `#f5860f` is
2.53:1. There is no version of "white on orange" that passes: white body copy
needs a surface at or below 0.183 luminance, which is `#b85700`, a brown. The
lightest orange at the band's own hue that clears 3:1 for the *heading alone*
is `#d77409`, and it still cannot carry the paragraphs. So the text moved. The
band was already half-inked anyway: the `.lede` line under the heading was ink,
and the homepage is `body.home` so its band copy was ink already. Only the dark
pages painted white.

**`--td-orange-ink` split in two.** It was carrying accent text at every size on
light surfaces and only ever cleared the large-text bar. At body size it needed
4.5 and did not have it. `--td-orange-ink` deepens to `#ad6b00` for display
figures; `--td-orange-text` `#ad5700` is new, for body-size accent text on
light. It is the lightest orange that clears 4.5 on all three light surfaces
while staying 3.30 against body ink, so a link is still distinguishable without
underlining it.

### Contrast table, before and after

| Surface | Element | Before | After | Bar | Where |
|---|---|---|---|---:|---|
| `#f5860f` band | `h2` | **2.53** | **7.11** | 3.0 | home, intelligence |
| `#f5860f` band | body copy (2 paragraphs) | **2.53** | **7.11** | 4.5 | intelligence |
| `#f5860f` band | `.h-accent` (inline white) | **2.53** | **7.11** | 3.0 | intelligence |
| `#f5860f` band | `.figures__v` label | **2.53** | **7.11** | 4.5 | intelligence |
| `#f5860f` band | `.micro` | **3.87** | **5.78** | 4.5 | home |
| cream `#fdf7ef` | `.live-dot` | **1.28** | **4.99** | 4.5 | home |
| cream `#fdf7ef` | `.applist strong` | **3.29** | **4.76** | 4.5 | intelligence |
| cream `#fdf7ef` | `.proof-stat` | 3.30 | **4.04** | 3.0 | home |
| cream `#fdf7ef` | `.metric dd` | 3.30 | **4.04** | 3.0 | home |
| white `.faq-block` | `a` | **2.10** | **5.07** | 4.5 | hydronic ×3 |
| white `.faq-block` | `strong` | **1.23** | **9.18** | 4.5 | hydronic ×2 |
| white `.faq-block` | `em` | **1.70** | inherit | 4.5 | hydronic |
| white `.faq-block` | `.lead` | **1.44** | 12.82 | 4.5 | latent |
| white `.faq-block` | `.statement` | **1.00** | 16.7 | 3.0 | latent |
| sunrise deep stop | `.card--orange` h3 + copy | **4.18** | **5.15** | 4.5 | pricing |
| HA blue `#18BCF2` | `.plogo__txt` | **2.21** | **6.68** | 4.5 | intelligence |
| `#15100c` | `.tier__price small` | **3.48** | **6.55** | 4.5 | pre-order |
| `#1d1e1c` | `.micro` on `.section--dark` | **3.09** | **5.80** | 4.5 | home |
| `#100c09` | `.embed__cap` | **3.59** | **6.75** | 4.5 | 3 pages |
| white | base link `a` | **3.50** | **5.07** | 4.5 | home |
| paper-2 | `.field .req` | **3.19** | **4.62** | 4.5 | home |
| white | `.step p`/`.tl p`/`.benefits p` | **2.17** | 9.35 | 4.5 | latent |

Inside `hydronic-before-after.html`, where the faded group carries `opacity:.85`
so every alpha is multiplied by 0.85:

| Element | Before | After | Bar |
|---|---:|---:|---:|
| faded sub-label | **3.21** | **5.20** | 4.5 |
| faded box outline | **2.04** | **3.21** | 3.0 (control boundary) |
| faded icon stroke | 3.53 | 4.11 | 3.0 |

### Measure

`--measure` is **50ch**, and the number matters. Montserrat's `ch` unit is
11.73px at 16.5px body, but its average prose character is 7.87px, so one `ch`
is 1.49 characters here. The obvious `64ch for about 75 characters` would have
been **95** and made every prose column *wider* than the 91 it already was.
Measured in-browser instead: 50ch = 587px = 75 characters.

| Container | Before | After |
|---|---:|---:|
| blog and terms body copy | 91 | **75** |
| blog opening paragraph (18.4px) | 78 | **75** |
| `pre-order` callout, the worst on the site | 130 | **74** |
| FAQ answers | 119 | **75** |
| FAQ questions (uncapped) | 110 | **75** |
| embed captions (uncapped) | 155 | **75** |

The old 70ch guard only reached direct `<p>` children of `.wrap` on `body.dark`
pages, so it missed the light page, anything wrapped in a `div`, and the
callouts. `.article` keeps its 760px so tables and images are unaffected; only
its paragraphs take the measure. Five inline `max-width:*ch` patches folded into
a `.measure` utility.

`.lead` goes 1.05rem to 1.125rem. At 16.8px against a 16.5px body it was 0.3px
larger than the paragraph it introduces, which is not a lede.

---

## B. Hierarchy

**Proof band.** Four things competed: a 43.2px white heading, the 39.2px stat
that carries the claim, three 30.4px totals whose combined weight beat the
single stat, and the phone. Reading order is now stat 39.2, heading 36.8 (ink),
totals 24.8, sub-heading 16.8. The arrow between label and value was drawn at
900 and full size, giving each row two heavy marks; it is punctuation now.
`.proof-home` gave up 900-weight orange for 700 ink, since v7 already decided
sub-headings are not one of the four jobs the accent keeps.

**Cost block.** The bare `+` and `=` operators were 23.2px at weight 900, three
and a half pixels **larger** than the dollar figures they joined, so the
typographic accent landed on punctuation. Now 18.4 at 400. The two costs step
back to 700 and the answer keeps 900, so the card with the orange keyline wins
on weight as well as colour. The rhetorical heading above the block comes down
from 24.8 to 19.2; it was set larger than every price under it.

**`.figures__v`** goes 18.4px to 28-33.6px. The three hardest specs on
how-it-works were 1.6px larger than the paragraph beside them while the h2 in
the same split was 36.8. Two pages were also using the class as a plain bold
label with no number attached, overriding its colour inline to get there; those
move to `.list-label` with identical words.

**Tables** get `data--win` for the column that is the answer. Every cell was 400
including the winning one, under a solid orange header row that was the loudest
thing in the section.

**Inline live stats.** The same telemetry that gets an orange band on the
homepage sits inline in prose on `/hydronic/` and `/mission/` at body size and
weight. Wrapped in `.stat-inline` so the figure and its unit read as a figure
and cannot break across lines. No words added.

**The statement** was tied with the heading it exists to beat: 33.6px against a
36.8px h2, same weight, same colour, same section. Now above it. A first attempt
at `clamp(1.5rem,3.6vw,2.4rem)` won at 1280 and **lost at every width below**,
because the clamp minimums cross; caught at 375px and corrected to
`clamp(1.7rem,4.2vw,2.4rem)`, checked at nine widths.

---

## C. Motion

Everything is transform/opacity, none of it shifts layout, all of it is behind
`prefers-reduced-motion`.

| Item | T/O only | Layout shift | Behind reduce | Verdict |
|---|:--:|:--:|:--:|---|
| Header reserve (74px) | n/a | **was Y, now N** | n/a | Overdue; invisible when right |
| Scroll reveal, 14px / 500ms / once | Y | N | Y | Tasteful only at this scope |
| Count-up, 1600ms, width held | text | **was Y, now N** | Y (already) | The number arriving is the point |
| One lift, 2px / 150ms | Y | N | Y | Was three recipes at three speeds |
| `.post-card` lift (new) | Y | N | Y | Whole card is a link; earns it |
| `.nav__cta` lift | — | — | — | **Cut**: a bar element that moves is a wobble |
| `.tier` / `.path-card` hover | — | — | — | **Not added**: not links |
| FAQ chevron | now Y | N | Y (new) | The margin snap was the annoying part |
| `.live-dot` pulse | Y | N | Y (new) | Static dot under reduce, not hidden |
| `scroll-behavior:smooth` | n/a | N | Y (new) | |
| forms.js error scroll | n/a | N | Y (new) | |
| flow scene, ~12 infinite animations | mixed | N | **Y (new)** | Fine playing, must stop under reduce |
| intelligence `.scrub` max-height | **was N** | N | Y (new) | Transition dropped; the one layout-animating property |

**The header was the biggest layout shift on the site and undocumented.**
`site.js` injects the bar into an empty `<header>`, so until the script runs
there is no header box and every page pushes 74px down. One `min-height` turns
that from a reflow into a repaint, on all 28 pages.

**Reduced motion was covered by two rules** — the header bar and the partner
badge — and nothing else. Not the smooth scroll, not any hover lift, not the
chevron, not the pills, and not the live-dot pulse, the only endless animation
outside the iframes. Now eight rules, plus the flow scene's dozen and
intelligence-day's remainder.

**The count-up** restarted from 0 and grew back, reflowing the sentence around
it on every frame. It now holds the rendered width and releases it on landing.
Verified: the counter runs 710, 1254, 1703 while the element stays at 55px and
the paragraph height never leaves 87px. 3400ms to 1600ms, because ease-out
exponential is 97% there by half the duration, so 3400 spent 1.7 seconds
crawling the last few percent.

**Scroll reveal is deliberately narrow.** Heading-led sections below the fold,
once. The hidden state lives behind `html.js-reveal` which only the JS adds, so
with JS off, no IntersectionObserver, reduced motion or print, nothing is ever
hidden. Sections holding an `iframe` are **excluded**: both interactives start
from their own IntersectionObserver measured against the iframe's viewport,
which cannot see a parent fade, so the day chart would burn its ten-second sweep
behind an opacity of 0. Forms and tables are excluded because a reader is
mid-task in them. On the homepage 5 of 9 sections take it.

---

## D. Consistency

**Spacing.** Two interleaved 4px ladders ran at once: 4n+2 with 124 uses and 4n
with 65, so adjacent components were routinely 4px apart in a way that reads as
a mistake. Tokens follow 4n+2 because that is what the component chrome is
already built on. The homepage had **five** distinct section separations
(50/64/124/128/140); now **two**, 140 and 70, plus the deliberate 42 and 52 that
pair the hero, credstrip and showcase. 94 inline `style="margin..."` across 21
files became utilities.

**Two spacing bugs fell out of this.** `.section.tight` and `.section.pad-lg`
were both unused *and* out-specified by `body.dark .section`, so the two escape
hatches for adjusting a section did not work on 96% of the site. The mobile
section rule lost the same fight: `(0,1,0)` against `(0,2,1)`, so 27 of 28 pages
kept desktop padding on a phone. The token is set in `:root` inside the media
query instead, which no selector can out-specify.

**Anchors** were offset twice, `scroll-padding-top` on html *and*
`scroll-margin-top` on `.anchor`. Those add, so an in-page link landed 182px
down under a 74px bar.

**Radii and shadows.** Fifteen radius values and sixteen shadows, of which
twelve shadows collapsed to four intents. The tell was the cream panels: the
same shadow on surfaces whose own comments say they are the same surface,
written once at `.22` and once at `.20`.

**The two interactives.** They sit on the same page in identical panels
fifty-five lines apart and were in two typefaces, on two blacks, with two button
languages. `hydronic-before-after` pulled DM Sans and DM Mono from Google Fonts,
the last render-blocking cross-origin request on the site; it and
`intelligence-day` are now on the self-hosted Montserrat, and its background,
radii and buttons match the parent. The coloured zero-offset glows are gone: the
site has no such lighting model and flow-v2 had already removed its own.

`body.dark .embed` `(0,2,1)` was beating `.panel-dark .embed` `(0,2,0)` and
painting a second near-black inside the panel, so dark pages rendered three of
them.

---

## Bugs found and fixed along the way

1. **Self-referencing tokens.** My own blanket shadow substitution rewrote the
   token definitions too, leaving seven declared as `var()` of themselves.
   Self-reference resolves to the guaranteed-invalid value, so every one of
   those shadows would have vanished. Caught before commit; there is now a
   check that all 84 custom properties resolve to a literal.
2. **The statement clamp inverted below 1280px** (above).
3. `.nav__toggle span{transition:.2s}` was dead: `site.js` only toggles `.open`
   on the menu, nothing ever changes those spans.
4. The `live-stats.js` header said ease-out quartic; the code is exponential.
5. The flow-v2 builder's header comment pointed at `scratchpad/`.
6. `Inter` was being fetched by flow-v2 and never used.
7. The shell's `--orange` was still the pre-August `#E87C2A`, with two
   8-digit-hex literals bypassing even that.

---

## Found and deliberately not touched

- **Dead CSS** beyond what this pass removed: `.draft`, `.section--ink`,
  `.hero--sunrise`, `.proofbar`, `.logos`, `.media-ph`, `.article-meta`,
  `.form__note`, and four unused button variants.
- **Unused tokens**: `--td-amber`, `--td-sunrise-soft`, `--td-cocoa`,
  `--td-cocoa-2`, `--td-black2`, and `--td-photo-overlay`, which is dead because
  every hero overrides it.
- **About sixty hard-coded hex literals** outside the token block, forming four
  near-identical greyscale ramps (`#cfc5bc`, `#e2d7cd`, `#e9ded4`, `#efe9e4`,
  `#d9d2cc`, `#d3c8bf`, `#e0d5ca`...). A palette consolidation is its own pass
  and would touch far more than a polish brief should.
- **`body.dark .card h3` in full orange at 16px.** The accent on the smallest
  type in the section. It is the established dark-card language on every dark
  page and v7 chose not to touch it. With the statement now above the h2 and 42px
  of air, the cards may recede on their own. One-line change if not.
- **`html{font-size}`** left unset: setting it would rescale every rem on the
  site by 3%.
- **`.about-split`** (~79 chars) and `.faq` (900px) left alone; both are inside
  tolerance and neither is prose in a full-width container.
- **`404.html`** has no font preloads and is noindex; left as is.
- **flow-v2's scene internals**: the `#FF8C1A` charge accent is deliberate and
  documented ("MUST match the HA theme"); `--bg:#0a0a0a` needs `stop-color`
  overrides on three sky gradients to change cleanly, which reaches into the
  platform scene; the in-SVG type at 320px has the same problem. All recorded in
  the builder rather than half-done.
- **`.temp.muted` at alpha .2** in the flow scene (~2.0:1). Lives in the
  platform-derived source, needs an upstream edit and a rebuild.
- **`DECISIONS.md` says the photo gallery is "eight tiles tiling 4x4"**; the CSS
  comment and the markup both say five. DECISIONS is stale.
- Seven unembedded legacy animations still fetch Google Fonts. None is on a live
  page.

---

## Where the right fix needed a copy change, described not done

1. **Forms**: the required marker now passes contrast, and `*` plus the
   `required` attribute satisfies 1.4.1, but a visible "(required)" legend would
   be the proper fix.
2. **In-prose links** in FAQ answers and callouts rely on colour plus a hover
   underline. Always-on underlines are a design decision that changes how the
   copy reads.
3. **The prose live stats** on `/hydronic/` and `/mission/` deserve a labelled
   figures row rather than a bolded number in a sentence. That needs label words
   ("Saved", "Gas avoided") which do not exist on those pages.
4. **`.cost-card--td`** wins by weight and keyline because its answer is a
   sentence, not a number. A numeric answer would be copy.
5. **On `/pricing/` the statement precedes the section's real h2.** The sub
   ("it is where the numbers below come from") shows the order is deliberate, so
   size and space were the right levers, not a reorder.
6. **The before/after chip labels** reach about 4.7px at a 320px viewport. Hiding
   them below 400px would remove at-rest information; the tag stays in the
   `aria-label` and the info panel either way. Not done without a decision.
7. **The Home Assistant badge** renders as text until
   `/assets/img/partners/home-assistant.svg` exists. Supplying the file removes
   the issue rather than mitigating it.

---

## Verification

Every commit was checked in the browser at an explicit viewport, not by eye on a
0x0 pane. Contrast was computed against the real composited backdrop.
`test:email`, `test:parser` and `test:leadrow` pass: no form field, label or
serialised value changed anywhere in this pass.

Cache-bust: `style.css` 41 to 42, `site.js` 13 to 14, `live-stats.js` 8 to 9,
`forms.js` 9 to 10, `homepage-flow-v2.html` 27 to 28,
`hydronic-before-after.html` 9 to 10, `intelligence-day.html` 6 to 7.

The flow-v2 rebuild ran clean ("all blocks present") and its generated diff is
the five intended source changes plus the reduce block, nothing else.

**Not deployed.** Branch only.
