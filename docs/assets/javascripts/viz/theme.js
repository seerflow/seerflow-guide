// docs/assets/javascripts/viz/theme.js
// Syncs Plotly chart palettes with MkDocs Material's dark/light toggle.
// Entity graph and CSS-driven viz read custom properties directly;
// only Plotly needs JS intervention to update its layout template.

(function () {
  'use strict';

  window.SeerflowViz = window.SeerflowViz || {};
  const registry = (window.SeerflowViz._instances = window.SeerflowViz._instances || new Set());

  function currentScheme() {
    return document.body.getAttribute('data-md-color-scheme') || 'default';
  }

  function notifyAll(scheme) {
    registry.forEach((handle) => {
      if (handle && typeof handle.updateTheme === 'function') {
        try {
          handle.updateTheme(scheme);
        } catch (err) {
          console.error('SeerflowViz theme update failed', err);
        }
      }
    });
  }

  const observer = new MutationObserver((mutations) => {
    for (const mut of mutations) {
      if (mut.attributeName === 'data-md-color-scheme') {
        notifyAll(currentScheme());
        return;
      }
    }
  });

  function start() {
    observer.observe(document.body, { attributes: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }

  window.SeerflowViz.currentScheme = currentScheme;
  window.SeerflowViz.register = function (handle) {
    registry.add(handle);
  };
  window.SeerflowViz.unregister = function (handle) {
    registry.delete(handle);
  };
})();
