// Presentation themes: a background, text colors, an accent and a pair of fonts that go together.

import type { Background, FontName, TransitionKind } from "./scene";

export interface Theme {
  id: string;
  label: string;
  /** Title slides and section breaks. */
  cover: Background;
  /** Content slides. */
  background: Background;
  heading: string;
  text: string;
  /** Headings on the cover background. */
  coverText: string;
  accent: string;
  accent2: string;
  /** Soft panel behind cards and quotes. */
  panel: string;
  headingFont: FontName;
  bodyFont: FontName;
  transition: TransitionKind;
  /** Chart colors. */
  palette: string[];
}

export const THEMES: Theme[] = [
  {
    id: "clean",
    label: "Clean",
    cover: { kind: "gradient", from: "#4F7CFF", to: "#7B61FF", angle: 135 },
    background: { kind: "color", color: "#F7F8FC" },
    heading: "#1E2238",
    text: "#4A5068",
    coverText: "#FFFFFF",
    accent: "#4F7CFF",
    accent2: "#FF6B6B",
    panel: "#FFFFFF",
    headingFont: "poppins",
    bodyFont: "roboto",
    transition: "slideLeft",
    palette: ["#4F7CFF", "#7B61FF", "#2EC4B6", "#FFC857", "#FF6B6B"],
  },
  {
    id: "midnight",
    label: "Midnight",
    cover: { kind: "gradient", from: "#0B1026", to: "#27336B", angle: 160 },
    background: { kind: "gradient", from: "#111633", to: "#1C2450", angle: 180 },
    heading: "#FFFFFF",
    text: "#C9D1F0",
    coverText: "#FFFFFF",
    accent: "#4DD8E8",
    accent2: "#FF8FA3",
    panel: "#232B5C",
    headingFont: "poppins",
    bodyFont: "roboto",
    transition: "fade",
    palette: ["#4DD8E8", "#8C7CFF", "#FF8FA3", "#FFD166", "#7ED957"],
  },
  {
    id: "sunset",
    label: "Sunset",
    cover: { kind: "gradient", from: "#FF6B6B", to: "#FFB347", angle: 135 },
    background: { kind: "color", color: "#FFF6EE" },
    heading: "#3D1F1F",
    text: "#6B4A45",
    coverText: "#FFFFFF",
    accent: "#FF6B6B",
    accent2: "#FFB347",
    panel: "#FFFFFF",
    headingFont: "righteous",
    bodyFont: "poppins",
    transition: "zoom",
    palette: ["#FF6B6B", "#FFB347", "#FFD166", "#2EC4B6", "#7B61FF"],
  },
  {
    id: "medical",
    label: "Medical",
    cover: { kind: "gradient", from: "#0FA3B1", to: "#57CC99", angle: 135 },
    background: { kind: "color", color: "#F2FBFB" },
    heading: "#0B3C49",
    text: "#3F6670",
    coverText: "#FFFFFF",
    accent: "#0FA3B1",
    accent2: "#FF5A6E",
    panel: "#FFFFFF",
    headingFont: "poppins",
    bodyFont: "roboto",
    transition: "slideUp",
    palette: ["#0FA3B1", "#57CC99", "#4F7CFF", "#FF5A6E", "#FFC857"],
  },
  {
    id: "corporate",
    label: "Corporate",
    cover: { kind: "gradient", from: "#0F2A4A", to: "#1F5C99", angle: 120 },
    background: { kind: "color", color: "#FFFFFF" },
    heading: "#0F2A4A",
    text: "#4B5B70",
    coverText: "#FFFFFF",
    accent: "#1F5C99",
    accent2: "#F2A541",
    panel: "#EEF3F9",
    headingFont: "roboto",
    bodyFont: "roboto",
    transition: "push",
    palette: ["#1F5C99", "#F2A541", "#4FB0C6", "#8FA3BF", "#D1495B"],
  },
  {
    id: "bold",
    label: "Bold",
    cover: { kind: "color", color: "#FFD23F" },
    background: { kind: "color", color: "#FFFBEA" },
    heading: "#111111",
    text: "#333333",
    coverText: "#111111",
    accent: "#111111",
    accent2: "#EE4266",
    panel: "#FFFFFF",
    headingFont: "anton",
    bodyFont: "poppins",
    transition: "wipe",
    palette: ["#111111", "#EE4266", "#3BCEAC", "#540D6E", "#FFD23F"],
  },
  {
    id: "chalkboard",
    label: "Chalkboard",
    cover: { kind: "gradient", from: "#2F4F3A", to: "#244032", angle: 180 },
    background: { kind: "gradient", from: "#2F4F3A", to: "#28453A", angle: 180 },
    heading: "#FDFDF6",
    text: "#E4EBDD",
    coverText: "#FDFDF6",
    accent: "#FFE08A",
    accent2: "#FFB3C1",
    panel: "#3A5E48",
    headingFont: "marker",
    bodyFont: "indie",
    transition: "fade",
    palette: ["#FFE08A", "#FFB3C1", "#9FD8FF", "#C7F2A4", "#FFFFFF"],
  },
  {
    id: "pastel",
    label: "Pastel",
    cover: { kind: "gradient", from: "#FBC2EB", to: "#A6C1EE", angle: 135 },
    background: { kind: "color", color: "#FDF7FB" },
    heading: "#3E3553",
    text: "#6A6180",
    coverText: "#3E3553",
    accent: "#B983FF",
    accent2: "#FF9CB3",
    panel: "#FFFFFF",
    headingFont: "righteous",
    bodyFont: "poppins",
    transition: "circle",
    palette: ["#B983FF", "#FF9CB3", "#8FD3FE", "#A0E7A0", "#FFD6A5"],
  },
  {
    id: "nature",
    label: "Nature",
    cover: { kind: "gradient", from: "#2D6A4F", to: "#74C69D", angle: 140 },
    background: { kind: "color", color: "#F4F9F1" },
    heading: "#1B4332",
    text: "#40584A",
    coverText: "#FFFFFF",
    accent: "#40916C",
    accent2: "#F4A261",
    panel: "#FFFFFF",
    headingFont: "dmserif",
    bodyFont: "poppins",
    transition: "fade",
    palette: ["#40916C", "#74C69D", "#F4A261", "#E76F51", "#2A9D8F"],
  },
  {
    id: "elegant",
    label: "Elegant",
    cover: { kind: "color", color: "#1C1C1E" },
    background: { kind: "color", color: "#FAF7F2" },
    heading: "#1C1C1E",
    text: "#5A5550",
    coverText: "#F3E9D2",
    accent: "#B08D57",
    accent2: "#6B4E3D",
    panel: "#FFFFFF",
    headingFont: "abril",
    bodyFont: "poppins",
    transition: "fade",
    palette: ["#B08D57", "#6B4E3D", "#C9A96E", "#8C7A6B", "#3E3A36"],
  },
];

export const THEME_IDS = THEMES.map((t) => t.id) as [string, ...string[]];

export function themeById(id: string | undefined): Theme {
  return THEMES.find((t) => t.id === id) ?? THEMES[0];
}

/** The main color of a background (to pick readable text over it). */
export function backgroundColor(bg: Background): string {
  return bg.kind === "color" ? bg.color : bg.kind === "gradient" ? bg.from : "#222222";
}
