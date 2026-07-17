// Reveal-on-scroll (DEVPLAN D13). Hidden state only applies once this runs
// (html.js-reveal), so content stays visible without JS.
(function () {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  var els = document.querySelectorAll("[data-reveal]");
  if (!els.length || !("IntersectionObserver" in window)) return;
  document.documentElement.classList.add("js-reveal");
  var io = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          e.target.classList.add("in-view");
          io.unobserve(e.target);
        }
      });
    },
    { rootMargin: "0px 0px -10% 0px" }
  );
  els.forEach(function (el) {
    io.observe(el);
  });
})();
