/**
 * Shared popularity and recent-plays merge helpers for hub-plays.js.
 */
(function (root) {
  const MAX_PLAYS = 60;

  function parsePopularityPayload(data) {
    if (!data || typeof data !== "object") return { games: {}, resetAt: 0 };
    if (data.games && typeof data.games === "object") {
      return { games: { ...data.games }, resetAt: Number(data.resetAt) || 0 };
    }
    const flat = {};
    Object.entries(data).forEach(([k, v]) => {
      if (
        k === "games" ||
        k === "pending" ||
        k === "at" ||
        k === "updated_at" ||
        k === "resetAt" ||
        k === "note"
      ) {
        return;
      }
      if (Number.isFinite(Number(v))) flat[k] = Number(v) || 0;
    });
    return { games: flat, resetAt: Number(data.resetAt) || 0 };
  }

  function combinePopularity(cache, pending) {
    const out = { ...(cache || {}) };
    Object.entries(pending || {}).forEach(([id, raw]) => {
      const n = Number(raw) || 0;
      if (n <= 0) return;
      out[id] = (Number(out[id]) || 0) + n;
    });
    return out;
  }

  function mergePopularityRemote(remote, pending, localCache) {
    const merged = { ...(remote || {}) };
    Object.entries(pending || {}).forEach(([k, v]) => {
      const n = Number(v) || 0;
      if (n <= 0) return;
      merged[k] = (Number(merged[k]) || 0) + n;
    });
    Object.entries(localCache || {}).forEach(([k, v]) => {
      if (merged[k] == null) merged[k] = Number(v) || 0;
    });
    return merged;
  }

  function mostPopularGameId(counts, allowedIds) {
    const allow = Array.isArray(allowedIds) && allowedIds.length ? new Set(allowedIds) : null;
    let bestId = "";
    let best = 0;
    Object.entries(counts || {}).forEach(([id, raw]) => {
      if (allow && !allow.has(id)) return;
      const n = Number(raw) || 0;
      if (n > best) {
        best = n;
        bestId = id;
      }
    });
    return best > 0 ? bestId : "";
  }

  const SAVE_KEY = "plays-mine";
  const MAX_MINE = 40;

  function sanitizeName(raw) {
    return root.HubIdentity?.sanitizeName
      ? root.HubIdentity.sanitizeName(raw)
      : String(raw || "")
          .replace(/[<>&"'`]/g, "")
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 16);
  }

  function cleanPlay(raw, playerId) {
    if (!raw || typeof raw !== "object") return null;
    const id = String(raw.id || "").trim();
    const fromId = String(raw.playerId || "").trim();
    const at = Number(raw.at) || 0;
    const game = String(raw.game || "")
      .trim()
      .slice(0, 32);
    if (!id || !fromId || !at || !game) return null;
    if (playerId && fromId !== playerId) return null;
    return {
      id,
      playerId: fromId,
      name: sanitizeName(raw.name || "") || "Player",
      game,
      gameName:
        String(raw.gameName || game)
          .trim()
          .slice(0, 48) || game,
      at
    };
  }

  function cleanPlays(list, playerId) {
    const out = [];
    const seen = new Set();
    (Array.isArray(list) ? list : []).forEach((raw) => {
      const play = cleanPlay(raw, playerId);
      if (!play || seen.has(play.id)) return;
      seen.add(play.id);
      out.push(play);
    });
    return out.sort((a, b) => b.at - a.at).slice(0, MAX_MINE);
  }

  function readMine(payload) {
    const playerId = String(payload?.playerId || "").trim();
    return {
      playerId,
      plays: cleanPlays(payload?.plays, playerId),
      updatedAt: Number(payload?.updatedAt) || 0
    };
  }

  function collectMine(plays, playerId) {
    const me = String(playerId || "").trim();
    return {
      playerId: me,
      plays: cleanPlays(plays, me),
      updatedAt: Date.now()
    };
  }

  function applyMine(localPlays, mine, playerId) {
    const owned = readMine(mine);
    const me = String(playerId || owned.playerId || "").trim();
    if (!me || !owned.playerId || owned.playerId !== me) {
      return Array.isArray(localPlays) ? localPlays : [];
    }
    return mergePlayLogs({ plays: localPlays || [] }, { plays: owned.plays }, MAX_PLAYS).plays;
  }

  function sanitizeContributionGames(games) {
    const out = {};
    Object.entries(games && typeof games === "object" ? games : {}).forEach(([id, raw]) => {
      const key = String(id || "")
        .trim()
        .slice(0, 32);
      if (!/^[a-z0-9][a-z0-9-]{0,31}$/i.test(key)) return;
      const n = Math.floor(Number(raw) || 0);
      if (n <= 0) return;
      out[key] = Math.min(n, 1_000_000);
    });
    return out;
  }

  function addContributionGames(a, b) {
    return combinePopularity(sanitizeContributionGames(a), sanitizeContributionGames(b));
  }

  function readOwnContribution(rows, playerId) {
    const me = String(playerId || "").trim();
    if (!me) return {};
    const row = (Array.isArray(rows) ? rows : []).find(
      (item) => String(item?.player_id || item?.playerId || "").trim() === me
    );
    return sanitizeContributionGames(row?.games);
  }

  function rowsToCounts(rows) {
    const out = {};
    (Array.isArray(rows) ? rows : []).forEach((row) => {
      Object.entries(sanitizeContributionGames(row?.games)).forEach(([id, n]) => {
        out[id] = (Number(out[id]) || 0) + n;
      });
    });
    return out;
  }

  function mergePlayLogs(a, b, maxPlays = MAX_PLAYS) {
    const map = new Map();
    [...(a?.plays || []), ...(b?.plays || [])].forEach((p) => {
      if (!p || !p.id) return;
      map.set(p.id, p);
    });
    const plays = [...map.values()].sort((x, y) => (y.at || 0) - (x.at || 0)).slice(0, maxPlays);
    const counts = { ...(a?.counts || {}) };
    Object.entries(b?.counts || {}).forEach(([k, v]) => {
      counts[k] = Math.max(Number(counts[k]) || 0, Number(v) || 0);
    });
    return { plays, counts };
  }

  const api = {
    MAX_PLAYS,
    parsePopularityPayload,
    combinePopularity,
    mergePopularityRemote,
    mostPopularGameId,
    sanitizeContributionGames,
    addContributionGames,
    readOwnContribution,
    rowsToCounts,
    mergePlayLogs,
    SAVE_KEY,
    MAX_MINE,
    cleanPlay,
    readMine,
    collectMine,
    applyMine
  };
  root.HubPopularity = api;
  if (typeof module === "object" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
