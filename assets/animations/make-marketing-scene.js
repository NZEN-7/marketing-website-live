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

let plant = captured["plant"];
if (!plant || plant.length < 500) {
  throw new Error("buildPlant did not populate #plant (got " + (plant ? plant.length : 0) + " chars)");
}
/* Tag the static grey pipe runs between heat pump and store. In the
   no-storage night scenario the shell hides them: they plumb a tank that
   world does not have. Only the plant pipe paths get the class; the scene
   uses the same stroke elsewhere for edges. */
plant = plant.replace(/<path (fill="none" stroke="rgba\(255,255,255,0\.10\)")/g,
  '<path class="pipe-static" $1');
/* The six small port circles where those pipes meet the hardware
   (Nick: "dots/circles near the heat pump") hide with them. */
plant = plant.replace(/<circle (cx="[^"]+" cy="[^"]+" r="1\.8" fill="#0a0a0a")/g,
  '<circle class="pipe-static" $1');
const PIPE_TAGS = (plant.match(/pipe-static/g) || []).length;
if (PIPE_TAGS < 8) {
  throw new Error("expected the HP-to-store pipe runs to tag as pipe-static, got " + PIPE_TAGS);
}

if (!plant.includes('id="g-store"')) {
  throw new Error("the g-store id did not survive into the generated plant markup");
}

/* Grid-heat only: the loop's missing quarter, drawn at FULL strength.
   It must render ON the pale ground outline, and that outline lives in a
   DIFFERENT transform context from the flow groups: identical coordinates
   rendered 21px apart at the far end (measured 19 Aug, Nick: "the angle on
   the front right edge is fucked. should follow the edge of the house").
   So it is injected immediately AFTER the static outline path below,
   inheriting that context, where these numbers land pixel-exact on the
   edge. That context also paints BEFORE the plant, so the battery and
   heat pump occlude the line the way they occlude the outline itself,
   which is what makes full brightness safe: the earlier 0.18 fade was a
   bandage over the battery slice. */
const GRIDCLOSE = '<g id="g-flow-gridclose" style="opacity:0"><path class="flow-line flow-delay-2" style="stroke:var(--flow-main)" d="M699,217 L390,390"/></g>';

const plantRe = /(<g\s+id="plant"[^>]*>)([\s\S]*?)(<\/g>)/;
if (!plantRe.test(src)) throw new Error('could not find <g id="plant"> in v3');
if (src.match(plantRe)[2].trim().length > 200) {
  throw new Error("#plant already has substantial static content; refusing to overwrite");
}
let out = src.replace(plantRe, (_, open, _inner, close) => open + "\n" + plant + "\n" + close);
const EXPORT_FLOW = [
  /* Routed in the STATIC house context (same as GRIDCLOSE), so line weight
     matches the scene flows and the plant occludes it where it should.
     Nick's route, 19 Aug: leave the panel bottom edge, slope down the roof
     at the roof's own fall line to the eaves, drop vertically to the top
     of the battery (the continuation to the ground line hides behind the
     battery), then follow the base edge right and straight off into the
     air to the FiT note. Waypoints measured via getScreenCTM:
       (610.4,132) panel bottom edge, on the array's fall line
       (623,146.3) eaves, directly above the battery
       (623,259.6) ground line behind the battery (top face is at y226)
       (740,194)   the same base-edge line extended into the air. */
  '<g id="g-flow-export" style="opacity:0">',
  '  <path class="flow-line" style="stroke:var(--flow-export,#FF9C00)" d="M610.4,132 L623,146.3 L623,259.6 L740,194"/>',
  '  <path d="M740,194 l-9.9,1.6 M740,194 l-6.5,7.6" fill="none" stroke="#FF9C00" stroke-width="2" stroke-linecap="round" opacity="0.9"/>',
  '  <text x="738" y="180" text-anchor="end" class="tag">To grid</text>',
  '  <text x="738" y="168" text-anchor="end" class="temp" style="font-size:10px">near-zero FiT</text>',
  '</g>',
].join("\n");

const STATIC_LOOP = 'M699,217 L390,390 L25.5,190.6 Q16.75,185.8 25.5,180.9"/>';
const loopIdx = out.indexOf(STATIC_LOOP);
if (loopIdx === -1) throw new Error("static ground outline not found; the grid-heat closure needs it as anchor and transform context");
const loopEnd = loopIdx + STATIC_LOOP.length;
out = out.slice(0, loopEnd) + "\n  " + GRIDCLOSE + "\n  " + EXPORT_FLOW + out.slice(loopEnd);

/* Marketing build drops the white callout leader dots (Nick, 19 Aug: "get
   rid of the dots"). The leader rule lines and labels stay; only the
   circles go. The platform scene keeps its own. */
const DOTS = (out.match(/<circle class="dot"[^>]*\/>/g) || []).length;
if (DOTS < 4) throw new Error("expected the callout leader dots, found " + DOTS);
out = out.replace(/<circle class="dot"[^>]*\/>/g, "");

/* ── 3. add the export flow (marketing-only) ────────────────────────────── */
/* Lifted from thermal-dawn-flow-v2.html, whose viewBox is identical (asserted
   above), so the coordinates need no adjustment. Hidden by default; the
   homepage shell shows it via show('g-flow-export', isDay && !isSto). */




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
  "g-store", "g-flow-export", "g-flow-gridclose", "g-flow-hp", "g-flow-home",
];
const missing = REQUIRED.filter((id) => !svg.includes('id="' + id + '"'));
if (missing.length) throw new Error("marketing scene is missing: " + missing.join(", "));

console.log(
  "wrote " + path.basename(OUT) +
  " (plant " + plant.length + " chars, svg " + svg.length + " chars, +g-store +g-flow-export, all ids present)",
);
