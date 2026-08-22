# Out-of-lane notes: `intelligence/index.html`

**Reviewer:** Marketing & Growth
**Date:** 22 August 2026
**Status:** **Not a lane C review.** Lane C is assigned, and its reviewer should
still do the full pass, including the day chart's phase narrations and the origin
claims on `mission`. These four findings came out of a read-through Nick asked for
after a sitewide grep for overnight claims surfaced two lines on this page that
looked wrong. Filed separately so it doesn't collide with lane C's own file.

**Scope read:** `intelligence/index.html` in full, plus
`assets/animations/intelligence-day.html` checked only for charging language.

**Not re-raised:** the adaptive AI claim (settled by Nick, 21 Aug), and everything
in section B of the 22 Aug brief audit.

---

## 1. The page contradicts the charging-story fix, and its own chart

**`intelligence/index.html:60`**, under the heading "Your Solar Generation":

> Thermal Dawn monitors your solar output in real time and forecasts tomorrow's
> generation from local weather. **Charging happens when your panels are
> producing, not when the grid is expensive.**

This is solar-only framing stated as an *exclusion*. It doesn't just omit the
other two charging modes, it denies them. Every other page was corrected away from
this on 22 August.

Two things refute it on this page alone.

**`:64`**, the very next card, says the opposite:

> …charge thermal storage when electricity is cheapest.

**`intelligence-day.html:160`**, the chart this page embeds, narrates an explicit
off-peak charge at 8:45am:

> A short off-peak top-up takes the chill off the morning.

So the prose claims charging only happens on solar, while the measured day
directly beneath it shows an off-peak top-up. A reader following the argument
carefully — which is the entire audience for this page — will land on that.

**Proposed `:60`:**
> Thermal Dawn monitors your solar output in real time and forecasts tomorrow's
> generation from local weather, so your panels charge the store whenever they can.
> When they can't, it falls back to whatever is cheapest that day.

This belongs in the same commit as the six overnight fixes. It's the same class of
error and the same string family.

---

## 2. We advertise open API access to two figures we have ruled unfit to quote

**`intelligence/index.html:112`**

> Every data point, flow temperature, return temperature, **thermal store level**,
> solar input, energy consumption, **COP**, is accessible via our open API. Build
> your own dashboards and automations. It's your data.

Both bolded fields are explicitly excluded by the field data reference
(17 Aug):

| Field | Internal ruling |
|---|---|
| COP | *"Our model is ±20% and derived. Nothing above depends on it."* Do not quote. |
| Thermal store level | Hawthorn's tank probes have an intermittent grounding fault. The displayed figure is currently an estimator output, fine for controlling a house, not for presenting as a measurement. |

The exposure is specific and it is aimed at exactly the wrong audience. This page
is read by the Home Assistant user. That person will pull both fields, chart them,
notice the COP swinging and the tank trace stepping, and ask why. We will have
advertised the two numbers we internally agreed not to stand behind.

Two ways out. **Drop them from the list**, which is quiet but hides something a
user will find anyway. Or **keep them and label them**, which is the position the
brief actually takes:

> Every data point the system measures — flow temperature, return temperature,
> solar input, energy consumption — is accessible via our open API, along with the
> derived figures the controller works from, like store level and COP, marked as
> estimates so you know which is which. Build your own dashboards and automations.
> It's your data.

I'd take the second. Marking a derived figure as derived, on a page whose whole
argument is openness, is the brand behaving. Hiding it is the brand flinching.

---

## 3. Third live instance of the battery degradation attack

**`intelligence/index.html:154`**

> This is infrastructure built to improve, not degrade. **While a lithium battery
> loses capacity every cycle**, Thermal Dawn's intelligence compounds, getting
> smarter about your home and Australia's evolving energy market with every update.

Banned by the brief (§6, "fire-risk and degradation attack rows in battery
comparisons"). Already flagged at `index.html:337` and in the hydronic comparison
table; this page hasn't been swept, so it is still live.

**Proposed:**
> This is infrastructure built to improve. Thermal Dawn's intelligence compounds,
> getting smarter about your home and Australia's evolving energy market with
> every update.

The sentence loses nothing. The comparison was carrying no weight the rest of the
paragraph doesn't carry better.

---

## 4. Judgement call for Nick: the update-count claim

Stated twice, in near-identical words:

**`:129`** — "we ship updates constantly, 8 firmware and 50+ app updates in a
single month."
**`:153`** — "In a single month we shipped 8 firmware and 50+ app updates to the
system in the field, remotely."

Not a breach, but worth a decision, for three reasons.

**It cuts both ways.** To an engineer it reads as velocity and responsiveness. To
someone about to spend twenty thousand dollars it can read as a system that needs
constant fixing. The page is written for the first reader; the buyer is often the
second.

**The denominator is two.** Fifty app updates across an install base of two homes
invites the arithmetic.

**It is an unregistered number appearing twice.** Every published figure needs a
register row, and this one has none.

If the point is "it improves without a technician visit", `:153` already makes it
in its first clause and doesn't need the count. My suggestion: keep the claim once,
at `:153`, drop it from `:129`, and get a register row behind it — or drop it
entirely and let the over-the-air argument stand on its own.

---

## What is already right, and should be the model

**`:200-203`**, the server-outage FAQ, is the best writing on the site.

> Your heating keeps running, unchanged. The controller in your home makes the
> decisions, not our servers… So if our platform goes offline or your internet
> drops, the system heats your house exactly as it did the day before. You lose the
> app view and remote support until it's back, nothing else. The equipment's own
> safety limits sit in firmware on the unit itself, so they hold regardless.

It answers a question nobody asked, states plainly what you lose, and puts the
safety argument where it belongs. That is Layer 2 of the brief — constraints
stated before they are asked — executed better than anywhere else on the site.
It should be the reference for the rest of this page.

**`:82`** is also correct and worth protecting: "Watch a measured day build" scopes
the 16 August trace as one day rather than a general claim, which is exactly the
handling the overnight fix is trying to establish elsewhere.

---

## One thing for lane C's reviewer to resolve

`:93` says the cloud layer "adds the smart optimisation", while `:202` says "the
controller in your home makes the decisions, not our servers." Both are probably
true — the controller executes, the cloud plans — but as written they can be read
as disagreeing. Worth one sentence to reconcile. I have not proposed wording
because the answer is an engineering fact I do not have.
