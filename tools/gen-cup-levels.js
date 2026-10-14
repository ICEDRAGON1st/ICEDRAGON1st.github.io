/**
 * 100 Cup Flow levels — zigzag shelves force the only route.
 * Every shelf spans nearly the full width with an alternating opening;
 * short diagonals always hit a shelf. Difficulty = more rows + tighter gaps + less ink.
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
  return { x: R(x), y: R(y), w: R(Math.max(0.05, w)), h: R(Math.max(0.05, h)) };
}
function hitsBox(p, b, pad = 0) {
  return p.x >= b.x - pad && p.x <= b.x + b.w + pad && p.y >= b.y - pad && p.y <= b.y + b.h + pad;
}
function insideBlock(p, b, pad = 0) {
  if (p.y <= b.y + 0.01) return false; // riding top is OK
  return p.x > b.x - pad && p.x < b.x + b.w + pad && p.y < b.y + b.h + pad;
}
function pathThroughBlock(pts, b, pad = 0.02) {
  return pts.some((p) => insideBlock(p, b, pad));
}
/** True only if path cuts deep through a solid (ignore top-skim densify samples). */
function pathTunnelsBlock(pts, b) {
  return pts.some(
    (p) =>
      p.x > b.x + 0.025 &&
      p.x < b.x + b.w - 0.025 &&
      p.y > b.y + 0.02 &&
      p.y < b.y + b.h - 0.005
  );
}

function freeFallWin(tap, cup, blocks) {
  for (let y = tap.y + 0.02; y < 1; y += 0.008) {
    const p = { x: tap.x, y };
    if ((blocks || []).some((b) => hitsBox(p, b))) return false;
    if (p.x >= cup.x && p.x <= cup.x + cup.w && p.y >= cup.y && p.y <= cup.y + cup.h) return true;
  }
  return false;
}

/** Near-direct routes must hit at least one solid. */
function shortBypass(tap, cup, blocks) {
  const cx = cup.x + cup.w * 0.5;
  const cy = cup.y + cup.h * 0.35;
  const start = { x: tap.x, y: tap.y + 0.04 };
  const straight = Math.hypot(cx - start.x, cy - start.y);
  const routes = [
    [start, { x: cx, y: cy }],
    [start, { x: lerp(start.x, cx, 0.5), y: 0.3 }, { x: cx, y: cy }],
    [start, { x: lerp(start.x, cx, 0.5), y: 0.5 }, { x: cx, y: cy }],
    [start, { x: start.x, y: 0.45 }, { x: cx, y: 0.45 }, { x: cx, y: cy }],
    [start, { x: cx, y: start.y + 0.12 }, { x: cx, y: cy }],
    [start, { x: start.x + Math.sign(cx - start.x) * 0.1, y: 0.28 }, { x: cx, y: cy }]
  ];
  for (const route of routes) {
    const pts = densify(route, 0.012);
    if (strokeLength(pts) > straight * 1.45) continue;
    if (!pts.some((p) => (blocks || []).some((b) => hitsBox(p, b, 0.01)))) return true;
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
    if (out.some((c) => Math.abs(c.x - b.x) < 0.02 && Math.abs(c.y - b.y) < 0.02 && Math.abs(c.w - b.w) < 0.03)) continue;
    out.push(b);
  }
  return out;
}

