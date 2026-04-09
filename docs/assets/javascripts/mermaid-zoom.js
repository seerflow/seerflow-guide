// Click-to-zoom for Mermaid diagrams
document.addEventListener("click", function (e) {
  var svg = e.target.closest(".mermaid svg");
  if (svg) {
    svg.classList.toggle("zoomed");
  }
});
