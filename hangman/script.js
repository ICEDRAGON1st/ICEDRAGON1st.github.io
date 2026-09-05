const STATS_KEY = "hangman-stats";
const LANG_KEY = "wordle-lang";
const DIFF_KEY = "hangman-difficulty";
const THEME_KEY = "hangman-theme";
const LANGUAGES = ["en", "da", "is"];

const DIFFICULTY = {
  easy: {
    label: "Easy",
    length: 4,
    minLen: 3,
    maxLen: 5,
    maxWrong: 8,
    blurb: "shorter words · 8 misses"
  },
  medium: {
    label: "Medium",
    length: 5,
    minLen: 5,
    maxLen: 7,
    maxWrong: 6,
    blurb: "mid-length words · 6 misses"
  },
  hard: {
    label: "Hard",
    length: 6,
    minLen: 6,
    maxLen: 12,
    maxWrong: 4,
    blurb: "longer words · 4 misses"
  }
};

const PARTS = [
  "part-head",
  "part-body",
  "part-arm-l",
  "part-arm-r",
  "part-leg-l",
  "part-leg-r"
];

const GALLOWS_ALWAYS = ["part-base", "part-pole", "part-beam", "part-rope"];

const KEYBOARD_EN = "abcdefghijklmnopqrstuvwxyz".split("");
const KEYBOARD_DA = "abcdefghijklmnopqrstuvwxyzæøå".split("");
const KEYBOARD_IS = "abcdefghijklmnopqrstuvwxyzáðéíóöúýþæ".split("");

const wordEl = document.getElementById("word");
const statusEl = document.getElementById("status");
const missesEl = document.getElementById("misses");
const keyboardEl = document.getElementById("keyboard");
const winsEl = document.getElementById("wins");
const streakEl = document.getElementById("streak");
const bestStreakEl = document.getElementById("best-streak");
const hudDiff = document.getElementById("hud-diff");
const hudTheme = document.getElementById("hud-theme");
const themeHintEl = document.getElementById("theme-hint");
const overlay = document.getElementById("overlay");
const overlayTitle = document.getElementById("overlay-title");
const overlayText = document.getElementById("overlay-text");
const startBtn = document.getElementById("start-btn");
const resumeBtn = document.getElementById("resume-btn");
const viewBoardBtn = document.getElementById("view-board-btn");
const gamesBtn = document.getElementById("games-btn");
const menuBtn = document.getElementById("menu-btn");
const langBtn = document.getElementById("lang-btn");
const difficultyPicker = document.getElementById("difficulty-picker");
const themePicker = document.getElementById("theme-picker");

let currentLang = localStorage.getItem(LANG_KEY) || "en";
if (!LANGUAGES.includes(currentLang)) currentLang = "en";

let difficultyMode = localStorage.getItem(DIFF_KEY) || "easy";
if (!DIFFICULTY[difficultyMode]) difficultyMode = "easy";

let themeMode = localStorage.getItem(THEME_KEY) || "classic";
if (!getThemeDef(themeMode)) themeMode = "classic";

let wordPool = [];
let secret = "";
let guessed = new Set();
let wrong = 0;
let playing = false;
let menuMode = "start";
let stats = loadStats();

function getThemeDef(id = themeMode) {
  const themes = typeof HANGMAN_THEMES !== "undefined" ? HANGMAN_THEMES : null;
  return themes?.[id] || themes?.classic || null;
}

function isClassicTheme() {
  return themeMode === "classic" || !getThemeDef(themeMode)?.words;
}

function cfg() {
  return DIFFICULTY[difficultyMode];
}

function maxWrong() {
  return cfg().maxWrong;
}

function statsKey() {
  return `${STATS_KEY}-${themeMode}-${difficultyMode}-${currentLang}`;
}

function norm(ch) {
  return String(ch).toLocaleLowerCase();
}

function getLetterCharset() {
  if (!isClassicTheme()) return "a-z";
  if (currentLang === "da") return "a-zæøå";
  if (currentLang === "is") return "a-záðéíóöúýþæ";
  return "a-z";
}

