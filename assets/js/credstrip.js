/* Home credibility strip on a phone (Web 3, W3-01).
   Each row loops slowly sideways. A finger can grab a row and drag it either way;
   letting go resumes the loop from where it was left. A tap on a logo still follows
   its link; a drag never does. Desktop stays static (the rows don't move there),
   and prefers-reduced-motion keeps the CSS swipe row with no script at all.

   The loop: each row holds its logo set twice (the copy is aria-hidden), so moving
   the track by one set's width lands it exactly where it started. */
(function () {
  "use strict";
  var phone = window.matchMedia("(max-width: 759px)");
  var still = window.matchMedia("(prefers-reduced-motion: reduce)");
  if (still.matches) return;

  var SECONDS = [32, 40];   // one full set, per row: slow and steady
  var DRAG_PX = 6;          // movement before a touch counts as a drag, not a tap

  [].slice.call(document.querySelectorAll(".credrow__logos")).forEach(function (box, i) {
    var track = box.querySelector(".credrow__track");
    var set = box.querySelector(".credrow__set");
    if (!track || !set) return;

    var secs = SECONDS[i] || SECONDS[SECONDS.length - 1];
    var x = 0;                 // how far the row has moved, 0 to one set's width
    var last = null;
    var down = null;           // {id, startX, startOffset} while a pointer is down
    var dragged = false;
    var hovering = false;

    box.classList.add("is-js");

    function setWidth() { return set.getBoundingClientRect().width; }

    function frame(t) {
      if (!phone.matches) {
        track.style.transform = "";
        last = null;
        requestAnimationFrame(frame);
        return;
      }
      var w = setWidth();
      if (w > 0) {
        var paused = down || hovering || box.contains(document.activeElement);
        if (last !== null && !paused) x += ((t - last) / 1000) * (w / secs);
        x = ((x % w) + w) % w;
        track.style.transform = "translateX(" + (-x) + "px)";
      }
      last = t;
      requestAnimationFrame(frame);
    }

    box.addEventListener("pointerdown", function (e) {
      if (!phone.matches || (e.pointerType === "mouse" && e.button !== 0)) return;
      down = { id: e.pointerId, startX: e.clientX, startOffset: x };
      dragged = false;
    });

    box.addEventListener("pointermove", function (e) {
      if (!down || e.pointerId !== down.id) return;
      var dx = e.clientX - down.startX;
      if (!dragged && Math.abs(dx) > DRAG_PX) {
        dragged = true;
        try { box.setPointerCapture(e.pointerId); } catch (err) { /* older browsers */ }
      }
      if (dragged) x = down.startOffset - dx;
    });

    function release(e) {
      if (down && e.pointerId === down.id) down = null;
    }
    box.addEventListener("pointerup", release);
    box.addEventListener("pointercancel", release);

    // A drag must not open the logo it ended on.
    box.addEventListener("click", function (e) {
      if (dragged) { e.preventDefault(); e.stopPropagation(); dragged = false; }
    }, true);

    // Stop the browser's own image drag on a mouse.
    box.addEventListener("dragstart", function (e) { e.preventDefault(); });

    box.addEventListener("pointerenter", function (e) { if (e.pointerType === "mouse") hovering = true; });
    box.addEventListener("pointerleave", function () { hovering = false; });

    requestAnimationFrame(frame);
  });
})();
