/**
 * 100 unique, playable Cup Flow levels.
 * Each level uses a different kit + jitter so they don't look like copies.
 * Short platforms (not full-width bars). Generous ink. Clear routes.
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
function R(n, p = 3) {
  return Math.round(n * 10 ** p) / 10 ** p;
}
function box(x, y, w, h) {
  return { x: R(x), y: R(y), w: R(Math.max(0.06, w)), h: R(Math.max(0.05, h)) };
}
function hits(p, b, pad = 0) {
  return p.x >= b.x - pad && p.x <= b.x + b.w + pad && p.y >= b.y - pad && p.y <= b.y + b.h + pad;
}
function freeFall(tap, cup, blocks) {
  for (let y = tap.y + 0.02; y < 1; y += 0.01) {
    const p = { x: tap.x, y };
    if (blocks.some((b) => hits(p, b))) return false;
    if (p.x >= cup.x && p.x <= cup.x + cup.w && p.y >= cup.y && p.y <= cup.y + cup.h) return true;
  }
  return false;
}
function strokeLen(pts) {
  let n = 0;
  for (let i = 1; i < pts.length; i++) n += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  return n;
}
function densify(pts, step = 0.025) {
  const out = [{ ...pts[0] }];
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    const d = Math.hypot(b.x - a.x, b.y - a.y);
    const n = Math.max(1, Math.ceil(d / step));
    for (let k = 1; k <= n; k++) {
      const t = k / n;
      out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
    }
  }
  return out;
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
  return `${A[i % A.length]} ${B[(i * 5 + 3) % B.length]}`.slice(0, 16);
}

/** Roof under tap — always. */
function roofUnder(tap, flip, w = 0.34) {
  const x = flip ? clamp(tap.x - w * 0.35, 0.4, 0.7) : clamp(tap.x - w * 0.55, 0.04, 0.35);
  const b = box(x, 0.24, w, 0.055);
  if (tap.x < b.x) b.x = R(tap.x - 0.04);
  if (tap.x > b.x + b.w) b.w = R(tap.x - b.x + 0.08);
  return b;
}

/**
 * 20 visually different kits. Each returns { blocks, waypoints }.
 * waypoints = path from under tap to cup (ride shelves / go around walls).
 */
