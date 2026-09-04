const boardEl = document.getElementById("board");
const movesEl = document.getElementById("moves");
const timerEl = document.getElementById("timer");
const bestEl = document.getElementById("best");
const hudDiffEl = document.getElementById("hud-diff");
const messageEl = document.getElementById("message");
const overlay = document.getElementById("overlay");
const overlayTitle = document.getElementById("overlay-title");
const overlayText = document.getElementById("overlay-text");
const startBtn = document.getElementById("start-btn");
const resumeBtn = document.getElementById("resume-btn");
const viewBoardBtn = document.getElementById("view-board-btn");
const gamesBtn = document.getElementById("games-btn");
const menuBtn = document.getElementById("menu-btn");
const diffBtns = [...document.querySelectorAll(".diff-btn")];

const SYMBOLS = [
  "🍎", "🍋", "🍇", "🍒", "🍑", "🥝", "🍉", "🍍",
  "🐶", "🐱", "🐸", "🦊", "🐼", "🦁", "🐯", "🐨",
  "⚽", "🏀", "🎾", "🎱", "🎸", "🎲", "🎯", "🎨"
];

const DIFFICULTY = {
  easy: { label: "Easy", cols: 4, rows: 3, pairs: 6 },
  medium: { label: "Medium", cols: 4, rows: 4, pairs: 8 },
  hard: { label: "Hard", cols: 6, rows: 4, pairs: 12 }
};

const BEST_KEY = "memory-match-best";

let difficulty = "easy";
let cards = [];
let flipped = [];
let matchedCount = 0;
let moves = 0;
let lockBoard = false;
let running = false;
let menuMode = "start";
let seconds = 0;
let timerId = null;

function loadBest() {
  try {
    return JSON.parse(localStorage.getItem(BEST_KEY) || "{}");
  } catch {
    return {};
  }
}

function saveBest() {
  localStorage.setItem(BEST_KEY, JSON.stringify(loadBest()));
}

