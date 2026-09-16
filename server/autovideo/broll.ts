// The AI Director's "broll" op: new Pexels footage for a scene of an AI video. The server
// fetches it before the plan is applied and turns the op into shot swaps.

import { downloadStock, searchStock, stockConfigured, type StockItem } from "../stock";
import { importMedia } from "../media";
import { assetFromInfo } from "./stock";
import type { Asset, Scene } from "../../src/engine/scene";

type AnyOp = Record<string, unknown> & { op?: string };

const MAX_BROLL_OPS = 6;

export interface BrollCache {
  searches: Map<string, Promise<StockItem[]>>;
  imports: Map<string, Promise<Asset | null>>;
}

export const newBrollCache = (): BrollCache => ({ searches: new Map(), imports: new Map() });

export async function fillBroll(rawOps: unknown[], scene: Scene, cache: BrollCache): Promise<{ ops: unknown[]; assets: Asset[]; notes: string[] }> {
  const ops = rawOps as AnyOp[];
  const wanted = ops.filter((o) => o && o.op === "broll").slice(0, MAX_BROLL_OPS);
  if (!wanted.length) return { ops: rawOps, assets: [], notes: [] };
  const notes: string[] = [];
  if (!stockConfigured()) {
    return { ops: ops.filter((o) => o?.op !== "broll"), assets: [], notes: ["New footage needs PEXELS_API_KEY in .env."] };
  }
  const orientation = scene.height > scene.width ? "portrait" : "landscape";
  const assets: Asset[] = [];
  const out: AnyOp[] = [];

  for (const op of ops) {
    if (op?.op !== "broll") {
      out.push(op);
      continue;
    }
    if (!wanted.includes(op)) continue;
    const slide = String(op.slide);
    const targets = op.replace
      ? scene.objects.filter((o) => o.id === op.replace && (o.type === "video" || o.type === "image"))
      : scene.objects.filter((o) => o.slide === slide && (o.type === "video" || o.type === "image"));
    if (!targets.length) {
      notes.push(`Scene ${slide} has no footage shots to replace.`);
      continue;
    }
    const kind = op.kind === "photo" ? "image" : "video";
    const query = String(op.query);
    const key = `${kind}:${orientation}:${query.toLowerCase()}`;
    if (!cache.searches.has(key)) cache.searches.set(key, searchStock(query, kind, orientation, 15, 1280).catch(() => []));
    const found = (await cache.searches.get(key)!).filter((i) => i.kind === "image" || (i.duration ?? 0) >= 3).slice(0, Math.min(3, targets.length));
    if (!found.length) {
      notes.push(`No Pexels footage matched "${query}".`);
      continue;
    }
    const got = await Promise.all(
      found.map((item) => {
        if (!cache.imports.has(item.id)) {
          cache.imports.set(
            item.id,
            downloadStock(item.src)
              .then((bytes) => importMedia(bytes, `${query.slice(0, 36)}${item.kind === "video" ? ".mp4" : ".jpg"}`, { origin: "stock", credit: item.credit }))
              .then((info) => assetFromInfo(info, query))
              .catch(() => null)
          );
        }
        return cache.imports.get(item.id)!;
      })
    );
    const ready = got.filter((a): a is Asset => !!a);
    if (!ready.length) {
      notes.push(`Couldn't download footage for "${query}".`);
      continue;
    }
    for (const a of ready) if (!assets.some((x) => x.id === a.id)) assets.push(a);
    targets.forEach((t, i) => out.push({ op: "swapShot", id: t.id, asset: ready[i % ready.length].id }));
  }
  return { ops: out, assets, notes };
}
