# Brief audit: home + hydronic pages against the copywriting brief

**Reviewer:** Marketing & Growth
**Date:** 22 August 2026
**Against:** `Marketing +/Strategy & Research/August 2026 - Marketing Strategy Review/Copywriting & Messaging Brief - website rebuild (23 Aug 2026).md`
**Pages read:** `index.html`, `hydronic/index.html`, `hydronic/how-it-works/index.html`, `hydronic/pricing/index.html`, plus the two interactives they embed.
**Not done:** no page edited, nothing deployed. Open items already in `DECISIONS.md` are listed at the end but not re-argued.

---

## The headline

**The homepage is roughly on-brief. The hydronic tree is the pre-19-August site.**

The 19 August rebuild landed the approved wording on the homepage only. Three of
the brief's locked phrasings already exist there and nowhere else:

| Approved wording | Live at | Contradicted at |
|---|---|---|
| "It charges when power is cheapest, whether that's a free window, your own solar, or late-night off-peak" | `index.html:267` | `hydronic/index.html:34`, `:58`, `:173`; `how-it-works:105` |
| "The last one went in and out in two days" | `index.html:269` | `pricing:111`, `how-it-works:246`, `:272` |
| Battery as ally, not opponent | `index.html:143-146` | `hydronic/index.html:82-125` |

So most of section A below is not writing new copy. It is carrying copy that
already exists, and that Nick already approved, across three more pages.

The two embedded interactives are clean. Both carry 30 kWh consistently, and
`hydronic-before-after.html` already frames the battery as complementary
("a battery works alongside the thermal store rather than against it"), which is
ahead of the hydronic page it sits on.

---

# A. Change straight away

Nothing here is gated. Each is either a banned phrase, a contradiction with
another page, or a number that disagrees with the brief.

## A1. The hero line, homepage

**`index.html:33`**
> Your Gas Boiler Is the Problem.<span class="accent">Your Roof Is the Answer.</span>

Problem-framing where the brief wants the outcome. The approved line exists:

> Warm All Evening.<span class="accent">The Heat Pump Didn't Even Run.</span>

**`index.html:34`** subhead currently leads with solar-only framing.
> Australian-made thermal storage that replaces your gas boiler and runs your heating, cooling and hot water on solar you've already generated. One system instead of two.

Proposed:
> Australian-made thermal storage that replaces your gas boiler and heats your home on energy bought when it's cheapest. More than nine evenings in ten this winter, the heat pump stayed off between 5pm and 9pm.

**`index.html:6`** title, **`:7`** and **`:11`** descriptions carry the same
solar-only phrasing. Title proposed: `Replace Your Gas Boiler with Thermal Storage | Thermal Dawn`.
Descriptions: swap "on solar you've already generated" for "on energy bought when
it's cheapest: a free window, your own solar, or late-night off-peak."

## A2. Solar-only framing, sitewide

The brief: never solar-only framing. Remaining instances:

| Line | Current | Proposed |
|---|---|---|
| `index.html:159` | "shifts that demand to your own solar hours" | "shifts that demand into the cheapest hours of your tariff" |
| `index.html:200` | "captures your abundant morning solar and stores it as heating..." | "charges when power is cheapest, a free midday window, your own solar, or late-night off-peak, and stores it as heating..." |
| `hydronic/index.html:34` | "storing your daytime solar as heat and delivering it through your existing radiators and underfloor heating, all evening, at a fraction of what you're paying now" | "storing heat when power is cheapest and delivering it through your existing radiators and underfloor circuits, all evening." (also removes an unquantified price claim from a hero, which Layer 3 forbids) |
| `hydronic/index.html:58` | "charges during the day on your solar, storing thermal energy while the sun shines and rates are low" | "charges when power is cheapest, a free midday window, your own solar, or late-night off-peak" |
| `hydronic/index.html:73` | "your morning solar" | "the cheapest energy on your tariff" |
| `hydronic/index.html:173` | Step 1 heading "Charge on solar" | "Charge when power is cheapest" |
| `assets/animations/hydronic-before-after.html:127` | "runs in the middle of the day on solar you were otherwise exporting" | "runs in the middle of the day, on solar you were otherwise exporting or on a free power window" |

