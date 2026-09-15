import { describe, expect, it } from "vitest";
import { createCanvas } from "@napi-rs/canvas";
import { drawSvg, parseColor, parseSvg, pathCommands, svgColors, svgProblem } from "./svg";

type Ctx = CanvasRenderingContext2D;

function render(markup: string, t: number, w = 100, h = 100, colors?: Record<string, string>) {
  const canvas = createCanvas(w, h);
  const ctx = canvas.getContext("2d") as unknown as Ctx;
  const doc = parseSvg(markup);
  if (!doc) throw new Error("no svg");
  drawSvg(ctx, doc, t, w, h, { colors });
  return (x: number, y: number) => {
    const d = ctx.getImageData(x, y, 1, 1).data;
    return [d[0], d[1], d[2], d[3]];
  };
}

const near = (a: number[], b: number[], tol = 40) => a.every((v, i) => Math.abs(v - b[i]) <= tol);

describe("svg parsing", () => {
  it("reads the viewBox, ignores scripts and foreign content", () => {
    const doc = parseSvg(`<?xml version="1.0"?><!-- hi --><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 100"><script>alert(1)</script><foreignObject><div/></foreignObject><rect width="10" height="10"/></svg>`)!;
    expect(doc.viewBox).toEqual([0, 0, 200, 100]);
    expect(doc.root.children.map((c) => c.tag)).toEqual(["rect"]);
  });

  it("explains what is wrong with an unusable SVG", () => {
    expect(svgProblem("<div>no</div>")).toMatch(/no <svg>/);
    expect(svgProblem(`<svg viewBox="0 0 10 10"></svg>`)).toMatch(/draws nothing/);
    expect(svgProblem(`<svg viewBox="0 0 10 10"><circle r="3"/></svg>`)).toBeNull();
  });

  it("parses colors in every common form", () => {
    expect(parseColor("#f00")).toEqual([255, 0, 0, 1]);
    expect(parseColor("rgb(0, 128, 255)")).toEqual([0, 128, 255, 1]);
    expect(parseColor("rgba(0,0,0,.5)")![3]).toBeCloseTo(0.5);
    expect(parseColor("hsl(120, 100%, 50%)")!.map(Math.round)).toEqual([0, 255, 0, 1]);
    expect(parseColor("tomato")).toEqual([255, 99, 71, 1]);
  });

  it("turns arcs and relative commands into absolute curves", () => {
    const cmds = pathCommands("M10 10 h20 v20 a10 10 0 0 1 -20 0 z");
    expect(cmds[0]).toEqual({ c: "M", p: [10, 10] });
    expect(cmds[1]).toEqual({ c: "L", p: [30, 10] });
    expect(cmds[2]).toEqual({ c: "L", p: [30, 30] });
    const last = cmds[cmds.length - 2];
    expect(last.c).toBe("C");
    expect(last.p.slice(-2).map(Math.round)).toEqual([10, 30]);
  });
});

