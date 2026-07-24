/* =========================================================================
   Thermal Dawn — shared header/footer include + nav behaviour
   No server-side includes: header & footer markup live here and are injected
   into every page's <header id="site-header"> and <footer id="site-footer">.
   Root-relative links (/hydronic/ etc.) so it works at any URL depth on Netlify.
   ========================================================================= */
(function () {
  "use strict";

  var YEAR = new Date().getFullYear();

  var HEADER =
    '<div class="site-header">' +
      '<nav class="nav" aria-label="Primary">' +
        '<a class="nav__logo" href="/" aria-label="Thermal Dawn home">' +
          '<img src="/assets/img/logo-white.webp" alt="Thermal Dawn" width="240" height="48">' +
        '</a>' +
        '<button class="nav__toggle" aria-label="Menu" aria-expanded="false"><span></span><span></span><span></span></button>' +
        '<ul class="nav__menu" id="nav-menu">' +
          '<li class="nav__has-sub">' +
            '<a href="/hydronic/" data-nav="/hydronic/">Hydronic</a>' +
            '<ul class="nav__sub">' +
              '<li><a href="/hydronic/" data-nav="/hydronic/">Hydronic Overview</a></li>' +
              '<li><a href="/hydronic/how-it-works/" data-nav="/hydronic/how-it-works/">How It Works</a></li>' +
              '<li><a href="/hydronic/pricing/" data-nav="/hydronic/pricing/">Pricing &amp; Inclusions</a></li>' +
            '</ul>' +
          '</li>' +
          '<li><a href="/intelligence/" data-nav="/intelligence/">Intelligence</a></li>' +
          '<li><a href="/mission/" data-nav="/mission/">Mission</a></li>' +
          '<li><a href="/blog/" data-nav="/blog/">Blog</a></li>' +
          '<li><a href="/contact/" data-nav="/contact/">Contact</a></li>' +
          '<li class="nav__cta-mob"><a href="/pre-order/" data-nav="/pre-order/">Reserve Your System</a></li>' +
        '</ul>' +
        '<a class="btn btn--primary btn--sm nav__cta" href="/pre-order/">Reserve Your System</a>' +
      '</nav>' +
    '</div>';

  var ICON_FB =
    '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M13.5 21v-8h2.7l.4-3.1h-3.1V7.9c0-.9.25-1.5 1.55-1.5H16.7V3.6c-.29-.04-1.28-.13-2.43-.13-2.4 0-4.05 1.47-4.05 4.17V9.9H7.5V13h2.72v8h3.28z"/></svg>';
  var ICON_LI =
    '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6.94 8.5H4V20h2.94V8.5zM5.47 4a1.72 1.72 0 100 3.44 1.72 1.72 0 000-3.44zM20 13.7c0-3.2-1.71-4.7-4-4.7-1.84 0-2.66 1.02-3.12 1.73V8.5H9.94V20h2.94v-6.2c0-1.31.25-2.58 1.87-2.58 1.6 0 1.62 1.5 1.62 2.66V20H20v-6.3z"/></svg>';

  var FOOTER =
    '<div class="wrap footer-center">' +
      '<div class="footer-center__logo"><img src="/assets/img/logo-white.webp" alt="Thermal Dawn" width="240" height="48"></div>' +
      '<div class="footer-social footer-social--icons">' +
        '<a href="https://www.facebook.com/" rel="noopener" aria-label="Thermal Dawn on Facebook">' + ICON_FB + '</a>' +
        '<a href="https://www.linkedin.com/" rel="noopener" aria-label="Thermal Dawn on LinkedIn">' + ICON_LI + '</a>' +
      '</div>' +
      '<nav class="footer-links" aria-label="Footer">' +
        '<a href="/hydronic/">Hydronic</a>' +
        '<a href="/hydronic/how-it-works/">How It Works</a>' +
        '<a href="/hydronic/pricing/">Pricing</a>' +
        '<a href="/intelligence/">Intelligence</a>' +
        '<a href="/mission/">Mission</a>' +
        '<a href="/blog/">Blog</a>' +
        '<a href="/pre-order/">Reserve</a>' +
        '<a href="/contact/">Contact</a>' +
      '</nav>' +
      // TODO: add the unit/street number once confirmed — currently suburb-level only.
      '<address class="footer-address">Thermal Dawn, Hornsby, NSW 2077</address>' +
      '<p class="footer-legal">&copy; ' + YEAR + ' Thermal Dawn Pty Ltd. ABN 47 682 866 913. All Rights Reserved.</p>' +
    '</div>';

  /* Partner logos degrade to the organisation's name until a real file
     exists. Each .plogo carries data-logo="<basename>"; we try
     /assets/img/partners/<basename>.svg (or -white.svg on a dark surface)
     and only swap the text out once the image actually decodes. */
  function upgradePartnerLogos() {
    document.querySelectorAll(".plogo[data-logo]").forEach(function (el) {
      var name = el.getAttribute("data-logo");
      var txt = el.querySelector(".plogo__txt");
      if (!name || !txt) return;
      var onDark = !!el.closest(".section--dark, .section--cocoa, .band-dark") ||
                   document.body.classList.contains("dark");
      var src = "/assets/img/partners/" + name + (onDark ? "-white" : "") + ".svg";
      var img = new Image();
      img.onload = function () {
        img.alt = txt.textContent;
        img.loading = "lazy";
        el.insertBefore(img, txt);
        txt.hidden = true;
      };
      img.onerror = function () { /* no file yet — leave the text in place */ };
      img.src = src;
    });
  }

  function inject() {
    var h = document.getElementById("site-header");
    if (h) h.innerHTML = HEADER;
    var f = document.getElementById("site-footer");
    if (f) f.innerHTML = FOOTER;

    // active link
    var path = location.pathname.replace(/index\.html$/, "");
    if (path.length > 1 && path.slice(-1) !== "/") path += "/";
    document.querySelectorAll("[data-nav]").forEach(function (a) {
      var t = a.getAttribute("data-nav");
      if (t === path || (t !== "/" && path.indexOf(t) === 0)) a.classList.add("is-active");
    });

    // mobile toggle
    var btn = document.querySelector(".nav__toggle");
    var menu = document.getElementById("nav-menu");
    if (btn && menu) {
      btn.addEventListener("click", function () {
        var open = menu.classList.toggle("open");
        btn.setAttribute("aria-expanded", open ? "true" : "false");
      });
    }

    upgradePartnerLogos();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", inject);
  } else {
    inject();
  }
})();
