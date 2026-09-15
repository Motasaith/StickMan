// Health and dental illustrations. Each is an animated SVG (SMIL), 400x400, flat style.
const S = `xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400"`;
const ease = `calcMode="spline" keySplines="0.45 0 0.55 1;0.45 0 0.55 1"`;
const ease3 = `calcMode="spline" keySplines="0.45 0 0.55 1;0.45 0 0.55 1;0.45 0 0.55 1"`;
const shadow = (cx = 200, cy = 356, rx = 120) => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="13" fill="#2B2D42" opacity="0.08"/>`;
const sparkle = (x, y, s, delay, color = "#FFD166") =>
  `<g transform="translate(${x} ${y}) scale(${s})"><path d="M0 -20 C3 -4 4 -3 20 0 C4 3 3 4 0 20 C-3 4 -4 3 -20 0 C-4 -3 -3 -4 0 -20Z" fill="${color}"><animateTransform attributeName="transform" type="scale" values="0.2;1;0.2" dur="1.8s" begin="${delay}s" repeatCount="indefinite" ${ease}/></path></g>`;

module.exports = {
  teeth: {
    name: "Teeth set",
    tags: "teeth dentist dental mouth smile jaw oral hygiene orthodontist",
    svg: `<svg ${S}>
${shadow(200, 360, 140)}
<defs>
  <g id="jaw">
    <g fill="#FFFFFF" stroke="#D9E1EC" stroke-width="3">
      <rect x="46" y="160" width="26" height="46" rx="11"/>
      <rect x="73" y="152" width="28" height="50" rx="11"/>
      <path d="M101 146 h30 v44 q0 12 -15 24 q-15 -12 -15 -24z"/>
      <rect x="131" y="142" width="32" height="56" rx="12"/>
      <rect x="162" y="140" width="38" height="64" rx="13"/>
      <rect x="200" y="140" width="38" height="64" rx="13"/>
      <rect x="237" y="142" width="32" height="56" rx="12"/>
      <path d="M269 146 h30 v44 q0 12 -15 24 q-15 -12 -15 -24z"/>
      <rect x="299" y="152" width="28" height="50" rx="11"/>
      <rect x="328" y="160" width="26" height="46" rx="11"/>
    </g>
    <path d="M34 128 C110 88 290 88 366 128 L366 178 C300 150 100 150 34 178 Z" fill="#F59AAE"/>
    <path d="M34 128 C110 88 290 88 366 128 L366 142 C290 106 110 106 34 142 Z" fill="#E57A93"/>
  </g>
</defs>
<ellipse cx="200" cy="210" rx="150" ry="34" fill="#7A2E3A"/>
<g>
  <use href="#jaw" transform="translate(0 420) scale(1 -1)"/>
  <animateTransform attributeName="transform" type="translate" values="0 0;0 18;0 0" dur="2s" repeatCount="indefinite" ${ease}/>
</g>
<use href="#jaw"/>
<path d="M172 160 q-4 16 0 30" stroke="#EAF2FF" stroke-width="6" stroke-linecap="round" fill="none"/>
<path d="M210 160 q-4 16 0 30" stroke="#EAF2FF" stroke-width="6" stroke-linecap="round" fill="none"/>
${sparkle(330, 70, 1, 0)}
${sparkle(64, 300, 0.8, 0.6)}
${sparkle(352, 312, 0.6, 1.1, "#7BDFF2")}
</svg>`,
  },

  tooth: {
    name: "Happy tooth",
    tags: "tooth dentist dental molar clean healthy smile cavity kids",
    svg: `<svg ${S}>
