// Pieces shared by the illustration files: the SVG header, easing and small decorations.
const S = `xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400"`;
/** Smooth in-out easing for a values list with n segments. */
const easeN = (n) => `calcMode="spline" keySplines="${Array(n).fill("0.45 0 0.55 1").join(";")}"`;
const ease = easeN(2);
const shadow = (cx = 200, cy = 356, rx = 120) => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="13" fill="#2B2D42" opacity="0.08"/>`;
const sparkle = (x, y, s, delay, color = "#FFD166") =>
  `<g transform="translate(${x} ${y}) scale(${s})"><path d="M0 -20 C3 -4 4 -3 20 0 C4 3 3 4 0 20 C-3 4 -4 3 -20 0 C-4 -3 -3 -4 0 -20Z" fill="${color}"><animateTransform attributeName="transform" type="scale" values="0.2;1;0.2" dur="1.8s" begin="${delay}s" repeatCount="indefinite" ${ease}/></path></g>`;
/** Gentle up-and-down float for a group's content. */
const float = (dy = 12, dur = 2.6, delay = 0) => `<animateTransform attributeName="transform" type="translate" values="0 0;0 ${-dy};0 0" dur="${dur}s" begin="${delay}s" repeatCount="indefinite" ${ease}/>`;
/** Pulse scale around a point. */
const pulse = (cx, cy, amount = 1.08, dur = 1.6) => `transform-origin="${cx} ${cy}"><animateTransform attributeName="transform" type="scale" values="1;${amount};1" dur="${dur}s" repeatCount="indefinite" ${ease}/`;
/** A person (bust): head and shoulders, for team and people pictures. */
const person = (x, y, s, shirt, skin = "#F4C7A1", hair = "#3B2A20") =>
  `<g transform="translate(${x} ${y}) scale(${s})"><path d="M-46 90 C-46 40 -26 24 0 24 C26 24 46 40 46 90 Z" fill="${shirt}"/><circle cx="0" cy="-8" r="28" fill="${skin}"/><path d="M-29 -10 C-30 -40 30 -44 29 -10 C22 -24 -18 -26 -29 -10Z" fill="${hair}"/></g>`;
module.exports = { S, ease, easeN, shadow, sparkle, float, pulse, person };
