const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const scoreEl = document.getElementById("score");
const highScoreEl = document.getElementById("high-score");
const overlay = document.getElementById("overlay");
const overlayTitle = document.getElementById("overlay-title");
const overlayText = document.getElementById("overlay-text");
const startBtn = document.getElementById("start-btn");
const resumeBtn = document.getElementById("resume-btn");
const viewBoardBtn = document.getElementById("view-board-btn");
const gamesBtn = document.getElementById("games-btn");
const menuBtn = document.getElementById("menu-btn");

const W = canvas.width;
const H = canvas.height;
const HIGH_SCORE_KEY = "stacker-high-score";

const BLOCK_H = 1.15;
const START_SIZE = 5.2;
const MIN_SIZE = 0.4;
const PERFECT = 0.1;
const BASE_SPEED = 4.8;
const SPEED_STEP = 0.16;
const MAX_SPEED = 10.5;
const MOVE_SPAN = 5.8;

/** Isometric tile scale */
const TILE_X = 30;
const TILE_Y = 15;
const TILE_Z = 24;

const COLORS = [
  "#7c9cff",
  "#66d9e8",
  "#63e6be",
  "#ffd43b",
  "#ff922b",
  "#ff6b6b",
  "#da77f2",
  "#a5d8ff"
];

let stack = [];
let current = null;
let debris = [];
let score = 0;
let highScore = loadHighScore();
let running = false;
let menuMode = "start";
let camY = 0;
let targetCamY = 0;
let lastTime = 0;
let shake = 0;
let perfectFlash = 0;
let playedThisRun = false;

function loadHighScore() {
  try {
    const saved = Number(localStorage.getItem(HIGH_SCORE_KEY));
    return Number.isFinite(saved) && saved > 0 ? Math.floor(saved) : 0;
  } catch {
    return 0;
  }
}

function saveHighScore() {
  try {
    localStorage.setItem(HIGH_SCORE_KEY, String(highScore));
  } catch {}
}

function updateHud() {
  scoreEl.textContent = String(score);
  highScoreEl.textContent = String(highScore);
}

function colorFor(index) {
  return COLORS[index % COLORS.length];
}

function hexToRgb(hex) {
  const h = String(hex || "#888888").replace("#", "");
  if (h.length !== 6) return { r: 120, g: 140, b: 200 };
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16)
  };
}

function shade(hex, f) {
  const { r, g, b } = hexToRgb(hex);
  const t = (c) => Math.max(0, Math.min(255, Math.round(c * f)));
  return `rgb(${t(r)},${t(g)},${t(b)})`;
}

/** World (x right, y up, z toward camera-right) → screen */
function iso(x, y, z) {
  const yy = y - camY;
  return {
    x: W * 0.5 + (x - z) * TILE_X,
    y: H * 0.72 - yy * TILE_Z + (x + z) * TILE_Y
  };
}

function drawPoly(points, fill) {
  if (!points.length) return;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}

/**
 * Draw a box centered at (x,z) with size w×d and bottom at y.
 * Faces: left (darker), right (medium), top (bright) — classic Stack look.
 */
function drawBox(b, alpha = 1) {
  const x0 = b.x - b.w / 2;
  const x1 = b.x + b.w / 2;
  const z0 = b.z - b.d / 2;
  const z1 = b.z + b.d / 2;
  const y0 = b.y;
  const y1 = b.y + b.h;

  // 8 corners in iso
  const p000 = iso(x0, y0, z0);
  const p100 = iso(x1, y0, z0);
  const p010 = iso(x0, y1, z0);
  const p110 = iso(x1, y1, z0);
  const p001 = iso(x0, y0, z1);
  const p101 = iso(x1, y0, z1);
  const p011 = iso(x0, y1, z1);
  const p111 = iso(x1, y1, z1);

  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, alpha));

  // Left face (−x visible edge in this iso): x0 side toward +z
  drawPoly([p001, p000, p010, p011], shade(b.color, 0.62));
  // Right face (+x): x1 side toward +z
  drawPoly([p100, p101, p111, p110], shade(b.color, 0.78));
  // Top
  drawPoly([p010, p110, p111, p011], shade(b.color, 1.08));

  if (b.perfect) {
    ctx.globalAlpha = Math.max(0, Math.min(1, alpha)) * 0.35;
    drawPoly([p010, p110, p111, p011], "#ffffff");
  }

  // Crisp top outline
  ctx.globalAlpha = Math.max(0, Math.min(1, alpha)) * 0.35;
  ctx.beginPath();
  ctx.moveTo(p010.x, p010.y);
  ctx.lineTo(p110.x, p110.y);
  ctx.lineTo(p111.x, p111.y);
  ctx.lineTo(p011.x, p011.y);
  ctx.closePath();
  ctx.strokeStyle = "rgba(255,255,255,0.55)";
  ctx.lineWidth = 1.25;
  ctx.stroke();

  ctx.restore();
}