<ellipse cx="200" cy="356" rx="80" ry="12" fill="#2B2D42" opacity="0.08"><animate attributeName="rx" values="80;66;80" dur="2.4s" repeatCount="indefinite" ${ease}/></ellipse>
<g>
  <animateTransform attributeName="transform" type="translate" values="0 0;0 -14;0 0" dur="2.4s" repeatCount="indefinite" ${ease}/>
  <path d="M130 110 C160 88 185 104 200 112 C215 104 240 88 270 110 C306 134 300 192 285 226 C272 256 268 300 255 318 C245 332 230 325 226 305 C220 276 213 252 200 252 C187 252 180 276 174 305 C170 325 155 332 145 318 C132 300 128 256 115 226 C100 192 94 134 130 110 Z" fill="#FFFFFF" stroke="#D5DDEA" stroke-width="7" stroke-linejoin="round"/>
  <path d="M142 144 C150 128 168 122 182 126" stroke="#DCE7F7" stroke-width="12" stroke-linecap="round" fill="none"/>
  <ellipse cx="170" cy="182" rx="10" ry="12" fill="#2B2D42"><animate attributeName="ry" values="12;12;1.5;12" keyTimes="0;0.9;0.95;1" dur="3.2s" repeatCount="indefinite"/></ellipse>
  <ellipse cx="230" cy="182" rx="10" ry="12" fill="#2B2D42"><animate attributeName="ry" values="12;12;1.5;12" keyTimes="0;0.9;0.95;1" dur="3.2s" repeatCount="indefinite"/></ellipse>
  <circle cx="174" cy="177" r="3.5" fill="#FFFFFF"/><circle cx="234" cy="177" r="3.5" fill="#FFFFFF"/>
  <ellipse cx="148" cy="210" rx="14" ry="8" fill="#FF9AAE" opacity="0.7"/>
  <ellipse cx="252" cy="210" rx="14" ry="8" fill="#FF9AAE" opacity="0.7"/>
  <path d="M178 212 Q200 234 222 212" stroke="#2B2D42" stroke-width="7" stroke-linecap="round" fill="none"/>
</g>
${sparkle(300, 90, 1, 0)}
${sparkle(96, 120, 0.7, 0.7, "#7BDFF2")}
${sparkle(318, 250, 0.55, 1.2)}
</svg>`,
  },

  toothbrush: {
    name: "Toothbrush and paste",
    tags: "toothbrush toothpaste brushing dentist dental hygiene clean teeth routine",
    svg: `<svg ${S}>
${shadow(200, 358, 130)}
<g>
  <animateTransform attributeName="transform" type="translate" values="-18 6;18 -6;-18 6" dur="0.9s" repeatCount="indefinite" ${ease}/>
  <g transform="rotate(-28 200 200)">
    <rect x="70" y="208" width="230" height="30" rx="15" fill="#4F7CFF"/>
    <rect x="70" y="208" width="120" height="30" rx="15" fill="#6C93FF"/>
    <rect x="276" y="200" width="64" height="44" rx="10" fill="#4F7CFF"/>
    <g fill="#FFFFFF" stroke="#D9E1EC" stroke-width="2">
      <rect x="282" y="160" width="10" height="42" rx="4"/><rect x="296" y="156" width="10" height="46" rx="4"/>
      <rect x="310" y="156" width="10" height="46" rx="4"/><rect x="324" y="160" width="10" height="42" rx="4"/>
    </g>
    <path d="M280 158 C284 130 300 140 306 126 C312 140 330 130 336 158 Z" fill="#7BDFF2"/>
    <path d="M292 146 C300 138 314 140 322 146" stroke="#FFFFFF" stroke-width="5" stroke-linecap="round" fill="none"/>
  </g>
</g>
<g fill="#FFFFFF" stroke="#BFE9F5" stroke-width="3">
  <circle cx="300" cy="120" r="12"><animate attributeName="cy" values="130;60" dur="2s" repeatCount="indefinite"/><animate attributeName="opacity" values="0;1;0" dur="2s" repeatCount="indefinite"/></circle>
  <circle cx="330" cy="130" r="8"><animate attributeName="cy" values="140;80" dur="1.6s" begin="0.5s" repeatCount="indefinite"/><animate attributeName="opacity" values="0;1;0" dur="1.6s" begin="0.5s" repeatCount="indefinite"/></circle>
  <circle cx="270" cy="110" r="7"><animate attributeName="cy" values="120;50" dur="1.8s" begin="1s" repeatCount="indefinite"/><animate attributeName="opacity" values="0;1;0" dur="1.8s" begin="1s" repeatCount="indefinite"/></circle>
