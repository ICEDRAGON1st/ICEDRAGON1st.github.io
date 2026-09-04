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
const GRID = 20;
const CELL = W / GRID;
const HIGH_SCORE_KEY = "snake-high-score";

const DIRS = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 }
};

const FOOD_COUNT = 4;

let snake = [];
let dir = DIRS.right;
let nextDir = DIRS.right;
let foods = [];
let score = 0;
let highScore = loadHighScore();
let running = false;
let menuMode = "start";
let tickTimer = 0;
let tickInterval = 0.22;
let touchStart = null;

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

function updateHud() {
  scoreEl.textContent = String(score);
  highScoreEl.textContent = String(highScore);
}

function isOccupied(x, y) {
  if (snake.some((s) => s.x === x && s.y === y)) return true;
  if (foods.some((f) => f.x === x && f.y === y)) return true;
  return false;
}

function randomFoodSpot() {
  let spot;
  let tries = 0;
  do {
    spot = {
      x: Math.floor(Math.random() * GRID),
      y: Math.floor(Math.random() * GRID)
    };
    tries += 1;
  } while (isOccupied(spot.x, spot.y) && tries < 400);
  return spot;
}

function spawnFoods(count = FOOD_COUNT) {
  foods = [];
  for (let i = 0; i < count; i++) {
    foods.push(randomFoodSpot());
  }
}

function replaceFoodAt(index) {
  foods[index] = randomFoodSpot();
}

function resetGame() {
  const mid = Math.floor(GRID / 2);
  snake = [
    { x: mid - 1, y: mid },
    { x: mid - 2, y: mid },
    { x: mid - 3, y: mid }
  ];
  dir = DIRS.right;
  nextDir = DIRS.right;
  score = 0;
  tickInterval = 0.22;
  updateHud();
  spawnFoods();
}

function showMenu(mode, title, text) {
  menuMode = mode;
  running = false;

  overlayTitle.textContent = title;
  overlayText.textContent = text;

  if (mode === "pause") {
    resumeBtn.classList.remove("hidden");
    viewBoardBtn?.classList.add("hidden");
    startBtn.textContent = "Restart";
  } else if (mode === "gameover") {
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
  if (menuMode !== "gameover") return;
  overlay.classList.add("hidden");
}

function openPauseMenu() {
  if (!running) return;
  draw();
  showMenu("pause", "Menu", `Score ${score} · High ${highScore}. Resume, restart, or go back to Games.`);
}

function resumeGame() {
  if (menuMode !== "pause") return;
  overlay.classList.add("hidden");
  menuMode = "playing";
  running = true;
  requestAnimationFrame(loop);
}

function startGame() {
  if (window.HubStreak) HubStreak.recordPlay();
  if (window.HubPlays) HubPlays.record("snake");
  resetGame();
  overlay.classList.add("hidden");
  menuMode = "playing";
  running = true;
  tickTimer = 0;
  requestAnimationFrame(loop);
}

function goToGames() {
  window.location.href = "../index.html#games";
}

function setDirection(name) {
  const d = DIRS[name];
  if (!d) return;
  if (d.x === -dir.x && d.y === -dir.y) return;
  nextDir = d;
}

function gameOver() {
  running = false;
  menuMode = "gameover";
  const isNew = score > highScore;
    if (isNew) {
    highScore = score;
    saveHighScore();
    window.HubConfetti?.burst();
  }
  updateHud();
  if (window.HubAchievements) {
    if (score >= 10) HubAchievements.unlock("snake_score_10");
    if (score >= 50) HubAchievements.unlock("snake_score_50");
    if (score >= 100) HubAchievements.unlock("snake_score_100");
  }
  window.HubSound?.play("lose");
  showMenu(
    "gameover",
    "Game Over",
    `You scored ${score}. ${isNew ? `New high score: ${highScore}!` : `High score: ${highScore}.`}`
  );
}

function step() {
  dir = nextDir;
  const head = snake[0];
  const next = { x: head.x + dir.x, y: head.y + dir.y };

  if (next.x < 0 || next.x >= GRID || next.y < 0 || next.y >= GRID) {
    gameOver();
    return;
  }

  if (snake.some((s) => s.x === next.x && s.y === next.y)) {
    gameOver();
    return;
  }

  snake.unshift(next);

  const foodIndex = foods.findIndex((f) => f.x === next.x && f.y === next.y);
  if (foodIndex >= 0) {
    score += 10;
    window.HubSound?.play("eat");
    if (score > highScore) {
      highScore = score;
      saveHighScore();
    }
    tickInterval = Math.max(0.11, 0.22 - score * 0.001);
    updateHud();
    replaceFoodAt(foodIndex);
  } else {
    snake.pop();
  }
}

function drawCell(x, y, color, inset = 2) {
  ctx.fillStyle = color;
  ctx.fillRect(
    x * CELL + inset,
    y * CELL + inset,
    CELL - inset * 2,
    CELL - inset * 2
  );
}

function draw() {
  ctx.fillStyle = "#07140f";
  ctx.fillRect(0, 0, W, H);

  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      if ((x + y) % 2 === 0) {
        ctx.fillStyle = "#0c1a13";
        ctx.fillRect(x * CELL, y * CELL, CELL, CELL);
      }
    }
  }

  for (const food of foods) {
    drawCell(food.x, food.y, "#ff6b6b", 3);
  }

  snake.forEach((seg, i) => {
    drawCell(seg.x, seg.y, i === 0 ? "#7cf0a8" : "#3ddc84", i === 0 ? 1 : 2);
  });
}

