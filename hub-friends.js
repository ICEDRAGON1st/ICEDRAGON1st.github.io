/**
 * hub-friends.js — friend requests + game invites via the account server.
 *
 * window.HubFriends:
 *   sendRequest(username), acceptRequest(id), declineRequest(id), removeFriend(id)
 *   getFriends(), getIncoming(), getOutgoing()
 *   inviteToGame(friendId, { game, roomId, code }), getInvites(), respondInvite(id, accept)
 *   sync(), startPolling(), stopPolling()
 * Friend rows also update live from the signed-in account.
 */
(function () {
  const DOC_ID = "friends";
  const LOCAL_KEY = "hub-friends-v1";
  const INVITE_TTL_MS = 5 * 60 * 1000;
  const POLL_MS = 4000;

  function sb() {
    return window.HubSupabase && HubSupabase.ready ? HubSupabase : null;
  }

  let cache = { profiles: {}, invites: {} };
  let syncing = false;
  let pollTimer = null;
  let friendsRealtimeUnsub = null;
  let pollOnTick = null;
  let writeQueue = Promise.resolve();

  function getPlayerId() {
    return typeof HubPlays !== "undefined" && HubPlays.getPlayerId ? HubPlays.getPlayerId() : "";
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
        const loaded = {
          profiles: data.profiles && typeof data.profiles === "object" ? data.profiles : {},
          invites: data.invites && typeof data.invites === "object" ? data.invites : {}
        };
        const me = getPlayerId();
        const helper = edgesApi();
        return me && helper?.visibleFriendsData ? helper.visibleFriendsData(loaded, me) : loaded;
      }
    } catch {}
    return { profiles: {}, invites: {} };
  }

  function saveLocal(data) {
    const me = getPlayerId();
    const helper = edgesApi();
    const visible =
      me && helper?.visibleFriendsData
        ? helper.visibleFriendsData(
            {
              profiles: data?.profiles || {},
              invites: data?.invites || {}
            },
            me
          )
        : { profiles: data?.profiles || {}, invites: data?.invites || {} };
    cache = {
      profiles: visible.profiles || {},
      invites: visible.invites || {}
    };
    try {
      localStorage.setItem(LOCAL_KEY, JSON.stringify(cache));
    } catch {}
  }

  async function fetchFriendsTableRemote() {
    const api = sb();
    const helper = edgesApi();
    if (!api?.listFriendEdgeContributions || !helper?.overlayFriendsData) return null;
    try {
      const rows = await api.listFriendEdgeContributions();
      if (!rows) return null;
      return helper.overlayFriendsData({ profiles: {}, invites: {} }, rows, getPlayerId());
    } catch {
      return null;
    }
  }

  async function persistFriendEdgeContribution(data) {
    const api = sb();
    const helper = edgesApi();
    const me = getPlayerId();
    if (!api?.upsertFriendEdgeContribution || !helper?.collectMine || !me) return false;
    const snapshot = helper.collectMine(data, me);
    try {
      await api.upsertFriendEdgeContribution({
        playerId: me,
        displayName: snapshot.name || getPlayerName() || "",
        friends: snapshot.friends,
        outgoing: snapshot.outgoing,
        incoming: snapshot.incoming,
        invites: snapshot.invites
      });
      return true;
    } catch {
      return false;
    }
  }

  async function fetchRemote() {
    if (friendsLiveJoined()) {
      return cache && typeof cache === "object" ? cache : { profiles: {}, invites: {} };
    }
    const tableRemote = await fetchFriendsTableRemote();
    if (tableRemote) {
      const current = cache && typeof cache === "object" ? cache : { profiles: {}, invites: {} };
      return mergeData(current, tableRemote);
    }
    if (
      cache &&
      typeof cache === "object" &&
      ((cache.profiles && Object.keys(cache.profiles).length) ||
        (cache.invites && Object.keys(cache.invites).length))
    ) {
      return cache;
    }
    throw new Error("friends-unavailable");
  }

  async function pushRemote(next) {
    const tableWrote = await persistFriendEdgeContribution(next);
    if (tableWrote) return;
    throw new Error("friends-unavailable");
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

  function edgesApi() {
    return window.HubFriendsEdges || null;
  }

  function friendsCloudQuiet() {
    try {
      if (window.HubAfk?.isAfk?.()) return true;
      if (window.HubNet?.isPaused?.()) return true;
      if (window.HubNet && HubNet.isOnline && !HubNet.isOnline()) return true;
    } catch {}
    try {
      if (document.hidden) return true;
    } catch {}
    return false;
  }

  function applyFriendsRealtime(change) {
    const helper = edgesApi();
    if (!helper?.applyChange) return;
    const next = helper.applyChange(cache, change, getPlayerId());
    saveLocal({
      profiles: next?.profiles && typeof next.profiles === "object" ? next.profiles : {},
      invites: next?.invites && typeof next.invites === "object" ? next.invites : {}
    });
    try {
      pollOnTick?.(cache);
    } catch {}
  }

  function stopFriendsRealtime() {
    try {
      friendsRealtimeUnsub?.();
    } catch {}
    friendsRealtimeUnsub = null;
  }

  function ensureFriendsRealtime() {
    const api = sb();
    if (!api?.subscribeFriendEdgeContributions) return;
    if (api.friendEdgesAreScoped?.()) {
      stopFriendsRealtime();
      return;
    }
    // The open channel delivers every friend list, including people you do not know.
    stopFriendsRealtime();
  }

  async function persistMyEdges() {
    const helper = edgesApi();
    const api = sb();
    const me = getPlayerId();
    const identity = window.HubIdentity;
    if (!helper || !me) return;
    try {
      if (identity?.persistOwnedSave) {
        await identity.persistOwnedSave(api, helper.SAVE_KEY, helper.collectMine(cache, me));
      } else if (api?.upsertSave) {
        await api.upsertSave(helper.SAVE_KEY, helper.collectMine(cache, me), 1);
      }
    } catch (err) {
      console.warn("[HubFriends] player_saves friend-edge write failed", err);
    }
  }

  async function pullMyEdges(data) {
    const helper = edgesApi();
    const api = sb();
    const me = getPlayerId();
    const identity = window.HubIdentity;
    const read = identity?.readOwnedSave
      ? (key) => identity.readOwnedSave(api, key)
      : api?.getSave
        ? (key) => api.getSave(key)
        : null;
    if (!helper || !read || !me) return data;
    try {
      const raw = await read(helper.SAVE_KEY);
      const mine = helper.readEdges(raw);
      if (!mine || (!mine.playerId && helper.isEmptyProfile(mine))) return data;
      return helper.applyMine(data, mine, me);
    } catch (err) {
      console.warn("[HubFriends] player_saves friend-edge read failed", err);
      return data;
    }
  }

  function friendsLiveJoined() {
    try {
      return !!sb()?.isRealtimeJoined?.("friend_edge_contributions");
    } catch {
      return false;
    }
  }

  async function mutate(updater) {
    const run = async () => {
      let remote = cache;
      const joined = friendsLiveJoined();
      if (!joined) {
        try {
          remote = await fetchRemote();
        } catch {
          remote = cache;
        }
      }
      const base = await pullMyEdges(mergeData(cache, remote));
      const next = updater(base);
      if (!next) return false;
      saveLocal(next);
      try {
        await pushRemote(next);
      } catch {
        await persistMyEdges();
        return false;
      }
      if (!joined) {
        try {
          const confirmed = await fetchRemote();
          saveLocal(mergeData(next, confirmed));
        } catch {}
      }
      await persistMyEdges();
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
      const joined = friendsLiveJoined();
      if (joined) {
        remote = cache;
      } else {
        try {
          remote = await fetchRemote();
        } catch {
          remote = { profiles: {}, invites: {} };
        }
      }
      const merged = await pullMyEdges(mergeData(local, remote));
      const me = getPlayerId();
      const name = getPlayerName();
      if (me && name) {
        merged.profiles = ensureProfile(merged.profiles, me, name);
      }
      saveLocal(merged);
      const helper = edgesApi();
      const mine = helper?.collectMine ? helper.collectMine(merged, me) : null;
      const emptyEdges =
        !mine ||
        ((helper.isEmptyProfile ? helper.isEmptyProfile(mine) : true) &&
          !Object.keys(mine.invites || {}).length);
      // A missed load must not replace this player's friends with an empty list.
      // Removing the last friend still publishes through mutate().
      if (emptyEdges) return cache;
      try {
        await pushRemote(merged);
      } catch {}
      await persistMyEdges();
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
      const live = typeof HubPlays !== "undefined" ? HubPlays.getClaimForName?.(username) : null;
      if (live?.playerId) {
        return { playerId: live.playerId, name: live.name || username };
      }
    } catch {}
    try {
      const api = sb();
      let names = {};
      try {
        const rows = await api?.listNicknameClaims?.();
        const namesApi = window.HubNames;
        if (rows && namesApi?.mergeNameMaps && namesApi?.rowsToNameMap) {
          names = namesApi.mergeNameMaps(names, namesApi.rowsToNameMap(rows));
        }
      } catch {}
      const claim = names[key];
      if (claim?.playerId) {
        return { playerId: claim.playerId, name: claim.name || username };
      }
    } catch {}
    const hit = Object.entries(cache.profiles || {}).find(([, p]) => nameKey(p?.name) === key);
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

  async function noteChatGroups(threads) {
    const me = getPlayerId();
    const myName = getPlayerName() || "Player";
    if (!me || !threads || typeof threads !== "object") return false;
    const groups = Object.entries(threads)
      .filter(([key, thread]) => String(key).startsWith("group:") && thread && thread.members)
      .map(([key, thread]) => ({
        groupId: key.slice("group:".length).slice(0, 48),
        members: thread.members || {}
      }))
      .filter((group) => group.groupId && Object.keys(group.members).some((id) => id && id !== me));
    if (!groups.length) return false;
    return mutate((data) => {
      const invites = { ...(data.invites || {}) };
      let changed = false;
      const now = Date.now();
      groups.forEach((group) => {
        Object.entries(group.members).forEach(([memberId, memberName]) => {
          if (!memberId || memberId === me) return;
          const id = `chat-group:${group.groupId}:${memberId}`.slice(0, 64);
          const prev = invites[id];
          const age = now - (Number(prev?.at) || 0);
          if (
            prev &&
            prev.status === "chat-group" &&
            prev.roomId === group.groupId &&
            prev.toId === memberId &&
            age < 12 * 60 * 60 * 1000
          ) {
            return;
          }
          invites[id] = {
            id,
            fromId: me,
            fromName: myName,
            toId: memberId,
            toName: String(memberName || "Player").slice(0, 32) || "Player",
            game: "chat-group",
            roomId: group.groupId,
            status: "chat-group",
            at: now
          };
          changed = true;
        });
      });
      if (!changed) return null;
      return { ...data, invites };
    });
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
    pollOnTick = typeof onTick === "function" ? onTick : null;
    const tick = async () => {
      try {
        if (friendsCloudQuiet()) {
          stopFriendsRealtime();
          return;
        }
        if (!sb()?.isRealtimeJoined?.("friend_edge_contributions")) await sync();
        if (sb()?.friendEdgesAreScoped?.()) stopFriendsRealtime();
        else ensureFriendsRealtime();
        pollOnTick?.(cache);
      } catch {}
    };
    tick();
    pollTimer = setInterval(tick, POLL_MS);
  }

  function stopPolling() {
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = null;
    stopFriendsRealtime();
  }

  cache = loadLocal();
  sync()
    .catch(() => {})
    .finally(() => {
      if (sb()?.friendEdgesAreScoped?.()) stopFriendsRealtime();
      else ensureFriendsRealtime();
    });

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
    noteChatGroups,
    getInvites,
    respondInvite,
    sync,
    startPolling,
    stopPolling
  };
})();
