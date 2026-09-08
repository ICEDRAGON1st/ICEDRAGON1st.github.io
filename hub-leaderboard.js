/**
 * hub-leaderboard.js
 * Global per-game leaderboards via MantleDB.
 *
 * API (window.HubLeaderboard):
 *   .submit(gameId, score, { lowerBetter? }) — post personal best if improved
 *   .sync(force?) — fetch/merge remote boards
 *   .getBoard(gameId) — ranked array [{ rank, name, score, at, isYou, lowerBetter }]
 *   .formatScore(gameId, score) — display label
 *   .GAME_IDS — known game ids
 */
(function () {
  const NS = "icedragon1st-mygames";
  const PATH = "leaderboards";
  const API = `https://mantledb.sh/v2/${NS}/${PATH}`;
  const LOCAL_KEY = "hub-leaderboards-v1";
  const MAX_PER_GAME = 50;
  const SYNC_GAP_MS = 4000;

  const GAME_META = {
    wordle: { label: "Wordle", lowerBetter: false, unit: "wins" },
    space: { label: "Space Shooter", lowerBetter: false, unit: "score" },
    quiz: { label: "Quizmaster", lowerBetter: false, unit: "score" },
    breakout: { label: "Brick Breaker", lowerBetter: false, unit: "score" },
    hangman: { label: "Hangman", lowerBetter: false, unit: "streak" },
    "2048": { label: "2048", lowerBetter: false, unit: "score" },
    snake: { label: "Snake", lowerBetter: false, unit: "score" },
    memory: { label: "Memory Match", lowerBetter: true, unit: "time" },
    "connect-four": { label: "Connect Four", lowerBetter: false, unit: "wins" },
    math: { label: "Math Sprint", lowerBetter: false, unit: "score" },
    sudoku: { label: "Sudoku", lowerBetter: true, unit: "time" },
    flappy: { label: "Flappy Bird", lowerBetter: false, unit: "score" },
    tictactoe: { label: "Tic Tac Toe", lowerBetter: false, unit: "wins" },
    pixletris: { label: "Pixletris", lowerBetter: false, unit: "score" },
    clicker: { label: "Crystal Clicker", lowerBetter: false, unit: "compact" },
    stacker: { label: "Tower Stack", lowerBetter: false, unit: "score" },
    crossy: { label: "Lane Crosser", lowerBetter: false, unit: "score" },
    fishing: { label: "Fishing Idle", lowerBetter: false, unit: "catch" },
    cows: { label: "Cow Merge", lowerBetter: false, unit: "cow" },
    dino: { label: "Dino Run", lowerBetter: false, unit: "score" },
    mine: { label: "Mine Depth", lowerBetter: false, unit: "depth" },
    "mine-ore": { label: "Mine Best Ore", lowerBetter: false, unit: "ore" },
    "online-time": { label: "Time Online", lowerBetter: false, unit: "playtime" }
  };

  const GAME_IDS = Object.keys(GAME_META);

  let cache = { games: {} };
  let lastSync = 0;
  let submitQueue = Promise.resolve();
  let syncQueue = Promise.resolve();

  function meta(gameId) {
    return GAME_META[gameId] || { label: gameId, lowerBetter: false, unit: "score" };
  }

  function nameKey(name) {
    return String(name || "")
      .trim()
      .toLowerCase()
      .slice(0, 16);
  }

  function sanitizeName(raw) {
    if (typeof HubPlays !== "undefined" && HubPlays.sanitizeName) {
      return HubPlays.sanitizeName(raw);
    }
    return String(raw || "")
      .replace(/[<>&"'`]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 16);
  }

  function getPlayerName() {
    if (typeof HubPlays === "undefined") return "";
    const name = sanitizeName(HubPlays.getName() || "");
    if (!name) return "";
    if (/^guest-/i.test(name)) return "";
    if (name.toLowerCase() === "player") return "";
    return name;
  }

  function getPlayerId() {
    if (typeof HubPlays !== "undefined" && HubPlays.getPlayerId) {
      return HubPlays.getPlayerId();
    }
    return "";
  }

  function isBetter(a, b, lowerBetter) {
    if (typeof a !== "number" || !Number.isFinite(a)) return false;
    if (typeof b !== "number" || !Number.isFinite(b)) return true;
    return lowerBetter ? a < b : a > b;
  }

  function formatSeconds(total) {
    const s = Math.max(0, Math.floor(total));
    const m = Math.floor(s / 60);
    const r = s % 60;
    return m > 0 ? `${m}:${String(r).padStart(2, "0")}` : `${r}s`;
  }

  function formatPlaytime(total) {
    const s = Math.max(0, Math.floor(total));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const r = s % 60;
    const ss = String(r).padStart(2, "0");
    if (h > 0) return `${h}h ${m}m ${ss}s`;
    if (m > 0) return `${m}m ${ss}s`;
    return `${r}s`;
  }

  const COMPACT_SUFFIXES = [
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

  function formatCompact(n) {
    let v = Math.abs(Number(n) || 0);
    if (!Number.isFinite(v)) return v > 0 ? "∞" : "0";
    if (v <= 0) return "0";
    if (v < 1000) return String(Math.floor(v));
    let tier = 0;
    while (v >= 1000 && tier < COMPACT_SUFFIXES.length - 1) {
      v /= 1000;
      tier += 1;
    }
    if (v >= 1000) {
      return (Math.abs(Number(n)) || 0).toExponential(2).replace("+", "");
    }
    const digits = v >= 100 ? 0 : v >= 10 ? 1 : 2;
    let text = v.toFixed(digits);
    text = text.replace(/\.0+$/, "").replace(/(\.\d*[1-9])0+$/, "$1");
    return `${text}${COMPACT_SUFFIXES[tier]}`;
  }

  // Fishing Idle: leaderboard = best single catch (rarity + base value encoded).
  const FISHING_CATCH_FISH = [
    { id: "minnow", name: "Minnow", rarity: "common", value: 3 },
    { id: "perch", name: "Perch", rarity: "common", value: 5 },
    { id: "bluegill", name: "Bluegill", rarity: "common", value: 6 },
    { id: "sardine", name: "Sardine", rarity: "common", value: 4 },
    { id: "smelt", name: "Smelt", rarity: "common", value: 5 },
    { id: "carp", name: "Carp", rarity: "common", value: 7 },
    { id: "roach", name: "Roach", rarity: "common", value: 4 },
    { id: "goby", name: "Goby", rarity: "common", value: 6 },
    { id: "trout", name: "Trout", rarity: "uncommon", value: 14 },
    { id: "bass", name: "Bass", rarity: "uncommon", value: 18 },
    { id: "catfish", name: "Catfish", rarity: "uncommon", value: 22 },
    { id: "walleye", name: "Walleye", rarity: "uncommon", value: 20 },
    { id: "snapper", name: "Snapper", rarity: "uncommon", value: 24 },
    { id: "mackerel", name: "Mackerel", rarity: "uncommon", value: 16 },
    { id: "cod", name: "Cod", rarity: "uncommon", value: 19 },
    { id: "flounder", name: "Flounder", rarity: "uncommon", value: 21 },
    { id: "salmon", name: "Salmon", rarity: "rare", value: 45 },
    { id: "pike", name: "Pike", rarity: "rare", value: 55 },
    { id: "mahi", name: "Mahi-Mahi", rarity: "rare", value: 60 },
    { id: "grouper", name: "Grouper", rarity: "rare", value: 70 },
    { id: "barracuda", name: "Barracuda", rarity: "rare", value: 65 },
    { id: "sturgeon", name: "Sturgeon", rarity: "rare", value: 80 },
    { id: "eel", name: "Moray Eel", rarity: "rare", value: 58 },
    { id: "tuna", name: "Tuna", rarity: "epic", value: 120 },
    { id: "marlin", name: "Marlin", rarity: "epic", value: 180 },
    { id: "swordfish", name: "Swordfish", rarity: "epic", value: 200 },
    { id: "shark", name: "Reef Shark", rarity: "epic", value: 240 },
    { id: "ray", name: "Manta Ray", rarity: "epic", value: 220 },
    { id: "octopus", name: "Giant Octopus", rarity: "epic", value: 260 },
    { id: "golden", name: "Golden Koi", rarity: "legendary", value: 500 },
    { id: "leviathan", name: "Leviathan Fry", rarity: "legendary", value: 900 },
    { id: "moonfish", name: "Moonfish", rarity: "legendary", value: 650 },
    { id: "dragonet", name: "Sea Dragonet", rarity: "legendary", value: 780 },
    { id: "crystal", name: "Crystal Pike", rarity: "legendary", value: 850 },
    { id: "tidelord", name: "Tide Lord", rarity: "mythic", value: 2500 },
    { id: "abyssking", name: "Abyss King", rarity: "mythic", value: 4000 },
    { id: "starwhale", name: "Star Whale", rarity: "mythic", value: 6000 },
    { id: "worldfin", name: "Worldfin", rarity: "mythic", value: 9000 },
    { id: "ghostfin", name: "Ghostfin", rarity: "secret", value: 25000 },
    { id: "nullfish", name: "Nullfish", rarity: "secret", value: 50000 },
    { id: "eclipse", name: "Eclipse Eel", rarity: "secret", value: 80000 },
    { id: "forgotten", name: "The Forgotten", rarity: "secret", value: 120000 },
    { id: "seraph", name: "Seraph Ray", rarity: "divine", value: 250000 },
    { id: "halo", name: "Halo Carp", rarity: "divine", value: 400000 },
    { id: "oracle", name: "Oracle Koi", rarity: "divine", value: 650000 },
    { id: "timeless", name: "Timeless Trout", rarity: "eternal", value: 1500000 },
    { id: "foreverfin", name: "Foreverfin", rarity: "eternal", value: 2800000 },
    { id: "aeon", name: "Aeon Shark", rarity: "eternal", value: 4500000 },
    { id: "nebula", name: "Nebula Nettle", rarity: "cosmic", value: 12000000 },
    { id: "quasar", name: "Quasar Cod", rarity: "cosmic", value: 25000000 },
    { id: "omnifin", name: "Omnifin", rarity: "cosmic", value: 50000000 }
  ];

  const FISHING_RARITY_RANK = {
    common: 1,
    uncommon: 2,
    rare: 3,
    epic: 4,
    legendary: 5,
    mythic: 6,
    secret: 7,
    divine: 8,
    eternal: 9,
    cosmic: 10
  };

  function fishingCatchScore(fish) {
    if (!fish) return 0;
    const rank = FISHING_RARITY_RANK[fish.rarity] || 1;
    return rank * 100000 + Math.max(0, Math.floor(Number(fish.value) || 0));
  }

  function formatFishingCatch(score) {
    const n = Math.floor(Number(score) || 0);
    if (n <= 0) return "—";
    const fish = FISHING_CATCH_FISH.find((f) => fishingCatchScore(f) === n);
    if (fish) return `${fish.rarity} · ${fish.name}`;
    const rank = Math.floor(n / 100000);
    const rarity =
      Object.keys(FISHING_RARITY_RANK).find((k) => FISHING_RARITY_RANK[k] === rank) || "catch";
    return rarity;
  }

  const COW_MERGE_TIERS = [
    "",
    "Calf",
    "Heifer",
    "Dairy Cow",
    "Prize Cow",
    "Super Cow",
    "Mega Cow",
    "Ultra Cow",
    "Golden Cow",
    "Diamond Cow",
    "Rainbow Cow",
    "Crystal Cow",
    "Neon Cow",
    "Cosmic Cow",
    "Divine Cow",
    "Eternal Cow",
    "Mythic Cow",
    "Omega Cow",
    "Abyss Cow",
    "Galaxy Cow",
    "Cowmageddon"
  ];

  function formatCowTier(score) {
    const n = Math.floor(Number(score) || 0);
    if (n <= 0) return "—";
    const name = COW_MERGE_TIERS[n] || `Tier ${n}`;
    return `${name}`;
  }

  const MINE_ORES = [
    { id: "dirt", name: "Dirt", emoji: "🪨", value: 1 },
    { id: "coal", name: "Coal", emoji: "⬛", value: 4 },
    { id: "copper", name: "Copper", emoji: "🟠", value: 10 },
    { id: "iron", name: "Iron", emoji: "⚙️", value: 22 },
    { id: "silver", name: "Silver", emoji: "⚪", value: 48 },
    { id: "gold", name: "Gold", emoji: "🥇", value: 110 },
    { id: "gem", name: "Gem", emoji: "💎", value: 260 },
    { id: "mythril", name: "Mythril", emoji: "🔷", value: 650 },
    { id: "void", name: "Void Ore", emoji: "🌑", value: 1800 },
    { id: "star", name: "Starcore", emoji: "✨", value: 5000 }
  ];

  function formatMineOre(score) {
    const n = Math.floor(Number(score) || 0);
    if (n <= 0) return "—";
    const ore = MINE_ORES.find((o) => o.value === n) || MINE_ORES.filter((o) => o.value <= n).pop();
    if (!ore) return `Ore ${n}`;
    return `${ore.emoji} ${ore.name}`;
  }

  function formatScore(gameId, score) {
    const m = meta(gameId);
    const n = Number(score);
    if (!Number.isFinite(n) || n <= 0) return "—";
    if (m.unit === "time") return formatSeconds(n);
    if (m.unit === "playtime") return formatPlaytime(n);
    if (m.unit === "wins") return `${Math.floor(n)} win${Math.floor(n) === 1 ? "" : "s"}`;
    if (m.unit === "streak") return `Streak ${Math.floor(n)}`;
    if (m.unit === "catch" || gameId === "fishing") return formatFishingCatch(n);
    if (m.unit === "cow" || gameId === "cows") return formatCowTier(n);
    if (m.unit === "depth" || gameId === "mine") return `Best ${Math.floor(n)}m`;
    if (m.unit === "ore" || gameId === "mine-ore") return formatMineOre(n);
    if (gameId === "clicker" || m.unit === "compact") return `Best ${formatCompact(n)}`;
    return `Best ${Math.floor(n)}`;
  }

  function loadLocal() {
    try {
      const data = JSON.parse(localStorage.getItem(LOCAL_KEY));
      if (data && data.games && typeof data.games === "object") {
        return {
          games: data.games,
          resets: data.resets && typeof data.resets === "object" ? data.resets : {}
        };
      }
    } catch {}
    return { games: {}, resets: {} };
  }

  function saveLocal(data) {
    cache = {
      games: data.games || {},
      resets: data.resets && typeof data.resets === "object" ? data.resets : {}
    };
    try {
      localStorage.setItem(LOCAL_KEY, JSON.stringify(cache));
    } catch {}
  }

  async function fetchJson(url) {
    const res = await fetch(url, { cache: "no-store" });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error("fetch failed");
    return res.json();
  }

  async function postJson(url, data) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error("push failed");
  }

  async function fetchRemote() {
    const data = await fetchJson(API);
    if (!data || typeof data !== "object") return { games: {}, resets: {} };
    const games = data.games && typeof data.games === "object" ? data.games : {};
    const resets = data.resets && typeof data.resets === "object" ? data.resets : {};
    return { games, resets };
  }

  function normalizeEntry(entry, fallbackLower) {
    if (!entry || typeof entry !== "object") return null;
    const name = sanitizeName(entry.name || "");
    const score = Number(entry.score);
    if (!name || !Number.isFinite(score)) return null;
    return {
      name,
      score,
      at: Number(entry.at) || 0,
      playerId: String(entry.playerId || ""),
      lowerBetter: typeof entry.lowerBetter === "boolean" ? entry.lowerBetter : !!fallbackLower
    };
  }

  function pickBetterEntry(a, b, lowerBetter) {
    if (!a) return b;
    if (!b) return a;
    if (isBetter(b.score, a.score, lowerBetter)) return b;
    if (isBetter(a.score, b.score, lowerBetter)) return a;
    return (b.at || 0) >= (a.at || 0) ? b : a;
  }

  /** One row per playerId (and orphan name keys without an id). */
  function consolidateBoard(boardMap, lowerBetter) {
    const byId = {};
    const orphans = {};
    Object.values(boardMap || {}).forEach((raw) => {
      const entry = normalizeEntry(raw, lowerBetter);
      if (!entry) return;
      if (!entry.playerId) {
        const key = nameKey(entry.name);
        orphans[key] = pickBetterEntry(orphans[key], entry, lowerBetter);
        return;
      }
      const prev = byId[entry.playerId];
      if (!prev) {
        byId[entry.playerId] = entry;
        return;
      }
      const better = pickBetterEntry(prev, entry, lowerBetter);
      const latestName = (entry.at || 0) >= (prev.at || 0) ? entry.name : prev.name;
      byId[entry.playerId] = { ...better, name: latestName };
    });
    const out = { ...orphans };
    Object.values(byId).forEach((entry) => {
      const key = nameKey(entry.name);
      const existing = out[key];
      if (!existing) {
        out[key] = entry;
        return;
      }
      if (!existing.playerId || existing.playerId === entry.playerId) {
        const better = pickBetterEntry(existing, entry, lowerBetter);
        out[key] = { ...better, name: entry.name, playerId: entry.playerId || better.playerId };
        return;
      }
      out[key] = pickBetterEntry(existing, entry, lowerBetter);
    });
    return out;
  }

  function trimBoard(boardMap, lowerBetter) {
    const consolidated = consolidateBoard(boardMap, lowerBetter);
    const entries = Object.entries(consolidated)
      .map(([key, entry]) => ({ key, entry: normalizeEntry(entry, lowerBetter) }))
      .filter((x) => x.entry);
    entries.sort((a, b) => {
      if (a.entry.score !== b.entry.score) {
        return lowerBetter ? a.entry.score - b.entry.score : b.entry.score - a.entry.score;
      }
      return (a.entry.at || 0) - (b.entry.at || 0);
    });
    const out = {};
    entries.slice(0, MAX_PER_GAME).forEach(({ entry }) => {
      out[nameKey(entry.name)] = entry;
    });
    return out;
  }

  function rekeyPlayerOnBoard(boardMap, playerId, newName, lowerBetter) {
    const name = sanitizeName(newName);
    const id = String(playerId || "");
    if (!id || !name) return boardMap || {};
    const nextKey = nameKey(name);
    const board = { ...(boardMap || {}) };
    let best = null;
    Object.keys(board).forEach((key) => {
      const entry = normalizeEntry(board[key], lowerBetter);
      if (!entry || entry.playerId !== id) return;
      best = pickBetterEntry(best, entry, lowerBetter);
      delete board[key];
    });
    if (!best) return board;
    const existing = normalizeEntry(board[nextKey], lowerBetter);
    if (existing && existing.playerId && existing.playerId !== id) {
      // Someone else already owns this name slot — keep the better score.
      board[nextKey] = pickBetterEntry(existing, { ...best, name }, lowerBetter);
      return board;
    }
    board[nextKey] = {
      ...best,
      name,
      playerId: id
    };
    return board;
  }

  function mergeBoards(a, b) {
    const games = {};
    const ids = new Set([
      ...Object.keys((a && a.games) || {}),
      ...Object.keys((b && b.games) || {}),
      ...GAME_IDS
    ]);
    ids.forEach((gameId) => {
      const lowerBetter = meta(gameId).lowerBetter;
      const merged = {};
      const left = ((a && a.games) || {})[gameId] || {};
      const right = ((b && b.games) || {})[gameId] || {};
      [...Object.keys(left), ...Object.keys(right)].forEach((key) => {
        const le = normalizeEntry(left[key], lowerBetter);
        const re = normalizeEntry(right[key], lowerBetter);
        if (!le && !re) return;
        if (!le) {
          merged[key] = re;
          return;
        }
        if (!re) {
          merged[key] = le;
          return;
        }
        merged[key] = pickBetterEntry(le, re, lowerBetter);
      });
      games[gameId] = trimBoard(merged, lowerBetter);
    });
    const resets = { ...((a && a.resets) || {}), ...((b && b.resets) || {}) };
    return applyResets({ games, resets });
  }

  function applyResets(data) {
    const games = { ...(data.games || {}) };
    const resets = { ...(data.resets || {}) };
    // One-time: wipe Hjalte from Sudoku only (other games untouched).
    const resetKey = "sudoku:hjalte";
    if (!resets[resetKey]) resets[resetKey] = Date.now();
    const cutAt = Number(resets[resetKey]);
    const sudoku = { ...(games.sudoku || {}) };
    const hjalteEntry = sudoku.hjalte;
    if (hjalteEntry && (!hjalteEntry.at || Number(hjalteEntry.at) <= cutAt)) {
      delete sudoku.hjalte;
    }
    games.sudoku = sudoku;

    // One-time: wipe ALL Crystal Clicker leaderboard scores (other games untouched).
    const clickerWipeKey = "clicker:full-wipe-v1";
    const CLICKER_WIPE_AT = Date.UTC(2026, 8, 6, 16, 0, 0); // 2026-09-06 16:00 UTC
    if (!resets[clickerWipeKey] || Number(resets[clickerWipeKey]) > CLICKER_WIPE_AT) {
      resets[clickerWipeKey] = CLICKER_WIPE_AT;
    }
    const clickerCut = Number(resets[clickerWipeKey]) || CLICKER_WIPE_AT;
    const clickerBoard = { ...(games.clicker || {}) };
    Object.keys(clickerBoard).forEach((key) => {
      const at = Number(clickerBoard[key]?.at) || 0;
      if (at <= clickerCut) delete clickerBoard[key];
    });
    games.clicker = clickerBoard;

    // One-time: wipe ICE_DRAGON from Crystal Clicker only (other games untouched).
    // Cut must stay at/just after the wiped score — not in the future, or new posts get deleted.
    const iceClickerWipeKey = "clicker:ice_dragon-v1";
    const ICE_CLICKER_WIPE_AT = 1788721147325; // wiped ICE_DRAGON entry timestamp
    resets[iceClickerWipeKey] = ICE_CLICKER_WIPE_AT;
    const iceCut = ICE_CLICKER_WIPE_AT;
    const iceBoard = { ...(games.clicker || {}) };
    Object.keys(iceBoard).forEach((key) => {
      const entry = iceBoard[key];
      if (!entry) return;
      const keyName = nameKey(entry.name || key);
      const isIce =
        key === "ice_dragon" ||
        keyName === "ice_dragon" ||
        entry.playerId === "p-mtlztdny-r28rrb";
      const at = Number(entry.at) || 0;
      if (isIce && at <= iceCut) delete iceBoard[key];
    });
    games.clicker = iceBoard;

    // One-time: wipe Fishing Idle lifetime-coin board; new board is best catch.
    const fishingWipeKey = "fishing:catch-board-v1";
    const FISHING_WIPE_AT = Date.UTC(2026, 8, 7, 18, 40, 0); // 2026-09-07 18:40 UTC
    if (!resets[fishingWipeKey] || Number(resets[fishingWipeKey]) > FISHING_WIPE_AT) {
      resets[fishingWipeKey] = FISHING_WIPE_AT;
    }
    const fishingCut = Number(resets[fishingWipeKey]) || FISHING_WIPE_AT;
    const fishingBoard = { ...(games.fishing || {}) };
    Object.keys(fishingBoard).forEach((key) => {
      const at = Number(fishingBoard[key]?.at) || 0;
      if (at <= fishingCut) delete fishingBoard[key];
    });
    games.fishing = fishingBoard;

    // Seed ICE_DRAGON Fishing Idle best catch as Abyss King (mythic).
    const iceFishingSeedKey = "fishing:ice_dragon-abyss-king-v1";
    const ABYSS_KING_SCORE = 604000; // mythic rank*100000 + 4000
    const ICE_FISHING_ID = "p-mtlztdny-r28rrb";
    if (!resets[iceFishingSeedKey]) resets[iceFishingSeedKey] = Date.now();
    const iceFishAt = Math.max(
      Number(resets[iceFishingSeedKey]) || 0,
      FISHING_WIPE_AT + 1
    );
    const seededFish = { ...(games.fishing || {}) };
    Object.keys(seededFish).forEach((key) => {
      const entry = seededFish[key];
      if (!entry) return;
      const keyName = nameKey(entry.name || key);
      const isIce =
        key === "ice_dragon" ||
        keyName === "ice_dragon" ||
        entry.playerId === ICE_FISHING_ID;
      if (isIce && key !== "ice_dragon") delete seededFish[key];
    });
    seededFish.ice_dragon = {
      name: "ICE_DRAGON",
      score: ABYSS_KING_SCORE,
      at: iceFishAt,
      playerId: ICE_FISHING_ID,
      lowerBetter: false
    };
    games.fishing = seededFish;

    // Sticky name binds: keep scores under the player's current name after renames.
    // Seed: Gustav → Dellekai (same playerId).
    const dellekaiBind = "namebind:p-mtnfme96-6bpve6";
    if (!resets[dellekaiBind] || typeof resets[dellekaiBind] !== "string") {
      resets[dellekaiBind] = "Dellekai";
    }
    Object.entries(resets).forEach(([key, value]) => {
      if (!key.startsWith("namebind:")) return;
      const playerId = key.slice("namebind:".length);
      const newName = typeof value === "string" ? sanitizeName(value) : "";
      if (!playerId || !newName) return;
      Object.keys(games).forEach((gameId) => {
        const lowerBetter = meta(gameId).lowerBetter;
        games[gameId] = trimBoard(
          rekeyPlayerOnBoard(games[gameId], playerId, newName, lowerBetter),
          lowerBetter
        );
      });
    });

    return { games, resets };
  }

  async function clearPlayer(gameId, playerName) {
    const key = nameKey(playerName);
    if (!gameId || !key) return false;
    const run = async () => {
      await sync(true);
      const games = { ...(cache.games || {}) };
      const board = { ...(games[gameId] || {}) };
      delete board[key];
      games[gameId] = board;
      const resets = { ...(cache.resets || {}) };
      const resetKey = `${gameId}:${key}`;
      if (!resets[resetKey]) resets[resetKey] = Date.now();
      const next = applyResets({ games, resets });
      saveLocal(next);
      try {
        const remote = await fetchRemote();
        const merged = mergeBoards(loadLocal(), remote);
        saveLocal(merged);
        await postJson(API, merged);
      } catch {}
      lastSync = Date.now();
      return true;
    };
    submitQueue = submitQueue.then(run, run);
    return submitQueue;
  }

  /**
   * Move every score owned by playerId onto newName (e.g. after a rename).
   */
  async function rebindPlayerName(playerId, newName) {
    const id = String(playerId || "");
    const name = sanitizeName(newName);
    if (!id || !name || /^guest-/i.test(name) || name.toLowerCase() === "player") {
      return false;
    }
    const run = async () => {
      await sync(true);
      const games = { ...(cache.games || {}) };
      const resets = { ...(cache.resets || {}) };
      // Drop older binds for this playerId, then set the current name.
      Object.keys(resets).forEach((key) => {
        if (key === `namebind:${id}` || key.startsWith(`namebind:${id}:`)) {
          delete resets[key];
        }
      });
      resets[`namebind:${id}`] = name;

      Object.keys(games).forEach((gameId) => {
        const lowerBetter = meta(gameId).lowerBetter;
        games[gameId] = trimBoard(
          rekeyPlayerOnBoard(games[gameId], id, name, lowerBetter),
          lowerBetter
        );
      });
      const next = applyResets({ games, resets });
      saveLocal(next);
      try {
        const remote = await fetchRemote();
        const merged = mergeBoards(loadLocal(), remote);
        // Ensure our bind wins after merge.
        merged.resets = { ...(merged.resets || {}), [`namebind:${id}`]: name };
        const rebound = applyResets(merged);
        saveLocal(rebound);
        await postJson(API, rebound);
      } catch {}
      lastSync = Date.now();
      return true;
    };
    submitQueue = submitQueue.then(run, run);
    return submitQueue;
  }

  async function sync(force = false) {
    if (!force && Date.now() - lastSync < SYNC_GAP_MS) return cache;
    const run = async () => {
      let remote = { games: {}, resets: {} };
      try {
        remote = await fetchRemote();
      } catch {
        remote = { games: {}, resets: {} };
      }
      // Re-read AFTER the network wait so live Time Online bumps aren't wiped.
      const local = loadLocal();
      const merged = mergeBoards(local, remote);
      saveLocal(merged);
      try {
        await postJson(API, merged);
      } catch {
        // offline — local still works
      }
      lastSync = Date.now();
      return merged;
    };
    // Serialize syncs; never skip a forced sync while one is in flight.
    syncQueue = syncQueue.then(run, run);
    return syncQueue;
  }

  function getBoard(gameId) {
    const lowerBetter = meta(gameId).lowerBetter;
    const board = ((cache.games || {})[gameId]) || ((loadLocal().games || {})[gameId]) || {};
    const me = nameKey(getPlayerName());
    const rows = Object.values(board)
      .map((entry) => normalizeEntry(entry, lowerBetter))
      .filter(Boolean)
      .sort((a, b) => {
        if (a.score !== b.score) {
          return lowerBetter ? a.score - b.score : b.score - a.score;
        }
        return (a.at || 0) - (b.at || 0);
      });
    return rows.map((entry, i) => ({
      rank: i + 1,
      name: entry.name,
      score: entry.score,
      at: entry.at,
      lowerBetter,
      label: formatScore(gameId, entry.score),
      isYou: me && nameKey(entry.name) === me
    }));
  }

  async function submit(gameId, score, opts = {}) {
    const n = Number(score);
    if (!GAME_META[gameId] || !Number.isFinite(n) || n <= 0) return false;
    const name = getPlayerName();
    if (!name) return false;

    const lowerBetter =
      typeof opts.lowerBetter === "boolean" ? opts.lowerBetter : meta(gameId).lowerBetter;

    const run = async () => {
      await sync(true);
      const key = nameKey(name);
      const games = { ...(cache.games || {}) };
      const board = { ...(games[gameId] || {}) };
      const prev = normalizeEntry(board[key], lowerBetter);
      if (prev && !isBetter(n, prev.score, lowerBetter)) {
        return false;
      }
      const me = getPlayerId();
      // Drop old aliases for this same browser so renames don't leave duplicates.
      if (me) {
        Object.keys(board).forEach((k) => {
          if (k === key) return;
          if (board[k]?.playerId === me) delete board[k];
        });
      }
      board[key] = {
        name,
        score: n,
        at: Date.now(),
        playerId: me,
        lowerBetter
      };
      games[gameId] = trimBoard(board, lowerBetter);
      const next = applyResets({
        games,
        resets: { ...(cache.resets || {}) }
      });
      saveLocal(next);
      try {
        const remote = await fetchRemote();
        // Prefer freshest local (includes Time Online ticks during the fetch).
        const merged = mergeBoards(loadLocal(), remote);
        saveLocal(merged);
        await postJson(API, merged);
      } catch {
        // keep local
      }
      lastSync = Date.now();
      return true;
    };

    submitQueue = submitQueue.then(run, run);
    return submitQueue;
  }

  /** Update local board cache only (for smooth 1s UI); no network. */
  function bumpLocal(gameId, score) {
    const n = Number(score);
    if (!GAME_META[gameId] || !Number.isFinite(n) || n <= 0) return false;
    const name = getPlayerName();
    if (!name) return false;
    const lowerBetter = meta(gameId).lowerBetter;
    const key = nameKey(name);
    const games = { ...(cache.games || {}) };
    const board = { ...(games[gameId] || {}) };
    const prev = normalizeEntry(board[key], lowerBetter);
    if (prev && !isBetter(n, prev.score, lowerBetter)) return false;
    const me = getPlayerId();
    if (me) {
      Object.keys(board).forEach((k) => {
        if (k === key) return;
        if (board[k]?.playerId === me) delete board[k];
      });
    }
    board[key] = {
      name,
      score: n,
      at: Date.now(),
      playerId: me,
      lowerBetter
    };
    games[gameId] = trimBoard(board, lowerBetter);
    saveLocal({
      games,
      resets: { ...(cache.resets || {}) }
    });
    return true;
  }

  function getMyScore(gameId) {
    if (!GAME_META[gameId]) return 0;
    const lowerBetter = meta(gameId).lowerBetter;
    const board = ((cache.games || {})[gameId]) || {};
    const meName = nameKey(getPlayerName());
    const meId = getPlayerId();
    let best = 0;
    Object.values(board).forEach((raw) => {
      const entry = normalizeEntry(raw, lowerBetter);
      if (!entry) return;
      const mine =
        (meName && nameKey(entry.name) === meName) ||
        (meId && entry.playerId && entry.playerId === meId);
      if (!mine) return;
      best = Math.max(best, Number(entry.score) || 0);
    });
    return best;
  }

  // Seed cache from local on load, then sync so the Sudoku Hjalte wipe is pushed once.
  cache = applyResets(loadLocal());
  saveLocal(cache);
  sync(true).catch(() => {});

  window.HubLeaderboard = {
    submit,
    sync,
    getBoard,
    getMyScore,
    clearPlayer,
    rebindPlayerName,
    formatScore,
    bumpLocal,
    GAME_IDS,
    GAME_META
  };
})();
