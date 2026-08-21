# Copy feedback: hydronic pricing page

**Reviewer:** Marketing & Growth agent
**Round:** 2, filed 21 August 2026
**Page:** `hydronic/pricing/index.html`, read against `index.html`, `hydronic/index.html`, `hydronic/how-it-works/index.html`, the `pre-order/` set and the embedded interactive.

Checked against `DECISIONS.md` as at this afternoon's state. A2, A3, A5, A6, D1, E1, E2, W1 and W2 are open there and are not re-flagged. The 30 kWh capacity, the adaptive AI claim, the 5pm to 9pm window, "up to 70°C" and the 6 to 10 week lead time are settled there and are not re-flagged.

---

## One correction to my own round 1 review

DECISIONS records, correctly, that my finding 11 cited "a 17 Aug ruling that does not exist in this repo". That is fair. The ruling was Nick's, given verbally in a marketing session about the webinar deck, and I presented it as though it were repo-documented. It was not, and the disposition ("the claim is defensible today and the wording stays") is Nick's to make. The AI wording is not raised again below.

Worth drawing a general lesson from it: rulings made in chat do not exist for anyone reading this repo. If they are meant to bind the site, they need a line in DECISIONS.

---

## Findings

### 1. "Most customers recoup their investment in three to five years" asserts a customer population that does not exist yet

**`hydronic/pricing/index.html:236`**

Current: "Thermal Dawn shifts your hydronic heating load to solar energy you've already generated, dropping your annual thermal running costs to near zero for the system's lifetime. Most customers recoup their investment in three to five years, then run on free solar for the next fifteen."

Proposed: "Thermal Dawn shifts your hydronic heating load to energy you buy when it is cheapest, cutting what you spend on heating to a fraction of a gas bill. On our modelling a system pays for itself within about five years, and keeps running on the same cheap energy long after that."

Three separate problems in one sentence, which is why it is first.

**"Most customers recoup"** claims an observed outcome across a body of customers. There are two systems in the field, live since May and July. No customer has recouped anything, and none can have. This is a different failure from the open A2 question about the size of the savings: A2 asks whether a number is right, this asserts a history that has not happened. It is also the kind of claim a competitor or a journalist can disprove in one question.

**"near zero"** is contradicted by the page's own table twenty-five lines below, at `:261`, which puts Thermal Dawn's running cost at "~$200 to 400/yr". Two hundred to four hundred dollars is not near zero, and the table is the more credible of the two because it is specific.

**"free solar"** survives here and nowhere else on the site. The same word was cleaned out of the hydronic overview in round 1. This is the last instance.

Related instances of the same population claim, outside this page but part of the same family: `hydronic/index.html:69` "Typical payback period with existing solar" and `hydronic/index.html:281` "most systems pay for themselves". "Typical" and "most" both imply a sample. Worth fixing together if this one is accepted.

---

### 2. "Our network of licensed hydronic heating professionals" overclaims installer scale

**`hydronic/pricing/index.html:114`**

Current: "Thermal Dawn is installed by our network of licensed hydronic heating professionals, engineers who understand both the hydronic side and the electrical requirements of heat pump systems. We don't use generalist trades."

Proposed: "Thermal Dawn is installed by licensed hydronic heating professionals who understand both the hydronic side and the electrical requirements of heat pump systems. We don't use generalist trades."

This is the exact inverse of the standing "no counting installs" rule. That rule exists so we do not look small by publishing a number. This line has the opposite failure: it publishes a scale we do not have. Installer partners are still being recruited, and a customer who asks "how many installers are in the network, and who did my area last?" gets an uncomfortable answer.

Deleting two words fixes it and loses nothing. "We don't use generalist trades" is the sentence doing the actual work and it stays true either way.

---

### 3. The inclusions list is ambiguous about fan coils, on the page whose job is defining inclusions

**`hydronic/pricing/index.html:168`**

Current: "The thermal store, heat pump, fan coils/controls, and app"

Proposed: "The thermal store, heat pump, smart controls, and app"

"fan coils/controls" reads as though fan coil units are included in every quote. Elsewhere they are clearly an addition for specific homes:

- `hydronic/how-it-works/index.html:178`: "If you have radiators only, we can add a fan coil circuit during installation to give you cooling capability."
- `hydronic/pricing/index.html:179`, in the not-included list: "Any non-standard pipework or additional zones"
- The interactive at `hydronic-before-after.html:141` describes fan coils as adding capability to "rooms with no radiator or underfloor circuit"

A radiator-only customer reading `:168` reasonably concludes cooling hardware is in the price. If fan coils are genuinely included where required, say so explicitly and move them out of the ambiguous slash construction. If they are not, they belong in the not-included list at `:174-179`, which is otherwise the most honest block on the site.

This is the page a customer reads immediately before paying $190, so ambiguity here has a cost.

---

### 4. Pool heating is presented as an available capability

**`hydronic/pricing/index.html:100-101`**

Current: "Pool Heating. Already have a pool? Thermal Dawn can extend to pool heating, keeping your water at temperature using stored solar, not gas or a separate electric heater at peak rates."

Proposed: "Pool Heating. Already have a pool? Pool heating is on our roadmap and we're happy to talk through what it would take for your setup. Raise it at your assessment."

**`hydronic/pricing/index.html:104`**

Current: "Most households can cover all four from a single system. Your site assessment maps out exactly what's possible for your home."

Proposed: "Your site assessment maps out exactly which of these are possible for your home."

