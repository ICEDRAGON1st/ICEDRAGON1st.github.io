(function () {
  const SAVE_KEY = "mine-depth-save-v1";
  const HIGH_SCORE_KEY = "mine-depth-best-v1";
  const BEST_ORE_KEY = "mine-best-ore-v1";
  const BEST_ORE_ID_KEY = "mine-best-ore-id-v1";
  const TICK_MS = 100;
  const CART_MAX = 20;
  const OFFLINE_CAP_MS = 8 * 60 * 60 * 1000;
  const MIN_CLICK_MS = 75;

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
  let lastStrataCenter = -1;
  const BAND_H = 72;
  const VIEW_PAD = 100;
  const STRATA_WINDOW = 14;

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

  function formatNum(n) {
    const x = Number(n) || 0;
    if (x >= 1e18) return (x / 1e18).toFixed(2).replace(/\.?0+$/, "") + "Qi";
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
    const cost = Math.floor(u.baseCost * Math.pow(1.55, n));
    return Number.isFinite(cost) && cost > 0 ? cost : u.baseCost;
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
    if (!strataEl) return;
    const totalH = LAYERS.length * BAND_H + 400;
    if (!strataBuilt) {
      strataBuilt = true;
      strataEl.style.height = `${totalH}px`;
    }
    const layer = layerFor(state.depth);
    const idx = Math.max(0, LAYERS.findIndex((l) => l.id === layer.id));
    if (idx === lastStrataCenter && strataEl.childElementCount) return;
    lastStrataCenter = idx;
    const from = Math.max(0, idx - STRATA_WINDOW);
    const to = Math.min(LAYERS.length - 1, idx + STRATA_WINDOW);
    let html = "";
    for (let i = from; i <= to; i += 1) {
      const band = LAYERS[i];
      html += `<div class="strata-band" style="top:${i * BAND_H}px;height:${BAND_H}px;background:linear-gradient(180deg, ${band.color}cc, ${band.color}88);">${band.name}<span class="strata-depth">#${i + 1} · ${formatDepth(band.min)}+</span></div>`;
    }
    strataEl.innerHTML = html;
  }

  function shaftScrollForDepth(depth) {
    const layer = layerFor(depth);
    const idx = Math.max(0, LAYERS.findIndex((l) => l.id === layer.id));
    const next = LAYERS[idx + 1];
    const span = next ? Math.max(1, next.min - layer.min) : Math.max(1, layer.min * 0.2 || 1e6);
    const prog = Math.min(1, Math.max(0, (depth - layer.min) / span));
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
      surfaceLightEl.style.opacity = String(Math.max(0.04, 0.85 - Math.log10(depth + 10) / 8));
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
    renderHud();
    if (source === "click" || count >= 3) renderCart();
    refreshShopButtons();
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
    if (!Number.isFinite(cost) || state.coins < cost) {
      statusLineEl.textContent = `Need ${formatNum(cost)} coins for ${u.name}`;
      window.HubSound?.play?.("error");
      return false;
    }
    ensureSession();
    state.coins -= cost;
    state.owned[u.id] = ownedCount(u.id) + 1;
    statusLineEl.textContent = `Bought ${u.name} · now ${formatNum(digPower())}m/dig · ${formatNum(drillRate())}/s drills`;
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

  function refreshShopButtons() {
    if (!shopList || shopDirty) return;
    shopList.querySelectorAll(".shop-item").forEach((item) => {
      const id = item.getAttribute("data-buy");
      const u = UPGRADES.find((x) => x.id === id);
      if (!u) return;
      const cost = upgradeCost(u);
      const can = state.coins >= cost;
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
    shopList.innerHTML = UPGRADES.map((u) => {
      const n = ownedCount(u.id);
      const cost = upgradeCost(u);
      const can = state.coins >= cost;
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
    }).join("");
  }

  function renderHud() {
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
    const layerSlice = LAYERS.slice(Math.max(0, idx - 5), Math.min(LAYERS.length, idx + 20));
    const unlocked = ORES.filter((o) => state.depth >= o.minDepth);
    const upcoming = ORES.filter((o) => state.depth < o.minDepth).slice(0, 15);
    const showOres = unlocked.slice(-20).concat(upcoming);
    guideBody.innerHTML =
      `<div class="guide-row"><span></span><div><div class="name">${LAYERS.length} layers · ${ORES.length} ores</div><div class="meta">Showing nearby layers and ores around your depth.</div></div><span></span></div>` +
      layerSlice
        .map(
          (l, i) => {
            const realIdx = Math.max(0, idx - 5) + i;
            return `<div class="guide-row"><span style="width:12px;height:12px;border-radius:50%;background:${l.color}"></span><div><div class="name">${l.name}</div><div class="meta">#${realIdx + 1} · from ${formatDepth(l.min)}</div></div><span></span></div>`;
          }
        )
        .join("") +
      `<div class="guide-row"><span></span><div><div class="name">Ores near you</div><div class="meta">${unlocked.length} unlocked</div></div><span></span></div>` +
      showOres
        .map(
          (o) =>
            `<div class="guide-row"><span>${o.emoji}</span><div><div class="name">${o.name}</div><div class="meta">From ${formatDepth(o.minDepth)}</div></div><strong>${formatNum(o.value)}</strong></div>`
        )
        .join("");
  }

  function tick() {
    const rate = drillRate();
    if (rate > 0) {
      autoAcc += rate * (TICK_MS / 1000);
      const digs = Math.min(40, Math.floor(autoAcc));
      if (digs > 0) {
        autoAcc -= digs;
        doDigBatch(digs, "auto");
      }
    } else {
      refreshShopButtons();
    }
    if (shopDirty) renderShop();
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