describe("svg drawing", () => {
  it("fills shapes with CSS classes, inline styles and transforms", () => {
    const px = render(
      `<svg viewBox="0 0 100 100"><style>.b{fill:#0000ff}</style>
        <rect class="b" x="0" y="0" width="50" height="50"/>
        <g transform="translate(50 50)"><circle cx="25" cy="25" r="20" style="fill:#00ff00"/></g></svg>`,
      0
    );
    expect(near(px(20, 20), [0, 0, 255, 255])).toBe(true);
    expect(near(px(75, 75), [0, 255, 0, 255])).toBe(true);
    expect(px(75, 20)[3]).toBe(0);
  });

  it("draws linear gradients across the shape's box", () => {
    const px = render(
      `<svg viewBox="0 0 100 100"><defs><linearGradient id="g"><stop offset="0" stop-color="#ff0000"/><stop offset="1" stop-color="#0000ff"/></linearGradient></defs>
        <rect x="0" y="0" width="100" height="100" fill="url(#g)"/></svg>`,
      0
    );
    expect(px(2, 50)[0]).toBeGreaterThan(200);
    expect(px(97, 50)[2]).toBeGreaterThan(200);
  });

  it("animates attributes, transforms and colors at the requested time", () => {
    const svg = `<svg viewBox="0 0 100 100">
      <rect x="0" y="40" width="20" height="20" fill="#ff0000">
        <animate attributeName="x" from="0" to="80" dur="2s" fill="freeze"/>
        <animate attributeName="fill" values="#ff0000;#0000ff" dur="2s" fill="freeze"/>
      </rect></svg>`;
    const start = render(svg, 0);
    expect(near(start(10, 50), [255, 0, 0, 255])).toBe(true);
    const mid = render(svg, 1);
    expect(mid(10, 50)[3]).toBe(0);
    expect(mid(50, 50)[3]).toBe(255);
    const end = render(svg, 5);
    expect(near(end(90, 50), [0, 0, 255, 255])).toBe(true);
  });

  it("loops with repeatCount and follows keyTimes", () => {
    const svg = `<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="10" fill="#000">
      <animate attributeName="r" values="10;40;10" keyTimes="0;0.5;1" dur="1s" repeatCount="indefinite"/></circle></svg>`;
    expect(render(svg, 0.5)(80, 50)[3]).toBe(255);
    expect(render(svg, 1.0)(80, 50)[3]).toBe(0);
    expect(render(svg, 3.5)(80, 50)[3]).toBe(255);
  });

  it("rotates around a point with animateTransform and chains begins", () => {
    const svg = `<svg viewBox="0 0 100 100">
      <rect id="bar" x="45" y="0" width="10" height="50" fill="#000">
        <animateTransform id="spin" attributeName="transform" type="rotate" from="0 50 50" to="180 50 50" dur="1s" fill="freeze"/>
      </rect>
      <circle cx="10" cy="90" r="8" fill="#f00" opacity="0">
        <set attributeName="opacity" to="1" begin="spin.end"/>
      </circle></svg>`;
    const before = render(svg, 0);
    expect(before(50, 20)[3]).toBe(255);
    expect(before(10, 90)[3]).toBe(0);
    const after = render(svg, 1.5);
    expect(after(50, 20)[3]).toBe(0);
    expect(after(50, 80)[3]).toBe(255);
    expect(after(10, 90)[3]).toBe(255);
  });

  it("draws a line on over time with pathLength dashes", () => {
    const svg = `<svg viewBox="0 0 100 100"><path d="M0 50 H100" stroke="#000" stroke-width="10" pathLength="1" stroke-dasharray="1" stroke-dashoffset="1">
      <animate attributeName="stroke-dashoffset" from="1" to="0" dur="2s" fill="freeze"/></path></svg>`;
    const early = render(svg, 0.5);
    expect(early(10, 50)[3]).toBe(255);
    expect(early(90, 50)[3]).toBe(0);
    expect(render(svg, 2)(90, 50)[3]).toBe(255);
  });

  it("moves along a path with animateMotion", () => {
    const svg = `<svg viewBox="0 0 100 100"><circle r="6" fill="#000"><animateMotion path="M10 10 L90 10 L90 90" dur="2s" fill="freeze"/></circle></svg>`;
    expect(render(svg, 0)(10, 10)[3]).toBe(255);
    expect(render(svg, 1)(90, 10)[3]).toBe(255);
    expect(render(svg, 2)(90, 90)[3]).toBe(255);
  });

  it("clips, reuses shapes and swaps colors", () => {
    const svg = `<svg viewBox="0 0 100 100"><defs><clipPath id="c"><rect x="0" y="0" width="50" height="100"/></clipPath><circle id="dot" r="10" fill="#ffcc4d"/></defs>
      <circle cx="50" cy="50" r="40" fill="#ffcc4d" clip-path="url(#c)"/><use href="#dot" x="85" y="85"/></svg>`;
    const px = render(svg, 0, 100, 100, { "#FFCC4D": "#0000ff" });
    expect(near(px(30, 50), [0, 0, 255, 255])).toBe(true);
    expect(px(70, 50)[3]).toBe(0);
    expect(near(px(85, 85), [0, 0, 255, 255])).toBe(true);
    expect(svgColors(svg)[0]).toBe("#ffcc4d");
  });

  it("fits a wide viewBox into a square box, centered", () => {
    const px = render(`<svg viewBox="0 0 200 100"><rect width="200" height="100" fill="#000"/></svg>`, 0);
    expect(px(50, 10)[3]).toBe(0);
    expect(px(50, 50)[3]).toBe(255);
  });
});
