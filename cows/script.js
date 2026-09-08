(function () {
  const SAVE_KEY = "cows-save-v1";
  const HIGH_SCORE_KEY = "cows-best-tier-v1";
  const TICK_MS = 100;
  const COLS = 5;
  const ROWS = 5;
  const CELLS = COLS * ROWS;

  const COWS = [
    { tier: 1, name: "Calf", emoji: "🐮", color: "#d8f5a2", mps: 1 },
    { tier: 2, name: "Heifer", emoji: "🐄", color: "#c0eb75", mps: 3 },
    { tier: 3, name: "Dairy Cow", emoji: "🥛", color: "#a9e34b", mps: 8 },
    { tier: 4, name: "Prize Cow", emoji: "🏅", color: "#94d82d", mps: 20 },
    { tier: 5, name: "Super Cow", emoji: "💪", color: "#74c0fc", mps: 50 },
    { tier: 6, name: "Mega Cow", emoji: "🦾", color: "#4dabf7", mps: 120 },
    { tier: 7, name: "Ultra Cow", emoji: "⚡", color: "#339af0", mps: 280 },
    { tier: 8, name: "Golden Cow", emoji: "🥇", color: "#ffd43b", mps: 650 },
    { tier: 9, name: "Diamond Cow", emoji: "💎", color: "#66d9e8", mps: 1500 },
    { tier: 10, name: "Rainbow Cow", emoji: "🌈", color: "#da77f2", mps: 3500 },
    { tier: 11, name: "Crystal Cow", emoji: "✨", color: "#e599f7", mps: 8000 },
    { tier: 12, name: "Neon Cow", emoji: "🔆", color: "#ff922b", mps: 18000 },
    { tier: 13, name: "Cosmic Cow", emoji: "🌌", color: "#9775fa", mps: 42000 },
    { tier: 14, name: "Divine Cow", emoji: "😇", color: "#fff3bf", mps: 95000 },
    { tier: 15, name: "Eternal Cow", emoji: "♾️", color: "#99e9f2", mps: 220000 },
    { tier: 16, name: "Mythic Cow", emoji: "🐉", color: "#ffa94d", mps: 500000 },
    { tier: 17, name: "Omega Cow", emoji: "Ω", color: "#ff6b6b", mps: 1200000 },
    { tier: 18, name: "Abyss Cow", emoji: "🌑", color: "#845ef7", mps: 2800000 },
    { tier: 19, name: "Galaxy Cow", emoji: "🪐", color: "#5c7cfa", mps: 6500000 },
    { tier: 20, name: "Cowmageddon", emoji: "👑", color: "#fcc419", mps: 15000000 }
  ];

  const UPGRADES = [
    { id: "bulk1", name: "Bulk Bin", desc: "Calf cost −8%", baseCost: 200, kind: "discount", amount: 0.08 },
    { id: "bulk2", name: "Feed Deal", desc: "Calf cost −10%", baseCost: 1200, kind: "discount", amount: 0.1 },
    { id: "bulk3", name: "Herd Sale", desc: "Calf cost −12%", baseCost: 8000, kind: "discount", amount: 0.12 },
    { id: "milk1", name: "Better Feed", desc: "+25% herd milk/s", baseCost: 350, kind: "mult", amount: 0.25 },
    { id: "milk2", name: "Milk Pail", desc: "+40% herd milk/s", baseCost: 2500, kind: "mult", amount: 0.4 },
    { id: "milk3", name: "Creamery", desc: "+60% herd milk/s", baseCost: 18000, kind: "mult", amount: 0.6 },
    { id: "milk4", name: "Dairy Empire", desc: "+100% herd milk/s", baseCost: 120000, kind: "mult", amount: 1 },
    { id: "auto1", name: "Farmhand", desc: "Auto-buy calf every 8s", baseCost: 5000, kind: "auto", amount: 8 },
    { id: "auto2", name: "Ranch Crew", desc: "Auto-buy calf every 4s", baseCost: 45000, kind: "auto", amount: 4 },
    { id: "auto3", name: "Mega Ranch", desc: "Auto-buy calf every 2s", baseCost: 350000, kind: "auto", amount: 2 },
    { id: "merge1", name: "Herd Sorter", desc: "Auto-merge a match every 15s", baseCost: 7500, kind: "merge", amount: 15 },
    { id: "merge2", name: "Match Maker", desc: "Auto-merge a match every 10s", baseCost: 55000, kind: "merge", amount: 10 },
    { id: "merge3", name: "Merge Master", desc: "Auto-merge a match every 6s", baseCost: 400000, kind: "merge", amount: 6 }
  ];

  const milkCountEl = document.getElementById("milk-count");
  const mpsLabelEl = document.getElementById("mps-label");
  const hudMpsEl = document.getElementById("hud-mps");
  const hudBestEl = document.getElementById("hud-best");
  const topLabelEl = document.getElementById("top-label");
  const fillLabelEl = document.getElementById("fill-label");
  const autoLabelEl = document.getElementById("auto-label");
  const autoTimersEl = document.getElementById("auto-timers");
  const pastureEl = document.getElementById("pasture");
  const statusLineEl = document.getElementById("status-line");
  const buyBtn = document.getElementById("buy-btn");
  const sellModeBtn = document.getElementById("sell-mode-btn");
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
  let sellMode = false;
  let lastSaveAt = 0;
  let lastSubmitAt = 0;
  let autoAcc = {};
  let pastureDirty = false;
  let drag = null;
  let floatEl = null;

  function defaultState() {
    const owned = {};
    UPGRADES.forEach((u) => {
      owned[u.id] = 0;
    });
    return {
      milk: 40,
      lifetime: 0,
      board: Array(CELLS).fill(0),
      owned,
      autoOn: {},
      calvesBought: 0,
      bestTier: 0,
      lastTick: Date.now()
    };
  }

  function cowByTier(tier) {
    return COWS.find((c) => c.tier === tier) || null;
  }

  function formatNum(n) {
    const x = Math.floor(Number(n) || 0);
    if (x < 1000) return String(x);
    const units = ["", "K", "M", "B", "T", "Qa", "Qi"];
    let v = x;
    let u = 0;
    while (v >= 1000 && u < units.length - 1) {
      v /= 1000;
      u += 1;
    }
    const digits = v >= 100 ? 0 : v >= 10 ? 1 : 2;
    return `${v.toFixed(digits)}${units[u]}`;
  }

  function discountFactor() {
    return UPGRADES.filter((u) => u.kind === "discount" && state.owned[u.id] > 0).reduce(
      (f, u) => f * (1 - u.amount),
      1
    );
  }

  function milkMult() {
    return (
      1 +
      UPGRADES.filter((u) => u.kind === "mult").reduce(
        (s, u) => s + (state.owned[u.id] || 0) * u.amount,
        0
      )
    );
  }

  function isTimedUpgrade(u) {
    return u.kind === "auto" || u.kind === "merge";
  }

  function ownedAutos() {
    return UPGRADES.filter((u) => isTimedUpgrade(u) && state.owned[u.id] > 0);
  }

  function isAutoOn(id) {
    return state.autoOn?.[id] !== false;
  }

  function setAutoOn(id, on) {
    if (!state.autoOn || typeof state.autoOn !== "object") state.autoOn = {};
    state.autoOn[id] = !!on;
  }

  function activeAutos() {
    return ownedAutos().filter((u) => isAutoOn(u.id));
  }

  function bestAutoSeconds() {
    const autos = activeAutos().filter((u) => u.kind === "auto");
    if (!autos.length) return 0;
    return Math.min(...autos.map((u) => u.amount));
  }

  function findMergePair() {
    const byTier = {};
    state.board.forEach((tier, index) => {
      if (!tier || tier >= COWS.length) return;
      if (!byTier[tier]) byTier[tier] = [];
      byTier[tier].push(index);
    });
    const tiers = Object.keys(byTier)
      .map(Number)
      .sort((a, b) => a - b);
    for (let i = 0; i < tiers.length; i += 1) {
      const list = byTier[tiers[i]];
      if (list.length >= 2) return [list[0], list[1]];
    }
    return null;
  }

  function canAutoMerge() {
    return !!findMergePair();
  }

  function workerCanFire(upgrade) {
    if (upgrade.kind === "merge") return canAutoMerge();
    return canAutoBuy();
  }

  function fireWorker(upgrade) {
    if (upgrade.kind === "merge") {
      const pair = findMergePair();
      if (!pair) return false;
      return mergeInto(pair[0], pair[1], { silent: true });
    }
    return placeCalf(true);
  }

  function workerMeta(upgrade) {
    if (upgrade.kind === "merge") return `merges a match every ${upgrade.amount}s`;
    return `buys calf every ${upgrade.amount}s`;
  }

  function autoRemaining(auto) {
    const interval = Number(auto.amount) || 1;
    const acc = autoAcc[auto.id] || 0;
    return Math.max(0, interval - acc);
  }

  function formatTimer(sec) {
    const s = Math.max(0, Number(sec) || 0);
    if (s >= 9.95) return `${Math.round(s)}s`;
    return `${s.toFixed(1)}s`;
  }

  let autoTimersKey = "";

  function canAutoBuy() {
    return state.milk >= calfCost() && firstEmpty() >= 0;
  }

  function renderAutoTimers(force = false) {
    const list = ownedAutos();
    if (autoLabelEl) {
      if (!list.length) autoLabelEl.textContent = "0";
      else {
        const active = activeAutos();
        if (!active.length) autoLabelEl.textContent = `${list.length} · off`;
        else {
          const ready = active.filter((u) => workerCanFire(u));
          if (!ready.length) autoLabelEl.textContent = `${active.length}/${list.length} · waiting`;
          else {
            const next = Math.min(...ready.map(autoRemaining));
            autoLabelEl.textContent = `${active.length}/${list.length} · next ${formatTimer(next)}`;
          }
        }
      }
    }
    if (!autoTimersEl) return;
    if (!list.length) {
      autoTimersEl.innerHTML = "";
      autoTimersEl.classList.add("empty");
      autoTimersKey = "";
      return;
    }
    autoTimersEl.classList.remove("empty");
    const nextKey = list.map((a) => `${a.id}:${isAutoOn(a.id) ? 1 : 0}`).join("|");
    if (force || nextKey !== autoTimersKey) {
      autoTimersKey = nextKey;
      autoTimersEl.innerHTML = list
        .map((auto) => {
          const interval = Number(auto.amount) || 1;
          const on = isAutoOn(auto.id);
          const left = autoRemaining(auto);
          const ready = on && left <= 0.05;
          const waiting = on && ready && !workerCanFire(auto);
          const pct = !on
            ? 0
            : Math.max(0, Math.min(100, (1 - left / interval) * 100));
          return `<div class="auto-timer ${on ? "" : "is-off"}${waiting ? " is-waiting" : ""}${
            auto.kind === "merge" ? " is-merge" : ""
          }" data-auto="${auto.id}">
          <div class="auto-timer-top">
            <span class="auto-timer-name">${auto.name}</span>
            <span class="auto-timer-left">${
              !on ? "Off" : waiting ? "Waiting" : formatTimer(left)
            }</span>
          </div>
          <div class="auto-timer-track" aria-hidden="true">
            <div class="auto-timer-fill" style="width:${pct.toFixed(1)}%"></div>
          </div>
          <div class="auto-timer-row">
            <span class="auto-timer-meta">${workerMeta(auto)}</span>
            <button type="button" class="auto-toggle" data-auto-toggle="${auto.id}" aria-pressed="${on}">
              ${on ? "On" : "Off"}
            </button>
          </div>
        </div>`;
        })
        .join("");
      return;
    }
    list.forEach((auto) => {
      const row = autoTimersEl.querySelector(`[data-auto="${auto.id}"]`);
      if (!row) return;
      const on = isAutoOn(auto.id);
      const interval = Number(auto.amount) || 1;
      const left = autoRemaining(auto);
      const ready = on && left <= 0.05;
      const waiting = on && ready && !workerCanFire(auto);
      row.classList.toggle("is-off", !on);
      row.classList.toggle("is-waiting", waiting);
      const leftEl = row.querySelector(".auto-timer-left");
      const fillEl = row.querySelector(".auto-timer-fill");
      if (leftEl) leftEl.textContent = !on ? "Off" : waiting ? "Waiting" : formatTimer(left);
      if (fillEl) {
        fillEl.style.width = !on
          ? "0%"
          : `${Math.max(0, Math.min(100, (1 - left / interval) * 100)).toFixed(1)}%`;
      }
    });
  }

  function tickAutos(dt) {
    activeAutos().forEach((auto) => {
      const interval = Number(auto.amount) || 1;
      let acc = (autoAcc[auto.id] || 0) + dt;
      while (acc >= interval) {
        if (!workerCanFire(auto)) {
          acc = interval;
          break;
        }
        if (!fireWorker(auto)) {
          acc = interval;
          break;
        }
        pastureDirty = true;
        acc -= interval;
      }
      autoAcc[auto.id] = Math.min(acc, interval);
    });
  }

  function calfCost() {
    const base = 10 * Math.pow(1.045, state.calvesBought);
    return Math.max(5, Math.floor(base * discountFactor()));
  }

  function sellValue(tier) {
    const cow = cowByTier(tier);
    if (!cow) return 0;
    return Math.max(1, Math.floor(cow.mps * 12));
  }

  function herdMps() {
    const mult = milkMult();
    let total = 0;
    state.board.forEach((tier) => {
      const cow = cowByTier(tier);
      if (cow) total += cow.mps;
    });
    return total * mult;
  }

  function topTier() {
    return state.board.reduce((m, t) => Math.max(m, t || 0), 0);
  }

  function filledCount() {
    return state.board.filter((t) => t > 0).length;
  }

  function firstEmpty() {
    return state.board.findIndex((t) => !t);
  }

  function setStatus(text, cls = "") {
    if (!statusLineEl) return;
    statusLineEl.textContent = text;
    statusLineEl.classList.remove("miss", "ok");
    if (cls) statusLineEl.classList.add(cls);
  }

  function getStoredBest() {
    return Math.max(0, Math.floor(Number(localStorage.getItem(HIGH_SCORE_KEY)) || 0));
  }

  function noteBestTier(tier) {
    if (tier <= state.bestTier) return;
    state.bestTier = tier;
    const best = Math.max(getStoredBest(), tier);
    localStorage.setItem(HIGH_SCORE_KEY, String(best));
    if (tier >= 8) window.HubConfetti?.burst?.();
    maybeSubmitBest(false);
  }

  function addMilk(amount) {
    const n = Math.max(0, Number(amount) || 0);
    state.milk += n;
    state.lifetime += n;
  }

  function loadState() {
    try {
      const raw = JSON.parse(localStorage.getItem(SAVE_KEY) || "null");
      if (!raw || typeof raw !== "object") return defaultState();
      const next = defaultState();
      next.milk = Math.max(0, Number(raw.milk) || 0);
      next.lifetime = Math.max(0, Number(raw.lifetime) || 0);
      next.calvesBought = Math.max(0, Math.floor(Number(raw.calvesBought) || 0));
      next.bestTier = Math.max(0, Math.floor(Number(raw.bestTier) || 0), getStoredBest());
      next.lastTick = Math.max(0, Number(raw.lastTick) || Date.now());
      if (Array.isArray(raw.board)) {
        next.board = Array(CELLS)
          .fill(0)
          .map((_, i) => {
            const t = Math.floor(Number(raw.board[i]) || 0);
            return t >= 1 && t <= COWS.length ? t : 0;
          });
      }
      UPGRADES.forEach((u) => {
        next.owned[u.id] = Math.max(0, Math.floor(Number(raw.owned?.[u.id]) || 0));
      });
      next.autoOn = {};
      UPGRADES.filter((u) => isTimedUpgrade(u)).forEach((u) => {
        if (raw.autoOn && typeof raw.autoOn === "object" && Object.prototype.hasOwnProperty.call(raw.autoOn, u.id)) {
          next.autoOn[u.id] = !!raw.autoOn[u.id];
        } else {
          next.autoOn[u.id] = true;
        }
      });
      return next;
    } catch {
      return defaultState();
    }
  }

  function saveState() {
    try {
      state.lastTick = Date.now();
      localStorage.setItem(SAVE_KEY, JSON.stringify(state));
      const best = Math.max(getStoredBest(), state.bestTier || 0);
      if (best > 0) localStorage.setItem(HIGH_SCORE_KEY, String(best));
    } catch {}
  }

  function saveSoon() {
    const now = Date.now();
    if (now - lastSaveAt < 700) return;
    lastSaveAt = now;
    saveState();
  }

  function maybeSubmitBest(force) {
    const best = Math.max(getStoredBest(), state.bestTier || 0);
    if (best <= 0 || !window.HubLeaderboard) return;
    const now = Date.now();
    if (!force && now - lastSubmitAt < 8000) return;
    lastSubmitAt = now;
    HubLeaderboard.submit("cows", best).catch?.(() => {});
  }

  function ensureSession() {
    if (sessionStarted) return;
    sessionStarted = true;
    if (window.HubPlays) HubPlays.record("cows");
  }

  function checkAchievements() {
    if (!window.HubAchievements) return;
    const life = Math.floor(state.lifetime);
    const best = Math.max(state.bestTier, topTier());
    if (life >= 100) HubAchievements.unlock("cows_100");
    if (life >= 10000) HubAchievements.unlock("cows_10k");
    if (life >= 1000000) HubAchievements.unlock("cows_1m");
    if (best >= 5) HubAchievements.unlock("cows_tier_5");
    if (best >= 10) HubAchievements.unlock("cows_tier_10");
    if (best >= 15) HubAchievements.unlock("cows_tier_15");
    if (bestAutoSeconds() > 0) HubAchievements.unlock("cows_auto");
  }

  function placeCalf(silent = false) {
    const cost = calfCost();
    if (state.milk < cost) {
      if (!silent) setStatus("Not enough milk", "miss");
      return false;
    }
    const slot = firstEmpty();
    if (slot < 0) {
      if (!silent) setStatus("Pasture full — merge or sell", "miss");
      return false;
    }
    state.milk -= cost;
    state.calvesBought += 1;
    state.board[slot] = 1;
    noteBestTier(1);
    if (!silent) {
      setStatus(`Bought ${cowByTier(1).name} for ${formatNum(cost)}`, "ok");
      window.HubSound?.play?.("click");
    }
    return true;
  }

  function mergeInto(from, to, opts = {}) {
    if (from === to) return false;
    const a = state.board[from];
    const b = state.board[to];
    if (!a || !b || a !== b) return false;
    if (a >= COWS.length) {
      if (!opts.silent) setStatus("Max evolution already!", "miss");
      return false;
    }
    const next = a + 1;
    state.board[from] = 0;
    state.board[to] = next;
    noteBestTier(next);
    const cow = cowByTier(next);
    if (!opts.silent) {
      setStatus(`Evolved into ${cow.name}!`, "ok");
      window.HubSound?.play?.(next >= 8 ? "win" : "click");
      if (next >= 10) window.HubConfetti?.burst?.();
    } else if (next >= 10) {
      window.HubConfetti?.burst?.();
    }
    return true;
  }

  function sellCow(index) {
    const tier = state.board[index];
    if (!tier) return;
    const val = sellValue(tier);
    const cow = cowByTier(tier);
    state.board[index] = 0;
    addMilk(val);
    setStatus(`Sold ${cow.name} for ${formatNum(val)}`, "ok");
    window.HubSound?.play?.("click");
  }

  function upgradeCost(upgrade) {
    const owned = state.owned[upgrade.id] || 0;
    if (upgrade.kind === "auto" || upgrade.kind === "merge" || upgrade.kind === "discount") {
      // one-shot style: only first purchase matters, but allow 0/1
      return owned > 0 ? Infinity : upgrade.baseCost;
    }
    return Math.floor(upgrade.baseCost * Math.pow(1.55, owned));
  }

  function buyUpgrade(id) {
    const upgrade = UPGRADES.find((u) => u.id === id);
    if (!upgrade) return;
    const cost = upgradeCost(upgrade);
    if (!Number.isFinite(cost) || state.milk < cost) return;
    if ((upgrade.kind === "auto" || upgrade.kind === "merge" || upgrade.kind === "discount") && state.owned[id] > 0) return;
    ensureSession();
    state.milk -= cost;
    state.owned[id] = (state.owned[id] || 0) + 1;
    if (upgrade.kind === "auto" || upgrade.kind === "merge") setAutoOn(id, true);
    setStatus(`Bought ${upgrade.name}`, "ok");
    window.HubSound?.play?.("click");
    checkAchievements();
    render();
    saveSoon();
  }

  function offlineProgress() {
    const now = Date.now();
    const elapsed = Math.min(4 * 3600 * 1000, Math.max(0, now - (state.lastTick || now)));
    if (elapsed < 5000) {
      state.lastTick = now;
      return;
    }
    const mps = herdMps();
    if (mps > 0) {
      const gained = mps * (elapsed / 1000);
      addMilk(gained);
      setStatus(`While away your herd made ${formatNum(gained)} milk`, "ok");
    }
    state.lastTick = now;
  }

  function renderPasture() {
    if (!pastureEl) return;
    pastureEl.innerHTML = "";
    for (let i = 0; i < CELLS; i += 1) {
      const pen = document.createElement("div");
      pen.className = "pen";
      pen.dataset.index = String(i);
      pen.setAttribute("role", "gridcell");
      const tier = state.board[i];
      if (tier) {
        const cow = cowByTier(tier);
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "cow";
        btn.dataset.index = String(i);
        btn.style.background = cow.color;
        btn.innerHTML = `<span class="cow-tier">${tier}</span><span class="cow-emoji">${cow.emoji}</span><span class="cow-name">${cow.name}</span>`;
        btn.title = `${cow.name} · ${formatNum(cow.mps * milkMult())}/s · sell ${formatNum(sellValue(tier))}`;
        pen.appendChild(btn);
      }
      pastureEl.appendChild(pen);
    }
  }

  function renderShop() {
    if (!shopList) return;
    shopList.innerHTML = UPGRADES.map((u) => {
      const owned = state.owned[u.id] || 0;
      const cost = upgradeCost(u);
      const done = !Number.isFinite(cost);
      const can = !done && state.milk >= cost;
      const ownedLabel =
        u.kind === "mult" ? `Owned: ${owned}` : owned > 0 ? "Owned" : "Not owned";
      return `<div class="shop-item" role="listitem">
        <div class="shop-item-main">
          <div class="shop-item-name">${u.name}</div>
          <p class="shop-item-desc">${u.desc}</p>
          <div class="shop-item-owned">${ownedLabel}</div>
        </div>
        <button type="button" class="shop-buy" data-buy="${u.id}" ${can && !done ? "" : "disabled"}>
          ${done ? "Owned" : formatNum(cost)}
        </button>
      </div>`;
    }).join("");
  }

  function renderGuide() {
    if (!guideBody) return;
    const unlocked = Math.max(state.bestTier, topTier(), 1);
    guideBody.innerHTML = COWS.map((c) => {
      const locked = c.tier > unlocked + 1;
      return `<div class="guide-row ${locked ? "locked" : ""}">
        <span class="guide-emoji">${locked ? "❓" : c.emoji}</span>
        <span>${locked ? `Tier ${c.tier}` : `${c.tier}. ${c.name}`}</span>
        <span class="guide-mps">${locked ? "???" : `${formatNum(c.mps)}/s`}</span>
      </div>`;
    }).join("");
  }

  function renderStats() {
    const mps = herdMps();
    const best = Math.max(getStoredBest(), state.bestTier, topTier());
    const bestCow = cowByTier(best);
    if (milkCountEl) milkCountEl.textContent = formatNum(state.milk);
    if (mpsLabelEl) mpsLabelEl.textContent = formatNum(mps);
    if (hudMpsEl) hudMpsEl.textContent = formatNum(mps);
    if (hudBestEl) hudBestEl.textContent = bestCow ? bestCow.name : "—";
    if (overlayBestEl) overlayBestEl.textContent = bestCow ? bestCow.name : "—";
    const top = topTier();
    const topCow = cowByTier(top);
    if (topLabelEl) topLabelEl.textContent = topCow ? topCow.name : "None";
    if (fillLabelEl) fillLabelEl.textContent = `${filledCount()}/${CELLS}`;
    renderAutoTimers();
    if (buyBtn) {
      const cost = calfCost();
      buyBtn.textContent = `Buy Calf · ${formatNum(cost)}`;
      buyBtn.disabled = state.milk < cost || filledCount() >= CELLS;
    }
  }

  function render() {
    renderStats();
    renderPasture();
    renderShop();
    checkAchievements();
  }

  function clearDragVisual() {
    pastureEl?.querySelectorAll(".pen.is-drop, .pen.is-merge").forEach((el) => {
      el.classList.remove("is-drop", "is-merge");
    });
    pastureEl?.querySelectorAll(".cow.is-dragging").forEach((el) => {
      el.classList.remove("is-dragging");
    });
    if (floatEl) {
      floatEl.remove();
      floatEl = null;
    }
  }

  function penFromPoint(x, y) {
    const el = document.elementFromPoint(x, y);
    if (!el) return null;
    const pen = el.closest?.(".pen");
    if (!pen || !pastureEl?.contains(pen)) return null;
    return pen;
  }

  function startDrag(index, clientX, clientY, pointerId) {
    if (sellMode) return;
    const tier = state.board[index];
    if (!tier) return;
    ensureSession();
    const cow = cowByTier(tier);
    drag = { from: index, pointerId, tier };
    clearDragVisual();
    const btn = pastureEl.querySelector(`.cow[data-index="${index}"]`);
    btn?.classList.add("is-dragging");
    floatEl = document.createElement("div");
    floatEl.className = "float-cow";
    floatEl.style.background = cow.color;
    floatEl.innerHTML = `<span class="cow-emoji">${cow.emoji}</span><span class="cow-name">${cow.name}</span>`;
    floatEl.style.left = `${clientX}px`;
    floatEl.style.top = `${clientY}px`;
    (floatLayer || document.body).appendChild(floatEl);
    try {
      pastureEl.setPointerCapture?.(pointerId);
    } catch {}
  }

  function moveDrag(clientX, clientY) {
    if (!drag || !floatEl) return;
    floatEl.style.left = `${clientX}px`;
    floatEl.style.top = `${clientY}px`;
    pastureEl?.querySelectorAll(".pen.is-drop, .pen.is-merge").forEach((el) => {
      el.classList.remove("is-drop", "is-merge");
    });
    const pen = penFromPoint(clientX, clientY);
    if (!pen) return;
    const to = Number(pen.dataset.index);
    if (to === drag.from) return;
    const target = state.board[to];
    if (!target) pen.classList.add("is-drop");
    else if (target === drag.tier && target < COWS.length) pen.classList.add("is-merge");
    else pen.classList.add("is-drop");
  }

  function endDrag(clientX, clientY) {
    if (!drag) return;
    const from = drag.from;
    const pen = penFromPoint(clientX, clientY);
    const to = pen ? Number(pen.dataset.index) : -1;
    clearDragVisual();
    drag = null;
    if (to < 0 || to === from) return;
    const a = state.board[from];
    const b = state.board[to];
    if (!a) return;
    if (b && a === b) {
      mergeInto(from, to);
    } else if (!b) {
      state.board[to] = a;
      state.board[from] = 0;
      setStatus("Moved cow", "");
    } else {
      setStatus("Only same cows merge", "miss");
      window.HubSound?.play?.("miss");
    }
    render();
    saveSoon();
  }

  function tick() {
    const mps = herdMps();
    if (mps > 0) {
      addMilk(mps * (TICK_MS / 1000));
    }
    tickAutos(TICK_MS / 1000);
    if (pastureDirty) {
      pastureDirty = false;
      renderPasture();
    }
    renderStats();
    if (shopList) {
      shopList.querySelectorAll("[data-buy]").forEach((btn) => {
        const id = btn.dataset.buy;
        const upgrade = UPGRADES.find((u) => u.id === id);
        if (!upgrade) return;
        const cost = upgradeCost(upgrade);
        const done = !Number.isFinite(cost);
        btn.disabled = done || state.milk < cost;
        btn.textContent = done ? "Owned" : formatNum(cost);
      });
    }
    if (buyBtn) {
      const cost = calfCost();
      buyBtn.textContent = `Buy Calf · ${formatNum(cost)}`;
      buyBtn.disabled = state.milk < cost || filledCount() >= CELLS;
    }
    saveSoon();
  }

  function openMenu() {
    saveState();
    maybeSubmitBest(true);
    renderStats();
    overlay?.classList.remove("hidden");
  }

  function startPlay() {
    overlay?.classList.add("hidden");
    ensureSession();
    render();
  }

  // Events
  buyBtn?.addEventListener("click", () => {
    ensureSession();
    if (placeCalf(false)) {
      render();
      saveSoon();
      checkAchievements();
    }
  });

  sellModeBtn?.addEventListener("click", () => {
    sellMode = !sellMode;
    document.body.classList.toggle("sell-mode", sellMode);
    sellModeBtn.classList.toggle("is-on", sellMode);
    sellModeBtn.setAttribute("aria-pressed", String(sellMode));
    setStatus(sellMode ? "Sell mode on — tap a cow to sell" : "Sell mode off");
  });

  shopList?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-buy]");
    if (!btn || btn.disabled) return;
    buyUpgrade(btn.dataset.buy);
  });

  autoTimersEl?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-auto-toggle]");
    if (!btn || !autoTimersEl.contains(btn)) return;
    e.preventDefault();
    e.stopPropagation();
    const id = btn.dataset.autoToggle;
    if (!id) return;
    ensureSession();
    const next = !isAutoOn(id);
    setAutoOn(id, next);
    // Reset charge when turning back on so it doesn't instantly dump calves
    if (next) autoAcc[id] = 0;
    const name =
      UPGRADES.find((u) => u.id === id)?.name ||
      btn.closest(".auto-timer")?.querySelector(".auto-timer-name")?.textContent ||
      "Auto";
    setStatus(next ? `${name} on` : `${name} paused`);
    window.HubSound?.play?.("click");
    renderAutoTimers(true);
    saveSoon();
  });

  pastureEl?.addEventListener("pointerdown", (e) => {
    if (e.button != null && e.button !== 0) return;
    const cowBtn = e.target.closest(".cow");
    if (!cowBtn || !pastureEl.contains(cowBtn)) return;
    const index = Number(cowBtn.dataset.index);
    if (sellMode) {
      e.preventDefault();
      ensureSession();
      sellCow(index);
      render();
      saveSoon();
      return;
    }
    e.preventDefault();
    startDrag(index, e.clientX, e.clientY, e.pointerId);
  });

  pastureEl?.addEventListener("pointermove", (e) => {
    if (!drag || e.pointerId !== drag.pointerId) return;
    moveDrag(e.clientX, e.clientY);
  });

  pastureEl?.addEventListener("pointerup", (e) => {
    if (!drag || e.pointerId !== drag.pointerId) return;
    endDrag(e.clientX, e.clientY);
  });

  pastureEl?.addEventListener("pointercancel", (e) => {
    if (!drag || e.pointerId !== drag.pointerId) return;
    clearDragVisual();
    drag = null;
  });

  startBtn?.addEventListener("click", startPlay);
  menuBtn?.addEventListener("click", openMenu);
  gamesBtn?.addEventListener("click", () => {
    window.location.href = "../index.html#games";
  });
  guideBtn?.addEventListener("click", () => {
    renderGuide();
    guideOverlay?.classList.remove("hidden");
  });
  guideClose?.addEventListener("click", () => {
    guideOverlay?.classList.add("hidden");
  });

  // Boot
  state = loadState();
  offlineProgress();
  render();
  maybeSubmitBest(true);
  setInterval(tick, TICK_MS);
  window.addEventListener("beforeunload", () => {
    saveState();
    maybeSubmitBest(true);
  });
})();
