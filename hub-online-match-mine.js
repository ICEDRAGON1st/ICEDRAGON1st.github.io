/**
 * Per-player online match rooms.
 * Shared online-matches stay on hub_docs; this row is auth-owned player_saves.
 */
(function (root) {
  const SAVE_KEY = "match-mine";
  const WAIT_TTL_MS = 3 * 60 * 1000;
  const ROOM_TTL_MS = 60 * 60 * 1000;
  const GAMES = new Set(["tictactoe", "connect-four"]);

  function cleanSeat(seat) {
    if (!seat || typeof seat !== "object") return null;
    const playerId = String(seat.playerId || "").trim();
    if (!playerId) return null;
    return {
      playerId,
      name:
        String(seat.name || "Player")
          .trim()
          .slice(0, 16) || "Player"
    };
  }

  function cleanState(game, state) {
    if (!state || typeof state !== "object") return null;
    if (game === "tictactoe") {
      const src = Array.isArray(state.board) ? state.board : [];
      const board = Array.from({ length: 9 }, (_, i) =>
        src[i] === 1 || src[i] === 2 ? src[i] : 0
      );
      const winLine = Array.isArray(state.winLine)
        ? state.winLine
            .map(Number)
            .filter((n) => n >= 0 && n < 9)
            .slice(0, 3)
        : null;
      return { board, winLine: winLine && winLine.length ? winLine : null };
    }
    if (game === "connect-four") {
      const src = Array.isArray(state.grid) ? state.grid : [];
      const grid = Array.from({ length: 6 }, (_, r) => {
        const row = Array.isArray(src[r]) ? src[r] : [];
        return Array.from({ length: 7 }, (_, c) => (row[c] === 1 || row[c] === 2 ? row[c] : 0));
      });
      const lastDrop =
        state.lastDrop && typeof state.lastDrop === "object"
          ? { row: Number(state.lastDrop.row) || 0, col: Number(state.lastDrop.col) || 0 }
          : null;
      const winningCells = Array.isArray(state.winningCells)
        ? state.winningCells
            .filter((cell) => cell && typeof cell === "object")
            .slice(0, 16)
            .map((cell) => ({ row: Number(cell.row) || 0, col: Number(cell.col) || 0 }))
        : [];
      return { grid, lastDrop, winningCells };
    }
    return null;
  }

  function cleanResult(result) {
    if (result == null) return null;
    if (typeof result === "string") return result.slice(0, 32);
    if (typeof result !== "object") return null;
    const out = {};
    if (result.winner === 1 || result.winner === 2 || result.winner === 0)
      out.winner = result.winner;
    if (result.draw) out.draw = true;
    if (result.reason) out.reason = String(result.reason).slice(0, 32);
    return Object.keys(out).length ? out : null;
  }

  function involvesMe(room, playerId) {
    const me = String(playerId || "").trim();
    if (!me || !room) return false;
    return room.host?.playerId === me || room.guest?.playerId === me;
  }

  function isFresh(room, now = Date.now()) {
    const age = now - (Number(room?.updatedAt) || Number(room?.createdAt) || 0);
    if (age > ROOM_TTL_MS) return false;
    if (room?.status === "waiting" && age > WAIT_TTL_MS) return false;
    return true;
  }

  function cleanRoom(raw, now = Date.now()) {
    if (!raw || typeof raw !== "object") return null;
    const id = String(raw.id || "").trim();
    const game = String(raw.game || "").trim();
    if (!id || !GAMES.has(game)) return null;
    const host = cleanSeat(raw.host);
    if (!host) return null;
    const state = cleanState(game, raw.state);
    if (!state) return null;
    const status = String(raw.status || "waiting");
    if (status !== "waiting" && status !== "playing" && status !== "finished") return null;
    const room = {
      id,
      game,
      code: String(raw.code || "")
        .trim()
        .slice(0, 8),
      queue: raw.queue === "quick" ? "quick" : "private",
      status,
      state,
      turn: raw.turn === 2 ? 2 : 1,
      host,
      guest: cleanSeat(raw.guest),
      result: cleanResult(raw.result),
      createdAt: Number(raw.createdAt) || now,
      updatedAt: Number(raw.updatedAt) || Number(raw.createdAt) || now
    };
    if (!isFresh(room, now)) return null;
    return room;
  }

  function myRooms(rooms, playerId) {
    const out = {};
    Object.entries(rooms && typeof rooms === "object" ? rooms : {}).forEach(([id, raw]) => {
      const room = cleanRoom({ ...(raw || {}), id: raw?.id || id });
      if (room && involvesMe(room, playerId)) out[room.id] = room;
    });
    return out;
  }

  function readMine(payload) {
    return {
      playerId: String(payload?.playerId || "").trim(),
      rooms: myRooms(payload?.rooms, payload?.playerId),
      updatedAt: Number(payload?.updatedAt) || 0
    };
  }

  function collectMine(data, playerId) {
    const me = String(playerId || "").trim();
    return {
      playerId: me,
      rooms: myRooms(data && data.rooms, me),
      updatedAt: Date.now()
    };
  }

  function applyMine(data, mine, playerId) {
    const me = String(playerId || mine?.playerId || "").trim();
    const owned = readMine(mine);
    const next = { rooms: { ...((data && data.rooms) || {}) } };
    if (me && owned.playerId && owned.playerId !== me) return next;
    if (Object.keys(myRooms(next.rooms, me || owned.playerId)).length) return next;
    Object.entries(owned.rooms || {}).forEach(([id, room]) => {
      if (!next.rooms[id] && involvesMe(room, me || owned.playerId)) next.rooms[id] = room;
    });
    return next;
  }

  function mergeOwnedRooms(a, b) {
    const out = { ...(a || {}) };
    Object.entries(b || {}).forEach(([id, room]) => {
      if (!room) return;
      const existing = out[id];
      if (!existing || (Number(room.updatedAt) || 0) >= (Number(existing.updatedAt) || 0)) {
        out[id] = room;
      }
    });
    return out;
  }

  function overlayMatchRooms(hub, rows) {
    let rooms = { ...((hub && hub.rooms) || {}) };
    (Array.isArray(rows) ? rows : []).forEach((row) => {
      const owned = readMine({
        playerId: row?.player_id || row?.playerId,
        rooms: row?.rooms,
        updatedAt: Date.parse(row?.updated_at || "") || Number(row?.updatedAt) || 0
      });
      if (!owned.playerId) return;
      rooms = mergeOwnedRooms(rooms, owned.rooms);
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
    const current = {
      rooms: { ...((hub && hub.rooms) || {}) }
    };
    if (type === "DELETE") return current;
    const record = data.record || data.new || {};
    if (!record || typeof record !== "object") return current;
    return overlayMatchRooms(current, [record]);
  }

  const api = {
    SAVE_KEY,
    involvesMe,
    isFresh,
    cleanRoom,
    myRooms,
    readMine,
    collectMine,
    applyMine,
    overlayMatchRooms,
    applyChange
  };
  if (root) root.HubOnlineMatchMine = api;
  if (typeof module === "object" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : typeof globalThis !== "undefined" ? globalThis : null);
