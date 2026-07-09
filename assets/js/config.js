/* =========================================================================
   Thermal Dawn — central config
   -------------------------------------------------------------------------
   STRIPE PAYMENT LINKS
   We do NOT have Stripe Payment Links yet. The reserve buttons currently point
   to the placeholder anchors below. When the Payment Links are created in the
   Stripe dashboard, replace the two URLs here (this is the ONLY place to edit)
   and the reserve pages will pick them up automatically on load.

   Example once live:
     basicReserve : "https://buy.stripe.com/xxxxxxxxxxxx",
     founderPremium: "https://buy.stripe.com/yyyyyyyyyyyy"
   ========================================================================= */
window.TD_CONFIG = {
  stripe: {
    // Basic Reserve — $190 refundable deposit
    basicReserve: "#STRIPE-BASIC-RESERVE",
    // Founder Premium — $990 refundable deposit
    founderPremium: "#STRIPE-FOUNDER-PREMIUM"
  }
};

/* Apply Stripe links to any element with data-stripe="basicReserve|founderPremium" */
document.addEventListener("DOMContentLoaded", function () {
  var s = (window.TD_CONFIG && window.TD_CONFIG.stripe) || {};
  document.querySelectorAll("[data-stripe]").forEach(function (el) {
    var key = el.getAttribute("data-stripe");
    if (s[key]) el.setAttribute("href", s[key]);
  });
});
