/**
 * hub-chat.js — private chat between friends via MantleDB.
 *
 * window.HubChat:
 *   openThread(friendId), getActiveFriendId(), closeThread()
 *   getMessages(friendId), send(friendId, text)
 *   unreadCount(friendId), markRead(friendId)
 *   sync(), startPolling(onUpdate), stopPolling()
 */
(function () {
  const NS = "icedragon1st-mygames";
  const PATH = "friend-chat";
  const API = `https://mantledb.sh/v2/${NS}/${PATH}`;
  const LOCAL_KEY = "hub-chat-v1";
  const READ_KEY = "hub-chat-read-v1";
  const MAX_MESSAGES = 80;
  const MAX_TEXT = 200;
  const POLL_MS = 3500;

  let cache = { threads: {} };
  let syncing = false;
  let pollTimer = null;
  let writeQueue = Promise.resolve();
  let activeFriendId = "";
  let onUpdate = null;

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

  function threadKey(a, b) {
    return [String(a || ""), String(b || "")].sort().join(":");
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

  function mergeThreads(a, b) {
    const out = { ...(a || {}) };
    Object.entries(b || {}).forEach(([key, thread]) => {
      if (!thread || typeof thread !== "object") return;
      const left = out[key]?.messages || [];
      const right = Array.isArray(thread.messages) ? thread.messages : [];
      out[key] = { messages: mergeMessages(left, right) };
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

  function getMessages(friendId) {
    const me = getPlayerId();
    const id = String(friendId || "");
    if (!me || !id) return [];
    const key = threadKey(me, id);
    const list = cache.threads?.[key]?.messages || [];
    return list.map(normalizeMessage).filter(Boolean);
  }

  function unreadCount(friendId) {
    const me = getPlayerId();
    const id = String(friendId || "");
    if (!me || !id) return 0;
    const key = threadKey(me, id);
    const readAt = Number(loadReadMap()[key]) || 0;
    return getMessages(id).filter((m) => m.from !== me && m.at > readAt).length;
  }

  function markRead(friendId) {
    const me = getPlayerId();
    const id = String(friendId || "");
    if (!me || !id) return;
    const key = threadKey(me, id);
    const msgs = getMessages(id);
    const latest = msgs.length ? msgs[msgs.length - 1].at : Date.now();
    const map = loadReadMap();
    map[key] = Math.max(Number(map[key]) || 0, latest, Date.now());
    saveReadMap(map);
  }

  function openThread(friendId) {
    const id = String(friendId || "");
    if (!id || !isFriend(id)) return false;
    activeFriendId = id;
    markRead(id);
    return true;
  }

  function closeThread() {
    activeFriendId = "";
  }

  function getActiveFriendId() {
    return activeFriendId;
  }

  async function send(friendId, rawText) {
    const me = getPlayerId();
    const myName = getPlayerName();
    const id = String(friendId || "");
    const text = sanitizeText(rawText);
    if (!me || !myName) return { ok: false, error: "Set a username first" };
    if (!id) return { ok: false, error: "Pick a friend" };
    if (!isFriend(id)) return { ok: false, error: "You can only chat with friends" };
    if (!text) return { ok: false, error: "Type a message" };

    const key = threadKey(me, id);
    const msg = {
      id: makeId(),
      from: me,
      name: myName,
      text,
      at: Date.now()
    };

    const ok = await mutate((data) => {
      const threads = { ...(data.threads || {}) };
      const prev = threads[key]?.messages || [];
      threads[key] = { messages: mergeMessages(prev, [msg]) };
      return { threads };
    });

    if (!ok) return { ok: false, error: "Couldn't send — try again" };
    markRead(id);
    return { ok: true, message: msg };
  }

  function startPolling(cb) {
    onUpdate = typeof cb === "function" ? cb : null;
    if (pollTimer) return;
    const tick = async () => {
      try {
        await sync();
        if (activeFriendId) markRead(activeFriendId);
        onUpdate?.();
      } catch {}
    };
    tick();
    pollTimer = setInterval(tick, POLL_MS);
  }

  function stopPolling() {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
    onUpdate = null;
  }

  cache = loadLocal();

  window.HubChat = {
    openThread,
    closeThread,
    getActiveFriendId,
    getMessages,
    send,
    unreadCount,
    markRead,
    sync,
    startPolling,
    stopPolling
  };
})();
