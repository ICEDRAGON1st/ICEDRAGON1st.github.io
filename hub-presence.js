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

  const api = {
    ONLINE_TTL_MS,
    PRESENCE_KEEP_MS,
    MAX_PRESENCE,
    isPlaceholderName,
    sanitizePresenceGame,
    mergePresence,
    prunePresence,
    countOnline
  };
  root.HubPresence = api;
  if (typeof module === "object" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
