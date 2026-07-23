/* Live savings ticker — progressive enhancement.
 *
 * Elements with data-live-stat="<key>" hold audited static figures in the
 * HTML (the no-JS / endpoint-down truth). On first scroll into view each
 * one tickers up from 0 — digits flip fast, then decelerate into the final
 * value (ease-out quartic). If the platform's public stats endpoint
 * answers (GET /api/public/stats, aggregates only, edge-cached), targets
 * switch to the live values and any already-landed counter glides to the
 * fresh number; elements with class "live-dot" are unhidden. Keys:
 *   totalSavedAud · gasAvoidedMj · co2AvoidedKg          (fleet)
 *   fi:savedAud   · fi:gasMj     · fi:co2Kg              (first install)
 * Honors prefers-reduced-motion (no animation, final values only).
 */
(function () {
  var els = Array.prototype.slice.call(document.querySelectorAll('[data-live-stat]'));
  if (!els.length || !('fetch' in window)) return;
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var url =
    (window.TD_CONFIG && window.TD_CONFIG.statsUrl) ||
    'https://td-platform.vercel.app/api/public/stats';
  var live = null;

  function parseVal(el) {
    return parseFloat(el.textContent.replace(/[^0-9.]/g, '')) || 0;
  }
  els.forEach(function (el) {
    el.__static = parseVal(el);
  });

  function targetFor(el) {
    var key = el.getAttribute('data-live-stat');
    var v = live && (key.indexOf('fi:') === 0 ? (live.firstInstall || {})[key.slice(3)] : live[key]);
    return typeof v === 'number' && v > 0 ? v : el.__static;
  }
  function fmt(n) {
    return Math.round(n).toLocaleString('en-AU');
  }

  function tick(el, from, to, dur) {
    if (reduce) {
      el.textContent = fmt(to);
      el.__val = to;
      return;
    }
    if (el.__anim) cancelAnimationFrame(el.__anim);
    var t0 = performance.now();
    function frame(t) {
      var k = Math.min(1, (t - t0) / dur);
      k = 1 - Math.pow(1 - k, 4); /* flips fast, lands slow */
      var v = from + (to - from) * k;
      el.textContent = fmt(v);
      el.__val = v;
      if (k < 1) el.__anim = requestAnimationFrame(frame);
      else el.__anim = null;
    }
    el.__anim = requestAnimationFrame(frame);
  }

  /* Scroll trigger: ticker runs the first time a stat becomes visible. */
  if ('IntersectionObserver' in window && !reduce) {
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (en) {
          if (!en.isIntersecting) return;
          var el = en.target;
          io.unobserve(el);
          el.__seen = true;
          tick(el, 0, targetFor(el), 2400);
        });
      },
      { threshold: 0.4 },
    );
    els.forEach(function (el) {
      io.observe(el);
    });
  } else {
    els.forEach(function (el) {
      el.__seen = true;
      el.__val = el.__static;
    });
  }

  fetch(url)
    .then(function (r) {
      return r.ok ? r.json() : null;
    })
    .then(function (data) {
      if (!data) return;
      live = data;
      els.forEach(function (el) {
        /* Not scrolled to yet → the observer will pick up the live target.
           Already ticking/landed → glide from wherever it is to the live value. */
        if (el.__seen) tick(el, el.__val != null ? el.__val : el.__static, targetFor(el), 1200);
      });
      if (data.liveSites > 0) {
        document.querySelectorAll('.live-dot').forEach(function (d) {
          d.hidden = false;
        });
      }
    })
    .catch(function () {
      /* static figures stand */
    });
})();
