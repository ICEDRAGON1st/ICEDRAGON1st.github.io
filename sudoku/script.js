const boardEl = document.getElementById("board");
const timerEl = document.getElementById("timer");
const bestEl = document.getElementById("best");
const hudDiffEl = document.getElementById("hud-diff");
const messageEl = document.getElementById("message");
const numpadEl = document.getElementById("numpad");
const notesBtn = document.getElementById("notes-btn");
const eraseBtn = document.getElementById("erase-btn");
const hintBtn = document.getElementById("hint-btn");
const overlay = document.getElementById("overlay");
const overlayTitle = document.getElementById("overlay-title");
const overlayText = document.getElementById("overlay-text");
const startBtn = document.getElementById("start-btn");
const resumeBtn = document.getElementById("resume-btn");
const viewBoardBtn = document.getElementById("view-board-btn");
const gamesBtn = document.getElementById("games-btn");
const menuBtn = document.getElementById("menu-btn");
const diffBtns = [...document.querySelectorAll(".diff-btn")];

const DIFFICULTY = {
  easy: { label: "Easy", clues: 40 },
  medium: { label: "Medium", clues: 32 },
  hard: { label: "Hard", clues: 26 }
};

const DIFF_KEY = "sudoku-difficulty";
const BEST_KEY = "sudoku-best-times";

let difficulty = loadDifficulty();
let puzzle = createEmpty();
let solution = createEmpty();
let values = createEmpty();
let notes = Array.from({ length: 9 }, () => Array.from({ length: 9 }, () => new Set()));
let fixed = createEmpty();
let hinted = createEmpty();
let selected = null;
let notesMode = false;
let running = false;
let menuMode = "start";
let seconds = 0;
let timerId = null;
let hintsUsed = 0;

function loadDifficulty() {
  const saved = localStorage.getItem(DIFF_KEY);
  return DIFFICULTY[saved] ? saved : "easy";
}

function loadBestTimes() {
  try {
    return JSON.parse(localStorage.getItem(BEST_KEY) || "{}");
  } catch {
    return {};
  }
}

function saveBestTime() {
  const best = loadBestTimes();
  const prev = best[difficulty];
  if (!prev || seconds < prev) {
    best[difficulty] = seconds;
    localStorage.setItem(BEST_KEY, JSON.stringify(best));
  }
  const values = Object.values(best).filter((n) => Number.isFinite(n) && n > 0);
  if (values.length) {
    window.HubLeaderboard?.submit("sudoku", Math.min(...values), { lowerBetter: true });
  }
}

function formatTime(totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function createEmpty() {
  return Array.from({ length: 9 }, () => Array(9).fill(0));
}

function shuffle(list) {
  const arr = [...list];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function cloneBoard(board) {
  return board.map((row) => [...row]);
}

function boxStart(index) {
  return Math.floor(index / 3) * 3;
}

function isValid(board, row, col, num) {
  for (let i = 0; i < 9; i++) {
    if (board[row][i] === num || board[i][col] === num) return false;
  }
  const br = boxStart(row);
  const bc = boxStart(col);
  for (let r = br; r < br + 3; r++) {
    for (let c = bc; c < bc + 3; c++) {
      if (board[r][c] === num) return false;
    }
  }
  return true;
}

function fillBox(board, row, col) {
  const nums = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  let i = 0;
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      board[row + r][col + c] = nums[i++];
    }
  }
}

function solveBoard(board) {
  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 9; col++) {
      if (board[row][col] !== 0) continue;
      for (const num of shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9])) {
        if (!isValid(board, row, col, num)) continue;
        board[row][col] = num;
        if (solveBoard(board)) return true;
        board[row][col] = 0;
      }
      return false;
    }
  }
  return true;
}

function generateSolution() {
  const board = createEmpty();
  for (let box = 0; box < 9; box += 3) {
    fillBox(board, box, box);
  }
  solveBoard(board);
  return board;
}

