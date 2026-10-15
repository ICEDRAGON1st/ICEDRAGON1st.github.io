const ROWS = 6;
const STORAGE_KEY = "wordle-game";
const STATS_KEY = "wordle-stats";
const LANG_KEY = "wordle-lang";
const THEME_KEY = "wordle-theme";
const LENGTH_KEY = "wordle-length";
const HUB_FAVORITES_KEY = "hub-favorites";
const HUB_LAST_GAME_KEY = "hub-last-game";
const HUB_THEME_KEY = "hub-look-theme";
const SEEN_BUILD_KEY = "wordle-seen-build";
const MODE_KEY = "wordle-play-mode";
const WORD_THEME_KEY = "wordle-word-theme";
const COLOR_THEME_KEY = "guessword-color-theme";

const GUESS_COLOR_THEMES = {
  ice: { id: "ice", label: "Ice", blurb: "cyan correct, violet present" },
  arcade: { id: "arcade", label: "Arcade", blurb: "neon mint correct, hot coral present" },
  warm: { id: "warm", label: "Warm", blurb: "teal correct, amber present" }
};

const HUB_THEMES = {
  classic: { label: "Classic", eyebrow: "Hub" },
  arcade: { label: "Arcade", eyebrow: "Arcade floor" },
  ice: { label: "Ice", eyebrow: "ICE_DRAGON" },
  retro: { label: "Retro", eyebrow: "Terminal" },
  workshop: { label: "Workshop", eyebrow: "Workshop" },
  poster: { label: "Poster wall", eyebrow: "Now playing" },
  aurora: { label: "Aurora", eyebrow: "Titles", allowedNames: ["ice_dragon"] },
  mono: { label: "Mono", eyebrow: "Titles", allowedNames: ["ice_dragon"] },
  tide: { label: "Tide", eyebrow: "Titles", allowedNames: ["ice_dragon", "oscarvr29"] }
};

const CREATOR_NAME = "ICE_DRAGON";
const SPECIAL_PLAYER_NAMES = {
  ice_dragon: {
    className: "player-name-creator",
    title: "Site owner",
    badge: { label: "OWNER", className: "player-title-owner" }
  },
  oscarvr29: {
    className: "player-name-oscar",
    title: "Original player",
    badge: { label: "OG", className: "player-title-og" }
  }
};

const latestChangelog = window.MYGAMES_LATEST_CHANGELOG || {};
let CHANGELOG =
  latestChangelog.build && Array.isArray(latestChangelog.notes)
    ? { [latestChangelog.build]: latestChangelog.notes }
    : {};
let changelogHistoryLoaded = false;
let changelogHistoryPromise = null;

async function loadChangelogHistory() {
  if (changelogHistoryLoaded) return CHANGELOG;
  if (changelogHistoryPromise) return changelogHistoryPromise;
  const build = encodeURIComponent(window.WORDLE_BUILD || "");
  changelogHistoryPromise = fetch("changelog.json?v=" + build)
    .then((response) => {
      if (!response.ok) throw new Error("Changelog request failed: " + response.status);
      return response.json();
    })
    .then((data) => {
      const valid = {};
      Object.entries(data && typeof data === "object" ? data : {}).forEach(([id, notes]) => {
        if (!/^\d{8}[a-z]+$/i.test(id) || !Array.isArray(notes)) return;
        valid[id] = notes.map((note) => String(note || "").trim()).filter(Boolean);
      });
      CHANGELOG = { ...valid, ...CHANGELOG };
      changelogHistoryLoaded = true;
      return CHANGELOG;
    })
    .catch((error) => {
      changelogHistoryPromise = null;
      console.warn("Could not load changelog history", error);
      return CHANGELOG;
    });
  return changelogHistoryPromise;
}

const HUB_GAMES = window.HubGames && typeof window.HubGames.list === "function" ? window.HubGames.list() : [];
const LEADERBOARD_GAMES =
  window.HubGames && typeof window.HubGames.leaderboardTabs === "function"
    ? window.HubGames.leaderboardTabs()
    : [
        { id: "hub-points", name: "Hub Points" },
        { id: "online-time", name: "Time Online" },
        { id: "day-streak", name: "Day Streak" },
        { id: "invites", name: "Most Invites" }
      ];

const boardEl = document.getElementById("board");
const keyboardEl = document.getElementById("keyboard");
const messageEl = document.getElementById("message");
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
const menuViewBoardBtn = document.getElementById("menu-view-board");
const menuNewWordBtn = document.getElementById("menu-new-word");
const menuGamesBtn = document.getElementById("menu-games");
const wordThemePicker = document.getElementById("word-theme-picker");
const wordThemeHintEl = document.getElementById("word-theme-hint");
const colorThemePicker = document.getElementById("color-theme-picker");
const colorThemeHintEl = document.getElementById("color-theme-hint");
const menuBtn = document.getElementById("menu-btn");
const gamesScreen = document.getElementById("games-screen");
const gamesMessageEl = document.getElementById("games-message");
const continueLastBtn = document.getElementById("continue-last-btn");
const toggleScoresBtn = document.getElementById("toggle-scores-btn");
const toggleLeaderboardsBtn = document.getElementById("toggle-leaderboards-btn");
const toggleAchievementsBtn = document.getElementById("toggle-achievements-btn");
const togglePlayersBtn = document.getElementById("toggle-players-btn");
const toggleTitlesBtn = document.getElementById("toggle-titles-btn");
const toggleCoinsBtn = document.getElementById("toggle-coins-btn");
const toggleFriendsBtn = document.getElementById("toggle-friends-btn");
const toggleUpdatesBtn = document.getElementById("toggle-updates-btn");
const toggleFeedbackBtn = document.getElementById("toggle-feedback-btn");
const toggleSettingsBtn = document.getElementById("toggle-settings-btn");
const shareMomentBtn = document.getElementById("share-moment-btn");
const highScoresPanel = document.getElementById("high-scores-panel");
const highScoresList = document.getElementById("high-scores-list");
const leaderboardsPanel = document.getElementById("leaderboards-panel");
const leaderboardGamePicker = document.getElementById("leaderboard-game-picker");
const leaderboardSearchInput = document.getElementById("leaderboard-search");
const leaderboardSearchEmpty = document.getElementById("leaderboard-search-empty");
const gamesSearchInput = document.getElementById("games-search");
const leaderboardList = document.getElementById("leaderboard-list");
const leaderboardEmpty = document.getElementById("leaderboard-empty");
const updatesPanel = document.getElementById("updates-panel");
const updatesList = document.getElementById("updates-list");
const updatesCount = document.getElementById("updates-count");
const feedbackPanel = document.getElementById("feedback-panel");
const feedbackForm = document.getElementById("feedback-form");
const feedbackType = document.getElementById("feedback-type");
const feedbackGame = document.getElementById("feedback-game");
const feedbackText = document.getElementById("feedback-text");
const feedbackCount = document.getElementById("feedback-count");
const feedbackStatus = document.getElementById("feedback-status");
const feedbackSendBtn = document.getElementById("feedback-send-btn");
const feedbackInbox = document.getElementById("feedback-inbox");
const feedbackList = document.getElementById("feedback-list");
const feedbackEmpty = document.getElementById("feedback-empty");
const feedbackUnread = document.getElementById("feedback-unread");
const feedbackRefreshBtn = document.getElementById("feedback-refresh-btn");
const playersPanel = document.getElementById("players-panel");
const titlesPanel = document.getElementById("titles-panel");
const coinsPanel = document.getElementById("coins-panel");
const friendsPanel = document.getElementById("friends-panel");
const friendsChatPoll = () => renderFriendsPanel();
let friendsComposingGroup = false;
let friendsCreatingGroupBusy = false;
const hubSettingsPanel = document.getElementById("hub-settings-panel");
const hubThemePicker = document.getElementById("hub-theme-picker");
const gamesEyebrow = document.getElementById("games-eyebrow");
const playersList = document.getElementById("players-list");
const playersTotals = document.getElementById("players-totals");
const playerNameInput = document.getElementById("player-name-input");
const savePlayerNameBtn = document.getElementById("save-player-name-btn");
const lockPlayerNameBtn = document.getElementById("lock-player-name-btn");
const playerNameLockHint = document.getElementById("player-name-lock-hint");
const playerNameModal = document.getElementById("player-name-modal");
const playerNameModalInput = document.getElementById("player-name-modal-input");
const playerNameSaveBtn = document.getElementById("player-name-save");
const achievementsPanel = document.getElementById("achievements-panel");
const achievementsGrid = document.getElementById("achievements-grid");
const achievementsCount = document.getElementById("achievements-count");
const achievementToast = document.getElementById("achievement-toast");
const gamesGrid = document.getElementById("games-grid");
const hubStreakBadge = document.getElementById("hub-streak-badge");
const hubStreakCount = document.getElementById("hub-streak-count");
const hubStreakTimer = document.getElementById("hub-streak-timer");
let streakTimerInterval = null;
const hintBtn = document.getElementById("hint-btn");
const langBtn = document.getElementById("lang-btn");
const themeBtn = document.getElementById("theme-btn");
const lengthBtn = document.getElementById("length-btn");
const modeBtn = document.getElementById("mode-btn");
const menuDailyBtn = document.getElementById("menu-daily");
const menuShareDailyBtn = document.getElementById("menu-share-daily");

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
const DAILY_LENGTH = 5;

let currentLang = localStorage.getItem(LANG_KEY) || "en";
const savedLength = Number(localStorage.getItem(LENGTH_KEY));
let currentLength = LENGTHS.includes(savedLength) ? savedLength : 5;
let playMode = localStorage.getItem(MODE_KEY) === "practice" ? "practice" : "daily";
let wordTheme = localStorage.getItem(WORD_THEME_KEY) || "classic";
let wordAssetChangePending = false;
if (typeof WORDLE_THEMES !== "undefined" && !WORDLE_THEMES[wordTheme]) {
  wordTheme = "classic";
}
// Prefer Practice once today's 5-letter Daily (this language) is finished
if (isTodayDailyFinished(currentLang, DAILY_LENGTH)) {
  playMode = "practice";
  try {
    localStorage.setItem(MODE_KEY, "practice");
  } catch {}
}
if (playMode === "daily") {
  currentLength = DAILY_LENGTH;
}
let COLS = currentLength;
let state = window.__guesswordAssetsReady ? loadState() : null;
let submitting = false;

function getKeyboardRows() {
  if (currentLang === "da") return KEYBOARD_DA;
  if (currentLang === "is") return KEYBOARD_IS;
  return KEYBOARD_EN;
}

function getDictionaryWordList() {
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

function getWordThemeDef(id = wordTheme) {
  const themes = typeof WORDLE_THEMES !== "undefined" ? WORDLE_THEMES : null;
  return themes?.[id] || themes?.classic || null;
}

function isClassicWordTheme() {
  return wordTheme === "classic" || !Array.isArray(getWordThemeDef()?.words);
}

function getThemeWordsForLength() {
  const theme = getWordThemeDef();
  if (!Array.isArray(theme?.words)) return [];
  return theme.words.filter((w) => w.length === currentLength);
}

function getWordList() {
  // Daily is always the shared classic dictionary word.
  if (isDailyMode() || isClassicWordTheme()) return getDictionaryWordList();
  const themed = getThemeWordsForLength();
  if (themed.length >= 8) return themed;
  return getDictionaryWordList();
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
  if (getDictionaryWordList().includes(guess)) return true;
  return getThemeWordsForLength().includes(guess);
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
  if (!lengthBtn) return;
  lengthBtn.textContent = `Flex ${currentLength}`;
  const daily = isDailyMode();
  lengthBtn.classList.toggle("hidden", daily);
  lengthBtn.disabled = daily;
  lengthBtn.title = daily
    ? "Daily Guessword is always 5 letters"
    : "Flex Length — Guessword's signature 4 / 5 / 6 (Practice)";
  lengthBtn.setAttribute("aria-hidden", daily ? "true" : "false");
  boardEl.classList.toggle("len-4", currentLength === 4);
  boardEl.classList.toggle("len-6", currentLength === 6);
}

function applyLengthForMode() {
  if (isDailyMode()) {
    currentLength = DAILY_LENGTH;
  } else {
    const saved = Number(localStorage.getItem(LENGTH_KEY));
    currentLength = LENGTHS.includes(saved) ? saved : DAILY_LENGTH;
  }
  COLS = currentLength;
  updateLengthButton();
}

async function ensureWordAssets(lang, length) {
  if (wordAssetChangePending) return false;
  wordAssetChangePending = true;
  try {
    if (typeof window.ensureGuesswordAssets === "function") {
      await window.ensureGuesswordAssets(lang, length);
    }
    return true;
  } catch (error) {
    console.error("Could not load Guessword dictionary", error);
    showMessage("Could not load that dictionary. Check your connection and try again.", true);
    return false;
  } finally {
    wordAssetChangePending = false;
  }
}

async function switchLength() {
  if (isDailyMode()) {
    showMessage("Daily is always 5 letters — switch to Practice to change length", true);
    return;
  }
  const idx = LENGTHS.indexOf(currentLength);
  const nextLength = LENGTHS[(idx + 1) % LENGTHS.length];
  if (!(await ensureWordAssets(currentLang, nextLength))) return;
  currentLength = nextLength;
  COLS = currentLength;
  localStorage.setItem(LENGTH_KEY, String(currentLength));
  updateLengthButton();
  reloadBoard();
}

function applyTheme(theme) {
  document.body.classList.toggle("light", theme === "light");
  themeBtn.textContent = theme === "light" ? "☾" : "☀";
  themeBtn.title = theme === "light" ? "Switch to dark background" : "Switch to light background";
}

function getGuessColorThemeId() {
  const raw = localStorage.getItem(COLOR_THEME_KEY) || "ice";
  return GUESS_COLOR_THEMES[raw] ? raw : "ice";
}

function updateColorThemePicker() {
  const id = getGuessColorThemeId();
  colorThemePicker?.querySelectorAll("[data-guess-colors]").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.guessColors === id);
  });
  const def = GUESS_COLOR_THEMES[id];
  if (colorThemeHintEl && def) {
    colorThemeHintEl.textContent = `${def.label} · ${def.blurb}`;
  }
}

function applyGuessColorTheme(themeId = getGuessColorThemeId()) {
  const id = GUESS_COLOR_THEMES[themeId] ? themeId : "ice";
  try {
    localStorage.setItem(COLOR_THEME_KEY, id);
  } catch {}
  document.body.setAttribute("data-guess-colors", id);
  updateColorThemePicker();
}

function setGuessColorTheme(themeId) {
  if (!GUESS_COLOR_THEMES[themeId]) return;
  applyGuessColorTheme(themeId);
  showMessage(`${GUESS_COLOR_THEMES[themeId].label} colors`, false, 1200);
}

function toggleTheme() {
  const next = document.body.classList.contains("light") ? "dark" : "light";
  localStorage.setItem(THEME_KEY, next);
  applyTheme(next);
}

function playSound(kind, extra) {
  window.HubSound?.play(kind, extra);
}

async function switchLanguage() {
  const idx = LANGUAGES.indexOf(currentLang);
  const nextLang = LANGUAGES[(idx + 1) % LANGUAGES.length];
  if (!(await ensureWordAssets(nextLang, currentLength))) return;
  currentLang = nextLang;
  localStorage.setItem(LANG_KEY, currentLang);
  updateLangButton();
  reloadBoard();
}

function todayLocal() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatDailyShort(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric"
  });
}

