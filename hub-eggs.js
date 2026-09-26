/**
 * hub-eggs.js — shared easter-egg unlocks + one-run session flags.
 */
(function () {
  const STORE_KEY = "hub-eggs-v1";
  const SESSION_KEY = "hub-eggs-session-v1";
  const PENDING_FLAIR_KEY = "hub-eggs-pending-flair-v1";

  function readStore() {
    try {
      const raw = JSON.parse(localStorage.getItem(STORE_KEY) || "null");
      if (!raw || typeof raw !== "object") return { unlocks: {}, meta: {} };
      return {
        unlocks: raw.unlocks && typeof raw.unlocks === "object" ? raw.unlocks : {},
        meta: raw.meta && typeof raw.meta === "object" ? raw.meta : {}
      };
    } catch {
      return { unlocks: {}, meta: {} };
    }
  }

  function writeStore(data) {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(data));
    } catch {}
  }

  function readSession() {
    try {
      const raw = JSON.parse(sessionStorage.getItem(SESSION_KEY) || "null");
      return raw && typeof raw === "object" ? raw : {};
    } catch {
      return {};
    }
  }

  function writeSession(data) {
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(data));
    } catch {}
  }

  function has(id) {
    const key = String(id || "").trim();
    if (!key) return false;
    return !!readStore().unlocks[key];
  }

  function unlock(id, meta) {
    const key = String(id || "").trim();
    if (!key) return false;
    const store = readStore();
    const first = !store.unlocks[key];
    store.unlocks[key] = true;
    if (meta != null) store.meta[key] = meta;
    else if (first) store.meta[key] = { at: Date.now() };
    writeStore(store);
    return first;
  }

  function allUnlocked() {
    return { ...readStore().unlocks };
  }

  function flagSession(key, value = true) {
    const k = String(key || "").trim();
    if (!k) return;
    const data = readSession();
    data[k] = value;
    writeSession(data);
  }

  function getSession(key) {
    const k = String(key || "").trim();
    if (!k) return null;
    const data = readSession();
    return Object.prototype.hasOwnProperty.call(data, k) ? data[k] : null;
  }

  function clearSession(key) {
    const k = String(key || "").trim();
    if (!k) return;
    const data = readSession();
    delete data[k];
    writeSession(data);
  }

  function setPendingHubFlair(id) {
    try {
      localStorage.setItem(PENDING_FLAIR_KEY, String(id || "").trim());
    } catch {}
  }

  function consumePendingHubFlair() {
    try {
      const id = String(localStorage.getItem(PENDING_FLAIR_KEY) || "").trim();
      if (!id) return "";
      localStorage.removeItem(PENDING_FLAIR_KEY);
      return id;
    } catch {
      return "";
    }
  }

  function toast(message, ms = 3200) {
    const text = String(message || "").trim();
    if (!text) return;
    let el = document.getElementById("hub-egg-toast");
    if (!el) {
      el = document.createElement("div");
      el.id = "hub-egg-toast";
      el.setAttribute("role", "status");
      el.style.cssText =
        "position:fixed;left:50%;bottom:1.25rem;transform:translateX(-50%);z-index:99999;" +
        "max-width:min(92vw,22rem);padding:0.65rem 0.9rem;border-radius:0.75rem;" +
        "background:rgba(8,18,28,0.92);color:#e8f4ff;border:1px solid rgba(120,180,220,0.35);" +
        "font:700 0.9rem/1.35 system-ui,Segoe UI,sans-serif;text-align:center;" +
        "box-shadow:0 10px 30px rgba(0,0,0,0.35);pointer-events:none;";
      document.body.appendChild(el);
    }
    el.textContent = text;
    el.hidden = false;
    clearTimeout(el._hideTimer);
    el._hideTimer = setTimeout(() => {
      el.hidden = true;
    }, Math.max(1200, ms));
    try {
      window.HubSound?.play?.("click");
    } catch {}
  }

  window.HubEggs = {
    unlock,
    has,
    allUnlocked,
    flagSession,
    getSession,
    clearSession,
    setPendingHubFlair,
    consumePendingHubFlair,
    toast
  };
})();