function kit(kitId, tap, cup, flip, d, jitter) {
  const j = jitter;
  const dir = flip ? -1 : 1;
  const mid = flip ? 0.45 : 0.55;
  const cupX = cup.x + cup.w * 0.5;
  const cupY = cup.y + cup.h * 0.35;
  const roof = roofUnder(tap, flip, lerp(0.32, 0.4, d));
  const exitX = flip ? roof.x - 0.05 : roof.x + roof.w + 0.05;
  const ride = roof.y - 0.03;

  const blocks = [roof];
  let waypoints = [
    { x: tap.x, y: tap.y + 0.04 },
    { x: tap.x, y: ride },
    { x: clamp(exitX, 0.08, 0.92), y: ride }
  ];

  const add = (...bs) => blocks.push(...bs);
  const go = (...pts) => {
    for (const p of pts) waypoints.push(p);
  };

  switch (kitId % 20) {
    case 0: {
      // Two short steps toward cup
      const a = box(flip ? 0.45 + j : 0.28 + j, 0.4, 0.22, 0.05);
      const b = box(clamp(cupX - 0.1, 0.08, 0.7), 0.56, 0.22, 0.05);
      add(a, b);
      go({ x: a.x + a.w * 0.5, y: a.y - 0.03 }, { x: b.x + b.w * 0.5, y: b.y - 0.03 });
      break;
    }
    case 1: {
      // Long runway then drop
      const a = box(flip ? 0.2 : 0.25 + j, 0.38, 0.4, 0.05);
      const b = box(clamp(cupX - 0.08, 0.08, 0.72), 0.58, 0.2, 0.05);
      add(a, b);
      go({ x: a.x + (flip ? 0.08 : a.w - 0.08), y: a.y - 0.03 }, { x: b.x + b.w * 0.5, y: b.y - 0.03 });
      break;
    }
    case 2: {
      // Center pillar + two shelves
      const wall = box(mid - 0.03, 0.3, 0.06, lerp(0.28, 0.38, d));
      const a = box(flip ? 0.12 : 0.55, 0.46, 0.26, 0.05);
      const b = box(clamp(cupX - 0.1, 0.08, 0.7), 0.62, 0.22, 0.05);
      add(wall, a, b);
      go(
        { x: flip ? wall.x - 0.06 : wall.x + wall.w + 0.06, y: 0.4 },
        { x: a.x + a.w * 0.5, y: a.y - 0.03 },
        { x: b.x + b.w * 0.5, y: b.y - 0.03 }
      );
      break;
    }
    case 3: {
      // S-curve three short shelves
      const a = box(flip ? 0.5 : 0.12 + j, 0.36, 0.28, 0.05);
      const b = box(flip ? 0.14 : 0.48, 0.5, 0.28, 0.05);
      const c = box(clamp(cupX - 0.1, 0.08, 0.7), 0.64, 0.22, 0.05);
      add(a, b, c);
      go(
        { x: a.x + a.w * 0.5, y: a.y - 0.03 },
        { x: b.x + b.w * 0.5, y: b.y - 0.03 },
        { x: c.x + c.w * 0.5, y: c.y - 0.03 }
      );
      break;
    }
    case 4: {
      // Diagonal cascade (4 short pads)
      for (let i = 0; i < 4; i++) {
        const x = flip ? 0.55 - i * 0.1 + j * 0.3 : 0.2 + i * 0.1 + j * 0.3;
        const y = 0.34 + i * 0.08;
        const s = box(clamp(x, 0.08, 0.72), y, 0.18, 0.05);
        add(s);
        go({ x: s.x + s.w * 0.5, y: s.y - 0.03 });
      }
      break;
    }
    case 5: {
      // Cup pocket (walls beside cup + approach shelf)
      const shelf = box(flip ? 0.35 : 0.25 + j, 0.42, 0.32, 0.05);
      const L = box(cup.x - 0.05, cup.y - 0.02, 0.05, cup.h + 0.05);
      const R = box(cup.x + cup.w, cup.y - 0.02, 0.05, cup.h + 0.05);
      const lid = box(cup.x - 0.05, cup.y - 0.07, cup.w + 0.1, 0.05);
      add(shelf, L, R, lid);
      go({ x: shelf.x + shelf.w * 0.5, y: shelf.y - 0.03 }, { x: cupX, y: lid.y - 0.03 });
      break;
    }
    case 6: {
      // Bridge gap (two shelves with space)
      const a = box(0.08, 0.4, 0.3, 0.05);
      const b = box(0.55, 0.4, 0.32, 0.05);
      const c = box(clamp(cupX - 0.1, 0.1, 0.7), 0.58, 0.24, 0.05);
      add(a, b, c);
      const first = flip ? b : a;
      const second = flip ? a : b;
      go(
        { x: first.x + first.w * 0.5, y: first.y - 0.03 },
        { x: second.x + second.w * 0.5, y: second.y - 0.03 },
        { x: c.x + c.w * 0.5, y: c.y - 0.03 }
      );
      break;
    }
    case 7: {
      // Side canyon wall
      const wall = box(flip ? 0.35 : 0.55, 0.28, 0.06, 0.4);
      const a = box(flip ? 0.5 : 0.15 + j, 0.48, 0.28, 0.05);
      const b = box(clamp(cupX - 0.1, 0.08, 0.7), 0.64, 0.22, 0.05);
      add(wall, a, b);
      go(
        { x: flip ? wall.x + wall.w + 0.06 : wall.x - 0.06, y: 0.4 },
        { x: a.x + a.w * 0.5, y: a.y - 0.03 },
        { x: b.x + b.w * 0.5, y: b.y - 0.03 }
      );
      break;
    }
    case 8: {
      // Funnel gates
      const L = box(0.05, 0.4, 0.28, 0.05);
      const R = box(0.58, 0.4, 0.3, 0.05);
      const post = box(0.44, 0.42, 0.05, 0.2);
      const c = box(clamp(cupX - 0.1, 0.08, 0.7), 0.64, 0.24, 0.05);
      add(L, R, post, c);
      go(
        { x: flip ? R.x + 0.1 : L.x + L.w - 0.1, y: L.y - 0.03 },
        { x: flip ? post.x - 0.06 : post.x + post.w + 0.06, y: 0.5 },
        { x: c.x + c.w * 0.5, y: c.y - 0.03 }
      );
      break;
    }
    case 9: {
      // High shelf + low ledge
      const a = box(0.18 + j, 0.34, 0.5, 0.05);
      const wall = box(mid - 0.03, 0.38, 0.06, 0.2);
      const b = box(flip ? 0.12 : 0.5, 0.58, 0.28, 0.05);
      add(a, wall, b);
      go(
        { x: a.x + (flip ? 0.1 : a.w - 0.1), y: a.y - 0.03 },
        { x: flip ? wall.x + wall.w + 0.05 : wall.x - 0.05, y: 0.5 },
        { x: b.x + b.w * 0.5, y: b.y - 0.03 }
      );
      break;
    }
    case 10: {
      // L then reverse-L
      const a = box(flip ? 0.4 : 0.12 + j, 0.36, 0.36, 0.05);
      const v1 = box(flip ? 0.4 : 0.43, 0.36, 0.05, 0.2);
      const b = box(flip ? 0.12 : 0.4, 0.54, 0.36, 0.05);
      const c = box(clamp(cupX - 0.1, 0.08, 0.7), 0.68, 0.2, 0.05);
      add(a, v1, b, c);
      go(
        { x: a.x + a.w * 0.5, y: a.y - 0.03 },
        { x: flip ? v1.x - 0.05 : v1.x + v1.w + 0.05, y: 0.48 },
        { x: b.x + b.w * 0.5, y: b.y - 0.03 },
        { x: c.x + c.w * 0.5, y: c.y - 0.03 }
      );
      break;
    }
    case 11: {
      // Stepping stones (5 tiny pads)
      for (let i = 0; i < 5; i++) {
        const x = lerp(tap.x, cupX, (i + 1) / 6) - 0.08 + (i % 2) * 0.06 * dir;
        const y = 0.34 + i * 0.07;
        const s = box(clamp(x, 0.08, 0.75), y, 0.16, 0.05);
        add(s);
        go({ x: s.x + s.w * 0.5, y: s.y - 0.03 });
      }
      break;
    }
    case 12: {
      // Double wall corridor
      const w1 = box(0.32, 0.3, 0.05, 0.28);
      const w2 = box(0.55, 0.3, 0.05, 0.28);
      const a = box(flip ? 0.62 : 0.12 + j, 0.5, 0.22, 0.05);
      const b = box(clamp(cupX - 0.1, 0.08, 0.7), 0.66, 0.22, 0.05);
      add(w1, w2, a, b);
      go(
        { x: 0.44, y: 0.36 },
        { x: a.x + a.w * 0.5, y: a.y - 0.03 },
        { x: b.x + b.w * 0.5, y: b.y - 0.03 }
      );
      break;
    }
    case 13: {
      // Overhang stack (3 overlapping toward cup)
      for (let i = 0; i < 3; i++) {
        const x = flip ? 0.15 + i * 0.08 : 0.45 - i * 0.08 + j;
        const y = 0.36 + i * 0.1;
        const s = box(clamp(x, 0.08, 0.7), y, 0.3 - i * 0.04, 0.05);
        add(s);
        go({ x: s.x + s.w * (flip ? 0.7 : 0.3), y: s.y - 0.03 });
      }
      break;
    }
    case 14: {
      // Split mid roofs + lower shelf
      const a = box(0.08, 0.36, 0.28, 0.05);
      const b = box(0.52, 0.36, 0.3, 0.05);
      const c = box(0.28, 0.52, 0.35, 0.05);
      const d = box(clamp(cupX - 0.1, 0.08, 0.7), 0.66, 0.22, 0.05);
      add(a, b, c, d);
      go(
        { x: (flip ? b : a).x + 0.12, y: 0.33 },
        { x: c.x + c.w * 0.5, y: c.y - 0.03 },
        { x: d.x + d.w * 0.5, y: d.y - 0.03 }
      );
      break;
    }
    case 15: {
      // Tall blocker near roof exit
      const wall = box(flip ? roof.x - 0.07 : roof.x + roof.w + 0.01, 0.26, 0.055, 0.32);
      const a = box(flip ? 0.15 : 0.45 + j, 0.5, 0.3, 0.05);
      const b = box(clamp(cupX - 0.1, 0.08, 0.7), 0.66, 0.22, 0.05);
      add(wall, a, b);
      go(
        { x: flip ? wall.x - 0.05 : wall.x + wall.w + 0.05, y: 0.36 },
        { x: a.x + a.w * 0.5, y: a.y - 0.03 },
        { x: b.x + b.w * 0.5, y: b.y - 0.03 }
      );
      break;
    }
    case 16: {
      // Checker pads
      const pads = [
        box(0.12, 0.36, 0.2, 0.05),
        box(0.42, 0.36, 0.2, 0.05),
        box(0.28, 0.5, 0.2, 0.05),
        box(0.55, 0.5, 0.2, 0.05),
        box(clamp(cupX - 0.1, 0.08, 0.7), 0.64, 0.2, 0.05)
      ];
      add(...pads);
      for (const s of pads) go({ x: s.x + s.w * 0.5, y: s.y - 0.03 });
      break;
    }
    case 17: {
      // Z with one wall
      const a = box(flip ? 0.4 : 0.1 + j, 0.36, 0.4, 0.05);
      const wall = box(0.44, 0.38, 0.05, 0.22);
      const b = box(flip ? 0.1 : 0.4, 0.56, 0.4, 0.05);
      const c = box(clamp(cupX - 0.1, 0.08, 0.7), 0.7, 0.2, 0.05);
      add(a, wall, b, c);
      go(
        { x: a.x + a.w * 0.5, y: a.y - 0.03 },
        { x: flip ? wall.x - 0.05 : wall.x + wall.w + 0.05, y: 0.48 },
        { x: b.x + b.w * 0.5, y: b.y - 0.03 },
        { x: c.x + c.w * 0.5, y: c.y - 0.03 }
      );
      break;
    }
    case 18: {
      // Spiral-ish
      const a = box(0.5, 0.34, 0.28, 0.05);
      const v = box(0.72, 0.34, 0.05, 0.22);
      const b = box(0.3, 0.52, 0.4, 0.05);
      const v2 = box(0.28, 0.4, 0.05, 0.18);
      const c = box(clamp(cupX - 0.1, 0.08, 0.7), 0.68, 0.2, 0.05);
      add(a, v, b, v2, c);
      go(
        { x: a.x + 0.1, y: a.y - 0.03 },
        { x: v.x - 0.05, y: 0.42 },
        { x: b.x + b.w * 0.5, y: b.y - 0.03 },
        { x: c.x + c.w * 0.5, y: c.y - 0.03 }
      );
      break;
    }
    default: {
      // Late maze: two posts + three shelves
      const w1 = box(0.3 + j, 0.3, 0.05, 0.26);
      const w2 = box(0.55, 0.38, 0.05, 0.26);
      const a = box(0.1, 0.46, 0.2, 0.05);
      const b = box(0.38, 0.56, 0.25, 0.05);
      const c = box(0.62, 0.48, 0.22, 0.05);
      const d = box(clamp(cupX - 0.1, 0.08, 0.7), 0.7, 0.2, 0.05);
      add(w1, w2, a, b, c, d);
      go(
        { x: flip ? w1.x - 0.05 : w1.x + w1.w + 0.05, y: 0.36 },
        { x: a.x + a.w * 0.5, y: a.y - 0.03 },
        { x: b.x + b.w * 0.5, y: b.y - 0.03 },
        { x: d.x + d.w * 0.5, y: d.y - 0.03 }
      );
      break;
    }
  }

  go({ x: cupX, y: Math.min(cup.y - 0.04, 0.72) }, { x: cupX, y: cupY });
  return { blocks, waypoints };
}

