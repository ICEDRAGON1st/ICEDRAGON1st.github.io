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
const COLS = 7;
const CELL = W / COLS;
const ROW_H = 56;
const HIGH_SCORE_KEY = "crossy-high-score";
const CAR_COLORS = ["#ff6b6b", "#ffd43b", "#74c0fc", "#da77f2", "#ff922b"];
const LOG_COLOR = "#8d6e63";

let rows = [];
let player = { col: 3, row: 0 };
let maxRow = 0;
let score = 0;
let highScore = loadHighScore();
let running = false;
let menuMode = "start";
let cameraY = 0;
let hopT = 0;
let hopFrom = null;
let hopTo = null;
let lastTime = 0;
let playedThisRun = false;
let dead = false;
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
  try {
    localStorage.setItem(HIGH_SCORE_KEY, String(highScore));
  } catch {}
}

function updateHud() {
  scoreEl.textContent = String(score);
  highScoreEl.textContent = String(highScore);
}

function rand(a, b) {
  return a + Math.random() * (b - a);
}

function pickRowType(index) {
  if (index === 0) return "grass";
  if (index < 3) return Math.random() < 0.7 ? "grass" : "road";
  const roll = Math.random();
  if (roll < 0.34) return "grass";
  if (roll < 0.72) return "road";
  return "water";
}

function makeRow(index) {
  const type = pickRowType(index);
  const dir = Math.random() < 0.5 ? -1 : 1;
  const speed =
    type === "road"
      ? rand(70, 130) + Math.min(90, index * 2.2)
      : type === "water"
        ? rand(45, 85) + Math.min(60, index * 1.4)
        : 0;
  const objs = [];
  if (type === "road") {
    const count = 2 + Math.floor(Math.random() * 2);
    const gap = W / count;
    for (let i = 0; i < count; i++) {
      objs.push({
        x: i * gap + rand(0, gap * 0.35),
        w: CELL * rand(1.1, 1.7),
        color: CAR_COLORS[Math.floor(Math.random() * CAR_COLORS.length)]
      });
    }
  } else if (type === "water") {
    const count = 2 + Math.floor(Math.random() * 2);
    const gap = W / count;
    for (let i = 0; i < count; i++) {
      objs.push({
        x: i * gap + rand(0, gap * 0.2),
        w: CELL * rand(1.6, 2.4),
        color: LOG_COLOR
      });
    }
  } else if (Math.random() < 0.35) {
    // decorative trees / rocks on grass
    const n = 1 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) {
      objs.push({
        x: rand(8, W - 28),
        w: 18,
        decor: true,
        kind: Math.random() < 0.5 ? "tree" : "rock"
      });
    }
  }
  return { index, type, dir, speed, objs };
}

function ensureRows() {
  while (rows.length < player.row + 14) {
    rows.push(makeRow(rows.length));
  }
}

function resetGame() {
  rows = [];
  for (let i = 0; i < 16; i++) rows.push(makeRow(i));
  // First few rows safer
  rows[0].type = "grass";
  rows[0].objs = [];
  rows[1].type = "grass";
  player = { col: 3, row: 0 };
  maxRow = 0;
  score = 0;
  cameraY = 0;
  hopT = 0;
  hopFrom = null;
  hopTo = null;
  dead = false;
  playedThisRun = false;
  updateHud();
}

function playerWorldY(row = player.row) {
  return H - 120 - row * ROW_H;
}

function isHopping() {
  return hopT > 0;
}

function tryHop(dCol, dRow) {
  if (!running || dead || isHopping()) return;
  const fromCol = Math.round(player.col);
  const nextCol = fromCol + dCol;
  const nextRow = player.row + dRow;
  if (nextCol < 0 || nextCol > COLS - 1) return;
  if (nextRow < 0) return;

  // Block hopping into tree/rock on grass
  const row = rows[nextRow];
  if (row?.type === "grass") {
    const px = nextCol * CELL + CELL / 2;
    const hitDecor = (row.objs || []).some((o) => {
      if (!o.decor) return false;
      return Math.abs(px - (o.x + o.w / 2)) < CELL * 0.42;
    });
    if (hitDecor) {
      window.HubSound?.play?.("miss");
      return;
    }
  }

  hopFrom = { col: player.col, row: player.row };
  hopTo = { col: nextCol, row: nextRow };
  hopT = 1;
  window.HubSound?.play?.("flap");

  if (!playedThisRun) {
    playedThisRun = true;
    window.HubStreak?.recordPlay?.();
    window.HubPlays?.record?.("crossy");
  }
}

function finishHop() {
  player.col = hopTo.col;
  player.row = hopTo.row;
  hopT = 0;
  hopFrom = null;
  hopTo = null;
  if (player.row > maxRow) {
    maxRow = player.row;
    score = maxRow;
    if (score > highScore) {
      highScore = score;
      saveHighScore();
    }
    updateHud();
    checkAchievements();
  }
  ensureRows();
  // Immediate water check after landing (not on log)
  resolveLaneSafety(0);
}

