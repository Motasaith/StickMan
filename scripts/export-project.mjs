// Open a saved project in the editor, export it as MP4 and report how long it took.
// Usage: node scripts/export-project.mjs <projectId | latest> <outDir>
import puppeteer from "puppeteer-core";
import { existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

let [id, dir] = process.argv.slice(2);
const out = resolve(dir ?? "export-out");
mkdirSync(out, { recursive: true });
if (!id || id === "latest") {
  const { projects } = await (await fetch("http://localhost:5178/api/projects")).json();
  id = projects.sort((a, b) => b.updatedAt - a.updatedAt)[0].id;
}
const exe = ["C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"].find(existsSync);
const browser = await puppeteer.launch({ executablePath: exe, headless: true, defaultViewport: { width: 1440, height: 900 }, protocolTimeout: 3_600_000 });
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e).slice(0, 300)));
page.on("console", (m) => m.type() === "error" && errors.push(m.text().slice(0, 300)));
const cdp = await page.createCDPSession();
await cdp.send("Browser.setDownloadBehavior", { behavior: "allow", downloadPath: out });
await page.goto(`http://localhost:5178/editor/${id}`, { waitUntil: "networkidle0" });
await page.waitForSelector("main canvas", { timeout: 30_000 });
await new Promise((r) => setTimeout(r, 2000));
const duration = await page.evaluate(() => window.__stickman.useStore.getState().scene.duration);
const t0 = Date.now();
await page.evaluate(() => [...document.querySelectorAll("button")].find((b) => b.textContent.trim() === "Export").click());
await new Promise((r) => setTimeout(r, 800));
await page.evaluate(() => [...document.querySelectorAll("[role=dialog] button")].find((b) => b.textContent.trim() === "Export").click());
let last = "";
for (;;) {
  await new Promise((r) => setTimeout(r, 5000));
  const text = await page.evaluate(() => document.querySelector("[role=dialog]")?.innerText ?? "");
  const line = text.split("\n").find((l) => /%|Saved|failed|Recording|Rendering|Finishing/.test(l)) ?? "";
  if (line !== last) console.log(`[${Math.round((Date.now() - t0) / 1000)}s] ${line}`);
  last = line;
  if (/Saved |failed/.test(text)) break;
}
await new Promise((r) => setTimeout(r, 2000));
const files = readdirSync(out).filter((f) => f.endsWith(".mp4") || f.endsWith(".webm"));
console.log({ project: id, videoSeconds: duration, exportSeconds: Math.round((Date.now() - t0) / 1000), files: files.map((f) => `${f} ${(statSync(join(out, f)).size / 1e6).toFixed(1)} MB`) });
console.log("errors", errors.slice(0, 10));
await browser.close();
