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

const BLOCK_H = 1;
const START_SIZE = 6.5;
const MIN_SIZE = 0.45;
const PERFECT = 0.12;
const BASE_SPEED = 5.2;
const SPEED_STEP = 0.18;
const MAX_SPEED = 11;
const MOVE_SPAN = 9.5;

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
let camYaw = 0.55;
let targetYaw = 0.55;
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
  const h = hex.replace("#", "");
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

/** Perspective project world (x,y,z) → screen */
function project(x, y, z) {
  const cy = y - camY;
  const cos = Math.cos(camYaw);
  const sin = Math.sin(camYaw);
  const rx = x * cos - z * sin;
  const rz = x * sin + z * cos;
  const dist = 22;
  const scale = (260 * dist) / (dist + rz + 10);
  return {
    x: W / 2 + rx * scale * 0.42,
    y: H * 0.62 - cy * scale * 0.38 - rz * scale * 0.12,
    s: scale,
    depth: rz
  };
}

function boxCorners(b) {
  const { x, y, z, w, d, h } = b;
  const x0 = x - w / 2;
  const x1 = x + w / 2;
  const z0 = z - d / 2;
  const z1 = z + d / 2;
  const y0 = y;
  const y1 = y + h;
  return [
    [x0, y0, z0],
    [x1, y0, z0],
    [x1, y0, z1],
    [x0, y0, z1],
    [x0, y1, z0],
    [x1, y1, z0],
    [x1, y1, z1],
    [x0, y1, z1]
  ].map(([px, py, pz]) => project(px, py, pz));
}

function drawFace(pts, fill, stroke) {
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

function drawBox(b, alpha = 1) {
  const c = boxCorners(b);
  // faces: top 4-5-6-7, right 1-2-6-5, left 0-3-7-4 (depending on yaw)
  const top = [c[4], c[5], c[6], c[7]];
  const front = [c[3], c[2], c[6], c[7]];
  const side = [c[1], c[2], c[6], c[5]];

  const depthKey = (face) => face.reduce((s, p) => s + p.depth, 0) / face.length;
  const faces = [
    { pts: front, fill: shade(b.color, 0.72), key: depthKey(front) },
    { pts: side, fill: shade(b.color, 0.55), key: depthKey(side) },
    { pts: top, fill: shade(b.color, 1.05), key: depthKey(top) }
  ].sort((a, b2) => a.key - b2.key);

  ctx.save();
  ctx.globalAlpha = alpha;
  faces.forEach((f) => {
    drawFace(f.pts, f.fill, "rgba(0,0,0,0.18)");
  });
  if (b.perfect) {
    ctx.globalAlpha = alpha * 0.9;
    drawFace(top, "rgba(255,255,255,0.22)");
  }
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
  camYaw = 0.55;
  targetYaw = 0.55;
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
  targetYaw = 0.45 + (stack.length % 2) * 0.22;
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

  let overlap;
  let placed;

  if (axis === "x") {
    const left = Math.max(current.x - current.w / 2, prev.x - prev.w / 2);
    const right = Math.min(current.x + current.w / 2, prev.x + prev.w / 2);
    overlap = right - left;
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
    // debris slabs
    const cutL = current.x - current.w / 2;
    const cutR = current.x + current.w / 2;
    if (!perfect && cutL < left - 0.01) {
      spawnDebris({
        x: (cutL + left) / 2,
        y: current.y,
        z: current.z,
        w: left - cutL,
        d: current.d,
        h: BLOCK_H,
        color: current.color,
        vx: -3.5,
        vz: 0
      });
    }
    if (!perfect && cutR > right + 0.01) {
      spawnDebris({
        x: (right + cutR) / 2,
        y: current.y,
        z: current.z,
        w: cutR - right,
        d: current.d,
        h: BLOCK_H,
        color: current.color,
        vx: 3.5,
        vz: 0
      });
    }
  } else {
    const near = Math.max(current.z - current.d / 2, prev.z - prev.d / 2);
    const far = Math.min(current.z + current.d / 2, prev.z + prev.d / 2);
    overlap = far - near;
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
    if (!perfect && cutN < near - 0.01) {
      spawnDebris({
        x: current.x,
        y: current.y,
        z: (cutN + near) / 2,
        w: current.w,
        d: near - cutN,
        h: BLOCK_H,
        color: current.color,
        vx: 0,
        vz: -3.5
      });
    }
    if (!perfect && cutF > far + 0.01) {
      spawnDebris({
        x: current.x,
        y: current.y,
        z: (far + cutF) / 2,
        w: current.w,
        d: cutF - far,
        h: BLOCK_H,
        color: current.color,
        vx: 0,
        vz: 3.5
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

  targetCamY = Math.max(0, placed.y - 3.2);
  spawnCurrent();
  checkAchievements();
}

function spawnDebris(piece) {
  debris.push({
    ...piece,
    life: 1.1,
    vy: 1.2 + Math.random() * 0.8
  });
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
      vx: current.axis === "x" ? current.dir * 4 : 0,
      vz: current.axis === "z" ? current.dir * 4 : 0
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
  camYaw += (targetYaw - camYaw) * Math.min(1, dt * 3);

  debris = debris.filter((p) => {
    p.life -= dt;
    p.y -= p.vy * dt;
    p.x += (p.vx || 0) * dt;
    p.z += (p.vz || 0) * dt;
    p.vy += 10 * dt;
    return p.life > 0;
  });

  if (shake > 0) shake = Math.max(0, shake - dt * 40);
  if (perfectFlash > 0) perfectFlash = Math.max(0, perfectFlash - dt);
}

function drawBackground() {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, "#152048");
  g.addColorStop(0.55, "#0c1228");
  g.addColorStop(1, "#070b16");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // soft horizon glow
  const hg = ctx.createRadialGradient(W / 2, H * 0.7, 20, W / 2, H * 0.72, 280);
  hg.addColorStop(0, "rgba(80,120,255,0.18)");
  hg.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = hg;
  ctx.fillRect(0, 0, W, H);
}

function drawGround() {
  const size = 18;
  const pts = [
    project(-size, 0, -size),
    project(size, 0, -size),
    project(size, 0, size),
    project(-size, 0, size)
  ];
  drawFace(pts, "rgba(30,40,75,0.85)", "rgba(90,110,180,0.25)");

  // grid
  ctx.save();
  ctx.strokeStyle = "rgba(120,150,255,0.12)";
  ctx.lineWidth = 1;
  for (let i = -8; i <= 8; i++) {
    const a = project(i * 2, 0.01, -size);
    const b = project(i * 2, 0.01, size);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    const c = project(-size, 0.01, i * 2);
    const d = project(size, 0.01, i * 2);
    ctx.beginPath();
    ctx.moveTo(c.x, c.y);
    ctx.lineTo(d.x, d.y);
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

  // Draw from bottom to top so higher floors paint on top in screen space
  const solids = [...stack];
  if (current) solids.push(current);
  solids
    .slice()
    .sort((a, b) => a.y - b.y)
    .forEach((b) => drawBox(b));

  debris.forEach((p) => drawBox(p, Math.max(0, p.life)));

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