function buildZigzag(index, tap, cup, flip, d) {
  const blocks = [];
  const band = Math.floor(index / 10);
  const rows = 3 + (index % 4) + Math.min(3, Math.floor(band / 2)); // 3..9, varies within band
  const openW = clamp(lerp(0.22, 0.1, d) - (index % 3) * 0.015, 0.09, 0.24);
  const shelfH = 0.055;
  const margin = 0.04 + (index % 3) * 0.005;

  // Roof under tap
  const roofW = lerp(0.42, 0.58, d);
  const roofY = 0.2 + (index % 3) * 0.01;
  const roof = box(
    clamp(tap.x - roofW * (flip ? 0.28 : 0.62), 0.03, 0.52),
    roofY,
    roofW,
    shelfH
  );
  if (tap.x < roof.x) roof.x = R(tap.x - 0.06);
  if (tap.x > roof.x + roof.w) roof.w = R(tap.x - roof.x + 0.1);
  blocks.push(roof);

  // First opening on tap side, then alternate
  const openRightFirst = flip;
  const yTop = 0.28 + (index % 5) * 0.012;
  const yBot = clamp(cup.y - 0.1 - (index % 3) * 0.01, 0.54, 0.68);

  for (let r = 0; r < rows; r++) {
    const y = lerp(yTop, yBot, rows === 1 ? 0 : r / (rows - 1));
    const openRight = openRightFirst ? r % 2 === 0 : r % 2 === 1;
    if (openRight) {
      // solid left → gap on right (against right wall)
      const solidW = 1 - margin - openW - margin;
      blocks.push(box(margin, y, solidW, shelfH));
    } else {
      // gap on left → solid toward right wall, leave a tiny slip past the end
      const gapEnd = margin + openW;
      const rightEdge = 0.92;
      blocks.push(box(gapEnd, y, rightEdge - gapEnd, shelfH));
    }
  }

  // Side walls — stop running around the shelves
  blocks.push(box(0.015, 0.22, 0.04, 0.55));
  blocks.push(box(0.945, 0.22, 0.04, 0.55));

  // Cup landing shelf
  blocks.push(box(clamp(cup.x - 0.05, 0.06, 0.7), clamp(cup.y - 0.1, 0.58, 0.68), cup.w + 0.14, shelfH));

  // Mid-game+: a vertical baffle in the larger mid opening so you can't skip a row diagonally
  if (band >= 2) {
    const midRow = Math.floor(rows / 2);
    const midY = lerp(yTop, yBot, rows === 1 ? 0 : midRow / (rows - 1));
    const midOpenRight = openRightFirst ? midRow % 2 === 0 : midRow % 2 === 1;
    if (midOpenRight) {
      blocks.push(box(1 - margin - openW - 0.02, midY - 0.09, 0.045, 0.1));
    } else {
      blocks.push(box(margin + openW - 0.02, midY - 0.09, 0.045, 0.1));
    }
  }
  if (band >= 5) {
    const r2 = Math.max(1, rows - 2);
    const y2 = lerp(yTop, yBot, r2 / (rows - 1));
    const openR = openRightFirst ? r2 % 2 === 0 : r2 % 2 === 1;
    if (openR) blocks.push(box(1 - margin - openW - 0.02, y2 - 0.08, 0.045, 0.09));
    else blocks.push(box(margin + openW - 0.02, y2 - 0.08, 0.045, 0.09));
  }
  if (band >= 8) {
    blocks.push(box(0.46, 0.38, 0.05, 0.16));
  }

  return dedupe(blocks);
}

function shelfOpening(s) {
  // Left-solid shelves start near margin → opening on the right
  const openRight = s.x <= 0.1;
  const openX = openRight ? clamp(s.x + s.w + 0.06, 0.12, 0.9) : clamp(s.x - 0.06, 0.1, 0.88);
  const landX = openRight ? clamp(s.x + s.w - 0.07, 0.12, 0.88) : clamp(s.x + 0.07, 0.12, 0.88);
  return { openRight, openX, landX };
}

function buildSolution(tap, cup, blocks, flip) {
  const roof = blocks[0];
  const cx = cup.x + cup.w * 0.5;
  const cy = cup.y + cup.h * 0.4;
  const rideY = roof.y - 0.03;

  const shelves = blocks
    .filter((b) => b.h <= 0.08 && b.w >= 0.45)
    .slice()
    .sort((a, b) => a.y - b.y)
    .filter((s) => s !== roof && s.y >= 0.28 && s.y <= cup.y - 0.05);

  // Start in the first shelf's opening (tap side)
  const first = shelves[0] ? shelfOpening(shelves[0]) : { openX: flip ? 0.82 : 0.18 };
  const leaveX = first.openX;

  const pts = [
    { x: tap.x, y: tap.y + 0.03 },
    { x: tap.x, y: rideY },
    { x: leaveX, y: rideY }
  ];

  let y = rideY;
  for (let i = 0; i < shelves.length; i++) {
    const s = shelves[i];
    const { openRight, openX, landX } = shelfOpening(s);
    // Drop through this shelf's opening onto its top
    pts.push({ x: openX, y });
    pts.push({ x: openX, y: s.y - 0.03 });
    pts.push({ x: landX, y: s.y - 0.03 });
    // Ride to the far lip
    const farLip = openRight
      ? clamp(s.x + 0.06, 0.1, 0.88)
      : clamp(s.x + s.w - 0.06, 0.12, 0.9);
    pts.push({ x: farLip, y: s.y - 0.03 });
    // Slip off into the open column just past the shelf
    const slipX = openRight
      ? clamp(s.x - 0.055, 0.08, 0.9)
      : clamp(s.x + s.w + 0.055, 0.1, 0.92);
    pts.push({ x: slipX, y: s.y - 0.03 });
    // Drop a little in free air below this shelf
    const airY = i + 1 < shelves.length
      ? (s.y + shelves[i + 1].y) / 2
      : s.y + 0.04;
    pts.push({ x: slipX, y: airY });
    // Cross in free air to the NEXT opening (or cup)
    if (i + 1 < shelves.length) {
      const nextOpen = shelfOpening(shelves[i + 1]).openX;
      pts.push({ x: nextOpen, y: airY });
      y = airY;
    } else {
      y = airY;
    }
  }

  pts.push({ x: cx, y });
  pts.push({ x: cx, y: cy });

  let sol = densify(pts, 0.02);
  // Soft repair: if a point is inside a slab, lift it onto the top or slide to opening
  for (let pass = 0; pass < 10; pass++) {
    sol = sol.map((p) => {
      let q = { ...p };
      for (const b of blocks) {
        if (!insideBlock(q, b, 0.014)) continue;
        if (b.h <= 0.08 && b.w >= 0.2) {
          const { openX } = shelfOpening(b);
          // If near opening, slide out; else lift onto top
          if (Math.abs(q.x - openX) < 0.12) q.x = openX;
          else q.y = b.y - 0.03;
        } else if (b.h > 0.1) {
          const left = b.x - 0.05;
          const right = b.x + b.w + 0.05;
          q.x = Math.abs(q.x - left) < Math.abs(q.x - right) ? left : right;
        }
        q.x = clamp(q.x, 0.06, 0.94);
        q.y = clamp(q.y, 0.05, 0.95);
      }
      return q;
    });
  }
  const end = sol[sol.length - 1];
  if (end.x < cup.x || end.x > cup.x + cup.w || end.y < cup.y || end.y > cup.y + cup.h) {
    sol.push({ x: cx, y: cup.y - 0.04 }, { x: cx, y: cy });
    sol = densify(sol, 0.02);
  }
  return densify(sol, 0.02);
}