</g>
<g transform="translate(92 292) rotate(-8)">
  <rect x="0" y="0" width="150" height="46" rx="12" fill="#FFFFFF" stroke="#D9E1EC" stroke-width="3"/>
  <rect x="0" y="0" width="54" height="46" rx="12" fill="#FF6B6B"/>
  <rect x="146" y="12" width="22" height="22" rx="5" fill="#2B2D42"/>
  <rect x="68" y="16" width="60" height="6" rx="3" fill="#4F7CFF"/><rect x="68" y="27" width="40" height="5" rx="2.5" fill="#BFD0FF"/>
</g>
</svg>`,
  },

  heart: {
    name: "Beating heart",
    tags: "heart cardiology health love pulse heartbeat cardio medical care wellness",
    svg: `<svg ${S}>
${shadow(200, 356, 110)}
<path d="M200 300 C120 246 70 200 70 146 C70 106 100 78 138 78 C165 78 187 94 200 116 C213 94 235 78 262 78 C300 78 330 106 330 146 C330 200 280 246 200 300 Z" fill="#FF5A6E" transform-origin="200 190">
  <animateTransform attributeName="transform" type="scale" values="1;1.1;1;1.06;1" keyTimes="0;0.15;0.3;0.45;1" dur="1.2s" repeatCount="indefinite"/>
</path>
<path d="M118 120 C124 104 140 98 154 100" stroke="#FFC2CB" stroke-width="12" stroke-linecap="round" fill="none"/>
<path d="M40 330 H150 L168 300 L190 360 L214 280 L236 346 L252 330 H360" stroke="#2EC4B6" stroke-width="8" stroke-linecap="round" stroke-linejoin="round" fill="none" pathLength="1" stroke-dasharray="1" stroke-dashoffset="1">
  <animate attributeName="stroke-dashoffset" values="1;0;0;-1" keyTimes="0;0.5;0.7;1" dur="2.4s" repeatCount="indefinite"/>
</path>
</svg>`,
  },

  brain: {
    name: "Brain and ideas",
    tags: "brain mind neurology thinking memory psychology mental health intelligence learning neuroscience",
    svg: `<svg ${S}>
${shadow(200, 352, 120)}
<g transform-origin="200 200">
  <animateTransform attributeName="transform" type="scale" values="1;1.03;1" dur="3s" repeatCount="indefinite" ${ease}/>
  <g fill="#F7A8C4">
    <circle cx="140" cy="150" r="58"/><circle cx="200" cy="120" r="56"/><circle cx="262" cy="148" r="58"/>
    <circle cx="118" cy="214" r="56"/><circle cx="286" cy="212" r="56"/><circle cx="170" cy="244" r="50"/><circle cx="236" cy="246" r="50"/>
    <rect x="186" y="270" width="36" height="60" rx="18" fill="#EE8FB0"/>
  </g>
  <g stroke="#E0789E" stroke-width="7" stroke-linecap="round" fill="none">
    <path d="M200 76 V300"/>
    <path d="M120 150 C140 140 150 160 170 150"/><path d="M96 214 C120 200 134 226 158 214"/><path d="M150 256 C166 244 180 262 192 250"/>
    <path d="M232 150 C252 140 262 160 282 150"/><path d="M244 214 C268 200 282 226 306 214"/><path d="M210 256 C224 244 238 262 252 250"/>
    <path d="M160 108 C176 100 184 116 196 110"/><path d="M206 108 C220 98 232 114 246 106"/>
  </g>
</g>
<g fill="#FFD166">
  <circle cx="150" cy="170" r="9"><animate attributeName="opacity" values="0;1;0" dur="1.5s" repeatCount="indefinite"/></circle>
  <circle cx="258" cy="120" r="9"><animate attributeName="opacity" values="0;1;0" dur="1.5s" begin="0.5s" repeatCount="indefinite"/></circle>
  <circle cx="268" cy="232" r="9"><animate attributeName="opacity" values="0;1;0" dur="1.5s" begin="1s" repeatCount="indefinite"/></circle>
