const DIFF_KEY = "math-sprint-difficulty";

const DIFFICULTY = {
  easy: {
    label: "Easy",
    count: 10,
    timer: 0,
    blurb: "Addition and subtraction up to 20. No timer."
  },
  medium: {
    label: "Medium",
    count: 12,
    timer: 15,
    blurb: "Add, subtract, and multiply. 15 seconds per question."
  },
  hard: {
    label: "Hard",
    count: 15,
    timer: 10,
    blurb: "All four operations with tougher numbers. 10 seconds per question."
  }
};

const overlay = document.getElementById("overlay");
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
let questionTimerId = 0;
let timeLeft = 0;
let highScore = 0;

function cfg() {
  return DIFFICULTY[difficultyMode];
}

function highScoreKey() {
  return `math-sprint-high-score-${difficultyMode}`;
}

function loadHighScore() {
  try {
    const saved = Number(localStorage.getItem(highScoreKey()));
    return Number.isFinite(saved) && saved > 0 ? Math.floor(saved) : 0;
  } catch {
    return 0;
  }
}

function saveHighScore() {
  localStorage.setItem(highScoreKey(), String(highScore));
}

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickOne(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function makeWrongAnswers(correct, count = 3) {
  const wrong = new Set();
  const spread = Math.max(3, Math.abs(correct) * 0.15 + 2);

  while (wrong.size < count) {
    let offset = randInt(1, Math.ceil(spread));
    if (Math.random() < 0.5) offset = -offset;
    const candidate = correct + offset;
    if (candidate !== correct) wrong.add(candidate);
  }

  return [...wrong];
}

function buildEasyProblem() {
  const op = pickOne(["+", "-"]);
  if (op === "+") {
    const a = randInt(1, 20);
    const b = randInt(1, 20);
    return { text: `${a} + ${b} = ?`, answer: a + b };
  }

  const a = randInt(5, 20);
  const b = randInt(1, a);
  return { text: `${a} − ${b} = ?`, answer: a - b };
}

function buildMediumProblem() {
  const op = pickOne(["+", "-", "×"]);
  if (op === "+") {
    const a = randInt(10, 99);
    const b = randInt(10, 99);
    return { text: `${a} + ${b} = ?`, answer: a + b };
  }
  if (op === "-") {
    const a = randInt(20, 99);
    const b = randInt(10, a);
    return { text: `${a} − ${b} = ?`, answer: a - b };
  }

  const a = randInt(2, 12);
  const b = randInt(2, 12);
  return { text: `${a} × ${b} = ?`, answer: a * b };
}

function buildHardProblem() {
  const op = pickOne(["+", "-", "×", "÷"]);
  if (op === "+") {
    const a = randInt(50, 199);
    const b = randInt(50, 199);
    return { text: `${a} + ${b} = ?`, answer: a + b };
  }
  if (op === "-") {
    const a = randInt(80, 250);
    const b = randInt(20, a);
    return { text: `${a} − ${b} = ?`, answer: a - b };
  }
  if (op === "×") {
    const a = randInt(6, 15);
    const b = randInt(6, 15);
    return { text: `${a} × ${b} = ?`, answer: a * b };
  }

  const divisor = randInt(3, 12);
  const quotient = randInt(3, 12);
  const dividend = divisor * quotient;
  return { text: `${dividend} ÷ ${divisor} = ?`, answer: quotient };
}

function buildProblem() {
  const builders = {
    easy: buildEasyProblem,
    medium: buildMediumProblem,
    hard: buildHardProblem
  };
  const base = builders[difficultyMode]();
  const choices = [base.answer, ...makeWrongAnswers(base.answer)];
  for (let i = choices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [choices[i], choices[j]] = [choices[j], choices[i]];
  }
  return { ...base, choices };
}

function buildDeck() {
  return Array.from({ length: cfg().count }, () => buildProblem());
}

function updateHud() {
  const config = cfg();
  hudDiff.textContent = config.label;
  hudHigh.textContent = String(highScore);
  hudTotal.textContent = String(config.count);
  overlayHigh.textContent = String(highScore);
  overlayTotal.textContent = String(config.count);
}

function setDifficulty(mode) {
  difficultyMode = mode;
  localStorage.setItem(DIFF_KEY, mode);
  highScore = loadHighScore();
  difficultyPicker.querySelectorAll(".diff-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.diff === mode);
  });
  updateHud();
}

function clearQuestionTimer() {
  if (questionTimerId) {
    clearInterval(questionTimerId);
    questionTimerId = 0;
  }
}

function updateProgress() {
  const total = cfg().count;
  progressLabel.textContent = `Question ${Math.min(index + 1, total)}/${total}`;
  progressFill.style.width = `${(index / total) * 100}%`;
  liveScore.textContent = `Score: ${score}`;
}

