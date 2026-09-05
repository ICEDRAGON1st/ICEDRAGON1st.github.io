/**
 * hub-friends.js — friend requests + game invites via MantleDB.
 *
 * window.HubFriends:
 *   sendRequest(username), acceptRequest(id), declineRequest(id), removeFriend(id)
 *   getFriends(), getIncoming(), getOutgoing()
 *   inviteToGame(friendId, { game, roomId, code }), getInvites(), respondInvite(id, accept)
 *   sync(), startPolling(), stopPolling()
 */
(function () {
  const NS = "icedragon1st-mygames";
  const PATH = "friends";
  const API = `https://mantledb.sh/v2/${NS}/${PATH}`;
  const LOCAL_KEY = "hub-friends-v1";
  const INVITE_TTL_MS = 5 * 60 * 1000;
  const POLL_MS = 4000;

  let cache = { profiles: {}, invites: {} };
  let syncing = false;
  let pollTimer = null;
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

  function nameKey(name) {
    return String(name || "")
      .trim()
      .toLowerCase()
      .slice(0, 16);
  }

  function makeId() {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function loadLocal() {
    try {
      const data = JSON.parse(localStorage.getItem(LOCAL_KEY));
      if (data && typeof data === "object") {
        return {
          profiles: data.profiles && typeof data.profiles === "object" ? data.profiles : {},
          invites: data.invites && typeof data.invites === "object" ? data.invites : {}
        };
      }
    } catch {}
    return { profiles: {}, invites: {} };
  }

  function saveLocal(data) {
    cache = {
      profiles: data.profiles || {},
      invites: data.invites || {}
    };
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
    if (!data || typeof data !== "object") return { profiles: {}, invites: {} };
    return {
      profiles: data.profiles && typeof data.profiles === "object" ? data.profiles : {},
      invites: data.invites && typeof data.invites === "object" ? data.invites : {}
    };
  }

  function ensureProfile(profiles, playerId, name) {
    const next = { ...profiles };
    const existing = next[playerId] || {};
    next[playerId] = {
      name: name || existing.name || "Player",
      friends: { ...(existing.friends || {}) },
      outgoing: { ...(existing.outgoing || {}) },
      incoming: { ...(existing.incoming || {}) }
    };
    return next;
  }

  function mergeProfiles(a, b) {
    const out = { ...(a || {}) };
    Object.entries(b || {}).forEach(([id, p]) => {
      if (!p || typeof p !== "object") return;
      const left = out[id] || { friends: {}, outgoing: {}, incoming: {} };
      out[id] = {
        name: p.name || left.name || "Player",
        friends: { ...(left.friends || {}), ...(p.friends || {}) },
        outgoing: { ...(left.outgoing || {}), ...(p.outgoing || {}) },
        incoming: { ...(left.incoming || {}), ...(p.incoming || {}) }
      };
    });
    return out;
  }

  function mergeInvites(a, b) {
    const out = { ...(a || {}) };
    Object.entries(b || {}).forEach(([id, inv]) => {
      if (!inv || typeof inv !== "object") return;
      const existing = out[id];
      if (!existing || (Number(inv.at) || 0) >= (Number(existing.at) || 0)) {
        out[id] = inv;
      }
    });
    return out;
  }

  function pruneInvites(invites) {
    const now = Date.now();
    const out = {};
    Object.entries(invites || {}).forEach(([id, inv]) => {
      if (!inv) return;
      const age = now - (Number(inv.at) || 0);
      if (inv.status === "pending" && age > INVITE_TTL_MS) {
        out[id] = { ...inv, status: "expired" };
        return;
      }
      if (age < 24 * 60 * 60 * 1000) out[id] = inv;
    });
    return out;
  }

  function mergeData(a, b) {
    return {
      profiles: mergeProfiles(a.profiles, b.profiles),
      invites: pruneInvites(mergeInvites(a.invites, b.invites))
    };
  }

  function myProfile(data = cache) {
    const me = getPlayerId();
    if (!me) return null;
    return (data.profiles || {})[me] || null;
  }

  async function mutate(updater) {
    const run = async () => {
      let remote = cache;
      try {
        remote = await fetchRemote();
      } catch {
        remote = cache;
      }
      const base = mergeData(cache, remote);
      const next = updater(base);
      if (!next) return false;
      saveLocal(next);
      try {
        await postJson(API, next);
      } catch {
        return false;
      }
      try {
        const confirmed = await fetchRemote();
        saveLocal(mergeData(next, confirmed));
      } catch {}
      return true;
    };
    writeQueue = writeQueue.then(run, run);
    return writeQueue;
  }

  async function sync() {
    if (syncing) return cache;
    syncing = true;
    try {
      const local = loadLocal();
      let remote = { profiles: {}, invites: {} };
      try {
        remote = await fetchRemote();
      } catch {}
      const merged = mergeData(local, remote);
      const me = getPlayerId();
      const name = getPlayerName();
      if (me && name) {
        merged.profiles = ensureProfile(merged.profiles, me, name);
      }
      saveLocal(merged);
      try {
        await postJson(API, merged);
      } catch {}
      return cache;
    } finally {
      syncing = false;
    }
  }

  async function findPlayerByName(username) {
    const key = nameKey(username);
    if (!key) return null;
    if (typeof HubPlays !== "undefined") {
      try {
        await HubPlays.sync?.(true);
      } catch {}
    }
    try {
      const data = await fetchJson(`https://mantledb.sh/v2/${NS}/name-registry`);
      const names = data?.names && typeof data.names === "object" ? data.names : data || {};
      const claim = names[key];
      if (claim?.playerId) {
        return { playerId: claim.playerId, name: claim.name || username };
      }
    } catch {}
    const hit = Object.entries(cache.profiles || {}).find(
      ([, p]) => nameKey(p?.name) === key
    );
    if (hit) return { playerId: hit[0], name: hit[1].name };
    return null;
  }

  async function sendRequest(username) {
    const me = getPlayerId();
    const myName = getPlayerName();
    if (!me || !myName) return { ok: false, error: "Set a username first" };
    const target = await findPlayerByName(username);
    if (!target) return { ok: false, error: "Couldn't find that player" };
    if (target.playerId === me) return { ok: false, error: "You can't add yourself" };

    let alreadyFriends = false;
    let alreadySent = false;
    const ok = await mutate((data) => {
      let profiles = ensureProfile(data.profiles, me, myName);
      profiles = ensureProfile(profiles, target.playerId, target.name);
      const mine = profiles[me];
      const theirs = profiles[target.playerId];
      if (mine.friends[target.playerId]) {
        alreadyFriends = true;
        return null;
      }
      if (mine.outgoing[target.playerId]) {
        alreadySent = true;
        return null;
      }
      if (mine.incoming[target.playerId] || theirs.outgoing[me]) {
        const now = Date.now();
        delete mine.incoming[target.playerId];
        delete theirs.outgoing[me];
        mine.friends[target.playerId] = { name: target.name, since: now };
        theirs.friends[me] = { name: myName, since: now };
        profiles[me] = mine;
        profiles[target.playerId] = theirs;
        return { ...data, profiles };
      }
      const at = Date.now();
      mine.outgoing[target.playerId] = { name: target.name, at };
      theirs.incoming[me] = { name: myName, at };
      profiles[me] = mine;
      profiles[target.playerId] = theirs;
      return { ...data, profiles };
    });

    if (alreadyFriends) return { ok: true, alreadyFriends: true };
    if (alreadySent) return { ok: false, error: "Request already sent" };
    if (!ok) return { ok: false, error: "Couldn't send request" };
    return { ok: true };
  }

  async function acceptRequest(fromId) {
    const me = getPlayerId();
    const myName = getPlayerName();
    if (!me || !fromId) return { ok: false, error: "Missing player" };
    const ok = await mutate((data) => {
      let profiles = ensureProfile(data.profiles, me, myName);
      const mine = profiles[me];
      const incoming = mine.incoming[fromId];
      if (!incoming) return null;
      profiles = ensureProfile(profiles, fromId, incoming.name);
      const theirs = profiles[fromId];
      const now = Date.now();
      delete mine.incoming[fromId];
      delete theirs.outgoing[me];
      mine.friends[fromId] = { name: incoming.name || theirs.name, since: now };
      theirs.friends[me] = { name: myName, since: now };
      profiles[me] = mine;
      profiles[fromId] = theirs;
      return { ...data, profiles };
    });
    return ok ? { ok: true } : { ok: false, error: "No request to accept" };
  }

  async function declineRequest(fromId) {
    const me = getPlayerId();
    if (!me || !fromId) return { ok: false, error: "Missing player" };
    const ok = await mutate((data) => {
      const profiles = ensureProfile(data.profiles, me, getPlayerName());
      const mine = profiles[me];
      if (!mine.incoming[fromId]) return null;
      delete mine.incoming[fromId];
      if (profiles[fromId]?.outgoing?.[me]) delete profiles[fromId].outgoing[me];
      profiles[me] = mine;
      return { ...data, profiles };
    });
    return ok ? { ok: true } : { ok: false, error: "No request to decline" };
  }

  async function removeFriend(friendId) {
    const me = getPlayerId();
    if (!me || !friendId) return { ok: false, error: "Missing player" };
    const ok = await mutate((data) => {
      const profiles = { ...data.profiles };
      if (profiles[me]?.friends?.[friendId]) delete profiles[me].friends[friendId];
      if (profiles[friendId]?.friends?.[me]) delete profiles[friendId].friends[me];
      return { ...data, profiles };
    });
    return ok ? { ok: true } : { ok: false, error: "Couldn't remove friend" };
  }

  function listMap(map) {
    return Object.entries(map || {})
      .map(([playerId, info]) => ({
        playerId,
        name: info?.name || "Player",
        at: info?.at || info?.since || 0
      }))
      .sort((a, b) => String(a.name).localeCompare(String(b.name)));
  }

  function getFriends() {
    return listMap(myProfile()?.friends);
  }

  function getIncoming() {
    return listMap(myProfile()?.incoming);
  }

  function getOutgoing() {
    return listMap(myProfile()?.outgoing);
  }

  function isFriend(playerId) {
    return !!(myProfile()?.friends || {})[playerId];
  }

  async function inviteToGame(friendId, opts = {}) {
    const me = getPlayerId();
    const myName = getPlayerName();
    const game = opts.game || "tictactoe";
    const roomId = opts.roomId || "";
    const code = opts.code || "";
    if (!me || !myName) return { ok: false, error: "Set a username first" };
    if (!isFriend(friendId)) return { ok: false, error: "Add them as a friend first" };
    if (!roomId) return { ok: false, error: "Missing room" };

    const friend = getFriends().find((f) => f.playerId === friendId);
    const inviteId = makeId();
    const ok = await mutate((data) => {
      const invites = { ...(data.invites || {}) };
      invites[inviteId] = {
        id: inviteId,
        fromId: me,
        fromName: myName,
        toId: friendId,
        toName: friend?.name || "Player",
        game,
        roomId,
        code,
        status: "pending",
        at: Date.now()
      };
      return { ...data, invites };
    });
    return ok ? { ok: true, inviteId } : { ok: false, error: "Couldn't send invite" };
  }

  function getInvites() {
    const me = getPlayerId();
    if (!me) return [];
    const now = Date.now();
    return Object.values(cache.invites || {})
      .filter((inv) => inv && inv.toId === me && inv.status === "pending")
      .filter((inv) => now - (Number(inv.at) || 0) <= INVITE_TTL_MS)
      .sort((a, b) => (b.at || 0) - (a.at || 0));
  }

  async function respondInvite(inviteId, accept) {
    const me = getPlayerId();
    if (!me || !inviteId) return { ok: false, error: "Missing invite" };
    let roomMeta = null;
    const ok = await mutate((data) => {
      const invites = { ...(data.invites || {}) };
      const inv = invites[inviteId];
      if (!inv || inv.toId !== me || inv.status !== "pending") return null;
      invites[inviteId] = {
        ...inv,
        status: accept ? "accepted" : "declined",
        respondedAt: Date.now()
      };
      if (accept) roomMeta = { game: inv.game, roomId: inv.roomId, code: inv.code };
      return { ...data, invites };
    });
    if (!ok) return { ok: false, error: "Invite not found" };
    return { ok: true, ...(roomMeta || {}) };
  }

  function startPolling(onTick) {
    stopPolling();
    const tick = async () => {
      try {
        await sync();
        onTick?.(cache);
      } catch {}
    };
    tick();
    pollTimer = setInterval(tick, POLL_MS);
  }

  function stopPolling() {
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = null;
  }

  cache = loadLocal();
  sync().catch(() => {});

  window.HubFriends = {
    sendRequest,
    acceptRequest,
    declineRequest,
    removeFriend,
    getFriends,
    getIncoming,
    getOutgoing,
    isFriend,
    inviteToGame,
    getInvites,
    respondInvite,
    sync,
    startPolling,
    stopPolling
  };
})();
