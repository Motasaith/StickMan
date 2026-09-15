// Travel, transport, places, food and lifestyle illustrations.
const { S, ease, easeN, shadow, sparkle, float } = require("./_shared.cjs");

module.exports = {
  airplane: {
    name: "Airplane",
    tags: "airplane plane flight travel trip vacation tourism airline flying international holiday journey",
    svg: `<svg ${S}>
<g fill="#FFFFFF" stroke="#D9E1EC" stroke-width="4">
  <path d="M60 300 C40 300 36 276 54 270 C58 254 80 250 90 262 C104 256 120 266 118 280 C130 284 128 300 116 300 Z"><animateTransform attributeName="transform" type="translate" values="60 0;-80 0" dur="4s" repeatCount="indefinite"/></path>
  <path d="M300 110 C282 110 278 90 294 86 C298 72 316 68 326 78 C338 74 352 82 350 94 C360 98 358 110 348 110 Z"><animateTransform attributeName="transform" type="translate" values="80 0;-300 0" dur="6s" repeatCount="indefinite"/></path>
</g>
<g>
  <animateTransform attributeName="transform" type="translate" values="0 10;0 -10;0 10" dur="3s" repeatCount="indefinite" ${ease}/>
  <path d="M60 210 C60 190 90 180 120 180 H300 C340 180 370 196 370 210 C370 224 340 240 300 240 H120 C90 240 60 230 60 210 Z" fill="#EDF2FB"/>
  <path d="M300 180 C340 180 370 196 370 210 H310 C300 210 294 196 300 180 Z" fill="#7BB8FF"/>
  <path d="M170 196 L250 196 L160 110 H130 Z" fill="#4F7CFF"/><path d="M170 224 L250 224 L160 310 H130 Z" fill="#3A62D6"/>
  <path d="M70 200 L60 150 H90 L110 196 Z" fill="#FF6B6B"/>
  <g fill="#7BB8FF"><circle cx="150" cy="210" r="7"/><circle cx="180" cy="210" r="7"/><circle cx="210" cy="210" r="7"/><circle cx="240" cy="210" r="7"/><circle cx="270" cy="210" r="7"/></g>
</g>
</svg>`,
  },

  car: {
    name: "Car driving",
    tags: "car driving vehicle transport automobile road trip commute traffic automotive delivery taxi",
    svg: `<svg ${S}>
<rect x="0" y="316" width="400" height="12" fill="#8D99AE"/>
<g fill="#FFFFFF"><rect x="20" y="320" width="50" height="4" rx="2"><animate attributeName="x" values="400;-60" dur="1s" repeatCount="indefinite"/></rect><rect x="220" y="320" width="50" height="4" rx="2"><animate attributeName="x" values="600;140" dur="1s" repeatCount="indefinite"/></rect></g>
<g>
  <animateTransform attributeName="transform" type="translate" values="0 0;0 -4;0 0" dur="0.5s" repeatCount="indefinite"/>
  <path d="M50 280 C50 250 60 232 90 228 L130 170 C140 156 150 150 170 150 H250 C270 150 282 158 294 172 L330 228 C360 234 360 256 360 280 V290 H50 Z" fill="#FF5A6E"/>
  <path d="M140 222 L172 176 H212 V222 Z M226 222 V176 H250 C258 176 264 180 270 188 L294 222 Z" fill="#BFE3FF"/>
  <rect x="330" y="250" width="30" height="16" rx="6" fill="#FFC857"/><rect x="50" y="250" width="24" height="14" rx="6" fill="#FF9F43"/>
</g>
<g>
  <circle cx="120" cy="296" r="32" fill="#2B2D42"/><circle cx="290" cy="296" r="32" fill="#2B2D42"/>
  <circle cx="120" cy="296" r="14" fill="#D9E1EC"/><circle cx="290" cy="296" r="14" fill="#D9E1EC"/>
  <line x1="120" y1="282" x2="120" y2="310" stroke="#8D99AE" stroke-width="5"><animateTransform attributeName="transform" type="rotate" values="0 120 296;360 120 296" dur="0.5s" repeatCount="indefinite"/></line>
  <line x1="290" y1="282" x2="290" y2="310" stroke="#8D99AE" stroke-width="5"><animateTransform attributeName="transform" type="rotate" values="0 290 296;360 290 296" dur="0.5s" repeatCount="indefinite"/></line>
</g>
</svg>`,
  },

  truck: {
    name: "Delivery truck",
    tags: "truck delivery shipping logistics transport cargo courier freight supply chain order dispatch",
    svg: `<svg ${S}>
<rect x="0" y="316" width="400" height="10" fill="#8D99AE"/>
<g stroke="#D9E1EC" stroke-width="8" stroke-linecap="round"><line x1="20" y1="170" x2="0" y2="170"><animate attributeName="x1" values="30;0" dur="0.6s" repeatCount="indefinite"/></line><line x1="20" y1="220" x2="0" y2="220"><animate attributeName="x1" values="40;0" dur="0.6s" begin="0.3s" repeatCount="indefinite"/></line></g>
<g>
  <animateTransform attributeName="transform" type="translate" values="0 0;0 -3;0 0" dur="0.4s" repeatCount="indefinite"/>
  <rect x="40" y="120" width="210" height="170" rx="10" fill="#4F7CFF"/>
  <rect x="70" y="160" width="60" height="50" rx="6" fill="#FFC857"/><rect x="140" y="150" width="80" height="60" rx="6" fill="#FF9F43"/>
  <path d="M250 170 H320 C332 170 340 176 346 186 L370 234 V290 H250 Z" fill="#FF6B6B"/>
  <path d="M268 190 H316 L338 234 H268 Z" fill="#BFE3FF"/>
</g>
<circle cx="100" cy="300" r="28" fill="#2B2D42"/><circle cx="310" cy="300" r="28" fill="#2B2D42"/>
<circle cx="100" cy="300" r="11" fill="#D9E1EC"/><circle cx="310" cy="300" r="11" fill="#D9E1EC"/>
</svg>`,
  },

  mappin: {
    name: "Map location pin",
    tags: "map location pin place address gps navigation destination local store find us directions",
    svg: `<svg ${S}>
<path d="M40 330 L120 290 L200 320 L280 280 L360 310 V360 L280 330 L200 370 L120 340 L40 380 Z" fill="#8FD98F"/>
<path d="M120 290 L200 320 V370 L120 340 Z" fill="#7ED957"/><path d="M280 280 L360 310 V360 L280 330 Z" fill="#7ED957"/>
<ellipse cx="200" cy="326" rx="40" ry="12" fill="#2B2D42" opacity="0.2"><animate attributeName="rx" values="40;26;40" dur="1.6s" repeatCount="indefinite" ${ease}/></ellipse>
<g>
  <animateTransform attributeName="transform" type="translate" values="0 0;0 -36;0 0" dur="1.6s" repeatCount="indefinite" ${ease}/>
  <path d="M200 320 C170 270 110 220 110 150 C110 98 150 60 200 60 C250 60 290 98 290 150 C290 220 230 270 200 320 Z" fill="#FF5A6E"/>
  <circle cx="200" cy="150" r="38" fill="#FFFFFF"/>
</g>
</svg>`,
  },

  house: {
    name: "House",
    tags: "house home real estate property mortgage family living rent buy apartment housing",
    svg: `<svg ${S}>
${shadow(200, 352, 160)}
<rect x="250" y="80" width="40" height="80" fill="#8D5A3B"/>
<g fill="#D9E1EC"><circle cx="270" cy="60" r="16"><animate attributeName="cy" values="70;20" dur="2.4s" repeatCount="indefinite"/><animate attributeName="opacity" values="0.9;0" dur="2.4s" repeatCount="indefinite"/><animate attributeName="r" values="10;26" dur="2.4s" repeatCount="indefinite"/></circle></g>
<rect x="80" y="180" width="240" height="166" fill="#FFE8C2"/>
<path d="M50 196 L200 70 L350 196 Z" fill="#FF6B6B"/><path d="M50 196 L200 70 L200 90 L70 200 Z" fill="#E0445A"/>
<rect x="170" y="250" width="60" height="96" rx="6" fill="#8D5A3B"/><circle cx="218" cy="300" r="5" fill="#FFC857"/>
<rect x="100" y="220" width="50" height="46" rx="6" fill="#7BB8FF"/><rect x="250" y="220" width="50" height="46" rx="6" fill="#7BB8FF"/>
<rect x="250" y="220" width="50" height="46" rx="6" fill="#FFE08A"><animate attributeName="opacity" values="0;1;0" dur="3s" repeatCount="indefinite"/></rect>
</svg>`,
  },

  city: {
    name: "City skyline",
    tags: "city skyline buildings urban town downtown company office real estate metropolis skyscrapers",
    svg: `<svg ${S}>
<circle cx="320" cy="90" r="40" fill="#FFC857"/>
<rect x="30" y="200" width="70" height="150" fill="#7BB8FF"/><rect x="100" y="130" width="80" height="220" fill="#4F7CFF"/>
<rect x="180" y="170" width="60" height="180" fill="#7B61FF"/><rect x="240" y="100" width="80" height="250" fill="#3A62D6"/><rect x="320" y="220" width="56" height="130" fill="#7BB8FF"/>
<g fill="#FFE08A">
  <rect x="116" y="150" width="16" height="16"><animate attributeName="opacity" values="1;0.2;1" dur="2s" repeatCount="indefinite"/></rect><rect x="148" y="190" width="16" height="16"/><rect x="116" y="230" width="16" height="16"><animate attributeName="opacity" values="0.2;1;0.2" dur="2.6s" repeatCount="indefinite"/></rect>
  <rect x="256" y="120" width="16" height="16"/><rect x="288" y="160" width="16" height="16"><animate attributeName="opacity" values="1;0.2;1" dur="3s" repeatCount="indefinite"/></rect><rect x="256" y="200" width="16" height="16"/><rect x="288" y="250" width="16" height="16"/>
  <rect x="196" y="190" width="12" height="12"/><rect x="216" y="230" width="12" height="12"><animate attributeName="opacity" values="0.2;1;0.2" dur="1.8s" repeatCount="indefinite"/></rect>
  <rect x="46" y="220" width="14" height="14"/><rect x="70" y="260" width="14" height="14"/>
</g>
<rect x="0" y="346" width="400" height="20" fill="#2B2D42"/>
</svg>`,
  },

  coffee: {
    name: "Coffee cup",
    tags: "coffee cup cafe morning break drink tea hot beverage restaurant meeting relax energy",
    svg: `<svg ${S}>
${shadow(200, 346, 130)}
<g stroke="#D9E1EC" stroke-width="10" stroke-linecap="round" fill="none">
  <path d="M160 140 C140 120 180 100 160 70"><animate attributeName="opacity" values="0;1;0" dur="2s" repeatCount="indefinite"/><animateTransform attributeName="transform" type="translate" values="0 10;0 -16" dur="2s" repeatCount="indefinite"/></path>
  <path d="M210 140 C190 120 230 100 210 70"><animate attributeName="opacity" values="0;1;0" dur="2s" begin="0.7s" repeatCount="indefinite"/><animateTransform attributeName="transform" type="translate" values="0 10;0 -16" dur="2s" begin="0.7s" repeatCount="indefinite"/></path>
</g>
<ellipse cx="190" cy="326" rx="140" ry="22" fill="#FFFFFF" stroke="#D9E1EC" stroke-width="5"/>
<path d="M290 200 C340 200 344 270 290 272" stroke="#FF8FA3" stroke-width="20" fill="none"/>
<path d="M80 160 H300 V250 C300 290 270 320 230 320 H150 C110 320 80 290 80 250 Z" fill="#FF8FA3"/>
<ellipse cx="190" cy="160" rx="110" ry="20" fill="#8D5A3B"/>
</svg>`,
  },

  food: {
    name: "Healthy food",
    tags: "food healthy eating nutrition diet salad fruit vegetables meal recipe restaurant cooking",
    svg: `<svg ${S}>
${shadow(200, 346, 160)}
<path d="M50 220 H350 C350 300 290 340 200 340 C110 340 50 300 50 220 Z" fill="#FFFFFF" stroke="#D9E1EC" stroke-width="5"/>
<g>
  <animateTransform attributeName="transform" type="translate" values="0 0;0 -6;0 0" dur="2s" repeatCount="indefinite" ${ease}/>
  <circle cx="130" cy="200" r="40" fill="#5BB85D"/><circle cx="190" cy="186" r="44" fill="#7ED957"/><circle cx="260" cy="200" r="40" fill="#5BB85D"/>
  <circle cx="160" cy="214" r="22" fill="#FF5A6E"/><circle cx="240" cy="216" r="20" fill="#FF5A6E"/>
  <circle cx="206" cy="220" r="18" fill="#FFC857"/>
  <path d="M110 214 L150 232 M270 184 L300 214" stroke="#FF9F43" stroke-width="14" stroke-linecap="round"/>
</g>
<g>
  <animateTransform attributeName="transform" type="rotate" values="-8 320 120;8 320 120;-8 320 120" dur="2.4s" repeatCount="indefinite" ${ease}/>
  <circle cx="320" cy="130" r="36" fill="#FF5A6E"/><path d="M320 96 C320 80 330 70 340 66" stroke="#8D5A3B" stroke-width="6" fill="none" stroke-linecap="round"/><path d="M322 88 C332 72 352 76 356 86 C344 96 330 94 322 88 Z" fill="#5BB85D"/>
</g>
</svg>`,
  },

  fitness: {
    name: "Fitness dumbbell",
    tags: "fitness gym dumbbell exercise workout health sports strength training weight lifting wellness",
    svg: `<svg ${S}>
${shadow(200, 352, 150)}
<g>
  <animateTransform attributeName="transform" type="translate" values="0 40;0 -30;0 40" dur="1.8s" repeatCount="indefinite" ${ease}/>
  <rect x="100" y="186" width="200" height="28" rx="10" fill="#8D99AE"/>
  <rect x="60" y="130" width="46" height="140" rx="14" fill="#2B2D42"/><rect x="24" y="156" width="40" height="88" rx="12" fill="#4B5563"/>
  <rect x="294" y="130" width="46" height="140" rx="14" fill="#2B2D42"/><rect x="336" y="156" width="40" height="88" rx="12" fill="#4B5563"/>
</g>
<g fill="#4FA3FF"><path d="M200 70 C212 88 212 100 200 106 C188 100 188 88 200 70 Z"><animate attributeName="opacity" values="0;1;0" dur="1.8s" repeatCount="indefinite"/></path></g>
</svg>`,
  },

  music: {
    name: "Music notes",
    tags: "music notes song audio sound melody concert singing podcast entertainment listen",
    svg: `<svg ${S}>
<g>
  <animateTransform attributeName="transform" type="translate" values="0 0;0 -16;0 0" dur="2s" repeatCount="indefinite" ${ease}/>
  <path d="M150 90 L320 50 V250" stroke="#7B61FF" stroke-width="20" stroke-linejoin="round" fill="none"/>
  <path d="M150 90 V290" stroke="#7B61FF" stroke-width="20"/>
  <path d="M150 90 L320 50 V100 L150 140 Z" fill="#7B61FF"/>
  <ellipse cx="116" cy="296" rx="44" ry="34" fill="#7B61FF" transform="rotate(-20 116 296)"/>
  <ellipse cx="286" cy="256" rx="44" ry="34" fill="#7B61FF" transform="rotate(-20 286 256)"/>
</g>
<g fill="#FF8FA3">
  <path d="M60 140 C60 120 90 120 90 140 V60 H104 V150 C104 170 60 170 60 140 Z"><animateTransform attributeName="transform" type="translate" values="0 40;-10 -30" dur="2.4s" repeatCount="indefinite"/><animate attributeName="opacity" values="0;1;0" dur="2.4s" repeatCount="indefinite"/></path>
  <path d="M330 170 C330 150 360 150 360 170 V100 H374 V180 C374 200 330 200 330 170 Z"><animateTransform attributeName="transform" type="translate" values="0 40;10 -30" dur="2.4s" begin="1.2s" repeatCount="indefinite"/><animate attributeName="opacity" values="0;1;0" dur="2.4s" begin="1.2s" repeatCount="indefinite"/></path>
</g>
</svg>`,
  },

  camera: {
    name: "Camera",
    tags: "camera photo photography picture video film shoot media content creator snapshot",
    svg: `<svg ${S}>
${shadow(200, 346, 150)}
<rect x="150" y="90" width="100" height="40" rx="10" fill="#4B5563"/>
<rect x="50" y="116" width="300" height="210" rx="30" fill="#2B2D42"/>
<circle cx="200" cy="222" r="80" fill="#4B5563"/><circle cx="200" cy="222" r="60" fill="#4F7CFF"/><circle cx="200" cy="222" r="34" fill="#2B2D42"/>
<circle cx="220" cy="202" r="12" fill="#BFD0FF"/>
<rect x="290" y="140" width="34" height="18" rx="6" fill="#FFC857"/>
<rect x="0" y="0" width="400" height="400" fill="#FFFFFF" opacity="0"><animate attributeName="opacity" values="0;0;0.9;0" keyTimes="0;0.8;0.84;1" dur="2.5s" repeatCount="indefinite"/></rect>
</svg>`,
  },

  play: {
    name: "Video play button",
    tags: "video play youtube streaming media film watch tutorial course content player movie",
    svg: `<svg ${S}>
${shadow(200, 340, 150)}
<rect x="50" y="80" width="300" height="220" rx="36" fill="#FF3B4E"/>
<path d="M170 140 L260 190 L170 240 Z" fill="#FFFFFF" stroke="#FFFFFF" stroke-width="10" stroke-linejoin="round" transform-origin="200 190">
  <animateTransform attributeName="transform" type="scale" values="1;1.15;1" dur="1.4s" repeatCount="indefinite" ${ease}/>
</path>
</svg>`,
  },
};
