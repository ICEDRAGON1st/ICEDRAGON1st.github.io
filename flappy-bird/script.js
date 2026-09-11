const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const scoreEl = document.getElementById("score");
const highScoreEl = document.getElementById("high-score");
const hudSkinEl = document.getElementById("hud-skin");
const overlay = document.getElementById("overlay");
const overlayTitle = document.getElementById("overlay-title");
const overlayText = document.getElementById("overlay-text");
const startBtn = document.getElementById("start-btn");
const resumeBtn = document.getElementById("resume-btn");
const viewBoardBtn = document.getElementById("view-board-btn");
const gamesBtn = document.getElementById("games-btn");
const menuBtn = document.getElementById("menu-btn");
const skinPicker = document.getElementById("skin-picker");

const W = canvas.width;
const H = canvas.height;
const HIGH_SCORE_KEY = "flappy-bird-high-score";
const SKIN_KEY = "flappy-bird-skin";

const GRAVITY = 980;
const FLAP = -320;
const PIPE_WIDTH = 96;
const PIPE_GAP = 225;
const PIPE_SPACING = 330;
const GROUND_H = 108;
const BIRD_X = 144;
const BIRD_R = 24;

const SKINS = {
  classic: {
    label: "Dragon",
    body: "#5c7cfa",
    wing: "#364fc7",
    beak: "#ffd43b",
    belly: "#a5d8ff",
    eye: "#fff",
    pupil: "#1a1b4b",
    skyTop: "#1b3a5c",
    skyBottom: "#4c6ef5",
    pipe: "#8b7355",
    pipeDark: "#6b5540",
    pipeStroke: "#3d3228",
    pipeLight: "#a89070",
    ground: "#3d4a3a",
    grass: "#5c8a4a",
    dirt: "#2f382c"
  },
  sky: {
    label: "Sky",
    body: "#4dabf7",
    wing: "#228be6",
    beak: "#ff922b",
    belly: "#d0ebff",
    eye: "#fff",
    pupil: "#111",
    skyTop: "#74c0fc",
    skyBottom: "#a5d8ff",
    pipe: "#7a8799",
    pipeDark: "#5c6778",
    pipeStroke: "#3a4250",
    pipeLight: "#9aa6b5",
    ground: "#dee2e6",
    grass: "#69db7c",
    dirt: "#adb5bd"
  },
  rose: {
    label: "Rose",
    body: "#ff8787",
    wing: "#fa5252",
    beak: "#ffd43b",
    belly: "#ffc9c9",
    eye: "#fff",
    pupil: "#111",
    skyTop: "#ffa8a8",
    skyBottom: "#ffc9c9",
    pipe: "#9a7b6f",
    pipeDark: "#7a5f55",
    pipeStroke: "#4a3832",
    pipeLight: "#b89888",
    ground: "#e9d5c7",
    grass: "#8ce99a",
    dirt: "#d0b8a8"
  },
  ember: {
    label: "Ember",
    body: "#ff922b",
    wing: "#f76707",
    beak: "#ffd43b",
    belly: "#ffd8a8",
    eye: "#fff",
    pupil: "#111",
    skyTop: "#ff922b",
    skyBottom: "#ffa94d",
    pipe: "#6b4f3a",
    pipeDark: "#4a3528",
    pipeStroke: "#2a1c14",
    pipeLight: "#8a6a50",
    ground: "#e9b872",
    grass: "#94d82d",
    dirt: "#c98c3a"
  },
  mint: {
    label: "Mint",
    body: "#63e6be",
    wing: "#20c997",
    beak: "#fcc419",
    belly: "#c3fae8",
    eye: "#fff",
    pupil: "#111",
    skyTop: "#96f2d7",
    skyBottom: "#c3fae8",
    pipe: "#6d7a6e",
    pipeDark: "#515a52",
    pipeStroke: "#2f3630",
    pipeLight: "#8a968b",
    ground: "#d8f5a2",
    grass: "#8ce99a",
    dirt: "#c0eb75"
  },
  ice: {
    label: "Ice",
    body: "#a5d8ff",
    wing: "#74c0fc",
    beak: "#e7f5ff",
    belly: "#e7f5ff",
    eye: "#fff",
    pupil: "#1864ab",
    skyTop: "#d0ebff",
    skyBottom: "#e7f5ff",
    pipe: "#8ba0b0",
    pipeDark: "#6a7f90",
    pipeStroke: "#3d4f5c",
    pipeLight: "#a8bcc9",
    ground: "#e9ecef",
    grass: "#99e9f2",
    dirt: "#ced4da"
  },
  midnight: {
    label: "Midnight",
    body: "#845ef7",
    wing: "#7048e8",
    beak: "#ffd43b",
    belly: "#b197fc",
    eye: "#e7f5ff",
    pupil: "#212529",
    skyTop: "#364fc7",
    skyBottom: "#5c7cfa",
    pipe: "#5c5f72",
    pipeDark: "#3f4254",
    pipeStroke: "#222433",
    pipeLight: "#787b90",
    ground: "#495057",
    grass: "#748ffc",
    dirt: "#343a40"
  },
  gold: {
    label: "Gold",
    body: "#ffd43b",
    wing: "#fab005",
    beak: "#fd7e14",
    belly: "#fff3bf",
    eye: "#fff",
    pupil: "#111",
    skyTop: "#ffe066",
    skyBottom: "#ffec99",
    pipe: "#8a7350",
    pipeDark: "#6a5638",
    pipeStroke: "#3d301c",
    pipeLight: "#a89068",
    ground: "#f3d19c",
    grass: "#a9e34b",
    dirt: "#e0b070"
  }
};

