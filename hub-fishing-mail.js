/**
 * hub-fishing-mail.js — claim player-to-player Fishing gifts while away from Fishing Idle.
 * Trades are handled live in fishing/script.js (need cooler/stash UI).
 *
 * Skips auto-claim on the fishing page.
 * window.HubFishingMail: start / stop / poll
 */
(function () {
  const SAVE_KEY = "fishing-save-v3";
  const CLAIMED_KEY = "fishing-player-mail-claimed-v1";
  const API = "https://mantledb.sh/v2/icedragon1st-mygames/fishing-player-mail";
  const DOC_ID = "fishing-player-mail";
  const TOKEN = "ice-fish-mail-9f3a";
  const POLL_MS = 10_000;
  const VARIANT_PRIMARY = ["silver", "gold", "diamond", "rainbow"];
  const MUTATIONS = ["toxic", "lava", "neon"];
  const CHEST_SOFT_MAX = 100;
  const LB_MAX = 50;

  function sb() {
    return window.HubSupabase && HubSupabase.ready ? HubSupabase : null;
  }

  let timer = 0;
  let lastFetch = 0;
  let started = false;

  function isFishingPage() {
    return /\/fishing(\/|$)/i.test(location.pathname || "");
  }

  function playerNameLower() {
    try {
      return String(
        window.HubPlays?.getName?.() || localStorage.getItem("hub-player-name") || ""
      )
        .trim()
        .toLowerCase();
    } catch {
      return "";
    }
  }

  function playerId() {
    try {
      return String(window.HubPlays?.getPlayerId?.() || localStorage.getItem("hub-player-id") || "");
    } catch {
      return "";
    }
  }

  function normalizeVariant(raw) {
    const v = String(raw || "").toLowerCase();
    return VARIANT_PRIMARY.includes(v) ? v : "";
  }

  function normalizeMutation(raw) {
    const v = String(raw || "").toLowerCase();
    return MUTATIONS.includes(v) ? v : "";
  }

  function readClaimed() {
    try {
      const raw = JSON.parse(localStorage.getItem(CLAIMED_KEY) || "[]");
      return new Set(Array.isArray(raw) ? raw.map(String) : []);
    } catch {
      return new Set();
    }
  }

  function writeClaimed(set) {
    try {
      localStorage.setItem(CLAIMED_KEY, JSON.stringify([...set].slice(-300)));
    } catch {}
  }

  function readSave() {
    try {
      const raw = JSON.parse(localStorage.getItem(SAVE_KEY) || "null");
      if (!raw || typeof raw !== "object") {
        return {
          coins: 25,
          cooler: [],
          caught: {},
          catches: 0,
          perfects: 0,
          moneyChestCount: 0,
          luckChestCount: 0,
          luckyBlockCount: 0,
          astralLuckyBlockCount: 0,
          zenithLuckyBlockCount: 0,
          lastTick: Date.now()
        };
      }
      if (!Array.isArray(raw.cooler)) raw.cooler = [];
      if (!raw.caught || typeof raw.caught !== "object") raw.caught = {};
      return raw;
    } catch {
      return null;
    }
  }

  function writeSave(state) {
    try {
      state.lastTick = Date.now();
      localStorage.setItem(SAVE_KEY, JSON.stringify(state));
    } catch {}
  }

  function markCaught(state, fishId, entry) {
    const id = String(fishId || "");
    if (!id) return;
    const prev = state.caught[id] && typeof state.caught[id] === "object" ? state.caught[id] : {};
    const rec = {
      any: true,
      base: !!prev.base,
      silver: !!prev.silver,
      gold: !!prev.gold,
      diamond: !!prev.diamond,
      rainbow: !!prev.rainbow,
      shiny: !!prev.shiny
    };
    const variant = normalizeVariant(entry.variant);
    const shiny = !!entry.shiny;
    if (!variant && !shiny) rec.base = true;
    if (variant) rec[variant] = true;
    if (shiny) rec.shiny = true;
    state.caught[id] = rec;
  }

  function grantMailItem(state, item) {
    const kind = String(item?.kind || "").toLowerCase();
    if (kind === "fish") {
      const fishId = String(item.fishId || "");
      if (!fishId) return 0;
      const entry = {
        id: fishId,
        saved: false,
        perfect: !!item.perfect,
        variant: normalizeVariant(item.variant),
        shiny: !!item.shiny,
        mutation: normalizeMutation(item.mutation)
      };
      state.cooler.push(entry);
      markCaught(state, fishId, entry);
      state.catches = Math.max(0, Math.floor(Number(state.catches) || 0) + 1);
      if (entry.perfect) state.perfects = Math.max(0, Math.floor(Number(state.perfects) || 0) + 1);
      return 1;
    }
    if (kind === "chest") {
      const chestKind = String(item.chestKind || "money") === "luck" ? "luck" : "money";
      const key = chestKind === "luck" ? "luckChestCount" : "moneyChestCount";
      const count = Math.min(50, Math.max(1, Number(item.count) || 1));
      const cur = Math.max(0, Math.floor(Number(state[key]) || 0));
      let added = 0;
      for (let i = 0; i < count; i += 1) {
        if (cur + added >= CHEST_SOFT_MAX) break;
        added += 1;
      }
      if (!added) return 0;
      state[key] = cur + added;
      return added;
    }
    if (kind === "luckyblock") {
      const t = String(item.lbType || "absolute").toLowerCase();
      const key =
        t === "zenith"
          ? "zenithLuckyBlockCount"
          : t === "astral"
            ? "astralLuckyBlockCount"
            : "luckyBlockCount";
      const count = Math.min(50, Math.max(1, Number(item.count) || 1));
      const cur = Math.max(0, Math.floor(Number(state[key]) || 0));
      let added = 0;
      for (let i = 0; i < count; i += 1) {
        if (cur + added >= LB_MAX) break;
        added += 1;
      }
      if (!added) return 0;
      state[key] = cur + added;
      return added;
    }
    return 0;
  }

  async function fetchDoc() {
    try {
      const api = sb();
      let data = null;
      if (api) {
        try {
          data = await api.getPrefer(DOC_ID, API);
        } catch {
          data = null;
        }
      } else {
        const res = await fetch(`${API}?t=${Date.now()}`, { cache: "no-store" });
        if (res.status === 404) return { token: TOKEN, gifts: {}, trades: {} };
        if (!res.ok) return null;
        data = await res.json();
      }
      if (!data || typeof data !== "object") return { token: TOKEN, gifts: {}, trades: {} };
      return {
        token: data.token || TOKEN,
        gifts: data.gifts && typeof data.gifts === "object" ? data.gifts : {},
        trades: data.trades && typeof data.trades === "object" ? data.trades : {}
      };
    } catch {
      return null;
    }
  }

  async function postDoc(doc) {
    const payload = {
      token: TOKEN,
      gifts: doc.gifts || {},
      trades: doc.trades || {}
    };
    try {
      const api = sb();
      if (api) {
        await api.pushPrefer(DOC_ID, payload, API);
        return true;
      }
      const res = await fetch(API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  async function poll() {
    if (isFishingPage()) return;
    const now = Date.now();
    if (now - lastFetch < POLL_MS) return;
    lastFetch = now;
    const doc = await fetchDoc();
    if (!doc) return;
    const me = playerNameLower();
    const myId = playerId();
    if (!me && !myId) return;
    const claimed = readClaimed();
    const state = readSave();
    if (!state) return;
    let gained = 0;
    const toMark = [];

    Object.values(doc.gifts || {}).forEach((g) => {
      if (!g || typeof g !== "object") return;
      if (g.claimed) return;
      const gid = String(g.id || "");
      if (!gid || claimed.has(gid)) return;
      const toName = String(g.toName || "").toLowerCase();
      const toId = String(g.toPlayerId || "");
      const forMe = (toId && myId && toId === myId) || (toName && me && toName === me);
      if (!forMe) return;
      const items = Array.isArray(g.items) ? g.items : [];
      if (!items.length) return;
      let added = 0;
      items.forEach((it) => {
        added += grantMailItem(state, it);
      });
      if (!added) return;
      gained += added;
      claimed.add(gid);
      toMark.push(gid);
    });

    if (!gained) return;
    writeClaimed(claimed);
    writeSave(state);

    const gifts = { ...(doc.gifts || {}) };
    toMark.forEach((gid) => {
      const g = gifts[gid];
      if (!g) return;
      gifts[gid] = {
        ...g,
        claimed: true,
        claimedBy: myId || me,
        claimedAt: Date.now()
      };
    });
    await postDoc({ gifts, trades: doc.trades || {} });

    try {
      window.HubNotifications?.push?.({
        title: "Fishing gift",
        body: gained === 1 ? "You received a gift." : `You received ${gained} gift items.`,
        href: "fishing/"
      });
    } catch {}
  }

  function start() {
    if (started || isFishingPage()) return;
    started = true;
    poll();
    if (timer) clearInterval(timer);
    timer = setInterval(poll, POLL_MS);
  }

  function stop() {
    started = false;
    if (timer) clearInterval(timer);
    timer = 0;
  }

  window.HubFishingMail = { start, stop, poll };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => setTimeout(start, 800));
  } else {
    setTimeout(start, 800);
  }
})();
