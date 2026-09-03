const boardEl = document.getElementById("board");
const turnLabel = document.getElementById("turn-label");
const hudModeEl = document.getElementById("hud-mode");
const recordEl = document.getElementById("record");
const recordWrap = document.getElementById("record-wrap");
const messageEl = document.getElementById("message");
const overlay = document.getElementById("overlay");
const overlayTitle = document.getElementById("overlay-title");
const overlayText = document.getElementById("overlay-text");
const startBtn = document.getElementById("start-btn");
const resumeBtn = document.getElementById("resume-btn");
const gamesBtn = document.getElementById("games-btn");
const menuBtn = document.getElementById("menu-btn");
const modeBtns = [...document.querySelectorAll("#mode-picker .pick-btn")];
const diffBtns = [...document.querySelectorAll("#difficulty-picker .pick-btn")];
const difficultyPicker = document.getElementById("difficulty-picker");

const ROWS = 6;
const COLS = 7;
const EMPTY = 0;
const RED = 1;
const YELLOW = 2;
const STATS_KEY = "connect-four-stats";

const PLAYER = {
  [RED]: { name: "Red", className: "red" },
  [YELLOW]: { name: "Yellow", className: "yellow" }
};

const DIRS = [
  [0, 1],
  [1, 0],
  [1, 1],
  [1, -1]
];

const CENTER_ORDER = [3, 2, 4, 1, 5, 0, 6];

let board = [];
let current = RED;
let mode = "two";
let difficulty = "easy";
let running = false;
let menuMode = "start";
let winningCells = [];
let thinking = false;

function loadStats() {
  try {
    return JSON.parse(localStorage.getItem(STATS_KEY) || "{}");
  } catch {
    return {};
  }
}

function saveStats(stats) {
  localStorage.setItem(STATS_KEY, JSON.stringify(stats));
}

function createBoard() {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(EMPTY));
}

function getValidColumns(state = board) {
  const cols = [];
  for (let c = 0; c < COLS; c++) {
    if (state[0][c] === EMPTY) cols.push(c);
  }
  return cols;
}

function dropInColumn(state, col, player) {
  for (let r = ROWS - 1; r >= 0; r--) {
    if (state[r][col] === EMPTY) {
      state[r][col] = player;
      return r;
    }
  }
  return -1;
}

function inBounds(row, col) {
  return row >= 0 && row < ROWS && col >= 0 && col < COLS;
}

function findWinningCells(state, row, col, player) {
  for (const [dr, dc] of DIRS) {
    const cells = [{ row, col }];

    let r = row + dr;
    let c = col + dc;
    while (inBounds(r, c) && state[r][c] === player) {
      cells.push({ row: r, col: c });
      r += dr;
      c += dc;
    }

    r = row - dr;
    c = col - dc;
    while (inBounds(r, c) && state[r][c] === player) {
      cells.unshift({ row: r, col: c });
      r -= dr;
      c -= dc;
    }

    if (cells.length >= 4) {
      return cells.slice(0, 4);
    }
  }
  return null;
}

function getWinner(state) {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const player = state[r][c];
      if (player === EMPTY) continue;
      if (findWinningCells(state, r, c, player)) return player;
    }
  }
  return null;
}

function isDraw(state) {
  return getValidColumns(state).length === 0 && !getWinner(state);
}

function cloneBoard(state) {
  return state.map((row) => [...row]);
}

function updateRecordDisplay() {
  if (mode === "two") {
    recordWrap.classList.add("hidden");
    return;
  }

  recordWrap.classList.remove("hidden");
  const stats = loadStats();
  const diffStats = stats[difficulty] || { wins: 0, losses: 0, draws: 0 };
  recordEl.textContent = `${diffStats.wins}W · ${diffStats.losses}L · ${diffStats.draws}D`;
}

