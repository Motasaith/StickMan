// Bringing files in: upload to the media library, then (optionally) onto the canvas at the playhead.

import { toast } from "sonner";
import { api, assetFromUpload } from "@/lib/api";
import { newId, useStore } from "@/store";
import { uniqueId, type Asset } from "@/engine/scene";

const ACCEPT = /\.(mp4|mov|m4v|webm|mkv|png|jpe?g|webp|gif|svg|mp3|wav|m4a|aac|ogg|opus|weba)$/i;
export const ACCEPTED_FILES = "video/*,image/*,audio/*,.svg,.mov,.mkv";

export async function importFiles(files: FileList | File[], opts: { place?: boolean; origin?: string } = {}): Promise<Asset[]> {
  const list = Array.from(files).filter((f) => ACCEPT.test(f.name) || /^(video|image|audio)\//.test(f.type));
  if (!list.length) {
    toast.error("Those files can't be used", { description: "Videos, pictures, sounds and SVG files work." });
    return [];
  }
  const made: Asset[] = [];
  await Promise.all(
    list.map(async (file) => {
      const id = newId();
      useStore.getState().setUpload({ id, name: file.name, progress: 0 });
      try {
        const up = await api.upload(file, file.name, opts.origin ?? "upload", (p) => useStore.getState().setUpload({ id, name: file.name, progress: p }));
        let asset = assetFromUpload(up, file.name);
        if (up.kind === "svg") asset = { ...asset, svg: await (await fetch(up.src)).text() };
        useStore.getState().addAsset(asset);
        made.push(asset);
        useStore.getState().removeUpload(id);
      } catch (err) {
        useStore.getState().setUpload({ id, name: file.name, progress: 1, error: (err as Error).message });
        toast.error(`Couldn't add ${file.name}`, { description: (err as Error).message });
        setTimeout(() => useStore.getState().removeUpload(id), 6000);
      }
    })
  );
  if (opts.place) for (const a of made) placeAsset(a);
  return made;
}

/** Put a library item on the canvas at the playhead. */
export function placeAsset(a: Asset) {
  const s = useStore.getState();
  const { width: W, height: H } = s.scene;
  const at = Math.round(s.time * 100) / 100;
  const base = a.name.replace(/[^A-Za-z0-9_-]+/g, "_").slice(0, 20) || a.kind || "media";
  const id = uniqueId(s.scene, base);
  if (a.kind === "video") {
    s.run([{ op: "video", id, asset: a.id, start: at, fit: "cover" }]);
  } else if (a.kind === "audio") {
    s.run([{ op: "audio", id, asset: a.id, start: at, role: a.origin === "recording" ? "voiceover" : "sound" }]);
  } else if (a.kind === "svg") {
    const w = Math.min(W, H) * 0.45;
    const next = structuredClone(s.scene);
    next.objects.push({ id, name: a.name, x: W / 2 - w / 2, y: H / 2 - w / 2, rotation: 0, scale: 1, opacity: 1, tracks: at > 0 ? { opacity: [{ t: 0, v: 0 }, { t: at, v: 1, e: "step" }] } : {}, type: "svg", src: `asset:${a.id}`, w, h: w, clock: at, speed: 1, pivot: "center" });
    s.commit(next);
  } else {
    // Big pictures become full-frame; small ones sit in the middle.
    const big = a.w >= W * 0.8 || a.h >= H * 0.8;
    const k = big ? Math.max(W / a.w, H / a.h) : Math.min((W * 0.45) / a.w, (H * 0.6) / a.h, 1);
    const w = a.w * k;
    const h = a.h * k;
    s.run([{ op: "image", id, asset: a.id, x: W / 2 - w / 2, y: H / 2 - h / 2, w, h, at: at || undefined }]);
  }
  useStore.getState().select(id);
}
