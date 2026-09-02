const SIZE = 4;
const BEST_KEY = "2048-best-score";
const WIN_VALUE = 2048;

const gridEl = document.getElementById("grid");
const tilesEl = document.getElementById("tiles");
const scoreEl = document.getElementById("score");
const bestEl = document.getElementById("best");
const messageEl = document.getElementById("message");
const overlay = document.getElementById("overlay");
const overlayTitle = document.getElementById("overlay-title");
const overlayText = document.getElementById("overlay-text");
const startBtn = document.getElementById("start-btn");
const resumeBtn = document.getElementById("resume-btn");
const gamesBtn = document.getElementById("games-btn");
const menuBtn = document.getElementById("menu-btn");
const boardEl = document.getElementById("board");

const TILE_COLORS = {
  2: { bg: "#eee4da", fg: "#776e65" },
  4: { bg: "#ede0c8", fg: "#776e65" },
  8: { bg: "#f2b179", fg: "#f9f6f2" },
  16: { bg: "#f59563", fg: "#f9f6f2" },
  32: { bg: "#f67c5f", fg: "#f9f6f2" },
  64: { bg: "#f65e3b", fg: "#f9f6f2" },
  128: { bg: "#edcf72", fg: "#f9f6f2" },
  256: { bg: "#edcc61", fg: "#f9f6f2" },
  512: { bg: "#edc850", fg: "#f9f6f2" },
  1024: { bg: "#edc53f", fg: "#f9f6f2" },
  2048: { bg: "#edc22e", fg: "#f9f6f2" }
};

let grid = [];
let score = 0;
let best = loadBest();
let playing = false;
let menuMode = "start";
let won = false;
let touchStart = null;

function loadBest() {
  try {
    const n = Number(localStorage.getItem(BEST_KEY));
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  } catch {
    return 0;
  }
}

function saveBest() {
  localStorage.setItem(BEST_KEY, String(best));
}

function emptyGrid() {
  return Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
}

function cloneGrid(g) {
  return g.map((row) => [...row]);
}

function updateHud() {
  scoreEl.textContent = String(score);
  bestEl.textContent = String(best);
}

function buildBackgroundGrid() {
  gridEl.innerHTML = "";
  for (let i = 0; i < SIZE * SIZE; i++) {
    const cell = document.createElement("div");
    cell.className = "grid-cell";
    gridEl.appendChild(cell);
  }
}

function cellMetrics() {
  const gap = parseFloat(getComputedStyle(gridEl).gap) || 16;
  const w = gridEl.clientWidth;
  const cell = (w - gap * (SIZE - 1)) / SIZE;
  return { gap, cell };
}

function tileFontSize(value) {
  if (value >= 1024) return "2.35rem";
  if (value >= 128) return "2.65rem";
  if (value >= 16) return "2.85rem";
  return "3.15rem";
}

function renderTiles(newCells = [], mergedCells = []) {
  tilesEl.innerHTML = "";
  const { gap, cell } = cellMetrics();
  const newSet = new Set(newCells.map(([r, c]) => `${r},${c}`));
  const mergedSet = new Set(mergedCells.map(([r, c]) => `${r},${c}`));

  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const value = grid[r][c];
      if (!value) continue;

      const tile = document.createElement("div");
      tile.className = "tile";
      const colors = TILE_COLORS[value] || { bg: "#3c3a32", fg: "#f9f6f2" };
      tile.style.background = colors.bg;
      tile.style.color = colors.fg;
      tile.style.width = `${cell}px`;
      tile.style.height = `${cell}px`;
      tile.style.left = `${c * (cell + gap)}px`;
      tile.style.top = `${r * (cell + gap)}px`;
      tile.style.fontSize = tileFontSize(value);
      tile.textContent = String(value);

      const key = `${r},${c}`;
      if (newSet.has(key)) tile.classList.add("new");
      if (mergedSet.has(key)) tile.classList.add("merged");

      tilesEl.appendChild(tile);
    }
  }
}

