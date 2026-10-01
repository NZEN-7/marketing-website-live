// Checks a release must pass before `npm run deploy:live` pushes anything.
//
// "TO CONFIRM" marks wording that is still waiting on a decision (the privacy
// page drafts used it for points Nick had to settle). It must never reach the
// live site (CTO Re #39). This scans every tracked text file that is actually
// served, so everything except the paths .vercelignore keeps off the site,
// and that includes the customer email templates under api/_first-emails/.
// Previews skip this on purpose, so a draft can still be read on one.
//
// Pure apart from reading files, so scripts/test-release-guards.mjs tests it.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";

export const MARKER = /TO CONFIRM/;
const TEXT = /\.(html?|js|mjs|css|txt|xml|json|md|svg)$/i;

/** Paths .vercelignore keeps off the site (top-level names, one per line). */
export function ignoredFrom(vercelignore) {
  return String(vercelignore || "").split(/\r?\n/).map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#")).map((l) => l.replace(/^\/+|\/+$/g, ""));
}

/** Is this repo path served? Not if it is, or sits under, an ignored name. */
export function isServed(file, ignored) {
  const f = file.replace(/\\/g, "/");
  return !ignored.some((i) => f === i || f.startsWith(i + "/"));
}

/** Every served text file whose content contains the marker: [{ file, line }]. */
export function findUnconfirmed(files, read) {
  const hits = [];
  for (const f of files) {
    if (!TEXT.test(f)) continue;
    const lines = String(read(f)).split(/\r?\n/);
    lines.forEach((l, i) => { if (MARKER.test(l)) hits.push({ file: f, line: i + 1 }); });
  }
  return hits;
}

/** The repo-level check deploy-live runs: tracked, served, text, marker-free. */
export function unconfirmedInRepo(root = process.cwd()) {
  const tracked = execFileSync("git", ["ls-files"], { cwd: root }).toString().split(/\r?\n/).filter(Boolean);
  let ign = "";
  try { ign = readFileSync(path.join(root, ".vercelignore"), "utf8"); } catch { ign = ""; }
  const ignored = ignoredFrom(ign);
  return findUnconfirmed(tracked.filter((f) => isServed(f, ignored)), (f) => readFileSync(path.join(root, f), "utf8"));
}
