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
  ufo: {
    label: "UFO",
    form: "ufo",
    world: "alien",
    locked: true,
    coinItem: "skin:wing-hop-ufo",
    coinCost: 350,
    body: "#7c9cff",
    wing: "#3b5bdb",
    beak: "#69db7c",
    belly: "#212529",
    eye: "#d0ebff",
    pupil: "#0b2948",
    skyTop: "#050814",
    skyBottom: "#1a1040",
    pipe: "#3d4f8c",
    pipeDark: "#24305c",
    pipeStroke: "#9bbcff",
    pipeLight: "#6ea8ff",
    ground: "#1a1528",
    grass: "#2f6fed",
    dirt: "#12101c"
  }
};

// Coin theme packs (Paper, Bee, Neon City, …) from theme-packs.js
Object.assign(SKINS, window.WingHopThemePacks?.skins || {});

/** Fixed star field so the UFO sky doesn't flicker every frame. */
const UFO_STARS = Array.from({ length: 64 }, (_, i) => ({
  x: ((i * 97) % 600) + ((i * 13) % 17),
  y: ((i * 53) % 780) + 8,
  r: 0.6 + (i % 4) * 0.45,
  a: 0.35 + (i % 5) * 0.12
}));

const UFO_COIN_ITEM = "skin:wing-hop-ufo";

function themeApi(extra) {
  return {
    s: skin(),
    bird,
    wingPhase,
    wingBurst,
    BIRD_X,
    W,
    H,
    GROUND_H,
    groundOffset,
    distance,
    ...(extra || {})
  };
}

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

function ownsSkin(id) {
  const s = SKINS[id];
  if (!s) return false;
  if (!s.locked && !s.coinItem) return true;
  const itemId = s.coinItem;
  if (!itemId) return false;
  try {
    if (window.HubCoins?.hasPurchase?.(itemId)) return true;
  } catch {}
  return false;
}

function isCoinSkin(id) {
  const s = SKINS[id];
  return !!(s && (s.locked || s.coinItem));
}

function loadSkin() {
  try {
    const id = localStorage.getItem(SKIN_KEY) || "classic";
    // Old free color themes (sky/gold/…) were removed — fall back to Dragon.
    if (!SKINS[id]) return "classic";
    if (SKINS[id].locked && !ownsSkin(id)) return "classic";
    return id;
  } catch {
    return "classic";
  }
}

function skin() {
  return SKINS[skinId] || SKINS.classic;
}

function setSkinHint(msg) {
  const el = document.getElementById("skin-lock-hint");
  if (el) el.textContent = msg || "";
}

function updateSkinPicker() {
  skinPicker?.querySelectorAll("[data-skin]").forEach((btn) => {
    const id = btn.dataset.skin;
    const s = SKINS[id];
    if (!s) return;
    const locked = isCoinSkin(id) && !ownsSkin(id);
    btn.classList.toggle("active", id === skinId);
    btn.classList.toggle("skin-btn-locked", locked);
    if (isCoinSkin(id)) {
      const short = s.label || id;
      btn.textContent = locked ? `${short} · ${s.coinCost || "?"}🪙` : short;
      btn.title = locked
        ? `Buy with hub coins (${s.coinCost || "?"})`
        : `${short} unlocked`;
    }
  });
  if (hudSkinEl) hudSkinEl.textContent = skin().label;
}

function setSkin(id) {
  if (!SKINS[id]) return false;
  if (!ownsSkin(id)) {
    const s = SKINS[id];
    setSkinHint(
      `${s.label || id} is locked — buy it for ${s.coinCost || "?"} coins in the hub shop, or tap it again to buy here.`
    );
    return false;
  }
  skinId = id;
  try {
    localStorage.setItem(SKIN_KEY, id);
  } catch {}
  setSkinHint(isCoinSkin(id) ? `${SKINS[id].label} equipped.` : "");
  updateSkinPicker();
  draw();
  return true;
}