function countSolutions(board, limit = 2) {
  let count = 0;
  const state = cloneBoard(board);

  function backtrack() {
    if (count >= limit) return;
    for (let row = 0; row < 9; row++) {
      for (let col = 0; col < 9; col++) {
        if (state[row][col] !== 0) continue;
        for (let num = 1; num <= 9; num++) {
          if (!isValid(state, row, col, num)) continue;
          state[row][col] = num;
          backtrack();
          state[row][col] = 0;
        }
        return;
      }
    }
    count += 1;
  }

  backtrack();
  return count;
}

function generatePuzzle() {
  const full = generateSolution();
  const working = cloneBoard(full);
  const targetClues = DIFFICULTY[difficulty].clues;
  const positions = shuffle(
    Array.from({ length: 81 }, (_, i) => [Math.floor(i / 9), i % 9])
  );

  for (const [row, col] of positions) {
    if (countClues(working) <= targetClues) break;
    const backup = working[row][col];
    if (backup === 0) continue;
    working[row][col] = 0;
    if (countSolutions(working, 2) !== 1) {
      working[row][col] = backup;
    }
  }

  return { puzzle: working, solution: full };
}

function countClues(board) {
  return board.flat().filter((n) => n !== 0).length;
}

function stopTimer() {
  if (timerId) {
    clearInterval(timerId);
    timerId = null;
  }
}

function startTimer() {
  stopTimer();
  timerId = setInterval(() => {
    seconds += 1;
    timerEl.textContent = formatTime(seconds);
  }, 1000);
}

function updateBestDisplay() {
  const best = loadBestTimes()[difficulty];
  bestEl.textContent = best ? formatTime(best) : "—";
}

function updateHud() {
  hudDiffEl.textContent = DIFFICULTY[difficulty].label;
  timerEl.textContent = formatTime(seconds);
  updateBestDisplay();
  notesBtn.textContent = `Notes: ${notesMode ? "On" : "Off"}`;
  notesBtn.classList.toggle("active", notesMode);
}

function clearNotesAt(row, col) {
  notes[row][col] = new Set();
}

function resetNotesGrid() {
  notes = Array.from({ length: 9 }, () =>
    Array.from({ length: 9 }, () => new Set())
  );
}

function isCellCorrect(row, col) {
  const value = values[row][col];
  return value !== 0 && value === solution[row][col];
}

function isCellLocked(row, col) {
  return fixed[row][col] || isCellCorrect(row, col);
}

function isCellWrong(row, col) {
  const value = values[row][col];
  return value !== 0 && !fixed[row][col] && value !== solution[row][col];
}

function isBoardComplete() {
  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 9; col++) {
      if (values[row][col] !== solution[row][col]) return false;
    }
  }
  return true;
}

function countDigitUsage(num) {
  let count = 0;
  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 9; col++) {
      if (values[row][col] === num) count += 1;
    }
  }
  return count;
}

function renderNumpad() {
  numpadEl.innerHTML = "";
  for (let num = 1; num <= 9; num++) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "num-btn";
    btn.textContent = String(num);
    if (countDigitUsage(num) >= 9) btn.classList.add("complete");
    btn.addEventListener("click", () => inputNumber(num));
    numpadEl.appendChild(btn);
  }
}

function renderNotes(cellEl, row, col) {
  let notesEl = cellEl.querySelector(".notes-grid");
  if (!notesEl) {
    notesEl = document.createElement("div");
    notesEl.className = "notes-grid";
    cellEl.appendChild(notesEl);
  }
  notesEl.innerHTML = "";
  for (let num = 1; num <= 9; num++) {
    const note = document.createElement("span");
    note.className = "note";
    note.textContent = notes[row][col].has(num) ? String(num) : "";
    notesEl.appendChild(note);
  }
}