function hashSeed(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function createEmptyBoard() {
  return Array.from({ length: ROWS }, () =>
    Array.from({ length: COLS }, () => ({ letter: "", status: null }))
  );
}

function pickSecretWord() {
  const words = getWordList();
  return words[Math.floor(Math.random() * words.length)];
}

function pickDailyWord() {
  const words = getWordList();
  if (!words.length) return pickSecretWord();
  const seed = hashSeed(`wordle-daily|${todayLocal()}|${currentLang}|${DAILY_LENGTH}`);
  return words[seed % words.length];
}

function isDailyMode() {
  return playMode === "daily";
}

function isTodayDailyFinished(lang = currentLang, length = DAILY_LENGTH) {
  try {
    const key = `${STORAGE_KEY}-daily-${lang}-${length}-${todayLocal()}`;
    const raw = localStorage.getItem(key);
    if (!raw) return false;
    const data = JSON.parse(raw);
    return data && (data.gameStatus === "won" || data.gameStatus === "lost");
  } catch {
    return false;
  }
}

function setPlayMode(mode) {
  playMode = mode === "practice" ? "practice" : "daily";
  localStorage.setItem(MODE_KEY, playMode);
  applyLengthForMode();
}

function updateModeButton() {
  if (!modeBtn) return;
  if (isDailyMode()) {
    modeBtn.textContent = `Daily · ${formatDailyShort(todayLocal())}`;
    modeBtn.classList.add("is-daily");
    modeBtn.title = "Playing today's shared 5-letter word. Tap to switch to Practice.";
  } else {
    const label = getWordThemeDef()?.label || "Classic";
    modeBtn.textContent = label === "Classic" ? "Practice" : `Practice · ${label}`;
    modeBtn.classList.remove("is-daily");
    modeBtn.title =
      "Practice: themed word packs + Flex Length (4/5/6). Tap for today's Daily Guessword.";
  }
}

async function togglePlayMode() {
  const nextMode = isDailyMode() ? "practice" : "daily";
  const savedPracticeLength = Number(localStorage.getItem(LENGTH_KEY));
  const nextLength =
    nextMode === "daily"
      ? DAILY_LENGTH
      : LENGTHS.includes(savedPracticeLength)
        ? savedPracticeLength
        : DAILY_LENGTH;
  if (!(await ensureWordAssets(currentLang, nextLength))) return;
  setPlayMode(nextMode);
  reloadBoard();
  showMessage(
    isDailyMode() ? "Today's Daily Guessword" : "Practice · themes + Flex 4/5/6"
  );
}

function loadState() {
  try {
    let saved = localStorage.getItem(storageKey());
    // Older classic Practice saves had no theme suffix.
    if (!saved && !isDailyMode() && isClassicWordTheme()) {
      saved = localStorage.getItem(`${STORAGE_KEY}-${currentLang}-${currentLength}`);
    }
    if (saved) {
      const parsed = JSON.parse(saved);
      if (
        parsed.secretWord &&
        parsed.secretWord.length === currentLength &&
        parsed.board &&
        typeof parsed.currentRow === "number" &&
        typeof parsed.currentCol === "number" &&
        parsed.gameStatus &&
        (!isDailyMode() || parsed.dailyDate === todayLocal())
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
    secretWord: isDailyMode() ? pickDailyWord() : pickSecretWord(),
    board: createEmptyBoard(),
    currentRow: 0,
    currentCol: 0,
    gameStatus: "playing",
    keyStates: {},
    dailyDate: isDailyMode() ? todayLocal() : null
  };
}

function storageKey() {
  if (isDailyMode()) {
    return `${STORAGE_KEY}-daily-${currentLang}-${currentLength}-${todayLocal()}`;
  }
  const themePart = isClassicWordTheme() ? "classic" : wordTheme;
  return `${STORAGE_KEY}-${currentLang}-${currentLength}-${themePart}`;
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
  if (stats.wins > 0) window.HubLeaderboard?.submit("wordle", stats.wins);
  return stats;
}

function formatStreakTimeLeft(hours) {
  if (!(hours > 0)) return "";
  const totalMins = Math.max(1, Math.round(Number(hours) * 60));
  const days = Math.floor(totalMins / (60 * 24));
  const hrs = Math.floor((totalMins % (60 * 24)) / 60);
  const mins = totalMins % 60;
  if (days > 0) return hrs > 0 ? `${days}d ${hrs}h` : `${days}d`;
  if (hrs > 0) return mins > 0 && hrs < 8 ? `${hrs}h ${mins}m` : `${hrs}h`;
  return `${mins}m`;
}

function formatStreakHoursLeft(hours) {
  return formatStreakTimeLeft(hours) || null;
}

function renderStreakReminder() {
  if (!streakReminderEl || typeof HubStreak === "undefined") {
    streakReminderEl?.classList.add("hidden");
    return;
  }

  const status = HubStreak.getStatus();
  streakReminderEl.classList.remove("is-urgent", "is-done");
  const left = formatStreakTimeLeft(status.hoursLeft);

  if (status.playedToday && status.streak > 0) {
    const dayLabel = status.streak === 1 ? "day" : "days";
    streakReminderEl.textContent = left
      ? `Streak saved today! 🔥 ${status.streak} ${dayLabel} · dies in ${left} if you stop playing.`
      : `Streak saved for today! 🔥 ${status.streak} ${dayLabel}.`;
    streakReminderEl.classList.add("is-done");
    streakReminderEl.classList.remove("hidden");
    return;
  }

  if (status.streak > 0 && left) {
    streakReminderEl.textContent = `You haven't played today — streak dies in ${left}.`;
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

function markBuildSeen(id) {
  const build = String(id || window.WORDLE_BUILD || "");
  if (build) localStorage.setItem(SEEN_BUILD_KEY, build);
}

/** Unseen changelog builds from after last-seen up to the live WORDLE_BUILD (newest first). */
function getUnseenChangelogEntries() {
  const build = window.WORDLE_BUILD || "";
  const seen = getSeenBuild();
  if (!build || build === seen) return [];
  return getChangelogEntries()
    .filter((e) => e.id.localeCompare(seen) > 0 && e.id.localeCompare(build) <= 0)
    .sort((a, b) => b.id.localeCompare(a.id));
}

let whatsNewShowingId = "";

/** Popup only the latest build — never walk every missed update one click at a time. */
function showWhatsNew() {
  const build = window.WORDLE_BUILD || "";
  if (!build || build === getSeenBuild()) return false;

  const notes = Array.isArray(CHANGELOG[build])
    ? CHANGELOG[build].map((n) => String(n || "").trim()).filter(Boolean)
    : [];
  if (!notes.length) {
    // If script.js is still cached without this build's CHANGELOG key, do NOT mark seen —
    // that was swallowing popups until several updates piled up.
    if (Object.prototype.hasOwnProperty.call(CHANGELOG, build)) {
      markBuildSeen(build);
    }
    return false;
  }

  whatsNewShowingId = build;
  if (whatsNewBuild) whatsNewBuild.textContent = build;
  if (whatsNewList) {
    whatsNewList.innerHTML = notes.map((note) => `<li>${escapeHtml(note)}</li>`).join("");
  }
  whatsNewModal?.classList.remove("hidden");
  return true;
}

/** Discord #updates — always try for the current build's notes (not tied to the modal). */
function announceHubBuildOnBoot() {
  const build = window.WORDLE_BUILD || "";
  const notes = CHANGELOG[build];
  if (!build || !notes?.length) return;
  try {
    window.HubDiscord?.maybeAnnounceHubBuild?.(build, notes)?.catch?.(() => {});
  } catch {}
}

/** Dismiss the latest What's new and catch up to the live build in one click. */
function hideWhatsNew() {
  const current = window.WORDLE_BUILD || whatsNewShowingId || "";
  whatsNewShowingId = "";
  if (current) markBuildSeen(current);
  try {
    renderUpdatesPanel?.();
    updateUpdatesButtonLabel(!updatesPanel?.classList.contains("hidden"));
  } catch {}
  whatsNewModal?.classList.add("hidden");
  return false;
}

function bindWhatsNewOk(onCaughtUp) {
  if (!whatsNewOkBtn || whatsNewOkBtn.dataset.bound === "1") {
    if (onCaughtUp) window.__whatsNewOnCaughtUp = onCaughtUp;
    return;
  }
  whatsNewOkBtn.dataset.bound = "1";
  whatsNewOkBtn.addEventListener("click", () => {
    const more = hideWhatsNew();
    if (more) return;
    const fn = window.__whatsNewOnCaughtUp;
    window.__whatsNewOnCaughtUp = null;
    if (typeof fn === "function") fn();
  });
  if (onCaughtUp) window.__whatsNewOnCaughtUp = onCaughtUp;
}

function getChangelogEntries() {
  return Object.keys(CHANGELOG)
    .filter((id) => Array.isArray(CHANGELOG[id]) && CHANGELOG[id].length)
    .sort((a, b) => b.localeCompare(a))
    .map((id) => ({ id, notes: CHANGELOG[id] }));
}

function formatUpdateBuildLabel(build) {
  const raw = String(build || "");
  // 20260903t → Sep 3, 2026
  const m = raw.match(/^(\d{4})(\d{2})(\d{2})([a-z]?)$/i);
  if (!m) return raw;
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const month = months[Number(m[2]) - 1] || m[2];
  const day = String(Number(m[3]));
  const letter = m[4] ? ` · ${m[4].toUpperCase()}` : "";
  return `${month} ${day}, ${m[1]}${letter}`;
}

function countUnseenUpdates() {
  const seen = getSeenBuild();
  const current = window.WORDLE_BUILD || "";
  if (!current || current === seen) return 0;
  return getChangelogEntries().filter((e) => e.id.localeCompare(seen) > 0).length;
}

function updateUpdatesButtonLabel(open = false) {
  if (!toggleUpdatesBtn) return;
  const unseen = countUnseenUpdates();
  if (open) {
    toggleUpdatesBtn.textContent = unseen > 0 ? `Hide updates · ${unseen} new` : "Hide updates";
  } else {
    toggleUpdatesBtn.textContent = unseen > 0 ? `Updates · ${unseen} new` : "Updates";
  }
}

function renderUpdatesPanel() {
  if (!updatesList) return;
  const entries = getChangelogEntries();
  const seen = getSeenBuild();
  const current = window.WORDLE_BUILD || "";
  if (updatesCount) updatesCount.textContent = `${entries.length}`;

  if (!entries.length) {
    updatesList.innerHTML = `<li class="updates-empty">No updates listed yet.</li>`;
    updateUpdatesButtonLabel(!updatesPanel?.classList.contains("hidden"));
    return;
  }

  updatesList.innerHTML = entries
    .map((entry, index) => {
      const isLatest = entry.id === current || index === 0;
      const isUnseen = entry.id.localeCompare(seen) > 0;
      const badges = [
        isLatest ? `<span class="updates-badge is-latest">Latest</span>` : "",
        isUnseen ? `<span class="updates-badge is-new">New</span>` : ""
      ]
        .filter(Boolean)
        .join("");
      const notes = entry.notes
        .map((note) => `<li>${escapeHtml(note)}</li>`)
        .join("");
      return `<li class="updates-item${isUnseen ? " is-unseen" : ""}">
        <details ${isLatest ? "open" : ""}>
          <summary>
            <span class="updates-summary-main">
              <span class="updates-build">${escapeHtml(formatUpdateBuildLabel(entry.id))}</span>
              <span class="updates-build-id">${escapeHtml(entry.id)}</span>
            </span>
            <span class="updates-badges">${badges}</span>
          </summary>
          <ul class="updates-notes">${notes}</ul>
        </details>
      </li>`;
    })
    .join("");

  updateUpdatesButtonLabel(!updatesPanel?.classList.contains("hidden"));
}

function applySiteConfig() {
  const cfg = window.SITE_CONFIG || { name: "My Games", domain: "" };
  document.title = cfg.name;
  const gamesTitle = document.getElementById("games-title");
  if (gamesTitle) gamesTitle.textContent = cfg.name;
  const downloadBtn = document.getElementById("download-app-btn");
  if (downloadBtn) {
    const url = String(cfg.desktopAppDownloadUrl || "").trim();
    if (url) downloadBtn.href = url;
    // Already running the desktop shell — no need to re-download.
    const onDesktop = document.documentElement.dataset.mygamesDesktop === "1";
    downloadBtn.classList.toggle("hidden", onDesktop || !url);
  }
}

function hideMenu() {
  menuModal.classList.add("hidden");
}

function updateWordThemePicker() {
  const daily = isDailyMode();
  wordThemePicker?.querySelectorAll("[data-word-theme]").forEach((btn) => {
    const id = btn.dataset.wordTheme;
    const active = daily ? id === "classic" : id === wordTheme;
    btn.classList.toggle("active", active);
    btn.disabled = daily && id !== "classic";
  });
  if (wordThemeHintEl) {
    const def = getWordThemeDef(daily ? "classic" : wordTheme);
    wordThemeHintEl.textContent = daily
      ? "Daily is always Classic · Themes unlock in Practice"
      : `${def?.label || "Classic"}${def?.blurb ? ` · ${def.blurb}` : ""} · Guesses still use the full dictionary`;
  }
}

async function setWordTheme(mode) {
  const def = getWordThemeDef(mode);
  if (!def) return;
  const next = def.id;
  const wasDaily = isDailyMode();
  const changed = next !== wordTheme || (next !== "classic" && wasDaily);
  if (next !== "classic" && wasDaily) {
    const savedPracticeLength = Number(localStorage.getItem(LENGTH_KEY));
    const nextLength = LENGTHS.includes(savedPracticeLength) ? savedPracticeLength : DAILY_LENGTH;
    if (!(await ensureWordAssets(currentLang, nextLength))) return;
  }
  wordTheme = next;
  try {
    localStorage.setItem(WORD_THEME_KEY, next);
  } catch {}
  if (next !== "classic" && wasDaily) {
    setPlayMode("practice");
  }
  updateWordThemePicker();
  if (!changed) return;
  stopConfetti();
  submitting = false;
  state = newGameState();
  saveState();
  render();
  updateModeButton();
  updateLengthButton();
  showMessage(`Theme: ${def.label}`);
}

function showMenu() {
  hideGamesScreen();
  const stats = loadStats();
  const won = state.gameStatus === "won";
  const lost = state.gameStatus === "lost";
  const finished = won || lost;
  const theme = getWordThemeDef(isDailyMode() ? "classic" : wordTheme);

  if (won) {
    menuTitle.textContent = isDailyMode() ? "Daily solved!" : "You Won!";
    menuSubtitle.textContent = getWinMessage(Math.max(0, state.currentRow));
  } else if (lost) {
    menuTitle.textContent = isDailyMode() ? "Daily complete" : "Game Over";
    menuSubtitle.textContent = `The word was ${state.secretWord.toUpperCase()}`;
  } else if (isDailyMode()) {
    menuTitle.textContent = "Daily Guessword";
    menuSubtitle.textContent = `Today's shared ${currentLength}-letter word · ${currentLang.toUpperCase()}. Same for everyone.`;
  } else {
    menuTitle.textContent = "Menu";
    menuSubtitle.textContent = `${theme?.label || "Classic"} practice · Resume or start a new word.`;
  }

  menuResumeBtn.classList.toggle("hidden", won);
  menuViewBoardBtn?.classList.toggle("hidden", !finished);
  if (menuNewWordBtn) {
    menuNewWordBtn.textContent = isDailyMode() ? "Practice" : "New Word";
  }
  menuDailyBtn?.classList.toggle("hidden", isDailyMode());
  menuShareDailyBtn?.classList.toggle("hidden", !(isDailyMode() && finished));
  updateWordThemePicker();
  updateColorThemePicker();

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

function getTodayDailyHubLabel() {
  const today = todayLocal();
  const prefix = `${STORAGE_KEY}-daily-`;
  const suffix = `-${today}`;
  let inProgress = false;
  let lost = false;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith(prefix) || !key.endsWith(suffix)) continue;
      const data = readJsonKey(key);
      if (!data) continue;
      if (data.gameStatus === "won") return "Daily solved";
      if (data.gameStatus === "lost") lost = true;
      if (data.gameStatus === "playing" && data.currentRow > 0) inProgress = true;
    }
  } catch {
    return "";
  }
  if (lost) return "Daily finished";
  if (inProgress) return "Daily in progress";
  return "";
}

function getHubScoreLocal(gameId) {
  switch (gameId) {
    case "wordle": {
      const stats = readJsonKey(STATS_KEY, null);
      const daily = getTodayDailyHubLabel();
      if (!stats || !stats.gamesPlayed) {
        return { label: daily || "No games yet", sort: 0 };
      }
      const pct = stats.gamesPlayed
        ? Math.round((stats.wins / stats.gamesPlayed) * 100)
        : 0;
      const base = `${stats.wins} wins · ${pct}% · streak ${stats.currentStreak || 0}`;
      return {
        label: daily ? `${daily} · ${base}` : base,
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
      // Only this account's hangman saves — don't sum leftover keys from other accounts
      let myId = "";
      try {
        myId = String(window.HubPlays?.getPlayerId?.() || localStorage.getItem("hub-player-id") || "");
      } catch {}
      if (myId) {
        const mine = readJsonKey(`hangman-stats-${myId}`, null);
        if (mine && typeof mine === "object") {
          bestStreak = Math.max(bestStreak, mine.bestStreak || 0);
          wins = Math.max(wins, mine.wins || 0);
        }
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
    case "clicker": {
      const score = readNumberKey("clicker-high-score-v3");
      if (!score) return { label: "No score yet", sort: 0 };
      const compact =
        typeof HubLeaderboard !== "undefined" && HubLeaderboard.formatScore
          ? HubLeaderboard.formatScore("clicker", score).replace(/^Best\s+/, "")
          : String(score);
      return { label: `Best ${compact}`, sort: score };
    }
    case "stacker": {
      const score = readNumberKey("stacker-high-score");
      return { label: score ? `Best ${score}` : "No score yet", sort: score };
    }
    case "crossy": {
      const score = readNumberKey("crossy-high-score");
      return { label: score ? `Best ${score}` : "No score yet", sort: score };
    }
    case "fishing": {
      const score = Math.max(
        readNumberKey("fishing-best-catch-v2"),
        readNumberKey("fishing-best-catch-v1")
      );
      if (!score) return { label: "No catch yet", sort: 0 };
      let fishingMeta = null;
      try {
        fishingMeta = JSON.parse(localStorage.getItem("fishing-best-catch-meta-v2") || "null");
      } catch {
        fishingMeta = null;
      }
      const label =
        typeof HubLeaderboard !== "undefined" && HubLeaderboard.formatScore
          ? HubLeaderboard.formatScore("fishing", score, { fishing: fishingMeta })
          : String(score);
      return { label: label.startsWith("Best ") ? label : `Best ${label}`, sort: score };
    }
    case "cows": {
      const score = readNumberKey("cows-best-tier-v1");
      if (!score) return { label: "No herd yet", sort: 0 };
      const label =
        typeof HubLeaderboard !== "undefined" && HubLeaderboard.formatScore
          ? HubLeaderboard.formatScore("cows", score)
          : String(score);
      return { label: label.startsWith("Best ") ? label : `Best ${label}`, sort: score };
    }
    case "dino": {
      const score = readNumberKey("dino-run-high-score");
      return { label: score ? `Best ${score}` : "No score yet", sort: score };
    }
    case "ramp": {
      const score = readNumberKey("ramp-rush-high-score");
      return { label: score ? `Best ${score}` : "No score yet", sort: score };
    }
    case "guac": {
      const score = readNumberKey("guac-a-mole-high-score");
      return { label: score ? `Best ${score}` : "No score yet", sort: score };
    }
    case "bubble": {
      const score = readNumberKey("bubble-pop-high-score");
      return { label: score ? `Best ${score}` : "No score yet", sort: score };
    }
    case "stickers": {
      const score = readNumberKey("sticker-garage-high-score");
      return { label: score ? `Best $${score}` : "No jobs yet", sort: score };
    }
    case "waves": {
      const score = readNumberKey("space-waves-high-score");
      return { label: score ? `Best ${score}m` : "No runs yet", sort: score };
    }
    case "cup": {
      const score = readNumberKey("cup-flow-high-score");
      return { label: score ? `Level ${score}` : "No pours yet", sort: score };
    }
    case "cafe": {
      const score = readNumberKey("cafe-queue-high-score");
      return { label: score ? `Best ${score}` : "No score yet", sort: score };
    }
    case "garden": {
      const score = readNumberKey("garden-snap-high-score");
      return { label: score ? `Best ${score}` : "No score yet", sort: score };
    }
    case "blockblast": {
      const score = readNumberKey("block-blast-high-score");
      return { label: score ? `Best ${score}` : "No score yet", sort: score };
    }
    case "lemmings": {
      const score = readNumberKey("lemmings-high-score");
      return { label: score ? `Best ${score}` : "No score yet", sort: score };
    }
    case "paper": {
      const pct = readNumberKey("paper-io-best-pct");
      if (!pct) return { label: "No claim yet", sort: 0 };
      return { label: `Best ${pct}%`, sort: pct };
    }
    case "mine": {
      const depth = readNumberKey("mine-depth-best-v1");
      const oreScore = readNumberKey("mine-best-ore-v1");
      const oreLabel =
        typeof HubLeaderboard !== "undefined" && HubLeaderboard.formatScore
          ? HubLeaderboard.formatScore("mine-ore", oreScore)
          : "";
      if (!depth && !oreScore) return { label: "No digs yet", sort: 0 };
      const depthPart = depth ? `${depth}m` : "—";
      const orePart = oreScore && oreLabel && oreLabel !== "—" ? ` · ${oreLabel}` : "";
      return { label: `Best ${depthPart}${orePart}`, sort: depth || oreScore };
    }
    default:
      return { label: "—", sort: 0 };
  }
}

/** Use your leaderboard personal best on game cards when it's better than (or fills in) local. */
function mergeLeaderboardOntoHubScore(gameId, local) {
  const base =
    local && typeof local === "object"
      ? local
      : { label: "—", sort: 0 };
  if (typeof HubLeaderboard === "undefined" || !HubLeaderboard.getMyEntry) return base;

  try {
    if (gameId === "mine") {
      const depthEntry = HubLeaderboard.getMyEntry("mine");
      const oreEntry = HubLeaderboard.getMyEntry("mine-ore");
      const localDepth = readNumberKey("mine-depth-best-v1");
      const localOre = readNumberKey("mine-best-ore-v1");
      const lbDepth = Math.floor(Number(depthEntry?.score) || 0);
      const lbOre = Math.floor(Number(oreEntry?.score) || 0);
      const depth = Math.max(localDepth, lbDepth);
      const oreScore = Math.max(localOre, lbOre);
      if (!depth && !oreScore) return base;
      const oreLabel = oreScore
        ? HubLeaderboard.formatScore("mine-ore", oreScore, oreEntry || undefined)
        : "";
      const depthPart = depth ? `${depth}m` : "—";
      const orePart = oreScore && oreLabel && oreLabel !== "—" ? ` · ${oreLabel}` : "";
      return { label: `Best ${depthPart}${orePart}`, sort: depth || oreScore };
    }

    const entry = HubLeaderboard.getMyEntry(gameId);
    const lbScore = Number(entry?.score);
    if (!entry || !Number.isFinite(lbScore) || lbScore <= 0) return base;

    const meta = HubLeaderboard.GAME_META?.[gameId] || {};
    const lowerBetter = !!meta.lowerBetter;
    const emptyLocal = !base.sort || /^(No |—)/i.test(String(base.label || ""));
    let localRaw = Number(base.sort) || 0;
    if (lowerBetter && localRaw > 0 && localRaw < 100000) {
      localRaw = 100000 - localRaw;
    }

    const lbBetter = emptyLocal
      ? true
      : lowerBetter
        ? lbScore < localRaw
        : lbScore > localRaw;
    if (!lbBetter) return base;

    let label = HubLeaderboard.formatScore(gameId, lbScore, entry);
    if (!label || label === "—") return base;
    if (gameId === "hangman") label = `best streak ${Math.floor(lbScore)}`;
    if (gameId === "connect-four" || gameId === "tictactoe") {
      label = `${Math.floor(lbScore)} CPU wins`;
    }
    if (gameId === "wordle") {
      const daily = getTodayDailyHubLabel();
      label = daily ? `${daily} · ${label}` : label;
    }
    const sort = lowerBetter ? Math.max(0, 100000 - lbScore) : lbScore;
    return { label, sort };
  } catch {
    return base;
  }
}

function getHubScore(gameId) {
  return mergeLeaderboardOntoHubScore(gameId, getHubScoreLocal(gameId));
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

function decorateGameCardThumbs() {
  if (!gamesGrid) return;
  const build = typeof window.WORDLE_BUILD === "string" ? window.WORDLE_BUILD : "";
  gamesGrid.querySelectorAll(".game-card[data-game]").forEach((card) => {
    if (card.querySelector(".game-card-thumb-wrap")) return;
    const id = String(card.dataset.game || "").trim();
    if (!id) return;
    const wrap = document.createElement("span");
    wrap.className = "game-card-thumb-wrap";
    wrap.setAttribute("aria-hidden", "true");
    const img = document.createElement("img");
    img.className = "game-card-thumb";
    img.src = `hub-thumbs/${encodeURIComponent(id)}.svg${build ? `?v=${encodeURIComponent(build)}` : ""}`;
    img.alt = "";
    img.loading = "lazy";
    img.decoding = "async";
    wrap.appendChild(img);
    card.insertBefore(wrap, card.firstChild);
  });
}

function renderMostPopularBadge() {
  if (!gamesGrid) return;
  const allowed = HUB_GAMES.map((g) => g.id);
  let popularId = "";
  try {
    popularId = String(window.HubPlays?.getMostPopularGameId?.(allowed) || "");
  } catch {
    popularId = "";
  }
  gamesGrid.querySelectorAll(".game-card[data-game]").forEach((card) => {
    const isPopular = !!popularId && card.dataset.game === popularId;
    card.classList.toggle("is-most-popular", isPopular);
    let badge = card.querySelector(".game-card-popular");
    if (isPopular) {
      const host = card.querySelector(".game-card-thumb-wrap") || card;
      if (!badge) {
        badge = document.createElement("span");
        badge.className = "game-card-popular";
        host.appendChild(badge);
      } else if (badge.parentElement !== host) {
        host.appendChild(badge);
      }
      badge.textContent = "Most played";
    } else if (badge) {
      badge.remove();
    }
  });
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

let selectedLeaderboardGame = "hub-points";

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

function normalizeSearch(q) {
  return String(q || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function matchesSearch(haystack, query) {
  if (!query) return true;
  return String(haystack || "")
    .toLowerCase()
    .includes(query);
}

function filterGamesGrid() {
  if (!gamesGrid) return;
  const q = normalizeSearch(gamesSearchInput?.value);
  let shown = 0;
  gamesGrid.querySelectorAll(".game-card[data-game]").forEach((card) => {
    const name = card.querySelector(".game-card-name")?.textContent || "";
    const desc = card.querySelector(".game-card-desc")?.textContent || "";
    const id = card.dataset.game || "";
    const ok = matchesSearch(`${name} ${desc} ${id}`, q);
    card.classList.toggle("hub-search-hidden", !ok);
    if (ok) shown += 1;
  });
  let empty = gamesGrid.querySelector(".games-search-empty");
  if (!q) {
    empty?.remove();
    return;
  }
  if (!empty) {
    empty = document.createElement("p");
    empty.className = "games-search-empty leaderboard-empty";
    gamesGrid.appendChild(empty);
  }
  empty.textContent = shown ? "" : "No games match that search.";
  empty.classList.toggle("hidden", shown > 0);
}

function filterLeaderboardPickerAndList() {
  if (!leaderboardGamePicker) return;
  const q = normalizeSearch(leaderboardSearchInput?.value);
  const searching = !!q;
  const searchFocused = document.activeElement === leaderboardSearchInput;
  const buttons = [...leaderboardGamePicker.querySelectorAll(".leaderboard-game-btn")];
  let visibleBtns = 0;
  let activeVisible = false;

  buttons.forEach((btn) => {
    const name = btn.textContent || "";
    const id = btn.dataset.game || "";
    const ok = matchesSearch(`${name} ${id}`, q);
    btn.classList.toggle("hub-search-hidden", !ok);
    if (ok) {
      visibleBtns += 1;
      if (btn.classList.contains("active")) activeVisible = true;
    }
  });

  if (leaderboardSearchEmpty) {
    leaderboardSearchEmpty.classList.toggle("hidden", !q || visibleBtns > 0);
  }

  // Only auto-switch board when not actively typing a search
  if (q && visibleBtns && !activeVisible && !searchFocused) {
    const first = buttons.find((b) => !b.classList.contains("hub-search-hidden"));
    if (first?.dataset.game) {
      selectedLeaderboardGame = first.dataset.game;
      buttons.forEach((b) => b.classList.toggle("active", b.dataset.game === selectedLeaderboardGame));
      renderLeaderboardList();
    }
  }

  // Filter player rows by name only (don't show everyone when query matches board title)
  if (leaderboardList) {
    const rows = [...leaderboardList.querySelectorAll("li")];
    rows.forEach((li) => {
      if (!searching) {
        li.classList.remove("hub-search-hidden");
        return;
      }
      const text = li.textContent || "";
      li.classList.toggle("hub-search-hidden", !matchesSearch(text, q));
    });
  }
}

function renderLeaderboardPicker() {
  if (!leaderboardGamePicker) return;
  const prevFocus = document.activeElement === leaderboardSearchInput;
  const prevQuery = leaderboardSearchInput?.value || "";
  leaderboardGamePicker.innerHTML = LEADERBOARD_GAMES.map(
    (game) =>
      `<button type="button" class="leaderboard-game-btn${
        game.id === selectedLeaderboardGame ? " active" : ""
      }" data-game="${game.id}">${escapeHtml(game.name)}</button>`
  ).join("");
  filterLeaderboardPickerAndList();
  if (prevFocus && leaderboardSearchInput) {
    try {
      leaderboardSearchInput.focus();
      const len = String(prevQuery).length;
      leaderboardSearchInput.setSelectionRange(len, len);
    } catch {}
  }
}

function renderLeaderboardList() {
  if (!leaderboardList || !leaderboardEmpty) return;
  if (typeof HubLeaderboard === "undefined") {
    leaderboardList.innerHTML = "";
    leaderboardEmpty.textContent = "Leaderboards unavailable right now.";
    leaderboardEmpty.classList.remove("hidden");
    return;
  }

  const rows = HubLeaderboard.getBoard(selectedLeaderboardGame);
  if (!rows.length) {
    leaderboardList.innerHTML = "";
    leaderboardEmpty.textContent =
      selectedLeaderboardGame === "hub-points"
        ? "No hub points yet — place top 10 on any board to earn them."
        : selectedLeaderboardGame === "online-time"
          ? "No time logged yet — stay on the site with a username to claim #1."
          : selectedLeaderboardGame === "day-streak"
            ? "No day streaks yet — play any game to start your streak."
            : selectedLeaderboardGame === "invites"
              ? "No invites yet — share your invite link to climb this board."
              : "No scores yet — play to claim #1.";
    leaderboardEmpty.classList.remove("hidden");
    return;
  }

  leaderboardEmpty.classList.add("hidden");
  const showPlacementPts = selectedLeaderboardGame !== "hub-points";
  leaderboardList.innerHTML = rows
    .map((row) => {
      const rankClass = row.rank <= 3 ? "lb-rank top" : "lb-rank";
      const pts = Number(row.points) || 0;
      const ptsHtml =
        showPlacementPts && pts > 0
          ? `<span class="lb-points" title="Placement points for this board">+${pts}</span>`
          : showPlacementPts
            ? `<span class="lb-points is-zero" title="Outside top 10 — 0 points">0</span>`
            : "";
      return `<li class="${row.isYou ? "is-you" : ""}">
        <span class="${rankClass}">#${row.rank}</span>
        <span class="lb-name">${formatPlayerNameHtml(row.name)}${row.isYou ? " (you)" : ""}</span>
        <span class="lb-score-wrap">
          ${ptsHtml}
          <span class="lb-score">${escapeHtml(row.label)}</span>
        </span>
      </li>`;
    })
    .join("");
  filterLeaderboardPickerAndList();
}

async function refreshLeaderboardsPanel(opts = {}) {
  if (!leaderboardsPanel || leaderboardsPanel.classList.contains("hidden")) return;
  const doSync = opts.sync !== false;
  const searching = !!(leaderboardSearchInput && normalizeSearch(leaderboardSearchInput.value));
  if (typeof HubPlays !== "undefined") {
    HubPlays.tickOnlineTime?.();
    HubPlays.reconcileOnlineSeconds?.();
  }
  // Don't rebuild the picker every tick while searching — it fights the input
  if (!searching || opts.forcePicker) {
    renderLeaderboardPicker();
  } else {
    filterLeaderboardPickerAndList();
  }
  if (doSync && typeof HubLeaderboard !== "undefined") {
    try {
      await HubLeaderboard.sync(true);
    } catch {}
    HubPlays?.reconcileOnlineSeconds?.();
  }
  renderLeaderboardList();
  try {
    renderCardScoresAndFavorites();
    renderHighScoresList();
  } catch {}
  try {
    HubPlays?.refreshHubPointsTitles?.(true);
    renderTitlePicker();
    if (playersRosterMode) renderPlayersRoster(playersRosterMode);
  } catch {}
}

let leaderboardRefreshTimer = null;
let leaderboardRefreshTick = 0;

function startLeaderboardRefresh() {
  stopLeaderboardRefresh();
  leaderboardRefreshTick = 0;
  refreshLeaderboardsPanel({ sync: true });
  leaderboardRefreshTimer = setInterval(() => {
    leaderboardRefreshTick += 1;
    // Re-render every second; sync from network every 5s.
    refreshLeaderboardsPanel({ sync: leaderboardRefreshTick % 5 === 0 });
  }, 1000);
}

function stopLeaderboardRefresh() {
  if (!leaderboardRefreshTimer) return;
  clearInterval(leaderboardRefreshTimer);
  leaderboardRefreshTimer = null;
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
  const left = formatStreakTimeLeft(status?.hoursLeft || 0);
  if (streak > 0 && left) {
    lines.push(`⏳ Dies in ${left} without another play`);
  }
  if (rows.length) {
    lines.push("🏆 Top scores:");
    rows.forEach((row) => lines.push(`• ${row.name}: ${row.label}`));
  }
  lines.push(url);
  return lines.join("\n");
}

function buildHubInviteShareUrl() {
  try {
    const fromApi = window.HubReferrals?.getInviteUrl?.();
    if (fromApi && String(fromApi).includes("ref=")) return String(fromApi);
  } catch {}
  try {
    const raw = window.HubPlays?.getPlayerCode?.() || "";
    const formatted =
      (typeof window.HubPlays?.formatPlayerCode === "function" && HubPlays.formatPlayerCode(raw)) ||
      String(raw || "").trim().toUpperCase();
    const norm = String(formatted || "").replace(/[^23456789ABCDEFGHJKLMNPQRSTUVWXYZ]/gi, "");
    const origin = window.location.origin || "https://icedragon1st.github.io";
    if (norm.length === 8) {
      const dashed = `${norm.slice(0, 4)}-${norm.slice(4)}`;
      return `${origin}/?ref=${encodeURIComponent(dashed)}#games`;
    }
  } catch {}
  return `${window.location.origin || "https://icedragon1st.github.io"}/#games`;
}

async function shareMoment() {
  const cfg = window.SITE_CONFIG || { name: "My Games" };
  const url = buildHubInviteShareUrl();
  const isInvite = url.includes("ref=");
  const status =
    (typeof window.HubReferrals?.getStatus === "function" && HubReferrals.getStatus()) || null;
  const progress =
    status && !status.unlocked
      ? ` · ${Math.min(status.count || 0, status.need || 3)}/${status.need || 3} toward INVITER`
      : status?.unlocked
        ? " · INVITER unlocked"
        : "";
  const payload = {
    title: cfg.name || "My Games",
    text: isInvite
      ? `Play on ${cfg.name || "My Games"} — join with my invite:`
      : `Play on ${cfg.name || "My Games"}:`,
    url
  };

  try {
    if (navigator.share) {
      await navigator.share(payload);
      showGamesMessage(
        isInvite ? `Invite shared!${progress}` : "Shared!",
        2200
      );
      try {
        refreshInviteProgressUI?.();
      } catch {}
      return;
    }
  } catch {
    // fall back to clipboard
  }

  try {
    await navigator.clipboard.writeText(url);
    showGamesMessage(
      isInvite ? `Invite link copied!${progress}` : "Link copied!",
      2400
    );
    try {
      refreshInviteProgressUI?.();
    } catch {}
  } catch {
    showGamesMessage("Sharing not available on this browser yet.", 2600);
  }
}

function recordHubDailyPlay() {
  if (typeof HubStreak === "undefined") return null;
  const result = HubStreak.recordPlay();
  if (window.HubAchievements && result) {
    if (result.streak >= 3)  HubAchievements.unlock("streak_3");
    if (result.streak >= 7)  HubAchievements.unlock("streak_7");
    if (result.streak >= 14) HubAchievements.unlock("streak_14");
    if (result.streak >= 30) HubAchievements.unlock("streak_30");
  }
  try {
    const best = Math.max(Number(result?.best) || 0, Number(result?.streak) || 0);
    if (best > 0 && typeof HubLeaderboard !== "undefined") {
      HubLeaderboard.submit("day-streak", best).catch(() => {});
    }
  } catch {}
  return result;
}

function submitDayStreakToLeaderboard() {
  try {
    if (typeof HubStreak === "undefined" || typeof HubLeaderboard === "undefined") return;
    const status = HubStreak.getStatus?.() || {};
    const best = Math.max(Number(status.best) || 0, Number(status.streak) || 0);
    if (best > 0) HubLeaderboard.submit("day-streak", best).catch(() => {});
  } catch {}
}

function renderDailyStreak() {
  if (!hubStreakBadge || !hubStreakCount || typeof HubStreak === "undefined") return;

  const status = HubStreak.getStatus();
  hubStreakCount.textContent = String(status.streak);
  hubStreakBadge.classList.toggle("is-active", status.streak > 0 && !status.playedToday);
  hubStreakBadge.classList.toggle("is-done", !!status.playedToday && status.streak > 0);
  hubStreakBadge.classList.toggle("is-urgent", status.streak > 0 && !status.playedToday);

  const left = formatStreakTimeLeft(status.hoursLeft);
  if (hubStreakTimer) {
    if (status.streak > 0 && left) {
      hubStreakTimer.textContent = status.playedToday ? `· ${left} left` : `· dies in ${left}`;
      hubStreakTimer.classList.remove("hidden");
      hubStreakBadge.title = status.playedToday
        ? `Streak saved today. Play again within ${left} to keep it alive.`
        : `Play any game within ${left} or your streak dies.`;
    } else {
      hubStreakTimer.textContent = "";
      hubStreakTimer.classList.add("hidden");
      hubStreakBadge.title = "Play any game within 48 hours to keep your streak";
    }
  }

  if (status.celebrate) {
    const dayLabel = status.streak === 1 ? "day" : "days";
    const tip = left ? ` Dies in ${left} if you don't play again.` : "";
    showGamesMessage(`🔥 ${status.streak} ${dayLabel} streak!${tip}`, 3500);
    HubStreak.clearCelebration();
  }
}
window.renderDailyStreak = renderDailyStreak;
document.addEventListener("hub-streak-restored", () => {
  try {
    renderDailyStreak();
    showGamesMessage("🔥 Streak restored to 28", 2800);
  } catch {}
});
document.addEventListener("hub-streak-changed", () => {
  try {
    renderDailyStreak();
  } catch {}
});

function startStreakCountdown() {
  if (streakTimerInterval) return;
  streakTimerInterval = setInterval(() => {
    if (!gamesScreen || gamesScreen.classList.contains("hidden")) return;
    renderDailyStreak();
  }, 30000);
}

function stopStreakCountdown() {
  if (!streakTimerInterval) return;
  clearInterval(streakTimerInterval);
  streakTimerInterval = null;
}

function maybeClaimDailyHubCoins() {
  try {
    if (typeof HubCoins === "undefined" || !HubCoins.canClaimDaily?.()) return;
    const res = HubCoins.claimDaily();
    if (res?.ok) {
      showGamesMessage(`Daily reward: +${res.gained} coins`, 2200);
      updateCoinsButtonLabel?.(coinsPanel && !coinsPanel.classList.contains("hidden"));
    }
  } catch {}
}

function refreshGamesHub() {
  decorateGameCardThumbs();
  renderMostPopularBadge();
  renderContinueButton();
  renderCardScoresAndFavorites();
  sortGamesGrid();
  filterGamesGrid();
  renderHighScoresList();
  renderDailyStreak();
  try {
    HubCoins?.refreshUi?.();
    updateCoinsButtonLabel?.(coinsPanel && !coinsPanel.classList.contains("hidden"));
  } catch {}
  maybeClaimDailyHubCoins();
  try {
    window.HubPlays?.syncPopularity?.()?.then?.(() => {
      try {
        renderMostPopularBadge();
        sortGamesGrid();
        filterGamesGrid();
      } catch {}
    });
  } catch {}
  // Pull leaderboard PBs so cards match what's on the boards (other devices / wiped local)
  try {
    if (typeof HubLeaderboard !== "undefined" && HubLeaderboard.sync) {
      HubLeaderboard.sync(false)
        .then(() => {
          try {
            renderCardScoresAndFavorites();
            renderHighScoresList();
          } catch {}
        })
        .catch(() => {});
    }
  } catch {}
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
try {
  window.showGamesMessage = showGamesMessage;
} catch {}

function updateHubOfflineBanner() {
  const el = document.getElementById("hub-offline-banner");
  if (!el) return;
  let offline = false;
  try {
    offline =
      (window.HubNet && HubNet.isOnline && !HubNet.isOnline()) ||
      (typeof navigator !== "undefined" && navigator.onLine === false);
  } catch {
    offline = false;
  }
  el.classList.toggle("hidden", !offline);
}
try {
  window.addEventListener("online", updateHubOfflineBanner);
  window.addEventListener("offline", updateHubOfflineBanner);
  window.addEventListener("hub-net", updateHubOfflineBanner);
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", updateHubOfflineBanner, { once: true });
  } else {
    updateHubOfflineBanner();
  }
} catch {}

function currentHubPlayerKey() {
  return String((typeof HubPlays !== "undefined" && HubPlays.getName?.()) || "")
    .trim()
    .toLowerCase();
}

function isHubOwner() {
  return isCreatorName(currentHubPlayerKey());
}

function canUseHubTheme(themeId) {
  const def = HUB_THEMES[themeId];
  if (!def) return false;
  if (Array.isArray(def.allowedNames) && def.allowedNames.length) {
    return def.allowedNames.includes(currentHubPlayerKey());
  }
  if (def.ownerOnly && !isHubOwner()) return false;
  return true;
}

function getHubThemeId() {
  const raw = localStorage.getItem(HUB_THEME_KEY) || "classic";
  return canUseHubTheme(raw) ? raw : "classic";
}

function updateHubThemePicker() {
  hubThemePicker?.querySelectorAll("[data-hub-theme]").forEach((btn) => {
    const id = btn.dataset.hubTheme;
    const show = canUseHubTheme(id);
    btn.hidden = !show;
    btn.classList.toggle("hidden", !show);
  });
}

/** Apply hub look. Pass a theme id to save it; call with no args to refresh UI only (won't overwrite storage). */
function applyHubTheme(themeId) {
  const explicit = arguments.length > 0 && themeId != null;
  const raw = explicit ? String(themeId) : localStorage.getItem(HUB_THEME_KEY) || "classic";
  if (explicit && canUseHubTheme(raw)) {
    try {
      localStorage.setItem(HUB_THEME_KEY, raw);
    } catch {}
  }
  const id = canUseHubTheme(raw) ? raw : "classic";
  if (gamesScreen) {
    [...gamesScreen.classList].forEach((cls) => {
      if (cls.startsWith("hub-theme-")) gamesScreen.classList.remove(cls);
    });
    if (id !== "classic") gamesScreen.classList.add(`hub-theme-${id}`);
  }
  if (gamesEyebrow) gamesEyebrow.textContent = HUB_THEMES[id]?.eyebrow || "Hub";
  updateHubThemePicker();
  hubThemePicker?.querySelectorAll("[data-hub-theme]").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.hubTheme === id);
  });
}

function showGamesScreen() {
  hideMenu();
  document.documentElement.classList.remove("playing-guessword", "boot-guessword");
  try {
    HubPlays?.setActiveGame?.("hub");
  } catch {}
  try {
    window.HubAudio?.setTheme?.("hub");
  } catch {}
  gamesMessageEl.classList.remove("visible");
  gamesMessageEl.textContent = "";
  try {
    updateHubOfflineBanner();
  } catch {}
  if (highScoresPanel) highScoresPanel.classList.add("hidden");
  if (leaderboardsPanel) leaderboardsPanel.classList.add("hidden");
  if (hubSettingsPanel) hubSettingsPanel.classList.add("hidden");
  if (feedbackPanel) feedbackPanel.classList.add("hidden");
  try {
    window.HubAdmin?.close?.();
  } catch {}
  if (toggleLeaderboardsBtn) toggleLeaderboardsBtn.textContent = "Leaderboards";
  if (toggleSettingsBtn) toggleSettingsBtn.textContent = "⚙ Settings";
  if (toggleFeedbackBtn) updateFeedbackButtonLabel(false);
  stopLeaderboardRefresh();
  applyHubTheme();
  refreshGamesHub();
  gamesScreen.classList.remove("hidden");
  startStreakCountdown();
  setTimeout(checkPendingAchievements, 400);
  maybeAskPlayerName();
  if (window.HubPlays) HubPlays.sync().catch(() => {});
  if (window.HubFeedback) HubFeedback.sync().catch(() => {});
  if (window.HubNotifications) HubNotifications.start?.();
  refreshOnlineCount();
  startOnlineCountPolling();
  updateUpdatesButtonLabel(false);
  updateFeedbackButtonLabel(false);
  maybeOpenHubHash();
}

function hideGamesScreen() {
  stopStreakCountdown();
  if (gamesScreen) {
    gamesScreen.classList.remove("hub-flip");
    gamesScreen.style.transform = "";
    gamesScreen.style.transformOrigin = "";
    gamesScreen.style.transition = "";
  }
  document.documentElement.classList.remove("hub-flip");
  gamesScreen.classList.add("hidden");
  document.documentElement.classList.add("playing-guessword");
  try {
    window.HubAudio?.setTheme?.("wordle");
  } catch {}
}

/** Easter egg: tap/click "My Games" title 7× → flip hub for 5s. */
(function bindHubFlipEgg() {
  if (!gamesScreen) return;

  let clicks = 0;
  let clickReset = 0;
  let flipTimer = 0;

  function isTitleHit(el) {
    if (!el || !el.closest) return false;
    return !!(el.closest("#games-title") || el.closest(".games-title-wrap"));
  }

  function setFlipped(on) {
    gamesScreen.classList.toggle("hub-flip", on);
    // Inline too — survives a stale styles.css cache
    if (on) {
      gamesScreen.style.transform = "rotate(180deg)";
      gamesScreen.style.transformOrigin = "center center";
      gamesScreen.style.transition = "transform 0.55s cubic-bezier(0.4, 0.05, 0.2, 1)";
    } else {
      gamesScreen.style.transform = "";
      gamesScreen.style.transformOrigin = "";
      gamesScreen.style.transition = "";
    }
  }

  gamesScreen.addEventListener(
    "pointerdown",
    (e) => {
      if (e.button != null && e.button !== 0) return;
      if (!isTitleHit(e.target)) return;
      e.preventDefault();
      e.stopPropagation();
      try {
        window.getSelection?.()?.removeAllRanges?.();
      } catch {}

      if (gamesScreen.classList.contains("hub-flip")) return;

      clicks += 1;
      clearTimeout(clickReset);
      clickReset = setTimeout(() => {
        clicks = 0;
      }, 8000);

      if (clicks < 7) return;

      clicks = 0;
      clearTimeout(clickReset);
      setFlipped(true);
      window.HubSound?.play?.("score");
      clearTimeout(flipTimer);
      flipTimer = setTimeout(() => setFlipped(false), 5000);
    },
    true
  );
})();

function backFromGames() {
  hideGamesScreen();
  showMenu();
}

async function selectGame(gameId) {
  if (!requirePlayerName()) return;
  try {
    if (window.HubAdmin?.isSoftLocked?.()) {
      const maint = HubAdmin.getMaintenance?.();
      showGamesMessage(maint?.message || "Hub maintenance — games locked", 2800);
      return;
    }
  } catch {}
  const game = getHubGame(gameId);
  if (!game) {
    showGamesMessage("Coming soon");
    return;
  }

  setLastGameId(gameId);
  recordHubDailyPlay();
  if (window.HubPlays) HubPlays.record(gameId);
  try {
    renderMostPopularBadge();
  } catch {}
  // Track all-rounder achievement
  if (window.HubAchievements) {
    try {
      const played = JSON.parse(localStorage.getItem("hub-played-games") || "[]");
      if (!played.includes(gameId)) played.push(gameId);
      localStorage.setItem("hub-played-games", JSON.stringify(played));
      if (played.length >= 5) HubAchievements.unlock("five_games");
      const allIds = HUB_GAMES.map(g => g.id);
      if (allIds.every(id => played.includes(id))) HubAchievements.unlock("all_rounder");
    } catch {}
  }

  try {
    window.HubAudio?.setTheme?.(gameId);
  } catch {}

  if (!game.path) {
    const nextMode = isTodayDailyFinished() ? "practice" : "daily";
    const savedPracticeLength = Number(localStorage.getItem(LENGTH_KEY));
    const nextLength =
      nextMode === "daily"
        ? DAILY_LENGTH
        : LENGTHS.includes(savedPracticeLength)
          ? savedPracticeLength
          : DAILY_LENGTH;
    if (!(await ensureWordAssets(currentLang, nextLength))) return;
    setPlayMode(nextMode);
    reloadBoard();
    hideMenu();
    hideGamesScreen();
    if (isTodayDailyFinished()) {
      showMessage("Daily done — Practice mode");
    }
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
  const key = String(letter || "").toUpperCase();
  if (!key || !status) return;
  const current = state.keyStates[key];
  if (!current || rank[status] > rank[current]) {
    state.keyStates[key] = status;
  }
}

function paintKeyboardKey(letter) {
  const key = String(letter || "").toUpperCase();
  const status = state.keyStates[key];
  if (!key || !status || !keyboardEl) return;
  const btn = keyboardEl.querySelector(`[data-key="${key}"]`);
  if (!btn) return;
  btn.classList.remove("correct", "present", "absent");
  btn.classList.add(status);
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
  if (!hintBtn) return;
  hintBtn.disabled = true;
  hintBtn.hidden = true;
  hintBtn.classList.add("hidden");
  hintBtn.title = "Hints are disabled for now";
}

function useHint() {
  showMessage("Hints are disabled for now", true);
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
  if (!requirePlayerName()) return;
  if (submitting || state.gameStatus !== "playing") return;
  if (state.currentCol < COLS) {
    showMessage("Not enough letters", true);
    shakeRow(state.currentRow);
    playSound("error");
    return;
  }

  const guess = getCurrentGuess().toLowerCase();
  if (!isValidGuess(guess)) {
    showMessage(`Not in dictionary (${currentLength} ${currentLang.toUpperCase()})`, true);
    shakeRow(state.currentRow);
    playSound("error");
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
  const stats = recordGameResult(true);
  if (window.HubAchievements) {
    HubAchievements.unlock("wordle_first_win");
    if (row === 0) HubAchievements.unlock("wordle_guess_1");
    if (row <= 1) HubAchievements.unlock("wordle_guess_2");
    if (row <= 2) HubAchievements.unlock("wordle_guess_3");
    if (stats.wins >= 5) HubAchievements.unlock("wordle_win_5");
    if (stats.wins >= 10) HubAchievements.unlock("wordle_win_10");
    if (stats.wins >= 25) HubAchievements.unlock("wordle_win_25");
    if (stats.currentStreak >= 3) HubAchievements.unlock("wordle_streak_3");
    if (isDailyMode()) HubAchievements.unlock("wordle_daily");
  }
  try {
    window.HubCoins?.rewardWin?.();
  } catch {}
  showMessage(getWinMessage(row), false, 0);
  saveState();
  renderKeyboard();
  updateHintButton();
  playSound("win");
  setTimeout(checkPendingAchievements, 600);
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
  playSound("lose");
  showMenu();
}

function stopConfetti() {
  window.HubConfetti?.stop();
}

function launchConfetti() {
  window.HubConfetti?.burst();
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

function stampTile(tile, duration = 700) {
  return new Promise((resolve) => {
    const prevTransition = tile.style.transition;
    const prevAnimation = tile.style.animation;
    const prevTransform = tile.style.transform;
    const prevFilter = tile.style.filter;
    tile.style.transition = "none";
    tile.style.animation = "none";
    tile.classList.add("flip");

    const start = performance.now();
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      // Ice melt: freeze up → drip/squash → settle into color
      let sx = 1;
      let sy = 1;
      let y = 0;
      let bright = 1;
      let sat = 1;
      if (t < 0.32) {
        const p = t / 0.32;
        sx = 0.92 + 0.02 * p;
        sy = 1.18 - 0.08 * p;
        y = -12 + 4 * p;
        bright = 1.4 - 0.15 * p;
        sat = 0.35 + 0.2 * p;
      } else if (t < 0.58) {
        const p = (t - 0.32) / 0.26;
        const ease = p * p;
        sx = 0.94 + 0.22 * ease;
        sy = 1.1 - 0.42 * ease;
        y = -8 + 22 * ease;
        bright = 1.25 - 0.2 * p;
        sat = 0.55 + 0.35 * p;
      } else {
        const p = (t - 0.58) / 0.42;
        const ease = 1 - Math.pow(1 - p, 3);
        sx = 1.16 - 0.16 * ease;
        sy = 0.68 + 0.32 * ease;
        y = 14 - 14 * ease;
        bright = 1.05 - 0.05 * ease;
        sat = 0.9 + 0.1 * ease;
      }
      tile.style.transform = `translateY(${y}px) scale(${sx}, ${sy})`;
      tile.style.filter = `brightness(${bright}) saturate(${sat})`;
      if (t < 1) {
        requestAnimationFrame(tick);
      } else {
        tile.style.transform = prevTransform;
        tile.style.filter = prevFilter;
        tile.style.transition = prevTransition;
        tile.style.animation = prevAnimation;
        tile.classList.remove("flip");
        resolve();
      }
    };
    requestAnimationFrame(tick);
  });
}

async function animateRowFlip(rowIndex) {
  const rowEl = boardEl.querySelector(`[data-row="${rowIndex}"]`);
  if (!rowEl) return;

  const tiles = rowEl.querySelectorAll(".tile");
  for (let i = 0; i < tiles.length; i++) {
    const tile = tiles[i];
    const status = state.board[rowIndex][i].status;
    playSound("flip", status);

    const paintTimer = setTimeout(() => {
      tile.classList.add(status);
      paintKeyboardKey(state.board[rowIndex][i].letter);
    }, 380);

    await stampTile(tile, 700);
    clearTimeout(paintTimer);
    tile.classList.add(status);
    paintKeyboardKey(state.board[rowIndex][i].letter);
    await delay(60);
  }
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isMenuOpen() {
  return !menuModal.classList.contains("hidden") || isGamesScreenOpen();
}

function addLetter(letter) {
  if (!hasPlayerName()) {
    requirePlayerName();
    return;
  }
  if (submitting || state.gameStatus !== "playing" || isMenuOpen()) return;
  if (state.currentCol >= COLS) return;

  state.board[state.currentRow][state.currentCol].letter = letter;
  state.currentCol++;
  saveState();
  renderBoard();
  playSound("key");
}

function removeLetter() {
  if (!hasPlayerName()) {
    requirePlayerName();
    return;
  }
  if (submitting || state.gameStatus !== "playing" || isMenuOpen()) return;
  if (state.currentCol <= 0) return;

  state.currentCol--;
  state.board[state.currentRow][state.currentCol].letter = "";
  saveState();
  renderBoard();
  playSound("back");
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

function isUsernameGateOpen() {
  const hubModal = document.getElementById("player-name-modal");
  if (hubModal && !hubModal.classList.contains("hidden")) return true;
  const gate = document.getElementById("username-gate-modal");
  if (gate && !gate.classList.contains("hidden")) return true;
  return typeof HubPlays !== "undefined" && !hasPlayerName();
}

function isTypingInField(event) {
  const el = event?.target;
  if (!el) return false;
  const tag = String(el.tagName || "").toUpperCase();
  return tag === "INPUT" || tag === "TEXTAREA" || !!el.isContentEditable;
}

function handlePhysicalKeyboard(event) {
  // Let username / text fields keep Backspace, letters, Enter, etc.
  if (isTypingInField(event) || isUsernameGateOpen()) return;

  if (isGamesScreenOpen()) {
    if (event.key === "Escape") {
      event.preventDefault();
      // Esc on hub opens Settings (does not leave My Games).
      // Close overlays first; AFK / Help / Admin already swallow Esc in capture.
      if (typeof isCoinsShopOpen === "function" && isCoinsShopOpen()) {
        setCoinsShopOpen(false);
        return;
      }
      const profileModal = document.getElementById("player-profile-modal");
      if (profileModal && !profileModal.classList.contains("hidden")) {
        closePlayerProfileModal();
        return;
      }
      setHubSettingsOpen(!isHubSettingsOpen());
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

function startPracticeGame() {
  setPlayMode("practice");
  stopConfetti();
  submitting = false;
  hideMenu();
  hideGamesScreen();
  state = newGameState();
  saveState();
  render();
  updateModeButton();
  messageEl.classList.remove("visible");
  messageEl.textContent = "";
  showMessage("Practice game started");
}

function goToDaily() {
  setPlayMode("daily");
  reloadBoard();
  hideMenu();
  hideGamesScreen();
  showMessage("Today's Daily Guessword");
}

function reloadBoard() {
  stopConfetti();
  submitting = false;
  state = loadState();
  saveState();
  render();
  updateModeButton();
}

function resumeGame() {
  hideMenu();
  hideGamesScreen();
}

function buildDailyShareText() {
  const cfg = window.SITE_CONFIG || { name: "My Games" };
  const guesses = state.gameStatus === "won" ? state.currentRow + 1 : "X";
  const rows = state.board
    .filter((row) => row.some((cell) => cell.status))
    .map((row) =>
      row
        .map((cell) => {
          if (cell.status === "correct") return "🟩";
          if (cell.status === "present") return "🟨";
          return "⬛";
        })
        .join("")
    )
    .join("\n");
  return `${cfg.name} Daily ${currentLength}\n${guesses}/${ROWS}\n${rows}`;
}

async function shareDailyResult() {
  const text = buildDailyShareText();
  try {
    if (navigator.share) {
      await navigator.share({ title: "Daily Guessword", text });
      showMessage("Shared!");
      return;
    }
  } catch {
    // clipboard fallback
  }
  try {
    await navigator.clipboard.writeText(text);
    showMessage("Result copied");
  } catch {
    showMessage("Sharing not available", true);
  }
}

injectShakeAnimation();
updateLangButton();
updateLengthButton();
updateModeButton();
applyTheme(localStorage.getItem(THEME_KEY) || "dark");
applyGuessColorTheme();
applyHubTheme();
if (state) render();
document.addEventListener("keydown", handlePhysicalKeyboard);
menuBtn.addEventListener("click", () => showMenu());
menuResumeBtn.addEventListener("click", () => {
  if (!requirePlayerName()) return;
  resumeGame();
});
menuViewBoardBtn?.addEventListener("click", () => {
  if (state.gameStatus !== "won" && state.gameStatus !== "lost") return;
  hideMenu();
  if (messageEl && !/menu/i.test(messageEl.textContent || "")) {
    const base = (messageEl.textContent || "").trim();
    messageEl.textContent = base
      ? `${base} · Tap Menu for options.`
      : "Tap Menu to return to the result screen.";
  }
});
menuNewWordBtn.addEventListener("click", () => {
  if (!requirePlayerName()) return;
  startPracticeGame();
});
menuDailyBtn?.addEventListener("click", () => {
  if (!requirePlayerName()) return;
  goToDaily();
});
menuShareDailyBtn?.addEventListener("click", () => shareDailyResult());
menuGamesBtn.addEventListener("click", () => showGamesScreen());
wordThemePicker?.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-word-theme]");
  if (!btn || btn.disabled) return;
  if (!requirePlayerName()) return;
  setWordTheme(btn.dataset.wordTheme);
});
colorThemePicker?.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-guess-colors]");
  if (!btn) return;
  setGuessColorTheme(btn.dataset.guessColors);
});
continueLastBtn?.addEventListener("click", () => {
  if (!requirePlayerName()) return;
  const lastId = getLastGameId();
  if (lastId) selectGame(lastId);
});
toggleScoresBtn?.addEventListener("click", () => {
  if (!highScoresPanel) return;
  const open = highScoresPanel.classList.toggle("hidden") === false;
  toggleScoresBtn.textContent = open ? "Hide scores" : "High scores";
  if (open) {
    if (leaderboardsPanel) leaderboardsPanel.classList.add("hidden");
    if (toggleLeaderboardsBtn) toggleLeaderboardsBtn.textContent = "Leaderboards";
    stopLeaderboardRefresh();
    renderHighScoresList();
  }
});

toggleLeaderboardsBtn?.addEventListener("click", () => {
  if (!leaderboardsPanel) return;
  const open = leaderboardsPanel.classList.toggle("hidden") === false;
  toggleLeaderboardsBtn.textContent = open ? "Hide leaderboards" : "Leaderboards";
  if (open) {
    if (highScoresPanel) highScoresPanel.classList.add("hidden");
    if (toggleScoresBtn) toggleScoresBtn.textContent = "High scores";
    refreshLeaderboardsPanel();
    startLeaderboardRefresh();
  } else {
    stopLeaderboardRefresh();
  }
});

leaderboardGamePicker?.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-game]");
  if (!btn) return;
  selectedLeaderboardGame = btn.dataset.game;
  renderLeaderboardPicker();
  renderLeaderboardList();
});

leaderboardSearchInput?.addEventListener("input", () => {
  filterLeaderboardPickerAndList();
});

gamesSearchInput?.addEventListener("input", () => {
  filterGamesGrid();
});

toggleAchievementsBtn?.addEventListener("click", () => {
  if (!achievementsPanel) return;
  const open = achievementsPanel.classList.toggle("hidden") === false;
  toggleAchievementsBtn.textContent = open ? "Hide achievements" : "🏆 Achievements";
  if (open) renderAchievementsPanel();
});

toggleUpdatesBtn?.addEventListener("click", async () => {
  if (!updatesPanel) return;
  const open = updatesPanel.classList.toggle("hidden") === false;
  if (open) {
    if (updatesList && !changelogHistoryLoaded) {
      updatesList.innerHTML = `<li class="updates-empty">Loading update history…</li>`;
    }
    await loadChangelogHistory();
    renderUpdatesPanel();
    markBuildSeen();
    renderUpdatesPanel();
  }
  updateUpdatesButtonLabel(open);
});

function escapeFeedbackHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatFeedbackTime(at) {
  const d = new Date(Number(at) || 0);
  if (!Number.isFinite(d.getTime()) || d.getTime() <= 0) return "";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function updateFeedbackButtonLabel(open) {
  if (!toggleFeedbackBtn) return;
  const unread =
    typeof HubFeedback !== "undefined" && HubFeedback.isOwner?.()
      ? HubFeedback.unreadCount?.() || 0
      : 0;
  if (open) {
    toggleFeedbackBtn.textContent = unread > 0 ? `Hide feedback · ${unread} new` : "Hide feedback";
  } else {
    toggleFeedbackBtn.textContent = unread > 0 ? `Feedback · ${unread} new` : "Feedback";
  }
}

function fillFeedbackGameOptions() {
  if (!feedbackGame) return;
  const current = feedbackGame.value;
  const options = [`<option value="">General / hub</option>`].concat(
    HUB_GAMES.map(
      (g) => `<option value="${escapeFeedbackHtml(g.id)}">${escapeFeedbackHtml(g.name)}</option>`
    )
  );
  feedbackGame.innerHTML = options.join("");
  if ([...feedbackGame.options].some((o) => o.value === current)) feedbackGame.value = current;
}

function setFeedbackStatus(text, kind = "") {
  if (!feedbackStatus) return;
  feedbackStatus.textContent = text || "";
  feedbackStatus.classList.remove("is-ok", "is-err");
  if (kind) feedbackStatus.classList.add(kind);
}

function updateFeedbackCharCount() {
  if (!feedbackText || !feedbackCount) return;
  const max = (typeof HubFeedback !== "undefined" && HubFeedback.MAX_TEXT) || 400;
  feedbackCount.textContent = `${feedbackText.value.length} / ${max}`;
}

function renderFeedbackInbox() {
  if (!feedbackInbox || !feedbackList) return;
  const owner = typeof HubFeedback !== "undefined" && HubFeedback.isOwner?.();
  feedbackInbox.classList.toggle("hidden", !owner);
  if (!owner) return;
  const items = HubFeedback.list?.() || [];
  const readAt =
    typeof HubFeedback !== "undefined"
      ? Math.max(0, Number(localStorage.getItem("hub-feedback-read-at-v1")) || 0)
      : 0;
  if (feedbackUnread) {
    const unread = HubFeedback.unreadCount?.() || 0;
    feedbackUnread.textContent = unread ? `${unread} new` : "";
    feedbackUnread.classList.toggle("hidden", unread <= 0);
  }
  if (!items.length) {
    feedbackList.innerHTML = "";
    feedbackEmpty?.classList.remove("hidden");
    return;
  }
  feedbackEmpty?.classList.add("hidden");
  feedbackList.innerHTML = items
    .map((item) => {
      const isNew = item.at > readAt;
      const gameLabel = item.game
        ? HUB_GAMES.find((g) => g.id === item.game)?.name || item.game
        : "General";
      return `<li class="feedback-item${isNew ? " is-new" : ""}" data-feedback-id="${escapeFeedbackHtml(item.id)}">
        <div class="feedback-item-body">
          <div class="feedback-item-top">
            <span class="feedback-item-type">${escapeFeedbackHtml(item.type)}</span>
            <span>${escapeFeedbackHtml(item.fromName)}</span>
            <span>${escapeFeedbackHtml(gameLabel)}</span>
            <span>${escapeFeedbackHtml(formatFeedbackTime(item.at))}</span>
          </div>
          <p class="feedback-item-text">${escapeFeedbackHtml(item.text)}</p>
        </div>
        <button type="button" class="feedback-delete-btn" data-feedback-delete="${escapeFeedbackHtml(item.id)}" title="Delete" aria-label="Delete feedback">Delete</button>
      </li>`;
    })
    .join("");
}

async function openFeedbackPanel() {
  if (!requirePlayerName()) {
    feedbackPanel?.classList.add("hidden");
    updateFeedbackButtonLabel(false);
    return;
  }
  fillFeedbackGameOptions();
  updateFeedbackCharCount();
  setFeedbackStatus("");
  if (typeof HubFeedback !== "undefined") {
    try {
      if (!HubFeedback.isRateLimited?.()) {
        await HubFeedback.sync(true);
        await HubFeedback.flushPending?.();
      } else {
        setFeedbackStatus("Server is cooling down — showing saved messages", "");
      }
    } catch {}
  }
  renderFeedbackInbox();
  updateFeedbackButtonLabel(true);
}

toggleFeedbackBtn?.addEventListener("click", () => {
  if (!feedbackPanel) return;
  const open = feedbackPanel.classList.toggle("hidden") === false;
  if (open) {
    openFeedbackPanel();
  } else if (typeof HubFeedback !== "undefined" && HubFeedback.isOwner?.()) {
    HubFeedback.markAllRead?.();
  }
  updateFeedbackButtonLabel(open);
});

feedbackText?.addEventListener("input", updateFeedbackCharCount);

feedbackForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!requirePlayerName()) return;
  if (typeof HubFeedback === "undefined") {
    setFeedbackStatus("Feedback is unavailable right now", "is-err");
    return;
  }
  if (feedbackSendBtn) feedbackSendBtn.disabled = true;
  setFeedbackStatus("Sending…");
  const result = await HubFeedback.submit({
    text: feedbackText?.value || "",
    type: feedbackType?.value || "idea",
    game: feedbackGame?.value || ""
  });
  if (feedbackSendBtn) feedbackSendBtn.disabled = false;
  if (!result?.ok) {
    setFeedbackStatus(result?.error || "Could not send", "is-err");
    return;
  }
  if (feedbackText) feedbackText.value = "";
  updateFeedbackCharCount();
  setFeedbackStatus(
    result.warning || (result.queued ? "Saved — will sync to ICE when the server is free" : "Sent to ICE — thanks!"),
    "is-ok"
  );
  window.HubSound?.play?.("win");
  renderFeedbackInbox();
  updateFeedbackButtonLabel(true);
});

feedbackRefreshBtn?.addEventListener("click", async () => {
  if (typeof HubFeedback === "undefined") return;
  setFeedbackStatus("Refreshing…");
  try {
    await HubFeedback.sync(true);
    renderFeedbackInbox();
    setFeedbackStatus("Up to date", "is-ok");
  } catch {
    setFeedbackStatus("Could not refresh", "is-err");
  }
});

feedbackList?.addEventListener("click", async (e) => {
  const btn = e.target?.closest?.("[data-feedback-delete]");
  if (!btn) return;
  e.preventDefault();
  if (typeof HubFeedback === "undefined" || !HubFeedback.isOwner?.()) return;
  const id = btn.getAttribute("data-feedback-delete") || "";
  if (!id) return;
  btn.disabled = true;
  setFeedbackStatus("Deleting…");
  const result = await HubFeedback.remove?.(id);
  if (!result?.ok) {
    btn.disabled = false;
    setFeedbackStatus(result?.error || "Could not delete", "is-err");
    return;
  }
  renderFeedbackInbox();
  setFeedbackStatus(result.warning || "Deleted", result.warning ? "" : "is-ok");
  updateFeedbackButtonLabel(true);
});

function isHubSettingsOpen() {
  return !!(hubSettingsPanel && !hubSettingsPanel.classList.contains("hidden"));
}

function setHubSettingsOpen(open) {
  if (!hubSettingsPanel) return;
  const want = !!open;
  hubSettingsPanel.classList.toggle("hidden", !want);
  if (toggleSettingsBtn) {
    toggleSettingsBtn.textContent = want ? "Hide settings" : "⚙ Settings";
  }
  if (want) {
    applyHubTheme();
    refreshNotificationPermStatus();
    try {
      window.HubHelp?.renderMascotPicker?.(document.getElementById("hub-help-mascot-picker"));
    } catch {}
    try {
      window.HubAudio?.bindSettings?.(hubSettingsPanel);
      window.HubAudio?.setTheme?.("settings");
    } catch {}
  } else {
    try {
      window.HubAudio?.setTheme?.("hub");
    } catch {}
  }
}

toggleSettingsBtn?.addEventListener("click", () => {
  setHubSettingsOpen(!isHubSettingsOpen());
});

document.getElementById("toggle-credits-btn")?.addEventListener("click", () => {
  try {
    window.HubAudio?.openCredits?.();
  } catch {}
});

hubThemePicker?.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-hub-theme]");
  if (!btn || btn.hidden) return;
  const id = btn.dataset.hubTheme;
  if (!canUseHubTheme(id)) {
    showGamesMessage("That hub look is locked for your account", 1800);
    return;
  }
  applyHubTheme(id);
  try {
    localStorage.setItem("hub-look-set-at", String(Date.now()));
  } catch {}
  try {
    document.dispatchEvent(new CustomEvent("hub-look-changed", { detail: { theme: id } }));
  } catch {}
  if (window.HubAccountBag?.syncUp) {
    HubAccountBag.syncUp().catch(() => {});
  }
  showGamesMessage(`Hub look: ${HUB_THEMES[id]?.label || "Classic"}`, 1600);
});

