/**
 * hub-coins.js — hub-wide coin wallet (localStorage).
 *
 * API (window.HubCoins):
 *   .getBalance() / .format(n)
 *   .earn(amount, reason) / .spend(cost, itemLabel)
 *   .rewardEnemy() · .rewardWin() · .rewardPickup() · .rewardAiQuest()
 *   .claimDaily() · .canClaimDaily()
 *   .buy(itemId) — shop items (Help mascots, etc.)
 *   .getShop() · .hasPurchase(id)
 *   .onChange(fn) · .offChange(fn)
 *   .refreshUi()
 *
 * Rewards: enemy 5 · win/level 25 · daily 50 · pickup 1 · AI quest 10
 */
(function () {
  if (window.HubCoins) return;

  const STORAGE_PREFIX = "hub-coins-v1";
  const NEED_MORE = "You need more coins for this item!";

  const REWARDS = {
    enemy: 5,
    win: 25,
    daily: 50,
    pickup: 1,
    aiQuest: 10
  };

  /** Shop catalog — Help mascots unlock with hub coins. */
  const SHOP = [
    { id: "mascot:whiskers", label: "Whiskers (Help mascot)", cost: 250, kind: "mascot", mascotId: "whiskers" },
    { id: "mascot:glitch", label: "Glitch (Help mascot)", cost: 300, kind: "mascot", mascotId: "glitch" },
    { id: "mascot:pixel-8", label: "Pixel-8 (Help mascot)", cost: 300, kind: "mascot", mascotId: "pixel-8" },
    { id: "mascot:barnaby", label: "Barnaby (Help mascot)", cost: 400, kind: "mascot", mascotId: "barnaby" },
    { id: "mascot:goldsworth", label: "Sir Goldsworth (Help mascot)", cost: 450, kind: "mascot", mascotId: "goldsworth" },
    { id: "mascot:astra", label: "Astra (Help mascot)", cost: 400, kind: "mascot", mascotId: "astra" },
    { id: "mascot:gusto", label: "Chef Gusto (Help mascot)", cost: 400, kind: "mascot", mascotId: "gusto" },
    { id: "mascot:shadow", label: "Shadow (Help mascot)", cost: 500, kind: "mascot", mascotId: "shadow" }
  ];

  const listeners = new Set();
  let winCooldownUntil = 0;
  let enemyCooldownUntil = 0;

  function canUseLocalStorage() {
    try {
      const k = "__hub_coins_probe__";
      localStorage.setItem(k, "1");
      localStorage.removeItem(k);
      return true;
    } catch {
      return false;
    }
  }

  function walletKey() {
    let suffix = "local";
    try {
      const id =
        (typeof window.HubPlays?.getPlayerId === "function" && HubPlays.getPlayerId()) ||
        (typeof window.HubPlays?.getCode === "function" && HubPlays.getCode()) ||
        "";
      const clean = String(id || "")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_-]+/g, "");
      if (clean) suffix = clean.slice(0, 48);
    } catch {}
    return `${STORAGE_PREFIX}:${suffix}`;
  }

  function todayKey() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  function defaultState() {
    return {
      balance: 0,
      lifetimeEarned: 0,
      lifetimeSpent: 0,
      lastDailyDay: "",
      lastAiQuestDay: "",
      purchases: {},
      updatedAt: Date.now()
    };
  }

  function readState() {
    const base = defaultState();
    if (!canUseLocalStorage()) return base;
    try {
      const raw = localStorage.getItem(walletKey());
      if (!raw) return base;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return base;
      return {
        balance: Math.max(0, Math.floor(Number(parsed.balance) || 0)),
        lifetimeEarned: Math.max(0, Math.floor(Number(parsed.lifetimeEarned) || 0)),
        lifetimeSpent: Math.max(0, Math.floor(Number(parsed.lifetimeSpent) || 0)),
        lastDailyDay: String(parsed.lastDailyDay || ""),
        lastAiQuestDay: String(parsed.lastAiQuestDay || ""),
        purchases:
          parsed.purchases && typeof parsed.purchases === "object" ? { ...parsed.purchases } : {},
        updatedAt: Number(parsed.updatedAt) || Date.now()
      };
    } catch {
      return base;
    }
  }

  function writeState(state) {
    if (!canUseLocalStorage()) return;
    try {
      const next = {
        ...state,
        balance: Math.max(0, Math.floor(Number(state.balance) || 0)),
        updatedAt: Date.now()
      };
      localStorage.setItem(walletKey(), JSON.stringify(next));
    } catch {}
  }

  function emit(detail) {
    listeners.forEach((fn) => {
      try {
        fn(detail);
      } catch {}
    });
    try {
      document.dispatchEvent(new CustomEvent("hub-coins-changed", { detail }));
    } catch {}
    refreshUi(detail);
  }

  function format(n) {
    const v = Math.max(0, Math.floor(Number(n) || 0));
    try {
      return v.toLocaleString("en-US");
    } catch {
      return String(v);
    }
  }

  function getBalance() {
    return readState().balance;
  }

  function earn(amount, reason) {
    const gain = Math.max(0, Math.floor(Number(amount) || 0));
    if (!gain) {
      return { ok: false, balance: getBalance(), gained: 0, reason: String(reason || "") };
    }
    const state = readState();
    state.balance += gain;
    state.lifetimeEarned += gain;
    writeState(state);
    const detail = {
      type: "earn",
      amount: gain,
      balance: state.balance,
      reason: String(reason || "earn")
    };
    emit(detail);
    return { ok: true, balance: state.balance, gained: gain, reason: detail.reason };
  }

  function spend(cost, itemLabel) {
    const price = Math.max(0, Math.floor(Number(cost) || 0));
    const state = readState();
    if (price <= 0) {
      return { ok: true, balance: state.balance, spent: 0 };
    }
    if (state.balance < price) {
      return {
        ok: false,
        balance: state.balance,
        spent: 0,
        error: NEED_MORE,
        item: String(itemLabel || "this item")
      };
    }
    state.balance -= price;
    state.lifetimeSpent += price;
    writeState(state);
    const detail = {
      type: "spend",
      amount: price,
      balance: state.balance,
      reason: String(itemLabel || "spend")
    };
    emit(detail);
    return { ok: true, balance: state.balance, spent: price };
  }

  function canClaimDaily() {
    return readState().lastDailyDay !== todayKey();
  }

  function claimDaily() {
    const state = readState();
    const day = todayKey();
    if (state.lastDailyDay === day) {
      return {
        ok: false,
        balance: state.balance,
        gained: 0,
        error: "Daily reward already claimed today.",
        already: true
      };
    }
    state.lastDailyDay = day;
    state.balance += REWARDS.daily;
    state.lifetimeEarned += REWARDS.daily;
    writeState(state);
    const detail = {
      type: "earn",
      amount: REWARDS.daily,
      balance: state.balance,
      reason: "daily"
    };
    emit(detail);
    return { ok: true, balance: state.balance, gained: REWARDS.daily, reason: "daily" };
  }

  function rewardEnemy() {
    const now = Date.now();
    if (now < enemyCooldownUntil) {
      return { ok: false, balance: getBalance(), gained: 0, reason: "enemy", cooldown: true };
    }
    enemyCooldownUntil = now + 400;
    return earn(REWARDS.enemy, "enemy");
  }

  function rewardWin() {
    const now = Date.now();
    if (now < winCooldownUntil) {
      return { ok: false, balance: getBalance(), gained: 0, reason: "win", cooldown: true };
    }
    winCooldownUntil = now + 1500;
    return earn(REWARDS.win, "win");
  }

  function rewardPickup() {
    return earn(REWARDS.pickup, "pickup");
  }

  function canAiQuest() {
    return readState().lastAiQuestDay !== todayKey();
  }

  function rewardAiQuest() {
    const state = readState();
    const day = todayKey();
    if (state.lastAiQuestDay === day) {
      return {
        ok: false,
        balance: state.balance,
        gained: 0,
        reason: "ai-quest",
        already: true,
        error: "AI quest reward already claimed today."
      };
    }
    state.lastAiQuestDay = day;
    writeState(state);
    return earn(REWARDS.aiQuest, "ai-quest");
  }

  function hasPurchase(id) {
    const key = String(id || "");
    if (!key) return false;
    const state = readState();
    if (state.purchases[key]) return true;
    const item = SHOP.find((s) => s.id === key);
    if (item?.kind === "mascot" && item.mascotId) {
      try {
        if (window.HubHelp?.isMascotUnlocked?.(item.mascotId)) return true;
      } catch {}
    }
    return false;
  }

  function getShop() {
    return SHOP.map((item) => ({
      ...item,
      owned: hasPurchase(item.id)
    }));
  }

  function buy(itemId) {
    const item = SHOP.find((s) => s.id === itemId);
    if (!item) {
      return { ok: false, error: "Unknown shop item.", balance: getBalance() };
    }
    if (hasPurchase(item.id)) {
      return { ok: false, error: "You already own this item.", balance: getBalance(), owned: true };
    }
    const paid = spend(item.cost, item.label);
    if (!paid.ok) {
      return {
        ok: false,
        error: NEED_MORE,
        balance: paid.balance,
        cost: item.cost,
        item: item.label
      };
    }
    const state = readState();
    state.purchases[item.id] = { at: Date.now(), cost: item.cost };
    writeState(state);

    if (item.kind === "mascot" && item.mascotId) {
      try {
        window.HubHelp?.unlockMascot?.(item.mascotId);
      } catch {}
    }

    emit({
      type: "buy",
      amount: item.cost,
      balance: state.balance,
      reason: item.id,
      item: item.label
    });
    return { ok: true, balance: state.balance, item, spent: item.cost };
  }

  function onChange(fn) {
    if (typeof fn === "function") listeners.add(fn);
  }

  function offChange(fn) {
    listeners.delete(fn);
  }

  function refreshUi(detail) {
    const bal = detail?.balance != null ? detail.balance : getBalance();
    const text = format(bal);
    document.querySelectorAll("[data-hub-coins-balance]").forEach((el) => {
      el.textContent = text;
    });
    document.querySelectorAll("[data-hub-coins-daily]").forEach((el) => {
      const ready = canClaimDaily();
      if (el.tagName === "BUTTON") {
        el.disabled = !ready;
        el.textContent = ready ? `Claim daily (+${REWARDS.daily})` : "Daily claimed";
      }
    });
  }

  function ensureHubBadge() {
    // Hub toolbar owns the Coins button; this only refreshes visible balances.
    refreshUi();
  }

  // Migrate legacy unscoped wallet once.
  try {
    if (canUseLocalStorage()) {
      const legacy = localStorage.getItem(STORAGE_PREFIX);
      const key = walletKey();
      if (legacy && !localStorage.getItem(key)) {
        localStorage.setItem(key, legacy);
        localStorage.removeItem(STORAGE_PREFIX);
      }
    }
  } catch {}

  window.HubCoins = {
    REWARDS,
    NEED_MORE,
    SHOP,
    getBalance,
    format,
    earn,
    spend,
    claimDaily,
    canClaimDaily,
    rewardEnemy,
    rewardWin,
    rewardPickup,
    rewardAiQuest,
    canAiQuest,
    buy,
    getShop,
    hasPurchase,
    onChange,
    offChange,
    refreshUi,
    ensureHubBadge,
    readState
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      ensureHubBadge();
      refreshUi();
    });
  } else {
    ensureHubBadge();
    refreshUi();
  }
})();
