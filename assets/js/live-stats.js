/* Live savings counter — progressive enhancement.
 *
 * Any element with data-live-stat="<key>" gets its number replaced by the
 * platform's live fleet totals (GET /api/public/stats on the portal,
 * edge-cached 10 min, aggregates only). Keys:
 *   totalSavedAud · gasAvoidedMj · co2AvoidedKg          (fleet)
 *   fi:savedAud   · fi:gasMj     · fi:co2Kg              (first install)
 * On any failure the baked-in audited figures simply remain — the page
 * never depends on the endpoint. Elements with class "live-dot" are
 * unhidden when live data lands.
 */
(function () {
  var els = document.querySelectorAll('[data-live-stat]');
  if (!els.length || !('fetch' in window)) return;
  var url =
    (window.TD_CONFIG && window.TD_CONFIG.statsUrl) ||
    'https://td-platform.vercel.app/api/public/stats';

  function countUp(el, target) {
    var start = parseFloat(el.textContent.replace(/[^0-9.]/g, '')) || 0;
    if (Math.round(start) === Math.round(target)) return;
    var t0 = performance.now();
    var dur = 900;
    function frame(t) {
      var k = Math.min(1, (t - t0) / dur);
      k = 1 - Math.pow(1 - k, 3); /* ease-out cubic */
      el.textContent = Math.round(start + (target - start) * k).toLocaleString('en-AU');
      if (k < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  fetch(url)
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (data) {
      if (!data) return;
      var any = false;
      els.forEach(function (el) {
        var key = el.getAttribute('data-live-stat');
        var v = key.indexOf('fi:') === 0
          ? data.firstInstall && data.firstInstall[key.slice(3)]
          : data[key];
        if (typeof v !== 'number' || !(v > 0)) return;
        countUp(el, v);
        any = true;
      });
      if (any) {
        document.querySelectorAll('.live-dot').forEach(function (d) { d.hidden = false; });
      }
    })
    .catch(function () { /* static figures stand */ });
})();
