/**
 * Per-player Paper Claim rooms.
 * Host snapshots, guest seats/inputs, and the lobby overlay owned rows.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.PaperClaimRooms = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  const LOBBY_DOC = "paper-io-lobbies";
  const TABLE = "paper_room_contributions";
  const LOBBY_TTL_MS = 10 * 60 * 1000;
  const STATUS_RANK = { waiting: 1, playing: 2, closed: 3 };

  let cache = { rooms: {} };
  let tableFetched = false;
  let realtimeUnsub = null;

  function isPlayerId(raw) {
    return /^p-[a-z0-9][a-z0-9-]{6,80}$/.test(String(raw || "").trim());
  }

  function cleanCode(raw) {
    return String(raw || "")
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, 8);
  }

  function isRoomDoc(id) {
    return /^paper-io-room-[A-Z0-9]{3,8}$/i.test(String(id || ""));
  }

  function isInputDoc(id) {
    return /^paper-io-input-[A-Z0-9]{3,8}-p-[a-z0-9-]{7,80}$/i.test(String(id || ""));
  }

  function codeFromRoomDoc(id) {
    const m = String(id || "").match(/^paper-io-room-([A-Z0-9]{3,8})$/i);
    return m ? m[1].toUpperCase() : "";
  }

  function parseInputDoc(id) {
    const m = String(id || "").match(/^paper-io-input-([A-Z0-9]{3,8})-(p-[a-z0-9-]{7,80})$/i);
    if (!m) return null;
    return { code: m[1].toUpperCase(), playerId: m[2] };
  }

  function cleanSeat(seat) {
    if (!seat || typeof seat !== "object") return null;
    return {
      name:
        String(seat.name || "Player")
          .replace(/[<>&"'`]/g, "")
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 16) || "Player",
      color: Number(seat.color) || 0,
      joinedAt: Number(seat.joinedAt) || 0
    };
  }

  function cleanAngle(raw) {
    if (typeof raw === "number" && Number.isFinite(raw)) return raw;
    if (raw && typeof raw === "object" && typeof raw.angle === "number" && Number.isFinite(raw.angle)) {
      return raw.angle;
    }
    return null;
  }

  function cleanRoom(raw, fallbackCode) {
    if (!raw || typeof raw !== "object") return null;
    const code = cleanCode(raw.code || fallbackCode);
    if (code.length < 3) return null;
    const status = String(raw.status || "waiting");
    if (status !== "waiting" && status !== "playing" && status !== "closed") return null;
    const seats = {};
    Object.entries(raw.seats && typeof raw.seats === "object" ? raw.seats : {}).forEach(([id, seat]) => {
      if (Object.keys(seats).length >= 12) return;
      if (!isPlayerId(id)) return;
      const cleaned = cleanSeat(seat);
      if (cleaned) seats[id] = cleaned;
    });
    const inputs = {};
    Object.entries(raw.inputs && typeof raw.inputs === "object" ? raw.inputs : {}).forEach(([id, ang]) => {
      if (Object.keys(inputs).length >= 12) return;
      if (!isPlayerId(id)) return;
      const cleaned = cleanAngle(ang);
      if (cleaned != null) inputs[id] = cleaned;
    });
    const snap = raw.snap && typeof raw.snap === "object" && !Array.isArray(raw.snap) ? raw.snap : null;
    return {
      code,
      hostId: isPlayerId(raw.hostId) ? String(raw.hostId).trim() : "",
      status,
      createdAt: Number(raw.createdAt) || 0,
      updatedAt: Number(raw.updatedAt) || Number(raw.createdAt) || 0,
      seats,
      inputs,
      snap
    };
  }

  function involvesMe(room, playerId) {
    const me = String(playerId || "").trim();
    if (!me || !room) return false;
    return room.hostId === me || !!(room.seats && room.seats[me]);
  }

  function mergeSeats(a, b) {
    const out = { ...(a || {}) };
    Object.entries(b || {}).forEach(([id, seat]) => {
      const existing = out[id];
      if (!existing || (Number(seat.joinedAt) || 0) >= (Number(existing.joinedAt) || 0)) {
        out[id] = seat;
      }
    });
    return out;
  }

  function mergeRoom(a, b, contributorId) {
    if (!b) return a || null;
    const contributor = String(contributorId || "").trim();
    if (!a) {
      return {
        ...b,
        snap: contributor && contributor === b.hostId ? b.snap : null
      };
    }
    const hostId = a.hostId || b.hostId;
    const fromHost = contributor && hostId && contributor === hostId;
    const aRank = STATUS_RANK[a.status] || 0;
    const bRank = STATUS_RANK[b.status] || 0;
    const status = fromHost ? (bRank >= aRank ? b.status : a.status) : a.status || b.status;
    const av = Number(a.snap?.v) || 0;
    const bv = fromHost && b.snap ? Number(b.snap.v) || 0 : -1;
    const snap = bv >= av && fromHost ? b.snap : a.snap;
    const createdAt = Math.min(
      Number(a.createdAt) || Number.POSITIVE_INFINITY,
      Number(b.createdAt) || Number.POSITIVE_INFINITY
    );
    return {
      code: a.code || b.code,
      hostId,
      status,
      createdAt: Number.isFinite(createdAt) ? createdAt : Number(a.createdAt || b.createdAt) || 0,
      updatedAt: Math.max(Number(a.updatedAt) || 0, Number(b.updatedAt) || 0),
      seats: mergeSeats(a.seats, b.seats),
      inputs: { ...(a.inputs || {}), ...(b.inputs || {}) },
      snap: snap || null
    };
  }

  function collectMine(rooms, playerId) {
    const me = String(playerId || "").trim();
    const out = {};
    Object.entries(rooms && typeof rooms === "object" ? rooms : {}).forEach(([code, raw]) => {
      if (Object.keys(out).length >= 8) return;
      const room = cleanRoom(raw, code);
      if (!room || !involvesMe(room, me)) return;
      if (room.hostId !== me) {
        out[room.code] = {
          ...room,
          snap: null,
          seats: room.seats[me] ? { [me]: room.seats[me] } : {},
          inputs: room.inputs[me] != null ? { [me]: room.inputs[me] } : {}
        };
        return;
      }
      out[room.code] = room;
    });
    return { playerId: me, rooms: out, updatedAt: Date.now() };
  }

  function overlayPaperRooms(hub, rows) {
    let rooms = { ...((hub && hub.rooms) || {}) };
    (Array.isArray(rows) ? rows : []).forEach((row) => {
      const pid = String(row?.player_id || row?.playerId || "").trim();
      if (!isPlayerId(pid)) return;
      const owned = row?.rooms && typeof row.rooms === "object" ? row.rooms : {};
      Object.entries(owned).forEach(([code, raw]) => {
        const room = cleanRoom(raw, code);
        if (!room) return;
        rooms[room.code] = mergeRoom(rooms[room.code], room, pid);
      });
    });
    return { rooms };
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
    const current = { rooms: { ...((hub && hub.rooms) || {}) } };
    if (type === "DELETE") return current;
    const record = data.record || data.new || {};
    if (!record || typeof record !== "object") return current;
    return overlayPaperRooms(current, [record]);
  }

  function toLobby(hub, now = Date.now()) {
    const rooms = {};
    Object.entries((hub && hub.rooms) || {}).forEach(([code, room]) => {
      if (!room || room.status === "closed") return;
      if (now - (Number(room.updatedAt) || 0) > LOBBY_TTL_MS) return;
      rooms[code] = {
        code: room.code || code,
        hostId: room.hostId || "",
        status: room.status,
        updatedAt: Number(room.updatedAt) || 0
      };
    });
    return { rooms };
  }

  function peekRoom(code) {
    const key = cleanCode(code);
    return cache.rooms[key] || null;
  }

  function peekDoc(id) {
    if (id === LOBBY_DOC) {
      const lobby = toLobby(cache);
      if (Object.keys(lobby.rooms).length) return lobby;
      return null;
    }
    if (isRoomDoc(id)) return peekRoom(codeFromRoomDoc(id));
    if (isInputDoc(id)) {
      const parsed = parseInputDoc(id);
      if (!parsed) return null;
      const room = peekRoom(parsed.code);
      const angle = room?.inputs?.[parsed.playerId];
      if (typeof angle !== "number") return null;
      return {
        room: parsed.code,
        playerId: parsed.playerId,
        angle,
        t: Number(room.updatedAt) || 0
      };
    }
    return null;
  }

  function liveJoined() {
    return !!window.HubSupabase?.isRealtimeJoined?.(TABLE);
  }

  async function hydrate() {
    const api = typeof window !== "undefined" ? window.HubSupabase : null;
    if (liveJoined()) return cache;
    if (!api?.listPaperRoomContributions) return null;
    try {
      const rows = await api.listPaperRoomContributions();
      if (rows == null) return null;
      tableFetched = true;
      cache = overlayPaperRooms(cache, rows);
      return cache;
    } catch {
      return null;
    }
  }

  function remember(id, data) {
    if (id === LOBBY_DOC) {
      Object.entries(data?.rooms && typeof data.rooms === "object" ? data.rooms : {}).forEach(
        ([code, raw]) => {
          const room = cleanRoom(raw, code);
          if (room) cache.rooms[room.code] = mergeRoom(cache.rooms[room.code], room, myPlayerId());
        }
      );
      return;
    }
    if (isRoomDoc(id)) {
      const code = codeFromRoomDoc(id);
      const room = cleanRoom({ ...(data || {}), code }, code);
      if (room) cache.rooms[code] = mergeRoom(cache.rooms[code], room, myPlayerId());
      return;
    }
    if (isInputDoc(id)) {
      const parsed = parseInputDoc(id);
      if (!parsed) return;
      const angle = cleanAngle(data);
      const prev = peekRoom(parsed.code) || {
        code: parsed.code,
        hostId: "",
        status: "playing",
        createdAt: Date.now(),
        updatedAt: Date.now(),
        seats: {},
        inputs: {},
        snap: null
      };
      if (isPlayerId(parsed.playerId) && angle != null) {
        prev.inputs = { ...(prev.inputs || {}), [parsed.playerId]: angle };
        prev.updatedAt = Number(data?.t) || Date.now();
        cache.rooms[parsed.code] = prev;
      }
    }
  }

  function myPlayerId() {
    if (typeof window !== "undefined" && window.HubPlays?.getPlayerId) {
      return String(window.HubPlays.getPlayerId() || "").trim();
    }
    return "";
  }

  async function persistMine() {
    const api = typeof window !== "undefined" ? window.HubSupabase : null;
    const me = myPlayerId();
    if (!api?.upsertPaperRoomContribution || !isPlayerId(me)) return false;
    const mine = collectMine(cache.rooms, me);
    try {
      await api.upsertPaperRoomContribution({ playerId: me, rooms: mine.rooms });
      return true;
    } catch {
      return false;
    }
  }

  async function readDoc(id) {
    const overlay = await hydrate();
    if (!overlay && !tableFetched && !liveJoined()) return undefined;
    const hit = peekDoc(id);
    if (hit) return hit;
    if (tableFetched || liveJoined()) return null;
    return undefined;
  }

  async function writeDoc(id, data) {
    remember(id, data);
    const wrote = await persistMine();
    if (wrote) tableFetched = true;
    return wrote;
  }

  function ensureRealtime() {
    const api = typeof window !== "undefined" ? window.HubSupabase : null;
    if (realtimeUnsub || !api?.subscribePaperRoomContributions) return;
    realtimeUnsub = api.subscribePaperRoomContributions((change) => {
      cache = applyChange(cache, change);
      tableFetched = true;
    });
  }

  function stopRealtime() {
    if (typeof realtimeUnsub === "function") realtimeUnsub();
    realtimeUnsub = null;
  }

  return {
    LOBBY_DOC,
    TABLE,
    isPlayerId,
    isRoomDoc,
    isInputDoc,
    codeFromRoomDoc,
    parseInputDoc,
    cleanRoom,
    involvesMe,
    mergeRoom,
    collectMine,
    overlayPaperRooms,
    applyChange,
    toLobby,
    peekDoc,
    readDoc,
    writeDoc,
    ensureRealtime,
    stopRealtime
  };
});
