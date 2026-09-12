/**
 * hub-notifications.js — in-app + browser alerts for chat and streak danger.
 *
 * window.HubNotifications:
 *   start() / stop()
 *   push(note)
 *   requestPermission()
 *   getItems() / unreadCount() / markAllRead()
 *   openPanel() / closePanel()
 */
(function () {
  const STORAGE_KEY = "hub-notifications-v1";
  const SEEN_KEY = "hub-notifications-seen-v1";
  const PERM_ASKED_KEY = "hub-notifications-perm-asked-v1";
  const MAX_ITEMS = 40;
  const POLL_MS = 20000;
  const FEEDBACK_SYNC_MS = 180000;
  const STREAK_WARN_HOURS = 6;
  const STREAK_URGENT_HOURS = 2;

  let items = [];
  let seenAt = 0;
  let pollTimer = null;
  let lastChatUnread = 0;
  let lastFeedbackUnread = 0;
  let root = null;
  let panelOpen = false;
  let started = false;

  function loadItems() {
    try {
      const raw = JSON.parse(localStorage.getItem(STORAGE_KEY));
      return Array.isArray(raw) ? raw : [];
    } catch {
      return [];
    }
  }

  function saveItems() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, MAX_ITEMS)));
    } catch {}
  }

  function loadSeenAt() {
    return Math.max(0, Number(localStorage.getItem(SEEN_KEY)) || 0);
  }

  function saveSeenAt(at) {
    try {
      localStorage.setItem(SEEN_KEY, String(Math.max(0, Number(at) || 0)));
    } catch {}
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function formatWhen(at) {
    const d = new Date(Number(at) || 0);
    if (!Number.isFinite(d.getTime()) || d.getTime() <= 0) return "";
    return d.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  function normalize(note) {
    if (!note || typeof note !== "object") return null;
    const id = String(note.id || "");
    const title = String(note.title || "").trim().slice(0, 80);
    if (!id || !title) return null;
    return {
      id,
      kind: String(note.kind || "info").slice(0, 24),
      title,
      body: String(note.body || "").trim().slice(0, 180),
      href: String(note.href || "").slice(0, 200),
      at: Number(note.at) || Date.now()
    };
  }

  function unreadCount() {
    return items.filter((n) => n.at > seenAt).length;
  }

  function getItems() {
    return items.slice().sort((a, b) => b.at - a.at);
  }

  function markAllRead() {
    const newest = items[0]?.at || Date.now();
    seenAt = Math.max(seenAt, newest);
    saveSeenAt(seenAt);
    renderBell();
    renderPanel();
  }

  function ensureDom() {
    if (root && document.body.contains(root)) return root;
    root = document.createElement("div");
    root.id = "hub-notify-root";
    root.innerHTML = `
      <button type="button" id="hub-notify-bell" class="hub-notify-bell" aria-label="Notifications" title="Notifications">
        <span class="hub-notify-bell-icon" aria-hidden="true">🔔</span>
        <span id="hub-notify-badge" class="hub-notify-badge hidden">0</span>
      </button>
      <div id="hub-notify-panel" class="hub-notify-panel hidden" role="dialog" aria-label="Notifications">
        <div class="hub-notify-panel-head">
          <strong>Notifications</strong>
          <div class="hub-notify-panel-actions">
            <button type="button" id="hub-notify-enable" class="hub-notify-link">Enable alerts</button>
            <button type="button" id="hub-notify-clear" class="hub-notify-link">Clear</button>
            <button type="button" id="hub-notify-close" class="hub-notify-link">Close</button>
          </div>
        </div>
        <ul id="hub-notify-list" class="hub-notify-list"></ul>
        <p id="hub-notify-empty" class="hub-notify-empty hidden">No notifications yet.</p>
      </div>
      <div id="hub-notify-toasts" class="hub-notify-toasts" aria-live="polite"></div>
    `;
    document.body.appendChild(root);

    root.querySelector("#hub-notify-bell")?.addEventListener("click", (e) => {
      e.stopPropagation();
      if (panelOpen) closePanel();
      else openPanel();
    });
    root.querySelector("#hub-notify-close")?.addEventListener("click", closePanel);
    root.querySelector("#hub-notify-clear")?.addEventListener("click", () => {
      items = [];
      saveItems();
      markAllRead();
      renderPanel();
    });
    root.querySelector("#hub-notify-enable")?.addEventListener("click", () => {
      requestPermission(true);
    });
    root.querySelector("#hub-notify-list")?.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-notify-href]");
      if (!btn) return;
      const href = btn.getAttribute("data-notify-href");
      if (href) window.location.href = href;
    });
    document.addEventListener("click", (e) => {
      if (!panelOpen || !root) return;
      if (root.contains(e.target)) return;
      closePanel();
    });
    return root;
  }

  function renderBell() {
    ensureDom();
    const badge = root.querySelector("#hub-notify-badge");
    const n = unreadCount();
    if (!badge) return;
    if (n <= 0) {
      badge.classList.add("hidden");
      badge.textContent = "0";
    } else {
      badge.classList.remove("hidden");
      badge.textContent = n > 9 ? "9+" : String(n);
    }
  }

  function renderPanel() {
    ensureDom();
    const list = root.querySelector("#hub-notify-list");
    const empty = root.querySelector("#hub-notify-empty");
    const enableBtn = root.querySelector("#hub-notify-enable");
    if (!list) return;
    const sorted = getItems();
    if (enableBtn) {
      const perm = typeof Notification !== "undefined" ? Notification.permission : "denied";
      enableBtn.classList.toggle("hidden", perm === "granted" || perm === "denied");
    }
    if (!sorted.length) {
      list.innerHTML = "";
      empty?.classList.remove("hidden");
      return;
    }
    empty?.classList.add("hidden");
    list.innerHTML = sorted
      .map((n) => {
        const isNew = n.at > seenAt;
        const action = n.href
          ? `<button type="button" class="hub-notify-open" data-notify-href="${escapeHtml(n.href)}">Open</button>`
          : "";
        return `<li class="hub-notify-item kind-${escapeHtml(n.kind)}${isNew ? " is-new" : ""}">
          <div class="hub-notify-item-top">
            <span class="hub-notify-item-title">${escapeHtml(n.title)}</span>
            <span class="hub-notify-item-time">${escapeHtml(formatWhen(n.at))}</span>
          </div>
          <p class="hub-notify-item-body">${escapeHtml(n.body)}</p>
          ${action}
        </li>`;
      })
      .join("");
  }

  function showToast(note) {
    ensureDom();
    const host = root.querySelector("#hub-notify-toasts");
    if (!host) return;
    const el = document.createElement("button");
    el.type = "button";
    el.className = `hub-notify-toast kind-${note.kind}`;
    el.innerHTML = `<strong>${escapeHtml(note.title)}</strong><span>${escapeHtml(note.body)}</span>`;
    el.addEventListener("click", () => {
      if (note.href) window.location.href = note.href;
      else openPanel();
      el.remove();
    });
    host.appendChild(el);
    requestAnimationFrame(() => el.classList.add("show"));
    setTimeout(() => {
      el.classList.remove("show");
      setTimeout(() => el.remove(), 280);
    }, 5200);
  }

  function browserNotify(note) {
    if (typeof Notification === "undefined") return;
    if (Notification.permission !== "granted") return;
    if (!document.hidden && panelOpen) return;
    try {
      const n = new Notification(note.title, {
        body: note.body,
        tag: note.id,
        silent: false
      });
      n.onclick = () => {
        window.focus();
        if (note.href) window.location.href = note.href;
        else openPanel();
        n.close();
      };
    } catch {}
  }

  function push(raw, { silent = false } = {}) {
    const note = normalize(raw);
    if (!note) return null;
    if (items.some((x) => x.id === note.id)) return null;
    items = [note, ...items].slice(0, MAX_ITEMS);
    saveItems();
    renderBell();
    if (panelOpen) renderPanel();
    if (!silent) {
      showToast(note);
      browserNotify(note);
      window.HubSound?.play?.("click");
    }
    return note;
  }

  function openPanel() {
    ensureDom();
    panelOpen = true;
    root.querySelector("#hub-notify-panel")?.classList.remove("hidden");
    renderPanel();
    markAllRead();
  }

  function closePanel() {
    if (!root) return;
    panelOpen = false;
    root.querySelector("#hub-notify-panel")?.classList.add("hidden");
    renderBell();
  }

  async function requestPermission(force = false) {
    if (typeof Notification === "undefined") return "denied";
    if (Notification.permission === "granted") return "granted";
    if (Notification.permission === "denied") return "denied";
    if (!force) {
      try {
        if (localStorage.getItem(PERM_ASKED_KEY) === "1") return Notification.permission;
      } catch {}
    }
    try {
      localStorage.setItem(PERM_ASKED_KEY, "1");
    } catch {}
    try {
      const result = await Notification.requestPermission();
      renderPanel();
      return result;
    } catch {
      return "denied";
    }
  }

  function formatStreakLeft(hours) {
    if (!(hours > 0)) return "";
    const totalMins = Math.max(1, Math.round(Number(hours) * 60));
    const hrs = Math.floor(totalMins / 60);
    const mins = totalMins % 60;
    if (hrs > 0) return mins > 0 && hrs < 8 ? `${hrs}h ${mins}m` : `${hrs}h`;
    return `${mins}m`;
  }

  function checkStreak() {
    if (typeof HubStreak === "undefined" || !HubStreak.getStatus) return;
    const status = HubStreak.getStatus();
    if (!(status.streak > 0) || !(status.hoursLeft > 0)) return;
    const left = status.hoursLeft;
    const leftLabel = formatStreakLeft(left);
    let bucket = "";
    if (left <= STREAK_URGENT_HOURS) bucket = "urgent";
    else if (left <= STREAK_WARN_HOURS) bucket = "warn";
    if (!bucket) return;
    const dayKey = status.playedToday ? "today" : "needplay";
    const stableId = `streak-${bucket}-${dayKey}`;
    const title = bucket === "urgent" ? "Streak almost gone!" : "Streak running out";
    const body = status.playedToday
      ? `Your ${status.streak}-day streak dies in ${leftLabel} if you stop playing.`
      : `You haven't played yet — streak dies in ${leftLabel}.`;
    const href =
      typeof location !== "undefined" && /\/[^/]+\/index\.html/i.test(location.pathname)
        ? "../index.html#games"
        : "index.html#games";
    push({
      id: stableId,
      kind: "streak",
      title,
      body,
      href,
      at: Date.now()
    });
  }

  function checkChat() {
    if (typeof HubChat === "undefined" || !HubChat.totalUnread) return;
    let unread = 0;
    try {
      unread = Number(HubChat.totalUnread()) || 0;
    } catch {
      unread = 0;
    }
    if (unread > lastChatUnread && unread > 0) {
      const gained = unread - lastChatUnread;
      push({
        id: `chat-${Date.now()}`,
        kind: "chat",
        title: gained === 1 ? "New message" : `${gained} new messages`,
        body: "Open Friends to read your chats.",
        href: typeof location !== "undefined" && /\/[^/]+\/index\.html/i.test(location.pathname)
          ? "../index.html#friends"
          : "index.html#friends",
        at: Date.now()
      });
    }
    lastChatUnread = unread;
  }

  function checkFeedback() {
    if (typeof HubFeedback === "undefined" || !HubFeedback.isOwner?.()) return;
    const unread = Number(HubFeedback.unreadCount?.() || 0);
    if (unread > lastFeedbackUnread && unread > 0) {
      push({
        id: `feedback-${Date.now()}`,
        kind: "feedback",
        title: "New feedback",
        body: unread === 1 ? "Someone sent feedback for ICE." : `${unread} feedback messages waiting.`,
        href: "index.html#feedback",
        at: Date.now()
      });
    }
    lastFeedbackUnread = unread;
  }

  let lastFeedbackSyncAt = 0;

  async function tick() {
    // Don't re-sync chat here — HubChat already polls when Friends is open.
    // Feedback: owner-only, and only every few minutes to avoid Mantle rate limits.
    try {
      const owner = typeof HubFeedback !== "undefined" && HubFeedback.isOwner?.();
      const cooled =
        typeof HubFeedback !== "undefined" && HubFeedback.isRateLimited?.();
      if (
        owner &&
        !cooled &&
        Date.now() - lastFeedbackSyncAt >= FEEDBACK_SYNC_MS
      ) {
        lastFeedbackSyncAt = Date.now();
        await HubFeedback.sync();
        await HubFeedback.flushPending?.();
      }
    } catch {}
    checkStreak();
    checkChat();
    checkFeedback();
    renderBell();
  }

  function start() {
    if (started) return;
    started = true;
    items = loadItems().map(normalize).filter(Boolean);
    seenAt = loadSeenAt();
    ensureDom();
    renderBell();
    try {
      if (typeof HubChat !== "undefined" && HubChat.totalUnread) {
        lastChatUnread = Number(HubChat.totalUnread()) || 0;
      }
    } catch {}
    try {
      if (typeof HubFeedback !== "undefined" && HubFeedback.isOwner?.()) {
        lastFeedbackUnread = Number(HubFeedback.unreadCount?.() || 0);
      }
    } catch {}
    tick();
    pollTimer = setInterval(tick, POLL_MS);
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) tick();
    });
  }

  function stop() {
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = null;
    started = false;
  }

  window.HubNotifications = {
    start,
    stop,
    push,
    requestPermission,
    getItems,
    unreadCount,
    markAllRead,
    openPanel,
    closePanel
  };

  function boot() {
    start();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    setTimeout(boot, 0);
  }
})();
