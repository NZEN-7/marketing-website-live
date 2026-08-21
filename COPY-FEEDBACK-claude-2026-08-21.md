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
