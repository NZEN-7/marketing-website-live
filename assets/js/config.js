/* =========================================================================
   Thermal Dawn, central config
   -------------------------------------------------------------------------
   STRIPE PAYMENT LINKS (live since 31 Jul 2026)

   These are the ONLY place the payment URLs are written. The reserve forms
   redirect here after /api/lead has recorded the lead, so Nick has the
   enquiry even when someone abandons checkout.

   Note: the after-payment redirect (back to /thank-you/...) is configured
   inside Stripe, not here. When the site moves to freevolt.com.au or the
   real domain, those redirect URLs must be updated in the Stripe dashboard.
   ========================================================================= */
window.TD_CONFIG = {
  stripe: {
    // Basic Reserve, $190 refundable deposit
    basicReserve: "https://buy.stripe.com/5kQbIUcY9dgO37d0Gk4F200",
    // Founder Premium, $990 refundable deposit
    founderPremium: "https://buy.stripe.com/14A3co4rDgt0bDJagU4F201"
  },
  // Pre-order terms, now hosted here (ported verbatim 31 Jul 2026).
  termsUrl: "/pre-order/terms/"
};

/* Apply Stripe links to any element with data-stripe="basicReserve|founderPremium",
   and the terms URL to any element with data-terms-link. */
document.addEventListener("DOMContentLoaded", function () {
  var cfg = window.TD_CONFIG || {};
  var s = cfg.stripe || {};
  document.querySelectorAll("[data-stripe]").forEach(function (el) {
    var key = el.getAttribute("data-stripe");
    if (s[key]) el.setAttribute("href", s[key]);
  });
  if (cfg.termsUrl) {
    document.querySelectorAll("[data-terms-link]").forEach(function (el) {
      el.setAttribute("href", cfg.termsUrl);
    });
  }
});
