(function () {
  const SAVE_KEY = "fishing-save-v3";
  const HIGH_SCORE_KEY = "fishing-best-catch-v2";
  const BEST_CATCH_META_KEY = "fishing-best-catch-meta-v2";
  const CHEST_BOOST_SAVE_KEY = "fishing-chest-boost-v1";
  /** One-time: wipe Echo Charm buys for every save that has not stamped this id. */
  const ECHO_LUCK_RESET_ID = "echo-luck-reset-v1";

  // Drop old Fishing Idle progress keys (full reset — this game only)
  try {
    localStorage.removeItem("fishing-save-v2");
    localStorage.removeItem("fishing-best-catch-v1");
    localStorage.removeItem("fishing-best-catch-meta-v1");
  } catch {}

  const ICE_BOAT_GRANT_ID = "fishing-ice-dragon-boat-lv1-v1";
  const ICE_COINS_GRANT_ID = "fishing-ice-dragon-coins-1m-v1";
  const ICE_BEST_GRANT_ID = "fishing-ice-dragon-primefin-shiny-v1";
  const ICE_CHESTS_GRANT_ID = "fishing-ice-dragon-chests-20-23-v1";
  /** One-time: remove a single duplicate Soul Twin from ICE_DRAGON's cooler. */
  const ICE_SOUL_TWIN_TRIM_ID = "fishing-ice-dragon-soultwin-trim-v2";
  /** One-time: migrate off precision-broken catch scores (Apex+ values). */
  const CATCH_SCORE_V2_ID = "fishing-catch-score-safe-v7";
  const ICE_LOCAL_WIPE_ID = "hub-fishing-ice-dragon-wipe-v1";
  const ICE_COINS_GRANT_AMOUNT = 1_000_000;
  const ICE_MONEY_CHEST_GRANT = 20;
  const ICE_LUCK_CHEST_GRANT = 23;
  const TICK_MS = 100;
  const COOLER_BASE = 12;
  const TREASURE_BOOST_MS = 5 * 60 * 1000;
  const TREASURE_MULT = 2;
  const TREASURE_LUCK_MULT = 1.5;
  const TREASURE_STASH_MAX = 25;
  const TREASURE_STASH_MAX_MASTER = 100;
  /** Admin gifts may exceed the soft earn cap; persist/allow up to this hard ceiling. */
  const TREASURE_STASH_HARD_MAX = 999;
  const EVENT_MS = 30 * 60 * 1000;
  const EVENT_ACTIVE_MS = 5 * 60 * 1000; // only first 5 minutes of each :00 / :30
  /** Scheduled :00 / :30 events roll one of these (same for all players per slot). */
  const EVENT_MULT_OPTIONS = [1.5, 2, 3, 4];
  /** Hourly Lucky Block drop window at :00 (runs alongside sell/luck). */
  const LUCKY_BLOCK_EVENT_MS = 60 * 60 * 1000;
  const LUCKY_BLOCK_EVENT_ACTIVE_MS = 5 * 60 * 1000;
  /** Flat base drop chance while the Lucky Block hour is live — luck never applies. */
  const LUCKY_BLOCK_EVENT_CHANCE = 0.001;
  /** Zenith Lucky Block base drop during the same windows — luck never applies. */
  const LUCKY_BLOCK_ZENITH_EVENT_CHANCE = 0.001;
  /** Scheduled :00 Lucky Block events roll one of these (same for all players per hour). */
  const LUCKY_BLOCK_EVENT_MULT_OPTIONS = [1, 1.5, 2, 3];
  /**
   * Smarter gear shop: next upgrade first, collapse owned, show real deltas / soft caps.
   * Easy remove: set false — OR delete this flag, all `shopSmart*` helpers, SMART_GEAR_SHOP
   * branches in renderShop / shopList click, and the `SMART GEAR SHOP` CSS block.
   */
  const SMART_GEAR_SHOP = true;
  const CHEST_MONEY_BONUS = TREASURE_MULT - 1; // +1 → 2×
  const CHEST_LUCK_BONUS = TREASURE_LUCK_MULT - 1; // +0.5 → 1.5×
  // Chest + matching event stacks additively with the rolled event mult
  // Global admin override: Mantle (ICE in-game) + admin-event.json (chat push)
  const OWNER_NAME = "ice_dragon";
  const FISHING_ADMIN_NAMES = new Set(["ice_dragon", "ice_dragon alt"]);
  /** Local-only admin: events on their device + self gifts. No global, no gifts to others. */
  const FISHING_LIMITED_ADMIN_NAMES = new Set(["hjalte"]);

  // One-time: reset ICE_DRAGON's local Fishing Idle progress only.
  try {
    const name = String(
      (typeof HubPlays !== "undefined" && HubPlays.getName && HubPlays.getName()) ||
        localStorage.getItem("hub-player-name") ||
        ""
    )
      .trim()
      .toLowerCase();
    if (name === OWNER_NAME && localStorage.getItem(ICE_LOCAL_WIPE_ID) !== "done") {
      const doomed = [];
      for (let i = 0; i < localStorage.length; i += 1) {
        const key = localStorage.key(i);
        if (key && /^fishing/i.test(key) && key !== ICE_LOCAL_WIPE_ID) doomed.push(key);
      }
      doomed.forEach((key) => localStorage.removeItem(key));
      try {
        const achKey = "hub-achievements-v1";
        const raw = localStorage.getItem(achKey);
        if (raw) {
          const data = JSON.parse(raw) || {};
          Object.keys(data).forEach((id) => {
            if (/^fishing_/i.test(id)) delete data[id];
          });
          localStorage.setItem(achKey, JSON.stringify(data));
        }
        const pendingKey = "hub-achievements-pending";
        const pendingRaw = localStorage.getItem(pendingKey);
        if (pendingRaw) {
          const list = JSON.parse(pendingRaw);
          if (Array.isArray(list)) {
            localStorage.setItem(
              pendingKey,
              JSON.stringify(list.filter((id) => !/^fishing_/i.test(String(id || ""))))
            );
          }
        }
      } catch {}
      // Keep old one-time grants from re-applying after this wipe.
      localStorage.setItem(ICE_BOAT_GRANT_ID, "done");
      localStorage.setItem(ICE_COINS_GRANT_ID, "done");
      localStorage.setItem(ICE_BEST_GRANT_ID, "done");
      localStorage.setItem(ICE_LOCAL_WIPE_ID, "done");
    }
  } catch {}

  const ADMIN_EVENT_URL = "admin-event.json";
  const ADMIN_EVENT_API = "https://mantledb.sh/v2/icedragon1st-mygames/fishing-admin-events";
  const ADMIN_EVENT_DOC = "fishing-admin-events";
  const ADMIN_EVENT_TOKEN = "ice-fish-evt-9f3a";
  const ADMIN_EVENT_POLL_MS = 15_000;
  const ADMIN_EVENT_RATE_KEY = "fishing-admin-mantle-until-v1";
  const ADMIN_EVENT_LOCAL_KEY = "fishing-admin-override-v1"; // legacy single-slot
  const ADMIN_EVENT_LOCAL_BOOST_KEY = "fishing-admin-boost-v1";
  const ADMIN_EVENT_LOCAL_VARIANT_KEY = "fishing-admin-variant-v1";
  const ADMIN_EVENT_LOCAL_CHEST_KEY = "fishing-admin-chest-v1";
  const ADMIN_EVENT_LOCAL_LB_KEY = "fishing-admin-luckyblock-v1";
  const ADMIN_EVENT_LOCAL_WEATHER_KEY = "fishing-admin-weather-v1";
  const ADMIN_EVENT_LOCAL_MUTATION_KEY = "fishing-admin-mutation-v1";
  const ADMIN_EVENT_LOCAL_SPEED_KEY = "fishing-admin-speed-v1";
  const ADMIN_EVENT_PENDING_KEY = "fishing-admin-pending-v1";
  const ADMIN_ANNOUNCE_DOC = "fishing-admin-announce";
  const ADMIN_ANNOUNCE_API = "https://mantledb.sh/v2/icedragon1st-mygames/fishing-admin-announce";
  const ADMIN_ANNOUNCE_URL = "admin-announce.json";
  const ADMIN_ANNOUNCE_SEEN_KEY = "fishing-admin-announce-seen-v1";
  /** Fast poll so popups land quickly for everyone (events stay on 15s). */
  const ADMIN_ANNOUNCE_POLL_MS = 2_000;
  /** How long the popup stays on screen for each player. */
  const ADMIN_ANNOUNCE_POPUP_MS = 10_000;
  /** How long a message stays claimable for players who poll in late. */
  const ADMIN_ANNOUNCE_CLAIM_MS = 2 * 60_000;
  const ADMIN_ANNOUNCE_MAX_LEN = 180;
  const FISH_GIFTS_API = "https://mantledb.sh/v2/icedragon1st-mygames/fishing-gifts";
  const FISH_GIFTS_DOC = "fishing-gifts";
  const FISH_GIFTS_TOKEN = "ice-fish-gift-9f3a";

  const PLAYER_MAIL_DOC = "fishing-player-mail";
  const PLAYER_MAIL_API = "https://mantledb.sh/v2/icedragon1st-mygames/fishing-player-mail";
  const PLAYER_MAIL_TOKEN = "ice-fish-mail-9f3a";
  const PLAYER_MAIL_CLAIMED_KEY = "fishing-player-mail-claimed-v1";
  const PLAYER_MAIL_POLL_MS = 5_000;
  const PLAYER_MAIL_MAX_ITEMS = 8;
  const PLAYER_MAIL_GIFT_COOLDOWN_MS = 30_000;
  const PLAYER_MAIL_GIFT_TTL_MS = 7 * 24 * 60 * 60_000;
  const PLAYER_MAIL_TRADE_TTL_MS = 24 * 60 * 60_000;

  const AQUA_SHARE_DOC = "fishing-aquariums";
  const AQUA_SHARE_API = "https://mantledb.sh/v2/icedragon1st-mygames/fishing-aquariums";
  const AQUA_SHARE_TOKEN = "ice-fish-aqua-9f3a";
  const AQUA_SHARE_POLL_MS = 20_000;
  const AQUA_SHARE_MAX_TANKS = 120;
  const AQUA_SHARE_TTL_MS = 14 * 24 * 60 * 60_000;
  const AQUA_SHARE_COOLER_MAX = 50;

  function fishingSb() {
    return window.HubSupabase && HubSupabase.ready ? HubSupabase : null;
  }
  const FISH_GIFTS_CLAIMED_KEY = "fishing-gifts-claimed-v1";
  const FISH_GIFTS_POLL_MS = 12_000;
  const ADMIN_SCOPE_KEY = "fishing-admin-scope-v1";
  const FISHING_PREFS_KEY = "fishing-prefs-v1";
  const ADMIN_RATE_BACKOFF_MS = 45_000;
  const ADMIN_DEFAULT_MINUTES = 5;
  const ADMIN_DEFAULT_MULT = 2;
  const ADMIN_MAX_MINUTES = 180;
  const ADMIN_MIN_MULT = 1;
  const ADMIN_MAX_MULT = 1000;
  const TREASURE_MONEY = {
    id: "coin_chest",
    name: "Coin Chest",
    rarity: "treasure",
    kind: "money",
    value: 0,
    blurb: "Use for 2× sell value for 5 minutes"
  };
  const TREASURE_LUCK = {
    id: "luck_chest",
    name: "Luck Chest",
    rarity: "treasure",
    kind: "luck",
    value: 0,
    blurb: "Use for 1.5× luck for 5 minutes"
  };
  const TREASURES = [TREASURE_MONEY, TREASURE_LUCK];
  const LUCKY_BLOCK_STASH_MAX = 50;

  const RARITIES = [
    "common",
    "uncommon",
    "rare",
    "epic",
    "legendary",
    "mythic",
    "secret",
    "divine",
    "eternal",
    "cosmic",
    "astral",
    "singularity",
    "omega",
    "genesis",
    "paradox",
    "infinity",
    "absolute",
    "transcendent",
    "nexus",
    "voidborn",
    "zenith",
    "crown",
    "origin",
    "aether",
    "radiant",
    "dusk",
    "apex",
    "sovereign",
    "celestial",
    "primordial",
    "ultimate",
    "exclusive"
  ];

  const RARITY_RANK = {
    common: 1,
    uncommon: 2,
    rare: 3,
    epic: 4,
    legendary: 5,
    mythic: 6,
    secret: 7,
    divine: 8,
    eternal: 9,
    cosmic: 10,
    astral: 11,
    singularity: 12,
    omega: 13,
    genesis: 14,
    paradox: 15,
    infinity: 16,
    absolute: 17,
    transcendent: 18,
    nexus: 19,
    voidborn: 20,
    zenith: 21,
    crown: 22,
    origin: 23,
    aether: 24,
    radiant: 25,
    dusk: 26,
    apex: 27,
    sovereign: 28,
    celestial: 29,
    primordial: 30,
    ultimate: 31,
    exclusive: 32
  };

  const RARITY_WEIGHT = {
    common: 12,
    uncommon: 10,
    rare: 8,
    epic: 11,
    legendary: 8,
    mythic: 5.5,
    secret: 3.2,
    divine: 2.2,
    eternal: 1.5,
    cosmic: 1.05,
    astral: 0.75,
    singularity: 0.52,
    omega: 0.36,
    genesis: 0.26,
    paradox: 0.19,
    infinity: 0.14,
    absolute: 0.1,
    transcendent: 0.072,
    nexus: 0.052,
    voidborn: 0.038,
    zenith: 0.026,
    crown: 0.019,
    origin: 0.014,
    aether: 0.01,
    radiant: 0.0072,
    dusk: 0.0052,
    apex: 0.0036,
    sovereign: 0.0026,
    celestial: 0.0019,
    primordial: 0.00135,
    ultimate: 0.00095,
    exclusive: 0
  };

  /** Soul Twin: 1 in 10,000,000 per fish roll (luck-immune; not on boat). */
  const SOUL_TWIN_ID = "soultwin";
  const SOUL_TWIN_CHANCE = 1 / 10_000_000;

  /** Admin Lucky Blocks: Astral / Absolute / Zenith (zenith = transcendent–zenith). */
  const LUCKY_BLOCK_TYPES = {
    astral: {
      id: "astral",
      name: "Astral Lucky Block",
      giftId: "__luckyblock_astral__",
      item: "luckyblock-astral",
      stateKey: "astralLuckyBlockCount",
      minRarity: "divine",
      maxRarity: "astral",
      rangeLabel: "divine–astral fish",
      theme: "astral"
    },
    absolute: {
      id: "absolute",
      name: "Absolute Lucky Block",
      giftId: "__luckyblock__",
      item: "luckyblock",
      stateKey: "luckyBlockCount",
      minRarity: "singularity",
      maxRarity: "absolute",
      rangeLabel: "singularity–absolute fish",
      theme: "absolute"
    },
    zenith: {
      id: "zenith",
      name: "Zenith Lucky Block",
      giftId: "__luckyblock_zenith__",
      item: "luckyblock-zenith",
      stateKey: "zenithLuckyBlockCount",
      minRarity: "transcendent",
      maxRarity: "zenith",
      rangeLabel: "transcendent–zenith fish",
      theme: "zenith"
    }
  };

  function luckyBlockDef(type) {
    return LUCKY_BLOCK_TYPES[type] || LUCKY_BLOCK_TYPES.absolute;
  }

  function luckyBlockRarities(type) {
    const def = luckyBlockDef(type);
    const lo = RARITY_RANK[def.minRarity] || 0;
    const hi = RARITY_RANK[def.maxRarity] || 0;
    return RARITIES.filter((r) => {
      const rank = RARITY_RANK[r] || 0;
      return rank >= lo && rank <= hi;
    });
  }

  function resolveLuckyBlockType(raw) {
    const s = String(raw || "")
      .toLowerCase()
      .replace(/[\s_-]+/g, "");
    if (!s) return "absolute";
    if (s.includes("zenith")) return "zenith";
    if (s.includes("astral")) return "astral";
    if (s.includes("absolute") || s === "luckyblock" || s === "block") return "absolute";
    return null;
  }

  function luckyBlockTypeFromGift(g) {
    const item = String(g?.item || "").toLowerCase();
    const fishId = String(g?.fishId || "").toLowerCase();
    if (
      item === "luckyblock-zenith" ||
      fishId === "__luckyblock_zenith__" ||
      fishId === "luckyblock-zenith" ||
      fishId === "zenithluckyblock" ||
      fishId === "zenith"
    ) {
      return "zenith";
    }
    if (
      item === "luckyblock-astral" ||
      fishId === "__luckyblock_astral__" ||
      fishId === "luckyblock-astral" ||
      fishId === "astralluckyblock" ||
      fishId === "astral"
    ) {
      return "astral";
    }
    if (
      item === "luckyblock" ||
      item === "luckyblock-absolute" ||
      fishId === "__luckyblock__" ||
      fishId === "luckyblock" ||
      fishId === "absoluteluckyblock" ||
      fishId === "absolute"
    ) {
      return "absolute";
    }
    return null;
  }

  const CHEST_GIFT_TYPES = {
    money: {
      kind: "money",
      name: "Coin Chest",
      giftId: "__chest_money__",
      item: "chest-money"
    },
    luck: {
      kind: "luck",
      name: "Luck Chest",
      giftId: "__chest_luck__",
      item: "chest-luck"
    }
  };

  function resolveChestGiftKind(raw) {
    const s = String(raw || "")
      .toLowerCase()
      .replace(/[^a-z]/g, "");
    if (!s) return null;
    if (s === "luck" || s === "lucky" || s === "luckchest") return "luck";
    if (s === "money" || s === "coin" || s === "coins" || s === "sell" || s === "coinchest" || s === "moneychest") {
      return "money";
    }
    return null;
  }

  function chestGiftDef(kind) {
    return CHEST_GIFT_TYPES[kind === "luck" ? "luck" : "money"] || CHEST_GIFT_TYPES.money;
  }

  function chestKindFromGift(g) {
    const item = String(g?.item || "").toLowerCase();
    const fishId = String(g?.fishId || "").toLowerCase();
    if (
      item === "chest-luck" ||
      item === "luck-chest" ||
      fishId === "__chest_luck__" ||
      fishId === "luck_chest" ||
      fishId === "luckchest"
    ) {
      return "luck";
    }
    if (
      item === "chest-money" ||
      item === "money-chest" ||
      item === "coin-chest" ||
      fishId === "__chest_money__" ||
      fishId === "coin_chest" ||
      fishId === "moneychest" ||
      fishId === "coinchest"
    ) {
      return "money";
    }
    return null;
  }

  const FISH = [
    // Common
    { id: "minnow", name: "Minnow", rarity: "common", value: 3 },
    { id: "perch", name: "Perch", rarity: "common", value: 5 },
    { id: "bluegill", name: "Bluegill", rarity: "common", value: 6 },
    { id: "sardine", name: "Sardine", rarity: "common", value: 4 },
    { id: "carp", name: "Carp", rarity: "common", value: 7 },
    { id: "roach", name: "Roach", rarity: "common", value: 4 },
    // Uncommon
    { id: "trout", name: "Trout", rarity: "uncommon", value: 14 },
    { id: "bass", name: "Bass", rarity: "uncommon", value: 18 },
    { id: "catfish", name: "Catfish", rarity: "uncommon", value: 22 },
    { id: "snapper", name: "Snapper", rarity: "uncommon", value: 24 },
    { id: "cod", name: "Cod", rarity: "uncommon", value: 19 },
    { id: "flounder", name: "Flounder", rarity: "uncommon", value: 21 },
    // Rare
    { id: "salmon", name: "Salmon", rarity: "rare", value: 45 },
    { id: "pike", name: "Pike", rarity: "rare", value: 55 },
    { id: "mahi", name: "Mahi-Mahi", rarity: "rare", value: 60 },
    { id: "grouper", name: "Grouper", rarity: "rare", value: 70 },
    { id: "barracuda", name: "Barracuda", rarity: "rare", value: 65 },
    { id: "sturgeon", name: "Sturgeon", rarity: "rare", value: 80 },
    // Epic
    { id: "tuna", name: "Tuna", rarity: "epic", value: 120 },
    { id: "marlin", name: "Marlin", rarity: "epic", value: 180 },
    { id: "swordfish", name: "Swordfish", rarity: "epic", value: 200 },
    { id: "shark", name: "Reef Shark", rarity: "epic", value: 240 },
    { id: "ray", name: "Manta Ray", rarity: "epic", value: 220 },
    { id: "octopus", name: "Giant Octopus", rarity: "epic", value: 260 },
    // Legendary
    { id: "golden", name: "Golden Koi", rarity: "legendary", value: 500 },
    { id: "leviathan", name: "Leviathan Fry", rarity: "legendary", value: 900 },
    { id: "moonfish", name: "Moonfish", rarity: "legendary", value: 650 },
    { id: "dragonet", name: "Sea Dragonet", rarity: "legendary", value: 780 },
    { id: "crystal", name: "Crystal Pike", rarity: "legendary", value: 850 },
    // Mythic
    { id: "tidelord", name: "Tide Lord", rarity: "mythic", value: 2500 },
    { id: "abyssking", name: "Abyss King", rarity: "mythic", value: 4000 },
    { id: "starwhale", name: "Star Whale", rarity: "mythic", value: 6000 },
    { id: "worldfin", name: "Worldfin", rarity: "mythic", value: 9000 },
    // Secret
    { id: "ghostfin", name: "Ghostfin", rarity: "secret", value: 25000 },
    { id: "nullfish", name: "Nullfish", rarity: "secret", value: 50000 },
    { id: "eclipse", name: "Eclipse Eel", rarity: "secret", value: 80000 },
    { id: "forgotten", name: "The Forgotten", rarity: "secret", value: 120000 },
    // Divine
    { id: "seraph", name: "Seraph Ray", rarity: "divine", value: 250000 },
    { id: "halo", name: "Halo Carp", rarity: "divine", value: 400000 },
    { id: "oracle", name: "Oracle Koi", rarity: "divine", value: 650000 },
    { id: "choirfin", name: "Choirfin", rarity: "divine", value: 900000 },
    // Eternal
    { id: "timeless", name: "Timeless Trout", rarity: "eternal", value: 1500000 },
    { id: "foreverfin", name: "Foreverfin", rarity: "eternal", value: 2800000 },
    { id: "aeon", name: "Aeon Shark", rarity: "eternal", value: 4500000 },
    { id: "epochray", name: "Epoch Ray", rarity: "eternal", value: 7500000 },
    // Cosmic
    { id: "nebula", name: "Nebula Nettle", rarity: "cosmic", value: 12000000 },
    { id: "quasar", name: "Quasar Cod", rarity: "cosmic", value: 25000000 },
    { id: "omnifin", name: "Omnifin", rarity: "cosmic", value: 50000000 },
    { id: "pulsarpike", name: "Pulsar Pike", rarity: "cosmic", value: 85000000 },
    // Astral
    { id: "stardrift", name: "Stardrift Ray", rarity: "astral", value: 120000000 },
    { id: "aurorafin", name: "Aurora Fin", rarity: "astral", value: 250000000 },
    { id: "galaxykoi", name: "Galaxy Koi", rarity: "astral", value: 500000000 },
    { id: "cometcarp", name: "Comet Carp", rarity: "astral", value: 850000000 },
    // Singularity
    { id: "eventide", name: "Eventide Eel", rarity: "singularity", value: 1200000000 },
    { id: "horizon", name: "Horizon Shark", rarity: "singularity", value: 2500000000 },
    { id: "collapse", name: "Collapse Carp", rarity: "singularity", value: 5000000000 },
    { id: "riftray", name: "Rift Ray", rarity: "singularity", value: 9000000000 },
    // Omega
    { id: "primefin", name: "Primefin", rarity: "omega", value: 15000000000 },
    { id: "absoluth", name: "Absoluth", rarity: "omega", value: 40000000000 },
    { id: "theend", name: "The End Fish", rarity: "omega", value: 100000000000 },
    { id: "ultimafin", name: "Ultimafin", rarity: "omega", value: 180000000000 },
    // Genesis
    { id: "originkoi", name: "Origin Koi", rarity: "genesis", value: 250000000000 },
    { id: "dawnlevi", name: "Dawn Leviathan", rarity: "genesis", value: 600000000000 },
    { id: "firstfin", name: "First Fin", rarity: "genesis", value: 1500000000000 },
    { id: "sparkfin", name: "Sparkfin", rarity: "genesis", value: 2800000000000 },
    // Paradox
    { id: "twinparadox", name: "Twin Paradox", rarity: "paradox", value: 4000000000000 },
    { id: "mirrorshark", name: "Mirror Shark", rarity: "paradox", value: 10000000000000 },
    { id: "loopeel", name: "Loop Eel", rarity: "paradox", value: 25000000000000 },
    { id: "mobiusmarlin", name: "Mobius Marlin", rarity: "paradox", value: 45000000000000 },
    // Infinity
    { id: "endlessray", name: "Endless Ray", rarity: "infinity", value: 80000000000000 },
    { id: "boundcod", name: "Boundless Cod", rarity: "infinity", value: 200000000000000 },
    { id: "foreverend", name: "Forever End", rarity: "infinity", value: 500000000000000 },
    { id: "perpetualpike", name: "Perpetual Pike", rarity: "infinity", value: 900000000000000 },
    // Absolute
    { id: "absolutefin", name: "Absolute Fin", rarity: "absolute", value: 1500000000000000 },
    { id: "finalabs", name: "Final Absolute", rarity: "absolute", value: 4000000000000000 },
    { id: "trueabs", name: "True Absolute", rarity: "absolute", value: 7000000000000000 },
    { id: "theabsolute", name: "The Absolute", rarity: "absolute", value: 10000000000000000 },
    // Transcendent (fishing only — not in lucky blocks)
    { id: "ascendray", name: "Ascend Ray", rarity: "transcendent", value: 2.5e16 },
    { id: "overfin", name: "Overfin", rarity: "transcendent", value: 6e16 },
    { id: "beyondkoi", name: "Beyond Koi", rarity: "transcendent", value: 1.2e17 },
    { id: "transcendfin", name: "Transcendfin", rarity: "transcendent", value: 2.5e17 },
    // Nexus
    { id: "crossfin", name: "Crossfin", rarity: "nexus", value: 5e17 },
    { id: "linkshark", name: "Link Shark", rarity: "nexus", value: 1.2e18 },
    { id: "hubray", name: "Hub Ray", rarity: "nexus", value: 3e18 },
    { id: "nexuskarp", name: "Nexus Karp", rarity: "nexus", value: 7e18 },
    // Voidborn
    { id: "nullray", name: "Null Ray", rarity: "voidborn", value: 1.5e19 },
    { id: "hollowfin", name: "Hollowfin", rarity: "voidborn", value: 4e19 },
    { id: "abyssnull", name: "Abyss Null", rarity: "voidborn", value: 9e19 },
    { id: "thevoidborn", name: "The Voidborn", rarity: "voidborn", value: 2e20 },
    // Zenith
    { id: "peakfin", name: "Peakfin", rarity: "zenith", value: 5e20 },
    { id: "crownray", name: "Crown Ray", rarity: "zenith", value: 1.2e21 },
    { id: "apexkoi", name: "Apex Koi", rarity: "zenith", value: 3e21 },
    { id: "spirefin", name: "Spirefin", rarity: "zenith", value: 4.8e21 },
    { id: "solsticeray", name: "Solstice Ray", rarity: "zenith", value: 6.2e21 },
    { id: "thezenith", name: "The Zenith", rarity: "zenith", value: 8e21 },
    // Crown
    { id: "diademfin", name: "Diadem Fin", rarity: "crown", value: 1.5e22 },
    { id: "royalkoi", name: "Royal Koi", rarity: "crown", value: 4e22 },
    { id: "coronet", name: "Coronet Ray", rarity: "crown", value: 9e22 },
    { id: "thecrown", name: "The Crown", rarity: "crown", value: 2e23 },
    // Origin
    { id: "dawnorigin", name: "Dawn Origin", rarity: "origin", value: 5e23 },
    { id: "sourcefin", name: "Sourcefin", rarity: "origin", value: 1.2e24 },
    { id: "firsttide", name: "First Tide", rarity: "origin", value: 3e24 },
    { id: "theorigin", name: "The Origin", rarity: "origin", value: 7e24 },
    // Aether
    { id: "skyfin", name: "Skyfin", rarity: "aether", value: 1.5e25 },
    { id: "aetherray", name: "Aether Ray", rarity: "aether", value: 4e25 },
    { id: "cloudmarlin", name: "Cloud Marlin", rarity: "aether", value: 9e25 },
    { id: "theaether", name: "The Aether", rarity: "aether", value: 2e26 },
    // Radiant
    { id: "gleamray", name: "Gleam Ray", rarity: "radiant", value: 5e26 },
    { id: "sunfin", name: "Sunfin", rarity: "radiant", value: 1.2e27 },
    { id: "blazeel", name: "Blaze Eel", rarity: "radiant", value: 3e27 },
    { id: "theradiant", name: "The Radiant", rarity: "radiant", value: 7e27 },
    // Dusk
    { id: "duskfin", name: "Duskfin", rarity: "dusk", value: 1.5e28 },
    { id: "twilightshark", name: "Twilight Shark", rarity: "dusk", value: 4e28 },
    { id: "umbrakoi", name: "Umbra Koi", rarity: "dusk", value: 9e28 },
    { id: "thedusk", name: "The Dusk", rarity: "dusk", value: 2e29 },
    // Apex
    { id: "summitfin", name: "Summitfin", rarity: "apex", value: 5e29 },
    { id: "pinnacleray", name: "Pinnacle Ray", rarity: "apex", value: 1.2e30 },
    { id: "crestkoi", name: "Crest Koi", rarity: "apex", value: 3e30 },
    { id: "theapex", name: "The Apex", rarity: "apex", value: 8e30 },
    // Sovereign
    { id: "thronefin", name: "Thronefin", rarity: "sovereign", value: 2e31 },
    { id: "regalray", name: "Regal Ray", rarity: "sovereign", value: 5e31 },
    { id: "dominionkoi", name: "Dominion Koi", rarity: "sovereign", value: 1.2e32 },
    { id: "thesovereign", name: "The Sovereign", rarity: "sovereign", value: 3e32 },
    // Celestial
    { id: "starvault", name: "Star Vault", rarity: "celestial", value: 7e32 },
    { id: "heavenray", name: "Heaven Ray", rarity: "celestial", value: 1.8e33 },
    { id: "orbitfin", name: "Orbitfin", rarity: "celestial", value: 4.5e33 },
    { id: "thecelestial", name: "The Celestial", rarity: "celestial", value: 1.1e34 },
    // Primordial
    { id: "ancientfin", name: "Ancient Fin", rarity: "primordial", value: 2.8e34 },
    { id: "rootide", name: "Root Tide", rarity: "primordial", value: 7e34 },
    { id: "primalkoi", name: "Primal Koi", rarity: "primordial", value: 1.8e35 },
    { id: "theprimordial", name: "The Primordial", rarity: "primordial", value: 4.5e35 },
    // Ultimate
    { id: "finalfin", name: "Final Fin", rarity: "ultimate", value: 1.1e36 },
    { id: "omniray", name: "Omni Ray", rarity: "ultimate", value: 2.8e36 },
    { id: "lasttide", name: "Last Tide", rarity: "ultimate", value: 7e36 },
    { id: "theultimate", name: "The Ultimate", rarity: "ultimate", value: 1.8e37 },
    // Exclusive — never in weighted pool; rolled separately at 1/10M (luck ignored)
    {
      id: "soultwin",
      name: "Soul Twin",
      rarity: "exclusive",
      value: 1,
      exclusive: true,
      unsellable: true,
      untradeable: true
    }
  ];

  const SPOTS = [
    {
      id: "creek",
      name: "Creek",
      cost: 0,
      wait: [1.4, 2.8],
      valueMult: 0.65,
      rarity: 0,
      blurb: "All fish · commons dominate · low pay"
    },
    {
      id: "pond",
      name: "Pond",
      cost: 120,
      wait: [1.3, 2.6],
      valueMult: 0.8,
      rarity: 1,
      blurb: "All fish · slightly better odds"
    },
    {
      id: "marsh",
      name: "Marsh",
      cost: 400,
      wait: [1.25, 2.5],
      valueMult: 0.9,
      rarity: 2,
      blurb: "Murky water · a bit more uncommon"
    },
    {
      id: "river",
      name: "River",
      cost: 800,
      wait: [1.2, 2.4],
      valueMult: 1.0,
      rarity: 3,
      blurb: "All fish · uncommon/rare more often"
    },
    {
      id: "falls",
      name: "Waterfall",
      cost: 2200,
      wait: [1.15, 2.3],
      valueMult: 1.1,
      rarity: 4,
      blurb: "Fast current · rares start showing"
    },
    {
      id: "lake",
      name: "Lake",
      cost: 4500,
      wait: [1.1, 2.2],
      valueMult: 1.2,
      rarity: 5,
      blurb: "All fish · solid rare/epic odds"
    },
    {
      id: "reef",
      name: "Coral Reef",
      cost: 12000,
      wait: [1.05, 2.1],
      valueMult: 1.35,
      rarity: 6,
      blurb: "Bright waters · epics more likely"
    },
    {
      id: "harbor",
      name: "Harbor",
      cost: 25000,
      wait: [1.0, 2.0],
      valueMult: 1.5,
      rarity: 7,
      blurb: "All fish · top rarities slightly less rare"
    },
    {
      id: "glacier",
      name: "Glacier Bay",
      cost: 70000,
      wait: [0.95, 1.9],
      valueMult: 1.7,
      rarity: 8,
      blurb: "Icy depth · legendaries thaw more often"
    },
    {
      id: "deep",
      name: "Deep Sea",
      cost: 150000,
      wait: [0.9, 1.8],
      valueMult: 1.95,
      rarity: 9,
      blurb: "All fish · strong mythic odds"
    },
    {
      id: "trench",
      name: "Abyssal Trench",
      cost: 400000,
      wait: [0.85, 1.7],
      valueMult: 2.2,
      rarity: 10,
      blurb: "Crushing dark · mythics & secrets stir"
    },
    {
      id: "rift",
      name: "Tide Rift",
      cost: 1200000,
      wait: [0.8, 1.55],
      valueMult: 2.5,
      rarity: 11,
      blurb: "Warped tides · secrets less impossible"
    },
    {
      id: "void",
      name: "Void Lagoon",
      cost: 4000000,
      wait: [0.75, 1.4],
      valueMult: 2.9,
      rarity: 12,
      blurb: "Secrets stir · divine just possible"
    },
    {
      id: "celestial",
      name: "Celestial Pier",
      cost: 15000000,
      wait: [0.7, 1.3],
      valueMult: 3.4,
      rarity: 13,
      blurb: "Holy waters · divine & eternal odds"
    },
    {
      id: "aeonbasin",
      name: "Aeon Basin",
      cost: 50000000,
      wait: [0.65, 1.2],
      valueMult: 4.0,
      rarity: 14,
      blurb: "Time thins · eternals swim here"
    },
    {
      id: "cosmos",
      name: "Cosmic Rift",
      cost: 200000000,
      wait: [0.6, 1.1],
      valueMult: 4.8,
      rarity: 15,
      blurb: "Edge of everything · cosmic possible"
    },
    {
      id: "astralshoals",
      name: "Astral Shoals",
      cost: 800000000,
      wait: [0.55, 1.05],
      valueMult: 5.8,
      rarity: 16,
      blurb: "Starlit shallows · astral fish appear"
    },
    {
      id: "eventhorizon",
      name: "Event Horizon",
      cost: 4000000000,
      wait: [0.5, 1.0],
      valueMult: 7.0,
      rarity: 17,
      blurb: "Light bends · singularity catches stir"
    },
    {
      id: "omegadeep",
      name: "Omega Deep",
      cost: 20000000000,
      wait: [0.45, 0.95],
      valueMult: 8.5,
      rarity: 18,
      blurb: "Bright abyss · omega possible"
    },
    {
      id: "prismreef",
      name: "Prism Reef",
      cost: 80000000000,
      wait: [0.42, 0.9],
      valueMult: 10,
      rarity: 19,
      blurb: "Fractured light · omega more often"
    },
    {
      id: "chronowell",
      name: "Chrono Well",
      cost: 350000000000,
      wait: [0.4, 0.85],
      valueMult: 12,
      rarity: 20,
      blurb: "Time pools · rarest fish linger"
    },
    {
      id: "mythforge",
      name: "Mythforge Basin",
      cost: 1.5e12,
      wait: [0.38, 0.8],
      valueMult: 14,
      rarity: 21,
      blurb: "Molten legend · endgame pays hard"
    },
    {
      id: "genesispool",
      name: "Genesis Pool",
      cost: 7e12,
      wait: [0.35, 0.75],
      valueMult: 17,
      rarity: 22,
      blurb: "First waters · genesis fish stir"
    },
    {
      id: "absolution",
      name: "Absolution Sea",
      cost: 3e13,
      wait: [0.32, 0.7],
      valueMult: 20,
      rarity: 23,
      blurb: "Beyond omega · absolute shores await"
    },
    {
      id: "singularitymere",
      name: "Singularity Mere",
      cost: 1.2e14,
      wait: [0.3, 0.65],
      valueMult: 24,
      rarity: 24,
      blurb: "Collapsed tides · singularity fish pull"
    },
    {
      id: "paradoxbay",
      name: "Paradox Bay",
      cost: 5e14,
      wait: [0.28, 0.6],
      valueMult: 28,
      rarity: 25,
      blurb: "Two futures · paradox hauls pay"
    },
    {
      id: "infinityreach",
      name: "Infinity Reach",
      cost: 2.2e15,
      wait: [0.26, 0.55],
      valueMult: 33,
      rarity: 26,
      blurb: "Endless shelf · infinity rarities rise"
    },
    {
      id: "omnisea",
      name: "Omni Sea",
      cost: 1e16,
      wait: [0.24, 0.5],
      valueMult: 40,
      rarity: 27,
      blurb: "All waters as one · absolute peak"
    },
    {
      id: "transcendfalls",
      name: "Transcend Falls",
      cost: 5e16,
      wait: [0.22, 0.48],
      valueMult: 48,
      rarity: 28,
      blurb: "Above absolute · transcendent stirs"
    },
    {
      id: "nexusdeep",
      name: "Nexus Deep",
      cost: 2.5e17,
      wait: [0.2, 0.45],
      valueMult: 58,
      rarity: 29,
      blurb: "Linked tides · nexus fish converge"
    },
    {
      id: "voidbornmere",
      name: "Voidborn Mere",
      cost: 1.2e18,
      wait: [0.18, 0.42],
      valueMult: 70,
      rarity: 30,
      blurb: "Hollow waters · voidborn haunt"
    },
    {
      id: "zenithpeak",
      name: "Zenith Peak",
      cost: 6e18,
      wait: [0.16, 0.4],
      valueMult: 85,
      rarity: 31,
      blurb: "Highest shelf · zenith fish crown the haul"
    },
    {
      id: "primordialshoals",
      name: "Primordial Shoals",
      cost: 3e19,
      wait: [0.15, 0.38],
      valueMult: 100,
      rarity: 32,
      blurb: "First seas remade · primordial pressure"
    },
    {
      id: "sovereignreach",
      name: "Sovereign Reach",
      cost: 1.5e20,
      wait: [0.14, 0.36],
      valueMult: 120,
      rarity: 33,
      blurb: "Ruled tides · sovereign catches command"
    },
    {
      id: "mythosbasin",
      name: "Mythos Basin",
      cost: 8e20,
      wait: [0.13, 0.34],
      valueMult: 145,
      rarity: 34,
      blurb: "Legend pools · mythos fish rewrite odds"
    },
    {
      id: "finalitymere",
      name: "Finality Mere",
      cost: 4e21,
      wait: [0.12, 0.32],
      valueMult: 175,
      rarity: 35,
      blurb: "Last shallows · finality hauls end runs"
    },
    {
      id: "crownreef",
      name: "Crown Reef",
      cost: 2e22,
      wait: [0.11, 0.3],
      valueMult: 210,
      rarity: 36,
      blurb: "Royal coral · crowned rarities glitter"
    },
    {
      id: "originend",
      name: "Origin End",
      cost: 1e23,
      wait: [0.1, 0.28],
      valueMult: 250,
      rarity: 37,
      blurb: "Where waters began · and endgame pays"
    },
    {
      id: "aetherlagoon",
      name: "Aether Lagoon",
      cost: 5e23,
      wait: [0.095, 0.27],
      valueMult: 300,
      rarity: 38,
      blurb: "Sky-fed waters · aether pressure rises"
    },
    {
      id: "eclipsegulf",
      name: "Eclipse Gulf",
      cost: 2.5e24,
      wait: [0.09, 0.26],
      valueMult: 360,
      rarity: 39,
      blurb: "Shadowed basin · eclipsed hauls pay"
    },
    {
      id: "radiantshoals",
      name: "Radiant Shoals",
      cost: 1.2e25,
      wait: [0.085, 0.25],
      valueMult: 430,
      rarity: 40,
      blurb: "Blinding flats · radiant odds climb"
    },
    {
      id: "eternalocean",
      name: "Eternal Ocean",
      cost: 6e25,
      wait: [0.08, 0.24],
      valueMult: 520,
      rarity: 41,
      blurb: "Undying seas · eternity in every cast"
    },
    {
      id: "duskhorizon",
      name: "Dusk Horizon",
      cost: 3e26,
      wait: [0.075, 0.23],
      valueMult: 620,
      rarity: 42,
      blurb: "Last light · dusk rarities linger"
    },
    {
      id: "apexorigin",
      name: "Apex Origin",
      cost: 1.5e27,
      wait: [0.07, 0.22],
      valueMult: 750,
      rarity: 43,
      blurb: "Above the beginning · apex endgame"
    },
    {
      id: "novareach",
      name: "Nova Reach",
      cost: 7e27,
      wait: [0.065, 0.21],
      valueMult: 900,
      rarity: 44,
      blurb: "Star-burst shelf · nova hauls flare"
    },
    {
      id: "starborne",
      name: "Starborne Shelf",
      cost: 3.5e28,
      wait: [0.06, 0.2],
      valueMult: 1100,
      rarity: 45,
      blurb: "Born of stars · starborne odds climb"
    },
    {
      id: "veilmere",
      name: "Veil Mere",
      cost: 1.8e29,
      wait: [0.055, 0.19],
      valueMult: 1350,
      rarity: 46,
      blurb: "Thin veil · rarities slip through"
    },
    {
      id: "crownvoid",
      name: "Crown Void",
      cost: 9e29,
      wait: [0.05, 0.18],
      valueMult: 1650,
      rarity: 47,
      blurb: "Hollow crown · regal emptiness pays"
    },
    {
      id: "liminalsea",
      name: "Liminal Sea",
      cost: 4.5e30,
      wait: [0.045, 0.17],
      valueMult: 2000,
      rarity: 48,
      blurb: "Between worlds · liminal catches linger"
    },
    {
      id: "beyondapex",
      name: "Beyond Apex",
      cost: 2.2e31,
      wait: [0.04, 0.16],
      valueMult: 2500,
      rarity: 49,
      blurb: "Past the peak · beyond apex endgame"
    },
    {
      id: "continuumrift",
      name: "Continuum Rift",
      cost: 1.1e32,
      wait: [0.038, 0.15],
      valueMult: 3000,
      rarity: 50,
      blurb: "Fractured time · continuum hauls pull"
    },
    {
      id: "miragebay",
      name: "Mirage Bay",
      cost: 5.5e32,
      wait: [0.036, 0.145],
      valueMult: 3600,
      rarity: 51,
      blurb: "False shores · mirage odds shimmer"
    },
    {
      id: "catalystpool",
      name: "Catalyst Pool",
      cost: 2.8e33,
      wait: [0.034, 0.14],
      valueMult: 4400,
      rarity: 52,
      blurb: "Reactive depths · catalyst catches spark"
    },
    {
      id: "oblivionmere",
      name: "Oblivion Mere",
      cost: 1.4e34,
      wait: [0.032, 0.135],
      valueMult: 5400,
      rarity: 53,
      blurb: "Forgotten waters · oblivion pays hard"
    },
    {
      id: "empyreanshelf",
      name: "Empyrean Shelf",
      cost: 7e34,
      wait: [0.03, 0.13],
      valueMult: 6600,
      rarity: 54,
      blurb: "Heavenly ledge · empyrean rarities rise"
    },
    {
      id: "finalhorizon",
      name: "Final Horizon",
      cost: 3.5e35,
      wait: [0.028, 0.125],
      valueMult: 8000,
      rarity: 55,
      blurb: "Edge of everything · final horizon endgame"
    },
    {
      id: "auroraabyss",
      name: "Aurora Abyss",
      cost: 1.8e36,
      wait: [0.026, 0.12],
      valueMult: 9800,
      rarity: 56,
      blurb: "Northern glow · aurora hauls shimmer"
    },
    {
      id: "fractalreef",
      name: "Fractal Reef",
      cost: 9e36,
      wait: [0.025, 0.115],
      valueMult: 12000,
      rarity: 57,
      blurb: "Self-similar coral · fractal odds bloom"
    },
    {
      id: "dominionbay",
      name: "Dominion Bay",
      cost: 4.5e37,
      wait: [0.024, 0.11],
      valueMult: 14500,
      rarity: 58,
      blurb: "Ruled inlet · dominion catches command"
    },
    {
      id: "spectralmere",
      name: "Spectral Mere",
      cost: 2.2e38,
      wait: [0.022, 0.105],
      valueMult: 17500,
      rarity: 59,
      blurb: "Ghost shallows · spectral fish whisper"
    },
    {
      id: "titanreach",
      name: "Titan Reach",
      cost: 1.1e39,
      wait: [0.021, 0.1],
      valueMult: 21000,
      rarity: 60,
      blurb: "Colossal shelf · titan hauls shake the dock"
    },
    {
      id: "dreamshoals",
      name: "Dream Shoals",
      cost: 5.5e39,
      wait: [0.02, 0.095],
      valueMult: 25500,
      rarity: 61,
      blurb: "Sleeping flats · dream rarities drift"
    },
    {
      id: "pantheonfalls",
      name: "Pantheon Falls",
      cost: 2.8e40,
      wait: [0.018, 0.09],
      valueMult: 31000,
      rarity: 62,
      blurb: "God-carved cascade · pantheon pressure"
    },
    {
      id: "astralcrown",
      name: "Astral Crown",
      cost: 1.4e41,
      wait: [0.017, 0.085],
      valueMult: 38000,
      rarity: 63,
      blurb: "Star-diadem waters · crowned astrals rise"
    },
    {
      id: "eternalgate",
      name: "Eternal Gate",
      cost: 7e41,
      wait: [0.016, 0.08],
      valueMult: 46000,
      rarity: 64,
      blurb: "Doorway tides · eternity waits beyond"
    },
    {
      id: "omegaorigin",
      name: "Omega Origin",
      cost: 3.5e42,
      wait: [0.015, 0.075],
      valueMult: 56000,
      rarity: 65,
      blurb: "Where omega began · peak endgame shelf"
    }
  ];

  const MAX_SPOT_RARITY = 65;

  const GEAR = [
    { id: "rod1", name: "Willow Rod", desc: "+0.05s bite window", cost: 40, kind: "window", amount: 0.05 },
    { id: "rod2", name: "Oak Rod", desc: "+0.08s bite window", cost: 180, kind: "window", amount: 0.08 },
    { id: "rod3", name: "Carbon Rod", desc: "+0.12s bite window", cost: 900, kind: "window", amount: 0.12 },
    { id: "rod4", name: "Pro Rod", desc: "+0.15s bite window", cost: 4500, kind: "window", amount: 0.15 },
    { id: "rod5", name: "Myth Rod", desc: "+0.2s bite window", cost: 22000, kind: "window", amount: 0.2 },
    { id: "rod6", name: "Abyss Rod", desc: "+0.25s bite window", cost: 90000, kind: "window", amount: 0.25 },
    { id: "rod7", name: "Void Rod", desc: "+0.3s bite window", cost: 350000, kind: "window", amount: 0.3 },
    { id: "rod8", name: "Cosmic Rod", desc: "+0.35s bite window", cost: 1500000, kind: "window", amount: 0.35 },
    { id: "rod9", name: "Nebula Rod", desc: "+0.12s bite window", cost: 8000000, kind: "window", amount: 0.12 },
    { id: "rod10", name: "Omega Rod", desc: "+0.15s bite window", cost: 45000000, kind: "window", amount: 0.15 },
    { id: "rod11", name: "Aurora Rod", desc: "+0.1s bite window", cost: 90000000, kind: "window", amount: 0.1 },
    { id: "rod12", name: "Apex Rod", desc: "+0.12s bite window", cost: 280000000, kind: "window", amount: 0.12 },
    { id: "rod13", name: "Mirror Rod", desc: "+0.1s bite window", cost: 500000000, kind: "window", amount: 0.1 },
    { id: "rod14", name: "Zenith Rod", desc: "+0.1s bite window", cost: 900000000, kind: "window", amount: 0.1 },
    { id: "rod15", name: "Drift Rod", desc: "+0.08s bite window", cost: 1600000000, kind: "window", amount: 0.08 },
    { id: "rod16", name: "Tidebone Rod", desc: "+0.1s bite window", cost: 2800000000, kind: "window", amount: 0.1 },
    { id: "rod17", name: "Solstice Rod", desc: "+0.1s bite window", cost: 4500000000, kind: "window", amount: 0.1 },
    { id: "rod18", name: "Helix Rod", desc: "+0.12s bite window", cost: 7000000000, kind: "window", amount: 0.12 },
    { id: "rod19", name: "Prism Rod", desc: "+0.14s bite window", cost: 18000000000, kind: "window", amount: 0.14 },
    { id: "rod20", name: "Chrono Rod", desc: "+0.15s bite window", cost: 45000000000, kind: "window", amount: 0.15 },
    { id: "rod21", name: "Mythforge Rod", desc: "+0.16s bite window", cost: 120000000000, kind: "window", amount: 0.16 },
    { id: "rod22", name: "Genesis Rod", desc: "+0.18s bite window", cost: 400000000000, kind: "window", amount: 0.18 },
    { id: "rod23", name: "Absolution Rod", desc: "+0.2s bite window", cost: 1.5e12, kind: "window", amount: 0.2 },
    { id: "rod24", name: "Singularity Rod", desc: "+0.22s bite window", cost: 8e12, kind: "window", amount: 0.22 },
    { id: "rod25", name: "Paradox Rod", desc: "+0.24s bite window", cost: 4e13, kind: "window", amount: 0.24 },
    { id: "rod26", name: "Infinity Rod", desc: "+0.26s bite window", cost: 2e14, kind: "window", amount: 0.26 },
    { id: "rod27", name: "Absolute Rod", desc: "+0.28s bite window", cost: 1e15, kind: "window", amount: 0.28 },
    { id: "rod28", name: "Omni Rod", desc: "+0.3s bite window", cost: 5e15, kind: "window", amount: 0.3 },
    { id: "rod29", name: "Transcend Rod", desc: "+0.32s bite window", cost: 2.5e16, kind: "window", amount: 0.32 },
    { id: "rod30", name: "Nexus Rod", desc: "+0.34s bite window", cost: 1.2e17, kind: "window", amount: 0.34 },
    { id: "rod31", name: "Voidborn Rod", desc: "+0.36s bite window", cost: 6e17, kind: "window", amount: 0.36 },
    { id: "rod32", name: "Zenith Rod Ultima", desc: "+0.4s bite window", cost: 3e18, kind: "window", amount: 0.4 },
    { id: "rod33", name: "Primordial Rod", desc: "+0.42s bite window", cost: 1.5e19, kind: "window", amount: 0.42 },
    { id: "rod34", name: "Sovereign Rod", desc: "+0.45s bite window", cost: 7.5e19, kind: "window", amount: 0.45 },
    { id: "rod35", name: "Mythos Rod", desc: "+0.48s bite window", cost: 4e20, kind: "window", amount: 0.48 },
    { id: "rod36", name: "Finality Rod", desc: "+0.52s bite window", cost: 2e21, kind: "window", amount: 0.52 },
    { id: "rod37", name: "Crown Rod", desc: "+0.55s bite window", cost: 1e22, kind: "window", amount: 0.55 },
    { id: "rod38", name: "Origin Rod", desc: "+0.58s bite window", cost: 5e22, kind: "window", amount: 0.58 },
    { id: "rod39", name: "Aether Rod", desc: "+0.62s bite window", cost: 2.5e23, kind: "window", amount: 0.62 },
    { id: "rod40", name: "Radiant Rod", desc: "+0.66s bite window", cost: 1.2e24, kind: "window", amount: 0.66 },
    { id: "rod41", name: "Dusk Rod", desc: "+0.7s bite window", cost: 6e24, kind: "window", amount: 0.7 },
    { id: "rod42", name: "Apex Rod Ultima", desc: "+0.74s bite window", cost: 3e25, kind: "window", amount: 0.74 },
    { id: "rod43", name: "Nova Rod", desc: "+0.78s bite window", cost: 1.5e26, kind: "window", amount: 0.78 },
    { id: "rod44", name: "Starborne Rod", desc: "+0.82s bite window", cost: 7.5e26, kind: "window", amount: 0.82 },
    { id: "rod45", name: "Veil Rod", desc: "+0.86s bite window", cost: 4e27, kind: "window", amount: 0.86 },
    { id: "rod46", name: "Mirage Rod", desc: "+0.9s bite window", cost: 2e28, kind: "window", amount: 0.9 },
    { id: "rod47", name: "Empyrean Rod", desc: "+0.94s bite window", cost: 1e29, kind: "window", amount: 0.94 },
    { id: "rod48", name: "Horizon Rod", desc: "+0.98s bite window", cost: 5e29, kind: "window", amount: 0.98 },
    { id: "rod49", name: "Aurora Rod", desc: "+1.02s bite window", cost: 2.5e30, kind: "window", amount: 1.02 },
    { id: "rod50", name: "Fractal Rod", desc: "+1.06s bite window", cost: 1.2e31, kind: "window", amount: 1.06 },
    { id: "rod51", name: "Dominion Rod", desc: "+1.1s bite window", cost: 6e31, kind: "window", amount: 1.1 },
    { id: "rod52", name: "Spectral Rod", desc: "+1.15s bite window", cost: 3e32, kind: "window", amount: 1.15 },
    { id: "rod53", name: "Omega Origin Rod", desc: "+1.2s bite window", cost: 1.5e33, kind: "window", amount: 1.2 },
    { id: "rod54", name: "Aurora Crown Rod", desc: "+1.25s bite window", cost: 7.5e33, kind: "window", amount: 1.25 },
    { id: "rod55", name: "Fractal Spire Rod", desc: "+1.3s bite window", cost: 3.8e34, kind: "window", amount: 1.3 },
    { id: "rod56", name: "Dominion Scepter Rod", desc: "+1.35s bite window", cost: 1.9e35, kind: "window", amount: 1.35 },
    { id: "rod57", name: "Spectral Veil Rod", desc: "+1.4s bite window", cost: 9.5e35, kind: "window", amount: 1.4 },
    { id: "rod58", name: "Titan Reach Rod", desc: "+1.45s bite window", cost: 4.8e36, kind: "window", amount: 1.45 },
    { id: "rod59", name: "Dreamweave Rod", desc: "+1.5s bite window", cost: 2.4e37, kind: "window", amount: 1.5 },
    { id: "rod60", name: "Pantheon Rod", desc: "+1.55s bite window", cost: 1.2e38, kind: "window", amount: 1.55 },
    { id: "rod61", name: "Astral Crown Rod", desc: "+1.6s bite window", cost: 6e38, kind: "window", amount: 1.6 },
    { id: "rod62", name: "Eternal Gate Rod", desc: "+1.65s bite window", cost: 3e39, kind: "window", amount: 1.65 },
    { id: "rod63", name: "True Omega Rod", desc: "+1.7s bite window", cost: 1.5e40, kind: "window", amount: 1.7 },
    { id: "rod64", name: "Sovereign Rod Ultima", desc: "+1.75s bite window", cost: 7.5e40, kind: "window", amount: 1.75 },
    { id: "rod65", name: "Celestial Reach Rod", desc: "+1.8s bite window", cost: 3.8e41, kind: "window", amount: 1.8 },
    { id: "rod66", name: "Primordial Spire Rod", desc: "+1.85s bite window", cost: 1.9e42, kind: "window", amount: 1.85 },
    { id: "rod67", name: "Mythos Gate Rod", desc: "+1.9s bite window", cost: 9.5e42, kind: "window", amount: 1.9 },
    { id: "rod68", name: "Continuum Rod", desc: "+1.95s bite window", cost: 4.8e43, kind: "window", amount: 1.95 },
    { id: "rod69", name: "Beyond Apex Rod", desc: "+2s bite window", cost: 2.4e44, kind: "window", amount: 2 },
    { id: "rod70", name: "Final Horizon Rod", desc: "+2.05s bite window", cost: 1.2e45, kind: "window", amount: 2.05 },
    { id: "rod71", name: "True Ultimate Rod", desc: "+2.1s bite window", cost: 6e45, kind: "window", amount: 2.1 },
    { id: "bait10", name: "Echo Chum", desc: "Faster bites (−6% wait)", cost: 30, kind: "speed", amount: 0.06 },
    { id: "bait11", name: "Zenith Bait", desc: "Faster bites (−7% wait)", cost: 40, kind: "speed", amount: 0.07 },
    { id: "bait8", name: "Void Roe", desc: "Faster bites (−8% wait)", cost: 50, kind: "speed", amount: 0.08 },
    { id: "bait9", name: "Omega Bait", desc: "Faster bites (−10% wait)", cost: 80, kind: "speed", amount: 0.1 },
    { id: "bait1", name: "Worms", desc: "Faster bites (−12% wait)", cost: 150, kind: "speed", amount: 0.12 },
    { id: "bait2", name: "Crickets", desc: "Faster bites (−15% wait)", cost: 900, kind: "speed", amount: 0.15 },
    { id: "bait3", name: "Spinner", desc: "Faster bites (−18% wait)", cost: 5500, kind: "speed", amount: 0.18 },
    { id: "bait4", name: "Live Bait", desc: "Faster bites (−22% wait)", cost: 35000, kind: "speed", amount: 0.22 },
    { id: "bait5", name: "Glow Shrimp", desc: "Faster bites (−26% wait)", cost: 220000, kind: "speed", amount: 0.26 },
    { id: "bait6", name: "Plasma Flies", desc: "Faster bites (−30% wait)", cost: 1800000, kind: "speed", amount: 0.3 },
    { id: "bait7", name: "Starroe", desc: "Faster bites (−34% wait)", cost: 15000000, kind: "speed", amount: 0.34 },
    { id: "bait12", name: "Prism Chum", desc: "Faster bites (−36% wait)", cost: 80000000, kind: "speed", amount: 0.36 },
    { id: "bait13", name: "Chrono Flies", desc: "Faster bites (−38% wait)", cost: 400000000, kind: "speed", amount: 0.38 },
    { id: "bait14", name: "Genesis Roe", desc: "Faster bites (−40% wait)", cost: 2000000000, kind: "speed", amount: 0.4 },
    { id: "bait15", name: "Absolution Chum", desc: "Faster bites (−42% wait)", cost: 2e10, kind: "speed", amount: 0.42 },
    { id: "bait16", name: "Omni Bait", desc: "Faster bites (−44% wait)", cost: 2e11, kind: "speed", amount: 0.44 },
    { id: "bait17", name: "Paradox Chum", desc: "Faster bites (−48% wait)", cost: 2e12, kind: "speed", amount: 0.48 },
    { id: "bait18", name: "Infinity Roe", desc: "Faster bites (−52% wait)", cost: 2e13, kind: "speed", amount: 0.52 },
    { id: "bait19", name: "Absolute Flies", desc: "Faster bites (−56% wait)", cost: 2e14, kind: "speed", amount: 0.56 },
    { id: "bait20", name: "True Omni Bait", desc: "Faster bites (−60% wait)", cost: 2e15, kind: "speed", amount: 0.6 },
    { id: "bait21", name: "Transcend Chum", desc: "Faster bites (−66% wait)", cost: 1e16, kind: "speed", amount: 0.66 },
    { id: "bait22", name: "Nexus Roe", desc: "Faster bites (−72% wait)", cost: 5e16, kind: "speed", amount: 0.72 },
    { id: "bait23", name: "Voidborn Flies", desc: "Faster bites (−78% wait)", cost: 2.5e17, kind: "speed", amount: 0.78 },
    { id: "bait24", name: "Zenith Bait Ultima", desc: "Faster bites (−84% wait)", cost: 1.2e18, kind: "speed", amount: 0.84 },
    { id: "bait25", name: "Primordial Chum", desc: "Faster bites (−86% wait)", cost: 6e18, kind: "speed", amount: 0.86 },
    { id: "bait26", name: "Sovereign Roe", desc: "Faster bites (−88% wait)", cost: 3e19, kind: "speed", amount: 0.88 },
    { id: "bait27", name: "Mythos Flies", desc: "Faster bites (−89% wait)", cost: 1.5e20, kind: "speed", amount: 0.89 },
    { id: "bait28", name: "Finality Bait", desc: "Faster bites (−90% wait)", cost: 8e20, kind: "speed", amount: 0.9 },
    { id: "bait29", name: "Crown Chum", desc: "Faster bites (−91% wait)", cost: 4e21, kind: "speed", amount: 0.91 },
    { id: "bait30", name: "Origin Roe", desc: "Faster bites (−92% wait)", cost: 2e22, kind: "speed", amount: 0.92 },
    { id: "bait31", name: "Aether Flies", desc: "Faster bites (−93% wait)", cost: 1e23, kind: "speed", amount: 0.93 },
    { id: "bait32", name: "Radiant Bait", desc: "Faster bites (−94% wait)", cost: 5e23, kind: "speed", amount: 0.94 },
    { id: "bait33", name: "Dusk Chum", desc: "Faster bites (−95% wait)", cost: 2.5e24, kind: "speed", amount: 0.95 },
    { id: "bait34", name: "Apex Roe", desc: "Faster bites (−96% wait)", cost: 1.2e25, kind: "speed", amount: 0.96 },
    { id: "bait35", name: "Nova Flies", desc: "Faster bites (−96.5% wait)", cost: 6e25, kind: "speed", amount: 0.965 },
    { id: "bait36", name: "Starborne Bait", desc: "Faster bites (−97% wait)", cost: 3e26, kind: "speed", amount: 0.97 },
    { id: "bait37", name: "Veil Chum", desc: "Faster bites (−97.5% wait)", cost: 1.5e27, kind: "speed", amount: 0.975 },
    { id: "bait38", name: "Mirage Roe", desc: "Faster bites (−98% wait)", cost: 7.5e27, kind: "speed", amount: 0.98 },
    { id: "bait39", name: "Empyrean Flies", desc: "Faster bites (−98.3% wait)", cost: 3.8e28, kind: "speed", amount: 0.983 },
    { id: "bait40", name: "Horizon Bait", desc: "Faster bites (−98.5% wait)", cost: 1.9e29, kind: "speed", amount: 0.985 },
    { id: "bait41", name: "Aurora Bait", desc: "Faster bites (−98.7% wait)", cost: 9.5e29, kind: "speed", amount: 0.987 },
    { id: "bait42", name: "Fractal Chum", desc: "Faster bites (−98.9% wait)", cost: 4.8e30, kind: "speed", amount: 0.989 },
    { id: "bait43", name: "Dominion Roe", desc: "Faster bites (−99% wait)", cost: 2.4e31, kind: "speed", amount: 0.99 },
    { id: "bait44", name: "Spectral Flies", desc: "Faster bites (−99.1% wait)", cost: 1.2e32, kind: "speed", amount: 0.991 },
    { id: "bait45", name: "Omega Origin Bait", desc: "Faster bites (−99.2% wait)", cost: 6e32, kind: "speed", amount: 0.992 },
    { id: "bait46", name: "Aurora Crown Bait", desc: "Faster bites (−99.25% wait)", cost: 3e33, kind: "speed", amount: 0.9925 },
    { id: "bait47", name: "Fractal Spire Chum", desc: "Faster bites (−99.3% wait)", cost: 1.5e34, kind: "speed", amount: 0.993 },
    { id: "bait48", name: "Dominion Scepter Roe", desc: "Faster bites (−99.35% wait)", cost: 7.5e34, kind: "speed", amount: 0.9935 },
    { id: "bait49", name: "Spectral Veil Flies", desc: "Faster bites (−99.4% wait)", cost: 3.8e35, kind: "speed", amount: 0.994 },
    { id: "bait50", name: "Titan Reach Bait", desc: "Faster bites (−99.45% wait)", cost: 1.9e36, kind: "speed", amount: 0.9945 },
    { id: "bait51", name: "Dreamweave Chum", desc: "Faster bites (−99.5% wait)", cost: 9.5e36, kind: "speed", amount: 0.995 },
    { id: "bait52", name: "Pantheon Roe", desc: "Faster bites (−99.55% wait)", cost: 4.8e37, kind: "speed", amount: 0.9955 },
    { id: "bait53", name: "Astral Crown Flies", desc: "Faster bites (−99.6% wait)", cost: 2.4e38, kind: "speed", amount: 0.996 },
    { id: "bait54", name: "Eternal Gate Bait", desc: "Faster bites (−99.65% wait)", cost: 1.2e39, kind: "speed", amount: 0.9965 },
    { id: "bait55", name: "True Omega Bait", desc: "Faster bites (−99.7% wait)", cost: 6e39, kind: "speed", amount: 0.997 },
    { id: "bait56", name: "Sovereign Bait", desc: "Faster bites (−99.75% wait)", cost: 3e40, kind: "speed", amount: 0.9975 },
    { id: "bait57", name: "Celestial Chum", desc: "Faster bites (−99.8% wait)", cost: 1.5e41, kind: "speed", amount: 0.998 },
    { id: "bait58", name: "Primordial Roe", desc: "Faster bites (−99.85% wait)", cost: 7.5e41, kind: "speed", amount: 0.9985 },
    { id: "bait59", name: "Mythos Flies", desc: "Faster bites (−99.88% wait)", cost: 3.8e42, kind: "speed", amount: 0.9988 },
    { id: "bait60", name: "Continuum Bait", desc: "Faster bites (−99.9% wait)", cost: 1.9e43, kind: "speed", amount: 0.999 },
    { id: "bait61", name: "Beyond Apex Chum", desc: "Faster bites (−99.92% wait)", cost: 9.5e43, kind: "speed", amount: 0.9992 },
    { id: "bait62", name: "Final Horizon Roe", desc: "Faster bites (−99.94% wait)", cost: 4.8e44, kind: "speed", amount: 0.9994 },
    { id: "bait63", name: "True Ultimate Bait", desc: "Faster bites (−99.95% wait)", cost: 2.4e45, kind: "speed", amount: 0.9995 },
    { id: "luck1", name: "Lucky Hook", desc: "+48 luck · better chest finds", cost: 120, kind: "luck", amount: 48 },
    { id: "luck2", name: "Tide Charm", desc: "+72 luck · better chest finds", cost: 700, kind: "luck", amount: 72 },
    { id: "luck3", name: "Pearl Lure", desc: "+96 luck · better chest finds", cost: 4000, kind: "luck", amount: 96 },
    { id: "luck4", name: "Siren Bell", desc: "+132 luck · better chest finds", cost: 20000, kind: "luck", amount: 132 },
    { id: "luck5", name: "Oracle Coin", desc: "+180 luck · better chest finds", cost: 100000, kind: "luck", amount: 180 },
    { id: "luck6", name: "Fate Hook", desc: "+240 luck · better chest finds", cost: 500000, kind: "luck", amount: 240 },
    { id: "luck7", name: "Cosmic Lure", desc: "+330 luck · better chest finds", cost: 2500000, kind: "luck", amount: 330 },
    { id: "luck8", name: "Horizon Charm", desc: "+420 luck · better chest finds", cost: 12000000, kind: "luck", amount: 420 },
    { id: "luck9", name: "Omega Coin", desc: "+540 luck · better chest finds", cost: 60000000, kind: "luck", amount: 540 },
    { id: "luck10", name: "Prism Hook", desc: "+600 luck · better chest finds", cost: 150000000, kind: "luck", amount: 600 },
    { id: "luck11", name: "Apex Charm", desc: "+720 luck · better chest finds", cost: 400000000, kind: "luck", amount: 720 },
    { id: "luck12", name: "Mirage Coin", desc: "+780 luck · better chest finds", cost: 700000000, kind: "luck", amount: 780 },
    { id: "luck13", name: "Zenith Lure", desc: "+900 luck · better chest finds", cost: 1200000000, kind: "luck", amount: 900 },
    { id: "luck14", name: "Rift Hook", desc: "+960 luck · better chest finds", cost: 2000000000, kind: "luck", amount: 960 },
    { id: "luck15", name: "Quasar Charm", desc: "+1080 luck · better chest finds", cost: 3500000000, kind: "luck", amount: 1080 },
    { id: "luck16", name: "Eclipse Coin", desc: "+1200 luck · better chest finds", cost: 5500000000, kind: "luck", amount: 1200 },
    { id: "luck17", name: "Helix Lure", desc: "+1320 luck · better chest finds", cost: 9000000000, kind: "luck", amount: 1320 },
    { id: "luck18", name: "Prism Fate", desc: "+1500 luck · better chest finds", cost: 25000000000, kind: "luck", amount: 1500 },
    { id: "luck19", name: "Chrono Bell", desc: "+1680 luck · better chest finds", cost: 80000000000, kind: "luck", amount: 1680 },
    { id: "luck20", name: "Genesis Charm", desc: "+1920 luck · better chest finds", cost: 250000000000, kind: "luck", amount: 1920 },
    { id: "luck21", name: "Absolution Hook", desc: "+2160 luck · better chest finds", cost: 1e12, kind: "luck", amount: 2160 },
    { id: "luck22", name: "Singularity Coin", desc: "+2520 luck · better chest finds", cost: 5e12, kind: "luck", amount: 2520 },
    { id: "luck23", name: "Paradox Hook", desc: "+3000 luck · better chest finds", cost: 2.5e13, kind: "luck", amount: 3000 },
    { id: "luck24", name: "Infinity Charm", desc: "+3600 luck · better chest finds", cost: 1.2e14, kind: "luck", amount: 3600 },
    { id: "luck25", name: "Absolute Coin", desc: "+4500 luck · better chest finds", cost: 6e14, kind: "luck", amount: 4500 },
    { id: "luck26", name: "True Fate Lure", desc: "+5400 luck · better chest finds", cost: 3e15, kind: "luck", amount: 5400 },
    { id: "luck27", name: "Omni Oracle", desc: "+6600 luck · better chest finds", cost: 1.5e16, kind: "luck", amount: 6600 },
    { id: "luck28", name: "Transcend Charm", desc: "+8000 luck · better chest finds", cost: 8e16, kind: "luck", amount: 8000 },
    { id: "luck29", name: "Nexus Hook", desc: "+10000 luck · better chest finds", cost: 4e17, kind: "luck", amount: 10000 },
    { id: "luck30", name: "Voidborn Coin", desc: "+13000 luck · better chest finds", cost: 2e18, kind: "luck", amount: 13000 },
    { id: "luck31", name: "Zenith Oracle", desc: "+17000 luck · better chest finds", cost: 1e19, kind: "luck", amount: 17000 },
    { id: "luck32", name: "Primordial Charm", desc: "+22000 luck · better chest finds", cost: 5e19, kind: "luck", amount: 22000 },
    { id: "luck33", name: "Sovereign Hook", desc: "+28000 luck · better chest finds", cost: 2.5e20, kind: "luck", amount: 28000 },
    { id: "luck34", name: "Mythos Coin", desc: "+36000 luck · better chest finds", cost: 1.2e21, kind: "luck", amount: 36000 },
    { id: "luck35", name: "Finality Oracle", desc: "+48000 luck · better chest finds", cost: 6e21, kind: "luck", amount: 48000 },
    { id: "luck36", name: "Crown Charm", desc: "+62000 luck · better chest finds", cost: 3e22, kind: "luck", amount: 62000 },
    { id: "luck37", name: "Origin Hook", desc: "+80000 luck · better chest finds", cost: 1.5e23, kind: "luck", amount: 80000 },
    { id: "luck38", name: "Aether Coin", desc: "+100000 luck · better chest finds", cost: 7e23, kind: "luck", amount: 100000 },
    { id: "luck39", name: "Radiant Oracle", desc: "+130000 luck · better chest finds", cost: 3.5e24, kind: "luck", amount: 130000 },
    { id: "luck40", name: "Dusk Charm", desc: "+170000 luck · better chest finds", cost: 1.8e25, kind: "luck", amount: 170000 },
    { id: "luck41", name: "Apex Hook", desc: "+220000 luck · better chest finds", cost: 9e25, kind: "luck", amount: 220000 },
    { id: "luck42", name: "Nova Coin", desc: "+280000 luck · better chest finds", cost: 4.5e26, kind: "luck", amount: 280000 },
    { id: "luck43", name: "Starborne Oracle", desc: "+360000 luck · better chest finds", cost: 2.2e27, kind: "luck", amount: 360000 },
    { id: "luck44", name: "Veil Charm", desc: "+460000 luck · better chest finds", cost: 1.1e28, kind: "luck", amount: 460000 },
    { id: "luck45", name: "Mirage Hook", desc: "+580000 luck · better chest finds", cost: 5.5e28, kind: "luck", amount: 580000 },
    { id: "luck46", name: "Empyrean Coin", desc: "+750000 luck · better chest finds", cost: 2.8e29, kind: "luck", amount: 750000 },
    { id: "luck47", name: "Horizon Oracle", desc: "+950000 luck · better chest finds", cost: 1.4e30, kind: "luck", amount: 950000 },
    { id: "luck48", name: "Aurora Charm", desc: "+1200000 luck · better chest finds", cost: 7e30, kind: "luck", amount: 1200000 },
    { id: "luck49", name: "Fractal Hook", desc: "+1500000 luck · better chest finds", cost: 3.5e31, kind: "luck", amount: 1500000 },
    { id: "luck50", name: "Dominion Coin", desc: "+1900000 luck · better chest finds", cost: 1.8e32, kind: "luck", amount: 1900000 },
    { id: "luck51", name: "Spectral Oracle", desc: "+2400000 luck · better chest finds", cost: 9e32, kind: "luck", amount: 2400000 },
    { id: "luck52", name: "Omega Origin Charm", desc: "+3000000 luck · better chest finds", cost: 4.5e33, kind: "luck", amount: 3000000 },
    { id: "luck53", name: "Aurora Crown Hook", desc: "+3800000 luck · better chest finds", cost: 2.2e34, kind: "luck", amount: 3800000 },
    { id: "luck54", name: "Fractal Spire Coin", desc: "+4800000 luck · better chest finds", cost: 1.1e35, kind: "luck", amount: 4800000 },
    { id: "luck55", name: "Dominion Oracle", desc: "+6000000 luck · better chest finds", cost: 5.5e35, kind: "luck", amount: 6000000 },
    { id: "luck56", name: "Spectral Veil Charm", desc: "+7500000 luck · better chest finds", cost: 2.8e36, kind: "luck", amount: 7500000 },
    { id: "luck57", name: "Titan Reach Hook", desc: "+9500000 luck · better chest finds", cost: 1.4e37, kind: "luck", amount: 9500000 },
    { id: "luck58", name: "Dreamweave Coin", desc: "+12000000 luck · better chest finds", cost: 7e37, kind: "luck", amount: 12000000 },
    { id: "luck59", name: "Pantheon Oracle", desc: "+15000000 luck · better chest finds", cost: 3.5e38, kind: "luck", amount: 15000000 },
    { id: "luck60", name: "Astral Crown Charm", desc: "+19000000 luck · better chest finds", cost: 1.8e39, kind: "luck", amount: 19000000 },
    { id: "luck61", name: "Eternal Gate Hook", desc: "+24000000 luck · better chest finds", cost: 9e39, kind: "luck", amount: 24000000 },
    { id: "luck62", name: "True Omega Oracle", desc: "+30000000 luck · better chest finds", cost: 4.5e40, kind: "luck", amount: 30000000 },
    { id: "luck63", name: "Sovereign Oracle", desc: "+38000000 luck · better chest finds", cost: 2.2e41, kind: "luck", amount: 38000000 },
    { id: "luck64", name: "Celestial Charm", desc: "+48000000 luck · better chest finds", cost: 1.1e42, kind: "luck", amount: 48000000 },
    { id: "luck65", name: "Primordial Hook", desc: "+60000000 luck · better chest finds", cost: 5.5e42, kind: "luck", amount: 60000000 },
    { id: "luck66", name: "Mythos Coin", desc: "+75000000 luck · better chest finds", cost: 2.8e43, kind: "luck", amount: 75000000 },
    { id: "luck67", name: "Continuum Lure", desc: "+95000000 luck · better chest finds", cost: 1.4e44, kind: "luck", amount: 95000000 },
    { id: "luck68", name: "Beyond Apex Charm", desc: "+120000000 luck · better chest finds", cost: 7e44, kind: "luck", amount: 120000000 },
    { id: "luck69", name: "Final Horizon Hook", desc: "+150000000 luck · better chest finds", cost: 3.5e45, kind: "luck", amount: 150000000 },
    { id: "luck70", name: "True Ultimate Oracle", desc: "+190000000 luck · better chest finds", cost: 1.8e46, kind: "luck", amount: 190000000 },
    { id: "cooler1", name: "Ice Pack", desc: "+4 cooler slots", cost: 200, kind: "cooler", amount: 4 },
    { id: "cooler2", name: "Big Cooler", desc: "+6 cooler slots", cost: 1500, kind: "cooler", amount: 6 },
    { id: "cooler3", name: "Dock Freezer", desc: "+10 cooler slots", cost: 12000, kind: "cooler", amount: 10 },
    { id: "cooler4", name: "Reef Vault", desc: "+14 cooler slots", cost: 80000, kind: "cooler", amount: 14 },
    { id: "cooler5", name: "Trench Hold", desc: "+20 cooler slots", cost: 400000, kind: "cooler", amount: 20 },
    { id: "cooler6", name: "Void Chest", desc: "+28 cooler slots", cost: 2000000, kind: "cooler", amount: 28 },
    { id: "cooler7", name: "Event Hold", desc: "+36 cooler slots", cost: 10000000, kind: "cooler", amount: 36 },
    { id: "cooler8", name: "Omega Locker", desc: "+48 cooler slots", cost: 50000000, kind: "cooler", amount: 48 },
    { id: "cooler9", name: "Deep Cage", desc: "+56 cooler slots", cost: 120000000, kind: "cooler", amount: 56 },
    { id: "cooler10", name: "Apex Vault", desc: "+70 cooler slots", cost: 380000000, kind: "cooler", amount: 70 },
    { id: "cooler11", name: "Cascade Hold", desc: "+80 cooler slots", cost: 650000000, kind: "cooler", amount: 80 },
    { id: "cooler12", name: "Zenith Freezer", desc: "+100 cooler slots", cost: 1100000000, kind: "cooler", amount: 100 },
    { id: "cooler13", name: "Rift Locker", desc: "+110 cooler slots", cost: 1800000000, kind: "cooler", amount: 110 },
    { id: "cooler14", name: "Quasar Cage", desc: "+120 cooler slots", cost: 3000000000, kind: "cooler", amount: 120 },
    { id: "cooler15", name: "Eclipse Vault", desc: "+140 cooler slots", cost: 5000000000, kind: "cooler", amount: 140 },
    { id: "cooler16", name: "Helix Freezer", desc: "+160 cooler slots", cost: 8000000000, kind: "cooler", amount: 160 },
    { id: "cooler17", name: "Prism Hold", desc: "+180 cooler slots", cost: 22000000000, kind: "cooler", amount: 180 },
    { id: "cooler18", name: "Chrono Vault", desc: "+200 cooler slots", cost: 70000000000, kind: "cooler", amount: 200 },
    { id: "cooler19", name: "Genesis Locker", desc: "+240 cooler slots", cost: 220000000000, kind: "cooler", amount: 240 },
    { id: "cooler20", name: "Absolution Hold", desc: "+280 cooler slots", cost: 9e11, kind: "cooler", amount: 280 },
    { id: "cooler21", name: "Infinity Cage", desc: "+320 cooler slots", cost: 4e12, kind: "cooler", amount: 320 },
    { id: "cooler22", name: "Paradox Hold", desc: "+380 cooler slots", cost: 2e13, kind: "cooler", amount: 380 },
    { id: "cooler23", name: "Absolute Vault", desc: "+450 cooler slots", cost: 1e14, kind: "cooler", amount: 450 },
    { id: "cooler24", name: "True Freezer", desc: "+520 cooler slots", cost: 5e14, kind: "cooler", amount: 520 },
    { id: "cooler25", name: "Omni Locker", desc: "+600 cooler slots", cost: 2.5e15, kind: "cooler", amount: 600 },
    { id: "cooler26", name: "Transcend Hold", desc: "+700 cooler slots", cost: 1.2e16, kind: "cooler", amount: 700 },
    { id: "cooler27", name: "Nexus Vault", desc: "+850 cooler slots", cost: 6e16, kind: "cooler", amount: 850 },
    { id: "cooler28", name: "Voidborn Cage", desc: "+1000 cooler slots", cost: 3e17, kind: "cooler", amount: 1000 },
    { id: "cooler29", name: "Zenith Freezer Ultima", desc: "+1200 cooler slots", cost: 1.5e18, kind: "cooler", amount: 1200 },
    { id: "cooler30", name: "Primordial Hold", desc: "+1400 cooler slots", cost: 7.5e18, kind: "cooler", amount: 1400 },
    { id: "cooler31", name: "Sovereign Vault", desc: "+1700 cooler slots", cost: 4e19, kind: "cooler", amount: 1700 },
    { id: "cooler32", name: "Mythos Cage", desc: "+2100 cooler slots", cost: 2e20, kind: "cooler", amount: 2100 },
    { id: "cooler33", name: "Finality Locker", desc: "+2600 cooler slots", cost: 1e21, kind: "cooler", amount: 2600 },
    { id: "cooler34", name: "Crown Vault", desc: "+3200 cooler slots", cost: 5e21, kind: "cooler", amount: 3200 },
    { id: "cooler35", name: "Origin Hold", desc: "+4000 cooler slots", cost: 2.5e22, kind: "cooler", amount: 4000 },
    { id: "cooler36", name: "Aether Cage", desc: "+5000 cooler slots", cost: 1.2e23, kind: "cooler", amount: 5000 },
    { id: "cooler37", name: "Radiant Locker", desc: "+6200 cooler slots", cost: 6e23, kind: "cooler", amount: 6200 },
    { id: "cooler38", name: "Dusk Vault", desc: "+7800 cooler slots", cost: 3e24, kind: "cooler", amount: 7800 },
    { id: "cooler39", name: "Apex Hold", desc: "+9800 cooler slots", cost: 1.5e25, kind: "cooler", amount: 9800 },
    { id: "cooler40", name: "Nova Cage", desc: "+12000 cooler slots", cost: 7.5e25, kind: "cooler", amount: 12000 },
    { id: "cooler41", name: "Starborne Locker", desc: "+15000 cooler slots", cost: 3.8e26, kind: "cooler", amount: 15000 },
    { id: "cooler42", name: "Veil Vault", desc: "+19000 cooler slots", cost: 1.9e27, kind: "cooler", amount: 19000 },
    { id: "cooler43", name: "Mirage Hold", desc: "+24000 cooler slots", cost: 9.5e27, kind: "cooler", amount: 24000 },
    { id: "cooler44", name: "Empyrean Cage", desc: "+30000 cooler slots", cost: 4.8e28, kind: "cooler", amount: 30000 },
    { id: "cooler45", name: "Horizon Locker", desc: "+38000 cooler slots", cost: 2.4e29, kind: "cooler", amount: 38000 },
    { id: "cooler46", name: "Aurora Hold", desc: "+48000 cooler slots", cost: 1.2e30, kind: "cooler", amount: 48000 },
    { id: "cooler47", name: "Fractal Vault", desc: "+60000 cooler slots", cost: 6e30, kind: "cooler", amount: 60000 },
    { id: "cooler48", name: "Dominion Cage", desc: "+75000 cooler slots", cost: 3e31, kind: "cooler", amount: 75000 },
    { id: "cooler49", name: "Spectral Locker", desc: "+95000 cooler slots", cost: 1.5e32, kind: "cooler", amount: 95000 },
    { id: "cooler50", name: "Omega Origin Hold", desc: "+120000 cooler slots", cost: 7.5e32, kind: "cooler", amount: 120000 },
    { id: "cooler51", name: "Aurora Crown Vault", desc: "+150000 cooler slots", cost: 3.8e33, kind: "cooler", amount: 150000 },
    { id: "cooler52", name: "Fractal Spire Hold", desc: "+190000 cooler slots", cost: 1.9e34, kind: "cooler", amount: 190000 },
    { id: "cooler53", name: "Dominion Cage", desc: "+240000 cooler slots", cost: 9.5e34, kind: "cooler", amount: 240000 },
    { id: "cooler54", name: "Spectral Veil Locker", desc: "+300000 cooler slots", cost: 4.8e35, kind: "cooler", amount: 300000 },
    { id: "cooler55", name: "Titan Reach Vault", desc: "+380000 cooler slots", cost: 2.4e36, kind: "cooler", amount: 380000 },
    { id: "cooler56", name: "Dreamweave Hold", desc: "+480000 cooler slots", cost: 1.2e37, kind: "cooler", amount: 480000 },
    { id: "cooler57", name: "Pantheon Cage", desc: "+600000 cooler slots", cost: 6e37, kind: "cooler", amount: 600000 },
    { id: "cooler58", name: "Astral Crown Locker", desc: "+750000 cooler slots", cost: 3e38, kind: "cooler", amount: 750000 },
    { id: "cooler59", name: "Eternal Gate Vault", desc: "+950000 cooler slots", cost: 1.5e39, kind: "cooler", amount: 950000 },
    { id: "cooler60", name: "True Omega Hold", desc: "+1200000 cooler slots", cost: 7.5e39, kind: "cooler", amount: 1200000 },
    { id: "cooler61", name: "Sovereign Hold", desc: "+1500000 cooler slots", cost: 3.8e40, kind: "cooler", amount: 1500000 },
    { id: "cooler62", name: "Celestial Vault", desc: "+1900000 cooler slots", cost: 1.9e41, kind: "cooler", amount: 1900000 },
    { id: "cooler63", name: "Primordial Cage", desc: "+2400000 cooler slots", cost: 9.5e41, kind: "cooler", amount: 2400000 },
    { id: "cooler64", name: "Mythos Locker", desc: "+3000000 cooler slots", cost: 4.8e42, kind: "cooler", amount: 3000000 },
    { id: "cooler65", name: "Continuum Hold", desc: "+3800000 cooler slots", cost: 2.4e43, kind: "cooler", amount: 3800000 },
    { id: "cooler66", name: "Beyond Apex Vault", desc: "+4800000 cooler slots", cost: 1.2e44, kind: "cooler", amount: 4800000 },
    { id: "cooler67", name: "Final Horizon Cage", desc: "+6000000 cooler slots", cost: 6e44, kind: "cooler", amount: 6000000 },
    { id: "cooler68", name: "True Ultimate Hold", desc: "+7500000 cooler slots", cost: 3e45, kind: "cooler", amount: 7500000 },
    { id: "sell1", name: "Merchant Scale", desc: "+5% sell value", cost: 500, kind: "value", amount: 0.05 },
    { id: "sell2", name: "Harbor Broker", desc: "+8% sell value", cost: 5000, kind: "value", amount: 0.08 },
    { id: "sell3", name: "Gold Ledger", desc: "+12% sell value", cost: 50000, kind: "value", amount: 0.12 },
    { id: "sell4", name: "Crown Auction", desc: "+18% sell value", cost: 400000, kind: "value", amount: 0.18 },
    { id: "sell5", name: "Omega Market", desc: "+25% sell value", cost: 5000000, kind: "value", amount: 0.25 },
    { id: "sell6", name: "Platinum Pit", desc: "+30% sell value", cost: 25000000, kind: "value", amount: 0.3 },
    { id: "sell7", name: "Dynasty Floor", desc: "+40% sell value", cost: 120000000, kind: "value", amount: 0.4 },
    { id: "sell8", name: "Apex Exchange", desc: "+50% sell value", cost: 400000000, kind: "value", amount: 0.5 },
    { id: "sell9", name: "Titan Broker", desc: "+55% sell value", cost: 700000000, kind: "value", amount: 0.55 },
    { id: "sell10", name: "Zenith Market", desc: "+65% sell value", cost: 1200000000, kind: "value", amount: 0.65 },
    { id: "sell11", name: "Rift Exchange", desc: "+70% sell value", cost: 2000000000, kind: "value", amount: 0.7 },
    { id: "sell12", name: "Quasar Floor", desc: "+80% sell value", cost: 3500000000, kind: "value", amount: 0.8 },
    { id: "sell13", name: "Eclipse Pit", desc: "+90% sell value", cost: 5500000000, kind: "value", amount: 0.9 },
    { id: "sell14", name: "Helix Market", desc: "+100% sell value", cost: 9000000000, kind: "value", amount: 1 },
    { id: "sell15", name: "Prism Exchange", desc: "+110% sell value", cost: 28000000000, kind: "value", amount: 1.1 },
    { id: "sell16", name: "Chrono Floor", desc: "+125% sell value", cost: 90000000000, kind: "value", amount: 1.25 },
    { id: "sell17", name: "Genesis Market", desc: "+150% sell value", cost: 300000000000, kind: "value", amount: 1.5 },
    { id: "sell18", name: "Absolution Exchange", desc: "+175% sell value", cost: 1.2e12, kind: "value", amount: 1.75 },
    { id: "sell19", name: "Omni Market", desc: "+200% sell value", cost: 6e12, kind: "value", amount: 2 },
    { id: "sell20", name: "Paradox Floor", desc: "+230% sell value", cost: 3e13, kind: "value", amount: 2.3 },
    { id: "sell21", name: "Infinity Exchange", desc: "+270% sell value", cost: 1.5e14, kind: "value", amount: 2.7 },
    { id: "sell22", name: "Absolute Pit", desc: "+320% sell value", cost: 8e14, kind: "value", amount: 3.2 },
    { id: "sell23", name: "True Market", desc: "+380% sell value", cost: 4e15, kind: "value", amount: 3.8 },
    { id: "sell24", name: "Omni Absolute Floor", desc: "+450% sell value", cost: 2e16, kind: "value", amount: 4.5 },
    { id: "sell25", name: "Transcend Market", desc: "+520% sell value", cost: 1e17, kind: "value", amount: 5.2 },
    { id: "sell26", name: "Nexus Exchange", desc: "+600% sell value", cost: 5e17, kind: "value", amount: 6 },
    { id: "sell27", name: "Voidborn Pit", desc: "+700% sell value", cost: 2.5e18, kind: "value", amount: 7 },
    { id: "sell28", name: "Zenith Floor Ultima", desc: "+850% sell value", cost: 1.2e19, kind: "value", amount: 8.5 },
    { id: "sell29", name: "Primordial Market", desc: "+1000% sell value", cost: 6e19, kind: "value", amount: 10 },
    { id: "sell30", name: "Sovereign Exchange", desc: "+1200% sell value", cost: 3e20, kind: "value", amount: 12 },
    { id: "sell31", name: "Mythos Pit", desc: "+1450% sell value", cost: 1.5e21, kind: "value", amount: 14.5 },
    { id: "sell32", name: "Finality Floor", desc: "+1800% sell value", cost: 8e21, kind: "value", amount: 18 },
    { id: "sell33", name: "Crown Market", desc: "+2200% sell value", cost: 4e22, kind: "value", amount: 22 },
    { id: "sell34", name: "Origin Exchange", desc: "+2700% sell value", cost: 2e23, kind: "value", amount: 27 },
    { id: "sell35", name: "Aether Floor", desc: "+3300% sell value", cost: 1e24, kind: "value", amount: 33 },
    { id: "sell36", name: "Radiant Pit", desc: "+4000% sell value", cost: 5e24, kind: "value", amount: 40 },
    { id: "sell37", name: "Dusk Market", desc: "+5000% sell value", cost: 2.5e25, kind: "value", amount: 50 },
    { id: "sell38", name: "Apex Exchange", desc: "+6200% sell value", cost: 1.2e26, kind: "value", amount: 62 },
    { id: "sell39", name: "Nova Floor", desc: "+7800% sell value", cost: 6e26, kind: "value", amount: 78 },
    { id: "sell40", name: "Starborne Pit", desc: "+10000% sell value", cost: 3e27, kind: "value", amount: 100 },
    { id: "sell41", name: "Veil Market", desc: "+12500% sell value", cost: 1.5e28, kind: "value", amount: 125 },
    { id: "sell42", name: "Mirage Exchange", desc: "+15500% sell value", cost: 7.5e28, kind: "value", amount: 155 },
    { id: "sell43", name: "Empyrean Floor", desc: "+19500% sell value", cost: 3.8e29, kind: "value", amount: 195 },
    { id: "sell44", name: "Horizon Pit", desc: "+25000% sell value", cost: 1.9e30, kind: "value", amount: 250 },
    { id: "sell45", name: "Aurora Market", desc: "+31000% sell value", cost: 9.5e30, kind: "value", amount: 310 },
    { id: "sell46", name: "Fractal Exchange", desc: "+39000% sell value", cost: 4.8e31, kind: "value", amount: 390 },
    { id: "sell47", name: "Dominion Floor", desc: "+49000% sell value", cost: 2.4e32, kind: "value", amount: 490 },
    { id: "sell48", name: "Spectral Pit", desc: "+62000% sell value", cost: 1.2e33, kind: "value", amount: 620 },
    { id: "sell49", name: "Omega Origin Market", desc: "+78000% sell value", cost: 6e33, kind: "value", amount: 780 },
    { id: "sell50", name: "Aurora Crown Exchange", desc: "+98000% sell value", cost: 3e34, kind: "value", amount: 980 },
    { id: "sell51", name: "Fractal Spire Floor", desc: "+125000% sell value", cost: 1.5e35, kind: "value", amount: 1250 },
    { id: "sell52", name: "Dominion Pit", desc: "+155000% sell value", cost: 7.5e35, kind: "value", amount: 1550 },
    { id: "sell53", name: "Spectral Veil Market", desc: "+195000% sell value", cost: 3.8e36, kind: "value", amount: 1950 },
    { id: "sell54", name: "Titan Reach Exchange", desc: "+245000% sell value", cost: 1.9e37, kind: "value", amount: 2450 },
    { id: "sell55", name: "Dreamweave Floor", desc: "+310000% sell value", cost: 9.5e37, kind: "value", amount: 3100 },
    { id: "sell56", name: "Pantheon Pit", desc: "+390000% sell value", cost: 4.8e38, kind: "value", amount: 3900 },
    { id: "sell57", name: "Astral Crown Market", desc: "+490000% sell value", cost: 2.4e39, kind: "value", amount: 4900 },
    { id: "sell58", name: "Eternal Gate Exchange", desc: "+620000% sell value", cost: 1.2e40, kind: "value", amount: 6200 },
    { id: "sell59", name: "True Omega Floor", desc: "+780000% sell value", cost: 6e40, kind: "value", amount: 7800 },
    { id: "sell60", name: "Sovereign Market", desc: "+980000% sell value", cost: 3e41, kind: "value", amount: 9800 },
    { id: "sell61", name: "Celestial Exchange", desc: "+1250000% sell value", cost: 1.5e42, kind: "value", amount: 12500 },
    { id: "sell62", name: "Primordial Floor", desc: "+1550000% sell value", cost: 7.5e42, kind: "value", amount: 15500 },
    { id: "sell63", name: "Mythos Pit", desc: "+1950000% sell value", cost: 3.8e43, kind: "value", amount: 19500 },
    { id: "sell64", name: "Continuum Market", desc: "+2450000% sell value", cost: 1.9e44, kind: "value", amount: 24500 },
    { id: "sell65", name: "Beyond Apex Exchange", desc: "+3100000% sell value", cost: 9.5e44, kind: "value", amount: 31000 },
    { id: "sell66", name: "Final Horizon Floor", desc: "+3900000% sell value", cost: 4.8e45, kind: "value", amount: 39000 },
    { id: "sell67", name: "True Ultimate Market", desc: "+4900000% sell value", cost: 2.4e46, kind: "value", amount: 49000 },
    { id: "net1", name: "Hand Net", desc: "6% chance for a second fish", cost: 2500, kind: "multi", amount: 0.06 },
    { id: "net2", name: "Drag Net", desc: "10% chance for a second fish", cost: 28000, kind: "multi", amount: 0.1 },
    { id: "net3", name: "Trawl Mesh", desc: "14% chance for a second fish", cost: 220000, kind: "multi", amount: 0.14 },
    { id: "net4", name: "Pulse Net", desc: "18% chance for a second fish", cost: 2200000, kind: "multi", amount: 0.18 },
    { id: "net5", name: "Void Snare", desc: "22% chance for a second fish", cost: 22000000, kind: "multi", amount: 0.22 },
    { id: "net6", name: "Apex Net", desc: "28% chance for a second fish", cost: 160000000, kind: "multi", amount: 0.28 },
    { id: "net7", name: "Cascade Snare", desc: "8% chance for a second fish", cost: 400000000, kind: "multi", amount: 0.08 },
    { id: "net8", name: "Zenith Net", desc: "10% chance for a second fish", cost: 900000000, kind: "multi", amount: 0.1 },
    { id: "net9", name: "Rift Mesh", desc: "12% chance for a second fish", cost: 1800000000, kind: "multi", amount: 0.12 },
    { id: "net10", name: "Quasar Net", desc: "14% chance for a second fish", cost: 3200000000, kind: "multi", amount: 0.14 },
    { id: "net11", name: "Eclipse Snare", desc: "16% chance for a second fish", cost: 5500000000, kind: "multi", amount: 0.16 },
    { id: "net12", name: "Helix Net", desc: "18% chance for a second fish", cost: 9000000000, kind: "multi", amount: 0.18 },
    { id: "net13", name: "Prism Snare", desc: "20% chance for a second fish", cost: 30000000000, kind: "multi", amount: 0.2 },
    { id: "net14", name: "Chrono Net", desc: "22% chance for a second fish", cost: 100000000000, kind: "multi", amount: 0.22 },
    { id: "net15", name: "Genesis Mesh", desc: "25% chance for a second fish", cost: 350000000000, kind: "multi", amount: 0.25 },
    { id: "net16", name: "Absolution Net", desc: "28% chance for a second fish", cost: 1.4e12, kind: "multi", amount: 0.28 },
    { id: "net17", name: "Singularity Snare", desc: "30% chance for a second fish", cost: 7e12, kind: "multi", amount: 0.3 },
    { id: "net18", name: "Paradox Mesh", desc: "32% chance for a second fish", cost: 3.5e13, kind: "multi", amount: 0.32 },
    { id: "net19", name: "Infinity Net", desc: "35% chance for a second fish", cost: 1.8e14, kind: "multi", amount: 0.35 },
    { id: "net20", name: "Absolute Snare", desc: "38% chance for a second fish", cost: 9e14, kind: "multi", amount: 0.38 },
    { id: "net21", name: "True Omni Net", desc: "42% chance for a second fish", cost: 4.5e15, kind: "multi", amount: 0.42 },
    { id: "net22", name: "Transcend Snare", desc: "46% chance for a second fish", cost: 2.2e16, kind: "multi", amount: 0.46 },
    { id: "net23", name: "Nexus Mesh", desc: "50% chance for a second fish", cost: 1.1e17, kind: "multi", amount: 0.5 },
    { id: "net24", name: "Voidborn Net", desc: "55% chance for a second fish", cost: 5.5e17, kind: "multi", amount: 0.55 },
    { id: "net25", name: "Zenith Snare Ultima", desc: "60% chance for a second fish", cost: 2.8e18, kind: "multi", amount: 0.6 },
    { id: "net26", name: "Primordial Net", desc: "65% chance for a second fish", cost: 1.4e19, kind: "multi", amount: 0.65 },
    { id: "net27", name: "Sovereign Mesh", desc: "70% chance for a second fish", cost: 7e19, kind: "multi", amount: 0.7 },
    { id: "net28", name: "Mythos Snare", desc: "76% chance for a second fish", cost: 3.5e20, kind: "multi", amount: 0.76 },
    { id: "net29", name: "Finality Net", desc: "82% chance for a second fish", cost: 1.8e21, kind: "multi", amount: 0.82 },
    { id: "net30", name: "Crown Net", desc: "88% chance for a second fish", cost: 9e21, kind: "multi", amount: 0.88 },
    { id: "net31", name: "Origin Mesh", desc: "92% chance for a second fish", cost: 4.5e22, kind: "multi", amount: 0.92 },
    { id: "net32", name: "Aether Snare", desc: "95% chance for a second fish", cost: 2.2e23, kind: "multi", amount: 0.95 },
    { id: "net33", name: "Radiant Net", desc: "98% chance for a second fish", cost: 1.1e24, kind: "multi", amount: 0.98 },
    { id: "net34", name: "Dusk Net", desc: "98.5% chance for a second fish", cost: 5.5e24, kind: "multi", amount: 0.985 },
    { id: "net35", name: "Apex Mesh", desc: "99% chance for a second fish", cost: 2.8e25, kind: "multi", amount: 0.99 },
    { id: "net36", name: "Nova Snare", desc: "99.3% chance for a second fish", cost: 1.4e26, kind: "multi", amount: 0.993 },
    { id: "net37", name: "Starborne Net", desc: "99.5% chance for a second fish", cost: 7e26, kind: "multi", amount: 0.995 },
    { id: "net38", name: "Veil Net", desc: "99.6% chance for a second fish", cost: 3.5e27, kind: "multi", amount: 0.996 },
    { id: "net39", name: "Mirage Mesh", desc: "99.7% chance for a second fish", cost: 1.8e28, kind: "multi", amount: 0.997 },
    { id: "net40", name: "Empyrean Snare", desc: "99.8% chance for a second fish", cost: 9e28, kind: "multi", amount: 0.998 },
    { id: "net41", name: "Horizon Net", desc: "99.85% chance for a second fish", cost: 4.5e29, kind: "multi", amount: 0.9985 },
    { id: "net42", name: "Aurora Snare", desc: "99.88% chance for a second fish", cost: 2.2e30, kind: "multi", amount: 0.9988 },
    { id: "net43", name: "Fractal Mesh", desc: "99.9% chance for a second fish", cost: 1.1e31, kind: "multi", amount: 0.999 },
    { id: "net44", name: "Dominion Net", desc: "99.92% chance for a second fish", cost: 5.5e31, kind: "multi", amount: 0.9992 },
    { id: "net45", name: "Spectral Snare", desc: "99.94% chance for a second fish", cost: 2.8e32, kind: "multi", amount: 0.9994 },
    { id: "net46", name: "Omega Origin Net", desc: "99.95% chance for a second fish", cost: 1.4e33, kind: "multi", amount: 0.9995 },
    { id: "net47", name: "Sovereign Net", desc: "99.96% chance for a second fish", cost: 7e33, kind: "multi", amount: 0.9996 },
    { id: "net48", name: "Celestial Snare", desc: "99.97% chance for a second fish", cost: 3.5e34, kind: "multi", amount: 0.9997 },
    { id: "net49", name: "Primordial Mesh", desc: "99.98% chance for a second fish", cost: 1.8e35, kind: "multi", amount: 0.9998 },
    { id: "net50", name: "Mythos Net", desc: "99.985% chance for a second fish", cost: 9e35, kind: "multi", amount: 0.99985 },
    { id: "net51", name: "Continuum Snare", desc: "99.99% chance for a second fish", cost: 4.5e36, kind: "multi", amount: 0.9999 },
    { id: "net52", name: "Beyond Apex Net", desc: "99.992% chance for a second fish", cost: 2.2e37, kind: "multi", amount: 0.99992 },
    { id: "net53", name: "Final Horizon Mesh", desc: "99.994% chance for a second fish", cost: 1.1e38, kind: "multi", amount: 0.99994 },
    { id: "net54", name: "True Ultimate Net", desc: "99.995% chance for a second fish", cost: 5.5e38, kind: "multi", amount: 0.99995 },
    { id: "triple1", name: "Twin Hook", desc: "4% chance for a third fish (needs 2nd catch)", cost: 15000, kind: "triple", amount: 0.04 },
    { id: "triple2", name: "Trident Line", desc: "7% chance for a third fish (needs 2nd catch)", cost: 120000, kind: "triple", amount: 0.07 },
    { id: "triple3", name: "Triple Snare", desc: "10% chance for a third fish (needs 2nd catch)", cost: 900000, kind: "triple", amount: 0.1 },
    { id: "triple4", name: "Cascade Trident", desc: "13% chance for a third fish (needs 2nd catch)", cost: 8000000, kind: "triple", amount: 0.13 },
    { id: "triple5", name: "Void Triad", desc: "16% chance for a third fish (needs 2nd catch)", cost: 70000000, kind: "triple", amount: 0.16 },
    { id: "triple6", name: "Apex Trident", desc: "20% chance for a third fish (needs 2nd catch)", cost: 500000000, kind: "triple", amount: 0.2 },
    { id: "triple7", name: "Zenith Triad", desc: "8% chance for a third fish (needs 2nd catch)", cost: 1500000000, kind: "triple", amount: 0.08 },
    { id: "triple8", name: "Rift Trident", desc: "10% chance for a third fish (needs 2nd catch)", cost: 4000000000, kind: "triple", amount: 0.1 },
    { id: "triple9", name: "Quasar Triad", desc: "12% chance for a third fish (needs 2nd catch)", cost: 12000000000, kind: "triple", amount: 0.12 },
    { id: "triple10", name: "Prism Trident", desc: "15% chance for a third fish (needs 2nd catch)", cost: 40000000000, kind: "triple", amount: 0.15 },
    { id: "triple11", name: "Chrono Triad", desc: "18% chance for a third fish (needs 2nd catch)", cost: 150000000000, kind: "triple", amount: 0.18 },
    { id: "triple12", name: "Genesis Trident", desc: "22% chance for a third fish (needs 2nd catch)", cost: 500000000000, kind: "triple", amount: 0.22 },
    { id: "triple13", name: "Absolution Triad", desc: "25% chance for a third fish (needs 2nd catch)", cost: 2e12, kind: "triple", amount: 0.25 },
    { id: "triple14", name: "Infinity Trident", desc: "28% chance for a third fish (needs 2nd catch)", cost: 1e13, kind: "triple", amount: 0.28 },
    { id: "triple15", name: "Paradox Triad", desc: "30% chance for a third fish (needs 2nd catch)", cost: 5e13, kind: "triple", amount: 0.3 },
    { id: "triple16", name: "Absolute Trident", desc: "33% chance for a third fish (needs 2nd catch)", cost: 2.5e14, kind: "triple", amount: 0.33 },
    { id: "triple17", name: "True Triad", desc: "36% chance for a third fish (needs 2nd catch)", cost: 1.2e15, kind: "triple", amount: 0.36 },
    { id: "triple18", name: "Omni Trident", desc: "40% chance for a third fish (needs 2nd catch)", cost: 6e15, kind: "triple", amount: 0.4 },
    { id: "triple19", name: "Transcend Triad", desc: "44% chance for a third fish (needs 2nd catch)", cost: 3e16, kind: "triple", amount: 0.44 },
    { id: "triple20", name: "Nexus Trident", desc: "48% chance for a third fish (needs 2nd catch)", cost: 1.5e17, kind: "triple", amount: 0.48 },
    { id: "triple21", name: "Voidborn Triad", desc: "52% chance for a third fish (needs 2nd catch)", cost: 7.5e17, kind: "triple", amount: 0.52 },
    { id: "triple22", name: "Zenith Trident Ultima", desc: "58% chance for a third fish (needs 2nd catch)", cost: 3.8e18, kind: "triple", amount: 0.58 },
    { id: "triple23", name: "Primordial Triad", desc: "62% chance for a third fish (needs 2nd catch)", cost: 1.9e19, kind: "triple", amount: 0.62 },
    { id: "triple24", name: "Sovereign Trident", desc: "67% chance for a third fish (needs 2nd catch)", cost: 9.5e19, kind: "triple", amount: 0.67 },
    { id: "triple25", name: "Mythos Triad", desc: "72% chance for a third fish (needs 2nd catch)", cost: 4.8e20, kind: "triple", amount: 0.72 },
    { id: "triple26", name: "Finality Trident", desc: "78% chance for a third fish (needs 2nd catch)", cost: 2.4e21, kind: "triple", amount: 0.78 },
    { id: "triple27", name: "Crown Triad", desc: "84% chance for a third fish (needs 2nd catch)", cost: 1.2e22, kind: "triple", amount: 0.84 },
    { id: "triple28", name: "Origin Trident", desc: "88% chance for a third fish (needs 2nd catch)", cost: 6e22, kind: "triple", amount: 0.88 },
    { id: "triple29", name: "Aether Triad", desc: "92% chance for a third fish (needs 2nd catch)", cost: 3e23, kind: "triple", amount: 0.92 },
    { id: "triple30", name: "Radiant Trident", desc: "96% chance for a third fish (needs 2nd catch)", cost: 1.5e24, kind: "triple", amount: 0.96 },
    { id: "triple31", name: "Dusk Triad", desc: "97% chance for a third fish (needs 2nd catch)", cost: 7.5e24, kind: "triple", amount: 0.97 },
    { id: "triple32", name: "Apex Trident Ultima", desc: "97.5% chance for a third fish (needs 2nd catch)", cost: 3.8e25, kind: "triple", amount: 0.975 },
    { id: "triple33", name: "Nova Triad", desc: "98% chance for a third fish (needs 2nd catch)", cost: 1.9e26, kind: "triple", amount: 0.98 },
    { id: "triple34", name: "Starborne Trident", desc: "98.5% chance for a third fish (needs 2nd catch)", cost: 9.5e26, kind: "triple", amount: 0.985 },
    { id: "triple35", name: "Veil Triad", desc: "98.8% chance for a third fish (needs 2nd catch)", cost: 4.8e27, kind: "triple", amount: 0.988 },
    { id: "triple36", name: "Mirage Trident", desc: "99% chance for a third fish (needs 2nd catch)", cost: 2.4e28, kind: "triple", amount: 0.99 },
    { id: "triple37", name: "Empyrean Triad", desc: "99.2% chance for a third fish (needs 2nd catch)", cost: 1.2e29, kind: "triple", amount: 0.992 },
    { id: "triple38", name: "Horizon Trident", desc: "99.4% chance for a third fish (needs 2nd catch)", cost: 6e29, kind: "triple", amount: 0.994 },
    { id: "triple39", name: "Aurora Triad", desc: "99.5% chance for a third fish (needs 2nd catch)", cost: 3e30, kind: "triple", amount: 0.995 },
    { id: "triple40", name: "Fractal Trident", desc: "99.6% chance for a third fish (needs 2nd catch)", cost: 1.5e31, kind: "triple", amount: 0.996 },
    { id: "triple41", name: "Dominion Triad", desc: "99.7% chance for a third fish (needs 2nd catch)", cost: 7.5e31, kind: "triple", amount: 0.997 },
    { id: "triple42", name: "Spectral Trident", desc: "99.8% chance for a third fish (needs 2nd catch)", cost: 3.8e32, kind: "triple", amount: 0.998 },
    { id: "triple43", name: "Omega Origin Triad", desc: "99.85% chance for a third fish (needs 2nd catch)", cost: 1.9e33, kind: "triple", amount: 0.9985 },
    { id: "triple44", name: "Sovereign Triad", desc: "99.88% chance for a third fish (needs 2nd catch)", cost: 9.5e33, kind: "triple", amount: 0.9988 },
    { id: "triple45", name: "Celestial Trident", desc: "99.9% chance for a third fish (needs 2nd catch)", cost: 4.8e34, kind: "triple", amount: 0.999 },
    { id: "triple46", name: "Primordial Triad", desc: "99.92% chance for a third fish (needs 2nd catch)", cost: 2.4e35, kind: "triple", amount: 0.9992 },
    { id: "triple47", name: "Mythos Trident", desc: "99.94% chance for a third fish (needs 2nd catch)", cost: 1.2e36, kind: "triple", amount: 0.9994 },
    { id: "triple48", name: "Continuum Triad", desc: "99.95% chance for a third fish (needs 2nd catch)", cost: 6e36, kind: "triple", amount: 0.9995 },
    { id: "triple49", name: "Beyond Apex Trident", desc: "99.96% chance for a third fish (needs 2nd catch)", cost: 3e37, kind: "triple", amount: 0.9996 },
    { id: "triple50", name: "Final Horizon Triad", desc: "99.97% chance for a third fish (needs 2nd catch)", cost: 1.5e38, kind: "triple", amount: 0.9997 },
    { id: "triple51", name: "True Ultimate Trident", desc: "99.98% chance for a third fish (needs 2nd catch)", cost: 7.5e38, kind: "triple", amount: 0.9998 },
    { id: "perfect1", name: "Steady Hands", desc: "+10% sell on perfect reels", cost: 1500, kind: "perfect", amount: 0.1 },
    { id: "perfect2", name: "Keen Eye", desc: "+15% sell on perfect reels", cost: 18000, kind: "perfect", amount: 0.15 },
    { id: "perfect3", name: "Timing Belt", desc: "+20% sell on perfect reels", cost: 150000, kind: "perfect", amount: 0.2 },
    { id: "perfect4", name: "Focus Lens", desc: "+25% sell on perfect reels", cost: 1500000, kind: "perfect", amount: 0.25 },
    { id: "perfect5", name: "Zen Pulse", desc: "+30% sell on perfect reels", cost: 15000000, kind: "perfect", amount: 0.3 },
    { id: "perfect6", name: "Apex Timing", desc: "+40% sell on perfect reels", cost: 120000000, kind: "perfect", amount: 0.4 },
    { id: "perfect7", name: "Zenith Focus", desc: "+50% sell on perfect reels", cost: 500000000, kind: "perfect", amount: 0.5 },
    { id: "perfect8", name: "Rift Timing", desc: "+55% sell on perfect reels", cost: 1200000000, kind: "perfect", amount: 0.55 },
    { id: "perfect9", name: "Quasar Focus", desc: "+60% sell on perfect reels", cost: 2500000000, kind: "perfect", amount: 0.6 },
    { id: "perfect10", name: "Eclipse Pulse", desc: "+70% sell on perfect reels", cost: 4500000000, kind: "perfect", amount: 0.7 },
    { id: "perfect11", name: "Helix Timing", desc: "+80% sell on perfect reels", cost: 8000000000, kind: "perfect", amount: 0.8 },
    { id: "perfect12", name: "Prism Focus", desc: "+90% sell on perfect reels", cost: 28000000000, kind: "perfect", amount: 0.9 },
    { id: "perfect13", name: "Chrono Pulse", desc: "+100% sell on perfect reels", cost: 90000000000, kind: "perfect", amount: 1 },
    { id: "perfect14", name: "Genesis Timing", desc: "+120% sell on perfect reels", cost: 300000000000, kind: "perfect", amount: 1.2 },
    { id: "perfect15", name: "Absolution Focus", desc: "+140% sell on perfect reels", cost: 1.2e12, kind: "perfect", amount: 1.4 },
    { id: "perfect16", name: "Omni Timing", desc: "+160% sell on perfect reels", cost: 6e12, kind: "perfect", amount: 1.6 },
    { id: "perfect17", name: "Paradox Focus", desc: "+185% sell on perfect reels", cost: 3e13, kind: "perfect", amount: 1.85 },
    { id: "perfect18", name: "Infinity Pulse", desc: "+210% sell on perfect reels", cost: 1.5e14, kind: "perfect", amount: 2.1 },
    { id: "perfect19", name: "Absolute Timing", desc: "+240% sell on perfect reels", cost: 8e14, kind: "perfect", amount: 2.4 },
    { id: "perfect20", name: "True Omni Focus", desc: "+280% sell on perfect reels", cost: 4e15, kind: "perfect", amount: 2.8 },
    { id: "perfect21", name: "Transcend Timing", desc: "+320% sell on perfect reels", cost: 2e16, kind: "perfect", amount: 3.2 },
    { id: "perfect22", name: "Nexus Focus", desc: "+370% sell on perfect reels", cost: 1e17, kind: "perfect", amount: 3.7 },
    { id: "perfect23", name: "Voidborn Pulse", desc: "+430% sell on perfect reels", cost: 5e17, kind: "perfect", amount: 4.3 },
    { id: "perfect24", name: "Zenith Focus Ultima", desc: "+500% sell on perfect reels", cost: 2.5e18, kind: "perfect", amount: 5 },
    { id: "perfect25", name: "Primordial Timing", desc: "+580% sell on perfect reels", cost: 1.2e19, kind: "perfect", amount: 5.8 },
    { id: "perfect26", name: "Sovereign Focus", desc: "+680% sell on perfect reels", cost: 6e19, kind: "perfect", amount: 6.8 },
    { id: "perfect27", name: "Mythos Pulse", desc: "+800% sell on perfect reels", cost: 3e20, kind: "perfect", amount: 8 },
    { id: "perfect28", name: "Finality Focus", desc: "+950% sell on perfect reels", cost: 1.5e21, kind: "perfect", amount: 9.5 },
    { id: "perfect29", name: "Crown Timing", desc: "+1100% sell on perfect reels", cost: 7.5e21, kind: "perfect", amount: 11 },
    { id: "perfect30", name: "Origin Focus", desc: "+1300% sell on perfect reels", cost: 4e22, kind: "perfect", amount: 13 },
    { id: "perfect31", name: "Aether Pulse", desc: "+1550% sell on perfect reels", cost: 2e23, kind: "perfect", amount: 15.5 },
    { id: "perfect32", name: "Radiant Focus", desc: "+1850% sell on perfect reels", cost: 1e24, kind: "perfect", amount: 18.5 },
    { id: "perfect33", name: "Dusk Timing", desc: "+2200% sell on perfect reels", cost: 5e24, kind: "perfect", amount: 22 },
    { id: "perfect34", name: "Apex Focus Ultima", desc: "+2700% sell on perfect reels", cost: 2.5e25, kind: "perfect", amount: 27 },
    { id: "perfect35", name: "Nova Pulse", desc: "+3300% sell on perfect reels", cost: 1.2e26, kind: "perfect", amount: 33 },
    { id: "perfect36", name: "Starborne Focus", desc: "+4000% sell on perfect reels", cost: 6e26, kind: "perfect", amount: 40 },
    { id: "perfect37", name: "Veil Timing", desc: "+5000% sell on perfect reels", cost: 3e27, kind: "perfect", amount: 50 },
    { id: "perfect38", name: "Mirage Focus", desc: "+6200% sell on perfect reels", cost: 1.5e28, kind: "perfect", amount: 62 },
    { id: "perfect39", name: "Empyrean Pulse", desc: "+7800% sell on perfect reels", cost: 7.5e28, kind: "perfect", amount: 78 },
    { id: "perfect40", name: "Horizon Focus", desc: "+10000% sell on perfect reels", cost: 3.8e29, kind: "perfect", amount: 100 },
    { id: "perfect41", name: "Aurora Timing", desc: "+12500% sell on perfect reels", cost: 1.9e30, kind: "perfect", amount: 125 },
    { id: "perfect42", name: "Fractal Focus", desc: "+15500% sell on perfect reels", cost: 9.5e30, kind: "perfect", amount: 155 },
    { id: "perfect43", name: "Dominion Pulse", desc: "+19500% sell on perfect reels", cost: 4.8e31, kind: "perfect", amount: 195 },
    { id: "perfect44", name: "Spectral Focus", desc: "+24500% sell on perfect reels", cost: 2.4e32, kind: "perfect", amount: 245 },
    { id: "perfect45", name: "Omega Origin Timing", desc: "+31000% sell on perfect reels", cost: 1.2e33, kind: "perfect", amount: 310 },
    { id: "perfect46", name: "Aurora Crown Focus", desc: "+39000% sell on perfect reels", cost: 6e33, kind: "perfect", amount: 390 },
    { id: "perfect47", name: "Fractal Spire Pulse", desc: "+49000% sell on perfect reels", cost: 3e34, kind: "perfect", amount: 490 },
    { id: "perfect48", name: "Dominion Timing", desc: "+62000% sell on perfect reels", cost: 1.5e35, kind: "perfect", amount: 620 },
    { id: "perfect49", name: "Spectral Veil Focus", desc: "+78000% sell on perfect reels", cost: 7.5e35, kind: "perfect", amount: 780 },
    { id: "perfect50", name: "Titan Reach Pulse", desc: "+98000% sell on perfect reels", cost: 3.8e36, kind: "perfect", amount: 980 },
    { id: "perfect51", name: "Dreamweave Timing", desc: "+125000% sell on perfect reels", cost: 1.9e37, kind: "perfect", amount: 1250 },
    { id: "perfect52", name: "Pantheon Focus", desc: "+155000% sell on perfect reels", cost: 9.5e37, kind: "perfect", amount: 1550 },
    { id: "perfect53", name: "Astral Crown Pulse", desc: "+195000% sell on perfect reels", cost: 4.8e38, kind: "perfect", amount: 1950 },
    { id: "perfect54", name: "Eternal Gate Timing", desc: "+245000% sell on perfect reels", cost: 2.4e39, kind: "perfect", amount: 2450 },
    { id: "perfect55", name: "True Omega Focus", desc: "+310000% sell on perfect reels", cost: 1.2e40, kind: "perfect", amount: 3100 },
    { id: "perfect56", name: "Sovereign Focus", desc: "+390000% sell on perfect reels", cost: 6e40, kind: "perfect", amount: 3900 },
    { id: "perfect57", name: "Celestial Timing", desc: "+490000% sell on perfect reels", cost: 3e41, kind: "perfect", amount: 4900 },
    { id: "perfect58", name: "Primordial Pulse", desc: "+620000% sell on perfect reels", cost: 1.5e42, kind: "perfect", amount: 6200 },
    { id: "perfect59", name: "Mythos Focus", desc: "+780000% sell on perfect reels", cost: 7.5e42, kind: "perfect", amount: 7800 },
    { id: "perfect60", name: "Continuum Timing", desc: "+980000% sell on perfect reels", cost: 3.8e43, kind: "perfect", amount: 9800 },
    { id: "perfect61", name: "Beyond Apex Focus", desc: "+1250000% sell on perfect reels", cost: 1.9e44, kind: "perfect", amount: 12500 },
    { id: "perfect62", name: "Final Horizon Pulse", desc: "+1550000% sell on perfect reels", cost: 9.5e44, kind: "perfect", amount: 15500 },
    { id: "perfect63", name: "True Ultimate Focus", desc: "+1950000% sell on perfect reels", cost: 4.8e45, kind: "perfect", amount: 19500 },
    // Looks — boost shiny + silver/gold/diamond/rainbow odds (stacks)
    { id: "looks1", name: "Gleam Hook", desc: "+20% shiny & variant odds", cost: 800, kind: "looks", amount: 0.2 },
    { id: "looks2", name: "Polish Lure", desc: "+30% shiny & variant odds", cost: 5000, kind: "looks", amount: 0.3 },
    { id: "looks3", name: "Shine Charm", desc: "+40% shiny & variant odds", cost: 28000, kind: "looks", amount: 0.4 },
    { id: "looks4", name: "Sparkle Bell", desc: "+50% shiny & variant odds", cost: 150000, kind: "looks", amount: 0.5 },
    { id: "looks5", name: "Prism Polish", desc: "+65% shiny & variant odds", cost: 900000, kind: "looks", amount: 0.65 },
    { id: "looks6", name: "Aurora Gleam", desc: "+80% shiny & variant odds", cost: 6e6, kind: "looks", amount: 0.8 },
    { id: "looks7", name: "Neon Sheen", desc: "+100% shiny & variant odds", cost: 4e7, kind: "looks", amount: 1 },
    { id: "looks8", name: "Mirage Shine", desc: "+120% shiny & variant odds", cost: 2.5e8, kind: "looks", amount: 1.2 },
    { id: "looks9", name: "Zenith Polish", desc: "+150% shiny & variant odds", cost: 1.5e9, kind: "looks", amount: 1.5 },
    { id: "looks10", name: "Galaxy Gleam", desc: "+180% shiny & variant odds", cost: 1e10, kind: "looks", amount: 1.8 },
    { id: "looks11", name: "Chrono Sheen", desc: "+220% shiny & variant odds", cost: 7e10, kind: "looks", amount: 2.2 },
    { id: "looks12", name: "Genesis Polish", desc: "+270% shiny & variant odds", cost: 5e11, kind: "looks", amount: 2.7 },
    { id: "looks13", name: "Singularity Shine", desc: "+320% shiny & variant odds", cost: 3.5e12, kind: "looks", amount: 3.2 },
    { id: "looks14", name: "Absolute Gleam", desc: "+380% shiny & variant odds", cost: 2.5e13, kind: "looks", amount: 3.8 },
    { id: "looks15", name: "Omni Polish", desc: "+450% shiny & variant odds", cost: 1.8e14, kind: "looks", amount: 4.5 },
    { id: "looks16", name: "Transcend Sheen", desc: "+550% shiny & variant odds", cost: 1.2e15, kind: "looks", amount: 5.5 },
    { id: "looks17", name: "Voidborn Gleam", desc: "+650% shiny & variant odds", cost: 8e15, kind: "looks", amount: 6.5 },
    { id: "looks18", name: "Crown Polish", desc: "+800% shiny & variant odds", cost: 6e16, kind: "looks", amount: 8 },
    { id: "looks19", name: "Apex Sheen", desc: "+1000% shiny & variant odds", cost: 4e17, kind: "looks", amount: 10 },
    { id: "looks20", name: "Celestial Gleam", desc: "+1200% shiny & variant odds", cost: 3e18, kind: "looks", amount: 12 },
    { id: "looks21", name: "Sovereign Shine", desc: "+1500% shiny & variant odds", cost: 2e19, kind: "looks", amount: 15 },
    { id: "looks22", name: "Primordial Polish", desc: "+1800% shiny & variant odds", cost: 1.5e20, kind: "looks", amount: 18 },
    { id: "looks23", name: "Ultimate Gleam", desc: "+2200% shiny & variant odds", cost: 1e21, kind: "looks", amount: 22 },
    { id: "looks24", name: "Mythos Gleam", desc: "+2700% shiny & variant odds", cost: 7e21, kind: "looks", amount: 27 },
    { id: "looks25", name: "Continuum Polish", desc: "+3300% shiny & variant odds", cost: 5e22, kind: "looks", amount: 33 },
    { id: "looks26", name: "Beyond Apex Sheen", desc: "+4000% shiny & variant odds", cost: 3.5e23, kind: "looks", amount: 40 },
    { id: "looks27", name: "Final Horizon Gleam", desc: "+5000% shiny & variant odds", cost: 2.5e24, kind: "looks", amount: 50 },
    { id: "looks28", name: "True Ultimate Shine", desc: "+6200% shiny & variant odds", cost: 1.8e25, kind: "looks", amount: 62 },
    { id: "looks29", name: "Empyrean Polish", desc: "+7800% shiny & variant odds", cost: 1.2e26, kind: "looks", amount: 78 },
    { id: "looks30", name: "Absolute Gleam Ultima", desc: "+10000% shiny & variant odds", cost: 8e26, kind: "looks", amount: 100 },
    // Fourth catch — needs a third fish on the same cast
    { id: "quad1", name: "Quad Hook", desc: "5% chance for a 4th fish (needs 3rd)", cost: 80000, kind: "quad", amount: 0.05 },
    { id: "quad2", name: "Quad Line", desc: "8% chance for a 4th fish (needs 3rd)", cost: 600000, kind: "quad", amount: 0.08 },
    { id: "quad3", name: "Quad Snare", desc: "11% chance for a 4th fish (needs 3rd)", cost: 5e6, kind: "quad", amount: 0.11 },
    { id: "quad4", name: "Cascade Quad", desc: "14% chance for a 4th fish (needs 3rd)", cost: 4e7, kind: "quad", amount: 0.14 },
    { id: "quad5", name: "Void Quad", desc: "18% chance for a 4th fish (needs 3rd)", cost: 3e8, kind: "quad", amount: 0.18 },
    { id: "quad6", name: "Apex Quad", desc: "22% chance for a 4th fish (needs 3rd)", cost: 2e9, kind: "quad", amount: 0.22 },
    { id: "quad7", name: "Zenith Quad", desc: "28% chance for a 4th fish (needs 3rd)", cost: 1.5e10, kind: "quad", amount: 0.28 },
    { id: "quad8", name: "Rift Quad", desc: "34% chance for a 4th fish (needs 3rd)", cost: 1e11, kind: "quad", amount: 0.34 },
    { id: "quad9", name: "Prism Quad", desc: "40% chance for a 4th fish (needs 3rd)", cost: 8e11, kind: "quad", amount: 0.4 },
    { id: "quad10", name: "Chrono Quad", desc: "46% chance for a 4th fish (needs 3rd)", cost: 6e12, kind: "quad", amount: 0.46 },
    { id: "quad11", name: "Genesis Quad", desc: "52% chance for a 4th fish (needs 3rd)", cost: 4e13, kind: "quad", amount: 0.52 },
    { id: "quad12", name: "Infinity Quad", desc: "58% chance for a 4th fish (needs 3rd)", cost: 3e14, kind: "quad", amount: 0.58 },
    { id: "quad13", name: "Absolute Quad", desc: "64% chance for a 4th fish (needs 3rd)", cost: 2e15, kind: "quad", amount: 0.64 },
    { id: "quad14", name: "Omni Quad", desc: "70% chance for a 4th fish (needs 3rd)", cost: 1.5e16, kind: "quad", amount: 0.7 },
    { id: "quad15", name: "Nexus Quad", desc: "75% chance for a 4th fish (needs 3rd)", cost: 1e17, kind: "quad", amount: 0.75 },
    { id: "quad16", name: "Voidborn Quad", desc: "80% chance for a 4th fish (needs 3rd)", cost: 7e17, kind: "quad", amount: 0.8 },
    { id: "quad17", name: "Crown Quad", desc: "84% chance for a 4th fish (needs 3rd)", cost: 5e18, kind: "quad", amount: 0.84 },
    { id: "quad18", name: "Apex Quad Ultima", desc: "88% chance for a 4th fish (needs 3rd)", cost: 3.5e19, kind: "quad", amount: 0.88 },
    { id: "quad19", name: "Celestial Quad", desc: "91% chance for a 4th fish (needs 3rd)", cost: 2.5e20, kind: "quad", amount: 0.91 },
    { id: "quad20", name: "Ultimate Quad", desc: "94% chance for a 4th fish (needs 3rd)", cost: 1.8e21, kind: "quad", amount: 0.94 },
    { id: "quad21", name: "Mythos Quad", desc: "95% chance for a 4th fish (needs 3rd)", cost: 1.2e22, kind: "quad", amount: 0.95 },
    { id: "quad22", name: "Continuum Quad", desc: "96% chance for a 4th fish (needs 3rd)", cost: 8e22, kind: "quad", amount: 0.96 },
    { id: "quad23", name: "Beyond Apex Quad", desc: "96.5% chance for a 4th fish (needs 3rd)", cost: 5e23, kind: "quad", amount: 0.965 },
    { id: "quad24", name: "Final Horizon Quad", desc: "97% chance for a 4th fish (needs 3rd)", cost: 3.5e24, kind: "quad", amount: 0.97 },
    { id: "quad25", name: "True Ultimate Quad", desc: "97.5% chance for a 4th fish (needs 3rd)", cost: 2.2e25, kind: "quad", amount: 0.975 },
    { id: "quad26", name: "Empyrean Quad", desc: "98% chance for a 4th fish (needs 3rd)", cost: 1.5e26, kind: "quad", amount: 0.98 },
    { id: "quad27", name: "Absolute Quad Ultima", desc: "98.5% chance for a 4th fish (needs 3rd)", cost: 1e27, kind: "quad", amount: 0.985 },
    // Chest finds — raise Coin/Luck chest odds
    { id: "chest1", name: "Beach Comb", desc: "+25% chest find odds", cost: 1200, kind: "chest", amount: 0.25 },
    { id: "chest2", name: "Tide Scoop", desc: "+40% chest find odds", cost: 9000, kind: "chest", amount: 0.4 },
    { id: "chest3", name: "Wreck Magnet", desc: "+55% chest find odds", cost: 55000, kind: "chest", amount: 0.55 },
    { id: "chest4", name: "Salvage Hook", desc: "+75% chest find odds", cost: 350000, kind: "chest", amount: 0.75 },
    { id: "chest5", name: "Treasure Sense", desc: "+100% chest find odds", cost: 2.2e6, kind: "chest", amount: 1 },
    { id: "chest6", name: "Gold Diviner", desc: "+130% chest find odds", cost: 1.5e7, kind: "chest", amount: 1.3 },
    { id: "chest7", name: "Relic Radar", desc: "+170% chest find odds", cost: 1e8, kind: "chest", amount: 1.7 },
    { id: "chest8", name: "Cache Compass", desc: "+220% chest find odds", cost: 7e8, kind: "chest", amount: 2.2 },
    { id: "chest9", name: "Vault Sniffer", desc: "+280% chest find odds", cost: 5e9, kind: "chest", amount: 2.8 },
    { id: "chest10", name: "Hoard Finder", desc: "+350% chest find odds", cost: 3.5e10, kind: "chest", amount: 3.5 },
    { id: "chest11", name: "Chrono Cache", desc: "+450% chest find odds", cost: 2.5e11, kind: "chest", amount: 4.5 },
    { id: "chest12", name: "Genesis Looter", desc: "+550% chest find odds", cost: 1.8e12, kind: "chest", amount: 5.5 },
    { id: "chest13", name: "Infinity Salvage", desc: "+700% chest find odds", cost: 1.2e13, kind: "chest", amount: 7 },
    { id: "chest14", name: "Absolute Magnet", desc: "+900% chest find odds", cost: 9e13, kind: "chest", amount: 9 },
    { id: "chest15", name: "Omni Diviner", desc: "+1100% chest find odds", cost: 6e14, kind: "chest", amount: 11 },
    { id: "chest16", name: "Nexus Radar", desc: "+1400% chest find odds", cost: 4e15, kind: "chest", amount: 14 },
    { id: "chest17", name: "Crown Cache", desc: "+1800% chest find odds", cost: 3e16, kind: "chest", amount: 18 },
    { id: "chest18", name: "Apex Salvage", desc: "+2300% chest find odds", cost: 2e17, kind: "chest", amount: 23 },
    { id: "chest19", name: "Celestial Finder", desc: "+3000% chest find odds", cost: 1.5e18, kind: "chest", amount: 30 },
    { id: "chest20", name: "Ultimate Hoard", desc: "+4000% chest find odds", cost: 1e19, kind: "chest", amount: 40 },
    { id: "chest21", name: "Mythos Finder", desc: "+5000% chest find odds", cost: 7e19, kind: "chest", amount: 50 },
    { id: "chest22", name: "Continuum Salvage", desc: "+6200% chest find odds", cost: 5e20, kind: "chest", amount: 62 },
    { id: "chest23", name: "Beyond Apex Cache", desc: "+7800% chest find odds", cost: 3.5e21, kind: "chest", amount: 78 },
    { id: "chest24", name: "Final Horizon Hoard", desc: "+10000% chest find odds", cost: 2.5e22, kind: "chest", amount: 100 },
    { id: "chest25", name: "True Ultimate Diviner", desc: "+12500% chest find odds", cost: 1.8e23, kind: "chest", amount: 125 },
    { id: "chest26", name: "Empyrean Magnet", desc: "+15500% chest find odds", cost: 1.2e24, kind: "chest", amount: 155 },
    { id: "chest27", name: "Absolute Finder Ultima", desc: "+19500% chest find odds", cost: 8e24, kind: "chest", amount: 195 },
    // Combo hold — longer perfect-combo timer
    { id: "combo1", name: "Rhythm Band", desc: "+5s combo hold", cost: 2500, kind: "combo", amount: 5 },
    { id: "combo2", name: "Pulse Bracelet", desc: "+8s combo hold", cost: 18000, kind: "combo", amount: 8 },
    { id: "combo3", name: "Beat Keeper", desc: "+12s combo hold", cost: 120000, kind: "combo", amount: 12 },
    { id: "combo4", name: "Flow Charm", desc: "+16s combo hold", cost: 800000, kind: "combo", amount: 16 },
    { id: "combo5", name: "Tempo Lens", desc: "+22s combo hold", cost: 5e6, kind: "combo", amount: 22 },
    { id: "combo6", name: "Cadence Hook", desc: "+28s combo hold", cost: 3.5e7, kind: "combo", amount: 28 },
    { id: "combo7", name: "Sync Bell", desc: "+35s combo hold", cost: 2.2e8, kind: "combo", amount: 35 },
    { id: "combo8", name: "Metronome Lure", desc: "+45s combo hold", cost: 1.5e9, kind: "combo", amount: 45 },
    { id: "combo9", name: "Zenith Rhythm", desc: "+55s combo hold", cost: 1e10, kind: "combo", amount: 55 },
    { id: "combo10", name: "Chrono Beat", desc: "+70s combo hold", cost: 7e10, kind: "combo", amount: 70 },
    { id: "combo11", name: "Genesis Tempo", desc: "+90s combo hold", cost: 5e11, kind: "combo", amount: 90 },
    { id: "combo12", name: "Infinity Flow", desc: "+110s combo hold", cost: 3.5e12, kind: "combo", amount: 110 },
    { id: "combo13", name: "Absolute Cadence", desc: "+140s combo hold", cost: 2.5e13, kind: "combo", amount: 140 },
    { id: "combo14", name: "Omni Metronome", desc: "+170s combo hold", cost: 1.8e14, kind: "combo", amount: 170 },
    { id: "combo15", name: "Nexus Sync", desc: "+210s combo hold", cost: 1.2e15, kind: "combo", amount: 210 },
    { id: "combo16", name: "Crown Rhythm", desc: "+260s combo hold", cost: 8e15, kind: "combo", amount: 260 },
    { id: "combo17", name: "Apex Tempo", desc: "+320s combo hold", cost: 6e16, kind: "combo", amount: 320 },
    { id: "combo18", name: "Celestial Beat", desc: "+400s combo hold", cost: 4e17, kind: "combo", amount: 400 },
    { id: "combo19", name: "Primordial Flow", desc: "+500s combo hold", cost: 3e18, kind: "combo", amount: 500 },
    { id: "combo20", name: "Ultimate Cadence", desc: "+650s combo hold", cost: 2e19, kind: "combo", amount: 650 },
    { id: "combo21", name: "Mythos Cadence", desc: "+800s combo hold", cost: 1.5e20, kind: "combo", amount: 800 },
    { id: "combo22", name: "Continuum Rhythm", desc: "+1000s combo hold", cost: 1e21, kind: "combo", amount: 1000 },
    { id: "combo23", name: "Beyond Apex Tempo", desc: "+1250s combo hold", cost: 7e21, kind: "combo", amount: 1250 },
    { id: "combo24", name: "Final Horizon Beat", desc: "+1550s combo hold", cost: 5e22, kind: "combo", amount: 1550 },
    { id: "combo25", name: "True Ultimate Flow", desc: "+1950s combo hold", cost: 3.5e23, kind: "combo", amount: 1950 },
    { id: "combo26", name: "Empyrean Metronome", desc: "+2450s combo hold", cost: 2.5e24, kind: "combo", amount: 2450 },
    { id: "combo27", name: "Absolute Cadence Ultima", desc: "+3100s combo hold", cost: 1.8e25, kind: "combo", amount: 3100 },
    // Fifth catch — needs a fourth fish on the same cast
    { id: "penta1", name: "Penta Hook", desc: "4% chance for a 5th fish (needs 4th)", cost: 250000, kind: "penta", amount: 0.04 },
    { id: "penta2", name: "Penta Line", desc: "7% chance for a 5th fish (needs 4th)", cost: 2e6, kind: "penta", amount: 0.07 },
    { id: "penta3", name: "Penta Snare", desc: "10% chance for a 5th fish (needs 4th)", cost: 1.5e7, kind: "penta", amount: 0.1 },
    { id: "penta4", name: "Cascade Penta", desc: "14% chance for a 5th fish (needs 4th)", cost: 1.2e8, kind: "penta", amount: 0.14 },
    { id: "penta5", name: "Void Penta", desc: "18% chance for a 5th fish (needs 4th)", cost: 9e8, kind: "penta", amount: 0.18 },
    { id: "penta6", name: "Apex Penta", desc: "22% chance for a 5th fish (needs 4th)", cost: 7e9, kind: "penta", amount: 0.22 },
    { id: "penta7", name: "Zenith Penta", desc: "28% chance for a 5th fish (needs 4th)", cost: 5e10, kind: "penta", amount: 0.28 },
    { id: "penta8", name: "Rift Penta", desc: "34% chance for a 5th fish (needs 4th)", cost: 3.5e11, kind: "penta", amount: 0.34 },
    { id: "penta9", name: "Prism Penta", desc: "40% chance for a 5th fish (needs 4th)", cost: 2.5e12, kind: "penta", amount: 0.4 },
    { id: "penta10", name: "Chrono Penta", desc: "46% chance for a 5th fish (needs 4th)", cost: 1.8e13, kind: "penta", amount: 0.46 },
    { id: "penta11", name: "Genesis Penta", desc: "52% chance for a 5th fish (needs 4th)", cost: 1.2e14, kind: "penta", amount: 0.52 },
    { id: "penta12", name: "Infinity Penta", desc: "58% chance for a 5th fish (needs 4th)", cost: 9e14, kind: "penta", amount: 0.58 },
    { id: "penta13", name: "Absolute Penta", desc: "64% chance for a 5th fish (needs 4th)", cost: 6e15, kind: "penta", amount: 0.64 },
    { id: "penta14", name: "Omni Penta", desc: "70% chance for a 5th fish (needs 4th)", cost: 4e16, kind: "penta", amount: 0.7 },
    { id: "penta15", name: "Nexus Penta", desc: "75% chance for a 5th fish (needs 4th)", cost: 3e17, kind: "penta", amount: 0.75 },
    { id: "penta16", name: "Crown Penta", desc: "80% chance for a 5th fish (needs 4th)", cost: 2e18, kind: "penta", amount: 0.8 },
    { id: "penta17", name: "Apex Penta Ultima", desc: "85% chance for a 5th fish (needs 4th)", cost: 1.5e19, kind: "penta", amount: 0.85 },
    { id: "penta18", name: "Celestial Penta", desc: "89% chance for a 5th fish (needs 4th)", cost: 1e20, kind: "penta", amount: 0.89 },
    { id: "penta19", name: "Primordial Penta", desc: "92% chance for a 5th fish (needs 4th)", cost: 7e20, kind: "penta", amount: 0.92 },
    { id: "penta20", name: "Ultimate Penta", desc: "95% chance for a 5th fish (needs 4th)", cost: 5e21, kind: "penta", amount: 0.95 },
    { id: "penta21", name: "Mythos Penta", desc: "96% chance for a 5th fish (needs 4th)", cost: 3.5e22, kind: "penta", amount: 0.96 },
    { id: "penta22", name: "Continuum Penta", desc: "96.5% chance for a 5th fish (needs 4th)", cost: 2.5e23, kind: "penta", amount: 0.965 },
    { id: "penta23", name: "Beyond Apex Penta", desc: "97% chance for a 5th fish (needs 4th)", cost: 1.8e24, kind: "penta", amount: 0.97 },
    { id: "penta24", name: "Final Horizon Penta", desc: "97.5% chance for a 5th fish (needs 4th)", cost: 1.2e25, kind: "penta", amount: 0.975 },
    { id: "penta25", name: "True Ultimate Penta", desc: "98% chance for a 5th fish (needs 4th)", cost: 8e25, kind: "penta", amount: 0.98 },
    { id: "penta26", name: "Empyrean Penta", desc: "98.5% chance for a 5th fish (needs 4th)", cost: 5.5e26, kind: "penta", amount: 0.985 },
    { id: "penta27", name: "Absolute Penta Ultima", desc: "99% chance for a 5th fish (needs 4th)", cost: 4e27, kind: "penta", amount: 0.99 }
  ];

  /**
   * Aquarium tank upgrades — one path, next-only, does not stack.
   * Level 0 = base tank. Each level replaces the previous drip/slots bonus.
   * Tuned as a mild passive (not a main money path).
   */
  const AQUARIUM_TIERS = [
    null,
    { name: "Bubble Stone", cost: 2500, amount: 0.1, slots: 0, desc: "+10% drip" },
    { name: "Coral Shelf", cost: 18000, amount: 0.15, slots: 1, desc: "+15% drip · +1 swim" },
    { name: "Filter Pump", cost: 95000, amount: 0.2, slots: 1, desc: "+20% drip · +1 swim" },
    { name: "Kelp Garden", cost: 550000, amount: 0.28, slots: 2, desc: "+28% drip · +2 swim" },
    { name: "Pearl Heater", cost: 3.2e6, amount: 0.35, slots: 2, desc: "+35% drip · +2 swim" },
    { name: "Reef Canopy", cost: 2e7, amount: 0.45, slots: 2, desc: "+45% drip · +2 swim" },
    { name: "Tide Aerator", cost: 1.2e8, amount: 0.55, slots: 3, desc: "+55% drip · +3 swim" },
    { name: "Glass Dome", cost: 7.5e8, amount: 0.7, slots: 3, desc: "+70% drip · +3 swim" },
    { name: "Abyss Filter", cost: 5e9, amount: 0.85, slots: 3, desc: "+85% drip · +3 swim" },
    { name: "Prism Tank", cost: 3.5e10, amount: 1, slots: 4, desc: "+100% drip · +4 swim" },
    { name: "Nebula Bubbler", cost: 2.5e11, amount: 1.2, slots: 4, desc: "+120% drip · +4 swim" },
    { name: "Horizon Aquarium", cost: 1.8e12, amount: 1.4, slots: 4, desc: "+140% drip · +4 swim" },
    { name: "Chrono Circulator", cost: 1.3e13, amount: 1.65, slots: 5, desc: "+165% drip · +5 swim" },
    { name: "Genesis Habitat", cost: 9e13, amount: 1.9, slots: 5, desc: "+190% drip · +5 swim" },
    { name: "Singularity Tank", cost: 6.5e14, amount: 2.2, slots: 5, desc: "+220% drip · +5 swim" },
    { name: "Absolute Exhibit", cost: 5e15, amount: 2.5, slots: 6, desc: "+250% drip · +6 swim" },
    { name: "Omni Reef", cost: 4e16, amount: 2.8, slots: 6, desc: "+280% drip · +6 swim" },
    { name: "Zenith Oceanarium", cost: 3.2e17, amount: 3.2, slots: 7, desc: "+320% drip · +7 swim" },
    { name: "Mythos Vivaria", cost: 2.5e18, amount: 3.6, slots: 7, desc: "+360% drip · +7 swim" },
    { name: "Omega Origin Tank", cost: 2e19, amount: 4, slots: 8, desc: "+400% drip · +8 swim" }
  ];
  const AQUARIUM_MAX_LEVEL = AQUARIUM_TIERS.length - 1;

  /**
   * One auto boat — hire + upgrade.
   * Fastest interval is 7.5s. Higher levels also roll multi-catches.
   * multi: [probability, fishCount] checked in order; leftover chance = 1 fish.
   */
  const BOAT_TIERS = [
    null,
    {
      name: "Canoe",
      interval: 15,
      cost: 12000,
      multi: [[0.25, 2]],
      multiHint: "25% chance for 2 fish"
    },
    {
      name: "Skiff",
      interval: 12,
      cost: 150000,
      multi: [
        [0.08, 3],
        [0.32, 2]
      ],
      multiHint: "32% for 2 fish · 8% for 3"
    },
    {
      name: "Trawler",
      interval: 9.5,
      cost: 1800000,
      multi: [
        [0.15, 3],
        [0.4, 2]
      ],
      multiHint: "40% for 2 fish · 15% for 3"
    },
    {
      name: "Harbor Boat",
      interval: 7.5,
      cost: 25000000,
      multi: [
        [0.05, 4],
        [0.25, 3],
        [0.7, 2]
      ],
      multiHint: "70% for 2 · 25% for 3 · 5% for 4"
    },
    {
      name: "Prism Yacht",
      interval: 7.5,
      cost: 500000000,
      multi: [
        [0.06, 5],
        [0.1, 4],
        [0.24, 3],
        [0.5, 2]
      ],
      multiHint: "50% for 2 · 24% for 3 · 10% for 4 · 6% for 5"
    },
    {
      name: "Genesis Fleet",
      interval: 7.5,
      cost: 8000000000,
      multi: [
        [0.05, 6],
        [0.08, 5],
        [0.12, 4],
        [0.25, 3],
        [0.4, 2]
      ],
      multiHint: "40% for 2 · 25% for 3 · 12% for 4 · 8% for 5 · 5% for 6"
    },
    {
      name: "Paradox Armada",
      interval: 7.5,
      cost: 2e14,
      multi: [
        [0.04, 7],
        [0.06, 6],
        [0.1, 5],
        [0.14, 4],
        [0.22, 3],
        [0.35, 2]
      ],
      multiHint: "35% for 2 · 22% for 3 · 14% for 4 · 10% for 5 · 6% for 6 · 4% for 7"
    },
    {
      name: "Absolute Carrier",
      interval: 7.5,
      cost: 5e15,
      multi: [
        [0.03, 8],
        [0.05, 7],
        [0.08, 6],
        [0.12, 5],
        [0.16, 4],
        [0.22, 3],
        [0.3, 2]
      ],
      multiHint: "30% for 2 · 22% for 3 · 16% for 4 · 12% for 5 · 8% for 6 · 5% for 7 · 3% for 8"
    },
    {
      name: "Zenith Fleet",
      interval: 7.5,
      cost: 2e17,
      multi: [
        [0.025, 9],
        [0.04, 8],
        [0.06, 7],
        [0.09, 6],
        [0.13, 5],
        [0.18, 4],
        [0.22, 3],
        [0.28, 2]
      ],
      multiHint: "28% for 2 · 22% for 3 · 18% for 4 · 13% for 5 · 9% for 6 · 6% for 7 · 4% for 8 · 2.5% for 9"
    },
    {
      name: "Origin Armada",
      interval: 7.5,
      cost: 8e19,
      multi: [
        [0.02, 10],
        [0.03, 9],
        [0.05, 8],
        [0.07, 7],
        [0.1, 6],
        [0.13, 5],
        [0.16, 4],
        [0.2, 3],
        [0.26, 2]
      ],
      multiHint: "26% for 2 · 20% for 3 · 16% for 4 · 13% for 5 · 10% for 6 · 7% for 7 · 5% for 8 · 3% for 9 · 2% for 10"
    },
    {
      name: "Nova Armada",
      interval: 7.5,
      cost: 4e22,
      multi: [
        [0.015, 11],
        [0.025, 10],
        [0.035, 9],
        [0.05, 8],
        [0.07, 7],
        [0.09, 6],
        [0.12, 5],
        [0.15, 4],
        [0.18, 3],
        [0.24, 2]
      ],
      multiHint: "24% for 2 · 18% for 3 · 15% for 4 · 12% for 5 · 9% for 6 · 7% for 7 · 5% for 8 · 3.5% for 9 · 2.5% for 10 · 1.5% for 11"
    },
    {
      name: "Starborne Carrier",
      interval: 7.5,
      cost: 2e25,
      multi: [
        [0.012, 12],
        [0.02, 11],
        [0.03, 10],
        [0.04, 9],
        [0.055, 8],
        [0.07, 7],
        [0.09, 6],
        [0.11, 5],
        [0.14, 4],
        [0.17, 3],
        [0.22, 2]
      ],
      multiHint: "22% for 2 · 17% for 3 · 14% for 4 · 11% for 5 · 9% for 6 · 7% for 7 · 5.5% for 8 · 4% for 9 · 3% for 10 · 2% for 11 · 1.2% for 12"
    },
    {
      name: "Veil Fleet",
      interval: 7.5,
      cost: 1e28,
      multi: [
        [0.01, 13],
        [0.015, 12],
        [0.022, 11],
        [0.03, 10],
        [0.04, 9],
        [0.05, 8],
        [0.065, 7],
        [0.08, 6],
        [0.1, 5],
        [0.13, 4],
        [0.16, 3],
        [0.2, 2]
      ],
      multiHint: "20% for 2 · 16% for 3 · 13% for 4 · 10% for 5 · 8% for 6 · 6.5% for 7 · 5% for 8 · 4% for 9 · 3% for 10 · 2.2% for 11 · 1.5% for 12 · 1% for 13"
    },
    {
      name: "Empyrean Armada",
      interval: 7.5,
      cost: 5e30,
      multi: [
        [0.008, 14],
        [0.012, 13],
        [0.018, 12],
        [0.025, 11],
        [0.035, 10],
        [0.045, 9],
        [0.055, 8],
        [0.07, 7],
        [0.085, 6],
        [0.1, 5],
        [0.12, 4],
        [0.15, 3],
        [0.18, 2]
      ],
      multiHint: "18% for 2 · 15% for 3 · 12% for 4 · 10% for 5 · 8.5% for 6 · 7% for 7 · 5.5% for 8 · 4.5% for 9 · 3.5% for 10 · 2.5% for 11 · 1.8% for 12 · 1.2% for 13 · 0.8% for 14"
    },
    {
      name: "Omega Origin Fleet",
      interval: 7.5,
      cost: 2.5e33,
      multi: [
        [0.006, 15],
        [0.01, 14],
        [0.014, 13],
        [0.02, 12],
        [0.028, 11],
        [0.038, 10],
        [0.048, 9],
        [0.06, 8],
        [0.075, 7],
        [0.09, 6],
        [0.11, 5],
        [0.13, 4],
        [0.16, 3],
        [0.2, 2]
      ],
      multiHint: "20% for 2 · 16% for 3 · 13% for 4 · 11% for 5 · 9% for 6 · 7.5% for 7 · 6% for 8 · 4.8% for 9 · 3.8% for 10 · 2.8% for 11 · 2% for 12 · 1.4% for 13 · 1% for 14 · 0.6% for 15"
    }
  ];
  const BOAT_MAX_LEVEL = BOAT_TIERS.length - 1;

  const coinCountEl = document.getElementById("coin-count");
  const spotLabelEl = document.getElementById("spot-label");
  const windowLabelEl = document.getElementById("window-label");
  const waitLabelEl = document.getElementById("wait-label");
  const luckLabelEl = document.getElementById("luck-label");
  const luckMaxLabelEl = document.getElementById("luck-max-label");
  const luckDialEl = document.getElementById("luck-dial");
  const sellLabelEl = document.getElementById("sell-label");
  const moneyChipEl = document.getElementById("money-chip");
  const moneyLabelEl = document.getElementById("money-label");
  const luckChipEl = document.getElementById("luck-boost-chip");
  const luckBoostLabelEl = document.getElementById("luck-boost-label");
  const eventChipEl = document.getElementById("event-chip");
  const eventLabelEl = document.getElementById("event-label");
  const eventBannerEl = document.getElementById("event-banner");
  const eventBannerTagEl = document.getElementById("event-banner-tag");
  const eventBannerTitleEl = document.getElementById("event-banner-title");
  const eventBannerTimeEl = document.getElementById("event-banner-time");
  const treasureStashEl = document.getElementById("treasure-stash");
  const moneyCountEl = document.getElementById("money-chest-count");
  const luckCountEl = document.getElementById("luck-chest-count");
  const moneyChestTimerEl = document.getElementById("money-chest-timer");
  const luckChestTimerEl = document.getElementById("luck-chest-timer");
  const moneyUseBtn = document.getElementById("money-chest-use-btn");
  const luckUseBtn = document.getElementById("luck-chest-use-btn");
  const moneyChestQtyEl = document.getElementById("money-chest-qty");
  const luckChestQtyEl = document.getElementById("luck-chest-qty");
  let moneyChestOpenQty = 1;
  let luckChestOpenQty = 1;
  const luckyBlockOverlay = document.getElementById("lucky-block-overlay");
  const luckyBlockCardEl = luckyBlockOverlay?.querySelector(".lucky-block-card") || null;
  const luckyBlockTitleEl = document.getElementById("lucky-block-title");
  const luckyBlockEyebrowEl = document.getElementById("lucky-block-eyebrow");
  const luckyBlockStatusEl = document.getElementById("lucky-block-status");
  const luckyBlockReelEl = document.getElementById("lucky-block-reel");
  const luckyBlockResultEl = document.getElementById("lucky-block-result");
  const luckyBlockChancesEl = document.getElementById("lucky-block-chances");
  const luckyBlockCloseBtn = document.getElementById("lucky-block-close");
  const luckyBlockDismissBtn = document.getElementById("lucky-block-dismiss-btn");
  const luckyBlockSpinBtn = document.getElementById("lucky-block-spin-btn");
  const luckyBlockSkipBtn = document.getElementById("lucky-block-skip-btn");
  const luckyBlockQtyEl = document.getElementById("lucky-block-qty");
  const luckyBlockChancesBtn = document.getElementById("lucky-block-chances-btn");
  const astralLuckyBlockCountEl = document.getElementById("astral-lucky-block-count");
  const astralLuckyBlockUseBtn = document.getElementById("astral-lucky-block-use-btn");
  const astralLuckyBlockRow = document.getElementById("astral-lucky-block-row");
  const absoluteLuckyBlockCountEl = document.getElementById("absolute-lucky-block-count");
  const absoluteLuckyBlockUseBtn = document.getElementById("absolute-lucky-block-use-btn");
  const absoluteLuckyBlockRow = document.getElementById("absolute-lucky-block-row");
  const zenithLuckyBlockCountEl = document.getElementById("zenith-lucky-block-count");
  const zenithLuckyBlockUseBtn = document.getElementById("zenith-lucky-block-use-btn");
  const zenithLuckyBlockRow = document.getElementById("zenith-lucky-block-row");
  let activeLuckyBlockType = "absolute";
  let luckyBlockSpinning = false;
  let luckyBlockSpinTimer = 0;
  let luckyBlockChancesOpen = false;
  let luckyBlockOpenQty = 1;
  let luckyBlockSkipAnim = false;
  let luckyBlockPendingFish = null;
  let luckyBlockPendingOffset = 0;
  const LB_REEL_ITEM_H = 72;
  const LB_REEL_VISIBLE = 3;
  const LB_REEL_LEN = 34;
  const LB_SPIN_MS = 4200;
  const multiLabelEl = document.getElementById("multi-label");
  const tripleLabelEl = document.getElementById("triple-label");
  const quadLabelEl = document.getElementById("quad-label");
  const pentaLabelEl = document.getElementById("penta-label");
  const looksLabelEl = document.getElementById("looks-label");
  const chestLabelEl = document.getElementById("chest-label");
  const comboHoldLabelEl = document.getElementById("combo-hold-label");
  const perfectLabelEl = document.getElementById("perfect-label");
  const coolerStatLabelEl = document.getElementById("cooler-stat-label");
  const boatsLabelEl = document.getElementById("boats-label");
  const boatTimersEl = document.getElementById("boat-timers");
  const boatBayEl = document.getElementById("boat-bay");
  const boatHaulEl = document.getElementById("boat-haul");
  const hudSpotEl = document.getElementById("hud-spot");
  const hudCoolerEl = document.getElementById("hud-cooler");
  const hudBestEl = document.getElementById("hud-best");
  const castBtn = document.getElementById("cast-btn");
  const castBtnText = document.getElementById("cast-btn-text");
  const biteFill = document.getElementById("bite-fill");
  const biteMeter = document.querySelector(".bite-meter");
  const catchLineEl = document.getElementById("catch-line");
  const bobber = document.getElementById("bobber");
  const catchSilEl = document.getElementById("catch-sil");
  const catchCardEl = document.getElementById("catch-card");
  const catchHaulEl = document.getElementById("catch-haul");
  const coolerList = document.getElementById("cooler-list");
  const coolerCountEl = document.getElementById("cooler-count");
  const coolerMaxEl = document.getElementById("cooler-max");
  const sellBtn = document.getElementById("sell-btn");
  const autoSellBox = document.getElementById("auto-sell-rarities");
  const shopList = document.getElementById("shop-list");
  const questList = document.getElementById("quest-list");
  const shopCats = document.getElementById("shop-cats");
  const spotList = document.getElementById("spot-list");
  const overlay = document.getElementById("overlay");
  const overlayBestEl = document.getElementById("overlay-best");
  const startBtn = document.getElementById("start-btn");
  const gamesBtn = document.getElementById("games-btn");
  const menuBtn = document.getElementById("menu-btn");
  const guideBtn = document.getElementById("guide-btn");
  const bookBtn = document.getElementById("book-btn");
  const suffixBtn = document.getElementById("suffix-btn");
  const shinyMachineBtn = document.getElementById("shiny-machine-btn");
  const menuGuideBtn = document.getElementById("menu-guide-btn");
  const menuBookBtn = document.getElementById("menu-book-btn");
  const menuSuffixBtn = document.getElementById("menu-suffix-btn");
  const menuShinyMachineBtn = document.getElementById("menu-shiny-machine-btn");
  const guideOverlay = document.getElementById("guide-overlay");
  const suffixOverlay = document.getElementById("suffix-overlay");
  const bookOverlay = document.getElementById("book-overlay");
  const shinyMachineOverlay = document.getElementById("shiny-machine-overlay");
  const shinyMachineCloseBtn = document.getElementById("shiny-machine-close");
  const shinyMachineClearBtn = document.getElementById("shiny-machine-clear");
  const shinyMachineRunBtn = document.getElementById("shiny-machine-run");
  const shinyMachineSlotsEl = document.getElementById("shiny-machine-slots");
  const shinyMachinePickerEl = document.getElementById("shiny-machine-picker");
  const shinyMachineChanceEl = document.getElementById("shiny-machine-chance");
  const shinyMachineStatusEl = document.getElementById("shiny-machine-status");
  /** Cooler indices selected for the Shiny Machine (0–2). */
  let shinyMachineSlots = [];
  let shinyMachineBusy = false;
  const adminOverlay = document.getElementById("admin-overlay");
  const settingsOverlay = document.getElementById("settings-overlay");
  const settingsBtn = document.getElementById("settings-btn");
  const settingsClose = document.getElementById("settings-close");
  const menuSettingsBtn = document.getElementById("menu-settings-btn");
  const settingsSoundEnabled = document.getElementById("settings-sound-enabled");
  const settingsVolume = document.getElementById("settings-volume");
  const settingsVolumePct = document.getElementById("settings-volume-pct");
  const settingsLightningFlash = document.getElementById("settings-lightning-flash");
  const settingsSfxEnabled = document.getElementById("settings-sfx-enabled");
  const settingsConfettiEnabled = document.getElementById("settings-confetti-enabled");
  const adminBtn = document.getElementById("admin-btn");
  const adminClose = document.getElementById("admin-close");
  const guideClose = document.getElementById("guide-close");
  const suffixClose = document.getElementById("suffix-close");
  const bookClose = document.getElementById("book-close");
  const guideBody = document.getElementById("guide-body");
  const guideVariantsBody = document.getElementById("guide-variants-body");
  const bookBody = document.getElementById("book-body");
  const bookInspectEl = document.getElementById("book-inspect");
  const bookInspectGlyphEl = document.getElementById("book-inspect-glyph");
  const bookInspectTitleEl = document.getElementById("book-inspect-title");
  const bookInspectMetaEl = document.getElementById("book-inspect-meta");
  const bookInspectHintEl = document.getElementById("book-inspect-hint");
  const bookInspectCloseBtn = document.getElementById("book-inspect-close");
  const bookInspectBackdrop = document.getElementById("book-inspect-backdrop");
  const bookInspectActionBtn = document.getElementById("book-inspect-action");
  let bookInspectCoolerIndex = -1;
  const bookFiltersEl = document.getElementById("book-filters");
  const bookProgressEl = document.getElementById("book-progress");
  const bookViewLabelEl = document.getElementById("book-view-label");
  const bookActiveBonusesEl = document.getElementById("book-active-bonuses");
  const collectionHudEl = document.getElementById("collection-hud");
  const collectionHudPctEl = document.getElementById("collection-hud-pct");
  const collectionHudFillEl = document.getElementById("collection-hud-fill");
  const collectionHudCountEl = document.getElementById("collection-hud-count");
  const collectionHudTiersEl = document.getElementById("collection-hud-tiers");
  let lastCollectionHudKey = "";
  const guideSpotMult = document.getElementById("guide-spot-mult");
  const guideSpotName = document.getElementById("guide-spot-name");
  const floatLayer = document.getElementById("float-layer");

  let state = defaultState();
  let sessionStarted = false;
  let lastSaveAt = 0;
  let lastSubmitAt = 0;
  let phase = "ready"; // ready | waiting | bite | result
  let waitTimer = null;
  let biteTimer = null;
  let biteEndsAt = 0;
  let boatAcc = {};
  let shopCat = "all";
  /** Expand state for SMART_GEAR_SHOP only — keys like "window:owned" / "luck:more". */
  const shopSmartExpand = Object.create(null);

  const SHOP_CATEGORIES = [
    {
      id: "window",
      title: "Rods",
      blurb: "Widen the reel window so bites are easier to hit."
    },
    {
      id: "speed",
      title: "Faster bites",
      blurb: "Bait that shortens wait time — own many, but equip only one at a time."
    },
    {
      id: "luck",
      title: "Luck",
      blurb: "Boost rarity odds toward rarer fish. Echo Charm can be bought forever."
    },
    {
      id: "cooler",
      title: "Cooler",
      blurb: "Hold more fish before you need to sell."
    },
    {
      id: "value",
      title: "Sell boost",
      blurb: "Earn more coins when you sell fish."
    },
    {
      id: "multi",
      title: "Second catch",
      blurb: "Nets — chance to land a second fish when you reel (not boats)."
    },
    {
      id: "triple",
      title: "Third catch",
      blurb: "Tridents — if a second fish lands, chance for a third on the same cast."
    },
    {
      id: "quad",
      title: "Fourth catch",
      blurb: "If a third fish lands, chance for a fourth on the same cast."
    },
    {
      id: "penta",
      title: "Fifth catch",
      blurb: "If a fourth fish lands, chance for a fifth on the same cast."
    },
    {
      id: "perfect",
      title: "Perfect pay",
      blurb: "Earn more when you sell fish caught on a perfect reel."
    },
    {
      id: "looks",
      title: "Looks",
      blurb: "Boost shiny and silver/gold/diamond/rainbow odds on every catch."
    },
    {
      id: "chest",
      title: "Chest finds",
      blurb: "Raise odds of finding Coin and Luck chests on a reel."
    },
    {
      id: "combo",
      title: "Combo hold",
      blurb: "Keep your perfect-reel combo alive longer between casts."
    },
    {
      id: "boat",
      title: "Auto boat",
      blurb: "One boat — upgrade for speed (min 7.5s) and multi-catch chances."
    }
  ];

  function defaultAutoSell() {
    const map = {};
    RARITIES.forEach((r) => {
      map[r] = false;
    });
    return map;
  }

  function defaultState() {
    const owned = {};
    GEAR.forEach((g) => {
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
      autoSellRarities: defaultAutoSell(),
      /** When true, mutated fish auto-sell with their rarity; off keeps them in the cooler. */
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
      lastTick: Date.now(),
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
      /** Player preference for smarter gear shop (ignored if SMART_GEAR_SHOP is false). */
      smartShop: true,
      /** Toast flags for catch-book collection rewards. */
      collectionLuckTold: false,
      collectionRainbowTold: false,
      collectionLbEventTold: false,
      collectionLbAlwaysTold: false,
      quests: { dailyKey: "", weeklyKey: "", daily: [], weekly: [] },
      echoLuckLevel: 0,
      echoLuckReset: ECHO_LUCK_RESET_ID,
      /** Active luck dial — null means follow max. */
      luckDial: null,
      luckDialFollowMax: true,
      /** Spot mastery: casts per spot id. */
      spotCasts: {},
      /** Weather cycle */
      weatherId: "none",
      weatherUntil: 0,
      /** Perfect reel combo */
      combo: 0,
      comboBoostUntil: 0,
      /** Aquarium drip accrual */
      aquariumBank: 0,
      aquariumLastTick: Date.now(),
      /** Cooler list controls */
      coolerSort: "value",
      coolerFilter: "all",
      coolerSearch: "",
      bookSearch: "",
      /** Pending offline haul claim */
      pendingOffline: null,
      /** Local community contribution toward the current meter */
      communityWeekKey: "",
      communityContrib: 0,
      /** Casts waiting to flush to Mantle while rate-limited / batched */
      communityPendingAdds: 0,
      /** Last community meter that granted an Astral LB */
      communityLbClaimedKey: "",
      /** Legacy wave id (migrated into claimedKey) */
      communityLbClaimedWave: 0
    };
  }

  function fishById(id) {
    return FISH.find((f) => f.id === id);
  }

  function currentSpot() {
    return SPOTS.find((s) => s.id === state.spotId) || SPOTS[0];
  }

  function ownedGear(kind) {
    return GEAR.filter((g) => g.kind === kind && state.owned[g.id]);
  }

  function bestOwnedSpeedId(ownedMap) {
    const owned = ownedMap || state.owned;
    const list = GEAR.filter((g) => g.kind === "speed" && owned[g.id]);
    if (!list.length) return "";
    list.sort((a, b) => b.amount - a.amount || a.cost - b.cost);
    return list[0].id;
  }

  function resolveEquippedSpeed(ownedMap, preferred) {
    const owned = ownedMap || state.owned;
    if (preferred && owned[preferred] && GEAR.some((g) => g.id === preferred && g.kind === "speed")) {
      return preferred;
    }
    return bestOwnedSpeedId(owned);
  }

  function equippedSpeedGear() {
    const id = resolveEquippedSpeed(state.owned, state.equippedSpeed);
    if (!id) return null;
    return GEAR.find((g) => g.id === id) || null;
  }

  function biteWindow() {
    const bonus = ownedGear("window").reduce((s, g) => s + g.amount, 0);
    return Math.min(5.5, 0.45 + bonus);
  }

  function waitScale() {
    const cut = equippedSpeedGear()?.amount || 0;
    return Math.max(0.002, 1 - cut);
  }

  function luckBonus() {
    return ownedGear("luck").reduce((s, g) => s + g.amount, 0);
  }

  /** Echo Charm: +0.0000001 luck (×2 each buy), cost ×3 each buy. Caps at 100M luck. */
  const ECHO_LUCK_ID = "luckEcho";
  const ECHO_LUCK_BASE = 0.0000001;
  const ECHO_LUCK_BASE_COST = 1;
  const ECHO_LUCK_COST_MULT = 3;
  const ECHO_LUCK_BONUS_CAP = 1e8; // 100M max from Echo Charm
  const ECHO_LUCK_MAX_LEVEL = Math.max(
    1,
    Math.ceil(1 + Math.log2(ECHO_LUCK_BONUS_CAP / ECHO_LUCK_BASE))
  );
  /** Each Echo buy slightly lifts rarer fish. Tiny step + hard cap so commons stay
   *  common and zenith stays rare (old 1.14^n drowned the table). */
  const ECHO_RARITY_STEP = 1.02;
  const ECHO_RARITY_EXTRA_CAP = 0.18;

  function echoLuckLevel() {
    return Math.max(
      0,
      Math.min(ECHO_LUCK_MAX_LEVEL, Math.floor(Number(state.echoLuckLevel) || 0))
    );
  }

  function echoLuckBonus() {
    const n = echoLuckLevel();
    if (n <= 0) return 0;
    const raw = ECHO_LUCK_BASE * Math.pow(2, n - 1);
    if (!Number.isFinite(raw) || raw <= 0) return 0;
    return Math.min(ECHO_LUCK_BONUS_CAP, raw);
  }

  function echoLuckAtCap() {
    return echoLuckBonus() >= ECHO_LUCK_BONUS_CAP - 1e-9;
  }

  function echoLuckNextBonus() {
    if (echoLuckAtCap()) return ECHO_LUCK_BONUS_CAP;
    const n = echoLuckLevel();
    if (n >= ECHO_LUCK_MAX_LEVEL) return echoLuckBonus();
    const raw = ECHO_LUCK_BASE * Math.pow(2, n);
    if (!Number.isFinite(raw) || raw <= 0) return echoLuckBonus();
    return Math.min(ECHO_LUCK_BONUS_CAP, raw);
  }

  function echoLuckCost() {
    if (echoLuckAtCap() || echoLuckLevel() >= ECHO_LUCK_MAX_LEVEL) return Infinity;
    const n = echoLuckLevel();
    const cost = ECHO_LUCK_BASE_COST * Math.pow(ECHO_LUCK_COST_MULT, n);
    return Number.isFinite(cost) ? cost : Infinity;
  }

  /** Additive luck stops changing relative odds once it dominates base weights.
   *  Echo Charm also multiplies rarer tiers so each buy still moves fish chances. */
  function echoRarityMult(rarity) {
    const echo = echoLuckBonus();
    if (!(echo > 0)) return 1;
    const skew = luckRaritySkew(rarity);
    if (skew <= 0) return 1;
    const steps = Math.log2(1 + echo / ECHO_LUCK_BASE);
    if (!Number.isFinite(steps) || steps <= 0) return 1;
    const curve = skew * skew;
    const m = Math.pow(ECHO_RARITY_STEP, steps * curve);
    if (!Number.isFinite(m) || m < 1) return 1;
    return Math.min(m, 1 + ECHO_RARITY_EXTRA_CAP * curve);
  }

  /** Spot luck — scales up on higher tiers (Creek = 0). */
  function spotLuckBonus(spot = currentSpot()) {
    const r = Math.max(0, Number(spot?.rarity) || 0);
    // r=5 → 375, r=10 → 1200, r=20 → 4200, r=31 Zenith Peak → 9579
    return Math.floor(9 * r * r + 30 * r);
  }

  /** Flat luck from gear + spot is tripled into the live luck stat. */
  const LUCK_STAT_MULT = 3;
  /** Catch-book discovery rewards (All discoveries, not variant filters). */
  const COLLECTION_MASTER_PCT = 0.7;
  const COLLECTION_LUCK_PCT = 0.75;
  const COLLECTION_LUCK_MULT = 1.5;
  const COLLECTION_RAINBOW_PCT = 0.8;
  const COLLECTION_RAINBOW_MULT = 2;
  const COLLECTION_LB_EVENT_PCT = 0.9;
  const COLLECTION_LB_EVENT_MULT = 1.25;
  const COLLECTION_LB_ALWAYS_PCT = 1;

  function collectionTiers() {
    return [
      {
        pct: COLLECTION_MASTER_PCT,
        label: "70%",
        title: "MASTER FISHER",
        hint: "100 Coin/Luck chest stash"
      },
      {
        pct: COLLECTION_LUCK_PCT,
        label: "75%",
        title: `${formatMult(COLLECTION_LUCK_MULT)}× luck`,
        hint: "all luck forever"
      },
      {
        pct: COLLECTION_RAINBOW_PCT,
        label: "80%",
        title: `${formatMult(COLLECTION_RAINBOW_MULT)}× rainbow`,
        hint: "rainbow variant chance"
      },
      {
        pct: COLLECTION_LB_EVENT_PCT,
        label: "90%",
        title: `${formatMult(COLLECTION_LB_EVENT_MULT)}× Lucky Blocks`,
        hint: "during Lucky Block events"
      },
      {
        pct: COLLECTION_LB_ALWAYS_PCT,
        label: "100%",
        title: "Lucky Blocks anytime",
        hint: "no event needed"
      }
    ];
  }

  function catchBookDiscoveryCount() {
    // Always overall base discoveries — ignore shiny/mutation book filters.
    return caughtCount("any", false, "");
  }

  function catchBookDiscoveryRatio() {
    if (!FISH.length) return 0;
    return catchBookDiscoveryCount() / FISH.length;
  }

  function hasCollectionLuckBonus() {
    return catchBookDiscoveryRatio() >= COLLECTION_LUCK_PCT;
  }

  function hasCollectionRainbowBonus() {
    return catchBookDiscoveryRatio() >= COLLECTION_RAINBOW_PCT;
  }

  function hasCollectionLbEventBonus() {
    return catchBookDiscoveryRatio() >= COLLECTION_LB_EVENT_PCT;
  }

  function hasCollectionLbAlwaysBonus() {
    return catchBookDiscoveryRatio() >= COLLECTION_LB_ALWAYS_PCT;
  }

  /** 1.5× all luck once 75% of the catch book is discovered. */
  function collectionLuckMult() {
    return hasCollectionLuckBonus() ? COLLECTION_LUCK_MULT : 1;
  }

  /** 2× rainbow share among primary variants at 80%. */
  function collectionRainbowMult() {
    return hasCollectionRainbowBonus() ? COLLECTION_RAINBOW_MULT : 1;
  }

  /** 1.25× Lucky Block drop rate during LB events at 90%. */
  function collectionLbEventMult() {
    return hasCollectionLbEventBonus() ? COLLECTION_LB_EVENT_MULT : 1;
  }

  /** Raw luck before chests/events: (gear + current spot) × 3 × collection + Echo Charm. */
  function maxBaseLuck(spot = currentSpot()) {
    return (
      (Math.max(0, luckBonus()) + spotLuckBonus(spot) + spotMasteryLuckBonus(spot)) *
        LUCK_STAT_MULT *
        collectionLuckMult() *
        communityLuckMult() +
      echoLuckBonus() +
      comboLuckBonus()
    );
  }

  function clampLuckDial(value, max) {
    const m = Math.max(0, Number(max) || 0);
    if (m <= 0) return 0;
    const min = Math.min(1, m);
    let v = Number(value);
    if (!Number.isFinite(v)) return m;
    return Math.min(m, Math.max(min, v));
  }

  /** Active luck used for fishing — between 1 and your current max (or max if dial follows). */
  function baseLuck(spot = currentSpot()) {
    const max = maxBaseLuck(spot);
    if (max <= 0) return 0;
    if (state.luckDialFollowMax || state.luckDial == null) return max;
    return clampLuckDial(state.luckDial, max);
  }

  function setLuckDial(raw) {
    const max = maxBaseLuck();
    if (max <= 0) {
      state.luckDial = 0;
      state.luckDialFollowMax = true;
      return;
    }
    const next = clampLuckDial(raw, max);
    state.luckDial = next;
    state.luckDialFollowMax = next >= max * 0.999999;
    if (state.luckDialFollowMax) state.luckDial = max;
  }

  /**
   * Luck used for HUD + chest odds: (gear + spot) × chest/event mult.
   * Fish rarity odds use baseLuck + a separate rarity skew from treasureLuckMult
   * (see fishWeight) so 100× luck actually improves ultra-rares ~100×.
   */
  function effectiveLuckBonus(spot = currentSpot()) {
    return baseLuck(spot) * treasureLuckMult();
  }

  /** Same as effective luck (gear + spot, then × boosts). */
  function totalLuckBonus() {
    return effectiveLuckBonus();
  }

  /** How strongly a luck mult shifts weight toward this rarity (common=0 … top=1). */
  function luckRaritySkew(rarity) {
    const rank = RARITY_RANK[rarity] || 1;
    const topName = RARITIES[RARITIES.length - 1];
    const top = RARITY_RANK[topName] || rank;
    return Math.max(0, Math.min(1, (rank - 1) / Math.max(1, top - 1)));
  }

  /**
   * Luck tilts the fish table:
   * higher luck → commons/uncommons get rarer, high tiers get less rare.
   * Dialing luck down reverses that.
   */
  function luckWeightMult(rarity, luck) {
    const L = Math.max(0, Number(luck) || 0);
    const skew = luckRaritySkew(rarity); // 0 = common … 1 = top
    const rank = RARITY_RANK[rarity] || 1;

    // How hard luck pushes the table (0 at no luck, soft-caps high)
    // L≈1 → 0.2 · L≈10 → 0.7 · L≈50 → 1.1 · L≈500 → 1.6 · L≈5000 → 2.0
    const tilt = Math.log10(1 + L * 4.5) / 2.15;

    // Commons / uncommons: strong at low luck, suppressed as luck rises
    if (rank <= 2) {
      const flood = (rank === 1 ? 3.6 : 1.9) / (1 + L / 12);
      // Active suppress so high luck actually makes them rarer (not just "less boosted")
      const suppress = Math.pow(1 + tilt, -(1.15 + (3 - rank) * 0.35));
      const m = (1 + flood) * suppress;
      if (!Number.isFinite(m) || m <= 0) return 0.04;
      return Math.min(20, Math.max(0.04, m));
    }

    // Mid + high tiers: locked at low luck, unlocked and lifted as luck rises
    const gate = 5 + skew * skew * 170;
    const unlock = Math.pow(L / (L + gate), 0.9 + skew * 0.95);
    const floor = Math.pow(0.008, 0.22 + skew * 0.82);
    let m = floor + (1 - floor) * unlock;

    // Extra lift for rarer fish — higher luck = less rare
    // Pivot so mid tiers stay near-neutral while top tiers climb hard
    const signed = (skew - 0.28) * 2.2;
    m *= Math.pow(1 + tilt, Math.max(0, signed) * 1.35);
    // Mild suppress for low-mid (rare/epic) as luck gets very high
    if (signed < 0) {
      m *= Math.pow(1 + tilt, signed * 0.85);
    }

    if (!Number.isFinite(m) || m <= 0) return floor;
    return Math.min(1e9, Math.max(floor, m));
  }

  function coolerMax() {
    return COOLER_BASE + ownedGear("cooler").reduce((s, g) => s + g.amount, 0);
  }

  function sellBonus() {
    return ownedGear("value").reduce((s, g) => s + g.amount, 0);
  }

  const COMMUNITY_API = "https://mantledb.sh/v2/icedragon1st-mygames/fishing-community";
  const COMMUNITY_DOC = "fishing-community";
  const COMMUNITY_PAGES_URL = "community.json";
  const COMMUNITY_TOKEN = "ice-fish-com-9f3a";
  const COMMUNITY_GOAL = 2500;
  const COMMUNITY_REWARD_MS = 30 * 60 * 1000;
  const COMMUNITY_REWARD_MULT = 2;
  /** Min gap between Mantle round-trips (namespace is tightly rate-limited). */
  const COMMUNITY_SYNC_GAP_MS = 120_000;
  const COMMUNITY_POLL_MS = 180_000;
  const COMMUNITY_FLUSH_CASTS = 12;
  const COMMUNITY_RATE_BACKOFF_MS = 20 * 60 * 1000;

  let communityCache = {
    weekKey: "",
    total: 0,
    goal: COMMUNITY_GOAL,
    rewardUntil: 0,
    rewardMult: COMMUNITY_REWARD_MULT,
    lbWave: 0
  };
  let communityFetchAt = 0;
  let communityRateLimitedUntil = 0;
  let communitySyncTimer = 0;
  let communitySyncInFlight = false;
  const OFFLINE_CLAIM_BONUS_MS = 90 * 1000;
  const OFFLINE_CLAIM_BONUS = 0.25;
  const SPOT_MASTERY_PER = 40;
  const SPOT_MASTERY_MAX = 25;
  const WEATHER_MS = 5 * 60 * 1000;
  /** 40% of periods have weather; when they do, 50/50 storm vs calm. */
  const WEATHER_CHANCE = 0.4;
  const WEATHER_KINDS = {
    none: { id: "none", label: "Clear", wait: 1, rare: 1 },
    clear: { id: "none", label: "Clear", wait: 1, rare: 1 },
    calm: { id: "calm", label: "Calm seas", wait: 0.7, rare: 0.92 },
    storm: { id: "storm", label: "Storm", wait: 1.18, rare: 1.65 }
  };
  const WEATHER_ACTIVE = ["storm", "calm"];

  function weatherSlotHash(slot) {
    let x = Math.imul(Math.floor(Number(slot) || 0) ^ 0x9e3779b9, 0x85ebca6b) >>> 0;
    x ^= x >>> 13;
    x = Math.imul(x, 0xc2b2ae35) >>> 0;
    x ^= x >>> 16;
    return x >>> 0;
  }

  function rollWeatherIdForSlot(slot) {
    const h = weatherSlotHash(slot);
    // First roll: 40% chance weather triggers
    if ((h % 1000) / 1000 >= WEATHER_CHANCE) return "none";
    // Second roll: 50/50 between active weathers
    return WEATHER_ACTIVE[(h >>> 10) % WEATHER_ACTIVE.length] || "storm";
  }

  function spotMasteryCasts(spotId = state.spotId) {
    return Math.max(0, Math.floor(Number(state.spotCasts?.[spotId]) || 0));
  }

  function spotMasteryLevel(spotId = state.spotId) {
    return Math.min(SPOT_MASTERY_MAX, Math.floor(spotMasteryCasts(spotId) / SPOT_MASTERY_PER));
  }

  function spotMasterySellBonus(spot = currentSpot()) {
    return spotMasteryLevel(spot?.id) * 0.015;
  }

  function spotMasteryLuckBonus(spot = currentSpot()) {
    return spotMasteryLevel(spot?.id) * 10;
  }

  function noteSpotCast(spotId = state.spotId, n = 1) {
    if (!spotId) return;
    if (!state.spotCasts || typeof state.spotCasts !== "object") state.spotCasts = {};
    state.spotCasts[spotId] = spotMasteryCasts(spotId) + Math.max(1, Math.floor(n));
  }

  function weatherDef(id = state.weatherId) {
    const key = id === "clear" || id === "fog" || id === "tide" || !id ? "none" : id;
    return WEATHER_KINDS[key] || WEATHER_KINDS.none;
  }

  function normalizeAdminWeatherId(raw) {
    const s = String(raw || "")
      .trim()
      .toLowerCase();
    if (s === "storm" || s === "rain" || s === "thunder") return "storm";
    if (s === "calm" || s === "sea" || s === "seas") return "calm";
    if (s === "none" || s === "clear" || s === "off" || s === "sunny") return "none";
    return "";
  }

  function ensureWeather(now = Date.now()) {
    const admin = adminWeatherEventLive(now);
    if (admin) {
      state.weatherId = admin.weatherId;
      state.weatherUntil = admin.until;
      return weatherDef(admin.weatherId);
    }
    const slot = Math.floor(now / WEATHER_MS);
    const until = slot * WEATHER_MS + WEATHER_MS;
    const rolled = rollWeatherIdForSlot(slot);
    state.weatherId = rolled;
    state.weatherUntil = until;
    return weatherDef();
  }

  function weatherRareMult() {
    return Number(ensureWeather().rare) || 1;
  }

  function weatherWaitMult() {
    return Number(ensureWeather().wait) || 1;
  }

  function adminSpeedMult(now = Date.now()) {
    const e = typeof adminSpeedEventLive === "function" ? adminSpeedEventLive(now) : null;
    return e ? Math.max(1, Number(e.mult) || 1) : 1;
  }

  /** 2× speed => half wait / half catch hold. */
  function adminWaitFactor(now = Date.now()) {
    return 1 / adminSpeedMult(now);
  }

  function catchResultHoldMs(baseMs) {
    return Math.max(280, Math.round(Number(baseMs) * adminWaitFactor()));
  }

  function syncAdminSpeedFx() {
    const m = adminSpeedMult();
    const dur = Math.max(0.22, 0.7 / m);
    try {
      document.documentElement.style.setProperty("--catch-sil-dur", `${dur.toFixed(3)}s`);
    } catch {}
    castBtn?.classList.toggle("admin-speed", m > 1 + 1e-9);
  }

  function comboActive(now = Date.now()) {
    clearExpiredCombo(now);
    return (state.combo || 0) > 0 && (state.comboBoostUntil || 0) > now;
  }

  function clearExpiredCombo(now = Date.now()) {
    if ((state.combo || 0) > 0 && (state.comboBoostUntil || 0) <= now) {
      state.combo = 0;
      state.comboBoostUntil = 0;
      saveSoon();
    }
  }

  function comboLuckBonus(now = Date.now()) {
    if (!comboActive(now)) return 0;
    return Math.min(12, state.combo) * 18;
  }

  function comboMultiBonus(now = Date.now()) {
    if (!comboActive(now)) return 0;
    return Math.min(12, state.combo) * 0.015;
  }

  function notePerfectCombo(perfect) {
    if (perfect) {
      state.combo = Math.min(99, (state.combo || 0) + 1);
      state.comboBoostUntil = Date.now() + comboHoldMs();
    } else {
      state.combo = 0;
      state.comboBoostUntil = 0;
    }
  }

  /** Base 45s + combo gear seconds (capped). */
  function comboHoldMs() {
    const extraSec = ownedGear("combo").reduce((s, g) => s + (Number(g.amount) || 0), 0);
    return 45_000 + Math.min(2_500_000, Math.max(0, extraSec) * 1000);
  }

  function communityWeekKey(now = Date.now()) {
    const d = new Date(now);
    const day = d.getDay(); // 0 Sun .. 6 Sat
    // Weekend window: Friday 0:00 → Sunday end (treat Fri=5,Sat=6,Sun=0 as same week key from Friday)
    const offset = day === 0 ? -2 : day === 6 ? -1 : day === 5 ? 0 : -(day + 2);
    const fri = new Date(d.getFullYear(), d.getMonth(), d.getDate() + offset);
    return `${fri.getFullYear()}-${fri.getMonth() + 1}-${fri.getDate()}`;
  }

  function communityWeekendLive(now = Date.now()) {
    const day = new Date(now).getDay();
    return day === 5 || day === 6 || day === 0;
  }

  function communityRewardLive(now = Date.now()) {
    const until = clampCommunityRewardUntil(communityCache.rewardUntil, communityCache.lbWave, now);
    return until > now;
  }

  function communityMeterFinished(cache = communityCache) {
    const goal = Math.max(1, Number(cache.goal) || COMMUNITY_GOAL);
    const total = Math.max(0, Number(cache.total) || 0);
    return total >= goal && Math.max(0, Number(cache.lbWave) || 0) > 0;
  }

  /** Incomplete meters stay open every day; after a finish, a new meter starts once the luck reward ends. */
  function communityAcceptsCasts(now = Date.now()) {
    // Only pause contributions during the active post-goal luck reward window.
    if (communityRewardLive(now) && communityMeterFinished()) return false;
    return true;
  }

  function communityLuckMult(now = Date.now()) {
    if (!communityRewardLive(now)) return 1;
    return clampCommunityRewardMult(communityCache.rewardMult);
  }

  function clampCommunityRewardMult(n) {
    const x = Number(n);
    if (!Number.isFinite(x) || x < 1) return COMMUNITY_REWARD_MULT;
    return Math.min(10, x);
  }

  /** Reward window is one shot from completion — never longer than COMMUNITY_REWARD_MS. */
  function clampCommunityRewardUntil(rewardUntil, lbWave, now = Date.now()) {
    let until = Math.max(0, Number(rewardUntil) || 0);
    const wave = Math.max(0, Number(lbWave) || 0);
    if (wave > 1e12) {
      // lbWave stored as completion timestamp
      until = Math.min(until, wave + COMMUNITY_REWARD_MS);
    } else if (until > now + COMMUNITY_REWARD_MS) {
      until = now + COMMUNITY_REWARD_MS;
    }
    return Math.max(0, until);
  }

  function communityRateLimited(now = Date.now()) {
    return now < communityRateLimitedUntil;
  }

  function markCommunityRateLimited(ms = COMMUNITY_RATE_BACKOFF_MS) {
    communityRateLimitedUntil = Date.now() + Math.max(60_000, ms);
  }

  function clearCommunityRateLimited() {
    communityRateLimitedUntil = 0;
  }

  function normalizeCommunityDoc(raw, fallbackKey = "") {
    if (!raw || typeof raw !== "object") return null;
    if (raw.error) return null;
    const lbWave = Math.max(0, Math.floor(Number(raw.lbWave) || 0));
    return {
      weekKey: String(raw.weekKey || fallbackKey || ""),
      total: Math.max(0, Math.floor(Number(raw.total) || 0)),
      goal: Math.max(500, Math.floor(Number(raw.goal) || COMMUNITY_GOAL)),
      rewardUntil: clampCommunityRewardUntil(Number(raw.rewardUntil) || 0, lbWave),
      rewardMult: clampCommunityRewardMult(raw.rewardMult),
      lbWave
    };
  }

  function pickBetterCommunityDoc(a, b) {
    if (!a) return b || null;
    if (!b) return a;
    const aFin = a.total >= a.goal && a.lbWave > 0;
    const bFin = b.total >= b.goal && b.lbWave > 0;
    // Prefer an active reward window.
    if (a.rewardUntil > Date.now() && !(b.rewardUntil > Date.now())) return a;
    if (b.rewardUntil > Date.now() && !(a.rewardUntil > Date.now())) return b;
    // Prefer unfinished meters with more progress.
    if (!aFin && !bFin) {
      if (a.total !== b.total) return a.total > b.total ? a : b;
      return (a.weekKey || "").length >= (b.weekKey || "").length ? a : b;
    }
    // Prefer unfinished over finished+expired.
    if (!aFin && bFin && b.rewardUntil <= Date.now()) return a;
    if (!bFin && aFin && a.rewardUntil <= Date.now()) return b;
    if (a.lbWave !== b.lbWave) return a.lbWave > b.lbWave ? a : b;
    return a.total >= b.total ? a : b;
  }

  async function fetchCommunityJson(url, { trackRate = false } = {}) {
    try {
      const res = await fetch(`${url}${url.includes("?") ? "&" : "?"}t=${Date.now()}`, {
        cache: "no-store"
      });
      if (res.status === 429) {
        if (trackRate) markCommunityRateLimited();
        return { rateLimited: true, found: false, data: null, ok: false };
      }
      if (res.status === 404) return { rateLimited: false, found: false, data: null, ok: true };
      if (!res.ok) return { rateLimited: false, found: false, data: null, ok: false };
      const data = await res.json();
      if (data && typeof data === "object" && data.error) {
        if (/rate limit/i.test(String(data.error) + String(data.message || ""))) {
          if (trackRate) markCommunityRateLimited();
          return { rateLimited: true, found: false, data: null, ok: false };
        }
        return { rateLimited: false, found: false, data: null, ok: false };
      }
      return { rateLimited: false, found: true, data, ok: true };
    } catch {
      return { rateLimited: false, found: false, data: null, ok: false };
    }
  }

  /** @returns {{ found: boolean, data?: object } | null} null = request failed (do not treat as empty). */
  async function fetchCommunityDoc() {
    const pages = await fetchCommunityJson(COMMUNITY_PAGES_URL, { trackRate: false });
    let sbDoc = null;
    const api = fishingSb();
    if (api) {
      try {
        const raw = await api.getDoc(COMMUNITY_DOC);
        if (raw && typeof raw === "object") sbDoc = normalizeCommunityDoc(raw);
      } catch {
        /* fall through */
      }
    }
    let mantle = { rateLimited: false, found: false, data: null, ok: false };
    if (!sbDoc && !communityRateLimited()) {
      mantle = await fetchCommunityJson(COMMUNITY_API, { trackRate: true });
      if (mantle.ok && !mantle.rateLimited) clearCommunityRateLimited();
    }
    const pagesDoc = pages.found ? normalizeCommunityDoc(pages.data) : null;
    const mantleDoc = mantle.found ? normalizeCommunityDoc(mantle.data) : null;

    if (sbDoc) {
      return { found: true, data: pickBetterCommunityDoc(sbDoc, pagesDoc) || sbDoc };
    }

    if (mantleDoc) {
      return { found: true, data: pickBetterCommunityDoc(mantleDoc, pagesDoc) || mantleDoc };
    }

    // Mantle down / rate-limited: keep the last good cache so Pages can't wipe progress.
    if (mantle.rateLimited || !mantle.ok) {
      if (communityCache.weekKey || communityCache.total || communityCache.lbWave) {
        return {
          found: true,
          data: normalizeCommunityDoc(communityCache, communityCache.weekKey)
        };
      }
      if (pagesDoc) return { found: true, data: pagesDoc };
      return null;
    }

    // Mantle reachable but empty
    if (pagesDoc) return { found: true, data: pagesDoc };
    if (pages.ok || mantle.ok) return { found: false };
    return null;
  }

  async function pushCommunityDoc(doc) {
    const payload = { ...doc, token: COMMUNITY_TOKEN };
    let ok = false;
    const api = fishingSb();
    if (api) {
      try {
        await api.upsertDoc(COMMUNITY_DOC, payload);
        ok = true;
      } catch {
        /* try Mantle */
      }
    }
    if (communityRateLimited() && ok) return true;
    if (communityRateLimited()) return ok;
    try {
      const res = await fetch(COMMUNITY_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (res.status === 429) {
        markCommunityRateLimited();
        return ok;
      }
      if (!res.ok) return ok;
      clearCommunityRateLimited();
      return true;
    } catch {
      return ok;
    }
  }

  function communityDisplayTotal() {
    const base = Math.max(0, Number(communityCache.total) || 0);
    const pending = Math.max(0, Math.floor(Number(state.communityPendingAdds) || 0));
    if (communityMeterFinished() && communityRewardLive()) return base;
    return base + pending;
  }

  /** Queue a cast locally; Mantle is flushed in batches to survive rate limits. */
  function noteCommunityCast() {
    if (!communityAcceptsCasts()) return;
    // Local restart if reward already ended but Mantle hasn't cleared yet.
    if (communityMeterFinished() && !communityRewardLive()) {
      communityCache = {
        weekKey: `${communityWeekKey()}-local-${Date.now()}`,
        total: 0,
        goal: Math.max(500, Number(communityCache.goal) || COMMUNITY_GOAL),
        rewardUntil: 0,
        rewardMult: clampCommunityRewardMult(communityCache.rewardMult),
        lbWave: 0
      };
      state.communityWeekKey = communityCache.weekKey;
      state.communityContrib = 0;
      state.communityPendingAdds = 0;
    }
    state.communityPendingAdds = Math.max(0, Math.floor(Number(state.communityPendingAdds) || 0)) + 1;
    state.communityContrib = Math.max(0, Math.floor(Number(state.communityContrib) || 0)) + 1;
    saveSoon();
    const pending = state.communityPendingAdds;
    if (pending >= COMMUNITY_FLUSH_CASTS) {
      syncCommunity(true).catch(() => {});
    } else {
      scheduleCommunitySync();
    }
  }

  function scheduleCommunitySync() {
    if (communitySyncTimer) return;
    communitySyncTimer = setTimeout(() => {
      communitySyncTimer = 0;
      syncCommunity(false).catch(() => {});
    }, Math.min(COMMUNITY_SYNC_GAP_MS, 45_000));
  }

  async function syncCommunity(force = false) {
    if (communitySyncInFlight) {
      if (force) scheduleCommunitySync();
      return communityCache;
    }
    const now = Date.now();
    const pending = Math.max(0, Math.floor(Number(state.communityPendingAdds) || 0));
    if (
      !force &&
      !pending &&
      now - communityFetchAt < COMMUNITY_SYNC_GAP_MS
    ) {
      return communityCache;
    }
    if (!force && communityRateLimited(now) && pending < COMMUNITY_FLUSH_CASTS) {
      // Keep local UI moving; try again later.
      applyCommunityOfflineTick(pending);
      scheduleCommunitySync();
      return communityCache;
    }

    communitySyncInFlight = true;
    try {
      const calendarWeek = communityWeekKey();
      const fetched = await fetchCommunityDoc();
      if (!fetched) {
        applyCommunityOfflineTick(pending);
        scheduleCommunitySync();
        tryClaimCommunityAstral();
        return communityCache;
      }

      const remote = fetched.found && fetched.data ? fetched.data : {};
      let total = Math.max(0, Math.floor(Number(remote.total) || 0));
      let lbWave = Math.max(0, Math.floor(Number(remote.lbWave) || 0));
      let rewardUntil = clampCommunityRewardUntil(Number(remote.rewardUntil) || 0, lbWave);
      let meterKey = String(remote.weekKey || calendarWeek);
      const goal = Math.max(500, Math.floor(Number(remote.goal) || COMMUNITY_GOAL));
      const rewardMult = clampCommunityRewardMult(remote.rewardMult);
      const prevTotal = total;
      const prevWave = lbWave;
      const prevRewardUntil = rewardUntil;
      const prevKey = meterKey;

      const finished = total >= goal && lbWave > 0;
      const rewardOver = rewardUntil <= Date.now();

      // After the luck reward ends, clear the meter so everyone can fill it again.
      if (finished && rewardOver) {
        meterKey = `${calendarWeek}-r${Date.now()}`;
        total = 0;
        lbWave = 0;
        rewardUntil = 0;
      }

      if (state.communityWeekKey !== meterKey) {
        state.communityWeekKey = meterKey;
        state.communityContrib = pending;
      }

      const blockingReward = total >= goal && lbWave > 0 && rewardUntil > Date.now();
      const castAdd = !blockingReward ? pending : 0;
      if (castAdd > 0) {
        // pending casts were already counted into communityContrib locally
        state.communityPendingAdds = Math.max(0, pending - castAdd);
      }

      total = total + castAdd;

      let completedNow = false;
      if (total >= goal && !lbWave) {
        lbWave = Date.now();
        rewardUntil = Date.now() + COMMUNITY_REWARD_MS;
        completedNow = true;
      } else if (total >= goal && lbWave) {
        rewardUntil = clampCommunityRewardUntil(rewardUntil, lbWave);
      }

      communityCache = {
        weekKey: meterKey,
        total,
        goal,
        rewardUntil,
        rewardMult,
        lbWave
      };
      communityFetchAt = Date.now();
      saveSoon();

      if (
        castAdd > 0 ||
        meterKey !== prevKey ||
        total !== prevTotal ||
        lbWave !== prevWave ||
        rewardUntil !== prevRewardUntil ||
        completedNow
      ) {
        const pushed = await pushCommunityDoc(communityCache);
        if (!pushed && castAdd > 0) {
          // Keep pending so another client/session can retry the flush.
          state.communityPendingAdds = Math.max(
            0,
            Math.floor(Number(state.communityPendingAdds) || 0)
          ) + castAdd;
          communityCache.total = Math.max(0, total - castAdd);
          saveSoon();
        }
      }
      tryClaimCommunityAstral();
      return communityCache;
    } finally {
      communitySyncInFlight = false;
    }
  }

  function applyCommunityOfflineTick(pending = Math.floor(Number(state.communityPendingAdds) || 0)) {
    communityCache.rewardUntil = clampCommunityRewardUntil(
      communityCache.rewardUntil,
      communityCache.lbWave
    );
    communityCache.rewardMult = clampCommunityRewardMult(communityCache.rewardMult);
    if (communityMeterFinished() && !communityRewardLive()) {
      communityCache = {
        weekKey: `${communityWeekKey()}-local-${Date.now()}`,
        total: 0,
        goal: Math.max(500, Number(communityCache.goal) || COMMUNITY_GOAL),
        rewardUntil: 0,
        rewardMult: clampCommunityRewardMult(communityCache.rewardMult),
        lbWave: 0
      };
      if (state.communityWeekKey !== communityCache.weekKey) {
        state.communityWeekKey = communityCache.weekKey;
        state.communityContrib = pending;
      }
    }
  }

  /** Contributors get 1 Astral Lucky Block once per completed meter (weekKey). */
  function tryClaimCommunityAstral() {
    if (!communityMeterFinished()) return false;
    if ((state.communityContrib || 0) <= 0) return false;
    const key = String(communityCache.weekKey || "");
    if (!key) return false;
    if (String(state.communityLbClaimedKey || "") === key) return false;
    const wave = Math.max(0, Math.floor(Number(communityCache.lbWave) || 0));
    // Migrate legacy wave claims onto the meter key
    if (wave && Math.floor(Number(state.communityLbClaimedWave) || 0) === wave) {
      state.communityLbClaimedKey = key;
      saveSoon();
      return false;
    }
    const added = storeLuckyBlock("astral", 1, { silent: true });
    state.communityLbClaimedKey = key;
    state.communityLbClaimedWave = wave;
    if (added > 0) {
      setCatchLine(
        `Community meter done! +1 Astral Lucky Block · ${luckyBlockCount("astral")} ready`,
        "treasure"
      );
      playSfx("win");
      burstConfetti();
      renderTreasureStash();
      render(false);
      saveSoon();
      return true;
    }
    setCatchLine("Community meter done — Astral stash full", "miss");
    saveSoon();
    return false;
  }

  function aquariumLevel() {
    return Math.max(0, Math.min(AQUARIUM_MAX_LEVEL, Math.floor(Number(state.aquariumLevel) || 0)));
  }

  function getAquariumTier() {
    const level = aquariumLevel();
    if (level < 1) return null;
    return { level, ...AQUARIUM_TIERS[level] };
  }

  function nextAquariumTier() {
    const next = aquariumLevel() + 1;
    if (next > AQUARIUM_MAX_LEVEL) return null;
    return { level: next, ...AQUARIUM_TIERS[next] };
  }

  function migrateLegacyAquarium(ownedMap) {
    let best = 0;
    for (let i = 1; i <= AQUARIUM_MAX_LEVEL; i += 1) {
      if (ownedMap?.[`aqua${i}`]) best = i;
    }
    return best;
  }

  function aquariumDripBonus() {
    return Number(getAquariumTier()?.amount) || 0;
  }

  function aquariumSwimBonus() {
    return Math.max(0, Math.floor(Number(getAquariumTier()?.slots) || 0));
  }

  function aquariumSwimMax() {
    return AQUARIUM_SWIM_MAX + aquariumSwimBonus();
  }

  function aquariumRatePerSec() {
    const spot = currentSpot();
    let rate = 0;
    state.cooler.forEach((raw) => {
      const entry = normalizeCoolerEntry(raw);
      if (!entry?.saved) return;
      const fish = fishById(entry.id);
      if (!fish || isTreasureItem(fish)) return;
      const rank = RARITY_RANK[fish.rarity] || 1;
      const val = fishValue(fish, spot, entry);
      rate += val * 0.00004 * (0.35 + rank * 0.08);
    });
    return rate * (1 + aquariumDripBonus());
  }

  function tickAquarium(force = false) {
    const now = Date.now();
    const last = Math.max(0, Number(state.aquariumLastTick) || now);
    let elapsed = Math.max(0, now - last);
    if (!force && elapsed < 1000) return 0;
    elapsed = Math.min(elapsed, 6 * 3600 * 1000);
    const gained = aquariumRatePerSec() * (elapsed / 1000);
    state.aquariumLastTick = now;
    if (gained > 0) {
      state.aquariumBank = (Number(state.aquariumBank) || 0) + gained;
    }
    return gained;
  }

  function claimAquariumBank() {
    tickAquarium(true);
    const bank = Math.floor(Number(state.aquariumBank) || 0);
    if (bank <= 0) return 0;
    state.aquariumBank = 0;
    addCoins(bank);
    return bank;
  }

  const AQUARIUM_SWIM_MAX = 18;
  let aquariumRenderKey = "";
  let aquariumExpanded = false;
  /** @type {{ el: HTMLElement, x: number, y: number, vx: number, vy: number, w: number, h: number }[]} */
  let aquariumSwimState = [];
  let aquariumRaf = 0;
  let aquariumLastTs = 0;

  function aquariumFishList() {
    const spot = currentSpot();
    return state.cooler
      .map((raw, index) => {
        const entry = normalizeCoolerEntry(raw);
        if (!entry?.saved) return null;
        const fish = fishById(entry.id);
        if (!fish || isTreasureItem(fish)) return null;
        return { index, entry, fish, val: fishValue(fish, spot, entry) };
      })
      .filter(Boolean)
      .sort((a, b) => b.val - a.val || (RARITY_RANK[b.fish.rarity] || 0) - (RARITY_RANK[a.fish.rarity] || 0))
      .slice(0, aquariumSwimMax());
  }

  /** Rank every cooler fish the tank can use (saved or not). */
  function aquariumEligibleCoolerRows() {
    const spot = currentSpot();
    return state.cooler
      .map((raw, index) => {
        const entry = normalizeCoolerEntry(raw);
        if (!entry) return null;
        const fish = fishById(entry.id);
        if (!fish || isTreasureItem(fish)) return null;
        return { index, entry, fish, val: fishValue(fish, spot, entry) };
      })
      .filter(Boolean)
      .sort(
        (a, b) =>
          b.val - a.val || (RARITY_RANK[b.fish.rarity] || 0) - (RARITY_RANK[a.fish.rarity] || 0)
      );
  }

  /**
   * ★ the highest-value cooler fish up to swim slots; unpin weaker saved fish
   * so the tank shows the best lineup and those fish can be sold again.
   */
  function equipBestAquariumFish() {
    ensureSession();
    const max = aquariumSwimMax();
    const ranked = aquariumEligibleCoolerRows();
    if (!ranked.length) {
      setCatchLine("No fish in the cooler to equip", "miss");
      playSfx("miss");
      return;
    }
    const bestIdx = new Set(ranked.slice(0, max).map((r) => r.index));
    let savedN = 0;
    let freedN = 0;
    state.cooler = state.cooler.map((raw, index) => {
      const entry = normalizeCoolerEntry(raw);
      if (!entry) return raw;
      const fish = fishById(entry.id);
      const exclusive = isExclusiveFish(fish);
      const eligible = !!fish && !isTreasureItem(fish);
      const want = exclusive || (eligible && bestIdx.has(index));
      if (want === !!entry.saved && (!exclusive || entry.saved)) {
        return exclusive ? { ...entry, saved: true, unsellable: true, untradeable: true } : entry;
      }
      if (want) {
        savedN += 1;
        return {
          ...entry,
          saved: true,
          unsellable: exclusive || !!entry.unsellable,
          untradeable: exclusive || !!entry.untradeable
        };
      }
      if (exclusive) {
        return { ...entry, saved: true, unsellable: true, untradeable: true };
      }
      freedN += 1;
      return { ...entry, saved: false };
    });
    const equipped = Math.min(max, ranked.length);
    aquariumRenderKey = "";
    coolerRenderKey = "";
    if (savedN === 0 && freedN === 0) {
      setCatchLine(
        `Aquarium already has your best ${equipped} fish`,
        catchTone(ranked[0]?.fish?.rarity)
      );
      playSfx("click");
      render(false);
      return;
    }
    const bits = [];
    if (savedN) bits.push(`★ ${savedN} best`);
    if (freedN) bits.push(`unpinned ${freedN}`);
    setCatchLine(
      `Equipped best for Aquarium · ${bits.join(" · ")} · ${equipped}/${max} swim`,
      catchTone(ranked[0]?.fish?.rarity)
    );
    playSfx("win");
    render(false);
    saveSoon();
  }

  function aquariumKey() {
    return aquariumFishList()
      .map(
        ({ entry, fish }) =>
          `${fish.id}:${entry.variant || ""}:${entry.shiny ? 1 : 0}:${entry.mutation || ""}`
      )
      .join("|");
  }

  function stopAquariumSwim() {
    if (aquariumRaf) {
      cancelAnimationFrame(aquariumRaf);
      aquariumRaf = 0;
    }
    aquariumLastTs = 0;
    aquariumSwimState = [];
  }

  function applyAquaFishPose(fish) {
    const facing = fish.vx >= 0 ? 1 : -1;
    fish.el.style.transform = `translate(${fish.x.toFixed(1)}px, ${fish.y.toFixed(1)}px) scaleX(${facing})`;
    fish.el.classList.toggle("facing-left", facing < 0);
  }

  function stepAquariumSwim(ts) {
    aquariumRaf = 0;
    const swimmers = document.getElementById("aquarium-swimmers");
    if (!swimmers || !aquariumSwimState.length) {
      aquariumLastTs = 0;
      return;
    }
    if (!aquariumLastTs) aquariumLastTs = ts;
    let dt = Math.min(0.05, Math.max(0.001, (ts - aquariumLastTs) / 1000));
    aquariumLastTs = ts;

    const laneW = swimmers.clientWidth;
    const laneH = swimmers.clientHeight;
    if (laneW < 8 || laneH < 8) {
      aquariumRaf = requestAnimationFrame(stepAquariumSwim);
      return;
    }

    aquariumSwimState.forEach((fish) => {
      fish.x += fish.vx * dt;
      fish.y += fish.vy * dt;
      const maxX = Math.max(0, laneW - fish.w);
      const maxY = Math.max(0, laneH - fish.h);
      if (fish.x <= 0) {
        fish.x = 0;
        fish.vx = Math.abs(fish.vx);
      } else if (fish.x >= maxX) {
        fish.x = maxX;
        fish.vx = -Math.abs(fish.vx);
      }
      if (fish.y <= 0) {
        fish.y = 0;
        fish.vy = Math.abs(fish.vy);
      } else if (fish.y >= maxY) {
        fish.y = maxY;
        fish.vy = -Math.abs(fish.vy);
      }
      applyAquaFishPose(fish);
    });

    aquariumRaf = requestAnimationFrame(stepAquariumSwim);
  }

  function startAquariumSwim() {
    if (aquariumRaf) return;
    if (!aquariumSwimState.length) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches) {
      aquariumSwimState.forEach((fish) => applyAquaFishPose(fish));
      return;
    }
    aquariumLastTs = 0;
    aquariumRaf = requestAnimationFrame(stepAquariumSwim);
  }

  function setAquariumExpanded(on) {
    const tank = document.getElementById("aquarium-tank");
    const backdrop = document.getElementById("aquarium-expand-backdrop");
    const closeBtn = document.getElementById("aquarium-expand-close");
    const next = !!on;
    if (aquariumExpanded === next) return;
    aquariumExpanded = next;
    tank?.classList.toggle("is-expanded", aquariumExpanded);
    tank?.setAttribute("aria-expanded", aquariumExpanded ? "true" : "false");
    tank?.setAttribute(
      "aria-label",
      aquariumExpanded ? "Enlarged aquarium · tap a fish to inspect" : "Aquarium tank · tap to enlarge"
    );
    if (aquariumExpanded) tank?.removeAttribute("title");
    else tank?.setAttribute("title", "Tap tank to enlarge · tap a fish to inspect");
    if (backdrop) {
      backdrop.hidden = !aquariumExpanded;
      backdrop.classList.toggle("hidden", !aquariumExpanded);
    }
    if (closeBtn) {
      closeBtn.hidden = !aquariumExpanded;
      closeBtn.classList.toggle("hidden", !aquariumExpanded);
    }
    if (aquariumExpanded) lockPageScroll();
    else unlockPageScroll();
    aquariumRenderKey = "";
    // Wait a frame so expanded size is measured for swim lanes.
    requestAnimationFrame(() => renderAquarium(true));
  }

  function renderAquarium(force = false) {
    const tank = document.getElementById("aquarium-tank");
    const swimmers = document.getElementById("aquarium-swimmers");
    const emptyEl = document.getElementById("aquarium-empty");
    const dripEl = document.getElementById("aquarium-drip-label");
    const tankClaim = document.getElementById("aquarium-tank-claim");
    if (!tank || !swimmers) return;

    tickAquarium();
    const bank = Math.floor(Number(state.aquariumBank) || 0);
    const rate = aquariumRatePerSec();
    const list = aquariumFishList();
    const nextKey = `${aquariumKey()}|${aquariumExpanded ? 1 : 0}`;

    if (dripEl) {
      const dripBonus = aquariumDripBonus();
      const swimMax = aquariumSwimMax();
      const bonusTip =
        dripBonus > 0 || swimMax > AQUARIUM_SWIM_MAX
          ? ` · tank ${formatPctBonus(dripBonus)} drip · ${swimMax} swim slots`
          : "";
      dripEl.textContent =
        list.length === 0
          ? "Save fish in the cooler to stock the tank"
          : rate > 0
            ? `${list.length} swimming · ${formatNum(bank)} banked · ${formatNum(
                Math.max(1, Math.floor(rate * 60))
              )}/min${bonusTip}`
            : `${list.length} swimming · ${formatNum(bank)} banked${bonusTip}`;
    }
    if (tankClaim) tankClaim.disabled = bank <= 0;
    const equipBestBtn = document.getElementById("aquarium-equip-best-btn");
    if (equipBestBtn) equipBestBtn.disabled = state.cooler.length === 0;
    tank.classList.toggle("has-fish", list.length > 0);
    tank.classList.toggle("is-expanded", aquariumExpanded);
    if (emptyEl) emptyEl.hidden = list.length > 0;
    renderAquariumUpgrade();

    if (!force && nextKey === aquariumRenderKey) {
      startAquariumSwim();
      return;
    }
    aquariumRenderKey = nextKey;
    stopAquariumSwim();

    const sizeMult = aquariumExpanded ? 1.9 : 1;
    swimmers.innerHTML = list
      .map(({ index, entry, fish }, i) => {
        const label = formatFishName(fish, entry);
        const fishW = (
          (42 + Math.min(18, (RARITY_RANK[fish.rarity] || 1) * 0.7)) *
          sizeMult
        ).toFixed(0);
        return `<button type="button" class="aqua-fish ${fish.rarity} ${variantClassList(
          entry
        )}" data-aqua-index="${index}" data-aqua-i="${i}" style="width:${fishW}px;height:${(
          Number(fishW) * 0.5
        ).toFixed(0)}px" title="${label} · tap to inspect" aria-label="Inspect ${label}">
          <span class="aqua-fish-glyph" aria-hidden="true">${fishGlyphHtml(fish, entry)}</span>
        </button>`;
      })
      .join("");

    const laneW = Math.max(1, swimmers.clientWidth);
    const laneH = Math.max(1, swimmers.clientHeight);
    aquariumSwimState = [...swimmers.querySelectorAll(".aqua-fish")].map((el, i) => {
      const w = el.offsetWidth || 48;
      const h = el.offsetHeight || 24;
      const maxX = Math.max(0, laneW - w);
      const maxY = Math.max(0, laneH - h);
      const speed =
        (28 + (i % 5) * 7 + ((list[i]?.fish?.id.length || 0) % 6) * 3) * (aquariumExpanded ? 1.15 : 1);
      const dir = i % 2 === 0 ? 1 : -1;
      const x = Math.min(maxX, Math.max(0, (maxX * ((i * 37) % 100)) / 100));
      const y = Math.min(maxY, Math.max(0, (maxY * ((i * 53 + 17) % 100)) / 100));
      const fish = {
        el,
        x,
        y,
        vx: dir * speed,
        vy: (i % 2 === 0 ? 1 : -1) * (2.5 + (i % 3) * 1.2) * (aquariumExpanded ? 1.2 : 1),
        w,
        h
      };
      applyAquaFishPose(fish);
      return fish;
    });
    startAquariumSwim();
    publishAquariumShare(false).catch(() => {});
  }

  /* ========== Visit others' aquariums ========== */
  let aquaShareCache = { tanks: {} };
  let aquaShareFetchedAt = 0;
  let aquaShareLastKey = "";
  let aquaShareTimer = 0;
  let visitAquaSwimState = [];
  let visitAquaRaf = 0;
  let visitAquaLastTs = 0;
  let visitAquaCurrent = null;
  let visitAquaDisplayFish = [];
  let visitBaseTab = "overview";

  function serializeShareFishEntry(entry) {
    const n = normalizeCoolerEntry(entry) || entry || {};
    return {
      id: String(n.id || coolerEntryId(entry) || ""),
      variant: normalizeVariant(n.variant),
      shiny: !!n.shiny,
      mutation: normalizeMutation(n.mutation),
      perfect: !!n.perfect,
      saved: !!n.saved
    };
  }

  function visitNum(v) {
    if (typeof v === "string" && v.trim()) {
      const n = Number(v);
      return Number.isFinite(n) ? n : 0;
    }
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }

  function buildBaseSharePayload(slim = false) {
    const spot = currentSpot();
    const coolerCap = slim ? 12 : AQUA_SHARE_COOLER_MAX;
    const coolerRows = state.cooler
      .map((raw) => {
        const entry = normalizeCoolerEntry(raw);
        if (!entry) return null;
        const fish = fishById(entry.id);
        if (!fish || isTreasureItem(fish)) return null;
        return {
          entry,
          val: fishValue(fish, spot, entry),
          saved: !!entry.saved
        };
      })
      .filter(Boolean)
      .sort((a, b) => {
        if (a.saved !== b.saved) return a.saved ? -1 : 1;
        return b.val - a.val;
      })
      .slice(0, coolerCap);

    let found = 0;
    try {
      found = caughtCount();
    } catch {
      found = 0;
    }
    const total = Math.max(1, FISH.length);
    const coins = Math.max(0, Math.floor(visitNum(state.coins)));
    const lifetime = Math.max(0, Math.floor(visitNum(state.lifetime)));
    return {
      coins,
      coinsText: String(coins),
      lifetime,
      lifetimeText: String(lifetime),
      catches: Math.max(0, Math.floor(visitNum(state.catches))),
      perfects: Math.max(0, Math.floor(visitNum(state.perfects))),
      spotId: String(state.spotId || "creek"),
      unlocked: SPOTS.filter((s) => state.unlocked?.[s.id]).map((s) => s.id),
      boatLevel:
        typeof boatLevel === "function"
          ? boatLevel()
          : Math.max(0, Math.floor(visitNum(state.boatLevel))),
      aquariumLevel: aquariumLevel(),
      echoLuckLevel: Math.max(0, Math.floor(visitNum(state.echoLuckLevel))),
      bookFound: found,
      bookTotal: total,
      bookPct: Math.floor((100 * found) / total),
      bestCatch: {
        id: String(state.bestCatchId || ""),
        score: Math.max(0, visitNum(state.bestCatchScore)),
        variant: normalizeVariant(state.bestCatchVariant),
        shiny: !!state.bestCatchShiny,
        mutation: normalizeMutation(state.bestCatchMutation)
      },
      stash: {
        moneyChest: Math.max(0, Math.floor(visitNum(state.moneyChestCount))),
        luckChest: Math.max(0, Math.floor(visitNum(state.luckChestCount))),
        astral: luckyBlockCount("astral"),
        absolute: luckyBlockCount("absolute"),
        zenith: luckyBlockCount("zenith")
      },
      gear: GEAR.filter((g) => state.owned?.[g.id]).map((g) => ({
        id: g.id,
        name: g.name,
        kind: g.kind
      })),
      cooler: coolerRows.map((r) => serializeShareFishEntry(r.entry)),
      coolerTotal: state.cooler.length,
      coolerMax: Math.max(0, Math.floor(visitNum(coolerMax())))
    };
  }

  function buildAquariumShareSnapshot(slim = false) {
    const myId = mailMyId();
    const myName = mailMyName();
    if (!myId && !myName) return null;
    let base = null;
    try {
      base = buildBaseSharePayload(slim);
    } catch (err) {
      console.warn("[aqua-share] base snapshot failed", err);
      base = {
        coins: Math.max(0, Math.floor(visitNum(state.coins))),
        lifetime: Math.max(0, Math.floor(visitNum(state.lifetime))),
        catches: Math.max(0, Math.floor(visitNum(state.catches))),
        perfects: Math.max(0, Math.floor(visitNum(state.perfects))),
        spotId: String(state.spotId || "creek"),
        unlocked: [],
        boatLevel: Math.max(0, Math.floor(visitNum(state.boatLevel))),
        aquariumLevel: aquariumLevel(),
        echoLuckLevel: Math.max(0, Math.floor(visitNum(state.echoLuckLevel))),
        bookFound: 0,
        bookTotal: FISH.length || 1,
        bookPct: 0,
        bestCatch: { id: "", score: 0, variant: "", shiny: false, mutation: "" },
        stash: {
          moneyChest: Math.max(0, Math.floor(visitNum(state.moneyChestCount))),
          luckChest: Math.max(0, Math.floor(visitNum(state.luckChestCount))),
          astral: 0,
          absolute: 0,
          zenith: 0
        },
        gear: [],
        cooler: [],
        coolerTotal: Array.isArray(state.cooler) ? state.cooler.length : 0,
        coolerMax: 0
      };
    }
    const list = aquariumFishList();
    const fish = list.map(({ entry }) => serializeShareFishEntry(entry));
    return {
      playerId: myId,
      name: myName || "Player",
      updatedAt: Date.now(),
      level: aquariumLevel(),
      fish,
      base
    };
  }

  async function fetchAquaShareDoc() {
    const api = fishingSb();
    try {
      let data = null;
      if (api) data = await api.getPrefer(AQUA_SHARE_DOC, AQUA_SHARE_API);
      else {
        const res = await fetch(`${AQUA_SHARE_API}?t=${Date.now()}`, { cache: "no-store" });
        if (res.status === 404) return { token: AQUA_SHARE_TOKEN, tanks: {} };
        if (!res.ok) return null;
        data = await res.json();
      }
      if (!data || typeof data !== "object") return { token: AQUA_SHARE_TOKEN, tanks: {} };
      return {
        token: data.token || AQUA_SHARE_TOKEN,
        tanks: data.tanks && typeof data.tanks === "object" ? data.tanks : {}
      };
    } catch {
      return null;
    }
  }

  function pruneAquaShareTanks(tanks) {
    const now = Date.now();
    const entries = Object.entries(tanks || {}).filter(([, t]) => {
      if (!t || typeof t !== "object") return false;
      const at = Number(t.updatedAt) || 0;
      return now - at < AQUA_SHARE_TTL_MS;
    });
    entries.sort((a, b) => (Number(b[1].updatedAt) || 0) - (Number(a[1].updatedAt) || 0));
    const next = {};
    entries.slice(0, AQUA_SHARE_MAX_TANKS).forEach(([id, t]) => {
      next[id] = t;
    });
    return next;
  }

  async function postAquaShareDoc(tanks) {
    const payload = {
      token: AQUA_SHARE_TOKEN,
      tanks: pruneAquaShareTanks(tanks)
    };
    const api = fishingSb();
    try {
      if (api) {
        await api.pushPrefer(AQUA_SHARE_DOC, payload, AQUA_SHARE_API);
        return true;
      }
      const res = await fetch(AQUA_SHARE_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  async function publishAquariumShare(force = false) {
    let snap = buildAquariumShareSnapshot(false);
    if (!snap) return;
    const b = snap.base || {};
    const key = [
      snap.playerId,
      snap.level,
      b.coins,
      b.boatLevel,
      b.coolerTotal,
      b.stash?.moneyChest,
      b.stash?.luckChest,
      b.gear?.length,
      snap.fish
        .map((f) => `${f.id}:${f.variant}:${f.shiny ? 1 : 0}:${f.mutation || ""}`)
        .join(",")
    ].join("|");
    if (!force && key === aquaShareLastKey) return;
    const remote = (await fetchAquaShareDoc()) || { tanks: {} };
    const tanks = { ...(remote.tanks || {}) };
    const id = snap.playerId || String(snap.name || "").toLowerCase();
    if (!id) return;
    tanks[id] = snap;
    let ok = await postAquaShareDoc(tanks);
    if (!ok) {
      // Retry with a smaller payload if the full base is too large.
      snap = buildAquariumShareSnapshot(true);
      if (snap) {
        tanks[id] = snap;
        ok = await postAquaShareDoc(tanks);
      }
    }
    if (ok) {
      aquaShareLastKey = key;
      aquaShareCache.tanks = pruneAquaShareTanks(tanks);
    }
  }

  async function refreshAquaShareCache(force = false) {
    const now = Date.now();
    if (!force && now - aquaShareFetchedAt < AQUA_SHARE_POLL_MS) return aquaShareCache;
    aquaShareFetchedAt = now;
    const doc = await fetchAquaShareDoc();
    if (doc) aquaShareCache = { tanks: pruneAquaShareTanks(doc.tanks || {}) };
    return aquaShareCache;
  }

  function stopVisitAquaSwim() {
    if (visitAquaRaf) {
      cancelAnimationFrame(visitAquaRaf);
      visitAquaRaf = 0;
    }
    visitAquaLastTs = 0;
    visitAquaSwimState = [];
  }

  function stepVisitAquaSwim(ts) {
    visitAquaRaf = 0;
    const swimmers = document.getElementById("visit-aqua-swimmers");
    if (!swimmers || !visitAquaSwimState.length) {
      visitAquaLastTs = 0;
      return;
    }
    if (!visitAquaLastTs) visitAquaLastTs = ts;
    const dt = Math.min(0.05, Math.max(0.001, (ts - visitAquaLastTs) / 1000));
    visitAquaLastTs = ts;
    const laneW = swimmers.clientWidth;
    const laneH = swimmers.clientHeight;
    if (laneW < 8 || laneH < 8) {
      visitAquaRaf = requestAnimationFrame(stepVisitAquaSwim);
      return;
    }
    visitAquaSwimState.forEach((fish) => {
      fish.x += fish.vx * dt;
      fish.y += fish.vy * dt;
      const maxX = Math.max(0, laneW - fish.w);
      const maxY = Math.max(0, laneH - fish.h);
      if (fish.x <= 0) {
        fish.x = 0;
        fish.vx = Math.abs(fish.vx);
      } else if (fish.x >= maxX) {
        fish.x = maxX;
        fish.vx = -Math.abs(fish.vx);
      }
      if (fish.y <= 0) {
        fish.y = 0;
        fish.vy = Math.abs(fish.vy);
      } else if (fish.y >= maxY) {
        fish.y = maxY;
        fish.vy = -Math.abs(fish.vy);
      }
      applyAquaFishPose(fish);
    });
    visitAquaRaf = requestAnimationFrame(stepVisitAquaSwim);
  }

  function startVisitAquaSwim() {
    if (visitAquaRaf) return;
    if (!visitAquaSwimState.length) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches) {
      visitAquaSwimState.forEach((fish) => applyAquaFishPose(fish));
      return;
    }
    visitAquaLastTs = 0;
    visitAquaRaf = requestAnimationFrame(stepVisitAquaSwim);
  }

  function renderVisitAquaBrowse() {
    const friendsEl = document.getElementById("visit-aqua-friends");
    const recentEl = document.getElementById("visit-aqua-recent");
    if (!friendsEl || !recentEl) return;
    const tanks = aquaShareCache.tanks || {};
    const friends = window.HubFriends?.getFriends?.() || [];
    const myId = mailMyId();

    if (!friends.length) {
      friendsEl.innerHTML = `<p class="mail-empty">No friends yet — add some on the hub.</p>`;
    } else {
      friendsEl.innerHTML = friends
        .map((f) => {
          const id = String(f.playerId || f.id || "");
          const name = String(f.name || "Friend");
          const tank = tanks[id];
          const n = Array.isArray(tank?.fish) ? tank.fish.length : 0;
          const tip = tank
            ? `${formatNum(tank.base?.coins || 0)} coins · ${n} aquarium`
            : "No base published yet";
          return `<button type="button" class="mail-friend-btn" data-visit-aqua="${escapeHtml(
            id
          )}" data-visit-aqua-name="${escapeHtml(name)}" title="${escapeHtml(tip)}">${escapeHtml(
            name
          )}${tank ? ` · ${formatNum(tank.base?.coins || 0)}` : ""}</button>`;
        })
        .join("");
    }

    const recent = Object.values(tanks)
      .filter((t) => t && t.playerId !== myId)
      .sort((a, b) => (Number(b.updatedAt) || 0) - (Number(a.updatedAt) || 0))
      .slice(0, 24);
    if (!recent.length) {
      recentEl.innerHTML = `<p class="mail-empty">No published bases yet. Play with a hub name so yours syncs.</p>`;
    } else {
      recentEl.innerHTML = recent
        .map((t) => {
          const id = String(t.playerId || "");
          const name = String(t.name || "Player");
          const n = Array.isArray(t.fish) ? t.fish.length : 0;
          const coins = formatNum(t.base?.coins || 0);
          return `<button type="button" class="visit-aqua-recent-btn" data-visit-aqua="${escapeHtml(
            id
          )}" data-visit-aqua-name="${escapeHtml(name)}"><strong>${escapeHtml(
            name
          )}</strong><span>${coins} · ${n} aqua · book ${Math.max(
            0,
            Number(t.base?.bookPct) || 0
          )}%</span></button>`;
        })
        .join("");
    }
  }

  function visitShareFishRows(rawList) {
    return (Array.isArray(rawList) ? rawList : [])
      .map((raw) => {
        const fish = fishById(raw.id);
        if (!fish || isTreasureItem(fish)) return null;
        const entry = {
          variant: normalizeVariant(raw.variant),
          shiny: !!raw.shiny,
          mutation: normalizeMutation(raw.mutation),
          perfect: !!raw.perfect,
          saved: !!raw.saved
        };
        return {
          fish,
          entry,
          val: fishValue(fish, currentSpot(), entry)
        };
      })
      .filter(Boolean)
      .sort(
        (a, b) =>
          b.val - a.val || (RARITY_RANK[b.fish.rarity] || 0) - (RARITY_RANK[a.fish.rarity] || 0)
      );
  }

  function visitFishRosterHtml(rows, emptyText) {
    if (!rows.length) return `<p class="mail-empty">${escapeHtml(emptyText)}</p>`;
    return `<ul class="visit-aqua-roster">${rows
      .map(({ fish, entry, val }, i) => {
        const label = formatFishName(fish, entry);
        const saved = entry.saved ? " · ★" : "";
        return `<li class="visit-aqua-roster-item">
          <button type="button" class="visit-aqua-roster-btn ${fish.rarity}" data-visit-inspect="${i}">
            <span class="visit-aqua-roster-glyph" aria-hidden="true">${fishGlyphHtml(fish, entry)}</span>
            <span class="visit-aqua-roster-meta">
              <strong>${escapeHtml(label)}${saved}</strong>
              <span>${escapeHtml(fish.rarity)} · ${formatNum(val)}</span>
            </span>
          </button>
        </li>`;
      })
      .join("")}</ul>`;
  }

  function renderVisitBaseOverview(tank) {
    const panel = document.getElementById("visit-base-overview");
    if (!panel) return;
    const b = tank?.base;
    if (!b || typeof b !== "object") {
      panel.innerHTML = `<p class="mail-empty">Full base not synced yet. They need a hard refresh on Fishing (Visit publishes automatically).</p>`;
      return;
    }
    const spot = SPOTS.find((s) => s.id === b.spotId) || SPOTS[0];
    const unlocked = Array.isArray(b.unlocked) ? b.unlocked : [];
    const spotNames = unlocked
      .map((id) => SPOTS.find((s) => s.id === id)?.name || id)
      .join(", ");
    let bestLabel = "—";
    if (b.bestCatch?.id) {
      const bf = fishById(b.bestCatch.id);
      if (bf) {
        bestLabel = `${formatFishName(bf, b.bestCatch)} · ${formatNum(visitNum(b.bestCatch.score))}`;
      }
    }
    const coins = visitNum(b.coinsText || b.coins);
    const lifetime = visitNum(b.lifetimeText || b.lifetime);
    panel.innerHTML = `<div class="visit-base-stats">
      <div class="visit-stat"><span>Coins</span><strong>${formatNum(coins)}</strong></div>
      <div class="visit-stat"><span>Lifetime</span><strong>${formatNum(lifetime)}</strong></div>
      <div class="visit-stat"><span>Catches</span><strong>${formatNum(visitNum(b.catches))}</strong></div>
      <div class="visit-stat"><span>Perfects</span><strong>${formatNum(visitNum(b.perfects))}</strong></div>
      <div class="visit-stat"><span>Catch book</span><strong>${Math.max(0, visitNum(b.bookFound))} / ${Math.max(
      0,
      visitNum(b.bookTotal)
    )} (${Math.max(0, visitNum(b.bookPct))}%)</strong></div>
      <div class="visit-stat"><span>Fishing at</span><strong>${escapeHtml(spot?.name || "Creek")}</strong></div>
      <div class="visit-stat"><span>Boat</span><strong>Lv${Math.max(0, visitNum(b.boatLevel))}</strong></div>
      <div class="visit-stat"><span>Aquarium</span><strong>Lv${Math.max(
        0,
        visitNum(b.aquariumLevel ?? tank?.level)
      )}</strong></div>
      <div class="visit-stat"><span>Echo Charm</span><strong>Lv${Math.max(
        0,
        visitNum(b.echoLuckLevel)
      )}</strong></div>
      <div class="visit-stat"><span>Cooler</span><strong>${Math.max(0, visitNum(b.coolerTotal))} / ${Math.max(
      0,
      visitNum(b.coolerMax)
    )}</strong></div>
      <div class="visit-stat visit-stat-wide"><span>Best catch</span><strong>${escapeHtml(bestLabel)}</strong></div>
      <div class="visit-stat visit-stat-wide"><span>Spots</span><strong>${escapeHtml(
        spotNames || "Creek"
      )}</strong></div>
    </div>`;
  }

  function renderVisitBaseCooler(tank) {
    const panel = document.getElementById("visit-base-cooler");
    if (!panel) return;
    const b = tank?.base || {};
    const rows = visitShareFishRows(b.cooler);
    visitAquaDisplayFish = rows;
    const shown = rows.length;
    const total = Math.max(shown, Number(b.coolerTotal) || 0);
    panel.innerHTML = `<p class="mail-hint">Showing top ${shown} of ${total} cooler fish (saved first).</p>${visitFishRosterHtml(
      rows,
      "Cooler empty"
    )}`;
  }

  function renderVisitBaseStash(tank) {
    const panel = document.getElementById("visit-base-stash");
    if (!panel) return;
    const s = tank?.base?.stash || {};
    panel.innerHTML = `<div class="visit-base-stats">
      <div class="visit-stat"><span>Coin chests</span><strong>${formatNum(s.moneyChest || 0)}</strong></div>
      <div class="visit-stat"><span>Luck chests</span><strong>${formatNum(s.luckChest || 0)}</strong></div>
      <div class="visit-stat"><span>Astral LB</span><strong>${formatNum(s.astral || 0)}</strong></div>
      <div class="visit-stat"><span>Absolute LB</span><strong>${formatNum(s.absolute || 0)}</strong></div>
      <div class="visit-stat"><span>Zenith LB</span><strong>${formatNum(s.zenith || 0)}</strong></div>
    </div>`;
  }

  function renderVisitBaseGear(tank) {
    const panel = document.getElementById("visit-base-gear");
    if (!panel) return;
    const gear = Array.isArray(tank?.base?.gear) ? tank.base.gear : [];
    if (!gear.length) {
      panel.innerHTML = `<p class="mail-empty">No gear owned</p>`;
      return;
    }
    const byKind = {};
    gear.forEach((g) => {
      const k = g.kind || "other";
      if (!byKind[k]) byKind[k] = [];
      byKind[k].push(g);
    });
    panel.innerHTML = Object.entries(byKind)
      .map(([kind, list]) => {
        return `<div class="visit-gear-group">
          <p class="mail-section-label">${escapeHtml(kind)}</p>
          <div class="visit-gear-list">${list
            .map((g) => `<span class="visit-gear-chip">${escapeHtml(g.name || g.id)}</span>`)
            .join("")}</div>
        </div>`;
      })
      .join("");
  }

  function setVisitBaseTab(tab) {
    visitBaseTab = tab || "overview";
    const ids = ["overview", "aquarium", "cooler", "stash", "gear"];
    ids.forEach((id) => {
      const el = document.getElementById(`visit-base-${id}`);
      if (!el) return;
      const on = visitBaseTab === id;
      el.hidden = !on;
      el.classList.toggle("hidden", !on);
    });
    document.querySelectorAll("[data-visit-base-tab]").forEach((btn) => {
      btn.classList.toggle("is-active", btn.dataset.visitBaseTab === visitBaseTab);
    });
    if (visitBaseTab === "aquarium") {
      requestAnimationFrame(() => {
        if (visitAquaCurrent) renderVisitAquaTankOnly(visitAquaCurrent);
      });
    } else {
      stopVisitAquaSwim();
    }
    if (visitBaseTab === "cooler" && visitAquaCurrent) renderVisitBaseCooler(visitAquaCurrent);
    if (visitBaseTab === "overview" && visitAquaCurrent) renderVisitBaseOverview(visitAquaCurrent);
    if (visitBaseTab === "stash" && visitAquaCurrent) renderVisitBaseStash(visitAquaCurrent);
    if (visitBaseTab === "gear" && visitAquaCurrent) renderVisitBaseGear(visitAquaCurrent);
  }

  function renderVisitAquaTankOnly(tank) {
    const swimmers = document.getElementById("visit-aqua-swimmers");
    const emptyEl = document.getElementById("visit-aqua-empty");
    const roster = document.getElementById("visit-aqua-roster");
    const tankEl = document.getElementById("visit-aqua-tank");
    if (!swimmers) return;
    stopVisitAquaSwim();
    const fishList = visitShareFishRows(tank?.fish);
    visitAquaDisplayFish = fishList;
    tankEl?.classList.toggle("has-fish", fishList.length > 0);
    if (emptyEl) emptyEl.hidden = fishList.length > 0;
    swimmers.innerHTML = fishList
      .map(({ fish, entry, val }, i) => {
        const label = formatFishName(fish, entry);
        const fishW = (48 + Math.min(18, (RARITY_RANK[fish.rarity] || 1) * 0.7)).toFixed(0);
        return `<button type="button" class="aqua-fish ${fish.rarity} ${variantClassList(
          entry
        )}" data-visit-inspect="${i}" style="width:${fishW}px;height:${(Number(fishW) * 0.5).toFixed(
          0
        )}px" title="${escapeHtml(label)} · ${formatNum(val)}" aria-label="Inspect ${escapeHtml(label)}">
          <span class="aqua-fish-glyph" aria-hidden="true">${fishGlyphHtml(fish, entry)}</span>
        </button>`;
      })
      .join("");
    if (roster) {
      roster.innerHTML = fishList.length
        ? fishList
            .map(({ fish, entry, val }, i) => {
              const label = formatFishName(fish, entry);
              return `<li class="visit-aqua-roster-item">
                <button type="button" class="visit-aqua-roster-btn ${fish.rarity}" data-visit-inspect="${i}">
                  <span class="visit-aqua-roster-glyph" aria-hidden="true">${fishGlyphHtml(fish, entry)}</span>
                  <span class="visit-aqua-roster-meta">
                    <strong>${escapeHtml(label)}</strong>
                    <span>${escapeHtml(fish.rarity)} · ${formatNum(val)}</span>
                  </span>
                </button>
              </li>`;
            })
            .join("")
        : `<li class="mail-empty">No fish in this tank</li>`;
    }
    const laneW = Math.max(1, swimmers.clientWidth);
    const laneH = Math.max(1, swimmers.clientHeight);
    visitAquaSwimState = [...swimmers.querySelectorAll(".aqua-fish")].map((el, i) => {
      const w = el.offsetWidth || 48;
      const h = el.offsetHeight || 24;
      const maxX = Math.max(0, laneW - w);
      const maxY = Math.max(0, laneH - h);
      const speed = 30 + (i % 5) * 7;
      const dir = i % 2 === 0 ? 1 : -1;
      const fish = {
        el,
        x: Math.min(maxX, Math.max(0, (maxX * ((i * 37) % 100)) / 100)),
        y: Math.min(maxY, Math.max(0, (maxY * ((i * 53 + 17) % 100)) / 100)),
        vx: dir * speed,
        vy: (i % 2 === 0 ? 1 : -1) * (2.5 + (i % 3) * 1.2),
        w,
        h
      };
      applyAquaFishPose(fish);
      return fish;
    });
    startVisitAquaSwim();
  }

  function renderVisitAquaTank(tank) {
    const ownerEl = document.getElementById("visit-aqua-owner");
    const metaEl = document.getElementById("visit-aqua-meta");
    visitAquaCurrent = tank;
    const b = tank?.base || {};
    if (ownerEl) ownerEl.textContent = `${tank?.name || "Player"}'s base`;
    if (metaEl) {
      if (!tank?.base) {
        metaEl.textContent = "Aquarium only · full base not synced yet";
      } else {
        metaEl.textContent = `${formatNum(visitNum(b.coinsText || b.coins))} coins · book ${Math.max(
          0,
          visitNum(b.bookPct)
        )}% · aqua Lv${Math.max(0, visitNum(b.aquariumLevel ?? tank?.level))}`;
      }
    }
    renderVisitBaseOverview(tank);
    renderVisitBaseCooler(tank);
    renderVisitBaseStash(tank);
    renderVisitBaseGear(tank);
    setVisitBaseTab(visitBaseTab || "overview");
    if (visitBaseTab === "aquarium") renderVisitAquaTankOnly(tank);
  }

  function showVisitAquaBrowse() {
    document.getElementById("visit-aqua-browse")?.classList.remove("hidden");
    const view = document.getElementById("visit-aqua-view");
    if (view) {
      view.hidden = true;
      view.classList.add("hidden");
    }
    stopVisitAquaSwim();
    visitAquaCurrent = null;
    visitAquaDisplayFish = [];
    renderVisitAquaBrowse();
  }

  function showVisitAquaView(tank) {
    document.getElementById("visit-aqua-browse")?.classList.add("hidden");
    const view = document.getElementById("visit-aqua-view");
    if (view) {
      view.hidden = false;
      view.classList.remove("hidden");
    }
    visitBaseTab = "overview";
    requestAnimationFrame(() => renderVisitAquaTank(tank));
  }

  async function openVisitAquariumPicker() {
    const overlay = document.getElementById("visit-aqua-overlay");
    if (!overlay) return;
    overlay.classList.remove("hidden");
    try {
      window.HubFriends?.sync?.();
      window.HubFriends?.startPolling?.();
    } catch {}
    showVisitAquaBrowse();
    await refreshAquaShareCache(true);
    await publishAquariumShare(true).catch(() => {});
    renderVisitAquaBrowse();
  }

  function closeVisitAquariumPicker() {
    document.getElementById("visit-aqua-overlay")?.classList.add("hidden");
    stopVisitAquaSwim();
    visitAquaCurrent = null;
  }

  async function visitAquariumById(playerId, fallbackName = "") {
    await refreshAquaShareCache(true);
    const tanks = aquaShareCache.tanks || {};
    let tank = tanks[playerId];
    if (!tank) {
      tank = Object.values(tanks).find(
        (t) =>
          String(t?.name || "").toLowerCase() === String(fallbackName || "").toLowerCase()
      );
    }
    if (!tank) {
      setCatchLine(
        fallbackName
          ? `${fallbackName} hasn't published a base yet`
          : "No base found — they need to play with a hub name so it publishes",
        "miss"
      );
      playSfx("miss");
      return;
    }
    showVisitAquaView(tank);
  }

  function startAquariumSharing() {
    publishAquariumShare(true).catch(() => {});
    setTimeout(() => publishAquariumShare(true).catch(() => {}), 2500);
    setTimeout(() => publishAquariumShare(true).catch(() => {}), 8000);
    if (aquaShareTimer) clearInterval(aquaShareTimer);
    aquaShareTimer = setInterval(() => {
      publishAquariumShare(true).catch(() => {});
    }, AQUA_SHARE_POLL_MS);
  }

  function normalizeSearchQuery(q) {
    return String(q || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ")
      .slice(0, 48);
  }

  function fishMatchesSearch(fish, entry, query) {
    const q = normalizeSearchQuery(query);
    if (!q) return true;
    if (!fish) return false;
    const label = formatFishName(fish, entry).toLowerCase();
    const rarity = String(fish.rarity || "").toLowerCase();
    const id = String(fish.id || "").toLowerCase();
    const variant = String(entry?.variant || "").toLowerCase();
    const bits = [label, rarity, id, variant, fish.name?.toLowerCase() || ""];
    if (entry?.shiny) bits.push("shiny");
    if (entry?.mutation) bits.push(String(entry.mutation).toLowerCase(), "mutation");
    if (entry?.perfect) bits.push("perfect");
    if (entry?.saved) bits.push("saved");
    return bits.some((b) => b && b.includes(q));
  }

  function coolerEntriesView() {
    const spot = currentSpot();
    let rows = state.cooler
      .map((raw, index) => {
        const entry = normalizeCoolerEntry(raw);
        if (!entry) return null;
        const fish = fishById(entry.id);
        if (!fish) return null;
        return { index, entry, fish, val: fishValue(fish, spot, entry) };
      })
      .filter(Boolean);
    const totalValid = rows.length;
    const filter = state.coolerFilter || "all";
    if (filter === "saved") rows = rows.filter((r) => r.entry.saved);
    else if (filter === "shiny") rows = rows.filter((r) => r.entry.shiny);
    else if (filter === "unsaved") rows = rows.filter((r) => !r.entry.saved);
    const search = state.coolerSearch || "";
    if (normalizeSearchQuery(search)) {
      rows = rows.filter((r) => fishMatchesSearch(r.fish, r.entry, search));
    }
    const sort = state.coolerSort || "value";
    rows.sort((a, b) => {
      if (sort === "rarity") {
        return (RARITY_RANK[b.fish.rarity] || 0) - (RARITY_RANK[a.fish.rarity] || 0) || b.val - a.val;
      }
      if (sort === "shiny") {
        return Number(b.entry.shiny) - Number(a.entry.shiny) || b.val - a.val;
      }
      if (sort === "saved") {
        return Number(b.entry.saved) - Number(a.entry.saved) || b.val - a.val;
      }
      if (sort === "name") {
        return formatFishName(a.fish, a.entry).localeCompare(formatFishName(b.fish, b.entry));
      }
      return b.val - a.val;
    });
    return { rows, totalValid };
  }

  /** Effective sell vs fish base value: spot × gear sell boost × treasure × mastery. */
  function totalSellFactor() {
    const spot = currentSpot();
    return Math.max(
      0.01,
      (Number(spot?.valueMult) || 1) *
        (1 + sellBonus() + spotMasterySellBonus(spot) + comboMultiBonus()) *
        treasureMoneyMult()
    );
  }

  function storedMs(raw) {
    const n = Number(raw);
    return Number.isFinite(n) ? Math.max(0, n) : 0;
  }

  function snapshotChestBoosts() {
    if (state.moneyBoostPaused) {
      state.moneyBoostPausedLeft = moneyMsLeft();
      state.moneyBoostUntil = 0;
    }
    if (state.luckBoostPaused) {
      state.luckBoostPausedLeft = luckMsLeft();
      state.luckBoostUntil = 0;
    }
  }

  function persistChestBoostBackup() {
    try {
      localStorage.setItem(
        CHEST_BOOST_SAVE_KEY,
        JSON.stringify({
          moneyPaused: !!state.moneyBoostPaused,
          luckPaused: !!state.luckBoostPaused,
          moneyLeft: moneyMsLeft(),
          luckLeft: luckMsLeft(),
          savedAt: Date.now()
        })
      );
    } catch {}
  }

  function readChestBoostBackup() {
    try {
      const raw = JSON.parse(localStorage.getItem(CHEST_BOOST_SAVE_KEY) || "null");
      return raw && typeof raw === "object" ? raw : null;
    } catch {
      return null;
    }
  }

  function restoreChestBoostChannel(paused, leftover, until, now, backupPaused, backupLeft) {
    const left = storedMs(leftover);
    if (paused && left > 0) {
      return { paused: true, leftover: left, until: 0 };
    }
    const backup = storedMs(backupLeft);
    if (backupPaused && backup > 0 && (!until || until <= now) && left <= 0) {
      return { paused: true, leftover: backup, until: 0 };
    }
    const u = storedMs(until);
    if (!paused && u > now) {
      return { paused: false, leftover: 0, until: u };
    }
    return { paused: false, leftover: 0, until: 0 };
  }

  function moneyBoostPaused() {
    return !!state.moneyBoostPaused && moneyMsLeft() > 0;
  }

  function luckBoostPaused() {
    return !!state.luckBoostPaused && luckMsLeft() > 0;
  }

  function moneyBoostActive() {
    return !state.moneyBoostPaused && moneyMsLeft() > 0;
  }

  function luckBoostActive() {
    return !state.luckBoostPaused && luckMsLeft() > 0;
  }

  function moneyMsLeft() {
    if (state.moneyBoostPaused) {
      return Math.max(0, Number(state.moneyBoostPausedLeft) || 0);
    }
    const until = Math.max(0, Number(state.moneyBoostUntil) || 0);
    return Math.max(0, until - Date.now());
  }

  function luckMsLeft() {
    if (state.luckBoostPaused) {
      return Math.max(0, Number(state.luckBoostPausedLeft) || 0);
    }
    const until = Math.max(0, Number(state.luckBoostUntil) || 0);
    return Math.max(0, until - Date.now());
  }

  function clearExpiredChestBoosts() {
    if (moneyMsLeft() <= 0) {
      state.moneyBoostUntil = 0;
      state.moneyBoostPaused = false;
      state.moneyBoostPausedLeft = 0;
    }
    if (luckMsLeft() <= 0) {
      state.luckBoostUntil = 0;
      state.luckBoostPaused = false;
      state.luckBoostPausedLeft = 0;
    }
  }

  function toggleChestBoostPause(kind) {
    const luck = kind === "luck";
    const left = luck ? luckMsLeft() : moneyMsLeft();
    if (left <= 0) return;
    const paused = luck ? !!state.luckBoostPaused : !!state.moneyBoostPaused;
    if (paused) {
      if (luck) {
        state.luckBoostPaused = false;
        state.luckBoostUntil = Date.now() + left;
        state.luckBoostPausedLeft = 0;
      } else {
        state.moneyBoostPaused = false;
        state.moneyBoostUntil = Date.now() + left;
        state.moneyBoostPausedLeft = 0;
      }
      const total = formatMult(luck ? treasureLuckMult() : treasureMoneyMult());
      setCatchLine(
        luck
          ? `Luck Chest resumed · ${total}× luck · ${formatTreasureClock(left)} left`
          : `Coin Chest resumed · ${total}× sell · ${formatTreasureClock(left)} left`,
        "treasure"
      );
    } else {
      if (luck) {
        state.luckBoostPaused = true;
        state.luckBoostPausedLeft = left;
        state.luckBoostUntil = 0;
      } else {
        state.moneyBoostPaused = true;
        state.moneyBoostPausedLeft = left;
        state.moneyBoostUntil = 0;
      }
      setCatchLine(
        luck
          ? `Luck Chest paused · ${formatTreasureClock(left)} saved · 1.5× luck off`
          : `Coin Chest paused · ${formatTreasureClock(left)} saved · 2× sell off`,
        "treasure"
      );
    }
    playSfx("click");
    renderStats();
    saveState();
  }

  /** Local clock start of the current :00 or :30 block. */
  function localHalfHourStart(now = Date.now()) {
    const d = new Date(now);
    const start = new Date(d);
    start.setSeconds(0, 0);
    start.setMinutes(d.getMinutes() < 30 ? 0 : 30);
    return start.getTime();
  }

  function nextHalfHourStart(now = Date.now()) {
    return localHalfHourStart(now) + EVENT_MS;
  }

  /** Local clock start of the current hour (:00). */
  function localHourStart(now = Date.now()) {
    const d = new Date(now);
    const start = new Date(d);
    start.setMinutes(0, 0, 0);
    return start.getTime();
  }

  function nextHourStart(now = Date.now()) {
    return localHourStart(now) + LUCKY_BLOCK_EVENT_MS;
  }

  function luckyBlockHourSlotIndex(startTs) {
    return Math.floor(Number(startTs) / LUCKY_BLOCK_EVENT_MS);
  }

  /** Deterministic mult for a :00 Lucky Block hour so every client matches. */
  function luckyBlockEventMultForStart(startTs) {
    let x = (luckyBlockHourSlotIndex(startTs) * 2654435761) >>> 0;
    x ^= x >>> 16;
    x = Math.imul(x ^ (x >>> 13), 2246822519) >>> 0;
    // Separate salt from sell/luck slots so the rolls stay independent.
    x = Math.imul(x ^ 0x9e3779b9, 2246822519) >>> 0;
    return LUCKY_BLOCK_EVENT_MULT_OPTIONS[x % LUCKY_BLOCK_EVENT_MULT_OPTIONS.length];
  }

  function liveLuckyBlockEventMult(now = Date.now()) {
    const admin = adminLuckyBlockEventLive(now);
    if (admin) return clampAdminMult(admin.mult);
    if (scheduledLuckyBlockEventIsLive(now)) {
      return luckyBlockEventMultForStart(localHourStart(now));
    }
    return 1;
  }

  /** Scheduled Lucky Block hour (:00–:05). Independent of sell/luck. */
  function scheduledLuckyBlockEventIsLive(now = Date.now()) {
    const start = localHourStart(now);
    return now >= start && now < start + LUCKY_BLOCK_EVENT_ACTIVE_MS;
  }

  /** True during scheduled hour window or admin luckyblock override. */
  function luckyBlockEventIsLive(now = Date.now()) {
    return !!adminLuckyBlockEventLive(now) || scheduledLuckyBlockEventIsLive(now);
  }

  function luckyBlockEventMsLeft(now = Date.now()) {
    const admin = adminLuckyBlockEventLive(now);
    if (admin) return Math.max(0, admin.until - now);
    if (!scheduledLuckyBlockEventIsLive(now)) return 0;
    return Math.max(0, localHourStart(now) + LUCKY_BLOCK_EVENT_ACTIVE_MS - now);
  }

  function msUntilNextLuckyBlockEvent(now = Date.now()) {
    if (luckyBlockEventIsLive(now)) return luckyBlockEventMsLeft(now);
    return Math.max(0, nextHourStart(now) - now);
  }

  let adminBoostCache = null;
  let adminVariantCache = null;
  let adminChestCache = null;
  let adminLuckyBlockCache = null;
  let adminWeatherCache = null;
  let adminSpeedCache = null;
  let adminMutationCache = emptyMutationMap();
  let adminEventFetchedAt = 0;
  let adminEventPollTimer = 0;
  let adminAnnouncePollTimer = 0;
  let adminBusy = false;
  let adminRetryTimer = 0;
  let pendingAdminPush = null; // full { boost, variant, ... } bundle

  function playerNameLower() {
    try {
      return String(
        window.HubPlays?.getName?.() || localStorage.getItem("hub-player-name") || ""
      )
        .trim()
        .toLowerCase();
    } catch {
      return "";
    }
  }

  function isFishingOwner() {
    return FISHING_ADMIN_NAMES.has(playerNameLower());
  }

  function isFishingLimitedAdmin() {
    return FISHING_LIMITED_ADMIN_NAMES.has(playerNameLower());
  }

  /** Full owner or local-only limited admin (Hjalte). */
  function isFishingAdmin() {
    return isFishingOwner() || isFishingLimitedAdmin();
  }

  function canAdminGlobal() {
    return isFishingOwner();
  }

  function canAdminGiftOthers() {
    return isFishingOwner();
  }

  function adminEventRateLimited() {
    try {
      const until = Number(localStorage.getItem(ADMIN_EVENT_RATE_KEY) || 0);
      return Number.isFinite(until) && until > Date.now();
    } catch {
      return false;
    }
  }

  function markAdminEventRateLimited(ms = ADMIN_RATE_BACKOFF_MS) {
    try {
      localStorage.setItem(ADMIN_EVENT_RATE_KEY, String(Date.now() + Math.max(20_000, ms)));
    } catch {}
  }

  function clearAdminEventRateLimited() {
    try {
      localStorage.removeItem(ADMIN_EVENT_RATE_KEY);
    } catch {}
  }

  function clampAdminMult(n) {
    const v = Number(n);
    if (!Number.isFinite(v)) return ADMIN_DEFAULT_MULT;
    return Math.max(ADMIN_MIN_MULT, Math.min(ADMIN_MAX_MULT, Math.round(v * 100) / 100));
  }

  function clampAdminMinutes(n) {
    const v = Math.round(Number(n) * 2) / 2;
    if (!Number.isFinite(v)) return ADMIN_DEFAULT_MINUTES;
    return Math.max(1, Math.min(ADMIN_MAX_MINUTES, v));
  }

  const ADMIN_VARIANT_TARGETS = ["silver", "gold", "diamond", "rainbow", "shiny", "any"];

  function decodeVariantTarget(raw) {
    const parts = String(raw || "")
      .toLowerCase()
      .split(/[+&,/|\s]+/)
      .map((p) => p.trim())
      .filter(Boolean);
    let primary = "";
    let shiny = false;
    for (const p of parts) {
      if (p === "shiny") shiny = true;
      else if (VARIANT_PRIMARY.includes(p) || p === "any") primary = p;
    }
    return { primary, shiny };
  }

  function encodeVariantTarget(spec) {
    const bits = [];
    if (spec?.primary) bits.push(spec.primary);
    if (spec?.shiny) bits.push("shiny");
    return bits.join("+");
  }

  function normalizeAdminVariantTarget(raw) {
    const spec = decodeVariantTarget(raw);
    if (!spec.primary && !spec.shiny) return "";
    return encodeVariantTarget(spec);
  }

  function isVariantTargetSpec(raw) {
    const spec = decodeVariantTarget(raw);
    return !!(spec.primary || spec.shiny);
  }

  function formatAdminVariantLabel(target) {
    const spec = decodeVariantTarget(target);
    const bits = [];
    if (spec.primary === "any") bits.push("Any");
    else if (spec.primary) {
      bits.push(spec.primary.charAt(0).toUpperCase() + spec.primary.slice(1));
    }
    if (spec.shiny) bits.push("Shiny");
    if (!bits.length) return "Variant";
    return bits.join(" + ");
  }

  function adminEventKindLabel(e) {
    if (!e) return "";
    if (e.kind === "variant") return formatAdminVariantLabel(e.target);
    if (e.kind === "mutation") {
      const m = normalizeMutation(e.target) || "toxic";
      return m.charAt(0).toUpperCase() + m.slice(1);
    }
    if (e.kind === "chest") return "chests";
    if (e.kind === "luckyblock") return "lucky blocks";
    if (e.kind === "speed") return "cast speed";
    if (e.kind === "weather") {
      const id = normalizeAdminWeatherId(e.target);
      if (id === "storm") return "storm";
      if (id === "calm") return "calm seas";
      return "clear weather";
    }
    return e.kind === "luck" ? "luck" : "sell";
  }

  function parseAdminEventPayload(data, requireToken = false) {
    if (!data || typeof data !== "object") return null;
    if (requireToken && String(data.token || "") !== ADMIN_EVENT_TOKEN) return null;
    let kind = String(data.kind || "").toLowerCase();
    let weatherId = normalizeAdminWeatherId(data.target || data.weather || "");
    if (kind === "storm" || kind === "calm" || kind === "weather-none") {
      weatherId = normalizeAdminWeatherId(kind === "weather-none" ? "none" : kind);
      kind = "weather";
    }
    let mutationTarget = normalizeMutation(data.target || data.mutation || "");
    if (kind === "toxic" || MUTATIONS.includes(kind)) {
      mutationTarget = normalizeMutation(kind === "mutation" ? mutationTarget || "toxic" : kind) || "toxic";
      kind = "mutation";
    }
    let target = normalizeAdminVariantTarget(
      data.target || data.variant || (isVariantTargetSpec(kind) ? kind : "")
    );
    if (kind !== "luck" && kind !== "money" && kind !== "variant" && isVariantTargetSpec(kind)) {
      target = normalizeAdminVariantTarget(kind);
      kind = "variant";
    }
    if (
      kind !== "luck" &&
      kind !== "money" &&
      kind !== "variant" &&
      kind !== "mutation" &&
      kind !== "chest" &&
      kind !== "luckyblock" &&
      kind !== "speed" &&
      kind !== "weather"
    ) {
      return null;
    }
    if (kind === "variant" && !target) target = "gold";
    if (kind === "mutation") {
      mutationTarget = mutationTarget || normalizeMutation(data.target) || "toxic";
      if (!mutationTarget) return null;
      target = mutationTarget;
    }
    if (kind === "weather") {
      weatherId = weatherId || normalizeAdminWeatherId(data.target) || "storm";
      if (!weatherId) return null;
      target = weatherId;
    }
    const until = Math.floor(Number(data.until) || 0);
    if (!Number.isFinite(until) || until <= Date.now()) return null;
    const startedAt = Math.floor(Number(data.startedAt) || until - EVENT_ACTIVE_MS);
    return {
      kind,
      target:
        kind === "variant" || kind === "weather" || kind === "mutation" ? target : "",
      until,
      startedAt: Number.isFinite(startedAt) ? startedAt : Date.now(),
      mult: kind === "weather" ? 1 : clampAdminMult(data.mult ?? ADMIN_DEFAULT_MULT),
      scope: String(data.scope || "") || ""
    };
  }

  /** Parse boost + variant + chest + luckyblock + weather + mutation + speed channels. */
  function parseAdminBundle(data, requireToken = false) {
    if (!data || typeof data !== "object") {
      return {
        boost: null,
        variant: null,
        chest: null,
        luckyblock: null,
        weather: null,
        mutation: null,
        speed: null
      };
    }
    if (requireToken && String(data.token || "") !== ADMIN_EVENT_TOKEN) {
      return {
        boost: null,
        variant: null,
        chest: null,
        luckyblock: null,
        weather: null,
        mutation: null,
        speed: null
      };
    }
    const inherit = { token: data.token || (requireToken ? ADMIN_EVENT_TOKEN : undefined) };
    let boost = null;
    let variant = null;
    let chest = null;
    let luckyblock = null;
    let weather = null;
    let mutation = null;
    let speed = null;
    if (data.boost && typeof data.boost === "object") {
      boost = parseAdminEventPayload({ ...inherit, ...data.boost }, requireToken);
      if (boost && !isBoostAdminPayload(boost)) boost = null;
    }
    if (data.variantEvt && typeof data.variantEvt === "object") {
      variant = parseAdminEventPayload(
        { ...inherit, kind: "variant", ...data.variantEvt },
        requireToken
      );
      if (variant && !isVariantAdminPayload(variant)) variant = null;
    } else if (data.variant && typeof data.variant === "object" && (data.variant.until || data.variant.kind)) {
      variant = parseAdminEventPayload(
        { ...inherit, kind: data.variant.kind || "variant", ...data.variant },
        requireToken
      );
      if (variant && !isVariantAdminPayload(variant)) variant = null;
    }
    if (data.chest && typeof data.chest === "object") {
      chest = parseAdminEventPayload(
        { ...inherit, kind: data.chest.kind || "chest", ...data.chest },
        requireToken
      );
      if (chest && !isChestAdminPayload(chest)) chest = null;
    }
    if (data.luckyblock && typeof data.luckyblock === "object") {
      luckyblock = parseAdminEventPayload(
        { ...inherit, kind: data.luckyblock.kind || "luckyblock", ...data.luckyblock },
        requireToken
      );
      if (luckyblock && !isLuckyBlockAdminPayload(luckyblock)) luckyblock = null;
    }
    if (data.weather && typeof data.weather === "object") {
      weather = parseAdminEventPayload(
        { ...inherit, kind: data.weather.kind || "weather", ...data.weather },
        requireToken
      );
      if (weather && !isWeatherAdminPayload(weather)) weather = null;
    }
    if (data.speed && typeof data.speed === "object") {
      speed = parseAdminEventPayload(
        { ...inherit, kind: data.speed.kind || "speed", ...data.speed },
        requireToken
      );
      if (speed && !isSpeedAdminPayload(speed)) speed = null;
    }
    if (data.mutation && typeof data.mutation === "object") {
      mutation = parseMutationMap(data.mutation, requireToken, inherit);
    } else {
      mutation = emptyMutationMap();
    }
    const single = parseAdminEventPayload(
      requireToken ? data : { ...data, token: data.token },
      requireToken
    );
    if (single) {
      if (isBoostAdminPayload(single)) boost = pickBetterAdminEvent(boost, single);
      if (isVariantAdminPayload(single)) variant = pickBetterAdminEvent(variant, single);
      if (isChestAdminPayload(single)) chest = pickBetterAdminEvent(chest, single);
      if (isLuckyBlockAdminPayload(single)) luckyblock = pickBetterAdminEvent(luckyblock, single);
      if (isWeatherAdminPayload(single)) weather = pickBetterAdminEvent(weather, single);
      if (isSpeedAdminPayload(single)) speed = pickBetterAdminEvent(speed, single);
      if (isMutationAdminPayload(single)) {
        mutation = mergeMutationMaps(mutation, parseMutationMap(single, requireToken, inherit));
      }
    }
    return { boost, variant, chest, luckyblock, weather, mutation, speed };
  }

  function isBoostAdminPayload(e) {
    return !!e && (e.kind === "luck" || e.kind === "money");
  }

  function isVariantAdminPayload(e) {
    return !!e && e.kind === "variant";
  }

  function isMutationAdminPayload(e) {
    return !!e && e.kind === "mutation" && !!normalizeMutation(e.target);
  }

  function emptyMutationMap() {
    return { toxic: null, lava: null, neon: null };
  }

  /** Normalize legacy single mutation OR { toxic, lava, neon } map. */
  function parseMutationMap(raw, requireToken = false, inherit = {}) {
    const map = emptyMutationMap();
    if (!raw || typeof raw !== "object") return map;
    const keyed = MUTATIONS.some((m) => raw[m] && typeof raw[m] === "object");
    if (keyed) {
      MUTATIONS.forEach((m) => {
        const src = raw[m];
        if (!src || typeof src !== "object") return;
        const e = parseAdminEventPayload(
          { ...inherit, ...src, kind: "mutation", target: m },
          requireToken
        );
        if (e && isMutationAdminPayload(e)) map[m] = { ...e, kind: "mutation", target: m };
      });
      return map;
    }
    const single = parseAdminEventPayload(
      { ...inherit, kind: raw.kind || "mutation", ...raw },
      requireToken
    );
    if (single && isMutationAdminPayload(single)) {
      const t = normalizeMutation(single.target);
      if (t) map[t] = { ...single, kind: "mutation", target: t };
    }
    return map;
  }

  function mutationMapHasAny(map) {
    if (!map || typeof map !== "object") return false;
    return MUTATIONS.some((m) => isMutationAdminPayload(map[m]));
  }

  function mergeMutationMaps(a, b) {
    const out = emptyMutationMap();
    MUTATIONS.forEach((m) => {
      out[m] = pickBetterAdminEvent(a?.[m] || null, b?.[m] || null);
    });
    return out;
  }

  function pruneMutationMap(map, now = Date.now()) {
    const out = emptyMutationMap();
    if (!map || typeof map !== "object") return out;
    MUTATIONS.forEach((m) => {
      const e = map[m];
      if (e && isMutationAdminPayload(e) && e.until > now) out[m] = e;
    });
    return out;
  }

  function serializeMutationMap(map, now = Date.now()) {
    const live = pruneMutationMap(map, now);
    if (!mutationMapHasAny(live)) return null;
    const out = {};
    MUTATIONS.forEach((m) => {
      if (live[m]) out[m] = serializeAdminChannel(live[m]);
    });
    return out;
  }

  function adminMutationEventsLive(now = Date.now()) {
    const map = mergeMutationMaps(adminMutationCache, localAdminMutation());
    const list = [];
    MUTATIONS.forEach((m) => {
      const e = map?.[m];
      if (e && isMutationAdminPayload(e) && now < e.until) list.push(e);
    });
    return list;
  }

  function formatLiveMutationBits(now = Date.now()) {
    return adminMutationEventsLive(now).map(
      (e) => `${formatMult(e.mult)}× ${adminEventKindLabel(e)}`
    );
  }

  function isChestAdminPayload(e) {
    return !!e && e.kind === "chest";
  }

  function isLuckyBlockAdminPayload(e) {
    return !!e && e.kind === "luckyblock";
  }

  function isWeatherAdminPayload(e) {
    return !!e && e.kind === "weather" && !!normalizeAdminWeatherId(e.target);
  }

  function isSpeedAdminPayload(e) {
    return !!e && e.kind === "speed";
  }

  function pickBetterAdminEvent(a, b) {
    if (!a) return b || null;
    if (!b) return a;
    if (a.until !== b.until) return a.until >= b.until ? a : b;
    return (a.mult || 0) >= (b.mult || 0) ? a : b;
  }

  function readStoredAdmin(key) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  function writeStoredAdmin(key, data) {
    try {
      if (!data) localStorage.removeItem(key);
      else localStorage.setItem(key, JSON.stringify(data));
    } catch {}
  }

  let adminLocalMigrated = false;

  function migrateLegacyAdminLocal() {
    if (adminLocalMigrated) return;
    adminLocalMigrated = true;
    const legacy = parseAdminEventPayload(readStoredAdmin(ADMIN_EVENT_LOCAL_KEY), true);
    if (!legacy) {
      writeStoredAdmin(ADMIN_EVENT_LOCAL_KEY, null);
      return;
    }
    const stored = {
      ...legacy,
      token: ADMIN_EVENT_TOKEN,
      scope: legacy.scope || "local"
    };
    if (isBoostAdminPayload(legacy) && !readStoredAdmin(ADMIN_EVENT_LOCAL_BOOST_KEY)) {
      writeStoredAdmin(ADMIN_EVENT_LOCAL_BOOST_KEY, stored);
    }
    if (isVariantAdminPayload(legacy) && !readStoredAdmin(ADMIN_EVENT_LOCAL_VARIANT_KEY)) {
      writeStoredAdmin(ADMIN_EVENT_LOCAL_VARIANT_KEY, stored);
    }
    writeStoredAdmin(ADMIN_EVENT_LOCAL_KEY, null);
  }

  function localAdminBoost() {
    migrateLegacyAdminLocal();
    return parseAdminEventPayload(readStoredAdmin(ADMIN_EVENT_LOCAL_BOOST_KEY), true);
  }

  function localAdminVariant() {
    migrateLegacyAdminLocal();
    return parseAdminEventPayload(readStoredAdmin(ADMIN_EVENT_LOCAL_VARIANT_KEY), true);
  }

  function setLocalAdminBoost(payload, clear = false) {
    if (clear) writeStoredAdmin(ADMIN_EVENT_LOCAL_BOOST_KEY, null);
    else writeStoredAdmin(ADMIN_EVENT_LOCAL_BOOST_KEY, payload);
  }

  function setLocalAdminVariant(payload, clear = false) {
    if (clear) writeStoredAdmin(ADMIN_EVENT_LOCAL_VARIANT_KEY, null);
    else writeStoredAdmin(ADMIN_EVENT_LOCAL_VARIANT_KEY, payload);
  }

  function localAdminChest() {
    migrateLegacyAdminLocal();
    return parseAdminEventPayload(readStoredAdmin(ADMIN_EVENT_LOCAL_CHEST_KEY), true);
  }

  function setLocalAdminChest(payload, clear = false) {
    if (clear) writeStoredAdmin(ADMIN_EVENT_LOCAL_CHEST_KEY, null);
    else writeStoredAdmin(ADMIN_EVENT_LOCAL_CHEST_KEY, payload);
  }

  function localAdminLuckyBlock() {
    migrateLegacyAdminLocal();
    return parseAdminEventPayload(readStoredAdmin(ADMIN_EVENT_LOCAL_LB_KEY), true);
  }

  function setLocalAdminLuckyBlock(payload, clear = false) {
    if (clear) writeStoredAdmin(ADMIN_EVENT_LOCAL_LB_KEY, null);
    else writeStoredAdmin(ADMIN_EVENT_LOCAL_LB_KEY, payload);
  }

  function localAdminWeather() {
    migrateLegacyAdminLocal();
    return parseAdminEventPayload(readStoredAdmin(ADMIN_EVENT_LOCAL_WEATHER_KEY), true);
  }

  function setLocalAdminWeather(payload, clear = false) {
    if (clear) writeStoredAdmin(ADMIN_EVENT_LOCAL_WEATHER_KEY, null);
    else writeStoredAdmin(ADMIN_EVENT_LOCAL_WEATHER_KEY, payload);
  }

  function localAdminSpeed() {
    return parseAdminEventPayload(readStoredAdmin(ADMIN_EVENT_LOCAL_SPEED_KEY), true);
  }

  function setLocalAdminSpeed(payload, clear = false) {
    if (clear) writeStoredAdmin(ADMIN_EVENT_LOCAL_SPEED_KEY, null);
    else writeStoredAdmin(ADMIN_EVENT_LOCAL_SPEED_KEY, payload);
  }

  function localAdminMutation() {
    migrateLegacyAdminLocal();
    return parseMutationMap(readStoredAdmin(ADMIN_EVENT_LOCAL_MUTATION_KEY), true, {
      token: ADMIN_EVENT_TOKEN
    });
  }

  function writeLocalMutationMap(map) {
    const live = pruneMutationMap(map);
    if (!mutationMapHasAny(live)) {
      writeStoredAdmin(ADMIN_EVENT_LOCAL_MUTATION_KEY, null);
      return;
    }
    const payload = { token: ADMIN_EVENT_TOKEN, scope: "local" };
    MUTATIONS.forEach((m) => {
      if (live[m]) {
        payload[m] = {
          ...serializeAdminChannel(live[m]),
          token: ADMIN_EVENT_TOKEN,
          scope: live[m].scope || "local"
        };
      }
    });
    writeStoredAdmin(ADMIN_EVENT_LOCAL_MUTATION_KEY, payload);
  }

  function setLocalAdminMutation(payload, clear = false, clearTarget = "") {
    if (clear) {
      const target = normalizeMutation(clearTarget);
      if (target) {
        const map = localAdminMutation();
        map[target] = null;
        writeLocalMutationMap(map);
      } else {
        writeStoredAdmin(ADMIN_EVENT_LOCAL_MUTATION_KEY, null);
      }
      return;
    }
    const e = parseAdminEventPayload(payload, true);
    if (!e || !isMutationAdminPayload(e)) return;
    const map = localAdminMutation();
    map[normalizeMutation(e.target)] = e;
    // Preserve scope from payload on the stored blob
    const scope = String(payload?.scope || e.scope || "local");
    MUTATIONS.forEach((m) => {
      if (map[m]) map[m] = { ...map[m], scope: m === e.target ? scope : map[m].scope || scope };
    });
    writeLocalMutationMap(map);
  }

  function adminWeatherEventLive(now = Date.now()) {
    const e = pickBetterAdminEvent(adminWeatherCache, localAdminWeather());
    if (!e || !isWeatherAdminPayload(e) || now >= e.until) return null;
    return { ...e, weatherId: normalizeAdminWeatherId(e.target) };
  }

  function adminBoostEventLive(now = Date.now()) {
    const e = pickBetterAdminEvent(adminBoostCache, localAdminBoost());
    if (!e || now >= e.until) return null;
    return e;
  }

  function adminVariantEventLive(now = Date.now()) {
    const e = pickBetterAdminEvent(adminVariantCache, localAdminVariant());
    if (!e || now >= e.until) return null;
    return e;
  }

  /** Any live mutation (prefers highest-value type for single-slot callers). */
  function adminMutationEventLive(now = Date.now()) {
    const list = adminMutationEventsLive(now);
    if (!list.length) return null;
    return list.reduce((best, e) => {
      if (!best) return e;
      const bm = MUTATION_MULT[best.target] || 0;
      const em = MUTATION_MULT[e.target] || 0;
      if (em !== bm) return em > bm ? e : best;
      return e.until >= best.until ? e : best;
    }, null);
  }

  function adminChestEventLive(now = Date.now()) {
    const e = pickBetterAdminEvent(adminChestCache, localAdminChest());
    if (!e || now >= e.until) return null;
    return e;
  }

  function adminLuckyBlockEventLive(now = Date.now()) {
    const e = pickBetterAdminEvent(adminLuckyBlockCache, localAdminLuckyBlock());
    if (!e || now >= e.until) return null;
    return e;
  }

  function adminSpeedEventLive(now = Date.now()) {
    const e = pickBetterAdminEvent(adminSpeedCache, localAdminSpeed());
    if (!e || !isSpeedAdminPayload(e) || now >= e.until) return null;
    return e;
  }

  function eventChestMult(now = Date.now()) {
    const e = adminChestEventLive(now);
    return e ? Math.max(1, Number(e.mult) || 1) : 1;
  }

  /**
   * Drop chance for Astral / Absolute Lucky Blocks.
   * Scheduled hour = base 0.1% × rolled 1×/1.5×/2×/3×. Admin mult scales the same base.
   * 90% catch book: ×1.25 while an event is live. 100%: base 0.1% even outside events.
   * Luck gear / luck chests / luck events never change this.
   */
  function luckyBlockEventChance(now = Date.now()) {
    const admin = adminLuckyBlockEventLive(now);
    const scheduled = scheduledLuckyBlockEventIsLive(now);
    const always = hasCollectionLbAlwaysBonus();
    if (!admin && !scheduled && !always) return 0;
    let p = 0;
    if (scheduled) {
      p = Math.max(
        p,
        LUCKY_BLOCK_EVENT_CHANCE * luckyBlockEventMultForStart(localHourStart(now))
      );
    }
    if (admin) {
      p = Math.max(p, LUCKY_BLOCK_EVENT_CHANCE * clampAdminMult(admin.mult));
    }
    if (always && !admin && !scheduled) {
      p = Math.max(p, LUCKY_BLOCK_EVENT_CHANCE);
    }
    if ((admin || scheduled) && hasCollectionLbEventBonus()) {
      p *= collectionLbEventMult();
    }
    return Math.min(0.25, p);
  }

  /** Zenith Lucky Block drop — base 0.1% × event mult (same collection rules). */
  function luckyBlockZenithEventChance(now = Date.now()) {
    const admin = adminLuckyBlockEventLive(now);
    const scheduled = scheduledLuckyBlockEventIsLive(now);
    const always = hasCollectionLbAlwaysBonus();
    if (!admin && !scheduled && !always) return 0;
    let p = 0;
    if (scheduled) {
      p = Math.max(
        p,
        LUCKY_BLOCK_ZENITH_EVENT_CHANCE * luckyBlockEventMultForStart(localHourStart(now))
      );
    }
    if (admin) {
      p = Math.max(p, LUCKY_BLOCK_ZENITH_EVENT_CHANCE * clampAdminMult(admin.mult));
    }
    if (always && !admin && !scheduled) {
      p = Math.max(p, LUCKY_BLOCK_ZENITH_EVENT_CHANCE);
    }
    if ((admin || scheduled) && hasCollectionLbEventBonus()) {
      p *= collectionLbEventMult();
    }
    return Math.min(0.25, p);
  }

  function formatLuckyBlockChancePct(now = Date.now(), chanceFn = luckyBlockEventChance) {
    const p = chanceFn(now) * 100;
    if (p >= 1) return `${p.toFixed(2)}%`;
    if (p >= 0.1) return `${p.toFixed(2)}%`;
    return `${p.toFixed(3)}%`;
  }

  function formatLuckyBlockEventLabel(now = Date.now()) {
    const admin = adminLuckyBlockEventLive(now);
    const scheduled = scheduledLuckyBlockEventIsLive(now);
    const mult = liveLuckyBlockEventMult(now);
    const astral = formatLuckyBlockChancePct(now);
    const zenith = formatLuckyBlockChancePct(now, luckyBlockZenithEventChance);
    if (admin || scheduled) {
      const boost =
        hasCollectionLbEventBonus() && collectionLbEventMult() > 1
          ? ` · book ${formatMult(collectionLbEventMult())}×`
          : "";
      return `${formatMult(mult)}× Lucky Blocks ${astral} · Zenith ${zenith}${boost}`;
    }
    if (hasCollectionLbAlwaysBonus()) {
      return `Book 100% Lucky Blocks ${astral} · Zenith ${zenith}`;
    }
    return `${formatMult(mult)}× Lucky Blocks ${astral} · Zenith ${zenith}`;
  }

  function serializeAdminChannel(e) {
    if (!e) return null;
    return {
      kind: e.kind,
      target: e.target || "",
      until: e.until,
      startedAt: e.startedAt,
      mult: e.mult
    };
  }

  function buildAdminSyncBundle(scope = getAdminScope()) {
    const boost = localAdminBoost() || adminBoostCache;
    const variant = localAdminVariant() || adminVariantCache;
    const chest = localAdminChest() || adminChestCache;
    const luckyblock = localAdminLuckyBlock() || adminLuckyBlockCache;
    const weather = localAdminWeather() || adminWeatherCache;
    const speed = localAdminSpeed() || adminSpeedCache;
    const mutationMap = mergeMutationMaps(localAdminMutation(), adminMutationCache);
    const now = Date.now();
    const liveBoost = boost && boost.until > now ? boost : null;
    const liveVariant = variant && variant.until > now ? variant : null;
    const liveChest = chest && chest.until > now ? chest : null;
    const liveLb = luckyblock && luckyblock.until > now ? luckyblock : null;
    const liveWeather = weather && weather.until > now ? weather : null;
    const liveSpeed = speed && speed.until > now ? speed : null;
    const liveMutations = pruneMutationMap(mutationMap, now);
    const liveMutationList = MUTATIONS.map((m) => liveMutations[m]).filter(Boolean);
    const liveMutation = liveMutationList[0] || null;
    const mutationUntil = liveMutationList.reduce((max, e) => Math.max(max, e.until || 0), 0);
    const mutationStarted = liveMutationList.reduce(
      (max, e) => Math.max(max, e.startedAt || 0),
      0
    );
    return {
      token: ADMIN_EVENT_TOKEN,
      scope: scope === "global" ? "global" : "local",
      boost: serializeAdminChannel(liveBoost),
      variant: serializeAdminChannel(liveVariant),
      chest: serializeAdminChannel(liveChest),
      luckyblock: serializeAdminChannel(liveLb),
      weather: serializeAdminChannel(liveWeather),
      speed: serializeAdminChannel(liveSpeed),
      mutation: serializeMutationMap(liveMutations, now),
      // Legacy flat fields = boost preferred, else variant (old clients)
      kind:
        liveBoost?.kind ||
        liveVariant?.kind ||
        liveMutation?.kind ||
        liveChest?.kind ||
        liveLb?.kind ||
        liveSpeed?.kind ||
        liveWeather?.kind ||
        "luck",
      target: liveVariant?.target || liveMutation?.target || liveWeather?.target || "",
      until: Math.max(
        liveBoost?.until || 0,
        liveVariant?.until || 0,
        mutationUntil,
        liveChest?.until || 0,
        liveLb?.until || 0,
        liveSpeed?.until || 0,
        liveWeather?.until || 0
      ),
      startedAt: Math.max(
        liveBoost?.startedAt || 0,
        liveVariant?.startedAt || 0,
        mutationStarted,
        liveChest?.startedAt || 0,
        liveLb?.startedAt || 0,
        liveSpeed?.startedAt || 0,
        liveWeather?.startedAt || 0,
        now
      ),
      mult:
        liveBoost?.mult ||
        liveVariant?.mult ||
        liveMutation?.mult ||
        liveChest?.mult ||
        liveLb?.mult ||
        liveSpeed?.mult ||
        liveWeather?.mult ||
        ADMIN_DEFAULT_MULT,
      note: scope === "global" ? "in-game-admin-global" : "in-game-admin-local",
      by: OWNER_NAME
    };
  }

  async function fetchAdminJson(url, { trackRate = false } = {}) {
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (res.status === 429) {
        if (trackRate) markAdminEventRateLimited();
        return { rateLimited: true, data: null, ok: false };
      }
      if (res.status === 404) return { rateLimited: false, data: null, ok: true };
      if (!res.ok) return { rateLimited: false, data: null, ok: false };
      return { rateLimited: false, data: await res.json(), ok: true };
    } catch {
      return { rateLimited: false, data: null, ok: false };
    }
  }

  async function pollAdminEvent(force = false) {
    const now = Date.now();
    if (!force && now - adminEventFetchedAt < ADMIN_EVENT_POLL_MS) return;
    adminEventFetchedAt = now;

    const file = await fetchAdminJson(`${ADMIN_EVENT_URL}?t=${now}`, { trackRate: false });
    let supabaseData = null;
    const api = fishingSb();
    if (api) {
      try {
        supabaseData = await api.getDoc(ADMIN_EVENT_DOC);
      } catch {
        supabaseData = null;
      }
    }
    let mantleData = null;
    if (!adminEventRateLimited()) {
      const mantle = await fetchAdminJson(ADMIN_EVENT_API, { trackRate: true });
      if (mantle.ok && !mantle.rateLimited) clearAdminEventRateLimited();
      mantleData = mantle.data;
    }

    const remoteSb = parseAdminBundle(supabaseData, false);
    const remoteA = parseAdminBundle(mantleData, true);
    const remoteB = parseAdminBundle(file.data, false);
    const remoteBoost = pickBetterAdminEvent(
      pickBetterAdminEvent(remoteSb.boost, remoteA.boost),
      remoteB.boost
    );
    const remoteVariant = pickBetterAdminEvent(
      pickBetterAdminEvent(remoteSb.variant, remoteA.variant),
      remoteB.variant
    );
    const remoteChest = pickBetterAdminEvent(
      pickBetterAdminEvent(remoteSb.chest, remoteA.chest),
      remoteB.chest
    );
    const remoteLb = pickBetterAdminEvent(
      pickBetterAdminEvent(remoteSb.luckyblock, remoteA.luckyblock),
      remoteB.luckyblock
    );
    const remoteWeather = pickBetterAdminEvent(
      pickBetterAdminEvent(remoteSb.weather, remoteA.weather),
      remoteB.weather
    );
    const remoteSpeed = pickBetterAdminEvent(
      pickBetterAdminEvent(remoteSb.speed, remoteA.speed),
      remoteB.speed
    );
    const remoteMutation = mergeMutationMaps(
      mergeMutationMaps(remoteSb.mutation, remoteA.mutation),
      remoteB.mutation
    );
    adminBoostCache = pickBetterAdminEvent(remoteBoost, localAdminBoost());
    adminVariantCache = pickBetterAdminEvent(remoteVariant, localAdminVariant());
    adminChestCache = pickBetterAdminEvent(remoteChest, localAdminChest());
    adminLuckyBlockCache = pickBetterAdminEvent(remoteLb, localAdminLuckyBlock());
    adminWeatherCache = pickBetterAdminEvent(remoteWeather, localAdminWeather());
    adminSpeedCache = pickBetterAdminEvent(remoteSpeed, localAdminSpeed());
    adminMutationCache = mergeMutationMaps(remoteMutation, localAdminMutation());
    syncAdminPanel();
    maybeRetryPendingAdminPush();
    applyWeatherFx();
    syncAdminSpeedFx();
  }

  function startAdminEventPolling() {
    migrateLegacyAdminLocal();
    restorePendingAdminPush();
    pollAdminEvent(true);
    pollAdminAnnounce(true);
    if (adminEventPollTimer) clearInterval(adminEventPollTimer);
    adminEventPollTimer = setInterval(() => {
      pollAdminEvent(false);
    }, ADMIN_EVENT_POLL_MS);
    if (adminAnnouncePollTimer) clearInterval(adminAnnouncePollTimer);
    adminAnnouncePollTimer = setInterval(() => {
      pollAdminAnnounce(false);
    }, ADMIN_ANNOUNCE_POLL_MS);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") pollAdminAnnounce(true);
    });
  }

  let adminAnnounceCache = null;
  let adminAnnounceFetchedAt = 0;
  let adminAnnounceHideTimer = 0;
  let lastShownAnnounceId = "";
  try {
    lastShownAnnounceId = String(localStorage.getItem(ADMIN_ANNOUNCE_SEEN_KEY) || "");
  } catch {
    lastShownAnnounceId = "";
  }

  function sanitizeAnnounceText(raw) {
    return String(raw || "")
      .replace(/[<>&"'`]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, ADMIN_ANNOUNCE_MAX_LEN);
  }

  function parseAnnouncePayload(data) {
    if (!data || typeof data !== "object") return null;
    if (String(data.token || "") !== ADMIN_EVENT_TOKEN) return null;
    const text = sanitizeAnnounceText(data.text);
    const id = String(data.id || "");
    const at = Math.floor(Number(data.at) || 0);
    const until = Math.floor(Number(data.until) || 0);
    if (!text || !id || !until) return null;
    if (until <= Date.now()) return null;
    return {
      id,
      text,
      at: at || Date.now(),
      until,
      by: String(data.by || OWNER_NAME).slice(0, 24)
    };
  }

  function readSeenAnnounceId() {
    try {
      return String(localStorage.getItem(ADMIN_ANNOUNCE_SEEN_KEY) || "");
    } catch {
      return "";
    }
  }

  function writeSeenAnnounceId(id) {
    lastShownAnnounceId = String(id || "");
    try {
      localStorage.setItem(ADMIN_ANNOUNCE_SEEN_KEY, lastShownAnnounceId);
    } catch {}
  }

  function hideAdminAnnouncePopup() {
    if (adminAnnounceHideTimer) {
      clearTimeout(adminAnnounceHideTimer);
      adminAnnounceHideTimer = 0;
    }
    const popup = document.getElementById("admin-announce-popup");
    if (!popup) return;
    popup.hidden = true;
    popup.classList.add("hidden");
    popup.classList.remove("is-show");
  }

  function showAdminAnnouncePopup(text) {
    const popup = document.getElementById("admin-announce-popup");
    const textEl = document.getElementById("admin-announce-text");
    if (!popup || !textEl) return;
    textEl.textContent = String(text || "");
    popup.hidden = false;
    popup.classList.remove("hidden");
    // retrigger enter animation
    popup.classList.remove("is-show");
    void popup.offsetWidth;
    popup.classList.add("is-show");
    if (adminAnnounceHideTimer) clearTimeout(adminAnnounceHideTimer);
    adminAnnounceHideTimer = setTimeout(() => {
      adminAnnounceHideTimer = 0;
      hideAdminAnnouncePopup();
    }, ADMIN_ANNOUNCE_POPUP_MS);
  }

  function showAdminAnnounce(msg, { alert = true } = {}) {
    if (!msg) {
      adminAnnounceCache = null;
      hideAdminAnnouncePopup();
      return;
    }
    adminAnnounceCache = msg;
    if (!alert) return;
    const seen = readSeenAnnounceId();
    if (msg.id && msg.id === seen) return;
    writeSeenAnnounceId(msg.id);
    showAdminAnnouncePopup(msg.text);
    setCatchLine(`ADMIN · ${msg.text}`, "treasure");
    playSfx("win");
  }

  async function fetchAdminAnnounceRemote() {
    // Supabase first — exit as soon as we have a live message (skip Mantle/file lag).
    const api = fishingSb();
    if (api) {
      try {
        const data = await api.getDoc(ADMIN_ANNOUNCE_DOC);
        const fromSb = parseAnnouncePayload(data);
        if (fromSb) return fromSb;
      } catch {
        /* fall through */
      }
    }
    let best = null;
    if (!adminEventRateLimited()) {
      try {
        const res = await fetch(`${ADMIN_ANNOUNCE_API}?t=${Date.now()}`, { cache: "no-store" });
        if (res.status === 429) markAdminEventRateLimited();
        else if (res.ok) {
          clearAdminEventRateLimited();
          best = parseAnnouncePayload(await res.json()) || best;
        }
      } catch {
        /* file */
      }
    }
    try {
      const res = await fetch(`${ADMIN_ANNOUNCE_URL}?t=${Date.now()}`, { cache: "no-store" });
      if (res.ok) {
        const parsed = parseAnnouncePayload(await res.json());
        if (parsed && (!best || parsed.at >= best.at)) best = parsed;
      }
    } catch {
      /* ignore */
    }
    return best;
  }

  async function pollAdminAnnounce(force = false) {
    const now = Date.now();
    if (!force && now - adminAnnounceFetchedAt < ADMIN_ANNOUNCE_POLL_MS) return;
    adminAnnounceFetchedAt = now;
    const remote = await fetchAdminAnnounceRemote();
    if (!remote) {
      if (adminAnnounceCache && adminAnnounceCache.until <= now) adminAnnounceCache = null;
      return;
    }
    showAdminAnnounce(remote, { alert: remote.id !== readSeenAnnounceId() });
  }

  async function pushAdminAnnounceRemote(payload) {
    let ok = false;
    const api = fishingSb();
    if (api) {
      try {
        await api.upsertDoc(ADMIN_ANNOUNCE_DOC, payload);
        ok = true;
      } catch {
        /* Mantle */
      }
    }
    if (!adminEventRateLimited()) {
      try {
        const res = await fetch(ADMIN_ANNOUNCE_API, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        if (res.status === 429) markAdminEventRateLimited();
        else if (res.ok) {
          clearAdminEventRateLimited();
          ok = true;
        }
      } catch {
        /* ignore */
      }
    }
    return ok;
  }

  async function publishAdminAnnounce(text) {
    if (!isFishingOwner()) {
      setCatchLine("Admin only", "miss");
      return false;
    }
    const clean = sanitizeAnnounceText(text);
    if (!clean) {
      setCatchLine("Type a message to send", "miss");
      return false;
    }
    const now = Date.now();
    const payload = {
      token: ADMIN_EVENT_TOKEN,
      id: `a-${now.toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
      text: clean,
      at: now,
      until: now + ADMIN_ANNOUNCE_CLAIM_MS,
      by: OWNER_NAME,
      note: "admin-announce"
    };
    showAdminAnnounce(payload, { alert: true });
    setCatchLine(`Sending admin message…`, "");
    const ok = await pushAdminAnnounceRemote(payload);
    if (!ok) {
      setCatchLine("Popup shown here · sync failed — try again", "miss");
      playSfx("miss");
      return false;
    }
    setCatchLine("Admin message sent", "treasure");
    playSfx("click");
    return true;
  }

  async function clearAdminAnnounce() {
    if (!isFishingOwner()) {
      setCatchLine("Admin only", "miss");
      return false;
    }
    const payload = {
      token: ADMIN_EVENT_TOKEN,
      id: "",
      text: "",
      at: Date.now(),
      until: 0,
      by: OWNER_NAME,
      note: "admin-announce-clear"
    };
    adminAnnounceCache = null;
    hideAdminAnnouncePopup();
    const ok = await pushAdminAnnounceRemote(payload);
    setCatchLine(ok ? "Admin message cleared" : "Cleared here · sync failed", ok ? "treasure" : "miss");
    if (!ok) playSfx("miss");
    return ok;
  }

  function parseAnnounceCommand(raw) {
    const original = String(raw || "").trim();
    if (!original) return null;
    const lower = original.toLowerCase();
    if (/^(clear|off|stop|end)\s+(say|announce|announcement|message|msg|broadcast)\b/.test(lower)) {
      return { kind: "clear-announce" };
    }
    const head = original.match(/^(say|announce|announcement|message|msg|broadcast)\b[:\s-]*/i);
    if (!head) return null;
    const text = sanitizeAnnounceText(original.slice(head[0].length));
    if (!text) return { kind: "announce", error: "Try: say Double XP this weekend" };
    return { kind: "announce", text };
  }

  function restorePendingAdminPush() {
    const pending = readStoredAdmin(ADMIN_EVENT_PENDING_KEY);
    if (!pending || typeof pending !== "object") return;
    if (String(pending.scope || "global") === "local") {
      writeStoredAdmin(ADMIN_EVENT_PENDING_KEY, null);
      return;
    }
    pendingAdminPush = pending;
    const bundle = parseAdminBundle(pending, true);
    if (bundle.boost) setLocalAdminBoost({ ...bundle.boost, token: ADMIN_EVENT_TOKEN, scope: "global" });
    if (bundle.variant) {
      setLocalAdminVariant({ ...bundle.variant, token: ADMIN_EVENT_TOKEN, scope: "global" });
    }
    if (bundle.chest) {
      setLocalAdminChest({ ...bundle.chest, token: ADMIN_EVENT_TOKEN, scope: "global" });
    }
    if (bundle.luckyblock) {
      setLocalAdminLuckyBlock({ ...bundle.luckyblock, token: ADMIN_EVENT_TOKEN, scope: "global" });
    }
    if (bundle.weather) {
      setLocalAdminWeather({ ...bundle.weather, token: ADMIN_EVENT_TOKEN, scope: "global" });
    }
    if (bundle.speed) {
      setLocalAdminSpeed({ ...bundle.speed, token: ADMIN_EVENT_TOKEN, scope: "global" });
    }
    if (mutationMapHasAny(bundle.mutation)) {
      MUTATIONS.forEach((m) => {
        const e = bundle.mutation?.[m];
        if (!e) return;
        setLocalAdminMutation({ ...e, token: ADMIN_EVENT_TOKEN, scope: "global" }, false);
      });
    }
    scheduleAdminRetry();
  }

  function scheduleAdminRetry() {
    if (adminRetryTimer) return;
    adminRetryTimer = setInterval(() => {
      maybeRetryPendingAdminPush();
    }, 20_000);
  }

  async function pushAdminBundleRemote(payload) {
    let ok = false;
    const api = fishingSb();
    if (api) {
      try {
        await api.upsertDoc(ADMIN_EVENT_DOC, payload);
        ok = true;
      } catch {
        /* Mantle / retry */
      }
    }
    if (adminEventRateLimited()) {
      return { ok, rateLimited: !ok };
    }
    try {
      const res = await fetch(ADMIN_EVENT_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (res.status === 429) {
        markAdminEventRateLimited();
        return { ok, rateLimited: true };
      }
      if (!res.ok) return { ok, rateLimited: false };
      clearAdminEventRateLimited();
      return { ok: true, rateLimited: false };
    } catch {
      return { ok, rateLimited: false };
    }
  }

  async function maybeRetryPendingAdminPush() {
    if (!pendingAdminPush || !isFishingOwner()) return;
    if (String(pendingAdminPush.scope || "global") === "local") {
      clearPendingAdminPush();
      return;
    }
    if (adminBusy) return;
    if (adminEventRateLimited() && !fishingSb()) return;
    const payload = pendingAdminPush;
    try {
      const result = await pushAdminBundleRemote(payload);
      if (!result.ok) {
        if (result.rateLimited) scheduleAdminRetry();
        return;
      }
      pendingAdminPush = null;
      writeStoredAdmin(ADMIN_EVENT_PENDING_KEY, null);
      if (adminRetryTimer) {
        clearInterval(adminRetryTimer);
        adminRetryTimer = 0;
      }
      const bundle = parseAdminBundle(payload, true);
      adminBoostCache = bundle.boost;
      adminVariantCache = bundle.variant;
      adminChestCache = bundle.chest;
      adminLuckyBlockCache = bundle.luckyblock;
      adminWeatherCache = bundle.weather;
      adminSpeedCache = bundle.speed;
      adminMutationCache = bundle.mutation || emptyMutationMap();
      syncAdminPanel();
      applyWeatherFx();
      syncAdminSpeedFx();
      setCatchLine("Admin event synced to all players", "treasure");
    } catch {
      /* keep pending */
    }
  }

  function syncAdminPanel() {
    const admin = isFishingAdmin();
    const full = canAdminGlobal();
    syncAdminSpeedFx();
    if (adminBtn) {
      adminBtn.classList.toggle("hidden", !admin);
      adminBtn.hidden = !admin;
    }
    if (adminOverlay && !admin) {
      adminOverlay.classList.add("hidden");
    }
    document.querySelectorAll("[data-admin-scope='global']").forEach((btn) => {
      btn.hidden = !full;
      btn.classList.toggle("hidden", !full);
      if (!full) btn.classList.remove("is-active");
    });
    if (!full && getAdminScope() === "global") setAdminScope("local");
    syncAdminScopeButtons();
    const status = document.getElementById("admin-status");
    if (!status || !admin) return;
    const boost = adminBoostEventLive();
    const variant = adminVariantEventLive();
    const mutationBits = formatLiveMutationBits();
    const chest = adminChestEventLive();
    const luckyblock = adminLuckyBlockEventLive();
    const weather = adminWeatherEventLive();
    const speed = adminSpeedEventLive();
    const pending = !!pendingAdminPush;
    const bits = [];
    if (boost) {
      const localOnly = String(readStoredAdmin(ADMIN_EVENT_LOCAL_BOOST_KEY)?.scope || "") === "local";
      bits.push(
        `${formatMult(boost.mult)}× ${adminEventKindLabel(boost)} (${localOnly ? "local" : pending ? "syncing" : "global"} · ${formatTreasureClock(boost.until - Date.now())})`
      );
    }
    if (variant) {
      const localOnly = String(readStoredAdmin(ADMIN_EVENT_LOCAL_VARIANT_KEY)?.scope || "") === "local";
      bits.push(
        `${formatMult(variant.mult)}× ${adminEventKindLabel(variant)} (${localOnly ? "local" : pending ? "syncing" : "global"} · ${formatTreasureClock(variant.until - Date.now())})`
      );
    }
    if (mutationBits.length) {
      const localMap = localAdminMutation();
      const localOnly = MUTATIONS.some(
        (m) => localMap[m] && String(localMap[m].scope || "") === "local"
      );
      adminMutationEventsLive().forEach((mutation) => {
        bits.push(
          `${formatMult(mutation.mult)}× ${adminEventKindLabel(mutation)} (${localOnly ? "local" : pending ? "syncing" : "global"} · ${formatTreasureClock(mutation.until - Date.now())})`
        );
      });
    }
    if (chest) {
      const localOnly = String(readStoredAdmin(ADMIN_EVENT_LOCAL_CHEST_KEY)?.scope || "") === "local";
      bits.push(
        `${formatMult(chest.mult)}× chests (${localOnly ? "local" : pending ? "syncing" : "global"} · ${formatTreasureClock(chest.until - Date.now())})`
      );
    }
    if (luckyblock) {
      const localOnly = String(readStoredAdmin(ADMIN_EVENT_LOCAL_LB_KEY)?.scope || "") === "local";
      bits.push(
        `${formatMult(luckyblock.mult)}× lucky blocks · ${formatLuckyBlockChancePct()} (${localOnly ? "local" : pending ? "syncing" : "global"} · ${formatTreasureClock(luckyblock.until - Date.now())})`
      );
    }
    if (weather) {
      const localOnly = String(readStoredAdmin(ADMIN_EVENT_LOCAL_WEATHER_KEY)?.scope || "") === "local";
      bits.push(
        `${adminEventKindLabel(weather)} (${localOnly ? "local" : pending ? "syncing" : "global"} · ${formatTreasureClock(weather.until - Date.now())})`
      );
    }
    if (speed) {
      const localOnly = String(readStoredAdmin(ADMIN_EVENT_LOCAL_SPEED_KEY)?.scope || "") === "local";
      bits.push(
        `${formatMult(speed.mult)}× cast speed (${localOnly ? "local" : pending ? "syncing" : "global"} · ${formatTreasureClock(speed.until - Date.now())})`
      );
    }
    if (bits.length) {
      status.textContent = `Live: ${bits.join(" · ")}`;
    } else {
      status.textContent =
        "No admin event · luck/sell, variant, toxic/lava/neon, chests, lucky blocks, cast speed, and weather can run together";
    }
  }

  function getAdminScope() {
    if (!canAdminGlobal()) return "local";
    try {
      const saved = String(localStorage.getItem(ADMIN_SCOPE_KEY) || "").toLowerCase();
      if (saved === "global" || saved === "local") return saved;
    } catch {}
    return "local";
  }

  function setAdminScope(scope) {
    if (!canAdminGlobal()) {
      try {
        localStorage.setItem(ADMIN_SCOPE_KEY, "local");
      } catch {}
      syncAdminScopeButtons();
      return "local";
    }
    const next = scope === "global" ? "global" : "local";
    try {
      localStorage.setItem(ADMIN_SCOPE_KEY, next);
    } catch {}
    syncAdminScopeButtons();
    return next;
  }

  function syncAdminScopeButtons() {
    const scope = getAdminScope();
    document.querySelectorAll("[data-admin-scope]").forEach((btn) => {
      btn.classList.toggle("is-active", btn.dataset.adminScope === scope);
    });
  }

  function openAdmin() {
    if (!isFishingAdmin()) return;
    syncAdminPanel();
    syncAdminHistoryButtons();
    adminOverlay?.classList.remove("hidden");
    lockPageScroll();
    document.getElementById("admin-cmd-input")?.focus?.();
  }

  function closeAdmin() {
    adminOverlay?.classList.add("hidden");
    hideAdminCmdSuggest();
    unlockPageScroll();
  }

  const ADMIN_CMD_HISTORY_KEY = "fishing-admin-cmd-history-v1";
  const ADMIN_CMD_HISTORY_MAX = 40;
  let adminCmdHistory = [];
  /** -1 = drafting new command; 0..n-1 = browsing history */
  let adminCmdHistoryIndex = -1;

  function loadAdminCmdHistory() {
    try {
      const raw = JSON.parse(localStorage.getItem(ADMIN_CMD_HISTORY_KEY) || "[]");
      if (!Array.isArray(raw)) return [];
      return raw
        .map((x) => String(x || "").trim())
        .filter(Boolean)
        .slice(-ADMIN_CMD_HISTORY_MAX);
    } catch {
      return [];
    }
  }

  function saveAdminCmdHistory() {
    try {
      localStorage.setItem(
        ADMIN_CMD_HISTORY_KEY,
        JSON.stringify(adminCmdHistory.slice(-ADMIN_CMD_HISTORY_MAX))
      );
    } catch {}
  }

  function syncAdminHistoryButtons() {
    const back = document.getElementById("admin-cmd-back");
    const forward = document.getElementById("admin-cmd-forward");
    if (!back || !forward) return;
    const len = adminCmdHistory.length;
    const canBack =
      len > 0 && (adminCmdHistoryIndex < 0 || adminCmdHistoryIndex > 0);
    const canForward = adminCmdHistoryIndex >= 0;
    back.disabled = !canBack;
    forward.disabled = !canForward;
  }

  function fillAdminCmdInput(text, { suggest = false } = {}) {
    const input = document.getElementById("admin-cmd-input");
    if (!input) return;
    input.value = String(text || "");
    hideAdminCmdSuggest();
    input.focus();
    try {
      const end = input.value.length;
      input.setSelectionRange(end, end);
    } catch {}
    if (suggest && input.value.trim()) refreshAdminCmdSuggest();
    else hideAdminCmdSuggest();
  }

  function pushAdminCmdHistory(raw) {
    const cmd = String(raw || "").trim();
    if (!cmd) return;
    if (adminCmdHistory[adminCmdHistory.length - 1] === cmd) {
      adminCmdHistoryIndex = -1;
      syncAdminHistoryButtons();
      return;
    }
    adminCmdHistory.push(cmd);
    if (adminCmdHistory.length > ADMIN_CMD_HISTORY_MAX) {
      adminCmdHistory = adminCmdHistory.slice(-ADMIN_CMD_HISTORY_MAX);
    }
    adminCmdHistoryIndex = -1;
    saveAdminCmdHistory();
    syncAdminHistoryButtons();
  }

  function adminCmdHistoryBack() {
    if (!adminCmdHistory.length) return;
    if (adminCmdHistoryIndex < 0) {
      adminCmdHistoryIndex = adminCmdHistory.length - 1;
    } else if (adminCmdHistoryIndex > 0) {
      adminCmdHistoryIndex -= 1;
    } else {
      return;
    }
    fillAdminCmdInput(adminCmdHistory[adminCmdHistoryIndex]);
    syncAdminHistoryButtons();
  }

  function adminCmdHistoryForward() {
    if (adminCmdHistoryIndex < 0) return;
    if (adminCmdHistoryIndex < adminCmdHistory.length - 1) {
      adminCmdHistoryIndex += 1;
      fillAdminCmdInput(adminCmdHistory[adminCmdHistoryIndex]);
    } else {
      adminCmdHistoryIndex = -1;
      fillAdminCmdInput("");
    }
    syncAdminHistoryButtons();
  }

  adminCmdHistory = loadAdminCmdHistory();

  const ADMIN_CMD_SUGGESTIONS = [
    "say ",
    "announce ",
    "clear say",
    "give fish ",
    "give soultwin",
    "give fish soultwin",
    "give me soul twin",
    "delete soultwin",
    "give astral luckyblock",
    "give absolute luckyblock",
    "give zenith luckyblock",
    "give coin chest",
    "give luck chest",
    "5x luck",
    "5x sell",
    "5x gold",
    "5x shiny",
    "5x shiny + gold",
    "5x toxic",
    "5x lava",
    "5x neon",
    "5x chest",
    "5x luckyblock",
    "2x speed",
    "5x speed",
    "storm",
    "calm",
    "sunny",
    "clear",
    "clear weather",
    "clear mutation",
    "clear toxic",
    "clear lava",
    "clear neon",
    "clear chest",
    "clear luckyblock",
    "clear speed",
    "luck",
    "sell",
    "speed",
    "gold",
    "shiny",
    "toxic",
    "lava",
    "neon",
    "chest",
    "luckyblock",
    "global",
    "local"
  ];

  let adminCmdSuggestItems = [];
  let adminCmdSuggestIndex = -1;

  function collectAdminPlayerNames() {
    const map = new Map();
    const add = (raw) => {
      const name = String(raw || "").trim();
      if (!name) return;
      if (/^guest-/i.test(name) || name.toLowerCase() === "player" || name.toLowerCase() === "guest") {
        return;
      }
      const key = name.toLowerCase();
      const prev = map.get(key);
      if (!prev || name.length > prev.length) map.set(key, name);
    };
    ["everyone", "me"].forEach(add);
    try {
      window.HubPlays?.getOnlinePlayers?.().forEach((p) => add(p?.name));
    } catch {}
    try {
      window.HubPlays?.getAllTimePlayers?.().forEach((p) => add(p?.name));
    } catch {}
    try {
      const names = window.HubPlays?.getStatus?.()?.names || {};
      Object.values(names).forEach((claim) => add(claim?.name));
    } catch {}
    try {
      window.HubFriends?.getFriends?.().forEach((f) => add(f?.name));
    } catch {}
    return [...map.values()].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
  }

  function scoreSuggestMatch(text, query) {
    const t = String(text || "").toLowerCase();
    const q = String(query || "").toLowerCase();
    if (!q) return 1;
    if (t === q) return 100;
    if (t.startsWith(q)) return 80 - Math.min(20, t.length - q.length);
    const parts = t.split(/[\s_+-]+/);
    if (parts.some((p) => p.startsWith(q))) return 55;
    if (t.includes(q)) return 30;
    return 0;
  }

  function buildAdminCmdSuggestions(value) {
    const raw = String(value || "");
    const lower = raw.toLowerCase();
    if (!raw.trim()) return [];

    const toMatch = lower.match(/^(.*?\bto\s+)(@?)([^\s]*)$/i);
    if (toMatch && /\b(give|gift)\b/.test(toMatch[1])) {
      const prefix = toMatch[3] || "";
      const head = raw.slice(0, raw.length - (toMatch[2].length + toMatch[3].length));
      return collectAdminPlayerNames()
        .map((name) => ({
          label: name,
          hint: name === "everyone" || name === "me" ? "target" : "player",
          value: `${head}${name}`,
          score: scoreSuggestMatch(name, prefix)
        }))
        .filter((item) => item.score > 0 || !prefix)
        .sort((a, b) => b.score - a.score || a.label.localeCompare(b.label))
        .slice(0, 8);
    }

    const fishHead = lower.match(/^(give|gift)\s+fish\s+/i);
    if (fishHead && !/\bto\b/.test(lower)) {
      const after = raw.slice(fishHead[0].length);
      const query = after.trim();
      const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
      const knownMods = new Set([
        ...VARIANT_PRIMARY,
        ...MUTATIONS,
        "shiny",
        "perfect",
        "normal",
        "plain",
        "base",
        "mutation"
      ]);
      const fishTokens = tokens.filter((t) => !knownMods.has(t) && !/^\d+x$|^x\d+$/i.test(t));
      const fishQuery = fishTokens.join(" ");
      const head = raw.slice(0, fishHead[0].length);
      const trailMods = tokens.filter((t) => knownMods.has(t)).join(" ");
      return FISH.map((f) => {
        const idScore = scoreSuggestMatch(f.id, fishQuery);
        const nameScore = scoreSuggestMatch(f.name, fishQuery);
        const score = Math.max(idScore, nameScore);
        return {
          label: f.name,
          hint: f.id,
          value: `${head}${f.id}${trailMods ? ` ${trailMods}` : ""} `,
          score
        };
      })
        .filter((item) => item.score > 0 || !fishQuery)
        .sort((a, b) => b.score - a.score || a.label.localeCompare(b.label))
        .slice(0, 8);
    }

    const q = lower.trim();
    return ADMIN_CMD_SUGGESTIONS.map((cmd) => ({
      label: cmd.trim(),
      hint: "command",
      value: cmd,
      score: scoreSuggestMatch(cmd, q)
    }))
      .filter((item) => item.score > 0 || !q)
      .sort((a, b) => b.score - a.score || a.label.localeCompare(b.label))
      .slice(0, 8);
  }

  function hideAdminCmdSuggest() {
    adminCmdSuggestItems = [];
    adminCmdSuggestIndex = -1;
    const list = document.getElementById("admin-cmd-suggest");
    if (!list) return;
    list.innerHTML = "";
    list.classList.add("hidden");
    list.hidden = true;
  }

  function renderAdminCmdSuggest(items) {
    const list = document.getElementById("admin-cmd-suggest");
    if (!list) return;
    adminCmdSuggestItems = items || [];
    adminCmdSuggestIndex = adminCmdSuggestItems.length ? 0 : -1;
    if (!adminCmdSuggestItems.length) {
      hideAdminCmdSuggest();
      return;
    }
    list.innerHTML = adminCmdSuggestItems
      .map(
        (item, i) => `
      <li role="presentation">
        <button type="button" class="admin-cmd-suggest-item${i === adminCmdSuggestIndex ? " is-active" : ""}" data-admin-suggest="${i}" role="option" aria-selected="${i === adminCmdSuggestIndex ? "true" : "false"}">
          ${escapeHtml(item.label)}
          <span>${escapeHtml(item.hint || "")}</span>
        </button>
      </li>`
      )
      .join("");
    list.classList.remove("hidden");
    list.hidden = false;
  }

  function refreshAdminCmdSuggest() {
    const input = document.getElementById("admin-cmd-input");
    if (!input || adminOverlay?.classList.contains("hidden")) {
      hideAdminCmdSuggest();
      return;
    }
    renderAdminCmdSuggest(buildAdminCmdSuggestions(input.value));
  }

  function applyAdminCmdSuggestion(index = adminCmdSuggestIndex) {
    const input = document.getElementById("admin-cmd-input");
    const item = adminCmdSuggestItems[index];
    if (!input || !item) return false;
    input.value = item.value;
    hideAdminCmdSuggest();
    input.focus();
    try {
      const end = input.value.length;
      input.setSelectionRange(end, end);
    } catch {}
    // If still mid-command (give fish / to …), keep suggesting
    refreshAdminCmdSuggest();
    return true;
  }

  function moveAdminCmdSuggest(delta) {
    if (!adminCmdSuggestItems.length) return;
    const len = adminCmdSuggestItems.length;
    adminCmdSuggestIndex = (adminCmdSuggestIndex + delta + len) % len;
    const list = document.getElementById("admin-cmd-suggest");
    list?.querySelectorAll(".admin-cmd-suggest-item").forEach((btn, i) => {
      btn.classList.toggle("is-active", i === adminCmdSuggestIndex);
      btn.setAttribute("aria-selected", i === adminCmdSuggestIndex ? "true" : "false");
      if (i === adminCmdSuggestIndex) btn.scrollIntoView({ block: "nearest" });
    });
  }

  function escapeHtml(raw) {
    return String(raw || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function readAdminFormDefaults() {
    const multEl = document.getElementById("admin-mult");
    const minsEl = document.getElementById("admin-mins");
    return {
      mult: clampAdminMult(multEl?.value ?? ADMIN_DEFAULT_MULT),
      minutes: clampAdminMinutes(minsEl?.value ?? ADMIN_DEFAULT_MINUTES),
      scope: getAdminScope()
    };
  }

  /** Gift qty: explicit Nx in the command, else Mult field (rounded, 1–50). */
  function resolveAdminGiftCount(explicitCount) {
    const n = Number(explicitCount);
    if (Number.isFinite(n) && n > 0) {
      return Math.min(50, Math.max(1, Math.round(n)));
    }
    const fromForm = Math.round(Number(readAdminFormDefaults().mult) || 1);
    return Math.min(50, Math.max(1, fromForm));
  }

  function applyAdminLocally(channel, payload, clear = false) {
    if (channel === "variant") {
      if (clear) {
        setLocalAdminVariant(null, true);
        adminVariantCache = null;
      } else {
        setLocalAdminVariant(payload, false);
        adminVariantCache = parseAdminEventPayload(payload, true);
      }
    } else if (channel === "chest") {
      if (clear) {
        setLocalAdminChest(null, true);
        adminChestCache = null;
      } else {
        setLocalAdminChest(payload, false);
        adminChestCache = parseAdminEventPayload(payload, true);
      }
    } else if (channel === "luckyblock") {
      if (clear) {
        setLocalAdminLuckyBlock(null, true);
        adminLuckyBlockCache = null;
      } else {
        setLocalAdminLuckyBlock(payload, false);
        adminLuckyBlockCache = parseAdminEventPayload(payload, true);
      }
    } else if (channel === "weather") {
      if (clear) {
        setLocalAdminWeather(null, true);
        adminWeatherCache = null;
      } else {
        setLocalAdminWeather(payload, false);
        adminWeatherCache = parseAdminEventPayload(payload, true);
      }
    } else if (channel === "mutation") {
      if (clear) {
        const clearTarget = normalizeMutation(payload?.target || payload?.clearTarget || "");
        setLocalAdminMutation(null, true, clearTarget);
        if (clearTarget) {
          adminMutationCache = mergeMutationMaps(adminMutationCache, emptyMutationMap());
          if (adminMutationCache) adminMutationCache[clearTarget] = null;
        } else {
          adminMutationCache = emptyMutationMap();
        }
      } else {
        setLocalAdminMutation(payload, false);
        const e = parseAdminEventPayload(payload, true);
        if (e && isMutationAdminPayload(e)) {
          const t = normalizeMutation(e.target);
          adminMutationCache = mergeMutationMaps(adminMutationCache, { [t]: e });
        }
      }
    } else if (channel === "boost") {
      if (clear) {
        setLocalAdminBoost(null, true);
        adminBoostCache = null;
      } else {
        setLocalAdminBoost(payload, false);
        adminBoostCache = parseAdminEventPayload(payload, true);
      }
    } else if (channel === "speed") {
      if (clear) {
        setLocalAdminSpeed(null, true);
        adminSpeedCache = null;
      } else {
        setLocalAdminSpeed(payload, false);
        adminSpeedCache = parseAdminEventPayload(payload, true);
      }
    } else if (channel === "all") {
      setLocalAdminBoost(null, true);
      setLocalAdminVariant(null, true);
      setLocalAdminMutation(null, true);
      setLocalAdminChest(null, true);
      setLocalAdminLuckyBlock(null, true);
      setLocalAdminWeather(null, true);
      setLocalAdminSpeed(null, true);
      adminBoostCache = null;
      adminVariantCache = null;
      adminMutationCache = emptyMutationMap();
      adminChestCache = null;
      adminLuckyBlockCache = null;
      adminWeatherCache = null;
      adminSpeedCache = null;
    }
    lastAnnouncedEventKey = "";
    lastAnnouncedVariantKey = "";
    lastAnnouncedMutationKey = "";
    lastAnnouncedChestKey = "";
    lastAnnouncedLbEventKey = "";
    syncAdminPanel();
    renderStats();
    if (channel === "weather" || channel === "all") applyWeatherFx();
    syncAdminSpeedFx();
  }

  function clearPendingAdminPush() {
    pendingAdminPush = null;
    writeStoredAdmin(ADMIN_EVENT_PENDING_KEY, null);
    if (adminRetryTimer) {
      clearInterval(adminRetryTimer);
      adminRetryTimer = 0;
    }
  }

  async function publishAdminEvent(
    kind,
    minutes = ADMIN_DEFAULT_MINUTES,
    mult = ADMIN_DEFAULT_MULT,
    scope = getAdminScope(),
    target = ""
  ) {
    if (!isFishingAdmin()) {
      setCatchLine("Admin commands are for ICE_DRAGON / approved testers only", "miss");
      return false;
    }
    if (adminBusy) return false;
    adminBusy = true;
    const now = Date.now();
    const mins = clampAdminMinutes(minutes);
    const eventMult = clampAdminMult(mult);
    const rawKind = String(kind || "").toLowerCase();
    const clearAll = !rawKind || rawKind === "clear" || rawKind === "off" || rawKind === "clear-all";
    const clearBoostOnly =
      rawKind === "clear-boost" ||
      rawKind === "clear-luck" ||
      rawKind === "clear-sell" ||
      rawKind === "clear-money";
    const clearVariantOnly = rawKind === "clear-variant";
    const clearToxicOnly = rawKind === "clear-toxic";
    const clearLavaOnly = rawKind === "clear-lava";
    const clearNeonOnly = rawKind === "clear-neon";
    const clearMutationOnly =
      rawKind === "clear-mutation" || rawKind === "clear-mutations";
    const clearLuckyBlockOnly =
      rawKind === "clear-luckyblock" || rawKind === "clear-lb" || rawKind === "clear-block";
    const clearChestOnly = rawKind === "clear-chest" || rawKind === "clear-chests";
    const clearWeatherOnly =
      rawKind === "clear-weather" || rawKind === "clear-wx" || rawKind === "clear-storm";
    const clearSpeedOnly =
      rawKind === "clear-speed" ||
      rawKind === "clear-cast" ||
      rawKind === "clear-cooldown" ||
      rawKind === "clear-wait";
    const wantGlobal = canAdminGlobal() && scope === "global";

    let eventKind = rawKind;
    let eventTarget = normalizeAdminVariantTarget(
      target || (isVariantTargetSpec(eventKind) ? eventKind : "")
    );
    let mutationTarget = normalizeMutation(
      target || (eventKind === "mutation" ? "toxic" : eventKind)
    );
    let weatherId = normalizeAdminWeatherId(
      eventKind === "weather" ? target : eventKind === "weather-none" ? "none" : eventKind
    );
    if (weatherId && eventKind !== "weather") {
      eventKind = "weather";
    }
    if (eventKind === "weather") {
      weatherId = weatherId || normalizeAdminWeatherId(target) || "storm";
      eventTarget = "";
      mutationTarget = "";
    }
    if (eventKind === "toxic" || eventKind === "mutation" || MUTATIONS.includes(eventKind)) {
      mutationTarget =
        normalizeMutation(eventKind === "mutation" ? mutationTarget || "toxic" : eventKind) ||
        "toxic";
      eventKind = "mutation";
      eventTarget = "";
    }
    if (
      eventKind === "speed" ||
      eventKind === "cast" ||
      eventKind === "cooldown" ||
      eventKind === "wait" ||
      eventKind === "faster"
    ) {
      eventKind = "speed";
      eventTarget = "";
      mutationTarget = "";
    }
    if (
      eventKind !== "luck" &&
      eventKind !== "money" &&
      eventKind !== "variant" &&
      eventKind !== "mutation" &&
      eventKind !== "chest" &&
      eventKind !== "luckyblock" &&
      eventKind !== "speed" &&
      eventKind !== "weather" &&
      isVariantTargetSpec(eventKind)
    ) {
      eventTarget = normalizeAdminVariantTarget(eventKind);
      eventKind = "variant";
    }
    if (eventKind === "variant" && !eventTarget) eventTarget = "gold";
    if (eventKind === "mutation" && !mutationTarget) mutationTarget = "toxic";

    const isClear =
      clearAll ||
      clearBoostOnly ||
      clearVariantOnly ||
      clearMutationOnly ||
      clearToxicOnly ||
      clearLavaOnly ||
      clearNeonOnly ||
      clearLuckyBlockOnly ||
      clearChestOnly ||
      clearWeatherOnly ||
      clearSpeedOnly;
    if (
      !isClear &&
      eventKind !== "luck" &&
      eventKind !== "money" &&
      eventKind !== "variant" &&
      eventKind !== "mutation" &&
      eventKind !== "chest" &&
      eventKind !== "luckyblock" &&
      eventKind !== "speed" &&
      eventKind !== "weather"
    ) {
      adminBusy = false;
      setCatchLine(
        "Try: 5x luck · 2x speed · 5x toxic · storm · 5x chest · 5x luckyblock · clear · clear speed",
        "miss"
      );
      return false;
    }

    const clearMutationTarget = clearToxicOnly
      ? "toxic"
      : clearLavaOnly
        ? "lava"
        : clearNeonOnly
          ? "neon"
          : "";

    const channel = clearAll
      ? "all"
      : clearVariantOnly
        ? "variant"
        : clearMutationOnly || clearToxicOnly || clearLavaOnly || clearNeonOnly
          ? "mutation"
          : clearChestOnly
            ? "chest"
            : clearLuckyBlockOnly
              ? "luckyblock"
              : clearWeatherOnly
                ? "weather"
                : clearSpeedOnly
                  ? "speed"
                  : clearBoostOnly
                    ? "boost"
                    : eventKind === "variant"
                      ? "variant"
                      : eventKind === "mutation"
                        ? "mutation"
                        : eventKind === "chest"
                          ? "chest"
                          : eventKind === "luckyblock"
                            ? "luckyblock"
                            : eventKind === "weather"
                              ? "weather"
                              : eventKind === "speed"
                                ? "speed"
                                : "boost";

    const channelPayload = {
      token: ADMIN_EVENT_TOKEN,
      kind:
        eventKind === "variant"
          ? "variant"
          : eventKind === "mutation"
            ? "mutation"
            : eventKind === "chest"
              ? "chest"
              : eventKind === "luckyblock"
                ? "luckyblock"
                : eventKind === "weather"
                  ? "weather"
                  : eventKind === "speed"
                    ? "speed"
                    : eventKind,
      target:
        eventKind === "variant"
          ? eventTarget
          : eventKind === "mutation"
            ? mutationTarget
            : eventKind === "weather"
              ? weatherId
              : "",
      until: now + mins * 60_000,
      startedAt: now,
      mult: eventKind === "weather" ? 1 : eventMult,
      scope: wantGlobal ? "global" : "local",
      note: wantGlobal ? "in-game-admin-global" : "in-game-admin-local",
      by: OWNER_NAME
    };

    if (clearAll) applyAdminLocally("all", null, true);
    else if (clearBoostOnly) applyAdminLocally("boost", null, true);
    else if (clearVariantOnly) applyAdminLocally("variant", null, true);
    else if (clearMutationOnly) applyAdminLocally("mutation", null, true);
    else if (clearToxicOnly || clearLavaOnly || clearNeonOnly) {
      applyAdminLocally("mutation", { target: clearMutationTarget }, true);
    } else if (clearLuckyBlockOnly) applyAdminLocally("luckyblock", null, true);
    else if (clearChestOnly) applyAdminLocally("chest", null, true);
    else if (clearWeatherOnly) applyAdminLocally("weather", null, true);
    else if (clearSpeedOnly) applyAdminLocally("speed", null, true);
    else applyAdminLocally(channel, channelPayload, false);

    const weatherLabel =
      weatherId === "storm" ? "storm" : weatherId === "calm" ? "calm seas" : "clear weather";
    const mutationClearLabel = clearMutationTarget
      ? clearMutationTarget
      : clearMutationOnly
        ? "all mutations"
        : "";
    const label = isClear
      ? clearAll
        ? "all events"
        : clearVariantOnly
          ? "variant"
          : mutationClearLabel ||
            (clearLuckyBlockOnly
              ? "lucky blocks"
              : clearChestOnly
                ? "chests"
                : clearWeatherOnly
                  ? "weather"
                  : clearSpeedOnly
                    ? "cast speed"
                    : "luck/sell")
      : eventKind === "variant"
        ? formatAdminVariantLabel(eventTarget)
        : eventKind === "mutation"
          ? adminEventKindLabel({ kind: "mutation", target: mutationTarget })
          : eventKind === "luckyblock"
            ? "lucky blocks"
            : eventKind === "chest"
              ? "chests"
              : eventKind === "weather"
                ? weatherLabel
                : eventKind === "speed"
                  ? "cast speed"
                  : eventKind === "luck"
                    ? "luck"
                    : "sell";

    const chanceNote =
      !isClear && eventKind === "luckyblock"
        ? ` · ${formatLuckyBlockChancePct()} drop (luck ignored)`
        : "";
    const liveLine = (prefix) =>
      eventKind === "weather"
        ? `${prefix} · ${label} for ${mins}m`
        : `${prefix} · ${formatMult(eventMult)}× ${label} for ${mins}m${chanceNote}`;

    const bundle = buildAdminSyncBundle(wantGlobal ? "global" : "local");

    if (!wantGlobal) {
      clearPendingAdminPush();
      if (isClear) {
        setCatchLine(`Local admin ${label} cleared`, "treasure");
      } else {
        setCatchLine(`${liveLine("LOCAL ADMIN")} (only you)`, "treasure");
        playSfx("win");
        burstConfetti();
      }
      adminBusy = false;
      return true;
    }

    pendingAdminPush = bundle;
    writeStoredAdmin(ADMIN_EVENT_PENDING_KEY, bundle);
    if (isClear) {
      setCatchLine(`Clearing global admin ${label}…`, "treasure");
    } else {
      setCatchLine(`${liveLine("GLOBAL ADMIN")} (syncing…)`, "treasure");
      playSfx("win");
      burstConfetti();
    }

    try {
      const result = await pushAdminBundleRemote(bundle);
      if (result.ok) {
        clearPendingAdminPush();
        setCatchLine(
          isClear
            ? `Global admin ${label} cleared`
            : eventKind === "weather"
              ? `GLOBAL ADMIN · ${label} live for ${mins}m (all players)`
              : `GLOBAL ADMIN · ${formatMult(eventMult)}× ${label} live for ${mins}m (all players)`,
          "treasure"
        );
        return true;
      }
      if (result.rateLimited) {
        scheduleAdminRetry();
        setCatchLine(
          isClear
            ? `Cleared here · syncing ${label} clear soon`
            : eventKind === "weather"
              ? `Live here · ${label} · syncing global…`
              : `Live here · ${formatMult(eventMult)}× ${label} · syncing global…`,
          "treasure"
        );
        return true;
      }
      throw new Error("push failed");
    } catch {
      scheduleAdminRetry();
      setCatchLine(
        isClear
          ? `Cleared here · will sync ${label} clear soon`
          : eventKind === "weather"
            ? `Live here · ${label} · syncing global…`
            : `Live here · ${formatMult(eventMult)}× ${label} · syncing global…`,
        "treasure"
      );
      return true;
    } finally {
      adminBusy = false;
    }
  }

  function fishLookupKey(raw) {
    return String(raw || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "");
  }

  function resolveFishQuery(query) {
    const key = fishLookupKey(query);
    if (!key) return { fish: null, matches: [] };
    if (key === "soultwin" || key === "soultwins" || key === "twin" || key === "thetwin") {
      const twin = fishById(SOUL_TWIN_ID);
      if (twin) return { fish: twin, matches: [twin] };
    }
    const exactId = FISH.find((f) => f.id === key || fishLookupKey(f.id) === key);
    if (exactId) return { fish: exactId, matches: [exactId] };
    const exactName = FISH.find((f) => fishLookupKey(f.name) === key);
    if (exactName) return { fish: exactName, matches: [exactName] };
    const matches = FISH.filter(
      (f) => fishLookupKey(f.name).includes(key) || fishLookupKey(f.id).includes(key)
    );
    if (matches.length === 1) return { fish: matches[0], matches };
    return { fish: null, matches };
  }

  function parseGiveFishCommand(raw) {
    const original = String(raw || "").trim();
    // Short exclusive grant: "give soultwin" / "give me soul twin"
    const twinGive = original.match(
      /^(give|gift)\s+(?:(?:me|self)\s+)?(?:fish\s+)?(soul\s*twins?|soultwins?|the\s*twin)\b(.*)$/i
    );
    if (twinGive && !/^(give|gift)\s+fish\b/i.test(original)) {
      const rest = String(twinGive[3] || "").trim();
      let to = /^(?:me|self)\b/i.test(original.slice(twinGive[1].length)) ? "me" : "me";
      const toMatch = rest.match(/\bto\s+@?(.+)$/i);
      if (toMatch) to = toMatch[1].trim();
      else if (/\b(everyone|everybody|all players|all|global)\b/i.test(rest)) to = "everyone";
      let count = null;
      const countMatch = rest.match(/(?:^|\s)(?:x\s*(\d{1,2})|(\d{1,2})\s*x)(?:\s|$)/i);
      if (countMatch) {
        count = Math.min(50, Math.max(1, Number(countMatch[1] || countMatch[2]) || 1));
      }
      return {
        kind: "give-fish",
        fishId: SOUL_TWIN_ID,
        variant: "",
        shiny: false,
        mutation: "",
        perfect: false,
        count,
        to,
        forceSelf: to === "me" || to === "self"
      };
    }
    if (!/^(give|gift)\s+fish\b/i.test(original)) return null;

    let rest = original.replace(/^(give|gift)\s+fish\s+/i, "").trim();
    if (!rest) {
      return {
        error: "Try: give fish primefin shiny gold · give fish trout to everyone"
      };
    }

    let to = "me";
    const toMatch = rest.match(/\bto\s+@?(.+)$/i);
    if (toMatch) {
      to = toMatch[1].trim();
      rest = rest.slice(0, toMatch.index).trim();
    } else if (/\b(everyone|everybody|all players|all|global)\s*$/i.test(rest)) {
      to = "everyone";
      rest = rest.replace(/\b(everyone|everybody|all players|all|global)\s*$/i, "").trim();
    } else if (/\b(me|self)\s*$/i.test(rest)) {
      rest = rest.replace(/\b(me|self)\s*$/i, "").trim();
      to = "me";
    }

    let count = null;
    const countMatch = rest.match(/(?:^|\s)(?:x\s*(\d{1,2})|(\d{1,2})\s*x)(?:\s|$)/i);
    if (countMatch) {
      count = Math.min(50, Math.max(1, Number(countMatch[1] || countMatch[2]) || 1));
      rest = `${rest.slice(0, countMatch.index)} ${rest.slice(countMatch.index + countMatch[0].length)}`
        .replace(/\s+/g, " ")
        .trim();
    }

    let variant = "";
    let shiny = false;
    let mutation = "";
    let perfect = false;
    const fishBits = [];
    rest
      .toLowerCase()
      .replace(/[+&|]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .split(" ")
      .filter(Boolean)
      .forEach((token) => {
        if (VARIANT_PRIMARY.includes(token)) variant = token;
        else if (token === "shiny") shiny = true;
        else if (MUTATIONS.includes(token) || token === "mutation") {
          mutation = token === "mutation" ? "toxic" : token;
        } else if (token === "perfect") perfect = true;
        else if (token === "normal" || token === "plain" || token === "base") {
          variant = "";
          shiny = false;
          mutation = "";
        } else fishBits.push(token);
      });

    const resolved = resolveFishQuery(fishBits.join(" "));
    if (!resolved.fish) {
      if (resolved.matches.length > 1) {
        return {
          error: `Which fish? ${resolved.matches
            .slice(0, 4)
            .map((f) => f.id)
            .join(", ")}`
        };
      }
      return { error: "Unknown fish — use id or name (e.g. primefin, golden koi)" };
    }

    return {
      kind: "give-fish",
      fishId: resolved.fish.id,
      variant: isExclusiveFish(resolved.fish) ? "" : variant,
      shiny: isExclusiveFish(resolved.fish) ? false : shiny,
      mutation: isExclusiveFish(resolved.fish) ? "" : mutation,
      perfect,
      count,
      to,
      forceSelf:
        isExclusiveFish(resolved.fish) &&
        (!to || to === "me" || to === "self")
    };
  }

  function isEveryoneGiftTarget(raw) {
    const key = String(raw || "")
      .trim()
      .toLowerCase();
    return (
      key === "everyone" ||
      key === "everybody" ||
      key === "all" ||
      key === "all players" ||
      key === "global" ||
      key === "*" ||
      key === "players"
    );
  }

  function isBroadcastGift(g) {
    if (!g || typeof g !== "object") return false;
    if (g.broadcast) return true;
    const toName = String(g.toName || "").toLowerCase();
    return (
      toName === "*" ||
      toName === "everyone" ||
      toName === "everybody" ||
      toName === "all" ||
      toName === "all players" ||
      toName === "global" ||
      toName === "players"
    );
  }

  /** Free cooler slots for an exclusive grant (drops cheapest unsaved non-exclusive). */
  function makeCoolerRoomForExclusive(need = 1) {
    const want = Math.max(1, Math.floor(Number(need) || 1));
    while (state.cooler.length + want > coolerMax()) {
      let victim = -1;
      let victimVal = Infinity;
      state.cooler.forEach((raw, i) => {
        const entry = normalizeCoolerEntry(raw);
        if (!entry || entry.saved || isExclusiveFish(entry.id)) return;
        const fish = fishById(entry.id);
        if (!fish) return;
        const val = Math.max(0, Math.floor(Number(fish.value) || 0));
        if (val < victimVal) {
          victimVal = val;
          victim = i;
        }
      });
      if (victim < 0) break;
      state.cooler.splice(victim, 1);
    }
    return state.cooler.length < coolerMax();
  }

  function grantFishToLocal(fish, opts = {}) {
    if (!fish) return null;
    const exclusive = isExclusiveFish(fish);
    if (exclusive) {
      if (state.cooler.length >= coolerMax() && !makeCoolerRoomForExclusive(1)) {
        if (!opts.silent) {
          setCatchLine("Cooler full — free a slot for Soul Twin!", "miss");
        }
        return null;
      }
    }
    const variants = exclusive
      ? { variant: "", shiny: false, mutation: "" }
      : normalizeVariants(opts.variants || {});
    const lockedValue = exclusive
      ? Math.max(
          2,
          Math.floor(Number(opts.lockedValue) || exclusiveMirrorBaseValue())
        )
      : 0;
    const entry = {
      id: fish.id,
      saved: exclusive ? true : !!opts.saved,
      perfect: !!opts.perfect,
      variant: variants.variant,
      shiny: variants.shiny,
      mutation: variants.mutation,
      unsellable: exclusive,
      untradeable: exclusive,
      lockedValue: lockedValue || undefined
    };
    noteCatch(fish, entry);
    state.cooler.push(entry);
    return entry;
  }

  function coolerEntryIsSoulTwin(raw) {
    const id = typeof raw === "string" ? raw : raw?.id;
    return String(id || "") === SOUL_TWIN_ID || String(id || "") === "soultwin";
  }

  /** Remove up to `count` Soul Twin rows from the cooler. Returns how many removed. */
  function removeSoulTwinsFromCooler(count = 1) {
    const want = Math.max(1, Math.min(50, Math.floor(Number(count) || 1)));
    let removed = 0;
    const next = [];
    (state.cooler || []).forEach((raw) => {
      if (removed < want && coolerEntryIsSoulTwin(raw)) {
        removed += 1;
        return;
      }
      next.push(raw);
    });
    if (removed) {
      state.cooler = next;
      saveState();
      render(true);
      try {
        publishAquariumShare(true).catch(() => {});
      } catch {}
    }
    return removed;
  }

  /** Ignore pending Soul Twin gifts so poll can't re-add after a trim. */
  async function burnPendingSoulTwinGifts() {
    try {
      const doc = await fetchFishGiftsDoc();
      if (!doc) return 0;
      const me = playerNameLower();
      const myId = String(window.HubPlays?.getPlayerId?.() || "");
      const claimed = readClaimedGiftIds();
      const toMark = [];
      Object.values(doc.gifts || {}).forEach((g) => {
        if (!g || typeof g !== "object") return;
        if (String(g.fishId || "") !== SOUL_TWIN_ID && String(g.fishId || "") !== "soultwin") {
          return;
        }
        const gid = String(g.id || "");
        if (!gid || claimed.has(gid)) return;
        const broadcast = isBroadcastGift(g);
        if (broadcast) {
          const by =
            g.claimedBy && typeof g.claimedBy === "object" && !Array.isArray(g.claimedBy)
              ? g.claimedBy
              : {};
          if ((myId && by[myId]) || (me && by[me])) return;
        } else if (g.claimed) {
          return;
        }
        const toName = String(g.toName || "").toLowerCase();
        const toId = String(g.toPlayerId || "");
        const forMe =
          broadcast || (toName && toName === me) || (toId && myId && toId === myId);
        if (!forMe) return;
        claimed.add(gid);
        toMark.push(gid);
      });
      if (!toMark.length) return 0;
      writeClaimedGiftIds(claimed);
      toMark.forEach((gid) => {
        markFishGiftClaimed(gid).catch(() => {});
      });
      return toMark.length;
    } catch {
      return 0;
    }
  }

  function readClaimedGiftIds() {
    try {
      const raw = JSON.parse(localStorage.getItem(FISH_GIFTS_CLAIMED_KEY) || "[]");
      return new Set(Array.isArray(raw) ? raw.map(String) : []);
    } catch {
      return new Set();
    }
  }

  function writeClaimedGiftIds(set) {
    try {
      const list = [...set].slice(-200);
      localStorage.setItem(FISH_GIFTS_CLAIMED_KEY, JSON.stringify(list));
    } catch {}
  }

  async function fetchFishGiftsDoc() {
    try {
      const api = fishingSb();
      let data = null;
      if (api) {
        try {
          data = await api.getPrefer(FISH_GIFTS_DOC, FISH_GIFTS_API);
        } catch {
          data = null;
        }
      } else {
        const res = await fetch(`${FISH_GIFTS_API}?t=${Date.now()}`, { cache: "no-store" });
        if (res.status === 404) return { token: FISH_GIFTS_TOKEN, gifts: {} };
        if (!res.ok) return null;
        data = await res.json();
      }
      if (!data || typeof data !== "object") return { token: FISH_GIFTS_TOKEN, gifts: {} };
      return {
        token: data.token || FISH_GIFTS_TOKEN,
        gifts: data.gifts && typeof data.gifts === "object" ? data.gifts : {}
      };
    } catch {
      return null;
    }
  }

  async function postFishGiftsDoc(doc) {
    const payload = {
      token: FISH_GIFTS_TOKEN,
      gifts: doc.gifts || {}
    };
    const api = fishingSb();
    if (api) {
      try {
        await api.pushPrefer(FISH_GIFTS_DOC, payload, FISH_GIFTS_API);
        return true;
      } catch {
        return false;
      }
    }
    const res = await fetch(FISH_GIFTS_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    return res.ok;
  }

  async function lookupPlayerForGift(username) {
    const key = String(username || "")
      .trim()
      .toLowerCase();
    if (!key) return null;
    try {
      const api = fishingSb();
      let data = null;
      if (api) {
        data = await api.getPrefer(
          "name-registry",
          "https://mantledb.sh/v2/icedragon1st-mygames/name-registry"
        );
      } else {
        const res = await fetch(
          `https://mantledb.sh/v2/icedragon1st-mygames/name-registry?t=${Date.now()}`,
          { cache: "no-store" }
        );
        if (res.ok) data = await res.json();
      }
      const names = data?.names && typeof data.names === "object" ? data.names : data || {};
      const claim = names[key];
      if (claim?.playerId) {
        return { playerId: claim.playerId, name: claim.name || username };
      }
    } catch {}
    try {
      const friends = window.HubFriends?.getFriends?.() || [];
      const hit = friends.find((f) => String(f.name || "").trim().toLowerCase() === key);
      if (hit?.id || hit?.playerId) {
        return { playerId: hit.id || hit.playerId, name: hit.name || username };
      }
    } catch {}
    return { playerId: "", name: username };
  }

  async function queueFishGift(payload) {
    const remote = (await fetchFishGiftsDoc()) || { token: FISH_GIFTS_TOKEN, gifts: {} };
    const id = `g-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const gifts = { ...(remote.gifts || {}) };
    // Drop very old claimed gifts to keep the doc small
    const now = Date.now();
    Object.entries(gifts).forEach(([gid, g]) => {
      const at = Number(g?.at) || 0;
      if (g?.claimed && now - at > 3 * 24 * 60 * 60 * 1000) delete gifts[gid];
      else if (!g?.claimed && now - at > 14 * 24 * 60 * 60 * 1000) delete gifts[gid];
    });
    const claimedBy =
      payload.claimedBy && typeof payload.claimedBy === "object" && !Array.isArray(payload.claimedBy)
        ? { ...payload.claimedBy }
        : {};
    gifts[id] = {
      id,
      toName: String(payload.toName || "").toLowerCase(),
      toPlayerId: String(payload.toPlayerId || ""),
      toDisplay: String(payload.toDisplay || payload.toName || ""),
      from: "ICE_DRAGON",
      fishId: payload.fishId,
      item: payload.item || "",
      variant: normalizeVariant(payload.variant),
      shiny: !!payload.shiny,
      mutation: normalizeMutation(payload.mutation),
      perfect: !!payload.perfect,
      count: Math.min(50, Math.max(1, Number(payload.count) || 1)),
      at: now,
      broadcast: !!payload.broadcast,
      claimed: false,
      claimedBy
    };
    return postFishGiftsDoc({ gifts });
  }

  async function markFishGiftClaimed(giftId) {
    const remote = (await fetchFishGiftsDoc()) || { token: FISH_GIFTS_TOKEN, gifts: {} };
    const gifts = { ...(remote.gifts || {}) };
    const g = gifts[giftId];
    if (!g) return true;
    const me = playerNameLower();
    const myId = String(window.HubPlays?.getPlayerId?.() || "");
    if (isBroadcastGift(g)) {
      const by =
        g.claimedBy && typeof g.claimedBy === "object" && !Array.isArray(g.claimedBy)
          ? { ...g.claimedBy }
          : {};
      const key = myId || me;
      if (!key) return true;
      by[key] = Date.now();
      gifts[giftId] = {
        ...g,
        broadcast: true,
        claimed: false,
        claimedBy: by,
        claimedAt: Date.now()
      };
      return postFishGiftsDoc({ gifts });
    }
    if (g.claimed) return true;
    gifts[giftId] = {
      ...g,
      claimed: true,
      claimedBy: me || myId,
      claimedAt: Date.now()
    };
    return postFishGiftsDoc({ gifts });
  }

  let fishGiftPollTimer = 0;
  let fishGiftFetchedAt = 0;

  async function pollFishGifts(force = false) {
    const now = Date.now();
    if (!force && now - fishGiftFetchedAt < FISH_GIFTS_POLL_MS) return;
    fishGiftFetchedAt = now;
    const doc = await fetchFishGiftsDoc();
    if (!doc) return;
    const me = playerNameLower();
    const myId = String(window.HubPlays?.getPlayerId?.() || "");
    if (!me && !myId) return;
    const claimed = readClaimedGiftIds();
    let gained = 0;
    let blocks = 0;
    let chests = 0;
    let blockLabel = "";
    let chestLabel = "";
    let label = "";
    const toClaim = [];

    Object.values(doc.gifts || {}).forEach((g) => {
      if (!g || typeof g !== "object") return;
      const broadcast = isBroadcastGift(g);
      if (!broadcast && g.claimed) return;
      const gid = String(g.id || "");
      if (!gid || claimed.has(gid)) return;
      if (broadcast) {
        const by =
          g.claimedBy && typeof g.claimedBy === "object" && !Array.isArray(g.claimedBy)
            ? g.claimedBy
            : {};
        if ((myId && by[myId]) || (me && by[me])) return;
      }
      const toName = String(g.toName || "").toLowerCase();
      const toId = String(g.toPlayerId || "");
      const forMe =
        broadcast || (toName && toName === me) || (toId && myId && toId === myId);
      if (!forMe) return;
      const count = Math.min(50, Math.max(1, Number(g.count) || 1));
      const blockType = luckyBlockTypeFromGift(g);
      if (blockType) {
        const added = storeLuckyBlock(blockType, count, { silent: true });
        blocks += added;
        if (added) blockLabel = luckyBlockDef(blockType).name;
        claimed.add(gid);
        toClaim.push(gid);
        return;
      }
      const chestKind = chestKindFromGift(g);
      if (chestKind) {
        const added = storeAdminChests(chestKind, count, { silent: true });
        if (!added) {
          // Hard stash ceiling — leave gift unclaimed so it can land later
          return;
        }
        chests += added;
        chestLabel = chestGiftDef(chestKind).name;
        claimed.add(gid);
        toClaim.push(gid);
        return;
      }
      const fish = fishById(g.fishId);
      if (!fish) return;
      const entryOpts = {
        variants: {
          variant: normalizeVariant(g.variant),
          shiny: !!g.shiny,
          mutation: normalizeMutation(g.mutation)
        },
        perfect: !!g.perfect,
        silent: true
      };
      let added = 0;
      for (let i = 0; i < count; i += 1) {
        if (grantFishToLocal(fish, entryOpts)) added += 1;
      }
      if (!added) return;
      gained += added;
      label = formatFishName(fish, isExclusiveFish(fish) ? {} : entryOpts.variants);
      claimed.add(gid);
      toClaim.push(gid);
    });

    if (!gained && !blocks && !chests) return;
    if (gained) ensureExclusiveCoolerValues();
    writeClaimedGiftIds(claimed);
    saveState();
    render(true);
    if (chests && !gained && !blocks) {
      setCatchLine(
        chests === 1 ? `Gift received: ${chestLabel}` : `Gift received: ${chests}× ${chestLabel}`,
        "treasure"
      );
    } else if (blocks && !gained && !chests) {
      setCatchLine(
        blocks === 1 ? `Gift received: ${blockLabel}` : `Gift received: ${blocks}× ${blockLabel}`,
        "treasure"
      );
    } else if (gained) {
      setCatchLine(
        gained === 1 ? `Gift received: ${label}` : `Gift received: ${gained}× ${label}`,
        "treasure"
      );
    } else {
      setCatchLine("Gift received", "treasure");
    }
    playSfx("win");
    toClaim.forEach((gid) => {
      markFishGiftClaimed(gid).catch(() => {});
    });
  }

  function startFishGiftPolling() {
    pollFishGifts(true);
    if (fishGiftPollTimer) clearInterval(fishGiftPollTimer);
    fishGiftPollTimer = setInterval(() => pollFishGifts(false), FISH_GIFTS_POLL_MS);
  }

  /* ========== PLAYER MAIL: gifts + trades (friends) ========== */
  let playerMailPollTimer = 0;
  let playerMailFetchedAt = 0;
  let playerMailCache = { gifts: {}, trades: {} };
  let lastPlayerGiftAt = 0;
  let mailCompose = null; // { mode:'gift'|'trade', friendId, friendName, items:[], tradeId }
  let mailTab = "inbox";

  function readPlayerMailClaimed() {
    try {
      const raw = JSON.parse(localStorage.getItem(PLAYER_MAIL_CLAIMED_KEY) || "[]");
      return new Set(Array.isArray(raw) ? raw.map(String) : []);
    } catch {
      return new Set();
    }
  }

  function writePlayerMailClaimed(set) {
    try {
      localStorage.setItem(PLAYER_MAIL_CLAIMED_KEY, JSON.stringify([...set].slice(-300)));
    } catch {}
  }

  function mailMyId() {
    return String(window.HubPlays?.getPlayerId?.() || "");
  }

  function mailMyName() {
    return String(window.HubPlays?.getName?.() || localStorage.getItem("hub-player-name") || "").trim();
  }

  function isMailFriend(playerId, name) {
    try {
      if (playerId && window.HubFriends?.isFriend?.(playerId)) return true;
      const friends = window.HubFriends?.getFriends?.() || [];
      const key = String(name || "").trim().toLowerCase();
      return friends.some((f) => {
        const fid = String(f.playerId || f.id || "");
        const fname = String(f.name || "").trim().toLowerCase();
        if (playerId && fid && fid === playerId) return true;
        if (key && fname === key) return true;
        return false;
      });
    } catch {
      return false;
    }
  }

  function serializeMailFish(entry) {
    const n = normalizeCoolerEntry(entry) || {};
    return {
      kind: "fish",
      fishId: String(n.id || coolerEntryId(entry) || ""),
      variant: normalizeVariant(n.variant),
      shiny: !!n.shiny,
      mutation: normalizeMutation(n.mutation),
      perfect: !!n.perfect
    };
  }

  function serializeMailChest(chestKind, count = 1) {
    return {
      kind: "chest",
      chestKind: chestKind === "luck" ? "luck" : "money",
      count: Math.min(50, Math.max(1, Math.floor(Number(count) || 1)))
    };
  }

  function serializeMailLuckyBlock(lbType, count = 1) {
    return {
      kind: "luckyblock",
      lbType: resolveLuckyBlockType(lbType) || "absolute",
      count: Math.min(50, Math.max(1, Math.floor(Number(count) || 1)))
    };
  }

  function mailFishSellValue(entryOrItem) {
    const fishId = entryOrItem?.fishId || coolerEntryId(entryOrItem) || entryOrItem?.id;
    const fish = fishById(fishId);
    if (!fish) return 0;
    const entry =
      entryOrItem?.kind === "fish"
        ? {
            variant: entryOrItem.variant,
            shiny: entryOrItem.shiny,
            mutation: entryOrItem.mutation,
            perfect: entryOrItem.perfect
          }
        : normalizeCoolerEntry(entryOrItem) || entryOrItem;
    return fishValue(fish, currentSpot(), entry);
  }

  function mailItemLabel(item) {
    if (!item) return "Item";
    if (item.kind === "fish") {
      const fish = fishById(item.fishId);
      if (!fish) return item.fishId || "Fish";
      const name = formatFishName(fish, {
        variant: item.variant,
        shiny: item.shiny,
        mutation: item.mutation
      });
      return `${name} · ${formatNum(mailFishSellValue(item))}`;
    }
    if (item.kind === "chest") {
      const n = Math.max(1, Number(item.count) || 1);
      const name = item.chestKind === "luck" ? "Luck Chest" : "Coin Chest";
      return `${name} · gives ×${n}`;
    }
    if (item.kind === "luckyblock") {
      const n = Math.max(1, Number(item.count) || 1);
      const name = luckyBlockDef(item.lbType).name;
      return `${name} · gives ×${n}`;
    }
    return "Item";
  }

  function takeMailItemsFromInventory(items) {
    const taken = [];
    const backup = {
      cooler: state.cooler.slice(),
      moneyChestCount: state.moneyChestCount,
      luckChestCount: state.luckChestCount,
      luckyBlockCount: state.luckyBlockCount,
      astralLuckyBlockCount: state.astralLuckyBlockCount,
      zenithLuckyBlockCount: state.zenithLuckyBlockCount
    };
    for (const item of items) {
      if (item.kind === "fish") {
        const idx = Number(item._coolerIndex);
        if (!Number.isFinite(idx) || idx < 0 || idx >= state.cooler.length) {
          restoreMailInventoryBackup(backup);
          return null;
        }
        const entry = state.cooler[idx];
        taken.push(serializeMailFish(entry));
        state.cooler.splice(idx, 1);
        // adjust later indices in remaining items
        items.forEach((it) => {
          if (it.kind === "fish" && Number(it._coolerIndex) > idx) it._coolerIndex -= 1;
        });
      } else if (item.kind === "chest") {
        const key = item.chestKind === "luck" ? "luckChestCount" : "moneyChestCount";
        const need = Math.max(1, Math.floor(Number(item.count) || 1));
        const have = Math.max(0, Math.floor(Number(state[key]) || 0));
        if (have < need) {
          restoreMailInventoryBackup(backup);
          return null;
        }
        state[key] = have - need;
        taken.push(serializeMailChest(item.chestKind, need));
      } else if (item.kind === "luckyblock") {
        const def = luckyBlockDef(item.lbType);
        const need = Math.max(1, Math.floor(Number(item.count) || 1));
        const have = luckyBlockCount(def.id);
        if (have < need) {
          restoreMailInventoryBackup(backup);
          return null;
        }
        state[def.stateKey] = have - need;
        taken.push(serializeMailLuckyBlock(def.id, need));
      }
    }
    return taken;
  }

  function restoreMailInventoryBackup(backup) {
    if (!backup) return;
    state.cooler = backup.cooler.slice();
    state.moneyChestCount = backup.moneyChestCount;
    state.luckChestCount = backup.luckChestCount;
    state.luckyBlockCount = backup.luckyBlockCount;
    state.astralLuckyBlockCount = backup.astralLuckyBlockCount;
    state.zenithLuckyBlockCount = backup.zenithLuckyBlockCount;
  }

  function grantMailItemsLocal(items, opts = {}) {
    const softChests = opts.softChests !== false;
    let added = 0;
    const leftover = [];
    (items || []).forEach((item) => {
      if (!item) return;
      if (item.kind === "fish") {
        if (state.cooler.length >= coolerMax()) {
          leftover.push(item);
          return;
        }
        const fish = fishById(item.fishId);
        if (!fish) return;
        grantFishToLocal(fish, {
          variants: {
            variant: normalizeVariant(item.variant),
            shiny: !!item.shiny,
            mutation: normalizeMutation(item.mutation)
          },
          perfect: !!item.perfect
        });
        added += 1;
        return;
      }
      if (item.kind === "chest") {
        const kind = item.chestKind === "luck" ? "luck" : "money";
        const need = Math.max(1, Math.floor(Number(item.count) || 1));
        if (softChests) {
          const n = grantQuestChests(kind, need);
          added += n;
          if (n < need) leftover.push(serializeMailChest(kind, need - n));
        } else {
          const n = grantAdminChests(kind, need);
          added += n;
          if (n < need) leftover.push(serializeMailChest(kind, need - n));
        }
        return;
      }
      if (item.kind === "luckyblock") {
        const need = Math.max(1, Math.floor(Number(item.count) || 1));
        const n = storeLuckyBlock(item.lbType, need, { silent: true });
        added += n;
        if (n < need) leftover.push(serializeMailLuckyBlock(item.lbType, need - n));
      }
    });
    return { added, leftover };
  }

  function prunePlayerMailDoc(doc) {
    const now = Date.now();
    const gifts = { ...(doc.gifts || {}) };
    const trades = { ...(doc.trades || {}) };
    Object.entries(gifts).forEach(([id, g]) => {
      const at = Number(g?.at) || 0;
      if (g?.claimed && now - at > 3 * 24 * 60_000) delete gifts[id];
      else if (!g?.claimed && now - at > PLAYER_MAIL_GIFT_TTL_MS) delete gifts[id];
    });
    Object.entries(trades).forEach(([id, t]) => {
      const at = Number(t?.updatedAt || t?.at) || 0;
      if (t?.status === "done" || t?.status === "cancelled") {
        if (now - at > 2 * 24 * 60_000) delete trades[id];
      } else if (now - at > PLAYER_MAIL_TRADE_TTL_MS) {
        trades[id] = {
          ...t,
          status: "cancelled",
          updatedAt: now,
          note: "expired"
        };
      }
    });
    return { gifts, trades };
  }

  async function fetchPlayerMailDoc() {
    const api = fishingSb();
    try {
      let data = null;
      if (api) {
        data = await api.getPrefer(PLAYER_MAIL_DOC, PLAYER_MAIL_API);
      } else {
        const res = await fetch(`${PLAYER_MAIL_API}?t=${Date.now()}`, { cache: "no-store" });
        if (res.status === 404) return { token: PLAYER_MAIL_TOKEN, gifts: {}, trades: {} };
        if (!res.ok) return null;
        data = await res.json();
      }
      if (!data || typeof data !== "object") {
        return { token: PLAYER_MAIL_TOKEN, gifts: {}, trades: {} };
      }
      return {
        token: data.token || PLAYER_MAIL_TOKEN,
        gifts: data.gifts && typeof data.gifts === "object" ? data.gifts : {},
        trades: data.trades && typeof data.trades === "object" ? data.trades : {}
      };
    } catch {
      return null;
    }
  }

  async function postPlayerMailDoc(doc) {
    const pruned = prunePlayerMailDoc(doc);
    const payload = {
      token: PLAYER_MAIL_TOKEN,
      gifts: pruned.gifts,
      trades: pruned.trades
    };
    const api = fishingSb();
    try {
      if (api) {
        await api.pushPrefer(PLAYER_MAIL_DOC, payload, PLAYER_MAIL_API);
        return true;
      }
      const res = await fetch(PLAYER_MAIL_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  function ensureMailCompose(mode) {
    if (!mailCompose || mailCompose.mode !== mode) {
      mailCompose = {
        mode,
        friendId: "",
        friendName: "",
        items: [],
        tradeId: ""
      };
    }
    return mailCompose;
  }

  function cancelMailCompose(restore = true) {
    if (restore && mailCompose?.items?.length) {
      grantMailItemsLocal(mailCompose.items, { softChests: false });
      render(true);
      saveState();
    }
    mailCompose = null;
    renderMailOverlay();
  }

  function mailComposeAddItem(item) {
    const c = mailCompose;
    if (!c) return false;
    if (c.items.length >= PLAYER_MAIL_MAX_ITEMS) {
      setCatchLine(`Max ${PLAYER_MAIL_MAX_ITEMS} items`, "miss");
      playSfx("miss");
      return false;
    }
    c.items.push(item);
    if (c.mode === "gift" || c.mode === "trade") {
      // items already taken from inventory by caller for fish/chest/lb
    }
    renderMailOverlay();
    return true;
  }

  async function sendPlayerGift() {
    const c = mailCompose;
    if (!c || c.mode !== "gift") return;
    if (!c.friendId && !c.friendName) {
      setCatchLine("Pick a friend first", "miss");
      playSfx("miss");
      return;
    }
    if (!isMailFriend(c.friendId, c.friendName)) {
      setCatchLine("Friends only — add them first", "miss");
      playSfx("miss");
      return;
    }
    if (!c.items.length) {
      setCatchLine("Add fish, chests, or lucky blocks", "miss");
      playSfx("miss");
      return;
    }
    const now = Date.now();
    if (now - lastPlayerGiftAt < PLAYER_MAIL_GIFT_COOLDOWN_MS) {
      setCatchLine("Gift cooldown — wait a bit", "miss");
      playSfx("miss");
      return;
    }
    const myId = mailMyId();
    const myName = mailMyName();
    if (!myId && !myName) {
      setCatchLine("Set a hub name first", "miss");
      playSfx("miss");
      return;
    }
    const items = c.items.map((it) => {
      const copy = { ...it };
      delete copy._coolerIndex;
      return copy;
    });
    setCatchLine("Sending gift…", "");
    const remote = (await fetchPlayerMailDoc()) || { gifts: {}, trades: {} };
    const id = `pg-${now.toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
    const gifts = { ...(remote.gifts || {}) };
    gifts[id] = {
      id,
      fromId: myId,
      fromName: myName,
      toPlayerId: c.friendId,
      toName: String(c.friendName || "").toLowerCase(),
      toDisplay: c.friendName,
      items,
      at: now,
      claimed: false
    };
    const ok = await postPlayerMailDoc({ gifts, trades: remote.trades || {} });
    if (!ok) {
      grantMailItemsLocal(items, { softChests: false });
      setCatchLine("Gift failed — items returned", "miss");
      playSfx("miss");
      render(true);
      saveState();
      return;
    }
    lastPlayerGiftAt = now;
    mailCompose = null;
    setCatchLine(`Gift sent to ${c.friendName}`, "treasure");
    playSfx("win");
    renderMailOverlay();
    render(true);
    saveState();
  }

  async function claimPlayerGift(giftId) {
    const remote = (await fetchPlayerMailDoc()) || { gifts: {}, trades: {} };
    const g = remote.gifts?.[giftId];
    if (!g || g.claimed) return;
    const myId = mailMyId();
    const me = playerNameLower();
    const forMe =
      (g.toPlayerId && myId && g.toPlayerId === myId) ||
      (g.toName && me && String(g.toName).toLowerCase() === me);
    if (!forMe) return;
    const claimed = readPlayerMailClaimed();
    if (claimed.has(giftId)) return;
    const { added, leftover } = grantMailItemsLocal(g.items || [], { softChests: true });
    if (!added && leftover.length) {
      setCatchLine("No room — free cooler/stash space", "miss");
      playSfx("miss");
      return;
    }
    claimed.add(giftId);
    writePlayerMailClaimed(claimed);
    const gifts = { ...(remote.gifts || {}) };
    if (leftover.length) {
      gifts[giftId] = { ...g, items: leftover, claimed: false };
      claimed.delete(giftId);
      writePlayerMailClaimed(claimed);
    } else {
      gifts[giftId] = {
        ...g,
        claimed: true,
        claimedBy: myId || me,
        claimedAt: Date.now()
      };
    }
    await postPlayerMailDoc({ gifts, trades: remote.trades || {} });
    setCatchLine(
      leftover.length
        ? `Claimed part of gift from ${g.fromName || "friend"} · rest waiting`
        : `Gift from ${g.fromName || "friend"} claimed`,
      "treasure"
    );
    playSfx("win");
    render(true);
    saveState();
    renderMailOverlay();
  }

  async function openTradeWithFriend(friendId, friendName) {
    if (!isMailFriend(friendId, friendName)) {
      setCatchLine("Friends only", "miss");
      playSfx("miss");
      return;
    }
    const myId = mailMyId();
    const myName = mailMyName();
    if (!myId) {
      setCatchLine("Need a hub player id — refresh hub once", "miss");
      playSfx("miss");
      return;
    }
    const remote = (await fetchPlayerMailDoc()) || { gifts: {}, trades: {} };
    const openMine = Object.values(remote.trades || {}).find(
      (t) =>
        t &&
        t.status === "open" &&
        (t.aId === myId || t.bId === myId)
    );
    if (openMine) {
      setCatchLine("Finish or cancel your open trade first", "miss");
      playSfx("miss");
      mailCompose = {
        mode: "trade",
        friendId: openMine.aId === myId ? openMine.bId : openMine.aId,
        friendName: openMine.aId === myId ? openMine.bName : openMine.aName,
        items: [],
        tradeId: openMine.id
      };
      mailTab = "trade";
      renderMailOverlay();
      return;
    }
    const now = Date.now();
    const id = `tr-${now.toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
    const trades = { ...(remote.trades || {}) };
    trades[id] = {
      id,
      aId: myId,
      aName: myName,
      bId: friendId,
      bName: friendName,
      aItems: [],
      bItems: [],
      aAccept: false,
      bAccept: false,
      status: "open",
      at: now,
      updatedAt: now,
      appliedBy: {},
      restoredBy: {}
    };
    const ok = await postPlayerMailDoc({ gifts: remote.gifts || {}, trades });
    if (!ok) {
      setCatchLine("Couldn't start trade", "miss");
      playSfx("miss");
      return;
    }
    mailCompose = {
      mode: "trade",
      friendId,
      friendName,
      items: [],
      tradeId: id
    };
    mailTab = "trade";
    setCatchLine(`Trade opened with ${friendName}`, "treasure");
    playSfx("click");
    playerMailCache.trades = trades;
    renderMailOverlay();
  }

  function myTradeSide(trade) {
    const myId = mailMyId();
    if (!trade || !myId) return null;
    if (trade.aId === myId) return "a";
    if (trade.bId === myId) return "b";
    return null;
  }

  async function syncTradeOfferItems(tradeId, items) {
    const remote = (await fetchPlayerMailDoc()) || { gifts: {}, trades: {} };
    const t = remote.trades?.[tradeId];
    if (!t || t.status !== "open") return false;
    const side = myTradeSide(t);
    if (!side) return false;
    const trades = { ...(remote.trades || {}) };
    const next = {
      ...t,
      aAccept: false,
      bAccept: false,
      updatedAt: Date.now()
    };
    if (side === "a") next.aItems = items;
    else next.bItems = items;
    trades[tradeId] = next;
    const ok = await postPlayerMailDoc({ gifts: remote.gifts || {}, trades });
    if (ok) playerMailCache.trades = trades;
    return ok;
  }

  async function addComposeItemFromCooler(index) {
    if (!mailCompose || (mailCompose.mode !== "gift" && mailCompose.mode !== "trade")) {
      return false;
    }
    const i = Math.floor(Number(index));
    if (!Number.isFinite(i) || i < 0 || i >= state.cooler.length) return false;
    if (mailCompose.items.length >= PLAYER_MAIL_MAX_ITEMS) {
      setCatchLine(`Max ${PLAYER_MAIL_MAX_ITEMS} items`, "miss");
      return false;
    }
    const entry = state.cooler[i];
    if (isCoolerSaved(entry)) {
      setCatchLine("Unpin saved fish before gifting", "miss");
      playSfx("miss");
      return false;
    }
    const fish = fishById(coolerEntryId(entry));
    if (isUntradeableFish(fish, entry) || isExclusiveFish(fish)) {
      setCatchLine(`${formatFishName(fish, entry)} can't be traded or gifted`, "miss");
      playSfx("miss");
      return false;
    }
    const item = serializeMailFish(entry);
    state.cooler.splice(i, 1);
    mailCompose.items.push(item);
    render(true);
    saveSoon();
    if (mailCompose.mode === "trade" && mailCompose.tradeId) {
      const ok = await syncTradeOfferItems(mailCompose.tradeId, mailCompose.items);
      if (!ok) {
        state.cooler.splice(i, 0, entry);
        mailCompose.items.pop();
        setCatchLine("Trade sync failed", "miss");
        render(true);
        return false;
      }
    }
    renderMailOverlay();
    return true;
  }

  async function addComposeChest(chestKind, count = 1) {
    if (!mailCompose || (mailCompose.mode !== "gift" && mailCompose.mode !== "trade")) return false;
    if (mailCompose.items.length >= PLAYER_MAIL_MAX_ITEMS) {
      setCatchLine(`Max ${PLAYER_MAIL_MAX_ITEMS} items`, "miss");
      return false;
    }
    const key = chestKind === "luck" ? "luckChestCount" : "moneyChestCount";
    const need = Math.max(1, Math.floor(Number(count) || 1));
    const have = Math.max(0, Math.floor(Number(state[key]) || 0));
    if (have < need) {
      setCatchLine("Not enough chests", "miss");
      playSfx("miss");
      return false;
    }
    state[key] = have - need;
    mailCompose.items.push(serializeMailChest(chestKind, need));
    renderTreasureStash();
    saveSoon();
    if (mailCompose.mode === "trade" && mailCompose.tradeId) {
      const ok = await syncTradeOfferItems(mailCompose.tradeId, mailCompose.items);
      if (!ok) {
        state[key] = have;
        mailCompose.items.pop();
        setCatchLine("Trade sync failed", "miss");
        renderTreasureStash();
        return false;
      }
    }
    renderMailOverlay();
    return true;
  }

  async function addComposeLuckyBlock(lbType, count = 1) {
    if (!mailCompose || (mailCompose.mode !== "gift" && mailCompose.mode !== "trade")) return false;
    if (mailCompose.items.length >= PLAYER_MAIL_MAX_ITEMS) {
      setCatchLine(`Max ${PLAYER_MAIL_MAX_ITEMS} items`, "miss");
      return false;
    }
    const def = luckyBlockDef(lbType);
    const need = Math.max(1, Math.floor(Number(count) || 1));
    const have = luckyBlockCount(def.id);
    if (have < need) {
      setCatchLine("Not enough lucky blocks", "miss");
      playSfx("miss");
      return false;
    }
    state[def.stateKey] = have - need;
    mailCompose.items.push(serializeMailLuckyBlock(def.id, need));
    renderTreasureStash();
    saveSoon();
    if (mailCompose.mode === "trade" && mailCompose.tradeId) {
      const ok = await syncTradeOfferItems(mailCompose.tradeId, mailCompose.items);
      if (!ok) {
        state[def.stateKey] = have;
        mailCompose.items.pop();
        setCatchLine("Trade sync failed", "miss");
        renderTreasureStash();
        return false;
      }
    }
    renderMailOverlay();
    return true;
  }

  async function removeComposeItem(index) {
    if (!mailCompose) return;
    const i = Math.floor(Number(index));
    if (i < 0 || i >= mailCompose.items.length) return;
    const [item] = mailCompose.items.splice(i, 1);
    grantMailItemsLocal([item], { softChests: false });
    render(true);
    saveSoon();
    if (mailCompose.mode === "trade" && mailCompose.tradeId) {
      await syncTradeOfferItems(mailCompose.tradeId, mailCompose.items);
    }
    renderMailOverlay();
  }

  async function setTradeAccept(tradeId, accept) {
    const remote = (await fetchPlayerMailDoc()) || { gifts: {}, trades: {} };
    const t = remote.trades?.[tradeId];
    if (!t || t.status !== "open") return;
    const side = myTradeSide(t);
    if (!side) return;
    const trades = { ...(remote.trades || {}) };
    const next = { ...t, updatedAt: Date.now() };
    if (side === "a") next.aAccept = !!accept;
    else next.bAccept = !!accept;
    if (next.aAccept && next.bAccept) {
      next.status = "done";
    }
    trades[tradeId] = next;
    const ok = await postPlayerMailDoc({ gifts: remote.gifts || {}, trades });
    if (!ok) {
      setCatchLine("Couldn't update trade", "miss");
      return;
    }
    playerMailCache.trades = trades;
    if (next.status === "done") {
      await applyCompletedTrade(next);
    } else {
      setCatchLine(accept ? "Accepted — waiting on them" : "Accept cleared", "");
      playSfx("click");
    }
    renderMailOverlay();
  }

  async function cancelTrade(tradeId) {
    const remote = (await fetchPlayerMailDoc()) || { gifts: {}, trades: {} };
    const t = remote.trades?.[tradeId];
    if (!t || t.status !== "open") return;
    const side = myTradeSide(t);
    if (!side) return;
    const trades = { ...(remote.trades || {}) };
    trades[tradeId] = {
      ...t,
      status: "cancelled",
      updatedAt: Date.now(),
      aAccept: false,
      bAccept: false
    };
    const ok = await postPlayerMailDoc({ gifts: remote.gifts || {}, trades });
    if (!ok) {
      setCatchLine("Couldn't cancel trade", "miss");
      return;
    }
    playerMailCache.trades = trades;
    await restoreCancelledTrade(trades[tradeId]);
    if (mailCompose?.tradeId === tradeId) mailCompose = null;
    setCatchLine("Trade cancelled — items returned", "treasure");
    playSfx("click");
    renderMailOverlay();
  }

  async function restoreCancelledTrade(trade) {
    if (!trade) return;
    const myId = mailMyId();
    if (!myId) return;
    const restored = trade.restoredBy && typeof trade.restoredBy === "object" ? { ...trade.restoredBy } : {};
    if (restored[myId]) return;
    const side = myTradeSide(trade);
    if (!side) return;
    const mine = side === "a" ? trade.aItems : trade.bItems;
    grantMailItemsLocal(mine || [], { softChests: false });
    restored[myId] = Date.now();
    const remote = (await fetchPlayerMailDoc()) || { gifts: {}, trades: {} };
    const trades = { ...(remote.trades || {}) };
    if (trades[trade.id]) {
      trades[trade.id] = { ...trades[trade.id], restoredBy: restored };
      await postPlayerMailDoc({ gifts: remote.gifts || {}, trades });
      playerMailCache.trades = trades;
    }
    render(true);
    saveState();
  }

  async function applyCompletedTrade(trade) {
    if (!trade || trade.status !== "done") return;
    const myId = mailMyId();
    if (!myId) return;
    const applied = trade.appliedBy && typeof trade.appliedBy === "object" ? { ...trade.appliedBy } : {};
    if (applied[myId]) return;
    const side = myTradeSide(trade);
    if (!side) return;
    const theirs = side === "a" ? trade.bItems : trade.aItems;
    const { added } = grantMailItemsLocal(theirs || [], { softChests: true });
    applied[myId] = Date.now();
    const remote = (await fetchPlayerMailDoc()) || { gifts: {}, trades: {} };
    const trades = { ...(remote.trades || {}) };
    if (trades[trade.id]) {
      trades[trade.id] = { ...trades[trade.id], appliedBy: applied };
      await postPlayerMailDoc({ gifts: remote.gifts || {}, trades });
      playerMailCache.trades = trades;
    }
    if (mailCompose?.tradeId === trade.id) mailCompose = null;
    setCatchLine(
      added ? `Trade complete · got ${added} item${added === 1 ? "" : "s"}` : "Trade complete",
      "treasure"
    );
    playSfx("win");
    burstConfetti();
    render(true);
    saveState();
  }

  async function pollPlayerMail(force = false) {
    const now = Date.now();
    if (!force && now - playerMailFetchedAt < PLAYER_MAIL_POLL_MS) return;
    playerMailFetchedAt = now;
    const doc = await fetchPlayerMailDoc();
    if (!doc) return;
    playerMailCache = { gifts: doc.gifts || {}, trades: doc.trades || {} };
    const myId = mailMyId();
    const me = playerNameLower();
    const claimed = readPlayerMailClaimed();

    // Auto-notify new gifts (don't auto-claim fish if cooler full — manual claim in inbox)
    let newGifts = 0;
    Object.values(playerMailCache.gifts).forEach((g) => {
      if (!g || g.claimed) return;
      const gid = String(g.id || "");
      if (!gid || claimed.has(gid)) return;
      const forMe =
        (g.toPlayerId && myId && g.toPlayerId === myId) ||
        (g.toName && me && String(g.toName).toLowerCase() === me);
      if (forMe) newGifts += 1;
    });

    // Handle trades: expired→cancelled restore, done→apply
    for (const t of Object.values(playerMailCache.trades)) {
      if (!t || !myTradeSide(t)) continue;
      if (t.status === "cancelled") await restoreCancelledTrade(t);
      if (t.status === "done") await applyCompletedTrade(t);
      // Expire open trades locally via prune on next write; also soft-expire here
      if (
        t.status === "open" &&
        now - (Number(t.updatedAt || t.at) || 0) > PLAYER_MAIL_TRADE_TTL_MS
      ) {
        await cancelTrade(t.id);
      }
    }

    updateMailBadge(newGifts);
    const overlay = document.getElementById("mail-overlay");
    if (overlay && !overlay.classList.contains("hidden")) renderMailOverlay();
  }

  function updateMailBadge(count) {
    const btn = document.getElementById("mail-btn");
    if (!btn) return;
    const n = Math.max(0, Math.floor(Number(count) || 0));
    btn.dataset.badge = n > 0 ? String(n) : "";
    btn.classList.toggle("has-mail", n > 0);
    btn.title = n > 0 ? `Mail (${n} gift${n === 1 ? "" : "s"})` : "Gift & trade";
  }

  function friendOptionsHtml(selectedId) {
    const friends = window.HubFriends?.getFriends?.() || [];
    if (!friends.length) {
      return `<p class="mail-empty">No friends yet — add some on the hub Friends panel.</p>`;
    }
    return `<div class="mail-friend-list">${friends
      .map((f) => {
        const id = String(f.playerId || f.id || "");
        const name = String(f.name || "Friend");
        const sel = id && id === selectedId ? " is-active" : "";
        return `<button type="button" class="mail-friend-btn${sel}" data-mail-friend="${escapeHtml(
          id
        )}" data-mail-friend-name="${escapeHtml(name)}">${escapeHtml(name)}</button>`;
      })
      .join("")}</div>`;
  }

  function mailItemsHtml(items, removable) {
    if (!items?.length) return `<p class="mail-empty">No items yet</p>`;
    return `<ul class="mail-item-list">${items
      .map(
        (it, i) =>
          `<li class="mail-item">${escapeHtml(mailItemLabel(it))}${
            removable
              ? ` <button type="button" class="btn btn-ghost mail-item-remove" data-mail-remove="${i}">✕</button>`
              : ""
          }</li>`
      )
      .join("")}</ul>`;
  }

  function composeCountKind(kind, extra = {}) {
    return (mailCompose?.items || []).filter((it) => {
      if (it.kind !== kind) return false;
      if (kind === "chest" && extra.chestKind) return it.chestKind === extra.chestKind;
      if (kind === "luckyblock" && extra.lbType) return it.lbType === extra.lbType;
      return true;
    }).length;
  }

  function findComposeIndex(kind, extra = {}) {
    const items = mailCompose?.items || [];
    for (let i = items.length - 1; i >= 0; i -= 1) {
      const it = items[i];
      if (it.kind !== kind) continue;
      if (kind === "chest" && extra.chestKind && it.chestKind !== extra.chestKind) continue;
      if (kind === "luckyblock" && extra.lbType && it.lbType !== extra.lbType) continue;
      return i;
    }
    return -1;
  }

  function mailPickTogglesHtml() {
    if (!mailCompose || (mailCompose.mode !== "gift" && mailCompose.mode !== "trade")) {
      return "";
    }
    const selectedFish = (mailCompose.items || [])
      .map((it, i) => ({ it, i }))
      .filter((x) => x.it.kind === "fish");
    const coolerFish = state.cooler
      .map((entry, index) => ({ entry, index }))
      .filter(({ entry }) => !isCoolerSaved(entry));

    let fishBtns = selectedFish
      .map(({ it, i }) => {
        return `<button type="button" class="mail-toggle is-on" data-mail-remove="${i}" aria-pressed="true" title="Remove from offer">${escapeHtml(
          mailItemLabel(it)
        )}</button>`;
      })
      .join("");
    fishBtns += coolerFish
      .map(({ entry, index }) => {
        const fish = fishById(coolerEntryId(entry));
        if (!fish) return "";
        const norm = normalizeCoolerEntry(entry) || entry;
        const label = formatFishName(fish, norm);
        const val = formatNum(mailFishSellValue(norm));
        return `<button type="button" class="mail-toggle" data-mail-fish="${index}" aria-pressed="false" title="Add to offer · sells for ${val}">${escapeHtml(
          label
        )} · ${escapeHtml(val)}</button>`;
      })
      .join("");

    const moneyHave = Math.max(0, Math.floor(Number(state.moneyChestCount) || 0));
    const luckHave = Math.max(0, Math.floor(Number(state.luckChestCount) || 0));
    const moneyOn = composeCountKind("chest", { chestKind: "money" });
    const luckOn = composeCountKind("chest", { chestKind: "luck" });
    const astralHave = luckyBlockCount("astral");
    const absHave = luckyBlockCount("absolute");
    const zenHave = luckyBlockCount("zenith");
    const astralOn = composeCountKind("luckyblock", { lbType: "astral" });
    const absOn = composeCountKind("luckyblock", { lbType: "absolute" });
    const zenOn = composeCountKind("luckyblock", { lbType: "zenith" });

    function stashToggleLabel(name, giving, owned) {
      if (giving > 0) return `${name} · gives ×${giving} · ${owned} left`;
      return `${name} · ${owned} owned`;
    }

    const stashBtns = [
      `<button type="button" class="mail-toggle${moneyOn ? " is-on" : ""}" data-mail-toggle-chest="money" aria-pressed="${
        moneyOn ? "true" : "false"
      }" ${!moneyOn && moneyHave < 1 ? "disabled" : ""}>${escapeHtml(
        stashToggleLabel("Coin chest", moneyOn, moneyHave)
      )}</button>`,
      `<button type="button" class="mail-toggle${luckOn ? " is-on" : ""}" data-mail-toggle-chest="luck" aria-pressed="${
        luckOn ? "true" : "false"
      }" ${!luckOn && luckHave < 1 ? "disabled" : ""}>${escapeHtml(
        stashToggleLabel("Luck chest", luckOn, luckHave)
      )}</button>`,
      `<button type="button" class="mail-toggle${astralOn ? " is-on" : ""}" data-mail-toggle-lb="astral" aria-pressed="${
        astralOn ? "true" : "false"
      }" ${!astralOn && astralHave < 1 ? "disabled" : ""}>${escapeHtml(
        stashToggleLabel("Astral", astralOn, astralHave)
      )}</button>`,
      `<button type="button" class="mail-toggle${absOn ? " is-on" : ""}" data-mail-toggle-lb="absolute" aria-pressed="${
        absOn ? "true" : "false"
      }" ${!absOn && absHave < 1 ? "disabled" : ""}>${escapeHtml(
        stashToggleLabel("Absolute", absOn, absHave)
      )}</button>`,
      `<button type="button" class="mail-toggle${zenOn ? " is-on" : ""}" data-mail-toggle-lb="zenith" aria-pressed="${
        zenOn ? "true" : "false"
      }" ${!zenOn && zenHave < 1 ? "disabled" : ""}>${escapeHtml(
        stashToggleLabel("Zenith", zenOn, zenHave)
      )}</button>`
    ].join("");

    return `<p class="mail-section-label">Fish (toggle)</p>
      <div class="mail-toggle-grid">${fishBtns || `<span class="mail-empty">No unsaved fish in cooler</span>`}</div>
      <p class="mail-section-label">Stash (toggle)</p>
      <div class="mail-toggle-grid mail-toggle-stash">${stashBtns}</div>`;
  }

  async function toggleComposeChest(chestKind) {
    const idx = findComposeIndex("chest", { chestKind });
    if (idx >= 0) {
      await removeComposeItem(idx);
      return;
    }
    await addComposeChest(chestKind, 1);
  }

  async function toggleComposeLuckyBlock(lbType) {
    const idx = findComposeIndex("luckyblock", { lbType });
    if (idx >= 0) {
      await removeComposeItem(idx);
      return;
    }
    await addComposeLuckyBlock(lbType, 1);
  }

  function renderMailOverlay() {
    const body = document.getElementById("mail-body");
    if (!body) return;
    const friends = window.HubFriends?.getFriends?.() || [];
    const myId = mailMyId();
    const me = playerNameLower();
    const claimed = readPlayerMailClaimed();

    const inboxGifts = Object.values(playerMailCache.gifts || {}).filter((g) => {
      if (!g || g.claimed) return false;
      const gid = String(g.id || "");
      if (!gid || claimed.has(gid)) return false;
      return (
        (g.toPlayerId && myId && g.toPlayerId === myId) ||
        (g.toName && me && String(g.toName).toLowerCase() === me)
      );
    });
    const myTrades = Object.values(playerMailCache.trades || {}).filter(
      (t) => t && myTradeSide(t) && (t.status === "open" || t.status === "done")
    );

    let html = `<div class="mail-tabs" role="tablist">
      <button type="button" class="mail-tab${mailTab === "inbox" ? " is-active" : ""}" data-mail-tab="inbox">Inbox${
        inboxGifts.length ? ` (${inboxGifts.length})` : ""
      }</button>
      <button type="button" class="mail-tab${mailTab === "gift" ? " is-active" : ""}" data-mail-tab="gift">Send gift</button>
      <button type="button" class="mail-tab${mailTab === "trade" ? " is-active" : ""}" data-mail-tab="trade">Trade</button>
    </div>`;

    if (mailTab === "inbox") {
      html += `<div class="mail-panel">`;
      if (!inboxGifts.length && !myTrades.filter((t) => t.status === "open").length) {
        html += `<p class="mail-empty">No gifts waiting. Friends can send you fish, chests, or lucky blocks.</p>`;
      }
      inboxGifts.forEach((g) => {
        html += `<div class="mail-card">
          <div class="mail-card-head"><strong>Gift from ${escapeHtml(
            g.fromName || "friend"
          )}</strong></div>
          ${mailItemsHtml(g.items || [], false)}
          <button type="button" class="btn" data-mail-claim="${escapeHtml(g.id)}">Claim</button>
        </div>`;
      });
      myTrades
        .filter((t) => t.status === "open")
        .forEach((t) => {
          const side = myTradeSide(t);
          const other = side === "a" ? t.bName : t.aName;
          html += `<div class="mail-card">
            <div class="mail-card-head"><strong>Open trade with ${escapeHtml(
              other || "friend"
            )}</strong></div>
            <button type="button" class="btn btn-ghost" data-mail-open-trade="${escapeHtml(
              t.id
            )}">Open</button>
          </div>`;
        });
      html += `</div>`;
    } else if (mailTab === "gift") {
      if (!mailCompose || mailCompose.mode !== "gift") {
        mailCompose = {
          mode: "gift",
          friendId: "",
          friendName: "",
          items: [],
          tradeId: ""
        };
      }
      const c = mailCompose;
      html += `<div class="mail-panel">
        <p class="mail-hint">Friends only · toggle fish &amp; stash below. Max ${PLAYER_MAIL_MAX_ITEMS} items.</p>
        <p class="mail-section-label">Friend</p>
        ${friendOptionsHtml(c.friendId)}
        <p class="mail-section-label">Selected (${c.items.length}/${PLAYER_MAIL_MAX_ITEMS})</p>
        ${mailItemsHtml(c.items, true)}
        ${mailPickTogglesHtml()}
        <div class="mail-actions">
          <button type="button" class="btn" data-mail-send-gift>Send gift</button>
          <button type="button" class="btn btn-ghost" data-mail-cancel-compose>Cancel</button>
        </div>
      </div>`;
    } else {
      const c = mailCompose?.mode === "trade" ? mailCompose : null;
      html += `<div class="mail-panel">`;
      if (!c?.tradeId) {
        html += `<p class="mail-hint">Start a trade with a friend, then toggle items on. Both must Accept.</p>
        <p class="mail-section-label">Start with</p>
        ${friendOptionsHtml("")}
        <p class="mail-empty">${friends.length ? "Tap a friend to open a trade." : ""}</p>`;
      } else {
        const t = playerMailCache.trades?.[c.tradeId];
        const side = t ? myTradeSide(t) : "a";
        const mine = t ? (side === "a" ? t.aItems : t.bItems) : c.items;
        const theirs = t ? (side === "a" ? t.bItems : t.aItems) : [];
        const myAccept = t ? (side === "a" ? t.aAccept : t.bAccept) : false;
        const theirAccept = t ? (side === "a" ? t.bAccept : t.aAccept) : false;
        if (Array.isArray(mine)) c.items = mine.slice();
        html += `<p class="mail-hint">Trading with <strong>${escapeHtml(
          c.friendName
        )}</strong> · toggle items on/off</p>
        <div class="mail-trade-cols">
          <div class="mail-trade-col">
            <p class="mail-section-label">You ${myAccept ? "· accepted" : ""} (${(mine || []).length}/${PLAYER_MAIL_MAX_ITEMS})</p>
            ${mailItemsHtml(mine || c.items, true)}
            ${mailPickTogglesHtml()}
          </div>
          <div class="mail-trade-col">
            <p class="mail-section-label">Them ${theirAccept ? "· accepted" : ""}</p>
            ${mailItemsHtml(theirs, false)}
          </div>
        </div>
        <div class="mail-actions">
          <button type="button" class="btn" data-mail-accept="${escapeHtml(c.tradeId)}" ${
            myAccept ? "disabled" : ""
          }>Accept</button>
          <button type="button" class="btn btn-ghost" data-mail-unaccept="${escapeHtml(
            c.tradeId
          )}" ${myAccept ? "" : "disabled"}>Un-accept</button>
          <button type="button" class="btn btn-ghost" data-mail-cancel-trade="${escapeHtml(
            c.tradeId
          )}">Cancel trade</button>
        </div>`;
      }
      html += `</div>`;
    }
    body.innerHTML = html;
  }

  function openMailOverlay(tab) {
    if (tab) mailTab = tab;
    if (mailTab === "gift" && (!mailCompose || mailCompose.mode !== "gift")) {
      mailCompose = {
        mode: "gift",
        friendId: "",
        friendName: "",
        items: [],
        tradeId: ""
      };
    }
    const overlay = document.getElementById("mail-overlay");
    if (!overlay) return;
    overlay.classList.remove("hidden");
    try {
      window.HubFriends?.sync?.();
      window.HubFriends?.startPolling?.();
    } catch {}
    pollPlayerMail(true).then(() => renderMailOverlay());
    renderMailOverlay();
  }

  function closeMailOverlay() {
    document.getElementById("mail-overlay")?.classList.add("hidden");
  }

  function startPlayerMailPolling() {
    pollPlayerMail(true);
    if (playerMailPollTimer) clearInterval(playerMailPollTimer);
    playerMailPollTimer = setInterval(() => pollPlayerMail(false), PLAYER_MAIL_POLL_MS);
    try {
      window.HubFriends?.startPolling?.();
    } catch {}
  }

  async function runGiveFishCommand(cmd) {
    if (!isFishingAdmin()) {
      setCatchLine("Admin only", "miss");
      return;
    }
    const fish = fishById(cmd.fishId);
    if (!fish) {
      setCatchLine("Unknown fish", "miss");
      return;
    }
    const variants = {
      variant: normalizeVariant(cmd.variant),
      shiny: !!cmd.shiny,
      mutation: normalizeMutation(cmd.mutation)
    };
    const count = resolveAdminGiftCount(cmd.count);
    const label = formatFishName(fish, isExclusiveFish(fish) ? {} : variants);
    let toRaw = String(cmd.to || "me").trim();
    // Exclusive Soul Twin defaults to you — avoid accidental global spam.
    if (isExclusiveFish(fish) && (!toRaw || toRaw.toLowerCase() === "me" || toRaw.toLowerCase() === "self")) {
      cmd.forceSelf = true;
    }
    // Limited admin: self gifts only.
    if (!canAdminGiftOthers()) {
      cmd.forceSelf = true;
      const toKeyCheck = toRaw.toLowerCase();
      if (
        toKeyCheck &&
        toKeyCheck !== "me" &&
        toKeyCheck !== "self" &&
        toKeyCheck !== playerNameLower()
      ) {
        setCatchLine("Local admin only — can't gift other players or everyone", "miss");
        playSfx("miss");
        return;
      }
      toRaw = "me";
    }
    // Global admin scope + no explicit target → everyone
    if (
      (!toRaw || toRaw.toLowerCase() === "me" || toRaw.toLowerCase() === "self") &&
      getAdminScope() === "global" &&
      !cmd.forceSelf &&
      canAdminGiftOthers()
    ) {
      toRaw = "everyone";
    }
    const toKey = toRaw.toLowerCase();
    const isEveryone = isEveryoneGiftTarget(toKey);
    const isSelf =
      !isEveryone &&
      (!toKey || toKey === "me" || toKey === "self" || toKey === playerNameLower());

    if (isSelf) {
      let gained = 0;
      for (let i = 0; i < count; i += 1) {
        const entry = grantFishToLocal(fish, { variants, perfect: !!cmd.perfect });
        if (entry) gained += 1;
      }
      if (!gained) {
        setCatchLine(
          isExclusiveFish(fish)
            ? "Couldn't add Soul Twin — free a cooler slot (sell unsaved fish)"
            : "Cooler full — sell fish first",
          "miss"
        );
        playSfx("miss");
        return;
      }
      ensureExclusiveCoolerValues();
      saveState();
      render(true);
      const locked = Math.floor(Number(
        state.cooler.find((e) => e?.id === fish.id)?.lockedValue
      ) || exclusiveMirrorBaseValue());
      const shown = isExclusiveFish(fish)
        ? `${label} (${formatNum(locked)} locked)`
        : label;
      setCatchLine(
        gained === 1 ? `Gave ${shown} to you` : `Gave ${gained}× ${shown} to you`,
        catchTone(fish.rarity)
      );
      playSfx("win");
      return;
    }

    if (isEveryone) {
      setCatchLine(`Sending ${label} to everyone…`, "");
      const ok = await queueFishGift({
        toName: "*",
        toPlayerId: "",
        toDisplay: "everyone",
        broadcast: true,
        fishId: fish.id,
        variant: variants.variant,
        shiny: variants.shiny,
        mutation: variants.mutation,
        perfect: !!cmd.perfect,
        count
      });
      if (!ok) {
        setCatchLine("Couldn't queue fish gift — try again", "miss");
        playSfx("miss");
        return;
      }
      setCatchLine(
        count === 1
          ? `Queued ${label} for everyone`
          : `Queued ${count}× ${label} for everyone`,
        catchTone(fish.rarity)
      );
      playSfx("click");
      // Claim on this device too
      pollFishGifts(true).catch(() => {});
      return;
    }

    setCatchLine(`Sending ${label} to ${toRaw}…`, "");
    const target = await lookupPlayerForGift(toRaw);
    const ok = await queueFishGift({
      toName: toKey,
      toPlayerId: target?.playerId || "",
      toDisplay: target?.name || toRaw,
      fishId: fish.id,
      variant: variants.variant,
      shiny: variants.shiny,
      mutation: variants.mutation,
      perfect: !!cmd.perfect,
      count
    });
    if (!ok) {
      setCatchLine("Couldn't queue fish gift — try again", "miss");
      playSfx("miss");
      return;
    }
    const who = target?.name || toRaw;
    setCatchLine(
      count === 1 ? `Queued ${label} for ${who}` : `Queued ${count}× ${label} for ${who}`,
      catchTone(fish.rarity)
    );
    playSfx("click");
  }

  function parseAdminCommand(raw) {
    let text = String(raw || "")
      .trim()
      .toLowerCase()
      .replace(/×/g, "x")
      .replace(/[+&|]/g, " ")
      .replace(/\b(plus|and)\b/g, " ")
      .replace(/\s+/g, " ");
    if (!text) return null;

    const defaults = readAdminFormDefaults();
    let scope = defaults.scope;
    if (/\b(global|everyone|all)\b/.test(text)) {
      scope = "global";
      text = text.replace(/\b(global|everyone|all)\b/g, " ").replace(/\s+/g, " ").trim();
    } else if (/\b(local|solo|me|only me)\b/.test(text)) {
      scope = "local";
      text = text.replace(/\b(local|solo|me|only me)\b/g, " ").replace(/\s+/g, " ").trim();
    }

    if (/^(clear|off|stop|end)\b/.test(text)) {
      if (/\bweather\b/.test(text) || /\b(storm|calm|wx)\b/.test(text)) {
        return { kind: "clear-weather", minutes: 0, mult: ADMIN_DEFAULT_MULT, scope, target: "" };
      }
      if (/\b(variant|silver|gold|diamond|rainbow|shiny|any)\b/.test(text)) {
        return { kind: "clear-variant", minutes: 0, mult: ADMIN_DEFAULT_MULT, scope, target: "" };
      }
      if (/\btoxic\b/.test(text)) {
        return { kind: "clear-toxic", minutes: 0, mult: ADMIN_DEFAULT_MULT, scope, target: "toxic" };
      }
      if (/\blava\b/.test(text)) {
        return { kind: "clear-lava", minutes: 0, mult: ADMIN_DEFAULT_MULT, scope, target: "lava" };
      }
      if (/\bneon\b/.test(text)) {
        return { kind: "clear-neon", minutes: 0, mult: ADMIN_DEFAULT_MULT, scope, target: "neon" };
      }
      if (/\b(mutation|mutations)\b/.test(text)) {
        return { kind: "clear-mutation", minutes: 0, mult: ADMIN_DEFAULT_MULT, scope, target: "" };
      }
      if (/\blucky\s*-?\s*blocks?\b|\bluckyblock\b|\blb\b/.test(text)) {
        return { kind: "clear-luckyblock", minutes: 0, mult: ADMIN_DEFAULT_MULT, scope, target: "" };
      }
      if (/\bchests?\b/.test(text)) {
        return { kind: "clear-chest", minutes: 0, mult: ADMIN_DEFAULT_MULT, scope, target: "" };
      }
      if (/\b(say|announce|announcement|message|msg|broadcast)\b/.test(text)) {
        return { kind: "clear-announce", minutes: 0, mult: ADMIN_DEFAULT_MULT, scope, target: "" };
      }
      if (/\b(speed|cast|cooldown|wait|faster)\b/.test(text)) {
        return { kind: "clear-speed", minutes: 0, mult: ADMIN_DEFAULT_MULT, scope, target: "" };
      }
      if (/\b(luck|sell|money|coin|boost)\b/.test(text)) {
        return { kind: "clear-boost", minutes: 0, mult: ADMIN_DEFAULT_MULT, scope, target: "" };
      }
      // "clear skies" / "clear sky" → force clear weather (not clear-all)
      if (/\b(skies|sky)\b/.test(text)) {
        /* fall through after stripping clear */
        text = text.replace(/^(clear|off|stop|end)\b/, "weather").replace(/\s+/g, " ").trim();
      } else {
        return { kind: "clear", minutes: 0, mult: ADMIN_DEFAULT_MULT, scope, target: "" };
      }
    }

    let mult = defaults.mult;
    let usedExplicitMult = false;
    const multMatch = text.match(/(\d+(?:\.\d+)?)\s*x\b/);
    if (multMatch) {
      mult = clampAdminMult(multMatch[1]);
      usedExplicitMult = true;
      text = `${text.slice(0, multMatch.index)} ${text.slice(multMatch.index + multMatch[0].length)}`
        .replace(/\s+/g, " ")
        .trim();
    }

    let minutes = defaults.minutes;
    const minsMatch = text.match(/\b(\d{1,3})\s*(?:m|mins?|minutes?)\b/);
    if (minsMatch) {
      minutes = clampAdminMinutes(minsMatch[1]);
      text = text.replace(minsMatch[0], " ").replace(/\s+/g, " ").trim();
    } else {
      const bare = text.match(/\b(\d{1,3})$/);
      if (bare) {
        minutes = clampAdminMinutes(bare[1]);
        text = text.replace(bare[0], " ").replace(/\s+/g, " ").trim();
      }
    }

    if (
      !usedExplicitMult &&
      /^(sell|money|coin|luck|speed|cast|cooldown|wait|faster|chest|chests|luckyblock|lucky\s*-?\s*blocks?|lb|silver|gold|diamond|rainbow|shiny|any|variant|storm|calm|sunny|weather)(\s+(silver|gold|diamond|rainbow|shiny|any|storm|calm|none|clear|sunny|skies|sky))*$/.test(
        text
      )
    ) {
      mult = defaults.mult;
    }

    if (/\bstorm\b/.test(text) || /\brain\b/.test(text) || /\bthunder\b/.test(text)) {
      return { kind: "weather", minutes, mult: 1, scope, target: "storm" };
    }
    if (/\bcalm\b/.test(text)) {
      return { kind: "weather", minutes, mult: 1, scope, target: "calm" };
    }
    if (
      /\bsunny\b/.test(text) ||
      /\b(skies|sky)\b/.test(text) ||
      /\bweather\s+(none|clear|off)\b/.test(text) ||
      /^(none|clear)$/.test(text) ||
      text === "weather"
    ) {
      return { kind: "weather", minutes, mult: 1, scope, target: "none" };
    }
    if (/\blucky\s*-?\s*blocks?\b/.test(text) || /\bluckyblock\b/.test(text) || text === "lb") {
      return { kind: "luckyblock", minutes, mult, scope, target: "" };
    }
    if (/\bchests?\b/.test(text)) {
      return { kind: "chest", minutes, mult, scope, target: "" };
    }
    if (/\bneon\b/.test(text)) {
      return { kind: "mutation", minutes, mult, scope, target: "neon" };
    }
    if (/\blava\b/.test(text)) {
      return { kind: "mutation", minutes, mult, scope, target: "lava" };
    }
    if (/\btoxic\b/.test(text) || /\bmutation\b/.test(text)) {
      return { kind: "mutation", minutes, mult, scope, target: "toxic" };
    }
    if (
      /\b(speed|cast|cooldown|wait|faster)\b/.test(text) ||
      /^(speed|cast|cooldown|wait|faster)$/.test(text)
    ) {
      return { kind: "speed", minutes, mult, scope, target: "" };
    }
    if (/\bluck\b/.test(text) || text === "luck") {
      return { kind: "luck", minutes, mult, scope, target: "" };
    }
    if (/\b(money|sell|coin)\b/.test(text) || /^(sell|money|coin)$/.test(text)) {
      return { kind: "money", minutes, mult, scope, target: "" };
    }
    const variantWords = [...text.matchAll(/\b(silver|gold|diamond|rainbow|shiny|any)\b/g)].map(
      (m) => m[1]
    );
    if (variantWords.length || /\bvariant\b/.test(text)) {
      const target =
        normalizeAdminVariantTarget(variantWords.join("+") || "gold") || "gold";
      return { kind: "variant", minutes, mult, scope, target };
    }
    return null;
  }

  function parseGiveLuckyBlockCommand(raw) {
    const original = String(raw || "").trim();
    const head = original.match(
      /^(give|gift)\s+(?:(astral|absolute|zenith)\s+)?lucky\s*-?\s*blocks?(?:\s+(astral|absolute|zenith))?\b/i
    );
    if (!head) return null;

    const type = resolveLuckyBlockType(head[2] || head[3] || "absolute") || "absolute";
    let rest = original.slice(head[0].length).trim();
    let to = "me";
    const toMatch = rest.match(/\bto\s+@?(.+)$/i);
    if (toMatch) {
      to = toMatch[1].trim();
      rest = rest.slice(0, toMatch.index).trim();
    } else if (/\b(everyone|everybody|all players|all|global)\s*$/i.test(rest)) {
      to = "everyone";
      rest = rest.replace(/\b(everyone|everybody|all players|all|global)\s*$/i, "").trim();
    } else if (/\b(me|self)\s*$/i.test(rest)) {
      rest = rest.replace(/\b(me|self)\s*$/i, "").trim();
      to = "me";
    }

    let count = null;
    const countMatch = rest.match(/(?:^|\s)(?:x\s*(\d{1,2})|(\d{1,2})\s*x)(?:\s|$)/i);
    if (countMatch) {
      count = Math.min(50, Math.max(1, Number(countMatch[1] || countMatch[2]) || 1));
    }

    return { kind: "give-luckyblock", type, count, to };
  }

  function parseGiveChestCommand(raw) {
    const original = String(raw || "").trim();
    // give [Nx] (coin|luck) chest(s) [Nx] [to …]
    // also: give chest / give chests / give moneychest
    const head = original.match(
      /^(give|gift)\s+(?:(\d{1,2})\s*x\s+)?(?:(money|coin|coins|sell|luck|lucky)\s+)?chests?(?:\s+(money|coin|coins|sell|luck|lucky))?\b/i
    );
    if (!head) return null;

    const kind =
      resolveChestGiftKind(head[3] || head[4] || "money") || "money";
    let rest = original.slice(head[0].length).trim();
    let to = "me";
    let explicitTo = false;
    const toMatch = rest.match(/\bto\s+@?(.+)$/i);
    if (toMatch) {
      to = toMatch[1].trim();
      rest = rest.slice(0, toMatch.index).trim();
      explicitTo = true;
    } else if (/\b(everyone|everybody|all players|all|global)\s*$/i.test(rest)) {
      to = "everyone";
      rest = rest.replace(/\b(everyone|everybody|all players|all|global)\s*$/i, "").trim();
      explicitTo = true;
    } else if (/\b(me|self)\s*$/i.test(rest)) {
      rest = rest.replace(/\b(me|self)\s*$/i, "").trim();
      to = "me";
      explicitTo = true;
    }

    let count = head[2] ? Math.min(50, Math.max(1, Number(head[2]) || 1)) : null;
    const countMatch = rest.match(/(?:^|\s)(?:x\s*(\d{1,2})|(\d{1,2})\s*x)(?:\s|$)/i);
    if (countMatch) {
      count = Math.min(50, Math.max(1, Number(countMatch[1] || countMatch[2]) || 1));
    }

    const toKey = String(to || "me").toLowerCase();
    const forceSelf =
      explicitTo && (toKey === "me" || toKey === "self" || toKey === playerNameLower());

    return { kind: "give-chest", chestKind: kind, count, to, forceSelf };
  }

  function storeAdminChests(kind, count, opts = {}) {
    const added = grantAdminChests(kind, count);
    if (!added) {
      if (!opts.silent) {
        setCatchLine("Chest stash at hard limit", "miss");
        playSfx("miss");
      }
      return 0;
    }
    renderTreasureStash();
    saveState();
    if (!opts.silent) playSfx("win");
    return added;
  }

  /** Admin / gift chests — may go past the soft earn cap (25/100). */
  function grantAdminChests(kind, count) {
    const key = chestCountKey(kind);
    const n = Math.max(0, Math.floor(Number(count) || 0));
    if (!n) return 0;
    const cur = Math.max(0, Math.floor(Number(state[key]) || 0));
    const room = Math.max(0, TREASURE_STASH_HARD_MAX - cur);
    const added = Math.min(n, room);
    if (!added) return 0;
    state[key] = cur + added;
    return added;
  }

  function giftSelfClaimedBy() {
    const by = {};
    const me = playerNameLower();
    const myId = String(window.HubPlays?.getPlayerId?.() || "");
    if (myId) by[myId] = true;
    if (me) by[me] = true;
    return by;
  }

  async function runGiveChestCommand(cmd) {
    if (!isFishingAdmin()) {
      setCatchLine("Admin only", "miss");
      return;
    }
    const chestKind = cmd.chestKind === "luck" ? "luck" : "money";
    const def = chestGiftDef(chestKind);
    const count = resolveAdminGiftCount(cmd.count);
    let toRaw = String(cmd.to || "me").trim();
    if (!canAdminGiftOthers()) {
      cmd.forceSelf = true;
      const toKeyCheck = toRaw.toLowerCase();
      if (
        toKeyCheck &&
        toKeyCheck !== "me" &&
        toKeyCheck !== "self" &&
        toKeyCheck !== playerNameLower()
      ) {
        setCatchLine("Local admin only — can't gift other players or everyone", "miss");
        playSfx("miss");
        return;
      }
      toRaw = "me";
    }
    if (
      (!toRaw || toRaw.toLowerCase() === "me" || toRaw.toLowerCase() === "self") &&
      getAdminScope() === "global" &&
      !cmd.forceSelf &&
      canAdminGiftOthers()
    ) {
      toRaw = "everyone";
    }
    const toKey = toRaw.toLowerCase();
    const isEveryone = isEveryoneGiftTarget(toKey);
    const isSelf =
      !isEveryone &&
      (!toKey || toKey === "me" || toKey === "self" || toKey === playerNameLower());

    if (isSelf) {
      const added = storeAdminChests(chestKind, count);
      if (!added) return;
      setCatchLine(
        added === 1 ? `Gave ${def.name} to you` : `Gave ${added}× ${def.name} to you`,
        "treasure"
      );
      return;
    }

    if (isEveryone) {
      // Grant locally right away — don't wait on gift poll (that path was unreliable).
      const selfAdded = storeAdminChests(chestKind, count, { silent: true });
      setCatchLine(`Sending ${def.name} to everyone…`, "");
      const ok = await queueFishGift({
        toName: "*",
        toPlayerId: "",
        toDisplay: "everyone",
        broadcast: true,
        fishId: def.giftId,
        item: def.item,
        count,
        claimedBy: giftSelfClaimedBy()
      });
      if (!ok) {
        if (selfAdded) {
          setCatchLine(
            selfAdded === 1
              ? `Gave ${def.name} to you · everyone sync failed`
              : `Gave ${selfAdded}× ${def.name} to you · everyone sync failed`,
            "treasure"
          );
          return;
        }
        setCatchLine(`Couldn't queue ${def.name} — try again`, "miss");
        playSfx("miss");
        return;
      }
      if (selfAdded) {
        setCatchLine(
          selfAdded === 1
            ? `Gave ${def.name} to you + queued for everyone`
            : `Gave ${selfAdded}× ${def.name} to you + queued for everyone`,
          "treasure"
        );
      } else {
        setCatchLine(
          count === 1
            ? `Queued ${def.name} for everyone (your stash is full)`
            : `Queued ${count}× ${def.name} for everyone (your stash is full)`,
          "treasure"
        );
      }
      playSfx("click");
      return;
    }

    setCatchLine(`Sending ${def.name} to ${toRaw}…`, "");
    const target = await lookupPlayerForGift(toRaw);
    const ok = await queueFishGift({
      toName: toKey,
      toPlayerId: target?.playerId || "",
      toDisplay: target?.name || toRaw,
      fishId: def.giftId,
      item: def.item,
      count
    });
    if (!ok) {
      setCatchLine(`Couldn't queue ${def.name} — try again`, "miss");
      playSfx("miss");
      return;
    }
    const who = target?.name || toRaw;
    setCatchLine(
      count === 1 ? `Queued ${def.name} for ${who}` : `Queued ${count}× ${def.name} for ${who}`,
      "treasure"
    );
    playSfx("click");
  }

  async function runGiveLuckyBlockCommand(cmd) {
    if (!isFishingAdmin()) {
      setCatchLine("Admin only", "miss");
      return;
    }
    const type = resolveLuckyBlockType(cmd.type) || "absolute";
    const def = luckyBlockDef(type);
    const count = resolveAdminGiftCount(cmd.count);
    let toRaw = String(cmd.to || "me").trim();
    if (!canAdminGiftOthers()) {
      cmd.forceSelf = true;
      const toKeyCheck = toRaw.toLowerCase();
      if (
        toKeyCheck &&
        toKeyCheck !== "me" &&
        toKeyCheck !== "self" &&
        toKeyCheck !== playerNameLower()
      ) {
        setCatchLine("Local admin only — can't gift other players or everyone", "miss");
        playSfx("miss");
        return;
      }
      toRaw = "me";
    }
    if (
      (!toRaw || toRaw.toLowerCase() === "me" || toRaw.toLowerCase() === "self") &&
      getAdminScope() === "global" &&
      !cmd.forceSelf &&
      canAdminGiftOthers()
    ) {
      toRaw = "everyone";
    }
    const toKey = toRaw.toLowerCase();
    const isEveryone = isEveryoneGiftTarget(toKey);
    const isSelf =
      !isEveryone &&
      (!toKey || toKey === "me" || toKey === "self" || toKey === playerNameLower());

    if (isSelf) {
      const added = storeLuckyBlock(type, count);
      if (!added) return;
      setCatchLine(
        added === 1 ? `Gave ${def.name} to you` : `Gave ${added}× ${def.name} to you`,
        "treasure"
      );
      return;
    }

    if (isEveryone) {
      setCatchLine(`Sending ${def.name} to everyone…`, "");
      const ok = await queueFishGift({
        toName: "*",
        toPlayerId: "",
        toDisplay: "everyone",
        broadcast: true,
        fishId: def.giftId,
        item: def.item,
        count
      });
      if (!ok) {
        setCatchLine(`Couldn't queue ${def.name} — try again`, "miss");
        playSfx("miss");
        return;
      }
      setCatchLine(
        count === 1
          ? `Queued ${def.name} for everyone`
          : `Queued ${count}× ${def.name} for everyone`,
        "treasure"
      );
      playSfx("click");
      pollFishGifts(true).catch(() => {});
      return;
    }

    setCatchLine(`Sending ${def.name} to ${toRaw}…`, "");
    const target = await lookupPlayerForGift(toRaw);
    const ok = await queueFishGift({
      toName: toKey,
      toPlayerId: target?.playerId || "",
      toDisplay: target?.name || toRaw,
      fishId: def.giftId,
      item: def.item,
      count
    });
    if (!ok) {
      setCatchLine(`Couldn't queue ${def.name} — try again`, "miss");
      playSfx("miss");
      return;
    }
    const who = target?.name || toRaw;
    setCatchLine(
      count === 1 ? `Queued ${def.name} for ${who}` : `Queued ${count}× ${def.name} for ${who}`,
      "treasure"
    );
    playSfx("click");
  }

  async function runAdminCommand(raw) {
    if (!isFishingAdmin()) {
      setCatchLine("Admin only", "miss");
      return;
    }
    const trimmed = String(raw || "").trim();
    if (trimmed) pushAdminCmdHistory(trimmed);
    const deleteTwin = trimmed.match(
      /^(?:delete|remove|drop)\s+(?:fish\s+)?(?:soul\s*twins?|soultwins?|the\s*twin)\b(?:\s*(?:x\s*)?(\d{1,2}))?\s*$/i
    );
    if (deleteTwin) {
      if (!isFishingOwner()) {
        setCatchLine("Owner only", "miss");
        playSfx("miss");
        return;
      }
      const n = Math.max(1, Math.min(50, Number(deleteTwin[1]) || 1));
      await burnPendingSoulTwinGifts();
      const removed = removeSoulTwinsFromCooler(n);
      if (!removed) {
        setCatchLine("No Soul Twin in cooler", "miss");
        playSfx("miss");
        return;
      }
      setCatchLine(
        removed === 1 ? "Deleted 1 Soul Twin" : `Deleted ${removed} Soul Twins`,
        "treasure"
      );
      playSfx("click");
      return;
    }
    const announce = parseAnnounceCommand(raw);
    if (announce) {
      if (!canAdminGlobal()) {
        setCatchLine("Local admin only — can't send global announce", "miss");
        playSfx("miss");
        return;
      }
      if (announce.kind === "clear-announce") {
        await clearAdminAnnounce();
        return;
      }
      if (announce.error) {
        setCatchLine(announce.error, "miss");
        playSfx("miss");
        return;
      }
      await publishAdminAnnounce(announce.text);
      return;
    }
    const blockGift = parseGiveLuckyBlockCommand(raw);
    if (blockGift) {
      await runGiveLuckyBlockCommand(blockGift);
      return;
    }
    const chestGift = parseGiveChestCommand(raw);
    if (chestGift) {
      await runGiveChestCommand(chestGift);
      return;
    }
    const gift = parseGiveFishCommand(raw);
    if (gift) {
      if (gift.error) {
        setCatchLine(gift.error, "miss");
        playSfx("miss");
        return;
      }
      await runGiveFishCommand(gift);
      return;
    }
    const parsed = parseAdminCommand(raw);
    if (!parsed) {
      setCatchLine(
        canAdminGlobal()
          ? "Try: say hi · storm · calm · 5x luck · 5x chest · give coin chest · clear weather · clear"
          : "Try: storm · calm · 5x luck · 2x speed · give fish trout · clear weather · clear",
        "miss"
      );
      return;
    }
    if (parsed.kind === "clear-announce") {
      if (!canAdminGlobal()) {
        setCatchLine("Local admin only — can't clear global announce", "miss");
        playSfx("miss");
        return;
      }
      await clearAdminAnnounce();
      return;
    }
    if (parsed.scope === "global" && !canAdminGlobal()) {
      setCatchLine("Local admin only — events stay on your device", "miss");
      playSfx("miss");
      parsed.scope = "local";
    }
    if (parsed.scope === "local" || parsed.scope === "global") {
      setAdminScope(parsed.scope);
    }
    await publishAdminEvent(
      parsed.kind,
      parsed.minutes,
      parsed.mult,
      canAdminGlobal() ? parsed.scope : "local",
      parsed.target || ""
    );
  }

  function scheduledEventWindowStart(now = Date.now()) {
    return localHalfHourStart(now);
  }

  function eventWindowStart(now = Date.now()) {
    const admin = adminBoostEventLive(now);
    if (admin) return admin.startedAt;
    return scheduledEventWindowStart(now);
  }

  /** True during sell/luck admin override, or first 5 minutes after :00 / :30. */
  function eventIsLive(now = Date.now()) {
    if (adminBoostEventLive(now)) return true;
    const start = scheduledEventWindowStart(now);
    return now >= start && now < start + EVENT_ACTIVE_MS;
  }

  function eventMsLeft(now = Date.now()) {
    const admin = adminBoostEventLive(now);
    if (admin) return Math.max(0, admin.until - now);
    if (!eventIsLive(now)) return 0;
    return Math.max(0, scheduledEventWindowStart(now) + EVENT_ACTIVE_MS - now);
  }

  function msUntilNextEvent(now = Date.now()) {
    if (eventIsLive(now)) return eventMsLeft(now);
    return Math.max(0, nextHalfHourStart(now) - now);
  }

  function eventSlotKey(startTs) {
    const d = new Date(startTs);
    return (
      d.getFullYear() * 1e8 +
      (d.getMonth() + 1) * 1e6 +
      d.getDate() * 1e4 +
      d.getHours() * 100 +
      d.getMinutes()
    );
  }

  /** Half-hour index so consecutive :00 / :30 slots always alternate. */
  function eventSlotIndex(startTs) {
    return Math.floor(Number(startTs) / EVENT_MS);
  }

  function eventKindForStart(startTs) {
    // Strict alternate — money every other half-hour (no long luck-only streaks)
    return eventSlotIndex(startTs) % 2 === 0 ? "money" : "luck";
  }

  /** Deterministic mult for a :00 / :30 slot so every client matches. */
  function eventMultForStart(startTs) {
    let x = (eventSlotIndex(startTs) * 2654435761) >>> 0;
    x ^= x >>> 16;
    x = Math.imul(x ^ (x >>> 13), 2246822519) >>> 0;
    return EVENT_MULT_OPTIONS[x % EVENT_MULT_OPTIONS.length];
  }

  /** Live sell/luck event kind, or null when between windows. Variant admin is separate. */
  function currentEventKind(now = Date.now()) {
    const admin = adminBoostEventLive(now);
    if (admin) return admin.kind;
    if (!eventIsLive(now)) return null;
    return eventKindForStart(scheduledEventWindowStart(now));
  }

  function eventMoneyActive(now = Date.now()) {
    return currentEventKind(now) === "money";
  }

  function eventLuckActive(now = Date.now()) {
    return currentEventKind(now) === "luck";
  }

  function liveEventMult(now = Date.now()) {
    const kind = currentEventKind(now);
    if (!kind) return 1;
    const admin = adminBoostEventLive(now);
    if (admin) return clampAdminMult(admin.mult);
    return eventMultForStart(scheduledEventWindowStart(now));
  }

  function variantEventMult(now = Date.now()) {
    const e = adminVariantEventLive(now);
    return e ? clampAdminMult(e.mult) : 1;
  }

  function variantEventTarget(now = Date.now()) {
    const e = adminVariantEventLive(now);
    return e ? normalizeAdminVariantTarget(e.target) : "";
  }

  function variantEventSpec(now = Date.now()) {
    return decodeVariantTarget(variantEventTarget(now));
  }

  function mutationEventMult(now = Date.now()) {
    const e = adminMutationEventLive(now);
    return e ? clampAdminMult(e.mult) : 1;
  }

  function mutationEventTarget(now = Date.now()) {
    const e = adminMutationEventLive(now);
    return e ? normalizeMutation(e.target) : "";
  }

  function mutationEventMultFor(target, now = Date.now()) {
    const t = normalizeMutation(target);
    if (!t) return 1;
    const e = adminMutationEventsLive(now).find((x) => normalizeMutation(x.target) === t);
    return e ? clampAdminMult(e.mult) : 1;
  }

  function eventMoneyBonus(now = Date.now()) {
    if (!eventMoneyActive(now)) return 0;
    return Math.max(0, liveEventMult(now) - 1);
  }

  function eventLuckBonus(now = Date.now()) {
    if (!eventLuckActive(now)) return 0;
    return Math.max(0, liveEventMult(now) - 1);
  }

  function formatMult(n) {
    const v = Math.round((Number(n) || 1) * 100) / 100;
    if (Number.isInteger(v)) return String(v);
    return String(v).replace(/(\.\d*?[1-9])0+$/, "$1").replace(/\.$/, "");
  }

  function treasureMoneyMult() {
    return 1 + (moneyBoostActive() ? CHEST_MONEY_BONUS : 0) + eventMoneyBonus();
  }

  function treasureLuckMult() {
    return 1 + (luckBoostActive() ? CHEST_LUCK_BONUS : 0) + eventLuckBonus();
  }

  let lastAnnouncedEventKey = "";
  let lastAnnouncedVariantKey = "";
  let lastAnnouncedMutationKey = "";
  let lastAnnouncedChestKey = "";
  let lastAnnouncedLbEventKey = "";

  function maybeAnnounceEvent() {
    const variant = adminVariantEventLive();
    if (variant) {
      const vKey = `variant:${variant.target}:${variant.until}:${variant.mult}`;
      if (vKey !== lastAnnouncedVariantKey) {
        lastAnnouncedVariantKey = vKey;
        const left = formatTreasureClock(Math.max(0, variant.until - Date.now()));
        setCatchLine(
          `ADMIN EVENT · ${formatMult(variant.mult)}× ${formatAdminVariantLabel(
            variant.target
          )} odds (${left} left)`,
          "treasure"
        );
        playSfx("win");
        burstConfetti();
      }
    } else {
      lastAnnouncedVariantKey = "";
    }

    const mutations = adminMutationEventsLive();
    if (mutations.length) {
      const mKey = mutations
        .map((m) => `${m.target}:${m.until}:${m.mult}`)
        .sort()
        .join("|");
      if (mKey !== lastAnnouncedMutationKey) {
        lastAnnouncedMutationKey = mKey;
        const bits = mutations.map((m) => {
          const left = formatTreasureClock(Math.max(0, m.until - Date.now()));
          return `${formatMult(m.mult)}× ${adminEventKindLabel(m)} (${left})`;
        });
        setCatchLine(`ADMIN EVENT · ${bits.join(" · ")} mutation`, "treasure");
        playSfx("win");
        burstConfetti();
      }
    } else {
      lastAnnouncedMutationKey = "";
    }

    const chest = adminChestEventLive();
    if (chest) {
      const cKey = `chest:${chest.until}:${chest.mult}`;
      if (cKey !== lastAnnouncedChestKey) {
        lastAnnouncedChestKey = cKey;
        const left = formatTreasureClock(Math.max(0, chest.until - Date.now()));
        setCatchLine(
          `ADMIN EVENT · ${formatMult(chest.mult)}× chest finds (${left} left)`,
          "treasure"
        );
        playSfx("win");
      }
    } else {
      lastAnnouncedChestKey = "";
    }

    if (luckyBlockEventIsLive()) {
      const adminLb = adminLuckyBlockEventLive();
      const lbKey = adminLb
        ? `lb-admin:${adminLb.until}:${adminLb.mult}`
        : `lb:${localHourStart()}:${liveLuckyBlockEventMult()}`;
      if (lbKey !== lastAnnouncedLbEventKey) {
        lastAnnouncedLbEventKey = lbKey;
        // When sell/luck is also live (:00), that announce covers both.
        if (!eventIsLive()) {
          const tag = adminLb ? "ADMIN EVENT" : "EVENT LIVE";
          setCatchLine(
            `${tag} · ${formatLuckyBlockEventLabel()} (Astral / Absolute / Zenith · ${formatTreasureClock(
              luckyBlockEventMsLeft()
            )} left) · luck ignored`,
            "treasure"
          );
          playSfx("win");
          burstConfetti();
        }
      }
    } else {
      lastAnnouncedLbEventKey = "";
    }

    if (!eventIsLive()) return;
    const admin = adminBoostEventLive();
    const key = admin
      ? `admin:${admin.kind}:${admin.until}:${admin.mult}`
      : String(eventSlotKey(eventWindowStart()));
    if (key === lastAnnouncedEventKey) return;
    lastAnnouncedEventKey = key;
    const kind = currentEventKind();
    const left = formatTreasureClock(eventMsLeft());
    const multLabel = formatMult(liveEventMult());
    const tag = admin ? "ADMIN EVENT" : "EVENT LIVE";
    const lbNote = luckyBlockEventIsLive()
      ? ` · + ${formatLuckyBlockEventLabel()} (${formatTreasureClock(luckyBlockEventMsLeft())} left, luck ignored)`
      : "";
    if (kind === "luck") {
      const stacked = formatMult(1 + CHEST_LUCK_BONUS + (liveEventMult() - 1));
      setCatchLine(
        `${tag} · ${multLabel}× luck (${left} left) · stacks with Luck Chest → ${stacked}×${lbNote}`,
        "treasure"
      );
    } else {
      const stacked = formatMult(1 + CHEST_MONEY_BONUS + (liveEventMult() - 1));
      setCatchLine(
        `${tag} · ${multLabel}× sell (${left} left) · stacks with Coin Chest → ${stacked}×${lbNote}`,
        "treasure"
      );
    }
    playSfx("win");
    burstConfetti();
  }

  function renderEventBanner() {
    const live = eventIsLive();
    const kind = currentEventKind();
    const admin = adminBoostEventLive();
    const variant = adminVariantEventLive();
    const mutations = adminMutationEventsLive();
    const lbLive = luckyBlockEventIsLive();
    const nextStart = nextHalfHourStart();
    const nextKind = eventKindForStart(nextStart);
    const nextMult = formatMult(eventMultForStart(nextStart));
    const untilNext = msUntilNextEvent();
    const previewKind = live ? kind : nextKind;
    const multLabel = formatMult(live ? liveEventMult() : eventMultForStart(nextStart));
    const variantMult = variant ? formatMult(variant.mult) : "";
    const anyLive = live || !!variant || mutations.length > 0 || lbLive;

    if (eventBannerEl) {
      eventBannerEl.classList.toggle("event-idle", !anyLive);
      eventBannerEl.classList.toggle("is-live", anyLive);
      eventBannerEl.classList.toggle("event-money", live && previewKind === "money");
      eventBannerEl.classList.toggle("event-luck", live && previewKind === "luck");
      eventBannerEl.classList.toggle("event-variant", !!variant);
      eventBannerEl.classList.toggle("event-mutation", mutations.length > 0);
      eventBannerEl.classList.toggle("event-luckyblock", lbLive);
    }
    if (eventBannerTagEl) {
      eventBannerTagEl.textContent =
        variant || mutations.length || admin ? "ADMIN LIVE" : anyLive ? "LIVE NOW" : "Next event";
    }
    if (eventBannerTitleEl) {
      const parts = [];
      if (live && kind === "luck") {
        parts.push(`${multLabel}× Luck`);
      } else if (live && kind === "money") {
        parts.push(`${multLabel}× Sell`);
      }
      if (lbLive) parts.push(formatLuckyBlockEventLabel());
      if (variant) {
        parts.push(`${variantMult}× ${formatAdminVariantLabel(variant.target)}`);
      }
      formatLiveMutationBits().forEach((bit) => parts.push(bit));
      if (parts.length) {
        eventBannerTitleEl.textContent = `${parts.join(" + ")}${
          admin || variant || mutations.length ? " · Admin" : " Event"
        }`;
      } else {
        const untilLb = msUntilNextLuckyBlockEvent();
        const nextLbStart = nextHourStart();
        const nextLbMult = formatMult(luckyBlockEventMultForStart(nextLbStart));
        const sellLuckLine =
          nextKind === "luck"
            ? `Upcoming: ${nextMult}× Luck`
            : `Upcoming: ${nextMult}× Sell`;
        // Keep the countdown only in the time column so the title width stays stable.
        eventBannerTitleEl.textContent =
          untilLb <= untilNext
            ? `${sellLuckLine} · ${nextLbMult}× Lucky Blocks`
            : sellLuckLine;
      }
    }
    if (eventBannerTimeEl) {
      const times = [];
      if (live) times.push(eventMsLeft());
      if (lbLive) times.push(luckyBlockEventMsLeft());
      if (variant) times.push(Math.max(0, variant.until - Date.now()));
      mutations.forEach((m) => times.push(Math.max(0, m.until - Date.now())));
      if (times.length) {
        eventBannerTimeEl.textContent = `${formatBannerClock(Math.min(...times))} left`;
      } else {
        const untilLb = msUntilNextLuckyBlockEvent();
        const showMs = untilLb <= untilNext ? untilLb : untilNext;
        eventBannerTimeEl.textContent = `in ${formatBannerClock(showMs)}`;
      }
    }
  }

  function isTreasureItem(fish) {
    return (
      fish?.rarity === "treasure" ||
      fish?.kind === "luckyblock" ||
      fish?.id === "coin_chest" ||
      fish?.id === "luck_chest" ||
      fish?.id === "sunken_chest" ||
      String(fish?.id || "").startsWith("lucky_block_")
    );
  }

  function treasureByKind(kind) {
    return kind === "luck" ? TREASURE_LUCK : TREASURE_MONEY;
  }

  function luckyBlockCatchItem(type) {
    const def = luckyBlockDef(type);
    return {
      id: `lucky_block_${def.id}`,
      name: def.name,
      rarity: "treasure",
      kind: "luckyblock",
      blockType: def.id,
      value: 0,
      blurb: def.rangeLabel
    };
  }

  /**
   * Hourly / admin / collection Lucky Block drop.
   * All types: base 0.1% × event mult. Astral/Absolute split 50/50 after Zenith roll.
   * Luck gear never changes these; catch-book 90%/100% bonuses can.
   */
  function rollLuckyBlockDrop() {
    const zenithP = luckyBlockZenithEventChance();
    if (zenithP > 0 && Math.random() < zenithP) return "zenith";
    const p = luckyBlockEventChance();
    if (p <= 0) return null;
    if (Math.random() >= p) return null;
    return Math.random() < 0.5 ? "astral" : "absolute";
  }

  /** Combined chance to find any chest; then 50/50 Coin vs Luck. Luck + chest gear raise this. */
  function treasureAnyChance(spot, forBoat = false) {
    const t = Math.max(0, Math.min(MAX_SPOT_RARITY, Number(spot?.rarity) || 0)) / MAX_SPOT_RARITY;
    // Base: ~0.10% creek → ~0.28% omega
    const base = 0.001 + t * 0.0018;
    // Boat luck is 35% as strong; cast luck is full
    const luck = Math.max(0, effectiveLuckBonus(spot) * (forBoat ? 0.35 : 1));
    // Soft scale so upgrades clearly raise odds (guide updates live)
    // luck 8 → ×1.08 · luck 30 → ×1.30 · luck 100 → ×2.00 · hard cap ×4
    const luckMult = 1 + Math.min(3, luck * 0.01);
    const chestGear = 1 + chestFindBonus();
    let p = base * luckMult * chestGear;
    if (forBoat) p *= 0.35;
    const chestMult = eventChestMult();
    p *= chestMult;
    const cap = Math.min(0.55, 0.06 * Math.max(1, chestMult) * Math.min(3, chestGear));
    return Math.min(cap, p);
  }

  function treasureKindChance(spot, forBoat = false) {
    return treasureAnyChance(spot, forBoat) / 2;
  }

  function rollTreasure(spot, forBoat = false, chanceScale = 1) {
    const scale = Math.max(0, Number(chanceScale) || 0);
    if (Math.random() >= treasureAnyChance(spot, forBoat) * scale) return null;
    return Math.random() < 0.5 ? TREASURE_MONEY : TREASURE_LUCK;
  }

  /** Chest / event clocks: "12s", "4m 32s", "5h 46m", "2d 3h 12m", "1w 2d 4h 5m". */
  function formatTreasureClock(ms) {
    const totalSec = Math.max(0, Math.ceil(Math.max(0, Number(ms) || 0) / 1000));
    if (totalSec < 60) return `${totalSec}s`;
    const totalMin = Math.floor(totalSec / 60);
    if (totalMin < 60) {
      const s = totalSec % 60;
      return `${totalMin}m ${String(s).padStart(2, "0")}s`;
    }
    const weeks = Math.floor(totalMin / (60 * 24 * 7));
    const days = Math.floor((totalMin % (60 * 24 * 7)) / (60 * 24));
    const hours = Math.floor((totalMin % (60 * 24)) / 60);
    const mins = totalMin % 60;
    const bits = [];
    if (weeks > 0) bits.push(`${weeks}w`);
    if (weeks > 0 || days > 0) bits.push(`${days}d`);
    bits.push(`${hours}h`);
    bits.push(`${mins}m`);
    return bits.join(" ");
  }

  /** Fixed-width countdown for banners so digit changes don't shift layout. */
  function formatBannerClock(ms) {
    const totalSec = Math.max(0, Math.ceil(Math.max(0, Number(ms) || 0) / 1000));
    if (totalSec < 3600) {
      const m = Math.floor(totalSec / 60);
      const s = totalSec % 60;
      return `${String(m).padStart(2, "0")}m ${String(s).padStart(2, "0")}s`;
    }
    const hours = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    return `${String(hours).padStart(2, "0")}h ${String(m).padStart(2, "0")}m`;
  }

  /** Long reset timers for objectives: "2d 5h 12m", "5h 12m", or "12m". */
  function formatQuestResetClock(ms) {
    const totalMin = Math.max(0, Math.ceil(Math.max(0, Number(ms) || 0) / 60000));
    const days = Math.floor(totalMin / (60 * 24));
    const hours = Math.floor((totalMin % (60 * 24)) / 60);
    const mins = totalMin % 60;
    const bits = [];
    if (days > 0) bits.push(`${days}d`);
    if (days > 0 || hours > 0) bits.push(`${hours}h`);
    bits.push(`${mins}m`);
    return bits.join(" ");
  }

  function chestCountKey(kind) {
    return kind === "luck" ? "luckChestCount" : "moneyChestCount";
  }

  function chestStoredCount(kind) {
    const key = chestCountKey(kind);
    return Math.max(0, Math.floor(Number(state[key]) || 0));
  }

  function chestQtySelection(kind) {
    return kind === "luck" ? luckChestOpenQty : moneyChestOpenQty;
  }

  function chestQtyWanted(kind) {
    const n = chestStoredCount(kind);
    if (n <= 0) return 0;
    const sel = chestQtySelection(kind);
    if (sel === "all") return n;
    return Math.max(1, Math.min(n, Math.floor(Number(sel) || 1)));
  }

  function setChestOpenQty(kind, qty) {
    const next = qty === "all" ? "all" : Math.max(1, Math.floor(Number(qty) || 1));
    if (kind === "luck") luckChestOpenQty = next;
    else moneyChestOpenQty = next;
    renderTreasureStash();
  }

  function syncChestQtyButtons(el, kind, count) {
    if (!el) return;
    const selected = String(chestQtySelection(kind));
    el.querySelectorAll("[data-chest-qty]").forEach((btn) => {
      const key = btn.dataset.chestQty;
      const need = key === "all" ? 1 : Math.floor(Number(key) || 1);
      btn.disabled = count < need;
      btn.classList.toggle("is-active", selected === String(key));
    });
  }

  function chestUseLabel(kind, count, boosted) {
    const qty = chestQtyWanted(kind);
    if (count <= 0) return "Use";
    if (qty <= 1) return boosted ? "Extend" : "Use";
    return boosted ? `Extend ${qty}` : `Use ${qty}`;
  }

  function activateMoneyBoost(opts = {}) {
    const n = Math.max(1, Math.floor(Number(opts.count) || 1));
    const now = Date.now();
    const wasHeld = moneyMsLeft() > 0;
    if (state.moneyBoostPaused) {
      state.moneyBoostPausedLeft = moneyMsLeft() + TREASURE_BOOST_MS * n;
    } else {
      const current = Math.max(now, Number(state.moneyBoostUntil) || 0);
      state.moneyBoostUntil = current + TREASURE_BOOST_MS * n;
    }
    if (!opts.silent) {
      const added = formatTreasureClock(TREASURE_BOOST_MS * n);
      const left = formatTreasureClock(moneyMsLeft());
      const total = formatMult(treasureMoneyMult());
      const eventNote = eventMoneyActive()
        ? ` · event stacked → ${total}× sell (${formatTreasureClock(eventMsLeft())} left on event)`
        : "";
      let line;
      if (state.moneyBoostPaused) {
        line = n > 1
          ? `Opened ${n} Coin Chests · +${added} · ${left} paused · 2× sell off`
          : `Coin Chest · +5:00 · ${left} paused · 2× sell off`;
      } else if (n > 1) {
        line = `Opened ${n} Coin Chests · +${added} · ${total}× sell · ${left} left${eventNote}`;
      } else if (wasHeld) {
        line = `Coin Chest · +5:00 chest time · ${total}× sell · ${left} left`;
      } else {
        line = `Opened Coin Chest! ${TREASURE_MULT}× sell for 5:00${eventNote}`;
      }
      setCatchLine(line, "treasure");
      playSfx("win");
      burstConfetti();
    }
    renderStats();
    saveState();
  }

  function activateLuckBoost(opts = {}) {
    const n = Math.max(1, Math.floor(Number(opts.count) || 1));
    const now = Date.now();
    const wasHeld = luckMsLeft() > 0;
    if (state.luckBoostPaused) {
      state.luckBoostPausedLeft = luckMsLeft() + TREASURE_BOOST_MS * n;
    } else {
      const current = Math.max(now, Number(state.luckBoostUntil) || 0);
      state.luckBoostUntil = current + TREASURE_BOOST_MS * n;
    }
    if (!opts.silent) {
      const added = formatTreasureClock(TREASURE_BOOST_MS * n);
      const left = formatTreasureClock(luckMsLeft());
      const total = formatMult(treasureLuckMult());
      const eventNote = eventLuckActive()
        ? ` · event stacked → ${total}× luck (${formatTreasureClock(eventMsLeft())} left on event)`
        : "";
      let line;
      if (state.luckBoostPaused) {
        line = n > 1
          ? `Opened ${n} Luck Chests · +${added} · ${left} paused · 1.5× luck off`
          : `Luck Chest · +5:00 · ${left} paused · 1.5× luck off`;
      } else if (n > 1) {
        line = `Opened ${n} Luck Chests · +${added} · ${total}× luck · ${left} left${eventNote}`;
      } else if (wasHeld) {
        line = `Luck Chest · +5:00 chest time · ${total}× luck · ${left} left`;
      } else {
        line = `Opened Luck Chest! ${TREASURE_LUCK_MULT}× luck for 5:00${eventNote}`;
      }
      setCatchLine(line, "treasure");
      playSfx("win");
      burstConfetti();
    }
    renderStats();
    saveState();
  }

  function storeTreasure(chest, opts = {}) {
    const item = chest?.kind ? chest : TREASURE_MONEY;
    const key = chestCountKey(item.kind);
    const max = treasureStashMax();
    if (state[key] >= max) {
      if (!opts.silent) {
        setCatchLine(`${item.name} stash full (${max}) — use one first`, "miss");
        playSfx("miss");
      }
      return false;
    }
    state[key] += 1;
    if (!opts.silent) {
      const effect =
        item.kind === "luck"
          ? `${TREASURE_LUCK_MULT}× luck`
          : `${TREASURE_MULT}× sell`;
      setCatchLine(
        `${item.name} stored · ${state[key]} ready · tap Use for ${effect}`,
        "treasure"
      );
      playSfx("win");
      burstConfetti();
    }
    renderTreasureStash();
    saveSoon();
    return true;
  }

  function useTreasure(kind) {
    const item = treasureByKind(kind);
    const key = chestCountKey(item.kind);
    const have = chestStoredCount(item.kind);
    const n = chestQtyWanted(item.kind);
    if (have <= 0 || n <= 0) {
      setCatchLine(`No ${item.name}s stored`, "miss");
      playSfx("miss");
      return;
    }
    ensureSession();
    state[key] = have - n;
    noteQuestProgress("chest", n, {
      duringEvent: eventIsLive() || luckyBlockEventIsLive() || !!adminChestEventLive()
    });
    if (item.kind === "luck") activateLuckBoost({ count: n });
    else activateMoneyBoost({ count: n });
    renderTreasureStash();
    render(false);
    saveSoon();
  }

  function luckyBlockCount(type) {
    const def = luckyBlockDef(type);
    return Math.max(0, Math.floor(Number(state[def.stateKey]) || 0));
  }

  function storeLuckyBlock(type = "absolute", count = 1, opts = {}) {
    const def = luckyBlockDef(type);
    const n = Math.min(50, Math.max(1, Math.floor(Number(count) || 1)));
    let added = 0;
    for (let i = 0; i < n; i += 1) {
      if (luckyBlockCount(def.id) >= LUCKY_BLOCK_STASH_MAX) break;
      state[def.stateKey] = luckyBlockCount(def.id) + 1;
      added += 1;
    }
    if (!added) {
      if (!opts.silent) {
        setCatchLine(`${def.name} stash full (${LUCKY_BLOCK_STASH_MAX})`, "miss");
        playSfx("miss");
      }
      return 0;
    }
    if (!opts.silent) {
      const ready = luckyBlockCount(def.id);
      setCatchLine(
        added === 1
          ? `${def.name} stored · ${ready} ready`
          : `${added}× ${def.name} stored · ${ready} ready`,
        "treasure"
      );
      playSfx("win");
    }
    renderTreasureStash();
    saveSoon();
    return added;
  }

  /**
   * Lucky Block roll for a type's rarity band.
   * Uses fixed rarity weights (not gear/chest/admin luck) so boosts never help.
   * Higher rarities stay much rarer than lower ones in the pool.
   */
  function rollLuckyBlockFish(type = "absolute") {
    const rarities = luckyBlockRarities(type);
    const weights = rarities.map((rarity) => ({
      rarity,
      w: Math.max(1e-12, Number(RARITY_WEIGHT[rarity]) || 1e-12)
    }));
    const total = weights.reduce((s, x) => s + x.w, 0) || 1;
    let roll = Math.random() * total;
    let rarity = weights[0]?.rarity || luckyBlockDef(type).minRarity;
    for (const row of weights) {
      roll -= row.w;
      if (roll <= 0) {
        rarity = row.rarity;
        break;
      }
    }
    const pool = FISH.filter((f) => f.rarity === rarity);
    if (!pool.length) {
      return (
        FISH.find((f) => f.rarity === luckyBlockDef(type).minRarity) || FISH[FISH.length - 1]
      );
    }
    return pool[Math.floor(Math.random() * pool.length)];
  }

  function luckyBlockPool(type = activeLuckyBlockType) {
    const rarities = luckyBlockRarities(type);
    return FISH.filter((f) => rarities.includes(f.rarity));
  }

  function luckyBlockOddsRows(type = activeLuckyBlockType) {
    const rows = luckyBlockRarities(type).map((rarity) => ({
      rarity,
      w: Math.max(1e-12, Number(RARITY_WEIGHT[rarity]) || 1e-12),
      fish: FISH.filter((f) => f.rarity === rarity)
    }));
    const total = rows.reduce((s, r) => s + r.w, 0) || 1;
    return rows.map((r) => ({
      ...r,
      pct: (100 * r.w) / total,
      fishPct: r.fish.length ? (100 * r.w) / total / r.fish.length : 0
    }));
  }

  function lbReelItemHtml(fish) {
    const color = rarityColor(fish.rarity);
    return `<div class="lb-reel-item rarity-${fish.rarity}">
      <span aria-hidden="true">${fishGlyphHtml(fish)}</span>
      <span class="lb-reel-meta">
        <span class="lb-reel-name">${fish.name}</span>
        <span class="lb-reel-rarity" style="color:${color}">${fish.rarity}</span>
      </span>
    </div>`;
  }

  function buildLuckyBlockReelStrip(winner, type = activeLuckyBlockType) {
    const pool = luckyBlockPool(type);
    const fallback = pool[0] || winner;
    const items = [];
    for (let i = 0; i < LB_REEL_LEN; i += 1) {
      items.push(pool[Math.floor(Math.random() * pool.length)] || fallback);
    }
    const winAt = Math.max(8, LB_REEL_LEN - 5);
    items[winAt] = winner;
    return { items, winAt };
  }

  function luckyBlockQtyWanted() {
    const n = luckyBlockCount(activeLuckyBlockType);
    if (n <= 0) return 0;
    if (luckyBlockOpenQty === "all") return n;
    return Math.max(1, Math.min(n, Math.floor(Number(luckyBlockOpenQty) || 1)));
  }

  function updateLuckyBlockGuiStatus() {
    const def = luckyBlockDef(activeLuckyBlockType);
    const n = luckyBlockCount(activeLuckyBlockType);
    const qty = luckyBlockQtyWanted();
    if (luckyBlockTitleEl) luckyBlockTitleEl.textContent = def.name;
    if (luckyBlockEyebrowEl) {
      luckyBlockEyebrowEl.textContent = `Admin item · ${def.rangeLabel} · luck ignored`;
    }
    if (luckyBlockCardEl) luckyBlockCardEl.dataset.theme = def.theme;
    if (luckyBlockStatusEl) {
      luckyBlockStatusEl.textContent =
        n <= 0
          ? `No ${def.name}s stored`
          : n === 1
            ? `1 ${def.name} ready · ${def.rangeLabel}`
            : `${n} ${def.name}s ready · ${def.rangeLabel}`;
    }
    luckyBlockQtyEl?.querySelectorAll("[data-lb-qty]").forEach((btn) => {
      const key = btn.dataset.lbQty;
      const need = key === "all" ? 1 : Math.floor(Number(key) || 1);
      btn.disabled = luckyBlockSpinning || n < need;
      btn.classList.toggle("is-active", String(luckyBlockOpenQty) === String(key));
    });
    if (luckyBlockSpinBtn) {
      luckyBlockSpinBtn.disabled = luckyBlockSpinning || n <= 0;
      luckyBlockSpinBtn.textContent = luckyBlockSpinning
        ? "Opening…"
        : n <= 0
          ? "None left"
          : qty <= 1
            ? "Open"
            : `Open ${qty}`;
    }
    if (luckyBlockSkipBtn) {
      luckyBlockSkipBtn.disabled = luckyBlockSpinning ? false : n <= 0;
      luckyBlockSkipBtn.classList.toggle("is-on", luckyBlockSkipAnim);
      luckyBlockSkipBtn.setAttribute("aria-pressed", luckyBlockSkipAnim ? "true" : "false");
      luckyBlockSkipBtn.textContent = luckyBlockSpinning
        ? "Skip"
        : luckyBlockSkipAnim
          ? "Skip on"
          : "Skip anim";
    }
    if (luckyBlockCloseBtn) luckyBlockCloseBtn.disabled = luckyBlockSpinning;
    if (luckyBlockDismissBtn) luckyBlockDismissBtn.disabled = luckyBlockSpinning;
    if (luckyBlockChancesBtn) {
      luckyBlockChancesBtn.disabled = luckyBlockSpinning;
      luckyBlockChancesBtn.textContent = luckyBlockChancesOpen ? "Hide chances" : "Chances";
    }
  }

  function renderLuckyBlockChances() {
    if (!luckyBlockChancesEl) return;
    const rows = luckyBlockOddsRows(activeLuckyBlockType);
    luckyBlockChancesEl.innerHTML = `<p class="lb-chances-note">Rarity odds use the same weights as normal fishing (no luck boost). Within a rarity, each fish is equally likely.</p>${rows
      .map((row) => {
        const color = rarityColor(row.rarity);
        const fishList = row.fish
          .map(
            (f) =>
              `<li title="${formatChance(row.fishPct)}">${f.name} · ${formatChance(row.fishPct)}</li>`
          )
          .join("");
        return `<div class="lb-chance-row">
          <span class="lb-chance-rarity" style="color:${color}">${row.rarity}</span>
          <span class="lb-chance-pct" title="${row.pct.toFixed(8)}%">${formatChance(row.pct)}</span>
          <ul class="lb-chance-fish">${fishList}</ul>
        </div>`;
      })
      .join("")}`;
  }

  function setLuckyBlockChancesVisible(on) {
    luckyBlockChancesOpen = !!on;
    if (luckyBlockChancesEl) {
      luckyBlockChancesEl.classList.toggle("hidden", !luckyBlockChancesOpen);
      luckyBlockChancesEl.hidden = !luckyBlockChancesOpen;
      if (luckyBlockChancesOpen) renderLuckyBlockChances();
    }
    updateLuckyBlockGuiStatus();
  }

  function resetLuckyBlockReelPreview() {
    if (!luckyBlockReelEl) return;
    const pool = luckyBlockPool(activeLuckyBlockType);
    const preview = [];
    for (let i = 0; i < LB_REEL_VISIBLE + 2; i += 1) {
      preview.push(pool[Math.floor(Math.random() * pool.length)] || pool[0]);
    }
    luckyBlockReelEl.classList.remove("is-spinning");
    luckyBlockReelEl.style.transition = "none";
    luckyBlockReelEl.style.transform = `translate3d(0, ${-LB_REEL_ITEM_H}px, 0)`;
    luckyBlockReelEl.innerHTML = preview.map(lbReelItemHtml).join("");
  }

  function clearLuckyBlockResult() {
    if (!luckyBlockResultEl) return;
    luckyBlockResultEl.classList.add("hidden");
    luckyBlockResultEl.innerHTML = "";
  }

  function pickLuckyBlockBest(rows) {
    return (rows || []).reduce((best, row) => {
      if (!row?.fish) return best;
      if (!best?.fish) return row;
      const d = rarityOrder(row.fish.rarity) - rarityOrder(best.fish.rarity);
      if (d > 0) return row;
      if (d < 0) return best;
      return (row.val || 0) >= (best.val || 0) ? row : best;
    }, null);
  }

  function showLuckyBlockResult(fish, val) {
    showLuckyBlockHaul([{ fish, val }]);
  }

  function showLuckyBlockHaul(rows) {
    if (!luckyBlockResultEl) return;
    const list = (Array.isArray(rows) ? rows : [rows]).filter((r) => r?.fish);
    if (!list.length) {
      clearLuckyBlockResult();
      return;
    }
    const best = pickLuckyBlockBest(list);
    const color = rarityColor(best.fish.rarity);
    const total = list.reduce((s, r) => s + (Number(r.val) || 0), 0);
    luckyBlockResultEl.classList.remove("hidden");
    if (list.length === 1) {
      luckyBlockResultEl.innerHTML = `<span aria-hidden="true">${fishGlyphHtml(best.fish)}</span>
      <div>
        <p class="lb-result-title">You got</p>
        <p class="lb-result-name" style="color:${color}">${best.fish.name}</p>
        <p class="lb-result-meta">${best.fish.rarity} · ${formatNum(best.val)} coins · added to cooler</p>
      </div>`;
      return;
    }
    const sorted = [...list].sort(
      (a, b) =>
        rarityOrder(b.fish.rarity) - rarityOrder(a.fish.rarity) || (b.val || 0) - (a.val || 0)
    );
    const haul = sorted
      .map((row) => {
        const c = rarityColor(row.fish.rarity);
        return `<li><span class="lb-haul-name" style="color:${c}">${row.fish.name}</span><span class="lb-haul-val">${row.fish.rarity} · ${formatNum(row.val)}</span></li>`;
      })
      .join("");
    luckyBlockResultEl.innerHTML = `<span aria-hidden="true">${fishGlyphHtml(best.fish)}</span>
      <div>
        <p class="lb-result-title">Opened ${list.length}</p>
        <p class="lb-result-name" style="color:${color}">Best: ${best.fish.name}</p>
        <p class="lb-result-meta">${formatNum(total)} coins · added to cooler</p>
        <ul class="lb-haul">${haul}</ul>
      </div>`;
  }

  function openLuckyBlockGui(type = "absolute") {
    activeLuckyBlockType = resolveLuckyBlockType(type) || "absolute";
    const def = luckyBlockDef(activeLuckyBlockType);
    const count = luckyBlockCount(activeLuckyBlockType);
    if (count <= 0 && !isFishingOwner()) {
      setCatchLine(`No ${def.name}s stored`, "miss");
      playSfx("miss");
      return;
    }
    clearTimeout(luckyBlockSpinTimer);
    luckyBlockSpinning = false;
    luckyBlockPendingFish = null;
    luckyBlockPendingOffset = 0;
    setLuckyBlockChancesVisible(false);
    clearLuckyBlockResult();
    resetLuckyBlockReelPreview();
    updateLuckyBlockGuiStatus();
    luckyBlockOverlay?.classList.remove("hidden");
    lockPageScroll();
  }

  function closeLuckyBlockGui() {
    if (luckyBlockSpinning) return;
    clearTimeout(luckyBlockSpinTimer);
    luckyBlockOverlay?.classList.add("hidden");
    setLuckyBlockChancesVisible(false);
    unlockPageScroll();
  }

  function grantLuckyBlockRoll(fish) {
    const entry = grantFishToLocal(fish, { variants: { variant: "", shiny: false } });
    const val = fishValue(fish, currentSpot(), entry || { variant: "", shiny: false });
    return { fish, val, entry: entry || { variant: "", shiny: false } };
  }

  function presentLuckyBlockHaul(rows) {
    const list = (Array.isArray(rows) ? rows : [rows]).filter((r) => r?.fish);
    if (!list.length) return;
    const best = pickLuckyBlockBest(list);
    const def = luckyBlockDef(activeLuckyBlockType);
    castBtn?.classList.remove("is-waiting", "is-bite");
    castBtn?.classList.add("is-catch", `rarity-${best.fish.rarity}`);
    showCatchSilhouette?.(best.fish);
    showCatchCard?.(list.map((row) => ({ fish: row.fish, val: row.val, perfect: false, treasure: false, stored: true })));
    if (list.length === 1) {
      setCatchLine(
        `${def.name} → ${formatFishName(best.fish, { variant: "", shiny: false })} (${best.fish.rarity})`,
        catchTone(best.fish.rarity)
      );
    } else {
      setCatchLine(
        `Opened ${list.length} ${def.name}s · best ${formatFishName(best.fish, { variant: "", shiny: false })} (${best.fish.rarity})`,
        catchTone(best.fish.rarity)
      );
    }
    playSfx("win");
    if (list.some((row) => isShowcaseRarity(row.fish.rarity))) burstConfetti();
    showLuckyBlockHaul(list);
  }

  function finishLuckyBlockSpin(fish) {
    if (!luckyBlockSpinning || !fish) return;
    luckyBlockSpinning = false;
    luckyBlockPendingFish = null;
    luckyBlockPendingOffset = 0;
    presentLuckyBlockHaul([grantLuckyBlockRoll(fish)]);
    updateLuckyBlockGuiStatus();
    renderTreasureStash();
    render(true);
    saveSoon();
  }

  function skipLuckyBlockSpin() {
    if (!luckyBlockSpinning || !luckyBlockPendingFish) return;
    clearTimeout(luckyBlockSpinTimer);
    if (luckyBlockReelEl) {
      luckyBlockReelEl.classList.remove("is-spinning");
      luckyBlockReelEl.style.transition = "none";
      luckyBlockReelEl.style.transform = `translate3d(0, ${-luckyBlockPendingOffset}px, 0)`;
    }
    finishLuckyBlockSpin(luckyBlockPendingFish);
  }

  function toggleLuckyBlockSkipAnim() {
    luckyBlockSkipAnim = !luckyBlockSkipAnim;
    updateLuckyBlockGuiStatus();
    playSfx("click");
  }

  function setLuckyBlockOpenQty(qty) {
    if (qty === "all") luckyBlockOpenQty = "all";
    else luckyBlockOpenQty = Math.max(1, Math.floor(Number(qty) || 1));
    updateLuckyBlockGuiStatus();
  }

  function openLuckyBlocksInstant(qty) {
    const def = luckyBlockDef(activeLuckyBlockType);
    const count = luckyBlockCount(activeLuckyBlockType);
    const n = Math.max(1, Math.min(count, Math.floor(Number(qty) || 1), LUCKY_BLOCK_STASH_MAX));
    if (count <= 0) {
      setCatchLine(`No ${def.name}s stored`, "miss");
      playSfx("miss");
      updateLuckyBlockGuiStatus();
      return;
    }
    ensureSession();
    state[def.stateKey] = count - n;
    const rows = [];
    for (let i = 0; i < n; i += 1) {
      rows.push(grantLuckyBlockRoll(rollLuckyBlockFish(activeLuckyBlockType)));
    }
    clearLuckyBlockResult();
    setLuckyBlockChancesVisible(false);
    resetLuckyBlockReelPreview();
    playSfx("click");
    presentLuckyBlockHaul(rows);
    updateLuckyBlockGuiStatus();
    renderTreasureStash();
    render(true);
    saveSoon();
  }

  function spinLuckyBlock() {
    if (luckyBlockSpinning) return;
    const def = luckyBlockDef(activeLuckyBlockType);
    const count = luckyBlockCount(activeLuckyBlockType);
    const qty = luckyBlockQtyWanted();
    if (count <= 0 || qty <= 0) {
      setCatchLine(`No ${def.name}s stored`, "miss");
      playSfx("miss");
      updateLuckyBlockGuiStatus();
      return;
    }
    if (qty > 1 || luckyBlockSkipAnim) {
      openLuckyBlocksInstant(qty);
      return;
    }
    ensureSession();
    state[def.stateKey] = count - 1;
    renderTreasureStash();
    saveSoon();

    const fish = rollLuckyBlockFish(activeLuckyBlockType);
    const { items, winAt } = buildLuckyBlockReelStrip(fish, activeLuckyBlockType);
    clearLuckyBlockResult();
    setLuckyBlockChancesVisible(false);
    luckyBlockSpinning = true;
    luckyBlockPendingFish = fish;
    luckyBlockPendingOffset = winAt * LB_REEL_ITEM_H - LB_REEL_ITEM_H;
    updateLuckyBlockGuiStatus();
    playSfx("click");

    if (!luckyBlockReelEl) {
      finishLuckyBlockSpin(fish);
      return;
    }

    luckyBlockReelEl.classList.remove("is-spinning");
    luckyBlockReelEl.style.transition = "none";
    luckyBlockReelEl.style.transform = "translate3d(0, 0, 0)";
    luckyBlockReelEl.innerHTML = items.map(lbReelItemHtml).join("");
    const offsetY = luckyBlockPendingOffset;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (!luckyBlockSpinning || luckyBlockPendingFish !== fish) return;
        luckyBlockReelEl.classList.add("is-spinning");
        luckyBlockReelEl.style.transition = "";
        luckyBlockReelEl.style.transform = `translate3d(0, ${-offsetY}px, 0)`;
      });
    });

    clearTimeout(luckyBlockSpinTimer);
    luckyBlockSpinTimer = setTimeout(() => {
      if (!luckyBlockSpinning || luckyBlockPendingFish !== fish) return;
      luckyBlockReelEl.classList.remove("is-spinning");
      finishLuckyBlockSpin(fish);
    }, LB_SPIN_MS + 80);
  }

  function openLuckyBlock(type = "absolute") {
    openLuckyBlockGui(type);
  }

  function treasureUseLabel(chest) {
    if (chest?.kind === "luckyblock") {
      const def = luckyBlockDef(chest.blockType || "absolute");
      return `stored · ${def.rangeLabel} · luck ignored`;
    }
    if (chest.kind === "luck") {
      return `stored · Use for ${TREASURE_LUCK_MULT}× luck · 5:00`;
    }
    return `stored · Use for ${TREASURE_MULT}× sell · 5:00`;
  }

  function perfectBonus() {
    return ownedGear("perfect").reduce((s, g) => s + g.amount, 0);
  }

  function multiCatchChance() {
    return Math.min(
      0.9995,
      ownedGear("multi").reduce((s, g) => s + g.amount, 0) + comboMultiBonus()
    );
  }

  function tripleCatchChance() {
    return Math.min(0.99, ownedGear("triple").reduce((s, g) => s + g.amount, 0));
  }

  function quadCatchChance() {
    return Math.min(0.99, ownedGear("quad").reduce((s, g) => s + (Number(g.amount) || 0), 0));
  }

  function pentaCatchChance() {
    return Math.min(0.99, ownedGear("penta").reduce((s, g) => s + (Number(g.amount) || 0), 0));
  }

  /** Relative boost to shiny + primary variant odds (stacks, soft-capped). */
  function looksBonus() {
    return Math.min(120, ownedGear("looks").reduce((s, g) => s + (Number(g.amount) || 0), 0));
  }

  /** Relative boost to chest find odds (stacks, soft-capped). */
  function chestFindBonus() {
    return Math.min(150, ownedGear("chest").reduce((s, g) => s + (Number(g.amount) || 0), 0));
  }

  function boats() {
    const boat = getBoat();
    return boat ? [boat] : [];
  }

  function boatLevel() {
    return Math.max(0, Math.min(BOAT_MAX_LEVEL, Math.floor(Number(state.boatLevel) || 0)));
  }

  function getBoat() {
    const level = boatLevel();
    if (level < 1) return null;
    const tier = BOAT_TIERS[level];
    return {
      id: "boat",
      name: tier.name,
      amount: tier.interval,
      level
    };
  }

  function nextBoatTier() {
    const next = boatLevel() + 1;
    if (next > BOAT_MAX_LEVEL) return null;
    return { level: next, ...BOAT_TIERS[next] };
  }

  function migrateLegacyBoats(ownedMap) {
    let best = 0;
    for (let i = 1; i <= 7; i += 1) {
      if (ownedMap?.[`boat${i}`]) best = i;
    }
    // Old fleet had 7 boats; map into the new 4-tier upgrade path
    if (best >= 7) return 4;
    if (best >= 5) return 4;
    if (best >= 4) return 4;
    if (best >= 3) return 3;
    if (best >= 2) return 2;
    if (best >= 1) return 1;
    return 0;
  }

  function rollBoatCatchCount(level) {
    const tier = BOAT_TIERS[level];
    const table = tier?.multi;
    if (!table?.length) return 1;
    let r = Math.random();
    for (const [chance, count] of table) {
      if (r < chance) return count;
      r -= chance;
    }
    return 1;
  }

  function loadState() {
    try {
      const raw = JSON.parse(localStorage.getItem(SAVE_KEY) || "null");
      if (!raw || typeof raw !== "object") return defaultState();
      const next = defaultState();
      next.coins = Math.max(0, Number(raw.coins) || 0);
      next.lifetime = Math.max(0, Number(raw.lifetime) || 0);
      next.spotId = SPOTS.some((s) => s.id === raw.spotId) ? raw.spotId : "creek";
      next.autoSellRarities = defaultAutoSell();
      if (raw.autoSellRarities && typeof raw.autoSellRarities === "object") {
        RARITIES.forEach((r) => {
          next.autoSellRarities[r] = !!raw.autoSellRarities[r];
        });
      } else if (raw.autoSell) {
        // Migrate old all-or-nothing toggle
        RARITIES.forEach((r) => {
          next.autoSellRarities[r] = true;
        });
      }
      next.autoSellMutations = !!raw.autoSellMutations;
      next.catches = Math.max(0, Math.floor(Number(raw.catches) || 0));
      next.perfects = Math.max(0, Math.floor(Number(raw.perfects) || 0));
      next.bestCatchScore = Math.max(0, Math.floor(Number(raw.bestCatchScore) || 0));
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
      try {
        const meta = JSON.parse(localStorage.getItem(BEST_CATCH_META_KEY) || "null");
        if (meta && typeof meta === "object") {
          if (!next.bestCatchId && typeof meta.id === "string" && fishById(meta.id)) {
            next.bestCatchId = meta.id;
          }
          if (meta.id && meta.id === next.bestCatchId) {
            next.bestCatchVariant = normalizeVariant(meta.variant) || next.bestCatchVariant;
            next.bestCatchShiny = !!(meta.shiny || next.bestCatchShiny);
            next.bestCatchMutation =
              normalizeMutation(meta.mutation) || next.bestCatchMutation;
          }
        }
      } catch {}
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
        next.caught[next.bestCatchId] = normalizeCaughtRecord(
          next.caught[next.bestCatchId] || true
        );
      }
      next.lastTick = Math.max(0, Number(raw.lastTick) || Date.now());
      SPOTS.forEach((s) => {
        next.unlocked[s.id] = s.id === "creek" || !!raw.unlocked?.[s.id];
      });
      GEAR.forEach((g) => {
        next.owned[g.id] = !!raw.owned?.[g.id];
      });
      next.equippedSpeed = resolveEquippedSpeed(next.owned, raw.equippedSpeed);
      const savedBoat = Math.floor(Number(raw.boatLevel) || 0);
      const legacyBoat = migrateLegacyBoats(raw.owned);
      next.boatLevel = Math.max(0, Math.min(BOAT_MAX_LEVEL, Math.max(savedBoat, legacyBoat)));
      const savedAqua = Math.floor(Number(raw.aquariumLevel) || 0);
      const legacyAqua = migrateLegacyAquarium(raw.owned);
      next.aquariumLevel = Math.max(
        0,
        Math.min(AQUARIUM_MAX_LEVEL, Math.max(savedAqua, legacyAqua))
      );
      next.cooler = Array.isArray(raw.cooler)
        ? raw.cooler
            .map(normalizeCoolerEntry)
            .filter(Boolean)
            .slice(0, coolerMaxFromOwned(next.owned))
        : [];
      next.cooler.forEach((entry) => {
        const id = coolerEntryId(entry);
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
      const now = Date.now();
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
        Math.min(
          TREASURE_STASH_HARD_MAX,
          Math.floor(Number(raw.moneyChestCount) || legacyCount || 0)
        )
      );
      next.luckChestCount = Math.max(
        0,
        Math.min(TREASURE_STASH_HARD_MAX, Math.floor(Number(raw.luckChestCount) || 0))
      );
      next.luckyBlockCount = Math.max(
        0,
        Math.min(LUCKY_BLOCK_STASH_MAX, Math.floor(Number(raw.luckyBlockCount) || 0))
      );
      next.astralLuckyBlockCount = Math.max(
        0,
        Math.min(LUCKY_BLOCK_STASH_MAX, Math.floor(Number(raw.astralLuckyBlockCount) || 0))
      );
      next.zenithLuckyBlockCount = Math.max(
        0,
        Math.min(LUCKY_BLOCK_STASH_MAX, Math.floor(Number(raw.zenithLuckyBlockCount) || 0))
      );
      next.smartShop = raw.smartShop !== false;
      next.collectionLuckTold = !!raw.collectionLuckTold;
      next.collectionRainbowTold = !!raw.collectionRainbowTold;
      next.collectionLbEventTold = !!raw.collectionLbEventTold;
      next.collectionLbAlwaysTold = !!raw.collectionLbAlwaysTold;
      next.quests = normalizeQuestsState(raw.quests);
      if (raw.echoLuckReset !== ECHO_LUCK_RESET_ID) {
        next.echoLuckLevel = 0;
        next.echoLuckReset = ECHO_LUCK_RESET_ID;
      } else {
        next.echoLuckLevel = Math.max(
          0,
          Math.min(ECHO_LUCK_MAX_LEVEL, Math.floor(Number(raw.echoLuckLevel) || 0))
        );
        next.echoLuckReset = ECHO_LUCK_RESET_ID;
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
      next.combo = Math.max(0, Math.min(99, Math.floor(Number(raw.combo) || 0)));
      next.comboBoostUntil = Math.max(0, Number(raw.comboBoostUntil) || 0);
      next.aquariumBank = Math.max(0, Number(raw.aquariumBank) || 0);
      next.aquariumLastTick = Math.max(0, Number(raw.aquariumLastTick) || Date.now());
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
      return next;
    } catch {
      return defaultState();
    }
  }

  function coolerMaxFromOwned(owned) {
    return (
      COOLER_BASE +
      GEAR.filter((g) => g.kind === "cooler" && owned[g.id]).reduce((s, g) => s + g.amount, 0)
    );
  }

  const VARIANT_PRIMARY = ["silver", "gold", "diamond", "rainbow"];
  const VARIANT_MULT = {
    silver: 1.5,
    gold: 2,
    diamond: 2.5,
    rainbow: 3
  };
  const SHINY_MULT = 3;
  /** Mutations stack with primary variants + shiny. Admin-gated for now. */
  const MUTATIONS = ["toxic", "lava", "neon"];
  const MUTATION_MULT = {
    toxic: 4,
    lava: 5,
    neon: 6
  };

  function normalizeMutation(raw) {
    const m = String(raw || "").toLowerCase();
    return MUTATIONS.includes(m) ? m : "";
  }

  function normalizeVariant(raw) {
    const v = String(raw || "").toLowerCase();
    return VARIANT_PRIMARY.includes(v) ? v : "";
  }

  function normalizeVariants(raw) {
    if (!raw || typeof raw !== "object") return { variant: "", shiny: false, mutation: "" };
    return {
      variant: normalizeVariant(raw.variant),
      shiny: !!raw.shiny,
      mutation: normalizeMutation(raw.mutation)
    };
  }

  /** Primary shares; admin variant events bias toward one tag. */
  function primaryVariantShares() {
    const shares = { silver: 0.5, gold: 0.28, diamond: 0.15, rainbow: 0.07 };
    const spec = variantEventSpec();
    const mult = variantEventMult();
    if (mult > 1 && VARIANT_PRIMARY.includes(spec.primary)) {
      shares[spec.primary] *= mult;
      const sum = VARIANT_PRIMARY.reduce((s, k) => s + shares[k], 0) || 1;
      VARIANT_PRIMARY.forEach((k) => {
        shares[k] /= sum;
      });
    }
    const rainbowMult = collectionRainbowMult();
    if (rainbowMult > 1) {
      shares.rainbow *= rainbowMult;
      const sum = VARIANT_PRIMARY.reduce((s, k) => s + shares[k], 0) || 1;
      VARIANT_PRIMARY.forEach((k) => {
        shares[k] /= sum;
      });
    }
    return shares;
  }

  /** Primary (silver/gold/diamond/rainbow) is exclusive; shiny can stack as a second tag. */
  function variantRollChances(spot = currentSpot(), forBoat = false) {
    const luck = effectiveLuckBonus(spot);
    const look = 1 + looksBonus();
    const lookCap = Math.min(0.28, looksBonus() * 0.006);
    // Rarer rolls: low base chance, slow luck scale, hard caps (looks gear lifts both)
    let primary = Math.min(
      0.1 + lookCap,
      ((forBoat ? 0.008 : 0.014) + luck * 0.000035) * look
    );
    let shiny = Math.min(
      0.04 + lookCap * 0.55,
      ((forBoat ? 0.0035 : 0.0065) + luck * 0.00002) * look
    );
    const mult = variantEventMult();
    const spec = variantEventSpec();
    if (mult > 1 && (spec.primary || spec.shiny)) {
      if (spec.shiny) {
        shiny = Math.min(0.9, shiny * mult);
      }
      if (spec.primary === "any") {
        primary = Math.min(0.85, primary * mult);
      } else if (VARIANT_PRIMARY.includes(spec.primary)) {
        // More primaries overall, then biased toward the featured tag
        primary = Math.min(0.85, primary * Math.min(mult, 25));
      }
    }
    const shares = primaryVariantShares();
    return {
      primary,
      shiny,
      silver: primary * shares.silver,
      gold: primary * shares.gold,
      diamond: primary * shares.diamond,
      rainbow: primary * shares.rainbow
    };
  }

  function rollFishVariants(spot = currentSpot(), forBoat = false) {
    const chances = variantRollChances(spot, forBoat);
    let variant = "";
    if (Math.random() < chances.primary) {
      const shares = primaryVariantShares();
      let r = Math.random();
      for (let i = 0; i < VARIANT_PRIMARY.length; i += 1) {
        const key = VARIANT_PRIMARY[i];
        r -= shares[key];
        if (r <= 0) {
          variant = key;
          break;
        }
      }
      if (!variant) variant = VARIANT_PRIMARY[VARIANT_PRIMARY.length - 1];
    }
    let mutation = "";
    const liveMutations = adminMutationEventsLive();
    // Each live mutation type rolls independently; if several hit, keep the highest-value one.
    if (liveMutations.length) {
      const hits = [];
      liveMutations.forEach((e) => {
        const mult = clampAdminMult(e.mult);
        if (mult < 1) return;
        const chance = Math.min(0.95, 0.12 * mult);
        if (Math.random() < chance) hits.push(normalizeMutation(e.target));
      });
      if (hits.length === 1) mutation = hits[0];
      else if (hits.length > 1) {
        hits.sort((a, b) => (MUTATION_MULT[b] || 0) - (MUTATION_MULT[a] || 0));
        mutation = hits[0];
      }
    }
    return { variant, shiny: Math.random() < chances.shiny, mutation };
  }

  function variantValueMult(variantOrEntry, shinyFlag) {
    let variant = "";
    let shiny = false;
    let mutation = "";
    if (variantOrEntry && typeof variantOrEntry === "object") {
      variant = normalizeVariant(variantOrEntry.variant);
      shiny = !!variantOrEntry.shiny;
      mutation = normalizeMutation(variantOrEntry.mutation);
    } else {
      variant = normalizeVariant(variantOrEntry);
      shiny = !!shinyFlag;
    }
    return (
      (VARIANT_MULT[variant] || 1) *
      (shiny ? SHINY_MULT : 1) *
      (MUTATION_MULT[mutation] || 1)
    );
  }

  /** Catch book display value: base coins × active look (variant / shiny / mutation). */
  function bookLookValue(fish, entry) {
    if (isExclusiveFish(fish)) {
      // Prefer lockedValue only — never recompute mirror on every paint (lag).
      return Math.max(1, Math.floor(Number(entry?.lockedValue) || 2));
    }
    const base = Math.max(0, Number(fish?.value) || 0);
    const mult = entry ? variantValueMult(entry) : 1;
    return Math.max(1, Math.floor(base * mult));
  }

  function formatVariantTitle(entry) {
    const bits = [];
    const v = normalizeVariant(entry?.variant);
    if (v) bits.push(v.charAt(0).toUpperCase() + v.slice(1));
    if (entry?.shiny) bits.push("Shiny");
    const m = normalizeMutation(entry?.mutation);
    if (m) bits.push(m.charAt(0).toUpperCase() + m.slice(1));
    return bits.join(" ");
  }

  function formatFishName(fish, entry) {
    const title = formatVariantTitle(entry);
    const name = fish?.name || "Fish";
    return title ? `${title} ${name}` : name;
  }

  function variantClassList(entry) {
    const classes = [];
    const v = normalizeVariant(entry?.variant);
    if (v) classes.push(`variant-${v}`);
    if (entry?.shiny) classes.push("variant-shiny");
    const m = normalizeMutation(entry?.mutation);
    if (m) classes.push(`mutation-${m}`);
    return classes.join(" ");
  }

  function normalizeCoolerEntry(entry) {
    if (typeof entry === "string") {
      const id = String(entry);
      const fish = fishById(id);
      if (!fish) return null;
      const exclusive = isExclusiveFish(fish);
      return {
        id,
        saved: exclusive,
        perfect: false,
        variant: "",
        shiny: false,
        mutation: "",
        unsellable: exclusive,
        untradeable: exclusive,
        // Don't recompute mirror value here — that lagged every render.
        lockedValue: exclusive ? 0 : undefined
      };
    }
    if (entry && typeof entry === "object") {
      const id = String(entry.id || "");
      const fish = fishById(id);
      if (!fish) return null;
      const variants = normalizeVariants(entry);
      const exclusive = isExclusiveFish(fish);
      const locked = Math.max(0, Math.floor(Number(entry.lockedValue) || 0));
      return {
        id,
        saved: exclusive ? true : !!entry.saved,
        perfect: !!entry.perfect,
        variant: exclusive ? "" : variants.variant,
        shiny: exclusive ? false : variants.shiny,
        mutation: exclusive ? "" : variants.mutation,
        unsellable: exclusive || !!entry.unsellable,
        untradeable: exclusive || !!entry.untradeable,
        lockedValue: exclusive ? locked : locked || undefined
      };
    }
    return null;
  }

  /** Ensure exclusive cooler rows lock 2× your best non-exclusive look value. */
  function ensureExclusiveCoolerValues() {
    let changed = false;
    const mirror = exclusiveMirrorBaseValue();
    state.cooler = (state.cooler || []).map((raw) => {
      const entry = normalizeCoolerEntry(raw);
      if (!entry) return raw;
      const fish = fishById(entry.id);
      if (!isExclusiveFish(fish)) return entry;
      const next = {
        ...entry,
        saved: true,
        unsellable: true,
        untradeable: true,
        variant: "",
        shiny: false,
        mutation: "",
        lockedValue: mirror
      };
      if (
        !raw ||
        typeof raw !== "object" ||
        raw.saved !== next.saved ||
        Number(raw.lockedValue) !== Number(next.lockedValue) ||
        raw.unsellable !== next.unsellable
      ) {
        changed = true;
      }
      return next;
    });
    return changed;
  }

  function coolerEntryId(entry) {
    return entry?.id || "";
  }

  function isCoolerSaved(entry) {
    return !!entry?.saved;
  }

  function isCoolerPerfect(entry) {
    return !!entry?.perfect;
  }

  function unsavedCoolerCount() {
    return state.cooler.filter((e) => !isCoolerSaved(e)).length;
  }

  function saveState() {
    try {
      snapshotChestBoosts();
      state.lastTick = Date.now();
      localStorage.setItem(SAVE_KEY, JSON.stringify(state));
      persistChestBoostBackup();
      const best = Math.max(getStoredBest(), Math.floor(state.bestCatchScore || 0));
      localStorage.setItem(HIGH_SCORE_KEY, String(best));
      const fish = fishById(state.bestCatchId);
      if (fish) persistBestCatchMeta(fish, bestCatchEntry());
    } catch {}
  }

  function getStoredBest() {
    return Math.max(0, Math.floor(Number(localStorage.getItem(HIGH_SCORE_KEY)) || 0));
  }

  /** log10(value) packed so huge fish values stay inside Number precision. */
  function valueScorePart(value) {
    const v = Math.max(0, Number(value) || 0);
    if (!(v > 0)) return 0;
    return Math.min(999_999_999, Math.floor(Math.log10(v + 1) * 1_000_000));
  }

  /**
   * Best-catch rank key: rarity → look value (base×variants) → look tier.
   * Tier must NOT outrank a much more valuable fish in the same rarity
   * (e.g. Shiny Neon Apex beats Silver Shiny Neon Summitfin).
   */
  function catchScore(fish, entry) {
    if (!fish) return 0;
    const rank = Math.max(0, Math.min(99, RARITY_RANK[fish.rarity] || 1));
    const tier = Math.max(
      0,
      Math.min(99, isExclusiveFish(fish) ? 0 : variantTier(entry))
    );
    const look = isExclusiveFish(fish)
      ? Math.max(0, Number(entry?.lockedValue) || 2)
      : exclusiveCandidateLookValue(fish, entry) ||
        Math.max(0, Number(fish.value) || 0);
    // rank*1e12 always beats lower rarities; lookPart*100 beats tier within rarity.
    return rank * 1e12 + valueScorePart(look) * 100 + tier;
  }

  function legacyCatchScore(fish) {
    if (!fish) return 0;
    const rank = Math.max(0, Math.min(99, RARITY_RANK[fish.rarity] || 1));
    return rank * 1e12 + valueScorePart(fish.value) * 100;
  }

  function catchBetterThan(fishA, entryA, fishB, entryB) {
    if (!fishA) return false;
    if (!fishB) return true;
    return catchScore(fishA, entryA) > catchScore(fishB, entryB);
  }

  function variantTier(entry) {
    const v = normalizeVariant(entry?.variant);
    const primary = v === "silver" ? 1 : v === "gold" ? 2 : v === "diamond" ? 3 : v === "rainbow" ? 4 : 0;
    return primary + (entry?.shiny ? 5 : 0) + (normalizeMutation(entry?.mutation) ? 10 : 0);
  }

  function entryFromVariantTier(tier) {
    const t = Math.max(0, Math.min(19, Math.floor(Number(tier) || 0)));
    const mutation = t >= 10 ? "toxic" : "";
    const base = mutation ? t - 10 : t;
    const shiny = base >= 5;
    const primary = shiny ? base - 5 : base;
    const variant =
      primary === 1 ? "silver" : primary === 2 ? "gold" : primary === 3 ? "diamond" : primary === 4 ? "rainbow" : "";
    return { variant, shiny, mutation };
  }

  function bestCatchEntry() {
    return {
      variant: normalizeVariant(state.bestCatchVariant),
      shiny: !!state.bestCatchShiny,
      mutation: normalizeMutation(state.bestCatchMutation)
    };
  }

  function formatBestCatch(fishOrScore) {
    const fish =
      typeof fishOrScore === "object" && fishOrScore
        ? fishOrScore
        : fishById(state.bestCatchId) || fishFromCatchScore(Number(fishOrScore));
    if (!fish) return "—";
    const entry =
      typeof fishOrScore === "object" && fishOrScore && ("variant" in fishOrScore || "shiny" in fishOrScore)
        ? fishOrScore
        : bestCatchEntry();
    const title = formatVariantTitle(entry);
    const label = title ? `${title} ${fish.name}` : fish.name;
    return `${fish.rarity} · ${label}`;
  }

  function persistBestCatchMeta(fish, entry) {
    if (!fish) return;
    try {
      localStorage.setItem(
        BEST_CATCH_META_KEY,
        JSON.stringify({
          id: fish.id,
          name: fish.name,
          rarity: fish.rarity,
          value: fish.value,
          variant: normalizeVariant(entry?.variant),
          shiny: !!entry?.shiny,
          mutation: normalizeMutation(entry?.mutation)
        })
      );
    } catch {}
  }

  function noteCatch(fish, entry) {
    if (!fish || isTreasureItem(fish)) return;
    const changed = markCaught(fish, entry);
    if (changed) checkAchievements();
    // Exclusive fish never set personal best / leaderboard score.
    if (isExclusiveFish(fish)) return;
    const score = catchScore(fish, entry);
    if (score <= (state.bestCatchScore || 0)) return;
    state.bestCatchScore = score;
    state.bestCatchId = fish.id;
    state.bestCatchVariant = normalizeVariant(entry?.variant);
    state.bestCatchShiny = !!entry?.shiny;
    state.bestCatchMutation = normalizeMutation(entry?.mutation);
    try {
      localStorage.setItem(HIGH_SCORE_KEY, String(score));
    } catch {}
    persistBestCatchMeta(fish, entry);
    maybeSubmitBest(true);
    if (ensureExclusiveCoolerValues()) {
      try {
        saveState();
      } catch {}
    }
  }

  const BOOK_FILTERS = [
    { id: "any", label: "All" },
    { id: "base", label: "Normal" },
    { id: "silver", label: "Silver", mult: 1.5 },
    { id: "gold", label: "Gold", mult: 2 },
    { id: "diamond", label: "Diamond", mult: 2.5 },
    { id: "rainbow", label: "Rainbow", mult: 3 }
  ];
  const BOOK_MUTATIONS = [
    { id: "toxic", label: "Toxic", mult: 4 },
    { id: "lava", label: "Lava", mult: 5 },
    { id: "neon", label: "Neon", mult: 6 }
  ];
  let bookFilter = "any";
  let bookShinyOn = false;
  let bookMutation = "";

  function bookFilterMultText(mult) {
    const n = Number(mult);
    if (!Number.isFinite(n) || n <= 1) return "";
    return `×${formatMult(n)}`;
  }

  function bookFilterButtonLabel(name, mult, on = false) {
    const m = bookFilterMultText(mult);
    const base = on ? `${name} On` : name;
    if (!m) return base;
    return `${base} <span class="book-filter-mult">${m}</span>`;
  }

  function blankCaughtRecord() {
    const rec = {
      any: false,
      base: false,
      silver: false,
      gold: false,
      diamond: false,
      rainbow: false,
      shiny: false,
      looks: {}
    };
    MUTATIONS.forEach((m) => {
      rec[m] = false;
    });
    return rec;
  }

  /** Exact catch look key, e.g. base+toxic, silver+toxic, silver+shiny+toxic. */
  function caughtLookKey(variant, shiny, mutation) {
    const bits = [];
    const v = normalizeVariant(variant);
    if (v && VARIANT_PRIMARY.includes(v)) bits.push(v);
    else bits.push("base");
    if (shiny) bits.push("shiny");
    const m = normalizeMutation(mutation);
    if (m) bits.push(m);
    return bits.join("+");
  }

  function normalizeCaughtLooks(raw) {
    const looks = {};
    if (!raw || typeof raw !== "object") return looks;
    Object.keys(raw).forEach((k) => {
      if (raw[k]) looks[String(k)] = true;
    });
    return looks;
  }

  function normalizeCaughtRecord(raw) {
    const rec = blankCaughtRecord();
    if (raw === true || raw === 1) {
      rec.any = true;
      rec.base = true;
      rec.looks.base = true;
      return rec;
    }
    if (!raw || typeof raw !== "object") return rec;
    rec.any =
      !!raw.any ||
      !!raw.base ||
      !!raw.silver ||
      !!raw.gold ||
      !!raw.diamond ||
      !!raw.rainbow ||
      !!raw.shiny ||
      MUTATIONS.some((m) => !!raw[m]);
    rec.base = !!raw.base;
    rec.silver = !!raw.silver;
    rec.gold = !!raw.gold;
    rec.diamond = !!raw.diamond;
    rec.rainbow = !!raw.rainbow;
    rec.shiny = !!raw.shiny;
    MUTATIONS.forEach((m) => {
      rec[m] = !!raw[m];
    });
    rec.looks = normalizeCaughtLooks(raw.looks);
    if (
      !rec.any &&
      (rec.base ||
        rec.silver ||
        rec.gold ||
        rec.diamond ||
        rec.rainbow ||
        rec.shiny ||
        MUTATIONS.some((m) => rec[m]))
    ) {
      rec.any = true;
    }
    // Backfill plain looks from legacy flags (no mutation/shiny combos guessed).
    if (!Object.keys(rec.looks).length) {
      if (rec.base) rec.looks.base = true;
      VARIANT_PRIMARY.forEach((v) => {
        if (rec[v]) rec.looks[v] = true;
      });
      if (rec.shiny) rec.looks["base+shiny"] = true;
    }
    return rec;
  }

  function ensureCaughtRecord(id) {
    if (!state.caught || typeof state.caught !== "object") state.caught = {};
    state.caught[id] = normalizeCaughtRecord(state.caught[id]);
    return state.caught[id];
  }

  function markCaught(fish, entry) {
    if (!fish || isTreasureItem(fish) || !fish.id) return false;
    const rec = ensureCaughtRecord(fish.id);
    const variant = normalizeVariant(entry?.variant);
    const shiny = !!entry?.shiny;
    const mutation = normalizeMutation(entry?.mutation);
    let changed = false;
    if (!rec.any) {
      rec.any = true;
      changed = true;
    }
    if (!variant && !shiny && !mutation) {
      if (!rec.base) {
        rec.base = true;
        changed = true;
      }
    }
    if (variant && VARIANT_PRIMARY.includes(variant) && !rec[variant]) {
      rec[variant] = true;
      changed = true;
    }
    if (shiny && !rec.shiny) {
      rec.shiny = true;
      changed = true;
    }
    if (mutation && MUTATIONS.includes(mutation) && !rec[mutation]) {
      rec[mutation] = true;
      changed = true;
    }
    const look = caughtLookKey(variant, shiny, mutation);
    if (!rec.looks || typeof rec.looks !== "object") rec.looks = {};
    if (!rec.looks[look]) {
      rec.looks[look] = true;
      changed = true;
    }
    return changed;
  }

  function hasCaughtLook(rec, filter = bookFilter, shinyOn = bookShinyOn, mutationOn = bookMutation) {
    const looks = rec?.looks && typeof rec.looks === "object" ? rec.looks : {};
    const keys = Object.keys(looks).filter((k) => looks[k]);
    if (filter === "any") {
      return keys.some((k) => {
        const parts = k.split("+");
        if (mutationOn && !parts.includes(mutationOn)) return false;
        if (shinyOn && !parts.includes("shiny")) return false;
        if (!mutationOn && !shinyOn) return true;
        return true;
      });
    }
    if (filter === "base") {
      return keys.some((k) => {
        const parts = k.split("+");
        if (parts[0] !== "base") return false;
        if (mutationOn && !parts.includes(mutationOn)) return false;
        if (!mutationOn && parts.some((p) => MUTATIONS.includes(p))) return false;
        if (shinyOn && !parts.includes("shiny")) return false;
        if (!shinyOn && parts.includes("shiny")) return false;
        return true;
      });
    }
    if (!VARIANT_PRIMARY.includes(filter)) return false;
    const want = caughtLookKey(filter, shinyOn, mutationOn);
    if (looks[want]) return true;
    // Exact match only when mutation/shiny filters are on — no cross-painting combos.
    if (mutationOn || shinyOn) return false;
    return !!rec[filter];
  }

  function hasCaught(id, filter = bookFilter, shinyOn = bookShinyOn, mutationOn = bookMutation) {
    const raw = state.caught?.[id];
    if (!raw) return false;
    const rec = normalizeCaughtRecord(raw);
    // Mutation views require the exact variant + mutation look (no cross-painting).
    if (mutationOn) {
      return hasCaughtLook(rec, filter, shinyOn, mutationOn);
    }
    if (shinyOn && !rec.shiny) return false;
    if (filter === "any") {
      if (shinyOn) return !!rec.shiny;
      return !!rec.any;
    }
    if (filter === "base") {
      if (shinyOn) {
        return (
          !!rec.shiny && !rec.silver && !rec.gold && !rec.diamond && !rec.rainbow
        );
      }
      return !!rec.base;
    }
    return !!rec[filter];
  }

  function caughtCount(
    filter = bookFilter,
    shinyOn = bookShinyOn,
    mutationOn = bookMutation
  ) {
    return FISH.reduce(
      (n, f) => n + (hasCaught(f.id, filter, shinyOn, mutationOn) ? 1 : 0),
      0
    );
  }

  function bookFilterLabel(
    filter = bookFilter,
    shinyOn = bookShinyOn,
    mutationOn = bookMutation
  ) {
    const base = BOOK_FILTERS.find((f) => f.id === filter)?.label || "All";
    const bits = [base];
    if (shinyOn) bits.push("Shiny");
    if (mutationOn) {
      const m = BOOK_MUTATIONS.find((x) => x.id === mutationOn)?.label || mutationOn;
      bits.push(m);
    }
    return bits.join(" · ");
  }

  function bookShowEntry(
    filter = bookFilter,
    shinyOn = bookShinyOn,
    mutationOn = bookMutation
  ) {
    const entry = {};
    if (filter === "silver" || filter === "gold" || filter === "diamond" || filter === "rainbow") {
      entry.variant = filter;
    }
    if (shinyOn) entry.shiny = true;
    if (mutationOn) entry.mutation = mutationOn;
    if (!entry.variant && !entry.shiny && !entry.mutation) return null;
    return entry;
  }

  function maybeSubmitBest(force = false) {
    const bestFish = fishById(state.bestCatchId);
    if (isExclusiveFish(bestFish)) return;
    const best = Math.floor(state.bestCatchScore || 0);
    if (best <= 0) return;
    const stored = getStoredBest();
    if (best > stored) {
      try {
        localStorage.setItem(HIGH_SCORE_KEY, String(best));
      } catch {}
    }
    const now = Date.now();
    if (!force && now - lastSubmitAt < 4000) return;
    if (window.HubLeaderboard) {
      lastSubmitAt = now;
      const fish = bestFish;
      const entry = bestCatchEntry();
      HubLeaderboard.submit("fishing", best, {
        force: true,
        fishing: fish
          ? {
              id: fish.id,
              name: fish.name,
              rarity: fish.rarity,
              value: fish.value,
              variant: entry.variant,
              shiny: entry.shiny,
              mutation: entry.mutation
            }
          : null
      }).catch?.(() => {});
    }
  }

  const SUFFIXES = [
    "",
    "K",
    "M",
    "B",
    "T",
    "Qa",
    "Qi",
    "Sx",
    "Sp",
    "Oc",
    "No",
    "Dc",
    "UDc",
    "DDc",
    "TDc",
    "QaDc",
    "QiDc",
    "SxDc",
    "SpDc",
    "OcDc",
    "NoDc",
    "Vg",
    "UVg",
    "DVg",
    "TVg",
    "QaVg",
    "QiVg",
    "SxVg",
    "SpVg",
    "OcVg",
    "NoVg",
    "Tg",
    "UTg",
    "DTg",
    "TTg",
    "QaTg",
    "QiTg",
    "SxTg",
    "SpTg",
    "OcTg",
    "NoTg",
    "Qag",
    "Qig",
    "Sxg",
    "Spg",
    "Ocg",
    "Nog",
    "C"
  ];

  /** Full names for each formatNum suffix (same order as SUFFIXES). */
  const SUFFIX_NAMES = [
    "ones (no suffix)",
    "Thousand",
    "Million",
    "Billion",
    "Trillion",
    "Quadrillion",
    "Quintillion",
    "Sextillion",
    "Septillion",
    "Octillion",
    "Nonillion",
    "Decillion",
    "Undecillion",
    "Duodecillion",
    "Tredecillion",
    "Quattuordecillion",
    "Quindecillion",
    "Sexdecillion",
    "Septendecillion",
    "Octodecillion",
    "Novemdecillion",
    "Vigintillion",
    "Unvigintillion",
    "Duovigintillion",
    "Trevigintillion",
    "Quattuorvigintillion",
    "Quinvigintillion",
    "Sexvigintillion",
    "Septenvigintillion",
    "Octovigintillion",
    "Novemvigintillion",
    "Trigintillion",
    "Untrigintillion",
    "Duotrigintillion",
    "Tretrigintillion",
    "Quattuortrigintillion",
    "Quintrigintillion",
    "Sextrigintillion",
    "Septentrigintillion",
    "Octotrigintillion",
    "Novemtrigintillion",
    "Quadragintillion",
    "Quinquagintillion",
    "Sexagintillion",
    "Septuagintillion",
    "Octogintillion",
    "Nonagintillion",
    "Centillion (game)"
  ];

  let suffixGuideBuilt = false;

  function formatSuffixPower(tier) {
    const exp = tier * 3;
    if (exp <= 0) return "1";
    if (exp <= 6) return `1${"0".repeat(exp)}`;
    return `10^${exp}`;
  }

  function renderSuffixGuide() {
    const body = document.getElementById("suffix-body");
    if (!body || suffixGuideBuilt) return;
    body.innerHTML = SUFFIXES.map((suf, i) => {
      const label = suf || "—";
      const name = SUFFIX_NAMES[i] || "—";
      const power = formatSuffixPower(i);
      const example = i === 0 ? "842" : `1.25${suf}`;
      return `<tr>
        <td><strong class="suffix-code">${escapeHtml(label)}</strong></td>
        <td>${escapeHtml(name)}</td>
        <td class="suffix-power">${escapeHtml(power)}</td>
        <td class="suffix-example">${escapeHtml(example)}</td>
      </tr>`;
    }).join("");
    suffixGuideBuilt = true;
  }

  function openSuffixGuide() {
    renderSuffixGuide();
    const el = document.getElementById("suffix-overlay");
    el?.classList.remove("hidden");
    lockPageScroll();
    const card = el?.querySelector(".suffix-card");
    if (card) card.scrollTop = 0;
  }

  function closeSuffixGuide() {
    document.getElementById("suffix-overlay")?.classList.add("hidden");
    unlockPageScroll();
  }

  const FISH_SHAPE = {
    minnow: "slender",
    perch: "perch",
    bluegill: "panfish",
    sardine: "slender",
    carp: "carp",
    roach: "panfish",
    trout: "trout",
    bass: "bass",
    catfish: "catfish",
    snapper: "snapper",
    cod: "cod",
    flounder: "flat",
    salmon: "salmon",
    pike: "pike",
    mahi: "mahi",
    grouper: "grouper",
    barracuda: "barracuda",
    sturgeon: "sturgeon",
    tuna: "tuna",
    marlin: "marlin",
    swordfish: "swordfish",
    shark: "shark",
    ray: "ray",
    octopus: "octopus",
    golden: "koi",
    leviathan: "leviathan",
    moonfish: "moonfish",
    dragonet: "dragonet",
    crystal: "longnose",
    tidelord: "grouper",
    abyssking: "bullshark",
    starwhale: "whale",
    worldfin: "blade",
    ghostfin: "ghost",
    nullfish: "ghost",
    eclipse: "eel",
    forgotten: "ghost",
    seraph: "kite",
    halo: "angelfish",
    oracle: "koi",
    choirfin: "butterfly",
    timeless: "trout",
    foreverfin: "tuna",
    aeon: "bullshark",
    epochray: "kite",
    nebula: "jellyfish",
    quasar: "cod",
    omnifin: "blade",
    pulsarpike: "longnose",
    stardrift: "ray",
    aurorafin: "mahi",
    galaxykoi: "koi",
    cometcarp: "carp",
    eventide: "eel",
    horizon: "shark",
    collapse: "carp",
    riftray: "kite",
    primefin: "blade",
    absoluth: "bullshark",
    theend: "omega",
    ultimafin: "omega",
    originkoi: "koi",
    dawnlevi: "leviathan",
    firstfin: "angelfish",
    sparkfin: "butterfly",
    twinparadox: "bass",
    mirrorshark: "bullshark",
    loopeel: "eel",
    mobiusmarlin: "marlin",
    endlessray: "kite",
    boundcod: "cod",
    foreverend: "omega",
    perpetualpike: "longnose",
    absolutefin: "blade",
    finalabs: "leviathan",
    trueabs: "bullshark",
    theabsolute: "omega",
    ascendray: "kite",
    overfin: "tuna",
    beyondkoi: "koi",
    transcendfin: "omega",
    crossfin: "butterfly",
    linkshark: "shark",
    hubray: "ray",
    nexuskarp: "carp",
    nullray: "kite",
    hollowfin: "ghost",
    abyssnull: "leviathan",
    thevoidborn: "omega",
    peakfin: "angelfish",
    crownray: "kite",
    apexkoi: "koi",
    spirefin: "longnose",
    solsticeray: "ray",
    thezenith: "omega",
    diademfin: "angelfish",
    royalkoi: "koi",
    coronet: "kite",
    thecrown: "omega",
    dawnorigin: "leviathan",
    sourcefin: "tuna",
    firsttide: "mahi",
    theorigin: "omega",
    skyfin: "butterfly",
    aetherray: "kite",
    cloudmarlin: "marlin",
    theaether: "angelfish",
    gleamray: "kite",
    sunfin: "angelfish",
    blazeel: "eel",
    theradiant: "omega",
    duskfin: "tuna",
    twilightshark: "bullshark",
    umbrakoi: "koi",
    thedusk: "ghost",
    summitfin: "blade",
    pinnacleray: "kite",
    crestkoi: "koi",
    theapex: "omega",
    thronefin: "angelfish",
    regalray: "kite",
    dominionkoi: "koi",
    thesovereign: "omega",
    starvault: "butterfly",
    heavenray: "ray",
    orbitfin: "tuna",
    thecelestial: "angelfish",
    ancientfin: "longnose",
    rootide: "leviathan",
    primalkoi: "koi",
    theprimordial: "ghost",
    finalfin: "blade",
    omniray: "kite",
    lasttide: "mahi",
    theultimate: "omega",
    soultwin: "leviathan"
  };

  const FISH_TINT = {
    minnow: "#c5d0d6",
    perch: "#8fbc6b",
    bluegill: "#6db3c9",
    sardine: "#b8c4cc",
    carp: "#d4a373",
    roach: "#c9a66b",
    trout: "#7eb8a0",
    bass: "#6a9e6e",
    catfish: "#8a7f6e",
    snapper: "#e07860",
    cod: "#8fa0b0",
    flounder: "#c2a878",
    salmon: "#e0898a",
    pike: "#7a9a72",
    mahi: "#45c4a0",
    grouper: "#b08968",
    barracuda: "#8aa0a8",
    sturgeon: "#9a9080",
    tuna: "#5b7fa0",
    marlin: "#4f8fb8",
    swordfish: "#7a90a8",
    shark: "#7d8b96",
    ray: "#6a7d8f",
    octopus: "#b0749a",
    golden: "#f0c14b",
    leviathan: "#6ec6c0",
    moonfish: "#dce6f0",
    dragonet: "#78c4b0",
    crystal: "#9ad4e8",
    tidelord: "#4db6ac",
    abyssking: "#5c6bc0",
    starwhale: "#90caf9",
    worldfin: "#80cbc4",
    ghostfin: "#e0b0f0",
    nullfish: "#c8b8d8",
    eclipse: "#9a70b0",
    forgotten: "#b8a0c8",
    seraph: "#fff3bf",
    halo: "#ffe082",
    oracle: "#ffd54f",
    choirfin: "#fff8e1",
    timeless: "#80deea",
    foreverfin: "#4dd0e1",
    aeon: "#81d4fa",
    epochray: "#b2ebf2",
    nebula: "#b39ddb",
    quasar: "#ce93d8",
    omnifin: "#9575cd",
    pulsarpike: "#7e57c2",
    stardrift: "#4dd0e1",
    aurorafin: "#80cbc4",
    galaxykoi: "#f48fb1",
    cometcarp: "#ff80ab",
    eventide: "#f48fb1",
    horizon: "#ff8a65",
    collapse: "#ffab91",
    riftray: "#ff7043",
    primefin: "#ffe066",
    absoluth: "#ffd54f",
    theend: "#fff59d",
    ultimafin: "#fffde7",
    originkoi: "#b8f2e6",
    dawnlevi: "#9af0d8",
    firstfin: "#e6fff8",
    sparkfin: "#c8fff0",
    twinparadox: "#e040fb",
    mirrorshark: "#ce93d8",
    loopeel: "#ea80fc",
    mobiusmarlin: "#f06292",
    endlessray: "#84ffff",
    boundcod: "#18ffff",
    foreverend: "#e0ffff",
    perpetualpike: "#a7ffeb",
    absolutefin: "#f5f5f5",
    finalabs: "#eeeeee",
    trueabs: "#fafafa",
    theabsolute: "#ffffff",
    ascendray: "#ffd6a5",
    overfin: "#fdba74",
    beyondkoi: "#fb923c",
    transcendfin: "#fff7ed",
    crossfin: "#c4b5fd",
    linkshark: "#a78bfa",
    hubray: "#8b5cf6",
    nexuskarp: "#ddd6fe",
    nullray: "#94a3b8",
    hollowfin: "#64748b",
    abyssnull: "#334155",
    thevoidborn: "#e2e8f0",
    peakfin: "#fcd34d",
    crownray: "#fbbf24",
    apexkoi: "#f59e0b",
    soultwin: "#e879f9",
    spirefin: "#fde68a",
    solsticeray: "#fef3c7",
    thezenith: "#fffbeb",
    diademfin: "#fde047",
    royalkoi: "#facc15",
    coronet: "#eab308",
    thecrown: "#fef9c3",
    dawnorigin: "#e2e8f0",
    sourcefin: "#cbd5e1",
    firsttide: "#94a3b8",
    theorigin: "#f8fafc",
    skyfin: "#7dd3fc",
    aetherray: "#38bdf8",
    cloudmarlin: "#0ea5e9",
    theaether: "#e0f2fe",
    gleamray: "#fde68a",
    sunfin: "#fbbf24",
    blazeel: "#f59e0b",
    theradiant: "#fffbeb",
    duskfin: "#fb923c",
    twilightshark: "#f97316",
    umbrakoi: "#c2410c",
    thedusk: "#ffedd5",
    summitfin: "#f472b6",
    pinnacleray: "#ec4899",
    crestkoi: "#db2777",
    theapex: "#fce7f3",
    thronefin: "#eab308",
    regalray: "#ca8a04",
    dominionkoi: "#a16207",
    thesovereign: "#fef9c3",
    starvault: "#a5b4fc",
    heavenray: "#818cf8",
    orbitfin: "#6366f1",
    thecelestial: "#e0e7ff",
    ancientfin: "#86efac",
    rootide: "#4ade80",
    primalkoi: "#22c55e",
    theprimordial: "#dcfce7",
    finalfin: "#fef08a",
    omniray: "#fde047",
    lasttide: "#facc15",
    theultimate: "#fefce8"
  };

  function fishEye(cx, cy, r = 2.2) {
    return `
      <circle class="eye-sclera" cx="${cx}" cy="${cy}" r="${r}"/>
      <circle class="eye" cx="${cx + r * 0.18}" cy="${cy + r * 0.05}" r="${r * 0.58}"/>
      <circle class="eye-glint" cx="${cx - r * 0.28}" cy="${cy - r * 0.32}" r="${r * 0.28}"/>`;
  }

  function fishScales(x0, x1, y, count = 5) {
    const gap = (x1 - x0) / Math.max(1, count - 1);
    let d = "";
    for (let i = 0; i < count; i += 1) {
      const x = x0 + i * gap;
      d += `M${x} ${y - 2.2} Q${x + 1.6} ${y} ${x} ${y + 2.2} `;
    }
    return `<path class="scales" d="${d.trim()}" fill="none"/>`;
  }

  function fishIdHash(id) {
    let h = 2166136261;
    const str = String(id || "fish");
    for (let i = 0; i < str.length; i += 1) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  /** Light per-fish paint tweaks only — no warping transforms. */
  function fishLookProfile(id) {
    const h = fishIdHash(id);
    return {
      mark: h % 4,
      belly: 0.42 + (((h >>> 8) % 22) / 100),
      shade: 0.28 + (((h >>> 14) % 18) / 100)
    };
  }

  /** Soft marks that stay inside the body (no spikes/bills that break the silhouette). */
  function fishGlyphAccents(look, gid) {
    if (look.mark === 1) {
      return `<path class="stripe" d="M22 12 C32 10 42 10 48 13" fill="none" stroke="currentColor" stroke-width="1.3" opacity="0.35"/>
        <path class="stripe" d="M22 18 C32 20 42 20 48 17" fill="none" stroke="currentColor" stroke-width="1.2" opacity="0.3"/>`;
    }
    if (look.mark === 2) {
      return `<circle class="spot" cx="28" cy="14" r="1.5" fill="currentColor" opacity="0.28"/>
        <circle class="spot" cx="36" cy="18" r="1.7" fill="currentColor" opacity="0.24"/>
        <circle class="spot" cx="42" cy="13" r="1.2" fill="currentColor" opacity="0.28"/>`;
    }
    if (look.mark === 3) {
      return `<ellipse class="shine" cx="34" cy="11" rx="6" ry="2.2" fill="#fff" opacity="0.22"/>
        <path class="stripe" d="M24 16 L46 16" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.28"/>`;
    }
    return `<path class="scales" d="M24 14 Q25.5 16 24 18 M30 13 Q31.5 15 30 17 M36 14 Q37.5 16 36 18 M42 13 Q43.5 15 42 17" fill="none" stroke="url(#${gid}-fin)" stroke-width="1" opacity="0.35"/>`;
  }

  /** Toxic mutation: sludge blotches, acid veins, drips, and spore bubbles. */
  function fishGlyphToxicDetails(gid) {
    return `<defs>
        <radialGradient id="${gid}-toxic-glow" cx="0.45" cy="0.4" r="0.7">
          <stop offset="0%" stop-color="#bef264" stop-opacity="0.55"/>
          <stop offset="45%" stop-color="#4ade80" stop-opacity="0.22"/>
          <stop offset="100%" stop-color="#14532d" stop-opacity="0"/>
        </radialGradient>
        <linearGradient id="${gid}-toxic-slime" x1="0" y1="0" x2="0.2" y2="1">
          <stop offset="0%" stop-color="#d9f99d" stop-opacity="0.75"/>
          <stop offset="40%" stop-color="#4ade80" stop-opacity="0.55"/>
          <stop offset="100%" stop-color="#14532d" stop-opacity="0.7"/>
        </linearGradient>
      </defs>
      <ellipse class="toxic-haze" cx="34" cy="16" rx="26" ry="11" fill="url(#${gid}-toxic-glow)"/>
      <g class="toxic-marks">
        <ellipse class="toxic-blotch" cx="29" cy="13.5" rx="4.6" ry="3" fill="#052e16" opacity="0.55"/>
        <ellipse class="toxic-blotch" cx="40" cy="18" rx="3.8" ry="2.5" fill="#14532d" opacity="0.5"/>
        <ellipse class="toxic-blotch" cx="23" cy="19" rx="2.9" ry="1.9" fill="#166534" opacity="0.48"/>
        <ellipse class="toxic-blotch" cx="46" cy="14" rx="2.4" ry="1.6" fill="#3f6212" opacity="0.42"/>
        <ellipse class="toxic-scar" cx="35" cy="16.5" rx="3.2" ry="1.15" fill="url(#${gid}-toxic-slime)" opacity="0.7" transform="rotate(-16 35 16.5)"/>
        <path class="toxic-vein" d="M20 14 C27 11 34 16 44 12" fill="none" stroke="#bbf7d0" stroke-width="0.75" opacity="0.65"/>
        <path class="toxic-vein" d="M24 20 C31 23 39 19 48 22" fill="none" stroke="#86efac" stroke-width="0.6" opacity="0.5"/>
        <path class="toxic-vein" d="M26 12 C30 15 36 14 41 17" fill="none" stroke="#a3e635" stroke-width="0.5" opacity="0.45"/>
        <path class="toxic-drip" d="M27 22 Q28.4 26.5 27.6 29.5" fill="none" stroke="#4ade80" stroke-width="1.35" stroke-linecap="round" opacity="0.85"/>
        <path class="toxic-drip" d="M36 23.5 Q37.6 27.5 36.5 30.5" fill="none" stroke="#a3e635" stroke-width="1.1" stroke-linecap="round" opacity="0.75"/>
        <path class="toxic-drip" d="M43 21 Q44 24.5 43.2 27" fill="none" stroke="#86efac" stroke-width="0.9" stroke-linecap="round" opacity="0.65"/>
        <circle class="toxic-drip-bead" cx="27.6" cy="29.5" r="1.15" fill="#bef264" opacity="0.85"/>
        <circle class="toxic-drip-bead" cx="36.5" cy="30.5" r="1" fill="#4ade80" opacity="0.8"/>
        <circle class="toxic-spore" cx="32" cy="10.5" r="1.25" fill="#d9f99d" opacity="0.8"/>
        <circle class="toxic-spore" cx="45" cy="15.5" r="1" fill="#86efac" opacity="0.7"/>
        <circle class="toxic-spore" cx="25" cy="15.5" r="0.8" fill="#bef264" opacity="0.65"/>
        <circle class="toxic-spore" cx="38" cy="12" r="0.65" fill="#f7fee7" opacity="0.55"/>
        <circle class="toxic-bubble" cx="37" cy="9.5" r="1.55" fill="none" stroke="#bbf7d0" stroke-width="0.65" opacity="0.6"/>
        <circle class="toxic-bubble" cx="21" cy="16" r="1.15" fill="none" stroke="#86efac" stroke-width="0.55" opacity="0.5"/>
        <circle class="toxic-bubble" cx="48" cy="18" r="0.95" fill="none" stroke="#a3e635" stroke-width="0.5" opacity="0.45"/>
      </g>`;
  }

  /** Lava mutation: magma cracks, embers, molten glow. */
  function fishGlyphLavaDetails(gid) {
    return `<defs>
        <radialGradient id="${gid}-lava-glow" cx="0.48" cy="0.42" r="0.72">
          <stop offset="0%" stop-color="#fdba74" stop-opacity="0.65"/>
          <stop offset="40%" stop-color="#f97316" stop-opacity="0.28"/>
          <stop offset="100%" stop-color="#7c2d12" stop-opacity="0"/>
        </radialGradient>
        <linearGradient id="${gid}-lava-molten" x1="0" y1="0" x2="0.25" y2="1">
          <stop offset="0%" stop-color="#fde68a" stop-opacity="0.9"/>
          <stop offset="45%" stop-color="#f97316" stop-opacity="0.75"/>
          <stop offset="100%" stop-color="#9a3412" stop-opacity="0.8"/>
        </linearGradient>
      </defs>
      <ellipse class="lava-haze" cx="34" cy="16" rx="26" ry="11" fill="url(#${gid}-lava-glow)"/>
      <g class="lava-marks">
        <ellipse class="lava-blotch" cx="28" cy="14" rx="4.8" ry="3.1" fill="#431407" opacity="0.6"/>
        <ellipse class="lava-blotch" cx="41" cy="18.5" rx="3.9" ry="2.6" fill="#7c2d12" opacity="0.55"/>
        <ellipse class="lava-blotch" cx="22" cy="19" rx="2.8" ry="1.9" fill="#9a3412" opacity="0.48"/>
        <path class="lava-crack" d="M21 13 C27 15 33 12 40 16 C44 18 48 15 52 17" fill="none" stroke="url(#${gid}-lava-molten)" stroke-width="1.15" opacity="0.9"/>
        <path class="lava-crack" d="M24 20 C30 18 36 21 45 19" fill="none" stroke="#fb923c" stroke-width="0.7" opacity="0.7"/>
        <path class="lava-crack" d="M26 11 C31 13 37 11 42 14" fill="none" stroke="#fbbf24" stroke-width="0.55" opacity="0.65"/>
        <ellipse class="lava-vent" cx="34" cy="15.5" rx="3.4" ry="1.3" fill="url(#${gid}-lava-molten)" opacity="0.85" transform="rotate(-12 34 15.5)"/>
        <circle class="lava-ember" cx="31" cy="10" r="1.2" fill="#fde68a" opacity="0.9"/>
        <circle class="lava-ember" cx="44" cy="13.5" r="1" fill="#fb923c" opacity="0.85"/>
        <circle class="lava-ember" cx="25" cy="16" r="0.85" fill="#f97316" opacity="0.75"/>
        <circle class="lava-ember" cx="38" cy="19" r="0.7" fill="#fdba74" opacity="0.7"/>
        <circle class="lava-spark" cx="36" cy="9" r="1.5" fill="none" stroke="#fdba74" stroke-width="0.6" opacity="0.55"/>
        <circle class="lava-spark" cx="20" cy="15" r="1.1" fill="none" stroke="#f97316" stroke-width="0.5" opacity="0.5"/>
        <path class="lava-drip" d="M29 22 Q30.2 26 29.4 29" fill="none" stroke="#f97316" stroke-width="1.3" stroke-linecap="round" opacity="0.85"/>
        <path class="lava-drip" d="M37 23 Q38.4 27 37.5 30" fill="none" stroke="#fb923c" stroke-width="1.05" stroke-linecap="round" opacity="0.75"/>
        <circle class="lava-drip-bead" cx="29.4" cy="29" r="1.2" fill="#fbbf24" opacity="0.9"/>
        <circle class="lava-drip-bead" cx="37.5" cy="30" r="1" fill="#f97316" opacity="0.85"/>
      </g>`;
  }

  /** Neon mutation: electric arcs, cyan/magenta glow, pulse nodes. */
  function fishGlyphNeonDetails(gid) {
    return `<defs>
        <radialGradient id="${gid}-neon-glow" cx="0.5" cy="0.4" r="0.75">
          <stop offset="0%" stop-color="#f0abfc" stop-opacity="0.55"/>
          <stop offset="40%" stop-color="#22d3ee" stop-opacity="0.3"/>
          <stop offset="100%" stop-color="#4c1d95" stop-opacity="0"/>
        </radialGradient>
        <linearGradient id="${gid}-neon-arc" x1="0" y1="0" x2="1" y2="0.4">
          <stop offset="0%" stop-color="#67e8f9" stop-opacity="0.95"/>
          <stop offset="50%" stop-color="#e879f9" stop-opacity="0.9"/>
          <stop offset="100%" stop-color="#22d3ee" stop-opacity="0.85"/>
        </linearGradient>
      </defs>
      <ellipse class="neon-haze" cx="34" cy="16" rx="26" ry="11" fill="url(#${gid}-neon-glow)"/>
      <g class="neon-marks">
        <path class="neon-arc" d="M20 12 C28 8 36 10 44 9 C48 8.5 52 11 54 14" fill="none" stroke="url(#${gid}-neon-arc)" stroke-width="1.2" opacity="0.95"/>
        <path class="neon-arc" d="M22 20 C30 22 38 18 48 21" fill="none" stroke="#a78bfa" stroke-width="0.75" opacity="0.75"/>
        <path class="neon-arc" d="M24 15 C32 17 40 14 50 16" fill="none" stroke="#67e8f9" stroke-width="0.55" opacity="0.7"/>
        <circle class="neon-node" cx="30" cy="11" r="1.35" fill="#f0abfc" opacity="0.95"/>
        <circle class="neon-node" cx="42" cy="13" r="1.15" fill="#67e8f9" opacity="0.9"/>
        <circle class="neon-node" cx="26" cy="18" r="0.95" fill="#e879f9" opacity="0.85"/>
        <circle class="neon-node" cx="46" cy="18.5" r="0.85" fill="#22d3ee" opacity="0.8"/>
        <circle class="neon-ring" cx="35" cy="15" r="2.2" fill="none" stroke="#f5d0fe" stroke-width="0.65" opacity="0.7"/>
        <circle class="neon-ring" cx="23" cy="14" r="1.5" fill="none" stroke="#67e8f9" stroke-width="0.5" opacity="0.55"/>
        <path class="neon-spark" d="M33 8 L34.2 10.2 L36.5 10.5 L34.8 12.2 L35.2 14.5 L33 13.2 L30.8 14.5 L31.2 12.2 L29.5 10.5 L31.8 10.2 Z" fill="#f0abfc" opacity="0.75"/>
        <ellipse class="neon-stripe" cx="36" cy="17" rx="8" ry="1.2" fill="#22d3ee" opacity="0.28"/>
      </g>`;
  }

  function fishGlyphParts(shape) {
    switch (shape) {
      case "catfish":
        return `
          <path class="fin belly-fin" d="M22 22 C26 28 34 29 40 24 C36 26 28 26 22 22 Z"/>
          <path class="whisker" d="M48 13 Q58 6 63 4"/>
          <path class="whisker" d="M48 18 Q58 26 63 28"/>
          <path class="whisker" d="M47 15.5 Q56 14 61 12"/>
          <path class="tail" d="M1 16 C6 8 11 7 14 12 L14 20 C11 25 6 24 1 16 Z"/>
          <path class="body shade" d="M14 16 C16 7 28 4 42 8 C52 12 55 16 53 21 C49 29 28 30 16 24 C13 22 12 18 14 16 Z"/>
          <path class="body" d="M14 16 C16 8 28 5 41 9 C51 13 54 16 52 20 C48 27 28 28 16 23 C13 21 12 18 14 16 Z"/>
          <path class="belly" d="M18 20 C28 26 44 25 50 19 C44 24 28 25 18 20 Z"/>
          <path class="fin" d="M28 9 C31 2 36 1 39 8 C35 6 31 7 28 9 Z"/>
          <path class="gill" d="M44 11 C46 16 46 20 44 23" fill="none"/>
          ${fishScales(22, 38, 16, 4)}
          ${fishEye(49, 13.5, 2.1)}`;
      case "snapper":
        return `
          <path class="fin belly-fin" d="M24 23 C28 30 36 30 40 24 C35 27 28 27 24 23 Z"/>
          <path class="tail" d="M1 16 C6 6 12 5 15 12 L15 20 C12 27 6 26 1 16 Z"/>
          <path class="body shade" d="M14 16 C16 6 30 2 44 7 C54 12 56 17 53 22 C48 30 26 31 15 24 C12 21 12 18 14 16 Z"/>
          <path class="body" d="M14 16 C16 7 30 3 43 8 C53 13 55 17 52 21 C47 28 26 29 15 23 C12 20 12 18 14 16 Z"/>
          <path class="belly" d="M18 20 C30 27 46 26 51 19 C44 25 28 26 18 20 Z"/>
          <path class="fin" d="M30 7 C34 -1 40 0 41 9 C37 6 33 6 30 7 Z"/>
          <path class="gill" d="M45 10 C47 15 47 20 45 24" fill="none"/>
          ${fishScales(22, 40, 16, 5)}
          ${fishEye(48, 12.5, 2.2)}
          <path class="mouth" d="M54 17 Q57.5 18.2 54 19.4"/>`;
      case "eel":
        return `
          <path class="body shade" d="M3 18 C9 7 20 5 30 11 C40 17 48 8 58 13 C62 15 62 20 57 21 C47 24 39 29 29 23 C19 17 12 26 5 21 Z"/>
          <path class="body" d="M3 18 C9 8 20 6 30 12 C40 18 48 9 57 14 C61 16 61 20 56 20 C46 22 39 28 29 22 C19 16 12 25 5 20 Z"/>
          <path class="belly" d="M10 20 C22 24 40 24 54 18 C40 23 22 23 10 20 Z"/>
          <path class="fin" d="M18 12 C24 6 34 8 38 14 C30 10 22 10 18 12 Z" opacity="0.55"/>
          ${fishEye(56, 14, 1.7)}`;
      case "flat":
        return `
          <path class="fin" d="M16 9 C20 2 28 3 30 10 C24 8 19 9 16 9 Z"/>
          <path class="fin" d="M16 23 C20 30 28 29 30 22 C24 24 19 23 16 23 Z"/>
          <ellipse class="body shade" cx="34" cy="16.5" rx="24" ry="9.5"/>
          <ellipse class="body" cx="34" cy="16" rx="23.5" ry="8.8"/>
          <ellipse class="belly" cx="34" cy="19" rx="16" ry="4.5"/>
          <path class="gill" d="M46 10 C49 14 49 18 46 22" fill="none"/>
          ${fishEye(50, 12, 2.1)}
          ${fishEye(44, 11.2, 1.5)}`;
      case "pike":
        return `
          <path class="fin belly-fin" d="M30 20 C34 26 42 25 46 20 C40 23 34 23 30 20 Z"/>
          <path class="tail" d="M0 16 C5 7 11 6 14 12 L14 20 C11 26 5 25 0 16 Z"/>
          <path class="body shade" d="M14 16 C18 8 32 6 48 10 C56 12 60 15 58 19 C54 24 34 26 16 22 C13 20 12 18 14 16 Z"/>
          <path class="body" d="M14 16 C18 9 32 7 47 11 C55 13 59 15.5 57 18.5 C53 23 34 24.5 16 21 C13 19.5 12 17.5 14 16 Z"/>
          <path class="belly" d="M20 19 C34 24 50 22 56 17 C48 22 32 23 20 19 Z"/>
          <path class="fin" d="M32 9 C36 2 42 2 44 10 C39 7 35 8 32 9 Z"/>
          <path class="gill" d="M48 11 C50 15 50 19 48 22" fill="none"/>
          ${fishScales(24, 42, 15.5, 5)}
          ${fishEye(53, 13.5, 1.8)}
          <path class="mouth" d="M58 15.5 L63 13.5 M58 17 L63 19"/>`;
      case "barracuda":
        return `
          <path class="fin belly-fin" d="M32 20 C36 25 44 24 48 20 C42 23 36 23 32 20 Z"/>
          <path class="tail" d="M0 16 C5 8 11 7 14 12 L14 20 C11 25 5 24 0 16 Z"/>
          <path class="body shade" d="M14 16 C20 9 36 8 52 12 C58 14 62 16 60 19 C56 23 34 24 16 21 C13 19 12 17 14 16 Z"/>
          <path class="body" d="M14 16 C20 10 36 9 51 13 C57 15 61 16.5 59 18.5 C55 22 34 23 16 20.5 C13 18.5 12 17 14 16 Z"/>
          <path class="belly" d="M22 19 C38 23 52 21 58 17 C48 22 32 22 22 19 Z"/>
          <path class="fin" d="M34 10 C38 4 44 5 44 12 C40 9 36 10 34 10 Z"/>
          <path class="stripe" d="M20 13 L54 13" stroke-width="1.2" opacity="0.45"/>
          <path class="stripe" d="M20 19 L54 19" stroke-width="1.2" opacity="0.45"/>
          ${fishEye(54, 13.5, 1.6)}
          <path class="mouth" d="M58 15 L64 14 M58 17 L64 18"/>`;
      case "shark":
        return `
          <path class="fin belly-fin" d="M28 22 C32 29 40 29 44 23 C38 26 32 26 28 22 Z"/>
          <path class="tail" d="M1 16 C6 5 12 4 14 12 L12 16 L14 20 C12 28 6 27 1 16 Z"/>
          <path class="body shade" d="M14 17 C18 8 32 6 48 11 C56 14 58 18 54 22 C48 28 28 30 16 24 C12 21 12 18 14 17 Z"/>
          <path class="body" d="M14 17 C18 9 32 7 47 12 C55 15 57 18 53 21 C47 27 28 28.5 16 23 C12 20.5 12 18 14 17 Z"/>
          <path class="belly" d="M20 21 C34 28 48 26 52 20 C44 26 30 27 20 21 Z"/>
          <path class="fin" d="M32 9 C36 -2 44 2 42 12 C38 8 34 9 32 9 Z"/>
          <path class="gill" d="M46 12 C48 16 48 20 46 23" fill="none"/>
          ${fishEye(50, 14.5, 1.8)}
          <path class="mouth" d="M50 20 Q55 22.5 48 23"/>`;
      case "ray":
        return `
          <path class="tail" d="M10 16 C4 14 1 15 0 16 C1 17 4 18 10 16 Z"/>
          <path class="body shade" d="M34 16 L10 7 L6 16 L10 25 Z"/>
          <path class="body" d="M34 16 L11 8 L7 16 L11 24 Z"/>
          <ellipse class="body shade" cx="42" cy="16.5" rx="16.5" ry="11.5"/>
          <ellipse class="body" cx="42" cy="16" rx="16" ry="10.8"/>
          <ellipse class="belly" cx="42" cy="19" rx="10" ry="5"/>
          ${fishEye(50, 13, 1.8)}`;
      case "octopus":
        return `
          <path class="fin tentacle" d="M24 18 Q18 28 14 31"/>
          <path class="fin tentacle" d="M28 20 Q24 30 22 33"/>
          <path class="fin tentacle" d="M36 22 Q36 31 38 34"/>
          <path class="fin tentacle" d="M44 20 Q50 30 52 33"/>
          <path class="fin tentacle" d="M48 18 Q58 27 60 30"/>
          <circle class="body shade" cx="36" cy="12.5" r="11.5"/>
          <circle class="body" cx="36" cy="12" r="11"/>
          <ellipse class="belly" cx="36" cy="15" rx="7" ry="4"/>
          ${fishEye(31.5, 10.5, 2)}
          ${fishEye(40.5, 10.5, 2)}`;
      case "swordfish":
        return `
          <path class="bill" d="M52 16 L64 13.5 L64 18.5 Z"/>
          <path class="fin belly-fin" d="M24 22 C28 28 36 28 40 22 C34 25 28 25 24 22 Z"/>
          <path class="tail" d="M1 16 C6 4 12 3 14 12 L12 16 L14 20 C12 29 6 28 1 16 Z"/>
          <path class="body shade" d="M14 16 C18 7 30 5 44 10 C52 13 54 17 50 21 C44 28 24 28 15 22 C12 19 12 17 14 16 Z"/>
          <path class="body" d="M14 16 C18 8 30 6 43 11 C51 14 53 17 49 20 C43 26 24 26.5 15 21 C12 18.5 12 17 14 16 Z"/>
          <path class="belly" d="M18 20 C30 26 44 25 49 19 C40 25 26 25 18 20 Z"/>
          <path class="fin" d="M28 8 C32 -2 40 0 40 11 C35 7 30 8 28 8 Z"/>
          <path class="gill" d="M44 11 C46 15 46 19 44 22" fill="none"/>
          ${fishEye(47, 13, 1.8)}`;
      case "marlin":
        return `
          <path class="fin belly-fin" d="M26 21 C32 28 44 28 48 20 C40 26 32 26 26 21 Z"/>
          <path class="tail" d="M1 16 C7 3 14 2 16 12 L13 16 L16 20 C14 30 7 29 1 16 Z"/>
          <path class="body shade" d="M14 16 C20 6 36 3 50 10 C56 13 58 18 52 22 C44 29 24 30 15 23 C11 20 11 17 14 16 Z"/>
          <path class="body" d="M14 16 C20 7 36 4 49 11 C55 14 57 18 51 21.5 C43 28 24 29 15 22.5 C11 19.5 11 17 14 16 Z"/>
          <path class="belly" d="M20 20 C34 28 48 26 52 18 C44 26 30 27 20 20 Z"/>
          <path class="bill" d="M54 14.5 L64 12 L54 18.5 Z"/>
          <path class="fin" d="M30 7 C36 -3 48 1 44 13 C38 6 32 7 30 7 Z"/>
          ${fishEye(48, 13, 2)}`;
      case "tuna":
        return `
          <path class="fin belly-fin" d="M28 22 C32 29 40 28 44 22 C38 26 32 26 28 22 Z"/>
          <path class="tail" d="M1 16 C7 4 13 3 15 12 L13 16 L15 20 C13 29 7 28 1 16 Z"/>
          <path class="body shade" d="M15 16 C20 6 34 4 48 9 C56 12 58 17 54 21 C48 28 26 29 16 23 C13 20 13 17 15 16 Z"/>
          <path class="body" d="M15 16 C20 7 34 5 47 10 C55 13 57 17 53 20 C47 26.5 26 27.5 16 22 C13 19.5 13 17 15 16 Z"/>
          <path class="belly" d="M20 20 C34 27 48 25 52 19 C44 25 30 26 20 20 Z"/>
          <path class="fin" d="M30 8 C34 0 41 1 42 10 C37 7 33 7 30 8 Z"/>
          <path class="stripe" d="M22 13.5 H46 M22 18 H44"/>
          <path class="gill" d="M46 10.5 C48 15 48 19.5 46 23" fill="none"/>
          ${fishScales(24, 42, 15.5, 5)}
          ${fishEye(50, 12.8, 2)}`;
      case "mackerel":
        return `
          <path class="fin belly-fin" d="M28 21 C32 26 40 26 44 21 C38 24 32 24 28 21 Z"/>
          <path class="tail" d="M1 16 C6 8 12 7 14 12 L14 20 C12 25 6 24 1 16 Z"/>
          <path class="body shade" d="M14 16 C18 8 34 6 50 11 C56 13 58 17 54 20 C48 25 28 26 15 21 C12 19 12 17 14 16 Z"/>
          <path class="body" d="M14 16 C18 9 34 7 49 12 C55 14 57 17 53 19.5 C47 24 28 25 15 20.5 C12 18.5 12 17 14 16 Z"/>
          <path class="belly" d="M20 19 C34 24 48 22 52 17 C44 22 30 23 20 19 Z"/>
          <path class="fin" d="M32 9 C36 3 42 3 43 10 C39 7 34 8 32 9 Z"/>
          <path class="stripe" d="M22 12 L48 12" stroke-width="1.2"/>
          <path class="stripe" d="M22 16 L48 16" stroke-width="1.1"/>
          <path class="stripe" d="M22 20 L46 20" stroke-width="1"/>
          <path class="gill" d="M46 11 C48 15 48 18 46 21" fill="none"/>
          ${fishEye(51, 13, 1.9)}`;
      case "salmon":
        return `
          <path class="fin belly-fin" d="M26 22 C30 29 40 29 44 22 C36 27 30 27 26 22 Z"/>
          <path class="tail" d="M1 16 C7 6 13 5 15 12 L15 20 C13 27 7 26 1 16 Z"/>
          <path class="body shade" d="M14 16 C18 7 32 4 48 9 C55 12 57 17 53 21 C47 28 26 29 15 23 C12 20 12 17 14 16 Z"/>
          <path class="body" d="M14 16 C18 8 32 5 47 10 C54 13 56 17 52 20.5 C46 27 26 28 15 22.5 C12 19.5 12 17 14 16 Z"/>
          <path class="belly" d="M18 20 C32 27 46 25 51 18 C42 25 28 26 18 20 Z"/>
          <path class="fin" d="M30 8 C34 0 42 1 42 10 C37 6 32 7 30 8 Z"/>
          <path class="spot" d="M28 13 a1.2 1.2 0 1 0 0.1 0" fill="currentColor" opacity="0.35"/>
          <path class="spot" d="M34 17 a1.1 1.1 0 1 0 0.1 0" fill="currentColor" opacity="0.3"/>
          <path class="spot" d="M40 12 a1 1 0 1 0 0.1 0" fill="currentColor" opacity="0.35"/>
          <path class="gill" d="M46 11 C48 15 48 19 46 22" fill="none"/>
          ${fishEye(50, 13, 2)}`;
      case "angelfish":
        return `
          <path class="fin" d="M30 16 C24 -1 36 -3 40 14 C36 8 32 12 30 16 Z"/>
          <path class="fin" d="M30 16 C24 33 36 35 40 18 C36 24 32 20 30 16 Z"/>
          <path class="tail" d="M22 16 C12 8 4 10 1 16 C4 22 12 24 22 16 Z"/>
          <ellipse class="body shade" cx="38" cy="16.5" rx="16" ry="10"/>
          <ellipse class="body" cx="38" cy="16" rx="15.5" ry="9.4"/>
          <ellipse class="belly" cx="38" cy="20" rx="9" ry="4"/>
          <path class="stripe" d="M32 8 L32 24" stroke-width="2"/>
          <path class="stripe" d="M38 7 L38 25" stroke-width="1.6"/>
          ${fishEye(48, 13, 2)}`;
      case "boxfish":
        return `
          <path class="fin" d="M28 8 C32 2 40 3 40 10 C36 7 30 8 28 8 Z"/>
          <path class="fin" d="M28 24 C32 30 40 29 40 22 C36 25 30 24 28 24 Z"/>
          <path class="tail" d="M16 16 C8 10 3 12 1 16 C3 20 8 22 16 16 Z"/>
          <rect class="body shade" x="14" y="8" width="38" height="17" rx="4"/>
          <rect class="body" x="15" y="8.5" width="36" height="15.5" rx="3.5"/>
          <rect class="belly" x="20" y="16" width="24" height="6" rx="2" opacity="0.5"/>
          ${fishEye(46, 13.5, 2.1)}`;
      case "seahorse":
        return `
          <path class="body shade" d="M38 4 C46 4 50 10 46 14 C52 16 52 24 46 26 C40 28 36 24 38 18 C34 22 28 20 28 14 C28 8 34 4 38 4 Z"/>
          <path class="body" d="M38 5 C45 5 48 10 45 13.5 C50 15.5 50 23 45 25 C40 26.5 37 23 38.5 18 C35 21 29.5 19.5 29.5 14 C29.5 9 34.5 5 38 5 Z"/>
          <path class="fin" d="M34 12 C28 10 27 16 33 15 Z"/>
          <path class="tail" d="M38 26 C34 30 40 32 42 28 C40 30 38 28 38 26 Z"/>
          ${fishEye(46, 8.5, 1.6)}`;
      case "butterfly":
        return `
          <path class="fin" d="M32 16 C20 2 42 0 46 14 C40 8 34 12 32 16 Z"/>
          <path class="fin" d="M32 16 C20 30 42 32 46 18 C40 24 34 20 32 16 Z"/>
          <path class="tail" d="M26 16 C14 10 5 12 2 16 C5 20 14 22 26 16 Z"/>
          <ellipse class="body shade" cx="40" cy="16.5" rx="14" ry="7.5"/>
          <ellipse class="body" cx="40" cy="16" rx="13.5" ry="7"/>
          <circle class="spot" cx="36" cy="14" r="2" fill="#fff" opacity="0.45"/>
          <circle class="spot" cx="42" cy="18" r="1.6" fill="#fff" opacity="0.4"/>
          ${fishEye(50, 14, 1.9)}`;
      case "longnose":
        return `
          <path class="fin belly-fin" d="M30 21 C34 27 42 26 46 21 C40 24 34 24 30 21 Z"/>
          <path class="tail" d="M1 16 C6 7 12 6 14 12 L14 20 C12 26 6 25 1 16 Z"/>
          <path class="body shade" d="M14 16 C18 9 30 8 44 11 C54 14 62 15 60 18 C56 22 34 24 16 21 C13 19 12 17 14 16 Z"/>
          <path class="body" d="M14 16 C18 10 30 9 43 12 C53 15 61 15.5 59 18 C55 21 34 23 16 20.5 C13 18.5 12 17 14 16 Z"/>
          <path class="bill" d="M58 15.5 L64 14.5 L58 18 Z"/>
          <path class="fin" d="M32 9 C36 3 42 4 42 11 C38 8 34 9 32 9 Z"/>
          ${fishEye(48, 13.5, 1.8)}`;
      case "blade":
        return `
          <path class="fin belly-fin" d="M26 20 C32 28 44 28 48 20 C40 25 32 25 26 20 Z"/>
          <path class="tail" d="M0 16 C7 1 16 1 17 12 L14 16 L17 20 C16 31 7 31 0 16 Z"/>
          <path class="body shade" d="M14 16 C22 4 40 2 52 10 C58 14 58 20 52 24 C40 32 22 30 14 16 Z"/>
          <path class="body" d="M14 16 C22 5 40 3 51 11 C57 15 57 19.5 51 23 C40 30 22 29 14 16 Z"/>
          <path class="belly" d="M22 20 C36 28 48 26 52 18 C44 26 30 27 22 20 Z"/>
          <path class="fin" d="M30 6 C38 -4 50 2 46 14 C40 6 33 6 30 6 Z"/>
          <path class="stripe" d="M24 16 L50 16" stroke-width="2" opacity="0.45"/>
          ${fishEye(50, 12.5, 2.2)}`;
      case "crownfish":
        return `
          <path class="fin" d="M26 6 L30 -2 L34 6 L38 -2 L42 6 Z"/>
          <path class="fin belly-fin" d="M24 23 C30 32 42 32 46 23 C38 29 30 29 24 23 Z"/>
          <path class="tail" d="M1 16 C7 4 14 3 16 12 L13 16 L16 20 C14 29 7 28 1 16 Z"/>
          <path class="body shade" d="M14 16 C20 6 34 4 48 9 C56 13 57 18 52 22 C45 30 24 31 15 23 C11 20 11 17 14 16 Z"/>
          <path class="body" d="M14 16 C20 7 34 5 47 10 C55 14 56 18 51 21.5 C44 28.5 24 29.5 15 22.5 C11 19.5 11 17 14 16 Z"/>
          <path class="belly" d="M18 21 C32 29 46 27 51 19 C42 27 28 28 18 21 Z"/>
          ${fishEye(50, 13, 2.1)}`;
      case "kite":
        return `
          <path class="fin" d="M34 16 C12 5 8 12 30 16 C8 20 12 27 34 16 Z"/>
          <path class="fin" d="M34 16 C56 5 60 12 38 16 C60 20 56 27 34 16 Z"/>
          <path class="tail" d="M28 18 C22 24 24 30 30 26 C28 28 30 22 28 18 Z"/>
          <ellipse class="body shade" cx="36" cy="16.5" rx="10" ry="6"/>
          <ellipse class="body" cx="36" cy="16" rx="9.5" ry="5.5"/>
          <ellipse class="belly" cx="36" cy="18.5" rx="6" ry="2.8"/>
          ${fishEye(42, 14.5, 1.5)}`;
      case "bullshark":
        return `
          <path class="fin belly-fin" d="M26 22 C30 30 42 30 46 22 C38 27 30 27 26 22 Z"/>
          <path class="tail" d="M1 16 C6 4 12 3 15 12 L12 16 L15 20 C12 29 6 28 1 16 Z"/>
          <path class="body shade" d="M14 17 C20 7 36 5 50 12 C56 15 56 20 50 23 C40 30 22 30 15 24 C12 21 12 18 14 17 Z"/>
          <path class="body" d="M14 17 C20 8 36 6 49 13 C55 16 55 19.5 49 22 C40 28.5 22 28.5 15 23.5 C12 20.5 12 18 14 17 Z"/>
          <path class="belly" d="M20 22 C34 29 48 27 52 20 C44 27 30 28 20 22 Z"/>
          <path class="fin" d="M30 8 C36 -2 46 2 44 14 C38 8 32 9 30 8 Z"/>
          <path class="gill" d="M44 12 C46 16 46 20 44 23" fill="none"/>
          ${fishEye(48, 14.5, 2)}`;
      case "koi":
        return `
          <path class="fin belly-fin" d="M22 23 C28 31 38 31 42 23 C36 28 28 28 22 23 Z"/>
          <path class="tail" d="M1 16 C6 6 12 5 15 12 L15 20 C12 27 6 26 1 16 Z"/>
          <path class="body shade" d="M14 16 C18 6 32 3 46 8 C54 12 56 17 52 22 C46 30 24 31 15 24 C12 21 12 18 14 16 Z"/>
          <path class="body" d="M14 16 C18 7 32 4 45 9 C53 13 55 17 51 21 C45 28 24 29 15 23 C12 20 12 17.5 14 16 Z"/>
          <path class="belly" d="M18 21 C32 28 46 26 50 19 C42 26 28 27 18 21 Z"/>
          <path class="fin" d="M28 7 C32 -2 40 -1 41 9 C36 5 31 6 28 7 Z"/>
          <circle class="spot" cx="26" cy="14" r="2.8" opacity="0.28"/>
          <circle class="spot" cx="36" cy="20" r="2.2" opacity="0.28"/>
          <path class="gill" d="M45 11 C47 16 47 20 45 24" fill="none"/>
          ${fishScales(22, 40, 16, 5)}
          ${fishEye(49, 12.5, 2)}`;
      case "carp":
        return `
          <path class="fin belly-fin" d="M24 22 C28 30 40 30 44 22 C36 28 28 28 24 22 Z"/>
          <path class="tail" d="M1 16 C6 7 12 6 15 12 L15 20 C12 26 6 25 1 16 Z"/>
          <path class="body shade" d="M14 16 C18 7 32 4 46 9 C54 13 56 18 51 22 C44 29 24 30 15 23 C12 20 12 17 14 16 Z"/>
          <path class="body" d="M14 16 C18 8 32 5 45 10 C53 14 55 18 50 21.5 C43 28 24 29 15 22.5 C12 19.5 12 17 14 16 Z"/>
          <path class="belly" d="M18 20 C32 28 46 26 50 18 C42 26 28 27 18 20 Z"/>
          <path class="fin" d="M28 8 C32 1 40 2 40 11 C35 7 30 8 28 8 Z"/>
          ${fishScales(22, 42, 16, 6)}
          <path class="gill" d="M46 11 C48 15 48 19 46 22" fill="none"/>
          ${fishEye(49, 13, 2.1)}`;
      case "panfish":
      case "perch":
        return `
          <path class="fin belly-fin" d="M22 23 C28 31 38 31 42 23 C36 28 28 28 22 23 Z"/>
          <path class="tail" d="M2 16 C7 7 12 6 15 12 L15 20 C12 26 7 25 2 16 Z"/>
          <path class="body shade" d="M14 16 C18 5 32 2 46 8 C54 12 55 17 51 22 C45 30 24 31 15 24 C12 21 12 18 14 16 Z"/>
          <path class="body" d="M14 16 C18 6 32 3 45 9 C53 13 54 17 50 21 C44 28 24 29 15 23 C12 20 12 17.5 14 16 Z"/>
          <path class="belly" d="M18 21 C30 28 44 27 49 19 C40 26 26 27 18 21 Z"/>
          <path class="fin" d="M30 6 C34 -3 42 -1 42 10 C37 5 32 6 30 6 Z"/>
          <path class="stripe" d="M24 10 V22 M30 9 V23 M36 10 V22" opacity="0.2"/>
          <path class="gill" d="M44 10 C46 15 46 20 44 24" fill="none"/>
          ${fishScales(22, 40, 16, 5)}
          ${fishEye(48, 12, 2.2)}`;
      case "bass":
        return `
          <path class="fin belly-fin" d="M24 22 C28 30 38 30 42 22 C34 28 28 28 24 22 Z"/>
          <path class="tail" d="M2 16 C7 7 12 6 15 12 L15 20 C12 26 7 25 2 16 Z"/>
          <path class="body shade" d="M14 16 C18 7 30 4 44 9 C52 13 54 18 50 22 C44 29 24 30 15 23 C12 20 12 17 14 16 Z"/>
          <path class="body" d="M14 16 C18 8 30 5 43 10 C51 14 53 18 49 21.5 C43 28 24 29 15 22.5 C12 19.5 12 17 14 16 Z"/>
          <path class="belly" d="M18 20 C30 27 44 26 49 18 C40 25 26 26 18 20 Z"/>
          <path class="fin" d="M28 8 C32 0 40 1 40 11 C35 7 30 8 28 8 Z"/>
          <path class="stripe" d="M22 16 L46 16" stroke-width="2.2" opacity="0.4"/>
          <path class="gill" d="M45 11 C47 15 47 19 45 22" fill="none"/>
          ${fishEye(49, 13, 2.2)}`;
      case "grouper":
        return `
          <path class="fin belly-fin" d="M22 22 C28 32 42 32 46 22 C36 30 28 30 22 22 Z"/>
          <path class="tail" d="M2 16 C7 8 12 7 15 12 L15 20 C12 25 7 24 2 16 Z"/>
          <path class="body shade" d="M14 16 C18 6 32 3 46 9 C54 13 56 19 50 23 C42 31 22 31 15 24 C12 21 12 17 14 16 Z"/>
          <path class="body" d="M14 16 C18 7 32 4 45 10 C53 14 55 19 49 22.5 C41 29.5 22 29.5 15 23.5 C12 20.5 12 17 14 16 Z"/>
          <path class="belly" d="M18 21 C32 29 46 28 50 19 C42 27 28 28 18 21 Z"/>
          <path class="fin" d="M28 7 C34 -1 42 1 41 12 C36 7 30 8 28 7 Z"/>
          <circle class="spot" cx="28" cy="14" r="2" fill="currentColor" opacity="0.3"/>
          <circle class="spot" cx="36" cy="18" r="2.3" fill="currentColor" opacity="0.28"/>
          <circle class="spot" cx="42" cy="13" r="1.7" fill="currentColor" opacity="0.3"/>
          ${fishEye(49, 13.5, 2.3)}`;
      case "trout":
        return `
          <path class="fin belly-fin" d="M26 21 C30 27 38 27 42 21 C36 25 30 25 26 21 Z"/>
          <path class="tail" d="M1 16 C6 7 12 6 15 12 L15 20 C12 26 6 25 1 16 Z"/>
          <path class="body shade" d="M14 16 C18 7 32 5 46 9 C54 12 56 17 52 21 C46 28 26 29 15 23 C12 20 12 17.5 14 16 Z"/>
          <path class="body" d="M14 16 C18 8 32 6 45 10 C53 13 55 17 51 20 C45 26.5 26 27.5 15 22 C12 19.5 12 17.5 14 16 Z"/>
          <path class="belly" d="M18 20 C32 26 46 24 50 18 C42 24 28 25 18 20 Z"/>
          <path class="fin" d="M30 8 C34 1 40 1 41 10 C37 7 32 7 30 8 Z"/>
          <circle class="spot" cx="24" cy="14" r="1.15"/>
          <circle class="spot" cx="30" cy="18" r="1"/>
          <circle class="spot" cx="36" cy="13" r="1.15"/>
          <circle class="spot" cx="40" cy="17" r="0.9"/>
          <path class="gill" d="M45 11 C47 15 47 19 45 22" fill="none"/>
          ${fishEye(49, 13, 2)}`;
      case "mahi":
        return `
          <path class="fin belly-fin" d="M22 22 C28 30 40 30 44 22 C36 28 28 28 22 22 Z"/>
          <path class="tail" d="M1 16 C7 3 14 2 16 12 L14 16 L16 20 C14 30 7 29 1 16 Z"/>
          <path class="body shade" d="M14 16 C18 5 32 1 46 7 C54 11 56 17 50 23 C42 31 22 31 14 22 C11 19 12 17 14 16 Z"/>
          <path class="body" d="M14 16 C18 6 32 2 45 8 C53 12 55 17 49 22 C41 29 22 29.5 14 21 C11 18.5 12 17 14 16 Z"/>
          <path class="belly" d="M18 21 C32 29 46 27 50 19 C40 27 26 28 18 21 Z"/>
          <path class="fin" d="M26 6 C32 -4 42 -1 42 11 C36 5 30 6 26 6 Z"/>
          <path class="gill" d="M45 10 C47 15 47 20 45 24" fill="none"/>
          ${fishScales(22, 40, 16, 5)}
          ${fishEye(48, 12, 2)}`;
      case "cod":
        return `
          <path class="fin belly-fin" d="M24 22 C28 28 38 28 42 22 C36 26 28 26 24 22 Z"/>
          <path class="tail" d="M1 16 C6 8 12 7 15 12 L15 20 C12 25 6 24 1 16 Z"/>
          <path class="body shade" d="M14 17 C18 8 32 5 46 10 C54 13 56 18 52 22 C46 29 26 30 15 24 C12 21 12 18 14 17 Z"/>
          <path class="body" d="M14 17 C18 9 32 6 45 11 C53 14 55 18 51 21 C45 27.5 26 28.5 15 23 C12 20.5 12 18 14 17 Z"/>
          <path class="belly" d="M18 21 C32 27 46 26 50 19 C42 25 28 26 18 21 Z"/>
          <path class="fin" d="M28 10 C32 3 38 3 39 12 C35 9 30 9 28 10 Z"/>
          <path class="gill" d="M45 12 C47 16 47 20 45 23" fill="none"/>
          ${fishScales(22, 40, 16.5, 5)}
          ${fishEye(49, 14, 2)}`;
      case "sturgeon":
        return `
          <path class="fin belly-fin" d="M28 20 C32 25 42 25 46 20 C40 23 32 23 28 20 Z"/>
          <path class="tail" d="M1 14 C6 4 12 4 15 11 L12 16 L14 22 C10 28 4 24 1 14 Z"/>
          <path class="body shade" d="M14 16 C20 9 36 7 52 12 C58 14 60 18 56 20 C48 24 28 24 16 20 C13 18 12 17 14 16 Z"/>
          <path class="body" d="M14 16 C20 10 36 8 51 13 C57 15 59 18 55 19.5 C47 23 28 23 16 19.5 C13 18 12 17 14 16 Z"/>
          <path class="bill" d="M54 15 L63 16 L54 18.5 Z"/>
          <path class="stripe" d="M20 13 L50 13" stroke-width="1.1" opacity="0.45"/>
          <path class="stripe" d="M20 19 L50 19" stroke-width="1.1" opacity="0.45"/>
          ${fishEye(48, 13.5, 1.7)}`;
      case "slender":
        return `
          <path class="tail" d="M3 16 C7 10 11 9 14 13 L14 19 C11 23 7 22 3 16 Z"/>
          <path class="body shade" d="M14 16 C20 9 34 8 48 12 C54 14 56 17 54 19 C50 23 30 24 16 20 C13 18.5 12 17 14 16 Z"/>
          <path class="body" d="M14 16 C20 10 34 9 47 13 C53 15 55 17 53 18.5 C49 22 30 22.5 16 19.5 C13 18 12 17 14 16 Z"/>
          <path class="belly" d="M20 18.5 C32 22 46 21 52 17 C44 21 30 21.5 20 18.5 Z"/>
          <path class="fin" d="M32 11 C35 5 40 5 41 12 C37 10 34 10 32 11 Z"/>
          ${fishEye(50, 14, 1.6)}`;
      case "goby":
        return `
          <path class="fin belly-fin" d="M24 20 C28 26 36 26 40 20 C34 24 28 24 24 20 Z"/>
          <path class="tail" d="M4 16 C8 10 12 9 14 13 L14 19 C12 23 8 22 4 16 Z"/>
          <path class="body shade" d="M14 16 C18 10 30 8 44 12 C50 14 52 18 48 20 C42 24 24 24 15 20 C13 18 13 17 14 16 Z"/>
          <path class="body" d="M14 16 C18 11 30 9 43 13 C49 15 51 18 47 19.5 C41 23 24 23 15 19.5 C13 18 13 17 14 16 Z"/>
          <path class="fin" d="M26 10 C30 5 38 6 38 13 C33 10 28 11 26 10 Z"/>
          ${fishEye(46, 14, 1.8)}`;
      case "whale":
        return `
          <path class="fin belly-fin" d="M28 22 C34 30 44 29 48 22 C40 27 32 27 28 22 Z"/>
          <path class="tail" d="M1 16 C7 5 14 4 16 12 L13 16 L16 20 C14 28 7 27 1 16 Z"/>
          <path class="body shade" d="M15 17 C22 6 38 4 52 10 C58 13 60 18 56 22 C50 29 28 31 16 24 C12 21 12 18 15 17 Z"/>
          <path class="body" d="M15 17 C22 7 38 5 51 11 C57 14 59 18 55 21 C49 27.5 28 29 16 23 C12 20.5 12 18 15 17 Z"/>
          <path class="belly" d="M22 21 C36 29 50 27 54 20 C44 27 30 28 22 21 Z"/>
          ${fishEye(52, 14, 1.8)}`;
      case "leviathan":
        return `
          <path class="fin belly-fin" d="M24 23 C30 32 42 32 46 23 C38 29 30 29 24 23 Z"/>
          <path class="tail" d="M0 16 C6 3 13 2 15 12 L12 16 L15 20 C13 30 6 29 0 16 Z"/>
          <path class="body shade" d="M14 16 C20 5 34 3 48 9 C56 13 58 18 53 23 C46 31 24 32 15 24 C11 20 11 17 14 16 Z"/>
          <path class="body" d="M14 16 C20 6 34 4 47 10 C55 14 57 18 52 22 C45 29 24 30 15 23 C11 19.5 11 17 14 16 Z"/>
          <path class="belly" d="M18 21 C32 29 46 28 51 20 C42 28 28 28 18 21 Z"/>
          <path class="fin" d="M28 7 C34 -4 44 -1 42 12 C36 6 30 7 28 7 Z"/>
          <path class="gill" d="M46 10 C48 15 48 20 46 24" fill="none"/>
          ${fishEye(51, 13, 2.2)}`;
      case "moonfish":
        return `
          <path class="fin" d="M22 8 C18 1 26 1 30 8 C26 6 23 7 22 8 Z"/>
          <path class="fin" d="M22 24 C18 31 26 31 30 24 C26 26 23 25 22 24 Z"/>
          <path class="tail" d="M20 16 C12 10 8 11 7 16 C8 21 12 22 20 16 Z"/>
          <circle class="body shade" cx="34" cy="16.5" r="13.5"/>
          <circle class="body" cx="34" cy="16" r="13"/>
          <ellipse class="belly" cx="34" cy="20" rx="8" ry="5"/>
          <path class="gill" d="M40 10 C43 14 43 18 40 22" fill="none"/>
          ${fishEye(42, 13, 2)}`;
      case "dragonet":
        return `
          <path class="fin belly-fin" d="M22 22 C26 29 34 29 38 23 C32 26 26 26 22 22 Z"/>
          <path class="tail" d="M1 18 C6 8 12 7 15 14 L15 22 C12 28 6 27 1 18 Z"/>
          <path class="body shade" d="M14 18 C18 9 30 7 42 11 C50 14 52 19 48 23 C42 29 24 30 15 25 C12 22 12 19 14 18 Z"/>
          <path class="body" d="M14 18 C18 10 30 8 41 12 C49 15 51 19 47 22 C41 27.5 24 28.5 15 24 C12 21.5 12 19 14 18 Z"/>
          <path class="fin" d="M24 10 C28 -1 42 2 40 14 C34 8 28 9 24 10 Z"/>
          ${fishEye(46, 14.5, 2)}`;
      case "jellyfish":
        return `
          <path class="fin tentacle" d="M22 18 Q19 28 17 31"/>
          <path class="fin tentacle" d="M28 20 Q27 30 25 33"/>
          <path class="fin tentacle" d="M36 20 Q38 30 40 33"/>
          <path class="fin tentacle" d="M42 18 Q47 28 49 31"/>
          <ellipse class="body shade" cx="32" cy="12.5" rx="14.5" ry="10.5"/>
          <ellipse class="body" cx="32" cy="12" rx="14" ry="10"/>
          <ellipse class="belly" cx="32" cy="15" rx="9" ry="5" opacity="0.45"/>
          <ellipse class="shine" cx="28" cy="8" rx="5" ry="3"/>
          <circle class="eye" cx="27" cy="11" r="1.3" opacity="0.45"/>
          <circle class="eye" cx="37" cy="11" r="1.3" opacity="0.45"/>`;
      case "ghost":
        return `
          <path class="tail" d="M4 16 C9 8 14 7 16 13 L16 19 C14 25 9 24 4 16 Z" opacity="0.5"/>
          <ellipse class="body shade" cx="34" cy="16.5" rx="18.5" ry="9.5" opacity="0.55"/>
          <ellipse class="body" cx="34" cy="16" rx="18" ry="9" opacity="0.65"/>
          <ellipse class="belly" cx="34" cy="19" rx="11" ry="4" opacity="0.35"/>
          ${fishEye(47, 13, 2.3)}`;
      case "omega":
        return `
          <path class="fin belly-fin" d="M24 23 C30 33 42 33 46 23 C38 30 30 30 24 23 Z"/>
          <path class="tail" d="M0 16 C6 2 14 1 16 12 L13 16 L16 20 C14 31 6 30 0 16 Z"/>
          <path class="body shade" d="M14 16 C20 5 34 2 48 8 C56 12 58 18 53 23 C46 32 24 33 15 24 C11 20 11 17 14 16 Z"/>
          <path class="body" d="M14 16 C20 6 34 3 47 9 C55 13 57 18 52 22 C45 30 24 31 15 23 C11 19.5 11 17 14 16 Z"/>
          <path class="belly" d="M18 21 C32 30 46 28 51 20 C42 28 28 29 18 21 Z"/>
          <path class="fin" d="M28 6 C34 -5 46 -1 44 12 C38 5 31 6 28 6 Z"/>
          <path class="spot" d="M30 16 a5 5 0 1 0 0.1 0" fill="none"/>
          <path class="gill" d="M46 10 C48 15 48 20 46 24" fill="none"/>
          ${fishEye(50, 12, 2.3)}`;
      default:
        return `
          <path class="fin belly-fin" d="M26 22 C30 28 38 28 42 22 C36 26 30 26 26 22 Z"/>
          <path class="tail" d="M3 16 C8 8 13 7 16 12 L16 20 C13 25 8 24 3 16 Z"/>
          <path class="body shade" d="M15 16 C20 6 34 4 48 9 C55 12 57 17 53 21 C47 28 26 29 16 23 C13 20 13 17 15 16 Z"/>
          <path class="body" d="M15 16 C20 7 34 5 47 10 C54 13 56 17 52 20 C46 26.5 26 27.5 16 22 C13 19.5 13 17 15 16 Z"/>
          <path class="belly" d="M20 20 C32 26 46 25 50 18 C42 24 28 25 20 20 Z"/>
          <path class="fin" d="M30 8 C34 1 40 1 41 10 C37 7 32 7 30 8 Z"/>
          <path class="gill" d="M46 11 C48 15 48 19 46 22" fill="none"/>
          ${fishScales(24, 42, 15.5, 5)}
          ${fishEye(50, 13, 2.1)}`;
    }
  }

  function fishGlyphHtml(fish, entry, uid = "") {
    const id = typeof fish === "string" ? fish : fish?.id;
    const rarity = typeof fish === "string" ? fish : fish?.rarity;
    const shape = FISH_SHAPE[id] || "default";
    const look = fishLookProfile(id);
    const variant = normalizeVariant(entry?.variant);
    const shiny = !!entry?.shiny;
    const mutation = normalizeMutation(entry?.mutation);
    let tone = FISH_TINT[id] || rarityColor(rarity);
    if (variant === "silver") tone = "#c5ced6";
    else if (variant === "gold") tone = "#f0c14b";
    else if (variant === "diamond") tone = "#9adcf5";
    else if (variant === "rainbow") tone = "#ff8fab";
    if (mutation === "toxic") tone = "#65a30d";
    else if (mutation === "lava") tone = "#ea580c";
    else if (mutation === "neon") tone = "#22d3ee";
    const isToxic = mutation === "toxic";
    const isLava = mutation === "lava";
    const isNeon = mutation === "neon";
    const uidBit = String(uid || "")
      .replace(/[^a-z0-9]/gi, "")
      .slice(0, 8);
    const gid = `fg-${String(id || shape).replace(/[^a-z0-9]/gi, "")}${variant}${shiny ? "s" : ""}${mutation || ""}${uidBit}${Math.abs(
      Math.imul(
        [...`${id || shape}:${tone}:${variant}:${shiny}:${mutation}:${uidBit}`].reduce(
          (h, c) => (Math.imul(31, h) + c.charCodeAt(0)) | 0,
          7
        )
      )
    )
      .toString(36)
      .slice(0, 4)}`;
    const parts = fishGlyphParts(shape)
      .replace(/\bclass="body shade"/g, `class="body shade" fill="url(#${gid}-shade)"`)
      .replace(/\bclass="body"/g, `class="body" fill="url(#${gid}-body)"`)
      .replace(/\bclass="belly"/g, `class="belly" fill="url(#${gid}-belly)"`)
      .replace(/\bclass="fin belly-fin"/g, `class="fin belly-fin" fill="url(#${gid}-fin)"`)
      .replace(/\bclass="fin"/g, `class="fin" fill="url(#${gid}-fin)"`)
      .replace(/\bclass="tail"/g, `class="tail" fill="url(#${gid}-fin)"`)
      .replace(/\bclass="bill"/g, `class="bill" fill="url(#${gid}-fin)"`);
    const accents = fishGlyphAccents(look, gid);
    const mutationDetails = isToxic
      ? fishGlyphToxicDetails(gid)
      : isLava
        ? fishGlyphLavaDetails(gid)
        : isNeon
          ? fishGlyphNeonDetails(gid)
          : "";
    const extraClass = variantClassList(entry);
    let bodyStops;
    let bellyStops;
    let shadeStops;
    let finStops;
    if (isToxic) {
      bodyStops = `<stop offset="0%" stop-color="#a3e635"/>
          <stop offset="35%" stop-color="#4ade80" stop-opacity="0.95"/>
          <stop offset="70%" stop-color="#166534" stop-opacity="0.9"/>
          <stop offset="100%" stop-color="#052e16" stop-opacity="0.85"/>`;
      bellyStops = `<stop offset="0%" stop-color="#d9f99d" stop-opacity="0.45"/>
          <stop offset="55%" stop-color="#86efac" stop-opacity="0.35"/>
          <stop offset="100%" stop-color="#14532d" stop-opacity="0.55"/>`;
      shadeStops = `<stop offset="0%" stop-color="#022c22" stop-opacity="0.72"/>
          <stop offset="100%" stop-color="#3f6212" stop-opacity="0.35"/>`;
      finStops = `<stop offset="0%" stop-color="#bef264" stop-opacity="0.95"/>
          <stop offset="55%" stop-color="#22c55e" stop-opacity="0.85"/>
          <stop offset="100%" stop-color="#052e16" stop-opacity="0.55"/>`;
    } else if (isLava) {
      bodyStops = `<stop offset="0%" stop-color="#fdba74"/>
          <stop offset="30%" stop-color="#f97316" stop-opacity="0.98"/>
          <stop offset="65%" stop-color="#c2410c" stop-opacity="0.92"/>
          <stop offset="100%" stop-color="#431407" stop-opacity="0.9"/>`;
      bellyStops = `<stop offset="0%" stop-color="#fde68a" stop-opacity="0.55"/>
          <stop offset="55%" stop-color="#fb923c" stop-opacity="0.4"/>
          <stop offset="100%" stop-color="#7c2d12" stop-opacity="0.6"/>`;
      shadeStops = `<stop offset="0%" stop-color="#1c1917" stop-opacity="0.78"/>
          <stop offset="100%" stop-color="#9a3412" stop-opacity="0.4"/>`;
      finStops = `<stop offset="0%" stop-color="#fbbf24" stop-opacity="0.95"/>
          <stop offset="55%" stop-color="#ea580c" stop-opacity="0.88"/>
          <stop offset="100%" stop-color="#431407" stop-opacity="0.6"/>`;
    } else if (isNeon) {
      bodyStops = `<stop offset="0%" stop-color="#f0abfc"/>
          <stop offset="30%" stop-color="#22d3ee" stop-opacity="0.98"/>
          <stop offset="65%" stop-color="#7c3aed" stop-opacity="0.92"/>
          <stop offset="100%" stop-color="#1e1b4b" stop-opacity="0.9"/>`;
      bellyStops = `<stop offset="0%" stop-color="#e0f2fe" stop-opacity="0.55"/>
          <stop offset="55%" stop-color="#a5f3fc" stop-opacity="0.4"/>
          <stop offset="100%" stop-color="#4c1d95" stop-opacity="0.55"/>`;
      shadeStops = `<stop offset="0%" stop-color="#0f172a" stop-opacity="0.8"/>
          <stop offset="100%" stop-color="#6d28d9" stop-opacity="0.4"/>`;
      finStops = `<stop offset="0%" stop-color="#67e8f9" stop-opacity="0.98"/>
          <stop offset="55%" stop-color="#e879f9" stop-opacity="0.88"/>
          <stop offset="100%" stop-color="#312e81" stop-opacity="0.6"/>`;
    } else {
      bodyStops = `<stop offset="0%" stop-color="currentColor"/>
          <stop offset="55%" stop-color="currentColor" stop-opacity="0.92"/>
          <stop offset="100%" stop-color="#f7fbff" stop-opacity="${look.belly.toFixed(2)}"/>`;
      bellyStops = `<stop offset="0%" stop-color="#ffffff" stop-opacity="0.18"/>
          <stop offset="100%" stop-color="#ffffff" stop-opacity="${Math.min(0.65, look.belly + 0.12).toFixed(2)}"/>`;
      shadeStops = `<stop offset="0%" stop-color="#041018" stop-opacity="${look.shade.toFixed(2)}"/>
          <stop offset="100%" stop-color="currentColor" stop-opacity="0.2"/>`;
      finStops = `<stop offset="0%" stop-color="currentColor" stop-opacity="0.98"/>
          <stop offset="100%" stop-color="#031018" stop-opacity="0.35"/>`;
    }
    return `<svg class="fish-glyph shape-${shape} look-${look.mark} is-realistic ${extraClass}" viewBox="0 0 64 32" aria-hidden="true" style="color:${tone}" overflow="visible">
      <defs>
        <linearGradient id="${gid}-body" x1="0.15" y1="0" x2="0.2" y2="1">
          ${bodyStops}
        </linearGradient>
        <linearGradient id="${gid}-shade" x1="0" y1="0" x2="0" y2="1">
          ${shadeStops}
        </linearGradient>
        <linearGradient id="${gid}-belly" x1="0" y1="0" x2="0" y2="1">
          ${bellyStops}
        </linearGradient>
        <linearGradient id="${gid}-fin" x1="0" y1="0" x2="1" y2="1">
          ${finStops}
        </linearGradient>
      </defs>
      ${parts}
      ${accents}
      ${mutationDetails}
    </svg>`;
  }

  function pickBestCatchFish(entries) {
    const list = (Array.isArray(entries) ? entries : [entries])
      .map((e) => {
        if (e?.fish) return { fish: e.fish, entry: e.entry || e };
        if (e && !isTreasureItem(e)) return { fish: e, entry: null };
        return null;
      })
      .filter((x) => x && x.fish && !isTreasureItem(x.fish));
    if (!list.length) return null;
    return list.reduce((best, cur) =>
      catchScore(cur.fish, cur.entry) > catchScore(best.fish, best.entry) ? cur : best
    ).fish;
  }

  function clearCatchSilhouette() {
    if (!catchSilEl) return;
    catchSilEl.innerHTML = "";
    catchSilEl.className = "catch-sil";
    catchSilEl.removeAttribute("data-fish");
  }

  function showCatchSilhouette(fish, entry) {
    if (!catchSilEl) return;
    if (!fish || isTreasureItem(fish)) {
      const isLb = fish?.kind === "luckyblock";
      const glyph =
        fish?.kind === "luck" || fish?.blockType === "astral"
          ? "◇"
          : fish?.blockType === "zenith"
            ? "◆"
            : "▣";
      catchSilEl.innerHTML = `<span class="catch-sil-chest" aria-hidden="true">${glyph}</span>`;
      catchSilEl.className = `catch-sil is-treasure rarity-${
        isLb ? fish.blockType || "absolute" : fish?.kind || "money"
      }`;
      catchSilEl.dataset.fish = fish?.id || "chest";
      return;
    }
    catchSilEl.innerHTML = fishGlyphHtml(fish, entry);
    catchSilEl.className = `catch-sil rarity-${fish.rarity || "common"} ${variantClassList(entry)}`.trim();
    catchSilEl.dataset.fish = fish.id || "";
  }

  function rarityColor(rarity) {
    const map = {
      common: "#adb5bd",
      uncommon: "#69db7c",
      rare: "#74c0fc",
      epic: "#da77f2",
      legendary: "#fcc419",
      mythic: "#ff922b",
      secret: "#e599f7",
      divine: "#fff3bf",
      eternal: "#99e9f2",
      cosmic: "#b197fc",
      astral: "#66d9e8",
      singularity: "#ff6b9d",
      omega: "#ffe066",
      genesis: "#9af0d8",
      paradox: "#e040fb",
      infinity: "#18ffff",
      absolute: "#f8f9fa",
      transcendent: "#fb923c",
      nexus: "#a78bfa",
      voidborn: "#94a3b8",
      zenith: "#fbbf24",
      crown: "#fde047",
      origin: "#e2e8f0",
      aether: "#7dd3fc",
      radiant: "#fde68a",
      dusk: "#fb923c",
      apex: "#f472b6",
      sovereign: "#eab308",
      celestial: "#818cf8",
      primordial: "#4ade80",
      ultimate: "#fde047",
      exclusive: "#f0abfc"
    };
    return map[rarity] || "#a8e6df";
  }

  function catchHaulEmptyHtml(message) {
    return `<p class="catch-bay-empty" id="catch-bay-empty">${
      message || "Cast to catch a fish"
    }</p>`;
  }

  function catchHaulHtml(entries) {
    return `<div class="boat-haul-list">${entries
      .map(({ fish, val, perfect, treasure, stored, entry }) => {
        if (treasure || isTreasureItem(fish)) {
          const detail = stored === false ? "stash full" : treasureUseLabel(fish);
          const isLb = fish.kind === "luckyblock";
          const kindClass = isLb
            ? `treasure-luckyblock treasure-luckyblock-${fish.blockType || "absolute"}`
            : fish.kind === "luck"
              ? "treasure-luck"
              : "treasure-money";
          const glyph =
            fish.kind === "luck" || fish.blockType === "astral"
              ? "◇"
              : fish.blockType === "zenith"
                ? "◆"
                : "▣";
          const tag = isLb
            ? fish.blockType === "astral"
              ? "astral"
              : fish.blockType === "zenith"
                ? "zenith"
                : "absolute"
            : fish.kind === "luck"
              ? "luck"
              : "coin";
          return `<div class="boat-haul-item treasure ${kindClass}">
          <span class="boat-haul-glyph treasure-glyph" aria-hidden="true">${glyph}</span>
          <span class="boat-haul-meta">
            <span class="boat-haul-name">${fish.name}</span>
            <span class="boat-haul-val">${detail}</span>
          </span>
          <span class="boat-haul-tag">${tag}</span>
        </div>`;
        }
        const title = formatVariantTitle(entry);
        const tagBits = [title, perfect ? "★ perfect" : "", fish.rarity].filter(Boolean);
        const vMult = variantValueMult(entry);
        const multTip = vMult > 1 ? ` · ×${formatMult(vMult)}` : "";
        return `<div class="boat-haul-item ${fish.rarity} ${variantClassList(entry)}">
          <span class="boat-haul-glyph" aria-hidden="true">${fishGlyphHtml(fish, entry)}</span>
          <span class="boat-haul-meta">
            <span class="boat-haul-name">${formatFishName(fish, entry)}</span>
            <span class="boat-haul-val">${formatNum(val)}${multTip} · ${tagBits.join(" · ")}</span>
          </span>
          <span class="boat-haul-tag">${title || fish.rarity}</span>
        </div>`;
      })
      .join("")}</div>`;
  }

  function hideCatchCard(message) {
    if (!catchCardEl) return;
    catchCardEl.className = "catch-bay is-empty";
    const el = catchHaulEl || document.getElementById("catch-haul");
    if (el) el.innerHTML = catchHaulEmptyHtml(message);
  }

  function showCatchCard(entries) {
    const list = (Array.isArray(entries) ? entries : [entries]).filter((e) => e?.fish);
    if (!catchCardEl || !list.length) {
      hideCatchCard();
      return;
    }
    const best = list.reduce((a, b) => {
      const ar = isShowcaseRarity(a.fish.rarity);
      const br = isShowcaseRarity(b.fish.rarity);
      if (br && !ar) return b;
      if (ar && !br) return a;
      return (b.val || 0) >= (a.val || 0) ? b : a;
    }, list[0]);
    catchCardEl.className = `catch-bay rarity-${best.fish.rarity}`;
    const el = catchHaulEl || document.getElementById("catch-haul");
    if (el) el.innerHTML = catchHaulHtml(list);
  }

  function formatNum(n) {
    let v = Math.abs(Number(n) || 0);
    if (!Number.isFinite(v)) return "0";
    if (v < 1000) return String(Math.floor(v));
    let tier = 0;
    while (v >= 1000 && tier < SUFFIXES.length - 1) {
      v /= 1000;
      tier += 1;
    }
    const text = v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(1) : v.toFixed(2);
    return `${text.replace(/\.0+$/, "").replace(/(\.\d*[1-9])0+$/, "$1")}${SUFFIXES[tier]}`;
  }

  function formatLuckAmt(n) {
    const v = Number(n) || 0;
    if (!Number.isFinite(v) || v <= 0) return "0";
    if (v >= 1000) return formatNum(v);
    if (v < 0.000001) return (Math.round(v * 1e7) / 1e7).toFixed(7);
    if (v < 0.00001) return (Math.round(v * 1e6) / 1e6).toFixed(6);
    if (v < 0.0001) return (Math.round(v * 100000) / 100000).toFixed(5);
    if (v < 0.001) return (Math.round(v * 10000) / 10000).toFixed(4);
    if (v < 0.01) return (Math.round(v * 1000) / 1000).toFixed(3);
    const rounded = Math.round(v * 100) / 100;
    if (v < 1) return rounded.toFixed(2);
    if (Math.abs(rounded - Math.round(rounded)) < 1e-9) return String(Math.round(rounded));
    return String(rounded);
  }

  function addCoins(amount) {
    if (amount <= 0) return;
    state.coins += amount;
    state.lifetime += amount;
    checkAchievements();
  }

  function playerHasMasterFisherTitle() {
    try {
      const name = String(
        window.HubPlays?.getName?.() || localStorage.getItem("hub-player-name") || ""
      ).trim();
      if (!name) return false;
      if (window.HubPlays?.isMasterFisherName?.(name)) return true;
      const titles = window.HubPlays?.getAvailableTitleIds?.(name) || [];
      if (titles.includes("master_fisher")) return true;
      if (window.HubAchievements?.isUnlocked?.("fishing_all")) return true;
    } catch {}
    return false;
  }

  /** Coin/luck chest stash: 25 default, 100 with MASTER FISHER. */
  function treasureStashMax() {
    return playerHasMasterFisherTitle() ? TREASURE_STASH_MAX_MASTER : TREASURE_STASH_MAX;
  }

  /** Soft earn cap only — admin overflow is kept (hard max still applies). */
  function clampTreasureStashCounts(save = false) {
    const hard = TREASURE_STASH_HARD_MAX;
    const money = Math.max(0, Math.floor(Number(state.moneyChestCount) || 0));
    const luck = Math.max(0, Math.floor(Number(state.luckChestCount) || 0));
    const nextMoney = Math.min(hard, money);
    const nextLuck = Math.min(hard, luck);
    if (nextMoney === money && nextLuck === luck) return false;
    state.moneyChestCount = nextMoney;
    state.luckChestCount = nextLuck;
    if (save) saveState();
    return true;
  }

  /* ========== DAILY / WEEKLY OBJECTIVES ========== */
  const QUEST_DIFFICULTIES = ["easy", "medium", "hard", "impossible"];
  /** Bump to force re-roll when objective layout changes. */
  const QUEST_LAYOUT_VERSION = 4;

  const QUEST_DAILY_POOL = [
    // Easy
    {
      id: "d_e_perfect3",
      difficulty: "easy",
      kind: "perfect",
      target: 3,
      label: "Land 3 perfect reels",
      reward: { coins: 400 }
    },
    {
      id: "d_e_catch15",
      difficulty: "easy",
      kind: "catch",
      target: 15,
      label: "Catch 15 fish",
      reward: { coins: 350 }
    },
    {
      id: "d_e_sell20",
      difficulty: "easy",
      kind: "sell",
      target: 20,
      label: "Sell 20 fish",
      reward: { coins: 400 }
    },
    {
      id: "d_e_manual10",
      difficulty: "easy",
      kind: "catch",
      manualOnly: true,
      target: 10,
      label: "Reel in 10 fish by hand",
      reward: { coins: 375 }
    },
    {
      id: "d_e_chest1",
      difficulty: "easy",
      kind: "chest",
      target: 1,
      label: "Open 1 chest from your stash",
      reward: { coins: 400, moneyChest: 1, luckChest: 1 }
    },
    // Medium
    {
      id: "d_m_perfect6",
      difficulty: "medium",
      kind: "perfect",
      target: 6,
      label: "Land 6 perfect reels",
      reward: { coins: 900, luckChest: 1 }
    },
    {
      id: "d_m_sell_epic10",
      difficulty: "medium",
      kind: "sell",
      rarity: "epic",
      target: 10,
      label: "Sell 10 epic fish",
      reward: { coins: 1000, moneyChest: 1 }
    },
    {
      id: "d_m_sell_rare18",
      difficulty: "medium",
      kind: "sell",
      minRank: 3,
      target: 18,
      label: "Sell 18 rare-or-better fish",
      reward: { coins: 850, luckChest: 1 }
    },
    {
      id: "d_m_chest_event",
      difficulty: "medium",
      kind: "chest",
      target: 2,
      label: "Open 2 chests from your stash",
      reward: { coins: 800, moneyChest: 1, luckChest: 1 }
    },
    {
      id: "d_m_catch_leg4",
      difficulty: "medium",
      kind: "catch",
      minRank: 5,
      target: 4,
      label: "Catch 4 legendary-or-better fish",
      reward: { coins: 1100 }
    },
    {
      id: "d_m_manual20",
      difficulty: "medium",
      kind: "catch",
      manualOnly: true,
      target: 20,
      label: "Reel in 20 fish by hand",
      reward: { coins: 800 }
    },
    // Hard
    {
      id: "d_h_perfect12",
      difficulty: "hard",
      kind: "perfect",
      target: 12,
      label: "Land 12 perfect reels",
      reward: { coins: 2000, luckChest: 1, moneyChest: 1 }
    },
    {
      id: "d_h_sell_epic20",
      difficulty: "hard",
      kind: "sell",
      rarity: "epic",
      target: 20,
      label: "Sell 20 epic fish",
      reward: { coins: 2200, moneyChest: 2 }
    },
    {
      id: "d_h_catch_leg8",
      difficulty: "hard",
      kind: "catch",
      minRank: 5,
      target: 8,
      label: "Catch 8 legendary-or-better fish",
      reward: { coins: 2500, luckChest: 1 }
    },
    {
      id: "d_h_chest_event2",
      difficulty: "hard",
      kind: "chest",
      target: 3,
      label: "Open 3 chests from your stash",
      reward: { coins: 2000, moneyChest: 2, luckChest: 2 }
    },
    {
      id: "d_h_manual35",
      difficulty: "hard",
      kind: "catch",
      manualOnly: true,
      target: 35,
      label: "Reel in 35 fish by hand",
      reward: { coins: 1800, moneyChest: 1 }
    },
    {
      id: "d_h_sell_mythic5",
      difficulty: "hard",
      kind: "sell",
      minRank: 6,
      target: 5,
      label: "Sell 5 mythic-or-better fish",
      reward: { coins: 2800, luckChest: 2 }
    },
    // Impossible
    {
      id: "d_i_perfect25",
      difficulty: "impossible",
      kind: "perfect",
      target: 25,
      label: "Land 25 perfect reels",
      reward: { coins: 8000, moneyChest: 3, luckChest: 2 }
    },
    {
      id: "d_i_sell_epic40",
      difficulty: "impossible",
      kind: "sell",
      rarity: "epic",
      target: 40,
      label: "Sell 40 epic fish",
      reward: { coins: 9000, moneyChest: 3, luckChest: 2 }
    },
    {
      id: "d_i_catch_leg15",
      difficulty: "impossible",
      kind: "catch",
      minRank: 5,
      target: 15,
      label: "Catch 15 legendary-or-better fish",
      reward: { coins: 10000, luckChest: 3 }
    },
    {
      id: "d_i_chest_event4",
      difficulty: "impossible",
      kind: "chest",
      target: 5,
      label: "Open 5 chests from your stash",
      reward: { coins: 8000, moneyChest: 5, luckChest: 4 }
    },
    {
      id: "d_i_manual60",
      difficulty: "impossible",
      kind: "catch",
      manualOnly: true,
      target: 60,
      label: "Reel in 60 fish by hand",
      reward: { coins: 7500, moneyChest: 2, luckChest: 2 }
    },
    {
      id: "d_i_sell_mythic12",
      difficulty: "impossible",
      kind: "sell",
      minRank: 6,
      target: 12,
      label: "Sell 12 mythic-or-better fish",
      reward: { coins: 12000, luckChest: 4, moneyChest: 2 }
    }
  ];

  const QUEST_WEEKLY_POOL = [
    // Easy
    {
      id: "w_e_catch100",
      difficulty: "easy",
      kind: "catch",
      target: 200,
      label: "Catch 200 fish",
      reward: { coins: 5500, moneyChest: 1 }
    },
    {
      id: "w_e_sell120",
      difficulty: "easy",
      kind: "sell",
      target: 250,
      label: "Sell 250 fish",
      reward: { coins: 6000, moneyChest: 1 }
    },
    {
      id: "w_e_perfect15",
      difficulty: "easy",
      kind: "perfect",
      target: 30,
      label: "Land 30 perfect reels",
      reward: { coins: 7000, luckChest: 1 }
    },
    {
      id: "w_e_manual40",
      difficulty: "easy",
      kind: "catch",
      manualOnly: true,
      target: 80,
      label: "Reel in 80 fish by hand",
      reward: { coins: 6500, moneyChest: 1 }
    },
    // Medium
    {
      id: "w_m_perfect25",
      difficulty: "medium",
      kind: "perfect",
      target: 50,
      label: "Land 50 perfect reels",
      reward: { coins: 12000, moneyChest: 2, luckChest: 1 }
    },
    {
      id: "w_m_sell_epic40",
      difficulty: "medium",
      kind: "sell",
      rarity: "epic",
      target: 75,
      label: "Sell 75 epic fish",
      reward: { coins: 11000, luckChest: 2 }
    },
    {
      id: "w_m_catch150",
      difficulty: "medium",
      kind: "catch",
      target: 300,
      label: "Catch 300 fish",
      reward: { coins: 10000, moneyChest: 2, luckChest: 1 }
    },
    {
      id: "w_m_chest_event2",
      difficulty: "medium",
      kind: "chest",
      target: 5,
      label: "Open 5 chests from your stash",
      reward: { coins: 11000, moneyChest: 3, luckChest: 3 }
    },
    {
      id: "w_m_manual70",
      difficulty: "medium",
      kind: "catch",
      manualOnly: true,
      target: 140,
      label: "Reel in 140 fish by hand",
      reward: { coins: 11500, luckChest: 2 }
    },
    // Hard
    {
      id: "w_h_perfect40",
      difficulty: "hard",
      kind: "perfect",
      target: 80,
      label: "Land 80 perfect reels",
      reward: { coins: 22000, moneyChest: 4 }
    },
    {
      id: "w_h_sell_epic50",
      difficulty: "hard",
      kind: "sell",
      rarity: "epic",
      target: 100,
      label: "Sell 100 epic fish",
      reward: { coins: 20000, luckChest: 3, moneyChest: 2 }
    },
    {
      id: "w_h_sell_leg20",
      difficulty: "hard",
      kind: "sell",
      minRank: 5,
      target: 40,
      label: "Sell 40 legendary-or-better fish",
      reward: { coins: 25000, luckChest: 3, moneyChest: 2 }
    },
    {
      id: "w_h_chest_event3",
      difficulty: "hard",
      kind: "chest",
      target: 8,
      label: "Open 8 chests from your stash",
      reward: { coins: 22000, moneyChest: 5, luckChest: 5 }
    },
    {
      id: "w_h_catch250",
      difficulty: "hard",
      kind: "catch",
      target: 500,
      label: "Catch 500 fish",
      reward: { coins: 18000, moneyChest: 3, luckChest: 2 }
    },
    {
      id: "w_h_manual100",
      difficulty: "hard",
      kind: "catch",
      manualOnly: true,
      target: 200,
      label: "Reel in 200 fish by hand",
      reward: { coins: 21000, luckChest: 3, moneyChest: 1 }
    },
    // Impossible
    {
      id: "w_i_perfect150",
      difficulty: "impossible",
      kind: "perfect",
      target: 150,
      label: "Land 150 perfect reels",
      reward: { coins: 50000, moneyChest: 6, luckChest: 4 }
    },
    {
      id: "w_i_sell_epic200",
      difficulty: "impossible",
      kind: "sell",
      rarity: "epic",
      target: 200,
      label: "Sell 200 epic fish",
      reward: { coins: 45000, luckChest: 5, moneyChest: 4 }
    },
    {
      id: "w_i_sell_leg80",
      difficulty: "impossible",
      kind: "sell",
      minRank: 5,
      target: 80,
      label: "Sell 80 legendary-or-better fish",
      reward: { coins: 55000, luckChest: 5, moneyChest: 5 }
    },
    {
      id: "w_i_chest_event12",
      difficulty: "impossible",
      kind: "chest",
      target: 12,
      label: "Open 12 chests from your stash",
      reward: { coins: 50000, moneyChest: 10, luckChest: 8 }
    },
    {
      id: "w_i_catch1000",
      difficulty: "impossible",
      kind: "catch",
      target: 1000,
      label: "Catch 1000 fish",
      reward: { coins: 40000, moneyChest: 5, luckChest: 3 }
    },
    {
      id: "w_i_manual400",
      difficulty: "impossible",
      kind: "catch",
      manualOnly: true,
      target: 400,
      label: "Reel in 400 fish by hand",
      reward: { coins: 48000, luckChest: 5, moneyChest: 3 }
    },
    {
      id: "w_i_sell_mythic30",
      difficulty: "impossible",
      kind: "sell",
      minRank: 6,
      target: 30,
      label: "Sell 30 mythic-or-better fish",
      reward: { coins: 60000, luckChest: 6, moneyChest: 4 }
    }
  ];

  const QUEST_POOL_BY_ID = Object.create(null);
  QUEST_DAILY_POOL.forEach((q) => {
    QUEST_POOL_BY_ID[q.id] = q;
  });
  QUEST_WEEKLY_POOL.forEach((q) => {
    QUEST_POOL_BY_ID[q.id] = q;
  });

  function emptyQuestsState() {
    return { dailyKey: "", weeklyKey: "", layoutVersion: 0, daily: [], weekly: [] };
  }

  function questDef(id) {
    return QUEST_POOL_BY_ID[id] || null;
  }

  function questDifficultyLabel(diff) {
    if (diff === "easy") return "Easy";
    if (diff === "hard") return "Hard";
    if (diff === "impossible") return "Impossible";
    return "Medium";
  }

  function pad2(n) {
    return String(n).padStart(2, "0");
  }

  function localDateKey(d = new Date()) {
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  }

  /** Saturday-based week id (resets Fri→Sat at local midnight). */
  function localWeekKey(d = new Date()) {
    const day = d.getDay();
    const diff = (day + 1) % 7; // days since Saturday
    const saturday = new Date(d.getFullYear(), d.getMonth(), d.getDate() - diff);
    return localDateKey(saturday);
  }

  function msUntilLocalMidnight(now = Date.now()) {
    const d = new Date(now);
    const next = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
    return Math.max(0, next.getTime() - now);
  }

  /** Next weekly reset: Saturday 00:00 local (between Friday and Saturday). */
  function msUntilNextWeeklyReset(now = Date.now()) {
    const d = new Date(now);
    const day = d.getDay();
    const daysUntil = day === 6 ? 7 : (6 - day + 7) % 7;
    const next = new Date(d.getFullYear(), d.getMonth(), d.getDate() + daysUntil);
    return Math.max(0, next.getTime() - now);
  }

  function hashSeed(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i += 1) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function seededPick(pool, seedStr, count) {
    const a = pool.slice();
    let s = hashSeed(seedStr);
    for (let i = a.length - 1; i > 0; i -= 1) {
      s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
      const j = s % (i + 1);
      const tmp = a[i];
      a[i] = a[j];
      a[j] = tmp;
    }
    return a.slice(0, Math.min(count, a.length)).map((def) => ({
      id: def.id,
      progress: 0,
      claimed: false
    }));
  }

  /** One easy + one medium + one hard. */
  function seededPickTiers(pool, seedStr) {
    return QUEST_DIFFICULTIES.map((diff) => {
      const subset = pool.filter((q) => q.difficulty === diff);
      const picked = seededPick(subset, `${seedStr}:${diff}`, 1);
      return picked[0] || null;
    }).filter(Boolean);
  }

  function questListHasTiers(list) {
    const have = new Set();
    (list || []).forEach((q) => {
      const d = questDef(q.id)?.difficulty;
      if (d) have.add(d);
    });
    return QUEST_DIFFICULTIES.every((d) => have.has(d));
  }

  function normalizeQuestEntry(raw) {
    if (!raw || typeof raw !== "object") return null;
    const id = String(raw.id || "");
    if (!questDef(id)) return null;
    return {
      id,
      progress: Math.max(0, Math.floor(Number(raw.progress) || 0)),
      claimed: !!raw.claimed
    };
  }

  function normalizeQuestsState(raw) {
    const next = emptyQuestsState();
    if (!raw || typeof raw !== "object") return next;
    next.dailyKey = typeof raw.dailyKey === "string" ? raw.dailyKey : "";
    next.weeklyKey = typeof raw.weeklyKey === "string" ? raw.weeklyKey : "";
    next.layoutVersion = Math.max(0, Math.floor(Number(raw.layoutVersion) || 0));
    next.daily = Array.isArray(raw.daily)
      ? raw.daily.map(normalizeQuestEntry).filter(Boolean)
      : [];
    next.weekly = Array.isArray(raw.weekly)
      ? raw.weekly.map(normalizeQuestEntry).filter(Boolean)
      : [];
    return next;
  }

  function ensureQuestsFresh() {
    if (!state.quests || typeof state.quests !== "object") {
      state.quests = emptyQuestsState();
    }
    const dayKey = localDateKey();
    const weekKey = localWeekKey();
    let changed = false;
    const layoutStale = state.quests.layoutVersion !== QUEST_LAYOUT_VERSION;
    if (
      layoutStale ||
      state.quests.dailyKey !== dayKey ||
      !state.quests.daily?.length ||
      !questListHasTiers(state.quests.daily)
    ) {
      state.quests.dailyKey = dayKey;
      state.quests.daily = seededPickTiers(QUEST_DAILY_POOL, `daily:${dayKey}`);
      changed = true;
    }
    if (
      layoutStale ||
      state.quests.weeklyKey !== weekKey ||
      !state.quests.weekly?.length ||
      !questListHasTiers(state.quests.weekly)
    ) {
      state.quests.weeklyKey = weekKey;
      state.quests.weekly = seededPickTiers(QUEST_WEEKLY_POOL, `weekly:${weekKey}`);
      changed = true;
    }
    if (layoutStale) {
      state.quests.layoutVersion = QUEST_LAYOUT_VERSION;
      changed = true;
    }
    return changed;
  }

  function questMatches(def, kind, extra = {}) {
    if (!def || def.kind !== kind) return false;
    if (def.rarity && extra.rarity !== def.rarity) return false;
    if (def.minRank != null) {
      const rank = RARITY_RANK[extra.rarity] || 0;
      if (rank < def.minRank) return false;
    }
    if (def.duringEvent && !extra.duringEvent) return false;
    if (def.manualOnly && extra.forBoat) return false;
    return true;
  }

  function noteQuestProgress(kind, amount = 1, extra = {}) {
    if (!amount) return;
    ensureQuestsFresh();
    const n = Math.max(0, Math.floor(Number(amount) || 0));
    if (!n) return;
    let changed = false;
    ["daily", "weekly"].forEach((period) => {
      (state.quests[period] || []).forEach((q) => {
        if (!q || q.claimed) return;
        const def = questDef(q.id);
        if (!questMatches(def, kind, extra)) return;
        const before = q.progress || 0;
        q.progress = Math.min(def.target, before + n);
        if (q.progress !== before) changed = true;
      });
    });
    if (changed) saveSoon();
  }

  function formatChestCountLabel(n, kind) {
    const count = Math.max(0, Math.floor(Number(n) || 0));
    const name = kind === "luck" ? "Luck Chest" : "Coin Chest";
    if (count === 1) return `1 ${name}`;
    return `${count} ${name}s`;
  }

  function formatQuestReward(def) {
    const bits = [];
    const r = def.reward || {};
    if (r.coins) bits.push(`${formatNum(r.coins)} coins`);
    if (r.moneyChest) bits.push(formatChestCountLabel(r.moneyChest, "money"));
    if (r.luckChest) bits.push(formatChestCountLabel(r.luckChest, "luck"));
    return bits.join(" · ") || "Reward";
  }

  function grantQuestChests(kind, count) {
    const key = chestCountKey(kind);
    const max = treasureStashMax();
    const n = Math.max(0, Math.floor(Number(count) || 0));
    let added = 0;
    for (let i = 0; i < n; i += 1) {
      if ((Number(state[key]) || 0) >= max) break;
      state[key] = (Number(state[key]) || 0) + 1;
      added += 1;
    }
    return added;
  }

  function claimQuest(period, id) {
    ensureQuestsFresh();
    if (period !== "daily" && period !== "weekly") return;
    const q = (state.quests[period] || []).find((x) => x.id === id);
    const def = questDef(id);
    if (!q || !def || q.claimed || (q.progress || 0) < def.target) return;
    ensureSession();
    q.claimed = true;
    const r = def.reward || {};
    const bits = [];
    if (r.coins) {
      addCoins(r.coins);
      bits.push(`${formatNum(r.coins)} coins`);
    }
    if (r.moneyChest) {
      const n = grantQuestChests("money", r.moneyChest);
      if (n) bits.push(formatChestCountLabel(n, "money"));
    }
    if (r.luckChest) {
      const n = grantQuestChests("luck", r.luckChest);
      if (n) bits.push(formatChestCountLabel(n, "luck"));
    }
    setCatchLine(
      bits.length ? `Objective claimed · ${bits.join(" · ")}` : "Objective claimed",
      "treasure"
    );
    playSfx("win");
    burstConfetti();
    renderTreasureStash();
    render(false);
    saveSoon();
  }

  function questRowHtml(period, q) {
    const def = questDef(q.id);
    if (!def) return "";
    const progress = Math.min(def.target, Math.max(0, q.progress || 0));
    const ready = !q.claimed && progress >= def.target;
    const pct = def.target > 0 ? Math.min(100, Math.round((100 * progress) / def.target)) : 0;
    const status = q.claimed ? "Claimed" : ready ? "Claim" : `${progress} / ${def.target}`;
    const diff = def.difficulty || "medium";
    return `<div class="quest-item quest-${diff}${ready ? " is-ready" : ""}${
      q.claimed ? " is-claimed" : ""
    }" role="listitem">
      <div class="quest-item-main">
        <div class="quest-item-top">
          <span class="quest-diff quest-diff-${diff}">${questDifficultyLabel(diff)}</span>
          <div class="quest-item-name">${def.label}</div>
        </div>
        <p class="quest-item-reward">${formatQuestReward(def)}</p>
        <div class="quest-item-bar" aria-hidden="true"><span style="width:${pct}%"></span></div>
        <div class="quest-item-progress">${progress} / ${def.target}</div>
      </div>
      <button type="button" class="quest-claim-btn" data-quest-claim="${period}" data-quest-id="${
      q.id
    }" ${ready ? "" : "disabled"}>${status}</button>
    </div>`;
  }

  function renderQuests() {
    if (!questList) return;
    ensureQuestsFresh();
    const dailyLeft = formatQuestResetClock(msUntilLocalMidnight());
    const weeklyLeft = formatQuestResetClock(msUntilNextWeeklyReset());
    questList.innerHTML = `
      <div class="quest-section-title">Daily</div>
      <div class="quest-section-meta">Resets in ${dailyLeft}</div>
      ${(state.quests.daily || []).map((q) => questRowHtml("daily", q)).join("")}
      <div class="quest-section-title">Weekly</div>
      <div class="quest-section-meta">Resets Sat 12:00 AM · ${weeklyLeft} left</div>
      ${(state.quests.weekly || []).map((q) => questRowHtml("weekly", q)).join("")}
    `;
  }
  /* ========== END OBJECTIVES ========== */

  function checkAchievements() {
    if (!window.HubAchievements) return;
    const life = state.lifetime;
    if (life >= 100) HubAchievements.unlock("fishing_100");
    if (life >= 1000) HubAchievements.unlock("fishing_1k");
    if (life >= 100000) HubAchievements.unlock("fishing_100k");
    if (life >= 1000000) HubAchievements.unlock("fishing_1m");
    if (boatLevel() >= 1) HubAchievements.unlock("fishing_fps_10");
    if (boatLevel() >= 3) HubAchievements.unlock("fishing_fps_100");
    if (state.unlocked.deep) HubAchievements.unlock("fishing_voyage_1");
    if (state.unlocked.void) HubAchievements.unlock("fishing_voyage_1");
    if (FISH.length > 0 && caughtCount("any", false, "") >= Math.ceil(FISH.length * COLLECTION_MASTER_PCT)) {
      const newly = HubAchievements.unlock("fishing_all");
      window.HubPlays?.markMasterFisher?.().catch?.(() => {});
      if (newly) {
        setTimeout(() => {
          setCatchLine("70% catch book — title unlocked: MASTER FISHER", "perfect");
        }, 900);
      }
    }
    if (hasCollectionLuckBonus() && !state.collectionLuckTold) {
      state.collectionLuckTold = true;
      saveSoon();
      setTimeout(() => {
        setCatchLine(
          `75% catch book — ${formatMult(COLLECTION_LUCK_MULT)}× luck forever`,
          "perfect"
        );
      }, 1100);
    }
    if (hasCollectionRainbowBonus() && !state.collectionRainbowTold) {
      state.collectionRainbowTold = true;
      saveSoon();
      setTimeout(() => {
        setCatchLine(
          `80% catch book — ${formatMult(COLLECTION_RAINBOW_MULT)}× rainbow chance`,
          "perfect"
        );
      }, 1300);
    }
    if (hasCollectionLbEventBonus() && !state.collectionLbEventTold) {
      state.collectionLbEventTold = true;
      saveSoon();
      setTimeout(() => {
        setCatchLine(
          `90% catch book — ${formatMult(COLLECTION_LB_EVENT_MULT)}× Lucky Blocks during events`,
          "perfect"
        );
      }, 1500);
    }
    if (hasCollectionLbAlwaysBonus() && !state.collectionLbAlwaysTold) {
      state.collectionLbAlwaysTold = true;
      saveSoon();
      setTimeout(() => {
        setCatchLine("100% catch book — Lucky Blocks can drop anytime", "perfect");
      }, 1700);
    }
  }

  function ensureSession() {
    if (sessionStarted) return;
    sessionStarted = true;
    window.HubStreak?.recordPlay?.();
    window.HubPlays?.record?.("fishing");
  }

  function spawnFloat(x, y, text) {
    if (!floatLayer) return;
    const el = document.createElement("span");
    el.className = "float-pop";
    el.textContent = text;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    floatLayer.appendChild(el);
    setTimeout(() => el.remove(), 700);
  }

  function setPhase(next) {
    phase = next;
    castBtn.classList.remove(
      "phase-ready",
      "phase-waiting",
      "phase-bite",
      "phase-result",
      "is-catch",
      "is-miss",
      "just-cast"
    );
    RARITIES.forEach((r) => castBtn.classList.remove(`rarity-${r}`));
    castBtn.classList.remove("rarity-treasure", "rarity-money", "rarity-luck");
    castBtn.classList.add(`phase-${next === "ready" ? "ready" : next}`);
    biteMeter?.classList.toggle("active", next === "bite");
    if (next === "ready") {
      castBtnText.textContent = "Cast";
      castBtn.disabled = false;
      // Keep last catch visible in the bay until the next cast
    } else if (next === "waiting") {
      castBtnText.textContent = "Cancel";
      castBtn.disabled = false;
      clearCatchSilhouette();
      hideCatchCard("Line is out…");
    } else if (next === "bite") {
      castBtnText.textContent = "Reel!";
      castBtn.disabled = false;
      hideCatchCard("Bite! Reel now");
    } else {
      castBtnText.textContent = "…";
      castBtn.disabled = true;
    }
  }

  function flashCastSplash() {
    castBtn.classList.remove("just-cast");
    void castBtn.offsetWidth;
    castBtn.classList.add("just-cast");
    setTimeout(() => castBtn.classList.remove("just-cast"), 700);
  }

  function clearTimers() {
    if (waitTimer) clearTimeout(waitTimer);
    if (biteTimer) clearTimeout(biteTimer);
    waitTimer = null;
    biteTimer = null;
  }

  function rarityFactor(rarity, spotRarity) {
    // Worse spots (low rarity) favor commons; better spots open up rares+.
    // Higher tiers always start lower than the tier below them.
    const t = Math.max(0, Math.min(MAX_SPOT_RARITY, Number(spotRarity) || 0)) / MAX_SPOT_RARITY;
    if (rarity === "common") return 0.72 - t * 0.22;
    if (rarity === "uncommon") return 0.7 + t * 0.12;
    if (rarity === "rare") return 0.42 + t * 0.28;
    if (rarity === "epic") return 0.48 + t * 0.42;
    if (rarity === "legendary") return 0.34 + t * 0.42;
    if (rarity === "mythic") return 0.22 + t * 0.42;
    if (rarity === "secret") return 0.12 + t * 0.38;
    if (rarity === "divine") return 0.09 + t * 0.36;
    if (rarity === "eternal") return 0.065 + t * 0.34;
    if (rarity === "cosmic") return 0.045 + t * 0.3;
    if (rarity === "astral") return 0.032 + t * 0.26;
    if (rarity === "singularity") return 0.022 + t * 0.22;
    if (rarity === "omega") return 0.016 + t * 0.2;
    if (rarity === "genesis") return 0.012 + t * 0.18;
    if (rarity === "paradox") return 0.009 + t * 0.16;
    if (rarity === "infinity") return 0.007 + t * 0.14;
    if (rarity === "absolute") return 0.0055 + t * 0.13;
    if (rarity === "transcendent") return 0.0042 + t * 0.12;
    if (rarity === "nexus") return 0.0032 + t * 0.11;
    if (rarity === "voidborn") return 0.0024 + t * 0.1;
    if (rarity === "zenith") return 0.0018 + t * 0.09;
    if (rarity === "crown") return 0.0014 + t * 0.082;
    if (rarity === "origin") return 0.0011 + t * 0.075;
    if (rarity === "aether") return 0.00085 + t * 0.068;
    if (rarity === "radiant") return 0.00065 + t * 0.062;
    if (rarity === "dusk") return 0.0005 + t * 0.056;
    if (rarity === "apex") return 0.00038 + t * 0.05;
    if (rarity === "sovereign") return 0.00028 + t * 0.045;
    if (rarity === "celestial") return 0.00021 + t * 0.04;
    if (rarity === "primordial") return 0.00015 + t * 0.036;
    if (rarity === "ultimate") return 0.00011 + t * 0.032;
    return 1;
  }

  const rarityValueBand = (() => {
    const map = {};
    FISH.forEach((f) => {
      if (!map[f.rarity]) map[f.rarity] = { min: f.value, max: f.value };
      else {
        map[f.rarity].min = Math.min(map[f.rarity].min, f.value);
        map[f.rarity].max = Math.max(map[f.rarity].max, f.value);
      }
    });
    return map;
  })();

  /** Within a rarity, higher-value fish are rarer. */
  function valueRarityScale(fish) {
    const band = rarityValueBand[fish.rarity];
    const value = Math.max(1, Number(fish.value) || 1);
    if (!band || band.max <= band.min) return 1;
    const t = (value - band.min) / (band.max - band.min); // 0 = cheapest, 1 = priciest
    // Cheapest ~1.35× share, priciest ~0.7× share within the rarity
    return 1.35 - t * 0.65;
  }

  function fishWeight(fish, spot, forBoat = false) {
    if (isExclusiveFish(fish)) return 0;
    const luck = baseLuck(spot);
    const boostMult = treasureLuckMult();
    let w = (RARITY_WEIGHT[fish.rarity] || 10) * rarityFactor(fish.rarity, spot.rarity);
    // Spot still matters, but high rarities are less crushed on early waters
    const t = Math.max(0, Math.min(MAX_SPOT_RARITY, Number(spot.rarity) || 0)) / MAX_SPOT_RARITY;
    if (fish.rarity === "rare") w *= 0.75 + t * 0.12;
    if (fish.rarity === "epic" || fish.rarity === "legendary") w *= 0.9 + t * 0.28;
    if (fish.rarity === "mythic") w *= 0.78 + t * 0.35;
    if (fish.rarity === "secret") w *= (0.65 + t * 0.4) * (forBoat ? 0.7 : 1);
    if (fish.rarity === "divine") w *= (0.58 + t * 0.42) * (forBoat ? 0.65 : 1);
    if (fish.rarity === "eternal") w *= (0.52 + t * 0.42) * (forBoat ? 0.55 : 1);
    if (fish.rarity === "cosmic") w *= (0.46 + t * 0.42) * (forBoat ? 0.45 : 1);
    if (fish.rarity === "astral") w *= (0.42 + t * 0.42) * (forBoat ? 0.4 : 1);
    if (fish.rarity === "singularity") w *= (0.38 + t * 0.42) * (forBoat ? 0.35 : 1);
    if (fish.rarity === "omega") w *= (0.34 + t * 0.42) * (forBoat ? 0.3 : 1);
    if (fish.rarity === "genesis") w *= (0.3 + t * 0.42) * (forBoat ? 0.28 : 1);
    if (fish.rarity === "paradox") w *= (0.27 + t * 0.42) * (forBoat ? 0.25 : 1);
    if (fish.rarity === "infinity") w *= (0.24 + t * 0.42) * (forBoat ? 0.22 : 1);
    if (fish.rarity === "absolute") w *= (0.22 + t * 0.42) * (forBoat ? 0.2 : 1);
    if (fish.rarity === "transcendent") w *= (0.2 + t * 0.4) * (forBoat ? 0.18 : 1);
    if (fish.rarity === "nexus") w *= (0.175 + t * 0.4) * (forBoat ? 0.16 : 1);
    if (fish.rarity === "voidborn") w *= (0.15 + t * 0.38) * (forBoat ? 0.14 : 1);
    if (fish.rarity === "zenith") w *= (0.13 + t * 0.36) * (forBoat ? 0.12 : 1);
    if (fish.rarity === "crown") w *= (0.115 + t * 0.34) * (forBoat ? 0.11 : 1);
    if (fish.rarity === "origin") w *= (0.1 + t * 0.32) * (forBoat ? 0.1 : 1);
    if (fish.rarity === "aether") w *= (0.09 + t * 0.3) * (forBoat ? 0.09 : 1);
    if (fish.rarity === "radiant") w *= (0.08 + t * 0.28) * (forBoat ? 0.08 : 1);
    if (fish.rarity === "dusk") w *= (0.07 + t * 0.26) * (forBoat ? 0.07 : 1);
    if (fish.rarity === "apex") w *= (0.06 + t * 0.24) * (forBoat ? 0.06 : 1);
    if (fish.rarity === "sovereign") w *= (0.05 + t * 0.22) * (forBoat ? 0.05 : 1);
    if (fish.rarity === "celestial") w *= (0.042 + t * 0.2) * (forBoat ? 0.042 : 1);
    if (fish.rarity === "primordial") w *= (0.035 + t * 0.18) * (forBoat ? 0.035 : 1);
    if (fish.rarity === "ultimate") w *= (0.028 + t * 0.16) * (forBoat ? 0.028 : 1);
    w *= valueRarityScale(fish);
    w *= luckWeightMult(fish.rarity, luck);
    // Weather / tide: storm & high tide lift high tiers; fog / calm lean common
    const wx = weatherRareMult();
    if (wx !== 1) {
      const skew = luckRaritySkew(fish.rarity);
      if (wx > 1) w *= Math.pow(wx, 0.35 + skew * 0.9);
      else w *= Math.pow(wx, 1.1 - skew * 0.7);
    }
    // Chest/event luck mult skews weight toward rarer tiers (omega ≈ ×mult)
    // so 100× luck makes top fish ~100× more common instead of barely moving.
    if (boostMult > 1) {
      w *= Math.pow(boostMult, luckRaritySkew(fish.rarity));
    }
    // Tiny floor — old 0.01 floor forced all ultra-rares to identical odds
    return Math.min(1e300, Math.max(1e-15, w));
  }

  function isExclusiveFish(fishOrId) {
    if (!fishOrId) return false;
    if (typeof fishOrId === "string") {
      return fishOrId === SOUL_TWIN_ID || !!fishById(fishOrId)?.exclusive;
    }
    return !!(fishOrId.exclusive || fishOrId.rarity === "exclusive" || fishOrId.id === SOUL_TWIN_ID);
  }

  function isUnsellableFish(fish, entry) {
    return isExclusiveFish(fish) || !!fish?.unsellable || !!entry?.unsellable;
  }

  function isUntradeableFish(fish, entry) {
    return isExclusiveFish(fish) || !!fish?.untradeable || !!entry?.untradeable;
  }

  let _exclusiveMirrorCache = { at: 0, value: 2, stamp: "" };

  /** Raw look value (base × variant/shiny/mutation) — never uses exclusive lockedValue. */
  function exclusiveCandidateLookValue(fish, entry) {
    if (!fish || isExclusiveFish(fish) || isTreasureItem(fish)) return 0;
    const base = Math.max(1, Math.floor(Number(fish.value) || 1));
    const mult = entry ? variantValueMult(entry) : 1;
    return Math.max(1, Math.floor(base * mult));
  }

  /** 2× your best non-exclusive catch look (variants included). Used everywhere Soul Twin is valued. */
  function exclusiveMirrorBaseValue() {
    const stamp = [
      String(state.bestCatchId || ""),
      Math.floor(Number(state.bestCatchScore) || 0),
      normalizeVariant(state.bestCatchVariant),
      state.bestCatchShiny ? 1 : 0,
      normalizeMutation(state.bestCatchMutation),
      (state.cooler || []).length
    ].join("|");
    const now = Date.now();
    if (
      _exclusiveMirrorCache.value > 0 &&
      _exclusiveMirrorCache.stamp === stamp &&
      now - _exclusiveMirrorCache.at < 1500
    ) {
      return _exclusiveMirrorCache.value;
    }

    let bestLook = 0;
    const consider = (fish, entry) => {
      const look = exclusiveCandidateLookValue(fish, entry);
      if (look > bestLook) bestLook = look;
    };

    const bestFish = fishById(state.bestCatchId);
    if (bestFish && !isExclusiveFish(bestFish)) {
      consider(bestFish, bestCatchEntry());
    }

    (state.cooler || []).forEach((raw) => {
      const entry = normalizeCoolerEntry(raw);
      if (!entry) return;
      consider(fishById(entry.id), entry);
    });

    Object.keys(state.caught || {}).forEach((id) => {
      const fish = fishById(id);
      if (!fish || isExclusiveFish(fish)) return;
      const rec = state.caught[id];
      consider(fish, { variant: "", shiny: false, mutation: "" });
      if (rec && typeof rec === "object") {
        VARIANT_PRIMARY.forEach((v) => {
          if (rec[v]) consider(fish, { variant: v, shiny: false, mutation: "" });
          if (rec[v] && rec.shiny) consider(fish, { variant: v, shiny: true, mutation: "" });
        });
        if (rec.shiny) consider(fish, { variant: "", shiny: true, mutation: "" });
        MUTATIONS.forEach((m) => {
          if (!rec[m]) return;
          consider(fish, { variant: "", shiny: !!rec.shiny, mutation: m });
          VARIANT_PRIMARY.forEach((v) => {
            if (rec[v]) consider(fish, { variant: v, shiny: !!rec.shiny, mutation: m });
          });
        });
      }
    });

    const out = Math.max(2, bestLook * 2);
    _exclusiveMirrorCache = { at: now, value: out, stamp };
    return out;
  }

  function tryRollExclusiveFish(forBoat = false) {
    if (forBoat) return null;
    if (!(Math.random() < SOUL_TWIN_CHANCE)) return null;
    return fishById(SOUL_TWIN_ID);
  }

  function rollFish(spot, forBoat = false) {
    const exclusive = tryRollExclusiveFish(forBoat);
    if (exclusive) return exclusive;
    const pool = FISH.filter((f) => !isExclusiveFish(f));
    const weights = pool.map((f) => fishWeight(f, spot, forBoat));
    const total = weights.reduce((a, b) => a + b, 0);
    let r = Math.random() * total;
    for (let i = 0; i < pool.length; i += 1) {
      r -= weights[i];
      if (r <= 0) return pool[i];
    }
    return pool[pool.length - 1];
  }

  function chancePct(fish, spot) {
    if (isExclusiveFish(fish)) return 100 * SOUL_TWIN_CHANCE; // 1 in 10,000,000
    const pool = FISH.filter((f) => !isExclusiveFish(f));
    const total = pool.reduce((s, f) => s + fishWeight(f, spot, false), 0);
    const w = fishWeight(fish, spot, false);
    return total > 0 ? (100 * w) / total : 0;
  }

  function fishValue(fish, spot, perfectOrEntry) {
    const entry =
      perfectOrEntry && typeof perfectOrEntry === "object" ? perfectOrEntry : null;
    // Hot path: never call exclusiveMirrorBaseValue during render — use lockedValue.
    const exclusiveBase = isExclusiveFish(fish)
      ? Math.max(1, Math.floor(Number(entry?.lockedValue) || 2))
      : 0;
    const base = Math.max(
      1,
      Math.floor((exclusiveBase || fish.value) * (spot?.valueMult || 1))
    );
    const perfect =
      perfectOrEntry === true ||
      (entry && !!entry.perfect);
    const variantMult = entry && !isExclusiveFish(fish) ? variantValueMult(entry) : 1;
    const mult =
      (1 +
        sellBonus() +
        spotMasterySellBonus(spot) +
        comboMultiBonus() +
        (perfect ? perfectBonus() : 0)) *
      treasureMoneyMult() *
      variantMult;
    return Math.max(1, Math.floor(base * mult));
  }

  function shouldAutoSell(rarity) {
    return !!state.autoSellRarities?.[rarity];
  }

  function autoSellMutationsOn() {
    return !!state.autoSellMutations;
  }

  /** Auto-sell by rarity — mutations skipped unless Mutation auto-sell is on. */
  function shouldAutoSellFish(fish, entry) {
    if (!fish || isUnsellableFish(fish, entry) || isExclusiveFish(fish)) return false;
    if (!shouldAutoSell(fish.rarity)) return false;
    if (normalizeMutation(entry?.mutation) && !autoSellMutationsOn()) return false;
    return true;
  }

  function syncAutoSellMutationsBtn() {
    const btn = document.getElementById("auto-sell-mutations-btn");
    if (!btn) return;
    const on = autoSellMutationsOn();
    btn.setAttribute("aria-pressed", on ? "true" : "false");
    btn.textContent = on ? "Mutation auto-sell: On" : "Mutation auto-sell: Off";
    btn.title = on
      ? "On — mutated fish auto-sell with their rarity (tap to turn off)"
      : "Off — mutated fish stay in the cooler (tap to turn on)";
  }

  function anyAutoSellEnabled() {
    return RARITIES.some((r) => shouldAutoSell(r));
  }

  /** @returns {object|null} cooler entry (even if auto-sold), or null if cooler full */
  function addToCooler(fish, opts = {}) {
    if (!fish) return null;
    const exclusive = isExclusiveFish(fish);
    const variants = exclusive
      ? { variant: "", shiny: false, mutation: "" }
      : normalizeVariants(opts.variants || rollFishVariants(currentSpot(), !!opts.forBoat));
    const lockedValue = exclusive ? exclusiveMirrorBaseValue() : 0;
    const entry = {
      id: fish.id,
      saved: exclusive ? true : false,
      perfect: !!opts.perfect,
      variant: variants.variant,
      shiny: variants.shiny,
      mutation: variants.mutation,
      unsellable: exclusive,
      untradeable: exclusive,
      lockedValue: lockedValue || undefined
    };
    noteCatch(fish, entry);
    if (!exclusive && (opts.forceSell || shouldAutoSellFish(fish, entry))) {
      const val = fishValue(fish, currentSpot(), entry);
      addCoins(val);
      noteQuestProgress("sell", 1, { rarity: fish.rarity });
      if (!opts.silent) {
        setCatchLine(
          `Sold ${formatFishName(fish, entry)} for ${formatNum(val)}`,
          catchTone(fish.rarity)
        );
      }
      return entry;
    }
    if (state.cooler.length >= coolerMax()) {
      if (!opts.silent) {
        setCatchLine(
          exclusive
            ? "Cooler full — free a slot for Soul Twin!"
            : "Cooler full — sell or auto-sell this rarity",
          "miss"
        );
      }
      playSfx("miss");
      return null;
    }
    state.cooler.push(entry);
    return entry;
  }

  function setCatchLine(text, cls = "") {
    if (!catchLineEl) return;
    catchLineEl.textContent = text;
    catchLineEl.classList.remove(
      "miss",
      "legend",
      "mythic",
      "secret",
      "divine",
      "eternal",
      "cosmic",
      "astral",
      "singularity",
      "omega",
      "genesis",
      "paradox",
      "infinity",
      "absolute",
      "transcendent",
      "nexus",
      "voidborn",
      "zenith",
      "crown",
      "origin",
      "aether",
      "radiant",
      "dusk",
      "apex",
      "sovereign",
      "celestial",
      "primordial",
      "ultimate",
      "exclusive",
      "treasure"
    );
    if (cls) catchLineEl.classList.add(cls);
  }

  function isShowcaseRarity(rarity) {
    return (RARITY_RANK[rarity] || 0) >= RARITY_RANK.legendary;
  }

  function catchTone(rarity) {
    if (rarity === "exclusive") return "exclusive";
    if (rarity === "ultimate") return "ultimate";
    if (rarity === "primordial") return "primordial";
    if (rarity === "celestial") return "celestial";
    if (rarity === "sovereign") return "sovereign";
    if (rarity === "apex") return "apex";
    if (rarity === "dusk") return "dusk";
    if (rarity === "radiant") return "radiant";
    if (rarity === "aether") return "aether";
    if (rarity === "origin") return "origin";
    if (rarity === "crown") return "crown";
    if (rarity === "zenith") return "zenith";
    if (rarity === "voidborn") return "voidborn";
    if (rarity === "nexus") return "nexus";
    if (rarity === "transcendent") return "transcendent";
    if (rarity === "absolute") return "absolute";
    if (rarity === "infinity") return "infinity";
    if (rarity === "paradox") return "paradox";
    if (rarity === "genesis") return "genesis";
    if (rarity === "omega") return "omega";
    if (rarity === "singularity") return "singularity";
    if (rarity === "astral") return "astral";
    if (rarity === "cosmic") return "cosmic";
    if (rarity === "eternal") return "eternal";
    if (rarity === "divine") return "divine";
    if (rarity === "secret") return "secret";
    if (rarity === "mythic") return "mythic";
    if (rarity === "legendary") return "legend";
    return "";
  }

  function startCast() {
    if (phase !== "ready") return;
    if (state.cooler.length >= coolerMax() && !anyAutoSellEnabled()) {
      setCatchLine("Cooler full — sell fish first", "miss");
      playSfx("miss");
      return;
    }
    ensureSession();
    clearTimers();
    const spot = currentSpot();
    const [lo, hi] = spot.wait;
    const waitMs =
      (lo + Math.random() * (hi - lo)) * 1000 * waitScale() * weatherWaitMult() * adminWaitFactor();
    setPhase("waiting");
    flashCastSplash();
    setCatchLine("Line is out… tap again to cancel");
    playSfx("flap");
    waitTimer = setTimeout(() => openBite(), waitMs);
    saveSoon();
  }

  function cancelCast() {
    if (phase !== "waiting") return;
    clearTimers();
    setPhase("ready");
    hideCatchCard("Cast to catch a fish");
    setCatchLine("Line reeled in");
    playSfx("miss");
  }

  function openBite() {
    if (phase !== "waiting") return;
    const windowSec = biteWindow();
    biteEndsAt = performance.now() + windowSec * 1000;
    setPhase("bite");
    setCatchLine("Bite! Tap Reel now!", "");
    playSfx("click");
    if (biteFill) {
      biteFill.style.transition = "none";
      biteFill.style.transform = "scaleX(1)";
      requestAnimationFrame(() => {
        biteFill.style.transition = `transform ${windowSec}s linear`;
        biteFill.style.transform = "scaleX(0)";
      });
    }
    biteTimer = setTimeout(() => missBite(), windowSec * 1000);
  }

  function missBite() {
    if (phase !== "bite") return;
    clearTimers();
    notePerfectCombo(false);
    noteSpotCast(state.spotId, 1);
    setPhase("result");
    castBtn.classList.add("is-miss");
    hideCatchCard("It got away…");
    setCatchLine("It got away…", "miss");
    playSfx("miss");
    setTimeout(() => {
      setPhase("ready");
      hideCatchCard("Cast to catch a fish");
      setCatchLine("Ready to cast");
      render(false);
    }, catchResultHoldMs(850));
  }

  function reelIn(evt) {
    if (phase === "ready") {
      startCast();
      return;
    }
    if (phase === "waiting") {
      cancelCast();
      return;
    }
    if (phase !== "bite") return;
    clearTimers();
    const remaining = Math.max(0, biteEndsAt - performance.now());
    const windowMs = biteWindow() * 1000;
    const perfect = remaining / windowMs > 0.55;
    const spot = currentSpot();
    notePerfectCombo(perfect);
    noteSpotCast(spot.id, 1);
    noteCommunityCast();

    const lbType = rollLuckyBlockDrop();
    if (lbType) {
      state.catches += 1;
      if (perfect) {
        state.perfects += 1;
        noteQuestProgress("perfect", 1);
      }
      const added = storeLuckyBlock(lbType, 1, { silent: true });
      const item = luckyBlockCatchItem(lbType);
      setPhase("result");
      castBtn.classList.add("is-catch", "rarity-treasure", `rarity-${lbType}`);
      showCatchSilhouette(item);
      showCatchCard([{ fish: item, val: 0, perfect, treasure: true, stored: added > 0 }]);
      const tip = perfect ? "Perfect reel! " : "";
      if (added > 0) {
        setCatchLine(
          `${tip}${item.name} stored · ${luckyBlockCount(lbType)} ready`,
          "treasure"
        );
      } else {
        setCatchLine(`${tip}${item.name} — stash full`, "miss");
      }
      const rect = castBtn.getBoundingClientRect();
      spawnFloat(
        evt?.clientX ?? rect.left + rect.width / 2,
        evt?.clientY ?? rect.top + 20,
        added > 0 ? "BLOCK +" : "STASH FULL"
      );
      checkAchievements();
      setTimeout(() => {
        setPhase("ready");
        render(false);
        saveSoon();
      }, catchResultHoldMs(1600));
      return;
    }

    const chest = rollTreasure(spot, false);
    if (chest) {
      state.catches += 1;
      if (perfect) {
        state.perfects += 1;
        noteQuestProgress("perfect", 1);
      }
      const stored = storeTreasure(chest);
      const countKey = chestCountKey(chest.kind);
      setPhase("result");
      castBtn.classList.add("is-catch", "rarity-treasure", `rarity-${chest.kind}`);
      showCatchSilhouette(chest);
      showCatchCard([{ fish: chest, val: 0, perfect, treasure: true, stored }]);
      const tip = perfect ? "Perfect reel! " : "";
      if (stored) {
        setCatchLine(`${tip}${chest.name} stored · ${state[countKey]} ready`, "treasure");
      }
      const rect = castBtn.getBoundingClientRect();
      spawnFloat(
        evt?.clientX ?? rect.left + rect.width / 2,
        evt?.clientY ?? rect.top + 20,
        stored ? (chest.kind === "luck" ? "LUCK +" : "COIN +") : "STASH FULL"
      );
      checkAchievements();
      setTimeout(() => {
        setPhase("ready");
        render(false);
        saveSoon();
      }, catchResultHoldMs(1600));
      return;
    }

    const fish = rollFish(spot, false);
    state.catches += 1;
    if (perfect) {
      state.perfects += 1;
      noteQuestProgress("perfect", 1);
    }

    const entry = addToCooler(fish, { perfect });
    if (entry) noteQuestProgress("catch", 1, { rarity: fish.rarity, forBoat: false });
    let bonusFish = null;
    let bonusEntry = null;
    let thirdFish = null;
    let thirdEntry = null;
    let fourthFish = null;
    let fourthEntry = null;
    let fifthFish = null;
    let fifthEntry = null;
    if (entry && Math.random() < multiCatchChance()) {
      bonusFish = rollFish(spot, false);
      state.catches += 1;
      bonusEntry = addToCooler(bonusFish);
      if (!bonusEntry) bonusFish = null;
      else noteQuestProgress("catch", 1, { rarity: bonusFish.rarity, forBoat: false });
    }
    if (entry && bonusFish && Math.random() < tripleCatchChance()) {
      thirdFish = rollFish(spot, false);
      state.catches += 1;
      thirdEntry = addToCooler(thirdFish);
      if (!thirdEntry) thirdFish = null;
      else noteQuestProgress("catch", 1, { rarity: thirdFish.rarity, forBoat: false });
    }
    if (entry && bonusFish && thirdFish && Math.random() < quadCatchChance()) {
      fourthFish = rollFish(spot, false);
      state.catches += 1;
      fourthEntry = addToCooler(fourthFish);
      if (!fourthEntry) fourthFish = null;
      else noteQuestProgress("catch", 1, { rarity: fourthFish.rarity, forBoat: false });
    }
    if (entry && bonusFish && thirdFish && fourthFish && Math.random() < pentaCatchChance()) {
      fifthFish = rollFish(spot, false);
      state.catches += 1;
      fifthEntry = addToCooler(fifthFish);
      if (!fifthEntry) fifthFish = null;
      else noteQuestProgress("catch", 1, { rarity: fifthFish.rarity, forBoat: false });
    }
    setPhase("result");
    if (entry) {
      const haul = [{ fish, val: fishValue(fish, spot, entry), perfect, entry }];
      if (bonusFish && bonusEntry) {
        haul.push({
          fish: bonusFish,
          val: fishValue(bonusFish, spot, bonusEntry),
          perfect: false,
          entry: bonusEntry
        });
      }
      if (thirdFish && thirdEntry) {
        haul.push({
          fish: thirdFish,
          val: fishValue(thirdFish, spot, thirdEntry),
          perfect: false,
          entry: thirdEntry
        });
      }
      if (fourthFish && fourthEntry) {
        haul.push({
          fish: fourthFish,
          val: fishValue(fourthFish, spot, fourthEntry),
          perfect: false,
          entry: fourthEntry
        });
      }
      if (fifthFish && fifthEntry) {
        haul.push({
          fish: fifthFish,
          val: fishValue(fifthFish, spot, fifthEntry),
          perfect: false,
          entry: fifthEntry
        });
      }
      const showcase = pickBestCatchFish(haul) || fish;
      const showcaseEntry =
        haul.find((h) => h.fish === showcase)?.entry || entry;
      castBtn.classList.add("is-catch", `rarity-${showcase.rarity}`);
      showCatchSilhouette(showcase, showcaseEntry);
      showCatchCard(haul);
      const tip = perfect ? "Perfect reel! " : "";
      const extras = [bonusFish, thirdFish, fourthFish, fifthFish].filter(Boolean).map((f) => {
        const e =
          f === bonusFish
            ? bonusEntry
            : f === thirdFish
              ? thirdEntry
              : f === fourthFish
                ? fourthEntry
                : fifthEntry;
        return formatFishName(f, e);
      });
      const bonusTip = extras.length ? ` + ${extras.join(" + ")}` : "";
      setCatchLine(
        `${tip}Caught ${formatFishName(fish, entry)} (${fish.rarity})${bonusTip}`,
        catchTone(showcase.rarity)
      );
      playSfx(
        perfect ||
          isShowcaseRarity(fish.rarity) ||
          (bonusFish && isShowcaseRarity(bonusFish.rarity)) ||
          (thirdFish && isShowcaseRarity(thirdFish.rarity)) ||
          (fourthFish && isShowcaseRarity(fourthFish.rarity)) ||
          (fifthFish && isShowcaseRarity(fifthFish.rarity))
          ? "win"
          : "click"
      );
      if (
        isShowcaseRarity(fish.rarity) ||
        (bonusFish && isShowcaseRarity(bonusFish.rarity)) ||
        (thirdFish && isShowcaseRarity(thirdFish.rarity)) ||
        (fourthFish && isShowcaseRarity(fourthFish.rarity)) ||
        (fifthFish && isShowcaseRarity(fifthFish.rarity))
      ) {
        burstConfetti();
      }
      const rect = castBtn.getBoundingClientRect();
      const extrasN = [bonusFish, thirdFish, fourthFish, fifthFish].filter(Boolean).length;
      spawnFloat(
        evt?.clientX ?? rect.left + rect.width / 2,
        evt?.clientY ?? rect.top + 20,
        extrasN
          ? `${formatFishName(showcase, showcaseEntry)} +${extrasN}`
          : formatFishName(showcase, showcaseEntry)
      );
    } else {
      clearCatchSilhouette();
      castBtn.classList.add("is-miss");
      hideCatchCard("Cooler full");
    }
    checkAchievements();
    setTimeout(() => {
      setPhase("ready");
      render(false);
      saveSoon();
    }, catchResultHoldMs(1400));
  }

  function sellOneFish(index) {
    const i = Math.floor(Number(index));
    if (!Number.isFinite(i) || i < 0 || i >= state.cooler.length) return;
    ensureSession();
    const entry = state.cooler[i];
    const id = coolerEntryId(entry);
    const fish = fishById(id);
    if (!fish) {
      state.cooler.splice(i, 1);
      render(false);
      saveSoon();
      return;
    }
    if (isCoolerSaved(entry)) {
      setCatchLine(
        `${formatFishName(fish, entry)} is saved — unpin to sell`,
        "miss"
      );
      playSfx("miss");
      return;
    }
    if (isUnsellableFish(fish, entry)) {
      setCatchLine(`${formatFishName(fish, entry)} can't be sold`, "miss");
      playSfx("miss");
      return;
    }
    const val = fishValue(fish, currentSpot(), entry);
    state.cooler.splice(i, 1);
    addCoins(val);
    noteQuestProgress("sell", 1, { rarity: fish.rarity });
    setCatchLine(
      `Sold ${formatFishName(fish, entry)} for ${formatNum(val)}`,
      catchTone(fish.rarity)
    );
    playSfx("click");
    render(false);
    saveSoon();
  }

  function toggleSaveFish(index) {
    const i = Math.floor(Number(index));
    if (!Number.isFinite(i) || i < 0 || i >= state.cooler.length) return;
    ensureSession();
    const entry = state.cooler[i];
    if (!entry || !fishById(coolerEntryId(entry))) return;
    const fish = fishById(entry.id);
    if (isExclusiveFish(fish) || isUnsellableFish(fish, entry)) {
      entry.saved = true;
      setCatchLine(`${formatFishName(fish, entry)} stays in the Aquarium`, "exclusive");
      playSfx("click");
      render(false);
      saveSoon();
      return;
    }
    entry.saved = !entry.saved;
    const label = formatFishName(fish, entry);
    setCatchLine(
      entry.saved
        ? `Saved ${label} — in the Aquarium · won't sell`
        : `Unsaved ${label}`
    );
    playSfx("click");
    render(false);
    saveSoon();
  }

  function sellCooler() {
    if (!unsavedCoolerCount()) return;
    ensureSession();
    const spot = currentSpot();
    let total = 0;
    const kept = [];
    state.cooler.forEach((entry) => {
      if (isCoolerSaved(entry)) {
        kept.push(entry);
        return;
      }
      const fish = fishById(coolerEntryId(entry));
      if (isUnsellableFish(fish, entry) || isExclusiveFish(fish)) {
        kept.push({ ...normalizeCoolerEntry(entry), saved: true, unsellable: true });
        return;
      }
      if (fish) {
        total += fishValue(fish, spot, entry);
        noteQuestProgress("sell", 1, { rarity: fish.rarity });
      }
    });
    state.cooler = kept;
    addCoins(total);
    setCatchLine(
      kept.length
        ? `Sold catch for ${formatNum(total)} · ${kept.length} saved kept`
        : `Sold catch for ${formatNum(total)} coins`
    );
    playSfx("win");
    render(false);
    saveSoon();
  }

  /* ========== Shiny Machine ========== */
  const SHINY_MACHINE_MAX = 5;
  const SHINY_MACHINE_CHANCES = [0, 0.2, 0.4, 0.6, 0.8, 1];

  function shinyMachineSelectedEntries() {
    return shinyMachineSlots
      .map((idx) => {
        const i = Math.floor(Number(idx));
        if (!Number.isFinite(i) || i < 0 || i >= state.cooler.length) return null;
        const entry = normalizeCoolerEntry(state.cooler[i]);
        if (!entry || entry.shiny) return null;
        const fish = fishById(entry.id);
        if (!fish || isTreasureItem(fish) || isExclusiveFish(fish)) return null;
        return { index: i, entry, fish };
      })
      .filter(Boolean);
  }

  function clearShinyMachineSlots(msg) {
    shinyMachineSlots = [];
    if (msg) setShinyMachineStatus(msg);
    renderShinyMachine();
  }

  function setShinyMachineStatus(text, tone = "") {
    if (!shinyMachineStatusEl) return;
    shinyMachineStatusEl.textContent = text || "";
    shinyMachineStatusEl.classList.remove("is-win", "is-lose");
    if (tone) shinyMachineStatusEl.classList.add(tone);
  }

  function shinyMachineChanceForCount(n) {
    const count = Math.max(0, Math.min(SHINY_MACHINE_MAX, Math.floor(Number(n) || 0)));
    return SHINY_MACHINE_CHANCES[count] || 0;
  }

  function shinyMachineChanceLabel(n) {
    return `${Math.round(shinyMachineChanceForCount(n) * 100)}%`;
  }

  function openShinyMachine() {
    shinyMachineBusy = false;
    shinyMachineSlots = shinyMachineSlots.filter((idx) => {
      const i = Math.floor(Number(idx));
      const entry = normalizeCoolerEntry(state.cooler[i]);
      return entry && !entry.shiny && fishById(entry.id);
    });
    setShinyMachineStatus("Pick fish from your cooler below.");
    renderShinyMachine();
    shinyMachineOverlay?.classList.remove("hidden");
    lockPageScroll();
  }

  function closeShinyMachine() {
    if (shinyMachineBusy) return;
    shinyMachineOverlay?.classList.add("hidden");
    unlockPageScroll();
  }

  function toggleShinyMachinePick(index) {
    if (shinyMachineBusy) return;
    const i = Math.floor(Number(index));
    if (!Number.isFinite(i) || i < 0 || i >= state.cooler.length) return;
    const entry = normalizeCoolerEntry(state.cooler[i]);
    if (!entry || entry.shiny) return;
    const fish = fishById(entry.id);
    if (!fish || isTreasureItem(fish)) return;

    const pos = shinyMachineSlots.indexOf(i);
    if (pos >= 0) {
      shinyMachineSlots.splice(pos, 1);
      setShinyMachineStatus("Removed from machine.");
      renderShinyMachine();
      playSfx("click");
      return;
    }

    if (shinyMachineSlots.length >= SHINY_MACHINE_MAX) {
      setShinyMachineStatus(`Only ${SHINY_MACHINE_MAX} slots — clear one first.`, "is-lose");
      playSfx("miss");
      return;
    }

    if (shinyMachineSlots.length >= 1) {
      const first = normalizeCoolerEntry(state.cooler[shinyMachineSlots[0]]);
      if (!first || first.id !== entry.id) {
        setShinyMachineStatus("All slots need the same fish species.", "is-lose");
        playSfx("miss");
        return;
      }
    }

    shinyMachineSlots.push(i);
    const n = shinyMachineSlots.length;
    setShinyMachineStatus(
      n >= SHINY_MACHINE_MAX
        ? `5× same fish · ${shinyMachineChanceLabel(n)} guaranteed shiny.`
        : `${n}× same fish · ${shinyMachineChanceLabel(n)} for one shiny.`
    );
    renderShinyMachine();
    playSfx("click");
  }

  function removeShinyMachineSlot(slotIndex) {
    if (shinyMachineBusy) return;
    const s = Math.floor(Number(slotIndex));
    if (s < 0 || s >= shinyMachineSlots.length) return;
    shinyMachineSlots.splice(s, 1);
    setShinyMachineStatus("Slot cleared.");
    renderShinyMachine();
    playSfx("click");
  }

  function runShinyMachine() {
    if (shinyMachineBusy) return;
    const selected = shinyMachineSelectedEntries();
    if (!selected.length) {
      setShinyMachineStatus("Put at least one fish in the machine.", "is-lose");
      playSfx("miss");
      return;
    }
    const speciesId = selected[0].entry.id;
    if (selected.some((s) => s.entry.id !== speciesId)) {
      setShinyMachineStatus("All fish must be the same species.", "is-lose");
      playSfx("miss");
      return;
    }

    ensureSession();
    shinyMachineBusy = true;
    const chance = shinyMachineChanceForCount(selected.length);
    const win = Math.random() < chance;
    // Prefer the strongest look among inputs so a mutated/variant fish keeps its tags + shiny.
    const keep = selected.reduce((best, cur) => {
      if (!best) return cur;
      const b = variantValueMult(best.entry);
      const c = variantValueMult(cur.entry);
      if (c !== b) return c > b ? cur : best;
      if (!!cur.entry.perfect !== !!best.entry.perfect) return cur.entry.perfect ? cur : best;
      return best;
    }, null);
    const fish = keep.fish;
    const count = selected.length;
    const indices = selected.map((s) => s.index).sort((a, b) => b - a);

    indices.forEach((idx) => {
      if (idx >= 0 && idx < state.cooler.length) state.cooler.splice(idx, 1);
    });

    if (win) {
      const shinyEntry = {
        id: keep.entry.id,
        saved: !!keep.entry.saved,
        perfect: !!keep.entry.perfect,
        variant: normalizeVariant(keep.entry.variant),
        shiny: true,
        mutation: normalizeMutation(keep.entry.mutation)
      };
      state.cooler.push(shinyEntry);
      noteCatch(fish, shinyEntry);
      const label = formatFishName(fish, shinyEntry);
      const extras = count - 1;
      setShinyMachineStatus(
        extras > 0
          ? `Shiny! ${label} kept · ${extras} relished.`
          : `Shiny! ${label} sparkles now.`,
        "is-win"
      );
      setCatchLine(`Shiny Machine → ${label}`, catchTone(fish.rarity));
      playSfx("win");
    } else {
      const label = formatFishName(fish, keep.entry);
      setShinyMachineStatus(
        count > 1
          ? `No shine — ${count}× ${label} were relished.`
          : `No shine — ${label} was relished.`,
        "is-lose"
      );
      setCatchLine(
        count > 1
          ? `Shiny Machine relished ${count}× ${label}`
          : `Shiny Machine relished ${label}`,
        "miss"
      );
      playSfx("miss");
    }

    shinyMachineSlots = [];
    shinyMachineBusy = false;
    render(false);
    renderShinyMachine();
    saveSoon();
  }

  function renderShinyMachine() {
    if (!shinyMachineOverlay || shinyMachineOverlay.classList.contains("hidden")) {
      // Still refresh if open path calls before unhiding; allow closed no-op for picker
    }
    const selected = shinyMachineSelectedEntries();
    // Drop stale indices if cooler changed under us
    if (selected.length !== shinyMachineSlots.length) {
      shinyMachineSlots = selected.map((s) => s.index);
    }

    const chance = shinyMachineChanceForCount(selected.length);
    if (shinyMachineChanceEl) {
      shinyMachineChanceEl.textContent =
        selected.length === 0
          ? "Chance: —"
          : `Chance: ${Math.round(chance * 100)}%${
              selected.length > 1 ? " · one shiny if you win" : ""
            }`;
    }

    if (shinyMachineSlotsEl) {
      const spot = currentSpot();
      const slotBtns = shinyMachineSlotsEl.querySelectorAll("[data-shiny-slot]");
      slotBtns.forEach((btn) => {
        const slot = Math.floor(Number(btn.dataset.shinySlot));
        const row = selected[slot];
        btn.classList.toggle("is-filled", !!row);
        const body = btn.querySelector(".shiny-slot-body");
        let meta = btn.querySelector(".shiny-slot-meta");
        if (row) {
          const val = fishValue(row.fish, spot, row.entry);
          const shinyVal = fishValue(row.fish, spot, { ...row.entry, shiny: true });
          if (body) body.textContent = formatFishName(row.fish, row.entry);
          if (!meta) {
            meta = document.createElement("span");
            meta.className = "shiny-slot-meta";
            btn.appendChild(meta);
          }
          meta.textContent = `${formatNum(val)} · shiny ${formatNum(shinyVal)} · tap to remove`;
          btn.setAttribute(
            "aria-label",
            `Slot ${slot + 1}: ${formatFishName(row.fish, row.entry)}, sells for ${formatNum(val)}. Tap to remove.`
          );
        } else {
          if (body) body.textContent = "Empty";
          meta?.remove();
          btn.setAttribute("aria-label", `Slot ${slot + 1} empty`);
        }
      });
    }

    if (shinyMachineRunBtn) {
      shinyMachineRunBtn.disabled = selected.length < 1 || shinyMachineBusy;
      shinyMachineRunBtn.textContent =
        selected.length >= 1
          ? `Run (${shinyMachineChanceLabel(selected.length)})`
          : "Run machine";
    }

    if (!shinyMachinePickerEl) return;
    const selectedSet = new Set(shinyMachineSlots);
    const requiredId = selected[0]?.entry.id || "";
    const atMax = shinyMachineSlots.length >= SHINY_MACHINE_MAX;
    const spot = currentSpot();
    shinyMachinePickerEl.innerHTML = state.cooler
      .map((raw, index) => {
        const entry = normalizeCoolerEntry(raw);
        if (!entry || entry.shiny) return "";
        const fish = fishById(entry.id);
        if (!fish || isTreasureItem(fish) || isExclusiveFish(fish)) return "";
        const on = selectedSet.has(index);
        // Only show fish that fit: same species once a slot is filled; when full, only selected.
        if (requiredId && entry.id !== requiredId) return "";
        if (atMax && !on) return "";
        const label = formatFishName(fish, entry);
        const val = fishValue(fish, spot, entry);
        const shinyVal = fishValue(fish, spot, { ...entry, shiny: true });
        return `<button type="button" class="shiny-pick ${fish.rarity} ${variantClassList(entry)}${
          on ? " is-selected" : ""
        }" data-shiny-pick="${index}" role="listitem" title="${
          on
            ? `Remove · sells ${formatNum(val)} · shiny ${formatNum(shinyVal)}`
            : `Add · sells ${formatNum(val)} · shiny ${formatNum(shinyVal)}`
        }">
          <span class="fish-glyph" aria-hidden="true">${fishGlyphHtml(fish, entry)}</span>
          <span class="shiny-pick-text">
            <span class="shiny-pick-name">${label}</span>
            <span class="shiny-pick-val">${formatNum(val)} → <em>${formatNum(shinyVal)}</em></span>
          </span>
        </button>`;
      })
      .join("");
  }

  function buyEchoLuck() {
    if (echoLuckAtCap()) return;
    const cost = echoLuckCost();
    if (!Number.isFinite(cost) || state.coins < cost) return;
    ensureSession();
    state.coins -= cost;
    state.echoLuckLevel = echoLuckLevel() + 1;
    playSfx("click");
    setCatchLine(
      echoLuckAtCap()
        ? `Echo Charm maxed · +${formatLuckAmt(echoLuckBonus())} luck`
        : `Echo Charm +${formatLuckAmt(echoLuckBonus())} luck`
    );
    checkAchievements();
    render();
    saveSoon();
  }

  function renderAquariumUpgrade() {
    const row = document.getElementById("aquarium-upgrade");
    const nameEl = document.getElementById("aquarium-upgrade-name");
    const descEl = document.getElementById("aquarium-upgrade-desc");
    const statusEl = document.getElementById("aquarium-upgrade-status");
    const btn = document.getElementById("aquarium-upgrade-btn");
    if (!row || !btn) return;
    const current = getAquariumTier();
    const next = nextAquariumTier();
    if (!next) {
      const curName = current?.name || "Base tank";
      if (nameEl) nameEl.textContent = curName;
      if (descEl) {
        descEl.textContent = current
          ? `${current.desc} · Lv${current.level}/${AQUARIUM_MAX_LEVEL}`
          : "Maxed";
      }
      if (statusEl) statusEl.textContent = `Maxed · Lv${AQUARIUM_MAX_LEVEL}`;
      btn.disabled = true;
      btn.textContent = "MAX";
      row.classList.add("is-maxed");
      return;
    }
    row.classList.remove("is-maxed");
    if (nameEl) nameEl.textContent = next.name;
    if (descEl) {
      descEl.textContent = current
        ? `Lv${current.level} ${current.name} → Lv${next.level} ${next.name} · ${next.desc}`
        : `Unlock ${next.name} · ${next.desc}`;
    }
    if (statusEl) {
      statusEl.textContent = current
        ? `Owned · Lv${current.level}/${AQUARIUM_MAX_LEVEL}`
        : "Not upgraded yet";
    }
    btn.disabled = state.coins < next.cost;
    btn.textContent = formatNum(next.cost);
  }

  function buyAquariumUpgrade() {
    const next = nextAquariumTier();
    if (!next || state.coins < next.cost) return;
    ensureSession();
    state.coins -= next.cost;
    state.aquariumLevel = next.level;
    playSfx("click");
    burstConfetti();
    setCatchLine(
      next.level === 1
        ? `Installed ${next.name} · ${next.desc}`
        : `Upgraded aquarium to ${next.name} · ${next.desc}`,
      "treasure"
    );
    checkAchievements();
    aquariumRenderKey = "";
    render();
    saveSoon();
  }

  function buyGear(id) {
    if (id === "boat") {
      buyBoatUpgrade();
      return;
    }
    if (id === ECHO_LUCK_ID) {
      buyEchoLuck();
      return;
    }
    const item = GEAR.find((g) => g.id === id);
    if (!item || state.owned[id] || state.coins < item.cost) return;
    ensureSession();
    state.coins -= item.cost;
    state.owned[id] = true;
    if (item.kind === "speed") {
      state.equippedSpeed = id;
      setCatchLine(`Bought & equipped ${item.name}`);
    }
    playSfx("click");
    checkAchievements();
    render();
    saveSoon();
  }

  function equipSpeed(id) {
    const item = GEAR.find((g) => g.id === id && g.kind === "speed");
    if (!item || !state.owned[id]) return;
    if (state.equippedSpeed === id) return;
    state.equippedSpeed = id;
    setCatchLine(`Equipped ${item.name}`);
    playSfx("click");
    render();
    saveSoon();
  }

  function buyBoatUpgrade() {
    const next = nextBoatTier();
    if (!next || state.coins < next.cost) return;
    ensureSession();
    state.coins -= next.cost;
    state.boatLevel = next.level;
    boatAcc.boat = 0;
    playSfx("click");
    burstConfetti();
    setCatchLine(
      next.level === 1
        ? `Hired ${next.name} — every ${next.interval}s · ${next.multiHint}`
        : `Upgraded to ${next.name} — every ${next.interval}s · ${next.multiHint}`
    );
    checkAchievements();
    render();
    saveSoon();
  }

  function unlockOrSelectSpot(id) {
    const spot = SPOTS.find((s) => s.id === id);
    if (!spot) return;
    if (state.unlocked[id]) {
      state.spotId = id;
      setCatchLine(`Fishing at ${spot.name}`);
      render();
      saveSoon();
      return;
    }
    if (state.coins < spot.cost) return;
    ensureSession();
    state.coins -= spot.cost;
    state.unlocked[id] = true;
    state.spotId = id;
    setCatchLine(`Unlocked ${spot.name}!`);
    playSfx("win");
    burstConfetti();
    checkAchievements();
    render();
    saveSoon();
  }

  let lastBoatHaul = [];
  let lastBoatHaulUntil = 0;
  let lastBoatHaulKey = "";

  function boatHaulKey(entries) {
    return (entries || [])
      .map((h) => `${h.fish?.id || ""}:${h.val}:${h.sold ? 1 : 0}:${h.missed ? 1 : 0}`)
      .join("|");
  }

  function boatHaulHtml(entries) {
    if (!entries?.length) return "";
    return `<div class="boat-haul-list">${entries
      .map(({ fish, val, sold, missed, treasure, stored, entry }) => {
        if (treasure || isTreasureItem(fish)) {
          const detail =
            stored === false || missed ? "stash full" : treasureUseLabel(fish);
          const isLb = fish.kind === "luckyblock";
          const kindClass = isLb
            ? `treasure-luckyblock treasure-luckyblock-${fish.blockType || "absolute"}`
            : fish.kind === "luck"
              ? "treasure-luck"
              : "treasure-money";
          const glyph =
            fish.kind === "luck" || fish.blockType === "astral"
              ? "◇"
              : fish.blockType === "zenith"
                ? "◆"
                : "▣";
          const tag = isLb
            ? fish.blockType === "astral"
              ? "astral"
              : fish.blockType === "zenith"
                ? "zenith"
                : "absolute"
            : fish.kind === "luck"
              ? "luck"
              : "coin";
          return `<div class="boat-haul-item treasure ${kindClass}">
          <span class="boat-haul-glyph treasure-glyph" aria-hidden="true">${glyph}</span>
          <span class="boat-haul-meta">
            <span class="boat-haul-name">${fish.name}</span>
            <span class="boat-haul-val">${detail}</span>
          </span>
          <span class="boat-haul-tag">${tag}</span>
        </div>`;
        }
        const tag = missed ? "no room" : sold ? "sold" : "kept";
        const title = formatVariantTitle(entry);
        return `<div class="boat-haul-item ${fish.rarity}${missed ? " is-missed" : ""} ${variantClassList(entry)}">
          <span class="boat-haul-glyph" aria-hidden="true">${fishGlyphHtml(fish, entry)}</span>
          <span class="boat-haul-meta">
            <span class="boat-haul-name">${formatFishName(fish, entry)}</span>
            <span class="boat-haul-val">${formatNum(val)} · ${tag}</span>
          </span>
          <span class="boat-haul-tag">${title || fish.rarity}</span>
        </div>`;
      })
      .join("")}</div>`;
  }

  function boatHaulEmptyHtml(hasBoat) {
    return `<p class="boat-bay-empty">${
      hasBoat ? "Waiting for the next haul…" : "Hire an auto boat to see catches here"
    }</p>`;
  }

  function hideBoatHaul() {
    lastBoatHaul = [];
    lastBoatHaulUntil = 0;
    lastBoatHaulKey = "";
    const el = boatHaulEl || document.getElementById("boat-haul");
    if (!el) return;
    el.innerHTML = boatHaulEmptyHtml(!!getBoat());
  }

  function expireBoatHaulIfNeeded() {
    if (!lastBoatHaul.length) return;
    if (performance.now() < lastBoatHaulUntil) return;
    hideBoatHaul();
  }

  function flashBoatHaul(entries) {
    const list = (entries || []).slice();
    const key = boatHaulKey(list);
    lastBoatHaul = list;
    lastBoatHaulUntil = performance.now() + 5000;
    const el = boatHaulEl || document.getElementById("boat-haul");
    if (!el) return;
    // Only rebuild DOM when the haul actually changes (avoids flicker)
    if (key !== lastBoatHaulKey) {
      lastBoatHaulKey = key;
      el.innerHTML = boatHaulHtml(list);
    }
  }

  function boatCatch(boat) {
    const spot = currentSpot();
    const lbType = rollLuckyBlockDrop();
    if (lbType) {
      const added = storeLuckyBlock(lbType, 1, { silent: true });
      const item = luckyBlockCatchItem(lbType);
      flashBoatHaul([
        { fish: item, val: 0, sold: false, missed: !added, treasure: true, stored: added > 0 }
      ]);
      setCatchLine(
        added
          ? `Boat found a ${item.name} · ${luckyBlockCount(lbType)} stored`
          : `Boat found a ${item.name} — stash full`,
        added ? "treasure" : "miss"
      );
      playSfx(added ? "win" : "miss");
      checkAchievements();
      renderCooler(true);
      renderTreasureStash();
      renderBoatTimers();
      saveSoon();
      return;
    }
    const chest = rollTreasure(spot, true);
    if (chest) {
      const stored = storeTreasure(chest, { silent: true });
      const countKey = chestCountKey(chest.kind);
      flashBoatHaul([
        { fish: chest, val: 0, sold: false, missed: !stored, treasure: true, stored }
      ]);
      setCatchLine(
        stored
          ? `Boat found a ${chest.name} · ${state[countKey]} stored`
          : `Boat found a ${chest.name} — stash full`,
        stored ? "treasure" : "miss"
      );
      playSfx(stored ? "win" : "miss");
      checkAchievements();
      renderCooler(true);
      renderTreasureStash();
      renderBoatTimers();
      saveSoon();
      return;
    }
    const count = rollBoatCatchCount(boat.level || boatLevel());
    const haul = [];
    for (let i = 0; i < count; i += 1) {
      const fish = rollFish(spot, true);
      const variants = rollFishVariants(spot, true);
      const sold = shouldAutoSellFish(fish, variants);
      const val = fishValue(fish, spot, variants);
      if (sold || state.cooler.length < coolerMax()) {
        addToCooler(fish, { silent: true, forBoat: true, variants });
        state.catches += 1;
        noteQuestProgress("catch", 1, { rarity: fish.rarity, forBoat: true });
        haul.push({ fish, val, sold, missed: false, entry: variants });
      } else {
        haul.push({
          fish,
          val,
          sold: false,
          missed: true,
          entry: variants
        });
      }
    }
    if (!haul.length) return;

    flashBoatHaul(haul);
    const best = haul.reduce((a, b) => (b.val >= a.val ? b : a), haul[0]);
    const kept = haul.filter((h) => !h.missed);
    const bestName = formatFishName(best.fish, best.entry);
    const line =
      kept.length === 0
        ? `Boat found ${bestName} — cooler full`
        : kept.length > 1
          ? `Boat hauled ${kept.length} fish · ${bestName}`
          : `Boat caught ${bestName}`;
    setCatchLine(line, kept.length ? catchTone(best.fish.rarity) : "miss");
    // Don't open the big catch card for boat hauls — it fights the cast UI.
    playSfx(kept.length ? "click" : "miss");
    checkAchievements();
    renderCooler(true);
    renderBoatTimers();
    saveSoon();
  }

  function boatRemaining(boat) {
    const interval = Number(boat.amount) || 1;
    const acc = boatAcc[boat.id] || 0;
    return Math.max(0, interval - acc);
  }

  function formatTimer(sec) {
    const s = Math.max(0, Number(sec) || 0);
    if (s >= 10) return `${Math.ceil(s)}s`;
    return `${s.toFixed(1)}s`;
  }

  function renderBoatTimers() {
    const boat = getBoat();
    if (boatsLabelEl) {
      if (!boat) boatsLabelEl.textContent = "None";
      else boatsLabelEl.textContent = `Lv${boat.level} · ${formatTimer(boatRemaining(boat))}`;
    }
    if (!boatTimersEl) return;
    if (!boat) {
      boatTimersEl.innerHTML = "";
      boatTimersEl.classList.add("empty");
      if (!lastBoatHaul.length) hideBoatHaul();
      return;
    }

    boatTimersEl.classList.remove("empty");

    const interval = Number(boat.amount) || 1;
    const left = boatRemaining(boat);
    const pct = Math.max(0, Math.min(100, (1 - left / interval) * 100));
    boatTimersEl.classList.remove("empty");

    let root = boatTimersEl.querySelector(".boat-timer");
    if (!root) {
      boatTimersEl.innerHTML = `<div class="boat-timer" data-boat="boat">
        <div class="boat-timer-top">
          <span class="boat-timer-name"></span>
          <span class="boat-timer-left"></span>
        </div>
        <div class="boat-timer-track" aria-hidden="true">
          <div class="boat-timer-fill"></div>
        </div>
        <div class="boat-timer-meta"></div>
      </div>`;
      root = boatTimersEl.querySelector(".boat-timer");
    }

    const nameEl = root.querySelector(".boat-timer-name");
    const leftEl = root.querySelector(".boat-timer-left");
    const fillEl = root.querySelector(".boat-timer-fill");
    const metaEl = root.querySelector(".boat-timer-meta");
    if (nameEl) nameEl.textContent = `${boat.name} · Lv${boat.level}`;
    if (leftEl) leftEl.textContent = formatTimer(left);
    if (fillEl) fillEl.style.width = `${pct.toFixed(1)}%`;
    if (metaEl) {
      metaEl.textContent = `every ${interval}s · ${BOAT_TIERS[boat.level]?.multiHint || "1 fish"}`;
    }

    expireBoatHaulIfNeeded();
  }

  function tickBoats(dt) {
    boats().forEach((boat) => {
      const interval = boat.amount;
      boatAcc[boat.id] = (boatAcc[boat.id] || 0) + dt;
      while (boatAcc[boat.id] >= interval) {
        boatAcc[boat.id] -= interval;
        boatCatch(boat);
      }
    });
  }

  function applyOffline() {
    const now = Date.now();
    const elapsed = Math.min(6 * 3600 * 1000, Math.max(0, now - (state.lastTick || now)));
    tickAquarium(true);
    if (elapsed < 8000) {
      state.lastTick = now;
      return;
    }
    const list = boats();
    if (!list.length) {
      state.lastTick = now;
      return;
    }
    let gained = 0;
    let chestsFound = 0;
    let blocksFound = 0;
    let fishCaught = 0;
    const spot = currentSpot();
    list.forEach((boat) => {
      const cycles = Math.floor(elapsed / 1000 / boat.amount);
      for (let i = 0; i < Math.min(cycles, 400); i += 1) {
        const lbType = rollLuckyBlockDrop();
        if (lbType) {
          if (storeLuckyBlock(lbType, 1, { silent: true })) blocksFound += 1;
          continue;
        }
        // Offline chests are half as likely as a live boat haul
        const chest = rollTreasure(spot, true, 0.5);
        if (chest) {
          if (storeTreasure(chest, { silent: true })) chestsFound += 1;
          continue;
        }
        const haul = rollBoatCatchCount(boat.level || boatLevel());
        for (let h = 0; h < haul; h += 1) {
          const fish = rollFish(spot, true);
          const variants = rollFishVariants(spot, true);
          noteCatch(fish, variants);
          fishCaught += 1;
          const val = fishValue(fish, spot, variants);
          if (shouldAutoSellFish(fish, variants)) {
            gained += val;
          } else if (state.cooler.length < coolerMax()) {
            state.cooler.push({
              id: fish.id,
              saved: false,
              variant: variants.variant,
              shiny: variants.shiny,
              mutation: variants.mutation
            });
          } else {
            gained += val;
          }
        }
      }
    });
    if (gained > 0) addCoins(gained);
    state.lastTick = now;
    if (gained > 0 || chestsFound > 0 || blocksFound > 0 || fishCaught > 0) {
      const hours = Math.max(0.01, elapsed / 3600000);
      state.pendingOffline = {
        coins: gained,
        chests: chestsFound,
        blocks: blocksFound,
        fish: fishCaught,
        hours,
        expiresAt: now + OFFLINE_CLAIM_BONUS_MS,
        claimed: false
      };
      showOfflineClaim();
    }
  }

  function offlineBonusReady() {
    const p = state.pendingOffline;
    if (!p || p.claimed) return false;
    return Date.now() <= (Number(p.expiresAt) || 0);
  }

  function claimOfflineBonus() {
    const p = state.pendingOffline;
    if (!p || p.claimed) return 0;
    const bonusReady = offlineBonusReady();
    p.claimed = true;
    let bonus = 0;
    if (bonusReady && (Number(p.coins) || 0) > 0) {
      bonus = Math.floor(Number(p.coins) * OFFLINE_CLAIM_BONUS);
      if (bonus > 0) addCoins(bonus);
    }
    state.pendingOffline = null;
    hideOfflineClaim();
    if (bonus > 0) {
      setCatchLine(`Claim bonus +${formatNum(bonus)} coins (+${Math.round(OFFLINE_CLAIM_BONUS * 100)}%)`);
      playSfx("win");
    } else {
      setCatchLine("Haul claimed");
      playSfx("click");
    }
    render(false);
    saveSoon();
    return bonus;
  }

  function showOfflineClaim() {
    const overlay = document.getElementById("offline-claim-overlay");
    const body = document.getElementById("offline-claim-body");
    const bonusEl = document.getElementById("offline-claim-bonus");
    const p = state.pendingOffline;
    if (!overlay || !p) return;
    const bits = [];
    if (p.coins > 0) bits.push(`earned ${formatNum(p.coins)} coins`);
    if (p.chests > 0) bits.push(p.chests === 1 ? "1 chest" : `${p.chests} chests`);
    if (p.blocks > 0) bits.push(p.blocks === 1 ? "1 Lucky Block" : `${p.blocks} Lucky Blocks`);
    if (p.fish > 0) bits.push(p.fish === 1 ? "1 fish" : `${p.fish} fish`);
    if (body) {
      body.textContent = `While away (${Number(p.hours).toFixed(1)}h) your boat ${
        bits.length ? bits.join(" · ") : "kept casting"
      }.`;
    }
    if (bonusEl) {
      const pot = Math.floor((Number(p.coins) || 0) * OFFLINE_CLAIM_BONUS);
      bonusEl.textContent =
        pot > 0
          ? `Claim within ${Math.round(OFFLINE_CLAIM_BONUS_MS / 1000)}s for +${formatNum(pot)} (+${Math.round(
              OFFLINE_CLAIM_BONUS * 100
            )}%)`
          : "Tap claim to continue";
    }
    overlay.classList.remove("hidden");
  }

  function hideOfflineClaim() {
    document.getElementById("offline-claim-overlay")?.classList.add("hidden");
  }

  let coolerRenderKey = "";

  function coolerKey() {
    return `${state.spotId}|${state.coolerSort}|${state.coolerFilter}|${normalizeSearchQuery(
      state.coolerSearch
    )}|${state.cooler
      .map((e) => {
        const n = normalizeCoolerEntry(e) || {};
        return `${n.id || coolerEntryId(e)}${n.saved ? "*" : ""}${n.perfect ? "!" : ""}:${n.variant || ""}:${n.shiny ? 1 : 0}:${n.mutation || ""}`;
      })
      .join(",")}|${coolerMax()}|${sellBonus().toFixed(3)}|${perfectBonus().toFixed(3)}|${spotMasteryLevel()}|${comboActive() ? state.combo : 0}`;
  }

  function renderCooler(force = false) {
    if (
      (state.cooler || []).some((raw) => {
        const id = typeof raw === "string" ? raw : raw?.id;
        return isExclusiveFish(id);
      })
    ) {
      if (ensureExclusiveCoolerValues()) {
        try {
          saveState();
        } catch {}
      }
    }
    if (coolerCountEl) coolerCountEl.textContent = String(state.cooler.length);
    if (coolerMaxEl) coolerMaxEl.textContent = String(coolerMax());
    if (hudCoolerEl) hudCoolerEl.textContent = `${state.cooler.length}/${coolerMax()}`;
    if (sellBtn) {
      const unsaved = unsavedCoolerCount();
      sellBtn.disabled = unsaved === 0;
      sellBtn.textContent = unsaved === state.cooler.length ? "Sell all" : "Sell unsaved";
    }
    autoSellBox?.querySelectorAll("input[data-rarity]").forEach((input) => {
      const rarity = input.dataset.rarity;
      input.checked = shouldAutoSell(rarity);
    });
    syncAutoSellMutationsBtn();
    const sortEl = document.getElementById("cooler-sort");
    const filterEl = document.getElementById("cooler-filter");
    const searchEl = document.getElementById("cooler-search");
    if (sortEl && sortEl.value !== state.coolerSort) sortEl.value = state.coolerSort || "value";
    if (filterEl && filterEl.value !== state.coolerFilter) {
      filterEl.value = state.coolerFilter || "all";
    }
    if (searchEl && document.activeElement !== searchEl) {
      const q = state.coolerSearch || "";
      if (searchEl.value !== q) searchEl.value = q;
    }
    if (!coolerList) return;
    const nextKey = coolerKey();
    if (!force && nextKey === coolerRenderKey) return;
    coolerRenderKey = nextKey;
    const { rows, totalValid } = coolerEntriesView();
    const searchQ = normalizeSearchQuery(state.coolerSearch);
    const filter = state.coolerFilter || "all";
    const showingEl = document.getElementById("cooler-showing");
    if (showingEl) {
      const filtered = rows.length < totalValid;
      if (filtered) {
        showingEl.hidden = false;
        showingEl.textContent = `Showing ${rows.length} of ${totalValid}${
          searchQ ? ` · search “${searchQ}”` : ""
        }${filter !== "all" ? ` · filter ${filter}` : ""} — clear search/filter to see all.`;
      } else {
        showingEl.hidden = true;
        showingEl.textContent = "";
      }
    }
    if (!rows.length) {
      coolerList.innerHTML = searchQ || filter !== "all"
        ? `<p class="cooler-empty">No fish matching${
            searchQ ? ` “${searchQ.replace(/[<>&"]/g, "")}”` : ""
          }${filter !== "all" ? ` (${filter})` : ""}</p>`
        : `<p class="cooler-empty">Cooler is empty</p>`;
      if (shinyMachineOverlay && !shinyMachineOverlay.classList.contains("hidden")) {
        renderShinyMachine();
      }
      return;
    }
    coolerList.innerHTML = rows
      .map(({ index, entry, fish, val }) => {
        const saved = !!entry.saved;
        const exclusive = isExclusiveFish(fish);
        const unsellable = isUnsellableFish(fish, entry);
        const label = formatFishName(fish, entry);
        const vTitle = formatVariantTitle(entry);
        const perfectMark = entry.perfect ? " · perfect" : "";
        const vMult = variantValueMult(entry);
        const multTip = vMult > 1 ? ` · ×${formatMult(vMult)}` : "";
        let glyph = "";
        try {
          glyph = fishGlyphHtml(fish, entry, `c${index}`);
        } catch {
          glyph = "";
        }
        const sellTitle = exclusive || unsellable
          ? "Soul Twin — unsellable · aquarium bound"
          : saved
            ? "Saved — unpin to sell"
            : `Sell for ${formatNum(val)}${perfectMark}${multTip}${vTitle ? ` · ${vTitle}` : ""}`;
        return `<div class="fish-chip ${fish.rarity}${saved ? " is-saved" : ""}${
          exclusive ? " is-exclusive" : ""
        }${entry.perfect ? " is-perfect" : ""} ${variantClassList(entry)}" data-cooler-index="${index}">
          <span class="fish-chip-glyph" aria-hidden="true">${glyph}</span>
          <button type="button" class="fish-chip-save" data-save-index="${index}" title="${
            exclusive
              ? "Always in Aquarium"
              : saved
                ? "Unsave — remove from Aquarium"
                : "Save fish (Aquarium · won't sell)"
          }" aria-label="${saved ? "Unsave" : "Save"} ${label}" aria-pressed="${saved}" ${
            exclusive ? "disabled" : ""
          }>${saved ? "★" : "☆"}</button>
          <button type="button" class="fish-chip-sell" data-sell-index="${index}" title="${sellTitle}" ${
            saved || unsellable || exclusive ? "disabled" : ""
          }>
            <span class="fish-chip-name">${label}${exclusive ? " · bound" : ""}</span>
            <span class="fish-chip-price">${formatNum(val)}</span>
          </button>
        </div>`;
      })
      .join("");
    if (shinyMachineOverlay && !shinyMachineOverlay.classList.contains("hidden")) {
      renderShinyMachine();
    }
  }

  function renderSpots() {
    if (!spotList) return;
    spotList.innerHTML = SPOTS.map((spot) => {
      const unlocked = !!state.unlocked[spot.id];
      const active = state.spotId === spot.id;
      let action;
      if (active) action = `<button type="button" class="spot-btn is-active" disabled>Here</button>`;
      else if (unlocked)
        action = `<button type="button" class="spot-btn" data-spot="${spot.id}">Fish</button>`;
      else
        action = `<button type="button" class="spot-btn" data-spot="${spot.id}" ${
          state.coins >= spot.cost ? "" : "disabled"
        }>${formatNum(spot.cost)}</button>`;
      return `<div class="spot-item ${active ? "active" : ""}" data-spot-id="${spot.id}" role="listitem">
        <div class="spot-item-main">
          <div class="spot-item-name">${spot.name}</div>
          <p class="spot-item-desc">${
            unlocked
              ? `${spot.blurb} · sell ×${spot.valueMult} · +${spotLuckBonus(spot)} luck · mastery Lv ${spotMasteryLevel(
                  spot.id
                )} (${spotMasteryCasts(spot.id)} casts)`
              : "Locked spot"
          }</p>
        </div>
        ${action}
      </div>`;
    }).join("");
  }

  /* ========== SMART GEAR SHOP helpers (deletable with SMART_GEAR_SHOP) ========== */
  function smartShopOn() {
    return SMART_GEAR_SHOP && state.smartShop !== false;
  }

  function syncSmartShopToggle() {
    const btn = document.getElementById("smart-shop-toggle");
    if (!btn) return;
    if (!SMART_GEAR_SHOP) {
      btn.hidden = true;
      return;
    }
    btn.hidden = false;
    const on = smartShopOn();
    btn.setAttribute("aria-pressed", on ? "true" : "false");
    btn.textContent = on ? "Simple list" : "Smart shop";
    btn.title = on
      ? "Show the full classic gear list"
      : "Show next upgrades and collapse owned gear";
  }

  function shopSmartKey(kind, part) {
    return `${kind}:${part}`;
  }

  function shopSmartIsOpen(kind, part) {
    return !!shopSmartExpand[shopSmartKey(kind, part)];
  }

  function shopSmartOwnedSum(kind) {
    return ownedGear(kind).reduce((s, g) => s + (Number(g.amount) || 0), 0);
  }

  function shopSmartDeltaExtra(item) {
    const kind = item.kind;
    const amt = Number(item.amount) || 0;
    if (kind === "speed") {
      const cur = equippedSpeedGear()?.amount || 0;
      if (amt <= cur + 1e-9) {
        return "Weaker than equipped bait — skip";
      }
      const beforeWait = Math.round((1 - cur) * 1000) / 10;
      const afterWait = Math.round(Math.max(0.002, 1 - amt) * 1000) / 10;
      if (beforeWait === afterWait) return "At wait cap — little/no gain";
      return `Wait ${beforeWait}% → ${afterWait}% of base`;
    }
    const sum = shopSmartOwnedSum(kind);
    if (kind === "window") {
      const before = Math.min(5.5, 0.45 + sum);
      const after = Math.min(5.5, 0.45 + sum + amt);
      if (after <= before + 1e-9) return "Bite window at 5.5s cap";
      return `Window ${before.toFixed(2)}s → ${after.toFixed(2)}s`;
    }
    if (kind === "multi") {
      const before = Math.min(0.9995, sum);
      const after = Math.min(0.9995, sum + amt);
      if (after <= before + 1e-9) return "Second-catch at 99.95% cap";
      return `2nd catch ${(before * 100).toFixed(2)}% → ${(after * 100).toFixed(2)}%`;
    }
    if (kind === "triple") {
      const before = Math.min(0.99, sum);
      const after = Math.min(0.99, sum + amt);
      if (after <= before + 1e-9) return "Third-catch at 99% cap";
      return `3rd catch ${(before * 100).toFixed(1)}% → ${(after * 100).toFixed(1)}%`;
    }
    if (kind === "quad") {
      const before = Math.min(0.99, sum);
      const after = Math.min(0.99, sum + amt);
      if (after <= before + 1e-9) return "Fourth-catch at 99% cap";
      return `4th catch ${(before * 100).toFixed(1)}% → ${(after * 100).toFixed(1)}%`;
    }
    if (kind === "penta") {
      const before = Math.min(0.99, sum);
      const after = Math.min(0.99, sum + amt);
      if (after <= before + 1e-9) return "Fifth-catch at 99% cap";
      return `5th catch ${(before * 100).toFixed(1)}% → ${(after * 100).toFixed(1)}%`;
    }
    if (kind === "looks") {
      const before = Math.min(120, sum);
      const after = Math.min(120, sum + amt);
      if (after <= before + 1e-9) return "Looks boost at cap";
      return `Looks +${(before * 100).toFixed(0)}% → +${(after * 100).toFixed(0)}%`;
    }
    if (kind === "chest") {
      const before = Math.min(150, sum);
      const after = Math.min(150, sum + amt);
      if (after <= before + 1e-9) return "Chest find boost at cap";
      return `Chests +${(before * 100).toFixed(0)}% → +${(after * 100).toFixed(0)}%`;
    }
    if (kind === "combo") {
      const before = Math.min(2500, sum);
      const after = Math.min(2500, sum + amt);
      if (after <= before + 1e-9) return "Combo hold at cap";
      return `Combo ${45 + before}s → ${45 + after}s`;
    }
    if (kind === "luck") {
      return `Luck ${formatNum(sum)} → ${formatNum(sum + amt)}`;
    }
    if (kind === "cooler") {
      return `Slots ${COOLER_BASE + sum} → ${COOLER_BASE + sum + amt}`;
    }
    if (kind === "value") {
      return `Sell ${formatPctBonus(sum)} → ${formatPctBonus(sum + amt)}`;
    }
    if (kind === "perfect") {
      return `Perfect pay ${formatPctBonus(sum)} → ${formatPctBonus(sum + amt)}`;
    }
    return "";
  }

  function shopSmartSummary(kind) {
    if (kind === "speed") {
      const eq = equippedSpeedGear();
      if (!eq) return "No bait equipped";
      return `Equipped ${eq.name} (−${Math.round(eq.amount * 100)}% wait)`;
    }
    const sum = shopSmartOwnedSum(kind);
    const n = ownedGear(kind).length;
    if (kind === "luck") {
      const echo = echoLuckBonus();
      const parts = [];
      if (n) parts.push(`${n} owned · +${formatNum(sum)} luck`);
      else parts.push("No luck gear owned yet");
      if (echo > 0) parts.push(`Echo Charm +${formatLuckAmt(echo)}`);
      return parts.join(" · ");
    }
    if (!n) return "None owned yet";
    if (kind === "window") {
      const w = Math.min(5.5, 0.45 + sum);
      return `${n} owned · window ${w.toFixed(2)}s / 5.5s`;
    }
    if (kind === "cooler") return `${n} owned · ${COOLER_BASE + sum} slots`;
    if (kind === "value") return `${n} owned · sell ${formatPctBonus(sum)}`;
    if (kind === "perfect") return `${n} owned · perfect ${formatPctBonus(sum)}`;
    if (kind === "multi") {
      return `${n} owned · 2nd ${Math.min(99.95, Math.round(sum * 10000) / 100)}% / 99.95%`;
    }
    if (kind === "triple") {
      return `${n} owned · 3rd ${Math.min(99, Math.round(sum * 1000) / 10)}% / 99%`;
    }
    if (kind === "quad") {
      return `${n} owned · 4th ${Math.min(99, Math.round(sum * 1000) / 10)}% / 99%`;
    }
    if (kind === "penta") {
      return `${n} owned · 5th ${Math.min(99, Math.round(sum * 1000) / 10)}% / 99%`;
    }
    if (kind === "looks") {
      return `${n} owned · looks +${Math.min(12000, Math.round(sum * 100))}%`;
    }
    if (kind === "chest") {
      return `${n} owned · chests +${Math.min(15000, Math.round(sum * 100))}%`;
    }
    if (kind === "combo") {
      return `${n} owned · combo ${45 + Math.min(2500, Math.round(sum))}s`;
    }
    return `${n} owned`;
  }

  function echoLuckRow() {
    const n = echoLuckLevel();
    const cost = echoLuckCost();
    const next = echoLuckNextBonus();
    const now = echoLuckBonus();
    const atCap = echoLuckAtCap();
    const canBuy = !atCap && Number.isFinite(cost) && state.coins >= cost;
    const desc = atCap
      ? `Maxed at +${formatLuckAmt(ECHO_LUCK_BONUS_CAP)} luck`
      : n <= 0
        ? `+${formatLuckAmt(next)} luck · each buy doubles luck and triples cost · cap ${formatLuckAmt(ECHO_LUCK_BONUS_CAP)}`
        : `+${formatLuckAmt(now)} luck → +${formatLuckAmt(next)} luck · cost ×3 · cap ${formatLuckAmt(ECHO_LUCK_BONUS_CAP)}`;
    const status = atCap
      ? `MAX · +${formatLuckAmt(now)} luck`
      : n <= 0
        ? "Buy forever — starts at 1 coin"
        : `Bought ${formatNum(n)}× · +${formatLuckAmt(now)} luck`;
    const btn = atCap || !Number.isFinite(cost)
      ? `<button type="button" class="buy-btn" disabled>MAX</button>`
      : `<button type="button" class="buy-btn" data-buy="${ECHO_LUCK_ID}" ${
          canBuy ? "" : "disabled"
        }>${formatNum(cost)}</button>`;
    return `<div class="shop-item shop-item-echo is-next-upgrade" role="listitem" data-shop-kind="luck">
        <div class="shop-item-main">
          <div class="shop-item-name">Echo Charm</div>
          <p class="shop-item-desc">${desc}</p>
          <div class="shop-item-owned">${status}</div>
        </div>
        ${btn}
      </div>`;
  }

  function shopSmartCategoryRows(kind, gearRow) {
    const items = GEAR.filter((g) => g.kind === kind);
    const owned = items.filter((g) => state.owned[g.id]);
    const unowned = items.filter((g) => !state.owned[g.id]);
    const showOwned = shopSmartIsOpen(kind, "owned");
    const showMore = shopSmartIsOpen(kind, "more");
    const upcomingVisible = 2;
    const head = unowned.slice(0, upcomingVisible);
    const rest = unowned.slice(upcomingVisible);

    let html = kind === "luck" ? echoLuckRow() : "";
    html += `<div class="shop-smart-summary">${shopSmartSummary(kind)}</div>`;

    if (!unowned.length && owned.length) {
      html += `<div class="shop-smart-maxed">Category maxed</div>`;
    }

    head.forEach((item, i) => {
      html += gearRow(item, {
        next: i === 0,
        extra: shopSmartDeltaExtra(item)
      });
    });

    if (rest.length) {
      if (showMore) {
        rest.forEach((item) => {
          html += gearRow(item, { extra: shopSmartDeltaExtra(item) });
        });
        html += `<button type="button" class="shop-smart-toggle" data-shop-smart="${kind}" data-shop-smart-part="more">Hide ${rest.length} later upgrades</button>`;
      } else {
        html += `<button type="button" class="shop-smart-toggle" data-shop-smart="${kind}" data-shop-smart-part="more">Show ${rest.length} more upgrades</button>`;
      }
    }

    if (owned.length) {
      if (showOwned) {
        owned.forEach((item) => {
          const muted =
            kind === "speed" &&
            state.equippedSpeed !== item.id &&
            item.amount < (equippedSpeedGear()?.amount || 0);
          html += gearRow(item, { muted });
        });
        html += `<button type="button" class="shop-smart-toggle" data-shop-smart="${kind}" data-shop-smart-part="owned">Hide ${owned.length} owned</button>`;
      } else {
        html += `<button type="button" class="shop-smart-toggle" data-shop-smart="${kind}" data-shop-smart-part="owned">Show ${owned.length} owned</button>`;
      }
    }

    return html;
  }
  /* ========== END SMART GEAR SHOP helpers ========== */

  function renderShop() {
    if (!shopList) return;

    function gearRow(item, opts = {}) {
      const owned = !!state.owned[item.id];
      const exclusive = item.kind === "speed";
      const equipped = exclusive && state.equippedSpeed === item.id;
      let status = owned ? "Owned" : "Not owned";
      if (exclusive && owned) status = equipped ? "Equipped" : "Owned · tap Equip";
      if (opts.next) status = "Next upgrade";
      let action;
      if (!owned) {
        action = `<button type="button" class="buy-btn" data-buy="${item.id}" ${
          state.coins < item.cost ? "disabled" : ""
        }>${formatNum(item.cost)}</button>`;
      } else if (exclusive && !equipped) {
        action = `<button type="button" class="buy-btn equip-btn" data-equip="${item.id}">Equip</button>`;
      } else {
        action = `<button type="button" class="buy-btn" disabled>✓</button>`;
      }
      const classes = [
        "shop-item",
        equipped ? "is-equipped" : "",
        opts.next ? "is-next-upgrade" : "",
        opts.muted ? "is-soft-muted" : ""
      ]
        .filter(Boolean)
        .join(" ");
      const extra = opts.extra
        ? `<p class="shop-item-smart-extra">${opts.extra}</p>`
        : "";
      return `<div class="${classes}" role="listitem" data-shop-kind="${item.kind}">
        <div class="shop-item-main">
          <div class="shop-item-name">${item.name}</div>
          <p class="shop-item-desc">${item.desc}</p>
          ${extra}
          <div class="shop-item-owned">${status}</div>
        </div>
        ${action}
      </div>`;
    }

    function boatRow() {
      const next = nextBoatTier();
      const current = getBoat();
      let boatOwned;
      let boatDesc;
      let boatBtn;
      if (!next) {
        boatOwned = `Maxed · Lv${BOAT_MAX_LEVEL}`;
        boatDesc = `${current.name} every ${current.amount}s · ${BOAT_TIERS[current.level]?.multiHint || ""}`;
        boatBtn = `<button type="button" class="buy-btn" disabled>✓</button>`;
      } else if (!current) {
        boatOwned = "Not owned";
        boatDesc = `Hire ${next.name} — every ${next.interval}s · ${next.multiHint}`;
        boatBtn = `<button type="button" class="buy-btn" data-buy="boat" ${
          state.coins < next.cost ? "disabled" : ""
        }>${formatNum(next.cost)}</button>`;
      } else {
        boatOwned = `Owned · Lv${current.level}/${BOAT_MAX_LEVEL}`;
        boatDesc = `Lv${current.level} ${current.name} (${current.amount}s) → Lv${next.level} ${next.name} (${next.interval}s) · ${next.multiHint}`;
        boatBtn = `<button type="button" class="buy-btn" data-buy="boat" ${
          state.coins < next.cost ? "disabled" : ""
        }>${formatNum(next.cost)}</button>`;
      }
      return `<div class="shop-item shop-item-boat" role="listitem" data-shop-kind="boat">
        <div class="shop-item-main">
          <div class="shop-item-name">Auto Boat</div>
          <p class="shop-item-desc">${boatDesc}</p>
          <div class="shop-item-owned">${boatOwned}</div>
        </div>
        ${boatBtn}
      </div>`;
    }

    const active = shopCat || "all";
    shopCats?.querySelectorAll("[data-shop-cat]").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.shopCat === active);
    });

    shopList.classList.toggle("shop-smart", smartShopOn());
    syncSmartShopToggle();

    const cats = SHOP_CATEGORIES.filter((c) => active === "all" || c.id === active);
    shopList.innerHTML = cats
      .map((cat) => {
        const rows =
          cat.id === "boat"
            ? boatRow()
            : smartShopOn()
              ? shopSmartCategoryRows(cat.id, gearRow)
              : (cat.id === "luck" ? echoLuckRow() : "") +
                GEAR.filter((g) => g.kind === cat.id).map((g) => gearRow(g)).join("");
        return `<div class="shop-category" data-category="${cat.id}">
          <div class="shop-category-head">
            <div class="shop-category-title">${cat.title}</div>
            <div class="shop-category-blurb">${cat.blurb}</div>
          </div>
          ${rows}
        </div>`;
      })
      .join("");
  }

  function formatPctBonus(n, signed = true) {
    const pct = (Number(n) || 0) * 100;
    if (!Number.isFinite(pct)) return signed ? "+0%" : "0%";
    const abs = Math.abs(pct);
    const text =
      abs < 1000
        ? (() => {
            const rounded = Math.round(abs * 10) / 10;
            return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
          })()
        : formatNum(abs);
    if (!signed) return `${text}%`;
    if (pct > 0) return `+${text}%`;
    if (pct < 0) return `-${text}%`;
    return `${text}%`;
  }

  function weatherBlurb(id = "none") {
    if (id === "storm") return "More high-tier fish · slower bites";
    if (id === "calm") return "Faster bites · slightly leaner rares";
    return "No weather effect";
  }

  function weatherIcon(id = "none") {
    if (id === "storm") return "⛈";
    if (id === "calm") return "🌊";
    return "☀";
  }

  function ensureRainDrops() {
    const layer = document.getElementById("wx-rain-layer");
    if (!layer || layer.dataset.ready === "1") return;
    const n = 72;
    let html = "";
    for (let i = 0; i < n; i += 1) {
      const left = ((i * 37) % 100) + (i % 7) * 0.35;
      const delay = -((i * 0.17) % 4.5);
      const dur = 0.75 + (i % 9) * 0.12 + (i % 3) * 0.05;
      const size = 0.7 + (i % 5) * 0.18;
      const drift = ((i % 5) - 2) * 0.35;
      const opacity = 0.35 + (i % 6) * 0.08;
      html += `<span class="wx-drop" style="--dx:${left.toFixed(2)}%;--delay:${delay.toFixed(2)}s;--dur:${dur.toFixed(2)}s;--size:${size.toFixed(2)};--drift:${drift.toFixed(2)}px;--op:${opacity.toFixed(2)}"></span>`;
    }
    layer.innerHTML = html;
    layer.dataset.ready = "1";
  }

  let lastWeatherSoundId = "";

  function syncWeatherSound(id = "none", force = false) {
    if (!force && id === lastWeatherSoundId) return;
    // While muted, don't remember this weather as "already playing" — otherwise
    // turning sound back on never restarts storm/calm ambient without a refresh.
    if (window.HubSound?.isEnabled?.() === false) {
      lastWeatherSoundId = "";
      return;
    }
    lastWeatherSoundId = id;
    if (id === "storm") playSfx("weather-storm");
    else if (id === "calm") playSfx("weather-calm");
    else playSfx("weather-none");
  }

  function restartWeatherSound() {
    lastWeatherSoundId = "";
    const id = document.body?.dataset?.weather || ensureWeather()?.id || "none";
    syncWeatherSound(id, true);
  }

  function applyWeatherFx(wx = ensureWeather()) {
    const id = wx?.id || "none";
    const left = Math.max(0, (state.weatherUntil || 0) - Date.now());
    document.body.dataset.weather = id;
    const stage = document.querySelector(".cast-stage");
    if (stage) stage.dataset.weather = id;
    const fx = document.getElementById("weather-fx");
    if (fx) {
      fx.classList.toggle("is-storm", id === "storm");
      fx.classList.toggle("is-calm", id === "calm");
      fx.classList.toggle("is-active", id !== "none");
      fx.classList.toggle("no-lightning-flash", !lightningFlashEnabled());
    }
    document.body.classList.toggle("no-lightning-flash", !lightningFlashEnabled());
    if (id === "storm") ensureRainDrops();
    syncWeatherSound(id);

    const banner = document.getElementById("weather-banner");
    const iconEl = document.getElementById("weather-banner-icon");
    const tagEl = document.getElementById("weather-banner-tag");
    const titleEl = document.getElementById("weather-banner-title");
    const effectEl = document.getElementById("weather-banner-effect");
    const timeEl = document.getElementById("weather-banner-time");
    if (banner) {
      banner.classList.toggle("weather-storm", id === "storm");
      banner.classList.toggle("weather-calm", id === "calm");
      banner.classList.toggle("weather-none", id === "none");
      banner.classList.toggle("is-live", id !== "none");
    }
    if (iconEl) iconEl.textContent = weatherIcon(id);
    if (tagEl) tagEl.textContent = id === "none" ? "Weather" : "Live weather";
    if (titleEl) titleEl.textContent = id === "none" ? "Clear skies" : wx.label;
    if (effectEl) effectEl.textContent = weatherBlurb(id);
    if (timeEl) timeEl.textContent = formatBannerClock(left);
  }

  function applySpotTheme() {
    const id = currentSpot()?.id || "creek";
    document.body.dataset.spot = id;
    if (castBtn) castBtn.dataset.spot = id;
    const mood = document.getElementById("spot-mood");
    if (mood) mood.textContent = currentSpot()?.name || "Creek";
    applyWeatherFx();
  }

  function renderFeatureChips() {
    const wx = ensureWeather();
    const weatherChip = document.getElementById("weather-chip");
    const weatherLabel = document.getElementById("weather-label");
    const weatherEffect = document.getElementById("weather-effect");
    const masteryChip = document.getElementById("mastery-chip");
    const masteryLabel = document.getElementById("mastery-label");
    const comboChip = document.getElementById("combo-chip");
    const comboLabel = document.getElementById("combo-label");
    const aquaChip = document.getElementById("aquarium-chip");
    const aquaLabel = document.getElementById("aquarium-label");
    const communityChip = document.getElementById("community-chip");
    const communityLabel = document.getElementById("community-label");
    const now = Date.now();

    applyWeatherFx(wx);
    if (weatherLabel) {
      weatherLabel.textContent =
        wx.id === "none" ? "Clear" : `${weatherIcon(wx.id)} ${wx.label}`;
    }
    if (weatherEffect) weatherEffect.textContent = weatherBlurb(wx.id);
    weatherChip?.classList.toggle("weather-storm", wx.id === "storm");
    weatherChip?.classList.toggle("weather-calm", wx.id === "calm");
    weatherChip?.classList.toggle("weather-none", wx.id === "none");
    weatherChip?.classList.toggle("is-live", wx.id !== "none");

    const mLv = spotMasteryLevel();
    const mCasts = spotMasteryCasts();
    const mNext = (mLv + 1) * SPOT_MASTERY_PER;
    if (masteryLabel) {
      masteryLabel.textContent =
        mLv >= SPOT_MASTERY_MAX
          ? `Lv ${mLv} MAX · +${formatPctBonus(spotMasterySellBonus())} sell · +${spotMasteryLuckBonus()} luck`
          : `Lv ${mLv} · ${mCasts}/${mNext} · +${formatPctBonus(spotMasterySellBonus())} sell`;
    }
    masteryChip?.classList.toggle("is-live", mLv > 0);

    const comboOn = comboActive(now);
    if (comboLabel) {
      comboLabel.textContent = comboOn
        ? `×${state.combo} · ${formatTreasureClock(Math.max(0, state.comboBoostUntil - now))}`
        : "—";
    }
    comboChip?.classList.toggle("is-live", comboOn);
    comboChip?.classList.toggle("hidden", !comboOn);

    tickAquarium();
    const bank = Math.floor(Number(state.aquariumBank) || 0);
    const rate = aquariumRatePerSec();
    if (aquaLabel) {
      aquaLabel.textContent =
        rate > 0
          ? `${formatNum(bank)} banked · ${formatNum(Math.max(1, Math.floor(rate * 60)))}/min`
          : bank > 0
            ? `${formatNum(bank)} banked`
            : "Save fish for drip";
    }
    aquaChip?.classList.toggle("is-live", bank > 0 || rate > 0);
    const aquaBtn = document.getElementById("aquarium-claim-btn");
    if (aquaBtn) aquaBtn.disabled = bank <= 0;

    const reward = communityRewardLive(now);
    const total = communityDisplayTotal();
    const goal = communityCache.goal || COMMUNITY_GOAL;
    const pct = Math.min(100, Math.floor((100 * total) / Math.max(1, goal)));
    const finished = communityMeterFinished();
    const pending = Math.max(0, Math.floor(Number(state.communityPendingAdds) || 0));
    const meterLive = !finished || reward;
    if (communityLabel) {
      if (reward) {
        const lbTip =
          (state.communityContrib || 0) > 0 &&
          (String(state.communityLbClaimedKey || "") === String(communityCache.weekKey || "") ||
            (communityCache.lbWave &&
              state.communityLbClaimedWave === communityCache.lbWave))
            ? " · Astral claimed"
            : (state.communityContrib || 0) > 0
              ? " · +Astral LB"
              : "";
        communityLabel.textContent = `${formatMult(clampCommunityRewardMult(communityCache.rewardMult))}× luck · ${formatTreasureClock(
          Math.max(0, communityCache.rewardUntil - now)
        )}${lbTip}`;
      } else if (!finished) {
        const syncTip = communityRateLimited(now)
          ? " · syncing later"
          : pending > 0
            ? ` · +${formatNum(pending)} pending`
            : "";
        communityLabel.textContent = `${formatNum(total)}/${formatNum(goal)} · ${pct}% · you ${formatNum(
          state.communityContrib || 0
        )}${syncTip}`;
      } else {
        communityLabel.textContent = "Complete · restarting…";
        if (Date.now() - communityFetchAt > 5000) {
          syncCommunity(true).catch(() => {});
        }
      }
    }
    communityChip?.classList.toggle("is-live", meterLive || !finished);
    communityChip?.classList.toggle("is-reward", reward);
    const fill = document.getElementById("community-fill");
    if (fill) fill.style.width = `${finished && !reward ? 100 : pct}%`;
  }

  function renderStats() {
    const spot = currentSpot();
    const bestFish = fishById(state.bestCatchId) || fishFromCatchScore(state.bestCatchScore);
    const bestLabel = bestFish ? formatBestCatch(bestFish) : "—";
    const bait = equippedSpeedGear();
    const waitCut = bait ? Math.round(bait.amount * 100) : 0;
    const moneyLeft = moneyMsLeft();
    const luckLeft = luckMsLeft();
    const eventLeft = eventMsLeft();
    const eventKind = currentEventKind();
    const eventLive = eventIsLive();
    const lbLive = luckyBlockEventIsLive();
    const lbLeft = luckyBlockEventMsLeft();
    const lbPassive =
      !lbLive && hasCollectionLbAlwaysBonus() && luckyBlockEventChance() > 0;
    const moneyOn = moneyBoostActive() || eventMoneyActive();
    const luckOn = luckBoostActive() || eventLuckActive();
    clearExpiredChestBoosts();
    maybeAnnounceEvent();
    document.body.classList.toggle("treasure-boost", moneyOn || luckOn);
    document.body.classList.toggle("treasure-money-boost", moneyOn);
    document.body.classList.toggle("treasure-luck-boost", luckOn);
    document.body.classList.toggle("event-money", eventMoneyActive());
    document.body.classList.toggle("event-luck", eventLuckActive());
    document.body.classList.toggle("event-luckyblock", lbLive || lbPassive);
    document.body.classList.toggle("event-variant", !!adminVariantEventLive());
    document.body.classList.toggle("event-mutation", adminMutationEventsLive().length > 0);
    document.body.classList.toggle(
      "event-idle",
      !eventLive &&
        !adminVariantEventLive() &&
        !adminMutationEventsLive().length &&
        !lbLive &&
        !lbPassive
    );
    applySpotTheme();
    if (coinCountEl) coinCountEl.textContent = formatNum(state.coins);
    if (spotLabelEl) spotLabelEl.textContent = spot.name;
    if (hudSpotEl) hudSpotEl.textContent = spot.name;
    if (windowLabelEl) windowLabelEl.textContent = `${biteWindow().toFixed(2)}s`;
    if (waitLabelEl) {
      const wx = ensureWeather();
      const wxWait = Math.round((1 - wx.wait) * 100);
      const baitBits = waitCut ? `−${waitCut}% bait` : "";
      const weatherBits =
        wx.wait < 1
          ? `−${Math.abs(wxWait)}% ${wx.label}`
          : wx.wait > 1
            ? `+${wxWait}% ${wx.label}`
            : "";
      waitLabelEl.textContent =
        [baitBits, weatherBits].filter(Boolean).join(" · ") || "—";
    }
    if (luckLabelEl) {
      const luck = totalLuckBonus();
      const maxBase = maxBaseLuck(spot);
      const activeBase = baseLuck(spot);
      luckLabelEl.textContent = luck > 0 ? `+${formatLuckAmt(luck)}` : String(Math.round(luck) || 0);
      if (luckMaxLabelEl) {
        luckMaxLabelEl.textContent =
          maxBase > 0 && (!state.luckDialFollowMax || activeBase < maxBase * 0.999)
            ? `· max +${formatLuckAmt(maxBase * treasureLuckMult())}`
            : "";
      }
      if (luckDialEl) {
        if (maxBase < 1) {
          luckDialEl.disabled = true;
          luckDialEl.min = "0";
          luckDialEl.max = "1";
          luckDialEl.value = "1";
        } else {
          const step =
            maxBase < 1000 ? 1 : Math.max(1, Math.floor(maxBase / 500));
          luckDialEl.disabled = false;
          luckDialEl.min = "1";
          luckDialEl.max = String(maxBase);
          luckDialEl.step = String(step);
          luckDialEl.value = String(activeBase);
        }
      }
    }
    if (sellLabelEl) sellLabelEl.textContent = formatPctBonus(totalSellFactor() - 1);
    if (eventChipEl) {
      const variant = adminVariantEventLive();
      const mutations = adminMutationEventsLive();
      const previewKind = eventLive ? eventKind : eventKindForStart(nextHalfHourStart());
      eventChipEl.classList.toggle("event-money", eventLive && previewKind === "money");
      eventChipEl.classList.toggle("event-luck", eventLive && previewKind === "luck");
      eventChipEl.classList.toggle("event-luckyblock", lbLive || lbPassive);
      eventChipEl.classList.toggle("event-variant", !!variant);
      eventChipEl.classList.toggle("event-mutation", mutations.length > 0);
      eventChipEl.classList.toggle(
        "event-idle",
        !eventLive && !variant && !mutations.length && !lbLive && !lbPassive
      );
    }
    if (eventLabelEl) {
      const variant = adminVariantEventLive();
      const mutations = adminMutationEventsLive();
      const admin = adminBoostEventLive();
      const multLabel = formatMult(liveEventMult());
      const parts = [];
      if (eventLive && eventKind === "luck") {
        parts.push(
          `${admin ? "Admin " : ""}${multLabel}× luck · ${formatTreasureClock(eventLeft)}`
        );
      } else if (eventLive && eventKind === "money") {
        parts.push(
          `${admin ? "Admin " : ""}${multLabel}× sell · ${formatTreasureClock(eventLeft)}`
        );
      }
      if (lbLive) {
        parts.push(`${formatLuckyBlockEventLabel()} · ${formatTreasureClock(lbLeft)}`);
      } else if (hasCollectionLbAlwaysBonus() && luckyBlockEventChance() > 0) {
        parts.push(`${formatLuckyBlockEventLabel()} · anytime`);
      }
      if (variant) {
        parts.push(
          `Admin ${formatMult(variant.mult)}× ${formatAdminVariantLabel(
            variant.target
          )} · ${formatTreasureClock(Math.max(0, variant.until - Date.now()))}`
        );
      }
      mutations.forEach((mutation) => {
        parts.push(
          `Admin ${formatMult(mutation.mult)}× ${adminEventKindLabel(mutation)} · ${formatTreasureClock(Math.max(0, mutation.until - Date.now()))}`
        );
      });
      if (parts.length) {
        const hasTimed =
          (eventLive && (eventKind === "luck" || eventKind === "money")) ||
          lbLive ||
          !!variant ||
          mutations.length > 0;
        eventLabelEl.textContent = hasTimed
          ? `${parts.join(" · ")} left`
          : parts.join(" · ");
      } else {
        const nextStart = nextHalfHourStart();
        const nextKind = eventKindForStart(nextStart);
        const afterStart = nextStart + EVENT_MS;
        const afterKind = eventKindForStart(afterStart);
        const nextMult = formatMult(eventMultForStart(nextStart));
        const afterMult = formatMult(eventMultForStart(afterStart));
        const nextLbMult = formatMult(luckyBlockEventMultForStart(nextHourStart()));
        eventLabelEl.textContent = `Next ${nextMult}× ${
          nextKind === "luck" ? "luck" : "sell"
        } in ${formatTreasureClock(msUntilNextEvent())} · then ${afterMult}× ${
          afterKind === "luck" ? "luck" : "sell"
        } · ${nextLbMult}× Lucky Blocks in ${formatTreasureClock(msUntilNextLuckyBlockEvent())}`;
      }
    }
    renderEventBanner();
    syncAdminPanel();
    maybeRefreshGuide();
    if (moneyChipEl) moneyChipEl.classList.toggle("hidden", !moneyOn);
    if (moneyLabelEl) {
      if (!moneyOn) moneyLabelEl.textContent = "—";
      else {
        const bits = [`${formatMult(treasureMoneyMult())}×`];
        if (moneyBoostActive()) bits.push(`chest ${formatTreasureClock(moneyLeft)} left`);
        if (eventMoneyActive()) bits.push(`event ${formatTreasureClock(eventLeft)} left`);
        moneyLabelEl.textContent = bits.join(" · ");
      }
    }
    if (luckChipEl) luckChipEl.classList.toggle("hidden", !luckOn);
    if (luckBoostLabelEl) {
      if (!luckOn) luckBoostLabelEl.textContent = "—";
      else {
        const bits = [`${formatMult(treasureLuckMult())}×`];
        if (luckBoostActive()) bits.push(`chest ${formatTreasureClock(luckLeft)} left`);
        if (eventLuckActive()) bits.push(`event ${formatTreasureClock(eventLeft)} left`);
        luckBoostLabelEl.textContent = bits.join(" · ");
      }
    }
    if (multiLabelEl) multiLabelEl.textContent = formatPctBonus(multiCatchChance(), false);
    if (tripleLabelEl) tripleLabelEl.textContent = formatPctBonus(tripleCatchChance(), false);
    if (quadLabelEl) quadLabelEl.textContent = formatPctBonus(quadCatchChance(), false);
    if (pentaLabelEl) pentaLabelEl.textContent = formatPctBonus(pentaCatchChance(), false);
    if (looksLabelEl) looksLabelEl.textContent = formatPctBonus(looksBonus());
    if (chestLabelEl) chestLabelEl.textContent = formatPctBonus(chestFindBonus());
    if (comboHoldLabelEl) comboHoldLabelEl.textContent = `${Math.round(comboHoldMs() / 1000)}s`;
    if (perfectLabelEl) perfectLabelEl.textContent = formatPctBonus(perfectBonus());
    if (coolerStatLabelEl) coolerStatLabelEl.textContent = String(coolerMax());
    renderFeatureChips();
    if (hudBestEl) hudBestEl.textContent = bestLabel;
    if (overlayBestEl) overlayBestEl.textContent = bestLabel;
    renderTreasureStash();
    renderCollectionHud();
    renderBoatTimers();
  }

  function renderTreasureStash() {
    const money = Math.max(0, Math.floor(Number(state.moneyChestCount) || 0));
    const luck = Math.max(0, Math.floor(Number(state.luckChestCount) || 0));
    const astralBlocks = luckyBlockCount("astral");
    const absoluteBlocks = luckyBlockCount("absolute");
    const zenithBlocks = luckyBlockCount("zenith");
    const moneyLeft = moneyMsLeft();
    const luckLeft = luckMsLeft();
    const moneyOn = moneyBoostActive();
    const luckOn = luckBoostActive();
    const moneyHeld = moneyLeft > 0;
    const luckHeld = luckLeft > 0;
    const moneyPaused = moneyBoostPaused();
    const luckPaused = luckBoostPaused();
    const showAstral = isFishingOwner() || astralBlocks > 0;
    const showAbsolute = isFishingOwner() || absoluteBlocks > 0;
    const showZenith = isFishingOwner() || zenithBlocks > 0;
    if (moneyCountEl) moneyCountEl.textContent = String(money);
    if (luckCountEl) luckCountEl.textContent = String(luck);
    if (astralLuckyBlockCountEl) astralLuckyBlockCountEl.textContent = String(astralBlocks);
    if (absoluteLuckyBlockCountEl) absoluteLuckyBlockCountEl.textContent = String(absoluteBlocks);
    if (zenithLuckyBlockCountEl) zenithLuckyBlockCountEl.textContent = String(zenithBlocks);
    if (moneyChestTimerEl) {
      moneyChestTimerEl.classList.toggle("hidden", !moneyHeld);
      moneyChestTimerEl.classList.toggle("is-paused", moneyPaused);
      moneyChestTimerEl.disabled = !moneyHeld;
      moneyChestTimerEl.setAttribute("aria-pressed", moneyPaused ? "true" : "false");
      moneyChestTimerEl.textContent = !moneyHeld
        ? ""
        : moneyPaused
          ? `${formatTreasureClock(moneyLeft)} paused`
          : `${formatTreasureClock(moneyLeft)} left`;
    }
    if (luckChestTimerEl) {
      luckChestTimerEl.classList.toggle("hidden", !luckHeld);
      luckChestTimerEl.classList.toggle("is-paused", luckPaused);
      luckChestTimerEl.disabled = !luckHeld;
      luckChestTimerEl.setAttribute("aria-pressed", luckPaused ? "true" : "false");
      luckChestTimerEl.textContent = !luckHeld
        ? ""
        : luckPaused
          ? `${formatTreasureClock(luckLeft)} paused`
          : `${formatTreasureClock(luckLeft)} left`;
    }
    moneyUseBtn?.closest(".treasure-stash-row")?.classList.toggle("is-boosted", moneyOn);
    luckUseBtn?.closest(".treasure-stash-row")?.classList.toggle("is-boosted", luckOn);
    moneyUseBtn?.closest(".treasure-stash-row")?.classList.toggle("is-paused", moneyPaused);
    luckUseBtn?.closest(".treasure-stash-row")?.classList.toggle("is-paused", luckPaused);
    if (moneyUseBtn) {
      moneyUseBtn.disabled = money <= 0;
      moneyUseBtn.textContent = chestUseLabel("money", money, moneyHeld);
    }
    if (luckUseBtn) {
      luckUseBtn.disabled = luck <= 0;
      luckUseBtn.textContent = chestUseLabel("luck", luck, luckHeld);
    }
    syncChestQtyButtons(moneyChestQtyEl, "money", money);
    syncChestQtyButtons(luckChestQtyEl, "luck", luck);
    if (astralLuckyBlockUseBtn) {
      astralLuckyBlockUseBtn.disabled = astralBlocks <= 0;
      astralLuckyBlockUseBtn.textContent = "Open";
    }
    if (absoluteLuckyBlockUseBtn) {
      absoluteLuckyBlockUseBtn.disabled = absoluteBlocks <= 0;
      absoluteLuckyBlockUseBtn.textContent = "Open";
    }
    if (zenithLuckyBlockUseBtn) {
      zenithLuckyBlockUseBtn.disabled = zenithBlocks <= 0;
      zenithLuckyBlockUseBtn.textContent = "Open";
    }
    if (astralLuckyBlockRow) {
      astralLuckyBlockRow.classList.toggle("hidden", !showAstral);
      astralLuckyBlockRow.hidden = !showAstral;
    }
    if (absoluteLuckyBlockRow) {
      absoluteLuckyBlockRow.classList.toggle("hidden", !showAbsolute);
      absoluteLuckyBlockRow.hidden = !showAbsolute;
    }
    if (zenithLuckyBlockRow) {
      zenithLuckyBlockRow.classList.toggle("hidden", !showZenith);
      zenithLuckyBlockRow.hidden = !showZenith;
    }
    if (treasureStashEl) {
      treasureStashEl.classList.toggle(
        "is-empty",
        money <= 0 &&
          luck <= 0 &&
          astralBlocks <= 0 &&
          absoluteBlocks <= 0 &&
          zenithBlocks <= 0 &&
          !moneyHeld &&
          !luckHeld
      );
      treasureStashEl.classList.toggle("is-active", moneyOn || luckOn);
    }
  }

  function render(full = true) {
    renderStats();
    renderCooler();
    renderAquarium();
    renderQuests();
    if (full) {
      renderSpots();
      renderShop();
    } else {
      // refresh affordability without full rebuild when possible
      spotList?.querySelectorAll("[data-spot]").forEach((btn) => {
        const spot = SPOTS.find((s) => s.id === btn.dataset.spot);
        if (!spot || state.unlocked[spot.id]) return;
        btn.disabled = state.coins < spot.cost;
        btn.textContent = formatNum(spot.cost);
      });
      shopList?.querySelectorAll("[data-buy]").forEach((btn) => {
        const id = btn.dataset.buy;
        if (id === "boat") {
          const next = nextBoatTier();
          if (!next) {
            btn.disabled = true;
            btn.textContent = "✓";
            return;
          }
          btn.disabled = state.coins < next.cost;
          btn.textContent = formatNum(next.cost);
          return;
        }
        if (id === ECHO_LUCK_ID) {
          const cost = echoLuckCost();
          if (!Number.isFinite(cost)) {
            btn.disabled = true;
            btn.textContent = "MAX";
            return;
          }
          btn.disabled = state.coins < cost;
          btn.textContent = formatNum(cost);
          return;
        }
        if (state.owned[id]) {
          btn.disabled = true;
          btn.textContent = "✓";
          return;
        }
        const item = GEAR.find((g) => g.id === id);
        if (!item) return;
        btn.disabled = state.coins < item.cost;
        btn.textContent = formatNum(item.cost);
      });
    }
  }

  function saveSoon() {
    const now = Date.now();
    if (now - lastSaveAt < 700) return;
    lastSaveAt = now;
    saveState();
  }

  function tick() {
    const before = coolerKey();
    ensureWeather();
    tickAquarium();
    tickBoats(TICK_MS / 1000);
    // Only rebuild cooler chips when contents change (constant rebuilds broke sell clicks)
    renderCooler(coolerKey() !== before);
    renderAquarium();
    renderStats();
    saveSoon();
  }

  function openMenu() {
    saveState();
    maybeSubmitBest(true);
    render();
    overlay?.classList.remove("hidden");
    lockPageScroll();
  }

  function closeMenu() {
    overlay?.classList.add("hidden");
    unlockPageScroll();
    ensureSession();
  }

  function loadFishingPrefs() {
    try {
      const raw = JSON.parse(localStorage.getItem(FISHING_PREFS_KEY) || "{}");
      return {
        lightningFlash: raw.lightningFlash !== false,
        sfx: raw.sfx !== false,
        confetti: raw.confetti !== false
      };
    } catch {
      return { lightningFlash: true, sfx: true, confetti: true };
    }
  }

  let fishingPrefs = loadFishingPrefs();

  function saveFishingPrefs() {
    try {
      localStorage.setItem(FISHING_PREFS_KEY, JSON.stringify(fishingPrefs));
    } catch {}
  }

  function sfxEnabled() {
    return fishingPrefs.sfx !== false;
  }

  function setSfxEnabled(on) {
    fishingPrefs.sfx = !!on;
    saveFishingPrefs();
  }

  function confettiEnabled() {
    return fishingPrefs.confetti !== false;
  }

  function setConfettiEnabled(on) {
    fishingPrefs.confetti = !!on;
    saveFishingPrefs();
  }

  function burstConfetti(opts) {
    if (!confettiEnabled()) return;
    window.HubConfetti?.burst?.(opts);
  }

  /** Game beeps (catch/UI). Weather ambients always pass through. */
  function playSfx(kind, extra) {
    const k = String(kind || "");
    if (k.startsWith("weather-")) {
      window.HubSound?.play?.(kind, extra);
      return;
    }
    if (!sfxEnabled()) return;
    window.HubSound?.play?.(kind, extra);
  }

  function lightningFlashEnabled() {
    return fishingPrefs.lightningFlash !== false;
  }

  function setLightningFlashEnabled(on) {
    fishingPrefs.lightningFlash = !!on;
    saveFishingPrefs();
    applyLightningFlashPref();
  }

  function applyLightningFlashPref() {
    const on = lightningFlashEnabled();
    document.body.classList.toggle("no-lightning-flash", !on);
    document.getElementById("weather-fx")?.classList.toggle("no-lightning-flash", !on);
  }

  function syncSettingsPanel() {
    if (settingsSoundEnabled) {
      settingsSoundEnabled.checked = window.HubSound?.isEnabled?.() !== false;
    }
    const vol = Math.round((window.HubSound?.getVolume?.() ?? 1) * 100);
    const clamped = Math.max(0, Math.min(300, vol));
    if (settingsVolume) settingsVolume.value = String(clamped);
    if (settingsVolumePct && document.activeElement !== settingsVolumePct) {
      settingsVolumePct.value = String(clamped);
    }
    if (settingsSfxEnabled) settingsSfxEnabled.checked = sfxEnabled();
    if (settingsConfettiEnabled) settingsConfettiEnabled.checked = confettiEnabled();
    if (settingsLightningFlash) settingsLightningFlash.checked = lightningFlashEnabled();
  }

  function openSettings() {
    syncSettingsPanel();
    settingsOverlay?.classList.remove("hidden");
    lockPageScroll();
  }

  function closeSettings() {
    settingsOverlay?.classList.add("hidden");
    if (overlay?.classList.contains("hidden") && adminOverlay?.classList.contains("hidden")) {
      unlockPageScroll();
    }
  }

  function rarityOrder(r) {
    return (RARITY_RANK[r] || 1) - 1;
  }

  function formatChance(pct) {
    const p = Number(pct);
    if (!Number.isFinite(p) || p <= 0) return "0%";
    const oneIn = Math.max(1, Math.round(100 / p));
    if (p >= 10) return `${p.toFixed(2)}%`;
    if (p >= 1) return `${p.toFixed(3)}%`;
    if (p >= 0.1) return `${p.toFixed(4)}%`;
    if (p >= 0.01) return `${p.toFixed(5)}%`;
    // Rare+ : enough digits to tell fish apart + 1-in-N
    if (p >= 0.001) return `${p.toFixed(6)}% · 1 in ${formatNum(oneIn)}`;
    if (p >= 0.0001) return `${p.toFixed(7)}% · 1 in ${formatNum(oneIn)}`;
    if (p >= 0.00001) return `${p.toFixed(8)}% · 1 in ${formatNum(oneIn)}`;
    if (p >= 0.000001) return `${p.toFixed(9)}% · 1 in ${formatNum(oneIn)}`;
    return `${p.toExponential(3)}% · 1 in ${formatNum(oneIn)}`;
  }

  function renderGuide() {
    const spot = currentSpot();
    if (guideSpotMult) guideSpotMult.textContent = `×${spot.valueMult}`;
    if (guideSpotName) guideSpotName.textContent = spot.name;
    const boostsEl = document.getElementById("guide-boosts");
    if (boostsEl) {
      const bits = [];
      const luckM = treasureLuckMult();
      const moneyM = treasureMoneyMult();
      const colM = collectionLuckMult();
      const base = baseLuck(spot);
      const effLuck = effectiveLuckBonus(spot);
      if (luckM > 1 || eventLuckActive() || luckBoostActive()) {
        bits.push(
          `Luck ${formatMult(luckM)}× on gear+spot +${formatLuckAmt(base)} → HUD +${formatLuckAmt(
            effLuck
          )} · top fish odds ~×${formatMult(luckM)} (odds below)`
        );
        const maxB = maxBaseLuck(spot);
        if (maxB > base + 1e-9) {
          bits.push(`dialed · max +${formatLuckAmt(maxB)}`);
        }
      } else {
        bits.push(`Luck base gear+spot +${formatLuckAmt(base)} (odds below)`);
        const maxB = maxBaseLuck(spot);
        if (maxB > base + 1e-9) {
          bits.push(`dialed · max +${formatLuckAmt(maxB)}`);
        }
      }
      if (colM > 1) {
        bits.push(
          `${formatMult(colM)}× collection luck (75% catch book)`
        );
      }
      if (collectionRainbowMult() > 1) {
        bits.push(
          `${formatMult(collectionRainbowMult())}× rainbow share (80% catch book)`
        );
      }
      if (hasCollectionLbEventBonus() || hasCollectionLbAlwaysBonus()) {
        const lbBits = [];
        if (hasCollectionLbEventBonus()) {
          lbBits.push(`${formatMult(collectionLbEventMult())}× during LB events (90%)`);
        }
        if (hasCollectionLbAlwaysBonus()) {
          lbBits.push("LB drops anytime (100%)");
        }
        bits.push(`Collection Lucky Blocks: ${lbBits.join(" · ")}`);
      }
      if (moneyM > 1 || eventMoneyActive() || moneyBoostActive()) {
        bits.push(`Sell ${formatMult(moneyM)}× (Here pay)`);
      }
      const vEvt = adminVariantEventLive();
      if (vEvt) {
        bits.push(
          `${formatMult(vEvt.mult)}× ${formatAdminVariantLabel(vEvt.target)} variant odds`
        );
      }
      boostsEl.textContent = bits.length ? ` Active: ${bits.join(" · ")}.` : "";
      boostsEl.classList.toggle("is-live", bits.length > 0);
    }
    if (guideVariantsBody) {
      const castV = variantRollChances(spot, false);
      const boatV = variantRollChances(spot, true);
      const variantRows = [
        {
          id: "silver",
          name: "Silver",
          mult: "×1.5",
          note: "primary",
          cast: castV.silver,
          boat: boatV.silver
        },
        {
          id: "gold",
          name: "Gold",
          mult: "×2",
          note: "primary",
          cast: castV.gold,
          boat: boatV.gold
        },
        {
          id: "diamond",
          name: "Diamond",
          mult: "×2.5",
          note: "primary",
          cast: castV.diamond,
          boat: boatV.diamond
        },
        {
          id: "rainbow",
          name: "Rainbow",
          mult: "×3",
          note: hasCollectionRainbowBonus()
            ? `primary · book ${formatMult(COLLECTION_RAINBOW_MULT)}×`
            : "primary",
          cast: castV.rainbow,
          boat: boatV.rainbow
        },
        {
          id: "any",
          name: "Any primary",
          mult: "—",
          note: "one of the four",
          cast: castV.primary,
          boat: boatV.primary
        },
        {
          id: "shiny",
          name: "Shiny",
          mult: "×3",
          note: "stacks on primary",
          cast: castV.shiny,
          boat: boatV.shiny
        }
      ];
      guideVariantsBody.innerHTML = variantRows
        .map((row) => {
          const castPct = 100 * row.cast;
          const boatPct = 100 * row.boat;
          return `<tr class="at-spot guide-variant-row variant-${row.id}">
          <td class="guide-fish-name">${row.name}</td>
          <td class="guide-rarity">${row.mult}</td>
          <td class="guide-variant-note">${row.note}</td>
          <td class="guide-spots" title="${castPct.toFixed(8)}%">${formatChance(castPct)}</td>
          <td class="guide-spots" title="${boatPct.toFixed(8)}%">${formatChance(boatPct)}</td>
        </tr>`;
        })
        .join("");
    }
    if (!guideBody) return;
    const kindP = treasureKindChance(spot, false);
    const weights = FISH.map((f) => fishWeight(f, spot, false));
    const total = weights.reduce((a, b) => a + b, 0);
    const rows = FISH.map((fish, i) => ({
      fish,
      pct: total > 0 ? (100 * weights[i]) / total : 0
    })).sort(
      (a, b) =>
        rarityOrder(a.fish.rarity) - rarityOrder(b.fish.rarity) ||
        a.fish.value - b.fish.value
    );
    const kindPct = 100 * kindP;
    const treasureRows = TREASURES.map((chest) => {
      const effect =
        chest.kind === "luck"
          ? `store · Use ${TREASURE_LUCK_MULT}× luck · 5:00`
          : `store · Use ${TREASURE_MULT}× sell · 5:00`;
      return `<tr class="at-spot guide-treasure-row guide-${chest.kind}">
      <td class="guide-fish-name">${chest.name}</td>
      <td class="guide-rarity treasure">${chest.kind}</td>
      <td>—</td>
      <td class="guide-here">${effect} · extra (replaces fish)</td>
      <td class="guide-spots" title="${kindPct.toFixed(8)}% of reels">${formatChance(kindPct)}</td>
    </tr>`;
    }).join("");
    const totalRow = `<tr class="guide-total-row">
      <td class="guide-fish-name">All fish</td>
      <td class="guide-rarity">total</td>
      <td>—</td>
      <td class="guide-here">when you catch a fish</td>
      <td class="guide-spots">100%</td>
    </tr>`;
    guideBody.innerHTML =
      treasureRows +
      totalRow +
      rows
        .map(({ fish, pct }) => {
          const here = fishValue(fish, spot);
          const chance = formatChance(pct);
          return `<tr class="at-spot">
          <td class="guide-fish-name">${fish.name}</td>
          <td class="guide-rarity ${fish.rarity}">${fish.rarity}</td>
          <td>${formatNum(fish.value)}</td>
          <td class="guide-here">${formatNum(here)}</td>
          <td class="guide-spots" title="${pct.toFixed(8)}%">${chance}</td>
        </tr>`;
        })
        .join("");
  }

  function renderCollectionHud() {
    const total = FISH.length;
    const found = catchBookDiscoveryCount();
    const ratio = catchBookDiscoveryRatio();
    const pct = total > 0 ? Math.floor(ratio * 100) : 0;
    const key = `${found}/${total}/${pct}/${playerHasMasterFisherTitle() ? 1 : 0}`;
    if (key === lastCollectionHudKey) return;
    lastCollectionHudKey = key;
    if (collectionHudPctEl) collectionHudPctEl.textContent = `${pct}%`;
    if (collectionHudFillEl) collectionHudFillEl.style.width = `${Math.max(0, Math.min(100, pct))}%`;
    if (collectionHudCountEl) {
      collectionHudCountEl.textContent = `${found} / ${total} discovered`;
    }
    if (!collectionHudTiersEl) return;
    const tiers = collectionTiers();
    const next = tiers.find((t) => ratio < t.pct);
    collectionHudTiersEl.innerHTML = tiers
      .map((tier) => {
        const on =
          ratio >= tier.pct || (tier.pct === COLLECTION_MASTER_PCT && playerHasMasterFisherTitle());
        const isNext = !on && next && next.pct === tier.pct;
        const state = on ? "On" : isNext ? "Next" : "Locked";
        return `<div class="collection-tier${on ? " is-on" : ""}${isNext ? " is-next" : ""}">
          <span class="collection-tier-pct">${tier.label}</span>
          <span class="collection-tier-name">${tier.title}</span>
          <span class="collection-tier-state">${state}</span>
          <span class="collection-tier-hint">${tier.hint}</span>
        </div>`;
      })
      .join("");
  }

  function renderBook() {
    renderCollectionHud();
    const total = FISH.length;
    const found = caughtCount();
    const pct = total > 0 ? Math.floor((found / total) * 100) : 0;
    if (bookProgressEl) {
      bookProgressEl.textContent = `${found} / ${total} (${pct}%)`;
    }
    if (bookViewLabelEl) {
      bookViewLabelEl.textContent = bookFilterLabel();
    }
    if (bookActiveBonusesEl) {
      const tiers = [];
      if (hasCollectionLuckBonus()) tiers.push(`${formatMult(COLLECTION_LUCK_MULT)}× luck`);
      if (hasCollectionRainbowBonus()) tiers.push(`${formatMult(COLLECTION_RAINBOW_MULT)}× rainbow`);
      if (hasCollectionLbEventBonus()) {
        tiers.push(`${formatMult(COLLECTION_LB_EVENT_MULT)}× LB events`);
      }
      if (hasCollectionLbAlwaysBonus()) tiers.push("LB anytime");
      if (tiers.length) {
        bookActiveBonusesEl.hidden = false;
        bookActiveBonusesEl.textContent = tiers.join(" · ");
      } else {
        bookActiveBonusesEl.hidden = true;
        bookActiveBonusesEl.textContent = "";
      }
    }
    if (bookFiltersEl) {
      const primaryBtns = BOOK_FILTERS.map(
        (f) =>
          `<button type="button" class="book-filter-btn${
            bookFilter === f.id ? " is-active" : ""
          }${f.id !== "any" && f.id !== "base" ? ` variant-${f.id}` : ""}" data-book-filter="${
            f.id
          }" role="tab" aria-selected="${bookFilter === f.id}" title="${
            f.mult ? `${f.label} · ${bookFilterMultText(f.mult)} value` : f.label
          }">${bookFilterButtonLabel(f.label, f.mult)}</button>`
      ).join("");
      const shinyBtn = `<button type="button" class="book-filter-btn variant-shiny book-shiny-toggle${
        bookShinyOn ? " is-active is-on" : ""
      }" data-book-shiny-toggle="1" aria-pressed="${bookShinyOn}" title="Toggle shiny filter · ×${formatMult(
        SHINY_MULT
      )} value">${bookFilterButtonLabel("Shiny", SHINY_MULT, bookShinyOn)}</button>`;
      const mutationBtns = BOOK_MUTATIONS.map(
        (m) =>
          `<button type="button" class="book-filter-btn mutation-${m.id} book-mutation-toggle${
            bookMutation === m.id ? " is-active is-on" : ""
          }" data-book-mutation="${m.id}" aria-pressed="${
            bookMutation === m.id
          }" title="Toggle ${m.label} mutation · ${bookFilterMultText(m.mult)} value">${bookFilterButtonLabel(
            m.label,
            m.mult,
            bookMutation === m.id
          )}</button>`
      ).join("");
      bookFiltersEl.innerHTML = `${shinyBtn}<div class="book-filter-sep" aria-hidden="true"></div>${primaryBtns}<div class="book-filter-sep" aria-hidden="true"></div><p class="book-filter-kicker">Mutations</p>${mutationBtns}`;
    }
    closeBookInspect();
    if (!bookBody) return;
    const searchEl = document.getElementById("book-search");
    if (searchEl && document.activeElement !== searchEl) {
      const q = state.bookSearch || "";
      if (searchEl.value !== q) searchEl.value = q;
    }
    const byRarity = {};
    RARITIES.forEach((r) => {
      byRarity[r] = [];
    });
    const bookQ = normalizeSearchQuery(state.bookSearch);
    const showEntry = bookShowEntry();
    FISH.forEach((fish) => {
      if (!byRarity[fish.rarity]) byRarity[fish.rarity] = [];
      if (bookQ && !fishMatchesSearch(fish, null, bookQ)) return;
      byRarity[fish.rarity].push(fish);
    });
    const sections = RARITIES.map((rarity) => {
      const list = byRarity[rarity] || [];
      if (!list.length) return "";
      const got = list.filter((f) => hasCaught(f.id)).length;
      const cards = list
        .map((fish) => {
          const known = hasCaught(fish.id);
          if (known) {
            const label = showEntry ? formatFishName(fish, showEntry) : fish.name;
            const lookVal = bookLookValue(fish, showEntry);
            return `<button type="button" class="book-card is-caught rarity-${fish.rarity}${
              showEntry ? ` ${variantClassList(showEntry)}` : ""
            }" data-book-inspect="${fish.id}" title="${label} · ${fish.rarity} · ${formatNum(lookVal)} coins · tap to inspect">
              <span class="book-card-glyph" aria-hidden="true">${fishGlyphHtml(fish, showEntry)}</span>
              <span class="book-card-name">${label}</span>
              <span class="book-card-meta">${fish.rarity} · ${formatNum(lookVal)}</span>
            </button>`;
          }
          return `<button type="button" class="book-card is-unknown rarity-${fish.rarity}" data-book-inspect="${fish.id}" title="Not caught yet · ${bookFilterLabel()} · tap to inspect">
              <span class="book-card-glyph book-card-sil" aria-hidden="true">${fishGlyphHtml(
                fish
              )}</span>
              <span class="book-card-name">???</span>
              <span class="book-card-meta">${fish.rarity}</span>
            </button>`;
        })
        .join("");
      return `<section class="book-section">
        <h3 class="book-section-title rarity-${rarity}">${rarity} <span>${got}/${list.length}</span></h3>
        <div class="book-grid">${cards}</div>
      </section>`;
    }).join("");
    bookBody.innerHTML =
      sections ||
      (bookQ
        ? `<p class="book-empty">No fish matching “${bookQ.replace(/[<>&"]/g, "")}”</p>`
        : "");
  }

  let lastGuideBoostKey = "";

  function maybeRefreshGuide() {
    if (!guideOverlay || guideOverlay.classList.contains("hidden")) return;
    const spot = currentSpot();
    const variant = adminVariantEventLive();
    const key = [
      spot?.id,
      formatMult(treasureLuckMult()),
      formatMult(treasureMoneyMult()),
      formatMult(effectiveLuckBonus(spot)),
      formatMult(baseLuck(spot)),
      formatMult(maxBaseLuck(spot)),
      state.luckDialFollowMax ? "F" : "D",
      luckBonus(),
      spotLuckBonus(spot),
      eventLuckActive() ? "L" : "",
      eventMoneyActive() ? "M" : "",
      variant ? `V:${variant.target}:${formatMult(variant.mult)}:${variant.until}` : ""
    ].join("|");
    if (key === lastGuideBoostKey) return;
    lastGuideBoostKey = key;
    renderGuide();
  }

  let pageScrollLockY = 0;
  let pageScrollLocks = 0;

  function lockPageScroll() {
    if (pageScrollLocks === 0) {
      pageScrollLockY = window.scrollY || window.pageYOffset || 0;
      document.documentElement.classList.add("modal-open");
      document.body.classList.add("modal-open");
      document.body.style.top = `-${pageScrollLockY}px`;
    }
    pageScrollLocks += 1;
  }

  function unlockPageScroll() {
    if (pageScrollLocks <= 0) return;
    pageScrollLocks -= 1;
    if (pageScrollLocks > 0) return;
    document.documentElement.classList.remove("modal-open");
    document.body.classList.remove("modal-open");
    document.body.style.top = "";
    window.scrollTo(0, pageScrollLockY);
  }

  function openGuide() {
    lastGuideBoostKey = "";
    renderGuide();
    guideOverlay?.classList.remove("hidden");
    lockPageScroll();
    const card = guideOverlay?.querySelector(".guide-card");
    if (card) card.scrollTop = 0;
  }

  function closeGuide() {
    guideOverlay?.classList.add("hidden");
    unlockPageScroll();
  }

  function closeBookInspect() {
    if (!bookInspectEl) return;
    bookInspectEl.classList.add("hidden");
    bookInspectEl.hidden = true;
    bookInspectEl.classList.remove("is-toxic", "is-lava", "is-neon");
    bookInspectCoolerIndex = -1;
    if (bookInspectActionBtn) {
      bookInspectActionBtn.hidden = true;
      bookInspectActionBtn.classList.add("hidden");
      bookInspectActionBtn.textContent = "Unsave";
      bookInspectActionBtn.onclick = null;
    }
    if (bookInspectGlyphEl) bookInspectGlyphEl.innerHTML = "";
  }

  function openBookInspect(fishId, entryOverride = null, opts = {}) {
    const fish = fishById(fishId);
    if (!fish || !bookInspectEl) return;
    const fromAquarium = !!opts.fromAquarium;
    const coolerIndex = Math.floor(Number(opts.coolerIndex));
    bookInspectCoolerIndex =
      fromAquarium && Number.isFinite(coolerIndex) && coolerIndex >= 0 ? coolerIndex : -1;

    let showEntry = null;
    let known = true;
    if (entryOverride && typeof entryOverride === "object") {
      showEntry = {
        variant: normalizeVariant(entryOverride.variant),
        shiny: !!entryOverride.shiny,
        mutation: normalizeMutation(entryOverride.mutation)
      };
      if (!showEntry.variant && !showEntry.shiny && !showEntry.mutation) showEntry = null;
    } else {
      known = hasCaught(fish.id);
      showEntry = known ? bookShowEntry() : null;
    }

    const label = known
      ? showEntry
        ? formatFishName(fish, showEntry)
        : fish.name
      : "???";
    if (bookInspectGlyphEl) {
      bookInspectGlyphEl.classList.toggle("is-unknown", !known);
      bookInspectGlyphEl.innerHTML = fishGlyphHtml(fish, showEntry || undefined);
    }
    if (bookInspectTitleEl) bookInspectTitleEl.textContent = label;
    if (bookInspectMetaEl) {
      const mut = known ? normalizeMutation(showEntry?.mutation) : "";
      const mutNote =
        mut === "toxic"
          ? " · Toxic ×4 · acid veins, sludge drips, spore haze"
          : mut === "lava"
            ? " · Lava ×5 · magma cracks, embers, molten glow"
            : mut === "neon"
              ? " · Neon ×6 · electric arcs, cyan/magenta pulse"
              : mut
                ? ` · ${mut}`
                : "";
      if (!known) {
        bookInspectMetaEl.textContent = `${fish.rarity} · not caught yet`;
      } else if (fromAquarium) {
        bookInspectMetaEl.textContent = `${fish.rarity} · sell ${formatNum(
          fishValue(fish, currentSpot(), entryOverride || showEntry)
        )}${mutNote}`;
      } else {
        bookInspectMetaEl.textContent = `${fish.rarity} · ${formatNum(
          bookLookValue(fish, showEntry)
        )} coins${mutNote}`;
      }
    }
    if (bookInspectHintEl) {
      const bits = [];
      if (known && showEntry?.variant) bits.push(showEntry.variant);
      if (known && showEntry?.shiny) bits.push("shiny");
      if (known && showEntry?.mutation) bits.push(showEntry.mutation);
      const mutHint =
        known && showEntry?.mutation === "toxic"
          ? "Toxic mutation: bile-green flesh, glowing veins, and dripping sludge · tap outside to close"
          : known && showEntry?.mutation === "lava"
            ? "Lava mutation: molten cracks, ember sparks, and dripping magma · tap outside to close"
            : known && showEntry?.mutation === "neon"
              ? "Neon mutation: electric arcs, cyan/magenta pulse nodes · tap outside to close"
              : "";
      if (fromAquarium) {
        bookInspectHintEl.textContent = bits.length
          ? `Saved aquarium look · ${bits.join(" + ")} · tap outside to close`
          : "Saved in the Aquarium · tap outside to close";
      } else {
        bookInspectHintEl.textContent = known
          ? mutHint ||
            (bits.length
              ? `Viewing ${bits.join(" + ")} look · tap outside to close`
              : "Tap outside or Close to go back")
          : "Catch this fish to reveal its look";
      }
    }
    if (bookInspectActionBtn) {
      if (fromAquarium && bookInspectCoolerIndex >= 0) {
        bookInspectActionBtn.hidden = false;
        bookInspectActionBtn.classList.remove("hidden");
        bookInspectActionBtn.textContent = "Unsave from Aquarium";
        bookInspectActionBtn.onclick = () => {
          const idx = bookInspectCoolerIndex;
          closeBookInspect();
          toggleSaveFish(idx);
        };
      } else {
        bookInspectActionBtn.hidden = true;
        bookInspectActionBtn.classList.add("hidden");
        bookInspectActionBtn.onclick = null;
      }
    }
    bookInspectEl.classList.toggle("is-toxic", known && showEntry?.mutation === "toxic");
    bookInspectEl.classList.toggle("is-lava", known && showEntry?.mutation === "lava");
    bookInspectEl.classList.toggle("is-neon", known && showEntry?.mutation === "neon");
    bookInspectEl.hidden = false;
    bookInspectEl.classList.remove("hidden");
  }

  function openBook() {
    renderBook();
    bookOverlay?.classList.remove("hidden");
    lockPageScroll();
    closeBookInspect();
    if (bookBody) bookBody.scrollTop = 0;
  }

  function closeBook() {
    closeBookInspect();
    bookOverlay?.classList.add("hidden");
    unlockPageScroll();
  }

  castBtn?.addEventListener("pointerup", (e) => {
    // Prefer pointerup so cancel works reliably on touch while waiting
    if (e.button != null && e.button !== 0) return;
    reelIn(e);
  });
  // Keep click as fallback for keyboard activation
  castBtn?.addEventListener("click", (e) => {
    if (e.detail === 0) reelIn(e);
  });
  sellBtn?.addEventListener("click", () => sellCooler());
  document.getElementById("cooler-sort")?.addEventListener("change", (e) => {
    const v = e.target.value;
    state.coolerSort = ["value", "rarity", "shiny", "saved", "name"].includes(v) ? v : "value";
    coolerRenderKey = "";
    renderCooler(true);
    saveSoon();
  });
  document.getElementById("cooler-filter")?.addEventListener("change", (e) => {
    const v = e.target.value;
    state.coolerFilter = ["all", "saved", "shiny", "unsaved"].includes(v) ? v : "all";
    coolerRenderKey = "";
    renderCooler(true);
    saveSoon();
  });
  document.getElementById("cooler-search")?.addEventListener("input", (e) => {
    state.coolerSearch = normalizeSearchQuery(e.target.value);
    coolerRenderKey = "";
    renderCooler(true);
    saveSoon();
  });
  document.getElementById("book-search")?.addEventListener("input", (e) => {
    state.bookSearch = normalizeSearchQuery(e.target.value);
    renderBook();
    saveSoon();
  });
  document.getElementById("aquarium-equip-best-btn")?.addEventListener("click", () => {
    equipBestAquariumFish();
  });
  document.getElementById("aquarium-claim-btn")?.addEventListener("click", () => {
    const n = claimAquariumBank();
    if (n > 0) {
      setCatchLine(`Aquarium paid ${formatNum(n)} coins`);
      playSfx("win");
      render(false);
      saveSoon();
    }
  });
  document.getElementById("aquarium-tank-claim")?.addEventListener("click", () => {
    const n = claimAquariumBank();
    if (n > 0) {
      setCatchLine(`Aquarium paid ${formatNum(n)} coins`);
      playSfx("win");
      render(false);
      saveSoon();
    }
  });
  document.getElementById("aquarium-upgrade-btn")?.addEventListener("click", () => {
    buyAquariumUpgrade();
  });
  document.getElementById("aquarium-swimmers")?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-aqua-index]");
    if (!btn) return;
    e.stopPropagation();
    const index = Math.floor(Number(btn.dataset.aquaIndex));
    if (!Number.isFinite(index) || index < 0 || index >= state.cooler.length) return;
    const entry = normalizeCoolerEntry(state.cooler[index]);
    const fish = entry ? fishById(entry.id) : null;
    if (!fish) return;
    openBookInspect(fish.id, entry, { fromAquarium: true, coolerIndex: index });
  });
  document.getElementById("aquarium-tank")?.addEventListener("click", (e) => {
    if (e.target.closest("[data-aqua-index]")) return;
    if (e.target.closest("#aquarium-expand-close")) return;
    if (!aquariumExpanded) setAquariumExpanded(true);
  });
  document.getElementById("aquarium-tank")?.addEventListener("keydown", (e) => {
    if (e.code !== "Enter" && e.code !== "Space") return;
    if (aquariumExpanded) return;
    e.preventDefault();
    setAquariumExpanded(true);
  });
  document.getElementById("aquarium-expand-close")?.addEventListener("click", (e) => {
    e.stopPropagation();
    setAquariumExpanded(false);
  });
  document.getElementById("aquarium-expand-backdrop")?.addEventListener("click", () => {
    setAquariumExpanded(false);
  });
  document.getElementById("offline-claim-btn")?.addEventListener("click", () => claimOfflineBonus());
  document.getElementById("offline-claim-overlay")?.addEventListener("click", (e) => {
    if (e.target?.id === "offline-claim-overlay") claimOfflineBonus();
  });
  shinyMachineBtn?.addEventListener("click", () => openShinyMachine());
  shinyMachineCloseBtn?.addEventListener("click", () => closeShinyMachine());
  shinyMachineClearBtn?.addEventListener("click", () => {
    if (shinyMachineBusy) return;
    clearShinyMachineSlots("Cleared.");
    playSfx("click");
  });
  shinyMachineRunBtn?.addEventListener("click", () => runShinyMachine());
  shinyMachineSlotsEl?.addEventListener("click", (e) => {
    const slotBtn = e.target.closest("[data-shiny-slot]");
    if (!slotBtn || !shinyMachineSlotsEl.contains(slotBtn)) return;
    removeShinyMachineSlot(slotBtn.dataset.shinySlot);
  });
  shinyMachinePickerEl?.addEventListener("click", (e) => {
    const pick = e.target.closest("[data-shiny-pick]");
    if (!pick || pick.disabled || !shinyMachinePickerEl.contains(pick)) return;
    toggleShinyMachinePick(pick.dataset.shinyPick);
  });
  shinyMachineOverlay?.addEventListener("click", (e) => {
    if (e.target === shinyMachineOverlay) closeShinyMachine();
  });
  moneyUseBtn?.addEventListener("click", () => useTreasure("money"));
  luckUseBtn?.addEventListener("click", () => useTreasure("luck"));
  moneyChestTimerEl?.addEventListener("click", () => toggleChestBoostPause("money"));
  luckChestTimerEl?.addEventListener("click", () => toggleChestBoostPause("luck"));
  moneyChestQtyEl?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-chest-qty]");
    if (!btn || btn.disabled) return;
    setChestOpenQty("money", btn.dataset.chestQty);
    playSfx("click");
  });
  luckChestQtyEl?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-chest-qty]");
    if (!btn || btn.disabled) return;
    setChestOpenQty("luck", btn.dataset.chestQty);
    playSfx("click");
  });
  astralLuckyBlockUseBtn?.addEventListener("click", () => openLuckyBlockGui("astral"));
  absoluteLuckyBlockUseBtn?.addEventListener("click", () => openLuckyBlockGui("absolute"));
  zenithLuckyBlockUseBtn?.addEventListener("click", () => openLuckyBlockGui("zenith"));
  luckyBlockCloseBtn?.addEventListener("click", () => closeLuckyBlockGui());
  luckyBlockDismissBtn?.addEventListener("click", () => closeLuckyBlockGui());
  luckyBlockSpinBtn?.addEventListener("click", () => spinLuckyBlock());
  luckyBlockSkipBtn?.addEventListener("click", () => {
    if (luckyBlockSpinning) skipLuckyBlockSpin();
    else toggleLuckyBlockSkipAnim();
  });
  luckyBlockQtyEl?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-lb-qty]");
    if (!btn || luckyBlockSpinning) return;
    setLuckyBlockOpenQty(btn.dataset.lbQty);
    playSfx("click");
  });
  luckyBlockChancesBtn?.addEventListener("click", () => {
    setLuckyBlockChancesVisible(!luckyBlockChancesOpen);
  });
  luckyBlockOverlay?.addEventListener("click", (e) => {
    if (e.target === luckyBlockOverlay) closeLuckyBlockGui();
  });
  coolerList?.addEventListener("pointerdown", (e) => {
    const saveBtn = e.target.closest("[data-save-index]");
    if (saveBtn && coolerList.contains(saveBtn)) {
      e.preventDefault();
      e.stopPropagation();
      toggleSaveFish(saveBtn.dataset.saveIndex);
      return;
    }
    const sellChip = e.target.closest("[data-sell-index]");
    if (!sellChip || !coolerList.contains(sellChip) || sellChip.disabled) return;
    e.preventDefault();
    e.stopPropagation();
    sellOneFish(sellChip.dataset.sellIndex);
  });
  autoSellBox?.addEventListener("change", (e) => {
    const input = e.target.closest("input[data-rarity]");
    if (!input) return;
    const rarity = input.dataset.rarity;
    if (!RARITIES.includes(rarity)) return;
    state.autoSellRarities[rarity] = !!input.checked;
    saveSoon();
  });
  document.getElementById("auto-sell-mutations-btn")?.addEventListener("click", () => {
    state.autoSellMutations = !autoSellMutationsOn();
    syncAutoSellMutationsBtn();
    playSfx("click");
    setCatchLine(
      state.autoSellMutations
        ? "Mutation auto-sell on — mutated fish sell with rarity auto-sell"
        : "Mutation auto-sell off — mutated fish stay in the cooler",
      "treasure"
    );
    saveSoon();
  });
  shopCats?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-shop-cat]");
    if (!btn) return;
    shopCat = btn.dataset.shopCat || "all";
    renderShop();
  });
  questList?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-quest-claim]");
    if (!btn || btn.disabled) return;
    claimQuest(btn.dataset.questClaim, btn.dataset.questId);
  });
  document.getElementById("smart-shop-toggle")?.addEventListener("click", () => {
    if (!SMART_GEAR_SHOP) return;
    state.smartShop = !smartShopOn();
    playSfx("click");
    renderShop();
    saveSoon();
  });
  luckDialEl?.addEventListener("input", () => {
    setLuckDial(luckDialEl.value);
    lastGuideBoostKey = "";
    render(false);
    maybeRefreshGuide();
    saveSoon();
  });
  luckDialEl?.addEventListener("change", () => {
    setLuckDial(luckDialEl.value);
    saveState();
  });
  shopList?.addEventListener("pointerdown", (e) => {
    if (smartShopOn()) {
      const smartBtn = e.target.closest("[data-shop-smart]");
      if (smartBtn) {
        e.preventDefault();
        const kind = smartBtn.dataset.shopSmart;
        const part = smartBtn.dataset.shopSmartPart;
        if (kind && part) {
          const key = shopSmartKey(kind, part);
          shopSmartExpand[key] = !shopSmartExpand[key];
          renderShop();
        }
        return;
      }
    }
    const equipBtn = e.target.closest("[data-equip]");
    if (equipBtn && !equipBtn.disabled) {
      e.preventDefault();
      equipSpeed(equipBtn.dataset.equip);
      return;
    }
    const btn = e.target.closest("[data-buy]");
    if (!btn || btn.disabled) return;
    e.preventDefault();
    buyGear(btn.dataset.buy);
  });
  spotList?.addEventListener("pointerdown", (e) => {
    const btn = e.target.closest("[data-spot]");
    if (!btn || btn.disabled) return;
    e.preventDefault();
    unlockOrSelectSpot(btn.dataset.spot);
  });
  startBtn?.addEventListener("click", closeMenu);
  menuBtn?.addEventListener("click", openMenu);
  settingsBtn?.addEventListener("click", openSettings);
  settingsClose?.addEventListener("click", closeSettings);
  menuSettingsBtn?.addEventListener("click", () => {
    closeMenu();
    openSettings();
  });
  settingsOverlay?.addEventListener("click", (e) => {
    if (e.target === settingsOverlay) closeSettings();
  });
  settingsSoundEnabled?.addEventListener("change", () => {
    const on = !!settingsSoundEnabled.checked;
    if (on) {
      window.HubSound?.setEnabled?.(true);
      window.HubSound?.unlock?.();
      restartWeatherSound();
    } else {
      window.HubSound?.setEnabled?.(false);
      lastWeatherSoundId = "";
    }
    syncSettingsPanel();
  });
  function applyVolumePercent(raw, { syncInput = true } = {}) {
    const pct = Math.max(0, Math.min(300, Math.round(Number(raw) || 0)));
    window.HubSound?.setVolume?.(pct / 100);
    if (settingsVolume) settingsVolume.value = String(pct);
    if (syncInput && settingsVolumePct) settingsVolumePct.value = String(pct);
    return pct;
  }

  settingsVolume?.addEventListener("input", () => {
    applyVolumePercent(settingsVolume.value);
  });
  settingsVolumePct?.addEventListener("input", () => {
    const n = Number(settingsVolumePct.value);
    if (!Number.isFinite(n)) return;
    applyVolumePercent(n, { syncInput: false });
  });
  settingsVolumePct?.addEventListener("change", () => {
    applyVolumePercent(settingsVolumePct.value);
  });
  settingsVolumePct?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      applyVolumePercent(settingsVolumePct.value);
      settingsVolumePct.blur();
    }
  });
  settingsVolumePct?.addEventListener("click", (e) => {
    e.stopPropagation();
    settingsVolumePct.select();
  });
  settingsLightningFlash?.addEventListener("change", () => {
    setLightningFlashEnabled(!!settingsLightningFlash.checked);
  });
  settingsSfxEnabled?.addEventListener("change", () => {
    setSfxEnabled(!!settingsSfxEnabled.checked);
  });
  settingsConfettiEnabled?.addEventListener("change", () => {
    setConfettiEnabled(!!settingsConfettiEnabled.checked);
  });
  adminBtn?.addEventListener("click", openAdmin);
  adminClose?.addEventListener("click", closeAdmin);
  adminOverlay?.addEventListener("click", (e) => {
    const scopeBtn = e.target.closest("[data-admin-scope]");
    if (scopeBtn && adminOverlay.contains(scopeBtn)) {
      e.preventDefault();
      setAdminScope(scopeBtn.dataset.adminScope);
      return;
    }
    if (e.target === adminOverlay) closeAdmin();
  });
  adminOverlay?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-admin-cmd]");
    if (!btn || !adminOverlay.contains(btn)) return;
    e.preventDefault();
    runAdminCommand(btn.dataset.adminCmd);
  });
  document.getElementById("admin-cmd-back")?.addEventListener("click", () => {
    adminCmdHistoryBack();
  });
  document.getElementById("admin-cmd-forward")?.addEventListener("click", () => {
    adminCmdHistoryForward();
  });
  document.getElementById("admin-cmd-form")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const input = document.getElementById("admin-cmd-input");
    const list = document.getElementById("admin-cmd-suggest");
    if (
      list &&
      !list.hidden &&
      adminCmdSuggestItems.length &&
      adminCmdSuggestIndex >= 0
    ) {
      const item = adminCmdSuggestItems[adminCmdSuggestIndex];
      if (item && String(input?.value || "") !== item.value) {
        applyAdminCmdSuggestion(adminCmdSuggestIndex);
        return;
      }
    }
    const raw = input?.value || "";
    if (input) input.value = "";
    hideAdminCmdSuggest();
    runAdminCommand(raw);
  });
  document.getElementById("mail-btn")?.addEventListener("click", () => {
    openMailOverlay();
    playSfx("click");
  });
  document.getElementById("visit-aqua-btn")?.addEventListener("click", () => {
    openVisitAquariumPicker();
    playSfx("click");
  });
  document.getElementById("aquarium-visit-btn")?.addEventListener("click", () => {
    openVisitAquariumPicker();
    playSfx("click");
  });
  document.getElementById("visit-aqua-close")?.addEventListener("click", () => closeVisitAquariumPicker());
  document.getElementById("visit-aqua-back")?.addEventListener("click", () => {
    showVisitAquaBrowse();
    playSfx("click");
  });
  document.getElementById("visit-aqua-overlay")?.addEventListener("click", (e) => {
    if (e.target === e.currentTarget) closeVisitAquariumPicker();
  });
  document.getElementById("visit-aqua-overlay")?.addEventListener("click", (e) => {
    const pick = e.target.closest("[data-visit-aqua]");
    if (pick) {
      visitAquariumById(pick.dataset.visitAqua, pick.dataset.visitAquaName || "");
      playSfx("click");
      return;
    }
    const tab = e.target.closest("[data-visit-base-tab]");
    if (tab) {
      setVisitBaseTab(tab.dataset.visitBaseTab);
      playSfx("click");
      return;
    }
    const inspect = e.target.closest("[data-visit-inspect]");
    if (inspect && visitAquaDisplayFish.length) {
      const i = Math.floor(Number(inspect.dataset.visitInspect));
      const row = visitAquaDisplayFish[i];
      if (!row?.fish) return;
      openBookInspect(row.fish.id, row.entry);
      playSfx("click");
    }
  });
  document.getElementById("mail-close")?.addEventListener("click", () => closeMailOverlay());
  document.getElementById("mail-overlay")?.addEventListener("click", (e) => {
    if (e.target === e.currentTarget) closeMailOverlay();
  });
  document.getElementById("mail-body")?.addEventListener("click", (e) => {
    const tab = e.target.closest("[data-mail-tab]");
    if (tab) {
      mailTab = tab.dataset.mailTab || "inbox";
      if (mailTab === "gift") ensureMailCompose("gift");
      renderMailOverlay();
      playSfx("click");
      return;
    }
    const friend = e.target.closest("[data-mail-friend]");
    if (friend) {
      const id = friend.dataset.mailFriend || "";
      const name = friend.dataset.mailFriendName || "";
      if (mailTab === "trade" && !(mailCompose?.mode === "trade" && mailCompose.tradeId)) {
        openTradeWithFriend(id, name);
        return;
      }
      ensureMailCompose(mailTab === "trade" ? "trade" : "gift");
      mailCompose.friendId = id;
      mailCompose.friendName = name;
      renderMailOverlay();
      playSfx("click");
      return;
    }
    const claim = e.target.closest("[data-mail-claim]");
    if (claim) {
      claimPlayerGift(claim.dataset.mailClaim);
      return;
    }
    const openTr = e.target.closest("[data-mail-open-trade]");
    if (openTr) {
      const tid = openTr.dataset.mailOpenTrade;
      const t = playerMailCache.trades?.[tid];
      if (t) {
        const side = myTradeSide(t);
        mailCompose = {
          mode: "trade",
          friendId: side === "a" ? t.bId : t.aId,
          friendName: side === "a" ? t.bName : t.aName,
          items: side === "a" ? [...(t.aItems || [])] : [...(t.bItems || [])],
          tradeId: tid
        };
        mailTab = "trade";
        renderMailOverlay();
      }
      return;
    }
    const rem = e.target.closest("[data-mail-remove]");
    if (rem) {
      removeComposeItem(rem.dataset.mailRemove);
      return;
    }
    const addChest = e.target.closest("[data-mail-add-chest]");
    if (addChest) {
      addComposeChest(addChest.dataset.mailAddChest, 1);
      playSfx("click");
      return;
    }
    const toggleChest = e.target.closest("[data-mail-toggle-chest]");
    if (toggleChest) {
      toggleComposeChest(toggleChest.dataset.mailToggleChest);
      playSfx("click");
      return;
    }
    const addLb = e.target.closest("[data-mail-add-lb]");
    if (addLb) {
      addComposeLuckyBlock(addLb.dataset.mailAddLb, 1);
      playSfx("click");
      return;
    }
    const toggleLb = e.target.closest("[data-mail-toggle-lb]");
    if (toggleLb) {
      toggleComposeLuckyBlock(toggleLb.dataset.mailToggleLb);
      playSfx("click");
      return;
    }
    const mailFish = e.target.closest("[data-mail-fish]");
    if (mailFish) {
      addComposeItemFromCooler(mailFish.dataset.mailFish);
      playSfx("click");
      return;
    }
    if (e.target.closest("[data-mail-send-gift]")) {
      sendPlayerGift();
      return;
    }
    if (e.target.closest("[data-mail-cancel-compose]")) {
      cancelMailCompose(true);
      playSfx("click");
      return;
    }
    const acc = e.target.closest("[data-mail-accept]");
    if (acc) {
      setTradeAccept(acc.dataset.mailAccept, true);
      return;
    }
    const unacc = e.target.closest("[data-mail-unaccept]");
    if (unacc) {
      setTradeAccept(unacc.dataset.mailUnaccept, false);
      return;
    }
    const can = e.target.closest("[data-mail-cancel-trade]");
    if (can) {
      cancelTrade(can.dataset.mailCancelTrade);
    }
  });

  document.getElementById("admin-announce-form")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const input = document.getElementById("admin-announce-input");
    const text = String(input?.value || "").trim();
    if (!text) {
      setCatchLine("Type a message to send", "miss");
      return;
    }
    if (input) input.value = "";
    runAdminCommand(`say ${text}`);
  });
  {
    const input = document.getElementById("admin-cmd-input");
    const list = document.getElementById("admin-cmd-suggest");
    input?.addEventListener("input", () => refreshAdminCmdSuggest());
    input?.addEventListener("focus", () => {
      if (String(input.value || "").trim()) refreshAdminCmdSuggest();
      else hideAdminCmdSuggest();
    });
    input?.addEventListener("keydown", (e) => {
      const open = list && !list.hidden && adminCmdSuggestItems.length;
      if (e.key === "ArrowDown" && open) {
        e.preventDefault();
        moveAdminCmdSuggest(1);
        return;
      }
      if (e.key === "ArrowUp" && open) {
        e.preventDefault();
        moveAdminCmdSuggest(-1);
        return;
      }
      if ((e.key === "Tab" || e.key === "Enter") && open && adminCmdSuggestIndex >= 0) {
        // Tab always completes; Enter completes once, second Enter submits via form
        if (e.key === "Tab") {
          e.preventDefault();
          applyAdminCmdSuggestion(adminCmdSuggestIndex);
          return;
        }
        // Enter: if suggestion value differs from input, apply; else let submit run
        const item = adminCmdSuggestItems[adminCmdSuggestIndex];
        if (item && String(input.value || "") !== item.value) {
          e.preventDefault();
          applyAdminCmdSuggestion(adminCmdSuggestIndex);
        }
        return;
      }
      if (e.key === "Escape") {
        if (open) {
          e.preventDefault();
          hideAdminCmdSuggest();
        }
      }
    });
    list?.addEventListener("mousedown", (e) => {
      const btn = e.target.closest("[data-admin-suggest]");
      if (!btn) return;
      e.preventDefault();
      applyAdminCmdSuggestion(Number(btn.dataset.adminSuggest));
    });
  }
  guideBtn?.addEventListener("click", openGuide);
  suffixBtn?.addEventListener("click", openSuffixGuide);
  bookBtn?.addEventListener("click", openBook);
  collectionHudEl?.addEventListener("click", openBook);
  collectionHudEl?.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openBook();
    }
  });
  bookFiltersEl?.addEventListener("click", (e) => {
    const shinyBtn = e.target.closest("[data-book-shiny-toggle]");
    if (shinyBtn && bookFiltersEl.contains(shinyBtn)) {
      bookShinyOn = !bookShinyOn;
      renderBook();
      return;
    }
    const mutBtn = e.target.closest("[data-book-mutation]");
    if (mutBtn && bookFiltersEl.contains(mutBtn)) {
      const next = mutBtn.getAttribute("data-book-mutation") || "";
      bookMutation = bookMutation === next ? "" : next;
      renderBook();
      return;
    }
    const btn = e.target.closest("[data-book-filter]");
    if (!btn || !bookFiltersEl.contains(btn)) return;
    const next = btn.getAttribute("data-book-filter");
    if (!next || !BOOK_FILTERS.some((f) => f.id === next) || next === bookFilter) return;
    bookFilter = next;
    renderBook();
  });
  bookBody?.addEventListener("click", (e) => {
    const card = e.target.closest("[data-book-inspect]");
    if (!card || !bookBody.contains(card)) return;
    openBookInspect(card.getAttribute("data-book-inspect"));
  });
  bookInspectCloseBtn?.addEventListener("click", closeBookInspect);
  bookInspectBackdrop?.addEventListener("click", closeBookInspect);
  menuGuideBtn?.addEventListener("click", () => {
    closeMenu();
    openGuide();
  });
  menuSuffixBtn?.addEventListener("click", () => {
    closeMenu();
    openSuffixGuide();
  });
  menuBookBtn?.addEventListener("click", () => {
    closeMenu();
    openBook();
  });
  menuShinyMachineBtn?.addEventListener("click", () => {
    closeMenu();
    openShinyMachine();
  });
  guideClose?.addEventListener("click", closeGuide);
  suffixClose?.addEventListener("click", closeSuffixGuide);
  bookClose?.addEventListener("click", closeBook);
  guideOverlay?.addEventListener("click", (e) => {
    if (e.target === guideOverlay) closeGuide();
  });
  suffixOverlay?.addEventListener("click", (e) => {
    if (e.target === suffixOverlay) closeSuffixGuide();
  });
  bookOverlay?.addEventListener("click", (e) => {
    if (e.target === bookOverlay) closeBook();
  });
  bookOverlay?.addEventListener(
    "wheel",
    (e) => {
      const scroller = bookBody;
      const card = bookOverlay.querySelector(".guide-card");
      if (!scroller || !card) {
        e.preventDefault();
        return;
      }
      if (!card.contains(e.target) && e.target !== card) {
        e.preventDefault();
        return;
      }
      e.preventDefault();
      scroller.scrollTop += e.deltaY;
    },
    { passive: false }
  );
  guideOverlay?.addEventListener(
    "wheel",
    (e) => {
      const card = guideOverlay.querySelector(".guide-card");
      if (!card) {
        e.preventDefault();
        return;
      }
      if (!card.contains(e.target) && e.target !== card) {
        e.preventDefault();
        return;
      }
      const atTop = card.scrollTop <= 0;
      const atBottom = card.scrollTop + card.clientHeight >= card.scrollHeight - 1;
      if ((e.deltaY < 0 && atTop) || (e.deltaY > 0 && atBottom)) {
        e.preventDefault();
      }
    },
    { passive: false }
  );
  window.addEventListener("keydown", (e) => {
    if (e.code !== "Escape") return;
    if (luckyBlockOverlay && !luckyBlockOverlay.classList.contains("hidden")) {
      e.preventDefault();
      closeLuckyBlockGui();
      return;
    }
    if (shinyMachineOverlay && !shinyMachineOverlay.classList.contains("hidden")) {
      e.preventDefault();
      closeShinyMachine();
      return;
    }
    if (settingsOverlay && !settingsOverlay.classList.contains("hidden")) {
      e.preventDefault();
      closeSettings();
      return;
    }
    if (adminOverlay && !adminOverlay.classList.contains("hidden")) {
      e.preventDefault();
      closeAdmin();
      return;
    }
    if (bookInspectEl && !bookInspectEl.classList.contains("hidden")) {
      e.preventDefault();
      closeBookInspect();
      return;
    }
    if (aquariumExpanded) {
      e.preventDefault();
      setAquariumExpanded(false);
      return;
    }
    if (bookOverlay && !bookOverlay.classList.contains("hidden")) {
      e.preventDefault();
      closeBook();
      return;
    }
    if (guideOverlay && !guideOverlay.classList.contains("hidden")) {
      e.preventDefault();
      closeGuide();
      return;
    }
    if (suffixOverlay && !suffixOverlay.classList.contains("hidden")) {
      e.preventDefault();
      closeSuffixGuide();
      return;
    }
    if (overlay && !overlay.classList.contains("hidden")) {
      e.preventDefault();
      closeMenu();
    }
  });
  gamesBtn?.addEventListener("click", () => {
    saveState();
    maybeSubmitBest(true);
    window.location.href = "../index.html#games";
  });

  function fishFromCatchScore(score) {
    const n = Math.floor(Number(score) || 0);
    if (n <= 0) return null;
    for (const fish of FISH) {
      for (let tier = 0; tier <= 19; tier += 1) {
        if (catchScore(fish, entryFromVariantTier(tier)) === n) return fish;
      }
      if (legacyCatchScore(fish) === n) return fish;
    }
    let best = null;
    let bestScore = -1;
    for (const fish of FISH) {
      for (let tier = 0; tier <= 19; tier += 1) {
        const s = catchScore(fish, entryFromVariantTier(tier));
        if (s <= n && s > bestScore) {
          best = fish;
          bestScore = s;
        }
      }
      const legacy = legacyCatchScore(fish);
      if (legacy <= n && legacy > bestScore) {
        best = fish;
        bestScore = legacy;
      }
    }
    return best;
  }

  function entryFromCatchScore(score) {
    const n = Math.floor(Number(score) || 0);
    if (n <= 0) return { variant: "", shiny: false, mutation: "" };
    for (const fish of FISH) {
      for (let tier = 0; tier <= 19; tier += 1) {
        if (catchScore(fish, entryFromVariantTier(tier)) === n) {
          return entryFromVariantTier(tier);
        }
      }
    }
    return { variant: "", shiny: false, mutation: "" };
  }

  function applyBestCatchScore(score, fishId, meta = null) {
    const n = Math.floor(Number(score) || 0);
    if (n <= 0) return false;
    if (n < (state.bestCatchScore || 0)) return false;
    const fish = fishById(fishId) || fishFromCatchScore(n);
    if (isExclusiveFish(fish) || isExclusiveFish(fishId)) return false;
    if (!fish && n <= (state.bestCatchScore || 0)) return false;
    state.bestCatchScore = Math.max(state.bestCatchScore || 0, n);
    if (fish) {
      state.bestCatchId = fish.id;
      markCaught(fish);
    } else if (!state.bestCatchId) {
      const match = fishFromCatchScore(state.bestCatchScore);
      if (match && !isExclusiveFish(match)) {
        state.bestCatchId = match.id;
        markCaught(match);
      }
    }
    const decoded = entryFromCatchScore(n);
    const entry = {
      variant: normalizeVariant(meta?.variant) || decoded.variant,
      shiny: !!(meta?.shiny || decoded.shiny),
      mutation: normalizeMutation(meta?.mutation) || decoded.mutation
    };
    if (n >= (state.bestCatchScore || 0)) {
      state.bestCatchVariant = entry.variant;
      state.bestCatchShiny = entry.shiny;
      state.bestCatchMutation = entry.mutation;
    }
    try {
      localStorage.setItem(HIGH_SCORE_KEY, String(state.bestCatchScore));
      const bestFish = fishById(state.bestCatchId);
      if (bestFish && !isExclusiveFish(bestFish)) persistBestCatchMeta(bestFish, bestCatchEntry());
    } catch {}
    return true;
  }

  /** Rebuild best catch from cooler + stored meta using precision-safe scores. */
  function refreshBestCatchFromCooler() {
    let bestFish = null;
    let bestEntry = { variant: "", shiny: false, mutation: "" };
    let bestScore = 0;
    const consider = (fish, entry) => {
      if (!fish || isExclusiveFish(fish) || isTreasureItem(fish)) return;
      const look = {
        variant: normalizeVariant(entry?.variant),
        shiny: !!entry?.shiny,
        mutation: normalizeMutation(entry?.mutation)
      };
      const score = catchScore(fish, look);
      if (score > bestScore) {
        bestScore = score;
        bestFish = fish;
        bestEntry = look;
      }
    };
    consider(fishById(state.bestCatchId), bestCatchEntry());
    (state.cooler || []).forEach((raw) => {
      const entry = normalizeCoolerEntry(raw);
      if (!entry) return;
      consider(fishById(entry.id), entry);
    });
    if (!bestFish) return false;
    const changed =
      bestFish.id !== state.bestCatchId ||
      bestScore !== Math.floor(Number(state.bestCatchScore) || 0) ||
      normalizeVariant(state.bestCatchVariant) !== bestEntry.variant ||
      !!state.bestCatchShiny !== !!bestEntry.shiny ||
      normalizeMutation(state.bestCatchMutation) !== bestEntry.mutation;
    state.bestCatchScore = bestScore;
    state.bestCatchId = bestFish.id;
    state.bestCatchVariant = bestEntry.variant;
    state.bestCatchShiny = !!bestEntry.shiny;
    state.bestCatchMutation = bestEntry.mutation;
    try {
      localStorage.setItem(HIGH_SCORE_KEY, String(bestScore));
      persistBestCatchMeta(bestFish, bestEntry);
    } catch {}
    if (changed) maybeSubmitBest(true);
    else maybeSubmitBest(true);
    return changed;
  }

  /** If best catch was an exclusive fish, roll back to the best non-exclusive catch. */
  function scrubExclusiveBestCatch() {
    const cur = fishById(state.bestCatchId);
    const fromScore = fishFromCatchScore(Math.floor(Number(state.bestCatchScore) || 0));
    if (!isExclusiveFish(cur) && !isExclusiveFish(fromScore)) return false;
    let best = null;
    let bestEntry = null;
    let bestScore = 0;
    const consider = (fish, entry) => {
      if (!fish || isExclusiveFish(fish) || isTreasureItem(fish)) return;
      const score = catchScore(fish, entry || {});
      if (score > bestScore) {
        bestScore = score;
        best = fish;
        bestEntry = entry || { variant: "", shiny: false, mutation: "" };
      }
    };
    (state.cooler || []).forEach((raw) => {
      const entry = normalizeCoolerEntry(raw);
      if (!entry) return;
      consider(fishById(entry.id), entry);
    });
    Object.keys(state.caught || {}).forEach((id) => {
      const fish = fishById(id);
      if (!fish || isExclusiveFish(fish)) return;
      const rec = state.caught[id];
      consider(fish, { variant: "", shiny: false, mutation: "" });
      if (rec && typeof rec === "object") {
        VARIANT_PRIMARY.forEach((v) => {
          if (rec[v]) consider(fish, { variant: v, shiny: false, mutation: "" });
          if (rec[v] && rec.shiny) consider(fish, { variant: v, shiny: true, mutation: "" });
        });
        if (rec.shiny) consider(fish, { variant: "", shiny: true, mutation: "" });
        MUTATIONS.forEach((m) => {
          if (rec[m]) consider(fish, { variant: "", shiny: !!rec.shiny, mutation: m });
        });
      }
    });
    state.bestCatchScore = bestScore;
    state.bestCatchId = best ? best.id : "";
    state.bestCatchVariant = normalizeVariant(bestEntry?.variant);
    state.bestCatchShiny = !!bestEntry?.shiny;
    state.bestCatchMutation = normalizeMutation(bestEntry?.mutation);
    try {
      localStorage.setItem(HIGH_SCORE_KEY, String(bestScore));
      if (best) persistBestCatchMeta(best, bestEntry);
      else localStorage.removeItem(BEST_CATCH_META_KEY);
    } catch {}
    return true;
  }

  function syncBestCatchFromLeaderboard() {
    let boardScore = 0;
    let boardFishing = null;
    try {
      if (window.HubLeaderboard?.getMyScore) {
        boardScore = Math.floor(Number(HubLeaderboard.getMyScore("fishing")) || 0);
      }
      if (window.HubLeaderboard?.getMyEntry) {
        boardFishing = HubLeaderboard.getMyEntry("fishing")?.fishing || null;
      }
    } catch {}
    if (boardFishing) {
      const id = String(boardFishing.id || "").toLowerCase();
      const rarity = String(boardFishing.rarity || "").toLowerCase();
      if (id === "soultwin" || rarity === "exclusive") boardScore = 0;
    }
    // Ignore pre-v3 collapsed Apex scores (~1e30+) that wipe looks.
    if (boardScore > 1e15) boardScore = 0;
    const boardFish = fishFromCatchScore(boardScore);
    if (isExclusiveFish(boardFish)) boardScore = 0;
    const stored = getStoredBest();
    const storedSafe = stored > 1e15 ? 0 : stored;
    const best = Math.max(state.bestCatchScore || 0, storedSafe, boardScore);

    if (best > (state.bestCatchScore || 0) || (best > 0 && !state.bestCatchId)) {
      applyBestCatchScore(best, state.bestCatchId || boardFishing?.id, boardFishing);
      renderStats();
    }
  }

  state = loadState();
  // Drop broken Infinity-scale packed scores so Shiny/Neon can outrank plain Apex.
  try {
    if (localStorage.getItem(CATCH_SCORE_V2_ID) !== "done") {
      localStorage.removeItem(HIGH_SCORE_KEY);
      state.bestCatchScore = 0;
      localStorage.setItem(CATCH_SCORE_V2_ID, "done");
    }
  } catch {}
  if (scrubExclusiveBestCatch()) {
    try {
      saveState();
    } catch {}
  }
  if (refreshBestCatchFromCooler()) {
    try {
      saveState();
    } catch {}
  } else {
    // Still rewrite score with safe formula + resubmit looks.
    try {
      refreshBestCatchFromCooler();
      saveState();
    } catch {}
  }
  if (ensureExclusiveCoolerValues()) {
    try {
      saveState();
    } catch {}
  }
  try {
    const name = String(
      window.HubPlays?.getName?.() || localStorage.getItem("hub-player-name") || ""
    )
      .trim()
      .toLowerCase();
    if (name === "ice_dragon" && localStorage.getItem(ICE_BOAT_GRANT_ID) !== "done") {
      if (boatLevel() < 1) {
        state.boatLevel = 1;
        boatAcc.boat = 0;
      }
      localStorage.setItem(ICE_BOAT_GRANT_ID, "done");
      saveState();
    }
    if (name === "ice_dragon" && localStorage.getItem(ICE_COINS_GRANT_ID) !== "done") {
      state.coins = Math.max(0, Number(state.coins) || 0) + ICE_COINS_GRANT_AMOUNT;
      localStorage.setItem(ICE_COINS_GRANT_ID, "done");
      saveState();
    }
    if (name === "ice_dragon" && localStorage.getItem(ICE_BEST_GRANT_ID) !== "done") {
      const prime = fishById("primefin");
      const entry = { variant: "", shiny: true };
      if (prime) {
        const score = catchScore(prime, entry);
        if (score > (state.bestCatchScore || 0)) {
          applyBestCatchScore(score, "primefin", entry);
          markCaught(prime, entry);
        }
      }
      localStorage.setItem(ICE_BEST_GRANT_ID, "done");
      saveState();
      maybeSubmitBest(true);
    }
    if (name === "ice_dragon" && localStorage.getItem(ICE_CHESTS_GRANT_ID) !== "done") {
      state.moneyChestCount = Math.min(
        treasureStashMax(),
        Math.max(0, Math.floor(Number(state.moneyChestCount) || 0)) + ICE_MONEY_CHEST_GRANT
      );
      state.luckChestCount = Math.min(
        treasureStashMax(),
        Math.max(0, Math.floor(Number(state.luckChestCount) || 0)) + ICE_LUCK_CHEST_GRANT
      );
      localStorage.setItem(ICE_CHESTS_GRANT_ID, "done");
      saveState();
    }
  } catch {}

  /** Deferred so gift poll can't immediately re-add a trimmed Soul Twin. */
  function scheduleIceSoulTwinTrim() {
    let attempts = 0;
    const tryTrim = async () => {
      try {
        const name = String(
          window.HubPlays?.getName?.() || localStorage.getItem("hub-player-name") || ""
        )
          .trim()
          .toLowerCase();
        if (name !== "ice_dragon") return;
        if (localStorage.getItem(ICE_SOUL_TWIN_TRIM_ID) === "done") return;
        attempts += 1;
        await burnPendingSoulTwinGifts();
        const removed = removeSoulTwinsFromCooler(1);
        if (removed) {
          localStorage.setItem(ICE_SOUL_TWIN_TRIM_ID, "done");
          setCatchLine("Removed 1 Soul Twin", "treasure");
          return;
        }
        // Only stamp done after retries if nothing left to delete.
        if (attempts >= 2) localStorage.setItem(ICE_SOUL_TWIN_TRIM_ID, "done");
      } catch {}
    };
    setTimeout(() => {
      tryTrim().catch(() => {});
    }, 2500);
    setTimeout(() => {
      tryTrim().catch(() => {});
    }, 6000);
  }
  scheduleIceSoulTwinTrim();
  applyOffline();
  if (state.pendingOffline && !state.pendingOffline.claimed) showOfflineClaim();
  setPhase("ready");
  syncBestCatchFromLeaderboard();
  applyLightningFlashPref();
  document.getElementById("hub-sound-btn")?.remove();
  render();
  checkAchievements();
  clampTreasureStashCounts(true);
  startAdminEventPolling();
  startFishGiftPolling();
  startPlayerMailPolling();
  startAquariumSharing();
  syncCommunity(true).catch(() => {});
  setInterval(() => {
    syncCommunity(false).catch(() => {});
  }, COMMUNITY_POLL_MS);
  // Titles may sync later — re-clamp once MASTER FISHER is known.
  setTimeout(() => {
    if (clampTreasureStashCounts(true)) renderTreasureStash();
  }, 1200);
  setTimeout(() => {
    if (clampTreasureStashCounts(true)) renderTreasureStash();
  }, 4000);
  // Leaderboard sync may finish a moment later — refresh HUD when it does.
  setTimeout(syncBestCatchFromLeaderboard, 800);
  setTimeout(syncBestCatchFromLeaderboard, 2500);
  if (window.HubLeaderboard?.sync) {
    HubLeaderboard.sync(true)
      .then(() => syncBestCatchFromLeaderboard())
      .catch(() => {});
  }
  setInterval(tick, TICK_MS);
  setInterval(() => {
    saveState();
    maybeSubmitBest(true);
  }, 15000);
  window.addEventListener("beforeunload", () => {
    saveState();
    maybeSubmitBest(true);
    window.HubSound?.stopAmbient?.();
  });
  window.addEventListener("pagehide", () => {
    saveState();
    window.HubSound?.stopAmbient?.();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      saveState();
      lastWeatherSoundId = "";
      window.HubSound?.stopAmbient?.();
    } else {
      applyWeatherFx();
    }
  });
})();
