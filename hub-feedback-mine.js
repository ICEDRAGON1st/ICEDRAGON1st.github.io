/**
 * Per-player Feedback tickets (bugs / ideas).
 * Signed-in Feedback rows overlay the inbox; leftover hub_docs is not rewritten.
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

  function overlayFeedbackItems(hub, rows) {
    const map = {};
    const take = (list, playerId) => {
      (Array.isArray(list) ? list : []).forEach((raw) => {
        const item = cleanItem(raw, playerId || undefined);
        if (!item) return;
        const prev = map[item.id];
        if (!prev || item.at >= prev.at) map[item.id] = item;
      });
    };
    take(hub && hub.items, "");
    (Array.isArray(rows) ? rows : []).forEach((row) => {
      const playerId = String(row?.player_id || row?.playerId || "").trim();
      if (!playerId) return;
      take(row.items, playerId);
    });
    return {
      items: Object.values(map)
        .sort((a, b) => b.at - a.at)
        .slice(0, 120)
    };
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

  function applyChange(hub, change) {
    const data = unwrapChange(change);
    const type = String(data.type || data.eventType || change?.event || "").toUpperCase();
    const current = {
      items: Array.isArray(hub?.items) ? hub.items.slice() : []
    };
    if (type === "DELETE") return current;
    const record = data.record || data.new || {};
    if (!record || typeof record !== "object") return current;
    return overlayFeedbackItems(current, [record]);
  }

  const DELETES_DOC_ID = "hub-feedback-deletes";
  const MAX_DELETED = 200;

  function overlayFeedbackDeletes(hub, payload) {
    const items = Array.isArray(hub?.items) ? hub.items.slice() : [];
    const incoming = Array.isArray(payload?.deletedIds)
      ? payload.deletedIds
      : Array.isArray(payload)
        ? payload
        : [];
    const deletedIds = (() => {
      const out = [];
      const seen = new Set();
      [...(Array.isArray(hub?.deletedIds) ? hub.deletedIds : []), ...incoming].forEach((raw) => {
        const id = String(raw || "").trim();
        if (!id || seen.has(id)) return;
        seen.add(id);
        out.push(id);
      });
      return out.slice(0, MAX_DELETED);
    })();
    const drop = new Set(deletedIds);
    return {
      items: items.filter((item) => !drop.has(String(item?.id || ""))),
      deletedIds
    };
  }

  function applyDeletesChange(hub, change) {
    const data = unwrapChange(change);
    const type = String(data.type || data.eventType || change?.event || "").toUpperCase();
    const current = {
      items: Array.isArray(hub?.items) ? hub.items.slice() : [],
      deletedIds: Array.isArray(hub?.deletedIds) ? hub.deletedIds.slice() : []
    };
    if (type === "DELETE") return current;
    const record = data.record || data.new || {};
    if (!record || typeof record !== "object") return current;
    const docId = String(record.doc_id || record.docId || "").trim();
    if (docId && docId !== DELETES_DOC_ID) return current;
    const payload = record.data && typeof record.data === "object" ? record.data : record;
    return overlayFeedbackDeletes(current, payload);
  }

  const api = {
    SAVE_KEY,
    MAX_ITEMS,
    cleanItem,
    cleanItems,
    readMine,
    collectMine,
    applyMine,
    overlayFeedbackItems,
    applyChange,
    DELETES_DOC_ID,
    overlayFeedbackDeletes,
    applyDeletesChange
  };
  if (root) root.HubFeedbackMine = api;
  if (typeof module === "object" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : typeof globalThis !== "undefined" ? globalThis : null);
