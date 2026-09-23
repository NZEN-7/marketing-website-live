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
    // Legacy Basic Reserve, $190. Unlinked from the site since 24 Sep 2026
    // but deliberately still live for direct-link use; /pre-order/basic-reserve/
    // is the only page that uses it.
    basicReserve: "https://buy.stripe.com/5kQbIUcY9dgO37d0Gk4F200",
    // THE booking deposit, $990 refundable. The key is still "founderPremium"
    // because renaming it would break the api/lead.js -> email -> CRM contract;
    // the page moved to /pre-order/booking/ on 24 Sep 2026, the key did not.
    founderPremium: "https://buy.stripe.com/14A3co4rDgt0bDJagU4F201"
  },
  // Booking Terms and Conditions (replaced the Pre-Order T&Cs 24 Sep 2026,
  // same URL so existing Stripe links and emails keep resolving).
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
