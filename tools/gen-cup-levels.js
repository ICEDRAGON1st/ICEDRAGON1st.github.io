/**
 * 100 Cup Flow levels — each blueprint looks different; difficulty ramps hard.
 * Water must ride shelves (no free fall into cup). Tight ink.
 */
const fs = require("fs");
const path = require("path");

const COUNT = 100;

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}
function lerp(a, b, t) {
  return a + (b - a) * t;
}
function strokeLength(pts) {
  let len = 0;
  for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  return len;
}
function densify(pts, step = 0.02) {
  const out = [{ ...pts[0] }];
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    const dist = Math.hypot(b.x - a.x, b.y - a.y);
    const n = Math.max(1, Math.ceil(dist / step));
    for (let k = 1; k <= n; k++) {
      const t = k / n;
      out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
    }
  }
  return out;
}
function R(n, p = 3) {
  const m = 10 ** p;
  return Math.round(n * m) / m;
}
function box(x, y, w, h) {
  return { x: R(x), y: R(y), w: R(w), h: R(Math.max(h, 0.05)) };
}

function insideBlock(p, b, pad = 0) {
  if (p.y <= b.y + 0.008) return false;
  return p.x > b.x - pad && p.x < b.x + b.w + pad && p.y < b.y + b.h + pad;
}
function pathThroughBlock(pts, b, pad = 0.03) {
  return pts.some((p) => insideBlock(p, b, pad));
}
function freeWin(tap, cup, blocks) {
  for (let y = tap.y + 0.02; y < 1; y += 0.008) {
    const p = { x: tap.x, y };
    let blocked = false;
    for (const b of blocks || []) {
      if (p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h) {
        blocked = true;
        break;
      }
    }
    if (blocked) return false;
    if (p.x >= cup.x && p.x <= cup.x + cup.w && p.y >= cup.y && p.y <= cup.y + cup.h) return true;
  }
  return false;
}

function uniqueName(i) {
  const A = [
    "Dawn", "Mist", "Ridge", "Cove", "Pike", "Glen", "Forge", "Drift", "Haven", "Bloom",
    "Spark", "Cliff", "Marsh", "Dune", "Frost", "Ember", "Tide", "Oak", "Pine", "Ash",
    "Nova", "Jade", "Quartz", "Amber", "Ivory"
  ];
  const B = [
    "Sip", "Pour", "Gutter", "Chute", "Rail", "Shelf", "Bend", "Gate", "Wall", "Bridge",
    "Slide", "Drop", "Lane", "Hook", "Turn", "Ramp", "Well", "Spout", "Trough", "Flume",
    "Vault", "Sill", "Ledge", "Run", "Pass"
  ];
  return `${A[i % A.length]} ${B[(i * 3 + Math.floor(i / 7)) % B.length]}`.slice(0, 16);
}

function difficulty(i) {
  return i / (COUNT - 1);
}

function dedupe(blocks) {
  const out = [];
  for (const b of blocks) {
    if (out.some((c) => Math.abs(c.x - b.x) < 0.02 && Math.abs(c.y - b.y) < 0.02 && Math.abs(c.w - b.w) < 0.03)) {
      continue;
    }
    out.push(b);
  }
  return out;
}

/**
 * 25 distinct silhouettes. Each level picks blueprint = index % 25 with
 * band-based extras so repeats still look different and harder.
 */