function layoutFingerprint(blocks) {
  // Fine signature: sorted rounded boxes
  return blocks
    .map((b) => `${b.x.toFixed(2)},${b.y.toFixed(2)},${b.w.toFixed(2)},${b.h.toFixed(2)}`)
    .sort()
    .join("|");
}

function buildLevel(index) {
  const d = difficulty(index);
  const flip = index % 2 === 1;
  const band = Math.floor(index / 10);

  const tap = {
    x: flip ? clamp(0.74 - (index % 4) * 0.02, 0.64, 0.8) : clamp(0.22 + (index % 4) * 0.02, 0.18, 0.34),
    y: 0.09
  };
  const cup = {
    x: flip ? clamp(0.08 + (index % 3) * 0.015, 0.05, 0.16) : clamp(0.74 - (index % 3) * 0.015, 0.72, 0.82),
    y: clamp(0.74 - band * 0.004, 0.68, 0.76),
    w: lerp(0.13, 0.1, d),
    h: lerp(0.14, 0.11, d)
  };

  let blocks = buildZigzag(index, tap, cup, flip, d);
  while (freeFallWin(tap, cup, blocks)) {
    blocks[0].w = Math.min(0.92, blocks[0].w + 0.08);
    blocks[0].x = clamp(tap.x - blocks[0].w * 0.5, 0.02, 0.5);
  }

  // If a short bypass still exists, extend the widest mid shelf toward center
  let guard = 0;
  while (shortBypass(tap, cup, blocks) && guard < 8) {
    guard += 1;
    const mid = blocks
      .filter((b) => b.h <= 0.08 && b.y > 0.32 && b.y < 0.6)
      .sort((a, b) => b.w - a.w)[0];
    if (!mid) break;
    if (mid.x <= 0.08) {
      mid.w = Math.min(0.88, mid.w + 0.06);
    } else {
      mid.x = Math.max(0.08, mid.x - 0.06);
      mid.w = Math.min(0.9, mid.w + 0.06);
    }
  }

  let sol = buildSolution(tap, cup, blocks, flip);
  // Only drop tiny baffles that the path tunnels — never drop zigzag shelves
  blocks = blocks.filter((b, i) => {
    if (i === 0) return true;
    if (b.w >= 0.2) return true; // keep shelves
    return !pathThroughBlock(sol, b, 0.02);
  });
  sol = buildSolution(tap, cup, blocks, flip);

  const rows = blocks.filter((b) => b.h <= 0.08 && b.w >= 0.45).length;
  const ink = clamp(1.05 + rows * 0.16 + d * 0.25, 1.1, 2.35);
  const need = Math.round(lerp(18, 42, d));

  return {
    id: index + 1,
    name: uniqueName(index),
    ink: Math.round(ink * 100) / 100,
    need,
    tap: { x: R(tap.x), y: R(tap.y) },
    cup: { x: R(cup.x), y: R(cup.y), w: R(cup.w), h: R(cup.h) },
    blocks: dedupe(blocks),
    _sol: sol,
    _fp: layoutFingerprint(blocks)
  };
}

