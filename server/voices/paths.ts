// Where the local voice engines keep their files. Models already downloaded by VoiceGen Studio
// (a sibling folder, or VOICEGEN_DATA_DIR) are used in place, so nothing is fetched twice.

import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

export const DATA_DIR = process.env.STICKMAN_DATA_DIR?.trim() || join(homedir(), ".stickman-studio");

/** VoiceGen Studio's data folder, if it is on this machine. */
export const VOICEGEN_DATA_DIR = process.env.VOICEGEN_DATA_DIR?.trim() || resolve(process.cwd(), "..", "voicegen-web", "data");

const OWN_MODELS = join(DATA_DIR, "voice-models");

function pickModels(): string {
  if (existsSync(join(OWN_MODELS, "hf"))) return OWN_MODELS;
  if (existsSync(join(VOICEGEN_DATA_DIR, "models", "hf"))) return join(VOICEGEN_DATA_DIR, "models");
  return OWN_MODELS;
}

export const MODELS_DIR = pickModels();

/** Saved blends and cloned voices, with their speaker profiles. */
export const VOICES_DIR = join(DATA_DIR, "voices");
