/* Derive the marketing scene from the platform's v3 scene.

     node make-marketing-scene.js <animationsDir>

   WHY A VARIANT AT ALL
   The homepage tells a With/Without Storage comparison. That needs two
   things a real installed system never has, and which v3 therefore does not
   ship:

     g-store        a group around the thermal store, so it can be HIDDEN
                    when the visitor picks "Without Storage"
     g-flow-export  solar being sold to the grid, the "without storage"
                    daytime story

   Adding those to TD-Platform's v3 would put marketing fiction into the file
   the portal and the Pis render live. So we keep them here.

   WHY THIS IS GENERATED, NOT FORKED
   A hand-forked copy drifts — that is how the HA dashboards ended up stuck
   on flow.html?v=25 while v3 moved on. This script DERIVES the variant from
   whatever thermal-dawn-flow-v3.html currently sits beside it, so re-taking
   a newer v3 from TD-Platform is: copy the file, re-run this, re-run
   build-homepage-anim.js. The marketing-only additions live in this script
   and nowhere else.

   It fails loudly if v3 changes in a way that invalidates an assumption,
   rather than emitting a scene that looks fine and misbehaves.

   PIPELINE
     node make-marketing-scene.js <dir>   # v3          -> v3-marketing
     node build-homepage-anim.js  <dir>   # v3-marketing -> homepage-flow-v2.html
*/
"use strict";

const fs = require("fs");
const path = require("path");

const DIR = process.argv[2];
if (!DIR) throw new Error("usage: node make-marketing-scene.js <animationsDir>");

const SRC = path.join(DIR, "thermal-dawn-flow-v3.html");
const OUT = path.join(DIR, "thermal-dawn-flow-v3-marketing.html");
let src = fs.readFileSync(SRC, "utf8");

/* The export flow's coordinates come from the v2 scene, which shares v3's
   viewBox exactly (235 18 363 430) — checked below. Same coordinate space,
   so the geometry transfers as-is rather than being re-authored. */
const EXPECTED_VIEWBOX = '235 18 363 430';
const vb = src.match(/<svg[^>]*viewBox="([^"]*)"/);
if (!vb || vb[1] !== EXPECTED_VIEWBOX) {
  throw new Error(
    "v3 viewBox is '" + (vb ? vb[1] : "?") + "', expected '" + EXPECTED_VIEWBOX +
    "'. The export-flow geometry below was authored for that space and must be " +
    "re-checked before this script can be trusted.",
  );
}

/* ── 1. give the thermal store an id so the shell can hide it ───────────── */
const STORE_MARKER = "// ── THERMAL STORE (the hero) ";
const storeIdx = src.indexOf(STORE_MARKER);
if (storeIdx === -1) {
  throw new Error("could not find the THERMAL STORE section marker in v3; buildPlant() has been restructured");
}
/* The section opens its own group with a bare `s += '<g>';`. Tag the FIRST
   such statement after the marker — that is the store's wrapper. */
const openIdx = src.indexOf("s += '<g>';", storeIdx);
if (openIdx === -1 || openIdx - storeIdx > 800) {
  throw new Error("could not find the store's opening <g> within the THERMAL STORE section");
}
src = src.slice(0, openIdx) + "s += '<g id=\"g-store\">';" + src.slice(openIdx + "s += '<g>';".length);

/* ── 2. pre-render the plant to static markup ───────────────────────────── */
const captured = Object.create(null);

function makeEl(id) {
  const el = {
    id, _html: "",
    style: new Proxy({}, { get: () => () => {}, set: () => true }),
    classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
    dataset: {}, attributes: {},
    setAttribute(k, v) { this.attributes[k] = v; },
    getAttribute(k) { return k in this.attributes ? this.attributes[k] : null; },
    removeAttribute(k) { delete this.attributes[k]; },
    appendChild() {}, removeChild() {}, insertBefore() {},
    addEventListener() {}, removeEventListener() {},
    querySelector: () => makeEl("_q"), querySelectorAll: () => [],
    getBoundingClientRect: () => ({ width: 0, height: 0, top: 0, left: 0, right: 0, bottom: 0 }),
    getBBox: () => ({ x: 0, y: 0, width: 0, height: 0 }),
    textContent: "", value: "", checked: false,
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
  querySelector: () => makeEl("_q"), querySelectorAll: () => [],
  createElement: () => makeEl(null), createElementNS: () => makeEl(null),
  addEventListener() {}, body: makeEl("body"), documentElement: makeEl("html"),
  readyState: "complete",
};
const windowStub = {
  addEventListener() {}, removeEventListener() {},
  requestAnimationFrame: () => 0, cancelAnimationFrame() {},
  setTimeout: () => 0, setInterval: () => 0, clearInterval() {}, clearTimeout() {},
  matchMedia: () => ({ matches: false, addEventListener() {}, addListener() {} }),
  location: { search: "", href: "" },
  devicePixelRatio: 1, innerWidth: 900, innerHeight: 600, postMessage() {},
};
windowStub.parent = windowStub;

for (const m of src.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)) {
  new Function(
    "document", "window", "location", "URLSearchParams", "requestAnimationFrame",
    "setTimeout", "setInterval", "clearInterval", "clearTimeout", "self", "globalThis",
    '"use strict";\n' + m[1],
  )(
    documentStub, windowStub, windowStub.location, URLSearchParams,
    windowStub.requestAnimationFrame, windowStub.setTimeout, windowStub.setInterval,
    windowStub.clearInterval, windowStub.clearTimeout, windowStub, windowStub,
  );
}

