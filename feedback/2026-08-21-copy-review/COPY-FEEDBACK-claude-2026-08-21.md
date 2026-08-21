# Copy review feedback: home and hydronic overview

**Reviewer:** Claude (Sal) · 21 Aug 2026
**Scope:** `index.html` and `hydronic/index.html`, read against all 28 pages for cross-page conflicts.
**Checked first:** `DECISIONS.md`. Open items A2, A3, A5, A6, D1, E1, E2, W1, W2 are not re-flagged except where a partial edit has left one page contradicting another.

**Mechanical:** em dashes 0, curly quotes 0, draft figures 0. Clean.

Nothing edited, nothing deployed.

---

## A. Standing rule broken: "no counting installs"

The rule says name the place, state the fact. Four places still count.

**A1 · `index.html:146`**
> Across our **first two homes**, the heat pump stayed off through the entire 5pm to 9pm peak on 59 of the last 63 evenings.

→ *In Hawthorn and Gippsland, the heat pump stayed off through the entire 5pm to 9pm peak on 59 of the last 63 evenings.*

**A2 · `index.html:366`**
> Come and see the hardware, and ask us anything. **Our first install** is a few streets away.

→ *Come and see the hardware, and ask us anything. There's a system running a few streets away.*

**A3 · `hydronic/index.html:253`**
> ...one radiator home, one slab home, running the same hardware... **Across both homes**, on 59 of the last 63 evenings...

Two counts in one paragraph. The radiator-versus-slab contrast is doing real work and is worth keeping, but it can be carried by place names.

→ *Hawthorn is a radiator home... A Gippsland home on a concrete slab... Same hardware, same software, configured per house.* Then: *In Hawthorn and Gippsland, on 59 of the last 63 evenings, the heat pump hasn't run at all between 5pm and 9pm.*

**A4 · `hydronic/index.html:307`**
> Join the **first wave** of Australian homes building the thermal infrastructure the grid needs, one home at a time.

Ordinal language that survived the 13 Aug sweep.

→ *Join the Australian homes building the thermal infrastructure the grid needs, one home at a time.*

---

## B. The 19 Aug battery reframe was only half applied

Biggest finding, and it is a consistency problem rather than a re-litigation of **D1**.

The homepage was reframed on 19 Aug: `index.html:143-146` is the new "Your battery wasn't built for heating", and `index.html:165-184` explicitly replaced "half the cost of a battery" with "one system instead of two". The inline comment at `index.html:166` records the change.

The reframe stopped there. Three things now contradict it.

**B1 · `index.html:34` and the meta description**

The hero still carries the abandoned anchor, on the same page as its replacement.

> Australian-made thermal storage that replaces your gas boiler and runs your heating, cooling, and hot water on solar you've already generated, **for around half the cost of a home battery**.

→ *Australian-made thermal storage that replaces your gas boiler and runs your heating, cooling and hot water on energy you buy when it's cheapest.*

Same edit needed in the `<meta name="description">`, which repeats the phrase verbatim.

*(A3 in DECISIONS covers whether the price anchor stays at all. This finding is narrower: whatever the answer, the hero and §6b currently say different things.)*

**B2 · `hydronic/index.html:82, 84`**

> **Why Not Just a Battery?**
> It's the first question almost everyone asks. The short answer: we're not anti-battery, we're pro-economics.

The versus framing the homepage just retired. D1 notes this is "cheap on hydronic", and it hasn't been done.

→ Heading: *Your battery wasn't built for heating*
→ Body: *It's the first question almost everyone asks. A battery is sized for the lights, the fridge and the telly. Heating and cooling are the biggest loads in your home by a long way, and covering them from lithium means buying expensive storage to do the cheapest possible job.*

**B3 · `hydronic/index.html:117-119`**

> Fire risk | Yes | None

Adversarial rather than wrong-tool-for-the-job. It also sits oddly beside `:292-294`, which tells a reader their battery is a good thing.