function resolveLaneSafety(dt) {
  const row = rows[player.row];
  if (!row || dead) return;
  const px = player.col * CELL + CELL / 2;
  const py = 0; // relative

  if (row.type === "road") {
    for (const car of row.objs) {
      if (px > car.x + 4 && px < car.x + car.w - 4) {
        die("Squished!");
        return;
      }
    }
  } else if (row.type === "water") {
    let onLog = false;
    for (const log of row.objs) {
      if (px > log.x + 6 && px < log.x + log.w - 6) {
        onLog = true;
        // Ride the log
        const shift = (row.dir * row.speed * dt) / CELL;
        player.col += shift;
        break;
      }
    }
    if (!onLog && !isHopping()) {
      die("Splash!");
      return;
    }
    if (player.col < -0.2 || player.col > COLS - 0.8) {
      die("Swept away!");
    }
  }
}

function die(reason) {
  if (dead) return;
  dead = true;
  running = false;
  if (highScore > 0) window.HubLeaderboard?.submit?.("crossy", highScore);
  checkAchievements();
  window.HubSound?.play?.("lose");
  if (score >= 12) window.HubConfetti?.burst?.();
  showMenu("result", reason, `You reached lane ${score}. Best: ${highScore}.`);
}

function checkAchievements() {
  if (!window.HubAchievements) return;
  if (score >= 5) HubAchievements.unlock("crossy_score_5");
  if (score >= 15) HubAchievements.unlock("crossy_score_15");
  if (score >= 30) HubAchievements.unlock("crossy_score_30");
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
    showMenu(menuMode, overlayTitle.textContent, overlayText.textContent);
    return;
  }
  if (running) {
    running = false;
    showMenu("pause", "Paused", "Resume crossing, restart, or go back to Games.");
  }
}

function startGame() {
  resetGame();
  running = true;
  dead = false;
  menuMode = "play";
  overlay.classList.add("hidden");
  lastTime = performance.now();
  requestAnimationFrame(loop);
}

function resumeGame() {
  if (dead) {
    startGame();
    return;
  }
  running = true;
  menuMode = "play";
  overlay.classList.add("hidden");
  lastTime = performance.now();
  requestAnimationFrame(loop);
}

function update(dt) {
  if (isHopping()) {
    hopT -= dt * 7.5;
    if (hopT <= 0) finishHop();
  }

  rows.forEach((row) => {
    if (row.type !== "road" && row.type !== "water") return;
    row.objs.forEach((o) => {
      if (o.decor) return;
      o.x += row.dir * row.speed * dt;
      if (row.dir > 0 && o.x > W + 40) o.x = -o.w - rand(20, 120);
      if (row.dir < 0 && o.x + o.w < -40) o.x = W + rand(20, 120);
    });
  });

  if (!isHopping()) resolveLaneSafety(dt);

  const focusY = playerWorldY(player.row);
  const desiredCam = Math.max(0, H * 0.62 - focusY);
  cameraY += (desiredCam - cameraY) * Math.min(1, dt * 5);
}

function drawTree(x, y) {
  ctx.fillStyle = "#5d4037";
  ctx.fillRect(x + 6, y + 18, 6, 14);
  ctx.fillStyle = "#2f9e44";
  ctx.beginPath();
  ctx.arc(x + 9, y + 14, 12, 0, Math.PI * 2);
  ctx.fill();
}

