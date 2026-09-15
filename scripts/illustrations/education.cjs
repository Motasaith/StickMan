// Education and science illustrations.
const { S, ease, easeN, shadow, sparkle, float } = require("./_shared.cjs");

module.exports = {
  book: {
    name: "Open book",
    tags: "book reading study learning education library knowledge literature story school novel",
    svg: `<svg ${S}>
${shadow(200, 346, 160)}
<path d="M40 110 C100 90 160 96 200 124 V320 C160 296 100 290 40 306 Z" fill="#4F7CFF"/>
<path d="M360 110 C300 90 240 96 200 124 V320 C240 296 300 290 360 306 Z" fill="#3A62D6"/>
<path d="M56 116 C108 100 160 108 196 132 V310 C160 290 108 284 56 296 Z" fill="#FFFFFF"/>
<path d="M344 116 C292 100 240 108 204 132 V310 C240 290 292 284 344 296 Z" fill="#F4F6FA"/>
<g stroke="#D9E1EC" stroke-width="7" stroke-linecap="round"><path d="M84 150 C120 140 150 146 176 160"/><path d="M84 180 C120 170 150 176 176 190"/><path d="M84 210 C120 200 150 206 176 220"/><path d="M224 160 C250 146 280 140 316 150"/><path d="M224 190 C250 176 280 170 316 180"/></g>
<path d="M204 132 C240 108 292 100 344 116 V296 C292 284 240 290 204 310 Z" fill="#FFFFFF">
  <animate attributeName="d" values="M204 132 C240 108 292 100 344 116 V296 C292 284 240 290 204 310 Z;M204 132 C204 132 204 132 204 132 V310 C204 310 204 310 204 310 Z;M196 132 C160 108 108 100 56 116 V296 C108 284 160 290 196 310 Z;M196 132 C160 108 108 100 56 116 V296 C108 284 160 290 196 310 Z" keyTimes="0;0.25;0.5;1" dur="3s" repeatCount="indefinite"/>
  <animate attributeName="opacity" values="1;1;1;0" keyTimes="0;0.5;0.95;1" dur="3s" repeatCount="indefinite"/>
</path>
${sparkle(320, 70, 0.8, 0.5)}
</svg>`,
  },

  graduation: {
    name: "Graduation cap",
    tags: "graduation cap degree university college diploma graduate education school achievement academic student",
    svg: `<svg ${S}>
${shadow(200, 344, 130)}
<g>
  <animateTransform attributeName="transform" type="translate" values="0 0;0 -24;0 0" dur="2.4s" repeatCount="indefinite" ${ease}/>
  <path d="M120 190 V260 C120 290 280 290 280 260 V190" fill="#2B2D42"/>
  <path d="M200 90 L370 160 L200 230 L30 160 Z" fill="#3B3F5C"/>
  <path d="M200 100 L350 160 L200 220 L50 160 Z" fill="#4B5073"/>
  <g>
    <animateTransform attributeName="transform" type="rotate" values="-10 200 160;14 200 160;-10 200 160" dur="2.4s" repeatCount="indefinite" ${ease}/>
    <path d="M200 160 L310 200 V260" stroke="#FFC857" stroke-width="8" fill="none" stroke-linecap="round"/>
    <path d="M298 256 H322 L330 300 H290 Z" fill="#FFC857"/>
  </g>
  <circle cx="200" cy="160" r="12" fill="#FFC857"/>
</g>
</svg>`,
  },

  pencil: {
    name: "Pencil writing",
    tags: "pencil write writing notes draw drawing homework sketch design edit exam school",
    svg: `<svg ${S}>
${shadow(200, 352, 150)}
<path d="M60 300 C100 260 130 330 170 290 C210 250 240 320 290 280" stroke="#4F7CFF" stroke-width="10" stroke-linecap="round" fill="none" pathLength="1" stroke-dasharray="1" stroke-dashoffset="1">
  <animate attributeName="stroke-dashoffset" values="1;0;0" keyTimes="0;0.8;1" dur="3s" repeatCount="indefinite"/>
</path>
<g>
  <animateMotion dur="3s" repeatCount="indefinite" keyPoints="0;1;1" keyTimes="0;0.8;1" path="M60 300 C100 260 130 330 170 290 C210 250 240 320 290 280"/>
  <g transform="rotate(-45)">
    <path d="M0 0 L-18 -40 H18 Z" fill="#F4C7A1"/><path d="M0 0 L-6 -14 H6 Z" fill="#2B2D42"/>
    <rect x="-18" y="-220" width="36" height="180" fill="#FFC857"/><rect x="-18" y="-220" width="12" height="180" fill="#FFD875"/>
    <rect x="-18" y="-240" width="36" height="22" fill="#B8C0CC"/><path d="M-18 -240 H18 V-256 C18 -270 -18 -270 -18 -256 Z" fill="#FF8FA3"/>
  </g>
</g>
</svg>`,
  },

  microscope: {
    name: "Microscope",
    tags: "microscope science laboratory research biology lab experiment scientist medicine discovery study",
    svg: `<svg ${S}>
${shadow(200, 356, 140)}
<rect x="90" y="316" width="220" height="30" rx="12" fill="#2B2D42"/>
<path d="M240 316 C300 300 310 220 250 180" stroke="#4B5563" stroke-width="22" stroke-linecap="round" fill="none"/>
<rect x="130" y="250" width="140" height="18" rx="6" fill="#8D99AE"/>
<rect x="150" y="238" width="60" height="12" rx="4" fill="#BFE9F5"/>
<g transform="rotate(-30 200 150)">
  <rect x="176" y="60" width="48" height="170" rx="14" fill="#4F7CFF"/>
  <rect x="166" y="40" width="68" height="34" rx="10" fill="#3A62D6"/>
  <rect x="186" y="226" width="28" height="30" rx="6" fill="#8D99AE"/>
</g>
<g fill="#5BB85D">
  <circle cx="176" cy="220" r="6"><animate attributeName="opacity" values="0;1;0" dur="1.8s" repeatCount="indefinite"/></circle>
  <circle cx="190" cy="226" r="4"><animate attributeName="opacity" values="0;1;0" dur="1.8s" begin="0.6s" repeatCount="indefinite"/></circle>
</g>
${sparkle(320, 90, 0.8, 0.2, "#7BDFF2")}
</svg>`,
  },

  atom: {
    name: "Atom",
    tags: "atom science physics chemistry nuclear energy molecule research electron quantum",
    svg: `<svg ${S}>
<g fill="none" stroke="#4F7CFF" stroke-width="10">
  <ellipse cx="200" cy="200" rx="150" ry="56"/>
  <ellipse cx="200" cy="200" rx="150" ry="56" transform="rotate(60 200 200)"/>
  <ellipse cx="200" cy="200" rx="150" ry="56" transform="rotate(120 200 200)"/>
</g>
<circle cx="200" cy="200" r="30" fill="#FF6B6B"><animate attributeName="r" values="28;34;28" dur="1.4s" repeatCount="indefinite" ${ease}/></circle>
<circle r="14" fill="#FFC857"><animateMotion dur="2s" repeatCount="indefinite" path="M350 200 A150 56 0 1 1 50 200 A150 56 0 1 1 350 200"/></circle>
<g transform="rotate(60 200 200)"><circle r="14" fill="#2EC4B6"><animateMotion dur="2.6s" repeatCount="indefinite" path="M50 200 A150 56 0 1 1 350 200 A150 56 0 1 1 50 200"/></circle></g>
<g transform="rotate(120 200 200)"><circle r="14" fill="#7B61FF"><animateMotion dur="2.2s" repeatCount="indefinite" path="M350 200 A150 56 0 1 1 50 200 A150 56 0 1 1 350 200"/></circle></g>
</svg>`,
  },

  flask: {
    name: "Chemistry flask",
    tags: "flask chemistry lab experiment science beaker potion research chemical test reaction",
    svg: `<svg ${S}>
${shadow(200, 356, 120)}
<path d="M168 60 H232 V150 L320 300 C332 322 318 340 294 340 H106 C82 340 68 322 80 300 L168 150 Z" fill="#EAF6FF" stroke="#BFD9EE" stroke-width="8" stroke-linejoin="round"/>
<path d="M126 230 H274 L312 300 C320 314 312 326 296 326 H104 C88 326 80 314 88 300 Z" fill="#7B61FF">
  <animate attributeName="d" values="M126 230 C170 220 230 240 274 230 L312 300 C320 314 312 326 296 326 H104 C88 326 80 314 88 300 Z;M126 230 C170 240 230 220 274 230 L312 300 C320 314 312 326 296 326 H104 C88 326 80 314 88 300 Z;M126 230 C170 220 230 240 274 230 L312 300 C320 314 312 326 296 326 H104 C88 326 80 314 88 300 Z" dur="2s" repeatCount="indefinite" ${ease}/>
</path>
<rect x="156" y="46" width="88" height="22" rx="10" fill="#8D99AE"/>
<g fill="#C8BAFF">
  <circle cx="170" cy="290" r="12"><animate attributeName="cy" values="300;120" dur="2.4s" repeatCount="indefinite"/><animate attributeName="opacity" values="1;1;0" keyTimes="0;0.7;1" dur="2.4s" repeatCount="indefinite"/></circle>
  <circle cx="220" cy="290" r="9"><animate attributeName="cy" values="310;100" dur="2s" begin="0.7s" repeatCount="indefinite"/><animate attributeName="opacity" values="1;1;0" keyTimes="0;0.7;1" dur="2s" begin="0.7s" repeatCount="indefinite"/></circle>
  <circle cx="200" cy="290" r="7"><animate attributeName="cy" values="300;80" dur="2.8s" begin="1.3s" repeatCount="indefinite"/><animate attributeName="opacity" values="1;1;0" keyTimes="0;0.7;1" dur="2.8s" begin="1.3s" repeatCount="indefinite"/></circle>
</g>
</svg>`,
  },

  calculator: {
    name: "Calculator",
    tags: "calculator math accounting finance numbers calculate tax budget arithmetic sums",
    svg: `<svg ${S}>
${shadow(200, 360, 110)}
<rect x="100" y="40" width="200" height="300" rx="26" fill="#2B2D42"/>
<rect x="122" y="64" width="156" height="66" rx="10" fill="#BFE9F5"/>
<text x="266" y="112" font-family="monospace" font-size="38" font-weight="bold" fill="#2B2D42" text-anchor="end">42<animate attributeName="opacity" values="1;0;1" keyTimes="0;0.5;1" dur="1.2s" repeatCount="indefinite" calcMode="discrete"/></text>
<g fill="#4B5563">
  <rect x="122" y="150" width="40" height="36" rx="8"/><rect x="180" y="150" width="40" height="36" rx="8"/><rect x="238" y="150" width="40" height="36" rx="8" fill="#FF9F43"/>
  <rect x="122" y="200" width="40" height="36" rx="8"/><rect x="180" y="200" width="40" height="36" rx="8"/><rect x="238" y="200" width="40" height="36" rx="8" fill="#FF9F43"/>
  <rect x="122" y="250" width="40" height="36" rx="8"/><rect x="180" y="250" width="40" height="36" rx="8"/><rect x="238" y="250" width="40" height="66" rx="8" fill="#5BB85D"/>
  <rect x="122" y="300" width="98" height="16" rx="8"/>
</g>
<rect x="180" y="200" width="40" height="36" rx="8" fill="#7B61FF"><animate attributeName="opacity" values="0;1;0" dur="0.9s" repeatCount="indefinite"/></rect>
</svg>`,
  },

  telescope: {
    name: "Telescope and stars",
    tags: "telescope astronomy stars space vision future explore discovery night sky science",
    svg: `<svg ${S}>
<g fill="#FFD166">
  <path d="M300 50 l6 14 14 2 -10 10 3 14 -13 -7 -13 7 3 -14 -10 -10 14 -2z"><animate attributeName="opacity" values="0.3;1;0.3" dur="1.6s" repeatCount="indefinite"/></path>
  <circle cx="350" cy="130" r="6"><animate attributeName="opacity" values="1;0.2;1" dur="1.2s" repeatCount="indefinite"/></circle>
  <circle cx="240" cy="40" r="5"><animate attributeName="opacity" values="0.2;1;0.2" dur="1.4s" begin="0.4s" repeatCount="indefinite"/></circle>
</g>
${shadow(170, 356, 120)}
<path d="M170 240 L110 346 M170 240 L230 346 M170 240 V350" stroke="#8D5A3B" stroke-width="12" stroke-linecap="round"/>
<g>
  <animateTransform attributeName="transform" type="rotate" values="-4 170 230;4 170 230;-4 170 230" dur="4s" repeatCount="indefinite" ${ease}/>
  <g transform="rotate(-32 170 230)">
    <rect x="60" y="200" width="220" height="56" rx="14" fill="#4F7CFF"/>
    <rect x="270" y="190" width="40" height="76" rx="10" fill="#3A62D6"/>
    <rect x="30" y="212" width="40" height="32" rx="6" fill="#2B2D42"/>
    <rect x="140" y="200" width="16" height="56" fill="#FFC857"/>
  </g>
</g>
</svg>`,
  },

  abcblocks: {
    name: "ABC blocks",
    tags: "abc blocks alphabet kids children preschool kindergarten learning letters toys early education",
    svg: `<svg ${S}>
${shadow(200, 356, 150)}
<g><rect x="70" y="236" width="110" height="110" rx="12" fill="#FF6B6B"/><text x="125" y="318" font-family="sans-serif" font-size="80" font-weight="bold" fill="#FFFFFF" text-anchor="middle">A</text></g>
<g><rect x="200" y="236" width="110" height="110" rx="12" fill="#4F7CFF"/><text x="255" y="318" font-family="sans-serif" font-size="80" font-weight="bold" fill="#FFFFFF" text-anchor="middle">B</text></g>
<g>
  <animateTransform attributeName="transform" type="translate" values="0 -120;0 0;0 -8;0 0;0 0" keyTimes="0;0.35;0.45;0.55;1" dur="3s" repeatCount="indefinite" calcMode="spline" keySplines="0.5 0 1 1;0 0 0.5 1;0.5 0 1 1;0 0 1 1"/>
  <rect x="135" y="116" width="110" height="110" rx="12" fill="#FFC857"/><text x="190" y="198" font-family="sans-serif" font-size="80" font-weight="bold" fill="#FFFFFF" text-anchor="middle">C</text>
</g>
</svg>`,
  },

  studentdesk: {
    name: "Student at desk",
    tags: "student studying desk homework exam learning online class school education laptop",
    svg: `<svg ${S}>
${shadow(200, 360, 160)}
<rect x="40" y="250" width="320" height="18" rx="6" fill="#8D5A3B"/><rect x="60" y="266" width="16" height="84" fill="#6B4A36"/><rect x="324" y="266" width="16" height="84" fill="#6B4A36"/>
<path d="M140 250 C140 190 164 170 200 170 C236 170 260 190 260 250 Z" fill="#4F7CFF"/>
<g>
  <animateTransform attributeName="transform" type="rotate" values="-3 200 170;3 200 170;-3 200 170" dur="2.4s" repeatCount="indefinite" ${ease}/>
  <circle cx="200" cy="130" r="40" fill="#F4C7A1"/><path d="M160 128 C156 84 244 80 240 128 C230 104 170 104 160 128 Z" fill="#3B2A20"/>
</g>
<rect x="90" y="214" width="100" height="38" rx="4" fill="#FFFFFF" transform="rotate(-6 140 233)"/>
<g><rect x="222" y="196" width="100" height="56" rx="6" fill="#2B2D42"/><rect x="230" y="202" width="84" height="40" rx="3" fill="#7BDFF2"><animate attributeName="opacity" values="0.6;1;0.6" dur="1.5s" repeatCount="indefinite"/></rect></g>
${sparkle(90, 110, 0.7, 0.2)}
</svg>`,
  },
};
