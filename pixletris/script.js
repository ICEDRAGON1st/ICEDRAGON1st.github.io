const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const scoreEl = document.getElementById("score");
const linesEl = document.getElementById("lines");
const levelEl = document.getElementById("level");
const highScoreEl = document.getElementById("high-score");
const messageEl = document.getElementById("message");
const overlay = document.getElementById("overlay");
const overlayTitle = document.getElementById("overlay-title");
const overlayText = document.getElementById("overlay-text");
const startBtn = document.getElementById("start-btn");
const resumeBtn = document.getElementById("resume-btn");
const viewBoardBtn = document.getElementById("view-board-btn");
const gamesBtn = document.getElementById("games-btn");
const menuBtn = document.getElementById("menu-btn");

const COLS = 10;
const ROWS = 20;
const GPC = 12;
const SCOLS = COLS * GPC;
const SROWS = ROWS * GPC;
const GRAIN = 5;
const BOARD_W = SCOLS * GRAIN;
const PANEL_W = 180;
const PANEL_X = BOARD_W + 14;
const HIGH_SCORE_KEY = "pixletris-high-score";

const COLORS = {
  I: "#00f5ff",
  O: "#ffe600",
  T: "#c850ff",
  S: "#4dff6a",
  Z: "#ff4d6a",
  J: "#4d7aff",
  L: "#ff9a3d"
};

const SHAPES = {
  I: [
    [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]],
    [[0, 0, 1, 0], [0, 0, 1, 0], [0, 0, 1, 0], [0, 0, 1, 0]]
  ],
  O: [[[1, 1], [1, 1]]],
  T: [
    [[0, 1, 0], [1, 1, 1], [0, 0, 0]],
    [[0, 1, 0], [0, 1, 1], [0, 1, 0]],
    [[0, 0, 0], [1, 1, 1], [0, 1, 0]],
    [[0, 1, 0], [1, 1, 0], [0, 1, 0]]
  ],
  S: [
    [[0, 1, 1], [1, 1, 0], [0, 0, 0]],
    [[0, 1, 0], [0, 1, 1], [0, 0, 1]]
  ],
  Z: [
    [[1, 1, 0], [0, 1, 1], [0, 0, 0]],
    [[0, 0, 1], [0, 1, 1], [0, 1, 0]]
  ],
  J: [
    [[1, 0, 0], [1, 1, 1], [0, 0, 0]],
    [[0, 1, 1], [0, 1, 0], [0, 1, 0]],
    [[0, 0, 0], [1, 1, 1], [0, 0, 1]],
    [[0, 1, 0], [0, 1, 0], [1, 1, 0]]
  ],
  L: [
    [[0, 0, 1], [1, 1, 1], [0, 0, 0]],
    [[0, 1, 0], [0, 1, 0], [0, 1, 1]],
    [[0, 0, 0], [1, 1, 1], [1, 0, 0]],
    [[1, 1, 0], [0, 1, 0], [0, 1, 0]]
  ]
};

const PIECE_TYPES = Object.keys(SHAPES);
const LINE_SCORES = [0, 100, 300, 500, 800];

let sand = [];
let current = null;
let next = null;
let score = 0;
let lines = 0;
let level = 1;
let highScore = loadHighScore();
let running = false;
let menuMode = "start";
let dropTimer = 0;
let dropInterval = 0.5;
let lastTime = 0;
let touchStart = null;
let sandDownTimer = 0;
let sandSlideTimer = 0;
let sandIdleTimer = 0;
let clearing = null;

const SAND_DOWN_INTERVAL = 0.028;
const SAND_SLIDE_INTERVAL = 0.06;
const SAND_IDLE_DELAY = 0.12;
const CLEAR_FLASH_DURATION = 0.28;

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

function createSand() {
  return Array.from({ length: SROWS }, () => Array(SCOLS).fill(0));
}

function randomPiece() {
  const type = PIECE_TYPES[Math.floor(Math.random() * PIECE_TYPES.length)];
  return { type, rotation: 0, x: 3, y: 0, color: COLORS[type] };
}

function getShape(piece) {
  return SHAPES[piece.type][piece.rotation];
}

function updateHud() {
  scoreEl.textContent = String(score);
  linesEl.textContent = String(lines);
  levelEl.textContent = String(level);
  highScoreEl.textContent = String(highScore);
}

function dropSpeed() {
  return Math.max(0.08, 0.5 - (level - 1) * 0.06);
}

