const ROWS = 6;
const STORAGE_KEY = "wordle-game";
const STATS_KEY = "wordle-stats";
const LANG_KEY = "wordle-lang";
const THEME_KEY = "wordle-theme";
const LENGTH_KEY = "wordle-length";
const HUB_FAVORITES_KEY = "hub-favorites";
const HUB_LAST_GAME_KEY = "hub-last-game";
const SEEN_BUILD_KEY = "wordle-seen-build";

const CHANGELOG = {
  "20260903a": [
    "New Share moment button in the games hub",
    "Share sheet support on phone and copy fallback on desktop"
  ],
  "20260902h": [
    "Site ready for mygames.com hosting",
    "Site name and domain live in site-config.js — easy to change later"
  ],
  "20260902g": [
    "Menu reminder when your daily streak needs a play today",
    "What's new popup after updates",
    "Daily streak now resets after 48 hours without playing"
  ],
  "20260902f": [
    "Daily play streak across all games",
    "High scores, favorites, and continue last game",
    "Snake: slower speed and 4 apples"
  ]
};

const HUB_GAMES = [
  { id: "wordle", name: "Wordle", path: null },
  { id: "space", name: "Space Shooter", path: "space-shooter/index.html" },
  { id: "quiz", name: "Quizmaster", path: "quiz/index.html" },
  { id: "breakout", name: "Brick Breaker", path: "breakout/index.html" },
  { id: "hangman", name: "Hangman", path: "hangman/index.html" },
  { id: "2048", name: "2048", path: "2048/index.html" },
  { id: "snake", name: "Snake", path: "snake/index.html" },
  { id: "memory", name: "Memory Match", path: "memory-match/index.html" },
  { id: "connect-four", name: "Connect Four", path: "connect-four/index.html" },
  { id: "math", name: "Math Sprint", path: "math/index.html" },
  { id: "sudoku", name: "Sudoku", path: "sudoku/index.html" },
  { id: "flappy", name: "Flappy Bird", path: "flappy-bird/index.html" },
  { id: "tictactoe", name: "Tic Tac Toe", path: "tic-tac-toe/index.html" },
  { id: "pixletris", name: "Pixletris", path: "pixletris/index.html" }
];

const boardEl = document.getElementById("board");
const keyboardEl = document.getElementById("keyboard");
const messageEl = document.getElementById("message");
const confettiCanvas = document.getElementById("confetti");
const menuModal = document.getElementById("menu-modal");
const menuTitle = document.getElementById("menu-title");
const menuSubtitle = document.getElementById("menu-subtitle");
const streakReminderEl = document.getElementById("streak-reminder");
const whatsNewModal = document.getElementById("whats-new-modal");
const whatsNewBuild = document.getElementById("whats-new-build");
const whatsNewList = document.getElementById("whats-new-list");
const whatsNewOkBtn = document.getElementById("whats-new-ok");
const statWins = document.getElementById("stat-wins");
const statWinPct = document.getElementById("stat-win-pct");
const statStreak = document.getElementById("stat-streak");
const statPlayed = document.getElementById("stat-played");
const menuResumeBtn = document.getElementById("menu-resume");
const menuNewWordBtn = document.getElementById("menu-new-word");
const menuGamesBtn = document.getElementById("menu-games");
const menuBtn = document.getElementById("menu-btn");
const gamesScreen = document.getElementById("games-screen");
const gamesBackBtn = document.getElementById("games-back");
const gamesMessageEl = document.getElementById("games-message");
const continueLastBtn = document.getElementById("continue-last-btn");
const toggleScoresBtn = document.getElementById("toggle-scores-btn");
const shareMomentBtn = document.getElementById("share-moment-btn");
const highScoresPanel = document.getElementById("high-scores-panel");
const highScoresList = document.getElementById("high-scores-list");
const gamesGrid = document.getElementById("games-grid");
const hubStreakBadge = document.getElementById("hub-streak-badge");
const hubStreakCount = document.getElementById("hub-streak-count");
const hintBtn = document.getElementById("hint-btn");
const langBtn = document.getElementById("lang-btn");
const themeBtn = document.getElementById("theme-btn");
const lengthBtn = document.getElementById("length-btn");

const KEYBOARD_EN = [
  ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
  ["A", "S", "D", "F", "G", "H", "J", "K", "L"],
  ["ENTER", "Z", "X", "C", "V", "B", "N", "M", "BACK"]
];

const KEYBOARD_DA = [
  ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P", "Å"],
  ["A", "S", "D", "F", "G", "H", "J", "K", "L", "Æ", "Ø"],
  ["ENTER", "Z", "X", "C", "V", "B", "N", "M", "BACK"]
];

const KEYBOARD_IS = [
  ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
  ["A", "S", "D", "F", "G", "H", "J", "K", "L"],
  ["Á", "Ð", "É", "Í", "Ó", "Ö", "Ú", "Ý", "Þ", "Æ"],
  ["ENTER", "Z", "X", "C", "V", "B", "N", "M", "BACK"]
];

