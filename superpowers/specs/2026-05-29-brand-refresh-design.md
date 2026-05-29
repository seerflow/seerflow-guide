# Seerflow Guide — Brand Refresh 2026 (Design Spec)

| | |
|---|---|
| **Date** | 2026-05-29 |
| **Status** | Draft — awaiting user review |
| **Repo** | `seerflow-guide` (MkDocs Material docs site, `https://docs.seerflow.dev`) |
| **Branch** | `feat/brand-refresh-2026` (off `docs/v0.5-feature-sync`) |
| **PR base** | `main` (land after / stacked on `docs/v0.5-feature-sync`; rebase onto `main` once that merges) |
| **Brand source** | `~/PycharmProjects/seerflow/docs/new_image/` (`Brand System.html`, `tokens.css`, `docs.jsx`, `docs-pages.jsx`, `logo.jsx`, 5 page mockups) |

---

## 1. Goal

Re-skin the entire Seerflow Guide to the 2026 brand: **dark-first OKLCH ink palette, indigo signature accent, Geist / Geist Mono type, sharp corners, hairline borders, no shadows, monospace uppercase eyebrows.** Every page adopts the brand — **nothing left on default Material styling.** Rebuild the homepage to the Docs Home mockup, add brand header chrome, and retheme the embedded interactive visualizations.

This is fundamentally a **CSS reskin + font swap + minimal header fork + homepage rebuild + viz retheme** — not a framework change. MkDocs Material's three-column shell (sticky header / left nav / content / right TOC) already matches the brand's intended layout, so we lean on Material's CSS-variable system and override only where the brand diverges.

## 2. Scope

**In scope**
- New design-tokens stylesheet (OKLCH palette + hex mirror + Geist fonts + radii/density).
- `extra.css` rewrite: Material variable bridge + universal component reskin.
- Minimal `overrides/partials/header.html` fork for brand chrome (mono "THE GUIDE" eyebrow, glass topbar, color logo). Native search + palette toggle retained, reskinned.
- `mkdocs.yml`: fonts → Geist/Geist Mono, `custom_dir: overrides`, dark-first palette ordering, extra_css wiring.
- `docs/index.md` rebuilt to the Docs Home mockup (content preserved, layout upgraded).
- Color brand logo asset added; favicon refreshed.
- Viz retheme: `viz/theme.js`, `viz/plotly-charts.js`, `viz/entity-graph.js`, `viz.css` to brand palette (hex for Plotly/canvas).

**Out of scope (YAGNI)**
- Content rewrites of the ~70 pages (only `index.md` layout changes).
- Nav restructure.
- New build tooling or runtime dependencies.
- A Quickstart page (none exists; the Quickstart mockup is used only as a **style donor**).
- Marketing site / product dashboards (separate website + app repos).
- The brand "Tweaks panel" runtime token editor (design-tool artifact only).

## 3. Brand reference (concrete values)

Ported verbatim from brand `tokens.css`. Dark is the default; `.sf-light` / light scheme re-tunes.

**Ink palette (dark):** `--bg oklch(0.145 0.012 250)`, `--surface 0.175`, `--surface-2 0.205`, `--surface-3 0.245`, `--line 0.275`, `--line-2 0.345`, `--text 0.965`, `--text-2 0.795`, `--text-3 0.620`, `--mute 0.500` (all hue 250).

**Accent (signature indigo, anchor `#5154b4`):** `--accent oklch(0.745 0.130 283)`, `--accent-2 oklch(0.620 0.140 283)`, `--accent-ink oklch(0.16 0.05 283)`. Light scheme: `--accent oklch(0.480 0.180 283)` (≈ `#5154b4`).

**Semantic:** `--warn oklch(0.815 0.155 80)` (amber), `--crit oklch(0.725 0.195 25)` (coral), `--info oklch(0.795 0.115 235)` (steel blue). Light scheme uses the brand's light-tuned variants.

**Type:** `--font-display: 'Geist', ui-sans-serif, system-ui, sans-serif`; `--font-mono: 'Geist Mono', ui-monospace, 'SFMono-Regular', Menlo, monospace`. Feature settings `"ss01","ss03","cv11"` (display), `"zero","ss01"` (mono).