function updateHud() {
  const player = PLAYER[current];
  turnLabel.textContent = player.name;
  turnLabel.className = player.className;
  hudModeEl.textContent = mode === "two" ? "2 Player" : `vs CPU (${difficulty})`;
  updateRecordDisplay();
}

function renderBoard() {
  boardEl.innerHTML = "";

  for (let c = 0; c < COLS; c++) {
    const colBtn = document.createElement("button");
    colBtn.type = "button";
    colBtn.className = "column";
    colBtn.dataset.col = String(c);
    colBtn.setAttribute("aria-label", `Column ${c + 1}`);
    colBtn.disabled = !running || thinking || board[0][c] !== EMPTY;

    for (let r = 0; r < ROWS; r++) {
      const cell = document.createElement("div");
      cell.className = "cell";
      cell.dataset.row = String(r);
      cell.dataset.col = String(c);

      const isWin = winningCells.some((w) => w.row === r && w.col === c);
      if (isWin) cell.classList.add("win");

      const value = board[r][c];
      if (value !== EMPTY) {
        const disc = document.createElement("div");
        disc.className = `disc ${PLAYER[value].className}`;
        cell.appendChild(disc);
      }

      colBtn.appendChild(cell);
    }

    colBtn.addEventListener("click", () => playColumn(c));
    boardEl.appendChild(colBtn);
  }
}

function showMenu(kind, title, text) {
  menuMode = kind;
  if (kind !== "playing") running = false;

  overlayTitle.textContent = title;
  overlayText.textContent = text;

  modeBtns.forEach((btn) => btn.classList.toggle("active", btn.dataset.mode === mode));
  diffBtns.forEach((btn) => btn.classList.toggle("active", btn.dataset.diff === difficulty));
  difficultyPicker.classList.toggle("hidden", mode !== "cpu");

  if (kind === "pause") {
    resumeBtn.classList.remove("hidden");
    startBtn.textContent = "New Game";
  } else {
    resumeBtn.classList.add("hidden");
    startBtn.textContent = kind === "over" ? "Play Again" : "New Game";
  }

  overlay.classList.remove("hidden");
  renderBoard();
}

function openPauseMenu() {
  if (!running || menuMode === "over") return;
  showMenu("pause", "Menu", "Resume, start a new game, or go back to Games.");
}

function resetGame() {
  board = createBoard();
  current = RED;
  winningCells = [];
  thinking = false;
  messageEl.textContent = "";
  updateHud();
  renderBoard();
}

function startGame() {
  if (window.HubStreak) HubStreak.recordPlay();
  resetGame();
  overlay.classList.add("hidden");
  menuMode = "playing";
  running = true;
  renderBoard();
}

function resumeGame() {
  if (menuMode !== "pause") return;
  overlay.classList.add("hidden");
  menuMode = "playing";
  running = true;
  renderBoard();
}

function goToGames() {
  window.location.href = "../index.html#games";
}

function recordCpuResult(result) {
  const stats = loadStats();
  if (!stats[difficulty]) stats[difficulty] = { wins: 0, losses: 0, draws: 0 };
  stats[difficulty][result] += 1;
  saveStats(stats);
  updateRecordDisplay();
}

function endGame(winner, isDrawGame) {
  running = false;
  menuMode = "over";

  if (isDrawGame) {
    messageEl.textContent = "It's a draw!";
    if (mode === "cpu") recordCpuResult("draws");
    window.HubSound?.play("draw");
    showMenu("over", "Draw", "The board is full with no winner.");
    return;
  }

  const player = PLAYER[winner];
  messageEl.textContent = `${player.name} wins!`;

  if (mode === "cpu") {
    if (winner === RED) recordCpuResult("wins");
    else recordCpuResult("losses");
  }

  if (window.HubAchievements) HubAchievements.unlock("connect4_win");
  window.HubSound?.play("win");
  showMenu("over", `${player.name} Wins!`, `${player.name} connected four in a row.`);
}

