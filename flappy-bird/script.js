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
    body: "#3d5a80",
    wing: "#1b2838",
    beak: "#c9a227",
    belly: "#8a9a7b",
    eye: "#c8e6c0",
    pupil: "#0d1b12",
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
let wingPhase = 0;
let wingBurst = 0;

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
  wingPhase = 0;
  wingBurst = 0;
  spawnPipe(W + 80);
  updateHud();
}

function spawnPipe(x) {
  const minTop = 90;
  const maxTop = H - GROUND_H - PIPE_GAP - 90;
  const top = minTop + Math.random() * (maxTop - minTop);
  pipes.push({ x, top, scored: false });
}

function flap() {
  if (!running) return;
  bird.vy = FLAP;
  wingBurst = 1;
  window.HubSound?.play("flap");
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

  // Steady flap + a bit extra while rising / after a tap
  const flapRate = 6.5 + (bird.vy < 0 ? 2.5 : 0) + wingBurst * 5;
  wingPhase += dt * flapRate;
  wingBurst = Math.max(0, wingBurst - dt * 1.8);

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
  const beat = Math.sin(wingPhase);
  const sweep = beat * (1.05 + wingBurst * 0.4);
  const lift = Math.abs(beat) * 0.1;
  const dark = mixHex(s.body, "#05080e", 0.42);
  const mid = mixHex(s.body, s.wing, 0.4);
  const light = mixHex(s.body, "#d8e2ec", 0.22);
  const belly = s.belly || mixHex(s.body, "#c5b89a", 0.45);
  const horn = mixHex(s.beak || "#c9a227", "#5c4030", 0.15);
  const outline = mixHex(s.body, "#02040a", 0.62);
  const membrane = mixHex(s.wing, s.body, 0.25);

  ctx.save();
  ctx.translate(BIRD_X, bird.y);
  ctx.rotate(bird.rot * 0.55);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  ctx.fillStyle = "rgba(0,0,0,0.28)";
  ctx.beginPath();
  ctx.ellipse(0, 26, 22, 5, 0, 0, Math.PI * 2);
  ctx.fill();

  const ty = beat * 5 + wingBurst * 2;
  const tailGrad = ctx.createLinearGradient(-8, 0, -56, 8);
  tailGrad.addColorStop(0, s.body);
  tailGrad.addColorStop(0.55, mid);
  tailGrad.addColorStop(1, dark);
  ctx.fillStyle = tailGrad;
  ctx.strokeStyle = outline;
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(-12, 2);
  ctx.bezierCurveTo(-26, -6 + ty, -40, 4 + ty, -58, 0 + ty);
  ctx.quadraticCurveTo(-52, 8 + ty, -44, 10 + ty);
  ctx.bezierCurveTo(-32, 12 + ty * 0.5, -20, 10, -12, 8);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.strokeStyle = outline;
  ctx.globalAlpha = 0.28;
  ctx.lineWidth = 1.2;
  for (let i = 0; i < 5; i++) {
    const tx = -18 - i * 7;
    ctx.beginPath();
    ctx.arc(tx, 4 + ty * (i / 8), 3.2, 0.2, Math.PI - 0.2);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  ctx.fillStyle = mid;
  ctx.strokeStyle = outline;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-54, 1 + ty);
  ctx.lineTo(-66, -8 + ty);
  ctx.lineTo(-60, 2 + ty);
  ctx.lineTo(-66, 11 + ty);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.save();
  ctx.translate(-4, -8);
  ctx.rotate(-1.05 + sweep * 0.95 - lift);
  drawDragonWing(s, outline, membrane, belly, 0.72);
  ctx.restore();

  ctx.fillStyle = dark;
  ctx.strokeStyle = outline;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-6, 10);
  ctx.quadraticCurveTo(-4, 18, 2, 20);
  ctx.quadraticCurveTo(6, 18, 4, 12);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = horn;
  ctx.beginPath();
  ctx.moveTo(2, 20);
  ctx.lineTo(8, 22);
  ctx.lineTo(3, 18);
  ctx.closePath();
  ctx.fill();

  const bodyGrad = ctx.createLinearGradient(-6, -16, 6, 18);
  bodyGrad.addColorStop(0, light);
  bodyGrad.addColorStop(0.4, s.body);
  bodyGrad.addColorStop(1, dark);
  ctx.fillStyle = bodyGrad;
  ctx.strokeStyle = outline;
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(-16, 2);
  ctx.bezierCurveTo(-18, -12, -4, -18, 10, -12);
  ctx.bezierCurveTo(16, -10, 18, -2, 16, 6);
  ctx.bezierCurveTo(14, 16, 0, 18, -10, 14);
  ctx.bezierCurveTo(-16, 10, -17, 6, -16, 2);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.strokeStyle = outline;
  ctx.lineWidth = 1.1;
  ctx.globalAlpha = 0.32;
  for (let row = 0; row < 3; row++) {
    const y = -2 + row * 5;
    for (let col = 0; col < 4; col++) {
      const x = -8 + col * 6 + (row % 2) * 3;
      ctx.beginPath();
      ctx.arc(x, y, 2.6, 0.15, Math.PI - 0.15);
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;

  const bellyGrad = ctx.createLinearGradient(0, 0, 0, 16);
  bellyGrad.addColorStop(0, mixHex(belly, "#efe6d0", 0.2));
  bellyGrad.addColorStop(1, mixHex(belly, "#5a4e3a", 0.25));
  ctx.fillStyle = bellyGrad;
  ctx.beginPath();
  ctx.ellipse(2, 8, 11, 7.5, -0.06, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = outline;
  ctx.lineWidth = 1.3;
  ctx.globalAlpha = 0.4;
  for (const yy of [4, 8, 12]) {
    ctx.beginPath();
    ctx.moveTo(-6, yy);
    ctx.quadraticCurveTo(2, yy + 2, 10, yy);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  for (const [x, h] of [
    [-10, 9],
    [-3, 12],
    [4, 11],
    [11, 8]
  ]) {
    ctx.fillStyle = mid;
    ctx.strokeStyle = outline;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(x - 2.5, -8);
    ctx.lineTo(x, -8 - h);
    ctx.lineTo(x + 2.5, -8);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  ctx.fillStyle = bodyGrad;
  ctx.beginPath();
  ctx.moveTo(10, -6);
  ctx.bezierCurveTo(16, -14, 24, -12, 30, -6);
  ctx.bezierCurveTo(36, -2, 38, 4, 34, 8);
  ctx.bezierCurveTo(28, 10, 18, 8, 12, 4);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = outline;
  ctx.lineWidth = 2.3;
  ctx.stroke();

  const snoutGrad = ctx.createLinearGradient(28, -4, 44, 6);
  snoutGrad.addColorStop(0, s.body);
  snoutGrad.addColorStop(1, dark);
  ctx.fillStyle = snoutGrad;
  ctx.beginPath();
  ctx.moveTo(28, -2);
  ctx.quadraticCurveTo(40, -4, 46, 2);
  ctx.quadraticCurveTo(42, 8, 30, 6);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = outline;
  ctx.beginPath();
  ctx.ellipse(42, 0, 1.6, 1.1, 0.2, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#e8e4d8";
  ctx.beginPath();
  ctx.moveTo(36, 5);
  ctx.lineTo(37.5, 8);
  ctx.lineTo(38.5, 5);
  ctx.moveTo(40, 5);
  ctx.lineTo(41, 7.5);
  ctx.lineTo(42, 5);
  ctx.fill();

  ctx.fillStyle = dark;
  ctx.beginPath();
  ctx.ellipse(24, -5, 5, 2.2, -0.35, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = s.eye || "#b8e0a8";
  ctx.strokeStyle = outline;
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.ellipse(25, -3, 4.2, 2.6, -0.15, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = s.pupil || "#0a1208";
  ctx.beginPath();
  ctx.ellipse(25.8, -3, 1.3, 2.1, -0.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  ctx.beginPath();
  ctx.arc(24.2, -3.8, 0.9, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = horn;
  ctx.strokeStyle = mixHex(horn, "#1a1008", 0.45);
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(16, -10);
  ctx.quadraticCurveTo(10, -22, 12, -30);
  ctx.quadraticCurveTo(16, -24, 18, -12);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(21, -10);
  ctx.quadraticCurveTo(22, -24, 28, -32);
  ctx.quadraticCurveTo(26, -22, 24, -11);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.save();
  ctx.translate(2, -6);
  ctx.rotate(-0.9 + sweep - lift);
  drawDragonWing(s, outline, membrane, belly, 1);
  ctx.restore();

  ctx.fillStyle = mid;
  ctx.strokeStyle = outline;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(8, 8);
  ctx.quadraticCurveTo(14, 14, 18, 16);
  ctx.quadraticCurveTo(14, 12, 10, 8);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = horn;
  ctx.beginPath();
  ctx.moveTo(17, 15);
  ctx.lineTo(22, 18);
  ctx.lineTo(18, 14);
  ctx.closePath();
  ctx.fill();

  if (bird.vy < -50) {
    const pulse = 0.75 + Math.sin(distance * 0.2) * 0.25;
    ctx.save();
    ctx.translate(44, 2);
    ctx.globalAlpha = 0.92;
    const fg = ctx.createLinearGradient(0, 0, 26 * pulse, 0);
    fg.addColorStop(0, "#fff8e0");
    fg.addColorStop(0.25, "#ffd43b");
    fg.addColorStop(0.55, "#ff7a1a");
    fg.addColorStop(0.85, "#e03131");
    fg.addColorStop(1, "rgba(120,20,0,0)");
    ctx.fillStyle = fg;
    ctx.beginPath();
    ctx.moveTo(0, -3);
    ctx.quadraticCurveTo(12, -8, 26 * pulse, 0);
    ctx.quadraticCurveTo(12, 8, 0, 4);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  ctx.restore();
}

function drawDragonWing(s, outline, membrane, belly, alpha) {
  ctx.globalAlpha = alpha;
  const bone = mixHex(s.body, "#1a1520", 0.2);
  const skin = membrane || s.wing;

  const wg = ctx.createLinearGradient(0, 0, -40, -8);
  wg.addColorStop(0, mixHex(skin, s.body, 0.2));
  wg.addColorStop(0.5, skin);
  wg.addColorStop(1, mixHex(skin, "#0a0c12", 0.35));
  ctx.fillStyle = wg;
  ctx.strokeStyle = outline;
  ctx.lineWidth = 2;

  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(-8, -4);
  ctx.quadraticCurveTo(-22, -10, -38, -8);
  ctx.quadraticCurveTo(-48, -6, -52, 2);
  ctx.quadraticCurveTo(-44, 6, -30, 4);
  ctx.quadraticCurveTo(-16, 6, -4, 4);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = mixHex(belly, skin, 0.4);
  ctx.globalAlpha = alpha * 0.35;
  ctx.beginPath();
  ctx.moveTo(-2, 1);
  ctx.quadraticCurveTo(-18, 0, -36, -2);
  ctx.quadraticCurveTo(-40, 2, -28, 3);
  ctx.quadraticCurveTo(-14, 4, -4, 3);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = alpha;

  ctx.strokeStyle = bone;
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(-36, -6);
  ctx.stroke();

  ctx.lineWidth = 2;
  const digits = [
    [-12, -2, -40, -14],
    [-14, 0, -46, -4],
    [-12, 2, -42, 6],
    [-8, 3, -28, 8]
  ];
  for (const [x1, y1, x2, y2] of digits) {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  ctx.strokeStyle = outline;
  ctx.lineWidth = 1;
  ctx.globalAlpha = alpha * 0.45;
  ctx.beginPath();
  ctx.moveTo(-36, -6);
  ctx.quadraticCurveTo(-42, -12, -40, -14);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-36, -6);
  ctx.quadraticCurveTo(-48, -6, -46, -4);
  ctx.stroke();
  ctx.globalAlpha = alpha;

  ctx.fillStyle = s.beak || "#c9a227";
  ctx.beginPath();
  ctx.moveTo(-8, -4);
  ctx.lineTo(-14, -10);
  ctx.lineTo(-6, -2);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = outline;
  ctx.lineWidth = 1.4;
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
