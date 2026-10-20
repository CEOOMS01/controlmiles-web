/* CMFleet enrollment embed (2026-10-20). A driving school pastes:
 *   <iframe data-cm-book src="https://controlmiles.com/book/<slug>?embed=1" ...></iframe>
 *   <script src="https://controlmiles.com/cm-book.js" async></script>
 * and the frame grows to fit the form. It only listens for a height from
 * its own CMFleet frames; it reads nothing from the host page. */
(function () {
  var ORIGIN = "https://controlmiles.com";
  try {
    var me = document.currentScript && new URL(document.currentScript.src);
    if (me) ORIGIN = me.origin;
  } catch (e) {}
  window.addEventListener("message", function (event) {
    if (event.origin !== ORIGIN || !event.data || event.data.type !== "cm-book-height") return;
    var h = Number(event.data.height);
    if (!isFinite(h) || h < 200 || h > 6000) return;
    var frames = document.querySelectorAll("iframe[data-cm-book]");
    for (var i = 0; i < frames.length; i++) {
      if (frames[i].contentWindow === event.source) frames[i].style.height = Math.ceil(h) + "px";
    }
  });
})();
