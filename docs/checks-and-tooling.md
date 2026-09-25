# Checks and tooling

Everything is `node` with no dependencies except `nodemailer` for the function.
Two image scripts are PowerShell.

## `npm run`

| Script | What it does | When |
|---|---|---|
| `serve` | Static server on http://localhost:8080 serving the repo root, so root-relative links resolve (they do not over `file://`) | Any local look. The desktop app's Browser pane uses this via `.claude/launch.json` |
| `deploy:live` | Force-push `main` to the Vercel mirror. Refuses a dirty tree or a non-main branch | Every committed batch; Nick reviews on live, not local |
| `test:email` | Prints all notification emails and the autoresponder with sample data. No credentials, no network | After touching `api/lead.js` |
| `test:parser` | Feeds the generated emails through the real CRM parser (`scripts/apps-script/lead-parser.gs`), fails on any label drift | **Required** after touching `formatNotification()` |
| `test:leadrow` | Checks the Supabase row for every form: column names, mapping, nulls | After touching `leadRow()` or adding a field |
| `copy:dump` | Writes the copy-review pack to `.claude/copy-review/` | Before any copy review |
| `check:cachebust` | Are the `?v=` numbers newer than the files they point at? | Before committing a CSS or JS change |

## Verifying a deploy

Fetch the live page, not the local one, and read what came back:

```bash
curl -s "https://www.thermaldawn.com/pre-order/terms/?cb=$RANDOM" | grep -o "<title>[^<]*</title>"
```

Propagation takes about half a minute. For redirects, follow the chain and
check the final URL and status:

```bash
curl -sL -o /dev/null -w "%{url_effective} (%{http_code})\n" "https://www.thermaldawn.com/pre-order/founder-premium"
```

For an image change, download the CDN copy and check its bytes or pixels; a
same-named image is served from cache for a year.

## Browser checks that have caught real bugs

- **Set an explicit viewport before measuring.** The preview pane can report a
  0×0 viewport and freeze transitions.
- **Measure left and right edges against the viewport centre**, not by eye:
  `getBoundingClientRect()` on the wrap, headings and paragraphs. The terms
  and booking pages both shipped lopsided once because a measure cap sat on
  the paragraph, not the column.
- **`document.documentElement.scrollWidth` at 375px** should equal the
  viewport. A `nowrap` label wider than a phone was the last cause.
- **Layout Shifts in the Performance panel** on `/` and `/hydronic/`: the
  header injection reserves 74px so the page does not jump.
- **Reduced motion** in Rendering: nothing lifts, the FAQ snaps, anchors jump.

## Image tooling

- `scripts/compose-phone-mockup.ps1`: re-skins the marketing phone render with
  a new app screenshot. The screen rectangle is measured by **hue** (the bezel
  is warm, the status bar is neutral), the corners are circles of radius 40,
  and the notch is blended by deviation from a per-row background reference,
  composed at 2× or 3× so the screenshot keeps its resolution.
- `scripts/edit-app-screenshot.ps1`: edits a screenshot by lifting real glyphs
  from another screenshot (no font is drawn), so a changed clock or reading
  looks like the app made it.
- `scripts/make-gallery-images.js`: one-off, brings originals from the photo
  library into `assets/img/` with `sharp` installed temporarily.

Two PowerShell traps recorded in those scripts: variable names are
case-insensitive (`$frame` and `$Frame` are the same variable), and a
`[string]` parameter coerces a Bitmap to the string "System.Drawing.Bitmap".

## Animation build

```bash
node assets/animations/build-homepage-anim.js assets/animations
```

Regenerates `homepage-flow-v2.html` from the marketing scene and the shell,
prints "all blocks present", and the diff of the output should be only the
intended block. Commit the builder and the output together and bump the
animation's `?v=` on the three pages that embed it.

## Sessions and hand-offs

- `CLAUDE.md` is what a session reads first. The hard rules there are the
  ones that have each been broken at least once.
- The session for this repo is **Web Designer**. Its status card is
  `Product Management/Session status/STATUS - Web Designer.md`, overwritten at
  the end of any session that shipped, changed a decision or got blocked.
- `.claude/skills/copy-review/` is the in-session copy review;
  `feedback/REVIEWER-PROMPT.md` is the prompt for an external one.
