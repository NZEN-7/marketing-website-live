---
name: copy-review
description: Review the marketing site's customer-facing copy for accuracy, consistency and voice. Use when asked to review, proofread, audit or tighten the website copy, check wording across pages, or check that claims and CTAs are consistent. Not for code review.
---

# Reviewing Thermal Dawn site copy

The copy lives inside 28 hand-written HTML files, and only about 38% of those
bytes are words. Do not read the pages one by one; you will spend most of your
context on markup and still miss the findings that matter.

## 1. Get the corpus

```bash
npm run copy:dump
```

That writes `.claude/copy-dump.txt` (gitignored, not deployed): every page's
visible copy, each block prefixed with the line it came from, plus `<title>`
and meta description per page. Read that one file. It is ~29k tokens and holds
the entire site, which is the point: the findings worth having are cross-page.

The same run also writes `.claude/copy-review/` (INDEX.md plus one markdown
file per page), the pack for HUMAN reviewers working a page at a time. Point
people there; keep AI sessions on the single dump.

The dump flags mechanically:

- `[DRAFT]` a figure awaiting Nick's sign-off
- `[CTA]` a button label
- `[EM-DASH]` banned punctuation (should always be zero)
- `[CURLY-QUOTE]` a smart quote where the site uses straight

## 2. Do not fan out

Review the whole dump in one context. Per-page subagents miss exactly the class
of bug this site is prone to: a CTA labelled two ways, a claim on one page
contradicting another, the same feature explained differently in two places. In
July 2026 five pages each read fine alone while their buttons said "Request a
Quote" directly under a sentence saying "Book a free site assessment".

## 3. Off-limits, do not rewrite

- **`pre-order/terms/`** is legal copy pasted verbatim by Nick. Never reword it.
  Flag discrepancies for him; the known ones are listed in BUILD-NOTES.
- **`assets/animations/homepage-flow-v2.html`** is generated. Its strings come
  from `assets/animations/build-homepage-anim.js`; the dump skips it for that
  reason. Change the builder and re-run it, never the generated file.
- **`class="draft"` figures** await publisher sign-off. Flag them, never invent
  or "correct" a number.
- **Measured savings** (the live counters, the Hawthorn totals) come from the
  platform audit via `/api/public/stats`. If they look wrong, ask the platform
  side. Never guess a plausible-looking figure. The numbers baked into the HTML
  are the audited fallback.

## 4. Voice

- No em dashes anywhere on the site.
- Contractions preferred. Plain, direct, Australian spelling.
- In **customer email bodies** (`api/lead.js`) there is an extra rule: no
  sentence starts with "I". That rule is email-only, not sitewide.
- The brand is confident and concrete, not showroom-polite. Claims trace to
  telemetry or they don't ship.

## 5. What to look for, in priority order

1. **Factual conflicts** between pages (price, timeline, capacity, warranty).
2. **Standing rules**, each one a Nick decision; do not re-litigate them,
   just flag violations:
   - No rebates, subsidies or VEU anywhere.
   - No counting installs ("first", "second", "two homes live"). Place and
     fact instead. The pricing page's early-adopter framing is the one
     deliberate exception.
   - Origin claims scope to the store, controls and technology, never the
     whole system. The heat pump is sourced, not built.
   - Peak window is 5pm to 9pm, measured. Never a 3pm or 4pm variant.
   - 70C flow temperature is a spec commitment, not a measurement.
   - No warranty duration anywhere; a ten-year figure must never appear.
   - Batteries are the wrong tool for heating, not the enemy: "one system
     instead of two".
3. **CTA consistency**: the primary CTA is "Request a Quote". Prose may still
   describe the free site assessment, because that genuinely happens, but a
   sentence directly above a button must not contradict its label.
4. **Unsupported claims**: any savings or performance number with no audit
   behind it.
5. **Voice and mechanics**: em dashes, curly quotes, sentence sprawl.
6. **Titles and meta descriptions**: these are copy too, and often stale. Check
   them against the page they describe.

## 6. Report, do not edit

Return findings as a list of `path:line` with the current text and a proposed
replacement. Check `DECISIONS.md` first: open DECIDE items listed there are
known and waiting on Nick, so flagging them again is noise. Do not edit the pages and do not deploy unless Nick asks in this
session. Deploying is gated on him saying so, and some of this copy is legally
fixed.

If he does ask for the edits: make them in the HTML (never in the dump), then
re-run `npm run copy:dump` to confirm the flags cleared. Bump the `?v=` on
`style.css` only if you touched CSS; copy edits alone need no cache bump.
