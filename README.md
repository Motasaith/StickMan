# Stickman Studio: an AI video studio on a real timeline

Describe a scene, a presentation or an edit, and the AI builds it the way a person would in an
editor: slides with animated illustrations and narration, characters with keyframes, 3D sets with
camera shots, or your own clips trimmed and captioned. Nothing is a generated video: every result
is ordinary objects and keyframes you can drag, retime and undo, and the MP4 is rendered from that
same scene. It runs locally: projects, media and versions live in `~/.stickman-studio`.

## Presentations, media and the pro editor

- **Narrated presentations**: one `presentation` op designs a whole deck: 12 layouts (title,
  bullets, split, illustration, stat with a counting number, chart, quote, steps, comparison,
  section, closing, image), 10 themes (clean, midnight, sunset, medical, corporate, bold,
  chalkboard, pastel, nature, elegant), animated entrances, 12 slide transitions, a narration voice
  per slide with word-timed captions, and each slide lasting as long as its narration. Change the
  theme later and every slide is rebuilt with its content and recorded voices kept.
- **Animated illustrations**: a library of 109 animated SVG drawings in 8 categories (health:
  teeth set, tooth, toothbrush, heart, brain, lungs, stethoscope...; business, technology,
  education, nature, communication, places, symbols). When a slide talks about something the
  library doesn't have ("dental braces"), the server has the AI draw a matching animated SVG
  (validated, retried once) before the slides are built. The Art tab can also draw one on request.
- **Stickers**: 142 animated emoji stickers (Twemoji, CC-BY 4.0) with pop-in and loops (float,
  pulse, wiggle, bounce, spin, heartbeat...).
- **SVG engine** (`src/engine/svg.ts`): its own SVG parser and SMIL animator (animate,
  animateTransform, animateMotion, set, keySplines, syncbase begins, dash drawing), so animated SVGs
  look the same in preview, export and the AI's contact sheets.
- **Your media**: upload video, pictures, sound and SVG (HEVC/MOV is converted to H.264), with
  filmstrips and waveforms on the timeline. Free Pexels stock video and photos (set
  `PEXELS_API_KEY`). Record a voice-over in the browser.
- **Editing**: move, trim both edges, split at the playhead (S), snapping to clips, slides, markers
  and the playhead, zoom, markers (M), hide/lock tracks, detach audio, speed, reverse, freeze,
  fades, crop, rounded/circle shapes, borders, shadows, chroma key, color looks and adjustments,
  blur/pixelate/redact/highlight/spotlight/magnify areas that can follow an object.
- **Text and data**: styled text (outline, shadow, box, highlight, lower third, gradient), 20 fonts
  including Urdu Nastaliq and Arabic Naskh, counting numbers, animated bar/line/pie/donut charts.
- **Captions**: from narration, speech bubbles, or transcribed from a clip's speech with Whisper
  (runs locally, model downloaded on first use), in six styles including karaoke.
- **Projects**: home page with templates, autosave to disk, named versions and restore, thumbnails.
- **Export**: MP4, GIF, MP3 (sound only) or a cover picture, full or part, at a chosen size and
  frame rate.

