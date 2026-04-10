// docs/assets/javascripts/viz/init.js
// Scans the DOM for .seerflow-viz elements, lazy-hydrates them when they
// enter the viewport, and dispatches to the factory registered on
// window.SeerflowViz matching the data-viz attribute.

(function () {
  'use strict';

  window.SeerflowViz = window.SeerflowViz || {};

  function showError(el, message) {
    el.innerHTML = '';
    const caption = el.dataset.caption || 'Visualization failed to load';
    const err = document.createElement('div');
    err.className = 'seerflow-viz-error';
    err.textContent = caption + ' — ' + message;
    el.appendChild(err);
  }

  function showCaption(el) {
    if (!el.dataset.caption) return;
    const cap = document.createElement('div');
    cap.className = 'seerflow-viz-caption';
    cap.textContent = el.dataset.caption;
    el.appendChild(cap);
  }

  async function hydrate(el) {
    const kind = el.dataset.viz;
    const src = el.dataset.src;
    if (!kind) {
      showError(el, 'missing data-viz attribute');
      return;
    }
    const factoryMap = {
      'entity-graph': window.SeerflowViz.entityGraph,
      'detector-ts': window.SeerflowViz.detectorTimeSeries,
      'attack-heatmap': window.SeerflowViz.attackHeatmap,
      'deployment-cascade': window.SeerflowViz.deploymentCascade,
    };
    const factory = factoryMap[kind];
    if (typeof factory !== 'function') {
      showError(el, 'unknown viz type: ' + kind);
      return;
    }
    el.setAttribute('aria-label', el.dataset.caption || kind);
    try {
      let data = null;
      if (src) {
        const resp = await fetch(src);
        if (!resp.ok) throw new Error('HTTP ' + resp.status);
        data = await resp.json();
      }
      const handle = factory(el, data);
      if (handle) {
        el._viz = handle;
        window.SeerflowViz.register(handle);
      }
      showCaption(el);
    } catch (err) {
      console.error('SeerflowViz hydration failed for', el, err);
      showError(el, err.message);
    }
  }

  function observeAll() {
    const elements = document.querySelectorAll('.seerflow-viz');
    if (!elements.length) return;

    if (!('IntersectionObserver' in window)) {
      elements.forEach(hydrate);
      return;
    }

    const io = new IntersectionObserver(
      (entries, observer) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            hydrate(entry.target);
            observer.unobserve(entry.target);
          }
        });
      },
      { rootMargin: '200px' }
    );

    elements.forEach((el) => io.observe(el));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', observeAll);
  } else {
    observeAll();
  }
})();
