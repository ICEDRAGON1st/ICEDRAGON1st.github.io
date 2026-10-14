/**
 * 100 unique, playable Cup Flow levels.
 * Each level gets its own layout recipe (not a 20-kit repeat).
 * Short platforms, open cup mouth, generous ink, clear drawable route.
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
  return { x: R(x), y: R(y), w: R(Math.max(0.05, w)), h: R(Math.max(0.045, h)) };
}
function hits(p, b, pad = 0) {
  return (
    p.x >= b.x - pad &&
    p.x <= b.x + b.w + pad &&
    p.y >= b.y - pad &&
    p.y <= b.y + b.h + pad
  );
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
function densify(pts, step = 0.022) {
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
  "Harbor Pass","Beacon Sill","Lighthouse Flume","Anchor Vault"
];

function uniqueName(i) {
  return NAMES[i % NAMES.length];
}

/** Keep cup mouth open — never seal the top entry. */
function openCupMouth(cup, blocks) {
  const mx = cup.x + cup.w * 0.5;
  const top = cup.y;
  return blocks.filter((b) => {
    const coversMouth =
      b.y + b.h > top - 0.04 &&
      b.y < top + 0.06 &&
      b.x < mx + 0.04 &&
      b.x + b.w > mx - 0.04 &&
      b.h < 0.1;
    return !coversMouth;
  });
}

function shortBypass(tap, cup, blocks) {
  const cx = cup.x + cup.w * 0.5;
  const cy = cup.y + cup.h * 0.35;
  const start = { x: tap.x, y: tap.y + 0.04 };
  const routes = [
    [start, { x: cx, y: cy }],
    [start, { x: lerp(start.x, cx, 0.5), y: 0.35 }, { x: cx, y: cy }],
    [start, { x: start.x, y: 0.55 }, { x: cx, y: 0.55 }, { x: cx, y: cy }],
    [start, { x: lerp(start.x, cx, 0.35), y: 0.28 }, { x: lerp(start.x, cx, 0.7), y: 0.45 }, { x: cx, y: cy }]
  ];
  for (const route of routes) {
    const pts = densify(route, 0.015);
    if (!pts.some((p) => blocks.some((b) => hits(p, b, 0.012)))) return true;
  }
  return false;
}

function rideAbove(b, t = 0.5) {
  return { x: b.x + b.w * t, y: b.y - 0.028 };
}

/**
 * 100 distinct recipes. Index picks exactly one — no cycling the same kit.
 * Returns { blocks, waypoints }.
 */
