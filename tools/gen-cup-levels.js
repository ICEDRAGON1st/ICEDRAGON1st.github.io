/**
 * 100 unique Cup Flow levels, easiest → hardest.
 * - No free wins (shelf under tap; cup on opposite side)
 * - Dense, varied obstacles from level 1 — never empty 2-shelf clones
 * - Tight ink budgets (short efficient paths)
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

function dedupeBlocks(blocks) {
  const cleaned = [];
  for (const b of blocks) {
    if (
      cleaned.some(
        (c) => Math.abs(c.x - b.x) < 0.025 && Math.abs(c.y - b.y) < 0.025 && Math.abs(c.w - b.w) < 0.035
      )
    ) {
      continue;
    }
    cleaned.push({
      x: Math.round(b.x * 1000) / 1000,
      y: Math.round(b.y * 1000) / 1000,
      w: Math.round(b.w * 1000) / 1000,
      h: Math.round(b.h * 1000) / 1000
    });
  }
  return cleaned;
}

/** Layout themes rotate so levels don't all look like two shelves. */
function layoutBlocks(index, tap, cup, flip, d) {
  const theme = index % 5;
  const band = Math.floor(index / 10); // 0..9
  const blocks = [];

  // Always: drip roof under tap
  const roofY = 0.26 + (index % 4) * 0.012;
  const roofW = lerp(0.34, 0.5, d);
  const roof = {
    x: clamp(tap.x - roofW * (flip ? 0.32 : 0.58), 0.03, 0.62),
    y: roofY,
    w: roofW,
    h: 0.05
  };
  if (tap.x < roof.x) roof.x = tap.x - 0.06;
  if (tap.x > roof.x + roof.w) roof.w = tap.x - roof.x + 0.1;
  blocks.push(roof);

  // Theme mid-field
  if (theme === 0) {
    // staggered stairs toward cup
    blocks.push({
      x: flip ? 0.28 : 0.38,
      y: 0.42 + (index % 3) * 0.015,
      w: lerp(0.22, 0.34, d),
      h: 0.045
    });
    blocks.push({
      x: flip ? 0.12 : 0.52,
      y: 0.56 + (index % 3) * 0.012,
      w: lerp(0.2, 0.3, d),
      h: 0.042
    });
    blocks.push({
      x: clamp(cup.x - 0.04, 0.05, 0.72),
      y: clamp(cup.y - 0.12, 0.58, 0.7),
      w: lerp(0.18, 0.28, d),
      h: 0.04
    });
  } else if (theme === 1) {
    // wall + shelves
    blocks.push({
      x: flip ? 0.48 : 0.38,
      y: 0.3,
      w: 0.055,
      h: lerp(0.22, 0.38, Math.min(1, (band + 2) / 8))
    });
    blocks.push({
      x: flip ? 0.2 : 0.48,
      y: 0.5,
      w: lerp(0.24, 0.36, d),
      h: 0.042
    });
    blocks.push({
      x: flip ? 0.55 : 0.1,
      y: 0.62,
      w: lerp(0.2, 0.32, d),
      h: 0.04
    });
  } else if (theme === 2) {
    // zig-zag ledges
    blocks.push({ x: flip ? 0.45 : 0.08, y: 0.38, w: lerp(0.28, 0.4, d), h: 0.044 });
    blocks.push({ x: flip ? 0.08 : 0.45, y: 0.5, w: lerp(0.28, 0.4, d), h: 0.044 });
    blocks.push({ x: flip ? 0.4 : 0.12, y: 0.62, w: lerp(0.26, 0.38, d), h: 0.042 });
  } else if (theme === 3) {
    // funnel / gates
    blocks.push({ x: flip ? 0.55 : 0.05, y: 0.4, w: lerp(0.22, 0.34, d), h: 0.042 });
    blocks.push({ x: flip ? 0.05 : 0.55, y: 0.4, w: lerp(0.22, 0.34, d), h: 0.042 });
    blocks.push({
      x: 0.4 + (flip ? 0.05 : -0.05),
      y: 0.48,
      w: 0.05,
      h: lerp(0.16, 0.28, d)
    });
    blocks.push({
      x: clamp(cup.x - 0.06, 0.06, 0.7),
      y: 0.64,
      w: lerp(0.22, 0.34, d),
      h: 0.04
    });
  } else {
    // cup pocket + mid bridge
    blocks.push({
      x: flip ? 0.18 : 0.36,
      y: 0.4 + (index % 3) * 0.02,
      w: lerp(0.3, 0.42, d),
      h: 0.045
    });
    blocks.push({
      x: flip ? 0.5 : 0.12,
      y: 0.54,
      w: 0.05,
      h: lerp(0.18, 0.3, d)
    });
    blocks.push({
      x: clamp(cup.x - 0.08, 0.05, 0.7),
      y: clamp(cup.y - 0.1, 0.6, 0.72),
      w: cup.w + 0.12,
      h: 0.04
    });
    blocks.push({
      x: flip ? 0.08 : 0.62,
      y: 0.48,
      w: lerp(0.16, 0.24, d),
      h: 0.04
    });
  }

  // Band extras — denser as you climb
  if (band >= 1) {
    blocks.push({
      x: flip ? 0.62 : 0.08,
      y: 0.34 + (index % 2) * 0.02,
      w: lerp(0.14, 0.22, d),
      h: 0.038
    });
  }
  if (band >= 2) {
    blocks.push({
      x: 0.44 + (flip ? 0.08 : -0.08),
      y: 0.33,
      w: 0.048,
      h: lerp(0.2, 0.34, d)
    });
  }
  if (band >= 3) {
    const gap = flip ? 0.3 : 0.58;
    blocks.push({ x: 0.04, y: 0.58, w: Math.max(0.12, gap - 0.12), h: 0.038 });
    blocks.push({ x: gap + 0.08, y: 0.58, w: Math.max(0.12, 0.94 - (gap + 0.08)), h: 0.038 });
  }
  if (band >= 4) {
    blocks.push({
      x: clamp(tap.x + (flip ? -0.32 : 0.18), 0.05, 0.7),
      y: roofY + 0.12,
      w: lerp(0.18, 0.3, d),
      h: 0.038
    });
  }
  if (band >= 5) {
    blocks.push({ x: flip ? 0.52 : 0.4, y: 0.42, w: 0.046, h: 0.2 });
  }
  if (band >= 6) {
    blocks.push({ x: flip ? 0.38 : 0.22, y: 0.7, w: 0.26, h: 0.038 });
  }
  if (band >= 7) {
    blocks.push({ x: 0.3, y: 0.36, w: 0.16, h: 0.036 });
    blocks.push({ x: 0.54, y: 0.46, w: 0.16, h: 0.036 });
  }
  if (band >= 8) {
    blocks.push({ x: 0.47, y: 0.3, w: 0.052, h: 0.4 });
  }
  if (band >= 9) {
    blocks.push({ x: flip ? 0.18 : 0.55, y: 0.52, w: 0.24, h: 0.038 });
    blocks.push({ x: flip ? 0.6 : 0.1, y: 0.66, w: 0.22, h: 0.036 });
  }

  return dedupeBlocks(blocks);
}

