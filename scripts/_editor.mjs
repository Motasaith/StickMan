// Shared by the browser checks: make a fresh project and open it in the editor.
export async function openEditor(page, { kind = "animation", title = "Check" } = {}) {
  await page.goto("http://localhost:5178", { waitUntil: "load" });
  const id = await page.evaluate(async (body) => {
    const { emptyScene } = await import("/src/engine/scene.ts");
    const res = await fetch("/api/projects", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...body, scene: emptyScene(), assets: [] }) });
    return (await res.json()).id;
  }, { kind, title });
  await page.goto(`http://localhost:5178/editor/${id}`, { waitUntil: "load" });
  await page.waitForFunction(() => window.__stickman && document.querySelector("main canvas") && window.__stickman.useStore.getState().projectId, { timeout: 30000 });
  return id;
}
