/**
 * hub-plays.js — nickname + shared recent-players log.
 * Uses MantleDB (browser-only) so the site owner can see who played.
 */
(function () {
  const NAME_KEY = "hub-player-name";
  const LOCAL_KEY = "hub-plays-local-v1";
  const NS = "icedragon1st-mygames";
  const PATH = "plays-log";
  const API = `https://mantledb.sh/v2/${NS}/${PATH}`;
  const MAX_PLAYS = 60;
  const SYNC_GAP_MS = 4000;

  const GAME_NAMES = {
    wordle: "Wordle",
    space: "Space Shooter",
    quiz: "Quizmaster",
    breakout: "Brick Breaker",
    hangman: "Hangman",
    "2048": "2048",
    snake: "Snake",
    memory: "Memory Match",
    "connect-four": "Connect Four",
    math: "Math Sprint",
    sudoku: "Sudoku",
    flappy: "Flappy Bird",
    tictactoe: "Tic Tac Toe",
    pixletris: "Pixletris"
  };

  let syncing = false;
  let lastSync = 0;
  let cache = { plays: [], counts: {} };

  function sanitizeName(raw) {
    const cleaned = String(raw || "")
      .replace(/[<>&"'`]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 16);
    return cleaned || "Player";
  }

  function getName() {
    try {
      return sanitizeName(localStorage.getItem(NAME_KEY) || "");
    } catch {
      return "";
    }
  }

  function setName(name) {
    const next = sanitizeName(name);
    try {
      localStorage.setItem(NAME_KEY, next);
    } catch {}
    return next;
  }

  function loadLocal() {
    try {
      const data = JSON.parse(localStorage.getItem(LOCAL_KEY));
      if (data && Array.isArray(data.plays)) {
        return {
          plays: data.plays.slice(0, MAX_PLAYS),
          counts: data.counts && typeof data.counts === "object" ? data.counts : {}
        };
      }
    } catch {}
    return { plays: [], counts: {} };
  }

  function saveLocal(data) {
    cache = data;
    try {
      localStorage.setItem(LOCAL_KEY, JSON.stringify(data));
    } catch {}
  }

  function gameLabel(id) {
    return GAME_NAMES[id] || id;
  }

  function makeId() {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  async function fetchRemote() {
    const res = await fetch(API, { cache: "no-store" });
    if (res.status === 404) return { plays: [], counts: {} };
    if (!res.ok) throw new Error("fetch failed");
    const data = await res.json();
    return {
      plays: Array.isArray(data.plays) ? data.plays : [],
      counts: data.counts && typeof data.counts === "object" ? data.counts : {}
    };
  }

  async function pushRemote(data) {
    const res = await fetch(API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error("push failed");
  }

  function mergeLogs(a, b) {
    const map = new Map();
    [...(a.plays || []), ...(b.plays || [])].forEach((p) => {
      if (!p || !p.id) return;
      map.set(p.id, p);
    });
    const plays = [...map.values()]
      .sort((x, y) => (y.at || 0) - (x.at || 0))
      .slice(0, MAX_PLAYS);
    const counts = { ...(a.counts || {}) };
    Object.entries(b.counts || {}).forEach(([k, v]) => {
      counts[k] = Math.max(Number(counts[k]) || 0, Number(v) || 0);
    });
    return { plays, counts };
  }

  async function sync() {
    if (syncing) return cache;
    if (Date.now() - lastSync < SYNC_GAP_MS) return cache;
    syncing = true;
    try {
      const local = loadLocal();
      let remote = { plays: [], counts: {} };
      try {
        remote = await fetchRemote();
      } catch {
        remote = { plays: [], counts: {} };
      }
      const merged = mergeLogs(local, remote);
      saveLocal(merged);
      try {
        await pushRemote(merged);
      } catch {
        // offline / blocked — local still works
      }
      lastSync = Date.now();
      cache = merged;
      return merged;
    } finally {
      syncing = false;
    }
  }

  function record(gameId) {
    const id = String(gameId || "unknown");
    const name = getName() || setName("Player");
    const entry = {
      id: makeId(),
      name,
      game: id,
      gameName: gameLabel(id),
      at: Date.now()
    };
    const local = loadLocal();
    local.plays = [entry, ...local.plays].slice(0, MAX_PLAYS);
    local.counts[id] = (Number(local.counts[id]) || 0) + 1;
    saveLocal(local);
    sync().catch(() => {});
    return entry;
  }

  function getStatus() {
    const data = cache.plays.length ? cache : loadLocal();
    return {
      name: getName(),
      plays: data.plays,
      counts: data.counts
    };
  }

  function formatWhen(ts) {
    const diff = Math.max(0, Date.now() - ts);
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }

  window.HubPlays = {
    getName,
    setName,
    record,
    sync,
    getStatus,
    gameLabel,
    formatWhen,
    sanitizeName
  };
})();