</g>
${sparkle(334, 76, 0.9, 0.3)}
${sparkle(66, 92, 0.6, 0.9, "#7BDFF2")}
</svg>`,
  },

  lungs: {
    name: "Breathing lungs",
    tags: "lungs breathing respiratory asthma pulmonary oxygen air chest health smoking",
    svg: `<svg ${S}>
${shadow(200, 360, 120)}
<path d="M200 60 V160 M200 150 L170 180 M200 150 L230 180" stroke="#E0789E" stroke-width="16" stroke-linecap="round" fill="none"/>
<g transform-origin="200 200">
  <animateTransform attributeName="transform" type="scale" values="1 1;1.07 1.05;1 1" dur="3.4s" repeatCount="indefinite" ${ease}/>
  <path d="M176 170 C150 150 112 150 90 190 C66 234 66 300 92 326 C114 346 160 336 176 312 Z" fill="#FF8FA3"/>
  <path d="M224 170 C250 150 288 150 310 190 C334 234 334 300 308 326 C286 346 240 336 224 312 Z" fill="#FF8FA3"/>
  <g stroke="#E86A84" stroke-width="6" stroke-linecap="round" fill="none">
    <path d="M170 184 C150 210 140 240 120 262 M150 222 C136 226 124 236 112 244 M156 258 C150 280 140 296 124 306"/>
    <path d="M230 184 C250 210 260 240 280 262 M250 222 C264 226 276 236 288 244 M244 258 C250 280 260 296 276 306"/>
  </g>
</g>
<g fill="#7BDFF2" opacity="0.9">
  <circle cx="120" cy="120" r="7"><animate attributeName="cy" values="130;60" dur="3.4s" repeatCount="indefinite"/><animate attributeName="opacity" values="0;1;0" dur="3.4s" repeatCount="indefinite"/></circle>
  <circle cx="290" cy="116" r="6"><animate attributeName="cy" values="126;56" dur="3.4s" begin="1.2s" repeatCount="indefinite"/><animate attributeName="opacity" values="0;1;0" dur="3.4s" begin="1.2s" repeatCount="indefinite"/></circle>
</g>
</svg>`,
  },

  stethoscope: {
    name: "Stethoscope",
    tags: "stethoscope doctor medical checkup clinic physician examination healthcare nurse",
    svg: `<svg ${S}>
${shadow(210, 356, 120)}
<path d="M120 70 V150 C120 214 160 244 200 244 C240 244 280 214 280 150 V70" stroke="#2B2D42" stroke-width="14" stroke-linecap="round" fill="none"/>
<circle cx="120" cy="66" r="14" fill="#8D99AE"/><circle cx="280" cy="66" r="14" fill="#8D99AE"/>
<g>
  <animateTransform attributeName="transform" type="rotate" values="-6 200 244;6 200 244;-6 200 244" dur="2.6s" repeatCount="indefinite" ${ease}/>
  <path d="M200 244 V270 C200 312 240 320 262 300" stroke="#2B2D42" stroke-width="14" stroke-linecap="round" fill="none"/>
  <circle cx="286" cy="286" r="42" fill="#8D99AE"/><circle cx="286" cy="286" r="30" fill="#EDF2FB"/><circle cx="286" cy="286" r="14" fill="#4F7CFF"/>
</g>
<path d="M300 120 C318 100 346 104 346 128 C346 152 316 168 300 180 C284 168 254 152 254 128 C254 104 282 100 300 120 Z" fill="#FF5A6E" transform-origin="300 140">
  <animateTransform attributeName="transform" type="scale" values="0.9;1.05;0.9" dur="1s" repeatCount="indefinite" ${ease}/>
</path>
</svg>`,
  },

  pills: {
    name: "Pills and capsules",
    tags: "pills medicine capsule tablet pharmacy drug prescription treatment vitamins pharmacist",
    svg: `<svg ${S}>