→ Drop the row, or replace with a job-fit row: *Best at | Lights, appliances, EV charging | Heating, cooling and hot water*

**B4 · `hydronic/index.html:281`**

> **Our target is around half the cost** of a comparable lithium battery system for heating, cooling, and hot water, with no degradation and no replacement costs in 10 years.

Three problems: the retired anchor, "our target is" hedging a price claim, and "no replacement costs in 10 years" reading as a durability guarantee close to warranty territory.

→ *To get what Thermal Dawn does with off-the-shelf parts you're buying two things: a hydronic heat pump replacement, and a battery big enough to shift that heating to cheap hours. We do both jobs in one install. Total installed cost depends on your home size, existing pipework and electrical setup. Book a free, no-obligation site assessment for a fixed quote.*

**B5 · `hydronic/index.html:277`, for contrast rather than correction**

The FAQ at `:292-294` ("I already have a battery. Does this still help?") is the best battery copy on the site and exactly on-message. `:277`, two questions earlier, is the old adversarial version. Worth aligning `:277` to match, since a reader hits both.

---

## C. Both heroes assume solar, then both pages say solar isn't required

`hydronic/index.html:138-158`, "Works with Your Solar. Works Without It Too.", is genuinely good copy. It covers no solar, free midday windows, a small array, and solar added later. `index.html:267` makes the same point.

The problem is that the top of both pages contradicts it.

**C1 · `hydronic/index.html:33-34`**
> **Your Home Generates Solar All Day. Your Gas Boiler Ignores Every Bit of It.**
> Thermal Dawn connects the two, storing your daytime solar as heat...

A reader with 2.4 kW, or none, bounces before reaching §138.

→ *Your Gas Boiler Burns at the Worst Possible Time. / Thermal Dawn stores heat when energy is cheapest, then runs your existing radiators and underfloor heating right through the evening peak.*

**C2 · `hydronic/index.html:178`, Step 1**
> **Charge on solar** — During the day, your solar panels power the Thermal Dawn heat pump...

The three steps are the page's spine, and step one excludes non-solar homes.

→ **Charge when power is cheap** — *During the day, your solar or a free power window runs the Thermal Dawn heat pump, storing heat in our Australian-made thermal tank.*

**C3 · `index.html:33`**
> Your Gas Boiler Is the Problem. **Your Roof Is the Answer.**

Directly contradicted by `index.html:267`: *"whether that's a free window, your own solar, or late-night off-peak."*

→ *Your Gas Boiler Is the Problem. Cheap Energy Is the Answer.*

Worth weighing rather than applying. The roof line is strong, and big-array customers remain the easiest sell. But every recent enquiry with a small array or none is bouncing off a promise the product doesn't actually make.

---

## D. Overclaims worth softening

**D1 · `hydronic/index.html:34`**
> ...delivering it through your existing radiators and underfloor heating, all evening, **for free**.

Not free when the store is charged on off-peak, which `:143` says it often is.

→ *...all evening, at a fraction of what you're paying now.*

**D2 · `hydronic/index.html:184`**
> **Heat your home for free at night**

Same issue, and it is a section heading.

→ *Heat your home on stored energy at night*

**D3 · `hydronic/index.html:58`**
> ...delivers that stored warmth through your radiators and underfloor heating all evening, **without touching the grid**.

Defensible for the evening specifically, but combined with the solar-first framing above it reads as off-grid operation. The store is frequently filled *from* the grid.

→ *...all evening, with the compressor off through the expensive hours.*

---

## E. One claim, three different scopes

**E1 · `index.html:199`**
> Heating, cooling, and hot water are 60 to 70% of **your home's energy use**

Against:
- `mission/index.html:100` — "60 to 70% of the energy a home **actually controls**"
- `blog/thermal-storage-vs-lithium-battery/index.html:43` — "60–70% of the energy you **actually control**"

The percentage now agrees across all three, which it did not previously. But the homepage claims a share of *total* energy use where the other two claim a share of *controllable* load. Materially different claims, and the homepage version is the overstated one.