document.addEventListener("hub-account-bag-applied", () => {
  applyHubTheme();
  try {
    refreshGamesHub();
  } catch {}
  try {
    submitDayStreakToLeaderboard();
  } catch {}
});
document.addEventListener("hub-player-changed", () => {
  applyHubTheme();
  try {
    refreshGamesHub();
  } catch {}
  try {
    window.HubAccountBag?.enforceLiveBagOwner?.()?.catch?.(() => {});
  } catch {}
});
document.addEventListener("hub-username-ready", () => {
  applyHubTheme();
  try {
    refreshGamesHub();
  } catch {}
  try {
    submitDayStreakToLeaderboard();
  } catch {}
});

function refreshNotificationPermStatus() {
  const el = document.getElementById("notifications-perm-status");
  const btn = document.getElementById("enable-notifications-btn");
  if (!el) return;
  if (typeof Notification === "undefined") {
    el.textContent = "Browser notifications are not supported here.";
    if (btn) btn.disabled = true;
    return;
  }
  const perm = Notification.permission;
  if (perm === "granted") {
    el.textContent = "Browser notifications are on.";
    if (btn) btn.textContent = "Notifications enabled";
    if (btn) btn.disabled = true;
  } else if (perm === "denied") {
    el.textContent = "Blocked in browser settings — allow notifications for this site.";
    if (btn) btn.disabled = true;
  } else {
    el.textContent = "Optional: also alert you when the tab is in the background.";
    if (btn) {
      btn.disabled = false;
      btn.textContent = "Enable browser notifications";
    }
  }
}