${shadow(200, 356, 130)}
<g>
  <animateTransform attributeName="transform" type="translate" values="0 0;0 -12;0 0" dur="2.6s" repeatCount="indefinite" ${ease}/>
  <g transform="rotate(-35 200 180)">
    <rect x="96" y="140" width="208" height="84" rx="42" fill="#FFFFFF" stroke="#D9E1EC" stroke-width="4"/>
    <path d="M200 140 H138 A42 42 0 0 0 138 224 H200 Z" fill="#FF6B6B"/>
    <rect x="124" y="156" width="54" height="12" rx="6" fill="#FFB3B3"/>
  </g>
</g>
<g>
  <animateTransform attributeName="transform" type="rotate" values="0 110 300;20 110 300;0 110 300" dur="3s" repeatCount="indefinite" ${ease}/>
  <circle cx="110" cy="300" r="40" fill="#4F7CFF"/><rect x="74" y="295" width="72" height="10" rx="5" fill="#3A62D6"/>
</g>
<g>
  <animateTransform attributeName="transform" type="translate" values="0 0;0 -8;0 0" dur="2s" begin="0.6s" repeatCount="indefinite" ${ease}/>
  <circle cx="300" cy="300" r="34" fill="#2EC4B6"/><circle cx="300" cy="300" r="20" fill="#5FD9CD"/>
</g>
${sparkle(326, 94, 0.7, 0.2)}
</svg>`,
  },

  dna: {
    name: "DNA helix",
    tags: "dna genetics biology science gene helix chromosome research laboratory biotech heredity",
    svg: `<svg ${S}>
${shadow(200, 360, 90)}
<g stroke-linecap="round" fill="none">
  <path stroke="#4F7CFF" stroke-width="14" d="M150 40 C250 90 250 130 150 180 C50 230 250 250 250 250 C250 250 50 290 150 340">
    <animate attributeName="d" dur="3s" repeatCount="indefinite" values="M150 40 C250 90 250 130 150 180 C50 230 250 250 250 250 C250 250 50 290 150 340;M250 40 C150 90 150 130 250 180 C350 230 150 250 150 250 C150 250 350 290 250 340;M150 40 C250 90 250 130 150 180 C50 230 250 250 250 250 C250 250 50 290 150 340" ${ease}/>
  </path>
  <path stroke="#FF6B6B" stroke-width="14" d="M250 40 C150 90 150 130 250 180 C350 230 150 250 150 250 C150 250 350 290 250 340">
    <animate attributeName="d" dur="3s" repeatCount="indefinite" values="M250 40 C150 90 150 130 250 180 C350 230 150 250 150 250 C150 250 350 290 250 340;M150 40 C250 90 250 130 150 180 C50 230 250 250 250 250 C250 250 50 290 150 340;M250 40 C150 90 150 130 250 180 C350 230 150 250 150 250 C150 250 350 290 250 340" ${ease}/>
  </path>
</g>
<g stroke="#FFD166" stroke-width="8" stroke-linecap="round">
  <line x1="170" y1="80" x2="230" y2="80"><animate attributeName="x1" values="170;230;170" dur="3s" repeatCount="indefinite" ${ease}/><animate attributeName="x2" values="230;170;230" dur="3s" repeatCount="indefinite" ${ease}/></line>
  <line x1="185" y1="130" x2="215" y2="130"><animate attributeName="x1" values="185;215;185" dur="3s" repeatCount="indefinite" ${ease}/><animate attributeName="x2" values="215;185;215" dur="3s" repeatCount="indefinite" ${ease}/></line>
  <line x1="120" y1="215" x2="280" y2="215"><animate attributeName="x1" values="120;280;120" dur="3s" repeatCount="indefinite" ${ease}/><animate attributeName="x2" values="280;120;280" dur="3s" repeatCount="indefinite" ${ease}/></line>
  <line x1="130" y1="290" x2="270" y2="290"><animate attributeName="x1" values="130;270;130" dur="3s" repeatCount="indefinite" ${ease}/><animate attributeName="x2" values="270;130;270" dur="3s" repeatCount="indefinite" ${ease}/></line>
