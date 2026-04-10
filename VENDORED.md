# Vendored JavaScript Libraries

The Seerflow Guide vendors its JavaScript dependencies to support air-gapped / offline rendering (no runtime CDN lookups beyond MathJax).

## D3.js v7.9.0

- Upstream: https://cdn.jsdelivr.net/npm/d3@7.9.0/dist/d3.min.js
- License: ISC
- Consumed by: `docs/assets/javascripts/viz/entity-graph.js` (added in a later S-139H task). Also loaded globally via `mkdocs.yml` `extra_javascript`, so any future D3-using component can reuse the same global.
- SHA256: f2094bbf6141b359722c4fe454eb6c4b0f0e42cc10cc7af921fc158fceb86539

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