→ *Heating, cooling and hot water are 60 to 70% of the energy you actually control, and most of it hits at peak times when power costs the most.*

---

## F. Query, do not substitute

**F1 · `index.html:259-261`** — fleet figures are ahead of the audit of record.

Site shows **$2,399 / 49,207 MJ / 2,524 kg**.
`DECISIONS.md` 19 Aug records the baked fallbacks as the 17 Aug audited canonicals: **$2,260 / 47,311 MJ / 2,426 kg**.
The inline comment at `index.html:242` says "Fleet figures are Nick's current readings, newer than the 17 Aug audit doc."

Not proposing a change. Two things to confirm: whether a newer audit has superseded 17 Aug and DECISIONS needs updating, and whether hand-entered readings belong in the baked fallback at all, given the fallback exists precisely for when the API is unreachable.

Hawthorn on `hydronic/index.html:250` ($1,439 / 29,040 MJ) matches the audit exactly. No issue there.

**F2 · `hydronic/index.html:298`**
> All components backed by **comprehensive warranty coverage**.

No duration, so compliant with the rule. But `DECISIONS.md` quotes the approved line as *"comprehensive coverage, details confirmed with your quote"*, and the qualifier is missing here. Worth matching the agreed wording.

---

## G. Minor

**G1 · `index.html:315` against `index.html:337`** — the store is "built in our own workshop in **Sydney**" in one paragraph and at "our own production facility in **Hornsby, New South Wales**" a few lines later. Both true, but pick one on a single page.

**G2 · `index.html:253`** — "9 evenings out of 10" against 59 of 63, which is 93.7%. DECISIONS records the measured figure as 94%. Rounding down is conservative and defensible, but *"more than 9 evenings out of 10"* is equally true and stronger.

**G3 · `index.html:365-368`** — the expo block is dated content. `DECISIONS.md` flags it: **remove after 11 Oct 2026.** Noted here so it doesn't rot in place.

---

## What is working, worth protecting

- `hydronic/index.html:292-294`, the "I already have a battery" FAQ. Best battery copy on the site.
- `hydronic/index.html:138-158`, the "works without solar" section. Answers the objection every small-array enquiry raises.
- `index.html:143-146`, the new battery section. "Run the air conditioner for an hour and watch the battery drop off a cliff" is concrete and true.
- Peak window is 5pm to 9pm everywhere on both pages. No 3pm or 4pm variants survive.
- Origin claims correctly scoped throughout. `index.html:337` states plainly that the heat pump is sourced, not built.
- Rebates, subsidies and VEU appear nowhere on either page.

---

## Suggested order

1. **B, the battery reframe.** The same page currently argues both positions. Highest cost to leave.
2. **A, install counting.** Four small edits against a stated rule, no judgement needed.
3. **C, the solar-first heroes.** Biggest reach, and C3 is a genuine strategic call rather than a copy fix.
4. **D and E.** Quick accuracy tidy-ups.
5. **F.** Query, not an edit.

---
---

# Part 2: How It Works, and the interactive it embeds

**Added 21 Aug 2026.** Covers `hydronic/how-it-works/index.html` and `assets/animations/hydronic-before-after.html`.

Checked against `DECISIONS.md` as at 21 Aug, including the **35 kWh capacity now settled** ("35 is right, 60 is wrong") and the note that the before/after graphic was ported from Wix the same day. Some of what follows is therefore hours-old copy rather than legacy.

This is the strongest page on the site. Install counting is clean. The origin claim at `:111` is the best-scoped sentence anywhere: *"the heat pump is a proven unit we source rather than build, but the thermal store, the controls, and the intelligence that runs them are ours."* No warranty duration, no rebates, no en-dash ranges (everything is written as "70 to 80°C", "6 to 10 weeks", "one to two days").

---

## H. The section heading and the interactive inside it disagree about batteries

The sharpest contradiction on the site, because both are visible in one screen.

