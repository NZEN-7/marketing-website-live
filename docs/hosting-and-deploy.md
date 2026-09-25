# Hosting and deploy

## Where it runs

- **Vercel project `marketing-website-live`**, static, no build command.
  Serves the repo root as-is plus `api/lead.js` as a serverless function.
- **Live URL:** https://www.thermaldawn.com. `www` is canonical; the apex 308s
  to it. Launched on this domain 25 Aug 2026.
- **freevolt.com.au** serves the same build and should redirect to
  thermaldawn.com. Host-conditional rules in `vercel.json` did not fire, so
  this has to be done in Vercel's domain settings (still open).

## The deploy path

```
git commit on main  ->  npm run deploy:live  ->  NZEN-7/marketing-website-live (mirror)  ->  Vercel builds
```

`tools/deploy-live.mjs` refuses a dirty tree or any branch but `main`, creates
a throwaway `deploy-tmp` branch, re-stamps HEAD with the `NZEN-7` noreply
identity, force-pushes it to the mirror's `main`, and deletes the branch.
Reason: Vercel Hobby only deploys commits whose committer maps to the project
owner's GitHub account, and org commits are authored as nick@thermaldawn.com.
Org history is never touched, and the mirror is never edited directly.

Two consequences worth knowing:

- **The source of truth is `Thermal-Dawn/marketing-website`, branch `main`,
  in the working copy.** `origin/main` on GitHub is not routinely pushed and
  can sit far behind. What is live is what was last `deploy:live`d.
- A deploy takes about half a minute to propagate. Verify by fetching the
  live page, not the local one (see [checks-and-tooling.md](checks-and-tooling.md)).

## `vercel.json` and `netlify.toml`

They are twins: headers, caching and the redirects are kept identical. Edit one
and mirror the other. Netlify is not the live host; the file is kept so the
site can move without rework.

### Caching, and why filenames matter

| Path | Cache-Control | What it means for edits |
|---|---|---|
| `/assets/img/*` | `max-age=31536000` (a year) | A changed image needs a **new filename** (`-v2`, `-v3`). Same name, old picture, for a year |
| `/assets/fonts/*` | a year, immutable | Fonts never change in place |
| `/assets/css/*`, `/assets/js/*`, `/assets/animations/*` | `max-age=300, must-revalidate` | Five minutes at the edge, but browsers hold them, so **bump the `?v=` query on every reference** when you edit one. `npm run check:cachebust` tells you if you forgot |
| everything else | default | Pages pick up a deploy within moments |

Security headers on every response: `nosniff`, `X-Frame-Options: SAMEORIGIN`,
`Referrer-Policy: strict-origin-when-cross-origin`.

### Redirects

`trailingSlash: true` normalises every URL to end in a slash **before**
redirects are matched. So every redirect source is written twice, with and
without the slash; a bare `/product` on its own never fires. This silently
killed all eighteen legacy Wix redirects until 25 Aug 2026.

The 54 rules cover: the old Wix paths (`/product`, `/pricing`, `/learn`,
`/how-it-works`, `/register`, `/contact-form`, `/pre-order-form/*`, and every
`/post/<slug>` blog URL), the apex to `www`, and
`/pre-order/founder-premium` to `/pre-order/booking/` (24 Sep 2026).

## Domains and DNS

- Apex `A` record to `76.76.21.21`, `www` `CNAME` to `cname.vercel-dns.com`.
  Wix is out of the web path entirely.
- **MX, SPF and DMARC still live in the Wix DNS zone**, and Google Workspace
  mail for thermaldawn.com depends on them. They have nothing to do with
  hosting. Never touch them when changing where the website points.
- The domain is still **registered through Wix and renews 3 Nov 2026**. The
  plan is to transfer out before then, rebuilding the zone at the new host and
  verifying it *before* nameservers change. That is the one moment email is
  genuinely at risk.
- Search Console: same domain, same property, history retained. Do not use
  "Change of Address"; that is for moving between domains.
- The portal is thermal-dawn-platform.vercel.app. `td-platform.vercel.app` is
  a stale alias on a lost account; never reference it.

## What is not served

The repo root is the site, so anything not excluded is publicly fetchable at
its path. `.vercelignore` keeps the working files out of the deploy
(`BUILD-NOTES.md`, `CLAUDE.md`, `DECISIONS.md`, `MISSING-MEDIA.md`, `docs/`,
`feedback/`, `scripts/`, `tools/`, the package files), and `netlify.toml`
carries a forced 404 for each of the same paths, per the twins rule. Add a new
internal file to both.

## Environment variables (Vercel)

| Variable | Used by |
|---|---|
| `GMAIL_USER`, `GMAIL_APP_PASSWORD` | `api/lead.js`, SMTP transport for notifications and autoresponders |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | `api/lead.js`, the `leads` insert. If unset the insert is skipped and the request still succeeds |

Nothing else is configured. There is no secret in the repo.
