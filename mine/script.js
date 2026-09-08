(function () {
  const SAVE_KEY = "mine-depth-save-v1";
  const HIGH_SCORE_KEY = "mine-depth-best-v1";
  const BEST_ORE_KEY = "mine-best-ore-v1";
  const BEST_ORE_ID_KEY = "mine-best-ore-id-v1";
  const TICK_MS = 100;
  const CART_MAX = 20;
  const OFFLINE_CAP_MS = 8 * 60 * 60 * 1000;
  const MIN_CLICK_MS = 75;

  const LAYERS = [
    { id: "soil", name: "Soil", min: 0, color: "#8d6e4c" },
    { id: "clay", name: "Clay", min: 35, color: "#a67c52" },
    { id: "peat", name: "Peat", min: 70, color: "#5c4030" },
    { id: "sandstone", name: "Sandstone", min: 110, color: "#c4a574" },
    { id: "limestone", name: "Limestone", min: 160, color: "#d6d0c2" },
    { id: "stone", name: "Stone", min: 220, color: "#7a7f86" },
    { id: "shale", name: "Shale", min: 290, color: "#6b6358" },
    { id: "granite", name: "Granite", min: 380, color: "#9b8b7a" },
    { id: "basalt", name: "Basalt", min: 470, color: "#4b5563" },
    { id: "iron", name: "Iron vein", min: 580, color: "#9aa4b2" },
    { id: "slate", name: "Slate", min: 720, color: "#64748b" },
    { id: "quartz", name: "Quartz", min: 900, color: "#d8d0c4" },
    { id: "marble", name: "Marble", min: 1150, color: "#e7e5e4" },
    { id: "crystal", name: "Crystal", min: 1450, color: "#5ec8c0" },
    { id: "geode", name: "Geode beds", min: 1800, color: "#a78bfa" },
    { id: "obsidian", name: "Obsidian", min: 2300, color: "#3b3348" },
    { id: "brimstone", name: "Brimstone", min: 2900, color: "#b45309" },
    { id: "magma", name: "Magma", min: 3600, color: "#e85d3c" },
    { id: "lava", name: "Lava sea", min: 4500, color: "#dc2626" },
    { id: "mantle", name: "Mantle", min: 5600, color: "#c2410c" },
    { id: "deepmantle", name: "Deep Mantle", min: 7000, color: "#9a3412" },
    { id: "abyss", name: "Abyss", min: 8800, color: "#4a5568" },
    { id: "trench", name: "Dark Trench", min: 10800, color: "#1e293b" },
    { id: "nether", name: "Nether", min: 13500, color: "#7f1d1d" },
    { id: "infernal", name: "Infernal", min: 16500, color: "#991b1b" },
    { id: "core", name: "Core", min: 20500, color: "#f0c14b" },
    { id: "innercore", name: "Inner Core", min: 25500, color: "#fbbf24" },
    { id: "hollow", name: "Hollow Earth", min: 32000, color: "#86efac" },
    { id: "garden", name: "Lost Garden", min: 40000, color: "#4ade80" },
    { id: "primordial", name: "Primordial", min: 50000, color: "#c084fc" },
    { id: "aetherbed", name: "Aether Bed", min: 62000, color: "#67e8f9" },
    { id: "singularity", name: "Singularity", min: 80000, color: "#111827" },
    { id: "rift", name: "Rift", min: 105000, color: "#312e81" },
    { id: "voidsea", name: "Void Sea", min: 140000, color: "#0f172a" },
    { id: "astral", name: "Astral Crust", min: 190000, color: "#e0e7ff" },
    { id: "cosmic", name: "Cosmic Mantle", min: 260000, color: "#818cf8" },
    { id: "omega", name: "Omega Depth", min: 360000, color: "#f472b6" },
    { id: "absolute", name: "Absolute Zero", min: 500000, color: "#e2e8f0" }
  ];

  const ORES = [
    { id: "dirt", name: "Dirt", emoji: "🪨", value: 1, weight: 42, minDepth: 0 },
    { id: "pebble", name: "Pebble", emoji: "⚪", value: 2, weight: 28, minDepth: 8 },
    { id: "claylump", name: "Clay Lump", emoji: "🟤", value: 3, weight: 24, minDepth: 20 },
    { id: "coal", name: "Coal", emoji: "⬛", value: 4, weight: 22, minDepth: 30 },
    { id: "amber", name: "Amber", emoji: "🟡", value: 5, weight: 16, minDepth: 45 },
    { id: "tin", name: "Tin", emoji: "🪙", value: 7, weight: 18, minDepth: 55 },
    { id: "lead", name: "Lead", emoji: "◼️", value: 8, weight: 14, minDepth: 70 },
    { id: "copper", name: "Copper", emoji: "🟠", value: 10, weight: 15, minDepth: 85 },
    { id: "flint", name: "Flint", emoji: "🗿", value: 12, weight: 12, minDepth: 110 },
    { id: "zinc", name: "Zinc", emoji: "🩶", value: 15, weight: 13, minDepth: 140 },
    { id: "iron", name: "Iron", emoji: "⚙️", value: 22, weight: 12, minDepth: 190 },
    { id: "pyrite", name: "Pyrite", emoji: "🟨", value: 28, weight: 9, minDepth: 240 },
    { id: "nickel", name: "Nickel", emoji: "🔘", value: 35, weight: 10, minDepth: 290 },
    { id: "silver", name: "Silver", emoji: "🥈", value: 48, weight: 8, minDepth: 400 },
    { id: "magnetite", name: "Magnetite", emoji: "🧲", value: 58, weight: 7, minDepth: 480 },
    { id: "cobalt", name: "Cobalt", emoji: "🔵", value: 70, weight: 6.5, minDepth: 580 },
    { id: "jade", name: "Jade", emoji: "🟢", value: 88, weight: 5.5, minDepth: 680 },
    { id: "gold", name: "Gold", emoji: "🥇", value: 110, weight: 5, minDepth: 780 },
    { id: "topaz", name: "Topaz", emoji: "🟠", value: 135, weight: 4.4, minDepth: 950 },
    { id: "platinum", name: "Platinum", emoji: "💍", value: 160, weight: 4, minDepth: 1150 },
    { id: "opal", name: "Opal", emoji: "🌈", value: 180, weight: 3.6, minDepth: 1350 },
    { id: "emerald", name: "Emerald", emoji: "💚", value: 200, weight: 3.4, minDepth: 1550 },
    { id: "sapphire", name: "Sapphire", emoji: "💙", value: 230, weight: 3, minDepth: 1750 },
    { id: "gem", name: "Gem", emoji: "💎", value: 260, weight: 2.8, minDepth: 1950 },
    { id: "amethyst", name: "Amethyst", emoji: "💜", value: 310, weight: 2.4, minDepth: 2200 },
    { id: "ruby", name: "Ruby", emoji: "❤️", value: 380, weight: 2.2, minDepth: 2550 },
    { id: "diamond", name: "Diamond", emoji: "💠", value: 480, weight: 1.9, minDepth: 3100 },
    { id: "mythril", name: "Mythril", emoji: "🔷", value: 650, weight: 1.6, minDepth: 3900 },
    { id: "obsidianore", name: "Obsidian Ore", emoji: "🖤", value: 780, weight: 1.35, minDepth: 4500 },
    { id: "adamant", name: "Adamant", emoji: "🛡️", value: 900, weight: 1.2, minDepth: 5200 },
    { id: "infernalite", name: "Infernalite", emoji: "🔥", value: 1050, weight: 1.05, minDepth: 6000 },
    { id: "orichalcum", name: "Orichalcum", emoji: "🔶", value: 1200, weight: 0.95, minDepth: 6800 },
    { id: "runestone", name: "Runestone", emoji: "📜", value: 1500, weight: 0.8, minDepth: 8000 },
    { id: "void", name: "Void Ore", emoji: "🌑", value: 1800, weight: 0.7, minDepth: 9500 },
    { id: "nightsteel", name: "Nightsteel", emoji: "🗡️", value: 2200, weight: 0.55, minDepth: 11500 },
    { id: "aether", name: "Aether", emoji: "🌀", value: 2800, weight: 0.45, minDepth: 14500 },
    { id: "phoenixite", name: "Phoenixite", emoji: "🐦", value: 3600, weight: 0.35, minDepth: 17500 },
    { id: "star", name: "Starcore", emoji: "✨", value: 5000, weight: 0.28, minDepth: 21500 },
    { id: "solarium", name: "Solarium", emoji: "☀️", value: 6200, weight: 0.22, minDepth: 26000 },
    { id: "chronite", name: "Chronite", emoji: "⏳", value: 7500, weight: 0.18, minDepth: 32000 },
    { id: "dreamglass", name: "Dreamglass", emoji: "🫧", value: 9500, weight: 0.14, minDepth: 38000 },
    { id: "hollow", name: "Hollow Shard", emoji: "🕳️", value: 12000, weight: 0.12, minDepth: 42000 },
    { id: "edenite", name: "Edenite", emoji: "🌱", value: 15500, weight: 0.09, minDepth: 48000 },
    { id: "primordial", name: "Primordial Ore", emoji: "🧬", value: 20000, weight: 0.07, minDepth: 56000 },
    { id: "celestium", name: "Celestium", emoji: "☁️", value: 28000, weight: 0.05, minDepth: 68000 },
    { id: "singularity", name: "Singularity Ore", emoji: "⚫", value: 40000, weight: 0.035, minDepth: 82000 },
    { id: "riftcrystal", name: "Rift Crystal", emoji: "🔮", value: 55000, weight: 0.025, minDepth: 110000 },
    { id: "voidpearl", name: "Void Pearl", emoji: "👁️", value: 75000, weight: 0.018, minDepth: 150000 },
    { id: "astrium", name: "Astrium", emoji: "🌠", value: 110000, weight: 0.012, minDepth: 200000 },
    { id: "cosmite", name: "Cosmite", emoji: "🌌", value: 160000, weight: 0.008, minDepth: 270000 },
    { id: "omegite", name: "Omegite", emoji: "Ω", value: 250000, weight: 0.005, minDepth: 370000 },
    { id: "absolute", name: "Absolute Ore", emoji: "❄️", value: 400000, weight: 0.0025, minDepth: 500000 }
  ];

  const UPGRADES = [
    { id: "pick1", name: "Iron Pick", desc: "+0.5m per dig", baseCost: 25, kind: "power", amount: 0.5 },
    { id: "pick2", name: "Steel Pick", desc: "+1m per dig", baseCost: 120, kind: "power", amount: 1 },
    { id: "pick3", name: "Hardened Pick", desc: "+2m per dig", baseCost: 600, kind: "power", amount: 2 },
    { id: "pick4", name: "Diamond Tip", desc: "+4m per dig", baseCost: 3200, kind: "power", amount: 4 },
    { id: "pick5", name: "Plasma Pick", desc: "+8m per dig", baseCost: 18000, kind: "power", amount: 8 },
    { id: "pick6", name: "Core Drill Bit", desc: "+15m per dig", baseCost: 95000, kind: "power", amount: 15 },
    { id: "pick7", name: "Void Chisel", desc: "+30m per dig", baseCost: 520000, kind: "power", amount: 30 },
    { id: "pick8", name: "Star Pick", desc: "+60m per dig", baseCost: 2800000, kind: "power", amount: 60 },
    { id: "pick9", name: "Rift Pick", desc: "+120m per dig", baseCost: 18000000, kind: "power", amount: 120 },
    { id: "pick10", name: "Omega Bore Tip", desc: "+250m per dig", baseCost: 120000000, kind: "power", amount: 250 },
    { id: "drill1", name: "Hand Drill", desc: "Auto dig 0.4/s", baseCost: 80, kind: "drill", amount: 0.4 },
    { id: "drill2", name: "Tunnel Crew", desc: "Auto dig 1/s", baseCost: 500, kind: "drill", amount: 1 },
    { id: "drill3", name: "Bore Machine", desc: "Auto dig 2.5/s", baseCost: 3500, kind: "drill", amount: 2.5 },
    { id: "drill4", name: "Shaft Fleet", desc: "Auto dig 6/s", baseCost: 28000, kind: "drill", amount: 6 },
    { id: "drill5", name: "Mega Bore", desc: "Auto dig 14/s", baseCost: 220000, kind: "drill", amount: 14 },
    { id: "drill6", name: "Planet Drill", desc: "Auto dig 35/s", baseCost: 1600000, kind: "drill", amount: 35 },
    { id: "drill7", name: "Rift Engine", desc: "Auto dig 80/s", baseCost: 22000000, kind: "drill", amount: 80 },
    { id: "drill8", name: "Cosmic Auger", desc: "Auto dig 180/s", baseCost: 250000000, kind: "drill", amount: 180 },
    { id: "luck1", name: "Lucky Lamp", desc: "+25% rare ore odds", baseCost: 200, kind: "luck", amount: 0.25 },
    { id: "luck2", name: "Ore Dog", desc: "+50% rare ore odds", baseCost: 2500, kind: "luck", amount: 0.5 },
    { id: "luck3", name: "Seer Goggles", desc: "+100% rare ore odds", baseCost: 45000, kind: "luck", amount: 1 },
    { id: "luck4", name: "Fate Compass", desc: "+200% rare ore odds", baseCost: 650000, kind: "luck", amount: 2 },
    { id: "luck5", name: "Oracle Lens", desc: "+350% rare ore odds", baseCost: 12000000, kind: "luck", amount: 3.5 },
    { id: "sell1", name: "Ore Broker", desc: "+40% sell value", baseCost: 350, kind: "sell", amount: 0.4 },
    { id: "sell2", name: "Trade Post", desc: "+80% sell value", baseCost: 8000, kind: "sell", amount: 0.8 },
    { id: "sell3", name: "Guild Market", desc: "+150% sell value", baseCost: 120000, kind: "sell", amount: 1.5 },
    { id: "sell4", name: "Royal Charter", desc: "+250% sell value", baseCost: 1400000, kind: "sell", amount: 2.5 },
    { id: "sell5", name: "Cosmic Exchange", desc: "+400% sell value", baseCost: 35000000, kind: "sell", amount: 4 },
    { id: "off1", name: "Night Shift", desc: "+50% offline digs", baseCost: 1500, kind: "offline", amount: 0.5 },
    { id: "off2", name: "Autopilot Crew", desc: "+100% offline digs", baseCost: 35000, kind: "offline", amount: 1 },
    { id: "off3", name: "Dream Bore", desc: "+200% offline digs", baseCost: 500000, kind: "offline", amount: 2 },
    { id: "off4", name: "Eternal Crew", desc: "+400% offline digs", baseCost: 18000000, kind: "offline", amount: 4 },
    { id: "cart1", name: "Bigger Cart", desc: "Cart holds +10 ore", baseCost: 400, kind: "cart", amount: 10 },
    { id: "cart2", name: "Mine Wagon", desc: "Cart holds +20 ore", baseCost: 12000, kind: "cart", amount: 20 },
    { id: "cart3", name: "Ore Train", desc: "Cart holds +40 ore", baseCost: 180000, kind: "cart", amount: 40 },
    { id: "cart4", name: "Void Hopper", desc: "Cart holds +80 ore", baseCost: 8000000, kind: "cart", amount: 80 }
  ];

  const coinCountEl = document.getElementById("coin-count");
  const layerLabelEl = document.getElementById("layer-label");
  const digPowerLabelEl = document.getElementById("dig-power-label");
  const dpsLabelEl = document.getElementById("dps-label");
  const hudDepthEl = document.getElementById("hud-depth");
  const hudBestEl = document.getElementById("hud-best");
  const digBtn = document.getElementById("dig-btn");
  const shaftViewport = document.getElementById("shaft-viewport");
  const strataEl = document.getElementById("strata");
  const rockFaceEl = document.getElementById("rock-face");
  const digFxEl = document.getElementById("dig-fx");
  const surfaceLightEl = document.querySelector(".surface-light");
  const rulerTopEl = document.getElementById("ruler-top");
  const rulerMidEl = document.getElementById("ruler-mid");
  const rulerBotEl = document.getElementById("ruler-bot");
  const layerProgressLabelEl = document.getElementById("layer-progress-label");
  const depthFillEl = document.getElementById("depth-fill");
  const statusLineEl = document.getElementById("status-line");
  const cartCountEl = document.getElementById("cart-count");
  const cartMaxEl = document.getElementById("cart-max");
  const cartListEl = document.getElementById("cart-list");
  const sellBtn = document.getElementById("sell-btn");
  const shopList = document.getElementById("shop-list");
  const overlay = document.getElementById("overlay");
  const overlayBestEl = document.getElementById("overlay-best");
  const startBtn = document.getElementById("start-btn");
  const gamesBtn = document.getElementById("games-btn");
  const menuBtn = document.getElementById("menu-btn");
  const guideBtn = document.getElementById("guide-btn");
  const guideOverlay = document.getElementById("guide-overlay");
  const guideClose = document.getElementById("guide-close");
  const guideBody = document.getElementById("guide-body");
  const floatLayer = document.getElementById("float-layer");

  let state = defaultState();
  let sessionStarted = false;
  let lastSaveAt = 0;
  let lastSubmitAt = 0;
  let autoAcc = 0;
  let shopDirty = true;
  let strataBuilt = false;
  let lastClickAt = 0;
  const BAND_H = 160;
  const VIEW_PAD = 120;

  function defaultState() {
    const owned = {};
    UPGRADES.forEach((u) => {
      owned[u.id] = 0;
    });
    return {
      coins: 0,
      depth: 0,
      bestDepth: 0,
      bestOreId: "",
      bestOreValue: 0,
      cart: [],
      owned,
      lastTick: Date.now()
    };
  }

  function oreById(id) {
    return ORES.find((o) => o.id === id) || null;
  }

  function formatBestOre(oreOrValue) {
    const ore =
      typeof oreOrValue === "object" && oreOrValue
        ? oreOrValue
        : oreById(state.bestOreId) || ORES.find((o) => o.value === Number(oreOrValue));
    if (!ore) return "—";
    return `${ore.emoji} ${ore.name}`;
  }

  function formatNum(n) {
    const x = Number(n) || 0;
    if (x >= 1e15) return (x / 1e15).toFixed(2).replace(/\.?0+$/, "") + "Qa";
    if (x >= 1e12) return (x / 1e12).toFixed(2).replace(/\.?0+$/, "") + "T";
    if (x >= 1e9) return (x / 1e9).toFixed(2).replace(/\.?0+$/, "") + "B";
    if (x >= 1e6) return (x / 1e6).toFixed(2).replace(/\.?0+$/, "") + "M";
    if (x >= 1e4) return (x / 1e3).toFixed(1).replace(/\.0$/, "") + "K";
    if (x >= 1000) return (x / 1e3).toFixed(2).replace(/\.?0+$/, "") + "K";
    return String(Math.floor(x));
  }

  function formatDepth(m) {
    const n = Math.floor(Number(m) || 0);
    if (n >= 10000) return formatNum(n) + "m";
    return n + "m";
  }

  function layerFor(depth) {
    let cur = LAYERS[0];
    for (const layer of LAYERS) {
      if (depth >= layer.min) cur = layer;
    }
    return cur;
  }

  function nextLayerProgress(depth) {
    const layer = layerFor(depth);
    const idx = LAYERS.findIndex((l) => l.id === layer.id);
    const next = LAYERS[idx + 1];
    if (!next) return 1;
    const span = next.min - layer.min;
    return Math.min(1, Math.max(0, (depth - layer.min) / span));
  }

  function ownedCount(id) {
    return Math.max(0, Math.floor(Number(state.owned[id]) || 0));
  }

  function digPower() {
    let p = 1;
    UPGRADES.forEach((u) => {
      if (u.kind === "power") p += ownedCount(u.id) * u.amount;
    });
    return p;
  }

  function drillRate() {
    let r = 0;
    UPGRADES.forEach((u) => {
      if (u.kind === "drill") r += ownedCount(u.id) * u.amount;
    });
    return r;
  }

  function luckMult() {
    let m = 1;
    UPGRADES.forEach((u) => {
      if (u.kind === "luck") m += ownedCount(u.id) * u.amount;
    });
    return m;
  }

  function sellMult() {
    let m = 1;
    UPGRADES.forEach((u) => {
      if (u.kind === "sell") m += ownedCount(u.id) * u.amount;
    });
    return m;
  }

  function offlineMult() {
    let m = 1;
    UPGRADES.forEach((u) => {
      if (u.kind === "offline") m += ownedCount(u.id) * u.amount;
    });
    return m;
  }

  function cartMax() {
    let m = CART_MAX;
    UPGRADES.forEach((u) => {
      if (u.kind === "cart") m += ownedCount(u.id) * u.amount;
    });
    return m;
  }

  function upgradeCost(u) {
    const n = ownedCount(u.id);
    return Math.floor(u.baseCost * Math.pow(1.55, n));
  }

  function ensureSession() {
    if (sessionStarted) return;
    sessionStarted = true;
    if (window.HubPlays) HubPlays.record("mine");
    if (window.HubStreak) HubStreak.recordPlay();
  }

  function load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      if (!data || typeof data !== "object") return;
      state.coins = Math.max(0, Number(data.coins) || 0);
      state.depth = Math.max(0, Number(data.depth) || 0);
      state.bestDepth = Math.max(
        state.depth,
        Number(data.bestDepth) || 0,
        Number(localStorage.getItem(HIGH_SCORE_KEY)) || 0
      );
      state.bestOreValue = Math.max(
        0,
        Number(data.bestOreValue) || 0,
        Number(localStorage.getItem(BEST_ORE_KEY)) || 0
      );
      state.bestOreId =
        (typeof data.bestOreId === "string" && data.bestOreId) ||
        localStorage.getItem(BEST_ORE_ID_KEY) ||
        "";
      if (state.bestOreValue && !oreById(state.bestOreId)) {
        const match = ORES.find((o) => o.value === state.bestOreValue);
        if (match) state.bestOreId = match.id;
      }
      state.cart = Array.isArray(data.cart)
        ? data.cart
            .map((id) => String(id || ""))
            .filter((id) => ORES.some((o) => o.id === id))
            .slice(0, cartMax() + 40)
        : [];
      UPGRADES.forEach((u) => {
        state.owned[u.id] = Math.max(0, Math.floor(Number(data.owned?.[u.id]) || 0));
      });
      state.lastTick = Number(data.lastTick) || Date.now();
    } catch {}
  }

  function save(force) {
    const now = Date.now();
    if (!force && now - lastSaveAt < 800) return;
    lastSaveAt = now;
    state.lastTick = now;
    try {
      localStorage.setItem(
        SAVE_KEY,
        JSON.stringify({
          coins: state.coins,
          depth: state.depth,
          bestDepth: state.bestDepth,
          bestOreId: state.bestOreId,
          bestOreValue: state.bestOreValue,
          cart: state.cart,
          owned: state.owned,
          lastTick: state.lastTick
        })
      );
      localStorage.setItem(HIGH_SCORE_KEY, String(Math.floor(state.bestDepth)));
      if (state.bestOreValue > 0) {
        localStorage.setItem(BEST_ORE_KEY, String(Math.floor(state.bestOreValue)));
        if (state.bestOreId) localStorage.setItem(BEST_ORE_ID_KEY, state.bestOreId);
      }
    } catch {}
  }

  function maybeSubmit(force) {
    if (!window.HubLeaderboard) return;
    const now = Date.now();
    if (!force && now - lastSubmitAt < 8000) return;
    lastSubmitAt = now;
    if (state.bestDepth > 0) {
      HubLeaderboard.submit("mine", Math.floor(state.bestDepth)).catch?.(() => {});
    }
    if (state.bestOreValue > 0) {
      HubLeaderboard.submit("mine-ore", Math.floor(state.bestOreValue)).catch?.(() => {});
    }
  }

  function noteBestOre(ore) {
    if (!ore) return false;
    if (ore.value <= (state.bestOreValue || 0)) return false;
    state.bestOreValue = ore.value;
    state.bestOreId = ore.id;
    try {
      localStorage.setItem(BEST_ORE_KEY, String(ore.value));
      localStorage.setItem(BEST_ORE_ID_KEY, ore.id);
    } catch {}
    return true;
  }

  function checkAchievements() {
    if (!window.HubAchievements) return;
    const d = Math.floor(state.bestDepth);
    if (d >= 50) HubAchievements.unlock("mine_depth_50");
    if (d >= 580) HubAchievements.unlock("mine_depth_400");
    if (d >= 3600) HubAchievements.unlock("mine_depth_2500");
    if (d >= 20500) HubAchievements.unlock("mine_depth_15000");
    if (d >= 32000) HubAchievements.unlock("mine_depth_32000");
    if (d >= 80000) HubAchievements.unlock("mine_depth_80000");
    if (d >= 190000) HubAchievements.unlock("mine_depth_190000");
    if (d >= 500000) HubAchievements.unlock("mine_depth_500000");
    if (drillRate() > 0) HubAchievements.unlock("mine_drill");
    try {
      const life = Number(localStorage.getItem("mine-depth-lifetime-coins") || 0);
      if (life >= 10000) HubAchievements.unlock("mine_coins_10k");
    } catch {}
  }

  function trackLifetimeCoins(gained) {
    try {
      const key = "mine-depth-lifetime-coins";
      const prev = Number(localStorage.getItem(key)) || 0;
      localStorage.setItem(key, String(prev + gained));
    } catch {}
  }

  function buildStrata() {
    if (!strataEl || strataBuilt) return;
    strataBuilt = true;
    const totalH = LAYERS.length * BAND_H + 400;
    strataEl.style.height = `${totalH}px`;
    strataEl.innerHTML = LAYERS.map((layer, i) => {
      const startY = i * BAND_H;
      return `<div class="strata-band" style="top:${startY}px;height:${BAND_H}px;background:linear-gradient(180deg, ${layer.color}cc, ${layer.color}88);">${layer.name}<span class="strata-depth">${formatDepth(layer.min)}+</span></div>`;
    }).join("");
  }

  function shaftScrollForDepth(depth) {
    const layer = layerFor(depth);
    const idx = LAYERS.findIndex((l) => l.id === layer.id);
    const next = LAYERS[idx + 1];
    const span = next ? Math.max(1, next.min - layer.min) : Math.max(1, layer.min * 0.25 || 50000);
    const prog = next ? Math.min(1, Math.max(0, (depth - layer.min) / span)) : Math.min(1, (depth - layer.min) / span);
    return Math.max(0, (idx + prog) * BAND_H - VIEW_PAD);
  }

  function updateShaftView(animateDig) {
    buildStrata();
    const depth = state.depth;
    const layer = layerFor(depth);
    const scroll = shaftScrollForDepth(depth);
    if (strataEl) strataEl.style.transform = `translateY(${-scroll}px)`;

    if (rockFaceEl) {
      rockFaceEl.style.background = `
        radial-gradient(circle at 30% 40%, rgba(255,255,255,0.14), transparent 35%),
        linear-gradient(180deg, ${layer.color}, #241910 85%)`;
    }
    if (surfaceLightEl) {
      surfaceLightEl.style.opacity = String(Math.max(0.04, 0.9 - depth / 2500));
    }

    const viewSpan = Math.max(40, digPower() * 8);
    if (rulerTopEl) rulerTopEl.textContent = formatDepth(Math.max(0, depth - viewSpan));
    if (rulerMidEl) rulerMidEl.textContent = formatDepth(depth);
    if (rulerBotEl) rulerBotEl.textContent = formatDepth(depth + viewSpan);

    if (animateDig && shaftViewport) {
      shaftViewport.classList.remove("digging");
      void shaftViewport.offsetWidth;
      shaftViewport.classList.add("digging");
      setTimeout(() => shaftViewport.classList.remove("digging"), 240);
    }
  }

  function spawnDigFx(ore) {
    if (!digFxEl) return;
    for (let i = 0; i < 5; i += 1) {
      const chip = document.createElement("span");
      chip.className = "chip";
      chip.style.left = `${42 + Math.random() * 16}%`;
      chip.style.bottom = `${70 + Math.random() * 20}px`;
      chip.style.background = layerFor(state.depth).color;
      chip.style.setProperty("--dx", `${(Math.random() - 0.5) * 70}px`);
      chip.style.setProperty("--dy", `${-30 - Math.random() * 50}px`);
      digFxEl.appendChild(chip);
      setTimeout(() => chip.remove(), 450);
    }
    if (ore) {
      const pop = document.createElement("span");
      pop.className = "ore-pop";
      pop.textContent = ore.emoji;
      pop.style.left = "50%";
      pop.style.bottom = "95px";
      digFxEl.appendChild(pop);
      setTimeout(() => pop.remove(), 700);
    }
  }

  function floatAt(text, x, y) {
    if (!floatLayer) return;
    const el = document.createElement("div");
    el.className = "float-pop";
    el.textContent = text;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    floatLayer.appendChild(el);
    setTimeout(() => el.remove(), 900);
  }

  function pickOre() {
    const depth = state.depth;
    const luck = luckMult();
    const pool = ORES.filter((o) => depth >= o.minDepth).map((o) => {
      const rarityBoost = o.value >= 100 ? luck : 1 + (luck - 1) * 0.35;
      return { ore: o, w: o.weight * rarityBoost };
    });
    const total = pool.reduce((s, p) => s + p.w, 0);
    let roll = Math.random() * total;
    for (const p of pool) {
      roll -= p.w;
      if (roll <= 0) return p.ore;
    }
    return pool[pool.length - 1]?.ore || ORES[0];
  }

  function addOre(ore) {
    if (state.cart.length >= cartMax()) return false;
    state.cart.push(ore.id);
    return true;
  }

  function doDigBatch(count, source) {
    if (count <= 0) return;
    if (source === "click") {
      const now = Date.now();
      if (now - lastClickAt < MIN_CLICK_MS) return;
      lastClickAt = now;
    }
    ensureSession();
    const power = digPower();
    const meters = Math.max(0.05, count * power);
    const prevBest = state.bestDepth;
    state.depth += meters;
    if (state.depth > state.bestDepth) state.bestDepth = state.depth;
    if (Math.floor(state.bestDepth) >= 1000 && Math.floor(prevBest) < 1000) {
      window.HubConfetti?.burst?.();
    }

    let lastOre = null;
    let added = 0;
    let blocked = 0;
    let newBestOre = false;
    for (let i = 0; i < count; i += 1) {
      const ore = pickOre();
      if (noteBestOre(ore)) newBestOre = true;
      if (addOre(ore)) {
        lastOre = ore;
        added += 1;
      } else {
        blocked += 1;
      }
    }

    if (source === "click") {
      window.HubSound?.play?.("click");
      updateShaftView(true);
      if (lastOre) spawnDigFx(lastOre);
      else spawnDigFx();
      const rect = digBtn?.getBoundingClientRect() || shaftViewport?.getBoundingClientRect();
      if (rect) {
        floatAt(
          `↓ ${meters.toFixed(meters >= 10 ? 0 : 1)}m`,
          rect.left + rect.width * 0.5,
          rect.top + 18
        );
      }
    } else if (count >= 3) {
      updateShaftView(true);
      if (lastOre) spawnDigFx(lastOre);
    } else {
      updateShaftView(false);
    }

    if (lastOre && added) {
      statusLineEl.textContent =
        count === 1
          ? `Dug into ${lastOre.emoji} ${lastOre.name} (↓${formatDepth(meters)})${newBestOre ? " · new best ore!" : ""}`
          : `Shaft sank ${formatDepth(meters)} · ${added} ore${newBestOre ? " · new best ore!" : ""}`;
    } else if (blocked) {
      statusLineEl.textContent = `Cart full — sell ore, then dig deeper (↓${formatDepth(meters)})`;
    }

    checkAchievements();
    maybeSubmit(false);
    shopDirty = true;
    render();
    save(false);
  }

  function sellAll() {
    if (!state.cart.length) return;
    ensureSession();
    const mult = sellMult();
    let gained = 0;
    state.cart.forEach((id) => {
      const ore = ORES.find((o) => o.id === id);
      if (ore) gained += ore.value * mult;
    });
    gained = Math.floor(gained);
    state.cart = [];
    state.coins += gained;
    trackLifetimeCoins(gained);
    statusLineEl.textContent = `Sold ore for ${formatNum(gained)} coins`;
    window.HubSound?.play?.("ok");
    checkAchievements();
    shopDirty = true;
    render();
    save(true);
  }

  function buyUpgrade(id) {
    const u = UPGRADES.find((x) => x.id === id);
    if (!u) return;
    const cost = upgradeCost(u);
    if (state.coins < cost) return;
    ensureSession();
    state.coins -= cost;
    state.owned[u.id] = ownedCount(u.id) + 1;
    statusLineEl.textContent = `Bought ${u.name}`;
    window.HubSound?.play?.("ok");
    checkAchievements();
    shopDirty = true;
    render();
    save(true);
  }

  function applyOffline() {
    const now = Date.now();
    const elapsed = Math.min(OFFLINE_CAP_MS, Math.max(0, now - (state.lastTick || now)));
    if (elapsed < 5000) return;
    const rate = drillRate();
    if (rate <= 0) return;
    const digs = (elapsed / 1000) * rate * offlineMult();
    const whole = Math.floor(digs);
    if (whole <= 0) return;
    let found = 0;
    for (let i = 0; i < whole; i += 1) {
      state.depth += digPower();
      if (state.depth > state.bestDepth) state.bestDepth = state.depth;
      const ore = pickOre();
      noteBestOre(ore);
      if (addOre(ore)) found += 1;
      if (state.cart.length >= cartMax()) break;
    }
    statusLineEl.textContent = `While away: +${formatDepth(whole * digPower())}, ${found} ore`;
    checkAchievements();
    maybeSubmit(true);
  }

  function renderCart() {
    if (!cartListEl) return;
    const counts = {};
    state.cart.forEach((id) => {
      counts[id] = (counts[id] || 0) + 1;
    });
    cartListEl.innerHTML = Object.keys(counts)
      .map((id) => {
        const ore = ORES.find((o) => o.id === id);
        if (!ore) return "";
        return `<span class="ore-chip">${ore.emoji} ${ore.name} ×${counts[id]}</span>`;
      })
      .join("");
    if (cartCountEl) cartCountEl.textContent = String(state.cart.length);
    if (cartMaxEl) cartMaxEl.textContent = String(cartMax());
    if (sellBtn) sellBtn.disabled = state.cart.length === 0;
  }

  function renderShop() {
    if (!shopList || !shopDirty) return;
    shopDirty = false;
    shopList.innerHTML = UPGRADES.map((u) => {
      const n = ownedCount(u.id);
      const cost = upgradeCost(u);
      const can = state.coins >= cost;
      return `<div class="shop-item ${can ? "" : "locked"}" role="listitem">
        <div>
          <div class="shop-name">${u.name}</div>
          <p class="shop-desc">${u.desc}</p>
          <div class="shop-meta">Owned ${n}</div>
        </div>
        <button type="button" class="shop-buy" data-buy="${u.id}" ${can ? "" : "disabled"}>
          ${formatNum(cost)}
        </button>
      </div>`;
    }).join("");
  }

  function render() {
    const layer = layerFor(state.depth);
    if (coinCountEl) coinCountEl.textContent = formatNum(state.coins);
    if (layerLabelEl) layerLabelEl.textContent = layer.name;
    if (digPowerLabelEl) digPowerLabelEl.textContent = `${digPower().toFixed(digPower() % 1 ? 1 : 0)}m`;
    if (dpsLabelEl) dpsLabelEl.textContent = `${drillRate().toFixed(drillRate() % 1 ? 1 : 0)}/s`;
    if (hudDepthEl) hudDepthEl.textContent = formatDepth(state.depth);
    if (hudBestEl) {
      hudBestEl.textContent = `${formatDepth(state.bestDepth)} · ${formatBestOre()}`;
    }
    if (overlayBestEl) {
      overlayBestEl.textContent = `${formatDepth(state.bestDepth)} · ${formatBestOre()}`;
    }
    const idx = LAYERS.findIndex((l) => l.id === layer.id);
    const next = LAYERS[idx + 1];
    if (layerProgressLabelEl) {
      layerProgressLabelEl.textContent = next
        ? `${Math.round(nextLayerProgress(state.depth) * 100)}% to ${next.name}`
        : "Deepest layer";
    }
    if (depthFillEl) depthFillEl.style.width = `${Math.round(nextLayerProgress(state.depth) * 100)}%`;
    updateShaftView(false);
    renderCart();
    renderShop();
  }

  function renderGuide() {
    if (!guideBody) return;
    guideBody.innerHTML =
      `<div class="guide-row"><span></span><div><div class="name">Layers</div><div class="meta">Deeper layers unlock richer ore.</div></div><span></span></div>` +
      LAYERS.map(
        (l) =>
          `<div class="guide-row"><span style="width:12px;height:12px;border-radius:50%;background:${l.color}"></span><div><div class="name">${l.name}</div><div class="meta">From ${formatDepth(l.min)}</div></div><span></span></div>`
      ).join("") +
      `<div class="guide-row"><span></span><div><div class="name">Ores</div><div class="meta">Base sell value before market upgrades.</div></div><span></span></div>` +
      ORES.map(
        (o) =>
          `<div class="guide-row"><span>${o.emoji}</span><div><div class="name">${o.name}</div><div class="meta">From ${formatDepth(o.minDepth)}</div></div><strong>${o.value}</strong></div>`
      ).join("");
  }

  function tick() {
    const rate = drillRate();
    if (rate > 0) {
      autoAcc += rate * (TICK_MS / 1000);
      const digs = Math.floor(autoAcc);
      if (digs > 0) {
        autoAcc -= digs;
        doDigBatch(digs, "auto");
      }
    }
    if (shopDirty) renderShop();
    else if (shopList) {
      shopList.querySelectorAll("[data-buy]").forEach((btn) => {
        const id = btn.getAttribute("data-buy");
        const u = UPGRADES.find((x) => x.id === id);
        if (!u) return;
        const cost = upgradeCost(u);
        btn.disabled = state.coins < cost;
        btn.textContent = formatNum(cost);
        btn.closest(".shop-item")?.classList.toggle("locked", state.coins < cost);
      });
    }
    save(false);
  }

  digBtn?.addEventListener("click", () => doDigBatch(1, "click"));
  shaftViewport?.addEventListener("click", () => doDigBatch(1, "click"));
  shaftViewport?.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      doDigBatch(1, "click");
    }
  });
  sellBtn?.addEventListener("click", () => sellAll());
  shopList?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-buy]");
    if (!btn) return;
    buyUpgrade(btn.getAttribute("data-buy"));
  });
  startBtn?.addEventListener("click", () => {
    overlay?.classList.add("hidden");
    ensureSession();
  });
  menuBtn?.addEventListener("click", () => overlay?.classList.remove("hidden"));
  gamesBtn?.addEventListener("click", () => {
    window.location.href = "../index.html#games";
  });
  guideBtn?.addEventListener("click", () => {
    renderGuide();
    guideOverlay?.classList.remove("hidden");
  });
  guideClose?.addEventListener("click", () => guideOverlay?.classList.add("hidden"));

  load();
  applyOffline();
  render();
  maybeSubmit(true);
  checkAchievements();
  setInterval(tick, TICK_MS);
  window.addEventListener("beforeunload", () => {
    save(true);
    maybeSubmit(true);
  });
})();
