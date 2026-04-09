// Fullscreen modal for Mermaid diagrams — click to open, click/Esc to close
(function () {
  var overlay = document.createElement("div");
  overlay.id = "mermaid-modal";
  overlay.style.cssText =
    "display:none;position:fixed;top:0;left:0;width:100vw;height:100vh;" +
    "background:rgba(0,0,0,0.85);z-index:9999;cursor:zoom-out;" +
    "overflow:auto;padding:2rem;box-sizing:border-box;";
  document.body.appendChild(overlay);

  overlay.addEventListener("click", function () {
    overlay.style.display = "none";
    overlay.innerHTML = "";
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && overlay.style.display !== "none") {
      overlay.style.display = "none";
      overlay.innerHTML = "";
    }
  });

  document.addEventListener("click", function (e) {
    var mermaidEl = e.target.closest(".mermaid");
    if (!mermaidEl) return;
    var svg = mermaidEl.querySelector("svg");
    if (!svg) return;

    e.stopPropagation();
    var clone = svg.cloneNode(true);
    clone.style.cssText =
      "max-width:95vw;max-height:90vh;margin:auto;display:block;" +
      "background:#fff;border-radius:8px;padding:1rem;";
    clone.removeAttribute("width");
    clone.removeAttribute("height");
    clone.setAttribute("width", "100%");

    var wrapper = document.createElement("div");
    wrapper.style.cssText =
      "display:flex;align-items:center;justify-content:center;" +
      "min-height:100%;";
    wrapper.appendChild(clone);

    overlay.innerHTML = "";
    overlay.appendChild(wrapper);
    overlay.style.display = "block";
  });
})();