function buildSolution(waypoints, blocks) {
  let sol = densify(waypoints, 0.022);
  for (let pass = 0; pass < 6; pass++) {
    sol = sol.map((p) => {
      let q = { ...p };
      for (const b of blocks) {
        // interior hit (not riding top)
        if (q.y <= b.y + 0.01) continue;
        if (q.x <= b.x - 0.02 || q.x >= b.x + b.w + 0.02 || q.y >= b.y + b.h + 0.02) continue;
        if (b.h <= 0.08) {
          q.y = b.y - 0.03;
        } else {
          const left = b.x - 0.05;
          const right = b.x + b.w + 0.05;
          q.x = Math.abs(q.x - left) < Math.abs(q.x - right) ? left : right;
        }
        q.x = clamp(q.x, 0.05, 0.95);
        q.y = clamp(q.y, 0.05, 0.95);
      }
      return q;
    });
  }
  return densify(sol, 0.022);
}

function shortBypass(tap, cup, blocks) {
  const cx = cup.x + cup.w * 0.5;
  const cy = cup.y + cup.h * 0.35;
  const start = { x: tap.x, y: tap.y + 0.04 };
  const routes = [
    [start, { x: cx, y: cy }],
    [start, { x: lerp(start.x, cx, 0.5), y: 0.35 }, { x: cx, y: cy }],
    [start, { x: start.x, y: 0.5 }, { x: cx, y: 0.5 }, { x: cx, y: cy }]
  ];
  for (const route of routes) {
    const pts = densify(route, 0.015);
    if (!pts.some((p) => blocks.some((b) => hits(p, b, 0.01)))) return true;
  }
  return false;
}

