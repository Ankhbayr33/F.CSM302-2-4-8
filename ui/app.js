/* app.js - UI state, controls and playback of the Gantt chart */
"use strict";

(function () {
  const $ = id => document.getElementById(id);
  const RR_ALGS = new Set(["rr", "priority_rr"]);

  const state = {
    result: null,      // JSON printed by the C scheduler (-j)
    time: 0,           // current playback time (float)
    playing: false,
    lastFrame: 0,
    backend: false,
  };

  /* ---------------- messages ---------------- */

  function showMessage(text, kind) {
    const box = $("message");
    if (!text) { box.hidden = true; return; }
    box.className = "message " + (kind || "error");
    box.textContent = text;
    box.hidden = false;
  }

  /* ---------------- input helpers ---------------- */

  function readQuantum() {
    const raw = $("quantum").value.trim();
    if (!/^\d+$/.test(raw) || +raw < 1 || +raw > 1000000)
      throw new Error("Time quantum нь 1-ээс 1000000 хүртэлх бүхэл тоо байх ёстой (одоо: “" + raw + "”).");
    return +raw;
  }

  function readTasks() {
    const text = $("tasks").value;
    if (!text.trim()) throw new Error("Task-ын жагсаалт хоосон байна.");
    return text.endsWith("\n") ? text : text + "\n";
  }

  function updateQuantumField() {
    const uses = RR_ALGS.has($("algorithm").value);
    $("quantum").disabled = !uses;
    $("quantum-field").classList.toggle("field-disabled", !uses);
    $("quantum-field").title = uses ? "" : "Энэ алгоритм quantum ашиглахгүй";
  }

  function setBusy(busy) {
    $("btn-run").disabled = busy || !state.backend;
    $("btn-compare").disabled = busy || !state.backend;
  }

  /* ---------------- running ---------------- */

  function loadResult(result, autoplay) {
    state.result = result;
    stop();
    state.time = autoplay ? 0 : result.summary.total_time;
    $("time").max = result.summary.total_time;
    $("time-total").textContent = result.summary.total_time;
    $("gantt-title").textContent = "— " + result.algorithm +
      (result.uses_quantum ? " (q = " + result.quantum + ")" : "");
    $("command").textContent = result.command || "";
    const warn = (result.warnings || []).join("\n");
    showMessage(warn, "warning");
    render();
    if (autoplay) play();
  }

  async function runSelected() {
    let quantum, tasks;
    try { quantum = readQuantum(); tasks = readTasks(); }
    catch (e) { showMessage(e.message); return; }

    setBusy(true);
    showMessage("");
    try {
      const r = await Api.run($("algorithm").value, quantum, tasks);
      if (r.error) {
        clearResult();
        showMessage("C програм оролтыг хүлээж авсангүй:\n" + r.error);
        return;
      }
      Compare.hide();
      loadResult(Api.validateResult(r), true);
    } catch (e) {
      showMessage(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function runCompare() {
    let quantum, tasks;
    try { quantum = readQuantum(); tasks = readTasks(); }
    catch (e) { showMessage(e.message); return; }

    setBusy(true);
    showMessage("");
    try {
      const { results } = await Api.compare(quantum, tasks);
      const bad = results.find(r => r.error);
      if (bad) {
        clearResult();
        showMessage("C програм оролтыг хүлээж авсангүй:\n" + bad.error);
        return;
      }
      results.forEach(Api.validateResult);
      Compare.render(results, quantum);
      const idx = Api.ALGORITHMS.indexOf($("algorithm").value);
      loadResult(results[idx], false);
    } catch (e) {
      showMessage(e.message);
    } finally {
      setBusy(false);
    }
  }

  function clearResult() {
    stop();
    state.result = null;
    state.time = 0;
    $("time").max = 0;
    $("time-total").textContent = "0";
    $("gantt-title").textContent = "";
    $("command").textContent = "";
    Compare.hide();
    render();
  }

  /* ---------------- playback ---------------- */

  function total() { return state.result ? state.result.summary.total_time : 0; }

  function frame(ts) {
    if (!state.playing) return;
    const dt = state.lastFrame ? (ts - state.lastFrame) / 1000 : 0;
    state.lastFrame = ts;
    state.time = Math.min(total(), state.time + dt * +$("speed").value);
    render();
    if (state.time >= total()) { stop(); return; }
    requestAnimationFrame(frame);
  }

  function play() {
    if (!state.result) return;
    if (state.time >= total()) state.time = 0;   // replay from the start
    state.playing = true;
    state.lastFrame = 0;
    $("btn-play").textContent = "⏸";
    $("btn-play").setAttribute("aria-label", "Зогсоох");
    requestAnimationFrame(frame);
  }

  function stop() {
    state.playing = false;
    $("btn-play").textContent = "▶";
    $("btn-play").setAttribute("aria-label", "Тоглуулах");
  }

  /* times at which something happens: dispatch, completion, arrival */
  function events() {
    if (!state.result) return [0];
    const s = new Set([0, total()]);
    state.result.timeline.forEach(g => { s.add(g.start); s.add(g.end); });
    state.result.tasks.forEach(t => s.add(t.arrival));
    return [...s].filter(t => t <= total()).sort((a, b) => a - b);
  }

  function jump(dir) {
    stop();
    const now = Math.floor(state.time);
    const ev = events();
    const next = dir > 0 ? ev.find(t => t > now) : [...ev].reverse().find(t => t < now);
    if (next !== undefined) state.time = next;
    render();
  }

  function seek(t) {
    stop();
    state.time = Math.max(0, Math.min(total(), t));
    render();
  }

  /* ---------------- views ---------------- */

  function chip(task, index, cls) {
    const st = Gantt.style(index);
    const c = document.createElement("span");
    c.className = "chip " + (cls || "");
    const sw = document.createElement("i");
    sw.style.background = st.hex;
    c.append(sw, task.name);
    return c;
  }

  function renderState(now) {
    const dl = $("state");
    dl.innerHTML = "";
    $("state-t").textContent = now;
    if (!state.result) return;

    const tasks = [...Gantt.indexTasks(state.result).values()];
    const seg = state.result.timeline.find(g => g.start <= now && now < g.end);
    const runningTid = seg && seg.tid >= 0 ? seg.tid : null;
    const groups = [
      ["Ажиллаж буй", tasks.filter(x => x.task.tid === runningTid), "running",
        seg && seg.tid < 0 ? "CPU idle" : "—"],
      ["Хүлээж буй (ready)", tasks.filter(x => x.task.arrival <= now &&
        x.task.completion > now && x.task.tid !== runningTid)
        .sort((a, b) => a.task.arrival - b.task.arrival || a.task.tid - b.task.tid), "", "—"],
      ["Ирээгүй", tasks.filter(x => x.task.arrival > now), "", "—"],
      ["Дууссан", tasks.filter(x => x.task.completion <= now)
        .sort((a, b) => a.task.completion - b.task.completion), "done", "—"],
    ];
    groups.forEach(([label, list, cls, emptyText]) => {
      const dt = document.createElement("dt");
      dt.textContent = label + " (" + list.length + ")";
      const dd = document.createElement("dd");
      if (list.length === 0) {
        const s = document.createElement("span");
        s.className = "none";
        s.textContent = emptyText;
        dd.appendChild(s);
      }
      list.forEach(x => dd.appendChild(chip(x.task, x.index, cls)));
      dl.append(dt, dd);
    });
    if (seg && seg.tid >= 0) {
      const dt = document.createElement("dt");
      dt.textContent = "Одоогийн slice";
      const dd = document.createElement("dd");
      dd.textContent = seg.start + " → " + seg.end + " (" + (seg.end - seg.start) + " нэгж)";
      dl.append(dt, dd);
    }
  }

  function fmt(v) { return (Math.round(v * 100) / 100).toString(); }

  function renderSummary() {
    const box = $("summary");
    if (!state.result) { box.innerHTML = '<p class="none">Үр дүн алга</p>'; return; }
    const s = state.result.summary;
    const tiles = [
      ["Waiting time", fmt(s.avg_waiting), "дундаж"],
      ["Turnaround time", fmt(s.avg_turnaround), "дундаж"],
      ["Response time", fmt(s.avg_response), "дундаж"],
      ["CPU ашиглалт", fmt(s.utilization) + "%", s.busy_time + " / " + s.total_time],
      ["Context switch", s.context_switches, "өөр task руу шилжсэн"],
      ["Throughput", fmt(s.throughput), "task / 100 нэгж"],
    ];
    box.innerHTML = tiles.map(([k, v, u]) =>
      '<div class="tile"><div class="k">' + k + '</div><div class="v">' + v +
      '</div><div class="u">' + u + "</div></div>").join("");
  }

  function renderTable(now) {
    const body = $("metrics").querySelector("tbody");
    const old = $("metrics").querySelector("tfoot");
    if (old) old.remove();
    body.innerHTML = "";
    if (!state.result) return;
    const seg = state.result.timeline.find(g => g.start <= now && now < g.end);
    [...state.result.tasks].sort((a, b) => a.tid - b.tid).forEach(t => {
      const tr = document.createElement("tr");
      if (t.completion <= now) tr.className = "done";
      if (seg && seg.tid === t.tid) tr.className = "running";
      [t.name, t.priority, t.burst, t.arrival, t.start, t.completion,
        t.turnaround, t.waiting, t.response].forEach(v => {
        const td = document.createElement("td");
        td.textContent = v;
        tr.appendChild(td);
      });
      body.appendChild(tr);
    });
    const s = state.result.summary;
    const foot = document.createElement("tfoot");
    foot.innerHTML = '<tr><td colspan="6">Дундаж</td><td>' + fmt(s.avg_turnaround) +
      "</td><td>" + fmt(s.avg_waiting) + "</td><td>" + fmt(s.avg_response) + "</td></tr>";
    $("metrics").appendChild(foot);
  }

  function render() {
    const now = Math.floor(state.time);
    $("time").value = now;
    $("time-now").textContent = now;
    ["btn-start", "btn-prev", "btn-play", "btn-next", "btn-end", "time"]
      .forEach(id => { $(id).disabled = !state.result; });
    Gantt.render($("gantt"), state.result, now);
    Gantt.renderLegend($("legend"), state.result);
    renderState(now);
    renderSummary();
    renderTable(now);
  }

  /* ---------------- presets, files, random ---------------- */

  function loadPreset(id) {
    const p = PRESETS.find(x => x.id === id) || PRESETS[0];
    $("tasks").value = p.text;
  }

  function randomTasks() {
    const n = Math.min(50, Math.max(1, parseInt($("rand-n").value, 10) || 6));
    const maxB = Math.min(1000, Math.max(1, parseInt($("rand-burst").value, 10) || 30));
    const maxA = Math.min(1000, Math.max(0, parseInt($("rand-arr").value, 10) || 0));
    const r = k => Math.floor(Math.random() * k);
    const lines = ["# random: " + n + " tasks"];
    for (let i = 1; i <= n; i++) {
      const fields = ["T" + i, 1 + r(10), 1 + r(maxB)];
      if (maxA > 0) fields.push(r(maxA + 1));
      lines.push(fields.join(", "));
    }
    $("tasks").value = lines.join("\n") + "\n";
  }

  function download() {
    const blob = new Blob([$("tasks").value], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "schedule.txt";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  function readFile(input, cb) {
    const f = input.files && input.files[0];
    if (!f) return;
    if (f.size > 200000) { showMessage("Файл хэт том байна (200 KB-аас их)."); return; }
    const reader = new FileReader();
    reader.onload = () => cb(String(reader.result), f.name);
    reader.onerror = () => showMessage("Файлыг уншиж чадсангүй.");
    reader.readAsText(f);
    input.value = "";
  }

  function reset() {
    clearResult();
    $("algorithm").value = "fcfs";
    $("quantum").value = 10;
    updateQuantumField();
    loadPreset($("preset").value);
    showMessage("");
  }

  /* ---------------- start-up ---------------- */

  async function checkBackend() {
    const s = await Api.status();
    const badge = $("backend");
    state.backend = s.ok;
    if (s.ok) {
      const missing = Object.keys(s.algorithms).filter(k => !s.algorithms[k]);
      badge.className = "badge badge-ok";
      badge.textContent = "C backend холбогдсон";
      if (missing.length)
        showMessage("Build хийгдээгүй: " + missing.join(", ") + " — терминалд `make` ажиллуулна уу.", "warning");
    } else {
      badge.className = "badge badge-off";
      badge.textContent = "Backend алга — JSON үр дүн ачаалж үзэх боломжтой";
      showMessage("C програмтай холбогдоогүй байна. Төслийн хавтаст `make ui` ажиллуулаад " +
        "http://localhost:8000 хаягаар нээнэ үү. Эсвэл `./rr -j -q 10 schedule.txt > result.json` " +
        "гаргаж “JSON үр дүн ачаалах” товчоор нээж болно.", "warning");
    }
    setBusy(false);
  }

  function init() {
    const sel = $("preset");
    PRESETS.forEach(p => {
      const o = document.createElement("option");
      o.value = p.id;
      o.textContent = p.name;
      sel.appendChild(o);
    });
    loadPreset(PRESETS[0].id);
    updateQuantumField();

    sel.addEventListener("change", () => loadPreset(sel.value));
    $("algorithm").addEventListener("change", updateQuantumField);
    $("btn-run").addEventListener("click", runSelected);
    $("btn-compare").addEventListener("click", runCompare);
    $("btn-reset").addEventListener("click", reset);
    $("btn-random").addEventListener("click", randomTasks);
    $("btn-download").addEventListener("click", download);
    $("file-tasks").addEventListener("change", e =>
      readFile(e.target, text => { $("tasks").value = text; showMessage(""); }));
    $("file-json").addEventListener("change", e =>
      readFile(e.target, (text, name) => {
        try {
          const r = Api.validateResult(JSON.parse(text));
          r.command = "(" + name + " файлаас ачаалсан)";
          Compare.hide();
          loadResult(r, true);
        } catch (err) {
          showMessage("JSON файл буруу: " + err.message);
        }
      }));

    $("btn-play").addEventListener("click", () => (state.playing ? stop() : play()));
    $("btn-start").addEventListener("click", () => seek(0));
    $("btn-end").addEventListener("click", () => seek(total()));
    $("btn-prev").addEventListener("click", () => jump(-1));
    $("btn-next").addEventListener("click", () => jump(1));
    $("time").addEventListener("input", e => seek(+e.target.value));

    document.addEventListener("keydown", e => {
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || !state.result) return;
      const keys = { " ": () => (state.playing ? stop() : play()),
        ArrowRight: () => jump(1), ArrowLeft: () => jump(-1),
        Home: () => seek(0), End: () => seek(total()) };
      if (keys[e.key]) { e.preventDefault(); keys[e.key](); }
    });

    let timer;
    window.addEventListener("resize", () => {
      clearTimeout(timer);
      timer = setTimeout(render, 120);
    });

    render();
    setBusy(true);
    checkBackend();
  }

  init();
})();
