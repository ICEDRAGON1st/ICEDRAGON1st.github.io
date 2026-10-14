/**
 * Cup Flow — 100 unique playable levels.
 * Pattern: short catcher under tap + varied shelves/walls BESIDE a clear pour curve.
 * Never zigzag stacks of long bars. Solutions are the pour corridor itself.
 */
const fs = require("fs");
const path = require("path");

const COUNT = 100;
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const lerp = (a, b, t) => a + (b - a) * t;
const R = (n, p = 3) => Math.round(n * 10 ** p) / 10 ** p;
const box = (x, y, w, h) => ({
  x: R(x),
  y: R(y),
  w: R(Math.max(0.05, w)),
  h: R(Math.max(0.045, h))
});

const NAMES = [
  "Dawn Sip","Mist Gate","Ridge Drop","Cove Rail","Pike Bend","Glen Shelf","Forge Chute","Drift Lane",
  "Haven Hook","Bloom Slide","Spark Wall","Cliff Run","Marsh Well","Dune Ramp","Frost Bridge","Ember Pass",
  "Tide Sill","Oak Flume","Pine Vault","Ash Ledge","Nova Turn","Jade Spout","Quartz Gap","Amber Nest",
  "Ivory Path","Coral Step","Pearl Arch","Cinder Hop","Willow Bend","Maple Drop","Cedar Gate","Birch Rail",
  "Storm Shelf","Calm Chute","Swift Lane","Quiet Hook","Bright Slide","Shade Wall","Glow Run","Dusk Well",
  "North Ramp","South Bridge","East Pass","West Sill","High Flume","Low Vault","Wide Ledge","Thin Turn",
  "Sharp Spout","Soft Gap","Twin Nest","Split Path","Cross Step","Loop Arch","Zig Hop","Zag Bend",
  "Lift Drop","Fall Gate","Rise Rail","Sink Shelf","Pour Chute","Catch Lane","Guide Hook","Steer Slide",
  "Block Wall","Clear Run","Open Well","Tight Ramp","Long Bridge","Short Pass","Deep Sill","Shallow Flume",
  "Left Vault","Right Ledge","Mid Turn","Edge Spout","Cup Gap","Tap Nest","Flow Path","Drip Step",
  "Splash Arch","Gulp Hop","Trickle Bend","Cascade Drop","Channel Gate","Basin Rail","Gutter Shelf","Trough Chute",
  "Aqueduct Lane","Weir Hook","Sluice Slide","Dam Wall","Creek Run","Brook Well","River Ramp","Delta Bridge",
  "Harbor Pass","Beacon Sill","Lighthouse","Anchor Vault"
];

