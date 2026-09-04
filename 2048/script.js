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
const viewBoardBtn = document.getElementById("view-board-btn");
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
let animating = false;
const MOVE_MS = 160;

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

function positionTile(tile, r, c, metrics = cellMetrics()) {
  const { gap, cell } = metrics;
  tile.style.width = `${cell}px`;
  tile.style.height = `${cell}px`;
  tile.style.left = `${c * (cell + gap)}px`;
  tile.style.top = `${r * (cell + gap)}px`;
}

function styleTile(tile, value) {
  const colors = TILE_COLORS[value] || { bg: "#3c3a32", fg: "#f9f6f2" };
  tile.style.background = colors.bg;
  tile.style.color = colors.fg;
  tile.style.fontSize = tileFontSize(value);
  tile.textContent = String(value);
}

function createTileEl(value, r, c, extraClass = "") {
  const tile = document.createElement("div");
  tile.className = extraClass ? `tile ${extraClass}` : "tile";
  styleTile(tile, value);
  positionTile(tile, r, c);
  return tile;
}

function renderTiles(newCells = [], mergedCells = []) {
  tilesEl.innerHTML = "";
  const newSet = new Set(newCells.map(([r, c]) => `${r},${c}`));
  const mergedSet = new Set(mergedCells.map(([r, c]) => `${r},${c}`));
  const metrics = cellMetrics();

  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const value = grid[r][c];
      if (!value) continue;
      const key = `${r},${c}`;
      const cls = [
        newSet.has(key) ? "new" : "",
        mergedSet.has(key) ? "merged" : ""
      ]
        .filter(Boolean)
        .join(" ");
      const tile = createTileEl(value, r, c, cls);
      positionTile(tile, r, c, metrics);
      tilesEl.appendChild(tile);
    }
  }
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

function slideLineTracked(line) {
  // line: values; returns travels from old index -> new index
  const items = [];
  for (let i = 0; i < line.length; i++) {
    if (line[i]) items.push({ value: line[i], from: i });
  }

  const out = Array(SIZE).fill(0);
  const travels = []; // { from, to, value, merging }
  const mergedIndices = [];
  let write = 0;

  for (let i = 0; i < items.length; ) {
    if (i + 1 < items.length && items[i].value === items[i + 1].value) {
      const value = items[i].value * 2;
      out[write] = value;
      score += value;
      mergedIndices.push(write);
      travels.push({
        from: items[i].from,
        to: write,
        value: items[i].value,
        merging: true
      });
      travels.push({
        from: items[i + 1].from,
        to: write,
        value: items[i + 1].value,
        merging: true
      });
      write += 1;
      i += 2;
    } else {
      out[write] = items[i].value;
      travels.push({
        from: items[i].from,
        to: write,
        value: items[i].value,
        merging: false
      });
      write += 1;
      i += 1;
    }
  }

  const moved = out.some((v, i) => v !== line[i]);
  return { line: out, moved, mergedIndices, travels };
}

function slideBoard(g, direction) {
  const next = emptyGrid();
  let moved = false;
  const mergedCells = [];
  const travels = []; // { fr, fc, tr, tc, value, merging }

  const pushTravel = (fr, fc, tr, tc, value, merging) => {
    travels.push({ fr, fc, tr, tc, value, merging });
  };

  if (direction === "left" || direction === "right") {
    for (let r = 0; r < SIZE; r++) {
      const row = [...g[r]];
      const source = direction === "right" ? [...row].reverse() : row;
      const result = slideLineTracked(source);
      if (result.moved) moved = true;

      const mappedLine =
        direction === "right" ? [...result.line].reverse() : result.line;
      next[r] = mappedLine;

      for (const idx of result.mergedIndices) {
        const c = direction === "right" ? SIZE - 1 - idx : idx;
        mergedCells.push([r, c]);
      }

      for (const t of result.travels) {
        const fc = direction === "right" ? SIZE - 1 - t.from : t.from;
        const tc = direction === "right" ? SIZE - 1 - t.to : t.to;
        pushTravel(r, fc, r, tc, t.value, t.merging);
      }
    }
  } else {
    for (let c = 0; c < SIZE; c++) {
      const col = [];
      for (let r = 0; r < SIZE; r++) col.push(g[r][c]);
      const source = direction === "down" ? [...col].reverse() : col;
      const result = slideLineTracked(source);
      if (result.moved) moved = true;

      for (let i = 0; i < SIZE; i++) {
        const r = direction === "down" ? SIZE - 1 - i : i;
        next[r][c] = result.line[i];
      }

      for (const idx of result.mergedIndices) {
        const r = direction === "down" ? SIZE - 1 - idx : idx;
        mergedCells.push([r, c]);
      }

      for (const t of result.travels) {
        const fr = direction === "down" ? SIZE - 1 - t.from : t.from;
        const tr = direction === "down" ? SIZE - 1 - t.to : t.to;
        pushTravel(fr, c, tr, c, t.value, t.merging);
      }
    }
  }

  return { grid: next, moved, mergedCells, travels };
}