function resetGame() {
  stack = [
    {
      x: 0,
      y: 0,
      z: 0,
      w: START_SIZE,
      d: START_SIZE,
      h: BLOCK_H,
      color: colorFor(0)
    }
  ];
  debris = [];
  score = 0;
  camY = 0;
  targetCamY = 0;
  shake = 0;
  perfectFlash = 0;
  playedThisRun = false;
  spawnCurrent();
  updateHud();
}

function spawnCurrent() {
  const top = stack[stack.length - 1];
  const axis = stack.length % 2 === 1 ? "x" : "z";
  const speed = Math.min(MAX_SPEED, BASE_SPEED + score * SPEED_STEP);
  current = {
    x: axis === "x" ? -MOVE_SPAN : top.x,
    y: top.y + BLOCK_H,
    z: axis === "z" ? -MOVE_SPAN : top.z,
    w: top.w,
    d: top.d,
    h: BLOCK_H,
    axis,
    dir: 1,
    speed,
    color: colorFor(stack.length)
  };
}

function spawnDebris(piece) {
  debris.push({
    ...piece,
    life: 1.05,
    vy: 0.8 + Math.random() * 0.6
  });
}

function placeBlock() {
  if (!running || !current) return;

  if (!playedThisRun) {
    playedThisRun = true;
    window.HubStreak?.recordPlay?.();
    window.HubPlays?.record?.("stacker");
  }

  const prev = stack[stack.length - 1];
  const axis = current.axis;
  let placed;

  if (axis === "x") {
    const left = Math.max(current.x - current.w / 2, prev.x - prev.w / 2);
    const right = Math.min(current.x + current.w / 2, prev.x + prev.w / 2);
    const overlap = right - left;
    if (overlap <= 0) {
      endGame(false);
      return;
    }
    const perfect = Math.abs(current.x - prev.x) <= PERFECT;
    const w = perfect ? prev.w : overlap;
    const x = perfect ? prev.x : (left + right) / 2;
    placed = {
      x,
      y: current.y,
      z: prev.z,
      w,
      d: prev.d,
      h: BLOCK_H,
      color: current.color,
      perfect
    };

    const cutL = current.x - current.w / 2;
    const cutR = current.x + current.w / 2;
    if (!perfect && cutL < left - 0.02) {
      spawnDebris({
        x: (cutL + left) / 2,
        y: current.y,
        z: current.z,
        w: left - cutL,
        d: current.d,
        h: BLOCK_H,
        color: current.color,
        vx: -4,
        vz: 0
      });
    }
    if (!perfect && cutR > right + 0.02) {
      spawnDebris({
        x: (right + cutR) / 2,
        y: current.y,
        z: current.z,
        w: cutR - right,
        d: current.d,
        h: BLOCK_H,
        color: current.color,
        vx: 4,
        vz: 0
      });
    }
  } else {
    const near = Math.max(current.z - current.d / 2, prev.z - prev.d / 2);
    const far = Math.min(current.z + current.d / 2, prev.z + prev.d / 2);
    const overlap = far - near;
    if (overlap <= 0) {
      endGame(false);
      return;
    }
    const perfect = Math.abs(current.z - prev.z) <= PERFECT;
    const d = perfect ? prev.d : overlap;
    const z = perfect ? prev.z : (near + far) / 2;
    placed = {
      x: prev.x,
      y: current.y,
      z,
      w: prev.w,
      d,
      h: BLOCK_H,
      color: current.color,
      perfect
    };

    const cutN = current.z - current.d / 2;
    const cutF = current.z + current.d / 2;
    if (!perfect && cutN < near - 0.02) {
      spawnDebris({
        x: current.x,
        y: current.y,
        z: (cutN + near) / 2,
        w: current.w,
        d: near - cutN,
        h: BLOCK_H,
        color: current.color,
        vx: 0,
        vz: -4
      });
    }
    if (!perfect && cutF > far + 0.02) {
      spawnDebris({
        x: current.x,
        y: current.y,
        z: (far + cutF) / 2,
        w: current.w,
        d: cutF - far,
        h: BLOCK_H,
        color: current.color,
        vx: 0,
        vz: 4
      });
    }
  }

  if (placed.w < MIN_SIZE || placed.d < MIN_SIZE) {
    endGame(false);
    return;
  }

  if (placed.perfect) {
    perfectFlash = 0.35;
    window.HubSound?.play?.("eat");
  } else {
    window.HubSound?.play?.("click");
  }

  stack.push(placed);
  score += 1;
  if (score > highScore) {
    highScore = score;
    saveHighScore();
  }
  updateHud();

  targetCamY = Math.max(0, placed.y - 2.6);
  spawnCurrent();
  checkAchievements();
}