function layout(index, tap, cup, flip) {
  const dir = flip ? -1 : 1;
  const cupX = cup.x + cup.w * 0.5;
  const cupY = cup.y + cup.h * 0.35;
  const near = flip ? 0.55 : 0.2;
  const far = flip ? 0.15 : 0.55;
  const j = ((index * 13) % 7) * 0.012;
  const blocks = [];
  let waypoints = [{ x: tap.x, y: tap.y + 0.04 }];

  const add = (...bs) => {
    for (const b of bs) blocks.push(b);
  };
  const go = (...pts) => {
    for (const p of pts) waypoints.push(p);
  };

  // Catch under tap — shape varies by recipe family
  const catchStyle = index % 5;
  let catcher;
  if (catchStyle === 0) {
    catcher = box(clamp(tap.x - 0.14, 0.04, 0.7), 0.22 + (index % 3) * 0.01, 0.28 + (index % 4) * 0.02, 0.05);
  } else if (catchStyle === 1) {
    catcher = box(clamp(tap.x - 0.08, 0.04, 0.75), 0.2, 0.18, 0.08);
  } else if (catchStyle === 2) {
    catcher = box(clamp(tap.x - 0.2, 0.03, 0.65), 0.24, 0.38, 0.05);
  } else if (catchStyle === 3) {
    catcher = box(clamp(tap.x - 0.06, 0.05, 0.8), 0.21, 0.14, 0.12); // stubby post under tap
  } else {
    catcher = box(clamp(tap.x - 0.16, 0.04, 0.7), 0.23, 0.32, 0.05);
  }
  // Ensure tap is over catcher
  if (tap.x < catcher.x) catcher.x = R(tap.x - 0.04);
  if (tap.x > catcher.x + catcher.w) catcher.w = R(tap.x - catcher.x + 0.06);
  add(catcher);
  const exitX = flip ? catcher.x - 0.04 : catcher.x + catcher.w + 0.04;
  go(rideAbove(catcher, flip ? 0.25 : 0.75), { x: clamp(exitX, 0.08, 0.92), y: catcher.y - 0.028 });

  const recipe = index; // 0..99 unique

  switch (recipe) {
    case 0: {
      const a = box(0.3 + j, 0.4, 0.2, 0.05);
      const b = box(cupX - 0.1, 0.56, 0.2, 0.05);
      add(a, b);
      go(rideAbove(a), rideAbove(b));
      break;
    }
    case 1: {
      const a = box(far, 0.36, 0.36, 0.05);
      const b = box(cupX - 0.09, 0.55, 0.2, 0.05);
      add(a, b);
      go(rideAbove(a, flip ? 0.2 : 0.8), rideAbove(b));
      break;
    }
    case 2: {
      const wall = box(0.48, 0.28, 0.06, 0.34);
      const a = box(far, 0.48, 0.24, 0.05);
      const b = box(cupX - 0.1, 0.64, 0.2, 0.05);
      add(wall, a, b);
      go({ x: flip ? wall.x - 0.06 : wall.x + wall.w + 0.06, y: 0.38 }, rideAbove(a), rideAbove(b));
      break;
    }
    case 3: {
      const a = box(near, 0.36, 0.26, 0.05);
      const b = box(far, 0.5, 0.26, 0.05);
      const c = box(cupX - 0.1, 0.64, 0.2, 0.05);
      add(a, b, c);
      go(rideAbove(a), rideAbove(b), rideAbove(c));
      break;
    }
    case 4: {
      for (let i = 0; i < 3; i++) {
        const x = flip ? 0.55 - i * 0.12 : 0.22 + i * 0.12;
        const s = box(x + j * 0.3, 0.34 + i * 0.1, 0.2, 0.05);
        add(s);
        go(rideAbove(s));
      }
      break;
    }
    case 5: {
      // Pocket walls beside cup — lid OFF so mouth stays open
      const shelf = box(near + 0.05, 0.42, 0.3, 0.05);
      const L = box(cup.x - 0.06, cup.y - 0.01, 0.05, cup.h + 0.04);
      const R = box(cup.x + cup.w + 0.01, cup.y - 0.01, 0.05, cup.h + 0.04);
      add(shelf, L, R);
      go(rideAbove(shelf), { x: cupX, y: cup.y - 0.05 });
      break;
    }
    case 6: {
      const a = box(0.08, 0.4, 0.28, 0.05);
      const b = box(0.58, 0.4, 0.28, 0.05);
      const c = box(cupX - 0.1, 0.58, 0.22, 0.05);
      add(a, b, c);
      go(rideAbove(flip ? b : a), rideAbove(flip ? a : b), rideAbove(c));
      break;
    }
    case 7: {
      const wall = box(flip ? 0.32 : 0.58, 0.26, 0.055, 0.42);
      const a = box(far, 0.5, 0.26, 0.05);
      const b = box(cupX - 0.1, 0.66, 0.2, 0.05);
      add(wall, a, b);
      go({ x: flip ? wall.x + wall.w + 0.06 : wall.x - 0.06, y: 0.4 }, rideAbove(a), rideAbove(b));
      break;
    }
    case 8: {
      const L = box(0.06, 0.4, 0.26, 0.05);
      const R = box(0.6, 0.4, 0.28, 0.05);
      const post = box(0.45, 0.4, 0.05, 0.22);
      const c = box(cupX - 0.1, 0.64, 0.22, 0.05);
      add(L, R, post, c);
      go(rideAbove(flip ? R : L, flip ? 0.3 : 0.7), { x: flip ? post.x - 0.06 : post.x + post.w + 0.06, y: 0.52 }, rideAbove(c));
      break;
    }
    case 9: {
      const a = box(0.16 + j, 0.34, 0.48, 0.05);
      const wall = box(0.46, 0.36, 0.05, 0.22);
      const b = box(far, 0.58, 0.26, 0.05);
      add(a, wall, b);
      go(rideAbove(a, flip ? 0.2 : 0.8), { x: flip ? wall.x + wall.w + 0.05 : wall.x - 0.05, y: 0.5 }, rideAbove(b));
      break;
    }
    case 10: {
      const a = box(near, 0.36, 0.34, 0.05);
      const v = box(flip ? near : near + 0.29, 0.36, 0.05, 0.2);
      const b = box(far, 0.54, 0.34, 0.05);
      const c = box(cupX - 0.09, 0.68, 0.18, 0.05);
      add(a, v, b, c);
      go(rideAbove(a), { x: flip ? v.x - 0.05 : v.x + v.w + 0.05, y: 0.48 }, rideAbove(b), rideAbove(c));
      break;
    }
    case 11: {
      for (let i = 0; i < 4; i++) {
        const x = lerp(tap.x, cupX, (i + 1) / 5) - 0.07 + (i % 2) * 0.05 * dir;
        const s = box(clamp(x, 0.08, 0.76), 0.34 + i * 0.08, 0.15, 0.05);
        add(s);
        go(rideAbove(s));
      }
      break;
    }
    case 12: {
      const w1 = box(0.34, 0.3, 0.05, 0.26);
      const w2 = box(0.54, 0.3, 0.05, 0.26);
      const a = box(far, 0.5, 0.22, 0.05);
      const b = box(cupX - 0.1, 0.66, 0.2, 0.05);
      add(w1, w2, a, b);
      go({ x: 0.44, y: 0.36 }, rideAbove(a), rideAbove(b));
      break;
    }
    case 13: {
      for (let i = 0; i < 3; i++) {
        const x = flip ? 0.18 + i * 0.1 : 0.48 - i * 0.1 + j;
        const s = box(clamp(x, 0.08, 0.7), 0.36 + i * 0.1, 0.28 - i * 0.03, 0.05);
        add(s);
        go(rideAbove(s, flip ? 0.65 : 0.35));
      }
      break;
    }
    case 14: {
      const a = box(0.08, 0.36, 0.26, 0.05);
      const b = box(0.54, 0.36, 0.28, 0.05);
      const c = box(0.28, 0.52, 0.32, 0.05);
      const d = box(cupX - 0.1, 0.66, 0.2, 0.05);
      add(a, b, c, d);
      go(rideAbove(flip ? b : a), rideAbove(c), rideAbove(d));
      break;
    }
    case 15: {
      const wall = box(flip ? catcher.x - 0.07 : catcher.x + catcher.w + 0.01, 0.22, 0.055, 0.3);
      const a = box(far, 0.5, 0.28, 0.05);
      const b = box(cupX - 0.1, 0.66, 0.2, 0.05);
      add(wall, a, b);
      go({ x: flip ? wall.x - 0.05 : wall.x + wall.w + 0.05, y: 0.36 }, rideAbove(a), rideAbove(b));
      break;
    }
    case 16: {
      const pads = [
        box(0.12, 0.36, 0.18, 0.05),
        box(0.4, 0.36, 0.18, 0.05),
        box(0.26, 0.5, 0.18, 0.05),
        box(0.52, 0.5, 0.18, 0.05),
        box(cupX - 0.09, 0.64, 0.18, 0.05)
      ];
      add(...pads);
      for (const s of pads) go(rideAbove(s));
      break;
    }
    case 17: {
      const a = box(near, 0.36, 0.38, 0.05);
      const wall = box(0.45, 0.38, 0.05, 0.2);
      const b = box(far, 0.56, 0.36, 0.05);
      const c = box(cupX - 0.09, 0.7, 0.18, 0.05);
      add(a, wall, b, c);
      go(rideAbove(a), { x: flip ? wall.x - 0.05 : wall.x + wall.w + 0.05, y: 0.48 }, rideAbove(b), rideAbove(c));
      break;
    }
    case 18: {
      const a = box(0.5, 0.34, 0.26, 0.05);
      const v = box(0.7, 0.34, 0.05, 0.2);
      const b = box(0.28, 0.52, 0.38, 0.05);
      const v2 = box(0.26, 0.4, 0.05, 0.16);
      const c = box(cupX - 0.09, 0.68, 0.18, 0.05);
      add(a, v, b, v2, c);
      go(rideAbove(a, 0.3), { x: v.x - 0.05, y: 0.42 }, rideAbove(b), rideAbove(c));
      break;
    }
    case 19: {
      const w1 = box(0.28 + j, 0.3, 0.05, 0.24);
      const w2 = box(0.52, 0.38, 0.05, 0.24);
      const a = box(0.1, 0.46, 0.18, 0.05);
      const b = box(0.36, 0.56, 0.22, 0.05);
      const c = box(0.6, 0.48, 0.2, 0.05);
      const d = box(cupX - 0.09, 0.7, 0.18, 0.05);
      add(w1, w2, a, b, c, d);
      go({ x: flip ? w1.x - 0.05 : w1.x + w1.w + 0.05, y: 0.36 }, rideAbove(a), rideAbove(b), rideAbove(d));
      break;
    }
    // 20–39: more distinct silhouettes
    case 20: {
      // Tall chimney then side run
      const chim = box(clamp(tap.x - 0.04, 0.05, 0.85), 0.22, 0.08, 0.28);
      const a = box(far, 0.52, 0.3, 0.05);
      const b = box(cupX - 0.1, 0.68, 0.2, 0.05);
      blocks.length = 0;
      add(chim, a, b);
      waypoints = [{ x: tap.x, y: tap.y + 0.04 }, { x: flip ? chim.x - 0.05 : chim.x + chim.w + 0.05, y: 0.28 }, rideAbove(a), rideAbove(b)];
      break;
    }
    case 21: {
      const a = box(0.2, 0.32, 0.15, 0.05);
      const b = box(0.45, 0.4, 0.15, 0.05);
      const c = box(0.2, 0.5, 0.15, 0.05);
      const d = box(0.45, 0.58, 0.15, 0.05);
      const e = box(cupX - 0.09, 0.7, 0.18, 0.05);
      add(a, b, c, d, e);
      go(rideAbove(a), rideAbove(b), rideAbove(c), rideAbove(d), rideAbove(e));
      break;
    }
    case 22: {
      // U-channel toward cup
      const floor = box(flip ? 0.2 : 0.35, 0.5, 0.4, 0.05);
      const L = box(floor.x, 0.35, 0.05, 0.2);
      const R = box(floor.x + floor.w - 0.05, 0.35, 0.05, 0.2);
      const b = box(cupX - 0.1, 0.66, 0.2, 0.05);
      add(floor, L, R, b);
      go({ x: floor.x + floor.w * 0.5, y: 0.32 }, rideAbove(floor), rideAbove(b));
      break;
    }
    case 23: {
      const wall = box(0.4, 0.25, 0.08, 0.45);
      const a = box(0.1, 0.45, 0.22, 0.05);
      const b = box(0.58, 0.45, 0.22, 0.05);
      const c = box(cupX - 0.1, 0.64, 0.2, 0.05);
      add(wall, a, b, c);
      go(rideAbove(flip ? b : a), { x: flip ? wall.x - 0.05 : wall.x + wall.w + 0.05, y: 0.55 }, rideAbove(c));
      break;
    }
    case 24: {
      for (let i = 0; i < 5; i++) {
        const s = box(0.12 + i * 0.12, 0.32 + (i % 2) * 0.08, 0.14, 0.05);
        add(s);
        go(rideAbove(s));
      }
      const last = box(cupX - 0.09, 0.68, 0.18, 0.05);
      add(last);
      go(rideAbove(last));
      break;
    }
    case 25: {
      const a = box(near, 0.38, 0.22, 0.05);
      const b = box(near + dir * 0.15, 0.5, 0.22, 0.05);
      const c = box(near + dir * 0.3, 0.62, 0.22, 0.05);
      add(a, b, c);
      go(rideAbove(a), rideAbove(b), rideAbove(c));
      break;
    }
    case 26: {
      // Frame window
      const top = box(0.25, 0.32, 0.4, 0.05);
      const L = box(0.25, 0.32, 0.05, 0.28);
      const R = box(0.6, 0.32, 0.05, 0.28);
      const bot = box(0.25, 0.55, 0.4, 0.05);
      const c = box(cupX - 0.1, 0.7, 0.2, 0.05);
      add(top, L, R, bot, c);
      go(rideAbove(top, 0.5), { x: 0.42, y: 0.48 }, rideAbove(bot), rideAbove(c));
      break;
    }
    case 27: {
      const a = box(0.15, 0.35, 0.5, 0.05);
      const b = box(0.15, 0.5, 0.2, 0.05);
      const c = box(0.45, 0.5, 0.2, 0.05);
      const d = box(cupX - 0.1, 0.66, 0.2, 0.05);
      add(a, b, c, d);
      go(rideAbove(a, flip ? 0.2 : 0.8), rideAbove(flip ? b : c), rideAbove(d));
      break;
    }
    case 28: {
      const posts = [0.25, 0.4, 0.55, 0.7].map((x, i) => box(x, 0.3 + (i % 2) * 0.05, 0.05, 0.28));
      const shelf = box(cupX - 0.12, 0.62, 0.24, 0.05);
      add(...posts, shelf);
      go({ x: flip ? 0.18 : 0.78, y: 0.36 }, { x: 0.48, y: 0.5 }, rideAbove(shelf));
      break;
    }
    case 29: {
      const a = box(0.1, 0.4, 0.2, 0.05);
      const b = box(0.35, 0.4, 0.2, 0.05);
      const c = box(0.6, 0.4, 0.2, 0.05);
      const d = box(0.22, 0.55, 0.2, 0.05);
      const e = box(0.48, 0.55, 0.2, 0.05);
      const f = box(cupX - 0.09, 0.7, 0.18, 0.05);
      add(a, b, c, d, e, f);
      go(rideAbove(a), rideAbove(b), rideAbove(c), rideAbove(e), rideAbove(f));
      break;
    }
    case 30: {
      // Diagonal wall chain
      for (let i = 0; i < 3; i++) {
        add(box(0.25 + i * 0.12, 0.3 + i * 0.1, 0.06, 0.22));
      }
      const a = box(far, 0.55, 0.24, 0.05);
      const b = box(cupX - 0.1, 0.7, 0.2, 0.05);
      add(a, b);
      go({ x: flip ? 0.2 : 0.75, y: 0.36 }, rideAbove(a), rideAbove(b));
      break;
    }
    case 31: {
      const bowl = box(0.3, 0.45, 0.35, 0.05);
      const L = box(0.3, 0.35, 0.05, 0.15);
      const R = box(0.6, 0.35, 0.05, 0.15);
      const b = box(cupX - 0.1, 0.64, 0.2, 0.05);
      add(bowl, L, R, b);
      go({ x: 0.48, y: 0.32 }, rideAbove(bowl), rideAbove(b));
      break;
    }
    case 32: {
      const a = box(near, 0.34, 0.18, 0.05);
      const b = box(near + 0.05 * dir, 0.42, 0.18, 0.05);
      const c = box(near + 0.1 * dir, 0.5, 0.18, 0.05);
      const d = box(near + 0.15 * dir, 0.58, 0.18, 0.05);
      const e = box(cupX - 0.09, 0.7, 0.18, 0.05);
      add(a, b, c, d, e);
      go(rideAbove(a), rideAbove(b), rideAbove(c), rideAbove(d), rideAbove(e));
      break;
    }
    case 33: {
      const big = box(0.2, 0.4, 0.55, 0.06);
      const holeX = cupX;
      // split big into two with gap toward cup side
      const left = box(0.2, 0.4, Math.max(0.12, holeX - 0.28 - 0.2), 0.06);
      const right = box(holeX - 0.08, 0.4, 0.35, 0.06);
      const c = box(cupX - 0.1, 0.62, 0.2, 0.05);
      add(left, right, c);
      go(rideAbove(flip ? right : left), { x: holeX, y: 0.37 }, rideAbove(c));
      break;
    }
    case 34: {
      const wall = box(flip ? 0.55 : 0.3, 0.28, 0.07, 0.38);
      for (let i = 0; i < 3; i++) {
        const s = box(flip ? 0.15 : 0.5, 0.36 + i * 0.1, 0.22, 0.05);
        add(s);
        go(rideAbove(s));
      }
      add(wall);
      break;
    }
    case 35: {
      const a = box(0.12, 0.36, 0.22, 0.05);
      const b = box(0.42, 0.44, 0.22, 0.05);
      const c = box(0.12, 0.54, 0.22, 0.05);
      const d = box(0.42, 0.64, 0.22, 0.05);
      add(a, b, c, d);
      go(rideAbove(a), rideAbove(b), rideAbove(c), rideAbove(d));
      break;
    }
    case 36: {
      // Cup guard rails only (open top)
      const shelf = box(0.25 + j, 0.4, 0.35, 0.05);
      const L = box(cup.x - 0.07, cup.y, 0.05, cup.h);
      const R = box(cup.x + cup.w + 0.02, cup.y, 0.05, cup.h);
      add(shelf, L, R);
      go(rideAbove(shelf), { x: cupX, y: cup.y - 0.06 });
      break;
    }
    case 37: {
      const a = box(0.55, 0.32, 0.25, 0.05);
      const b = box(0.35, 0.44, 0.25, 0.05);
      const c = box(0.55, 0.56, 0.25, 0.05);
      const d = box(cupX - 0.1, 0.7, 0.2, 0.05);
      add(a, b, c, d);
      go(rideAbove(a), rideAbove(b), rideAbove(c), rideAbove(d));
      break;
    }
    case 38: {
      const ring = [
        box(0.3, 0.32, 0.3, 0.05),
        box(0.3, 0.32, 0.05, 0.3),
        box(0.55, 0.32, 0.05, 0.3),
        box(0.3, 0.57, 0.12, 0.05),
        box(0.48, 0.57, 0.12, 0.05)
      ];
      const c = box(cupX - 0.1, 0.7, 0.2, 0.05);
      add(...ring, c);
      go(rideAbove(ring[0]), { x: 0.42, y: 0.45 }, { x: 0.42, y: 0.54 }, rideAbove(c));
      break;
    }
    case 39: {
      for (let i = 0; i < 6; i++) {
        const s = box(0.1 + (i % 3) * 0.22, 0.34 + Math.floor(i / 3) * 0.14, 0.16, 0.05);
        add(s);
        go(rideAbove(s));
      }
      const last = box(cupX - 0.09, 0.68, 0.18, 0.05);
      add(last);
      go(rideAbove(last));
      break;
    }
    // 40–59 harder / denser but still open
    case 40: {
      const w1 = box(0.3, 0.28, 0.05, 0.32);
      const w2 = box(0.5, 0.35, 0.05, 0.32);
      const a = box(0.1, 0.48, 0.18, 0.05);
      const b = box(0.36, 0.58, 0.2, 0.05);
      const c = box(0.58, 0.5, 0.2, 0.05);
      const d = box(cupX - 0.1, 0.7, 0.2, 0.05);
      add(w1, w2, a, b, c, d);
      go({ x: 0.22, y: 0.36 }, rideAbove(a), rideAbove(b), rideAbove(d));
      break;
    }
    case 41: {
      for (let i = 0; i < 4; i++) {
        add(box(flip ? 0.5 - i * 0.08 : 0.2 + i * 0.08, 0.32 + i * 0.08, 0.28, 0.05));
        go(rideAbove(blocks[blocks.length - 1], flip ? 0.3 : 0.7));
      }
      break;
    }
    case 42: {
      const a = box(0.15, 0.34, 0.2, 0.05);
      const v = box(0.35, 0.34, 0.05, 0.28);
      const b = box(0.35, 0.58, 0.3, 0.05);
      const c = box(cupX - 0.1, 0.72, 0.2, 0.05);
      add(a, v, b, c);
      go(rideAbove(a), { x: v.x + v.w + 0.05, y: 0.45 }, rideAbove(b), rideAbove(c));
      break;
    }
    case 43: {
      const shelves = [0.32, 0.44, 0.56, 0.68].map((y, i) =>
        box(i % 2 === 0 ? 0.12 : 0.45, y, 0.32, 0.05)
      );
      add(...shelves);
      for (const s of shelves) go(rideAbove(s));
      break;
    }
    case 44: {
      const wall = box(0.45, 0.24, 0.06, 0.48);
      const pads = [0.34, 0.46, 0.58].map((y) => box(flip ? 0.55 : 0.12, y, 0.24, 0.05));
      const last = box(cupX - 0.1, 0.7, 0.2, 0.05);
      add(wall, ...pads, last);
      for (const s of pads) go(rideAbove(s));
      go(rideAbove(last));
      break;
    }
    case 45: {
      const a = box(0.2, 0.36, 0.45, 0.05);
      const b = box(0.2, 0.5, 0.2, 0.05);
      const c = box(0.45, 0.5, 0.2, 0.05);
      const d = box(0.3, 0.64, 0.25, 0.05);
      add(a, b, c, d);
      go(rideAbove(a, 0.7), rideAbove(c), rideAbove(d));
      break;
    }
    case 46: {
      for (let i = 0; i < 3; i++) {
        add(box(0.18 + i * 0.2, 0.36, 0.12, 0.05));
        add(box(0.28 + i * 0.2, 0.5, 0.12, 0.05));
      }
      const last = box(cupX - 0.09, 0.66, 0.18, 0.05);
      add(last);
      go(rideAbove(blocks[1]), rideAbove(blocks[3]), rideAbove(blocks[5]), rideAbove(last));
      break;
    }
    case 47: {
      const L = box(0.22, 0.3, 0.05, 0.35);
      const R = box(0.55, 0.3, 0.05, 0.35);
      const mid = box(0.3, 0.48, 0.22, 0.05);
      const c = box(cupX - 0.1, 0.68, 0.2, 0.05);
      add(L, R, mid, c);
      go({ x: 0.4, y: 0.36 }, rideAbove(mid), rideAbove(c));
      break;
    }
    case 48: {
      const a = box(near, 0.35, 0.2, 0.05);
      const b = box(0.4, 0.45, 0.2, 0.05);
      const c = box(far, 0.55, 0.2, 0.05);
      const d = box(0.4, 0.65, 0.2, 0.05);
      add(a, b, c, d);
      go(rideAbove(a), rideAbove(b), rideAbove(c), rideAbove(d));
      break;
    }
    case 49: {
      const roof2 = box(0.15, 0.35, 0.6, 0.05);
      const gap = box(0.35, 0.48, 0.08, 0.2);
      const a = box(0.12, 0.55, 0.2, 0.05);
      const b = box(0.5, 0.55, 0.2, 0.05);
      const c = box(cupX - 0.1, 0.7, 0.2, 0.05);
      add(roof2, gap, a, b, c);
      go(rideAbove(roof2, flip ? 0.2 : 0.8), rideAbove(flip ? a : b), rideAbove(c));
      break;
    }
    case 50: {
      for (let i = 0; i < 5; i++) {
        const s = box(lerp(0.15, 0.55, i / 4), 0.32 + i * 0.07, 0.2 - i * 0.01, 0.05);
        add(s);
        go(rideAbove(s));
      }
      break;
    }
    case 51: {
      const wall = box(0.38, 0.26, 0.08, 0.4);
      const a = box(0.08, 0.42, 0.24, 0.05);
      const b = box(0.55, 0.42, 0.24, 0.05);
      const c = box(0.25, 0.58, 0.24, 0.05);
      const d = box(cupX - 0.1, 0.72, 0.2, 0.05);
      add(wall, a, b, c, d);
      go(rideAbove(flip ? b : a), rideAbove(c), rideAbove(d));
      break;
    }
    case 52: {
      const stairs = [];
      for (let i = 0; i < 4; i++) {
        stairs.push(box(flip ? 0.55 - i * 0.1 : 0.18 + i * 0.1, 0.34 + i * 0.08, 0.22, 0.055));
      }
      add(...stairs);
      for (const s of stairs) go(rideAbove(s));
      break;
    }
    case 53: {
      const a = box(0.1, 0.36, 0.25, 0.05);
      const b = box(0.45, 0.36, 0.25, 0.05);
      const v = box(0.4, 0.36, 0.05, 0.25);
      const c = box(0.2, 0.58, 0.4, 0.05);
      const d = box(cupX - 0.1, 0.72, 0.2, 0.05);
      add(a, b, v, c, d);
      go(rideAbove(a), { x: v.x - 0.05, y: 0.5 }, rideAbove(c), rideAbove(d));
      break;
    }
    case 54: {
      for (let i = 0; i < 7; i++) {
        const s = box(0.12 + (i % 4) * 0.16, 0.34 + Math.floor(i / 4) * 0.16, 0.12, 0.05);
        add(s);
      }
      const last = box(cupX - 0.09, 0.68, 0.18, 0.05);
      add(last);
      go(rideAbove(blocks[1]), rideAbove(blocks[3]), rideAbove(blocks[5]), rideAbove(last));
      break;
    }
    case 55: {
      const C = box(0.35, 0.4, 0.25, 0.05);
      const L = box(0.35, 0.3, 0.05, 0.2);
      const R = box(0.55, 0.3, 0.05, 0.15);
      const a = box(0.15, 0.55, 0.2, 0.05);
      const b = box(cupX - 0.1, 0.7, 0.2, 0.05);
      add(C, L, R, a, b);
      go({ x: 0.48, y: 0.28 }, rideAbove(C), rideAbove(a), rideAbove(b));
      break;
    }
    case 56: {
      const a = box(0.15, 0.34, 0.18, 0.05);
      const b = box(0.4, 0.4, 0.18, 0.05);
      const c = box(0.65, 0.46, 0.18, 0.05);
      const d = box(0.4, 0.56, 0.18, 0.05);
      const e = box(0.15, 0.64, 0.18, 0.05);
      const f = box(cupX - 0.09, 0.74, 0.18, 0.05);
      add(a, b, c, d, e, f);
      go(rideAbove(a), rideAbove(b), rideAbove(c), rideAbove(d), rideAbove(f));
      break;
    }
    case 57: {
      const wall = box(flip ? 0.28 : 0.6, 0.25, 0.06, 0.45);
      const a = box(0.4, 0.4, 0.22, 0.05);
      const b = box(0.2, 0.52, 0.22, 0.05);
      const c = box(0.45, 0.62, 0.22, 0.05);
      add(wall, a, b, c);
      go(rideAbove(a), rideAbove(b), rideAbove(c));
      break;
    }
    case 58: {
      const a = box(0.2, 0.35, 0.5, 0.05);
      const b = box(0.2, 0.5, 0.15, 0.05);
      const c = box(0.4, 0.5, 0.15, 0.05);
      const d = box(0.6, 0.5, 0.15, 0.05);
      const e = box(cupX - 0.1, 0.66, 0.2, 0.05);
      add(a, b, c, d, e);
      go(rideAbove(a, 0.5), rideAbove(c), rideAbove(e));
      break;
    }
    case 59: {
      for (let i = 0; i < 3; i++) {
        add(box(0.15, 0.34 + i * 0.12, 0.2, 0.05));
        add(box(0.5, 0.34 + i * 0.12, 0.2, 0.05));
      }
      const last = box(cupX - 0.09, 0.72, 0.18, 0.05);
      add(last);
      go(rideAbove(blocks[1]), rideAbove(blocks[3]), rideAbove(blocks[5]), rideAbove(last));
      break;
    }
    // 60–79 late mid
    case 60: {
      const maze = [
        box(0.2, 0.3, 0.05, 0.25),
        box(0.2, 0.3, 0.35, 0.05),
        box(0.5, 0.3, 0.05, 0.2),
        box(0.35, 0.45, 0.3, 0.05),
        box(0.35, 0.45, 0.05, 0.18),
        box(0.15, 0.58, 0.3, 0.05),
        box(cupX - 0.1, 0.72, 0.2, 0.05)
      ];
      add(...maze);
      go({ x: 0.28, y: 0.38 }, { x: 0.42, y: 0.42 }, rideAbove(maze[3]), rideAbove(maze[5]), rideAbove(maze[6]));
      break;
    }
    case 61: {
      for (let i = 0; i < 5; i++) {
        add(box(flip ? 0.55 - i * 0.07 : 0.15 + i * 0.07, 0.3 + i * 0.07, 0.26, 0.05));
        go(rideAbove(blocks[blocks.length - 1]));
      }
      break;
    }
    case 62: {
      const a = box(0.12, 0.34, 0.2, 0.05);
      const b = box(0.4, 0.34, 0.2, 0.05);
      const c = box(0.68, 0.34, 0.16, 0.05);
      const d = box(0.25, 0.5, 0.4, 0.05);
      const e = box(cupX - 0.1, 0.68, 0.2, 0.05);
      add(a, b, c, d, e);
      go(rideAbove(a), rideAbove(b), rideAbove(d), rideAbove(e));
      break;
    }
    case 63: {
      const pillars = [0.22, 0.38, 0.54, 0.7].map((x, i) => box(x, 0.28 + (i % 2) * 0.08, 0.06, 0.32));
      const a = box(0.28, 0.55, 0.2, 0.05);
      const b = box(cupX - 0.1, 0.7, 0.2, 0.05);
      add(...pillars, a, b);
      go({ x: 0.3, y: 0.4 }, rideAbove(a), rideAbove(b));
      break;
    }
    case 64: {
      const a = box(near, 0.34, 0.28, 0.05);
      const b = box(0.35, 0.46, 0.28, 0.05);
      const c = box(far, 0.58, 0.28, 0.05);
      const d = box(cupX - 0.1, 0.72, 0.2, 0.05);
      add(a, b, c, d);
      go(rideAbove(a), rideAbove(b), rideAbove(c), rideAbove(d));
      break;
    }
    case 65: {
      const nest = [
        box(0.25, 0.35, 0.4, 0.05),
        box(0.25, 0.35, 0.05, 0.25),
        box(0.6, 0.35, 0.05, 0.25),
        box(0.25, 0.55, 0.15, 0.05),
        box(0.5, 0.55, 0.15, 0.05)
      ];
      const c = box(cupX - 0.1, 0.7, 0.2, 0.05);
      add(...nest, c);
      go(rideAbove(nest[0]), { x: 0.42, y: 0.48 }, rideAbove(c));
      break;
    }
    case 66: {
      for (let i = 0; i < 6; i++) {
        const s = box(0.14 + i * 0.1, 0.32 + (i % 3) * 0.1, 0.14, 0.05);
        add(s);
        go(rideAbove(s));
      }
      break;
    }
    case 67: {
      const wall = box(0.42, 0.25, 0.07, 0.42);
      const a = box(0.1, 0.4, 0.25, 0.05);
      const b = box(0.55, 0.4, 0.25, 0.05);
      const c = box(0.2, 0.55, 0.25, 0.05);
      const d = box(0.5, 0.55, 0.25, 0.05);
      const e = box(cupX - 0.1, 0.7, 0.2, 0.05);
      add(wall, a, b, c, d, e);
      go(rideAbove(flip ? b : a), rideAbove(flip ? d : c), rideAbove(e));
      break;
    }
    case 68: {
      const a = box(0.15, 0.36, 0.55, 0.05);
      const drops = [0.2, 0.4, 0.6].map((x) => box(x, 0.5, 0.12, 0.05));
      const c = box(cupX - 0.1, 0.66, 0.2, 0.05);
      add(a, ...drops, c);
      go(rideAbove(a, flip ? 0.2 : 0.8), rideAbove(drops[1]), rideAbove(c));
      break;
    }
    case 69: {
      for (let i = 0; i < 4; i++) {
        add(box(0.15 + i * 0.15, 0.34, 0.1, 0.05));
        add(box(0.22 + i * 0.15, 0.48, 0.1, 0.05));
        add(box(0.15 + i * 0.15, 0.62, 0.1, 0.05));
      }
      go(rideAbove(blocks[1]), rideAbove(blocks[5]), rideAbove(blocks[9]), { x: cupX, y: cup.y - 0.05 });
      break;
    }
    case 70: {
      const a = box(0.18, 0.34, 0.2, 0.05);
      const b = box(0.48, 0.4, 0.2, 0.05);
      const c = box(0.18, 0.5, 0.2, 0.05);
      const d = box(0.48, 0.58, 0.2, 0.05);
      const e = box(0.25, 0.68, 0.3, 0.05);
      add(a, b, c, d, e);
      go(rideAbove(a), rideAbove(b), rideAbove(c), rideAbove(d), rideAbove(e));
      break;
    }
    case 71: {
      const walls = [0.28, 0.45, 0.62].map((x, i) => box(x, 0.28, 0.05, 0.22 + i * 0.05));
      const a = box(0.12, 0.5, 0.14, 0.05);
      const b = box(0.35, 0.55, 0.14, 0.05);
      const c = box(0.52, 0.6, 0.14, 0.05);
      const d = box(cupX - 0.1, 0.72, 0.2, 0.05);
      add(...walls, a, b, c, d);
      go(rideAbove(a), rideAbove(b), rideAbove(c), rideAbove(d));
      break;
    }
    case 72: {
      const spiral = [
        box(0.5, 0.3, 0.25, 0.05),
        box(0.7, 0.3, 0.05, 0.25),
        box(0.35, 0.5, 0.4, 0.05),
        box(0.35, 0.35, 0.05, 0.2),
        box(0.2, 0.62, 0.3, 0.05)
      ];
      const c = box(cupX - 0.1, 0.74, 0.2, 0.05);
      add(...spiral, c);
      go(rideAbove(spiral[0]), { x: 0.65, y: 0.42 }, rideAbove(spiral[2]), rideAbove(spiral[4]), rideAbove(c));
      break;
    }
    case 73: {
      for (let i = 0; i < 4; i++) {
        add(box(0.1, 0.32 + i * 0.1, 0.35 - i * 0.04, 0.05));
        go(rideAbove(blocks[blocks.length - 1], 0.7));
      }
      const last = box(cupX - 0.1, 0.72, 0.2, 0.05);
      add(last);
      go(rideAbove(last));
      break;
    }
    case 74: {
      const a = box(0.2, 0.34, 0.5, 0.05);
      const b = box(0.2, 0.48, 0.2, 0.05);
      const c = box(0.5, 0.48, 0.2, 0.05);
      const d = box(0.35, 0.6, 0.2, 0.05);
      const e = box(cupX - 0.1, 0.72, 0.2, 0.05);
      add(a, b, c, d, e);
      go(rideAbove(a, flip ? 0.25 : 0.75), rideAbove(flip ? b : c), rideAbove(d), rideAbove(e));
      break;
    }
    case 75: {
      const grid = [];
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 3; c++) {
          if (r === 1 && c === 1) continue; // hole in center
          grid.push(box(0.2 + c * 0.18, 0.32 + r * 0.12, 0.14, 0.05));
        }
      }
      const last = box(cupX - 0.09, 0.72, 0.18, 0.05);
      add(...grid, last);
      go(rideAbove(grid[0]), { x: 0.45, y: 0.46 }, rideAbove(grid[6]), rideAbove(last));
      break;
    }
    case 76: {
      const wall = box(0.5, 0.25, 0.06, 0.5);
      for (let i = 0; i < 4; i++) {
        add(box(flip ? 0.58 : 0.12, 0.32 + i * 0.1, 0.22, 0.05));
        go(rideAbove(blocks[blocks.length - 1]));
      }
      add(wall);
      break;
    }
    case 77: {
      const a = box(0.15, 0.35, 0.2, 0.05);
      const b = box(0.45, 0.42, 0.2, 0.05);
      const c = box(0.15, 0.52, 0.2, 0.05);
      const d = box(0.45, 0.6, 0.2, 0.05);
      const e = box(0.25, 0.7, 0.3, 0.05);
      add(a, b, c, d, e);
      go(rideAbove(a), rideAbove(b), rideAbove(c), rideAbove(d), rideAbove(e));
      break;
    }
    case 78: {
      const arms = [
        box(0.15, 0.35, 0.55, 0.05),
        box(0.15, 0.35, 0.05, 0.3),
        box(0.65, 0.45, 0.05, 0.2),
        box(0.25, 0.55, 0.4, 0.05)
      ];
      const c = box(cupX - 0.1, 0.72, 0.2, 0.05);
      add(...arms, c);
      go(rideAbove(arms[0], 0.6), { x: 0.55, y: 0.5 }, rideAbove(arms[3]), rideAbove(c));
      break;
    }
    case 79: {
      for (let i = 0; i < 5; i++) {
        add(box(0.12 + i * 0.12, 0.34 + i * 0.06, 0.16, 0.05));
        add(box(0.18 + i * 0.1, 0.55, 0.1, 0.05));
      }
      go(rideAbove(blocks[1]), rideAbove(blocks[5]), rideAbove(blocks[9]), { x: cupX, y: cup.y - 0.05 });
      break;
    }
    // 80–99 hardest — still open cup, drawable path
    case 80: {
      const maze = [
        box(0.18, 0.28, 0.05, 0.3),
        box(0.18, 0.28, 0.4, 0.05),
        box(0.53, 0.28, 0.05, 0.22),
        box(0.3, 0.42, 0.35, 0.05),
        box(0.3, 0.42, 0.05, 0.2),
        box(0.12, 0.56, 0.3, 0.05),
        box(0.5, 0.56, 0.25, 0.05),
        box(cupX - 0.1, 0.72, 0.2, 0.05)
      ];
      add(...maze);
      go({ x: 0.28, y: 0.36 }, rideAbove(maze[3]), rideAbove(maze[5]), rideAbove(maze[7]));
      break;
    }
    case 81: {
      for (let i = 0; i < 6; i++) {
        add(box(flip ? 0.58 - i * 0.06 : 0.14 + i * 0.06, 0.3 + i * 0.06, 0.24, 0.05));
        go(rideAbove(blocks[blocks.length - 1]));
      }
      break;
    }
    case 82: {
      const posts = [];
      for (let i = 0; i < 5; i++) posts.push(box(0.2 + i * 0.12, 0.3, 0.05, 0.25 + (i % 2) * 0.1));
      const a = box(0.25, 0.58, 0.2, 0.05);
      const b = box(0.5, 0.58, 0.2, 0.05);
      const c = box(cupX - 0.1, 0.72, 0.2, 0.05);
      add(...posts, a, b, c);
      go({ x: 0.3, y: 0.4 }, rideAbove(a), rideAbove(b), rideAbove(c));
      break;
    }
    case 83: {
      const a = box(0.12, 0.34, 0.22, 0.05);
      const b = box(0.4, 0.4, 0.22, 0.05);
      const c = box(0.68, 0.46, 0.18, 0.05);
      const d = box(0.4, 0.56, 0.22, 0.05);
      const e = box(0.12, 0.64, 0.22, 0.05);
      const f = box(cupX - 0.1, 0.74, 0.2, 0.05);
      add(a, b, c, d, e, f);
      go(rideAbove(a), rideAbove(b), rideAbove(c), rideAbove(d), rideAbove(f));
      break;
    }
    case 84: {
      const boxFrame = [
        box(0.22, 0.3, 0.45, 0.05),
        box(0.22, 0.3, 0.05, 0.35),
        box(0.62, 0.3, 0.05, 0.35),
        box(0.22, 0.6, 0.18, 0.05),
        box(0.48, 0.6, 0.19, 0.05)
      ];
      const c = box(cupX - 0.1, 0.74, 0.2, 0.05);
      add(...boxFrame, c);
      go(rideAbove(boxFrame[0]), { x: 0.42, y: 0.48 }, rideAbove(c));
      break;
    }
    case 85: {
      for (let i = 0; i < 4; i++) {
        add(box(0.15, 0.32 + i * 0.1, 0.25, 0.05));
        add(box(0.5, 0.36 + i * 0.1, 0.25, 0.05));
      }
      go(rideAbove(blocks[1]), rideAbove(blocks[3]), rideAbove(blocks[5]), rideAbove(blocks[7]), { x: cupX, y: cup.y - 0.05 });
      break;
    }
    case 86: {
      const wall = box(0.4, 0.24, 0.08, 0.48);
      const pads = [];
      for (let i = 0; i < 5; i++) pads.push(box(flip ? 0.55 : 0.1, 0.3 + i * 0.08, 0.22, 0.05));
      add(wall, ...pads);
      for (const s of pads) go(rideAbove(s));
      go({ x: cupX, y: cup.y - 0.05 });
      break;
    }
    case 87: {
      const a = box(0.15, 0.34, 0.55, 0.05);
      const b = box(0.15, 0.48, 0.18, 0.05);
      const c = box(0.38, 0.48, 0.18, 0.05);
      const d = box(0.6, 0.48, 0.18, 0.05);
      const e = box(0.25, 0.6, 0.18, 0.05);
      const f = box(0.5, 0.6, 0.18, 0.05);
      const g = box(cupX - 0.1, 0.74, 0.2, 0.05);
      add(a, b, c, d, e, f, g);
      go(rideAbove(a, 0.5), rideAbove(c), rideAbove(f), rideAbove(g));
      break;
    }
    case 88: {
      for (let i = 0; i < 7; i++) {
        const s = box(lerp(tap.x - 0.05, cupX - 0.08, i / 6), 0.3 + i * 0.055, 0.16, 0.05);
        add(s);
        go(rideAbove(s));
      }
      break;
    }
    case 89: {
      const maze = [
        box(0.2, 0.3, 0.5, 0.05),
        box(0.2, 0.3, 0.05, 0.35),
        box(0.65, 0.3, 0.05, 0.2),
        box(0.35, 0.45, 0.35, 0.05),
        box(0.35, 0.45, 0.05, 0.2),
        box(0.15, 0.6, 0.3, 0.05),
        box(0.55, 0.55, 0.2, 0.05),
        box(cupX - 0.1, 0.74, 0.2, 0.05)
      ];
      add(...maze);
      go(rideAbove(maze[0], 0.3), { x: 0.5, y: 0.4 }, rideAbove(maze[3]), rideAbove(maze[5]), rideAbove(maze[7]));
      break;
    }
    case 90: {
      for (let i = 0; i < 5; i++) {
        add(box(0.12 + (i % 2) * 0.35, 0.3 + i * 0.08, 0.3, 0.05));
        go(rideAbove(blocks[blocks.length - 1]));
      }
      break;
    }
    case 91: {
      const posts = [0.2, 0.35, 0.5, 0.65].map((x, i) => box(x, 0.28, 0.06, 0.2 + i * 0.04));
      const shelves = [0.4, 0.52, 0.64].map((y, i) => box(0.15 + (i % 2) * 0.3, y, 0.28, 0.05));
      const c = box(cupX - 0.1, 0.74, 0.2, 0.05);
      add(...posts, ...shelves, c);
      for (const s of shelves) go(rideAbove(s));
      go(rideAbove(c));
      break;
    }
    case 92: {
      const a = box(0.15, 0.34, 0.2, 0.05);
      const b = box(0.45, 0.34, 0.2, 0.05);
      const c = box(0.3, 0.46, 0.2, 0.05);
      const d = box(0.15, 0.58, 0.2, 0.05);
      const e = box(0.45, 0.58, 0.2, 0.05);
      const f = box(0.3, 0.7, 0.2, 0.05);
      add(a, b, c, d, e, f);
      go(rideAbove(a), rideAbove(b), rideAbove(c), rideAbove(e), rideAbove(f));
      break;
    }
    case 93: {
      const wall = box(0.45, 0.25, 0.07, 0.5);
      for (let i = 0; i < 5; i++) {
        add(box(0.1, 0.32 + i * 0.08, 0.28, 0.05));
        go(rideAbove(blocks[blocks.length - 1]));
      }
      add(wall);
      go({ x: cupX, y: cup.y - 0.05 });
      break;
    }
    case 94: {
      const layers = [0.32, 0.44, 0.56, 0.68].map((y, i) => {
        const gap = 0.35 + (i % 2) * 0.1;
        return [box(0.1, y, gap - 0.14, 0.05), box(gap + 0.06, y, 0.7 - gap, 0.05)];
      });
      for (const [L, R] of layers) {
        add(L, R);
        go(rideAbove(flip ? R : L));
      }
      break;
    }
    case 95: {
      for (let i = 0; i < 8; i++) {
        const s = box(0.12 + (i % 4) * 0.18, 0.3 + Math.floor(i / 4) * 0.18, 0.14, 0.05);
        add(s);
      }
      const mid = box(0.3, 0.52, 0.3, 0.05);
      const last = box(cupX - 0.1, 0.72, 0.2, 0.05);
      add(mid, last);
      go(rideAbove(blocks[1]), rideAbove(mid), rideAbove(last));
      break;
    }
    case 96: {
      const maze = [
        box(0.15, 0.3, 0.05, 0.4),
        box(0.15, 0.3, 0.5, 0.05),
        box(0.6, 0.3, 0.05, 0.25),
        box(0.3, 0.45, 0.4, 0.05),
        box(0.3, 0.45, 0.05, 0.2),
        box(0.45, 0.6, 0.25, 0.05),
        box(0.2, 0.6, 0.15, 0.05),
        box(cupX - 0.1, 0.74, 0.2, 0.05)
      ];
      add(...maze);
      go({ x: 0.28, y: 0.38 }, rideAbove(maze[3]), rideAbove(maze[6]), rideAbove(maze[7]));
      break;
    }
    case 97: {
      for (let i = 0; i < 6; i++) {
        add(box(flip ? 0.5 - i * 0.05 : 0.2 + i * 0.05, 0.3 + i * 0.07, 0.3 - i * 0.02, 0.05));
        go(rideAbove(blocks[blocks.length - 1], flip ? 0.3 : 0.7));
      }
      break;
    }
    case 98: {
      const a = box(0.12, 0.32, 0.2, 0.05);
      const b = box(0.4, 0.38, 0.2, 0.05);
      const c = box(0.68, 0.44, 0.16, 0.05);
      const d = box(0.4, 0.52, 0.2, 0.05);
      const e = box(0.12, 0.6, 0.2, 0.05);
      const f = box(0.35, 0.68, 0.25, 0.05);
      add(a, b, c, d, e, f);
      go(rideAbove(a), rideAbove(b), rideAbove(c), rideAbove(d), rideAbove(f));
      break;
    }
    default: {
      // 99 — finale gauntlet
      const pieces = [
        box(0.18, 0.28, 0.05, 0.28),
        box(0.18, 0.28, 0.45, 0.05),
        box(0.58, 0.28, 0.05, 0.2),
        box(0.32, 0.42, 0.35, 0.05),
        box(0.32, 0.42, 0.05, 0.18),
        box(0.12, 0.55, 0.28, 0.05),
        box(0.5, 0.55, 0.22, 0.05),
        box(0.28, 0.66, 0.25, 0.05),
        box(cupX - 0.1, 0.76, 0.2, 0.05)
      ];
      add(...pieces);
      go(
        { x: 0.28, y: 0.36 },
        rideAbove(pieces[3]),
        rideAbove(pieces[5]),
        rideAbove(pieces[7]),
        rideAbove(pieces[8])
      );
      break;
    }
  }

  go({ x: cupX, y: Math.min(cup.y - 0.05, 0.74) }, { x: cupX, y: cupY });
  return { blocks: openCupMouth(cup, blocks), waypoints };
}