document.getElementById("enable-notifications-btn")?.addEventListener("click", async () => {
  if (typeof HubNotifications === "undefined") {
    refreshNotificationPermStatus();
    return;
  }
  await HubNotifications.requestPermission(true);
  refreshNotificationPermStatus();
  showGamesMessage("Notification permission updated", 1600);
});

function maybeOpenHubHash() {
  const hash = String(location.hash || "").replace(/^#/, "").toLowerCase();
  if (!hash) return;
  if (hash === "friends") {
    friendsPanel?.classList.remove("hidden");
    renderFriendsPanel?.();
    toggleFriendsBtn && (toggleFriendsBtn.textContent = "Hide friends");
  } else if (hash === "titles" || hash === "title" || hash === "colors") {
    titlesPanel?.classList.remove("hidden");
    renderTitlePicker?.();
    renderColorPicker?.();
    updateTitlesButtonLabel(true);
  } else if (hash === "coins" || hash === "coin" || hash === "shop") {
    setCoinsShopOpen?.(true);
  } else if (hash === "feedback") {
    feedbackPanel?.classList.remove("hidden");
    openFeedbackPanel?.();
    updateFeedbackButtonLabel(true);
  } else if (hash === "games" || hash === "games") {
    // already on games screen
  }
}

togglePlayersBtn?.addEventListener("click", () => {
  if (!playersPanel) return;
  const open = playersPanel.classList.toggle("hidden") === false;
  updateOnlineCountDisplay(
    typeof HubPlays !== "undefined" ? HubPlays.getOnlineCount() : 0,
    typeof HubPlays !== "undefined" ? HubPlays.getAllTimeCount() : 0
  );
  if (open) {
    maybeAskPlayerName();
    renderPlayersPanel();
  }
});

function updateTitlesButtonLabel(open) {
  if (!toggleTitlesBtn) return;
  toggleTitlesBtn.textContent = open ? "Hide titles" : "Titles";
}

function isCoinsShopOpen() {
  return !!(coinsPanel && !coinsPanel.classList.contains("hidden"));
}

function updateCoinsButtonLabel(open) {
  if (!toggleCoinsBtn) return;
  const bal =
    typeof HubCoins !== "undefined" ? HubCoins.format(HubCoins.getBalance()) : "0";
  const shown = open == null ? isCoinsShopOpen() : !!open;
  toggleCoinsBtn.setAttribute("aria-expanded", shown ? "true" : "false");
  toggleCoinsBtn.innerHTML = shown
    ? `<span aria-hidden="true">🪙</span> <span data-hub-coins-balance>${bal}</span> Hide shop`
    : `<span aria-hidden="true">🪙</span> <span data-hub-coins-balance>${bal}</span> Shop`;
}

function setCoinsShopOpen(open) {
  if (!coinsPanel) return;
  if (open) {
    try {
      window.HubAdmin?.close?.();
    } catch {}
  }
  coinsPanel.classList.toggle("hidden", !open);
  document.body.classList.toggle("coins-shop-open", !!open);
  document.documentElement.classList.toggle("coins-shop-open", !!open);
  gamesScreen?.classList.toggle("shop-open", !!open);
  updateCoinsButtonLabel(!!open);
  if (open) {
    maybeAskPlayerName();
    renderCoinsPanel();
    const sheet = coinsPanel.querySelector(".coins-shop-sheet");
    const body = coinsPanel.querySelector(".coins-shop-body");
    // Kill leftover scale transform from older CSS so wheel/touch can scroll.
    if (sheet) {
      sheet.style.transform = "none";
      sheet.style.animation = "none";
    }
    if (body) body.scrollTop = 0;
    coinsPanel.scrollTop = 0;
    try {
      body?.setAttribute("tabindex", "-1");
      body?.focus?.({ preventScroll: true });
    } catch {
      document.getElementById("coins-shop-close")?.focus?.();
    }
  }
}

function setCoinsStatus(msg, kind) {
  const el = document.getElementById("coins-status");
  if (!el) return;
  el.textContent = msg || "";
  el.classList.toggle("is-error", kind === "error");
  el.classList.toggle("is-ok", kind === "ok");
}

function shopItemKindLabel(item) {
  const kind = String(item?.kind || "");
  if (kind === "mascot") return "Help mascot";
  if (kind === "skin") {
    if (item?.game === "paper") return "Paper Claim skin";
    if (item?.game === "flappy") return "Wing Hop skin";
    if (item?.game === "lemmings" || item?.game === "dudes") return "Dudes skin";
    return "Game skin";
  }
  return "Item";
}

/** Wing Hop shop preview palettes (UFO kept as original tile style). */
const WING_HOP_SHOP_ICONS = {
  ufo: { emoji: "🛸", body: "#7c9cff", wing: "#3b5bdb", skyTop: "#050814", skyBottom: "#1a1040" },
  plane: { body: "#f1f3f5", wing: "#ced4da", accent: "#fa5252", skyTop: "#e7f5ff", skyBottom: "#fff4e6" },
  bee: { body: "#fcc419", wing: "#fff9db", accent: "#212529", skyTop: "#74c0fc", skyBottom: "#d0ebff" },
  sub: { body: "#ff922b", wing: "#e8590c", accent: "#ffd43b", skyTop: "#0b2948", skyBottom: "#1c7ed6" },
  balloon: { body: "#fa5252", wing: "#ffc9c9", accent: "#fff5f5", skyTop: "#74c0fc", skyBottom: "#ffe3e3" },
  broom: { body: "#862e9c", wing: "#e67700", accent: "#9775fa", skyTop: "#1b1b2f", skyBottom: "#5f3dc4" },
  neon: { body: "#22b8cf", wing: "#e64980", accent: "#ff6bcb", skyTop: "#0b1020", skyBottom: "#341c4d" },
  steam: { body: "#868e96", wing: "#fab005", accent: "#ffe066", skyTop: "#adb5bd", skyBottom: "#fff4e6" },
  frost: { body: "#a5d8ff", wing: "#74c0fc", accent: "#e7f5ff", skyTop: "#d0ebff", skyBottom: "#e7f5ff" },
  volcano: { body: "#e03131", wing: "#f08c00", accent: "#ffd43b", skyTop: "#212529", skyBottom: "#872e0e" },
  ghost: { body: "#e9ecef", wing: "#ced4da", accent: "#212529", skyTop: "#212529", skyBottom: "#495057" },
  pixel: { body: "#51cf66", wing: "#ff6b6b", accent: "#ffd43b", skyTop: "#1a1b26", skyBottom: "#364fc7" },
  idol: { body: "#fcc419", wing: "#f08c00", accent: "#fff3bf", skyTop: "#fff3bf", skyBottom: "#ffe8cc" },
  shadow: { body: "#343a40", wing: "#212529", accent: "#e599f7", skyTop: "#0b0d12", skyBottom: "#212529" },
  rainbow: { body: "#ff6b6b", wing: "#845ef7", accent: "#51cf66", skyTop: "#e7f5ff", skyBottom: "#fff0f6" }
};

function shopMascotIconHtml(item) {
  const id = String(item?.mascotId || "").toLowerCase();
  let mascot = null;
  try {
    mascot = (HubHelp?.listMascots?.() || []).find((m) => m.id === id) || null;
    if (!mascot && Array.isArray(HubHelp?.MASCOTS)) {
      mascot = HubHelp.MASCOTS.find((m) => m.id === id) || null;
    }
  } catch {}
  const build = window.WORDLE_BUILD || "1";
  const avatar = String(mascot?.avatar || (id ? `hub-help-icons/${id}.png` : "")).trim();
  if (avatar) {
    return `<span class="coins-shop-icon has-avatar" aria-hidden="true"><img src="${escapeHtml(
      avatar
    )}?v=${escapeHtml(build)}" alt="" width="64" height="64" loading="lazy" decoding="async"></span>`;
  }
  const emoji = mascot?.icon || "💬";
  return `<span class="coins-shop-icon coins-shop-icon-emoji" aria-hidden="true">${escapeHtml(emoji)}</span>`;
}

const PAPER_CLAIM_SHOP_ICONS = {
  ink: { body: "#1a1b1e", wing: "#495057", accent: "#868e96", skyTop: "#e8eef5", skyBottom: "#c5d0dc" },
  blueprint: { body: "#e7f5ff", wing: "#1c7ed6", accent: "#ffffff", skyTop: "#1c7ed6", skyBottom: "#1864ab" },
  honeycomb: { body: "#fcc419", wing: "#ffec99", accent: "#d9480f", skyTop: "#d8f5a2", skyBottom: "#8ce99a" },
  ocean: { body: "#22b8cf", wing: "#66d9e8", accent: "#e7f5ff", skyTop: "#0b2948", skyBottom: "#041526" },
  forest: { body: "#40c057", wing: "#8ce99a", accent: "#2b8a3e", skyTop: "#2b8a3e", skyBottom: "#1b4332" },
  candy: { body: "#f783ac", wing: "#fcc2d7", accent: "#be4bdb", skyTop: "#fff0f6", skyBottom: "#fcc2d7" },
  graffiti: { body: "#ff6bcb", wing: "#ffd43b", accent: "#ffffff", skyTop: "#3d3d3d", skyBottom: "#1f1f1f" },
  storm: { body: "#748ffc", wing: "#ffd166", accent: "#e7f5ff", skyTop: "#364fc7", skyBottom: "#1b1f3a" },
  lava: { body: "#ff6b2c", wing: "#ffd43b", accent: "#ffa94d", skyTop: "#2b1210", skyBottom: "#120808" },
  ice: { body: "#a5d8ff", wing: "#e7f5ff", accent: "#4c6ef5", skyTop: "#e7f5ff", skyBottom: "#74c0fc" },
  neon: { body: "#22d3ee", wing: "#e93cac", accent: "#ff6bcb", skyTop: "#12081f", skyBottom: "#05040c" },
  pixel: { body: "#51cf66", wing: "#ff6b6b", accent: "#ffd43b", skyTop: "#1a1b26", skyBottom: "#101018" },
  shadow: { body: "#343a40", wing: "#212529", accent: "#be4bdb", skyTop: "#141018", skyBottom: "#07060a" },
  rainbow: { body: "#ff6b6b", wing: "#845ef7", accent: "#51cf66", skyTop: "#fff0f6", skyBottom: "#e7f5ff" },
  gold: { body: "#fcc419", wing: "#ffe066", accent: "#e67700", skyTop: "#fff9db", skyBottom: "#ffe8cc" }
};

function shopPaperSkinArtSvg(skinId, p) {
  const b = escapeHtml(p.body);
  const a = escapeHtml(p.accent || p.wing);
  const svgOpen =
    '<svg class="coins-shop-skin-art" viewBox="0 0 64 64" width="64" height="64" aria-hidden="true">';
  const svgClose = "</svg>";
  // Claim blob + trail ribbon preview
  return `${svgOpen}<rect x="8" y="8" width="28" height="28" rx="6" fill="${b}" opacity=".55"/><path d="M36 36 C44 40, 50 48, 54 56" stroke="${a}" stroke-width="5" stroke-linecap="round" fill="none"/><circle cx="40" cy="40" r="9" fill="${b}"/><circle cx="37" cy="37" r="2.5" fill="#fff" opacity=".45"/>${svgClose}`;
}

/** Coin-shop previews for Dudes — tiny walkers, not Wing Hop copies. */
const DUDES_SHOP_ICONS = {
  sunset: { body: "#fb7185", hat: "#9f1239", face: "#ffedd5", skyTop: "#fda4af", skyBottom: "#9f1239" },
  honey: { body: "#f59e0b", hat: "#78350f", face: "#fef3c7", skyTop: "#fde68a", skyBottom: "#b45309" },
  mint: { body: "#6ee7b7", hat: "#047857", face: "#ecfdf5", skyTop: "#a7f3d0", skyBottom: "#065f46", hatStyle: "pom" },
  midnight: { body: "#334155", hat: "#0f172a", face: "#a5f3fc", skyTop: "#1e293b", skyBottom: "#020617" },
  beanie: { body: "#22c55e", hat: "#7c3aed", face: "#fde68a", skyTop: "#c4b5fd", skyBottom: "#5b21b6", hatStyle: "beanie" },
  hardhat: { body: "#22c55e", hat: "#facc15", face: "#fde68a", skyTop: "#fef08a", skyBottom: "#3f6212", hatStyle: "hardhat" },
  bandana: { body: "#16a34a", hat: "#dc2626", face: "#fde68a", skyTop: "#fecaca", skyBottom: "#14532d", hatStyle: "bandana" },
  builder: { body: "#ea580c", hat: "#facc15", face: "#fde68a", vest: "#fb923c", skyTop: "#fdba74", skyBottom: "#9a3412", hatStyle: "hardhat" },
  floater: { body: "#38bdf8", hat: "#0369a1", face: "#fde68a", skyTop: "#bae6fd", skyBottom: "#075985", float: true },
  climber: { body: "#22c55e", hat: "#14532d", face: "#fde68a", skyTop: "#86efac", skyBottom: "#14532d", pack: true },
  blocker: { body: "#f97316", hat: "#9a3412", face: "#fde68a", skyTop: "#fdba74", skyBottom: "#7c2d12", stop: true },
  propeller: { body: "#22c55e", hat: "#0ea5e9", face: "#fde68a", skyTop: "#7dd3fc", skyBottom: "#0369a1", hatStyle: "propeller" },
  bomber: { body: "#64748b", hat: "#1e293b", face: "#fde68a", skyTop: "#94a3b8", skyBottom: "#0f172a", fuse: true },
  cat: { body: "#a78bfa", hat: "#6d28d9", face: "#fde68a", skyTop: "#ddd6fe", skyBottom: "#5b21b6", hatStyle: "ears" },
  duck: { body: "#facc15", hat: "#eab308", face: "#fef08a", skyTop: "#fef9c3", skyBottom: "#ca8a04", hatStyle: "beak" },
  crown: { body: "#22c55e", hat: "#eab308", face: "#fde68a", skyTop: "#fde68a", skyBottom: "#166534", hatStyle: "crown" },
  ghost: { body: "#f8fafc", hat: "#e2e8f0", face: "#0f172a", skyTop: "#cbd5e1", skyBottom: "#334155", special: "ghost" },
  robot: { body: "#94a3b8", hat: "#475569", face: "#22d3ee", skyTop: "#e2e8f0", skyBottom: "#334155", special: "robot" },
  rainbow: { body: "#22c55e", hat: "#14532d", face: "#fff7ed", skyTop: "#fda4af", skyBottom: "#818cf8", special: "rainbow" }
};

function shopDudesSkinArtSvg(skinId, p) {
  const body = escapeHtml(p.body);
  const hat = escapeHtml(p.hat || p.body);
  const face = escapeHtml(p.face || "#fde68a");
  const vest = escapeHtml(p.vest || "");
  const style = p.hatStyle || "flat";
  const svgOpen =
    '<svg class="coins-shop-skin-art" viewBox="0 0 64 64" width="64" height="64" aria-hidden="true">';
  const svgClose = "</svg>";

  if (p.special === "ghost") {
    return `${svgOpen}<ellipse cx="32" cy="34" rx="12" ry="16" fill="${body}" opacity=".92"/><rect x="26" y="28" width="4" height="5" rx="1" fill="${face}"/><rect x="34" y="28" width="4" height="5" rx="1" fill="${face}"/>${svgClose}`;
  }
  if (p.special === "robot") {
    return `${svgOpen}<rect x="22" y="22" width="20" height="24" rx="2" fill="${body}"/><rect x="22" y="16" width="20" height="8" fill="${hat}"/><rect x="32" y="26" width="8" height="7" fill="${face}"/><rect x="34" y="28" width="3" height="3" fill="#0ea5e9"/>${svgClose}`;
  }
  if (p.special === "rainbow") {
    return `${svgOpen}<rect x="18" y="14" width="6" height="6" fill="#ef4444"/><rect x="24" y="14" width="6" height="6" fill="#f59e0b"/><rect x="30" y="14" width="6" height="6" fill="#22c55e"/><rect x="36" y="14" width="6" height="6" fill="#3b82f6"/><rect x="42" y="14" width="6" height="6" fill="#a855f7"/><rect x="24" y="26" width="16" height="20" rx="2" fill="${body}"/><rect x="24" y="20" width="16" height="7" fill="${hat}"/><rect x="32" y="28" width="7" height="7" fill="${face}"/>${svgClose}`;
  }

  let hatSvg = `<rect x="24" y="20" width="16" height="7" fill="${hat}"/>`;
  if (style === "beanie") {
    hatSvg = `<ellipse cx="32" cy="22" rx="10" ry="7" fill="${hat}"/><rect x="22" y="22" width="20" height="5" fill="${hat}"/>`;
  } else if (style === "hardhat") {
    hatSvg = `<rect x="22" y="20" width="20" height="7" fill="${hat}"/><rect x="26" y="15" width="12" height="6" fill="${hat}"/>`;
  } else if (style === "crown") {
    hatSvg = `<path d="M22 28 L22 16 L28 22 L32 14 L36 22 L42 16 L42 28 Z" fill="${hat}"/><rect x="30" y="17" width="4" height="4" fill="#fef08a"/>`;
  } else if (style === "propeller") {
    hatSvg = `<rect x="24" y="20" width="16" height="7" fill="${hat}"/><line x1="20" y1="14" x2="44" y2="14" stroke="#e2e8f0" stroke-width="2.5" stroke-linecap="round"/><rect x="30" y="12" width="4" height="9" fill="#94a3b8"/>`;
  } else if (style === "bandana") {
    hatSvg = `<rect x="24" y="20" width="16" height="7" fill="${hat}"/><rect x="28" y="20" width="5" height="7" fill="#fef2f2"/><path d="M40 24 L48 30 L40 28 Z" fill="${hat}"/>`;
  } else if (style === "pom") {
    hatSvg = `<rect x="24" y="20" width="16" height="7" fill="${hat}"/><circle cx="32" cy="14" r="4" fill="#fff"/>`;
  } else if (style === "ears") {
    hatSvg = `<rect x="24" y="20" width="16" height="7" fill="${hat}"/><path d="M22 20 L18 10 L28 20 Z" fill="${hat}"/><path d="M42 20 L46 10 L36 20 Z" fill="${hat}"/>`;
  } else if (style === "beak") {
    hatSvg = `<rect x="24" y="20" width="16" height="7" fill="${hat}"/><path d="M36 30 L48 34 L36 38 Z" fill="#ea580c"/>`;
  }

  const vestSvg = vest
    ? `<rect x="26" y="34" width="12" height="8" fill="${vest}"/>`
    : "";
  const stopSvg = p.stop
    ? `<rect x="28" y="34" width="8" height="8" fill="#ef4444"/><rect x="29" y="37" width="6" height="2" fill="#fff"/>`
    : "";
  const packSvg = p.pack
    ? `<rect x="18" y="34" width="5" height="10" fill="#38bdf8"/><line x1="20" y1="34" x2="20" y2="24" stroke="#7dd3fc" stroke-width="1.5"/>`
    : "";
  const fuseSvg = p.fuse
    ? `<rect x="30" y="12" width="4" height="8" fill="#fbbf24"/><circle cx="32" cy="10" r="3" fill="#fb7185"/>`
    : "";
  const floatSvg = p.float
    ? `<path d="M20 18 A12 10 0 0 1 44 18" fill="#f8fafc"/><rect x="22" y="16" width="5" height="6" fill="#ef4444"/><rect x="30" y="16" width="5" height="6" fill="#3b82f6"/><line x1="32" y1="26" x2="32" y2="30" stroke="#94a3b8" stroke-width="1.5"/>`
    : "";

  return `${svgOpen}${floatSvg}${fuseSvg}<rect x="24" y="26" width="16" height="20" rx="2" fill="${body}"/>${vestSvg}${hatSvg}<rect x="32" y="28" width="7" height="7" fill="${face}"/>${stopSvg}${packSvg}${svgClose}`;
}

function shopSkinArtSvg(skinId, p) {
  const b = escapeHtml(p.body);
  const w = escapeHtml(p.wing);
  const a = escapeHtml(p.accent || p.wing);
  const svgOpen =
    '<svg class="coins-shop-skin-art" viewBox="0 0 64 64" width="64" height="64" aria-hidden="true">';
  const svgClose = "</svg>";
  switch (skinId) {
    case "plane":
      return `${svgOpen}<polygon points="50,32 14,22 22,32 14,42" fill="${b}" stroke="#495057" stroke-width="2"/><polygon points="30,32 22,16 26,32 22,48" fill="${w}"/><rect x="26" y="29" width="10" height="6" rx="1" fill="${a}"/>${svgClose}`;
    case "bee":
      return `${svgOpen}<ellipse cx="28" cy="18" rx="10" ry="6" fill="${w}" opacity=".85"/><ellipse cx="28" cy="46" rx="10" ry="6" fill="${w}" opacity=".85"/><ellipse cx="32" cy="32" rx="16" ry="11" fill="${b}"/><rect x="20" y="24" width="4" height="16" fill="${a}"/><rect x="28" y="24" width="4" height="16" fill="${a}"/><rect x="36" y="24" width="4" height="16" fill="${a}"/><circle cx="44" cy="28" r="3.5" fill="#fff"/><circle cx="45" cy="28" r="1.6" fill="${a}"/>${svgClose}`;
    case "sub":
      return `${svgOpen}<ellipse cx="34" cy="34" rx="20" ry="10" fill="${b}" stroke="#7c2d12" stroke-width="1.5"/><rect x="28" y="18" width="12" height="10" rx="2" fill="#ffe8cc"/><circle cx="44" cy="32" r="4.5" fill="#e7f5ff"/><polygon points="12,34 2,28 2,40" fill="${w}"/><line x1="34" y1="18" x2="34" y2="10" stroke="${a}" stroke-width="2"/>${svgClose}`;
    case "balloon":
      return `${svgOpen}<ellipse cx="32" cy="24" rx="14" ry="16" fill="${b}"/><path d="M24 38 L22 48 M40 38 L42 48 M32 40 L32 48" stroke="${w}" stroke-width="1.8" fill="none"/><rect x="24" y="48" width="16" height="9" rx="2" fill="#fff5f5"/><circle cx="27" cy="20" r="2.2" fill="#fff"/><circle cx="37" cy="20" r="2.2" fill="#fff"/>${svgClose}`;
    case "broom":
      return `${svgOpen}<line x1="12" y1="40" x2="48" y2="22" stroke="${a}" stroke-width="3" stroke-linecap="round"/><polygon points="12,40 2,30 4,48" fill="${w}"/><ellipse cx="40" cy="24" rx="9" ry="7" fill="${b}"/><circle cx="44" cy="22" r="2" fill="#fff"/>${svgClose}`;
    case "neon":
      return `${svgOpen}<polygon points="10,40 52,34 46,44 12,48" fill="#1a1030"/><ellipse cx="34" cy="30" rx="14" ry="7" fill="${b}"/><polygon points="28,30 14,16 38,28" fill="${w}"/><rect x="44" y="26" width="12" height="4" rx="1" fill="${a}"/><circle cx="38" cy="26" r="2" fill="#fff"/><path d="M10 38 H0 M10 42 H2 M10 46 H4" stroke="${a}" stroke-width="2" opacity=".8"/>${svgClose}`;
    case "steam":
      return `${svgOpen}<ellipse cx="34" cy="34" rx="18" ry="12" fill="${b}" stroke="#495057" stroke-width="1.5"/><ellipse cx="34" cy="38" rx="11" ry="6" fill="#dee2e6"/><rect x="28" y="16" width="12" height="8" rx="1" fill="${w}"/><g transform="translate(12 34) rotate(25)"><rect x="-2" y="-10" width="4" height="20" fill="#495057"/><rect x="-10" y="-2" width="20" height="4" fill="#495057"/></g><circle cx="42" cy="30" r="3" fill="#e7f5ff"/><circle cx="43" cy="30" r="1.3" fill="#212529"/>${svgClose}`;
    case "frost":
      return `${svgOpen}<polygon points="32,8 48,34 32,52 16,34" fill="${w}" opacity=".45"/><polygon points="32,12 44,34 32,48 20,34" fill="${b}" stroke="#4dabf7" stroke-width="1.5"/><polygon points="32,20 38,34 32,42 26,34" fill="${a}"/><polygon points="28,32 12,22 22,36" fill="${w}"/><circle cx="34" cy="30" r="2" fill="#1c7ed6"/>${svgClose}`;
    case "volcano":
      return `${svgOpen}<ellipse cx="32" cy="38" rx="18" ry="12" fill="${w}"/><ellipse cx="32" cy="36" rx="14" ry="10" fill="${b}"/><ellipse cx="34" cy="40" rx="8" ry="5" fill="#ffa94d"/><polygon points="18,28 14,12 22,28" fill="${a}"/><polygon points="32,26 28,8 36,26" fill="${a}"/><polygon points="46,28 42,14 50,28" fill="${a}"/><circle cx="40" cy="34" r="3" fill="#fff3bf"/><circle cx="41" cy="34" r="1.3" fill="#212529"/>${svgClose}`;
    case "ghost":
      return `${svgOpen}<path d="M18 28 a14 14 0 0 1 28 0 v18 q-6-8-10 0 q-4-8-8 0 q-4-8-10 0 z" fill="${b}" opacity=".92"/><ellipse cx="26" cy="28" rx="3" ry="4.5" fill="${a}"/><ellipse cx="38" cy="28" rx="3" ry="4.5" fill="${a}"/><circle cx="25" cy="26" r="1" fill="#fff"/><circle cx="37" cy="26" r="1" fill="#fff"/>${svgClose}`;
    case "pixel":
      return `${svgOpen}<g shape-rendering="crispEdges"><rect x="24" y="16" width="8" height="8" fill="${b}"/><rect x="32" y="16" width="8" height="8" fill="${b}"/><rect x="16" y="24" width="8" height="8" fill="${w}"/><rect x="24" y="24" width="8" height="8" fill="${b}"/><rect x="32" y="24" width="8" height="8" fill="${b}"/><rect x="40" y="24" width="8" height="8" fill="${a}"/><rect x="16" y="32" width="8" height="8" fill="${w}"/><rect x="24" y="32" width="8" height="8" fill="#8ce99a"/><rect x="32" y="32" width="8" height="8" fill="${b}"/><rect x="24" y="40" width="8" height="8" fill="${b}"/><rect x="32" y="40" width="8" height="8" fill="${b}"/><rect x="36" y="20" width="3" height="3" fill="#212529"/></g>${svgClose}`;
    case "idol":
      return `${svgOpen}<ellipse cx="20" cy="32" rx="10" ry="6" fill="${w}" transform="rotate(-25 20 32)"/><ellipse cx="44" cy="32" rx="10" ry="6" fill="${w}" transform="rotate(25 44 32)"/><ellipse cx="32" cy="34" rx="11" ry="14" fill="${b}" stroke="#e67700" stroke-width="1.5"/><ellipse cx="32" cy="38" rx="6" ry="8" fill="#ffe066"/><polygon points="28,18 32,8 36,18" fill="${a}"/><circle cx="28" cy="30" r="2" fill="#7a3b00"/><circle cx="36" cy="30" r="2" fill="#7a3b00"/>${svgClose}`;
    case "shadow":
      return `${svgOpen}<ellipse cx="32" cy="52" rx="14" ry="4" fill="#000" opacity=".35"/><path d="M18 48 Q14 28 22 16 Q32 4 42 16 Q50 28 46 48 Q38 40 32 50 Q26 40 18 48 Z" fill="${b}"/><ellipse cx="26" cy="24" rx="3.2" ry="2.2" fill="${a}"/><ellipse cx="38" cy="24" rx="3.2" ry="2.2" fill="${a}"/><circle cx="26" cy="24" r="1" fill="#120012"/><circle cx="38" cy="24" r="1" fill="#120012"/>${svgClose}`;
    case "rainbow":
      return `${svgOpen}<ellipse cx="18" cy="28" rx="14" ry="10" fill="#ff6b6b" opacity=".85" transform="rotate(-30 18 28)"/><ellipse cx="46" cy="28" rx="14" ry="10" fill="#845ef7" opacity=".85" transform="rotate(30 46 28)"/><ellipse cx="18" cy="28" rx="9" ry="6" fill="#fcc419" opacity=".7" transform="rotate(-30 18 28)"/><ellipse cx="46" cy="28" rx="9" ry="6" fill="#339af0" opacity=".7" transform="rotate(30 46 28)"/><ellipse cx="32" cy="34" rx="6" ry="11" fill="${b}"/><circle cx="32" cy="22" r="4" fill="#ffd8a8"/><circle cx="30" cy="21" r="1" fill="#212529"/><circle cx="34" cy="21" r="1" fill="#212529"/>${svgClose}`;
    default:
      return "";
  }
}

function shopSkinIconHtml(item) {
  const skinId = String(item?.skinId || "").toLowerCase();
  const game = String(item?.game || "");
  if (game === "paper") {
    const preview = PAPER_CLAIM_SHOP_ICONS[skinId] || {
      body: "#3ec6ff",
      wing: "#1c7ed6",
      accent: "#ffffff",
      skyTop: "#102338",
      skyBottom: "#060d16"
    };
    return `<span class="coins-shop-icon coins-shop-skin-icon coins-shop-skin-art-wrap" aria-hidden="true" style="--skin-sky-top:${escapeHtml(
      preview.skyTop
    )};--skin-sky-bottom:${escapeHtml(preview.skyBottom)};--skin-body:${escapeHtml(
      preview.body
    )};--skin-wing:${escapeHtml(preview.wing)}">${shopPaperSkinArtSvg(skinId, preview)}</span>`;
  }
  if (game === "lemmings" || game === "dudes") {
    const preview = DUDES_SHOP_ICONS[skinId] || {
      body: "#22c55e",
      hat: "#14532d",
      face: "#fde68a",
      skyTop: "#86efac",
      skyBottom: "#14532d"
    };
    return `<span class="coins-shop-icon coins-shop-skin-icon coins-shop-skin-art-wrap" aria-hidden="true" style="--skin-sky-top:${escapeHtml(
      preview.skyTop
    )};--skin-sky-bottom:${escapeHtml(preview.skyBottom)};--skin-body:${escapeHtml(
      preview.body
    )};--skin-wing:${escapeHtml(preview.hat || preview.body)}">${shopDudesSkinArtSvg(
      skinId,
      preview
    )}</span>`;
  }
  const preview = WING_HOP_SHOP_ICONS[skinId] || {
    emoji: "🐉",
    body: "#3d5a80",
    wing: "#1b2838",
    skyTop: "#1b3a5c",
    skyBottom: "#4c6ef5"
  };
  // Keep UFO (and any unknown/dragon-like fallback) on the original tile style.
  if (skinId === "ufo" || !shopSkinArtSvg(skinId, preview)) {
    return `<span class="coins-shop-icon coins-shop-skin-icon" aria-hidden="true" style="--skin-sky-top:${escapeHtml(
      preview.skyTop
    )};--skin-sky-bottom:${escapeHtml(preview.skyBottom)};--skin-body:${escapeHtml(
      preview.body
    )};--skin-wing:${escapeHtml(preview.wing)}"><span class="coins-shop-skin-glyph">${escapeHtml(
      preview.emoji || "🐉"
    )}</span></span>`;
  }
  return `<span class="coins-shop-icon coins-shop-skin-icon coins-shop-skin-art-wrap" aria-hidden="true" style="--skin-sky-top:${escapeHtml(
    preview.skyTop
  )};--skin-sky-bottom:${escapeHtml(preview.skyBottom)};--skin-body:${escapeHtml(
    preview.body
  )};--skin-wing:${escapeHtml(preview.wing)}">${shopSkinArtSvg(skinId, preview)}</span>`;
}

function shopItemIconHtml(item) {
  const kind = String(item?.kind || "");
  if (kind === "mascot") return shopMascotIconHtml(item);
  if (kind === "skin") return shopSkinIconHtml(item);
  return `<span class="coins-shop-icon coins-shop-icon-emoji" aria-hidden="true">🪙</span>`;
}

function renderCoinsShopItem(item) {
  const owned = !!item.owned;
  return `<li class="coins-shop-item${owned ? " is-owned" : ""}" role="listitem">
    <div class="coins-shop-item-main">
      ${shopItemIconHtml(item)}
      <div class="coins-shop-meta">
        <span class="coins-shop-kind">${escapeHtml(shopItemKindLabel(item))}</span>
        <span class="coins-shop-name">${escapeHtml(item.label)}</span>
        <span class="coins-shop-cost">${
          owned ? "Owned" : `${HubCoins.format(item.cost)} coins`
        }</span>
      </div>
    </div>
    <button type="button" class="hub-btn${owned ? "" : " hub-btn-primary"}" data-coin-buy="${escapeHtml(
      item.id
    )}" ${owned ? "disabled" : ""}>${owned ? "Owned" : "Buy"}</button>
  </li>`;
}

function renderCoinsPanel() {
  const list = document.getElementById("coins-shop-list");
  if (typeof HubCoins === "undefined") return;
  HubCoins.refreshUi?.();
  updateCoinsButtonLabel(isCoinsShopOpen());
  if (!list) return;
  const shop = HubCoins.getShop?.() || [];
  const mascots = shop.filter((i) => i.kind === "mascot");
  const skins = shop.filter((i) => i.kind === "skin");
  const other = shop.filter((i) => i.kind !== "mascot" && i.kind !== "skin");
  const wingSkins = skins.filter((i) => i.game === "flappy");
  const paperSkins = skins.filter((i) => i.game === "paper");
  const dudesSkins = skins.filter((i) => i.game === "lemmings" || i.game === "dudes");
  const otherSkins = skins.filter(
    (i) => i.game !== "flappy" && i.game !== "paper" && i.game !== "lemmings" && i.game !== "dudes"
  );
  const sections = [
    { title: "Help mascots", items: mascots },
    { title: "Wing Hop skins", items: wingSkins },
    { title: "Paper Claim skins", items: paperSkins },
    { title: "Dudes skins", items: dudesSkins },
    { title: "Game skins", items: otherSkins },
    { title: "More", items: other }
  ].filter((s) => s.items.length);
  list.innerHTML = sections
    .map(
      (section) => `<section class="coins-shop-section">
      <h4 class="coins-shop-section-title">${escapeHtml(section.title)}</h4>
      <ul class="coins-shop-grid">${section.items.map(renderCoinsShopItem).join("")}</ul>
    </section>`
    )
    .join("");
}

toggleTitlesBtn?.addEventListener("click", () => {
  if (!titlesPanel) return;
  const open = titlesPanel.classList.toggle("hidden") === false;
  updateTitlesButtonLabel(open);
  if (open) {
    maybeAskPlayerName();
    renderTitlePicker();
    renderColorPicker();
  }
});

toggleCoinsBtn?.addEventListener("click", () => {
  setCoinsShopOpen(!isCoinsShopOpen());
});

document.getElementById("coins-shop-close")?.addEventListener("click", () => {
  setCoinsShopOpen(false);
});

document.getElementById("coins-daily-btn")?.addEventListener("click", () => {
  if (typeof HubCoins === "undefined") return;
  const res = HubCoins.claimDaily();
  if (res.ok) {
    setCoinsStatus(`Daily reward: +${res.gained} coins!`, "ok");
    showGamesMessage(`+${res.gained} daily coins`, 1600);
  } else {
    setCoinsStatus(res.error || "Already claimed today.", "error");
  }
  renderCoinsPanel();
});

document.getElementById("coins-pickup-btn")?.addEventListener("click", () => {
  if (typeof HubCoins === "undefined") return;
  const res = HubCoins.rewardPickup();
  if (res.ok) {
    setCoinsStatus(`Picked up +${res.gained} coins! Next pickup in 1 hour.`, "ok");
    showGamesMessage(`+${res.gained} pickup coins`, 1600);
  } else {
    setCoinsStatus(res.error || "Pickup is on cooldown.", "error");
  }
  renderCoinsPanel();
});

document.getElementById("coins-shop-list")?.addEventListener("click", (e) => {
  const btn = e.target.closest?.("[data-coin-buy]");
  if (!btn || typeof HubCoins === "undefined") return;
  const id = btn.getAttribute("data-coin-buy");
  const res = HubCoins.buy(id);
  if (!res.ok) {
    setCoinsStatus(res.error || HubCoins.NEED_MORE, "error");
    showGamesMessage(res.error || HubCoins.NEED_MORE, 2000);
    return;
  }
  setCoinsStatus(`Unlocked ${res.item?.label || "item"}!`, "ok");
  showGamesMessage(`Bought ${res.item?.label || "item"}`, 1800);
  try {
    HubHelp?.renderMascotPicker?.();
  } catch {}
  renderCoinsPanel();
});

document.addEventListener("hub-coins-changed", () => {
  try {
    renderCoinsPanel();
  } catch {
    HubCoins?.refreshUi?.();
  }
});

toggleFriendsBtn?.addEventListener("click", () => {
  if (!friendsPanel) return;
  const open = friendsPanel.classList.toggle("hidden") === false;
  toggleFriendsBtn.textContent = open ? "Hide friends" : "Friends";
  if (open) {
    maybeAskPlayerName();
    renderFriendsPanel();
    if (typeof HubFriends !== "undefined") {
      HubFriends.startPolling?.(friendsChatPoll);
    }
    if (typeof HubChat !== "undefined") {
      HubChat.startPolling?.(friendsChatPoll);
    }
  } else {
    if (typeof HubFriends !== "undefined") HubFriends.stopPolling?.();
    if (typeof HubChat !== "undefined") {
      HubChat.closeThread?.();
      HubChat.stopPolling?.(friendsChatPoll);
    }
    friendsPanel.classList.remove("is-chatting");
    document.getElementById("friends-chat")?.classList.add("hidden");
  }
});

document.getElementById("friend-add-btn")?.addEventListener("click", async () => {
  if (typeof HubFriends === "undefined") return;
  const input = document.getElementById("friend-add-input");
  const name = input?.value?.trim() || "";
  if (!name) {
    setFriendsStatus("Enter a username", true);
    return;
  }
  setFriendsStatus("Sending…");
  const result = await HubFriends.sendRequest(name);
  if (!result.ok) {
    setFriendsStatus(result.error || "Couldn't add friend", true);
    return;
  }
  if (input) input.value = "";
  setFriendsStatus(result.alreadyFriends ? "Already friends" : "Request sent");
  renderFriendsPanel();
});

document.getElementById("friend-add-input")?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") document.getElementById("friend-add-btn")?.click();
});