function buildLevel(index) {
  const d = index / (COUNT - 1);
  const flip = index % 2 === 1;
  const kitId = index % 20;
  // Each level in a kit-family gets different jitter / piece scale feel
  const jitter = ((index * 17) % 10) * 0.008;

  const tap = {
    x: flip ? clamp(0.72 - (index % 5) * 0.02, 0.6, 0.8) : clamp(0.2 + (index % 5) * 0.02, 0.14, 0.34),
    y: 0.1
  };
  const cup = {
    x: flip ? clamp(0.08 + (index % 4) * 0.02, 0.05, 0.2) : clamp(0.72 - (index % 4) * 0.02, 0.68, 0.82),
    y: clamp(0.72 - Math.floor(index / 25) * 0.02, 0.66, 0.76),
    w: lerp(0.14, 0.11, d),
    h: lerp(0.15, 0.12, d)
  };

  let { blocks, waypoints } = kit(kitId, tap, cup, flip, d, jitter);

  // Difficulty extras — add 0–3 pieces that sit on the route side (not decoration piles)
  const band = Math.floor(index / 20);
  if (band >= 1) {
    blocks.push(box(flip ? 0.55 : 0.2, 0.32 + jitter, 0.16, 0.05));
  }
  if (band >= 2) {
    blocks.push(box(0.42 + (flip ? 0.08 : -0.08), 0.4, 0.05, 0.18));
  }
  if (band >= 3) {
    blocks.push(box(clamp(cup.x - 0.04, 0.06, 0.7), cup.y - 0.12, cup.w + 0.1, 0.05));
  }
  if (band >= 4) {
    blocks.push(box(flip ? 0.25 : 0.6, 0.55, 0.18, 0.05));
  }

  // Dedup
  const cleaned = [];
  for (const b of blocks) {
    if (cleaned.some((c) => Math.abs(c.x - b.x) < 0.03 && Math.abs(c.y - b.y) < 0.03 && Math.abs(c.w - b.w) < 0.04)) continue;
    cleaned.push(b);
  }
  blocks = cleaned;

  while (freeFall(tap, cup, blocks)) {
    blocks[0].w = Math.min(0.9, blocks[0].w + 0.1);
    blocks[0].x = clamp(tap.x - blocks[0].w * 0.5, 0.02, 0.55);
  }

  // Soft seal: if a straight diagonal is open, extend the roof or add one mid shelf on the line
  let guard = 0;
  while (shortBypass(tap, cup, blocks) && guard < 5) {
    guard += 1;
    const x = lerp(tap.x, cup.x + cup.w * 0.5, 0.4 + guard * 0.1);
    const y = lerp(0.35, 0.55, guard / 5);
    blocks.push(box(x - 0.1, y, 0.2, 0.05));
  }

  let sol = buildSolution(waypoints, blocks);
  // Ensure end in cup
  const end = sol[sol.length - 1];
  const cx = cup.x + cup.w * 0.5;
  const cy = cup.y + cup.h * 0.35;
  if (end.x < cup.x || end.x > cup.x + cup.w || end.y < cup.y || end.y > cup.y + cup.h) {
    sol = densify(sol.concat([{ x: cx, y: cup.y - 0.04 }, { x: cx, y: cy }]), 0.022);
  }

  const pathLen = strokeLen(sol);
  // Playable ink: plenty of spare early, still comfortable late
  const ink = clamp(pathLen * lerp(1.55, 1.25, d) + lerp(0.35, 0.2, d), 1.35, 2.8);
  const need = Math.round(lerp(16, 36, d));

  return {
    id: index + 1,
    name: uniqueName(index),
    ink: Math.round(ink * 100) / 100,
    need,
    tap: { x: R(tap.x), y: R(tap.y) },
    cup: { x: R(cup.x), y: R(cup.y), w: R(cup.w), h: R(cup.h) },
    blocks,
    _sol: sol,
    _kit: kitId
  };
}