function getLetterPattern() {
  const set = getLetterCharset();
  if (isClassicTheme()) {
    const len = cfg().length;
    return new RegExp(`^[${set}]{${len}}$`);
  }
  const { minLen, maxLen } = cfg();
  return new RegExp(`^[${set}]{${minLen},${maxLen}}$`);
}

function getKeyboardLetters() {
  if (!isClassicTheme()) return KEYBOARD_EN;
  if (currentLang === "da") return KEYBOARD_DA;
  if (currentLang === "is") return KEYBOARD_IS;
  return KEYBOARD_EN;
}

function isValidGuessLetter(ch) {
  if (!isClassicTheme()) return /^[a-z]$/.test(ch);
  if (currentLang === "da") return /^[a-zæøå]$/.test(ch);
  if (currentLang === "is") return /^[a-záðéíóöúýþæ]$/.test(ch);
  return /^[a-z]$/.test(ch);
}

function getSourceLists() {
  if (!isClassicTheme()) {
    const theme = getThemeDef();
    return Array.isArray(theme?.words) ? theme.words : [];
  }
  const len = cfg().length;
  if (currentLang === "da") {
    if (len === 4) return typeof WORDS_DA_4 !== "undefined" ? WORDS_DA_4 : [];
    if (len === 6) return typeof WORDS_DA_6 !== "undefined" ? WORDS_DA_6 : [];
    return typeof WORDS_DA !== "undefined" ? WORDS_DA : [];
  }
  if (currentLang === "is") {
    if (len === 4) return typeof WORDS_IS_4 !== "undefined" ? WORDS_IS_4 : [];
    if (len === 6) return typeof WORDS_IS_6 !== "undefined" ? WORDS_IS_6 : [];
    return typeof WORDS_IS !== "undefined" ? WORDS_IS : [];
  }
  if (len === 4) return typeof WORDS_4 !== "undefined" ? WORDS_4 : [];
  if (len === 6) return typeof WORDS_6 !== "undefined" ? WORDS_6 : [];
  return typeof WORDS !== "undefined" ? WORDS : [];
}

function buildPool() {
  const pattern = getLetterPattern();
  const cleaned = [
    ...new Set(
      getSourceLists()
        .map((w) => norm(String(w).replace(/[^a-záðéíóöúýþæøå]/gi, "")))
        .filter((w) => pattern.test(w))
    )
  ];
  if (cleaned.length) return cleaned;

  if (!isClassicTheme()) {
    const all = (getThemeDef()?.words || []).map((w) => norm(w)).filter(Boolean);
    if (all.length) return all;
    return ["theme", "word", "guess", "play"];
  }

  const len = cfg().length;
  if (currentLang === "da") {
    if (len === 4) return ["hest", "bord", "lyse", "vind"];
    if (len === 6) return ["morgen", "venner", "aftale", "skolen"];
    return ["huske", "skole", "aften", "bogen"];
  }
  if (currentLang === "is") {
    if (len === 4) return ["hest", "hús", "sól", "bók"].filter((w) => pattern.test(norm(w)));
    if (len === 6) return ["hestur", "skóli", "morgun"].filter((w) => pattern.test(norm(w)));
    return ["haust", "vinur", "breyt"].filter((w) => w.length === 5);
  }
  if (len === 4) return ["game", "play", "word", "code"];
  if (len === 6) return ["planet", "bridge", "forest", "castle"];
  return ["apple", "house", "brave", "light"];
}

function loadStats() {
  try {
    const raw = JSON.parse(localStorage.getItem(statsKey()) || "{}");
    // Migrate old global stats onto medium/en once.
    if (
      !raw.wins &&
      difficultyMode === "medium" &&
      currentLang === "en"
    ) {
      const legacy = JSON.parse(localStorage.getItem(STATS_KEY) || "{}");
      return {
        wins: Number(legacy.wins) || 0,
        streak: Number(legacy.streak) || 0,
        bestStreak: Number(legacy.bestStreak) || 0
      };
    }
    return {
      wins: Number(raw.wins) || 0,
      streak: Number(raw.streak) || 0,
      bestStreak: Number(raw.bestStreak) || 0
    };
  } catch {
    return { wins: 0, streak: 0, bestStreak: 0 };
  }
}

