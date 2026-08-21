# Copy review, round 2: hydronic pricing

**Sal, 21 Aug 2026.** `hydronic/pricing/index.html`, read against home, hydronic overview and how-it-works.

Verified against the live HTML rather than the dump, because `4ab1d40` touched this page after `npm run copy:dump` ran. Every line reference below was confirmed live. Checked against `DECISIONS.md` as at round 1 close: capacity (30 kWh), the adaptive AI claim, lead time, flow temperature and the peak window are all settled and are not re-flagged.

This page does the hardest commercial job on the site and mostly does it well. The quote-comparison section is the best writing anywhere on the site. The problems are concentrated in one paragraph, `:236`, and in a comparator noun at `:137`.

---

## 1. One sentence promises a price below a gas boiler swap

**`hydronic/pricing/index.html:137`**
> Thermal Dawn delivers all of that for a fully installed price **well below what the traditional hydronic market charges for a basic boiler swap**.

The page defines a basic boiler swap 123 lines later, at **`:260`**:
> System cost | **$5 to 8k (boiler only)** | $20 to 40k | Well below market rate

Read literally, the page's central price sentence says a complete Thermal Dawn install lands well under $5,000. The intended comparator is `:136`, the $20,000 to $40,000 heat pump replacement. One wrong noun turns the price promise into a number nobody can honour, on the page where customers form their expectation.

→ *Thermal Dawn delivers all of that for a fully installed price well below what the traditional hydronic market charges for a heat pump replacement.*

This compounds A3 rather than being A3: A3 is homepage anchoring, this is a mis-chosen comparator on the pricing page itself.

---

## 2. Running costs are "near zero" and "$200 to 400/yr" on the same page

**`:236`**
> ...dropping your annual thermal running costs to **near zero** for the system's lifetime.

**`:261`**
> Est. annual running cost | ~$1,800/yr | ~$700/yr (grid) | **~$200 to 400/yr (solar)**

And `:259` compounds it: a 15-year running cost of ~$4,500 is $300/yr, not near zero. The table is the defensible number; the prose should match it.

→ *Thermal Dawn shifts your hydronic heating load onto the cheapest energy available to you, dropping your annual thermal running costs from around $1,800 to a few hundred dollars.*

---

## 3. "Most customers recoup their investment in three to five years"

**`:236`**
> **Most customers recoup their investment in three to five years**, then run on **free solar** for the next fifteen.

Three problems in one sentence:

1. **No customer has recouped anything.** The oldest system has been running since May. "Most customers" describes an outcome nobody has reached yet, in a paragraph that otherwise cites Sustainability Victoria and reads as evidenced.
2. **"free solar"**, when both live systems charge primarily from free and off-peak windows rather than surplus solar. Same class as the D1 locations listed below.
3. **"the next fifteen"** implies a twenty-year service life, which is adjacent to A5 (lifespan scoped to the store, still awaiting confirm).

→ *On the running costs above, the system pays for itself in three to five years and keeps returning after that. Your own payback depends on your gas bill, your tariff and how much of the system you take, and we model it for your home at the site assessment.*

`hydronic/index.html:281` carries the same claim as *"most systems pay for themselves in 3 to 5 years"*, which is better because it says systems rather than customers. Worth aligning both to whichever survives.

---

## 4. The pricing page knows about one deposit tier, and there are two

`:153`, `:276` and `:291` all state a **$190** reservation. **$990** appears in four places under `pre-order/`, including `pre-order/terms/`, which is legal copy.

The FAQ at **`:290-291`** is the sharpest instance, because it asks the question directly:
> **When do I pay, and is the deposit refundable?**
> A fully refundable $190 reservation holds your place in the queue.

Someone who reads the pricing page and then meets a $990 option at checkout has been surprised by the page whose whole promise is "no surprises" (`:163`).

→ `:291`: *A fully refundable $190 reservation holds your place in the queue, or $990 for the founder tier, also fully refundable. Either way you pay nothing further until you approve your fixed quote after the site assessment.*

Same addition at `:153` and `:276`, or at minimum a link to `pre-order/` where both are set out.

---

## 5. The extended warranty extends from nothing

**`:206`** headline, and **`:215-216`**:
> **Extended Warranty.** Coverage beyond our standard terms.

