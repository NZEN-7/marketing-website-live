/* deploy:preview may only ever write refs/heads/preview/<branch> on the
   mirror, never main. This checks the pure part (which ref) and the argument
   refusal, without touching any remote.

     npm run test:deploypreview
*/
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { previewRef, PREFIX, MIRROR } from "../tools/deploy-preview.mjs";

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

// Any argument is refused before anything else runs (exit 2), so no refspec
// can be passed through `npm run deploy:preview -- ...`.
const script = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "tools", "deploy-preview.mjs");
let code = 0;
try { execFileSync(process.execPath, [script, "main:main"], { stdio: "pipe" }); } catch (e) { code = e.status; }
check("an extra argument is refused with exit 2", code === 2, code);

console.log(failed ? `\n${failed} CHECK(S) FAILED` : "\nAll deploy:preview checks passed.");
process.exit(failed ? 1 : 0);
