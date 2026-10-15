/**
 * Voice-call signaling helpers (rooms, peer merge, SDP links).
 * UI and WebRTC stay in hub-calls.js.
 */
(function (root) {
  const SIGNAL_TTL_MS = 90_000;
  const ROOM_TTL_MS = 2 * 60 * 60_000;
  const MAX_PEERS = 6;

  function roomKey(kind, channelId, me) {
    if (kind === "group") return `group:${channelId}`;
    const a = String(me || "");
    const b = String(channelId || "");
    return `dm:${[a, b].sort().join(":")}`;
  }

  function linkKey(a, b) {
    return [String(a), String(b)].sort().join(":");
  }

  function peerJoined(peer) {
    return !!(peer && !peer.left && Number(peer.joinedAt) > 0);
  }

  function pruneRooms(rooms, now) {
    const atNow = Number(now) || Date.now();
    const next = {};
    Object.entries(rooms || {}).forEach(([id, room]) => {
      if (!room || typeof room !== "object") return;
      const at = Number(room.updatedAt || room.createdAt) || 0;
      if (atNow - at > ROOM_TTL_MS) return;
      const peers = room.peers && typeof room.peers === "object" ? { ...room.peers } : {};
      const live = Object.values(peers).filter((peer) => peer && !peer.left);
      if (!live.length && atNow - at > 60_000) return;
      const signals = Array.isArray(room.signals)
        ? room.signals.filter((signal) => atNow - (Number(signal?.at) || 0) < SIGNAL_TTL_MS).slice(-40)
        : [];
      const links = room.links && typeof room.links === "object" ? { ...room.links } : {};
      Object.keys(links).forEach((key) => {
        const link = links[key];
        const lat = Math.max(Number(link?.offerAt) || 0, Number(link?.answerAt) || 0);
        if (atNow - lat > SIGNAL_TTL_MS) delete links[key];
      });
      next[id] = { ...room, peers, signals, links };
    });
    return next;
  }

  function mergeLink(a, b) {
    if (!a) return b || null;
    if (!b) return a;
    const offerAt = Math.max(Number(a.offerAt) || 0, Number(b.offerAt) || 0);
    const newerOffer = (Number(b.offerAt) || 0) >= (Number(a.offerAt) || 0) ? b : a;
    let answer = null;
    let answerAt = 0;
    [a, b].forEach((link) => {
      if (link.answer && Number(link.answerFor || link.offerAt) === offerAt) {
        if ((Number(link.answerAt) || 0) >= answerAt) {
          answer = link.answer;
          answerAt = Number(link.answerAt) || 0;
        }
      }
    });
    return {
      offerFrom: newerOffer.offerFrom,
      offer: newerOffer.offer,
      offerAt,
      answer,
      answerAt: answer ? answerAt : 0,
      answerFor: answer ? offerAt : 0
    };
  }

  function mergePeer(a, b) {
    if (!a) return b || null;
    if (!b) return a;
    const aJoined = Number(a.joinedAt) || 0;
    const bJoined = Number(b.joinedAt) || 0;
    const aLeftAt = Number(a.leftAt) || (a.left ? aJoined || 1 : 0);
    const bLeftAt = Number(b.leftAt) || (b.left ? bJoined || 1 : 0);
    const leftAt = Math.max(aLeftAt, bLeftAt);

    if (a.left && aLeftAt >= bJoined) {
      return {
        ...b,
        ...a,
        left: true,
        ringing: false,
        sharing: false,
        leftAt: Math.max(aLeftAt, bLeftAt)
      };
    }
    if (b.left && bLeftAt >= aJoined) {
      return {
        ...a,
        ...b,
        left: true,
        ringing: false,
        sharing: false,
        leftAt: Math.max(aLeftAt, bLeftAt)
      };
    }
    if (leftAt > 0 && leftAt >= Math.max(aJoined, bJoined)) {
      const newerLeft = bLeftAt >= aLeftAt ? b : a;
      const other = newerLeft === b ? a : b;
      return {
        ...other,
        ...newerLeft,
        left: true,
        ringing: false,
        sharing: false,
        leftAt
      };
    }

    const aLive = !a.left && aJoined > 0;
    const bLive = !b.left && bJoined > 0;
    if (aLive && !bLive) return { ...b, ...a, left: false, ringing: false, leftAt: 0 };
    if (bLive && !aLive) return { ...a, ...b, left: false, ringing: false, leftAt: 0 };
    if (aLive && bLive) {
      const newer = bJoined >= aJoined ? b : a;
      const older = newer === b ? a : b;
      return {
        ...older,
        ...newer,
        left: false,
        ringing: false,
        leftAt: 0,
        sharing: !!(a.sharing || b.sharing),
        name: newer.name || older.name
      };
    }
    const newer = bJoined >= aJoined ? b : a;
    const older = newer === b ? a : b;
    return { ...older, ...newer };
  }

  const api = {
    SIGNAL_TTL_MS,
    ROOM_TTL_MS,
    MAX_PEERS,
    roomKey,
    linkKey,
    peerJoined,
    pruneRooms,
    mergeLink,
    mergePeer
  };
  if (root) root.HubCallSignal = api;
  if (typeof module === "object" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : typeof globalThis !== "undefined" ? globalThis : null);
