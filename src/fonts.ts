// Loads the font files in public/fonts so the canvas draws the same letters as the Node renderers,
// and gives slide layout a canvas to measure text with.

import { FONT_LIST } from "./engine/fonts";
import { setTextMeasureContext } from "./engine/slides";

let ready: Promise<void> | null = null;

export function loadFonts(): Promise<void> {
  if (ready) return ready;
  const measure = document.createElement("canvas").getContext("2d");
  if (measure) setTextMeasureContext(measure);
  ready = Promise.all(
    FONT_LIST.filter((f) => f.file).map(async (f) => {
      try {
        const face = new FontFace(f.family, `url(/fonts/${f.file})`);
        document.fonts.add(await face.load());
      } catch {
        // A missing font falls back to the system stack; text still renders.
      }
    })
  ).then(() => undefined);
  return ready;
}
