/**
 * Per-player invite status (count, INVITER unlock, credited).
 * Shared hub-referrals-v1 stays on hub_docs; this row is auth-owned player_saves.
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

  const api = {
    SAVE_KEY,
    NEED,
    cleanCode,
    readMine,
    collectMine,
    applyMine
  };
  if (root) root.HubReferralsMine = api;
  if (typeof module === "object" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : typeof globalThis !== "undefined" ? globalThis : null);
