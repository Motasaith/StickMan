// Charts for presentations, drawn from their data and animated from time.

import type { ChartObj, TextObj } from "./scene";
import { fontCss } from "./fonts";

type Ctx = CanvasRenderingContext2D;

export const CHART_COLORS = ["#4F7CFF", "#FF6B6B", "#2EC4B6", "#FFC857", "#7B61FF", "#5BB85D", "#FF9F43", "#EE8FB0"];

const easeOut = (p: number) => 1 - Math.pow(1 - Math.max(0, Math.min(1, p)), 3);

function fmtValue(v: number, unit: string): string {
  const abs = Math.abs(v);
  const s = abs >= 100 || Number.isInteger(v) ? Math.round(v).toLocaleString("en-US") : v.toFixed(1);
  if (!unit) return s;
  // Currency goes in front; everything else (%, g, k, kg) after.
  if (/^[$€£¥₹]$/.test(unit)) return `${unit}${s}`;
  return unit.length <= 2 ? `${s}${unit}` : `${s} ${unit}`;
}

/** The text of a counting number at time t. */
export function counterText(c: NonNullable<TextObj["counter"]>, t: number): string {
  const p = c.duration > 0 ? easeOut((t - c.start) / c.duration) : t >= c.start ? 1 : 0;
  const v = c.from + (c.to - c.from) * p;
  const rounded = c.decimals > 0 ? v.toFixed(c.decimals) : Math.round(v).toLocaleString("en-US");
  return `${c.prefix}${rounded}${c.suffix}`;
}

