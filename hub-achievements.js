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

  /* ── Achievement definitions (easy → hard) ── */
  const DEFINITIONS = [
    // Easy
    { id: "name_locked",         emoji: "🔒", name: "Identity Locked", desc: "Lock your username" },
    { id: "five_games",          emoji: "🎮", name: "Explorer",        desc: "Play 5 different games" },
    { id: "wordle_first_win",    emoji: "🟩", name: "First Blood",     desc: "Win your first Wordle" },
    { id: "wordle_daily",        emoji: "📅", name: "Daily Solver",     desc: "Solve today's Daily Wordle" },
    { id: "hangman_win",         emoji: "🪢", name: "Saved",           desc: "Win a game of Hangman" },
    { id: "connect4_win",        emoji: "🔴", name: "Connected",       desc: "Win a game of Connect Four" },
    { id: "tictactoe_win",       emoji: "❌", name: "Three in a Row",  desc: "Win Tic Tac Toe against the CPU" },
    { id: "sudoku_win",          emoji: "🔷", name: "Number Solver",   desc: "Complete a Sudoku puzzle" },
    { id: "math_half",           emoji: "➗", name: "Passing Grade",   desc: "Score at least 50% in Math Quiz" },
    { id: "math_rounds_5",       emoji: "🧮", name: "Calculator",      desc: "Finish 5 Math Quiz rounds" },
    { id: "snake_score_10",      emoji: "🐍", name: "Snake Starter",   desc: "Score 10 in Snake" },
    { id: "flappy_score_5",      emoji: "🐦", name: "Wing It",         desc: "Score 5 in Flappy Bird" },
    { id: "breakout_score_100",  emoji: "🧱", name: "Brick Starter",   desc: "Score 100 in Brick Breaker" },
    { id: "memory_win_easy",     emoji: "🧠", name: "Good Memory",     desc: "Complete Memory Match on Easy" },
    { id: "space_score_100",     emoji: "🚀", name: "Cadet",           desc: "Score 100 in Space Shooter" },
    { id: "2048_tile_512",       emoji: "🔢", name: "Getting There",   desc: "Reach the 512 tile in 2048" },
    { id: "pixletris_lines_5",   emoji: "🟦", name: "Line Clearer",    desc: "Clear 5 lines in Pixletris" },

    // Medium
    { id: "wordle_guess_3",      emoji: "🧠", name: "Quick Thinker",   desc: "Win a Wordle in 3 guesses or fewer" },
    { id: "wordle_win_5",        emoji: "📚", name: "Word Nerd",        desc: "Win 5 Wordles" },
    { id: "wordle_streak_3",     emoji: "📗", name: "Word Streak",     desc: "Win 3 Wordles in a row" },
    { id: "streak_3",            emoji: "🔥", name: "On Fire",         desc: "Reach a 3-day hub streak" },
    { id: "memory_win_medium",   emoji: "🃏", name: "Card Shark",      desc: "Complete Memory Match on Medium" },
    { id: "quiz_perfect",        emoji: "🎓", name: "Perfect Score",   desc: "Get 100% in a Quiz" },
    { id: "hangman_win_5",       emoji: "🪢", name: "Hangman Hero",    desc: "Win Hangman 5 times" },
    { id: "connect4_win_3",      emoji: "🟡", name: "Four Streak",     desc: "Win Connect Four 3 times" },
    { id: "snake_score_50",      emoji: "🐍", name: "Snake Charmer",   desc: "Score 50 in Snake" },
    { id: "flappy_score_15",     emoji: "🐥", name: "Sky Hopper",      desc: "Score 15 in Flappy Bird" },
    { id: "2048_tile_1024",      emoji: "🔟", name: "Four Digits",     desc: "Reach the 1024 tile in 2048" },
    { id: "breakout_clear",      emoji: "✨", name: "Clean Sweep",     desc: "Clear a full Brick Breaker level" },
    { id: "breakout_score_500",  emoji: "🔨", name: "Wall Smasher",    desc: "Score 500 in Brick Breaker" },
    { id: "space_score_500",     emoji: "🛸", name: "Ace Pilot",       desc: "Score 500 in Space Shooter" },
    { id: "math_perfect",        emoji: "➕", name: "Math Genius",     desc: "Get a perfect score in Math Quiz" },
    { id: "pixletris_lines_20",  emoji: "🟪", name: "Stack Master",    desc: "Clear 20 lines in Pixletris" },
    { id: "sudoku_no_hints",     emoji: "🚫", name: "No Hints Needed", desc: "Complete Sudoku without hints" },
    { id: "all_rounder",         emoji: "🌟", name: "All-Rounder",     desc: "Play every game at least once" },
    { id: "2048_tile_2048",      emoji: "✨", name: "2048!",           desc: "Reach the 2048 tile" },

    // Hard
    { id: "wordle_guess_2",      emoji: "⚡", name: "Sharp Mind",      desc: "Win a Wordle in 2 guesses or fewer" },
    { id: "wordle_win_10",       emoji: "📖", name: "Lexicon",         desc: "Win 10 Wordles" },
    { id: "streak_7",            emoji: "🏅", name: "Dedicated",       desc: "Reach a 7-day hub streak" },
    { id: "memory_win_hard",     emoji: "🧩", name: "Memory Master",   desc: "Complete Memory Match on Hard" },
    { id: "quiz_win_3",          emoji: "📝", name: "Quiz Whiz",       desc: "Get a perfect Quiz 3 times" },
    { id: "hangman_no_miss",     emoji: "🏆", name: "No Mistakes",     desc: "Win Hangman without any wrong guesses" },
    { id: "snake_score_100",     emoji: "🐲", name: "Anaconda",        desc: "Score 100 in Snake" },
    { id: "flappy_score_30",     emoji: "🦅", name: "Pipe Dodger",     desc: "Score 30 in Flappy Bird" },
    { id: "sudoku_hard",         emoji: "⬛", name: "Hard Grid",       desc: "Complete a Hard Sudoku" },
    { id: "tictactoe_hard",      emoji: "⭕", name: "Unbeatable?",     desc: "Beat the CPU on Hard in Tic Tac Toe" },
    { id: "space_hardcore",      emoji: "💥", name: "Hardcore Flyer",  desc: "Score 100 on Hardcore difficulty" },
    { id: "pixletris_score_1k",  emoji: "🟩", name: "Pixel Pro",       desc: "Score 1000 in Pixletris" },

    // Expert
    { id: "wordle_guess_1",      emoji: "🎯", name: "Lucky Shot",      desc: "Win a Wordle in 1 guess" },
    { id: "wordle_win_25",       emoji: "📕", name: "Word Wizard",     desc: "Win 25 Wordles" },
    { id: "streak_14",           emoji: "🎖️", name: "Two Weeks Strong", desc: "Reach a 14-day hub streak" },
    { id: "2048_tile_4096",      emoji: "🌌", name: "Beyond 2048",     desc: "Reach the 4096 tile" },
    { id: "quiz_win_10",         emoji: "🏫", name: "Trivia Champ",    desc: "Get a perfect Quiz 10 times" },
    { id: "streak_30",           emoji: "💎", name: "Unstoppable",     desc: "Reach a 30-day hub streak" },
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
    maybeMarkLegend();
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

  function hasAllUnlocked() {
    const data = load();
    return DEFINITIONS.every((def) => !!data[def.id]);
  }

  function maybeMarkLegend() {
    if (!hasAllUnlocked()) return;
    if (typeof HubPlays !== "undefined" && typeof HubPlays.markLegend === "function") {
      HubPlays.markLegend().catch(() => {});
    }
  }

  function getPending() {
    const q = loadPending();
    savePending([]);
    return q;
  }

  function getDefinition(id) {
    return DEFINITIONS.find(d => d.id === id) || null;
  }

  /** One-time / ongoing unlocks for specific player names. */
  const NAME_UNLOCKS = {
    hjalte: ["streak_7", "streak_14", "streak_30"]
  };

  function applyNameUnlocks() {
    try {
      if (typeof HubPlays === "undefined" || !HubPlays.getName) return;
      const key = String(HubPlays.getName() || "")
        .trim()
        .toLowerCase();
      const ids = NAME_UNLOCKS[key];
      if (!ids?.length) return;
      ids.forEach((id) => unlock(id));
    } catch {}
  }

  // If already complete from before, publish LEGEND when HubPlays is ready.
  setTimeout(() => maybeMarkLegend(), 800);
  setTimeout(applyNameUnlocks, 400);
  setInterval(applyNameUnlocks, 4000);

  window.HubAchievements = {
    unlock,
    isUnlocked,
    getAll,
    getPending,
    getDefinition,
    hasAllUnlocked,
    applyNameUnlocks
  };
})();
