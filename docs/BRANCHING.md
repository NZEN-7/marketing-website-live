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

1. Nick opens the develop preview, reads the DELTA and says go.
2. Merge `develop` → `main` `--no-ff`; run every suite on the merged `main`.
3. `npm run deploy:live`; tag `live-YYYY-MM-DD[b,c…]`; run the live checks.
4. Clear the shipped lines from the DELTA.

A ⚑ change Nick hasn't seen never ships. Nothing reaches `main` or production without his go.

## Cache-busting

Bump `?v=` on an asset in its **own non-merge commit**: `check:cachebust` reads `git log -S`, which skips merge commits. When two branches both bump the same asset, resolve the conflict to the trunk's number in the merge, then bump once more in a separate commit.