export function drawChart(ctx: Ctx, c: ChartObj, t: number) {
  const data = c.data.filter((d) => Number.isFinite(d.value));
  if (!data.length) return;
  const colors = c.colors.length ? c.colors : CHART_COLORS;
  const colorOf = (i: number) => data[i].color ?? colors[i % colors.length];
  const p = c.duration > 0 ? (t - c.start) / c.duration : 1;
  const { w, h } = c;
  const label = Math.max(12, Math.min(w, h) * 0.055);
  ctx.save();
  ctx.textBaseline = "middle";
  ctx.fillStyle = c.textColor;
  ctx.font = fontCss(c.font, label, true);

  if (c.kind === "pie" || c.kind === "donut") {
    const total = data.reduce((s, d) => s + Math.max(0, d.value), 0) || 1;
    const legendW = w * 0.38;
    const r = Math.min(h, w - legendW) * 0.46;
    const cx = r + 4;
    const cy = h / 2;
    let a0 = -Math.PI / 2;
    const sweep = easeOut(p) * Math.PI * 2;
    data.forEach((d, i) => {
      const share = (Math.max(0, d.value) / total) * Math.PI * 2;
      const end = Math.min(a0 + share, -Math.PI / 2 + sweep);
      if (end > a0) {
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, r, a0, end);
        ctx.closePath();
        ctx.fillStyle = colorOf(i);
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.strokeStyle = "rgba(255,255,255,0.9)";
        ctx.stroke();
      }
      a0 += share;
    });
    if (c.kind === "donut") {
      ctx.globalCompositeOperation = "destination-out";
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.55, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalCompositeOperation = "source-over";
    }
    // Legend.
    const rowH = Math.min(label * 2, h / data.length);
    const ly = cy - (rowH * data.length) / 2 + rowH / 2;
    data.forEach((d, i) => {
      const appear = Math.max(0, Math.min(1, p * data.length - i));
      ctx.globalAlpha = appear;
      const x = w - legendW + 10;
      ctx.fillStyle = colorOf(i);
      ctx.beginPath();
      ctx.arc(x + label * 0.4, ly + i * rowH, label * 0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = c.textColor;
      ctx.textAlign = "left";
      ctx.font = fontCss(c.font, label * 0.9, false);
      const pct = Math.round((Math.max(0, d.value) / total) * 100);
      ctx.fillText(`${d.label}${c.showValues ? `  ${pct}%` : ""}`, x + label * 1.2, ly + i * rowH);
    });
    ctx.restore();
    return;
  }

  const max = Math.max(...data.map((d) => d.value), 0) || 1;
  const min = Math.min(0, ...data.map((d) => d.value));
  const span = max - min || 1;

  if (c.kind === "hbar") {
    const labelW = w * 0.28;
    const rowH = h / data.length;
    const barH = rowH * 0.62;
    data.forEach((d, i) => {
      const grow = easeOut(p * 1.3 - i * (0.3 / data.length));
      const y = i * rowH + (rowH - barH) / 2;
      const len = ((d.value - min) / span) * (w - labelW - label * 4) * grow;
      ctx.fillStyle = c.textColor;
      ctx.textAlign = "right";
      ctx.font = fontCss(c.font, label * 0.9, false, false, d.label);
      ctx.fillText(d.label, labelW - 10, y + barH / 2);
      ctx.fillStyle = colorOf(i);
      ctx.beginPath();
      roundBar(ctx, labelW, y, Math.max(0, len), barH, Math.min(barH / 2, 10));
      ctx.fill();
      if (c.showValues && grow > 0.05) {
        ctx.fillStyle = c.textColor;
        ctx.textAlign = "left";
        ctx.font = fontCss(c.font, label * 0.9, true);
        ctx.fillText(fmtValue(d.value * grow, c.unit), labelW + len + 8, y + barH / 2);
      }
    });
    ctx.restore();
    return;
  }

  const bottomPad = label * 2.2;
  const topPad = label * 1.6;
  const plotH = h - bottomPad - topPad;
  const zeroY = topPad + (max / span) * plotH;
  ctx.strokeStyle = c.textColor;
  ctx.globalAlpha = 0.25;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, zeroY);
  ctx.lineTo(w, zeroY);
  ctx.stroke();
  ctx.globalAlpha = 1;
  const slot = w / data.length;

  if (c.kind === "bar") {
    const barW = slot * 0.6;
    data.forEach((d, i) => {
      const grow = easeOut(p * 1.3 - i * (0.3 / data.length));
      const x = i * slot + (slot - barW) / 2;
      const hh = (Math.abs(d.value) / span) * plotH * grow;
      const y = d.value >= 0 ? zeroY - hh : zeroY;
      ctx.fillStyle = colorOf(i);
      ctx.beginPath();
      roundBar(ctx, x, y, barW, Math.max(0, hh), Math.min(barW / 2, 10));
      ctx.fill();
      ctx.fillStyle = c.textColor;
      ctx.textAlign = "center";
      ctx.font = fontCss(c.font, label * 0.85, false, false, d.label);
      ctx.fillText(d.label, x + barW / 2, h - bottomPad / 2);
      if (c.showValues && grow > 0.05) {
        ctx.font = fontCss(c.font, label * 0.9, true);
        ctx.fillText(fmtValue(d.value * grow, c.unit), x + barW / 2, y - label * 0.7);
      }
    });
  } else {
    const pts = data.map((d, i) => ({ x: i * slot + slot / 2, y: zeroY - ((d.value - Math.max(min, 0)) / span) * plotH }));
    const shown = easeOut(p) * (pts.length - 1);
    ctx.strokeStyle = colors[0];
    ctx.lineWidth = Math.max(4, label * 0.35);
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) {
      if (i <= shown) ctx.lineTo(pts[i].x, pts[i].y);
      else if (i - 1 < shown) {
        const f = shown - (i - 1);
        ctx.lineTo(pts[i - 1].x + (pts[i].x - pts[i - 1].x) * f, pts[i - 1].y + (pts[i].y - pts[i - 1].y) * f);
      }
    }
    ctx.stroke();
    pts.forEach((pt, i) => {
      ctx.fillStyle = c.textColor;
      ctx.textAlign = "center";
      ctx.font = fontCss(c.font, label * 0.85, false, false, data[i].label);
      ctx.fillText(data[i].label, pt.x, h - bottomPad / 2);
      if (i > shown + 0.01) return;
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, label * 0.45, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = label * 0.22;
      ctx.strokeStyle = colors[0];
      ctx.stroke();
      if (c.showValues) {
        ctx.fillStyle = c.textColor;
        ctx.font = fontCss(c.font, label * 0.9, true);
        ctx.fillText(fmtValue(data[i].value, c.unit), pt.x, pt.y - label * 1.1);
      }
    });
  }
  ctx.restore();
}

function roundBar(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h);
  ctx.lineTo(x, y + h);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}
