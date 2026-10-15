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
  const SNAP_BLEND_MS = 250;
  const HARD_SNAP_RADIUS = 4;

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

  function shortestAngleDiff(from, to) {
    let d = Number(to) - Number(from);
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return d;
  }

  function lerp(a, b, t) {
    return Number(a) + (Number(b) - Number(a)) * t;
  }

  function lerpAngle(from, to, t) {
    return Number(from) + shortestAngleDiff(from, to) * t;
  }

  function poseDistance(a, b) {
    return Math.hypot(
      (Number(b?.x) || 0) - (Number(a?.x) || 0),
      (Number(b?.y) || 0) - (Number(a?.y) || 0)
    );
  }

  function shouldHardSnap(from, to) {
    return poseDistance(from, to) > HARD_SNAP_RADIUS;
  }

  function startInterp(from, to, now) {
    return {
      fromX: Number(from?.x) || 0,
      fromY: Number(from?.y) || 0,
      fromAngle: Number(from?.angle) || 0,
      toX: Number(to?.x) || 0,
      toY: Number(to?.y) || 0,
      toAngle: Number(to?.angle) || 0,
      at: Number(now) || 0
    };
  }

  function sampleInterp(interp, now, spanMs = SNAP_BLEND_MS) {
    if (!interp) return null;
    const t = Math.max(
      0,
      Math.min(1, (Number(now) - Number(interp.at || 0)) / (spanMs || SNAP_BLEND_MS))
    );
    return {
      x: lerp(interp.fromX, interp.toX, t),
      y: lerp(interp.fromY, interp.toY, t),
      angle: lerpAngle(interp.fromAngle, interp.toAngle, t),
      t
    };
  }

  return {
    HOST_PUBLISH_MS,
    GUEST_INPUT_MS,
    HOST_STALE_MS,
    FULL_GRID_MS,
    INPUT_HEARTBEAT_MS,
    SNAP_BLEND_MS,
    HARD_SNAP_RADIUS,
    roomDocId,
    inputDocId,
    quantizeAngle,
    shouldPublish,
    shouldIncludeGrid,
    nextVersion,
    acceptSnap,
    hostIsStale,
    inputChanged,
    shouldWriteInput,
    shortestAngleDiff,
    lerp,
    lerpAngle,
    poseDistance,
    shouldHardSnap,
    startInterp,
    sampleInterp
  };
});
