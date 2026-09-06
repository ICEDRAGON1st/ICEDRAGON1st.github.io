(function () {
  const SAVE_KEY = "clicker-save-v3";
  const HIGH_SCORE_KEY = "clicker-high-score-v3";
  const LOCAL_WIPE_ID = "hub-clicker-local-wipe-v2";
  const TICK_MS = 100;
  const MIN_CLICK_MS = 50;
  const REBIRTH_BASE_COST = 3_000_000;

  // Force-clear every local Crystal Clicker key once (leaderboard wipe companion).
  try {
    if (localStorage.getItem(LOCAL_WIPE_ID) !== "done") {
      const doomed = [];
      for (let i = 0; i < localStorage.length; i += 1) {
        const key = localStorage.key(i);
        if (key && /^clicker/i.test(key)) doomed.push(key);
      }
      doomed.forEach((key) => localStorage.removeItem(key));
      localStorage.setItem(LOCAL_WIPE_ID, "done");
    }
  } catch {}

  const UPGRADES = [
    // Click power
    { id: "pickaxe", name: "Pickaxe", desc: "+1 per click", baseCost: 15, clickBonus: 1, cps: 0, group: "click" },
    { id: "gloves", name: "Crystal Gloves", desc: "+5 per click", baseCost: 250, clickBonus: 5, cps: 0, group: "click" },
    { id: "chisel", name: "Prism Chisel", desc: "+12 per click", baseCost: 1200, clickBonus: 12, cps: 0, group: "click" },
    { id: "hammer", name: "Amber Hammer", desc: "+25 per click", baseCost: 5000, clickBonus: 25, cps: 0, group: "click" },
    { id: "spike", name: "Crystal Spike", desc: "+40 per click", baseCost: 18000, clickBonus: 40, cps: 0, group: "click" },
    { id: "gauntlet", name: "Shard Gauntlet", desc: "+60 per click", baseCost: 45000, clickBonus: 60, cps: 0, group: "click" },
    { id: "mace", name: "Ore Mace", desc: "+80 per click", baseCost: 120000, clickBonus: 80, cps: 0, group: "click" },
    { id: "fist", name: "Titan Fist", desc: "+100 per click", baseCost: 250000, clickBonus: 100, cps: 0, group: "click" },
    { id: "blade", name: "Facet Blade", desc: "+150 per click", baseCost: 450000, clickBonus: 150, cps: 0, group: "click" },
    { id: "lance", name: "Gem Lance", desc: "+220 per click", baseCost: 800000, clickBonus: 220, cps: 0, group: "click" },
    { id: "bow", name: "Crystal Bow", desc: "+300 per click", baseCost: 1300000, clickBonus: 300, cps: 0, group: "click" },
    { id: "cannon", name: "Crystal Cannon", desc: "+400 per click", baseCost: 2000000, clickBonus: 400, cps: 0, group: "click" },
    { id: "mortar", name: "Amber Mortar", desc: "+600 per click", baseCost: 4000000, clickBonus: 600, cps: 0, group: "click" },
    { id: "railgun", name: "Amber Railgun", desc: "+900 per click", baseCost: 8000000, clickBonus: 900, cps: 0, group: "click" },
    { id: "beam", name: "Prism Beam", desc: "+1,400 per click", baseCost: 15000000, clickBonus: 1400, cps: 0, group: "click" },
    { id: "comet", name: "Comet Strike", desc: "+2,000 per click", baseCost: 25000000, clickBonus: 2000, cps: 0, group: "click" },
    { id: "meteor", name: "Meteor Tap", desc: "+3,500 per click", baseCost: 45000000, clickBonus: 3500, cps: 0, group: "click" },
    { id: "asteroid", name: "Asteroid Slam", desc: "+5,500 per click", baseCost: 75000000, clickBonus: 5500, cps: 0, group: "click" },
    { id: "nova", name: "Nova Punch", desc: "+8,000 per click", baseCost: 120000000, clickBonus: 8000, cps: 0, group: "click" },
    { id: "supernova", name: "Supernova Hit", desc: "+15,000 per click", baseCost: 250000000, clickBonus: 15000, cps: 0, group: "click" },
    { id: "quasar", name: "Quasar Click", desc: "+25,000 per click", baseCost: 450000000, clickBonus: 25000, cps: 0, group: "click" },
    { id: "bigbang", name: "Big Bang Tap", desc: "+40,000 per click", baseCost: 800000000, clickBonus: 40000, cps: 0, group: "click" },
    { id: "timeline", name: "Timeline Jab", desc: "+75,000 per click", baseCost: 1600000000, clickBonus: 75000, cps: 0, group: "click" },
    { id: "reality", name: "Reality Crack", desc: "+150,000 per click", baseCost: 3500000000, clickBonus: 150000, cps: 0, group: "click" },
    { id: "voidhand", name: "Void Hand", desc: "+300,000 per click", baseCost: 8000000000, clickBonus: 300000, cps: 0, group: "click" },
    { id: "omnitap", name: "Omni Tap", desc: "+750,000 per click", baseCost: 20000000000, clickBonus: 750000, cps: 0, group: "click" },
    { id: "godfinger", name: "God Finger", desc: "+2M per click", baseCost: 60000000000, clickBonus: 2000000, cps: 0, group: "click" },
    { id: "worldender", name: "World Ender", desc: "+8M per click", baseCost: 200000000000, clickBonus: 8000000, cps: 0, group: "click" },
    // Idle income
    { id: "miner", name: "Miner", desc: "+0.5 / sec", baseCost: 50, clickBonus: 0, cps: 0.5, group: "idle" },
    { id: "cart", name: "Mine Cart", desc: "+2 / sec", baseCost: 150, clickBonus: 0, cps: 2, group: "idle" },
    { id: "sieve", name: "Gem Sieve", desc: "+3 / sec", baseCost: 280, clickBonus: 0, cps: 3, group: "idle" },
    { id: "drill", name: "Crystal Drill", desc: "+4 / sec", baseCost: 400, clickBonus: 0, cps: 4, group: "idle" },
    { id: "pump", name: "Amber Pump", desc: "+7 / sec", baseCost: 750, clickBonus: 0, cps: 7, group: "idle" },
    { id: "tunnel", name: "Deep Tunnel", desc: "+10 / sec", baseCost: 1200, clickBonus: 0, cps: 10, group: "idle" },
    { id: "shaft", name: "Mine Shaft", desc: "+15 / sec", baseCost: 2000, clickBonus: 0, cps: 15, group: "idle" },
    { id: "quarry", name: "Quarry", desc: "+20 / sec", baseCost: 3000, clickBonus: 0, cps: 20, group: "idle" },
    { id: "crusher", name: "Ore Crusher", desc: "+35 / sec", baseCost: 5500, clickBonus: 0, cps: 35, group: "idle" },
    { id: "refinery", name: "Gem Refinery", desc: "+50 / sec", baseCost: 8000, clickBonus: 0, cps: 50, group: "idle" },
    { id: "kiln", name: "Crystal Kiln", desc: "+75 / sec", baseCost: 13000, clickBonus: 0, cps: 75, group: "idle" },
    { id: "factory", name: "Gem Factory", desc: "+100 / sec", baseCost: 20000, clickBonus: 0, cps: 100, group: "idle" },
    { id: "assembly", name: "Shard Assembly", desc: "+150 / sec", baseCost: 30000, clickBonus: 0, cps: 150, group: "idle" },
    { id: "pipeline", name: "Amber Pipeline", desc: "+200 / sec", baseCost: 40000, clickBonus: 0, cps: 200, group: "idle" },
    { id: "depot", name: "Crystal Depot", desc: "+275 / sec", baseCost: 55000, clickBonus: 0, cps: 275, group: "idle" },
    { id: "megamine", name: "Mega Mine", desc: "+350 / sec", baseCost: 75000, clickBonus: 0, cps: 350, group: "idle" },
    { id: "complex", name: "Mining Complex", desc: "+500 / sec", baseCost: 110000, clickBonus: 0, cps: 500, group: "idle" },
    { id: "reactor", name: "Amber Reactor", desc: "+750 / sec", baseCost: 150000, clickBonus: 0, cps: 750, group: "idle" },
    { id: "lab", name: "Crystal Lab", desc: "+1,100 / sec", baseCost: 220000, clickBonus: 0, cps: 1100, group: "idle" },
    { id: "foundry", name: "Crystal Foundry", desc: "+1,500 / sec", baseCost: 300000, clickBonus: 0, cps: 1500, group: "idle" },
    { id: "smelter", name: "Prism Smelter", desc: "+2,000 / sec", baseCost: 400000, clickBonus: 0, cps: 2000, group: "idle" },
    { id: "vault", name: "Crystal Vault", desc: "+2,500 / sec", baseCost: 500000, clickBonus: 0, cps: 2500, group: "idle" },
    { id: "bank", name: "Gem Bank", desc: "+4,000 / sec", baseCost: 800000, clickBonus: 0, cps: 4000, group: "idle" },
    { id: "city", name: "Gem City", desc: "+6,000 / sec", baseCost: 1200000, clickBonus: 0, cps: 6000, group: "idle" },
    { id: "metropolis", name: "Crystal Metropolis", desc: "+9,000 / sec", baseCost: 1800000, clickBonus: 0, cps: 9000, group: "idle" },
    { id: "fortress", name: "Ore Fortress", desc: "+12,000 / sec", baseCost: 2500000, clickBonus: 0, cps: 12000, group: "idle" },
    { id: "citadel", name: "Amber Citadel", desc: "+20,000 / sec", baseCost: 4200000, clickBonus: 0, cps: 20000, group: "idle" },
    { id: "orbital", name: "Orbital Laser", desc: "+35,000 / sec", baseCost: 7000000, clickBonus: 0, cps: 35000, group: "idle" },
    { id: "satnet", name: "Satellite Net", desc: "+50,000 / sec", baseCost: 10000000, clickBonus: 0, cps: 50000, group: "idle" },
    { id: "nebula", name: "Nebula Drill", desc: "+75,000 / sec", baseCost: 15000000, clickBonus: 0, cps: 75000, group: "idle" },
    { id: "galaxy", name: "Galaxy Bore", desc: "+120,000 / sec", baseCost: 25000000, clickBonus: 0, cps: 120000, group: "idle" },
    { id: "dyson", name: "Dyson Mine", desc: "+200,000 / sec", baseCost: 40000000, clickBonus: 0, cps: 200000, group: "idle" },
    { id: "cluster", name: "Star Cluster", desc: "+350,000 / sec", baseCost: 70000000, clickBonus: 0, cps: 350000, group: "idle" },
    { id: "singularity", name: "Singularity Core", desc: "+500,000 / sec", baseCost: 100000000, clickBonus: 0, cps: 500000, group: "idle" },
    { id: "blackhole", name: "Black Hole Siphon", desc: "+750,000 / sec", baseCost: 150000000, clickBonus: 0, cps: 750000, group: "idle" },
    { id: "wormhole", name: "Wormhole Quarry", desc: "+1M / sec", baseCost: 220000000, clickBonus: 0, cps: 1000000, group: "idle" },
    { id: "hyperspace", name: "Hyperspace Rig", desc: "+1.5M / sec", baseCost: 350000000, clickBonus: 0, cps: 1500000, group: "idle" },
    { id: "multiverse", name: "Multiverse Pick", desc: "+2M / sec", baseCost: 500000000, clickBonus: 0, cps: 2000000, group: "idle" },
    { id: "parallel", name: "Parallel Mines", desc: "+3.5M / sec", baseCost: 800000000, clickBonus: 0, cps: 3500000, group: "idle" },
    { id: "timeloop", name: "Time Loop Mine", desc: "+5M / sec", baseCost: 1200000000, clickBonus: 0, cps: 5000000, group: "idle" },
    { id: "chronos", name: "Chronos Drill", desc: "+7.5M / sec", baseCost: 1800000000, clickBonus: 0, cps: 7500000, group: "idle" },
    { id: "infinity", name: "Infinity Vein", desc: "+10M / sec", baseCost: 2500000000, clickBonus: 0, cps: 10000000, group: "idle" },
    { id: "eternity", name: "Eternity Shaft", desc: "+15M / sec", baseCost: 4000000000, clickBonus: 0, cps: 15000000, group: "idle" },
    { id: "omni", name: "Omni Extractor", desc: "+25M / sec", baseCost: 6000000000, clickBonus: 0, cps: 25000000, group: "idle" },
    { id: "cosmos", name: "Cosmos Harvester", desc: "+50M / sec", baseCost: 12000000000, clickBonus: 0, cps: 50000000, group: "idle" },
    { id: "absolute", name: "Absolute Crystal", desc: "+100M / sec", baseCost: 20000000000, clickBonus: 0, cps: 100000000, group: "idle" },
    { id: "prime", name: "Prime Reality", desc: "+250M / sec", baseCost: 50000000000, clickBonus: 0, cps: 250000000, group: "idle" },
    { id: "apex", name: "Apex Engine", desc: "+500M / sec", baseCost: 100000000000, clickBonus: 0, cps: 500000000, group: "idle" },
    { id: "zenith", name: "Zenith Forge", desc: "+1B / sec", baseCost: 220000000000, clickBonus: 0, cps: 1000000000, group: "idle" },
    { id: "ultimate", name: "Ultimate Vein", desc: "+2.5B / sec", baseCost: 500000000000, clickBonus: 0, cps: 2500000000, group: "idle" },
    { id: "finality", name: "Finality Core", desc: "+10B / sec", baseCost: 2000000000000, clickBonus: 0, cps: 10000000000, group: "idle" }
  ];

  const SHOP_GROUPS = [
    { id: "click", title: "Click power", blurb: "Stronger taps" },
    { id: "idle", title: "Idle income", blurb: "Crystals while AFK" }
  ];

  const crystalCountEl = document.getElementById("crystal-count");
  const cpsLabelEl = document.getElementById("cps-label");
  const hudCpsEl = document.getElementById("hud-cps");
  const hudBestEl = document.getElementById("hud-best");
  const hudMultEl = document.getElementById("hud-mult");
  const multLabelEl = document.getElementById("mult-label");
  const clickPowerEl = document.getElementById("click-power-label");
  const overlayBestEl = document.getElementById("overlay-best");
  const crystalBtn = document.getElementById("crystal-btn");
  const shopList = document.getElementById("shop-list");
  const overlay = document.getElementById("overlay");
  const startBtn = document.getElementById("start-btn");
  const gamesBtn = document.getElementById("games-btn");
  const menuBtn = document.getElementById("menu-btn");
  const rebirthBtn = document.getElementById("rebirth-btn");
  const rebirthDesc = document.getElementById("rebirth-desc");
  const rebirthMultEl = document.getElementById("rebirth-mult");
  const floatLayer = document.getElementById("float-layer");

  let state = defaultState();
  let sessionStarted = false;
  let lastSaveAt = 0;
  let lastSubmitAt = 0;
  let lastClickAt = 0;

  function defaultState() {
    const owned = {};
    UPGRADES.forEach((u) => {
      owned[u.id] = 0;
    });
    return {
      crystals: 0,
      lifetime: 0,
      clickPower: 1,
      rebirths: 0,
      owned
    };
  }

  function multiplier() {
    return Math.pow(2, Math.max(0, Math.floor(state.rebirths || 0)));
  }

  function loadState() {
    try {
      const raw = JSON.parse(localStorage.getItem(SAVE_KEY) || "null");
      if (!raw || typeof raw !== "object") return defaultState();
      const next = defaultState();
      next.crystals = Math.max(0, Number(raw.crystals) || 0);
      next.lifetime = Math.max(0, Number(raw.lifetime) || 0);
      next.rebirths = Math.max(0, Math.floor(Number(raw.rebirths) || 0));
      next.clickPower = Math.max(1, Number(raw.clickPower) || 1);
      UPGRADES.forEach((u) => {
        next.owned[u.id] = Math.max(0, Math.floor(Number(raw.owned?.[u.id]) || 0));
      });
      next.clickPower =
        1 +
        UPGRADES.reduce((sum, u) => sum + (u.clickBonus || 0) * (next.owned[u.id] || 0), 0);
      return next;
    } catch {
      return defaultState();
    }
  }

  function saveState() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(state));
      const best = Math.max(getStoredBest(), Math.floor(state.lifetime));
      localStorage.setItem(HIGH_SCORE_KEY, String(best));
    } catch {}
  }

  function getStoredBest() {
    return Math.max(0, Math.floor(Number(localStorage.getItem(HIGH_SCORE_KEY)) || 0));
  }

  const SUFFIXES = ["", "K", "M", "B", "T", "Qa", "Qi", "Sx", "Sp", "Oc", "No", "Dc"];

  function formatNum(n) {
    let v = Number(n) || 0;
    if (!Number.isFinite(v)) return "0";
    const neg = v < 0;
    v = Math.abs(v);
    if (v < 1000) {
      const plain = v >= 100 ? String(Math.floor(v)) : v % 1 === 0 ? String(Math.floor(v)) : v.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
      return neg ? `-${plain}` : plain;
    }
    let tier = 0;
    while (v >= 1000 && tier < SUFFIXES.length - 1) {
      v /= 1000;
      tier += 1;
    }
    let digits;
    if (v >= 100) digits = 0;
    else if (v >= 10) digits = 1;
    else digits = 2;
    let text = v.toFixed(digits);
    text = text.replace(/\.0+$/, "").replace(/(\.\d*[1-9])0+$/, "$1");
    return `${neg ? "-" : ""}${text}${SUFFIXES[tier]}`;
  }

  function formatCps(n) {
    const v = Number(n) || 0;
    if (v >= 1000) return formatNum(v);
    if (v >= 10) return v.toFixed(1).replace(/\.0$/, "");
    if (v >= 1) return v.toFixed(1);
    return v.toFixed(2).replace(/0+$/, "").replace(/\.$/, "") || "0";
  }

  function upgradeCost(upgrade, owned) {
    return Math.floor(upgrade.baseCost * Math.pow(1.15, owned));
  }

  function baseCps() {
    return UPGRADES.reduce((sum, u) => sum + (u.cps || 0) * (state.owned[u.id] || 0), 0);
  }

  function totalCps() {
    return baseCps() * multiplier();
  }

  function clickGain() {
    return state.clickPower * multiplier();
  }

  function addCrystals(amount) {
    if (amount <= 0) return;
    state.crystals += amount;
    state.lifetime += amount;
    maybeSubmitBest();
    checkAchievements();
  }

  function maybeSubmitBest(force = false) {
    const best = Math.floor(state.lifetime);
    if (best <= 0) return;
    const stored = getStoredBest();
    if (best > stored) {
      try {
        localStorage.setItem(HIGH_SCORE_KEY, String(best));
      } catch {}
    }
    const now = Date.now();
    if (!force && now - lastSubmitAt < 4000) return;
    if (best > 0 && window.HubLeaderboard) {
      lastSubmitAt = now;
      HubLeaderboard.submit("clicker", best).catch?.(() => {});
    }
  }

  function checkAchievements() {
    if (!window.HubAchievements) return;
    const life = state.lifetime;
    const cps = totalCps();
    if (life >= 100) HubAchievements.unlock("clicker_100");
    if (life >= 1000) HubAchievements.unlock("clicker_1k");
    if (life >= 100000) HubAchievements.unlock("clicker_100k");
    if (life >= 1000000) HubAchievements.unlock("clicker_1m");
    if (cps >= 10) HubAchievements.unlock("clicker_cps_10");
    if (cps >= 100) HubAchievements.unlock("clicker_cps_100");
    if (state.rebirths >= 1) HubAchievements.unlock("clicker_rebirth_1");
    if (state.rebirths >= 3) HubAchievements.unlock("clicker_rebirth_3");
  }

  function ensureSession() {
    if (sessionStarted) return;
    sessionStarted = true;
    if (window.HubStreak) HubStreak.recordPlay();
    if (window.HubPlays) HubPlays.record("clicker");
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

  function clickCrystal(evt) {
    const now = Date.now();
    if (now - lastClickAt < MIN_CLICK_MS) return;
    lastClickAt = now;
    ensureSession();
    const gain = clickGain();
    addCrystals(gain);
    window.HubSound?.play?.("click");
    crystalBtn.classList.add("is-pulse");
    setTimeout(() => crystalBtn.classList.remove("is-pulse"), 90);
    const rect = crystalBtn.getBoundingClientRect();
    const x =
      (evt?.clientX ?? rect.left + rect.width / 2) + (Math.random() * 24 - 12);
    const y = (evt?.clientY ?? rect.top + rect.height / 2) - 8;
    spawnFloat(x, y, `+${formatNum(gain)}`);
    render(false);
    saveSoon();
  }

  function buyUpgrade(id) {
    const upgrade = UPGRADES.find((u) => u.id === id);
    if (!upgrade) return;
    const owned = state.owned[id] || 0;
    const cost = upgradeCost(upgrade, owned);
    if (state.crystals < cost) return;
    ensureSession();
    state.crystals -= cost;
    state.owned[id] = owned + 1;
    if (upgrade.clickBonus) state.clickPower += upgrade.clickBonus;
    window.HubSound?.play?.("click");
    if (state.owned[id] === 1 && upgrade.cps >= 20) {
      window.HubConfetti?.burst?.();
    }
    checkAchievements();
    render(false);
    saveSoon();
  }

  function rebirthCost() {
    // 1st = 3M, 2nd = 30M, 3rd = 300M, …
    return Math.floor(REBIRTH_BASE_COST * Math.pow(10, Math.max(0, Math.floor(state.rebirths || 0))));
  }

  function canRebirth() {
    return state.crystals >= rebirthCost();
  }

  function doRebirth() {
    const cost = rebirthCost();
    if (state.crystals < cost) return;
    const nextMult = multiplier() * 2;
    if (
      !confirm(
        `Rebirth for ${formatNum(cost)} crystals?\n\nBank and upgrades reset. Lifetime crystals stay. Earnings become ×${nextMult}.`
      )
    ) {
      return;
    }
    ensureSession();
    const lifetime = state.lifetime;
    const rebirths = (state.rebirths || 0) + 1;
    state = defaultState();
    state.lifetime = lifetime;
    state.rebirths = rebirths;
    window.HubSound?.play?.("win");
    window.HubConfetti?.burst?.();
    checkAchievements();
    maybeSubmitBest(true);
    saveState();
    render();
  }

  function shopItemHtml(u) {
    const owned = state.owned[u.id] || 0;
    const cost = upgradeCost(u, owned);
    const canBuy = state.crystals >= cost;
    return `<div class="shop-item" role="listitem" data-group="${u.group}">
      <div class="shop-item-main">
        <div class="shop-item-name">${u.name}</div>
        <p class="shop-item-desc">${u.desc}</p>
        <div class="shop-item-owned">Owned: ${owned}</div>
      </div>
      <button type="button" class="buy-btn" data-buy="${u.id}" ${canBuy ? "" : "disabled"}>
        ${formatNum(cost)}
      </button>
    </div>`;
  }

  function renderShop() {
    if (!shopList) return;
    shopList.innerHTML = SHOP_GROUPS.map((group) => {
      const items = UPGRADES.filter((u) => u.group === group.id).sort(
        (a, b) => a.baseCost - b.baseCost
      );
      return `<section class="shop-section" data-section="${group.id}">
        <header class="shop-section-head">
          <h3>${group.title}</h3>
          <span>${group.blurb}</span>
        </header>
        <div class="shop-section-items">${items.map(shopItemHtml).join("")}</div>
      </section>`;
    }).join("");
  }

  /** Update buy buttons without rebuilding DOM (ticks were wiping clicks). */
  function refreshShopButtons() {
    if (!shopList) return;
    shopList.querySelectorAll("[data-buy]").forEach((btn) => {
      const id = btn.dataset.buy;
      const upgrade = UPGRADES.find((u) => u.id === id);
      if (!upgrade) return;
      const owned = state.owned[id] || 0;
      const cost = upgradeCost(upgrade, owned);
      btn.textContent = formatNum(cost);
      btn.disabled = state.crystals < cost;
      const ownedEl = btn.closest(".shop-item")?.querySelector(".shop-item-owned");
      if (ownedEl) ownedEl.textContent = `Owned: ${owned}`;
    });
  }

  function renderRebirth() {
    const mult = multiplier();
    const nextMult = mult * 2;
    const cost = rebirthCost();
    const ready = state.crystals >= cost;
    if (rebirthMultEl) {
      const rebirthLabel =
        state.rebirths > 0 ? `Rebirths: ${state.rebirths} · ` : "";
      rebirthMultEl.textContent = `${rebirthLabel}Now ×${mult} → after ×${nextMult}`;
    }
    if (rebirthDesc) {
      rebirthDesc.textContent = ready
        ? `Ready! Reset bank & upgrades, keep lifetime. Multiplier becomes ×${nextMult}.`
        : `Need ${formatNum(cost)} crystals. Resets upgrades & bank, keeps lifetime. Next multi: ×${nextMult}.`;
    }
    if (rebirthBtn) {
      rebirthBtn.disabled = !ready;
      rebirthBtn.textContent = ready
        ? `Rebirth → ×${nextMult}`
        : `Rebirth to ×${nextMult} (${formatNum(state.crystals)} / ${formatNum(cost)})`;
    }
  }

  function renderStats() {
    const cps = totalCps();
    const mult = multiplier();
    const best = Math.max(getStoredBest(), Math.floor(state.lifetime));
    if (crystalCountEl) crystalCountEl.textContent = formatNum(state.crystals);
    if (cpsLabelEl) cpsLabelEl.textContent = formatCps(cps);
    if (hudCpsEl) hudCpsEl.textContent = formatCps(cps);
    if (hudBestEl) hudBestEl.textContent = formatNum(best);
    if (hudMultEl) hudMultEl.textContent = String(mult);
    if (multLabelEl) multLabelEl.textContent = `×${mult}`;
    if (clickPowerEl) clickPowerEl.textContent = `+${formatNum(clickGain())}`;
    if (overlayBestEl) overlayBestEl.textContent = formatNum(best);
    refreshShopButtons();
    renderRebirth();
  }

  function render(fullShop = true) {
    renderStats();
    if (fullShop) renderShop();
  }

  function saveSoon() {
    const now = Date.now();
    if (now - lastSaveAt < 800) return;
    lastSaveAt = now;
    saveState();
  }

  function tick() {
    const cps = totalCps();
    if (cps > 0) {
      addCrystals(cps * (TICK_MS / 1000));
      renderStats();
      saveSoon();
    }
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

  function goToGames() {
    saveState();
    maybeSubmitBest(true);
    window.location.href = "../index.html#games";
  }

  crystalBtn?.addEventListener("click", clickCrystal);
  shopList?.addEventListener("pointerdown", (e) => {
    const btn = e.target.closest("[data-buy]");
    if (!btn || btn.disabled) return;
    e.preventDefault();
    buyUpgrade(btn.dataset.buy);
  });
  startBtn?.addEventListener("click", closeMenu);
  menuBtn?.addEventListener("click", openMenu);
  gamesBtn?.addEventListener("click", goToGames);
  rebirthBtn?.addEventListener("click", doRebirth);

  state = loadState();
  render();
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
