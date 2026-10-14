/**
 * 100 unique Cup Flow levels, easiest → hardest.
 * - No free wins (shelf under tap; cup on opposite side)
 * - Real obstacles on every level
 * - Verified solution rides shelves / goes around walls
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

function insideBlock(p, b, pad = 0) {
  // Points on/above the top face are OK (path can ride the shelf)
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
    "Spark", "Cliff", "Marsh", "Dune", "Frost", "Ember", "Tide", "Oak", "Pine", "Ash"
  ];
  const B = [
    "Sip", "Pour", "Gutter", "Chute", "Rail", "Shelf", "Bend", "Gate", "Wall", "Bridge",
    "Slide", "Drop", "Lane", "Hook", "Turn", "Ramp", "Well", "Spout", "Trough", "Flume"
  ];
  return `${A[i % A.length]} ${B[Math.floor(i / 2) % B.length]}`.slice(0, 16);
}

function difficulty(i) {
  return i / (COUNT - 1);
}

function buildLevel(index) {
  const d = difficulty(index);
  const flip = index % 2 === 1;
  const band = Math.floor(index / 10); // 0..9

  const tap = {
    x: flip ? clamp(0.8 - (index % 6) * 0.025, 0.62, 0.86) : clamp(0.16 + (index % 6) * 0.025, 0.12, 0.36),
    y: 0.09
  };
  const cup = {
    x: flip ? clamp(0.1 + (index % 5) * 0.02, 0.08, 0.28) : clamp(0.68 - (index % 5) * 0.02, 0.62, 0.8),
    y: clamp(0.74 - band * 0.008, 0.62, 0.78),
    w: lerp(0.14, 0.11, d),
    h: lerp(0.15, 0.12, d)
  };

  const blocks = [];

  // --- Always: drip shelf under tap (blocks free-fall) ---
  const roofY = 0.28 + (index % 3) * 0.015;
  const roofW = lerp(0.3, 0.48, d);
  const roof = {
    x: clamp(tap.x - roofW * (flip ? 0.35 : 0.55), 0.04, 0.65),
    y: roofY,
    w: roofW,
    h: 0.048
  };
  // Make sure roof covers tap.x
  if (tap.x < roof.x) roof.x = tap.x - 0.05;
  if (tap.x > roof.x + roof.w) roof.w = tap.x - roof.x + 0.08;
  blocks.push(roof);

  // --- Progressive obstacles ---
  // Easy (0-19): one mid shelf
  if (band >= 0) {
    blocks.push({
      x: flip ? 0.35 : 0.4,
      y: 0.48 + (index % 4) * 0.02,
      w: lerp(0.2, 0.32, Math.min(1, band / 4)),
      h: 0.042
    });
  }
  // 20+: wall
  if (band >= 2) {
    blocks.push({
      x: 0.42 + (flip ? 0.06 : -0.06) + (index % 3) * 0.02,
      y: 0.32,
      w: 0.05,
      h: lerp(0.2, 0.36, d)
    });
  }
  // 30+: second shelf near cup
  if (band >= 3) {
    blocks.push({
      x: clamp(cup.x - 0.05, 0.05, 0.75),
      y: clamp(cup.y - 0.14, 0.5, 0.68),
      w: lerp(0.22, 0.36, d),
      h: 0.042
    });
  }
  // 40+: offset roof
  if (band >= 4) {
    blocks.push({
      x: clamp(tap.x + (flip ? -0.35 : 0.15), 0.05, 0.7),
      y: roofY + 0.14,
      w: lerp(0.2, 0.34, d),
      h: 0.04
    });
  }
  // 50+: gap barrier across mid with opening toward solution side
  if (band >= 5) {
    const gap = flip ? 0.28 : 0.62;
    blocks.push({ x: 0.05, y: 0.58, w: Math.max(0.1, gap - 0.14), h: 0.04 });
    blocks.push({ x: gap + 0.1, y: 0.58, w: Math.max(0.1, 0.92 - (gap + 0.1)), h: 0.04 });
  }
  // 60+: extra stub wall
  if (band >= 6) {
    blocks.push({
      x: flip ? 0.5 : 0.42,
      y: 0.4,
      w: 0.048,
      h: 0.22
    });
  }
  // 70+: low floor ledge
  if (band >= 7) {
    blocks.push({
      x: flip ? 0.4 : 0.2,
      y: 0.7,
      w: 0.28,
      h: 0.04
    });
  }
  // 80+: dense extras
  if (band >= 8) {
    blocks.push({ x: 0.3, y: 0.36, w: 0.18, h: 0.04 });
    blocks.push({ x: 0.55, y: 0.44, w: 0.18, h: 0.04 });
  }
  // 90+: hardest — tall wall + tight shelves
  if (band >= 9) {
    blocks.push({ x: 0.48, y: 0.3, w: 0.055, h: 0.42 });
    blocks.push({ x: flip ? 0.2 : 0.55, y: 0.52, w: 0.25, h: 0.04 });
  }

  // Dedup
  const cleaned = [];
  for (const b of blocks) {
    if (
      cleaned.some(
        (c) => Math.abs(c.x - b.x) < 0.03 && Math.abs(c.y - b.y) < 0.03 && Math.abs(c.w - b.w) < 0.04
      )
    ) {
      continue;
    }
    cleaned.push(b);
  }

  while (freeWin(tap, cup, cleaned)) {
    cleaned[0].w = Math.min(0.95, cleaned[0].w + 0.12);
    cleaned[0].x = clamp(tap.x - cleaned[0].w * 0.5, 0.02, 0.5);
  }

  const sol = buildSolution(tap, cup, cleaned, flip);
  // Drop obstacles that the path actually tunnels through (not ride-on-top)
  const finalBlocks = cleaned.filter((b, idx) => idx === 0 || !pathThroughBlock(sol, b, 0.028));
  while (freeWin(tap, cup, finalBlocks)) {
    finalBlocks.unshift({
      x: clamp(tap.x - 0.24, 0.03, 0.55),
      y: roofY,
      w: 0.48,
      h: 0.05
    });
  }

  const pathLen = strokeLength(sol);
  // Tight ink: early levels ~20% spare, late levels barely enough for the solution
  const ink = clamp(pathLen * lerp(1.22, 1.06, d) + lerp(0.12, 0.04, d), 0.75, 2.2);
  const need = Math.round(lerp(20, 40, d));

  return {
    id: index + 1,
    name: uniqueName(index),
    ink: Math.round(ink * 100) / 100,
    need,
    tap,
    cup,
    blocks: finalBlocks,
    _sol: sol
  };
}

function buildSolution(tap, cup, blocks, flip) {
  const roof = blocks[0];
  const cx = cup.x + cup.w * 0.5;
  const cy = cup.y + cup.h * 0.4;
  const rideY = roof.y - 0.025;
  // Exit off the cup-facing edge of the roof
  const exitX = flip ? roof.x - 0.04 : roof.x + roof.w + 0.04;

  const pts = [
    { x: tap.x, y: tap.y + 0.03 },
    { x: tap.x, y: rideY },
    { x: clamp(exitX, 0.05, 0.95), y: rideY }
  ];

  // Descend in steps toward cup, dodging walls
  const waypoints = [
    { y: 0.4 },
    { y: 0.55 },
    { y: 0.68 }
  ];
  let x = pts[pts.length - 1].x;
  for (const wp of waypoints) {
    let nx = lerp(x, cx, 0.5);
    for (const b of blocks) {
      // vertical wall dodge
      if (b.h > 0.12 && b.w < 0.1) {
        if (nx > b.x - 0.04 && nx < b.x + b.w + 0.04 && wp.y > b.y && wp.y < b.y + b.h) {
          nx = flip ? b.x - 0.06 : b.x + b.w + 0.06;
        }
      }
      // shelf: ride over or go around end
      if (b.h < 0.08 && wp.y > b.y - 0.03 && wp.y < b.y + b.h + 0.05) {
        if (nx > b.x && nx < b.x + b.w) {
          pts.push({ x: nx, y: b.y - 0.025 });
          nx = Math.abs(cx - b.x) < Math.abs(cx - (b.x + b.w)) ? b.x - 0.04 : b.x + b.w + 0.04;
        }
      }
    }
    x = clamp(nx, 0.05, 0.95);
    pts.push({ x, y: wp.y });
  }
  pts.push({ x: cx, y: Math.min(cup.y - 0.02, 0.72) });
  pts.push({ x: cx, y: cy });

  let sol = densify(pts, 0.02);
  // Push any interior intersections out
  for (let pass = 0; pass < 4; pass++) {
    sol = sol.map((p) => {
      let q = { ...p };
      for (const b of blocks) {
        if (!insideBlock(q, b, 0.03)) continue;
        const left = b.x - 0.05;
        const right = b.x + b.w + 0.05;
        q.x = Math.abs(q.x - left) < Math.abs(q.x - right) ? left : right;
        q.y = Math.min(q.y, b.y - 0.02);
        q.x = clamp(q.x, 0.04, 0.96);
        q.y = clamp(q.y, 0.05, 0.95);
      }
      return q;
    });
  }
  return densify(sol, 0.02);
}

function validate(level) {
  if (freeWin(level.tap, level.cup, level.blocks)) return { ok: false, reason: "free-win" };
  if (!level.blocks || level.blocks.length < 2) return { ok: false, reason: "too few obstacles" };
  if (Math.abs(level.tap.x - (level.cup.x + level.cup.w / 2)) < 0.3) {
    return { ok: false, reason: "cup under tap" };
  }
  const sol = level._sol;
  if (Math.abs(sol[0].x - level.tap.x) > 0.1) return { ok: false, reason: "path not under tap" };
  const end = sol[sol.length - 1];
  if (
    end.x < level.cup.x ||
    end.x > level.cup.x + level.cup.w ||
    end.y < level.cup.y ||
    end.y > level.cup.y + level.cup.h
  ) {
    return { ok: false, reason: "path misses cup" };
  }
  for (const b of level.blocks) {
    if (pathThroughBlock(sol, b, 0.025)) return { ok: false, reason: "path hits block" };
  }
  const len = strokeLength(sol);
  if (len > level.ink * 0.98) return { ok: false, reason: "ink tight" };
  return { ok: true, obstacles: level.blocks.length, len };
}

function main() {
  const levels = [];
  const fails = [];
  for (let i = 0; i < COUNT; i++) {
    let lv = buildLevel(i);
    let result = validate(lv);
    let tries = 0;
    while (!result.ok && tries < 12) {
      tries += 1;
      // Safer rebuild
      const flip = i % 2 === 1;
      lv.tap = { x: flip ? 0.8 : 0.18, y: 0.09 };
      lv.cup = {
        x: flip ? 0.12 : 0.72,
        y: 0.74,
        w: 0.13,
        h: 0.14
      };
      lv.blocks = [
        { x: flip ? 0.55 : 0.05, y: 0.28, w: 0.4, h: 0.05 },
        { x: 0.35, y: 0.5, w: 0.28, h: 0.04 }
      ];
      if (i >= 20) lv.blocks.push({ x: 0.46, y: 0.34, w: 0.05, h: 0.28 });
      if (i >= 40) lv.blocks.push({ x: lv.cup.x - 0.02, y: 0.6, w: 0.28, h: 0.04 });
      if (i >= 60) {
        lv.blocks.push({ x: 0.05, y: 0.58, w: 0.28, h: 0.04 });
        lv.blocks.push({ x: 0.55, y: 0.58, w: 0.4, h: 0.04 });
      }
      if (i >= 80) lv.blocks.push({ x: 0.48, y: 0.32, w: 0.055, h: 0.4 });
      while (freeWin(lv.tap, lv.cup, lv.blocks)) {
        lv.blocks[0].w = Math.min(0.9, lv.blocks[0].w + 0.1);
        lv.blocks[0].x = clamp(lv.tap.x - lv.blocks[0].w * 0.5, 0.02, 0.55);
      }
      lv._sol = buildSolution(lv.tap, lv.cup, lv.blocks, flip);
      lv.blocks = lv.blocks.filter((b, idx) => idx === 0 || !pathThroughBlock(lv._sol, b, 0.028));
      if (lv.blocks.length < 2) {
        lv.blocks.push({ x: 0.38, y: 0.52, w: 0.24, h: 0.04 });
      }
      while (freeWin(lv.tap, lv.cup, lv.blocks)) {
        lv.blocks.unshift({ x: lv.tap.x - 0.25, y: 0.27, w: 0.5, h: 0.05 });
      }
      lv.ink = Math.round(Math.min(2.2, strokeLength(lv._sol) * 1.12 + 0.08) * 100) / 100;
      lv.need = Math.round(lerp(20, 40, difficulty(i)));
      lv.name = uniqueName(i);
      lv.id = i + 1;
      result = validate(lv);
    }
    if (!result.ok) {
      fails.push({ id: lv.id, reason: result.reason });
      console.error(`FAIL ${lv.id}: ${result.reason}`);
    } else if ((i + 1) % 10 === 0) {
      console.log(`OK ${i + 1}/100  blocks=${result.obstacles} ink=${lv.ink} need=${lv.need}`);
    }
    const { _sol, ...pub } = lv;
    levels.push(pub);
  }

  let sparse = levels.filter((l) => l.blocks.length < 2).length;
  console.log(`sparse(<2 blocks): ${sparse}`);
  if (fails.length || sparse) {
    console.error("generation failed");
    process.exit(1);
  }

  // Spot-check free wins
  for (const lv of levels) {
    if (freeWin(lv.tap, lv.cup, lv.blocks)) {
      console.error(`free-win slipped: ${lv.id}`);
      process.exit(1);
    }
  }

  const out = path.join(__dirname, "..", "cup-flow", "levels-data.js");
  fs.writeFileSync(
    out,
    "/* Auto-generated progressive Cup Flow levels */\n" +
      `window.CUP_FLOW_LEVELS = ${JSON.stringify(levels)};\n`
  );
  console.log(`Wrote ${levels.length} levels`);
}

main();
