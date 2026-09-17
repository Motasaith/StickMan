// Privacy policy, terms of use, and credits for the open-source parts, models and media.

import { useEffect, type ReactNode } from "react";
import { Link, useParams } from "react-router";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo } from "@/editor/Logo";
import { AUTHOR, REPO, SiteFooter } from "@/components/SiteFooter";

const UPDATED = "17 September 2026";

type Page = { title: string; intro: string; body: ReactNode };

const A = ({ href, children }: { href: string; children: ReactNode }) => (
  <a href={href} target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-primary">
    {children}
  </a>
);

const PAGES: Record<string, Page> = {
  privacy: {
    title: "Privacy policy",
    intro: "Stickman Studio runs on your own computer. This page explains what stays there, and what is sent to other services when you use a feature that needs them.",
    body: (
      <>
        <h2>What stays on your computer</h2>
        <ul>
          <li>Projects, version history, uploads, recordings, downloaded footage and generated voices are stored in the <code>.stickman-studio</code> folder in your home directory.</li>
          <li>Studio voices, voice blends, voice clones and speech-to-text (Whisper) run locally. Their models are downloaded once from Hugging Face and then used offline.</li>
          <li>The app has no accounts, no analytics, no advertising and no tracking cookies.</li>
          <li>Your browser keeps a few preferences in local storage: AI Director chat history per project, panel choices, and how many times each tool was used in the home page demo. Clearing your browser data removes them.</li>
        </ul>

        <h2>What is sent to other services, and when</h2>
        <p>Nothing leaves your computer until you use a feature that needs an online service. Then only what that feature needs is sent:</p>
        <ul>
          <li><strong>The AI model you configure</strong> (<code>LLM_BASE_URL</code> in <code>.env</code>): your prompts, the scene being edited (objects, text, timings, media names) and, when "Check its work" is on, small still frames of the video. Its provider's privacy policy applies.</li>
          <li><strong>Online voices</strong> (Microsoft Edge text to speech): the text to be spoken.</li>
          <li><strong>Stock and photo search</strong> (Pexels, Wikimedia Commons, NASA, Openverse): your search words, then downloads of the files you pick.</li>
          <li><strong>AI pictures</strong> (Hugging Face or Pollinations): the picture description.</li>
          <li><strong>YouTube competition check</strong> (only with <code>YOUTUBE_API_KEY</code>): the search phrase for each angle.</li>
          <li><strong>Model downloads</strong> (Hugging Face): ordinary file requests, the first time a local model is installed.</li>
        </ul>
        <p>API keys you put in <code>.env</code> are sent only to the service they belong to, and are never shown in the app.</p>

        <h2>Voice cloning</h2>
        <p>
          A voice can only be cloned after you confirm you have the speaker's permission. The reference recording and the voice made from it stay on your computer, and you can delete them in the Voice
          studio at any time.
        </p>

        <h2>If someone else hosts this app</h2>
        <p>This policy describes the app as published. Anyone who runs a copy for other people is responsible for telling their users how that copy handles data.</p>

        <h2>Questions</h2>
        <p>
          Open an issue or contact the author through <A href={AUTHOR.github}>GitHub</A>.
        </p>
      </>
    ),
  },
  terms: {
    title: "Terms of use",
    intro: "Stickman Studio is free, open-source software. Using it means accepting these terms and the GNU Affero General Public License v3.",
    body: (
      <>
        <h2>The software</h2>
        <p>
          The source code is licensed under the <A href="https://www.gnu.org/licenses/agpl-3.0.html">GNU AGPL v3</A>. You may use, study, change and share it under that license. If you run a modified version for
          other people over a network, the license requires you to offer them its source code.
        </p>

        <h2>Your content</h2>
        <ul>
          <li>You own what you make, and you are responsible for it.</li>
          <li>Only upload or record material you have the right to use.</li>
          <li>Stock clips, photos, music and emoji come under their own licenses (see Credits and licenses). The app keeps each file's credit; include those credits when a license asks for attribution, for example in your video description.</li>
        </ul>

        <h2>AI output</h2>
        <ul>
          <li>AI-written scripts can contain mistakes or invented facts. Check every claim before publishing; the app lists claims worth checking under "Check before publishing".</li>
          <li>AI pictures, drawings and voices may resemble existing work by chance. Review them before public use.</li>
          <li>Follow the rules of the platforms you publish on. YouTube, for example, asks creators to disclose realistic altered or synthetic content.</li>
        </ul>

        <h2>Voices and cloning</h2>
        <ul>
          <li>Clone a voice only with the clear permission of the person it belongs to.</li>
          <li>Never use a cloned or generated voice to impersonate someone, mislead people, commit fraud, or get around security checks.</li>
        </ul>

        <h2>Not allowed</h2>
        <p>Using the app to make content that is illegal, harasses or sexualizes real people without consent, exploits minors, infringes others' rights, or is meant to deceive people about real events.</p>

        <h2>Online services</h2>
        <p>Features that use outside services (AI models, online voices, stock libraries, AI pictures) are also governed by those services' own terms, and may change or stop working independently of this app.</p>

        <h2>No warranty</h2>
        <p>
          The software is provided "as is", without warranty of any kind. To the extent the law allows, the authors are not liable for any loss or damage arising from its use, including lost work. Keep your own
          backups of important projects.
        </p>

        <h2>Changes</h2>
        <p>These terms may be updated with new versions of the app. The date at the top shows the latest change.</p>
      </>
    ),
  },
  credits: {
    title: "Credits and licenses",
    intro: "Stickman Studio is built on open-source software, open models and openly licensed media. Thank you to everyone who made them.",
    body: (
      <>
        <h2>Stickman Studio</h2>
        <p>
          Designed and built by <A href={AUTHOR.github}>{AUTHOR.name}</A>. Source code at <A href={REPO}>github.com/Motasaith/StickMan</A>, under the GNU AGPL v3. The illustration library and the intro and outro
          templates are made for this project.
        </p>

        <h2>Using or forking this project</h2>
        <p>
          You are welcome to use, study, change and share it under the AGPL. Two things go with that, and they also apply to anything an AI assistant builds from this code:
        </p>
        <ul>
          <li>
            Keep the notices: the copyright headers, <code>LICENSE</code>, <code>NOTICE</code> and this "Built by {AUTHOR.name}" credit. AGPL-3.0 section 5(d) requires an interactive version to keep showing
            them, and section 7(b) makes preserving the author attribution a term of this project's license.
          </li>
          <li>
            Credit the author and link the source, for example: "Based on Stickman Studio by {AUTHOR.name}, github.com/Motasaith/StickMan, licensed AGPL-3.0-or-later".
          </li>
        </ul>
        <p>
          Running a modified copy as a service for other people means offering them its source code (section 13). The full rules are in <A href={`${REPO}/blob/main/ATTRIBUTION.md`}>ATTRIBUTION.md</A>. If the
          project helped you, a <A href={REPO}>star on GitHub</A> is appreciated.
        </p>

        <h2>AI models (run on your computer)</h2>
        <ul>
          <li>
            <A href="https://huggingface.co/hexgrad/Kokoro-82M">Kokoro-82M</A> studio voices, by hexgrad (Apache 2.0), via the <A href="https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX">ONNX Community</A> build.
          </li>
          <li>
            <A href="https://github.com/resemble-ai/chatterbox">Chatterbox</A> voice cloning, by Resemble AI.
          </li>
          <li>
            <A href="https://github.com/openai/whisper">Whisper</A> speech recognition, by OpenAI, via <A href="https://huggingface.co/docs/transformers.js">Transformers.js</A>.
          </li>
          <li>
            <A href="https://github.com/espeak-ng/espeak-ng">eSpeak NG</A> pronunciation, used by the studio voices.
          </li>
        </ul>
        <p>Each model's own license applies; see the linked pages.</p>

        <h2>Online services</h2>
        <ul>
          <li>
            Stock video and photos from <A href="https://www.pexels.com/license/">Pexels</A> (Pexels license).
          </li>
          <li>
            Photos from <A href="https://commons.wikimedia.org/">Wikimedia Commons</A> (license varies per file) and <A href="https://images.nasa.gov/">NASA</A> (generally not copyrighted; see NASA's media guidelines).
          </li>
          <li>
            Creative Commons pictures and music found through <A href="https://openverse.org/">Openverse</A> (license per file, shown with each result).
          </li>
          <li>
            AI pictures from <A href="https://huggingface.co/black-forest-labs/FLUX.1-schnell">FLUX.1 [schnell]</A> on Hugging Face, or <A href="https://pollinations.ai/">Pollinations</A>.
          </li>
          <li>Online voices from Microsoft Edge text to speech.</li>
        </ul>

        <h2>Graphics and fonts</h2>
        <ul>
          <li>
            Emoji stickers by <A href="https://github.com/jdecked/twemoji">Twemoji</A>, licensed <A href="https://creativecommons.org/licenses/by/4.0/">CC-BY 4.0</A>.
          </li>
          <li>Fonts: Poppins, Roboto, Archivo Black, Anton, Bebas Neue, Righteous, Abril Fatface, DM Serif Display, Pacifico, Lobster, Indie Flower, Permanent Marker, Noto Naskh Arabic and Noto Nastaliq Urdu, under the SIL Open Font License or Apache 2.0. Their license files ship in <code>public/fonts/licenses</code>.</li>
          <li>
            Icons by <A href="https://lucide.dev/">Lucide</A> (ISC).
          </li>
        </ul>

        <h2>Software</h2>
        <p>
          React, Vite, Tailwind CSS, Radix UI, Zustand, Zod, Hono, Three.js, FFmpeg (through ffmpeg-static), mp4-muxer, Hugging Face Transformers.js, ONNX Runtime and many more packages, each under its own
          open-source license. The full list is in <code>package.json</code>.
        </p>
      </>
    ),
  },
};

const ORDER = ["privacy", "terms", "credits"] as const;

export default function Legal() {
  const { page = "privacy" } = useParams();
  const doc = PAGES[page] ?? PAGES.privacy;
  useEffect(() => {
    document.documentElement.classList.remove("theme-editor");
    document.title = `${doc.title} · Stickman Studio`;
    window.scrollTo(0, 0);
    return () => {
      document.title = "Stickman Studio";
    };
  }, [doc]);
  return (
    <div className="min-h-full bg-background text-foreground">
      <div className="mx-auto max-w-[1200px] px-6">
        <header className="flex h-[88px] items-center justify-between border-b border-line">
          <Link to="/" aria-label="Home">
            <Logo className="h-7" />
          </Link>
          <Link to="/" className="flex items-center gap-1.5 text-sm hover:text-primary">
            <ArrowLeft className="size-4" /> Back to the studio
          </Link>
        </header>
        <div className="grid gap-10 py-14 md:grid-cols-[200px_1fr]">
          <nav aria-label="Legal pages" className="flex gap-2 md:flex-col md:gap-1">
            {ORDER.map((id) => (
              <Link key={id} to={`/legal/${id}`} className={cn("border-l-2 px-3 py-1.5 text-sm transition", PAGES[id] === doc ? "border-primary font-medium text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}>
                {PAGES[id].title}
              </Link>
            ))}
          </nav>
          <article className="legal max-w-[720px]">
            <p className="eyebrow mb-3">Last updated {UPDATED}</p>
            <h1 className="font-display text-4xl font-bold">{doc.title}</h1>
            <p className="mt-4 text-lg leading-8 text-muted-foreground">{doc.intro}</p>
            <div className="mt-8">{doc.body}</div>
          </article>
        </div>
      </div>
      <SiteFooter />
    </div>
  );
}
