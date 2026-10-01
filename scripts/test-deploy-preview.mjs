/* deploy:preview may only ever write refs/heads/preview/<branch> on the
   mirror, never main. This checks the pure part (which ref) and the argument
   refusal, without touching any remote.

     npm run test:deploypreview
*/
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { readFileSync } from "node:fs";
import { previewRef, PREFIX, MIRROR, hasPreviewGuard, previewGuardProblems, stripComments } from "../tools/deploy-preview.mjs";

let failed = 0;
const check = (label, cond, got) => {
  if (cond) console.log(`ok    ${label}`);
  else { console.error(`FAIL  ${label}${got !== undefined ? ": " + JSON.stringify(got) : ""}`); failed++; }
};
const refuses = (b) => { try { previewRef(b); return false; } catch { return true; } };

check("a normal branch goes under preview/", previewRef("b07-first-emails") === "refs/heads/preview/b07-first-emails");
check("a nested branch stays under preview/", previewRef("site/hawthorn") === "refs/heads/preview/site/hawthorn");
for (const b of ["main", "master", "HEAD", "", null, "preview-tmp", "deploy-tmp", "preview/b07", "a..b", "x.lock",
                 "-f", "--force", "main:main", "b07 main", "b07;rm", "+main", "refs/heads/main", "b07:refs/heads/main"]) {
  check(`refuses ${JSON.stringify(b)}`, refuses(b));
}
check("every accepted ref starts with the preview prefix", ["b07-first-emails", "b09-cost-table", "x/main"]
  .every((b) => previewRef(b).startsWith(PREFIX)));
check("the mirror is the NZEN-7 repo", MIRROR === "https://github.com/NZEN-7/marketing-website-live.git");

// The preview guard (CTO Re #31 item 28): an unguarded lead.js is refused.
const here = path.dirname(fileURLToPath(import.meta.url));
check("this branch's lead.js has the preview guard", hasPreviewGuard(readFileSync(path.join(here, "..", "api", "lead.js"), "utf8")));
// P-S2 (GPT Web, 1 Oct): the preflight checks the guard's shape, not tokens,
// and fails closed. A small lead.js that is safe, then ways to break it.
const SAFE = `
const isProduction = () => process.env.VERCEL_ENV === "production";
function routeTo(addr) {
  if (isProduction()) return addr;
  const t = String(process.env.TEST_RECIPIENT || "").trim();
  return isEmail(t) ? t : null;
}
async function recordLead(d) {
  if (!url) return "skipped";
  if (!isProduction()) return "skipped (non-production)";
  const r = await fetch(url + "/rest/v1/leads", {});
}
async function handler() {
  const notifyTo = routeTo(NOTIFY_TO);
  await transport.sendMail({ from, to: notifyTo, subject: "x" });
  const to = routeTo(data.email);
  await transport.sendMail({
    from: x,
    to,
    subject: "y",
  });
}`;
check("a safe lead.js passes", previewGuardProblems(SAFE).length === 0, previewGuardProblems(SAFE));
check("missing or empty source fails closed", !hasPreviewGuard("") && !hasPreviewGuard(undefined) && !hasPreviewGuard("   \n"));
check("the old token-only snippet is now refused",
  !hasPreviewGuard('const isProduction = () => process.env.VERCEL_ENV === "production"; // TEST_RECIPIENT'));
check("an unguarded sendMail is refused", !hasPreviewGuard(SAFE.replace("to: notifyTo", "to: data.email")));
check("a second, unguarded sendMail is refused", !hasPreviewGuard(SAFE + '\ntransport.sendMail({ to: NOTIFY_TO });'));
check("an unconditional recordLead is refused", !hasPreviewGuard(SAFE.replace('if (!isProduction()) return "skipped (non-production)";', "")));
check("the insert guard after fetch is refused", !hasPreviewGuard(SAFE.replace('  if (!isProduction()) return "skipped (non-production)";\n  const r = await fetch(url + "/rest/v1/leads", {});',
  '  const r = await fetch(url + "/rest/v1/leads", {});\n  if (!isProduction()) return "skipped (non-production)";')));
check("the old URL-substring insert guard is refused", !hasPreviewGuard(SAFE.replace('if (!isProduction()) return', 'if (!isProduction() && url.indexOf(REF) !== -1) return')));
check("routeTo without TEST_RECIPIENT is refused", !hasPreviewGuard(SAFE.replace("process.env.TEST_RECIPIENT", "process.env.OTHER")));
check("a guard that exists only in a comment is refused", !hasPreviewGuard(SAFE.replace('if (!isProduction()) return "skipped (non-production)";', '// if (!isProduction()) return "skipped (non-production)";')));
check("isProduction must test VERCEL_ENV === production", !hasPreviewGuard(SAFE.replace('process.env.VERCEL_ENV === "production"', "true")));
check("stripComments keeps URLs in strings", stripComments('const u = "https://x.y"; // gone').trim() === 'const u = "https://x.y";');

// Any argument is refused before anything else runs (exit 2), so no refspec
// can be passed through `npm run deploy:preview -- ...`.
const script = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "tools", "deploy-preview.mjs");
let code = 0;
try { execFileSync(process.execPath, [script, "main:main"], { stdio: "pipe" }); } catch (e) { code = e.status; }
check("an extra argument is refused with exit 2", code === 2, code);

console.log(failed ? `\n${failed} CHECK(S) FAILED` : "\nAll deploy:preview checks passed.");
process.exit(failed ? 1 : 0);