function collides(piece, offsetX = 0, offsetY = 0, rotation = piece.rotation) {
  const shape = SHAPES[piece.type][rotation];
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const mx = piece.x + c + offsetX;
      const my = piece.y + r + offsetY;
      if (mx < 0 || mx >= COLS || my >= ROWS) return true;
      const baseX = mx * GPC;
      const baseY = my * GPC;
      for (let gy = 0; gy < GPC; gy++) {
        for (let gx = 0; gx < GPC; gx++) {
          const sy = baseY + gy;
          const sx = baseX + gx;
          if (sy >= SROWS) return true;
          if (sy >= 0 && sand[sy][sx]) return true;
        }
      }
    }
  }
  return false;
}

function shuffle(list) {
  const arr = [...list];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function lockPiece() {
  const shape = getShape(current);
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const baseX = (current.x + c) * GPC;
      const baseY = (current.y + r) * GPC;
      for (let gy = 0; gy < GPC; gy++) {
        for (let gx = 0; gx < GPC; gx++) {
          const sx = baseX + gx;
          const sy = baseY + gy;
          if (sy >= 0 && sy < SROWS && sx >= 0 && sx < SCOLS) {
            sand[sy][sx] = current.color;
          }
        }
      }
    }
  }
  current = null;
  window.HubSound?.play("place");
}

function simulateSandStep(mode = "both") {
  const prev = sand.map((row) => row.slice());
  const next = prev.map((row) => row.slice());
  let moved = false;

  function collectCells() {
    const cells = [];
    for (let r = SROWS - 2; r >= 0; r--) {
      for (let c = 0; c < SCOLS; c++) {
        if (next[r][c]) cells.push([r, c]);
      }
    }
    return shuffle(cells);
  }

  function moveDown(r, c) {
    const color = next[r][c];
    if (!color || next[r + 1][c]) return false;
    next[r][c] = 0;
    next[r + 1][c] = color;
    return true;
  }

  function moveDiagonal(r, c) {
    const color = next[r][c];
    if (!color || !next[r + 1][c]) return false;
    const dirs = Math.random() < 0.5 ? [-1, 1] : [1, -1];
    for (const dc of dirs) {
      const nc = c + dc;
      if (nc < 0 || nc >= SCOLS || next[r + 1][nc]) continue;
      next[r][c] = 0;
      next[r + 1][nc] = color;
      return true;
    }
    return false;
  }

  if (mode === "down" || mode === "both") {
    for (const [r, c] of collectCells()) {
      if (moveDown(r, c)) moved = true;
    }
  }

  if (mode === "slide" || mode === "both") {
    for (const [r, c] of collectCells()) {
      if (moveDiagonal(r, c)) moved = true;
    }
  }

  sand = next;
  return moved;
}

function findColorBridges() {
  const visited = Array.from({ length: SROWS }, () => new Uint8Array(SCOLS));
  const bridges = [];
  let lineCount = 0;

  for (let startR = 0; startR < SROWS; startR++) {
    const color = sand[startR][0];
    if (!color || visited[startR][0]) continue;

    const cells = [];
    const stack = [[startR, 0]];
    let touchesRight = false;

    while (stack.length) {
      const [r, c] = stack.pop();
      if (r < 0 || r >= SROWS || c < 0 || c >= SCOLS) continue;
      if (visited[r][c] || sand[r][c] !== color) continue;
      visited[r][c] = 1;
      cells.push([r, c]);
      if (c === SCOLS - 1) touchesRight = true;
      stack.push([r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]);
    }

    if (!touchesRight || cells.length < SCOLS) continue;
    bridges.push({ color, cells });
    lineCount += Math.max(1, Math.round(cells.length / SCOLS));
  }

  return { bridges, lineCount };
}

function startClearFlash() {
  if (clearing) return false;
  const { bridges, lineCount } = findColorBridges();
  if (!bridges.length) return false;

  const cells = [];
  for (const bridge of bridges) {
    for (const cell of bridge.cells) cells.push(cell);
  }

  clearing = {
    cells,
    lineCount,
    timer: 0,
    duration: CLEAR_FLASH_DURATION
  };
  messageEl.textContent = lineCount > 1 ? `${lineCount} lines!` : "Line clear!";
  window.HubSound?.play("clear");
  return true;
}

function finishClearFlash() {
  if (!clearing) return;
  for (const [r, c] of clearing.cells) {
    if (r >= 0 && r < SROWS && c >= 0 && c < SCOLS) sand[r][c] = 0;
  }
  applyLineClear(clearing.lineCount);
  clearing = null;
  sandIdleTimer = 0;
  sandDownTimer = 0;
  sandSlideTimer = 0;
}