const LANGUAGES = ["en", "da", "is"];

const LENGTHS = [4, 5, 6];

let currentLang = localStorage.getItem(LANG_KEY) || "en";
const savedLength = Number(localStorage.getItem(LENGTH_KEY));
let currentLength = LENGTHS.includes(savedLength) ? savedLength : 5;
let COLS = currentLength;
let state = loadState();
let confettiAnimationId = null;
let submitting = false;

function getKeyboardRows() {
  if (currentLang === "da") return KEYBOARD_DA;
  if (currentLang === "is") return KEYBOARD_IS;
  return KEYBOARD_EN;
}

function getWordList() {
  if (currentLength === 4) {
    if (currentLang === "da") return WORDS_DA_4;
    if (currentLang === "is") return WORDS_IS_4;
    return WORDS_4;
  }
  if (currentLength === 6) {
    if (currentLang === "da") return WORDS_DA_6;
    if (currentLang === "is") return WORDS_IS_6;
    return WORDS_6;
  }
  if (currentLang === "da") return WORDS_DA;
  if (currentLang === "is") return WORDS_IS;
  return WORDS;
}

function getValidGuesses() {
  let guesses;
  if (currentLength === 4) {
    if (currentLang === "da") guesses = VALID_GUESSES_DA_4;
    else if (currentLang === "is") guesses = VALID_GUESSES_IS_4;
    else guesses = VALID_GUESSES_4;
  } else if (currentLength === 6) {
    if (currentLang === "da") guesses = VALID_GUESSES_DA_6;
    else if (currentLang === "is") guesses = VALID_GUESSES_IS_6;
    else guesses = VALID_GUESSES_6;
  } else if (currentLang === "da") {
    guesses = VALID_GUESSES_DA;
  } else if (currentLang === "is") {
    guesses = VALID_GUESSES_IS;
  } else {
    guesses = VALID_GUESSES;
  }

  return guesses;
}

function isValidGuess(guess) {
  if (getValidGuesses().has(guess)) return true;
  // Fallback: always accept current answer-list words.
  return getWordList().includes(guess);
}

function getValidLetters() {
  if (currentLang === "da") return /^[A-ZÆØÅ]$/;
  if (currentLang === "is") return /^[A-ZÁÐÉÍÓÖÚÝÞÆ]$/;
  return /^[A-Z]$/;
}

function updateLangButton() {
  langBtn.textContent = currentLang.toUpperCase();
}

function updateLengthButton() {
  lengthBtn.textContent = String(currentLength);
  boardEl.classList.toggle("len-4", currentLength === 4);
  boardEl.classList.toggle("len-6", currentLength === 6);
}

function switchLength() {
  const idx = LENGTHS.indexOf(currentLength);
  currentLength = LENGTHS[(idx + 1) % LENGTHS.length];
  COLS = currentLength;
  localStorage.setItem(LENGTH_KEY, String(currentLength));
  updateLengthButton();
  startNewGame();
}

function applyTheme(theme) {
  document.body.classList.toggle("light", theme === "light");
  themeBtn.textContent = theme === "light" ? "☾" : "☀";
  themeBtn.title = theme === "light" ? "Switch to dark background" : "Switch to light background";
}

function toggleTheme() {
  const next = document.body.classList.contains("light") ? "dark" : "light";
  localStorage.setItem(THEME_KEY, next);
  applyTheme(next);
}

function switchLanguage() {
  const idx = LANGUAGES.indexOf(currentLang);
  currentLang = LANGUAGES[(idx + 1) % LANGUAGES.length];
  localStorage.setItem(LANG_KEY, currentLang);
  updateLangButton();
  startNewGame();
}

const CONFETTI_COLORS = ["#538d4e", "#b59f3b", "#ffffff", "#6aaa64", "#c9b458", "#ff6b6b"];

function createEmptyBoard() {
  return Array.from({ length: ROWS }, () =>
    Array.from({ length: COLS }, () => ({ letter: "", status: null }))
  );
}

function pickSecretWord() {
  const words = getWordList();
  return words[Math.floor(Math.random() * words.length)];
}

function loadState() {
  try {
    const saved = localStorage.getItem(storageKey());
    if (saved) {
      const parsed = JSON.parse(saved);
      if (
        parsed.secretWord &&
        parsed.secretWord.length === currentLength &&
        parsed.board &&
        typeof parsed.currentRow === "number" &&
        typeof parsed.currentCol === "number" &&
        parsed.gameStatus
      ) {
        return parsed;
      }
    }
  } catch {
    // ignore corrupt storage
  }
  return newGameState();
}

function newGameState() {
  return {
    secretWord: pickSecretWord(),
    board: createEmptyBoard(),
    currentRow: 0,
    currentCol: 0,
    gameStatus: "playing",
    keyStates: {}
  };
}

function storageKey() {
  return `${STORAGE_KEY}-${currentLang}-${currentLength}`;
}

function saveState() {
  localStorage.setItem(storageKey(), JSON.stringify(state));
}