function fp(blocks) {
  return blocks.map((b) => `${b.x.toFixed(2)},${b.y.toFixed(2)},${b.w.toFixed(2)},${b.h.toFixed(2)}`).sort().join("|");
}

function validate(lv) {
  if (freeFall(lv.tap, lv.cup, lv.blocks)) return { ok: false, reason: "free-fall" };
  if (shortBypass(lv.tap, lv.cup, lv.blocks)) return { ok: false, reason: "bypass" };
  if (lv.blocks.length < 2) return { ok: false, reason: "empty" };
  if (Math.abs(lv.tap.x - (lv.cup.x + lv.cup.w / 2)) < 0.28) return { ok: false, reason: "aligned" };
  const end = lv._sol[lv._sol.length - 1];
  if (end.x < lv.cup.x || end.x > lv.cup.x + lv.cup.w || end.y < lv.cup.y || end.y > lv.cup.y + lv.cup.h) {
    return { ok: false, reason: "miss-cup" };
  }
  // Ink must fit the route with spare
  const len = strokeLen(lv._sol);
  if (len > lv.ink * 0.85) {
    lv.ink = Math.round(Math.min(2.9, len * 1.35 + 0.25) * 100) / 100;
  }
  return { ok: true, n: lv.blocks.length, kit: lv._kit, len };
}

