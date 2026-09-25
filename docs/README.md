# How this repo hangs together

The Thermal Dawn marketing site: **28 hand-written HTML pages, one stylesheet,
four small JavaScript files, one serverless function.** No framework, no build
step, no bundler. Open any page in a browser and that is the site.

This folder explains the system. It does not restate `CLAUDE.md` (the rules a
session must follow) or `BUILD-NOTES.md` (the history of how it got built);
it points to them where they hold the detail.

| Read | For |
|---|---|
| [architecture.md](architecture.md) | The shape of the thing: what talks to what, one diagram |
| [lead-pipeline.md](lead-pipeline.md) | A form submission from the browser to Gmail, the CRM, Supabase and Stripe, and the three tests that guard it |
| [hosting-and-deploy.md](hosting-and-deploy.md) | Vercel, the mirror-push deploy, caching, redirects, domains and DNS |
| [pages-and-content.md](pages-and-content.md) | The page map, what is indexed, the embedded interactives, legal copy, live figures |
| [design-system.md](design-system.md) | `style.css`: tokens, the layered blocks, the contrast rules, fonts, motion, and how it relates to the brand and the customer documents |
| [checks-and-tooling.md](checks-and-tooling.md) | Every `npm run` script, the local server, the copy-review pack, the image scripts, and how to verify a deploy |

## The one-paragraph version

Pages are static HTML under `/`, `/hydronic/`, `/intelligence/`, `/mission/`,
`/blog/`, `/contact/`, `/pre-order/` and `/thank-you/`. Each links
`assets/css/style.css` and `assets/js/site.js` (which injects the shared
header and footer at runtime, so there are no server-side includes). Five forms
post JSON to `api/lead.js`, a Vercel function that emails a fixed-layout
notification to Gmail (the system of record), writes a row to Supabase, and
for deposits hands the browser to a Stripe Payment Link. Savings figures on the
page tick up from audited fallbacks and, if the platform's public stats
endpoint answers, glide to live fleet totals. Deploys are a force-push of
`main` to a personal mirror repo that Vercel watches. The live site is
https://www.thermaldawn.com.

## Where the other documents live

| File | What it is |
|---|---|
| `CLAUDE.md` | The rules. Deploy path, cache busting, the email contract, the Supabase rule, the redirect rule, domains. Read it before changing anything |
| `BUILD-NOTES.md` | Build and QA history since July 2026, with the reasoning behind most choices |
| `DECISIONS.md` | Open decisions, carried risks, and a changelog. Notion is the backlog of record |
| `MISSING-MEDIA.md` | Images the copy references that are not yet exported |
| `.claude/W1-forms-spec.md`, `W1b-deposits-spec.md` | The implementation specs the forms and deposit flow were built to. W1b describes the two-tier deposit offer that was replaced on 24 Sep 2026; its mechanics still apply |
| `.claude/W2-*.md` | Specs for the flow animation, which lives in the TD-Platform repo, not here |
| `feedback/` | Copy-review rounds and the design pass, one folder per round |
| `scripts/apps-script/SETUP.md` | How the Gmail-to-CRM capture script is installed |

Product requirements live outside the repo, in
`Engineering & Product +/Product Management/PRDs/`. This session's status card
is `Product Management/Session status/STATUS - Web Designer.md`.
