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
const BLOCK_H = 28;
const START_WIDTH = 180;
const MIN_WIDTH = 14;
const PERFECT_PX = 5;
const BASE_SPEED = 165;
const SPEED_STEP = 9;
const MAX_SPEED = 420;
const COLORS = ["#7c9cff", "#66d9e8", "#63e6be", "#ffd43b", "#ff922b", "#ff6b6b", "#da77f2"];

let stack = [];
let current = null;
let score = 0;
let highScore = loadHighScore();
let running = false;
let menuMode = "start";
let cameraY = 0;
let targetCameraY = 0;
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

function resetGame() {
  const baseY = H - 90;
  stack = [
    {
      x: (W - START_WIDTH) / 2,
      y: baseY,
      w: START_WIDTH,
      h: BLOCK_H,
      color: colorFor(0)
    }
  ];
  score = 0;
  cameraY = 0;
  targetCameraY = 0;
  shake = 0;
  perfectFlash = 0;
  playedThisRun = false;
  spawnCurrent();
  updateHud();
}

function spawnCurrent() {
  const top = stack[stack.length - 1];
  const speed = Math.min(MAX_SPEED, BASE_SPEED + score * SPEED_STEP);
  current = {
    x: 20,
    y: top.y - BLOCK_H - 2,
    w: top.w,
    h: BLOCK_H,
    dir: 1,
    speed,
    color: colorFor(stack.length)
  };
}

function placeBlock() {
  if (!running || !current) return;

  if (!playedThisRun) {
    playedThisRun = true;
    window.HubStreak?.recordPlay?.();
    window.HubPlays?.record?.("stacker");
  }

  const prev = stack[stack.length - 1];
  const left = Math.max(current.x, prev.x);
  const right = Math.min(current.x + current.w, prev.x + prev.w);
  const overlap = right - left;

  if (overlap <= 0) {
    endGame(false);
    return;
  }

  let placedW = overlap;
  let placedX = left;
  let perfect = Math.abs(current.x - prev.x) <= PERFECT_PX;

  if (perfect) {
    placedX = prev.x;
    placedW = prev.w;
    perfectFlash = 0.35;
    window.HubSound?.play?.("eat");
  } else {
    window.HubSound?.play?.("click");
  }

  if (placedW < MIN_WIDTH) {
    endGame(false);
    return;
  }

  stack.push({
    x: placedX,
    y: current.y,
    w: placedW,
    h: BLOCK_H,
    color: current.color,
    perfect
  });
  score += 1;
  if (score > highScore) {
    highScore = score;
    saveHighScore();
  }
  updateHud();

  const visibleTop = 140;
  const worldTop = current.y - cameraY;
  if (worldTop < visibleTop) {
    targetCameraY = cameraY - (visibleTop - worldTop);
  }

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
  current = null;
  if (highScore > 0) window.HubLeaderboard?.submit?.("stacker", highScore);
  checkAchievements();
  if (!fromMenu) {
    window.HubSound?.play?.("lose");
    if (score >= 10) window.HubConfetti?.burst?.();
    shake = 10;
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
      menuMode === "start" ? "Tower Stack" : overlayTitle.textContent,
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
  if (!current) return;
  current.x += current.dir * current.speed * dt;
  if (current.x <= 12) {
    current.x = 12;
    current.dir = 1;
  } else if (current.x + current.w >= W - 12) {
    current.x = W - 12 - current.w;
    current.dir = -1;
  }
  cameraY += (targetCameraY - cameraY) * Math.min(1, dt * 6);
  if (shake > 0) shake = Math.max(0, shake - dt * 40);
  if (perfectFlash > 0) perfectFlash = Math.max(0, perfectFlash - dt);
}

function drawRounded(x, y, w, h, r, fill) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}

function draw() {
  const sx = shake ? (Math.random() - 0.5) * shake : 0;
  const sy = shake ? (Math.random() - 0.5) * shake : 0;

  ctx.clearRect(0, 0, W, H);
  ctx.save();
  ctx.translate(sx, sy - cameraY);

  // Sky bands
  for (let i = 0; i < 8; i++) {
    const y = -cameraY - 200 + i * 180;
    ctx.fillStyle = i % 2 === 0 ? "#0a1228" : "#0d1733";
    ctx.fillRect(0, y, W, 180);
  }

  // Ground
  const groundY = stack[0].y + BLOCK_H;
  ctx.fillStyle = "#1b2444";
  ctx.fillRect(0, groundY, W, H + cameraY + 400);
  ctx.fillStyle = "#2b3a6a";
  ctx.fillRect(0, groundY, W, 8);

  stack.forEach((b, i) => {
    drawRounded(b.x, b.y, b.w, b.h, 6, b.color);
    ctx.fillStyle = "rgba(255,255,255,0.18)";
    ctx.fillRect(b.x + 4, b.y + 3, Math.max(8, b.w - 8), 4);
    if (b.perfect) {
      ctx.strokeStyle = "rgba(255,255,255,0.55)";
      ctx.lineWidth = 2;
      ctx.strokeRect(b.x + 1, b.y + 1, b.w - 2, b.h - 2);
    }
    if (i === 0) {
      ctx.fillStyle = "rgba(0,0,0,0.25)";
      ctx.fillRect(b.x, b.y + b.h - 4, b.w, 4);
    }
  });

  if (current) {
    drawRounded(current.x, current.y, current.w, current.h, 6, current.color);
    ctx.fillStyle = "rgba(255,255,255,0.2)";
    ctx.fillRect(current.x + 4, current.y + 3, Math.max(8, current.w - 8), 4);
    // Ghost guide on previous top
    const prev = stack[stack.length - 1];
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    ctx.fillRect(prev.x, current.y + current.h + 4, prev.w, 3);
  }

  ctx.restore();

  if (perfectFlash > 0) {
    ctx.fillStyle = `rgba(255, 212, 59, ${perfectFlash * 0.35})`;
    ctx.fillRect(0, 0, W, H);
  }

  // Height badge
  ctx.fillStyle = "rgba(10,16,36,0.55)";
  ctx.fillRect(14, 14, 110, 34);
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
  "Tower Stack",
  "Tap, click, or press Space to drop each block. Stack as high as you can — missed overhang gets cut off."
);