function blueprint(index, tap, cup, flip, d) {
  const bp = index % 25;
  const band = Math.floor(index / 10);
  const j = (index % 7) * 0.012;
  const blocks = [];

  // Roof always covers tap — water cannot free-fall
  const roofW = lerp(0.36, 0.52, d);
  const roofY = 0.24 + (index % 4) * 0.01;
  const roof = box(
    clamp(tap.x - roofW * (flip ? 0.3 : 0.6), 0.03, 0.6),
    roofY,
    roofW,
    0.055
  );
  if (tap.x < roof.x) roof.x = R(tap.x - 0.05);
  if (tap.x > roof.x + roof.w) roof.w = R(tap.x - roof.x + 0.1);
  blocks.push(roof);

  const cupSide = flip ? -1 : 1;
  const mid = flip ? 0.42 : 0.58;

  switch (bp) {
    case 0: // two-step stair
      blocks.push(box(flip ? 0.28 : 0.4, 0.42 + j, 0.28, 0.05));
      blocks.push(box(clamp(cup.x - 0.04, 0.05, 0.7), 0.58, 0.26, 0.05));
      break;
    case 1: // long runway then drop
      blocks.push(box(flip ? 0.1 : 0.35, 0.4, lerp(0.4, 0.55, d), 0.05));
      blocks.push(box(clamp(cup.x - 0.02, 0.05, 0.72), 0.62, 0.22, 0.05));
      break;
    case 2: // S zig shelves
      blocks.push(box(flip ? 0.48 : 0.05, 0.36, 0.36, 0.05));
      blocks.push(box(flip ? 0.05 : 0.48, 0.5, 0.36, 0.05));
      blocks.push(box(flip ? 0.4 : 0.12, 0.64, 0.32, 0.05));
      break;
    case 3: // center pillar + shelves
      blocks.push(box(0.46, 0.3, 0.06, lerp(0.28, 0.42, d)));
      blocks.push(box(flip ? 0.12 : 0.55, 0.48, 0.28, 0.05));
      blocks.push(box(flip ? 0.55 : 0.1, 0.62, 0.26, 0.05));
      break;
    case 4: // left canyon wall
      blocks.push(box(flip ? 0.55 : 0.22, 0.28, 0.06, 0.4));
      blocks.push(box(flip ? 0.2 : 0.4, 0.5, 0.3, 0.05));
      blocks.push(box(clamp(cup.x - 0.05, 0.05, 0.7), 0.66, 0.24, 0.05));
      break;
    case 5: // right canyon
      blocks.push(box(flip ? 0.3 : 0.62, 0.3, 0.06, 0.38));
      blocks.push(box(flip ? 0.45 : 0.15, 0.46, 0.3, 0.05));
      blocks.push(box(flip ? 0.1 : 0.5, 0.62, 0.28, 0.05));
      break;
    case 6: // bridge with gap over mid
      blocks.push(box(0.05, 0.42, 0.32, 0.05));
      blocks.push(box(0.55, 0.42, 0.36, 0.05));
      blocks.push(box(mid - 0.1, 0.58, 0.28, 0.05));
      blocks.push(box(clamp(cup.x - 0.03, 0.05, 0.7), 0.7, 0.22, 0.05));
      break;
    case 7: // double corridor walls
      blocks.push(box(0.34, 0.3, 0.05, 0.32));
      blocks.push(box(0.58, 0.3, 0.05, 0.32));
      blocks.push(box(flip ? 0.1 : 0.4, 0.52, 0.24, 0.05));
      blocks.push(box(clamp(cup.x - 0.04, 0.05, 0.7), 0.66, 0.24, 0.05));
      break;
    case 8: // cascade many short steps
      for (let s = 0; s < 4; s++) {
        blocks.push(
          box(
            flip ? 0.5 - s * 0.08 : 0.2 + s * 0.08,
            0.36 + s * 0.08,
            0.22,
            0.05
          )
        );
      }
      break;
    case 9: // funnel gates
      blocks.push(box(0.04, 0.4, 0.28, 0.05));
      blocks.push(box(0.62, 0.4, 0.3, 0.05));
      blocks.push(box(0.42, 0.46, 0.05, 0.22));
      blocks.push(box(clamp(cup.x - 0.05, 0.05, 0.7), 0.66, 0.26, 0.05));
      break;
    case 10: // tall blocker near tap exit
      blocks.push(box(flip ? roof.x - 0.06 : roof.x + roof.w + 0.01, 0.28, 0.055, 0.34));
      blocks.push(box(flip ? 0.15 : 0.45, 0.52, 0.32, 0.05));
      blocks.push(box(clamp(cup.x - 0.04, 0.05, 0.7), 0.68, 0.24, 0.05));
      break;
    case 11: // checker platforms
      blocks.push(box(0.1, 0.38, 0.2, 0.05));
      blocks.push(box(0.45, 0.38, 0.2, 0.05));
      blocks.push(box(0.28, 0.52, 0.2, 0.05));
      blocks.push(box(0.62, 0.52, 0.2, 0.05));
      blocks.push(box(clamp(cup.x - 0.03, 0.05, 0.7), 0.66, 0.22, 0.05));
      break;
    case 12: // Z path
      blocks.push(box(flip ? 0.4 : 0.08, 0.36, 0.42, 0.05));
      blocks.push(box(0.42, 0.42, 0.05, 0.2));
      blocks.push(box(flip ? 0.08 : 0.4, 0.58, 0.42, 0.05));
      blocks.push(box(clamp(cup.x - 0.04, 0.05, 0.7), 0.7, 0.22, 0.05));
      break;
    case 13: // cup pocket (U around cup)
      blocks.push(box(flip ? 0.2 : 0.4, 0.4, 0.3, 0.05));
      blocks.push(box(cup.x - 0.04, cup.y - 0.02, 0.05, cup.h + 0.04));
      blocks.push(box(cup.x + cup.w - 0.01, cup.y - 0.02, 0.05, cup.h + 0.04));
      blocks.push(box(cup.x - 0.04, cup.y - 0.06, cup.w + 0.08, 0.05));
      break;
    case 14: // split mid roofs
      blocks.push(box(0.05, 0.38, 0.28, 0.05));
      blocks.push(box(0.55, 0.38, 0.32, 0.05));
      blocks.push(box(0.3, 0.52, 0.35, 0.05));
      blocks.push(box(clamp(cup.x - 0.03, 0.05, 0.7), 0.68, 0.24, 0.05));
      break;
    case 15: // spiral shelves clockwise-ish
      blocks.push(box(0.55, 0.34, 0.3, 0.05));
      blocks.push(box(0.62, 0.46, 0.05, 0.2));
      blocks.push(box(0.3, 0.58, 0.4, 0.05));
      blocks.push(box(0.28, 0.46, 0.05, 0.18));
      blocks.push(box(clamp(cup.x - 0.03, 0.05, 0.7), 0.7, 0.22, 0.05));
      break;
    case 16: // narrow gauntlet
      blocks.push(box(0.38, 0.3, 0.05, 0.22));
      blocks.push(box(0.52, 0.3, 0.05, 0.22));
      blocks.push(box(0.38, 0.5, 0.05, 0.22));
      blocks.push(box(0.52, 0.5, 0.05, 0.22));
      blocks.push(box(0.2, 0.62, 0.25, 0.05));
      blocks.push(box(0.55, 0.62, 0.25, 0.05));
      break;
    case 17: // overhang stack (right or left heavy)
      blocks.push(box(flip ? 0.08 : 0.45, 0.34, 0.4, 0.05));
      blocks.push(box(flip ? 0.15 : 0.5, 0.46, 0.32, 0.05));
      blocks.push(box(flip ? 0.22 : 0.55, 0.58, 0.26, 0.05));
      blocks.push(box(clamp(cup.x - 0.02, 0.05, 0.72), 0.7, 0.2, 0.05));
      break;
    case 18: // diagonal stair 5 rungs
      for (let s = 0; s < 5; s++) {
        blocks.push(
          box(flip ? 0.55 - s * 0.09 : 0.15 + s * 0.09, 0.34 + s * 0.07, 0.2, 0.05)
        );
      }
      break;
    case 19: // fortress — thick walls + shelves
      blocks.push(box(0.2, 0.32, 0.07, 0.36));
      blocks.push(box(0.7, 0.32, 0.07, 0.36));
      blocks.push(box(0.3, 0.48, 0.35, 0.05));
      blocks.push(box(0.15, 0.64, 0.28, 0.05));
      blocks.push(box(0.55, 0.64, 0.28, 0.05));
      break;
    case 20: // high shelf + low pocket
      blocks.push(box(0.15, 0.34, 0.55, 0.05));
      blocks.push(box(0.4, 0.42, 0.06, 0.2));
      blocks.push(box(flip ? 0.1 : 0.5, 0.58, 0.3, 0.05));
      blocks.push(box(clamp(cup.x - 0.04, 0.05, 0.7), 0.7, 0.24, 0.05));
      break;
    case 21: // comb teeth
      for (let s = 0; s < 4; s++) {
        blocks.push(box(0.18 + s * 0.18, 0.36 + (s % 2) * 0.1, 0.05, 0.28));
      }
      blocks.push(box(0.1, 0.66, 0.35, 0.05));
      blocks.push(box(0.55, 0.66, 0.3, 0.05));
      break;
    case 22: // L then reverse L
      blocks.push(box(flip ? 0.45 : 0.1, 0.36, 0.4, 0.05));
      blocks.push(box(flip ? 0.45 : 0.45, 0.36, 0.05, 0.24));
      blocks.push(box(flip ? 0.1 : 0.45, 0.56, 0.4, 0.05));
      blocks.push(box(flip ? 0.45 : 0.1, 0.56, 0.05, 0.2));
      blocks.push(box(clamp(cup.x - 0.03, 0.05, 0.7), 0.72, 0.22, 0.05));
      break;
    case 23: // cup behind tall fence with door gap
      blocks.push(box(0.05, 0.4, 0.3, 0.05));
      blocks.push(box(0.48, 0.28, 0.06, 0.4));
      blocks.push(box(0.58, 0.28, 0.06, 0.22));
      blocks.push(box(0.58, 0.58, 0.3, 0.05));
      blocks.push(box(clamp(cup.x - 0.03, 0.05, 0.7), 0.7, 0.22, 0.05));
      break;
    default: // late maze mesh
      blocks.push(box(0.25, 0.32, 0.05, 0.28));
      blocks.push(box(0.5, 0.38, 0.05, 0.28));
      blocks.push(box(0.12, 0.48, 0.22, 0.05));
      blocks.push(box(0.35, 0.58, 0.28, 0.05));
      blocks.push(box(0.62, 0.48, 0.24, 0.05));
      blocks.push(box(clamp(cup.x - 0.03, 0.05, 0.7), 0.7, 0.22, 0.05));
      break;
  }

  // Always add a small contrasting piece so early levels aren't just flat shelves
  if (bp % 2 === 0) {
    blocks.push(box(flip ? 0.58 : 0.1, 0.46 + j, 0.05, 0.16));
  } else {
    blocks.push(box(flip ? 0.12 : 0.62, 0.36 + j, 0.16, 0.05));
  }
  // Progressive extras — denser and meaner as you climb
  if (band >= 1) {
    blocks.push(box(flip ? 0.62 : 0.08, 0.34 + j, 0.18, 0.05));
  }
  if (band >= 2) {
    blocks.push(box(0.42 + cupSide * 0.06, 0.38, 0.05, lerp(0.16, 0.28, d)));
  }
  if (band >= 4) {
    blocks.push(box(0.05, 0.58, 0.26, 0.05));
    blocks.push(box(0.58, 0.58, 0.28, 0.05));
  }
  if (band >= 6) {
    blocks.push(box(0.46, 0.3, 0.055, lerp(0.28, 0.4, d)));
  }
  if (band >= 8) {
    blocks.push(box(flip ? 0.15 : 0.55, 0.7, 0.24, 0.05));
    blocks.push(box(flip ? 0.5 : 0.28, 0.44, 0.05, 0.22));
  }

  return dedupe(blocks);
}

