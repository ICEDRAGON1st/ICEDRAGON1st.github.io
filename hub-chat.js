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

  function totalUnread() {
    if (typeof HubFriends === "undefined" || !HubFriends.getFriends) return 0;
    return (HubFriends.getFriends() || []).reduce(
      (sum, f) => sum + unreadCount(f.playerId),
      0
    );
  }

  function getRecentIncoming(limit = 20) {
    const me = getPlayerId();
    if (!me) return [];
    const friends = typeof HubFriends !== "undefined" && HubFriends.getFriends
      ? HubFriends.getFriends()
      : [];
    const friendNames = {};
    friends.forEach((f) => {
      friendNames[f.playerId] = f.name;
    });
    const out = [];
    Object.entries(cache.threads || {}).forEach(([key, thread]) => {
      const parts = String(key).split(":");
      if (parts.length !== 2 || (parts[0] !== me && parts[1] !== me)) return;
      const other = parts[0] === me ? parts[1] : parts[0];
      (thread.messages || []).forEach((raw) => {
        const msg = normalizeMessage(raw);
        if (!msg || msg.from === me) return;
        out.push({
          ...msg,
          friendId: other,
          friendName: friendNames[other] || msg.name || "Friend"
        });
      });
    });
    return out.sort((a, b) => b.at - a.at).slice(0, limit);
  }

  const pollCallbacks = new Set();

  function startPolling(cb) {
    if (typeof cb === "function") pollCallbacks.add(cb);
    if (pollTimer) return;
    const tick = async () => {
      try {
        await sync();
        if (activeFriendId) markRead(activeFriendId);
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
        width: min(22rem, calc(100vw - 1.5rem)); max-height: min(28rem, calc(100vh - 5.5rem));
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
      .hub-chat-body { overflow: auto; flex: 1; min-height: 10rem; max-height: 16rem; padding: 0.55rem; }
      .hub-chat-friend, .hub-chat-msg {
        display: block; width: 100%; text-align: left; margin: 0 0 0.4rem;
        padding: 0.45rem 0.55rem; border-radius: 10px; border: 1px solid transparent;
        background: rgba(255,255,255,0.05); color: inherit; font: inherit; cursor: pointer;
      }
      .hub-chat-friend:hover, .hub-chat-msg.is-preview { border-color: rgba(255,255,255,0.14); }
      .hub-chat-friend-name { font-weight: 700; }
      .hub-chat-friend-meta, .hub-chat-meta { display: block; margin-top: 0.15rem; color: #9bb0c9; font-size: 0.75rem; }
      .hub-chat-log { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.4rem; }
      .hub-chat-log li {
        max-width: 88%; padding: 0.4rem 0.55rem; border-radius: 10px; background: rgba(255,255,255,0.06);
      }
      .hub-chat-log li.is-me { margin-left: auto; background: rgba(106,170,100,0.28); }
      .hub-chat-text { display: block; line-height: 1.35; word-break: break-word; }
      .hub-chat-empty { color: #9bb0c9; text-align: center; padding: 1rem 0.5rem; font-size: 0.88rem; }
      .hub-chat-form {
        display: flex; gap: 0.4rem; padding: 0.55rem 0.65rem; border-top: 1px solid rgba(255,255,255,0.1);
      }
      .hub-chat-form input {
        flex: 1; min-width: 0; border-radius: 8px; border: 1px solid rgba(255,255,255,0.16);
        background: rgba(0,0,0,0.25); color: inherit; font: inherit; padding: 0.45rem 0.55rem;
      }
      .hub-chat-form button {
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
        <h3 id="hub-chat-title">Friends chat</h3>
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

    let overlayFriendId = "";
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

    function showToast(msg) {
      if (!panel.classList.contains("hidden") && overlayFriendId === msg.friendId) return;
      const el = document.createElement("button");
      el.type = "button";
      el.className = "hub-chat-toast";
      el.innerHTML = `<strong>${escapeHtml(msg.friendName)}</strong><span>${escapeHtml(msg.text)}</span>`;
      el.addEventListener("click", () => {
        openOverlayThread(msg.friendId);
        el.remove();
      });
      toasts.appendChild(el);
      setTimeout(() => el.remove(), 6000);
    }

    function checkToasts() {
      const recent = getRecentIncoming(12);
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

    function renderFriendList() {
      const body = document.getElementById("hub-chat-body");
      const form = document.getElementById("hub-chat-form");
      const back = document.getElementById("hub-chat-back");
      const title = document.getElementById("hub-chat-title");
      if (!body) return;
      form?.classList.add("hidden");
      back?.classList.add("hidden");
      if (title) title.textContent = "Friends chat";
      overlayFriendId = "";
      closeThread();

      const friends =
        typeof HubFriends !== "undefined" && HubFriends.getFriends
          ? HubFriends.getFriends()
          : [];
      if (!friends.length) {
        body.innerHTML = `<div class="hub-chat-empty">Add friends on the hub to chat in-game.</div>`;
        return;
      }
      body.innerHTML = friends
        .map((f) => {
          const unread = unreadCount(f.playerId);
          const msgs = getMessages(f.playerId);
          const last = msgs.length ? msgs[msgs.length - 1] : null;
          const preview = last
            ? escapeHtml(last.text)
            : "No messages yet";
          const badge = unread
            ? `<span class="hub-chat-fab-badge">${unread > 9 ? "9+" : unread}</span>`
            : "";
          return `<button type="button" class="hub-chat-friend" data-hub-chat-friend="${escapeHtml(f.playerId)}"><span class="hub-chat-friend-name">${escapeHtml(f.name)} ${badge}</span><span class="hub-chat-friend-meta">${preview}</span></button>`;
        })
        .join("");
    }

    function renderThread() {
      const body = document.getElementById("hub-chat-body");
      const form = document.getElementById("hub-chat-form");
      const back = document.getElementById("hub-chat-back");
      const title = document.getElementById("hub-chat-title");
      if (!body || !overlayFriendId) return;
      form?.classList.remove("hidden");
      back?.classList.remove("hidden");
      const friends =
        typeof HubFriends !== "undefined" && HubFriends.getFriends
          ? HubFriends.getFriends()
          : [];
      const friend = friends.find((f) => f.playerId === overlayFriendId);
      if (title) title.textContent = friend?.name || "Chat";
      markRead(overlayFriendId);
      const me = getPlayerId();
      const messages = getMessages(overlayFriendId);
      if (!messages.length) {
        body.innerHTML = `<div class="hub-chat-empty">No messages yet — say hi.</div>`;
        return;
      }
      const stick =
        body.scrollHeight - body.scrollTop - body.clientHeight < 56;
      body.innerHTML = `<ul class="hub-chat-log">${messages
        .map((m) => {
          const mine = m.from === me;
          const when =
            typeof HubPlays !== "undefined" && HubPlays.formatWhen
              ? HubPlays.formatWhen(m.at)
              : "";
          const who = mine ? "You" : escapeHtml(m.name || friend?.name || "Friend");
          return `<li class="${mine ? "is-me" : ""}"><span class="hub-chat-meta">${who} · ${escapeHtml(when)}</span><span class="hub-chat-text">${escapeHtml(m.text)}</span></li>`;
        })
        .join("")}</ul>`;
      if (stick) body.scrollTop = body.scrollHeight;
    }

    function refreshOverlay() {
      setBadge();
      checkToasts();
      if (panel.classList.contains("hidden")) return;
      if (overlayFriendId) renderThread();
      else renderFriendList();
    }

    function openOverlayThread(friendId) {
      if (!openThread(friendId)) return;
      overlayFriendId = friendId;
      panel.classList.remove("hidden");
      renderThread();
      setBadge();
      document.getElementById("hub-chat-input")?.focus();
    }

    function openPanel() {
      panel.classList.remove("hidden");
      if (overlayFriendId) renderThread();
      else renderFriendList();
    }

    fab.addEventListener("click", () => {
      if (panel.classList.contains("hidden")) openPanel();
      else {
        panel.classList.add("hidden");
        overlayFriendId = "";
        closeThread();
      }
    });
    document.getElementById("hub-chat-close")?.addEventListener("click", () => {
      panel.classList.add("hidden");
      overlayFriendId = "";
      closeThread();
    });
    document.getElementById("hub-chat-back")?.addEventListener("click", () => {
      overlayFriendId = "";
      closeThread();
      renderFriendList();
    });
    document.getElementById("hub-chat-body")?.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-hub-chat-friend]");
      if (!btn) return;
      openOverlayThread(btn.dataset.hubChatFriend);
    });
    document.getElementById("hub-chat-form")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const input = document.getElementById("hub-chat-input");
      const text = input?.value || "";
      if (!overlayFriendId) return;
      const result = await send(overlayFriendId, text);
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

    // Keep game keybinds from firing while typing in chat.
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
    closeThread,
    getActiveFriendId,
    getMessages,
    send,
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