Section 4b of the hydronic page (`:130-155`, "Works with your solar, works
without it too") is already the brief's charging story done well. The rest of the
page just hasn't been brought into line with its own section.

## A3. Banned savings and payback figures

**`hydronic/index.html:68`**
> Up to $5,000/yr — Annual savings vs. gas hydronic + grid electricity

Banned outright (brief §6). This also closes `DECISIONS` A2, which has been open
waiting for exactly this ruling.

**`hydronic/index.html:69`**
> 3 to 5 years — Typical payback period with existing solar

Wrong number (the brief locks "typically three to six years"), a population claim,
and gated on the CFO verification besides. Remove the tile.

**`hydronic/index.html:70`** and **`how-it-works:169`**
> 15+ years — Thermal store design life, no degradation, no replacement cycle

"No degradation" is a banned absolute. Proposed label: "Thermal store design life.
No charge cycles to wear out." (The "15+ years" figure itself is `DECISIONS` A5,
still awaiting your confirm, so I have not touched it.)

**`hydronic/index.html:281`** FAQ, "How much will I save?"
> Based on modelling in real Australian homes, customers can save up to $5,000/yr... most systems pay for themselves in 3 to 5 years.

Banned figure, banned population claim, wrong payback wording. Proposed:
> It depends on your gas bill, your tariff and how much of the system you take, so we model it for your home at the assessment rather than quote a headline number. What we can show you is measured: in Hawthorn, the gas meter is off the house, and across both running systems the heat pump hasn't come on between 5pm and 9pm on more than nine evenings in ten this winter.

**`pricing:236`**
> On those running costs a system pays for itself in three to five years

"Three to five" is explicitly not the approved wording, and the payback claim is
gated. Hold the sentence until the CFO verification lands; interim, end the
paragraph at "...to a few hundred" and keep the following sentence about modelling
it at the assessment.

## A4. "Well below market rate"

Banned as a headline. Four live instances on the pricing page.

- **`pricing:137`**: "for a fully installed price well below what the traditional hydronic market charges for a heat pump replacement" → "for a single fixed installed price, quoted after we've seen your home."
- **`pricing:149`** card body opens "Well below traditional market rate, and more system for it:" → drop that clause; start at "Controls that learn your home, flow temperatures that suit existing radiators, a large Australian-made thermal store, and full system management from the app." (The card heading "Thermal Dawn target" also reads as internal language; propose "What you get for it".)
- **`pricing:262`** table cell "Well below market rate" → "Fixed quote at assessment"
- **`pricing:297`** FAQ summary `What's the catch with "well below market rate"?` → "Why is it cheaper than a traditional hydronic upgrade?" The answer body is good and needs no change once the quoted phrase goes.

Related: **`index.html:184`** "for well under the two combined" is the same claim
in the same shape. See B1, because that block needs a decision, not just a word.

## A5. Install time stated as universal

The brief allows "the last one went in and out in two days" and forbids
"installs take two days" as a rule.

- **`pricing:111`** heading "Installed and Commissioned in 1 to 2 Days." → "The Last One Went In and Out in Two Days." The body at `:118` already qualifies it properly, so the honest specific goes in the heading and the qualified range stays in the prose.
- **`how-it-works:246`** and **`:272`** both say "most homes are done in one to two days" but immediately qualify it with the complex-pipework exception. Lower risk; worth aligning the phrasing when you're in there, not worth a separate pass.

## A6. Hot water: the single-store claim

Banned until the dual-circuit product ships. The shipping architecture is one
heat source, two tanks.

- **`pricing:56`**: "The same store can supply your domestic hot water as an optional add-on, taking out the gas hot water unit as part of the same install" → "Hot water can run off the same system as an optional add-on, so one gas line gets capped instead of two."
- **`pricing:97`** (Hot Water card): "The same thermal store can supply domestic hot water as an optional add-on..." → "One system, one gas line capped instead of two, one company. Hot water is an optional add-on, worth raising at your site assessment."

`hydronic/index.html:294` says "optional domestic hot water module", which is
already correct. Leave it.

## A7. Battery posture on the hydronic page

**`hydronic/index.html:82-126`** still runs the old versus-battery section that
the homepage replaced on 19 August. Two rows breach the brief directly:

| Line | Row | Action |
|---|---|---|
| `:102-104` | "Cost to store your thermal load / High, you pay for premium battery capacity / A fraction of the cost" | delete the row — battery price comparison |
| `:111-114` | "Capacity over time / Loses capacity as it ages / No charge-cycle limit, lasts decades" | delete the row — degradation attack |

The heading at `:82` ("Why Not Just a Battery?") should become "Your battery
wasn't built for heating", and the three paragraphs from `index.html:144-146`
port straight in. That copy is yours, it is already live and approved, and it
converts the section from an attack into an explanation. The remaining table rows
(stores / conversion losses / made in) survive intact.

Two smaller instances of the same thing:

