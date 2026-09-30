/**
 * One-shot: write hub-thumbs/*.svg game card art.
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
  wordle: svg(
    320,
    180,
    `<g transform="translate(70,42)">
      ${[0, 1, 2, 3, 4]
        .map(
          (i) =>
            `<rect x="${i * 36}" y="0" width="30" height="30" rx="5" fill="${
              i === 2 ? "#2f9e44" : i === 1 || i === 3 ? "#f1c40f" : "#868e96"
            }" opacity="0.95"/>`
        )
        .join("")}
      ${[0, 1, 2, 3, 4]
        .map(
          (i) =>
            `<rect x="${i * 36}" y="40" width="30" height="30" rx="5" fill="${
              i % 2 ? "#2f9e44" : "#868e96"
            }" opacity="0.9"/>`
        )
        .join("")}
      ${[0, 1, 2, 3, 4]
        .map(
          (i) =>
            `<rect x="${i * 36}" y="80" width="30" height="30" rx="5" fill="#4dabf7" opacity="0.85"/>`
        )
        .join("")}
    </g>`,
    ["#0b2a4a", "#1c7ed6"]
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
  breakout: svg(
    320,
    180,
    `${[0, 1, 2, 3, 4, 5]
      .map((r) =>
        [0, 1, 2, 3, 4, 5, 6]
          .map(
            (c) =>
              `<rect x="${28 + c * 38}" y="${22 + r * 16}" width="34" height="12" rx="2" fill="${
                ["#ff6b6b", "#fcc419", "#51cf66", "#339af0", "#cc5de8", "#ff922b"][r]
              }" opacity="0.95"/>`
          )
          .join("")
      )
      .join("")}
    <rect x="130" y="150" width="60" height="10" rx="4" fill="#e9ecef"/>
    <circle cx="175" cy="130" r="7" fill="#fff"/>`,
    ["#1a1b1e", "#364fc7"]
  ),
  hangman: svg(
    320,
    180,
    `<line x1="80" y1="150" x2="180" y2="150" stroke="#f8f9fa" stroke-width="6"/>
    <line x1="110" y1="150" x2="110" y2="35" stroke="#f8f9fa" stroke-width="6"/>
    <line x1="110" y1="35" x2="190" y2="35" stroke="#f8f9fa" stroke-width="6"/>
    <line x1="190" y1="35" x2="190" y2="55" stroke="#f8f9fa" stroke-width="5"/>
    <circle cx="190" cy="72" r="16" fill="none" stroke="#ffd8a8" stroke-width="5"/>
    <line x1="190" y1="88" x2="190" y2="125" stroke="#ffd8a8" stroke-width="5"/>`,
    ["#2b2118", "#e67700"]
  ),
  "2048": svg(
    320,
    180,
    `<rect x="70" y="30" width="70" height="70" rx="10" fill="#edc948"/>
    <text x="105" y="78" text-anchor="middle" font-size="28" font-weight="800" fill="#5c3b00" font-family="Segoe UI,sans-serif">8</text>
    <rect x="150" y="30" width="70" height="70" rx="10" fill="#f59563"/>
    <text x="185" y="78" text-anchor="middle" font-size="26" font-weight="800" fill="#fff" font-family="Segoe UI,sans-serif">16</text>
    <rect x="70" y="110" width="70" height="50" rx="10" fill="#f2b179"/>
    <rect x="150" y="110" width="100" height="50" rx="10" fill="#edc22e"/>
    <text x="200" y="145" text-anchor="middle" font-size="24" font-weight="800" fill="#5c3b00" font-family="Segoe UI,sans-serif">2048</text>`,
    ["#bbada0", "#8f7a66"]
  ),
  snake: svg(
    320,
    180,
    `<rect x="40" y="80" width="28" height="28" rx="6" fill="#51cf66"/>
    <rect x="72" y="80" width="28" height="28" rx="6" fill="#40c057"/>
    <rect x="104" y="80" width="28" height="28" rx="6" fill="#37b24d"/>
    <rect x="136" y="80" width="28" height="28" rx="6" fill="#2f9e44"/>
    <rect x="136" y="48" width="28" height="28" rx="6" fill="#2b8a3e"/>
    <circle cx="150" cy="55" r="3" fill="#fff"/><circle cx="158" cy="55" r="3" fill="#fff"/>
    <circle cx="230" cy="100" r="12" fill="#ff6b6b"/>`,
    ["#0b3d1e", "#087f5b"]
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
  "connect-four": svg(
    320,
    180,
    `<rect x="55" y="25" width="210" height="135" rx="12" fill="#1c7ed6"/>
    ${[0, 1, 2, 3, 4, 5]
      .map((r) =>
        [0, 1, 2, 3, 4, 5, 6]
          .map((c) => {
            const filled =
              (r > 3 && c === 3) ||
              (r === 5 && c >= 1 && c <= 3) ||
              (r === 5 && c === 5) ||
              (r === 4 && c === 5);
            const color =
              (r > 3 && c === 3) || (r === 5 && c >= 1 && c <= 3)
                ? "#fa5252"
                : (r === 5 && c === 5) || (r === 4 && c === 5)
                  ? "#ffd43b"
                  : "#0b2a4a";
            return `<circle cx="${80 + c * 28}" cy="${48 + r * 20}" r="8" fill="${
              filled ? color : "#0b2a4a"
            }"/>`;
          })
          .join("")
      )
      .join("")}`,
    ["#0b2a4a", "#1864ab"]
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
  flappy: svg(
    320,
    180,
    `<rect x="60" y="0" width="36" height="70" fill="#2f9e44"/><rect x="60" y="120" width="36" height="60" fill="#2f9e44"/>
    <rect x="210" y="0" width="36" height="50" fill="#2f9e44"/><rect x="210" y="100" width="36" height="80" fill="#2f9e44"/>
    <ellipse cx="150" cy="95" rx="22" ry="16" fill="#ffd43b"/>
    <circle cx="162" cy="90" r="4" fill="#212529"/>
    <polygon points="170,95 190,90 170,102" fill="#ff922b"/>`,
    ["#74c0fc", "#1c7ed6"]
  ),
  tictactoe: svg(
    320,
    180,
    `<g stroke="#fff" stroke-width="6" stroke-linecap="round">
      <line x1="130" y1="30" x2="130" y2="150"/><line x1="190" y1="30" x2="190" y2="150"/>
      <line x1="80" y1="70" x2="240" y2="70"/><line x1="80" y1="110" x2="240" y2="110"/>
      <line x1="95" y1="40" x2="115" y2="60" stroke="#ff6b6b"/><line x1="115" y1="40" x2="95" y2="60" stroke="#ff6b6b"/>
      <circle cx="160" cy="90" r="14" fill="none" stroke="#74c0fc"/>
      <line x1="205" y1="120" x2="225" y2="140" stroke="#ff6b6b"/><line x1="225" y1="120" x2="205" y2="140" stroke="#ff6b6b"/>
    </g>`,
    ["#1a1b1e", "#495057"]
  ),
  pixletris: svg(
    320,
    180,
    `${[
      [4, 5, "#cc5de8"],
      [5, 5, "#cc5de8"],
      [6, 5, "#cc5de8"],
      [5, 4, "#cc5de8"],
      [2, 7, "#339af0"],
      [3, 7, "#339af0"],
      [4, 7, "#339af0"],
      [7, 7, "#51cf66"],
      [8, 7, "#51cf66"],
      [2, 8, "#339af0"],
      [3, 8, "#339af0"],
      [6, 8, "#ff922b"],
      [7, 8, "#ff922b"],
      [8, 8, "#ff922b"]
    ]
      .map(
        ([x, y, c]) =>
          `<rect x="${40 + x * 24}" y="${10 + y * 16}" width="22" height="14" rx="2" fill="${c}"/>`
      )
      .join("")}`,
    ["#0b1026", "#212529"]
  ),
  clicker: svg(
    320,
    180,
    `<polygon points="160,30 185,85 245,90 200,130 215,180 160,150 105,180 120,130 75,90 135,85" fill="#74c0fc" stroke="#e7f5ff" stroke-width="3"/>
    <circle cx="160" cy="105" r="18" fill="#fff" opacity="0.35"/>`,
    ["#0b2a4a", "#7048e8"]
  ),
  stacker: svg(
    320,
    180,
    `<rect x="110" y="130" width="100" height="28" rx="4" fill="#ff922b"/>
    <rect x="118" y="98" width="84" height="28" rx="4" fill="#fcc419"/>
    <rect x="128" y="66" width="64" height="28" rx="4" fill="#51cf66"/>
    <rect x="140" y="30" width="80" height="28" rx="4" fill="#339af0" opacity="0.95"/>`,
    ["#1a1b1e", "#343a40"]
  ),
  crossy: svg(
    320,
    180,
    `<rect x="0" y="70" width="320" height="40" fill="#495057"/>
    <rect x="20" y="88" width="40" height="6" fill="#ffd43b"/><rect x="90" y="88" width="40" height="6" fill="#ffd43b"/>
    <rect x="160" y="88" width="40" height="6" fill="#ffd43b"/><rect x="230" y="88" width="40" height="6" fill="#ffd43b"/>
    <rect x="200" y="55" width="50" height="28" rx="4" fill="#fa5252"/>
    <circle cx="210" cy="85" r="6" fill="#212529"/><circle cx="240" cy="85" r="6" fill="#212529"/>
    <circle cx="100" cy="140" r="14" fill="#69db7c"/>
    <circle cx="100" cy="128" r="8" fill="#69db7c"/>`,
    ["#2b8a3e", "#087f5b"]
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
  cows: svg(
    320,
    180,
    `<ellipse cx="160" cy="115" rx="55" ry="35" fill="#f8f9fa"/>
    <circle cx="130" cy="100" r="12" fill="#212529"/><circle cx="175" cy="95" r="10" fill="#212529"/>
    <circle cx="120" cy="80" r="28" fill="#f8f9fa"/>
    <circle cx="108" cy="75" r="4" fill="#212529"/><circle cx="125" cy="75" r="4" fill="#212529"/>
    <ellipse cx="114" cy="88" rx="10" ry="7" fill="#ffc9c9"/>
    <rect x="95" y="55" width="10" height="18" rx="3" fill="#f8f9fa"/><rect x="128" y="52" width="10" height="18" rx="3" fill="#f8f9fa"/>`,
    ["#2b8a3e", "#82c91e"]
  ),
  dino: svg(
    320,
    180,
    `<path d="M0 140 L60 120 L120 145 L180 115 L240 140 L320 125 L320 180 L0 180 Z" fill="#5c4b37"/>
    <ellipse cx="140" cy="110" rx="40" ry="22" fill="#82c91e"/>
    <circle cx="175" cy="95" r="16" fill="#82c91e"/>
    <circle cx="182" cy="90" r="3" fill="#212529"/>
    <rect x="110" y="125" width="10" height="25" fill="#82c91e"/><rect x="145" y="125" width="10" height="25" fill="#82c91e"/>`,
    ["#212529", "#495057"]
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
    <circle cx="250" cy="55" r="14" fill="#94d82d" opacity="0.7"/>`,
    ["#2b2118", "#5c3b00"]
  ),
  bubble: svg(
    320,
    180,
    `<circle cx="90" cy="110" r="28" fill="#339af0"/><circle cx="140" cy="90" r="28" fill="#ff6b6b"/>
    <circle cx="190" cy="110" r="28" fill="#339af0"/><circle cx="115" cy="60" r="24" fill="#ffd43b"/>
    <circle cx="165" cy="55" r="24" fill="#cc5de8"/><circle cx="240" cy="80" r="22" fill="#51cf66"/>
    <circle cx="80" cy="70" r="8" fill="#fff" opacity="0.35"/>`,
    ["#0b2a4a", "#1c7ed6"]
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
  blockblast: svg(
    320,
    180,
    `${[
      [1, 1, "#339af0"],
      [2, 1, "#339af0"],
      [3, 1, "#339af0"],
      [1, 2, "#339af0"],
      [3, 2, "#339af0"],
      [1, 3, "#339af0"],
      [2, 3, "#339af0"],
      [3, 3, "#339af0"],
      [5, 2, "#ff6b6b"],
      [6, 2, "#ff6b6b"],
      [5, 3, "#ff6b6b"],
      [6, 3, "#ff6b6b"],
      [6, 4, "#ff6b6b"],
      [2, 5, "#51cf66"],
      [3, 5, "#51cf66"],
      [4, 5, "#51cf66"]
    ]
      .map(
        ([x, y, c]) =>
          `<rect x="${40 + x * 30}" y="${20 + y * 26}" width="26" height="22" rx="3" fill="${c}"/>`
      )
      .join("")}`,
    ["#0b1026", "#1c7ed6"]
  ),
  lemmings: svg(
    320,
    180,
    `<rect x="40" y="120" width="240" height="20" fill="#868e96"/>
    <circle cx="100" cy="100" r="14" fill="#ffd43b"/><rect x="93" y="112" width="14" height="20" fill="#339af0"/>
    <circle cx="150" cy="95" r="14" fill="#ffd43b"/><rect x="143" y="107" width="14" height="25" fill="#51cf66"/>
    <circle cx="200" cy="100" r="14" fill="#ffd43b"/><rect x="193" y="112" width="14" height="20" fill="#ff6b6b"/>
    <polygon points="100,80 110,88 90,88" fill="#e67700"/>`,
    ["#2b2118", "#e67700"]
  ),
  paper: svg(
    320,
    180,
    `<rect x="40" y="40" width="100" height="80" fill="#339af0" opacity="0.85"/>
    <rect x="160" y="70" width="110" height="70" fill="#ff6b6b" opacity="0.85"/>
    <path d="M140 80 L190 50 L210 95 L160 110 Z" fill="#51cf66"/>
    <circle cx="120" cy="130" r="8" fill="#ffd43b"/>
    <path d="M120 130 L150 100" stroke="#ffd43b" stroke-width="4" fill="none"/>`,
    ["#f8f9fa", "#adb5bd"]
  )
};

for (const [id, content] of Object.entries(arts)) {
  fs.writeFileSync(path.join(dir, `${id}.svg`), content);
}
console.log("wrote", Object.keys(arts).length, "thumbs to", dir);