function checkAchievements() {
  if (!window.HubAchievements) return;
  if (score >= 5) HubAchievements.unlock("stacker_score_5");
  if (score >= 15) HubAchievements.unlock("stacker_score_15");
  if (score >= 30) HubAchievements.unlock("stacker_score_30");
}

function endGame(fromMenu) {
  running = false;
  if (current) {
    spawnDebris({
      ...current,
      vx: current.axis === "x" ? current.dir * 5 : 0,
      vz: current.axis === "z" ? current.dir * 5 : 0
    });
  }
  current = null;
  if (highScore > 0) window.HubLeaderboard?.submit?.("stacker", highScore);
  checkAchievements();
  if (!fromMenu) {
    window.HubSound?.play?.("lose");
    if (score >= 10) window.HubConfetti?.burst?.();
    shake = 12;
  }
  showMenu(
    "result",
    score ? "Tower toppled!" : "Missed!",
    `You stacked ${score} ${score === 1 ? "floor" : "floors"}. Best: ${highScore}.`
  );
}

function showMenu(mode, title, text) {
  menuMode = mode;
  running = false;
  overlay.classList.remove("hidden");
  overlayTitle.textContent = title;
  overlayText.textContent = text;
  resumeBtn.classList.toggle("hidden", mode !== "pause");
  viewBoardBtn.classList.toggle("hidden", mode !== "pause");
  startBtn.textContent = mode === "start" ? "Start" : "Play again";
}

function openMenu() {
  if (menuMode === "result" || menuMode === "start") {
    showMenu(
      menuMode,
      menuMode === "start" ? "Tower Stack 3D" : overlayTitle.textContent,
      overlayText.textContent
    );
    return;
  }
  if (running) {
    running = false;
    showMenu("pause", "Paused", "Resume your tower, restart, or head back to Games.");
  }
}

function startGame() {
  resetGame();
  running = true;
  menuMode = "play";
  overlay.classList.add("hidden");
  lastTime = performance.now();
  requestAnimationFrame(loop);
}

function resumeGame() {
  running = true;
  menuMode = "play";
  overlay.classList.add("hidden");
  lastTime = performance.now();
  requestAnimationFrame(loop);
}

function update(dt) {
  if (current) {
    if (current.axis === "x") {
      current.x += current.dir * current.speed * dt;
      if (current.x <= -MOVE_SPAN) {
        current.x = -MOVE_SPAN;
        current.dir = 1;
      } else if (current.x >= MOVE_SPAN) {
        current.x = MOVE_SPAN;
        current.dir = -1;
      }
    } else {
      current.z += current.dir * current.speed * dt;
      if (current.z <= -MOVE_SPAN) {
        current.z = -MOVE_SPAN;
        current.dir = 1;
      } else if (current.z >= MOVE_SPAN) {
        current.z = MOVE_SPAN;
        current.dir = -1;
      }
    }
  }

  camY += (targetCamY - camY) * Math.min(1, dt * 5);

  debris = debris.filter((p) => {
    p.life -= dt;
    p.y -= p.vy * dt;
    p.x += (p.vx || 0) * dt;
    p.z += (p.vz || 0) * dt;
    p.vy += 9 * dt;
    return p.life > 0;
  });

  if (shake > 0) shake = Math.max(0, shake - dt * 40);
  if (perfectFlash > 0) perfectFlash = Math.max(0, perfectFlash - dt);
}

