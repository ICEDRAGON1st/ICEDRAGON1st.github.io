/**
 * One-shot: write hub-thumbs/*.svg game card art.
 * Art should match OUR branded games — avoid classic clone silhouettes
 * (Flappy pipes+bird, Chrome dino, Wordle green/yellow grid, etc.).
 * Run: node tools/gen-hub-thumbs.js
 */
const fs = require("fs");
const path = require("path");

const dir = path.join(__dirname, "..", "hub-thumbs");
fs.mkdirSync(dir, { recursive: true });

function svg(w, h, body, bg) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" role="img" aria-hidden="true">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${bg[0]}"/>
      <stop offset="100%" stop-color="${bg[1]}"/>
    </linearGradient>
  </defs>
  <rect width="${w}" height="${h}" fill="url(#g)"/>
  ${body}
</svg>`;
}

const arts = {
  // Guessword — melting ice letter tiles (not Wordle green/yellow)
  wordle: svg(
    320,
    180,
    `<g transform="translate(55,48)">
      ${[0, 1, 2, 3, 4]
        .map(
          (i) =>
            `<rect x="${i * 42}" y="0" width="36" height="36" rx="8" fill="#e7f5ff" opacity="0.92" stroke="#74c0fc" stroke-width="2"/>
             <path d="M${i * 42 + 6} 34 Q${i * 42 + 18} 44 ${i * 42 + 30} 34" fill="#4dabf7" opacity="0.55"/>`
        )
        .join("")}
      ${[0, 1, 2, 3, 4]
        .map(
          (i) =>
            `<rect x="${i * 42}" y="52" width="36" height="36" rx="8" fill="${
              i === 2 ? "#a5d8ff" : "#d0ebff"
            }" opacity="0.9" stroke="#1c7ed6" stroke-width="2"/>`
        )
        .join("")}
      <text x="18" y="26" text-anchor="middle" font-size="16" font-weight="800" fill="#0b2a4a" font-family="Segoe UI,sans-serif">I</text>
      <text x="102" y="26" text-anchor="middle" font-size="16" font-weight="800" fill="#0b2a4a" font-family="Segoe UI,sans-serif">C</text>
      <text x="144" y="26" text-anchor="middle" font-size="16" font-weight="800" fill="#0b2a4a" font-family="Segoe UI,sans-serif">E</text>
    </g>
    <circle cx="280" cy="40" r="18" fill="#fff" opacity="0.25"/>`,
    ["#0b2a4a", "#1864ab"]
  ),

  space: svg(
    320,
    180,
    `<circle cx="40" cy="36" r="2" fill="#fff"/><circle cx="90" cy="58" r="1.5" fill="#fff"/>
    <circle cx="250" cy="30" r="2" fill="#fff"/><circle cx="280" cy="70" r="1.5" fill="#fff"/>
    <circle cx="60" cy="120" r="1.5" fill="#fff"/><circle cx="200" cy="140" r="2" fill="#fff"/>
    <ellipse cx="160" cy="100" rx="28" ry="14" fill="#74c0fc"/>
    <polygon points="160,55 175,100 145,100" fill="#e7f5ff"/>
    <rect x="152" y="100" width="16" height="28" rx="3" fill="#ff922b"/>
    <circle cx="260" cy="120" r="18" fill="#ff6b6b" opacity="0.85"/>`,
    ["#0b1026", "#5f3dc4"]
  ),

  quiz: svg(
    320,
    180,
    `<circle cx="160" cy="88" r="48" fill="#fff" opacity="0.12"/>
    <text x="160" y="108" text-anchor="middle" font-size="72" font-family="Georgia, serif" font-weight="700" fill="#fff">?</text>
    <circle cx="70" cy="50" r="10" fill="#ffd43b" opacity="0.9"/>
    <circle cx="250" cy="130" r="8" fill="#69db7c" opacity="0.9"/>`,
    ["#5c2d91", "#ae3ec9"]
  ),

  // Bounce Break — neon orb + shattered crystal bricks (not classic brick rows)
  breakout: svg(
    320,
    180,
    `${[
      [40, 30, "#74c0fc"],
      [95, 22, "#a5d8ff"],
      [150, 34, "#4dabf7"],
      [210, 26, "#91a7ff"],
      [265, 36, "#748ffc"],
      [55, 70, "#9775fa"],
      [120, 62, "#b197fc"],
      [185, 74, "#da77f2"],
      [250, 66, "#e599f7"]
    ]
      .map(
        ([x, y, c]) =>
          `<polygon points="${x},${y} ${x + 28},${y + 6} ${x + 22},${y + 28} ${x - 4},${y + 22}" fill="${c}" opacity="0.92"/>`
      )
      .join("")}
    <circle cx="160" cy="130" r="12" fill="#fff"/>
    <circle cx="160" cy="130" r="6" fill="#ff922b"/>
    <rect x="120" y="158" width="80" height="10" rx="5" fill="#e7f5ff" opacity="0.9"/>`,
    ["#0b1026", "#364fc7"]
  ),

  // Hangman — frosty gallows + ice figure
  hangman: svg(
    320,
    180,
    `<line x1="80" y1="150" x2="180" y2="150" stroke="#a5d8ff" stroke-width="6"/>
    <line x1="110" y1="150" x2="110" y2="35" stroke="#a5d8ff" stroke-width="6"/>
    <line x1="110" y1="35" x2="190" y2="35" stroke="#a5d8ff" stroke-width="6"/>
    <line x1="190" y1="35" x2="190" y2="55" stroke="#74c0fc" stroke-width="5"/>
    <circle cx="190" cy="72" r="16" fill="none" stroke="#e7f5ff" stroke-width="5"/>
    <line x1="190" y1="88" x2="190" y2="125" stroke="#e7f5ff" stroke-width="5"/>
    <text x="240" y="100" font-size="28" fill="#fff" opacity="0.35" font-family="Segoe UI,sans-serif">_ _ _</text>`,
    ["#0b2a4a", "#1c7ed6"]
  ),

  // Block Merge — ice crystal tiles merging (no "2048" branding)
  "2048": svg(
    320,
    180,
    `<rect x="48" y="40" width="70" height="70" rx="14" fill="#a5d8ff"/>
    <rect x="125" y="40" width="70" height="70" rx="14" fill="#74c0fc"/>
    <rect x="202" y="40" width="70" height="70" rx="14" fill="#4dabf7"/>
    <path d="M95 75 L125 75" stroke="#e7f5ff" stroke-width="5" stroke-linecap="round"/>
    <path d="M172 75 L202 75" stroke="#e7f5ff" stroke-width="5" stroke-linecap="round"/>
    <rect x="125" y="120" width="70" height="40" rx="12" fill="#228be6"/>
    <circle cx="160" cy="140" r="10" fill="#e7f5ff" opacity="0.85"/>
    <text x="83" y="85" text-anchor="middle" font-size="22" font-weight="800" fill="#0b2a4a" font-family="Segoe UI,sans-serif">◆</text>
    <text x="160" y="85" text-anchor="middle" font-size="22" font-weight="800" fill="#0b2a4a" font-family="Segoe UI,sans-serif">◆◆</text>`,
    ["#0b2a4a", "#3b5bdb"]
  ),

  // Snake — neon ribbon (not classic green squares)
  snake: svg(
    320,
    180,
    `<path d="M40 120 C80 40, 120 160, 160 70 S240 40, 280 110" fill="none" stroke="#20c997" stroke-width="18" stroke-linecap="round"/>
    <path d="M40 120 C80 40, 120 160, 160 70 S240 40, 280 110" fill="none" stroke="#96f2d7" stroke-width="8" stroke-linecap="round"/>
    <circle cx="280" cy="110" r="14" fill="#12b886"/>
    <circle cx="286" cy="106" r="3" fill="#fff"/>
    <circle cx="70" cy="50" r="10" fill="#ff6b6b"/>
    <circle cx="70" cy="50" r="4" fill="#fff" opacity="0.5"/>`,
    ["#0b1026", "#087f5b"]
  ),

  memory: svg(
    320,
    180,
    `<rect x="50" y="40" width="60" height="80" rx="8" fill="#4c6ef5"/>
    <rect x="130" y="40" width="60" height="80" rx="8" fill="#ffd43b"/>
    <text x="160" y="95" text-anchor="middle" font-size="36" fill="#5c3b00">★</text>
    <rect x="210" y="40" width="60" height="80" rx="8" fill="#4c6ef5"/>
    <circle cx="80" cy="80" r="10" fill="#fff" opacity="0.25"/>
    <circle cx="240" cy="80" r="10" fill="#fff" opacity="0.25"/>`,
    ["#1b2a4a", "#3b5bdb"]
  ),

  // Drop Four — icy lattice + glowing chips
  "connect-four": svg(
    320,
    180,
    `<rect x="55" y="25" width="210" height="135" rx="16" fill="#152238" stroke="#4dabf7" stroke-width="3"/>
    ${[0, 1, 2, 3, 4, 5]
      .map((r) =>
        [0, 1, 2, 3, 4, 5, 6]
          .map((c) => {
            const lit = (r === 5 && c >= 2 && c <= 4) || (r === 4 && c === 3) || (r === 3 && c === 3);
            const color = lit ? (c === 5 || c === 1 ? "#ffd43b" : "#74c0fc") : "#0b2a4a";
            return `<circle cx="${80 + c * 28}" cy="${48 + r * 20}" r="8" fill="${color}" stroke="#1c7ed6" stroke-width="1"/>`;
          })
          .join("")
      )
      .join("")}`,
    ["#0c1624", "#1c7ed6"]
  ),

  math: svg(
    320,
    180,
    `<text x="90" y="100" text-anchor="middle" font-size="54" font-weight="800" fill="#fff" font-family="Segoe UI,sans-serif">7</text>
    <text x="160" y="100" text-anchor="middle" font-size="48" font-weight="700" fill="#ffd43b" font-family="Segoe UI,sans-serif">×</text>
    <text x="230" y="100" text-anchor="middle" font-size="54" font-weight="800" fill="#fff" font-family="Segoe UI,sans-serif">8</text>
    <rect x="100" y="120" width="120" height="8" rx="4" fill="#fff" opacity="0.35"/>`,
    ["#0b3d2e", "#2b8a3e"]
  ),

  sudoku: svg(
    320,
    180,
    `<g transform="translate(95,25)">
      <rect width="130" height="130" rx="6" fill="#f8f9fa"/>
      ${[0, 1, 2, 3]
        .map(
          (i) =>
            `<line x1="${i * 43.3}" y1="0" x2="${i * 43.3}" y2="130" stroke="#212529" stroke-width="${
              i % 3 === 0 ? 3 : 1
            }"/>`
        )
        .join("")}
      ${[0, 1, 2, 3]
        .map(
          (i) =>
            `<line x1="0" y1="${i * 43.3}" x2="130" y2="${i * 43.3}" stroke="#212529" stroke-width="${
              i % 3 === 0 ? 3 : 1
            }"/>`
        )
        .join("")}
      <text x="22" y="30" font-size="18" fill="#212529" font-family="Segoe UI,sans-serif">5</text>
      <text x="65" y="74" font-size="18" fill="#1c7ed6" font-family="Segoe UI,sans-serif">9</text>
      <text x="108" y="118" font-size="18" fill="#212529" font-family="Segoe UI,sans-serif">2</text>
    </g>`,
    ["#343a40", "#868e96"]
  ),

  // Wing Hop — night sky, big ice dragon, castle silhouette (NOT pipe+bird layout)
  flappy: svg(
    320,
    180,
    `<circle cx="260" cy="42" r="22" fill="#e7f5ff" opacity="0.35"/>
    <circle cx="50" cy="40" r="2" fill="#fff"/><circle cx="90" cy="70" r="1.5" fill="#fff"/>
    <circle cx="200" cy="30" r="1.5" fill="#fff"/><circle cx="300" cy="90" r="2" fill="#fff"/>
    <path d="M0 150 L40 120 L70 150 L110 100 L150 150 L200 115 L250 150 L290 125 L320 150 L320 180 L0 180 Z" fill="#152238"/>
    <path d="M20 150 V70 H55 V150 Z" fill="#2a4566"/>
    <path d="M20 70 L37 48 L55 70 Z" fill="#3b5bdb"/>
    <path d="M250 150 V55 H295 V150 Z" fill="#2a4566"/>
    <path d="M250 55 L272 30 L295 55 Z" fill="#3b5bdb"/>
    <path d="M95 110 C110 70, 150 55, 190 75 C210 85, 230 80, 245 70 C220 95, 210 115, 185 125 C150 140, 115 135, 95 110 Z" fill="#74c0fc"/>
    <path d="M120 95 C135 75, 160 78, 175 95" fill="#a5d8ff"/>
    <path d="M210 78 C230 55, 255 60, 245 85" fill="#4dabf7"/>
    <circle cx="205" cy="88" r="4" fill="#0c1624"/>
    <path d="M220 92 L250 85 L222 102 Z" fill="#fbbf24"/>
    <path d="M140 120 L130 145 L150 130 Z" fill="#fbbf24" opacity="0.8"/>`,
    ["#0c1624", "#1e4a7a"]
  ),

  tictactoe: svg(
    320,
    180,
    `<g stroke="#a5d8ff" stroke-width="6" stroke-linecap="round">
      <line x1="130" y1="30" x2="130" y2="150"/><line x1="190" y1="30" x2="190" y2="150"/>
      <line x1="80" y1="70" x2="240" y2="70"/><line x1="80" y1="110" x2="240" y2="110"/>
      <line x1="95" y1="40" x2="115" y2="60" stroke="#74c0fc"/><line x1="115" y1="40" x2="95" y2="60" stroke="#74c0fc"/>
      <circle cx="160" cy="90" r="14" fill="none" stroke="#fbbf24"/>
      <line x1="205" y1="120" x2="225" y2="140" stroke="#74c0fc"/><line x1="225" y1="120" x2="205" y2="140" stroke="#74c0fc"/>
    </g>`,
    ["#0c1624", "#2a4566"]
  ),

  // Pixel Drop — neon tetromino rain / glow board (not classic Tetris playfield)
  pixletris: svg(
    320,
    180,
    `<rect x="100" y="20" width="120" height="140" rx="10" fill="#0b1026" stroke="#7048e8" stroke-width="3"/>
    ${[
      [110, 35, "#cc5de8"],
      [135, 35, "#cc5de8"],
      [160, 35, "#22b8cf"],
      [185, 35, "#22b8cf"],
      [135, 58, "#cc5de8"],
      [160, 58, "#51cf66"],
      [110, 81, "#ff922b"],
      [135, 81, "#ff922b"],
      [160, 81, "#51cf66"],
      [185, 81, "#339af0"],
      [160, 104, "#51cf66"],
      [185, 104, "#339af0"],
      [110, 127, "#fa5252"],
      [135, 127, "#fa5252"],
      [160, 127, "#fa5252"],
      [185, 127, "#339af0"]
    ]
      .map(
        ([x, y, c]) =>
          `<rect x="${x}" y="${y}" width="20" height="18" rx="3" fill="${c}" opacity="0.95"/>`
      )
      .join("")}
    <circle cx="60" cy="50" r="6" fill="#cc5de8" opacity="0.7"/>
    <circle cx="270" cy="90" r="8" fill="#22b8cf" opacity="0.7"/>`,
    ["#12091f", "#5f3dc4"]
  ),

  clicker: svg(
    320,
    180,
    `<polygon points="160,30 185,85 245,90 200,130 215,180 160,150 105,180 120,130 75,90 135,85" fill="#74c0fc" stroke="#e7f5ff" stroke-width="3"/>
    <circle cx="160" cy="105" r="18" fill="#fff" opacity="0.35"/>`,
    ["#0b2a4a", "#7048e8"]
  ),

  // Tower Stack 3D — perspective slabs
  stacker: svg(
    320,
    180,
    `<polygon points="110,150 210,150 230,165 90,165" fill="#ff922b"/>
    <polygon points="120,120 200,120 210,150 110,150" fill="#fcc419"/>
    <polygon points="130,90 190,90 200,120 120,120" fill="#51cf66"/>
    <polygon points="145,55 205,45 190,90 130,90" fill="#339af0"/>
    <polygon points="145,55 165,40 225,30 205,45" fill="#74c0fc" opacity="0.9"/>`,
    ["#0b1026", "#343a40"]
  ),

  // Cross Walk — lava / ice / carts (not Crossy Road chicken+road)
  crossy: svg(
    320,
    180,
    `<rect x="0" y="0" width="320" height="55" fill="#1c7ed6" opacity="0.35"/>
    <rect x="0" y="55" width="320" height="50" fill="#e03131"/>
    <path d="M0 70 Q40 55 80 70 T160 70 T240 70 T320 70 L320 95 L0 95 Z" fill="#fa5252"/>
    <rect x="0" y="105" width="320" height="40" fill="#a5d8ff"/>
    <rect x="30" y="112" width="50" height="18" rx="4" fill="#e7f5ff"/>
    <rect x="120" y="118" width="60" height="16" rx="4" fill="#e7f5ff"/>
    <rect x="0" y="145" width="320" height="35" fill="#495057"/>
    <rect x="200" y="148" width="55" height="24" rx="4" fill="#ffd43b"/>
    <circle cx="210" cy="172" r="5" fill="#212529"/><circle cx="245" cy="172" r="5" fill="#212529"/>
    <circle cx="90" cy="130" r="12" fill="#20c997"/>
    <circle cx="90" cy="120" r="8" fill="#12b886"/>`,
    ["#2b2118", "#862e2e"]
  ),

  fishing: svg(
    320,
    180,
    `<path d="M0 110 Q80 90 160 115 T320 105 L320 180 L0 180 Z" fill="#1c7ed6" opacity="0.85"/>
    <path d="M0 125 Q100 115 180 130 T320 120 L320 180 L0 180 Z" fill="#1864ab"/>
    <ellipse cx="210" cy="95" rx="34" ry="16" fill="#ffd43b"/>
    <polygon points="244,95 270,85 270,105" fill="#ffd43b"/>
    <circle cx="190" cy="90" r="3" fill="#212529"/>
    <line x1="80" y1="30" x2="160" y2="90" stroke="#e9ecef" stroke-width="3"/>
    <circle cx="80" cy="30" r="5" fill="#adb5bd"/>`,
    ["#0b2a4a", "#0c8599"]
  ),

  // Cow Merge — evolving merge orbs (Suika-like mechanic, our cows)
  cows: svg(
    320,
    180,
    `<circle cx="90" cy="120" r="28" fill="#f8f9fa" stroke="#212529" stroke-width="2"/>
    <circle cx="82" cy="112" r="3" fill="#212529"/><circle cx="98" cy="112" r="3" fill="#212529"/>
    <circle cx="160" cy="100" r="40" fill="#e9ecef" stroke="#212529" stroke-width="2"/>
    <circle cx="148" cy="90" r="4" fill="#212529"/><circle cx="170" cy="90" r="4" fill="#212529"/>
    <ellipse cx="159" cy="105" rx="10" ry="7" fill="#ffc9c9"/>
    <circle cx="245" cy="70" r="48" fill="#fff" stroke="#212529" stroke-width="2"/>
    <circle cx="230" cy="58" r="5" fill="#212529"/><circle cx="258" cy="58" r="5" fill="#212529"/>
    <path d="M118 120 L130 110" stroke="#ffd43b" stroke-width="4" stroke-linecap="round"/>
    <path d="M200 85 L212 75" stroke="#ffd43b" stroke-width="4" stroke-linecap="round"/>`,
    ["#2b8a3e", "#d8f5a2"]
  ),

  // Runosaur — 3D cave tunnel + crystal raptor (not Chrome dino side-scroller)
  dino: svg(
    320,
    180,
    `<polygon points="160,20 300,160 20,160" fill="#1a1b1e"/>
    <polygon points="160,40 260,150 60,150" fill="#2b2118"/>
    <polygon points="160,55 220,140 100,140" fill="#343a40"/>
    <rect x="148" y="100" width="24" height="40" rx="4" fill="#20c997"/>
    <ellipse cx="160" cy="95" rx="22" ry="14" fill="#12b886"/>
    <polygon points="175,90 205,78 178,102" fill="#38d9a9"/>
    <circle cx="172" cy="90" r="3" fill="#e7f5ff"/>
    <polygon points="70,150 85,95 95,150" fill="#74c0fc" opacity="0.7"/>
    <polygon points="230,150 245,85 258,150" fill="#cc5de8" opacity="0.7"/>`,
    ["#0b1026", "#212529"]
  ),

  ramp: svg(
    320,
    180,
    `<path d="M0 160 L80 120 L160 145 L240 90 L320 130 L320 180 L0 180 Z" fill="#364fc7" opacity="0.5"/>
    <rect x="70" y="118" width="70" height="14" rx="3" transform="rotate(-25 105 125)" fill="#adb5bd"/>
    <rect x="200" y="95" width="70" height="14" rx="3" transform="rotate(-35 235 102)" fill="#ced4da"/>
    <circle cx="150" cy="70" r="14" fill="#ff922b"/>`,
    ["#0b1026", "#364fc7"]
  ),

  guac: svg(
    320,
    180,
    `<ellipse cx="160" cy="100" rx="50" ry="42" fill="#82c91e"/>
    <ellipse cx="160" cy="100" rx="22" ry="18" fill="#e8590c"/>
    <ellipse cx="160" cy="100" rx="10" ry="8" fill="#5c3b00"/>
    <path d="M145 58 Q160 40 175 58" fill="none" stroke="#2b8a3e" stroke-width="6"/>
    <circle cx="70" cy="130" r="18" fill="#a9e34b" opacity="0.8"/>
    <circle cx="250" cy="55" r="14" fill="#94d82d" opacity="0.7"/>
    <rect x="250" y="20" width="8" height="40" rx="2" fill="#868e96"/>
    <circle cx="254" cy="20" r="10" fill="#fab005"/>`,
    ["#2b2118", "#5c3b00"]
  ),

  // Bubble Pop Relay — clusters + rising tide line
  bubble: svg(
    320,
    180,
    `<circle cx="90" cy="70" r="24" fill="#339af0"/><circle cx="130" cy="55" r="24" fill="#ff6b6b"/>
    <circle cx="170" cy="70" r="24" fill="#339af0"/><circle cx="110" cy="100" r="22" fill="#ffd43b"/>
    <circle cx="150" cy="95" r="22" fill="#cc5de8"/><circle cx="210" cy="60" r="20" fill="#51cf66"/>
    <path d="M0 145 Q80 130 160 150 T320 140 L320 180 L0 180 Z" fill="#1c7ed6" opacity="0.85"/>
    <path d="M0 155 Q100 145 200 158 T320 150 L320 180 L0 180 Z" fill="#1864ab"/>
    <text x="250" y="40" font-size="14" fill="#e7f5ff" opacity="0.7" font-family="Segoe UI,sans-serif">tide ↑</text>`,
    ["#0b2a4a", "#0c8599"]
  ),

  cafe: svg(
    320,
    180,
    `<ellipse cx="160" cy="130" rx="55" ry="18" fill="#fff" opacity="0.2"/>
    <path d="M120 60 h70 a18 18 0 0 1 0 36 h-70 z" fill="#f8f9fa"/>
    <rect x="120" y="96" width="70" height="8" fill="#e9ecef"/>
    <path d="M190 70 h18 a14 14 0 0 1 0 24 h-18" fill="none" stroke="#f8f9fa" stroke-width="6"/>
    <path d="M135 50 Q150 30 165 50" fill="none" stroke="#adb5bd" stroke-width="4" opacity="0.8"/>`,
    ["#5c3b00", "#d9480f"]
  ),

  garden: svg(
    320,
    180,
    `<rect x="0" y="130" width="320" height="50" fill="#2b8a3e"/>
    <circle cx="90" cy="110" r="22" fill="#f06595"/><circle cx="78" cy="95" r="12" fill="#f06595"/><circle cx="102" cy="95" r="12" fill="#f06595"/>
    <circle cx="90" cy="110" r="8" fill="#ffd43b"/>
    <rect x="86" y="120" width="8" height="25" fill="#2f9e44"/>
    <circle cx="200" cy="100" r="18" fill="#ff6b6b"/><circle cx="230" cy="115" r="16" fill="#fab005"/>
    <rect x="196" y="115" width="6" height="20" fill="#2f9e44"/><rect x="226" y="128" width="6" height="15" fill="#2f9e44"/>`,
    ["#d8f5a2", "#82c91e"]
  ),

  mine: svg(
    320,
    180,
    `<path d="M0 40 L80 90 L160 50 L240 110 L320 60 L320 180 L0 180 Z" fill="#495057"/>
    <path d="M0 80 L100 120 L180 85 L280 140 L320 100 L320 180 L0 180 Z" fill="#343a40"/>
    <circle cx="120" cy="130" r="10" fill="#ffd43b"/><circle cx="200" cy="145" r="8" fill="#74c0fc"/>
    <rect x="250" y="40" width="12" height="50" fill="#adb5bd" transform="rotate(25 256 65)"/>
    <circle cx="258" cy="38" r="10" fill="#868e96"/>`,
    ["#1a1b1e", "#5c4b37"]
  ),

  // Block Sweep — clearing a full row/column glow (not Block Blast logo style)
  blockblast: svg(
    320,
    180,
    `${[
      [50, 40],
      [85, 40],
      [120, 40],
      [155, 40],
      [190, 40],
      [225, 40],
      [50, 75],
      [85, 75],
      [120, 75],
      [190, 75],
      [225, 75],
      [50, 110],
      [85, 110],
      [120, 110],
      [155, 110],
      [190, 110],
      [225, 110]
    ]
      .map(
        ([x, y], i) =>
          `<rect x="${x}" y="${y}" width="28" height="28" rx="5" fill="${
            y === 75 && x === 155 ? "transparent" : i % 3 === 0 ? "#4dabf7" : i % 3 === 1 ? "#9775fa" : "#20c997"
          }" opacity="0.9"/>`
      )
      .join("")}
    <rect x="155" y="40" width="28" height="98" rx="6" fill="#ffd43b" opacity="0.55"/>
    <rect x="50" y="75" width="203" height="28" rx="6" fill="#ffd43b" opacity="0.35"/>`,
    ["#0b1026", "#1c7ed6"]
  ),

  // Dudes — crew with skill badges (dig / build / block)
  lemmings: svg(
    320,
    180,
    `<rect x="30" y="130" width="260" height="20" rx="4" fill="#495057"/>
    <circle cx="90" cy="95" r="16" fill="#ffd8a8"/><rect x="80" y="110" width="20" height="24" rx="4" fill="#4dabf7"/>
    <circle cx="160" cy="88" r="16" fill="#ffd8a8"/><rect x="150" y="103" width="20" height="30" rx="4" fill="#69db7c"/>
    <circle cx="230" cy="95" r="16" fill="#ffd8a8"/><rect x="220" y="110" width="20" height="24" rx="4" fill="#ff8787"/>
    <rect x="78" y="58" width="24" height="18" rx="4" fill="#FAB005"/><text x="90" y="71" text-anchor="middle" font-size="11" fill="#212529" font-family="Segoe UI,sans-serif">DIG</text>
    <rect x="148" y="48" width="28" height="18" rx="4" fill="#15AABF"/><text x="162" y="61" text-anchor="middle" font-size="10" fill="#fff" font-family="Segoe UI,sans-serif">BUILD</text>
    <rect x="218" y="58" width="28" height="18" rx="4" fill="#FA5252"/><text x="232" y="71" text-anchor="middle" font-size="10" fill="#fff" font-family="Segoe UI,sans-serif">BLOCK</text>`,
    ["#212529", "#5c4b37"]
  ),

  // Paper Claim — glowing claim trail (not paper.io squares)
  paper: svg(
    320,
    180,
    `<rect x="30" y="40" width="110" height="90" rx="8" fill="#339af0" opacity="0.55"/>
    <rect x="180" y="70" width="110" height="80" rx="8" fill="#ff6b6b" opacity="0.55"/>
    <path d="M90 150 C100 120, 130 100, 160 95 C190 90, 210 70, 230 55" fill="none" stroke="#ffd43b" stroke-width="6" stroke-linecap="round"/>
    <circle cx="90" cy="150" r="10" fill="#ffd43b"/>
    <circle cx="230" cy="55" r="8" fill="#fff"/>
    <path d="M140 60 L175 45 L190 80 L155 95 Z" fill="#51cf66" opacity="0.9"/>`,
    ["#f1f3f5", "#868e96"]
  )
};

for (const [id, content] of Object.entries(arts)) {
  fs.writeFileSync(path.join(dir, `${id}.svg`), content);
}
console.log("wrote", Object.keys(arts).length, "thumbs to", dir);
