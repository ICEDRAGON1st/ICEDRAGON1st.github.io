/**
 * Hub game card thumbs — clear, readable icons for each branded game.
 * Avoid Flappy/Wordle/etc. clone silhouettes, but keep subjects obvious.
 * Run: node tools/gen-hub-thumbs.js
 */
const fs = require("fs");
const path = require("path");

const dir = path.join(__dirname, "..", "hub-thumbs");
fs.mkdirSync(dir, { recursive: true });

function svg(body, bg, caption) {
  const cap = caption
    ? `<rect x="0" y="148" width="320" height="32" fill="#000" opacity="0.45"/>
       <text x="160" y="170" text-anchor="middle" font-size="15" font-weight="700" fill="#fff" font-family="Segoe UI,Arial,sans-serif" letter-spacing="0.5">${caption}</text>`
    : "";
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 180" role="img" aria-hidden="true">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${bg[0]}"/>
      <stop offset="100%" stop-color="${bg[1]}"/>
    </linearGradient>
  </defs>
  <rect width="320" height="180" fill="url(#g)"/>
  ${body}
  ${cap}
</svg>`;
}

const arts = {
  wordle: svg(
    `${[0, 1, 2, 3, 4]
      .map((i) => {
        const letters = ["G", "U", "E", "S", "S"];
        const colors = ["#a5d8ff", "#74c0fc", "#4dabf7", "#339af0", "#1c7ed6"];
        return `<rect x="${45 + i * 46}" y="45" width="40" height="48" rx="8" fill="${colors[i]}" stroke="#e7f5ff" stroke-width="2"/>
          <text x="${65 + i * 46}" y="78" text-anchor="middle" font-size="26" font-weight="800" fill="#fff" font-family="Segoe UI,sans-serif">${letters[i]}</text>`;
      })
      .join("")}
     <path d="M50 105 Q80 125 110 105" fill="none" stroke="#74c0fc" stroke-width="3" opacity="0.7"/>
     <path d="M210 105 Q240 125 270 105" fill="none" stroke="#74c0fc" stroke-width="3" opacity="0.7"/>`,
    ["#0b2a4a", "#1864ab"],
    "GUESSWORD"
  ),

  space: svg(
    `<circle cx="40" cy="30" r="2" fill="#fff"/><circle cx="280" cy="40" r="2" fill="#fff"/>
     <circle cx="70" cy="70" r="1.5" fill="#fff"/><circle cx="250" cy="90" r="1.5" fill="#fff"/>
     <ellipse cx="120" cy="100" rx="36" ry="18" fill="#74c0fc"/>
     <polygon points="120,55 145,100 95,100" fill="#e7f5ff"/>
     <rect x="110" y="100" width="20" height="36" rx="4" fill="#ff922b"/>
     <circle cx="240" cy="70" r="22" fill="#ff6b6b"/>
     <circle cx="240" cy="70" r="10" fill="#ffa8a8"/>
     <line x1="160" y1="85" x2="210" y2="75" stroke="#ffd43b" stroke-width="4"/>
     <polygon points="210,75 200,68 200,82" fill="#ffd43b"/>`,
    ["#0b1026", "#5f3dc4"],
    "SPACE SHOOTER"
  ),

  quiz: svg(
    `<circle cx="160" cy="78" r="52" fill="#fff" opacity="0.15"/>
     <text x="160" y="100" text-anchor="middle" font-size="84" font-weight="800" fill="#fff" font-family="Georgia,serif">?</text>
     <rect x="70" y="125" width="50" height="14" rx="4" fill="#69db7c"/><rect x="130" y="125" width="50" height="14" rx="4" fill="#ffd43b"/>
     <rect x="190" y="125" width="50" height="14" rx="4" fill="#ff8787"/>`,
    ["#5c2d91", "#ae3ec9"],
    "QUIZMASTER"
  ),

  breakout: svg(
    `${[0, 1, 2, 3, 4, 5]
      .map(
        (c) =>
          `<rect x="${30 + c * 44}" y="28" width="40" height="16" rx="3" fill="${["#ff6b6b", "#fcc419", "#51cf66", "#339af0", "#cc5de8", "#ff922b"][c]}"/>`
      )
      .join("")}
     ${[0, 1, 2, 3, 4, 5]
      .map(
        (c) =>
          `<rect x="${30 + c * 44}" y="50" width="40" height="16" rx="3" fill="${["#ffa8a8", "#ffe066", "#8ce99a", "#74c0fc", "#e599f7", "#ffc078"][c]}"/>`
      )
      .join("")}
     <circle cx="170" cy="100" r="10" fill="#fff"/>
     <rect x="120" y="130" width="80" height="12" rx="6" fill="#e9ecef"/>`,
    ["#1a1b1e", "#364fc7"],
    "BOUNCE BREAK"
  ),

  hangman: svg(
    `<line x1="70" y1="140" x2="170" y2="140" stroke="#e7f5ff" stroke-width="7"/>
     <line x1="100" y1="140" x2="100" y2="30" stroke="#e7f5ff" stroke-width="7"/>
     <line x1="100" y1="30" x2="190" y2="30" stroke="#e7f5ff" stroke-width="7"/>
     <line x1="190" y1="30" x2="190" y2="52" stroke="#a5d8ff" stroke-width="5"/>
     <circle cx="190" cy="70" r="16" fill="none" stroke="#ffd8a8" stroke-width="5"/>
     <line x1="190" y1="86" x2="190" y2="118" stroke="#ffd8a8" stroke-width="5"/>
     <line x1="190" y1="95" x2="170" y2="110" stroke="#ffd8a8" stroke-width="4"/>
     <line x1="190" y1="95" x2="210" y2="110" stroke="#ffd8a8" stroke-width="4"/>
     <text x="240" y="100" font-size="22" fill="#fff" font-family="Segoe UI,sans-serif">A _ _</text>`,
    ["#2b2118", "#e67700"],
    "HANGMAN"
  ),

  "2048": svg(
    `<rect x="40" y="35" width="70" height="70" rx="12" fill="#74c0fc"/>
     <text x="75" y="82" text-anchor="middle" font-size="28" font-weight="800" fill="#0b2a4a" font-family="Segoe UI,sans-serif">2</text>
     <rect x="125" y="35" width="70" height="70" rx="12" fill="#4dabf7"/>
     <text x="160" y="82" text-anchor="middle" font-size="28" font-weight="800" fill="#fff" font-family="Segoe UI,sans-serif">2</text>
     <text x="160" y="30" text-anchor="middle" font-size="28" fill="#ffd43b" font-family="Segoe UI,sans-serif">+</text>
     <rect x="210" y="35" width="70" height="70" rx="12" fill="#1c7ed6"/>
     <text x="245" y="82" text-anchor="middle" font-size="28" font-weight="800" fill="#fff" font-family="Segoe UI,sans-serif">4</text>
     <path d="M110 70 L125 70" stroke="#ffd43b" stroke-width="5"/>
     <path d="M195 70 L210 70" stroke="#ffd43b" stroke-width="5"/>
     <text x="160" y="130" text-anchor="middle" font-size="18" fill="#e7f5ff" font-family="Segoe UI,sans-serif">slide · merge</text>`,
    ["#0b2a4a", "#3b5bdb"],
    "BLOCK MERGE"
  ),

  snake: svg(
    `<rect x="40" y="70" width="32" height="32" rx="8" fill="#51cf66"/>
     <rect x="76" y="70" width="32" height="32" rx="8" fill="#40c057"/>
     <rect x="112" y="70" width="32" height="32" rx="8" fill="#37b24d"/>
     <rect x="148" y="70" width="32" height="32" rx="8" fill="#2f9e44"/>
     <rect x="148" y="34" width="32" height="32" rx="8" fill="#2b8a3e"/>
     <circle cx="158" cy="42" r="4" fill="#fff"/><circle cx="170" cy="42" r="4" fill="#fff"/>
     <circle cx="240" cy="90" r="16" fill="#ff6b6b"/>
     <text x="240" y="96" text-anchor="middle" font-size="16" fill="#fff">🍎</text>`,
    ["#0b3d1e", "#087f5b"],
    "SNAKE"
  ),

  memory: svg(
    `<rect x="45" y="30" width="70" height="95" rx="10" fill="#4c6ef5"/>
     <text x="80" y="90" text-anchor="middle" font-size="36" fill="#fff" opacity="0.35">?</text>
     <rect x="125" y="30" width="70" height="95" rx="10" fill="#ffd43b"/>
     <text x="160" y="95" text-anchor="middle" font-size="42" fill="#5c3b00">★</text>
     <rect x="205" y="30" width="70" height="95" rx="10" fill="#ffd43b"/>
     <text x="240" y="95" text-anchor="middle" font-size="42" fill="#5c3b00">★</text>`,
    ["#1b2a4a", "#3b5bdb"],
    "MEMORY MATCH"
  ),

  "connect-four": svg(
    `<rect x="55" y="20" width="210" height="120" rx="12" fill="#1c7ed6"/>
     ${[0, 1, 2, 3, 4, 5]
       .map((r) =>
         [0, 1, 2, 3, 4, 5, 6]
           .map((c) => {
             const win = c === 3 && r >= 2;
             return `<circle cx="${80 + c * 28}" cy="${40 + r * 18}" r="7" fill="${win ? "#fa5252" : "#0b2a4a"}"/>`;
           })
           .join("")
       )
       .join("")}
     <text x="160" y="155" text-anchor="middle" font-size="14" fill="#e7f5ff" opacity="0" font-family="Segoe UI,sans-serif"></text>`,
    ["#0b2a4a", "#1864ab"],
    "DROP FOUR"
  ),

  math: svg(
    `<text x="70" y="85" text-anchor="middle" font-size="56" font-weight="800" fill="#fff" font-family="Segoe UI,sans-serif">12</text>
     <text x="130" y="85" text-anchor="middle" font-size="44" font-weight="700" fill="#ffd43b" font-family="Segoe UI,sans-serif">+</text>
     <text x="185" y="85" text-anchor="middle" font-size="56" font-weight="800" fill="#fff" font-family="Segoe UI,sans-serif">7</text>
     <text x="240" y="85" text-anchor="middle" font-size="44" font-weight="700" fill="#ffd43b" font-family="Segoe UI,sans-serif">=</text>
     <text x="285" y="85" text-anchor="middle" font-size="56" font-weight="800" fill="#69db7c" font-family="Segoe UI,sans-serif">?</text>
     <rect x="90" y="105" width="140" height="10" rx="4" fill="#fff" opacity="0.25"/>`,
    ["#0b3d2e", "#2b8a3e"],
    "MATH SPRINT"
  ),

  sudoku: svg(
    `<g transform="translate(85,18)">
      <rect width="150" height="120" rx="6" fill="#f8f9fa"/>
      ${[0, 1, 2, 3]
        .map(
          (i) =>
            `<line x1="${i * 50}" y1="0" x2="${i * 50}" y2="120" stroke="#212529" stroke-width="${i % 3 === 0 ? 3 : 1}"/>`
        )
        .join("")}
      ${[0, 1, 2, 3]
        .map(
          (i) =>
            `<line x1="0" y1="${i * 40}" x2="150" y2="${i * 40}" stroke="#212529" stroke-width="${i % 3 === 0 ? 3 : 1}"/>`
        )
        .join("")}
      <text x="25" y="28" text-anchor="middle" font-size="20" fill="#212529" font-family="Segoe UI,sans-serif">5</text>
      <text x="75" y="68" text-anchor="middle" font-size="20" fill="#1c7ed6" font-family="Segoe UI,sans-serif">9</text>
      <text x="125" y="108" text-anchor="middle" font-size="20" fill="#212529" font-family="Segoe UI,sans-serif">2</text>
    </g>`,
    ["#343a40", "#868e96"],
    "SUDOKU"
  ),

  flappy: svg(
    `<circle cx="270" cy="35" r="20" fill="#e7f5ff" opacity="0.3"/>
     <path d="M15 150 V55 H60 V150" fill="#2a4566"/><path d="M15 55 L37 32 L60 55" fill="#748ffc"/>
     <path d="M250 150 V45 H300 V150" fill="#2a4566"/><path d="M250 45 L275 20 L300 45" fill="#748ffc"/>
     <ellipse cx="155" cy="95" rx="48" ry="28" fill="#74c0fc"/>
     <path d="M115 90 Q100 55 140 70 Q155 50 175 75 Z" fill="#a5d8ff"/>
     <path d="M185 85 Q230 45 215 95 Q200 90 185 92 Z" fill="#4dabf7"/>
     <circle cx="185" cy="88" r="5" fill="#0c1624"/>
     <path d="M200 95 L245 88 L202 108 Z" fill="#fbbf24"/>
     <path d="M130 115 L120 145 L150 125" fill="#fbbf24"/>`,
    ["#0c1624", "#1e4a7a"],
    "WING HOP"
  ),

  tictactoe: svg(
    `<g stroke="#fff" stroke-width="8" stroke-linecap="round">
      <line x1="125" y1="25" x2="125" y2="135"/><line x1="195" y1="25" x2="195" y2="135"/>
      <line x1="70" y1="60" x2="250" y2="60"/><line x1="70" y1="100" x2="250" y2="100"/>
      <line x1="80" y1="32" x2="110" y2="52" stroke="#74c0fc"/><line x1="110" y1="32" x2="80" y2="52" stroke="#74c0fc"/>
      <circle cx="160" cy="80" r="16" fill="none" stroke="#fbbf24" stroke-width="7"/>
      <line x1="210" y1="112" x2="240" y2="132" stroke="#74c0fc"/><line x1="240" y1="112" x2="210" y2="132" stroke="#74c0fc"/>
    </g>`,
    ["#1a1b1e", "#495057"],
    "TIC TAC TOE"
  ),

  pixletris: svg(
    `<rect x="105" y="15" width="110" height="125" rx="8" fill="#0b1026" stroke="#9775fa" stroke-width="3"/>
     <rect x="120" y="25" width="24" height="20" rx="3" fill="#cc5de8"/>
     <rect x="148" y="25" width="24" height="20" rx="3" fill="#cc5de8"/>
     <rect x="148" y="49" width="24" height="20" rx="3" fill="#cc5de8"/>
     <rect x="176" y="49" width="24" height="20" rx="3" fill="#22b8cf"/>
     <rect x="120" y="95" width="24" height="20" rx="3" fill="#51cf66"/>
     <rect x="148" y="95" width="24" height="20" rx="3" fill="#51cf66"/>
     <rect x="176" y="95" width="24" height="20" rx="3" fill="#51cf66"/>
     <rect x="120" y="119" width="24" height="16" rx="3" fill="#ff922b"/>
     <rect x="148" y="119" width="24" height="16" rx="3" fill="#ff922b"/>
     <rect x="176" y="119" width="24" height="16" rx="3" fill="#339af0"/>
     <path d="M160 75 L160 90" stroke="#ffd43b" stroke-width="3" stroke-dasharray="4 3"/>`,
    ["#12091f", "#5f3dc4"],
    "PIXEL DROP"
  ),

  clicker: svg(
    `<polygon points="160,20 190,80 255,88 205,130 220,175 160,148 100,175 115,130 65,88 130,80" fill="#74c0fc" stroke="#e7f5ff" stroke-width="3"/>
     <circle cx="160" cy="100" r="22" fill="#fff" opacity="0.35"/>
     <path d="M200 40 L230 20 L235 35 Z" fill="#ffd43b"/>
     <text x="245" y="28" font-size="20" fill="#ffd43b" font-family="Segoe UI,sans-serif">click!</text>`,
    ["#0b2a4a", "#7048e8"],
    "CRYSTAL CLICKER"
  ),

  stacker: svg(
    `<rect x="95" y="115" width="130" height="28" rx="4" fill="#ff922b"/>
     <rect x="110" y="82" width="100" height="28" rx="4" fill="#fcc419"/>
     <rect x="122" y="49" width="76" height="28" rx="4" fill="#51cf66"/>
     <rect x="145" y="16" width="90" height="28" rx="4" fill="#339af0"/>
     <text x="250" y="35" font-size="18" fill="#fff" font-family="Segoe UI,sans-serif">↑</text>`,
    ["#1a1b1e", "#343a40"],
    "TOWER STACK"
  ),

  crossy: svg(
    `<rect x="0" y="20" width="320" height="40" fill="#e03131"/>
     <text x="160" y="46" text-anchor="middle" font-size="16" fill="#fff" font-family="Segoe UI,sans-serif">LAVA</text>
     <rect x="0" y="60" width="320" height="40" fill="#74c0fc"/>
     <text x="160" y="86" text-anchor="middle" font-size="16" fill="#0b2a4a" font-family="Segoe UI,sans-serif">ICE</text>
     <rect x="0" y="100" width="320" height="40" fill="#495057"/>
     <rect x="200" y="108" width="50" height="24" rx="3" fill="#ffd43b"/>
     <text x="100" y="126" text-anchor="middle" font-size="14" fill="#fff" font-family="Segoe UI,sans-serif">CARTS</text>
     <circle cx="80" cy="78" r="14" fill="#20c997"/>
     <circle cx="80" cy="68" r="9" fill="#12b886"/>
     <text x="80" y="72" text-anchor="middle" font-size="10" fill="#fff">you</text>`,
    ["#2b2118", "#862e2e"],
    "CROSS WALK"
  ),

  fishing: svg(
    `<path d="M0 100 Q80 85 160 110 T320 100 L320 180 L0 180 Z" fill="#1c7ed6"/>
     <path d="M0 120 Q120 110 200 125 T320 115 L320 180 L0 180 Z" fill="#1864ab"/>
     <line x1="70" y1="25" x2="150" y2="85" stroke="#e9ecef" stroke-width="4"/>
     <circle cx="70" cy="25" r="7" fill="#adb5bd"/>
     <ellipse cx="200" cy="90" rx="40" ry="20" fill="#ffd43b"/>
     <polygon points="240,90 275,78 275,102" fill="#ffd43b"/>
     <circle cx="180" cy="85" r="4" fill="#212529"/>
     <text x="200" y="98" text-anchor="middle" font-size="14" fill="#5c3b00" font-family="Segoe UI,sans-serif">FISH</text>`,
    ["#0b2a4a", "#0c8599"],
    "FISHING IDLE"
  ),

  cows: svg(
    `<circle cx="80" cy="100" r="32" fill="#f8f9fa" stroke="#212529" stroke-width="3"/>
     <circle cx="70" cy="92" r="4" fill="#212529"/><circle cx="90" cy="92" r="4" fill="#212529"/>
     <text x="160" y="90" text-anchor="middle" font-size="36" fill="#ffd43b" font-family="Segoe UI,sans-serif">+</text>
     <circle cx="160" cy="100" r="32" fill="#f8f9fa" stroke="#212529" stroke-width="3"/>
     <circle cx="150" cy="92" r="4" fill="#212529"/><circle cx="170" cy="92" r="4" fill="#212529"/>
     <text x="210" y="90" text-anchor="middle" font-size="36" fill="#ffd43b" font-family="Segoe UI,sans-serif">=</text>
     <circle cx="255" cy="95" r="42" fill="#fff" stroke="#212529" stroke-width="3"/>
     <circle cx="240" cy="82" r="5" fill="#212529"/><circle cx="268" cy="82" r="5" fill="#212529"/>
     <ellipse cx="254" cy="100" rx="12" ry="8" fill="#ffc9c9"/>`,
    ["#2b8a3e", "#82c91e"],
    "COW MERGE"
  ),

  dino: svg(
    `<polygon points="160,15 300,150 20,150" fill="#1a1b1e"/>
     <polygon points="160,40 250,145 70,145" fill="#2b2118"/>
     <ellipse cx="155" cy="110" rx="34" ry="20" fill="#20c997"/>
     <circle cx="185" cy="95" r="16" fill="#12b886"/>
     <circle cx="192" cy="90" r="3" fill="#e7f5ff"/>
     <rect x="140" y="122" width="12" height="22" fill="#099268"/>
     <rect x="165" y="122" width="12" height="22" fill="#099268"/>
     <polygon points="70,150 82,95 92,150" fill="#74c0fc" opacity="0.8"/>
     <polygon points="240,150 255,90 268,150" fill="#cc5de8" opacity="0.8"/>`,
    ["#0b1026", "#343a40"],
    "RUNOSAUR"
  ),

  ramp: svg(
    `<rect x="40" y="120" width="90" height="16" rx="4" transform="rotate(-28 85 128)" fill="#ced4da"/>
     <rect x="160" y="85" width="90" height="16" rx="4" transform="rotate(-32 205 93)" fill="#adb5bd"/>
     <circle cx="100" cy="95" r="16" fill="#ff922b"/>
     <path d="M0 160 L320 160 L320 180 L0 180 Z" fill="#364fc7" opacity="0.4"/>
     <text x="250" y="50" font-size="18" fill="#fff" opacity="0.7" font-family="Segoe UI,sans-serif">void</text>`,
    ["#0b1026", "#364fc7"],
    "RAMP RUSH"
  ),

  guac: svg(
    `<ellipse cx="140" cy="95" rx="55" ry="48" fill="#82c91e"/>
     <ellipse cx="140" cy="95" rx="24" ry="20" fill="#e8590c"/>
     <ellipse cx="140" cy="95" rx="10" ry="8" fill="#5c3b00"/>
     <rect x="220" y="35" width="12" height="70" rx="3" fill="#868e96"/>
     <circle cx="226" cy="30" r="16" fill="#fab005"/>
     <text x="226" y="36" text-anchor="middle" font-size="14" fill="#5c3b00" font-family="Segoe UI,sans-serif">🔨</text>
     <text x="250" y="120" font-size="16" fill="#a9e34b" font-family="Segoe UI,sans-serif">WHACK!</text>`,
    ["#2b2118", "#5c3b00"],
    "GUAC-A-MOLE"
  ),

  bubble: svg(
    `<circle cx="90" cy="70" r="28" fill="#339af0"/><circle cx="140" cy="55" r="28" fill="#ff6b6b"/>
     <circle cx="190" cy="70" r="28" fill="#ffd43b"/><circle cx="115" cy="105" r="26" fill="#cc5de8"/>
     <circle cx="165" cy="100" r="26" fill="#51cf66"/>
     <path d="M0 140 Q160 125 320 145 L320 180 L0 180 Z" fill="#1c7ed6"/>
     <text x="250" y="40" font-size="16" fill="#fff" font-family="Segoe UI,sans-serif">POP</text>`,
    ["#0b2a4a", "#1c7ed6"],
    "BUBBLE POP"
  ),

  cafe: svg(
    `<path d="M115 50 h80 a22 22 0 0 1 0 44 h-80 z" fill="#f8f9fa"/>
     <rect x="115" y="94" width="80" height="10" fill="#e9ecef"/>
     <path d="M195 62 h22 a18 18 0 0 1 0 28 h-22" fill="none" stroke="#f8f9fa" stroke-width="8"/>
     <path d="M135 40 Q155 18 175 40" fill="none" stroke="#adb5bd" stroke-width="5"/>
     <rect x="230" y="55" width="55" height="70" rx="6" fill="#ffd43b"/>
     <text x="257" y="95" text-anchor="middle" font-size="14" fill="#5c3b00" font-family="Segoe UI,sans-serif">ORDER</text>`,
    ["#5c3b00", "#d9480f"],
    "CAFE QUEUE"
  ),

  garden: svg(
    `<rect x="0" y="120" width="320" height="60" fill="#2b8a3e"/>
     <circle cx="90" cy="95" r="28" fill="#f06595"/>
     <circle cx="70" cy="80" r="14" fill="#f06595"/><circle cx="110" cy="80" r="14" fill="#f06595"/>
     <circle cx="90" cy="95" r="10" fill="#ffd43b"/>
     <rect x="84" y="110" width="12" height="30" fill="#2f9e44"/>
     <path d="M200 50 L200 110" stroke="#4dabf7" stroke-width="6"/>
     <path d="M200 50 Q230 40 235 70" fill="none" stroke="#74c0fc" stroke-width="5"/>
     <circle cx="200" cy="115" r="14" fill="#868e96"/>
     <text x="250" y="100" font-size="14" fill="#e7f5ff" font-family="Segoe UI,sans-serif">WATER</text>`,
    ["#d8f5a2", "#82c91e"],
    "GARDEN SNAP"
  ),

  mine: svg(
    `<path d="M0 50 L100 100 L180 60 L280 120 L320 80 L320 180 L0 180 Z" fill="#495057"/>
     <path d="M0 90 L120 130 L200 95 L320 140 L320 180 L0 180 Z" fill="#343a40"/>
     <circle cx="110" cy="125" r="14" fill="#ffd43b"/>
     <circle cx="200" cy="140" r="12" fill="#74c0fc"/>
     <rect x="240" y="30" width="14" height="70" fill="#adb5bd" transform="rotate(30 247 65)"/>
     <circle cx="255" cy="28" r="14" fill="#868e96"/>
     <text x="70" y="40" font-size="16" fill="#ffd43b" font-family="Segoe UI,sans-serif">ORE</text>`,
    ["#1a1b1e", "#5c4b37"],
    "MINE DEPTH"
  ),

  blockblast: svg(
    `${[
      [50, 30, "#4dabf7"],
      [90, 30, "#4dabf7"],
      [130, 30, "#4dabf7"],
      [170, 30, "#4dabf7"],
      [210, 30, "#4dabf7"],
      [250, 30, "#4dabf7"],
      [50, 70, "#9775fa"],
      [90, 70, "#9775fa"],
      [130, 70, "#9775fa"],
      [210, 70, "#9775fa"],
      [250, 70, "#9775fa"],
      [50, 110, "#20c997"],
      [90, 110, "#20c997"],
      [130, 110, "#20c997"],
      [170, 110, "#20c997"],
      [210, 110, "#20c997"],
      [250, 110, "#20c997"]
    ]
      .map(([x, y, c]) => `<rect x="${x}" y="${y}" width="34" height="34" rx="5" fill="${c}"/>`)
      .join("")}
     <rect x="170" y="70" width="34" height="34" rx="5" fill="#ffd43b" opacity="0.9"/>
     <text x="187" y="93" text-anchor="middle" font-size="12" fill="#5c3b00" font-family="Segoe UI,sans-serif">CLEAR</text>`,
    ["#0b1026", "#1c7ed6"],
    "BLOCK SWEEP"
  ),

  lemmings: svg(
    `<rect x="30" y="125" width="260" height="18" rx="4" fill="#495057"/>
     <circle cx="90" cy="95" r="16" fill="#ffd8a8"/><rect x="80" y="110" width="20" height="22" rx="3" fill="#4dabf7"/>
     <circle cx="160" cy="88" r="16" fill="#ffd8a8"/><rect x="150" y="102" width="20" height="28" rx="3" fill="#69db7c"/>
     <circle cx="230" cy="95" r="16" fill="#ffd8a8"/><rect x="220" y="110" width="20" height="22" rx="3" fill="#ff8787"/>
     <rect x="70" y="55" width="40" height="20" rx="4" fill="#fab005"/>
     <text x="90" y="70" text-anchor="middle" font-size="11" font-weight="700" fill="#212529" font-family="Segoe UI,sans-serif">DIG</text>
     <rect x="140" y="45" width="48" height="20" rx="4" fill="#15aabf"/>
     <text x="164" y="60" text-anchor="middle" font-size="11" font-weight="700" fill="#fff" font-family="Segoe UI,sans-serif">BUILD</text>
     <rect x="210" y="55" width="48" height="20" rx="4" fill="#fa5252"/>
     <text x="234" y="70" text-anchor="middle" font-size="11" font-weight="700" fill="#fff" font-family="Segoe UI,sans-serif">BLOCK</text>`,
    ["#212529", "#5c4b37"],
    "DUDES"
  ),

  paper: svg(
    `<rect x="20" y="20" width="280" height="115" rx="8" fill="#212529"/>
     <rect x="35" y="35" width="100" height="85" fill="#339af0"/>
     <rect x="170" y="50" width="110" height="70" fill="#ff6b6b"/>
     <path d="M85 120 L85 90 L130 90 L130 60 L180 60 L180 85 L220 85" fill="none" stroke="#ffd43b" stroke-width="10" stroke-linejoin="round" stroke-linecap="round"/>
     <circle cx="85" cy="120" r="12" fill="#ffd43b" stroke="#fff" stroke-width="2"/>
     <text x="85" y="125" text-anchor="middle" font-size="10" font-weight="800" fill="#5c3b00" font-family="Segoe UI,sans-serif">YOU</text>
     <text x="200" y="40" font-size="13" fill="#fff" font-family="Segoe UI,sans-serif">claim land</text>`,
    ["#1a1b1e", "#495057"],
    "PAPER CLAIM"
  )
};

for (const [id, content] of Object.entries(arts)) {
  fs.writeFileSync(path.join(dir, `${id}.svg`), content);
}
console.log("wrote", Object.keys(arts).length, "clear thumbs");
