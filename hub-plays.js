/**
 * hub-plays.js — nickname + shared recent-players log.
 * Uses MantleDB (browser-only) so the site owner can see who played.
 * Nicknames are unique (case-insensitive) via a dedicated name-registry store.
 */
(function () {
  const NAME_KEY = "hub-player-name";
  const PLAYER_ID_KEY = "hub-player-id";
  const LOCAL_KEY = "hub-plays-local-v1";
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
        if ((claim.claimedAt || 0) >= (existing.claimedAt || 0)) out[key] = claim;
        return;
      }
      // First claimer wins
      if ((claim.claimedAt || 0) < (existing.claimedAt || 0)) out[key] = claim;
    });
    return out;
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
        namesCache = await fetchNamesRemote();
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
      Object.keys(nextNames).forEach((k) => {
        if (k !== key && nextNames[k]?.playerId === me) delete nextNames[k];
      });

      nextNames[key] = {
        playerId: me,
        name: next,
        claimedAt: existing?.claimedAt || myClaimAt
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

  function isNameTaken(name, playerId) {
    const key = nameKey(name);
    if (!key) return false;
    const claim = namesCache[key];
    return !!(claim && claim.playerId && claim.playerId !== playerId);
  }

  function record(gameId) {
    const id = String(gameId || "unknown");
    const name = getName() || "Guest";
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
    return Object.values(map || {}).filter((p) => p && now - (p.at || 0) < ONLINE_TTL_MS).length;
  }

  function getOnlineCount() {
    return countOnline(presenceCache);
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
      const next = prunePresence(
        mergePresence(remote, {
          [me]: { at: now, name: getName() || "Guest" }
        }),
        now
      );

      try {
        await pushPresenceRemote(next);
      } catch {
        presenceCache = mergePresence(presenceCache, next);
        return countOnline(presenceCache, now);
      }

      // Reconcile races: keep newest ping per player
      let confirmed = next;
      try {
        confirmed = prunePresence(mergePresence(next, await fetchPresenceRemote()), now);
        await pushPresenceRemote(confirmed);
      } catch {
        confirmed = next;
      }

      presenceCache = confirmed;
      registerAllTime().catch(() => {});
      return countOnline(confirmed, now);
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

  function mergeAllTime(a, b) {
    const out = { ...(a || {}) };
    Object.entries(b || {}).forEach(([id, p]) => {
      if (!p) return;
      const existing = out[id];
      if (!existing) {
        out[id] = p;
        return;
      }
      // Keep earliest firstAt; refresh name if newer visit provided one
      const firstAt = Math.min(existing.firstAt || Infinity, p.firstAt || Infinity);
      out[id] = {
        firstAt: firstAt === Infinity ? Date.now() : firstAt,
        name: sanitizeName(p.name || existing.name || "") || existing.name || "Guest"
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

  function getAllTimeCount() {
    return Object.keys(allTimeCache || {}).length;
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

      // Also learn ids from recent play log (one-time bootstrap)
      const fromPlays = {};
      (cache.plays || loadLocal().plays || []).forEach((p) => {
        if (!p || !p.playerId) return;
        fromPlays[p.playerId] = {
          firstAt: Number(p.at) || Date.now(),
          name: sanitizeName(p.name || "") || "Guest"
        };
      });

      const now = Date.now();
      const next = trimAllTime(
        mergeAllTime(mergeAllTime(remote, fromPlays), {
          [me]: { firstAt: now, name: getName() || "Guest" }
        })
      );

      // Already known and no new ids from plays — skip write
      const remoteCount = Object.keys(remote).length;
      const nextCount = Object.keys(next).length;
      const alreadyMe = !!remote[me];
      if (alreadyMe && nextCount === remoteCount) {
        allTimeCache = remote;
        return remoteCount;
      }

      try {
        await pushAllTimeRemote(next);
      } catch {
        allTimeCache = mergeAllTime(allTimeCache, next);
        return getAllTimeCount();
      }

      let confirmed = next;
      try {
        confirmed = trimAllTime(mergeAllTime(next, await fetchAllTimeRemote()));
        await pushAllTimeRemote(confirmed);
      } catch {
        confirmed = next;
      }

      allTimeCache = confirmed;
      return Object.keys(confirmed).length;
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
  injectCreatorCredit();

  function injectCreatorCredit() {
    if (document.getElementById("site-credit")) return;
    if (!document.getElementById("site-credit-style")) {
      const style = document.createElement("style");
      style.id = "site-credit-style";
      style.textContent = `
.site-credit {
  position: fixed;
  z-index: 40;
  right: 0.55rem;
  top: 50%;
  transform: translateY(-50%);
  margin: 0;
  padding: 0;
  writing-mode: vertical-rl;
  text-orientation: mixed;
  letter-spacing: 0.12em;
  font-size: 0.72rem;
  font-weight: 600;
  color: rgba(160, 170, 185, 0.85);
  pointer-events: none;
  user-select: none;
  white-space: nowrap;
}
.site-credit .player-name-creator {
  color: #1c7ed6;
  font-weight: 800;
}
body.light .site-credit {
  color: rgba(90, 100, 115, 0.8);
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
    font-size: 0.68rem;
  }
}`;
      document.head.appendChild(style);
    }
    const el = document.createElement("p");
    el.id = "site-credit";
    el.className = "site-credit";
    el.setAttribute("aria-label", "Created by ICE_DRAGON");
    el.innerHTML =
      'created by <span class="player-name-creator">ICE_DRAGON</span>';
    document.body.appendChild(el);
  }

  window.HubPlays = {
    getName,
    setName,
    claimName,
    makeGuestName,
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
    getAllTimeCount,
    registerAllTime,
    startPresence
  };
})();
