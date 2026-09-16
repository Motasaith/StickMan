// B-roll for a script: for each scene, Pexels clips (or photos) that match its footage searches,
// never the same clip twice in one video, downloaded into the media library.

import { downloadStock, searchStock, type StockItem } from "../stock";
import { importMedia, mediaUrl, type MediaInfo } from "../media";
import type { ScriptScene, ShotSource } from "../../src/engine/footage";
import type { Asset } from "../../src/engine/scene";

export interface GatherOptions {
  format: "16:9" | "9:16";
  /** Seconds each scene lasts, to know how many different clips it needs. */
  durations: number[];
  shotSeconds: number;
  /** Extra searches when a scene's own find nothing. */
  fallback: string[];
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

export async function gatherFootage(scenes: ScriptScene[], o: GatherOptions): Promise<{ shots: ShotSource[][]; assets: Asset[]; credits: string[]; misses: number }> {
  const orientation = o.format === "9:16" ? "portrait" : "landscape";
  const cache = new Map<string, StockItem[]>();
  const search = async (q: string, kind: "video" | "image") => {
    const key = `${kind}:${q.toLowerCase()}`;
    if (!cache.has(key)) cache.set(key, await searchStock(q, kind, orientation, 15, 1280).catch(() => []));
    return cache.get(key)!;
  };

  // 1. Choose clips for every scene (searches only).
  const used = new Set<string>();
  const picks: StockItem[][] = [];
  let misses = 0;
  for (let i = 0; i < scenes.length; i++) {
    o.check();
    const sc = scenes[i];
    const want = Math.max(1, Math.min(3, Math.ceil(o.durations[i] / (o.shotSeconds * 1.6))));
    const chosen: StockItem[] = [];
    const kinds: Array<"video" | "image"> = sc.media === "photo" ? ["image", "video"] : ["video", "image"];
    // Take the best unused results of each search in turn, until the scene has enough.
    const fill = async (queries: string[], kind: "video" | "image") => {
      for (const q of queries) {
        for (const item of (await search(q, kind)).slice(0, 6)) {
          if (chosen.length >= want) return;
          if (used.has(item.id) || (item.kind === "video" && (item.duration ?? 0) < 3)) continue;
          used.add(item.id);
          chosen.push(item);
          break;
        }
      }
    };
    for (const kind of kinds) {
      await fill(sc.visuals, kind);
      if (chosen.length < want) await fill(sc.visuals, kind);
      // The channel's general footage only when the scene's own searches found nothing.
      if (!chosen.length) await fill(o.fallback, kind);
      if (chosen.length) break;
    }
    if (!chosen.length) misses++;
    picks.push(chosen);
    o.onProgress("search", i + 1, scenes.length);
  }

  // 2. Download them, a few at a time.
  const flat = picks.flatMap((list, i) => list.map((item) => ({ item, scene: i })));
  const imported = new Map<string, { info: MediaInfo; name: string }>();
  let done = 0;
  const failed = new Set<string>();
  await pool(flat, 3, async ({ item, scene }) => {
    o.check();
    try {
      const bytes = await downloadStock(item.src);
      const ext = item.kind === "video" ? ".mp4" : ".jpg";
      const name = `${scenes[scene].visuals[0] ?? "stock"}`.replace(/[^\w\- ]+/g, "").slice(0, 36) || "stock";
      const info = await importMedia(bytes, `${name}${ext}`, { origin: "stock", credit: item.credit });
      imported.set(item.id, { info, name });
    } catch {
      failed.add(item.id);
    }
    o.onProgress("download", ++done, flat.length);
  });

  const assets: Asset[] = [];
  const credits = new Set<string>();
  const shots = picks.map((list) =>
    list
      .filter((item) => imported.has(item.id))
      .map((item): ShotSource => {
        const { info, name } = imported.get(item.id)!;
        if (!assets.some((a) => a.id === info.id)) assets.push(assetFromInfo(info, name));
        credits.add(item.credit);
        return { asset: info.id, kind: info.kind === "video" ? "video" : "image", w: info.w, h: info.h, duration: info.duration ?? 0, name };
      })
  );
  return { shots, assets, credits: [...credits], misses: misses + shots.filter((s, i) => !s.length && picks[i].length).length };
}
