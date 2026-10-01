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
  /** Which account currently owns the live localStorage bag keys on this device. */
  const BAG_OWNER_KEY = "hub-account-bag-active-id";

  /** Exact keys that belong to a player identity (not shared device chrome). */
  const BAG_KEYS = [
    // Hub identity / progress / game cards
    "hub-achievements-v1",
    // Do NOT bag-sync hub-achievements-pending — it's a local toast queue.
    // Syncing it re-pops "Achievement unlocked" on every refresh.
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
    "hub-eggs-v1",
    "hub-eggs-pending-flair-v1",
    // Fishing
    "fishing-save-v3",
    "fishing-save-v3-backup",
    "fishing-best-catch-v2",
    "fishing-best-catch-v1",
    "fishing-best-catch-meta-v1",
    "fishing-best-catch-meta-v2",
    "fishing-prefs-v1",
    "fishing-chest-boost-v1",
    "fishing-gifts-claimed-v1",
    "fishing-player-mail-claimed-v1",
    // Other game saves / highs (names must match what games + hub cards actually use)
    "wordle-game",
    "wordle-stats",
    "clicker-save-v3",
    "clicker-high-score-v3",
    "mine-depth-save-v1",
    "mine-depth-best-v1",
    "mine-depth-best-ore-v1",
    "mine-depth-best-ore-id-v1",
    "mine-depth-lifetime-coins",
    "mine-best-ore-v1",
    "mine-best-ore-id-v1",
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
    "paper-io-best-pct",
    "2048-best-score",
    "2048-high-score",
    "memory-match-best",
    "memory-best",
    "sudoku-best-times",
    "sudoku-best",
    "space-shooter-high-score",
    "space-shooter-high-score-easy",
    "space-shooter-high-score-medium",
    "space-shooter-high-score-hard",
    "quizmaster-high-score",
    "quizmaster-high-score-easy",
    "quizmaster-high-score-medium",
    "quizmaster-high-score-hard",
    "quiz-high-score",
    "math-sprint-high-score-easy",
    "math-sprint-high-score-medium",
    "math-sprint-high-score-hard",
    "math-high-score"
  ];

  /** Prefixes for per-mode / per-lang keys (e.g. hangman-stats-en-easy). */
  const BAG_KEY_PREFIXES = [
    "hangman-stats-",
    "space-shooter-high-score-",
    "quizmaster-high-score-",
    "math-sprint-high-score-",
    "wordle-game-"
  ];

  function isBagKey(key) {
    const k = String(key || "");
    if (!k) return false;
    if (BAG_KEYS.includes(k)) return true;
    return BAG_KEY_PREFIXES.some((p) => k.startsWith(p));
  }

  function getBagOwner() {
    try {
      return String(localStorage.getItem(BAG_OWNER_KEY) || "").trim();
    } catch {
      return "";
    }
  }

  function setBagOwner(playerId) {
    try {
      const id = String(playerId || "").trim();
      if (id) localStorage.setItem(BAG_OWNER_KEY, id);
      else localStorage.removeItem(BAG_OWNER_KEY);
    } catch {}
  }

  function sb() {
    return window.HubSupabase && HubSupabase.ready ? HubSupabase : null;
  }

  function isMineBagKey(key) {
    return /^mine(-depth|-best)?/i.test(String(key || ""));
  }

  function stripMineBagKeys(kv) {
    if (!kv || typeof kv !== "object") return kv;
    Object.keys(kv).forEach((k) => {
      if (isMineBagKey(k)) delete kv[k];
    });
    return kv;
  }

  function mineWipeDone() {
    try {
      return localStorage.getItem("hub-mine-local-wipe-v3") === "done";
    } catch {
      return false;
    }
  }

  /** After a global Mine Depth wipe: drop cloud/vault mine saves and push the scrubbed bag. */
  async function scrubMineProgressAfterWipe() {
    if (!mineWipeDone()) return false;
    const id = playerIdNow();
    // Live keys stay wiped; strip vault copies for every account on this device
    const vault = loadVault();
    Object.keys(vault).forEach((pid) => {
      if (vault[pid]?.kv) stripMineBagKeys(vault[pid].kv);
    });
    saveVault(vault);
    if (!id) return true;
    try {
      const remote = await pullRemote(id);
      const local = loadVault()[id] || { playerId: id, updatedAt: Date.now(), kv: {} };
      const merged = mergeBags(local, remote) || local;
      if (merged?.kv) stripMineBagKeys(merged.kv);
      merged.playerId = id;
      merged.updatedAt = Date.now();
      vault[id] = merged;
      saveVault(vault);
      // Don't re-apply mine onto live
      const liveMine = {};
      BAG_KEYS.forEach((k) => {
        if (!isMineBagKey(k)) return;
        try {
          const v = localStorage.getItem(k);
          if (v != null) liveMine[k] = v;
        } catch {}
      });
      apply(merged, { replace: true });
      Object.entries(liveMine).forEach(([k, v]) => {
        try {
          localStorage.setItem(k, v);
        } catch {}
      });
      setBagOwner(id);
      const api = sb();
      if (api) {
        try {
          await api.upsertDoc(DOC_PREFIX + id, merged);
        } catch {}
      }
    } catch (err) {
      console.warn("[HubAccountBag] mine wipe scrub failed", err);
    }
    return true;
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
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!isBagKey(key)) continue;
        try {
          const v = localStorage.getItem(key);
          if (v != null) kv[key] = v;
        } catch {}
      }
    } catch {
      BAG_KEYS.forEach((key) => {
        try {
          const v = localStorage.getItem(key);
          if (v != null) kv[key] = v;
        } catch {}
      });
    }
    return kv;
  }

  function clearBagKeys() {
    const toRemove = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (isBagKey(key)) toRemove.push(key);
      }
    } catch {
      BAG_KEYS.forEach((key) => toRemove.push(key));
    }
    toRemove.forEach((key) => {
      try {
        localStorage.removeItem(key);
      } catch {}
    });
  }

  function snapshot(playerId) {
    const id = playerIdNow(playerId);
    if (!id) return null;
    const kv = readBagKeys();
    // School PC: don't put someone else's fishing save into this account's vault
    try {
      const fishRaw = kv["fishing-save-v3"];
      if (fishRaw) {
        const parsed = parseJsonSafe(fishRaw, null);
        const owner = parsed && typeof parsed === "object" ? String(parsed.ownerPlayerId || "").trim() : "";
        if (owner && owner !== id) {
          const vaultEarly = loadVault();
          if (!vaultEarly[owner] || typeof vaultEarly[owner] !== "object") {
            vaultEarly[owner] = { playerId: owner, updatedAt: Date.now(), kv: {} };
          }
          if (!vaultEarly[owner].kv || typeof vaultEarly[owner].kv !== "object") {
            vaultEarly[owner].kv = {};
          }
          const existing = vaultEarly[owner].kv["fishing-save-v3"];
          vaultEarly[owner].kv["fishing-save-v3"] =
            mergeFishingSaveStrings(existing, fishRaw) || fishRaw;
          vaultEarly[owner].updatedAt = Date.now();
          saveVault(vaultEarly);
          const mine = loadVault()[id]?.kv?.["fishing-save-v3"];
          if (mine) kv["fishing-save-v3"] = mine;
          else delete kv["fishing-save-v3"];
        }
      }
    } catch {}
    const bag = {
      playerId: id,
      updatedAt: Date.now(),
      kv
    };
    const vault = loadVault();
    // Preserve this account's prior fishing if live keys had none (after foreign strip)
    try {
      const prev = vault[id]?.kv?.["fishing-save-v3"];
      if (prev && bag.kv["fishing-save-v3"] == null) {
        bag.kv["fishing-save-v3"] = prev;
      }
    } catch {}
    vault[id] = bag;
    saveVault(vault);
    return bag;
  }

  function mergeNumericString(a, b) {
    const na = Number(a);
    const nb = Number(b);
    const aOk = Number.isFinite(na);
    const bOk = Number.isFinite(nb);
    if (aOk && bOk) return String(Math.max(na, nb));
    if (aOk) return String(na);
    if (bOk) return String(nb);
    return a != null && a !== "" ? String(a) : b != null && b !== "" ? String(b) : "0";
  }

  function mergeStreakStrings(aStr, bStr) {
    const a = parseJsonSafe(aStr, null);
    const b = parseJsonSafe(bStr, null);
    if (!a && !b) return aStr || bStr || "";
    if (!a) return typeof bStr === "string" ? bStr : JSON.stringify(b);
    if (!b) return typeof aStr === "string" ? aStr : JSON.stringify(a);
    const aAt = Number(a.lastPlayedAt) || 0;
    const bAt = Number(b.lastPlayedAt) || 0;
    const newer = bAt >= aAt ? b : a;
    const older = bAt >= aAt ? a : b;
    return JSON.stringify({
      streak: Math.max(0, Number(newer.streak) || 0),
      lastDate: newer.lastDate || older.lastDate || null,
      lastPlayedAt: Math.max(aAt, bAt) || null,
      best: Math.max(Number(a.best) || 0, Number(b.best) || 0),
      celebrate: !!(a.celebrate || b.celebrate)
    });
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
    // Never blend two different players' saves (school shared PCs)
    const ownerA = String(a.ownerPlayerId || "").trim();
    const ownerB = String(b.ownerPlayerId || "").trim();
    if (ownerA && ownerB && ownerA !== ownerB) {
      const scoreA = fishingSaveScore(a);
      const scoreB = fishingSaveScore(b);
      return scoreB > scoreA
        ? typeof bStr === "string"
          ? bStr
          : JSON.stringify(b)
        : typeof aStr === "string"
          ? aStr
          : JSON.stringify(a);
    }
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
    // Cooler: newer save wins for normal sells, but never accept a catastrophic wipe
    const coolA = Array.isArray(a.cooler) ? a.cooler : [];
    const coolB = Array.isArray(b.cooler) ? b.cooler : [];
    const tickA = Number(a.lastTick) || 0;
    const tickB = Number(b.lastTick) || 0;
    out.lastTick = Math.max(tickA, tickB);

    const coolerWipe = (rich, thin, richSave, thinSave) => {
      if (rich.length < 20) return false;
      if (thin.length >= Math.max(5, Math.floor(rich.length * 0.15))) return false;
      const lifeGain = (Number(thinSave.lifetime) || 0) - (Number(richSave.lifetime) || 0);
      const coinGain = (Number(thinSave.coins) || 0) - (Number(richSave.coins) || 0);
      // Real mass-sell raises coins/lifetime; a wipe does not
      if (lifeGain > 0 || coinGain > 0) return false;
      // Also treat equal-or-higher wealth with fewer fish as a sell (float / sync races)
      if (
        (Number(thinSave.coins) || 0) >= (Number(richSave.coins) || 0) &&
        (Number(thinSave.lifetime) || 0) >= (Number(richSave.lifetime) || 0) &&
        thin.length < rich.length
      ) {
        return false;
      }
      return true;
    };

    if (tickA !== tickB) {
      const aNewer = tickA > tickB;
      const coolNew = aNewer ? coolA : coolB;
      const coolOld = aNewer ? coolB : coolA;
      const saveNew = aNewer ? a : b;
      const saveOld = aNewer ? b : a;
      out.cooler = coolerWipe(coolOld, coolNew, saveOld, saveNew) ? coolOld : coolNew;
    } else if (coolA.length !== coolB.length) {
      const coinsA = Number(a.coins) || 0;
      const coinsB = Number(b.coins) || 0;
      const lifeA = Number(a.lifetime) || 0;
      const lifeB = Number(b.lifetime) || 0;
      if (coolerWipe(coolA, coolB, a, b)) out.cooler = coolA;
      else if (coolerWipe(coolB, coolA, b, a)) out.cooler = coolB;
      else if (coolB.length < coolA.length && (coinsB > coinsA || lifeB > lifeA)) out.cooler = coolB;
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
    // Toast queue is device-local only — drop any copy that leaked into old bags
    delete kv["hub-achievements-pending"];

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

    // Day streak: keep the fresher play window + max best (don't let an empty bag wipe)
    try {
      kv["hub-daily-streak"] = mergeStreakStrings(
        localKv["hub-daily-streak"],
        remoteKv["hub-daily-streak"]
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

    // After Mine Depth global wipe: never rehydrate old cloud mine saves.
    // Keep only mine keys that still exist on the live device (new progress).
    if (mineWipeDone()) {
      stripMineBagKeys(kv);
      try {
        BAG_KEYS.forEach((k) => {
          if (!isMineBagKey(k)) return;
          const live = localStorage.getItem(k);
          if (live != null) kv[k] = live;
        });
      } catch {}
    }

    return {
      playerId: remoteBag.playerId || localBag.playerId,
      updatedAt: Math.max(Number(localBag.updatedAt) || 0, Number(remoteBag.updatedAt) || 0),
      kv
    };
  }

  function apply(bag, opts = {}) {
    if (!bag || !bag.kv || typeof bag.kv !== "object") return;
    const bagId = String(bag.playerId || playerIdNow() || "").trim();
    // Keep live toast queue across soft applies; never restore it from a bag
    let livePending = null;
    try {
      livePending = localStorage.getItem("hub-achievements-pending");
    } catch {}
    // After wipe: clearBagKeys would delete new Mine progress — snapshot + restore it.
    let keepMine = null;
    if (opts.replace && mineWipeDone()) {
      keepMine = {};
      BAG_KEYS.forEach((k) => {
        if (!isMineBagKey(k)) return;
        try {
          const v = localStorage.getItem(k);
          if (v != null) keepMine[k] = v;
        } catch {}
      });
    }
    // replace: full account switch — wipe every account key first so leftovers can't blend
    if (opts.replace) clearBagKeys();
    if (keepMine) {
      Object.entries(keepMine).forEach(([k, v]) => {
        try {
          localStorage.setItem(k, v);
        } catch {}
      });
    }
    Object.entries(bag.kv).forEach(([key, value]) => {
      if (!isBagKey(key)) return;
      if (key === "hub-achievements-pending") return;
      // After wipe: never restore mine saves from a bag onto live storage
      if (mineWipeDone() && isMineBagKey(key)) return;
      try {
        if (value == null || value === "") {
          if (opts.replace) localStorage.removeItem(key);
          return;
        }
        let out = String(value);
        // Never persist String(undefined) / String(null) as a username
        if (key === "hub-player-name") {
          const clean =
            typeof window.HubPlays?.sanitizeName === "function"
              ? window.HubPlays.sanitizeName(out)
              : out;
          const lower = String(clean || "").trim().toLowerCase();
          if (
            !clean ||
            lower === "undefined" ||
            lower === "null" ||
            lower === "nan" ||
            out === "undefined" ||
            out === "null"
          ) {
            localStorage.removeItem(key);
            return;
          }
          out = clean;
        }
        localStorage.setItem(key, out);
      } catch {}
    });
    // Soft apply: put back this session's toast queue (bag must not stomp it)
    if (!opts.replace && livePending != null) {
      try {
        localStorage.setItem("hub-achievements-pending", livePending);
      } catch {}
    }
    if (bagId) setBagOwner(bagId);
    try {
      document.dispatchEvent(
        new CustomEvent("hub-account-bag-applied", {
          detail: {
            playerId: bagId || playerIdNow(),
            theme: bag.kv["hub-look-theme"] || null,
            replace: !!opts.replace
          }
        })
      );
    } catch {}
  }

  async function syncUp(playerId) {
    const id = playerIdNow(playerId);
    if (!id) return false;
    // Never upload live keys under the wrong account on a shared PC
    const liveOwner = getBagOwner();
    if (liveOwner && liveOwner !== id) {
      console.warn("[HubAccountBag] syncUp skipped — live bag belongs to", liveOwner, "not", id);
      return false;
    }
    const localBag = snapshot(id);
    if (!localBag) return false;
    setBagOwner(id);
    const api = sb();
    if (!api) return true;
    try {
      const remoteBag = await pullRemote(id);
      const merged = mergeBags(localBag, remoteBag) || localBag;
      merged.updatedAt = Date.now();
      merged.playerId = id;
      const vault = loadVault();
      vault[id] = merged;
      saveVault(vault);
      // Keep active fishing keys as the merged fishing save when present
      if (merged.kv && merged.kv["fishing-save-v3"] != null && merged.kv["fishing-save-v3"] !== "") {
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

  async function pullAndApply(playerId, opts = {}) {
    const id = String(playerId || "");
    if (!id) return null;
    // Soft sync must never write another account's bag onto the live device
    if (!opts.replace) {
      const me = playerIdNow();
      if (me && me !== id) {
        console.warn("[HubAccountBag] soft pull skipped — bag", id, "≠ active", me);
        return null;
      }
      const liveOwner = getBagOwner();
      if (liveOwner && me && liveOwner !== me) {
        // Live leftovers from a previous account — hard-replace with ours
        opts = { ...opts, replace: true, skipLiveSnapshot: true };
      }
    }
    let localBag = null;
    if (opts.replace) {
      // Account switch: only this player's vault + remote — never snapshot the previous account's live keys
      localBag = loadVault()[id] || null;
    } else if (!opts.skipLiveSnapshot) {
      // Soft mid-session sync: fold live progress into THIS account's known keys only
      // so foreign leftovers on the device don't get absorbed into the vault.
      const prev = loadVault()[id] || null;
      const prevKv = prev && prev.kv && typeof prev.kv === "object" ? prev.kv : {};
      const live = readBagKeys();
      const folded = { ...prevKv };
      const liveOwner = getBagOwner();
      Object.keys(prevKv).forEach((key) => {
        if (live[key] != null) folded[key] = live[key];
      });
      // New keys written this session while we own the live bag
      if (!liveOwner || liveOwner === id) {
        Object.entries(live).forEach(([key, v]) => {
          if (folded[key] != null || v == null) return;
          folded[key] = v;
        });
      }
      localBag = {
        playerId: id,
        updatedAt: Date.now(),
        kv: folded
      };
    } else {
      localBag = loadVault()[id] || null;
    }
    const remoteBag = await pullRemote(id);
    const merged = opts.replace
      ? mergeBags(localBag, remoteBag) || remoteBag || localBag
      : mergeBags(localBag, remoteBag) || localBag || remoteBag;
    if (!merged) {
      if (opts.replace) {
        clearBagKeys();
        setBagOwner(id);
      }
      return localBag;
    }
    merged.playerId = id;
    const vault = loadVault();
    vault[id] = merged;
    saveVault(vault);
    // Always replace live keys after a pull so leftover scores from another
    // account on this device can't stick on game cards.
    apply(merged, { replace: true });
    setBagOwner(id);
    const api = sb();
    if (api) {
      try {
        merged.updatedAt = Date.now();
        await api.upsertDoc(DOC_PREFIX + id, merged);
        vault[id] = merged;
        saveVault(vault);
      } catch {}
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
      // Mark live keys as belonging to `from` so syncUp is allowed
      setBagOwner(from);
      await syncUp(from);
    }
    if (to) {
      // Full replace for the incoming account — don't snapshot the cleared leaving keys onto `to`
      clearBagKeys();
      setBagOwner("");
      await pullAndApply(to, { skipLiveSnapshot: true, replace: true });
      setBagOwner(to);
    } else {
      clearBagKeys();
      setBagOwner("");
    }
  }

  /** If hub-player-id and live bag owner disagree, wipe + restore the active account. */
  async function enforceLiveBagOwner() {
    const id = playerIdNow();
    if (!id) return false;
    const liveOwner = getBagOwner();
    if (!liveOwner) {
      setBagOwner(id);
      return false;
    }
    if (liveOwner === id) return false;
    console.warn("[HubAccountBag] isolating live bag — was", liveOwner, "now", id);
    clearBagKeys();
    await pullAndApply(id, { skipLiveSnapshot: true, replace: true });
    setBagOwner(id);
    return true;
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
      if (!id) return;
      enforceLiveBagOwner()
        .then(() => {
          if (!window.HubSupabase?.ready) return;
          return pullAndApply(id);
        })
        .catch(() => {});
    };
    setTimeout(() => {
      enforceLiveBagOwner().catch(() => {});
    }, 200);
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
        const id = playerIdNow();
        if (id && (!getBagOwner() || getBagOwner() === id)) snapshot(id);
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
    document.addEventListener("hub-player-changed", () => {
      // Don't stamp bag owner until the active account bag is applied —
      // prepareSwitch / enforceLiveBagOwner handle ownership.
      pullTick();
    });
  }

  // Migrate: first visit after update, stash current keys under active player.
  // If this device has never stamped a bag owner, prefer vault/remote over possibly
  // blended school-PC leftovers when a vault already exists for this account.
  try {
    const id = playerIdNow();
    if (id) {
      const liveOwner = getBagOwner();
      const vaultBag = loadVault()[id];
      const vaultHasData =
        vaultBag &&
        vaultBag.kv &&
        typeof vaultBag.kv === "object" &&
        Object.keys(vaultBag.kv).length > 0;
      if (!liveOwner && vaultHasData) {
        // Hard adopt this account's bag so game cards / favorites aren't shared leftovers
        pullAndApply(id, { skipLiveSnapshot: true, replace: true }).catch(() => {
          setBagOwner(id);
        });
      } else if (!liveOwner) {
        snapshot(id);
        setBagOwner(id);
      } else if (liveOwner === id && !vaultHasData) {
        snapshot(id);
      } else if (liveOwner === id && vaultHasData) {
        // Re-apply this account's vault (replace) so leftover scores from another
        // account on this device don't stick on game cards.
        pullAndApply(id, { skipLiveSnapshot: true, replace: true }).catch(() => {});
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
    BAG_KEY_PREFIXES,
    isBagKey,
    snapshot,
    apply,
    clearBagKeys,
    syncUp,
    pullAndApply,
    prepareSwitch,
    enforceLiveBagOwner,
    getBagOwner,
    setBagOwner,
    mergeBags,
    loadVault,
    scrubMineProgressAfterWipe,
    stripMineBagKeys
  };
})();
