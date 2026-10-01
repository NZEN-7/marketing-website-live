/* Click-to-load YouTube (CTO Re #41.1; the privacy page says videos "only
 * load when you press play").
 *
 * Each video starts as a plain button inside .video: a poster drawn in CSS,
 * with no image or request to YouTube or Google. Pressing it swaps in the
 * youtube-nocookie player, which starts playing. Until then nothing from
 * YouTube loads, so a visitor's IP only reaches Google if they choose to watch.
 * Without JavaScript, the <noscript> link next to the button opens the video
 * on YouTube instead.
 */
(function () {
  "use strict";
  var ALLOW = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
  function play(btn) {
    var id = btn.getAttribute("data-yt");
    if (!/^[A-Za-z0-9_-]{11}$/.test(id || "")) return;
    var f = document.createElement("iframe");
    f.src = "https://www.youtube-nocookie.com/embed/" + id + "?autoplay=1&rel=0";
    f.title = btn.getAttribute("data-title") || "Video";
    f.setAttribute("allow", ALLOW);
    f.setAttribute("referrerpolicy", "strict-origin-when-cross-origin");
    f.setAttribute("allowfullscreen", "");
    btn.parentNode.replaceChild(f, btn);
    f.focus();
  }
  document.addEventListener("click", function (e) {
    var btn = e.target.closest && e.target.closest("button[data-yt]");
    if (btn) { e.preventDefault(); play(btn); }
  });
})();
