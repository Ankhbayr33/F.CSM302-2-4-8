// ui_test.js - browser test of the Gantt-chart UI (needs Node + Playwright)
//
//   node tests/ui_test.js        (run from the project root after `make`)
//
// Starts ui/server.py on a free port, drives the page in headless Chromium
// and checks the behaviour fixed after peer review IV-2-15:
//   A2  Cyrillic task names are accepted and shown
//   A3  "compare all" still shows the algorithms that succeeded when one fails
//   A4  a wrong quantum left from RR does not block FCFS/SJF/Priority
// plus regressions: a normal comparison, an invalid input, RR quantum check.
// Exit status 0 = all checks passed.
"use strict";
const { spawn } = require("child_process");
const net = require("net");
const path = require("path");
const { chromium } = require("playwright");

const ROOT = path.resolve(__dirname, "..");
const sleep = ms => new Promise(r => setTimeout(r, ms));
let failures = 0;
function check(name, ok, detail) {
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : "  -> " + detail}`);
  if (!ok) failures++;
}

function freePort() {
  return new Promise(res => {
    const s = net.createServer().listen(0, "127.0.0.1", () => {
      const p = s.address().port; s.close(() => res(p));
    });
  });
}

(async () => {
  const port = await freePort();
  const server = spawn("python3", ["ui/server.py", "--no-browser", "--port", String(port)],
    { cwd: ROOT, stdio: "ignore" });
  const browser = await chromium.launch();
  try {
    await sleep(1000);
    const page = await browser.newPage({ viewport: { width: 1320, height: 1000 } });
    const pageErrors = [];
    page.on("pageerror", e => pageErrors.push(e.message));
    await page.goto(`http://127.0.0.1:${port}/`);
    await page.waitForFunction(() => !document.getElementById("btn-run").disabled, null, { timeout: 5000 });
    const message = () => page.$eval("#message", e => (e.hidden ? "" : e.textContent));

    // ---- A4 -------------------------------------------------------------
    await page.selectOption("#algorithm", "rr");
    await page.fill("#quantum", "0");
    await page.selectOption("#algorithm", "fcfs");
    const q = await page.$eval("#quantum", e => ({ v: e.value, d: e.disabled }));
    check("A4 invalid quantum is reset to 10 when RR is left", q.v === "10" && q.d, JSON.stringify(q));
    await page.click("#btn-run");
    await page.waitForFunction(() => document.getElementById("gantt-title").textContent.includes("FCFS"), null, { timeout: 5000 });
    check("A4 FCFS runs after RR had q = 0", (await message()) === "", await message());

    await page.selectOption("#algorithm", "rr");
    for (const bad of ["0", "4.5"]) {
      await page.fill("#quantum", bad);
      await page.click("#btn-run");
      await sleep(300);
      check(`RR still rejects quantum ${bad}`, (await message()).includes("Time quantum"), await message());
    }

    // ---- A3 -------------------------------------------------------------
    await page.fill("#quantum", "1");
    await page.fill("#tasks", "A, 5, 300000\n");
    await page.click("#btn-compare");
    await page.waitForFunction(() => !document.getElementById("compare-panel").hidden, null, { timeout: 15000 });
    const gantts = await page.$$eval("#compare-gantts svg", s => s.length);
    const failedRows = await page.$$eval("#compare-table tr.failed", r => r.map(x => x.textContent));
    check("A3 successful algorithms are still compared", gantts === 3, `mini gantts = ${gantts}`);
    check("A3 failing algorithms are reported one by one",
      failedRows.length === 2 && failedRows.every(t => t.includes("quantum too small")), JSON.stringify(failedRows));
    check("A3 warning names the failed algorithms",
      /RR:/.test(await message()) && /Priority-RR:/.test(await message()), await message());

    // ---- regressions ----------------------------------------------------
    await page.selectOption("#preset", "convoy");
    await page.fill("#quantum", "10");
    await page.click("#btn-compare");
    await sleep(1500);
    check("normal comparison shows all 5 algorithms",
      (await page.$$eval("#compare-gantts svg", s => s.length)) === 5 &&
      (await page.$$eval("#compare-table tr.failed", r => r.length)) === 0, "");

    await page.selectOption("#preset", "invalid");
    await page.click("#btn-compare");
    await sleep(1200);
    check("invalid input gives one error and no comparison",
      (await page.$eval("#compare-panel", e => e.hidden)) && (await message()).includes("priority '11'"), await message());

    // ---- A2 -------------------------------------------------------------
    await page.fill("#tasks", "Процесс1, 4, 20\nӨгөгдөл, 2, 5   # тайлбар\nҮйлдэл, 3, 8, 2\n");
    await page.selectOption("#algorithm", "rr");
    await page.fill("#quantum", "4");
    await page.click("#btn-run");
    await sleep(800);
    const names = await page.$$eval("#metrics tbody tr td:first-child", t => t.map(x => x.textContent));
    check("A2 Cyrillic names and end-of-line comments in the UI",
      names.join(",") === "Процесс1,Өгөгдөл,Үйлдэл", names.join(","));

    check("no JavaScript errors on the page", pageErrors.length === 0, pageErrors.join("; "));
  } finally {
    await browser.close();
    server.kill();
  }
  console.log(failures ? `UI test: ${failures} failed` : "UI test: all passed");
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