function buildSolution(tap, cup, blocks, flip) {
  const roof = blocks[0];
  const cx = cup.x + cup.w * 0.5;
  const cy = cup.y + cup.h * 0.4;
  const rideY = roof.y - 0.028;
  const exitX = flip ? roof.x - 0.045 : roof.x + roof.w + 0.045;

  const pts = [
    { x: tap.x, y: tap.y + 0.03 },
    { x: tap.x, y: rideY },
    { x: clamp(exitX, 0.05, 0.95), y: rideY }
  ];

  const waypoints = [{ y: 0.4 }, { y: 0.52 }, { y: 0.64 }];
  let x = pts[pts.length - 1].x;
  for (const wp of waypoints) {
    let nx = lerp(x, cx, 0.4);
    for (const b of blocks) {
      if (b.h > 0.12 && b.w < 0.12) {
        if (nx > b.x - 0.05 && nx < b.x + b.w + 0.05 && wp.y > b.y && wp.y < b.y + b.h) {
          nx = flip ? b.x - 0.07 : b.x + b.w + 0.07;
        }
      }
      if (b.h <= 0.09 && wp.y > b.y - 0.03 && wp.y < b.y + b.h + 0.05) {
        if (nx > b.x && nx < b.x + b.w) {
          pts.push({ x: nx, y: b.y - 0.028 });
          nx = Math.abs(cx - b.x) < Math.abs(cx - (b.x + b.w)) ? b.x - 0.05 : b.x + b.w + 0.05;
        }
      }
    }
    x = clamp(nx, 0.05, 0.95);
    pts.push({ x, y: wp.y });
  }
  // Approach cup from above — clear of pocket walls
  pts.push({ x: cx, y: Math.min(cup.y - 0.06, 0.7) });
  pts.push({ x: cx, y: cy });

  let sol = densify(pts, 0.02);
  for (let pass = 0; pass < 6; pass++) {
    sol = sol.map((p) => {
      let q = { ...p };
      for (const b of blocks) {
        if (!insideBlock(q, b, 0.028)) continue;
        const left = b.x - 0.055;
        const right = b.x + b.w + 0.055;
        // Prefer dropping onto the shelf top when it's a flat slab
        if (b.h <= 0.09 && q.y >= b.y - 0.01) {
          q.y = b.y - 0.028;
          if (q.x > b.x && q.x < b.x + b.w) {
            q.x = Math.abs(cx - b.x) < Math.abs(cx - (b.x + b.w)) ? left : right;
          }
        } else {
          q.x = Math.abs(q.x - left) < Math.abs(q.x - right) ? left : right;
          q.y = Math.min(q.y, b.y - 0.025);
        }
        q.x = clamp(q.x, 0.04, 0.96);
        q.y = clamp(q.y, 0.05, 0.95);
      }
      return q;
    });
  }
  // Always finish inside the cup mouth
  const end = sol[sol.length - 1];
  if (end.x < cup.x || end.x > cup.x + cup.w || end.y < cup.y || end.y > cup.y + cup.h) {
    sol.push({ x: cx, y: cup.y - 0.04 });
    sol.push({ x: cx, y: cy });
    sol = densify(sol, 0.02);
  }
  return densify(sol, 0.02);
}

