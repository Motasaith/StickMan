import { useEffect, useRef, useState } from "react";
import { PersonStanding, Send, Sparkles, Trash2, Upload } from "lucide-react";
import { PuppetSetup } from "./PuppetSetup";
import type { Asset } from "../engine/scene";
import { useStore } from "../store";
import { askAnimator } from "../ai";
import { fileToAsset } from "../images";
import { uniqueId } from "../engine/scene";

const EXAMPLES = [
  "A classroom: a teacher walks to a blackboard and writes 2+2=4, then turns to a student sitting at a desk and asks \"Got it?\". The student nods and says \"Yes!\"",
  "A park with a tree, a bench and a sun. A stick man runs in from the left, sits on the bench, looks up and says \"What a nice day\".",
  "Two stick men meet in the middle of a street, wave at each other and dance. Zoom the camera in on them at the end.",
  "A big title \"How to make friends\" types out, then a stick man walks in, bows and says \"Step one: say hi!\"",
  "A rainy street at night. A cartoon girl in a yellow raincoat walks her dog, the dog finds a ball, picks it up and wags its tail. She laughs and says \"Good boy!\"",
  "A robot chef in a kitchen juggles a pan, a bird flies in through the window and sits on the shelf, and the robot says \"Would you like some soup?\"",
];

export function AIPanel() {
  const chat = useStore((s) => s.chat);
  const busy = useStore((s) => s.aiBusy);
  const review = useStore((s) => s.review);
  const allAssets = useStore((s) => s.assets);
  const assets = allAssets.filter((a) => a.kind !== "audio");
  const voices = useStore((s) => s.voices);
  const [puppetFor, setPuppetFor] = useState<Asset | null>(null);
  const [prompt, setPrompt] = useState("");
  const [health, setHealth] = useState<{ configured: boolean; model: string; visionModel: string } | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/health")
      .then((r) => r.json())
      .then(setHealth)
      .catch(() => setHealth({ configured: false, model: "", visionModel: "" }));
  }, []);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [chat]);

  const send = (text = prompt) => {
    const p = text.trim();
    if (!p || busy) return;
    setPrompt("");
    void askAnimator(p);
  };

  return (
    <div className="ai">
      <div className="ai-head">
        <Sparkles size={16} color="var(--accent)" />
        <h2>AI Animator</h2>
        <span className="spacer" />
        <span className={`dot ${health ? (health.configured ? "on" : "off") : ""}`} />
        <span className="note" style={{ margin: 0 }} title={health ? `Planner: ${health.model}\nChecker: ${health.visionModel}` : ""}>
          {health ? (health.configured ? health.model : "not set up") : "…"}
        </span>
        {chat.length > 0 && (
          <button className="ghost" title="Clear conversation" onClick={() => useStore.getState().clearChat()}>
            <Trash2 size={14} />
          </button>
        )}
      </div>

      <div className="messages" ref={listRef}>
        {chat.length === 0 && (
          <div className="examples">
            <p>Describe a scene. The AI draws the props, adds characters, animates them on the timeline and plays it. Then ask for changes.</p>
            {EXAMPLES.map((ex) => (
              <button key={ex} disabled={busy} onClick={() => send(ex)}>
                {ex}
              </button>
            ))}
          </div>
        )}
        {chat.map((m) => (
          <div key={m.id} className={`msg ${m.role} ${m.pending ? "pending" : ""} ${m.error ? "error" : ""}`}>
            {m.text}
            {m.changes && m.changes.length > 0 && (
              <details>
                <summary>
                  {m.changes.filter((c) => c.ok).length} changes{m.changes.some((c) => !c.ok) ? `, ${m.changes.filter((c) => !c.ok).length} skipped` : ""}
                </summary>
                <ul>
                  {m.changes.map((c, i) => (
                    <li key={i} className={c.ok ? "" : "bad"}>
                      {c.message}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        ))}
      </div>

      <div className="composer">
        <textarea
          placeholder={busy ? "The AI is working…" : "Describe what should happen… (Enter to send)"}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
        />
        <div className="composer-row">
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <label title="After animating, the AI renders frames, looks at them and fixes what it sees">
              <input type="checkbox" checked={review} onChange={(e) => useStore.getState().setReview(e.target.checked)} />
              Check its work by looking at frames
            </label>
            <label title="Speech bubbles are spoken aloud with lip-sync">
              <input type="checkbox" checked={voices} onChange={(e) => useStore.getState().setVoices(e.target.checked)} />
              Speak the lines (voices)
            </label>
          </div>
          <button className="primary" disabled={busy || !prompt.trim()} onClick={() => send()}>
            <Send size={14} /> Send
          </button>
        </div>
      </div>

      <div className="assets">
        <div className="assets-head">
          <span>Pictures the AI can use ({assets.length})</span>
          <button className="ghost" onClick={() => fileRef.current?.click()}>
            <Upload size={14} /> Add
          </button>
        </div>
        {assets.length === 0 ? (
          <p className="note" style={{ margin: 0 }}>
            Import characters, backgrounds or props, then mention them by name ("use the city picture as the background"). Press the little person button on a character picture to make it walk and move.
          </p>
        ) : (
          <div className="asset-list">
            {assets.map((a) => (
              <div
                key={a.id}
                className="asset"
                title={`${a.name} (${a.w}×${a.h}): click to place on the canvas`}
                onClick={() => {
                  const s = useStore.getState();
                  const w = Math.min(a.w, s.scene.width * 0.4);
                  const id = uniqueId(s.scene, a.name.replace(/\s+/g, "_"));
                  s.run([{ op: "image", id, asset: a.id, x: s.scene.width / 2 - w / 2, y: s.scene.height / 2 - (w * a.h) / a.w / 2, w }]);
                  useStore.getState().select(id);
                }}
              >
                <img src={a.src} alt={a.name} />
                <span>{a.joints ? "🧍 " : ""}{a.name}</span>
                <button
                  className="puppet"
                  title={a.joints ? "Edit the character joints" : "Make this picture a character that can walk and move"}
                  onClick={(e) => {
                    e.stopPropagation();
                    setPuppetFor(a);
                  }}
                >
                  <PersonStanding size={12} />
                </button>
                <button
                  className="x danger"
                  title="Remove picture"
                  onClick={(e) => {
                    e.stopPropagation();
                    useStore.getState().removeAsset(a.id);
                  }}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
        {puppetFor && <PuppetSetup asset={puppetFor} onClose={() => setPuppetFor(null)} />}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={async (e) => {
            for (const f of Array.from(e.target.files ?? [])) {
              try {
                useStore.getState().addAsset(await fileToAsset(f, useStore.getState().assets));
              } catch {
                /* not an image */
              }
            }
            e.target.value = "";
          }}
        />
      </div>
    </div>
  );
}
