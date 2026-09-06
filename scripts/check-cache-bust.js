/* Are the ?v= numbers actually newer than the files they point at?

     npm run check:cachebust

   CLAUDE.md makes bumping ?v= a hard rule, because css/js sit on a plain
   filename with a 5-minute server cache and browsers hold them longer. Nothing
   checked it, so it failed the way unchecked rules do: silently, and only for
   other people. Eight commits changed style.css after its last bump. Every one
   verified fine locally, because a hot-swapped stylesheet with a cache-buster
   on it is exactly the thing the browser would not have done.

   For each versioned asset this compares the commit that last changed the FILE
   against the commit that last changed the ?v= REFERENCE. If the file is newer,
   the bump is missing.

   Uncommitted edits to a file count as newer than any committed reference, so
   this also catches "I changed it and have not bumped yet" before the commit.
*/
"use strict";

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const sh = (cmd) => execSync(cmd, { cwd: ROOT, encoding: "utf8" }).trim();

/* asset path -> the basename as it appears in a ?v= reference */
const ASSETS = [
  "assets/css/style.css",
  "assets/js/site.js",
  "assets/js/live-stats.js",
  "assets/js/forms.js",
  "assets/js/config.js",
  "assets/animations/homepage-flow-v2.html",
  "assets/animations/hydronic-before-after.html",
  "assets/animations/intelligence-day.html",
];

const pages = sh('git ls-files "*.html"')
  .split("\n")
  .filter((p) => p && !p.startsWith("assets/"));

/* commit order, newest first, so "is A newer than B" is an index comparison */
const order = sh("git log --format=%H").split("\n");
const rank = new Map(order.map((h, i) => [h, i]));   // 0 = newest
const newerThan = (a, b) => rank.get(a) < rank.get(b);

let failed = 0;
for (const file of ASSETS) {
  const base = path.basename(file);
  const refs = [];
  for (const p of pages) {
    const src = fs.readFileSync(path.join(ROOT, p), "utf8");
    const m = src.match(new RegExp(base.replace(/\./g, "\\.") + "\\?v=(\\d+)"));
    if (m) refs.push({ page: p, v: Number(m[1]) });
  }
  if (!refs.length) continue;

  const versions = [...new Set(refs.map((r) => r.v))];
  if (versions.length > 1) {
    console.log(`FAIL  ${base}: pages disagree on the version: ${versions.join(", ")}`);
    refs.filter((r) => r.v !== versions[0]).slice(0, 4)
        .forEach((r) => console.log(`        ${r.page} has v=${r.v}`));
    failed++;
    continue;
  }

  const v = versions[0];
  const fileCommit = sh(`git log -1 --format=%H -- "${file}"`);
  const dirty = sh(`git status --porcelain -- "${file}"`) !== "";
  /* the commit that introduced THIS version number in the references */
  const refCommit = sh(`git log -1 --format=%H -S"${base}?v=${v}" -- ${pages.map((p) => `"${p}"`).join(" ")}`);

  if (!refCommit) {
    console.log(`FAIL  ${base}: v=${v} appears in no commit; bump it or commit the pages`);
    failed++;
  } else if (dirty) {
    console.log(`FAIL  ${base}: modified but not committed, and still at v=${v}. Bump before committing.`);
    failed++;
  } else if (newerThan(fileCommit, refCommit)) {
    const since = sh(`git log --oneline ${refCommit}..HEAD -- "${file}"`).split("\n").filter(Boolean);
    console.log(`FAIL  ${base}: still v=${v}, but the file changed in ${since.length} later commit(s):`);
    since.slice(0, 6).forEach((l) => console.log(`        ${l}`));
    failed++;
  } else {
    console.log(`ok    ${base}  v=${v}  (${refs.length} page${refs.length > 1 ? "s" : ""})`);
  }
}

console.log();
if (failed) {
  console.log(`${failed} asset(s) are being served stale. Bump the ?v= on every page that references them.`);
  process.exit(1);
}
console.log("Every versioned asset is newer in its references than in its content.");