function loadStats() {
  try {
    const saved = localStorage.getItem(STATS_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      return {
        gamesPlayed: parsed.gamesPlayed ?? 0,
        wins: parsed.wins ?? 0,
        currentStreak: parsed.currentStreak ?? 0
      };
    }
  } catch {
    // ignore corrupt storage
  }
  return { gamesPlayed: 0, wins: 0, currentStreak: 0 };
}

function saveStats(stats) {
  localStorage.setItem(STATS_KEY, JSON.stringify(stats));
}

function getWinPercent(stats) {
  if (stats.gamesPlayed === 0) return 0;
  return Math.round((stats.wins / stats.gamesPlayed) * 100);
}

function recordGameResult(won) {
  const stats = loadStats();
  stats.gamesPlayed += 1;
  if (won) {
    stats.wins += 1;
    stats.currentStreak += 1;
  } else {
    stats.currentStreak = 0;
  }
  saveStats(stats);
  return stats;
}

function formatStreakHoursLeft(hours) {
  if (hours <= 0) return null;
  return `~${Math.max(1, Math.round(hours))}h`;
}

function renderStreakReminder() {
  if (!streakReminderEl || typeof HubStreak === "undefined") {
    streakReminderEl?.classList.add("hidden");
    return;
  }

  const status = HubStreak.getStatus();
  streakReminderEl.classList.remove("is-urgent", "is-done");

  if (status.playedToday) {
    if (status.streak > 0) {
      const dayLabel = status.streak === 1 ? "day" : "days";
      streakReminderEl.textContent = `Streak saved for today! 🔥 ${status.streak} ${dayLabel}.`;
      streakReminderEl.classList.add("is-done");
      streakReminderEl.classList.remove("hidden");
    } else {
      streakReminderEl.classList.add("hidden");
    }
    return;
  }

  if (status.streak > 0 && status.hoursLeft > 0) {
    const hours = formatStreakHoursLeft(status.hoursLeft);
    streakReminderEl.textContent = `You haven't played today — streak ends in ${hours}.`;
    streakReminderEl.classList.add("is-urgent");
    streakReminderEl.classList.remove("hidden");
    return;
  }

  if (status.streak === 0) {
    streakReminderEl.textContent = "Play any game today to start a daily streak.";
    streakReminderEl.classList.remove("hidden");
    return;
  }

  streakReminderEl.classList.add("hidden");
}

function getSeenBuild() {
  return localStorage.getItem(SEEN_BUILD_KEY) || "";
}

function markBuildSeen() {
  const build = window.WORDLE_BUILD || "";
  if (build) localStorage.setItem(SEEN_BUILD_KEY, build);
}

function showWhatsNew() {
  const build = window.WORDLE_BUILD || "";
  if (!build || build === getSeenBuild()) return false;

  const notes = CHANGELOG[build];
  if (!notes?.length) {
    markBuildSeen();
    return false;
  }

  if (whatsNewBuild) whatsNewBuild.textContent = build;
  if (whatsNewList) {
    whatsNewList.innerHTML = notes.map((note) => `<li>${note}</li>`).join("");
  }
  whatsNewModal?.classList.remove("hidden");
  return true;
}

function hideWhatsNew() {
  whatsNewModal?.classList.add("hidden");
  markBuildSeen();
}

function applySiteConfig() {
  const cfg = window.SITE_CONFIG || { name: "My Games", domain: "" };
  document.title = cfg.name;
  const gamesTitle = document.getElementById("games-title");
  if (gamesTitle) gamesTitle.textContent = cfg.name;
}

function hideMenu() {
  menuModal.classList.add("hidden");
}

function showMenu() {
  hideGamesScreen();
  const stats = loadStats();
  const won = state.gameStatus === "won";
  const lost = state.gameStatus === "lost";

  if (won) {
    menuTitle.textContent = "You Won!";
    menuSubtitle.textContent = getWinMessage(Math.max(0, state.currentRow));
  } else if (lost) {
    menuTitle.textContent = "Game Over";
    menuSubtitle.textContent = `The word was ${state.secretWord.toUpperCase()}`;
  } else {
    menuTitle.textContent = "Menu";
    menuSubtitle.textContent = "Resume your game or start a new word.";
  }

  menuResumeBtn.classList.toggle("hidden", won);
  statWins.textContent = stats.wins;
  statWinPct.textContent = getWinPercent(stats);
  statStreak.textContent = stats.currentStreak;
  statPlayed.textContent = stats.gamesPlayed;
  renderStreakReminder();
  menuModal.classList.remove("hidden");
}

function isGamesScreenOpen() {
  return !gamesScreen.classList.contains("hidden");
}

function readNumberKey(key) {
  try {
    const n = Number(localStorage.getItem(key));
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  } catch {
    return 0;
  }
}

function readJsonKey(key, fallback = null) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function maxAcrossKeys(keys) {
  return keys.reduce((best, key) => Math.max(best, readNumberKey(key)), 0);
}

