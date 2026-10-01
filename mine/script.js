(function () {
  const SAVE_KEY = "mine-depth-save-v1";
  const HIGH_SCORE_KEY = "mine-depth-best-v1";
  const BEST_ORE_KEY = "mine-best-ore-v1";
  const BEST_ORE_ID_KEY = "mine-best-ore-id-v1";
  const LOCAL_WIPE_ID = "hub-mine-local-wipe-v3";
  const ICE_LOCAL_WIPE_ID = "hub-mine-ice-dragon-wipe-v1";
  const TICK_MS = 100;
  const CART_MAX = 20;
  const OFFLINE_CAP_MS = 8 * 60 * 60 * 1000;
  const MIN_CLICK_MS = 75;

  function wipeLocalMineKeys() {
    const doomed = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (!key || /wipe/i.test(key)) continue;
      if (/^mine(-depth|-best)?/i.test(key)) doomed.push(key);
    }
    doomed.forEach((key) => localStorage.removeItem(key));
    try {
      const vault = JSON.parse(localStorage.getItem("hub-account-bags-v1") || "{}");
      if (vault && typeof vault === "object") {
        Object.keys(vault).forEach((pid) => {
          const kv = vault[pid] && vault[pid].kv;
          if (!kv || typeof kv !== "object") return;
          Object.keys(kv).forEach((k) => {
            if (/^mine(-depth|-best)?/i.test(k)) delete kv[k];
          });
        });
        localStorage.setItem("hub-account-bags-v1", JSON.stringify(vault));
      }
    } catch {}
    try {
      const lbRaw = localStorage.getItem("hub-leaderboards-v1");
      if (lbRaw) {
        const lb = JSON.parse(lbRaw) || {};
        if (lb.games && typeof lb.games === "object") {
          lb.games.mine = {};
          lb.games["mine-ore"] = {};
        }
        if (!lb.resets || typeof lb.resets !== "object") lb.resets = {};
        lb.resets["mine:hard-empty-20261001c"] = Date.UTC(2026, 9, 1, 14, 45, 0);
        localStorage.setItem("hub-leaderboards-v1", JSON.stringify(lb));
      }
    } catch {}
    try {
      const achKey = "hub-achievements-v1";
      const raw = localStorage.getItem(achKey);
      if (raw) {
        const data = JSON.parse(raw) || {};
        Object.keys(data).forEach((id) => {
          if (/^mine_/i.test(id)) delete data[id];
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
            JSON.stringify(list.filter((id) => !/^mine_/i.test(String(id || ""))))
          );
        }
      }
    } catch {}
  }

  // Force-clear every local Mine Depth key once (leaderboard wipe companion).
  try {
    if (localStorage.getItem(LOCAL_WIPE_ID) !== "done") {
      wipeLocalMineKeys();
      localStorage.setItem(LOCAL_WIPE_ID, "done");
      localStorage.setItem("hub-mine-local-wipe-v2", "done");
      setTimeout(() => {
        try {
          window.HubAccountBag?.scrubMineProgressAfterWipe?.()?.catch?.(() => {});
        } catch {}
        try {
          window.HubLeaderboard?.sync?.(true)?.catch?.(() => {});
        } catch {}
      }, 800);
    }
  } catch {}

  // One-time: reset ICE_DRAGON's local Mine Depth progress only.
  try {
    const name = String(
      (typeof HubPlays !== "undefined" && HubPlays.getName && HubPlays.getName()) || ""
    )
      .trim()
      .toLowerCase();
    if (name === "ice_dragon" && localStorage.getItem(ICE_LOCAL_WIPE_ID) !== "done") {
      wipeLocalMineKeys();
      localStorage.setItem(ICE_LOCAL_WIPE_ID, "done");
    }
  } catch {}

  if (!window.MineData || !MineData.LAYERS || !MineData.ORES) {
    console.error("MineData missing — load mine-data.js first");
  }

  const LAYERS = (window.MineData && MineData.LAYERS) || [{ id: "soil", name: "Soil", min: 0, color: "#8d6e4c" }];
  const ORES = (window.MineData && MineData.ORES) || [
    { id: "dirt", name: "Dirt", emoji: "🪨", value: 1, weight: 40, minDepth: 0 }
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
    { id: "pick11", name: "Nebula Spike", desc: "+500m per dig", baseCost: 850000000, kind: "power", amount: 500 },
    { id: "pick12", name: "Quasar Edge", desc: "+1km per dig", baseCost: 6e9, kind: "power", amount: 1000 },
    { id: "pick13", name: "Singularity Pick", desc: "+2.5km per dig", baseCost: 4.5e10, kind: "power", amount: 2500 },
    { id: "pick14", name: "Event Horizon Bit", desc: "+6km per dig", baseCost: 3.2e11, kind: "power", amount: 6000 },
    { id: "pick15", name: "Primordial Chisel", desc: "+15km per dig", baseCost: 2.4e12, kind: "power", amount: 15000 },
    { id: "pick16", name: "Absolute Pick", desc: "+40km per dig", baseCost: 2e13, kind: "power", amount: 40000 },
    { id: "drill1", name: "Hand Drill", desc: "Auto dig +0.4m/s", baseCost: 80, kind: "drill", amount: 0.4 },
    { id: "drill2", name: "Tunnel Crew", desc: "Auto dig +1m/s", baseCost: 500, kind: "drill", amount: 1 },
    { id: "drill3", name: "Bore Machine", desc: "Auto dig +2.5m/s", baseCost: 3500, kind: "drill", amount: 2.5 },
    { id: "drill4", name: "Shaft Fleet", desc: "Auto dig +6m/s", baseCost: 28000, kind: "drill", amount: 6 },
    { id: "drill5", name: "Mega Bore", desc: "Auto dig +14m/s", baseCost: 220000, kind: "drill", amount: 14 },
    { id: "drill6", name: "Planet Drill", desc: "Auto dig +35m/s", baseCost: 1600000, kind: "drill", amount: 35 },
    { id: "drill7", name: "Rift Engine", desc: "Auto dig +80m/s", baseCost: 22000000, kind: "drill", amount: 80 },
    { id: "drill8", name: "Cosmic Auger", desc: "Auto dig +180m/s", baseCost: 250000000, kind: "drill", amount: 180 },
    { id: "drill9", name: "Galaxy Spiral", desc: "Auto dig +420m/s", baseCost: 1.8e9, kind: "drill", amount: 420 },
    { id: "drill10", name: "Void Cascade", desc: "Auto dig +1km/s", baseCost: 1.4e10, kind: "drill", amount: 1000 },
    { id: "drill11", name: "Nova Lattice", desc: "Auto dig +2.5km/s", baseCost: 1.1e11, kind: "drill", amount: 2500 },
    { id: "drill12", name: "Chrono Bore", desc: "Auto dig +6km/s", baseCost: 9e11, kind: "drill", amount: 6000 },
    { id: "drill13", name: "Astral Swarm", desc: "Auto dig +15km/s", baseCost: 7.5e12, kind: "drill", amount: 15000 },
    { id: "drill14", name: "World Eater", desc: "Auto dig +40km/s", baseCost: 6.5e13, kind: "drill", amount: 40000 },
    { id: "luck1", name: "Lucky Lamp", desc: "+25% rare ore odds", baseCost: 200, kind: "luck", amount: 0.25 },
    { id: "luck2", name: "Ore Dog", desc: "+50% rare ore odds", baseCost: 2500, kind: "luck", amount: 0.5 },
    { id: "luck3", name: "Seer Goggles", desc: "+100% rare ore odds", baseCost: 45000, kind: "luck", amount: 1 },
    { id: "luck4", name: "Fate Compass", desc: "+200% rare ore odds", baseCost: 650000, kind: "luck", amount: 2 },
    { id: "luck5", name: "Oracle Lens", desc: "+350% rare ore odds", baseCost: 12000000, kind: "luck", amount: 3.5 },
    { id: "luck6", name: "Fortune Prism", desc: "+550% rare ore odds", baseCost: 280000000, kind: "luck", amount: 5.5 },
    { id: "luck7", name: "Destiny Loom", desc: "+900% rare ore odds", baseCost: 6.5e9, kind: "luck", amount: 9 },
    { id: "luck8", name: "Mythic Dowser", desc: "+1500% rare ore odds", baseCost: 1.6e11, kind: "luck", amount: 15 },
    { id: "sell1", name: "Ore Broker", desc: "+40% sell value", baseCost: 350, kind: "sell", amount: 0.4 },
    { id: "sell2", name: "Trade Post", desc: "+80% sell value", baseCost: 8000, kind: "sell", amount: 0.8 },
    { id: "sell3", name: "Guild Market", desc: "+150% sell value", baseCost: 120000, kind: "sell", amount: 1.5 },
    { id: "sell4", name: "Royal Charter", desc: "+250% sell value", baseCost: 1400000, kind: "sell", amount: 2.5 },
    { id: "sell5", name: "Cosmic Exchange", desc: "+400% sell value", baseCost: 35000000, kind: "sell", amount: 4 },
    { id: "sell6", name: "Nebula Bourse", desc: "+650% sell value", baseCost: 900000000, kind: "sell", amount: 6.5 },
    { id: "sell7", name: "Astral Syndicate", desc: "+1000% sell value", baseCost: 2.2e10, kind: "sell", amount: 10 },
    { id: "sell8", name: "Omni Auction", desc: "+1600% sell value", baseCost: 5.5e11, kind: "sell", amount: 16 },
    { id: "off1", name: "Night Shift", desc: "+50% offline digs", baseCost: 1500, kind: "offline", amount: 0.5 },
    { id: "off2", name: "Autopilot Crew", desc: "+100% offline digs", baseCost: 35000, kind: "offline", amount: 1 },
    { id: "off3", name: "Dream Bore", desc: "+200% offline digs", baseCost: 500000, kind: "offline", amount: 2 },
    { id: "off4", name: "Eternal Crew", desc: "+400% offline digs", baseCost: 18000000, kind: "offline", amount: 4 },
    { id: "off5", name: "Phantom Shift", desc: "+700% offline digs", baseCost: 450000000, kind: "offline", amount: 7 },
    { id: "off6", name: "Timeless Gang", desc: "+1200% offline digs", baseCost: 1.2e10, kind: "offline", amount: 12 },
    { id: "off7", name: "Forever Shaft", desc: "+2000% offline digs", baseCost: 3.5e11, kind: "offline", amount: 20 },
    { id: "cart1", name: "Bigger Cart", desc: "Cart holds +10 ore", baseCost: 400, kind: "cart", amount: 10 },
    { id: "cart2", name: "Mine Wagon", desc: "Cart holds +20 ore", baseCost: 12000, kind: "cart", amount: 20 },
    { id: "cart3", name: "Ore Train", desc: "Cart holds +40 ore", baseCost: 180000, kind: "cart", amount: 40 },
    { id: "cart4", name: "Void Hopper", desc: "Cart holds +80 ore", baseCost: 8000000, kind: "cart", amount: 80 },
    { id: "cart5", name: "Rift Freighter", desc: "Cart holds +160 ore", baseCost: 220000000, kind: "cart", amount: 160 },
    { id: "cart6", name: "Star Hauler", desc: "Cart holds +320 ore", baseCost: 6e9, kind: "cart", amount: 320 },
    { id: "cart7", name: "Infinity Hold", desc: "Cart holds +640 ore", baseCost: 1.8e11, kind: "cart", amount: 640 }
  ];

  const SHOP_CATEGORIES = [
    { id: "power", title: "Picks", blurb: "More meters when you tap Dig down (does not boost auto drills)." },
    { id: "drill", title: "Drills", blurb: "Auto dig speed in meters per second while the page is open." },
    { id: "luck", title: "Luck", blurb: "Better odds of rarer ores when something drops." },
    { id: "sell", title: "Sell boost", blurb: "Earn more coins when you sell your cart." },
    { id: "offline", title: "Offline", blurb: "More digs while you’re away." },
    { id: "cart", title: "Cart", blurb: "Hold more ore before you need to sell." }
  ];

  const coinCountEl = document.getElementById("coin-count");
  const layerLabelEl = document.getElementById("layer-label");
  const digPowerLabelEl = document.getElementById("dig-power-label");
  const dpsLabelEl = document.getElementById("dps-label");
  const hudDepthEl = document.getElementById("hud-depth");
  const hudBestEl = document.getElementById("hud-best");
  const hudLayerEl = document.getElementById("hud-layer");
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
  const shopCats = document.getElementById("shop-cats");
  const overlay = document.getElementById("overlay");
  const overlayBestEl = document.getElementById("overlay-best");
  const startBtn = document.getElementById("start-btn");
  const gamesBtn = document.getElementById("games-btn");
  const menuBtn = document.getElementById("menu-btn");
  const guideBtn = document.getElementById("guide-btn");
  const guideOverlay = document.getElementById("guide-overlay");
  const guideClose = document.getElementById("guide-close");
  const guideBody = document.getElementById("guide-body");
  const guideCats = document.getElementById("guide-cats");
  const guideLead = document.getElementById("guide-lead");
  const floatLayer = document.getElementById("float-layer");

  let state = defaultState();
  let sessionStarted = false;
  let lastSaveAt = 0;
  let lastSubmitAt = 0;
  let lastAutoOreFxAt = 0;
  let oreMeterBank = 0;
  let autoMeterWindowAt = 0;
  let autoMeterWindowSum = 0;
  let autoStatusAt = 0;
  let lastAutoTickAt = 0;
  let lastAutoShaftAt = 0;
  let lastAutoSaveAt = 0;
  let shopDirty = true;
  let lastClickAt = 0;
  let lastStrataKey = "";
  let shopCat = "all";
  let guideCat = "layers";
  const VIEW_PAD = 110;

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

  /** Integer coins as BigInt so late-game ore values don't vanish into float precision. */
  function toCoins(v) {
    try {
      if (typeof v === "bigint") return v < 0n ? 0n : v;
      if (typeof v === "string") {
        const s = v.trim();
        if (/^\d+$/.test(s)) return BigInt(s);
        const n = Math.floor(Number(s));
        if (!Number.isFinite(n) || n <= 0) return 0n;
        return BigInt(Math.min(n, Number.MAX_SAFE_INTEGER));
      }
      const n = Math.floor(Number(v));
      if (!Number.isFinite(n) || n <= 0) return 0n;
      // Floats above MAX_SAFE_INTEGER lose low digits — keep what IEEE still represents.
      if (n > Number.MAX_SAFE_INTEGER) return BigInt(Math.floor(n));
      return BigInt(n);
    } catch {
      return 0n;
    }
  }

  function coinsToSave(v) {
    return toCoins(v).toString();
  }

  function canAfford(cost) {
    return toCoins(state.coins) >= toCoins(cost);
  }

  function addCoins(amount) {
    const gain = toCoins(amount);
    if (gain <= 0n) return 0n;
    state.coins = toCoins(state.coins) + gain;
    return gain;
  }

  function spendCoins(amount) {
    const cost = toCoins(amount);
    const have = toCoins(state.coins);
    if (cost <= 0n) return true;
    if (have < cost) return false;
    state.coins = have - cost;
    return true;
  }

  function formatBestOre(oreOrValue) {
    if (typeof oreOrValue === "object" && oreOrValue) {
      return `${oreOrValue.emoji} ${oreOrValue.name}`;
    }
    if (window.MineData?.formatOre) {
      const fromId = oreById(state.bestOreId);
      if (fromId) return `${fromId.emoji} ${fromId.name}`;
      return MineData.formatOre(oreOrValue || state.bestOreValue);
    }
    const ore = oreById(state.bestOreId) || ORES.find((o) => o.value === Number(oreOrValue));
    if (!ore) return "—";
    return `${ore.emoji} ${ore.name}`;
  }

  // Same short suffixes as Fishing Idle (K, M, … Dc, UDc, … C).
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

  function formatNumTrim(text) {
    return String(text).replace(/\.0+$/, "").replace(/(\.\d*[1-9])0+$/, "$1");
  }

  function formatNum(n) {
    // Number path — matches Fishing Idle when the value still fits in a float.
    if (typeof n !== "bigint") {
      if (typeof n === "string" && /^\d+$/.test(String(n).trim()) && String(n).trim().length > 15) {
        // long integer string → BigInt path below
      } else {
        let v = Math.abs(Number(n) || 0);
        if (!Number.isFinite(v)) return "0";
        if (v < 1000) return String(Math.floor(v));
        if (v < 1e21) {
          let tier = 0;
          while (v >= 1000 && tier < SUFFIXES.length - 1) {
            v /= 1000;
            tier += 1;
          }
          const text = v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(1) : v.toFixed(2);
          return `${formatNumTrim(text)}${SUFFIXES[tier]}`;
        }
      }
    }

    // BigInt path for huge coin totals.
    let x = toCoins(n);
    if (x < 1000n) return x.toString();
    let tier = 0;
    let div = 1n;
    while (tier < SUFFIXES.length - 1 && x / (div * 1000n) >= 1n) {
      div *= 1000n;
      tier += 1;
    }
    const whole = x / div;
    const rem = x % div;
    let text;
    if (whole >= 100n) {
      text = whole.toString();
    } else if (whole >= 10n) {
      const frac = (rem * 10n) / div;
      text = frac === 0n ? whole.toString() : `${whole}.${frac}`;
    } else {
      const frac = (rem * 100n) / div;
      const fracStr = frac.toString().padStart(2, "0").replace(/0+$/, "");
      text = fracStr ? `${whole}.${fracStr}` : whole.toString();
    }
    return `${formatNumTrim(text)}${SUFFIXES[tier]}`;
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

  /** Meters from current layer start to the next layer (or a late-game fallback). */
  function layerThickness(depth) {
    const layer = layerFor(depth);
    if (Number(layer.span) > 0) return Number(layer.span);
    const idx = Math.max(0, LAYERS.findIndex((l) => l.id === layer.id));
    const next = LAYERS[idx + 1];
    if (!next) return Math.max(8000, Number(layer.min) * 0.06 || 8000);
    return Math.max(10, next.min - layer.min);
  }

  /**
   * Cap dig advance per dig so one click can't clear a thick layer in 2–3 taps.
   * ~8% of the current layer max → deep bands take many digs. Pick power is click-only.
   */
  function digMetersForCount(count, opts = {}) {
    const n = Math.max(1, Math.floor(Number(count) || 1));
    const usePick = opts.usePickPower !== false;
    const power = Math.max(0.05, usePick ? digPower() : 1);
    const span = layerThickness(state.depth);
    const perDig = Math.min(power, Math.max(0.5, span * 0.08));
    return perDig * n;
  }

  function ownedCount(id) {
    if (!state.owned || typeof state.owned !== "object") state.owned = {};
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

  /** Auto depth speed in m/s (pick power does not apply). */
  function autoMetersPerSecond() {
    return Math.max(0, drillRate());
  }

  function formatAutoMps(mps) {
    const n = Math.max(0, Number(mps) || 0);
    if (n <= 0) return "0m/s";
    if (n >= 1000) return `${formatNum(n)}m/s`;
    if (n >= 100) return `${Math.round(n)}m/s`;
    if (n >= 10) return `${n.toFixed(n % 1 ? 1 : 0)}m/s`;
    return `${n.toFixed(n % 1 ? 1 : 0)}m/s`;
  }

  function updateAutoMpsLabel() {
    if (!dpsLabelEl) return;
    dpsLabelEl.textContent = formatAutoMps(autoMetersPerSecond());
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
    const base = Number(u.baseCost) || 0;
    if (!(base > 0)) return 1;
    // Keep cost as Number for shop display; clamp so it stays finite.
    const raw = base * Math.pow(1.55, n);
    if (!Number.isFinite(raw) || raw <= 0) {
      return Number.MAX_SAFE_INTEGER;
    }
    return Math.max(1, Math.floor(raw));
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
      state.coins = toCoins(data.coins);
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
        : [];
      if (!state.owned || typeof state.owned !== "object") state.owned = {};
      UPGRADES.forEach((u) => {
        state.owned[u.id] = Math.max(0, Math.floor(Number(data.owned?.[u.id]) || 0));
      });
      if (state.cart.length > cartMax()) state.cart = state.cart.slice(0, cartMax());
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
          coins: coinsToSave(state.coins),
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
    const at = (idx) => (LAYERS[idx] ? LAYERS[idx].min : 0);
    if (d >= 50) HubAchievements.unlock("mine_depth_50");
    if (d >= at(25) || d >= 500) HubAchievements.unlock("mine_depth_400");
    if (d >= at(80) || d >= 3000) HubAchievements.unlock("mine_depth_2500");
    if (d >= at(150) || d >= 15000) HubAchievements.unlock("mine_depth_15000");
    if (d >= at(250) || d >= 50000) HubAchievements.unlock("mine_depth_32000");
    if (d >= at(400) || d >= 200000) HubAchievements.unlock("mine_depth_80000");
    if (d >= at(650) || d >= 2e6) HubAchievements.unlock("mine_depth_190000");
    if (d >= at(900) || d >= 2e7) HubAchievements.unlock("mine_depth_500000");
    if (drillRate() > 0) HubAchievements.unlock("mine_drill");
    try {
      const life = toCoins(localStorage.getItem("mine-depth-lifetime-coins") || "0");
      if (life >= 10000n) HubAchievements.unlock("mine_coins_10k");
    } catch {}
  }

  function trackLifetimeCoins(gained) {
    try {
      const key = "mine-depth-lifetime-coins";
      const prev = toCoins(localStorage.getItem(key) || "0");
      localStorage.setItem(key, (prev + toCoins(gained)).toString());
    } catch {}
  }

  /** How many meters the shaft camera shows — shrinks with dig power so each dig moves the view. */
  function shaftViewMeters(depth) {
    const span = layerThickness(depth);
    const power = Math.max(1, digPower());
    // Always show a bite of the current layer so progress isn't frozen in multi-km bands.
    return Math.max(60, Math.min(span * 0.45, Math.max(120, power * 28)));
  }

  function buildStrata() {
    if (!strataEl || !shaftViewport) return;
    const depth = state.depth;
    const viewH = Math.max(220, shaftViewport.clientHeight || 320);
    // Quantize so we don't rebuild every meter, but digs still scroll smoothly.
    const meters = Math.max(60, Math.round(shaftViewMeters(depth) / 20) * 20);
    const ppm = viewH / meters;

    let idx = 0;
    while (idx < LAYERS.length - 1 && (LAYERS[idx + 1]?.min ?? Infinity) <= depth) idx += 1;
    const from = Math.max(0, idx - 2);
    const to = Math.min(LAYERS.length - 1, idx + 3);
    const key = `${from}:${to}:${meters}:${idx}`;
    if (key !== lastStrataKey || !strataEl.childElementCount) {
      lastStrataKey = key;
      let html = "";
      let maxBottom = 0;
      for (let i = from; i <= to; i += 1) {
        const band = LAYERS[i];
        const next = LAYERS[i + 1];
        const start = Number(band.min) || 0;
        const end = next
          ? Number(next.min)
          : start + (Number(band.span) || Math.max(1000, start * 0.05));
        const topPx = start * ppm;
        const heightPx = Math.max(36, (end - start) * ppm);
        maxBottom = Math.max(maxBottom, topPx + heightPx);
        const current = i === idx ? " is-current" : "";
        html += `<div class="strata-band${current}" style="top:${topPx}px;height:${heightPx}px;background:linear-gradient(180deg, ${band.color}cc, ${band.color}88);">${band.name}<span class="strata-depth">Layer ${i + 1} · ${formatDepth(band.min)}+</span></div>`;
      }
      strataEl.style.height = `${Math.max(viewH + 200, maxBottom + 120)}px`;
      strataEl.innerHTML = html;
    }
    strataEl.dataset.ppm = String(ppm);
  }

  function shaftScrollForDepth(depth) {
    if (!strataEl) return 0;
    const ppm = Number(strataEl.dataset.ppm) || 1;
    // Meter-based scroll: every dig moves the shaft, even inside huge layers.
    return Math.max(0, depth * ppm - VIEW_PAD);
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
      surfaceLightEl.style.opacity = String(Math.max(0.04, 0.85 - Math.log10(depth + 10) / 8));
    }

    const viewSpan = shaftViewMeters(depth);
    if (rulerTopEl) rulerTopEl.textContent = formatDepth(Math.max(0, depth - viewSpan * 0.38));
    if (rulerMidEl) rulerMidEl.textContent = formatDepth(depth);
    if (rulerBotEl) rulerBotEl.textContent = formatDepth(depth + viewSpan * 0.62);

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
      const age = Math.max(0, depth - o.minDepth);
      const recency = 1 / (1 + age / Math.max(80, depth * 0.12 + 40));
      const rarityBoost = (o.index || 0) > 30 ? luck : 1 + (luck - 1) * 0.4;
      return { ore: o, w: o.weight * recency * rarityBoost };
    });
    const total = pool.reduce((s, p) => s + p.w, 0);
    if (!total) return ORES[0];
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

  /**
   * Ore drops from meters dug — not 1 ore per dig tick.
   * Manual digs are a bit richer; auto/offline need more depth per ore.
   */
  function takeOreRolls(meters, source) {
    const m = Math.max(0, Number(meters) || 0);
    if (m <= 0) return 0;
    const luck = luckMult();
    const base = source === "click" ? 5 : 18;
    const metersPerOre = Math.max(3, base / (1 + (luck - 1) * 0.12));
    oreMeterBank += m;
    let rolls = Math.floor(oreMeterBank / metersPerOre);
    oreMeterBank -= rolls * metersPerOre;
    const cap = source === "click" ? 6 : 3;
    if (rolls > cap) {
      oreMeterBank += (rolls - cap) * metersPerOre * 0.2;
      rolls = cap;
    }
    return rolls;
  }

  function applyDigMeters(meters, source) {
    const m = Math.max(0, Number(meters) || 0);
    if (m <= 0) return;
    if (source === "click") {
      const now = Date.now();
      if (now - lastClickAt < MIN_CLICK_MS) return;
      lastClickAt = now;
    }
    ensureSession();
    const prevBest = state.bestDepth;
    state.depth += m;
    if (state.depth > state.bestDepth) state.bestDepth = state.depth;
    if (Math.floor(state.bestDepth) >= 1000 && Math.floor(prevBest) < 1000) {
      window.HubConfetti?.burst?.();
    }

    const rolls = takeOreRolls(m, source);
    let lastOre = null;
    let added = 0;
    let blocked = 0;
    let newBestOre = false;
    for (let i = 0; i < rolls; i += 1) {
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
          `↓ ${m.toFixed(m >= 10 ? 0 : 1)}m`,
          rect.left + rect.width * 0.5,
          rect.top + 18
        );
      }
      if (lastOre && added) {
        statusLineEl.textContent =
          added === 1
            ? `Dug into ${lastOre.emoji} ${lastOre.name} (↓${formatDepth(m)})${newBestOre ? " · new best ore!" : ""}`
            : `Shaft sank ${formatDepth(m)} · ${added} ore${newBestOre ? " · new best ore!" : ""}`;
      } else if (blocked) {
        statusLineEl.textContent = `Cart full — sell ore, then dig deeper (↓${formatDepth(m)})`;
      } else {
        statusLineEl.textContent = `Shaft sank ${formatDepth(m)} · no ore this dig`;
      }
      checkAchievements();
      maybeSubmit(false);
      renderHud();
      renderCart();
      refreshShopButtons();
      save(false);
      return;
    }

    // Auto: dig first, redraw less often so UI lag can't cut real m/s.
    const now = Date.now();
    if (!autoMeterWindowAt || now - autoMeterWindowAt >= 1000) {
      autoMeterWindowAt = now;
      autoMeterWindowSum = 0;
    }
    autoMeterWindowSum += m;

    if (hudDepthEl) hudDepthEl.textContent = formatDepth(state.depth);
    if (hudBestEl) hudBestEl.textContent = `${formatDepth(state.bestDepth)} · ${formatBestOre()}`;
    updateAutoMpsLabel();

    if (now - lastAutoShaftAt >= 250) {
      lastAutoShaftAt = now;
      updateShaftView(false);
      const layer = layerFor(state.depth);
      const idx = Math.max(0, LAYERS.findIndex((l) => l.id === layer.id));
      if (layerLabelEl) {
        layerLabelEl.textContent = layer.name;
        const chipLabel = layerLabelEl.parentElement?.querySelector(".stat-chip-label");
        if (chipLabel) chipLabel.textContent = `Layer ${idx + 1}`;
      }
      if (hudLayerEl) hudLayerEl.textContent = `Layer ${idx + 1} · ${layer.name}`;
      const next = LAYERS[idx + 1];
      if (layerProgressLabelEl) {
        layerProgressLabelEl.textContent = next
          ? `Layer ${idx + 1}: ${layer.name} · ${Math.round(nextLayerProgress(state.depth) * 100)}% to ${next.name}`
          : `Layer ${idx + 1}: ${layer.name} · deepest`;
      }
      if (depthFillEl) depthFillEl.style.width = `${Math.round(nextLayerProgress(state.depth) * 100)}%`;
    }

    if (lastOre && added && now - lastAutoOreFxAt >= 280) {
      lastAutoOreFxAt = now;
      spawnDigFx(lastOre);
    }

    const mps = formatAutoMps(autoMetersPerSecond());
    if (blocked && !added) {
      statusLineEl.textContent = `Cart full — sell ore · auto ${mps}`;
    } else if (lastOre && added) {
      statusLineEl.textContent =
        added === 1
          ? `Auto ${mps} · ${lastOre.emoji} ${lastOre.name}${newBestOre ? " · new best ore!" : ""}`
          : `Auto ${mps} · ${added} ore${newBestOre ? " · new best ore!" : ""}`;
    } else if (now - autoStatusAt >= 500) {
      autoStatusAt = now;
      const elapsed = Math.max(0.2, (now - autoMeterWindowAt) / 1000);
      const live = autoMeterWindowSum / elapsed;
      statusLineEl.textContent = `Auto dig · ${mps} (live ${formatAutoMps(live)})`;
    }

    if (added > 0 || blocked > 0) renderCart();
    if (now - lastAutoSaveAt >= 1000) {
      lastAutoSaveAt = now;
      checkAchievements();
      maybeSubmit(false);
      save(true);
    }
  }

  function doDigBatch(count, source) {
    if (count <= 0) return;
    const meters = digMetersForCount(count, { usePickPower: source === "click" });
    applyDigMeters(meters, source);
  }

  function sellAll() {
    if (!state.cart.length) return;
    ensureSession();
    const mult = sellMult();
    let gained = 0n;
    const multParts = Math.max(1, Math.round(mult * 1000));
    state.cart.forEach((id) => {
      const ore = ORES.find((o) => o.id === id);
      if (!ore) return;
      const value = toCoins(ore.value);
      // mult can be fractional (e.g. 1.4) — apply as thousandths in BigInt
      gained += (value * BigInt(multParts)) / 1000n;
    });
    if (gained <= 0n) {
      statusLineEl.textContent = "Nothing to sell — cart ores looked empty";
      state.cart = [];
      renderCart();
      return;
    }
    state.cart = [];
    addCoins(gained);
    trackLifetimeCoins(gained);
    if (coinCountEl) coinCountEl.textContent = formatNum(state.coins);
    statusLineEl.textContent = `Sold ore for ${formatNum(gained)} coins`;
    window.HubSound?.play?.("merge");
    checkAchievements();
    shopDirty = true;
    render();
    save(true);
  }

  function buyUpgrade(id) {
    const key = String(id || "");
    const u = UPGRADES.find((x) => x.id === key);
    if (!u) return false;
    if (!state.owned || typeof state.owned !== "object") state.owned = {};
    const cost = upgradeCost(u);
    if (!Number.isFinite(cost) || cost <= 0 || !canAfford(cost)) {
      statusLineEl.textContent = `Need ${formatNum(cost)} coins for ${u.name}`;
      window.HubSound?.play?.("error");
      return false;
    }
    ensureSession();
    if (!spendCoins(cost)) {
      statusLineEl.textContent = `Need ${formatNum(cost)} coins for ${u.name}`;
      window.HubSound?.play?.("error");
      return false;
    }
    state.owned[u.id] = ownedCount(u.id) + 1;
    statusLineEl.textContent = `Bought ${u.name} · now ${formatNum(digPower())}m/dig · ${formatAutoMps(autoMetersPerSecond())} auto`;
    window.HubSound?.play?.("merge");
    checkAchievements();
    shopDirty = true;
    render();
    save(true);
    return true;
  }

  function applyOffline() {
    const now = Date.now();
    const elapsed = Math.min(OFFLINE_CAP_MS, Math.max(0, now - (state.lastTick || now)));
    if (elapsed < 5000) return;
    const rate = drillRate();
    if (rate <= 0) return;
    const sunk = (elapsed / 1000) * rate * offlineMult();
    if (sunk <= 0) return;
    state.depth += sunk;
    if (state.depth > state.bestDepth) state.bestDepth = state.depth;
    let found = 0;
    const rolls = takeOreRolls(sunk, "auto");
    for (let i = 0; i < rolls; i += 1) {
      if (state.cart.length >= cartMax()) break;
      const ore = pickOre();
      noteBestOre(ore);
      if (addOre(ore)) found += 1;
    }
    statusLineEl.textContent = `While away: +${formatDepth(sunk)}, ${found} ore`;
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

  function refreshShopButtons() {
    if (!shopList || shopDirty) return;
    shopList.querySelectorAll(".shop-item").forEach((item) => {
      const id = item.getAttribute("data-buy");
      const u = UPGRADES.find((x) => x.id === id);
      if (!u) return;
      const cost = upgradeCost(u);
      const can = canAfford(cost);
      item.classList.toggle("locked", !can);
      const btn = item.querySelector(".shop-buy");
      if (btn) {
        btn.disabled = !can;
        btn.textContent = formatNum(cost);
      }
      const meta = item.querySelector(".shop-meta");
      if (meta) meta.textContent = `Owned ${ownedCount(u.id)}`;
    });
  }

  function renderShop() {
    if (!shopList || !shopDirty) return;
    shopDirty = false;
    const active = shopCat || "all";
    shopCats?.querySelectorAll("[data-shop-cat]").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.shopCat === active);
    });

    const gearRow = (u) => {
      const n = ownedCount(u.id);
      const cost = upgradeCost(u);
      const can = canAfford(cost);
      return `<div class="shop-item ${can ? "" : "locked"}" role="listitem" data-buy="${u.id}">
        <div>
          <div class="shop-name">${u.name}</div>
          <p class="shop-desc">${u.desc}</p>
          <div class="shop-meta">Owned ${n}</div>
        </div>
        <button type="button" class="shop-buy" data-buy="${u.id}" ${can ? "" : "disabled"}>
          ${formatNum(cost)}
        </button>
      </div>`;
    };

    const cats = SHOP_CATEGORIES.filter((c) => active === "all" || c.id === active);
    shopList.innerHTML = cats
      .map((cat) => {
        const rows = UPGRADES.filter((u) => u.kind === cat.id).map(gearRow).join("");
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

  function renderHud() {
    const layer = layerFor(state.depth);
    const idx = Math.max(0, LAYERS.findIndex((l) => l.id === layer.id));
    if (coinCountEl) coinCountEl.textContent = formatNum(state.coins);
    if (layerLabelEl) {
      layerLabelEl.textContent = layer.name;
      const chipLabel = layerLabelEl.parentElement?.querySelector(".stat-chip-label");
      if (chipLabel) chipLabel.textContent = `Layer ${idx + 1}`;
    }
    if (digPowerLabelEl) {
      const effective = digMetersForCount(1, { usePickPower: true });
      digPowerLabelEl.textContent = `${effective.toFixed(effective % 1 ? 1 : 0)}m`;
    }
    updateAutoMpsLabel();
    if (hudDepthEl) hudDepthEl.textContent = formatDepth(state.depth);
    if (hudLayerEl) hudLayerEl.textContent = `Layer ${idx + 1} · ${layer.name}`;
    if (hudBestEl) {
      hudBestEl.textContent = `${formatDepth(state.bestDepth)} · ${formatBestOre()}`;
    }
    if (overlayBestEl) {
      overlayBestEl.textContent = `${formatDepth(state.bestDepth)} · ${formatBestOre()}`;
    }
    const next = LAYERS[idx + 1];
    if (layerProgressLabelEl) {
      layerProgressLabelEl.textContent = next
        ? `Layer ${idx + 1}: ${layer.name} · ${Math.round(nextLayerProgress(state.depth) * 100)}% to ${next.name}`
        : `Layer ${idx + 1}: ${layer.name} · deepest`;
    }
    if (depthFillEl) depthFillEl.style.width = `${Math.round(nextLayerProgress(state.depth) * 100)}%`;
    updateShaftView(false);
  }

  function render() {
    renderHud();
    renderCart();
    renderShop();
    refreshShopButtons();
  }

  function renderGuide() {
    if (!guideBody) return;
    const layer = layerFor(state.depth);
    const idx = Math.max(0, LAYERS.findIndex((l) => l.id === layer.id));
    const unlocked = ORES.filter((o) => state.depth >= o.minDepth);
    const upcoming = ORES.filter((o) => state.depth < o.minDepth);
    const bestOre = oreById(state.bestOreId);

    guideCats?.querySelectorAll("[data-guide-cat]").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.guideCat === guideCat);
    });

    if (guideLead) {
      if (guideCat === "layers") {
        guideLead.textContent = `You are on layer ${idx + 1} of ${LAYERS.length}: ${layer.name}.`;
      } else if (guideCat === "found") {
        guideLead.textContent = `${unlocked.length} ores unlocked at your depth · best find: ${
          bestOre ? `${bestOre.emoji} ${bestOre.name}` : "—"
        }.`;
      } else {
        guideLead.textContent = `${upcoming.length} ores still deeper than you · next ones listed first.`;
      }
    }

    if (guideCat === "layers") {
      const from = Math.max(0, idx - 4);
      const to = Math.min(LAYERS.length, idx + 12);
      const slice = LAYERS.slice(from, to);
      guideBody.innerHTML =
        `<div class="guide-section-head">Nearby layers</div>` +
        slice
          .map((l, i) => {
            const realIdx = from + i;
            const here = realIdx === idx;
            const span = Number(l.span) || 0;
            return `<div class="guide-row${here ? " is-you" : ""}">
              <span class="guide-swatch" style="background:${l.color}"></span>
              <div>
                <div class="name">${here ? "▶ " : ""}${l.name}</div>
                <div class="meta">Layer ${realIdx + 1} · starts ${formatDepth(l.min)} · ${formatDepth(span)} thick</div>
              </div>
              <strong class="guide-tag">${here ? "You" : realIdx < idx ? "Above" : "Below"}</strong>
            </div>`;
          })
          .join("");
      return;
    }

    if (guideCat === "found") {
      const list = unlocked.slice(-40).reverse();
      if (!list.length) {
        guideBody.innerHTML = `<div class="guide-empty">Dig a little to unlock your first ores.</div>`;
        return;
      }
      guideBody.innerHTML =
        `<div class="guide-section-head">Unlocked ores (newest depth first)</div>` +
        list
          .map((o) => {
            const isBest = bestOre && o.id === bestOre.id;
            return `<div class="guide-row${isBest ? " is-best" : ""}">
              <span class="guide-emoji">${o.emoji}</span>
              <div>
                <div class="name">${o.name}${isBest ? " · best find" : ""}</div>
                <div class="meta">Unlocks from ${formatDepth(o.minDepth)}</div>
              </div>
              <strong class="guide-value">${formatNum(o.value)}</strong>
            </div>`;
          })
          .join("");
      return;
    }

    const list = upcoming.slice(0, 35);
    if (!list.length) {
      guideBody.innerHTML = `<div class="guide-empty">You’ve reached every ore depth.</div>`;
      return;
    }
    guideBody.innerHTML =
      `<div class="guide-section-head">Coming up (need more depth)</div>` +
      list
        .map(
          (o) => `<div class="guide-row is-locked">
            <span class="guide-emoji">${o.emoji}</span>
            <div>
              <div class="name">${o.name}</div>
              <div class="meta">Needs ${formatDepth(o.minDepth)} · ${formatDepth(Math.max(0, o.minDepth - state.depth))} deeper</div>
            </div>
            <strong class="guide-value">${formatNum(o.value)}</strong>
          </div>`
        )
        .join("");
  }

  function tick() {
    const rate = drillRate();
    const now = performance.now();
    // Use real elapsed time so laggy redraws don't make auto dig slower than the m/s label.
    const dtSec = lastAutoTickAt
      ? Math.min(1, Math.max(TICK_MS / 1000, (now - lastAutoTickAt) / 1000))
      : TICK_MS / 1000;
    lastAutoTickAt = now;
    if (rate > 0) {
      const meters = rate * dtSec;
      if (meters > 0) applyDigMeters(meters, "auto");
    } else {
      refreshShopButtons();
      updateAutoMpsLabel();
    }
    if (shopDirty) renderShop();
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
  shopCats?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-shop-cat]");
    if (!btn || !shopCats.contains(btn)) return;
    shopCat = btn.dataset.shopCat || "all";
    shopDirty = true;
    renderShop();
  });
  shopList?.addEventListener("click", (e) => {
    const target = e.target.closest("[data-buy]");
    if (!target || !shopList.contains(target)) return;
    e.preventDefault();
    buyUpgrade(target.getAttribute("data-buy"));
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
  guideCats?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-guide-cat]");
    if (!btn || !guideCats.contains(btn)) return;
    guideCat = btn.dataset.guideCat || "layers";
    renderGuide();
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
