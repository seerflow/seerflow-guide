// Fullscreen modal for Mermaid diagrams
// Uses MutationObserver to catch SVGs rendered by MkDocs Material's Mermaid
var mermaidModal = document.createElement("div");
mermaidModal.id = "mermaid-modal";
mermaidModal.setAttribute("style",
  "display:none;position:fixed;top:0;left:0;width:100vw;height:100vh;" +
  "background:rgba(0,0,0,0.85);z-index:9999;cursor:zoom-out;" +
  "overflow:auto;padding:2rem;box-sizing:border-box"
);
document.body.appendChild(mermaidModal);

mermaidModal.onclick = function () {
  mermaidModal.style.display = "none";
  mermaidModal.innerHTML = "";
};

document.onkeydown = function (e) {
  if (e.key === "Escape" && mermaidModal.style.display === "block") {
    mermaidModal.style.display = "none";
    mermaidModal.innerHTML = "";
  }
};

function attachZoom(svg) {
  if (svg.dataset.zoomAttached) return;
  svg.dataset.zoomAttached = "1";
  svg.style.cursor = "zoom-in";
  svg.addEventListener("click", function (e) {
    e.preventDefault();
    e.stopPropagation();
    var clone = svg.cloneNode(true);
    clone.removeAttribute("width");
    clone.removeAttribute("height");
    clone.removeAttribute("style");
    clone.style.cssText =
      "max-width:95vw;max-height:90vh;margin:auto;display:block;" +
      "background:#fff;border-radius:12px;padding:1.5rem;" +
      "box-shadow:0 4px 24px rgba(0,0,0,0.3);width:100%";
    var vb = svg.getAttribute("viewBox");
    if (!vb) {
      var w = svg.getAttribute("width") || svg.clientWidth;
      var h = svg.getAttribute("height") || svg.clientHeight;
      if (w && h) clone.setAttribute("viewBox", "0 0 " + w + " " + h);
    }
    var wrap = document.createElement("div");
    wrap.style.cssText =
      "display:flex;align-items:center;justify-content:center;min-height:100%";
    wrap.appendChild(clone);
    mermaidModal.innerHTML = "";
    mermaidModal.appendChild(wrap);
    mermaidModal.style.display = "block";
  });
}

// Attach to any SVGs that already exist
document.querySelectorAll("pre.mermaid svg, .mermaid svg").forEach(attachZoom);

// Watch for Mermaid rendering SVGs after page load
var observer = new MutationObserver(function (mutations) {
  mutations.forEach(function (m) {
    m.addedNodes.forEach(function (node) {
      if (node.nodeName === "svg") {
        var parent = node.parentElement;
        if (parent && (parent.classList.contains("mermaid") || parent.tagName === "PRE")) {
          attachZoom(node);
        }
      }
      if (node.querySelectorAll) {
        node.querySelectorAll("pre.mermaid svg, .mermaid svg").forEach(attachZoom);
      }
    });
  });
});
observer.observe(document.body, { childList: true, subtree: true });