function renderBoard() {
  boardEl.innerHTML = "";
  const selectedValue = selected ? values[selected.row][selected.col] : 0;

  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 9; col++) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "cell";
      btn.dataset.row = String(row);
      btn.dataset.col = String(col);
      btn.setAttribute("aria-label", `Row ${row + 1}, column ${col + 1}`);

      if (col === 2 || col === 5) btn.classList.add("box-right");
      if (row === 2 || row === 5) btn.classList.add("box-bottom");

      if (fixed[row][col]) btn.classList.add("given");
      else if (isCellLocked(row, col)) btn.classList.add("locked");
      if (selected && selected.row === row && selected.col === col) btn.classList.add("selected");
      else if (
        selected &&
        (selected.row === row ||
          selected.col === col ||
          (boxStart(selected.row) === boxStart(row) && boxStart(selected.col) === boxStart(col)))
      ) {
        btn.classList.add("related");
      }

      const value = values[row][col];
      if (value !== 0 && selectedValue !== 0 && value === selectedValue) {
        btn.classList.add("same-value");
      }
      if (isCellWrong(row, col)) {
        btn.classList.add("error");
      }
      if (hinted[row][col]) btn.classList.add("hinted");

      if (value !== 0) {
        const valEl = document.createElement("span");
        valEl.className = "cell-value";
        valEl.textContent = String(value);
        btn.appendChild(valEl);
      } else if (notes[row][col].size > 0) {
        renderNotes(btn, row, col);
      }

      btn.addEventListener("click", () => selectCell(row, col));
      boardEl.appendChild(btn);
    }
  }

  renderNumpad();
}

function selectCell(row, col) {
  if (!running) return;
  selected = { row, col };
  renderBoard();
}

function inputNumber(num) {
  if (!running || !selected) return;
  const { row, col } = selected;
  if (isCellLocked(row, col)) return;

  if (notesMode) {
    if (notes[row][col].has(num)) notes[row][col].delete(num);
    else notes[row][col].add(num);
    renderBoard();
    return;
  }

  values[row][col] = num;
  clearNotesAt(row, col);
  hinted[row][col] = 0;
  messageEl.textContent = "";
  renderBoard();
  window.HubSound?.play(isCellWrong(row, col) ? "error" : "place");

  if (isBoardComplete()) {
    winGame();
  }
}

function eraseCell() {
  if (!running || !selected) return;
  const { row, col } = selected;
  if (isCellLocked(row, col)) return;

  if (notesMode) {
    notes[row][col] = new Set();
  } else {
    values[row][col] = 0;
    hinted[row][col] = 0;
  }
  renderBoard();
}

function giveHint() {
  if (!running) return;

  const emptyCells = [];
  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 9; col++) {
      if (!fixed[row][col] && values[row][col] === 0) {
        emptyCells.push([row, col]);
      }
    }
  }

  if (emptyCells.length === 0) return;

  const [row, col] = emptyCells[Math.floor(Math.random() * emptyCells.length)];
  values[row][col] = solution[row][col];
  clearNotesAt(row, col);
  hinted[row][col] = 1;
  selected = { row, col };
  hintsUsed += 1;
  renderBoard();

  if (isBoardComplete()) winGame();
}

function winGame() {
  running = false;
  stopTimer();
  saveBestTime();
  updateBestDisplay();
  if (window.HubAchievements) {
    HubAchievements.unlock("sudoku_win");
    if (difficulty === "hard") HubAchievements.unlock("sudoku_hard");
    if (hintsUsed === 0) HubAchievements.unlock("sudoku_no_hints");
  }
  window.HubSound?.play("win");
  messageEl.textContent = "Puzzle solved!";
  showMenu(
    "win",
    "Solved!",
    `Finished in ${formatTime(seconds)} with ${hintsUsed} hint${hintsUsed === 1 ? "" : "s"}.`
  );
}

