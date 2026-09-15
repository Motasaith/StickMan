import type { Asset } from "./engine/scene";
import type { ImageLookup } from "./engine/render";
import { useStore } from "./store";

const cache = new Map<string, HTMLImageElement>();

export function imageLookup(assets: Asset[]): ImageLookup {
  return (assetId) => {
    const asset = assets.find((a) => a.id === assetId);
    if (!asset) return undefined;
    let img = cache.get(asset.id);
    if (!img || img.src !== asset.src) {
      img = new Image();
      img.onload = () => useStore.getState().bumpImages();
      img.src = asset.src;
      cache.set(asset.id, img);
    }
    return img.complete && img.naturalWidth ? img : undefined;
  };
}

/** Wait until every picture has loaded (export must not miss any). */
export async function preloadImages(assets: Asset[]): Promise<ImageLookup> {
  const lookup = imageLookup(assets);
  await Promise.all(
    assets.map((a) => {
      lookup(a.id);
      const img = cache.get(a.id)!;
      return img.complete ? Promise.resolve() : new Promise<void>((r) => ((img.onload = () => r()), (img.onerror = () => r())));
    })
  );
  return lookup;
}

/** Read a picture file, shrink it if huge, and make an asset from it. */
export async function fileToAsset(file: File, existing: Asset[]): Promise<Asset> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = () => reject(new Error("That file is not a picture this browser can open."));
    i.src = dataUrl;
  });
  let src = dataUrl;
  let w = img.naturalWidth;
  let h = img.naturalHeight;
  const max = 1600;
  if (Math.max(w, h) > max) {
    const s = max / Math.max(w, h);
    w = Math.round(w * s);
    h = Math.round(h * s);
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    c.getContext("2d")!.drawImage(img, 0, 0, w, h);
    src = c.toDataURL(file.type === "image/jpeg" ? "image/jpeg" : "image/png", 0.9);
  }
  const base = file.name.replace(/\.[^.]+$/, "").replace(/[^\w -]/g, "").trim().slice(0, 30) || "picture";
  let name = base;
  for (let i = 2; existing.some((a) => a.name.toLowerCase() === name.toLowerCase()); i++) name = `${base} ${i}`;
  return { id: `asset_${Math.random().toString(36).slice(2, 9)}`, name, src, w, h };
}
