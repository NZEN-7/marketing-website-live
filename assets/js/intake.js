/* =========================================================================
   Thermal Dawn intake: the page (PROTOTYPE, PRD D13, 30 Sep 2026)
   -------------------------------------------------------------------------
   One <form> holds every question. Without JavaScript it is the long form
   (SPEC rule 11). With it, this shows one screen at a time, routes with
   intake-route.js, holds photo uploads in memory (resized to ~2,000 px) and
   sends ONE request at the end: answers + files -> api/lead.js -> one email.

   Not in the prototype (PRD D13): per-screen saves, partial alerts, the
   resume link, Supabase, the customer's first email.
   ========================================================================= */
(function () {
  "use strict";
  var form = document.querySelector("[data-intake]");
  if (!form || !window.TDIntakeRoute) return;
  var R = window.TDIntakeRoute;
  var ENDPOINT = "/api/lead/";
  var BEAT_MS = 280;                       // SPEC rule 13: the beat before auto-advance
  var MAX_FILE = 4 * 1024 * 1024;          // SPEC §2: a single file over 4 MB is "a bit big"
  var MAX_SET = 3.2 * 1024 * 1024;         // raw bytes; base64 + JSON must stay under Vercel's 4.5 MB
  var stamped = Date.now();

  // ---- postcode STUB (PRD D13). Replaced by the ABS POA-SAL data at build.
  // One remote postcode (2880 Broken Hill, ABS "Remote") for the delivery line.
  var SUBURBS = {
    "3000": ["Melbourne"], "3121": ["Burnley", "Cremorne", "Richmond"], "3122": ["Hawthorn", "Hawthorn North"],
    "3186": ["Brighton", "Brighton North"], "3820": ["Warragul"], "3350": ["Ballarat Central"],
    "2000": ["Sydney", "The Rocks", "Barangaroo"], "2088": ["Mosman"], "2500": ["Wollongong"],
    "2600": ["Canberra"], "2612": ["Braddon", "Reid", "Turner"], "2880": ["Broken Hill"],
    "4000": ["Brisbane City"], "5000": ["Adelaide"]
  };
  var REMOTE = { "2880": true };

  var $ = function (sel, el) { return (el || document).querySelector(sel); };
  var $$ = function (sel, el) { return Array.prototype.slice.call((el || document).querySelectorAll(sel)); };
  var screens = {};
  $$("[data-screen]", form).forEach(function (s) { screens[s.getAttribute("data-screen")] = s; });

  var nojs = $("[data-nojs]", form); if (nojs) nojs.value = "0";
  var nav = $("[data-nav]", form), progress = $("[data-progress]", form);
  var btnBack = $("[data-back]", form), btnCont = $("[data-continue]", form);
  var sending = $("[data-sending]", form);
  var history = [], seen = {}, current = null, sent = false, files = {}, advanceTimer = null;
  var outsideAU = false;

  // ---------------------------------------------------------------- answers
  function answers() {
    var a = {};
    Object.keys(seen).forEach(function (id) {
      $$("input, textarea", screens[id]).forEach(function (el) {
        if (!el.name || el.type === "file" || el.name === "website") return;
        if (el.type === "checkbox") {
          if (!el.checked) return;
          if (el.name === "newsletter_opt_in") { a[el.name] = true; return; }
          (a[el.name] = a[el.name] || []).push(el.value);
        } else if (el.type === "radio") {
          if (el.checked) a[el.name] = el.value;
        } else if (el.value.trim() !== "") {
          a[el.name] = el.value.trim();
        }
      });
    });
    return a;
  }
  function first() { var v = ($("[name=first_name]", form) || {}).value || ""; return v.trim().split(/\s+/)[0]; }

  // ---------------------------------------------------------------- display
  var LABELS = { 1: "Let's get to know you", 2: "Great start. Let's check the fit", 3: "Nearly there", 4: "All done" };
  function show(id, isBack) {
    if (!screens[id]) return;
    clearTimeout(advanceTimer);
    Object.keys(screens).forEach(function (k) { screens[k].classList.remove("is-current", "is-entering", "is-back"); });
    var s = screens[id];
    s.classList.add("is-current", isBack ? "is-back" : "is-entering");
    current = id; seen[id] = true;
    var f = first();
    $$("[data-first]", form).forEach(function (el) { el.textContent = f; });
    $$("[data-first-prefix]", form).forEach(function (el) { el.hidden = !f; });
    var step = R.stepOf(id);
    progress.hidden = (id === "intro");
    $("[data-progress-label]", form).textContent = LABELS[step];
    $("[data-progress-count]", form).textContent = "Step " + step + " of 4";
    $$("[data-step-name]", form).forEach(function (li) {
      var n = +li.getAttribute("data-step-name");
      li.classList.toggle("is-done", n < step); li.classList.toggle("is-on", n === step);
    });
    var isResult = s.classList.contains("iq--result");
    nav.hidden = (id === "intro");
    btnBack.hidden = history.length === 0 || (sent && isResult);
    btnCont.hidden = isResult;
    if (id === "MATCH" || id === "MATCH_SHORT") renderMatch(s);
    if (id === "URGENT") $("[data-urgent-phone]", s).hidden = !!String(answers().phone || "").trim();
    if (id === "DONE") renderDone();
    toggles();
    var h = $(".iq__q", s); if (h) { h.setAttribute("tabindex", "-1"); h.focus({ preventScroll: true }); }
    window.scrollTo({ top: Math.max(0, form.getBoundingClientRect().top + window.scrollY - 90), behavior: "auto" });
  }
  function go(id) { if (current) history.push(current); show(id, false); }
  function back() { if (!history.length) return; show(history.pop(), true); }

  // conditional bits inside screens (JS shows them only when they apply)
  function toggles() {
    var a = answers(), src = a.source || [], heat = a.heating || [];
    var ref = $("[data-referrer]", form); if (ref) ref.hidden = !(src.indexOf("friend") !== -1 || src.indexOf("installer") !== -1);
    var oth = $("[data-other-text]", form); if (oth) oth.hidden = heat.indexOf("other") === -1;
    var sub = $("[data-suburb-text]", form); if (sub) sub.hidden = outsideAU;
  }

  // ---------------------------------------------------------------- validation
  var PHONE_OK = function (p) { var d = String(p).replace(/[\s()-]/g, ""); return /^(\+?61|0)[2-478]\d{8}$/.test(d); };
  function err(name, on) { var e = $('[data-err="' + name + '"]', form); if (e) e.hidden = !on; return !on; }
  function valid(id) {
    var a = answers();
    if (id === "S1") {
      var ok = !!(a.first_name && a.last_name);
      $$("input", screens.S1).forEach(function (i) { i.setAttribute("aria-invalid", i.value.trim() ? "false" : "true"); });
      if (!ok) { var m = $$("input", screens.S1).filter(function (i) { return !i.value.trim(); })[0]; if (m) m.focus(); }
      return ok;
    }
    if (id === "S2") return err("email", !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(a.email || ""));
    if (id === "S3") return outsideAU || err("postcode", !/^\d{4}$/.test(a.postcode || ""));
    if (id === "S4") return !a.phone || err("phone", !PHONE_OK(a.phone));
    return true;
  }

  function nextOf(id) { return R.next(id, Object.assign(answers(), { state: stateNow() })); }
  function stateNow() { return outsideAU ? "OS" : ($("[data-state]", form).value || ""); }
  function advance() {
    if (!valid(current)) return;
    if (current === "S17") return finish("completed");
    var n = nextOf(current);
    if (n) go(n);
  }

  // ---------------------------------------------------------------- S3: postcode stub
  var pc = $("[name=postcode]", form), subText = $("[name=suburb]", form), subBox = $("[data-suburbs]", form);
  function onPostcode() {
    var v = pc.value.replace(/\D/g, "").slice(0, 4);
    if (pc.value !== v) pc.value = v;
    outsideAU = false;
    var st = R.stateFor(v);
    $("[data-state]", form).value = st;
    $("[data-remote]", form).value = REMOTE[v] ? "true" : "";
    subBox.innerHTML = '<legend class="sr-only">Suburb</legend>';
    var list = v.length === 4 ? (SUBURBS[v] || []) : [];
    subBox.hidden = list.length < 2;
    if (list.length) subText.value = list[0];
    if (list.length > 1) list.forEach(function (name, i) {
      var l = document.createElement("label"); l.className = "card-opt chip";
      l.innerHTML = '<input type="radio" name="suburb_pick"' + (i === 0 ? " checked" : "") + '><span class="card-opt__t"></span>';
      l.querySelector(".card-opt__t").textContent = name;
      l.querySelector("input").addEventListener("change", function () { subText.value = name; });
      subBox.appendChild(l);
    });
    if (v.length === 4) err("postcode", false);
  }
  pc.addEventListener("input", onPostcode);
  var outBtn = $("[data-outside-au]", form);
  if (outBtn) outBtn.addEventListener("click", function () {
    outsideAU = true; pc.value = ""; subText.value = ""; subBox.hidden = true;
    $("[data-state]", form).value = "OS"; err("postcode", false); toggles(); go(nextOf("S3"));
  });

  // ---------------------------------------------------------------- S16: uploads (PRD D3 / IF5)
  function kb(n) { return n > 1048576 ? (n / 1048576).toFixed(1) + " MB" : Math.max(1, Math.round(n / 1024)) + " KB"; }
  function resize(file) {
    // Photos to ~2,000 px on the long edge, JPEG 0.8 (SPEC S16; Sales: 2,000 px is enough).
    if (!window.createImageBitmap) return Promise.resolve(file);
    return createImageBitmap(file).then(function (bmp) {
      var scale = Math.min(1, 2000 / Math.max(bmp.width, bmp.height));
      var c = document.createElement("canvas");
      c.width = Math.round(bmp.width * scale); c.height = Math.round(bmp.height * scale);
      c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
      return new Promise(function (res) { c.toBlob(function (b) { res(b || file); }, "image/jpeg", 0.8); });
    }).catch(function () { return file; });     // e.g. HEIC a browser can't decode: send the original if small enough
  }
  $$("[data-slot]", form).forEach(function (slot) {
    var input = $("[data-file]", slot), state = $("[data-state-text]", slot), key = slot.getAttribute("data-slot");
    input.addEventListener("change", function () {
      var f = input.files && input.files[0];
      delete files[key]; state.textContent = ""; err("upload_big", false);
      if (!f) return;
      var isImg = /^image\//.test(f.type), isPdf = f.type === "application/pdf" || /\.pdf$/i.test(f.name);
      if (!isImg && !isPdf) { input.value = ""; return; }
      (isImg ? resize(f) : Promise.resolve(f)).then(function (blob) {
        if (blob.size > MAX_FILE) { input.value = ""; err("upload_big", true); return; }
        var name = isImg && blob !== f ? f.name.replace(/\.[^.]+$/, "") + ".jpg" : f.name;
        files[key] = { name: name, type: blob.type || f.type, blob: blob, size: blob.size };
        state.textContent = "✓ " + name + " · " + kb(blob.size);
      });
    });
  });
  function toBase64(blob) {
    return new Promise(function (res, rej) {
      var r = new FileReader();
      r.onload = function () { res(String(r.result).split(",")[1] || ""); };
      r.onerror = rej; r.readAsDataURL(blob);
    });
  }
  var droppedFile = false;
  function packFiles() {
    var list = Object.keys(files).map(function (k) { return { slot: k, f: files[k] }; });
    list.sort(function (x, y) { return y.f.size - x.f.size; });
    var total = list.reduce(function (t, x) { return t + x.f.size; }, 0);
    droppedFile = false;
    while (total > MAX_SET && list.length) { total -= list.shift().f.size; droppedFile = true; }  // drop the largest (PRD D3)
    return Promise.all(list.map(function (x) {
      return toBase64(x.f.blob).then(function (b64) { return { slot: x.slot, name: x.f.name, type: x.f.type, data: b64 }; });
    }));
  }

  // ---------------------------------------------------------------- match / done
  function renderMatch(s) {
    var a = Object.assign(answers(), { state: stateNow() });
    var h = a.heating || [];
    var rad = h.indexOf("boiler_radiators") !== -1 || h.indexOf("lpg_boiler") !== -1;
    var uf = h.indexOf("boiler_underfloor") !== -1;
    $$("[data-emitters]", s).forEach(function (el) { el.textContent = rad && uf ? "radiators and underfloor heating" : uf ? "underfloor heating" : rad ? "radiators" : "radiators or underfloor heating"; });
    var why = R.whyLines(a), ul = $("[data-why]", s);
    ul.innerHTML = ""; why.forEach(function (w) { var li = document.createElement("li"); li.textContent = w; ul.appendChild(li); });
    ul.hidden = !why.length;
    $$("[data-remote-line]", s).forEach(function (el) { el.hidden = $("[data-remote]", form).value !== "true"; });
    var acts = $("[data-match-actions]", s);
    if (acts) {   // ready to book: the deposit first (SPEC §4)
      var dep = $('[data-exit="deposit"]', acts), chat = $('[data-exit="book_chat"]', acts);
      var bookFirst = (a.intent === "book");
      if (bookFirst) { acts.insertBefore(dep, chat); dep.className = "btn btn--primary btn--rect"; chat.className = "btn btn--ghost-light btn--rect"; }
      else { acts.insertBefore(chat, dep); chat.className = "btn btn--primary btn--rect"; dep.className = "btn btn--ghost-light btn--rect"; }
    }
  }
  var CALL = { lunchtime: "weekdays around lunchtime", after_5: "weekdays after 5pm", weekends: "on the weekend", any: "any time" };
  function renderDone() {
    var ct = (answers().call_times || []).map(function (k) { return CALL[k]; }).filter(Boolean);
    $("[data-call-times]", form).textContent = ct.length ? " " + ct.join(" or ") : "";
    if (droppedFile && !$("[data-dropped-note]", screens.DONE)) {
      var p = $('[data-err="upload_set"]', form).cloneNode(true); p.hidden = false; p.setAttribute("data-dropped-note", "");
      screens.DONE.insertBefore(p, $(".match-actions", screens.DONE));
    }
  }

  // ---------------------------------------------------------------- the one send
  function payload(outcome) {
    var a = answers();
    a.state = stateNow();
    if (a.remote === "true") a.remote = true;
    a.form = "intake"; a.ts = stamped; a.website = ($("[name=website]", form) || {}).value || "";
    a.outcome = outcome; a.last_screen = current; a.seen = Object.keys(seen);
    a.route = R.route(a); a.path = a.intent || "fit";
    a.rung_reached = seen.DONE ? "done" : Object.keys(seen).some(function (k) { return /^S1[4-7]$/.test(k); }) ? "3"
      : Object.keys(seen).some(function (k) { return /^S(7|8|9|1[0-3])$/.test(k); }) ? "2" : "1";
    return a;
  }
  function finish(outcome, then) {
    if (sent) { if (then) then(); return Promise.resolve(); }
    sending.hidden = false; sending.textContent = "Sending…";
    return packFiles().then(function (up) {
      var body = payload(outcome); body.uploads = up;
      return fetch(ENDPOINT, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    }).then(function (r) {
      if (!r.ok) throw new Error("status " + r.status);
      sent = true; sending.hidden = true;
      if (outcome === "completed" || outcome === "urgent_call") show("DONE", false);
      if (then) then();
    }).catch(function () {
      sending.hidden = false;
      sending.innerHTML = 'Could not send. Please email us directly at <a href="mailto:nickz@thermaldawn.com">nickz@thermaldawn.com</a>.';
    });
  }

  // ---------------------------------------------------------------- events
  btnCont.addEventListener("click", advance);
  btnBack.addEventListener("click", back);
  form.addEventListener("submit", function (e) { e.preventDefault(); advance(); });
  form.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && e.target.tagName === "INPUT" && e.target.type !== "checkbox" && e.target.type !== "radio") { e.preventDefault(); advance(); }
  });
  $$("[data-go]", form).forEach(function (b) { b.addEventListener("click", function () { go(b.getAttribute("data-go")); }); });
  $$("[data-skip]", form).forEach(function (b) {
    b.addEventListener("click", function () {
      var s = b.closest("[data-screen]");
      $$("input[type=radio], input[type=checkbox]", s).forEach(function (i) { i.checked = false; });
      $$("input[type=text], input[type=tel], textarea", s).forEach(function (i) { i.value = ""; });
      go(nextOf(s.getAttribute("data-screen")));
    });
  });
  var pref = $("[data-prefer-email]", form);
  if (pref) pref.addEventListener("click", function () { $("[data-contact-pref]", form).value = "email"; $("[name=phone]", form).value = ""; go(nextOf("S4")); });
  $("[name=phone]", form).addEventListener("input", function () { $("[data-contact-pref]", form).value = this.value.trim() ? "phone" : ""; });
  form.addEventListener("change", function (e) {
    toggles();
    var s = e.target.closest("[data-screen]");
    if (s && s.hasAttribute("data-auto") && e.target.type === "radio") {   // single-select: move on after the beat
      clearTimeout(advanceTimer);
      advanceTimer = setTimeout(function () { if (current === s.getAttribute("data-screen")) advance(); }, BEAT_MS);
    }
  });
  $$("[data-exit]", form).forEach(function (b) {
    b.addEventListener("click", function (e) {
      var kind = b.getAttribute("data-exit");
      if (kind === "deposit") { e.preventDefault(); finish("deposit", function () { location.href = b.href; }); return; }
      if (kind === "keep_posted") { finish("keep_posted", function () { show("POSTED", false); }); return; }
      if (kind === "no_thanks") {
        finish("no_thanks", function () {
          var acts = $("[data-close-actions]", screens[current]); if (acts) acts.hidden = true;
          var p = document.createElement("p"); p.className = "close-body"; p.textContent = "Thanks for thinking of us."; screens[current].appendChild(p);
        }); return;
      }
      if (kind === "urgent_call") {
        var box = $("[data-urgent-phone]", screens.URGENT);
        if (!box.hidden) {
          var v = $("[data-urgent-phone-input]", box).value.trim();
          if (!err("urgent_phone", !PHONE_OK(v))) return;
          $("[name=phone]", form).value = v; seen.S4 = true;
        }
        finish("urgent_call"); return;
      }
      // book_chat, urgent_book, n1_chat: the link opens Calendly in a new tab; send in the background
      finish(kind);
    });
  });
  var share = $("[data-landlord-share]", form);
  if (share) share.addEventListener("click", function () {
    var box = $("[data-landlord]", form);
    if (box.hidden) { box.hidden = false; seen.R1 = true; $("input", box).focus(); return; }
    finish("landlord_share", function () {
      $("[data-close-actions]", screens.R1).hidden = true; box.hidden = true;
      var p = document.createElement("p"); p.className = "close-body"; p.textContent = "Thanks for thinking of us."; screens.R1.appendChild(p);
    });
  });

  form.classList.add("is-stepped");
  show("intro", false);
})();
