/**
 * hub-feedback.js — player ideas/bugs sent to ICE via MantleDB.
 *
 * window.HubFeedback:
 *   submit({ text, type, game }) → Promise<{ ok, error? }>
 *   sync(force?) → Promise
 *   list() → newest-first items
 *   isOwner() → true for ICE_DRAGON
 *   unreadCount() / markAllRead()
 */
(function () {
  const NS = "icedragon1st-mygames";
  const PATH = "player-feedback";
  const API = `https://mantledb.sh/v2/${NS}/${PATH}`;
  const LOCAL_KEY = "hub-feedback-v1";
  const READ_KEY = "hub-feedback-read-at-v1";
  const LAST_SEND_KEY = "hub-feedback-last-send-v1";
  const MAX_ITEMS = 120;
  const MAX_TEXT = 400;
  const SEND_COOLDOWN_MS = 20000;
  const OWNER_NAME = "ice_dragon";

  let cache = { items: [] };
  let syncing = false;
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

  function isOwner() {
    return getPlayerName().toLowerCase() === OWNER_NAME;
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

  function sanitizeType(raw) {
    const t = String(raw || "").toLowerCase();
    if (t === "bug" || t === "idea" || t === "other") return t;
    return "idea";
  }

  function sanitizeGame(raw) {
    return String(raw || "")
      .replace(/[<>&"'`]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 32);
  }

  function loadLocal() {
    try {
      const data = JSON.parse(localStorage.getItem(LOCAL_KEY));
      if (!data || typeof data !== "object") return { items: [] };
      return { items: Array.isArray(data.items) ? data.items : [] };
    } catch {
      return { items: [] };
    }
  }

  function saveLocal(data) {
    try {
      localStorage.setItem(LOCAL_KEY, JSON.stringify(data || { items: [] }));
    } catch {}
  }

  function getReadAt() {
    return Math.max(0, Number(localStorage.getItem(READ_KEY)) || 0);
  }

  function setReadAt(at) {
    try {
      localStorage.setItem(READ_KEY, String(Math.max(0, Number(at) || 0)));
    } catch {}
  }

  function normalizeItem(raw) {
    if (!raw || typeof raw !== "object") return null;
    const id = String(raw.id || "");
    const text = sanitizeText(raw.text);
    const at = Number(raw.at) || 0;
    if (!id || !text || !at) return null;
    return {
      id,
      fromId: String(raw.fromId || "").slice(0, 64),
      fromName: String(raw.fromName || "Player").slice(0, 16),
      type: sanitizeType(raw.type),
      game: sanitizeGame(raw.game),
      text,
      at
    };
  }

  function mergeItems(a, b) {
    const map = {};
    [...(a || []), ...(b || [])].forEach((raw) => {
      const item = normalizeItem(raw);
      if (!item) return;
      const prev = map[item.id];
      if (!prev || item.at >= prev.at) map[item.id] = item;
    });
    return Object.values(map)
      .sort((x, y) => y.at - x.at)
      .slice(0, MAX_ITEMS);
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
    if (!data || typeof data !== "object") return { items: [] };
    return { items: Array.isArray(data.items) ? data.items : [] };
  }

  async function pushRemote(items) {
    await postJson(API, { items: items.slice(0, MAX_ITEMS) });
  }

  function list() {
    return mergeItems(cache.items, []);
  }

  function unreadCount() {
    if (!isOwner()) return 0;
    const readAt = getReadAt();
    return list().filter((item) => item.at > readAt).length;
  }

  function markAllRead() {
    if (!isOwner()) return;
    const newest = list()[0]?.at || Date.now();
    setReadAt(newest);
  }

  async function sync(force = false) {
    if (syncing && !force) return cache;
    syncing = true;
    try {
      const local = loadLocal();
      let remote = { items: [] };
      try {
        remote = await fetchRemote();
      } catch {}
      const items = mergeItems(local.items, remote.items);
      cache = { items };
      saveLocal(cache);
      return cache;
    } finally {
      syncing = false;
    }
  }

  async function submit({ text, type, game } = {}) {
    const name = getPlayerName();
    if (!name) return { ok: false, error: "Set a nickname first" };
    const clean = sanitizeText(text);
    if (clean.length < 4) return { ok: false, error: "Write a bit more (min 4 characters)" };
    const now = Date.now();
    const last = Math.max(0, Number(localStorage.getItem(LAST_SEND_KEY)) || 0);
    if (now - last < SEND_COOLDOWN_MS) {
      const wait = Math.ceil((SEND_COOLDOWN_MS - (now - last)) / 1000);
      return { ok: false, error: `Wait ${wait}s before sending again` };
    }

    const item = {
      id: makeId(),
      fromId: getPlayerId(),
      fromName: name,
      type: sanitizeType(type),
      game: sanitizeGame(game),
      text: clean,
      at: now
    };

    writeQueue = writeQueue
      .then(async () => {
        await sync(true);
        const items = mergeItems(cache.items, [item]);
        cache = { items };
        saveLocal(cache);
        await pushRemote(items);
        try {
          localStorage.setItem(LAST_SEND_KEY, String(now));
        } catch {}
      })
      .catch(() => {
        // Keep local copy even if remote fails
        cache = { items: mergeItems(cache.items, [item]) };
        saveLocal(cache);
        throw new Error("Could not reach the server — saved locally, try again later");
      });

    try {
      await writeQueue;
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err?.message || "Send failed" };
    }
  }

  cache = loadLocal();
  sync().catch(() => {});

  window.HubFeedback = {
    submit,
    sync,
    list,
    isOwner,
    unreadCount,
    markAllRead,
    MAX_TEXT
  };
})();
