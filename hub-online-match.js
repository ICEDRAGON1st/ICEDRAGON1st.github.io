/**
 * hub-online-match.js — shared online rooms for turn games (TTT, Connect Four).
 *
 * window.HubOnlineMatch:
 *   quickMatch(game), cancelQuickMatch(game)
 *   createRoom(game), joinRoom(game, code), inviteFriend(game, friendId)
 *   leaveRoom(), submitState({ state, turn, result }), getRoom(), subscribe(cb)
 */
(function () {
  const NS = "icedragon1st-mygames";
  const PATH = "online-matches";
  const API = `https://mantledb.sh/v2/${NS}/${PATH}`;
  const LOCAL_KEY = "hub-online-matches-v1";
  const WAIT_TTL_MS = 90 * 1000;
  const ROOM_TTL_MS = 60 * 60 * 1000;
  const POLL_MS = 1200;
  const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

  const GAMES = {
    tictactoe: {
      label: "Tic Tac Toe",
      initialState: () => ({ board: Array(9).fill(0), winLine: null }),
      initialTurn: 1
    },
    "connect-four": {
      label: "Connect Four",
      initialState: () => ({
        grid: Array.from({ length: 6 }, () => Array(7).fill(0)),
        lastDrop: null,
        winningCells: []
      }),
      initialTurn: 1
    }
  };

  let cache = { rooms: {} };
  let activeRoomId = "";
  let pollTimer = null;
  let listeners = new Set();
  let writeQueue = Promise.resolve();

  function getPlayerId() {
    return typeof HubPlays !== "undefined" && HubPlays.getPlayerId
      ? HubPlays.getPlayerId()
      : "";
  }

  function getPlayerName() {
    if (typeof HubPlays === "undefined") return "";
    const name = HubPlays.sanitizeName
      ? HubPlays.sanitizeName(HubPlays.getName() || "")
      : String(HubPlays.getName() || "").trim();
    if (!name || /^guest-/i.test(name) || name.toLowerCase() === "player") return "";
    return name;
  }

  function makeId() {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  }

  function makeCode() {
    let code = "";
    for (let i = 0; i < 4; i++) {
      code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
    }
    return code;
  }

  function loadLocal() {
    try {
      const data = JSON.parse(localStorage.getItem(LOCAL_KEY));
      if (data?.rooms && typeof data.rooms === "object") return { rooms: data.rooms };
    } catch {}
    return { rooms: {} };
  }

  function saveLocal(data) {
    cache = { rooms: data.rooms || {} };
    try {
      localStorage.setItem(LOCAL_KEY, JSON.stringify(cache));
    } catch {}
  }

  async function fetchJson(url) {
    const res = await fetch(url, { cache: "no-store" });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error("fetch failed");
    return res.json();
  }

  async function postJson(url, data) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error("push failed");
  }

  async function fetchRemote() {
    const data = await fetchJson(API);
    if (!data || typeof data !== "object") return { rooms: {} };
    return { rooms: data.rooms && typeof data.rooms === "object" ? data.rooms : {} };
  }

  function pruneRooms(rooms) {
    const now = Date.now();
    const out = {};
    Object.entries(rooms || {}).forEach(([id, room]) => {
      if (!room) return;
      const age = now - (Number(room.updatedAt) || Number(room.createdAt) || 0);
      if (age > ROOM_TTL_MS) return;
      if (room.status === "waiting" && age > WAIT_TTL_MS) return;
      out[id] = room;
    });
    return out;
  }

  function mergeRooms(a, b) {
    const out = { ...(a || {}) };
    Object.entries(b || {}).forEach(([id, room]) => {
      if (!room) return;
      const existing = out[id];
      if (!existing || (Number(room.updatedAt) || 0) >= (Number(existing.updatedAt) || 0)) {
        out[id] = room;
      }
    });
    return pruneRooms(out);
  }

  function emit() {
    const room = getRoom();
    listeners.forEach((cb) => {
      try {
        cb(room);
      } catch {}
    });
  }

  async function mutate(updater) {
    const run = async () => {
      let remote = cache;
      try {
        remote = await fetchRemote();
      } catch {
        remote = cache;
      }
      const base = { rooms: mergeRooms(cache.rooms, remote.rooms) };
      const next = updater(base);
      if (!next) return null;
      saveLocal(next);
      try {
        await postJson(API, next);
      } catch {
        return next;
      }
      try {
        const confirmed = await fetchRemote();
        saveLocal({ rooms: mergeRooms(next.rooms, confirmed.rooms) });
      } catch {}
      emit();
      return cache;
    };
    writeQueue = writeQueue.then(run, run);
    return writeQueue;
  }

  function seat(playerId, name) {
    return { playerId, name: name || "Player" };
  }

  function emptyRoom(game, queue) {
    const meta = GAMES[game];
    if (!meta) return null;
    const now = Date.now();
    return {
      id: makeId(),
      game,
      code: makeCode(),
      queue: queue || "private",
      status: "waiting",
      state: meta.initialState(),
      turn: meta.initialTurn,
      host: null,
      guest: null,
      result: null,
      createdAt: now,
      updatedAt: now
    };
  }

  function requireIdentity() {
    const playerId = getPlayerId();
    const name = getPlayerName();
    if (!playerId || !name) {
      return { ok: false, error: "Set a username first" };
    }
    return { ok: true, playerId, name };
  }

  async function quickMatch(game) {
    if (!GAMES[game]) return { ok: false, error: "Unknown game" };
    const id = requireIdentity();
    if (!id.ok) return id;

    const joined = await mutate((data) => {
      const rooms = { ...data.rooms };
      const now = Date.now();
      const waiting = Object.values(rooms).find(
        (r) =>
          r &&
          r.game === game &&
          r.queue === "quick" &&
          r.status === "waiting" &&
          r.host?.playerId &&
          r.host.playerId !== id.playerId &&
          now - (Number(r.updatedAt) || 0) <= WAIT_TTL_MS
      );
      if (waiting) {
        rooms[waiting.id] = {
          ...waiting,
          guest: seat(id.playerId, id.name),
          status: "playing",
          updatedAt: now
        };
        activeRoomId = waiting.id;
        return { rooms };
      }
      const room = emptyRoom(game, "quick");
      room.host = seat(id.playerId, id.name);
      rooms[room.id] = room;
      activeRoomId = room.id;
      return { rooms };
    });

    if (!joined) return { ok: false, error: "Couldn't start Quick Play" };
    startPolling();
    return { ok: true, room: getRoom() };
  }

  async function cancelQuickMatch(game) {
    const id = requireIdentity();
    if (!id.ok) return id;
    const room = getRoom();
    if (!room || (game && room.game !== game)) return { ok: true };
    if (room.status !== "waiting" || room.host?.playerId !== id.playerId) {
      return leaveRoom();
    }
    await mutate((data) => {
      const rooms = { ...data.rooms };
      delete rooms[room.id];
      return { rooms };
    });
    activeRoomId = "";
    stopPolling();
    emit();
    return { ok: true };
  }

  async function createRoom(game, queue = "private") {
    if (!GAMES[game]) return { ok: false, error: "Unknown game" };
    const id = requireIdentity();
    if (!id.ok) return id;
    const created = await mutate((data) => {
      const room = emptyRoom(game, queue);
      room.host = seat(id.playerId, id.name);
      const rooms = { ...data.rooms, [room.id]: room };
      activeRoomId = room.id;
      return { rooms };
    });
    if (!created) return { ok: false, error: "Couldn't create room" };
    startPolling();
    return { ok: true, room: getRoom() };
  }

  async function joinRoom(game, code) {
    const id = requireIdentity();
    if (!id.ok) return id;
    const want = String(code || "")
      .trim()
      .toUpperCase();
    if (!want) return { ok: false, error: "Enter a room code" };

    const joined = await mutate((data) => {
      const rooms = { ...data.rooms };
      const room = Object.values(rooms).find(
        (r) =>
          r &&
          r.game === game &&
          String(r.code || "").toUpperCase() === want &&
          (r.status === "waiting" || r.status === "playing")
      );
      if (!room) return null;
      if (room.host?.playerId === id.playerId) {
        activeRoomId = room.id;
        return { rooms };
      }
      if (room.guest?.playerId && room.guest.playerId !== id.playerId) return null;
      rooms[room.id] = {
        ...room,
        guest: seat(id.playerId, id.name),
        status: "playing",
        updatedAt: Date.now()
      };
      activeRoomId = room.id;
      return { rooms };
    });

    if (!joined) return { ok: false, error: "Room not found or full" };
    startPolling();
    return { ok: true, room: getRoom() };
  }

  async function joinRoomById(roomId) {
    const id = requireIdentity();
    if (!id.ok) return id;
    const joined = await mutate((data) => {
      const rooms = { ...data.rooms };
      const room = rooms[roomId];
      if (!room) return null;
      if (room.host?.playerId === id.playerId || room.guest?.playerId === id.playerId) {
        activeRoomId = room.id;
        return { rooms };
      }
      if (room.status !== "waiting") return null;
      rooms[room.id] = {
        ...room,
        guest: seat(id.playerId, id.name),
        status: "playing",
        updatedAt: Date.now()
      };
      activeRoomId = room.id;
      return { rooms };
    });
    if (!joined) return { ok: false, error: "Couldn't join room" };
    startPolling();
    return { ok: true, room: getRoom() };
  }

  async function inviteFriend(game, friendId) {
    if (typeof HubFriends === "undefined") {
      return { ok: false, error: "Friends not loaded" };
    }
    if (!HubFriends.isFriend?.(friendId)) {
      return { ok: false, error: "Add them as a friend first" };
    }
    const created = await createRoom(game, "friend");
    if (!created.ok) return created;
    const room = created.room;
    const invited = await HubFriends.inviteToGame(friendId, {
      game,
      roomId: room.id,
      code: room.code
    });
    if (!invited.ok) return invited;
    return { ok: true, room, inviteId: invited.inviteId };
  }

  async function leaveRoom() {
    const id = requireIdentity();
    const room = getRoom();
    if (!room) {
      activeRoomId = "";
      stopPolling();
      return { ok: true };
    }
    await mutate((data) => {
      const rooms = { ...data.rooms };
      const current = rooms[room.id];
      if (!current) return { rooms };
      if (current.status === "waiting" && current.host?.playerId === id.playerId) {
        delete rooms[room.id];
        return { rooms };
      }
      rooms[room.id] = {
        ...current,
        status: "abandoned",
        result: {
          ...(current.result || {}),
          reason: "leave",
          leftBy: id.playerId
        },
        updatedAt: Date.now()
      };
      return { rooms };
    });
    activeRoomId = "";
    stopPolling();
    emit();
    return { ok: true };
  }

  async function submitState(patch = {}) {
    const id = requireIdentity();
    if (!id.ok) return id;
    const room = getRoom();
    if (!room || room.status !== "playing") {
      return { ok: false, error: "No active match" };
    }
    const amHost = room.host?.playerId === id.playerId;
    const amGuest = room.guest?.playerId === id.playerId;
    if (!amHost && !amGuest) return { ok: false, error: "Not in this room" };
    const mySeat = amHost ? 1 : 2;
    if (room.turn !== mySeat && !patch.force) {
      return { ok: false, error: "Not your turn" };
    }

    const updated = await mutate((data) => {
      const rooms = { ...data.rooms };
      const current = rooms[room.id];
      if (!current || current.status !== "playing") return null;
      if (current.turn !== mySeat && !patch.force) return null;
      const next = {
        ...current,
        state: patch.state != null ? patch.state : current.state,
        turn: patch.turn != null ? patch.turn : current.turn,
        result: patch.result != null ? patch.result : current.result,
        status: patch.result ? "finished" : current.status,
        updatedAt: Date.now()
      };
      rooms[room.id] = next;
      return { rooms };
    });

    if (!updated) return { ok: false, error: "Couldn't submit move" };
    return { ok: true, room: getRoom() };
  }

  function getRoom() {
    if (!activeRoomId) return null;
    return cache.rooms[activeRoomId] || null;
  }

  function myRole(room = getRoom()) {
    const me = getPlayerId();
    if (!room || !me) return "";
    if (room.host?.playerId === me) return "host";
    if (room.guest?.playerId === me) return "guest";
    return "";
  }

  function opponent(room = getRoom()) {
    const role = myRole(room);
    if (!room || !role) return null;
    return role === "host" ? room.guest : room.host;
  }

  function subscribe(cb) {
    listeners.add(cb);
    return () => listeners.delete(cb);
  }

  async function refresh() {
    try {
      const remote = await fetchRemote();
      saveLocal({ rooms: mergeRooms(cache.rooms, remote.rooms) });
      if (activeRoomId && !cache.rooms[activeRoomId]) activeRoomId = "";
      emit();
    } catch {}
    return getRoom();
  }

  function startPolling() {
    stopPolling();
    const tick = async () => {
      await refresh();
    };
    tick();
    pollTimer = setInterval(tick, POLL_MS);
  }

  function stopPolling() {
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = null;
  }

  cache = loadLocal();

  window.HubOnlineMatch = {
    GAMES,
    quickMatch,
    cancelQuickMatch,
    createRoom,
    joinRoom,
    joinRoomById,
    inviteFriend,
    leaveRoom,
    submitState,
    getRoom,
    myRole,
    opponent,
    subscribe,
    refresh,
    startPolling,
    stopPolling
  };
})();
