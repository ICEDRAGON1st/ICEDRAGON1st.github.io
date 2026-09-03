const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const scoreEl = document.getElementById("score");
const highScoreEl = document.getElementById("high-score");
const livesEl = document.getElementById("lives");
const diffLabelEl = document.getElementById("diff-label");
const overlay = document.getElementById("overlay");
const overlayTitle = document.getElementById("overlay-title");
const overlayText = document.getElementById("overlay-text");
const startBtn = document.getElementById("start-btn");
const resumeBtn = document.getElementById("resume-btn");
const gamesBtn = document.getElementById("games-btn");
const menuBtn = document.getElementById("menu-btn");
const difficultyPicker = document.getElementById("difficulty-picker");

const W = canvas.width;
const H = canvas.height;
const DIFF_KEY = "space-shooter-difficulty";

const DIFFICULTY = {
  easy: {
    label: "Easy",
    lives: 5,
    fireCooldown: 0.14,
    bulletSpeed: -560,
    powerupChance: 0.12,
    invuln: 1.8,
    timeScale: 90,
    scoreScale: 900,
    maxDiff: 2.2,
    meteorVx: 40,
    meteorVxScale: 25,
    meteorVy: 55,
    meteorVyRand: 80,
    meteorVyScale: 30,
    enemyVx: 50,
    enemyVxRand: 55,
    enemyVxScale: 25,
    enemyVy: 25,
    enemyVyRand: 35,
    enemyVyScale: 18,
    enemyHpEarly: 1,
    enemyHpLate: 2,
    enemyHpAt: 1.8,
    enemyChanceBase: 0.18,
    enemyChanceScale: 0.05,
    enemyChanceMax: 0.35,
    extraMeteorScale: 0.55,
    extraMeteorChance: 0.55,
    bonusEnemyAt: 1.6,
    bonusEnemyChance: 0.12,
    bonusEnemyScale: 0.04,
    spawnMin: 0.55,
    spawnBase: 1.55,
    spawnScale: 0.18,
    shootMin: 0.55,
    shootBase: 1.55,
    shootScale: 0.14,
    enemyBullet: 180,
    enemyBulletRand: 60,
    enemyBulletScale: 35
  },
  medium: {
    label: "Medium",
    lives: 3,
    fireCooldown: 0.18,
    bulletSpeed: -520,
    powerupChance: 0.05,
    invuln: 1.4,
    timeScale: 50,
    scoreScale: 400,
    maxDiff: 4,
    meteorVx: 60,
    meteorVxScale: 40,
    meteorVy: 80,
    meteorVyRand: 120,
    meteorVyScale: 55,
    enemyVx: 70,
    enemyVxRand: 80,
    enemyVxScale: 45,
    enemyVy: 40,
    enemyVyRand: 50,
    enemyVyScale: 30,
    enemyHpEarly: 2,
    enemyHpLate: 3,
    enemyHpAt: 2.5,
    enemyChanceBase: 0.22,
    enemyChanceScale: 0.06,
    enemyChanceMax: 0.45,
    extraMeteorBase: 1,
    extraMeteorScale: 0.8,
    extraMeteorChance: 0.75,
    extraMeteorChanceScale: 0.05,
    bonusEnemyAt: 1.5,
    bonusEnemyChance: 0.2,
    bonusEnemyScale: 0.06,
    spawnMin: 0.28,
    spawnBase: 1.2,
    spawnScale: 0.24,
    shootMin: 0.28,
    shootBase: 1.2,
    shootScale: 0.22,
    enemyBullet: 240,
    enemyBulletRand: 80,
    enemyBulletScale: 70
  },
  hardcore: {
    label: "Hardcore",
    lives: 1,
    fireCooldown: 0.2,
    bulletSpeed: -500,
    powerupChance: 0.03,
    invuln: 0.9,
    timeScale: 35,
    scoreScale: 250,
    maxDiff: 5,
    meteorVx: 80,
    meteorVxScale: 55,
    meteorVy: 110,
    meteorVyRand: 140,
    meteorVyScale: 75,
    enemyVx: 90,
    enemyVxRand: 100,
    enemyVxScale: 60,
    enemyVy: 55,
    enemyVyRand: 65,
    enemyVyScale: 40,
    enemyHpEarly: 2,
    enemyHpLate: 4,
    enemyHpAt: 1.5,
    enemyChanceBase: 0.35,
    enemyChanceScale: 0.08,
    enemyChanceMax: 0.7,
    extraMeteorBase: 2,
    extraMeteorScale: 1.1,
    extraMeteorChance: 0.85,
    extraMeteorChanceScale: 0.05,
    bonusEnemyAt: 0.8,
    bonusEnemyChance: 0.3,
    bonusEnemyScale: 0.08,
    spawnMin: 0.18,
    spawnBase: 0.95,
    spawnScale: 0.2,
    shootMin: 0.18,
    shootBase: 0.9,
    shootScale: 0.18,
    enemyBullet: 300,
    enemyBulletRand: 100,
    enemyBulletScale: 90
  }
};