function buildLevel(index) {
  const d = difficulty(index);
  const flip = index % 2 === 1;
  const band = Math.floor(index / 10);

  const tap = {
    x: flip ? clamp(0.78 - (index % 6) * 0.022, 0.6, 0.86) : clamp(0.16 + (index % 6) * 0.022, 0.12, 0.36),
    y: 0.09
  };
  const cup = {
    x: flip ? clamp(0.1 + (index % 5) * 0.018, 0.06, 0.26) : clamp(0.7 - (index % 5) * 0.018, 0.62, 0.8),
    y: clamp(0.74 - band * 0.008, 0.64, 0.78),
    w: lerp(0.14, 0.11, d),
    h: lerp(0.15, 0.12, d)
  };

  let blocks = layoutBlocks(index, tap, cup, flip, d);

  while (freeWin(tap, cup, blocks)) {
    blocks[0].w = Math.min(0.95, blocks[0].w + 0.1);
    blocks[0].x = clamp(tap.x - blocks[0].w * 0.5, 0.02, 0.5);
  }

  let sol = buildSolution(tap, cup, blocks, flip);
  // Drop only solids the path tunnels through (keep ride-on-top shelves)
  blocks = blocks.filter((b, idx) => idx === 0 || !pathThroughBlock(sol, b, 0.026));
  // Pack fillers that miss the verified path so the board never looks empty
  blocks = packFillers(blocks, sol, tap, cup, flip, index, d);

  while (freeWin(tap, cup, blocks)) {
    blocks.unshift({
      x: clamp(tap.x - 0.24, 0.03, 0.55),
      y: 0.27,
      w: 0.48,
      h: 0.05
    });
    blocks = dedupeBlocks(blocks);
  }

  const pathLen = strokeLength(sol);
  const ink = clamp(pathLen * lerp(1.22, 1.06, d) + lerp(0.12, 0.04, d), 0.75, 2.2);
  const need = Math.round(lerp(20, 40, d));

  return {
    id: index + 1,
    name: uniqueName(index),
    ink: Math.round(ink * 100) / 100,
    need,
    tap,
    cup,
    blocks,
    _sol: sol
  };
}

