// Fullscreen modal for Mermaid diagrams
// Works with MkDocs Material instant loading — no DOMContentLoaded dependency
(function () {
  // Create overlay (idempotent — check if already exists for SPA re-runs)
  if (document.getElementById("mermaid-modal")) return;

  var overlay = document.createElement("div");
  overlay.id = "mermaid-modal";
  overlay.style.cssText =
    "display:none;position:fixed;top:0;left:0;width:100vw;height:100vh;" +
    "background:rgba(0,0,0,0.85);z-index:9999;cursor:zoom-out;" +
    "overflow:auto;padding:2rem;box-sizing:border-box;";
  document.body.appendChild(overlay);

  function closeModal() {
    overlay.style.display = "none";
    overlay.innerHTML = "";
  }

  overlay.addEventListener("click", closeModal);
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") closeModal();
  });

  document.addEventListener(
    "click",
    function (e) {
      if (overlay.style.display === "block") return;

      var mermaidEl = e.target.closest("pre.mermaid, .mermaid");
      if (!mermaidEl) return;
      var svg = mermaidEl.querySelector("svg");
      if (!svg) return;

      var clone = svg.cloneNode(true);
      clone.removeAttribute("width");
      clone.removeAttribute("height");
      clone.removeAttribute("style");
      clone.style.cssText =
        "max-width:95vw;max-height:90vh;margin:auto;display:block;" +
        "background:#fff;border-radius:12px;padding:1.5rem;" +
        "box-shadow:0 4px 24px rgba(0,0,0,0.3);";

      if (!clone.getAttribute("viewBox") && svg.getBBox) {
        try {
          var bb = svg.getBBox();
          if (bb.width > 0) {
            clone.setAttribute(
              "viewBox",
              bb.x + " " + bb.y + " " + bb.width + " " + bb.height
            );
          }
        } catch (_) {}
      }

      var wrapper = document.createElement("div");
      wrapper.style.cssText =
        "display:flex;align-items:center;justify-content:center;min-height:100%;";
      wrapper.appendChild(clone);

      overlay.innerHTML = "";
      overlay.appendChild(wrapper);
      overlay.style.display = "block";
    },
    true
  );
})();
