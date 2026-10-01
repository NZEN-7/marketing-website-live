/* The live deploy's release guards (tools/release-guards.mjs): "TO CONFIRM"
   in any served file stops `npm run deploy:live` (CTO Re #39). No network,
   no push: the guard functions only, plus this repo as it stands.

     npm run test:releaseguards
*/
import { ignoredFrom, isServed, findUnconfirmed, unconfirmedInRepo } from "../tools/release-guards.mjs";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

let failed = 0;
const check = (label, cond, got) => {
  if (cond) console.log(`ok    ${label}`);
  else { console.error(`FAIL  ${label}${got !== undefined ? ": " + JSON.stringify(got) : ""}`); failed++; }
};
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const ign = ignoredFrom(readFileSync(path.join(root, ".vercelignore"), "utf8"));
check(".vercelignore is read (docs, scripts and tools are not served)", ["docs", "scripts", "tools"].every((x) => ign.indexOf(x) !== -1), ign);
check("a page is served; a doc and a script are not", isServed("privacy/index.html", ign) && !isServed("docs/runbooks/domain-move.md", ign) && !isServed("scripts/test-intake.js", ign));
check("the customer email templates count as served (they must not carry it either)", isServed("api/_first-emails/register-interest.txt", ign));
const fake = { "privacy/index.html": "<p>ok</p>\n<p>Legal entity: TO CONFIRM</p>", "a.css": "body{}", "img.png": "TO CONFIRM", "b.js": "x" };
const hits = findUnconfirmed(Object.keys(fake), (f) => fake[f]);
check("a page with TO CONFIRM is caught, with its line", hits.length === 1 && hits[0].file === "privacy/index.html" && hits[0].line === 2, hits);
check("binary files are not scanned", !hits.some((h) => h.file === "img.png"));
check("a clean set passes", findUnconfirmed(["a.css", "b.js"], (f) => fake[f]).length === 0);
const repo = unconfirmedInRepo(root);
check("this repo, as committed, has no TO CONFIRM in anything served", repo.length === 0, repo);
const live = readFileSync(path.join(root, "tools", "deploy-live.mjs"), "utf8");
check("deploy:live runs the guard before it pushes", /unconfirmedInRepo\(\)/.test(live) && live.indexOf("unconfirmedInRepo()") < live.indexOf("git push deploy"));

console.log(failed ? `\n${failed} CHECK(S) FAILED` : "\nAll release-guard checks passed.");
process.exit(failed ? 1 : 0);
