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
          '<img src="/assets/img/logo-black.webp" alt="Thermal Dawn" width="240" height="48">' +
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

  var FOOTER =
    '<div class="wrap">' +
      '<div class="footer-grid">' +
        '<div class="footer-col">' +
          '<div class="footer-logo"><img src="/assets/img/logo-white.webp" alt="Thermal Dawn" width="240" height="48"></div>' +
          '<p class="micro" style="color:#c9c2bb;max-width:34ch">Australian-made thermal storage that captures your solar and runs your heating, cooling, and hot water — for a fraction of the cost of a battery.</p>' +
          '<address>Thermal Dawn<br>3 Apollo Place, Lane Cove West, NSW 2066<br>Made in Hornsby, NSW</address>' +
        '</div>' +
        '<div class="footer-col">' +
          '<h4>Explore</h4>' +
          '<ul>' +
            '<li><a href="/hydronic/">Hydronic System</a></li>' +
            '<li><a href="/hydronic/how-it-works/">How It Works</a></li>' +
            '<li><a href="/hydronic/pricing/">Pricing &amp; Inclusions</a></li>' +
            '<li><a href="/intelligence/">Intelligence</a></li>' +
            '<li><a href="/mission/">Mission</a></li>' +
            '<li><a href="/blog/">Blog</a></li>' +
          '</ul>' +
        '</div>' +
        '<div class="footer-col">' +
          '<h4>Get Started</h4>' +
          '<ul>' +
            '<li><a href="/pre-order/register-interest/">Register Interest</a></li>' +
            '<li><a href="/pre-order/">Reserve Your System</a></li>' +
            '<li><a href="/contact/">Contact Us</a></li>' +
          '</ul>' +
          '<h4 style="margin-top:20px">Follow</h4>' +
          '<div class="footer-social">' +
            '<a href="https://www.facebook.com/" rel="noopener">Facebook</a>' +
            '<a href="https://www.linkedin.com/" rel="noopener">LinkedIn</a>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="footer-bottom">' +
        '<span>&copy; ' + YEAR + ' Thermal Dawn. ABN 47 682 866 913. All Rights Reserved.</span>' +
        '<span><a href="/pre-order/">Reserve</a> &middot; <a href="/contact/">Contact</a></span>' +
      '</div>' +
    '</div>';

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
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", inject);
  } else {
    inject();
  }
})();