function validate(level) {
  // Gameplay gates: no free-fall win, no short diagonal bypass, enough solids
  if (freeFallWin(level.tap, level.cup, level.blocks)) return { ok: false, reason: "free-fall" };
  if (shortBypass(level.tap, level.cup, level.blocks)) return { ok: false, reason: "short-bypass" };
  if (!level.blocks || level.blocks.length < 5) return { ok: false, reason: "too few" };
  if (Math.abs(level.tap.x - (level.cup.x + level.cup.w / 2)) < 0.35) return { ok: false, reason: "cup under tap" };
  const rows = level.blocks.filter((b) => b.h <= 0.08 && b.w >= 0.45).length;
  return { ok: true, obstacles: level.blocks.length, rows, ink: level.ink };
}

function main() {
  const levels = [];
  const fails = [];
  const fps = new Map();

  for (let i = 0; i < COUNT; i++) {
    let lv = null;
    let result = { ok: false };
    for (let tries = 0; tries < 16; tries++) {
      lv = buildLevel(i + (tries === 0 ? 0 : tries * 5));
      lv.id = i + 1;
      lv.name = uniqueName(i);
      // Keep side consistent with index
      if (tries > 0) {
        const flip = i % 2 === 1;
        const d = difficulty(i);
        lv.tap.x = flip
          ? clamp(0.74 - ((i + tries) % 4) * 0.02, 0.64, 0.8)
          : clamp(0.22 + ((i + tries) % 4) * 0.02, 0.18, 0.34);
        lv.cup.x = flip
          ? clamp(0.08 + ((i + tries) % 3) * 0.015, 0.05, 0.16)
          : clamp(0.74 - ((i + tries) % 3) * 0.015, 0.72, 0.82);
        lv.blocks = buildZigzag(i + tries * 5, lv.tap, lv.cup, flip, d);
        while (freeFallWin(lv.tap, lv.cup, lv.blocks)) {
          lv.blocks[0].w = Math.min(0.92, lv.blocks[0].w + 0.08);
          lv.blocks[0].x = clamp(lv.tap.x - lv.blocks[0].w * 0.5, 0.02, 0.5);
        }
        let g = 0;
        while (shortBypass(lv.tap, lv.cup, lv.blocks) && g < 8) {
          g += 1;
          const mid = lv.blocks.filter((b) => b.h <= 0.08 && b.y > 0.32 && b.y < 0.6).sort((a, b) => b.w - a.w)[0];
          if (!mid) break;
          if (mid.x <= 0.08) mid.w = Math.min(0.88, mid.w + 0.06);
          else {
            mid.x = Math.max(0.08, mid.x - 0.06);
            mid.w = Math.min(0.9, mid.w + 0.06);
          }
        }
        lv._sol = buildSolution(lv.tap, lv.cup, lv.blocks, flip);
        lv.blocks = lv.blocks.filter((b, bi) => bi === 0 || b.w >= 0.2 || !pathThroughBlock(lv._sol, b, 0.02));
        lv._sol = buildSolution(lv.tap, lv.cup, lv.blocks, flip);
        lv.ink = Math.round(Math.min(2.9, strokeLength(lv._sol) * 1.1 + 0.06) * 100) / 100;
        lv.need = Math.round(lerp(18, 42, d));
        lv._fp = layoutFingerprint(lv.blocks);
      }
      result = validate(lv);
      if (!result.ok) continue;
      if (fps.has(lv._fp) && tries < 12) {
        result = { ok: false, reason: "dup" };
        continue;
      }
      break;
    }
    if (!result.ok) {
      fails.push({ id: i + 1, reason: result.reason });
      console.error(`FAIL ${i + 1}: ${result.reason}`);
    } else {
      fps.set(lv._fp, i + 1);
      if ((i + 1) % 10 === 0) console.log(`OK ${i + 1}/100  blocks=${result.obstacles} rows=${result.rows} ink=${lv.ink}`);
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

  let leaks = 0;
  for (const lv of levels) {
    if (freeFallWin(lv.tap, lv.cup, lv.blocks) || shortBypass(lv.tap, lv.cup, lv.blocks)) leaks += 1;
  }
  console.log("bypass leaks", leaks);

  if (fails.length || leaks) {
    console.error("generation failed", fails.slice(0, 20));
    process.exit(1);
  }

  const out = path.join(__dirname, "..", "cup-flow", "levels-data.js");
  fs.writeFileSync(
    out,
    "/* Zigzag Cup Flow — every shelf blocks shortcuts; snake path only */\n" +
      `window.CUP_FLOW_LEVELS = ${JSON.stringify(levels)};\n`
  );
  console.log(`Wrote ${levels.length} levels`);
}

main();
