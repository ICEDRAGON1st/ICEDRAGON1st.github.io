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
    label: "Classic",
    body: "#f7c948",
    wing: "#e8b020",
    beak: "#f59f00",
    eye: "#fff",
    pupil: "#111",
    skyTop: "#4ec0ca",
    skyBottom: "#70c5ce",
    pipe: "#5ec15e",
    pipeDark: "#4aa84a",
    pipeStroke: "#2f7a2f",
    ground: "#deba63",
    grass: "#6bc96b",
    dirt: "#c9a552"
  },
  sky: {
    label: "Sky",
    body: "#4dabf7",
    wing: "#228be6",
    beak: "#ff922b",
    eye: "#fff",
    pupil: "#111",
    skyTop: "#74c0fc",
    skyBottom: "#a5d8ff",
    pipe: "#339af0",
    pipeDark: "#1c7ed6",
    pipeStroke: "#1864ab",
    ground: "#dee2e6",
    grass: "#69db7c",
    dirt: "#adb5bd"
  },
  rose: {
    label: "Rose",
    body: "#ff8787",
    wing: "#fa5252",
    beak: "#ffd43b",
    eye: "#fff",
    pupil: "#111",
    skyTop: "#ffa8a8",
    skyBottom: "#ffc9c9",
    pipe: "#f06595",
    pipeDark: "#d6336c",
    pipeStroke: "#a61e4d",
    ground: "#e9d5c7",
    grass: "#8ce99a",
    dirt: "#d0b8a8"
  },
  ember: {
    label: "Ember",
    body: "#ff922b",
    wing: "#f76707",
    beak: "#ffd43b",
    eye: "#fff",
    pupil: "#111",
    skyTop: "#ff922b",
    skyBottom: "#ffa94d",
    pipe: "#e8590c",
    pipeDark: "#d9480f",
    pipeStroke: "#a94100",
    ground: "#e9b872",
    grass: "#94d82d",
    dirt: "#c98c3a"
  },
  mint: {
    label: "Mint",
    body: "#63e6be",
    wing: "#20c997",
    beak: "#fcc419",
    eye: "#fff",
    pupil: "#111",
    skyTop: "#96f2d7",
    skyBottom: "#c3fae8",
    pipe: "#38d9a9",
    pipeDark: "#12b886",
    pipeStroke: "#087f5b",
    ground: "#d8f5a2",
    grass: "#8ce99a",
    dirt: "#c0eb75"
  },
  ice: {
    label: "Ice",
    body: "#a5d8ff",
    wing: "#74c0fc",
    beak: "#ffd8a8",
    eye: "#fff",
    pupil: "#1864ab",
    skyTop: "#d0ebff",
    skyBottom: "#e7f5ff",
    pipe: "#66d9e8",
    pipeDark: "#3bc9db",
    pipeStroke: "#0c8599",
    ground: "#e9ecef",
    grass: "#99e9f2",
    dirt: "#ced4da"
  },
  midnight: {
    label: "Midnight",
    body: "#845ef7",
    wing: "#7048e8",
    beak: "#ffd43b",
    eye: "#e7f5ff",
    pupil: "#212529",
    skyTop: "#364fc7",
    skyBottom: "#5c7cfa",
    pipe: "#9775fa",
    pipeDark: "#7950f2",
    pipeStroke: "#5f3dc4",
    ground: "#495057",
    grass: "#748ffc",
    dirt: "#343a40"
  },
  gold: {
    label: "Gold",
    body: "#ffd43b",
    wing: "#fab005",
    beak: "#fd7e14",
    eye: "#fff",
    pupil: "#111",
    skyTop: "#ffe066",
    skyBottom: "#ffec99",
    pipe: "#fcc419",
    pipeDark: "#f59f00",
    pipeStroke: "#e67700",
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

    ctx.fillStyle = s.pipe;
    ctx.fillRect(pipe.x, 0, PIPE_WIDTH, pipe.top);
    ctx.fillRect(pipe.x, bottomY, PIPE_WIDTH, bottomH);

    ctx.fillStyle = s.pipeDark;
    ctx.fillRect(pipe.x - 6, pipe.top - 36, PIPE_WIDTH + 12, 36);
    ctx.fillRect(pipe.x - 6, bottomY, PIPE_WIDTH + 12, 36);

    ctx.strokeStyle = s.pipeStroke;
    ctx.lineWidth = 4;
    ctx.strokeRect(pipe.x, 0, PIPE_WIDTH, pipe.top);
    ctx.strokeRect(pipe.x, bottomY, PIPE_WIDTH, bottomH);
  }
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

function drawBird() {
  const s = skin();
  ctx.save();
  ctx.translate(BIRD_X, bird.y);
  ctx.rotate(bird.rot);

  ctx.fillStyle = s.body;
  ctx.beginPath();
  ctx.arc(0, 0, BIRD_R, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = s.eye;
  ctx.beginPath();
  ctx.arc(9, -8, 9, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = s.pupil;
  ctx.beginPath();
  ctx.arc(12, -8, 4, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = s.beak;
  ctx.beginPath();
  ctx.moveTo(BIRD_R - 3, 3);
  ctx.lineTo(BIRD_R + 15, 9);
  ctx.lineTo(BIRD_R - 3, 15);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = s.wing;
  ctx.beginPath();
  ctx.ellipse(-12, 6, 15, 9, -0.3, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
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
  "Flappy Bird",
  "Tap, click, or press Space to flap. Fly through the gaps and don't hit the pipes."
);
