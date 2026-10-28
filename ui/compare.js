/* compare.js - runs every algorithm on the same tasks and compares them */
"use strict";

window.Compare = (function () {
  const NS = "http://www.w3.org/2000/svg";
  const METRICS = [
    { key: "avg_waiting", title: "Дундаж waiting time" },
    { key: "avg_turnaround", title: "Дундаж turnaround time" },
    { key: "avg_response", title: "Дундаж response time" },
  ];

  function fmt(v) { return (Math.round(v * 100) / 100).toString(); }

  function el(name, attrs, parent) {
    const e = document.createElementNS(NS, name);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }

  /* horizontal bar chart: one bar per algorithm, lowest value marked */
  function barChart(box, rows, metric) {
    const wrap = document.createElement("div");
    const h3 = document.createElement("h3");
    h3.textContent = metric.title + " (бага нь сайн)";
    wrap.appendChild(h3);

    const values = rows.map(r => r.summary[metric.key]);
    const max = Math.max(1e-9, ...values);
    const min = Math.min(...values);
    const labelW = 86, valueW = 92, barH = 18, gap = 8;
    const width = Math.max(260, box.clientWidth / 3 - 16);
    const plotW = width - labelW - valueW;
    const height = rows.length * (barH + gap);

    const svg = el("svg", { width, height, role: "img",
      "aria-label": metric.title }, wrap);
    rows.forEach((r, i) => {
      const v = values[i];
      const y = i * (barH + gap);
      const best = v === min;
      el("text", { x: 0, y: y + barH / 2 + 4 }, svg).textContent =
        Api.LABELS[r.id];
      const w = Math.max(2, (v / max) * plotW);
      el("rect", { x: labelW, y, width: w, height: barH, rx: 4,
        class: "bar" + (best ? " best" : "") }, svg);
      const t = el("text", { x: labelW + w + 6, y: y + barH / 2 + 4,
        class: "val" }, svg);
      t.textContent = fmt(v) + (best ? "  ★ хамгийн бага" : "");
    });
    box.appendChild(wrap);
  }

  function table(tbl, rows) {
    const cols = [
      ["avg_turnaround", "Дундаж TAT"], ["avg_waiting", "Дундаж WT"],
      ["avg_response", "Дундаж RT"], ["context_switches", "Context switch"],
      ["total_time", "Нийт хугацаа"], ["utilization", "CPU ашиглалт %"],
    ];
    const lowerIsBetter = new Set(["avg_turnaround", "avg_waiting",
      "avg_response", "context_switches"]);
    let html = "<thead><tr><th>Алгоритм</th>" +
      cols.map(c => "<th>" + c[1] + "</th>").join("") + "</tr></thead><tbody>";
    const mins = {};
    cols.forEach(([k]) => { mins[k] = Math.min(...rows.map(r => r.summary[k])); });
    rows.forEach(r => {
      html += "<tr><td>" + Api.LABELS[r.id] +
        (r.uses_quantum ? " (q=" + r.quantum + ")" : "") + "</td>";
      cols.forEach(([k]) => {
        const v = r.summary[k];
        const best = lowerIsBetter.has(k) && v === mins[k];
        html += "<td>" + (best ? '<span class="best">' + fmt(v) + " ★</span>" : fmt(v)) + "</td>";
      });
      html += "</tr>";
    });
    tbl.innerHTML = html + "</tbody>";
  }

  function render(results, quantum) {
    const panel = document.getElementById("compare-panel");
    const charts = document.getElementById("compare-charts");
    const gantts = document.getElementById("compare-gantts");
    const rows = results.map((r, i) => Object.assign({ id: Api.ALGORITHMS[i] }, r));

    panel.hidden = false;
    document.getElementById("cmp-sub").textContent =
      "(ижил task-ууд, RR-д q = " + quantum + ")";
    charts.innerHTML = "";
    gantts.innerHTML = "";
    METRICS.forEach(m => barChart(charts, rows, m));

    // same time scale for every algorithm so the bars are comparable
    const total = Math.max(...rows.map(r => r.summary.total_time));
    rows.forEach(r => Gantt.renderCompact(gantts, r, total, Api.LABELS[r.id]));
    table(document.getElementById("compare-table"), rows);
  }

  function hide() {
    document.getElementById("compare-panel").hidden = true;
  }

  return { render, hide };
})();