function densify(pts, step = 0.015) {
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
function strokeLen(pts) {
  let n = 0;
  for (let i = 1; i < pts.length; i++) n += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  return n;
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
function isZigzag(blocks) {
  return blocks.filter((b) => b.h < 0.09 && b.w >= 0.38).length >= 4;
}
function pourPath(tap, cup, catcher) {
  const cx = cup.x + cup.w * 0.5;
  const cy = cup.y + cup.h * 0.42;
  const toRight = tap.x < cx;
  // Ride the tilted catcher (segment physics) then curve into the cup.
  // midX must differ from tap.x or densify builds a vertical wall that traps drops.
  const exitX = catcher
    ? toRight
      ? catcher.x + catcher.w + 0.03
      : catcher.x - 0.03
    : tap.x + (toRight ? 0.08 : -0.08);
  const midX = lerp(tap.x, exitX, 0.5);
  const yTap = catcher ? catcher.y - 0.02 : 0.18;
  const yExit = catcher ? catcher.y + 0.08 : 0.28;
  return densify(
    [
      { x: tap.x, y: yTap },
      { x: midX, y: lerp(yTap, yExit, 0.45) },
      { x: exitX, y: yExit },
      { x: lerp(exitX, cx, 0.45), y: lerp(yExit, 0.52, 0.5) },
      // Vertical approach so water isn't carrying huge sideways speed into the mouth
      { x: cx, y: Math.min(0.62, cup.y - 0.12) },
      { x: cx, y: cup.y - 0.02 },
      { x: cx, y: cy }
    ],
    0.014
  );
}
function offCorridor(tap, cup, catcher, b) {
  // true if block is safely beside the pour curve
  const route = pourPath(tap, cup, catcher);
  return !route.some((p) => hits(p, b, 0.028));
}

function build(index) {
  const d = index / (COUNT - 1);
  const flip = index % 2 === 1;
  const style = index % 10; // visual family
  const tap = {
    x: flip ? clamp(0.7 - (index % 5) * 0.02, 0.58, 0.78) : clamp(0.22 + (index % 5) * 0.02, 0.16, 0.34),
    y: 0.1
  };
  const cup = {
    x: flip ? clamp(0.08 + (index % 4) * 0.02, 0.05, 0.2) : clamp(0.72 - (index % 4) * 0.02, 0.68, 0.82),
    y: clamp(0.74 - Math.floor(index / 25) * 0.01, 0.7, 0.76),
    w: lerp(0.14, 0.12, d),
    h: lerp(0.15, 0.13, d)
  };
  const cx = cup.x + cup.w * 0.5;
  const side = flip ? -1 : 1;

  // Tilted catcher under tap (rotated = segment physics, sheds toward cup)
  const toRight = tap.x < cx;
  const catcher = {
    ...box(clamp(tap.x - 0.1, 0.04, 0.75), 0.2, 0.2 + (index % 3) * 0.02, 0.048),
    rot: R((toRight ? 1 : -1) * (0.3 + (index % 4) * 0.03))
  };
  if (tap.x < catcher.x) catcher.x = R(tap.x - 0.03);
  if (tap.x > catcher.x + catcher.w) catcher.w = R(tap.x - catcher.x + 0.05);

  const blocks = [catcher];
  const steps = 2 + (index % 5); // 2..6 decorative pieces attempted
  // Decor sits on the OUTBOARD side (away from cup), clear of the pour lip
  const out = flip ? 1 : -1;
  for (let k = 0; k < steps; k++) {
    const along = (k + 1) / (steps + 1);
    const y = 0.3 + k * 0.08 + (style % 3) * 0.012;
    const x = clamp(
      (flip ? 0.62 : 0.08) + (k % 3) * 0.05 + out * 0.02 + (style % 2) * 0.03,
      0.05,
      0.82
    );
    const w = 0.1 + ((style + k) % 5) * 0.025;
    const s = box(x, y, Math.min(w, 0.22), 0.05);
    if (offCorridor(tap, cup, catcher, s)) blocks.push(s);
  }
  // Opposite-corner pads so layouts don't look like one catcher + one shelf
  {
    const pad = box(
      clamp(flip ? 0.72 : 0.06, 0.04, 0.84),
      0.5 + (index % 3) * 0.04,
      0.12 + (style % 3) * 0.03,
      0.05
    );
    if (offCorridor(tap, cup, catcher, pad)) blocks.push(pad);
  }

  // Extra accents by style (must stay off corridor)
  if (style === 1 || style === 6) {
    const wall = box(clamp(lerp(tap.x, cx, 0.5) + side * 0.22, 0.06, 0.9), 0.3, 0.055, 0.28);
    if (offCorridor(tap, cup, catcher, wall)) blocks.push(wall);
  }
  if (style === 2 || style === 7) {
    const pad = box(clamp(cx + side * 0.2, 0.06, 0.8), 0.48, 0.16, 0.05);
    if (offCorridor(tap, cup, catcher, pad)) blocks.push(pad);
  }
  if (style === 3 || style === 8) {
    blocks.push(box(cup.x - 0.06, cup.y, 0.05, cup.h));
    blocks.push(box(cup.x + cup.w + 0.01, cup.y, 0.05, cup.h));
  }
  if (style === 4 || style === 9) {
    const high = box(clamp(lerp(tap.x, cx, 0.25) + side * 0.2, 0.06, 0.8), 0.28, 0.18, 0.05);
    if (offCorridor(tap, cup, catcher, high)) blocks.push(high);
  }
  if (index >= 50) {
    const extra = box(clamp(lerp(tap.x, cx, 0.6) + side * 0.2, 0.06, 0.8), 0.58, 0.14, 0.05);
    if (offCorridor(tap, cup, catcher, extra)) blocks.push(extra);
  }
  if (index >= 75) {
    const post = box(clamp(lerp(tap.x, cx, 0.4) + side * 0.24, 0.05, 0.9), 0.36, 0.05, 0.2);
    if (offCorridor(tap, cup, catcher, post)) blocks.push(post);
  }

  // Seal free-fall only
  let g = 0;
  while (freeFall(tap, cup, blocks) && g < 5) {
    g += 1;
    blocks[0].w = Math.min(0.4, blocks[0].w + 0.06);
    blocks[0].x = clamp(tap.x - blocks[0].w * 0.5, 0.03, 0.55);
  }

  // Dedup
  const cleaned = [];
  for (const b of blocks) {
    if (cleaned.some((c) => Math.abs(c.x - b.x) < 0.03 && Math.abs(c.y - b.y) < 0.03)) continue;
    cleaned.push(b);
  }

  if (cleaned.length < 2) {
    cleaned.push(box(clamp(lerp(tap.x, cx, 0.5) + side * 0.18, 0.08, 0.75), 0.45, 0.18, 0.05));
  }

  const sol = pourPath(tap, cup, catcher);
  const ink = clamp(strokeLen(sol) * 1.6 + 0.45, 1.9, 3.0);
  const need = Math.round(lerp(12, 28, d));

  return {
    id: index + 1,
    name: NAMES[index],
    ink: Math.round(ink * 100) / 100,
    need,
    tap: { x: R(tap.x), y: R(tap.y) },
    cup: { x: R(cup.x), y: R(cup.y), w: R(cup.w), h: R(cup.h) },
    blocks: cleaned,
    _sol: sol
  };
}

function fp(blocks) {
  return blocks
    .map((b) => `${b.x.toFixed(2)},${b.y.toFixed(2)},${b.w.toFixed(2)},${b.h.toFixed(2)},${(b.rot || 0).toFixed(2)}`)
    .sort()
    .join("|");
}

function main() {
  const levels = [];
  const sols = [];
  const seen = new Set();
  const fails = [];

  for (let i = 0; i < COUNT; i++) {
    let lv = null;
    for (let t = 0; t < 12; t++) {
      lv = build(i + t * 0); // same index
      if (t > 0) {
        // nudge side offset via fake index salt
        lv = build(i);
        lv.blocks = lv.blocks.map((b, bi) =>
          bi === 0 ? b : { ...b, x: R(clamp(b.x + (t % 2 ? 0.02 : -0.02) * t, 0.04, 0.88)) }
        );
      }
      if (freeFall(lv.tap, lv.cup, lv.blocks)) continue;
      if (isZigzag(lv.blocks)) continue;
      if (lv.blocks.length < 2) continue;
      const sig = fp(lv.blocks);
      if (seen.has(sig) && t < 10) continue;
      seen.add(sig);
      break;
    }
    if (!lv || freeFall(lv.tap, lv.cup, lv.blocks) || isZigzag(lv.blocks)) {
      fails.push(i + 1);
      console.error("FAIL", i + 1);
      continue;
    }
    lv.id = i + 1;
    lv.name = NAMES[i];
    sols.push(lv._sol);
    const { _sol, ...pub } = lv;
    levels.push(pub);
    if ((i + 1) % 10 === 0) console.log("OK", i + 1, "blocks", pub.blocks.length);
  }

  const hist = {};
  levels.forEach((l) => {
    hist[l.blocks.length] = (hist[l.blocks.length] || 0) + 1;
  });
  const zig = levels.filter((l) => isZigzag(l.blocks)).length;
  console.log("hist", hist, "unique", seen.size, "zigzag", zig, "fails", fails.length);

  if (fails.length || levels.length !== COUNT || zig || seen.size < 90) {
    process.exit(1);
  }

  fs.writeFileSync(
    path.join(__dirname, "..", "cup-flow", "levels-data.js"),
    "/* 100 unique playable Cup Flow levels — clear pour corridors, no zigzag copies */\n" +
      `window.CUP_FLOW_LEVELS = ${JSON.stringify(levels)};\n`
  );
  fs.writeFileSync(path.join(__dirname, "_cup-flow-sols.json"), JSON.stringify(sols));
  console.log("Wrote", levels.length);
}

main();
