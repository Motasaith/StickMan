import type { Background } from "@/engine/scene";

/** A CSS background for swatches and slide thumbnails. */
export function drawBackgroundCss(bg: Background): string {
  if (bg.kind === "color") return bg.color;
  if (bg.kind === "gradient") return bg.radial ? `radial-gradient(circle, ${bg.from}, ${bg.to})` : `linear-gradient(${bg.angle}deg, ${bg.from}, ${bg.to})`;
  return "#222222";
}