function main() {
  const levels = [];
  const fails = [];
  const seen = new Set();
  const kitCounts = {};

  for (let i = 0; i < COUNT; i++) {
    let lv = null;
    let result = { ok: false };
    for (let tries = 0; tries < 12; tries++) {
      lv = buildLevel(i + tries * COUNT); // shift seed on retry
      lv.id = i + 1;
      lv.name = uniqueName(i);
      // Keep flip/side of index
      if (tries > 0) {
        const flip = i % 2 === 1;
        lv.tap.x = flip ? clamp(0.72 - (i % 5) * 0.02, 0.6, 0.8) : clamp(0.2 + (i % 5) * 0.02, 0.14, 0.34);
        lv.cup.x = flip ? clamp(0.08 + (i % 4) * 0.02, 0.05, 0.2) : clamp(0.72 - (i % 4) * 0.02, 0.68, 0.82);
        const built = kit((i + tries * 3) % 20, lv.tap, lv.cup, flip, i / 99, ((i + tries) % 10) * 0.008);
        lv.blocks = built.blocks;
        while (freeFall(lv.tap, lv.cup, lv.blocks)) {
          lv.blocks[0].w = Math.min(0.9, lv.blocks[0].w + 0.1);
          lv.blocks[0].x = clamp(lv.tap.x - lv.blocks[0].w * 0.5, 0.02, 0.55);
        }
        lv._sol = buildSolution(built.waypoints, lv.blocks);
        lv._kit = (i + tries * 3) % 20;
      }
      result = validate(lv);
      if (!result.ok) continue;
      const sig = fp(lv.blocks);
      if (seen.has(sig) && tries < 10) {
        result = { ok: false, reason: "dup" };
        continue;
      }
      seen.add(sig);
      break;
    }
    if (!result.ok) {
      fails.push({ id: i + 1, reason: result.reason });
      console.error("FAIL", i + 1, result.reason);
    } else {
      kitCounts[result.kit] = (kitCounts[result.kit] || 0) + 1;
      if ((i + 1) % 10 === 0) console.log(`OK ${i + 1} kit=${result.kit} blocks=${result.n} ink=${lv.ink}`);
    }
    const { _sol, _kit, ...pub } = lv;
    levels.push(pub);
  }

  const hist = {};
  levels.forEach((l) => {
    hist[l.blocks.length] = (hist[l.blocks.length] || 0) + 1;
  });
  console.log("block hist", hist);
  console.log("kit spread", kitCounts);
  console.log("unique", seen.size);

  let leaks = 0;
  for (const lv of levels) {
    if (freeFall(lv.tap, lv.cup, lv.blocks) || shortBypass(lv.tap, lv.cup, lv.blocks)) leaks += 1;
  }
  console.log("leaks", leaks);

  if (fails.length || leaks || seen.size < 90) {
    console.error("generation failed", fails);
    process.exit(1);
  }

  fs.writeFileSync(
    path.join(__dirname, "..", "cup-flow", "levels-data.js"),
    "/* Unique playable Cup Flow levels — mixed kits, short shelves */\n" +
      `window.CUP_FLOW_LEVELS = ${JSON.stringify(levels)};\n`
  );
  console.log("Wrote", levels.length);
}

main();
