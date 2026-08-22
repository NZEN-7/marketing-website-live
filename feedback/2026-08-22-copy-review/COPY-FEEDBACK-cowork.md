# Copy feedback: mission page (Cowork session)

**Scope:** `mission/index.html` only, at Nick's request. This is a subset of Lane C; `intelligence/index.html` and the day chart were not reviewed and remain with Lane C's assigned reviewer. Whole-site pack read for cross-checking. DECISIONS.md checked; B1 to B7, A2, A3, D1, E1, W1 and W2 are not re-argued below, though D1's mission locations are confirmed as the lane brief asks.

**Overall:** the page is in good shape and already ahead of the close-out direction in places: the Melbourne case study leads and the QLD modelling sits below it as scale context, correctly labelled "(Modelled/illustrative.)". The measured figures match the claims register ($1,439 / 29,040 MJ / 1,489 kg is the corrected 17 Aug set, rounded correctly). Two standing-rule breaches, both small and both fixable without a decision.

---

## Findings

### 1. Origin rule breach in the workshop caption

`mission/index.html:200`
Current: "The team at the Hornsby workshop, where every system is built."
Proposed: "The team at the Hornsby workshop, where every thermal store is built."

The standing rule scopes origin claims to the store, controls and technology, never the whole system; the heat pump is sourced. "Every system is built" is the exact phrasing the rule exists to catch. One word fixes it. (An alternative, "where every system comes together", keeps the wider scope honestly if assembly is the claim wanted.)

### 2. Price-position and battery residue in the founder bio

`mission/index.html:188`
Current: "So he built a thermal battery designed for Australian homes: safer, more affordable, and made here."
Proposed: "So he built a thermal battery designed for Australian homes: durable, serviceable, and made here."

"More affordable" is a price-position claim with no comparator, the class the 23 Aug close-out retires from consumer surfaces, and "safer" only parses against lithium, which is D1's enemy framing in miniature. The proposed words are lifted from the same paragraph's own argument (durability, serviceability), so the sentence keeps its rhythm and loses the residue.

### 3. Measured figures: stray space, and no as-at date

`mission/index.html:156`
Current: "Running totals from their own app: $ 1,439 saved, 29,040 MJ of gas avoided, 1,489 kg of CO₂ avoided."
Proposed: "Running totals from their own app, as at 17 August 2026: $1,439 saved, 29,040 MJ of gas avoided, 1,489 kg of CO₂ avoided."

Two things. "$ 1,439" has a stray space. And "running totals" printed as static text will silently age; the figures are correct today because they match the 17 Aug corrected set, but nothing on the page says when "running" was. Either date them (as proposed) or wire the block to the live counters the homepage uses. Query, not substitution: if these are already live-injected and the dump caught a snapshot, ignore this finding.

### 4. Three different CTAs on one page

`mission/index.html:36` "Request a Quote" (hero) vs `:209` "Secure Your Spot" vs `:211` "Reserve Your System" (footer).

The funnel pages standardise on Reserve Your System / Secure Your Spot. If quote-first is the deliberate new premium path from the close-out, then the footer should follow the hero, not fight it. Whichever way, one page should make one ask. Flagging as a choice rather than proposing copy, since it touches the P2/W1 decision about how the funnel closes.

### 5. The EU inverter claim carries no link

`mission/index.html:139`
Current: "...the EU moved in April 2026 to block public funding for foreign-made solar inverters, calling the dependence one of the 'most pressing threats' to critical infrastructure..."

The page links AEMO for its other external claim (`:65`) but this one, which includes a direct quotation, is unsourced. Add the citation link in the same style, or trim the quoted phrase to a paraphrase. A quoted phrase with no source is the page's most checkable unsourced claim.

### 6. "60 to 70% of the energy a home actually controls is thermal" needs a register row

`mission/index.html:100`

Not proposing a change to the number. But this stat is the successor to the retired "63% of your energy bill" claim, it anchors the page's central argument, and it currently has no source row in the claims register. Under the register rule it needs one (the ICP/Opportunity study is the likely source) before it is defended in front of a technical reader. Query for the register owner, not a copy edit.

---

## Known-item location confirmations (not re-argued)

- **D1 (battery positioning)** on this page: the "Why Batteries Fall Short" section `:72-92` including the four attack cards (`:76-89`, with the $8,000 to $15,000 battery price at `:77`), plus the residue at `:188` (finding 2). Note `:92` ("a battery stores electricity... the load was thermal to begin with") already matches the "wrong tool, not enemy" rule and is the keeper sentence if D1 lands.
- The hidden Wix media comment `:171-174` is already tracked in MISSING-MEDIA.md.

## Outside my lane

Nothing worked up; scope was one page. One observation in passing: the mission hero's "designed here, made here" (`:34`, also the meta description) sits at the edge of the origin rule depending on whether "thermal infrastructure" reads as the store or the system; the Lane C reviewer may want a view on it alongside the intelligence page's origin claims.