function saveStats() {
  localStorage.setItem(statsKey(), JSON.stringify(stats));
}

function updateStatsUi() {
  winsEl.textContent = String(stats.wins);
  streakEl.textContent = String(stats.streak);
  bestStreakEl.textContent = String(stats.bestStreak);
  hudDiff.textContent = cfg().label;
  const theme = getThemeDef();
  if (hudTheme) hudTheme.textContent = theme?.label || "Classic";
  if (themeHintEl) themeHintEl.textContent = `Theme: ${theme?.label || "Classic"}`;
}

function updateLangButton() {
  langBtn.textContent = currentLang.toUpperCase();
  langBtn.disabled = !isClassicTheme();
  langBtn.title = isClassicTheme()
    ? "Switch language"
    : "Themes use English words — switch to Classic for Danish/Icelandic";
  langBtn.classList.toggle("is-disabled", !isClassicTheme());
}

function syncDifficultyButtons() {
  document.querySelectorAll(".diff-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.diff === difficultyMode);
  });
}

function syncThemeButtons() {
  document.querySelectorAll(".theme-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.theme === themeMode);
  });
}

function randomWord() {
  return wordPool[Math.floor(Math.random() * wordPool.length)];
}

function goToGames() {
  window.location.href = "../index.html#games";
}

function langLabel() {
  if (!isClassicTheme()) return "English";
  if (currentLang === "da") return "Danish";
  if (currentLang === "is") return "Icelandic";
  return "English";
}

function themeLabel() {
  return getThemeDef()?.label || "Classic";
}

function modeBlurb() {
  const theme = getThemeDef();
  if (isClassicTheme()) {
    const lenBlurb =
      difficultyMode === "easy"
        ? "4-letter words · 8 misses"
        : difficultyMode === "hard"
          ? "6-letter words · 4 misses"
          : "5-letter words · 6 misses";
    return `${langLabel()} · Classic · ${cfg().label}: ${lenBlurb}`;
  }
  return `${themeLabel()} · ${cfg().label}: ${cfg().blurb}${theme?.blurb ? ` · ${theme.blurb}` : ""}`;
}

function showMenu(mode, title, text) {
  menuMode = mode;
  playing = false;

  overlayTitle.textContent = title;
  overlayText.textContent = text;
  syncDifficultyButtons();
  syncThemeButtons();
  updateLangButton();

  if (mode === "pause") {
    resumeBtn.classList.remove("hidden");
    viewBoardBtn?.classList.add("hidden");
    startBtn.textContent = "New Word";
  } else if (mode === "result") {
    resumeBtn.classList.add("hidden");
    viewBoardBtn?.classList.remove("hidden");
    startBtn.textContent = "Play Again";
  } else {
    resumeBtn.classList.add("hidden");
    viewBoardBtn?.classList.add("hidden");
    startBtn.textContent = "Start";
  }

  overlay.classList.remove("hidden");
}


function viewBoard() {
  if (menuMode !== "result") return;
  overlay.classList.add("hidden");
  if (statusEl && !/menu/i.test(statusEl.textContent || "")) {
    const base = (statusEl.textContent || "").trim();
    statusEl.textContent = base ? `${base} · Tap Menu for Play Again.` : "Tap Menu to return to the result screen.";
  }
}

function openPauseMenu() {
  if (menuMode !== "playing" || !overlay.classList.contains("hidden")) return;
  showMenu(
    "pause",
    "Menu",
    `${modeBlurb()}. Streak ${stats.streak} · Wins ${stats.wins}. Resume, restart, or change theme.`
  );
}

function resumeGame() {
  if (menuMode !== "pause") return;
  overlay.classList.add("hidden");
  menuMode = "playing";
  playing = true;
}

function resetGallows() {
  document.querySelectorAll(".gallows .part").forEach((el) => {
    el.classList.remove("visible");
  });
  GALLOWS_ALWAYS.forEach((name) => {
    document.querySelector(`.${name}`)?.classList.add("visible");
  });
}

