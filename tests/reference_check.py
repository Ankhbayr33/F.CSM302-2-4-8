#!/usr/bin/env python3
"""
reference_check.py - checks the C schedulers against an independent
Python implementation on many random task sets.

For every random task set and every algorithm the C program is run with
-j (JSON output) and its timeline and per-task metrics are compared with
the result computed here. Any difference is printed and the script exits
with status 1.

Usage: python3 tests/reference_check.py [--cases 300] [--seed 1]
"""
import argparse
import json
import os
import random
import subprocess
import sys
import tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ALGS = ["fcfs", "sjf", "priority", "rr", "priority_rr"]


# --------------------------------------------------------------------
# reference implementation (same rules as the textbook project)
# tasks: list of dicts name, priority, burst, arrival, tid (input order)
# returns timeline [(tid or -1, start, end), ...]
# --------------------------------------------------------------------
def fcfs_key(t):
    return (t["arrival"], t["tid"])


def non_preemptive(tasks, better):
    """FCFS / SJF / Priority: pick best arrived task, run whole burst."""
    left = list(tasks)
    now, timeline = 0, []
    while left:
        ready = [t for t in left if t["arrival"] <= now]
        if not ready:
            nxt = min(t["arrival"] for t in left)
            timeline.append((-1, now, nxt))
            now = nxt
            continue
        t = min(ready, key=better)
        timeline.append((t["tid"], now, now + t["burst"]))
        now += t["burst"]
        left.remove(t)
    return timeline


def round_robin(tasks, q, by_priority):
    pending = sorted(tasks, key=fcfs_key)
    queues = {}                          # level -> FIFO list
    remaining = {t["tid"]: t["burst"] for t in tasks}
    now, timeline = 0, []

    def level(t):
        return t["priority"] if by_priority else 0

    def admit():
        while pending and pending[0]["arrival"] <= now:
            t = pending.pop(0)
            queues.setdefault(level(t), []).append(t)

    admit()
    while pending or any(queues.values()):
        levels = [lv for lv, qu in queues.items() if qu]
        if not levels:
            nxt = pending[0]["arrival"]
            timeline.append((-1, now, nxt))
            now = nxt
            admit()
            continue
        t = queues[max(levels)].pop(0)
        s = min(q, remaining[t["tid"]])
        timeline.append((t["tid"], now, now + s))
        now += s
        remaining[t["tid"]] -= s
        admit()
        if remaining[t["tid"]] > 0:
            queues[level(t)].append(t)
    return timeline


def reference(alg, tasks, q):
    if alg == "fcfs":
        return non_preemptive(tasks, fcfs_key)
    if alg == "sjf":
        return non_preemptive(tasks, lambda t: (t["burst"],) + fcfs_key(t))
    if alg == "priority":
        return non_preemptive(tasks, lambda t: (-t["priority"],) + fcfs_key(t))
    if alg == "rr":
        return round_robin(tasks, q, False)
    return round_robin(tasks, q, True)


def metrics(tasks, timeline):
    out = {}
    for t in tasks:
        segs = [s for s in timeline if s[0] == t["tid"]]
        start, done = segs[0][1], segs[-1][2]
        out[t["tid"]] = {
            "start": start, "completion": done,
            "turnaround": done - t["arrival"],
            "waiting": done - t["arrival"] - t["burst"],
            "response": start - t["arrival"],
        }
    return out


# --------------------------------------------------------------------
def random_tasks(rng):
    n = rng.randint(1, 12)
    with_arrival = rng.random() < 0.6
    tasks = []
    for i in range(n):
        tasks.append({
            "name": f"T{i + 1}", "tid": i,
            "priority": rng.randint(1, 10),
            "burst": rng.randint(1, 40),
            "arrival": rng.randint(0, 60) if with_arrival else 0,
        })
    return tasks


def run_c(alg, tasks, q):
    exe = os.path.join(ROOT, alg + (".exe" if os.name == "nt" else ""))
    fd, path = tempfile.mkstemp(suffix=".txt")
    with os.fdopen(fd, "w") as f:
        for t in tasks:
            f.write(f'{t["name"]}, {t["priority"]}, {t["burst"]}, {t["arrival"]}\n')
    try:
        out = subprocess.run([exe, "-j", "-q", str(q), path],
                             capture_output=True, text=True, timeout=10)
    finally:
        os.remove(path)
    return json.loads(out.stdout)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--cases", type=int, default=300)
    ap.add_argument("--seed", type=int, default=1)
    args = ap.parse_args()
    rng = random.Random(args.seed)

    for alg in ALGS:
        if not os.path.exists(os.path.join(ROOT, alg)) and \
           not os.path.exists(os.path.join(ROOT, alg + ".exe")):
            sys.exit(f"error: ./{alg} not built - run `make` first")

    failures = 0
    for case in range(args.cases):
        tasks = random_tasks(rng)
        q = rng.choice([1, 3, 4, 5, 10, 20])
        for alg in ALGS:
            res = run_c(alg, tasks, q)
            got_tl = [(s["tid"], s["start"], s["end"]) for s in res["timeline"]]
            exp_tl = reference(alg, tasks, q)
            exp_m = metrics(tasks, exp_tl)
            got_m = {t["tid"]: {k: t[k] for k in exp_m[t["tid"]]}
                     for t in res["tasks"]}
            if got_tl != exp_tl or got_m != exp_m:
                failures += 1
                print(f"MISMATCH case {case} {alg} q={q}")
                print("  tasks:   ", tasks)
                print("  expected:", exp_tl)
                print("  got:     ", got_tl)
                if failures > 5:
                    sys.exit(1)

    total = args.cases * len(ALGS)
    print(f"reference check: {total - failures}/{total} runs match "
          f"({args.cases} random task sets x {len(ALGS)} algorithms)")
    sys.exit(1 if failures else 0)


if __name__ == "__main__":
    main()