function animateTravels(travels) {
  tilesEl.innerHTML = "";
  const metrics = cellMetrics();
  const els = travels.map((t) => {
    const tile = createTileEl(t.value, t.fr, t.fc);
    tile.style.transition = "none";
    positionTile(tile, t.fr, t.fc, metrics);
    tilesEl.appendChild(tile);
    return { tile, t };
  });

  // Force layout, then slide to destinations
  void tilesEl.offsetWidth;
  requestAnimationFrame(() => {
    els.forEach(({ tile, t }) => {
      tile.style.transition = `top ${MOVE_MS}ms ease, left ${MOVE_MS}ms ease`;
      positionTile(tile, t.tr, t.tc, metrics);
    });
  });
}

async function move(direction) {
  if (!playing || menuMode !== "playing" || animating) return;

  const result = slideBoard(grid, direction);
  if (!result.moved) return;

  animating = true;
  window.HubSound?.play(result.mergedCells?.length ? "merge" : "place");
  animateTravels(result.travels);
  await delay(MOVE_MS + 20);

  grid = result.grid;
  if (window.HubAchievements) {
    const maxTile = Math.max(...grid.flat());
    if (maxTile >= 512) HubAchievements.unlock("2048_tile_512");
    if (maxTile >= 1024) HubAchievements.unlock("2048_tile_1024");
    if (maxTile >= 4096) HubAchievements.unlock("2048_tile_4096");
  }
  if (score > best) {
    best = score;
    saveBest();
  }
  if (best > 0) window.HubLeaderboard?.submit("2048", best);
  updateHud();

  const spawned = addRandomTile();
  const newCells = spawned ? [spawned] : [];
  renderTiles(newCells, result.mergedCells);
  animating = false;

  if (!won && hasWon()) {
    won = true;
    if (window.HubAchievements) HubAchievements.unlock("2048_tile_2048");
    window.HubSound?.play("win");
    messageEl.textContent = "You reached 2048! Keep going for a higher score.";
  }

  if (!canMove()) {
    playing = false;
    menuMode = "gameover";
    messageEl.textContent = "No moves left.";
    window.HubSound?.play("lose");
    showMenu("gameover", "Game Over", `Final score: ${score}. Best: ${best}.`);
  }
}

function newGame() {
  if (window.HubStreak) HubStreak.recordPlay();
  if (window.HubPlays) HubPlays.record("2048");
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
    viewBoardBtn?.classList.add("hidden");
    startBtn.textContent = "New Game";
  } else if (mode === "gameover") {
    resumeBtn.classList.add("hidden");
    viewBoardBtn?.classList.remove("hidden");
    startBtn.textContent = "Try Again";
  } else {
    resumeBtn.classList.add("hidden");
    viewBoardBtn?.classList.add("hidden");
    startBtn.textContent = "New Game";
  }

  overlay.classList.remove("hidden");
}

function viewBoard() {
  if (menuMode !== "gameover") return;
  overlay.classList.add("hidden");
  if (!messageEl.textContent) {
    messageEl.textContent = "Tap Menu to return to the result screen.";
  } else if (!/menu/i.test(messageEl.textContent)) {
    messageEl.textContent = `${messageEl.textContent} · Tap Menu for Try Again.`;
  }
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
    if (menuMode === "gameover") {
      overlay.classList.toggle("hidden");
      return;
    }
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
  if (menuMode === "gameover") {
    overlay.classList.remove("hidden");
    return;
  }
  if (menuMode === "playing") openPauseMenu();
  else if (menuMode === "pause") resumeGame();
  else overlay.classList.remove("hidden");
});

startBtn.addEventListener("click", () => newGame());
resumeBtn.addEventListener("click", () => resumeGame());
viewBoardBtn?.addEventListener("click", () => viewBoard());
gamesBtn.addEventListener("click", () => goToGames());

buildBackgroundGrid();
updateHud();
showMenu("start", "2048", "Slide tiles and merge matching numbers. Can you reach 2048?");
