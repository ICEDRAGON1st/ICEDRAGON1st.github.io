/**
 * hub-net.js — per-tab gate for Mantle / Supabase traffic.
 * AFK / offline only pauses THIS browser. Never writes a global freeze.
 */
(function () {
  if (window.HubNet) return;

  const reasons = new Set();
  const listeners = new Set();
  let wrapped = false;
  let nativeFetch = null;

  function isCloudUrl(url) {
    const s = String(url || "");
    if (!s) return false;
    return (
      s.includes("mantledb.sh") ||
      s.includes("supabase.co") ||
      s.includes("clkamsflzyvdcepvelks")
    );
  }

  function isPaused() {
    return reasons.size > 0;
  }

  function isOnline() {
    try {
      if (typeof navigator !== "undefined" && navigator.onLine === false) return false;
    } catch {}
    return true;
  }

  function reasonsList() {
    return [...reasons];
  }

  function notify() {
    const snap = { paused: isPaused(), reasons: reasonsList(), online: isOnline() };
    listeners.forEach((fn) => {
      try {
        fn(snap);
      } catch {}
    });
    try {
      window.dispatchEvent(new CustomEvent("hub-net", { detail: snap }));
    } catch {}
  }

  function pause(reason) {
    const key = String(reason || "pause").trim() || "pause";
    const before = reasons.size;
    reasons.add(key);
    if (reasons.size !== before) notify();
    return isPaused();
  }

  function resume(reason) {
    const key = String(reason || "pause").trim() || "pause";
    if (!reasons.has(key)) return isPaused();
    reasons.delete(key);
    notify();
    return isPaused();
  }

  function onChange(fn) {
    if (typeof fn !== "function") return () => {};
    listeners.add(fn);
    return () => listeners.delete(fn);
  }

  function shouldBlock(url) {
    if (!isCloudUrl(url)) return false;
    if (isPaused()) return true;
    if (!isOnline()) return true;
    return false;
  }

  function wrapFetch() {
    if (wrapped) return;
    if (typeof window.fetch !== "function") return;
    nativeFetch = window.fetch.bind(window);
    wrapped = true;
    window.fetch = function hubNetFetch(input, init) {
      let url = "";
      try {
        if (typeof input === "string") url = input;
        else if (input && typeof input.url === "string") url = input.url;
      } catch {}
      if (shouldBlock(url)) {
        const err = new Error(isPaused() ? "hub-net-paused" : "hub-net-offline");
        err.hubNetBlocked = true;
        err.paused = isPaused();
        err.offline = !isOnline();
        return Promise.reject(err);
      }
      return nativeFetch(input, init);
    };
  }

  wrapFetch();

  try {
    window.addEventListener("online", () => notify());
    window.addEventListener("offline", () => notify());
  } catch {}

  window.HubNet = {
    pause,
    resume,
    isPaused,
    isOnline,
    reasons: reasonsList,
    onChange,
    isCloudUrl,
    shouldBlock,
    wrapFetch
  };
})();
