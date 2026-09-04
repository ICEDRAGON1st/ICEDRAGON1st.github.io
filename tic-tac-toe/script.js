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
const viewBoardBtn = document.getElementById("view-board-btn");
const gamesBtn = document.getElementById("games-btn");
const menuBtn = document.getElementById("menu-btn");
const modeBtns = [...document.querySelectorAll("#mode-picker .pick-btn")];
const diffBtns = [...document.querySelectorAll("#difficulty-picker .pick-btn")];
const difficultyPicker = document.getElementById("difficulty-picker");

const EMPTY = 0;
const X = 1;
const O = 2;
const STATS_KEY = "tic-tac-toe-stats";

const WIN_LINES = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6]
];

const PLAYER = {
  [X]: { label: "X", className: "x" },
  [O]: { label: "O", className: "o" }
};

let board = Array(9).fill(EMPTY);
let current = X;
let mode = "two";
let difficulty = "easy";
let running = false;
let menuMode = "start";
let winLine = null;
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

function updateRecordDisplay() {
  if (mode === "two") {
    recordWrap.classList.add("hidden");
    return;
  }

  recordWrap.classList.remove("hidden");
  const stats = loadStats()[difficulty] || { wins: 0, losses: 0, draws: 0 };
  recordEl.textContent = `${stats.wins}W · ${stats.losses}L · ${stats.draws}D`;
}

function updateHud() {
  const player = PLAYER[current];
  turnLabel.textContent = player.label;
  turnLabel.className = player.className;
  hudModeEl.textContent = mode === "two" ? "2 Player" : `vs CPU (${difficulty})`;
  updateRecordDisplay();
}

function getWinner(state) {
  for (const [a, b, c] of WIN_LINES) {
    if (state[a] !== EMPTY && state[a] === state[b] && state[b] === state[c]) {
      return { winner: state[a], line: [a, b, c] };
    }
  }
  return null;
}

function isDraw(state) {
  return !getWinner(state) && state.every((cell) => cell !== EMPTY);
}

function emptyCells(state) {
  return state.map((v, i) => (v === EMPTY ? i : null)).filter((i) => i !== null);
}

function renderBoard() {
  boardEl.innerHTML = "";

  for (let i = 0; i < 9; i++) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "cell";
    btn.dataset.index = String(i);
    btn.setAttribute("aria-label", `Cell ${i + 1}`);

    const value = board[i];
    if (value !== EMPTY) {
      btn.textContent = PLAYER[value].label;
      btn.classList.add(PLAYER[value].className);
    }

    if (winLine && winLine.includes(i)) {
      btn.classList.add("win");
    }

    btn.disabled = !running || thinking || value !== EMPTY;
    btn.addEventListener("click", () => playMove(i));
    boardEl.appendChild(btn);
  }
}

function recordCpuResult(result) {
  const stats = loadStats();
  if (!stats[difficulty]) stats[difficulty] = { wins: 0, losses: 0, draws: 0 };
  stats[difficulty][result] += 1;
  saveStats(stats);
  updateRecordDisplay();
  let wins = 0;
  for (const entry of Object.values(stats || {})) wins += entry.wins || 0;
  if (wins > 0) window.HubLeaderboard?.submit("tictactoe", wins);
}

function endGame(result) {
  running = false;
  menuMode = "over";

  if (result.type === "win") {
    messageEl.textContent = `${PLAYER[result.winner].label} wins!`;
    if (mode === "cpu") {
      if (result.winner === X) {
        recordCpuResult("wins");
        if (window.HubAchievements) {
          HubAchievements.unlock("tictactoe_win");
          if (difficulty === "hard") HubAchievements.unlock("tictactoe_hard");
        }
      } else recordCpuResult("losses");
    }
    showMenu("over", `${PLAYER[result.winner].label} Wins!`, `${PLAYER[result.winner].label} got three in a row.`);
    window.HubSound?.play("win");
    return;
  }

  messageEl.textContent = "It's a draw!";
  if (mode === "cpu") recordCpuResult("draws");
  window.HubSound?.play("draw");
  showMenu("over", "Draw", "No more moves — it's a tie.");
}

function applyMove(index, player) {
  if (board[index] !== EMPTY) return false;

  board[index] = player;
  window.HubSound?.play("place");
  const result = getWinner(board);
  if (result) {
    winLine = result.line;
    renderBoard();
    endGame({ type: "win", winner: result.winner });
    return true;
  }

  if (isDraw(board)) {
    renderBoard();
    endGame({ type: "draw" });
    return true;
  }

  current = player === X ? O : X;
  updateHud();
  renderBoard();
  return true;
}

function pickWinningMove(state, player) {
  for (const index of emptyCells(state)) {
    const next = [...state];
    next[index] = player;
    if (getWinner(next)?.winner === player) return index;
  }
  return null;
}

function pickEasyMove() {
  const cells = emptyCells(board);
  return cells[Math.floor(Math.random() * cells.length)];
}