/** Add decorative / routing shelves that the solution does not tunnel through. */
function packFillers(blocks, sol, tap, cup, flip, index, d) {
  const minBlocks = index < 15 ? 4 : index < 40 ? 5 : index < 70 ? 6 : 7;
  const candidates = [
    { x: flip ? 0.58 : 0.08, y: 0.36, w: lerp(0.16, 0.24, d), h: 0.04 },
    { x: flip ? 0.08 : 0.58, y: 0.48, w: lerp(0.18, 0.28, d), h: 0.04 },
    { x: flip ? 0.52 : 0.14, y: 0.62, w: lerp(0.2, 0.3, d), h: 0.038 },
    { x: flip ? 0.18 : 0.5, y: 0.4, w: 0.048, h: lerp(0.16, 0.26, d) },
    { x: clamp(cup.x - 0.05, 0.05, 0.7), y: clamp(cup.y - 0.14, 0.56, 0.68), w: cup.w + 0.1, h: 0.038 },
    { x: flip ? 0.62 : 0.06, y: 0.54, w: 0.2, h: 0.038 },
    { x: 0.35 + (index % 5) * 0.04, y: 0.7, w: 0.22, h: 0.036 },
    { x: flip ? 0.4 : 0.48, y: 0.32, w: 0.046, h: 0.18 },
    { x: flip ? 0.1 : 0.55, y: 0.44, w: 0.22, h: 0.038 },
    { x: flip ? 0.48 : 0.22, y: 0.56, w: 0.2, h: 0.038 }
  ];
  let out = dedupeBlocks(blocks.slice());
  for (const c of candidates) {
    if (out.length >= minBlocks + 2) break;
    if (pathThroughBlock(sol, c, 0.03)) continue;
    // don't cover the tap drip column above the roof
    if (c.y < 0.28 && Math.abs(c.x + c.w / 2 - tap.x) < 0.12) continue;
    out.push(c);
    out = dedupeBlocks(out);
  }
  // Force-fill if still sparse: place small shelves far from path samples
  let guard = 0;
  while (out.length < minBlocks && guard < 20) {
    guard += 1;
    const fx = flip ? 0.08 + (guard % 5) * 0.1 : 0.55 - (guard % 5) * 0.08;
    const fy = 0.34 + (guard % 6) * 0.06;
    const filler = { x: clamp(fx, 0.05, 0.75), y: clamp(fy, 0.32, 0.72), w: 0.16, h: 0.036 };
    if (pathThroughBlock(sol, filler, 0.03)) continue;
    out.push(filler);
    out = dedupeBlocks(out);
  }
  return out;
}

