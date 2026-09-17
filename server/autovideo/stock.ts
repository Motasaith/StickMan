// Visuals for a script. Each scene gets a few different clips or pictures that match its
// searches, from the sources the creator chose: Pexels stock, real photos (Wikimedia, NASA,
// Openverse), AI pictures, or a mix. Nothing is used twice in one video.

import { importMedia, mediaUrl, type MediaInfo } from "../media";
import { downloadMedia, generateImage, searchMedia, type MediaItem, type SourceId } from "../sources";
import type { ScriptScene, ShotSource } from "../../src/engine/footage";
import type { Asset } from "../../src/engine/scene";

export type VisualMode = "stock" | "ai" | "mix" | "real" | "none";

export interface GatherOptions {
  mode: VisualMode;
  format: "16:9" | "9:16";
  /** Seconds each scene lasts, to know how many different clips it needs. */
  durations: number[];
  shotSeconds: number;
  /** Extra searches when a scene's own find nothing. */
  fallback: string[];
  /** Added to AI picture prompts so they share one look. */
  imageStyle: string;
  /** Science channels also search NASA. */
  space?: boolean;
  onProgress: (stage: "search" | "download", done: number, total: number) => void;
  check: () => void;
}

export function assetFromInfo(info: MediaInfo, name: string): Asset {
  return {
    id: info.id,
    name: name.slice(0, 40) || info.kind,
    src: mediaUrl(info.file),
    w: info.w,
    h: info.h,
    kind: info.kind,
    duration: info.duration,
    hasAudio: info.hasAudio,
    origin: info.origin,
    credit: info.credit,
    filmstrip: info.filmstrip,
    frames: info.frames,
    waveform: info.waveform,
  };
}

async function pool<T>(items: T[], size: number, fn: (item: T, i: number) => Promise<void>) {
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(size, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        await fn(items[i], i);
      }
    })
  );
}

type Pick = { kind: "found"; item: MediaItem } | { kind: "ai"; prompt: string; seed: number };

/** Where to look, in order, for each visual mode. */
function plan(mode: VisualMode, media: ScriptScene["media"], space: boolean): Array<{ source: SourceId; kind: "image" | "video" } | "ai"> {
  const pexels = media === "photo" ? [{ source: "pexels" as const, kind: "image" as const }, { source: "pexels" as const, kind: "video" as const }] : [{ source: "pexels" as const, kind: "video" as const }, { source: "pexels" as const, kind: "image" as const }];
  if (mode === "stock") return pexels;
  if (mode === "ai") return ["ai"];
  if (mode === "mix") return media === "photo" ? ["ai", ...pexels] : [pexels[0], "ai"];
  if (mode === "real") {
    return [
      ...(space ? [{ source: "nasa" as const, kind: "image" as const }] : []),
      { source: "wikimedia" as const, kind: "image" as const },
      { source: "openverse" as const, kind: "image" as const },
      ...pexels,
    ];
  }
  return [];
}

function hashSeed(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return Math.abs(h) % 1_000_000;
}