Against **`:120`**:
> Comprehensive coverage across all components, **details confirmed with your quote**.

No duration appears anywhere, which correctly holds the standing rule. But the page promotes an extension to standard terms that the same page declines to define, and it is one of only four early-customer benefits. A customer asking "beyond what?" finds no answer on the site.

Not a re-flag of A5 (lifespan) or of the carried webinar-deck risk. It is the third face of the same unsettled position, and probably the one to resolve first, because it is a written commitment to people paying deposits today.

→ Either define the standard term, or reword to what you can stand behind now: *Direct support from the engineering team through your first two winters, and we fix what needs fixing.*

**Cross-page, added after reading the Marketing and Growth agent's round 2 finding 7:** the benefit *is* quantified, just not here. `pre-order/index.html:67` and `pre-order/founder-premium/index.html:60` both say **"Extended warranty: +2 years beyond standard"**, and `pre-order/index.html:90` puts it in a comparison table. So the pricing page describes the same benefit more vaguely than the checkout page does, and a customer reading both gets two different levels of specificity about one promise.

That makes the fix easier: either bring "+2 years" onto `:216` so the two pages agree, or drop it from both until "standard" is defined. Taking the second route also settles what "beyond our standard terms" means, which is the underlying problem. Their finding also shows the `DECISIONS.md` record is inaccurate on this point; I verified both instances independently and they are live.

---

## 6. The mechanical en dash check reports zero, and six are live

`INDEX.md` still reports **en dashes: 0**, and round 1 recorded them as converted. Six survive, because the check scans for the literal character and the homepage uses HTML entities:

- **`index.html:173`** `<b>$20,000&ndash;$40,000</b>` → `$20,000 to $40,000`
- **`index.html:178`** `<b>$8,000&ndash;$15,000</b>` → `$8,000 to $15,000`

And four literal ones the check misses because it does not scan `assets/animations/`:

- `heating-comparison-table.html:110` and `heating-tool.html:843` — "(1–2 days)" → "(1 to 2 days)"
- `heating-tool.html:523, :524` — "$8K–$15K", "$15K–$20K" → "$8K to $15K", "$15K to $20K"

→ `scripts/dump-copy.js` should decode HTML entities before counting and include `assets/animations/*.html`, or the flag block keeps giving false assurance on the one rule that is fully mechanical. The same blind spot would hide `&mdash;` if one ever landed, which matters more.

---

## 7. Hot water is an optional add-on twice and a shipped fact once

**`:97`**
> The same thermal storage **supplies** domestic hot water, **eliminating** your gas hot water system in the same installation.

Contradicted by `:56` on the same page (*"as an optional add-on"*) and by `hydronic-before-after.html:142-143` (*"Optional add-on ... Worth raising at your site assessment"*), which was corrected in round 1. `:97` is the last place still stating it as delivered capability.

→ *The same thermal store can supply domestic hot water as an optional add-on, taking out the gas hot water unit in the same install. Worth raising at your site assessment.*

---

## 8. "Most households can cover all four"

**`:104`**
> **Most households can cover all four** from a single system. Your site assessment maps out exactly what's possible for your home.

The four are heating, cooling, hot water and pool. Most households do not have a pool, and hot water is an add-on that has not yet run in a customer home. The sentence is unnecessary anyway, because the one after it does the work.

→ *One system can cover all of these. Your site assessment maps out which of them make sense for your home.*

---

## 9. The 15-year table compares a solar case against a grid case

**`:261`**
> Est. annual running cost | ~$1,800/yr | **~$700/yr (grid)** | **~$200 to 400/yr (solar)**

The standard heat pump is costed as if it never touches the owner's solar; Thermal Dawn is costed as if it runs entirely on it. A standard heat pump in a solar home does catch some solar, just badly, because it heats on demand at dawn and dusk when there is none.

The real argument is timing, and the page already makes it properly at `:194`. As built, the table will be picked apart by anyone technical, which on current evidence is a good share of the pipeline.

→ Footnote under the table: *The standard heat pump figure assumes on-demand heating at dawn and dusk, when little solar is available. Thermal Dawn's assumes charging in the cheapest window of the day, whether that is your own solar, a free power window, or overnight off-peak.*

---

## 10. "Network" and "engineers"

