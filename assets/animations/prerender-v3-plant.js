/* Pre-render the v3 scene's plant geometry to static SVG.

     node prerender-v3-plant.js <animationsDir>

   WHY THIS EXISTS
   v3 moved the plant (heat pump, thermal store, pipes, flow groups, store
   glow) out of static markup: buildPlant() assembles it as a string and
   injects it with `getElementById('plant').innerHTML = s`, into an
   otherwise empty <g id="plant">. build-homepage-anim.js deliberately drops
   the scene's <script>, so a raw v3 would render sky and house around a
   hollow middle.

   buildPlant() is pure string generation (its only DOM touch is that final
   assignment), and it runs once at layout — applyMode() merely re-wires the
   result afterwards. So we can execute the scene's script under a stub DOM,
   capture what it assigns to #plant, and bake it in as static markup.

   Output: thermal-dawn-flow-v3-static.html, a v3 whose <g id="plant"> is
   populated. That is what build-homepage-anim.js consumes.

   Re-run this after taking a newer v3 from TD-Platform.
*/
"use strict";

const fs = require("fs");
const path = require("path");

const DIR = process.argv[2];
if (!DIR) throw new Error("usage: node prerender-v3-plant.js <animationsDir>");

const SRC = path.join(DIR, "thermal-dawn-flow-v3.html");
const OUT = path.join(DIR, "thermal-dawn-flow-v3-static.html");
const src = fs.readFileSync(SRC, "utf8");

/* ── a DOM stub wide enough for the scene's init path ─────────────────────
   Everything is permissive and side-effect-free except innerHTML, which we
   record per element id. The scene does a lot of styling/listener work at
   startup that we neither need nor want; it just has to not throw. */
const captured = Object.create(null);

function makeEl(id) {
  const el = {
    id,
    _html: "",
    style: new Proxy({}, { get: () => () => {}, set: () => true }),
    classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
    dataset: {},
    attributes: {},
    setAttribute(k, v) { this.attributes[k] = v; },
    getAttribute(k) { return k in this.attributes ? this.attributes[k] : null; },
    removeAttribute(k) { delete this.attributes[k]; },
    appendChild() {}, removeChild() {}, insertBefore() {},
    addEventListener() {}, removeEventListener() {},
    querySelector: () => makeEl("_q"),
    querySelectorAll: () => [],
    getBoundingClientRect: () => ({ width: 0, height: 0, top: 0, left: 0, right: 0, bottom: 0 }),
    getBBox: () => ({ x: 0, y: 0, width: 0, height: 0 }),
    textContent: "",
    value: "",
    checked: false,
  };
  Object.defineProperty(el, "innerHTML", {
    get() { return this._html; },
    set(v) { this._html = v; if (id) captured[id] = v; },
  });
  return el;
}

const els = Object.create(null);
const byId = (id) => (els[id] || (els[id] = makeEl(id)));

const documentStub = {
  getElementById: byId,
  querySelector: () => makeEl("_q"),
  querySelectorAll: () => [],
  createElement: () => makeEl(null),
  createElementNS: () => makeEl(null),
  addEventListener() {},
  body: makeEl("body"),
  documentElement: makeEl("html"),
  readyState: "complete",
};

const windowStub = {
  addEventListener() {},
  removeEventListener() {},
  requestAnimationFrame: () => 0,
  cancelAnimationFrame() {},
  setTimeout: () => 0,
  setInterval: () => 0,
  clearInterval() {},
  clearTimeout() {},
  matchMedia: () => ({ matches: false, addEventListener() {}, addListener() {} }),
  location: { search: "", href: "" },
  devicePixelRatio: 1,
  innerWidth: 900,
  innerHeight: 600,
  postMessage() {},
};
windowStub.parent = windowStub; // standalone: parent === window (hides the test panel)

/* Run every <script> block the scene ships. */
const scripts = [...src.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1]);
if (!scripts.length) throw new Error("no inline <script> found in v3");

for (const code of scripts) {
  const fn = new Function(
    "document", "window", "location", "URLSearchParams", "requestAnimationFrame",
    "setTimeout", "setInterval", "clearInterval", "clearTimeout", "self", "globalThis",
    '"use strict";\n' + code,
  );
  fn(
    documentStub, windowStub, windowStub.location, URLSearchParams,
    windowStub.requestAnimationFrame, windowStub.setTimeout, windowStub.setInterval,
    windowStub.clearInterval, windowStub.clearTimeout, windowStub, windowStub,
  );
}

const plant = captured["plant"];
if (!plant || plant.length < 500) {
  throw new Error("buildPlant did not populate #plant (got " + (plant ? plant.length : 0) + " chars)");
}

/* Splice the generated markup into the empty <g id="plant"> ... </g>. */
const openRe = /(<g\s+id="plant"[^>]*>)([\s\S]*?)(<\/g>)/;
if (!openRe.test(src)) throw new Error('could not find <g id="plant"> in v3');
const before = src.match(openRe)[2];
if (before.trim().length > 200) {
  throw new Error("#plant already has substantial static content; refusing to overwrite");
}

const out = src
  .replace(openRe, (_, open, _inner, close) => open + "\n" + plant + "\n" + close)
  .replace(
    /<title>[\s\S]*?<\/title>/,
    "<title>Thermal Dawn, Energy Flow (v3, pre-rendered)</title>\n" +
      "<!-- GENERATED by prerender-v3-plant.js from thermal-dawn-flow-v3.html.\n" +
      "     Do not hand-edit: re-run the prerender instead. -->",
  );

fs.writeFileSync(OUT, out, "utf8");

/* Sanity: every id the homepage shell drives must now exist statically. */
const REQUIRED = [
  "lbl-battery-val", "lbl-hp-val", "lbl-mode-chip", "lbl-radiators-val",
  "lbl-outdoor-temp", "lbl-outdoor-cond", "store-glow-el",
  "sky-sun", "sky-moon", "sky-clouds", "sky-stars",
  "sky-dusk-rect", "sky-night-rect", "cloud-extra-wrap",
];
const svg = out.match(/<svg[\s\S]*<\/svg>/)[0];
const missing = REQUIRED.filter((id) => !svg.includes('id="' + id + '"'));
if (missing.length) throw new Error("pre-rendered scene is missing: " + missing.join(", "));

console.log(
  "wrote " + path.basename(OUT) +
  " (plant " + plant.length + " chars, svg " + svg.length + " chars, all required ids present)",
);
