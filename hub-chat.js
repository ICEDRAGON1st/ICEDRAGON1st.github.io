/**
 * hub-chat.js — DMs, global chat, and group chats via MantleDB.
 *
 * window.HubChat:
 *   openThread(friendId) / openGlobal() / openGroup(id) / closeThread()
 *   getActiveChannel(), getMessages(), send(text)  [active channel]
 *   getMessagesFor(type, id), sendTo(type, id, text)
 *   createGroup(name, memberIds), getGroups()
 *   unreadCount(type?, id?), totalUnread(), markRead()
 *   sync(), startPolling(cb), stopPolling(cb), mountInGameChat()
 */
(function () {
  const NS = "icedragon1st-mygames";
  const PATH = "friend-chat";
  const API = `https://mantledb.sh/v2/${NS}/${PATH}`;
  const LOCAL_KEY = "hub-chat-v1";
  const READ_KEY = "hub-chat-read-v1";
  const MAX_MESSAGES = 100;
  const MAX_TEXT = 200;
  const MAX_GROUP_NAME = 24;
  const POLL_MS = 3500;
  const GLOBAL_KEY = "global";

  let cache = { threads: {} };
  let syncing = false;
  let pollTimer = null;
  let writeQueue = Promise.resolve();
  /** @type {{ type: "dm"|"global"|"group", id: string } | null} */
  let active = null;
  const pollCallbacks = new Set();

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

  function dmKey(a, b) {
    return [String(a || ""), String(b || "")].sort().join(":");
  }

  function groupKey(id) {
    return `group:${String(id || "")}`;
  }

  function channelStorageKey(type, id) {
    if (type === "global") return GLOBAL_KEY;
    if (type === "group") return groupKey(id);
    return dmKey(getPlayerId(), id);
  }

  function makeId() {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function sanitizeText(raw) {
    return String(raw || "")
      .replace(/[<>&"'`]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, MAX_TEXT);
  }

  function sanitizeGroupName(raw) {
    return String(raw || "")
      .replace(/[<>&"'`]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, MAX_GROUP_NAME);
  }

  function loadLocal() {
    try {
      const data = JSON.parse(localStorage.getItem(LOCAL_KEY));
      if (data && typeof data === "object" && data.threads && typeof data.threads === "object") {
        return { threads: data.threads };
      }
    } catch {}
    return { threads: {} };
  }

  function saveLocal(data) {
    cache = { threads: data.threads || {} };
    try {
      localStorage.setItem(LOCAL_KEY, JSON.stringify(cache));
    } catch {}
  }

  function loadReadMap() {
    try {
      const data = JSON.parse(localStorage.getItem(READ_KEY));
      return data && typeof data === "object" ? data : {};
    } catch {
      return {};
    }
  }

  function saveReadMap(map) {
    try {
      localStorage.setItem(READ_KEY, JSON.stringify(map || {}));
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
    if (!data || typeof data !== "object") return { threads: {} };
    return {
      threads: data.threads && typeof data.threads === "object" ? data.threads : {}
    };
  }

  function normalizeMessage(msg) {
    if (!msg || typeof msg !== "object") return null;
    const id = String(msg.id || "");
    const from = String(msg.from || "");
    const text = sanitizeText(msg.text);
    const at = Number(msg.at) || 0;
    if (!id || !from || !text || !at) return null;
    return {
      id,
      from,
      name: String(msg.name || "").slice(0, 16),
      text,
      at
    };
  }

  function mergeMessages(a, b) {
    const map = {};
    [...(a || []), ...(b || [])].forEach((raw) => {
      const msg = normalizeMessage(raw);
      if (!msg) return;
      const prev = map[msg.id];
      if (!prev || msg.at >= prev.at) map[msg.id] = msg;
    });
    return Object.values(map)
      .sort((x, y) => x.at - y.at)
      .slice(-MAX_MESSAGES);
  }

  function mergeMembers(a, b) {
    const out = { ...(a || {}) };
    Object.entries(b || {}).forEach(([id, name]) => {
      if (!id) return;
      out[id] = String(name || out[id] || "Player").slice(0, 16);
    });
    return out;
  }

  function mergeThreads(a, b) {
    const out = { ...(a || {}) };
    Object.entries(b || {}).forEach(([key, thread]) => {
      if (!thread || typeof thread !== "object") return;
      const left = out[key] || {};
      const right = thread;
      const messages = mergeMessages(left.messages, right.messages);
      if (key === GLOBAL_KEY || String(key).startsWith("group:")) {
        out[key] = {
          type: key === GLOBAL_KEY ? "global" : "group",
          name: sanitizeGroupName(right.name || left.name || "") || left.name || "Group",
          members: mergeMembers(left.members, right.members),
          createdBy: String(right.createdBy || left.createdBy || ""),
          createdAt: Math.min(
            Number(right.createdAt) || Infinity,
            Number(left.createdAt) || Infinity
          ),
          messages
        };
        if (!Number.isFinite(out[key].createdAt)) out[key].createdAt = Date.now();
        return;
      }
      out[key] = { messages };
    });
    return out;
  }

  function mergeData(a, b) {
    return { threads: mergeThreads(a?.threads, b?.threads) };
  }

  function isFriend(friendId) {
    if (typeof HubFriends === "undefined" || !HubFriends.getFriends) return false;
    return (HubFriends.getFriends() || []).some((f) => f.playerId === friendId);
  }

  function canAccess(type, id) {
    const me = getPlayerId();
    if (!me) return false;
    if (type === "global") return true;
    if (type === "dm") return isFriend(id);
    if (type === "group") {
      const thread = cache.threads?.[groupKey(id)];
      return !!(thread?.members && thread.members[me]);
    }
    return false;
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
      let remote = { threads: {} };
      try {
        remote = await fetchRemote();
      } catch {}
      saveLocal(mergeData(local, remote));
      return cache;
    } finally {
      syncing = false;
    }
  }

  function getMessagesFor(type, id) {
    if (!canAccess(type, id) && type !== "global") {
      if (type === "global") {
        /* always ok */
      } else {
        return [];
      }
    }
    if (type === "global") {
      const list = cache.threads?.[GLOBAL_KEY]?.messages || [];
      return list.map(normalizeMessage).filter(Boolean);
    }
    if (type === "group") {
      const list = cache.threads?.[groupKey(id)]?.messages || [];
      return list.map(normalizeMessage).filter(Boolean);
    }
    const me = getPlayerId();
    if (!me || !id) return [];
    const list = cache.threads?.[dmKey(me, id)]?.messages || [];
    return list.map(normalizeMessage).filter(Boolean);
  }

  function getMessages(friendId) {
    if (friendId) return getMessagesFor("dm", friendId);
    if (!active) return [];
    return getMessagesFor(active.type, active.id);
  }

  function unreadForKey(storageKey, messages, me) {
    const readAt = Number(loadReadMap()[storageKey]) || 0;
    return messages.filter((m) => m.from !== me && m.at > readAt).length;
  }

  function unreadCount(typeOrFriendId, maybeId) {
    const me = getPlayerId();
    if (!me) return 0;
    // Legacy: unreadCount(friendId)
    if (maybeId === undefined && typeOrFriendId && typeOrFriendId !== "global" && typeOrFriendId !== "dm" && typeOrFriendId !== "group") {
      return unreadForKey(dmKey(me, typeOrFriendId), getMessagesFor("dm", typeOrFriendId), me);
    }
    const type = typeOrFriendId || active?.type;
    const id = maybeId !== undefined ? maybeId : active?.id;
    if (!type) return 0;
    if (type === "global") {
      return unreadForKey(GLOBAL_KEY, getMessagesFor("global"), me);
    }
    if (type === "group") {
      if (!canAccess("group", id)) return 0;
      return unreadForKey(groupKey(id), getMessagesFor("group", id), me);
    }
    return unreadForKey(dmKey(me, id), getMessagesFor("dm", id), me);
  }

  function markRead(typeOrFriendId, maybeId) {
    const me = getPlayerId();
    if (!me) return;
    let type;
    let id;
    if (maybeId === undefined && typeOrFriendId && typeOrFriendId !== "global" && typeOrFriendId !== "dm" && typeOrFriendId !== "group") {
      type = "dm";
      id = typeOrFriendId;
    } else {
      type = typeOrFriendId || active?.type;
      id = maybeId !== undefined ? maybeId : active?.id;
    }
    if (!type) return;
    const key = channelStorageKey(type, id);
    const msgs = getMessagesFor(type, id);
    const latest = msgs.length ? msgs[msgs.length - 1].at : Date.now();
    const map = loadReadMap();
    map[key] = Math.max(Number(map[key]) || 0, latest, Date.now());
    saveReadMap(map);
  }

  function openThread(friendId) {
    const id = String(friendId || "");
    if (!id || !isFriend(id)) return false;
    active = { type: "dm", id };
    markRead("dm", id);
    return true;
  }

  function openGlobal() {
    if (!getPlayerId()) return false;
    active = { type: "global", id: GLOBAL_KEY };
    markRead("global");
    return true;
  }

  function openGroup(groupId) {
    const id = String(groupId || "").replace(/^group:/, "");
    if (!id || !canAccess("group", id)) return false;
    active = { type: "group", id };
    markRead("group", id);
    return true;
  }

  function closeThread() {
    active = null;
  }

  function getActiveFriendId() {
    return active?.type === "dm" ? active.id : "";
  }

  function getActiveChannel() {
    return active ? { ...active } : null;
  }

  function getGroups() {
    const me = getPlayerId();
    if (!me) return [];
    return Object.entries(cache.threads || {})
      .filter(([key, thread]) => String(key).startsWith("group:") && thread?.members?.[me])
      .map(([key, thread]) => {
        const id = key.slice("group:".length);
        const members = Object.entries(thread.members || {}).map(([playerId, name]) => ({
          playerId,
          name
        }));
        return {
          id,
          name: thread.name || "Group",
          members,
          memberCount: members.length,
          createdBy: thread.createdBy || "",
          createdAt: Number(thread.createdAt) || 0,
          unread: unreadCount("group", id)
        };
      })
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  }

  async function createGroup(rawName, memberIds) {
    const me = getPlayerId();
    const myName = getPlayerName();
    const name = sanitizeGroupName(rawName);
    if (!me || !myName) return { ok: false, error: "Set a username first" };
    if (!name) return { ok: false, error: "Name the group" };
    const ids = Array.from(
      new Set((memberIds || []).map((id) => String(id || "")).filter((id) => id && id !== me))
    );
    if (!ids.length) return { ok: false, error: "Pick at least one friend" };
    for (const id of ids) {
      if (!isFriend(id)) return { ok: false, error: "Groups are for friends only" };
    }

    const friends =
      typeof HubFriends !== "undefined" && HubFriends.getFriends
        ? HubFriends.getFriends()
        : [];
    const nameById = { [me]: myName };
    friends.forEach((f) => {
      nameById[f.playerId] = f.name;
    });

    const id = makeId();
    const key = groupKey(id);
    const members = { [me]: myName };
    ids.forEach((fid) => {
      members[fid] = nameById[fid] || "Friend";
    });

    const ok = await mutate((data) => {
      const threads = { ...(data.threads || {}) };
      threads[key] = {
        type: "group",
        name,
        members,
        createdBy: me,
        createdAt: Date.now(),
        messages: []
      };
      return { threads };
    });
    if (!ok) return { ok: false, error: "Couldn't create group" };
    openGroup(id);
    return { ok: true, groupId: id };
  }

  async function sendTo(type, id, rawText) {
    const me = getPlayerId();
    const myName = getPlayerName();
    const text = sanitizeText(rawText);
    if (!me || !myName) return { ok: false, error: "Set a username first" };
    if (!text) return { ok: false, error: "Type a message" };
    if (type === "dm") {
      if (!isFriend(id)) return { ok: false, error: "You can only DM friends" };
    } else if (type === "group") {
      if (!canAccess("group", id)) return { ok: false, error: "Not in that group" };
    } else if (type !== "global") {
      return { ok: false, error: "Unknown chat" };
    }

    const key = channelStorageKey(type, id);
    const msg = {
      id: makeId(),
      from: me,
      name: myName,
      text,
      at: Date.now()
    };

    const ok = await mutate((data) => {
      const threads = { ...(data.threads || {}) };
      const prev = threads[key] || {};
      const nextThread = {
        ...prev,
        type: type === "dm" ? undefined : type,
        messages: mergeMessages(prev.messages, [msg])
      };
      if (type === "global") {
        nextThread.type = "global";
      }
      threads[key] = nextThread;
      return { threads };
    });

    if (!ok) return { ok: false, error: "Couldn't send — try again" };
    markRead(type, id);
    return { ok: true, message: msg };
  }

  async function send(friendIdOrText, maybeText) {
    // Legacy: send(friendId, text)
    if (maybeText !== undefined) {
      return sendTo("dm", friendIdOrText, maybeText);
    }
    // New: send(text) to active channel
    if (!active) return { ok: false, error: "Pick a chat first" };
    return sendTo(active.type, active.id, friendIdOrText);
  }

  function totalUnread() {
    const me = getPlayerId();
    if (!me) return 0;
    let n = unreadCount("global");
    const friends =
      typeof HubFriends !== "undefined" && HubFriends.getFriends
        ? HubFriends.getFriends()
        : [];
    friends.forEach((f) => {
      n += unreadCount("dm", f.playerId);
    });
    getGroups().forEach((g) => {
      n += g.unread || 0;
    });
    return n;
  }

  function getRecentIncoming(limit = 20) {
    const me = getPlayerId();
    if (!me) return [];
    const friends =
      typeof HubFriends !== "undefined" && HubFriends.getFriends
        ? HubFriends.getFriends()
        : [];
    const friendNames = {};
    friends.forEach((f) => {
      friendNames[f.playerId] = f.name;
    });
    const out = [];

    (cache.threads?.[GLOBAL_KEY]?.messages || []).forEach((raw) => {
      const msg = normalizeMessage(raw);
      if (!msg || msg.from === me) return;
      out.push({
        ...msg,
        channelType: "global",
        channelId: GLOBAL_KEY,
        friendId: GLOBAL_KEY,
        friendName: `Global · ${msg.name || "Player"}`
      });
    });

    getGroups().forEach((g) => {
      getMessagesFor("group", g.id).forEach((msg) => {
        if (msg.from === me) return;
        out.push({
          ...msg,
          channelType: "group",
          channelId: g.id,
          friendId: g.id,
          friendName: `${g.name} · ${msg.name || "Player"}`
        });
      });
    });

    Object.entries(cache.threads || {}).forEach(([key, thread]) => {
      if (key === GLOBAL_KEY || String(key).startsWith("group:")) return;
      const parts = String(key).split(":");
      if (parts.length !== 2 || (parts[0] !== me && parts[1] !== me)) return;
      const other = parts[0] === me ? parts[1] : parts[0];
      (thread.messages || []).forEach((raw) => {
        const msg = normalizeMessage(raw);
        if (!msg || msg.from === me) return;
        out.push({
          ...msg,
          channelType: "dm",
          channelId: other,
          friendId: other,
          friendName: friendNames[other] || msg.name || "Friend"
        });
      });
    });

    return out.sort((a, b) => b.at - a.at).slice(0, limit);
  }

  function startPolling(cb) {
    if (typeof cb === "function") pollCallbacks.add(cb);
    if (pollTimer) return;
    const tick = async () => {
      try {
        await sync();
        if (active) markRead(active.type, active.id);
        pollCallbacks.forEach((fn) => {
          try {
            fn();
          } catch {}
        });
      } catch {}
    };
    tick();
    pollTimer = setInterval(tick, POLL_MS);
  }

  function stopPolling(cb) {
    if (typeof cb === "function") pollCallbacks.delete(cb);
    else pollCallbacks.clear();
    if (pollCallbacks.size === 0 && pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  }

  function escapeHtml(text) {
    return String(text || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function injectOverlayStyles() {
    if (document.getElementById("hub-chat-overlay-style")) return;
    const style = document.createElement("style");
    style.id = "hub-chat-overlay-style";
    style.textContent = `
      .hub-chat-fab {
        position: fixed; right: 1rem; bottom: 1rem; z-index: 9990;
        display: inline-flex; align-items: center; gap: 0.4rem;
        padding: 0.7rem 0.95rem; border-radius: 999px; border: 1px solid rgba(255,255,255,0.18);
        background: rgba(20, 28, 42, 0.92); color: #eef6ff; font: 700 0.9rem Segoe UI, system-ui, sans-serif;
        cursor: pointer; box-shadow: 0 8px 28px rgba(0,0,0,0.35); backdrop-filter: blur(8px);
      }
      .hub-chat-fab:hover { filter: brightness(1.08); }
      .hub-chat-fab-badge {
        min-width: 1.2rem; padding: 0.05rem 0.35rem; border-radius: 999px;
        background: #6aaa64; color: #fff; font-size: 0.72rem; text-align: center;
      }
      .hub-chat-panel {
        position: fixed; right: 1rem; bottom: 4.1rem; z-index: 9991;
        width: min(22rem, calc(100vw - 1.5rem)); max-height: min(30rem, calc(100vh - 5.5rem));
        display: flex; flex-direction: column;
        background: rgba(18, 26, 40, 0.96); color: #eef6ff;
        border: 1px solid rgba(255,255,255,0.14); border-radius: 14px;
        box-shadow: 0 16px 40px rgba(0,0,0,0.4); backdrop-filter: blur(10px);
        overflow: hidden;
      }
      .hub-chat-panel.hidden { display: none !important; }
      .hub-chat-head {
        display: flex; align-items: center; gap: 0.45rem; padding: 0.65rem 0.75rem;
        border-bottom: 1px solid rgba(255,255,255,0.1);
      }
      .hub-chat-head h3 { margin: 0; flex: 1; font-size: 0.95rem; }
      .hub-chat-head button {
        appearance: none; border: 1px solid rgba(255,255,255,0.16); background: transparent;
        color: inherit; border-radius: 8px; padding: 0.28rem 0.5rem; font: inherit; font-weight: 700;
        font-size: 0.78rem; cursor: pointer;
      }
      .hub-chat-body { overflow: auto; flex: 1; min-height: 10rem; max-height: 17rem; padding: 0.55rem; }
      .hub-chat-section {
        margin: 0.35rem 0 0.25rem; color: #9bb0c9; font-size: 0.72rem; font-weight: 700;
        letter-spacing: 0.06em; text-transform: uppercase;
      }
      .hub-chat-friend {
        display: block; width: 100%; text-align: left; margin: 0 0 0.4rem;
        padding: 0.45rem 0.55rem; border-radius: 10px; border: 1px solid transparent;
        background: rgba(255,255,255,0.05); color: inherit; font: inherit; cursor: pointer;
      }
      .hub-chat-friend:hover { border-color: rgba(255,255,255,0.14); }
      .hub-chat-friend-name { font-weight: 700; }
      .hub-chat-friend-meta, .hub-chat-meta { display: block; margin-top: 0.15rem; color: #9bb0c9; font-size: 0.75rem; }
      .hub-chat-log { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.4rem; }
      .hub-chat-log li {
        max-width: 88%; padding: 0.4rem 0.55rem; border-radius: 10px; background: rgba(255,255,255,0.06);
      }
      .hub-chat-log li.is-me { margin-left: auto; background: rgba(106,170,100,0.28); }
      .hub-chat-text { display: block; line-height: 1.35; word-break: break-word; }
      .hub-chat-empty { color: #9bb0c9; text-align: center; padding: 1rem 0.5rem; font-size: 0.88rem; }
      .hub-chat-create {
        display: grid; gap: 0.4rem; margin: 0.35rem 0 0.65rem; padding: 0.5rem;
        border: 1px dashed rgba(255,255,255,0.16); border-radius: 10px;
      }
      .hub-chat-create input[type="text"] {
        border-radius: 8px; border: 1px solid rgba(255,255,255,0.16);
        background: rgba(0,0,0,0.25); color: inherit; font: inherit; padding: 0.4rem 0.5rem;
      }
      .hub-chat-create-friends {
        display: flex; flex-wrap: wrap; gap: 0.35rem; max-height: 5.5rem; overflow: auto;
      }
      .hub-chat-create-friends label {
        display: inline-flex; align-items: center; gap: 0.25rem;
        padding: 0.2rem 0.4rem; border-radius: 999px; background: rgba(255,255,255,0.06);
        font-size: 0.78rem; cursor: pointer;
      }
      .hub-chat-form {
        display: flex; gap: 0.4rem; padding: 0.55rem 0.65rem; border-top: 1px solid rgba(255,255,255,0.1);
      }
      .hub-chat-form input {
        flex: 1; min-width: 0; border-radius: 8px; border: 1px solid rgba(255,255,255,0.16);
        background: rgba(0,0,0,0.25); color: inherit; font: inherit; padding: 0.45rem 0.55rem;
      }
      .hub-chat-form button, .hub-chat-create button {
        appearance: none; border: none; border-radius: 8px; background: #6aaa64; color: #fff;
        font: inherit; font-weight: 700; padding: 0.45rem 0.7rem; cursor: pointer;
      }
      .hub-chat-toasts {
        position: fixed; right: 1rem; bottom: 4.2rem; z-index: 9989;
        display: grid; gap: 0.4rem; width: min(18rem, calc(100vw - 1.5rem)); pointer-events: none;
      }
      .hub-chat-toast {
        padding: 0.65rem 0.75rem; border-radius: 12px; background: rgba(20,28,42,0.95);
        border: 1px solid rgba(255,255,255,0.14); color: #eef6ff; box-shadow: 0 10px 28px rgba(0,0,0,0.35);
        font: 600 0.85rem Segoe UI, system-ui, sans-serif; pointer-events: auto; cursor: pointer;
      }
      .hub-chat-toast strong { display: block; margin-bottom: 0.15rem; }
      .hub-chat-toast span { color: #c7d6e8; font-weight: 500; }
    `;
    document.head.appendChild(style);
  }

  function mountInGameChat() {
    if (document.getElementById("hub-chat-fab")) return;
    injectOverlayStyles();

    const fab = document.createElement("button");
    fab.id = "hub-chat-fab";
    fab.type = "button";
    fab.className = "hub-chat-fab";
    fab.innerHTML = `Chat <span id="hub-chat-fab-badge" class="hub-chat-fab-badge hidden">0</span>`;

    const panel = document.createElement("div");
    panel.id = "hub-chat-panel";
    panel.className = "hub-chat-panel hidden";
    panel.innerHTML = `
      <div class="hub-chat-head">
        <button type="button" id="hub-chat-back" class="hidden">Back</button>
        <h3 id="hub-chat-title">Chat</h3>
        <button type="button" id="hub-chat-close">Close</button>
      </div>
      <div id="hub-chat-body" class="hub-chat-body"></div>
      <form id="hub-chat-form" class="hub-chat-form hidden">
        <input id="hub-chat-input" type="text" maxlength="200" placeholder="Message…" autocomplete="off">
        <button type="submit">Send</button>
      </form>
    `;

    const toasts = document.createElement("div");
    toasts.id = "hub-chat-toasts";
    toasts.className = "hub-chat-toasts";

    document.body.appendChild(fab);
    document.body.appendChild(panel);
    document.body.appendChild(toasts);

    let seenIncoming = new Set();
    let bootstrapped = false;

    function setBadge() {
      const badge = document.getElementById("hub-chat-fab-badge");
      if (!badge) return;
      const n = totalUnread();
      if (n > 0) {
        badge.textContent = n > 9 ? "9+" : String(n);
        badge.classList.remove("hidden");
      } else {
        badge.classList.add("hidden");
      }
    }

    function openChannel(type, id) {
      let ok = false;
      if (type === "global") ok = openGlobal();
      else if (type === "group") ok = openGroup(id);
      else ok = openThread(id);
      if (!ok) return;
      panel.classList.remove("hidden");
      renderThread();
      setBadge();
      document.getElementById("hub-chat-input")?.focus();
    }

    function showToast(msg) {
      const cur = getActiveChannel();
      if (
        !panel.classList.contains("hidden") &&
        cur &&
        cur.type === msg.channelType &&
        String(cur.id) === String(msg.channelId)
      ) {
        return;
      }
      const el = document.createElement("button");
      el.type = "button";
      el.className = "hub-chat-toast";
      el.innerHTML = `<strong>${escapeHtml(msg.friendName)}</strong><span>${escapeHtml(msg.text)}</span>`;
      el.addEventListener("click", () => {
        openChannel(msg.channelType, msg.channelId);
        el.remove();
      });
      toasts.appendChild(el);
      setTimeout(() => el.remove(), 6000);
    }

    function checkToasts() {
      const recent = getRecentIncoming(16);
      if (!bootstrapped) {
        recent.forEach((m) => seenIncoming.add(m.id));
        bootstrapped = true;
        return;
      }
      recent
        .filter((m) => !seenIncoming.has(m.id))
        .reverse()
        .forEach((m) => {
          seenIncoming.add(m.id);
          showToast(m);
        });
    }

    function preview(msgs) {
      const last = msgs.length ? msgs[msgs.length - 1] : null;
      return last ? escapeHtml(last.text) : "No messages yet";
    }

    function badgeHtml(n) {
      return n
        ? `<span class="hub-chat-fab-badge">${n > 9 ? "9+" : n}</span>`
        : "";
    }

    function renderList() {
      const body = document.getElementById("hub-chat-body");
      const form = document.getElementById("hub-chat-form");
      const back = document.getElementById("hub-chat-back");
      const title = document.getElementById("hub-chat-title");
      if (!body) return;
      form?.classList.add("hidden");
      back?.classList.add("hidden");
      if (title) title.textContent = "Chat";
      closeThread();

      const friends =
        typeof HubFriends !== "undefined" && HubFriends.getFriends
          ? HubFriends.getFriends()
          : [];
      const groups = getGroups();
      const gUnread = unreadCount("global");

      let html = `<div class="hub-chat-section">Global</div>
        <button type="button" class="hub-chat-friend" data-hub-chat-open="global">
          <span class="hub-chat-friend-name">Global chat ${badgeHtml(gUnread)}</span>
          <span class="hub-chat-friend-meta">${preview(getMessagesFor("global"))}</span>
        </button>`;

      html += `<div class="hub-chat-section">Groups</div>`;
      html += `<div class="hub-chat-create">
        <input id="hub-chat-group-name" type="text" maxlength="24" placeholder="New group name">
        <div class="hub-chat-create-friends">${
          friends.length
            ? friends
                .map(
                  (f) =>
                    `<label><input type="checkbox" value="${escapeHtml(f.playerId)}"> ${escapeHtml(f.name)}</label>`
                )
                .join("")
            : `<span class="hub-chat-friend-meta">Add friends to make a group</span>`
        }</div>
        <button type="button" id="hub-chat-create-group">Create group</button>
      </div>`;
      if (groups.length) {
        html += groups
          .map(
            (g) =>
              `<button type="button" class="hub-chat-friend" data-hub-chat-open="group" data-hub-chat-id="${escapeHtml(g.id)}">
                <span class="hub-chat-friend-name">${escapeHtml(g.name)} ${badgeHtml(g.unread)}</span>
                <span class="hub-chat-friend-meta">${g.memberCount} members · ${preview(getMessagesFor("group", g.id))}</span>
              </button>`
          )
          .join("");
      }

      html += `<div class="hub-chat-section">Friends</div>`;
      if (!friends.length) {
        html += `<div class="hub-chat-empty">Add friends on the hub for DMs.</div>`;
      } else {
        html += friends
          .map((f) => {
            const unread = unreadCount("dm", f.playerId);
            return `<button type="button" class="hub-chat-friend" data-hub-chat-open="dm" data-hub-chat-id="${escapeHtml(f.playerId)}">
              <span class="hub-chat-friend-name">${escapeHtml(f.name)} ${badgeHtml(unread)}</span>
              <span class="hub-chat-friend-meta">${preview(getMessagesFor("dm", f.playerId))}</span>
            </button>`;
          })
          .join("");
      }
      body.innerHTML = html;
    }

    function renderThread() {
      const body = document.getElementById("hub-chat-body");
      const form = document.getElementById("hub-chat-form");
      const back = document.getElementById("hub-chat-back");
      const title = document.getElementById("hub-chat-title");
      const cur = getActiveChannel();
      if (!body || !cur) return;
      form?.classList.remove("hidden");
      back?.classList.remove("hidden");
      markRead(cur.type, cur.id);

      if (cur.type === "global") {
        if (title) title.textContent = "Global chat";
      } else if (cur.type === "group") {
        const g = getGroups().find((x) => x.id === cur.id);
        if (title) title.textContent = g?.name || "Group";
      } else {
        const friends =
          typeof HubFriends !== "undefined" && HubFriends.getFriends
            ? HubFriends.getFriends()
            : [];
        const friend = friends.find((f) => f.playerId === cur.id);
        if (title) title.textContent = friend?.name || "Chat";
      }

      const me = getPlayerId();
      const messages = getMessagesFor(cur.type, cur.id);
      if (!messages.length) {
        body.innerHTML = `<div class="hub-chat-empty">No messages yet — say hi.</div>`;
        return;
      }
      const stick = body.scrollHeight - body.scrollTop - body.clientHeight < 56;
      body.innerHTML = `<ul class="hub-chat-log">${messages
        .map((m) => {
          const mine = m.from === me;
          const when =
            typeof HubPlays !== "undefined" && HubPlays.formatWhen
              ? HubPlays.formatWhen(m.at)
              : "";
          const who = mine ? "You" : escapeHtml(m.name || "Player");
          return `<li class="${mine ? "is-me" : ""}"><span class="hub-chat-meta">${who} · ${escapeHtml(when)}</span><span class="hub-chat-text">${escapeHtml(m.text)}</span></li>`;
        })
        .join("")}</ul>`;
      if (stick) body.scrollTop = body.scrollHeight;
    }

    function refreshOverlay() {
      setBadge();
      checkToasts();
      if (panel.classList.contains("hidden")) return;
      if (getActiveChannel()) renderThread();
      else renderList();
    }

    fab.addEventListener("click", () => {
      if (panel.classList.contains("hidden")) {
        panel.classList.remove("hidden");
        if (getActiveChannel()) renderThread();
        else renderList();
      } else {
        panel.classList.add("hidden");
        closeThread();
      }
    });
    document.getElementById("hub-chat-close")?.addEventListener("click", () => {
      panel.classList.add("hidden");
      closeThread();
    });
    document.getElementById("hub-chat-back")?.addEventListener("click", () => {
      closeThread();
      renderList();
    });
    document.getElementById("hub-chat-body")?.addEventListener("click", async (e) => {
      const createBtn = e.target.closest("#hub-chat-create-group");
      if (createBtn) {
        const nameInput = document.getElementById("hub-chat-group-name");
        const checked = [
          ...document.querySelectorAll(".hub-chat-create-friends input:checked")
        ].map((el) => el.value);
        const result = await createGroup(nameInput?.value || "", checked);
        if (!result.ok) {
          if (nameInput) nameInput.placeholder = result.error || "Couldn't create";
          return;
        }
        renderThread();
        setBadge();
        return;
      }
      const btn = e.target.closest("[data-hub-chat-open]");
      if (!btn) return;
      openChannel(btn.dataset.hubChatOpen, btn.dataset.hubChatId || "");
    });
    document.getElementById("hub-chat-form")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const input = document.getElementById("hub-chat-input");
      const text = input?.value || "";
      const cur = getActiveChannel();
      if (!cur) return;
      const result = await sendTo(cur.type, cur.id, text);
      if (!result.ok) {
        if (input) input.placeholder = result.error || "Couldn't send";
        return;
      }
      if (input) {
        input.value = "";
        input.placeholder = "Message…";
      }
      renderThread();
      setBadge();
    });

    panel.addEventListener("keydown", (e) => e.stopPropagation());

    if (typeof HubFriends !== "undefined" && HubFriends.sync) {
      HubFriends.sync().catch(() => {});
    }
    startPolling(refreshOverlay);
    setBadge();
  }

  cache = loadLocal();

  window.HubChat = {
    openThread,
    openGlobal,
    openGroup,
    closeThread,
    getActiveFriendId,
    getActiveChannel,
    getMessages,
    getMessagesFor,
    send,
    sendTo,
    createGroup,
    getGroups,
    unreadCount,
    totalUnread,
    markRead,
    sync,
    startPolling,
    stopPolling,
    mountInGameChat
  };

  function bootOverlay() {
    try {
      mountInGameChat();
    } catch {}
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootOverlay);
  } else {
    setTimeout(bootOverlay, 0);
  }
})();