function buildSolution(tap, cup, blocks, flip) {
  const roof = blocks[0];
  const cx = cup.x + cup.w * 0.5;
  const cy = cup.y + cup.h * 0.4;
  const rideY = roof.y - 0.025;
  const exitX = flip ? roof.x - 0.04 : roof.x + roof.w + 0.04;

  const pts = [
    { x: tap.x, y: tap.y + 0.03 },
    { x: tap.x, y: rideY },
    { x: clamp(exitX, 0.05, 0.95), y: rideY }
  ];

  const waypoints = [{ y: 0.4 }, { y: 0.52 }, { y: 0.64 }];
  let x = pts[pts.length - 1].x;
  for (const wp of waypoints) {
    let nx = lerp(x, cx, 0.45);
    for (const b of blocks) {
      if (b.h > 0.12 && b.w < 0.1) {
        if (nx > b.x - 0.04 && nx < b.x + b.w + 0.04 && wp.y > b.y && wp.y < b.y + b.h) {
          nx = flip ? b.x - 0.06 : b.x + b.w + 0.06;
        }
      }
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
  const minBlocks = level.id <= 15 ? 4 : level.id <= 40 ? 5 : 6;
  if (!level.blocks || level.blocks.length < minBlocks) {
    return { ok: false, reason: "too few obstacles" };
  }
  if (Math.abs(level.tap.x - (level.cup.x + level.cup.w / 2)) < 0.28) {
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
    if (pathThroughBlock(sol, b, 0.022)) return { ok: false, reason: "path hits block" };
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
    while (!result.ok && tries < 10) {
      tries += 1;
      // Rebuild with theme offset so retries look different
      const flip = i % 2 === 1;
      const d = difficulty(i);
      lv.tap = {
        x: flip
          ? clamp(0.8 - ((i + tries) % 6) * 0.02, 0.6, 0.86)
          : clamp(0.14 + ((i + tries) % 6) * 0.02, 0.12, 0.36),
        y: 0.09
      };
      lv.cup = {
        x: flip
          ? clamp(0.08 + ((i + tries) % 5) * 0.02, 0.06, 0.26)
          : clamp(0.72 - ((i + tries) % 5) * 0.02, 0.62, 0.8),
        y: 0.74,
        w: lerp(0.14, 0.11, d),
        h: lerp(0.15, 0.12, d)
      };
      let blocks = layoutBlocks(i + tries * 7, lv.tap, lv.cup, flip, d);
      while (freeWin(lv.tap, lv.cup, blocks)) {
        blocks[0].w = Math.min(0.9, blocks[0].w + 0.1);
        blocks[0].x = clamp(lv.tap.x - blocks[0].w * 0.5, 0.02, 0.55);
      }
      lv._sol = buildSolution(lv.tap, lv.cup, blocks, flip);
      blocks = blocks.filter((b, idx) => idx === 0 || !pathThroughBlock(lv._sol, b, 0.026));
      blocks = packFillers(blocks, lv._sol, lv.tap, lv.cup, flip, i, d);
      while (freeWin(lv.tap, lv.cup, blocks)) {
        blocks.unshift({ x: lv.tap.x - 0.25, y: 0.27, w: 0.5, h: 0.05 });
        blocks = dedupeBlocks(blocks);
      }
      lv.blocks = blocks;
      lv.ink = Math.round(Math.min(2.2, strokeLength(lv._sol) * 1.14 + 0.1) * 100) / 100;
      lv.need = Math.round(lerp(20, 40, d));
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

  const sparse = levels.filter((l) => l.blocks.length < 4).length;
  console.log(`sparse(<4 blocks): ${sparse}`);
  if (fails.length || sparse) {
    console.error("generation failed", fails);
    process.exit(1);
  }

  for (const lv of levels) {
    if (freeWin(lv.tap, lv.cup, lv.blocks)) {
      console.error(`free-win slipped: ${lv.id}`);
      process.exit(1);
    }
  }

  const counts = {};
  levels.forEach((l) => {
    counts[l.blocks.length] = (counts[l.blocks.length] || 0) + 1;
  });
  console.log("block histogram", counts);

  const out = path.join(__dirname, "..", "cup-flow", "levels-data.js");
  fs.writeFileSync(
    out,
    "/* Auto-generated progressive Cup Flow levels */\n" +
      `window.CUP_FLOW_LEVELS = ${JSON.stringify(levels)};\n`
  );
  console.log(`Wrote ${levels.length} levels`);
}

main();