function loadSavedDifficulty() {
  const saved = localStorage.getItem(DIFF_KEY);
  return DIFFICULTY[saved] ? saved : "easy";
}

let difficultyMode = loadSavedDifficulty();

function cfg() {
  return DIFFICULTY[difficultyMode];
}

function highScoreKey() {
  return `space-shooter-high-score-${difficultyMode}`;
}

function migrateLegacyHighScore() {
  try {
    const legacy = Number(localStorage.getItem("space-shooter-high-score"));
    if (!Number.isFinite(legacy) || legacy <= 0) return;
    const easyKey = "space-shooter-high-score-easy";
    if (!localStorage.getItem(easyKey)) {
      localStorage.setItem(easyKey, String(Math.floor(legacy)));
    }
  } catch {
    /* ignore */
  }
}

migrateLegacyHighScore();

const keys = {
  left: false,
  right: false,
  up: false,
  down: false,
  shoot: false
};

let running = false;
let paused = false;
let menuMode = "start";
let lastTime = 0;
let score = 0;
let highScore = 0;
let lives = cfg().lives;
let gameTime = 0;
let spawnTimer = 0;
let enemyShootTimer = 0;
let invuln = 0;
let pointerActive = false;
let pointerX = W / 2;
let pointerY = H - 70;

const player = {
  x: W / 2,
  y: H - 70,
  w: 28,
  h: 34,
  speed: 580,
  cooldown: 0
};

let bullets = [];
let enemyBullets = [];
let meteors = [];
let enemies = [];
let stars = [];
let particles = [];
let powerups = [];
let dualShotTimer = 0;

function resetStars() {
  stars = Array.from({ length: 60 }, () => ({
    x: Math.random() * W,
    y: Math.random() * H,
    s: Math.random() * 2 + 0.5,
    v: Math.random() * 40 + 20
  }));
}

function resetGame() {
  score = 0;
  lives = cfg().lives;
  gameTime = 0;
  spawnTimer = 0;
  enemyShootTimer = 0;
  invuln = 0;
  bullets = [];
  enemyBullets = [];
  meteors = [];
  enemies = [];
  particles = [];
  powerups = [];
  dualShotTimer = 0;
  player.x = W / 2;
  player.y = H - 70;
  player.cooldown = 0;
  updateHud();
  resetStars();
}

function loadHighScore() {
  try {
    const saved = Number(localStorage.getItem(highScoreKey()));
    return Number.isFinite(saved) && saved > 0 ? Math.floor(saved) : 0;
  } catch {
    return 0;
  }
}

function saveHighScore() {
  localStorage.setItem(highScoreKey(), String(highScore));
}

function maybeUpdateHighScore() {
  if (score > highScore) {
    highScore = score;
    saveHighScore();
    return true;
  }
  return false;
}

function syncDifficultyButtons() {
  document.querySelectorAll(".diff-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.diff === difficultyMode);
  });
}

function setDifficulty(mode) {
  if (!DIFFICULTY[mode]) return;
  const changed = mode !== difficultyMode;
  difficultyMode = mode;
  localStorage.setItem(DIFF_KEY, mode);
  highScore = loadHighScore();
  syncDifficultyButtons();
  updateHud();

  // Mid-run switch needs a fresh game so lives / spawn rates match.
  if (changed && menuMode === "pause") {
    startGame();
    return;
  }

  if (menuMode === "pause") {
    overlayText.textContent = `${cfg().label} · High score: ${highScore}. Resume, restart, or go back to Games.`;
  } else if (menuMode === "start" || menuMode === "gameover") {
    overlayText.textContent = `${cfg().label} · High score: ${highScore}. Pick a difficulty, then move with mouse or WASD.`;
  }
}

