/* api.js - talks to ui/server.py, which runs the real C schedulers */
"use strict";

window.Api = (function () {
  const ALGORITHMS = ["fcfs", "sjf", "priority", "rr", "priority_rr"];
  const LABELS = {
    fcfs: "FCFS", sjf: "SJF", priority: "Priority",
    rr: "RR", priority_rr: "Priority-RR",
  };

  async function post(url, body) {
    let res;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } catch (e) {
      throw new Error("Backend-тэй холбогдож чадсангүй. Терминалд `make ui` " +
        "(эсвэл `python3 ui/server.py`) ажиллуулсан эсэхээ шалгана уу.");
    }
    if (!res.ok) throw new Error("Сервер алдаа буцаалаа: HTTP " + res.status);
    return res.json();
  }

  /* resolves to {ok, algorithms} or {ok:false} */
  async function status() {
    if (location.protocol === "file:") return { ok: false, reason: "file" };
    try {
      const res = await fetch("/api/status", { cache: "no-store" });
      if (!res.ok) return { ok: false };
      const data = await res.json();
      return { ok: true, algorithms: data.algorithms };
    } catch (e) {
      return { ok: false };
    }
  }

  function run(algorithm, quantum, tasks) {
    return post("/api/run", { algorithm, quantum, tasks });
  }

  function compare(quantum, tasks) {
    return post("/api/compare", { quantum, tasks });
  }

  /* make sure an object looks like the JSON printed by `-j` */
  function validateResult(r) {
    if (!r || typeof r !== "object") throw new Error("JSON обьект биш байна");
    if (r.error) throw new Error(r.error);
    for (const key of ["algorithm", "tasks", "timeline", "summary"])
      if (!(key in r)) throw new Error("JSON-д '" + key + "' талбар алга");
    if (!Array.isArray(r.tasks) || !Array.isArray(r.timeline))
      throw new Error("tasks / timeline массив биш байна");
    return r;
  }

  return { ALGORITHMS, LABELS, status, run, compare, validateResult };
})();
