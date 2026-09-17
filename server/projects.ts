// Projects saved on this computer, with version history: automatic snapshots at most every
// ten minutes while working, plus named ones. Files: DATA_DIR/projects/<id>.json and
// DATA_DIR/versions/<id>/<time>.json.

import { mkdir, readdir, readFile, rm, stat, writeFile, rename } from "node:fs/promises";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { DATA_DIR } from "./media";

const PROJECTS = join(DATA_DIR, "projects");
const VERSIONS = join(DATA_DIR, "versions");
const AUTO_EVERY_MS = 10 * 60 * 1000;
const MAX_AUTO_VERSIONS = 30;

export interface ProjectFile {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  /** A small JPEG data URL of a frame, for the projects page. */
  thumbnail: string | null;
  scene: unknown;
  assets: unknown[];
  /** What kind of project it started as ("animation", "presentation", "video"). */
  kind?: string;
}

export interface ProjectSummary {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  thumbnail: string | null;
  kind?: string;
  duration?: number;
  format?: string;
}

const validId = (id: string) => /^p_[0-9a-f]{12}$/.test(id);

async function atomicWrite(path: string, text: string) {
  const tmp = `${path}.${randomBytes(3).toString("hex")}.tmp`;
  await writeFile(tmp, text);
  await rename(tmp, path);
}

