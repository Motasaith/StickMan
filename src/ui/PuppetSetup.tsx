import { useEffect, useRef, useState } from "react";
import { Sparkles } from "lucide-react";
import { useStore } from "../store";
import { CUTOUT_JOINTS, emptyScene, uniqueId, type Asset, type CutoutJoint } from "../engine/scene";
import { applyOps } from "../engine/ops";
import { renderScene } from "../engine/render";
import { imageLookup } from "../images";

type Joints = Record<CutoutJoint, { x: number; y: number }>;

const LABELS: Record<CutoutJoint, string> = {
  head: "Head",
  neck: "Neck",
  hip: "Hips",
  lElbow: "Elbow (left side)",
  lHand: "Hand (left side)",
  rElbow: "Elbow (right side)",
  rHand: "Hand (right side)",
  lKnee: "Knee (left side)",
  lFoot: "Foot (left side)",
  rKnee: "Knee (right side)",
  rFoot: "Foot (right side)",
};

const BONES: [CutoutJoint, CutoutJoint][] = [
  ["head", "neck"],
  ["neck", "hip"],
  ["neck", "lElbow"],
  ["lElbow", "lHand"],
  ["neck", "rElbow"],
  ["rElbow", "rHand"],
  ["hip", "lKnee"],
  ["lKnee", "lFoot"],
  ["hip", "rKnee"],
  ["rKnee", "rFoot"],
];

function template(w: number, h: number): Joints {
  const f: Record<CutoutJoint, [number, number]> = {
    head: [0.5, 0.12],
    neck: [0.5, 0.24],
    hip: [0.5, 0.55],
    lElbow: [0.3, 0.38],
    lHand: [0.22, 0.52],
    rElbow: [0.7, 0.38],
    rHand: [0.78, 0.52],
    lKnee: [0.42, 0.76],
    lFoot: [0.4, 0.95],
    rKnee: [0.58, 0.76],
    rFoot: [0.6, 0.95],
  };
  return Object.fromEntries(CUTOUT_JOINTS.map((j) => [j, { x: f[j][0] * w, y: f[j][1] * h }])) as Joints;
}

/** The box around the character: pixels that aren't transparent or the background color. */
async function silhouette(asset: Asset): Promise<{ x: number; y: number; w: number; h: number }> {
  const img = new Image();
  img.src = asset.src;
  await img.decode();
  const s = Math.min(1, 256 / Math.max(asset.w, asset.h));
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(asset.w * s));
  c.height = Math.max(1, Math.round(asset.h * s));
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0, c.width, c.height);
  const { data } = ctx.getImageData(0, 0, c.width, c.height);
  const bg = [data[0], data[1], data[2], data[3]];
  let minX = c.width, minY = c.height, maxX = -1, maxY = -1;
  for (let y = 0; y < c.height; y++) {
    for (let x = 0; x < c.width; x++) {
      const i = (y * c.width + x) * 4;
      const transparent = data[i + 3] < 24;
      const sameAsCorner = bg[3] > 200 && Math.abs(data[i] - bg[0]) + Math.abs(data[i + 1] - bg[1]) + Math.abs(data[i + 2] - bg[2]) < 40;
      if (transparent || sameAsCorner) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < 0) return { x: 0, y: 0, w: asset.w, h: asset.h };
  return { x: minX / s, y: minY / s, w: (maxX - minX + 1) / s, h: (maxY - minY + 1) / s };
}

function fitTemplate(box: { x: number; y: number; w: number; h: number }): Joints {
  const t = template(1, 1);
  return Object.fromEntries(CUTOUT_JOINTS.map((j) => [j, { x: box.x + t[j].x * box.w, y: box.y + t[j].y * box.h }])) as Joints;
}

async function downscaled(asset: Asset, max = 768): Promise<string> {
  const img = new Image();
  img.src = asset.src;
  await img.decode();
  const s = Math.min(1, max / Math.max(asset.w, asset.h));
  const c = document.createElement("canvas");
  c.width = Math.round(asset.w * s);
  c.height = Math.round(asset.h * s);
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", 0.9);
}

