(function () {
  const SAVE_KEY = "clicker-save-v1";
  const HIGH_SCORE_KEY = "clicker-high-score";
  const TICK_MS = 100;
  const REBIRTH_BASE_COST = 1_000_000;

  const UPGRADES = [
    // Click power
    { id: "pickaxe", name: "Pickaxe", desc: "+1 per click", baseCost: 15, clickBonus: 1, cps: 0, group: "click" },
    { id: "gloves", name: "Crystal Gloves", desc: "+5 per click", baseCost: 250, clickBonus: 5, cps: 0, group: "click" },
    { id: "hammer", name: "Amber Hammer", desc: "+25 per click", baseCost: 5000, clickBonus: 25, cps: 0, group: "click" },
    { id: "fist", name: "Titan Fist", desc: "+100 per click", baseCost: 250000, clickBonus: 100, cps: 0, group: "click" },
    // Idle income
    { id: "miner", name: "Miner", desc: "+0.5 / sec", baseCost: 50, clickBonus: 0, cps: 0.5, group: "idle" },
    { id: "cart", name: "Mine Cart", desc: "+2 / sec", baseCost: 150, clickBonus: 0, cps: 2, group: "idle" },
    { id: "drill", name: "Crystal Drill", desc: "+4 / sec", baseCost: 400, clickBonus: 0, cps: 4, group: "idle" },
    { id: "tunnel", name: "Deep Tunnel", desc: "+10 / sec", baseCost: 1200, clickBonus: 0, cps: 10, group: "idle" },
    { id: "quarry", name: "Quarry", desc: "+20 / sec", baseCost: 3000, clickBonus: 0, cps: 20, group: "idle" },
    { id: "refinery", name: "Gem Refinery", desc: "+50 / sec", baseCost: 8000, clickBonus: 0, cps: 50, group: "idle" },
    { id: "factory", name: "Gem Factory", desc: "+100 / sec", baseCost: 20000, clickBonus: 0, cps: 100, group: "idle" },
    { id: "megamine", name: "Mega Mine", desc: "+350 / sec", baseCost: 75000, clickBonus: 0, cps: 350, group: "idle" },
    { id: "reactor", name: "Amber Reactor", desc: "+750 / sec", baseCost: 150000, clickBonus: 0, cps: 750, group: "idle" },
    { id: "vault", name: "Crystal Vault", desc: "+2,500 / sec", baseCost: 500000, clickBonus: 0, cps: 2500, group: "idle" },
    { id: "fortress", name: "Ore Fortress", desc: "+12,000 / sec", baseCost: 2500000, clickBonus: 0, cps: 12000, group: "idle" },
    { id: "nebula", name: "Nebula Drill", desc: "+75,000 / sec", baseCost: 15000000, clickBonus: 0, cps: 75000, group: "idle" },
    { id: "singularity", name: "Singularity Core", desc: "+500,000 / sec", baseCost: 100000000, clickBonus: 0, cps: 500000, group: "idle" }
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

  function formatNum(n) {
    const v = Math.floor(Number(n) || 0);
    if (v >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(2)}B`;
    if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(2)}M`;
    if (v >= 10_000) return `${(v / 1_000).toFixed(1)}K`;
    if (v >= 1000) return v.toLocaleString();
    return String(v);
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
    // 1st = 1M, 2nd = 10M, 3rd = 100M, …
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
    const cost = rebirthCost();
    const ready = state.crystals >= cost;
    if (rebirthMultEl) {
      rebirthMultEl.textContent =
        state.rebirths > 0
          ? `Rebirths: ${state.rebirths} · Multiplier: ×${mult}`
          : `Multiplier: ×${mult}`;
    }
    if (rebirthDesc) {
      rebirthDesc.textContent = ready
        ? `Ready! Reset bank & upgrades, keep lifetime, go to ×${mult * 2} earnings.`
        : `Need ${formatNum(cost)} crystals in the bank. Resets upgrades & bank, keeps lifetime, doubles all earnings.`;
    }
    if (rebirthBtn) {
      rebirthBtn.disabled = !ready;
      rebirthBtn.textContent = ready
        ? `Rebirth → ×${mult * 2}`
        : `Rebirth (${formatNum(state.crystals)} / ${formatNum(cost)})`;
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