function packSafe(blocks, sol, tap, cup, flip, index, d) {
  const minBlocks = 5 + Math.floor(index / 15) + (index > 50 ? 1 : 0);
  const fillers = [
    box(flip ? 0.6 : 0.08, 0.36, 0.18, 0.05),
    box(flip ? 0.08 : 0.6, 0.5, 0.2, 0.05),
    box(flip ? 0.55 : 0.12, 0.64, 0.22, 0.05),
    box(clamp(cup.x - 0.05, 0.05, 0.7), cup.y - 0.12, cup.w + 0.1, 0.05),
    box(flip ? 0.2 : 0.55, 0.42, 0.05, 0.2)
  ];
  let out = dedupe(blocks.slice());
  for (const f of fillers) {
    if (out.length >= minBlocks + 1) break;
    if (pathThroughBlock(sol, f, 0.03)) continue;
    out.push(f);
    out = dedupe(out);
  }
  let g = 0;
  while (out.length < minBlocks && g < 24) {
    g += 1;
    const f = box(flip ? 0.08 + (g % 5) * 0.1 : 0.55 - (g % 5) * 0.08, 0.34 + (g % 6) * 0.06, 0.16, 0.05);
    if (pathThroughBlock(sol, f, 0.03)) continue;
    out.push(f);
    out = dedupe(out);
  }
  return out;
}