function formatSeconds(total) {
  const s = Math.max(0, Math.floor(total));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m > 0 ? `${m}:${String(r).padStart(2, "0")}` : `${r}s`;
}

function getHubScore(gameId) {
  switch (gameId) {
    case "wordle": {
      const stats = readJsonKey(STATS_KEY, null);
      if (!stats || !stats.gamesPlayed) return { label: "No games yet", sort: 0 };
      const pct = stats.gamesPlayed
        ? Math.round((stats.wins / stats.gamesPlayed) * 100)
        : 0;
      return {
        label: `${stats.wins} wins · ${pct}% · streak ${stats.currentStreak || 0}`,
        sort: stats.wins || 0
      };
    }
    case "space": {
      const score = maxAcrossKeys([
        "space-shooter-high-score-easy",
        "space-shooter-high-score-medium",
        "space-shooter-high-score-hard",
        "space-shooter-high-score"
      ]);
      return { label: score ? `Best ${score}` : "No score yet", sort: score };
    }
    case "quiz": {
      const score = maxAcrossKeys([
        "quizmaster-high-score-easy",
        "quizmaster-high-score-medium",
        "quizmaster-high-score-hard",
        "quizmaster-high-score"
      ]);
      return { label: score ? `Best ${score}` : "No score yet", sort: score };
    }
    case "breakout": {
      const score = readNumberKey("brick-breaker-high-score");
      return { label: score ? `Best ${score}` : "No score yet", sort: score };
    }
    case "hangman": {
      const legacy = readJsonKey("hangman-stats", {});
      let bestStreak = legacy.bestStreak || 0;
      let wins = legacy.wins || 0;
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key || !key.startsWith("hangman-stats-")) continue;
        const stats = readJsonKey(key, {});
        bestStreak = Math.max(bestStreak, stats.bestStreak || 0);
        wins += stats.wins || 0;
      }
      if (!wins && !bestStreak) return { label: "No wins yet", sort: 0 };
      return { label: `${wins} wins · best streak ${bestStreak}`, sort: bestStreak };
    }
    case "2048": {
      const score = readNumberKey("2048-best-score");
      return { label: score ? `Best ${score}` : "No score yet", sort: score };
    }
    case "snake": {
      const score = readNumberKey("snake-high-score");
      return { label: score ? `Best ${score}` : "No score yet", sort: score };
    }
    case "memory": {
      const best = readJsonKey("memory-match-best", {});
      let top = null;
      for (const entry of Object.values(best || {})) {
        if (!entry || typeof entry.time !== "number") continue;
        if (!top || entry.time < top.time || (entry.time === top.time && entry.moves < top.moves)) {
          top = entry;
        }
      }
      if (!top) return { label: "No clear yet", sort: 0 };
      return {
        label: `Best ${formatSeconds(top.time)} · ${top.moves} moves`,
        sort: 100000 - top.time
      };
    }
    case "connect-four": {
      const stats = readJsonKey("connect-four-stats", {});
      let wins = 0;
      for (const entry of Object.values(stats || {})) wins += entry.wins || 0;
      return { label: wins ? `${wins} CPU wins` : "No wins yet", sort: wins };
    }
    case "math": {
      const score = maxAcrossKeys([
        "math-sprint-high-score-easy",
        "math-sprint-high-score-medium",
        "math-sprint-high-score-hard"
      ]);
      return { label: score ? `Best ${score}` : "No score yet", sort: score };
    }
    case "sudoku": {
      const times = readJsonKey("sudoku-best-times", {});
      const values = Object.values(times || {}).filter((n) => Number.isFinite(n) && n > 0);
      if (!values.length) return { label: "No clear yet", sort: 0 };
      const best = Math.min(...values);
      return { label: `Best ${formatSeconds(best)}`, sort: 100000 - best };
    }
    case "flappy": {
      const score = readNumberKey("flappy-bird-high-score");
      return { label: score ? `Best ${score}` : "No score yet", sort: score };
    }
    case "tictactoe": {
      const stats = readJsonKey("tic-tac-toe-stats", {});
      let wins = 0;
      for (const entry of Object.values(stats || {})) wins += entry.wins || 0;
      return { label: wins ? `${wins} CPU wins` : "No wins yet", sort: wins };
    }
    case "pixletris": {
      const score = readNumberKey("pixletris-high-score");
      return { label: score ? `Best ${score}` : "No score yet", sort: score };
    }
    default:
      return { label: "—", sort: 0 };
  }
}

function loadFavorites() {
  const list = readJsonKey(HUB_FAVORITES_KEY, []);
  return Array.isArray(list) ? list.filter((id) => HUB_GAMES.some((g) => g.id === id)) : [];
}

function saveFavorites(list) {
  localStorage.setItem(HUB_FAVORITES_KEY, JSON.stringify(list));
}

function isFavorite(gameId) {
  return loadFavorites().includes(gameId);
}

function toggleFavorite(gameId) {
  const list = loadFavorites();
  const idx = list.indexOf(gameId);
  if (idx >= 0) list.splice(idx, 1);
  else list.push(gameId);
  saveFavorites(list);
  refreshGamesHub();
}