export async function listProjects(): Promise<ProjectSummary[]> {
  await mkdir(PROJECTS, { recursive: true });
  const files = (await readdir(PROJECTS)).filter((f) => f.endsWith(".json"));
  const out: ProjectSummary[] = [];
  for (const f of files) {
    try {
      const p = JSON.parse(await readFile(join(PROJECTS, f), "utf8")) as ProjectFile;
      const scene = p.scene as { duration?: number; width?: number; height?: number };
      const ratio = scene.width && scene.height ? (scene.width > scene.height ? "16:9" : scene.width < scene.height ? "9:16" : "1:1") : undefined;
      out.push({ id: p.id, title: p.title, createdAt: p.createdAt, updatedAt: p.updatedAt, thumbnail: p.thumbnail, kind: p.kind, duration: scene.duration, format: ratio });
    } catch {
      /* a damaged file is skipped */
    }
  }
  return out.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function getProject(id: string): Promise<ProjectFile | null> {
  if (!validId(id)) return null;
  try {
    return JSON.parse(await readFile(join(PROJECTS, `${id}.json`), "utf8")) as ProjectFile;
  } catch {
    return null;
  }
}

export async function createProject(data: { title?: string; scene: unknown; assets?: unknown[]; kind?: string }): Promise<ProjectFile> {
  await mkdir(PROJECTS, { recursive: true });
  const now = Date.now();
  const p: ProjectFile = {
    id: `p_${randomBytes(6).toString("hex")}`,
    title: (data.title ?? "Untitled project").slice(0, 100),
    createdAt: now,
    updatedAt: now,
    thumbnail: null,
    scene: data.scene,
    assets: data.assets ?? [],
    kind: data.kind,
  };
  await atomicWrite(join(PROJECTS, `${p.id}.json`), JSON.stringify(p));
  return p;
}

export async function saveProject(id: string, patch: Partial<Pick<ProjectFile, "title" | "scene" | "assets" | "thumbnail" | "kind">>): Promise<ProjectFile> {
  const p = await getProject(id);
  if (!p) throw new Error("That project doesn't exist.");
  if (patch.title !== undefined) p.title = patch.title.slice(0, 100) || "Untitled project";
  if (patch.scene !== undefined) p.scene = patch.scene;
  if (patch.assets !== undefined) p.assets = patch.assets;
  if (patch.thumbnail !== undefined) p.thumbnail = patch.thumbnail;
  if (patch.kind !== undefined) p.kind = patch.kind;
  p.updatedAt = Date.now();
  await atomicWrite(join(PROJECTS, `${id}.json`), JSON.stringify(p));
  if (patch.scene !== undefined) await autoVersion(p).catch(() => {});
  return p;
}

export async function deleteProject(id: string) {
  if (!validId(id)) throw new Error("Bad project id");
  await rm(join(PROJECTS, `${id}.json`), { force: true });
  await rm(join(VERSIONS, id), { recursive: true, force: true });
}

export async function duplicateProject(id: string): Promise<ProjectFile> {
  const p = await getProject(id);
  if (!p) throw new Error("That project doesn't exist.");
  const copy = await createProject({ title: `${p.title} (copy)`, scene: p.scene, assets: p.assets, kind: p.kind });
  if (p.thumbnail) await saveProject(copy.id, { thumbnail: p.thumbnail });
  return (await getProject(copy.id))!;
}

// ── Home page demo ──────────────────────────────────────────────────

const DEMO_FILE = join(DATA_DIR, "demo-project.json");

/** A frozen copy of a project that the home page plays and lets visitors try edits on. */
export async function getDemo(): Promise<Pick<ProjectFile, "title" | "scene" | "assets" | "kind"> | null> {
  try {
    return JSON.parse(await readFile(DEMO_FILE, "utf8"));
  } catch {
    return null;
  }
}

/** Snapshot a project as the demo. Later edits to that project don't change the demo. */
export async function setDemo(id: string) {
  const p = await getProject(id);
  if (!p) throw new Error("That project doesn't exist.");
  await mkdir(DATA_DIR, { recursive: true });
  await atomicWrite(DEMO_FILE, JSON.stringify({ title: p.title, scene: p.scene, assets: p.assets, kind: p.kind }));
  return { title: p.title };
}

// ── Versions ────────────────────────────────────────────────────────

export interface VersionSummary {
  id: string;
  at: number;
  label: string | null;
  auto: boolean;
}

async function versionFiles(projectId: string) {
  const dir = join(VERSIONS, projectId);
  await mkdir(dir, { recursive: true });
  return { dir, files: (await readdir(dir)).filter((f) => f.endsWith(".json")).sort() };
}

async function autoVersion(p: ProjectFile) {
  const { dir, files } = await versionFiles(p.id);
  const autos = files.filter((f) => f.includes("_auto"));
  const last = autos.length ? Number(autos[autos.length - 1].split("_")[0]) : 0;
  if (Date.now() - last < AUTO_EVERY_MS) return;
  await writeFile(join(dir, `${Date.now()}_auto.json`), JSON.stringify({ label: null, scene: p.scene, assets: p.assets, title: p.title }));
  for (const old of autos.slice(0, Math.max(0, autos.length + 1 - MAX_AUTO_VERSIONS))) await rm(join(dir, old), { force: true });
}

export async function listVersions(projectId: string): Promise<VersionSummary[]> {
  if (!validId(projectId)) return [];
  const { dir, files } = await versionFiles(projectId);
  const out: VersionSummary[] = [];
  for (const f of files.reverse()) {
    const [at, kind] = f.replace(".json", "").split("_");
    let label: string | null = null;
    if (kind === "named") {
      try {
        label = (JSON.parse(await readFile(join(dir, f), "utf8")) as { label?: string }).label ?? null;
      } catch {
        label = null;
      }
    }
    out.push({ id: f.replace(".json", ""), at: Number(at), label, auto: kind === "auto" });
  }
  return out;
}

export async function addVersion(projectId: string, label: string): Promise<VersionSummary> {
  const p = await getProject(projectId);
  if (!p) throw new Error("That project doesn't exist.");
  const { dir } = await versionFiles(projectId);
  const at = Date.now();
  await writeFile(join(dir, `${at}_named.json`), JSON.stringify({ label: label.slice(0, 80), scene: p.scene, assets: p.assets, title: p.title }));
  return { id: `${at}_named`, at, label, auto: false };
}

export async function getVersion(projectId: string, versionId: string): Promise<{ scene: unknown; assets: unknown[]; title: string } | null> {
  if (!validId(projectId) || !/^\d+_(auto|named)$/.test(versionId)) return null;
  try {
    const path = join(VERSIONS, projectId, `${versionId}.json`);
    await stat(path);
    return JSON.parse(await readFile(path, "utf8"));
  } catch {
    return null;
  }
}
