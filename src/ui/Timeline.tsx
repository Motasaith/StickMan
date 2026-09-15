import { memo, useEffect, useRef, useState } from "react";
import { Pause, Play, Repeat, SkipBack } from "lucide-react";
import { useStore } from "../store";
import { cloneScene, findObj, type Scene, type Tracks } from "../engine/scene";
import { keyTimes, moveKeysAt } from "../engine/tracks";

const CAMERA = "__camera";

export function Timeline() {
  const scene = useStore((s) => s.scene);
  const selectedId = useStore((s) => s.selectedId);
  const selectedKey = useStore((s) => s.selectedKey);
  const tracksRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(600);

  useEffect(() => {
    const el = tracksRef.current!;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const pps = width / Math.max(0.5, scene.duration);
  const timeFromX = (clientX: number) => {
    const rect = tracksRef.current!.getBoundingClientRect();
    return Math.max(0, Math.min(scene.duration, (clientX - rect.left) / pps));
  };

  const scrub = (e: React.PointerEvent) => {
    const s = useStore.getState();
    s.setPlaying(false);
    s.setTime(timeFromX(e.clientX));
    const move = (ev: PointerEvent) => useStore.getState().setTime(timeFromX(ev.clientX));
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const dragKey = (e: React.PointerEvent, id: string, t: number) => {
    e.stopPropagation();
    const s = useStore.getState();
    s.setPlaying(false);
    s.selectKey({ id, t });
    s.setTime(t);
    const base = s.scene;
    const startX = e.clientX;
    let current = t;
    const move = (ev: PointerEvent) => {
      const snap = 1 / base.fps;
      const nt = Math.max(0, Math.round((t + (ev.clientX - startX) / pps) / snap) * snap);
      if (Math.abs(nt - current) < 1e-6) return;
      const next = cloneScene(base);
      const target = id === CAMERA ? null : findObj(next, id);
      if (target?.type === "sound") {
        target.at = nt;
        current = nt;
        useStore.getState().preview(next);
        useStore.getState().selectKey({ id, t: nt });
        useStore.getState().setTime(nt);
        return;
      }
      const tracks = id === CAMERA ? next.camera.tracks : target?.tracks;
      if (!tracks) return;
      moveKeysAt(tracks, t, nt);
      current = nt;
      useStore.getState().preview(next);
      useStore.getState().selectKey({ id, t: nt });
      useStore.getState().setTime(nt);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      if (Math.abs(current - t) > 1e-6) useStore.getState().commit(useStore.getState().scene, base);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const rows: { id: string; name: string; tracks: Tracks }[] = [
    ...(Object.keys(scene.camera.tracks).length ? [{ id: CAMERA, name: "🎥 Camera", tracks: scene.camera.tracks }] : []),
    ...[...scene.objects].reverse().map((o) => ({ id: o.id, name: `${icon(o.type)} ${o.name}`, tracks: o.type === "sound" ? { at: [{ t: o.at, v: 1 }] } : o.tracks })),
  ];

  const step = scene.duration > 30 ? 5 : scene.duration > 12 ? 2 : 1;
  const ticks = Array.from({ length: Math.floor(scene.duration / step) + 1 }, (_, i) => i * step);

  return (
    <div className="timeline">
      <Transport scene={scene} />
      <div className="tl-body">
        <div className="tl-grid">
          <div className="tl-names">
            <div className="tl-ruler-name" />
            {rows.map((r) => (
              <div key={r.id} className={`tl-name ${selectedId === r.id ? "sel" : ""}`} onClick={() => r.id !== CAMERA && useStore.getState().select(r.id)} title={r.name}>
                {r.name}
              </div>
            ))}
          </div>
          <div className="tl-tracks" ref={tracksRef}>
            <div className="tl-ruler" onPointerDown={scrub}>
              {ticks.map((t) => (
                <div key={t} className="tick" style={{ left: t * pps }}>
                  {t}s
                </div>
              ))}
            </div>
            {rows.map((r) => (
              <Row key={r.id} id={r.id} tracks={r.tracks} pps={pps} selected={selectedId === r.id} selectedKey={selectedKey?.id === r.id ? selectedKey.t : null} onScrub={scrub} onKey={dragKey} />
            ))}
            <Playhead pps={pps} />
          </div>
        </div>
      </div>
    </div>
  );
}

const Row = memo(function Row(props: {
  id: string;
  tracks: Tracks;
  pps: number;
  selected: boolean;
  selectedKey: number | null;
  onScrub: (e: React.PointerEvent) => void;
  onKey: (e: React.PointerEvent, id: string, t: number) => void;
}) {
  const times = keyTimes(props.tracks);
  return (
    <div
      className={`tl-row ${props.selected ? "sel" : ""}`}
      onPointerDown={(e) => {
        if (props.id !== CAMERA) useStore.getState().select(props.id);
        props.onScrub(e);
      }}
    >
      {times.length > 1 && <div className="tl-span" style={{ left: times[0] * props.pps, width: (times[times.length - 1] - times[0]) * props.pps }} />}
      {times.map((t) => (
        <div
          key={t}
          className={`kf ${props.selectedKey !== null && Math.abs(props.selectedKey - t) < 0.002 ? "sel" : ""}`}
          style={{ left: t * props.pps }}
          title={`${t.toFixed(2)}s: drag to retime, Delete to remove`}
          onPointerDown={(e) => props.onKey(e, props.id, t)}
        />
      ))}
    </div>
  );
});

function Playhead({ pps }: { pps: number }) {
  const time = useStore((s) => s.time);
  return <div className="playhead" style={{ left: time * pps }} />;
}

function Transport({ scene }: { scene: Scene }) {
  const playing = useStore((s) => s.playing);
  const loop = useStore((s) => s.loop);
  const time = useStore((s) => s.time);
  return (
    <div className="transport">
      <button className="ghost" title="Back to start (Home)" onClick={() => useStore.getState().setTime(0)}>
        <SkipBack size={16} />
      </button>
      <button className="primary" title="Play / pause (Space)" onClick={() => useStore.getState().setPlaying(!playing)}>
        {playing ? <Pause size={16} /> : <Play size={16} />}
      </button>
      <button className={`ghost ${loop ? "active" : ""}`} title="Loop" onClick={() => useStore.getState().setLoop(!loop)}>
        <Repeat size={16} />
      </button>
      <span className="timecode">
        {time.toFixed(2)}s / {scene.duration.toFixed(1)}s
      </span>
      <span className="note" style={{ margin: 0 }}>
        Diamonds are keyframes: drag to retime, click + Delete to remove. ←/→ step frames.
      </span>
    </div>
  );
}

function icon(type: string) {
  return type === "stickman" ? "🧍" : type === "text" ? "🔤" : type === "bubble" ? "💬" : type === "image" ? "🖼️" : type === "creature" ? "🐾" : type === "effect" ? "✨" : type === "sound" ? "🔊" : type === "light" ? "💡" : "✏️";
}
