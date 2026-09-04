/**
 * hub-leaderboard.js
 * Global per-game leaderboards via MantleDB.
 *
 * API (window.HubLeaderboard):
 *   .submit(gameId, score, { lowerBetter? }) — post personal best if improved
 *   .sync(force?) — fetch/merge remote boards
 *   .getBoard(gameId) — ranked array [{ rank, name, score, at, isYou, lowerBetter }]
 *   .formatScore(gameId, score) — display label
 *   .GAME_IDS — known game ids
 */
(function () {
  const NS = "icedragon1st-mygames";
  const PATH = "leaderboards";
  const API = `https://mantledb.sh/v2/${NS}/${PATH}`;
  const LOCAL_KEY = "hub-leaderboards-v1";
  const MAX_PER_GAME = 50;
  const SYNC_GAP_MS = 4000;

  const GAME_META = {
    wordle: { label: "Wordle", lowerBetter: false, unit: "wins" },
    space: { label: "Space Shooter", lowerBetter: false, unit: "score" },
    quiz: { label: "Quizmaster", lowerBetter: false, unit: "score" },
    breakout: { label: "Brick Breaker", lowerBetter: false, unit: "score" },
    hangman: { label: "Hangman", lowerBetter: false, unit: "streak" },
    "2048": { label: "2048", lowerBetter: false, unit: "score" },
    snake: { label: "Snake", lowerBetter: false, unit: "score" },
    memory: { label: "Memory Match", lowerBetter: true, unit: "time" },
    "connect-four": { label: "Connect Four", lowerBetter: false, unit: "wins" },
    math: { label: "Math Sprint", lowerBetter: false, unit: "score" },
    sudoku: { label: "Sudoku", lowerBetter: true, unit: "time" },
    flappy: { label: "Flappy Bird", lowerBetter: false, unit: "score" },
    tictactoe: { label: "Tic Tac Toe", lowerBetter: false, unit: "wins" },
    pixletris: { label: "Pixletris", lowerBetter: false, unit: "score" }
  };

  const GAME_IDS = Object.keys(GAME_META);

  let cache = { games: {} };
  let syncing = false;
  let lastSync = 0;
  let submitQueue = Promise.resolve();

  function meta(gameId) {
    return GAME_META[gameId] || { label: gameId, lowerBetter: false, unit: "score" };
  }

  function nameKey(name) {
    return String(name || "")
      .trim()
      .toLowerCase()
      .slice(0, 16);
  }

  function sanitizeName(raw) {
    if (typeof HubPlays !== "undefined" && HubPlays.sanitizeName) {
      return HubPlays.sanitizeName(raw);
    }
    return String(raw || "")
      .replace(/[<>&"'`]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 16);
  }

  function getPlayerName() {
    if (typeof HubPlays === "undefined") return "";
    const name = sanitizeName(HubPlays.getName() || "");
    if (!name) return "";
    if (/^guest-/i.test(name)) return "";
    if (name.toLowerCase() === "player") return "";
    return name;
  }

  function getPlayerId() {
    if (typeof HubPlays !== "undefined" && HubPlays.getPlayerId) {
      return HubPlays.getPlayerId();
    }
    return "";
  }

  function isBetter(a, b, lowerBetter) {
    if (typeof a !== "number" || !Number.isFinite(a)) return false;
    if (typeof b !== "number" || !Number.isFinite(b)) return true;
    return lowerBetter ? a < b : a > b;
  }

  function formatSeconds(total) {
    const s = Math.max(0, Math.floor(total));
    const m = Math.floor(s / 60);
    const r = s % 60;
    return m > 0 ? `${m}:${String(r).padStart(2, "0")}` : `${r}s`;
  }

  function formatScore(gameId, score) {
    const m = meta(gameId);
    const n = Number(score);
    if (!Number.isFinite(n) || n <= 0) return "—";
    if (m.unit === "time") return formatSeconds(n);
    if (m.unit === "wins") return `${Math.floor(n)} win${Math.floor(n) === 1 ? "" : "s"}`;
    if (m.unit === "streak") return `Streak ${Math.floor(n)}`;
    return `Best ${Math.floor(n)}`;
  }

  function loadLocal() {
    try {
      const data = JSON.parse(localStorage.getItem(LOCAL_KEY));
      if (data && data.games && typeof data.games === "object") {
        return {
          games: data.games,
          resets: data.resets && typeof data.resets === "object" ? data.resets : {}
        };
      }
    } catch {}
    return { games: {}, resets: {} };
  }

  function saveLocal(data) {
    cache = {
      games: data.games || {},
      resets: data.resets && typeof data.resets === "object" ? data.resets : {}
    };
    try {
      localStorage.setItem(LOCAL_KEY, JSON.stringify(cache));
    } catch {}
  }

  async function fetchJson(url) {
    const res = await fetch(url, { cache: "no-store" });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error("fetch failed");
    return res.json();
  }

  async function postJson(url, data) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error("push failed");
  }

  async function fetchRemote() {
    const data = await fetchJson(API);
    if (!data || typeof data !== "object") return { games: {}, resets: {} };
    const games = data.games && typeof data.games === "object" ? data.games : {};
    const resets = data.resets && typeof data.resets === "object" ? data.resets : {};
    return { games, resets };
  }

  function normalizeEntry(entry, fallbackLower) {
    if (!entry || typeof entry !== "object") return null;
    const name = sanitizeName(entry.name || "");
    const score = Number(entry.score);
    if (!name || !Number.isFinite(score)) return null;
    return {
      name,
      score,
      at: Number(entry.at) || 0,
      playerId: String(entry.playerId || ""),
      lowerBetter: typeof entry.lowerBetter === "boolean" ? entry.lowerBetter : !!fallbackLower
    };
  }

  function trimBoard(boardMap, lowerBetter) {
    const entries = Object.entries(boardMap || {})
      .map(([key, entry]) => ({ key, entry: normalizeEntry(entry, lowerBetter) }))
      .filter((x) => x.entry);
    entries.sort((a, b) => {
      if (a.entry.score !== b.entry.score) {
        return lowerBetter ? a.entry.score - b.entry.score : b.entry.score - a.entry.score;
      }
      return (a.entry.at || 0) - (b.entry.at || 0);
    });
    const out = {};
    entries.slice(0, MAX_PER_GAME).forEach(({ key, entry }) => {
      out[key] = entry;
    });
    return out;
  }

  function mergeBoards(a, b) {
    const games = {};
    const ids = new Set([
      ...Object.keys((a && a.games) || {}),
      ...Object.keys((b && b.games) || {}),
      ...GAME_IDS
    ]);
    ids.forEach((gameId) => {
      const lowerBetter = meta(gameId).lowerBetter;
      const merged = {};
      const left = ((a && a.games) || {})[gameId] || {};
      const right = ((b && b.games) || {})[gameId] || {};
      [...Object.keys(left), ...Object.keys(right)].forEach((key) => {
        const le = normalizeEntry(left[key], lowerBetter);
        const re = normalizeEntry(right[key], lowerBetter);
        if (!le && !re) return;
        if (!le) {
          merged[key] = re;
          return;
        }
        if (!re) {
          merged[key] = le;
          return;
        }
        if (isBetter(re.score, le.score, lowerBetter)) merged[key] = re;
        else if (isBetter(le.score, re.score, lowerBetter)) merged[key] = le;
        else merged[key] = (re.at || 0) >= (le.at || 0) ? re : le;
      });
      games[gameId] = trimBoard(merged, lowerBetter);
    });
    const resets = { ...((a && a.resets) || {}), ...((b && b.resets) || {}) };
    return applyResets({ games, resets });
  }

  function applyResets(data) {
    const games = { ...(data.games || {}) };
    const resets = { ...(data.resets || {}) };
    // One-time: wipe Hjalte from Sudoku only (other games untouched).
    const resetKey = "sudoku:hjalte";
    if (!resets[resetKey]) resets[resetKey] = Date.now();
    const cutAt = Number(resets[resetKey]);
    const board = { ...(games.sudoku || {}) };
    const entry = board.hjalte;
    if (entry && (!entry.at || Number(entry.at) <= cutAt)) {
      delete board.hjalte;
    }
    games.sudoku = board;
    return { games, resets };
  }

  async function clearPlayer(gameId, playerName) {
    const key = nameKey(playerName);
    if (!gameId || !key) return false;
    const run = async () => {
      await sync(true);
      const games = { ...(cache.games || {}) };
      const board = { ...(games[gameId] || {}) };
      delete board[key];
      games[gameId] = board;
      const resets = { ...(cache.resets || {}) };
      const resetKey = `${gameId}:${key}`;
      if (!resets[resetKey]) resets[resetKey] = Date.now();
      const next = applyResets({ games, resets });
      saveLocal(next);
      try {
        const remote = await fetchRemote();
        const merged = mergeBoards(next, remote);
        saveLocal(merged);
        await postJson(API, merged);
      } catch {}
      lastSync = Date.now();
      return true;
    };
    submitQueue = submitQueue.then(run, run);
    return submitQueue;
  }

  async function sync(force = false) {
    if (syncing) return cache;
    if (!force && Date.now() - lastSync < SYNC_GAP_MS) return cache;
    syncing = true;
    try {
      const local = loadLocal();
      let remote = { games: {}, resets: {} };
      try {
        remote = await fetchRemote();
      } catch {
        remote = { games: {}, resets: {} };
      }
      const merged = mergeBoards(local, remote);
      saveLocal(merged);
      try {
        await postJson(API, merged);
      } catch {
        // offline — local still works
      }
      lastSync = Date.now();
      return merged;
    } finally {
      syncing = false;
    }
  }

  function getBoard(gameId) {
    const lowerBetter = meta(gameId).lowerBetter;
    const board = ((cache.games || {})[gameId]) || ((loadLocal().games || {})[gameId]) || {};
    const me = nameKey(getPlayerName());
    const rows = Object.values(board)
      .map((entry) => normalizeEntry(entry, lowerBetter))
      .filter(Boolean)
      .sort((a, b) => {
        if (a.score !== b.score) {
          return lowerBetter ? a.score - b.score : b.score - a.score;
        }
        return (a.at || 0) - (b.at || 0);
      });
    return rows.map((entry, i) => ({
      rank: i + 1,
      name: entry.name,
      score: entry.score,
      at: entry.at,
      lowerBetter,
      label: formatScore(gameId, entry.score),
      isYou: me && nameKey(entry.name) === me
    }));
  }

  async function submit(gameId, score, opts = {}) {
    const n = Number(score);
    if (!GAME_META[gameId] || !Number.isFinite(n) || n <= 0) return false;
    const name = getPlayerName();
    if (!name) return false;

    const lowerBetter =
      typeof opts.lowerBetter === "boolean" ? opts.lowerBetter : meta(gameId).lowerBetter;

    const run = async () => {
      await sync(true);
      const key = nameKey(name);
      const games = { ...(cache.games || {}) };
      const board = { ...(games[gameId] || {}) };
      const prev = normalizeEntry(board[key], lowerBetter);
      if (prev && !isBetter(n, prev.score, lowerBetter)) {
        return false;
      }
      board[key] = {
        name,
        score: n,
        at: Date.now(),
        playerId: getPlayerId(),
        lowerBetter
      };
      games[gameId] = trimBoard(board, lowerBetter);
      const next = applyResets({
        games,
        resets: { ...(cache.resets || {}) }
      });
      saveLocal(next);
      try {
        const remote = await fetchRemote();
        const merged = mergeBoards(next, remote);
        saveLocal(merged);
        await postJson(API, merged);
      } catch {
        // keep local
      }
      lastSync = Date.now();
      return true;
    };

    submitQueue = submitQueue.then(run, run);
    return submitQueue;
  }

  // Seed cache from local on load, then sync so the Sudoku Hjalte wipe is pushed once.
  cache = applyResets(loadLocal());
  saveLocal(cache);
  sync(true).catch(() => {});

  window.HubLeaderboard = {
    submit,
    sync,
    getBoard,
    clearPlayer,
    formatScore,
    GAME_IDS,
    GAME_META
  };
})();
