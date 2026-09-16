// Media for the browser renderer: SVG markup (stickers, library illustrations, drawn assets),
// video frames kept in step with the timeline, pictures, and scratch canvases for effects.

import type { Asset, Scene, VideoObj } from "@/engine/scene";
import type { RenderOptions } from "@/engine/render";
import { videoSourceTime } from "@/engine/media";
import { useStore } from "@/store";
import { cleanSvgMarkup } from "@/engine/svg";

const bump = () => useStore.getState().bumpImages();

// ── SVGs ────────────────────────────────────────────────────────────

const svgText = new Map<string, string | null>();
const svgLoading = new Set<string>();

function svgUrl(src: string, assets: Asset[]): string | null {
  if (src.startsWith("emoji:")) return `/stickers/${src.slice(6)}.svg`;
  if (src.startsWith("lib:")) return `/illustrations/${src.slice(4)}.svg`;
  if (src.startsWith("asset:")) {
    const a = assets.find((x) => x.id === src.slice(6));
    return a && !a.svg && a.src ? a.src : null;
  }
  return null;
}

/** Markup for an SVG source, loading it in the background the first time. */
export function svgLookup(assets: Asset[]): (src: string) => string | undefined {
  return (src) => {
    if (src.startsWith("asset:")) {
      const a = assets.find((x) => x.id === src.slice(6));
      // Older projects can hold markup that was saved still escaped.
      if (a?.svg) return cleanSvgMarkup(a.svg);
    }
    const have = svgText.get(src);
    if (have !== undefined) return have ?? undefined;
    const url = svgUrl(src, assets);
    if (url && !svgLoading.has(src)) {
      svgLoading.add(src);
      fetch(url)
        .then((r) => (r.ok ? r.text() : null))
        .then((t) => svgText.set(src, t))
        .catch(() => svgText.set(src, null))
        .finally(() => {
          svgLoading.delete(src);
          bump();
        });
    }
    return undefined;
  };
}

/** Load every SVG a scene uses (the export must not miss any). */
export async function preloadSvgs(scene: Scene, assets: Asset[]) {
  const lookup = svgLookup(assets);
  const srcs = new Set<string>();
  for (const o of scene.objects) if (o.type === "svg") srcs.add(o.src);
  for (const s of srcs) lookup(s);
  await Promise.all(
    [...srcs].map(async (s) => {
      for (let i = 0; i < 200 && svgLoading.has(s); i++) await new Promise((r) => setTimeout(r, 25));
    })
  );
  return lookup;
}

// ── Pictures ────────────────────────────────────────────────────────

const images = new Map<string, HTMLImageElement>();

export function imageLookup(assets: Asset[]): (id: string) => CanvasImageSource | undefined {
  return (id) => {
    const a = assets.find((x) => x.id === id);
    if (!a || (a.kind && a.kind !== "image")) return undefined;
    let img = images.get(a.id);
    if (!img || img.dataset.src !== a.src) {
      img = new Image();
      img.crossOrigin = "anonymous";
      img.dataset.src = a.src;
      img.onload = bump;
      img.src = a.src;
      images.set(a.id, img);
    }
    return img.complete && img.naturalWidth ? img : undefined;
  };
}

export async function preloadImages(assets: Asset[]) {
  const lookup = imageLookup(assets);
  await Promise.all(
    assets
      .filter((a) => !a.kind || a.kind === "image")
      .map((a) => {
        lookup(a.id);
        const img = images.get(a.id);
        if (!img || img.complete) return Promise.resolve();
        return new Promise<void>((r) => {
          img.addEventListener("load", () => r(), { once: true });
          img.addEventListener("error", () => r(), { once: true });
        });
      })
  );
  return lookup;
}

// ── Video ───────────────────────────────────────────────────────────

interface Player {
  el: HTMLVideoElement;
  asset: string;
  ready: boolean;
}

/** One element per video object, so two clips of the same file can show different moments. */
const players = new Map<string, Player>();

function playerFor(obj: VideoObj, assets: Asset[]): Player | null {
  const a = assets.find((x) => x.id === obj.asset);
  if (!a) return null;
  let p = players.get(obj.id);
  if (p && p.asset !== a.id) {
    p.el.pause();
    p.el.removeAttribute("src");
    p = undefined;
  }
  if (!p) {
    const el = document.createElement("video");
    el.crossOrigin = "anonymous";
    el.preload = "auto";
    el.playsInline = true;
    el.muted = true;
    el.src = a.src;
    const player: Player = { el, asset: a.id, ready: false };
    el.addEventListener("loadeddata", () => {
      player.ready = true;
      bump();
    });
    el.addEventListener("seeked", bump);
    players.set(obj.id, player);
    p = player;
  }
  return p;
}

