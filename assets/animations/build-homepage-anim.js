/* Build the homepage animation: the v2 scene graphic from TD-Platform
   dropped into the existing homepage shell (With/Without Storage toggle,
   day/night buttons, timer bar, three explainer cards).

   node build-homepage-anim.js <animationsDir>
*/
const fs = require("fs");
const path = require("path");

const DIR = process.argv[2];
const v2 = fs.readFileSync(path.join(DIR, "thermal-dawn-flow-v2.html"), "utf8");
const shell = fs.readFileSync(path.join(DIR, "homepage_web_animation_new.html"), "utf8");

const grab = (src, re, what) => {
  const m = src.match(re);
  if (!m) throw new Error("could not find " + what);
  return m[1];
};

// v2: the scene's own CSS and the whole <svg> block.
const v2Style = grab(v2, /<style>([\s\S]*?)<\/style>/, "v2 style");
const v2Svg = grab(v2, /(<svg[\s\S]*<\/svg>)/, "v2 svg");

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
<title>Thermal Dawn — Energy Flow</title>
<link href="https://fonts.googleapis.com/css2?family=DM+Mono:wght@500;600&family=Inter:wght@500;600&display=swap" rel="stylesheet"/>
<style>
/* ─────────────────────────────────────────────────────────────────────
   GENERATED FILE — do not hand-edit.
   Built by scratchpad/build-homepage-anim.js from:
     · thermal-dawn-flow-v2.html      (the scene graphic, from TD-Platform)
     · homepage_web_animation_new.html (the shell: toggle, buttons, cards)
   Re-run the builder after changing either source.
   ───────────────────────────────────────────────────────────────────── */

/* ── shell chrome (controls / cards / layout) ── */
${shellChrome}

/* ── v2 scene ── */
${v2Style}

