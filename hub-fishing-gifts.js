/**
 * hub-fishing-gifts.js — claim admin fish gifts while away from Fishing Idle.
 * Writes into localStorage fishing-save-v3 so fish are waiting in the cooler.
 *
 * Skips auto-claim on the fishing page (live game handles that).
 * window.HubFishingGifts: start / stop / poll
 */
(function () {
  const SAVE_KEY = "fishing-save-v3";
  const CLAIMED_KEY = "fishing-gifts-claimed-v1";
  const API = "https://mantledb.sh/v2/icedragon1st-mygames/fishing-gifts";
  const TOKEN = "ice-fish-gift-9f3a";
  const POLL_MS = 12_000;
  const VARIANT_PRIMARY = ["silver", "gold", "diamond", "rainbow"];

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
      localStorage.setItem(CLAIMED_KEY, JSON.stringify([...set].slice(-200)));
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
          lastTick: Date.now()
        };
      }
      if (!Array.isArray(raw.cooler)) raw.cooler = [];
      if (!raw.caught || typeof raw.caught !== "object") raw.caught = {};
      return raw;
    } catch {
      return {
        coins: 25,
        cooler: [],
        caught: {},
        catches: 0,
        perfects: 0,
        lastTick: Date.now()
      };
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

  function grantToSave(state, gift) {
    const fishId = String(gift.fishId || "");
    const item = String(gift.item || "").toLowerCase();
    const idLower = fishId.toLowerCase();
    let blockKey = "";
    if (
      item === "luckyblock-astral" ||
      idLower === "__luckyblock_astral__" ||
      idLower === "luckyblock-astral" ||
      idLower === "astralluckyblock"
    ) {
      blockKey = "astralLuckyBlockCount";
    } else if (
      item === "luckyblock" ||
      item === "luckyblock-absolute" ||
      idLower === "__luckyblock__" ||
      idLower === "luckyblock" ||
      idLower === "absoluteluckyblock"
    ) {
      blockKey = "luckyBlockCount";
    }
    if (blockKey) {
      const count = Math.min(50, Math.max(1, Number(gift.count) || 1));
      const max = 50;
      let added = 0;
      const cur = Math.max(0, Math.floor(Number(state[blockKey]) || 0));
      for (let i = 0; i < count; i += 1) {
        if (cur + added >= max) break;
        added += 1;
      }
      state[blockKey] = cur + added;
      return added;
    }
    if (!fishId) return 0;
    const count = Math.min(50, Math.max(1, Number(gift.count) || 1));
    const variant = normalizeVariant(gift.variant);
    const shiny = !!gift.shiny;
    const perfect = !!gift.perfect;
    for (let i = 0; i < count; i += 1) {
      const entry = { id: fishId, saved: false, perfect, variant, shiny };
      state.cooler.push(entry);
      markCaught(state, fishId, entry);
      state.catches = Math.max(0, Math.floor(Number(state.catches) || 0) + 1);
      if (perfect) state.perfects = Math.max(0, Math.floor(Number(state.perfects) || 0) + 1);
    }
    return count;
  }

  async function fetchDoc() {
    try {
      const res = await fetch(`${API}?t=${Date.now()}`, { cache: "no-store" });
      if (res.status === 404) return { token: TOKEN, gifts: {} };
      if (!res.ok) return null;
      const data = await res.json();
      if (!data || typeof data !== "object") return { token: TOKEN, gifts: {} };
      return {
        token: data.token || TOKEN,
        gifts: data.gifts && typeof data.gifts === "object" ? data.gifts : {}
      };
    } catch {
      return null;
    }
  }

  async function postDoc(gifts) {
    try {
      const res = await fetch(API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: TOKEN, gifts })
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  async function markClaimedRemote(giftId) {
    const doc = (await fetchDoc()) || { gifts: {} };
    const gifts = { ...(doc.gifts || {}) };
    const g = gifts[giftId];
    if (!g || g.claimed) return true;
    gifts[giftId] = {
      ...g,
      claimed: true,
      claimedBy: playerNameLower(),
      claimedAt: Date.now()
    };
    return postDoc(gifts);
  }

  function notify(gained, sampleId) {
    const id = String(sampleId || "");
    const isAstral =
      id === "__luckyblock_astral__" ||
      id === "luckyblock-astral" ||
      id === "astralluckyblock";
    const isAbsolute =
      id === "__luckyblock__" ||
      id === "luckyblock" ||
      id === "absoluteluckyblock" ||
      id === "luckyblock-absolute";
    const isBlock = isAstral || isAbsolute;
    const blockName = isAstral ? "Astral Lucky Block" : "Absolute Lucky Block";
    const body = isBlock
      ? gained === 1
        ? `A ${blockName} was added to your Fishing Idle stash.`
        : `${gained} ${blockName}s were added to your Fishing Idle stash.`
      : gained === 1
        ? `A fish was added to your Fishing Idle cooler${sampleId ? ` (${sampleId})` : ""}.`
        : `${gained} fish were added to your Fishing Idle cooler.`;
    try {
      window.HubNotifications?.push?.({
        kind: "gift",
        title: isBlock ? `${blockName} gift` : "Fishing gift",
        body,
        href: "fishing/index.html"
      });
    } catch {}
    try {
      window.HubSound?.play?.("win");
    } catch {}
  }

  async function poll(force = false) {
    if (isFishingPage()) return { gained: 0 };
    const now = Date.now();
    if (!force && now - lastFetch < POLL_MS) return { gained: 0 };
    lastFetch = now;

    const me = playerNameLower();
    const myId = playerId();
    if (!me && !myId) return { gained: 0 };

    const doc = await fetchDoc();
    if (!doc) return { gained: 0 };

    const claimed = readClaimed();
    const toClaim = [];
    let gained = 0;
    let sampleId = "";
    const state = readSave();

    Object.values(doc.gifts || {}).forEach((g) => {
      if (!g || typeof g !== "object" || g.claimed) return;
      const gid = String(g.id || "");
      if (!gid || claimed.has(gid)) return;
      const toName = String(g.toName || "").toLowerCase();
      const toId = String(g.toPlayerId || "");
      const forMe = (toName && toName === me) || (toId && myId && toId === myId);
      if (!forMe) return;
      const n = grantToSave(state, g);
      if (!n) return;
      gained += n;
      sampleId = String(
        g.item === "luckyblock-astral" || g.fishId === "__luckyblock_astral__"
          ? "__luckyblock_astral__"
          : g.item === "luckyblock" || g.fishId === "__luckyblock__"
            ? "__luckyblock__"
            : g.fishId || sampleId
      );
      claimed.add(gid);
      toClaim.push(gid);
    });

    if (!gained) return { gained: 0 };

    writeClaimed(claimed);
    writeSave(state);
    notify(gained, sampleId);
    toClaim.forEach((gid) => {
      markClaimedRemote(gid).catch(() => {});
    });
    return { gained, sampleId };
  }

  function start() {
    if (started || isFishingPage()) return;
    started = true;
    poll(true);
    if (timer) clearInterval(timer);
    timer = setInterval(() => poll(false), POLL_MS);
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) poll(true);
    });
  }

  function stop() {
    if (timer) clearInterval(timer);
    timer = 0;
    started = false;
  }

  window.HubFishingGifts = { start, stop, poll };

  function boot() {
    // Wait a tick so HubPlays name/id are ready.
    setTimeout(start, 400);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