function getLastGameId() {
  const id = localStorage.getItem(HUB_LAST_GAME_KEY);
  return HUB_GAMES.some((g) => g.id === id) ? id : null;
}

function setLastGameId(gameId) {
  if (!HUB_GAMES.some((g) => g.id === gameId)) return;
  localStorage.setItem(HUB_LAST_GAME_KEY, gameId);
}

function getHubGame(gameId) {
  return HUB_GAMES.find((g) => g.id === gameId) || null;
}

function renderContinueButton() {
  const lastId = getLastGameId();
  const game = lastId ? getHubGame(lastId) : null;
  if (!game || !continueLastBtn) {
    continueLastBtn?.classList.add("hidden");
    return;
  }
  continueLastBtn.classList.remove("hidden");
  continueLastBtn.textContent = `Continue · ${game.name}`;
}

function renderCardScoresAndFavorites() {
  const favorites = new Set(loadFavorites());
  document.querySelectorAll(".game-card[data-game]").forEach((card) => {
    const id = card.dataset.game;
    card.classList.toggle("is-favorite", favorites.has(id));
    const favBtn = card.querySelector(".fav-btn");
    if (favBtn) {
      favBtn.textContent = favorites.has(id) ? "★" : "☆";
      favBtn.classList.toggle("active", favorites.has(id));
      favBtn.setAttribute("aria-pressed", favorites.has(id) ? "true" : "false");
    }
    const scoreEl = card.querySelector(`[data-score-for="${id}"]`);
    if (scoreEl) scoreEl.textContent = getHubScore(id).label;
  });
}

function sortGamesGrid() {
  if (!gamesGrid) return;
  const favorites = loadFavorites();
  const cards = [...gamesGrid.querySelectorAll(".game-card[data-game]")];
  cards.sort((a, b) => {
    const af = favorites.includes(a.dataset.game) ? 0 : 1;
    const bf = favorites.includes(b.dataset.game) ? 0 : 1;
    if (af !== bf) return af - bf;
    return 0;
  });
  cards.forEach((card) => gamesGrid.appendChild(card));
}

function renderHighScoresList() {
  if (!highScoresList) return;
  const rows = HUB_GAMES.map((game) => {
    const score = getHubScore(game.id);
    return { name: game.name, label: score.label, sort: score.sort, fav: isFavorite(game.id) };
  }).sort((a, b) => {
    if (a.fav !== b.fav) return a.fav ? -1 : 1;
    return b.sort - a.sort;
  });

  highScoresList.innerHTML = rows
    .map(
      (row) =>
        `<li><span class="hs-name">${row.fav ? "★ " : ""}${row.name}</span><span class="hs-score">${row.label}</span></li>`
    )
    .join("");
}

function getShareRows(limit = 3) {
  return HUB_GAMES.map((game) => {
    const score = getHubScore(game.id);
    return { name: game.name, label: score.label, sort: score.sort };
  })
    .filter((row) => row.sort > 0)
    .sort((a, b) => b.sort - a.sort)
    .slice(0, limit);
}

function buildShareMomentText() {
  const cfg = window.SITE_CONFIG || { name: "My Games" };
  const status = typeof HubStreak !== "undefined" ? HubStreak.getStatus() : null;
  const streak = status?.streak || 0;
  const rows = getShareRows(3);
  const url = window.location.origin + "/#games";

  const lines = [
    `🎮 ${cfg.name}`,
    `🔥 Daily streak: ${streak} ${streak === 1 ? "day" : "days"}`
  ];
  if (rows.length) {
    lines.push("🏆 Top scores:");
    rows.forEach((row) => lines.push(`• ${row.name}: ${row.label}`));
  }
  lines.push(url);
  return lines.join("\n");
}

async function shareMoment() {
  const cfg = window.SITE_CONFIG || { name: "My Games" };
  const text = buildShareMomentText();
  const url = window.location.origin + "/#games";
  const payload = {
    title: cfg.name,
    text,
    url
  };

  try {
    if (navigator.share) {
      await navigator.share(payload);
      showGamesMessage("Shared! 🚀", 1800);
      return;
    }
  } catch {
    // fall back to clipboard
  }

  try {
    await navigator.clipboard.writeText(text);
    showGamesMessage("Share text copied. Paste it anywhere!", 2600);
  } catch {
    showGamesMessage("Sharing not available on this browser yet.", 2600);
  }
}

function recordHubDailyPlay() {
  if (typeof HubStreak === "undefined") return null;
  return HubStreak.recordPlay();
}

function renderDailyStreak() {
  if (!hubStreakBadge || !hubStreakCount || typeof HubStreak === "undefined") return;

  const status = HubStreak.getStatus();
  hubStreakCount.textContent = String(status.streak);
  hubStreakBadge.classList.toggle("is-active", status.streak > 0 && !status.playedToday);
  hubStreakBadge.classList.toggle("is-done", status.playedToday);

  if (status.celebrate) {
    const dayLabel = status.streak === 1 ? "day" : "days";
    showGamesMessage(`🔥 ${status.streak} ${dayLabel} streak! Play again within 48 hours to keep it going.`, 3500);
    HubStreak.clearCelebration();
  }
}

