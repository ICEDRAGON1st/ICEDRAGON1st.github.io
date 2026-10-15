/**
 * Per-player notification inbox snapshot.
 * Local hub-notifications-v1 stays the live list; this row is auth-owned player_saves.
 */
(function (root) {
  const SAVE_KEY = "notify-mine";
  const MAX_ITEMS = 40;

  function cleanNote(note) {
    if (!note || typeof note !== "object") return null;
    const id = String(note.id || "").trim();
    const title = String(note.title || "")
      .trim()
      .slice(0, 80);
    if (!id || !title) return null;
    return {
      id,
      kind: String(note.kind || "info").slice(0, 24),
      title,
      body: String(note.body || "")
        .trim()
        .slice(0, 180),
      href: String(note.href || "").slice(0, 200),
      at: Number(note.at) || 0
    };
  }

  function cleanItems(list) {
    const out = [];
    const seen = new Set();
    (Array.isArray(list) ? list : []).forEach((raw) => {
      const note = cleanNote(raw);
      if (!note || seen.has(note.id)) return;
      seen.add(note.id);
      out.push(note);
    });
    return out.sort((a, b) => b.at - a.at).slice(0, MAX_ITEMS);
  }

  function readMine(payload) {
    return {
      playerId: String(payload?.playerId || "").trim(),
      items: cleanItems(payload?.items),
      seenAt: Math.max(0, Number(payload?.seenAt) || 0),
      updatedAt: Number(payload?.updatedAt) || 0
    };
  }

  function collectMine(items, seenAt, playerId) {
    return {
      playerId: String(playerId || "").trim(),
      items: cleanItems(items),
      seenAt: Math.max(0, Number(seenAt) || 0),
      updatedAt: Date.now()
    };
  }

  function applyMine(localItems, localSeenAt, mine) {
    const owned = readMine(mine);
    const current = cleanItems(localItems);
    if (current.length) {
      return { items: current, seenAt: Math.max(0, Number(localSeenAt) || 0) };
    }
    return {
      items: owned.items,
      seenAt: Math.max(0, Number(localSeenAt) || 0, owned.seenAt)
    };
  }

  const api = {
    SAVE_KEY,
    cleanNote,
    readMine,
    collectMine,
    applyMine
  };
  if (root) root.HubNotificationsMine = api;
  if (typeof module === "object" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : typeof globalThis !== "undefined" ? globalThis : null);
