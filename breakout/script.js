const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const scoreEl = document.getElementById("score");
const highScoreEl = document.getElementById("high-score");
const livesEl = document.getElementById("lives");
const overlay = document.getElementById("overlay");
const overlayTitle = document.getElementById("overlay-title");
const overlayText = document.getElementById("overlay-text");
const startBtn = document.getElementById("start-btn");
const resumeBtn = document.getElementById("resume-btn");
const gamesBtn = document.getElementById("games-btn");
const menuBtn = document.getElementById("menu-btn");

const W = canvas.width;
const H = canvas.height;
const HIGH_SCORE_KEY = "brick-breaker-high-score";

const BRICK_COLORS = ["#fc8181", "#f6ad55", "#f6e05e", "#68d391", "#63b3ed", "#b794f4"];

const keys = { left: false, right: false };
let running = false;
let menuMode = "start";
let lastTime = 0;
let score = 0;
let highScore = loadHighScore();
let lives = 3;
let bricks = [];
let particles = [];
let waitingToServe = true;
let pointerActive = false;
let pointerX = W / 2;

const paddle = {
  w: 120,
  h: 16,
  x: W / 2,
  y: H - 36,
  speed: 620
};

const ball = {
  x: W / 2,
  y: H - 60,
  r: 8,
  vx: 0,
  vy: 0,
  speed: 420
};

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

function maybeUpdateHighScore() {
  if (score > highScore) {
    highScore = score;
    saveHighScore();
    return true;
  }
  return false;
}

function updateHud() {
  scoreEl.textContent = String(score);
  highScoreEl.textContent = String(highScore);
  livesEl.textContent = String(lives);
}

function clearKeys() {
  keys.left = false;
  keys.right = false;
}

function buildBricks() {
  bricks = [];
  const rows = 6;
  const cols = 12;
  const gap = 6;
  const top = 70;
  const side = 28;
  const bw = (W - side * 2 - gap * (cols - 1)) / cols;
  const bh = 22;

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      bricks.push({
        x: side + col * (bw + gap),
        y: top + row * (bh + gap),
        w: bw,
        h: bh,
        color: BRICK_COLORS[row % BRICK_COLORS.length],
        points: (rows - row) * 10,
        alive: true
      });
    }
  }
}

function resetBall() {
  waitingToServe = true;
  ball.x = paddle.x;
  ball.y = paddle.y - paddle.h / 2 - ball.r - 2;
  ball.vx = 0;
  ball.vy = 0;
}

function serveBall() {
  if (!waitingToServe) return;
  waitingToServe = false;
  const angle = (-Math.PI / 2) + (Math.random() * 0.7 - 0.35);
  ball.vx = Math.cos(angle) * ball.speed;
  ball.vy = Math.sin(angle) * ball.speed;
}

function resetGame() {
  score = 0;
  lives = 3;
  particles = [];
  paddle.x = W / 2;
  paddle.w = 120;
  ball.speed = 420;
  buildBricks();
  resetBall();
  updateHud();
}

function spawnBurst(x, y, color) {
  for (let i = 0; i < 8; i++) {
    particles.push({
      x,
      y,
      vx: (Math.random() - 0.5) * 220,
      vy: (Math.random() - 0.5) * 220,
      life: 0.35 + Math.random() * 0.3,
      color
    });
  }
}

function showMenu(mode, title, text) {
  menuMode = mode;
  running = false;
  clearKeys();

  overlayTitle.textContent = title;
  overlayText.textContent = text;

  if (mode === "start") {
    resumeBtn.classList.add("hidden");
    startBtn.textContent = "Start";
  } else if (mode === "pause") {
    resumeBtn.classList.remove("hidden");
    startBtn.textContent = "Restart";
  } else {
    resumeBtn.classList.add("hidden");
    startBtn.textContent = "Restart";
  }

  overlay.classList.remove("hidden");
}

function openPauseMenu() {
  if (!running) return;
  draw();
  showMenu(
    "pause",
    "Menu",
    `Score ${score} · High ${highScore}. Resume, restart, or go back to Games.`
  );
}

function resumeGame() {
  if (menuMode !== "pause") return;
  overlay.classList.add("hidden");
  menuMode = "playing";
  running = true;
  lastTime = performance.now();
  requestAnimationFrame(loop);
}

