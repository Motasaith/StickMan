// Technology, software and security illustrations.
const { S, ease, easeN, shadow, sparkle, float } = require("./_shared.cjs");

const typingLine = (x, y, w, color, begin) =>
  `<rect x="${x}" y="${y}" width="0" height="12" rx="6" fill="${color}"><animate attributeName="width" values="0;0;${w};${w};0" keyTimes="0;${begin};${Math.min(0.9, begin + 0.15)};0.92;1" dur="4s" repeatCount="indefinite"/></rect>`;

module.exports = {
  laptop: {
    name: "Laptop with code",
    tags: "laptop computer coding software developer programming work online remote technology it web app",
    svg: `<svg ${S}>
${shadow(200, 346, 170)}
<rect x="80" y="70" width="240" height="170" rx="14" fill="#2B2D42"/>
<rect x="94" y="84" width="212" height="142" rx="6" fill="#1E2033"/>
${typingLine(110, 104, 80, "#FF6B6B", 0)}
${typingLine(126, 126, 120, "#7BDFF2", 0.15)}
${typingLine(126, 148, 70, "#FFD166", 0.3)}
${typingLine(142, 170, 110, "#8FD98F", 0.45)}
${typingLine(110, 192, 50, "#FF6B6B", 0.6)}
<rect x="110" y="190" width="8" height="18" fill="#FFFFFF"><animate attributeName="opacity" values="1;0;1" dur="0.8s" repeatCount="indefinite" calcMode="discrete"/></rect>
<path d="M50 250 H350 L372 300 C374 310 368 318 356 318 H44 C32 318 26 310 28 300 Z" fill="#D9E1EC"/>
<rect x="170" y="258" width="60" height="10" rx="5" fill="#B8C0CC"/>
</svg>`,
  },

  smartphone: {
    name: "Smartphone app",
    tags: "smartphone phone mobile app notification social media android iphone message device screen",
    svg: `<svg ${S}>
${shadow(200, 360, 100)}
<g>
  ${float(8, 2.8)}
  <rect x="120" y="40" width="160" height="300" rx="28" fill="#2B2D42"/>
  <rect x="132" y="66" width="136" height="250" rx="10" fill="#EDF2FB"/>
  <rect x="180" y="50" width="40" height="8" rx="4" fill="#4B5563"/>
  <g>
    <rect x="148" y="86" width="44" height="44" rx="12" fill="#FF6B6B"/><rect x="208" y="86" width="44" height="44" rx="12" fill="#4F7CFF"/>
    <rect x="148" y="146" width="44" height="44" rx="12" fill="#FFC857"/><rect x="208" y="146" width="44" height="44" rx="12" fill="#2EC4B6"/>
    <rect x="148" y="206" width="44" height="44" rx="12" fill="#7B61FF"/><rect x="208" y="206" width="44" height="44" rx="12" fill="#5BB85D"/>
  </g>
  <circle cx="200" cy="292" r="12" fill="#D9E1EC"/>
</g>
<g transform-origin="276 70">
  <animateTransform attributeName="transform" type="scale" values="0;0;1.15;1;1;0" keyTimes="0;0.2;0.3;0.36;0.85;1" dur="3s" repeatCount="indefinite"/>
  <circle cx="276" cy="70" r="28" fill="#FF5A6E"/>
  <text x="276" y="82" font-family="sans-serif" font-size="32" font-weight="bold" fill="#FFFFFF" text-anchor="middle">3</text>
</g>
</svg>`,
  },

  cloud: {
    name: "Cloud upload",
    tags: "cloud upload storage backup sync saas online data hosting server download computing",
    svg: `<svg ${S}>
${shadow(200, 344, 130)}
<g>
  ${float(10, 3)}
  <path d="M110 290 C60 290 40 250 50 216 C58 186 88 170 116 176 C124 124 168 96 214 104 C256 110 282 144 286 180 C330 176 360 206 358 240 C356 270 334 290 300 290 Z" fill="#7BB8FF"/>
  <path d="M110 290 C60 290 40 250 50 216 C58 186 88 170 116 176 C122 150 136 132 154 120 C120 150 110 200 150 240 C190 280 260 270 300 290 Z" fill="#6AA6F0"/>
</g>
<g>
  <animateTransform attributeName="transform" type="translate" values="0 30;0 -30" dur="1.5s" repeatCount="indefinite"/>
  <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.2;0.7;1" dur="1.5s" repeatCount="indefinite"/>
  <path d="M200 280 V190 M164 222 L200 186 L236 222" stroke="#FFFFFF" stroke-width="18" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
</g>
</svg>`,
  },

  lock: {
    name: "Security lock",
    tags: "lock security password privacy protection secure encryption login cybersecurity safe access",
    svg: `<svg ${S}>
${shadow(200, 360, 110)}
<path d="M140 180 V130 C140 90 166 64 200 64 C234 64 260 90 260 130 V180" stroke="#8D99AE" stroke-width="26" stroke-linecap="round" fill="none">
  <animateTransform attributeName="transform" type="translate" values="0 0;0 0;0 -26;0 -26;0 0" keyTimes="0;0.4;0.5;0.8;0.9" dur="4s" repeatCount="indefinite"/>
</path>
<rect x="100" y="170" width="200" height="170" rx="26" fill="#FFC857"/>
<rect x="100" y="170" width="200" height="40" rx="20" fill="#FFD875"/>
<circle cx="200" cy="248" r="24" fill="#8D5A3B"/><rect x="190" y="252" width="20" height="46" rx="8" fill="#8D5A3B"/>
</svg>`,
  },

  shield: {
    name: "Shield with check",
    tags: "shield protection security safe insurance antivirus guarantee trust verified defense privacy",
    svg: `<svg ${S}>
${shadow(200, 360, 110)}
<path d="M200 50 L320 96 V190 C320 270 264 322 200 346 C136 322 80 270 80 190 V96 Z" fill="#4F7CFF"/>
<path d="M200 50 L320 96 V190 C320 270 264 322 200 346 Z" fill="#3A62D6"/>
<path d="M146 198 L186 238 L260 162" stroke="#FFFFFF" stroke-width="24" stroke-linecap="round" stroke-linejoin="round" fill="none" pathLength="1" stroke-dasharray="1" stroke-dashoffset="1">
  <animate attributeName="stroke-dashoffset" values="1;0;0;1" keyTimes="0;0.3;0.85;1" dur="3s" repeatCount="indefinite"/>
</path>
${sparkle(320, 60, 0.8, 0.3)}
${sparkle(70, 300, 0.6, 1)}
</svg>`,
  },

  wifi: {
    name: "Wi-Fi signal",
    tags: "wifi wireless internet signal connection network online hotspot connectivity broadband",
    svg: `<svg ${S}>
<circle cx="200" cy="300" r="26" fill="#4F7CFF"/>
<path d="M150 250 C178 222 222 222 250 250" stroke="#4F7CFF" stroke-width="24" stroke-linecap="round" fill="none"><animate attributeName="opacity" values="0.15;1;1;0.15" keyTimes="0;0.2;0.8;1" dur="2s" repeatCount="indefinite"/></path>
<path d="M104 204 C158 150 242 150 296 204" stroke="#4F7CFF" stroke-width="24" stroke-linecap="round" fill="none"><animate attributeName="opacity" values="0.15;0.15;1;1;0.15" keyTimes="0;0.2;0.4;0.8;1" dur="2s" repeatCount="indefinite"/></path>
<path d="M58 158 C138 78 262 78 342 158" stroke="#4F7CFF" stroke-width="24" stroke-linecap="round" fill="none"><animate attributeName="opacity" values="0.15;0.15;1;1;0.15" keyTimes="0;0.4;0.6;0.8;1" dur="2s" repeatCount="indefinite"/></path>
</svg>`,
  },

  robot: {
    name: "AI robot",
    tags: "robot ai artificial intelligence automation chatbot machine learning assistant bot future technology",
    svg: `<svg ${S}>
${shadow(200, 360, 110)}
<g>
  ${float(10, 2.4)}
  <line x1="200" y1="90" x2="200" y2="54" stroke="#8D99AE" stroke-width="8"/>
  <circle cx="200" cy="48" r="14" fill="#FF6B6B"><animate attributeName="fill" values="#FF6B6B;#FFD166;#FF6B6B" dur="1s" repeatCount="indefinite"/></circle>
  <rect x="110" y="88" width="180" height="140" rx="36" fill="#EDF2FB" stroke="#D9E1EC" stroke-width="6"/>
  <rect x="134" y="116" width="132" height="76" rx="26" fill="#2B2D42"/>
  <ellipse cx="172" cy="154" rx="14" ry="14" fill="#7BDFF2"><animate attributeName="ry" values="14;14;2;14" keyTimes="0;0.85;0.9;1" dur="3s" repeatCount="indefinite"/></ellipse>
  <ellipse cx="228" cy="154" rx="14" ry="14" fill="#7BDFF2"><animate attributeName="ry" values="14;14;2;14" keyTimes="0;0.85;0.9;1" dur="3s" repeatCount="indefinite"/></ellipse>
  <rect x="96" y="140" width="16" height="40" rx="8" fill="#8D99AE"/><rect x="288" y="140" width="16" height="40" rx="8" fill="#8D99AE"/>
  <rect x="140" y="236" width="120" height="90" rx="24" fill="#4F7CFF"/>
  <circle cx="200" cy="280" r="18" fill="#7BDFF2"><animate attributeName="opacity" values="0.5;1;0.5" dur="1.5s" repeatCount="indefinite"/></circle>
  <g>
    <animateTransform attributeName="transform" type="rotate" values="0 136 250;-30 136 250;0 136 250" dur="1.2s" repeatCount="indefinite" ${ease}/>
    <rect x="92" y="246" width="50" height="22" rx="11" fill="#8D99AE"/><circle cx="92" cy="257" r="16" fill="#4F7CFF"/>
  </g>
  <rect x="258" y="246" width="50" height="22" rx="11" fill="#8D99AE"/><circle cx="308" cy="257" r="16" fill="#4F7CFF"/>
</g>
</svg>`,
  },

  chip: {
    name: "Computer chip",
    tags: "chip processor cpu semiconductor circuit hardware electronics microchip computing ai technology",
    svg: `<svg ${S}>
<g stroke="#8D99AE" stroke-width="10" stroke-linecap="round">
  <line x1="150" y1="60" x2="150" y2="110"/><line x1="200" y1="60" x2="200" y2="110"/><line x1="250" y1="60" x2="250" y2="110"/>
  <line x1="150" y1="290" x2="150" y2="340"/><line x1="200" y1="290" x2="200" y2="340"/><line x1="250" y1="290" x2="250" y2="340"/>
  <line x1="60" y1="150" x2="110" y2="150"/><line x1="60" y1="200" x2="110" y2="200"/><line x1="60" y1="250" x2="110" y2="250"/>
  <line x1="290" y1="150" x2="340" y2="150"/><line x1="290" y1="200" x2="340" y2="200"/><line x1="290" y1="250" x2="340" y2="250"/>
</g>
<g fill="#7BDFF2">
  <circle cx="150" cy="60" r="10"><animate attributeName="opacity" values="0;1;0" dur="1.6s" repeatCount="indefinite"/></circle>
  <circle cx="340" cy="200" r="10"><animate attributeName="opacity" values="0;1;0" dur="1.6s" begin="0.4s" repeatCount="indefinite"/></circle>
  <circle cx="250" cy="340" r="10"><animate attributeName="opacity" values="0;1;0" dur="1.6s" begin="0.8s" repeatCount="indefinite"/></circle>
  <circle cx="60" cy="250" r="10"><animate attributeName="opacity" values="0;1;0" dur="1.6s" begin="1.2s" repeatCount="indefinite"/></circle>
</g>
<rect x="100" y="100" width="200" height="200" rx="26" fill="#2B2D42"/>
<rect x="140" y="140" width="120" height="120" rx="14" fill="#4F7CFF"/>
<text x="200" y="218" font-family="sans-serif" font-size="56" font-weight="bold" fill="#FFFFFF" text-anchor="middle">AI</text>
</svg>`,
  },

  code: {
    name: "Code brackets",
    tags: "code programming developer software html web development coding syntax script engineer",
    svg: `<svg ${S}>
<g stroke-width="28" stroke-linecap="round" stroke-linejoin="round" fill="none">
  <path d="M130 110 L60 200 L130 290" stroke="#4F7CFF"><animateTransform attributeName="transform" type="translate" values="0 0;-16 0;0 0" dur="2s" repeatCount="indefinite" ${ease}/></path>
  <path d="M270 110 L340 200 L270 290" stroke="#4F7CFF"><animateTransform attributeName="transform" type="translate" values="0 0;16 0;0 0" dur="2s" repeatCount="indefinite" ${ease}/></path>
  <path d="M226 90 L174 310" stroke="#FF6B6B"/>
</g>
</svg>`,
  },

  database: {
    name: "Database",
    tags: "database data storage server records sql big data backend information analytics warehouse",
    svg: `<svg ${S}>
${shadow(200, 356, 120)}
<g>
  <path d="M90 260 V300 C90 330 310 330 310 300 V260" fill="#3A62D6"/><ellipse cx="200" cy="260" rx="110" ry="30" fill="#4F7CFF"/>
  <path d="M90 180 V220 C90 250 310 250 310 220 V180" fill="#3A62D6"/><ellipse cx="200" cy="180" rx="110" ry="30" fill="#4F7CFF"/>
  <path d="M90 100 V140 C90 170 310 170 310 140 V100" fill="#3A62D6"/><ellipse cx="200" cy="100" rx="110" ry="30" fill="#7BB8FF"/>
</g>
<g fill="#7BDFF2">
  <circle cx="270" cy="154" r="8"><animate attributeName="opacity" values="0.2;1;0.2" dur="1.2s" repeatCount="indefinite"/></circle>
  <circle cx="270" cy="234" r="8"><animate attributeName="opacity" values="0.2;1;0.2" dur="1.2s" begin="0.4s" repeatCount="indefinite"/></circle>
  <circle cx="270" cy="314" r="8"><animate attributeName="opacity" values="0.2;1;0.2" dur="1.2s" begin="0.8s" repeatCount="indefinite"/></circle>
</g>
</svg>`,
  },

  magnifier: {
    name: "Search magnifier",
    tags: "search magnifier find research investigate seo discover analysis explore zoom inspect",
    svg: `<svg ${S}>
${shadow(200, 360, 120)}
<g>
  <animateMotion dur="4s" repeatCount="indefinite" path="M0 0 C40 -30 60 20 20 40 C-20 60 -50 10 0 0" calcMode="linear"/>
  <line x1="236" y1="236" x2="320" y2="320" stroke="#2B2D42" stroke-width="32" stroke-linecap="round"/>
  <circle cx="170" cy="170" r="96" fill="#BFE9F5" opacity="0.6"/>
  <circle cx="170" cy="170" r="96" fill="none" stroke="#4F7CFF" stroke-width="22"/>
  <path d="M120 140 C130 116 150 104 172 102" stroke="#FFFFFF" stroke-width="14" stroke-linecap="round" fill="none"/>
</g>
</svg>`,
  },

  battery: {
    name: "Charging battery",
    tags: "battery charging energy power electric ev charge level electricity sustainability",
    svg: `<svg ${S}>
${shadow(200, 330, 140)}
<rect x="60" y="130" width="260" height="150" rx="24" fill="none" stroke="#2B2D42" stroke-width="16"/>
<rect x="326" y="172" width="24" height="66" rx="8" fill="#2B2D42"/>
<rect x="82" y="152" width="40" height="106" rx="10" fill="#5BB85D"/>
<rect x="132" y="152" width="40" height="106" rx="10" fill="#5BB85D"><animate attributeName="opacity" values="0;0;1;1" keyTimes="0;0.25;0.26;1" dur="2.4s" repeatCount="indefinite"/></rect>
<rect x="182" y="152" width="40" height="106" rx="10" fill="#5BB85D"><animate attributeName="opacity" values="0;0;1;1" keyTimes="0;0.5;0.51;1" dur="2.4s" repeatCount="indefinite"/></rect>
<rect x="232" y="152" width="40" height="106" rx="10" fill="#5BB85D"><animate attributeName="opacity" values="0;0;1;1" keyTimes="0;0.75;0.76;1" dur="2.4s" repeatCount="indefinite"/></rect>
<path d="M212 90 L166 206 H206 L186 320 L250 188 H208 L236 90 Z" fill="#FFC857" stroke="#FFFFFF" stroke-width="8" stroke-linejoin="round"/>
</svg>`,
  },

  bug: {
    name: "Software bug",
    tags: "bug software error debug testing issue fix glitch qa problem malware",
    svg: `<svg ${S}>
${shadow(200, 352, 100)}
<g>
  <animateTransform attributeName="transform" type="translate" values="-20 0;20 0;-20 0" dur="3s" repeatCount="indefinite" ${ease}/>
  <g stroke="#2B2D42" stroke-width="10" stroke-linecap="round" fill="none">
    <path d="M140 180 L90 160"><animate attributeName="d" values="M140 180 L90 160;M140 180 L90 180;M140 180 L90 160" dur="0.4s" repeatCount="indefinite"/></path>
    <path d="M140 230 L86 236"><animate attributeName="d" values="M140 230 L86 236;M140 230 L90 220;M140 230 L86 236" dur="0.4s" repeatCount="indefinite"/></path>
    <path d="M144 276 L96 310"><animate attributeName="d" values="M144 276 L96 310;M144 276 L90 296;M144 276 L96 310" dur="0.4s" repeatCount="indefinite"/></path>
    <path d="M260 180 L310 160"><animate attributeName="d" values="M260 180 L310 160;M260 180 L310 180;M260 180 L310 160" dur="0.4s" repeatCount="indefinite"/></path>
    <path d="M260 230 L314 236"><animate attributeName="d" values="M260 230 L314 236;M260 230 L310 220;M260 230 L314 236" dur="0.4s" repeatCount="indefinite"/></path>
    <path d="M256 276 L304 310"><animate attributeName="d" values="M256 276 L304 310;M256 276 L310 296;M256 276 L304 310" dur="0.4s" repeatCount="indefinite"/></path>
    <path d="M178 110 L160 70 M222 110 L240 70"/>
  </g>
  <ellipse cx="200" cy="230" rx="76" ry="96" fill="#FF5A6E"/>
  <circle cx="200" cy="130" r="44" fill="#2B2D42"/>
  <line x1="200" y1="140" x2="200" y2="324" stroke="#2B2D42" stroke-width="8"/>
  <circle cx="172" cy="200" r="14" fill="#2B2D42"/><circle cx="232" cy="250" r="16" fill="#2B2D42"/><circle cx="170" cy="280" r="10" fill="#2B2D42"/>
  <circle cx="184" cy="124" r="8" fill="#FFFFFF"/><circle cx="216" cy="124" r="8" fill="#FFFFFF"/>
</g>
</svg>`,
  },

  globe: {
    name: "Spinning globe",
    tags: "globe world earth international global travel geography planet countries worldwide map",
    svg: `<svg ${S}>
${shadow(200, 360, 110)}
<clipPath id="ball"><circle cx="200" cy="190" r="130"/></clipPath>
<circle cx="200" cy="190" r="130" fill="#4FA3FF"/>
<g clip-path="url(#ball)">
  <g fill="#5BB85D">
    <animateTransform attributeName="transform" type="translate" values="0 0;-260 0" dur="8s" repeatCount="indefinite"/>
    <path d="M80 110 C110 80 170 90 180 130 C188 160 150 170 140 200 C130 236 90 240 80 210 C70 180 50 140 80 110 Z"/>
    <path d="M210 210 C240 190 290 200 300 240 C310 280 270 310 240 300 C210 290 190 240 210 210 Z"/>
    <path d="M250 90 C270 70 320 80 330 110 C340 140 300 150 280 140 C260 130 234 110 250 90 Z"/>
    <path d="M340 110 C370 80 430 90 440 130 C448 160 410 170 400 200 C390 236 350 240 340 210 C330 180 310 140 340 110 Z"/>
    <path d="M470 210 C500 190 550 200 560 240 C570 280 530 310 500 300 C470 290 450 240 470 210 Z"/>
    <path d="M510 90 C530 70 580 80 590 110 C600 140 560 150 540 140 C520 130 494 110 510 90 Z"/>
  </g>
</g>
<circle cx="200" cy="190" r="130" fill="none" stroke="#3A87E0" stroke-width="8"/>
<path d="M120 120 C140 96 170 84 196 82" stroke="#FFFFFF" stroke-width="12" stroke-linecap="round" fill="none" opacity="0.5"/>
<rect x="194" y="320" width="12" height="20" fill="#8D99AE"/><rect x="140" y="336" width="120" height="16" rx="8" fill="#8D99AE"/>
</svg>`,
  },
};
