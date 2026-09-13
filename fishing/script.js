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
  const ADMIN_EVENT_LOCAL_KEY = "fishing-admin-override-v1";
  const ADMIN_EVENT_PENDING_KEY = "fishing-admin-pending-v1";
  const ADMIN_SCOPE_KEY = "fishing-admin-scope-v1";
  const ADMIN_RATE_BACKOFF_MS = 45_000;
  const ADMIN_DEFAULT_MINUTES = 5;
  const ADMIN_DEFAULT_MULT = 2;
  const ADMIN_MAX_MINUTES = 180;
  const ADMIN_MIN_MULT = 1.5;
  const ADMIN_MAX_MULT = 100;
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
    "omega"
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
    omega: 13
  };

  const RARITY_WEIGHT = {
    common: 30,
    uncommon: 24,
    rare: 16,
    epic: 8.5,
    legendary: 3.5,
    mythic: 1.1,
    secret: 0.22,
    divine: 0.075,
    eternal: 0.028,
    cosmic: 0.009,
    astral: 0.003,
    singularity: 0.001,
    omega: 0.0003
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
    // Eternal
    { id: "timeless", name: "Timeless Trout", rarity: "eternal", value: 1500000 },
    { id: "foreverfin", name: "Foreverfin", rarity: "eternal", value: 2800000 },
    { id: "aeon", name: "Aeon Shark", rarity: "eternal", value: 4500000 },
    // Cosmic
    { id: "nebula", name: "Nebula Nettle", rarity: "cosmic", value: 12000000 },
    { id: "quasar", name: "Quasar Cod", rarity: "cosmic", value: 25000000 },
    { id: "omnifin", name: "Omnifin", rarity: "cosmic", value: 50000000 },
    // Astral
    { id: "stardrift", name: "Stardrift Ray", rarity: "astral", value: 120000000 },
    { id: "aurorafin", name: "Aurora Fin", rarity: "astral", value: 250000000 },
    { id: "galaxykoi", name: "Galaxy Koi", rarity: "astral", value: 500000000 },
    // Singularity
    { id: "eventide", name: "Eventide Eel", rarity: "singularity", value: 1200000000 },
    { id: "horizon", name: "Horizon Shark", rarity: "singularity", value: 2500000000 },
    { id: "collapse", name: "Collapse Carp", rarity: "singularity", value: 5000000000 },
    // Omega
    { id: "primefin", name: "Primefin", rarity: "omega", value: 15000000000 },
    { id: "absoluth", name: "Absoluth", rarity: "omega", value: 40000000000 },
    { id: "theend", name: "The End Fish", rarity: "omega", value: 100000000000 }
  ];

  const SPOTS = [
    {
      id: "creek",
      name: "Creek",
      cost: 0,
      wait: [1.4, 2.8],
      valueMult: 0.7,
      rarity: 0,
      blurb: "All fish · commons dominate · low pay"
    },
    {
      id: "pond",
      name: "Pond",
      cost: 120,
      wait: [1.3, 2.6],
      valueMult: 0.9,
      rarity: 1,
      blurb: "All fish · slightly better odds"
    },
    {
      id: "marsh",
      name: "Marsh",
      cost: 400,
      wait: [1.25, 2.5],
      valueMult: 1.0,
      rarity: 2,
      blurb: "Murky water · a bit more uncommon"
    },
    {
      id: "river",
      name: "River",
      cost: 800,
      wait: [1.2, 2.4],
      valueMult: 1.15,
      rarity: 3,
      blurb: "All fish · uncommon/rare more often"
    },
    {
      id: "falls",
      name: "Waterfall",
      cost: 2200,
      wait: [1.15, 2.3],
      valueMult: 1.3,
      rarity: 4,
      blurb: "Fast current · rares start showing"
    },
    {
      id: "lake",
      name: "Lake",
      cost: 4500,
      wait: [1.1, 2.2],
      valueMult: 1.45,
      rarity: 5,
      blurb: "All fish · solid rare/epic odds"
    },
    {
      id: "reef",
      name: "Coral Reef",
      cost: 12000,
      wait: [1.05, 2.1],
      valueMult: 1.7,
      rarity: 6,
      blurb: "Bright waters · epics more likely"
    },
    {
      id: "harbor",
      name: "Harbor",
      cost: 25000,
      wait: [1.0, 2.0],
      valueMult: 1.9,
      rarity: 7,
      blurb: "All fish · top rarities slightly less rare"
    },
    {
      id: "glacier",
      name: "Glacier Bay",
      cost: 70000,
      wait: [0.95, 1.9],
      valueMult: 2.2,
      rarity: 8,
      blurb: "Icy depth · legendaries thaw more often"
    },
    {
      id: "deep",
      name: "Deep Sea",
      cost: 150000,
      wait: [0.9, 1.8],
      valueMult: 2.6,
      rarity: 9,
      blurb: "All fish · strong mythic odds"
    },
    {
      id: "trench",
      name: "Abyssal Trench",
      cost: 400000,
      wait: [0.85, 1.7],
      valueMult: 3.1,
      rarity: 10,
      blurb: "Crushing dark · mythics & secrets stir"
    },
    {
      id: "rift",
      name: "Tide Rift",
      cost: 1200000,
      wait: [0.8, 1.55],
      valueMult: 3.7,
      rarity: 11,
      blurb: "Warped tides · secrets less impossible"
    },
    {
      id: "void",
      name: "Void Lagoon",
      cost: 4000000,
      wait: [0.75, 1.4],
      valueMult: 4.5,
      rarity: 12,
      blurb: "Secrets stir · divine just possible"
    },
    {
      id: "celestial",
      name: "Celestial Pier",
      cost: 15000000,
      wait: [0.7, 1.3],
      valueMult: 5.5,
      rarity: 13,
      blurb: "Holy waters · divine & eternal odds"
    },
    {
      id: "aeonbasin",
      name: "Aeon Basin",
      cost: 50000000,
      wait: [0.65, 1.2],
      valueMult: 7,
      rarity: 14,
      blurb: "Time thins · eternals swim here"
    },
    {
      id: "cosmos",
      name: "Cosmic Rift",
      cost: 200000000,
      wait: [0.6, 1.1],
      valueMult: 9,
      rarity: 15,
      blurb: "Edge of everything · cosmic possible"
    },
    {
      id: "astralshoals",
      name: "Astral Shoals",
      cost: 800000000,
      wait: [0.55, 1.05],
      valueMult: 12,
      rarity: 16,
      blurb: "Starlit shallows · astral fish appear"
    },
    {
      id: "eventhorizon",
      name: "Event Horizon",
      cost: 4000000000,
      wait: [0.5, 1.0],
      valueMult: 16,
      rarity: 17,
      blurb: "Light bends · singularity catches stir"
    },
    {
      id: "omegadeep",
      name: "Omega Deep",
      cost: 20000000000,
      wait: [0.45, 0.95],
      valueMult: 22,
      rarity: 18,
      blurb: "Bright abyss · omega possible"
    },
    {
      id: "prismreef",
      name: "Prism Reef",
      cost: 80000000000,
      wait: [0.42, 0.9],
      valueMult: 28,
      rarity: 19,
      blurb: "Fractured light · omega more often"
    },
    {
      id: "chronowell",
      name: "Chrono Well",
      cost: 350000000000,
      wait: [0.4, 0.85],
      valueMult: 36,
      rarity: 20,
      blurb: "Time pools · rarest fish linger"
    },
    {
      id: "mythforge",
      name: "Mythforge Basin",
      cost: 1.5e12,
      wait: [0.38, 0.8],
      valueMult: 48,
      rarity: 21,
      blurb: "Molten legend · endgame pays hard"
    },
    {
      id: "genesispool",
      name: "Genesis Pool",
      cost: 7e12,
      wait: [0.35, 0.75],
      valueMult: 64,
      rarity: 22,
      blurb: "First waters · omega odds surge"
    },
    {
      id: "absolution",
      name: "Absolution Sea",
      cost: 3e13,
      wait: [0.32, 0.7],
      valueMult: 85,
      rarity: 23,
      blurb: "Beyond omega · the last shore"
    }
  ];

  const MAX_SPOT_RARITY = 23;

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
    { id: "perfect14", name: "Genesis Timing", desc: "+120% sell on perfect reels", cost: 300000000000, kind: "perfect", amount: 1.2 }
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
  const menuGuideBtn = document.getElementById("menu-guide-btn");
  const guideOverlay = document.getElementById("guide-overlay");
  const adminOverlay = document.getElementById("admin-overlay");
  const adminBtn = document.getElementById("admin-btn");
  const adminClose = document.getElementById("admin-close");
  const guideClose = document.getElementById("guide-close");
  const guideBody = document.getElementById("guide-body");
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

  /** How strongly a luck mult shifts weight toward this rarity (common=0 … omega=1). */
  function luckRaritySkew(rarity) {
    const rank = RARITY_RANK[rarity] || 1;
    const top = RARITY_RANK.omega || 13;
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

  let adminEventCache = null; // { kind, until, startedAt, mult } | null
  let adminEventFetchedAt = 0;
  let adminEventPollTimer = 0;
  let adminBusy = false;
  let adminRetryTimer = 0;
  let pendingAdminPush = null;

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

  function parseAdminEventPayload(data, requireToken = false) {
    if (!data || typeof data !== "object") return null;
    if (requireToken && String(data.token || "") !== ADMIN_EVENT_TOKEN) return null;
    const kind = String(data.kind || "").toLowerCase();
    if (kind !== "luck" && kind !== "money") return null;
    const until = Math.floor(Number(data.until) || 0);
    if (!Number.isFinite(until) || until <= Date.now()) return null;
    const startedAt = Math.floor(Number(data.startedAt) || until - EVENT_ACTIVE_MS);
    return {
      kind,
      until,
      startedAt: Number.isFinite(startedAt) ? startedAt : Date.now(),
      mult: clampAdminMult(data.mult ?? ADMIN_DEFAULT_MULT)
    };
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

  function localAdminOverride() {
    return parseAdminEventPayload(readStoredAdmin(ADMIN_EVENT_LOCAL_KEY), true);
  }

  function setLocalAdminOverride(payload, clear = false) {
    if (clear) {
      writeStoredAdmin(ADMIN_EVENT_LOCAL_KEY, null);
      return;
    }
    writeStoredAdmin(ADMIN_EVENT_LOCAL_KEY, payload);
  }

  function mergedAdminEvent() {
    return pickBetterAdminEvent(adminEventCache, localAdminOverride());
  }

  function adminEventLive(now = Date.now()) {
    const e = mergedAdminEvent();
    if (!e) return null;
    if (now >= e.until) return null;
    return e;
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

    const remote = pickBetterAdminEvent(
      parseAdminEventPayload(mantleData, true),
      parseAdminEventPayload(file.data, false)
    );
    // Keep a fresher local owner override (e.g. while Mantle sync is pending)
    adminEventCache = pickBetterAdminEvent(remote, localAdminOverride());
    syncAdminPanel();
    maybeRetryPendingAdminPush();
  }

  function startAdminEventPolling() {
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
    const live = parseAdminEventPayload(pending, true);
    if (live) setLocalAdminOverride(pending, false);
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
      adminEventCache = parseAdminEventPayload(payload, true);
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
    const live = adminEventLive();
    const pending = !!pendingAdminPush;
    const localOnly = live && String(readStoredAdmin(ADMIN_EVENT_LOCAL_KEY)?.scope || "") === "local";
    if (live) {
      status.textContent = `Live (${localOnly ? "local" : pending ? "global · syncing" : "global"}): ${formatMult(
        live.mult
      )}× ${live.kind === "luck" ? "luck" : "sell"} · ${formatTreasureClock(live.until - Date.now())} left`;
    } else {
      status.textContent = "No admin event · pick Local or Global, then start";
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
    document.getElementById("admin-cmd-input")?.focus?.();
  }

  function closeAdmin() {
    adminOverlay?.classList.add("hidden");
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

  function applyAdminLocally(payload, clear = false) {
    if (clear) {
      setLocalAdminOverride(null, true);
      adminEventCache = null;
    } else {
      setLocalAdminOverride(payload, false);
      adminEventCache = parseAdminEventPayload(payload, true);
    }
    lastAnnouncedEventKey = "";
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
    scope = getAdminScope()
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
    const clear = !kind || kind === "clear" || kind === "off";
    const wantGlobal = scope === "global";
    const payload = {
      token: ADMIN_EVENT_TOKEN,
      kind: clear ? "luck" : kind,
      until: clear ? 0 : now + mins * 60_000,
      startedAt: now,
      mult: clear ? ADMIN_DEFAULT_MULT : eventMult,
      scope: wantGlobal ? "global" : "local",
      note: wantGlobal ? "in-game-admin-global" : "in-game-admin-local",
      by: OWNER_NAME
    };

    applyAdminLocally(payload, clear);

    if (!wantGlobal) {
      clearPendingAdminPush();
      if (clear) {
        setCatchLine("Local admin event cleared", "treasure");
      } else {
        setCatchLine(
          `LOCAL ADMIN · ${formatMult(eventMult)}× ${
            kind === "luck" ? "luck" : "sell"
          } for ${mins}m (only you)`,
          "treasure"
        );
        window.HubSound?.play?.("win");
        window.HubConfetti?.burst?.();
      }
      adminBusy = false;
      return true;
    }

    pendingAdminPush = payload;
    writeStoredAdmin(ADMIN_EVENT_PENDING_KEY, payload);
    if (clear) {
      setCatchLine("Clearing global admin event…", "treasure");
    } else {
      setCatchLine(
        `GLOBAL ADMIN · ${formatMult(eventMult)}× ${
          kind === "luck" ? "luck" : "sell"
        } for ${mins}m (syncing…)`,
        "treasure"
      );
      window.HubSound?.play?.("win");
      window.HubConfetti?.burst?.();
    }

    try {
      const res = await fetch(ADMIN_EVENT_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (res.status === 429) {
        markAdminEventRateLimited();
        scheduleAdminRetry();
        setCatchLine(
          clear
            ? "Cleared here · Mantle busy, will sync clear soon"
            : `Live here · ${formatMult(eventMult)}× ${
                kind === "luck" ? "luck" : "sell"
              } · syncing global when Mantle frees up`,
          "treasure"
        );
        return true;
      }
      if (!res.ok) throw new Error("push failed");
      clearAdminEventRateLimited();
      clearPendingAdminPush();
      setCatchLine(
        clear
          ? "Global admin event cleared"
          : `GLOBAL ADMIN · ${formatMult(eventMult)}× ${
              kind === "luck" ? "luck" : "sell"
            } live for ${mins}m (all players)`,
        "treasure"
      );
      return true;
    } catch {
      scheduleAdminRetry();
      setCatchLine(
        clear
          ? "Cleared here · will sync global clear when online"
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
      return { kind: "clear", minutes: 0, mult: ADMIN_DEFAULT_MULT, scope };
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

    if (!usedExplicitMult && /^(sell|money|coin|luck)$/.test(text)) {
      mult = defaults.mult;
    }

    if (/\bluck\b/.test(text) || text === "luck") {
      return { kind: "luck", minutes, mult, scope };
    }
    if (/\b(money|sell|coin)\b/.test(text) || /^(sell|money|coin)$/.test(text)) {
      return { kind: "money", minutes, mult, scope };
    }
    return null;
  }

  async function runAdminCommand(raw) {
    const parsed = parseAdminCommand(raw);
    if (!parsed) {
      setCatchLine("Try: 5x sell 10m local · 3x luck global · clear", "miss");
      return;
    }
    if (parsed.scope === "local" || parsed.scope === "global") {
      setAdminScope(parsed.scope);
    }
    await publishAdminEvent(parsed.kind, parsed.minutes, parsed.mult, parsed.scope);
  }

  function scheduledEventWindowStart(now = Date.now()) {
    return localHalfHourStart(now);
  }

  function eventWindowStart(now = Date.now()) {
    const admin = adminEventLive(now);
    if (admin) return admin.startedAt;
    return scheduledEventWindowStart(now);
  }

  /** True during admin override, or first 5 minutes after :00 / :30. */
  function eventIsLive(now = Date.now()) {
    if (adminEventLive(now)) return true;
    const start = scheduledEventWindowStart(now);
    return now >= start && now < start + EVENT_ACTIVE_MS;
  }

  function eventMsLeft(now = Date.now()) {
    const admin = adminEventLive(now);
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

  /** Live event kind, or null when between windows. */
  function currentEventKind(now = Date.now()) {
    const admin = adminEventLive(now);
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
    const admin = adminEventLive(now);
    if (admin) return clampAdminMult(admin.mult);
    return kind === "luck" ? 1 + EVENT_LUCK_BONUS : 1 + EVENT_MONEY_BONUS;
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

  function maybeAnnounceEvent() {
    if (!eventIsLive()) return;
    const admin = adminEventLive();
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
    const left = eventMsLeft();
    const admin = adminEventLive();
    const nextStart = nextHalfHourStart();
    const nextKind = eventKindForStart(nextStart);
    const untilNext = msUntilNextEvent();
    const previewKind = live ? kind : nextKind;
    const multLabel = formatMult(live ? liveEventMult() : 2);

    if (eventBannerEl) {
      eventBannerEl.classList.toggle("event-idle", !live);
      eventBannerEl.classList.toggle("is-live", live);
      eventBannerEl.classList.toggle("event-money", previewKind === "money");
      eventBannerEl.classList.toggle("event-luck", previewKind === "luck");
    }
    if (eventBannerTagEl) {
      eventBannerTagEl.textContent = live ? (admin ? "ADMIN LIVE" : "LIVE NOW") : "Next event";
    }
    if (eventBannerTitleEl) {
      if (live && kind === "luck") {
        eventBannerTitleEl.textContent = admin
          ? `${multLabel}× Luck · Admin`
          : "2× Luck Event";
      } else if (live && kind === "money") {
        eventBannerTitleEl.textContent = admin
          ? `${multLabel}× Sell · Admin`
          : "2× Sell Event";
      } else {
        eventBannerTitleEl.textContent =
          nextKind === "luck" ? "Upcoming: 2× Luck" : "Upcoming: 2× Sell";
      }
    }
    if (eventBannerTimeEl) {
      eventBannerTimeEl.textContent = live
        ? `${formatTreasureClock(left)} left`
        : `in ${formatTreasureClock(untilNext)}`;
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

  function normalizeCoolerEntry(entry) {
    if (typeof entry === "string") {
      const id = String(entry);
      return fishById(id) ? { id, saved: false, perfect: false } : null;
    }
    if (entry && typeof entry === "object") {
      const id = String(entry.id || "");
      if (!fishById(id)) return null;
      return { id, saved: !!entry.saved, perfect: !!entry.perfect };
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

  function noteCatch(fish) {
    if (!fish) return;
    const score = catchScore(fish);
    if (score <= (state.bestCatchScore || 0)) return;
    state.bestCatchScore = score;
    state.bestCatchId = fish.id;
    try {
      localStorage.setItem(HIGH_SCORE_KEY, String(score));
    } catch {}
    maybeSubmitBest(true);
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
    timeless: "trout",
    foreverfin: "tuna",
    aeon: "shark",
    nebula: "jellyfish",
    quasar: "cod",
    omnifin: "tuna",
    stardrift: "ray",
    aurorafin: "mahi",
    galaxykoi: "koi",
    eventide: "eel",
    horizon: "shark",
    collapse: "carp",
    primefin: "tuna",
    absoluth: "shark",
    theend: "omega"
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
    timeless: "#80deea",
    foreverfin: "#4dd0e1",
    aeon: "#81d4fa",
    nebula: "#b39ddb",
    quasar: "#ce93d8",
    omnifin: "#9575cd",
    stardrift: "#4dd0e1",
    aurorafin: "#80cbc4",
    galaxykoi: "#f48fb1",
    eventide: "#f48fb1",
    horizon: "#ff8a65",
    collapse: "#ffab91",
    primefin: "#ffe066",
    absoluth: "#ffd54f",
    theend: "#fff59d"
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

  function fishGlyphHtml(fish) {
    const id = typeof fish === "string" ? fish : fish?.id;
    const rarity = typeof fish === "string" ? fish : fish?.rarity;
    const shape = FISH_SHAPE[id] || "default";
    const tone = FISH_TINT[id] || rarityColor(rarity);
    const gid = `fg-${String(id || shape).replace(/[^a-z0-9]/gi, "")}${Math.abs(
      Math.imul(
        [...`${id || shape}:${tone}`].reduce((h, c) => (Math.imul(31, h) + c.charCodeAt(0)) | 0, 7)
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
    return `<svg class="fish-glyph shape-${shape} is-realistic" viewBox="0 0 64 32" aria-hidden="true" style="color:${tone}">
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

  function showCatchSilhouette(fish) {
    if (!catchSilEl) return;
    if (!fish || isTreasureItem(fish)) {
      catchSilEl.innerHTML = `<span class="catch-sil-chest" aria-hidden="true">${
        fish?.kind === "luck" ? "◇" : "▣"
      }</span>`;
      catchSilEl.className = `catch-sil is-treasure rarity-${fish?.kind || "money"}`;
      catchSilEl.dataset.fish = fish?.id || "chest";
      return;
    }
    catchSilEl.innerHTML = fishGlyphHtml(fish);
    catchSilEl.className = `catch-sil rarity-${fish.rarity || "common"}`;
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
      omega: "#ffe066"
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
      .map(({ fish, val, perfect, treasure, stored }) => {
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
        const tag = perfect ? "★ perfect" : fish.rarity;
        return `<div class="boat-haul-item ${fish.rarity}">
          <span class="boat-haul-glyph" aria-hidden="true">${fishGlyphHtml(fish)}</span>
          <span class="boat-haul-meta">
            <span class="boat-haul-name">${fish.name}</span>
            <span class="boat-haul-val">${formatNum(val)} · ${tag}</span>
          </span>
          <span class="boat-haul-tag">${fish.rarity}</span>
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
    if (rarity === "common") return 1.2 - t * 0.28;
    if (rarity === "uncommon") return 0.95 + t * 0.28;
    if (rarity === "rare") return 0.38 + t * 0.48;
    if (rarity === "epic") return 0.18 + t * 0.48;
    if (rarity === "legendary") return 0.08 + t * 0.48;
    if (rarity === "mythic") return 0.03 + t * 0.48;
    if (rarity === "secret") return 0.008 + t * 0.35;
    if (rarity === "divine") return 0.003 + t * 0.28;
    if (rarity === "eternal") return 0.001 + t * 0.2;
    if (rarity === "cosmic") return 0.00035 + t * 0.14;
    if (rarity === "astral") return 0.00012 + t * 0.08;
    if (rarity === "singularity") return 0.00004 + t * 0.045;
    if (rarity === "omega") return 0.000012 + t * 0.025;
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
    if (fish.rarity === "uncommon") w += luck * 0.3;
    if (fish.rarity === "rare") w += luck * 0.28;
    if (fish.rarity === "epic") w += luck * 0.16;
    if (fish.rarity === "legendary") w += luck * 0.085;
    if (fish.rarity === "mythic") w += luck * 0.04;
    if (fish.rarity === "secret") w += luck * 0.012;
    if (fish.rarity === "divine") w += luck * 0.006;
    if (fish.rarity === "eternal") w += luck * 0.0028;
    if (fish.rarity === "cosmic") w += luck * 0.001;
    if (fish.rarity === "astral") w += luck * 0.0004;
    if (fish.rarity === "singularity") w += luck * 0.00014;
    if (fish.rarity === "omega") w += luck * 0.000045;
    // Spot still matters, but high rarities are less crushed on early waters
    const t = Math.max(0, Math.min(MAX_SPOT_RARITY, Number(spot.rarity) || 0)) / MAX_SPOT_RARITY;
    if (fish.rarity === "rare") w *= 0.82 + t * 0.18;
    if (fish.rarity === "epic" || fish.rarity === "legendary") w *= 0.6 + t * 0.4;
    if (fish.rarity === "mythic") w *= 0.4 + t * 0.5;
    if (fish.rarity === "secret") w *= (0.25 + t * 0.5) * (forBoat ? 0.5 : 1);
    if (fish.rarity === "divine") w *= (0.16 + t * 0.5) * (forBoat ? 0.4 : 1);
    if (fish.rarity === "eternal") w *= (0.1 + t * 0.48) * (forBoat ? 0.3 : 1);
    if (fish.rarity === "cosmic") w *= (0.065 + t * 0.45) * (forBoat ? 0.2 : 1);
    if (fish.rarity === "astral") w *= (0.04 + t * 0.4) * (forBoat ? 0.14 : 1);
    if (fish.rarity === "singularity") w *= (0.025 + t * 0.35) * (forBoat ? 0.09 : 1);
    if (fish.rarity === "omega") w *= (0.015 + t * 0.3) * (forBoat ? 0.06 : 1);
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
    const mult = (1 + sellBonus() + (perfect ? perfectBonus() : 0)) * treasureMoneyMult();
    return Math.max(1, Math.floor(base * mult));
  }

  function shouldAutoSell(rarity) {
    return !!state.autoSellRarities?.[rarity];
  }

  function anyAutoSellEnabled() {
    return RARITIES.some((r) => shouldAutoSell(r));
  }

  function addToCooler(fish, opts = {}) {
    if (!fish) return false;
    noteCatch(fish);
    const perfect = !!opts.perfect;
    if (opts.forceSell || shouldAutoSell(fish.rarity)) {
      const val = fishValue(fish, currentSpot(), perfect);
      addCoins(val);
      if (!opts.silent) {
        setCatchLine(`Sold ${fish.name} for ${formatNum(val)}`, catchTone(fish.rarity));
      }
      return true;
    }
    if (state.cooler.length >= coolerMax()) {
      if (!opts.silent) {
        setCatchLine("Cooler full — sell or auto-sell this rarity", "miss");
      }
      window.HubSound?.play?.("miss");
      return false;
    }
    state.cooler.push({ id: fish.id, saved: false, perfect });
    return true;
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
      "treasure"
    );
    if (cls) catchLineEl.classList.add(cls);
  }

  function isShowcaseRarity(rarity) {
    return (
      rarity === "legendary" ||
      rarity === "mythic" ||
      rarity === "secret" ||
      rarity === "divine" ||
      rarity === "eternal" ||
      rarity === "cosmic" ||
      rarity === "astral" ||
      rarity === "singularity" ||
      rarity === "omega"
    );
  }

  function catchTone(rarity) {
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

    const ok = addToCooler(fish, { perfect });
    let bonusFish = null;
    let thirdFish = null;
    if (ok && Math.random() < multiCatchChance()) {
      bonusFish = rollFish(spot, false);
      state.catches += 1;
      if (!addToCooler(bonusFish)) bonusFish = null;
    }
    if (ok && bonusFish && Math.random() < tripleCatchChance()) {
      thirdFish = rollFish(spot, false);
      state.catches += 1;
      if (!addToCooler(thirdFish)) thirdFish = null;
    }
    setPhase("result");
    if (ok) {
      const haul = [{ fish, val: fishValue(fish, spot, perfect), perfect }];
      if (bonusFish) {
        haul.push({
          fish: bonusFish,
          val: fishValue(bonusFish, spot, false),
          perfect: false
        });
      }
      if (thirdFish) {
        haul.push({
          fish: thirdFish,
          val: fishValue(thirdFish, spot, false),
          perfect: false
        });
      }
      const showcase = pickBestCatchFish(haul) || fish;
      castBtn.classList.add("is-catch", `rarity-${showcase.rarity}`);
      showCatchSilhouette(showcase);
      showCatchCard(haul);
      const tip = perfect ? "Perfect reel! " : "";
      const extras = [bonusFish, thirdFish].filter(Boolean).map((f) => f.name);
      const bonusTip = extras.length ? ` + ${extras.join(" + ")}` : "";
      setCatchLine(
        `${tip}Caught ${fish.name} (${fish.rarity})${bonusTip}`,
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
        extrasN ? `${showcase.name} +${extrasN}` : showcase.name
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
      setCatchLine(`${fish.name} is saved — unpin to sell`, "miss");
      window.HubSound?.play?.("miss");
      return;
    }
    const val = fishValue(fish, currentSpot(), entry);
    state.cooler.splice(i, 1);
    addCoins(val);
    setCatchLine(`Sold ${fish.name} for ${formatNum(val)}`, catchTone(fish.rarity));
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
    setCatchLine(
      entry.saved ? `Saved ${fish.name} — won't sell until unpinned` : `Unsaved ${fish.name}`
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
      .map(({ fish, val, sold, missed, treasure, stored }) => {
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
        return `<div class="boat-haul-item ${fish.rarity}${missed ? " is-missed" : ""}">
          <span class="boat-haul-glyph" aria-hidden="true">${fishGlyphHtml(fish)}</span>
          <span class="boat-haul-meta">
            <span class="boat-haul-name">${fish.name}</span>
            <span class="boat-haul-val">${formatNum(val)} · ${tag}</span>
          </span>
          <span class="boat-haul-tag">${fish.rarity}</span>
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
      const sold = shouldAutoSell(fish.rarity);
      const val = fishValue(fish, spot);
      if (sold || state.cooler.length < coolerMax()) {
        addToCooler(fish, { silent: true });
        state.catches += 1;
        haul.push({ fish, val, sold, missed: false });
      } else {
        haul.push({ fish, val, sold: false, missed: true });
      }
    }
    if (!haul.length) return;

    flashBoatHaul(haul);
    const best = haul.reduce((a, b) => (b.val >= a.val ? b : a), haul[0]);
    const kept = haul.filter((h) => !h.missed);
    const line =
      kept.length === 0
        ? `Boat found ${best.fish.name} — cooler full`
        : kept.length > 1
          ? `Boat hauled ${kept.length} fish · ${best.fish.name}`
          : `Boat caught ${best.fish.name}`;
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
          noteCatch(fish);
          if (shouldAutoSell(fish.rarity)) {
            gained += fishValue(fish, spot);
          } else if (state.cooler.length < coolerMax()) {
            state.cooler.push({ id: fish.id, saved: false });
          } else {
            gained += fishValue(fish, spot);
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
      .map((e) => `${coolerEntryId(e)}${isCoolerSaved(e) ? "*" : ""}${isCoolerPerfect(e) ? "!" : ""}`)
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
        const perfectMark = isCoolerPerfect(entry) ? " · perfect" : "";
        return `<div class="fish-chip ${fish.rarity}${saved ? " is-saved" : ""}${
          isCoolerPerfect(entry) ? " is-perfect" : ""
        }" data-cooler-index="${index}">
          <span class="fish-chip-glyph" aria-hidden="true">${fishGlyphHtml(fish)}</span>
          <button type="button" class="fish-chip-save" data-save-index="${index}" title="${
            saved ? "Unsave fish" : "Save fish (won't sell)"
          }" aria-label="${saved ? "Unsave" : "Save"} ${fish.name}" aria-pressed="${saved}">${
            saved ? "★" : "☆"
          }</button>
          <button type="button" class="fish-chip-sell" data-sell-index="${index}" title="${
            saved ? "Saved — unpin to sell" : `Sell for ${formatNum(val)}${perfectMark}`
          }" ${saved ? "disabled" : ""}>
            <span class="fish-chip-name">${fish.name}</span>
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
    document.body.classList.toggle("event-idle", !eventLive);
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
      const previewKind = eventLive ? eventKind : eventKindForStart(nextHalfHourStart());
      eventChipEl.classList.toggle("event-money", previewKind === "money");
      eventChipEl.classList.toggle("event-luck", previewKind === "luck");
      eventChipEl.classList.toggle("event-idle", !eventLive);
    }
    if (eventLabelEl) {
      const admin = adminEventLive();
      const multLabel = formatMult(liveEventMult());
      if (eventLive && eventKind === "luck") {
        eventLabelEl.textContent = `${admin ? "Admin " : ""}${multLabel}× luck · ${formatTreasureClock(eventLeft)} left`;
      } else if (eventLive && eventKind === "money") {
        eventLabelEl.textContent = `${admin ? "Admin " : ""}${multLabel}× sell · ${formatTreasureClock(eventLeft)} left`;
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
  }

  function closeMenu() {
    overlay?.classList.add("hidden");
    ensureSession();
  }

  function rarityOrder(r) {
    return {
      common: 0,
      uncommon: 1,
      rare: 2,
      epic: 3,
      legendary: 4,
      mythic: 5,
      secret: 6,
      divine: 7,
      eternal: 8,
      cosmic: 9,
      astral: 10,
      singularity: 11,
      omega: 12
    }[r] ?? 0;
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
      boostsEl.textContent = bits.length ? ` Active: ${bits.join(" · ")}.` : "";
      boostsEl.classList.toggle("is-live", bits.length > 0);
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

  let lastGuideBoostKey = "";

  function maybeRefreshGuide() {
    if (!guideOverlay || guideOverlay.classList.contains("hidden")) return;
    const spot = currentSpot();
    const key = [
      spot?.id,
      formatMult(treasureLuckMult()),
      formatMult(treasureMoneyMult()),
      formatMult(effectiveLuckBonus(spot)),
      formatMult(baseLuck(spot)),
      luckBonus(),
      spotLuckBonus(spot),
      eventLuckActive() ? "L" : "",
      eventMoneyActive() ? "M" : ""
    ].join("|");
    if (key === lastGuideBoostKey) return;
    lastGuideBoostKey = key;
    renderGuide();
  }

  function openGuide() {
    lastGuideBoostKey = "";
    renderGuide();
    guideOverlay?.classList.remove("hidden");
  }

  function closeGuide() {
    guideOverlay?.classList.add("hidden");
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
  menuGuideBtn?.addEventListener("click", () => {
    closeMenu();
    openGuide();
  });
  guideClose?.addEventListener("click", closeGuide);
  guideOverlay?.addEventListener("click", (e) => {
    if (e.target === guideOverlay) closeGuide();
  });
  window.addEventListener("keydown", (e) => {
    if (e.code !== "Escape") return;
    if (adminOverlay && !adminOverlay.classList.contains("hidden")) {
      e.preventDefault();
      closeAdmin();
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
    if (fish) state.bestCatchId = fish.id;
    else if (!state.bestCatchId) {
      const match = fishFromCatchScore(state.bestCatchScore);
      if (match) state.bestCatchId = match.id;
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
