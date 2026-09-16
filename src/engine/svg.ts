// Animated SVG on a canvas, deterministic in time.
//
// Stickers, the illustration library and AI-drawn pictures are SVG files. Browsers
// can't draw an animated SVG onto a canvas frame by frame (drawImage shows a still),
// and the export and the AI's contact sheets need the exact frame at time t. So this
// parses the SVG once and draws it with plain canvas calls, evaluating SMIL
// animations (<animate>, <animateTransform>, <animateMotion>, <set>) at t.
//
// Supported: svg, g, use, defs, symbol, path, rect, circle, ellipse, line, polyline,
// polygon, text/tspan, linear and radial gradients, clipPath, <style> with simple
// selectors, transforms and transform-origin, dashes with pathLength.
// Anything else (scripts, foreign content, external images) is dropped.

type Ctx = CanvasRenderingContext2D;

export interface SvgNode {
  tag: string;
  attrs: Record<string, string>;
  children: SvgNode[];
  text?: string;
  /** Presentation properties after CSS and inline styles. */
  props: Record<string, string>;
  anims: Anim[];
  parent: SvgNode | null;
}

interface Anim {
  kind: "animate" | "set" | "transform" | "motion";
  attr: string;
  type: string;
  values: string[];
  keyTimes: number[] | null;
  keySplines: number[][] | null;
  calcMode: string;
  beginSpec: string;
  begin: number;
  dur: number;
  active: number;
  freeze: boolean;
  additive: boolean;
  id: string | null;
  motion: Flat | null;
  rotate: string;
}

export interface SvgDoc {
  root: SvgNode;
  viewBox: [number, number, number, number];
  aspect: string;
  ids: Map<string, SvgNode>;
  /** Longest finite animation end, in seconds (0 for a still picture). */
  duration: number;
  animated: boolean;
}

// ── XML ─────────────────────────────────────────────────────────────

const ALLOWED = new Set([
  "svg", "g", "defs", "symbol", "use", "path", "rect", "circle", "ellipse", "line", "polyline", "polygon", "text", "tspan",
  "lineargradient", "radialgradient", "stop", "clippath", "style", "title", "desc",
  "animate", "animatetransform", "animatemotion", "set", "mpath", "mask",
]);

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

function decode(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, e: string) => {
    if (e[0] === "#") return String.fromCodePoint(e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10));
    return ENTITIES[e] ?? m;
  });
}

function node(tag: string, parent: SvgNode | null): SvgNode {
  return { tag, attrs: {}, children: [], props: {}, anims: [], parent };
}

function parseXml(src: string): SvgNode {
  const root = node("#root", null);
  const stack: SvgNode[] = [root];
  let skipDepth = 0;
  let i = 0;
  const top = () => stack[stack.length - 1];
  const addText = (text: string) => {
    if (skipDepth || !text) return;
    const t = top();
    if (t.tag === "text" || t.tag === "tspan" || t.tag === "style") {
      const n = node("#text", t);
      n.text = t.tag === "style" ? text : decode(text);
      t.children.push(n);
    }
  };
  while (i < src.length) {
    const lt = src.indexOf("<", i);
    if (lt < 0) break;
    if (lt > i) addText(src.slice(i, lt));
    if (src.startsWith("<!--", lt)) {
      const e = src.indexOf("-->", lt + 4);
      i = e < 0 ? src.length : e + 3;
      continue;
    }
    if (src.startsWith("<![CDATA[", lt)) {
      const e = src.indexOf("]]>", lt + 9);
      addText(src.slice(lt + 9, e < 0 ? src.length : e));
      i = e < 0 ? src.length : e + 3;
      continue;
    }
    if (src[lt + 1] === "?" || src[lt + 1] === "!") {
      const e = src.indexOf(">", lt);
      i = e < 0 ? src.length : e + 1;
      continue;
    }
    if (src[lt + 1] === "/") {
      const e = src.indexOf(">", lt);
      const name = src.slice(lt + 2, e < 0 ? src.length : e).trim().replace(/^.*:/, "").toLowerCase();
      i = e < 0 ? src.length : e + 1;
      if (skipDepth) {
        skipDepth--;
        continue;
      }
      for (let k = stack.length - 1; k > 0; k--) {
        if (stack[k].tag === name) {
          stack.length = k;
          break;
        }
      }
      continue;
    }
    // A start tag: name, attributes (quotes may hold ">"), then > or />.
    let j = lt + 1;
    while (j < src.length && !/[\s/>]/.test(src[j])) j++;
    const name = src.slice(lt + 1, j).replace(/^.*:/, "").toLowerCase();
    const attrs: Record<string, string> = {};
    let selfClose = false;
    while (j < src.length) {
      while (j < src.length && /\s/.test(src[j])) j++;
      if (src[j] === ">") {
        j++;
        break;
      }
      if (src[j] === "/" && src[j + 1] === ">") {
        selfClose = true;
        j += 2;
        break;
      }
      let k = j;
      while (k < src.length && !/[\s=/>]/.test(src[k])) k++;
      const an = src.slice(j, k);
      j = k;
      while (j < src.length && /\s/.test(src[j])) j++;
      let value = "";
      if (src[j] === "=") {
        j++;
        while (j < src.length && /\s/.test(src[j])) j++;
        const q = src[j];
        if (q === '"' || q === "'") {
          const e = src.indexOf(q, j + 1);
          value = src.slice(j + 1, e < 0 ? src.length : e);
          j = e < 0 ? src.length : e + 1;
        } else {
          let e = j;
          while (e < src.length && !/[\s>]/.test(src[e])) e++;
          value = src.slice(j, e);
          j = e;
        }
      }
      if (an) attrs[an === "xlink:href" ? "href" : an.replace(/^.*:/, "")] = decode(value);
    }
    i = j;
    if (skipDepth || !ALLOWED.has(name)) {
      if (!selfClose) skipDepth++;
      continue;
    }
    const n = node(name, top());
    n.attrs = attrs;
    top().children.push(n);
    if (!selfClose) stack.push(n);
  }
  return root;
}

// ── CSS ─────────────────────────────────────────────────────────────

interface Rule {
  tag: string | null;
  cls: string[];
  id: string | null;
  spec: number;
  decls: Record<string, string>;
}

function parseDecls(s: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const d of s.split(";")) {
    const c = d.indexOf(":");
    if (c < 0) continue;
    const k = d.slice(0, c).trim().toLowerCase();
    const v = d.slice(c + 1).replace(/!important/i, "").trim();
    if (k && v) out[k] = v;
  }
  return out;
}