**`:114`**
> Thermal Dawn is installed by **our network** of licensed hydronic heating professionals, **engineers** who understand both the hydronic side and the electrical requirements of heat pump systems. We don't use generalist trades.

"Network" implies a national footprint still being recruited, and the people doing the work are licensed trades, not engineers. The last sentence is the strong one and stands on its own.

→ *Thermal Dawn is installed by licensed hydronic heating professionals who understand both the hydronic side and the electrical requirements of heat pump systems. We don't use generalist trades.*

---

## 11. Two claims to verify before 11 October

**`:93`** *"Thermal Dawn runs in reverse cycle to cool your home in summer"* and **`:257`** *"Cooling included: Yes"*, both present tense. Both live installs are heating only so far. If cooling has not been commissioned anywhere, the honest tense is a capability statement: *"is a reverse-cycle system, so the same hardware cools in summer."*

**`:224`** *"Among the first homes in Australia running solar-powered hydronic heating with thermal storage."* Worth checking "first in Australia" is defensible before it goes in front of a room at Hawthorn Arts Centre. Separately, drop "solar-powered" for the same reason as finding 3: → *"Among the first homes in Australia running hydronic heating from a thermal store."*

---

## 12. Minor

- **`:55`** *"banking your cheapest energy as hot water"* → *"as heat"*. On a page where Hot Water is a distinct capability with its own card, this reads as domestic hot water.
- **`:55`** *"30kWh"* → *"30 kWh"*, matching the spacing used elsewhere.
- **`:33`** *"Everything Your Home Needs. Nothing You Don't."* sits fifty lines above `:85` *"it's worth thinking bigger"*, which upsells three more capabilities. The headline promises a restraint the page does not keep.
- **`:259`** and **`:261`** both take the top of the Sustainability Victoria range ($1,814, rounded to ~$1,800 and ~$27,000) as the single figure, while `:234` gives the range honestly. The midpoint would cost little and be harder to argue with.
- **`:72`** the spec sheet CTA is commented out pending the PDF. Worth tracking: it is referenced from the strongest part of the page, and technical prospects are asking for exactly this document.

---

## Already open in DECISIONS.md, locations only

Not re-argued. Listed so whoever actions each decision knows where the copy lives.

- **A2**, "Up to $5,000/yr" at `hydronic/index.html:68` and `:281`. The pricing table at `:261` implies an annual saving of roughly $1,400 to $1,600. That is the contradiction A2 already names.
- **A3**, sub-$8K implication: `index.html:178`, and now `hydronic/pricing/index.html:137` by a different route (finding 1).
- **D1**, battery positioning: this page is clean. `hydronic-before-after.html:135` is the model version.
- **E1**, the $/MJ denominator: sits under `:234`, `:259` and `:261`.

---

## What is working, and should not be touched

- **`:190-199`, "Already Got a Quote? Here's How to Compare It."** The best commercial writing on the site. It reframes the comparison on your terms, and `:199`, offering to review a competitor's quote *"even if you go with it"*, is a real trust move that costs nothing.
- **`:295`** the "what's the catch" answer. Pre-integration at the factory instead of wholesalers and site assembly is a specific, checkable reason for the price. The overclaims in `:236` are unnecessary when this is sitting in the FAQ.
- **`:183`** the offer to credit back unlicensed work the customer takes on. Nobody else does this, and it turns a cost objection into a conversation.
- **`:207`** the early-adopter framing, the deliberate exception to the no-counting rule, handled well: no numbers, no ordinals, just *"systems are installed and running, and the next homes are going in now."*
- **`:120`** the serviceability line, matching how-it-works `:288`. Consistent across two pages and answers a real objection.
- **`:174-179`** the "not included" list. Specific, unflattering, and the reason `:163`'s "no surprises" is credible.

---

## Suggested order

1. **Finding 1**, the boiler-swap comparator. One noun, and it is the page's price sentence.
2. **Findings 2 and 3**, the two overclaims in `:236` that contradict the page's own table.
3. **Finding 4**, the missing $990 tier on the page that answers "when do I pay".
4. **Finding 5**, the extended warranty with no baseline. People are paying deposits against it now.
5. **Finding 6**, the dash check blind spot, and the six live instances behind it.
6. **Findings 7 and 8**, hot water and the pool.
7. **Findings 9, 10, 11.**
8. **Finding 12.**