function startGame() {
  if (window.HubStreak) HubStreak.recordPlay();
  resetGame();
  overlay.classList.add("hidden");
  menuMode = "playing";
  running = true;
  lastTime = performance.now();
  requestAnimationFrame(loop);
}

function goToGames() {
  window.location.href = "../index.html#games";
}

function loseLife() {
  lives -= 1;
  updateHud();
  spawnBurst(ball.x, H - 10, "#fc8181");
  window.HubSound?.play(lives <= 0 ? "lose" : "error");
  if (lives <= 0) {
    const isNew = maybeUpdateHighScore();
    showMenu(
      "gameover",
      "Game Over",
      `You scored ${score}. ${isNew ? `New high score: ${highScore}!` : `High score: ${highScore}.`}`
    );
    return;
  }
  resetBall();
}

function nextLevel() {
  ball.speed = Math.min(560, ball.speed + 30);
  paddle.w = Math.max(80, paddle.w - 8);
  buildBricks();
  resetBall();
}

function getCanvasPos(event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) / rect.width) * W,
    y: ((event.clientY - rect.top) / rect.height) * H
  };
}

function circleRect(cx, cy, cr, rx, ry, rw, rh) {
  const nx = Math.max(rx, Math.min(cx, rx + rw));
  const ny = Math.max(ry, Math.min(cy, ry + rh));
  const dx = cx - nx;
  const dy = cy - ny;
  return dx * dx + dy * dy <= cr * cr;
}

function update(dt) {
  if (pointerActive) {
    paddle.x += (pointerX - paddle.x) * Math.min(1, dt * 18);
  } else {
    let dx = 0;
    if (keys.left) dx -= 1;
    if (keys.right) dx += 1;
    paddle.x += dx * paddle.speed * dt;
  }

  paddle.x = Math.max(paddle.w / 2, Math.min(W - paddle.w / 2, paddle.x));

  if (waitingToServe) {
    ball.x = paddle.x;
    ball.y = paddle.y - paddle.h / 2 - ball.r - 2;
  } else {
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;

    if (ball.x - ball.r <= 0) {
      ball.x = ball.r;
      ball.vx = Math.abs(ball.vx);
    } else if (ball.x + ball.r >= W) {
      ball.x = W - ball.r;
      ball.vx = -Math.abs(ball.vx);
    }

    if (ball.y - ball.r <= 0) {
      ball.y = ball.r;
      ball.vy = Math.abs(ball.vy);
    }

    if (ball.y - ball.r > H) {
      loseLife();
      return;
    }

    const px = paddle.x - paddle.w / 2;
    const py = paddle.y - paddle.h / 2;
    if (ball.vy > 0 && circleRect(ball.x, ball.y, ball.r, px, py, paddle.w, paddle.h)) {
      ball.y = py - ball.r;
      const hit = (ball.x - paddle.x) / (paddle.w / 2);
      const angle = (-Math.PI / 2) + hit * 1.05;
      const speed = Math.hypot(ball.vx, ball.vy) || ball.speed;
      ball.vx = Math.cos(angle) * speed;
      ball.vy = Math.sin(angle) * speed;
      if (ball.vy > -120) ball.vy = -120;
    }

    for (const brick of bricks) {
      if (!brick.alive) continue;
      if (!circleRect(ball.x, ball.y, ball.r, brick.x, brick.y, brick.w, brick.h)) continue;

      brick.alive = false;
      score += brick.points;
      maybeUpdateHighScore();
      updateHud();
      spawnBurst(brick.x + brick.w / 2, brick.y + brick.h / 2, brick.color);
      window.HubSound?.play("hit");

      const overlapLeft = ball.x + ball.r - brick.x;
      const overlapRight = brick.x + brick.w - (ball.x - ball.r);
      const overlapTop = ball.y + ball.r - brick.y;
      const overlapBottom = brick.y + brick.h - (ball.y - ball.r);
      const minOverlapX = Math.min(overlapLeft, overlapRight);
      const minOverlapY = Math.min(overlapTop, overlapBottom);

      if (minOverlapX < minOverlapY) {
        ball.vx *= -1;
        ball.x += overlapLeft < overlapRight ? -minOverlapX : minOverlapX;
      } else {
        ball.vy *= -1;
        ball.y += overlapTop < overlapBottom ? -minOverlapY : minOverlapY;
      }
      break;
    }

    if (bricks.every((b) => !b.alive)) {
      window.HubSound?.play("clear");
      score += 100;
      maybeUpdateHighScore();
      updateHud();
      nextLevel();
    }
  }

  particles = particles.filter((p) => {
    p.life -= dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    return p.life > 0;
  });
}

