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
    mergePlayLogs
  };
  root.HubPopularity = api;
  if (typeof module === "object" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