</g>
</svg>`,
  },

  virus: {
    name: "Germ virus",
    tags: "virus germ bacteria infection flu covid disease microbe immunity pathogen hygiene",
    svg: `<svg ${S}>
${shadow(200, 356, 100)}
<g>
  <animateTransform attributeName="transform" type="rotate" values="0 200 196;360 200 196" dur="14s" repeatCount="indefinite"/>
  <g stroke="#5BB85D" stroke-width="12" stroke-linecap="round">
    <line x1="200" y1="196" x2="200" y2="62"/><line x1="200" y1="196" x2="200" y2="330"/><line x1="200" y1="196" x2="66" y2="196"/><line x1="200" y1="196" x2="334" y2="196"/>
    <line x1="200" y1="196" x2="105" y2="101"/><line x1="200" y1="196" x2="295" y2="291"/><line x1="200" y1="196" x2="295" y2="101"/><line x1="200" y1="196" x2="105" y2="291"/>
  </g>
  <g fill="#7ED957">
    <circle cx="200" cy="60" r="16"/><circle cx="200" cy="332" r="16"/><circle cx="64" cy="196" r="16"/><circle cx="336" cy="196" r="16"/>
    <circle cx="103" cy="99" r="16"/><circle cx="297" cy="293" r="16"/><circle cx="297" cy="99" r="16"/><circle cx="103" cy="293" r="16"/>
  </g>
</g>
<g transform-origin="200 196">
  <animateTransform attributeName="transform" type="scale" values="1 1;1.05 0.95;0.95 1.05;1 1" dur="2s" repeatCount="indefinite" ${ease3}/>
  <circle cx="200" cy="196" r="96" fill="#7ED957"/>
  <circle cx="160" cy="160" r="16" fill="#5BB85D"/><circle cx="248" cy="238" r="20" fill="#5BB85D"/><circle cx="238" cy="148" r="10" fill="#5BB85D"/>
  <ellipse cx="172" cy="200" rx="10" ry="13" fill="#2B2D42"/><ellipse cx="228" cy="200" rx="10" ry="13" fill="#2B2D42"/>
  <path d="M152 176 L186 188 M248 176 L214 188" stroke="#2B2D42" stroke-width="7" stroke-linecap="round"/>
  <path d="M180 242 Q200 228 220 242" stroke="#2B2D42" stroke-width="7" stroke-linecap="round" fill="none"/>
</g>
</svg>`,
  },

  thermometer: {
    name: "Thermometer",
    tags: "thermometer fever temperature sick flu illness weather heat hot cold measure",
    svg: `<svg ${S}>
${shadow(200, 360, 70)}
<rect x="164" y="50" width="72" height="250" rx="36" fill="#FFFFFF" stroke="#D9E1EC" stroke-width="6"/>
<circle cx="200" cy="300" r="52" fill="#FFFFFF" stroke="#D9E1EC" stroke-width="6"/>
<rect x="176" y="62" width="48" height="236" rx="24" fill="#FFFFFF"/>
<rect x="186" y="200" width="28" height="100" rx="14" fill="#FF5A6E">
  <animate attributeName="y" values="230;96;230" dur="4s" repeatCount="indefinite" ${ease}/>
  <animate attributeName="height" values="70;204;70" dur="4s" repeatCount="indefinite" ${ease}/>
</rect>
<circle cx="200" cy="300" r="38" fill="#FF5A6E"/>
<circle cx="186" cy="288" r="9" fill="#FFB3BC"/>
<g stroke="#8D99AE" stroke-width="5" stroke-linecap="round">
  <line x1="250" y1="90" x2="276" y2="90"/><line x1="250" y1="130" x2="268" y2="130"/><line x1="250" y1="170" x2="276" y2="170"/><line x1="250" y1="210" x2="268" y2="210"/>
