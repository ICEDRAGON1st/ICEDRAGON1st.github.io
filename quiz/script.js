const DIFF_KEY = "quizmaster-difficulty";
const LETTERS = ["A", "B", "C", "D"];

const DIFFICULTY = {
  easy: {
    label: "Easy",
    count: 8,
    timer: 0,
    blurb: "Shorter round with simpler questions. No timer."
  },
  medium: {
    label: "Medium",
    count: 10,
    timer: 0,
    blurb: "Standard round with mixed general knowledge."
  },
  hard: {
    label: "Hard",
    count: 12,
    timer: 12,
    blurb: "Tougher questions, longer round, 12s per question."
  }
};

const EASY_RE =
  /\b(baby cat|H2O|how many (hours|days|sides|legs|wheels|colors|months|seconds|minutes|years|zeros|players|bones|teeth|continents|planets|strings)|red planet|boiling point of water|freezing point|sun rise|breakfast|man's best friend|king of the jungle|yellow and curved|opposite of (east|hot)|plural of mouse|write on a blackboard|meal is usually eaten|traffic lights|snow|coffee shop|chemical symbol for (gold|oxygen|iron|carbon|helium|silver|sodium)|largest ocean|gas do (plants|humans)|square root of 64|15% of 200|9 × 8|7 × 7|5 squared|8 squared|2 \+|0 multiplied|primary colors|shape has 4 equal|opposite of east|water in solid form|currency of the United Kingdom|capital of (France|Japan|Italy|Spain|Germany|Canada|Australia|China|India|Brazil|Mexico|Russia|Egypt|Greece|Ireland|Portugal|Sweden|Norway|Denmark|Finland|Poland|Turkey|Thailand|South Korea))\b/i;

const HARD_RE =
  /\b(factorial|cochlea|tetrahedron|atomic number|Olympus Mons|vestibular|seismograph|anemometer|deoxyribonucleic|liquid metallic|Great Dark Spot|Naypyidaw|Sri Jayawardenepura|Nuku'alofa|Palikir|Ngerulmud|Yaren|South Tarawa|Funafuti|Basseterre|Kingstown|Castries|Roseau|Port Vila|Honiara|Nouakchott|Ouagadougou|N'Djamena|Dodoma|Astana|Ulaanbaatar|Thimphu|Bandar Seri|Paramaribo|Belmopan|Tegucigalpa|Sucre|La Paz|Windhoek|Lilongwe|Maputo|Antananarivo|Port Moresby|Suva|Apia|Majuro|Moroni|Malé|Victoria|Praia|Bissau|Libreville|Bangui|Brazzaville|Niamey|Nouakchott|Asmara|Djibouti|Juba|Maseru|Mbabane|Gaborone|Lusaka|Harare|Kampala|Kigali|Bujumbura|Lomé|Cotonou|Porto-Novo|Conakry|Freetown|Monrovia|Banjul|Accra|Yaoundé|Malabo|São Tomé)\b/i;

function estimateDifficulty(q) {
  if (HARD_RE.test(q)) return "hard";
  if (EASY_RE.test(q)) return "easy";
  if (isCapitalQuestion(q)) return "medium";
  if (/What is \d|divided by|squared|×|to the power/i.test(q)) return "easy";
  if (/chemical symbol|vitamin|element|photosynthesis|atmosphere|planet|ocean|continent/i.test(q)) {
    return "medium";
  }
  return "medium";
}

function isCapitalQuestion(q) {
  return /capital of/i.test(q);
}

const KEEP_CAPITAL_COUNTRIES = new Set([
  "Japan", "France", "Australia", "Italy", "Canada", "Spain", "Germany", "Brazil",
  "Egypt", "India", "Russia", "South Korea", "Mexico", "Sweden", "Turkey", "Norway",
  "Poland", "Greece", "Portugal", "Thailand", "Denmark", "Ireland", "Finland"
]);

function shouldIncludeQuestion(q) {
  if (!isCapitalQuestion(q)) return true;
  if (/Which country is Prague/i.test(q)) return true;
  const match = q.match(/capital of (?:the )?([^?]+)/i);
  if (!match) return false;
  return KEEP_CAPITAL_COUNTRIES.has(match[1].trim());
}

const CAPITAL_LIMIT = {
  easy: 1,
  medium: 1,
  hard: 2
};

const BANK = (window.QUIZ_RAW || [])
  .filter(([q]) => shouldIncludeQuestion(q))
  .map(([q, a, b, c, d, answer], id) => ({
  id,
  q,
  choices: [a, b, c, d],
  answer,
  difficulty: estimateDifficulty(q)
}));

const overlay = document.getElementById("overlay");
const overlayEyebrow = document.getElementById("overlay-eyebrow");
const overlayTitle = document.getElementById("overlay-title");
const overlayText = document.getElementById("overlay-text");
const overlayHigh = document.getElementById("overlay-high");
const overlayTotal = document.getElementById("overlay-total");
const hudHigh = document.getElementById("hud-high");
const hudTotal = document.getElementById("hud-total");
const hudDiff = document.getElementById("hud-diff");
const resumeBtn = document.getElementById("resume-btn");
const startBtn = document.getElementById("start-btn");
const gamesBtn = document.getElementById("games-btn");
const menuBtn = document.getElementById("menu-btn");
const difficultyPicker = document.getElementById("difficulty-picker");
const progressLabel = document.getElementById("progress-label");
const progressFill = document.getElementById("progress-fill");
const liveScore = document.getElementById("live-score");
const timerLabel = document.getElementById("timer-label");
const questionText = document.getElementById("question-text");
const answersEl = document.getElementById("answers");

function loadSavedDifficulty() {
  const saved = localStorage.getItem(DIFF_KEY);
  return DIFFICULTY[saved] ? saved : "easy";
}

let difficultyMode = loadSavedDifficulty();
let deck = [];
let index = 0;
let score = 0;
let locked = false;
let menuMode = "start";
let playing = false;
let answerTimers = [];
let questionTimerId = 0;
let timeLeft = 0;
let highScore = 0;

function cfg() {
  return DIFFICULTY[difficultyMode];
}

function highScoreKey() {
  return `quizmaster-high-score-${difficultyMode}`;
}

function usedKey() {
  return `quizmaster-used-ids-${difficultyMode}`;
}

function loadHighScore() {
  try {
    const saved = Number(localStorage.getItem(highScoreKey()));
    if (Number.isFinite(saved) && saved > 0) return Math.floor(saved);
    // Migrate old single high score onto medium once.
    if (difficultyMode === "medium") {
      const legacy = Number(localStorage.getItem("quizmaster-high-score"));
      if (Number.isFinite(legacy) && legacy > 0) return Math.floor(legacy);
    }
    return 0;
  } catch {
    return 0;
  }
}

function saveHighScore() {
  localStorage.setItem(highScoreKey(), String(highScore));
}

function loadUsedIds() {
  try {
    const raw = JSON.parse(localStorage.getItem(usedKey()) || "[]");
    return Array.isArray(raw) ? raw.map(Number).filter(Number.isFinite) : [];
  } catch {
    return [];
  }
}

function saveUsedIds(ids) {
  localStorage.setItem(usedKey(), JSON.stringify([...ids]));
}

function shuffle(list) {
  const arr = [...list];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function poolForMode() {
  const primary = BANK.filter((q) => q.difficulty === difficultyMode);
  if (primary.length >= cfg().count) return primary;

  if (difficultyMode === "easy") {
    return [...primary, ...BANK.filter((q) => q.difficulty === "medium")];
  }
  if (difficultyMode === "hard") {
    return [...primary, ...BANK.filter((q) => q.difficulty === "medium")];
  }
  return BANK;
}

function pickDeck() {
  const need = cfg().count;
  const capLimit = CAPITAL_LIMIT[difficultyMode] ?? 1;
  const used = new Set(loadUsedIds());
  let pool = poolForMode().filter((q) => !used.has(q.id));

  if (pool.length < need) {
    used.clear();
    pool = poolForMode();
  }

  const capitals = shuffle(pool.filter((q) => isCapitalQuestion(q.q)));
  const others = shuffle(pool.filter((q) => !isCapitalQuestion(q.q)));
  const picked = [];

  for (const q of others) {
    if (picked.length >= need) break;
    picked.push(q);
  }

  for (const q of capitals) {
    if (picked.length >= need) break;
    if (picked.filter((item) => isCapitalQuestion(item.q)).length >= capLimit) break;
    picked.push(q);
  }

  if (picked.length < need) {
    const remaining = shuffle(pool.filter((q) => !picked.includes(q)));
    for (const q of remaining) {
      if (picked.length >= need) break;
      if (isCapitalQuestion(q.q) && picked.filter((item) => isCapitalQuestion(item.q)).length >= capLimit) {
        continue;
      }
      picked.push(q);
    }
  }

  const finalDeck = shuffle(picked).slice(0, need);
  for (const q of finalDeck) used.add(q.id);
  saveUsedIds(used);
  return finalDeck;
}

function clearAnswerTimers() {
  for (const id of answerTimers) window.clearTimeout(id);
  answerTimers = [];
  window.clearInterval(questionTimerId);
  questionTimerId = 0;
}

function goToGames() {
  window.location.href = "../index.html#games";
}

function syncDifficultyButtons() {
  document.querySelectorAll(".diff-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.diff === difficultyMode);
  });
}

function updateHighScoreUi() {
  const total = cfg().count;
  hudHigh.textContent = String(highScore);
  overlayHigh.textContent = String(highScore);
  hudTotal.textContent = String(total);
  overlayTotal.textContent = String(total);
  hudDiff.textContent = cfg().label;
}

function updateLiveScore() {
  liveScore.textContent = `Score: ${score}`;
}

function setDifficulty(mode) {
  if (!DIFFICULTY[mode]) return;
  const changed = mode !== difficultyMode;
  difficultyMode = mode;
  localStorage.setItem(DIFF_KEY, mode);
  highScore = loadHighScore();
  syncDifficultyButtons();
  updateHighScoreUi();

  if (changed && menuMode === "pause") {
    startQuiz();
    return;
  }

  if (menuMode === "start" || menuMode === "result" || menuMode === "pause") {
    overlayText.textContent = `${cfg().label}: ${cfg().blurb} Best ${highScore}/${cfg().count}.`;
  }
}

function showMenu(mode, title, text, eyebrow = "General knowledge") {
  menuMode = mode;
  playing = false;
  clearAnswerTimers();
  timerLabel.classList.add("hidden");

  overlayEyebrow.textContent = eyebrow;
  overlayTitle.textContent = title;
  overlayText.textContent = text;
  updateHighScoreUi();
  syncDifficultyButtons();

  if (mode === "pause") {
    resumeBtn.classList.remove("hidden");
    startBtn.textContent = "Restart";
  } else if (mode === "result") {
    resumeBtn.classList.add("hidden");
    startBtn.textContent = "Play Again";
  } else {
    resumeBtn.classList.add("hidden");
    startBtn.textContent = "Start Quiz";
  }

  overlay.classList.remove("hidden");
}

function openPauseMenu() {
  if (menuMode !== "playing" || !overlay.classList.contains("hidden")) return;
  const total = cfg().count;
  showMenu(
    "pause",
    "Menu",
    `${cfg().label} · Question ${Math.min(index + 1, total)}/${total} · Score ${score}. Resume, restart, or change difficulty.`,
    "Paused"
  );
}

function resumeQuiz() {
  if (menuMode !== "pause") return;
  overlay.classList.add("hidden");
  menuMode = "playing";
  playing = true;
  if (cfg().timer > 0 && !locked) startQuestionTimer();
}

function startQuestionTimer() {
  window.clearInterval(questionTimerId);
  timeLeft = cfg().timer;
  timerLabel.classList.remove("hidden");
  timerLabel.classList.remove("urgent");
  timerLabel.textContent = `${timeLeft}s`;

  questionTimerId = window.setInterval(() => {
    if (!playing || menuMode !== "playing" || locked) return;
    timeLeft -= 1;
    timerLabel.textContent = `${Math.max(0, timeLeft)}s`;
    timerLabel.classList.toggle("urgent", timeLeft <= 3);
    if (timeLeft <= 0) {
      window.clearInterval(questionTimerId);
      questionTimerId = 0;
      timeOutQuestion();
    }
  }, 1000);
}

function timeOutQuestion() {
  if (!playing || locked || menuMode !== "playing") return;
  locked = true;
  const item = deck[index];
  const buttons = [...answersEl.querySelectorAll(".answer-btn")];
  buttons.forEach((b) => {
    b.disabled = true;
  });
  buttons[item.answer]?.classList.add("correct");

  const t = window.setTimeout(() => {
    if (menuMode !== "playing") return;
    index += 1;
    if (index >= deck.length) finishQuiz();
    else renderQuestion();
  }, 750);
  answerTimers.push(t);
}

function startQuiz() {
  if (window.HubStreak) HubStreak.recordPlay();
  if (window.HubPlays) HubPlays.record("quiz");
  clearAnswerTimers();
  deck = pickDeck();
  index = 0;
  score = 0;
  locked = false;
  playing = true;
  menuMode = "playing";
  updateLiveScore();
  updateHighScoreUi();
  overlay.classList.add("hidden");
  renderQuestion();
}

function renderQuestion() {
  const item = deck[index];
  const total = cfg().count;
  const n = index + 1;
  progressLabel.textContent = `Question ${n}/${total}`;
  progressFill.style.width = `${(n / total) * 100}%`;
  questionText.textContent = item.q;
  answersEl.innerHTML = "";
  locked = false;

  item.choices.forEach((choice, i) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "answer-btn";
    btn.innerHTML = `
      <span class="badge">${LETTERS[i]}</span>
      <span class="answer-label">${choice}</span>
    `;
    btn.addEventListener("click", () => pickAnswer(i, btn));
    answersEl.appendChild(btn);
  });

  if (cfg().timer > 0) startQuestionTimer();
  else {
    timerLabel.classList.add("hidden");
    window.clearInterval(questionTimerId);
  }
}

