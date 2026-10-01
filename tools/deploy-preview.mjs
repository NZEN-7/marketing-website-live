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
//   - it refuses a branch whose api/lead.js lacks the preview guard (off
//     production, mail to TEST_RECIPIENT only and no leads insert), or whose
//     api/lead.js can't be read (fail closed);
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

/** Blank out comments (keeping strings, so "https://" survives), so a guard
    that exists only in a comment doesn't count. Good enough for our own
    source; not a JavaScript parser. */
export function stripComments(src) {
  let out = "", i = 0;
  while (i < src.length) {
    const c = src[i], d = src[i + 1];
    if (c === "/" && d === "*") { const j = src.indexOf("*/", i + 2); i = j < 0 ? src.length : j + 2; out += " "; continue; }
    if (c === "/" && d === "/") { while (i < src.length && src[i] !== "\n") i++; continue; }
    if (c === '"' || c === "'" || c === "`") {
      let j = i + 1;
      while (j < src.length && src[j] !== c) j += src[j] === "\\" ? 2 : 1;
      out += src.slice(i, j + 1); i = j + 1; continue;
    }
    out += c; i++;
  }
  return out;
}

/** The body of `function name(...) { ... }`, by brace matching, or "". */
function fnBody(src, name) {
  const m = new RegExp("function\\s+" + name + "\\s*\\([^)]*\\)\\s*\\{").exec(src);
  if (!m) return "";
  let depth = 1, i = m.index + m[0].length;
  const start = i;
  for (; i < src.length && depth; i++) { if (src[i] === "{") depth++; else if (src[i] === "}") depth--; }
  return src.slice(start, i - 1);
}

/** What stops this api/lead.js being safe on a public preview (GPT Web P-S2).
    An empty list means the guard is in place. A preview runs with the Preview
    scope's Gmail and Supabase settings, so a branch without the guard could
    mail any address or write a production lead (CTO Re #31 item 28).
    Checks, on the source with comments removed:
      1. the source is there at all (missing or unreadable fails closed);
      2. routeTo() exists, is gated on production, and falls back to TEST_RECIPIENT;
      3. every sendMail({...}) sends to a routeTo() result;
      4. recordLead() returns before any fetch() when not in production.
    A heuristic over our own code, not a proof: test:handler and
    test:previewguard exercise the real behaviour in CI. Pure, so it is tested. */
export function previewGuardProblems(leadSrc) {
  const raw = String(leadSrc || "");
  if (!raw.trim()) return ["api/lead.js is missing or empty"];
  const src = stripComments(raw);
  const problems = [];
  const prodTest = /isProduction\(\)|VERCEL_ENV\s*===\s*["']production["']/;
  const isProd = fnBody(src, "isProduction") || (/const\s+isProduction\s*=\s*\(\)\s*=>([^;]*);/.exec(src) || [])[1] || "";
  if (isProd && !/VERCEL_ENV\s*===\s*["']production["']/.test(isProd)) problems.push("isProduction() doesn't test VERCEL_ENV === \"production\"");
  const route = fnBody(src, "routeTo");
  if (!route) problems.push("no routeTo()");
  else if (!prodTest.test(route) || !/TEST_RECIPIENT/.test(route)) problems.push("routeTo() isn't gated on production with a TEST_RECIPIENT fallback");
  const routed = new Set((src.match(/(?:const|let|var)\s+(\w+)\s*=\s*routeTo\(/g) || []).map((d) => d.replace(/^(?:const|let|var)\s+/, "").replace(/\s*=.*$/, "")));
  const calls = src.split(/\.sendMail\(\s*\{/).slice(1);
  if (!calls.length) problems.push("no sendMail() call found");
  calls.forEach((c, n) => {
    const to = /(?:^|[,{\s])to\s*(?::\s*([^,\n}]+)|(?=[,\n}]))/.exec(c.slice(0, 600));
    const v = to ? (to[1] || "to").trim() : "";
    if (!(/^routeTo\(/.test(v) || routed.has(v))) problems.push(`sendMail #${n + 1} sends to ${v || "an unknown address"}, not a routeTo() result`);
  });
  const rec = fnBody(src, "recordLead");
  if (!rec) problems.push("no recordLead()");
  else {
    const guard = /if\s*\(\s*!\s*isProduction\(\)\s*\)\s*return\b/.exec(rec);
    const fetchAt = rec.indexOf("fetch(");
    if (!guard || (fetchAt !== -1 && guard.index > fetchAt)) problems.push("recordLead() doesn't return before fetch() off production");
  }
  return problems;
}
export function hasPreviewGuard(leadSrc) { return previewGuardProblems(leadSrc).length === 0; }

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

  let lead = "";
  try { lead = git("show", "HEAD:api/lead.js"); } catch { lead = ""; }
  const problems = previewGuardProblems(lead);        // missing source fails closed
  if (problems.length) {
    console.error("api/lead.js on this branch isn't safe on a public preview (it could send real mail or " +
      "write a production lead):\n  - " + problems.join("\n  - "));
    process.exit(1);
  }

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
