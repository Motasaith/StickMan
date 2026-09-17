// Matching a script to a recording: which stretch of the recorded words each scene covers.
// Used when the creator narrates the video themselves.

import type { Word } from "./scene";

const norm = (w: string) =>
  w
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}]/gu, "");

const tokens = (text: string) => text.split(/\s+/).map(norm).filter(Boolean);

export interface SceneSpan {
  /** Seconds into the recording. */
  start: number;
  end: number;
  words: Word[];
}

/**
 * Align scene texts to recognised words. Words are matched in order (a longest common
 * subsequence over normalised words), so a few misheard or ad-libbed words don't shift the
 * boundaries; each scene ends where its last matched word ends.
 */
export function alignScenes(scenes: string[], words: Word[]): SceneSpan[] {
  const script: Array<{ tok: string; scene: number }> = [];
  scenes.forEach((text, i) => tokens(text).forEach((tok) => script.push({ tok, scene: i })));
  const heard = words.map((w) => norm(w.text));
  const n = script.length;
  const m = heard.length;

  // LCS table, one row at a time from the end so the match can be walked forward.
  const dp: Uint16Array[] = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = script[i].tok === heard[j] && heard[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  /** For each recorded word, the scene it was matched to (or -1). */
  const owner = new Int32Array(m).fill(-1);
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (script[i].tok === heard[j] && heard[j]) {
      owner[j] = script[i].scene;
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) i++;
    else j++;
  }

  // Unmatched words (fillers, ad-libs, mishearings) between two scenes go to one side of the
  // longest pause among them; the speaker breathes between scenes, not inside them.
  const matched: number[] = [];
  for (let k = 0; k < m; k++) if (owner[k] >= 0) matched.push(k);
  if (!matched.length) owner.fill(0);
  else {
    for (let k = 0; k < matched[0]; k++) owner[k] = owner[matched[0]];
    for (let k = matched[matched.length - 1] + 1; k < m; k++) owner[k] = owner[matched[matched.length - 1]];
    for (let q = 0; q + 1 < matched.length; q++) {
      const a = matched[q];
      const b = matched[q + 1];
      if (b - a < 2) continue;
      if (owner[a] === owner[b]) {
        for (let k = a + 1; k < b; k++) owner[k] = owner[a];
        continue;
      }
      // Split after the word followed by the longest pause.
      let split = a;
      let widest = -Infinity;
      for (let k = a; k < b; k++) {
        const gap = words[k + 1].start - words[k].end;
        if (gap > widest) {
          widest = gap;
          split = k;
        }
      }
      for (let k = a + 1; k < b; k++) owner[k] = k <= split ? owner[a] : owner[b];
    }
  }

  const spans: SceneSpan[] = [];
  for (let s = 0; s < scenes.length; s++) {
    const mine = words.filter((_, k) => owner[k] === s);
    if (mine.length) {
      spans.push({ start: mine[0].start, end: mine[mine.length - 1].end, words: mine });
    } else {
      // A scene the speaker skipped: a short silent span right after the previous one.
      const prev = spans[s - 1];
      const at = prev ? prev.end : 0;
      spans.push({ start: at, end: at, words: [] });
    }
  }
  // Spoken scenes meet inside the pauses between them, so no breath is cut off.
  const spoken = spans.map((sp, k) => (sp.words.length ? k : -1)).filter((k) => k >= 0);
  for (let q = 0; q + 1 < spoken.length; q++) {
    const a = spans[spoken[q]];
    const b = spans[spoken[q + 1]];
    const gap = b.start - a.end;
    if (gap <= 0) continue;
    a.end += Math.min(gap / 2, 0.3);
    b.start = Math.max(a.end, b.start - Math.min(gap / 2, 0.15));
    // Skipped scenes in between sit at the join, with no length.
    for (let k = spoken[q] + 1; k < spoken[q + 1]; k++) spans[k].start = spans[k].end = a.end;
  }
  return spans;
}

/** Sentences of a script, for grouping into scenes without changing a word. */
export function sentencesOf(text: string): string[] {
  return (
    text
      .replace(/\s+/g, " ")
      .trim()
      .match(/[^.!?]+(?:[.!?]+["')\]]*|$)/g)
      ?.map((s) => s.trim())
      .filter(Boolean) ?? []
  );
}

/** Group sentences into scenes of about `target` words, never splitting a sentence. */
export function groupSentences(sentences: string[], target = 40): string[] {
  const out: string[] = [];
  let cur: string[] = [];
  let count = 0;
  for (const s of sentences) {
    const n = s.split(/\s+/).length;
    if (cur.length && count + n > target * 1.25) {
      out.push(cur.join(" "));
      cur = [];
      count = 0;
    }
    cur.push(s);
    count += n;
    if (count >= target) {
      out.push(cur.join(" "));
      cur = [];
      count = 0;
    }
  }
  if (cur.length) out.push(cur.join(" "));
  return out;
}