document.getElementById("friends-panel")?.addEventListener("click", async (e) => {
  const profileBtn = e.target.closest("[data-profile-id], [data-profile-name]");
  if (profileBtn?.classList?.contains("friends-profile-btn")) {
    openPlayerProfile(
      profileBtn.getAttribute("data-profile-id") ||
        profileBtn.getAttribute("data-profile-name")
    );
    return;
  }
  if (typeof HubFriends === "undefined") return;
  const accept = e.target.closest("[data-friend-accept]");
  const decline = e.target.closest("[data-friend-decline]");
  const remove = e.target.closest("[data-friend-remove]");
  const declineInvite = e.target.closest("[data-invite-decline]");
  const openChat = e.target.closest("[data-friend-chat]");
  const openChannel = e.target.closest("[data-chat-open]");
  const openGroup = e.target.closest("[data-group-chat]");
  if (accept) {
    await HubFriends.acceptRequest(accept.dataset.friendAccept);
    renderFriendsPanel();
    return;
  }
  if (decline) {
    await HubFriends.declineRequest(decline.dataset.friendDecline);
    renderFriendsPanel();
    return;
  }
  if (remove) {
    await HubFriends.removeFriend(remove.dataset.friendRemove);
    if (typeof HubChat !== "undefined" && HubChat.getActiveFriendId?.() === remove.dataset.friendRemove) {
      HubChat.closeThread();
    }
    renderFriendsPanel();
    return;
  }
  if (declineInvite) {
    await HubFriends.respondInvite(declineInvite.dataset.inviteDecline, false);
    renderFriendsPanel();
    return;
  }
  if (openChannel?.dataset.chatOpen === "global" && typeof HubChat !== "undefined") {
    if (!requirePlayerName()) return;
    HubChat.openGlobal?.();
    hideGroupCreate();
    renderFriendsPanel();
    document.getElementById("friends-chat-input")?.focus();
    return;
  }
  if (openGroup && typeof HubChat !== "undefined") {
    if (!requirePlayerName()) return;
    HubChat.openGroup?.(openGroup.dataset.groupChat);
    hideGroupCreate();
    renderFriendsPanel();
    document.getElementById("friends-chat-input")?.focus();
    return;
  }
  if (openChat && typeof HubChat !== "undefined") {
    if (!requirePlayerName()) return;
    HubChat.openThread(openChat.dataset.friendChat);
    hideGroupCreate();
    renderFriendsPanel();
    document.getElementById("friends-chat-input")?.focus();
  }
});