function showMenu(mode, title, text) {
  menuMode = mode;
  if (mode !== "playing") {
    running = false;
    stopTimer();
  }

  overlayTitle.textContent = title;
  overlayText.textContent = text;

  diffBtns.forEach((btn) => btn.classList.toggle("active", btn.dataset.diff === difficulty));

  if (mode === "pause") {
    resumeBtn.classList.remove("hidden");
    viewBoardBtn?.classList.add("hidden");
    startBtn.textContent = "New Game";
  } else if (mode === "win") {
    resumeBtn.classList.add("hidden");
    viewBoardBtn?.classList.remove("hidden");
    startBtn.textContent = "Play Again";
  } else {
    resumeBtn.classList.add("hidden");
    viewBoardBtn?.classList.add("hidden");
    startBtn.textContent = "New Game";
  }

  overlay.classList.remove("hidden");
}


function viewBoard() {
  if (menuMode !== "win") return;
  overlay.classList.add("hidden");
  if (messageEl && !/menu/i.test(messageEl.textContent || "")) {
    const base = (messageEl.textContent || "").trim();
    messageEl.textContent = base ? `${base} · Tap Menu for Play Again.` : "Tap Menu to return to the result screen.";
  }
}

function openPauseMenu() {
  if (!running || menuMode === "win") return;
  showMenu(
    "pause",
    "Menu",
    `${DIFFICULTY[difficulty].label} · ${formatTime(seconds)} elapsed. Resume, start a new puzzle, or go back to Games.`
  );
}

function startGame() {
  if (window.HubStreak) HubStreak.recordPlay();
  if (window.HubPlays) HubPlays.record("sudoku");
  const generated = generatePuzzle();
  puzzle = generated.puzzle;
  solution = generated.solution;
  values = cloneBoard(puzzle);
  fixed = puzzle.map((row) => row.map((n) => (n !== 0 ? 1 : 0)));
  hinted = createEmpty();
  resetNotesGrid();
  selected = null;
  notesMode = false;
  seconds = 0;
  hintsUsed = 0;
  messageEl.textContent = "";

  overlay.classList.add("hidden");
  menuMode = "playing";
  running = true;
  updateHud();
  renderBoard();
  startTimer();
}

function resumeGame() {
  if (menuMode !== "pause") return;
  overlay.classList.add("hidden");
  menuMode = "playing";
  running = true;
  startTimer();
  renderBoard();
}

function goToGames() {
  window.location.href = "../index.html#games";
}

diffBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    if (running && menuMode === "playing") return;
    difficulty = btn.dataset.diff;
    localStorage.setItem(DIFF_KEY, difficulty);
    diffBtns.forEach((b) => b.classList.toggle("active", b === btn));
    updateHud();
  });
});

notesBtn.addEventListener("click", () => {
  notesMode = !notesMode;
  updateHud();
});

eraseBtn.addEventListener("click", () => eraseCell());
hintBtn.addEventListener("click", () => giveHint());

menuBtn.addEventListener("click", () => {
  if (menuMode === "win") {
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

  if (!running) return;

  if (e.code === "Backspace" || e.code === "Delete" || e.code === "Digit0" || e.code === "Numpad0") {
    e.preventDefault();
    eraseCell();
    return;
  }

  const digitMatch = e.code.match(/^(?:Digit|Numpad)([1-9])$/);
  if (digitMatch) {
    e.preventDefault();
    inputNumber(Number(digitMatch[1]));
    return;
  }

  const moveMap = {
    ArrowUp: [-1, 0],
    ArrowDown: [1, 0],
    ArrowLeft: [0, -1],
    ArrowRight: [0, 1]
  };

  if (moveMap[e.code]) {
    e.preventDefault();
    const [dr, dc] = moveMap[e.code];
    const start = selected || { row: 4, col: 4 };
    const row = Math.min(8, Math.max(0, start.row + dr));
    const col = Math.min(8, Math.max(0, start.col + dc));
    selectCell(row, col);
  }
});

updateHud();
showMenu(
  "start",
  "Sudoku",
  "Classic 9×9 logic puzzle. Each digit appears once per row, column, and box."
);
