# Decisions and changelog

Two things live here: what changed on the site and when, and what is still
waiting on a decision. Detail and rationale stay in `BUILD-NOTES.md`; this is
the index.

> **Backlog of record: Notion.** `Thermal Dawn Ops / Product Backlog /
> Product Backlog Items`, Category `Web`, Stream `Sales & Web`.
> Moved back to Notion 19 Aug 2026. The Coda "Founders War Room" table is the
> **old** copy and the two have already drifted (the second-install item is
> live on the site and still unticked in one of them). Update Notion. If a
> figure disagrees between the two, Notion wins.

---

## Open decisions

Ranked by what it costs to leave them open. Each is also a Notion row.

| # | Decision | Status | Blocks |
|---|---|---|---|
| A2 | Savings claim, currently "Up to $5,000/yr" | **Evidence now leans against it.** The 17 Aug field data says do not annualise; the modelled figure is ~$3,000/yr with measured pace ahead of it. Site still says $5,000. | The pricing page contradicting itself |
| A3 | Homepage anchoring implies a sub-$8K installed price | Open. Note it dissolves if the battery framing goes (see D1) | Hero copy |
| A5 | 15+ year lifespan vs real warranty | Actioned 13 Aug, scoped to the store, **awaiting Nick's confirm** | Nothing |
| A6 | Should the site reflect the pilot trial structure | Open, conflicts with Nick's "don't explain the pre-cert thing" | Legal exposure |
| D1 | Stop positioning against batteries (head of sales, 13 Aug) | Open. Cheap on hydronic and mission, tangled on the homepage because the price anchor depends on the battery reference | A3 |
| E1 | $0.045/MJ: blended Victorian tariff or top-block? | **Open, and it is the denominator under every savings figure on the site**, not just the deck | Every dollar figure |
| E2 | Live demo vs static display (Tech23, Everything Electric, Boroondara Expo) | Notion says Critical, target 14 Aug, **overdue**. Same decision three times | Expo prep |
| W1 | Publish the price, or keep the anchor vague | Open | A3, D1 |
| W2 | Republish per-kWh storage cost with a public source | Open, reverses the 1 Aug "too exposing" call | A3 |

### Settled 19 Aug 2026

- **Flow temperature stays "up to 70°C".** Nick: currently tuning to 70, claim
  70. Measured peak is 65.0°C, so the site states a spec, not a measurement.
  Keep them distinguishable if the wording is ever revisited.
- **Peak window is 5pm to 9pm.** Measured 94% across both homes. The site said
  4pm to 9pm, which was never measured. Corrected.
- **No ten-year warranty.** The site has never claimed one and must not start;
  it says "comprehensive coverage, details confirmed with your quote".
  **The 18 Aug webinar deck does claim it.** See below.

---

## Carried risks

**The webinar deck states a ten-year equipment warranty.** It is in the slide
notes for Russell Williams and was presented to the Electrify Boroondara
hydronic webinar on 18 Aug. Nick's ruling on 19 Aug is that ten years is wrong.
The website is clean; the deck is not, and it has already been shown. Someone
needs to decide whether that warrants a correction to Russell before the same
deck is reused at the Expo on 11 Oct.

**Two backlogs.** Coda and Notion both hold Web items and have drifted. Notion
is now canonical (above). The Coda table should be archived rather than left
to rot, or this recurs.

---

## Changelog

### 19 Aug 2026, Boroondara evidence pass
- Peak window corrected 4-9pm to **5pm to 9pm** on `index.html` and
  `hydronic/`, matching the measured window.
- Added the strongest measured claim we own: **59 of the last 63 evenings,
  across both homes, no heat pump between 5pm and 9pm.**
- Baked live-stat fallbacks moved to the **audited 17 Aug canonicals**: fleet
  $2,260 / 47,311 MJ / 2,426 kg, Hawthorn $1,439 / 29,040 MJ / 1,489 kg.
  These replace figures that predated the $43.62 Warragul over-credit fix
  (`dd5a285`). Live API still overrides them; the fallbacks now match the audit.
- Expo block added to the homepage "What's next". **Dated: remove after
  11 Oct 2026.**

### 13 Aug 2026, design system and gallery
- `#FF9C00` adopted as the brand accent sitewide, replacing `#f4921d`, via a
  single `--td-orange-rgb` channel token feeding every tint. Sunrise gradient
  brought onto the same orange. `#f4921d` no longer appears anywhere.
- `--td-orange-ink` (#C27800) added for accent text on light surfaces: the
  homepage savings figures were 1.96:1 on cream, now 3.30:1.
- Photo gallery rebuilt: eight tiles tiling 4x4, customers as the hero.
- Proof phone unframed and resized to the reference (780px device).
- Ordinal language removed sitewide ("our first home", "two installs live").

### 12 Aug 2026, designer review (Gage)
- 19 items actioned; 2 defects found on review and fixed (contact padding
  computed off the light-theme baseline; charts section lost its readable
  attribution colour in the background swap).
- Fixed a pre-existing bug where `body.dark .section+.section::before` wiped
  every `section--photo` background.

### Earlier
See `BUILD-NOTES.md` for the 31 Jul cutover, the 1 Aug claims review, and the
v3 animation port.