function layoutFingerprint(blocks) {
  // Coarse grid occupancy so near-identical silhouettes collide
  const cells = new Set();
  for (const b of blocks) {
    const x0 = Math.floor(b.x * 8);
    const x1 = Math.floor((b.x + b.w) * 8);
    const y0 = Math.floor(b.y * 8);
    const y1 = Math.floor((b.y + b.h) * 8);
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) cells.add(`${x},${y}`);
  }
  return [...cells].sort().join("|");
}

function buildLevel(index) {
  const d = difficulty(index);
  const flip = index % 2 === 1;
  const band = Math.floor(index / 10);

  const tap = {
    x: flip ? clamp(0.78 - (index % 5) * 0.025, 0.58, 0.86) : clamp(0.16 + (index % 5) * 0.025, 0.12, 0.38),
    y: 0.09
  };
  const cup = {
    x: flip ? clamp(0.08 + (index % 4) * 0.02, 0.05, 0.24) : clamp(0.72 - (index % 4) * 0.02, 0.64, 0.82),
    y: clamp(0.76 - band * 0.01, 0.62, 0.78),
    w: lerp(0.14, 0.105, d),
    h: lerp(0.15, 0.115, d)
  };

  let blocks = blueprint(index, tap, cup, flip, d);
  while (freeWin(tap, cup, blocks)) {
    blocks[0].w = Math.min(0.95, blocks[0].w + 0.1);
    blocks[0].x = clamp(tap.x - blocks[0].w * 0.5, 0.02, 0.5);
  }

  let sol = buildSolution(tap, cup, blocks, flip);
  blocks = blocks.filter((b, idx) => idx === 0 || !pathThroughBlock(sol, b, 0.026));
  blocks = packSafe(blocks, sol, tap, cup, flip, index, d);
  while (freeWin(tap, cup, blocks)) {
    blocks.unshift(box(tap.x - 0.25, 0.25, 0.5, 0.055));
    blocks = dedupe(blocks);
  }

  const pathLen = strokeLength(sol);
  // Tight ink — harder levels leave almost no spare
  const ink = clamp(pathLen * lerp(1.2, 1.05, d) + lerp(0.1, 0.03, d), 0.7, 2.15);
  const need = Math.round(lerp(18, 42, d));

  return {
    id: index + 1,
    name: uniqueName(index),
    ink: Math.round(ink * 100) / 100,
    need,
    tap: { x: R(tap.x), y: R(tap.y) },
    cup: { x: R(cup.x), y: R(cup.y), w: R(cup.w), h: R(cup.h) },
    blocks,
    _sol: sol,
    _fp: layoutFingerprint(blocks)
  };
}