const plant = captured["plant"];
if (!plant || plant.length < 500) {
  throw new Error("buildPlant did not populate #plant (got " + (plant ? plant.length : 0) + " chars)");
}
if (!plant.includes('id="g-store"')) {
  throw new Error("the g-store id did not survive into the generated plant markup");
}

const plantRe = /(<g\s+id="plant"[^>]*>)([\s\S]*?)(<\/g>)/;
if (!plantRe.test(src)) throw new Error('could not find <g id="plant"> in v3');
if (src.match(plantRe)[2].trim().length > 200) {
  throw new Error("#plant already has substantial static content; refusing to overwrite");
}
let out = src.replace(plantRe, (_, open, _inner, close) => open + "\n" + plant + "\n" + close);

/* ── 3. add the export flow (marketing-only) ────────────────────────────── */
/* Lifted from thermal-dawn-flow-v2.html, whose viewBox is identical (asserted
   above), so the coordinates need no adjustment. Hidden by default; the
   homepage shell shows it via show('g-flow-export', isDay && !isSto). */
const EXPORT_FLOW = [
  /* Rises from the top edge of the solar array to the grid at the UPPER
     RIGHT, from the panel surface itself (the Solar leader ends at 468,219),
     over the roof plane and into sky, clear of the Outdoor readout
     (y 112+). Shown only by day, so no clash with the moon. The first cut
     pointed upper-LEFT, into empty sky away from anything grid-like. */
  '  <g id="g-flow-export" style="opacity:0">',
  '    <path class="flow-line" style="stroke:var(--flow-export,#FF9C00)" d="M468,215 L566,88"/>',
  '    <path class="flow-line flow-delay-2" style="stroke:rgba(255,156,0,0.5)" d="M460,220 L558,93"/>',
  '    <path d="M566,88 l-10.6,3 M566,88 l-6.2,9.1" fill="none" stroke="#FF9C00" stroke-width="1.8" stroke-linecap="round" opacity="0.9"/>',
  '    <text x="545" y="76" text-anchor="middle" class="tag">To grid</text>',
  '    <text x="545" y="64" text-anchor="middle" class="temp" style="font-size:10px">near-zero FiT</text>',
  '  </g>',
].join("\n");

/* ── marketing-only: perimeter ground loop ──────────────────────────────
   A dashed isometric ring on the ground encircling the house, heat pump
   and battery. Shown by the shell only for night-without-storage, where it
   replaces the old roofline recolour Nick rejected. It must paint UNDER
   the scene, so it is inserted before the scene-squash wrapper: the house
   then occludes the far edge exactly as ground behind a building should.
   Corners follow the scene's iso slopes (+-0.47 in viewport space):
   left (245,300) -> front (455,400) -> right (585,338) -> back (375,238). */
const PERIMETER_FLOW = [
  '  <g id="g-flow-perimeter" style="opacity:0">',
  '    <path class="flow-line" style="stroke:var(--flow-main,#E84A2A)" d="M245,300 L455,400 L585,338 L375,238 Z"/>',
  '  </g>',
].join("\n");

const squashIdx = out.indexOf('<g id="scene-squash"');
if (squashIdx === -1) throw new Error("no scene-squash wrapper found; the perimeter loop needs it to paint under the house");
out = out.slice(0, squashIdx) + PERIMETER_FLOW + "\n" + out.slice(squashIdx);

/* Insert just before the closing </svg> so it paints above the scene. */
const lastSvgClose = out.lastIndexOf("</svg>");
if (lastSvgClose === -1) throw new Error("no </svg> found");
out = out.slice(0, lastSvgClose) + EXPORT_FLOW + "\n" + out.slice(lastSvgClose);

out = out.replace(
  /<title>[\s\S]*?<\/title>/,
  "<title>Thermal Dawn, Energy Flow (v3, marketing variant)</title>\n" +
    "<!-- GENERATED by make-marketing-scene.js from thermal-dawn-flow-v3.html.\n" +
    "     Do not hand-edit: re-run the generator instead. Adds g-store and\n" +
    "     g-flow-export, which the homepage comparison needs and the live\n" +
    "     platform scene has no reason to carry. -->",
);

fs.writeFileSync(OUT, out, "utf8");

/* ── 4. assert the result is usable by the homepage shell ───────────────── */
const svg = out.match(/<svg[\s\S]*<\/svg>/)[0];
const REQUIRED = [
  "lbl-battery-val", "lbl-hp-val", "lbl-mode-chip", "lbl-radiators-val",
  "lbl-outdoor-temp", "lbl-outdoor-cond", "store-glow-el",
  "sky-sun", "sky-moon", "sky-clouds", "sky-stars",
  "sky-dusk-rect", "sky-night-rect", "cloud-extra-wrap",
  "g-store", "g-flow-export", "g-flow-perimeter", "g-flow-hp", "g-flow-home",
];
const missing = REQUIRED.filter((id) => !svg.includes('id="' + id + '"'));
if (missing.length) throw new Error("marketing scene is missing: " + missing.join(", "));

console.log(
  "wrote " + path.basename(OUT) +
  " (plant " + plant.length + " chars, svg " + svg.length + " chars, +g-store +g-flow-export, all ids present)",
);