let bird = { y: H / 2, vy: 0, rot: 0 };
let pipes = [];
let score = 0;
let highScore = loadHighScore();
let running = false;
let menuMode = "start";
let lastTime = 0;
let distance = 0;
let groundOffset = 0;
let skinId = loadSkin();

function loadHighScore() {
  try {
    const saved = Number(localStorage.getItem(HIGH_SCORE_KEY));
    return Number.isFinite(saved) && saved > 0 ? Math.floor(saved) : 0;
  } catch {
    return 0;
  }
}

function saveHighScore() {
  localStorage.setItem(HIGH_SCORE_KEY, String(highScore));
}

function loadSkin() {
  try {
    const id = localStorage.getItem(SKIN_KEY) || "classic";
    return SKINS[id] ? id : "classic";
  } catch {
    return "classic";
  }
}

function skin() {
  return SKINS[skinId] || SKINS.classic;
}

function updateSkinPicker() {
  skinPicker?.querySelectorAll("[data-skin]").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.skin === skinId);
  });
  if (hudSkinEl) hudSkinEl.textContent = skin().label;
}

function setSkin(id) {
  if (!SKINS[id]) return;
  skinId = id;
  try {
    localStorage.setItem(SKIN_KEY, id);
  } catch {}
  updateSkinPicker();
  draw();
}

function updateHud() {
  scoreEl.textContent = String(score);
  highScoreEl.textContent = String(highScore);
  if (hudSkinEl) hudSkinEl.textContent = skin().label;
}

function pipeSpeed() {
  return 150 + Math.min(score * 4, 80);
}

function resetGame() {
  bird = { y: H / 2, vy: 0, rot: 0 };
  pipes = [];
  score = 0;
  distance = 0;
  groundOffset = 0;
  spawnPipe(W + 80);
  updateHud();
}

function spawnPipe(x) {
  const minTop = 90;
  const maxTop = H - GROUND_H - PIPE_GAP - 90;
  const top = minTop + Math.random() * (maxTop - minTop);
  pipes.push({ x, top, scored: false });
}

function showMenu(mode, title, text) {
  menuMode = mode;
  running = false;

  overlayTitle.textContent = title;
  overlayText.textContent = text;
  updateSkinPicker();

  if (mode === "pause") {
    resumeBtn.classList.remove("hidden");
    viewBoardBtn?.classList.add("hidden");
    startBtn.textContent = "Restart";
  } else if (mode === "over") {
    resumeBtn.classList.add("hidden");
    viewBoardBtn?.classList.remove("hidden");
    startBtn.textContent = "Try Again";
  } else {
    resumeBtn.classList.add("hidden");
    viewBoardBtn?.classList.add("hidden");
    startBtn.textContent = "Start";
  }

  overlay.classList.remove("hidden");
}


function viewBoard() {
  if (menuMode !== "over") return;
  overlay.classList.add("hidden");
}