function validate(level) {
  if (freeWin(level.tap, level.cup, level.blocks)) return { ok: false, reason: "free-win" };
  const minBlocks = level.id <= 10 ? 5 : level.id <= 30 ? 6 : level.id <= 60 ? 7 : 8;
  if (!level.blocks || level.blocks.length < minBlocks) return { ok: false, reason: "too few" };
  if (Math.abs(level.tap.x - (level.cup.x + level.cup.w / 2)) < 0.28) return { ok: false, reason: "cup under tap" };
  const sol = level._sol;
  if (Math.abs(sol[0].x - level.tap.x) > 0.1) return { ok: false, reason: "path not under tap" };
  const end = sol[sol.length - 1];
  if (end.x < level.cup.x || end.x > level.cup.x + level.cup.w || end.y < level.cup.y || end.y > level.cup.y + level.cup.h) {
    return { ok: false, reason: "path misses cup" };
  }
  for (const b of level.blocks) {
    if (pathThroughBlock(sol, b, 0.022)) return { ok: false, reason: "path hits block" };
  }
  const len = strokeLength(sol);
  if (len > level.ink * 0.98) {
    // Auto-bump ink so the verified route always fits
    level.ink = Math.round(Math.min(2.3, len * 1.08 + 0.06) * 100) / 100;
    if (len > level.ink * 0.98) return { ok: false, reason: "ink tight" };
  }
  return { ok: true, obstacles: level.blocks.length };
}

