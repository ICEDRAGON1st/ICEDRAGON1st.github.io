(function () {
  const SAVE_KEY = "fishing-save-v3";
  const HIGH_SCORE_KEY = "fishing-best-catch-v2";
  const BEST_CATCH_META_KEY = "fishing-best-catch-meta-v2";

  // Drop old Fishing Idle progress keys (full reset — this game only)
  try {
    localStorage.removeItem("fishing-save-v2");
    localStorage.removeItem("fishing-best-catch-v1");
    localStorage.removeItem("fishing-best-catch-meta-v1");
  } catch {}

  const ICE_BOAT_GRANT_ID = "fishing-ice-dragon-boat-lv1-v1";
  const ICE_COINS_GRANT_ID = "fishing-ice-dragon-coins-1m-v1";
  const ICE_COINS_GRANT_AMOUNT = 1_000_000;
  const TICK_MS = 100;
  const COOLER_BASE = 12;
  const TREASURE_BOOST_MS = 5 * 60 * 1000;
  const TREASURE_MULT = 2;
  const TREASURE_LUCK_MULT = 1.5;
  const TREASURE_STASH_MAX = 25;
  const EVENT_MS = 30 * 60 * 1000;
  const EVENT_ACTIVE_MS = 5 * 60 * 1000; // only first 5 minutes of each :00 / :30
  const EVENT_MONEY_BONUS = 1; // alone → 2× sell
  const EVENT_LUCK_BONUS = 1; // alone → 2× luck
  const CHEST_MONEY_BONUS = TREASURE_MULT - 1; // +1 → 2×
  const CHEST_LUCK_BONUS = TREASURE_LUCK_MULT - 1; // +0.5 → 1.5×
  // Chest + matching event stacks additively (luck chest + luck event = 2.5×)
  // Global admin override: Mantle (ICE in-game) + admin-event.json (chat push)
  const OWNER_NAME = "ice_dragon";
  const ADMIN_EVENT_URL = "admin-event.json";
  const ADMIN_EVENT_API = "https://mantledb.sh/v2/icedragon1st-mygames/fishing-admin-events";
  const ADMIN_EVENT_TOKEN = "ice-fish-evt-9f3a";
  const ADMIN_EVENT_POLL_MS = 15_000;
  const ADMIN_EVENT_RATE_KEY = "fishing-admin-mantle-until-v1";
  const ADMIN_EVENT_LOCAL_KEY = "fishing-admin-override-v1"; // legacy single-slot
  const ADMIN_EVENT_LOCAL_BOOST_KEY = "fishing-admin-boost-v1";
  const ADMIN_EVENT_LOCAL_VARIANT_KEY = "fishing-admin-variant-v1";
  const ADMIN_EVENT_PENDING_KEY = "fishing-admin-pending-v1";
  const ADMIN_SCOPE_KEY = "fishing-admin-scope-v1";
  const ADMIN_RATE_BACKOFF_MS = 45_000;
  const ADMIN_DEFAULT_MINUTES = 5;
  const ADMIN_DEFAULT_MULT = 2;
  const ADMIN_MAX_MINUTES = 180;
  const ADMIN_MIN_MULT = 1.5;
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
    "absolute"
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
    absolute: 17
  };

  const RARITY_WEIGHT = {
    common: 26,
    uncommon: 24,
    rare: 22,
    epic: 13,
    legendary: 6.5,
    mythic: 2.4,
    secret: 0.55,
    divine: 0.2,
    eternal: 0.08,
    cosmic: 0.028,
    astral: 0.011,
    singularity: 0.004,
    omega: 0.0014,
    genesis: 0.0005,
    paradox: 0.0002,
    infinity: 0.00008,
    absolute: 0.00003
  };

  const FISH = [
    // Common
    { id: "minnow", name: "Minnow", rarity: "common", value: 3 },
    { id: "perch", name: "Perch", rarity: "common", value: 5 },
    { id: "bluegill", name: "Bluegill", rarity: "common", value: 6 },
    { id: "sardine", name: "Sardine", rarity: "common", value: 4 },
    { id: "smelt", name: "Smelt", rarity: "common", value: 5 },
    { id: "carp", name: "Carp", rarity: "common", value: 7 },
    { id: "roach", name: "Roach", rarity: "common", value: 4 },
    { id: "goby", name: "Goby", rarity: "common", value: 6 },
    // Uncommon
    { id: "trout", name: "Trout", rarity: "uncommon", value: 14 },
    { id: "bass", name: "Bass", rarity: "uncommon", value: 18 },
    { id: "catfish", name: "Catfish", rarity: "uncommon", value: 22 },
    { id: "walleye", name: "Walleye", rarity: "uncommon", value: 20 },
    { id: "snapper", name: "Snapper", rarity: "uncommon", value: 24 },
    { id: "mackerel", name: "Mackerel", rarity: "uncommon", value: 16 },
    { id: "cod", name: "Cod", rarity: "uncommon", value: 19 },
    { id: "flounder", name: "Flounder", rarity: "uncommon", value: 21 },
    // Rare
    { id: "salmon", name: "Salmon", rarity: "rare", value: 45 },
    { id: "pike", name: "Pike", rarity: "rare", value: 55 },
    { id: "mahi", name: "Mahi-Mahi", rarity: "rare", value: 60 },
    { id: "grouper", name: "Grouper", rarity: "rare", value: 70 },
    { id: "barracuda", name: "Barracuda", rarity: "rare", value: 65 },
    { id: "sturgeon", name: "Sturgeon", rarity: "rare", value: 80 },
    { id: "eel", name: "Moray Eel", rarity: "rare", value: 58 },
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
    { id: "theabsolute", name: "The Absolute", rarity: "absolute", value: 10000000000000000 }
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
    }
  ];

  const MAX_SPOT_RARITY = 27;

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
    { id: "luck1", name: "Lucky Hook", desc: "+rarity luck · better chest finds", cost: 120, kind: "luck", amount: 8 },
    { id: "luck2", name: "Tide Charm", desc: "+rarity luck · better chest finds", cost: 700, kind: "luck", amount: 12 },
    { id: "luck3", name: "Pearl Lure", desc: "+rarity luck · better chest finds", cost: 4000, kind: "luck", amount: 16 },
    { id: "luck4", name: "Siren Bell", desc: "+rarity luck · better chest finds", cost: 20000, kind: "luck", amount: 22 },
    { id: "luck5", name: "Oracle Coin", desc: "+rarity luck · better chest finds", cost: 100000, kind: "luck", amount: 30 },
    { id: "luck6", name: "Fate Hook", desc: "+rarity luck · better chest finds", cost: 500000, kind: "luck", amount: 40 },
    { id: "luck7", name: "Cosmic Lure", desc: "+rarity luck · better chest finds", cost: 2500000, kind: "luck", amount: 55 },
    { id: "luck8", name: "Horizon Charm", desc: "+rarity luck · better chest finds", cost: 12000000, kind: "luck", amount: 70 },
    { id: "luck9", name: "Omega Coin", desc: "+rarity luck · better chest finds", cost: 60000000, kind: "luck", amount: 90 },
    { id: "luck10", name: "Prism Hook", desc: "+rarity luck · better chest finds", cost: 150000000, kind: "luck", amount: 100 },
    { id: "luck11", name: "Apex Charm", desc: "+rarity luck · better chest finds", cost: 400000000, kind: "luck", amount: 120 },
    { id: "luck12", name: "Mirage Coin", desc: "+rarity luck · better chest finds", cost: 700000000, kind: "luck", amount: 130 },
    { id: "luck13", name: "Zenith Lure", desc: "+rarity luck · better chest finds", cost: 1200000000, kind: "luck", amount: 150 },
    { id: "luck14", name: "Rift Hook", desc: "+rarity luck · better chest finds", cost: 2000000000, kind: "luck", amount: 160 },
    { id: "luck15", name: "Quasar Charm", desc: "+rarity luck · better chest finds", cost: 3500000000, kind: "luck", amount: 180 },
    { id: "luck16", name: "Eclipse Coin", desc: "+rarity luck · better chest finds", cost: 5500000000, kind: "luck", amount: 200 },
    { id: "luck17", name: "Helix Lure", desc: "+rarity luck · better chest finds", cost: 9000000000, kind: "luck", amount: 220 },
    { id: "luck18", name: "Prism Fate", desc: "+rarity luck · better chest finds", cost: 25000000000, kind: "luck", amount: 250 },
    { id: "luck19", name: "Chrono Bell", desc: "+rarity luck · better chest finds", cost: 80000000000, kind: "luck", amount: 280 },
    { id: "luck20", name: "Genesis Charm", desc: "+rarity luck · better chest finds", cost: 250000000000, kind: "luck", amount: 320 },
    { id: "luck21", name: "Absolution Hook", desc: "+rarity luck · better chest finds", cost: 1e12, kind: "luck", amount: 360 },
    { id: "luck22", name: "Singularity Coin", desc: "+rarity luck · better chest finds", cost: 5e12, kind: "luck", amount: 420 },
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
    { id: "perfect16", name: "Omni Timing", desc: "+160% sell on perfect reels", cost: 6e12, kind: "perfect", amount: 1.6 }
  ];

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
    }
  ];
  const BOAT_MAX_LEVEL = BOAT_TIERS.length - 1;

  const coinCountEl = document.getElementById("coin-count");
  const spotLabelEl = document.getElementById("spot-label");
  const windowLabelEl = document.getElementById("window-label");
  const waitLabelEl = document.getElementById("wait-label");
  const luckLabelEl = document.getElementById("luck-label");
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
  const moneyUseBtn = document.getElementById("money-chest-use-btn");
  const luckUseBtn = document.getElementById("luck-chest-use-btn");
  const multiLabelEl = document.getElementById("multi-label");
  const tripleLabelEl = document.getElementById("triple-label");
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
  const shopCats = document.getElementById("shop-cats");
  const spotList = document.getElementById("spot-list");
  const overlay = document.getElementById("overlay");
  const overlayBestEl = document.getElementById("overlay-best");
  const startBtn = document.getElementById("start-btn");
  const gamesBtn = document.getElementById("games-btn");
  const menuBtn = document.getElementById("menu-btn");
  const guideBtn = document.getElementById("guide-btn");
  const bookBtn = document.getElementById("book-btn");
  const menuGuideBtn = document.getElementById("menu-guide-btn");
  const menuBookBtn = document.getElementById("menu-book-btn");
  const guideOverlay = document.getElementById("guide-overlay");
  const bookOverlay = document.getElementById("book-overlay");
  const adminOverlay = document.getElementById("admin-overlay");
  const adminBtn = document.getElementById("admin-btn");
  const adminClose = document.getElementById("admin-close");
  const guideClose = document.getElementById("guide-close");
  const bookClose = document.getElementById("book-close");
  const guideBody = document.getElementById("guide-body");
  const guideVariantsBody = document.getElementById("guide-variants-body");
  const bookBody = document.getElementById("book-body");
  const bookFiltersEl = document.getElementById("book-filters");
  const bookProgressEl = document.getElementById("book-progress");
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
      blurb: "Boost rarity odds toward rarer fish."
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
      id: "perfect",
      title: "Perfect pay",
      blurb: "Earn more when you sell fish caught on a perfect reel."
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
      bestCatchScore: 0,
      bestCatchId: "",
      caught: {},
      boatLevel: 0,
      catches: 0,
      perfects: 0,
      lastTick: Date.now(),
      moneyBoostUntil: 0,
      luckBoostUntil: 0,
      moneyChestCount: 0,
      luckChestCount: 0
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
    return Math.min(2.8, 0.45 + bonus);
  }

  function waitScale() {
    const cut = equippedSpeedGear()?.amount || 0;
    return Math.max(0.16, 1 - cut);
  }

  function luckBonus() {
    return ownedGear("luck").reduce((s, g) => s + g.amount, 0);
  }

  /** Spot rarity points that count as luck (Creek = 0, later spots higher). */
  function spotLuckBonus(spot = currentSpot()) {
    return Math.max(0, Number(spot?.rarity) || 0);
  }

  /** Raw luck before chests/events: gear + current spot. */
  function baseLuck(spot = currentSpot()) {
    return Math.max(0, luckBonus()) + spotLuckBonus(spot);
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

  function coolerMax() {
    return COOLER_BASE + ownedGear("cooler").reduce((s, g) => s + g.amount, 0);
  }

  function sellBonus() {
    return ownedGear("value").reduce((s, g) => s + g.amount, 0);
  }

  /** Effective sell vs fish base value: spot × gear sell boost × treasure. */
  function totalSellFactor() {
    const spot = currentSpot();
    return Math.max(
      0.01,
      (Number(spot?.valueMult) || 1) * (1 + sellBonus()) * treasureMoneyMult()
    );
  }

  function moneyBoostActive() {
    return moneyMsLeft() > 0;
  }

  function luckBoostActive() {
    return luckMsLeft() > 0;
  }

  function moneyMsLeft() {
    const until = Math.max(0, Number(state.moneyBoostUntil) || 0);
    return Math.max(0, until - Date.now());
  }

  function luckMsLeft() {
    const until = Math.max(0, Number(state.luckBoostUntil) || 0);
    return Math.max(0, until - Date.now());
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

  let adminBoostCache = null;
  let adminVariantCache = null;
  let adminEventFetchedAt = 0;
  let adminEventPollTimer = 0;
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
    return playerNameLower() === OWNER_NAME;
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
    const v = Math.floor(Number(n));
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
    return e.kind === "luck" ? "luck" : "sell";
  }

  function parseAdminEventPayload(data, requireToken = false) {
    if (!data || typeof data !== "object") return null;
    if (requireToken && String(data.token || "") !== ADMIN_EVENT_TOKEN) return null;
    let kind = String(data.kind || "").toLowerCase();
    let target = normalizeAdminVariantTarget(
      data.target || data.variant || (isVariantTargetSpec(kind) ? kind : "")
    );
    if (kind !== "luck" && kind !== "money" && kind !== "variant" && isVariantTargetSpec(kind)) {
      target = normalizeAdminVariantTarget(kind);
      kind = "variant";
    }
    if (kind !== "luck" && kind !== "money" && kind !== "variant") return null;
    if (kind === "variant" && !target) target = "gold";
    const until = Math.floor(Number(data.until) || 0);
    if (!Number.isFinite(until) || until <= Date.now()) return null;
    const startedAt = Math.floor(Number(data.startedAt) || until - EVENT_ACTIVE_MS);
    return {
      kind,
      target: kind === "variant" ? target : "",
      until,
      startedAt: Number.isFinite(startedAt) ? startedAt : Date.now(),
      mult: clampAdminMult(data.mult ?? ADMIN_DEFAULT_MULT),
      scope: String(data.scope || "") || ""
    };
  }

  /** Parse boost + variant channels from new bundle or legacy single-event JSON. */
  function parseAdminBundle(data, requireToken = false) {
    if (!data || typeof data !== "object") return { boost: null, variant: null };
    if (requireToken && String(data.token || "") !== ADMIN_EVENT_TOKEN) {
      return { boost: null, variant: null };
    }
    const inherit = { token: data.token || (requireToken ? ADMIN_EVENT_TOKEN : undefined) };
    let boost = null;
    let variant = null;
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
    const single = parseAdminEventPayload(
      requireToken ? data : { ...data, token: data.token },
      requireToken
    );
    if (single) {
      if (isBoostAdminPayload(single)) boost = pickBetterAdminEvent(boost, single);
      if (isVariantAdminPayload(single)) variant = pickBetterAdminEvent(variant, single);
    }
    return { boost, variant };
  }

  function isBoostAdminPayload(e) {
    return !!e && (e.kind === "luck" || e.kind === "money");
  }

  function isVariantAdminPayload(e) {
    return !!e && e.kind === "variant";
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
    const now = Date.now();
    const liveBoost = boost && boost.until > now ? boost : null;
    const liveVariant = variant && variant.until > now ? variant : null;
    return {
      token: ADMIN_EVENT_TOKEN,
      scope: scope === "global" ? "global" : "local",
      boost: serializeAdminChannel(liveBoost),
      variant: serializeAdminChannel(liveVariant),
      // Legacy flat fields = boost preferred, else variant (old clients)
      kind: liveBoost?.kind || liveVariant?.kind || "luck",
      target: liveVariant?.target || "",
      until: Math.max(liveBoost?.until || 0, liveVariant?.until || 0),
      startedAt: Math.max(liveBoost?.startedAt || 0, liveVariant?.startedAt || 0, now),
      mult: liveBoost?.mult || liveVariant?.mult || ADMIN_DEFAULT_MULT,
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
    let mantleData = null;
    if (!adminEventRateLimited()) {
      const mantle = await fetchAdminJson(ADMIN_EVENT_API, { trackRate: true });
      if (mantle.ok && !mantle.rateLimited) clearAdminEventRateLimited();
      mantleData = mantle.data;
    }

    const remoteA = parseAdminBundle(mantleData, true);
    const remoteB = parseAdminBundle(file.data, false);
    const remoteBoost = pickBetterAdminEvent(remoteA.boost, remoteB.boost);
    const remoteVariant = pickBetterAdminEvent(remoteA.variant, remoteB.variant);
    adminBoostCache = pickBetterAdminEvent(remoteBoost, localAdminBoost());
    adminVariantCache = pickBetterAdminEvent(remoteVariant, localAdminVariant());
    syncAdminPanel();
    maybeRetryPendingAdminPush();
  }

  function startAdminEventPolling() {
    migrateLegacyAdminLocal();
    restorePendingAdminPush();
    pollAdminEvent(true);
    if (adminEventPollTimer) clearInterval(adminEventPollTimer);
    adminEventPollTimer = setInterval(() => pollAdminEvent(false), ADMIN_EVENT_POLL_MS);
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
    scheduleAdminRetry();
  }

  function scheduleAdminRetry() {
    if (adminRetryTimer) return;
    adminRetryTimer = setInterval(() => {
      maybeRetryPendingAdminPush();
    }, 20_000);
  }

  async function maybeRetryPendingAdminPush() {
    if (!pendingAdminPush || !isFishingOwner()) return;
    if (String(pendingAdminPush.scope || "global") === "local") {
      clearPendingAdminPush();
      return;
    }
    if (adminBusy || adminEventRateLimited()) return;
    const payload = pendingAdminPush;
    try {
      const res = await fetch(ADMIN_EVENT_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (res.status === 429) {
        markAdminEventRateLimited();
        return;
      }
      if (!res.ok) return;
      clearAdminEventRateLimited();
      pendingAdminPush = null;
      writeStoredAdmin(ADMIN_EVENT_PENDING_KEY, null);
      if (adminRetryTimer) {
        clearInterval(adminRetryTimer);
        adminRetryTimer = 0;
      }
      const bundle = parseAdminBundle(payload, true);
      adminBoostCache = bundle.boost;
      adminVariantCache = bundle.variant;
      syncAdminPanel();
      setCatchLine("Admin event synced to all players", "treasure");
    } catch {
      /* keep pending */
    }
  }

  function syncAdminPanel() {
    const owner = isFishingOwner();
    if (adminBtn) {
      adminBtn.classList.toggle("hidden", !owner);
      adminBtn.hidden = !owner;
    }
    if (adminOverlay && !owner) {
      adminOverlay.classList.add("hidden");
    }
    syncAdminScopeButtons();
    const status = document.getElementById("admin-status");
    if (!status || !owner) return;
    const boost = adminBoostEventLive();
    const variant = adminVariantEventLive();
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
    if (bits.length) {
      status.textContent = `Live: ${bits.join(" · ")}`;
    } else {
      status.textContent = "No admin event · luck/sell and variant can run together";
    }
  }

  function getAdminScope() {
    try {
      const saved = String(localStorage.getItem(ADMIN_SCOPE_KEY) || "").toLowerCase();
      if (saved === "global" || saved === "local") return saved;
    } catch {}
    return "local";
  }

  function setAdminScope(scope) {
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
    if (!isFishingOwner()) return;
    syncAdminPanel();
    adminOverlay?.classList.remove("hidden");
    lockPageScroll();
    document.getElementById("admin-cmd-input")?.focus?.();
  }

  function closeAdmin() {
    adminOverlay?.classList.add("hidden");
    unlockPageScroll();
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

  function applyAdminLocally(channel, payload, clear = false) {
    if (channel === "variant") {
      if (clear) {
        setLocalAdminVariant(null, true);
        adminVariantCache = null;
      } else {
        setLocalAdminVariant(payload, false);
        adminVariantCache = parseAdminEventPayload(payload, true);
      }
    } else if (channel === "boost") {
      if (clear) {
        setLocalAdminBoost(null, true);
        adminBoostCache = null;
      } else {
        setLocalAdminBoost(payload, false);
        adminBoostCache = parseAdminEventPayload(payload, true);
      }
    } else if (channel === "all") {
      setLocalAdminBoost(null, true);
      setLocalAdminVariant(null, true);
      adminBoostCache = null;
      adminVariantCache = null;
    }
    lastAnnouncedEventKey = "";
    lastAnnouncedVariantKey = "";
    syncAdminPanel();
    renderStats();
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
    if (!isFishingOwner()) {
      setCatchLine("Admin commands are ICE_DRAGON only", "miss");
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
    const wantGlobal = scope === "global";

    let eventKind = rawKind;
    let eventTarget = normalizeAdminVariantTarget(
      target || (isVariantTargetSpec(eventKind) ? eventKind : "")
    );
    if (
      eventKind !== "luck" &&
      eventKind !== "money" &&
      eventKind !== "variant" &&
      isVariantTargetSpec(eventKind)
    ) {
      eventTarget = normalizeAdminVariantTarget(eventKind);
      eventKind = "variant";
    }
    if (eventKind === "variant" && !eventTarget) eventTarget = "gold";

    const isClear = clearAll || clearBoostOnly || clearVariantOnly;
    if (
      !isClear &&
      eventKind !== "luck" &&
      eventKind !== "money" &&
      eventKind !== "variant"
    ) {
      adminBusy = false;
      setCatchLine("Try: 5x luck · 5x shiny + gold · clear · clear variant", "miss");
      return false;
    }

    const channel =
      clearAll || clearBoostOnly || clearVariantOnly
        ? clearAll
          ? "all"
          : clearVariantOnly
            ? "variant"
            : "boost"
        : eventKind === "variant"
          ? "variant"
          : "boost";

    const channelPayload = {
      token: ADMIN_EVENT_TOKEN,
      kind: eventKind === "variant" ? "variant" : eventKind,
      target: eventKind === "variant" ? eventTarget : "",
      until: now + mins * 60_000,
      startedAt: now,
      mult: eventMult,
      scope: wantGlobal ? "global" : "local",
      note: wantGlobal ? "in-game-admin-global" : "in-game-admin-local",
      by: OWNER_NAME
    };

    if (clearAll) applyAdminLocally("all", null, true);
    else if (clearBoostOnly) applyAdminLocally("boost", null, true);
    else if (clearVariantOnly) applyAdminLocally("variant", null, true);
    else applyAdminLocally(channel, channelPayload, false);

    const label = isClear
      ? clearAll
        ? "all events"
        : clearVariantOnly
          ? "variant"
          : "luck/sell"
      : eventKind === "variant"
        ? formatAdminVariantLabel(eventTarget)
        : eventKind === "luck"
          ? "luck"
          : "sell";

    const bundle = buildAdminSyncBundle(wantGlobal ? "global" : "local");

    if (!wantGlobal) {
      clearPendingAdminPush();
      if (isClear) {
        setCatchLine(`Local admin ${label} cleared`, "treasure");
      } else {
        setCatchLine(
          `LOCAL ADMIN · ${formatMult(eventMult)}× ${label} for ${mins}m (only you)`,
          "treasure"
        );
        window.HubSound?.play?.("win");
        window.HubConfetti?.burst?.();
      }
      adminBusy = false;
      return true;
    }

    pendingAdminPush = bundle;
    writeStoredAdmin(ADMIN_EVENT_PENDING_KEY, bundle);
    if (isClear) {
      setCatchLine(`Clearing global admin ${label}…`, "treasure");
    } else {
      setCatchLine(
        `GLOBAL ADMIN · ${formatMult(eventMult)}× ${label} for ${mins}m (syncing…)`,
        "treasure"
      );
      window.HubSound?.play?.("win");
      window.HubConfetti?.burst?.();
    }

    try {
      const res = await fetch(ADMIN_EVENT_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bundle)
      });
      if (res.status === 429) {
        markAdminEventRateLimited();
        scheduleAdminRetry();
        setCatchLine(
          isClear
            ? `Cleared here · Mantle busy, will sync ${label} clear soon`
            : `Live here · ${formatMult(eventMult)}× ${label} · syncing global when Mantle frees up`,
          "treasure"
        );
        return true;
      }
      if (!res.ok) throw new Error("push failed");
      clearAdminEventRateLimited();
      clearPendingAdminPush();
      setCatchLine(
        isClear
          ? `Global admin ${label} cleared`
          : `GLOBAL ADMIN · ${formatMult(eventMult)}× ${label} live for ${mins}m (all players)`,
        "treasure"
      );
      return true;
    } catch {
      scheduleAdminRetry();
      setCatchLine(
        isClear
          ? `Cleared here · will sync ${label} clear when online`
          : "Live here · will sync to all players when online",
        "treasure"
      );
      return true;
    } finally {
      adminBusy = false;
    }
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
      if (/\b(variant|silver|gold|diamond|rainbow|shiny|any)\b/.test(text)) {
        return { kind: "clear-variant", minutes: 0, mult: ADMIN_DEFAULT_MULT, scope, target: "" };
      }
      if (/\b(luck|sell|money|coin|boost)\b/.test(text)) {
        return { kind: "clear-boost", minutes: 0, mult: ADMIN_DEFAULT_MULT, scope, target: "" };
      }
      return { kind: "clear", minutes: 0, mult: ADMIN_DEFAULT_MULT, scope, target: "" };
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
      /^(sell|money|coin|luck|silver|gold|diamond|rainbow|shiny|any|variant)(\s+(silver|gold|diamond|rainbow|shiny|any))*$/.test(
        text
      )
    ) {
      mult = defaults.mult;
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

  async function runAdminCommand(raw) {
    const parsed = parseAdminCommand(raw);
    if (!parsed) {
      setCatchLine("Try: 5x luck · 5x shiny + gold · clear · clear variant", "miss");
      return;
    }
    if (parsed.scope === "local" || parsed.scope === "global") {
      setAdminScope(parsed.scope);
    }
    await publishAdminEvent(
      parsed.kind,
      parsed.minutes,
      parsed.mult,
      parsed.scope,
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
    return kind === "luck" ? 1 + EVENT_LUCK_BONUS : 1 + EVENT_MONEY_BONUS;
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
        window.HubSound?.play?.("win");
        window.HubConfetti?.burst?.();
      }
    } else {
      lastAnnouncedVariantKey = "";
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
    if (kind === "luck") {
      const stacked = formatMult(1 + CHEST_LUCK_BONUS + (liveEventMult() - 1));
      setCatchLine(
        `${tag} · ${multLabel}× luck (${left} left) · stacks with Luck Chest → ${stacked}×`,
        "treasure"
      );
    } else {
      const stacked = formatMult(1 + CHEST_MONEY_BONUS + (liveEventMult() - 1));
      setCatchLine(
        `${tag} · ${multLabel}× sell (${left} left) · stacks with Coin Chest → ${stacked}×`,
        "treasure"
      );
    }
    window.HubSound?.play?.("win");
    window.HubConfetti?.burst?.();
  }

  function renderEventBanner() {
    const live = eventIsLive();
    const kind = currentEventKind();
    const admin = adminBoostEventLive();
    const variant = adminVariantEventLive();
    const nextStart = nextHalfHourStart();
    const nextKind = eventKindForStart(nextStart);
    const untilNext = msUntilNextEvent();
    const previewKind = live ? kind : nextKind;
    const multLabel = formatMult(live ? liveEventMult() : 2);
    const variantMult = variant ? formatMult(variant.mult) : "";

    if (eventBannerEl) {
      eventBannerEl.classList.toggle("event-idle", !live && !variant);
      eventBannerEl.classList.toggle("is-live", live || !!variant);
      eventBannerEl.classList.toggle("event-money", live && previewKind === "money");
      eventBannerEl.classList.toggle("event-luck", live && previewKind === "luck");
      eventBannerEl.classList.toggle("event-variant", !!variant);
    }
    if (eventBannerTagEl) {
      eventBannerTagEl.textContent =
        variant || admin ? "ADMIN LIVE" : live ? "LIVE NOW" : "Next event";
    }
    if (eventBannerTitleEl) {
      const parts = [];
      if (live && kind === "luck") {
        parts.push(admin ? `${multLabel}× Luck` : "2× Luck");
      } else if (live && kind === "money") {
        parts.push(admin ? `${multLabel}× Sell` : "2× Sell");
      }
      if (variant) {
        parts.push(`${variantMult}× ${formatAdminVariantLabel(variant.target)}`);
      }
      if (parts.length) {
        eventBannerTitleEl.textContent = `${parts.join(" + ")}${
          admin || variant ? " · Admin" : " Event"
        }`;
      } else {
        eventBannerTitleEl.textContent =
          nextKind === "luck" ? "Upcoming: 2× Luck" : "Upcoming: 2× Sell";
      }
    }
    if (eventBannerTimeEl) {
      const times = [];
      if (live) times.push(eventMsLeft());
      if (variant) times.push(Math.max(0, variant.until - Date.now()));
      if (times.length) {
        eventBannerTimeEl.textContent = `${formatTreasureClock(Math.min(...times))} left`;
      } else {
        eventBannerTimeEl.textContent = `in ${formatTreasureClock(untilNext)}`;
      }
    }
  }

  function isTreasureItem(fish) {
    return (
      fish?.rarity === "treasure" ||
      fish?.id === "coin_chest" ||
      fish?.id === "luck_chest" ||
      fish?.id === "sunken_chest"
    );
  }

  function treasureByKind(kind) {
    return kind === "luck" ? TREASURE_LUCK : TREASURE_MONEY;
  }

  /** Combined chance to find any chest; then 50/50 Coin vs Luck. Luck gear raises this. */
  function treasureAnyChance(spot, forBoat = false) {
    const t = Math.max(0, Math.min(MAX_SPOT_RARITY, Number(spot?.rarity) || 0)) / MAX_SPOT_RARITY;
    // Base: ~0.10% creek → ~0.28% omega
    const base = 0.001 + t * 0.0018;
    // Boat luck is 35% as strong; cast luck is full
    const luck = Math.max(0, effectiveLuckBonus(spot) * (forBoat ? 0.35 : 1));
    // Soft scale so upgrades clearly raise odds (guide updates live)
    // luck 8 → ×1.08 · luck 30 → ×1.30 · luck 100 → ×2.00 · hard cap ×4
    const luckMult = 1 + Math.min(3, luck * 0.01);
    let p = base * luckMult;
    if (forBoat) p *= 0.35;
    return Math.min(0.06, p);
  }

  function treasureKindChance(spot, forBoat = false) {
    return treasureAnyChance(spot, forBoat) / 2;
  }

  function rollTreasure(spot, forBoat = false, chanceScale = 1) {
    const scale = Math.max(0, Number(chanceScale) || 0);
    if (Math.random() >= treasureAnyChance(spot, forBoat) * scale) return null;
    return Math.random() < 0.5 ? TREASURE_MONEY : TREASURE_LUCK;
  }

  function formatTreasureClock(ms) {
    const total = Math.max(0, Math.ceil(ms / 1000));
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  }

  function chestCountKey(kind) {
    return kind === "luck" ? "luckChestCount" : "moneyChestCount";
  }

  function activateMoneyBoost(opts = {}) {
    const now = Date.now();
    const wasActive = (Number(state.moneyBoostUntil) || 0) > now;
    const current = Math.max(now, Number(state.moneyBoostUntil) || 0);
    state.moneyBoostUntil = current + TREASURE_BOOST_MS;
    if (!opts.silent) {
      const left = formatTreasureClock(state.moneyBoostUntil - now);
      const total = formatMult(treasureMoneyMult());
      const eventNote = eventMoneyActive()
        ? ` · event stacked → ${total}× sell (${formatTreasureClock(eventMsLeft())} left on event)`
        : "";
      setCatchLine(
        wasActive
          ? `Coin Chest · +5:00 chest time · ${total}× sell · ${left} left`
          : `Opened Coin Chest! ${TREASURE_MULT}× sell for 5:00${eventNote}`,
        "treasure"
      );
      window.HubSound?.play?.("win");
      window.HubConfetti?.burst?.();
    }
    renderStats();
    saveSoon();
  }

  function activateLuckBoost(opts = {}) {
    const now = Date.now();
    const wasActive = (Number(state.luckBoostUntil) || 0) > now;
    const current = Math.max(now, Number(state.luckBoostUntil) || 0);
    state.luckBoostUntil = current + TREASURE_BOOST_MS;
    if (!opts.silent) {
      const left = formatTreasureClock(state.luckBoostUntil - now);
      const total = formatMult(treasureLuckMult());
      const eventNote = eventLuckActive()
        ? ` · event stacked → ${total}× luck (${formatTreasureClock(eventMsLeft())} left on event)`
        : "";
      setCatchLine(
        wasActive
          ? `Luck Chest · +5:00 chest time · ${total}× luck · ${left} left`
          : `Opened Luck Chest! ${TREASURE_LUCK_MULT}× luck for 5:00${eventNote}`,
        "treasure"
      );
      window.HubSound?.play?.("win");
      window.HubConfetti?.burst?.();
    }
    renderStats();
    saveSoon();
  }

  function storeTreasure(chest, opts = {}) {
    const item = chest?.kind ? chest : TREASURE_MONEY;
    const key = chestCountKey(item.kind);
    if (state[key] >= TREASURE_STASH_MAX) {
      if (!opts.silent) {
        setCatchLine(`${item.name} stash full (${TREASURE_STASH_MAX}) — use one first`, "miss");
        window.HubSound?.play?.("miss");
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
      window.HubSound?.play?.("win");
      window.HubConfetti?.burst?.();
    }
    renderTreasureStash();
    saveSoon();
    return true;
  }

  function useTreasure(kind) {
    const item = treasureByKind(kind);
    const key = chestCountKey(item.kind);
    if (state[key] <= 0) {
      setCatchLine(`No ${item.name}s stored`, "miss");
      window.HubSound?.play?.("miss");
      return;
    }
    ensureSession();
    state[key] -= 1;
    if (item.kind === "luck") activateLuckBoost();
    else activateMoneyBoost();
    renderTreasureStash();
    render(false);
    saveSoon();
  }

  function treasureUseLabel(chest) {
    if (chest.kind === "luck") {
      return `stored · Use for ${TREASURE_LUCK_MULT}× luck · 5:00`;
    }
    return `stored · Use for ${TREASURE_MULT}× sell · 5:00`;
  }

  function perfectBonus() {
    return ownedGear("perfect").reduce((s, g) => s + g.amount, 0);
  }

  function multiCatchChance() {
    return Math.min(0.92, ownedGear("multi").reduce((s, g) => s + g.amount, 0));
  }

  function tripleCatchChance() {
    return Math.min(0.75, ownedGear("triple").reduce((s, g) => s + g.amount, 0));
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
      next.catches = Math.max(0, Math.floor(Number(raw.catches) || 0));
      next.perfects = Math.max(0, Math.floor(Number(raw.perfects) || 0));
      next.bestCatchScore = Math.max(0, Math.floor(Number(raw.bestCatchScore) || 0));
      next.bestCatchId = typeof raw.bestCatchId === "string" ? raw.bestCatchId : "";
      if (!next.bestCatchScore) {
        next.bestCatchScore = getStoredBest();
      }
      if (!next.bestCatchId && next.bestCatchScore) {
        const match = FISH.find((f) => catchScore(f) === next.bestCatchScore);
        if (match) next.bestCatchId = match.id;
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
        if (!variant && !shiny) rec.base = true;
        if (variant && VARIANT_PRIMARY.includes(variant)) rec[variant] = true;
        if (shiny) rec.shiny = true;
        next.caught[id] = rec;
      });
      const now = Date.now();
      const moneyUntil = Math.max(
        0,
        Number(raw.moneyBoostUntil) || Number(raw.treasureBoostUntil) || 0
      );
      const luckUntil = Math.max(0, Number(raw.luckBoostUntil) || 0);
      next.moneyBoostUntil = moneyUntil > now ? moneyUntil : 0;
      next.luckBoostUntil = luckUntil > now ? luckUntil : 0;
      const legacyCount = Math.max(0, Math.floor(Number(raw.treasureCount) || 0));
      next.moneyChestCount = Math.max(
        0,
        Math.min(
          TREASURE_STASH_MAX,
          Math.floor(Number(raw.moneyChestCount) || legacyCount || 0)
        )
      );
      next.luckChestCount = Math.max(
        0,
        Math.min(TREASURE_STASH_MAX, Math.floor(Number(raw.luckChestCount) || 0))
      );
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

  function normalizeVariant(raw) {
    const v = String(raw || "").toLowerCase();
    return VARIANT_PRIMARY.includes(v) ? v : "";
  }

  function normalizeVariants(raw) {
    if (!raw || typeof raw !== "object") return { variant: "", shiny: false };
    return {
      variant: normalizeVariant(raw.variant),
      shiny: !!raw.shiny
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
    return shares;
  }

  /** Primary (silver/gold/diamond/rainbow) is exclusive; shiny can stack as a second tag. */
  function variantRollChances(spot = currentSpot(), forBoat = false) {
    const luck = effectiveLuckBonus(spot);
    // Rarer rolls: low base chance, slow luck scale, hard caps
    let primary = Math.min(0.1, (forBoat ? 0.008 : 0.014) + luck * 0.000035);
    let shiny = Math.min(0.04, (forBoat ? 0.0035 : 0.0065) + luck * 0.00002);
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
    return { variant, shiny: Math.random() < chances.shiny };
  }

  function variantValueMult(variantOrEntry, shinyFlag) {
    let variant = "";
    let shiny = false;
    if (variantOrEntry && typeof variantOrEntry === "object") {
      variant = normalizeVariant(variantOrEntry.variant);
      shiny = !!variantOrEntry.shiny;
    } else {
      variant = normalizeVariant(variantOrEntry);
      shiny = !!shinyFlag;
    }
    return (VARIANT_MULT[variant] || 1) * (shiny ? SHINY_MULT : 1);
  }

  function formatVariantTitle(entry) {
    const bits = [];
    const v = normalizeVariant(entry?.variant);
    if (v) bits.push(v.charAt(0).toUpperCase() + v.slice(1));
    if (entry?.shiny) bits.push("Shiny");
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
    return classes.join(" ");
  }

  function normalizeCoolerEntry(entry) {
    if (typeof entry === "string") {
      const id = String(entry);
      return fishById(id) ? { id, saved: false, perfect: false, variant: "", shiny: false } : null;
    }
    if (entry && typeof entry === "object") {
      const id = String(entry.id || "");
      if (!fishById(id)) return null;
      const variants = normalizeVariants(entry);
      return {
        id,
        saved: !!entry.saved,
        perfect: !!entry.perfect,
        variant: variants.variant,
        shiny: variants.shiny
      };
    }
    return null;
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
      state.lastTick = Date.now();
      localStorage.setItem(SAVE_KEY, JSON.stringify(state));
      const best = Math.max(getStoredBest(), Math.floor(state.bestCatchScore || 0));
      localStorage.setItem(HIGH_SCORE_KEY, String(best));
      const fish = fishById(state.bestCatchId);
      if (fish) {
        localStorage.setItem(
          BEST_CATCH_META_KEY,
          JSON.stringify({ id: fish.id, name: fish.name, rarity: fish.rarity, value: fish.value })
        );
      }
    } catch {}
  }

  function getStoredBest() {
    return Math.max(0, Math.floor(Number(localStorage.getItem(HIGH_SCORE_KEY)) || 0));
  }

  function catchScore(fish) {
    if (!fish) return 0;
    const rank = RARITY_RANK[fish.rarity] || 1;
    return rank * 100000 + Math.max(0, Math.floor(Number(fish.value) || 0));
  }

  function formatBestCatch(fishOrScore) {
    const fish =
      typeof fishOrScore === "object" && fishOrScore
        ? fishOrScore
        : fishById(state.bestCatchId) || FISH.find((f) => catchScore(f) === Number(fishOrScore));
    if (!fish) return "—";
    return `${fish.rarity} · ${fish.name}`;
  }

  function noteCatch(fish, entry) {
    if (!fish || isTreasureItem(fish)) return;
    const changed = markCaught(fish, entry);
    if (changed) checkAchievements();
    const score = catchScore(fish);
    if (score <= (state.bestCatchScore || 0)) return;
    state.bestCatchScore = score;
    state.bestCatchId = fish.id;
    try {
      localStorage.setItem(HIGH_SCORE_KEY, String(score));
    } catch {}
    maybeSubmitBest(true);
  }

  const BOOK_FILTERS = [
    { id: "any", label: "All" },
    { id: "base", label: "Normal" },
    { id: "silver", label: "Silver" },
    { id: "gold", label: "Gold" },
    { id: "diamond", label: "Diamond" },
    { id: "rainbow", label: "Rainbow" },
    { id: "shiny", label: "Shiny" }
  ];
  let bookFilter = "any";

  function blankCaughtRecord() {
    return {
      any: false,
      base: false,
      silver: false,
      gold: false,
      diamond: false,
      rainbow: false,
      shiny: false
    };
  }

  function normalizeCaughtRecord(raw) {
    const rec = blankCaughtRecord();
    if (raw === true || raw === 1) {
      rec.any = true;
      rec.base = true;
      return rec;
    }
    if (!raw || typeof raw !== "object") return rec;
    rec.any = !!raw.any || !!raw.base || !!raw.silver || !!raw.gold || !!raw.diamond || !!raw.rainbow || !!raw.shiny;
    rec.base = !!raw.base;
    rec.silver = !!raw.silver;
    rec.gold = !!raw.gold;
    rec.diamond = !!raw.diamond;
    rec.rainbow = !!raw.rainbow;
    rec.shiny = !!raw.shiny;
    if (!rec.any && (rec.base || rec.silver || rec.gold || rec.diamond || rec.rainbow || rec.shiny)) {
      rec.any = true;
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
    let changed = false;
    if (!rec.any) {
      rec.any = true;
      changed = true;
    }
    if (!variant && !shiny) {
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
    return changed;
  }

  function hasCaught(id, filter = bookFilter) {
    const raw = state.caught?.[id];
    if (!raw) return false;
    const rec = normalizeCaughtRecord(raw);
    if (filter === "any") return !!rec.any;
    return !!rec[filter];
  }

  function caughtCount(filter = bookFilter) {
    return FISH.reduce((n, f) => n + (hasCaught(f.id, filter) ? 1 : 0), 0);
  }

  function bookFilterLabel(filter = bookFilter) {
    return BOOK_FILTERS.find((f) => f.id === filter)?.label || "All";
  }

  function maybeSubmitBest(force = false) {
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
      HubLeaderboard.submit("fishing", best).catch?.(() => {});
    }
  }

  const SUFFIXES = ["", "K", "M", "B", "T", "Qa", "Qi", "Sx", "Sp", "Oc", "No", "Dc"];

  const FISH_SHAPE = {
    minnow: "slender",
    perch: "perch",
    bluegill: "panfish",
    sardine: "slender",
    smelt: "slender",
    carp: "carp",
    roach: "panfish",
    goby: "goby",
    trout: "trout",
    bass: "bass",
    catfish: "catfish",
    walleye: "pike",
    snapper: "snapper",
    mackerel: "mackerel",
    cod: "cod",
    flounder: "flat",
    salmon: "salmon",
    pike: "pike",
    mahi: "mahi",
    grouper: "grouper",
    barracuda: "barracuda",
    sturgeon: "sturgeon",
    eel: "eel",
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
    crystal: "pike",
    tidelord: "grouper",
    abyssking: "shark",
    starwhale: "whale",
    worldfin: "tuna",
    ghostfin: "ghost",
    nullfish: "ghost",
    eclipse: "eel",
    forgotten: "ghost",
    seraph: "ray",
    halo: "carp",
    oracle: "koi",
    choirfin: "tuna",
    timeless: "trout",
    foreverfin: "tuna",
    aeon: "shark",
    epochray: "ray",
    nebula: "jellyfish",
    quasar: "cod",
    omnifin: "tuna",
    pulsarpike: "pike",
    stardrift: "ray",
    aurorafin: "mahi",
    galaxykoi: "koi",
    cometcarp: "carp",
    eventide: "eel",
    horizon: "shark",
    collapse: "carp",
    riftray: "ray",
    primefin: "tuna",
    absoluth: "shark",
    theend: "omega",
    ultimafin: "omega",
    originkoi: "koi",
    dawnlevi: "leviathan",
    firstfin: "omega",
    sparkfin: "mahi",
    twinparadox: "bass",
    mirrorshark: "shark",
    loopeel: "eel",
    mobiusmarlin: "marlin",
    endlessray: "ray",
    boundcod: "cod",
    foreverend: "omega",
    perpetualpike: "pike",
    absolutefin: "tuna",
    finalabs: "leviathan",
    trueabs: "shark",
    theabsolute: "omega"
  };

  const FISH_TINT = {
    minnow: "#c5d0d6",
    perch: "#8fbc6b",
    bluegill: "#6db3c9",
    sardine: "#b8c4cc",
    smelt: "#a8b8c0",
    carp: "#d4a373",
    roach: "#c9a66b",
    goby: "#9aa88a",
    trout: "#7eb8a0",
    bass: "#6a9e6e",
    catfish: "#8a7f6e",
    walleye: "#c4b05a",
    snapper: "#e07860",
    mackerel: "#6a9aaa",
    cod: "#8fa0b0",
    flounder: "#c2a878",
    salmon: "#e0898a",
    pike: "#7a9a72",
    mahi: "#45c4a0",
    grouper: "#b08968",
    barracuda: "#8aa0a8",
    sturgeon: "#9a9080",
    eel: "#6d7a6a",
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
    theabsolute: "#ffffff"
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
      case "barracuda":
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
      case "marlin":
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
      case "tuna":
      case "mackerel":
      case "salmon":
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
      case "koi":
      case "carp":
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
      case "panfish":
      case "perch":
      case "bass":
      case "grouper":
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
      case "sturgeon":
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
      case "slender":
      case "goby":
        return `
          <path class="tail" d="M3 16 C7 10 11 9 14 13 L14 19 C11 23 7 22 3 16 Z"/>
          <path class="body shade" d="M14 16 C20 9 34 8 48 12 C54 14 56 17 54 19 C50 23 30 24 16 20 C13 18.5 12 17 14 16 Z"/>
          <path class="body" d="M14 16 C20 10 34 9 47 13 C53 15 55 17 53 18.5 C49 22 30 22.5 16 19.5 C13 18 12 17 14 16 Z"/>
          <path class="belly" d="M20 18.5 C32 22 46 21 52 17 C44 21 30 21.5 20 18.5 Z"/>
          <path class="fin" d="M32 11 C35 5 40 5 41 12 C37 10 34 10 32 11 Z"/>
          ${fishEye(50, 14, 1.6)}`;
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

  function fishGlyphHtml(fish, entry) {
    const id = typeof fish === "string" ? fish : fish?.id;
    const rarity = typeof fish === "string" ? fish : fish?.rarity;
    const shape = FISH_SHAPE[id] || "default";
    const variant = normalizeVariant(entry?.variant);
    const shiny = !!entry?.shiny;
    let tone = FISH_TINT[id] || rarityColor(rarity);
    if (variant === "silver") tone = "#c5ced6";
    else if (variant === "gold") tone = "#f0c14b";
    else if (variant === "diamond") tone = "#9adcf5";
    else if (variant === "rainbow") tone = "#ff8fab";
    const gid = `fg-${String(id || shape).replace(/[^a-z0-9]/gi, "")}${variant}${shiny ? "s" : ""}${Math.abs(
      Math.imul(
        [...`${id || shape}:${tone}:${variant}:${shiny}`].reduce(
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
    const extraClass = variantClassList(entry);
    return `<svg class="fish-glyph shape-${shape} is-realistic ${extraClass}" viewBox="0 0 64 32" aria-hidden="true" style="color:${tone}">
      <defs>
        <linearGradient id="${gid}-body" x1="0.15" y1="0" x2="0.2" y2="1">
          <stop offset="0%" stop-color="currentColor"/>
          <stop offset="55%" stop-color="currentColor" stop-opacity="0.92"/>
          <stop offset="100%" stop-color="#f7fbff" stop-opacity="0.55"/>
        </linearGradient>
        <linearGradient id="${gid}-shade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#041018" stop-opacity="0.35"/>
          <stop offset="100%" stop-color="currentColor" stop-opacity="0.2"/>
        </linearGradient>
        <linearGradient id="${gid}-belly" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#ffffff" stop-opacity="0.18"/>
          <stop offset="100%" stop-color="#ffffff" stop-opacity="0.55"/>
        </linearGradient>
        <linearGradient id="${gid}-fin" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="currentColor" stop-opacity="0.98"/>
          <stop offset="100%" stop-color="#031018" stop-opacity="0.35"/>
        </linearGradient>
      </defs>
      ${parts}
    </svg>`;
  }

  function pickBestCatchFish(entries) {
    const fishList = (Array.isArray(entries) ? entries : [entries])
      .map((e) => e?.fish || e)
      .filter((f) => f && !isTreasureItem(f));
    if (!fishList.length) return null;
    return fishList.reduce((best, f) => (catchScore(f) > catchScore(best) ? f : best));
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
      catchSilEl.innerHTML = `<span class="catch-sil-chest" aria-hidden="true">${
        fish?.kind === "luck" ? "◇" : "▣"
      }</span>`;
      catchSilEl.className = `catch-sil is-treasure rarity-${fish?.kind || "money"}`;
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
      absolute: "#f8f9fa"
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
          const kindClass = fish.kind === "luck" ? "treasure-luck" : "treasure-money";
          return `<div class="boat-haul-item treasure ${kindClass}">
          <span class="boat-haul-glyph treasure-glyph" aria-hidden="true">${
            fish.kind === "luck" ? "◇" : "▣"
          }</span>
          <span class="boat-haul-meta">
            <span class="boat-haul-name">${fish.name}</span>
            <span class="boat-haul-val">${detail}</span>
          </span>
          <span class="boat-haul-tag">${fish.kind === "luck" ? "luck" : "coin"}</span>
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

  function addCoins(amount) {
    if (amount <= 0) return;
    state.coins += amount;
    state.lifetime += amount;
    checkAchievements();
  }

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
    if (FISH.length > 0 && caughtCount("any") >= Math.ceil(FISH.length * 0.7)) {
      const newly = HubAchievements.unlock("fishing_all");
      window.HubPlays?.markMasterFisher?.().catch?.(() => {});
      if (newly) {
        setTimeout(() => {
          setCatchLine("70% catch book — title unlocked: MASTER FISHER", "perfect");
        }, 900);
      }
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
    const t = Math.max(0, Math.min(MAX_SPOT_RARITY, Number(spotRarity) || 0)) / MAX_SPOT_RARITY;
    if (rarity === "common") return 1.12 - t * 0.28;
    if (rarity === "uncommon") return 0.98 + t * 0.28;
    if (rarity === "rare") return 0.55 + t * 0.42;
    if (rarity === "epic") return 0.32 + t * 0.42;
    if (rarity === "legendary") return 0.18 + t * 0.42;
    if (rarity === "mythic") return 0.09 + t * 0.42;
    if (rarity === "secret") return 0.03 + t * 0.32;
    if (rarity === "divine") return 0.012 + t * 0.26;
    if (rarity === "eternal") return 0.005 + t * 0.2;
    if (rarity === "cosmic") return 0.002 + t * 0.15;
    if (rarity === "astral") return 0.0008 + t * 0.1;
    if (rarity === "singularity") return 0.0003 + t * 0.06;
    if (rarity === "omega") return 0.0001 + t * 0.035;
    if (rarity === "genesis") return 0.00004 + t * 0.02;
    if (rarity === "paradox") return 0.000015 + t * 0.012;
    if (rarity === "infinity") return 0.000006 + t * 0.007;
    if (rarity === "absolute") return 0.0000025 + t * 0.004;
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
    // Gear + spot luck (no event mult) — additive progression toward rares
    const luck = baseLuck(spot);
    const boostMult = treasureLuckMult();
    let w = (RARITY_WEIGHT[fish.rarity] || 10) * rarityFactor(fish.rarity, spot.rarity);
    if (fish.rarity === "uncommon") w += luck * 0.34;
    if (fish.rarity === "rare") w += luck * 0.38;
    if (fish.rarity === "epic") w += luck * 0.24;
    if (fish.rarity === "legendary") w += luck * 0.13;
    if (fish.rarity === "mythic") w += luck * 0.065;
    if (fish.rarity === "secret") w += luck * 0.022;
    if (fish.rarity === "divine") w += luck * 0.011;
    if (fish.rarity === "eternal") w += luck * 0.005;
    if (fish.rarity === "cosmic") w += luck * 0.002;
    if (fish.rarity === "astral") w += luck * 0.00085;
    if (fish.rarity === "singularity") w += luck * 0.00032;
    if (fish.rarity === "omega") w += luck * 0.00011;
    if (fish.rarity === "genesis") w += luck * 0.00004;
    if (fish.rarity === "paradox") w += luck * 0.000015;
    if (fish.rarity === "infinity") w += luck * 0.0000055;
    if (fish.rarity === "absolute") w += luck * 0.000002;
    // Spot still matters, but high rarities are less crushed on early waters
    const t = Math.max(0, Math.min(MAX_SPOT_RARITY, Number(spot.rarity) || 0)) / MAX_SPOT_RARITY;
    if (fish.rarity === "rare") w *= 0.9 + t * 0.12;
    if (fish.rarity === "epic" || fish.rarity === "legendary") w *= 0.72 + t * 0.32;
    if (fish.rarity === "mythic") w *= 0.52 + t * 0.42;
    if (fish.rarity === "secret") w *= (0.38 + t * 0.45) * (forBoat ? 0.55 : 1);
    if (fish.rarity === "divine") w *= (0.26 + t * 0.45) * (forBoat ? 0.45 : 1);
    if (fish.rarity === "eternal") w *= (0.18 + t * 0.45) * (forBoat ? 0.35 : 1);
    if (fish.rarity === "cosmic") w *= (0.12 + t * 0.42) * (forBoat ? 0.25 : 1);
    if (fish.rarity === "astral") w *= (0.08 + t * 0.38) * (forBoat ? 0.18 : 1);
    if (fish.rarity === "singularity") w *= (0.05 + t * 0.35) * (forBoat ? 0.12 : 1);
    if (fish.rarity === "omega") w *= (0.032 + t * 0.3) * (forBoat ? 0.08 : 1);
    if (fish.rarity === "genesis") w *= (0.022 + t * 0.26) * (forBoat ? 0.06 : 1);
    if (fish.rarity === "paradox") w *= (0.015 + t * 0.22) * (forBoat ? 0.04 : 1);
    if (fish.rarity === "infinity") w *= (0.01 + t * 0.18) * (forBoat ? 0.028 : 1);
    if (fish.rarity === "absolute") w *= (0.007 + t * 0.15) * (forBoat ? 0.018 : 1);
    w *= valueRarityScale(fish);
    // Chest/event luck mult skews weight toward rarer tiers (omega ≈ ×mult)
    // so 100× luck makes top fish ~100× more common instead of barely moving.
    if (boostMult > 1) {
      w *= Math.pow(boostMult, luckRaritySkew(fish.rarity));
    }
    // Tiny floor — old 0.01 floor forced all ultra-rares to identical odds
    return Math.max(1e-15, w);
  }

  function rollFish(spot, forBoat = false) {
    const pool = FISH;
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
    const total = FISH.reduce((s, f) => s + fishWeight(f, spot, false), 0);
    const w = fishWeight(fish, spot, false);
    return total > 0 ? (100 * w) / total : 0;
  }

  function fishValue(fish, spot, perfectOrEntry) {
    const base = Math.max(1, Math.floor(fish.value * (spot?.valueMult || 1)));
    const perfect =
      perfectOrEntry === true ||
      (perfectOrEntry && typeof perfectOrEntry === "object" && !!perfectOrEntry.perfect);
    const variantMult =
      perfectOrEntry && typeof perfectOrEntry === "object"
        ? variantValueMult(perfectOrEntry)
        : 1;
    const mult =
      (1 + sellBonus() + (perfect ? perfectBonus() : 0)) * treasureMoneyMult() * variantMult;
    return Math.max(1, Math.floor(base * mult));
  }

  function shouldAutoSell(rarity) {
    return !!state.autoSellRarities?.[rarity];
  }

  function anyAutoSellEnabled() {
    return RARITIES.some((r) => shouldAutoSell(r));
  }

  /** @returns {object|null} cooler entry (even if auto-sold), or null if cooler full */
  function addToCooler(fish, opts = {}) {
    if (!fish) return null;
    const variants = normalizeVariants(opts.variants || rollFishVariants(currentSpot(), !!opts.forBoat));
    const entry = {
      id: fish.id,
      saved: false,
      perfect: !!opts.perfect,
      variant: variants.variant,
      shiny: variants.shiny
    };
    noteCatch(fish, entry);
    if (opts.forceSell || shouldAutoSell(fish.rarity)) {
      const val = fishValue(fish, currentSpot(), entry);
      addCoins(val);
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
        setCatchLine("Cooler full — sell or auto-sell this rarity", "miss");
      }
      window.HubSound?.play?.("miss");
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
      "treasure"
    );
    if (cls) catchLineEl.classList.add(cls);
  }

  function isShowcaseRarity(rarity) {
    return (RARITY_RANK[rarity] || 0) >= RARITY_RANK.legendary;
  }

  function catchTone(rarity) {
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
      window.HubSound?.play?.("miss");
      return;
    }
    ensureSession();
    clearTimers();
    const spot = currentSpot();
    const [lo, hi] = spot.wait;
    const waitMs = (lo + Math.random() * (hi - lo)) * 1000 * waitScale();
    setPhase("waiting");
    flashCastSplash();
    setCatchLine("Line is out… tap again to cancel");
    window.HubSound?.play?.("flap");
    waitTimer = setTimeout(() => openBite(), waitMs);
    saveSoon();
  }

  function cancelCast() {
    if (phase !== "waiting") return;
    clearTimers();
    setPhase("ready");
    hideCatchCard("Cast to catch a fish");
    setCatchLine("Line reeled in");
    window.HubSound?.play?.("miss");
  }

  function openBite() {
    if (phase !== "waiting") return;
    const windowSec = biteWindow();
    biteEndsAt = performance.now() + windowSec * 1000;
    setPhase("bite");
    setCatchLine("Bite! Tap Reel now!", "");
    window.HubSound?.play?.("click");
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
    setPhase("result");
    castBtn.classList.add("is-miss");
    hideCatchCard("It got away…");
    setCatchLine("It got away…", "miss");
    window.HubSound?.play?.("miss");
    setTimeout(() => {
      setPhase("ready");
      hideCatchCard("Cast to catch a fish");
      setCatchLine("Ready to cast");
      render(false);
    }, 850);
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

    const chest = rollTreasure(spot, false);
    if (chest) {
      state.catches += 1;
      if (perfect) state.perfects += 1;
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
      }, 1600);
      return;
    }

    const fish = rollFish(spot, false);
    state.catches += 1;
    if (perfect) state.perfects += 1;

    const entry = addToCooler(fish, { perfect });
    let bonusFish = null;
    let bonusEntry = null;
    let thirdFish = null;
    let thirdEntry = null;
    if (entry && Math.random() < multiCatchChance()) {
      bonusFish = rollFish(spot, false);
      state.catches += 1;
      bonusEntry = addToCooler(bonusFish);
      if (!bonusEntry) bonusFish = null;
    }
    if (entry && bonusFish && Math.random() < tripleCatchChance()) {
      thirdFish = rollFish(spot, false);
      state.catches += 1;
      thirdEntry = addToCooler(thirdFish);
      if (!thirdEntry) thirdFish = null;
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
      const showcase = pickBestCatchFish(haul) || fish;
      const showcaseEntry =
        haul.find((h) => h.fish === showcase)?.entry || entry;
      castBtn.classList.add("is-catch", `rarity-${showcase.rarity}`);
      showCatchSilhouette(showcase, showcaseEntry);
      showCatchCard(haul);
      const tip = perfect ? "Perfect reel! " : "";
      const extras = [bonusFish, thirdFish].filter(Boolean).map((f, i) => {
        const e = i === 0 ? bonusEntry : thirdEntry;
        return formatFishName(f, e);
      });
      const bonusTip = extras.length ? ` + ${extras.join(" + ")}` : "";
      setCatchLine(
        `${tip}Caught ${formatFishName(fish, entry)} (${fish.rarity})${bonusTip}`,
        catchTone(showcase.rarity)
      );
      window.HubSound?.play?.(
        perfect ||
          isShowcaseRarity(fish.rarity) ||
          (bonusFish && isShowcaseRarity(bonusFish.rarity)) ||
          (thirdFish && isShowcaseRarity(thirdFish.rarity))
          ? "win"
          : "click"
      );
      if (
        isShowcaseRarity(fish.rarity) ||
        (bonusFish && isShowcaseRarity(bonusFish.rarity)) ||
        (thirdFish && isShowcaseRarity(thirdFish.rarity))
      ) {
        window.HubConfetti?.burst?.();
      }
      const rect = castBtn.getBoundingClientRect();
      const extrasN = [bonusFish, thirdFish].filter(Boolean).length;
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
    }, 1400);
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
      window.HubSound?.play?.("miss");
      return;
    }
    const val = fishValue(fish, currentSpot(), entry);
    state.cooler.splice(i, 1);
    addCoins(val);
    setCatchLine(
      `Sold ${formatFishName(fish, entry)} for ${formatNum(val)}`,
      catchTone(fish.rarity)
    );
    window.HubSound?.play?.("click");
    render(false);
    saveSoon();
  }

  function toggleSaveFish(index) {
    const i = Math.floor(Number(index));
    if (!Number.isFinite(i) || i < 0 || i >= state.cooler.length) return;
    ensureSession();
    const entry = state.cooler[i];
    if (!entry || !fishById(coolerEntryId(entry))) return;
    entry.saved = !entry.saved;
    const fish = fishById(entry.id);
    const label = formatFishName(fish, entry);
    setCatchLine(
      entry.saved ? `Saved ${label} — won't sell until unpinned` : `Unsaved ${label}`
    );
    window.HubSound?.play?.("click");
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
      if (fish) total += fishValue(fish, spot, entry);
    });
    state.cooler = kept;
    addCoins(total);
    setCatchLine(
      kept.length
        ? `Sold catch for ${formatNum(total)} · ${kept.length} saved kept`
        : `Sold catch for ${formatNum(total)} coins`
    );
    window.HubSound?.play?.("win");
    render(false);
    saveSoon();
  }

  function buyGear(id) {
    if (id === "boat") {
      buyBoatUpgrade();
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
    window.HubSound?.play?.("click");
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
    window.HubSound?.play?.("click");
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
    window.HubSound?.play?.("click");
    window.HubConfetti?.burst?.();
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
    window.HubSound?.play?.("win");
    window.HubConfetti?.burst?.();
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
          const kindClass = fish.kind === "luck" ? "treasure-luck" : "treasure-money";
          return `<div class="boat-haul-item treasure ${kindClass}">
          <span class="boat-haul-glyph treasure-glyph" aria-hidden="true">${
            fish.kind === "luck" ? "◇" : "▣"
          }</span>
          <span class="boat-haul-meta">
            <span class="boat-haul-name">${fish.name}</span>
            <span class="boat-haul-val">${detail}</span>
          </span>
          <span class="boat-haul-tag">${fish.kind === "luck" ? "luck" : "coin"}</span>
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
      window.HubSound?.play?.(stored ? "win" : "miss");
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
      const sold = shouldAutoSell(fish.rarity);
      const val = fishValue(fish, spot, variants);
      if (sold || state.cooler.length < coolerMax()) {
        addToCooler(fish, { silent: true, forBoat: true, variants });
        state.catches += 1;
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
    window.HubSound?.play?.(kept.length ? "click" : "miss");
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
    const spot = currentSpot();
    list.forEach((boat) => {
      const cycles = Math.floor(elapsed / 1000 / boat.amount);
      for (let i = 0; i < Math.min(cycles, 400); i += 1) {
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
          const val = fishValue(fish, spot, variants);
          if (shouldAutoSell(fish.rarity)) {
            gained += val;
          } else if (state.cooler.length < coolerMax()) {
            state.cooler.push({
              id: fish.id,
              saved: false,
              variant: variants.variant,
              shiny: variants.shiny
            });
          } else {
            gained += val;
          }
        }
      }
    });
    if (gained > 0) addCoins(gained);
    if (gained > 0 || chestsFound > 0 || state.cooler.length) {
      const bits = [];
      if (gained > 0) bits.push(`earned ${formatNum(gained)} coins`);
      if (chestsFound > 0) {
        bits.push(
          chestsFound === 1 ? "found 1 chest" : `found ${chestsFound} chests`
        );
      }
      if (!bits.length) bits.push("filled part of your cooler");
      setCatchLine(`While away your boat ${bits.join(" · ")}`);
    }
    state.lastTick = now;
  }

  let coolerRenderKey = "";

  function coolerKey() {
    return `${state.spotId}|${state.cooler
      .map((e) => {
        const n = normalizeCoolerEntry(e) || {};
        return `${n.id || coolerEntryId(e)}${n.saved ? "*" : ""}${n.perfect ? "!" : ""}:${n.variant || ""}:${n.shiny ? 1 : 0}`;
      })
      .join(",")}|${coolerMax()}|${sellBonus().toFixed(3)}|${perfectBonus().toFixed(3)}`;
  }

  function renderCooler(force = false) {
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
    if (!coolerList) return;
    const nextKey = coolerKey();
    if (!force && nextKey === coolerRenderKey) return;
    coolerRenderKey = nextKey;
    const spot = currentSpot();
    coolerList.innerHTML = state.cooler
      .map((entry, index) => {
        const fish = fishById(coolerEntryId(entry));
        if (!fish) return "";
        const val = fishValue(fish, spot, entry);
        const saved = isCoolerSaved(entry);
        const label = formatFishName(fish, entry);
        const vTitle = formatVariantTitle(entry);
        const perfectMark = isCoolerPerfect(entry) ? " · perfect" : "";
        const vMult = variantValueMult(entry);
        const multTip = vMult > 1 ? ` · ×${formatMult(vMult)}` : "";
        return `<div class="fish-chip ${fish.rarity}${saved ? " is-saved" : ""}${
          isCoolerPerfect(entry) ? " is-perfect" : ""
        } ${variantClassList(entry)}" data-cooler-index="${index}">
          <span class="fish-chip-glyph" aria-hidden="true">${fishGlyphHtml(fish, entry)}</span>
          <button type="button" class="fish-chip-save" data-save-index="${index}" title="${
            saved ? "Unsave fish" : "Save fish (won't sell)"
          }" aria-label="${saved ? "Unsave" : "Save"} ${label}" aria-pressed="${saved}">${
            saved ? "★" : "☆"
          }</button>
          <button type="button" class="fish-chip-sell" data-sell-index="${index}" title="${
            saved
              ? "Saved — unpin to sell"
              : `Sell for ${formatNum(val)}${perfectMark}${multTip}${vTitle ? ` · ${vTitle}` : ""}`
          }" ${saved ? "disabled" : ""}>
            <span class="fish-chip-name">${label}</span>
            <span class="fish-chip-price">${formatNum(val)}</span>
          </button>
        </div>`;
      })
      .join("");
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
          <p class="spot-item-desc">${unlocked ? `${spot.blurb} · sell ×${spot.valueMult}` : "Locked spot"}</p>
        </div>
        ${action}
      </div>`;
    }).join("");
  }

  function renderShop() {
    if (!shopList) return;

    function gearRow(item) {
      const owned = !!state.owned[item.id];
      const exclusive = item.kind === "speed";
      const equipped = exclusive && state.equippedSpeed === item.id;
      let status = owned ? "Owned" : "Not owned";
      if (exclusive && owned) status = equipped ? "Equipped" : "Owned · tap Equip";
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
      return `<div class="shop-item ${equipped ? "is-equipped" : ""}" role="listitem" data-shop-kind="${item.kind}">
        <div class="shop-item-main">
          <div class="shop-item-name">${item.name}</div>
          <p class="shop-item-desc">${item.desc}</p>
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

    const cats = SHOP_CATEGORIES.filter((c) => active === "all" || c.id === active);
    shopList.innerHTML = cats
      .map((cat) => {
        const rows =
          cat.id === "boat"
            ? boatRow()
            : GEAR.filter((g) => g.kind === cat.id).map(gearRow).join("");
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

  function applySpotTheme() {
    const id = currentSpot()?.id || "creek";
    document.body.dataset.spot = id;
    if (castBtn) castBtn.dataset.spot = id;
    const mood = document.getElementById("spot-mood");
    if (mood) mood.textContent = currentSpot()?.name || "Creek";
  }

  function renderStats() {
    const spot = currentSpot();
    const bestFish = fishById(state.bestCatchId) || FISH.find((f) => catchScore(f) === state.bestCatchScore);
    const bestLabel = bestFish ? formatBestCatch(bestFish) : "—";
    const bait = equippedSpeedGear();
    const waitCut = bait ? Math.round(bait.amount * 100) : 0;
    const moneyLeft = moneyMsLeft();
    const luckLeft = luckMsLeft();
    const eventLeft = eventMsLeft();
    const eventKind = currentEventKind();
    const eventLive = eventIsLive();
    const moneyOn = moneyBoostActive() || eventMoneyActive();
    const luckOn = luckBoostActive() || eventLuckActive();
    if (moneyLeft <= 0 && state.moneyBoostUntil) state.moneyBoostUntil = 0;
    if (luckLeft <= 0 && state.luckBoostUntil) state.luckBoostUntil = 0;
    maybeAnnounceEvent();
    document.body.classList.toggle("treasure-boost", moneyOn || luckOn);
    document.body.classList.toggle("treasure-money-boost", moneyOn);
    document.body.classList.toggle("treasure-luck-boost", luckOn);
    document.body.classList.toggle("event-money", eventMoneyActive());
    document.body.classList.toggle("event-luck", eventLuckActive());
    document.body.classList.toggle("event-variant", !!adminVariantEventLive());
    document.body.classList.toggle("event-idle", !eventLive && !adminVariantEventLive());
    applySpotTheme();
    if (coinCountEl) coinCountEl.textContent = formatNum(state.coins);
    if (spotLabelEl) spotLabelEl.textContent = spot.name;
    if (hudSpotEl) hudSpotEl.textContent = spot.name;
    if (windowLabelEl) windowLabelEl.textContent = `${biteWindow().toFixed(2)}s`;
    if (waitLabelEl) waitLabelEl.textContent = waitCut ? `−${waitCut}%` : "—";
    if (luckLabelEl) {
      const luck = totalLuckBonus();
      luckLabelEl.textContent = luck > 0 ? `+${formatNum(luck)}` : String(Math.round(luck) || 0);
    }
    if (sellLabelEl) sellLabelEl.textContent = formatPctBonus(totalSellFactor() - 1);
    if (eventChipEl) {
      const variant = adminVariantEventLive();
      const previewKind = eventLive ? eventKind : eventKindForStart(nextHalfHourStart());
      eventChipEl.classList.toggle("event-money", eventLive && previewKind === "money");
      eventChipEl.classList.toggle("event-luck", eventLive && previewKind === "luck");
      eventChipEl.classList.toggle("event-variant", !!variant);
      eventChipEl.classList.toggle("event-idle", !eventLive && !variant);
    }
    if (eventLabelEl) {
      const variant = adminVariantEventLive();
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
      if (variant) {
        parts.push(
          `Admin ${formatMult(variant.mult)}× ${formatAdminVariantLabel(
            variant.target
          )} · ${formatTreasureClock(Math.max(0, variant.until - Date.now()))}`
        );
      }
      if (parts.length) {
        eventLabelEl.textContent = `${parts.join(" · ")} left`;
      } else {
        const nextStart = nextHalfHourStart();
        const nextKind = eventKindForStart(nextStart);
        const afterKind = eventKindForStart(nextStart + EVENT_MS);
        eventLabelEl.textContent = `Next ${
          nextKind === "luck" ? "2× luck" : "2× sell"
        } in ${formatTreasureClock(msUntilNextEvent())} · then ${
          afterKind === "luck" ? "2× luck" : "2× sell"
        }`;
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
        if (moneyBoostActive()) bits.push(`chest ${formatTreasureClock(moneyLeft)}`);
        if (eventMoneyActive()) bits.push(`event ${formatTreasureClock(eventLeft)} left`);
        moneyLabelEl.textContent = bits.join(" · ");
      }
    }
    if (luckChipEl) luckChipEl.classList.toggle("hidden", !luckOn);
    if (luckBoostLabelEl) {
      if (!luckOn) luckBoostLabelEl.textContent = "—";
      else {
        const bits = [`${formatMult(treasureLuckMult())}×`];
        if (luckBoostActive()) bits.push(`chest ${formatTreasureClock(luckLeft)}`);
        if (eventLuckActive()) bits.push(`event ${formatTreasureClock(eventLeft)} left`);
        luckBoostLabelEl.textContent = bits.join(" · ");
      }
    }
    if (multiLabelEl) multiLabelEl.textContent = formatPctBonus(multiCatchChance(), false);
    if (tripleLabelEl) tripleLabelEl.textContent = formatPctBonus(tripleCatchChance(), false);
    if (perfectLabelEl) perfectLabelEl.textContent = formatPctBonus(perfectBonus());
    if (coolerStatLabelEl) coolerStatLabelEl.textContent = String(coolerMax());
    if (hudBestEl) hudBestEl.textContent = bestLabel;
    if (overlayBestEl) overlayBestEl.textContent = bestLabel;
    renderTreasureStash();
    renderBoatTimers();
  }

  function renderTreasureStash() {
    const money = Math.max(0, Math.floor(Number(state.moneyChestCount) || 0));
    const luck = Math.max(0, Math.floor(Number(state.luckChestCount) || 0));
    if (moneyCountEl) moneyCountEl.textContent = String(money);
    if (luckCountEl) luckCountEl.textContent = String(luck);
    if (moneyUseBtn) {
      moneyUseBtn.disabled = money <= 0;
      moneyUseBtn.textContent = moneyBoostActive() ? "Extend" : "Use";
    }
    if (luckUseBtn) {
      luckUseBtn.disabled = luck <= 0;
      luckUseBtn.textContent = luckBoostActive() ? "Extend" : "Use";
    }
    if (treasureStashEl) {
      treasureStashEl.classList.toggle("is-empty", money <= 0 && luck <= 0);
      treasureStashEl.classList.toggle("is-active", moneyBoostActive() || luckBoostActive());
    }
  }

  function render(full = true) {
    renderStats();
    renderCooler();
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
    tickBoats(TICK_MS / 1000);
    // Only rebuild cooler chips when contents change (constant rebuilds broke sell clicks)
    renderCooler(coolerKey() !== before);
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
      const base = baseLuck(spot);
      const effLuck = effectiveLuckBonus(spot);
      if (luckM > 1 || eventLuckActive() || luckBoostActive()) {
        bits.push(
          `Luck ${formatMult(luckM)}× on gear+spot +${formatNum(base)} → HUD +${formatNum(
            effLuck
          )} · top fish odds ~×${formatMult(luckM)} (odds below)`
        );
      } else {
        bits.push(`Luck base gear+spot +${formatNum(base)} (odds below)`);
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
          note: "primary",
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
    const chestP = treasureAnyChance(spot, false);
    const kindP = treasureKindChance(spot, false);
    const fishShare = Math.max(0, 1 - chestP);
    // Precompute once so weights/luck match the live cast odds
    const weights = FISH.map((f) => fishWeight(f, spot, false));
    const total = weights.reduce((a, b) => a + b, 0);
    const rows = FISH.map((fish, i) => ({
      fish,
      pct: total > 0 ? (100 * fishShare * weights[i]) / total : 0
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
      <td class="guide-here">${effect}</td>
      <td class="guide-spots" title="${kindPct.toFixed(8)}%">${formatChance(kindPct)}</td>
    </tr>`;
    }).join("");
    guideBody.innerHTML =
      treasureRows +
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

  function renderBook() {
    const total = FISH.length;
    const found = caughtCount(bookFilter);
    const pct = total > 0 ? Math.floor((found / total) * 100) : 0;
    if (bookProgressEl) {
      bookProgressEl.textContent = `${found} / ${total} (${pct}%) · ${bookFilterLabel(bookFilter)}`;
    }
    if (bookFiltersEl) {
      bookFiltersEl.innerHTML = BOOK_FILTERS.map(
        (f) =>
          `<button type="button" class="book-filter-btn${
            bookFilter === f.id ? " is-active" : ""
          }${f.id !== "any" && f.id !== "base" ? ` variant-${f.id}` : ""}" data-book-filter="${
            f.id
          }" role="tab" aria-selected="${bookFilter === f.id}">${f.label}</button>`
      ).join("");
    }
    if (!bookBody) return;
    const byRarity = {};
    RARITIES.forEach((r) => {
      byRarity[r] = [];
    });
    FISH.forEach((fish) => {
      if (!byRarity[fish.rarity]) byRarity[fish.rarity] = [];
      byRarity[fish.rarity].push(fish);
    });
    const showEntry =
      bookFilter === "any" || bookFilter === "base"
        ? null
        : bookFilter === "shiny"
          ? { shiny: true }
          : { variant: bookFilter };
    bookBody.innerHTML = RARITIES.map((rarity) => {
      const list = byRarity[rarity] || [];
      if (!list.length) return "";
      const got = list.filter((f) => hasCaught(f.id, bookFilter)).length;
      const cards = list
        .map((fish) => {
          const known = hasCaught(fish.id, bookFilter);
          if (known) {
            const label = showEntry ? formatFishName(fish, showEntry) : fish.name;
            return `<div class="book-card is-caught rarity-${fish.rarity}${
              showEntry ? ` ${variantClassList(showEntry)}` : ""
            }" title="${label} · ${fish.rarity} · ${formatNum(fish.value)} coins">
              <span class="book-card-glyph" aria-hidden="true">${fishGlyphHtml(fish, showEntry)}</span>
              <span class="book-card-name">${label}</span>
              <span class="book-card-meta">${fish.rarity} · ${formatNum(fish.value)}</span>
            </div>`;
          }
          return `<div class="book-card is-unknown rarity-${fish.rarity}" title="Not caught yet · ${bookFilterLabel(
            bookFilter
          )}">
              <span class="book-card-glyph book-card-sil" aria-hidden="true">${fishGlyphHtml(
                fish
              )}</span>
              <span class="book-card-name">???</span>
              <span class="book-card-meta">${fish.rarity}</span>
            </div>`;
        })
        .join("");
      return `<section class="book-section">
        <h3 class="book-section-title rarity-${rarity}">${rarity} <span>${got}/${list.length}</span></h3>
        <div class="book-grid">${cards}</div>
      </section>`;
    }).join("");
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

  function openBook() {
    renderBook();
    bookOverlay?.classList.remove("hidden");
    lockPageScroll();
    const root = bookOverlay?.querySelector(".guide-card");
    if (root) root.scrollTop = 0;
  }

  function closeBook() {
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
  moneyUseBtn?.addEventListener("click", () => useTreasure("money"));
  luckUseBtn?.addEventListener("click", () => useTreasure("luck"));
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
  shopCats?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-shop-cat]");
    if (!btn) return;
    shopCat = btn.dataset.shopCat || "all";
    renderShop();
  });
  shopList?.addEventListener("pointerdown", (e) => {
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
  document.getElementById("admin-cmd-form")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const input = document.getElementById("admin-cmd-input");
    const raw = input?.value || "";
    if (input) input.value = "";
    runAdminCommand(raw);
  });
  guideBtn?.addEventListener("click", openGuide);
  bookBtn?.addEventListener("click", openBook);
  bookFiltersEl?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-book-filter]");
    if (!btn || !bookFiltersEl.contains(btn)) return;
    const next = btn.getAttribute("data-book-filter");
    if (!next || !BOOK_FILTERS.some((f) => f.id === next) || next === bookFilter) return;
    bookFilter = next;
    renderBook();
  });
  menuGuideBtn?.addEventListener("click", () => {
    closeMenu();
    openGuide();
  });
  menuBookBtn?.addEventListener("click", () => {
    closeMenu();
    openBook();
  });
  guideClose?.addEventListener("click", closeGuide);
  bookClose?.addEventListener("click", closeBook);
  guideOverlay?.addEventListener("click", (e) => {
    if (e.target === guideOverlay) closeGuide();
  });
  bookOverlay?.addEventListener("click", (e) => {
    if (e.target === bookOverlay) closeBook();
  });
  bookOverlay?.addEventListener(
    "wheel",
    (e) => {
      const card = bookOverlay.querySelector(".guide-card");
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
    if (adminOverlay && !adminOverlay.classList.contains("hidden")) {
      e.preventDefault();
      closeAdmin();
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
    return FISH.find((f) => catchScore(f) === n) || null;
  }

  function applyBestCatchScore(score, fishId) {
    const n = Math.floor(Number(score) || 0);
    if (n <= 0) return false;
    if (n < (state.bestCatchScore || 0)) return false;
    const fish = fishById(fishId) || fishFromCatchScore(n);
    if (!fish && n <= (state.bestCatchScore || 0)) return false;
    state.bestCatchScore = Math.max(state.bestCatchScore || 0, n);
    if (fish) {
      state.bestCatchId = fish.id;
      markCaught(fish);
    } else if (!state.bestCatchId) {
      const match = fishFromCatchScore(state.bestCatchScore);
      if (match) {
        state.bestCatchId = match.id;
        markCaught(match);
      }
    }
    try {
      localStorage.setItem(HIGH_SCORE_KEY, String(state.bestCatchScore));
      const bestFish = fishById(state.bestCatchId);
      if (bestFish) {
        localStorage.setItem(
          BEST_CATCH_META_KEY,
          JSON.stringify({
            id: bestFish.id,
            name: bestFish.name,
            rarity: bestFish.rarity,
            value: bestFish.value
          })
        );
      }
    } catch {}
    return true;
  }

  function syncBestCatchFromLeaderboard() {
    let boardScore = 0;
    try {
      if (window.HubLeaderboard?.getMyScore) {
        boardScore = Math.floor(Number(HubLeaderboard.getMyScore("fishing")) || 0);
      }
    } catch {}
    const stored = getStoredBest();
    const best = Math.max(state.bestCatchScore || 0, stored, boardScore);

    if (best > (state.bestCatchScore || 0) || (best > 0 && !state.bestCatchId)) {
      applyBestCatchScore(best, state.bestCatchId);
      renderStats();
    }
  }

  state = loadState();
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
  } catch {}
  applyOffline();
  setPhase("ready");
  syncBestCatchFromLeaderboard();
  render();
  checkAchievements();
  startAdminEventPolling();
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
  });
})();