function drawRock(x, y) {
  ctx.fillStyle = "#868e96";
  ctx.beginPath();
  ctx.ellipse(x + 10, y + 22, 11, 8, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawCar(o, y, dir) {
  ctx.fillStyle = o.color;
  roundRect(o.x, y + 12, o.w, 28, 6);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  ctx.fillRect(o.x + (dir > 0 ? o.w - 18 : 8), y + 16, 12, 10);
  ctx.fillStyle = "#212529";
  ctx.fillRect(o.x + 6, y + 38, 10, 5);
  ctx.fillRect(o.x + o.w - 16, y + 38, 10, 5);
}

function drawLog(o, y) {
  ctx.fillStyle = o.color;
  roundRect(o.x, y + 16, o.w, 24, 10);
  ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.2)";
  ctx.lineWidth = 2;
  for (let i = 1; i < 3; i++) {
    const lx = o.x + (o.w * i) / 3;
    ctx.beginPath();
    ctx.moveTo(lx, y + 18);
    ctx.lineTo(lx, y + 38);
    ctx.stroke();
  }
}

function roundRect(x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function drawPlayer(x, y) {
  // Chicken-ish blob
  ctx.fillStyle = "#fff3bf";
  ctx.beginPath();
  ctx.ellipse(x, y, 14, 16, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#fcc419";
  ctx.beginPath();
  ctx.moveTo(x + 12, y - 2);
  ctx.lineTo(x + 22, y + 2);
  ctx.lineTo(x + 12, y + 6);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#212529";
  ctx.beginPath();
  ctx.arc(x + 4, y - 4, 2.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#e03131";
  ctx.fillRect(x - 3, y + 14, 3, 8);
  ctx.fillRect(x + 2, y + 14, 3, 8);
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function easeOut(t) {
  return 1 - (1 - t) * (1 - t);
}

function draw() {
  ctx.clearRect(0, 0, W, H);
  ctx.save();
  ctx.translate(0, cameraY);

  const minRow = Math.max(0, Math.floor((cameraY - 40) / ROW_H) - 2);
  const maxDraw = Math.min(rows.length - 1, player.row + 16);

  for (let i = minRow; i <= maxDraw; i++) {
    const row = rows[i];
    const y = playerWorldY(i);
    if (row.type === "grass") {
      ctx.fillStyle = i % 2 === 0 ? "#3b7a46" : "#357040";
      ctx.fillRect(0, y, W, ROW_H);
      (row.objs || []).forEach((o) => {
        if (o.kind === "tree") drawTree(o.x, y + 8);
        else drawRock(o.x, y + 8);
      });
    } else if (row.type === "road") {
      ctx.fillStyle = "#343a40";
      ctx.fillRect(0, y, W, ROW_H);
      ctx.strokeStyle = "rgba(255,255,255,0.35)";
      ctx.setLineDash([10, 12]);
      ctx.beginPath();
      ctx.moveTo(0, y + ROW_H / 2);
      ctx.lineTo(W, y + ROW_H / 2);
      ctx.stroke();
      ctx.setLineDash([]);
      row.objs.forEach((o) => drawCar(o, y, row.dir));
    } else {
      ctx.fillStyle = "#1c7ed6";
      ctx.fillRect(0, y, W, ROW_H);
      ctx.fillStyle = "rgba(255,255,255,0.12)";
      for (let k = 0; k < 5; k++) {
        ctx.fillRect((k * 97 + i * 13) % W, y + 10 + (k % 3) * 12, 28, 3);
      }
      row.objs.forEach((o) => drawLog(o, y));
    }
  }

  // Player position (with hop arc)
  let col = player.col;
  let row = player.row;
  let bob = 0;
  if (isHopping() && hopFrom && hopTo) {
    const t = easeOut(1 - hopT);
    col = lerp(hopFrom.col, hopTo.col, t);
    row = lerp(hopFrom.row, hopTo.row, t);
    bob = Math.sin(t * Math.PI) * 18;
  }
  const px = col * CELL + CELL / 2;
  const py = playerWorldY(row) + ROW_H / 2 - bob;
  drawPlayer(px, py);

  ctx.restore();

  ctx.fillStyle = "rgba(8,16,10,0.55)";
  ctx.fillRect(14, 14, 118, 34);
  ctx.fillStyle = "#d3f9d8";
  ctx.font = "700 16px Segoe UI, sans-serif";
  ctx.fillText(`Lane ${score}`, 26, 36);
}

function loop(now) {
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

canvas.addEventListener("pointerdown", (e) => {
  if (!overlay.classList.contains("hidden")) return;
  touchStart = { x: e.clientX, y: e.clientY, t: Date.now() };
});
canvas.addEventListener("pointerup", (e) => {
  if (!touchStart || !running || !overlay.classList.contains("hidden")) {
    touchStart = null;
    return;
  }
  const dx = e.clientX - touchStart.x;
  const dy = e.clientY - touchStart.y;
  touchStart = null;
  if (Math.abs(dx) > 28 || Math.abs(dy) > 28) {
    if (Math.abs(dx) > Math.abs(dy)) tryHop(dx > 0 ? 1 : -1, 0);
    else if (dy < 0) tryHop(0, 1);
    else tryHop(0, -1);
  } else {
    tryHop(0, 1);
  }
});

window.addEventListener("keydown", (e) => {
  if (e.code === "Escape") {
    e.preventDefault();
    openMenu();
    return;
  }
  if (!overlay.classList.contains("hidden")) {
    if (e.code === "Space" || e.code === "Enter") {
      e.preventDefault();
      if (menuMode === "pause") resumeGame();
      else startGame();
    }
    return;
  }
  if (!running) return;
  if (e.code === "ArrowUp" || e.code === "KeyW" || e.code === "Space") {
    e.preventDefault();
    tryHop(0, 1);
  } else if (e.code === "ArrowDown" || e.code === "KeyS") {
    e.preventDefault();
    tryHop(0, -1);
  } else if (e.code === "ArrowLeft" || e.code === "KeyA") {
    e.preventDefault();
    tryHop(-1, 0);
  } else if (e.code === "ArrowRight" || e.code === "KeyD") {
    e.preventDefault();
    tryHop(1, 0);
  }
});

updateHud();
resetGame();
draw();
showMenu(
  "start",
  "Cross Walk",
  "Hop across roads and rivers. Tap / ↑ to hop forward, ← → or swipe to move sideways. Don't get hit or splash!"
);