export async function gatherFootage(scenes: ScriptScene[], o: GatherOptions): Promise<{ shots: ShotSource[][]; assets: Asset[]; credits: string[]; misses: number; notes: string[] }> {
  const orientation = o.format === "9:16" ? "portrait" : "landscape";
  const [W, H] = o.format === "9:16" ? [720, 1280] : [1280, 720];
  const cache = new Map<string, Promise<MediaItem[]>>();
  const failedSources = new Set<string>();
  const notes = new Set<string>();
  const search = (source: SourceId, q: string, kind: "video" | "image") => {
    const key = `${source}:${kind}:${q.toLowerCase()}`;
    if (!cache.has(key)) {
      cache.set(
        key,
        searchMedia(source, q, kind, orientation, 15).catch(() => {
          failedSources.add(source);
          return [];
        })
      );
    }
    return cache.get(key)!;
  };

  // 1. Choose what every scene shows (searches only).
  const used = new Set<string>();
  const picks: Pick[][] = [];
  let misses = 0;
  for (let i = 0; i < scenes.length; i++) {
    o.check();
    const sc = scenes[i];
    if (o.mode === "none") {
      picks.push([]);
      continue;
    }
    // A clip serves about two shots; pictures one or two.
    const want = Math.max(1, Math.min(3, Math.ceil(o.durations[i] / (o.shotSeconds * 1.6))));
    const chosen: Pick[] = [];
    const queries = sc.visuals.length ? sc.visuals : o.fallback.slice(0, 1);
    for (const step of plan(o.mode, sc.media, !!o.space)) {
      if (chosen.length >= want) break;
      if (step === "ai") {
        // One picture per search, then variations of the first.
        for (let k = chosen.length; k < want; k++) {
          const q = queries[k % queries.length];
          chosen.push({ kind: "ai", prompt: `${q}, ${o.imageStyle}, no text, no watermark`, seed: hashSeed(`${sc.narration}|${k}`) });
        }
        break;
      }
      const fill = async (qs: string[]) => {
        for (const q of qs) {
          for (const item of (await search(step.source, q, step.kind)).slice(0, 6)) {
            if (chosen.length >= want) return;
            if (used.has(item.id) || (item.kind === "video" && (item.duration ?? 0) < 3)) continue;
            used.add(item.id);
            chosen.push({ kind: "found", item });
            break;
          }
        }
      };
      await fill(queries);
      if (chosen.length < want) await fill(queries);
      // The channel's general footage only when the scene's own searches found nothing.
      if (!chosen.length && step.source === "pexels") await fill(o.fallback);
    }
    if (!chosen.length) misses++;
    picks.push(chosen);
    o.onProgress("search", i + 1, scenes.length);
  }
  if (failedSources.has("wikimedia")) notes.add("Wikimedia didn't answer, so other sources were used for those scenes.");

  // 2. Download or generate them.
  const flat = picks.flatMap((list, i) => list.map((pick, k) => ({ pick, scene: i, key: `${i}:${k}` })));
  const ready = new Map<string, { info: MediaInfo; name: string; credit: string }>();
  let done = 0;
  let watermark = false;
  await pool(flat, 3, async ({ pick, scene, key }) => {
    o.check();
    const name = `${scenes[scene].visuals[0] ?? "visual"}`.replace(/[^\w\- ]+/g, "").slice(0, 36) || "visual";
    try {
      if (pick.kind === "found") {
        const bytes = await downloadMedia(pick.item.src);
        const ext = pick.item.kind === "video" ? ".mp4" : /\.png(\?|$)/i.test(pick.item.src) ? ".png" : ".jpg";
        const info = await importMedia(bytes, `${name}${ext}`, { origin: pick.item.source === "pexels" ? "stock" : pick.item.source, credit: pick.item.credit });
        ready.set(key, { info, name, credit: pick.item.credit });
      } else {
        const img = await generateImage(pick.prompt, W, H, pick.seed);
        watermark ||= img.watermark;
        const info = await importMedia(img.bytes, `${name}.jpg`, { origin: "ai", credit: img.credit });
        ready.set(key, { info, name: `AI: ${name}`, credit: img.credit });
      }
    } catch (err) {
      console.warn(`[footage] ${pick.kind === "ai" ? "AI picture" : pick.item.src.slice(0, 120)}: ${(err as Error).message}`);
      notes.add(pick.kind === "ai" ? `Some AI pictures failed (${(err as Error).message}).` : `A few downloads failed (${(err as Error).message}); those scenes use fewer shots.`);
    }
    o.onProgress("download", ++done, flat.length);
  });
  if (watermark) notes.add("AI pictures from the free Pollinations service carry a small watermark. Add a free HF_TOKEN or POLLINATIONS_API_KEY to .env to remove it.");

  const assets: Asset[] = [];
  const credits = new Set<string>();
  const shots = picks.map((list, i) =>
    list.flatMap((_, k): ShotSource[] => {
      const got = ready.get(`${i}:${k}`);
      if (!got) return [];
      if (!assets.some((a) => a.id === got.info.id)) assets.push(assetFromInfo(got.info, got.name));
      credits.add(got.credit);
      return [{ asset: got.info.id, kind: got.info.kind === "video" ? "video" : "image", w: got.info.w, h: got.info.h, duration: got.info.duration ?? 0, name: got.name }];
    })
  );
  misses += shots.filter((s, i) => !s.length && picks[i].length).length;
  // A scene left empty borrows the nearest scene's footage rather than showing a plain background.
  const filled = shots.map((s) => s.slice());
  let borrowed = 0;
  shots.forEach((s, i) => {
    if (s.length) return;
    for (let d = 1; d < shots.length; d++) {
      const near = shots[i - d]?.length ? shots[i - d] : shots[i + d]?.length ? shots[i + d] : null;
      if (near) {
        filled[i] = [...near].reverse();
        borrowed++;
        break;
      }
    }
  });
  if (borrowed) {
    notes.add(`${borrowed} scene${borrowed > 1 ? "s" : ""} reuse footage from a neighbouring scene; swap it from the Stock tab or ask the AI Director for new b-roll.`);
    misses = 0;
  }
  return {
    shots: filled,
    assets,
    credits: [...credits],
    misses,
    notes: [...notes],
  };
}