function updateGallows() {
  PARTS.forEach((name, i) => {
    document.querySelector(`.${name}`)?.classList.toggle("visible", i < Math.min(wrong, PARTS.length));
  });
}

function renderWord() {
  wordEl.innerHTML = "";
  for (const ch of secret) {
    const slot = document.createElement("span");
    slot.className = "letter-slot";
    slot.textContent =
      guessed.has(ch) || menuMode === "result" ? ch.toLocaleUpperCase() : "";
    wordEl.appendChild(slot);
  }
}

function renderKeyboard() {
  const letters = getKeyboardLetters();
  keyboardEl.classList.toggle("lang-da", currentLang === "da");
  keyboardEl.classList.toggle("lang-is", currentLang === "is");
  keyboardEl.innerHTML = "";

  for (const letter of letters) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "key";
    btn.textContent = letter.toLocaleUpperCase();
    btn.dataset.letter = letter;

    if (guessed.has(letter)) {
      btn.disabled = true;
      btn.classList.add(secret.includes(letter) ? "correct" : "wrong");
    } else if (!playing) {
      btn.disabled = true;
    }

    btn.addEventListener("click", () => guessLetter(letter));
    keyboardEl.appendChild(btn);
  }
}

function setStatus(text, kind = "") {
  statusEl.textContent = text;
  statusEl.classList.remove("win", "lose");
  if (kind) statusEl.classList.add(kind);
}

function startGame() {
  if (window.HubStreak) HubStreak.recordPlay();
  if (window.HubPlays) HubPlays.record("hangman");
  wordPool = buildPool();
  secret = randomWord();
  guessed = new Set();
  wrong = 0;
  playing = true;
  menuMode = "playing";
  overlay.classList.add("hidden");
  resetGallows();
  updateGallows();
  missesEl.textContent = String(maxWrong() - wrong);
  setStatus("Guess a letter");
  updateStatsUi();
  renderWord();
  renderKeyboard();
}

function endGame(won) {
  playing = false;
  menuMode = "result";

  if (won) {
    stats.wins += 1;
    stats.streak += 1;
    stats.bestStreak = Math.max(stats.bestStreak, stats.streak);
    saveStats();
    updateStatsUi();
    if (stats.bestStreak > 0) {
      window.HubLeaderboard?.submit("hangman", stats.bestStreak);
    }
    if (window.HubAchievements) {
      HubAchievements.unlock("hangman_win");
      if (wrong === 0) HubAchievements.unlock("hangman_no_miss");
      try {
        const n = Number(localStorage.getItem("hangman-wins-count") || 0) + 1;
        localStorage.setItem("hangman-wins-count", String(n));
        if (n >= 5) HubAchievements.unlock("hangman_win_5");
      } catch {}
    }
    window.HubSound?.play("win");
    setStatus("You got it!", "win");
    showMenu(
      "result",
      "You win!",
      `${themeLabel()} · ${cfg().label}: the word was “${secret.toLocaleUpperCase()}”. Streak: ${stats.streak}.`
    );
  } else {
    stats.streak = 0;
    saveStats();
    updateStatsUi();
    setStatus(`Out of misses — it was “${secret.toLocaleUpperCase()}”`, "lose");
    renderWord();
    window.HubSound?.play("lose");
    showMenu(
      "result",
      "Game Over",
      `${themeLabel()} · ${cfg().label}: the word was “${secret.toLocaleUpperCase()}”. Try another round.`
    );
  }
}

function guessLetter(letter) {
  if (!playing || menuMode !== "playing") return;
  const ch = norm(letter);
  if (!isValidGuessLetter(ch) || guessed.has(ch)) return;

  guessed.add(ch);
  const btn = keyboardEl.querySelector(`[data-letter="${ch}"]`);

  if (secret.includes(ch)) {
    if (btn) {
      btn.disabled = true;
      btn.classList.add("correct");
    }
    renderWord();
    setStatus("Nice!");
    window.HubSound?.play("match");
    if ([...secret].every((c) => guessed.has(c))) endGame(true);
  } else {
    wrong += 1;
    if (btn) {
      btn.disabled = true;
      btn.classList.add("wrong");
    }
    updateGallows();
    missesEl.textContent = String(Math.max(0, maxWrong() - wrong));
    setStatus("Not in the word");
    window.HubSound?.play("error");
    if (wrong >= maxWrong()) endGame(false);
  }
}