let lastTime = 0;

function loop(now) {
  if (!running) return;

  const dt = Math.min(0.05, (now - lastTime) / 1000);
  lastTime = now;
  tickTimer += dt;

  while (tickTimer >= tickInterval) {
    tickTimer -= tickInterval;
    step();
    if (!running) {
      draw();
      return;
    }
  }

  draw();
  requestAnimationFrame(loop);
}

window.addEventListener("keydown", (e) => {
  if (e.code === "Escape") {
    e.preventDefault();
    if (menuMode === "pause" && !overlay.classList.contains("hidden")) resumeGame();
    else if (running) openPauseMenu();
    return;
  }

  const map = {
    ArrowUp: "up",
    ArrowDown: "down",
    ArrowLeft: "left",
    ArrowRight: "right",
    KeyW: "up",
    KeyS: "down",
    KeyA: "left",
    KeyD: "right"
  };

  const name = map[e.code];
  if (!name) return;
  e.preventDefault();
  if (running) setDirection(name);
});

canvas.addEventListener("pointerdown", (e) => {
  touchStart = { x: e.clientX, y: e.clientY };
});

canvas.addEventListener("pointerup", (e) => {
  if (!touchStart || !running) return;
  const dx = e.clientX - touchStart.x;
  const dy = e.clientY - touchStart.y;
  touchStart = null;

  const min = 24;
  if (Math.abs(dx) < min && Math.abs(dy) < min) return;

  if (Math.abs(dx) > Math.abs(dy)) {
    setDirection(dx > 0 ? "right" : "left");
  } else {
    setDirection(dy > 0 ? "down" : "up");
  }
});

menuBtn.addEventListener("click", () => {
  if (menuMode === "gameover") {
    overlay.classList.remove("hidden");
    return;
  }
  if (running) openPauseMenu();
  else if (menuMode === "pause") resumeGame();
  else overlay.classList.remove("hidden");
});

startBtn.addEventListener("click", () => startGame());
resumeBtn.addEventListener("click", () => resumeGame());
viewBoardBtn?.addEventListener("click", () => viewBoard());
gamesBtn.addEventListener("click", () => goToGames());

updateHud();
resetGame();
draw();
showMenu(
  "start",
  "Snake",
  "Use arrow keys or WASD to move. Eat the apples, grow longer, and don't hit the walls or yourself."
);