function applyMove(col, player) {
  const row = dropInColumn(board, col, player);
  if (row < 0) return false;
  window.HubSound?.play("place");

  const winCells = findWinningCells(board, row, col, player);
  if (winCells) {
    winningCells = winCells;
    renderBoard();
    endGame(player, false);
    return true;
  }

  if (isDraw(board)) {
    renderBoard();
    endGame(null, true);
    return true;
  }

  current = player === RED ? YELLOW : RED;
  updateHud();
  renderBoard();
  return true;
}

function pickWinningMove(state, player) {
  for (const col of getValidColumns(state)) {
    const next = cloneBoard(state);
    const row = dropInColumn(next, col, player);
    if (row >= 0 && findWinningCells(next, row, col, player)) return col;
  }
  return null;
}

function pickMediumMove() {
  const win = pickWinningMove(board, YELLOW);
  if (win !== null) return win;

  const block = pickWinningMove(board, RED);
  if (block !== null) return block;

  const valid = new Set(getValidColumns());
  for (const col of CENTER_ORDER) {
    if (valid.has(col)) return col;
  }

  const cols = getValidColumns();
  return cols[Math.floor(Math.random() * cols.length)];
}

function evaluateWindow(windowCells, ai, human) {
  let aiCount = 0;
  let humanCount = 0;
  let empty = 0;

  for (const cell of windowCells) {
    if (cell === ai) aiCount += 1;
    else if (cell === human) humanCount += 1;
    else empty += 1;
  }

  if (aiCount > 0 && humanCount > 0) return 0;
  if (aiCount === 4) return 100000;
  if (humanCount === 4) return -100000;
  if (aiCount === 3 && empty === 1) return 120;
  if (humanCount === 3 && empty === 1) return -140;
  if (aiCount === 2 && empty === 2) return 12;
  if (humanCount === 2 && empty === 2) return -14;
  return 0;
}

function scoreBoard(state, ai, human) {
  let score = 0;

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c <= COLS - 4; c++) {
      score += evaluateWindow(
        [state[r][c], state[r][c + 1], state[r][c + 2], state[r][c + 3]],
        ai,
        human
      );
    }
  }

  for (let c = 0; c < COLS; c++) {
    for (let r = 0; r <= ROWS - 4; r++) {
      score += evaluateWindow(
        [state[r][c], state[r + 1][c], state[r + 2][c], state[r + 3][c]],
        ai,
        human
      );
    }
  }

  for (let r = 0; r <= ROWS - 4; r++) {
    for (let c = 0; c <= COLS - 4; c++) {
      score += evaluateWindow(
        [state[r][c], state[r + 1][c + 1], state[r + 2][c + 2], state[r + 3][c + 3]],
        ai,
        human
      );
    }
  }

  for (let r = 3; r < ROWS; r++) {
    for (let c = 0; c <= COLS - 4; c++) {
      score += evaluateWindow(
        [state[r][c], state[r - 1][c + 1], state[r - 2][c + 2], state[r - 3][c + 3]],
        ai,
        human
      );
    }
  }

  for (const col of CENTER_ORDER) {
    if (state[ROWS - 1][col] === ai) score += 4;
    if (state[ROWS - 1][col] === human) score -= 4;
  }

  return score;
}

function minimax(state, depth, alpha, beta, maximizing, ai, human) {
  const winner = getWinner(state);
  if (winner === ai) return 100000 + depth;
  if (winner === human) return -100000 - depth;
  if (isDraw(state) || depth === 0) return scoreBoard(state, ai, human);

  const cols = getValidColumns(state);
  const ordered = CENTER_ORDER.filter((c) => cols.includes(c)).concat(
    cols.filter((c) => !CENTER_ORDER.includes(c))
  );

  if (maximizing) {
    let value = -Infinity;
    for (const col of ordered) {
      const next = cloneBoard(state);
      dropInColumn(next, col, ai);
      value = Math.max(value, minimax(next, depth - 1, alpha, beta, false, ai, human));
      alpha = Math.max(alpha, value);
      if (alpha >= beta) break;
    }
    return value;
  }

  let value = Infinity;
  for (const col of ordered) {
    const next = cloneBoard(state);
    dropInColumn(next, col, human);
    value = Math.min(value, minimax(next, depth - 1, alpha, beta, true, ai, human));
    beta = Math.min(beta, value);
    if (alpha >= beta) break;
  }
  return value;
}

