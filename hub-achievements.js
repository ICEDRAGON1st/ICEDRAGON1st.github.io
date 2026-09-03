/**
 * hub-achievements.js
 * Global achievements system. Include before each game's script.js.
 *
 * API (window.HubAchievements):
 *   .unlock(id)          — unlock an achievement by id, returns true if newly unlocked
 *   .isUnlocked(id)      — check if unlocked
 *   .getAll()            — returns array of all achievement objects with .unlocked flag
 *   .getPending()        — returns array of ids unlocked since last call (clears queue)
 */
(function () {
  const STORAGE_KEY = "hub-achievements-v1";
  const PENDING_KEY = "hub-achievements-pending";

  /* ── Achievement definitions ── */
  const DEFINITIONS = [
    // Wordle
    { id: "wordle_first_win",    emoji: "🟩", name: "First Blood",     desc: "Win your first Wordle" },
    { id: "wordle_guess_2",      emoji: "⚡", name: "Sharp Mind",      desc: "Win a Wordle in 2 guesses or fewer" },
    { id: "wordle_guess_1",      emoji: "🎯", name: "Lucky Shot",      desc: "Win a Wordle in 1 guess" },
    { id: "wordle_win_5",        emoji: "📚", name: "Word Nerd",        desc: "Win 5 Wordles" },
    { id: "wordle_daily",        emoji: "📅", name: "Daily Solver",     desc: "Solve today's Daily Wordle" },
    // Streaks
    { id: "streak_3",            emoji: "🔥", name: "On Fire",         desc: "Reach a 3-day streak" },
    { id: "streak_7",            emoji: "🏅", name: "Dedicated",       desc: "Reach a 7-day streak" },
    { id: "streak_30",           emoji: "💎", name: "Unstoppable",     desc: "Reach a 30-day streak" },
    // Snake
    { id: "snake_score_10",      emoji: "🐍", name: "Snake Starter",   desc: "Score 10 in Snake" },
    { id: "snake_score_50",      emoji: "🐍", name: "Snake Charmer",   desc: "Score 50 in Snake" },
    // Memory Match
    { id: "memory_win_easy",     emoji: "🧠", name: "Good Memory",     desc: "Complete Memory Match on Easy" },
    { id: "memory_win_hard",     emoji: "🧩", name: "Memory Master",   desc: "Complete Memory Match on Hard" },
    // Quiz
    { id: "quiz_perfect",        emoji: "🎓", name: "Perfect Score",   desc: "Get 100% in a Quiz" },
    { id: "quiz_win_3",          emoji: "📝", name: "Quiz Whiz",       desc: "Win 3 Quizzes" },
    // 2048
    { id: "2048_tile_512",       emoji: "🔢", name: "Getting There",   desc: "Reach the 512 tile in 2048" },
    { id: "2048_tile_2048",      emoji: "✨", name: "2048!",           desc: "Reach the 2048 tile" },
    // Connect Four
    { id: "connect4_win",        emoji: "🔴", name: "Connected",       desc: "Win a game of Connect Four" },
    // Hangman
    { id: "hangman_win",         emoji: "🪢", name: "Saved",           desc: "Win a game of Hangman" },
    { id: "hangman_no_miss",     emoji: "🏆", name: "No Mistakes",     desc: "Win Hangman without any wrong guesses" },
    // All-rounder
    { id: "all_rounder",         emoji: "🌟", name: "All-Rounder",     desc: "Play every game at least once" },
    // Flappy Bird
    { id: "flappy_score_5",      emoji: "🐦", name: "Wing It",         desc: "Score 5 in Flappy Bird" },
    // Sudoku
    { id: "sudoku_win",          emoji: "🔷", name: "Number Solver",   desc: "Complete a Sudoku puzzle" },
    // Math
    { id: "math_perfect",        emoji: "➕", name: "Math Genius",     desc: "Get a perfect score in Math Quiz" },
  ];

  /* ── Storage ── */
  function load() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; }
    catch { return {}; }
  }
  function save(data) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch {}
  }

  function loadPending() {
    try {
      const list = JSON.parse(localStorage.getItem(PENDING_KEY));
      return Array.isArray(list) ? list : [];
    } catch {
      return [];
    }
  }

  function savePending(list) {
    try {
      localStorage.setItem(PENDING_KEY, JSON.stringify(list));
    } catch {}
  }

  /* ── Public API ── */
  function unlock(id) {
    const data = load();
    if (data[id]) return false; // already unlocked
    data[id] = Date.now();
    save(data);
    const pending = loadPending();
    if (!pending.includes(id)) {
      pending.push(id);
      savePending(pending);
    }
    return true;
  }

  function isUnlocked(id) {
    return !!load()[id];
  }

  function getAll() {
    const data = load();
    return DEFINITIONS.map(def => ({
      ...def,
      unlocked: !!data[def.id],
      unlockedAt: data[def.id] || null,
    }));
  }

  function getPending() {
    const q = loadPending();
    savePending([]);
    return q;
  }

  function getDefinition(id) {
    return DEFINITIONS.find(d => d.id === id) || null;
  }

  window.HubAchievements = { unlock, isUnlocked, getAll, getPending, getDefinition };
})();
