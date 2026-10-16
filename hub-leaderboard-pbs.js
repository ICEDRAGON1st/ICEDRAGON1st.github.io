/**
 * Personal-best snapshot for leaderboards.
 * Shared boards stay on hub_docs; this row is auth-owned player_saves.
 */
(function (root) {
  const SAVE_KEY = "lb-pbs";

  function isBetter(next, prev, lowerBetter) {
    if (typeof next !== "number" || !Number.isFinite(next)) return false;
    if (typeof prev !== "number" || !Number.isFinite(prev)) return true;
    return lowerBetter ? next < prev : next > prev;
  }

  function pickBetterEntry(a, b, lowerBetter) {
    if (!a) return b || null;
    if (!b) return a;
    if (isBetter(Number(b.score), Number(a.score), lowerBetter)) return b;
    if (isBetter(Number(a.score), Number(b.score), lowerBetter)) return a;
    return (Number(b.at) || 0) >= (Number(a.at) || 0) ? b : a;
  }

  function cleanEntry(entry) {
    if (!entry || typeof entry !== "object") return null;
    const score = Number(entry.score);
    const name = String(entry.name || "").trim();
    if (!name || !Number.isFinite(score)) return null;
    const out = {
      name,
      score,
      at: Number(entry.at) || 0,
      playerId: String(entry.playerId || ""),
      lowerBetter: !!entry.lowerBetter
    };
    if (Number(entry.bornAt) > 0) out.bornAt = Number(entry.bornAt);
    if (entry.fishing && typeof entry.fishing === "object") {
      out.fishing = {
        id: String(entry.fishing.id || ""),
        name: String(entry.fishing.name || ""),
        rarity: String(entry.fishing.rarity || ""),
        value: Number(entry.fishing.value) || 0,
        variant: String(entry.fishing.variant || ""),
        shiny: !!entry.fishing.shiny,
        mutation: String(entry.fishing.mutation || "")
      };
    }
    return out;
  }

  function readPbs(payload) {
    const games = payload && payload.games && typeof payload.games === "object" ? payload.games : {};
    const out = {};
    Object.keys(games).forEach((gameId) => {
      const entry = cleanEntry(games[gameId]);
      if (entry) out[gameId] = entry;
    });
    return {
      playerId: String(payload?.playerId || ""),
      games: out,
      updatedAt: Number(payload?.updatedAt) || 0
    };
  }

  function collectMine(games, belongsToMe) {
    const mine = {};
    Object.entries(games && typeof games === "object" ? games : {}).forEach(([gameId, board]) => {
      if (!board || typeof board !== "object") return;
      let best = null;
      Object.values(board).forEach((raw) => {
        const entry = cleanEntry(raw);
        if (!entry || (typeof belongsToMe === "function" && !belongsToMe(entry))) return;
        best = pickBetterEntry(best, entry, !!entry.lowerBetter);
      });
      if (best) mine[gameId] = best;
    });
    return {
      playerId: Object.values(mine)[0]?.playerId || "",
      games: mine,
      updatedAt: Date.now()
    };
  }

  function applyPersonalBests(games, pbs, nameKeyFn) {
    const next = { ...(games && typeof games === "object" ? games : {}) };
    const rows = pbs && pbs.games && typeof pbs.games === "object" ? pbs.games : {};
    Object.entries(rows).forEach(([gameId, raw]) => {
      const entry = cleanEntry(raw);
      if (!entry) return;
      const key = typeof nameKeyFn === "function" ? nameKeyFn(entry.name) : String(entry.name || "").toLowerCase();
      if (!key) return;
      const board = { ...(next[gameId] || {}) };
      board[key] = pickBetterEntry(cleanEntry(board[key]), entry, !!entry.lowerBetter);
      next[gameId] = board;
    });
    return next;
  }

  function overlayLeaderboardGames(hub, rows, nameKeyFn) {
    let games = { ...((hub && hub.games) || {}) };
    const resets = { ...((hub && hub.resets) || {}) };
    (Array.isArray(rows) ? rows : []).forEach((row) => {
      const owned = readPbs({
        playerId: row?.player_id || row?.playerId,
        games: row?.games,
        updatedAt: Date.parse(row?.updated_at || "") || Number(row?.updatedAt) || 0
      });
      if (!owned.playerId) return;
      games = applyPersonalBests(games, owned, nameKeyFn);
    });
    return { games, resets };
  }

  function unwrapChange(change) {
    const payload = change && typeof change === "object" ? change : {};
    if (payload.data && typeof payload.data === "object") return payload.data;
    if (payload.payload && typeof payload.payload === "object") {
      const inner = payload.payload;
      if (inner.data && typeof inner.data === "object") return inner.data;
      return inner;
    }
    return payload;
  }

  function applyChange(hub, change, nameKeyFn) {
    const data = unwrapChange(change);
    const type = String(data.type || data.eventType || change?.event || "").toUpperCase();
    const current = {
      games: { ...((hub && hub.games) || {}) },
      resets: { ...((hub && hub.resets) || {}) }
    };
    if (type === "DELETE") return current;
    const record = data.record || data.new || {};
    if (!record || typeof record !== "object") return current;
    return overlayLeaderboardGames(current, [record], nameKeyFn);
  }

  const api = {
    SAVE_KEY,
    isBetter,
    pickBetterEntry,
    cleanEntry,
    readPbs,
    collectMine,
    applyPersonalBests,
    overlayLeaderboardGames,
    applyChange
  };
  if (root) root.HubLeaderboardPbs = api;
  if (typeof module === "object" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : typeof globalThis !== "undefined" ? globalThis : null);
