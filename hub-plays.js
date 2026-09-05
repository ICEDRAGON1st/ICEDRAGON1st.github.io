/**
 * hub-plays.js — nickname + shared recent-players log.
 * Uses MantleDB (browser-only) so the site owner can see who played.
 * Nicknames are unique (case-insensitive) via a dedicated name-registry store.
 */
(function () {
  const NAME_KEY = "hub-player-name";
  const PLAYER_ID_KEY = "hub-player-id";
  const NAME_LOCK_KEY = "hub-player-name-locked";
  const LOCAL_KEY = "hub-plays-local-v1";
  const PROFILE_STYLE_KEY = "hub-profile-style-v1";
  const NS = "icedragon1st-mygames";
  const PLAYS_PATH = "plays-log";
  const NAMES_PATH = "name-registry";
  const PRESENCE_PATH = "presence";
  const ALLTIME_PATH = "players-alltime";
  const PLAYS_API = `https://mantledb.sh/v2/${NS}/${PLAYS_PATH}`;
  const NAMES_API = `https://mantledb.sh/v2/${NS}/${NAMES_PATH}`;
  const PRESENCE_API = `https://mantledb.sh/v2/${NS}/${PRESENCE_PATH}`;
  const ALLTIME_API = `https://mantledb.sh/v2/${NS}/${ALLTIME_PATH}`;
  const MAX_PLAYS = 60;
  const SYNC_GAP_MS = 4000;
  const HEARTBEAT_MS = 60_000;
  const ONLINE_TTL_MS = 150_000; // count as online for ~2.5 min
  const PRESENCE_KEEP_MS = 10 * 60_000;
  const MAX_PRESENCE = 120;
  const MAX_ALLTIME = 5000;

  const GAME_NAMES = {
    wordle: "Wordle",
    space: "Space Shooter",
    quiz: "Quizmaster",
    breakout: "Brick Breaker",
    hangman: "Hangman",
    "2048": "2048",
    snake: "Snake",
    memory: "Memory Match",
    "connect-four": "Connect Four",
    math: "Math Sprint",
    sudoku: "Sudoku",
    flappy: "Flappy Bird",
    tictactoe: "Tic Tac Toe",
    pixletris: "Pixletris"
  };

  let syncing = false;
  let lastSync = 0;
  let cache = { plays: [], counts: {} };
  let namesCache = {};
  let presenceCache = {};
  let allTimeCache = {};
  let presenceTimer = null;
  let heartbeatBusy = false;
  let allTimeBusy = false;

  function sanitizeName(raw) {
    return String(raw || "")
      .replace(/[<>&"'`]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 16);
  }

  function nameKey(name) {
    return sanitizeName(name).toLowerCase();
  }

  function makeId() {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function getPlayerId() {
    try {
      let id = localStorage.getItem(PLAYER_ID_KEY);
      if (!id) {
        id = `p-${makeId()}`;
        localStorage.setItem(PLAYER_ID_KEY, id);
      }
      return id;
    } catch {
      return `p-${makeId()}`;
    }
  }

  function getName() {
    try {
      return sanitizeName(localStorage.getItem(NAME_KEY) || "");
    } catch {
      return "";
    }
  }

  function storeLocalName(name) {
    try {
      if (name) localStorage.setItem(NAME_KEY, name);
      else localStorage.removeItem(NAME_KEY);
    } catch {}
  }

  function isNameLocked() {
    try {
      return localStorage.getItem(NAME_LOCK_KEY) === "1";
    } catch {
      return false;
    }
  }

  function setNameLocked(locked) {
    const next = !!locked;
    try {
      if (next) localStorage.setItem(NAME_LOCK_KEY, "1");
      else localStorage.removeItem(NAME_LOCK_KEY);
    } catch {}
    return next;
  }

  function loadLocal() {
    try {
      const data = JSON.parse(localStorage.getItem(LOCAL_KEY));
      if (data && Array.isArray(data.plays)) {
        return {
          plays: data.plays.slice(0, MAX_PLAYS),
          counts: data.counts && typeof data.counts === "object" ? data.counts : {}
        };
      }
    } catch {}
    return { plays: [], counts: {} };
  }

  function saveLocal(data) {
    cache = data;
    try {
      localStorage.setItem(LOCAL_KEY, JSON.stringify(data));
    } catch {}
  }

  function gameLabel(id) {
    return GAME_NAMES[id] || id;
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

  async function fetchPlaysRemote() {
    const data = await fetchJson(PLAYS_API);
    if (!data) return { plays: [], counts: {} };
    return {
      plays: Array.isArray(data.plays) ? data.plays : [],
      counts: data.counts && typeof data.counts === "object" ? data.counts : {}
    };
  }

  async function pushPlaysRemote(data) {
    await postJson(PLAYS_API, {
      plays: data.plays || [],
      counts: data.counts || {}
    });
  }

  async function fetchNamesRemote() {
    const data = await fetchJson(NAMES_API);
    if (!data || typeof data !== "object") return {};
    const names = data.names && typeof data.names === "object" ? data.names : data;
    // Ignore accidental non-claim fields
    const out = {};
    Object.entries(names).forEach(([k, v]) => {
      if (v && typeof v === "object" && v.playerId && v.name) out[k] = v;
    });
    return out;
  }

  async function pushNamesRemote(names) {
    await postJson(NAMES_API, { names });
  }

  function mergeLogs(a, b) {
    const map = new Map();
    [...(a.plays || []), ...(b.plays || [])].forEach((p) => {
      if (!p || !p.id) return;
      map.set(p.id, p);
    });
    const plays = [...map.values()]
      .sort((x, y) => (y.at || 0) - (x.at || 0))
      .slice(0, MAX_PLAYS);
    const counts = { ...(a.counts || {}) };
    Object.entries(b.counts || {}).forEach(([k, v]) => {
      counts[k] = Math.max(Number(counts[k]) || 0, Number(v) || 0);
    });
    return { plays, counts };
  }

  function mergeNameMaps(a, b) {
    const out = { ...(a || {}) };
    Object.entries(b || {}).forEach(([key, claim]) => {
      if (!claim || !claim.playerId) return;
      const existing = out[key];
      if (!existing) {
        out[key] = claim;
        return;
      }
      if (existing.playerId === claim.playerId) {
        const existingUpdated = Number(existing.profileUpdatedAt) || 0;
        const claimUpdated = Number(claim.profileUpdatedAt) || 0;
        const newer = claimUpdated >= existingUpdated ? claim : existing;
        const older = newer === claim ? existing : claim;
        const pickStyle = (field) => {
          if (newer[field] != null && newer[field] !== "") return newer[field];
          if (older[field] != null && older[field] !== "") return older[field];
          if (Object.prototype.hasOwnProperty.call(newer, field)) return newer[field] || "";
          if (Object.prototype.hasOwnProperty.call(older, field)) return older[field] || "";
          return "";
        };
        out[key] = {
          ...older,
          ...newer,
          legend: !!(existing.legend || claim.legend),
          legendAt: Math.max(Number(existing.legendAt) || 0, Number(claim.legendAt) || 0) || undefined,
          activeTitle: pickStyle("activeTitle"),
          accentTitle: pickStyle("accentTitle"),
          accentColor: pickStyle("accentColor"),
          profileUpdatedAt: Math.max(existingUpdated, claimUpdated) || undefined,
          claimedAt: Math.min(
            Number(existing.claimedAt) || Infinity,
            Number(claim.claimedAt) || Infinity
          )
        };
        if (out[key].claimedAt === Infinity) out[key].claimedAt = newer.claimedAt || older.claimedAt;
        if (!out[key].legendAt) delete out[key].legendAt;
        if (!out[key].profileUpdatedAt) delete out[key].profileUpdatedAt;
        return;
      }
      // First claimer wins
      if ((claim.claimedAt || 0) < (existing.claimedAt || 0)) out[key] = claim;
    });
    return out;
  }

  function loadLocalProfileStyle() {
    try {
      const raw = JSON.parse(localStorage.getItem(PROFILE_STYLE_KEY) || "null");
      if (!raw || typeof raw !== "object") return null;
      if (raw.playerId && raw.playerId !== getPlayerId()) return null;
      return raw;
    } catch {
      return null;
    }
  }

  function saveLocalProfileStyle(claim, key = nameKey(getName())) {
    if (!claim || !key) return;
    try {
      localStorage.setItem(
        PROFILE_STYLE_KEY,
        JSON.stringify({
          playerId: getPlayerId(),
          nameKey: key,
          activeTitle: claim.activeTitle || "",
          accentTitle: claim.accentTitle || "",
          accentColor: claim.accentColor || "",
          profileUpdatedAt: Number(claim.profileUpdatedAt) || Date.now()
        })
      );
    } catch {}
  }

  function applyLocalProfileStyle(names) {
    const local = loadLocalProfileStyle();
    if (!local || !local.nameKey) return names || {};
    const key = local.nameKey;
    const claim = (names || {})[key];
    if (!claim || claim.playerId !== getPlayerId()) return names || {};
    const localAt = Number(local.profileUpdatedAt) || 0;
    const remoteAt = Number(claim.profileUpdatedAt) || 0;
    if (remoteAt > localAt) return names || {};
    return {
      ...(names || {}),
      [key]: {
        ...claim,
        activeTitle: local.activeTitle || claim.activeTitle || "",
        accentTitle: local.accentTitle || claim.accentTitle || "",
        accentColor:
          local.accentColor != null && local.accentColor !== ""
            ? local.accentColor
            : claim.accentColor || "",
        profileUpdatedAt: Math.max(localAt, remoteAt) || Date.now()
      }
    };
  }

  async function sync(force = false) {
    if (syncing) return cache;
    if (!force && Date.now() - lastSync < SYNC_GAP_MS) return cache;
    syncing = true;
    try {
      const local = loadLocal();
      let remote = { plays: [], counts: {} };
      try {
        remote = await fetchPlaysRemote();
      } catch {
        remote = { plays: [], counts: {} };
      }
      const merged = mergeLogs(local, remote);
      saveLocal(merged);
      try {
        await pushPlaysRemote(merged);
      } catch {
        // offline — local still works
      }
      try {
        const remoteNames = await fetchNamesRemote();
        namesCache = applyLocalProfileStyle(mergeNameMaps(namesCache, remoteNames));
        // If local style is ahead of remote, push so refresh stays sticky.
        const key = nameKey(getName());
        const mine = key ? namesCache[key] : null;
        const localStyle = loadLocalProfileStyle();
        if (
          mine &&
          localStyle &&
          mine.playerId === getPlayerId() &&
          (Number(localStyle.profileUpdatedAt) || 0) >= (Number(mine.profileUpdatedAt) || 0)
        ) {
          try {
            await pushNamesRemote(namesCache);
          } catch {}
        }
        refreshCreatorCredits();
      } catch {}
      lastSync = Date.now();
      cache = merged;
      return merged;
    } finally {
      syncing = false;
    }
  }

  /**
   * Claim a unique nickname. Requires the shared registry (online).
   * Returns { ok, name?, error? }.
   */
  async function claimName(raw) {
    const next = sanitizeName(raw);
    if (!next) {
      return { ok: false, error: "Enter a nickname" };
    }
    if (next.toLowerCase() === "player") {
      return { ok: false, error: "Pick a unique nickname — “Player” is reserved" };
    }
    if (/^guest-/i.test(next)) {
      return { ok: false, error: "Pick a real username — guest names aren’t allowed" };
    }

    const current = getName();
    if (isNameLocked() && current && nameKey(current) !== nameKey(next)) {
      return { ok: false, error: "Name is locked — unlock it to change" };
    }

    const me = getPlayerId();
    const key = nameKey(next);
    const myClaimAt = Date.now();

    // Retry a few times so two devices racing still settle on first claimer
    for (let attempt = 0; attempt < 4; attempt++) {
      let remoteNames;
      try {
        remoteNames = await fetchNamesRemote();
      } catch {
        return {
          ok: false,
          error: "Can't check names right now — check your connection and try again"
        };
      }

      const existing = remoteNames[key];
      if (existing && existing.playerId !== me) {
        namesCache = remoteNames;
        return { ok: false, error: `"${existing.name}" is already taken` };
      }

      const nextNames = { ...remoteNames };
      let keepLegend = !!existing?.legend;
      Object.keys(nextNames).forEach((k) => {
        if (k !== key && nextNames[k]?.playerId === me) {
          if (nextNames[k]?.legend) keepLegend = true;
          delete nextNames[k];
        }
      });

      nextNames[key] = {
        playerId: me,
        name: next,
        claimedAt: existing?.claimedAt || myClaimAt,
        legend: keepLegend,
        activeTitle: existing?.activeTitle || "",
        accentTitle: existing?.accentTitle || "",
        accentColor: existing?.accentColor || "",
        profileUpdatedAt: existing?.profileUpdatedAt || myClaimAt
      };

      try {
        await pushNamesRemote(nextNames);
      } catch {
        return {
          ok: false,
          error: "Couldn't save that name — check your connection and try again"
        };
      }

      let confirmed;
      try {
        confirmed = await fetchNamesRemote();
      } catch {
        return {
          ok: false,
          error: "Couldn't verify that name — try again"
        };
      }

      // Prefer earliest claim if two writes raced and dropped keys
      const reconciled = mergeNameMaps(nextNames, confirmed);
      const owner = reconciled[key];

      if (owner && owner.playerId === me) {
        try {
          await pushNamesRemote(reconciled);
        } catch {}
        namesCache = reconciled;
        storeLocalName(next);
        registerAllTime().catch(() => {});
        try {
          if (typeof HubLeaderboard !== "undefined" && HubLeaderboard.rebindPlayerName) {
            HubLeaderboard.rebindPlayerName(me, next).catch(() => {});
          }
        } catch {}
        return { ok: true, name: next };
      }

      if (owner && owner.playerId !== me) {
        namesCache = reconciled;
        try {
          await pushNamesRemote(reconciled);
        } catch {}
        return { ok: false, error: `"${owner.name}" is already taken` };
      }

      // Owner missing after race — retry
    }

    return { ok: false, error: "Couldn't claim that name — try again" };
  }

  /** @deprecated use claimName */
  function setName(name) {
    const next = sanitizeName(name);
    storeLocalName(next);
    return next;
  }

  function makeGuestName() {
    return `Guest-${Math.random().toString(36).slice(2, 6)}`;
  }

  function hasRequiredName() {
    const name = getName();
    if (!name) return false;
    if (/^guest-/i.test(name)) return false;
    if (name.toLowerCase() === "player") return false;
    return true;
  }

  function ensureUsernameGateStyles() {
    if (document.getElementById("username-gate-style")) return;
    const style = document.createElement("style");
    style.id = "username-gate-style";
    style.textContent = `
#username-gate-modal,
#player-name-modal.username-gate-force {
  position: fixed !important;
  inset: 0 !important;
  z-index: 20000 !important;
  display: flex !important;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.72);
  padding: 1rem;
}
#username-gate-modal.hidden,
#player-name-modal.username-gate-force.hidden {
  display: none !important;
}
#username-gate-modal .username-gate-card {
  width: min(24rem, 100%);
  background: #121821;
  color: #f5f7fb;
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: 14px;
  padding: 1.25rem 1.2rem 1.1rem;
  box-shadow: 0 18px 50px rgba(0,0,0,0.45);
}
#username-gate-modal h2 {
  margin: 0 0 0.45rem;
  font-size: 1.25rem;
}
#username-gate-modal p {
  margin: 0 0 0.85rem;
  color: rgba(220,228,240,0.8);
  font-size: 0.92rem;
  line-height: 1.4;
}
#username-gate-modal input {
  width: 100%;
  box-sizing: border-box;
  margin: 0 0 0.65rem;
  padding: 0.7rem 0.8rem;
  border-radius: 8px;
  border: 1px solid rgba(255,255,255,0.18);
  background: #0b1018;
  color: inherit;
  font: inherit;
}
#username-gate-modal .username-gate-status {
  min-height: 1.2rem;
  margin: 0 0 0.75rem;
  font-size: 0.85rem;
  color: #ff8e8e;
}
#username-gate-modal .username-gate-status.is-ok {
  color: #69db7c;
}
#username-gate-modal button {
  width: 100%;
  border: 0;
  border-radius: 8px;
  padding: 0.75rem 1rem;
  font: inherit;
  font-weight: 700;
  cursor: pointer;
  background: #1c7ed6;
  color: #fff;
}
#username-gate-modal button:disabled {
  opacity: 0.65;
  cursor: wait;
}
body.username-gate-open {
  overflow: hidden !important;
}
body.username-gate-open > *:not(#username-gate-modal):not(#player-name-modal):not(#username-gate-style) {
  pointer-events: none !important;
}
#username-gate-modal,
#player-name-modal.username-gate-force {
  pointer-events: auto !important;
}`;
    document.head.appendChild(style);
  }

  function setGateStatus(el, msg, ok) {
    if (!el) return;
    el.textContent = msg || "";
    el.classList.toggle("is-ok", !!ok);
  }

  async function submitUsernameGate(input, statusEl, btn) {
    const value = input?.value || "";
    setGateStatus(statusEl, "Checking name…", false);
    if (btn) btn.disabled = true;
    try {
      const result = await claimName(value);
      if (!result.ok) {
        setGateStatus(statusEl, result.error || "Name unavailable", false);
        return false;
      }
      setGateStatus(statusEl, `Playing as ${result.name}`, true);
      document.body.classList.remove("username-gate-open");
      const hubModal = document.getElementById("player-name-modal");
      hubModal?.classList.add("hidden");
      hubModal?.classList.remove("username-gate-force");
      document.getElementById("username-gate-modal")?.classList.add("hidden");
      const hubInput = document.getElementById("player-name-input");
      if (hubInput) hubInput.value = result.name;
      registerAllTime().catch(() => {});
      document.dispatchEvent(
        new CustomEvent("hub-username-ready", { detail: { name: result.name } })
      );
      return true;
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  function isUsernameGateOpen() {
    if (hasRequiredName()) return false;
    const hubModal = document.getElementById("player-name-modal");
    if (hubModal && !hubModal.classList.contains("hidden")) return true;
    const gate = document.getElementById("username-gate-modal");
    return !!(gate && !gate.classList.contains("hidden"));
  }

  /**
   * Blocking popup: players must enter a unique username before playing.
   */
  function enforceUsernameGate() {
    if (hasRequiredName()) return true;
    ensureUsernameGateStyles();
    document.body.classList.add("username-gate-open");

    // Prefer the dedicated gate modal everywhere so typing works reliably
    let modal = document.getElementById("username-gate-modal");
    if (!modal) {
      modal = document.createElement("div");
      modal.id = "username-gate-modal";
      modal.setAttribute("role", "dialog");
      modal.setAttribute("aria-modal", "true");
      modal.setAttribute("aria-labelledby", "username-gate-title");
      modal.innerHTML = `
        <div class="username-gate-card">
          <h2 id="username-gate-title">Pick a username</h2>
          <p>You need a unique nickname to play. Once someone takes a name, nobody else can use it.</p>
          <input id="username-gate-input" type="text" maxlength="16" placeholder="e.g. ICE_DRAGON" autocomplete="nickname">
          <div id="username-gate-status" class="username-gate-status" aria-live="polite"></div>
          <button id="username-gate-save" type="button">Save & play</button>
        </div>`;
      document.body.appendChild(modal);
      const input = modal.querySelector("#username-gate-input");
      const status = modal.querySelector("#username-gate-status");
      const btn = modal.querySelector("#username-gate-save");
      btn.addEventListener("click", () => submitUsernameGate(input, status, btn));
      input.addEventListener("keydown", (e) => {
        e.stopPropagation();
        if (e.key === "Enter") submitUsernameGate(input, status, btn);
      });
      input.addEventListener("keyup", (e) => e.stopPropagation());
      input.addEventListener("keypress", (e) => e.stopPropagation());
      modal.addEventListener("click", (e) => {
        if (e.target === modal) input.focus();
      });
    }

    // Hide the old hub modal so only one popup is shown
    const hubModal = document.getElementById("player-name-modal");
    if (hubModal) {
      hubModal.classList.add("hidden");
      hubModal.classList.remove("username-gate-force");
    }

    modal.classList.remove("hidden");
    const input = modal.querySelector("#username-gate-input");
    setTimeout(() => input?.focus(), 0);
    return false;
  }

  function isNameTaken(name, playerId) {
    const key = nameKey(name);
    if (!key) return false;
    const claim = namesCache[key];
    return !!(claim && claim.playerId && claim.playerId !== playerId);
  }

  function record(gameId) {
    if (!hasRequiredName()) {
      enforceUsernameGate();
      return null;
    }
    const id = String(gameId || "unknown");
    const name = getName();
    const entry = {
      id: makeId(),
      playerId: getPlayerId(),
      name,
      game: id,
      gameName: gameLabel(id),
      at: Date.now()
    };
    const local = loadLocal();
    local.plays = [entry, ...local.plays].slice(0, MAX_PLAYS);
    local.counts[id] = (Number(local.counts[id]) || 0) + 1;
    saveLocal(local);
    sync().catch(() => {});
    registerAllTime().catch(() => {});
    return entry;
  }

  function getStatus() {
    const data = cache.plays.length ? cache : loadLocal();
    return {
      name: getName(),
      playerId: getPlayerId(),
      plays: data.plays,
      counts: data.counts,
      names: namesCache,
      online: getOnlineCount(),
      allTime: getAllTimeCount()
    };
  }

  function formatWhen(ts) {
    const diff = Math.max(0, Date.now() - ts);
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }

  async function fetchPresenceRemote() {
    const data = await fetchJson(PRESENCE_API);
    if (!data || typeof data !== "object") return {};
    const players = data.players && typeof data.players === "object" ? data.players : data;
    const out = {};
    Object.entries(players).forEach(([id, p]) => {
      if (!id || !p || typeof p !== "object") return;
      const at = Number(p.at) || 0;
      if (!at) return;
      out[id] = { at, name: sanitizeName(p.name || "") || "Guest" };
    });
    return out;
  }

  async function pushPresenceRemote(players) {
    await postJson(PRESENCE_API, { players });
  }

  function mergePresence(a, b) {
    const out = { ...(a || {}) };
    Object.entries(b || {}).forEach(([id, p]) => {
      if (!p) return;
      const existing = out[id];
      if (!existing || (p.at || 0) >= (existing.at || 0)) out[id] = p;
    });
    return out;
  }

  function prunePresence(map, now = Date.now()) {
    const entries = Object.entries(map || {})
      .filter(([, p]) => p && now - (p.at || 0) < PRESENCE_KEEP_MS)
      .sort((a, b) => (b[1].at || 0) - (a[1].at || 0))
      .slice(0, MAX_PRESENCE);
    const out = {};
    entries.forEach(([id, p]) => {
      out[id] = p;
    });
    return out;
  }

  function countOnline(map, now = Date.now()) {
    return Object.values(map || {}).filter(
      (p) =>
        p &&
        now - (p.at || 0) < ONLINE_TTL_MS &&
        !isPlaceholderName(p.name)
    ).length;
  }

  function enrichPresenceNames(map) {
    const fromPlays = namesFromPlays(cache.plays || loadLocal().plays || []);
    const out = { ...(map || {}) };
    Object.keys(out).forEach((id) => {
      const playName = fromPlays[id]?.name;
      if (playName) {
        out[id] = {
          ...out[id],
          name: preferPlayerName(out[id]?.name, playName)
        };
      }
    });
    return out;
  }

  function getOnlineCount() {
    return countOnline(enrichPresenceNames(presenceCache));
  }

  function getOnlinePlayers() {
    const now = Date.now();
    return Object.entries(enrichPresenceNames(presenceCache))
      .filter(([, p]) => p && now - (p.at || 0) < ONLINE_TTL_MS)
      .map(([playerId, p]) => ({
        playerId,
        name: sanitizeName(p.name || "") || "Guest",
        at: Number(p.at) || 0
      }))
      .filter((p) => !isPlaceholderName(p.name))
      .sort((a, b) => (b.at || 0) - (a.at || 0));
  }

  /**
   * Ping the shared presence store. Returns current online count.
   */
  async function heartbeat() {
    if (heartbeatBusy) return getOnlineCount();
    heartbeatBusy = true;
    try {
      const me = getPlayerId();
      let remote = {};
      try {
        remote = await fetchPresenceRemote();
      } catch {
        return getOnlineCount();
      }

      const now = Date.now();
      // Don't publish Guest placeholders — they inflate the online count
      let next = prunePresence(remote, now);
      if (hasRequiredName()) {
        next = prunePresence(
          mergePresence(next, {
            [me]: { at: now, name: getName() }
          }),
          now
        );
      } else if (next[me] && isPlaceholderName(next[me].name)) {
        delete next[me];
      }

      // Drop other stale Guest presence entries from the shared map
      Object.keys(next).forEach((id) => {
        if (isPlaceholderName(next[id]?.name)) delete next[id];
      });

      try {
        await pushPresenceRemote(next);
      } catch {
        presenceCache = enrichPresenceNames(mergePresence(presenceCache, next));
        return countOnline(presenceCache, now);
      }

      let confirmed = next;
      try {
        confirmed = prunePresence(mergePresence(next, await fetchPresenceRemote()), now);
        Object.keys(confirmed).forEach((id) => {
          if (isPlaceholderName(confirmed[id]?.name)) delete confirmed[id];
        });
        await pushPresenceRemote(confirmed);
      } catch {
        confirmed = next;
      }

      presenceCache = enrichPresenceNames(confirmed);
      registerAllTime().catch(() => {});
      return countOnline(presenceCache, now);
    } finally {
      heartbeatBusy = false;
    }
  }

  async function fetchAllTimeRemote() {
    const data = await fetchJson(ALLTIME_API);
    if (!data || typeof data !== "object") return {};
    const players = data.players && typeof data.players === "object" ? data.players : data;
    const out = {};
    Object.entries(players).forEach(([id, p]) => {
      if (!id || id === "players" || id === "total") return;
      if (!p || typeof p !== "object") return;
      const firstAt = Number(p.firstAt) || Number(p.at) || 0;
      if (!firstAt) return;
      out[id] = { firstAt, name: sanitizeName(p.name || "") || "Guest" };
    });
    return out;
  }

  async function pushAllTimeRemote(players) {
    await postJson(ALLTIME_API, {
      players,
      total: Object.keys(players).length
    });
  }

  function isPlaceholderName(name) {
    const n = sanitizeName(name || "").toLowerCase();
    return !n || n === "guest" || n.startsWith("guest-") || n === "player";
  }

  function preferPlayerName(a, b) {
    const left = sanitizeName(a || "");
    const right = sanitizeName(b || "");
    if (isPlaceholderName(left) && !isPlaceholderName(right)) return right;
    if (!isPlaceholderName(left)) return left || right || "Guest";
    return right || left || "Guest";
  }

  function mergeAllTime(a, b) {
    const out = { ...(a || {}) };
    Object.entries(b || {}).forEach(([id, p]) => {
      if (!p) return;
      const existing = out[id];
      if (!existing) {
        out[id] = {
          firstAt: Number(p.firstAt) || Number(p.at) || Date.now(),
          name: preferPlayerName(p.name, "")
        };
        return;
      }
      const firstAt = Math.min(
        existing.firstAt || Infinity,
        Number(p.firstAt) || Number(p.at) || Infinity
      );
      out[id] = {
        firstAt: firstAt === Infinity ? Date.now() : firstAt,
        name: preferPlayerName(existing.name, p.name)
      };
    });
    return out;
  }

  function trimAllTime(map) {
    const entries = Object.entries(map || {});
    if (entries.length <= MAX_ALLTIME) return map || {};
    entries.sort((a, b) => (a[1].firstAt || 0) - (b[1].firstAt || 0));
    const out = {};
    entries.slice(0, MAX_ALLTIME).forEach(([id, p]) => {
      out[id] = p;
    });
    return out;
  }

  function namesFromPlays(plays) {
    const fromPlays = {};
    (plays || []).forEach((p) => {
      if (!p || !p.playerId) return;
      const prev = fromPlays[p.playerId];
      const firstAt = Math.min(prev?.firstAt || Infinity, Number(p.at) || Date.now());
      fromPlays[p.playerId] = {
        firstAt: firstAt === Infinity ? Date.now() : firstAt,
        name: preferPlayerName(prev?.name, p.name)
      };
    });
    return fromPlays;
  }

  function namesFromRegistry(names) {
    const out = {};
    Object.values(names || {}).forEach((claim) => {
      if (!claim || !claim.playerId) return;
      const name = sanitizeName(claim.name || "");
      if (isPlaceholderName(name)) return;
      const prev = out[claim.playerId];
      const claimedAt = Number(claim.claimedAt) || Date.now();
      out[claim.playerId] = {
        firstAt: Math.min(prev?.firstAt || Infinity, claimedAt) === Infinity
          ? claimedAt
          : Math.min(prev?.firstAt || claimedAt, claimedAt),
        name: preferPlayerName(prev?.name, name)
      };
    });
    return out;
  }

  function buildAllTimeMap(remote, plays, names, meEntry) {
    return trimAllTime(
      mergeAllTime(
        mergeAllTime(
          mergeAllTime(remote || {}, namesFromPlays(plays)),
          namesFromRegistry(names)
        ),
        meEntry || {}
      )
    );
  }

  function allTimeNeedsWrite(remote, next) {
    const remoteKeys = Object.keys(remote || {});
    const nextKeys = Object.keys(next || {});
    if (nextKeys.length !== remoteKeys.length) return true;
    for (const id of nextKeys) {
      if (!remote[id]) return true;
      if (preferPlayerName(remote[id].name, "") !== preferPlayerName(next[id].name, "")) {
        return true;
      }
      const remoteFirst = Number(remote[id].firstAt) || 0;
      const nextFirst = Number(next[id].firstAt) || 0;
      if (nextFirst && remoteFirst && nextFirst < remoteFirst) return true;
    }
    return false;
  }

  function getAllTimeCount() {
    const enriched = buildAllTimeMap(
      allTimeCache,
      cache.plays || loadLocal().plays || [],
      namesCache
    );
    return Object.values(enriched).filter((p) => !isPlaceholderName(p?.name)).length;
  }

  function getAllTimePlayers() {
    const enriched = buildAllTimeMap(
      allTimeCache,
      cache.plays || loadLocal().plays || [],
      namesCache
    );
    return Object.entries(enriched)
      .map(([playerId, p]) => ({
        playerId,
        name: sanitizeName(p.name || "") || "Guest",
        firstAt: Number(p.firstAt) || 0
      }))
      .filter((p) => !isPlaceholderName(p.name))
      .sort((a, b) => (a.firstAt || 0) - (b.firstAt || 0));
  }

  /**
   * Register this browser once in the all-time player set.
   * Coming back online does not increase the count again.
   */
  async function registerAllTime() {
    if (allTimeBusy) return getAllTimeCount();
    allTimeBusy = true;
    try {
      const me = getPlayerId();
      let remote = {};
      try {
        remote = await fetchAllTimeRemote();
      } catch {
        return getAllTimeCount();
      }

      let plays = cache.plays || loadLocal().plays || [];
      try {
        const remotePlays = await fetchPlaysRemote();
        plays = mergeLogs(loadLocal(), remotePlays).plays;
        cache = mergeLogs(loadLocal(), remotePlays);
      } catch {}

      try {
        const remoteNames = await fetchNamesRemote();
        namesCache = mergeNameMaps(namesCache, remoteNames);
      } catch {}

      const now = Date.now();
      const myName = getName();
      const meEntry =
        myName && !isPlaceholderName(myName)
          ? { [me]: { firstAt: now, name: myName } }
          : {};
      const next = buildAllTimeMap(remote, plays, namesCache, meEntry);

      if (!allTimeNeedsWrite(remote, next)) {
        allTimeCache = next;
        return getAllTimeCount();
      }

      try {
        await pushAllTimeRemote(next);
      } catch {
        allTimeCache = mergeAllTime(allTimeCache, next);
        return getAllTimeCount();
      }

      let confirmed = next;
      try {
        confirmed = buildAllTimeMap(
          await fetchAllTimeRemote(),
          plays,
          namesCache,
          meEntry
        );
        await pushAllTimeRemote(confirmed);
      } catch {
        confirmed = next;
      }

      allTimeCache = confirmed;
      return getAllTimeCount();
    } finally {
      allTimeBusy = false;
    }
  }

  function startPresence() {
    if (presenceTimer) return;
    heartbeat().catch(() => {});
    presenceTimer = setInterval(() => {
      heartbeat().catch(() => {});
    }, HEARTBEAT_MS);
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) heartbeat().catch(() => {});
    });
  }

  getPlayerId();
  startPresence();
  enforceUsernameGate();

  function creatorCreditHtml() {
    const name = "ICE_DRAGON";
    const accent = getAccentColor(name);
    const extra = EXTRA_COLORS[accent];
    let nameClass = "player-name-creator";
    let nameStyle = "";
    if (extra?.nameClass) {
      nameClass = extra.nameClass;
    } else if (accent === "#f1c40f") {
      nameClass = "player-name-legend";
    } else if (accent === "#2f9e44") {
      nameClass = "player-name-oscar";
    } else if (accent === "#1c7ed6") {
      nameClass = "player-name-creator";
    } else if (accent === "#e03131") {
      nameClass = "player-name-tester";
    } else if (accent) {
      nameClass = "player-name-custom";
      nameStyle = ` style="color:${accent}"`;
    }

    const badge = getActiveTitleBadge(name);
    let badgeHtml = "";
    if (badge) {
      const extraClass = badge.colorClass ? ` ${badge.colorClass}` : "";
      const style =
        badge.color && !badge.colorClass
          ? ` style="background:${badge.color};color:${badge.textColor || "#fff"}"`
          : badge.colorClass
            ? ` style="color:${badge.textColor || "#fff"}"`
            : "";
      badgeHtml = `<span class="player-title ${badge.className}${extraClass}" title="${badge.label}"${style}>${badge.label}</span>`;
    }

    return `created by <span class="${nameClass}"${nameStyle}>${name}</span>${badgeHtml}`;
  }

  function refreshCreatorCredits() {
    const html = creatorCreditHtml();
    document.querySelectorAll("#site-credit, .menu-credit").forEach((el) => {
      el.innerHTML = html;
    });
  }

  function injectCreatorCredit() {
    if (!document.getElementById("site-credit-style")) {
      const style = document.createElement("style");
      style.id = "site-credit-style";
      style.textContent = `
.site-credit {
  position: fixed;
  z-index: 40;
  right: 0.85rem;
  top: 50%;
  transform: translateY(-50%);
  margin: 0;
  padding: 0;
  writing-mode: vertical-rl;
  text-orientation: mixed;
  letter-spacing: 0.16em;
  font-size: 1.15rem;
  font-weight: 700;
  color: rgba(160, 170, 185, 0.9);
  pointer-events: none;
  user-select: none;
  white-space: nowrap;
}
.site-credit .player-title,
.menu-credit .player-title {
  writing-mode: horizontal-tb;
  margin-left: 0.35rem;
}
.site-credit .player-name-aurora,
.menu-credit .player-name-aurora,
.site-credit .player-name-mono,
.menu-credit .player-name-mono,
.site-credit .player-name-legend,
.menu-credit .player-name-legend,
.site-credit .player-name-oscar,
.menu-credit .player-name-oscar,
.site-credit .player-name-tester,
.menu-credit .player-name-tester,
.site-credit .player-name-custom,
.menu-credit .player-name-custom,
.site-credit .player-name-creator,
.menu-credit .player-name-creator {
  font-weight: 800;
}
body.light .site-credit,
body.light .menu-credit {
  color: rgba(90, 100, 115, 0.85);
}
.menu-credit {
  margin: 1rem 0 0;
  text-align: center;
  font-size: 1rem;
  font-weight: 600;
  letter-spacing: 0.03em;
  color: rgba(160, 170, 185, 0.95);
}
@media (max-width: 640px) {
  .site-credit {
    right: auto;
    left: 50%;
    top: auto;
    bottom: 0.35rem;
    transform: translateX(-50%);
    writing-mode: horizontal-tb;
    letter-spacing: 0.04em;
    font-size: 0.72rem;
  }
  .menu-credit {
    font-size: 0.9rem;
  }
}`;
      document.head.appendChild(style);
    }

    if (!document.getElementById("site-credit")) {
      const el = document.createElement("p");
      el.id = "site-credit";
      el.className = "site-credit";
      el.setAttribute("aria-label", "Created by ICE_DRAGON");
      el.innerHTML = creatorCreditHtml();
      document.body.appendChild(el);
    }

    const menus = document.querySelectorAll(
      "#menu-modal .modal-content, .overlay-card, #games-screen .games-screen-inner"
    );
    menus.forEach((box) => {
      if (box.querySelector(".menu-credit")) return;
      const credit = document.createElement("p");
      credit.className = "menu-credit";
      credit.setAttribute("aria-label", "Created by ICE_DRAGON");
      credit.innerHTML = creatorCreditHtml();
      if (box.classList.contains("games-screen-inner")) {
        const header = box.querySelector(".games-header");
        if (header && header.nextSibling) {
          box.insertBefore(credit, header.nextSibling);
        } else {
          box.appendChild(credit);
        }
      } else {
        box.appendChild(credit);
      }
    });

    refreshCreatorCredits();
  }

  const TITLE_DEFS = {
    owner: { id: "owner", label: "OWNER", className: "player-title-owner" },
    og: { id: "og", label: "OG", className: "player-title-og" },
    tester: { id: "tester", label: "TESTER", className: "player-title-tester" },
    legend: { id: "legend", label: "LEGEND", className: "player-title-legend" }
  };

  const TITLE_COLORS = {
    owner: "#1c7ed6",
    og: "#2f9e44",
    tester: "#e03131",
    legend: "#f1c40f"
  };

  const EXTRA_COLORS = {
    aurora: {
      id: "aurora",
      label: "Aurora",
      className: "player-color-aurora",
      nameClass: "player-name-aurora",
      titleClass: "player-title-aurora",
      animated: true
    },
    mono: {
      id: "mono",
      label: "Mono",
      className: "player-color-mono",
      nameClass: "player-name-mono",
      titleClass: "player-title-mono",
      animated: true
    }
  };

  const EXTRA_COLOR_GRANTS = {
    aurora: new Set(["ice_dragon", "oscarvr29"]),
    mono: new Set(["ice_dragon", "hjalte"])
  };

  const COLOR_OPTIONS = [
    { id: "default", label: "Default", value: "" },
    { id: "blue", label: "Blue", value: "#1c7ed6" },
    { id: "green", label: "Green", value: "#2f9e44" },
    { id: "yellow", label: "Yellow", value: "#f1c40f" },
    { id: "red", label: "Red", value: "#e03131" },
    { id: "orange", label: "Orange", value: "#f76707" },
    { id: "purple", label: "Purple", value: "#9c36b5" },
    { id: "pink", label: "Pink", value: "#d6336c" },
    { id: "cyan", label: "Cyan", value: "#15aabf" },
    { id: "white", label: "White", value: "#f1f3f5" }
  ];

  function sanitizeColor(raw) {
    const value = String(raw || "").trim().toLowerCase();
    if (!value) return "";
    if (/^#[0-9a-f]{6}$/.test(value)) return value;
    return "";
  }

  function contrastText(bg) {
    const hex = sanitizeColor(bg);
    if (!hex) return "#ffffff";
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const luma = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luma > 0.62 ? "#1a1a1a" : "#ffffff";
  }

  function isLegendName(name) {
    const key = nameKey(name);
    if (!key) return false;
    const claim = namesCache[key];
    return !!(claim && claim.legend);
  }

  function getClaimForName(name) {
    const key = nameKey(name);
    return key ? namesCache[key] || null : null;
  }

  const OG_NAME_KEYS = new Set([
    "oscarvr29",
    "ice_dragon",
    "ice_dragon phone",
    "oskar",
    "hjalte",
    "red4_live"
  ]);

  const TESTER_NAME_KEYS = new Set(["ice_dragon", "hjalte"]);

  function getAvailableTitleIds(name = getName()) {
    const ids = [];
    const key = nameKey(name);
    if (!key) return ids;
    if (key === "ice_dragon") ids.push("owner");
    if (OG_NAME_KEYS.has(key)) ids.push("og");
    if (TESTER_NAME_KEYS.has(key)) ids.push("tester");
    // ICE_DRAGON: reserved titles only (no LEGEND path on this account).
    if (key === "ice_dragon") return ids;
    const selfLegend =
      key === nameKey(getName()) &&
      typeof HubAchievements !== "undefined" &&
      HubAchievements.hasAllUnlocked?.();
    if (isLegendName(name) || selfLegend) ids.push("legend");
    return ids;
  }

  /** Titles shown in Players UI (includes locked ones). */
  function getTitleShowcase(name = getName()) {
    const key = nameKey(name);
    const unlocked = new Set(getAvailableTitleIds(name));
    const ids =
      key === "ice_dragon"
        ? ["owner", "og", "tester", "legend"]
        : ["og", "tester", "legend"];
    return ids.map((id) => {
      const def = TITLE_DEFS[id];
      return {
        id,
        label: def.label,
        className: def.className,
        unlocked: unlocked.has(id),
        color: TITLE_COLORS[id] || "#888888"
      };
    });
  }

  function getActiveTitleId(name = getName()) {
    const claim = getClaimForName(name);
    const available = getAvailableTitleIds(name);
    if (!available.length) return "";
    const chosen = String(claim?.activeTitle || "").toLowerCase();
    if (chosen === "none") {
      // Reserved titles stay visible unless the player also has LEGEND to hide.
      if (!available.includes("legend")) return available[0];
      return "none";
    }
    if (chosen && available.includes(chosen)) return chosen;
    return available[0];
  }

  function getExtraColorIds(name = getName()) {
    const key = nameKey(name);
    return Object.keys(EXTRA_COLOR_GRANTS).filter((id) =>
      EXTRA_COLOR_GRANTS[id].has(key)
    );
  }

  function isExtraAccentId(id) {
    return !!(id && EXTRA_COLORS[String(id).toLowerCase()]);
  }

  /** Color swatches in Players UI (title colors + special color-only unlocks). */
  function getColorShowcase(name = getName()) {
    const colors = getTitleShowcase(name).map((t) => ({
      ...t,
      kind: "title"
    }));
    const unlockedExtras = new Set(getExtraColorIds(name));
    Object.values(EXTRA_COLORS).forEach((def) => {
      colors.push({
        id: def.id,
        label: def.label,
        className: def.className,
        unlocked: unlockedExtras.has(def.id),
        color: "",
        kind: "color",
        animated: !!def.animated
      });
    });
    return colors;
  }

  function getActiveTitleBadge(name = getName()) {
    const id = getActiveTitleId(name);
    if (!id || id === "none") return null;
    const def = TITLE_DEFS[id];
    if (!def) return null;
    const color = getAccentColor(name);
    // Badge always follows the chosen accent (including animated extras).
    if (isExtraAccentId(color) && EXTRA_COLORS[color].titleClass) {
      return {
        ...def,
        colorClass: EXTRA_COLORS[color].titleClass,
        textColor: "#ffffff"
      };
    }
    if (color) {
      return {
        ...def,
        color,
        textColor: contrastText(color)
      };
    }
    return { ...def };
  }

  function getUnlockedTitleColors(name = getName()) {
    return getAvailableTitleIds(name)
      .map((id) => ({ id, color: TITLE_COLORS[id] || "" }))
      .filter((x) => x.color);
  }

  function canMixTitleColors(name = getName()) {
    return canPickAccentColors(name);
  }

  function canPickAccentColors(name = getName()) {
    return getAvailableTitleIds(name).length > 1 || getExtraColorIds(name).length > 0;
  }

  function getAccentColor(name = getName()) {
    const claim = getClaimForName(name);
    const accentTitle = String(claim?.accentTitle || "").toLowerCase();
    const accentColorRaw = String(claim?.accentColor || "").toLowerCase();
    const extraId = isExtraAccentId(accentTitle)
      ? accentTitle
      : isExtraAccentId(accentColorRaw)
        ? accentColorRaw
        : "";
    if (extraId && getExtraColorIds(name).includes(extraId)) {
      return extraId;
    }

    const available = getAvailableTitleIds(name);
    if (!available.length) return "";
    const unlockedColors = new Set(
      available.map((id) => TITLE_COLORS[id]).filter(Boolean)
    );

    if (accentTitle && available.includes(accentTitle) && TITLE_COLORS[accentTitle]) {
      return TITLE_COLORS[accentTitle];
    }

    const saved = sanitizeColor(claim?.accentColor || "");
    if (saved && unlockedColors.has(saved)) return saved;

    const activeId = getActiveTitleId(name);
    return TITLE_COLORS[activeId] || "";
  }

  function getActiveAccentTitleId(name = getName()) {
    const claim = getClaimForName(name);
    const accentTitle = String(claim?.accentTitle || "").toLowerCase();
    const accentColorRaw = String(claim?.accentColor || "").toLowerCase();
    const extraId = isExtraAccentId(accentTitle)
      ? accentTitle
      : isExtraAccentId(accentColorRaw)
        ? accentColorRaw
        : "";
    if (extraId && getExtraColorIds(name).includes(extraId)) {
      return extraId;
    }
    const color = getAccentColor(name);
    if (isExtraAccentId(color)) return color;
    const match = getUnlockedTitleColors(name).find((x) => x.color === color);
    return match?.id || getActiveTitleId(name) || "";
  }

  function getDefaultAccentForName(name = getName()) {
    const color = getAccentColor(name);
    return isExtraAccentId(color) ? "" : color;
  }

  async function patchMyClaim(updater) {
    const me = getPlayerId();
    const current = getName();
    if (!current || isPlaceholderName(current)) return false;
    const key = nameKey(current);

    for (let attempt = 0; attempt < 4; attempt++) {
      let remoteNames;
      try {
        remoteNames = await fetchNamesRemote();
      } catch {
        return false;
      }

      // Keep any newer local profile edits while merging remote.
      remoteNames = mergeNameMaps(namesCache, remoteNames);

      const existing = remoteNames[key];
      if (!existing || existing.playerId !== me) {
        namesCache = remoteNames;
        return false;
      }

      const nextClaim = updater({ ...existing });
      if (!nextClaim) {
        namesCache = remoteNames;
        return true;
      }

      nextClaim.profileUpdatedAt = Date.now();
      const nextNames = { ...remoteNames, [key]: nextClaim };
      // Optimistic local update so UI refreshes immediately.
      namesCache = nextNames;
      saveLocalProfileStyle(nextClaim, key);
      try {
        await pushNamesRemote(nextNames);
      } catch {
        return false;
      }

      let confirmed;
      try {
        confirmed = await fetchNamesRemote();
      } catch {
        return true;
      }
      namesCache = applyLocalProfileStyle(mergeNameMaps(nextNames, confirmed));
      if (namesCache[key]) saveLocalProfileStyle(namesCache[key], key);
      return true;
    }
    return false;
  }

  async function markLegend() {
    const ok = await patchMyClaim((existing) => {
      if (existing.legend) return null;
      const next = { ...existing, legend: true, legendAt: Date.now() };
      if (!next.activeTitle) next.activeTitle = "legend";
      return next;
    });
    return ok;
  }

  async function setActiveTitle(titleId) {
    const available = getAvailableTitleIds();
    const nextId = String(titleId || "").toLowerCase();
    if (nextId !== "none" && nextId && !available.includes(nextId)) {
      return { ok: false, error: "You don't have that title yet" };
    }
    if (nextId === "none" && !available.includes("legend")) {
      return { ok: false, error: "You don't have that title yet" };
    }
    const ok = await patchMyClaim((existing) => {
      const next = { ...existing, activeTitle: nextId || "none" };
      // Single-title players always match color to that title.
      if (available.length === 1 && nextId && nextId !== "none") {
        next.accentTitle = nextId;
        next.accentColor = TITLE_COLORS[nextId] || "";
      }
      return next;
    });
    if (!ok) return { ok: false, error: "Couldn't save title — try again" };
    refreshCreatorCredits();
    return { ok: true, activeTitle: getActiveTitleId() };
  }

  async function setAccentFromTitle(titleId) {
    const id = String(titleId || "").toLowerCase();

    if (isExtraAccentId(id)) {
      if (!getExtraColorIds().includes(id)) {
        return { ok: false, error: "You don't have that color yet" };
      }
      const ok = await patchMyClaim((existing) => ({
        ...existing,
        accentTitle: id,
        accentColor: id
      }));
      if (!ok) return { ok: false, error: "Couldn't save color — try again" };
      refreshCreatorCredits();
      return { ok: true, accentColor: id, accentTitle: id };
    }

    const available = getAvailableTitleIds();
    if (!available.includes(id) || !TITLE_COLORS[id]) {
      return { ok: false, error: "You don't have that color yet" };
    }
    if (!canPickAccentColors()) {
      return { ok: false, error: "Unlock another title or special color to mix" };
    }
    const ok = await patchMyClaim((existing) => ({
      ...existing,
      accentTitle: id,
      accentColor: TITLE_COLORS[id]
    }));
    if (!ok) return { ok: false, error: "Couldn't save color — try again" };
    refreshCreatorCredits();
    return { ok: true, accentColor: getAccentColor(), accentTitle: id };
  }

  async function setAccentColor(colorIdOrHex) {
    const raw = String(colorIdOrHex || "").trim().toLowerCase();
    if (isExtraAccentId(raw)) return setAccentFromTitle(raw);
    const fromTitle = getAvailableTitleIds().find(
      (id) => id === raw || TITLE_COLORS[id] === sanitizeColor(raw)
    );
    if (fromTitle) return setAccentFromTitle(fromTitle);
    return { ok: false, error: "Pick a color from one of your unlocks" };
  }

  window.HubPlays = {
    getName,
    setName,
    isNameLocked,
    setNameLocked,
    claimName,
    makeGuestName,
    hasRequiredName,
    enforceUsernameGate,
    isUsernameGateOpen,
    isNameTaken,
    record,
    sync,
    getStatus,
    gameLabel,
    formatWhen,
    sanitizeName,
    getPlayerId,
    heartbeat,
    getOnlineCount,
    getOnlinePlayers,
    getAllTimeCount,
    getAllTimePlayers,
    registerAllTime,
    startPresence,
    markLegend,
    isLegendName,
    getAvailableTitleIds,
    getTitleShowcase,
    getColorShowcase,
    getActiveTitleId,
    getActiveTitleBadge,
    setActiveTitle,
    getAccentColor,
    getActiveAccentTitleId,
    getDefaultAccentForName,
    canMixTitleColors,
    canPickAccentColors,
    setAccentColor,
    setAccentFromTitle,
    refreshCreatorCredits,
    TITLE_DEFS,
    TITLE_COLORS,
    EXTRA_COLORS,
    COLOR_OPTIONS
  };

  injectCreatorCredit();
  sync(true)
    .then(() => refreshCreatorCredits())
    .catch(() => refreshCreatorCredits());
})();
