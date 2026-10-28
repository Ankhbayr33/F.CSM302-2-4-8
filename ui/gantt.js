/* gantt.js - draws the Gantt chart (SVG) from the C program's JSON result */
"use strict";

window.Gantt = (function () {
  const NS = "http://www.w3.org/2000/svg";
  const SLOTS = 8;                    // categorical colours, fixed order
  const LEFT = 64, RIGHT = 52;     // right margin fits the "✓ finish" label

  /* ---------- helpers ---------- */

  function el(name, attrs, parent) {
    const e = document.createElementNS(NS, name);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }

  function cssVar(name) {
    const root = document.querySelector(".viz-root") || document.documentElement;
    return getComputedStyle(root).getPropertyValue(name).trim();
  }

  function luminance(hex) {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex);
    if (!m) return 0;
    const n = parseInt(m[1], 16);
    const ch = [n >> 16, (n >> 8) & 255, n & 255].map(v => {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
  }

  /* colour of a task: slot by input order; from the 9th task on the same
   * hues repeat WITH a hatch texture, so identity never relies on colour */
  function style(index) {
    const slot = index % SLOTS;
    const hex = cssVar("--s" + (slot + 1));
    const L = luminance(hex);
    // pick the ink with the better contrast (WCAG ratio)
    const ink = (L + 0.05) / 0.05 > 1.05 / (L + 0.05) ? "#0b0b0b" : "#ffffff";
    return { slot, hex, ink, hatched: index >= SLOTS };
  }

  function niceStep(total, pixels) {
    const target = Math.max(1, total / Math.max(2, Math.floor(pixels / 70)));
    const p = Math.pow(10, Math.floor(Math.log10(target)));
    for (const f of [1, 2, 5, 10]) if (f * p >= target) return f * p;
    return 10 * p;
  }

  function addDefs(svg) {
    const defs = el("defs", {}, svg);
    for (let s = 0; s < SLOTS; s++) {
      const p = el("pattern", { id: "hatch-" + s, width: 6, height: 6,
        patternUnits: "userSpaceOnUse", patternTransform: "rotate(45)" }, defs);
      el("rect", { width: 6, height: 6, style: "fill:var(--s" + (s + 1) + ")" }, p);
      el("line", { x1: 0, y1: 0, x2: 0, y2: 6, stroke: "rgba(255,255,255,.55)",
        "stroke-width": 2 }, p);
    }
    const idle = el("pattern", { id: "hatch-idle", width: 6, height: 6,
      patternUnits: "userSpaceOnUse", patternTransform: "rotate(135)" }, defs);
    el("rect", { width: 6, height: 6, style: "fill:var(--surface-2)" }, idle);
    el("line", { x1: 0, y1: 0, x2: 0, y2: 6, style: "stroke:var(--idle)",
      "stroke-width": 2 }, idle);
  }

  function fillFor(st) {
    return st.hatched ? "url(#hatch-" + st.slot + ")" : st.hex;
  }

  /* lane labels must fit in the left margin; the tooltip shows the full name */
  function short(name) {
    return name.length > 7 ? name.slice(0, 6) + "…" : name;
  }

  /* task lookup: tid -> {task, index} */
  function indexTasks(result) {
    const map = new Map();
    [...result.tasks].sort((a, b) => a.tid - b.tid)
      .forEach((t, i) => map.set(t.tid, { task: t, index: i }));
    return map;
  }

  /* ---------- tooltip ---------- */

  function bindTip(target, html) {
    const tip = document.getElementById("tooltip");
    target.addEventListener("mousemove", ev => {
      tip.innerHTML = html;
      tip.hidden = false;
      const x = Math.min(ev.clientX + 14, window.innerWidth - tip.offsetWidth - 8);
      tip.style.left = x + "px";
      tip.style.top = (ev.clientY + 14) + "px";
    });
    target.addEventListener("mouseleave", () => { tip.hidden = true; });
  }

  function esc(s) {
    return String(s).replace(/[&<>"]/g, c =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  }

  /* one CPU bar (task or idle), clipped to the current time */
  function drawSegment(g, seg, x, y, h, now, tasks, minLabel) {
    const end = Math.min(seg.end, now);
    if (end <= seg.start) return;
    const x0 = x(seg.start), x1 = x(end);
    const w = Math.max(1, x1 - x0 - 2);          // 2px surface gap
    const info = tasks.get(seg.tid);
    let label, fill, ink;
    if (!info) {
      label = "idle"; fill = "url(#hatch-idle)"; ink = cssVar("--text-secondary");
    } else {
      const st = style(info.index);
      label = info.task.name; fill = fillFor(st); ink = st.ink;
    }
    el("rect", { x: x0 + 1, y, width: w, height: h, rx: 4, fill }, g);
    if (w >= Math.max(minLabel, label.length * 7 + 8)) {
      const t = el("text", { x: x0 + 1 + w / 2, y: y + h / 2 + 4,
        "text-anchor": "middle", class: "bar-label",
        style: "fill:" + ink }, g);
      t.textContent = label;
    }
    const hit = el("rect", { x: x0, y: y - 2, width: Math.max(6, x1 - x0),
      height: h + 4, class: "hit" }, g);
    const dur = seg.end - seg.start;
    bindTip(hit, info
      ? "<b>" + esc(info.task.name) + "</b>CPU дээр: " + seg.start + " → " +
        seg.end + " (" + dur + ")<br>Priority " + info.task.priority +
        ", burst " + info.task.burst
      : "<b>CPU idle</b>" + seg.start + " → " + seg.end + " (" + dur +
        ")<br>Ирсэн task байхгүй");
  }

  /* ---------- full chart ---------- */

  function render(container, result, now) {
    container.innerHTML = "";
    if (!result) {
      container.innerHTML = '<div class="empty">Task-уудаа оруулаад ' +
        '“Ажиллуулах” дарна уу.</div>';
      return;
    }
    const tasks = indexTasks(result);
    const total = Math.max(1, result.summary.total_time);
    const width = Math.max(640, container.clientWidth);
    const plotW = width - LEFT - RIGHT;
    const x = t => LEFT + (t / total) * plotW;

    const laneH = 20, laneGap = 6;
    const cpuY = 26, cpuH = 38;
    const lanesTop = cpuY + cpuH + 52;
    const n = result.tasks.length;
    const axisY = lanesTop + n * (laneH + laneGap) + 4;
    const height = axisY + 28;

    const svg = el("svg", { width, height, viewBox: "0 0 " + width + " " + height,
      role: "img", "aria-label": result.algorithm + " Gantt chart" }, container);
    addDefs(svg);

    // grid + axis
    const step = niceStep(total, plotW);
    const grid = el("g", {}, svg);
    for (let t = 0; t <= total; t += step) {
      el("line", { x1: x(t), x2: x(t), y1: lanesTop - 8, y2: axisY,
        class: "grid-line" }, grid);
      const lab = el("text", { x: x(t), y: axisY + 16, "text-anchor": "middle",
        class: "tick-label" }, grid);
      lab.textContent = t;
    }
    el("line", { x1: LEFT, x2: LEFT + plotW, y1: axisY, y2: axisY,
      class: "axis-line" }, grid);

    // CPU row (classic textbook Gantt chart)
    el("text", { x: 0, y: 14, class: "section-label" }, svg).textContent =
      "CPU (Gantt chart)";
    el("text", { x: 8, y: cpuY + cpuH / 2 + 4, class: "lane-label" }, svg)
      .textContent = "CPU";
    const cpu = el("g", {}, svg);
    result.timeline.forEach(seg =>
      drawSegment(cpu, seg, x, cpuY, cpuH, now, tasks, 0));

    // boundary times under the CPU row, skipping labels that would collide
    const marks = [];
    result.timeline.forEach(seg => {
      if (seg.start <= now) marks.push(seg.start);
    });
    const last = result.timeline[result.timeline.length - 1];
    if (last && last.end <= now) marks.push(last.end);
    let lastX = -Infinity;
    [...new Set(marks)].forEach(t => {
      const px = x(t);
      if (px - lastX < 24) return;
      lastX = px;
      el("line", { x1: px, x2: px, y1: cpuY + cpuH, y2: cpuY + cpuH + 5,
        class: "axis-line" }, svg);
      el("text", { x: px, y: cpuY + cpuH + 17, "text-anchor": "middle",
        class: "boundary-label" }, svg).textContent = t;
    });

    // one lane per task: waiting (dashed) and running (filled)
    el("text", { x: 0, y: lanesTop - 14, class: "section-label" }, svg)
      .textContent = "Task бүрээр: тасархай = хүлээж буй, дүүргэлттэй = ажиллаж буй";
    [...tasks.values()].forEach(({ task, index }, row) => {
      const y = lanesTop + row * (laneH + laneGap);
      const g = el("g", {}, svg);
      el("text", { x: 8, y: y + laneH / 2 + 4, class: "lane-label" }, g)
        .textContent = short(task.name);
      if (task.arrival > now) return;

      const until = Math.min(task.completion, now);
      if (until > task.arrival) {
        const wait = el("rect", { x: x(task.arrival), y: y + 1,
          width: Math.max(1, x(until) - x(task.arrival)), height: laneH - 2,
          rx: 3, class: "wait-bar" }, g);
        void wait;
      }
      result.timeline.filter(s => s.tid === task.tid).forEach(seg =>
        drawSegment(g, seg, x, y, laneH, now, tasks, 1e9));   // no labels

      // arrival marker
      const ax = x(task.arrival);
      el("path", { d: "M" + (ax - 4) + " " + (y - 3) + " L" + (ax + 4) + " " +
        (y - 3) + " L" + ax + " " + (y + 3) + " Z", class: "arrival" }, g);
      if (task.completion <= now) {
        el("text", { x: x(task.completion) + 4, y: y + laneH / 2 + 4,
          class: "done-mark" }, g).textContent = "✓ " + task.completion;
      }
      const hit = el("rect", { x: x(task.arrival), y, width: Math.max(4,
        x(until) - x(task.arrival)), height: laneH, class: "hit" }, g);
      bindTip(hit, "<b>" + esc(task.name) + "</b>Ирсэн: " + task.arrival +
        (task.completion <= now ? "<br>Дууссан: " + task.completion +
          "<br>Waiting " + task.waiting + ", turnaround " + task.turnaround
          : "<br>Үлдсэн ажил: явагдаж байна"));
      // keep running segments clickable above the lane hit area
      g.querySelectorAll("rect.hit").forEach(r => { if (r !== hit) g.appendChild(r); });
    });

    // time cursor
    if (now < total) {
      const cx = x(now);
      el("line", { x1: cx, x2: cx, y1: cpuY - 6, y2: axisY, class: "cursor" }, svg);
      el("text", { x: cx + 4, y: cpuY - 8, class: "cursor-label" }, svg)
        .textContent = "t=" + now;
    }
  }

  /* ---------- compact chart (comparison view) ---------- */

  function renderCompact(container, result, total, label) {
    const tasks = indexTasks(result);
    const width = Math.max(640, container.clientWidth);
    const plotW = width - LEFT - RIGHT - 40;
    const left = LEFT + 40;
    const x = t => left + (t / Math.max(1, total)) * plotW;
    const h = 26, height = h + 22;

    const svg = el("svg", { width, height, viewBox: "0 0 " + width + " " + height,
      role: "img", "aria-label": label + " Gantt chart" }, container);
    addDefs(svg);
    el("text", { x: 0, y: h / 2 + 4, class: "lane-label" }, svg).textContent = label;
    const g = el("g", {}, svg);
    result.timeline.forEach(seg => drawSegment(g, seg, x, 2, h, Infinity, tasks, 0));
    let lastX = -Infinity;
    const times = result.timeline.map(s => s.start);
    if (result.timeline.length) times.push(result.timeline[result.timeline.length - 1].end);
    [...new Set(times)].forEach(t => {
      const px = x(t);
      if (px - lastX < 24) return;
      lastX = px;
      el("text", { x: px, y: h + 17, "text-anchor": "middle",
        class: "tick-label" }, svg).textContent = t;
    });
  }

  /* legend: one key per task (never colour alone: names are on the bars) */
  function renderLegend(container, result) {
    container.innerHTML = "";
    if (!result) return;
    [...indexTasks(result).values()].forEach(({ task, index }) => {
      const st = style(index);
      const key = document.createElement("span");
      key.className = "key";
      const sw = document.createElement("span");
      sw.className = "sw";
      sw.style.background = st.hatched
        ? "repeating-linear-gradient(45deg," + st.hex + " 0 3px, rgba(255,255,255,.55) 3px 5px)"
        : st.hex;
      key.append(sw, task.name);
      container.appendChild(key);
    });
    const idle = document.createElement("span");
    idle.className = "key";
    idle.innerHTML = '<span class="sw" style="background:repeating-linear-gradient(135deg,var(--surface-2) 0 3px,var(--idle) 3px 5px)"></span>idle';
    const wait = document.createElement("span");
    wait.className = "key";
    wait.innerHTML = '<span class="sw wait"></span>хүлээж буй';
    container.append(idle, wait);
  }

  return { render, renderCompact, renderLegend, style, indexTasks };
})();