function pickMediumMove() {
  const win = pickWinningMove(board, O);
  if (win !== null) return win;

  const block = pickWinningMove(board, X);
  if (block !== null) return block;

  if (board[4] === EMPTY) return 4;

  const corners = shuffle([0, 2, 6, 8].filter((i) => board[i] === EMPTY));
  if (corners.length) return corners[0];

  return pickEasyMove();
}

function minimax(state, player, ai, human) {
  const outcome = getWinner(state);
  if (outcome?.winner === ai) return 10;
  if (outcome?.winner === human) return -10;
  if (isDraw(state)) return 0;

  const moves = emptyCells(state);
  if (player === ai) {
    let best = -Infinity;
    for (const move of moves) {
      const next = [...state];
      next[move] = ai;
      best = Math.max(best, minimax(next, human, ai, human));
    }
    return best;
  }

  let best = Infinity;
  for (const move of moves) {
    const next = [...state];
    next[move] = human;
    best = Math.min(best, minimax(next, ai, ai, human));
  }
  return best;
}

function pickHardMove() {
  // Still strong: always take an instant win.
  const win = pickWinningMove(board, O);
  if (win !== null) return win;

  // Usually block, but sometimes miss (~15%) so the player can finish.
  const block = pickWinningMove(board, X);
  if (block !== null && Math.random() > 0.15) return block;

  const scored = emptyCells(board).map((move) => {
    const next = [...board];
    next[move] = O;
    return { move, score: minimax(next, X, O, X) };
  });
  scored.sort((a, b) => b.score - a.score || Math.random() - 0.5);

  // ~40% of the time, pick among the top few moves instead of perfect play.
  if (scored.length > 1 && Math.random() < 0.4) {
    const pool = scored.slice(0, Math.min(3, scored.length));
    return pool[Math.floor(Math.random() * pool.length)].move;
  }

  return scored[0].move;
}

function shuffle(list) {
  const arr = [...list];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function pickCpuMove() {
  if (difficulty === "easy") return pickEasyMove();
  if (difficulty === "medium") return pickMediumMove();
  return pickHardMove();
}

function maybeCpuTurn() {
  if (!running || mode !== "cpu" || current !== O) return;

  thinking = true;
  renderBoard();

  window.setTimeout(() => {
    if (!running || current !== O) {
      thinking = false;
      renderBoard();
      return;
    }

    const move = pickCpuMove();
    thinking = false;
    applyMove(move, O);
  }, 350);
}

function playMove(index) {
  if (!running || thinking || board[index] !== EMPTY) return;
  if (mode === "cpu" && current !== X) return;

  applyMove(index, current);
  if (running) maybeCpuTurn();
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
    viewBoardBtn?.classList.add("hidden");
    startBtn.textContent = "New Game";
  } else if (kind === "over") {
    resumeBtn.classList.add("hidden");
    viewBoardBtn?.classList.remove("hidden");
    startBtn.textContent = "Play Again";
  } else {
    resumeBtn.classList.add("hidden");
    viewBoardBtn?.classList.add("hidden");
    startBtn.textContent = "New Game";
  }

  overlay.classList.remove("hidden");
  renderBoard();
}

function viewBoard() {
  if (menuMode !== "over") return;
  overlay.classList.add("hidden");
  renderBoard();
  if (!/menu/i.test(messageEl.textContent || "")) {
    messageEl.textContent = `${messageEl.textContent || "Game over"} · Tap Menu for Play Again.`;
  }
}

function openPauseMenu() {
  if (menuMode === "over") {
    overlay.classList.remove("hidden");
    return;
  }
  if (!running) return;
  showMenu("pause", "Menu", "Resume, start a new game, or go back to Games.");
}

function startGame() {
  if (window.HubStreak) HubStreak.recordPlay();
  if (window.HubPlays) HubPlays.record("tictactoe");
  board = Array(9).fill(EMPTY);
  current = X;
  winLine = null;
  thinking = false;
  messageEl.textContent = "";

  overlay.classList.add("hidden");
  menuMode = "playing";
  running = true;
  updateHud();
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

window.addEventListener("keydown", (e) => {
  if (e.code === "Escape") {
    e.preventDefault();
    if (menuMode === "pause" && !overlay.classList.contains("hidden")) resumeGame();
    else if (running) openPauseMenu();
    else overlay.classList.remove("hidden");
    return;
  }

  if (!running || thinking) return;

  const keyMap = {
    Digit1: 0, Digit2: 1, Digit3: 2,
    Digit4: 3, Digit5: 4, Digit6: 5,
    Digit7: 6, Digit8: 7, Digit9: 8,
    Numpad1: 0, Numpad2: 1, Numpad3: 2,
    Numpad4: 3, Numpad5: 4, Numpad6: 5,
    Numpad7: 6, Numpad8: 7, Numpad9: 8
  };

  const index = keyMap[e.code];
  if (index !== undefined) {
    e.preventDefault();
    playMove(index);
  }
});

updateHud();
renderBoard();
showMenu(
  "start",
  "Tic Tac Toe",
  "Take turns placing X and O. First to three in a row wins."
);