function main() {
  const levels = [];
  const fails = [];
  const fps = new Map();

  for (let i = 0; i < COUNT; i++) {
    let lv = null;
    let result = { ok: false };
    for (let tries = 0; tries < 20; tries++) {
      // Offset blueprint on retry for uniqueness
      const idx = tries === 0 ? i : i + tries * 11;
      lv = buildLevel(i);
      if (tries > 0) {
        const flip = i % 2 === 1;
        const d = difficulty(i);
        lv.tap.x = clamp(lv.tap.x + (tries % 2 ? 0.03 : -0.03), 0.12, 0.86);
        lv.blocks = blueprint(idx, lv.tap, lv.cup, flip, d);
        while (freeWin(lv.tap, lv.cup, lv.blocks)) {
          lv.blocks[0].w = Math.min(0.9, lv.blocks[0].w + 0.1);
          lv.blocks[0].x = clamp(lv.tap.x - lv.blocks[0].w * 0.5, 0.02, 0.55);
        }
        lv._sol = buildSolution(lv.tap, lv.cup, lv.blocks, flip);
        lv.blocks = lv.blocks.filter((b, bi) => bi === 0 || !pathThroughBlock(lv._sol, b, 0.026));
        lv.blocks = packSafe(lv.blocks, lv._sol, lv.tap, lv.cup, flip, i, d);
        lv.ink = Math.round(Math.min(2.15, strokeLength(lv._sol) * 1.12 + 0.08) * 100) / 100;
        lv._fp = layoutFingerprint(lv.blocks);
        lv.id = i + 1;
        lv.name = uniqueName(i);
      }
      result = validate(lv);
      if (!result.ok) continue;
      // Prefer unique silhouettes; allow reuse only on last retries
      if (fps.has(lv._fp) && tries < 16) {
        result = { ok: false, reason: "dup silhouette" };
        continue;
      }
      break;
    }
    // Last-resort: simple unique stair that always validates
    if (!result.ok) {
      const flip = i % 2 === 1;
      const d = difficulty(i);
      const tap = {
        x: flip ? 0.8 : 0.16,
        y: 0.09
      };
      const cup = {
        x: flip ? 0.1 : 0.72,
        y: 0.74,
        w: 0.13,
        h: 0.14
      };
      const step = (i % 9) * 0.02;
      let blocks = [
        box(flip ? 0.5 : 0.05, 0.26, 0.42, 0.055),
        box(flip ? 0.35 - step : 0.35 + step, 0.4, 0.3, 0.05),
        box(flip ? 0.15 : 0.45, 0.52 + (i % 4) * 0.01, 0.28, 0.05),
        box(clamp(cup.x - 0.04, 0.05, 0.7), 0.64, 0.26, 0.05)
      ];
      if (i >= 30) blocks.push(box(flip ? 0.48 : 0.4, 0.34, 0.05, 0.26));
      if (i >= 50) {
        blocks.push(box(0.05, 0.58, 0.26, 0.05));
        blocks.push(box(0.58, 0.58, 0.28, 0.05));
      }
      if (i >= 70) blocks.push(box(0.46, 0.3, 0.055, 0.36));
      while (freeWin(tap, cup, blocks)) {
        blocks[0].w = Math.min(0.9, blocks[0].w + 0.1);
        blocks[0].x = clamp(tap.x - blocks[0].w * 0.5, 0.02, 0.55);
      }
      const sol = buildSolution(tap, cup, blocks, flip);
      blocks = blocks.filter((b, bi) => bi === 0 || !pathThroughBlock(sol, b, 0.026));
      blocks = packSafe(blocks, sol, tap, cup, flip, i, d);
      lv = {
        id: i + 1,
        name: uniqueName(i),
        ink: Math.round(Math.min(2.15, strokeLength(sol) * 1.15 + 0.1) * 100) / 100,
        need: Math.round(lerp(18, 42, d)),
        tap: { x: R(tap.x), y: R(tap.y) },
        cup: { x: R(cup.x), y: R(cup.y), w: R(cup.w), h: R(cup.h) },
        blocks,
        _sol: sol,
        _fp: layoutFingerprint(blocks) + "#r" + i
      };
      result = validate(lv);
    }
    if (!result.ok) {
      fails.push({ id: i + 1, reason: result.reason });
      console.error(`FAIL ${i + 1}: ${result.reason}`);
    } else {
      fps.set(lv._fp, i + 1);
      if ((i + 1) % 10 === 0) console.log(`OK ${i + 1}/100  blocks=${result.obstacles} ink=${lv.ink} bp=${i % 25}`);
    }
    const { _sol, _fp, ...pub } = lv;
    levels.push(pub);
  }

  const counts = {};
  levels.forEach((l) => {
    counts[l.blocks.length] = (counts[l.blocks.length] || 0) + 1;
  });
  console.log("block histogram", counts);
  console.log("unique fingerprints", fps.size);

  if (fails.length) {
    console.error("generation failed", fails);
    process.exit(1);
  }
  if (fps.size < 80) {
    console.error("too many similar layouts", fps.size);
    process.exit(1);
  }

  for (const lv of levels) {
    if (freeWin(lv.tap, lv.cup, lv.blocks)) {
      console.error(`free-win slipped: ${lv.id}`);
      process.exit(1);
    }
  }

  const out = path.join(__dirname, "..", "cup-flow", "levels-data.js");
  fs.writeFileSync(
    out,
    "/* Auto-generated unique progressive Cup Flow levels */\n" +
      `window.CUP_FLOW_LEVELS = ${JSON.stringify(levels)};\n`
  );
  console.log(`Wrote ${levels.length} levels`);
}

main();