function parseCss(css: string): Rule[] {
  const rules: Rule[] = [];
  const src = css.replace(/\/\*[\s\S]*?\*\//g, "");
  let i = 0;
  while (i < src.length) {
    const open = src.indexOf("{", i);
    if (open < 0) break;
    const selector = src.slice(i, open).trim();
    // Find the matching brace (at-rules like @keyframes nest).
    let depth = 1;
    let j = open + 1;
    while (j < src.length && depth) {
      if (src[j] === "{") depth++;
      else if (src[j] === "}") depth--;
      j++;
    }
    const body = src.slice(open + 1, j - 1);
    i = j;
    if (selector.startsWith("@")) continue;
    const decls = parseDecls(body);
    for (const sel of selector.split(",")) {
      const m = sel.trim().match(/^([a-zA-Z][\w-]*|\*)?((?:[.#][\w-]+)*)$/);
      if (!m) continue;
      const tag = m[1] && m[1] !== "*" ? m[1].toLowerCase() : null;
      const cls = [...(m[2] ?? "").matchAll(/\.([\w-]+)/g)].map((x) => x[1]);
      const id = (m[2] ?? "").match(/#([\w-]+)/)?.[1] ?? null;
      rules.push({ tag, cls, id, spec: (id ? 100 : 0) + cls.length * 10 + (tag ? 1 : 0), decls });
    }
  }
  return rules.sort((a, b) => a.spec - b.spec);
}

const PRESENTATION = new Set([
  "fill", "stroke", "stroke-width", "stroke-linecap", "stroke-linejoin", "stroke-dasharray", "stroke-dashoffset", "stroke-miterlimit",
  "fill-opacity", "stroke-opacity", "opacity", "fill-rule", "display", "visibility", "font-size", "font-family", "font-weight",
  "font-style", "text-anchor", "dominant-baseline", "transform-origin", "transform-box", "stop-color", "stop-opacity", "clip-path", "color",
  "letter-spacing",
]);
const INHERITED = new Set([
  "fill", "stroke", "stroke-width", "stroke-linecap", "stroke-linejoin", "stroke-dasharray", "stroke-dashoffset", "stroke-miterlimit",
  "fill-opacity", "stroke-opacity", "fill-rule", "visibility", "font-size", "font-family", "font-weight", "font-style", "text-anchor",
  "dominant-baseline", "color", "letter-spacing",
]);

// ── Parsing a document ──────────────────────────────────────────────

const docCache = new Map<string, SvgDoc | null>();

/** Parse (and cache) an SVG. Returns null when there is no <svg> in it. */
export function parseSvg(markup: string): SvgDoc | null {
  const cached = docCache.get(markup);
  if (cached !== undefined) return cached;
  const doc = buildDoc(markup);
  if (docCache.size > 400) docCache.clear();
  docCache.set(markup, doc);
  return doc;
}

function buildDoc(markup: string): SvgDoc | null {
  let tree: SvgNode;
  try {
    tree = parseXml(markup);
  } catch {
    return null;
  }
  const svg = tree.children.find((c) => c.tag === "svg");
  if (!svg) return null;
  svg.parent = null;

  const ids = new Map<string, SvgNode>();
  const css: string[] = [];
  const walk = (n: SvgNode, fn: (n: SvgNode) => void) => {
    fn(n);
    for (const c of n.children) walk(c, fn);
  };
  walk(svg, (n) => {
    if (n.attrs.id) ids.set(n.attrs.id, n);
    if (n.tag === "style") css.push(n.children.map((c) => c.text ?? "").join(""));
  });
  const rules = parseCss(css.join("\n"));

  walk(svg, (n) => {
    if (n.tag.startsWith("#")) return;
    for (const [k, v] of Object.entries(n.attrs)) if (PRESENTATION.has(k)) n.props[k] = v;
    const classes = (n.attrs.class ?? "").split(/\s+/).filter(Boolean);
    for (const r of rules) {
      if (r.tag && r.tag !== n.tag) continue;
      if (r.id && r.id !== n.attrs.id) continue;
      if (r.cls.some((c) => !classes.includes(c))) continue;
      Object.assign(n.props, r.decls);
    }
    if (n.attrs.style) Object.assign(n.props, parseDecls(n.attrs.style));
  });

  // Animations attach to their target and leave the drawing tree.
  const all: Anim[] = [];
  walk(svg, (n) => {
    const kept: SvgNode[] = [];
    for (const c of n.children) {
      if (c.tag === "animate" || c.tag === "set" || c.tag === "animatetransform" || c.tag === "animatemotion") {
        const a = readAnim(c, ids);
        if (a) {
          const href = c.attrs.href?.replace(/^#/, "");
          const target = href ? ids.get(href) : n;
          if (target) {
            target.anims.push(a);
            all.push(a);
          }
        }
      } else kept.push(c);
    }
    n.children = kept;
  });
  resolveBegins(all);

  const vb = (svg.attrs.viewBox ?? svg.attrs.viewbox ?? "").split(/[\s,]+/).map(Number);
  const w = parseFloat(svg.attrs.width ?? "") || 0;
  const h = parseFloat(svg.attrs.height ?? "") || 0;
  const viewBox: [number, number, number, number] =
    vb.length === 4 && vb.every(Number.isFinite) && vb[2] > 0 && vb[3] > 0 ? [vb[0], vb[1], vb[2], vb[3]] : [0, 0, w || 100, h || 100];
  const ends = all.map((a) => a.begin + a.active).filter((e) => Number.isFinite(e));
  const loops = all.some((a) => !Number.isFinite(a.active) && Number.isFinite(a.begin));
  return {
    root: svg,
    viewBox,
    aspect: svg.attrs.preserveAspectRatio ?? "xMidYMid meet",
    ids,
    duration: Math.max(0, ...ends),
    animated: all.length > 0 && (loops || ends.length > 0),
  };
}

function clockValue(s: string | undefined): number {
  if (!s) return NaN;
  const v = s.trim();
  if (v === "indefinite") return Infinity;
  const hms = v.match(/^(?:(\d+):)?(\d+):(\d+(?:\.\d+)?)$/);
  if (hms) return (Number(hms[1] ?? 0) * 3600) + Number(hms[2]) * 60 + Number(hms[3]);
  const m = v.match(/^(-?\d*\.?\d+)(ms|s|min|h)?$/);
  if (!m) return NaN;
  const n = Number(m[1]);
  return m[2] === "ms" ? n / 1000 : m[2] === "min" ? n * 60 : m[2] === "h" ? n * 3600 : n;
}

function readAnim(el: SvgNode, ids: Map<string, SvgNode>): Anim | null {
  const a = el.attrs;
  const kind = el.tag === "set" ? "set" : el.tag === "animatetransform" ? "transform" : el.tag === "animatemotion" ? "motion" : "animate";
  let values: string[] = [];
  if (a.values) values = a.values.split(";").map((v) => v.trim()).filter((v) => v.length);
  else if (kind === "set") values = [a.to ?? ""];
  else if (a.from !== undefined && a.to !== undefined) values = [a.from, a.to];
  else if (a.to !== undefined) values = ["", a.to];
  else if (a.from !== undefined && a.by !== undefined) values = [a.from, addNumbers(a.from, a.by)];
  else if (a.by !== undefined) values = ["0", a.by];
  let motion: Flat | null = null;
  if (kind === "motion") {
    const mpath = el.children.find((c) => c.tag === "mpath");
    const d = a.path ?? (mpath ? ids.get((mpath.attrs.href ?? "").replace(/^#/, ""))?.attrs.d : undefined);
    if (d) motion = flatten(pathCommands(d));
    else if (values.length) motion = flatten(polyCommands(values.flatMap((v) => v.split(/[\s,]+/).map(Number)), false));
  }
  if (kind !== "motion" && !values.length) return null;
  if (kind === "motion" && !motion) return null;
  let dur = clockValue(a.dur);
  if (!Number.isFinite(dur) || dur <= 0) dur = Infinity;
  const repeatCount = a.repeatCount === "indefinite" ? Infinity : Number(a.repeatCount ?? NaN);
  const repeatDur = clockValue(a.repeatDur);
  const hasCount = repeatCount === Infinity || (Number.isFinite(repeatCount) && repeatCount > 0);
  const hasRepeatDur = a.repeatDur !== undefined && !Number.isNaN(repeatDur);
  let active = hasCount ? dur * repeatCount : hasRepeatDur ? Infinity : dur;
  if (hasRepeatDur) active = Math.min(active, repeatDur);
  const kt = a.keyTimes?.split(";").map((v) => Number(v.trim()));
  const ks = a.keySplines?.split(";").map((s) => s.trim().split(/[\s,]+/).map(Number)).filter((s) => s.length === 4 && s.every(Number.isFinite));
  return {
    kind,
    attr: kind === "transform" ? "transform" : (a.attributeName ?? ""),
    type: (a.type ?? "translate").toLowerCase(),
    values,
    keyTimes: kt && kt.every(Number.isFinite) ? kt : null,
    keySplines: ks && ks.length ? ks : null,
    calcMode: a.calcMode ?? (kind === "motion" ? "paced" : "linear"),
    beginSpec: a.begin ?? "0s",
    begin: 0,
    dur,
    active,
    freeze: a.fill === "freeze" || kind === "set",
    additive: a.additive === "sum",
    id: a.id ?? null,
    motion,
    rotate: a.rotate ?? "0",
  };
}

/** begin="2s", begin="intro.end+0.5s", begin="a.begin" (the first of a ";" list). */
function resolveBegins(all: Anim[]) {
  const byId = new Map(all.filter((a) => a.id).map((a) => [a.id!, a]));
  const pending = new Set(all);
  for (let pass = 0; pass < 8 && pending.size; pass++) {
    for (const a of [...pending]) {
      const spec = a.beginSpec.split(";")[0].trim();
      const sync = spec.match(/^([\w-]+)\.(begin|end)\s*(?:([+-])\s*(.+))?$/);
      if (sync) {
        const ref = byId.get(sync[1]);
        if (!ref) {
          a.begin = Infinity;
          pending.delete(a);
          continue;
        }
        if (pending.has(ref)) continue;
        const base = sync[2] === "begin" ? ref.begin : ref.begin + ref.active;
        const off = sync[3] ? clockValue(sync[4]) * (sync[3] === "-" ? -1 : 1) : 0;
        a.begin = base + (Number.isFinite(off) ? off : 0);
      } else {
        const v = clockValue(spec);
        a.begin = Number.isFinite(v) || v === Infinity ? v : 0;
      }
      pending.delete(a);
    }
  }
  for (const a of pending) a.begin = Infinity;
}

function addNumbers(a: string, b: string): string {
  const na = numbersIn(a);
  const nb = numbersIn(b);
  return na.map((v, i) => v + (nb[i] ?? 0)).join(" ");
}

// ── Values over time ────────────────────────────────────────────────

const NUM_RE = /[-+]?(?:\d*\.\d+|\d+\.?)(?:e[-+]?\d+)?/gi;

function numbersIn(s: string): number[] {
  return (s.match(NUM_RE) ?? []).map(Number);
}

function cubicEase(x1: number, y1: number, x2: number, y2: number, x: number): number {
  // Solve the bezier's x for t (Newton, then bisection), return its y.
  const bx = (t: number) => 3 * (1 - t) * (1 - t) * t * x1 + 3 * (1 - t) * t * t * x2 + t * t * t;
  const by = (t: number) => 3 * (1 - t) * (1 - t) * t * y1 + 3 * (1 - t) * t * t * y2 + t * t * t;
  let lo = 0;
  let hi = 1;
  let t = x;
  for (let i = 0; i < 20; i++) {
    const v = bx(t);
    if (Math.abs(v - x) < 1e-4) break;
    if (v < x) lo = t;
    else hi = t;
    t = (lo + hi) / 2;
  }
  return by(t);
}

/** Where in its values list an animation is at time t: segment index and fraction. Null when inactive. */
function progressAt(a: Anim, t: number): { i: number; f: number } | null {
  if (!Number.isFinite(a.begin) || t < a.begin) return null;
  let local = t - a.begin;
  let ended = false;
  if (local >= a.active) {
    if (!a.freeze) return null;
    local = a.active;
    ended = true;
  }
  const n = a.kind === "motion" ? 2 : a.values.length;
  if (!Number.isFinite(a.dur)) return { i: 0, f: 0 };
  let p = (local % a.dur) / a.dur;
  if (ended && local > 0 && Math.abs(local / a.dur - Math.round(local / a.dur)) < 1e-6) p = 1;
  if (n <= 1) return { i: 0, f: 0 };
  const discrete = a.calcMode === "discrete";
  const segs = discrete ? n : n - 1;
  const kt = a.keyTimes && a.keyTimes.length === n ? a.keyTimes : null;
  if (discrete) {
    let i = Math.min(n - 1, Math.floor(p * n));
    if (kt) {
      i = 0;
      for (let k = 0; k < n; k++) if (p >= kt[k]) i = k;
    }
    return { i: p >= 1 ? n - 1 : i, f: 0 };
  }
  let i: number;
  let f: number;
  if (kt) {
    i = 0;
    while (i < n - 2 && p >= kt[i + 1]) i++;
    const span = kt[i + 1] - kt[i];
    f = span > 0 ? (p - kt[i]) / span : 1;
  } else {
    i = Math.min(segs - 1, Math.floor(p * segs));
    f = p * segs - i;
  }
  f = Math.max(0, Math.min(1, f));
  if (a.calcMode === "spline" && a.keySplines?.[i]) {
    const s = a.keySplines[i];
    f = cubicEase(s[0], s[1], s[2], s[3], f);
  }
  return { i, f };
}

function lerpValue(a: string, b: string, f: number): string {
  if (f <= 0) return a;
  if (f >= 1) return b;
  const ca = parseColor(a);
  const cb = parseColor(b);
  if (ca && cb) {
    const m = ca.map((v, k) => v + (cb[k] - v) * f);
    return `rgba(${Math.round(m[0])},${Math.round(m[1])},${Math.round(m[2])},${m[3].toFixed(3)})`;
  }
  const na = numbersIn(a);
  const nb = numbersIn(b);
  if (na.length && na.length === nb.length) {
    let k = 0;
    return a.replace(NUM_RE, () => {
      const v = na[k] + (nb[k] - na[k]) * f;
      k++;
      return String(Math.round(v * 1000) / 1000);
    });
  }
  return f < 0.5 ? a : b;
}

function animValue(a: Anim, t: number, base: string): string | null {
  const pr = progressAt(a, t);
  if (!pr) return null;
  const vals = a.values.map((v) => (v === "" ? base : v));
  if (vals.length === 1) return vals[0];
  return lerpValue(vals[pr.i], vals[Math.min(vals.length - 1, pr.i + 1)], pr.f);
}

// ── Transforms ──────────────────────────────────────────────────────

type M = [number, number, number, number, number, number];
const I: M = [1, 0, 0, 1, 0, 0];

function mul(p: M, q: M): M {
  return [p[0] * q[0] + p[2] * q[1], p[1] * q[0] + p[3] * q[1], p[0] * q[2] + p[2] * q[3], p[1] * q[2] + p[3] * q[3], p[0] * q[4] + p[2] * q[5] + p[4], p[1] * q[4] + p[3] * q[5] + p[5]];
}

function transformOf(type: string, n: number[]): M {
  const r = (deg: number) => (deg * Math.PI) / 180;
  switch (type) {
    case "translate":
      return [1, 0, 0, 1, n[0] ?? 0, n[1] ?? 0];
    case "scale":
      return [n[0] ?? 1, 0, 0, n[1] ?? n[0] ?? 1, 0, 0];
    case "rotate": {
      const c = Math.cos(r(n[0] ?? 0));
      const s = Math.sin(r(n[0] ?? 0));
      const rot: M = [c, s, -s, c, 0, 0];
      if (n.length >= 3) return mul(mul([1, 0, 0, 1, n[1], n[2]], rot), [1, 0, 0, 1, -n[1], -n[2]]);
      return rot;
    }
    case "skewx":
      return [1, 0, Math.tan(r(n[0] ?? 0)), 1, 0, 0];
    case "skewy":
      return [1, Math.tan(r(n[0] ?? 0)), 0, 1, 0, 0];
    case "matrix":
      return n.length >= 6 ? [n[0], n[1], n[2], n[3], n[4], n[5]] : I;
  }
  return I;
}

const transformCache = new Map<string, M>();

function parseTransform(s: string | undefined): M {
  if (!s) return I;
  const hit = transformCache.get(s);
  if (hit) return hit;
  let m: M = I;
  for (const part of s.matchAll(/(matrix|translate|scale|rotate|skewX|skewY)\s*\(([^)]*)\)/gi)) {
    m = mul(m, transformOf(part[1].toLowerCase(), numbersIn(part[2])));
  }
  if (transformCache.size > 2000) transformCache.clear();
  transformCache.set(s, m);
  return m;
}

// ── Colors ──────────────────────────────────────────────────────────

const NAMED: Record<string, string> = {
  black: "000000", white: "ffffff", red: "ff0000", green: "008000", blue: "0000ff", yellow: "ffff00", orange: "ffa500", purple: "800080",
  pink: "ffc0cb", brown: "a52a2a", gray: "808080", grey: "808080", silver: "c0c0c0", gold: "ffd700", navy: "000080", teal: "008080",
  aqua: "00ffff", cyan: "00ffff", magenta: "ff00ff", fuchsia: "ff00ff", lime: "00ff00", maroon: "800000", olive: "808000",
  lightblue: "add8e6", lightgreen: "90ee90", lightgray: "d3d3d3", lightgrey: "d3d3d3", darkgray: "a9a9a9", darkgrey: "a9a9a9",
  darkblue: "00008b", darkgreen: "006400", darkred: "8b0000", skyblue: "87ceeb", steelblue: "4682b4", royalblue: "4169e1",
  dodgerblue: "1e90ff", deepskyblue: "00bfff", cornflowerblue: "6495ed", slategray: "708090", slateblue: "6a5acd",
  tomato: "ff6347", coral: "ff7f50", salmon: "fa8072", crimson: "dc143c", firebrick: "b22222", indianred: "cd5c5c",
  hotpink: "ff69b4", deeppink: "ff1493", violet: "ee82ee", orchid: "da70d6", plum: "dda0dd", indigo: "4b0082",
  lavender: "e6e6fa", beige: "f5f5dc", ivory: "fffff0", khaki: "f0e68c", tan: "d2b48c", chocolate: "d2691e", sienna: "a0522d",
  peru: "cd853f", wheat: "f5deb3", linen: "faf0e6", snow: "fffafa", whitesmoke: "f5f5f5", gainsboro: "dcdcdc",
  forestgreen: "228b22", seagreen: "2e8b57", limegreen: "32cd32", springgreen: "00ff7f", yellowgreen: "9acd32",
  olivedrab: "6b8e23", darkolivegreen: "556b2f", mediumseagreen: "3cb371", turquoise: "40e0d0", aquamarine: "7fffd4",
  darkorange: "ff8c00", orangered: "ff4500", goldenrod: "daa520", darkgoldenrod: "b8860b", lightyellow: "ffffe0",
  lightpink: "ffb6c1", mistyrose: "ffe4e1", peachpuff: "ffdab9", moccasin: "ffe4b5", bisque: "ffe4c4", navajowhite: "ffdead",
  midnightblue: "191970", darkslategray: "2f4f4f", dimgray: "696969", dimgrey: "696969", rosybrown: "bc8f8f",
  saddlebrown: "8b4513", sandybrown: "f4a460", burlywood: "deb887", cadetblue: "5f9ea0", powderblue: "b0e0e6",
  lightsteelblue: "b0c4de", mediumpurple: "9370db", darkviolet: "9400d3", darkmagenta: "8b008b", mediumvioletred: "c71585",
  palevioletred: "db7093", lightcoral: "f08080", darksalmon: "e9967a", lightsalmon: "ffa07a", palegreen: "98fb98",
  mintcream: "f5fffa", honeydew: "f0fff0", azure: "f0ffff", aliceblue: "f0f8ff", ghostwhite: "f8f8ff", seashell: "fff5ee",
  oldlace: "fdf5e6", cornsilk: "fff8dc", lemonchiffon: "fffacd", floralwhite: "fffaf0", antiquewhite: "faebd7",
  lightcyan: "e0ffff", paleturquoise: "afeeee", mediumturquoise: "48d1cc", darkturquoise: "00ced1", lightseagreen: "20b2aa",
  darkcyan: "008b8b", mediumaquamarine: "66cdaa", darkseagreen: "8fbc8f", lawngreen: "7cfc00", chartreuse: "7fff00",
  greenyellow: "adff2f", mediumspringgreen: "00fa9a", darkkhaki: "bdb76b", palegoldenrod: "eee8aa", lightgoldenrodyellow: "fafad2",
  thistle: "d8bfd8", mediumorchid: "ba55d3", darkorchid: "9932cc", blueviolet: "8a2be2", mediumslateblue: "7b68ee",
  darkslateblue: "483d8b", lightslategray: "778899", mediumblue: "0000cd", lightskyblue: "87cefa", rebeccapurple: "663399",
};

/** [r, g, b, a] (0-255, alpha 0-1) or null. */
export function parseColor(s: string | undefined): [number, number, number, number] | null {
  if (!s) return null;
  const v = s.trim().toLowerCase();
  if (v === "transparent") return [0, 0, 0, 0];
  const hex = v.startsWith("#") ? v.slice(1) : NAMED[v];
  if (hex && /^[0-9a-f]+$/.test(hex)) {
    if (hex.length === 3 || hex.length === 4) {
      const c = hex.split("").map((ch) => parseInt(ch + ch, 16));
      return [c[0], c[1], c[2], hex.length === 4 ? c[3] / 255 : 1];
    }
    if (hex.length === 6 || hex.length === 8) {
      return [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16), hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1];
    }
  }
  const fn = v.match(/^(rgba?|hsla?)\(([^)]*)\)$/);
  if (fn) {
    const parts = fn[2].split(/[\s,/]+/).filter(Boolean);
    const num = (p: string, max: number) => (p.endsWith("%") ? (parseFloat(p) / 100) * max : parseFloat(p));
    const alpha = parts[3] !== undefined ? num(parts[3], 1) : 1;
    if (fn[1].startsWith("rgb")) return [num(parts[0], 255), num(parts[1], 255), num(parts[2], 255), alpha];
    const h = (((parseFloat(parts[0]) % 360) + 360) % 360) / 360;
    const sat = num(parts[1], 1);
    const l = num(parts[2], 1);
    const q = l < 0.5 ? l * (1 + sat) : l + sat - l * sat;
    const p = 2 * l - q;
    const conv = (x: number) => {
      const tt = x < 0 ? x + 1 : x > 1 ? x - 1 : x;
      if (tt < 1 / 6) return p + (q - p) * 6 * tt;
      if (tt < 1 / 2) return q;
      if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
      return p;
    };
    return [conv(h + 1 / 3) * 255, conv(h) * 255, conv(h - 1 / 3) * 255, alpha];
  }
  return null;
}

function toHex(c: [number, number, number, number]): string {
  return `#${c.slice(0, 3).map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("")}`;
}

// ── Path geometry ───────────────────────────────────────────────────

/** Absolute commands: M x y, L x y, C x1 y1 x2 y2 x y, Q x1 y1 x y, Z. */
type Cmd = { c: "M" | "L"; p: number[] } | { c: "C"; p: number[] } | { c: "Q"; p: number[] } | { c: "Z"; p: number[] };

const pathCache = new Map<string, Cmd[]>();

export function pathCommands(d: string): Cmd[] {
  const hit = pathCache.get(d);
  if (hit) return hit;
  const out: Cmd[] = [];
  const tokens = d.match(/[MmLlHhVvCcSsQqTtAaZz]|[-+]?(?:\d*\.\d+|\d+\.?)(?:e[-+]?\d+)?/g) ?? [];
  let i = 0;
  let cx = 0;
  let cy = 0;
  let sx = 0;
  let sy = 0;
  let lastCtrl: [number, number] | null = null;
  let lastQuad: [number, number] | null = null;
  let cmd = "";
  const num = () => Number(tokens[i++]);
  const more = () => i < tokens.length && !/[a-z]/i.test(tokens[i]);
  while (i < tokens.length) {
    if (/[a-z]/i.test(tokens[i])) cmd = tokens[i++];
    else if (!cmd) {
      i++;
      continue;
    }
    const rel = cmd === cmd.toLowerCase();
    const C = cmd.toUpperCase();
    if (C === "Z") {
      out.push({ c: "Z", p: [] });
      cx = sx;
      cy = sy;
      lastCtrl = lastQuad = null;
      continue;
    }
    if (!more()) {
      cmd = "";
      continue;
    }
    switch (C) {
      case "M": {
        let x = num();
        let y = num();
        if (rel) {
          x += cx;
          y += cy;
        }
        out.push({ c: "M", p: [x, y] });
        cx = sx = x;
        cy = sy = y;
        cmd = rel ? "l" : "L";
        lastCtrl = lastQuad = null;
        break;
      }
      case "L": {
        let x = num();
        let y = num();
        if (rel) {
          x += cx;
          y += cy;
        }
        out.push({ c: "L", p: [x, y] });
        cx = x;
        cy = y;
        lastCtrl = lastQuad = null;
        break;
      }
      case "H": {
        let x = num();
        if (rel) x += cx;
        out.push({ c: "L", p: [x, cy] });
        cx = x;
        lastCtrl = lastQuad = null;
        break;
      }
      case "V": {
        let y = num();
        if (rel) y += cy;
        out.push({ c: "L", p: [cx, y] });
        cy = y;
        lastCtrl = lastQuad = null;
        break;
      }
      case "C":
      case "S": {
        let x1: number, y1: number;
        if (C === "C") {
          x1 = num() + (rel ? cx : 0);
          y1 = num() + (rel ? cy : 0);
        } else {
          x1 = lastCtrl ? 2 * cx - lastCtrl[0] : cx;
          y1 = lastCtrl ? 2 * cy - lastCtrl[1] : cy;
        }
        const x2 = num() + (rel ? cx : 0);
        const y2 = num() + (rel ? cy : 0);
        const x = num() + (rel ? cx : 0);
        const y = num() + (rel ? cy : 0);
        out.push({ c: "C", p: [x1, y1, x2, y2, x, y] });
        lastCtrl = [x2, y2];
        lastQuad = null;
        cx = x;
        cy = y;
        break;
      }
      case "Q":
      case "T": {
        let x1: number, y1: number;
        if (C === "Q") {
          x1 = num() + (rel ? cx : 0);
          y1 = num() + (rel ? cy : 0);
        } else {
          x1 = lastQuad ? 2 * cx - lastQuad[0] : cx;
          y1 = lastQuad ? 2 * cy - lastQuad[1] : cy;
        }
        const x = num() + (rel ? cx : 0);
        const y = num() + (rel ? cy : 0);
        out.push({ c: "Q", p: [x1, y1, x, y] });
        lastQuad = [x1, y1];
        lastCtrl = null;
        cx = x;
        cy = y;
        break;
      }
      case "A": {
        const rx = num();
        const ry = num();
        const rot = num();
        const large = num();
        const sweep = num();
        const x = num() + (rel ? cx : 0);
        const y = num() + (rel ? cy : 0);
        for (const seg of arcToCubics(cx, cy, rx, ry, rot, !!large, !!sweep, x, y)) out.push({ c: "C", p: seg });
        cx = x;
        cy = y;
        lastCtrl = lastQuad = null;
        break;
      }
      default:
        i++;
    }
  }
  if (pathCache.size > 3000) pathCache.clear();
  pathCache.set(d, out);
  return out;
}

function arcToCubics(x1: number, y1: number, rx: number, ry: number, rotDeg: number, large: boolean, sweep: boolean, x2: number, y2: number): number[][] {
  if (rx === 0 || ry === 0 || (x1 === x2 && y1 === y2)) return [[x1, y1, x2, y2, x2, y2]];
  rx = Math.abs(rx);
  ry = Math.abs(ry);
  const phi = (rotDeg * Math.PI) / 180;
  const cos = Math.cos(phi);
  const sin = Math.sin(phi);
  const dx = (x1 - x2) / 2;
  const dy = (y1 - y2) / 2;
  const x1p = cos * dx + sin * dy;
  const y1p = -sin * dx + cos * dy;
  const lambda = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry);
  if (lambda > 1) {
    rx *= Math.sqrt(lambda);
    ry *= Math.sqrt(lambda);
  }
  const num = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p;
  const den = rx * rx * y1p * y1p + ry * ry * x1p * x1p;
  let co = Math.sqrt(Math.max(0, num / den));
  if (large === sweep) co = -co;
  const cxp = (co * rx * y1p) / ry;
  const cyp = (-co * ry * x1p) / rx;
  const cx = cos * cxp - sin * cyp + (x1 + x2) / 2;
  const cy = sin * cxp + cos * cyp + (y1 + y2) / 2;
  const angle = (ux: number, uy: number, vx: number, vy: number) => {
    const a = Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
    return a;
  };
  const t1 = angle(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry);
  let dt = angle((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry);
  if (!sweep && dt > 0) dt -= Math.PI * 2;
  if (sweep && dt < 0) dt += Math.PI * 2;
  const segs = Math.ceil(Math.abs(dt) / (Math.PI / 2));
  const out: number[][] = [];
  const step = dt / segs;
  const k = (4 / 3) * Math.tan(step / 4);
  let a = t1;
  const pt = (ang: number) => {
    const ex = rx * Math.cos(ang);
    const ey = ry * Math.sin(ang);
    return [cx + cos * ex - sin * ey, cy + sin * ex + cos * ey];
  };
  const dp = (ang: number) => {
    const ex = -rx * Math.sin(ang);
    const ey = ry * Math.cos(ang);
    return [cos * ex - sin * ey, sin * ex + cos * ey];
  };
  for (let s = 0; s < segs; s++) {
    const b = a + step;
    const p0 = pt(a);
    const p3 = pt(b);
    const d0 = dp(a);
    const d3 = dp(b);
    out.push([p0[0] + k * d0[0], p0[1] + k * d0[1], p3[0] - k * d3[0], p3[1] - k * d3[1], p3[0], p3[1]]);
    a = b;
  }
  return out;
}

function polyCommands(pts: number[], closed: boolean): Cmd[] {
  const out: Cmd[] = [];
  for (let i = 0; i + 1 < pts.length; i += 2) out.push({ c: i === 0 ? "M" : "L", p: [pts[i], pts[i + 1]] });
  if (closed && out.length) out.push({ c: "Z", p: [] });
  return out;
}

const K = 0.5522847498;

function ellipseCommands(cx: number, cy: number, rx: number, ry: number): Cmd[] {
  return [
    { c: "M", p: [cx + rx, cy] },
    { c: "C", p: [cx + rx, cy + ry * K, cx + rx * K, cy + ry, cx, cy + ry] },
    { c: "C", p: [cx - rx * K, cy + ry, cx - rx, cy + ry * K, cx - rx, cy] },
    { c: "C", p: [cx - rx, cy - ry * K, cx - rx * K, cy - ry, cx, cy - ry] },
    { c: "C", p: [cx + rx * K, cy - ry, cx + rx, cy - ry * K, cx + rx, cy] },
    { c: "Z", p: [] },
  ];
}

function rectCommands(x: number, y: number, w: number, h: number, rx: number, ry: number): Cmd[] {
  if (rx <= 0 && ry <= 0) return polyCommands([x, y, x + w, y, x + w, y + h, x, y + h], true);
  rx = Math.min(rx || ry, w / 2);
  ry = Math.min(ry || rx, h / 2);
  const kx = rx * K;
  const ky = ry * K;
  return [
    { c: "M", p: [x + rx, y] },
    { c: "L", p: [x + w - rx, y] },
    { c: "C", p: [x + w - rx + kx, y, x + w, y + ry - ky, x + w, y + ry] },
    { c: "L", p: [x + w, y + h - ry] },
    { c: "C", p: [x + w, y + h - ry + ky, x + w - rx + kx, y + h, x + w - rx, y + h] },
    { c: "L", p: [x + rx, y + h] },
    { c: "C", p: [x + rx - kx, y + h, x, y + h - ry + ky, x, y + h - ry] },
    { c: "L", p: [x, y + ry] },
    { c: "C", p: [x, y + ry - ky, x + rx - kx, y, x + rx, y] },
    { c: "Z", p: [] },
  ];
}

interface Flat {
  pts: number[];
  lens: number[];
  length: number;
  box: { x: number; y: number; w: number; h: number };
}

const flatCache = new WeakMap<Cmd[], Flat>();

/** The path as a polyline, with cumulative lengths and bounds. */
function flatten(cmds: Cmd[]): Flat {
  const hit = flatCache.get(cmds);
  if (hit) return hit;
  const pts: number[] = [];
  const lens: number[] = [];
  let len = 0;
  let cx = 0;
  let cy = 0;
  let sx = 0;
  let sy = 0;
  const push = (x: number, y: number, jump: boolean) => {
    if (pts.length && !jump) len += Math.hypot(x - pts[pts.length - 2], y - pts[pts.length - 1]);
    pts.push(x, y);
    lens.push(len);
  };
  for (const c of cmds) {
    if (c.c === "M") {
      push(c.p[0], c.p[1], true);
      cx = sx = c.p[0];
      cy = sy = c.p[1];
    } else if (c.c === "L") {
      push(c.p[0], c.p[1], false);
      cx = c.p[0];
      cy = c.p[1];
    } else if (c.c === "C" || c.c === "Q") {
      const n = 12;
      for (let k = 1; k <= n; k++) {
        const t = k / n;
        const u = 1 - t;
        let x: number, y: number;
        if (c.c === "C") {
          x = u * u * u * cx + 3 * u * u * t * c.p[0] + 3 * u * t * t * c.p[2] + t * t * t * c.p[4];
          y = u * u * u * cy + 3 * u * u * t * c.p[1] + 3 * u * t * t * c.p[3] + t * t * t * c.p[5];
        } else {
          x = u * u * cx + 2 * u * t * c.p[0] + t * t * c.p[2];
          y = u * u * cy + 2 * u * t * c.p[1] + t * t * c.p[3];
        }
        push(x, y, false);
      }
      cx = c.p[c.p.length - 2];
      cy = c.p[c.p.length - 1];
    } else if (c.c === "Z") {
      push(sx, sy, false);
      cx = sx;
      cy = sy;
    }
  }
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < pts.length; i += 2) {
    minX = Math.min(minX, pts[i]);
    maxX = Math.max(maxX, pts[i]);
    minY = Math.min(minY, pts[i + 1]);
    maxY = Math.max(maxY, pts[i + 1]);
  }
  const flat: Flat = { pts, lens, length: len, box: Number.isFinite(minX) ? { x: minX, y: minY, w: maxX - minX, h: maxY - minY } : { x: 0, y: 0, w: 0, h: 0 } };
  flatCache.set(cmds, flat);
  return flat;
}

function pointAlong(f: Flat, p: number): { x: number; y: number; angle: number } {
  const target = Math.max(0, Math.min(1, p)) * f.length;
  const n = f.lens.length;
  if (n < 2) return { x: f.pts[0] ?? 0, y: f.pts[1] ?? 0, angle: 0 };
  let i = 1;
  while (i < n - 1 && f.lens[i] < target) i++;
  const l0 = f.lens[i - 1];
  const l1 = f.lens[i];
  const k = l1 > l0 ? (target - l0) / (l1 - l0) : 0;
  const x0 = f.pts[(i - 1) * 2];
  const y0 = f.pts[(i - 1) * 2 + 1];
  const x1 = f.pts[i * 2];
  const y1 = f.pts[i * 2 + 1];
  return { x: x0 + (x1 - x0) * k, y: y0 + (y1 - y0) * k, angle: (Math.atan2(y1 - y0, x1 - x0) * 180) / Math.PI };
}

function trace(ctx: Ctx, cmds: Cmd[]) {
  ctx.beginPath();
  for (const c of cmds) {
    if (c.c === "M") ctx.moveTo(c.p[0], c.p[1]);
    else if (c.c === "L") ctx.lineTo(c.p[0], c.p[1]);
    else if (c.c === "C") ctx.bezierCurveTo(c.p[0], c.p[1], c.p[2], c.p[3], c.p[4], c.p[5]);
    else if (c.c === "Q") ctx.quadraticCurveTo(c.p[0], c.p[1], c.p[2], c.p[3]);
    else ctx.closePath();
  }
}

// ── Drawing ─────────────────────────────────────────────────────────

export interface SvgDrawOptions {
  /** Exact color swaps, e.g. { "#ffcc4d": "#3a86ff" } to match a theme. */
  colors?: Record<string, string>;
}

interface Frame {
  doc: SvgDoc;
  t: number;
  colors: Map<string, string> | null;
  vb: [number, number, number, number];
  useDepth: number;
}

/** Draw the whole SVG fitted into (0, 0, w, h) at animation time t. */
export function drawSvg(ctx: Ctx, doc: SvgDoc, t: number, w: number, h: number, opts: SvgDrawOptions = {}) {
  const [vx, vy, vw, vh] = doc.viewBox;
  const aspect = doc.aspect.trim();
  ctx.save();
  if (aspect.startsWith("none")) ctx.scale(w / vw, h / vh);
  else {
    const slice = aspect.includes("slice");
    const s = slice ? Math.max(w / vw, h / vh) : Math.min(w / vw, h / vh);
    const align = aspect.split(/\s+/)[0];
    const ax = align.includes("xMin") ? 0 : align.includes("xMax") ? 1 : 0.5;
    const ay = align.includes("YMin") ? 0 : align.includes("YMax") ? 1 : 0.5;
    if (slice) {
      ctx.beginPath();
      ctx.rect(0, 0, w, h);
      ctx.clip();
    }
    ctx.translate((w - vw * s) * ax, (h - vh * s) * ay);
    ctx.scale(s, s);
  }
  ctx.translate(-vx, -vy);
  const colors = opts.colors && Object.keys(opts.colors).length ? new Map(Object.entries(opts.colors).map(([k, v]) => [normColor(k), v])) : null;
  const frame: Frame = { doc, t: Math.max(0, t), colors, vb: doc.viewBox, useDepth: 0 };
  drawChildren(ctx, frame, doc.root, {});
  ctx.restore();
}

function normColor(c: string): string {
  const p = parseColor(c);
  return p ? toHex(p) : c.trim().toLowerCase();
}

/** A property's value at time t: inherited, then the node's own, then its animations. */
function prop(f: Frame, n: SvgNode, name: string, inherited: Record<string, string>): string | undefined {
  let v = n.props[name] ?? n.attrs[name];
  if (v === "inherit") v = inherited[name];
  if (v === undefined && INHERITED.has(name)) v = inherited[name];
  return animated(f, n, name, v);
}

function animated(f: Frame, n: SvgNode, name: string, base: string | undefined): string | undefined {
  if (!n.anims.length) return base;
  let v = base;
  for (const a of n.anims) {
    if (a.kind !== "animate" && a.kind !== "set") continue;
    if (a.attr !== name) continue;
    const val = animValue(a, f.t, v ?? "0");
    if (val === null) continue;
    if (a.additive && v !== undefined) {
      const nb = numbersIn(v);
      const na = numbersIn(val);
      if (nb.length && nb.length === na.length) {
        let k = 0;
        v = v.replace(NUM_RE, () => String(nb[k] + na[k++]));
        continue;
      }
    }
    v = val;
  }
  return v;
}

function attrNum(f: Frame, n: SvgNode, name: string, fallback = 0): number {
  const raw = animated(f, n, name, n.attrs[name]);
  if (raw === undefined) return fallback;
  const v = parseFloat(raw);
  if (!Number.isFinite(v)) return fallback;
  if (raw.trim().endsWith("%")) {
    const [, , vw, vh] = f.vb;
    const base = /^(x|cx|x1|x2|width|rx|dx)$/.test(name) ? vw : /^(y|cy|y1|y2|height|ry|dy)$/.test(name) ? vh : Math.hypot(vw, vh) / Math.SQRT2;
    return (v / 100) * base;
  }
  return v;
}

function geometry(f: Frame, n: SvgNode): Cmd[] | null {
  switch (n.tag) {
    case "path": {
      const d = animated(f, n, "d", n.attrs.d);
      return d ? pathCommands(d) : null;
    }
    case "rect": {
      const w = attrNum(f, n, "width");
      const h = attrNum(f, n, "height");
      if (w <= 0 || h <= 0) return null;
      const rxRaw = animated(f, n, "rx", n.attrs.rx);
      const ryRaw = animated(f, n, "ry", n.attrs.ry);
      const rx = rxRaw !== undefined ? attrNum(f, n, "rx") : ryRaw !== undefined ? attrNum(f, n, "ry") : 0;
      const ry = ryRaw !== undefined ? attrNum(f, n, "ry") : rx;
      return rectCommands(attrNum(f, n, "x"), attrNum(f, n, "y"), w, h, rx, ry);
    }
    case "circle": {
      const r = attrNum(f, n, "r");
      return r > 0 ? ellipseCommands(attrNum(f, n, "cx"), attrNum(f, n, "cy"), r, r) : null;
    }
    case "ellipse": {
      const rx = attrNum(f, n, "rx");
      const ry = attrNum(f, n, "ry");
      return rx > 0 && ry > 0 ? ellipseCommands(attrNum(f, n, "cx"), attrNum(f, n, "cy"), rx, ry) : null;
    }
    case "line":
      return [
        { c: "M", p: [attrNum(f, n, "x1"), attrNum(f, n, "y1")] },
        { c: "L", p: [attrNum(f, n, "x2"), attrNum(f, n, "y2")] },
      ];
    case "polyline":
    case "polygon": {
      const pts = numbersIn(animated(f, n, "points", n.attrs.points) ?? "");
      return pts.length >= 4 ? polyCommands(pts, n.tag === "polygon") : null;
    }
  }
  return null;
}

function nodeMatrix(f: Frame, n: SvgNode, inherited: Record<string, string>): M {
  let m = parseTransform(n.attrs.transform);
  let motion: M | null = null;
  for (const a of n.anims) {
    if (a.kind === "transform") {
      const pr = progressAt(a, f.t);
      if (!pr) continue;
      const vals = a.values;
      const from = numbersIn(vals[pr.i] ?? "");
      const to = numbersIn(vals[Math.min(vals.length - 1, pr.i + 1)] ?? "");
      const nums = from.map((v, k) => v + ((to[k] ?? v) - v) * pr.f);
      const tm = transformOf(a.type, nums);
      m = a.additive ? mul(m, tm) : tm;
    } else if (a.kind === "motion" && a.motion) {
      const pr = progressAt(a, f.t);
      if (!pr) continue;
      let p: number;
      if (!Number.isFinite(a.dur)) p = 0;
      else {
        const local = Math.min(f.t - a.begin, a.active);
        p = local >= a.active && a.freeze && Number.isFinite(a.active) ? 1 : (local % a.dur) / a.dur;
        if (a.keySplines?.[0] && a.calcMode === "spline") p = cubicEase(a.keySplines[0][0], a.keySplines[0][1], a.keySplines[0][2], a.keySplines[0][3], p);
      }
      const pt = pointAlong(a.motion, p);
      const rot = a.rotate === "auto" ? pt.angle : a.rotate === "auto-reverse" ? pt.angle + 180 : parseFloat(a.rotate) || 0;
      motion = mul([1, 0, 0, 1, pt.x, pt.y], transformOf("rotate", [rot]));
    }
  }
  const origin = prop(f, n, "transform-origin", inherited);
  if (origin && m !== I) {
    const [ox, oy] = originPoint(f, n, origin);
    if (ox || oy) m = mul(mul([1, 0, 0, 1, ox, oy], m), [1, 0, 0, 1, -ox, -oy]);
  }
  return motion ? mul(motion, m) : m;
}

function originPoint(f: Frame, n: SvgNode, origin: string): [number, number] {
  const parts = origin.trim().split(/\s+/);
  const fillBox = (n.props["transform-box"] ?? "").includes("fill-box");
  let box = { x: f.vb[0], y: f.vb[1], w: f.vb[2], h: f.vb[3] };
  if (fillBox) {
    const g = geometry(f, n);
    if (g) box = flatten(g).box;
  }
  const one = (s: string | undefined, horizontal: boolean): number => {
    if (s === undefined) return horizontal ? box.x + box.w / 2 : box.y + box.h / 2;
    const size = horizontal ? box.w : box.h;
    const start = horizontal ? box.x : box.y;
    if (s === "center") return start + size / 2;
    if (s === "left" || s === "top") return start;
    if (s === "right" || s === "bottom") return start + size;
    if (s.endsWith("%")) return start + (parseFloat(s) / 100) * size;
    const v = parseFloat(s);
    return Number.isFinite(v) ? (fillBox ? start + v : v) : start + size / 2;
  };
  let xs = parts[0];
  let ys = parts[1];
  if (xs === "top" || xs === "bottom") [xs, ys] = [ys, xs];
  return [one(xs, true), one(ys ?? (parts.length === 1 && parts[0] === "center" ? "center" : undefined), false)];
}

function drawChildren(ctx: Ctx, f: Frame, n: SvgNode, inherited: Record<string, string>) {
  for (const c of n.children) drawNode(ctx, f, c, inherited);
}

function inheritFrom(f: Frame, n: SvgNode, inherited: Record<string, string>): Record<string, string> {
  const out = { ...inherited };
  for (const k of INHERITED) {
    const own = n.props[k] ?? n.attrs[k];
    const v = animated(f, n, k, own === "inherit" ? inherited[k] : own);
    if (v !== undefined) out[k] = v;
  }
  return out;
}

function drawNode(ctx: Ctx, f: Frame, n: SvgNode, inherited: Record<string, string>) {
  if (n.tag.startsWith("#")) return;
  if (n.tag === "defs" || n.tag === "style" || n.tag === "title" || n.tag === "desc" || n.tag === "lineargradient" || n.tag === "radialgradient" || n.tag === "clippath" || n.tag === "symbol" || n.tag === "mask" || n.tag === "stop" || n.tag === "mpath") return;
  if (prop(f, n, "display", inherited) === "none") return;
  const style = inheritFrom(f, n, inherited);
  if (style.visibility === "hidden" && n.children.length === 0) return;

  ctx.save();
  const m = nodeMatrix(f, n, inherited);
  if (m !== I) ctx.transform(m[0], m[1], m[2], m[3], m[4], m[5]);
  const opacity = parseFloat(prop(f, n, "opacity", inherited) ?? "1");
  if (Number.isFinite(opacity)) ctx.globalAlpha *= Math.max(0, Math.min(1, opacity));
  if (ctx.globalAlpha <= 0.001) {
    ctx.restore();
    return;
  }
  const clip = prop(f, n, "clip-path", inherited);
  if (clip) applyClip(ctx, f, clip);

  switch (n.tag) {
    case "svg":
    case "g":
      drawChildren(ctx, f, n, style);
      break;
    case "use": {
      const ref = f.doc.ids.get((n.attrs.href ?? "").replace(/^#/, ""));
      if (ref && f.useDepth < 6) {
        ctx.translate(attrNum(f, n, "x"), attrNum(f, n, "y"));
        f.useDepth++;
        if (ref.tag === "symbol") drawChildren(ctx, f, ref, inheritFrom(f, ref, style));
        else drawNode(ctx, f, ref, style);
        f.useDepth--;
      }
      break;
    }
    case "text":
      drawTextNode(ctx, f, n, style);
      break;
    default: {
      const cmds = geometry(f, n);
      if (cmds && style.visibility !== "hidden") paintShape(ctx, f, n, cmds, style);
    }
  }
  ctx.restore();
}

function applyClip(ctx: Ctx, f: Frame, ref: string) {
  const id = ref.match(/url\(\s*['"]?#([^'")]+)['"]?\s*\)/)?.[1];
  const cp = id ? f.doc.ids.get(id) : undefined;
  if (!cp) return;
  ctx.beginPath();
  const add = (n: SvgNode, m: M) => {
    const mm = mul(m, parseTransform(n.attrs.transform));
    if (n.tag === "g" || n.tag === "clippath") {
      for (const c of n.children) add(c, n.tag === "clippath" ? m : mm);
      return;
    }
    if (n.tag === "use") {
      const r = f.doc.ids.get((n.attrs.href ?? "").replace(/^#/, ""));
      if (r) add(r, mul(mm, [1, 0, 0, 1, attrNum(f, n, "x"), attrNum(f, n, "y")]));
      return;
    }
    const cmds = geometry(f, n);
    if (!cmds) return;
    const tp = (x: number, y: number): [number, number] => [mm[0] * x + mm[2] * y + mm[4], mm[1] * x + mm[3] * y + mm[5]];
    for (const c of cmds) {
      if (c.c === "M") ctx.moveTo(...tp(c.p[0], c.p[1]));
      else if (c.c === "L") ctx.lineTo(...tp(c.p[0], c.p[1]));
      else if (c.c === "C") ctx.bezierCurveTo(...tp(c.p[0], c.p[1]), ...tp(c.p[2], c.p[3]), ...tp(c.p[4], c.p[5]));
      else if (c.c === "Q") ctx.quadraticCurveTo(...tp(c.p[0], c.p[1]), ...tp(c.p[2], c.p[3]));
      else ctx.closePath();
    }
  };
  add(cp, parseTransform(cp.attrs.transform));
  ctx.clip();
}

function paintOf(f: Frame, value: string | undefined, fallback: string | null, style: Record<string, string>): { color: string } | { grad: SvgNode } | null {
  const v = (value ?? fallback)?.trim();
  if (!v || v === "none") return null;
  const url = v.match(/^url\(\s*['"]?#([^'")]+)['"]?\s*\)\s*(.*)$/);
  if (url) {
    const g = f.doc.ids.get(url[1]);
    if (g && (g.tag === "lineargradient" || g.tag === "radialgradient")) return { grad: g };
    return url[2] ? paintOf(f, url[2], null, style) : null;
  }
  let c = v === "currentColor" || v === "currentcolor" ? (style.color ?? "#000") : v;
  if (f.colors) c = f.colors.get(normColor(c)) ?? c;
  return { color: c };
}

/** A gradient's stops and geometry, following href to the gradient it extends. */
function gradientSpec(f: Frame, g: SvgNode) {
  const chain: SvgNode[] = [];
  let cur: SvgNode | undefined = g;
  while (cur && chain.length < 5) {
    chain.push(cur);
    const href: string | undefined = cur.attrs.href;
    cur = href ? f.doc.ids.get(href.replace(/^#/, "")) : undefined;
  }
  const attr = (name: string) => chain.find((c) => c.attrs[name] !== undefined)?.attrs[name];
  const stopsNode = chain.find((c) => c.children.some((k) => k.tag === "stop"));
  const stops = (stopsNode?.children ?? [])
    .filter((s) => s.tag === "stop")
    .map((s) => {
      const off = s.props.offset ?? s.attrs.offset ?? "0";
      const offset = off.endsWith("%") ? parseFloat(off) / 100 : parseFloat(off);
      let color = animated(f, s, "stop-color", s.props["stop-color"] ?? s.attrs["stop-color"]) ?? "#000";
      if (f.colors) color = f.colors.get(normColor(color)) ?? color;
      const op = parseFloat(animated(f, s, "stop-opacity", s.props["stop-opacity"] ?? s.attrs["stop-opacity"]) ?? "1");
      return { offset: Math.max(0, Math.min(1, Number.isFinite(offset) ? offset : 0)), color, opacity: Number.isFinite(op) ? op : 1 };
    });
  return { attr, stops, units: attr("gradientUnits") ?? "objectBoundingBox", transform: parseTransform(attr("gradientTransform")) };
}

function gradientNum(v: string | undefined, fallback: number, unitBox: boolean, size: number): number {
  if (v === undefined) return fallback;
  const n = parseFloat(v);
  if (!Number.isFinite(n)) return fallback;
  if (v.trim().endsWith("%")) return unitBox ? n / 100 : (n / 100) * size;
  return n;
}

function colorWithAlpha(color: string, alpha: number): string {
  if (alpha >= 1) return color;
  const c = parseColor(color);
  if (!c) return color;
  return `rgba(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])},${(c[3] * alpha).toFixed(3)})`;
}

/** Fill or stroke with a gradient; the path is already traced. */
function paintGradient(ctx: Ctx, f: Frame, g: SvgNode, box: Flat["box"], mode: "fill" | "stroke", rule: CanvasFillRule) {
  const spec = gradientSpec(f, g);
  if (!spec.stops.length) return;
  if (spec.stops.length === 1) {
    ctx[mode === "fill" ? "fillStyle" : "strokeStyle"] = colorWithAlpha(spec.stops[0].color, spec.stops[0].opacity);
    if (mode === "fill") ctx.fill(rule);
    else ctx.stroke();
    return;
  }
  const unitBox = spec.units !== "userSpaceOnUse";
  const [, , vw, vh] = f.vb;
  const linear = g.tag === "lineargradient";
  let grad: CanvasGradient;
  if (linear) {
    grad = ctx.createLinearGradient(
      gradientNum(spec.attr("x1"), 0, unitBox, vw),
      gradientNum(spec.attr("y1"), 0, unitBox, vh),
      gradientNum(spec.attr("x2"), unitBox ? 1 : vw, unitBox, vw),
      gradientNum(spec.attr("y2"), 0, unitBox, vh)
    );
  } else {
    const cx = gradientNum(spec.attr("cx"), unitBox ? 0.5 : vw / 2, unitBox, vw);
    const cy = gradientNum(spec.attr("cy"), unitBox ? 0.5 : vh / 2, unitBox, vh);
    const r = gradientNum(spec.attr("r"), unitBox ? 0.5 : Math.hypot(vw, vh) / Math.SQRT2 / 2, unitBox, Math.hypot(vw, vh) / Math.SQRT2);
    const fx = gradientNum(spec.attr("fx"), cx, unitBox, vw);
    const fy = gradientNum(spec.attr("fy"), cy, unitBox, vh);
    grad = ctx.createRadialGradient(fx, fy, 0, cx, cy, Math.max(1e-6, r));
  }
  let last = 0;
  for (const s of spec.stops) {
    last = Math.max(last, s.offset);
    try {
      grad.addColorStop(last, colorWithAlpha(s.color, s.opacity));
    } catch {
      /* an unparseable stop color is skipped */
    }
  }
  ctx.save();
  if (mode === "fill") {
    // The path is already in device space, so the gradient can be placed with a transform.
    if (unitBox) ctx.transform(Math.max(box.w, 1e-6), 0, 0, Math.max(box.h, 1e-6), box.x, box.y);
    const gt = spec.transform;
    if (gt !== I) ctx.transform(gt[0], gt[1], gt[2], gt[3], gt[4], gt[5]);
    ctx.fillStyle = grad;
    ctx.fill(rule);
  } else {
    ctx.strokeStyle = unitBox && linear ? strokeGradientUser(ctx, spec, box) : grad;
    ctx.stroke();
  }
  ctx.restore();
}

function strokeGradientUser(ctx: Ctx, spec: ReturnType<typeof gradientSpec>, box: Flat["box"]): CanvasGradient {
  const px = (v: string | undefined, d: number) => box.x + gradientNum(v, d, true, 1) * box.w;
  const py = (v: string | undefined, d: number) => box.y + gradientNum(v, d, true, 1) * box.h;
  const grad = ctx.createLinearGradient(px(spec.attr("x1"), 0), py(spec.attr("y1"), 0), px(spec.attr("x2"), 1), py(spec.attr("y2"), 0));
  for (const s of spec.stops) {
    try {
      grad.addColorStop(s.offset, colorWithAlpha(s.color, s.opacity));
    } catch {
      /* skipped */
    }
  }
  return grad;
}

function paintShape(ctx: Ctx, f: Frame, n: SvgNode, cmds: Cmd[], style: Record<string, string>) {
  const fill = paintOf(f, style.fill, "#000", style);
  const stroke = paintOf(f, style.stroke, null, style);
  if (!fill && !stroke) return;
  const noFill = n.tag === "line" || n.tag === "polyline" ? !style.fill : false;
  trace(ctx, cmds);
  const rule: CanvasFillRule = style["fill-rule"] === "evenodd" ? "evenodd" : "nonzero";
  const base = ctx.globalAlpha;
  const flat = flatten(cmds);

  if (fill && !noFill) {
    const fo = parseFloat(style["fill-opacity"] ?? "1");
    ctx.globalAlpha = base * (Number.isFinite(fo) ? Math.max(0, Math.min(1, fo)) : 1);
    if ("grad" in fill) paintGradient(ctx, f, fill.grad, flat.box, "fill", rule);
    else {
      ctx.fillStyle = safeStyle(fill.color);
      ctx.fill(rule);
    }
  }
  if (stroke) {
    const width = parseFloat(style["stroke-width"] ?? "1");
    if (Number.isFinite(width) && width > 0) {
      const so = parseFloat(style["stroke-opacity"] ?? "1");
      ctx.globalAlpha = base * (Number.isFinite(so) ? Math.max(0, Math.min(1, so)) : 1);
      ctx.lineWidth = width;
      ctx.lineCap = (style["stroke-linecap"] as CanvasLineCap) ?? "butt";
      ctx.lineJoin = (style["stroke-linejoin"] as CanvasLineJoin) === ("arcs" as CanvasLineJoin) ? "round" : ((style["stroke-linejoin"] as CanvasLineJoin) ?? "miter");
      const ml = parseFloat(style["stroke-miterlimit"] ?? "4");
      if (Number.isFinite(ml)) ctx.miterLimit = ml;
      // pathLength rescales dash lengths to the real path length (used for "draw-on" animations).
      const pl = parseFloat(animated(f, n, "pathLength", n.attrs.pathLength) ?? "");
      const k = Number.isFinite(pl) && pl > 0 ? flat.length / pl : 1;
      const dashRaw = style["stroke-dasharray"];
      if (dashRaw && dashRaw !== "none") {
        let dash = numbersIn(dashRaw).map((d) => Math.max(0, d * k));
        if (dash.length % 2) dash = [...dash, ...dash];
        if (dash.some((d) => d > 0)) ctx.setLineDash(dash);
        ctx.lineDashOffset = (parseFloat(style["stroke-dashoffset"] ?? "0") || 0) * k;
      }
      if ("grad" in stroke) paintGradient(ctx, f, stroke.grad, flat.box, "stroke", rule);
      else {
        ctx.strokeStyle = safeStyle(stroke.color);
        ctx.stroke();
      }
    }
  }
  ctx.globalAlpha = base;
}

function safeStyle(c: string): string {
  const p = parseColor(c);
  if (!p) return "#000";
  return p[3] >= 1 ? toHex(p) : `rgba(${Math.round(p[0])},${Math.round(p[1])},${Math.round(p[2])},${p[3]})`;
}

const GENERIC_FONTS: Record<string, string> = {
  "sans-serif": "'Segoe UI', Arial, sans-serif",
  serif: "Georgia, 'Times New Roman', serif",
  monospace: "Consolas, 'Courier New', monospace",
  cursive: "'Comic Sans MS', 'Segoe Print', cursive",
};

function drawTextNode(ctx: Ctx, f: Frame, n: SvgNode, style: Record<string, string>) {
  let x = attrNum(f, n, "x");
  let y = attrNum(f, n, "y");
  const run = (node: SvgNode, st: Record<string, string>) => {
    const size = parseFloat(st["font-size"] ?? "16") || 16;
    const family = (st["font-family"] ?? "sans-serif").split(",").map((s) => s.trim().replace(/['"]/g, ""));
    const stack = family.map((fam) => GENERIC_FONTS[fam] ?? `'${fam}'`).join(", ");
    const weight = st["font-weight"] ?? "normal";
    ctx.font = `${st["font-style"] === "italic" ? "italic " : ""}${weight === "bold" || Number(weight) >= 600 ? "bold " : ""}${size}px ${stack}`;
    const anchor = st["text-anchor"];
    ctx.textAlign = anchor === "middle" ? "center" : anchor === "end" ? "right" : "left";
    const base = st["dominant-baseline"] ?? "";
    ctx.textBaseline = base === "middle" || base === "central" ? "middle" : base === "hanging" || base === "text-before-edge" ? "top" : "alphabetic";
    for (const c of node.children) {
      if (c.tag === "#text") {
        const text = (c.text ?? "").replace(/\s+/g, " ");
        if (!text.trim()) continue;
        const fill = paintOf(f, st.fill, "#000", st);
        const stroke = paintOf(f, st.stroke, null, st);
        if (stroke && "color" in stroke) {
          ctx.lineWidth = parseFloat(st["stroke-width"] ?? "1") || 1;
          ctx.strokeStyle = safeStyle(stroke.color);
          ctx.lineJoin = "round";
          ctx.strokeText(text.trim(), x, y);
        }
        if (fill && "color" in fill) {
          ctx.fillStyle = safeStyle(fill.color);
          ctx.fillText(text.trim(), x, y);
        }
        x += ctx.measureText(text).width;
      } else if (c.tag === "tspan") {
        const cs = inheritFrom(f, c, st);
        if (c.attrs.x !== undefined) x = attrNum(f, c, "x");
        if (c.attrs.y !== undefined) y = attrNum(f, c, "y");
        x += attrNum(f, c, "dx");
        y += attrNum(f, c, "dy");
        run(c, cs);
      }
    }
  };
  run(n, style);
}

// ── Checks ──────────────────────────────────────────────────────────

/**
 * Markup that travelled through JSON can arrive still escaped (\" around every attribute),
 * which parses as tags with no attributes and draws nothing. Undo that.
 */
export function cleanSvgMarkup(markup: string): string {
  const s = markup.trim();
  if (!/\\["'\\/]/.test(s) && !s.includes("\\n")) return s;
  return s
    .replace(/\\r/g, "")
    .replace(/\\n/g, "\n")
    .replace(/\\t/g, "\t")
    .replace(/\\(["'\\/])/g, "$1")
    .trim();
}

/** Why an SVG can't be used, or null when it draws. */
export function svgProblem(markup: string): string | null {
  if (markup.length > 200_000) return "the SVG is too large (over 200 KB)";
  const doc = parseSvg(markup);
  if (!doc) return "there is no <svg> element";
  let shapes = 0;
  const walk = (n: SvgNode) => {
    if (["path", "rect", "circle", "ellipse", "line", "polyline", "polygon", "text", "use"].includes(n.tag)) shapes++;
    n.children.forEach(walk);
  };
  walk(doc.root);
  for (const n of doc.ids.values()) if (n.tag === "symbol" || n.tag === "clippath") n.children.forEach(walk);
  if (!shapes) return "the SVG draws nothing";
  return null;
}

/** The colors an SVG uses most, for recoloring and theme matching. */
export function svgColors(markup: string): string[] {
  const doc = parseSvg(markup);
  if (!doc) return [];
  const count = new Map<string, number>();
  const walk = (n: SvgNode) => {
    for (const k of ["fill", "stroke", "stop-color"]) {
      const v = n.props[k] ?? n.attrs[k];
      const c = v ? parseColor(v) : null;
      if (c && c[3] > 0) {
        const hex = toHex(c);
        count.set(hex, (count.get(hex) ?? 0) + 1);
      }
    }
    n.children.forEach(walk);
  };
  walk(doc.root);
  return [...count.entries()].sort((a, b) => b[1] - a[1]).map(([c]) => c);
}
