/* The first-email templates ship inside the function (vercel.json includeFiles)
   and must never be served as pages (brief 07, decision 5). Run against a
   deployed preview or the live site; every template path must return 404.

     npm run check:templates404 -- https://<preview-host>
*/
"use strict";

const fs = require("fs");
const path = require("path");

const base = String(process.argv[2] || "").replace(/\/+$/, "");
if (!/^https:\/\/\S+$/.test(base)) {
  console.error("usage: npm run check:templates404 -- https://<deployed host>");
  process.exit(2);
}
const dir = path.join(__dirname, "..", "api", "_first-emails");
const files = fs.readdirSync(dir).filter((f) => f.endsWith(".txt"));
const paths = [];
for (const f of files) paths.push(`/api/_first-emails/${f}`, `/api/_first-emails/${f}/`);
paths.push("/api/_first-emails/", "/api/_first-emails");

(async () => {
  let failed = 0;
  for (const p of paths) {
    let code = 0;
    try {
      // Follow the trailing-slash 308 to its end, like a browser.
      const r = await fetch(base + p, { redirect: "follow" });
      code = r.status;
    } catch (e) { code = -1; }
    const ok = code === 404;
    console.log(`${ok ? "ok  " : "FAIL"}  ${code}  ${p}`);
    if (!ok) failed++;
  }
  console.log(failed ? `\n${failed} path(s) NOT 404` : `\nAll ${paths.length} template paths return 404.`);
  process.exit(failed ? 1 : 0);
})();
