// Fonts text can use. The first five are system stacks; the rest are font files in
// public/fonts (SIL Open Font License; Permanent Marker under Apache 2.0), loaded by
// the browser (src/fonts.ts) and by Node scripts (registerNodeFonts) so every renderer
// draws the same letters.

import type { FontName } from "./scene";

export interface FontInfo {
  id: FontName;
  label: string;
  /** Family name inside the font file, or a CSS stack for system fonts. */
  family: string;
  file?: string;
  /** The file is already a bold cut. */
  bold?: boolean;
}

export const FONT_LIST: FontInfo[] = [
  { id: "sans", label: "System sans", family: "'Segoe UI', Arial, sans-serif" },
  { id: "serif", label: "System serif", family: "Georgia, 'Times New Roman', serif" },
  { id: "hand", label: "Comic", family: "'Comic Sans MS', 'Segoe Print', 'Chalkboard SE', cursive" },
  { id: "chalk", label: "Chalk", family: "'Segoe Print', 'Comic Sans MS', 'Chalkboard SE', cursive" },
  { id: "mono", label: "Mono", family: "Consolas, 'Courier New', monospace" },
  { id: "roboto", label: "Clean (Roboto)", family: "Roboto", file: "Roboto-Bold.ttf", bold: true },
  { id: "poppins", label: "Modern (Poppins)", family: "Poppins", file: "Poppins-Bold.ttf", bold: true },
  { id: "archivo", label: "Heavy (Archivo Black)", family: "Archivo Black", file: "ArchivoBlack-Regular.ttf" },
  { id: "anton", label: "Tall (Anton)", family: "Anton", file: "Anton-Regular.ttf" },
  { id: "bebas", label: "Headline (Bebas Neue)", family: "Bebas Neue", file: "BebasNeue-Regular.ttf" },
  { id: "righteous", label: "Rounded (Righteous)", family: "Righteous", file: "Righteous-Regular.ttf" },
  { id: "abril", label: "Elegant serif (Abril Fatface)", family: "Abril Fatface", file: "AbrilFatface-Regular.ttf" },
  { id: "dmserif", label: "Classic serif (DM Serif)", family: "DM Serif Display", file: "DMSerifDisplay-Regular.ttf" },
  { id: "pacifico", label: "Script (Pacifico)", family: "Pacifico", file: "Pacifico-Regular.ttf" },
  { id: "lobster", label: "Retro script (Lobster)", family: "Lobster", file: "Lobster-Regular.ttf" },
  { id: "indie", label: "Handwritten (Indie Flower)", family: "Indie Flower", file: "IndieFlower-Regular.ttf" },
  { id: "marker", label: "Marker (Permanent Marker)", family: "Permanent Marker", file: "PermanentMarker-Regular.ttf" },
  { id: "naskh", label: "Arabic (Noto Naskh)", family: "Noto Naskh Arabic", file: "NotoNaskhArabic-Bold.ttf", bold: true },
  { id: "nastaliq", label: "Urdu (Noto Nastaliq)", family: "Noto Nastaliq Urdu", file: "NotoNastaliqUrdu-Bold.ttf", bold: true },
];

const BY_ID = new Map(FONT_LIST.map((f) => [f.id, f]));
const ARABIC_SCRIPT = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;

/** CSS font-family for a font id, with fallbacks. Arabic-script text gets a face that has its letters. */
export function fontStack(id: FontName | undefined, text = ""): string {
  let f = BY_ID.get(id ?? "sans") ?? FONT_LIST[0];
  if (ARABIC_SCRIPT.test(text) && f.id !== "naskh" && f.id !== "nastaliq") f = BY_ID.get("naskh")!;
  if (!f.file) return f.family;
  return `'${f.family}', 'Segoe UI', Arial, sans-serif`;
}

/** A canvas font string. Bold is not applied again to fonts that are bold cuts. */
export function fontCss(id: FontName | undefined, size: number, bold = false, italic = false, text = ""): string {
  const f = BY_ID.get(id ?? "sans");
  // Bundled faces are single cuts: synthetic bold would smear them.
  const weight = bold && !f?.file ? "bold " : "";
  return `${italic ? "italic " : ""}${weight}${Math.max(1, size)}px ${fontStack(id, text)}`;
}
