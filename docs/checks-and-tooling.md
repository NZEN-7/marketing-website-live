# Checks and tooling

Everything is `node` with no dependencies except `nodemailer` for the function.
Two image scripts are PowerShell.

## `npm run`

| Script | What it does | When |
|---|---|---|
| `serve` | Static server on http://localhost:8080 serving the repo root, so root-relative links resolve (they do not over `file://`) | Any local look. The desktop app's Browser pane uses this via `.claude/launch.json` |
| `deploy:live` | Force-push `main` to the Vercel mirror. Refuses a dirty tree or a non-main branch | **Only on Nick's go** (HOW CODE SESSIONS WORK, 26 Sep 2026). This is the production deploy |
| `test:email` | Prints all notification emails and the autoresponder with sample data. No credentials, no network | After touching `api/lead.js` |
| `test:parser` | Feeds the generated emails through the real CRM parser (`scripts/apps-script/lead-parser.gs`), fails on any label drift | **Required** after touching `formatNotification()` |
| `test:leadrow` | Checks the Supabase row for every form: column names, mapping, nulls | After touching `leadRow()` or adding a field |
| `copy:dump` | Writes the copy-review pack to `.claude/copy-review/` | Before any copy review |
| `check:cachebust` | Are the `?v=` numbers newer than the files they point at? | Before committing a CSS or JS change |
| `test:e2e` | Website GPT Dev's Playwright suite (`scripts/test-site-e2e.cjs`, see `scripts/SITE-E2E.md`): a loopback server of the public files, every page at 1280 and 390, the design defaults, keyboard and focus, and every intake path with `/api/` mocked. Needs Chrome installed | Before merging into `develop`; in CI |
| `test:e2e:url <url>` | The same suite, read-only (GET only, API and cross-origin requests aborted), against the live site or a preview. Add `--design sitewide` once the calm defaults are on that site | After a deploy, or on the develop preview |

## CI on every PR

`.github/workflows/ci.yml` runs on every pull request and every push to `main` or `develop`.
It deploys nothing.

| Job | Runs | Expect |
|---|---|---|
| `checks` | `npm ci`, the four checks above, then `python tools/check_no_pii.py` | 14 / 7 / 31 / 8 ok on `main`, and "no customer identity found" |
| `secrets` | gitleaks 8.30.1 (checksum-pinned CLI) over the full history | "no leaks found" |

- **PII guard** (`tools/check_no_pii.py`): ported from energy-model on 26 Sep 2026, with the same hashed name list. Retuned for this repo: our own addresses and published number are excepted, `+61` phones are caught, and two public words that collide with a watched name are named in `PUBLIC_WORDS`. Test fixtures use made-up identities on `example.com`, never a real lead's, even to copy a real email's layout. Run it locally with `python tools/check_no_pii.py`.
- **Hooks** (`git config core.hooksPath .githooks`, once per clone): `pre-commit` runs the guard over the tree before each commit; `commit-msg` runs it over the message (`python tools/check_no_pii.py --message <file>`, ported from TD-Platform, standing rule from 28 Sep 2026). The message check prints the line number and category only; add `--show` to see the text.
- **False positives** for gitleaks go in `.gitleaksignore`, one fingerprint per line, each with its reason. A real secret is rotated by Nick, never ignored.
- A red PR is not reviewed. Never skip or weaken a check to get green without saying so in the PR and getting the CTO's OK.

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
