/**
 * Paper Claim online protocol helpers.
 * Host publishes the room snapshot; guests write only their own input doc.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.PaperClaimNet = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  const HOST_PUBLISH_MS = 250;
  const GUEST_INPUT_MS = 250;
  const HOST_STALE_MS = 15_000;
  const FULL_GRID_MS = 4_000;
  const INPUT_HEARTBEAT_MS = 1_000;

  function roomDocId(code) {
    return "paper-io-room-" + String(code || "").toUpperCase();
  }

  function inputDocId(code, playerId) {
    const safe = String(playerId || "")
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, "")
      .slice(0, 80);
    return `paper-io-input-${String(code || "").toUpperCase()}-${safe}`;
  }

  function quantizeAngle(rad) {
    return Math.round(Number(rad) * 1000) / 1000;
  }

  function shouldPublish(now, lastAt, minMs) {
    return !lastAt || now - lastAt >= minMs;
  }

  function shouldIncludeGrid(now, lastGridAt, landDirty) {
    return !!landDirty || !lastGridAt || now - lastGridAt >= FULL_GRID_MS;
  }

  function nextVersion(prev) {
    return (Number(prev) || 0) + 1;
  }

  function acceptSnap(appliedVersion, snap) {
    if (!snap || typeof snap !== "object") return false;
    const incoming = Number(snap.v);
    if (!Number.isFinite(incoming) || incoming <= 0) return !appliedVersion;
    return incoming >= (Number(appliedVersion) || 0);
  }

  function hostIsStale(now, snapT) {
    const t = Number(snapT) || 0;
    if (!t) return false;
    return now - t > HOST_STALE_MS;
  }

  function inputChanged(prevAngle, nextAngle) {
    return quantizeAngle(prevAngle) !== quantizeAngle(nextAngle);
  }

  function shouldWriteInput(now, lastWriteAt, prevAngle, nextAngle) {
    if (inputChanged(prevAngle, nextAngle)) {
      return shouldPublish(now, lastWriteAt, GUEST_INPUT_MS);
    }
    return shouldPublish(now, lastWriteAt, INPUT_HEARTBEAT_MS);
  }

  return {
    HOST_PUBLISH_MS,
    GUEST_INPUT_MS,
    HOST_STALE_MS,
    FULL_GRID_MS,
    INPUT_HEARTBEAT_MS,
    roomDocId,
    inputDocId,
    quantizeAngle,
    shouldPublish,
    shouldIncludeGrid,
    nextVersion,
    acceptSnap,
    hostIsStale,
    inputChanged,
    shouldWriteInput
  };
});
