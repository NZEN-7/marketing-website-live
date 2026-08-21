/* Build the homepage animation: the scene graphic from TD-Platform dropped
   into the existing homepage shell (With/Without Storage toggle, day/night
   buttons, timer bar, three explainer cards).

   node build-homepage-anim.js <animationsDir>

   SCENE SOURCE: thermal-dawn-flow-v3-marketing.html.

   Only the scene's <style> and <svg> are used; its <script> is dropped,
   because the homepage shell drives the scene itself and the platform's
   live-data/mode logic is irrelevant here. (That is also why the v3
   Direct-Heating mode bug cannot reach this build: it lives in the scene's
   applyMode(), which we never ship.)

   ── THE SCENE IS DERIVED FROM v3, IN TWO STEPS ──────────────────────────
   The platform's thermal-dawn-flow-v3.html cannot be consumed directly:

   1. v3 stopped keeping its plant (heat pump, thermal store, pipes, flow
      groups, store glow) as static markup. buildPlant() assembles it as a
      string and injects it into an otherwise empty <g id="plant">. Since
      this builder drops the script, raw v3 renders sky and house around a
      hollow middle.

   2. The homepage tells a With/Without Storage comparison, needing two
      things a real installed system never has, so v3 rightly lacks them:
          show('g-store',       isSto);            // hide the tank entirely
          show('g-flow-export', isDay && !isSto);  // solar sold to the grid

   make-marketing-scene.js handles both, producing
   thermal-dawn-flow-v3-marketing.html. It DERIVES that from whatever v3
   sits beside it, so nothing is hand-forked and nothing drifts.

   Pipeline, and THE FIRST STEP IS REQUIRED:

     node make-marketing-scene.js <dir>   # v3           -> v3-marketing
     node build-homepage-anim.js  <dir>   # v3-marketing -> homepage-flow-v2.html

   After taking a newer v3 from TD-Platform, re-run BOTH, in that order.
   ─────────────────────────────────────────────────────────────────────── */
const fs = require("fs");
const path = require("path");

const DIR = process.argv[2];
const SCENE_FILE = "thermal-dawn-flow-v3-marketing.html";
const scenePath = path.join(DIR, SCENE_FILE);
if (!fs.existsSync(scenePath)) {
  throw new Error(
    SCENE_FILE + " not found. Run `node make-marketing-scene.js " + DIR + "` first: " +
    "it bakes v3's JS-generated plant into static markup and adds the " +
    "g-store / g-flow-export groups the homepage comparison needs.",
  );
}
const scene = fs.readFileSync(scenePath, "utf8");
const shell = fs.readFileSync(path.join(DIR, "homepage_web_animation_new.html"), "utf8");

const grab = (src, re, what) => {
  const m = src.match(re);
  if (!m) throw new Error("could not find " + what);
  return m[1];
};

// scene: its own CSS and the whole <svg> block.
const v2Style = grab(scene, /<style>([\s\S]*?)<\/style>/, "scene style");
const v2Svg = grab(scene, /(<svg[\s\S]*<\/svg>)/, "scene svg");

/* The scene must expose every id the shell script drives, or the build looks
   fine and silently does nothing at runtime. Fail loudly instead. */
const REQUIRED_SCENE_IDS = [
  "lbl-battery-val", "lbl-hp-val", "lbl-mode-chip", "lbl-radiators-val",
  "lbl-outdoor-temp", "lbl-outdoor-cond", "store-glow-el",
  "sky-sun", "sky-moon", "sky-clouds", "sky-stars",
  "sky-dusk-rect", "sky-night-rect", "cloud-extra-wrap",
  // the two the comparison depends on, added by make-marketing-scene.js
  "g-store", "g-flow-export", "g-flow-gridclose",
];
const missing = REQUIRED_SCENE_IDS.filter((id) => !v2Svg.includes('id="' + id + '"'));
if (missing.length) {
  throw new Error("scene is missing ids the shell drives: " + missing.join(", "));
}

// shell: its CSS, and the chrome either side of the scene.
const shellStyle = grab(shell, /<style>([\s\S]*?)<\/style>/, "shell style");
/* Pull out a <div> and everything up to its MATCHING close.
   A lazy regex stops at the first nested `</div>` and silently emits an
   unbalanced block, which then swallows the rest of the document. */