function updateHud() {
  scoreEl.textContent = String(score);
  highScoreEl.textContent = String(highScore);
  livesEl.textContent = String(lives);
  if (diffLabelEl) diffLabelEl.textContent = cfg().label;
}

function clearMovementKeys() {
  keys.left = false;
  keys.right = false;
  keys.up = false;
  keys.down = false;
  keys.shoot = false;
}

function showMenu(mode, title, text) {
  menuMode = mode;
  paused = mode === "pause";
  running = false;
  clearMovementKeys();

  overlayTitle.textContent = title;
  overlayText.textContent = text;

  difficultyPicker.classList.remove("hidden");
  syncDifficultyButtons();

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
    `${cfg().label} · High score: ${highScore}. Resume, restart, or go back to Games.`
  );
}

function resumeGame() {
  if (menuMode !== "pause") return;
  overlay.classList.add("hidden");
  paused = false;
  running = true;
  lastTime = performance.now();
  requestAnimationFrame(loop);
}

function startGame() {
  if (window.HubStreak) HubStreak.recordPlay();
  if (window.HubPlays) HubPlays.record("space");
  resetGame();
  overlay.classList.add("hidden");
  paused = false;
  menuMode = "playing";
  running = true;
  lastTime = performance.now();
  requestAnimationFrame(loop);
}

function goToGames() {
  window.location.href = "../index.html#games";
}

function spawnBurst(x, y, color) {
  for (let i = 0; i < 10; i++) {
    particles.push({
      x,
      y,
      vx: (Math.random() - 0.5) * 180,
      vy: (Math.random() - 0.5) * 180,
      life: 0.4 + Math.random() * 0.35,
      color
    });
  }
}

function getDifficulty() {
  const c = cfg();
  const fromTime = gameTime / c.timeScale;
  const fromScore = score / c.scoreScale;
  return Math.min(c.maxDiff, fromTime + fromScore);
}

function spawnMeteor() {
  const d = getDifficulty();
  const c = cfg();
  const r = 14 + Math.random() * 16;
  meteors.push({
    x: r + Math.random() * (W - r * 2),
    y: -r - 10,
    r,
    vx: (Math.random() - 0.5) * (c.meteorVx + d * c.meteorVxScale),
    vy: c.meteorVy + Math.random() * c.meteorVyRand + d * c.meteorVyScale,
    spin: Math.random() * Math.PI * 2,
    spinSpeed: (Math.random() - 0.5) * (2 + d * 0.5)
  });
}

function spawnEnemy() {
  const d = getDifficulty();
  const c = cfg();
  enemies.push({
    x: 40 + Math.random() * (W - 80),
    y: -40,
    w: 30,
    h: 26,
    vx: (Math.random() < 0.5 ? -1 : 1) * (c.enemyVx + Math.random() * c.enemyVxRand + d * c.enemyVxScale),
    vy: c.enemyVy + Math.random() * c.enemyVyRand + d * c.enemyVyScale,
    hp: d >= c.enemyHpAt ? c.enemyHpLate : c.enemyHpEarly
  });
}

function spawnPowerup(x, y) {
  powerups.push({
    x,
    y,
    r: 11,
    vy: 90
  });
}

function shootPlayer() {
  if (player.cooldown > 0) return;
  const c = cfg();
  player.cooldown = c.fireCooldown;
  const y = player.y - player.h / 2;
  const vy = c.bulletSpeed;
  if (dualShotTimer > 0) {
    bullets.push({ x: player.x - 8, y, vy, r: 3 });
    bullets.push({ x: player.x + 8, y, vy, r: 3 });
  } else {
    bullets.push({ x: player.x, y, vy, r: 3 });
  }
  window.HubSound?.play("shoot");
}

