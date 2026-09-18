// Browser regression for local API settings and sound-only controls. Uses isolated app data.
// Usage: node scripts/settings-ui.mjs <outDir>
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import puppeteer from "puppeteer-core";
import { createServer } from "node:http";

const out = resolve(process.argv[2] ?? "settings-ui-out");
const dataDir = join(out, "data");
mkdirSync(out, { recursive: true });
const base = "http://localhost:5180";
const server = spawn(process.execPath, ["node_modules/vite/bin/vite.js", "--port", "5180", "--strictPort"], {
  env: { ...process.env, STICKMAN_DATA_DIR: dataDir, LLM_API_KEY: "", PEXELS_API_KEY: "", YOUTUBE_API_KEY: "", HF_TOKEN: "", POLLINATIONS_API_KEY: "", LLM_BASE_URL: "", LLM_MODEL: "", VISION_LLM_MODEL: "" },
  stdio: "pipe", windowsHide: true,
});
let modelRequests = 0;
const provider = createServer((req, res) => {
  if (req.url !== "/v1/chat/completions" || req.headers.authorization !== "Bearer browser-test-secret") { res.writeHead(401); res.end("Invalid test request"); return; }
  modelRequests++;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify({ choices: [{ message: { content: "OK" } }] }));
});
await new Promise((done) => provider.listen(0, "127.0.0.1", done));
const providerUrl = `http://127.0.0.1:${provider.address().port}/v1`;
let browser;
try {
  let ready = false;
  for (let i = 0; i < 60; i++) {
    if (server.exitCode !== null) throw new Error("Test server exited");
    try { ready = (await fetch(base)).ok; } catch {}
    if (ready) break;
    await new Promise((r) => setTimeout(r, 500));
  }
  assert(ready, "Test server did not start");
  console.log("Server ready; launching browser");
  const executablePath = ["C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"].find(existsSync);
  browser = await puppeteer.launch({ executablePath, headless: true, timeout: 60000, args: ["--no-sandbox", "--disable-gpu"], defaultViewport: { width: 1440, height: 1000 } });
  console.log("Browser ready");
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(base, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.click('nav a[href="/settings"]');
  await page.waitForSelector("#LLM_API_KEY");
  await page.type("#LLM_API_KEY", "browser-test-secret");
  await page.type("#PEXELS_API_KEY", "browser-test-stock");
  await page.type("#LLM_BASE_URL", providerUrl);
  await page.click('[data-test-key="LLM_API_KEY"]');
  await page.waitForFunction(() => document.querySelector('[data-test-result="LLM_API_KEY"]')?.textContent.includes("Success:"));
  assert.equal(modelRequests, 1);
  assert(!existsSync(join(dataDir, "settings.json")), "Testing must not save settings");
  await page.click('button[type="submit"]');
  await page.waitForFunction(() => [...document.querySelectorAll('[role="status"]')].some((el) => el.textContent.includes("Settings saved")));
  const response = await fetch(`${base}/api/settings`);
  const body = await response.text();
  assert(!body.includes("browser-test"), "Secrets leaked in response");
  assert.equal(JSON.parse(readFileSync(join(dataDir, "settings.json"), "utf8")).PEXELS_API_KEY, "browser-test-stock");
  await page.reload({ waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForSelector("#PEXELS_API_KEY");
  assert.equal(await page.$eval("#PEXELS_API_KEY", (el) => el.value), "");
  assert.equal(await page.$eval("#PEXELS_API_KEY", (el) => el.placeholder), "Saved key (hidden)");
  await page.click('[data-test-key="LLM_API_KEY"]');
  await page.waitForFunction(() => document.querySelector('[data-test-result="LLM_API_KEY"]')?.textContent.includes("Success:"));
  assert.equal(modelRequests, 2, "Test must use saved key after reload");
  await page.screenshot({ path: join(out, "settings-desktop.png"), fullPage: true });
  await page.$eval("#PEXELS_API_KEY", (el) => el.parentElement.querySelector("button").click());
  await page.click('button[type="submit"]');
  await page.waitForFunction(() => [...document.querySelectorAll('[role="status"]')].some((el) => el.textContent.includes("Settings saved")));
  const status = await (await fetch(`${base}/api/settings`)).json();
  assert.equal(status.PEXELS_API_KEY.configured, false);
  assert.equal(status.LLM_API_KEY.configured, true);
  await page.click('[data-test-key="PEXELS_API_KEY"]');
  await page.waitForFunction(() => document.querySelector('[data-test-result="PEXELS_API_KEY"]')?.textContent.includes("Enter an API key"));
  assert.equal(await page.$eval('[data-test-result="PEXELS_API_KEY"]', (el) => el.getAttribute("role")), "alert");
  await page.setViewport({ width: 390, height: 844 });
  await page.screenshot({ path: join(out, "settings-mobile.png"), fullPage: true });
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "Settings overflow on mobile");
  await page.goto(`${base}/create`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForSelector('a[href="/settings"]');
  assert(!await page.evaluate(() => document.body.innerText.includes("Background music")));
  await page.setViewport({ width: 1440, height: 1000 });
  await page.goto(base, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForFunction(() => window.__stickman?.useStore.getState().demo);
  await page.evaluate(() => window.__stickman.useStore.getState().setLeftTab("sounds"));
  await page.waitForFunction(() => document.body.textContent.includes("Effects (click to add at the playhead)"));
  assert(!await page.evaluate(() => document.body.innerText.includes("Music and sound effects")));
  assert(await page.evaluate(() => document.body.innerText.includes("Whoosh")));
  await page.evaluate(() => [...document.querySelectorAll("button")].find((b) => b.textContent.includes("AI tools"))?.click());
  await page.waitForFunction(() => document.body.textContent.includes("Restyle the video"));
  assert(!await page.evaluate(() => document.body.textContent.includes("Music finder")));
  assert.deepEqual(errors, []);
  console.log("PASS: draft and saved key tests, inline errors, no test auto-save, navbar, save, reload, secret masking, removal, mobile layout, no music controls, sound effects");
} finally {
  await browser?.close();
  server.kill();
  await new Promise((done) => provider.close(done));
}
