/**
 * hub-afk.js — per-tab AFK overlay after 10 minutes idle, or via AFK button.
 * Pauses only THIS client's Mantle/Supabase usage. Other players are unaffected.
 */
(function () {
  if (window.HubAfk) return;

  const IDLE_MS = 10 * 60 * 1000;
  const MOVE_THROTTLE_MS = 1500;
  let lastActivity = Date.now();
  let lastMoveMark = 0;
  let checkTimer = 0;
  let afk = false;
  let overlay = null;
  let afkFab = null;
  const pauseHooks = new Set();
  const resumeHooks = new Set();

  function net() {
    return window.HubNet || null;
  }

  function markActivity(fromMove) {
    if (afk) return;
    const now = Date.now();
    if (fromMove) {
      if (now - lastMoveMark < MOVE_THROTTLE_MS) return;
      lastMoveMark = now;
    }
    lastActivity = now;
  }

  function goAfkFromUi(e) {
    try {
      e?.preventDefault?.();
      e?.stopPropagation?.();
      if (typeof e?.stopImmediatePropagation === "function") e.stopImmediatePropagation();
    } catch {}
    enterAfk();
  }

  function syncAfkButtons() {
    const label = afk ? "AFK on" : "AFK";
    const title = afk
      ? "You're AFK — tap Resume on the overlay"
      : "Go AFK — pauses cloud sync on this device";
    document.querySelectorAll("[data-hub-afk-btn]").forEach((btn) => {
      btn.textContent = label;
      btn.title = title;
      btn.setAttribute("aria-pressed", afk ? "true" : "false");
      btn.classList.toggle("is-afk", afk);
      btn.disabled = !!afk;
    });
    if (afkFab) {
      afkFab.textContent = "AFK";
      afkFab.title = title;
      afkFab.hidden = !!afk;
      afkFab.setAttribute("aria-hidden", afk ? "true" : "false");
    }
  }

  function ensureAfkFab() {
    if (afkFab || document.getElementById("hub-afk-fab")) {
      afkFab = afkFab || document.getElementById("hub-afk-fab");
      return afkFab;
    }
    ensureOverlay();
    afkFab = document.createElement("button");
    afkFab.id = "hub-afk-fab";
    afkFab.type = "button";
    afkFab.setAttribute("data-hub-afk-btn", "1");
    afkFab.dataset.afkBound = "1";
    afkFab.setAttribute("aria-label", "Go AFK");
    afkFab.textContent = "AFK";
    afkFab.addEventListener("click", goAfkFromUi, true);
    (document.body || document.documentElement).appendChild(afkFab);
    syncAfkButtons();
    return afkFab;
  }

  function wireToolbarButtons() {
    document.querySelectorAll("[data-hub-afk-btn]").forEach((btn) => {
      if (btn.dataset.afkBound === "1") return;
      btn.dataset.afkBound = "1";
      btn.addEventListener("click", goAfkFromUi, true);
    });
    syncAfkButtons();
  }

  function ensureOverlay() {
    if (overlay) return overlay;
    const style = document.createElement("style");
    style.id = "hub-afk-style";
    style.textContent =
      "#hub-afk-overlay{position:fixed;inset:0;z-index:200000;display:none;align-items:center;" +
      "justify-content:center;padding:1.5rem;background:rgba(6,10,20,.82);" +
      "backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);color:#e8eefc;" +
      'font-family:"Outfit","Segoe UI",system-ui,sans-serif;text-align:center}' +
      "#hub-afk-overlay.is-open{display:flex}" +
      "#hub-afk-overlay .hub-afk-card{max-width:22rem;width:100%;padding:1.4rem 1.25rem 1.25rem;" +
      "border-radius:16px;border:1px solid rgba(255,255,255,.12);" +
      "background:linear-gradient(180deg,rgba(28,40,70,.96),rgba(12,18,34,.98));" +
      "box-shadow:0 18px 40px rgba(0,0,0,.35)}" +
      "#hub-afk-overlay h2{margin:0 0 .45rem;font-size:1.45rem;font-weight:800}" +
      "#hub-afk-overlay p{margin:0 0 1rem;color:#9aa8c7;font-size:.95rem;line-height:1.45;font-weight:600}" +
      "#hub-afk-overlay .hub-afk-btn{appearance:none;border:0;border-radius:999px;padding:.7rem 1.35rem;" +
      "font:inherit;font-weight:800;cursor:pointer;color:#10182a;background:linear-gradient(135deg,#7c9cff,#a78bfa)}" +
      "#hub-afk-overlay .hub-afk-btn:hover{filter:brightness(1.06)}" +
      "#hub-afk-fab{position:fixed;left:max(.85rem,env(safe-area-inset-left));" +
      "bottom:max(.85rem,env(safe-area-inset-bottom));z-index:12080;" +
      "appearance:none;border:1px solid rgba(160,190,255,.35);border-radius:999px;" +
      "padding:.55rem .95rem;font:800 .82rem Outfit,\"Segoe UI\",system-ui,sans-serif;" +
      "cursor:pointer;color:#eaf3ff;background:linear-gradient(180deg,rgba(40,55,90,.92),rgba(18,26,48,.96));" +
      "box-shadow:0 10px 24px rgba(0,0,0,.35);letter-spacing:.02em}" +
      "#hub-afk-fab:hover{filter:brightness(1.08);transform:translateY(-1px)}" +
      "#hub-afk-fab:focus-visible{outline:2px solid #9cbcff;outline-offset:3px}" +
      "html.hub-afk #hub-afk-fab,body.coins-shop-open #hub-afk-fab,body.hub-admin-open #hub-afk-fab," +
      "html.hub-help-open #hub-afk-fab{visibility:hidden;pointer-events:none}";
    (document.head || document.documentElement).appendChild(style);

    overlay = document.createElement("div");
    overlay.id = "hub-afk-overlay";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-labelledby", "hub-afk-title");
    overlay.innerHTML =
      '<div class="hub-afk-card">' +
      '<h2 id="hub-afk-title">You\'re AFK</h2>' +
      "<p>Cloud sync is paused on this device to save data. Other players are unaffected.</p>" +
      '<button type="button" class="hub-afk-btn" id="hub-afk-resume">Resume</button>' +
      "</div>";
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay || e.target.closest("#hub-afk-resume")) resume();
    });
    (document.body || document.documentElement).appendChild(overlay);
    return overlay;
  }

  function runHooks(set) {
    set.forEach((fn) => {
      try {
        fn();
      } catch {}
    });
  }

  async function enterAfk() {
    if (afk) return;
    afk = true;
    ensureOverlay().classList.add("is-open");
    syncAfkButtons();
    try {
      document.documentElement.classList.add("hub-afk");
    } catch {}

    // Drop this tab from online first (needs one last request), then block this client only.
    try {
      await window.HubPlays?.goOffline?.();
    } catch {}
    try {
      net()?.pause?.("afk");
    } catch {}

    runHooks(pauseHooks);
    try {
      window.dispatchEvent(new CustomEvent("hub-afk", { detail: { afk: true } }));
    } catch {}
  }

  function resume() {
    if (!afk) {
      markActivity(false);
      return;
    }
    afk = false;
    lastActivity = Date.now();
    if (overlay) overlay.classList.remove("is-open");
    try {
      document.documentElement.classList.remove("hub-afk");
    } catch {}
    try {
      net()?.resume?.("afk");
    } catch {}
    syncAfkButtons();
    runHooks(resumeHooks);
    try {
      window.HubPlays?.heartbeat?.();
    } catch {}
    try {
      window.dispatchEvent(new CustomEvent("hub-afk", { detail: { afk: false } }));
    } catch {}
  }

  function tick() {
    if (afk) return;
    try {
      if (document.hidden) return;
    } catch {}
    if (Date.now() - lastActivity >= IDLE_MS) enterAfk();
  }

  function onActivity(e) {
    if (afk) {
      // Only the overlay itself resumes (button / backdrop). Ignore background game noise.
      if (e && overlay && overlay.classList.contains("is-open")) {
        if (e.target === overlay || (e.target && e.target.closest && e.target.closest("#hub-afk-resume"))) {
          resume();
        }
      }
      return;
    }
    const move = e && (e.type === "mousemove" || e.type === "pointermove");
    markActivity(!!move);
  }

  function start() {
    if (checkTimer) return;
    const opts = { capture: true, passive: true };
    ["pointerdown", "mousedown", "keydown", "touchstart", "wheel", "click"].forEach((type) => {
      window.addEventListener(type, onActivity, opts);
    });
    window.addEventListener("mousemove", onActivity, opts);
    window.addEventListener("pointermove", onActivity, opts);
    document.addEventListener(
      "visibilitychange",
      () => {
        if (!document.hidden) markActivity(false);
      },
      false
    );
    checkTimer = window.setInterval(tick, 15_000);
    markActivity(false);
    ensureAfkFab();
    wireToolbarButtons();
    // Toolbar may render later on the hub.
    window.setTimeout(wireToolbarButtons, 400);
    window.setTimeout(wireToolbarButtons, 1500);
  }

  window.HubAfk = {
    start,
    resume,
    enter: enterAfk,
    isAfk: () => afk,
    onPause: (fn) => {
      if (typeof fn === "function") pauseHooks.add(fn);
      return () => pauseHooks.delete(fn);
    },
    onResume: (fn) => {
      if (typeof fn === "function") resumeHooks.add(fn);
      return () => resumeHooks.delete(fn);
    },
    IDLE_MS
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
