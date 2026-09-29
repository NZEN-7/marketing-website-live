// Push the current branch to the Vercel mirror as a PREVIEW, never as main.
//
// Same re-stamp as deploy-live.mjs (Vercel Hobby only builds commits whose
// committer maps to the project owner's GitHub account), but the target is
// always refs/heads/preview/<current branch> on NZEN-7/marketing-website-live.
// Vercel builds any non-main branch as a preview deployment; production only
// changes through `npm run deploy:live`, on Nick's go.
//
// The safety is in the code, not the command line, so that a permission rule
// can allow exactly `npm run deploy:preview`:
//   - it takes NO arguments; any argument is refused, so no refspec can be
//     smuggled in;
//   - it builds the target itself and refuses anything outside preview/;
//   - it refuses main, a detached HEAD, a dirty tree, and a `deploy` remote
//     that is not the mirror;
//   - git is called with argument arrays, never through a shell.
//
// Usage: npm run deploy:preview      (from the branch to preview)
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

export const MIRROR = "https://github.com/NZEN-7/marketing-website-live.git";
export const PREFIX = "refs/heads/preview/";
const TMP = "preview-tmp";

/** The one ref this script may push to, or throws. Pure, so it is tested. */
export function previewRef(branch) {
  const b = String(branch || "");
  if (!b || b === "HEAD") throw new Error("detached HEAD: check out the branch to preview");
  if (b === "main" || b === "master") throw new Error(`refusing to preview ${b}: production is npm run deploy:live, on Nick's go`);
  if (b === TMP || b === "deploy-tmp") throw new Error(`refusing to preview the throwaway branch ${b}`);
  if (b.startsWith("preview/")) throw new Error("branch already starts with preview/: preview its source branch instead");
  if (b.startsWith("refs/") || b.startsWith("heads/")) throw new Error(`refusing a ref-like branch name: ${b}`);
  // git's own rules are wider; this is the narrow set our branch names use.
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*(\/[A-Za-z0-9][A-Za-z0-9._-]*)*$/.test(b) || b.includes("..") || b.endsWith(".lock")) {
    throw new Error(`unexpected branch name: ${JSON.stringify(b)}`);
  }
  const ref = PREFIX + b;
  // Belt and braces: whatever the checks above let through, the target is
  // under preview/ and is never main.
  if (!ref.startsWith(PREFIX) || ref === "refs/heads/main") throw new Error(`refusing target ${ref}`);
  return ref;
}

function git(...args) {
  return execFileSync("git", args, { stdio: ["ignore", "pipe", "pipe"] }).toString().trim();
}

function main() {
  if (process.argv.length > 2) {
    console.error("deploy:preview takes no arguments; it previews the checked-out branch.");
    process.exit(2);
  }
  if (git("status", "--porcelain") !== "") {
    console.error("working tree not clean: commit first");
    process.exit(1);
  }
  const branch = git("rev-parse", "--abbrev-ref", "HEAD");
  let ref;
  try { ref = previewRef(branch); } catch (e) { console.error(e.message); process.exit(1); }

  let url = "";
  try { url = git("remote", "get-url", "deploy"); } catch { git("remote", "add", "deploy", MIRROR); url = MIRROR; }
  if (url !== MIRROR) {
    console.error(`the deploy remote is ${url}, not the mirror; refusing`);
    process.exit(1);
  }

  git("branch", "-f", TMP, "HEAD");
  git("checkout", "-q", TMP);
  try {
    git("-c", "user.name=NZEN-7", "-c", "user.email=NZEN-7@users.noreply.github.com",
        "commit", "--amend", "--no-edit", "--reset-author", "-q");
    // --force applies to this one preview ref only: each run re-stamps, so a
    // second push to the same preview branch cannot fast-forward.
    const out = execFileSync("git", ["push", "deploy", `${TMP}:${ref}`, "--force"],
      { stdio: ["ignore", "pipe", "pipe"] });
    console.log(out.toString().trim());
  } catch (e) {
    console.error((e.stderr && e.stderr.toString()) || e.message);
    process.exitCode = 1;
  } finally {
    git("checkout", "-q", branch);
    git("branch", "-q", "-D", TMP);
  }
  if (!process.exitCode) {
    console.log(`previewed: ${branch} -> NZEN-7/marketing-website-live ${ref.slice("refs/heads/".length)} (Vercel builds a preview; production is untouched)`);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