function refreshGamesHub() {
  renderContinueButton();
  renderCardScoresAndFavorites();
  sortGamesGrid();
  renderHighScoresList();
  renderDailyStreak();
}

function showGamesMessage(text, duration = 2000) {
  gamesMessageEl.textContent = text;
  gamesMessageEl.classList.add("visible");
  clearTimeout(showGamesMessage._timer);
  if (duration > 0) {
    showGamesMessage._timer = setTimeout(() => {
      gamesMessageEl.classList.remove("visible");
    }, duration);
  }
}

function showGamesScreen() {
  hideMenu();
  gamesMessageEl.classList.remove("visible");
  gamesMessageEl.textContent = "";
  if (highScoresPanel) highScoresPanel.classList.add("hidden");
  refreshGamesHub();
  gamesScreen.classList.remove("hidden");
}

function hideGamesScreen() {
  gamesScreen.classList.add("hidden");
}

function backFromGames() {
  hideGamesScreen();
  showMenu();
}

function selectGame(gameId) {
  const game = getHubGame(gameId);
  if (!game) {
    showGamesMessage("Coming soon");
    return;
  }

  setLastGameId(gameId);
  recordHubDailyPlay();

  if (!game.path) {
    hideGamesScreen();
    return;
  }

  window.location.href = game.path;
}

function showMessage(text, isError = false, duration = 2000) {
  messageEl.textContent = text;
  messageEl.classList.toggle("error", isError);
  messageEl.classList.add("visible");
  clearTimeout(showMessage._timer);
  if (duration > 0) {
    showMessage._timer = setTimeout(() => {
      messageEl.classList.remove("visible");
    }, duration);
  }
}

function evaluateGuess(guess, secret) {
  const result = Array(COLS).fill("absent");
  const secretCounts = {};

  for (const letter of secret) {
    secretCounts[letter] = (secretCounts[letter] || 0) + 1;
  }

  for (let i = 0; i < COLS; i++) {
    if (guess[i] === secret[i]) {
      result[i] = "correct";
      secretCounts[guess[i]]--;
    }
  }

  for (let i = 0; i < COLS; i++) {
    if (result[i] === "correct") continue;
    const letter = guess[i];
    if (secretCounts[letter] > 0) {
      result[i] = "present";
      secretCounts[letter]--;
    }
  }

  return result;
}

function updateKeyState(letter, status) {
  const rank = { absent: 0, present: 1, correct: 2 };
  const current = state.keyStates[letter];
  if (!current || rank[status] > rank[current]) {
    state.keyStates[letter] = status;
  }
}

function renderBoard() {
  boardEl.innerHTML = "";
  for (let r = 0; r < ROWS; r++) {
    const rowEl = document.createElement("div");
    rowEl.className = "row";
    rowEl.dataset.row = r;

    for (let c = 0; c < COLS; c++) {
      const cell = state.board[r][c];
      const tile = document.createElement("div");
      tile.className = "tile";
      tile.dataset.col = c;

      if (cell.letter) {
        tile.textContent = cell.letter;
        tile.classList.add("filled");
      }
      if (cell.status) {
        tile.classList.add(cell.status);
      }

      rowEl.appendChild(tile);
    }
    boardEl.appendChild(rowEl);
  }
}

function renderKeyboard() {
  keyboardEl.innerHTML = "";
  for (const row of getKeyboardRows()) {
    const rowEl = document.createElement("div");
    rowEl.className = "keyboard-row";

    for (const key of row) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "key";
      btn.dataset.key = key;

      if (key === "ENTER" || key === "BACK") {
        btn.classList.add("wide");
        btn.textContent = key === "BACK" ? "⌫" : "ENTER";
        btn.setAttribute("aria-label", key === "BACK" ? "Backspace" : "Enter");
      } else {
        btn.textContent = key;
        const keyStatus = state.keyStates[key];
        if (keyStatus) btn.classList.add(keyStatus);
      }

      btn.addEventListener("click", () => handleKey(key));
      rowEl.appendChild(btn);
    }
    keyboardEl.appendChild(rowEl);
  }
}

function getUnusedAbsentLetters() {
  const secret = state.secretWord.toUpperCase();
  let alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  if (currentLang === "da") alphabet += "ÆØÅ";
  if (currentLang === "is") alphabet += "ÁÐÉÍÓÖÚÝÞÆ";
  return [...alphabet].filter(
    (letter) => !secret.includes(letter) && !state.keyStates[letter]
  );
}

function updateHintButton() {
  const available = state.gameStatus === "playing" && getUnusedAbsentLetters().length > 0;
  hintBtn.disabled = !available;
}

