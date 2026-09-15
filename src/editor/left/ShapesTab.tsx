import { ArrowRight, ChartColumn, ChartLine, ChartPie, Circle, Donut, EyeOff, Grid3x3, Highlighter, Minus, RectangleHorizontal, ScanSearch, Search, Square, Star, Triangle, MessageSquare, BarChartHorizontal } from "lucide-react";
import { PanelHeader, GroupLabel, addAt, spot } from "./common";

type Make = (id: string, at: number, s: Parameters<Parameters<typeof addAt>[1]>[2]) => Record<string, unknown>;

const draw = (name: string, w: number, h: number, parts: unknown[]): Make => (id, at, s) => {
  const p = spot(s, w, h);
  return { op: "draw", id, name, x: p.x, y: p.y, parts, at: at || undefined };
};

const SHAPES: { label: string; icon: typeof Square; make: Make }[] = [
  { label: "Box", icon: Square, make: draw("Box", 240, 150, [{ kind: "rect", x: 0, y: 0, w: 240, h: 150, r: 16, fill: "#4F7CFF" }]) },
  { label: "Circle", icon: Circle, make: draw("Circle", 160, 160, [{ kind: "circle", cx: 80, cy: 80, r: 80, fill: "#FF6B6B" }]) },
  { label: "Pill", icon: RectangleHorizontal, make: draw("Pill", 260, 80, [{ kind: "rect", x: 0, y: 0, w: 260, h: 80, r: 40, fill: "#2EC4B6" }]) },
  { label: "Triangle", icon: Triangle, make: draw("Triangle", 180, 160, [{ kind: "poly", points: [90, 0, 180, 160, 0, 160], closed: true, fill: "#FFC857" }]) },
  { label: "Star", icon: Star, make: draw("Star", 180, 170, [{ kind: "poly", points: [90, 0, 112, 62, 180, 64, 126, 104, 146, 170, 90, 132, 34, 170, 54, 104, 0, 64, 68, 62], closed: true, fill: "#FFC857" }]) },
  { label: "Arrow", icon: ArrowRight, make: draw("Arrow", 260, 80, [{ kind: "poly", points: [0, 26, 180, 26, 180, 0, 260, 40, 180, 80, 180, 54, 0, 54], closed: true, fill: "#FF6B6B" }]) },
  { label: "Line", icon: Minus, make: draw("Line", 300, 10, [{ kind: "line", x1: 0, y1: 5, x2: 300, y2: 5, stroke: "#1a1a1a", width: 6 }]) },
  { label: "Callout", icon: MessageSquare, make: draw("Callout", 280, 150, [{ kind: "path", d: "M20 0 H260 Q280 0 280 20 V100 Q280 120 260 120 H90 L50 150 L56 120 H20 Q0 120 0 100 V20 Q0 0 20 0 Z", fill: "#FFFFFF", stroke: "#1a1a1a", width: 4 }]) },
];

const chart = (kind: string): Make => (id, at, s) => {
  const w = s.scene.width * 0.6;
  const h = s.scene.height * 0.55;
  return {
    op: "chart",
    id,
    kind,
    x: (s.scene.width - w) / 2,
    y: (s.scene.height - h) / 2,
    w,
    h,
    at,
    unit: kind === "pie" || kind === "donut" ? "%" : "",
    textColor: "#2B2D42",
    data: [
      { label: "2022", value: 32 },
      { label: "2023", value: 48 },
      { label: "2024", value: 61 },
      { label: "2025", value: 83 },
    ],
  };
};

const region = (kind: string, name: string): Make => (id, at, s) => {
  const w = s.scene.width * 0.25;
  const h = s.scene.height * 0.3;
  return { op: "region", id, kind, x: (s.scene.width - w) / 2, y: (s.scene.height - h) / 2, w, h, at: at || undefined };
};

export function ShapesTab() {
  return (
    <>
      <PanelHeader title="Shapes, charts and areas" subtitle="Draw shapes, animated charts, or cover up and point at parts of a video." />
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        <GroupLabel>Shapes</GroupLabel>
        <div className="grid grid-cols-4 gap-2">
          {SHAPES.map((s) => (
            <button key={s.label} className="tile h-16" onClick={() => addAt(s.label.toLowerCase(), s.make)}>
              <s.icon className="size-5 text-foreground" /> {s.label}
            </button>
          ))}
        </div>
        <GroupLabel>Charts that grow in</GroupLabel>
        <div className="grid grid-cols-3 gap-2">
          {[
            { k: "bar", label: "Bars", icon: ChartColumn },
            { k: "hbar", label: "Rows", icon: BarChartHorizontal },
            { k: "line", label: "Line", icon: ChartLine },
            { k: "pie", label: "Pie", icon: ChartPie },
            { k: "donut", label: "Donut", icon: Donut },
          ].map((c) => (
            <button key={c.k} className="tile h-16" onClick={() => addAt(`${c.k}chart`, chart(c.k))}>
              <c.icon className="size-5 text-foreground" /> {c.label}
            </button>
          ))}
        </div>
        <GroupLabel>Cover up and point out</GroupLabel>
        <div className="grid grid-cols-3 gap-2">
          {[
            { k: "blur", label: "Blur", icon: EyeOff },
            { k: "pixelate", label: "Pixelate", icon: Grid3x3 },
            { k: "redact", label: "Redact", icon: Square },
            { k: "highlight", label: "Highlight", icon: Highlighter },
            { k: "spotlight", label: "Spotlight", icon: ScanSearch },
            { k: "magnify", label: "Magnify", icon: Search },
          ].map((r) => (
            <button key={r.k} className="tile h-16" onClick={() => addAt(r.k, region(r.k, r.label))}>
              <r.icon className="size-5 text-foreground" /> {r.label}
            </button>
          ))}
        </div>
        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">Areas follow what's under them when you attach them to an object (Edit panel), or key their position as it moves.</p>
      </div>
    </>
  );
}