</g>
<g fill="#FF9F43">
  <path d="M110 120 C104 104 120 96 116 80 C132 92 138 110 128 124 C124 130 114 130 110 120Z"><animate attributeName="opacity" values="0.3;1;0.3" dur="1.2s" repeatCount="indefinite"/></path>
</g>
</svg>`,
  },

  syringe: {
    name: "Vaccine syringe",
    tags: "syringe vaccine injection vaccination immunization shot needle medicine clinic",
    svg: `<svg ${S}>
${shadow(200, 360, 120)}
<g transform="rotate(-40 200 200)">
  <rect x="140" y="170" width="170" height="60" rx="10" fill="#FFFFFF" stroke="#D9E1EC" stroke-width="5"/>
  <rect x="146" y="176" width="100" height="48" rx="6" fill="#7BDFF2">
    <animate attributeName="width" values="140;60;140" dur="3s" repeatCount="indefinite" ${ease}/>
  </rect>
  <g stroke="#8D99AE" stroke-width="4"><line x1="180" y1="170" x2="180" y2="190"/><line x1="215" y1="170" x2="215" y2="190"/><line x1="250" y1="170" x2="250" y2="190"/><line x1="285" y1="170" x2="285" y2="190"/></g>
  <g>
    <animateTransform attributeName="transform" type="translate" values="0 0;-80 0;0 0" dur="3s" repeatCount="indefinite" ${ease}/>
    <rect x="306" y="190" width="70" height="20" rx="6" fill="#8D99AE"/><rect x="370" y="160" width="16" height="80" rx="6" fill="#4F7CFF"/>
  </g>
  <rect x="306" y="160" width="12" height="80" rx="4" fill="#4F7CFF"/>
  <rect x="100" y="190" width="42" height="20" rx="4" fill="#8D99AE"/>
  <line x1="40" y1="200" x2="102" y2="200" stroke="#B8C0CC" stroke-width="6" stroke-linecap="round"/>
</g>
<path d="M76 258 C70 272 70 280 76 286 C82 280 82 272 76 258Z" fill="#7BDFF2">
  <animate attributeName="opacity" values="0;1;0" dur="3s" repeatCount="indefinite"/>
  <animateTransform attributeName="transform" type="translate" values="0 0;0 50" dur="3s" repeatCount="indefinite"/>
</path>
</svg>`,
  },

  hospital: {
    name: "Hospital",
    tags: "hospital clinic building healthcare emergency medical center doctor care",
    svg: `<svg ${S}>
${shadow(200, 352, 160)}
<rect x="70" y="120" width="260" height="226" rx="10" fill="#EDF2FB"/>
<rect x="140" y="70" width="120" height="60" rx="8" fill="#FFFFFF"/>
<rect x="70" y="120" width="260" height="20" fill="#D9E1EC"/>
<g fill="#FF5A6E" transform-origin="200 100">
  <animateTransform attributeName="transform" type="scale" values="1;1.12;1" dur="1.4s" repeatCount="indefinite" ${ease}/>
  <rect x="190" y="78" width="20" height="44" rx="4"/><rect x="178" y="90" width="44" height="20" rx="4"/>
</g>
<g fill="#7BB8FF">
  <rect x="96" y="164" width="44" height="40" rx="6"/><rect x="178" y="164" width="44" height="40" rx="6"/><rect x="260" y="164" width="44" height="40" rx="6"/>
  <rect x="96" y="226" width="44" height="40" rx="6"/><rect x="260" y="226" width="44" height="40" rx="6"/>
</g>
<rect x="260" y="226" width="44" height="40" rx="6" fill="#FFE08A"><animate attributeName="opacity" values="0;0;1;1;0" keyTimes="0;0.4;0.45;0.8;1" dur="4s" repeatCount="indefinite"/></rect>
<rect x="168" y="250" width="64" height="96" rx="6" fill="#4F7CFF"/><rect x="198" y="250" width="4" height="96" fill="#3A62D6"/>
</svg>`,
  },

  firstaid: {
    name: "First aid kit",
    tags: "first aid kit emergency safety injury medical bandage help rescue",
    svg: `<svg ${S}>