Heating, cooling and hot water are all demonstrated. Pool heating is not, in either field system. "Can extend to" is hedged enough to be arguable, but "most households can cover all four" is not: it asserts that four capabilities routinely ship together, and the fourth has never shipped at all.

The "four capabilities" framing is load-bearing elsewhere too, at `:137` and `:287`, both of which use it to justify not publishing a price. That justification survives fine on three.

If pool heating has in fact been delivered or commissioned somewhere, ignore this one, but it should then appear in the evidence somewhere.

---

### 5. The 15-year gas figure takes the top of its own stated range

**`hydronic/pricing/index.html:234`** states the source range: "$1,657 to $1,814 per year... Over 15 years that's $25,000 to $27,000".

**`hydronic/pricing/index.html:259`**

Current: "15-year running cost ~$27,000"
Proposed: "15-year running cost ~$25,000 to $27,000"

The table picks the most expensive end of the range as its point estimate, which flatters the comparison. Carrying the range costs nothing and the argument does not need the extra two thousand. House convention elsewhere is to frame conservatively, and this is the one figure on the page that is properly sourced, so it is worth not undermining.

---

### 6. Thermal Dawn's own running cost has no stated basis

**`hydronic/pricing/index.html:261`**

Current: "Est. annual running cost ~$1,800/yr | ~$700/yr (grid) | ~$200 to 400/yr (solar)"

No replacement proposed. The gas column is sourced to Sustainability Victoria at `:234`. The other two columns are not sourced to anything, and the Thermal Dawn column is the number a customer will actually plan around.

E1 in DECISIONS covers the $0.045/MJ gas denominator, but this is an electricity figure and a different assumption set, so E1 does not reach it. Worth its own row wherever E1 is tracked, and worth a footnote on the page in the same style as `:234`.

---

### 7. Record accuracy: DECISIONS says the site is clean on warranty duration, and it is not

DECISIONS, settled 19 August: "**No ten-year warranty.** The site has never claimed one and must not start; it says 'comprehensive coverage, details confirmed with your quote'."

The pricing page is compliant. `:120` uses the approved wording and `:216` says "Coverage beyond our standard terms", which states no duration. But three live pages do state one:

- `pre-order/index.html:67` "Extended warranty: +2 years beyond standard cover"
- `pre-order/index.html:90` "Warranty | Standard | Standard +2 years"
- `pre-order/founder-premium/index.html:60` "Extended warranty: +2 years beyond standard"

Not raising the copy itself as a finding, since the standing rule may have been read as applying only to the ten-year figure. Raising it because **the decision record asserts something about the site that is not true**, and anyone relying on DECISIONS to know where the site stands will be wrong.

"+2 years beyond standard" is also a promise a customer cannot evaluate, because "standard" is not published anywhere. Either resolve it or note the exception in DECISIONS so the record matches reality.

`pre-order/terms/index.html:40` also references extended warranty. That is legal copy and flagged only, not for rewording.

---

## Evidence for A2, not a new finding

A2 is open and its Blocks column already reads "the pricing page contradicting itself", so the contradiction is known. What may not be captured is the size of it.

The page's own table at `:261` gives gas at ~$1,800/yr and Thermal Dawn at ~$200 to 400/yr. That is a saving of roughly **$1,400 to $1,600 a year**.

- `hydronic/index.html:68` claims "Up to $5,000/yr"
- A2 records the modelled figure as ~$3,000/yr
- The pricing table implies ~$1,400 to $1,600/yr

Three numbers, and the lowest is the one we publish in a table with our own arithmetic behind it. Whichever way A2 resolves, the table and the hydronic figures block need to land on the same side of it, and the table is currently the most defensible of the three because a reader can check it.

---

## Note on the review pack itself

The dumps in `.claude/copy-review/pages/` have drifted from the live files since round 1 was actioned this morning.

- `hydronic--how-it-works.md:163` still shows "35kWh". The live page at `hydronic/how-it-works/index.html:167` correctly reads "30kWh... in our 500L store".
- The same dump carries the pre-round-1 interactive copy ("35 kWh of stored heat", "Runs on daytime solar", and the opener assuming the reader owns solar and a battery). All three are already fixed live.
- `hydronic.md` line numbers have shifted by roughly four against the live file.
- `hydronic--pricing.md` is current, and every line reference in this review was verified against the live HTML rather than the dump.

Anyone reviewing from the pack without regenerating it will file findings that were closed this morning. Worth a `npm run copy:dump` before round 2 reviews go further.

---

## What is working and should not be touched

**`:190-199`, "Already Got a Quote? Here's How to Compare It."** The best commercial writing on the site. It arms a buyer to interrogate a competitor's quote on five specific dimensions, and then offers to read that quote "even if you go with it". That is a confident, useful, disarming thing to publish and almost nobody in this category does it.

**`:174-183`, the not-included list.** Naming switchboard upgrades, gas capping and non-standard pipework as exclusions, upfront, on the pricing page. Then `:183` goes further and offers to credit back work the customer takes on themselves. That paragraph does more for trust than any savings figure on the page.

**`:234`, the Sustainability Victoria citation.** The only properly sourced figure I have found anywhere on the site. It should be the template: claim, source, year.

**`:286-287`, "Why don't you show a price on the site?"** Answers the question directly instead of dodging it, and the reasoning is honest rather than defensive.

**`:120`, the warranty wording.** Exactly the approved form, and it holds the line while three other pages do not.