**Geometry:** radii `--r-sm 4 / --r-md 6 / --r-lg 10 / --r-xl 16`. Brand uses **sharp 90° joins** on cards/code/admonitions/tables; radius applied only where a mockup rounds.

**Motifs:** depth via surface elevation + 1px `--line` hairline (no shadows); glass topbar (`backdrop-filter: blur(12px)`); monospace uppercase eyebrows/labels (`STEP 01`, `PATH 01`, `THE GUIDE`, section headers) at 10–11px / letter-spacing 0.12–0.14em / `--accent` or `--text-3`; bordered card grids (gap 0, hairline dividers); accent restraint (~5% of any composition).

**Type scale (content):** h1 ~32–40px/600/-0.03em; h2 26px/600/-0.02em (margin 44px top); h3 17px/600; body 15px/1.6/`--text-2` (prose max-width ~720–760px); lede 18–22px/`--text-2`; links `--accent` + underline-offset 3px; inline code Geist Mono.

## 4. Architecture — six isolated units

Each unit has one purpose, a defined interface (CSS custom properties / Material slots), and can be built + verified independently.

### Unit 1 — Design tokens (`docs/assets/stylesheets/tokens.css`, new)
Port the brand palette as CSS custom properties on `:root` (dark) with a light block. **Plus a hex mirror** `--sf-hex-{bg,surface,surface-2,line,text,text-2,text-3,accent,accent-2,warn,crit,info}` carrying the sRGB-hex equivalent of each `oklch()` value, generated with a converter (culori/chroma) to round-trip-match. The hex mirror exists solely for JS/canvas consumers (Plotly, any canvas) that cannot parse `oklch()`.
- **Depends on:** nothing. Loaded first in `extra_css`.
- **Interface:** the `--*` and `--sf-hex-*` variables consumed by Units 2, 3, 6.

### Unit 2 — Material variable bridge (`docs/assets/stylesheets/extra.css`, top section)
Map brand tokens onto Material's own custom properties for both schemes so Material's components inherit the brand with minimal per-component CSS:
- `[data-md-color-scheme="slate"]` (dark, **default**): `--md-default-bg-color → var(--bg)`, `--md-default-fg-color → var(--text)`, `--md-default-fg-color--light/--lighter`, `--md-primary-fg-color → indigo`, `--md-accent-fg-color → indigo`, `--md-code-bg-color → var(--surface)`, `--md-code-fg-color`, `--md-typeset-*`, `--md-footer-*`.
- `[data-md-color-scheme="default"]` (light flavor): same mapping against light token values.
- **Depends on:** Unit 1. **Interface:** Material's `--md-*` cascade.