document.getElementById("friends-new-group-btn")?.addEventListener("click", (e) => {
  e.preventDefault();
  e.stopPropagation();
  if (!requirePlayerName()) return;
  if (typeof HubChat !== "undefined") HubChat.closeThread?.();
  showGroupCreate();
});

document.getElementById("friends-group-create-btn")?.addEventListener("click", async (e) => {
  e.preventDefault();
  e.stopPropagation();
  if (typeof HubChat === "undefined") return;
  if (!requirePlayerName()) return;
  if (friendsCreatingGroupBusy) return;
  const name = document.getElementById("friends-group-name")?.value || "";
  const picks = [
    ...document.querySelectorAll("#friends-group-picks input:checked")
  ].map((el) => el.value);
  friendsCreatingGroupBusy = true;
  setFriendsStatus("Creating…");
  try {
    const result = await HubChat.createGroup(name, picks);
    if (!result.ok) {
      setFriendsStatus(result.error || "Couldn't create group", true);
      return;
    }
    hideGroupCreate();
    setFriendsStatus("Group created");
    renderFriendsPanel();
  } finally {
    friendsCreatingGroupBusy = false;
  }
});

document.getElementById("friends-chat-back")?.addEventListener("click", () => {
  if (typeof HubChat !== "undefined") HubChat.closeThread?.();
  hideGroupCreate();
  renderFriendsPanel();
});

document.getElementById("friends-chat-form")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (typeof HubChat === "undefined") return;
  const channel = HubChat.getActiveChannel?.();
  const input = document.getElementById("friends-chat-input");
  const text = input?.value || "";
  if (!channel) return;
  if (!requirePlayerName()) return;
  setFriendsStatus("Sending…");
  const result = await HubChat.sendTo(channel.type, channel.id, text);
  if (!result.ok) {
    setFriendsStatus(result.error || "Couldn't send", true);
    return;
  }
  if (input) input.value = "";
  setFriendsStatus("");
  renderFriendsPanel();
  const log = document.getElementById("friends-chat-log");
  if (log) log.scrollTop = log.scrollHeight;
});

function showGroupCreate() {
  const box = document.getElementById("friends-group-create");
  const chat = document.getElementById("friends-chat");
  const panel = document.getElementById("friends-panel");
  const form = document.getElementById("friends-chat-form");
  const log = document.getElementById("friends-chat-log");
  const title = document.getElementById("friends-chat-title");
  const picks = document.getElementById("friends-group-picks");
  friendsComposingGroup = true;
  panel?.classList.add("is-chatting");
  chat?.classList.remove("hidden");
  box?.classList.remove("hidden");
  form?.classList.add("hidden");
  if (log) log.innerHTML = "";
  if (title) title.textContent = "New group";
  const friends = HubFriends.getFriends?.() || [];
  if (picks) {
    picks.innerHTML = friends.length
      ? friends
          .map(
            (f) =>
              `<label><input type="checkbox" value="${escapeHtml(f.playerId)}"> ${escapeHtml(f.name)}</label>`
          )
          .join("")
      : `<span class="friends-last-online">Add friends first</span>`;
  }
  document.getElementById("friends-group-name")?.focus();
}

function hideGroupCreate() {
  friendsComposingGroup = false;
  document.getElementById("friends-group-create")?.classList.add("hidden");
  document.getElementById("friends-chat-form")?.classList.remove("hidden");
  const nameInput = document.getElementById("friends-group-name");
  if (nameInput) nameInput.value = "";
}

function hasPlayerName() {
  if (typeof HubPlays === "undefined") return false;
  if (typeof HubPlays.hasRequiredName === "function") {
    return HubPlays.hasRequiredName();
  }
  const name = HubPlays.getName();
  return !!(name && !/^guest-/i.test(name) && name.toLowerCase() !== "player");
}

function requirePlayerName(message) {
  if (hasPlayerName()) return true;
  maybeAskPlayerName(true);
  const msg = message || "Pick a username to play";
  showGamesMessage(msg, 2200);
  showMessage(msg, true, 2200);
  return false;
}

function maybeAskPlayerName(force = false) {
  if (typeof HubPlays === "undefined") return;
  if (typeof HubPlays.enforceUsernameGate === "function" && !hasPlayerName()) {
    HubPlays.enforceUsernameGate();
    return;
  }
  const existing = HubPlays.getName();
  if (existing && hasPlayerName()) {
    // Soft sync only — never wipe or force a rename once a name is saved here
    HubPlays.claimName(existing).then((result) => {
      if (result.ok) return;
      if (result.error) setPlayerNameStatus(result.error, true);
    });
    if (!force) return;
    return;
  }
  // Clear old guest / invalid names so they must pick a real username
  if (existing && !hasPlayerName()) {
    try {
      localStorage.removeItem("hub-player-name");
    } catch {}
    if (playerNameInput) playerNameInput.value = "";
  }
  if (typeof HubPlays.enforceUsernameGate === "function") {
    HubPlays.enforceUsernameGate();
    return;
  }
  playerNameModal?.classList.add("username-gate-force");
  playerNameModal?.classList.remove("hidden");
  document.body.classList.add("username-gate-open");
  renderSavedAccounts();
  playerNameModalInput?.focus();
}

function hidePlayerNameModal() {
  // Never dismiss until a real username is saved
  if (!hasPlayerName()) return;
  playerNameModal?.classList.add("hidden");
  playerNameModal?.classList.remove("username-gate-force");
  document.body.classList.remove("username-gate-open");
}

function setPlayerNameStatus(msg, isError) {
  const el = document.getElementById("player-name-status");
  const modalEl = document.getElementById("player-name-modal-status");
  [el, modalEl].forEach((node) => {
    if (!node) return;
    node.textContent = msg || "";
    node.classList.toggle("is-error", !!isError);
    node.classList.toggle("hidden", !msg);
  });
}

async function savePlayerNameFrom(value) {
  if (typeof HubPlays === "undefined") return;
  if (HubPlays.isNameLocked() && HubPlays.hasRequiredName()) {
    const current = HubPlays.getName();
    const next = HubPlays.sanitizeName(value || "");
    if (next.toLowerCase() !== current.toLowerCase()) {
      setPlayerNameStatus("Name is locked — unlock it to change", true);
      showGamesMessage("Name is locked — unlock it to change", 2200);
      applyNameLockUI();
      return;
    }
  }
  setPlayerNameStatus("Checking name…", false);
  savePlayerNameBtn && (savePlayerNameBtn.disabled = true);
  playerNameSaveBtn && (playerNameSaveBtn.disabled = true);
  try {
    const result = await HubPlays.claimName(value);
    if (!result.ok) {
      setPlayerNameStatus(result.error || "Name unavailable", true);
      showGamesMessage(result.error || "Name unavailable", 2200);
      playerNameModal?.classList.remove("hidden");
      return;
    }
    if (playerNameInput) playerNameInput.value = result.name;
    if (playerNameModalInput) playerNameModalInput.value = result.name;
    setPlayerNameStatus(
      result.offline
        ? `Playing as ${result.name} (offline / school mode)`
        : `Playing as ${result.name}`,
      false
    );
    hidePlayerNameModal();
    applyNameLockUI();
    applyHubTheme();
    renderPlayersPanel();
    showGamesMessage(
      result.offline
        ? `Playing as ${result.name} (saved on this device)`
        : `Playing as ${result.name} · code ${HubPlays.getPlayerCode?.() || ""}`,
      1800
    );
    if (window.__hubAfterUsername) {
      const next = window.__hubAfterUsername;
      window.__hubAfterUsername = null;
      next();
    }
  } finally {
    savePlayerNameBtn && (savePlayerNameBtn.disabled = false);
    playerNameSaveBtn && (playerNameSaveBtn.disabled = false);
    applyNameLockUI();
  }
}

function applyNameLockUI() {
  if (typeof HubPlays === "undefined") return;
  const locked = HubPlays.isNameLocked();
  const hasName = hasPlayerName();
  if (playerNameInput) {
    playerNameInput.readOnly = locked && hasName;
    playerNameInput.classList.toggle("is-locked", locked && hasName);
  }
  if (savePlayerNameBtn) {
    savePlayerNameBtn.disabled = locked && hasName;
    savePlayerNameBtn.title = locked && hasName ? "Unlock your name to change it" : "Save name";
  }
  if (lockPlayerNameBtn) {
    lockPlayerNameBtn.disabled = !hasName;
    lockPlayerNameBtn.classList.toggle("is-locked", locked);
    lockPlayerNameBtn.setAttribute("aria-pressed", locked ? "true" : "false");
    lockPlayerNameBtn.textContent = locked ? "🔒 Locked" : "🔓 Unlock";
    lockPlayerNameBtn.title = locked
      ? "Name is locked. Tap to unlock and allow changes."
      : "Lock your name so it can't be changed";
  }
  if (playerNameLockHint) {
    playerNameLockHint.textContent = locked
      ? "Name locked — unlock to change it."
      : "Lock your name to stop accidental changes.";
  }
}

function togglePlayerNameLock() {
  if (typeof HubPlays === "undefined") return;
  if (!hasPlayerName()) {
    setPlayerNameStatus("Pick a username before locking", true);
    maybeAskPlayerName(true);
    return;
  }
  const next = !HubPlays.isNameLocked();
  HubPlays.setNameLocked(next);
  applyNameLockUI();
  if (next && window.HubAchievements) {
    HubAchievements.unlock("name_locked");
    setTimeout(checkPendingAchievements, 400);
  }
  setPlayerNameStatus(
    next ? `Locked as ${HubPlays.getName()}` : "Name unlocked — you can change it",
    false
  );
  showGamesMessage(next ? "Name locked" : "Name unlocked", 1600);
}

function updatePlayersMilestonesLine() {
  const el = document.getElementById("players-milestones");
  if (!el || typeof HubPlays === "undefined") return;
  const m = HubPlays.getAllTimeMilestone?.();
  const total = HubPlays.getAllTimeCount?.() || 0;
  const catalogGames = Array.isArray(HUB_GAMES) ? HUB_GAMES.length : 0;
  const games = Math.max(catalogGames, Number(m?.games) || 0);
  const most = String(m?.mostPlayed || "Fishing Idle").trim() || "Fishing Idle";
  const badges = Math.max(0, Number(m?.achievements) || 100);
  el.textContent = `Hub milestones: ${total} all-time players · ${games} games · ${most} most played · ~${badges} achievements`;
}

function updateOnlineCountDisplay(onlineCount, allTimeCount) {
  const onlineEl = document.getElementById("players-online");
  const allTimeEl = document.getElementById("players-alltime");
  const n = Math.max(0, Number(onlineCount) || 0);
  const total =
    allTimeCount == null
      ? typeof HubPlays !== "undefined"
        ? HubPlays.getAllTimeCount()
        : 0
      : Math.max(0, Number(allTimeCount) || 0);
  if (onlineEl) {
    onlineEl.textContent = n === 1 ? "1 online" : `${n} online`;
    onlineEl.classList.toggle("is-empty", n === 0);
  }
  if (allTimeEl) {
    allTimeEl.textContent =
      total === 1 ? "· 1 all-time" : `· ${total} all-time`;
  }
  if (togglePlayersBtn) {
    const open = playersPanel && !playersPanel.classList.contains("hidden");
    togglePlayersBtn.textContent = open
      ? `Hide players · ${n}/${total}`
      : `Players · ${n}/${total}`;
  }
  updatePlayersMilestonesLine();
  if (playersRosterMode) renderPlayersRoster(playersRosterMode);
}

let playersRosterMode = null; // "online" | "alltime" | null

function setPlayersRosterMode(mode) {
  const roster = document.getElementById("players-roster");
  const onlineEl = document.getElementById("players-online");
  const allTimeEl = document.getElementById("players-alltime");
  if (playersRosterMode === mode) {
    playersRosterMode = null;
  } else {
    playersRosterMode = mode;
  }
  onlineEl?.setAttribute("aria-expanded", playersRosterMode === "online" ? "true" : "false");
  allTimeEl?.setAttribute("aria-expanded", playersRosterMode === "alltime" ? "true" : "false");
  if (!playersRosterMode) {
    roster?.classList.add("hidden");
    return;
  }
  renderPlayersRoster(playersRosterMode);
}

function renderPlayersRoster(mode) {
  const roster = document.getElementById("players-roster");
  const title = document.getElementById("players-roster-title");
  const list = document.getElementById("players-roster-list");
  if (!roster || !title || !list || typeof HubPlays === "undefined") return;

  const players =
    mode === "online"
      ? HubPlays.getOnlinePlayers()
      : HubPlays.getAllTimePlayers();
  const visible = players.filter((p) => !isGuestDisplayName(p.name));

  title.textContent =
    mode === "online"
      ? visible.length === 1
        ? "Online now · 1 player"
        : `Online now · ${visible.length} players`
      : visible.length === 1
        ? "All-time players · 1"
        : `All-time players · ${visible.length}`;

  if (!visible.length) {
    list.innerHTML = `<li class="players-empty">${
      mode === "online" ? "Nobody online right now." : "No players recorded yet."
    }</li>`;
  } else {
    list.innerHTML = visible
      .map((p) => {
        let when = "";
        if (mode === "online") {
          when =
            p.gameName && p.game && p.game !== "hub"
              ? `playing ${p.gameName}`
              : "online · hub";
        } else if (p.online) {
          when =
            p.gameName && p.game && p.game !== "hub"
              ? `playing ${p.gameName}`
              : "online now";
        } else if (p.lastAt) {
          when = `last online ${HubPlays.formatWhen(p.lastAt)}`;
        } else if (p.firstAt) {
          when = `joined ${HubPlays.formatWhen(p.firstAt)}`;
        }
        return `<li class="players-roster-item" role="button" tabindex="0" data-profile-id="${escapeHtml(p.playerId || "")}" data-profile-name="${escapeHtml(p.name)}"><span>${formatPlayerNameHtml(p.name)}</span><span class="players-when">${escapeHtml(when)}</span></li>`;
      })
      .join("");
  }
  roster.classList.remove("hidden");
}

function closePlayerProfileModal() {
  const modal = document.getElementById("player-profile-modal");
  modal?.classList.add("hidden");
}

function openPlayerProfile(playerIdOrName) {
  const modal = document.getElementById("player-profile-modal");
  const titleEl = document.getElementById("player-profile-title");
  const body = document.getElementById("player-profile-body");
  if (!modal || !body) return;

  let profile = null;
  try {
    if (typeof HubPlays !== "undefined" && HubPlays.getPlayerProfile) {
      profile = HubPlays.getPlayerProfile(playerIdOrName);
    }
  } catch {}

  if (!profile) {
    const fallbackName = String(playerIdOrName || "").trim() || "Player";
    profile = {
      playerId: "",
      name: fallbackName,
      online: false,
      game: "",
      gameName: "",
      firstAt: 0,
      lastAt: 0,
      recentPlays: [],
      topGames: [],
      isYou: false
    };
  }

  if (titleEl) {
    titleEl.textContent = profile.isYou ? "Your profile" : "Player profile";
  }

  const statusLine = profile.online
    ? profile.game && profile.game !== "hub"
      ? `Online · playing ${escapeHtml(profile.gameName)}`
      : "Online · browsing the hub"
    : profile.lastAt
      ? `Offline · last online ${escapeHtml(HubPlays.formatWhen(profile.lastAt))}`
      : "Offline";

  const joinedLine = profile.firstAt
    ? `Joined ${escapeHtml(HubPlays.formatWhen(profile.firstAt))}`
    : "Join date unknown";

  const recentHtml = profile.recentPlays?.length
    ? `<ul class="player-profile-plays">${profile.recentPlays
        .slice(0, 8)
        .map(
          (p) =>
            `<li><span>${escapeHtml(p.gameName || p.game)}</span><span class="players-when">${escapeHtml(HubPlays.formatWhen(p.at))}</span></li>`
        )
        .join("")}</ul>`
    : `<p class="player-profile-empty">No recent games logged.</p>`;

  const topHtml = profile.topGames?.length
    ? `<p class="player-profile-top">${profile.topGames
        .map((g) => `${escapeHtml(g.gameName)} (${g.count})`)
        .join(" · ")}</p>`
    : "";

  body.innerHTML = `
    <div class="player-profile-head">${formatPlayerNameHtml(profile.name)}</div>
    <p class="player-profile-status">${statusLine}</p>
    <p class="player-profile-meta">${joinedLine}</p>
    ${topHtml ? `<div class="player-profile-section"><h4>Most played (recent)</h4>${topHtml}</div>` : ""}
    <div class="player-profile-section"><h4>Recent games</h4>${recentHtml}</div>
  `;
  modal.classList.remove("hidden");
}

document.getElementById("player-profile-close")?.addEventListener("click", closePlayerProfileModal);
document.getElementById("player-profile-modal")?.addEventListener("click", (e) => {
  if (e.target?.id === "player-profile-modal") closePlayerProfileModal();
});
document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  const modal = document.getElementById("player-profile-modal");
  if (modal && !modal.classList.contains("hidden")) {
    closePlayerProfileModal();
    return;
  }
  if (isCoinsShopOpen()) {
    setCoinsShopOpen(false);
  }
});

