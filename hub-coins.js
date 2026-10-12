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
 * Rewards: enemy 5 · win/level 25 · daily 50 · pickup 25 (1h cooldown) · AI quest 10
 */
(function () {
  if (window.HubCoins) return;

  const STORAGE_PREFIX = "hub-coins-v1";
  const NEED_MORE = "You need more coins for this item!";
  const PICKUP_COOLDOWN_MS = 60 * 60 * 1000; // 1 hour

  const REWARDS = {
    enemy: 5,
    win: 25,
    daily: 50,
    pickup: 25,
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
    { id: "mascot:shadow", label: "Shadow (Help mascot)", cost: 500, kind: "mascot", mascotId: "shadow" },
    {
      id: "skin:wing-hop-ufo",
      label: "Wing Hop — UFO skin",
      cost: 350,
      kind: "skin",
      game: "flappy",
      skinId: "ufo"
    },
    { id: "skin:wing-hop-plane", label: "Wing Hop — Paper Plane", cost: 250, kind: "skin", game: "flappy", skinId: "plane" },
    { id: "skin:wing-hop-bee", label: "Wing Hop — Bee", cost: 250, kind: "skin", game: "flappy", skinId: "bee" },
    { id: "skin:wing-hop-sub", label: "Wing Hop — Submarine", cost: 300, kind: "skin", game: "flappy", skinId: "sub" },
    { id: "skin:wing-hop-balloon", label: "Wing Hop — Hot Air Balloon", cost: 300, kind: "skin", game: "flappy", skinId: "balloon" },
    { id: "skin:wing-hop-broom", label: "Wing Hop — Witch Broom", cost: 350, kind: "skin", game: "flappy", skinId: "broom" },
    { id: "skin:wing-hop-neon", label: "Wing Hop — Neon City", cost: 450, kind: "skin", game: "flappy", skinId: "neon" },
    { id: "skin:wing-hop-steam", label: "Wing Hop — Steampunk", cost: 450, kind: "skin", game: "flappy", skinId: "steam" },
    { id: "skin:wing-hop-frost", label: "Wing Hop — Ice Fortress", cost: 400, kind: "skin", game: "flappy", skinId: "frost" },
    { id: "skin:wing-hop-volcano", label: "Wing Hop — Volcano", cost: 400, kind: "skin", game: "flappy", skinId: "volcano" },
    { id: "skin:wing-hop-ghost", label: "Wing Hop — Ghost", cost: 450, kind: "skin", game: "flappy", skinId: "ghost" },
    { id: "skin:wing-hop-pixel", label: "Wing Hop — Pixel-8", cost: 500, kind: "skin", game: "flappy", skinId: "pixel" },
    { id: "skin:wing-hop-idol", label: "Wing Hop — Golden Idol", cost: 550, kind: "skin", game: "flappy", skinId: "idol" },
    { id: "skin:wing-hop-shadow", label: "Wing Hop — Shadow", cost: 500, kind: "skin", game: "flappy", skinId: "shadow" },
    { id: "skin:wing-hop-rainbow", label: "Wing Hop — Rainbow Trail", cost: 500, kind: "skin", game: "flappy", skinId: "rainbow" },
    { id: "skin:paper-claim-ink", label: "Paper Claim — Ink Drop", cost: 250, kind: "skin", game: "paper", skinId: "ink" },
    { id: "skin:paper-claim-blueprint", label: "Paper Claim — Blueprint", cost: 250, kind: "skin", game: "paper", skinId: "blueprint" },
    { id: "skin:paper-claim-honeycomb", label: "Paper Claim — Honeycomb", cost: 250, kind: "skin", game: "paper", skinId: "honeycomb" },
    { id: "skin:paper-claim-ocean", label: "Paper Claim — Ocean Tide", cost: 300, kind: "skin", game: "paper", skinId: "ocean" },
    { id: "skin:paper-claim-forest", label: "Paper Claim — Forest Sap", cost: 300, kind: "skin", game: "paper", skinId: "forest" },
    { id: "skin:paper-claim-candy", label: "Paper Claim — Candy Coat", cost: 300, kind: "skin", game: "paper", skinId: "candy" },
    { id: "skin:paper-claim-graffiti", label: "Paper Claim — Graffiti", cost: 350, kind: "skin", game: "paper", skinId: "graffiti" },
    { id: "skin:paper-claim-storm", label: "Paper Claim — Storm Cloud", cost: 350, kind: "skin", game: "paper", skinId: "storm" },
    { id: "skin:paper-claim-lava", label: "Paper Claim — Lava Flow", cost: 400, kind: "skin", game: "paper", skinId: "lava" },
    { id: "skin:paper-claim-ice", label: "Paper Claim — Ice Shard", cost: 400, kind: "skin", game: "paper", skinId: "ice" },
    { id: "skin:paper-claim-neon", label: "Paper Claim — Neon Grid", cost: 450, kind: "skin", game: "paper", skinId: "neon" },
    { id: "skin:paper-claim-pixel", label: "Paper Claim — Pixel Stamp", cost: 500, kind: "skin", game: "paper", skinId: "pixel" },
    { id: "skin:paper-claim-shadow", label: "Paper Claim — Shadow Mark", cost: 500, kind: "skin", game: "paper", skinId: "shadow" },
    { id: "skin:paper-claim-rainbow", label: "Paper Claim — Rainbow Paint", cost: 500, kind: "skin", game: "paper", skinId: "rainbow" },
    { id: "skin:paper-claim-gold", label: "Paper Claim — Gold Foil", cost: 550, kind: "skin", game: "paper", skinId: "gold" }
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
      lastPickupAt: 0,
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
        lastPickupAt: Math.max(0, Math.floor(Number(parsed.lastPickupAt) || 0)),
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

  function pickupMsLeft() {
    const last = readState().lastPickupAt || 0;
    if (!last) return 0;
    return Math.max(0, last + PICKUP_COOLDOWN_MS - Date.now());
  }

  function canClaimPickup() {
    return pickupMsLeft() <= 0;
  }

  function formatPickupWait(ms) {
    const left = Math.max(0, Math.ceil(Number(ms) || 0));
    if (left <= 0) return "ready";
    const totalSec = Math.ceil(left / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  }

  function rewardPickup() {
    const wait = pickupMsLeft();
    if (wait > 0) {
      return {
        ok: false,
        balance: getBalance(),
        gained: 0,
        reason: "pickup",
        cooldown: true,
        msLeft: wait,
        error: `Pickup ready again in ${formatPickupWait(wait)}.`
      };
    }
    const state = readState();
    state.lastPickupAt = Date.now();
    writeState(state);
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
    document.querySelectorAll("[data-hub-coins-pickup]").forEach((el) => {
      const ready = canClaimPickup();
      const wait = pickupMsLeft();
      if (el.tagName === "BUTTON") {
        el.disabled = !ready;
        el.textContent = ready
          ? `Pick up coin (+${REWARDS.pickup})`
          : `Pickup in ${formatPickupWait(wait)}`;
        el.title = ready
          ? `Grab +${REWARDS.pickup} coins (once per hour)`
          : `Come back in ${formatPickupWait(wait)}`;
      }
    });
  }

  function ensureHubBadge() {
    // Hub toolbar owns the Coins button; this only refreshes visible balances.
    refreshUi();
  }

  /** One-time owner grant — not listed in What's New. */
  const ICE_GRANT_FLAG = "hub-coins-ice-dragon-10k-v1";
  const ICE_GRANT_AMOUNT = 10000;
  /** One-time admin gift for Hjalte — not listed in What's New. */
  const HJALTE_GRANT_FLAG = "hub-coins-hjalte-1k-v1";
  const HJALTE_GRANT_AMOUNT = 1000;

  function normalizePlayerNameKey(name) {
    return String(name || "")
      .trim()
      .toLowerCase()
      .replace(/[\s-]+/g, "_");
  }

  function isIceDragonName(name) {
    return normalizePlayerNameKey(name) === "ice_dragon";
  }

  function isHjalteName(name) {
    return normalizePlayerNameKey(name) === "hjalte";
  }

  function maybeGrantNamedCoins(opts) {
    try {
      if (!canUseLocalStorage()) return false;
      const name =
        (typeof window.HubPlays?.getName === "function" && HubPlays.getName()) || "";
      if (!opts.matchName(name)) return false;
      const flagKey = `${opts.flag}:${walletKey()}`;
      if (localStorage.getItem(flagKey) === "done") return false;
      const amount = Math.max(0, Math.floor(Number(opts.amount) || 0));
      if (!amount) return false;
      const state = readState();
      state.balance += amount;
      state.lifetimeEarned += amount;
      writeState(state);
      localStorage.setItem(flagKey, "done");
      emit({
        type: "earn",
        amount,
        balance: state.balance,
        reason: opts.reason || "admin-grant"
      });
      try {
        window.showGamesMessage?.(`Admin grant: +${amount} coins`, 2800);
      } catch {}
      return true;
    } catch {
      return false;
    }
  }

  function maybeGrantIceDragonCoins() {
    return maybeGrantNamedCoins({
      matchName: isIceDragonName,
      flag: ICE_GRANT_FLAG,
      amount: ICE_GRANT_AMOUNT,
      reason: "owner-grant"
    });
  }

  function maybeGrantHjalteCoins() {
    return maybeGrantNamedCoins({
      matchName: isHjalteName,
      flag: HJALTE_GRANT_FLAG,
      amount: HJALTE_GRANT_AMOUNT,
      reason: "admin-grant"
    });
  }

  function maybeGrantPendingCoins() {
    maybeGrantIceDragonCoins();
    maybeGrantHjalteCoins();
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
    PICKUP_COOLDOWN_MS,
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
    canClaimPickup,
    pickupMsLeft,
    formatPickupWait,
    rewardAiQuest,
    canAiQuest,
    buy,
    getShop,
    hasPurchase,
    onChange,
    offChange,
    refreshUi,
    ensureHubBadge,
    readState,
    maybeGrantIceDragonCoins,
    maybeGrantHjalteCoins
  };

  function bootCoins() {
    maybeGrantPendingCoins();
    ensureHubBadge();
    refreshUi();
  }

  document.addEventListener("hub-username-ready", () => {
    maybeGrantPendingCoins();
    refreshUi();
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootCoins, { once: true });
  } else {
    bootCoins();
  }
  // HubPlays may finish loading after this file.
  setTimeout(maybeGrantPendingCoins, 400);
  setTimeout(maybeGrantPendingCoins, 2000);
})();
