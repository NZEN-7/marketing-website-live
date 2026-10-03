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
  var FLOOR_MS = 3500;                     // the server screens anything under 3 s from page load (GPT Web I-S3)
  var BEAT_MS = 280;                       // SPEC rule 13: the beat before auto-advance
  var MAX_FILE = 4 * 1024 * 1024;          // SPEC §2: a single file over 4 MB is "a bit big"
  var MAX_SET = 3.2 * 1024 * 1024;         // raw bytes; base64 + JSON must stay under Vercel's 4.5 MB
  var stamped = Date.now();
  // One lead ID per visit (Sales review, 1): a repeat of the same send is
  // recognised by the server and not sent twice.
  var LEAD_ID = "il-" + Array.prototype.map.call((window.crypto || window.msCrypto).getRandomValues(new Uint8Array(5)),
    function (b) { return ("0" + b.toString(16)).slice(-2); }).join("");

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
  var busy = null, sentOutcome = "", detailsSent = false, urgentPhoneAdded = false;
  var outsideAU = false;

  // ---------------------------------------------------------------- answers
  function answers() {
    var a = {};
    Object.keys(seen).forEach(function (id) {
      $$("input, textarea", screens[id] || $('[data-question="' + id + '"]', form)).forEach(function (el) {
        var question=el.closest("[data-question]"); if (question && question.getAttribute("data-question") !== id) return;
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
  var counted = {};
  function countQuestions(s) {
    var ids = [s.getAttribute("data-screen")].concat($$("[data-question]",s).filter(function(q){return !q.hidden;}).map(function(q){return q.getAttribute("data-question");}));
    ids = ids.filter(function(id){return /^(S(?:[1-8]|4b|1[0-7])|MATCH|MATCH_SHORT|URGENT|DONE|O1|N1)$/.test(id) && !counted[id];});
    ids.forEach(function(id){counted[id]=true;});
    if (ids.length && navigator.sendBeacon) {
      try { navigator.sendBeacon("/api/intake-view", JSON.stringify({ q: ids })); }
      catch (_) { /* Counting must never interrupt the form. */ }
    }
  }
  function first() { var v = ($("[name=first_name]", form) || {}).value || ""; return v.trim().split(/\s+/)[0]; }

  // ---------------------------------------------------------------- display
  function show(id, isBack) {
    if (!screens[id]) return;
    clearTimeout(advanceTimer);
    Object.keys(screens).forEach(function (k) { screens[k].hidden = true; screens[k].classList.remove("is-current", "is-entering", "is-back"); });
    var s = screens[id];
    s.classList.add("is-current", isBack ? "is-back" : "is-entering");
    s.hidden = false;
    current = id; seen[id] = true;
    $$("[data-question]", s).forEach(function (q) { if (!q.hasAttribute("data-boiler-part")) seen[q.getAttribute("data-question")] = true; });
    // Reaching the match (or the short match, or the urgent screen) submits the
    // enquiry: the row, Nick's notification and the one first email (Nick, 3 Oct,
    // CTO item 68.1). Once per lead: Back, coming back here or a later exit never
    // re-sends; the exits then just do their job.
    if (/^(MATCH|MATCH_SHORT|URGENT)$/.test(id) && !sent && !busy) finish("matched");

    var f = first();
    $$("[data-first]", form).forEach(function (el) { el.textContent = f; });
    $$("[data-first-prefix]", form).forEach(function (el) { el.hidden = !f; });
    var step = R.stepOf(id);
    progress.hidden = (id === "intro");
    $("[data-progress-count]", form).textContent = "Step " + Math.min(step, 3) + " of 3: " + ["About you", "Your home", "The details"][Math.min(step,3)-1];
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
    countQuestions(s);
    var h = $(".iq__q", s); if (h) { h.setAttribute("tabindex", "-1"); h.focus({ preventScroll: true }); }
    window.scrollTo({ top: Math.max(0, $(".intake-layout").getBoundingClientRect().top + window.scrollY - 90), behavior: "auto" });
  }
  function go(id) { if (current) history.push(current); show(id, false); }
  function back() { if (!history.length) return; show(history.pop(), true); }

  // conditional bits inside screens (JS shows them only when they apply)
  function toggles() {
    var a = answers(), src = a.source || [], heat = a.heating || [];
    var ref = $("[data-referrer]", form); if (ref) ref.hidden = !(src.indexOf("friend") !== -1 || src.indexOf("installer") !== -1);
    var oth = $("[data-other-text]", form); if (oth) oth.hidden = heat.indexOf("other") === -1;
    var sub = $("[data-suburb-text]", form); if (sub) sub.hidden = outsideAU;
    // S14 (Nick, 30 Sep): radiators for radiator homes, underfloor area for
    // underfloor homes, both for both or LPG; radiators when we don't know.
    var rad = heat.indexOf("boiler_radiators") !== -1, uf = heat.indexOf("boiler_underfloor") !== -1, lpg = heat.indexOf("lpg_boiler") !== -1;
    var showUf = uf || lpg, showRad = rad || lpg || !uf;
    var radRow = $("[data-rad-row]", form), ufRow = $("[data-uf-row]", form), ufChip = $("[data-uf-only-chip]", form);
    if (radRow) radRow.hidden = !showRad;
    if (ufRow) ufRow.hidden = !showUf;
    // "Underfloor only" only when we don't know the emitters (Sales review, 7)
    if (ufChip) ufChip.hidden = rad || uf || lpg;
    var boiler = R.hasBoiler(a);
    var part = $("[data-boiler-part]", form);
    if (part) {
      var visible = boiler && (!a.intent || a.intent === "fit");
      var changed = part.hidden === visible; part.hidden = !visible;
      if (visible) { seen.S8 = true; if (changed) { $("[data-boiler-announcement]", form).textContent = "Two questions about your boiler have appeared below."; if (current === "S7") countQuestions(screens.S7); } }
      else { $$("input",part).forEach(function(i){i.checked=false;}); delete seen.S8; $("[data-boiler-announcement]", form).textContent = ""; }
    }
    [[radRow, showRad], [ufRow, showUf]].forEach(function (x) { if (x[0] && !x[1]) $$("input", x[0]).forEach(function (i) { i.checked = false; }); });
  }

  // ---------------------------------------------------------------- validation
  var EMAIL_OK = function (e) { return /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)*\.[^\s@.]{2,}$/.test(String(e).trim()); };
  var PHONE_OK = function (p) { var d = String(p).replace(/[\s()-]/g, ""); return /^(\+?61|0)[2-478]\d{8}$/.test(d); };
  // An error is announced when it appears (role=alert) and tied to its field
  // (aria-invalid + aria-describedby), so a screen reader hears it (a11y pass, 2 Oct).
  var ERR_FIELD = { email: "[name=email]", postcode: "[name=postcode]", phone: "[name=phone]", phone_empty: "[name=phone]",
    urgent_phone: "[data-urgent-phone-input]" };
  function err(name, on) {
    var e = $('[data-err="' + name + '"]', form);
    if (e) {
      if (!e.id) e.id = "err-" + name;
      e.setAttribute("role", "alert");
      e.hidden = !on;
      var f = ERR_FIELD[name] && $(ERR_FIELD[name], form);
      if (f) {
        var ids = (f.getAttribute("aria-describedby") || "").split(/\s+/).filter(function (x) { return x && x !== e.id; });
        if (on) ids.push(e.id);
        if (ids.length) f.setAttribute("aria-describedby", ids.join(" ")); else f.removeAttribute("aria-describedby");
        var anyOn = ids.some(function (id) { var x = document.getElementById(id); return x && !x.hidden; });
        if (anyOn) f.setAttribute("aria-invalid", "true"); else f.removeAttribute("aria-invalid");
      }
    }
    return !on;
  }
  function valid(id) {
    var a = answers();
    if (id === "S1") {
      var missing = [], summary = $(".iq__summary",screens.S1);
      var names = [$("[name=first_name]",form),$("[name=last_name]",form)];
      names.forEach(function(f){if(!f.id)f.id="contact-"+f.name;});
      var nameBad=names.some(function(f){return !f.value.trim();});
      if(nameBad)missing.push({field:names.filter(function(f){return !f.value.trim();})[0],text:"Add your name."});
      var email=$("[name=email]",form);if(!email.id)email.id="contact-email";
      if(!EMAIL_OK(email.value))missing.push({field:email,text:"Check your email address."});
      names.concat([email]).forEach(function(f){var bad=f===email?!EMAIL_OK(f.value):!f.value.trim();if(bad){f.setAttribute("aria-invalid","true");f.setAttribute("aria-describedby",summary.id);}else{f.removeAttribute("aria-invalid");f.removeAttribute("aria-describedby");}});
      summary.replaceChildren();missing.forEach(function(item){var link=document.createElement("a");link.href="#"+item.field.id;link.textContent=item.text;link.addEventListener("click",function(e){e.preventDefault();item.field.focus();});summary.appendChild(link);});summary.hidden=!missing.length;
      if(missing.length){summary.setAttribute("tabindex","-1");summary.focus();}return !missing.length;
    }
    if (id === "S3") return outsideAU || err("postcode", !/^\d{4}$/.test(a.postcode || ""));
    if (id === "S4") {   // no Skip here (Nick): a number, or "I'd prefer email"
      err("phone_empty", false); err("phone", false);
      if (!a.phone && a.contact_pref !== "email") { err("phone_empty", true); $("[name=phone]", form).focus(); return false; }
      return !a.phone || err("phone", !PHONE_OK(a.phone));
    }
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
  // Each slot is a drop card: drag a file on, or tap to choose (Nick, 30 Sep).
  // A photo shows a thumbnail; Remove clears the slot.
  $$("[data-slot]", form).forEach(function (slot) {
    var input = $("[data-file]", slot), drop = $("[data-drop]", slot), done = $("[data-done]", slot);
    var state = $("[data-state-text]", slot), thumb = $("[data-thumb]", slot), key = slot.getAttribute("data-slot");
    var later = $("[name=send_later]", slot);
    function clear() {
      delete files[key]; input.value = ""; state.textContent = "";
      if (thumb.src) { URL.revokeObjectURL(thumb.src); thumb.removeAttribute("src"); }
      thumb.hidden = true; done.hidden = true; drop.hidden = false;
    }
    function take(f) {
      clear(); err("upload_big", false);
      if (!f) return;
      var isImg = /^image\//.test(f.type) || /\.(heic|heif)$/i.test(f.name), isPdf = f.type === "application/pdf" || /\.pdf$/i.test(f.name);
      var okHere = isPdf ? /pdf/.test(input.accept) : isImg;
      if (!okHere) { state.textContent = ""; err("upload_big", false); return; }
      drop.classList.add("is-busy");
      (isImg ? resize(f) : Promise.resolve(f)).then(function (blob) {
        drop.classList.remove("is-busy");
        if (blob.size > MAX_FILE) { err("upload_big", true); return; }
        var name = isImg && blob !== f ? f.name.replace(/\.[^.]+$/, "") + ".jpg" : f.name;
        files[key] = { name: name, type: blob.type || f.type, blob: blob, size: blob.size };
        state.textContent = "";
        var nm = document.createElement("span"); nm.className = "drop__name"; nm.textContent = name;
        var sz = document.createElement("span"); sz.className = "drop__size"; sz.textContent = kb(blob.size);
        state.appendChild(nm); state.appendChild(sz);
        if (/^image\/(jpeg|png|webp)/.test(blob.type)) { thumb.src = URL.createObjectURL(blob); thumb.hidden = false; }
        drop.hidden = true; done.hidden = false;
        if (later) later.checked = false;
        var n = $(".upslot__note", slot); if (n) n.hidden = true;
      });
    }
    input.addEventListener("change", function () { take(input.files && input.files[0]); });
    ["dragenter", "dragover"].forEach(function (ev) {
      drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add("is-over"); });
    });
    ["dragleave", "dragend"].forEach(function (ev) {
      drop.addEventListener(ev, function () { drop.classList.remove("is-over"); });
    });
    drop.addEventListener("drop", function (e) {
      e.preventDefault(); drop.classList.remove("is-over");
      take(e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]);
    });
    $("[data-remove]", slot).addEventListener("click", function () { clear(); drop.querySelector("input").focus(); });
    var note = document.createElement("p"); note.className = "upslot__note"; note.hidden = true;
    note.textContent = "No problem, you can send it later.";
    slot.insertBefore(note, later.closest("label"));
    if (later) later.addEventListener("change", function () {
      if (later.checked && files[key]) clear();
      drop.hidden = later.checked || !!files[key]; note.hidden = !later.checked;
    });
  });
  // A file dropped outside a card must not replace the page.
  ["dragover", "drop"].forEach(function (ev) { window.addEventListener(ev, function (e) { if (!e.target.closest || !e.target.closest("[data-drop]")) e.preventDefault(); }); });
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
    // No boiler picked ("Not sure", "No heating yet"): the careful version (Sales review, 4)
    var check = R.unconfirmed(a);
    $$("[data-fit-sure]", s).forEach(function (el) { el.hidden = check; });
    $$("[data-fit-check]", s).forEach(function (el) { el.hidden = !check; });
    $$("[data-emitters]", s).forEach(function (el) { el.textContent = R.emitters(a); });
    var why = R.whyLines(a), ul = $("[data-why]", s);
    ul.innerHTML = ""; why.forEach(function (w) { var li = document.createElement("li"); li.textContent = w; ul.appendChild(li); });
    ul.hidden = !why.length;
    $$("[data-remote-line]", s).forEach(function (el) { el.hidden = $("[data-remote]", form).value !== "true"; });
    var acts = $("[data-match-actions]", s);
    if (acts) {   // "Help us prepare" leads (Nick, 30 Sep); on ready to book the deposit comes next, before the chat
      var dep = $('[data-exit="deposit"]', acts), chat = $('[data-exit="book_chat"]', acts);
      if (a.intent === "book") acts.insertBefore(dep, chat); else acts.insertBefore(chat, dep);
    }
  }
  // "(you said weekdays around lunchtime or after 5pm)" (Sales review, 14)
  function callPhrase(keys) {
    if (keys.indexOf("any") !== -1) return "any time";
    var lunch = keys.indexOf("lunchtime") !== -1, out = [];
    if (lunch) out.push("weekdays around lunchtime");
    if (keys.indexOf("after_5") !== -1) out.push(lunch ? "after 5pm" : "weekdays after 5pm");
    if (keys.indexOf("weekends") !== -1) out.push("weekends");
    return out.length < 2 ? (out[0] || "") : out.slice(0, -1).join(", ") + " or " + out[out.length - 1];
  }
  function renderDone() {
    var a = Object.assign(answers(), { state: stateNow() });
    var urgent = R.route(a) === "urgent", byEmail = !urgent && !a.phone && a.contact_pref === "email";
    var ct = callPhrase(a.call_times || []);
    $("[data-call-times]", form).textContent = ct ? " (you said " + ct + ")" : "";
    $("[data-done-call]", form).hidden = urgent || byEmail;       // only promise what happens (Sales review, 2, 3)
    $("[data-done-email]", form).hidden = !byEmail;
    $("[data-done-urgent]", form).hidden = !urgent;
    // Urgent: the details are most useful here, so offer them, once (Sales review, 3)
    var prep = urgent && !detailsSent;
    $("[data-done-prepare]", form).hidden = !prep;
    $("[data-done-book]", form).className = "btn btn--rect " + (prep ? "btn--ghost-light" : "btn--primary");
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
    a.form = "intake"; a.ts = stamped; a.lead_id = LEAD_ID; a.website = ($("[name=website]", form) || {}).value || "";
    a.outcome = outcome; a.last_screen = current; a.seen = Object.keys(seen);
    a.route = R.route(a); a.path = a.intent || "fit";
    a.rung_reached = seen.DONE ? "done" : Object.keys(seen).some(function (k) { return /^S1[4-7]$/.test(k); }) ? "3"
      : Object.keys(seen).some(function (k) { return /^S(7|8|9|1[0-3])$/.test(k); }) ? "2" : "1";
    return a;
  }
  // Every control that sends, locked while a send is out (Sales review, 1)
  function lock(on) {
    [btnCont, btnBack].concat($$("button[data-exit], button[data-go]", form))
      .forEach(function (b) { b.disabled = on; });
    form.classList.toggle("is-sending", on);
  }
  function finish(outcome, then) {
    // A tap while a send is out runs after it (a second tap of the same exit then
    // finds it sent; Step 3 finishing during the background match send still goes)
    if (busy) { var after = function () { return finish(outcome, then); }; return busy.then(after, after); }
    // The details from "Help us prepare" go as a second send when an earlier
    // exit already sent (urgent, or a chat booked from the match)
    // A phone number given on the urgent screen after the send goes the same way,
    // so Nick gets it.
    var details = sent && !detailsSent && ((outcome === "completed" && sentOutcome !== "completed") || (outcome === "urgent_call" && urgentPhoneAdded));
    if (sent && !details) { if (outcome === "completed" || outcome === "urgent_call") show("DONE", false); if (then) then(); return Promise.resolve(); }
    // The send on reaching the match runs in the background: nothing is locked
    // and nothing is shown unless it fails (an exit tapped meanwhile waits for it).
    var quiet = outcome === "matched";
    if (!quiet) { lock(true); sending.hidden = false; sending.textContent = "Sending…"; }
    // Delivered means the server said `sent: true` (GPT Web I-S3): a bot
    // screen answers a bare { ok: true }, so that counts as not sent and is
    // tried once more. The first try waits out the 3 s floor, so a quick,
    // honest person is never screened.
    function post(body) {
      var wait = Math.max(0, stamped + FLOOR_MS - Date.now());
      return new Promise(function (r) { setTimeout(r, wait); }).then(function () {
        return fetch(ENDPOINT, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      }).then(function (r) {
        if (!r.ok) throw new Error("status " + r.status);
        return r.json().catch(function () { return {}; });
      }).then(function (j) { if (!j || j.sent !== true) throw new Error("not sent"); });
    }
    busy = packFiles().then(function (up) {
      var body = payload(outcome); body.uploads = up; body.followup = details;   // details: no second customer email
      return post(body).catch(function () {
        return new Promise(function (r) { setTimeout(r, 1500); }).then(function () { return post(body); });
      });
    }).then(function () {
      sent = true; if (!quiet) sending.hidden = true;
      if (details) detailsSent = true; else sentOutcome = outcome;
      busy = null; if (!quiet) lock(false);
      if (outcome === "completed" || outcome === "urgent_call") show("DONE", false);
      if (then) then();
    }).catch(function () {
      busy = null; lock(false);
      sending.hidden = false;
      sending.innerHTML = 'Could not send. Please email us directly at <a href="mailto:nickz@thermaldawn.com">nickz@thermaldawn.com</a>.';
    });
    return busy;
  }

  // ---------------------------------------------------------------- events
  btnCont.addEventListener("click", advance);
  btnBack.addEventListener("click", back);
  form.addEventListener("submit", function (e) { e.preventDefault(); advance(); });
  // Keyboard on single-select screens (a11y pass, 2 Oct): the arrow keys move
  // the choice without moving on, so every option can be reached; Space or
  // Enter (or Continue) confirms. A tap or click still moves on after the beat.
  var kbPick = false;
  form.addEventListener("keydown", function (e) {
    var t = e.target;
    // Grouped screens: Enter on a choice never moves on (Continue only, CTO a11y 1),
    // but Enter in a text field still means Continue, as on every other screen.
    if (e.key === "Enter" && (t.type === "radio" || t.type === "checkbox") && t.closest("[data-grouped]")) { e.preventDefault(); return; }
    var auto = t.type === "radio" && t.closest("[data-auto]");
    if (auto && /^(Arrow(Up|Down|Left|Right)|Home|End)$/.test(e.key)) { kbPick = true; clearTimeout(advanceTimer); return; }
    if (auto && e.key === " " && t.checked) { e.preventDefault(); clearTimeout(advanceTimer); advance(); return; }
    if (auto && e.key === "Enter") { e.preventDefault(); clearTimeout(advanceTimer); advance(); return; }   // same as Continue
    if (e.key === "Enter" && t.tagName === "INPUT" && t.type !== "checkbox" && t.type !== "radio") { e.preventDefault(); advance(); }
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
  $("[name=phone]", form).addEventListener("input", function () { $("[data-contact-pref]", form).value = this.value.trim() ? "phone" : ""; err("phone_empty", false); });
  $("[name=email]", form).addEventListener("input", function () { if (EMAIL_OK(this.value)) this.removeAttribute("aria-invalid"); });
  form.addEventListener("change", function (e) {
    toggles();
    var s = e.target.closest("[data-screen]");
    if (s && s.hasAttribute("data-auto") && e.target.type === "radio") {   // single-select: move on after the beat
      clearTimeout(advanceTimer);
      if (kbPick) { kbPick = false; return; }                               // an arrow key moved the choice: wait for Enter or Space
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
          $("[name=phone]", form).value = v; $("[data-contact-pref]", form).value = "phone"; seen.S4 = true;
          urgentPhoneAdded = true;
        }
        finish("urgent_call"); return;
      }
      // book_chat, urgent_book, n1_chat: the link opens Calendly in a new tab; send in the background
      finish(kind);
    });
  });
  form.classList.add("is-stepped");
  show("intro", false);
})();