document.getElementById("players-roster-list")?.addEventListener("click", (e) => {
  const row = e.target.closest("[data-profile-id], [data-profile-name]");
  if (!row) return;
  openPlayerProfile(row.getAttribute("data-profile-id") || row.getAttribute("data-profile-name"));
});
document.getElementById("players-roster-list")?.addEventListener("keydown", (e) => {
  if (e.key !== "Enter" && e.key !== " ") return;
  const row = e.target.closest("[data-profile-id], [data-profile-name]");
  if (!row) return;
  e.preventDefault();
  openPlayerProfile(row.getAttribute("data-profile-id") || row.getAttribute("data-profile-name"));
});
document.getElementById("players-list")?.addEventListener("click", (e) => {
  const row = e.target.closest("[data-profile-id], [data-profile-name]");
  if (!row) return;
  openPlayerProfile(row.getAttribute("data-profile-id") || row.getAttribute("data-profile-name"));
});

async function refreshOnlineCount() {
  if (typeof HubPlays === "undefined") return;
  try {
    const n = await HubPlays.heartbeat();
    // All-time roster is refreshed inside heartbeat (~10 min). Avoid extra
    // MantleDB traffic here — that was blowing the free rate limit.
    updateOnlineCountDisplay(n, HubPlays.getAllTimeCount());
  } catch {
    updateOnlineCountDisplay(HubPlays.getOnlineCount(), HubPlays.getAllTimeCount());
  }
}

let onlineCountTimer = null;
function startOnlineCountPolling() {
  if (onlineCountTimer) return;
  onlineCountTimer = setInterval(() => {
    refreshOnlineCount();
    if (playersPanel && !playersPanel.classList.contains("hidden")) {
      renderPlayersPanel();
    }
  }, 60_000);
}

window.addEventListener("hub-plays-profile", () => {
  try {
    paintPlayersPanelLists();
  } catch {}
});

window.addEventListener("hub-plays-alltime", () => {
  try {
    if (playersRosterMode) renderPlayersRoster(playersRosterMode);
    updateOnlineCountDisplay(HubPlays.getOnlineCount(), HubPlays.getAllTimeCount());
  } catch {}
});

function paintPlayersPanelLists() {
  if (!playersList || typeof HubPlays === "undefined") return;
  renderTitlePicker();
  renderColorPicker();
  try {
    HubPlays.refreshCreatorCredits?.();
  } catch {}
  if (playersRosterMode) renderPlayersRoster(playersRosterMode);
  const status = HubPlays.getStatus();
  const countEntries = Object.entries(status.counts || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  if (playersTotals) {
    if (!countEntries.length) {
      playersTotals.textContent = "No plays logged yet — open a game to appear here.";
    } else {
      playersTotals.textContent = countEntries
        .map(([id, n]) => `${HubPlays.gameLabel(id)}: ${n}`)
        .join(" · ");
    }
  }
  const plays = (status.plays || []).filter((p) => !isGuestDisplayName(p.name));
  if (!plays.length) {
    playersList.innerHTML = `<li class="players-empty">No recent players yet.</li>`;
    return;
  }
  playersList.innerHTML = plays
    .slice(0, 25)
    .map(
      (p) =>
        `<li class="players-play-item" role="button" tabindex="0" data-profile-id="${escapeHtml(p.playerId || "")}" data-profile-name="${escapeHtml(p.name)}"><span class="players-who">${formatPlayerNameHtml(p.name)} played ${escapeHtml(p.gameName || p.game)}</span><span class="players-when">${HubPlays.formatWhen(p.at)}</span></li>`
    )
    .join("");
}

function setFriendsStatus(text, isError = false) {
  const el = document.getElementById("friends-status");
  if (!el) return;
  if (!text) {
    el.classList.add("hidden");
    el.textContent = "";
    return;
  }
  el.textContent = text;
  el.classList.toggle("is-error", !!isError);
  el.classList.remove("hidden");
}

function onlineNameSet() {
  if (typeof HubPlays === "undefined" || !HubPlays.getOnlinePlayers) return new Set();
  return new Set(
    (HubPlays.getOnlinePlayers() || []).map((p) =>
      String(p.name || "")
        .trim()
        .toLowerCase()
    )
  );
}

function renderFriendsChatPane(friends) {
  const panel = document.getElementById("friends-panel");
  const chat = document.getElementById("friends-chat");
  const title = document.getElementById("friends-chat-title");
  const log = document.getElementById("friends-chat-log");
  const createBox = document.getElementById("friends-group-create");
  if (!panel || !chat || !log || typeof HubChat === "undefined") return;

  if (createBox && (friendsComposingGroup || !createBox.classList.contains("hidden"))) {
    friendsComposingGroup = true;
    panel.classList.add("is-chatting");
    chat.classList.remove("hidden");
    createBox.classList.remove("hidden");
    document.getElementById("friends-chat-form")?.classList.add("hidden");
    return;
  }

  const channel = HubChat.getActiveChannel?.();
  if (!channel) {
    panel.classList.remove("is-chatting");
    chat.classList.add("hidden");
    return;
  }

  panel.classList.add("is-chatting");
  chat.classList.remove("hidden");
  createBox?.classList.add("hidden");
  document.getElementById("friends-chat-form")?.classList.remove("hidden");
  HubChat.markRead?.(channel.type, channel.id);

  if (channel.type === "global") {
    if (title) title.textContent = "Global chat";
  } else if (channel.type === "group") {
    const g = (HubChat.getGroups?.() || []).find((x) => x.id === channel.id);
    if (title) title.textContent = g?.name || "Group";
  } else {
    const friend = (friends || []).find((f) => f.playerId === channel.id);
    if (title) title.textContent = `Chat · ${friend?.name || "Friend"}`;
  }

  const me = HubPlays?.getPlayerId?.() || "";
  const messages = HubChat.getMessagesFor?.(channel.type, channel.id) || [];
  if (!messages.length) {
    log.innerHTML = `<li class="friends-chat-empty">No messages yet — say hi.</li>`;
    return;
  }

  const stickBottom = log.scrollHeight - log.scrollTop - log.clientHeight < 48;
  log.innerHTML = messages
    .map((m) => {
      const mine = m.from === me;
      const when =
        typeof HubPlays !== "undefined" && HubPlays.formatWhen
          ? HubPlays.formatWhen(m.at)
          : "";
      const who = mine ? "You" : escapeHtml(m.name || "Player");
      return `<li class="${mine ? "is-me" : ""}"><span class="friends-chat-meta">${who} · ${escapeHtml(when)}</span><span class="friends-chat-text">${escapeHtml(m.text)}</span></li>`;
    })
    .join("");
  if (stickBottom) log.scrollTop = log.scrollHeight;
}

function renderFriendsPanel() {
  const list = document.getElementById("friends-list");
  const incomingBox = document.getElementById("friends-incoming");
  const invitesBox = document.getElementById("friends-invites");
  const groupsBox = document.getElementById("friends-groups");
  if (!list || typeof HubFriends === "undefined") return;

  const online = onlineNameSet();
  const friends = HubFriends.getFriends?.() || [];
  const incoming = HubFriends.getIncoming?.() || [];
  const invites = HubFriends.getInvites?.() || [];
  const groups = typeof HubChat !== "undefined" ? HubChat.getGroups?.() || [] : [];

  const globalBtn = document.querySelector('[data-chat-open="global"]');
  if (globalBtn && typeof HubChat !== "undefined") {
    const gu = HubChat.unreadCount?.("global") || 0;
    globalBtn.innerHTML =
      gu > 0
        ? `Global chat <span class="friends-chat-unread">${gu > 9 ? "9+" : gu}</span>`
        : "Global chat";
  }

  if (incomingBox) {
    if (!incoming.length) {
      incomingBox.classList.add("hidden");
      incomingBox.innerHTML = "";
    } else {
      incomingBox.classList.remove("hidden");
      incomingBox.innerHTML = `<h5>Requests</h5><ul>${incoming
        .map(
          (f) =>
            `<li><span>${formatPlayerNameHtml(f.name)}</span><span class="friends-actions"><button type="button" class="hub-btn" data-friend-accept="${escapeHtml(f.playerId)}">Accept</button><button type="button" class="hub-btn" data-friend-decline="${escapeHtml(f.playerId)}">Decline</button></span></li>`
        )
        .join("")}</ul>`;
    }
  }

  if (invitesBox) {
    if (!invites.length) {
      invitesBox.classList.add("hidden");
      invitesBox.innerHTML = "";
    } else {
      invitesBox.classList.remove("hidden");
      invitesBox.innerHTML = `<h5>Game invites</h5><ul>${invites
        .map((inv) => {
          const gameLabel =
            inv.game === "connect-four" ? "Drop Four" : "Tic Tac Toe";
          const href =
            inv.game === "connect-four"
              ? `connect-four/index.html?invite=${encodeURIComponent(inv.id)}`
              : `tic-tac-toe/index.html?invite=${encodeURIComponent(inv.id)}`;
          return `<li><span>${formatPlayerNameHtml(inv.fromName)} · ${escapeHtml(gameLabel)}</span><span class="friends-actions"><a class="hub-btn" href="${href}">Open</a><button type="button" class="hub-btn" data-invite-decline="${escapeHtml(inv.id)}">Decline</button></span></li>`;
        })
        .join("")}</ul>`;
    }
  }

  if (groupsBox) {
    if (!groups.length) {
      groupsBox.classList.add("hidden");
      groupsBox.innerHTML = "";
    } else {
      groupsBox.classList.remove("hidden");
      groupsBox.innerHTML = `<h5>Groups</h5><ul>${groups
        .map((g) => {
          const badge =
            g.unread > 0
              ? `<span class="friends-chat-unread">${g.unread > 9 ? "9+" : g.unread}</span>`
              : "";
          const callLbl =
            typeof HubCalls !== "undefined" && HubCalls.callLabelFor
              ? HubCalls.callLabelFor("group", g.id)
              : "Call";
          return `<li><span>${escapeHtml(g.name)} · ${g.memberCount} members</span><span class="friends-actions"><button type="button" class="hub-btn" data-group-chat="${escapeHtml(g.id)}">Chat${badge}</button><button type="button" class="hub-btn hub-call-btn" data-hub-call-kind="group" data-hub-call-id="${escapeHtml(g.id)}">${escapeHtml(callLbl)}</button></span></li>`;
        })
        .join("")}</ul>`;
    }
  }

  if (!friends.length) {
    list.innerHTML = `<li class="players-empty">No friends yet — add someone by username.</li>`;
    renderFriendsChatPane([]);
    return;
  }

  list.innerHTML = friends
    .map((f) => {
      const isOn = online.has(String(f.name || "").trim().toLowerCase());
      const seen =
        typeof HubPlays.formatLastOnline === "function"
          ? HubPlays.formatLastOnline(f.playerId, {
              onlineLabel: "Online",
              prefix: "Last online",
              empty: "Offline",
              name: f.name || ""
            })
          : isOn
            ? "Online"
            : "Offline";
      const unread =
        typeof HubChat !== "undefined" ? HubChat.unreadCount?.("dm", f.playerId) || 0 : 0;
      const unreadBadge =
        unread > 0
          ? `<span class="friends-chat-unread" aria-label="${unread} unread">${unread > 9 ? "9+" : unread}</span>`
          : "";
      const callLbl =
        typeof HubCalls !== "undefined" && HubCalls.callLabelFor
          ? HubCalls.callLabelFor("dm", f.playerId)
          : "Call";
      return `<li><span><span class="friends-online-dot${isOn ? "" : " is-offline"}" title="${escapeHtml(seen)}"></span><button type="button" class="friends-profile-btn" data-profile-id="${escapeHtml(f.playerId)}" data-profile-name="${escapeHtml(f.name)}">${formatPlayerNameHtml(f.name)}</button><span class="friends-last-online">${escapeHtml(seen)}</span></span><span class="friends-actions"><button type="button" class="hub-btn" data-friend-chat="${escapeHtml(f.playerId)}">Chat${unreadBadge}</button><button type="button" class="hub-btn hub-call-btn" data-hub-call-kind="dm" data-hub-call-id="${escapeHtml(f.playerId)}">${escapeHtml(callLbl)}</button><a class="hub-btn" href="tic-tac-toe/index.html?inviteFriend=${encodeURIComponent(f.playerId)}">TTT</a><a class="hub-btn" href="connect-four/index.html?inviteFriend=${encodeURIComponent(f.playerId)}">C4</a><button type="button" class="hub-btn" data-friend-remove="${escapeHtml(f.playerId)}">Remove</button></span></li>`;
    })
    .join("");

  renderFriendsChatPane(friends);
}

async function renderPlayersPanel() {
  if (!playersList || typeof HubPlays === "undefined") return;
  if (playerNameInput && !playerNameInput.value) {
    playerNameInput.value = HubPlays.getName() || "";
  }
  applyNameLockUI();
  refreshPlayerCodeUI();
  try {
    await HubPlays.sync();
  } catch {}
  try {
    await HubPlays.ensurePlayerCodeRegistered?.();
  } catch {}
  refreshPlayerCodeUI();
  try {
    await refreshOnlineCount();
  } catch {}
  paintPlayersPanelLists();
}

function setPlayerCodeStatus(msg, isError) {
  const el = document.getElementById("player-code-status");
  if (!el) return;
  el.textContent = msg || "";
  el.classList.toggle("is-error", !!isError);
  el.classList.toggle("hidden", !msg);
}

function setGateCodeStatus(msg, isError) {
  const el = document.getElementById("gate-code-status");
  if (!el) return;
  el.textContent = msg || "";
  el.classList.toggle("is-error", !!isError);
  el.classList.toggle("hidden", !msg);
}

function refreshInviteProgressUI() {
  const el = document.getElementById("player-invite-progress");
  if (!el) return;
  const status =
    (typeof window.HubReferrals?.getStatus === "function" && HubReferrals.getStatus()) || null;
  if (!status) {
    el.textContent = "0 / 3";
    return;
  }
  const need = Math.max(1, Number(status.need) || 3);
  const count = Math.max(0, Number(status.count) || 0);
  el.textContent = status.unlocked
    ? `INVITER unlocked · ${count} invites`
    : `${Math.min(count, need)} / ${need}`;
}

let playerCodeRevealed = false;

function currentPlayerCodeDisplay() {
  if (typeof HubPlays === "undefined") return "";
  let code = String(HubPlays.getPlayerCode?.() || "").trim();
  if (
    !code ||
    (typeof HubPlays.isPoisonPlayerCode === "function" && HubPlays.isPoisonPlayerCode(code)) ||
    /^unde-?fned$/i.test(code.replace(/\s/g, ""))
  ) {
    try {
      localStorage.removeItem("hub-player-code");
    } catch {}
    code = String(HubPlays.getPlayerCode?.() || "").trim();
  }
  if (/^unde-?fned$/i.test(code.replace(/\s/g, ""))) code = "";
  return code;
}

function refreshPlayerCodeUI() {
  const el = document.getElementById("player-code-value");
  const revealBtn = document.getElementById("player-code-reveal-btn");
  const code = currentPlayerCodeDisplay();
  if (el) {
    if (!code) {
      el.textContent = "————";
      el.classList.remove("is-masked");
      el.setAttribute("aria-label", "No player code yet");
    } else if (playerCodeRevealed) {
      el.textContent = code;
      el.classList.remove("is-masked");
      el.setAttribute("aria-label", `Player code ${code}`);
    } else {
      el.textContent = "••••-••••";
      el.classList.add("is-masked");
      el.setAttribute("aria-label", "Player code hidden");
    }
  }
  if (revealBtn) {
    revealBtn.textContent = playerCodeRevealed ? "Hide code" : "Show code";
    revealBtn.setAttribute("aria-pressed", playerCodeRevealed ? "true" : "false");
    revealBtn.disabled = !code;
  }
  refreshPasswordStateUI();
  renderSavedAccounts();
  refreshInviteProgressUI();
}

function refreshPasswordStateUI() {
  const el = document.getElementById("player-password-state");
  if (!el || typeof HubPlays === "undefined") return;
  const has = !!HubPlays.accountHasPassword?.();
  el.textContent = has ? "You have a password on this account" : "No password set";
  el.classList.toggle("has-password", has);
}

const revealedAccountCodes = new Set();

function accountListHtml(accounts, activeCode) {
  if (!accounts.length) {
    return `<li class="player-accounts-empty">No saved accounts yet — create one or log in with a code.</li>`;
  }
  return accounts
    .map((a) => {
      const code = HubPlays.formatPlayerCode?.(a.code) || a.code;
      const norm = HubPlays.normalizePlayerCode?.(code) || "";
      if (
        (typeof HubPlays.isPoisonPlayerCode === "function" && HubPlays.isPoisonPlayerCode(code)) ||
        /^unde-?fned$/i.test(String(code || "").replace(/\s/g, ""))
      ) {
        return "";
      }
      const active = norm && norm === activeCode;
      const revealed = !!(norm && revealedAccountCodes.has(norm));
      const label = HubPlays.sanitizeName?.(a.name) || a.name || "Unnamed";
      const lock = a.hasPassword ? " · password" : "";
      return `<li class="${active ? "is-active" : ""}" data-account-code="${escapeHtml(code)}">
        <span class="player-accounts-meta">
          <strong>${escapeHtml(label)}${active ? " · active" : ""}${lock}</strong>
          <span class="player-accounts-code${revealed ? "" : " is-masked"}" aria-label="${
            revealed ? `Player code ${escapeHtml(code)}` : "Player code hidden"
          }">${revealed ? escapeHtml(code) : "••••-••••"}</span>
        </span>
        <span class="player-accounts-actions">
          <button type="button" class="hub-btn" data-account-reveal="${escapeHtml(
            code
          )}" aria-pressed="${revealed ? "true" : "false"}">${revealed ? "Hide" : "Show"}</button>
          ${
            active
              ? ""
              : `<button type="button" class="hub-btn" data-account-switch="${escapeHtml(code)}">Switch</button>`
          }
          <button type="button" class="hub-btn" data-account-forget="${escapeHtml(code)}" title="Requires typing the player code">Forget…</button>
        </span>
      </li>`;
    })
    .filter(Boolean)
    .join("");
}

function renderSavedAccounts() {
  if (typeof HubPlays === "undefined") return;
  try {
    HubPlays.rememberCurrentAccount?.();
  } catch {}
  const accounts = HubPlays.getSavedAccounts?.() || [];
  const activeCode = HubPlays.normalizePlayerCode?.(HubPlays.getPlayerCode?.() || "") || "";
  const html = accountListHtml(accounts, activeCode);
  const list = document.getElementById("player-accounts-list");
  const gateList = document.getElementById("gate-accounts-list");
  if (list) list.innerHTML = html;
  if (gateList) gateList.innerHTML = html;
}

async function loginWithPlayerCode(raw, statusFn = setPlayerCodeStatus) {
  if (typeof HubPlays === "undefined") return;
  statusFn("Logging in…", false);
  let result;
  try {
    result = await HubPlays.restoreWithPlayerCode(raw);
  } catch (err) {
    statusFn(err?.message || "Couldn't log in", true);
    renderSavedAccounts();
    return;
  }
  if (!result?.ok) {
    statusFn(result?.error || "Couldn't log in", true);
    renderSavedAccounts();
    return;
  }
  if (result.already) {
    statusFn(
      result.name
        ? `Already on ${result.name} — saved on this device`
        : "Already on that account — saved on this device",
      false
    );
    refreshPlayerCodeUI();
    if (hasPlayerName()) hidePlayerNameModal();
    return;
  }
  if (playerNameInput && result.name) playerNameInput.value = result.name;
  if (playerNameModalInput && result.name) playerNameModalInput.value = result.name;
  statusFn(
    result.adopted
      ? `Code ${result.code} added on this device (no server needed). Reloading…`
      : result.name
        ? `Logged in as ${result.name}. Reloading…`
        : "Account restored. Reloading…",
    false
  );
  renderSavedAccounts();
  setTimeout(() => window.location.reload(), 500);
}

async function createAccountFlow(statusFn = setPlayerCodeStatus) {
  if (typeof HubPlays === "undefined") return;
  const ok = window.confirm(
    "Create a new blank account on this device?\n\nYour current account stays saved so you can switch back with its code."
  );
  if (!ok) return;
  statusFn("Creating account…", false);
  let result;
  try {
    result = await HubPlays.createNewAccount?.();
  } catch (err) {
    statusFn(err?.message || "Couldn't create account", true);
    return;
  }
  if (!result?.ok) {
    statusFn(result?.error || "Couldn't create account", true);
    return;
  }
  if (playerNameInput) playerNameInput.value = "";
  if (playerNameModalInput) playerNameModalInput.value = "";
  statusFn(`New account ready · code ${result.code}. Reloading…`, false);
  setTimeout(() => window.location.reload(), 500);
}

document.getElementById("player-code-reveal-btn")?.addEventListener("click", () => {
  playerCodeRevealed = !playerCodeRevealed;
  refreshPlayerCodeUI();
});

document.getElementById("player-code-copy-btn")?.addEventListener("click", async () => {
  if (typeof HubPlays === "undefined") return;
  const code = HubPlays.getPlayerCode?.() || "";
  if (!code) return;
  try {
    await navigator.clipboard.writeText(code);
    setPlayerCodeStatus(`Copied ${code}`, false);
  } catch {
    setPlayerCodeStatus(`Your code is ${code}`, false);
  }
});

document.getElementById("player-invite-copy-btn")?.addEventListener("click", async () => {
  const url =
    (typeof window.HubReferrals?.getInviteUrl === "function" && HubReferrals.getInviteUrl()) ||
    "";
  if (!url) {
    setPlayerCodeStatus("Claim a name first to get an invite link", true);
    return;
  }
  try {
    await navigator.clipboard.writeText(url);
    setPlayerCodeStatus("Invite link copied — share it with friends", false);
  } catch {
    setPlayerCodeStatus(url, false);
  }
  refreshInviteProgressUI();
});

document.addEventListener("hub-invite-credited", () => {
  refreshInviteProgressUI();
  try {
    renderTitlePicker?.();
  } catch {}
});
document.addEventListener("hub-inviter-unlocked", () => {
  refreshInviteProgressUI();
  try {
    renderTitlePicker?.();
    renderColorPicker?.();
  } catch {}
  setPlayerNameStatus("INVITER title unlocked!", false);
});

document.getElementById("player-code-transfer-btn")?.addEventListener("click", async () => {
  if (typeof HubPlays === "undefined") return;
  const key = HubPlays.getAccountTransferKey?.() || "";
  if (!key) {
    setPlayerCodeStatus("No account to copy yet", true);
    return;
  }
  try {
    await navigator.clipboard.writeText(key);
    setPlayerCodeStatus("Copied transfer key — paste into Log in on another device", false);
  } catch {
    setPlayerCodeStatus(key, false);
  }
});

document.getElementById("player-code-restore-btn")?.addEventListener("click", async () => {
  const input = document.getElementById("player-code-restore-input");
  await loginWithPlayerCode(input?.value || "", setPlayerCodeStatus);
});

document.getElementById("player-code-new-btn")?.addEventListener("click", async () => {
  await createAccountFlow(setPlayerCodeStatus);
});

document.getElementById("player-password-set-btn")?.addEventListener("click", async () => {
  if (typeof HubPlays === "undefined") return;
  const pw = document.getElementById("player-password-input")?.value || "";
  const confirm = document.getElementById("player-password-confirm")?.value || "";
  setPlayerCodeStatus("Saving password…", false);
  let result;
  try {
    result = await HubPlays.setAccountPassword?.(pw, confirm);
  } catch (err) {
    setPlayerCodeStatus(err?.message || "Couldn't set password", true);
    return;
  }
  if (!result?.ok) {
    setPlayerCodeStatus(result?.error || "Couldn't set password", true);
    return;
  }
  const pwIn = document.getElementById("player-password-input");
  const pwConfirm = document.getElementById("player-password-confirm");
  if (pwIn) pwIn.value = "";
  if (pwConfirm) pwConfirm.value = "";
  setPlayerCodeStatus(result.message || "Password set — all progress kept", false);
  refreshPasswordStateUI();
  renderSavedAccounts();
});

document.getElementById("player-password-clear-btn")?.addEventListener("click", async () => {
  if (typeof HubPlays === "undefined") return;
  if (!HubPlays.accountHasPassword?.()) {
    setPlayerCodeStatus("No password set on this account", false);
    return;
  }
  const ok = window.confirm(
    "Clear your login password?\n\nYour account and all progress stay. You'll log in with your player code again."
  );
  if (!ok) return;
  let result;
  try {
    result = await HubPlays.clearAccountPassword?.();
  } catch (err) {
    setPlayerCodeStatus(err?.message || "Couldn't clear password", true);
    return;
  }
  if (!result?.ok) {
    setPlayerCodeStatus(result?.error || "Couldn't clear password", true);
    return;
  }
  setPlayerCodeStatus(result.message || "Password cleared", false);
  refreshPasswordStateUI();
  renderSavedAccounts();
});

document.getElementById("gate-code-login-btn")?.addEventListener("click", async () => {
  const input = document.getElementById("gate-code-input");
  await loginWithPlayerCode(input?.value || "", setGateCodeStatus);
});

document.getElementById("gate-new-account-btn")?.addEventListener("click", async () => {
  await createAccountFlow(setGateCodeStatus);
});

function onAccountListClick(e) {
  const revealBtn = e.target.closest("[data-account-reveal]");
  const switchBtn = e.target.closest("[data-account-switch]");
  const forgetBtn = e.target.closest("[data-account-forget]");
  if (revealBtn) {
    const code = revealBtn.getAttribute("data-account-reveal") || "";
    const norm = HubPlays?.normalizePlayerCode?.(code) || "";
    if (norm) {
      if (revealedAccountCodes.has(norm)) revealedAccountCodes.delete(norm);
      else revealedAccountCodes.add(norm);
    }
    renderSavedAccounts();
    return;
  }
  if (switchBtn) {
    const statusFn = e.currentTarget?.id === "gate-accounts-list" ? setGateCodeStatus : setPlayerCodeStatus;
    const code = switchBtn.getAttribute("data-account-switch") || "";
    const norm = HubPlays?.normalizePlayerCode?.(code);
    const saved = (HubPlays?.getSavedAccounts?.() || []).find(
      (a) => HubPlays?.normalizePlayerCode?.(a.code) === norm
    );
    if (saved?.hasPassword || (saved?.playerId && HubPlays?.accountHasPassword?.(saved.playerId))) {
      const typed = window.prompt(
        `This account has a password.\n\nEnter the password for "${saved.name || "Unnamed"}":`
      );
      if (typed == null) {
        statusFn("Switch cancelled", false);
        return;
      }
      (async () => {
        const ok = await HubPlays.verifyAccountPassword?.(typed, saved.playerId);
        if (!ok) {
          statusFn("Wrong password", true);
          return;
        }
        // Switch with the saved player code — password already verified
        await loginWithPlayerCode(code, statusFn);
      })();
      return;
    }
    loginWithPlayerCode(code, statusFn);
    return;
  }
  if (forgetBtn) {
    const code = forgetBtn.getAttribute("data-account-forget") || "";
    const active = HubPlays?.normalizePlayerCode?.(HubPlays.getPlayerCode?.() || "");
    const norm = HubPlays?.normalizePlayerCode?.(code);
    const statusFn = e.currentTarget?.id === "gate-accounts-list" ? setGateCodeStatus : setPlayerCodeStatus;
    if (norm && active && norm === active) {
      statusFn("Can't forget the account you're using — switch first", true);
      return;
    }
    const formatted = HubPlays?.formatPlayerCode?.(code) || code;
    const saved = (HubPlays?.getSavedAccounts?.() || []).find(
      (a) => HubPlays?.normalizePlayerCode?.(a.code) === norm
    );
    const label = saved?.name || "Unnamed";
    const ok = window.confirm(
      `Forget "${label}" on this device?\n\nCode: ${formatted}\n\nThis only removes it from this device's list. The account still exists — you can log in again with the code.\n\nPress OK, then type the code to unlock forget.`
    );
    if (!ok) {
      statusFn("Forget cancelled", false);
      return;
    }
    const typed = window.prompt(
      `Type the player code to forget "${label}":\n\n${formatted}`
    );
    if (typed == null) {
      statusFn("Forget cancelled", false);
      return;
    }
    const typedNorm = HubPlays?.normalizePlayerCode?.(typed) || "";
    if (!norm || typedNorm !== norm) {
      statusFn("Code didn't match — account kept", true);
      return;
    }
    HubPlays?.removeSavedAccount?.(code);
    statusFn(`Forgot ${formatted} (${label})`, false);
    renderSavedAccounts();
  }
}

document.getElementById("player-accounts-list")?.addEventListener("click", onAccountListClick);
document.getElementById("gate-accounts-list")?.addEventListener("click", onAccountListClick);

document.getElementById("player-code-restore-input")?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    document.getElementById("player-code-restore-btn")?.click();
  }
});

