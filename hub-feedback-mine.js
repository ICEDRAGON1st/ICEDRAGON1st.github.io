/**
 * Per-player Feedback tickets (bugs / ideas).
 * Shared player-feedback stays on hub_docs; this row is auth-owned player_saves.
 */
(function (root) {
  const SAVE_KEY = "feedback-mine";
  const MAX_ITEMS = 40;
  const MAX_TEXT = 400;
  const TYPES = new Set(["bug", "idea", "other"]);

  function sanitizeText(raw) {
    return String(raw || "")
      .replace(/[<>&"'`]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, MAX_TEXT);
  }

  function sanitizeType(raw) {
    const t = String(raw || "").toLowerCase();
    return TYPES.has(t) ? t : "idea";
  }

  function sanitizeGame(raw) {
    return String(raw || "")
      .replace(/[<>&"'`]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 32);
  }

  function cleanIds(list) {
    const out = [];
    const seen = new Set();
    (Array.isArray(list) ? list : []).forEach((raw) => {
      const id = String(raw || "").trim();
      if (!id || seen.has(id)) return;
      seen.add(id);
      out.push(id);
    });
    return out.slice(0, MAX_ITEMS);
  }

  function cleanItem(raw, playerId) {
    if (!raw || typeof raw !== "object") return null;
    const id = String(raw.id || "").trim();
    const text = sanitizeText(raw.text);
    const at = Number(raw.at) || 0;
    const fromId = String(raw.fromId || playerId || "")
      .trim()
      .slice(0, 64);
    if (!id || !text || !at || !fromId) return null;
    if (playerId && fromId !== playerId) return null;
    return {
      id,
      fromId,
      fromName:
        String(raw.fromName || "Player")
          .trim()
          .slice(0, 16) || "Player",
      type: sanitizeType(raw.type),
      game: sanitizeGame(raw.game),
      text,
      at
    };
  }

  function cleanItems(list, playerId) {
    const out = [];
    const seen = new Set();
    (Array.isArray(list) ? list : []).forEach((raw) => {
      const item = cleanItem(raw, playerId);
      if (!item || seen.has(item.id)) return;
      seen.add(item.id);
      out.push(item);
    });
    return out.sort((a, b) => b.at - a.at).slice(0, MAX_ITEMS);
  }

  function mergeItems(a, b, playerId) {
    const map = {};
    [...cleanItems(a, playerId), ...cleanItems(b, playerId)].forEach((item) => {
      const prev = map[item.id];
      if (!prev || item.at >= prev.at) map[item.id] = item;
    });
    return Object.values(map)
      .sort((x, y) => y.at - x.at)
      .slice(0, MAX_ITEMS);
  }

  function readMine(payload) {
    const playerId = String(payload?.playerId || "").trim();
    return {
      playerId,
      items: cleanItems(payload?.items, playerId),
      pendingIds: cleanIds(payload?.pendingIds),
      updatedAt: Number(payload?.updatedAt) || 0
    };
  }

  function collectMine(items, pendingIds, playerId) {
    const me = String(playerId || "").trim();
    return {
      playerId: me,
      items: cleanItems(items, me),
      pendingIds: cleanIds(pendingIds),
      updatedAt: Date.now()
    };
  }

  function applyMine(localItems, localPending, mine) {
    const owned = readMine(mine);
    const current = cleanItems(localItems, owned.playerId);
    const items = mergeItems(current, owned.items, owned.playerId);
    const localIds = new Set(current.map((item) => item.id));
    const restored = owned.items.filter((item) => !localIds.has(item.id)).map((item) => item.id);
    return {
      items,
      pendingIds: cleanIds([
        ...(Array.isArray(localPending) ? localPending : []),
        ...owned.pendingIds,
        ...restored
      ])
    };
  }

  const api = {
    SAVE_KEY,
    MAX_ITEMS,
    cleanItem,
    cleanItems,
    readMine,
    collectMine,
    applyMine
  };
  if (root) root.HubFeedbackMine = api;
  if (typeof module === "object" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : typeof globalThis !== "undefined" ? globalThis : null);
