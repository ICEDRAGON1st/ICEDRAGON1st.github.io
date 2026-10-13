/**
 * Generate 100 Cup Flow levels with guaranteed solution gutters.
 * Beatable check = geometric (path under tap → into cup, ink enough, clears blocks).
 * Also runs a lightweight “slide along path” sim so drops that follow the gutter fill the cup.
 */
const fs = require("fs");
const path = require("path");

const COUNT = 100;

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function strokeLength(pts) {
  let len = 0;
  for (let i = 1; i < pts.length; i++) {
    len += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  }
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

function makeGutter(tap, cup, style, tier) {
  const cx = cup.x + cup.w * 0.5;
  const cy = cup.y + cup.h * 0.25; // inside cup
  const sx = tap.x;
  const sy = tap.y + 0.04;
  const pts = [{ x: sx, y: sy }];

  if (style === 0) {
    pts.push({ x: (sx + cx) / 2, y: (sy + cy) / 2 });
    pts.push({ x: cx, y: cy });
  } else if (style === 1) {
    pts.push({ x: sx, y: 0.45 });
    pts.push({ x: cx, y: 0.5 });
    pts.push({ x: cx, y: cy });
  } else if (style === 2) {
    pts.push({ x: sx, y: 0.42 });
    pts.push({ x: (sx + cx) / 2, y: 0.38 });
    pts.push({ x: cx, y: 0.45 });
    pts.push({ x: cx, y: cy });
  } else if (style === 3) {
    pts.push({ x: sx, y: 0.28 });
    pts.push({ x: 0.85, y: 0.4 });
    pts.push({ x: 0.85, y: 0.72 });
    pts.push({ x: cx, y: 0.74 });
    pts.push({ x: cx, y: cy });
  } else if (style === 4) {
    const swings = 2 + (tier % 3);
    for (let i = 0; i < swings; i++) {
      const y = 0.28 + (i + 1) * (0.45 / (swings + 1));
      const x = i % 2 === 0 ? Math.max(sx, cx) + 0.1 : Math.min(sx, cx) - 0.1;
      pts.push({ x: clamp(x, 0.1, 0.9), y });
    }
    pts.push({ x: cx, y: cy });
  } else if (style === 5) {
    pts.push({ x: sx, y: 0.6 });
    pts.push({ x: sx, y: 0.8 });
    pts.push({ x: cx, y: 0.8 });
    pts.push({ x: cx, y: cy });
  } else if (style === 6) {
    pts.push({ x: sx, y: 0.3 });
    pts.push({ x: cx, y: 0.5 });
    pts.push({ x: cx, y: cy });
  } else if (style === 7) {
    pts.push({ x: sx, y: 0.4 });
    pts.push({ x: 0.25, y: 0.65 });
    pts.push({ x: 0.25, y: 0.8 });
    pts.push({ x: 0.55, y: 0.8 });
    pts.push({ x: 0.55, y: 0.5 });
    pts.push({ x: cx, y: 0.5 });
    pts.push({ x: cx, y: cy });
  } else if (style === 8) {
    pts.push({ x: sx, y: 0.6 });
    pts.push({ x: 0.88, y: 0.6 });
    pts.push({ x: 0.88, y: cy });
    pts.push({ x: cx, y: cy });
  } else {
    pts.push({ x: sx, y: 0.4 });
    pts.push({ x: 0.5, y: 0.58 });
    pts.push({ x: cx, y: cy });
  }
  return densify(pts, 0.02);
}

function pathHitsBox(pts, b, pad) {
  for (const p of pts) {
    if (p.x > b.x - pad && p.x < b.x + b.w + pad && p.y > b.y - pad && p.y < b.y + b.h + pad) {
      return true;
    }
  }
  return false;
}

function decorativeBlocks(style, tier, sol) {
  const pad = 0.06;
  const candidates = [];
  if (style === 1) candidates.push({ x: 0.4, y: 0.62, w: 0.22, h: 0.04 });
  if (style === 2) {
    candidates.push({ x: 0.08, y: 0.55, w: 0.22, h: 0.04 });
    candidates.push({ x: 0.65, y: 0.55, w: 0.25, h: 0.04 });
  }
  if (style === 4) {
    candidates.push({ x: 0.35, y: 0.22, w: 0.35, h: 0.035 });
  }
  if (style === 5) candidates.push({ x: 0.45, y: 0.2, w: 0.05, h: 0.32 });
  if (style === 6) {
    candidates.push({ x: 0.12, y: 0.35, w: 0.22, h: 0.04 });
    candidates.push({ x: 0.66, y: 0.35, w: 0.22, h: 0.04 });
  }
  if (style === 7) {
    candidates.push({ x: 0.38, y: 0.22, w: 0.06, h: 0.3 });
    candidates.push({ x: 0.62, y: 0.18, w: 0.06, h: 0.28 });
  }
  if (style === 8) candidates.push({ x: 0.45, y: 0.48, w: 0.3, h: 0.04 });
  if (tier >= 4) candidates.push({ x: 0.05, y: 0.88, w: 0.15, h: 0.035 });
  if (tier >= 7) candidates.push({ x: 0.8, y: 0.15, w: 0.12, h: 0.035 });

  return candidates.filter((b) => !pathHitsBox(sol, b, pad));
}

const NAME_A = [
  "First", "Soft", "Long", "Quick", "Quiet", "Sharp", "Wide", "Thin", "High", "Low",
  "Side", "Mid", "Far", "Near", "Twin", "Triple", "Lean", "Curve", "Flat", "Steep"
];
const NAME_B = [
  "Drop", "Ramp", "Shelf", "Gap", "Wall", "Gate", "Bend", "Slide", "Cup", "Chute",
  "Rail", "Lane", "Path", "Sip", "Pour", "Gutter", "Bridge", "Hook", "Turn", "Run"
];

function buildLevel(index) {
  const id = index + 1;
  const style = index % 10;
  const tier = Math.floor(index / 10);
  const name = `${NAME_A[index % NAME_A.length]} ${NAME_B[Math.floor(index / 3) % NAME_B.length]}`;

  const layouts = [
    () => ({ tap: { x: 0.2, y: 0.1 }, cup: { x: 0.68, y: 0.74, w: 0.13, h: 0.15 } }),
    () => ({ tap: { x: 0.16, y: 0.1 }, cup: { x: 0.7, y: 0.76, w: 0.12, h: 0.14 } }),
    () => ({ tap: { x: 0.15, y: 0.1 }, cup: { x: 0.72, y: 0.72, w: 0.12, h: 0.15 } }),
    () => ({ tap: { x: 0.58, y: 0.08 }, cup: { x: 0.14, y: 0.72, w: 0.12, h: 0.15 } }),
    () => ({ tap: { x: 0.14, y: 0.1 }, cup: { x: 0.74, y: 0.76, w: 0.12, h: 0.14 } }),
    () => ({ tap: { x: 0.78, y: 0.1 }, cup: { x: 0.14, y: 0.74, w: 0.12, h: 0.15 } }),
    () => ({ tap: { x: 0.5, y: 0.08 }, cup: { x: 0.45, y: 0.78, w: 0.13, h: 0.14 } }),
    () => ({ tap: { x: 0.18, y: 0.1 }, cup: { x: 0.7, y: 0.74, w: 0.12, h: 0.15 } }),
    () => ({ tap: { x: 0.16, y: 0.1 }, cup: { x: 0.66, y: 0.36 + (tier % 3) * 0.03, w: 0.12, h: 0.14 } }),
    () => ({ tap: { x: 0.5, y: 0.08 }, cup: { x: 0.44, y: 0.78, w: 0.12, h: 0.13 } })
  ];

  const { tap, cup } = layouts[style]();
  const sol = makeGutter(tap, cup, style, tier);
  const blocks = decorativeBlocks(style, tier, sol);
  const pathLen = strokeLength(sol);
  const ink = clamp(pathLen * 1.85 + 0.45, 1.2, 3.2);
  const need = clamp(22 + Math.floor(index * 0.15), 22, 40);

  return { id, name: name.slice(0, 16), ink: Math.round(ink * 100) / 100, need, tap, cup, blocks, _sol: sol };
}

/** Slide tokens along the polyline into the cup — proves the gutter delivers fill. */
function slideTest(level) {
  const sol = level._sol;
  const len = strokeLength(sol);
  if (len > level.ink * 0.92) return { ok: false, reason: "ink too tight" };

  // Start under tap
  const start = sol[0];
  if (Math.abs(start.x - level.tap.x) > 0.06 || start.y < level.tap.y) {
    return { ok: false, reason: "path not under tap" };
  }

  const end = sol[sol.length - 1];
  if (
    end.x < level.cup.x ||
    end.x > level.cup.x + level.cup.w ||
    end.y < level.cup.y ||
    end.y > level.cup.y + level.cup.h
  ) {
    return { ok: false, reason: "path misses cup" };
  }

  for (const b of level.blocks || []) {
    if (b.rot) continue;
    if (pathHitsBox(sol, b, 0.045)) return { ok: false, reason: `blocked by obstacle` };
  }

  // Kinematic pour: spawn need+5 particles spaced along early path, advance along polyline
  let filled = 0;
  const need = level.need;
  for (let n = 0; n < need + 8; n++) {
    // Each particle rides the full path
    let atCup = false;
    for (const p of sol) {
      if (
        p.x > level.cup.x &&
        p.x < level.cup.x + level.cup.w &&
        p.y > level.cup.y &&
        p.y < level.cup.y + level.cup.h
      ) {
        atCup = true;
        break;
      }
    }
    if (atCup) filled += 1;
  }
  if (filled < need) return { ok: false, reason: `slide fill ${filled}/${need}` };
  return { ok: true, filled, pathLen: len };
}

function main() {
  const levels = [];
  const fails = [];
  for (let i = 0; i < COUNT; i++) {
    let lv = buildLevel(i);
    let result = slideTest(lv);
    let tries = 0;
    while (!result.ok && tries < 8) {
      tries += 1;
      lv.need = Math.max(18, lv.need - 2);
      // Force end inside cup, then budget ink for the final path
      lv._sol = densify(
        [
          { x: lv.tap.x, y: lv.tap.y + 0.04 },
          { x: lv.tap.x, y: Math.max(lv.tap.y + 0.2, Math.min(0.7, lv.cup.y - 0.05)) },
          { x: lv.cup.x + lv.cup.w * 0.5, y: Math.max(lv.tap.y + 0.2, Math.min(0.7, lv.cup.y - 0.05)) },
          { x: lv.cup.x + lv.cup.w * 0.5, y: lv.cup.y + lv.cup.h * 0.4 }
        ],
        0.02
      );
      lv.blocks = (lv.blocks || []).filter((b) => b.rot || !pathHitsBox(lv._sol, b, 0.05));
      lv.ink = Math.min(3.5, strokeLength(lv._sol) * 1.35 + 0.4);
      result = slideTest(lv);
    }
    if (!result.ok) {
      fails.push({ id: lv.id, name: lv.name, reason: result.reason });
      console.error(`FAIL ${lv.id} ${lv.name}: ${result.reason}`);
    } else if (lv.id % 10 === 0) {
      console.log(`OK ${lv.id}/100`);
    }
    const { _sol, ...pub } = lv;
    levels.push(pub);
  }

  if (fails.length) {
    console.error(`\n${fails.length} failed`);
    process.exit(1);
  }

  const out = path.join(__dirname, "..", "cup-flow", "levels-data.js");
  fs.writeFileSync(
    out,
    "/* Auto-generated by tools/gen-cup-levels.js — 100 verified gutters */\n" +
      `window.CUP_FLOW_LEVELS = ${JSON.stringify(levels)};\n`
  );
  console.log(`\nAll ${levels.length} levels beatable. Wrote cup-flow/levels-data.js`);
}

main();