document.getElementById("gate-code-input")?.addEventListener("keydown", (e) => {
  e.stopPropagation();
  if (e.key === "Enter") {
    e.preventDefault();
    document.getElementById("gate-code-login-btn")?.click();
  }
});
document.getElementById("gate-code-input")?.addEventListener("keyup", (e) => e.stopPropagation());
document.getElementById("gate-code-input")?.addEventListener("keypress", (e) => e.stopPropagation());

document.addEventListener("hub-username-gate-open", () => {
  renderSavedAccounts();
});

function escapeHtml(text) {
  return String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function isGuestDisplayName(name) {
  const n = String(name || "").trim().toLowerCase();
  return !n || n === "guest" || n.startsWith("guest-") || n === "player";
}

function isCreatorName(name) {
  return String(name || "").trim().toLowerCase() === CREATOR_NAME.toLowerCase();
}

function getSpecialPlayerStyle(name) {
  return SPECIAL_PLAYER_NAMES[String(name || "").trim().toLowerCase()] || null;
}

function getPlayerTitleBadges(name) {
  if (typeof HubPlays !== "undefined" && HubPlays.getActiveTitleBadge) {
    // Ensure self legend is reflected locally even before cloud sync finishes.
    if (
      typeof HubAchievements !== "undefined" &&
      HubAchievements.hasAllUnlocked?.() &&
      hasPlayerName() &&
      String(HubPlays.getName?.() || "").trim().toLowerCase() ===
        String(name || "").trim().toLowerCase()
    ) {
      HubPlays.markLegend?.().catch(() => {});
    }
    if (
      typeof HubAchievements !== "undefined" &&
      HubAchievements.isUnlocked?.("fishing_all") &&
      hasPlayerName() &&
      String(HubPlays.getName?.() || "").trim().toLowerCase() ===
        String(name || "").trim().toLowerCase()
    ) {
      HubPlays.markMasterFisher?.().catch(() => {});
    }
    const badge = HubPlays.getActiveTitleBadge(name);
    return badge ? [badge] : [];
  }

  // Fallback if HubPlays title API is missing
  const badges = [];
  const special = getSpecialPlayerStyle(name);
  if (special?.badge) badges.push(special.badge);
  return badges.slice(0, 1);
}

function formatPlayerNameHtml(name) {
  const safe = escapeHtml(name);
  const special = getSpecialPlayerStyle(name);
  const accent =
    typeof HubPlays !== "undefined" ? HubPlays.getAccentColor?.(name) || "" : "";
  const extra = HubPlays?.EXTRA_COLORS?.[accent];
  const isAnimatedAccent = !!(extra && extra.animated);
  const isCheesyAccent = accent === "#f0b429";
  const nameStyle =
    accent && !isAnimatedAccent && !isCheesyAccent
      ? ` style="color:${escapeHtml(accent)}"`
      : "";
  let nameClass = "player-name-custom";
  if (extra?.nameClass) nameClass = extra.nameClass;
  else if (accent === "#f1c40f") nameClass = "player-name-legend";
  else if (accent === "#2ec4b6") nameClass = "player-name-master-fisher";
  else if (isCheesyAccent) nameClass = "player-name-cheesy";
  else if (accent === "#2f9e44") nameClass = "player-name-oscar";
  else if (accent === "#1c7ed6") nameClass = "player-name-creator";
  else if (accent === "#e03131") nameClass = "player-name-tester";
  else if (!accent && special) nameClass = special.className;
  const nameHtml = accent || special
    ? `<strong class="${nameClass}" title="${escapeHtml(special?.title || "")}"${nameStyle}>${safe}</strong>`
    : `<strong>${safe}</strong>`;
  const badges = getPlayerTitleBadges(name)
    .map((b) => {
      const extraClass = b.colorClass ? ` ${escapeHtml(b.colorClass)}` : "";
      const style =
        b.color && !b.colorClass
          ? ` style="background:${escapeHtml(b.color)};color:${escapeHtml(b.textColor || "#fff")}"`
          : b.colorClass
            ? ` style="color:${escapeHtml(b.textColor || "#fff")}"`
            : "";
      return `<span class="player-title ${escapeHtml(b.className)}${extraClass}" title="${escapeHtml(b.label)}"${style}>${escapeHtml(b.label)}</span>`;
    })
    .join("");
  return badges ? `${nameHtml}${badges}` : nameHtml;
}

function renderTitlePicker() {
  const picker = document.getElementById("title-picker");
  const buttons = document.getElementById("title-picker-buttons");
  if (!picker || !buttons || typeof HubPlays === "undefined") return;

  if (!hasPlayerName()) {
    picker.classList.add("hidden");
    buttons.innerHTML = "";
    return;
  }

  // Show unlocked titles always; LEGEND / MASTER FISHER / INVITER stay visible even when locked.
  const showcase = (HubPlays.getTitleShowcase?.() || []).filter(
    (t) =>
      t.unlocked || t.id === "legend" || t.id === "master_fisher" || t.id === "inviter"
  );
  if (!showcase.length) {
    picker.classList.add("hidden");
    buttons.innerHTML = "";
    return;
  }

  const active = HubPlays.getActiveTitleId?.() || "";
  const unlockedIds = new Set(showcase.filter((t) => t.unlocked).map((t) => t.id));
  const options = [...showcase];
  // "None" only works for accounts that can hide reserved titles (need LEGEND).
  if (unlockedIds.has("legend")) {
    options.push({ id: "none", label: "None", className: "player-title-none", unlocked: true });
  }

  picker.classList.remove("hidden");
  buttons.innerHTML = options
    .map((opt) => {
      const locked = !opt.unlocked;
      const selected = !locked && (active === opt.id || (opt.id === "none" && active === "none"));
      const hint = locked
        ? opt.id === "master_fisher"
          ? "Discover 90% of fish in Fishing Idle"
          : opt.id === "inviter"
            ? "Invite 3 friends who claim a name with your link"
            : "Unlock all achievements"
        : opt.label;
      return `<button type="button" class="title-pick-btn ${escapeHtml(opt.className)}${
        selected ? " active" : ""
      }${locked ? " is-locked" : ""}" data-title="${escapeHtml(opt.id)}" data-locked="${
        locked ? "true" : "false"
      }" aria-pressed="${selected ? "true" : "false"}" aria-disabled="${
        locked ? "true" : "false"
      }" title="${escapeHtml(hint)}">${escapeHtml(opt.label)}${
        locked ? `<span class="title-lock-tag">Locked</span>` : ""
      }</button>`;
    })
    .join("");
}

function renderColorPicker() {
  const picker = document.getElementById("color-picker");
  const buttons = document.getElementById("color-picker-buttons");
  if (!picker || !buttons || typeof HubPlays === "undefined") return;

  if (!hasPlayerName()) {
    picker.classList.add("hidden");
    buttons.innerHTML = "";
    return;
  }

  const showcase = (
    HubPlays.getColorShowcase?.() ||
    HubPlays.getTitleShowcase?.() ||
    []
  ).filter(
    (t) =>
      t.unlocked || t.id === "legend" || t.id === "master_fisher" || t.id === "inviter"
  );
  if (!showcase.length) {
    picker.classList.add("hidden");
    buttons.innerHTML = "";
    return;
  }

  const canPick = HubPlays.canPickAccentColors?.() || HubPlays.canMixTitleColors?.() || false;
  const activeColorId = HubPlays.getActiveAccentTitleId?.() || "";
  const label = picker.querySelector(".title-picker-label");
  if (label) {
    label.textContent = canPick ? "Your color (mix with title)" : "Title colors";
  }

  picker.classList.remove("hidden");
  buttons.innerHTML = showcase
    .map((opt) => {
      const locked = !opt.unlocked;
      const selected = !locked && activeColorId === opt.id;
      const extra = HubPlays.EXTRA_COLORS?.[opt.id];
      const isAnimated = !!(opt.animated || extra?.animated);
      const hint = locked
        ? opt.id === "master_fisher"
          ? "MASTER FISHER teal — discover 90% of fish in Fishing Idle"
          : opt.id === "inviter"
            ? "INVITER purple — invite 3 friends who claim a name"
            : "LEGEND yellow — unlock all achievements"
        : canPick
          ? isAnimated
            ? `${opt.label} animated color (keeps your title)`
            : `Use ${opt.label} color (keeps your title)`
          : `${opt.label} color`;
      const bgStyle =
        isAnimated || opt.id === "cheesy" ? "" : ` style="background:${escapeHtml(opt.color)}"`;
      const animClass = isAnimated
        ? opt.id === "aurora"
          ? " is-aurora"
          : opt.id === "mono"
            ? " is-mono"
            : opt.id === "tide"
              ? " is-tide"
              : " is-aurora"
        : opt.id === "cheesy"
          ? " is-cheesy"
          : "";
      return `<button type="button" class="color-pick-btn${selected ? " active" : ""}${
        locked ? " is-locked" : ""
      }${!canPick && !locked ? " is-fixed" : ""}${animClass}" data-title-color="${escapeHtml(
        opt.id
      )}" data-locked="${locked ? "true" : "false"}" title="${escapeHtml(hint)}" aria-label="${escapeHtml(
        hint
      )}" aria-disabled="${locked || !canPick ? "true" : "false"}"${bgStyle}>${
        locked ? `<span class="color-lock-mark" aria-hidden="true">🔒</span>` : ""
      }</button>`;
    })
    .join("");
}

savePlayerNameBtn?.addEventListener("click", () => savePlayerNameFrom(playerNameInput?.value));
lockPlayerNameBtn?.addEventListener("click", () => togglePlayerNameLock());
playerNameSaveBtn?.addEventListener("click", () => savePlayerNameFrom(playerNameModalInput?.value));
document.getElementById("title-picker-buttons")?.addEventListener("click", async (e) => {
  const btn = e.target.closest("[data-title]");
  if (!btn || typeof HubPlays === "undefined") return;
  if (btn.dataset.locked === "true") {
    const id = btn.dataset.title;
    setPlayerNameStatus(
      id === "legend"
        ? "LEGEND (yellow) unlocks when you complete all achievements"
        : id === "master_fisher"
          ? "MASTER FISHER unlocks at 90% of the Fishing Idle catch book"
          : id === "inviter"
            ? "INVITER unlocks when 3 friends claim a name with your invite link"
          : id === "og"
          ? "OG (green) is a reserved title"
          : id === "tester"
            ? "TESTER (red) is a reserved title"
            : id === "cheesy"
              ? "CHEESY LIL GUY is reserved for OscarVR29"
              : "That title is locked",
      true
    );
    return;
  }
  const titleId = btn.dataset.title;
  btn.disabled = true;
  try {
    const result = await HubPlays.setActiveTitle(titleId);
    if (!result.ok) {
      setPlayerNameStatus(result.error || "Couldn't change title", true);
      return;
    }
    paintPlayersPanelLists();
    if (leaderboardsPanel && !leaderboardsPanel.classList.contains("hidden")) {
      renderLeaderboardList();
    }
    const label =
      titleId === "none"
        ? "Title hidden"
        : `Title set to ${(HubPlays.TITLE_DEFS?.[titleId] || {}).label || titleId}`;
    setPlayerNameStatus(label, false);
  } finally {
    btn.disabled = false;
  }
});
document.getElementById("color-picker-buttons")?.addEventListener("click", async (e) => {
  const btn = e.target.closest("[data-title-color]");
  if (!btn || typeof HubPlays === "undefined") return;
  const id = btn.dataset.titleColor;
  if (btn.dataset.locked === "true") {
    setPlayerNameStatus(
      id === "legend"
        ? "Yellow unlocks with LEGEND (all achievements)"
        : id === "master_fisher"
          ? "Teal unlocks with MASTER FISHER (90% catch book)"
          : id === "og"
          ? "Green unlocks with the OG title"
          : id === "owner"
            ? "Blue is the OWNER color"
            : id === "tester"
              ? "Red unlocks with the TESTER title"
              : id === "cheesy"
                ? "Cheese color unlocks with CHEESY LIL GUY"
                : HubPlays.EXTRA_COLORS?.[id]
                ? `${HubPlays.EXTRA_COLORS[id].label} is a reserved color`
                : "That color is locked",
      true
    );
    return;
  }
  if (!(HubPlays.canPickAccentColors?.() || HubPlays.canMixTitleColors?.())) {
    setPlayerNameStatus("Unlock another title or special color to mix", true);
    return;
  }
  btn.disabled = true;
  try {
    const result = await HubPlays.setAccentFromTitle(id);
    if (!result.ok) {
      setPlayerNameStatus(result.error || "Couldn't change color", true);
      return;
    }
    paintPlayersPanelLists();
    if (leaderboardsPanel && !leaderboardsPanel.classList.contains("hidden")) {
      renderLeaderboardList();
    }
    const label =
      (HubPlays.EXTRA_COLORS?.[id] || {}).label ||
      (HubPlays.TITLE_DEFS?.[id] || {}).label ||
      id;
    setPlayerNameStatus(`Color set to ${label} (title unchanged)`, false);
  } finally {
    btn.disabled = false;
  }
});
document.getElementById("players-online")?.addEventListener("click", async () => {
  try {
    await refreshOnlineCount();
  } catch {}
  setPlayersRosterMode("online");
});
document.getElementById("players-alltime")?.addEventListener("click", async () => {
  try {
    await refreshOnlineCount();
  } catch {}
  setPlayersRosterMode("alltime");
});
playerNameModalInput?.addEventListener("keydown", (e) => {
  e.stopPropagation();
  if (e.key === "Enter") savePlayerNameFrom(playerNameModalInput.value);
});
playerNameInput?.addEventListener("keydown", (e) => {
  e.stopPropagation();
  if (e.key === "Enter") {
    if (typeof HubPlays !== "undefined" && HubPlays.isNameLocked()) return;
    savePlayerNameFrom(playerNameInput.value);
  }
});
playerNameModalInput?.addEventListener("keyup", (e) => e.stopPropagation());
playerNameInput?.addEventListener("keyup", (e) => e.stopPropagation());

function renderAchievementsPanel() {
  if (!achievementsGrid || typeof HubAchievements === "undefined") return;
  const all = HubAchievements.getAll();
  const unlocked = all.filter(a => a.unlocked).length;
  if (achievementsCount) achievementsCount.textContent = `${unlocked}/${all.length}`;
  achievementsGrid.innerHTML = "";
  // Show unlocked first, then locked
  const sorted = [...all.filter(a => a.unlocked), ...all.filter(a => !a.unlocked)];
  for (const a of sorted) {
    const card = document.createElement("div");
    card.className = "achievement-card " + (a.unlocked ? "unlocked" : "locked");
    card.title = a.desc;
    card.innerHTML = `<span class="achievement-emoji">${a.emoji}</span>` +
      `<span class="achievement-name">${a.name}</span>` +
      `<span class="achievement-desc">${a.desc}</span>`;
    achievementsGrid.appendChild(card);
  }
}

let toastTimer = null;
function showAchievementToast(id) {
  if (!achievementToast || typeof HubAchievements === "undefined") return;
  const def = HubAchievements.getDefinition(id);
  if (!def) return;
  achievementToast.classList.remove("hidden");
  achievementToast.textContent = `${def.emoji} Achievement unlocked: ${def.name}`;
  // Force reflow then animate in
  achievementToast.getBoundingClientRect();
  achievementToast.classList.add("show");
  playSound("achieve");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    achievementToast.classList.remove("show");
    setTimeout(() => achievementToast.classList.add("hidden"), 350);
  }, 3000);
}

// Poll for pending achievements every time we return to the hub
function checkPendingAchievements() {
  if (typeof HubAchievements === "undefined") return;
  const pending = HubAchievements.getPending();
  if (pending.length > 0) {
    // Show toasts sequentially
    let delay = 0;
    for (const id of pending) {
      setTimeout(() => showAchievementToast(id), delay);
      delay += 3500;
    }
    // Re-render panel if open
    if (achievementsPanel && !achievementsPanel.classList.contains("hidden")) {
      renderAchievementsPanel();
    }
  }
}

shareMomentBtn?.addEventListener("click", () => shareMoment());

document.getElementById("discord-invite-btn")?.addEventListener("click", (e) => {
  if (typeof HubDiscord !== "undefined" && HubDiscord.openInvite) {
    e.preventDefault();
    HubDiscord.openInvite();
  }
});

function startDiscordLogin() {
  if (typeof HubDiscord === "undefined" || !HubDiscord.loginWithDiscord) {
    showGamesMessage("Discord login isn't loaded yet", 2200);
    window.open("https://discord.gg/6NHYfPwAwg", "_blank", "noopener,noreferrer");
    return;
  }
  showGamesMessage("Opening Discord…", 1600);
  const result = HubDiscord.loginWithDiscord();
  if (result && result.error) showGamesMessage(result.error, 3200);
}

document.getElementById("gate-discord-login-btn")?.addEventListener("click", () => startDiscordLogin());
document.getElementById("player-discord-login-btn")?.addEventListener("click", () => startDiscordLogin());

document.addEventListener("hub-discord-auth", (ev) => {
  const result = ev?.detail;
  if (!result) return;
  if (result.ok) {
    const name = result.name || "Discord";
    showGamesMessage(`Signed in with Discord as ${name}`, 2800);
    try {
      hidePlayerNameModal?.();
    } catch {}
    try {
      refreshPlayerCodeUI?.();
    } catch {}
    return;
  }
  showGamesMessage(result.error || "Discord login failed", 4200);
  // Still offer the server while login is being set up
  try {
    HubDiscord?.openInvite?.();
  } catch {}
});
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
modeBtn?.addEventListener("click", () => togglePlayMode());

// Confirm the newest files loaded (helps when browser cache sticks).
const sixCount = typeof WORDS_6 !== "undefined" ? WORDS_6.length : 0;
applySiteConfig();
showMessage(`Loaded · ${sixCount} six-letter words`);

function markHubInteractive(route) {
  if (window.__myGamesInteractiveAt != null) return;
  window.__myGamesInteractiveAt = performance.now();
  window.__myGamesInteractiveRoute = route;
  try {
    performance.mark("mygames-interactive");
  } catch {}
}

function bootAfterUsername() {
  // Land on My Games first so What's new never sits on the Guessword board.
  announceHubBuildOnBoot();
  bindWhatsNewOk();
  if (location.hash === "#wordle") {
    document.documentElement.classList.add("playing-guessword");
    gamesScreen?.classList.add("hidden");
    if (showWhatsNew()) {
      bindWhatsNewOk(() => showMenu());
    } else {
      showMenu();
    }
    window.dismissHubBootLoader?.();
    markHubInteractive("guessword");
    return;
  }

  showGamesScreen();
  window.dismissHubBootLoader?.();
  markHubInteractive("hub");
  try {
    const flair = window.HubEggs?.consumePendingHubFlair?.();
    if (flair) {
      const labels = {
        clutch: "Clutch flair ready — equip it in Titles",
        lefty: "Lefty badge ready — equip it in Titles",
        silly_hat: "Silly hat ready — equip it in Titles",
        centerless: "Centerless title ready — equip it in Titles",
        zen_farmer: "Zen Farmer title ready — equip it in Titles",
        pacifist: "Pacifist title ready — equip it in Titles"
      };
      window.HubEggs?.toast?.(labels[flair] || `Unlocked: ${flair}`);
      renderTitlePicker?.();
    }
  } catch {}
  showWhatsNew();
}

if (!hasPlayerName()) {
  window.__hubAfterUsername = bootAfterUsername;
  maybeAskPlayerName(true);
} else {
  bootAfterUsername();
}

document.addEventListener("hub-username-ready", () => {
  if (window.__hubAfterUsername) {
    const next = window.__hubAfterUsername;
    window.__hubAfterUsername = null;
    next();
  }
});

// Block Escape from closing the required username popup
document.addEventListener(
  "keydown",
  (e) => {
    if (e.key !== "Escape") return;
    if (!hasPlayerName() && playerNameModal && !playerNameModal.classList.contains("hidden")) {
      e.preventDefault();
      e.stopPropagation();
      playerNameModalInput?.focus();
    }
  },
  true
);
