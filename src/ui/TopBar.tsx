import { useRef, useState } from "react";
import { Circle, Download, FilePlus, FolderOpen, Film, Image as ImageIcon, Minus, Redo2, Save, Square, Type, Undo2, User } from "lucide-react";
import { useStore } from "../store";
import { EFFECT_KINDS, SOUND_KINDS, uniqueId, type Project } from "../engine/scene";
import { PROP_KINDS } from "../engine/props";
import { downloadBlob, exportVideo, finalizeForPlayers } from "../export";
import { generateVoices, needsVoice } from "../voice";
import { fileToAsset } from "../images";

export function TopBar() {
  const canUndo = useStore((s) => s.past.length > 0);
  const canRedo = useStore((s) => s.future.length > 0);
  const is3d = useStore((s) => s.scene.mode === "3d");
  const openRef = useRef<HTMLInputElement>(null);
  const pictureRef = useRef<HTMLInputElement>(null);
  const [exporting, setExporting] = useState<{ progress: number; controller: AbortController; phase: string } | null>(null);
  const [exported, setExported] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const add = (make: (id: (base: string) => string, s: ReturnType<typeof useStore.getState>) => Record<string, unknown>) => {
    const s = useStore.getState();
    const op = make((base) => uniqueId(s.scene, base), s);
    s.run([op]);
    useStore.getState().select(op.id as string);
  };

  const cx = () => useStore.getState().scene.width / 2;
  const cy = () => useStore.getState().scene.height / 2;

  const save = () => {
    const { scene, assets } = useStore.getState();
    const project: Project = { scene, assets };
    downloadBlob(new Blob([JSON.stringify(project)], { type: "application/json" }), "stickman-project.json");
  };

  const open = async (file: File) => {
    try {
      const data = JSON.parse(await file.text()) as Project;
      if (data?.scene?.version !== 1 || !Array.isArray(data.scene.objects)) throw new Error("This is not a Stickman Studio project file.");
      useStore.getState().loadProject({ scene: data.scene, assets: data.assets ?? [] });
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const importPicture = async (files: FileList) => {
    for (const file of Array.from(files)) {
      try {
        const asset = await fileToAsset(file, useStore.getState().assets);
        useStore.getState().addAsset(asset);
      } catch (err) {
        setError((err as Error).message);
      }
    }
  };

  const startExport = async () => {
    const controller = new AbortController();
    setExporting({ progress: 0, controller, phase: "Getting ready…" });
    useStore.getState().setPlaying(false);
    try {
      // Lines added or edited since their voice was recorded get recorded now.
      const pre = useStore.getState();
      const stale = pre.scene.objects.filter((o) => o.type === "bubble" && needsVoice(pre.scene, o)).length;
      let voiceNote = "";
      if (pre.voices && stale) {
        setExporting((e) => (e ? { ...e, phase: `Recording ${stale} voice line${stale > 1 ? "s" : ""}…` } : e));
        const r = await generateVoices(undefined, (done, total) => setExporting((e) => (e ? { ...e, progress: done / total } : e)));
        if (r.failed.length) voiceNote = ` ${r.failed.length} line(s) couldn't be voiced: ${r.failed[0]}`;
      }
      const { scene, assets } = useStore.getState();
      setExporting((e) => (e ? { ...e, progress: 0, phase: "Rendering video…" } : e));
      let out = await exportVideo(scene, assets, (p) => setExporting((e) => (e ? { ...e, progress: p } : e)), controller.signal);
      if (out.ext === "webm" || out.audio === "opus") {
        setExporting((e) => (e ? { ...e, progress: 1, phase: "Finishing: making the sound play in every player…" } : e));
        out = await finalizeForPlayers(out);
      }
      downloadBlob(out.blob, `stickman-animation.${out.ext}`);
      const lines = scene.objects.filter((o) => o.type === "bubble" && o.audio).length;
      const sounds = scene.objects.filter((o) => o.type === "sound").length;
      setExported(
        `Saved stickman-animation.${out.ext} (${scene.duration.toFixed(1)}s, ${(out.blob.size / 1e6).toFixed(1)} MB). ` +
          (out.audio
            ? `Sound: ${lines} voice line${lines === 1 ? "" : "s"}${sounds ? ` and ${sounds} sound effect${sounds === 1 ? "" : "s"}` : ""}${out.audio === "aac" ? ", AAC so it plays in every player" : ""}.`
            : "The video has no sound (no voice lines or sound effects).") +
          (out.note ? ` ${out.note}` : "") +
          voiceNote
      );
    } catch (err) {
      if ((err as Error).name !== "AbortError") setError(`Export failed: ${(err as Error).message}`);
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="topbar">
      <div className="brand">
        <User size={18} /> Stickman Studio
      </div>
      <button className="ghost" title="New project" onClick={() => confirm("Start a new empty canvas? (You can undo.)") && useStore.getState().newProject(1280, 720)}>
        <FilePlus size={16} />
      </button>
      <button className="ghost" title="Open project file" onClick={() => openRef.current?.click()}>
        <FolderOpen size={16} />
      </button>
      <button className="ghost" title="Save project file" onClick={save}>
        <Save size={16} />
      </button>
      <div className="sep" />
      <button className="ghost" title="Undo (Ctrl+Z)" disabled={!canUndo} onClick={() => useStore.getState().undo()}>
        <Undo2 size={16} />
      </button>
      <button className="ghost" title="Redo (Ctrl+Y)" disabled={!canRedo} onClick={() => useStore.getState().redo()}>
        <Redo2 size={16} />
      </button>
      <div className="sep" />
      <button title="Add a stick man" onClick={() => add((id, s) => ({ op: "character", id: id("man"), x: cx() + [0, -200, 200, -400, 400][s.scene.objects.filter((o) => o.type === "stickman").length % 5], y: s.scene.ground, at: 0 }))}>
        <User size={15} /> Stick man
      </button>
      <select
        className="menu"
        value=""
        title="Add a dressed character or an animal"
        onChange={(e) => {
          const v = e.target.value;
          e.target.value = "";
          const spot = (s: ReturnType<typeof useStore.getState>) => cx() + [0, -200, 200, -400, 400][s.scene.objects.filter((o) => o.type === "stickman" || o.type === "creature").length % 5];
          if (v === "cartoon") add((id, s) => ({ op: "character", id: id("person"), name: "Person", x: spot(s), look: { style: "cartoon" }, voice: "man" }));
          else if (v === "robot") add((id, s) => ({ op: "character", id: id("robot"), name: "Robot", x: spot(s), look: { style: "robot", shirt: "#8ecae6" }, voice: "robot" }));
          else if (v) add((id, s) => ({ op: "creature", id: id(v), name: v[0].toUpperCase() + v.slice(1), species: v, x: spot(s), ...(v === "fish" ? { y: s.scene.height / 2 } : {}) }));
        }}
      >
        <option value="">+ Character / animal</option>
        <option value="cartoon">Cartoon person</option>
        <option value="robot">Robot</option>
        <option value="dog">Dog</option>
        <option value="cat">Cat</option>
        <option value="bird">Bird</option>
        <option value="fish">Fish</option>
      </select>
      <select
        className="menu"
        value=""
        title="Add a particle effect"
        onChange={(e) => {
          const v = e.target.value;
          e.target.value = "";
          if (!v) return;
          const small = v === "smoke" || v === "fire";
          add((id, s) => ({ op: "effect", id: id(v), kind: v, ...(small ? { x: s.scene.width / 2 - 70, y: s.scene.ground - 300, w: 140, h: 300 } : {}), at: 0 }));
        }}
      >
        <option value="">+ Effect</option>
        {EFFECT_KINDS.map((k) => (
          <option key={k} value={k}>
            {k}
          </option>
        ))}
      </select>
      <select
        className="menu"
        value=""
        title="Add a 3D prop (a real model in 3D, a front view in 2D)"
        onChange={(e) => {
          const v = e.target.value;
          e.target.value = "";
          if (!v) return;
          add((id, s) => ({ op: "prop", id: id(v), kind: v, x: s.scene.width / 2, z: s.scene.mode === "3d" ? -250 : undefined }));
        }}
      >
        <option value="">+ Prop</option>
        {PROP_KINDS.map((k) => (
          <option key={k} value={k}>
            {k}
          </option>
        ))}
      </select>
      <select
        className="menu"
        value=""
        title="Add a sound effect at the playhead"
        onChange={(e) => {
          const v = e.target.value;
          e.target.value = "";
          if (!v) return;
          const s = useStore.getState();
          const at = Math.round(s.time * 100) / 100;
          s.run([{ op: "sound", kind: v, at }]);
          const created = [...useStore.getState().scene.objects].reverse().find((o) => o.type === "sound");
          if (created) useStore.getState().select(created.id);
        }}
      >
        <option value="">+ Sound</option>
        {SOUND_KINDS.map((k) => (
          <option key={k} value={k}>
            {k}
          </option>
        ))}
      </select>
      <button title="Add text" onClick={() => add((id) => ({ op: "text", id: id("text"), text: "Text", x: cx(), y: 60, size: 56, align: "center" }))}>
        <Type size={15} /> Text
      </button>
      <button title="Add a box" onClick={() => add((id) => ({ op: "draw", id: id("box"), name: "Box", x: cx() - 100, y: cy() - 60, parts: [{ kind: "rect", x: 0, y: 0, w: 200, h: 120, r: 6, fill: "#ffd166", stroke: "#1a1a1a", width: 3 }] }))}>
        <Square size={15} />
      </button>
      <button title="Add a circle" onClick={() => add((id) => ({ op: "draw", id: id("circle"), name: "Circle", x: cx(), y: cy(), parts: [{ kind: "circle", cx: 0, cy: 0, r: 60, fill: "#8ecae6", stroke: "#1a1a1a", width: 3 }] }))}>
        <Circle size={15} />
      </button>
      <button title="Add a line" onClick={() => add((id, s) => ({ op: "draw", id: id("line"), name: "Line", x: 0, y: 0, parts: [{ kind: "line", x1: 0, y1: s.scene.ground, x2: s.scene.width, y2: s.scene.ground, stroke: "#1a1a1a", width: 3 }] }))}>
        <Minus size={15} />
      </button>
      <button title="Import pictures (characters, backgrounds, props) for you and the AI to use" onClick={() => pictureRef.current?.click()}>
        <ImageIcon size={15} /> Import picture
      </button>
      <div className="spacer" />
      <div className="segmented" title="Show the scene as flat 2D or as a 3D world">
        <button className={!is3d ? "on" : ""} onClick={() => is3d && useStore.getState().run([{ op: "scene", mode: "2d" }])}>
          2D
        </button>
        <button className={is3d ? "on" : ""} onClick={() => !is3d && useStore.getState().run([{ op: "scene", mode: "3d" }])}>
          3D
        </button>
      </div>
      <button className="primary" onClick={startExport} disabled={!!exporting}>
        <Film size={15} /> Export video
      </button>

      <input ref={openRef} type="file" accept=".json,application/json" hidden onChange={(e) => (e.target.files?.[0] && open(e.target.files[0]), (e.target.value = ""))} />
      <input ref={pictureRef} type="file" accept="image/*" multiple hidden onChange={(e) => (e.target.files && importPicture(e.target.files), (e.target.value = ""))} />

      {exporting && (
        <div className="modal-back">
          <div className="modal">
            <h3>
              <Download size={16} /> {exporting.phase}
            </h3>
            <div className="bar">
              <div style={{ width: `${Math.round(exporting.progress * 100)}%` }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span className="note">{Math.round(exporting.progress * 100)}%</span>
              <button onClick={() => exporting.controller.abort()}>Cancel</button>
            </div>
          </div>
        </div>
      )}
      {exported && (
        <div className="modal-back" onClick={() => setExported(null)}>
          <div className="modal">
            <h3>Video exported</h3>
            <p>{exported}</p>
            <button onClick={() => setExported(null)}>OK</button>
          </div>
        </div>
      )}
      {error && (
        <div className="modal-back" onClick={() => setError(null)}>
          <div className="modal">
            <h3>Something went wrong</h3>
            <p>{error}</p>
            <button onClick={() => setError(null)}>OK</button>
          </div>
        </div>
      )}
    </div>
  );
}
