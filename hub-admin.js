/**
 * hub-admin.js — ICE_DRAGON-only Master Admin (not Fishing Idle).
 * Press G (owner) on hub or any game. In games: Help-style float + pauses play.
 *
 * window.HubAdmin:
 *   isOwner() · start() · open()/close()/toggle()/isOpen()
 *   getBan(name) · getMute(name) · isSoftLocked() · getMaintenance()
 *   getUnlocksFor(name) · applyPendingGrants()
 *   refreshUi() · ping()
 */
(function () {
  if (window.HubAdmin) return;

  const OWNER_KEY = "ice_dragon";
  const POLL_MS = 4000;
  const ANNOUNCE_MAX = 180;
  const ANNOUNCE_POPUP_MS = 10000;
  const ANNOUNCE_SEEN_KEY = "hub-admin-announce-seen-v1";
  const GRANT_SEEN_KEY = "hub-admin-grants-seen-v1";
  const UNLOCKS_KEY = "hub-admin-unlocks-v1";
  const LOCAL_GRANTS_KEY = "hub-admin-grants-local-v1";
  const TOKEN = "ice-hub-admin-9f3a";

  const DOC = {
    announce: "hub-admin-announce",
    maintenance: "hub-admin-maintenance",
    moderation: "hub-admin-moderation",
    grants: "hub-admin-grants"
  };

  let announceCache = null;
  let maintenanceCache = null;
  let moderationCache = { bans: {}, mutes: {} };
  let grantsCache = { grants: [] };
  let pollTimer = 0;
  let announceHideTimer = 0;
  let lastShownAnnounceId = "";
  let panelBound = false;
  let revealedCodes = new Set();
  let statusTimer = 0;
  let wePausedHost = false;
  let floatStylesInjected = false;

  try {
    lastShownAnnounceId = String(localStorage.getItem(ANNOUNCE_SEEN_KEY) || "");
  } catch {
    lastShownAnnounceId = "";
  }

  function sb() {
    return window.HubSupabase && HubSupabase.ready ? HubSupabase : null;
  }

  function nameKey(name) {
    return String(name || "")
      .replace(/[<>&"'`]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase()
      .slice(0, 16);
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
    return nameKey(getPlayerName()) === OWNER_KEY;
  }

  function escapeHtml(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function makeId() {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function clampMinutes(raw, fallback = 5) {
    const n = Math.floor(Number(raw));
    if (!Number.isFinite(n)) return fallback;
    return Math.max(1, Math.min(1440, n));
  }

  async function getDoc(id) {
    const api = sb();
    if (!api) return null;
    try {
      return await api.getDoc(id);
    } catch {
      return null;
    }
  }

  async function upsertDoc(id, data) {
    const api = sb();
    if (!api) throw new Error("Cloud sync unavailable");
    await api.upsertDoc(id, data);
  }

  function sanitizeAnnounceText(raw) {
    return String(raw || "")
      .replace(/[<>&"'`]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, ANNOUNCE_MAX);
  }

  function parseAnnounce(data) {
    if (!data || typeof data !== "object") return null;
    const text = sanitizeAnnounceText(data.text);
    const until = Number(data.until) || 0;
    const id = String(data.id || "");
    if (!text || !id || until <= Date.now()) return null;
    return {
      id,
      text,
      by: String(data.by || "ICE_DRAGON").slice(0, 24),
      at: Number(data.at) || Date.now(),
      until
    };
  }

  function parseMaintenance(data) {
    if (!data || typeof data !== "object") return null;
    const until = Number(data.until) || 0;
    if (until <= Date.now()) return null;
    const message = sanitizeAnnounceText(data.message || data.text || "Hub maintenance");
    if (!message) return null;
    return {
      message,
      until,
      softLock: !!data.softLock,
      at: Number(data.at) || Date.now(),
      by: String(data.by || "ICE_DRAGON").slice(0, 24)
    };
  }

  function liveEntry(map, key) {
    const row = map && map[key];
    if (!row || typeof row !== "object") return null;
    const until = Number(row.until) || 0;
    if (until && until <= Date.now()) return null;
    return {
      reason: String(row.reason || "").slice(0, 120),
      until,
      at: Number(row.at) || 0,
      by: String(row.by || "").slice(0, 24)
    };
  }

  function parseModeration(data) {
    const bans = {};
    const mutes = {};
    if (data && typeof data === "object") {
      const banSrc = data.bans && typeof data.bans === "object" ? data.bans : {};
      const muteSrc = data.mutes && typeof data.mutes === "object" ? data.mutes : {};
      Object.keys(banSrc).forEach((k) => {
        const key = nameKey(k);
        const live = liveEntry(banSrc, k);
        if (key && live) bans[key] = live;
      });
      Object.keys(muteSrc).forEach((k) => {
        const key = nameKey(k);
        const live = liveEntry(muteSrc, k);
        if (key && live) mutes[key] = live;
      });
    }
    return { bans, mutes, token: data?.token || TOKEN };
  }

  function parseGrants(data) {
    const list = Array.isArray(data?.grants) ? data.grants : [];
    return {
      token: data?.token || TOKEN,
      grants: list
        .filter((g) => g && typeof g === "object" && g.id)
        .map((g) => ({
          id: String(g.id),
          targetName: nameKey(g.targetName),
          kind: String(g.kind || "").toLowerCase(),
          value: g.value,
          at: Number(g.at) || 0,
          by: String(g.by || "").slice(0, 24),
          claimedBy: Array.isArray(g.claimedBy) ? g.claimedBy.map(String) : []
        }))
        .filter((g) => g.targetName && ["coins", "title", "color"].includes(g.kind))
        .slice(-200)
    };
  }

  function readSeenGrants() {
    try {
      const raw = JSON.parse(localStorage.getItem(GRANT_SEEN_KEY) || "[]");
      return new Set(Array.isArray(raw) ? raw.map(String) : []);
    } catch {
      return new Set();
    }
  }

  function writeSeenGrants(set) {
    try {
      localStorage.setItem(GRANT_SEEN_KEY, JSON.stringify([...set].slice(-300)));
    } catch {}
  }

  function readUnlocksStore() {
    try {
      const raw = JSON.parse(localStorage.getItem(UNLOCKS_KEY) || "{}");
      return raw && typeof raw === "object" ? raw : {};
    } catch {
      return {};
    }
  }

  function writeUnlocksStore(store) {
    try {
      localStorage.setItem(UNLOCKS_KEY, JSON.stringify(store));
    } catch {}
  }

  function getUnlocksFor(name) {
    const key = nameKey(name);
    const store = readUnlocksStore();
    const row = store[key] || {};
    return {
      titles: Array.isArray(row.titles) ? row.titles.map(String) : [],
      colors: Array.isArray(row.colors) ? row.colors.map(String) : []
    };
  }

  function addUnlock(name, kind, value) {
    const key = nameKey(name);
    if (!key || !value) return;
    const store = readUnlocksStore();
    const row = store[key] || { titles: [], colors: [] };
    const listKey = kind === "title" ? "titles" : "colors";
    const list = new Set(Array.isArray(row[listKey]) ? row[listKey].map(String) : []);
    list.add(String(value).toLowerCase());
    row[listKey] = [...list];
    store[key] = row;
    writeUnlocksStore(store);
  }

  function getBan(name) {
    return liveEntry(moderationCache.bans, nameKey(name));
  }

  function getMute(name) {
    return liveEntry(moderationCache.mutes, nameKey(name));
  }

  function getMaintenance() {
    return maintenanceCache;
  }

  function isSoftLocked() {
    return !!(maintenanceCache && maintenanceCache.softLock);
  }

  function ensureChrome() {
    injectFloatStyles();
    if (!document.getElementById("hub-admin-announce-popup")) {
      const popup = document.createElement("div");
      popup.id = "hub-admin-announce-popup";
      popup.className = "hub-admin-announce-popup hidden";
      popup.setAttribute("role", "status");
      popup.innerHTML = `<span class="hub-admin-announce-tag">Hub</span><p id="hub-admin-announce-text"></p>`;
      document.body.appendChild(popup);
    }
    if (!document.getElementById("hub-admin-maintenance-banner")) {
      const ban = document.createElement("div");
      ban.id = "hub-admin-maintenance-banner";
      ban.className = "hub-admin-maintenance-banner hidden";
      ban.setAttribute("role", "status");
      ban.innerHTML = `<strong>Maintenance</strong> <span id="hub-admin-maintenance-text"></span>`;
      document.body.appendChild(ban);
    }
  }

  function isTypingTarget(el) {
    if (!el) return false;
    const tag = String(el.tagName || "").toLowerCase();
    if (tag === "input" || tag === "textarea" || tag === "select") return true;
    if (el.isContentEditable) return true;
    try {
      return !!el.closest?.("input, textarea, select, [contenteditable='true']");
    } catch {
      return false;
    }
  }

  function isHubGamesScreenOpen() {
    try {
      const gs = document.getElementById("games-screen");
      if (gs && !gs.classList.contains("hidden") && !gs.hidden) return true;
    } catch {}
    return false;
  }

  function isFloatAdminPanel(panel) {
    return !!(panel && panel.classList.contains("admin-panel--float"));
  }

  function injectFloatStyles() {
    if (floatStylesInjected || document.getElementById("hub-admin-float-style")) {
      floatStylesInjected = true;
      return;
    }
    floatStylesInjected = true;
    const style = document.createElement("style");
    style.id = "hub-admin-float-style";
    style.textContent = `
#admin-panel.admin-panel--float{position:fixed;inset:0;z-index:13060;margin:0;padding:max(.75rem,env(safe-area-inset-top)) max(.75rem,env(safe-area-inset-right)) max(.9rem,env(safe-area-inset-bottom)) max(.75rem,env(safe-area-inset-left));
display:flex;align-items:flex-end;justify-content:center;box-sizing:border-box;
background:rgba(4,10,22,.48);backdrop-filter:blur(7px);-webkit-backdrop-filter:blur(7px);
font-family:Outfit,"Segoe UI",system-ui,sans-serif;color:#eaf3ff}
#admin-panel.admin-panel--float.hidden{display:none!important}
#admin-panel.admin-panel--float .admin-panel-sheet{width:min(30rem,100%);max-height:min(78vh,42rem);display:flex;flex-direction:column;
border-radius:22px;overflow:hidden;border:1px solid rgba(150,190,255,.28);
background:linear-gradient(165deg,rgba(22,36,64,.97),rgba(10,18,34,.98));
box-shadow:0 24px 60px rgba(0,0,0,.45),inset 0 1px 0 rgba(255,255,255,.06)}
#admin-panel.admin-panel--float .coins-shop-head,#admin-panel.admin-panel--float .admin-panel-head{
display:flex;align-items:flex-start;justify-content:space-between;gap:.75rem;
padding:.9rem 1rem .75rem;border-bottom:1px solid rgba(140,175,255,.14);
background:linear-gradient(180deg,rgba(120,170,255,.12),transparent)}
#admin-panel.admin-panel--float .coins-shop-eyebrow{margin:0;font-size:.72rem;font-weight:800;letter-spacing:.04em;color:#9eb6d8;text-transform:uppercase}
#admin-panel.admin-panel--float h3{margin:.15rem 0 0;font-size:1.2rem;font-weight:800;color:#eef5ff}
#admin-panel.admin-panel--float .admin-panel-body{flex:1;min-height:0;overflow:auto;padding:.85rem 1rem 1.1rem;
display:flex;flex-direction:column;gap:.85rem}
#admin-panel.admin-panel--float .hub-admin-section{margin:0;padding:.7rem .75rem;border-radius:14px;
border:1px solid rgba(140,175,255,.14);background:rgba(0,0,0,.18)}
#admin-panel.admin-panel--float .hub-admin-section h4{margin:0 0 .45rem;font-size:.88rem;font-weight:800;color:#d7e6ff}
#admin-panel.admin-panel--float .hub-admin-live{margin:0 0 .5rem;font-size:.78rem;color:#9eb6d8;line-height:1.35}
#admin-panel.admin-panel--float .hub-admin-form-row{display:flex;flex-wrap:wrap;gap:.4rem;align-items:center}
#admin-panel.admin-panel--float .hub-admin-form-col{flex-direction:column;align-items:stretch}
#admin-panel.admin-panel--float .hub-admin-form-row input,#admin-panel.admin-panel--float .hub-admin-form-row select,
#admin-panel.admin-panel--float .hub-admin-form-row textarea{flex:1 1 8rem;min-width:0;border-radius:10px;border:1px solid rgba(150,190,255,.28);
background:rgba(0,0,0,.28);color:#eaf3ff;padding:.45rem .55rem;font:650 .85rem Outfit,"Segoe UI",system-ui,sans-serif}
#admin-panel.admin-panel--float .hub-admin-form-row input[type="number"]{flex:0 0 4.5rem}
#admin-panel.admin-panel--float .hub-admin-check{display:inline-flex;align-items:center;gap:.35rem;font-size:.78rem;color:#c8dbf7}
#admin-panel.admin-panel--float .hub-btn{border:1px solid rgba(150,190,255,.34);border-radius:10px;padding:.42rem .7rem;
background:linear-gradient(180deg,rgba(120,170,255,.2),rgba(80,130,220,.12));color:#eef5ff;
font:750 .8rem Outfit,"Segoe UI",system-ui,sans-serif;cursor:pointer}
#admin-panel.admin-panel--float .hub-btn-primary{background:linear-gradient(180deg,#8eb0ff,#4f78ef);border-color:transparent;color:#fff}
#admin-panel.admin-panel--float .hub-admin-list{list-style:none;margin:.45rem 0 0;padding:0;display:flex;flex-direction:column;gap:.35rem;max-height:10rem;overflow:auto}
#admin-panel.admin-panel--float .hub-admin-row{display:flex;flex-wrap:wrap;gap:.35rem;align-items:center;justify-content:space-between;
padding:.4rem .5rem;border-radius:10px;background:rgba(255,255,255,.04);border:1px solid rgba(140,175,255,.1)}
#admin-panel.admin-panel--float .hub-admin-row.is-online{border-color:rgba(110,220,160,.35)}
#admin-panel.admin-panel--float .hub-admin-meta{font-size:.8rem;color:#e8f1ff}
#admin-panel.admin-panel--float .hub-admin-sub{font-size:.72rem;color:#9eb6d8}
#admin-panel.admin-panel--float .hub-admin-actions{display:flex;flex-wrap:wrap;gap:.3rem}
#admin-panel.admin-panel--float .hub-admin-empty{margin:0;font-size:.78rem;color:#8aa0c0}
#admin-panel.admin-panel--float .hub-admin-diagnostics,#admin-panel.admin-panel--float .hub-admin-diag-list{font-size:.78rem;color:#c8dbf7}
#admin-panel.admin-panel--float .coins-status{min-height:1.1rem;margin:0;font-size:.8rem;color:#9eb6d8}
#admin-panel.admin-panel--float .coins-status.is-ok{color:#8ce99a}
#admin-panel.admin-panel--float .coins-status.is-error{color:#ff8787}
#admin-panel.admin-panel--float .admin-float-hint{margin:.15rem 0 0;font-size:.72rem;color:#7f96b8}
html.hub-admin-open #overlay.hub-admin-host-pause{visibility:hidden!important;pointer-events:none!important}
.hub-admin-announce-popup{position:fixed;left:50%;bottom:max(1.2rem,env(safe-area-inset-bottom));transform:translateX(-50%);
z-index:13100;max-width:min(28rem,92vw);padding:.7rem 1rem;border-radius:14px;border:1px solid rgba(150,190,255,.3);
background:rgba(12,22,40,.94);color:#eaf3ff;box-shadow:0 12px 32px rgba(0,0,0,.4);display:flex;gap:.65rem;align-items:flex-start}
.hub-admin-announce-popup.hidden{display:none!important}
.hub-admin-announce-tag{flex:0 0 auto;font-size:.68rem;font-weight:800;letter-spacing:.04em;text-transform:uppercase;
color:#9eb6d8;padding:.2rem .45rem;border-radius:999px;border:1px solid rgba(150,190,255,.28)}
.hub-admin-announce-popup p{margin:0;font-size:.88rem;line-height:1.35}
.hub-admin-maintenance-banner{position:fixed;top:0;left:0;right:0;z-index:12900;padding:.45rem .75rem;text-align:center;
background:linear-gradient(90deg,#5c3d1e,#7a4518);color:#fff3bf;font:750 .82rem Outfit,"Segoe UI",system-ui,sans-serif;
border-bottom:1px solid rgba(255,220,150,.25)}
.hub-admin-maintenance-banner.hidden{display:none!important}
body.hub-admin-open{overflow:hidden}
`;
    document.head.appendChild(style);
  }

  /** Build Help-style floating Master Admin when hub #admin-panel is missing (in-game). */
  function ensurePanelDom() {
    ensureChrome();
    if (document.getElementById("admin-panel")) return document.getElementById("admin-panel");
    injectFloatStyles();
    const panel = document.createElement("div");
    panel.id = "admin-panel";
    panel.className = "admin-panel admin-panel--float hidden";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "true");
    panel.setAttribute("aria-labelledby", "admin-panel-title");
    panel.innerHTML = `
      <div class="admin-panel-sheet coins-shop-sheet" role="document">
        <div class="coins-shop-head admin-panel-head">
          <div class="coins-shop-title-wrap">
            <p class="coins-shop-eyebrow">ICE_DRAGON · G</p>
            <h3 id="admin-panel-title">Master Admin</h3>
            <p class="admin-float-hint">Game paused · Esc / G closes</p>
          </div>
          <button type="button" id="admin-panel-close" class="hub-btn coins-shop-close" aria-label="Close admin">Close</button>
        </div>
        <div class="coins-shop-body admin-panel-body">
          <p id="hub-admin-status" class="coins-status" aria-live="polite"></p>
          <section class="hub-admin-section">
            <h4>Announcement</h4>
            <p id="hub-admin-announce-live" class="hub-admin-live">No live announcement</p>
            <div class="hub-admin-form-row">
              <input id="hub-admin-announce-text-input" type="text" maxlength="180" placeholder="Message for every player" autocomplete="off">
              <input id="hub-admin-announce-mins" type="number" min="1" max="1440" value="10" title="Minutes" aria-label="Minutes">
              <button type="button" id="hub-admin-announce-send" class="hub-btn hub-btn-primary">Send</button>
              <button type="button" id="hub-admin-announce-clear" class="hub-btn">Clear</button>
            </div>
          </section>
          <section class="hub-admin-section">
            <h4>Maintenance banner</h4>
            <p id="hub-admin-maint-live" class="hub-admin-live">No maintenance banner</p>
            <div class="hub-admin-form-row">
              <input id="hub-admin-maint-text" type="text" maxlength="180" placeholder="Hub updating — back soon" autocomplete="off">
              <input id="hub-admin-maint-mins" type="number" min="1" max="1440" value="15" title="Minutes" aria-label="Minutes">
              <label class="hub-admin-check"><input id="hub-admin-maint-softlock" type="checkbox"> Soft lock games</label>
              <button type="button" id="hub-admin-maint-send" class="hub-btn hub-btn-primary">Start</button>
              <button type="button" id="hub-admin-maint-clear" class="hub-btn">Clear</button>
            </div>
          </section>
          <section class="hub-admin-section">
            <h4>Players</h4>
            <div class="hub-admin-form-row">
              <input id="hub-admin-players-q" type="search" placeholder="Search name…" autocomplete="off">
              <button type="button" id="hub-admin-players-refresh" class="hub-btn">Refresh</button>
            </div>
            <ul id="hub-admin-players-list" class="hub-admin-list"></ul>
          </section>
          <section class="hub-admin-section">
            <h4>Ban / mute</h4>
            <div class="hub-admin-form-row">
              <input id="hub-admin-mod-name" type="text" maxlength="16" placeholder="Player name" autocomplete="off">
              <input id="hub-admin-mod-reason" type="text" maxlength="120" placeholder="Reason" autocomplete="off">
              <input id="hub-admin-mod-mins" type="number" min="1" max="1440" value="60" title="Minutes" aria-label="Minutes">
              <button type="button" id="hub-admin-mod-ban" class="hub-btn">Ban</button>
              <button type="button" id="hub-admin-mod-mute" class="hub-btn">Mute</button>
            </div>
            <ul id="hub-admin-mod-list" class="hub-admin-list"></ul>
          </section>
          <section class="hub-admin-section">
            <h4>Grants</h4>
            <div class="hub-admin-form-row">
              <input id="hub-admin-grant-name" type="text" maxlength="16" placeholder="Target name" autocomplete="off">
              <select id="hub-admin-grant-kind" aria-label="Grant kind">
                <option value="coins">Coins</option>
                <option value="title">Title</option>
                <option value="color">Color</option>
              </select>
              <input id="hub-admin-grant-value" type="text" placeholder="Amount or id (tester / aurora)" autocomplete="off">
              <button type="button" id="hub-admin-grant-send" class="hub-btn hub-btn-primary" title="Queue for everyone via cloud">Grant</button>
              <button type="button" id="hub-admin-grant-local" class="hub-btn" title="Apply now on this device only">Grant local</button>
            </div>
            <p class="hub-admin-live">Grant local = this device only. Grant = cloud queue.</p>
            <ul id="hub-admin-grants-list" class="hub-admin-list"></ul>
          </section>
          <section class="hub-admin-section">
            <h4>Leaderboard wipe</h4>
            <div class="hub-admin-form-row">
              <select id="hub-admin-lb-game" aria-label="Leaderboard game"></select>
              <input id="hub-admin-lb-name" type="text" maxlength="16" placeholder="Player name" autocomplete="off">
              <button type="button" id="hub-admin-lb-wipe" class="hub-btn">Wipe entry</button>
            </div>
          </section>
          <section class="hub-admin-section">
            <h4>Discord post</h4>
            <div class="hub-admin-form-row hub-admin-form-col">
              <textarea id="hub-admin-discord-text" rows="3" maxlength="1800" placeholder="Message to Discord"></textarea>
              <div class="hub-admin-form-row">
                <select id="hub-admin-discord-dest" aria-label="Discord destination">
                  <option value="main">Main webhook</option>
                  <option value="updates">Updates webhook</option>
                </select>
                <label class="hub-admin-check"><input id="hub-admin-discord-abuse" type="checkbox"> Ping Admin Abuse (main)</label>
                <button type="button" id="hub-admin-discord-send" class="hub-btn hub-btn-primary">Post</button>
              </div>
            </div>
          </section>
          <section class="hub-admin-section">
            <h4>Diagnostics</h4>
            <button type="button" id="hub-admin-diag-refresh" class="hub-btn">Refresh</button>
            <div id="hub-admin-diagnostics" class="hub-admin-diagnostics"></div>
          </section>
        </div>
      </div>
    `;
    document.body.appendChild(panel);
    panel.addEventListener("click", (e) => {
      if (e.target === panel) close();
    });
    return panel;
  }

  function pauseHostGame() {
    wePausedHost = false;
    window.__hubAdminPaused = true;
    try {
      if (isHubGamesScreenOpen()) return;
      const overlay = document.getElementById("overlay");
      const menuBtn = document.getElementById("menu-btn");
      if (!overlay || !menuBtn) {
        if (typeof window.pauseGame === "function") {
          window.pauseGame();
          wePausedHost = true;
        }
        return;
      }
      const overlayHidden = overlay.classList.contains("hidden") || overlay.hidden;
      if (overlayHidden) {
        wePausedHost = true;
        overlay.classList.add("hub-admin-host-pause");
        menuBtn.click();
        overlay.classList.add("hub-admin-host-pause");
        return;
      }
      if (typeof window.pauseGame === "function") {
        window.pauseGame();
        wePausedHost = true;
      }
    } catch {
      wePausedHost = false;
    }
  }

  function resumeHostGame() {
    window.__hubAdminPaused = false;
    try {
      const overlay = document.getElementById("overlay");
      if (overlay) overlay.classList.remove("hub-admin-host-pause");
      if (!wePausedHost) return;
      const resumeBtn = document.getElementById("resume-btn");
      if (resumeBtn && !resumeBtn.classList.contains("hidden") && !resumeBtn.hidden) {
        resumeBtn.click();
      } else if (typeof window.resumeGame === "function") {
        window.resumeGame();
      } else {
        const startBtn = document.getElementById("start-btn");
        if (startBtn && /resume/i.test(startBtn.textContent || "")) startBtn.click();
      }
    } catch {}
    wePausedHost = false;
  }

  function hideAnnouncePopup() {
    if (announceHideTimer) {
      clearTimeout(announceHideTimer);
      announceHideTimer = 0;
    }
    document.getElementById("hub-admin-announce-popup")?.classList.add("hidden");
  }

  function showAnnouncePopup(msg) {
    ensureChrome();
    const popup = document.getElementById("hub-admin-announce-popup");
    const textEl = document.getElementById("hub-admin-announce-text");
    if (!popup || !textEl || !msg) return;
    textEl.textContent = msg.text;
    popup.classList.remove("hidden");
    if (announceHideTimer) clearTimeout(announceHideTimer);
    announceHideTimer = setTimeout(() => {
      announceHideTimer = 0;
      hideAnnouncePopup();
    }, ANNOUNCE_POPUP_MS);
  }

  function markAnnounceSeen(id) {
    lastShownAnnounceId = String(id || "");
    try {
      localStorage.setItem(ANNOUNCE_SEEN_KEY, lastShownAnnounceId);
    } catch {}
  }

  function paintMaintenance() {
    ensureChrome();
    const el = document.getElementById("hub-admin-maintenance-banner");
    const text = document.getElementById("hub-admin-maintenance-text");
    if (!el) return;
    if (!maintenanceCache) {
      el.classList.add("hidden");
      document.body.classList.remove("hub-admin-maintenance-on");
      return;
    }
    if (text) text.textContent = maintenanceCache.message;
    el.classList.remove("hidden");
    document.body.classList.add("hub-admin-maintenance-on");
  }

  function maybeShowAnnounce() {
    if (!announceCache || announceCache.id === lastShownAnnounceId) return;
    showAnnouncePopup(announceCache);
    markAnnounceSeen(announceCache.id);
  }

  function readLocalGrants() {
    try {
      const raw = JSON.parse(localStorage.getItem(LOCAL_GRANTS_KEY) || "[]");
      return Array.isArray(raw) ? raw.filter((g) => g && g.id) : [];
    } catch {
      return [];
    }
  }

  function writeLocalGrants(list) {
    try {
      localStorage.setItem(LOCAL_GRANTS_KEY, JSON.stringify((list || []).slice(-100)));
    } catch {}
  }

  function rememberLocalGrant(grant) {
    const list = readLocalGrants();
    list.push({ ...grant, scope: "local" });
    writeLocalGrants(list);
  }

  /** Apply a grant on this device. Coins only if currently logged in as the target. */
  function applyGrantEffect(grant, opts = {}) {
    const target = nameKey(grant?.targetName);
    const me = nameKey(getPlayerName());
    if (!grant || !target) return { ok: false, error: "Bad grant" };
    const toast = opts.toast !== false;
    const kind = String(grant.kind || "").toLowerCase();

    if (kind === "coins") {
      const n = Math.max(0, Math.min(100000, Math.floor(Number(grant.value) || 0)));
      if (!n) return { ok: false, error: "Bad coin amount" };
      if (me !== target) {
        return {
          ok: false,
          error: `Switch to ${target} on this device to receive coins (or use Local while logged in as them)`
        };
      }
      if (typeof HubCoins === "undefined") return { ok: false, error: "Coins unavailable" };
      HubCoins.earn(n, "admin-grant");
      if (toast) {
        try {
          window.showGamesMessage?.(`Admin grant: +${n} coins`, 2800);
        } catch {}
      }
      return { ok: true, applied: "coins", amount: n };
    }

    if (kind === "title") {
      const id = String(grant.value || "").toLowerCase();
      if (!id || !HubPlays?.TITLE_DEFS?.[id]) return { ok: false, error: "Unknown title" };
      addUnlock(target, "title", id);
      if (toast && me === target) {
        try {
          window.showGamesMessage?.(`Admin grant: title ${HubPlays.TITLE_DEFS[id].label}`, 2800);
        } catch {}
      }
      return { ok: true, applied: "title", id };
    }

    if (kind === "color") {
      const id = String(grant.value || "").toLowerCase();
      const okExtra = !!HubPlays?.EXTRA_COLORS?.[id];
      const okBasic = (HubPlays?.COLOR_OPTIONS || []).some((c) => c.id === id);
      if (!okExtra && !okBasic) return { ok: false, error: "Unknown color" };
      addUnlock(target, "color", id);
      if (toast && me === target) {
        try {
          window.showGamesMessage?.(`Admin grant: color ${id}`, 2800);
        } catch {}
      }
      return { ok: true, applied: "color", id };
    }

    return { ok: false, error: "Unknown grant kind" };
  }

  async function applyPendingGrants() {
    const me = nameKey(getPlayerName());
    if (!me) return;
    const seen = readSeenGrants();
    const mine = (grantsCache.grants || []).filter((g) => g.targetName === me);
    let changed = false;
    for (const g of mine) {
      if (seen.has(g.id)) continue;
      if (g.claimedBy?.includes(me)) {
        seen.add(g.id);
        changed = true;
        continue;
      }
      const res = applyGrantEffect(g, { toast: true });
      if (!res.ok && g.kind === "coins") {
        // Wallet may be mid-switch; keep pending
        continue;
      }
      seen.add(g.id);
      changed = true;
      g.claimedBy = [...new Set([...(g.claimedBy || []), me])];
    }
    if (changed) {
      writeSeenGrants(seen);
      try {
        await upsertDoc(DOC.grants, {
          token: TOKEN,
          grants: grantsCache.grants
        });
      } catch {}
    }
  }

  async function refreshRemote() {
    const [a, m, mod, g] = await Promise.all([
      getDoc(DOC.announce),
      getDoc(DOC.maintenance),
      getDoc(DOC.moderation),
      getDoc(DOC.grants)
    ]);
    announceCache = parseAnnounce(a);
    maintenanceCache = parseMaintenance(m);
    moderationCache = parseModeration(mod || {});
    grantsCache = parseGrants(g || {});
    paintMaintenance();
    maybeShowAnnounce();
    await applyPendingGrants();
    if (isOpen()) refreshUi();
  }

  function setStatus(msg, kind) {
    const el = document.getElementById("hub-admin-status");
    if (!el) return;
    el.textContent = msg || "";
    el.classList.toggle("is-error", kind === "error");
    el.classList.toggle("is-ok", kind === "ok");
    if (statusTimer) clearTimeout(statusTimer);
    if (msg) {
      statusTimer = setTimeout(() => {
        el.textContent = "";
        el.classList.remove("is-error", "is-ok");
      }, 4000);
    }
  }

  function fmtUntil(until) {
    const left = Math.max(0, (Number(until) || 0) - Date.now());
    const m = Math.ceil(left / 60000);
    if (m <= 0) return "ended";
    if (m < 60) return `${m}m left`;
    return `${Math.floor(m / 60)}h ${m % 60}m left`;
  }

  function formatCode(raw) {
    if (typeof HubPlays?.formatPlayerCode === "function") {
      return HubPlays.formatPlayerCode(raw) || String(raw || "");
    }
    return String(raw || "");
  }

  function lookupCodeForName(name) {
    const key = nameKey(name);
    if (!key || typeof HubPlays === "undefined") return "";
    try {
      const claim = HubPlays.getClaimForName?.(name);
      if (claim?.playerCode) return formatCode(claim.playerCode);
    } catch {}
    try {
      const roster = HubPlays.getAllTimePlayers?.() || [];
      const hit = roster.find((p) => nameKey(p.name) === key);
      if (hit?.playerCode) return formatCode(hit.playerCode);
    } catch {}
    return "";
  }

  function renderPlayersList() {
    const list = document.getElementById("hub-admin-players-list");
    const q = String(document.getElementById("hub-admin-players-q")?.value || "")
      .trim()
      .toLowerCase();
    if (!list) return;
    const online = HubPlays?.getOnlinePlayers?.() || [];
    const all = HubPlays?.getAllTimePlayers?.() || [];
    const byKey = new Map();
    all.forEach((p) => {
      const key = nameKey(p.name);
      if (!key) return;
      byKey.set(key, {
        name: p.name,
        playerId: p.playerId || "",
        online: false,
        game: ""
      });
    });
    online.forEach((p) => {
      const key = nameKey(p.name);
      if (!key) return;
      byKey.set(key, {
        name: p.name,
        playerId: p.playerId || byKey.get(key)?.playerId || "",
        online: true,
        game: p.gameName || p.game || "Hub"
      });
    });
    let rows = [...byKey.values()].sort((a, b) => {
      if (a.online !== b.online) return a.online ? -1 : 1;
      return String(a.name).localeCompare(String(b.name));
    });
    if (q) {
      rows = rows.filter(
        (r) =>
          String(r.name).toLowerCase().includes(q) ||
          String(r.playerId).toLowerCase().includes(q)
      );
    }
    rows = rows.slice(0, 80);
    if (!rows.length) {
      list.innerHTML = `<li class="hub-admin-empty">No players match.</li>`;
      return;
    }
    list.innerHTML = rows
      .map((r) => {
        const code = lookupCodeForName(r.name);
        const norm = String(code || "").replace(/[^a-z0-9]/gi, "").toUpperCase();
        const revealed = norm && revealedCodes.has(norm);
        return `<li class="hub-admin-row${r.online ? " is-online" : ""}" data-admin-player="${escapeHtml(
          r.name
        )}" data-admin-pid="${escapeHtml(r.playerId)}">
          <span class="hub-admin-meta">
            <strong>${escapeHtml(r.name)}${r.online ? " · online" : ""}</strong>
            <span class="hub-admin-sub">${escapeHtml(r.online ? r.game : "offline")}</span>
            <span class="player-accounts-code${revealed ? "" : " is-masked"}">${
              revealed && code ? escapeHtml(code) : "••••-••••"
            }</span>
          </span>
          <span class="hub-admin-actions">
            <button type="button" class="hub-btn" data-admin-reveal-code="${escapeHtml(
              code
            )}" ${code ? "" : "disabled"}>${revealed ? "Hide" : "Show"}</button>
            <button type="button" class="hub-btn" data-admin-copy-code="${escapeHtml(
              code
            )}" ${code && revealed ? "" : "disabled"}>Copy</button>
            <button type="button" class="hub-btn" data-admin-kick="${escapeHtml(
              r.playerId
            )}" ${r.playerId && r.online ? "" : "disabled"}>Kick</button>
          </span>
        </li>`;
      })
      .join("");
  }

  function renderModerationList() {
    const list = document.getElementById("hub-admin-mod-list");
    if (!list) return;
    const rows = [];
    Object.entries(moderationCache.bans || {}).forEach(([k, v]) => {
      rows.push({ kind: "ban", key: k, ...v });
    });
    Object.entries(moderationCache.mutes || {}).forEach(([k, v]) => {
      rows.push({ kind: "mute", key: k, ...v });
    });
    rows.sort((a, b) => (b.at || 0) - (a.at || 0));
    if (!rows.length) {
      list.innerHTML = `<li class="hub-admin-empty">No bans or mutes.</li>`;
      return;
    }
    list.innerHTML = rows
      .map(
        (r) => `<li class="hub-admin-row">
        <span class="hub-admin-meta">
          <strong>${escapeHtml(r.key)} · ${r.kind}</strong>
          <span class="hub-admin-sub">${escapeHtml(r.reason || "no reason")} · ${fmtUntil(
          r.until
        )}</span>
        </span>
        <button type="button" class="hub-btn" data-admin-unmod="${escapeHtml(r.kind)}" data-admin-unmod-name="${escapeHtml(
          r.key
        )}">Clear</button>
      </li>`
      )
      .join("");
  }

  function renderGrantsList() {
    const list = document.getElementById("hub-admin-grants-list");
    if (!list) return;
    const cloud = (grantsCache.grants || []).map((g) => ({ ...g, scope: "cloud" }));
    const local = readLocalGrants();
    const rows = [...cloud, ...local]
      .sort((a, b) => (b.at || 0) - (a.at || 0))
      .slice(0, 40);
    if (!rows.length) {
      list.innerHTML = `<li class="hub-admin-empty">No grants yet.</li>`;
      return;
    }
    list.innerHTML = rows
      .map(
        (g) => `<li class="hub-admin-row">
        <span class="hub-admin-meta">
          <strong>${escapeHtml(g.targetName)} · ${escapeHtml(g.kind)}${
          g.scope === "local" ? " · local" : ""
        }</strong>
          <span class="hub-admin-sub">${escapeHtml(String(g.value))} · ${
          g.scope === "local"
            ? "this device"
            : g.claimedBy?.length
              ? "claimed"
              : "pending"
        }</span>
        </span>
      </li>`
      )
      .join("");
  }

  function fillLeaderboardGames() {
    const sel = document.getElementById("hub-admin-lb-game");
    if (!sel || sel.options.length) return;
    const ids = HubLeaderboard?.GAME_IDS || [];
    const meta = HubLeaderboard?.GAME_META || {};
    sel.innerHTML = ids
      .map((id) => {
        const label = meta[id]?.label || id;
        return `<option value="${escapeHtml(id)}">${escapeHtml(label)}</option>`;
      })
      .join("");
  }

  function renderDiagnostics() {
    const el = document.getElementById("hub-admin-diagnostics");
    if (!el) return;
    const online = HubPlays?.getOnlineCount?.() ?? "—";
    const build = window.WORDLE_BUILD || "—";
    const sbOk = !!(sb() && sb().ready);
    const afk = !!window.HubAfk?.isAfk?.();
    const maint = maintenanceCache
      ? `${maintenanceCache.message} (${fmtUntil(maintenanceCache.until)})`
      : "none";
    const ann = announceCache ? `${announceCache.text.slice(0, 40)}…` : "none";
    el.innerHTML = `<ul class="hub-admin-diag-list">
      <li><strong>Build</strong> ${escapeHtml(build)}</li>
      <li><strong>Owner</strong> ${isOwner() ? "yes (ICE_DRAGON)" : "no"}</li>
      <li><strong>Online</strong> ${escapeHtml(String(online))}</li>
      <li><strong>Supabase</strong> ${sbOk ? "ready" : "unavailable"}</li>
      <li><strong>AFK pause</strong> ${afk ? "yes" : "no"}</li>
      <li><strong>Announce</strong> ${escapeHtml(ann)}</li>
      <li><strong>Maintenance</strong> ${escapeHtml(maint)}</li>
      <li><strong>Bans</strong> ${Object.keys(moderationCache.bans || {}).length} · <strong>Mutes</strong> ${
      Object.keys(moderationCache.mutes || {}).length
    }</li>
    </ul>`;
  }

  function refreshUi() {
    if (!isOwner()) return;
    const liveAnn = document.getElementById("hub-admin-announce-live");
    if (liveAnn) {
      liveAnn.textContent = announceCache
        ? `Live: ${announceCache.text} (${fmtUntil(announceCache.until)})`
        : "No live announcement";
    }
    const liveMaint = document.getElementById("hub-admin-maint-live");
    if (liveMaint) {
      liveMaint.textContent = maintenanceCache
        ? `Live: ${maintenanceCache.message} · softLock=${maintenanceCache.softLock ? "on" : "off"} (${fmtUntil(
            maintenanceCache.until
          )})`
        : "No maintenance banner";
    }
    fillLeaderboardGames();
    renderPlayersList();
    renderModerationList();
    renderGrantsList();
    renderDiagnostics();
    updateToolbarButton();
  }

  function updateToolbarButton() {
    const btn = document.getElementById("toggle-admin-btn");
    if (!btn) return;
    const show = isOwner();
    btn.hidden = !show;
    btn.classList.toggle("hidden", !show);
    if (show) {
      btn.setAttribute("aria-expanded", isOpen() ? "true" : "false");
      btn.textContent = isOpen() ? "Hide Admin" : "Admin";
    }
  }

  function isOpen() {
    const panel = document.getElementById("admin-panel");
    return !!(panel && !panel.classList.contains("hidden"));
  }

  function open() {
    if (!isOwner()) return;
    const panel = ensurePanelDom();
    if (!panel) return;
    try {
      window.HubHelp?.close?.();
    } catch {}
    try {
      window.setCoinsShopOpen?.(false);
    } catch {}
    try {
      document.getElementById("coins-panel")?.classList.add("hidden");
      document.body.classList.remove("coins-shop-open");
    } catch {}
    panel.classList.remove("hidden");
    document.body.classList.add("hub-admin-open");
    document.documentElement.classList.add("hub-admin-open");
    document.getElementById("games-screen")?.classList.add("shop-open");
    bindPanel();
    if (isFloatAdminPanel(panel)) pauseHostGame();
    const grantName = document.getElementById("hub-admin-grant-name");
    if (grantName && !String(grantName.value || "").trim()) {
      grantName.value = getPlayerName() || "ICE_DRAGON";
    }
    refreshRemote().finally(() => refreshUi());
    document.getElementById("admin-panel-close")?.focus?.();
    updateToolbarButton();
  }

  function close() {
    const panel = document.getElementById("admin-panel");
    if (!panel) return;
    const wasFloat = isFloatAdminPanel(panel);
    panel.classList.add("hidden");
    document.body.classList.remove("hub-admin-open");
    document.documentElement.classList.remove("hub-admin-open");
    document.getElementById("games-screen")?.classList.remove("shop-open");
    if (wasFloat) resumeHostGame();
    updateToolbarButton();
  }

  function toggle() {
    if (isOpen()) close();
    else open();
  }

  async function adminSendAnnounce() {
    if (!isOwner()) return;
    const text = sanitizeAnnounceText(document.getElementById("hub-admin-announce-text-input")?.value);
    const minutes = clampMinutes(document.getElementById("hub-admin-announce-mins")?.value, 10);
    if (!text) {
      setStatus("Enter an announcement", "error");
      return;
    }
    const payload = {
      token: TOKEN,
      id: makeId(),
      text,
      by: "ICE_DRAGON",
      at: Date.now(),
      until: Date.now() + minutes * 60_000
    };
    try {
      await upsertDoc(DOC.announce, payload);
      announceCache = parseAnnounce(payload);
      setStatus(`Announcement live for ${minutes}m`, "ok");
      refreshUi();
    } catch (err) {
      setStatus(err?.message || "Failed to send", "error");
    }
  }

  async function adminClearAnnounce() {
    if (!isOwner()) return;
    try {
      await upsertDoc(DOC.announce, { token: TOKEN, id: "", text: "", until: 0 });
      announceCache = null;
      hideAnnouncePopup();
      setStatus("Announcement cleared", "ok");
      refreshUi();
    } catch (err) {
      setStatus(err?.message || "Failed to clear", "error");
    }
  }

  async function adminSendMaintenance() {
    if (!isOwner()) return;
    const message = sanitizeAnnounceText(
      document.getElementById("hub-admin-maint-text")?.value || "Hub maintenance"
    );
    const minutes = clampMinutes(document.getElementById("hub-admin-maint-mins")?.value, 15);
    const softLock = !!document.getElementById("hub-admin-maint-softlock")?.checked;
    if (!message) {
      setStatus("Enter a maintenance message", "error");
      return;
    }
    const payload = {
      token: TOKEN,
      message,
      softLock,
      by: "ICE_DRAGON",
      at: Date.now(),
      until: Date.now() + minutes * 60_000
    };
    try {
      await upsertDoc(DOC.maintenance, payload);
      maintenanceCache = parseMaintenance(payload);
      paintMaintenance();
      setStatus(`Maintenance for ${minutes}m`, "ok");
      refreshUi();
    } catch (err) {
      setStatus(err?.message || "Failed to set maintenance", "error");
    }
  }

  async function adminClearMaintenance() {
    if (!isOwner()) return;
    try {
      await upsertDoc(DOC.maintenance, { token: TOKEN, message: "", until: 0, softLock: false });
      maintenanceCache = null;
      paintMaintenance();
      setStatus("Maintenance cleared", "ok");
      refreshUi();
    } catch (err) {
      setStatus(err?.message || "Failed to clear", "error");
    }
  }

  async function adminAddMod(kind) {
    if (!isOwner()) return;
    const name = nameKey(document.getElementById("hub-admin-mod-name")?.value);
    const reason = sanitizeAnnounceText(document.getElementById("hub-admin-mod-reason")?.value || "");
    const minutes = clampMinutes(document.getElementById("hub-admin-mod-mins")?.value, 60);
    if (!name) {
      setStatus("Enter a player name", "error");
      return;
    }
    if (name === OWNER_KEY) {
      setStatus("Cannot ban/mute ICE_DRAGON", "error");
      return;
    }
    const next = parseModeration({
      bans: { ...(moderationCache.bans || {}) },
      mutes: { ...(moderationCache.mutes || {}) },
      token: TOKEN
    });
    const entry = {
      reason: reason || (kind === "ban" ? "Banned by admin" : "Muted by admin"),
      until: Date.now() + minutes * 60_000,
      at: Date.now(),
      by: "ICE_DRAGON"
    };
    if (kind === "ban") next.bans[name] = entry;
    else next.mutes[name] = entry;
    try {
      await upsertDoc(DOC.moderation, { token: TOKEN, bans: next.bans, mutes: next.mutes });
      moderationCache = next;
      setStatus(`${kind} applied to ${name}`, "ok");
      refreshUi();
    } catch (err) {
      setStatus(err?.message || "Failed", "error");
    }
  }

  async function adminClearMod(kind, name) {
    if (!isOwner()) return;
    const key = nameKey(name);
    const next = {
      bans: { ...(moderationCache.bans || {}) },
      mutes: { ...(moderationCache.mutes || {}) }
    };
    if (kind === "ban") delete next.bans[key];
    else delete next.mutes[key];
    try {
      await upsertDoc(DOC.moderation, { token: TOKEN, bans: next.bans, mutes: next.mutes });
      moderationCache = parseModeration(next);
      setStatus(`Cleared ${kind} for ${key}`, "ok");
      refreshUi();
    } catch (err) {
      setStatus(err?.message || "Failed", "error");
    }
  }

  function readGrantForm() {
    const targetName = nameKey(document.getElementById("hub-admin-grant-name")?.value);
    const kind = String(document.getElementById("hub-admin-grant-kind")?.value || "").toLowerCase();
    const valueRaw = String(document.getElementById("hub-admin-grant-value")?.value || "").trim();
    if (!targetName) return { ok: false, error: "Enter target name" };
    let value = valueRaw;
    if (kind === "coins") {
      value = Math.max(1, Math.min(100000, Math.floor(Number(valueRaw) || 0)));
      if (!value) return { ok: false, error: "Enter coin amount" };
    } else if (kind === "title") {
      value = valueRaw.toLowerCase();
      if (!HubPlays?.TITLE_DEFS?.[value]) {
        return { ok: false, error: "Unknown title id (e.g. tester, inviter, legend)" };
      }
    } else if (kind === "color") {
      value = valueRaw.toLowerCase();
      const ok =
        !!HubPlays?.EXTRA_COLORS?.[value] ||
        (HubPlays?.COLOR_OPTIONS || []).some((c) => c.id === value);
      if (!ok) return { ok: false, error: "Unknown color id (e.g. aurora, blue, tide)" };
    } else {
      return { ok: false, error: "Pick grant kind" };
    }
    return {
      ok: true,
      grant: {
        id: makeId(),
        targetName,
        kind,
        value,
        at: Date.now(),
        by: "ICE_DRAGON",
        claimedBy: []
      }
    };
  }

  function adminGrantLocal() {
    if (!isOwner()) return;
    const form = readGrantForm();
    if (!form.ok) {
      setStatus(form.error, "error");
      return;
    }
    const grant = form.grant;
    const res = applyGrantEffect(grant, { toast: true });
    if (!res.ok) {
      setStatus(res.error || "Local grant failed", "error");
      return;
    }
    rememberLocalGrant(grant);
    const seen = readSeenGrants();
    seen.add(grant.id);
    writeSeenGrants(seen);
    setStatus(`Local grant applied for ${grant.targetName} (this device)`, "ok");
    refreshUi();
    try {
      HubCoins?.refreshUi?.();
    } catch {}
  }

  async function adminGrant() {
    if (!isOwner()) return;
    const form = readGrantForm();
    if (!form.ok) {
      setStatus(form.error, "error");
      return;
    }
    const grant = form.grant;
    const next = {
      token: TOKEN,
      grants: [...(grantsCache.grants || []), grant].slice(-200)
    };
    try {
      await upsertDoc(DOC.grants, next);
      grantsCache = parseGrants(next);
      // Apply immediately on this device if it's for the logged-in name
      if (nameKey(getPlayerName()) === grant.targetName) {
        applyGrantEffect(grant, { toast: true });
        const seen = readSeenGrants();
        seen.add(grant.id);
        writeSeenGrants(seen);
        grant.claimedBy = [grant.targetName];
        try {
          await upsertDoc(DOC.grants, { token: TOKEN, grants: next.grants });
        } catch {}
      }
      setStatus(`Grant queued for ${grant.targetName}`, "ok");
      refreshUi();
    } catch (err) {
      // Cloud down — still give on this device
      const res = applyGrantEffect(grant, { toast: true });
      if (res.ok) {
        rememberLocalGrant(grant);
        const seen = readSeenGrants();
        seen.add(grant.id);
        writeSeenGrants(seen);
        setStatus(`Cloud down — applied locally for ${grant.targetName}`, "ok");
        refreshUi();
        try {
          HubCoins?.refreshUi?.();
        } catch {}
      } else {
        setStatus(
          `${err?.message || "Cloud failed"}; local: ${res.error || "failed"}`,
          "error"
        );
      }
    }
  }

  async function adminWipeLeaderboard() {
    if (!isOwner()) return;
    const gameId = String(document.getElementById("hub-admin-lb-game")?.value || "");
    const playerName = String(document.getElementById("hub-admin-lb-name")?.value || "").trim();
    if (!gameId || !playerName) {
      setStatus("Pick a board and player name", "error");
      return;
    }
    const board = HubLeaderboard?.getBoard?.(gameId) || [];
    const hit = board.find((r) => nameKey(r.name) === nameKey(playerName));
    const preview = hit
      ? `${hit.name}: ${HubLeaderboard.formatScore?.(gameId, hit.score) || hit.score}`
      : "(no entry found — wipe anyway?)";
    if (!confirm(`Wipe leaderboard entry?\n\n${gameId}\n${preview}`)) {
      setStatus("Wipe cancelled", "error");
      return;
    }
    try {
      await HubLeaderboard.clearPlayer(gameId, playerName);
      setStatus(`Wiped ${playerName} from ${gameId}`, "ok");
      try {
        window.renderLeaderboardsPanel?.();
      } catch {}
    } catch (err) {
      setStatus(err?.message || "Wipe failed", "error");
    }
  }

  async function adminDiscordPost() {
    if (!isOwner()) return;
    const text = String(document.getElementById("hub-admin-discord-text")?.value || "").trim();
    const dest = String(document.getElementById("hub-admin-discord-dest")?.value || "main");
    const pingAbuse = !!document.getElementById("hub-admin-discord-abuse")?.checked;
    if (!text) {
      setStatus("Enter a Discord message", "error");
      return;
    }
    if (typeof HubDiscord === "undefined") {
      setStatus("Discord helper missing", "error");
      return;
    }
    try {
      let res;
      if (dest === "updates") {
        res = await HubDiscord.announceSiteUpdate?.(window.WORDLE_BUILD || "", [text]);
      } else if (pingAbuse) {
        res = await HubDiscord.announceEvent?.("Hub admin", text);
      } else {
        const home =
          (typeof location !== "undefined" &&
            /^https?:$/i.test(location.protocol) &&
            location.origin &&
            `${location.origin}/`) ||
          "https://icedragon1st.github.io/";
        res = await HubDiscord.announce?.(`**ICE_DRAGON**\n${text}\n${home}`, {
          username: "My Games Admin"
        });
      }
      if (res?.ok) setStatus("Posted to Discord", "ok");
      else setStatus(`Discord: ${res?.reason || "failed"}`, "error");
    } catch (err) {
      setStatus(err?.message || "Discord failed", "error");
    }
  }

  function bindPanel() {
    if (panelBound) return;
    const panel = document.getElementById("admin-panel");
    if (!panel) return;
    panelBound = true;

    document.getElementById("admin-panel-close")?.addEventListener("click", () => close());
    document.getElementById("hub-admin-announce-send")?.addEventListener("click", () => {
      adminSendAnnounce();
    });
    document.getElementById("hub-admin-announce-clear")?.addEventListener("click", () => {
      adminClearAnnounce();
    });
    document.getElementById("hub-admin-maint-send")?.addEventListener("click", () => {
      adminSendMaintenance();
    });
    document.getElementById("hub-admin-maint-clear")?.addEventListener("click", () => {
      adminClearMaintenance();
    });
    document.getElementById("hub-admin-players-q")?.addEventListener("input", () => {
      renderPlayersList();
    });
    document.getElementById("hub-admin-players-refresh")?.addEventListener("click", () => {
      HubPlays?.heartbeat?.().finally(() => renderPlayersList());
    });
    document.getElementById("hub-admin-mod-ban")?.addEventListener("click", () => adminAddMod("ban"));
    document.getElementById("hub-admin-mod-mute")?.addEventListener("click", () => adminAddMod("mute"));
    document.getElementById("hub-admin-grant-send")?.addEventListener("click", () => adminGrant());
    document.getElementById("hub-admin-grant-local")?.addEventListener("click", () => adminGrantLocal());
    document.getElementById("hub-admin-lb-wipe")?.addEventListener("click", () => adminWipeLeaderboard());
    document.getElementById("hub-admin-discord-send")?.addEventListener("click", () => adminDiscordPost());
    document.getElementById("hub-admin-diag-refresh")?.addEventListener("click", () => {
      refreshRemote().finally(() => refreshUi());
    });

    panel.addEventListener("click", async (e) => {
      const reveal = e.target.closest("[data-admin-reveal-code]");
      if (reveal) {
        const code = reveal.getAttribute("data-admin-reveal-code") || "";
        const norm = code.replace(/[^a-z0-9]/gi, "").toUpperCase();
        if (norm) {
          if (revealedCodes.has(norm)) revealedCodes.delete(norm);
          else revealedCodes.add(norm);
        }
        renderPlayersList();
        return;
      }
      const copy = e.target.closest("[data-admin-copy-code]");
      if (copy) {
        const code = copy.getAttribute("data-admin-copy-code") || "";
        try {
          await navigator.clipboard.writeText(code);
          setStatus("Code copied", "ok");
        } catch {
          setStatus("Copy failed", "error");
        }
        return;
      }
      const kick = e.target.closest("[data-admin-kick]");
      if (kick) {
        const pid = kick.getAttribute("data-admin-kick") || "";
        if (!pid) return;
        try {
          const ok = await HubPlays?.kickPlayer?.(pid);
          setStatus(ok ? "Kicked from online list" : "Kick failed", ok ? "ok" : "error");
          renderPlayersList();
        } catch (err) {
          setStatus(err?.message || "Kick failed", "error");
        }
        return;
      }
      const unmod = e.target.closest("[data-admin-unmod]");
      if (unmod) {
        adminClearMod(
          unmod.getAttribute("data-admin-unmod"),
          unmod.getAttribute("data-admin-unmod-name")
        );
      }
    });
  }

  function onKeyDown(e) {
    if (!e) return;
    if (isOpen() && (e.key === "Escape" || e.code === "Escape")) {
      e.preventDefault();
      e.stopPropagation();
      if (typeof e.stopImmediatePropagation === "function") e.stopImmediatePropagation();
      close();
      return;
    }
    if (isTypingTarget(e.target)) return;
    if (!isOwner()) return;
    const wantG =
      (e.key === "g" || e.key === "G" || e.code === "KeyG") &&
      !e.ctrlKey &&
      !e.metaKey &&
      !e.altKey;
    if (!wantG) return;
    e.preventDefault();
    e.stopPropagation();
    if (typeof e.stopImmediatePropagation === "function") e.stopImmediatePropagation();
    toggle();
  }

  function start() {
    ensureChrome();
    // In games, pre-build the floating panel so G opens instantly for the owner.
    if (!document.getElementById("admin-panel") && isOwner()) ensurePanelDom();
    updateToolbarButton();
    refreshRemote().catch(() => {});
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = setInterval(() => {
      if (document.hidden) return;
      refreshRemote().catch(() => {});
      updateToolbarButton();
      if (!document.getElementById("admin-panel") && isOwner()) ensurePanelDom();
    }, POLL_MS);
    document.getElementById("toggle-admin-btn")?.addEventListener("click", () => {
      if (!isOwner()) return;
      toggle();
    });
    document.addEventListener("keydown", onKeyDown, true);
  }

  window.HubAdmin = {
    isOwner,
    start,
    open,
    close,
    toggle,
    isOpen,
    getBan,
    getMute,
    getMaintenance,
    isSoftLocked,
    getUnlocksFor,
    applyPendingGrants,
    refreshUi,
    ping: refreshRemote
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => start());
  } else {
    start();
  }
})();