function useHint() {
  if (state.gameStatus !== "playing" || isMenuOpen()) return;

  const candidates = getUnusedAbsentLetters();
  if (candidates.length === 0) {
    showMessage("No more hints", true);
    updateHintButton();
    return;
  }

  const letter = candidates[Math.floor(Math.random() * candidates.length)];
  state.keyStates[letter] = "absent";
  saveState();
  renderKeyboard();
  updateHintButton();
  showMessage(`${letter} is not in the word`);
}

function render() {
  renderBoard();
  renderKeyboard();
  updateHintButton();
}

function getCurrentGuess() {
  return state.board[state.currentRow].map((cell) => cell.letter).join("");
}

async function submitGuess() {
  if (submitting || state.gameStatus !== "playing") return;
  if (state.currentCol < COLS) {
    showMessage("Not enough letters", true);
    shakeRow(state.currentRow);
    return;
  }

  const guess = getCurrentGuess().toLowerCase();
  if (!isValidGuess(guess)) {
    showMessage(`Not in dictionary (${currentLength} ${currentLang.toUpperCase()})`, true);
    shakeRow(state.currentRow);
    return;
  }

  submitting = true;
  recordHubDailyPlay();
  try {
    const evaluation = evaluateGuess(guess, state.secretWord);
    const row = state.currentRow;

    for (let i = 0; i < COLS; i++) {
      state.board[row][i].status = evaluation[i];
      updateKeyState(state.board[row][i].letter, evaluation[i]);
    }

    saveState();
    await animateRowFlip(row);

    if (guess === state.secretWord) {
      handleWin(row);
      return;
    }

    state.currentRow++;
    state.currentCol = 0;

    if (state.currentRow >= ROWS) {
      handleLoss();
      return;
    }

    saveState();
    render();
  } finally {
    submitting = false;
  }
}

function getWinMessage(row) {
  const messages = ["Genius", "Magnificent", "Impressive", "Splendid", "Great", "Phew"];
  return messages[row] ?? "Nice";
}

function handleWin(row) {
  state.gameStatus = "won";
  recordGameResult(true);
  showMessage(getWinMessage(row), false, 0);
  saveState();
  renderKeyboard();
  updateHintButton();
  launchConfetti();
  showMenu();
}

function handleLoss() {
  state.gameStatus = "lost";
  recordGameResult(false);
  const answer = state.secretWord.toUpperCase();
  showMessage(answer, false, 0);
  saveState();
  renderKeyboard();
  updateHintButton();
  showMenu();
}

function resizeConfettiCanvas() {
  confettiCanvas.width = window.innerWidth;
  confettiCanvas.height = window.innerHeight;
}

function stopConfetti() {
  if (confettiAnimationId) {
    cancelAnimationFrame(confettiAnimationId);
    confettiAnimationId = null;
  }
  const ctx = confettiCanvas.getContext("2d");
  ctx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
}

function launchConfetti() {
  stopConfetti();
  resizeConfettiCanvas();

  const ctx = confettiCanvas.getContext("2d");
  const particles = Array.from({ length: 160 }, () => ({
    x: Math.random() * confettiCanvas.width,
    y: Math.random() * confettiCanvas.height - confettiCanvas.height,
    size: Math.random() * 8 + 4,
    color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
    tilt: Math.random() * Math.PI,
    tiltSpeed: (Math.random() - 0.5) * 0.2,
    velocityX: (Math.random() - 0.5) * 3,
    velocityY: Math.random() * 3 + 2,
    rotation: Math.random() * Math.PI * 2,
    rotationSpeed: (Math.random() - 0.5) * 0.25
  }));

  const startTime = performance.now();
  const duration = 2800;

  function animate(now) {
    ctx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);

    for (const p of particles) {
      p.x += p.velocityX;
      p.y += p.velocityY;
      p.velocityY += 0.08;
      p.tilt += p.tiltSpeed;
      p.rotation += p.rotationSpeed;

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      ctx.restore();
    }

    if (now - startTime < duration) {
      confettiAnimationId = requestAnimationFrame(animate);
    } else {
      stopConfetti();
    }
  }

  confettiAnimationId = requestAnimationFrame(animate);
}

function shakeRow(rowIndex) {
  const rowEl = boardEl.querySelector(`[data-row="${rowIndex}"]`);
  if (!rowEl) return;
  rowEl.style.animation = "none";
  void rowEl.offsetWidth;
  rowEl.style.animation = "shake 0.5s ease";
  rowEl.addEventListener(
    "animationend",
    () => {
      rowEl.style.animation = "";
    },
    { once: true }
  );
}