## Characters, 3D and sound

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
- **3D view**: switch any scene to 3D (top bar). The same objects become a lit world with shadows
  (three.js): characters and animals keep their skeletons and motions, and everything takes a depth
  `z`. Drag things on the floor, drag empty space to turn the camera, scroll to zoom.
  - **Props**: 42 ready 3D models (house, shop, building, tree, pine, bench, sofa, bed, desk,
    bookshelf, fridge, lamp, streetlight, car, fence, road, pond, blackboard, tent, campfire...) from
    `+ Prop` or the AI's `prop` op, plus solid parts (box3, prism3, sphere3, cylinder3, cone3) with
    rotation and glow for anything else.
  - **Lighting**: presets day, golden hour, night, overcast, studio and indoor, each with a gradient
    sky, sun or moon, matching ground and tone mapping. Lamps, windows, TVs and fires light up at
    night and cast real light; `light` objects add more. Look: soft (render) or toon (outlines).
  - **Camera**: named shots (wide, medium, close-up, two-shot, over the shoulder, low, high, top
    down, tracking, orbit, dolly in, crane up) framed from the actors' real positions, and an
    automatic director (`Auto camera`) that plans a film: establishing shot, dialogue coverage,
    tracking during walks, closing crane. It steers around props and actors that would block the
    view, and covers any part of the film the AI's own shots leave out.
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
             │                     its board, gesture mid-walk, off-canvas, in 3D: flat
             │                     cutout props, actors inside a prop or each other… -> sent
             │                     back to the AI once to correct its own plan
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
- `src/editor/PuppetSetup.tsx`: turning an imported picture into a character.
- `src/engine/motion.ts`: walk/run/sneak cycles sized to the distance, gestures.
- `src/engine/ops.ts`: every edit the AI or the UI can make, each validated with zod.
- `src/engine/lint.ts`: mistakes code can measure, fed back to the AI.
- `src/engine/render.ts`: one renderer for the live canvas, export and the AI's frames.
- `server/prompt.ts`: what the AI is told about the canvas and the current scene.
- `server/app.ts`: `/api/ai/plan` and `/api/ai/review`.
- `src/render3d.ts`: the 3D view (browser only; 2D stays the engine's renderer): materials, lighting presets, sky, lights.
- `src/engine/props.ts`: the 3D prop library, each prop built from solid parts.
- `src/engine/director.ts`: camera shots and the automatic director.
- `src/sfx.ts`: synthesized sound effects.
- `src/engine/proOps.ts`: the editor ops (stickers, illustrations, SVG, video, audio, trim, split,
  narrate, captions, regions, charts, counters, headings, entrances, grade, markers, presentations).
- `src/engine/slides.ts`, `themes.ts`, `entrances.ts`: slide layouts, themes and entrance/exit animations.
- `src/engine/svg.ts`, `stickers.ts`, `illustrations.ts`: the SVG renderer and the two libraries.
  Illustrations are written as code in `scripts/illustrations/*.cjs`; `node scripts/illustrations/build.cjs`
  regenerates `public/illustrations` and the index.
- `src/engine/media.ts`, `chart.ts`, `fonts.ts`: video/picture looks, text styles, captions, regions,
  backgrounds, transitions, charts and fonts.
- `server/routes.ts`: projects and versions, media upload and range serving, voices with word timings,
  stock, transcription, AI illustration and export conversion. `server/artfill.ts` draws missing
  illustrations for the AI's plans.
- `src/pages/`, `src/editor/`: the home page and the editor (panels, stage, timeline, inspector, dialogs).
- `server/finalize.ts`: ffmpeg pass that re-encodes an export's sound as AAC in MP4. Firefox has
  no AAC encoder, and many players (Windows Films & TV, Media Player) show Opus-in-MP4 or WebM as silent.
- `src/export.ts`, `src/avc.ts`: MP4 in the browser (WebCodecs H.264 Baseline + AAC or Opus + mp4-muxer). The MP4 header is
  built from the SPS/PPS in the stream, because some encoders (Firefox) report settings that don't match
  or none at all; if an encoder can't produce a usable stream, it records WebM instead.

## Editing by hand

- The left rail has Media, Stock, Slides, Text, Art (illustrations), Stickers, Shapes (with charts
  and areas), People, 3D props, Effects, Sounds and Record. Click an item to add it at the playhead.
- The right side switches between the AI Director chat and Edit (the inspector for the selection,
  the slide, or the whole project when nothing is selected).
- Click an object to select it; drag to move, drag the corner to resize. On a stick man, drag the dots: hands and
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
- Projects autosave to disk; the clock button saves named versions and restores old ones.
- Export records any speech lines that don't have an up-to-date voice yet, renders the video,
  makes the sound AAC when needed, and tells you what the file contains.

## Tests

```bash
npm test                                           # engine unit tests
npx tsx scripts/try-ai.ts "<prompt>" out.json      # one real AI plan, no browser
npx tsx scripts/contact-sheet.ts out.json sheet.png 4 0.5 1.5 2.5   # look at frames
node scripts/ai-pro.mjs <outDir> --kind presentation --prompt "<prompt>" [--export]   # real AI run from the home page (dev server up)
node scripts/pro-ui.mjs <outDir>                                     # projects page, deck template, every panel, adding items, playback
npx tsx scripts/sticker-sheet.ts out.png illustrations 1.2           # contact sheet of the sticker or illustration library
npx tsx scripts/slides-sheet.ts out.png                              # sample deck rendered in Node
npx tsx scripts/prompt-peek.ts PRESENTATIONS                         # print part of the AI's instructions
node scripts/export-check.mjs <outDir>                               # export with voice in Firefox + Chrome, every encoder path
npx tsx scripts/feature-demo.ts <outDir>                             # render a scene using every character type and effect
node scripts/check-3d.mjs <outDir> [chrome|firefox]                  # every object type in the 3D view, three camera angles
node scripts/check-blender.mjs <outDir> [chrome|firefox]             # prop street and classroom under every lighting and look
node scripts/export-3d.mjs <outDir>                                  # MP4 export of a lit 3D scene with the director
```
