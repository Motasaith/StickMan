// The AI loop in the browser: ask for ops, build the scene step by step so the user
// watches it appear, play it, then let the AI look at rendered frames and fix what it sees.

import { applyOps, type OpResult } from "./engine/ops";
import { renderScene } from "./engine/render";
import { render3D } from "./render3d";
import type { Asset, Scene } from "./engine/scene";
import { canvasPool, preloadImages, preloadSvgs } from "./runtime/media";
import { demoAllows, newId, useStore, type ChatMsg } from "./store";
import { generateVoices, pendingVoices } from "./voice";

const assetInfo = () =>
  useStore
    .getState()
    .assets.filter((a) => a.origin !== "tts")
    .map(({ id, name, w, h, kind, joints, duration, hasAudio }) => ({ id, name, w, h, kind, joints, duration, hasAudio }));

/** Record voices for any new or changed lines, reporting progress in a chat message. */
async function recordVoices(msgId: string, baseText: string) {
  const s = useStore.getState();
  if (!s.voices) return;
  const pending = pendingVoices(s.scene);
  if (!pending) return;
  useStore.getState().updateChat(msgId, { text: `${baseText}\nRecording ${pending} voice line${pending > 1 ? "s" : ""}…` });
  const report = await generateVoices(undefined, (done, total) => useStore.getState().updateChat(msgId, { text: `${baseText}\nRecording voices ${done}/${total}…` }));
  const notes = [
    report.made ? `Voiced ${report.made} line${report.made > 1 ? "s" : ""}.` : "",
    report.failed.length ? `Couldn’t voice ${report.failed.length}: ${report.failed[0]}` : "",
    report.overlaps.length ? `Heads up: ${report.overlaps.join("; ")}.` : "",
  ].filter(Boolean);
  useStore.getState().updateChat(msgId, { text: [baseText, ...notes].join("\n") });
}

interface PlanResponse {
  reply?: string;
  ops?: unknown[];
  skipped?: string[];
  drawn?: string[];
  /** Footage the server downloaded for this plan. */
  assets?: Asset[];
  problems?: string[];
  error?: string;
}

async function post(url: string, body: unknown, signal?: AbortSignal): Promise<PlanResponse> {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal });
  const data = (await res.json().catch(() => ({ error: `Server error ${res.status}` }))) as PlanResponse;
  if (!res.ok || data.error) throw new Error(data.error ?? `Server error ${res.status}`);
  return data;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Apply ops one at a time on screen, then record them as one undo step. */
async function buildUp(ops: unknown[]): Promise<{ results: OpResult[]; changed: boolean }> {
  const store = useStore.getState();
  const base = store.scene;
  const assets = store.assets;
  const delay = Math.max(25, Math.min(140, 2200 / Math.max(1, ops.length)));
  for (let i = 1; i < ops.length; i++) {
    const partial = applyOps(base, ops.slice(0, i), assets);
    if (partial.newAssets.length) useStore.getState().addAssets(partial.newAssets);
    useStore.getState().preview(partial.scene);
    await sleep(delay);
  }
  const final = applyOps(base, ops, assets);
  if (final.newAssets.length) useStore.getState().addAssets(final.newAssets);
  if (final.applied.length) useStore.getState().commit(final.scene, base);
  else useStore.getState().preview(base);
  return { results: final.results, changed: final.applied.length > 0 };
}

export function contactSheetTimes(scene: Scene, count = 6): number[] {
  const d = scene.duration;
  return Array.from({ length: count }, (_, i) => Math.round(((d * (i + 0.5)) / count) * 10) / 10);
}

export async function renderContactSheet(scene: Scene, times: number[]): Promise<string> {
  const assets = useStore.getState().assets;
  const images = await preloadImages(assets);
  const svgs = await preloadSvgs(scene, assets);
  const pool = canvasPool();
  const cols = 2;
  const cellW = 640;
  const cellH = Math.round((cellW * scene.height) / scene.width);
  const rows = Math.ceil(times.length / cols);
  const sheet = document.createElement("canvas");
  sheet.width = cols * cellW;
  sheet.height = rows * cellH;
  const sctx = sheet.getContext("2d")!;
  sctx.fillStyle = "#777";
  sctx.fillRect(0, 0, sheet.width, sheet.height);
  const frame = document.createElement("canvas");
  frame.width = scene.width;
  frame.height = scene.height;
  const fctx = frame.getContext("2d")!;
  times.forEach((t, i) => {
    pool.reset();
    renderScene(fctx, scene, t, { images, svgs, makeCanvas: pool, threeD: render3D });
    const x = (i % cols) * cellW;
    const y = Math.floor(i / cols) * cellH;
    sctx.drawImage(frame, x + 1, y + 1, cellW - 2, cellH - 2);
    sctx.fillStyle = "#d00";
    sctx.font = "bold 20px sans-serif";
    sctx.fillText(`${t.toFixed(1)}s`, x + 8, y + 24);
  });
  return sheet.toDataURL("image/jpeg", 0.82);
}

