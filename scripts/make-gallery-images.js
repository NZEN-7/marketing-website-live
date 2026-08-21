/* One-off: bring selected originals from the photo library into assets/img.

   Run with sharp installed as a devDependency, then REMOVE sharp again:

     npm i -D sharp
     node scripts/make-gallery-images.js
     npm rm sharp

   Why remove it: the site is a plain static deploy with no build step, and
   Vercel installs devDependencies. Leaving a heavy native module in
   package.json buys install time and risk for something we run by hand every
   few months. The generated .webp files are committed, so nothing at deploy
   time needs sharp.

   .rotate() with no arguments applies the EXIF orientation and then strips it.
   That matters here: several of the phone originals are stored rotated with
   an orientation flag, so anything that ignores the flag renders them upside
   down or on their side.
*/
"use strict";

const path = require("path");
const sharp = require("sharp");

const SRC = "C:/Users/nickz/My Drive/Thermal Dawn/Marketing +/Design/Photos";
const OUT = path.join(__dirname, "..", "assets", "img");

const JOBS = [
  {
    from: "Install 1/IMG_2747.JPG",
    to: "customers-hawthorn.webp",
    width: 1200,
    note: "Mike and Kay outside their Hawthorn home",
  },
  {
    from: "Install 1/IMG_2790.JPG",
    to: "install-unit-vine.webp",
    width: 1200,
    note: "the finished outdoor unit against the rendered wall",
  },
  {
    from: "Install 1/IMG_2517.JPG",
    to: "ute-sunrise.webp",
    width: 1600,
    note: "the branded ute loaded at sunrise, plate readable. Gallery hero. Replaced IMG_2513 (19 Aug); new filename because images carry a year-long cache.",
  },
  {
    from: "Install 1/IMG_2798.JPG",
    to: "brand-plate.webp",
    width: 1200,
    note: "THERMAL DAWN brand plate on the installed enclosure. EXIF-rotated.",
  },
  {
    from: "Install 1/IMG_2793.JPG",
    to: "install-store-heatpump.webp",
    width: 1100,
    note: "the real install: branded thermal store on the paving, heat pump above, autumn vine on the wall. Portrait once EXIF is baked. Replaces the AI concept render on hydronic/how-it-works.",
  },
  {
    from: "Install 1/IMG_2976.JPG",
    to: "pipework-valve.webp",
    width: 1200,
    note: "copper pipework, Caleffi DIRTMAG separator and isolation valve. EXIF-rotated.",
  },
];

(async () => {
  for (const j of JOBS) {
    const src = path.join(SRC, j.from);
    const dst = path.join(OUT, j.to);
    const meta = await sharp(src).metadata();
    const info = await sharp(src)
      .rotate()
      .resize({ width: j.width, withoutEnlargement: true })
      .webp({ quality: 76 })
      .toFile(dst);
    console.log(
      j.to.padEnd(28) +
        `${info.width}x${info.height}  ${(info.size / 1024).toFixed(0)}KB` +
        `  (from ${meta.width}x${meta.height}, exif orientation ${meta.orientation || 1})`,
    );
  }
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