function hitPlayer() {
  if (invuln > 0) return;
  lives -= 1;
  invuln = cfg().invuln;
  spawnBurst(player.x, player.y, "#ff5c7a");
  updateHud();
  window.HubSound?.play(lives <= 0 ? "lose" : "hit");
  if (lives <= 0) {
    const isNewHigh = maybeUpdateHighScore();
    if (isNewHigh) window.HubConfetti?.burst();
    const highText = isNewHigh
      ? `New high score: ${highScore}!`
      : `High score: ${highScore}.`;
    showMenu(
      "gameover",
      "Game Over",
      `You scored ${score} on ${cfg().label}. ${highText}`
    );
  }
}

function rectCircle(rx, ry, rw, rh, cx, cy, cr) {
  const nx = Math.max(rx - rw / 2, Math.min(cx, rx + rw / 2));
  const ny = Math.max(ry - rh / 2, Math.min(cy, ry + rh / 2));
  const dx = cx - nx;
  const dy = cy - ny;
  return dx * dx + dy * dy < cr * cr;
}

function rects(ax, ay, aw, ah, bx, by, bw, bh) {
  return (
    Math.abs(ax - bx) < (aw + bw) / 2 &&
    Math.abs(ay - by) < (ah + bh) / 2
  );
}

function getCanvasPos(event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) / rect.width) * W,
    y: ((event.clientY - rect.top) / rect.height) * H
  };
}

function updatePointer(event) {
  const pos = getCanvasPos(event);
  pointerX = pos.x;
  pointerY = pos.y;
  pointerActive = true;
}