### Unit 3 — Universal component reskin (`docs/assets/stylesheets/extra.css`, main body)
Targeted overrides where Material defaults ≠ brand. **Must cover every markdown construct used anywhere in the guide** (this is what makes coverage total):
- Global: remove shadows; sharp corners; Geist via `--md-text-font`/`--md-code-font` fallthrough; selection color; hairline rules.
- **Nav (left):** active item = 2px left `--accent` border (no pill/fill); mono uppercase section labels; hover tint via surface; brand active text color; indentation.
- **TOC (right):** active anchor `--accent`; mono small caps optional; hairline.
- **Code blocks:** `--surface` bg, 1px `--line` border, Geist Mono; restyle language label + copy button (keep Material's); inline code on subtle surface, no heavy bg.
- **Admonitions / `pymdownx.details`:** 4px left bar + tinted `--surface` bg + mono uppercase title. Map `note→accent`, `tip→accent`, `info→info`, `warning→warn`, `danger/failure→crit`, `example→accent-2`, `quote→mute`.
- **Tables:** `--surface-2` header w/ mono uppercase `--text-3` cells; hairline cell borders; `--surface` rows; mono numeric/type columns.
- **Content tabs (`pymdownx.tabbed`):** mono labels, active = `--accent` underline.
- **Links, blockquotes, footnotes, keyboard keys, badges/pills** (`.sf-badge.{accent,warn,crit,info,mute}` utilities via attr_list/md_in_html), buttons (`.sf-btn` primary/secondary/ghost), **card grids** (`.sf-grid` / `.sf-card` bordered, gap-0, hairline dividers, mono eyebrow), **step blocks** (`.sf-steps` numbered), horizontal rules, images/figures, search modal + hit highlighting.
- **Mermaid:** keep current sizing rules; retint nodes/edges/labels to brand surfaces + `--accent` (legible on dark **and** light).
- **Depends on:** Units 1–2. **Interface:** Material DOM classes + the `.sf-*` utility classes used by Units 4–5.

### Unit 4 — Header chrome (`overrides/partials/header.html`, minimal fork + CSS in `extra.css`)
Enable `theme.custom_dir: overrides`. Fork Material's header partial with the **smallest possible delta**:
- Add a mono **"THE GUIDE"** eyebrow beside the logo, separated by a 1px `--line` divider.
- Swap logo to the **color** brand mark `seerflow_logo_color.svg` (indigo+cyan glyph, scheme-independent, so one asset serves dark + light).
- Glass topbar: translucent `--bg` + `backdrop-filter: blur(12px)`, 64px height, hairline bottom border.
- **Retain** Material's native instant-search and palette (dark/light) toggle — reskinned via CSS to the brand pill; do **not** reimplement search.
- **Depends on:** Units 1–3 + color logo asset. **Interface:** Material `header.html` block structure (kept compatible for upgrades).

### Unit 5 — Homepage rebuild (`docs/index.md`)
Rebuild to mirror the Docs Home mockup using Material primitives + `md_in_html` + `attr_list` (already enabled) and the `.sf-*` utilities from Unit 3 (no page-specific CSS file):
- Hero: mono eyebrow (`THE GUIDE · v0.5.0 · READ START TO FINISH OR JUMP IN`), Geist h1 with accent phrase, lede, italic accent tagline *"See what single sources can't."*
- "Who is this guide for?" → 2× **PATH** cards (`.sf-grid`), preserving the existing Security Operator / SRE links.
- "How Seerflow works" → existing mermaid pipeline (restyled) + components table.
- "Guide structure" → 3× **STEP** cards.
- "Source code" → CTA button.
- **All current `index.md` content + links preserved**; only markup/layout upgraded; degrades gracefully without JS.
- **Depends on:** Units 1–3. **Interface:** standard markdown + `.sf-*` classes.

### Unit 6 — Visualization retheme (`docs/assets/javascripts/viz/*` + `docs/assets/stylesheets/viz.css`)
- **`plotly-charts.js`:** brand Plotly layout template (paper/plot bg, gridlines, font, trace colors) using **hex** values from `--sf-hex-*`; detector time-series + ATT&CK matrix use `--accent`/`--warn`/`--crit` scales.
- **`entity-graph.js` (D3):** node/edge/severity colors from brand CSS vars; reads via `getComputedStyle` so it follows the toggle.
- **`theme.js`:** unchanged mechanism (MutationObserver on `data-md-color-scheme`); ensure it re-pushes the brand template on toggle.
- **`viz.css`:** container/legend/tooltip surfaces → brand tokens.
- **Depends on:** Unit 1 (esp. the hex mirror). **Interface:** existing `window.SeerflowViz` registry.

## 5. Archetype → section coverage map (total coverage)

The 5 mockups donate style patterns; every guide section maps to one. No section is left unaddressed.

| Mock archetype | Patterns donated | Guide sections covered |
|---|---|---|
| **Home** | hero, eyebrow, PATH/STEP cards, pipeline diagram | `index.md` |
| **Security Primer** | concept lede, callouts, inline defs, light tables | `security-primer/*`, `ops-primer/*` |
| **Detection** | feature card-grids, comparison/param tables, diagrams, code | `detection/*`, `correlation/*`, `entity-graph/*`, `architecture/*` |
| **Config Reference** | dense param tables (type/default/mono columns) | `reference/*` |
| **Quickstart** (donor only) | numbered step blocks, command code, procedural flow | `operations/*` procedural pages |

"Nothing left" is guaranteed structurally: Unit 3 styles **every markdown construct** the guide emits, validated against all five archetypes — so any page composed of those constructs renders on-brand regardless of section.

## 6. File inventory

**New**
- `docs/assets/stylesheets/tokens.css`
- `overrides/partials/header.html`
- `docs/assets/seerflow_logo_color.svg` (copied from `~/PycharmProjects/seerflow/images/seerflow_logo_color.svg`); favicon kept as-is unless a brand favicon is supplied
- `superpowers/specs/2026-05-29-brand-refresh-design.md` (this file)

**Modified**
- `docs/assets/stylesheets/extra.css` (full rewrite)
- `docs/assets/stylesheets/viz.css`
- `docs/assets/javascripts/viz/plotly-charts.js`, `viz/entity-graph.js`, `viz/theme.js`
- `mkdocs.yml` (fonts, `custom_dir`, palette order, logo)
- `docs/index.md` (homepage rebuild)

**Untouched:** the ~70 content markdown pages; nav; the unrelated uncommitted `scripts/gen_viz_data.py` and `.letta/` (never staged).

## 7. Key technical decisions

1. **OKLCH in CSS, hex mirror for JS.** Author all CSS in OKLCH (matches brand source, future-proof; modern browsers handle it). Provide a parallel hex set only for Plotly/canvas, which choke on `oklch()` (the Monaco OKLCH crash is the cautionary precedent).
2. **Dark-first default.** Order the `slate` (dark) palette entry first in `mkdocs.yml` so first paint is on-brand; keep the light flavor + toggle (mockups are dark-first).
3. **Reskin over rebuild for the shell.** Fork only the header partial (minimal delta) and rely on Material's `--md-*` variable system for everything else — search, nav, TOC, versioning (mike), instant-loading, and accessibility stay intact and upgrade-safe.
4. **Fonts via Material config.** `font: { text: Geist, code: Geist Mono }`; the `privacy` plugin self-hosts them at build (works with the custom domain / offline build). Verify at first build.
5. **Homepage in markdown, not a template.** Use `md_in_html` + `.sf-*` utilities so the landing is authored content (editable, graceful degradation), not a forked `home.html`.

## 8. Verification plan

- `mkdocs build --strict` passes (no orphan pages, no broken links; existing `.lychee.toml` link check still green).
- `mkdocs serve` visual pass, **dark and light**, on: homepage; one page per section — Security Primer (callouts/defs), Detection (cards/tables/diagrams/code), a `reference/*` page (dense tables), an `operations/*` procedural page (steps/code), an `entity-graph/*` page (D3), a detector page with a Plotly chart, `reference/attack-coverage` (ATT&CK matrix).
- Confirm: nav active state, TOC, code copy button, content tabs, admonitions (all tones), tables, search modal + highlight, mermaid legibility, badges/cards/buttons.
- Confirm viz (entity graph, detector charts, ATT&CK matrix) render in brand colors and **re-theme on toggle**; **no console errors** (especially no `oklch` parse errors from Plotly).
- Geist + Geist Mono actually load (network/self-hosted), no FOUT to Roboto.

## 9. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Material upgrade drifts the forked header | Keep the fork minimal (eyebrow + logo + glass only); document the delta |
| `oklch()` unparseable in Plotly/canvas | Hex mirror (`--sf-hex-*`) for all JS-consumed colors |
| Warm semantic colors illegible on light bg | Use the brand's light-tuned `--warn/--crit/--info` values |
| Geist fails to build with `privacy` plugin | Verify at first build; fallback to Google Fonts CDN or vendored woff2 if needed |
| Brand PR carries the v0.5-sync commit | Land after / stacked on `docs/v0.5-feature-sync`; rebase onto `main` once it merges |

## 10. Git plan

- Branch `feat/brand-refresh-2026` off `docs/v0.5-feature-sync` (newest content). ✔ created.
- Stage only brand-refresh files; never stage `scripts/gen_viz_data.py` or `.letta/`.
- Conventional commits (`feat(brand):`, `style:`, `docs:`). PR → `main` per repo convention (no `dev` branch in this repo), respecting the v0.5-sync ordering note above.
