(function () {
  const SAVE_KEY = "fishing-save-v2";
  const HIGH_SCORE_KEY = "fishing-best-catch-v1";
  const BEST_CATCH_META_KEY = "fishing-best-catch-meta-v1";
  const TICK_MS = 100;
  const COOLER_BASE = 12;

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
    "cosmic"
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
    cosmic: 10
  };

  const RARITY_WEIGHT = {
    common: 62,
    uncommon: 22,
    rare: 6,
    epic: 2.2,
    legendary: 0.7,
    mythic: 0.18,
    secret: 0.025,
    divine: 0.008,
    eternal: 0.0025,
    cosmic: 0.0007
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
    { id: "omnifin", name: "Omnifin", rarity: "cosmic", value: 50000000 }
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
    }
  ];

  const MAX_SPOT_RARITY = 15;

  const GEAR = [
    { id: "rod1", name: "Willow Rod", desc: "+0.05s bite window", cost: 40, kind: "window", amount: 0.05 },
    { id: "rod2", name: "Oak Rod", desc: "+0.08s bite window", cost: 180, kind: "window", amount: 0.08 },
    { id: "rod3", name: "Carbon Rod", desc: "+0.12s bite window", cost: 900, kind: "window", amount: 0.12 },
    { id: "rod4", name: "Pro Rod", desc: "+0.15s bite window", cost: 4500, kind: "window", amount: 0.15 },
    { id: "rod5", name: "Myth Rod", desc: "+0.2s bite window", cost: 22000, kind: "window", amount: 0.2 },
    { id: "rod6", name: "Abyss Rod", desc: "+0.25s bite window", cost: 90000, kind: "window", amount: 0.25 },
    { id: "rod7", name: "Void Rod", desc: "+0.3s bite window", cost: 350000, kind: "window", amount: 0.3 },
    { id: "rod8", name: "Cosmic Rod", desc: "+0.35s bite window", cost: 1500000, kind: "window", amount: 0.35 },
    { id: "bait1", name: "Worms", desc: "Faster bites (−12% wait)", cost: 60, kind: "speed", amount: 0.12 },
    { id: "bait2", name: "Crickets", desc: "Faster bites (−15% wait)", cost: 350, kind: "speed", amount: 0.15 },
    { id: "bait3", name: "Spinner", desc: "Faster bites (−18% wait)", cost: 1800, kind: "speed", amount: 0.18 },
    { id: "bait4", name: "Live Bait", desc: "Faster bites (−22% wait)", cost: 9000, kind: "speed", amount: 0.22 },
    { id: "bait5", name: "Glow Shrimp", desc: "Faster bites (−26% wait)", cost: 45000, kind: "speed", amount: 0.26 },
    { id: "bait6", name: "Plasma Flies", desc: "Faster bites (−30% wait)", cost: 200000, kind: "speed", amount: 0.3 },
    { id: "bait7", name: "Starroe", desc: "Faster bites (−34% wait)", cost: 900000, kind: "speed", amount: 0.34 },
    { id: "luck1", name: "Lucky Hook", desc: "+rarity luck", cost: 120, kind: "luck", amount: 8 },
    { id: "luck2", name: "Tide Charm", desc: "+rarity luck", cost: 700, kind: "luck", amount: 12 },
    { id: "luck3", name: "Pearl Lure", desc: "+rarity luck", cost: 4000, kind: "luck", amount: 16 },
    { id: "luck4", name: "Siren Bell", desc: "+rarity luck", cost: 20000, kind: "luck", amount: 22 },
    { id: "luck5", name: "Oracle Coin", desc: "+rarity luck", cost: 100000, kind: "luck", amount: 30 },
    { id: "luck6", name: "Fate Hook", desc: "+rarity luck", cost: 500000, kind: "luck", amount: 40 },
    { id: "luck7", name: "Cosmic Lure", desc: "+rarity luck", cost: 2500000, kind: "luck", amount: 55 },
    { id: "cooler1", name: "Ice Pack", desc: "+4 cooler slots", cost: 200, kind: "cooler", amount: 4 },
    { id: "cooler2", name: "Big Cooler", desc: "+6 cooler slots", cost: 1500, kind: "cooler", amount: 6 },
    { id: "cooler3", name: "Dock Freezer", desc: "+10 cooler slots", cost: 12000, kind: "cooler", amount: 10 },
    { id: "cooler4", name: "Reef Vault", desc: "+14 cooler slots", cost: 80000, kind: "cooler", amount: 14 },
    { id: "cooler5", name: "Trench Hold", desc: "+20 cooler slots", cost: 400000, kind: "cooler", amount: 20 },
    { id: "cooler6", name: "Void Chest", desc: "+28 cooler slots", cost: 2000000, kind: "cooler", amount: 28 },
    { id: "boat1", name: "Canoe Hand", desc: "Auto-catch every 12s", cost: 250, kind: "boat", amount: 12 },
    { id: "boat2", name: "Skiff Crew", desc: "Auto-catch every 8s", cost: 2000, kind: "boat", amount: 8 },
    { id: "boat3", name: "Trawler", desc: "Auto-catch every 5s", cost: 15000, kind: "boat", amount: 5 },
    { id: "boat4", name: "Harbor Fleet", desc: "Auto-catch every 3s", cost: 80000, kind: "boat", amount: 3 },
    { id: "boat5", name: "Deep Sub", desc: "Auto-catch every 2.2s", cost: 350000, kind: "boat", amount: 2.2 },
    { id: "boat6", name: "Rift Drone", desc: "Auto-catch every 1.5s", cost: 1500000, kind: "boat", amount: 1.5 },
    { id: "boat7", name: "Cosmic Net", desc: "Auto-catch every 1s", cost: 6000000, kind: "boat", amount: 1 }
  ];

  const coinCountEl = document.getElementById("coin-count");
  const spotLabelEl = document.getElementById("spot-label");
  const windowLabelEl = document.getElementById("window-label");
  const boatsLabelEl = document.getElementById("boats-label");
  const boatTimersEl = document.getElementById("boat-timers");
  const hudSpotEl = document.getElementById("hud-spot");
  const hudCoolerEl = document.getElementById("hud-cooler");
  const hudBestEl = document.getElementById("hud-best");
  const castBtn = document.getElementById("cast-btn");
  const castBtnText = document.getElementById("cast-btn-text");
  const biteFill = document.getElementById("bite-fill");
  const biteMeter = document.querySelector(".bite-meter");
  const catchLineEl = document.getElementById("catch-line");
  const coolerList = document.getElementById("cooler-list");
  const coolerCountEl = document.getElementById("cooler-count");
  const coolerMaxEl = document.getElementById("cooler-max");
  const sellBtn = document.getElementById("sell-btn");
  const autoSellBox = document.getElementById("auto-sell-rarities");
  const shopList = document.getElementById("shop-list");
  const spotList = document.getElementById("spot-list");
  const overlay = document.getElementById("overlay");
  const overlayBestEl = document.getElementById("overlay-best");
  const startBtn = document.getElementById("start-btn");
  const gamesBtn = document.getElementById("games-btn");
  const menuBtn = document.getElementById("menu-btn");
  const guideBtn = document.getElementById("guide-btn");
  const menuGuideBtn = document.getElementById("menu-guide-btn");
  const guideOverlay = document.getElementById("guide-overlay");
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
      cooler: [],
      autoSellRarities: defaultAutoSell(),
      bestCatchScore: 0,
      bestCatchId: "",
      catches: 0,
      perfects: 0,
      lastTick: Date.now()
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

  function biteWindow() {
    const bonus = ownedGear("window").reduce((s, g) => s + g.amount, 0);
    return Math.min(2.05, 0.45 + bonus);
  }

  function waitScale() {
    const cut = ownedGear("speed").reduce((s, g) => s + g.amount, 0);
    return Math.max(0.35, 1 - cut);
  }

  function luckBonus() {
    return ownedGear("luck").reduce((s, g) => s + g.amount, 0);
  }

  function coolerMax() {
    return COOLER_BASE + ownedGear("cooler").reduce((s, g) => s + g.amount, 0);
  }

  function boats() {
    return ownedGear("boat");
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
      next.cooler = Array.isArray(raw.cooler)
        ? raw.cooler
            .map((id) => String(id))
            .filter((id) => fishById(id))
            .slice(0, coolerMaxFromOwned(next.owned))
        : [];
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
    if (boats().length >= 1) HubAchievements.unlock("fishing_fps_10");
    if (boats().length >= 3) HubAchievements.unlock("fishing_fps_100");
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
    castBtn.classList.remove("phase-ready", "phase-waiting", "phase-bite", "phase-result");
    castBtn.classList.add(`phase-${next === "ready" ? "ready" : next}`);
    biteMeter?.classList.toggle("active", next === "bite");
    if (next === "ready") {
      castBtnText.textContent = "Cast";
      castBtn.disabled = false;
    } else if (next === "waiting") {
      castBtnText.textContent = "Cancel";
      castBtn.disabled = false;
    } else if (next === "bite") {
      castBtnText.textContent = "Reel!";
      castBtn.disabled = false;
    } else {
      castBtnText.textContent = "…";
      castBtn.disabled = true;
    }
  }

  function clearTimers() {
    if (waitTimer) clearTimeout(waitTimer);
    if (biteTimer) clearTimeout(biteTimer);
    waitTimer = null;
    biteTimer = null;
  }

  function rarityFactor(rarity, spotRarity) {
    // Worse spots (low rarity) heavily favor commons; better spots open up rares+.
    const t = Math.max(0, Math.min(MAX_SPOT_RARITY, Number(spotRarity) || 0)) / MAX_SPOT_RARITY;
    if (rarity === "common") return 1.7 - t * 0.55;
    if (rarity === "uncommon") return 0.55 + t * 0.55;
    if (rarity === "rare") return 0.06 + t * 0.7;
    if (rarity === "epic") return 0.02 + t * 0.75;
    if (rarity === "legendary") return 0.006 + t * 0.85;
    if (rarity === "mythic") return 0.0015 + t * 0.95;
    if (rarity === "secret") return 0.0002 + t * 0.55;
    if (rarity === "divine") return 0.00008 + t * 0.4;
    if (rarity === "eternal") return 0.00003 + t * 0.28;
    if (rarity === "cosmic") return 0.00001 + t * 0.18;
    return 1;
  }

  function fishWeight(fish, spot, forBoat = false) {
    const luck = luckBonus() * (forBoat ? 0.4 : 1);
    let w = (RARITY_WEIGHT[fish.rarity] || 10) * rarityFactor(fish.rarity, spot.rarity);
    if (fish.rarity === "uncommon") w += luck * 0.25;
    if (fish.rarity === "rare") w += luck * 0.28;
    if (fish.rarity === "epic") w += luck * 0.2;
    if (fish.rarity === "legendary") w += luck * 0.12;
    if (fish.rarity === "mythic") w += luck * 0.07;
    if (fish.rarity === "secret") w += luck * 0.02;
    if (fish.rarity === "divine") w += luck * 0.012;
    if (fish.rarity === "eternal") w += luck * 0.006;
    if (fish.rarity === "cosmic") w += luck * 0.002;
    // Worse spots suppress high rarities hard; boats are worse at top tiers
    const t = Math.max(0, Math.min(MAX_SPOT_RARITY, Number(spot.rarity) || 0)) / MAX_SPOT_RARITY;
    if (fish.rarity === "rare") w *= 0.45 + t * 0.55;
    if (fish.rarity === "epic" || fish.rarity === "legendary") w *= 0.25 + t * 0.75;
    if (fish.rarity === "mythic") w *= 0.12 + t * 0.88;
    if (fish.rarity === "secret") w *= (0.05 + t * 0.95) * (forBoat ? 0.35 : 1);
    if (fish.rarity === "divine") w *= (0.03 + t * 0.97) * (forBoat ? 0.25 : 1);
    if (fish.rarity === "eternal") w *= (0.02 + t * 0.98) * (forBoat ? 0.18 : 1);
    if (fish.rarity === "cosmic") w *= (0.01 + t * 0.99) * (forBoat ? 0.1 : 1);
    return Math.max(0.01, w);
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

  function fishValue(fish, spot) {
    return Math.max(1, Math.floor(fish.value * (spot?.valueMult || 1)));
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
    if (opts.forceSell || shouldAutoSell(fish.rarity)) {
      const val = fishValue(fish, currentSpot());
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
    state.cooler.push(fish.id);
    return true;
  }

  function setCatchLine(text, cls = "") {
    if (!catchLineEl) return;
    catchLineEl.textContent = text;
    catchLineEl.classList.remove("miss", "legend", "mythic", "secret", "divine", "eternal", "cosmic");
    if (cls) catchLineEl.classList.add(cls);
  }

  function isShowcaseRarity(rarity) {
    return (
      rarity === "legendary" ||
      rarity === "mythic" ||
      rarity === "secret" ||
      rarity === "divine" ||
      rarity === "eternal" ||
      rarity === "cosmic"
    );
  }

  function catchTone(rarity) {
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
    setCatchLine("Line is out… tap again to cancel");
    window.HubSound?.play?.("flap");
    waitTimer = setTimeout(() => openBite(), waitMs);
    saveSoon();
  }

  function cancelCast() {
    if (phase !== "waiting") return;
    clearTimers();
    setPhase("ready");
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
    setCatchLine("It got away…", "miss");
    window.HubSound?.play?.("miss");
    setTimeout(() => {
      setPhase("ready");
      setCatchLine("Ready to cast");
      render(false);
    }, 700);
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
    const fish = rollFish(spot, false);
    state.catches += 1;
    if (perfect) state.perfects += 1;

    const ok = addToCooler(fish);
    setPhase("result");
    if (ok) {
      const tip = perfect ? "Perfect reel! " : "";
      setCatchLine(
        `${tip}Caught ${fish.name} (${fish.rarity})`,
        catchTone(fish.rarity)
      );
      window.HubSound?.play?.(perfect || isShowcaseRarity(fish.rarity) ? "win" : "click");
      if (isShowcaseRarity(fish.rarity)) window.HubConfetti?.burst?.();
      const rect = castBtn.getBoundingClientRect();
      spawnFloat(
        evt?.clientX ?? rect.left + rect.width / 2,
        evt?.clientY ?? rect.top + 20,
        fish.name
      );
    }
    checkAchievements();
    setTimeout(() => {
      setPhase("ready");
      render(false);
      saveSoon();
    }, 650);
  }

  function sellOneFish(index) {
    const i = Math.floor(Number(index));
    if (!Number.isFinite(i) || i < 0 || i >= state.cooler.length) return;
    ensureSession();
    const id = state.cooler[i];
    const fish = fishById(id);
    if (!fish) {
      state.cooler.splice(i, 1);
      render(false);
      saveSoon();
      return;
    }
    const val = fishValue(fish, currentSpot());
    state.cooler.splice(i, 1);
    addCoins(val);
    setCatchLine(`Sold ${fish.name} for ${formatNum(val)}`, catchTone(fish.rarity));
    window.HubSound?.play?.("click");
    render(false);
    saveSoon();
  }

  function sellCooler() {
    if (!state.cooler.length) return;
    ensureSession();
    const spot = currentSpot();
    let total = 0;
    state.cooler.forEach((id) => {
      const fish = fishById(id);
      if (fish) total += fishValue(fish, spot);
    });
    state.cooler = [];
    addCoins(total);
    setCatchLine(`Sold catch for ${formatNum(total)} coins`);
    window.HubSound?.play?.("win");
    render(false);
    saveSoon();
  }

  function buyGear(id) {
    const item = GEAR.find((g) => g.id === id);
    if (!item || state.owned[id] || state.coins < item.cost) return;
    ensureSession();
    state.coins -= item.cost;
    state.owned[id] = true;
    window.HubSound?.play?.("click");
    if (item.kind === "boat") window.HubConfetti?.burst?.();
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

  function boatCatch(boat) {
    const spot = currentSpot();
    const fish = rollFish(spot, true);
    if (shouldAutoSell(fish.rarity) || state.cooler.length < coolerMax()) {
      addToCooler(fish, { silent: true });
      state.catches += 1;
    }
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
    const list = boats();
    if (boatsLabelEl) {
      if (!list.length) boatsLabelEl.textContent = "0";
      else {
        const next = Math.min(...list.map(boatRemaining));
        boatsLabelEl.textContent = `${list.length} · next ${formatTimer(next)}`;
      }
    }
    if (!boatTimersEl) return;
    if (!list.length) {
      boatTimersEl.innerHTML = "";
      boatTimersEl.classList.add("empty");
      return;
    }
    boatTimersEl.classList.remove("empty");
    boatTimersEl.innerHTML = list
      .map((boat) => {
        const interval = Number(boat.amount) || 1;
        const left = boatRemaining(boat);
        const pct = Math.max(0, Math.min(100, (1 - left / interval) * 100));
        return `<div class="boat-timer" data-boat="${boat.id}">
          <div class="boat-timer-top">
            <span class="boat-timer-name">${boat.name}</span>
            <span class="boat-timer-left">${formatTimer(left)}</span>
          </div>
          <div class="boat-timer-track" aria-hidden="true">
            <div class="boat-timer-fill" style="width:${pct.toFixed(1)}%"></div>
          </div>
          <div class="boat-timer-meta">every ${interval}s</div>
        </div>`;
      })
      .join("");
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
    const spot = currentSpot();
    list.forEach((boat) => {
      const count = Math.floor(elapsed / 1000 / boat.amount);
      for (let i = 0; i < Math.min(count, 400); i += 1) {
        const fish = rollFish(spot, true);
        noteCatch(fish);
        if (shouldAutoSell(fish.rarity)) {
          gained += fishValue(fish, spot);
        } else if (state.cooler.length < coolerMax()) {
          state.cooler.push(fish.id);
        } else {
          gained += fishValue(fish, spot);
        }
      }
    });
    if (gained > 0) addCoins(gained);
    if (gained > 0 || state.cooler.length) {
      setCatchLine(
        gained > 0
          ? `While away your boats earned ${formatNum(gained)} coins`
          : "Boats filled part of your cooler while away"
      );
    }
    state.lastTick = now;
  }

  let coolerRenderKey = "";

  function coolerKey() {
    return `${state.spotId}|${state.cooler.join(",")}|${coolerMax()}`;
  }

  function renderCooler(force = false) {
    if (coolerCountEl) coolerCountEl.textContent = String(state.cooler.length);
    if (coolerMaxEl) coolerMaxEl.textContent = String(coolerMax());
    if (hudCoolerEl) hudCoolerEl.textContent = `${state.cooler.length}/${coolerMax()}`;
    if (sellBtn) sellBtn.disabled = state.cooler.length === 0;
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
      .map((id, index) => {
        const fish = fishById(id);
        if (!fish) return "";
        const val = fishValue(fish, spot);
        return `<button type="button" class="fish-chip ${fish.rarity}" data-sell-index="${index}" title="Sell for ${formatNum(val)}">
          <span class="fish-chip-name">${fish.name}</span>
          <span class="fish-chip-price">${formatNum(val)}</span>
        </button>`;
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
      return `<div class="spot-item ${active ? "active" : ""}" role="listitem">
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
    shopList.innerHTML = GEAR.map((item) => {
      const owned = !!state.owned[item.id];
      return `<div class="shop-item" role="listitem">
        <div class="shop-item-main">
          <div class="shop-item-name">${item.name}</div>
          <p class="shop-item-desc">${item.desc}</p>
          <div class="shop-item-owned">${owned ? "Owned" : "Not owned"}</div>
        </div>
        <button type="button" class="buy-btn" data-buy="${item.id}" ${
          owned || state.coins < item.cost ? "disabled" : ""
        }>${owned ? "✓" : formatNum(item.cost)}</button>
      </div>`;
    }).join("");
  }

  function renderStats() {
    const spot = currentSpot();
    const bestFish = fishById(state.bestCatchId) || FISH.find((f) => catchScore(f) === state.bestCatchScore);
    const bestLabel = bestFish ? formatBestCatch(bestFish) : "—";
    if (coinCountEl) coinCountEl.textContent = formatNum(state.coins);
    if (spotLabelEl) spotLabelEl.textContent = spot.name;
    if (hudSpotEl) hudSpotEl.textContent = spot.name;
    if (windowLabelEl) windowLabelEl.textContent = `${biteWindow().toFixed(2)}s`;
    if (hudBestEl) hudBestEl.textContent = bestLabel;
    if (overlayBestEl) overlayBestEl.textContent = bestLabel;
    renderBoatTimers();
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
      cosmic: 9
    }[r] ?? 0;
  }

  function formatChance(pct) {
    if (pct >= 10) return `${pct.toFixed(0)}%`;
    if (pct >= 1) return `${pct.toFixed(1)}%`;
    if (pct >= 0.1) return `${pct.toFixed(2)}%`;
    return "<0.1%";
  }

  function renderGuide() {
    const spot = currentSpot();
    if (guideSpotMult) guideSpotMult.textContent = `×${spot.valueMult}`;
    if (guideSpotName) guideSpotName.textContent = spot.name;
    if (!guideBody) return;
    const rows = [...FISH].sort(
      (a, b) => rarityOrder(a.rarity) - rarityOrder(b.rarity) || a.value - b.value
    );
    guideBody.innerHTML = rows
      .map((fish) => {
        const here = fishValue(fish, spot);
        const chance = formatChance(chancePct(fish, spot));
        return `<tr class="at-spot">
          <td class="guide-fish-name">${fish.name}</td>
          <td class="guide-rarity ${fish.rarity}">${fish.rarity}</td>
          <td>${formatNum(fish.value)}</td>
          <td class="guide-here">${formatNum(here)}</td>
          <td class="guide-spots">${chance} here</td>
        </tr>`;
      })
      .join("");
  }

  function openGuide() {
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
  coolerList?.addEventListener("pointerdown", (e) => {
    const btn = e.target.closest("[data-sell-index]");
    if (!btn || !coolerList.contains(btn)) return;
    e.preventDefault();
    e.stopPropagation();
    sellOneFish(btn.dataset.sellIndex);
  });
  autoSellBox?.addEventListener("change", (e) => {
    const input = e.target.closest("input[data-rarity]");
    if (!input) return;
    const rarity = input.dataset.rarity;
    if (!RARITIES.includes(rarity)) return;
    state.autoSellRarities[rarity] = !!input.checked;
    saveSoon();
  });
  shopList?.addEventListener("pointerdown", (e) => {
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

    // ICE_DRAGON seed: Abyss King on board should show in-game too
    let name = "";
    try {
      name = String(
        (typeof HubPlays !== "undefined" && HubPlays.getName && HubPlays.getName()) || ""
      )
        .trim()
        .toLowerCase();
    } catch {}
    const abyss = fishById("abyssking");
    const abyssScore = abyss ? catchScore(abyss) : 604000;
    if (name === "ice_dragon" && best < abyssScore) {
      applyBestCatchScore(abyssScore, "abyssking");
      renderStats();
      return;
    }

    if (best > (state.bestCatchScore || 0) || (best > 0 && !state.bestCatchId)) {
      applyBestCatchScore(best, state.bestCatchId);
      renderStats();
    }
  }

  state = loadState();
  applyOffline();
  setPhase("ready");
  syncBestCatchFromLeaderboard();
  render();
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
