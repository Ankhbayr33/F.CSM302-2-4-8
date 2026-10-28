#!/usr/bin/env python3
"""
server.py - connects the Gantt-chart web UI to the real C schedulers.

The browser sends the task list (schedule-file text), the algorithm and the
time quantum. The server writes the text to a temporary file, runs the
compiled executable (./fcfs, ./sjf, ./priority, ./rr, ./priority_rr) with
the -j option and returns the JSON the C program printed. All scheduling is
done by the C code; the UI only draws the result.

Usage:  python3 ui/server.py [--port 8000]
Needs only the Python standard library (3.8+).
"""
import argparse
import json
import os
import subprocess
import sys
import tempfile
import webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

UI_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.dirname(UI_DIR)

# algorithm id -> executable name (built by `make`)
ALGORITHMS = ["fcfs", "sjf", "priority", "rr", "priority_rr"]
MAX_BODY = 200_000          # bytes
RUN_TIMEOUT = 10            # seconds

STATIC_TYPES = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
}


def executable(alg):
    """Path of the compiled scheduler, or None if it was not built."""
    for name in (alg, alg + ".exe"):
        path = os.path.join(ROOT_DIR, name)
        if os.path.isfile(path):
            return path
    return None


def run_scheduler(alg, quantum, tasks_text):
    """Run one C scheduler and return its parsed JSON result."""
    if alg not in ALGORITHMS:
        return {"error": f"unknown algorithm '{alg}'"}
    exe = executable(alg)
    if exe is None:
        return {"error": f"executable '{alg}' not found - run `make` first"}

    fd, path = tempfile.mkstemp(prefix="schedule_", suffix=".txt")
    try:
        with os.fdopen(fd, "w", encoding="utf-8", newline="\n") as f:
            f.write(tasks_text)
        cmd = [exe, "-j", "-q", str(quantum), path]
        if alg in ("fcfs", "sjf", "priority"):
            cmd = [exe, "-j", path]          # quantum not used
        proc = subprocess.run(cmd, capture_output=True, text=True,
                              timeout=RUN_TIMEOUT)
    except subprocess.TimeoutExpired:
        return {"error": f"{alg} did not finish within {RUN_TIMEOUT} s"}
    finally:
        try:
            os.remove(path)
        except OSError:
            pass

    out = proc.stdout.strip()
    try:
        result = json.loads(out) if out else {}
    except json.JSONDecodeError:
        return {"error": "invalid output from scheduler", "stdout": out[:500],
                "stderr": proc.stderr[:500]}
    if proc.returncode != 0 and "error" not in result:
        result["error"] = proc.stderr.strip() or f"exit code {proc.returncode}"
    result["command"] = (f"./{alg}"
                         + (f" -q {quantum}" if alg in ("rr", "priority_rr")
                            else "")
                         + " schedule.txt")
    return result


class Handler(BaseHTTPRequestHandler):
    server_version = "SchedulerUI/1.0"

    def log_message(self, fmt, *args):          # quieter console
        sys.stderr.write("[ui] " + (fmt % args) + "\n")

    def send_json(self, obj, status=200):
        body = json.dumps(obj).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        path = self.path.split("?", 1)[0]
        if path == "/api/status":
            self.send_json({"backend": "c",
                            "algorithms": {a: executable(a) is not None
                                           for a in ALGORITHMS}})
            return
        if path == "/":
            path = "/index.html"
        name = os.path.basename(path)
        ext = os.path.splitext(name)[1]
        file_path = os.path.join(UI_DIR, name)
        if ext not in STATIC_TYPES or not os.path.isfile(file_path):
            self.send_error(404)
            return
        with open(file_path, "rb") as f:
            data = f.read()
        self.send_response(200)
        self.send_header("Content-Type", STATIC_TYPES[ext])
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_POST(self):
        length = int(self.headers.get("Content-Length") or 0)
        if length <= 0 or length > MAX_BODY:
            self.send_json({"error": "request body missing or too large"},
                           400)
            return
        try:
            req = json.loads(self.rfile.read(length).decode("utf-8"))
            tasks = str(req.get("tasks", ""))
            quantum = int(req.get("quantum", 10))
        except (ValueError, TypeError, json.JSONDecodeError):
            self.send_json({"error": "malformed request"}, 400)
            return

        if self.path == "/api/run":
            self.send_json(run_scheduler(str(req.get("algorithm")), quantum,
                                         tasks))
        elif self.path == "/api/compare":
            self.send_json({"results": [run_scheduler(a, quantum, tasks)
                                        for a in ALGORITHMS]})
        else:
            self.send_error(404)


def main():
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[1])
    parser.add_argument("--port", type=int, default=8000)
    parser.add_argument("--no-browser", action="store_true",
                        help="do not open the browser automatically")
    args = parser.parse_args()

    missing = [a for a in ALGORITHMS if executable(a) is None]
    if missing:
        print("warning: not built yet: " + ", ".join(missing)
              + "  (run `make` in " + ROOT_DIR + ")")

    url = f"http://localhost:{args.port}/"
    try:
        httpd = ThreadingHTTPServer(("127.0.0.1", args.port), Handler)
    except OSError as e:
        sys.exit(f"error: cannot listen on port {args.port}: {e}. "
                 f"Try --port {args.port + 1}")
    print(f"Scheduler UI running at {url}  (Ctrl+C to stop)")
    if not args.no_browser:
        try:
            webbrowser.open(url)
        except Exception:
            pass
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nstopped")


if __name__ == "__main__":
    main()
