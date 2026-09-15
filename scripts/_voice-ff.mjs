import puppeteer from "puppeteer-core";
const which = process.argv[2] ?? "firefox";
const browser = await puppeteer.launch(which === "firefox"
  ? { browser: "firefox", executablePath: "C:/Program Files/Mozilla Firefox/firefox.exe", headless: true, defaultViewport: { width: 1500, height: 900 } }
  : { executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true, defaultViewport: { width: 1500, height: 900 } });
const page = await browser.newPage();
await page.goto("http://localhost:5178", { waitUntil: "load" });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: "load" });
await page.waitForFunction(() => window.__stickman, { timeout: 20000 });
const made = await page.evaluate(async () => {
  const { useStore, generateVoices } = window.__stickman;
  useStore.getState().run([{ op: "character", id: "bob", x: 400 }, { op: "say", character: "bob", text: "Hello, can you hear me?", at: 0.3 }]);
  const r = await generateVoices();
  const b = useStore.getState().scene.objects.find((o) => o.type === "bubble");
  return { report: r, audio: b.audio ? { at: b.audio.at, dur: b.audio.duration } : null };
});
console.log(which, "voices:", JSON.stringify(made));
await page.click(".transport .primary");
for (const wait of [300, 900]) {
  await new Promise((r) => setTimeout(r, wait));
  console.log(which, "after play:", JSON.stringify(await page.evaluate(() => ({ ...window.__stickman.audioDebug(), time: window.__stickman.useStore.getState().time.toFixed(2) }))));
}
await browser.close();