function formatTime(totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function formatBestRecord(record) {
  if (!record) return "—";
  return `${formatTime(record.time)} · ${record.moves} moves`;
}

function updateBestDisplay() {
  const best = loadBest()[difficulty];
  bestEl.textContent = formatBestRecord(best);
}

function updateHud() {
  movesEl.textContent = String(moves);
  timerEl.textContent = formatTime(seconds);
  hudDiffEl.textContent = DIFFICULTY[difficulty].label;
  updateBestDisplay();
}

function shuffle(list) {
  const arr = [...list];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function buildDeck() {
  const { pairs } = DIFFICULTY[difficulty];
  const symbols = shuffle(SYMBOLS).slice(0, pairs);
  const deck = shuffle(
    symbols.flatMap((symbol, index) => [
      { id: `${index}-a`, symbol },
      { id: `${index}-b`, symbol }
    ])
  );
  return deck;
}

function createCardButton(card, index) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "card";
  btn.dataset.index = String(index);
  btn.setAttribute("aria-label", "Face-down card");
  btn.innerHTML = `
    <div class="card-inner">
      <span class="card-face card-back">?</span>
      <span class="card-face card-front">${card.symbol}</span>
    </div>
  `;
  btn.addEventListener("click", () => flipCard(index));
  return btn;
}

function renderBoard() {
  const config = DIFFICULTY[difficulty];
  boardEl.className = `board ${difficulty}`;
  boardEl.innerHTML = "";
  cards.forEach((card, index) => {
    boardEl.appendChild(createCardButton(card, index));
  });
  boardEl.style.maxWidth = config.cols >= 6 ? "720px" : "520px";
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

function resetGameState() {
  cards = buildDeck();
  flipped = [];
  matchedCount = 0;
  moves = 0;
  lockBoard = false;
  seconds = 0;
  messageEl.textContent = "";
  renderBoard();
  updateHud();
}

function showMenu(mode, title, text) {
  menuMode = mode;
  running = false;
  stopTimer();

  overlayTitle.textContent = title;
  overlayText.textContent = text;

  diffBtns.forEach((btn) => {
    btn.disabled = mode === "pause" && running;
    btn.classList.toggle("active", btn.dataset.diff === difficulty);
  });

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
    `${DIFFICULTY[difficulty].label} · ${moves} moves · ${formatTime(seconds)}. Resume, start a new game, or go back to Games.`
  );
}

function startGame() {
  if (window.HubStreak) HubStreak.recordPlay();
  if (window.HubPlays) HubPlays.record("memory");
  resetGameState();
  overlay.classList.add("hidden");
  menuMode = "playing";
  running = true;
  startTimer();
}

function resumeGame() {
  if (menuMode !== "pause") return;
  overlay.classList.add("hidden");
  menuMode = "playing";
  running = true;
  startTimer();
}

function goToGames() {
  window.location.href = "../index.html#games";
}

function checkWin() {
  if (matchedCount !== cards.length) return;

  running = false;
  stopTimer();
  menuMode = "win";

  const best = loadBest();
  const prev = best[difficulty];
  const isNew =
    !prev || seconds < prev.time || (seconds === prev.time && moves < prev.moves);

  if (isNew) {
    best[difficulty] = { time: seconds, moves };
    localStorage.setItem(BEST_KEY, JSON.stringify(best));
  }

  let topTime = Infinity;
  for (const entry of Object.values(best || {})) {
    if (entry && typeof entry.time === "number" && entry.time > 0) {
      topTime = Math.min(topTime, entry.time);
    }
  }
  if (Number.isFinite(topTime) && topTime < Infinity) {
    window.HubLeaderboard?.submit("memory", topTime, { lowerBetter: true });
  }

  updateHud();
  if (window.HubAchievements) {
    HubAchievements.unlock("memory_win_easy");
    if (difficulty === "medium") HubAchievements.unlock("memory_win_medium");
    if (difficulty === "hard") HubAchievements.unlock("memory_win_hard");
  }
  window.HubSound?.play("win");
  messageEl.textContent = isNew ? "New best time!" : "All pairs matched!";
  showMenu(
    "win",
    "You Win!",
    `Matched all pairs in ${moves} moves and ${formatTime(seconds)}.${
      isNew ? " New best for this difficulty!" : ""
    }`
  );
}

function resolveMismatch(firstIndex, secondIndex) {
  lockBoard = true;
  window.HubSound?.play("error");
  setTimeout(() => {
    const firstBtn = boardEl.children[firstIndex];
    const secondBtn = boardEl.children[secondIndex];
    firstBtn.classList.remove("flipped");
    secondBtn.classList.remove("flipped");
    firstBtn.disabled = false;
    secondBtn.disabled = false;
    flipped = [];
    lockBoard = false;
  }, 700);
}

function flipCard(index) {
  if (!running || lockBoard) return;

  const btn = boardEl.children[index];
  if (!btn || btn.classList.contains("flipped") || btn.classList.contains("matched")) return;

  btn.classList.add("flipped");
  window.HubSound?.play("flip", "present");
  btn.setAttribute("aria-label", `Card showing ${cards[index].symbol}`);
  flipped.push(index);

  if (flipped.length < 2) return;

  moves += 1;
  movesEl.textContent = String(moves);

  const [a, b] = flipped;
  const match = cards[a].symbol === cards[b].symbol;

  if (match) {
    boardEl.children[a].classList.add("matched");
    boardEl.children[b].classList.add("matched");
    boardEl.children[a].disabled = true;
    boardEl.children[b].disabled = true;
    matchedCount += 2;
    flipped = [];
    window.HubSound?.play("match");
    checkWin();
  } else {
    boardEl.children[a].disabled = true;
    boardEl.children[b].disabled = true;
    resolveMismatch(a, b);
  }
}

diffBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    if (running && menuMode === "playing") return;
    difficulty = btn.dataset.diff;
    diffBtns.forEach((b) => b.classList.toggle("active", b === btn));
    updateHud();
    if (!running) resetGameState();
  });
});

window.addEventListener("keydown", (e) => {
  if (e.code !== "Escape") return;
  e.preventDefault();
  if (menuMode === "pause" && !overlay.classList.contains("hidden")) resumeGame();
  else if (running) openPauseMenu();
  else overlay.classList.remove("hidden");
});

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

updateHud();
resetGameState();
showMenu(
  "start",
  "Memory Match",
  "Find all matching pairs in as few moves and as little time as you can."
);