/* the shell lays this out; the scene must not force full-viewport height */
html, body { height: auto; overflow-x: hidden; overflow-y: visible; }
body { display: block; background: var(--bg); }
.svg-wrap { width: 100%; max-width: 560px; margin: 0 auto; }
svg { display: block; width: 100%; height: auto; overflow: hidden; }
</style>
</head>
<body>
<div class="scene">
  <div class="label-row">Thermal Dawn — Energy Flow</div>

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

  var ORANGE = '#E87C2A', GREEN = '#2EC68A', RED = '#E84A2A', DIM = 'rgba(255,255,255,0.5)';

  // Four scenarios: {storage} x {day,night}. Copy is the shell's, kept as-is.
  var COPY = {
    s: {
      day: {
        h: 'With Thermal Storage: Your Solar. All Night Long.',
        s: 'See how Thermal Dawn captures daytime solar and delivers it as comfort after dark.',
        btnDay: '\\u2600 Daytime charging', btnNight: '\\ud83c\\udf19 Evening comfort',
        cards: [
          { title:'Daytime Charging', icon:'\\u2600\\ufe0f', body:'Solar panels power the heat pump during the day, charging the thermal store while electricity is free.', hl:'hl-o' },
          { title:'35 kWh Stored',    icon:'\\u25c9',        body:'Enough heat for an entire evening and overnight \\u2014 without touching the grid.', hl:'' },
          { title:'Evening Comfort',  icon:'\\u2668\\ufe0f', body:'Heat pump switches off at sunset. Stored heat flows through radiators and underfloor all evening \\u2014 no grid needed.', hl:'' }
        ]
      },
      night: {
        h: 'With Thermal Storage: Your Solar. All Night Long.',
        s: 'See how Thermal Dawn captures daytime solar and delivers it as comfort after dark.',
        btnDay: '\\u2600 Daytime charging', btnNight: '\\ud83c\\udf19 Evening comfort',
        cards: [
          { title:'Daytime Charging', icon:'\\u2600\\ufe0f', body:'Solar panels power the heat pump during the day, charging the thermal store while electricity is free.', hl:'' },
          { title:'35 kWh Stored',    icon:'\\u25c9',        body:'Enough heat for an entire evening and overnight \\u2014 without touching the grid.', hl:'' },
          { title:'Evening Comfort',  icon:'\\u2668\\ufe0f', body:'Heat pump switches off at sunset. Stored heat flows through radiators and underfloor all evening \\u2014 no grid needed.', hl:'hl-g' }
        ]
      }
    },
    n: {
      day: {
        h: 'Without Storage: Buy High, Sell Low.',
        s: 'Without thermal storage, you sell cheap solar during the day \\u2014 then buy expensive peak-rate grid power all evening.',
        btnDay: '\\u2600 Cheap exports', btnNight: '\\ud83c\\udf19 Evening cost',
        cards: [
          { title:'Daytime Export',    icon:'\\u2600\\ufe0f', body:'Your solar generates power during the day \\u2014 but with nowhere to store it, it\\'s exported to the grid at near-zero feed-in rates.', hl:'hl-o' },
          { title:'No Storage',        icon:'\\u25c9',        body:'Without thermal storage there\\'s nowhere to keep your solar energy for later use.', hl:'' },
          { title:'Evening Grid Cost', icon:'\\u2668\\ufe0f', body:'When the sun sets, the heat pump switches on \\u2014 drawing expensive peak-rate electricity from the grid all evening.', hl:'' }
        ]
      },
      night: {
        h: 'Without Storage: Buy High, Sell Low.',
        s: 'Without thermal storage, you sell cheap solar during the day \\u2014 then buy expensive peak-rate grid power all evening.',
        btnDay: '\\u2600 Cheap exports', btnNight: '\\ud83c\\udf19 Evening cost',
        cards: [
          { title:'Daytime Export',    icon:'\\u2600\\ufe0f', body:'Your solar generates power during the day \\u2014 but with nowhere to store it, it\\'s exported to the grid at near-zero feed-in rates.', hl:'' },
          { title:'No Storage',        icon:'\\u25c9',        body:'Without thermal storage there\\'s nowhere to keep your solar energy for later use.', hl:'' },
          { title:'Evening Grid Cost', icon:'\\u2668\\ufe0f', body:'When the sun sets, the heat pump switches on \\u2014 drawing expensive peak-rate electricity from the grid all evening.', hl:'hl-r' }
        ]
      }
    }
  };

  function el(id) { return document.getElementById(id); }
  function show(id, on) { var e = el(id); if (e) e.style.opacity = on ? '1' : '0'; }
  function hide(id, hidden) { var e = el(id); if (e) e.classList.toggle('hide', hidden); }

  // Sun tracks a fixed mid-morning / late-afternoon position rather than the
  // wall clock — this is an explainer, not a live dashboard.
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

    /* ── the thermal store only exists in the "with storage" world ── */
    show('g-store', isSto);
    var glow = el('store-glow-el');
    if (glow) {
      glow.setAttribute('fill', isDay ? 'url(#store-glow-o)' : 'url(#store-glow-g)');
      glow.style.opacity = isSto ? '0.55' : '0';
    }

    /* ── flows: exactly one story at a time ──
       day+storage    solar -> heat pump -> store        (charging, orange)
       night+storage  store -> home                      (discharging, green)
       day-no-storage nothing stored; solar is exported  (no flow to draw)
       night-no-store grid -> heat pump -> home          (buying peak, red) */
    var chargeFlow = isDay && isSto;
    var homeFlow   = (!isDay && isSto) || (!isDay && !isSto);
    var flowCol    = (!isDay && !isSto) ? RED : (isDay ? ORANGE : GREEN);

    show('g-flow-hp', chargeFlow || (!isDay && !isSto));
    // Solar leaving the property: only when there is nowhere to store it.
    show('g-flow-export', isDay && !isSto);
    ['g-flow-home', 'g-flow-home-2'].forEach(function (id) {
      var g = el(id); if (!g) return;
      g.style.opacity = homeFlow ? '1' : '0';
      g.style.setProperty('--flow-main', flowCol);
    });

    /* ── heat pump: runs when charging by day, or heating off-grid at night ── */
    var hpOn = chargeFlow || (!isDay && !isSto);
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
    el('scene-heading').textContent = d.h;
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
    if (v == null) { e.textContent = '\\u2014'; e.classList.add('muted'); }
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

// Cheap structural assertions — silent truncation is the failure mode here.
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
].forEach(([what, re]) => {
  if (!re.test(out)) throw new Error("output is missing " + what);
});

const dest = path.join(DIR, "homepage-flow-v2.html");
fs.writeFileSync(dest, out);
console.log("wrote " + dest + " (" + out.length + " bytes) — all blocks present");