export function PuppetSetup({ asset, onClose }: { asset: Asset; onClose: () => void }) {
  const [joints, setJoints] = useState<Joints>(asset.joints ?? template(asset.w, asset.h));
  const [status, setStatus] = useState<string>(asset.joints ? "" : "Asking the AI to find the joints…");
  const [dragging, setDragging] = useState<CutoutJoint | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const previewRef = useRef<HTMLCanvasElement>(null);
  const boxW = 360;
  const boxH = 460;
  const k = Math.min(boxW / asset.w, boxH / asset.h);

  const findJoints = async () => {
    setStatus("Asking the AI to find the joints…");
    try {
      const res = await fetch("/api/puppet/joints", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: await downscaled(asset), w: asset.w, h: asset.h }),
      });
      const data = (await res.json()) as { joints?: Joints; error?: string };
      if (!data.joints) throw new Error(data.error ?? "no answer");
      setJoints(data.joints);
      setStatus("Found them. Drag any dot that's off.");
    } catch (err) {
      setJoints(fitTemplate(await silhouette(asset)));
      setStatus(`The AI couldn't place them (${(err as Error).message}), so the dots are fitted to the character's outline. Drag any that are off.`);
    }
  };

  useEffect(() => {
    if (!asset.joints) void findJoints();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Live preview: the puppet waving and stepping with the current joints.
  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const assets = [{ ...asset, joints }];
    const scene = applyOps(emptyScene(360, 300), [
      { op: "puppet", id: "p", asset: asset.id, x: 180, y: 285, scale: 1 },
      { op: "action", id: "p", action: "wave", at: 0.2, times: 2 },
      { op: "pose", id: "p", pose: "armsUp", at: 1.8, duration: 0.4 },
      { op: "pose", id: "p", pose: "stand", at: 2.6, duration: 0.4 },
      { op: "action", id: "p", action: "jump", at: 3.2 },
    ], assets).scene;
    scene.ground = 285;
    const images = imageLookup(assets);
    const tick = () => {
      const c = previewRef.current;
      if (c) renderScene(c.getContext("2d")!, scene, ((performance.now() - start) / 1000) % 4.6, { images });
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [asset, joints]);

  const onMove = (e: React.PointerEvent) => {
    if (!dragging || !svgRef.current) return;
    const r = svgRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(asset.w, (e.clientX - r.left) / k));
    const y = Math.max(0, Math.min(asset.h, (e.clientY - r.top) / k));
    setJoints((j) => ({ ...j, [dragging]: { x, y } }));
  };

  const save = (addToCanvas: boolean) => {
    const s = useStore.getState();
    s.updateAsset(asset.id, { joints });
    if (addToCanvas) {
      const id = uniqueId(s.scene, asset.name.replace(/\s+/g, "_"));
      const count = s.scene.objects.filter((o) => o.type === "stickman" || o.type === "creature").length;
      useStore.getState().run([{ op: "puppet", id, asset: asset.id, x: s.scene.width / 2 + [0, -200, 200, -400, 400][count % 5] }]);
      useStore.getState().select(id);
    }
    onClose();
  };

  return (
    <div className="modal-back">
      <div className="modal" style={{ width: 800, maxWidth: "95vw" }}>
        <h3>Make "{asset.name}" a character</h3>
        <p className="note" style={{ marginTop: -6 }}>
          Put each dot on the matching joint. "Left side" means the left of the picture as you look at it. Pictures where the arms and legs don't overlap the body work best.
        </p>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
          <div style={{ position: "relative", width: asset.w * k, height: asset.h * k, background: "#fff", borderRadius: 6, flex: "none" }}>
            <img src={asset.src} alt="" style={{ width: "100%", height: "100%", display: "block", borderRadius: 6 }} draggable={false} />
            <svg
              ref={svgRef}
              width={asset.w * k}
              height={asset.h * k}
              style={{ position: "absolute", inset: 0, touchAction: "none" }}
              onPointerMove={onMove}
              onPointerUp={() => setDragging(null)}
              onPointerLeave={() => setDragging(null)}
            >
              {BONES.map(([a, b]) => (
                <line key={`${a}-${b}`} x1={joints[a].x * k} y1={joints[a].y * k} x2={joints[b].x * k} y2={joints[b].y * k} stroke="#5b7cf0" strokeWidth={3} opacity={0.8} />
              ))}
              {CUTOUT_JOINTS.map((j) => (
                <circle
                  key={j}
                  cx={joints[j].x * k}
                  cy={joints[j].y * k}
                  r={j === "head" ? 9 : 7}
                  fill={j.startsWith("l") ? "#ff8a3d" : j.startsWith("r") ? "#2ec4b6" : "#5b7cf0"}
                  stroke="#fff"
                  strokeWidth={2}
                  style={{ cursor: "grab" }}
                  onPointerDown={(e) => {
                    (e.target as Element).setPointerCapture?.(e.pointerId);
                    setDragging(j);
                  }}
                >
                  <title>{LABELS[j]}</title>
                </circle>
              ))}
            </svg>
          </div>
          <div style={{ flex: 1, minWidth: 260, display: "flex", flexDirection: "column", gap: 10 }}>
            <canvas ref={previewRef} width={360} height={300} style={{ width: "100%", background: "#fff", borderRadius: 6 }} />
            <p className="note" style={{ margin: 0 }}>
              Preview: <span style={{ color: "#ff8a3d" }}>orange</span> dots are the left side of the picture, <span style={{ color: "#2ec4b6" }}>teal</span> the right.
            </p>
            {status && <p className="note" style={{ margin: 0 }}>{status}</p>}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: "auto" }}>
              <button onClick={findJoints}>
                <Sparkles size={14} /> Find joints with AI
              </button>
              <button onClick={async () => setJoints(fitTemplate(await silhouette(asset)))}>Fit dots to outline</button>
              <span className="spacer" />
              <button onClick={onClose}>Cancel</button>
              <button onClick={() => save(false)}>Save</button>
              <button className="primary" onClick={() => save(true)}>
                Save & add to canvas
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