<ellipse cx="200" cy="344" rx="130" ry="13" fill="#2B2D42" opacity="0.08"><animate attributeName="rx" values="130;110;130" dur="1.6s" repeatCount="indefinite" ${ease}/></ellipse>
<g>
  <animateTransform attributeName="transform" type="translate" values="0 0;0 -20;0 0" dur="1.6s" repeatCount="indefinite" ${ease}/>
  <rect x="150" y="96" width="100" height="44" rx="14" fill="none" stroke="#B83246" stroke-width="16"/>
  <rect x="70" y="126" width="260" height="190" rx="24" fill="#FF5A6E"/>
  <rect x="70" y="126" width="260" height="36" rx="18" fill="#FF7A8A"/>
  <rect x="180" y="176" width="40" height="110" rx="8" fill="#FFFFFF"/><rect x="145" y="211" width="110" height="40" rx="8" fill="#FFFFFF"/>
</g>
</svg>`,
  },

  eye: {
    name: "Eye",
    tags: "eye vision sight optometry eye care ophthalmology see watch observe",
    svg: `<svg ${S}>
${shadow(200, 330, 130)}
<path d="M40 200 C100 110 300 110 360 200 C300 290 100 290 40 200 Z" fill="#FFFFFF" stroke="#2B2D42" stroke-width="10">
  <animate attributeName="d" values="M40 200 C100 110 300 110 360 200 C300 290 100 290 40 200 Z;M40 200 C100 110 300 110 360 200 C300 290 100 290 40 200 Z;M40 200 C100 196 300 196 360 200 C300 204 100 204 40 200 Z;M40 200 C100 110 300 110 360 200 C300 290 100 290 40 200 Z" keyTimes="0;0.86;0.92;1" dur="3.5s" repeatCount="indefinite"/>
</path>
<g>
  <animateTransform attributeName="transform" type="translate" values="0 0;-40 0;-40 0;36 0;36 0;0 0" keyTimes="0;0.15;0.35;0.5;0.7;0.85" dur="3.5s" repeatCount="indefinite"/>
  <circle cx="200" cy="200" r="58" fill="#2EC4B6"><animate attributeName="r" values="58;58;4;58" keyTimes="0;0.86;0.92;1" dur="3.5s" repeatCount="indefinite"/></circle>
  <circle cx="200" cy="200" r="28" fill="#2B2D42"><animate attributeName="r" values="28;28;2;28" keyTimes="0;0.86;0.92;1" dur="3.5s" repeatCount="indefinite"/></circle>
  <circle cx="218" cy="182" r="10" fill="#FFFFFF"><animate attributeName="r" values="10;10;0;10" keyTimes="0;0.86;0.92;1" dur="3.5s" repeatCount="indefinite"/></circle>
</g>
</svg>`,
  },

  bone: {
    name: "Bone",
    tags: "bone orthopedics skeleton fracture calcium joints x-ray physiotherapy",
    svg: `<svg ${S}>
${shadow(200, 340, 130)}
<g>
  <animateTransform attributeName="transform" type="rotate" values="-12 200 200;12 200 200;-12 200 200" dur="3s" repeatCount="indefinite" ${ease}/>
  <g fill="#E8D5B5" stroke="#E8D5B5" stroke-width="12">
    <circle cx="96" cy="154" r="38"/><circle cx="96" cy="238" r="38"/><circle cx="304" cy="154" r="38"/><circle cx="304" cy="238" r="38"/>
    <rect x="96" y="166" width="208" height="60" rx="14"/>
  </g>
  <g fill="#FFF6E5">
    <circle cx="96" cy="154" r="38"/><circle cx="96" cy="238" r="38"/><circle cx="304" cy="154" r="38"/><circle cx="304" cy="238" r="38"/>
    <rect x="96" y="166" width="208" height="60" rx="14"/>
  </g>
  <path d="M130 184 H270" stroke="#FFFFFF" stroke-width="10" stroke-linecap="round"/>
</g>
${sparkle(330, 90, 0.7, 0.4)}
</svg>`,
  },
};