function tryClearColorLines() {
  return startClearFlash();
}

function applyLineClear(cleared) {
  if (cleared <= 0) return;
  lines += cleared;
  score += LINE_SCORES[Math.min(cleared, LINE_SCORES.length - 1)] * level;
  const newLevel = Math.floor(lines / 10) + 1;
  if (newLevel > level) {
    level = newLevel;
    messageEl.textContent = `Level ${level}!`;
  }
  if (score > highScore) {
    highScore = score;
    saveHighScore();
  }
  updateHud();
}

function finishSettlement() {
  if (tryClearColorLines()) {
    sandIdleTimer = 0;
  }
}

function spawnPiece() {
  current = next || randomPiece();
  next = randomPiece();
  if (collides(current)) {
    gameOver();
    return false;
  }
  return true;
}

function tryMove(dx, dy) {
  if (!running || !current) return false;
  if (!collides(current, dx, dy)) {
    current.x += dx;
    current.y += dy;
    return true;
  }
  return false;
}

function tryRotate() {
  if (!running || !current) return;
  const nextRot = (current.rotation + 1) % SHAPES[current.type].length;
  if (!collides(current, 0, 0, nextRot)) {
    current.rotation = nextRot;
    return;
  }
  if (!collides(current, -1, 0, nextRot)) {
    current.x -= 1;
    current.rotation = nextRot;
    return;
  }
  if (!collides(current, 1, 0, nextRot)) {
    current.x += 1;
    current.rotation = nextRot;
  }
}

function hardDrop() {
  if (!running || !current) return;
  let dropped = 0;
  while (tryMove(0, 1)) dropped += 1;
  score += dropped * 2;
  settlePiece();
}

function softDrop() {
  if (!running || !current) return;
  if (tryMove(0, 1)) {
    score += 1;
    updateHud();
  } else {
    settlePiece();
  }
}

function settlePiece() {
  lockPiece();
  sandDownTimer = 0;
  sandSlideTimer = 0;
  sandIdleTimer = 0;
  dropTimer = 0;
  spawnPiece();
}

function gameOver() {
  running = false;
  menuMode = "over";
  const isNew = score > 0 && score >= highScore;
  if (isNew) {
    highScore = score;
    saveHighScore();
    window.HubConfetti?.burst();
  }
  updateHud();
  if (window.HubAchievements) {
    if (lines >= 5) HubAchievements.unlock("pixletris_lines_5");
    if (lines >= 20) HubAchievements.unlock("pixletris_lines_20");
    if (score >= 1000) HubAchievements.unlock("pixletris_score_1k");
  }
  messageEl.textContent = "Game over!";
  window.HubSound?.play("lose");
  showMenu(
    "over",
    "Game Over",
    `You scored ${score} with ${lines} lines cleared.${isNew ? " New best score!" : ""}`
  );
}

function resetGame() {
  sand = createSand();
  current = null;
  next = randomPiece();
  score = 0;
  lines = 0;
  level = 1;
  dropTimer = 0;
  sandDownTimer = 0;
  sandSlideTimer = 0;
  sandIdleTimer = 0;
  clearing = null;
  dropInterval = dropSpeed();
  messageEl.textContent = "";
  updateHud();
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
  draw();
}


function viewBoard() {
  if (menuMode !== "over") return;
  overlay.classList.add("hidden");
  if (messageEl && !/menu/i.test(messageEl.textContent || "")) {
    const base = (messageEl.textContent || "").trim();
    messageEl.textContent = base ? `${base} · Tap Menu for Try Again.` : "Tap Menu to return to the result screen.";
  }
}

function openPauseMenu() {
  if (!running || menuMode === "over") return;
  showMenu("pause", "Menu", `Score ${score} · Level ${level}. Resume, restart, or go back to Games.`);
}

