// How a human character is dressed. Every look is drawn on the same skeleton
// (rig.ts), so walking, sitting, writing and IK posing work for all of them.

import type { Ctx, ImageLookup } from "./render";
import type { Pt, RigPoints } from "./rig";
import type { Joints, Look } from "./scene";

const OUTLINE = "#1a1a1a";
const DEG = Math.PI / 180;

function shade(color: string, amount: number): string {
  const m = color.trim().match(/^#?([0-9a-f]{6}|[0-9a-f]{3})$/i);
  if (!m) return color;
  let hex = m[1];
  if (hex.length === 3) hex = [...hex].map((c) => c + c).join("");
  const n = parseInt(hex, 16);
  const f = (c: number) => Math.max(0, Math.min(255, Math.round(c * (1 - amount))));
  return `rgb(${f((n >> 16) & 255)},${f((n >> 8) & 255)},${f(n & 255)})`;
}

function capsule(ctx: Ctx, pts: Pt[], width: number, color: string, cap: CanvasLineCap = "round") {
  ctx.lineCap = cap;
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (const p of pts.slice(1)) ctx.lineTo(p.x, p.y);
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = width + 5;
  ctx.stroke();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.stroke();
}

function disc(ctx: Ctx, x: number, y: number, r: number, fill: string, outline = true) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
  if (outline) {
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 2.5;
    ctx.stroke();
  }
}