function historyForAi(chat: ChatMsg[]) {
  return chat
    .filter((m) => !m.pending && !m.error && m.kind !== "review")
    .slice(-8)
    .map((m) => ({ role: m.role, text: m.text.slice(0, 1500) }));
}

export async function askAnimator(prompt: string): Promise<void> {
  const store = useStore.getState();
  if (store.aiBusy || !demoAllows("ai")) return;
  const history = historyForAi(store.chat);
  store.setAiBusy(true);
  store.setPlaying(false);
  store.pushChat({ id: newId(), role: "user", text: prompt });
  const replyId = newId();
  store.pushChat({ id: replyId, role: "assistant", text: "Planning… (new illustrations can take a minute to draw)", pending: true, kind: "plan" });

  try {
    const s = useStore.getState();
    const plan = await post("/api/ai/plan", {
      prompt,
      scene: s.scene,
      assets: assetInfo(),
      time: s.time,
      selectedId: s.selectedId,
      history,
    });
    const ops = plan.ops ?? [];
    if (!ops.length) {
      useStore.getState().updateChat(replyId, { pending: false, text: plan.reply || "I couldn't turn that into changes. Try describing it differently.", error: !plan.reply });
      return;
    }
    useStore.getState().updateChat(replyId, { text: `Building… (${ops.length} steps)` });
    if (plan.assets?.length) useStore.getState().addAssets(plan.assets);
    const built = await buildUp(ops);
    const skipped = plan.skipped?.length ? `\n(${plan.skipped.length} step${plan.skipped.length > 1 ? "s" : ""} skipped as invalid.)` : "";
    const drew = plan.drawn?.length ? `
(Drew new illustrations: ${plan.drawn.join(", ")}.)` : "";
    const replyText = (plan.reply || "Done.") + drew + skipped;
    useStore.getState().updateChat(replyId, { text: replyText, changes: built.results });
    await recordVoices(replyId, replyText);
    useStore.getState().updateChat(replyId, { pending: false });
    useStore.getState().setTime(0);
    useStore.getState().setPlaying(true);

    if (useStore.getState().review && built.changed) await reviewWork(prompt);
  } catch (err) {
    useStore.getState().updateChat(replyId, { pending: false, error: true, text: (err as Error).message });
  } finally {
    useStore.getState().setAiBusy(false);
  }
}

async function reviewWork(prompt: string) {
  const id = newId();
  useStore.getState().pushChat({ id, role: "assistant", text: "Looking at the frames to check my work…", pending: true, kind: "review" });
  try {
    const s = useStore.getState();
    const times = contactSheetTimes(s.scene, 6);
    const sheet = await renderContactSheet(s.scene, times);
    const res = await post("/api/ai/review", {
      prompt,
      scene: s.scene,
      assets: assetInfo(),
      sheet,
      times,
    });
    const problems = res.problems ?? [];
    if (!problems.length || !res.ops?.length) {
      useStore.getState().updateChat(id, {
        pending: false,
        text: problems.length ? `Noticed: ${problems.join(" ")} But I found nothing safe to change.` : "Checked the frames: it looks right.",
      });
      return;
    }
    const built = await buildUp(res.ops);
    const fixedText = `Checked the frames and fixed: ${problems.map((p) => `• ${p}`).join("\n")}${res.reply ? `\n${res.reply}` : ""}\n(Undo removes just these fixes.)`;
    useStore.getState().updateChat(id, { text: fixedText, changes: built.results });
    // A fix can change a line's words; give it its voice back.
    await recordVoices(id, fixedText);
    useStore.getState().updateChat(id, { pending: false });
    useStore.getState().setTime(0);
    useStore.getState().setPlaying(true);
  } catch (err) {
    useStore.getState().updateChat(id, { pending: false, error: true, text: `Couldn't check the frames: ${(err as Error).message}` });
  }
}
