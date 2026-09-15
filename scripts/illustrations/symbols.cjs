// General symbols for slides: checks, warnings, stars, arrows, numbers and faces of feeling.
const { S, ease, easeN, shadow, sparkle, float } = require("./_shared.cjs");

module.exports = {
  checkmark: {
    name: "Check mark",
    tags: "check mark done complete yes correct approved success tick verified finished ok",
    svg: `<svg ${S}>
<circle cx="200" cy="200" r="150" fill="#5BB85D" transform-origin="200 200"><animateTransform attributeName="transform" type="scale" values="0.9;1;0.9" dur="2s" repeatCount="indefinite" ${ease}/></circle>
<path d="M130 206 L182 258 L278 150" stroke="#FFFFFF" stroke-width="34" stroke-linecap="round" stroke-linejoin="round" fill="none" pathLength="1" stroke-dasharray="1" stroke-dashoffset="1">
  <animate attributeName="stroke-dashoffset" values="1;0;0" keyTimes="0;0.35;1" dur="3s" repeatCount="indefinite"/>
</path>
</svg>`,
  },

  cross: {
    name: "Cross mark",
    tags: "cross wrong no mistake error incorrect avoid reject do not myth false",
    svg: `<svg ${S}>
<circle cx="200" cy="200" r="150" fill="#FF5A6E"/>
<g stroke="#FFFFFF" stroke-width="34" stroke-linecap="round" transform-origin="200 200">
  <animateTransform attributeName="transform" type="rotate" values="0;0;-8;8;0" keyTimes="0;0.6;0.7;0.8;0.9" dur="2.4s" repeatCount="indefinite"/>
  <line x1="140" y1="140" x2="260" y2="260"/><line x1="260" y1="140" x2="140" y2="260"/>
</g>
</svg>`,
  },

  warning: {
    name: "Warning sign",
    tags: "warning caution alert danger attention risk important notice hazard careful",
    svg: `<svg ${S}>
${shadow(200, 352, 150)}
<path d="M200 50 C212 50 220 56 226 66 L356 300 C368 322 354 340 330 340 H70 C46 340 32 322 44 300 L174 66 C180 56 188 50 200 50 Z" fill="#FFC857"/>
<rect x="182" y="130" width="36" height="120" rx="18" fill="#2B2D42"/><circle cx="200" cy="290" r="22" fill="#2B2D42"/>
<path d="M200 50 C212 50 220 56 226 66 L356 300 C368 322 354 340 330 340 H70 C46 340 32 322 44 300 L174 66 C180 56 188 50 200 50 Z" fill="none" stroke="#FF9F43" stroke-width="12"><animate attributeName="opacity" values="0;1;0" dur="1s" repeatCount="indefinite"/></path>
</svg>`,
  },

  star: {
    name: "Star rating",
    tags: "star rating review favorite quality excellent best top rated feedback five stars award",
    svg: `<svg ${S}>
<path d="M200 50 L244 140 L342 154 L271 223 L288 320 L200 274 L112 320 L129 223 L58 154 L156 140 Z" fill="#FFC857" stroke="#FFC857" stroke-width="16" stroke-linejoin="round" transform-origin="200 190">
  <animateTransform attributeName="transform" type="rotate" values="-6;6;-6" dur="2.4s" repeatCount="indefinite" ${ease}/>
</path>
<path d="M200 96 L224 146" stroke="#FFF3C4" stroke-width="14" stroke-linecap="round"/>
${sparkle(90, 80, 0.9, 0)}${sparkle(320, 70, 0.7, 0.6)}${sparkle(330, 330, 0.8, 1.1)}${sparkle(70, 320, 0.6, 0.3)}
</svg>`,
  },

  question: {
    name: "Question mark",
    tags: "question mark faq help ask quiz doubt unknown why curious query support",
    svg: `<svg ${S}>
${shadow(200, 356, 90)}
<g transform-origin="200 330">
  <animateTransform attributeName="transform" type="rotate" values="-8;8;-8" dur="2s" repeatCount="indefinite" ${ease}/>
  <path d="M130 130 C130 80 164 50 204 50 C250 50 280 82 280 124 C280 168 244 180 224 200 C212 212 212 222 212 240" stroke="#7B61FF" stroke-width="44" stroke-linecap="round" fill="none"/>
  <circle cx="212" cy="310" r="28" fill="#7B61FF"/>
</g>
</svg>`,
  },

  arrowup: {
    name: "Arrow up growth",
    tags: "arrow up increase growth rise improvement boost trend profit higher gain progress",
    svg: `<svg ${S}>
<g>
  <animateTransform attributeName="transform" type="translate" values="0 20;0 -20;0 20" dur="1.6s" repeatCount="indefinite" ${ease}/>
  <path d="M200 50 L330 190 H250 V350 H150 V190 H70 Z" fill="#5BB85D" stroke="#5BB85D" stroke-width="16" stroke-linejoin="round"/>
</g>
</svg>`,
  },

  arrowdown: {
    name: "Arrow down decline",
    tags: "arrow down decrease decline drop reduce fall loss cut lower cost reduction",
    svg: `<svg ${S}>
<g>
  <animateTransform attributeName="transform" type="translate" values="0 -20;0 20;0 -20" dur="1.6s" repeatCount="indefinite" ${ease}/>
  <path d="M200 350 L330 210 H250 V50 H150 V210 H70 Z" fill="#FF5A6E" stroke="#FF5A6E" stroke-width="16" stroke-linejoin="round"/>
</g>
</svg>`,
  },

  thumbsup: {
    name: "Thumbs up",
    tags: "thumbs up like good approve great job recommend positive agree yes",
    svg: `<svg ${S}>
${shadow(200, 356, 120)}
<g>
  <animateTransform attributeName="transform" type="rotate" values="0 150 300;-12 150 300;0 150 300" dur="1.4s" repeatCount="indefinite" ${ease}/>
  <rect x="60" y="170" width="70" height="170" rx="16" fill="#4F7CFF"/>
  <path d="M140 340 V180 L196 70 C204 54 236 56 240 82 C244 104 232 136 224 164 H320 C346 164 360 190 350 212 L316 312 C308 332 292 340 272 340 Z" fill="#FFC857"/>
  <path d="M240 210 H330 M236 256 H318" stroke="#E0A526" stroke-width="10" stroke-linecap="round"/>
</g>
${sparkle(320, 80, 0.9, 0.3)}
</svg>`,
  },

  percent: {
    name: "Discount percent",
    tags: "percent discount sale offer deal promotion price off coupon savings interest rate",
    svg: `<svg ${S}>
<g transform-origin="200 200">
  <animateTransform attributeName="transform" type="rotate" values="0;360" dur="12s" repeatCount="indefinite"/>
  <path d="M200 30 L236 64 L284 56 L298 102 L344 118 L336 166 L370 200 L336 234 L344 282 L298 298 L284 344 L236 336 L200 370 L164 336 L116 344 L102 298 L56 282 L64 234 L30 200 L64 166 L56 118 L102 102 L116 56 L164 64 Z" fill="#FF5A6E"/>
</g>
<circle cx="150" cy="150" r="30" fill="none" stroke="#FFFFFF" stroke-width="18"/><circle cx="250" cy="250" r="30" fill="none" stroke="#FFFFFF" stroke-width="18"/>
<line x1="260" y1="130" x2="140" y2="270" stroke="#FFFFFF" stroke-width="20" stroke-linecap="round"/>
</svg>`,
  },

  number1: {
    name: "Number one medal",
    tags: "number one first place medal winner best rank top champion gold leader",
    svg: `<svg ${S}>
<path d="M130 40 H190 L230 170 H170 Z" fill="#4F7CFF"/><path d="M270 40 H210 L170 170 H230 Z" fill="#FF5A6E"/>
<g>
  <animateTransform attributeName="transform" type="rotate" values="-8 200 150;8 200 150;-8 200 150" dur="2.4s" repeatCount="indefinite" ${ease}/>
  <circle cx="200" cy="250" r="100" fill="#FFC857"/><circle cx="200" cy="250" r="76" fill="#FFB627"/>
  <text x="200" y="290" font-family="sans-serif" font-size="110" font-weight="bold" fill="#FFFFFF" text-anchor="middle">1</text>
</g>
${sparkle(320, 180, 0.8, 0.2)}${sparkle(80, 300, 0.7, 0.9)}
</svg>`,
  },

  happyface: {
    name: "Happy customer",
    tags: "happy smile satisfied customer joy positive feedback satisfaction emotion mood wellbeing",
    svg: `<svg ${S}>
${shadow(200, 360, 100)}
<g>
  ${float(10, 2)}
  <circle cx="200" cy="190" r="140" fill="#FFC857"/>
  <path d="M130 170 C140 146 170 146 180 170" stroke="#2B2D42" stroke-width="14" stroke-linecap="round" fill="none"/>
  <path d="M220 170 C230 146 260 146 270 170" stroke="#2B2D42" stroke-width="14" stroke-linecap="round" fill="none"/>
  <path d="M120 220 H280 C280 270 244 300 200 300 C156 300 120 270 120 220 Z" fill="#8D2A3A"/>
  <path d="M150 272 C170 260 230 260 250 272 C236 290 216 300 200 300 C184 300 164 290 150 272 Z" fill="#FF6B6B"/>
  <ellipse cx="110" cy="220" rx="20" ry="12" fill="#FF9F43" opacity="0.5"/><ellipse cx="290" cy="220" rx="20" ry="12" fill="#FF9F43" opacity="0.5"/>
</g>
</svg>`,
  },

  sadface: {
    name: "Sad face",
    tags: "sad unhappy problem pain stress complaint frustration disappointed emotion negative",
    svg: `<svg ${S}>
${shadow(200, 360, 100)}
<circle cx="200" cy="190" r="140" fill="#7BB8FF"/>
<ellipse cx="150" cy="170" rx="14" ry="18" fill="#2B2D42"/><ellipse cx="250" cy="170" rx="14" ry="18" fill="#2B2D42"/>
<path d="M140 270 C160 234 240 234 260 270" stroke="#2B2D42" stroke-width="14" stroke-linecap="round" fill="none"/>
<path d="M150 196 C144 212 144 222 150 230 C156 222 156 212 150 196 Z" fill="#FFFFFF">
  <animateTransform attributeName="transform" type="translate" values="0 0;0 90" dur="1.8s" repeatCount="indefinite"/>
  <animate attributeName="opacity" values="1;1;0" keyTimes="0;0.7;1" dur="1.8s" repeatCount="indefinite"/>
</path>
</svg>`,
  },

  loading: {
    name: "Loading spinner",
    tags: "loading progress waiting processing spinner working buffering in progress update",
    svg: `<svg ${S}>
<circle cx="200" cy="200" r="120" fill="none" stroke="#EDF2FB" stroke-width="34"/>
<circle cx="200" cy="200" r="120" fill="none" stroke="#4F7CFF" stroke-width="34" stroke-linecap="round" stroke-dasharray="190 564">
  <animateTransform attributeName="transform" type="rotate" values="0 200 200;360 200 200" dur="1.2s" repeatCount="indefinite"/>
</circle>
</svg>`,
  },

  quote: {
    name: "Quote marks",
    tags: "quote testimonial saying review opinion words speech citation interview feedback",
    svg: `<svg ${S}>
<g fill="#7B61FF">
  <path d="M60 200 C60 130 100 80 170 70 L180 104 C140 116 124 140 122 170 H170 V290 H60 Z"><animateTransform attributeName="transform" type="translate" values="0 0;0 -12;0 0" dur="2s" repeatCount="indefinite" ${ease}/></path>
  <path d="M220 200 C220 130 260 80 330 70 L340 104 C300 116 284 140 282 170 H330 V290 H220 Z"><animateTransform attributeName="transform" type="translate" values="0 0;0 -12;0 0" dur="2s" begin="0.3s" repeatCount="indefinite" ${ease}/></path>
</g>
</svg>`,
  },

  checklist: {
    name: "Checklist",
    tags: "checklist to do list tasks plan steps requirements agenda survey form clipboard items",
    svg: `<svg ${S}>
${shadow(200, 360, 130)}
<rect x="80" y="50" width="240" height="300" rx="20" fill="#FFFFFF" stroke="#D9E1EC" stroke-width="6"/>
<rect x="150" y="34" width="100" height="36" rx="10" fill="#8D99AE"/>
<g fill="#D9E1EC"><rect x="160" y="112" width="130" height="16" rx="8"/><rect x="160" y="182" width="110" height="16" rx="8"/><rect x="160" y="252" width="130" height="16" rx="8"/></g>
<g fill="none" stroke="#D9E1EC" stroke-width="6"><rect x="104" y="100" width="40" height="40" rx="8"/><rect x="104" y="170" width="40" height="40" rx="8"/><rect x="104" y="240" width="40" height="40" rx="8"/></g>
<g stroke="#5BB85D" stroke-width="12" stroke-linecap="round" stroke-linejoin="round" fill="none">
  <path d="M112 120 L122 130 L140 108" pathLength="1" stroke-dasharray="1" stroke-dashoffset="1"><animate attributeName="stroke-dashoffset" values="1;0;0;1" keyTimes="0;0.15;0.9;1" dur="4s" repeatCount="indefinite"/></path>
  <path d="M112 190 L122 200 L140 178" pathLength="1" stroke-dasharray="1" stroke-dashoffset="1"><animate attributeName="stroke-dashoffset" values="1;1;0;0;1" keyTimes="0;0.25;0.4;0.9;1" dur="4s" repeatCount="indefinite"/></path>
  <path d="M112 260 L122 270 L140 248" pathLength="1" stroke-dasharray="1" stroke-dashoffset="1"><animate attributeName="stroke-dashoffset" values="1;1;0;0;1" keyTimes="0;0.5;0.65;0.9;1" dur="4s" repeatCount="indefinite"/></path>
</g>
</svg>`,
  },
};
