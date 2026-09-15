# Stickman Studio: an AI that animates on the canvas

Describe a scene and the AI builds it the way a person would in an animation
program: it draws the props from shapes, adds stick men, sets keyframes on a
real timeline and plays it live on the canvas. Nothing is a generated video:
every result is ordinary objects and keyframes you can drag, retime, pose and
undo, and the MP4 is rendered from that same scene.

## What it can animate

- **Characters** on one skeleton, so every motion (walk, run, sit on a chair, write on a board,
  pick things up, 18 gestures, IK posing) works for all of them:
  stick figures, **cartoon people** (skin, shirt, pants, shoes, 7 hair styles, 8 hats, glasses,
  beard, dress), **robots**, and **picture puppets** (import a character picture, the vision
  model finds its joints, you can drag them, and the picture is cut into pieces on the skeleton).
- **Animals** with their own skeletons: dog and cat (walk, run, sneak, sit, lie, sleep, bark, wag,
  sniff, jump, stretch), bird (hop, fly and land, flap, peck, sing), fish (swim). The AI can also
  build **custom creatures** from bones and shapes, animated with `bones` and `cycle`.
- **Voices and lip-sync**: speech bubbles are spoken with Microsoft Edge neural voices (English
  men/women/kids, old voices, robot, narrator, Urdu). The mouth follows the loudness of the audio,
  bubbles last as long as the speech, and the sound plays in preview and goes into the export.
- **Props and attachments**: characters walk to an object, crouch or reach, and carry it; animals
  carry things in their mouth; `drop` lets it fall; `attach` makes riders, hats or wheels move
  with their parent.
- **Effects and motion**: rain, snow, confetti, smoke, sparkles, bubbles, leaves, fire, stars,
  hearts; bounce with squash and stretch; smooth curved paths; shake; camera moves.
- **3D view**: switch any scene to 3D (top bar). The same objects become a cel-shaded, lit world
  with shadows (three.js): characters and animals keep their skeletons and motions, props get
  depth, and there are solid shapes (box3, sphere3, cylinder3, cone3). Everything takes a depth
  `z`, characters walk through depth and turn, and the camera can orbit, dolly and crane.
  Drag things on the floor, drag empty space to turn the camera, scroll to zoom.
- **Sound effects**: pop, boing, whoosh, thud, ding, click, splash, applause, thunder, magic, bark,
  meow, tweet, honk, footsteps, drum roll, plus rain and wind ambience. They are synthesized in the
  browser (no files), shown on the timeline, and mixed into the export with the voices.

## Run it

```bash
npm install
npm run dev          # http://localhost:5178
```

The AI uses any OpenAI-compatible API, set in `.env` (same settings as PromptCut):

```
LLM_BASE_URL=https://ollama.com/v1
LLM_API_KEY=...
LLM_MODEL=gpt-oss:120b         # plans the animation (text, good at JSON)
VISION_LLM_MODEL=gemma4:31b    # checks rendered frames; finds joints on puppet pictures
```

Production: `npm run build && npm start` (serves `dist/` and the AI endpoints on port 5178).

## How a prompt becomes an animation

```
prompt ──> PLAN (LLM_MODEL)       returns ops: draw, character, walk, write, say, camera…
             │
             ├─> APPLY (no model)  ops -> objects + keyframes; walk cycles, IK, text fitting
             │                     and positions ("walk to the board") computed by code
             │
             ├─> CHECK (no model)  lint: furniture in the floor, sitting on air, text off
             │                     its board, gesture mid-walk, off-canvas… -> sent back to
             │                     the AI once to correct its own plan
             │
             ├─> BUILD             the browser applies the ops one by one so you watch the
             │                     scene appear, as one undo step, then plays it
             │
             └─> LOOK (VISION)     renders a contact sheet of frames; the vision model lists
                                   problems, the planner fixes them (never destructively)
```

- `src/engine/scene.ts`: the scene model: stick men, drawings (shape parts), text,
  speech bubbles, pictures, camera; all animation is keyframe tracks.
- `src/engine/rig.ts`: the human skeleton: poses, two-bone IK.
- `src/engine/looks.ts`: how a human is drawn: stick, cartoon, robot, picture puppet.
- `src/engine/creatures.ts`: data-driven skeletons, animal presets and their motions.
- `src/engine/effects.ts`: particle effects computed from time (scrub- and export-safe).
- `src/audio.ts`, `src/voice.ts`, `server/tts.ts`: voices, lip-sync envelopes, playback, export mix.
- `src/ui/PuppetSetup.tsx`: turning an imported picture into a character.
- `src/engine/motion.ts`: walk/run/sneak cycles sized to the distance, gestures.
- `src/engine/ops.ts`: every edit the AI or the UI can make, each validated with zod.
- `src/engine/lint.ts`: mistakes code can measure, fed back to the AI.
- `src/engine/render.ts`: one renderer for the live canvas, export and the AI's frames.
- `server/prompt.ts`: what the AI is told about the canvas and the current scene.
- `server/app.ts`: `/api/ai/plan` and `/api/ai/review`.
- `src/render3d.ts`: the 3D view (browser only; 2D stays the engine's renderer).
- `src/sfx.ts`: synthesized sound effects.
- `server/finalize.ts`: ffmpeg pass that re-encodes an export's sound as AAC in MP4. Firefox has
  no AAC encoder, and many players (Windows Films & TV, Media Player) show Opus-in-MP4 or WebM as silent.
- `src/export.ts`, `src/avc.ts`: MP4 in the browser (WebCodecs H.264 Baseline + AAC or Opus + mp4-muxer). The MP4 header is
  built from the SPS/PPS in the stream, because some encoders (Firefox) report settings that don't match
  or none at all; if an encoder can't produce a usable stream, it records WebM instead.

## Editing by hand

- Click an object to select it; drag to move. On a stick man, drag the dots: hands and
  feet bend elbows and knees (IK), the head leans the body.
- If a property is animated, a drag sets a keyframe at the playhead; otherwise it
  changes the object for the whole video.
- Timeline: diamonds are keyframes: drag to retime, click then Delete to remove.
- Space play/pause, ←/→ step a frame (Shift: a second), Ctrl+Z / Ctrl+Y.
- Import pictures (characters, backgrounds, props); the AI can use them by name. The little person
  button on a picture makes it a character.
- Selected animals show dots at the ends of their bones: drag to bend.
- The inspector has the character's look and voice, animal poses and actions, pick up / drop,
  attach / detach, bounce and shake, effect settings, and "Record voice" for a speech bubble.
- Projects autosave in the browser; Save/Open writes a `.json` file with pictures included.
- Export records any speech lines that don't have an up-to-date voice yet, renders the video,
  makes the sound AAC when needed, and tells you what the file contains.

## Tests

```bash
npm test                                           # engine unit tests
npx tsx scripts/try-ai.ts "<prompt>" out.json      # one real AI plan, no browser
npx tsx scripts/contact-sheet.ts out.json sheet.png 4 0.5 1.5 2.5   # look at frames
node scripts/smoke.mjs <outDir> 0 --follow "<edit>"                  # full browser run (dev server up)
node scripts/export-check.mjs <outDir>                               # export with voice in Firefox + Chrome, every encoder path
npx tsx scripts/feature-demo.ts <outDir>                             # render a scene using every character type and effect
node scripts/ui-check.mjs <outDir> <character.png>                   # screenshots of menus, look panel and puppet setup
node scripts/check-3d.mjs <outDir> [chrome|firefox]                  # every object type in the 3D view, three camera angles
node scripts/check-export-ui.mjs <outDir> [chrome|firefox]           # Export button with 3D, voice and sound effects
```