function update(dt) {
  gameTime += dt;
  const difficulty = getDifficulty();

  if (invuln > 0) invuln -= dt;
  if (player.cooldown > 0) player.cooldown -= dt;
  if (dualShotTimer > 0) dualShotTimer -= dt;

  if (pointerActive) {
    const dx = pointerX - player.x;
    const dy = pointerY - player.y;
    const dist = Math.hypot(dx, dy);
    if (dist > 1) {
      const step = Math.min(dist, player.speed * 1.6 * dt);
      player.x += (dx / dist) * step;
      player.y += (dy / dist) * step;
    }
  } else {
    let dx = 0;
    let dy = 0;
    if (keys.left) dx -= 1;
    if (keys.right) dx += 1;
    if (keys.up) dy -= 1;
    if (keys.down) dy += 1;
    if (dx || dy) {
      const len = Math.hypot(dx, dy) || 1;
      player.x += (dx / len) * player.speed * dt;
      player.y += (dy / len) * player.speed * dt;
    }
  }

  player.x = Math.max(player.w / 2, Math.min(W - player.w / 2, player.x));
  player.y = Math.max(player.h / 2 + 20, Math.min(H - player.h / 2 - 8, player.y));

  if (keys.shoot) shootPlayer();

  for (const s of stars) {
    s.y += s.v * dt;
    if (s.y > H) {
      s.y = 0;
      s.x = Math.random() * W;
    }
  }

  const c = cfg();

  spawnTimer -= dt;
  if (spawnTimer <= 0) {
    const enemyChance = Math.min(
      c.enemyChanceMax,
      c.enemyChanceBase + difficulty * c.enemyChanceScale
    );
    if (Math.random() < enemyChance) spawnEnemy();
    else spawnMeteor();

    const extraMeteors = Math.floor(
      (c.extraMeteorBase || 0) + difficulty * c.extraMeteorScale
    );
    const extraChance =
      c.extraMeteorChance + difficulty * (c.extraMeteorChanceScale || 0);
    for (let i = 0; i < extraMeteors; i++) {
      if (Math.random() < extraChance) spawnMeteor();
    }

    if (
      difficulty > c.bonusEnemyAt &&
      Math.random() < c.bonusEnemyChance + difficulty * c.bonusEnemyScale
    ) {
      spawnEnemy();
    }

    spawnTimer = Math.max(c.spawnMin, c.spawnBase - difficulty * c.spawnScale);
  }

  enemyShootTimer -= dt;
  if (enemyShootTimer <= 0 && enemies.length) {
    const e = enemies[Math.floor(Math.random() * enemies.length)];
    enemyBullets.push({
      x: e.x,
      y: e.y + e.h / 2,
      vy: c.enemyBullet + Math.random() * c.enemyBulletRand + difficulty * c.enemyBulletScale,
      r: 3.5
    });
    enemyShootTimer = Math.max(c.shootMin, c.shootBase - difficulty * c.shootScale);
  }

  bullets = bullets.filter((b) => {
    b.y += b.vy * dt;
    return b.y > -20;
  });

  enemyBullets = enemyBullets.filter((b) => {
    b.y += b.vy * dt;
    return b.y < H + 20;
  });

  for (let i = bullets.length - 1; i >= 0; i--) {
    const pb = bullets[i];
    let collided = false;
    for (let j = enemyBullets.length - 1; j >= 0; j--) {
      const eb = enemyBullets[j];
      const dx = pb.x - eb.x;
      const dy = pb.y - eb.y;
      const rr = pb.r + eb.r;
      if (dx * dx + dy * dy <= rr * rr) {
        spawnBurst((pb.x + eb.x) / 2, (pb.y + eb.y) / 2, "#ffffff");
        enemyBullets.splice(j, 1);
        bullets.splice(i, 1);
        collided = true;
        break;
      }
    }
    if (collided) continue;
  }

  for (const m of meteors) {
    m.x += m.vx * dt;
    m.y += m.vy * dt;
    m.spin += m.spinSpeed * dt;
  }
  meteors = meteors.filter((m) => m.y - m.r < H + 40);

  for (const e of enemies) {
    e.x += e.vx * dt;
    e.y += e.vy * dt;
    if (e.x < 20 || e.x > W - 20) e.vx *= -1;
  }
  enemies = enemies.filter((e) => e.y < H + 50);

  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    let hit = false;

    for (let j = meteors.length - 1; j >= 0; j--) {
      const m = meteors[j];
      const dxm = b.x - m.x;
      const dym = b.y - m.y;
      if (dxm * dxm + dym * dym < (m.r + b.r) * (m.r + b.r)) {
        spawnBurst(m.x, m.y, "#c9a66b");
        meteors.splice(j, 1);
        score += 15;
        maybeUpdateHighScore();
        window.HubSound?.play("hit");
        hit = true;
        break;
      }
    }

    if (!hit) {
      for (let j = enemies.length - 1; j >= 0; j--) {
        const e = enemies[j];
        if (rectCircle(e.x, e.y, e.w, e.h, b.x, b.y, b.r)) {
          e.hp -= 1;
          spawnBurst(b.x, b.y, "#6ecbff");
          if (e.hp <= 0) {
            enemies.splice(j, 1);
            score += 35;
            maybeUpdateHighScore();
            spawnBurst(e.x, e.y, "#6ecbff");
            window.HubSound?.play("hit");
            if (Math.random() < cfg().powerupChance) spawnPowerup(e.x, e.y);
          }
          hit = true;
          break;
        }
      }
    }

    if (hit) {
      bullets.splice(i, 1);
      updateHud();
    }
  }

  for (const m of meteors) {
    if (rectCircle(player.x, player.y, player.w, player.h, m.x, m.y, m.r * 0.85)) {
      hitPlayer();
    }
  }

  for (const e of enemies) {
    if (rects(player.x, player.y, player.w, player.h, e.x, e.y, e.w, e.h)) {
      hitPlayer();
    }
  }

  for (let i = enemyBullets.length - 1; i >= 0; i--) {
    const b = enemyBullets[i];
    if (rectCircle(player.x, player.y, player.w, player.h, b.x, b.y, b.r)) {
      enemyBullets.splice(i, 1);
      hitPlayer();
    }
  }

  for (const p of powerups) {
    p.y += p.vy * dt;
  }
  powerups = powerups.filter((p) => p.y - p.r < H + 20);

  for (let i = powerups.length - 1; i >= 0; i--) {
    const p = powerups[i];
    if (rectCircle(player.x, player.y, player.w, player.h, p.x, p.y, p.r)) {
      dualShotTimer = 10;
      spawnBurst(p.x, p.y, "#ffd166");
      powerups.splice(i, 1);
    }
  }

  particles = particles.filter((p) => {
    p.life -= dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    return p.life > 0;
  });
}