/** Eyes and mouth, drawn toward the facing side (+x). mouth 0..1 opens it for speech. */
export function drawFaceFeatures(ctx: Ctx, head: Pt, r: number, expr: string, lw: number, mouth: number, color = OUTLINE) {
  const { x, y } = head;
  ctx.save();
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineCap = "round";
  ctx.lineWidth = Math.max(1.5, lw * 0.45);
  const eyeR = Math.max(1.4, lw * 0.32);
  if (expr === "surprised") {
    ctx.beginPath();
    ctx.arc(x + r * 0.05, y - r * 0.2, r * 0.13, 0, Math.PI * 2);
    ctx.moveTo(x + r * 0.68, y - r * 0.2);
    ctx.arc(x + r * 0.55, y - r * 0.2, r * 0.13, 0, Math.PI * 2);
    ctx.stroke();
  } else if (expr === "sleep") {
    ctx.beginPath();
    ctx.moveTo(x - r * 0.08, y - r * 0.15);
    ctx.lineTo(x + r * 0.18, y - r * 0.15);
    ctx.moveTo(x + r * 0.42, y - r * 0.15);
    ctx.lineTo(x + r * 0.68, y - r * 0.15);
    ctx.stroke();
  } else {
    for (const ex of [r * 0.05, r * 0.55]) {
      ctx.beginPath();
      ctx.arc(x + ex, y - r * 0.18, eyeR, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  const mx = x + r * 0.3;
  const my = y + r * 0.38;
  ctx.beginPath();
  if (mouth > 0.06) {
    ctx.ellipse(mx, my, r * 0.2, r * (0.06 + 0.26 * Math.min(1, mouth)), 0, 0, Math.PI * 2);
    ctx.fill();
  } else if (expr === "happy") ctx.arc(mx, my - r * 0.18, r * 0.32, 0.15 * Math.PI, 0.85 * Math.PI);
  else if (expr === "sad") ctx.arc(mx, my + r * 0.22, r * 0.3, 1.15 * Math.PI, 1.85 * Math.PI);
  else if (expr === "surprised") ctx.arc(mx, my, r * 0.16, 0, Math.PI * 2);
  else {
    ctx.moveTo(mx - r * 0.22, my);
    ctx.lineTo(mx + r * 0.22, my);
  }
  if (mouth <= 0.06) ctx.stroke();
  if (expr === "angry") {
    ctx.beginPath();
    ctx.moveTo(x - r * 0.15, y - r * 0.5);
    ctx.lineTo(x + r * 0.2, y - r * 0.32);
    ctx.moveTo(x + r * 0.75, y - r * 0.5);
    ctx.lineTo(x + r * 0.4, y - r * 0.32);
    ctx.stroke();
  }
  ctx.restore();
}

export interface LookContext {
  ctx: Ctx;
  p: RigPoints;
  j: Joints;
  look: Look;
  expression: string;
  mouth: number;
  images?: ImageLookup;
}

export function drawLook(c: LookContext) {
  switch (c.look.style) {
    case "cartoon":
      return drawCartoon(c);
    case "robot":
      return drawRobot(c);
    case "cutout":
      return drawCutout(c);
    default:
      return;
  }
}

// ── Cartoon ──────────────────────────────────────────────────────────

function drawCartoon({ ctx, p, j, look, expression, mouth }: LookContext) {
  const far = 0.18;
  const headR = 18;
  const headAngle = j.torso + j.neck;
  const neckTop = { x: p.neck.x + Math.sin(headAngle * DEG) * 6, y: p.neck.y - Math.cos(headAngle * DEG) * 6 };
  const head = { x: p.neck.x + Math.sin(headAngle * DEG) * (headR + 5), y: p.neck.y - Math.cos(headAngle * DEG) * (headR + 5) };

  const shoe = (foot: Pt, color: string) => {
    ctx.beginPath();
    ctx.ellipse(foot.x + 5, foot.y - 3, 11, 6, 0, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 2.5;
    ctx.stroke();
  };
  const leg = (hip: Pt, knee: Pt, foot: Pt, dark: number) => {
    capsule(ctx, [hip, knee, foot], 13, shade(look.pants, dark));
    shoe(foot, shade(look.shoes, dark));
  };
  const arm = (elbow: Pt, hand: Pt, dark: number) => {
    capsule(ctx, [p.neck, elbow], 12, shade(look.shirt, dark));
    capsule(ctx, [elbow, hand], 9, shade(look.skin, dark));
    disc(ctx, hand.x, hand.y, 6, shade(look.skin, dark));
  };

  arm(p.lElbow, p.lHand, far);
  leg(p.hip, p.lKnee, p.lFoot, far);
  leg(p.hip, p.rKnee, p.rFoot, 0);

  if (look.dress) {
    const kneeY = Math.max(p.lKnee.y, p.rKnee.y) + 6;
    const spread = Math.abs(p.lKnee.x - p.rKnee.x) / 2 + 22;
    const midX = (p.lKnee.x + p.rKnee.x) / 2;
    ctx.beginPath();
    ctx.moveTo(p.hip.x - 13, p.hip.y - 6);
    ctx.lineTo(p.hip.x + 13, p.hip.y - 6);
    ctx.lineTo(midX + spread, kneeY);
    ctx.lineTo(midX - spread, kneeY);
    ctx.closePath();
    ctx.fillStyle = look.shirt;
    ctx.fill();
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 2.5;
    ctx.stroke();
  }

  capsule(ctx, [neckTop, p.neck], 9, look.skin);
  capsule(ctx, [p.neck, p.hip], 28, look.shirt);

  disc(ctx, head.x, head.y, headR, look.skin);
  ctx.save();
  ctx.translate(head.x, head.y);
  ctx.rotate(headAngle * DEG);
  drawHair(ctx, look, headR);
  if (look.beard) drawBeard(ctx, look, headR);
  drawFaceFeatures(ctx, { x: 0, y: 0 }, headR, expression === "none" ? "neutral" : expression, 5, mouth);
  if (look.glasses) drawGlasses(ctx, headR);
  drawHat(ctx, look, headR);
  ctx.restore();

  arm(p.rElbow, p.rHand, 0);
}

function drawHair(ctx: Ctx, look: Look, r: number) {
  if (look.hair === "none") return;
  ctx.save();
  ctx.fillStyle = look.hairColor;
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 2.5;
  const cap = () => {
    ctx.beginPath();
    ctx.arc(0, 0, r + 2, 150 * DEG, 340 * DEG);
    ctx.arc(1, -3, r - 5, 340 * DEG, 150 * DEG, true);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  };
  switch (look.hair) {
    case "short":
      cap();
      break;
    case "long":
      ctx.beginPath();
      ctx.moveTo(-r - 2, -2);
      ctx.quadraticCurveTo(-r - 6, r * 1.2, -r * 0.2, r * 1.7);
      ctx.lineTo(-r * 0.1, r * 0.4);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      cap();
      break;
    case "spiky": {
      cap();
      ctx.beginPath();
      const spikes = 6;
      for (let i = 0; i <= spikes; i++) {
        const a = (160 + (180 * i) / spikes) * DEG;
        const rr = i % 2 === 0 ? r + 1 : r + 11;
        const px = Math.cos(a) * rr;
        const py = Math.sin(a) * rr;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      break;
    }
    case "bun":
      cap();
      disc(ctx, -r * 0.55, -r * 1.0, r * 0.45, look.hairColor);
      break;
    case "curly":
      for (let i = 0; i <= 7; i++) {
        const a = (150 + (200 * i) / 7) * DEG;
        disc(ctx, Math.cos(a) * (r + 1), Math.sin(a) * (r + 1), 6.5, look.hairColor);
      }
      break;
    case "ponytail":
      ctx.beginPath();
      ctx.ellipse(-r * 1.25, r * 0.1, r * 0.35, r * 0.75, -0.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      cap();
      break;
  }
  ctx.restore();
}

function drawBeard(ctx: Ctx, look: Look, r: number) {
  ctx.beginPath();
  ctx.arc(0, 0, r + 1.5, 5 * DEG, 150 * DEG);
  ctx.arc(r * 0.25, r * 0.15, r * 0.6, 150 * DEG, 5 * DEG, true);
  ctx.closePath();
  ctx.fillStyle = look.hairColor;
  ctx.fill();
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 2;
  ctx.stroke();
}

function drawGlasses(ctx: Ctx, r: number) {
  ctx.save();
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 2;
  ctx.fillStyle = "rgba(180,220,255,0.35)";
  for (const ex of [r * 0.05, r * 0.6]) {
    ctx.beginPath();
    ctx.arc(ex, -r * 0.18, r * 0.24, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(r * 0.29, -r * 0.2);
  ctx.lineTo(r * 0.36, -r * 0.2);
  ctx.moveTo(-r * 0.19, -r * 0.18);
  ctx.lineTo(-r * 0.75, -r * 0.3);
  ctx.stroke();
  ctx.restore();
}

function drawHat(ctx: Ctx, look: Look, r: number) {
  if (look.hat === "none") return;
  const c = look.hatColor;
  ctx.save();
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 2.5;
  ctx.fillStyle = c;
  const fillStroke = () => {
    ctx.fill();
    ctx.stroke();
  };
  switch (look.hat) {
    case "cap":
      ctx.beginPath();
      ctx.arc(0, -3, r + 2, Math.PI, 2 * Math.PI);
      ctx.closePath();
      fillStroke();
      ctx.beginPath();
      ctx.roundRect?.(r * 0.3, -6, r + 12, 6, 3);
      if (!ctx.roundRect) ctx.rect(r * 0.3, -6, r + 12, 6);
      fillStroke();
      break;
    case "beanie":
      ctx.beginPath();
      ctx.arc(0, -2, r + 3, Math.PI, 2 * Math.PI);
      ctx.closePath();
      fillStroke();
      ctx.beginPath();
      ctx.rect(-r - 4, -8, 2 * r + 8, 8);
      ctx.fillStyle = shade(c, 0.2);
      fillStroke();
      disc(ctx, 0, -r - 6, 5, "#ffffff");
      break;
    case "tophat":
      ctx.beginPath();
      ctx.rect(-r * 0.7, -r * 2.6, r * 1.4, r * 1.75);
      fillStroke();
      ctx.beginPath();
      ctx.rect(-r * 1.15, -r * 0.95, r * 2.3, 5);
      fillStroke();
      break;
    case "crown":
      ctx.fillStyle = "#f4c430";
      ctx.beginPath();
      ctx.moveTo(-r * 0.8, -r * 0.7);
      ctx.lineTo(-r * 0.85, -r * 1.55);
      ctx.lineTo(-r * 0.4, -r * 1.05);
      ctx.lineTo(0, -r * 1.7);
      ctx.lineTo(r * 0.4, -r * 1.05);
      ctx.lineTo(r * 0.85, -r * 1.55);
      ctx.lineTo(r * 0.8, -r * 0.7);
      ctx.closePath();
      fillStroke();
      break;
    case "hardhat":
      ctx.fillStyle = "#ffc300";
      ctx.beginPath();
      ctx.arc(0, -4, r + 1, Math.PI, 2 * Math.PI);
      ctx.closePath();
      fillStroke();
      ctx.beginPath();
      ctx.rect(-r - 6, -7, 2 * r + 12, 5);
      fillStroke();
      break;
    case "cowboy":
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.ellipse(0, -r * 0.75, r * 1.7, 5, 0, 0, Math.PI * 2);
      fillStroke();
      ctx.beginPath();
      ctx.roundRect?.(-r * 0.75, -r * 1.75, r * 1.5, r * 1.05, 6);
      if (!ctx.roundRect) ctx.rect(-r * 0.75, -r * 1.75, r * 1.5, r * 1.05);
      fillStroke();
      break;
    case "chef":
      ctx.fillStyle = "#ffffff";
      for (const [cx, cy, rr] of [
        [-r * 0.45, -r * 1.45, r * 0.55],
        [r * 0.45, -r * 1.45, r * 0.55],
        [0, -r * 1.8, r * 0.6],
      ]) {
        ctx.beginPath();
        ctx.arc(cx, cy, rr, 0, Math.PI * 2);
        fillStroke();
      }
      ctx.beginPath();
      ctx.rect(-r * 0.85, -r * 1.2, r * 1.7, r * 0.55);
      fillStroke();
      break;
  }
  ctx.restore();
}

// ── Robot ────────────────────────────────────────────────────────────

function drawRobot({ ctx, p, j, look, expression, mouth }: LookContext) {
  const metal = look.shirt;
  const dark = shade(metal, 0.35);
  const limb = (a: Pt, b: Pt, c: Pt, d: number) => {
    capsule(ctx, [a, b], 10, shade("#a7b1bc", d), "butt");
    capsule(ctx, [b, c], 9, shade("#a7b1bc", d), "butt");
    disc(ctx, b.x, b.y, 6, shade(dark, d));
    disc(ctx, c.x, c.y, 6.5, shade(dark, d));
  };
  limb(p.neck, p.lElbow, p.lHand, 0.2);
  limb(p.hip, p.lKnee, p.lFoot, 0.2);
  limb(p.hip, p.rKnee, p.rFoot, 0);
  capsule(ctx, [p.neck, p.hip], 32, metal, "square");
  // Chest light.
  const mid = { x: (p.neck.x + p.hip.x) / 2, y: (p.neck.y + p.hip.y) / 2 };
  disc(ctx, mid.x + 6, mid.y - 6, 4, "#5ef2ff");

  const a = (j.torso + j.neck) * DEG;
  const head = { x: p.neck.x + Math.sin(a) * 22, y: p.neck.y - Math.cos(a) * 22 };
  ctx.save();
  ctx.translate(head.x, head.y);
  ctx.rotate(a);
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(0, -18);
  ctx.lineTo(0, -30);
  ctx.stroke();
  disc(ctx, 0, -32, 4, expression === "angry" ? "#ff4d4d" : "#ff9f1c");
  ctx.beginPath();
  ctx.roundRect?.(-17, -18, 34, 32, 6);
  if (!ctx.roundRect) ctx.rect(-17, -18, 34, 32);
  ctx.fillStyle = "#cfd6dd";
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.rect(-2, -10, 18, 9);
  ctx.fillStyle = "#1f2933";
  ctx.fill();
  const eye = expression === "sleep" ? "#34495e" : "#5ef2ff";
  disc(ctx, 3, -5.5, 2.3, eye, false);
  disc(ctx, 11, -5.5, 2.3, eye, false);
  // Speaker grille lights up with speech.
  ctx.fillStyle = mouth > 0.06 ? `rgba(94,242,255,${0.35 + 0.65 * Math.min(1, mouth)})` : "#6b7785";
  for (let i = 0; i < 3; i++) ctx.fillRect(0, 3 + i * 3.2, 14, 1.8);
  ctx.restore();

  limb(p.neck, p.rElbow, p.rHand, 0);
}

// ── Picture puppet ───────────────────────────────────────────────────

interface Piece {
  from: keyof NonNullable<Look["cutout"]>["joints"];
  to: keyof NonNullable<Look["cutout"]>["joints"];
  a: Pt;
  b: Pt;
  width: number;
  extend: number;
  uniform?: boolean;
}

function drawCutout({ ctx, p, look, images }: LookContext) {
  const cut = look.cutout;
  const img = cut ? images?.(cut.asset) : undefined;
  if (!cut || !img) {
    // Picture missing: fall back to a plain stick figure outline.
    ctx.strokeStyle = "#999";
    ctx.setLineDash([6, 5]);
    ctx.lineWidth = 3;
    ctx.strokeRect(-30, p.head.y - 20, 60, -p.head.y + 20);
    ctx.setLineDash([]);
    return;
  }
  const J = cut.joints;
  const dist = (u: Pt, v: Pt) => Math.hypot(u.x - v.x, u.y - v.y) || 1;
  const headR = dist(J.head, J.neck) * 0.95;
  const imgHeight = Math.max(J.lFoot.y, J.rFoot.y) - (J.head.y - headR);
  const rigHeight = -p.head.y + p.headR + Math.max(p.lFoot.y, p.rFoot.y);
  const s = rigHeight / Math.max(1, imgHeight);
  const bodyHalf = Math.max(dist(J.neck, J.hip) * 0.22, Math.abs(J.lElbow.x - J.rElbow.x) * 0.3);

  const pieces: Piece[] = [
    { from: "hip", to: "lKnee", a: p.hip, b: p.lKnee, width: dist(J.hip, J.lKnee) * 0.3, extend: 0.05 },
    { from: "lKnee", to: "lFoot", a: p.lKnee, b: p.lFoot, width: dist(J.lKnee, J.lFoot) * 0.3, extend: 0.3 },
    { from: "hip", to: "rKnee", a: p.hip, b: p.rKnee, width: dist(J.hip, J.rKnee) * 0.3, extend: 0.05 },
    { from: "rKnee", to: "rFoot", a: p.rKnee, b: p.rFoot, width: dist(J.rKnee, J.rFoot) * 0.3, extend: 0.3 },
    { from: "hip", to: "neck", a: p.hip, b: p.neck, width: bodyHalf, extend: 0.12 },
    { from: "neck", to: "lElbow", a: p.neck, b: p.lElbow, width: dist(J.neck, J.lElbow) * 0.22, extend: 0.05 },
    { from: "lElbow", to: "lHand", a: p.lElbow, b: p.lHand, width: dist(J.lElbow, J.lHand) * 0.24, extend: 0.3 },
    { from: "neck", to: "rElbow", a: p.neck, b: p.rElbow, width: dist(J.neck, J.rElbow) * 0.22, extend: 0.05 },
    { from: "rElbow", to: "rHand", a: p.rElbow, b: p.rHand, width: dist(J.rElbow, J.rHand) * 0.24, extend: 0.3 },
    { from: "neck", to: "head", a: p.neck, b: p.head, width: headR * 1.05, extend: 1.0, uniform: true },
  ];

  for (const pc of pieces) {
    const A = J[pc.from];
    const B = J[pc.to];
    const lenImg = dist(A, B);
    const lenRig = dist(pc.a, pc.b);
    const thImg = Math.atan2(B.y - A.y, B.x - A.x);
    const thRig = Math.atan2(pc.b.y - pc.a.y, pc.b.x - pc.a.x);
    ctx.save();
    ctx.translate(pc.a.x, pc.a.y);
    ctx.rotate(thRig);
    ctx.scale(pc.uniform ? s : lenRig / lenImg, s);
    ctx.rotate(-thImg);
    ctx.translate(-A.x, -A.y);
    // Capsule around the picture's segment, overlapping the joints so seams hide.
    const ux = (B.x - A.x) / lenImg;
    const uy = (B.y - A.y) / lenImg;
    const nx = -uy * pc.width;
    const ny = ux * pc.width;
    const back = pc.uniform ? pc.width * 0.2 : pc.width * 0.6;
    const ax = A.x - ux * back;
    const ay = A.y - uy * back;
    const bx = B.x + ux * lenImg * pc.extend;
    const by = B.y + uy * lenImg * pc.extend;
    ctx.beginPath();
    if (pc.uniform) {
      ctx.arc(J.head.x, J.head.y, headR * 1.25, 0, Math.PI * 2);
    } else {
      ctx.moveTo(ax + nx, ay + ny);
      ctx.lineTo(bx + nx, by + ny);
      ctx.arc(bx, by, pc.width, Math.atan2(ny, nx), Math.atan2(ny, nx) - Math.PI, true);
      ctx.lineTo(ax - nx, ay - ny);
      ctx.arc(ax, ay, pc.width, Math.atan2(-ny, -nx), Math.atan2(-ny, -nx) - Math.PI, true);
      ctx.closePath();
    }
    ctx.clip();
    ctx.drawImage(img, 0, 0);
    ctx.restore();
  }
}
