// Business, finance and work illustrations.
const { S, ease, easeN, shadow, sparkle, float, person } = require("./_shared.cjs");

module.exports = {
  barchart: {
    name: "Growing bar chart",
    tags: "bar chart growth sales revenue statistics data report increase results analytics performance kpi",
    svg: `<svg ${S}>
${shadow(200, 352, 150)}
<rect x="60" y="330" width="280" height="10" rx="5" fill="#2B2D42"/>
<g>
  <rect x="84" y="250" width="48" height="80" rx="8" fill="#7BB8FF"><animate attributeName="y" values="330;250;250" keyTimes="0;0.35;1" dur="4s" repeatCount="indefinite" ${easeN(2)}/><animate attributeName="height" values="0;80;80" keyTimes="0;0.35;1" dur="4s" repeatCount="indefinite" ${easeN(2)}/></rect>
  <rect x="148" y="200" width="48" height="130" rx="8" fill="#4F7CFF"><animate attributeName="y" values="330;330;200;200" keyTimes="0;0.1;0.45;1" dur="4s" repeatCount="indefinite" ${easeN(3)}/><animate attributeName="height" values="0;0;130;130" keyTimes="0;0.1;0.45;1" dur="4s" repeatCount="indefinite" ${easeN(3)}/></rect>
  <rect x="212" y="150" width="48" height="180" rx="8" fill="#7B61FF"><animate attributeName="y" values="330;330;150;150" keyTimes="0;0.2;0.55;1" dur="4s" repeatCount="indefinite" ${easeN(3)}/><animate attributeName="height" values="0;0;180;180" keyTimes="0;0.2;0.55;1" dur="4s" repeatCount="indefinite" ${easeN(3)}/></rect>
  <rect x="276" y="90" width="48" height="240" rx="8" fill="#2EC4B6"><animate attributeName="y" values="330;330;90;90" keyTimes="0;0.3;0.65;1" dur="4s" repeatCount="indefinite" ${easeN(3)}/><animate attributeName="height" values="0;0;240;240" keyTimes="0;0.3;0.65;1" dur="4s" repeatCount="indefinite" ${easeN(3)}/></rect>
</g>
<path d="M84 220 L160 170 L220 124 L300 60" stroke="#FF6B6B" stroke-width="10" stroke-linecap="round" stroke-linejoin="round" fill="none" pathLength="1" stroke-dasharray="1" stroke-dashoffset="1">
  <animate attributeName="stroke-dashoffset" values="1;1;0;0" keyTimes="0;0.6;0.85;1" dur="4s" repeatCount="indefinite"/>
</path>
<path d="M278 52 L312 48 L306 82" stroke="#FF6B6B" stroke-width="10" stroke-linecap="round" stroke-linejoin="round" fill="none" opacity="0">
  <animate attributeName="opacity" values="0;0;1;1" keyTimes="0;0.84;0.86;1" dur="4s" repeatCount="indefinite"/>
</path>
</svg>`,
  },

  linechart: {
    name: "Line graph",
    tags: "line graph chart trend growth stock market statistics analytics progress data dashboard",
    svg: `<svg ${S}>
${shadow(200, 356, 150)}
<rect x="50" y="70" width="300" height="260" rx="20" fill="#FFFFFF" stroke="#D9E1EC" stroke-width="4"/>
<g stroke="#EDF2FB" stroke-width="4"><line x1="80" y1="130" x2="320" y2="130"/><line x1="80" y1="190" x2="320" y2="190"/><line x1="80" y1="250" x2="320" y2="250"/></g>
<path d="M80 290 L80 290 C120 280 130 230 160 240 C190 250 200 190 230 180 C260 170 270 130 320 110 L320 300 L80 300 Z" fill="#4F7CFF" opacity="0.15"/>
<path id="trend" d="M80 290 C120 280 130 230 160 240 C190 250 200 190 230 180 C260 170 270 130 320 110" stroke="#4F7CFF" stroke-width="10" stroke-linecap="round" fill="none" pathLength="1" stroke-dasharray="1" stroke-dashoffset="1">
  <animate attributeName="stroke-dashoffset" values="1;0;0" keyTimes="0;0.6;1" dur="4s" repeatCount="indefinite" ${ease}/>
</path>
<circle r="12" fill="#FF6B6B" stroke="#FFFFFF" stroke-width="5">
  <animateMotion dur="4s" repeatCount="indefinite" keyPoints="0;1;1" keyTimes="0;0.6;1" path="M80 290 C120 280 130 230 160 240 C190 250 200 190 230 180 C260 170 270 130 320 110"/>
</circle>
</svg>`,
  },

  piechart: {
    name: "Pie chart",
    tags: "pie chart share percentage market share budget breakdown survey statistics proportion",
    svg: `<svg ${S}>
${shadow(200, 352, 120)}
<circle cx="190" cy="200" r="120" fill="#4F7CFF"/>
<path d="M190 200 L190 80 A120 120 0 0 1 310 200 Z" fill="#FFD166"/>
<path d="M190 200 L310 200 A120 120 0 0 1 130 304 Z" fill="#2EC4B6"/>
<g>
  <animateTransform attributeName="transform" type="translate" values="0 0;-16 -12;0 0" dur="2.4s" repeatCount="indefinite" ${ease}/>
  <path d="M190 200 L130 304 A120 120 0 0 1 86 140 Z" fill="#FF6B6B"/>
</g>
<circle cx="190" cy="200" r="50" fill="#FFFFFF"/>
<text x="190" y="214" font-family="sans-serif" font-size="40" font-weight="bold" fill="#2B2D42" text-anchor="middle">%</text>
</svg>`,
  },

  money: {
    name: "Money and coins",
    tags: "money cash coins finance savings income profit salary budget payment wealth dollars economy",
    svg: `<svg ${S}>
${shadow(200, 354, 150)}
<g>
  ${float(8, 3)}
  <g transform="rotate(-10 170 170)">
    <rect x="60" y="110" width="220" height="120" rx="14" fill="#5BB85D"/>
    <rect x="76" y="126" width="188" height="88" rx="10" fill="none" stroke="#8FD98F" stroke-width="5"/>
    <circle cx="170" cy="170" r="32" fill="#8FD98F"/>
    <text x="170" y="186" font-family="sans-serif" font-size="44" font-weight="bold" fill="#2F7D32" text-anchor="middle">$</text>
  </g>
</g>
<g fill="#FFC857" stroke="#E0A526" stroke-width="5">
  <ellipse cx="270" cy="320" rx="56" ry="18"/><rect x="214" y="298" width="112" height="22" fill="#FFC857" stroke="none"/><ellipse cx="270" cy="298" rx="56" ry="18"/>
  <ellipse cx="270" cy="276" rx="56" ry="18"/><rect x="214" y="254" width="112" height="22" fill="#FFC857" stroke="none"/><ellipse cx="270" cy="254" rx="56" ry="18"/>
</g>
<g>
  <animateTransform attributeName="transform" type="translate" values="0 -160;0 -160;0 0;0 0" keyTimes="0;0.2;0.5;1" dur="2.8s" repeatCount="indefinite" calcMode="spline" keySplines="0 0 1 1;0.5 0 1 1;0 0 1 1"/>
  <animate attributeName="opacity" values="0;1;1;1" keyTimes="0;0.2;0.5;1" dur="2.8s" repeatCount="indefinite"/>
  <ellipse cx="270" cy="232" rx="56" ry="18" fill="#FFD875" stroke="#E0A526" stroke-width="5"/>
</g>
${sparkle(92, 300, 0.8, 0.3)}
</svg>`,
  },

  piggybank: {
    name: "Piggy bank",
    tags: "piggy bank savings save money budget finance deposit investment kids banking",
    svg: `<svg ${S}>
${shadow(200, 352, 130)}
<g>
  <animateTransform attributeName="transform" type="rotate" values="0 200 330;-3 200 330;3 200 330;0 200 330" keyTimes="0;0.55;0.7;1" dur="2.4s" repeatCount="indefinite"/>
  <rect x="112" y="290" width="30" height="50" rx="10" fill="#F57A9B"/><rect x="250" y="290" width="30" height="50" rx="10" fill="#F57A9B"/>
  <ellipse cx="200" cy="230" rx="130" ry="100" fill="#FF9EB8"/>
  <path d="M130 150 L110 100 L170 132 Z" fill="#F57A9B"/>
  <ellipse cx="322" cy="236" rx="34" ry="40" fill="#F57A9B"/>
  <circle cx="314" cy="226" r="7" fill="#C4506F"/><circle cx="334" cy="226" r="7" fill="#C4506F"/>
  <circle cx="270" cy="200" r="10" fill="#2B2D42"/>
  <rect x="170" y="134" width="70" height="12" rx="6" fill="#C4506F"/>
  <path d="M72 230 C50 220 56 196 74 204" stroke="#F57A9B" stroke-width="10" stroke-linecap="round" fill="none"/>
</g>
<g>
  <animateTransform attributeName="transform" type="translate" values="0 -90;0 30;0 30" keyTimes="0;0.5;1" dur="2.4s" repeatCount="indefinite" calcMode="spline" keySplines="0.5 0 1 1;0 0 1 1"/>
  <animate attributeName="opacity" values="1;1;0;0" keyTimes="0;0.48;0.52;1" dur="2.4s" repeatCount="indefinite"/>
  <circle cx="205" cy="100" r="30" fill="#FFC857" stroke="#E0A526" stroke-width="6"/>
  <text x="205" y="114" font-family="sans-serif" font-size="36" font-weight="bold" fill="#B7791F" text-anchor="middle">$</text>
</g>
</svg>`,
  },

  target: {
    name: "Target and arrow",
    tags: "target goal aim objective focus strategy success mission accuracy bullseye marketing",
    svg: `<svg ${S}>
${shadow(190, 356, 120)}
<circle cx="180" cy="210" r="130" fill="#FF5A6E"/><circle cx="180" cy="210" r="100" fill="#FFFFFF"/>
<circle cx="180" cy="210" r="70" fill="#FF5A6E"/><circle cx="180" cy="210" r="40" fill="#FFFFFF"/><circle cx="180" cy="210" r="16" fill="#FF5A6E"/>
<g>
  <animateTransform attributeName="transform" type="translate" values="180 -180;0 0;0 0" keyTimes="0;0.3;1" dur="3s" repeatCount="indefinite" calcMode="spline" keySplines="0.6 0 1 1;0 0 1 1"/>
  <g>
    <animateTransform attributeName="transform" type="rotate" values="0 186 204;0 186 204;-4 186 204;3 186 204;0 186 204" keyTimes="0;0.3;0.36;0.42;0.5" dur="3s" repeatCount="indefinite"/>
    <line x1="186" y1="204" x2="330" y2="60" stroke="#2B2D42" stroke-width="10" stroke-linecap="round"/>
    <path d="M318 48 L352 38 L342 72 L330 60 Z" fill="#4F7CFF"/>
    <path d="M300 56 L330 30 L344 44 L316 72 Z" fill="#7BB8FF"/>
  </g>
</g>
</svg>`,
  },

  trophy: {
    name: "Trophy",
    tags: "trophy award winner champion achievement success prize first place victory best competition",
    svg: `<svg ${S}>
${shadow(200, 356, 110)}
<path d="M130 110 C80 110 70 150 80 180 C92 214 130 222 148 214" stroke="#E0A526" stroke-width="16" fill="none" stroke-linecap="round"/>
<path d="M270 110 C320 110 330 150 320 180 C308 214 270 222 252 214" stroke="#E0A526" stroke-width="16" fill="none" stroke-linecap="round"/>
<path d="M120 80 H280 V150 C280 214 244 250 200 250 C156 250 120 214 120 150 Z" fill="#FFC857"/>
<rect x="182" y="246" width="36" height="44" fill="#E0A526"/>
<rect x="138" y="286" width="124" height="26" rx="8" fill="#FFC857"/><rect x="120" y="310" width="160" height="34" rx="10" fill="#8D5A3B"/>
<path d="M200 110 L212 136 L240 138 L218 156 L226 184 L200 168 L174 184 L182 156 L160 138 L188 136 Z" fill="#FFF3C4"/>
<clipPath id="cup"><path d="M120 80 H280 V150 C280 214 244 250 200 250 C156 250 120 214 120 150 Z"/></clipPath>
<g clip-path="url(#cup)">
  <rect x="60" y="60" width="30" height="220" fill="#FFFFFF" opacity="0.45" transform="rotate(20 200 160)">
    <animate attributeName="x" values="40;330;330" keyTimes="0;0.4;1" dur="3s" repeatCount="indefinite" ${ease}/>
  </rect>
</g>
${sparkle(90, 80, 0.9, 0)}
${sparkle(320, 70, 0.7, 0.6)}
${sparkle(318, 260, 0.6, 1.1, "#7BDFF2")}
</svg>`,
  },

  rocket: {
    name: "Rocket launch",
    tags: "rocket launch startup growth space innovation boost fast launch product mission",
    svg: `<svg ${S}>
<g fill="#FFD166">
  <circle cx="70" cy="80" r="4"><animate attributeName="cy" values="60;420" dur="1.4s" repeatCount="indefinite"/></circle>
  <circle cx="330" cy="40" r="3"><animate attributeName="cy" values="20;420" dur="1.1s" begin="0.4s" repeatCount="indefinite"/></circle>
  <circle cx="110" cy="200" r="3"><animate attributeName="cy" values="0;420" dur="1.3s" begin="0.8s" repeatCount="indefinite"/></circle>
  <circle cx="300" cy="250" r="4"><animate attributeName="cy" values="0;420" dur="1.5s" begin="0.2s" repeatCount="indefinite"/></circle>
</g>
<g>
  <animateTransform attributeName="transform" type="translate" values="0 6;0 -6;0 6" dur="0.6s" repeatCount="indefinite" ${ease}/>
  <path d="M200 316 C182 340 190 370 200 392 C210 370 218 340 200 316 Z" fill="#FF9F43">
    <animate attributeName="d" values="M200 316 C182 340 190 370 200 392 C210 370 218 340 200 316 Z;M200 316 C176 344 190 380 200 404 C210 380 224 344 200 316 Z;M200 316 C182 340 190 370 200 392 C210 370 218 340 200 316 Z" dur="0.3s" repeatCount="indefinite"/>
  </path>
  <path d="M200 318 C190 334 194 354 200 368 C206 354 210 334 200 318 Z" fill="#FFD166"/>
  <path d="M152 240 L110 300 L160 290 Z" fill="#FF5A6E"/><path d="M248 240 L290 300 L240 290 Z" fill="#FF5A6E"/>
  <path d="M200 40 C250 80 262 170 250 300 H150 C138 170 150 80 200 40 Z" fill="#EDF2FB"/>
  <path d="M200 40 C226 60 242 92 248 130 H152 C158 92 174 60 200 40 Z" fill="#FF5A6E"/>
  <circle cx="200" cy="180" r="30" fill="#4F7CFF" stroke="#8D99AE" stroke-width="8"/><circle cx="190" cy="170" r="8" fill="#BFD0FF"/>
  <rect x="176" y="290" width="48" height="24" rx="6" fill="#8D99AE"/>
</g>
</svg>`,
  },

  lightbulb: {
    name: "Idea light bulb",
    tags: "idea light bulb innovation creativity brainstorm inspiration solution insight think invention tip",
    svg: `<svg ${S}>
<g stroke="#FFC857" stroke-width="10" stroke-linecap="round">
  <animate attributeName="opacity" values="0.2;1;0.2" dur="2s" repeatCount="indefinite" ${ease}/>
  <line x1="200" y1="26" x2="200" y2="52"/><line x1="92" y1="72" x2="110" y2="90"/><line x1="308" y1="72" x2="290" y2="90"/>
  <line x1="52" y1="170" x2="78" y2="170"/><line x1="348" y1="170" x2="322" y2="170"/>
</g>
<circle cx="200" cy="168" r="120" fill="#FFE08A"><animate attributeName="opacity" values="0.1;0.45;0.1" dur="2s" repeatCount="indefinite" ${ease}/></circle>
<path d="M200 70 C144 70 104 112 104 166 C104 206 128 230 146 252 C160 270 160 284 160 296 H240 C240 284 240 270 254 252 C272 230 296 206 296 166 C296 112 256 70 200 70 Z" fill="#FFC857"/>
<path d="M150 150 C150 120 170 100 196 96" stroke="#FFF3C4" stroke-width="14" stroke-linecap="round" fill="none"/>
<path d="M176 296 V230 L200 250 L224 230 V296" stroke="#E0A526" stroke-width="8" stroke-linejoin="round" fill="none"/>
<rect x="156" y="294" width="88" height="26" rx="8" fill="#8D99AE"/><rect x="162" y="318" width="76" height="22" rx="8" fill="#6B7689"/>
<rect x="178" y="338" width="44" height="18" rx="9" fill="#4B5563"/>
</svg>`,
  },

  gears: {
    name: "Turning gears",
    tags: "gears settings process system engineering mechanism workflow automation operations teamwork machine",
    svg: `<svg ${S}>
${shadow(200, 360, 140)}
<defs>
  <g id="cog">
    <g fill="currentColor">
      <rect x="-14" y="-100" width="28" height="36" rx="6"/><rect x="-14" y="64" width="28" height="36" rx="6"/>
      <rect x="-100" y="-14" width="36" height="28" rx="6"/><rect x="64" y="-14" width="36" height="28" rx="6"/>
      <rect x="-14" y="-100" width="28" height="36" rx="6" transform="rotate(45)"/><rect x="-14" y="64" width="28" height="36" rx="6" transform="rotate(45)"/>
      <rect x="-100" y="-14" width="36" height="28" rx="6" transform="rotate(45)"/><rect x="64" y="-14" width="36" height="28" rx="6" transform="rotate(45)"/>
      <circle r="72"/>
    </g>
    <circle r="28" fill="#FFFFFF"/>
  </g>
</defs>
<g transform="translate(150 160)" color="#4F7CFF"><g><use href="#cog"/><animateTransform attributeName="transform" type="rotate" values="0;360" dur="6s" repeatCount="indefinite"/></g></g>
<g transform="translate(274 262) scale(0.66)" color="#FF6B6B"><g><use href="#cog"/><animateTransform attributeName="transform" type="rotate" values="22;-338" dur="4s" repeatCount="indefinite"/></g></g>
<g transform="translate(96 290) scale(0.46)" color="#2EC4B6"><g><use href="#cog"/><animateTransform attributeName="transform" type="rotate" values="0;-360" dur="3s" repeatCount="indefinite"/></g></g>
</svg>`,
  },

  calendar: {
    name: "Calendar",
    tags: "calendar date schedule deadline appointment plan event month booking agenda time",
    svg: `<svg ${S}>
${shadow(200, 356, 130)}
<rect x="70" y="80" width="260" height="250" rx="22" fill="#FFFFFF" stroke="#D9E1EC" stroke-width="5"/>
<path d="M70 102 C70 90 80 80 92 80 H308 C320 80 330 90 330 102 V140 H70 Z" fill="#FF5A6E"/>
<rect x="120" y="56" width="18" height="48" rx="9" fill="#2B2D42"/><rect x="262" y="56" width="18" height="48" rx="9" fill="#2B2D42"/>
<g fill="#D9E1EC">
  <rect x="96" y="164" width="34" height="30" rx="6"/><rect x="146" y="164" width="34" height="30" rx="6"/><rect x="196" y="164" width="34" height="30" rx="6"/><rect x="246" y="164" width="34" height="30" rx="6"/>
  <rect x="96" y="210" width="34" height="30" rx="6"/><rect x="146" y="210" width="34" height="30" rx="6"/><rect x="246" y="210" width="34" height="30" rx="6"/>
  <rect x="96" y="256" width="34" height="30" rx="6"/><rect x="146" y="256" width="34" height="30" rx="6"/><rect x="196" y="256" width="34" height="30" rx="6"/><rect x="246" y="256" width="34" height="30" rx="6"/>
</g>
<rect x="196" y="210" width="34" height="30" rx="6" fill="#4F7CFF"/>
<circle cx="213" cy="225" r="34" fill="none" stroke="#FF5A6E" stroke-width="7" stroke-linecap="round" pathLength="1" stroke-dasharray="1" stroke-dashoffset="1" transform="rotate(-90 213 225)">
  <animate attributeName="stroke-dashoffset" values="1;0;0;1" keyTimes="0;0.35;0.85;1" dur="3s" repeatCount="indefinite"/>
</circle>
</svg>`,
  },

  clock: {
    name: "Clock",
    tags: "clock time hours deadline punctual schedule minutes waiting timing productivity",
    svg: `<svg ${S}>
${shadow(200, 358, 110)}
<circle cx="200" cy="200" r="140" fill="#4F7CFF"/><circle cx="200" cy="200" r="118" fill="#FFFFFF"/>
<g fill="#2B2D42"><rect x="196" y="94" width="8" height="20" rx="4"/><rect x="196" y="286" width="8" height="20" rx="4"/><rect x="94" y="196" width="20" height="8" rx="4"/><rect x="286" y="196" width="20" height="8" rx="4"/></g>
<line x1="200" y1="200" x2="200" y2="140" stroke="#2B2D42" stroke-width="12" stroke-linecap="round"><animateTransform attributeName="transform" type="rotate" values="0 200 200;360 200 200" dur="24s" repeatCount="indefinite"/></line>
<line x1="200" y1="200" x2="200" y2="110" stroke="#FF6B6B" stroke-width="7" stroke-linecap="round"><animateTransform attributeName="transform" type="rotate" values="0 200 200;360 200 200" dur="2s" repeatCount="indefinite"/></line>
<circle cx="200" cy="200" r="12" fill="#2B2D42"/>
</svg>`,
  },

  hourglass: {
    name: "Hourglass",
    tags: "hourglass time waiting patience deadline countdown loading sand timer",
    svg: `<svg ${S}>
${shadow(200, 358, 100)}
<g>
  <animateTransform attributeName="transform" type="rotate" values="0 200 200;0 200 200;180 200 200" keyTimes="0;0.85;1" dur="4s" repeatCount="indefinite" calcMode="spline" keySplines="0 0 1 1;0.6 0 0.4 1"/>
  <rect x="110" y="50" width="180" height="26" rx="10" fill="#8D5A3B"/><rect x="110" y="324" width="180" height="26" rx="10" fill="#8D5A3B"/>
  <path d="M136 76 H264 C264 150 212 170 212 200 C212 230 264 250 264 324 H136 C136 250 188 230 188 200 C188 170 136 150 136 76 Z" fill="#EAF6FF" stroke="#BFD9EE" stroke-width="5"/>
  <path d="M150 100 H250 C244 150 206 168 200 196 C194 168 156 150 150 100 Z" fill="#FFC857">
    <animate attributeName="d" values="M150 100 H250 C244 150 206 168 200 196 C194 168 156 150 150 100 Z;M186 176 H214 C212 186 204 190 200 196 C196 190 188 186 186 176 Z;M186 176 H214 C212 186 204 190 200 196 C196 190 188 186 186 176 Z" keyTimes="0;0.85;1" dur="4s" repeatCount="indefinite"/>
  </path>
  <path d="M196 300 H204 C204 300 204 300 204 300 C204 300 196 300 196 300 Z" fill="#FFC857">
    <animate attributeName="d" values="M196 300 H204 C204 300 204 300 204 300 C204 300 196 300 196 300 Z;M150 300 H250 C246 256 214 236 200 222 C186 236 154 256 150 300 Z;M150 300 H250 C246 256 214 236 200 222 C186 236 154 256 150 300 Z" keyTimes="0;0.85;1" dur="4s" repeatCount="indefinite"/>
  </path>
  <line x1="200" y1="196" x2="200" y2="300" stroke="#FFC857" stroke-width="5" stroke-dasharray="8 8"><animate attributeName="stroke-dashoffset" values="0;-32" dur="0.5s" repeatCount="indefinite"/><animate attributeName="opacity" values="1;1;0;0" keyTimes="0;0.84;0.86;1" dur="4s" repeatCount="indefinite"/></line>
</g>
</svg>`,
  },

  presentation: {
    name: "Presentation board",
    tags: "presentation board meeting slides report teaching seminar training pitch lecture chart whiteboard",
    svg: `<svg ${S}>
${shadow(200, 360, 140)}
<rect x="190" y="290" width="20" height="60" fill="#8D99AE"/><path d="M200 300 L140 356 M200 300 L260 356" stroke="#8D99AE" stroke-width="14" stroke-linecap="round"/>
<rect x="50" y="60" width="300" height="220" rx="16" fill="#FFFFFF" stroke="#2B2D42" stroke-width="10"/>
<rect x="36" y="46" width="328" height="24" rx="12" fill="#2B2D42"/>
<g>
  <rect x="84" y="220" width="36" height="34" rx="5" fill="#7BB8FF"/>
  <rect x="136" y="180" width="36" height="74" rx="5" fill="#4F7CFF"><animate attributeName="y" values="220;180;180;220" keyTimes="0;0.3;0.85;1" dur="4s" repeatCount="indefinite"/><animate attributeName="height" values="34;74;74;34" keyTimes="0;0.3;0.85;1" dur="4s" repeatCount="indefinite"/></rect>
  <rect x="188" y="140" width="36" height="114" rx="5" fill="#7B61FF"><animate attributeName="y" values="220;220;140;140;220" keyTimes="0;0.15;0.45;0.85;1" dur="4s" repeatCount="indefinite"/><animate attributeName="height" values="34;34;114;114;34" keyTimes="0;0.15;0.45;0.85;1" dur="4s" repeatCount="indefinite"/></rect>
</g>
<g fill="#D9E1EC"><rect x="250" y="120" width="76" height="12" rx="6"/><rect x="250" y="146" width="60" height="12" rx="6"/><rect x="250" y="172" width="70" height="12" rx="6"/></g>
<rect x="84" y="94" width="120" height="18" rx="9" fill="#FF6B6B"/>
<g>
  <animateTransform attributeName="transform" type="rotate" values="0 380 330;-8 380 330;0 380 330" dur="2s" repeatCount="indefinite" ${ease}/>
  <line x1="380" y1="330" x2="232" y2="146" stroke="#8D5A3B" stroke-width="8" stroke-linecap="round"/>
  <circle cx="232" cy="146" r="8" fill="#FF6B6B"/>
</g>
</svg>`,
  },

  handshake: {
    name: "Handshake",
    tags: "handshake deal partnership agreement cooperation contract business trust collaboration welcome",
    svg: `<svg ${S}>
${shadow(200, 340, 140)}
<g>
  <animateTransform attributeName="transform" type="translate" values="0 0;0 -12;0 8;0 0" dur="1.4s" repeatCount="indefinite" ${easeN(3)}/>
  <path d="M20 160 H110 L160 140 L240 190 L180 250 L100 230 H20 Z" fill="#4F7CFF"/>
  <path d="M380 160 H290 L250 150 L170 200 L220 256 L300 236 H380 Z" fill="#2B2D42"/>
  <path d="M130 186 C160 160 196 150 226 170 L266 200 C280 210 276 232 258 230 L246 228 C254 242 240 258 224 250 C228 266 212 276 198 266 C200 282 182 290 170 280 L126 244 Z" fill="#F4C7A1"/>
  <path d="M270 170 L232 150 C206 140 176 150 160 166 L200 196 C210 186 226 186 236 196 L284 236 Z" fill="#E8B08A"/>
  <g stroke="#D39A76" stroke-width="5" stroke-linecap="round" fill="none"><path d="M246 228 L224 212"/><path d="M224 250 L204 232"/><path d="M198 266 L182 252"/></g>
</g>
${sparkle(90, 90, 0.8, 0.2)}
${sparkle(318, 94, 0.6, 0.9)}
</svg>`,
  },

  team: {
    name: "Team",
    tags: "team people group staff colleagues employees community teamwork users audience customers hr",
    svg: `<svg ${S}>
${shadow(200, 356, 160)}
<g>${float(6, 2.2, 0.4)}${person(110, 230, 1.15, "#7BB8FF", "#E8B08A", "#2B2D42")}</g>
<g>${float(6, 2.2, 0.8)}${person(290, 230, 1.15, "#2EC4B6", "#F4C7A1", "#8D5A3B")}</g>
<g>${float(8, 2.2, 0)}${person(200, 212, 1.45, "#4F7CFF", "#F4C7A1", "#3B2A20")}</g>
</svg>`,
  },

  briefcase: {
    name: "Briefcase",
    tags: "briefcase business job work career office employment professional portfolio corporate",
    svg: `<svg ${S}>
${shadow(200, 352, 140)}
<g>
  ${float(10, 2.6)}
  <path d="M150 110 C150 90 164 80 180 80 H220 C236 80 250 90 250 110 V130 H226 V110 C226 106 224 104 220 104 H180 C176 104 174 106 174 110 V130 H150 Z" fill="#6B4A36"/>
  <rect x="60" y="126" width="280" height="200" rx="24" fill="#8D5A3B"/>
  <path d="M60 150 C60 136 72 126 86 126 H314 C328 126 340 136 340 150 V210 C260 236 140 236 60 210 Z" fill="#A8704B"/>
  <rect x="180" y="200" width="40" height="40" rx="8" fill="#FFC857"/>
</g>
</svg>`,
  },

  shoppingcart: {
    name: "Shopping cart",
    tags: "shopping cart ecommerce online store buy purchase retail sale checkout customer order",
    svg: `<svg ${S}>
${shadow(210, 352, 140)}
<g>
  <animateTransform attributeName="transform" type="translate" values="-10 0;10 0;-10 0" dur="1.6s" repeatCount="indefinite" ${ease}/>
  <path d="M40 90 H90 L130 260 H300 L330 140 H110" stroke="#2B2D42" stroke-width="14" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
  <path d="M118 150 H318 L296 244 H138 Z" fill="#4F7CFF" opacity="0.2"/>
  <g>
    <animateTransform attributeName="transform" type="translate" values="0 -60;0 0;0 0" keyTimes="0;0.4;1" dur="3.2s" repeatCount="indefinite" calcMode="spline" keySplines="0.5 0 1 1;0 0 1 1"/>
    <rect x="150" y="110" width="56" height="56" rx="8" fill="#FF6B6B"/><rect x="220" y="96" width="60" height="70" rx="8" fill="#FFC857"/>
  </g>
  <g>
    <circle cx="150" cy="306" r="22" fill="#2B2D42"/><circle cx="280" cy="306" r="22" fill="#2B2D42"/>
    <circle cx="150" cy="306" r="8" fill="#FFFFFF"/><circle cx="280" cy="306" r="8" fill="#FFFFFF"/>
  </g>
</g>
</svg>`,
  },

  bank: {
    name: "Bank",
    tags: "bank finance loan banking institution money credit investment financial building savings",
    svg: `<svg ${S}>
${shadow(200, 356, 160)}
<path d="M200 50 L350 130 H50 Z" fill="#4F7CFF"/>
<circle cx="200" cy="104" r="16" fill="#FFC857"/>
<rect x="60" y="130" width="280" height="24" rx="6" fill="#3A62D6"/>
<g fill="#EDF2FB"><rect x="86" y="160" width="36" height="140" rx="6"/><rect x="146" y="160" width="36" height="140" rx="6"/><rect x="218" y="160" width="36" height="140" rx="6"/><rect x="278" y="160" width="36" height="140" rx="6"/></g>
<rect x="50" y="300" width="300" height="24" rx="6" fill="#3A62D6"/><rect x="36" y="322" width="328" height="24" rx="8" fill="#2B2D42"/>
<g>
  <animateTransform attributeName="transform" type="translate" values="0 0;0 -14;0 0" dur="2.2s" repeatCount="indefinite" ${ease}/>
  <circle cx="330" cy="70" r="30" fill="#FFC857" stroke="#E0A526" stroke-width="6"/>
  <text x="330" y="84" font-family="sans-serif" font-size="36" font-weight="bold" fill="#B7791F" text-anchor="middle">$</text>
</g>
</svg>`,
  },

  creditcard: {
    name: "Credit card payment",
    tags: "credit card payment pay purchase bank card transaction checkout debit wallet fintech",
    svg: `<svg ${S}>
${shadow(200, 346, 140)}
<g transform="rotate(-8 200 200)">
  <rect x="70" y="100" width="260" height="170" rx="20" fill="#7B61FF"/>
  <rect x="70" y="140" width="260" height="32" fill="#2B2D42"/>
  <rect x="96" y="196" width="50" height="36" rx="6" fill="#FFC857"/>
  <g fill="#FFFFFF" opacity="0.7"><rect x="170" y="214" width="40" height="10" rx="5"/><rect x="220" y="214" width="40" height="10" rx="5"/><rect x="270" y="214" width="34" height="10" rx="5"/></g>
</g>
<g>
  <animate attributeName="opacity" values="0;0;1;1;0" keyTimes="0;0.4;0.5;0.9;1" dur="3s" repeatCount="indefinite"/>
  <circle cx="306" cy="272" r="44" fill="#5BB85D"/>
  <path d="M286 272 L300 286 L328 256" stroke="#FFFFFF" stroke-width="12" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
</g>
</svg>`,
  },

  puzzle: {
    name: "Puzzle pieces",
    tags: "puzzle pieces solution fit strategy problem solving integration teamwork match strategy connect",
    svg: `<svg ${S}>
${shadow(200, 352, 140)}
<path d="M70 110 H150 C150 86 186 86 186 110 H200 V180 C224 180 224 216 200 216 V290 H70 Z" fill="#4F7CFF"/>
<g>
  <animateTransform attributeName="transform" type="translate" values="80 -30;80 -30;0 0;0 0;80 -30" keyTimes="0;0.2;0.5;0.8;1" dur="4s" repeatCount="indefinite" ${easeN(4)}/>
  <path d="M200 110 H330 V290 H200 V216 C224 216 224 180 200 180 Z" fill="#FF6B6B"/>
</g>
${sparkle(206, 90, 0.7, 1.9)}
</svg>`,
  },

  growth: {
    name: "Growth stairs",
    tags: "growth steps progress career ladder improvement stairs success levels development milestones",
    svg: `<svg ${S}>
${shadow(200, 356, 160)}
<rect x="50" y="280" width="80" height="70" rx="6" fill="#7BB8FF"/>
<rect x="130" y="220" width="80" height="130" rx="6" fill="#4F7CFF"/>
<rect x="210" y="160" width="80" height="190" rx="6" fill="#7B61FF"/>
<rect x="290" y="100" width="80" height="250" rx="6" fill="#2EC4B6"/>
<path d="M330 100 V40" stroke="#2B2D42" stroke-width="6" stroke-linecap="round"/>
<path d="M334 40 H384 L372 54 L384 68 H334 Z" fill="#FF5A6E"><animate attributeName="d" values="M334 40 H384 L372 54 L384 68 H334 Z;M334 42 H382 L374 56 L380 70 H334 Z;M334 40 H384 L372 54 L384 68 H334 Z" dur="1s" repeatCount="indefinite"/></path>
<circle r="16" fill="#FFC857" stroke="#E0A526" stroke-width="5">
  <animateMotion dur="3s" repeatCount="indefinite" path="M90 264 Q130 180 170 204 Q210 120 250 144 Q290 60 330 84" calcMode="linear"/>
</circle>
</svg>`,
  },
};
