// Communication, marketing and social illustrations.
const { S, ease, easeN, shadow, sparkle, float } = require("./_shared.cjs");

module.exports = {
  chat: {
    name: "Chat bubbles",
    tags: "chat messages conversation talk support customer service texting communication feedback discussion",
    svg: `<svg ${S}>
<g>
  ${float(8, 3)}
  <path d="M60 80 H250 C266 80 280 94 280 110 V200 C280 216 266 230 250 230 H130 L84 270 V230 H60 C44 230 30 216 30 200 V110 C30 94 44 80 60 80 Z" fill="#4F7CFF"/>
  <g fill="#FFFFFF">
    <circle cx="100" cy="155" r="14"><animate attributeName="cy" values="155;140;155;155" keyTimes="0;0.2;0.4;1" dur="1.2s" repeatCount="indefinite"/></circle>
    <circle cx="155" cy="155" r="14"><animate attributeName="cy" values="155;155;140;155;155" keyTimes="0;0.2;0.4;0.6;1" dur="1.2s" repeatCount="indefinite"/></circle>
    <circle cx="210" cy="155" r="14"><animate attributeName="cy" values="155;155;140;155" keyTimes="0;0.4;0.6;0.8" dur="1.2s" repeatCount="indefinite"/></circle>
  </g>
</g>
<g>
  ${float(8, 3, 1)}
  <path d="M340 190 H190 C174 190 160 204 160 220 V290 C160 306 174 320 190 320 H290 L330 354 V320 H340 C356 320 370 306 370 290 V220 C370 204 356 190 340 190 Z" fill="#2EC4B6"/>
  <g fill="#FFFFFF"><rect x="192" y="226" width="140" height="16" rx="8"/><rect x="192" y="258" width="100" height="16" rx="8"/></g>
</g>
</svg>`,
  },

  email: {
    name: "Email envelope",
    tags: "email mail envelope message newsletter inbox letter contact send marketing communication",
    svg: `<svg ${S}>
${shadow(200, 346, 150)}
<g>
  ${float(10, 2.8)}
  <rect x="60" y="120" width="280" height="190" rx="18" fill="#FFC857"/>
  <g>
    <animateTransform attributeName="transform" type="translate" values="0 60;0 -30;0 -30;0 60" keyTimes="0;0.3;0.8;1" dur="3.4s" repeatCount="indefinite" ${easeN(3)}/>
    <rect x="96" y="100" width="208" height="150" rx="10" fill="#FFFFFF"/>
    <rect x="120" y="126" width="110" height="14" rx="7" fill="#4F7CFF"/><rect x="120" y="152" width="160" height="10" rx="5" fill="#D9E1EC"/><rect x="120" y="172" width="140" height="10" rx="5" fill="#D9E1EC"/>
  </g>
  <path d="M60 170 L200 250 L340 170 V292 C340 302 332 310 322 310 H78 C68 310 60 302 60 292 Z" fill="#FFB627"/>
  <path d="M60 310 L170 230 M340 310 L230 230" stroke="#E0A526" stroke-width="6"/>
</g>
<circle cx="330" cy="116" r="26" fill="#FF5A6E"><animate attributeName="r" values="22;28;22" dur="1.2s" repeatCount="indefinite" ${ease}/></circle>
</svg>`,
  },

  megaphone: {
    name: "Megaphone announcement",
    tags: "megaphone announcement marketing promotion advertising news campaign loudspeaker shout broadcast attention",
    svg: `<svg ${S}>
${shadow(190, 350, 130)}
<g>
  <animateTransform attributeName="transform" type="rotate" values="-4 150 220;4 150 220;-4 150 220" dur="0.6s" repeatCount="indefinite" ${ease}/>
  <path d="M100 170 L250 90 V310 L100 230 Z" fill="#FF5A6E"/>
  <rect x="60" y="164" width="60" height="72" rx="14" fill="#2B2D42"/>
  <path d="M110 230 L140 316 C144 328 160 330 166 318 L178 294 L150 244 Z" fill="#8D99AE"/>
  <ellipse cx="250" cy="200" rx="24" ry="110" fill="#E0445A"/>
</g>
<g stroke="#FFC857" stroke-width="12" stroke-linecap="round" fill="none">
  <path d="M292 150 C314 176 314 224 292 250"><animate attributeName="opacity" values="0;1;0" dur="1.2s" repeatCount="indefinite"/></path>
  <path d="M320 120 C356 164 356 236 320 280"><animate attributeName="opacity" values="0;1;0" dur="1.2s" begin="0.3s" repeatCount="indefinite"/></path>
  <path d="M350 92 C396 150 396 250 350 308"><animate attributeName="opacity" values="0;1;0" dur="1.2s" begin="0.6s" repeatCount="indefinite"/></path>
</g>
</svg>`,
  },

  socialmedia: {
    name: "Social media likes",
    tags: "social media likes followers engagement instagram facebook influencer marketing viral content reactions",
    svg: `<svg ${S}>
${shadow(200, 356, 120)}
<rect x="110" y="60" width="180" height="270" rx="24" fill="#FFFFFF" stroke="#D9E1EC" stroke-width="6"/>
<rect x="130" y="84" width="140" height="110" rx="12" fill="#7BB8FF"/><circle cx="170" cy="120" r="16" fill="#FFC857"/><path d="M130 180 L180 140 L220 170 L250 150 L270 170 V194 H130 Z" fill="#5BB85D"/>
<rect x="130" y="210" width="100" height="12" rx="6" fill="#D9E1EC"/><rect x="130" y="232" width="70" height="12" rx="6" fill="#D9E1EC"/>
<g fill="#FF5A6E">
  <path d="M0 -8 C-8 -20 -26 -14 -24 0 C-22 12 -6 20 0 26 C6 20 22 12 24 0 C26 -14 8 -20 0 -8Z" transform="translate(200 280)">
    <animateTransform attributeName="transform" type="translate" values="200 280;170 60" dur="2.2s" repeatCount="indefinite"/>
    <animate attributeName="opacity" values="1;0" dur="2.2s" repeatCount="indefinite"/>
  </path>
  <path d="M0 -8 C-8 -20 -26 -14 -24 0 C-22 12 -6 20 0 26 C6 20 22 12 24 0 C26 -14 8 -20 0 -8Z" transform="translate(220 280)">
    <animateTransform attributeName="transform" type="translate" values="220 280;290 80" dur="2.2s" begin="0.7s" repeatCount="indefinite"/>
    <animate attributeName="opacity" values="1;0" dur="2.2s" begin="0.7s" repeatCount="indefinite"/>
  </path>
</g>
<g fill="#4F7CFF">
  <path d="M-20 0 H-6 V30 H-20 Z M-2 30 V0 L10 -24 C16 -26 22 -20 20 -12 L16 0 H30 C38 0 42 8 38 14 L28 30 Z" transform="translate(260 290)">
    <animateTransform attributeName="transform" type="translate" values="260 290;330 100" dur="2.2s" begin="1.3s" repeatCount="indefinite"/>
    <animate attributeName="opacity" values="1;0" dur="2.2s" begin="1.3s" repeatCount="indefinite"/>
  </path>
</g>
<rect x="136" y="266" width="126" height="44" rx="22" fill="#FF5A6E"/><text x="199" y="296" font-family="sans-serif" font-size="24" font-weight="bold" fill="#FFFFFF" text-anchor="middle">+1.2K</text>
</svg>`,
  },

  videocall: {
    name: "Video call",
    tags: "video call meeting online conference remote work zoom webinar camera streaming",
    svg: `<svg ${S}>
${shadow(200, 346, 160)}
<rect x="40" y="70" width="320" height="230" rx="20" fill="#2B2D42"/>
<rect x="56" y="86" width="140" height="94" rx="10" fill="#7BB8FF"/><rect x="204" y="86" width="140" height="94" rx="10" fill="#8FD98F"/>
<rect x="56" y="188" width="140" height="94" rx="10" fill="#FFC857"/><rect x="204" y="188" width="140" height="94" rx="10" fill="#FF8FA3"/>
<g><circle cx="126" cy="126" r="20" fill="#F4C7A1"/><path d="M96 180 C96 156 110 150 126 150 C142 150 156 156 156 180 Z" fill="#4F7CFF"/></g>
<g><circle cx="274" cy="126" r="20" fill="#E8B08A"/><path d="M244 180 C244 156 258 150 274 150 C290 150 304 156 304 180 Z" fill="#2B2D42"/></g>
<g><circle cx="126" cy="228" r="20" fill="#C68B59"/><path d="M96 282 C96 258 110 252 126 252 C142 252 156 258 156 282 Z" fill="#FF6B6B"/></g>
<g><circle cx="274" cy="228" r="20" fill="#F4C7A1"/><path d="M244 282 C244 258 258 252 274 252 C290 252 304 258 304 282 Z" fill="#7B61FF"/></g>
<rect x="204" y="86" width="140" height="94" rx="10" fill="none" stroke="#5BB85D" stroke-width="6"><animate attributeName="opacity" values="1;0.2;1" dur="1s" repeatCount="indefinite"/></rect>
<rect x="150" y="314" width="100" height="30" rx="15" fill="#FF5A6E"/>
</svg>`,
  },

  newspaper: {
    name: "News",
    tags: "news newspaper article media press journalism headlines report blog update information",
    svg: `<svg ${S}>
${shadow(200, 352, 150)}
<g transform="rotate(-6 200 200)">
  <rect x="70" y="70" width="260" height="270" rx="12" fill="#FFFFFF" stroke="#D9E1EC" stroke-width="5"/>
  <rect x="96" y="96" width="208" height="30" rx="6" fill="#2B2D42"/>
  <rect x="96" y="144" width="96" height="84" rx="6" fill="#7BB8FF"/>
  <g fill="#D9E1EC"><rect x="206" y="146" width="98" height="10" rx="5"/><rect x="206" y="166" width="80" height="10" rx="5"/><rect x="206" y="186" width="98" height="10" rx="5"/><rect x="206" y="206" width="70" height="10" rx="5"/>
  <rect x="96" y="246" width="208" height="10" rx="5"/><rect x="96" y="266" width="180" height="10" rx="5"/><rect x="96" y="286" width="208" height="10" rx="5"/><rect x="96" y="306" width="120" height="10" rx="5"/></g>
</g>
<g transform-origin="320 90">
  <animateTransform attributeName="transform" type="rotate" values="-10;10;-10" dur="1.4s" repeatCount="indefinite" ${ease}/>
  <circle cx="320" cy="90" r="40" fill="#FF5A6E"/>
  <text x="320" y="100" font-family="sans-serif" font-size="26" font-weight="bold" fill="#FFFFFF" text-anchor="middle">NEW</text>
</g>
</svg>`,
  },

  notification: {
    name: "Notification bell",
    tags: "notification bell alert reminder alarm update subscribe ring attention",
    svg: `<svg ${S}>
${shadow(200, 352, 100)}
<g>
  <animateTransform attributeName="transform" type="rotate" values="0 200 70;16 200 70;-14 200 70;10 200 70;-6 200 70;0 200 70;0 200 70" keyTimes="0;0.1;0.2;0.3;0.4;0.5;1" dur="2s" repeatCount="indefinite"/>
  <circle cx="200" cy="66" r="18" fill="#E0A526"/>
  <path d="M200 76 C140 76 112 124 112 180 V240 L84 280 H316 L288 240 V180 C288 124 260 76 200 76 Z" fill="#FFC857"/>
  <path d="M150 140 C156 116 172 102 192 98" stroke="#FFF3C4" stroke-width="14" stroke-linecap="round" fill="none"/>
  <path d="M164 290 C164 312 180 326 200 326 C220 326 236 312 236 290 Z" fill="#E0A526"/>
</g>
<circle cx="284" cy="100" r="30" fill="#FF5A6E"><animate attributeName="r" values="26;32;26" dur="1s" repeatCount="indefinite" ${ease}/></circle>
</svg>`,
  },

  gift: {
    name: "Gift box",
    tags: "gift present box surprise reward bonus birthday celebration giveaway offer discount holiday",
    svg: `<svg ${S}>
${shadow(200, 354, 130)}
<rect x="80" y="180" width="240" height="160" rx="14" fill="#FF5A6E"/>
<rect x="180" y="180" width="40" height="160" fill="#FFC857"/>
<g>
  <animateTransform attributeName="transform" type="translate" values="0 0;0 -40;0 -40;0 0;0 0" keyTimes="0;0.2;0.5;0.7;1" dur="3s" repeatCount="indefinite" ${easeN(4)}/>
  <rect x="64" y="136" width="272" height="56" rx="12" fill="#FF7A8A"/><rect x="180" y="136" width="40" height="56" fill="#FFD875"/>
  <path d="M200 136 C170 90 120 100 140 130 C150 142 180 140 200 136 C220 140 250 142 260 130 C280 100 230 90 200 136 Z" fill="#FFC857"/>
</g>
${sparkle(110, 110, 0.8, 0.6)}${sparkle(300, 90, 1, 0.9, "#7BDFF2")}${sparkle(200, 60, 0.7, 1.2)}
</svg>`,
  },
};
