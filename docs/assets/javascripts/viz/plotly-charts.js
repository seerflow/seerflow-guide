// docs/assets/javascripts/viz/plotly-charts.js
// Two Plotly factories registered on window.SeerflowViz:
//
//   detectorTimeSeries(el, data) — line chart for each ML detector page
//     data: { timestamps, values, threshold_upper, threshold_lower?,
//             anomaly_indices, detector_name, y_axis_label? }
//
//   attackHeatmap(el, data) — MITRE ATT&CK coverage heatmap
//     data: { tactics: [str], techniques: [[{id, name, covered_by, href}]] }
//
// Both factories call window.SeerflowViz.register() so theme.js can
// trigger a re-render on palette toggle.

(function () {
  'use strict';

  window.SeerflowViz = window.SeerflowViz || {};

  function getCssVar(name) {
    return getComputedStyle(document.body).getPropertyValue(name).trim();
  }

  function layoutBase() {
    const scheme = window.SeerflowViz.currentScheme
      ? window.SeerflowViz.currentScheme()
      : 'default';
    const fg = getCssVar('--sf-viz-fg') || (scheme === 'slate' ? '#f3f4f6' : '#1a1a1a');
    const muted = getCssVar('--sf-viz-muted') || (scheme === 'slate' ? '#9ca3af' : '#6b7280');
    const border = getCssVar('--sf-viz-border') || (scheme === 'slate' ? '#374151' : '#d1d5db');
    return {
      paper_bgcolor: 'rgba(0,0,0,0)',
      plot_bgcolor: 'rgba(0,0,0,0)',
      font: { color: fg, family: 'Inter, system-ui, sans-serif' },
      margin: { l: 60, r: 20, t: 20, b: 50 },
      xaxis: {
        gridcolor: border,
        linecolor: border,
        tickcolor: border,
        zerolinecolor: border,
        title: { text: 'Time', font: { color: muted } },
      },
      yaxis: {
        gridcolor: border,
        linecolor: border,
        tickcolor: border,
        zerolinecolor: border,
        title: { text: '', font: { color: muted } },
      },
      hovermode: 'x unified',
      showlegend: true,
      legend: { bgcolor: 'rgba(0,0,0,0)', font: { color: fg } },
    };
  }

  function detectorTimeSeries(el, data) {
    if (!data || !Array.isArray(data.timestamps) || !Array.isArray(data.values)) {
      throw new Error('invalid detector time series data');
    }

    const baselineColor = getCssVar('--sf-baseline') || '#3b82f6';
    const thresholdColor = getCssVar('--sf-threshold') || '#ea580c';
    const anomalyColor = getCssVar('--sf-anomaly') || '#dc2626';

    const anomalyIndices = Array.isArray(data.anomaly_indices) ? data.anomaly_indices : [];
    const anomalyX = anomalyIndices.map((i) => data.timestamps[i]);
    const anomalyY = anomalyIndices.map((i) => data.values[i]);

    const traces = [
      {
        x: data.timestamps,
        y: data.values,
        mode: 'lines',
        name: data.detector_name || 'Score',
        line: { color: baselineColor, width: 2 },
      },
    ];

    if (Array.isArray(data.threshold_upper)) {
      traces.push({
        x: data.timestamps,
        y: data.threshold_upper,
        mode: 'lines',
        name: 'Upper threshold',
        line: { color: thresholdColor, width: 1, dash: 'dash' },
      });
    }
    if (Array.isArray(data.threshold_lower)) {
      traces.push({
        x: data.timestamps,
        y: data.threshold_lower,
        mode: 'lines',
        name: 'Lower threshold',
        line: { color: thresholdColor, width: 1, dash: 'dash' },
      });
    }

    if (anomalyX.length) {
      traces.push({
        x: anomalyX,
        y: anomalyY,
        mode: 'markers',
        name: 'Anomaly',
        marker: { color: anomalyColor, size: 10, symbol: 'circle' },
      });
    }

    const layout = layoutBase();
    layout.yaxis.title.text = data.y_axis_label || 'Score';

    const config = {
      displayModeBar: false,
      responsive: true,
    };

    Plotly.newPlot(el, traces, layout, config);

    return {
      updateTheme() {
        Plotly.relayout(el, layoutBase());
      },
      destroy() {
        Plotly.purge(el);
      },
    };
  }

  function attackHeatmap(el, data) {
    if (!data || !Array.isArray(data.tactics) || !Array.isArray(data.techniques)) {
      throw new Error('invalid attack heatmap data');
    }

    // Flatten techniques into a 2D z-grid: rows = max technique count, columns = tactics
    const maxRows = Math.max(...data.techniques.map((col) => col.length));
    const z = [];
    const text = [];
    const customdata = [];

    for (let row = 0; row < maxRows; row++) {
      z.push([]);
      text.push([]);
      customdata.push([]);
      for (let col = 0; col < data.tactics.length; col++) {
        const cell = (data.techniques[col] || [])[row];
        if (cell) {
          z[row].push(cell.covered_by ? cell.covered_by.length : 0);
          text[row].push(cell.name);
          customdata[row].push(cell);
        } else {
          z[row].push(null);
          text[row].push('');
          customdata[row].push(null);
        }
      }
    }

    const trace = {
      z,
      x: data.tactics,
      type: 'heatmap',
      colorscale: [
        [0, 'rgba(107,114,128,0.15)'],
        [0.5, '#fbbf24'],
        [1, '#dc2626'],
      ],
      showscale: true,
      hoverongaps: false,
      text,
      texttemplate: '%{text}',
      textfont: { size: 9 },
      hovertemplate: '<b>%{text}</b><br>Tactic: %{x}<br>Coverage: %{z}<extra></extra>',
    };

    const layout = layoutBase();
    layout.xaxis.title.text = 'Tactic';
    layout.yaxis.title.text = 'Technique';
    layout.yaxis.showticklabels = false;
    layout.margin.b = 100;
    layout.xaxis.tickangle = -30;
    layout.showlegend = false;

    const config = {
      displayModeBar: false,
      responsive: true,
    };

    Plotly.newPlot(el, [trace], layout, config);

    // Click-to-navigate
    el.on('plotly_click', (eventData) => {
      const pt = eventData.points[0];
      const cell = customdata[pt.pointNumber[0]] && customdata[pt.pointNumber[0]][pt.pointNumber[1]];
      if (cell && cell.href) {
        window.location.href = cell.href;
      }
    });

    return {
      updateTheme() {
        Plotly.relayout(el, layoutBase());
      },
      destroy() {
        Plotly.purge(el);
      },
    };
  }

  window.SeerflowViz.detectorTimeSeries = detectorTimeSeries;
  window.SeerflowViz.attackHeatmap = attackHeatmap;
})();
