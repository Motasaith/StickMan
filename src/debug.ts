// Dev-only handle for automated checks (scripts drive the real app state through it).
import { useStore } from "./store";
import { audioDebug } from "./audio";
import { generateVoices } from "./voice";

export function installDebugHandle() {
  (window as unknown as { __stickman: unknown }).__stickman = { useStore, audioDebug, generateVoices };
}
