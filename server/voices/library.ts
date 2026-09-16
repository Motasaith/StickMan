// Your own voices: blends (a new speaker mixed from studio voices) and clones (a speaker learned
// from a recording). Voices made in VoiceGen Studio on this machine show up here too, read-only.

import { randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { VOICEGEN_DATA_DIR, VOICES_DIR } from "./paths";
import type { BlendComponent } from "./catalog";

export interface SavedVoice {
  id: string;
  name: string;
  kind: "blend" | "clone";
  blend?: BlendComponent[];
  /** Speaker profile file (clones). */
  profile?: string;
  /** A few seconds of the reference recording (clones). */
  sample?: string;
  quality?: number;
  note?: string;
  created: number;
  source: "stickman" | "voicegen";
}

const LIBRARY = join(VOICES_DIR, "library.json");

async function readOwn(): Promise<SavedVoice[]> {
  try {
    return JSON.parse(await readFile(LIBRARY, "utf8")) as SavedVoice[];
  } catch {
    return [];
  }
}

async function writeOwn(list: SavedVoice[]) {
  await mkdir(VOICES_DIR, { recursive: true });
  await writeFile(LIBRARY, JSON.stringify(list, null, 2));
}

/** VoiceGen Studio keeps its voices in SQLite; read them without changing anything. */
async function readVoicegen(): Promise<SavedVoice[]> {
  const db = join(VOICEGEN_DATA_DIR, "voicegen.db");
  if (!existsSync(db)) return [];
  try {
    const { DatabaseSync } = await import("node:sqlite");
    const conn = new DatabaseSync(db, { readOnly: true });
    try {
      const rows = conn.prepare("SELECT id, name, kind, profile_file, sample_file, blend, quality, description, created FROM voices ORDER BY created DESC").all() as Array<Record<string, unknown>>;
      return rows
        .map((r): SavedVoice => ({
          id: String(r.id),
          name: String(r.name),
          kind: r.kind === "clone" ? "clone" : "blend",
          blend: r.blend ? (JSON.parse(String(r.blend)) as BlendComponent[]) : undefined,
          profile: r.profile_file ? String(r.profile_file) : undefined,
          sample: r.sample_file ? String(r.sample_file) : undefined,
          quality: Number(r.quality ?? 0) || undefined,
          note: r.description ? String(r.description) : undefined,
          created: Math.round(Number(r.created ?? 0) * (Number(r.created) < 1e12 ? 1000 : 1)),
          source: "voicegen",
        }))
        .filter((v) => (v.kind === "clone" ? !!v.profile && existsSync(v.profile) : !!v.blend?.length));
    } finally {
      conn.close();
    }
  } catch {
    return [];
  }
}

export async function listSavedVoices(): Promise<SavedVoice[]> {
  const [own, other] = await Promise.all([readOwn(), readVoicegen()]);
  const ids = new Set(own.map((v) => v.id));
  return [...own, ...other.filter((v) => !ids.has(v.id))];
}

export async function getSavedVoice(id: string): Promise<SavedVoice | undefined> {
  return (await listSavedVoices()).find((v) => v.id === id);
}

const newVoiceId = () => `sv_${randomBytes(5).toString("hex")}`;

export async function saveBlend(name: string, blend: BlendComponent[], note?: string): Promise<SavedVoice> {
  const voice: SavedVoice = { id: newVoiceId(), name, kind: "blend", blend, note, created: Date.now(), source: "stickman" };
  await writeOwn([voice, ...(await readOwn())]);
  return voice;
}

/** A place for a new clone's files, before it is enrolled. */
export function clonePaths() {
  const id = newVoiceId();
  return { id, profile: join(VOICES_DIR, "profiles", `${id}.json`) };
}

export async function addClone(v: { id: string; name: string; profile: string; sample?: string; quality?: number; note?: string }): Promise<SavedVoice> {
  const voice: SavedVoice = { ...v, kind: "clone", created: Date.now(), source: "stickman" };
  await writeOwn([voice, ...(await readOwn())]);
  return voice;
}

export async function deleteSavedVoice(id: string) {
  const own = await readOwn();
  const voice = own.find((v) => v.id === id);
  if (!voice) throw new Error("Only voices made in this app can be deleted here.");
  await writeOwn(own.filter((v) => v.id !== id));
  for (const f of [voice.profile, voice.sample]) if (f) await rm(f, { force: true }).catch(() => {});
}
