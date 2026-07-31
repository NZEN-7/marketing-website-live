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

    // Swap "Other" for whatever was typed next to it.
    var others = form.querySelectorAll("[data-other-for]");
    for (var j = 0; j < others.length; j++) {
      var input = others[j];
      var group = input.getAttribute("data-other-for");
      var list = out[group];
      if (!Array.isArray(list)) continue;
      var idx = list.indexOf("Other");
      if (idx === -1) continue;
      var typed = (input.value || "").trim();
      if (typed) list[idx] = typed;
    }

    return out;
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

    // Reveal the free-text box only once its "Other" checkbox is ticked.
    var otherInputs = form.querySelectorAll("[data-other-for]");
    for (var k = 0; k < otherInputs.length; k++) {
      (function (input) {
        var group = input.getAttribute("data-other-for");
        var boxes = form.querySelectorAll('input[name="' + group + '"][value="Other"]');
        function sync() {
          var on = boxes.length ? boxes[0].checked : false;
          input.hidden = !on;
          if (!on) input.value = "";
        }
        for (var b = 0; b < boxes.length; b++) boxes[b].addEventListener("change", sync);
        sync();
      })(otherInputs[k]);
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
            window.location.href = redirect;
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
