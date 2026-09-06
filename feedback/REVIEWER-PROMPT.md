# Reviewer prompt

Paste the block below to any agent doing a copy review. It is deliberately
generic: the round-specific parts (which folder to save to, the current
standing rules, the page list) live in the generated pack itself, so this
prompt does not go stale when the copy does.

Before sending it, run `npm run copy:dump` so the pack matches the live site.
If several reviewers are going out at once, add a lane from `LANES.md` in the
round folder, following the pattern of the 22 Aug round.

---

You are reviewing the copy on the Thermal Dawn marketing website.

**Read `.claude/copy-review/INDEX.md` first, in full, before opening any page
file.** It carries the standing rules the copy must hold to, and most of them
are commercial or legal rather than stylistic, so a "fix" that breaks one is
worse than the problem it solves. It also tells you which folder to save your
review to. Do not skim it.

The pack is generated from the live HTML by `npm run copy:dump`:

- `.claude/copy-review/INDEX.md` — the rules, and an index of all 28 pages
- `.claude/copy-review/pages/*.md` — one file per page

**Never edit anything in that folder.** It is derived output. Every entry is
tagged `path:line` pointing at the real HTML, and that is the only address that
means anything. Report findings as: `path:line`, the current text, and your
proposed replacement. Nick applies the edits or delegates them.

Each page file has up to five sections, and the last two are new. Review all of
them:

| Section | What it is |
|---|---|
| Copy | The prose, in page order |
| Chart labels | Text inside SVG diagrams. Real copy, easy to miss |
| Embedded interactive | Copy inside an iframed animation. The reader sees it on the page even though it is not in that page's HTML |
| Images | Every image with its alt text. **Alt text is copy**: a screen reader speaks it aloud and Google reads it as a description of the picture |
| Placeholders and labels | `placeholder` and `aria-label` text. A customer reads placeholders inside form fields |

Images and Placeholders were invisible to every review round before 27 Aug
2026, so treat them as never having been read. On Images, check two things: is
the alt wording right, and is the image still the one the surrounding copy is
talking about.

Flags in the margin mean:

- `[DRAFT]` — a figure awaiting publisher sign-off. **Not an error.** Flag only
  if the number contradicts another page.
- `[CTA]` — a button label. Short, verb-first, and consistent with its
  destination.
- `[EM-DASH]`, `[EN-DASH]`, `[CURLY-QUOTE]` — banned punctuation that slipped
  in. Report the line; the fix is mechanical.

Two things to be careful about, because getting them wrong costs real money:

- **`pre-order/terms/` is legal copy, pasted verbatim by Nick.** Flag anything
  wrong with it. Never reword it.
- **Measured figures come from platform telemetry**, not from the copy. If a
  savings number, temperature or evening-carry stat looks wrong, say so and
  ask. Never substitute a number that merely sounds plausible.

What is actually useful, in rough order:

1. **A claim on one page contradicting another.** This is the failure mode that
   matters most on this site. Read across pages, not one at a time.
2. **A promise the business cannot keep**, especially anywhere near the quote
   and deposit forms.
3. **A sentence a customer would have to read twice.**
4. Tone drift, padding, and hedging that weakens a true claim.

Voice: plain, specific, Australian spelling, contractions welcome. Concrete
beats grand. If a sentence could appear on any heat pump website, it is not
doing any work.

Write one markdown file named for you into the folder INDEX.md nominates, for
example `COPY-FEEDBACK-yourname.md`. That folder is the record of who said
what, so do not overwrite anyone else's file. If you were given a lane, report
on your lane only, and put anything you noticed outside it in a short "outside
my lane" section at the end rather than working it up.