function openPauseMenu() {
  if (!running || menuMode === "over") return;
  showMenu("pause", "Menu", `Score ${score} · Best ${highScore}. Resume, restart, or go back to Games.`);
}

function startGame() {
  if (window.HubStreak) HubStreak.recordPlay();
  if (window.HubPlays) HubPlays.record("flappy");
  resetGame();
  overlay.classList.add("hidden");
  menuMode = "playing";
  running = true;
  lastTime = performance.now();
  requestAnimationFrame(loop);
}

function resumeGame() {
  if (menuMode !== "pause") return;
  overlay.classList.add("hidden");
  menuMode = "playing";
  running = true;
  lastTime = performance.now();
  requestAnimationFrame(loop);
}

function goToGames() {
  window.location.href = "../index.html#games";
}

function flap() {
  if (!running) return;
  bird.vy = FLAP;
  window.HubSound?.play("flap");
}

function circleRectHit(cx, cy, r, rx, ry, rw, rh) {
  const closestX = Math.max(rx, Math.min(cx, rx + rw));
  const closestY = Math.max(ry, Math.min(cy, ry + rh));
  const dx = cx - closestX;
  const dy = cy - closestY;
  return dx * dx + dy * dy < r * r;
}

function checkCollision() {
  if (bird.y - BIRD_R <= 0) return true;
  if (bird.y + BIRD_R >= H - GROUND_H) return true;

  for (const pipe of pipes) {
    const topH = pipe.top;
    const bottomY = pipe.top + PIPE_GAP;
    const bottomH = H - GROUND_H - bottomY;

    if (
      circleRectHit(BIRD_X, bird.y, BIRD_R - 2, pipe.x, 0, PIPE_WIDTH, topH) ||
      circleRectHit(BIRD_X, bird.y, BIRD_R - 2, pipe.x, bottomY, PIPE_WIDTH, bottomH)
    ) {
      return true;
    }
  }

  return false;
}

function gameOver() {
  running = false;
  menuMode = "over";
  const isNew = score > highScore;
  if (isNew) {
    highScore = score;
    saveHighScore();
  }
  if (highScore > 0) window.HubLeaderboard?.submit("flappy", highScore);
  updateHud();
  draw();
  if (window.HubAchievements) {
    if (score >= 5) HubAchievements.unlock("flappy_score_5");
    if (score >= 15) HubAchievements.unlock("flappy_score_15");
    if (score >= 30) HubAchievements.unlock("flappy_score_30");
  }
  window.HubSound?.play("lose");
  window.HubConfetti?.burst();
  showMenu(
    "over",
    "Game Over",
    `You scored ${score}. ${isNew ? `New best: ${highScore}!` : `Best: ${highScore}.`}`
  );
}

function update(dt) {
  const speed = pipeSpeed();
  bird.vy += GRAVITY * dt;
  bird.y += bird.vy * dt;
  bird.rot = Math.max(-0.5, Math.min(1.2, bird.vy / 420));

  distance += speed * dt;
  groundOffset = (groundOffset + speed * dt) % 42;

  if (pipes.length === 0 || pipes[pipes.length - 1].x < W - PIPE_SPACING) {
    spawnPipe(W + 40);
  }

  for (const pipe of pipes) {
    pipe.x -= speed * dt;

    if (!pipe.scored && pipe.x + PIPE_WIDTH < BIRD_X) {
      pipe.scored = true;
      score += 1;
      window.HubSound?.play("eat");
      if (score > highScore) {
        highScore = score;
        saveHighScore();
      }
      updateHud();
    }
  }

  while (pipes.length && pipes[0].x + PIPE_WIDTH < -20) {
    pipes.shift();
  }

  if (checkCollision()) {
    gameOver();
  }
}

function drawSky() {
  const s = skin();
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, s.skyTop);
  grad.addColorStop(1, s.skyBottom);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = "rgba(255,255,255,0.75)";
  drawCloud(90, 135, 0.9);
  drawCloud(375, 90, 1.1);
  drawCloud(270, 225, 0.75);
}

function drawCloud(x, y, scale) {
  ctx.beginPath();
  ctx.arc(x, y, 18 * scale, 0, Math.PI * 2);
  ctx.arc(x + 22 * scale, y + 4 * scale, 22 * scale, 0, Math.PI * 2);
  ctx.arc(x + 48 * scale, y, 16 * scale, 0, Math.PI * 2);
  ctx.fill();
}

