// One way to voice a line with any voice (Edge or local): the audio goes into the media library
// and the caller gets its id, length, word timings and waveform.

import { isLocalVoice, type VoiceId } from "../../src/engine/scene";
import { importMedia, mediaPath, mediaUrl, probe } from "../media";
import { speakWithWords, type SpokenWord } from "../tts";
import { speakLocal } from "./local";

export interface Voiced {
  id: string;
  src: string;
  file: string;
  duration: number;
  words: SpokenWord[];
  waveform: number[];
}

export async function voiceLine(text: string, voice: string, onProgress?: (p: number, stage: string) => void): Promise<Voiced> {
  let bytes: Buffer;
  let name: string;
  let words: SpokenWord[];
  if (isLocalVoice(voice)) {
    const r = await speakLocal(text, voice, onProgress);
    bytes = r.audio;
    words = r.words;
    name = `voice-${voice.replace(/[:]/g, "-")}.wav`;
  } else {
    const r = await speakWithWords(text, voice as VoiceId);
    bytes = r.mp3;
    words = r.words;
    name = `voice-${voice}.mp3`;
  }
  const info = await importMedia(bytes, name, { origin: "tts" });
  const duration = info.duration ?? (await probe((await mediaPath(info.id))!)).duration;
  return { id: info.id, src: mediaUrl(info.file), file: info.file, duration, words, waveform: info.waveform ?? [] };
}
