// docs/assets/javascripts/viz/entity-graph.js
// D3 force-directed entity graph component. Consumes JSON with
// { nodes: [{id, type, label, risk}], edges: [{source, target, kind}] }
// Renders into the provided element with zoom/pan, click-to-select,
// and keyboard-navigable nodes. Colors come from CSS custom properties
// so dark/light mode is automatic.

(function () {
  'use strict';

  window.SeerflowViz = window.SeerflowViz || {};

  function entityGraph(el, data) {
    if (!data || !Array.isArray(data.nodes) || !Array.isArray(data.edges)) {
      throw new Error('invalid entity graph data');
    }

    el.classList.add('seerflow-entity-graph');
    const width = el.clientWidth || 800;
    const height = Math.min(Math.max(el.clientHeight, 360), 500);

    // Clone nodes/edges so D3 does not mutate the fetched data
    const nodes = data.nodes.map((n) => Object.assign({}, n));
    const links = data.edges.map((e) => Object.assign({}, e));

    const svg = d3
      .select(el)
      .append('svg')
      .attr('viewBox', `0 0 ${width} ${height}`)
      .attr('preserveAspectRatio', 'xMidYMid meet')
      .attr('role', 'img')
      .attr('aria-label', data.title || 'Entity graph');

    const g = svg.append('g');

    // Zoom / pan
    svg.call(
      d3
        .zoom()
        .scaleExtent([0.3, 4])
        .on('zoom', (event) => g.attr('transform', event.transform))
    );

    // Arrow marker for directed edges
    svg
      .append('defs')
      .append('marker')
      .attr('id', 'seerflow-arrow')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 20)
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M0,-5L10,0L0,5')
      .attr('fill', 'var(--sf-edge)');

    // Links
    const link = g
      .append('g')
      .attr('class', 'links')
      .selectAll('line')
      .data(links)
      .enter()
      .append('line')
      .attr('class', 'link')
      .attr('marker-end', 'url(#seerflow-arrow)');

    // Link labels
    const linkLabel = g
      .append('g')
      .attr('class', 'link-labels')
      .selectAll('text')
      .data(links)
      .enter()
      .append('text')
      .attr('class', 'link-label')
      .text((d) => d.kind);

    // Nodes
    const isMobile = window.matchMedia('(max-width: 480px)').matches;
    const nodeRadius = isMobile ? 8 : 12;

    const node = g
      .append('g')
      .attr('class', 'nodes')
      .selectAll('circle')
      .data(nodes)
      .enter()
      .append('circle')
      .attr('class', (d) => 'node ' + d.type)
      .attr('r', nodeRadius)
      .attr('tabindex', 0)
      .attr('role', 'button')
      .attr('aria-label', (d) => `Entity: ${d.type} ${d.label}, risk ${d.risk.toFixed(2)}`)
      .call(drag())
      .on('click', (event, d) => openPanel(d))
      .on('keydown', (event, d) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          openPanel(d);
        }
      });

    // Node labels
    const nodeLabel = g
      .append('g')
      .attr('class', 'node-labels')
      .selectAll('text')
      .data(nodes)
      .enter()
      .append('text')
      .attr('class', 'node-label')
      .attr('dx', nodeRadius + 3)
      .attr('dy', 4)
      .text((d) => d.label);

    // Details panel
    const panel = document.createElement('div');
    panel.className = 'details-panel';
    panel.setAttribute('role', 'region');
    panel.setAttribute('aria-live', 'polite');
    el.appendChild(panel);

    function openPanel(d) {
      panel.innerHTML = `
        <strong>${escapeHtml(d.label)}</strong>
        <dl>
          <dt>Type</dt><dd>${escapeHtml(d.type)}</dd>
          <dt>ID</dt><dd><code>${escapeHtml(d.id)}</code></dd>
          <dt>Risk score</dt><dd>${d.risk.toFixed(2)}</dd>
        </dl>
        <button type="button" aria-label="Close details">Close</button>
      `;
      panel.classList.add('open');
      const btn = panel.querySelector('button');
      btn.addEventListener('click', closePanel);
    }

    function closePanel() {
      panel.classList.remove('open');
      panel.innerHTML = '';
    }

    // Close panel on Escape
    svg.on('keydown', (event) => {
      if (event.key === 'Escape') closePanel();
    });

    // Force simulation
    const simulation = d3
      .forceSimulation(nodes)
      .force(
        'link',
        d3
          .forceLink(links)
          .id((d) => d.id)
          .distance(isMobile ? 60 : 90)
      )
      .force('charge', d3.forceManyBody().strength(isMobile ? -120 : -240))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collide', d3.forceCollide().radius(nodeRadius + 4));

    simulation.on('tick', () => {
      link
        .attr('x1', (d) => d.source.x)
        .attr('y1', (d) => d.source.y)
        .attr('x2', (d) => d.target.x)
        .attr('y2', (d) => d.target.y);
      linkLabel
        .attr('x', (d) => (d.source.x + d.target.x) / 2)
        .attr('y', (d) => (d.source.y + d.target.y) / 2);
      node.attr('cx', (d) => d.x).attr('cy', (d) => d.y);
      nodeLabel.attr('x', (d) => d.x).attr('y', (d) => d.y);
    });

    // Respect prefers-reduced-motion
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      simulation.alphaDecay(0.5).alpha(0.3);
    }

    function drag() {
      return d3
        .drag()
        .on('start', (event, d) => {
          if (!event.active) simulation.alphaTarget(0.3).restart();
          d.fx = d.x;
          d.fy = d.y;
        })
        .on('drag', (event, d) => {
          d.fx = event.x;
          d.fy = event.y;
        })
        .on('end', (event, d) => {
          if (!event.active) simulation.alphaTarget(0);
          d.fx = null;
          d.fy = null;
        });
    }

    function escapeHtml(s) {
      return String(s).replace(/[&<>"']/g, (c) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      }[c]));
    }

    return {
      updateTheme() {
        // Entity graph reads CSS custom properties directly,
        // so no re-render is needed. Present for interface parity.
      },
      destroy() {
        simulation.stop();
        d3.select(el).selectAll('*').remove();
      },
    };
  }

  window.SeerflowViz.entityGraph = entityGraph;
})();