function setDifficulty(mode) {
  if (!DIFFICULTY[mode]) return;
  const changed = mode !== difficultyMode;
  difficultyMode = mode;
  localStorage.setItem(DIFF_KEY, mode);
  stats = loadStats();
  syncDifficultyButtons();
  updateStatsUi();

  if (changed && (menuMode === "pause" || menuMode === "playing" || menuMode === "result")) {
    startGame();
    return;
  }

  if (menuMode === "start" || menuMode === "pause" || menuMode === "result") {
    overlayText.textContent = `${modeBlurb()}. Pick a theme, then guess one letter at a time.`;
  }
}

function setTheme(mode) {
  if (!getThemeDef(mode)) return;
  const changed = mode !== themeMode;
  themeMode = mode;
  localStorage.setItem(THEME_KEY, mode);
  stats = loadStats();
  syncThemeButtons();
  updateStatsUi();
  updateLangButton();

  if (changed && (menuMode === "pause" || menuMode === "playing" || menuMode === "result")) {
    startGame();
    return;
  }

  if (menuMode === "start" || menuMode === "pause" || menuMode === "result") {
    overlayText.textContent = `${modeBlurb()}. Pick a theme, then guess one letter at a time.`;
  }
}

function switchLanguage() {
  if (!isClassicTheme()) return;
  const idx = LANGUAGES.indexOf(currentLang);
  currentLang = LANGUAGES[(idx + 1) % LANGUAGES.length];
  localStorage.setItem(LANG_KEY, currentLang);
  updateLangButton();
  stats = loadStats();
  updateStatsUi();
  wordPool = buildPool();

  if (menuMode === "playing" || menuMode === "pause" || menuMode === "result") {
    startGame();
    return;
  }

  renderKeyboard();
  Array.from(keyboardEl.children).forEach((btn) => {
    btn.disabled = true;
  });
  showMenu(
    "start",
    "Hangman",
    `${modeBlurb()}. Guess one letter at a time.`
  );
}

difficultyPicker.addEventListener("click", (e) => {
  const btn = e.target.closest(".diff-btn");
  if (!btn) return;
  setDifficulty(btn.dataset.diff);
});

themePicker?.addEventListener("click", (e) => {
  const btn = e.target.closest(".theme-btn");
  if (!btn) return;
  setTheme(btn.dataset.theme);
});

menuBtn.addEventListener("click", () => {
  if (menuMode === "playing") openPauseMenu();
  else if (menuMode === "pause") resumeGame();
  else overlay.classList.remove("hidden");
});

resumeBtn.addEventListener("click", () => resumeGame());
viewBoardBtn?.addEventListener("click", () => viewBoard());
startBtn.addEventListener("click", () => startGame());
gamesBtn.addEventListener("click", () => goToGames());
langBtn.addEventListener("click", () => switchLanguage());

window.addEventListener("keydown", (e) => {
  if (e.code === "Escape") {
    e.preventDefault();
    if (menuMode === "playing") openPauseMenu();
    else if (menuMode === "pause") resumeGame();
    return;
  }

  if (!playing || menuMode !== "playing") return;
  if (e.key.length === 1 && isValidGuessLetter(norm(e.key))) {
    guessLetter(e.key);
  }
});

wordPool = buildPool();
updateLangButton();
syncDifficultyButtons();
syncThemeButtons();
updateStatsUi();
resetGallows();
GALLOWS_ALWAYS.forEach((name) => {
  document.querySelector(`.${name}`)?.classList.add("visible");
});
renderKeyboard();
Array.from(keyboardEl.children).forEach((btn) => {
  btn.disabled = true;
});
showMenu(
  "start",
  "Hangman",
  `${modeBlurb()}. Pick a theme, then guess one letter at a time.`
);
