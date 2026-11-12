/**
 * Per-player invite status (count, INVITER unlock, credited).
 * Invite credits stay on the signed-in account; this row is auth-owned player_saves.
 */
(function (root) {
  const SAVE_KEY = "invite-mine";
  const NEED = 3;

  function cleanCode(raw) {
    return String(raw || "")
      .toUpperCase()
      .replace(/[^23456789ABCDEFGHJKLMNPQRSTUVWXYZ]/g, "")
      .slice(0, 8);
  }

  function readMine(payload) {
    const count = Math.max(0, Math.floor(Number(payload?.count) || 0));
    const unlocked = !!payload?.unlocked || count >= NEED;
    return {
      playerId: String(payload?.playerId || "").trim(),
      count,
      unlocked,
      credited: !!payload?.credited,
      updatedAt: Number(payload?.updatedAt) || 0
    };
  }

  function collectMine(status, playerId) {
    const count = Math.max(0, Math.floor(Number(status?.count) || 0));
    return {
      playerId: String(playerId || "").trim(),
      count,
      unlocked: !!status?.unlocked || count >= NEED,
      credited: !!status?.credited,
      updatedAt: Date.now()
    };
  }

  function applyMine(local, mine) {
    const owned = readMine(mine);
    const localCount = Math.max(0, Math.floor(Number(local?.count) || 0));
    const count = Math.max(localCount, owned.count);
    return {
      count,
      unlocked: !!local?.unlocked || owned.unlocked || count >= NEED,
      credited: !!local?.credited || owned.credited
    };
  }

  function emptyDoc() {
    return { byInviter: {}, byInvitee: {} };
  }

  function copyDoc(hub) {
    const byInviter = {};
    Object.entries(
      hub && hub.byInviter && typeof hub.byInviter === "object" ? hub.byInviter : {}
    ).forEach(([id, row]) => {
      const inviterId = String(id || "").trim();
      if (!inviterId || !row || typeof row !== "object") return;
      const invitees = {};
      Object.entries(row.invitees && typeof row.invitees === "object" ? row.invitees : {}).forEach(
        ([inviteeId, info]) => {
          const kid = String(inviteeId || "").trim();
          if (!kid || !info || typeof info !== "object") return;
          invitees[kid] = {
            name: String(info.name || "")
              .trim()
              .slice(0, 16),
            code: cleanCode(info.code),
            at: Number(info.at) || 0
          };
        }
      );
      byInviter[inviterId] = {
        invitees,
        unlockedAt: Number(row.unlockedAt) || 0
      };
    });
    const byInvitee = {};
    Object.entries(
      hub && hub.byInvitee && typeof hub.byInvitee === "object" ? hub.byInvitee : {}
    ).forEach(([id, row]) => {
      const inviteeId = String(id || "").trim();
      if (!inviteeId || !row || typeof row !== "object") return;
      const inviterId = String(row.inviterId || "").trim();
      if (!inviterId) return;
      byInvitee[inviteeId] = {
        inviterId,
        inviterCode: cleanCode(row.inviterCode || row.code),
        at: Number(row.at) || 0
      };
    });
    return { byInviter, byInvitee };
  }

  function readCredit(raw) {
    const inviteeId = String(raw?.player_id || raw?.playerId || raw?.inviteeId || "").trim();
    const inviterId = String(raw?.inviter_id || raw?.inviterId || "").trim();
    if (!inviteeId || !inviterId || inviteeId === inviterId) return null;
    const at =
      Date.parse(raw?.credited_at || raw?.creditedAt || "") ||
      Number(raw?.at) ||
      Number(raw?.creditedAt) ||
      0;
    return {
      inviteeId,
      inviterId,
      inviterCode: cleanCode(raw?.inviter_code || raw?.inviterCode || raw?.code),
      inviteeName: String(raw?.invitee_name || raw?.inviteeName || raw?.name || "")
        .trim()
        .slice(0, 16),
      at
    };
  }

  function applyInviteeCredit(hub, credit) {
    const doc = copyDoc(hub);
    if (!credit || !credit.inviteeId || !credit.inviterId) return doc;
    if (doc.byInvitee[credit.inviteeId]) return doc;
    doc.byInvitee[credit.inviteeId] = {
      inviterId: credit.inviterId,
      inviterCode: credit.inviterCode,
      at: credit.at
    };
    if (!doc.byInviter[credit.inviterId] || typeof doc.byInviter[credit.inviterId] !== "object") {
      doc.byInviter[credit.inviterId] = { invitees: {}, unlockedAt: 0 };
    }
    if (
      !doc.byInviter[credit.inviterId].invitees ||
      typeof doc.byInviter[credit.inviterId].invitees !== "object"
    ) {
      doc.byInviter[credit.inviterId].invitees = {};
    }
    doc.byInviter[credit.inviterId].invitees[credit.inviteeId] = {
      name: credit.inviteeName,
      code: credit.inviterCode,
      at: credit.at
    };
    const count = Object.keys(doc.byInviter[credit.inviterId].invitees).length;
    if (count >= NEED && !doc.byInviter[credit.inviterId].unlockedAt) {
      doc.byInviter[credit.inviterId].unlockedAt = credit.at || Date.now();
    }
    return doc;
  }

  function overlayReferralDoc(hub, rows) {
    let next = copyDoc(hub);
    (Array.isArray(rows) ? rows : []).forEach((row) => {
      const credit = readCredit(row);
      if (credit) next = applyInviteeCredit(next, credit);
    });
    return next;
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
    const current = copyDoc(hub);
    const data = unwrapChange(change);
    const type = String(data.type || data.eventType || change?.event || "").toUpperCase();
    if (type === "DELETE") return current;
    const record = data.record || data.new || {};
    const credit = readCredit(record);
    if (!credit) return current;
    return applyInviteeCredit(current, credit);
  }

  const api = {
    SAVE_KEY,
    NEED,
    cleanCode,
    readMine,
    collectMine,
    applyMine,
    emptyDoc,
    copyDoc,
    readCredit,
    overlayReferralDoc,
    applyChange
  };
  if (root) root.HubReferralsMine = api;
  if (typeof module === "object" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : typeof globalThis !== "undefined" ? globalThis : null);
