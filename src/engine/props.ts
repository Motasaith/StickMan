// Ready-made 3D props, modeled from solid shapes like a set dresser would build them.
// The origin is the middle of the prop's footprint on the floor; parts go up in negative y.
// Sizes fit a character about 240 tall (a door is about 260).

import type { Part } from "./scene";

export const PROP_KINDS = [
  "house",
  "shop",
  "building",
  "tree",
  "pine",
  "bush",
  "rock",
  "flowers",
  "table",
  "chair",
  "stool",
  "bench",
  "sofa",
  "bed",
  "desk",
  "bookshelf",
  "shelf",
  "counter",
  "stove",
  "fridge",
  "lamp",
  "streetlight",
  "tv",
  "plant",
  "car",
  "fence",
  "wall",
  "door",
  "window",
  "rug",
  "road",
  "pond",
  "mailbox",
  "trashcan",
  "sign",
  "blackboard",
  "cloud",
  "mountain",
  "crate",
  "barrel",
  "tent",
  "campfire",
] as const;
export type PropKind = (typeof PROP_KINDS)[number];

export interface PropOptions {
  color?: string;
  color2?: string;
  w?: number;
  h?: number;
  text?: string;
  /** Lit windows and lamps glow. */
  lit?: boolean;
}

/** Where a prop's light sits, relative to its origin (lamps, streetlights, screens, campfires). */
export const PROP_LIGHTS: Partial<Record<PropKind, { x: number; y: number; z: number; color: string; intensity: number; distance: number }>> = {
  lamp: { x: 0, y: -210, z: 0, color: "#ffd9a0", intensity: 1.6, distance: 700 },
  streetlight: { x: 70, y: -372, z: 0, color: "#ffe2a8", intensity: 2.4, distance: 1100 },
  campfire: { x: 0, y: -40, z: 0, color: "#ff9b45", intensity: 2.2, distance: 900 },
  tv: { x: 0, y: -120, z: 30, color: "#9fd4ff", intensity: 0.8, distance: 400 },
};

const box = (x: number, y: number, w: number, h: number, d: number, fill: string, extra: Partial<Part> = {}): Part => ({ kind: "box3", x, y, w, h, d, fill, ...extra }) as Part;
const cyl = (cx: number, y: number, r: number, h: number, fill: string, extra: Partial<Part> = {}): Part => ({ kind: "cylinder3", cx, y, r, h, fill, ...extra }) as Part;
const sph = (cx: number, cy: number, r: number, fill: string, extra: Partial<Part> = {}): Part => ({ kind: "sphere3", cx, cy, r, fill, ...extra }) as Part;
const cone = (cx: number, y: number, r: number, h: number, fill: string, extra: Partial<Part> = {}): Part => ({ kind: "cone3", cx, y, r, h, fill, ...extra }) as Part;
const prism = (x: number, y: number, w: number, h: number, d: number, fill: string, extra: Partial<Part> = {}): Part => ({ kind: "prism3", x, y, w, h, d, fill, ...extra }) as Part;

function legs(w: number, d: number, h: number, t: number, fill: string, inset = 6): Part[] {
  const xs = [-w / 2 + inset, w / 2 - inset - t];
  const zs = [-d / 2 + inset + t / 2, d / 2 - inset - t / 2];
  return xs.flatMap((x) => zs.map((z) => box(x, -h, t, h, t, fill, { z })));
}

