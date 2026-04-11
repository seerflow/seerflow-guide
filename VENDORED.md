# Vendored JavaScript Libraries

The Seerflow Guide vendors its JavaScript dependencies to support air-gapped / offline rendering (no runtime CDN lookups beyond MathJax).

## D3.js v7.9.0

- Upstream: https://cdn.jsdelivr.net/npm/d3@7.9.0/dist/d3.min.js
- License: ISC
- Consumed by:
  - `docs/assets/javascripts/viz/entity-graph.js` (loaded globally via `mkdocs.yml` `extra_javascript`, so any D3-using component can reuse the same global).
  - `docs/entity-graph/assets/entity-graph-explorer.html` (standalone iframe embedded in `docs/entity-graph/algorithms.md`; loads D3 directly via relative `<script src="../../assets/javascripts/d3.v7.min.js" integrity="sha384-...">`. Both the `src` path and the `integrity` SRI hash must be updated in lock-step whenever this file is re-vendored.)
- SHA256: f2094bbf6141b359722c4fe454eb6c4b0f0e42cc10cc7af921fc158fceb86539
- SRI (sha384, base64): `CjloA8y00+1SDAUkjs099PVfnY2KmDC2BZnws9kh8D/lX1s46w6EPhpXdqMfjK6i`

## Plotly.js cartesian 2.35.2

- Upstream: https://cdn.jsdelivr.net/npm/plotly.js-cartesian-dist-min@2.35.2/plotly-cartesian.min.js
- License: MIT
- Consumed by: `docs/assets/javascripts/viz/plotly-charts.js` (added in a later S-139H task). Loaded globally via `mkdocs.yml` `extra_javascript`.
- Bundle choice: cartesian (line + scatter + bar + heatmap). Chosen over `basic` to get heatmap for the ATT&CK coverage page.
- SHA256: 72409fd95b505d17772f2dd9bb81a8672ce6d5b61dcf61ba1fd8442c9ea3e180

## Upgrade procedure

1. Update the URL above to the new version
2. Download with curl -L -o <path> <url>
3. Update the SHA256 in this file
4. Run mkdocs build --strict to verify
5. Manual test at least one page per viz type
