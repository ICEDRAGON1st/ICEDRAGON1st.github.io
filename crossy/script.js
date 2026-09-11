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
const CART_COLORS = ["#c92a2a", "#e67700", "#862e9c", "#1864ab", "#2b8a3e"];
const FLOE_COLOR = "#a5d8ff";

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
let animT = 0;
/** Sticky ice ride: { floe, offsetPx } from floe.x to player center */
let ride = null;

function clearRide() {
  ride = null;
}

function startRideOnFloe(floe) {
  if (!floe) {
    clearRide();
    return;
  }
  const px = player.col * CELL + CELL / 2;
  ride = { floe, offsetPx: px - floe.x };
}

function syncRidePosition() {
  if (!ride?.floe) return;
  player.col = (ride.floe.x + ride.offsetPx - CELL / 2) / CELL;
}

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
        color: CART_COLORS[Math.floor(Math.random() * CART_COLORS.length)]
      });
    }
  } else if (type === "water") {
    // Wide floes with only tiny visual seams — no deadly mid-lane gaps
    const count = 2 + Math.floor(Math.random() * 2);
    let x = rand(-CELL * 0.4, CELL * 0.2);
    for (let i = 0; i < count; i++) {
      const remaining = count - i;
      const spanLeft = W + CELL - x;
      const w = Math.max(
        CELL * 2.1,
        Math.min(CELL * 3.4, spanLeft / remaining + rand(-8, 18))
      );
      objs.push({ x, w, color: FLOE_COLOR });
      x += w + rand(0, 6); // seam only — collision pads close this
    }
  } else if (Math.random() < 0.35) {
    const n = 1 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) {
      objs.push({
        x: rand(8, W - 28),
        w: 18,
        decor: true,
        kind: Math.random() < 0.5 ? "crystal" : "mushroom"
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
  clearRide();
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

  const row = rows[nextRow];
  if (row?.type === "grass") {
    const px = nextCol * CELL + CELL / 2;
    const hitDecor = (row.objs || []).some((o) => {
      if (!o.decor) return false;
      return Math.abs(px - (o.x + o.w / 2)) < CELL * 0.32;
    });
    if (hitDecor) {
      window.HubSound?.play?.("miss");
      return;
    }
  }

  // Keep current (possibly fractional) ice position for a smooth hop start
  clearRide();
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
  const row = rows[player.row];
  if (row?.type === "grass" || row?.type === "road") {
    player.col = Math.round(player.col);
    clearRide();
  } else if (row?.type === "water") {
    const px = player.col * CELL + CELL / 2;
    const floe = floeUnderPlayer(px, row.objs || []);
    if (floe) startRideOnFloe(floe);
    else clearRide();
  } else {
    clearRide();
  }
  resolveLaneSafety(0);
}

/** Soft pads + seam bridge so tiny visual gaps aren't deadly. */
function floeUnderPlayer(px, floes) {
  const PAD = 14;
  const sorted = [...floes].filter((o) => !o.decor).sort((a, b) => a.x - b.x);
  // Prefer the floe whose center is nearest (stable when pads overlap)
  let best = null;
  let bestDist = Infinity;
  for (const floe of sorted) {
    if (px < floe.x - PAD || px > floe.x + floe.w + PAD) continue;
    const mid = floe.x + floe.w / 2;
    const d = Math.abs(px - mid);
    if (d < bestDist) {
      bestDist = d;
      best = floe;
    }
  }
  if (best) return best;
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i];
    const b = sorted[i + 1];
    const gapL = a.x + a.w;
    const gapR = b.x;
    if (gapR - gapL <= CELL * 0.85 && px >= gapL - 4 && px <= gapR + 4) {
      return px - gapL < gapR - px ? a : b;
    }
  }
  return null;
}