function buildSolution(waypoints, blocks) {
  let sol = densify(waypoints, 0.022);
  for (let pass = 0; pass < 8; pass++) {
    sol = sol.map((p) => {
      let q = { ...p };
      for (const b of blocks) {
        if (q.y <= b.y + 0.012) continue;
        if (q.x <= b.x - 0.02 || q.x >= b.x + b.w + 0.02 || q.y >= b.y + b.h + 0.02) continue;
        if (b.h <= 0.09) {
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

function pathHitsBlocks(sol, blocks) {
  // Riding the top face is fine; deep interior hits are not
  for (const p of sol) {
    for (const b of blocks) {
      if (p.y <= b.y + 0.035) continue;
      if (p.x < b.x + 0.01 || p.x > b.x + b.w - 0.01) continue;
      if (p.y < b.y + b.h - 0.01) return true;
    }
  }
  return false;
}

function cupEntryOpen(cup, blocks) {
  const mx = cup.x + cup.w * 0.5;
  // Blocked only if a flat shelf fully covers the mouth with no side gap
  for (const b of blocks) {
    if (b.h > 0.1) continue;
    const covers =
      b.y + b.h > cup.y - 0.08 &&
      b.y < cup.y + 0.02 &&
      b.x <= cup.x + 0.02 &&
      b.x + b.w >= cup.x + cup.w - 0.02;
    if (covers) return false;
  }
  // Also require a clear vertical drop into the mouth center
  for (let y = cup.y - 0.1; y < cup.y + 0.03; y += 0.015) {
    if (blocks.some((b) => hits({ x: mx, y }, b, 0.005))) return false;
  }
  return true;
}

/** Guaranteed simple stairs — used if a fancy recipe fails validation. */
function fallbackLayout(tap, cup, flip, salt) {
  const cupX = cup.x + cup.w * 0.5;
  const cupY = cup.y + cup.h * 0.35;
  const catcher = box(clamp(tap.x - 0.12 - salt * 0.02, 0.04, 0.7), 0.22, 0.26 + salt * 0.02, 0.05);
  if (tap.x < catcher.x) catcher.x = R(tap.x - 0.04);
  if (tap.x > catcher.x + catcher.w) catcher.w = R(tap.x - catcher.x + 0.06);
  const steps = 2 + (salt % 3);
  const blocks = [catcher];
  const waypoints = [
    { x: tap.x, y: tap.y + 0.04 },
    rideAbove(catcher, flip ? 0.3 : 0.7),
    { x: clamp(flip ? catcher.x - 0.04 : catcher.x + catcher.w + 0.04, 0.08, 0.92), y: catcher.y - 0.028 }
  ];
  for (let i = 0; i < steps; i++) {
    const x = flip
      ? clamp(0.5 - i * 0.12 - salt * 0.02, 0.08, 0.7)
      : clamp(0.28 + i * 0.12 + salt * 0.02, 0.08, 0.7);
    const s = box(x, 0.36 + i * 0.1, 0.2, 0.05);
    blocks.push(s);
    waypoints.push(rideAbove(s));
  }
  const lastY = Math.min(0.36 + steps * 0.1, cup.y - 0.14);
  const last = box(clamp(cupX - 0.1, 0.06, 0.75), lastY, 0.2, 0.05);
  blocks.push(last);
  waypoints.push(rideAbove(last), { x: cupX, y: cup.y - 0.05 }, { x: cupX, y: cupY });
  return { blocks: openCupMouth(cup, blocks), waypoints };
}

function buildLevel(index) {
  const d = index / (COUNT - 1);
  const flip = index % 2 === 1;

  const tap = {
    x: flip
      ? clamp(0.74 - (index % 6) * 0.018, 0.58, 0.82)
      : clamp(0.18 + (index % 6) * 0.018, 0.12, 0.36),
    y: 0.1
  };
  const cup = {
    x: flip
      ? clamp(0.06 + (index % 5) * 0.018, 0.04, 0.22)
      : clamp(0.74 - (index % 5) * 0.018, 0.66, 0.84),
    y: clamp(0.74 - Math.floor(index / 20) * 0.015, 0.68, 0.78),
    w: lerp(0.14, 0.11, d),
    h: lerp(0.15, 0.12, d)
  };

  let { blocks, waypoints } = layout(index, tap, cup, flip);
  blocks = openCupMouth(cup, blocks);

  // Seal free-fall under tap
  let guard = 0;
  while (freeFall(tap, cup, blocks) && guard < 6) {
    guard += 1;
    blocks[0].w = Math.min(0.55, blocks[0].w + 0.08);
    blocks[0].x = clamp(tap.x - blocks[0].w * 0.5, 0.02, 0.6);
  }

  guard = 0;
  while (shortBypass(tap, cup, blocks) && guard < 6) {
    guard += 1;
    const x = lerp(tap.x, cup.x + cup.w * 0.5, 0.35 + guard * 0.08);
    const y = lerp(0.32, 0.55, guard / 6);
    blocks.push(box(x - 0.09, y, 0.18, 0.05));
    blocks = openCupMouth(cup, blocks);
  }

  // Dedup near-identical
  const cleaned = [];
  for (const b of blocks) {
    if (cleaned.some((c) => Math.abs(c.x - b.x) < 0.025 && Math.abs(c.y - b.y) < 0.025 && Math.abs(c.w - b.w) < 0.04)) {
      continue;
    }
    cleaned.push(b);
  }
  blocks = openCupMouth(cup, cleaned);

  let sol = buildSolution(waypoints, blocks);
  const cx = cup.x + cup.w * 0.5;
  const cy = cup.y + cup.h * 0.35;
  const end = sol[sol.length - 1];
  if (end.x < cup.x || end.x > cup.x + cup.w || end.y < cup.y || end.y > cup.y + cup.h) {
    sol = densify(sol.concat([{ x: cx, y: cup.y - 0.05 }, { x: cx, y: cy }]), 0.022);
  }

  const pathLen = strokeLen(sol);
  const ink = clamp(pathLen * lerp(1.6, 1.3, d) + lerp(0.4, 0.25, d), 1.5, 2.95);
  const need = Math.round(lerp(14, 34, d));

  return {
    id: index + 1,
    name: uniqueName(index),
    ink: Math.round(ink * 100) / 100,
    need,
    tap: { x: R(tap.x), y: R(tap.y) },
    cup: { x: R(cup.x), y: R(cup.y), w: R(cup.w), h: R(cup.h) },
    blocks,
    _sol: sol
  };
}

function fp(blocks) {
  return blocks.map((b) => `${b.x.toFixed(2)},${b.y.toFixed(2)},${b.w.toFixed(2)},${b.h.toFixed(2)}`).sort().join("|");
}

function validate(lv) {
  if (freeFall(lv.tap, lv.cup, lv.blocks)) return { ok: false, reason: "free-fall" };
  if (shortBypass(lv.tap, lv.cup, lv.blocks)) return { ok: false, reason: "bypass" };
  if (lv.blocks.length < 2) return { ok: false, reason: "empty" };
  if (lv.blocks.length > 16) return { ok: false, reason: "crowded" };
  if (!cupEntryOpen(lv.cup, lv.blocks)) return { ok: false, reason: "cup-sealed" };
  if (Math.abs(lv.tap.x - (lv.cup.x + lv.cup.w / 2)) < 0.22) return { ok: false, reason: "aligned" };
  const end = lv._sol[lv._sol.length - 1];
  if (end.x < lv.cup.x || end.x > lv.cup.x + lv.cup.w || end.y < lv.cup.y || end.y > lv.cup.y + lv.cup.h) {
    return { ok: false, reason: "miss-cup" };
  }
  if (pathHitsBlocks(lv._sol, lv.blocks)) return { ok: false, reason: "path-hit" };
  const len = strokeLen(lv._sol);
  if (len > lv.ink * 0.82) {
    lv.ink = Math.round(Math.min(2.95, len * 1.4 + 0.3) * 100) / 100;
  }
  return { ok: true, n: lv.blocks.length, len };
}

function assemble(index, recipeIndex, salt) {
  const d = index / (COUNT - 1);
  const flip = index % 2 === 1;
  const tap = {
    x: flip
      ? clamp(0.74 - (index % 6) * 0.018 - salt * 0.01, 0.56, 0.84)
      : clamp(0.18 + (index % 6) * 0.018 + salt * 0.01, 0.1, 0.38),
    y: 0.1
  };
  const cup = {
    x: flip
      ? clamp(0.06 + (index % 5) * 0.018 + salt * 0.008, 0.04, 0.24)
      : clamp(0.74 - (index % 5) * 0.018 - salt * 0.008, 0.64, 0.84),
    y: clamp(0.74 - Math.floor(index / 20) * 0.015, 0.68, 0.78),
    w: lerp(0.14, 0.11, d),
    h: lerp(0.15, 0.12, d)
  };

  let built =
    salt >= 6
      ? fallbackLayout(tap, cup, flip, salt + index)
      : layout(recipeIndex, tap, cup, flip);
  let blocks = openCupMouth(cup, built.blocks);

  let g = 0;
  while (freeFall(tap, cup, blocks) && g < 6) {
    g += 1;
    blocks[0].w = Math.min(0.55, blocks[0].w + 0.08);
    blocks[0].x = clamp(tap.x - blocks[0].w * 0.5, 0.02, 0.6);
  }
  g = 0;
  while (shortBypass(tap, cup, blocks) && g < 6) {
    g += 1;
    const x = lerp(tap.x, cup.x + cup.w * 0.5, 0.35 + g * 0.08);
    const y = lerp(0.32, 0.55, g / 6);
    blocks.push(box(x - 0.09, y, 0.18, 0.05));
    blocks = openCupMouth(cup, blocks);
  }

  const cleaned = [];
  for (const b of blocks) {
    if (cleaned.some((c) => Math.abs(c.x - b.x) < 0.025 && Math.abs(c.y - b.y) < 0.025 && Math.abs(c.w - b.w) < 0.04)) {
      continue;
    }
    cleaned.push(b);
  }
  blocks = openCupMouth(cup, cleaned);

  let sol = buildSolution(built.waypoints, blocks);
  const cx = cup.x + cup.w * 0.5;
  const cy = cup.y + cup.h * 0.35;
  const end = sol[sol.length - 1];
  if (end.x < cup.x || end.x > cup.x + cup.w || end.y < cup.y || end.y > cup.y + cup.h) {
    sol = densify(sol.concat([{ x: cx, y: cup.y - 0.05 }, { x: cx, y: cy }]), 0.022);
  }

  const pathLen = strokeLen(sol);
  const ink = clamp(pathLen * lerp(1.6, 1.3, d) + lerp(0.45, 0.28, d), 1.55, 2.95);
  const need = Math.round(lerp(14, 34, d));

  return {
    id: index + 1,
    name: uniqueName(index),
    ink: Math.round(ink * 100) / 100,
    need,
    tap: { x: R(tap.x), y: R(tap.y) },
    cup: { x: R(cup.x), y: R(cup.y), w: R(cup.w), h: R(cup.h) },
    blocks,
    _sol: sol
  };
}

function main() {
  const levels = [];
  const fails = [];
  const seen = new Set();

  for (let i = 0; i < COUNT; i++) {
    let lv = null;
    let result = { ok: false };
    for (let tries = 0; tries < 14; tries++) {
      const recipeIndex = tries === 0 ? i : (i + tries * 19) % COUNT;
      lv = assemble(i, recipeIndex, tries);
      result = validate(lv);
      if (!result.ok) continue;
      const sig = fp(lv.blocks);
      // Soft uniqueness: allow near-dup only on last tries
      if (seen.has(sig) && tries < 11) {
        result = { ok: false, reason: "dup" };
        continue;
      }
      seen.add(sig);
      break;
    }
    if (!result.ok) {
      // Absolute last resort — stairs with cup-mouth column cleared
      for (let salt = 20; salt < 50 && !result.ok; salt++) {
        lv = assemble(i, i, salt + i);
        const mx = lv.cup.x + lv.cup.w * 0.5;
        lv.blocks = lv.blocks.filter((b) => {
          for (let y = lv.cup.y - 0.14; y < lv.cup.y + 0.05; y += 0.01) {
            if (hits({ x: mx, y }, b, 0.012)) return false;
          }
          return true;
        });
        if (!lv.blocks.length) {
          lv.blocks = [
            box(clamp(lv.tap.x - 0.14, 0.04, 0.7), 0.22, 0.3, 0.05),
            box(clamp(mx - 0.2, 0.08, 0.6), 0.42, 0.22, 0.05),
            box(clamp(mx - 0.1, 0.08, 0.7), 0.56, 0.2, 0.05)
          ];
        }
        // Re-seal free-fall without covering cup
        let g = 0;
        while (freeFall(lv.tap, lv.cup, lv.blocks) && g < 5) {
          g += 1;
          lv.blocks[0].w = Math.min(0.5, lv.blocks[0].w + 0.08);
          lv.blocks[0].x = clamp(lv.tap.x - lv.blocks[0].w * 0.5, 0.02, 0.55);
        }
        g = 0;
        while (shortBypass(lv.tap, lv.cup, lv.blocks) && g < 5) {
          g += 1;
          const x = lerp(lv.tap.x, mx, 0.4);
          const y = 0.34 + g * 0.05;
          const nb = box(x - 0.09, y, 0.18, 0.05);
          let blocksMouth = false;
          for (let yy = lv.cup.y - 0.14; yy < lv.cup.y + 0.05; yy += 0.01) {
            if (hits({ x: mx, y: yy }, nb, 0.012)) blocksMouth = true;
          }
          if (!blocksMouth) lv.blocks.push(nb);
        }
        const cy = lv.cup.y + lv.cup.h * 0.35;
        lv._sol = buildSolution(
          densify(
            [
              { x: lv.tap.x, y: lv.tap.y + 0.04 },
              { x: lv.tap.x, y: 0.28 },
              { x: lerp(lv.tap.x, mx, 0.5), y: 0.45 },
              { x: mx, y: lv.cup.y - 0.05 },
              { x: mx, y: cy }
            ],
            0.022
          ),
          lv.blocks
        );
        result = validate(lv);
      }
      if (result.ok) seen.add(fp(lv.blocks));
    }
    if (!result.ok) {
      fails.push({ id: i + 1, reason: result.reason });
      console.error("FAIL", i + 1, result.reason);
      continue;
    }
    if ((i + 1) % 10 === 0) console.log(`OK ${i + 1} blocks=${result.n} ink=${lv.ink}`);
    const { _sol, ...pub } = lv;
    levels.push(pub);
  }

  const hist = {};
  levels.forEach((l) => {
    hist[l.blocks.length] = (hist[l.blocks.length] || 0) + 1;
  });
  console.log("block hist", hist);
  console.log("unique", seen.size);

  let leaks = 0;
  let sealed = 0;
  for (const lv of levels) {
    if (freeFall(lv.tap, lv.cup, lv.blocks) || shortBypass(lv.tap, lv.cup, lv.blocks)) leaks += 1;
    if (!cupEntryOpen(lv.cup, lv.blocks)) sealed += 1;
  }
  console.log("leaks", leaks, "sealed", sealed);

  if (fails.length || leaks || sealed || seen.size < 95) {
    console.error("generation failed", fails);
    process.exit(1);
  }

  fs.writeFileSync(
    path.join(__dirname, "..", "cup-flow", "levels-data.js"),
    "/* 100 unique playable Cup Flow levels — distinct layouts, open cups */\n" +
      `window.CUP_FLOW_LEVELS = ${JSON.stringify(levels)};\n`
  );
  console.log("Wrote", levels.length);
}

main();