function tryBuySkin(id) {
  if (ownsSkin(id)) {
    setSkin(id);
    return;
  }
  const s = SKINS[id];
  if (!s?.coinItem) return;
  if (typeof window.HubCoins === "undefined") {
    setSkinHint("Coins aren't loaded — open the hub Coin shop to buy this skin.");
    return;
  }
  const res = HubCoins.buy(s.coinItem);
  if (!res.ok) {
    setSkinHint(res.error || HubCoins.NEED_MORE || "You need more coins for this item!");
    return;
  }
  setSkinHint(`${s.label} unlocked!`);
  setSkin(id);
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
  if (s.form === "ufo") {
    drawUfoSky(s);
    return;
  }
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, s.skyTop);
  grad.addColorStop(1, s.skyBottom);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  if (!s.world || s.world === "doodle" || s.world === "meadow" || s.world === "town" || s.world === "candy") {
    ctx.fillStyle = "rgba(255,255,255,0.75)";
    drawCloud(90, 135, 0.9);
    drawCloud(375, 90, 1.1);
    drawCloud(270, 225, 0.75);
  }
  window.WingHopThemePacks?.afterSky?.(ctx, themeApi());
}

function drawUfoSky(s) {
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, s.skyTop || "#050814");
  grad.addColorStop(0.45, "#12082c");
  grad.addColorStop(1, s.skyBottom || "#1a1040");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // Nebula washes
  const nebulaA = ctx.createRadialGradient(120, 160, 10, 120, 160, 220);
  nebulaA.addColorStop(0, "rgba(124,156,255,0.28)");
  nebulaA.addColorStop(0.55, "rgba(88,40,160,0.14)");
  nebulaA.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = nebulaA;
  ctx.fillRect(0, 0, W, H * 0.75);

  const nebulaB = ctx.createRadialGradient(480, 280, 8, 480, 280, 200);
  nebulaB.addColorStop(0, "rgba(105,219,124,0.12)");
  nebulaB.addColorStop(0.6, "rgba(60,100,220,0.1)");
  nebulaB.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = nebulaB;
  ctx.fillRect(0, 0, W, H * 0.8);

  // Distant planet
  const px = 470;
  const py = 120;
  const planet = ctx.createRadialGradient(px - 12, py - 10, 6, px, py, 48);
  planet.addColorStop(0, "#b8c8ff");
  planet.addColorStop(0.45, "#5c7ad6");
  planet.addColorStop(1, "#1a2250");
  ctx.fillStyle = planet;
  ctx.beginPath();
  ctx.arc(px, py, 42, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(200,220,255,0.25)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(px, py + 4, 58, 10, -0.25, 0, Math.PI * 2);
  ctx.stroke();

  // Stars
  for (const star of UFO_STARS) {
    const twinkle = 0.75 + Math.sin(distance * 0.04 + star.x * 0.05) * 0.25;
    ctx.fillStyle = `rgba(230,240,255,${star.a * twinkle})`;
    ctx.beginPath();
    ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
    ctx.fill();
  }
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
  const api = themeApi();
  for (const pipe of pipes) {
    const bottomY = pipe.top + PIPE_GAP;
    const bottomH = H - GROUND_H - bottomY;
    if (s.form === "ufo") {
      drawAlienPillar(pipe.x, 0, PIPE_WIDTH, pipe.top, "down", s);
      drawAlienPillar(pipe.x, bottomY, PIPE_WIDTH, bottomH, "up", s);
      continue;
    }
    const themedTop = window.WingHopThemePacks?.drawPipe?.(
      ctx,
      api,
      pipe.x,
      0,
      PIPE_WIDTH,
      pipe.top,
      "down"
    );
    const themedBot = window.WingHopThemePacks?.drawPipe?.(
      ctx,
      api,
      pipe.x,
      bottomY,
      PIPE_WIDTH,
      bottomH,
      "up"
    );
    if (!themedTop) drawCastleTower(pipe.x, 0, PIPE_WIDTH, pipe.top, "down", s);
    if (!themedBot) drawCastleTower(pipe.x, bottomY, PIPE_WIDTH, bottomH, "up", s);
  }
}