function showQuestion() {
  locked = false;
  clearQuestionTimer();

  if (index >= deck.length) {
    finishRound();
    return;
  }

  const problem = deck[index];
  questionText.textContent = problem.text;
  answersEl.innerHTML = "";

  problem.choices.forEach((value) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "answer-btn";
    btn.textContent = String(value);
    btn.addEventListener("click", () => chooseAnswer(value, problem.answer, btn));
    answersEl.appendChild(btn);
  });

  updateProgress();

  const timerSeconds = cfg().timer;
  if (timerSeconds > 0 && playing) {
    timeLeft = timerSeconds;
    timerLabel.classList.remove("hidden", "urgent");
    timerLabel.textContent = `${timeLeft}s`;
    questionTimerId = setInterval(() => {
      timeLeft -= 1;
      timerLabel.textContent = `${timeLeft}s`;
      if (timeLeft <= 3) timerLabel.classList.add("urgent");
      if (timeLeft <= 0) {
        clearQuestionTimer();
        chooseAnswer(null, problem.answer, null);
      }
    }, 1000);
  } else {
    timerLabel.classList.add("hidden");
    timerLabel.classList.remove("urgent");
  }
}

function revealAnswers(correctAnswer, pickedBtn) {
  answersEl.querySelectorAll(".answer-btn").forEach((btn) => {
    btn.disabled = true;
    const value = Number(btn.textContent);
    if (value === correctAnswer) btn.classList.add("correct");
    else if (btn === pickedBtn) btn.classList.add("wrong");
  });
}

function chooseAnswer(picked, correctAnswer, pickedBtn) {
  if (locked || !playing) return;
  locked = true;
  clearQuestionTimer();
  timerLabel.classList.add("hidden");
  timerLabel.classList.remove("urgent");

  const correct = picked === correctAnswer;
  if (correct) score += 1;

  revealAnswers(correctAnswer, pickedBtn);
  liveScore.textContent = `Score: ${score}`;

  window.setTimeout(() => {
    index += 1;
    showQuestion();
  }, correct ? 450 : 850);
}

function finishRound() {
  playing = false;
  clearQuestionTimer();
  progressFill.style.width = "100%";

  const total = cfg().count;
  const isNew = score > highScore;
  if (isNew) {
    highScore = score;
    saveHighScore();
  }
  updateHud();

  const pct = Math.round((score / total) * 100);
  questionText.textContent = `Round complete!`;
  answersEl.innerHTML = "";
  timerLabel.classList.add("hidden");

  showMenu(
    "done",
    isNew ? "New Best!" : "Round Over",
    `You scored ${score}/${total} (${pct}%). ${isNew ? "Great work — that's a new personal best!" : `Best on ${cfg().label}: ${highScore}/${total}.`}`
  );
}

function showMenu(mode, title, text) {
  menuMode = mode;
  if (mode !== "playing") playing = false;

  overlayTitle.textContent = title;
  overlayText.textContent = text || cfg().blurb;

  if (mode === "pause") {
    resumeBtn.classList.remove("hidden");
    startBtn.textContent = "Restart";
  } else {
    resumeBtn.classList.add("hidden");
    startBtn.textContent = mode === "done" ? "Play Again" : "Start";
  }

  overlay.classList.remove("hidden");
}

function openPauseMenu() {
  if (!playing) return;
  clearQuestionTimer();
  showMenu("pause", "Paused", `${cfg().label} · Score ${score}/${cfg().count}. Resume or restart.`);
}

function startRound() {
  if (window.HubStreak) HubStreak.recordPlay();
  deck = buildDeck();
  index = 0;
  score = 0;
  locked = false;
  playing = true;
  menuMode = "playing";
  overlay.classList.add("hidden");
  updateProgress();
  showQuestion();
}

function resumeRound() {
  if (menuMode !== "pause") return;
  playing = true;
  menuMode = "playing";
  overlay.classList.add("hidden");
  locked = false;
  showQuestion();
}

function goToGames() {
  window.location.href = "../index.html#games";
}

difficultyPicker.addEventListener("click", (e) => {
  const btn = e.target.closest(".diff-btn");
  if (!btn || (playing && menuMode === "playing")) return;
  setDifficulty(btn.dataset.diff);
});

menuBtn.addEventListener("click", () => {
  if (playing) openPauseMenu();
  else if (menuMode === "pause") resumeRound();
  else overlay.classList.remove("hidden");
});

startBtn.addEventListener("click", () => startRound());
resumeBtn.addEventListener("click", () => resumeRound());
gamesBtn.addEventListener("click", () => goToGames());

window.addEventListener("keydown", (e) => {
  if (e.code === "Escape") {
    e.preventDefault();
    if (menuMode === "pause" && !overlay.classList.contains("hidden")) resumeRound();
    else if (playing) openPauseMenu();
    else overlay.classList.remove("hidden");
  }
});

setDifficulty(loadSavedDifficulty());
showMenu("start", "Math Sprint", cfg().blurb);