function pickHardMove() {
  const win = pickWinningMove(board, YELLOW);
  if (win !== null) return win;

  const block = pickWinningMove(board, RED);
  if (block !== null) return block;

  let bestCol = CENTER_ORDER.find((c) => board[0][c] === EMPTY) ?? 0;
  let bestScore = -Infinity;
  const cols = getValidColumns();

  for (const col of cols) {
    const next = cloneBoard(board);
    dropInColumn(next, col, YELLOW);
    const score = minimax(next, 6, -Infinity, Infinity, false, YELLOW, RED);
    if (score > bestScore) {
      bestScore = score;
      bestCol = col;
    }
  }

  return bestCol;
}

function pickCpuMove() {
  if (difficulty === "easy") {
    const cols = getValidColumns();
    return cols[Math.floor(Math.random() * cols.length)];
  }
  if (difficulty === "medium") return pickMediumMove();
  return pickHardMove();
}

function maybeCpuTurn() {
  if (!running || mode !== "cpu" || current !== YELLOW) return;

  thinking = true;
  renderBoard();

  window.setTimeout(() => {
    if (!running || current !== YELLOW) {
      thinking = false;
      renderBoard();
      return;
    }

    const col = pickCpuMove();
    thinking = false;
    applyMove(col, YELLOW);
  }, 450);
}

function playColumn(col) {
  if (!running || thinking || board[0][col] !== EMPTY) return;
  if (mode === "cpu" && current !== RED) return;

  applyMove(col, current);
  if (running) maybeCpuTurn();
}

modeBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    if (running && menuMode === "playing") return;
    mode = btn.dataset.mode;
    modeBtns.forEach((b) => b.classList.toggle("active", b === btn));
    difficultyPicker.classList.toggle("hidden", mode !== "cpu");
    updateRecordDisplay();
  });
});

diffBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    if (running && menuMode === "playing") return;
    difficulty = btn.dataset.diff;
    diffBtns.forEach((b) => b.classList.toggle("active", b === btn));
    updateRecordDisplay();
  });
});

window.addEventListener("keydown", (e) => {
  if (e.code === "Escape") {
    e.preventDefault();
    if (menuMode === "pause" && !overlay.classList.contains("hidden")) resumeGame();
    else if (running) openPauseMenu();
    else overlay.classList.remove("hidden");
    return;
  }

  if (!running || thinking) return;

  const colMap = {
    Digit1: 0, Digit2: 1, Digit3: 2, Digit4: 3, Digit5: 4, Digit6: 5, Digit7: 6,
    Numpad1: 0, Numpad2: 1, Numpad3: 2, Numpad4: 3, Numpad5: 4, Numpad6: 5, Numpad7: 6
  };

  const col = colMap[e.code];
  if (col !== undefined) {
    e.preventDefault();
    playColumn(col);
  }
});

menuBtn.addEventListener("click", () => {
  if (running) openPauseMenu();
  else if (menuMode === "pause") resumeGame();
  else overlay.classList.remove("hidden");
});

startBtn.addEventListener("click", () => startGame());
resumeBtn.addEventListener("click", () => resumeGame());
gamesBtn.addEventListener("click", () => goToGames());

updateHud();
renderBoard();
showMenu(
  "start",
  "Connect Four",
  "Drop discs and connect four in a row — horizontal, vertical, or diagonal."
);
