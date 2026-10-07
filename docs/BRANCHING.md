# Branching and release (website)

Nick's flow, 3 Oct 2026 (CTO item 59). It follows the Drive `CODE CONVENTIONS - read first.md`.

## Branches

| Branch | What it is |
|---|---|
| `main` | Production. Only `develop` merges into it, on Nick's go. `npm run deploy:live` deploys it. |
| `develop` | The trunk. **Every change lands here first**, merged `--no-ff`. Its preview is the stable link below. |
| `feature/<name>`, `bugfix/<name>` | Cut from `develop`. Previewed with `npm run deploy:preview`, merged `--no-ff` into `develop`, then deleted (origin, the mirror's `preview/<branch>`, local). |
| `experimental/<name>` | Throwaway; never merged. Tag `archive/<name>` before deleting if it's worth keeping. |

Another session's work (e.g. Website GPT Dev's branches) is merged into `develop` by the Web Designer after a final read.

## The develop preview

**https://marketing-website-live-git-preview-develop-thermal-dawn.vercel.app**

This is Vercel's branch alias for the mirror's `preview/develop`, so the link never changes. After every merge into `develop`, run `npm run deploy:preview` from `develop` to refresh it. It is a Preview deployment, so the preview guard applies: mail goes only to `TEST_RECIPIENT` and nothing is inserted into the production `leads` table.

## The DELTA

`Mailbox/Web Designer attachments/DELTA - website develop vs production.md` lists every change on `develop` that isn't on `main`: one line each, with what changed, which pages, the branch or SHA, and why. **A change a visitor would notice is marked ⚑**: media and embeds, third-party services, navigation or page structure, new pages, wording, forms and the data they collect, consent and privacy, prices, imagery.

## Release

GitHub branch protection is on (organisation level, 4 Oct 2026): **`main` takes pull requests only** (no direct push, no force-push, no deletion), and `develop` can't be force-pushed or deleted.

1. Nick opens the develop preview and reads the DELTA.
2. The Web Designer opens a **`develop` → `main` pull request** with the DELTA in its description; CI runs on it.
3. **Nick merges it on GitHub** (that's the go).
4. The Web Designer pulls the merged `main`, runs every suite on it, then `npm run deploy:live` (it pushes only to the NZEN-7 mirror, which isn't protected; it never pushes `main` to origin), tags `live-YYYY-MM-DD[b,c…]` and runs the live checks.
5. **Live copy record:** from `main`, `npm run copy:live -- "<Drive>/Growth +/Marketing +/Website/Live copy" "Web N"` writes one file per page plus the shared menu and footer into `Live copy/<YYYY-MM-DD>/` (one way, repo → Drive; nobody edits it).
6. Clear the shipped lines from the DELTA.

A ⚑ change Nick hasn't seen never ships. Nothing reaches `main` or production without his go.

## Cache-busting

Bump `?v=` on an asset in its **own non-merge commit**: `check:cachebust` reads `git log -S`, which skips merge commits. When two branches both bump the same asset, resolve the conflict to the trunk's number in the merge, then bump once more in a separate commit.
