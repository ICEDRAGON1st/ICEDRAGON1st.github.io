/**
 * Shared presence merge/prune/count for hub-plays.js.
 */
(function (root) {
  const ONLINE_TTL_MS = 180_000;
  const PRESENCE_KEEP_MS = 10 * 60_000;
  const MAX_PRESENCE = 120;

  function sanitizeName(raw) {
    return root.HubIdentity?.sanitizeName
      ? root.HubIdentity.sanitizeName(raw)
      : String(raw || "").trim();
  }

  function isPlaceholderName(name) {
    const n = sanitizeName(name || "").toLowerCase();
    return (
      !n ||
      n === "guest" ||
      n.startsWith("guest-") ||
      n === "player" ||
      n === "undefined" ||
      n === "null" ||
      n === "nan" ||
      n === "unnamed"
    );
  }

  function sanitizePresenceGame(game, knownIds) {
    const id = String(game || "").trim();
    if (!id) return "";
    if (id === "hub") return "hub";
    if (knownIds && knownIds[id]) return id;
    return id.slice(0, 32);
  }

  function mergePresence(a, b) {
    const out = { ...(a || {}) };
    Object.entries(b || {}).forEach(([id, p]) => {
      if (!p) return;
      const existing = out[id];
      if (!existing || (p.at || 0) >= (existing.at || 0)) out[id] = p;
    });
    return out;
  }

  function prunePresence(map, now = Date.now()) {
    const entries = Object.entries(map || {})
      .filter(([, p]) => p && now - (p.at || 0) < PRESENCE_KEEP_MS)
      .sort((a, b) => (b[1].at || 0) - (a[1].at || 0))
      .slice(0, MAX_PRESENCE);
    const out = {};
    entries.forEach(([id, p]) => {
      out[id] = p;
    });
    return out;
  }

  function countOnline(map, now = Date.now()) {
    return Object.values(map || {}).filter(
      (p) => p && now - (p.at || 0) < ONLINE_TTL_MS && !isPlaceholderName(p.name)
    ).length;
  }

  function rowsToMap(rows) {
    const out = {};
    (Array.isArray(rows) ? rows : []).forEach((row) => {
      if (!row || typeof row !== "object") return;
      const id = String(row.player_id || row.playerId || "").trim();
      if (!id) return;
      const at = Date.parse(row.pinged_at || row.pingedAt || "") || Number(row.at) || 0;
      if (!at) return;
      out[id] = {
        at,
        name: sanitizeName(row.display_name || row.name || "") || "Guest",
        game: sanitizePresenceGame(row.game)
      };
    });
    return out;
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

  function applyChange(map, change, now = Date.now()) {
    const data = unwrapChange(change);
    const type = String(data.type || data.eventType || change?.event || "").toUpperCase();
    const record = data.record || data.new || {};
    const old = data.old_record || data.old || {};
    const next = { ...(map || {}) };
    if (type === "DELETE") {
      const id = String(
        old.player_id || old.playerId || record.player_id || record.playerId || ""
      ).trim();
      if (id) delete next[id];
      return prunePresence(next, now);
    }
    const mapped = rowsToMap([record]);
    if (!Object.keys(mapped).length) return prunePresence(next, now);
    return prunePresence(mergePresence(next, mapped), now);
  }

  const api = {
    ONLINE_TTL_MS,
    PRESENCE_KEEP_MS,
    MAX_PRESENCE,
    isPlaceholderName,
    sanitizePresenceGame,
    mergePresence,
    prunePresence,
    countOnline,
    rowsToMap,
    applyChange
  };
  root.HubPresence = api;
  if (typeof module === "object" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