function pickAnswer(choiceIndex, btn) {
  if (!playing || locked || menuMode !== "playing") return;
  locked = true;
  window.clearInterval(questionTimerId);
  questionTimerId = 0;

  const item = deck[index];
  const buttons = [...answersEl.querySelectorAll(".answer-btn")];
  buttons.forEach((b) => {
    b.disabled = true;
  });

  btn.classList.add("selected");

  const correctBtn = buttons[item.answer];
  const t1 = window.setTimeout(() => {
    if (menuMode !== "playing") return;
    if (choiceIndex === item.answer) {
      score += 1;
      updateLiveScore();
      btn.classList.add("correct");
      window.HubSound?.play("match");
    } else {
      btn.classList.add("wrong");
      correctBtn.classList.add("correct");
      window.HubSound?.play("error");
    }

    const t2 = window.setTimeout(() => {
      if (menuMode !== "playing") return;
      index += 1;
      if (index >= deck.length) finishQuiz();
      else renderQuestion();
    }, 750);
    answerTimers.push(t2);
  }, 180);
  answerTimers.push(t1);
}

function finishQuiz() {
  playing = false;
  clearAnswerTimers();
  timerLabel.classList.add("hidden");

  const total = cfg().count;
  const isNew = score > highScore;
  if (isNew) {
    highScore = score;
    saveHighScore();
    window.HubConfetti?.burst();
  }
  updateHighScoreUi();

  let title = "Keep practicing!";
  if (window.HubAchievements) {
    if (score === total) HubAchievements.unlock("quiz_perfect");
    const quizWins = (Number(localStorage.getItem("quiz-wins-count")||0));
    if (score === total) { const w2 = quizWins+1; localStorage.setItem("quiz-wins-count",w2); if(w2>=3) HubAchievements.unlock("quiz_win_3"); }
  }
  if (score === total) title = "Perfect!";
  else if (score >= Math.ceil(total * 0.7)) title = "Great run!";
  else if (score >= Math.ceil(total * 0.4)) title = "Nice try!";

  window.HubSound?.play(score === total ? "win" : score === 0 ? "lose" : "hint");

  showMenu(
    "result",
    title,
    `${cfg().label}: you scored ${score}/${total}.`,
    isNew ? "New best score" : "Quiz complete"
  );
}

difficultyPicker.addEventListener("click", (e) => {
  const btn = e.target.closest(".diff-btn");
  if (!btn) return;
  setDifficulty(btn.dataset.diff);
});

menuBtn.addEventListener("click", () => {
  if (menuMode === "playing") openPauseMenu();
  else if (menuMode === "pause") resumeQuiz();
  else overlay.classList.remove("hidden");
});

resumeBtn.addEventListener("click", () => resumeQuiz());
startBtn.addEventListener("click", () => startQuiz());
gamesBtn.addEventListener("click", () => goToGames());

window.addEventListener("keydown", (e) => {
  if (e.code !== "Escape") return;
  e.preventDefault();
  if (menuMode === "playing") openPauseMenu();
  else if (menuMode === "pause") resumeQuiz();
});

highScore = loadHighScore();
syncDifficultyButtons();
updateHighScoreUi();
updateLiveScore();
showMenu(
  "start",
  "Quizmaster",
  `${cfg().label}: ${cfg().blurb}`
);
