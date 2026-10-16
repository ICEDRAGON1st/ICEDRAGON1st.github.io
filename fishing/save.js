/**
 * Fishing Idle save defaults, richness, and hydrate.
 * Storage I/O and account-bag stashing stay in script.js.
 */
(function (root) {
  const SAVE_KEY = "fishing-save-v3";
  const SAVE_BACKUP_KEY = "fishing-save-v3-backup";
  const ECHO_LUCK_RESET_ID = "echo-luck-reset-v1";

  function fishingSaveRichness(raw) {
    if (!raw || typeof raw !== "object") return 0;
    const cool = Array.isArray(raw.cooler) ? raw.cooler.length : 0;
    return (
      (Number(raw.lifetime) || 0) * 1000 +
      (Number(raw.coins) || 0) +
      (Number(raw.catches) || 0) * 25 +
      cool * 10 +
      (Number(raw.lastTick) || 0) * 1e-9
    );
  }

  function pickRicherSave(main, backup) {
    const mainScore = fishingSaveRichness(main);
    const backupScore = fishingSaveRichness(backup);
    if (backupScore > mainScore) return backup;
    if (main && typeof main === "object") return main;
    if (backup && typeof backup === "object") return backup;
    return null;
  }

  function defaultAutoSell(rarities) {
    const map = {};
    (rarities || []).forEach((r) => {
      map[r] = false;
    });
    return map;
  }

  function defaultState(ctx = {}) {
    const gear = ctx.gear || [];
    const rarities = ctx.rarities || [];
    const echoLuckResetId = ctx.echoLuckResetId || ECHO_LUCK_RESET_ID;
    const now = Number(ctx.now) || Date.now();
    const owned = {};
    gear.forEach((g) => {
      owned[g.id] = false;
    });
    return {
      coins: 25,
      lifetime: 0,
      spotId: "creek",
      unlocked: { creek: true },
      owned,
      equippedSpeed: "",
      cooler: [],
      autoSellRarities: defaultAutoSell(rarities),
      autoSellMutations: false,
      bestCatchScore: 0,
      bestCatchId: "",
      bestCatchVariant: "",
      bestCatchShiny: false,
      bestCatchMutation: "",
      caught: {},
      boatLevel: 0,
      aquariumLevel: 0,
      catches: 0,
      perfects: 0,
      lastTick: now,
      moneyBoostUntil: 0,
      luckBoostUntil: 0,
      moneyBoostPaused: false,
      luckBoostPaused: false,
      moneyBoostPausedLeft: 0,
      luckBoostPausedLeft: 0,
      moneyChestCount: 0,
      luckChestCount: 0,
      luckyBlockCount: 0,
      astralLuckyBlockCount: 0,
      zenithLuckyBlockCount: 0,
      smartShop: true,
      collectionLuckTold: false,
      collectionRainbowTold: false,
      collectionLbEventTold: false,
      collectionLbAlwaysTold: false,
      collectionSoulTwinGranted: false,
      quests: { dailyKey: "", weeklyKey: "", daily: [], weekly: [] },
      echoLuckLevel: 0,
      echoLuckReset: echoLuckResetId,
      ownerPlayerId: "",
      ownerName: "",
      luckDial: null,
      luckDialFollowMax: true,
      spotCasts: {},
      weatherId: "none",
      weatherUntil: 0,
      combo: 0,
      comboBoostUntil: 0,
      aquariumBank: 0,
      aquariumLastTick: now,
      coolerSort: "value",
      coolerFilter: "all",
      coolerSearch: "",
      bookSearch: "",
      pendingOffline: null,
      communityWeekKey: "",
      communityContrib: 0,
      communityPendingAdds: 0,
      communityLbClaimedKey: "",
      communityLbClaimedWave: 0
    };
  }

  function hydrateState(raw, ctx = {}) {
    if (!raw || typeof raw !== "object") return defaultState(ctx);
    const rarities = ctx.rarities || [];
    const spots = ctx.spots || [];
    const gear = ctx.gear || [];
    const echoLuckResetId = ctx.echoLuckResetId || ECHO_LUCK_RESET_ID;
    const now = Number(ctx.now) || Date.now();
    const fishById = ctx.fishById || (() => null);
    const normalizeCoolerEntry = ctx.normalizeCoolerEntry || ((entry) => entry || null);
    const normalizeCaughtRecord = ctx.normalizeCaughtRecord || ((rec) => rec || { any: true });
    const normalizeVariant = ctx.normalizeVariant || ((v) => String(v || ""));
    const normalizeMutation = ctx.normalizeMutation || ((m) => String(m || ""));
    const resolveEquippedSpeed = ctx.resolveEquippedSpeed || (() => "");
    const migrateLegacyBoats = ctx.migrateLegacyBoats || (() => 0);
    const migrateLegacyAquarium = ctx.migrateLegacyAquarium || (() => 0);
    const coolerMaxFromOwned = ctx.coolerMaxFromOwned || (() => 12);
    const restoreChestBoostChannel =
      ctx.restoreChestBoostChannel ||
      ((paused, leftover, until) => ({
        paused: !!paused,
        leftover: Number(leftover) || 0,
        until: Number(until) || 0
      }));
    const readChestBoostBackup = ctx.readChestBoostBackup || (() => null);
    const getStoredBest = ctx.getStoredBest || (() => 0);
    const fishFromCatchScore = ctx.fishFromCatchScore || (() => null);
    const sanitizeCatchScore = ctx.sanitizeCatchScore || ((n) => Math.max(0, Number(n) || 0));
    const normalizeQuestsState =
      ctx.normalizeQuestsState ||
      ((quests) => quests || { dailyKey: "", weeklyKey: "", daily: [], weekly: [] });
    const VARIANT_PRIMARY = ctx.variantPrimary || ["silver", "gold", "diamond", "rainbow"];
    const MUTATIONS = ctx.mutations || ["toxic", "lava", "neon"];
    const boatMax = Number(ctx.boatMax) || 0;
    const aquaMax = Number(ctx.aquaMax) || 0;
    const treasureHardMax = Number(ctx.treasureHardMax) || 999;
    const luckyBlockMax = Number(ctx.luckyBlockMax) || 50;
    const echoLuckMax = Number(ctx.echoLuckMax) || 0;
    const caughtLookKey =
      ctx.caughtLookKey ||
      ((variant, shiny, mutation) =>
        [variant || "base", shiny ? "shiny" : "plain", mutation || "none"].join(":"));

    const next = defaultState(ctx);
    next.coins = Math.max(0, Number(raw.coins) || 0);
    next.lifetime = Math.max(0, Number(raw.lifetime) || 0);
    next.spotId = spots.some((s) => s.id === raw.spotId) ? raw.spotId : "creek";
    next.autoSellRarities = defaultAutoSell(rarities);
    if (raw.autoSellRarities && typeof raw.autoSellRarities === "object") {
      rarities.forEach((r) => {
        next.autoSellRarities[r] = !!raw.autoSellRarities[r];
      });
    } else if (raw.autoSell) {
      rarities.forEach((r) => {
        next.autoSellRarities[r] = true;
      });
    }
    next.autoSellMutations = !!raw.autoSellMutations;
    next.catches = Math.max(0, Math.floor(Number(raw.catches) || 0));
    next.perfects = Math.max(0, Math.floor(Number(raw.perfects) || 0));
    next.bestCatchScore = sanitizeCatchScore(raw.bestCatchScore);
    next.bestCatchId = typeof raw.bestCatchId === "string" ? raw.bestCatchId : "";
    next.bestCatchVariant = normalizeVariant(raw.bestCatchVariant);
    next.bestCatchShiny = !!raw.bestCatchShiny;
    next.bestCatchMutation = normalizeMutation(raw.bestCatchMutation);
    if (!next.bestCatchScore) {
      next.bestCatchScore = getStoredBest();
    }
    if (!next.bestCatchId && next.bestCatchScore) {
      const match = fishFromCatchScore(next.bestCatchScore);
      if (match) next.bestCatchId = match.id;
    }
    if (Array.isArray(ctx.bestCatchMeta) || ctx.bestCatchMeta) {
      const meta = ctx.bestCatchMeta;
      if (meta && typeof meta === "object") {
        if (!next.bestCatchId && typeof meta.id === "string" && fishById(meta.id)) {
          next.bestCatchId = meta.id;
        }
        if (meta.id && meta.id === next.bestCatchId) {
          next.bestCatchVariant = normalizeVariant(meta.variant) || next.bestCatchVariant;
          next.bestCatchShiny = !!(meta.shiny || next.bestCatchShiny);
          next.bestCatchMutation = normalizeMutation(meta.mutation) || next.bestCatchMutation;
        }
      }
    }
    if (next.bestCatchId && !fishById(next.bestCatchId)) {
      next.bestCatchId = "";
      next.bestCatchVariant = "";
      next.bestCatchShiny = false;
      next.bestCatchMutation = "";
    }
    next.caught = {};
    if (raw.caught && typeof raw.caught === "object") {
      Object.keys(raw.caught).forEach((id) => {
        if (!fishById(id) || !raw.caught[id]) return;
        next.caught[id] = normalizeCaughtRecord(raw.caught[id]);
      });
    }
    if (next.bestCatchId && fishById(next.bestCatchId)) {
      next.caught[next.bestCatchId] = normalizeCaughtRecord(next.caught[next.bestCatchId] || true);
    }
    next.lastTick = Math.max(0, Number(raw.lastTick) || now);
    spots.forEach((s) => {
      next.unlocked[s.id] = s.id === "creek" || !!raw.unlocked?.[s.id];
    });
    gear.forEach((g) => {
      next.owned[g.id] = !!raw.owned?.[g.id];
    });
    next.equippedSpeed = resolveEquippedSpeed(next.owned, raw.equippedSpeed);
    const savedBoat = Math.floor(Number(raw.boatLevel) || 0);
    const legacyBoat = migrateLegacyBoats(raw.owned);
    next.boatLevel = Math.max(0, Math.min(boatMax, Math.max(savedBoat, legacyBoat)));
    const savedAqua = Math.floor(Number(raw.aquariumLevel) || 0);
    const legacyAqua = migrateLegacyAquarium(raw.owned);
    next.aquariumLevel = Math.max(0, Math.min(aquaMax, Math.max(savedAqua, legacyAqua)));
    next.cooler = Array.isArray(raw.cooler)
      ? raw.cooler
          .map(normalizeCoolerEntry)
          .filter(Boolean)
          .slice(0, coolerMaxFromOwned(next.owned))
      : [];
    next.cooler.forEach((entry) => {
      const id = entry?.id || "";
      const fish = fishById(id);
      if (!fish) return;
      const rec = normalizeCaughtRecord(next.caught[id]);
      rec.any = true;
      const variant = normalizeVariant(entry.variant);
      const shiny = !!entry.shiny;
      const mutation = normalizeMutation(entry.mutation);
      if (!variant && !shiny && !mutation) rec.base = true;
      if (variant && VARIANT_PRIMARY.includes(variant)) rec[variant] = true;
      if (shiny) rec.shiny = true;
      if (mutation && MUTATIONS.includes(mutation)) rec[mutation] = true;
      const look = caughtLookKey(variant, shiny, mutation);
      if (!rec.looks || typeof rec.looks !== "object") rec.looks = {};
      rec.looks[look] = true;
      next.caught[id] = rec;
    });
    const backup = readChestBoostBackup();
    const moneyUntil = Math.max(
      0,
      Number(raw.moneyBoostUntil) || Number(raw.treasureBoostUntil) || 0
    );
    const luckUntil = Math.max(0, Number(raw.luckBoostUntil) || 0);
    const moneyRestored = restoreChestBoostChannel(
      !!raw.moneyBoostPaused,
      raw.moneyBoostPausedLeft,
      moneyUntil,
      now,
      !!backup?.moneyPaused,
      backup?.moneyLeft
    );
    const luckRestored = restoreChestBoostChannel(
      !!raw.luckBoostPaused,
      raw.luckBoostPausedLeft,
      luckUntil,
      now,
      !!backup?.luckPaused,
      backup?.luckLeft
    );
    next.moneyBoostPaused = moneyRestored.paused;
    next.moneyBoostPausedLeft = moneyRestored.leftover;
    next.moneyBoostUntil = moneyRestored.until;
    next.luckBoostPaused = luckRestored.paused;
    next.luckBoostPausedLeft = luckRestored.leftover;
    next.luckBoostUntil = luckRestored.until;
    const legacyCount = Math.max(0, Math.floor(Number(raw.treasureCount) || 0));
    next.moneyChestCount = Math.max(
      0,
      Math.min(treasureHardMax, Math.floor(Number(raw.moneyChestCount) || legacyCount || 0))
    );
    next.luckChestCount = Math.max(
      0,
      Math.min(treasureHardMax, Math.floor(Number(raw.luckChestCount) || 0))
    );
    next.luckyBlockCount = Math.max(
      0,
      Math.min(luckyBlockMax, Math.floor(Number(raw.luckyBlockCount) || 0))
    );
    next.astralLuckyBlockCount = Math.max(
      0,
      Math.min(luckyBlockMax, Math.floor(Number(raw.astralLuckyBlockCount) || 0))
    );
    next.zenithLuckyBlockCount = Math.max(
      0,
      Math.min(luckyBlockMax, Math.floor(Number(raw.zenithLuckyBlockCount) || 0))
    );
    next.smartShop = raw.smartShop !== false;
    next.collectionLuckTold = !!raw.collectionLuckTold;
    next.collectionRainbowTold = !!raw.collectionRainbowTold;
    next.collectionLbEventTold = !!raw.collectionLbEventTold;
    next.collectionLbAlwaysTold = !!raw.collectionLbAlwaysTold;
    next.collectionSoulTwinGranted = !!raw.collectionSoulTwinGranted;
    next.quests = normalizeQuestsState(raw.quests);
    if (raw.echoLuckReset !== echoLuckResetId) {
      next.echoLuckLevel = 0;
      next.echoLuckReset = echoLuckResetId;
    } else {
      next.echoLuckLevel = Math.max(
        0,
        Math.min(echoLuckMax, Math.floor(Number(raw.echoLuckLevel) || 0))
      );
      next.echoLuckReset = echoLuckResetId;
    }
    if (raw.luckDialFollowMax === false && Number.isFinite(Number(raw.luckDial))) {
      next.luckDialFollowMax = false;
      next.luckDial = Math.max(0, Number(raw.luckDial));
    } else {
      next.luckDialFollowMax = true;
      next.luckDial = null;
    }
    next.spotCasts = {};
    if (raw.spotCasts && typeof raw.spotCasts === "object") {
      Object.keys(raw.spotCasts).forEach((id) => {
        const n = Math.floor(Number(raw.spotCasts[id]) || 0);
        if (n > 0) next.spotCasts[id] = n;
      });
    }
    next.weatherId = String(raw.weatherId || "none");
    if (next.weatherId === "clear" || next.weatherId === "fog" || next.weatherId === "tide") {
      next.weatherId = "none";
    }
    next.weatherUntil = Math.max(0, Number(raw.weatherUntil) || 0);
    next.combo = Math.max(0, Math.floor(Number(raw.combo) || 0));
    next.comboBoostUntil = Math.max(0, Number(raw.comboBoostUntil) || 0);
    next.aquariumBank = Math.max(0, Number(raw.aquariumBank) || 0);
    next.aquariumLastTick = Math.max(0, Number(raw.aquariumLastTick) || now);
    next.coolerSort = ["value", "rarity", "shiny", "saved", "name"].includes(raw.coolerSort)
      ? raw.coolerSort
      : "value";
    next.coolerFilter = ["all", "saved", "shiny", "unsaved"].includes(raw.coolerFilter)
      ? raw.coolerFilter
      : "all";
    next.coolerSearch = String(raw.coolerSearch || "").slice(0, 48);
    next.bookSearch = String(raw.bookSearch || "").slice(0, 48);
    next.pendingOffline =
      raw.pendingOffline && typeof raw.pendingOffline === "object" ? raw.pendingOffline : null;
    next.communityWeekKey = String(raw.communityWeekKey || "");
    next.communityContrib = Math.max(0, Math.floor(Number(raw.communityContrib) || 0));
    next.communityPendingAdds = Math.max(0, Math.floor(Number(raw.communityPendingAdds) || 0));
    next.communityLbClaimedKey = String(raw.communityLbClaimedKey || "");
    next.communityLbClaimedWave = Math.max(0, Math.floor(Number(raw.communityLbClaimedWave) || 0));
    next.ownerPlayerId = String(raw.ownerPlayerId || ctx.ownerId || "");
    next.ownerName = String(raw.ownerName || ctx.ownerName || "");
    return next;
  }

  const AQUA_MINE_KEY = "aqua-mine";
  const AQUA_MINE_FISH_MAX = 80;

  function sanitizeAquaMineFish(entry) {
    if (!entry || typeof entry !== "object") return null;
    const id = String(entry.id || "")
      .trim()
      .slice(0, 32);
    if (!id) return null;
    return {
      id,
      variant: String(entry.variant || "").slice(0, 16),
      shiny: !!entry.shiny,
      mutation: String(entry.mutation || "").slice(0, 16)
    };
  }

  function collectAquaMine(tank, playerId) {
    const me = String(playerId || "").trim();
    if (!me || !tank || typeof tank !== "object") return null;
    const tankId = String(tank.playerId || me).trim();
    if (tankId !== me) return null;
    const fish = Array.isArray(tank.fish)
      ? tank.fish.map(sanitizeAquaMineFish).filter(Boolean).slice(0, AQUA_MINE_FISH_MAX)
      : [];
    const base = tank.base && typeof tank.base === "object" ? tank.base : null;
    return {
      playerId: me,
      name:
        String(tank.name || "Player")
          .trim()
          .slice(0, 48) || "Player",
      updatedAt: Math.max(0, Number(tank.updatedAt) || Date.now()),
      level: Math.max(0, Math.floor(Number(tank.level) || 0)),
      fish,
      base
    };
  }

  function readAquaMine(payload) {
    if (!payload || typeof payload !== "object") return null;
    const playerId = String(payload.playerId || "").trim();
    if (!playerId) return null;
    return collectAquaMine(payload, playerId);
  }

  function applyAquaMine(tanks, mine, playerId) {
    const local = tanks && typeof tanks === "object" && !Array.isArray(tanks) ? { ...tanks } : {};
    const row = readAquaMine(mine);
    const me = String(playerId || row?.playerId || "").trim();
    if (!row || !me || row.playerId !== me) return local;
    const existing = local[me];
    const existAt = Number(existing?.updatedAt) || 0;
    const mineAt = Number(row.updatedAt) || 0;
    if (existing && existAt > mineAt) return local;
    local[me] = row;
    return local;
  }

  /** Shared fishing-aquariums POST is safe only when the fetch succeeded (even if tanks is empty). */
  function canPostSharedAqua(remote) {
    return !!(remote && typeof remote === "object");
  }

  const api = {
    SAVE_KEY,
    SAVE_BACKUP_KEY,
    ECHO_LUCK_RESET_ID,
    fishingSaveRichness,
    pickRicherSave,
    defaultAutoSell,
    defaultState,
    hydrateState,
    AQUA_MINE_KEY,
    AQUA_MINE_FISH_MAX,
    collectAquaMine,
    readAquaMine,
    applyAquaMine,
    canPostSharedAqua
  };
  root.FishingSave = api;
  if (typeof module === "object" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
