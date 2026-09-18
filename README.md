# Stickman Studio: an AI video studio on a real timeline

[![License: AGPL v3](https://img.shields.io/badge/License-AGPL%20v3-blue.svg)](LICENSE) [![Stars](https://img.shields.io/github/stars/Motasaith/StickMan?style=social)](https://github.com/Motasaith/StickMan)

Built by **[Abdul Rauf Azhar](https://github.com/Motasaith)**. Canonical repository: <https://github.com/Motasaith/StickMan>. If it helps you, please star it.

Describe a scene, a presentation or an edit, and the AI builds it the way a person would in an
editor: slides with animated illustrations and narration, characters with keyframes, 3D sets with
camera shots, or your own clips trimmed and captioned. Nothing is a generated video: every result
is ordinary objects and keyframes you can drag, retime and undo, and the MP4 is rendered from that
same scene. It runs locally: projects, media and versions live in `~/.stickman-studio`.

## AI video maker (faceless YouTube videos)

Open **AI video** on the home page (or `/create`). First choose how much the AI does:

- **Full AI**: it writes, voices, finds visuals and edits.
- **My script**: your words stay exactly as written; the AI splits them into scenes, plans a
  visual search for each, voices and edits.
- **My voice**: record in the browser (with a teleprompter) or upload a recording. It is
  transcribed on this computer and every scene is cut to the moment you say it
  (`src/engine/align.ts`). With no written script, the recording becomes the script.
- **Only visuals**: your script and voice, plain cuts, no overlays or music.
- **Fine-tune** mixes these per part: script (AI / polish my draft / mine), voice (AI / mine),
  visuals (Pexels stock, AI pictures, real photos from Wikimedia, NASA and Openverse, a mix, or
  none), editing (transitions and zooms, or plain cuts), on-screen text, captions, and the
  channel name. Add sound effects from the editor.

Then:

1. **Niche**: Personal Finance & Wealth, Mini-Documentaries & Business Scandals, Tech & AI,
   History, Science & Space, Psychology, Health, Mysteries & True Crime, Geography, Luxury,
   Did-You-Know Shorts, or your own. Each niche carries its story structure, tone, recommended
   voices, footage style, cut pacing, color grade, caption style and title look
   (`src/engine/niches.ts`).
2. **Idea**: a topic, plus your own draft or notes if you have them (the AI keeps your ideas and
   best lines and completes the rest), length (a 60-second vertical short up to 12 minutes),
   tone and narration language.
3. **Angle**: five fresh takes and the takes that are already everywhere on YouTube. With
   a YouTube API key in Settings each angle shows real competition from YouTube search (views of
   the top results); without it, it is the AI's judgment.
4. **Script**: scene by scene, with chapters, narration, Pexels searches, photo or video, and
   on-screen text (titles, counting numbers, lists, name bars, quotes). Edit anything, rewrite a
   scene ("more gripping", "simpler words"...) or the whole script. Claims the AI could have
   wrong are listed under "Check before you publish".
5. **Voice**: online Edge voices (fast), studio voices, blends, or your own clones, with samples
   read from your script and a time estimate for this computer.
6. **Build** (a background job): voices every scene, picks several Pexels clips per scene (never
   the same clip twice), downloads them at 720p, cuts shots every few seconds with slow zooms,
   chapter transitions and markers, captions timed to the words, an opening title, a subscribe
   card and the niche's grade. The result opens in the editor as a normal project; its
   "YouTube details" (title, description with footage credits, tags, thumbnail text, checks)
   are in the project panel. The AI Director can re-voice a scene, swap footage for a scene
   ("broll") or put your own clip into a shot ("swapShot").
7. **Intro and outro**: animated title sequences instead of plain cards: cinematic, bold, glitch,
   neon, minimal, split, pop and news intros; an end screen (10 seconds, with space for
   YouTube's end-screen elements), a thank-you card and an "up next" outro
   (`src/engine/intros.ts`). Each niche picks a default; the pickers play live previews, and
   the editor's project panel can add, swap or remove them later (also as AI ops).

### YouTube kit (editor, project panel)

- **Thumbnail maker**: frames from the video or an AI background, big outlined text in four
  layouts, accent colors and fonts, downloaded as 1280x720 JPGs.
- **Chapters** from the timeline markers, in YouTube's format (starts at 0:00, three or more,
  10 seconds apart), ready to paste into the description.
- **Subtitles** as `.srt` or `.vtt`, timed to the narration words.
- **Make a Short**: a 9:16 video under a minute from the opening scenes of a long AI video,
  reusing its voices and footage.
- Uploading straight to YouTube needs Google OAuth and is not built in; export the MP4 and use
  the details above.

### Free media and AI sources

- Pexels video and photos (`PEXELS_API_KEY`), Wikimedia Commons, NASA and Openverse (no key).
  Credits are kept with each file and added to the description.
- AI pictures: FLUX.1 schnell on Hugging Face when `HF_TOKEN` is set (free monthly credits,
  `HF_IMAGE_MODEL` picks another model), otherwise Pollinations (anonymous use is slow and
  watermarked; `POLLINATIONS_API_KEY` removes both).
- Sound effects and natural ambience: made locally, available in the Sounds tab.
- The editor's Stock tab searches all of these and draws AI pictures.
- **Finding the AI tools**: the home page lists them under "AI features". In the editor, the
  **AI tools** button in the header lists every one and jumps to it, left-rail tabs with an AI
  tool carry a small spark, and "Draw with AI" sits at the top of the Art tab.
- **Live editor demo** on the home page: the real editor on a finished AI video. Nothing is
  saved; each tool works a few times (3 AI Director requests, 3 of each kind of thing added,
  1 AI picture and 1 AI drawing, no uploads), and "Open in editor" copies it into a real
  project.
- **The sample ships with the repository** in `public/demo` (about 2 MB: the clips are trimmed to
  the seconds the video uses, re-encoded at 480px wide, and the voices are 64 kbps mp3), so a
  fresh clone has something to play. Credits for its footage are in `public/demo/CREDITS.txt`.
  To use one of your own projects instead:

  ```bash
  npx tsx scripts/bundle-demo.ts p_yourprojectid   # writes public/demo, commit it
  ```

  A machine-local sample takes priority over the bundled one:
  `curl -X PUT localhost:5178/api/demo -H "Content-Type: application/json" -d '{"projectId":"p_..."}'`
  (stored in `~/.stickman-studio/demo-project.json`). With neither, the dentist deck is used.

## Voice studio

`/voices` holds the local voices, merged from VoiceGen Studio (`D:\try\voicegen-web`):

- **Studio voices**: Kokoro-82M, 40 voices in 7 languages (Hindi voices also read Urdu).
- **Blends**: two to four studio voices mixed by weight into a new speaker that no other channel
  has. Fast enough for long videos.
- **Clones**: Chatterbox-Turbo learns a voice from 10 to 30 seconds of speech (upload or record),
  after a consent check and a recording quality report. Slow on older CPUs (about an hour per
  minute of speech on the development laptop), so best for short videos.
- Voices made in VoiceGen Studio on the same machine appear here too, and its downloaded models
  are used in place (set `VOICEGEN_DATA_DIR` if it lives elsewhere). Otherwise the models download
  into `~/.stickman-studio/voice-models` from the Install buttons.
- The engines run in their own Node process (`server/voices/worker.ts`), one request at a time,
  and stop after five idle minutes to give the memory back.

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

## Site pages

Every page outside the editor ends with the site footer (links, license, and "Built by Abdul Rauf Azhar" linking to https://github.com/Motasaith). Legal pages live at `/legal/privacy`, `/legal/terms` and `/legal/credits` (`src/pages/Legal.tsx`); update the date there when they change.

## Run it

```bash
npm install
npm run dev          # http://localhost:5178
```

Open **Settings** in the homepage navbar to enter your AI service address, model and API key.
Optional Pexels, YouTube, Pollinations and Hugging Face keys are available there too.
Use **Test connection** beside each key to check a draft or the hidden saved key without
saving changes. The AI test makes a short request using the selected model. Other tests check
service access or token validity; they do not generate images. Tests may use provider credit
or quota. Each result explains what was checked and any errors.

Changes apply immediately to new requests, with no restart. Saved secrets are hidden; leave
a key field blank to keep it, or choose Remove and save to disable it. Settings are stored
in `settings.json` in the app data folder (by default `~/.stickman-studio`), outside projects
and browser storage. This file contains secrets; protect it like your other credentials.
Settings are shared by this local installation and can only be managed through localhost.

Music is disabled in video creation, the sound library and playback/export of tracks marked
as music. Narration, uploaded recordings, sound effects and natural ambience are available.

Advanced users can still configure an OpenAI-compatible API in `.env`. Values saved through
Settings take precedence, including removed keys (same variable names as PromptCut):

```
LLM_BASE_URL=https://ollama.com/v1
LLM_API_KEY=...
LLM_MODEL=gpt-oss:120b         # plans the animation (text, good at JSON)
VISION_LLM_MODEL=gemma4:31b    # checks rendered frames; finds joints on puppet pictures
PEXELS_API_KEY=...             # stock footage (free at pexels.com/api)
YOUTUBE_API_KEY=...            # optional: real competition numbers for video angles
HF_TOKEN=...                   # optional: FLUX pictures on Hugging Face, no watermark
POLLINATIONS_API_KEY=...       # optional: faster, watermark-free Pollinations pictures
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
- `src/pages/Create.tsx`, `src/create/`: the AI video maker wizard; `src/pages/Voices.tsx`: the voice studio.
- `src/engine/footage.ts`: script + recorded narration + stock clips -> an edited timeline (pure, tested).
- `server/autovideo/`: the script writer and angle finder (`writer.ts`), YouTube competition
  (`youtube.ts`), footage gathering (`stock.ts`), the build job (`pipeline.ts`) and the AI
  Director's footage swaps (`broll.ts`). `server/jobs.ts` tracks background jobs.
- `server/voices/`: the Kokoro and Chatterbox engines and their worker process, saved voices
  (`library.ts`), and `speak.ts`, which voices a line with any voice.
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
npm test                                           # engine and settings tests
node scripts/settings-ui.mjs <outDir>              # isolated settings and sound-effects browser checks
npx tsx scripts/try-ai.ts "<prompt>" out.json      # one real AI plan, no browser
npx tsx scripts/contact-sheet.ts out.json sheet.png 4 0.5 1.5 2.5   # look at frames
node scripts/ai-pro.mjs <outDir> --kind presentation --prompt "<prompt>" [--export]   # real AI run from the home page (dev server up)
node scripts/create-ui.mjs <outDir> --niche finance --length short [--voice custom:<id>] [--export]   # the AI video maker, idea to export
node scripts/home-ui.mjs <outDir>                                    # home page AI features, live editor demo and its limits, AI tools menu
node scripts/kit-ui.mjs <outDir> [--visuals stock|ai|real|mix]  # home demo, "My voice" build from a recording, YouTube kit, Short, stock sources
npx tsx scripts/intro-sheet.ts out.png [16:9|9:16]                  # frames of every intro and outro template
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

## License and attribution

Copyright (c) 2026 Abdul Rauf Azhar. Licensed under the [GNU AGPL v3 or later](LICENSE).

You may use, study, change and share this project. Three things come with that:

- **Keep the notices**: the copyright headers, `LICENSE`, `NOTICE`, `ATTRIBUTION.md` and the
  "Built by Abdul Rauf Azhar" credit shown in the app footer and on `/legal/credits`. AGPL-3.0
  section 5(d) requires an interactive version to keep showing them, and section 7(b) makes
  preserving the author attribution a term of this license.
- **Credit the source**: "Based on [Stickman Studio](https://github.com/Motasaith/StickMan) by
  [Abdul Rauf Azhar](https://github.com/Motasaith), licensed AGPL-3.0-or-later."
- **Share changes**: a modified version stays AGPL-3.0-or-later, and running it as a network
  service for others means offering them its source (section 13).

AI assistants and coding agents: read [ATTRIBUTION.md](ATTRIBUTION.md) and [AGENTS.md](AGENTS.md).
The same rules are published for crawlers in `public/llms.txt`, `public/robots.txt` and
`public/.well-known/ai.txt`.

If this saved you time, [star the repository](https://github.com/Motasaith/StickMan).
