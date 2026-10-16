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

  const SAVE_KEY = "calls-mine";

  /** Shared hub-calls POST is safe only when the fetch succeeded (even if rooms is empty). */
  function canPostSharedCalls(remote) {
    return !!(remote && typeof remote === "object");
  }

  function roomIncludesPlayer(room, playerId) {
    const me = String(playerId || "").trim();
    if (!me || !room || typeof room !== "object") return false;
    const peers = room.peers && typeof room.peers === "object" ? room.peers : {};
    return Object.prototype.hasOwnProperty.call(peers, me);
  }

  function mergeRooms(a, b) {
    const out = {};
    const left = a && typeof a === "object" && !Array.isArray(a) ? a : {};
    const right = b && typeof b === "object" && !Array.isArray(b) ? b : {};
    const ids = new Set([...Object.keys(left), ...Object.keys(right)]);
    ids.forEach((id) => {
      const local = left[id];
      const remote = right[id];
      if (!local && remote) {
        out[id] = remote;
        return;
      }
      if (local && !remote) {
        out[id] = local;
        return;
      }
      if (!local || !remote) return;
      const byId = new Map();
      (Array.isArray(remote.signals) ? remote.signals : []).forEach((s) => {
        if (s?.id) byId.set(s.id, s);
      });
      (Array.isArray(local.signals) ? local.signals : []).forEach((s) => {
        if (s?.id) byId.set(s.id, s);
      });
      const rLinks = remote.links && typeof remote.links === "object" ? remote.links : {};
      const lLinks = local.links && typeof local.links === "object" ? local.links : {};
      const linkKeys = new Set([...Object.keys(rLinks), ...Object.keys(lLinks)]);
      const links = {};
      linkKeys.forEach((key) => {
        const merged = mergeLink(rLinks[key], lLinks[key]);
        if (merged) links[key] = merged;
      });
      const rPeers = remote.peers && typeof remote.peers === "object" ? remote.peers : {};
      const lPeers = local.peers && typeof local.peers === "object" ? local.peers : {};
      const peerKeys = new Set([...Object.keys(rPeers), ...Object.keys(lPeers)]);
      const peers = {};
      peerKeys.forEach((key) => {
        const merged = mergePeer(rPeers[key], lPeers[key]);
        if (merged) peers[key] = merged;
      });
      out[id] = {
        ...remote,
        ...local,
        signals: [...byId.values()].sort((x, y) => (Number(x.at) || 0) - (Number(y.at) || 0)).slice(-40),
        links,
        peers,
        updatedAt: Math.max(Number(local.updatedAt) || 0, Number(remote.updatedAt) || 0)
      };
    });
    return out;
  }

  function rowsToRooms(rows) {
    let rooms = {};
    (Array.isArray(rows) ? rows : []).forEach((row) => {
      const playerId = String(row?.player_id || row?.playerId || "").trim();
      if (!playerId) return;
      const owned = {};
      Object.entries(row?.rooms && typeof row.rooms === "object" ? row.rooms : {}).forEach(
        ([id, room]) => {
          if (roomIncludesPlayer(room, playerId)) owned[id] = room;
        }
      );
      rooms = mergeRooms(rooms, owned);
    });
    return pruneRooms(rooms);
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
    const current =
      hub && hub.rooms && typeof hub.rooms === "object" && !Array.isArray(hub.rooms)
        ? hub.rooms
        : hub && typeof hub === "object" && !Array.isArray(hub) && !hub.rooms
          ? hub
          : {};
    const rooms = { ...current };
    if (type === "DELETE") return { rooms };
    const record = data.record || data.new || {};
    if (!record || typeof record !== "object") return { rooms };
    return { rooms: pruneRooms(mergeRooms(rooms, rowsToRooms([record]))) };
  }

  function collectMine(rooms, playerId) {
    const me = String(playerId || "").trim();
    const owned = {};
    Object.entries(rooms && typeof rooms === "object" ? rooms : {}).forEach(([id, room]) => {
      if (roomIncludesPlayer(room, me)) owned[id] = room;
    });
    return { playerId: me, rooms: owned, updatedAt: Date.now() };
  }

  function readMine(payload) {
    if (!payload || typeof payload !== "object") return null;
    const playerId = String(payload.playerId || "").trim();
    if (!playerId) return null;
    const rooms = payload.rooms && typeof payload.rooms === "object" ? payload.rooms : {};
    const owned = {};
    Object.entries(rooms).forEach(([id, room]) => {
      if (roomIncludesPlayer(room, playerId)) owned[id] = room;
    });
    return { playerId, rooms: owned, updatedAt: Number(payload.updatedAt) || 0 };
  }

  function applyMine(localRooms, mine, playerId) {
    const local =
      localRooms && typeof localRooms === "object" && !Array.isArray(localRooms)
        ? { ...localRooms }
        : {};
    const owned = readMine(mine);
    const me = String(playerId || owned?.playerId || "").trim();
    if (!owned || !me || owned.playerId !== me) return local;
    Object.entries(owned.rooms || {}).forEach(([id, room]) => {
      const existing = local[id];
      const existAt = Number(existing?.updatedAt) || 0;
      const mineAt = Number(room?.updatedAt) || 0;
      if (!existing || mineAt >= existAt) local[id] = room;
    });
    return local;
  }

  const api = {
    SIGNAL_TTL_MS,
    ROOM_TTL_MS,
    MAX_PEERS,
    SAVE_KEY,
    roomKey,
    linkKey,
    peerJoined,
    pruneRooms,
    mergeLink,
    mergePeer,
    canPostSharedCalls,
    collectMine,
    readMine,
    applyMine,
    mergeRooms,
    rowsToRooms,
    applyChange
  };
  if (root) root.HubCallSignal = api;
  if (typeof module === "object" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : typeof globalThis !== "undefined" ? globalThis : null);
