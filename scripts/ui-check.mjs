// Screenshots of the new editing UI: character/animal menu, look panel, puppet setup with AI joints.
// Usage: node scripts/ui-check.mjs <outDir> <characterPicture.png>
import puppeteer from "puppeteer-core";
import { mkdirSync } from "node:fs";
import { join, resolve } from "node:path";

const out = resolve(process.argv[2] ?? "ui-check");
const picture = resolve(process.argv[3]);
mkdirSync(out, { recursive: true });
const browser = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true, defaultViewport: { width: 1600, height: 950 } });
const page = await browser.newPage();
const errors = [];
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
page.on("pageerror", (e) => errors.push(String(e)));
await page.goto("http://localhost:5178", { waitUntil: "networkidle0" });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: "networkidle0" });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const menus = await page.$$("select.menu");
await menus[0].select("cartoon");
await wait(300);
await (await page.$$("select.menu"))[0].select("dog");
await wait(300);
await (await page.$$("select.menu"))[1].select("snow");
await wait(300);
// Select the person from the timeline and dress them.
for (const n of await page.$$(".tl-name")) if ((await n.evaluate((e) => e.textContent)).includes("Person")) await n.click();
await wait(300);
const hatSelect = await page.$$eval(".inspector select", (els) => els.findIndex((s) => [...s.options].some((o) => o.value === "tophat")));
const selects = await page.$$(".inspector select");
await selects[hatSelect].select("tophat");
await wait(400);
await page.screenshot({ path: join(out, "1-person-look.png") });
await page.evaluate(() => document.querySelector(".inspector").scrollTo(0, 99999));
await wait(200);
await page.screenshot({ path: join(out, "2-inspector-bottom.png") });

// Import the character picture and open the puppet setup.
const input = await page.$(".assets input[type=file]");
await input.uploadFile(picture);
await page.waitForSelector(".asset", { timeout: 10000 });
await page.hover(".asset");
await page.click(".asset .puppet");
await page.waitForSelector(".modal", { timeout: 5000 });
const t0 = Date.now();
await page.waitForFunction(() => ![...document.querySelectorAll(".modal .note")].some((n) => n.textContent.includes("Asking the AI")), { timeout: 150000, polling: 500 });
console.log("joint finding took", ((Date.now() - t0) / 1000).toFixed(1), "s:", await page.$$eval(".modal .note", (ns) => ns.map((n) => n.textContent).join(" | ")));
await wait(1200);
await page.screenshot({ path: join(out, "3-puppet-setup.png") });
const buttons = await page.$$(".modal button");
for (const b of buttons) if ((await b.evaluate((e) => e.textContent)).includes("Save & add")) await b.click();
await wait(600);
await page.keyboard.press("Escape");
await page.click(".transport .primary");
await wait(1500);
await page.screenshot({ path: join(out, "4-canvas-playing.png") });
console.log("console errors:", errors.length ? errors : "none");
await browser.close();
