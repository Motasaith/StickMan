import { renderScene } from "@/engine/render";
import { api } from "@/lib/api";
import { useStore } from "@/store";
import { canvasPool, imageLookup, svgLookup } from "@/runtime/media";

/** Render a frame of the project small, for the projects page. */
export async function captureThumbnail() {
  const s = useStore.getState();
  if (!s.projectId || !s.scene.objects.length) return;
  const w = 480;
  const h = Math.round((w * s.scene.height) / s.scene.width);
  const frame = document.createElement("canvas");
  frame.width = s.scene.width;
  frame.height = s.scene.height;
  const ctx = frame.getContext("2d")!;
  const t = s.scene.slides?.length ? s.scene.slides[0].start + s.scene.slides[0].duration * 0.8 : Math.min(s.scene.duration * 0.4, 4);
  try {
    renderScene(ctx, s.scene, t, { images: imageLookup(s.assets), svgs: svgLookup(s.assets), makeCanvas: canvasPool() });
    const small = document.createElement("canvas");
    small.width = w;
    small.height = h;
    small.getContext("2d")!.drawImage(frame, 0, 0, w, h);
    await api.saveProject(s.projectId, { thumbnail: small.toDataURL("image/jpeg", 0.7) });
  } catch {
    /* a thumbnail is a nicety */
  }
}
