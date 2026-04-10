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
// Both factories return a handle with updateTheme() / destroy(). The
// caller (init.js) registers the handle with window.SeerflowViz.register()
// so theme.js can invoke updateTheme() on palette toggle.

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
    const panelBg = getCssVar('--sf-viz-panel-bg') || (scheme === 'slate' ? '#1f2937' : '#f9fafb');
    const panelFg = getCssVar('--sf-viz-panel-fg') || (scheme === 'slate' ? '#f9fafb' : '#111827');
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
      hoverlabel: {
        bgcolor: panelBg,
        bordercolor: border,
        font: { color: panelFg, family: 'Inter, system-ui, sans-serif', size: 12 },
        align: 'left',
      },
      showlegend: true,
      legend: { bgcolor: 'rgba(0,0,0,0)', font: { color: fg } },
    };
  }

  function detectorTimeSeries(el, data) {
    if (!data || !Array.isArray(data.timestamps) || !Array.isArray(data.values)) {
      throw new Error('invalid detector time series data');
    }

    const anomalyIndices = Array.isArray(data.anomaly_indices) ? data.anomaly_indices : [];
    const anomalyX = anomalyIndices.map((i) => data.timestamps[i]);
    const anomalyY = anomalyIndices.map((i) => data.values[i]);

    function buildTraces() {
      // Re-reads CSS vars so dark/light toggle picks up the active palette
      const baselineColor = getCssVar('--sf-baseline') || '#3b82f6';
      const thresholdColor = getCssVar('--sf-threshold') || '#ea580c';
      const anomalyColor = getCssVar('--sf-anomaly') || '#dc2626';

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
      return traces;
    }

    function buildLayout() {
      // Base layout plus per-chart overrides; called on init and on theme toggle
      const layout = layoutBase();
      layout.yaxis.title.text = data.y_axis_label || 'Score';
      return layout;
    }

    const config = {
      displayModeBar: false,
      responsive: true,
    };

    Plotly.newPlot(el, buildTraces(), buildLayout(), config);

    return {
      updateTheme() {
        // Plotly.react rebuilds both traces and layout so CSS-var-driven
        // colors and per-chart layout overrides both update cleanly
        Plotly.react(el, buildTraces(), buildLayout(), config);
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

    function buildTrace() {
      return {
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
    }

    function buildLayout() {
      // Base layout plus heatmap-specific overrides; called on init and theme toggle
      const layout = layoutBase();
      layout.xaxis.title.text = 'Tactic';
      layout.yaxis.title.text = 'Technique';
      layout.yaxis.showticklabels = false;
      layout.margin.b = 100;
      layout.xaxis.tickangle = -30;
      layout.showlegend = false;
      return layout;
    }

    const config = {
      displayModeBar: false,
      responsive: true,
    };

    Plotly.newPlot(el, [buildTrace()], buildLayout(), config);

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
        // Plotly.react reapplies per-chart layout overrides that relayout would clobber
        Plotly.react(el, [buildTrace()], buildLayout(), config);
      },
      destroy() {
        Plotly.purge(el);
      },
    };
  }

  function deploymentCascade(el, data) {
    // Horizontal bar chart used as a gantt — rows are log sources, bars span
    // from start_offset to start_offset+duration minutes past the deploy time.
    // Zero-duration rows render as diamond markers.
    // Traces are split by severity so Plotly's legend has one entry per category.
    if (!data || !Array.isArray(data.tasks)) {
      throw new Error('invalid deployment cascade data');
    }

    // Reverse so the first task appears at the top of the chart
    const tasks = data.tasks.slice().reverse();

    function barTrace(name, severity, color) {
      const rows = tasks.filter((t) => t.duration > 0 && t.severity === severity);
      if (!rows.length) return null;
      return {
        type: 'bar',
        orientation: 'h',
        name,
        y: rows.map((t) => t.label),
        x: rows.map((t) => t.duration),
        base: rows.map((t) => t.start_offset),
        marker: { color, line: { width: 0 } },
        text: rows.map((t) => t.source),
        textposition: 'inside',
        insidetextanchor: 'start',
        textfont: { size: 11, color: '#ffffff' },
        hovertemplate:
          '<b>%{y}</b><br>Source: %{text}<br>T+%{base} → T+%{x}<extra></extra>',
        showlegend: true,
      };
    }

    function markerTrace(name, severity, color) {
      const rows = tasks.filter((t) => t.duration === 0 && t.severity === severity);
      if (!rows.length) return null;
      return {
        type: 'scatter',
        mode: 'markers',
        name,
        y: rows.map((t) => t.label),
        x: rows.map((t) => t.start_offset),
        marker: {
          symbol: 'diamond',
          size: 14,
          color,
          line: { width: 2, color: getCssVar('--sf-viz-fg') || '#1a1a1a' },
        },
        text: rows.map((t) => t.source),
        hovertemplate: '<b>%{y}</b><br>Source: %{text}<br>T+%{x}<extra></extra>',
        showlegend: true,
      };
    }

    function buildTraces() {
      const warning = getCssVar('--sf-threshold') || '#ea580c';
      const critical = getCssVar('--sf-anomaly') || '#dc2626';
      const alertBlue = getCssVar('--sf-baseline') || '#3b82f6';
      const milestone = getCssVar('--sf-entity-host') || '#10b981';
      return [
        barTrace('Warning', 'warning', warning),
        barTrace('Critical', 'critical', critical),
        markerTrace('Deploy milestone', 'milestone', milestone),
        markerTrace('Seerflow alert', 'alert', alertBlue),
        markerTrace('Critical event', 'critical', critical),
      ].filter((t) => t !== null);
    }

    function buildLayout() {
      const layout = layoutBase();
      layout.title = {
        text: data.title || 'Deployment cascade',
        font: { size: 14, color: getCssVar('--sf-viz-fg') || '#1a1a1a' },
      };
      layout.margin = { l: 220, r: 30, t: 50, b: 90 };
      layout.xaxis.title.text = 'Minutes after deploy (T+minutes)';
      layout.xaxis.rangemode = 'tozero';
      layout.xaxis.dtick = 5;
      layout.yaxis.title.text = '';
      layout.yaxis.automargin = true;
      layout.barmode = 'stack';
      layout.bargap = 0.3;
      layout.showlegend = true;
      layout.legend = {
        orientation: 'h',
        x: 0.5,
        xanchor: 'center',
        y: -0.15,
        yanchor: 'top',
        bgcolor: 'rgba(0,0,0,0)',
        font: { color: getCssVar('--sf-viz-fg') || '#1a1a1a', size: 12 },
      };
      // Override unified x-hover: gantt rows at the same timestamp should not
      // stack into one tooltip — show only the row the cursor is actually on.
      layout.hovermode = 'closest';
      return layout;
    }

    const config = {
      displayModeBar: false,
      responsive: true,
    };

    Plotly.newPlot(el, buildTraces(), buildLayout(), config);

    return {
      updateTheme() {
        Plotly.react(el, buildTraces(), buildLayout(), config);
      },
      destroy() {
        Plotly.purge(el);
      },
    };
  }

  function pipelineSequence(el, data) {
    // Vertical sequence/flow diagram. Each stage renders as a horizontal bar
    // with the stage name on the left (y-axis) and an inline description
    // inside the bar. Stages stack top-to-bottom in the order given.
    if (!data || !Array.isArray(data.stages)) {
      throw new Error('invalid pipeline sequence data');
    }

    // Reverse so the first stage appears at the top of the chart
    const stages = data.stages.slice().reverse();
    const stepColors = [
      '--sf-baseline',
      '--sf-entity-host',
      '--sf-entity-user',
      '--sf-entity-process',
      '--sf-threshold',
      '--sf-anomaly',
      '--sf-entity-domain',
      '--sf-entity-file',
    ];
    const fallbackColors = [
      '#3b82f6',
      '#10b981',
      '#0ea5e9',
      '#a855f7',
      '#ea580c',
      '#dc2626',
      '#ec4899',
      '#ef4444',
    ];

    function stageColor(index) {
      const idx = index % stepColors.length;
      return getCssVar(stepColors[idx]) || fallbackColors[idx];
    }

    function buildTraces() {
      // Colors indexed by the ORIGINAL (un-reversed) order so stage 1 always
      // gets the first color regardless of display order.
      const nStages = stages.length;
      return [
        {
          type: 'bar',
          orientation: 'h',
          x: stages.map(() => 1),
          y: stages.map((s) => s.name),
          text: stages.map((s) => s.description || s.note || ''),
          textposition: 'inside',
          insidetextanchor: 'start',
          textfont: { size: 12, color: '#ffffff' },
          marker: {
            color: stages.map((_, i) => stageColor(nStages - 1 - i)),
            line: { width: 0 },
          },
          hovertemplate:
            '<b>%{y}</b><br>%{text}<br><i>Step %{customdata}</i><extra></extra>',
          customdata: stages.map((_, i) => nStages - i),
          showlegend: false,
        },
      ];
    }

    function buildLayout() {
      const layout = layoutBase();
      layout.title = {
        text: data.title || 'Pipeline sequence',
        font: { size: 14, color: getCssVar('--sf-viz-fg') || '#1a1a1a' },
      };
      layout.margin = { l: 160, r: 30, t: 50, b: 30 };
      layout.xaxis.visible = false;
      layout.xaxis.showgrid = false;
      layout.xaxis.zeroline = false;
      layout.yaxis.title.text = '';
      layout.yaxis.automargin = true;
      layout.yaxis.showgrid = false;
      layout.bargap = 0.35;
      layout.showlegend = false;
      layout.hovermode = 'closest';
      return layout;
    }

    const config = {
      displayModeBar: false,
      responsive: true,
    };

    Plotly.newPlot(el, buildTraces(), buildLayout(), config);

    return {
      updateTheme() {
        Plotly.react(el, buildTraces(), buildLayout(), config);
      },
      destroy() {
        Plotly.purge(el);
      },
    };
  }

  window.SeerflowViz.detectorTimeSeries = detectorTimeSeries;
  window.SeerflowViz.attackHeatmap = attackHeatmap;
  window.SeerflowViz.deploymentCascade = deploymentCascade;
  window.SeerflowViz.pipelineSequence = pipelineSequence;
})();