function drawShip(x, y, color, flip = false) {
  ctx.save();
  ctx.translate(x, y);
  if (flip) ctx.scale(1, -1);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, -18);
  ctx.lineTo(14, 14);
  ctx.lineTo(0, 8);
  ctx.lineTo(-14, 14);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#9ef0ff";
  ctx.fillRect(-3, -4, 6, 10);
  ctx.restore();
}

function draw() {
  ctx.clearRect(0, 0, W, H);

  ctx.fillStyle = "#050914";
  ctx.fillRect(0, 0, W, H);

  for (const s of stars) {
    ctx.fillStyle = `rgba(220,230,255,${0.35 + s.s * 0.25})`;
    ctx.fillRect(s.x, s.y, s.s, s.s);
  }

  for (const p of particles) {
    ctx.globalAlpha = Math.max(0, p.life * 2);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
    ctx.globalAlpha = 1;
  }

  for (const b of bullets) {
    ctx.fillStyle = "#3ddc97";
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    ctx.fill();
  }

  for (const b of enemyBullets) {
    ctx.fillStyle = "#ff5c7a";
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    ctx.fill();
  }

  for (const m of meteors) {
    ctx.save();
    ctx.translate(m.x, m.y);
    ctx.rotate(m.spin);
    ctx.fillStyle = "#8a6a45";
    ctx.beginPath();
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      const rr = m.r * (0.75 + (i % 2) * 0.25);
      const px = Math.cos(a) * rr;
      const py = Math.sin(a) * rr;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#b0895d";
    ctx.beginPath();
    ctx.arc(-m.r * 0.2, -m.r * 0.15, m.r * 0.25, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  for (const e of enemies) {
    drawShip(e.x, e.y, "#ff6b6b", true);
  }

  for (const p of powerups) {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.fillStyle = "#ffd166";
    ctx.beginPath();
    ctx.moveTo(0, -p.r);
    ctx.lineTo(p.r, 0);
    ctx.lineTo(0, p.r);
    ctx.lineTo(-p.r, 0);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#fff4c2";
    ctx.beginPath();
    ctx.arc(0, 0, p.r * 0.35, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  if (invuln <= 0 || Math.floor(invuln * 12) % 2 === 0) {
    drawShip(player.x, player.y, dualShotTimer > 0 ? "#ffd166" : "#3ddc97", false);
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
  if (code === "ArrowUp" || code === "KeyW") keys.up = pressed;
  if (code === "ArrowDown" || code === "KeyS") keys.down = pressed;
  if (code === "Space") keys.shoot = pressed;
}

window.addEventListener("keydown", (e) => {
  if (e.code === "Escape") {
    e.preventDefault();
    if (menuMode === "pause" && !overlay.classList.contains("hidden")) {
      resumeGame();
    } else if (running) {
      openPauseMenu();
    }
    return;
  }

  if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Space"].includes(e.code)) {
    e.preventDefault();
  }
  if (!running) return;
  setKey(e.code, true);
  if (e.code === "Space") shootPlayer();
});

window.addEventListener("keyup", (e) => {
  setKey(e.code, false);
});

canvas.addEventListener("pointermove", (e) => {
  updatePointer(e);
});

canvas.addEventListener("pointerenter", (e) => {
  updatePointer(e);
});

canvas.addEventListener("pointerleave", () => {
  pointerActive = false;
});

canvas.addEventListener("pointerdown", (e) => {
  updatePointer(e);
  if (running) {
    keys.shoot = true;
    shootPlayer();
  }
});

canvas.addEventListener("pointerup", () => {
  keys.shoot = false;
});

difficultyPicker.addEventListener("click", (e) => {
  const btn = e.target.closest(".diff-btn");
  if (!btn) return;
  setDifficulty(btn.dataset.diff);
});

startBtn.addEventListener("click", () => startGame());
resumeBtn.addEventListener("click", () => resumeGame());
gamesBtn.addEventListener("click", () => goToGames());
menuBtn.addEventListener("click", () => {
  if (running) openPauseMenu();
  else if (menuMode === "pause") resumeGame();
});

highScore = loadHighScore();
syncDifficultyButtons();
resetStars();
updateHud();
draw();
showMenu(
  "start",
  "Space Shooter",
  "Pick a difficulty, then move with mouse or WASD. Shoot with Space or click."
);