export function buildProp(kind: PropKind, o: PropOptions = {}): Part[] {
  const glass = o.lit ? "#ffe9a8" : "#a9d6f5";
  const glow = !!o.lit;
  switch (kind) {
    case "house": {
      const w = o.w ?? 440;
      const h = o.h ?? 270;
      const d = 320;
      const wall = o.color ?? "#f1e4cf";
      const roof = o.color2 ?? "#b5523b";
      const front = d / 2 + 2;
      return [
        box(-w / 2, -h, w, h, d, wall),
        prism(-w / 2 - 22, -h - 150, w + 44, 150, d + 30, roof),
        box(w * 0.18, -h - 150, 42, 120, 42, "#8c5a44", { z: -50 }),
        box(-45, -200, 90, 200, 8, "#7a4a2e", { z: front }),
        sph(28, -100, 5, "#d9b64a", { cz: front + 5 }),
        box(-w / 2 + 40, -205, 100, 85, 6, glass, { z: front, glow }),
        box(w / 2 - 140, -205, 100, 85, 6, glass, { z: front, glow }),
        box(-w / 2 + 88, -205, 5, 85, 8, "#ffffff", { z: front + 1 }),
        box(w / 2 - 92, -205, 5, 85, 8, "#ffffff", { z: front + 1 }),
        box(-70, -14, 140, 14, 60, "#9a9a9a", { z: front + 30 }),
      ];
    }
    case "shop": {
      const w = o.w ?? 480;
      const h = o.h ?? 300;
      const d = 280;
      const front = d / 2 + 2;
      const awning = o.color2 ?? "#e63946";
      return [
        box(-w / 2, -h, w, h, d, o.color ?? "#e9dcc9"),
        box(-w / 2 - 10, -h - 20, w + 20, 24, d + 20, "#6b4f3a"),
        box(-w / 2 + 30, -210, w - 180, 150, 6, glass, { z: front, glow }),
        box(w / 2 - 120, -220, 90, 220, 8, "#5b3a29", { z: front }),
        box(-w / 2, -250, w, 16, 90, awning, { z: front + 45, rotX: -12 }),
        ...(o.text ? [{ kind: "text", x: 0, y: -h + 8, z: front + 1, text: o.text, size: 34, align: "center", bold: true, fill: "#2b2d42" } as Part] : []),
      ];
    }
    case "building": {
      const w = o.w ?? 300;
      const h = o.h ?? 900;
      const d = 300;
      const front = d / 2 + 2;
      const parts: Part[] = [box(-w / 2, -h, w, h, d, o.color ?? "#9aa5b1"), box(-w / 2 - 8, -h - 16, w + 16, 16, d + 16, o.color2 ?? "#6b7785")];
      const cols = Math.max(2, Math.floor(w / 80));
      const rows = Math.max(3, Math.floor((h - 120) / 110));
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const on = o.lit ? (r * 7 + c * 3) % 5 !== 0 : false;
          parts.push(box(-w / 2 + 25 + c * ((w - 50) / cols), -h + 60 + r * 110, (w - 50) / cols - 22, 70, 6, on ? "#ffe29a" : "#b8d4ea", { z: front, glow: on }));
        }
      }
      return parts;
    }
    case "tree": {
      const leaf = o.color ?? "#4f9d50";
      const s = (o.h ?? 330) / 330;
      return [
        cyl(0, -180 * s, 20 * s, 180 * s, o.color2 ?? "#7a5236"),
        sph(0, -250 * s, 95 * s, leaf),
        sph(-60 * s, -200 * s, 65 * s, leaf),
        sph(62 * s, -210 * s, 62 * s, leaf),
        sph(10 * s, -315 * s, 60 * s, leaf),
      ];
    }
    case "pine": {
      const leaf = o.color ?? "#2f6f4f";
      const s = (o.h ?? 420) / 420;
      return [cyl(0, -70 * s, 18 * s, 70 * s, o.color2 ?? "#6b4630"), cone(0, -230 * s, 120 * s, 170 * s, leaf), cone(0, -330 * s, 95 * s, 150 * s, leaf), cone(0, -420 * s, 70 * s, 130 * s, leaf)];
    }
    case "bush": {
      const c = o.color ?? "#5aa05a";
      return [sph(-40, -44, 45, c), sph(35, -47, 48, c), sph(0, -62, 50, c, { cz: -10 })];
    }
    case "rock":
      return [sph(0, -54, 55, o.color ?? "#8d8d8d", { cz: 0 }), sph(45, -30, 30, o.color ?? "#9a9a9a", { cz: 20 })];
    case "flowers": {
      const parts: Part[] = [];
      const colors = [o.color ?? "#ff5d8f", "#ffd166", "#b388ff", "#ff8a5b"];
      for (let i = 0; i < 7; i++) {
        const x = -60 + i * 20;
        const z = (i % 3) * 18 - 18;
        parts.push(cyl(x, -40 - (i % 2) * 10, 2, 40 + (i % 2) * 10, "#3f8f3f", { z }));
        parts.push(sph(x, -44 - (i % 2) * 10, 9, colors[i % colors.length], { cz: z }));
      }
      return parts;
    }
    case "table": {
      const w = o.w ?? 230;
      const top = o.color ?? "#b07a4a";
      return [box(-w / 2, -100, w, 14, 130, top), ...legs(w, 130, 86, 12, o.color2 ?? "#7a4a28")];
    }
    case "desk": {
      const w = o.w ?? 240;
      const c = o.color ?? "#9c6b43";
      return [box(-w / 2, -104, w, 14, 110, c), box(w / 2 - 80, -90, 72, 90, 100, o.color2 ?? "#7d5436"), box(w / 2 - 70, -70, 52, 8, 6, "#d9b64a", { z: 53 }), ...legs(w, 110, 90, 12, o.color2 ?? "#7d5436").slice(0, 2)];
    }
    case "chair": {
      const c = o.color ?? "#8b5a2b";
      return [box(-36, -58, 72, 10, 72, c), box(-36, -160, 72, 102, 10, c, { z: -31 }), ...legs(72, 72, 48, 8, o.color2 ?? "#6b4420", 2)];
    }
    case "stool":
      return [cyl(0, -70, 30, 10, o.color ?? "#b5835a"), cyl(0, -60, 5, 60, o.color2 ?? "#555555")];
    case "bench": {
      const w = o.w ?? 220;
      const c = o.color ?? "#9c6b43";
      return [box(-w / 2, -58, w, 12, 64, c), box(-w / 2, -130, w, 50, 10, c, { z: -30 }), ...legs(w, 64, 46, 10, o.color2 ?? "#333333", 12)];
    }
    case "sofa": {
      const w = o.w ?? 280;
      const c = o.color ?? "#5b7db1";
      return [
        box(-w / 2, -70, w, 50, 110, c),
        box(-w / 2, -160, w, 100, 30, c, { z: -40 }),
        box(-w / 2 - 10, -100, 30, 80, 110, c),
        box(w / 2 - 20, -100, 30, 80, 110, c),
        box(-w / 2 + 20, -86, w / 2 - 25, 18, 90, o.color2 ?? "#7aa0d6", { z: 8 }),
        box(5, -86, w / 2 - 25, 18, 90, o.color2 ?? "#7aa0d6", { z: 8 }),
        ...legs(w, 110, 20, 10, "#3a2a20", 10),
      ];
    }
    case "bed": {
      const c = o.color ?? "#8b5a2b";
      return [
        box(-170, -55, 340, 35, 200, c),
        box(-160, -80, 320, 25, 190, "#f4f1ea"),
        box(-160, -84, 200, 28, 194, o.color2 ?? "#6c8ebf"),
        box(110, -100, 55, 20, 150, "#ffffff"),
        box(165, -170, 18, 170, 200, c),
      ];
    }
    case "bookshelf": {
      const c = o.color ?? "#7a5236";
      const parts: Part[] = [box(-90, -250, 180, 250, 50, c)];
      const bookColors = ["#e63946", "#457b9d", "#f4a261", "#2a9d8f", "#8e7dbe", "#e9c46a"];
      for (let shelf = 0; shelf < 4; shelf++) {
        const y = -240 + shelf * 60;
        parts.push(box(-84, y + 48, 168, 6, 52, "#5e3d25", { z: 2 }));
        for (let b = 0; b < 7; b++) parts.push(box(-78 + b * 22, y + 8 + (b % 3) * 4, 18, 40 - (b % 3) * 4, 36, bookColors[(b + shelf) % bookColors.length], { z: 8 }));
      }
      return parts;
    }
    case "shelf":
      return [box(-100, -190, 200, 10, 45, o.color ?? "#8b5a2b"), box(-100, -120, 200, 10, 45, o.color ?? "#8b5a2b"), box(-96, -190, 8, 190, 40, "#6b4420"), box(88, -190, 8, 190, 40, "#6b4420")];
    case "counter": {
      const w = o.w ?? 420;
      const parts: Part[] = [box(-w / 2, -92, w, 92, 110, o.color ?? "#dfe6ea"), box(-w / 2 - 6, -100, w + 12, 8, 120, o.color2 ?? "#56606b")];
      const doors = Math.max(2, Math.round(w / 110));
      for (let i = 0; i < doors; i++) {
        const dw = w / doors;
        parts.push(box(-w / 2 + i * dw + 6, -82, dw - 12, 70, 4, "#ffffff", { z: 57 }));
        parts.push(box(-w / 2 + i * dw + dw / 2 - 12, -76, 24, 4, 6, "#8a8f94", { z: 60 }));
      }
      return parts;
    }
    case "stove":
      return [
        box(-65, -92, 130, 92, 110, o.color ?? "#e9ecef"),
        box(-65, -96, 130, 6, 110, "#2b2d42"),
        cyl(-30, -99, 18, 3, "#555555", { z: -25 }),
        cyl(30, -99, 18, 3, "#555555", { z: -25 }),
        cyl(-30, -99, 18, 3, "#555555", { z: 25 }),
        cyl(30, -99, 18, 3, "#555555", { z: 25 }),
        box(-50, -70, 100, 50, 4, "#3b3f45", { z: 56 }),
      ];
    case "fridge":
      return [box(-55, -250, 110, 250, 110, o.color ?? "#f4f6f8"), box(-55, -150, 110, 4, 112, "#c8cdd2"), box(32, -230, 6, 60, 10, "#9aa0a6", { z: 58 }), box(32, -130, 6, 70, 10, "#9aa0a6", { z: 58 })];
    case "lamp":
      return [cyl(0, -6, 32, 6, "#444444"), cyl(0, -200, 4, 196, "#555555"), cyl(0, -240, 38, 44, o.color ?? "#f2e3c6", { glow }), sph(0, -212, 12, "#fff3c4", { glow: true })];
    case "streetlight":
      return [cyl(0, -380, 9, 380, o.color ?? "#3d4650"), box(0, -392, 90, 10, 10, o.color ?? "#3d4650"), box(45, -380, 50, 12, 36, "#fff0c2", { glow: true }), cyl(0, -20, 18, 20, "#3d4650")];
    case "tv":
      return [box(-90, -60, 180, 60, 60, o.color2 ?? "#6b4f3a"), box(-110, -190, 220, 125, 10, "#1b1e23"), box(-102, -182, 204, 109, 6, o.lit === false ? "#2b3036" : "#5fb3ff", { z: 6, glow: o.lit !== false })];
    case "plant":
      return [cyl(0, -50, 26, 50, o.color2 ?? "#c26a3d"), sph(0, -90, 45, o.color ?? "#3f9b4a"), sph(-25, -70, 28, o.color ?? "#3f9b4a"), sph(25, -75, 26, o.color ?? "#3f9b4a")];
    case "car": {
      const body = o.color ?? "#d62828";
      const wheel = (cx: number, z: number) => cyl(cx, -43, 32, 22, "#1f1f1f", { z, rotX: 90 });
      return [
        box(-165, -96, 330, 62, 150, body),
        box(-95, -150, 185, 58, 136, body),
        box(-85, -142, 80, 44, 138, "#9fd0f0"),
        box(5, -142, 75, 44, 138, "#9fd0f0"),
        box(88, -142, 6, 44, 130, "#9fd0f0", {}),
        wheel(-100, 66),
        wheel(100, 66),
        wheel(-100, -66),
        wheel(100, -66),
        sph(160, -70, 11, "#fff6c8", { cz: 45, glow }),
        sph(160, -70, 11, "#fff6c8", { cz: -45, glow }),
      ];
    }
    case "fence": {
      const w = o.w ?? 420;
      const c = o.color ?? "#f4f1ea";
      const parts: Part[] = [box(-w / 2, -80, w, 10, 8, c), box(-w / 2, -40, w, 10, 8, c)];
      for (let x = -w / 2; x <= w / 2 - 12; x += 36) parts.push(box(x, -110, 12, 110, 12, c, { z: 4 }));
      return parts;
    }
    case "wall":
      return [box(-(o.w ?? 600) / 2, -(o.h ?? 320), o.w ?? 600, o.h ?? 320, 24, o.color ?? "#e8e1d5")];
    case "door":
      return [box(-55, -260, 110, 260, 14, o.color ?? "#7a4a2e"), box(-65, -270, 130, 10, 20, "#5b3a29"), sph(35, -130, 6, "#d9b64a", { cz: 10 })];
    case "window":
      return [box(-80, -(o.h ?? 300), 160, 110, 10, glass, { glow }), box(-86, -(o.h ?? 300) - 6, 172, 8, 16, "#ffffff"), box(-86, -(o.h ?? 300) + 108, 172, 8, 16, "#ffffff"), box(-4, -(o.h ?? 300), 8, 110, 14, "#ffffff")];
    case "rug":
      return [box(-(o.w ?? 260) / 2, -3, o.w ?? 260, 3, 170, o.color ?? "#b56576"), box(-(o.w ?? 260) / 2 + 20, -4, (o.w ?? 260) - 40, 1, 130, o.color2 ?? "#e5989b")];
    case "road": {
      const w = o.w ?? 1600;
      const parts: Part[] = [box(-w / 2, -2, w, 2, 260, o.color ?? "#4a4e54")];
      for (let x = -w / 2 + 20; x < w / 2 - 60; x += 140) parts.push(box(x, -3, 70, 1, 10, "#f5f5f5"));
      parts.push(box(-w / 2, -8, w, 8, 60, "#b9b4aa", { z: -160 }), box(-w / 2, -8, w, 8, 60, "#b9b4aa", { z: 160 }));
      return parts;
    }
    case "pond":
      return [cyl(0, -3, o.w ? o.w / 2 : 220, 3, o.color ?? "#5fa8d3"), cyl(0, -2, (o.w ? o.w / 2 : 220) + 16, 2, "#8a7f6a")];
    case "mailbox":
      return [box(-6, -110, 12, 110, 12, "#5b3a29"), box(-24, -150, 48, 40, 70, o.color ?? "#2a6fdb"), box(24, -145, 4, 24, 4, "#e63946", { z: 30 })];
    case "trashcan":
      return [cyl(0, -90, 32, 90, o.color ?? "#5c677d"), cyl(0, -96, 35, 8, "#3d4553")];
    case "sign": {
      const parts: Part[] = [box(-6, -160, 12, 160, 12, "#6b4420"), box(-90, -220, 180, 80, 10, o.color ?? "#f4e3b5", { z: 8 })];
      if (o.text) parts.push({ kind: "text", x: 0, y: -198, z: 14.5, text: o.text, size: 30, align: "center", bold: true, fill: "#2b2d42" } as Part);
      return parts;
    }
    case "blackboard":
      return [
        box(-230, -330, 460, 250, 18, "#7a4a2e"),
        box(-214, -316, 428, 222, 8, o.color ?? "#2f4f3a", { z: 10 }),
        box(-200, -92, 400, 10, 30, "#7a4a2e", { z: 14 }),
        box(-200, -80, 12, 80, 12, "#5b3a29", { z: -20 }),
        box(188, -80, 12, 80, 12, "#5b3a29", { z: -20 }),
      ];
    case "cloud": {
      const c = o.color ?? "#ffffff";
      return [sph(0, -520, 60, c), sph(-60, -500, 45, c), sph(60, -505, 48, c), sph(20, -550, 42, c)];
    }
    case "mountain":
      return [cone(0, -900, 700, 900, o.color ?? "#7d8a96"), cone(0, -902, 262, 332, o.color2 ?? "#f4f7fa")];
    case "crate":
      return [box(-45, -90, 90, 90, 90, o.color ?? "#b98a55"), box(-45, -52, 90, 12, 92, "#8a6238")];
    case "barrel":
      return [cyl(0, -110, 42, 110, o.color ?? "#8b5a2b"), cyl(0, -86, 44, 8, "#555555"), cyl(0, -28, 44, 8, "#555555")];
    case "tent":
      return [prism(-150, -180, 300, 180, 260, o.color ?? "#f2a541"), prism(-45, -110, 90, 110, 6, "#3a2a20", { z: 130 })];
    case "campfire":
      return [
        box(-55, -12, 110, 12, 18, "#6b4420", { rotY: 30 }),
        box(-55, -12, 110, 12, 18, "#6b4420", { rotY: -30 }),
        cone(0, -70, 30, 62, "#ff8c2a", { glow: true }),
        cone(0, -50, 18, 42, "#ffd35a", { glow: true }),
      ];
  }
}
