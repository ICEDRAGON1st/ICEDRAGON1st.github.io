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
  const SUPABASE_DOC_ID = "leaderboards";

  function supabaseReady() {
    return !!(window.HubSupabase && HubSupabase.ready && HubSupabase.getDoc && HubSupabase.upsertDoc);
  }

  // One-time: clear local Ramp Rush high score for everyone (leaderboard wipe companion).
  try {
    const RAMP_LOCAL_WIPE = "hub-ramp-local-wipe-v1";
    if (localStorage.getItem(RAMP_LOCAL_WIPE) !== "done") {
      localStorage.removeItem("ramp-rush-high-score");
      localStorage.setItem(RAMP_LOCAL_WIPE, "done");
    }
  } catch {}

  const GAME_META = {
    wordle: { label: "Guessword", lowerBetter: false, unit: "wins" },
    space: { label: "Space Shooter", lowerBetter: false, unit: "score" },
    quiz: { label: "Quizmaster", lowerBetter: false, unit: "score" },
    breakout: { label: "Bounce Break", lowerBetter: false, unit: "score" },
    hangman: { label: "Hangman", lowerBetter: false, unit: "streak" },
    "2048": { label: "Block Merge", lowerBetter: false, unit: "score" },
    snake: { label: "Snake", lowerBetter: false, unit: "score" },
    memory: { label: "Memory Match", lowerBetter: true, unit: "time" },
    "connect-four": { label: "Drop Four", lowerBetter: false, unit: "wins" },
    math: { label: "Math Sprint", lowerBetter: false, unit: "score" },
    sudoku: { label: "Sudoku", lowerBetter: true, unit: "time" },
    flappy: { label: "Wing Hop", lowerBetter: false, unit: "score" },
    tictactoe: { label: "Tic Tac Toe", lowerBetter: false, unit: "wins" },
    pixletris: { label: "Pixel Drop", lowerBetter: false, unit: "score" },
    clicker: { label: "Crystal Clicker", lowerBetter: false, unit: "compact" },
    stacker: { label: "Tower Stack", lowerBetter: false, unit: "score" },
    crossy: { label: "Cross Walk", lowerBetter: false, unit: "score" },
    fishing: { label: "Fishing Idle", lowerBetter: false, unit: "catch" },
    cows: { label: "Cow Merge", lowerBetter: false, unit: "cow" },
    dino: { label: "Runosaur", lowerBetter: false, unit: "score" },
    ramp: { label: "Ramp Rush", lowerBetter: false, unit: "score" },
    guac: { label: "Guac-A-Mole", lowerBetter: false, unit: "score" },
    bubble: { label: "Bubble Pop Relay", lowerBetter: false, unit: "score" },
    cafe: { label: "Cafe Queue", lowerBetter: false, unit: "score" },
    garden: { label: "Garden Snap", lowerBetter: false, unit: "score" },
    blockblast: { label: "Block Sweep", lowerBetter: false, unit: "score" },
    lemmings: { label: "Dudes", lowerBetter: false, unit: "score" },
    mine: { label: "Mine Depth", lowerBetter: false, unit: "depth" },
    "mine-ore": { label: "Mine Best Ore", lowerBetter: false, unit: "ore" },
    "online-time": { label: "Time Online", lowerBetter: false, unit: "playtime" }
  };

  const GAME_IDS = Object.keys(GAME_META);

  /** Owner accounts never earn Hub Points — others rank as if these slots were empty. */
  const POINTS_EXCLUDED_KEYS = new Set([
    "ice_dragon",
    "ice_dragon phone",
    "ice_dragon alt"
  ]);

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

  // Fishing Idle: leaderboard = best single catch (rarity + variants + value).
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
    { id: "choirfin", name: "Choirfin", rarity: "divine", value: 900000 },
    { id: "timeless", name: "Timeless Trout", rarity: "eternal", value: 1500000 },
    { id: "foreverfin", name: "Foreverfin", rarity: "eternal", value: 2800000 },
    { id: "aeon", name: "Aeon Shark", rarity: "eternal", value: 4500000 },
    { id: "epochray", name: "Epoch Ray", rarity: "eternal", value: 7500000 },
    { id: "nebula", name: "Nebula Nettle", rarity: "cosmic", value: 12000000 },
    { id: "quasar", name: "Quasar Cod", rarity: "cosmic", value: 25000000 },
    { id: "omnifin", name: "Omnifin", rarity: "cosmic", value: 50000000 },
    { id: "pulsarpike", name: "Pulsar Pike", rarity: "cosmic", value: 85000000 },
    { id: "stardrift", name: "Stardrift Ray", rarity: "astral", value: 120000000 },
    { id: "aurorafin", name: "Aurora Fin", rarity: "astral", value: 250000000 },
    { id: "galaxykoi", name: "Galaxy Koi", rarity: "astral", value: 500000000 },
    { id: "cometcarp", name: "Comet Carp", rarity: "astral", value: 850000000 },
    { id: "eventide", name: "Eventide Eel", rarity: "singularity", value: 1200000000 },
    { id: "horizon", name: "Horizon Shark", rarity: "singularity", value: 2500000000 },
    { id: "collapse", name: "Collapse Carp", rarity: "singularity", value: 5000000000 },
    { id: "riftray", name: "Rift Ray", rarity: "singularity", value: 9000000000 },
    { id: "primefin", name: "Primefin", rarity: "omega", value: 15000000000 },
    { id: "absoluth", name: "Absoluth", rarity: "omega", value: 40000000000 },
    { id: "theend", name: "The End Fish", rarity: "omega", value: 100000000000 },
    { id: "ultimafin", name: "Ultimafin", rarity: "omega", value: 180000000000 },
    { id: "originkoi", name: "Origin Koi", rarity: "genesis", value: 250000000000 },
    { id: "dawnlevi", name: "Dawn Leviathan", rarity: "genesis", value: 600000000000 },
    { id: "firstfin", name: "First Fin", rarity: "genesis", value: 1500000000000 },
    { id: "sparkfin", name: "Sparkfin", rarity: "genesis", value: 2800000000000 },
    { id: "twinparadox", name: "Twin Paradox", rarity: "paradox", value: 4000000000000 },
    { id: "mirrorshark", name: "Mirror Shark", rarity: "paradox", value: 10000000000000 },
    { id: "loopeel", name: "Loop Eel", rarity: "paradox", value: 25000000000000 },
    { id: "mobiusmarlin", name: "Mobius Marlin", rarity: "paradox", value: 45000000000000 },
    { id: "endlessray", name: "Endless Ray", rarity: "infinity", value: 80000000000000 },
    { id: "boundcod", name: "Boundless Cod", rarity: "infinity", value: 200000000000000 },
    { id: "foreverend", name: "Forever End", rarity: "infinity", value: 500000000000000 },
    { id: "perpetualpike", name: "Perpetual Pike", rarity: "infinity", value: 900000000000000 },
    { id: "absolutefin", name: "Absolute Fin", rarity: "absolute", value: 1500000000000000 },
    { id: "finalabs", name: "Final Absolute", rarity: "absolute", value: 4000000000000000 },
    { id: "trueabs", name: "True Absolute", rarity: "absolute", value: 7000000000000000 },
    { id: "theabsolute", name: "The Absolute", rarity: "absolute", value: 10000000000000000 }
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
    cosmic: 10,
    astral: 11,
    singularity: 12,
    omega: 13,
    genesis: 14,
    paradox: 15,
    infinity: 16,
    absolute: 17
  };

  const FISHING_VARIANT_PRIMARY = ["silver", "gold", "diamond", "rainbow"];

  function fishingNormalizeVariant(raw) {
    const v = String(raw || "").toLowerCase();
    return FISHING_VARIANT_PRIMARY.includes(v) ? v : "";
  }

  function fishingVariantTier(entry) {
    const v = fishingNormalizeVariant(entry?.variant);
    const primary = v === "silver" ? 1 : v === "gold" ? 2 : v === "diamond" ? 3 : v === "rainbow" ? 4 : 0;
    return primary + (entry?.shiny ? 5 : 0);
  }

  function fishingEntryFromTier(tier) {
    const t = Math.max(0, Math.min(9, Math.floor(Number(tier) || 0)));
    const shiny = t >= 5;
    const primary = shiny ? t - 5 : t;
    const variant =
      primary === 1 ? "silver" : primary === 2 ? "gold" : primary === 3 ? "diamond" : primary === 4 ? "rainbow" : "";
    return { variant, shiny };
  }

  function fishingCatchScore(fish, entry) {
    if (!fish) return 0;
    const rank = FISHING_RARITY_RANK[fish.rarity] || 1;
    const tier = fishingVariantTier(entry);
    return (rank * 100 + tier) * 100000 + Math.max(0, Math.floor(Number(fish.value) || 0));
  }

  function fishingLegacyCatchScore(fish) {
    if (!fish) return 0;
    const rank = FISHING_RARITY_RANK[fish.rarity] || 1;
    return rank * 100000 + Math.max(0, Math.floor(Number(fish.value) || 0));
  }

  function fishingVariantTitle(entry) {
    const bits = [];
    const v = fishingNormalizeVariant(entry?.variant);
    if (v) bits.push(v.charAt(0).toUpperCase() + v.slice(1));
    if (entry?.shiny) bits.push("Shiny");
    return bits.join(" ");
  }

  function formatFishingCatchLabel(fish, entry) {
    if (!fish) return "—";
    const title = fishingVariantTitle(entry);
    const name = title ? `${title} ${fish.name}` : fish.name;
    return `${fish.rarity} · ${name}`;
  }

  function decodeFishingCatch(score) {
    const n = Math.floor(Number(score) || 0);
    if (n <= 0) return null;
    for (const fish of FISHING_CATCH_FISH) {
      for (let tier = 0; tier <= 9; tier += 1) {
        const entry = fishingEntryFromTier(tier);
        if (fishingCatchScore(fish, entry) === n) return { fish, entry };
      }
      if (fishingLegacyCatchScore(fish) === n) return { fish, entry: { variant: "", shiny: false } };
    }
    let best = null;
    let bestScore = -1;
    for (const fish of FISHING_CATCH_FISH) {
      for (let tier = 0; tier <= 9; tier += 1) {
        const entry = fishingEntryFromTier(tier);
        const s = fishingCatchScore(fish, entry);
        if (s <= n && s > bestScore) {
          best = { fish, entry };
          bestScore = s;
        }
      }
      const legacy = fishingLegacyCatchScore(fish);
      if (legacy <= n && legacy > bestScore) {
        best = { fish, entry: { variant: "", shiny: false } };
        bestScore = legacy;
      }
    }
    return best;
  }

  function formatFishingCatch(score, entryMeta) {
    if (entryMeta && typeof entryMeta === "object") {
      const fish =
        FISHING_CATCH_FISH.find((f) => f.id === entryMeta.id) ||
        (entryMeta.name
          ? {
              id: entryMeta.id || "",
              name: entryMeta.name,
              rarity: entryMeta.rarity || "catch",
              value: entryMeta.value || 0
            }
          : null);
      if (fish) {
        return formatFishingCatchLabel(fish, {
          variant: fishingNormalizeVariant(entryMeta.variant),
          shiny: !!entryMeta.shiny
        });
      }
    }
    const decoded = decodeFishingCatch(score);
    if (decoded) return formatFishingCatchLabel(decoded.fish, decoded.entry);
    const n = Math.floor(Number(score) || 0);
    if (n <= 0) return "—";
    const packed = Math.floor(n / 100000);
    const rank = Math.floor(packed / 100) || Math.floor(n / 100000);
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

  function formatMineOre(score) {
    if (typeof MineData !== "undefined" && MineData.formatOre) {
      return MineData.formatOre(score);
    }
    const n = Math.floor(Number(score) || 0);
    if (n <= 0) return "—";
    return `Ore ${n}`;
  }

  function formatScore(gameId, score, entry) {
    const m = meta(gameId);
    const n = Number(score);
    if (!Number.isFinite(n) || n <= 0) return "—";
    if (m.unit === "time") return formatSeconds(n);
    if (m.unit === "playtime") return formatPlaytime(n);
    if (m.unit === "wins") return `${Math.floor(n)} win${Math.floor(n) === 1 ? "" : "s"}`;
    if (m.unit === "streak") return `Streak ${Math.floor(n)}`;
    if (m.unit === "catch" || gameId === "fishing") {
      return formatFishingCatch(n, entry?.fishing || null);
    }
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
    // Prefer Supabase when available (Mantle free tier rate-limits under load).
    if (supabaseReady()) {
      try {
        const data = await HubSupabase.getDoc(SUPABASE_DOC_ID);
        if (data && typeof data === "object") {
          const games = data.games && typeof data.games === "object" ? data.games : {};
          const resets = data.resets && typeof data.resets === "object" ? data.resets : {};
          return { games, resets };
        }
        // Empty/missing doc — treat as blank board (table may be freshly created).
        return { games: {}, resets: {} };
      } catch (err) {
        // Fall through to Mantle if Supabase isn't set up yet / offline.
        console.warn("[HubLeaderboard] Supabase read failed, trying Mantle", err);
      }
    }
    const data = await fetchJson(API);
    if (!data || typeof data !== "object") return { games: {}, resets: {} };
    const games = data.games && typeof data.games === "object" ? data.games : {};
    const resets = data.resets && typeof data.resets === "object" ? data.resets : {};
    return { games, resets };
  }

  async function pushRemote(merged) {
    let ok = false;
    if (supabaseReady()) {
      try {
        await HubSupabase.upsertDoc(SUPABASE_DOC_ID, merged);
        ok = true;
      } catch (err) {
        console.warn("[HubLeaderboard] Supabase write failed", err);
      }
    }
    // Keep Mantle as backup while migrating (ignore failures / rate limits).
    try {
      await postJson(API, merged);
      ok = true;
    } catch {}
    if (!ok) throw new Error("push failed");
  }

  function normalizeEntry(entry, fallbackLower) {
    if (!entry || typeof entry !== "object") return null;
    const name = sanitizeName(entry.name || "");
    const score = Number(entry.score);
    if (!name || !Number.isFinite(score)) return null;
    const fishing =
      entry.fishing && typeof entry.fishing === "object"
        ? {
            id: String(entry.fishing.id || ""),
            name: String(entry.fishing.name || ""),
            rarity: String(entry.fishing.rarity || ""),
            value: Number(entry.fishing.value) || 0,
            variant: fishingNormalizeVariant(entry.fishing.variant),
            shiny: !!entry.fishing.shiny
          }
        : null;
    return {
      name,
      score,
      at: Number(entry.at) || 0,
      playerId: String(entry.playerId || ""),
      lowerBetter: typeof entry.lowerBetter === "boolean" ? entry.lowerBetter : !!fallbackLower,
      fishing
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

    // One-time: wipe ICE_DRAGON from Mine Depth boards only (depth + best ore).
    const iceMineWipeKey = "mine:ice_dragon-v1";
    const ICE_MINE_WIPE_AT = Date.UTC(2026, 8, 8, 16, 30, 0); // 2026-09-08 16:30 UTC
    if (!resets[iceMineWipeKey] || Number(resets[iceMineWipeKey]) > ICE_MINE_WIPE_AT) {
      resets[iceMineWipeKey] = ICE_MINE_WIPE_AT;
    }
    const iceMineCut = Number(resets[iceMineWipeKey]) || ICE_MINE_WIPE_AT;
    const ICE_MINE_PLAYER_ID = "p-mtlztdny-r28rrb";
    ["mine", "mine-ore"].forEach((gameId) => {
      const board = { ...(games[gameId] || {}) };
      Object.keys(board).forEach((key) => {
        const entry = board[key];
        if (!entry) return;
        const keyName = nameKey(entry.name || key);
        const isIce =
          key === "ice_dragon" ||
          keyName === "ice_dragon" ||
          entry.playerId === ICE_MINE_PLAYER_ID;
        const at = Number(entry.at) || 0;
        if (isIce && at <= iceMineCut) delete board[key];
      });
      games[gameId] = board;
    });

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

    // Full Fishing Idle leaderboard reset (this game only).
    const fishingFullResetKey = "fishing:full-reset-20260911x";
    const FISHING_FULL_RESET_AT = Date.UTC(2026, 8, 11, 15, 50, 0); // 2026-09-11 15:50 UTC
    if (!resets[fishingFullResetKey] || Number(resets[fishingFullResetKey]) > FISHING_FULL_RESET_AT) {
      resets[fishingFullResetKey] = FISHING_FULL_RESET_AT;
    }
    const fishingFullCut = Number(resets[fishingFullResetKey]) || FISHING_FULL_RESET_AT;
    Object.keys(fishingBoard).forEach((key) => {
      const at = Number(fishingBoard[key]?.at) || 0;
      if (at <= fishingFullCut) delete fishingBoard[key];
    });
    // Drop old Abyss King floor seeds so they can't reappear after this wipe.
    delete resets["fishing:ice_dragon-abyss-king-v1"];
    delete resets["fishing:ice_dragon-abyss-king-v2"];

    // One-time floor: ICE_DRAGON best catch → Shiny Primefin (can still be beaten).
    const icePrimefinKey = "fishing:ice_dragon-primefin-shiny-v1";
    if (!resets[icePrimefinKey]) {
      resets[icePrimefinKey] = Date.now();
      const prime = FISHING_CATCH_FISH.find((f) => f.id === "primefin");
      if (prime) {
        const shinyEntry = { variant: "", shiny: true };
        const floorScore = fishingCatchScore(prime, shinyEntry);
        const iceKey = "ice_dragon";
        const existing = fishingBoard[iceKey];
        const existingScore = Number(existing?.score) || 0;
        if (floorScore > existingScore) {
          fishingBoard[iceKey] = {
            name: existing?.name || "ICE_DRAGON",
            score: floorScore,
            at: Date.now(),
            playerId: String(existing?.playerId || ""),
            lowerBetter: false,
            fishing: {
              id: prime.id,
              name: prime.name,
              rarity: prime.rarity,
              value: prime.value,
              variant: "",
              shiny: true
            }
          };
        }
      }
    }
    games.fishing = fishingBoard;

    // One-time: wipe ICE_DRAGON from Fishing Idle best-catch board only.
    const iceFishingWipeKey = "fishing:ice_dragon-v1";
    const ICE_FISHING_WIPE_AT = Date.UTC(2026, 8, 15, 20, 25, 0); // 2026-09-15 20:25 UTC
    if (!resets[iceFishingWipeKey] || Number(resets[iceFishingWipeKey]) > ICE_FISHING_WIPE_AT) {
      resets[iceFishingWipeKey] = ICE_FISHING_WIPE_AT;
    }
    const iceFishingCut = Number(resets[iceFishingWipeKey]) || ICE_FISHING_WIPE_AT;
    const ICE_FISHING_PLAYER_ID = "p-mtlztdny-r28rrb";
    const iceFishingBoard = { ...(games.fishing || {}) };
    Object.keys(iceFishingBoard).forEach((key) => {
      const entry = iceFishingBoard[key];
      if (!entry) return;
      const keyName = nameKey(entry.name || key);
      const isIce =
        key === "ice_dragon" ||
        keyName === "ice_dragon" ||
        entry.playerId === ICE_FISHING_PLAYER_ID;
      const at = Number(entry.at) || 0;
      if (isIce && at <= iceFishingCut) delete iceFishingBoard[key];
    });
    games.fishing = iceFishingBoard;

    // Full Ramp Rush leaderboard reset (this game only).
    const rampFullResetKey = "ramp:full-reset-20260914al";
    const RAMP_FULL_RESET_AT = Date.UTC(2026, 8, 14, 19, 45, 0); // 2026-09-14 19:45 UTC
    if (!resets[rampFullResetKey] || Number(resets[rampFullResetKey]) > RAMP_FULL_RESET_AT) {
      resets[rampFullResetKey] = RAMP_FULL_RESET_AT;
    }
    const rampFullCut = Number(resets[rampFullResetKey]) || RAMP_FULL_RESET_AT;
    const rampBoard = { ...(games.ramp || {}) };
    Object.keys(rampBoard).forEach((key) => {
      const at = Number(rampBoard[key]?.at) || 0;
      if (at <= rampFullCut) delete rampBoard[key];
    });
    games.ramp = rampBoard;

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
        await pushRemote(merged);
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
        await pushRemote(rebound);
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
        await pushRemote(merged);
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
    if (gameId === "hub-points") {
      return getHubPointsBoard();
    }
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

    // Competitive points ignore owner accounts so #2 behind ICE_DRAGON still gets 10 pts
    let competitiveRank = 0;
    return rows.map((entry, i) => {
      const rank = i + 1;
      const excluded = isPointsExcluded(entry.name);
      if (!excluded) competitiveRank += 1;
      const points = excluded ? 0 : pointsForRank(competitiveRank);
      return {
        rank,
        name: entry.name,
        score: entry.score,
        at: entry.at,
        lowerBetter,
        fishing: entry.fishing || null,
        points,
        pointsExcluded: excluded,
        label: formatScore(gameId, entry.score, entry),
        isYou: me && nameKey(entry.name) === me
      };
    });
  }

  function isPointsExcluded(name) {
    return POINTS_EXCLUDED_KEYS.has(nameKey(name));
  }

  /** Top 10 placement points: #1=10 … #10=1, else 0. Recalculates live when ranks change. */
  function pointsForRank(rank) {
    const r = Math.floor(Number(rank) || 0);
    if (r < 1 || r > 10) return 0;
    return 11 - r;
  }

  function getHubPointsBoard() {
    const byKey = new Map();
    const me = nameKey(getPlayerName());
    GAME_IDS.forEach((gameId) => {
      if (gameId === "hub-points") return;
      const board = getBoard(gameId);
      board.forEach((row) => {
        if (isPointsExcluded(row.name)) return;
        const pts = Number(row.points) || 0;
        if (pts <= 0) return;
        const key = nameKey(row.name);
        if (!key) return;
        const prev = byKey.get(key) || {
          name: row.name,
          points: 0,
          boards: 0,
          bestRank: row.rank
        };
        prev.points += pts;
        prev.boards += 1;
        prev.bestRank = Math.min(prev.bestRank || 99, row.rank);
        prev.name = row.name || prev.name;
        byKey.set(key, prev);
      });
    });
    return [...byKey.values()]
      .sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        if (a.bestRank !== b.bestRank) return a.bestRank - b.bestRank;
        return String(a.name).localeCompare(String(b.name));
      })
      .map((row, i) => ({
        rank: i + 1,
        name: row.name,
        score: row.points,
        points: row.points,
        boards: row.boards,
        label:
          row.boards === 1
            ? `${row.points} pts · 1 board`
            : `${row.points} pts · ${row.boards} boards`,
        isYou: !!(me && nameKey(row.name) === me),
        lowerBetter: false
      }));
  }

  async function submit(gameId, score, opts = {}) {
    const n = Number(score);
    if (!GAME_META[gameId] || !Number.isFinite(n) || n <= 0) return false;
    const name = getPlayerName();
    if (!name) return false;

    const lowerBetter =
      typeof opts.lowerBetter === "boolean" ? opts.lowerBetter : meta(gameId).lowerBetter;
    const fishingMeta =
      opts.fishing && typeof opts.fishing === "object"
        ? {
            id: String(opts.fishing.id || ""),
            name: String(opts.fishing.name || ""),
            rarity: String(opts.fishing.rarity || ""),
            value: Number(opts.fishing.value) || 0,
            variant: fishingNormalizeVariant(opts.fishing.variant),
            shiny: !!opts.fishing.shiny
          }
        : null;

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
        lowerBetter,
        ...(fishingMeta ? { fishing: fishingMeta } : {})
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
        await pushRemote(merged);
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
    getHubPointsBoard,
    pointsForRank,
    clearPlayer,
    rebindPlayerName,
    formatScore,
    bumpLocal,
    GAME_IDS,
    GAME_META
  };
})();
