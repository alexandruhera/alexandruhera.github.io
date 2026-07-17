// Resume page interactions. External file, CSP-safe (served from same origin).
(function () {
  // The timeline trail is now pure CSS (single-segment hover fill in
  // resume.astro). This file only wires the Print button.
  var btn = document.getElementById("print-btn");
  if (btn) btn.addEventListener("click", function () { window.print(); });
})();
