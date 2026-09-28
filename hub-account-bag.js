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
    "hub-look-theme",
    "hub-look-set-at",
    "hub-favorites",
    "hub-last-game",
    "hub-played-games",
    // Fishing
    "fishing-save-v3",
    "fishing-best-catch-v2",
    "fishing-best-catch-meta-v1",
    "fishing-best-catch-meta-v2",
    "fishing-prefs-v1",
    "fishing-chest-boost-v1",
    "fishing-gifts-claimed-v1",
    "fishing-player-mail-claimed-v1",
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

  function parseJsonSafe(raw, fallback) {
    try {
      if (raw == null || raw === "") return fallback;
      const v = typeof raw === "string" ? JSON.parse(raw) : raw;
      return v == null ? fallback : v;
    } catch {
      return fallback;
    }
  }

  /** Rough richness score so a fresh/empty school-PC save can't wipe a real one. */
  function fishingSaveScore(raw) {
    const s = parseJsonSafe(raw, null);
    if (!s || typeof s !== "object") return 0;
    const caughtN = s.caught && typeof s.caught === "object" ? Object.keys(s.caught).length : 0;
    const ownedN = s.owned && typeof s.owned === "object" ? Object.keys(s.owned).filter((k) => s.owned[k]).length : 0;
    return (
      Math.max(0, Number(s.lifetime) || 0) * 1e3 +
      Math.max(0, Number(s.coins) || 0) +
      Math.max(0, Number(s.catches) || 0) * 25 +
      caughtN * 2e3 +
      ownedN * 500 +
      Math.max(0, Number(s.boatLevel) || 0) * 8e3 +
      Math.max(0, Number(s.aquariumLevel) || 0) * 4e3 +
      Math.max(0, Number(s.bestCatchScore) || 0) * 0.01
    );
  }

  function mergeCaughtMaps(a, b) {
    const out = { ...(a && typeof a === "object" ? a : {}) };
    Object.entries(b && typeof b === "object" ? b : {}).forEach(([id, rec]) => {
      if (!rec) return;
      if (!out[id]) {
        out[id] = rec;
        return;
      }
      if (rec === true) {
        out[id] = out[id] === true ? true : out[id];
        return;
      }
      if (out[id] === true) {
        out[id] = rec;
        return;
      }
      if (typeof out[id] === "object" && typeof rec === "object") {
        const merged = { ...out[id], ...rec };
        if (out[id].looks || rec.looks) {
          merged.looks = { ...(out[id].looks || {}), ...(rec.looks || {}) };
        }
        ["any", "base", "silver", "gold", "diamond", "rainbow", "shiny", "toxic", "lava", "neon"].forEach(
          (k) => {
            if (out[id][k] || rec[k]) merged[k] = true;
          }
        );
        out[id] = merged;
      }
    });
    return out;
  }

  function mergeFishingSaveStrings(aStr, bStr) {
    const a = parseJsonSafe(aStr, null);
    const b = parseJsonSafe(bStr, null);
    if (!a && !b) return null;
    if (!a) return typeof bStr === "string" ? bStr : JSON.stringify(b);
    if (!b) return typeof aStr === "string" ? aStr : JSON.stringify(a);
    const scoreA = fishingSaveScore(a);
    const scoreB = fishingSaveScore(b);
    // Nearly empty side never wins wholesale
    if (scoreA <= 0 && scoreB > 0) return typeof bStr === "string" ? bStr : JSON.stringify(b);
    if (scoreB <= 0 && scoreA > 0) return typeof aStr === "string" ? aStr : JSON.stringify(a);

    const primary = scoreB > scoreA ? b : a;
    const secondary = scoreB > scoreA ? a : b;
    const out = { ...secondary, ...primary };
    out.coins = Math.max(Number(a.coins) || 0, Number(b.coins) || 0);
    out.lifetime = Math.max(Number(a.lifetime) || 0, Number(b.lifetime) || 0);
    out.catches = Math.max(Number(a.catches) || 0, Number(b.catches) || 0);
    out.perfects = Math.max(Number(a.perfects) || 0, Number(b.perfects) || 0);
    out.boatLevel = Math.max(Number(a.boatLevel) || 0, Number(b.boatLevel) || 0);
    out.aquariumLevel = Math.max(Number(a.aquariumLevel) || 0, Number(b.aquariumLevel) || 0);
    out.bestCatchScore = Math.max(Number(a.bestCatchScore) || 0, Number(b.bestCatchScore) || 0);
    out.caught = mergeCaughtMaps(a.caught, b.caught);
    out.owned = { ...(a.owned || {}), ...(b.owned || {}) };
    Object.keys(out.owned).forEach((k) => {
      out.owned[k] = !!(a.owned?.[k] || b.owned?.[k]);
    });
    out.unlocked = { ...(a.unlocked || {}), ...(b.unlocked || {}) };
    Object.keys(out.unlocked).forEach((k) => {
      out.unlocked[k] = !!(a.unlocked?.[k] || b.unlocked?.[k] || k === "creek");
    });
    // Cooler: newer save wins so sells / unfavorites stick (never revive fish from an older longer cooler)
    const coolA = Array.isArray(a.cooler) ? a.cooler : [];
    const coolB = Array.isArray(b.cooler) ? b.cooler : [];
    const tickA = Number(a.lastTick) || 0;
    const tickB = Number(b.lastTick) || 0;
    out.lastTick = Math.max(tickA, tickB);
    if (tickA !== tickB) {
      out.cooler = tickA > tickB ? coolA : coolB;
    } else if (coolA.length !== coolB.length) {
      const coinsA = Number(a.coins) || 0;
      const coinsB = Number(b.coins) || 0;
      const lifeA = Number(a.lifetime) || 0;
      const lifeB = Number(b.lifetime) || 0;
      // Same timestamp: shorter cooler + more money ≈ a sell that should stick
      if (coolB.length < coolA.length && (coinsB > coinsA || lifeB > lifeA)) out.cooler = coolB;
      else if (coolA.length < coolB.length && (coinsA > coinsB || lifeA > lifeB)) out.cooler = coolA;
      else out.cooler = primary.cooler || [];
    } else {
      out.cooler = primary.cooler || coolA;
    }
    if ((Number(a.bestCatchScore) || 0) >= (Number(b.bestCatchScore) || 0)) {
      out.bestCatchId = a.bestCatchId || b.bestCatchId || "";
      out.bestCatchVariant = a.bestCatchVariant || b.bestCatchVariant || "";
      out.bestCatchShiny = !!(a.bestCatchShiny || b.bestCatchShiny);
      out.bestCatchMutation = a.bestCatchMutation || b.bestCatchMutation || "";
    } else {
      out.bestCatchId = b.bestCatchId || a.bestCatchId || "";
      out.bestCatchVariant = b.bestCatchVariant || a.bestCatchVariant || "";
      out.bestCatchShiny = !!(b.bestCatchShiny || a.bestCatchShiny);
      out.bestCatchMutation = b.bestCatchMutation || a.bestCatchMutation || "";
    }
    out.ownerPlayerId = primary.ownerPlayerId || secondary.ownerPlayerId || "";
    out.ownerName = primary.ownerName || secondary.ownerName || "";
    return JSON.stringify(out);
  }

  function mergeNumericString(a, b) {
    return String(Math.max(Number(a) || 0, Number(b) || 0));
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

    // Fishing: never let a fresher empty/weak save wipe a real one (shared school PCs)
    try {
      const mergedFish = mergeFishingSaveStrings(
        localKv["fishing-save-v3"],
        remoteKv["fishing-save-v3"]
      );
      if (mergedFish) kv["fishing-save-v3"] = mergedFish;
    } catch {}
    try {
      kv["fishing-best-catch-v2"] = mergeNumericString(
        localKv["fishing-best-catch-v2"],
        remoteKv["fishing-best-catch-v2"]
      );
    } catch {}

    // Hub look: prefer whichever side last explicitly set a look
    try {
      const lt = String(localKv["hub-look-theme"] || "").trim();
      const rt = String(remoteKv["hub-look-theme"] || "").trim();
      const localAt = Number(localKv["hub-look-set-at"]) || 0;
      const remoteAt = Number(remoteKv["hub-look-set-at"]) || 0;
      if (localAt || remoteAt) {
        const useRemote = remoteAt >= localAt;
        kv["hub-look-theme"] = useRemote ? rt || lt : lt || rt;
        kv["hub-look-set-at"] = String(Math.max(localAt, remoteAt));
      } else {
        // Legacy bags: don't let plain "classic"/missing wipe a real theme
        const localReal = lt && lt !== "classic";
        const remoteReal = rt && rt !== "classic";
        if (localReal && !remoteReal) kv["hub-look-theme"] = lt;
        else if (remoteReal && !localReal) kv["hub-look-theme"] = rt;
        else if (localReal && remoteReal) kv["hub-look-theme"] = preferRemote ? rt : lt;
      }
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
    try {
      document.dispatchEvent(
        new CustomEvent("hub-account-bag-applied", {
          detail: { playerId: bag.playerId || playerIdNow(), theme: bag.kv["hub-look-theme"] || null }
        })
      );
    } catch {}
  }

  async function syncUp(playerId) {
    const id = playerIdNow(playerId);
    if (!id) return false;
    const localBag = snapshot(id);
    if (!localBag) return false;
    const api = sb();
    if (!api) return true;
    try {
      const remoteBag = await pullRemote(id);
      const merged = mergeBags(localBag, remoteBag) || localBag;
      merged.updatedAt = Date.now();
      const vault = loadVault();
      vault[id] = merged;
      saveVault(vault);
      // Keep active fishing keys as the merged fishing save when present
      if (merged.kv && merged.kv["fishing-save-v3"] != null) {
        try {
          localStorage.setItem("fishing-save-v3", String(merged.kv["fishing-save-v3"]));
        } catch {}
      }
      await api.upsertDoc(DOC_PREFIX + id, merged);
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
    const pullTick = () => {
      const id = playerIdNow();
      if (!id || !window.HubSupabase?.ready) return;
      pullAndApply(id).catch(() => {});
    };
    // Pull first so phone look/settings land, then periodic upload
    setTimeout(pullTick, 1200);
    setTimeout(tick, 8000);
    setInterval(tick, 3 * 60_000);
    setInterval(pullTick, 5 * 60_000);
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) tick();
      else pullTick();
    });
    window.addEventListener("pagehide", () => {
      try {
        snapshot(playerIdNow());
      } catch {}
    });
    document.addEventListener("hub-look-changed", (e) => {
      const theme = e?.detail?.theme;
      if (theme) {
        try {
          localStorage.setItem("hub-look-theme", String(theme));
          localStorage.setItem("hub-look-set-at", String(Date.now()));
        } catch {}
      }
      setTimeout(tick, 40);
    });
    document.addEventListener("click", (e) => {
      const t = e.target;
      if (!t || !t.closest) return;
      if (t.closest(".fav-btn")) setTimeout(tick, 120);
    });
  }

  // Migrate: first visit after update, stash current keys under active player.
  // Only create a vault entry if missing — do NOT bump updatedAt on every load
  // (that made local "classic" clobber a real hub look from the other device).
  try {
    const id = playerIdNow();
    if (id && !loadVault()[id]) {
      snapshot(id);
    } else if (id) {
      const vault = loadVault();
      const bag = vault[id];
      if (bag && bag.kv && typeof bag.kv === "object") {
        let filled = false;
        BAG_KEYS.forEach((key) => {
          if (bag.kv[key] != null) return;
          try {
            const v = localStorage.getItem(key);
            if (v != null) {
              bag.kv[key] = v;
              filled = true;
            }
          } catch {}
        });
        if (filled) {
          vault[id] = bag;
          saveVault(vault);
        }
      }
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
