/**
 * Overlay helper for signed-in hub admin broadcasts (announce / maintenance / bans / grants).
 * DELETE does not shrink a richer local board.
 */
(function (root) {
  const DOC_IDS = [
    "hub-admin-announce",
    "hub-admin-maintenance",
    "hub-admin-moderation",
    "hub-admin-grants"
  ];

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

  function copyDocs(hub) {
    if (hub && typeof hub === "object" && !Array.isArray(hub) && hub.docs && typeof hub.docs === "object") {
      return { ...hub.docs };
    }
    if (hub && typeof hub === "object" && !Array.isArray(hub)) return { ...hub };
    return {};
  }

  function applyChange(hub, change) {
    const docs = copyDocs(hub);
    const data = unwrapChange(change);
    const type = String(data.type || data.eventType || change?.event || "").toUpperCase();
    if (type === "DELETE") return { docs };
    const record = data.record || data.new || {};
    if (!record || typeof record !== "object") return { docs };
    const docId = String(record.doc_id || record.docId || "").trim();
    if (!DOC_IDS.includes(docId)) return { docs };
    const payload = record.data && typeof record.data === "object" ? record.data : {};
    docs[docId] = payload;
    return { docs };
  }

  const api = {
    DOC_IDS,
    applyChange
  };
  if (root) root.HubAdminBroadcasts = api;
  if (typeof module === "object" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : typeof globalThis !== "undefined" ? globalThis : null);