function startGame() {
  if (window.HubStreak) HubStreak.recordPlay();
  if (window.HubPlays) HubPlays.record("pixletris");
  resetGame();
  overlay.classList.add("hidden");
  menuMode = "playing";
  running = true;
  spawnPiece();
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

const darkColorCache = new Map();

function darkenColor(hex, amount = 0.62) {
  const cached = darkColorCache.get(`${hex}:${amount}`);
  if (cached) return cached;

  const value = hex.replace("#", "");
  const r = Math.floor(parseInt(value.slice(0, 2), 16) * amount);
  const g = Math.floor(parseInt(value.slice(2, 4), 16) * amount);
  const b = Math.floor(parseInt(value.slice(4, 6), 16) * amount);
  const dark = `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
  darkColorCache.set(`${hex}:${amount}`, dark);
  return dark;
}

function textureColor(color, sandR, sandC) {
  return (sandR + sandC) % 2 === 0 ? color : darkenColor(color);
}

function drawGrain(px, py, color, size = GRAIN, sandR = 0, sandC = 0) {
  const inset = size <= 5 ? 0 : 1;
  const g = size - inset * 2;
  ctx.fillStyle = textureColor(color, sandR, sandC);
  ctx.fillRect(px + inset, py + inset, g, g);
}

function drawClearOutline() {
  if (!clearing) return;

  const marked = Array.from({ length: SROWS }, () => new Uint8Array(SCOLS));
  for (const [r, c] of clearing.cells) marked[r][c] = 1;

  const t = clearing.timer / clearing.duration;
  const pulse = 0.5 + 0.5 * Math.sin(t * Math.PI * 6);
  const alpha = 0.45 + pulse * 0.55;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = "#ffffff";
  for (const [r, c] of clearing.cells) {
    ctx.fillRect(c * GRAIN, r * GRAIN, GRAIN, GRAIN);
  }

  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = Math.max(2, GRAIN * 0.45);
  ctx.lineJoin = "round";
  ctx.beginPath();
  for (const [r, c] of clearing.cells) {
    const x = c * GRAIN;
    const y = r * GRAIN;
    if (!marked[r - 1]?.[c]) {
      ctx.moveTo(x, y);
      ctx.lineTo(x + GRAIN, y);
    }
    if (!marked[r + 1]?.[c]) {
      ctx.moveTo(x, y + GRAIN);
      ctx.lineTo(x + GRAIN, y + GRAIN);
    }
    if (!marked[r][c - 1]) {
      ctx.moveTo(x, y);
      ctx.lineTo(x, y + GRAIN);
    }
    if (!marked[r][c + 1]) {
      ctx.moveTo(x + GRAIN, y);
      ctx.lineTo(x + GRAIN, y + GRAIN);
    }
  }
  ctx.stroke();
  ctx.restore();
}

function drawSandBoard() {
  ctx.fillStyle = "#12091f";
  ctx.fillRect(0, 0, BOARD_W, SROWS * GRAIN);

  for (let r = 0; r < SROWS; r++) {
    for (let c = 0; c < SCOLS; c++) {
      const color = sand[r][c];
      if (color) drawGrain(c * GRAIN, r * GRAIN, color, GRAIN, r, c);
    }
  }

  drawClearOutline();
}

function drawPieceGrains(piece) {
  const shape = getShape(piece);
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const baseX = (piece.x + c) * GPC * GRAIN;
      const baseY = (piece.y + r) * GPC * GRAIN;
      for (let gy = 0; gy < GPC; gy++) {
        for (let gx = 0; gx < GPC; gx++) {
          const sandR = (piece.y + r) * GPC + gy;
          const sandC = (piece.x + c) * GPC + gx;
          drawGrain(
            baseX + gx * GRAIN,
            baseY + gy * GRAIN,
            piece.color,
            GRAIN,
            sandR,
            sandC
          );
        }
      }
    }
  }
}

function drawPanel() {
  const panelW = canvas.width - BOARD_W;
  ctx.fillStyle = "#1a1230";
  ctx.fillRect(BOARD_W, 0, panelW, canvas.height);

  ctx.fillStyle = "#a89bc7";
  ctx.font = "bold 20px Courier New, monospace";
  ctx.fillText("NEXT", PANEL_X, 48);

  if (next) {
    const shape = SHAPES[next.type][0];
    const pg = 3;
    const offsetX = PANEL_X + 8;
    const offsetY = 68;
    for (let r = 0; r < shape.length; r++) {
      for (let c = 0; c < shape[r].length; c++) {
        if (!shape[r][c]) continue;
        for (let gy = 0; gy < GPC; gy++) {
          for (let gx = 0; gx < GPC; gx++) {
            drawGrain(
              offsetX + (c * GPC + gx) * pg,
              offsetY + (r * GPC + gy) * pg,
              next.color,
              pg,
              r * GPC + gy,
              c * GPC + gx
            );
          }
        }
      }
    }
  }

  ctx.fillStyle = "#f4eeff";
  ctx.font = "bold 18px Courier New, monospace";
  const infoY = 260;
  ctx.fillText("CONTROLS", PANEL_X, infoY);
  ctx.fillStyle = "#a89bc7";
  ctx.font = "15px Courier New, monospace";
  const tips = ["← → / A D move", "↑ / W rotate", "↓ / S soft drop", "Space hard drop", "Bridge color L→R"];
  tips.forEach((tip, i) => ctx.fillText(tip, PANEL_X, infoY + 30 + i * 24));
}

function draw() {
  ctx.fillStyle = "#0a0612";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  drawSandBoard();
  if (current) drawPieceGrains(current);
  drawPanel();
}

function update(dt) {
  if (clearing) {
    clearing.timer += dt;
    if (clearing.timer >= clearing.duration) finishClearFlash();
    if (!current) return;
    dropInterval = dropSpeed();
    dropTimer += dt;
    while (dropTimer >= dropInterval) {
      dropTimer -= dropInterval;
      if (!tryMove(0, 1)) settlePiece();
    }
    return;
  }

  sandDownTimer += dt;
  sandSlideTimer += dt;
  let sandMoved = false;

  if (sandDownTimer >= SAND_DOWN_INTERVAL) {
    sandDownTimer -= SAND_DOWN_INTERVAL;
    if (simulateSandStep("down")) sandMoved = true;
  }

  if (sandSlideTimer >= SAND_SLIDE_INTERVAL) {
    sandSlideTimer -= SAND_SLIDE_INTERVAL;
    if (simulateSandStep("slide")) sandMoved = true;
  }

  if (tryClearColorLines()) {
    sandIdleTimer = 0;
    sandDownTimer = 0;
    sandSlideTimer = 0;
  } else if (sandMoved) {
    sandIdleTimer = 0;
  } else {
    sandIdleTimer += dt;
    if (sandIdleTimer >= SAND_IDLE_DELAY) {
      sandIdleTimer = 0;
      finishSettlement();
    }
  }

  if (!current) return;

  dropInterval = dropSpeed();
  dropTimer += dt;
  while (dropTimer >= dropInterval) {
    dropTimer -= dropInterval;
    if (!tryMove(0, 1)) settlePiece();
  }
}

function loop(now) {
  if (!running) return;
  const dt = Math.min(0.05, (now - lastTime) / 1000);
  lastTime = now;
  update(dt);
  draw();
  requestAnimationFrame(loop);
}

window.addEventListener("keydown", (e) => {
  if (e.code === "Escape") {
    e.preventDefault();
    if (menuMode === "pause" && !overlay.classList.contains("hidden")) resumeGame();
    else if (running) openPauseMenu();
    else overlay.classList.remove("hidden");
    return;
  }
  if (!running) return;

  if (e.code === "ArrowLeft" || e.code === "KeyA") {
    e.preventDefault();
    tryMove(-1, 0);
    draw();
  } else if (e.code === "ArrowRight" || e.code === "KeyD") {
    e.preventDefault();
    tryMove(1, 0);
    draw();
  } else if (e.code === "ArrowDown" || e.code === "KeyS") {
    e.preventDefault();
    softDrop();
    draw();
  } else if (e.code === "ArrowUp" || e.code === "KeyW") {
    e.preventDefault();
    tryRotate();
    draw();
  } else if (e.code === "Space") {
    e.preventDefault();
    hardDrop();
    draw();
  }
});

canvas.addEventListener("pointerdown", (e) => {
  touchStart = { x: e.clientX, y: e.clientY };
});

canvas.addEventListener("pointerup", (e) => {
  if (!touchStart || !running) return;
  const dx = e.clientX - touchStart.x;
  const dy = e.clientY - touchStart.y;
  touchStart = null;
  const min = 28;
  if (Math.abs(dx) < min && Math.abs(dy) < min) tryRotate();
  else if (Math.abs(dx) > Math.abs(dy)) tryMove(dx > 0 ? 1 : -1, 0);
  else if (dy > 0) softDrop();
  else hardDrop();
  draw();
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

startBtn.addEventListener("click", () => startGame());
resumeBtn.addEventListener("click", () => resumeGame());
viewBoardBtn?.addEventListener("click", () => viewBoard());
gamesBtn.addEventListener("click", () => goToGames());

updateHud();
resetGame();
draw();
showMenu(
  "start",
  "Pixletris",
  "Blocks crumble into sand when they land. Connect one color from the left wall all the way to the right wall to clear it."
);
