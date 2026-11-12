/**
 * Personal-best snapshot for leaderboards.
 * Signed-in personal-best rows overlay the board; leftover hub_docs is not rewritten.
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

  const NAMEBIND_KEY = "__namebind";

  function readPbs(payload) {
    const games = payload && payload.games && typeof payload.games === "object" ? payload.games : {};
    const out = {};
    Object.keys(games).forEach((gameId) => {
      if (gameId === NAMEBIND_KEY) return;
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
      if (gameId === NAMEBIND_KEY) return;
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
      if (gameId === NAMEBIND_KEY) return;
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
      const pid = owned.playerId || String(row?.player_id || row?.playerId || "").trim();
      if (owned.playerId) games = applyPersonalBests(games, owned, nameKeyFn);
      const bindRaw = row?.games && typeof row.games === "object" ? row.games[NAMEBIND_KEY] : null;
      const bindName = String(typeof bindRaw === "string" ? bindRaw : bindRaw?.name || "")
        .replace(/[<>&"'`]/g, "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 16);
      if (pid && bindName && !/^guest-/i.test(bindName) && bindName.toLowerCase() !== "player") {
        resets[`namebind:${pid}`] = bindName;
      }
    });
    return { games, resets };
  }

  const RESETS_DOC_ID = "hub-leaderboard-resets";

  function overlayLeaderboardResets(hub, payload) {
    const games = { ...((hub && hub.games) || {}) };
    const resets = { ...((hub && hub.resets) || {}) };
    const source =
      payload && typeof payload === "object"
        ? payload.resets && typeof payload.resets === "object"
          ? payload.resets
          : payload
        : {};
    Object.entries(source).forEach(([key, value]) => {
      const k = String(key || "").slice(0, 96);
      if (!k || k.startsWith("namebind:")) return;
      const n = Math.max(0, Math.floor(Number(value) || 0));
      if (!n) return;
      const prev = Math.max(0, Math.floor(Number(resets[k]) || 0));
      if (n >= prev) resets[k] = n;
    });
    return { games, resets };
  }

  function applyResetsChange(hub, change) {
    const data = unwrapChange(change);
    const type = String(data.type || data.eventType || change?.event || "").toUpperCase();
    const current = {
      games: { ...((hub && hub.games) || {}) },
      resets: { ...((hub && hub.resets) || {}) }
    };
    if (type === "DELETE") return current;
    const record = data.record || data.new || {};
    if (!record || typeof record !== "object") return current;
    const docId = String(record.doc_id || record.docId || "").trim();
    if (docId && docId !== RESETS_DOC_ID) return current;
    const payload = record.data && typeof record.data === "object" ? record.data : record;
    return overlayLeaderboardResets(current, payload);
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
    NAMEBIND_KEY,
    overlayLeaderboardGames,
    applyChange,
    RESETS_DOC_ID,
    overlayLeaderboardResets,
    applyResetsChange
  };
  if (root) root.HubLeaderboardPbs = api;
  if (typeof module === "object" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : typeof globalThis !== "undefined" ? globalThis : null);