- **`index.html:179`**: "A home battery to shift that heating to your own solar hours, and it loses capacity as it ages." → delete the trailing clause.
- **`index.html:337`**: "The store is built to last decades, not the few years before a lithium battery degrades." → "The store is built to last decades." The comparison adds nothing and invites the one counterexample.

The hydronic FAQ at `:288-290` is already on-brief and is some of the best copy on
the site. Don't touch it.

## A8. Ordinal language, pricing page

`DECISIONS` records ordinal language being removed sitewide on 13 August. The
pricing page was missed.

- **`pricing:206`**: "Our Best Pricing and Extended Warranty. For Our First Homes." → "Our Best Pricing, While We're Still Early."
- **`pricing:224`**: "Among the first homes in Australia running solar-powered hydronic heating with thermal storage." → "Running hydronic heating on stored heat, and your feedback shapes the roadmap directly." (also clears a solar-only phrasing)

## A9. A running-cost figure that disagrees with the brief

**`pricing:263`**
> Est. annual running cost | ~$1,800/yr | ~$700/yr (grid) | ~$200 to 400/yr (solar)

The brief puts system running cost at **$400 to 600/yr** inside the payback
arithmetic. The table says $200 to 400. One of them is wrong and they are on the
same site. Straight-away fix: change the cell to "~$400 to 600/yr" and drop the
"(solar)" qualifier.

That change breaks the row above it (`:261`, 15-year running cost "~$4,500"),
which then needs re-deriving to roughly $6,000 to $9,000. See B6 — I have not
guessed at it.

## A10. Voice

- **`hydronic/index.html:262`**: "**Risk reversal:** Fully refundable reservation..." — "risk reversal" is marketing jargon that has leaked onto a customer page. Delete the label and let the sentence stand.
- **`pricing:183`**: "we'll credit back what we can" is a vague commercial promise on a page whose whole argument is that there are no surprises. Proposed: "tell us at the assessment and we'll take it out of the quote."

## A11. Evening-carry wording

**`hydronic/index.html:249`** leads with the raw count. The brief leads with the
ratio and keeps the count as the receipt.
> On 59 of the last 63 evenings, the heat pump hasn't run at all between 5pm and 9pm.

Proposed:
> More than nine evenings in ten this winter, the heat pump hasn't run at all between 5pm and 9pm. The raw count: 59 of the last 63.

**Diary note:** the full-winter figure locks on 1 September. When it does, three
places need the new number in one pass: `index.html:253` and `:255`,
`index.html:146`, and `hydronic/index.html:249`.

---

# B. Needs a decision from you

## B1. The homepage cost block

`index.html:165-192`. It is a battery price comparison, which the brief bans, and
it is also your own 19 August copy and the only price anchor on the site.
`DECISIONS` A3 and D1 both hang off it. One of us has to give.

In fairness to the block: it is arguably a *cost-to-build-the-equivalent* argument
rather than a "we're half a battery" claim, and those are different things. The
ban was written against the second.

Three options:

1. **Keep it, and I narrow the brief's ban** to price claims made *against* a battery, explicitly allowing the two-part build-cost frame.
2. **Drop the battery card**, keep "$20,000 to $40,000 → one system instead of two". Loses the anchor's second half, keeps the argument, clears A3 and D1 in one move.
3. **Replace with the boiler-delta frame** once the CFO gates open, which is where the brief wants to land anyway.

My recommendation is 2 now and 3 when the gates open. But this is your copy and
your anchor, so it's your call.

## B2. Flow temperature: 70°C versus the brief's triple

This is a straight contradiction and I am not touching a page until you rule.

- `DECISIONS`, settled 19 August: "Flow temperature stays 'up to 70°C'. Nick: currently tuning to 70, claim 70."
- The brief, under CEO ruling 1: measured to 65°C, designed to sustain 75°C, rated to 80°C, website uses the measured number first.

Live instances of "70°C": `how-it-works:168`, `:196`, `:288`, `pricing:149`.

There is a dependency you should know about before deciding. The 30 kWh store
figure was reconciled on 21 August against a 500L tank with a 70°C ceiling. If the
published flow claim moves to 75°C, that arithmetic needs re-running, and 30 kWh
may move with it. This is the one place where changing a temperature changes a
capacity on four other pages.

## B3. Hero architecture, beyond the line itself

A1 gives you the approved hero line, which drops in today. The architecture around
it does not.

The homepage currently runs hero → credibility strip → interactive → "stop wasting
your solar" → two price-trend charts → battery → cost, and only reaches proof at
section 8, about two-thirds down. The brief's Layer 1 and 2 want outcome, then
proof, then everything else. Moving the proof band (`index.html:243-279`) above the
problem section is a restructure and a design question, not a copy edit.