function draw() {
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = "#070d18";
  ctx.fillRect(0, 0, W, H);

  for (let i = 0; i < 40; i++) {
    const x = ((i * 97) % W);
    const y = ((i * 53) % H);
    ctx.fillStyle = "rgba(180,200,255,0.08)";
    ctx.fillRect(x, y, 2, 2);
  }

  for (const brick of bricks) {
    if (!brick.alive) continue;
    ctx.fillStyle = brick.color;
    ctx.beginPath();
    ctx.roundRect(brick.x, brick.y, brick.w, brick.h, 4);
    ctx.fill();
  }

  for (const p of particles) {
    ctx.globalAlpha = Math.max(0, p.life * 2.2);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
    ctx.globalAlpha = 1;
  }

  ctx.fillStyle = "#f6ad55";
  ctx.beginPath();
  ctx.roundRect(paddle.x - paddle.w / 2, paddle.y - paddle.h / 2, paddle.w, paddle.h, 8);
  ctx.fill();

  ctx.fillStyle = "#f7fafc";
  ctx.beginPath();
  ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
  ctx.fill();

  if (waitingToServe && running) {
    ctx.fillStyle = "rgba(234,240,255,0.75)";
    ctx.font = "600 18px Segoe UI, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Click or press Space to launch", W / 2, H - 70);
  }
}

function loop(now) {
  if (!running) return;
  const dt = Math.min(0.033, (now - lastTime) / 1000);
  lastTime = now;
  update(dt);
  draw();
  if (running) requestAnimationFrame(loop);
}

function setKey(code, pressed) {
  if (code === "ArrowLeft" || code === "KeyA") keys.left = pressed;
  if (code === "ArrowRight" || code === "KeyD") keys.right = pressed;
}

window.addEventListener("keydown", (e) => {
  if (e.code === "Escape") {
    e.preventDefault();
    if (menuMode === "pause" && !overlay.classList.contains("hidden")) resumeGame();
    else if (running) openPauseMenu();
    return;
  }

  if (["ArrowLeft", "ArrowRight", "Space", "KeyA", "KeyD"].includes(e.code)) {
    e.preventDefault();
  }
  if (!running) return;
  setKey(e.code, true);
  if (e.code === "Space") serveBall();
});

window.addEventListener("keyup", (e) => {
  setKey(e.code, false);
});

canvas.addEventListener("pointermove", (e) => {
  const pos = getCanvasPos(e);
  pointerX = pos.x;
  pointerActive = true;
});

canvas.addEventListener("pointerleave", () => {
  pointerActive = false;
});

canvas.addEventListener("pointerdown", (e) => {
  const pos = getCanvasPos(e);
  pointerX = pos.x;
  pointerActive = true;
  if (running) serveBall();
});

startBtn.addEventListener("click", () => startGame());
resumeBtn.addEventListener("click", () => resumeGame());
gamesBtn.addEventListener("click", () => goToGames());
menuBtn.addEventListener("click", () => {
  if (running) openPauseMenu();
  else if (menuMode === "pause") resumeGame();
});

if (!CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
    const radius = Math.min(r, w / 2, h / 2);
    this.moveTo(x + radius, y);
    this.arcTo(x + w, y, x + w, y + h, radius);
    this.arcTo(x + w, y + h, x, y + h, radius);
    this.arcTo(x, y + h, x, y, radius);
    this.arcTo(x, y, x + w, y, radius);
    this.closePath();
  };
}

buildBricks();
updateHud();
draw();
showMenu(
  "start",
  "Brick Breaker",
  "Move the paddle with your mouse or A/D / arrows. Bounce the ball to smash every brick."
);
