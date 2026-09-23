/**
 * hub-account-bag.js — per-account local settings / achievements / saves.
 * Snapshots active keys before account switch, restores the target bag,
 * and syncs to Supabase so phone + PC can share the same account data.
 *
 * window.HubAccountBag:
 *   .snapshot(playerId?) → bag
 *   .apply(bag) → void
 *   .syncUp(playerId?) → Promise
 *   .pullAndApply(playerId) → Promise<bag|null>
 *   .prepareSwitch(fromId, toId) → Promise (snapshot+upload from, download+apply to)
 */
(function () {
  const VAULT_KEY = "hub-account-bags-v1";
  const DOC_PREFIX = "account-bag:";

  /** Keys that belong to a player identity (not shared device chrome). */
  const BAG_KEYS = [
    // Hub identity / progress
    "hub-achievements-v1",
    "hub-achievements-pending",
    "hub-player-name",
    "hub-player-name-locked",
    "hub-profile-style-v1",
    "hub-online-time-v1",
    "hub-plays-local-v1",
    "hub-daily-streak",
    "hub-sound",
    "hub-sound-enabled",
    "hub-sound-volume",
    // Fishing
    "fishing-save-v3",
    "fishing-best-catch-v2",
    "fishing-best-catch-meta-v1",
    "fishing-prefs-v1",
    "fishing-chest-boost-v1",
    "fishing-gifts-claimed-v1",
    // Other game saves / highs
    "wordle-game",
    "wordle-stats",
    "clicker-save-v3",
    "clicker-high-score-v3",
    "mine-depth-save-v1",
    "mine-depth-best-v1",
    "mine-depth-best-ore-v1",
    "mine-depth-best-ore-id-v1",
    "mine-depth-lifetime-coins",
    "cows-save-v1",
    "cows-best-tier-v1",
    "hangman-stats",
    "hangman-wins-count",
    "hangman-lang",
    "hangman-diff",
    "hangman-theme",
    "hangman-color-theme",
    "tic-tac-toe-stats",
    "connect-four-stats",
    "snake-high-score",
    "brick-breaker-high-score",
    "pixletris-high-score",
    "stacker-high-score",
    "flappy-bird-high-score",
    "dino-run-high-score",
    "crossy-high-score",
    "ramp-rush-high-score",
    "bubble-pop-high-score",
    "block-blast-high-score",
    "guac-a-mole-high-score",
    "cafe-queue-high-score",
    "garden-snap-high-score",
    "lemmings-high-score",
    "2048-high-score",
    "quiz-high-score",
    "sudoku-best",
    "memory-best",
    "math-high-score"
  ];

  function sb() {
    return window.HubSupabase && HubSupabase.ready ? HubSupabase : null;
  }

  function playerIdNow(fallback) {
    try {
      if (fallback) return String(fallback);
      return String(
        window.HubPlays?.getPlayerId?.() || localStorage.getItem("hub-player-id") || ""
      );
    } catch {
      return String(fallback || "");
    }
  }

  function loadVault() {
    try {
      const raw = JSON.parse(localStorage.getItem(VAULT_KEY) || "{}");
      return raw && typeof raw === "object" ? raw : {};
    } catch {
      return {};
    }
  }

  function saveVault(vault) {
    try {
      localStorage.setItem(VAULT_KEY, JSON.stringify(vault || {}));
    } catch {}
  }

  function readBagKeys() {
    const kv = {};
    BAG_KEYS.forEach((key) => {
      try {
        const v = localStorage.getItem(key);
        if (v != null) kv[key] = v;
      } catch {}
    });
    return kv;
  }

  function clearBagKeys() {
    BAG_KEYS.forEach((key) => {
      try {
        localStorage.removeItem(key);
      } catch {}
    });
  }

  function snapshot(playerId) {
    const id = playerIdNow(playerId);
    if (!id) return null;
    const bag = {
      playerId: id,
      updatedAt: Date.now(),
      kv: readBagKeys()
    };
    const vault = loadVault();
    vault[id] = bag;
    saveVault(vault);
    return bag;
  }

  function mergeAchievementMaps(a, b) {
    const out = { ...(a || {}) };
    Object.entries(b || {}).forEach(([id, at]) => {
      const left = Number(out[id]) || 0;
      const right = Number(at) || 0;
      if (!left) out[id] = right || at;
      else if (right && right < left) out[id] = right;
      else out[id] = left;
    });
    return out;
  }

  function mergeBags(localBag, remoteBag) {
    if (!localBag && !remoteBag) return null;
    if (!localBag) return remoteBag;
    if (!remoteBag) return localBag;
    const localKv = localBag.kv && typeof localBag.kv === "object" ? localBag.kv : {};
    const remoteKv = remoteBag.kv && typeof remoteBag.kv === "object" ? remoteBag.kv : {};
    const preferRemote = (Number(remoteBag.updatedAt) || 0) >= (Number(localBag.updatedAt) || 0);
    const primary = preferRemote ? remoteKv : localKv;
    const secondary = preferRemote ? localKv : remoteKv;
    const kv = { ...secondary, ...primary };

    // Achievements: always union so nothing is lost across devices
    try {
      const a = JSON.parse(localKv["hub-achievements-v1"] || "{}");
      const b = JSON.parse(remoteKv["hub-achievements-v1"] || "{}");
      kv["hub-achievements-v1"] = JSON.stringify(mergeAchievementMaps(a, b));
    } catch {}
    try {
      const pa = JSON.parse(localKv["hub-achievements-pending"] || "[]");
      const pb = JSON.parse(remoteKv["hub-achievements-pending"] || "[]");
      const set = new Set([...(Array.isArray(pa) ? pa : []), ...(Array.isArray(pb) ? pb : [])]);
      kv["hub-achievements-pending"] = JSON.stringify([...set].slice(-80));
    } catch {}

    return {
      playerId: remoteBag.playerId || localBag.playerId,
      updatedAt: Math.max(Number(localBag.updatedAt) || 0, Number(remoteBag.updatedAt) || 0),
      kv
    };
  }

  function apply(bag) {
    clearBagKeys();
    if (!bag || !bag.kv || typeof bag.kv !== "object") return;
    Object.entries(bag.kv).forEach(([key, value]) => {
      if (!BAG_KEYS.includes(key)) return;
      try {
        if (value == null) localStorage.removeItem(key);
        else localStorage.setItem(key, String(value));
      } catch {}
    });
  }

  async function syncUp(playerId) {
    const id = playerIdNow(playerId);
    if (!id) return false;
    const bag = snapshot(id);
    const api = sb();
    if (!api || !bag) return !!bag;
    try {
      await api.upsertDoc(DOC_PREFIX + id, bag);
      return true;
    } catch (err) {
      console.warn("[HubAccountBag] syncUp failed", err);
      return false;
    }
  }

  async function pullRemote(playerId) {
    const id = String(playerId || "");
    if (!id) return null;
    const api = sb();
    if (!api) return null;
    try {
      const data = await api.getDoc(DOC_PREFIX + id);
      if (!data || typeof data !== "object") return null;
      return {
        playerId: id,
        updatedAt: Number(data.updatedAt) || 0,
        kv: data.kv && typeof data.kv === "object" ? data.kv : {}
      };
    } catch (err) {
      console.warn("[HubAccountBag] pull failed", err);
      return null;
    }
  }

  async function pullAndApply(playerId) {
    const id = String(playerId || "");
    if (!id) return null;
    const localBag = loadVault()[id] || null;
    const remoteBag = await pullRemote(id);
    const merged = mergeBags(localBag, remoteBag);
    if (merged) {
      const vault = loadVault();
      vault[id] = merged;
      saveVault(vault);
      apply(merged);
      // Push merged union back so both devices keep achievements
      const api = sb();
      if (api) {
        try {
          merged.updatedAt = Date.now();
          await api.upsertDoc(DOC_PREFIX + id, merged);
          vault[id] = merged;
          saveVault(vault);
        } catch {}
      }
    } else {
      clearBagKeys();
    }
    return merged;
  }

  /**
   * Call before changing hub-player-id.
   * Saves+uploads the leaving account, then loads the incoming account bag.
   */
  async function prepareSwitch(fromId, toId) {
    const from = String(fromId || "");
    const to = String(toId || "");
    if (from && from !== to) {
      await syncUp(from);
    }
    if (to) {
      await pullAndApply(to);
    } else {
      clearBagKeys();
    }
  }

  // Soft sync current account while playing (so phone/PC stay close)
  function startBackgroundSync() {
    const tick = () => {
      const id = playerIdNow();
      if (!id) return;
      syncUp(id).catch(() => {});
    };
    setTimeout(tick, 8000);
    setInterval(tick, 3 * 60_000);
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) tick();
    });
    window.addEventListener("pagehide", () => {
      try {
        snapshot(playerIdNow());
      } catch {}
    });
  }

  // Migrate: first visit after update, stash current keys under active player
  try {
    const id = playerIdNow();
    if (id && !loadVault()[id]) {
      snapshot(id);
    }
  } catch {}

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", startBackgroundSync);
  } else {
    startBackgroundSync();
  }

  window.HubAccountBag = {
    BAG_KEYS,
    snapshot,
    apply,
    clearBagKeys,
    syncUp,
    pullAndApply,
    prepareSwitch,
    mergeBags
  };
})();
