// Nature, weather and environment illustrations.
const { S, ease, easeN, shadow, sparkle, float } = require("./_shared.cjs");

module.exports = {
  plant: {
    name: "Growing plant",
    tags: "plant growing seedling growth sprout garden nature environment sustainability eco green agriculture",
    svg: `<svg ${S}>
${shadow(200, 360, 110)}
<path d="M200 300 V180" stroke="#5BB85D" stroke-width="12" stroke-linecap="round">
  <animate attributeName="d" values="M200 300 V300;M200 300 V160;M200 300 V160" keyTimes="0;0.5;1" dur="4s" repeatCount="indefinite" ${ease}/>
</path>
<g transform-origin="200 220">
  <animateTransform attributeName="transform" type="scale" values="0;0;1;1" keyTimes="0;0.25;0.55;1" dur="4s" repeatCount="indefinite" ${easeN(3)}/>
  <path d="M200 220 C170 210 130 220 110 180 C150 160 190 180 200 220 Z" fill="#7ED957"/>
  <path d="M200 200 C230 190 270 196 290 150 C250 134 210 156 200 200 Z" fill="#5BB85D"/>
</g>
<g transform-origin="200 160">
  <animateTransform attributeName="transform" type="scale" values="0;0;1;1" keyTimes="0;0.45;0.7;1" dur="4s" repeatCount="indefinite" ${easeN(3)}/>
  <path d="M200 160 C180 130 190 100 200 84 C210 100 220 130 200 160 Z" fill="#7ED957"/>
</g>
<path d="M120 290 H280 L262 350 H138 Z" fill="#E07A5F"/><rect x="108" y="276" width="184" height="30" rx="8" fill="#F09473"/>
</svg>`,
  },

  tree: {
    name: "Tree in the wind",
    tags: "tree forest nature environment park outdoors oak ecology climate green woods",
    svg: `<svg ${S}>
${shadow(200, 358, 120)}
<path d="M186 350 C190 300 184 260 176 230 H224 C216 260 210 300 214 350 Z" fill="#8D5A3B"/>
<g>
  <animateTransform attributeName="transform" type="rotate" values="-3 200 300;3 200 300;-3 200 300" dur="3s" repeatCount="indefinite" ${ease}/>
  <circle cx="200" cy="150" r="90" fill="#5BB85D"/><circle cx="130" cy="200" r="64" fill="#5BB85D"/><circle cx="270" cy="200" r="64" fill="#5BB85D"/>
  <circle cx="180" cy="120" r="44" fill="#7ED957"/><circle cx="250" cy="170" r="34" fill="#7ED957"/><circle cx="130" cy="190" r="30" fill="#7ED957"/>
</g>
<path d="M300 110 C306 102 318 104 318 114 C318 124 306 128 300 124 Z" fill="#7ED957">
  <animateMotion dur="4s" repeatCount="indefinite" rotate="auto" path="M0 0 C40 40 20 100 70 140 C100 170 80 220 110 250"/>
  <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.1;0.8;1" dur="4s" repeatCount="indefinite"/>
</path>
</svg>`,
  },

  sun: {
    name: "Shining sun",
    tags: "sun sunny summer weather hot day sunshine solar energy light bright morning",
    svg: `<svg ${S}>
<g>
  <animateTransform attributeName="transform" type="rotate" values="0 200 200;360 200 200" dur="16s" repeatCount="indefinite"/>
  <g fill="#FFC857">
    <rect x="188" y="24" width="24" height="56" rx="12"/><rect x="188" y="320" width="24" height="56" rx="12"/>
    <rect x="24" y="188" width="56" height="24" rx="12"/><rect x="320" y="188" width="56" height="24" rx="12"/>
    <rect x="188" y="24" width="24" height="56" rx="12" transform="rotate(45 200 200)"/><rect x="188" y="320" width="24" height="56" rx="12" transform="rotate(45 200 200)"/>
    <rect x="24" y="188" width="56" height="24" rx="12" transform="rotate(45 200 200)"/><rect x="320" y="188" width="56" height="24" rx="12" transform="rotate(45 200 200)"/>
  </g>
</g>
<circle cx="200" cy="200" r="96" fill="#FFB627"><animate attributeName="r" values="94;102;94" dur="2s" repeatCount="indefinite" ${ease}/></circle>
<circle cx="200" cy="200" r="76" fill="#FFC857"/>
<circle cx="172" cy="190" r="9" fill="#8D5A3B"/><circle cx="228" cy="190" r="9" fill="#8D5A3B"/>
<path d="M170 226 Q200 250 230 226" stroke="#8D5A3B" stroke-width="8" stroke-linecap="round" fill="none"/>
</svg>`,
  },

  rain: {
    name: "Rain cloud",
    tags: "rain cloud weather storm rainy water monsoon forecast climate umbrella precipitation",
    svg: `<svg ${S}>
<g stroke="#4FA3FF" stroke-width="10" stroke-linecap="round">
  <line x1="130" y1="250" x2="120" y2="280"><animateTransform attributeName="transform" type="translate" values="0 0;-10 90" dur="0.9s" repeatCount="indefinite"/><animate attributeName="opacity" values="1;0" dur="0.9s" repeatCount="indefinite"/></line>
  <line x1="190" y1="250" x2="180" y2="280"><animateTransform attributeName="transform" type="translate" values="0 0;-10 90" dur="0.9s" begin="0.3s" repeatCount="indefinite"/><animate attributeName="opacity" values="1;0" dur="0.9s" begin="0.3s" repeatCount="indefinite"/></line>
  <line x1="250" y1="250" x2="240" y2="280"><animateTransform attributeName="transform" type="translate" values="0 0;-10 90" dur="0.9s" begin="0.6s" repeatCount="indefinite"/><animate attributeName="opacity" values="1;0" dur="0.9s" begin="0.6s" repeatCount="indefinite"/></line>
  <line x1="160" y1="270" x2="150" y2="300"><animateTransform attributeName="transform" type="translate" values="0 0;-10 80" dur="0.9s" begin="0.45s" repeatCount="indefinite"/><animate attributeName="opacity" values="1;0" dur="0.9s" begin="0.45s" repeatCount="indefinite"/></line>
  <line x1="220" y1="270" x2="210" y2="300"><animateTransform attributeName="transform" type="translate" values="0 0;-10 80" dur="0.9s" begin="0.15s" repeatCount="indefinite"/><animate attributeName="opacity" values="1;0" dur="0.9s" begin="0.15s" repeatCount="indefinite"/></line>
</g>
<g>
  ${float(6, 3)}
  <path d="M100 240 C60 240 44 206 54 180 C62 158 86 146 108 152 C116 108 154 84 196 92 C234 98 256 126 260 156 C298 152 326 176 326 206 C326 226 312 240 290 240 Z" fill="#8D99AE"/>
  <path d="M100 240 C60 240 44 206 54 180 C80 200 140 214 200 200 C250 190 300 196 326 206 C326 226 312 240 290 240 Z" fill="#6B7689"/>
</g>
</svg>`,
  },

  recycle: {
    name: "Recycling",
    tags: "recycle recycling environment eco waste reuse sustainability green zero waste circular planet",
    svg: `<svg ${S}>
<circle cx="200" cy="200" r="170" fill="#E8F7E8"/>
<g>
  <animateTransform attributeName="transform" type="rotate" values="0 200 200;360 200 200" dur="8s" repeatCount="indefinite"/>
  <g id="chase">
    <path d="M219.1 91.7 A110 110 0 0 1 300 225" stroke="#5BB85D" stroke-width="30" stroke-linecap="round" fill="none"/>
    <path d="M289.7 280 L335 244 L270 222 Z" fill="#5BB85D" stroke="#5BB85D" stroke-width="10" stroke-linejoin="round"/>
  </g>
  <use href="#chase" transform="rotate(120 200 200)"/>
  <use href="#chase" transform="rotate(240 200 200)"/>
</g>
</svg>`,
  },

  earth: {
    name: "Save the planet",
    tags: "earth planet environment climate change eco sustainability green world nature save protect",
    svg: `<svg ${S}>
${shadow(200, 360, 110)}
<g>
  ${float(10, 3)}
  <circle cx="200" cy="190" r="120" fill="#4FA3FF"/>
  <path d="M110 120 C140 96 180 110 180 140 C180 170 140 170 130 200 C120 226 90 220 86 190 C82 160 90 136 110 120 Z" fill="#7ED957"/>
  <path d="M220 200 C250 180 290 190 300 220 C310 256 270 290 240 280 C210 270 196 220 220 200 Z" fill="#7ED957"/>
  <path d="M230 90 C250 80 280 90 290 110 C272 120 248 116 230 90 Z" fill="#7ED957"/>
  <circle cx="170" cy="200" r="10" fill="#2B2D42"/><circle cx="230" cy="170" r="10" fill="#2B2D42"/>
  <path d="M176 236 Q210 256 240 222" stroke="#2B2D42" stroke-width="8" stroke-linecap="round" fill="none"/>
</g>
<path d="M200 340 C160 300 60 290 60 220 C60 180 100 170 120 200" stroke="#5BB85D" stroke-width="12" fill="none" stroke-linecap="round" opacity="0.7"/>
<path d="M200 340 C240 300 340 290 340 220 C340 180 300 170 280 200" stroke="#5BB85D" stroke-width="12" fill="none" stroke-linecap="round" opacity="0.7"/>
</svg>`,
  },

  waterdrop: {
    name: "Water drop",
    tags: "water drop hydration drink clean water save water liquid rain aqua ripple",
    svg: `<svg ${S}>
<ellipse cx="200" cy="330" rx="40" ry="10" fill="none" stroke="#4FA3FF" stroke-width="6">
  <animate attributeName="rx" values="20;150" dur="2s" repeatCount="indefinite"/><animate attributeName="ry" values="5;32" dur="2s" repeatCount="indefinite"/><animate attributeName="opacity" values="1;0" dur="2s" repeatCount="indefinite"/>
</ellipse>
<g>
  <animateTransform attributeName="transform" type="translate" values="0 -20;0 12;0 -20" dur="2s" repeatCount="indefinite" ${ease}/>
  <path d="M200 50 C240 110 290 170 290 220 C290 272 250 310 200 310 C150 310 110 272 110 220 C110 170 160 110 200 50 Z" fill="#4FA3FF"/>
  <path d="M150 220 C150 190 164 166 182 150" stroke="#BFE3FF" stroke-width="16" stroke-linecap="round" fill="none"/>
</g>
</svg>`,
  },

  mountain: {
    name: "Mountain goal",
    tags: "mountain summit goal challenge adventure hiking peak climb achievement journey success outdoors",
    svg: `<svg ${S}>
${shadow(200, 346, 170)}
<path d="M20 340 L150 120 L220 230 L260 180 L380 340 Z" fill="#6B7689"/>
<path d="M150 120 L188 184 L170 176 L152 196 L134 172 L114 182 Z" fill="#FFFFFF"/>
<path d="M260 180 L290 220 L272 218 L260 232 L246 214 Z" fill="#FFFFFF"/>
<path d="M150 120 V60" stroke="#2B2D42" stroke-width="6" stroke-linecap="round"/>
<path d="M153 60 H204 L192 74 L204 88 H153 Z" fill="#FF5A6E"><animate attributeName="d" values="M153 60 H204 L192 74 L204 88 H153 Z;M153 62 H200 L194 76 L198 90 H153 Z;M153 60 H204 L192 74 L204 88 H153 Z" dur="1s" repeatCount="indefinite"/></path>
<circle cx="316" cy="90" r="34" fill="#FFC857"><animate attributeName="cy" values="110;90;110" dur="4s" repeatCount="indefinite" ${ease}/></circle>
</svg>`,
  },

  flower: {
    name: "Blooming flower",
    tags: "flower bloom spring garden beauty nature floral blossom gift women wellness",
    svg: `<svg ${S}>
${shadow(200, 360, 100)}
<path d="M200 350 C196 300 204 260 200 210" stroke="#5BB85D" stroke-width="12" stroke-linecap="round" fill="none"/>
<path d="M200 300 C170 290 150 270 146 250 C176 250 196 270 200 300 Z" fill="#7ED957"/>
<g transform-origin="200 160">
  <animateTransform attributeName="transform" type="rotate" values="0;20;0" dur="4s" repeatCount="indefinite" ${ease}/>
  <g fill="#FF8FA3">
    <ellipse cx="200" cy="100" rx="34" ry="52"/><ellipse cx="200" cy="220" rx="34" ry="52"/>
    <ellipse cx="140" cy="160" rx="52" ry="34"/><ellipse cx="260" cy="160" rx="52" ry="34"/>
    <ellipse cx="158" cy="118" rx="34" ry="52" transform="rotate(-45 158 118)"/><ellipse cx="242" cy="202" rx="34" ry="52" transform="rotate(-45 242 202)"/>
    <ellipse cx="242" cy="118" rx="34" ry="52" transform="rotate(45 242 118)"/><ellipse cx="158" cy="202" rx="34" ry="52" transform="rotate(45 158 202)"/>
  </g>
</g>
<circle cx="200" cy="160" r="36" fill="#FFC857"><animate attributeName="r" values="34;40;34" dur="2s" repeatCount="indefinite" ${ease}/></circle>
</svg>`,
  },

  snowflake: {
    name: "Snowflake",
    tags: "snowflake snow winter cold ice frozen christmas season weather freeze",
    svg: `<svg ${S}>
<g stroke="#7BB8FF" stroke-width="16" stroke-linecap="round">
  <animateTransform attributeName="transform" type="rotate" values="0 200 200;60 200 200" dur="6s" repeatCount="indefinite"/>
  <g id="branch"><line x1="200" y1="200" x2="200" y2="50"/><line x1="200" y1="100" x2="166" y2="70"/><line x1="200" y1="100" x2="234" y2="70"/><line x1="200" y1="150" x2="176" y2="130"/><line x1="200" y1="150" x2="224" y2="130"/></g>
  <use href="#branch" transform="rotate(60 200 200)"/><use href="#branch" transform="rotate(120 200 200)"/><use href="#branch" transform="rotate(180 200 200)"/>
  <use href="#branch" transform="rotate(240 200 200)"/><use href="#branch" transform="rotate(300 200 200)"/>
</g>
<circle cx="200" cy="200" r="20" fill="#BFE3FF"/>
</svg>`,
  },

  solarpanel: {
    name: "Solar panel",
    tags: "solar panel renewable energy clean power electricity sun green energy sustainability",
    svg: `<svg ${S}>
<circle cx="320" cy="80" r="44" fill="#FFC857"><animate attributeName="r" values="40;48;40" dur="2s" repeatCount="indefinite" ${ease}/></circle>
${shadow(190, 356, 140)}
<rect x="180" y="250" width="20" height="100" fill="#8D99AE"/><rect x="130" y="340" width="120" height="16" rx="8" fill="#8D99AE"/>
<path d="M60 150 H300 L340 260 H40 Z" fill="#2B2D42"/>
<path d="M70 160 H292 L326 250 H52 Z" fill="#3A62D6"/>
<g stroke="#7BB8FF" stroke-width="4"><path d="M144 160 L130 250 M218 160 L218 250 M292 160 L306 250"/><path d="M62 190 H304 M56 220 H316"/></g>
<path d="M90 164 L110 164 L80 246 L60 246 Z" fill="#FFFFFF" opacity="0.3"><animateTransform attributeName="transform" type="translate" values="0 0;230 0" dur="2.5s" repeatCount="indefinite"/></path>
</svg>`,
  },

  animals: {
    name: "Cat and dog",
    tags: "pets animals cat dog veterinary vet pet care puppy kitten animal shelter",
    svg: `<svg ${S}>
${shadow(200, 354, 170)}
<g>
  <animateTransform attributeName="transform" type="rotate" values="-4 120 340;4 120 340;-4 120 340" dur="2s" repeatCount="indefinite" ${ease}/>
  <path d="M60 340 C60 250 80 220 120 220 C160 220 180 250 180 340 Z" fill="#C68B59"/>
  <circle cx="120" cy="180" r="56" fill="#C68B59"/>
  <ellipse cx="72" cy="170" rx="18" ry="40" fill="#8D5A3B" transform="rotate(20 72 170)"/><ellipse cx="168" cy="170" rx="18" ry="40" fill="#8D5A3B" transform="rotate(-20 168 170)"/>
  <circle cx="100" cy="176" r="8" fill="#2B2D42"/><circle cx="140" cy="176" r="8" fill="#2B2D42"/>
  <ellipse cx="120" cy="202" rx="14" ry="10" fill="#2B2D42"/>
  <path d="M112 218 Q120 240 128 218" fill="#FF6B6B"/>
</g>
<g>
  <animateTransform attributeName="transform" type="rotate" values="3 290 340;-3 290 340;3 290 340" dur="2.6s" repeatCount="indefinite" ${ease}/>
  <path d="M340 320 C390 310 380 250 360 250" stroke="#FF9F43" stroke-width="16" stroke-linecap="round" fill="none"/>
  <path d="M240 340 C240 262 256 236 290 236 C324 236 340 262 340 340 Z" fill="#FF9F43"/>
  <path d="M244 166 L252 110 L284 146 Z" fill="#FF9F43"/><path d="M336 166 L328 110 L296 146 Z" fill="#FF9F43"/>
  <circle cx="290" cy="190" r="50" fill="#FF9F43"/>
  <ellipse cx="272" cy="186" rx="7" ry="10" fill="#2B2D42"><animate attributeName="ry" values="10;10;1;10" keyTimes="0;0.9;0.95;1" dur="3s" repeatCount="indefinite"/></ellipse>
  <ellipse cx="308" cy="186" rx="7" ry="10" fill="#2B2D42"><animate attributeName="ry" values="10;10;1;10" keyTimes="0;0.9;0.95;1" dur="3s" repeatCount="indefinite"/></ellipse>
  <path d="M284 206 L290 212 L296 206 Z" fill="#FF6B6B"/>
  <g stroke="#FFFFFF" stroke-width="3" stroke-linecap="round"><path d="M250 206 H226 M250 214 L228 222 M330 206 H354 M330 214 L352 222"/></g>
</g>
</svg>`,
  },
};