/** Live preview: the frame for a video object, nudging its element toward the wanted time. */
export function videoLookup(assets: Asset[], playing: boolean): RenderOptions["videoFrame"] {
  return (obj, at) => {
    const p = playerFor(obj, assets);
    if (!p) return undefined;
    const el = p.el;
    // Playing forward, the element plays on its own; otherwise it is seeked frame by frame.
    const wantPlay = playing && !obj.reverse;
    if (wantPlay) {
      if (Math.abs(el.playbackRate - obj.speed) > 0.01) el.playbackRate = obj.speed;
      if (el.paused) el.play().catch(() => {});
      if (Math.abs(el.currentTime - at) > 0.3) el.currentTime = at;
    } else {
      if (!el.paused) el.pause();
      if (Math.abs(el.currentTime - at) > 1 / 60 && !el.seeking) el.currentTime = at;
    }
    return p.ready && el.readyState >= 2 ? el : undefined;
  };
}

/** Sound of video clips during playback comes from their elements. */
export function syncVideoSound(scene: Scene, playing: boolean, t: number) {
  const live = new Set<string>();
  for (const o of scene.objects) {
    if (o.type !== "video") continue;
    live.add(o.id);
    const p = players.get(o.id);
    if (!p) continue;
    const on = playing && videoSourceTime(o, t) !== null && !o.hidden;
    const local = t - o.start;
    let gain = o.volume;
    if (o.fadeIn > 0 && local < o.fadeIn) gain *= Math.max(0, local / o.fadeIn);
    if (o.fadeOut > 0 && local > o.duration - o.fadeOut) gain *= Math.max(0, (o.duration - local) / o.fadeOut);
    p.el.muted = !on || gain <= 0.001 || !!o.reverse;
    p.el.volume = Math.max(0, Math.min(1, gain));
    if (!on && !p.el.paused) p.el.pause();
  }
  for (const [id, p] of players) {
    if (!live.has(id)) {
      p.el.pause();
      p.el.removeAttribute("src");
      p.el.load();
      players.delete(id);
    }
  }
}

/** Export: seek every video visible at t to its exact frame and wait for it. */
export async function seekVideos(scene: Scene, t: number, assets: Asset[]) {
  const jobs: Promise<void>[] = [];
  for (const o of scene.objects) {
    if (o.type !== "video") continue;
    const at = videoSourceTime(o, t);
    if (at === null) continue;
    const p = playerFor(o, assets);
    if (!p) continue;
    const el = p.el;
    el.pause();
    jobs.push(
      (async () => {
        if (el.readyState < 1) await new Promise<void>((r) => el.addEventListener("loadedmetadata", () => r(), { once: true }));
        const target = Math.min(Math.max(0, at), Math.max(0, (el.duration || at) - 0.02));
        if (Math.abs(el.currentTime - target) > 0.001 || el.readyState < 2) {
          await new Promise<void>((resolve) => {
            const done = () => resolve();
            el.addEventListener("seeked", done, { once: true });
            setTimeout(done, 3000);
            el.currentTime = target;
          });
        }
        if (el.readyState < 2) await new Promise<void>((r) => (el.addEventListener("loadeddata", () => r(), { once: true }), setTimeout(r, 2000)));
        p.ready = true;
      })()
    );
  }
  await Promise.all(jobs);
}

export function exportVideoLookup(assets: Asset[]): RenderOptions["videoFrame"] {
  return (obj) => {
    const p = playerFor(obj, assets);
    return p && p.el.readyState >= 2 ? p.el : undefined;
  };
}

// ── Scratch canvases ────────────────────────────────────────────────

/**
 * Canvases for effects, pooled per frame: a renderer asks for several each frame (slide
 * transitions, blur regions, green screen), and making new ones each time is slow.
 */
export function canvasPool(): NonNullable<RenderOptions["makeCanvas"]> & { reset: () => void } {
  const pool: HTMLCanvasElement[] = [];
  let used = 0;
  const make = ((w: number, h: number) => {
    let c = pool[used];
    if (!c) {
      c = document.createElement("canvas");
      pool.push(c);
    }
    used++;
    const W = Math.max(1, Math.round(w));
    const H = Math.max(1, Math.round(h));
    if (c.width !== W || c.height !== H) {
      c.width = W;
      c.height = H;
    }
    const ctx = c.getContext("2d", { willReadFrequently: false })!;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    ctx.filter = "none";
    ctx.clearRect(0, 0, W, H);
    return { canvas: c, ctx };
  }) as NonNullable<RenderOptions["makeCanvas"]> & { reset: () => void };
  make.reset = () => {
    used = 0;
  };
  return make;
}