function drawAlienPillar(x, y, w, h, tipSide, s) {
  if (h <= 0) return;

  const mid = x + w / 2;
  const dark = s.pipeDark || "#24305c";
  const midCol = s.pipe || "#3d4f8c";
  const light = s.pipeLight || "#6ea8ff";
  const glow = s.pipeStroke || "#9bbcff";
  const acid = "#69db7c";
  const seed = Math.floor(x * 0.17 + y * 0.03);

  // Soft alien aura behind the column
  const aura = ctx.createLinearGradient(x - 10, y, x + w + 10, y);
  aura.addColorStop(0, "rgba(105,219,124,0)");
  aura.addColorStop(0.5, "rgba(124,156,255,0.14)");
  aura.addColorStop(1, "rgba(105,219,124,0)");
  ctx.fillStyle = aura;
  ctx.fillRect(x - 14, y, w + 28, h);

  // Organic wavy body (not a rectangle)
  const steps = Math.max(8, Math.floor(h / 14));
  ctx.beginPath();
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const yy = y + t * h;
    const bulge = 10 + Math.sin(t * Math.PI * 3 + seed) * 7 + Math.sin(t * 9 + seed * 0.4) * 3;
    const xx = mid - (w * 0.28 + bulge * 0.55);
    if (i === 0) ctx.moveTo(xx, yy);
    else ctx.lineTo(xx, yy);
  }
  for (let i = steps; i >= 0; i--) {
    const t = i / steps;
    const yy = y + t * h;
    const bulge = 10 + Math.sin(t * Math.PI * 3 + seed + 1.2) * 7 + Math.sin(t * 8.5 + seed) * 3;
    ctx.lineTo(mid + (w * 0.28 + bulge * 0.55), yy);
  }
  ctx.closePath();

  const bodyGrad = ctx.createLinearGradient(x, y, x + w, y + h);
  bodyGrad.addColorStop(0, dark);
  bodyGrad.addColorStop(0.35, midCol);
  bodyGrad.addColorStop(0.7, mixHex(midCol, light, 0.35));
  bodyGrad.addColorStop(1, mixHex(dark, "#12081c", 0.4));
  ctx.fillStyle = bodyGrad;
  ctx.fill();
  ctx.strokeStyle = mixHex(glow, "#d0ebff", 0.25);
  ctx.lineWidth = 2.4;
  ctx.stroke();

  // Bioluminescent veins
  ctx.strokeStyle = acid;
  ctx.lineWidth = 1.6;
  ctx.globalAlpha = 0.55;
  for (let v = 0; v < 3; v++) {
    const ox = mid + (v - 1) * 12;
    ctx.beginPath();
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const yy = y + t * h;
      const wobble = Math.sin(t * Math.PI * 4 + seed + v) * 5;
      const xx = ox + wobble;
      if (i === 0) ctx.moveTo(xx, yy);
      else ctx.lineTo(xx, yy);
    }
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // Eye / spore pods along the shaft
  for (let i = 1; i < steps; i += 3) {
    const t = i / steps;
    const yy = y + t * h;
    const side = (i + seed) % 2 === 0 ? -1 : 1;
    const px = mid + side * (w * 0.22 + 6);
    const pulse = 0.65 + Math.sin(distance * 0.08 + yy * 0.04 + seed) * 0.35;

    ctx.fillStyle = `rgba(105,219,124,${0.2 * pulse})`;
    ctx.beginPath();
    ctx.ellipse(px, yy, 10, 7, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = mixHex(acid, "#e7ffe8", 0.35);
    ctx.beginPath();
    ctx.ellipse(px, yy, 5.5, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#0b1020";
    ctx.beginPath();
    ctx.ellipse(px + side * 0.8, yy, 2.2, 3.2, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.beginPath();
    ctx.arc(px - side * 1.2, yy - 1.2, 1.1, 0, Math.PI * 2);
    ctx.fill();
  }

  // Tendril claws near the gap
  const clawY = tipSide === "down" ? y + h - 8 : y + 8;
  const clawDir = tipSide === "down" ? 1 : -1;
  ctx.strokeStyle = mixHex(light, acid, 0.4);
  ctx.fillStyle = mixHex(midCol, dark, 0.2);
  ctx.lineWidth = 2;
  for (let c = -2; c <= 2; c++) {
    if (c === 0) continue;
    const cx = mid + c * 14;
    ctx.beginPath();
    ctx.moveTo(mid + c * 6, clawY - clawDir * 18);
    ctx.quadraticCurveTo(cx + c * 4, clawY + clawDir * 8, cx, clawY + clawDir * 26);
    ctx.quadraticCurveTo(mid + c * 8, clawY + clawDir * 10, mid + c * 4, clawY - clawDir * 10);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  // Mouth / maw tip facing the gap
  ctx.save();
  if (tipSide === "down") {
    ctx.translate(mid, y + h);
  } else {
    ctx.translate(mid, y);
    ctx.scale(1, -1);
  }

  // Outer jaws
  const jaw = ctx.createLinearGradient(-40, -36, 40, 10);
  jaw.addColorStop(0, dark);
  jaw.addColorStop(0.5, mixHex(midCol, acid, 0.2));
  jaw.addColorStop(1, dark);
  ctx.fillStyle = jaw;
  ctx.strokeStyle = glow;
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(-38, -34);
  ctx.bezierCurveTo(-44, -8, -28, 8, -6, 16);
  ctx.quadraticCurveTo(0, 22, 6, 16);
  ctx.bezierCurveTo(28, 8, 44, -8, 38, -34);
  ctx.bezierCurveTo(18, -20, -18, -20, -38, -34);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Inner glow throat
  const throat = ctx.createRadialGradient(0, -4, 2, 0, 2, 22);
  throat.addColorStop(0, "rgba(105,219,124,0.75)");
  throat.addColorStop(0.45, "rgba(124,156,255,0.35)");
  throat.addColorStop(1, "rgba(10,8,24,0)");
  ctx.fillStyle = throat;
  ctx.beginPath();
  ctx.ellipse(0, 0, 16, 12, 0, 0, Math.PI * 2);
  ctx.fill();

  // Teeth
  ctx.fillStyle = mixHex(light, "#f1f8ff", 0.45);
  for (let t = -3; t <= 3; t++) {
    if (t === 0) continue;
    const tx = t * 7;
    ctx.beginPath();
    ctx.moveTo(tx - 3, -6);
    ctx.lineTo(tx, 10 + Math.abs(t));
    ctx.lineTo(tx + 3, -6);
    ctx.closePath();
    ctx.fill();
  }

  // Horn spikes on the sides of the maw
  ctx.fillStyle = mixHex(acid, light, 0.25);
  ctx.strokeStyle = glow;
  ctx.lineWidth = 1.6;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(side * 28, -28);
    ctx.lineTo(side * 48, -40);
    ctx.lineTo(side * 30, -18);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
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
  if (s.form === "ufo") {
    drawUfoGround(s);
    return;
  }
  ctx.fillStyle = s.ground;
  ctx.fillRect(0, H - GROUND_H, W, GROUND_H);

  ctx.fillStyle = s.grass;
  ctx.fillRect(0, H - GROUND_H, W, 24);

  ctx.fillStyle = s.dirt;
  for (let x = -groundOffset; x < W + 42; x += 42) {
    ctx.fillRect(x, H - GROUND_H + 27, 21, 12);
    ctx.fillRect(x + 21, H - GROUND_H + 51, 21, 12);
  }
  window.WingHopThemePacks?.afterGround?.(ctx, themeApi());
}

function drawUfoGround(s) {
  const gy = H - GROUND_H;
  const moon = ctx.createLinearGradient(0, gy, 0, H);
  moon.addColorStop(0, mixHex(s.grass || "#2f6fed", "#1a1528", 0.35));
  moon.addColorStop(0.35, s.ground || "#1a1528");
  moon.addColorStop(1, s.dirt || "#12101c");
  ctx.fillStyle = moon;
  ctx.fillRect(0, gy, W, GROUND_H);

  // Glowing horizon line
  const glow = ctx.createLinearGradient(0, gy - 8, 0, gy + 18);
  glow.addColorStop(0, "rgba(124,156,255,0)");
  glow.addColorStop(0.45, "rgba(124,156,255,0.35)");
  glow.addColorStop(1, "rgba(105,219,124,0.08)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, gy - 8, W, 26);

  // Craters scrolling with ground
  ctx.fillStyle = "rgba(0,0,0,0.28)";
  for (let x = -groundOffset; x < W + 80; x += 70) {
    ctx.beginPath();
    ctx.ellipse(x + 18, gy + 38, 16, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(x + 48, gy + 62, 10, 5, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Scattered rocks / lights
  for (let x = -groundOffset; x < W + 60; x += 52) {
    ctx.fillStyle = mixHex(s.pipeLight || "#6ea8ff", "#0a1020", 0.45);
    ctx.fillRect(x + 8, gy + 28, 7, 5);
    ctx.fillStyle = "rgba(105,219,124,0.45)";
    ctx.beginPath();
    ctx.arc(x + 36, gy + 22, 2.2, 0, Math.PI * 2);
    ctx.fill();
  }
}

function mixHex(a, b, t) {
  const parse = (h) => {
    if (typeof h !== "string") return [0, 0, 0];
    const rgb = h.match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i);
    if (rgb) return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])];
    let n = h.replace("#", "").trim();
    if (n.length === 3) n = n.split("").map((c) => c + c).join("");
    if (!/^[0-9a-f]{6}$/i.test(n)) return [0, 0, 0];
    return [
      parseInt(n.slice(0, 2), 16),
      parseInt(n.slice(2, 4), 16),
      parseInt(n.slice(4, 6), 16)
    ];
  };
  const [ar, ag, ab] = parse(a);
  const [br, bg, bb] = parse(b);
  const to = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
  const r = ar + (br - ar) * t;
  const g = ag + (bg - ag) * t;
  const bl = ab + (bb - ab) * t;
  return `#${to(r)}${to(g)}${to(bl)}`;
}

function drawUfo() {
  const s = skin();
  const bob = Math.sin(wingPhase) * 2.5;
  const glow = 0.55 + Math.abs(Math.sin(wingPhase)) * 0.35 + wingBurst * 0.2;
  const rim = mixHex(s.body, "#d0ebff", 0.35);
  const hull = mixHex(s.belly || "#212529", "#0a0c12", 0.2);
  const accent = s.beak || "#69db7c";
  const glass = mixHex(s.body, "#e7f5ff", 0.45);

  ctx.save();
  try {
    ctx.translate(BIRD_X, bird.y + bob);
    ctx.rotate(bird.rot * 0.35);
    ctx.lineJoin = "round";
    ctx.lineCap = "round";

    // Soft shadow
    ctx.fillStyle = "rgba(0,0,0,0.28)";
    ctx.beginPath();
    ctx.ellipse(0, 20, 22, 4.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Tractor beam when flapping up
    if (bird.vy < -40 || wingBurst > 0.2) {
      const pulse = 0.35 + glow * 0.35;
      const beam = ctx.createLinearGradient(0, 8, 0, 48);
      beam.addColorStop(0, `rgba(105,219,124,${0.45 * pulse})`);
      beam.addColorStop(0.55, `rgba(124,156,255,${0.18 * pulse})`);
      beam.addColorStop(1, "rgba(124,156,255,0)");
      ctx.fillStyle = beam;
      ctx.beginPath();
      ctx.moveTo(-10, 10);
      ctx.lineTo(10, 10);
      ctx.lineTo(22, 48);
      ctx.lineTo(-22, 48);
      ctx.closePath();
      ctx.fill();
    }

    // Saucer rim / hull
    const dish = ctx.createLinearGradient(0, -6, 0, 14);
    dish.addColorStop(0, rim);
    dish.addColorStop(0.45, s.body);
    dish.addColorStop(1, mixHex(s.body, "#101522", 0.55));
    ctx.fillStyle = dish;
    ctx.strokeStyle = mixHex(s.body, "#02040a", 0.55);
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.ellipse(0, 4, 30, 11, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Dark underbelly band
    ctx.fillStyle = hull;
    ctx.beginPath();
    ctx.ellipse(0, 8, 22, 6.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Dome canopy
    const dome = ctx.createRadialGradient(-4, -10, 2, 0, -4, 18);
    dome.addColorStop(0, "#f8fbff");
    dome.addColorStop(0.35, glass);
    dome.addColorStop(1, mixHex(s.body, "#1b2838", 0.35));
    ctx.fillStyle = dome;
    ctx.strokeStyle = mixHex(s.body, "#0b1020", 0.4);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, -4, 14, 12, 0, Math.PI, 0, true);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Pilot glow / eye
    ctx.fillStyle = s.eye || "#d0ebff";
    ctx.beginPath();
    ctx.ellipse(0, -6, 4.5, 3.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = s.pupil || "#0b2948";
    ctx.beginPath();
    ctx.ellipse(0.6, -6, 1.6, 2.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.45)";
    ctx.beginPath();
    ctx.arc(-1.2, -7, 1.1, 0, Math.PI * 2);
    ctx.fill();

    // Rim lights
    const lights = [-18, -9, 0, 9, 18];
    for (let i = 0; i < lights.length; i++) {
      const on = (Math.floor(distance * 0.08) + i) % 2 === 0;
      ctx.fillStyle = on ? accent : mixHex(accent, "#1a1b2a", 0.55);
      ctx.beginPath();
      ctx.arc(lights[i], 7, 2.4, 0, Math.PI * 2);
      ctx.fill();
      if (on) {
        ctx.fillStyle = `rgba(105,219,124,${0.35 * glow})`;
        ctx.beginPath();
        ctx.arc(lights[i], 7, 4.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Antenna
    ctx.strokeStyle = rim;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -15);
    ctx.lineTo(0, -24);
    ctx.stroke();
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.arc(0, -25, 2.6, 0, Math.PI * 2);
    ctx.fill();
  } catch (err) {
    console.error("Wing Hop UFO draw failed:", err);
  } finally {
    ctx.restore();
    ctx.globalAlpha = 1;
  }
}

function drawBird() {
  if (skin().form === "ufo") {
    drawUfo();
    return;
  }
  const api = themeApi();
  if (window.WingHopThemePacks?.drawPlayer?.(ctx, api)) return;

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
  try {
    ctx.translate(BIRD_X, bird.y);
    ctx.rotate(bird.rot * 0.55);
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.globalAlpha = 1;

    // Soft local shadow
    ctx.fillStyle = "rgba(0,0,0,0.22)";
    ctx.beginPath();
    ctx.ellipse(2, 18, 16, 4, 0, 0, Math.PI * 2);
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
    ctx.lineWidth = 3;
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
  } catch (err) {
    console.error("Wing Hop dragon draw failed:", err);
  } finally {
    ctx.restore();
    ctx.globalAlpha = 1;
  }
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
  const id = btn.dataset.skin;
  if (isCoinSkin(id) && !ownsSkin(id)) {
    tryBuySkin(id);
    return;
  }
  setSkin(id);
});

document.addEventListener("hub-coins-changed", () => {
  if (isCoinSkin(skinId) && !ownsSkin(skinId)) {
    skinId = "classic";
    try {
      localStorage.setItem(SKIN_KEY, "classic");
    } catch {}
  }
  updateSkinPicker();
  draw();
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