function drawBackground() {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, "#1a2750");
  g.addColorStop(0.55, "#0d142c");
  g.addColorStop(1, "#070b16");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  const hg = ctx.createRadialGradient(W / 2, H * 0.75, 10, W / 2, H * 0.78, 260);
  hg.addColorStop(0, "rgba(90,130,255,0.16)");
  hg.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = hg;
  ctx.fillRect(0, 0, W, H);
}

function drawGround() {
  const s = 10;
  const a = iso(-s, 0, -s);
  const b = iso(s, 0, -s);
  const c = iso(s, 0, s);
  const d = iso(-s, 0, s);
  drawPoly([a, b, c, d], "rgba(28,38,72,0.92)");

  ctx.save();
  ctx.strokeStyle = "rgba(130,160,255,0.14)";
  ctx.lineWidth = 1;
  for (let i = -5; i <= 5; i++) {
    const p0 = iso(i, 0.02, -s);
    const p1 = iso(i, 0.02, s);
    ctx.beginPath();
    ctx.moveTo(p0.x, p0.y);
    ctx.lineTo(p1.x, p1.y);
    ctx.stroke();
    const q0 = iso(-s, 0.02, i);
    const q1 = iso(s, 0.02, i);
    ctx.beginPath();
    ctx.moveTo(q0.x, q0.y);
    ctx.lineTo(q1.x, q1.y);
    ctx.stroke();
  }
  ctx.restore();
}

function draw() {
  const sx = shake ? (Math.random() - 0.5) * shake : 0;
  const sy = shake ? (Math.random() - 0.5) * shake : 0;

  ctx.clearRect(0, 0, W, H);
  drawBackground();

  ctx.save();
  ctx.translate(sx, sy);
  drawGround();

  const solids = [...stack, ...debris];
  if (current) solids.push(current);

  // Painter: lower floors first; same height → farther (smaller x+z) first
  solids
    .slice()
    .sort((a, b) => {
      if (Math.abs(a.y - b.y) > 0.05) return a.y - b.y;
      return a.x + a.z - (b.x + b.z);
    })
    .forEach((b) => drawBox(b, b.life != null ? Math.max(0, b.life) : 1));

  ctx.restore();

  if (perfectFlash > 0) {
    ctx.fillStyle = `rgba(255, 212, 59, ${perfectFlash * 0.28})`;
    ctx.fillRect(0, 0, W, H);
  }

  ctx.fillStyle = "rgba(10,16,36,0.55)";
  ctx.fillRect(14, 14, 118, 34);
  ctx.fillStyle = "#c5d0ff";
  ctx.font = "700 16px Segoe UI, sans-serif";
  ctx.fillText(`Floor ${score}`, 26, 36);
}

function loop(now) {
  if (!running && menuMode === "play") return;
  if (!running) {
    draw();
    return;
  }
  const dt = Math.min(0.033, (now - lastTime) / 1000 || 0.016);
  lastTime = now;
  update(dt);
  draw();
  requestAnimationFrame(loop);
}

startBtn?.addEventListener("click", () => startGame());
resumeBtn?.addEventListener("click", () => resumeGame());
viewBoardBtn?.addEventListener("click", () => {
  overlay.classList.add("hidden");
  menuMode = "play";
  draw();
});
gamesBtn?.addEventListener("click", () => {
  window.location.href = "../index.html#games";
});
menuBtn?.addEventListener("click", () => openMenu());

function onDrop(e) {
  e?.preventDefault?.();
  if (overlay && !overlay.classList.contains("hidden")) return;
  if (!running) return;
  placeBlock();
}

canvas.addEventListener("pointerdown", onDrop);
window.addEventListener("keydown", (e) => {
  if (e.code === "Escape") {
    e.preventDefault();
    openMenu();
    return;
  }
  if (e.code === "Space" || e.code === "Enter") {
    e.preventDefault();
    if (!overlay.classList.contains("hidden") && menuMode !== "pause") {
      startGame();
      return;
    }
    if (menuMode === "pause") {
      resumeGame();
      return;
    }
    onDrop(e);
  }
});

updateHud();
resetGame();
draw();
showMenu(
  "start",
  "Tower Stack 3D",
  "Tap, click, or press Space to drop each slab. Layers slide on X then Z — stack as high as you can."
);
