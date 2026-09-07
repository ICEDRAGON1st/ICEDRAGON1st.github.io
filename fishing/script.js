(function () {
  const SAVE_KEY = "fishing-save-v1";
  const HIGH_SCORE_KEY = "fishing-high-score-v1";
  const TICK_MS = 100;
  const MIN_CAST_MS = 50;
  const VOYAGE_BASE_COST = 500_000;

  const CATCH_NAMES = [
    "Minnow",
    "Perch",
    "Trout",
    "Bass",
    "Salmon",
    "Tuna",
    "Marlin",
    "Legendary catch"
  ];

  const BASE_UPGRADES = [
    // Cast power (rods / bait)
    { id: "bamboo", name: "Bamboo Rod", desc: "+1 per cast", baseCost: 15, castBonus: 1, fps: 0, group: "cast" },
    { id: "worm", name: "Worm Bait", desc: "+2 per cast", baseCost: 80, castBonus: 2, fps: 0, group: "cast" },
    { id: "spin", name: "Spinner Lure", desc: "+5 per cast", baseCost: 250, castBonus: 5, fps: 0, group: "cast" },
    { id: "graphite", name: "Graphite Rod", desc: "+10 per cast", baseCost: 800, castBonus: 10, fps: 0, group: "cast" },
    { id: "fly", name: "Fly Kit", desc: "+18 per cast", baseCost: 2500, castBonus: 18, fps: 0, group: "cast" },
    { id: "braid", name: "Braided Line", desc: "+30 per cast", baseCost: 7000, castBonus: 30, fps: 0, group: "cast" },
    { id: "carbon", name: "Carbon Rod", desc: "+50 per cast", baseCost: 18000, castBonus: 50, fps: 0, group: "cast" },
    { id: "deep", name: "Deep Drop Rig", desc: "+80 per cast", baseCost: 45000, castBonus: 80, fps: 0, group: "cast" },
    { id: "harpoon", name: "Harpoon Tip", desc: "+120 per cast", baseCost: 100000, castBonus: 120, fps: 0, group: "cast" },
    { id: "sonar", name: "Hand Sonar", desc: "+180 per cast", baseCost: 220000, castBonus: 180, fps: 0, group: "cast" },
    { id: "mythrod", name: "Mythic Rod", desc: "+300 per cast", baseCost: 500000, castBonus: 300, fps: 0, group: "cast" },
    { id: "tidehook", name: "Tide Hook", desc: "+500 per cast", baseCost: 1200000, castBonus: 500, fps: 0, group: "cast" },
    { id: "stormline", name: "Storm Line", desc: "+800 per cast", baseCost: 3000000, castBonus: 800, fps: 0, group: "cast" },
    { id: "leviathan", name: "Leviathan Reel", desc: "+1,500 per cast", baseCost: 8000000, castBonus: 1500, fps: 0, group: "cast" },
    { id: "abyssrod", name: "Abyss Rod", desc: "+3,000 per cast", baseCost: 20000000, castBonus: 3000, fps: 0, group: "cast" },
    { id: "kraken", name: "Kraken Grip", desc: "+6,000 per cast", baseCost: 50000000, castBonus: 6000, fps: 0, group: "cast" },
    { id: "neptune", name: "Neptune Cast", desc: "+12,000 per cast", baseCost: 120000000, castBonus: 12000, fps: 0, group: "cast" },
    { id: "trident", name: "Trident Strike", desc: "+25,000 per cast", baseCost: 300000000, castBonus: 25000, fps: 0, group: "cast" },
    { id: "maelstrom", name: "Maelstrom Rod", desc: "+50,000 per cast", baseCost: 800000000, castBonus: 50000, fps: 0, group: "cast" },
    { id: "godcast", name: "God Cast", desc: "+120,000 per cast", baseCost: 2500000000, castBonus: 120000, fps: 0, group: "cast" },

    // Idle (boats / crew)
    { id: "bucket", name: "Bait Bucket", desc: "+0.2 fish/sec", baseCost: 40, castBonus: 0, fps: 0.2, group: "idle" },
    { id: "canoe", name: "Canoe", desc: "+1 fish/sec", baseCost: 200, castBonus: 0, fps: 1, group: "idle" },
    { id: "net", name: "Cast Net", desc: "+3 fish/sec", baseCost: 900, castBonus: 0, fps: 3, group: "idle" },
    { id: "skiff", name: "Skiff", desc: "+8 fish/sec", baseCost: 3500, castBonus: 0, fps: 8, group: "idle" },
    { id: "deckhand", name: "Deckhand", desc: "+15 fish/sec", baseCost: 10000, castBonus: 0, fps: 15, group: "idle" },
    { id: "trawler", name: "Trawler", desc: "+35 fish/sec", baseCost: 35000, castBonus: 0, fps: 35, group: "idle" },
    { id: "crew", name: "Dock Crew", desc: "+70 fish/sec", baseCost: 90000, castBonus: 0, fps: 70, group: "idle" },
    { id: "longliner", name: "Longliner", desc: "+150 fish/sec", baseCost: 250000, castBonus: 0, fps: 150, group: "idle" },
    { id: "factory", name: "Factory Boat", desc: "+350 fish/sec", baseCost: 700000, castBonus: 0, fps: 350, group: "idle" },
    { id: "fleet", name: "Harbor Fleet", desc: "+800 fish/sec", baseCost: 2000000, castBonus: 0, fps: 800, group: "idle" },
    { id: "pier", name: "Mega Pier", desc: "+1,800 fish/sec", baseCost: 5500000, castBonus: 0, fps: 1800, group: "idle" },
    { id: "cannery", name: "Cannery", desc: "+4,000 fish/sec", baseCost: 15000000, castBonus: 0, fps: 4000, group: "idle" },
    { id: "armada", name: "Armada", desc: "+10,000 fish/sec", baseCost: 45000000, castBonus: 0, fps: 10000, group: "idle" },
    { id: "sub", name: "Deep Sub", desc: "+25,000 fish/sec", baseCost: 120000000, castBonus: 0, fps: 25000, group: "idle" },
    { id: "oilrig", name: "Ocean Rig", desc: "+60,000 fish/sec", baseCost: 350000000, castBonus: 0, fps: 60000, group: "idle" },
    { id: "citydock", name: "City Dock", desc: "+150,000 fish/sec", baseCost: 1000000000, castBonus: 0, fps: 150000, group: "idle" },
    { id: "continent", name: "Coast Empire", desc: "+400,000 fish/sec", baseCost: 3500000000, castBonus: 0, fps: 400000, group: "idle" },
    { id: "worldnet", name: "World Net", desc: "+1M fish/sec", baseCost: 12000000000, castBonus: 0, fps: 1000000, group: "idle" },
    { id: "orbit", name: "Orbital Fishery", desc: "+3M fish/sec", baseCost: 40000000000, castBonus: 0, fps: 3000000, group: "idle" },
    { id: "infinitynet", name: "Infinity Net", desc: "+10M fish/sec", baseCost: 150000000000, castBonus: 0, fps: 10000000, group: "idle" }
  ];

  function buildExtraUpgrades(count) {
    const extras = [];
    let castCost = 5e9;
    let castBonus = 250000;
    let idleCost = 4e11;
    let idleFps = 2.5e7;
    for (let i = 1; i <= count; i += 1) {
      extras.push({
        id: `cast_x${i}`,
        name: `Master Cast ${i}`,
        desc: `+${formatPlain(castBonus)} per cast`,
        baseCost: Math.floor(castCost),
        castBonus,
        fps: 0,
        group: "cast"
      });
      extras.push({
        id: `idle_x${i}`,
        name: `Auto Fleet ${i}`,
        desc: `+${formatPlain(idleFps)} fish/sec`,
        baseCost: Math.floor(idleCost),
        castBonus: 0,
        fps: idleFps,
        group: "idle"
      });
      castCost *= 2.4;
      castBonus = Math.floor(castBonus * 1.85);
      idleCost *= 2.5;
      idleFps = Math.floor(idleFps * 1.9);
    }
    return extras;
  }

  function formatPlain(n) {
    if (n >= 1e12) return `${(n / 1e12).toFixed(1).replace(/\.0$/, "")}T`;
    if (n >= 1e9) return `${(n / 1e9).toFixed(1).replace(/\.0$/, "")}B`;
    if (n >= 1e6) return `${(n / 1e6).toFixed(1).replace(/\.0$/, "")}M`;
    if (n >= 1e3) return `${(n / 1e3).toFixed(1).replace(/\.0$/, "")}K`;
    return String(Math.floor(n));
  }

  const UPGRADES = BASE_UPGRADES.concat(buildExtraUpgrades(40));
  const SHOP_GROUPS = [
    { id: "cast", title: "Rods & bait", blurb: "Bigger casts" },
    { id: "idle", title: "Boats & crew", blurb: "Idle fish/sec" }
  ];

  const coinCountEl = document.getElementById("coin-count");
  const castPowerEl = document.getElementById("cast-power-label");
  const fpsLabelEl = document.getElementById("fps-label");
  const multLabelEl = document.getElementById("mult-label");
  const hudMultEl = document.getElementById("hud-mult");
  const hudFpsEl = document.getElementById("hud-fps");
  const hudBestEl = document.getElementById("hud-best");
  const castBtn = document.getElementById("cast-btn");
  const catchLineEl = document.getElementById("catch-line");
  const shopList = document.getElementById("shop-list");
  const overlay = document.getElementById("overlay");
  const overlayBestEl = document.getElementById("overlay-best");
  const startBtn = document.getElementById("start-btn");
  const gamesBtn = document.getElementById("games-btn");
  const menuBtn = document.getElementById("menu-btn");
  const voyageBtn = document.getElementById("voyage-btn");
  const voyageDesc = document.getElementById("voyage-desc");
  const voyageMultEl = document.getElementById("voyage-mult");
  const floatLayer = document.getElementById("float-layer");

  let state = defaultState();
  let sessionStarted = false;
  let lastSaveAt = 0;
  let lastSubmitAt = 0;
  let lastCastAt = 0;

  function defaultState() {
    const owned = {};
    UPGRADES.forEach((u) => {
      owned[u.id] = 0;
    });
    return {
      coins: 0,
      lifetime: 0,
      castPower: 1,
      voyages: 0,
      owned,
      lastTick: Date.now()
    };
  }

  function multiplier() {
    return Math.pow(2, Math.max(0, Math.floor(state.voyages || 0)));
  }

  function loadState() {
    try {
      const raw = JSON.parse(localStorage.getItem(SAVE_KEY) || "null");
      if (!raw || typeof raw !== "object") return defaultState();
      const next = defaultState();
      next.coins = Math.max(0, Number(raw.coins) || 0);
      next.lifetime = Math.max(0, Number(raw.lifetime) || 0);
      next.voyages = Math.max(0, Math.floor(Number(raw.voyages) || 0));
      next.lastTick = Math.max(0, Number(raw.lastTick) || Date.now());
      UPGRADES.forEach((u) => {
        next.owned[u.id] = Math.max(0, Math.floor(Number(raw.owned?.[u.id]) || 0));
      });
      next.castPower =
        1 +
        UPGRADES.reduce((sum, u) => sum + (u.castBonus || 0) * (next.owned[u.id] || 0), 0);
      return next;
    } catch {
      return defaultState();
    }
  }

  function saveState() {
    try {
      state.lastTick = Date.now();
      localStorage.setItem(SAVE_KEY, JSON.stringify(state));
      const best = Math.max(getStoredBest(), Math.floor(state.lifetime));
      localStorage.setItem(HIGH_SCORE_KEY, String(best));
    } catch {}
  }

  function getStoredBest() {
    return Math.max(0, Math.floor(Number(localStorage.getItem(HIGH_SCORE_KEY)) || 0));
  }

  const SUFFIXES = [
    "", "K", "M", "B", "T", "Qa", "Qi", "Sx", "Sp", "Oc", "No", "Dc",
    "UDc", "DDc", "TDc", "QaDc", "QiDc", "SxDc", "SpDc", "OcDc", "NoDc", "Vg",
    "UVg", "DVg", "TVg", "QaVg", "QiVg", "SxVg", "SpVg", "OcVg", "NoVg", "Tg",
    "UTg", "DTg", "TTg", "QaTg", "QiTg", "SxTg", "SpTg", "OcTg", "NoTg", "Qag",
    "UQag", "DQag", "TQag", "QaQag", "QiQag", "SxQag", "SpQag", "OcQag", "NoQag", "Qig",
    "UQig", "DQig", "TQig", "QaQig", "QiQig", "SxQig", "SpQig", "OcQig", "NoQig", "Sxg",
    "USxg", "DSxg", "TSxg", "QaSxg", "QiSxg", "SxSxg", "SpSxg", "OcSxg", "NoSxg", "Spg",
    "USpg", "DSpg", "TSpg", "QaSpg", "QiSpg", "SxSpg", "SpSpg", "OcSpg", "NoSpg", "Ocg",
    "UOcg", "DOcg", "TOcg", "QaOcg", "QiOcg", "SxOcg", "SpOcg", "OcOcg", "NoOcg", "Nog",
    "UNog", "DNog", "TNog", "QaNog", "QiNog", "SxNog", "SpNog", "OcNog", "NoNog", "C"
  ];

  function formatNum(n) {
    let v = Number(n) || 0;
    if (!Number.isFinite(v)) return v > 0 ? "∞" : v < 0 ? "-∞" : "0";
    const neg = v < 0;
    v = Math.abs(v);
    if (v < 1000) {
      const plain =
        v >= 100
          ? String(Math.floor(v))
          : v % 1 === 0
            ? String(Math.floor(v))
            : v.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
      return neg ? `-${plain}` : plain;
    }
    let tier = 0;
    while (v >= 1000 && tier < SUFFIXES.length - 1) {
      v /= 1000;
      tier += 1;
    }
    if (v >= 1000) {
      const sci = (Math.abs(Number(n)) || 0).toExponential(2).replace("+", "");
      return neg ? `-${sci}` : sci;
    }
    let digits;
    if (v >= 100) digits = 0;
    else if (v >= 10) digits = 1;
    else digits = 2;
    let text = v.toFixed(digits);
    text = text.replace(/\.0+$/, "").replace(/(\.\d*[1-9])0+$/, "$1");
    return `${neg ? "-" : ""}${text}${SUFFIXES[tier]}`;
  }

  function formatFps(n) {
    const v = Number(n) || 0;
    if (v >= 1000) return formatNum(v);
    if (v >= 10) return v.toFixed(1).replace(/\.0$/, "");
    if (v >= 1) return v.toFixed(1);
    return v.toFixed(2).replace(/0+$/, "").replace(/\.$/, "") || "0";
  }

  function upgradeCost(upgrade, owned) {
    return Math.floor(upgrade.baseCost * Math.pow(1.15, owned));
  }

  function baseFps() {
    return UPGRADES.reduce((sum, u) => sum + (u.fps || 0) * (state.owned[u.id] || 0), 0);
  }

  function totalFps() {
    return baseFps() * multiplier();
  }

  function castGain() {
    return state.castPower * multiplier();
  }

  function addCoins(amount) {
    if (amount <= 0) return;
    state.coins += amount;
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
      HubLeaderboard.submit("fishing", best).catch?.(() => {});
    }
  }

  function checkAchievements() {
    if (!window.HubAchievements) return;
    const life = state.lifetime;
    const fps = totalFps();
    if (life >= 100) HubAchievements.unlock("fishing_100");
    if (life >= 1000) HubAchievements.unlock("fishing_1k");
    if (life >= 100000) HubAchievements.unlock("fishing_100k");
    if (life >= 1000000) HubAchievements.unlock("fishing_1m");
    if (fps >= 10) HubAchievements.unlock("fishing_fps_10");
    if (fps >= 100) HubAchievements.unlock("fishing_fps_100");
    if (state.voyages >= 1) HubAchievements.unlock("fishing_voyage_1");
  }

  function ensureSession() {
    if (sessionStarted) return;
    sessionStarted = true;
    if (window.HubStreak) HubStreak.recordPlay();
    if (window.HubPlays) HubPlays.record("fishing");
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

  function pickCatchName(gain) {
    const g = Number(gain) || 0;
    if (g >= 100000) return CATCH_NAMES[7];
    if (g >= 10000) return CATCH_NAMES[6];
    if (g >= 1000) return CATCH_NAMES[5];
    if (g >= 200) return CATCH_NAMES[4];
    if (g >= 50) return CATCH_NAMES[3];
    if (g >= 15) return CATCH_NAMES[2];
    if (g >= 5) return CATCH_NAMES[1];
    return CATCH_NAMES[0];
  }

  function doCast(evt) {
    const now = Date.now();
    if (now - lastCastAt < MIN_CAST_MS) return;
    lastCastAt = now;
    ensureSession();
    const gain = castGain();
    addCoins(gain);
    window.HubSound?.play?.("click");
    castBtn.classList.add("is-pulse");
    setTimeout(() => castBtn.classList.remove("is-pulse"), 90);
    if (catchLineEl) {
      catchLineEl.textContent = `Caught a ${pickCatchName(gain)} · +${formatNum(gain)}`;
    }
    const rect = castBtn.getBoundingClientRect();
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
    if (state.coins < cost) return;
    ensureSession();
    state.coins -= cost;
    state.owned[id] = owned + 1;
    if (upgrade.castBonus) state.castPower += upgrade.castBonus;
    window.HubSound?.play?.("click");
    if (state.owned[id] === 1 && upgrade.fps >= 70) {
      window.HubConfetti?.burst?.();
    }
    checkAchievements();
    render(false);
    saveSoon();
  }

  function voyageCost() {
    const v = Math.max(0, Math.floor(state.voyages || 0));
    if (v <= 8) return Math.floor(VOYAGE_BASE_COST * Math.pow(10, v));
    const qaBase = VOYAGE_BASE_COST * Math.pow(10, 8);
    return Math.floor(qaBase * Math.pow(100, v - 8));
  }

  function doVoyage() {
    const cost = voyageCost();
    if (state.coins < cost) return;
    const nextMult = multiplier() * 2;
    if (
      !confirm(
        `Set sail for ${formatNum(cost)} coins?\n\nBank and upgrades reset. Lifetime stays. Earnings become ×${nextMult}.`
      )
    ) {
      return;
    }
    ensureSession();
    const lifetime = state.lifetime;
    const voyages = (state.voyages || 0) + 1;
    state = defaultState();
    state.lifetime = lifetime;
    state.voyages = voyages;
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
    const canBuy = state.coins >= cost;
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

  function refreshShopButtons() {
    if (!shopList) return;
    shopList.querySelectorAll("[data-buy]").forEach((btn) => {
      const id = btn.dataset.buy;
      const upgrade = UPGRADES.find((u) => u.id === id);
      if (!upgrade) return;
      const owned = state.owned[id] || 0;
      const cost = upgradeCost(upgrade, owned);
      btn.textContent = formatNum(cost);
      btn.disabled = state.coins < cost;
      const ownedEl = btn.closest(".shop-item")?.querySelector(".shop-item-owned");
      if (ownedEl) ownedEl.textContent = `Owned: ${owned}`;
    });
  }

  function renderVoyage() {
    const mult = multiplier();
    const nextMult = mult * 2;
    const cost = voyageCost();
    const ready = state.coins >= cost;
    if (voyageMultEl) {
      const label = state.voyages > 0 ? `Voyages: ${state.voyages} · ` : "";
      voyageMultEl.textContent = `${label}Now ×${mult} → after ×${nextMult}`;
    }
    if (voyageDesc) {
      voyageDesc.textContent = ready
        ? `Ready! Reset bank & shop, keep lifetime. Multiplier becomes ×${nextMult}.`
        : `Need ${formatNum(cost)} coins. Resets shop & bank, keeps lifetime. Next multi: ×${nextMult}.`;
    }
    if (voyageBtn) {
      voyageBtn.disabled = !ready;
      voyageBtn.textContent = ready
        ? `Voyage → ×${nextMult}`
        : `Voyage to ×${nextMult} (${formatNum(state.coins)} / ${formatNum(cost)})`;
    }
  }

  function renderStats() {
    const fps = totalFps();
    const mult = multiplier();
    const best = Math.max(getStoredBest(), Math.floor(state.lifetime));
    if (coinCountEl) coinCountEl.textContent = formatNum(state.coins);
    if (fpsLabelEl) fpsLabelEl.textContent = formatFps(fps);
    if (hudFpsEl) hudFpsEl.textContent = formatFps(fps);
    if (hudBestEl) hudBestEl.textContent = formatNum(best);
    if (hudMultEl) hudMultEl.textContent = String(mult);
    if (multLabelEl) multLabelEl.textContent = `×${mult}`;
    if (castPowerEl) castPowerEl.textContent = `+${formatNum(castGain())}`;
    if (overlayBestEl) overlayBestEl.textContent = formatNum(best);
    refreshShopButtons();
    renderVoyage();
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

  function applyOffline() {
    const now = Date.now();
    const last = state.lastTick || now;
    const elapsed = Math.min(8 * 3600 * 1000, Math.max(0, now - last));
    const fps = totalFps();
    if (elapsed > 5000 && fps > 0) {
      const gained = fps * (elapsed / 1000);
      addCoins(gained);
      if (catchLineEl) {
        catchLineEl.textContent = `While away: +${formatNum(gained)} coins`;
      }
    }
    state.lastTick = now;
  }

  function tick() {
    const fps = totalFps();
    if (fps > 0) {
      addCoins(fps * (TICK_MS / 1000));
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

  castBtn?.addEventListener("click", doCast);
  shopList?.addEventListener("pointerdown", (e) => {
    const btn = e.target.closest("[data-buy]");
    if (!btn || btn.disabled) return;
    e.preventDefault();
    buyUpgrade(btn.dataset.buy);
  });
  startBtn?.addEventListener("click", closeMenu);
  menuBtn?.addEventListener("click", openMenu);
  gamesBtn?.addEventListener("click", goToGames);
  voyageBtn?.addEventListener("click", doVoyage);

  state = loadState();
  applyOffline();
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
