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

  const AQUA_SHARE_TTL_MS = 14 * 24 * 60 * 60 * 1000;
  const AQUA_SHARE_MAX_TANKS = 120;

  function overlayAquaTanks(hub, rows, now = Date.now()) {
    const tanks = {
      ...((hub && hub.tanks && typeof hub.tanks === "object" && !Array.isArray(hub.tanks)
        ? hub.tanks
        : {}) || {})
    };
    (Array.isArray(rows) ? rows : []).forEach((row) => {
      const pid = String(row?.player_id || row?.playerId || "").trim();
      if (!pid) return;
      const tank = collectAquaMine(row?.tank || row, pid);
      if (!tank) return;
      const existing = tanks[pid];
      if (!existing || (Number(tank.updatedAt) || 0) >= (Number(existing.updatedAt) || 0)) {
        tanks[pid] = tank;
      }
    });
    const entries = Object.entries(tanks).filter(([, tank]) => {
      if (!tank || typeof tank !== "object") return false;
      const at = Number(tank.updatedAt) || 0;
      return !at || now - at < AQUA_SHARE_TTL_MS;
    });
    entries.sort((a, b) => (Number(b[1].updatedAt) || 0) - (Number(a[1].updatedAt) || 0));
    const next = {};
    entries.slice(0, AQUA_SHARE_MAX_TANKS).forEach(([id, tank]) => {
      next[id] = tank;
    });
    return { token: hub?.token, tanks: next };
  }

  const COMMUNITY_CASTS_CAP = 10000;
  const MAIL_GIFT_CAP = 40;
  const MAIL_TRADE_CAP = 20;
  const MAIL_ITEM_CAP = 8;
  const MAIL_CLAIMED_TTL_MS = 3 * 24 * 60 * 60 * 1000;
  const MAIL_GIFT_TTL_MS = 14 * 24 * 60 * 60 * 1000;
  const MAIL_TRADE_DONE_TTL_MS = 2 * 24 * 60 * 60 * 1000;

  function mailInvolvesPlayer(entry, playerId, kind) {
    const me = String(playerId || "").trim();
    if (!me || !entry || typeof entry !== "object") return false;
    if (kind === "gift") {
      return String(entry.fromId || "") === me || String(entry.toPlayerId || "") === me;
    }
    return String(entry.aId || "") === me || String(entry.bId || "") === me;
  }

  function sanitizeMailItem(raw) {
    if (!raw || typeof raw !== "object") return null;
    const kind = String(raw.kind || "").toLowerCase();
    if (kind === "fish") {
      const fishId = String(raw.fishId || "")
        .trim()
        .slice(0, 32);
      if (!fishId) return null;
      return {
        kind: "fish",
        fishId,
        variant: String(raw.variant || "")
          .toLowerCase()
          .slice(0, 16),
        shiny: !!raw.shiny,
        mutation: String(raw.mutation || "")
          .toLowerCase()
          .slice(0, 16),
        perfect: !!raw.perfect
      };
    }
    if (kind === "chest") {
      return {
        kind: "chest",
        chestKind: String(raw.chestKind || "money") === "luck" ? "luck" : "money",
        count: Math.min(50, Math.max(1, Math.floor(Number(raw.count) || 1)))
      };
    }
    if (kind === "luckyblock") {
      const t = String(raw.lbType || "absolute").toLowerCase();
      const lbType = t === "zenith" || t === "astral" ? t : "absolute";
      return {
        kind: "luckyblock",
        lbType,
        count: Math.min(50, Math.max(1, Math.floor(Number(raw.count) || 1)))
      };
    }
    return null;
  }

  function cleanMailGift(raw) {
    if (!raw || typeof raw !== "object") return null;
    const id = String(raw.id || "")
      .trim()
      .slice(0, 64);
    if (!id) return null;
    const items = (Array.isArray(raw.items) ? raw.items : [])
      .map(sanitizeMailItem)
      .filter(Boolean)
      .slice(0, MAIL_ITEM_CAP);
    if (!items.length) return null;
    const fromId = String(raw.fromId || "").trim();
    const toPlayerId = String(raw.toPlayerId || "").trim();
    if (!fromId && !toPlayerId) return null;
    return {
      id,
      fromId,
      fromName: String(raw.fromName || "").slice(0, 48),
      toPlayerId,
      toName: String(raw.toName || "")
        .toLowerCase()
        .slice(0, 48),
      toDisplay: String(raw.toDisplay || "").slice(0, 48),
      items,
      at: Math.max(0, Number(raw.at) || 0),
      claimed: !!raw.claimed,
      claimedBy: String(raw.claimedBy || "").slice(0, 64),
      claimedAt: Math.max(0, Number(raw.claimedAt) || 0)
    };
  }

  function cleanMailTrade(raw) {
    if (!raw || typeof raw !== "object") return null;
    const id = String(raw.id || "")
      .trim()
      .slice(0, 64);
    const aId = String(raw.aId || "").trim();
    const bId = String(raw.bId || "").trim();
    if (!id || !aId || !bId) return null;
    const statusRaw = String(raw.status || "open");
    const status = statusRaw === "done" || statusRaw === "cancelled" ? statusRaw : "open";
    return {
      id,
      aId,
      aName: String(raw.aName || "").slice(0, 48),
      bId,
      bName: String(raw.bName || "").slice(0, 48),
      aItems: (Array.isArray(raw.aItems) ? raw.aItems : [])
        .map(sanitizeMailItem)
        .filter(Boolean)
        .slice(0, MAIL_ITEM_CAP),
      bItems: (Array.isArray(raw.bItems) ? raw.bItems : [])
        .map(sanitizeMailItem)
        .filter(Boolean)
        .slice(0, MAIL_ITEM_CAP),
      aAccept: !!raw.aAccept,
      bAccept: !!raw.bAccept,
      status,
      at: Math.max(0, Number(raw.at) || 0),
      updatedAt: Math.max(0, Number(raw.updatedAt) || Number(raw.at) || 0),
      appliedBy:
        raw.appliedBy && typeof raw.appliedBy === "object" && !Array.isArray(raw.appliedBy)
          ? { ...raw.appliedBy }
          : {},
      restoredBy:
        raw.restoredBy && typeof raw.restoredBy === "object" && !Array.isArray(raw.restoredBy)
          ? { ...raw.restoredBy }
          : {},
      note: String(raw.note || "").slice(0, 32)
    };
  }

  function mergeMailGift(a, b) {
    if (!a) return b || null;
    if (!b) return a;
    if (a.claimed !== b.claimed) return a.claimed ? a : b;
    if (a.claimed && b.claimed) {
      return (Number(a.claimedAt) || 0) >= (Number(b.claimedAt) || 0) ? a : b;
    }
    const aN = (a.items || []).length;
    const bN = (b.items || []).length;
    if (aN !== bN) return aN < bN ? a : b;
    return (Number(a.at) || 0) >= (Number(b.at) || 0) ? a : b;
  }

  function mergeFlagMap(a, b) {
    return { ...(a || {}), ...(b || {}) };
  }

  function mergeMailTrade(a, b) {
    if (!a) return b || null;
    if (!b) return a;
    const aDone = a.status === "done" || a.status === "cancelled";
    const bDone = b.status === "done" || b.status === "cancelled";
    const winner = aDone !== bDone ? (aDone ? a : b) : (Number(a.updatedAt) || 0) >= (Number(b.updatedAt) || 0) ? a : b;
    return {
      ...winner,
      appliedBy: mergeFlagMap(a.appliedBy, b.appliedBy),
      restoredBy: mergeFlagMap(a.restoredBy, b.restoredBy)
    };
  }

  function capMailMap(map, cap) {
    const entries = Object.entries(map && typeof map === "object" ? map : {});
    if (entries.length <= cap) {
      const out = {};
      entries.forEach(([id, val]) => {
        if (val) out[id] = val;
      });
      return out;
    }
    entries.sort(
      (left, right) =>
        (Number(right[1]?.updatedAt || right[1]?.claimedAt || right[1]?.at) || 0) -
        (Number(left[1]?.updatedAt || left[1]?.claimedAt || left[1]?.at) || 0)
    );
    const out = {};
    entries.slice(0, cap).forEach(([id, val]) => {
      if (val) out[id] = val;
    });
    return out;
  }

  function collectPlayerMailMine(gifts, trades, playerId) {
    const me = String(playerId || "").trim();
    const mineGifts = {};
    const mineTrades = {};
    if (!me) return { playerId: "", gifts: {}, trades: {} };
    Object.entries(gifts && typeof gifts === "object" && !Array.isArray(gifts) ? gifts : {}).forEach(
      ([id, raw]) => {
        const gift = cleanMailGift({ ...(raw || {}), id: raw?.id || id });
        if (!gift || !mailInvolvesPlayer(gift, me, "gift")) return;
        mineGifts[gift.id] = gift;
      }
    );
    Object.entries(trades && typeof trades === "object" && !Array.isArray(trades) ? trades : {}).forEach(
      ([id, raw]) => {
        const trade = cleanMailTrade({ ...(raw || {}), id: raw?.id || id });
        if (!trade || !mailInvolvesPlayer(trade, me, "trade")) return;
        mineTrades[trade.id] = trade;
      }
    );
    return {
      playerId: me,
      gifts: capMailMap(mineGifts, MAIL_GIFT_CAP),
      trades: capMailMap(mineTrades, MAIL_TRADE_CAP)
    };
  }

  function overlayPlayerMail(hub, rows, now = Date.now()) {
    let gifts = { ...((hub && hub.gifts && typeof hub.gifts === "object" ? hub.gifts : {}) || {}) };
    let trades = { ...((hub && hub.trades && typeof hub.trades === "object" ? hub.trades : {}) || {}) };
    (Array.isArray(rows) ? rows : []).forEach((row) => {
      const pid = String(row?.player_id || row?.playerId || "").trim();
      if (!pid) return;
      const owned = collectPlayerMailMine(row?.gifts, row?.trades, pid);
      Object.entries(owned.gifts || {}).forEach(([id, gift]) => {
        gifts[id] = mergeMailGift(gifts[id], gift);
      });
      Object.entries(owned.trades || {}).forEach(([id, trade]) => {
        trades[id] = mergeMailTrade(trades[id], trade);
      });
    });
    const nextGifts = {};
    Object.entries(gifts).forEach(([id, gift]) => {
      if (!gift) return;
      const at = Number(gift.at) || 0;
      if (gift.claimed && now - (Number(gift.claimedAt) || at) > MAIL_CLAIMED_TTL_MS) return;
      if (!gift.claimed && at && now - at > MAIL_GIFT_TTL_MS) return;
      nextGifts[id] = gift;
    });
    const nextTrades = {};
    Object.entries(trades).forEach(([id, trade]) => {
      if (!trade) return;
      const at = Number(trade.updatedAt || trade.at) || 0;
      const done = trade.status === "done" || trade.status === "cancelled";
      if (done && at && now - at > MAIL_TRADE_DONE_TTL_MS) return;
      nextTrades[id] = trade;
    });
    return {
      token: hub?.token,
      gifts: nextGifts,
      trades: nextTrades
    };
  }

  function unwrapMailChange(change) {
    const payload = change && typeof change === "object" ? change : {};
    if (payload.data && typeof payload.data === "object") return payload.data;
    if (payload.payload && typeof payload.payload === "object") {
      const inner = payload.payload;
      if (inner.data && typeof inner.data === "object") return inner.data;
      return inner;
    }
    return payload;
  }

  function applyPlayerMailChange(hub, change, now = Date.now()) {
    const data = unwrapMailChange(change);
    const type = String(data.type || data.eventType || change?.event || "").toUpperCase();
    const current = {
      token: hub?.token,
      gifts: { ...((hub && hub.gifts && typeof hub.gifts === "object" ? hub.gifts : {}) || {}) },
      trades: { ...((hub && hub.trades && typeof hub.trades === "object" ? hub.trades : {}) || {}) }
    };
    if (type === "DELETE") return current;
    const record = data.record || data.new || {};
    if (!record || typeof record !== "object") return current;
    return overlayPlayerMail(current, [record], now);
  }

  const ADMIN_GIFT_CAP = 40;
  const ADMIN_BROADCAST_NAMES = new Set([
    "*",
    "everyone",
    "everybody",
    "all",
    "all players",
    "global",
    "players"
  ]);

  function isAdminBroadcastGift(g) {
    if (!g || typeof g !== "object") return false;
    if (g.broadcast) return true;
    return ADMIN_BROADCAST_NAMES.has(String(g.toName || "").toLowerCase());
  }

  function claimedByMap(raw, claimedAt) {
    if (raw && typeof raw === "object" && !Array.isArray(raw)) {
      const out = {};
      Object.entries(raw).forEach(([key, value]) => {
        const id = String(key || "")
          .trim()
          .slice(0, 64);
        if (!id) return;
        out[id] = Math.max(0, Number(value) || Number(claimedAt) || 0);
      });
      return out;
    }
    const id = String(raw || "")
      .trim()
      .slice(0, 64);
    if (!id) return {};
    return { [id]: Math.max(0, Number(claimedAt) || 0) };
  }

  function mergeClaimedByMaps(a, b) {
    const out = { ...(a || {}) };
    Object.entries(b || {}).forEach(([key, value]) => {
      const n = Math.max(0, Number(value) || 0);
      if (!out[key] || n >= (Number(out[key]) || 0)) out[key] = n;
    });
    return out;
  }

  function cleanAdminFishGift(raw) {
    if (!raw || typeof raw !== "object") return null;
    const id = String(raw.id || "")
      .trim()
      .slice(0, 64);
    const fishId = String(raw.fishId || "").slice(0, 32);
    const item = String(raw.item || "").slice(0, 32);
    if (!id || (!fishId && !item)) return null;
    const broadcast = isAdminBroadcastGift(raw);
    const claimedAt = Math.max(0, Number(raw.claimedAt) || 0);
    return {
      id,
      toName: String(raw.toName || "")
        .toLowerCase()
        .slice(0, 48),
      toPlayerId: String(raw.toPlayerId || "").trim(),
      toDisplay: String(raw.toDisplay || "").slice(0, 48),
      from: String(raw.from || "ICE_DRAGON").slice(0, 48),
      fromId: String(raw.fromId || "").trim(),
      fishId,
      item,
      variant: String(raw.variant || "")
        .toLowerCase()
        .slice(0, 16),
      shiny: !!raw.shiny,
      mutation: String(raw.mutation || "")
        .toLowerCase()
        .slice(0, 16),
      perfect: !!raw.perfect,
      count: Math.min(50, Math.max(1, Math.floor(Number(raw.count) || 1))),
      at: Math.max(0, Number(raw.at) || 0),
      broadcast,
      onlineOnly: !!raw.onlineOnly,
      onlineIds: Array.isArray(raw.onlineIds) ? raw.onlineIds.map(String).slice(0, 80) : [],
      onlineNames: Array.isArray(raw.onlineNames)
        ? raw.onlineNames.map((name) => String(name || "").toLowerCase()).slice(0, 80)
        : [],
      claimed: broadcast ? false : !!raw.claimed,
      claimedBy: broadcast ? claimedByMap(raw.claimedBy, claimedAt) : String(raw.claimedBy || "").slice(0, 64),
      claimedAt
    };
  }

  function adminGiftInvolvesPlayer(gift, playerId) {
    const me = String(playerId || "").trim();
    if (!me || !gift) return false;
    if (String(gift.toPlayerId || "") === me || String(gift.fromId || "") === me) return true;
    if (!gift.broadcast) return false;
    const by = claimedByMap(gift.claimedBy, gift.claimedAt);
    return !!by[me];
  }

  function mergeAdminFishGift(a, b) {
    if (!a) return b || null;
    if (!b) return a;
    const broadcast = !!(a.broadcast || b.broadcast);
    if (broadcast) {
      const base = (Number(a.at) || 0) >= (Number(b.at) || 0) ? a : b;
      return {
        ...base,
        broadcast: true,
        claimed: false,
        claimedBy: mergeClaimedByMaps(claimedByMap(a.claimedBy, a.claimedAt), claimedByMap(b.claimedBy, b.claimedAt)),
        claimedAt: Math.max(Number(a.claimedAt) || 0, Number(b.claimedAt) || 0)
      };
    }
    if (a.claimed !== b.claimed) return a.claimed ? a : b;
    return (Number(a.claimedAt || a.at) || 0) >= (Number(b.claimedAt || b.at) || 0) ? a : b;
  }

  function collectAdminFishGiftsMine(gifts, playerId) {
    const me = String(playerId || "").trim();
    const mine = {};
    if (!me) return { playerId: "", gifts: {} };
    Object.entries(gifts && typeof gifts === "object" && !Array.isArray(gifts) ? gifts : {}).forEach(
      ([id, raw]) => {
        const gift = cleanAdminFishGift({ ...(raw || {}), id: raw?.id || id });
        if (!gift || !adminGiftInvolvesPlayer(gift, me)) return;
        mine[gift.id] = gift;
      }
    );
    return { playerId: me, gifts: capMailMap(mine, ADMIN_GIFT_CAP) };
  }

  function overlayAdminFishGifts(hub, rows, now = Date.now()) {
    let gifts = { ...((hub && hub.gifts && typeof hub.gifts === "object" ? hub.gifts : {}) || {}) };
    (Array.isArray(rows) ? rows : []).forEach((row) => {
      const pid = String(row?.player_id || row?.playerId || "").trim();
      if (!pid) return;
      const owned = collectAdminFishGiftsMine(row?.gifts, pid);
      Object.entries(owned.gifts || {}).forEach(([id, gift]) => {
        gifts[id] = mergeAdminFishGift(gifts[id], gift);
      });
    });
    const next = {};
    Object.entries(gifts).forEach(([id, gift]) => {
      if (!gift) return;
      const at = Number(gift.at) || 0;
      if (gift.claimed && now - (Number(gift.claimedAt) || at) > MAIL_CLAIMED_TTL_MS) return;
      if (!gift.claimed && at && now - at > MAIL_GIFT_TTL_MS) return;
      next[id] = gift;
    });
    return { token: hub?.token, gifts: next };
  }

  function overlayCommunityCasts(hub, rows, weekKey) {
    const base = hub && typeof hub === "object" && !Array.isArray(hub) ? { ...hub } : {};
    const key = String(weekKey || base.weekKey || "").slice(0, 64);
    let sum = 0;
    (Array.isArray(rows) ? rows : []).forEach((row) => {
      if (!row || typeof row !== "object") return;
      const pid = String(row.player_id || row.playerId || "").trim();
      if (!pid) return;
      const rowKey = String(row.week_key || row.weekKey || "").slice(0, 64);
      if (key && rowKey !== key) return;
      const n = Math.floor(Number(row.casts) || 0);
      if (n <= 0) return;
      sum += Math.min(COMMUNITY_CASTS_CAP, n);
    });
    const hubTotal = Math.max(0, Math.floor(Number(base.total) || 0));
    base.total = Math.max(hubTotal, sum);
    if (key) base.weekKey = key;
    return base;
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
    canPostSharedAqua,
    overlayAquaTanks,
    COMMUNITY_CASTS_CAP,
    overlayCommunityCasts,
    MAIL_GIFT_CAP,
    MAIL_TRADE_CAP,
    collectPlayerMailMine,
    overlayPlayerMail,
    applyPlayerMailChange,
    ADMIN_GIFT_CAP,
    collectAdminFishGiftsMine,
    overlayAdminFishGifts
  };
  root.FishingSave = api;
  if (typeof module === "object" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