function extractDiv(src, openTag) {
  const start = src.indexOf(openTag);
  if (start === -1) throw new Error("could not find " + openTag);
  const tag = /<div\b|<\/div>/gi;
  tag.lastIndex = start;
  let depth = 0, m;
  while ((m = tag.exec(src))) {
    depth += m[0].toLowerCase() === "</div>" ? -1 : 1;
    if (depth === 0) return src.slice(start, m.index + m[0].length);
  }
  throw new Error("unbalanced markup after " + openTag);
}

const controls = extractDiv(shell, '<div class="controls">');
const sceneTitle = extractDiv(shell, '<div class="scene-title">');
const cards = "<!-- INFO CARDS -->\n  " + extractDiv(shell, '<div class="info-row">');

// Every block must be balanced or the page structure collapses.
[["controls", controls], ["scene title", sceneTitle], ["info cards", cards]].forEach(([what, html]) => {
  const open = (html.match(/<div\b/gi) || []).length;
  const close = (html.match(/<\/div>/gi) || []).length;
  if (open !== close) throw new Error(what + " is unbalanced: " + open + " open vs " + close + " close");
});

// The shell's CSS styles its own SVG scene too; we only want the chrome.
// Drop the rules that would fight the v2 scene.
const shellChrome = shellStyle
  .split("\n")
  .filter((l) => !/^\s*(\.flow-line|\.glow-dot|\.window|\.fan-blades|@keyframes (pulse-flow|glow-pulse|window-glow|fan-spin)|svg \{)/.test(l))
  .join("\n");

const out = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>Thermal Dawn, Energy Flow</title>
<link href="https://fonts.googleapis.com/css2?family=DM+Mono:wght@500;600&family=Inter:wght@500;600&display=swap" rel="stylesheet"/>
<style>
/* ─────────────────────────────────────────────────────────────────────
   GENERATED FILE, do not hand-edit.
   Built by scratchpad/build-homepage-anim.js from:
     · thermal-dawn-flow-v3-marketing.html (derived from the platform v3 scene)
     · homepage_web_animation_new.html (the shell: toggle, buttons, cards)
   Re-run the builder after changing either source.
   ───────────────────────────────────────────────────────────────────── */

/* ── shell chrome (controls / cards / layout) ── */
${shellChrome}

/* ── v2 scene ── */
${v2Style}

/* ── overrides: these must come last ─────────────────────────────────── */

/* the shell lays this out; the scene must not force full-viewport height */
html, body { height: auto; overflow-x: hidden; overflow-y: visible; }
body { display: block; background: var(--bg); }
.svg-wrap { width: 100%; max-width: 560px; margin: 0 auto; }
svg { display: block; width: 100%; height: auto; overflow: hidden; }

/* The v2 scene ships its own standalone control bar as \`.controls\`, hidden
   by default. That rule lands after the shell's and would hide the shell's
   real controls, toggle included, so restate the shell's layout here. */
.controls {
  display: flex; flex-direction: column; align-items: center;
  gap: 14px; margin-bottom: 28px; width: 100%; padding: 0;
}

/* Brand type. The shell asked for 'DM Sans', which was never actually
   loaded (the webfont link only fetches DM Mono + Inter), so all the
   chrome fell back to generic sans-serif. Use the site's self-hosted
   Montserrat instead; the in-SVG technical readouts stay mono. */
@font-face{font-family:"Montserrat";src:url("/assets/fonts/Montserrat-Regular.woff2") format("woff2");font-weight:400;font-display:swap;}
@font-face{font-family:"Montserrat";src:url("/assets/fonts/Montserrat-SemiBold.woff2") format("woff2");font-weight:600;font-display:swap;}
@font-face{font-family:"Montserrat";src:url("/assets/fonts/Montserrat-Bold.woff2") format("woff2");font-weight:700;font-display:swap;}
@font-face{font-family:"Montserrat";src:url("/assets/fonts/Montserrat-ExtraBold.woff2") format("woff2");font-weight:800;font-display:swap;}

body, .scene-title h2, .scene-title p, .ic-title, .ic-body {
  font-family: "Montserrat", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
}
.scene-title h2 { font-weight: 800; letter-spacing: -0.02em; }
.scene-title p  { font-size: 14px; line-height: 1.55; max-width: 62ch; margin: 0 auto; }
.ic-title { font-size: 13px; font-weight: 800; letter-spacing: -0.01em; margin-bottom: 5px; }
.ic-body  { font-size: 12.5px; line-height: 1.55; color: rgba(255,255,255,0.62); }
.info-card { padding: 18px; }
/* the small caps labels stay mono, they read as instrument type */
.label-row, .storage-label, .tod-btn { font-family: 'DM Mono', ui-monospace, monospace; }

/* ── chrome restyle, 19 Aug 2026: match the site design system ──────────
   One accent (#FF9C00), flat surfaces, no glow, no emoji, Montserrat for
   anything that reads as UI. The mono stays ONLY on the top label-row,
   where instrument type is the point. The scene's own internals (flow
   colours, in-SVG tags) are the platform's and are not touched. */
:root { --orange: #FF9C00; }

.storage-label, .tod-btn { font-family: "Montserrat", sans-serif; letter-spacing: .08em; }
.storage-label { font-weight: 800; }
.storage-label.active { color: #FF9C00; }

/* toggle: the on-state was green with a glow halo; flat orange now */
.toggle-track.on { background: rgba(255,156,0,.16); border-color: rgba(255,156,0,.55); }
.toggle-track.on .toggle-knob { background: #FF9C00; box-shadow: none; }
.toggle-knob { box-shadow: none; }

/* scene chips: one accent for the active state regardless of scenario.
   The story's mood (charging / serving / costing) belongs to the scene,
   not to the buttons. 2px border matches the site's flat button spec. */
.tod-btn { font-weight: 700; border-width: 2px; border-radius: 8px; }
.tod-btn.active-day,
.tod-btn.active-night-s,
.tod-btn.active-night-n { border-color: #FF9C00; background: rgba(255,156,0,.10); color: #FF9C00; }

.timer-bar { background: #FF9C00 !important; }

/* headline: white setup, accent payoff */
.scene-title h2 .h-pay { color: #FF9C00; }

/* info cards: the site's dark-card language, and no emoji icon row */
.ic-icon { display: none; }
.info-card { background: #15100c; border: 1px solid rgba(255,156,0,.28); border-radius: 10px; }
.info-card.hl-o, .info-card.hl-g { border-color: #FF9C00; background: rgba(255,156,0,.08); }
/* the red card marks the money leaking away; keep the warning, drop the shout */
.info-card.hl-r { border-color: rgba(232,74,42,.55); background: rgba(232,74,42,.05); }
.ic-title { color: rgba(255,255,255,.92); }

/* grid-heat scenario: the static HP-to-store pipes plumb a tank that this
   world does not have. Tagged pipe-static by the scene generator. */
body.grid-heat .pipe-static, body.charging .pipe-static, body.exporting .pipe-static { opacity: 0; }
</style>
</head>
<body>
<div class="scene">
  <div class="label-row">Thermal Dawn, Energy Flow</div>

  ${controls}

  ${sceneTitle}

  <div class="svg-wrap">
${v2Svg}
  </div>

  ${cards}
</div>

<script>
(function () {
  "use strict";

  var mode = 'day';          // 'day' | 'night'
  var hasStorage = true;
  var timerProgress = 0, timerInterval = null;
  var CYCLE_MS = 6000;

  // Site accent, not the old platform orange: the chrome and the flows the
  // shell drives should match the design system (#FF9C00, 13 Aug 2026).
  var ORANGE = '#FF9C00', GREEN = '#2EC68A', RED = '#E84A2A', DIM = 'rgba(255,255,255,0.5)';

  // Night + no-storage: the heat pump is On, buying peak power, and the
  // house loop runs red. Was disabled over the reused store pipework
  // reading oddly; Nick reviewed the static version on 19 Aug 2026 and
  // ruled the dead scene worse: "the heat loop is completely off".
  var SHOW_GRID_HEATING_FLOW = true;

  // Four scenarios: {storage} x {day,night}. Copy is the shell's, kept as-is.
  var COPY = {
    s: {
      day: {
        h: 'With Thermal Storage: Your Solar. All Night Long.',
        s: 'See how Thermal Dawn captures daytime solar and delivers it as comfort after dark.',
        btnDay: 'Daytime charging', btnNight: 'Evening comfort',
        cards: [
          { title:'Daytime Charging', icon:'\\u2600\\ufe0f', body:'Solar panels power the heat pump during the day, charging the thermal store while electricity is free.', hl:'hl-o' },
          { title:'30 kWh Stored',    icon:'\\u25c9',        body:'The 500L store holds enough heat for an entire evening and overnight, with the heat pump off through the peak.', hl:'' },
          { title:'Evening Comfort',  icon:'\\u2668\\ufe0f', body:'Heat pump switches off at sunset. Stored heat flows through radiators and underfloor all evening, no grid needed.', hl:'' }
        ]
      },
      night: {
        h: 'With Thermal Storage: Your Solar. All Night Long.',
        s: 'See how Thermal Dawn captures daytime solar and delivers it as comfort after dark.',
        btnDay: 'Daytime charging', btnNight: 'Evening comfort',
        cards: [
          { title:'Daytime Charging', icon:'\\u2600\\ufe0f', body:'Solar panels power the heat pump during the day, charging the thermal store while electricity is free.', hl:'' },
          { title:'30 kWh Stored',    icon:'\\u25c9',        body:'The 500L store holds enough heat for an entire evening and overnight, with the heat pump off through the peak.', hl:'' },
          { title:'Evening Comfort',  icon:'\\u2668\\ufe0f', body:'Heat pump switches off at sunset. Stored heat flows through radiators and underfloor all evening, no grid needed.', hl:'hl-g' }
        ]
      }
    },
    n: {
      day: {
        h: 'Without Storage: Buy High, Sell Low.',
        s: 'Without thermal storage, you sell cheap solar during the day, then buy expensive peak-rate grid power all evening.',
        btnDay: 'Cheap exports', btnNight: 'Evening cost',
        cards: [
          { title:'Daytime Export',    icon:'\\u2600\\ufe0f', body:'Your solar generates power during the day, but with nowhere to store it, it\\'s exported to the grid at near-zero feed-in rates.', hl:'hl-o' },
          { title:'No Storage',        icon:'\\u25c9',        body:'Without thermal storage there\\'s nowhere to keep your solar energy for later use.', hl:'' },
          { title:'Evening Grid Cost', icon:'\\u2668\\ufe0f', body:'When the sun sets, the heat pump switches on, drawing expensive peak-rate electricity from the grid all evening.', hl:'' }
        ]
      },
      night: {
        h: 'Without Storage: Buy High, Sell Low.',
        s: 'Without thermal storage, you sell cheap solar during the day, then buy expensive peak-rate grid power all evening.',
        btnDay: 'Cheap exports', btnNight: 'Evening cost',
        cards: [
          { title:'Daytime Export',    icon:'\\u2600\\ufe0f', body:'Your solar generates power during the day, but with nowhere to store it, it\\'s exported to the grid at near-zero feed-in rates.', hl:'' },
          { title:'No Storage',        icon:'\\u25c9',        body:'Without thermal storage there\\'s nowhere to keep your solar energy for later use.', hl:'' },
          { title:'Evening Grid Cost', icon:'\\u2668\\ufe0f', body:'When the sun sets, the heat pump switches on, drawing expensive peak-rate electricity from the grid all evening.', hl:'hl-r' }
        ]
      }
    }
  };

  function el(id) { return document.getElementById(id); }
  function show(id, on) { var e = el(id); if (e) e.style.opacity = on ? '1' : '0'; }
  function hide(id, hidden) { var e = el(id); if (e) e.classList.toggle('hide', hidden); }

  // Sun tracks a fixed mid-morning / late-afternoon position rather than the
  // wall clock, this is an explainer, not a live dashboard.
  function placeSun(frac) {
    var g = el('sky-sun'); if (!g) return;
    var X0 = 250, X1 = 575, YT = 22, YL = 96;
    var t = 2 * frac - 1;
    var x = X0 + frac * (X1 - X0), y = YT + (YL - YT) * (t * t);
    g.setAttribute('transform', 'translate(' + (x - 570).toFixed(1) + ',' + (y - 40).toFixed(1) + ')');
  }

  function applyState() {
    var isDay = (mode === 'day'), isSto = hasStorage;
    var d = COPY[isSto ? 's' : 'n'][mode];

    /* ── sky ── */
    el('sky-dusk-rect').style.opacity  = isDay ? '0' : '0';
    el('sky-night-rect').style.opacity = isDay ? '0' : '1';
    el('sky-stars').style.opacity      = isDay ? '0' : '1';
    el('sky-moon').style.opacity       = isDay ? '0' : '1';
    el('sky-sun').style.opacity        = isDay ? '1' : '0';
    if (isDay) placeSun(0.42);
    el('sky-clouds').style.opacity = '0';
    el('cloud-extra-wrap').style.opacity = '0';
    hide('sky-rain', true); hide('sky-lightning', true);

    /* ── house lights ──
       The v3 scene keeps its windows dark by default and only lights them
       for \`body.house-warm\`, a class its OWN script sets. We drop that
       script, so without this the windows never come on. v3's condition is
       "being fed AND dark"; here the house is heated on both night
       scenarios (from the store with storage, from the grid without), so
       night alone is the condition. */
    document.body.classList.toggle('house-warm', !isDay);
    /* Same pattern: the scene dims its edge highlights via
       \`body.is-night .edge-line\`, another class its own script sets. */
    document.body.classList.toggle('is-night', !isDay);

    /* ── the thermal store only exists in the "with storage" world ── */
    show('g-store', isSto);
    var glow = el('store-glow-el');
    if (glow) {
      /* v3 renamed these: store-glow-o/-g (v2) are store-glow-c/-d here,
         charge and discharge. Pointing at the old names filled the glow
         with a gradient that does not exist. */
      glow.setAttribute('fill', isDay ? 'url(#store-glow-c)' : 'url(#store-glow-d)');
      glow.style.opacity = isSto ? '0.55' : '0';
    }

    /* ── flows: exactly one story at a time ──
       day+storage    solar -> heat pump -> store        (charging, orange)
       night+storage  store -> home                      (discharging, green)
       day-no-storage nothing stored; solar is exported  (no flow to draw)
       night-no-store grid -> heat pump -> home          (buying peak, red) */
    var gridHeat   = (!isDay && !isSto) && SHOW_GRID_HEATING_FLOW;
    var chargeFlow = isDay && isSto;
    var homeFlow   = (!isDay && isSto) || gridHeat;
    var flowCol    = gridHeat ? RED : (isDay ? ORANGE : GREEN);

    /* The v3 scene strokes its flow paths from CSS variables that its own
       script normally sets, and we drop that script. The HP leg uses a
       DIFFERENT variable from the house legs (--flow-hp vs --flow-main); if
       we only set --flow-main, the charge flow strokes resolve to nothing
       and the pipe animation is invisible. Set both. */
    var hpFlowG = el('g-flow-hp');
    if (hpFlowG) {
      hpFlowG.style.opacity = chargeFlow ? '1' : '0';
      hpFlowG.style.setProperty('--flow-hp', flowCol);
    }

    // Solar leaving the property: only when there is nowhere to store it.
    show('g-flow-export', isDay && !isSto);
    /* Grid heating reuses the scene's OWN house loop (g-flow-home), so it
       is pixel-identical in weight and geometry to discharge mode, just
       red. g-flow-home-2 is the tank ports and the vertical risers to the
       heat pump; with no tank in the no-storage world those stay hidden.
       (Nick, 19 Aug: "keep the loop around the house that's in the main
       animation, but no tank and no vertical pipes. just a basic loop.") */
    var g1 = el('g-flow-home');
    if (g1) {
      g1.style.opacity = ((!isDay && isSto) || gridHeat) ? '1' : '0';
      g1.style.setProperty('--flow-main', flowCol);
    }
    var g2 = el('g-flow-home-2');
    if (g2) {
      g2.style.opacity = (!isDay && isSto) ? '1' : '0';
      g2.style.setProperty('--flow-main', flowCol);
    }
    /* Grid heat closes the loop along the front-right base edge, the
       quarter that discharge closes through the tank plumbing instead. */
    var gc = el('g-flow-gridclose');
    if (gc) {
      gc.style.opacity = gridHeat ? '1' : '0';
      gc.style.setProperty('--flow-main', flowCol);
    }
    /* Static grey HP-to-store pipe runs: hidden in grid heat (they plumb
       a tank that world does not have) and in daytime charging, where the
       orange flow runs the same route and the grey underlay doubled every
       line. CSS hooks in the overrides block. */
    document.body.classList.toggle('grid-heat', gridHeat);
    document.body.classList.toggle('charging', chargeFlow);
    // Export too (Nick, 19 Aug: grey lines "there when we dont want them").
    // Only discharge keeps the static plumbing, where the tank is real and
    // no flow overlays those routes.
    document.body.classList.toggle('exporting', isDay && !isSto);

    /* ── heat pump: runs when charging by day, or heating off-grid at night ── */
    var hpOn = chargeFlow || (!isDay && !isSto);   // runs regardless of the flow flag
    show('hp-ring-1', hpOn); show('hp-ring-2', hpOn); show('hp-off-overlay', !hpOn);
    ['hp-fan-1', 'hp-fan-2'].forEach(function (id) {
      var e = el(id); if (e) e.classList.toggle('off', !hpOn);
    });
    var ringCol = (!isDay && !isSto) ? RED : ORANGE;
    ['hp-ring-1', 'hp-ring-2'].forEach(function (id) {
      var e = el(id); if (e) e.setAttribute('stroke', ringCol);
    });

    /* ── readouts ── */
    var chip = el('lbl-mode-chip');
    if (isSto) {
      chip.textContent = isDay ? 'Charging' : 'Discharging';
      chip.setAttribute('fill', isDay ? ORANGE : GREEN);
    } else {
      chip.textContent = isDay ? 'Exporting' : 'Grid heating';
      chip.setAttribute('fill', isDay ? DIM : RED);
    }

    var bat = el('lbl-battery-val');
    bat.textContent = !isSto ? 'None' : (isDay ? 'Charging' : 'Releasing');
    bat.setAttribute('style', 'fill:' + (!isSto ? DIM : (isDay ? ORANGE : GREEN)));

    var hp = el('lbl-hp-val');
    hp.textContent = hpOn ? 'On' : 'Off';
    hp.setAttribute('style', 'fill:' + (hpOn ? ringCol : 'rgba(255,255,255,0.4)'));

    var rad = el('lbl-radiators-val');
    rad.textContent = isDay ? 'Off' : 'On';
    rad.setAttribute('style', 'fill:' + (isDay ? 'rgba(255,255,255,0.5)' : (isSto ? GREEN : RED)));

    // Temperatures are illustrative here (no live feed on the website).
    setTemp('lbl-battery-temp', isSto ? (isDay ? 58 : 49) : null);
    setTemp('lbl-hp-temp', hpOn ? 47 : null);
    setTemp('lbl-radiators-temp', isDay ? 19.5 : 21.5);
    el('lbl-outdoor-temp').textContent = isDay ? '14.0\\u00b0C' : '5.0\\u00b0C';
    el('lbl-outdoor-cond').textContent = 'Clear';

    /* ── shell chrome ── */
    var bDay = el('btn-day'), bNight = el('btn-night');
    bDay.className = isDay ? 'tod-btn active-day' : 'tod-btn';
    bNight.className = isDay ? 'tod-btn' : (isSto ? 'tod-btn active-night-s' : 'tod-btn active-night-n');
    bDay.textContent = d.btnDay; bNight.textContent = d.btnNight;

    el('storage-toggle').classList.toggle('on', isSto);
    el('lbl-no').classList.toggle('active', !isSto);
    el('lbl-yes').classList.toggle('active', isSto);

    el('timer-bar').style.background = isDay ? 'var(--orange)' : (isSto ? 'var(--green)' : 'var(--red)');
    // "Setup: Payoff." renders the payoff in the accent, the site's
    // headline pattern. COPY is builder-owned constant text, never input.
    var ci = d.h.indexOf(': ');
    if (ci > 0) {
      el('scene-heading').innerHTML =
        '<span>' + d.h.slice(0, ci + 1) + '</span> <span class="h-pay">' + d.h.slice(ci + 2) + '</span>';
    } else {
      el('scene-heading').textContent = d.h;
    }
    el('scene-sub').textContent = d.s;

    var hls = ['hl-o', 'hl-g', 'hl-r'];
    d.cards.forEach(function (c, i) {
      var card = el('card-' + i); if (!card) return;
      hls.forEach(function (h) { card.classList.remove(h); });
      if (c.hl) card.classList.add(c.hl);
      card.children[0].textContent = c.icon;
      card.children[1].textContent = c.title;
      card.children[2].textContent = c.body;
    });
  }

  function setTemp(id, v) {
    var e = el(id); if (!e) return;
    if (v == null) { e.textContent = '--'; e.classList.add('muted'); }
    else { e.textContent = v.toFixed(1) + '\\u00b0C'; e.classList.remove('muted'); }
  }

  function startTimer() {
    clearInterval(timerInterval);
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    timerInterval = setInterval(function () {
      timerProgress += 100 / (CYCLE_MS / 100);
      if (timerProgress >= 100) {
        timerProgress = 0;
        mode = (mode === 'day') ? 'night' : 'day';
        applyState();
      }
      el('timer-bar').style.width = timerProgress + '%';
    }, 100);
  }

  function pick(m) {
    mode = m; timerProgress = 0;
    el('timer-bar').style.width = '0%';
    applyState();
  }

  el('btn-day').addEventListener('click', function () { pick('day'); });
  el('btn-night').addEventListener('click', function () { pick('night'); });
  el('storage-toggle').addEventListener('click', function () {
    hasStorage = !hasStorage; applyState();
  });

  applyState();
  startTimer();
})();
</script>
</body>
</html>
`;

/* Every url(#id) must resolve to something defined in the output.
   Swapping the v2 scene for v3 renamed store-glow-o/-g to store-glow-c/-d,
   and the shell kept pointing at the old names: the glow then filled with a
   gradient that did not exist, which renders as nothing and throws no error.
   The id check below cannot catch that, because these are paint references,
   not elements the script looks up. */
const definedIds = new Set([...out.matchAll(/id="([^"]+)"/g)].map((m) => m[1]));
const danglingRefs = [...new Set([...out.matchAll(/url\(#([a-zA-Z0-9_-]+)\)/g)].map((m) => m[1]))]
  .filter((id) => !definedIds.has(id));
if (danglingRefs.length) {
  throw new Error("output references undefined paint ids: " + danglingRefs.join(", "));
}

/* Every --flow-* the scene strokes from must actually be set by the shell.
   v3 paints its flow paths from CSS variables its own script assigns, and we
   drop that script. It uses --flow-hp for the heat-pump leg and --flow-main
   for the house legs; setting only --flow-main left the charge animation
   stroked with an undefined value, i.e. invisible, with no error anywhere.
   Variables carrying a fallback (var(--x,#fff)) are fine unset. */
const strokedVars = new Set(
  [...out.matchAll(/var\((--flow-[a-z-]+)\s*\)/g)].map((m) => m[1]),
);
const setVars = new Set(
  [...out.matchAll(/setProperty\('(--flow-[a-z-]+)'/g)].map((m) => m[1]),
);
const unsetVars = [...strokedVars].filter((v) => !setVars.has(v));
if (unsetVars.length) {
  throw new Error(
    "the scene strokes from CSS variables the shell never sets: " + unsetVars.join(", ") +
    " (they would render as invisible flows)",
  );
}

// Cheap structural assertions, silent truncation is the failure mode here.
[
  ["storage-toggle", /id="storage-toggle"/],
  ["btn-day", /id="btn-day"/],
  ["btn-night", /id="btn-night"/],
  ["timer-bar", /id="timer-bar"/],
  ["card-0", /id="card-0"/],
  ["card-1", /id="card-1"/],
  ["card-2", /id="card-2"/],
  ["scene svg", /<svg[\s\S]*<\/svg>/],
  ["g-store", /id="g-store"/],
  ["g-flow-hp", /id="g-flow-hp"/],
  ["g-flow-export", /id="g-flow-export"/],
  ["lbl-mode-chip", /id="lbl-mode-chip"/],
  // the controls override must survive, or the toggle renders 0x0 and
  // is unclickable (a scripted .click() still "works", so test by hit-test)
  ["controls override", /\.controls \{\s*\n\s*display: flex;/],
].forEach(([what, re]) => {
  if (!re.test(out)) throw new Error("output is missing " + what);
});

const dest = path.join(DIR, "homepage-flow-v2.html");
fs.writeFileSync(dest, out);
console.log("wrote " + dest + " (" + out.length + " bytes), all blocks present");