async function animateRowFlip(rowIndex) {
  const rowEl = boardEl.querySelector(`[data-row="${rowIndex}"]`);
  if (!rowEl) return;

  const tiles = rowEl.querySelectorAll(".tile");
  for (let i = 0; i < tiles.length; i++) {
    await new Promise((resolve) => {
      tiles[i].classList.add("flip");
      tiles[i].addEventListener(
        "animationend",
        () => {
          tiles[i].classList.remove("flip");
          tiles[i].classList.add(state.board[rowIndex][i].status);
          resolve();
        },
        { once: true }
      );
    });
    await delay(100);
  }
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isMenuOpen() {
  return !menuModal.classList.contains("hidden") || isGamesScreenOpen();
}

function addLetter(letter) {
  if (submitting || state.gameStatus !== "playing" || isMenuOpen()) return;
  if (state.currentCol >= COLS) return;

  state.board[state.currentRow][state.currentCol].letter = letter;
  state.currentCol++;
  saveState();
  renderBoard();
}

function removeLetter() {
  if (submitting || state.gameStatus !== "playing" || isMenuOpen()) return;
  if (state.currentCol <= 0) return;

  state.currentCol--;
  state.board[state.currentRow][state.currentCol].letter = "";
  saveState();
  renderBoard();
}

function handleKey(key) {
  if (submitting || isMenuOpen()) return;
  if (key === "ENTER") {
    submitGuess();
    return;
  }
  if (key === "BACK") {
    removeLetter();
    return;
  }
  addLetter(key);
}

function handlePhysicalKeyboard(event) {
  if (isGamesScreenOpen()) {
    if (event.key === "Escape") {
      event.preventDefault();
      backFromGames();
    }
    return;
  }
  if (isMenuOpen()) {
    if (event.key === "Escape") {
      event.preventDefault();
      resumeGame();
    }
    return;
  }
  if (state.gameStatus !== "playing" || submitting) return;

  const key = event.key.toUpperCase();

  if (key === "ENTER") {
    event.preventDefault();
    submitGuess();
    return;
  }

  if (key === "BACKSPACE") {
    event.preventDefault();
    removeLetter();
    return;
  }

  if (getValidLetters().test(key)) {
    event.preventDefault();
    addLetter(key);
  }
}

function injectShakeAnimation() {
  const style = document.createElement("style");
  style.textContent = `
    @keyframes shake {
      0%, 100% { transform: translateX(0); }
      20% { transform: translateX(-4px); }
      40% { transform: translateX(4px); }
      60% { transform: translateX(-4px); }
      80% { transform: translateX(4px); }
    }
  `;
  document.head.appendChild(style);
}

function startNewGame() {
  stopConfetti();
  submitting = false;
  hideMenu();
  hideGamesScreen();
  state = newGameState();
  saveState();
  render();
  messageEl.classList.remove("visible");
  messageEl.textContent = "";
  showMessage("New game started");
}

function resumeGame() {
  hideMenu();
  hideGamesScreen();
}

injectShakeAnimation();
resizeConfettiCanvas();
window.addEventListener("resize", resizeConfettiCanvas);
updateLangButton();
updateLengthButton();
applyTheme(localStorage.getItem(THEME_KEY) || "dark");
render();
document.addEventListener("keydown", handlePhysicalKeyboard);
menuBtn.addEventListener("click", () => showMenu());
menuResumeBtn.addEventListener("click", () => resumeGame());
menuNewWordBtn.addEventListener("click", () => startNewGame());
menuGamesBtn.addEventListener("click", () => showGamesScreen());
gamesBackBtn.addEventListener("click", () => backFromGames());
continueLastBtn?.addEventListener("click", () => {
  const lastId = getLastGameId();
  if (lastId) selectGame(lastId);
});
toggleScoresBtn?.addEventListener("click", () => {
  if (!highScoresPanel) return;
  const open = highScoresPanel.classList.toggle("hidden") === false;
  toggleScoresBtn.textContent = open ? "Hide scores" : "High scores";
  if (open) renderHighScoresList();
});
shareMomentBtn?.addEventListener("click", () => shareMoment());
document.querySelectorAll(".game-card[data-game]").forEach((card) => {
  card.addEventListener("click", (event) => {
    if (event.target.closest(".fav-btn")) return;
    selectGame(card.dataset.game);
  });
});
document.querySelectorAll(".fav-btn").forEach((btn) => {
  const toggle = (event) => {
    event.preventDefault();
    event.stopPropagation();
    toggleFavorite(btn.dataset.fav);
  };
  btn.addEventListener("click", toggle);
  btn.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") toggle(event);
  });
});
hintBtn.addEventListener("click", () => useHint());
langBtn.addEventListener("click", () => switchLanguage());
themeBtn.addEventListener("click", () => toggleTheme());
lengthBtn.addEventListener("click", () => switchLength());

// Confirm the newest files loaded (helps when browser cache sticks).
const sixCount = typeof WORDS_6 !== "undefined" ? WORDS_6.length : 0;
applySiteConfig();
showMessage(`Loaded · ${sixCount} six-letter words`);

let afterWhatsNew = null;
if (location.hash === "#games") {
  afterWhatsNew = showGamesScreen;
} else {
  afterWhatsNew = showMenu;
}

if (showWhatsNew()) {
  whatsNewOkBtn?.addEventListener("click", () => {
    hideWhatsNew();
    afterWhatsNew?.();
  });
} else {
  afterWhatsNew?.();
}