**H1 · `hydronic/how-it-works/index.html:158`**
> **Not a Battery. Something Better for Heating.**

Against `assets/animations/hydronic-before-after.html:130`, inside the diagram embedded on the same page:
> A battery works alongside the thermal store rather than against it: battery for appliances, thermal store for heating, cooling and hot water. It also means a smaller battery goes further.

The animation copy is the new framing and it is the best version of this argument on the site. The heading above it is the old versus framing.

→ Heading: *Built for Heat, Not Electricity*
→ Or to match the homepage: *Your Battery Wasn't Built for Heating*

**H2 · `:159`**
> Lithium batteries store electricity, which then gets converted back into heat when you need it, losing efficiency at every step.

Framed as a deficiency of batteries rather than job fit.

→ *A battery stores electricity, then converts it back to heat when you need it, losing a little at each step. Thermal Dawn skips the round trip and stores heat as heat, which is why it's so much cheaper for the loads that dominate your bill.*

*(The Marketing and Growth agent's finding 1 covers the same posture problem on home and hydronic. This is the third instance, and the only one where the contradiction sits inside a single viewport.)*

---

## I. 35 kWh is settled, but it does not reconcile with the tank sizes on the same page

Not reopening the capacity figure. `DECISIONS.md` settled it on 21 Aug and this is a narrower point about two blocks on one page.

> `:163` **35kWh** Thermal storage capacity
> `:211` **250L**, cylindrical: 600mm diameter, around 2m tall
> `:212` **500L**, rectangular: 500mm deep, 1300mm wide, 1600mm tall
> `:164` **Up to 70°C** flow temperature in our R290 configuration

Water stores roughly 1.16 kWh per 100 litres per 10°C of usable swing. Against a 70°C ceiling, 500L gives about 30 kWh and 250L about 15 kWh. Reaching 35 kWh from 500L needs roughly a 60°C swing, which implies charging near 80°C, above the ceiling this page states fourteen lines earlier.

A reader who does that arithmetic finds the page disagreeing with itself. Worth resolving how the 35 kWh is derived and either stating the assumption at `:163` or adjusting which tank the headline figure describes.

---

## J. "Without touching the grid" appears twice more

**J1 · `:146`**
> Stored thermal energy circulates through your radiators and underfloor circuits, keeping every room at your set temperature **without touching the grid**.

Contradicted at `:125` on the same page, where the Dawn phase "starts pre-charging from off-peak grid power". Charging from the grid is the design, not an embarrassment.

→ *...keeping every room at your set temperature with the compressor off through the priciest hours.*

**J2 · `assets/animations/hydronic-before-after.html:124`**
> ...enough of it to carry the evening and overnight in most Australian homes **without drawing from the grid**.

Same fix. Animation copy, so the change belongs in the builder, never the generated file.

*(Third instance is `hydronic/index.html:58`, Part 1 finding D3.)*

---

## K. The interactive opens by excluding anyone without solar and a battery

**K1 · `hydronic-before-after.html:67`**, the first line a reader sees in the Gas Boiler state:
> **You have solar and a battery**, but your heating still burns gas.

**K2 ·** and the panel directly beneath it repeats the assumption:
> A standard gas hydronic system, **even with solar and a battery on the house**. Your biggest energy load is still running on gas, disconnected from the clean energy you already generate.

Two statements, both assuming the reader owns both. A prospect with 2.4 kW and no battery is told twice, before any content, that this is not about them. Same class as Part 1 finding C, and the Marketing and Growth agent's finding 2.

→ K1: *Your heating is the biggest load in the house, and it's still burning gas. Whatever cheap energy you have, none of it is reaching it.*
→ K2: *A standard gas hydronic system. Your biggest energy load runs on gas, cut off from the cheapest energy available to you, whether that's your own solar, a free power window, or overnight off-peak.*

**K3 · Free power windows appear nowhere on this page.**

`hydronic/index.html:146-147` has a strong section on them, and both live systems run primarily on them. The page that explains *how it works* covers off-peak pre-charge at `:125`, then goes solar-only across the rest of the timeline. The mechanism behind the field results is missing from the mechanism explainer.

→ Add to the Morning phase at `:131-132`: *If your retailer offers a free power window, that's when the store fills fastest and cheapest, whether or not your panels are covering it.*

Also worth revisiting `hydronic-before-after.html:121-122`, where the Heat Pump caption reads *"Runs on daytime solar"*. → *"Runs when power is cheapest"*.

---

## L. Height is named as the constraint, then never given

**L1 · `:207-208`**
> The outdoor unit is 450mm deep and sits about 150mm off the wall, so allow around 600mm out from the wall face...
> **Height is more often the constraint than floor space.**

Depth and clearance are given. Height and width are not, on a page that says height is the more common problem.

This has already cost a redesign in the field: a customer's system was re-specified around a 12 kW unit because the 15 kW stood 1400mm tall and would not fit beneath her window.

→ Add the height and width to `:207`, as a range if it varies by capacity: *The outdoor unit is 450mm deep, roughly [X] wide and between [X] and [X] tall depending on capacity, and sits about 150mm off the wall.*

One number turns the section from reassurance into something a customer can measure against. The tank dimensions at `:211-212` already do this well, which makes the omission more noticeable.

---

## M. Smaller items

**M1 · `:33`**
> The Same Warm Floors. None of the Gas.

"Warm floors" reads as underfloor. Most enquiries are radiators, and the page covers both.

→ *Same Radiators. Same Warm Floors. None of the Gas.*

**M2 · `:139`**
> Any remaining solar goes to **your hot water** or back to the grid.

Presents hot water as standard. The animation correctly labels it "Optional add-on" at `hydronic-before-after.html:137`.

→ *Any remaining solar goes to your hot water, if that's part of your system, or back to the grid.*

**M3 · `hydronic-before-after.html:138`**
> The same thermal store can run your domestic hot water, taking out the gas hot water unit **in the same visit**.

Confident scheduling language for a module that has not yet run in a customer home.

→ *...taking out the gas hot water unit as part of the same install. Worth raising at your site assessment.*

**M4 · `:241`, lead time**
> (Current lead time: **6 to 10 weeks**.)

Previously draft-marked, now unmarked and reading as a commitment. Units ordered 28 July ship around 9 October, so ten weeks is holding and six is optimistic. Worth confirming it is the number you want in front of customers.

---

## What is working, and should not be touched

- `:111` — the origin sentence. Correctly scoped, plainly written, and the model for how this claim should read everywhere.
- `:198` — *"Already have underfloor? You're the easy case."* The only place on the site making this point, and it is true: underfloor already runs at heat-pump temperatures, so there is no flow-temperature risk at all. Worth lifting onto `hydronic/index.html`, where the radiator anxiety gets answered.
- `:206-215` — the whole "Will It Fit?" section, height gap aside. It answers a question that has come up in four separate sales threads this month.
- `:288` — the serviceability answer. *"No proprietary lock-in, no special parts to order from us, and no service contract you're tied into."* A customer asked this twice in writing before buying.
- `:190-193` — the R290 / R32 flow temperature explanation. Honest about the ceiling each refrigerant sets, and it reads as spec rather than measurement, per the 19 Aug ruling.
- `hydronic-before-after.html:130` — the battery-alongside caption. The heading above it should be rewritten to match this, not the other way around.

---

## Where Part 2 sits in the order

Slotting into the Part 1 list:

1. **The battery reframe, now three pages** (Part 1 B, Part 2 H). How-it-works is the worst of the three because the contradiction is visible without scrolling.
2. **I, the 35 kWh against the tank sizes.** Not the settled question, a new one.
3. **A, install counting** (Part 1 only, this page is clean).
4. **L, the missing height.** Small addition, already cost one redesign.
5. **J and K.** Two of these live in the animation builder rather than the pages.
6. **C3, the homepage hero.** Strategic call.
7. **M.** Tidy-ups.