function drawPipes() {
  const s = skin();
  for (const pipe of pipes) {
    const bottomY = pipe.top + PIPE_GAP;
    const bottomH = H - GROUND_H - bottomY;
    drawCastleTower(pipe.x, 0, PIPE_WIDTH, pipe.top, "down", s);
    drawCastleTower(pipe.x, bottomY, PIPE_WIDTH, bottomH, "up", s);
  }
}

function drawCastleTower(x, y, w, h, battlementSide, s) {
  if (h <= 0) return;

  // Main stone shaft
  ctx.fillStyle = s.pipe;
  ctx.fillRect(x, y, w, h);

  // Vertical edge shading
  ctx.fillStyle = s.pipeDark;
  ctx.fillRect(x, y, 10, h);
  ctx.fillStyle = s.pipeLight || s.pipe;
  ctx.globalAlpha = 0.35;
  ctx.fillRect(x + w - 12, y, 12, h);
  ctx.globalAlpha = 1;

  // Brick rows
  ctx.strokeStyle = s.pipeStroke;
  ctx.lineWidth = 1.5;
  ctx.globalAlpha = 0.45;
  const brickH = 18;
  const brickW = w / 3;
  for (let by = y; by < y + h; by += brickH) {
    ctx.beginPath();
    ctx.moveTo(x, by);
    ctx.lineTo(x + w, by);
    ctx.stroke();
    const offset = Math.floor((by - y) / brickH) % 2 === 0 ? 0 : brickW / 2;
    for (let bx = x + offset; bx < x + w; bx += brickW) {
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.lineTo(bx, Math.min(by + brickH, y + h));
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;

  // Narrow window slits
  ctx.fillStyle = "rgba(20, 16, 12, 0.55)";
  const winW = 10;
  const winH = 16;
  for (let wy = y + 28; wy < y + h - 40; wy += 52) {
    ctx.fillRect(x + w * 0.28 - winW / 2, wy, winW, winH);
    ctx.fillRect(x + w * 0.72 - winW / 2, wy, winW, winH);
  }

  // Battlements (crenellations) facing the gap
  const merlonW = w / 5;
  const merlonH = 22;
  ctx.fillStyle = s.pipeDark;
  if (battlementSide === "down") {
    const by = y + h - merlonH;
    ctx.fillRect(x - 4, by, w + 8, merlonH);
    ctx.fillStyle = s.pipe;
    for (let i = 0; i < 5; i++) {
      if (i % 2 === 1) continue;
      ctx.fillRect(x - 4 + i * merlonW, by - 14, merlonW + 1, 14);
    }
  } else {
    ctx.fillRect(x - 4, y, w + 8, merlonH);
    ctx.fillStyle = s.pipe;
    for (let i = 0; i < 5; i++) {
      if (i % 2 === 1) continue;
      ctx.fillRect(x - 4 + i * merlonW, y + merlonH, merlonW + 1, 14);
    }
  }

  ctx.strokeStyle = s.pipeStroke;
  ctx.lineWidth = 3;
  ctx.strokeRect(x, y, w, h);
}

function drawGround() {
  const s = skin();
  ctx.fillStyle = s.ground;
  ctx.fillRect(0, H - GROUND_H, W, GROUND_H);

  ctx.fillStyle = s.grass;
  ctx.fillRect(0, H - GROUND_H, W, 24);

  ctx.fillStyle = s.dirt;
  for (let x = -groundOffset; x < W + 42; x += 42) {
    ctx.fillRect(x, H - GROUND_H + 27, 21, 12);
    ctx.fillRect(x + 21, H - GROUND_H + 51, 21, 12);
  }
}

function mixHex(a, b, t) {
  const p = (h) => {
    const n = h.replace("#", "");
    const full = n.length === 3 ? n.split("").map((c) => c + c).join("") : n;
    return [
      parseInt(full.slice(0, 2), 16),
      parseInt(full.slice(2, 4), 16),
      parseInt(full.slice(4, 6), 16)
    ];
  };
  try {
    const [ar, ag, ab] = p(a);
    const [br, bg, bb] = p(b);
    const r = Math.round(ar + (br - ar) * t);
    const g = Math.round(ag + (bg - ag) * t);
    const bl = Math.round(ab + (bb - ab) * t);
    return `rgb(${r},${g},${bl})`;
  } catch {
    return a;
  }
}

function drawBird() {
  const s = skin();
  const flap = Math.sin(distance * 0.055) * 0.45 + Math.max(-0.25, Math.min(0.55, bird.rot)) * 0.55;
  const dark = mixHex(s.body, "#0b1020", 0.35);
  const mid = mixHex(s.body, s.wing, 0.35);
  const light = mixHex(s.body, "#ffffff", 0.28);
  const belly = s.belly || mixHex(s.body, "#ffffff", 0.45);
  const horn = s.beak || "#ffd43b";
  const outline = mixHex(s.body, "#0a0c14", 0.55);

  ctx.save();
  ctx.translate(BIRD_X, bird.y);
  ctx.rotate(bird.rot * 0.65);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  // Shadow
  ctx.fillStyle = "rgba(0,0,0,0.2)";
  ctx.beginPath();
  ctx.ellipse(1, 24, 18, 5.5, 0, 0, Math.PI * 2);
  ctx.fill();

  // ===== Tail =====
  const ty = flap * 7;
  ctx.fillStyle = s.body;
  ctx.strokeStyle = outline;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(-10, 4);
  ctx.bezierCurveTo(-24, -4 + ty, -38, 6 + ty, -50, 2 + ty);
  ctx.quadraticCurveTo(-42, 16 + ty * 0.6, -14, 12);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Tail gradient highlight
  const tailGrad = ctx.createLinearGradient(-50, 0, -10, 8);
  tailGrad.addColorStop(0, mid);
  tailGrad.addColorStop(1, s.body);
  ctx.fillStyle = tailGrad;
  ctx.beginPath();
  ctx.moveTo(-12, 5);
  ctx.bezierCurveTo(-24, -1 + ty, -36, 7 + ty, -46, 4 + ty);
  ctx.quadraticCurveTo(-40, 12 + ty * 0.5, -14, 10);
  ctx.closePath();
  ctx.fill();

  // Tail fin
  ctx.fillStyle = s.wing;
  ctx.strokeStyle = outline;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-46, 2 + ty);
  ctx.lineTo(-58, -6 + ty);
  ctx.lineTo(-54, 4 + ty);
  ctx.lineTo(-58, 12 + ty);
  ctx.lineTo(-46, 8 + ty);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // ===== Far wing =====
  ctx.save();
  ctx.translate(-4, -4);
  ctx.rotate(-0.85 + flap * 1.05);
  drawDragonWing(s, outline, belly, 0.78);
  ctx.restore();

  // ===== Main body (single rounded sausage + head) =====
  // Body fill with gradient
  const bodyGrad = ctx.createLinearGradient(-8, -18, 8, 22);
  bodyGrad.addColorStop(0, light);
  bodyGrad.addColorStop(0.45, s.body);
  bodyGrad.addColorStop(1, dark);
  ctx.fillStyle = bodyGrad;
  ctx.beginPath();
  ctx.moveTo(-18, 4);
  ctx.bezierCurveTo(-20, -14, 2, -18, 14, -10);
  ctx.bezierCurveTo(22, -16, 34, -10, 36, 0);
  ctx.bezierCurveTo(38, 8, 32, 14, 22, 14);
  ctx.bezierCurveTo(10, 20, -8, 18, -16, 10);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = outline;
  ctx.lineWidth = 2.75;
  ctx.stroke();

  // Belly
  const bellyGrad = ctx.createLinearGradient(0, 0, 0, 18);
  bellyGrad.addColorStop(0, mixHex(belly, "#ffffff", 0.25));
  bellyGrad.addColorStop(1, belly);
  ctx.fillStyle = bellyGrad;
  ctx.beginPath();
  ctx.ellipse(2, 8, 12, 9, -0.08, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = outline;
  ctx.lineWidth = 1.5;
  ctx.globalAlpha = 0.3;
  for (const yy of [5, 9, 13]) {
    ctx.beginPath();
    ctx.moveTo(-6, yy);
    ctx.quadraticCurveTo(2, yy + 2.5, 10, yy - 0.5);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // Cheek blush
  ctx.fillStyle = "rgba(255, 120, 140, 0.35)";
  ctx.beginPath();
  ctx.ellipse(22, 4, 4.5, 3, 0.2, 0, Math.PI * 2);
  ctx.fill();

  // ===== Spikes =====
  ctx.fillStyle = s.wing;
  ctx.strokeStyle = outline;
  ctx.lineWidth = 2;
  const spikes = [
    [-10, -8, -8, -20, -4, -9],
    [-1, -12, 2, -26, 6, -12],
    [9, -12, 13, -24, 16, -11]
  ];
  for (const [x1, y1, x2, y2, x3, y3] of spikes) {
    const g = ctx.createLinearGradient(x2, y2, x2, y1);
    g.addColorStop(0, horn);
    g.addColorStop(1, s.wing);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.lineTo(x3, y3);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  // ===== Horns =====
  ctx.fillStyle = horn;
  ctx.strokeStyle = outline;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(12, -10);
  ctx.quadraticCurveTo(4, -20, 8, -30);
  ctx.quadraticCurveTo(14, -22, 16, -11);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(19, -11);
  ctx.quadraticCurveTo(20, -24, 28, -32);
  ctx.quadraticCurveTo(26, -20, 24, -10);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Horn shine
  ctx.strokeStyle = "rgba(255,255,255,0.55)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(11, -16);
  ctx.quadraticCurveTo(9, -22, 11, -26);
  ctx.stroke();

  // ===== Snout details =====
  ctx.fillStyle = mid;
  ctx.beginPath();
  ctx.ellipse(30, 1, 5, 3.5, 0.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = outline;
  ctx.beginPath();
  ctx.arc(32, 0, 1.15, 0, Math.PI * 2);
  ctx.fill();

  // ===== Eye (big & cute) =====
  ctx.fillStyle = "#fff";
  ctx.strokeStyle = outline;
  ctx.lineWidth = 2.25;
  ctx.beginPath();
  ctx.ellipse(17, -3, 6.5, 7.2, 0.08, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Iris
  const irisGrad = ctx.createRadialGradient(18.5, -2.5, 0.5, 18, -3, 5);
  irisGrad.addColorStop(0, mixHex(s.pupil, "#ffffff", 0.35));
  irisGrad.addColorStop(0.55, s.pupil);
  irisGrad.addColorStop(1, mixHex(s.pupil, "#000000", 0.35));
  ctx.fillStyle = irisGrad;
  ctx.beginPath();
  ctx.ellipse(18.5, -2.5, 3.4, 4.2, 0.08, 0, Math.PI * 2);
  ctx.fill();

  // Pupil
  ctx.fillStyle = "#0a0a12";
  ctx.beginPath();
  ctx.ellipse(19, -2.2, 1.6, 2.4, 0.08, 0, Math.PI * 2);
  ctx.fill();

  // Highlights
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(15.8, -5.5, 2.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(19.8, -0.8, 1.05, 0, Math.PI * 2);
  ctx.fill();

  // Eye lid hint
  ctx.strokeStyle = outline;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(17, -3, 6.5, 7.2, 0.08, -2.6, -0.4);
  ctx.stroke();

  // Smile
  ctx.strokeStyle = outline;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(27.5, 4.5, 4.5, 0.2, Math.PI - 0.25);
  ctx.stroke();

  // ===== Near wing =====
  ctx.save();
  ctx.translate(2, -2);
  ctx.rotate(-0.2 + flap);
  drawDragonWing(s, outline, belly, 1);
  ctx.restore();

  // Tiny foreleg
  ctx.fillStyle = s.body;
  ctx.strokeStyle = outline;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(10, 15, 5.5, 3.8, 0.35, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // Claw dots
  ctx.fillStyle = horn;
  ctx.beginPath();
  ctx.arc(13, 17, 1.2, 0, Math.PI * 2);
  ctx.arc(15.5, 16, 1.1, 0, Math.PI * 2);
  ctx.fill();

  // ===== Flame =====
  if (bird.vy < -50) {
    const pulse = 0.75 + Math.sin(distance * 0.22) * 0.25;
    ctx.save();
    ctx.translate(34, 2);
    ctx.globalAlpha = 0.95;
    const fg = ctx.createLinearGradient(0, 0, 22 * pulse, 0);
    fg.addColorStop(0, "#fff3bf");
    fg.addColorStop(0.35, "#ffd43b");
    fg.addColorStop(0.7, "#ff922b");
    fg.addColorStop(1, "rgba(255,100,50,0)");
    ctx.fillStyle = fg;
    ctx.beginPath();
    ctx.moveTo(0, -2);
    ctx.quadraticCurveTo(10, -6, 20 * pulse, 0);
    ctx.quadraticCurveTo(10, 6, 0, 3);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  ctx.restore();
}

function drawDragonWing(s, outline, belly, alpha) {
  ctx.globalAlpha = alpha;

  // Membrane gradient
  const wg = ctx.createLinearGradient(0, 0, 18, -30);
  wg.addColorStop(0, s.wing);
  wg.addColorStop(0.55, mixHex(s.wing, belly, 0.35));
  wg.addColorStop(1, mixHex(s.wing, "#ffffff", 0.15));
  ctx.fillStyle = wg;
  ctx.strokeStyle = outline;
  ctx.lineWidth = 2.4;

  ctx.beginPath();
  ctx.moveTo(0, 2);
  ctx.quadraticCurveTo(-8, -10, 2, -30);
  ctx.quadraticCurveTo(10, -36, 20, -28);
  ctx.quadraticCurveTo(28, -16, 24, -2);
  ctx.quadraticCurveTo(14, 4, 4, 4);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Inner glow panel
  ctx.fillStyle = belly;
  ctx.globalAlpha = alpha * 0.4;
  ctx.beginPath();
  ctx.moveTo(3, 0);
  ctx.quadraticCurveTo(2, -12, 8, -22);
  ctx.quadraticCurveTo(14, -14, 12, -2);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = alpha;

  // Wing bones
  ctx.strokeStyle = outline;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, 2);
  ctx.quadraticCurveTo(4, -12, 8, -32);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0, 2);
  ctx.quadraticCurveTo(12, -6, 24, -6);
  ctx.stroke();
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(6, -14);
  ctx.lineTo(16, -16);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(8, -8);
  ctx.lineTo(18, -8);
  ctx.stroke();

  // Claw tip on wing
  ctx.fillStyle = s.beak || "#ffd43b";
  ctx.beginPath();
  ctx.arc(8, -32, 2.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = outline;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.globalAlpha = 1;
}

function drawScore() {
  if (!running) return;
  ctx.fillStyle = "#fff";
  ctx.strokeStyle = "rgba(0,0,0,0.25)";
  ctx.lineWidth = 6;
  ctx.font = "800 64px Segoe UI, system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.strokeText(String(score), W / 2, 108);
  ctx.fillText(String(score), W / 2, 108);
}

function draw() {
  drawSky();
  drawPipes();
  drawGround();
  drawBird();
  drawScore();
}

function loop(now) {
  if (!running) return;

  const dt = Math.min(0.033, (now - lastTime) / 1000);
  lastTime = now;
  update(dt);
  draw();

  if (running) requestAnimationFrame(loop);
}

function handleFlapAction(e) {
  if (overlay.classList.contains("hidden")) {
    if (running) {
      e?.preventDefault?.();
      flap();
    }
  }
}

canvas.addEventListener("pointerdown", (e) => {
  e.preventDefault();
  handleFlapAction(e);
});

window.addEventListener("keydown", (e) => {
  if (e.code === "Escape") {
    e.preventDefault();
    if (menuMode === "pause" && !overlay.classList.contains("hidden")) resumeGame();
    else if (running) openPauseMenu();
    else overlay.classList.remove("hidden");
    return;
  }

  if (e.code === "Space" || e.code === "ArrowUp") {
    e.preventDefault();
    handleFlapAction(e);
  }
});

menuBtn.addEventListener("click", () => {
  if (menuMode === "over") {
    overlay.classList.remove("hidden");
    return;
  }
  if (running) openPauseMenu();
  else if (menuMode === "pause") resumeGame();
  else overlay.classList.remove("hidden");
});

skinPicker?.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-skin]");
  if (!btn) return;
  setSkin(btn.dataset.skin);
});

startBtn.addEventListener("click", () => startGame());
resumeBtn.addEventListener("click", () => resumeGame());
viewBoardBtn?.addEventListener("click", () => viewBoard());
gamesBtn.addEventListener("click", () => goToGames());

updateHud();
updateSkinPicker();
resetGame();
draw();
showMenu(
  "start",
  "Wing Hop",
  "Tap, click, or press Space to flap. Fly your dragon through the castle towers."
);
