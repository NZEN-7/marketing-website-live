/* =========================================================================
   Thermal Dawn — website form submission
   -------------------------------------------------------------------------
   Progressive enhancement for any <form data-lead-form="...">. Native HTML
   validation runs first; this only takes over the submit to POST JSON at
   /api/lead and route to the right thank-you page.

   A failed send must never silently swallow a lead, so the error state always
   surfaces a mailto fallback.
   ========================================================================= */
(function () {
  "use strict";

  var ENDPOINT = "/api/lead";
  var FALLBACK_EMAIL = "nickz@thermaldawn.com";

  /* Checkbox groups post as arrays. A checked "Other" contributes the text
     typed beside it rather than the literal word. */
  function serialize(form) {
    var out = {};
    var els = form.elements;

    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      var name = el.name;
      if (!name || el.disabled || el.type === "submit" || el.type === "button") continue;
      if (name.slice(-6) === "_other") continue; // handled with its group

      if (el.type === "checkbox") {
        if (el.getAttribute("data-single") !== null) {
          out[name] = el.checked;                        // lone checkbox = boolean
        } else if (el.checked) {
          (out[name] = out[name] || []).push(el.value);  // group = array
        }
      } else if (el.type === "radio") {
        if (el.checked) out[name] = el.value;
      } else {
        out[name] = el.value;
      }
    }

    // Swap "Other" for whatever was typed next to it, for both checkbox
    // groups (array value) and radio groups (string value).
    var others = form.querySelectorAll("[data-other-for]");
    for (var j = 0; j < others.length; j++) {
      var input = others[j];
      var group = input.getAttribute("data-other-for");
      var typed = (input.value || "").trim();
      if (!typed) continue;
      var val = out[group];
      if (Array.isArray(val)) {
        var idx = val.indexOf("Other");
        if (idx !== -1) val[idx] = typed;
      } else if (val === "Other") {
        out[group] = typed;
      }
    }

    return out;
  }

  /* Deposit forms hand off to Stripe rather than a thank-you page. The email
     is already sent by this point, so an abandoned checkout still leaves a
     qualified lead. prefilled_email saves retyping; client_reference_id is
     what ties the Stripe payment back to that lead email. */
  function nextUrl(form, payload, data) {
    var stripeKey = form.getAttribute("data-stripe-key");
    var cfg = (window.TD_CONFIG && window.TD_CONFIG.stripe) || {};
    var link = stripeKey && cfg[stripeKey];
    if (!link || link.charAt(0) === "#") {
      return form.getAttribute("data-redirect") || "/thank-you/";
    }
    var sep = link.indexOf("?") === -1 ? "?" : "&";
    var url = link + sep + "prefilled_email=" + encodeURIComponent(payload.email || "");
    if (data && data.ref) url += "&client_reference_id=" + encodeURIComponent(data.ref);
    return url;
  }

  function showError(form, message) {
    var box = form.querySelector("[data-form-error]");
    if (!box) {
      box = document.createElement("p");
      box.setAttribute("data-form-error", "");
      box.className = "form-error";
      form.appendChild(box);
    }
    box.innerHTML =
      message +
      ' You can also email us directly at <a href="mailto:' +
      FALLBACK_EMAIL + '">' + FALLBACK_EMAIL + "</a>.";
    box.hidden = false;
  }

  function wire(form) {
    var kind = form.getAttribute("data-lead-form");
    var redirect = form.getAttribute("data-redirect") || "/thank-you/";
    var button = form.querySelector('button[type="submit"], input[type="submit"]');
    var stamped = Date.now();

    // Reveal the free-text box only once its "Other" option is chosen.
    // Works for checkbox groups and radio groups: for radios every member of
    // the group has to be watched, since ticking a sibling clears "Other".
    var otherInputs = form.querySelectorAll("[data-other-for]");
    for (var k = 0; k < otherInputs.length; k++) {
      (function (input) {
        var group = input.getAttribute("data-other-for");
        var all = form.querySelectorAll('input[name="' + group + '"]');
        var otherOpt = form.querySelector('input[name="' + group + '"][value="Other"]');
        function sync() {
          var on = otherOpt ? otherOpt.checked : false;
          input.hidden = !on;
          if (!on) input.value = "";
        }
        for (var b = 0; b < all.length; b++) all[b].addEventListener("change", sync);
        sync();
      })(otherInputs[k]);
    }

    /* Pill selectors carry their selected state as a class rather than with
       :has(input:checked). The CSS selector matches and the browser reports
       support for it, but the declaration never wins in practice here (tested
       24 Aug), so the visual state was silently dead while the form still
       submitted correctly, which is the worst version of that bug. A class is
       boring and it works everywhere. */
    var pills = form.querySelectorAll(".field--group .choice input");
    if (pills.length) {
      var paintPills = function () {
        for (var q = 0; q < pills.length; q++) {
          var lab = pills[q].closest ? pills[q].closest(".choice") : pills[q].parentNode;
          if (lab) lab.classList.toggle("is-selected", pills[q].checked);
        }
      };
      for (var pz = 0; pz < pills.length; pz++) {
        pills[pz].addEventListener("change", paintPills);
      }
      paintPills();
    }

    form.addEventListener("submit", function (e) {
      e.preventDefault();

      var errBox = form.querySelector("[data-form-error]");
      if (errBox) errBox.hidden = true;

      // "Pick at least one" isn't expressible with native checkbox required,
      // so groups marked data-require-group are checked here.
      var groups = form.querySelectorAll("[data-require-group]");
      for (var g = 0; g < groups.length; g++) {
        var groupName = groups[g].getAttribute("data-require-group");
        if (!form.querySelector('input[name="' + groupName + '"]:checked')) {
          showError(form, "Please choose at least one option for “" +
            (groups[g].querySelector("legend") || {}).textContent.replace("*", "").trim() + "”.");
          groups[g].scrollIntoView({ block: "center", behavior: "smooth" });
          return;
        }
      }

      var payload = serialize(form);
      payload.form = kind;
      payload.ts = stamped;

      var label = button ? button.innerHTML : "";
      if (button) {
        button.disabled = true;
        button.innerHTML = "Sending...";
      }

      fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
        .then(function (res) {
          return res.json().catch(function () { return { ok: res.ok }; });
        })
        .then(function (data) {
          if (data && data.ok) {
            window.location.href = nextUrl(form, payload, data);
            return;
          }
          throw new Error((data && data.error) || "Send failed");
        })
        .catch(function () {
          if (button) {
            button.disabled = false;
            button.innerHTML = label;
          }
          showError(form, "Something went wrong sending that.");
        });
    });
  }

  function init() {
    var forms = document.querySelectorAll("form[data-lead-form]");
    for (var i = 0; i < forms.length; i++) wire(forms[i]);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