function resolveLaneSafety(dt) {
  const row = rows[player.row];
  if (!row || dead) return;
  const px = player.col * CELL + CELL / 2;

  if (row.type === "road") {
    clearRide();
    const inset = Math.min(18, CELL * 0.28);
    for (const car of row.objs) {
      if (px > car.x + inset && px < car.x + car.w - inset) {
        die("Crushed by a cart!");
        return;
      }
    }
  } else if (row.type === "water") {
    // Sticky ride: stay glued to one floe — no per-frame reattach jitter
    if (ride?.floe && (row.objs || []).includes(ride.floe)) {
      const on =
        ride.offsetPx >= -14 && ride.offsetPx <= ride.floe.w + 14;
      if (on) {
        syncRidePosition();
      } else {
        clearRide();
      }
    }
    if (!ride?.floe) {
      const floe = floeUnderPlayer(px, row.objs || []);
      if (floe) startRideOnFloe(floe);
      else if (!isHopping()) {
        die("Fell through the ice!");
        return;
      }
    }
    if (player.col < -0.35 || player.col > COLS - 0.65) {
      die("Swept away!");
    }
  } else {
    clearRide();
    player.col = Math.round(player.col);
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
  animT += dt;
  if (isHopping()) {
    hopT -= dt * 7.5;
    if (hopT <= 0) finishHop();
  }

  rows.forEach((row) => {
    if (row.type !== "road" && row.type !== "water") return;
    row.objs.forEach((o) => {
      if (o.decor) return;
      o.x += row.dir * row.speed * dt;
      // Don't wrap the floe you're standing on (avoids teleport glitch → swept away instead)
      if (ride?.floe === o) return;
      if (row.dir > 0 && o.x > W + 40) o.x = -o.w - 40;
      if (row.dir < 0 && o.x + o.w < -40) o.x = W + 40;
    });
  });

  // Glued to floe after floes move (before safety / death checks)
  if (!isHopping() && ride?.floe) syncRidePosition();

  if (!isHopping()) resolveLaneSafety(dt);

  const focusY = playerWorldY(player.row);
  const desiredCam = Math.max(0, H * 0.62 - focusY);
  cameraY += (desiredCam - cameraY) * Math.min(1, dt * 5);
}

function drawCrystal(x, y) {
  ctx.fillStyle = "#74c0fc";
  ctx.beginPath();
  ctx.moveTo(x + 9, y + 4);
  ctx.lineTo(x + 16, y + 22);
  ctx.lineTo(x + 9, y + 30);
  ctx.lineTo(x + 2, y + 22);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.45)";
  ctx.beginPath();
  ctx.moveTo(x + 9, y + 6);
  ctx.lineTo(x + 12, y + 18);
  ctx.lineTo(x + 9, y + 16);
  ctx.fill();
}

function drawMushroom(x, y) {
  ctx.fillStyle = "#f8f0e0";
  ctx.fillRect(x + 7, y + 18, 5, 12);
  ctx.fillStyle = "#e03131";
  ctx.beginPath();
  ctx.ellipse(x + 9.5, y + 16, 11, 8, 0, Math.PI, 0);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(x + 5, y + 14, 2, 0, Math.PI * 2);
  ctx.arc(x + 13, y + 15, 1.6, 0, Math.PI * 2);
  ctx.fill();
}