Same shape on `hydronic/index.html`: proof is section 8 of 11.

## B4. What replaces the "bills" section on the hydronic page

`hydronic/index.html:63-77`. Once the three tiles in A3 are gone, the section is a
heading, a gas-price paragraph and a disclaimer. Either delete it and let the
measured proof band carry the money argument, or rebuild it as a Layer 3 block
sitting next to the CTA. Both are defensible; the current half-state isn't.

## B5. The "gas up 40% in five years" line

`hydronic/index.html:73`, linked to the AER 2025 State of the Energy Market report.

`DECISIONS` records this exact claim being **dropped** from the ported before/after
animation on 21 August as unsupported. It is still live here with a source link.
Either the AER report supports it, in which case dropping it from the animation was
over-cautious, or it doesn't, in which case this needs to go. Someone has to open
the report. I can't verify it from here and I'm not going to assume either way.

## B6. The gas comparator and the 15-year table

`pricing:262` already carries "$5 to 8k (boiler only)" for a like-for-like gas
swap. That is the comparator the brief's delta frame needs, and it is currently
unsourced. Gate 1 asks for two written quotes or a published industry figure. If
the CFO's sourcing lands near $7k, this row and the delta frame line up and the
pricing page mostly writes itself. If it lands somewhere else, the row is exposure.

Same table needs the A9 correction carried through the 15-year row, and `DECISIONS`
E1 (the $0.045/MJ denominator) sits under every dollar figure in it. I'd hold the
whole table until E1 closes rather than patch one cell.

## B7. The how-it-works lead paragraph

`how-it-works:115` sits under the heading "What's Happening in Your System, Hour by
Hour" and then talks about component sourcing, 45°C summers, recyclable materials
and the AI, before the timeline starts. Three separate arguments doing duty as a
preamble to a fourth.

The sourcing honesty ("the heat pump is a proven unit we source rather than build")
is a Layer 2 credibility beat and deserves its own place on the page. The rest is
either duplicated elsewhere or filler. This is a restructure question, so I've left
it alone.

---

# C. Two corrections to the brief itself

I checked the brief against the repo record and it is wrong in two places. Both
are mine.

## C1. Strike the "our AI learns" ban

Brief §6 bans "'Our AI learns' and adaptive-behaviour claims beyond the settled
wording". `DECISIONS`, settled 21 August, records the opposite: *"The adaptive AI
claim stands. Nick, 21 Aug: 'yes its adaptive AI, a bit manual now but
defencable.'"* — and that entry specifically rejects an earlier finding of mine for
citing a ruling that didn't exist in the repo.

I imported the same ban into the brief without re-checking. The repo wins. The
bullet should be struck, or narrowed to "no claim that the system learns something
it doesn't actually measure". `how-it-works:115`, `:227` and `:228-229` stay exactly
as they are, and I have not listed them above.

## C2. The brief must say which flow-temperature ruling supersedes

Per B2. The brief's own precedence note says the close-out wins over the brief and
the claims register wins over both, but it doesn't say what happens when a later
close-out contradicts an earlier settled `DECISIONS` entry. Whichever way you rule
in B2, that precedence line needs writing down, because this will happen again.

---

# D. Checked, deliberately not raised

Open in `DECISIONS.md` and waiting on you. Re-flagging them is noise, so this is
just confirmation I read them and they're still live on these pages:

- **W4** pool heating sold as available capability (`pricing:100`, `:104`, and the four-capabilities framing at `index.html:187`, `pricing:290`)
- **W5** "fan coils/controls" in the included list (`pricing:168`)
- **W6** cooling stated present tense (`pricing:93`, `how-it-works:178-180`, `hydronic/index.html:237`)
- **A5** the 15+ year store life figure (only the "no degradation" clause is raised, in A3)
- **A6** whether the site reflects the pilot trial structure (`pricing:203-226`)
- **E1** the $0.045/MJ denominator, which sits under every dollar figure on `pricing`
- **W1 / W2** publishing the price and the per-kWh storage cost
- **Warranty**: `pricing:216` "Coverage beyond our standard terms" promises a comparison against a standard that isn't published anywhere. That's inside the existing open warranty item, not a new finding. `pre-order/` and `pre-order/terms/` are out of scope for this pass and terms is legal copy regardless.

Credit where it's due, because the brief's Layer 2 asks for constraints stated
before they're asked and three places already do it well: the radiator/condensation
note at `how-it-works:182`, the cooling caveat at `hydronic/index.html:237`, and
the whole "Will It Fit?" section at `how-it-works:207-221`. That section is the
clearest example on the site of what "we show our working" is supposed to sound
like. It should be the model for the rest.