function randomEmptyCell() {
  const empty = [];
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (grid[r][c] === 0) empty.push([r, c]);
    }
  }
  if (!empty.length) return null;
  return empty[Math.floor(Math.random() * empty.length)];
}

function addRandomTile() {
  const spot = randomEmptyCell();
  if (!spot) return null;
  const [r, c] = spot;
  grid[r][c] = Math.random() < 0.9 ? 2 : 4;
  return [r, c];
}

function canMove() {
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const v = grid[r][c];
      if (v === 0) return true;
      if (c < SIZE - 1 && grid[r][c + 1] === v) return true;
      if (r < SIZE - 1 && grid[r + 1][c] === v) return true;
    }
  }
  return false;
}

function hasWon() {
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (grid[r][c] >= WIN_VALUE) return true;
    }
  }
  return false;
}

function slideLine(line) {
  const filtered = line.filter((v) => v !== 0);
  const mergedIndices = [];
  const out = [];

  for (let i = 0; i < filtered.length; i++) {
    if (i < filtered.length - 1 && filtered[i] === filtered[i + 1]) {
      const value = filtered[i] * 2;
      out.push(value);
      score += value;
      mergedIndices.push(out.length - 1);
      i += 1;
    } else {
      out.push(filtered[i]);
    }
  }

  while (out.length < SIZE) out.push(0);
  const moved = out.some((v, i) => v !== line[i]);
  return { line: out, moved, mergedIndices };
}

function slideRowLeft(row) {
  return slideLine(row);
}

function slideRowRight(row) {
  const reversed = [...row].reverse();
  const result = slideLine(reversed);
  return {
    line: result.line.reverse(),
    moved: result.moved,
    mergedIndices: result.mergedIndices.map((idx) => SIZE - 1 - idx)
  };
}

function slideColUp(g) {
  const next = cloneGrid(g);
  let moved = false;
  const mergedCells = [];

  for (let c = 0; c < SIZE; c++) {
    const col = [];
    for (let r = 0; r < SIZE; r++) col.push(g[r][c]);
    const result = slideLine(col);
    if (result.moved) moved = true;
    for (let r = 0; r < SIZE; r++) next[r][c] = result.line[r];
    for (const idx of result.mergedIndices) mergedCells.push([idx, c]);
  }

  return { grid: next, moved, mergedCells };
}

function slideColDown(g) {
  const next = cloneGrid(g);
  let moved = false;
  const mergedCells = [];

  for (let c = 0; c < SIZE; c++) {
    const col = [];
    for (let r = SIZE - 1; r >= 0; r--) col.push(g[r][c]);
    const result = slideLine(col);
    if (result.moved) moved = true;
    for (let r = 0; r < SIZE; r++) next[SIZE - 1 - r][c] = result.line[r];
    for (const idx of result.mergedIndices) mergedCells.push([SIZE - 1 - idx, c]);
  }

  return { grid: next, moved, mergedCells };
}

function slideRowLeftGrid(g) {
  const next = cloneGrid(g);
  let moved = false;
  const mergedCells = [];

  for (let r = 0; r < SIZE; r++) {
    const result = slideRowLeft(next[r]);
    if (result.moved) moved = true;
    next[r] = result.line;
    for (const idx of result.mergedIndices) mergedCells.push([r, idx]);
  }

  return { grid: next, moved, mergedCells };
}

function slideRowRightGrid(g) {
  const next = cloneGrid(g);
  let moved = false;
  const mergedCells = [];

  for (let r = 0; r < SIZE; r++) {
    const result = slideRowRight(next[r]);
    if (result.moved) moved = true;
    next[r] = result.line;
    for (const idx of result.mergedIndices) mergedCells.push([r, idx]);
  }

  return { grid: next, moved, mergedCells };
}