function drawCart(o, y, dir) {
  // Mine cart body
  ctx.fillStyle = o.color;
  roundRect(o.x + 4, y + 14, o.w - 8, 22, 4);
  ctx.fill();
  ctx.fillStyle = "#343a40";
  ctx.fillRect(o.x, y + 32, o.w, 8);
  // Rails glint on wheels
  ctx.fillStyle = "#212529";
  ctx.beginPath();
  ctx.arc(o.x + 12, y + 40, 5, 0, Math.PI * 2);
  ctx.arc(o.x + o.w - 12, y + 40, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#868e96";
  ctx.beginPath();
  ctx.arc(o.x + 12, y + 40, 2, 0, Math.PI * 2);
  ctx.arc(o.x + o.w - 12, y + 40, 2, 0, Math.PI * 2);
  ctx.fill();
  // Cargo glow
  ctx.fillStyle = "rgba(255, 212, 59, 0.85)";
  ctx.beginPath();
  ctx.arc(o.x + o.w * 0.5, y + 20, 5, 0, Math.PI * 2);
  ctx.fill();
  // Direction lamp
  ctx.fillStyle = "#fff3bf";
  ctx.fillRect(o.x + (dir > 0 ? o.w - 10 : 4), y + 18, 6, 6);
}

function drawFloe(o, y) {
  const g = ctx.createLinearGradient(o.x, y, o.x, y + 40);
  g.addColorStop(0, "#e7f5ff");
  g.addColorStop(0.5, o.color);
  g.addColorStop(1, "#74c0fc");
  ctx.fillStyle = g;
  roundRect(o.x, y + 14, o.w, 26, 12);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.55)";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = "rgba(255,255,255,0.4)";
  ctx.beginPath();
  ctx.ellipse(o.x + o.w * 0.35, y + 22, o.w * 0.18, 4, 0, 0, Math.PI * 2);
  ctx.fill();
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
  // Compact fox hoppers — not a chicken
  ctx.fillStyle = "#f76707";
  ctx.beginPath();
  ctx.ellipse(x, y, 13, 15, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#ffe8cc";
  ctx.beginPath();
  ctx.ellipse(x + 2, y + 4, 7, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  // Ears
  ctx.fillStyle = "#d9480f";
  ctx.beginPath();
  ctx.moveTo(x - 10, y - 8);
  ctx.lineTo(x - 6, y - 20);
  ctx.lineTo(x - 2, y - 8);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x + 2, y - 8);
  ctx.lineTo(x + 8, y - 20);
  ctx.lineTo(x + 12, y - 8);
  ctx.fill();
  ctx.fillStyle = "#ffc9c9";
  ctx.beginPath();
  ctx.moveTo(x - 8, y - 9);
  ctx.lineTo(x - 6, y - 16);
  ctx.lineTo(x - 4, y - 9);
  ctx.fill();
  // Snout + eye
  ctx.fillStyle = "#212529";
  ctx.beginPath();
  ctx.arc(x + 6, y - 2, 2.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(x + 5.4, y - 2.6, 0.8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#212529";
  ctx.beginPath();
  ctx.ellipse(x + 12, y + 4, 4, 2.5, 0.2, 0, Math.PI * 2);
  ctx.fill();
  // Tail fluff
  ctx.fillStyle = "#f76707";
  ctx.beginPath();
  ctx.ellipse(x - 14, y + 6, 8, 5, -0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#fff4e6";
  ctx.beginPath();
  ctx.ellipse(x - 18, y + 5, 3.5, 2.5, -0.4, 0, Math.PI * 2);
  ctx.fill();
  // Legs
  ctx.fillStyle = "#d9480f";
  ctx.fillRect(x - 5, y + 12, 3, 8);
  ctx.fillRect(x + 2, y + 12, 3, 8);
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function easeOut(t) {
  return 1 - (1 - t) * (1 - t);
}

function drawMeadow(y, i, row) {
  ctx.fillStyle = i % 2 === 0 ? "#2b6a4a" : "#245c40";
  ctx.fillRect(0, y, W, ROW_H);
  // Soft glow patches
  ctx.fillStyle = "rgba(100, 200, 150, 0.12)";
  for (let k = 0; k < 3; k++) {
    ctx.beginPath();
    ctx.ellipse((k * 140 + i * 40) % W, y + 28, 40, 10, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  (row.objs || []).forEach((o) => {
    if (o.kind === "crystal") drawCrystal(o.x, y + 8);
    else drawMushroom(o.x, y + 8);
  });
}

function drawLava(y, row) {
  const g = ctx.createLinearGradient(0, y, 0, y + ROW_H);
  g.addColorStop(0, "#7c2d12");
  g.addColorStop(0.45, "#c2410c");
  g.addColorStop(1, "#9a3412");
  ctx.fillStyle = g;
  ctx.fillRect(0, y, W, ROW_H);

  // Magma ripples
  ctx.strokeStyle = `rgba(255, 200, 80, ${0.25 + Math.sin(animT * 3 + y) * 0.1})`;
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 14]);
  ctx.beginPath();
  ctx.moveTo(0, y + ROW_H / 2 + Math.sin(animT * 2) * 2);
  ctx.lineTo(W, y + ROW_H / 2);
  ctx.stroke();
  ctx.setLineDash([]);

  // Ember sparks
  ctx.fillStyle = "rgba(255, 180, 60, 0.55)";
  for (let k = 0; k < 4; k++) {
    const sx = (k * 110 + animT * 40 + y) % W;
    ctx.beginPath();
    ctx.arc(sx, y + 12 + (k % 3) * 12, 2, 0, Math.PI * 2);
    ctx.fill();
  }

  // Track rails under carts
  ctx.strokeStyle = "rgba(40, 20, 10, 0.55)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, y + 42);
  ctx.lineTo(W, y + 42);
  ctx.stroke();

  row.objs.forEach((o) => drawCart(o, y, row.dir));
}

function drawIceRiver(y, i, row) {
  const g = ctx.createLinearGradient(0, y, 0, y + ROW_H);
  g.addColorStop(0, "#1c4d6e");
  g.addColorStop(0.5, "#1864ab");
  g.addColorStop(1, "#0b3d5c");
  ctx.fillStyle = g;
  ctx.fillRect(0, y, W, ROW_H);

  ctx.fillStyle = "rgba(200, 240, 255, 0.12)";
  for (let k = 0; k < 5; k++) {
    ctx.fillRect((k * 97 + i * 13 + animT * 20) % W, y + 10 + (k % 3) * 12, 34, 3);
  }

  row.objs.forEach((o) => drawFloe(o, y));
}

function draw() {
  ctx.clearRect(0, 0, W, H);

  // Night fantasy sky behind lanes
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, "#0b1020");
  sky.addColorStop(1, "#152238");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  ctx.save();
  ctx.translate(0, cameraY);

  const minRow = Math.max(0, Math.floor((cameraY - 40) / ROW_H) - 2);
  const maxDraw = Math.min(rows.length - 1, player.row + 16);

  for (let i = minRow; i <= maxDraw; i++) {
    const row = rows[i];
    const y = playerWorldY(i);
    if (row.type === "grass") drawMeadow(y, i, row);
    else if (row.type === "road") drawLava(y, row);
    else drawIceRiver(y, i, row);
  }

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

  ctx.fillStyle = "rgba(10, 16, 32, 0.65)";
  ctx.fillRect(14, 14, 118, 34);
  ctx.fillStyle = "#d0ebff";
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
  "Hop across lava rails, ice rivers, and crystal meadows. Tap / ↑ forward · ← → sideways. Avoid carts and thin ice!"
);