function move(direction) {
  if (!playing || menuMode !== "playing") return;

  let result;
  if (direction === "left") result = slideRowLeftGrid(grid);
  else if (direction === "right") result = slideRowRightGrid(grid);
  else if (direction === "up") result = slideColUp(grid);
  else if (direction === "down") result = slideColDown(grid);
  else return;

  if (!result.moved) return;

  grid = result.grid;

  if (score > best) {
    best = score;
    saveBest();
  }
  updateHud();

  const spawned = addRandomTile();
  const newCells = spawned ? [spawned] : [];
  renderTiles(newCells, result.mergedCells);

  if (!won && hasWon()) {
    won = true;
    messageEl.textContent = "You reached 2048! Keep going for a higher score.";
  }

  if (!canMove()) {
    playing = false;
    menuMode = "gameover";
    messageEl.textContent = "No moves left.";
    showMenu("gameover", "Game Over", `Final score: ${score}. Best: ${best}.`);
  }
}

function newGame() {
  if (window.HubStreak) HubStreak.recordPlay();
  grid = emptyGrid();
  score = 0;
  won = false;
  playing = true;
  menuMode = "playing";
  messageEl.textContent = "";
  updateHud();

  const first = addRandomTile();
  const second = addRandomTile();
  const newCells = [first, second].filter(Boolean);

  overlay.classList.add("hidden");
  renderTiles(newCells);
}

function showMenu(mode, title, text) {
  menuMode = mode;
  if (mode !== "playing") playing = false;

  overlayTitle.textContent = title;
  overlayText.textContent = text;

  if (mode === "pause") {
    resumeBtn.classList.remove("hidden");
    startBtn.textContent = "New Game";
  } else {
    resumeBtn.classList.add("hidden");
    startBtn.textContent = mode === "gameover" ? "Try Again" : "New Game";
  }

  overlay.classList.remove("hidden");
}

function openPauseMenu() {
  if (menuMode !== "playing") return;
  showMenu("pause", "Menu", `Score ${score} · Best ${best}. Resume or start a new game.`);
}

function resumeGame() {
  if (menuMode !== "pause") return;
  overlay.classList.add("hidden");
  menuMode = "playing";
  playing = true;
}

function goToGames() {
  window.location.href = "../index.html#games";
}

window.addEventListener("keydown", (e) => {
  if (e.code === "Escape") {
    e.preventDefault();
    if (menuMode === "pause" && !overlay.classList.contains("hidden")) resumeGame();
    else if (menuMode === "playing") openPauseMenu();
    return;
  }

  const map = {
    ArrowLeft: "left",
    ArrowRight: "right",
    ArrowUp: "up",
    ArrowDown: "down",
    KeyA: "left",
    KeyD: "right",
    KeyW: "up",
    KeyS: "down"
  };
  const dir = map[e.code];
  if (!dir) return;
  e.preventDefault();
  move(dir);
});

boardEl.addEventListener("pointerdown", (e) => {
  touchStart = { x: e.clientX, y: e.clientY };
});

boardEl.addEventListener("pointerup", (e) => {
  if (!touchStart) return;
  const dx = e.clientX - touchStart.x;
  const dy = e.clientY - touchStart.y;
  touchStart = null;

  const min = 28;
  if (Math.abs(dx) < min && Math.abs(dy) < min) return;

  if (Math.abs(dx) > Math.abs(dy)) {
    move(dx > 0 ? "right" : "left");
  } else {
    move(dy > 0 ? "down" : "up");
  }
});

window.addEventListener("resize", () => {
  if (grid.some((row) => row.some((v) => v !== 0))) renderTiles();
});

menuBtn.addEventListener("click", () => {
  if (menuMode === "playing") openPauseMenu();
  else if (menuMode === "pause") resumeGame();
  else overlay.classList.remove("hidden");
});

startBtn.addEventListener("click", () => newGame());
resumeBtn.addEventListener("click", () => resumeGame());
gamesBtn.addEventListener("click", () => goToGames());

buildBackgroundGrid();
updateHud();
showMenu("start", "2048", "Slide tiles and merge matching numbers. Can you reach 2048?");
