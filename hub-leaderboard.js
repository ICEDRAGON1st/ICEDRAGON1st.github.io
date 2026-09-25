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

  /** Per-game Hub Points exclusions (name still appears on that board, earns 0 pts from it). */
  const POINTS_EXCLUDED_BY_GAME = {
    fishing: new Set(["hjalte"])
  };

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
    { id: "theabsolute", name: "The Absolute", rarity: "absolute", value: 10000000000000000 },
    { id: "ascendray", name: "Ascend Ray", rarity: "transcendent", value: 2.5e16 },
    { id: "overfin", name: "Overfin", rarity: "transcendent", value: 6e16 },
    { id: "beyondkoi", name: "Beyond Koi", rarity: "transcendent", value: 1.2e17 },
    { id: "transcendfin", name: "Transcendfin", rarity: "transcendent", value: 2.5e17 },
    { id: "crossfin", name: "Crossfin", rarity: "nexus", value: 5e17 },
    { id: "linkshark", name: "Link Shark", rarity: "nexus", value: 1.2e18 },
    { id: "hubray", name: "Hub Ray", rarity: "nexus", value: 3e18 },
    { id: "nexuskarp", name: "Nexus Karp", rarity: "nexus", value: 7e18 },
    { id: "nullray", name: "Null Ray", rarity: "voidborn", value: 1.5e19 },
    { id: "hollowfin", name: "Hollowfin", rarity: "voidborn", value: 4e19 },
    { id: "abyssnull", name: "Abyss Null", rarity: "voidborn", value: 9e19 },
    { id: "thevoidborn", name: "The Voidborn", rarity: "voidborn", value: 2e20 },
    { id: "peakfin", name: "Peakfin", rarity: "zenith", value: 5e20 },
    { id: "crownray", name: "Crown Ray", rarity: "zenith", value: 1.2e21 },
    { id: "apexkoi", name: "Apex Koi", rarity: "zenith", value: 3e21 },
    { id: "spirefin", name: "Spirefin", rarity: "zenith", value: 4.8e21 },
    { id: "solsticeray", name: "Solstice Ray", rarity: "zenith", value: 6.2e21 },
    { id: "thezenith", name: "The Zenith", rarity: "zenith", value: 8e21 },
    { id: "diademfin", name: "Diadem Fin", rarity: "crown", value: 1.5e22 },
    { id: "royalkoi", name: "Royal Koi", rarity: "crown", value: 4e22 },
    { id: "coronet", name: "Coronet Ray", rarity: "crown", value: 9e22 },
    { id: "thecrown", name: "The Crown", rarity: "crown", value: 2e23 },
    { id: "dawnorigin", name: "Dawn Origin", rarity: "origin", value: 5e23 },
    { id: "sourcefin", name: "Sourcefin", rarity: "origin", value: 1.2e24 },
    { id: "firsttide", name: "First Tide", rarity: "origin", value: 3e24 },
    { id: "theorigin", name: "The Origin", rarity: "origin", value: 7e24 },
    { id: "skyfin", name: "Skyfin", rarity: "aether", value: 1.5e25 },
    { id: "aetherray", name: "Aether Ray", rarity: "aether", value: 4e25 },
    { id: "cloudmarlin", name: "Cloud Marlin", rarity: "aether", value: 9e25 },
    { id: "theaether", name: "The Aether", rarity: "aether", value: 2e26 },
    { id: "gleamray", name: "Gleam Ray", rarity: "radiant", value: 5e26 },
    { id: "sunfin", name: "Sunfin", rarity: "radiant", value: 1.2e27 },
    { id: "blazeel", name: "Blaze Eel", rarity: "radiant", value: 3e27 },
    { id: "theradiant", name: "The Radiant", rarity: "radiant", value: 7e27 },
    { id: "duskfin", name: "Duskfin", rarity: "dusk", value: 1.5e28 },
    { id: "twilightshark", name: "Twilight Shark", rarity: "dusk", value: 4e28 },
    { id: "umbrakoi", name: "Umbra Koi", rarity: "dusk", value: 9e28 },
    { id: "thedusk", name: "The Dusk", rarity: "dusk", value: 2e29 },
    { id: "summitfin", name: "Summitfin", rarity: "apex", value: 5e29 },
    { id: "pinnacleray", name: "Pinnacle Ray", rarity: "apex", value: 1.2e30 },
    { id: "crestkoi", name: "Crest Koi", rarity: "apex", value: 3e30 },
    { id: "theapex", name: "The Apex", rarity: "apex", value: 8e30 }
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
    absolute: 17,
    transcendent: 18,
    nexus: 19,
    voidborn: 20,
    zenith: 21,
    crown: 22,
    origin: 23,
    aether: 24,
    radiant: 25,
    dusk: 26,
    apex: 27
  };

  const FISHING_VARIANT_PRIMARY = ["silver", "gold", "diamond", "rainbow"];

  function fishingNormalizeVariant(raw) {
    const v = String(raw || "").toLowerCase();
    return FISHING_VARIANT_PRIMARY.includes(v) ? v : "";
  }

  const FISHING_MUTATIONS = ["toxic", "lava", "neon"];

  function fishingNormalizeMutation(raw) {
    const m = String(raw || "").toLowerCase();
    return FISHING_MUTATIONS.includes(m) ? m : "";
  }

  function fishingVariantTier(entry) {
    const v = fishingNormalizeVariant(entry?.variant);
    const primary = v === "silver" ? 1 : v === "gold" ? 2 : v === "diamond" ? 3 : v === "rainbow" ? 4 : 0;
    return primary + (entry?.shiny ? 5 : 0) + (fishingNormalizeMutation(entry?.mutation) ? 10 : 0);
  }

  function fishingEntryFromTier(tier) {
    const t = Math.max(0, Math.min(19, Math.floor(Number(tier) || 0)));
    const mutation = t >= 10 ? "toxic" : "";
    const base = mutation ? t - 10 : t;
    const shiny = base >= 5;
    const primary = shiny ? base - 5 : base;
    const variant =
      primary === 1 ? "silver" : primary === 2 ? "gold" : primary === 3 ? "diamond" : primary === 4 ? "rainbow" : "";
    return { variant, shiny, mutation };
  }

  function fishingCatchScore(fish, entry) {
    if (!fish) return 0;
    const rank = Math.max(0, Math.min(99, FISHING_RARITY_RANK[fish.rarity] || 1));
    const tier = Math.max(0, Math.min(99, fishingVariantTier(entry)));
    const value = Math.max(0, Number(fish.value) || 0);
    const valuePart = value > 0 ? Math.min(999_999_999, Math.floor(Math.log10(value + 1) * 1_000_000)) : 0;
    return rank * 1e11 + tier * 1e9 + valuePart;
  }

  function fishingLegacyCatchScore(fish) {
    if (!fish) return 0;
    const rank = Math.max(0, Math.min(99, FISHING_RARITY_RANK[fish.rarity] || 1));
    const value = Math.max(0, Number(fish.value) || 0);
    const valuePart = value > 0 ? Math.min(999_999_999, Math.floor(Math.log10(value + 1) * 1_000_000)) : 0;
    return rank * 1e11 + valuePart;
  }

  function fishingVariantTitle(entry) {
    const bits = [];
    const v = fishingNormalizeVariant(entry?.variant);
    if (v) bits.push(v.charAt(0).toUpperCase() + v.slice(1));
    if (entry?.shiny) bits.push("Shiny");
    const m = fishingNormalizeMutation(entry?.mutation);
    if (m) bits.push(m.charAt(0).toUpperCase() + m.slice(1));
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
      for (let tier = 0; tier <= 19; tier += 1) {
        const entry = fishingEntryFromTier(tier);
        if (fishingCatchScore(fish, entry) === n) return { fish, entry };
      }
      if (fishingLegacyCatchScore(fish) === n) {
        return { fish, entry: { variant: "", shiny: false, mutation: "" } };
      }
    }
    let best = null;
    let bestScore = -1;
    for (const fish of FISHING_CATCH_FISH) {
      for (let tier = 0; tier <= 19; tier += 1) {
        const entry = fishingEntryFromTier(tier);
        const s = fishingCatchScore(fish, entry);
        if (s <= n && s > bestScore) {
          best = { fish, entry };
          bestScore = s;
        }
      }
      const legacy = fishingLegacyCatchScore(fish);
      if (legacy <= n && legacy > bestScore) {
        best = { fish, entry: { variant: "", shiny: false, mutation: "" } };
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
          shiny: !!entryMeta.shiny,
          mutation: fishingNormalizeMutation(entryMeta.mutation)
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
            shiny: !!entry.fishing.shiny,
            mutation: fishingNormalizeMutation(entry.fishing.mutation)
          }
        : null;
    return {
      name,
      score,
      at: Number(entry.at) || 0,
      playerId: String(entry.playerId || ""),
      lowerBetter: typeof entry.lowerBetter === "boolean" ? entry.lowerBetter : !!fallbackLower,
      fishing,
      ...(Number(entry.bornAt) > 0 ? { bornAt: Number(entry.bornAt) } : {})
    };
  }

  function pickBetterEntry(a, b, lowerBetter) {
    if (!a) return b;
    if (!b) return a;
    let picked;
    if (isBetter(b.score, a.score, lowerBetter)) picked = b;
    else if (isBetter(a.score, b.score, lowerBetter)) picked = a;
    else picked = (b.at || 0) >= (a.at || 0) ? b : a;
    const births = [Number(a.bornAt) || 0, Number(b.bornAt) || 0].filter((n) => n > 0);
    if (births.length) return { ...picked, bornAt: Math.min(...births) };
    return picked;
  }

  function clampOnlineTimeEntry(entry, now = Date.now()) {
    if (!entry) return entry;
    const bornAt = Number(entry.bornAt) || 0;
    if (!bornAt) return entry;
    const cap = Math.max(0, Math.floor((now - bornAt) / 1000) + 180);
    if (Number(entry.score) <= cap) return entry;
    return { ...entry, score: cap };
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
      let board = trimBoard(merged, lowerBetter);
      if (gameId === "online-time") {
        const now = Date.now();
        const clamped = {};
        Object.entries(board).forEach(([k, entry]) => {
          clamped[k] = clampOnlineTimeEntry(entry, now);
        });
        board = clamped;
      }
      games[gameId] = board;
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

    // Precision-safe catch scores (Apex+ values); wipe old collapsed scores.
    const fishingSafeScoreKey = "fishing:catch-score-safe-v3";
    const FISHING_SAFE_SCORE_AT = Date.UTC(2026, 8, 25, 13, 40, 0); // 2026-09-25 13:40 UTC
    if (!resets[fishingSafeScoreKey] || Number(resets[fishingSafeScoreKey]) > FISHING_SAFE_SCORE_AT) {
      resets[fishingSafeScoreKey] = FISHING_SAFE_SCORE_AT;
    }
    const fishingSafeCut = Number(resets[fishingSafeScoreKey]) || FISHING_SAFE_SCORE_AT;
    Object.keys(fishingBoard).forEach((key) => {
      const at = Number(fishingBoard[key]?.at) || 0;
      if (at <= fishingSafeCut) delete fishingBoard[key];
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

    // Strip exclusive / Soul Twin entries — they are not leaderboard-eligible.
    const fishingExclusiveStripKey = "fishing:strip-exclusive-v1";
    if (!resets[fishingExclusiveStripKey]) {
      resets[fishingExclusiveStripKey] = Date.now();
    }
    const fishingNoExclusive = { ...(games.fishing || {}) };
    Object.keys(fishingNoExclusive).forEach((key) => {
      const entry = fishingNoExclusive[key];
      const f = entry?.fishing;
      if (!f || typeof f !== "object") return;
      const id = String(f.id || "").toLowerCase();
      const rarity = String(f.rarity || "").toLowerCase();
      if (id === "soultwin" || rarity === "exclusive" || !!f.exclusive) {
        delete fishingNoExclusive[key];
      }
    });
    games.fishing = fishingNoExclusive;

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

    // EchoTest Time Online: always clamp to account age (created 2026-09-24 17:32 UTC).
    // Inflated local caches kept re-pushing ~26h after the one-off fix.
    {
      const ECHO_KEY = "echotest";
      const ECHO_PID = "p-mtsw3m2i-hqps64";
      const ECHO_BORN = 1790271178230;
      const now = Date.now();
      const ageSec = Math.max(0, Math.floor((now - ECHO_BORN) / 1000));
      const board = { ...(games["online-time"] || {}) };
      Object.keys(board).forEach((key) => {
        const entry = board[key];
        if (!entry) return;
        const isEcho =
          key === ECHO_KEY ||
          nameKey(entry.name || key) === ECHO_KEY ||
          String(entry.playerId || "") === ECHO_PID;
        if (!isEcho) {
          board[key] = clampOnlineTimeEntry(normalizeEntry(entry, false) || entry, now);
          return;
        }
        const score = Math.min(Math.max(0, Math.floor(Number(entry.score) || 0)), ageSec);
        board[key] = {
          name: "EchoTest",
          score,
          at: now,
          playerId: ECHO_PID,
          lowerBetter: false,
          bornAt: ECHO_BORN
        };
      });
      if (board[ECHO_KEY] || Object.values(board).some((e) => e?.playerId === ECHO_PID)) {
        // keep clamped row; if somehow missing name key, ensure canonical key
        const existing =
          board[ECHO_KEY] ||
          Object.values(board).find((e) => e?.playerId === ECHO_PID);
        if (existing) {
          Object.keys(board).forEach((key) => {
            if (key === ECHO_KEY) return;
            if (board[key]?.playerId === ECHO_PID) delete board[key];
          });
          board[ECHO_KEY] = {
            name: "EchoTest",
            score: Math.min(Math.max(0, Math.floor(Number(existing.score) || 0)), ageSec),
            at: now,
            playerId: ECHO_PID,
            lowerBetter: false,
            bornAt: ECHO_BORN
          };
        }
      }
      games["online-time"] = board;
    }

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
    const ECHO_PID = "p-mtsw3m2i-hqps64";
    const ECHO_BORN = 1790271178230;
    const now = Date.now();
    const echoAge = Math.max(0, Math.floor((now - ECHO_BORN) / 1000));
    const rows = Object.values(board)
      .map((entry) => normalizeEntry(entry, lowerBetter))
      .filter(Boolean)
      .map((entry) => {
        if (gameId !== "online-time") return entry;
        if (
          nameKey(entry.name) === "echotest" ||
          String(entry.playerId || "") === ECHO_PID
        ) {
          return {
            ...entry,
            name: "EchoTest",
            playerId: ECHO_PID,
            bornAt: ECHO_BORN,
            score: Math.min(Number(entry.score) || 0, echoAge)
          };
        }
        return clampOnlineTimeEntry(entry, now);
      })
      .sort((a, b) => {
        if (a.score !== b.score) {
          return lowerBetter ? a.score - b.score : b.score - a.score;
        }
        return (a.at || 0) - (b.at || 0);
      });

    // Competitive points ignore owner / per-game excluded accounts
    let competitiveRank = 0;
    return rows.map((entry, i) => {
      const rank = i + 1;
      const excluded = isPointsExcluded(entry.name, gameId);
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

  function isPointsExcluded(name, gameId = "") {
    const key = nameKey(name);
    if (POINTS_EXCLUDED_KEYS.has(key)) return true;
    const gameSet = POINTS_EXCLUDED_BY_GAME[gameId];
    return !!(gameSet && gameSet.has(key));
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
        if (isPointsExcluded(row.name, gameId)) return;
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
            shiny: !!opts.fishing.shiny,
            mutation: fishingNormalizeMutation(opts.fishing.mutation)
          }
        : null;
    if (gameId === "fishing" && fishingMeta) {
      const id = fishingMeta.id.toLowerCase();
      const rarity = fishingMeta.rarity.toLowerCase();
      if (id === "soultwin" || rarity === "exclusive") return false;
    }

    const run = async () => {
      await sync(true);
      const key = nameKey(name);
      const games = { ...(cache.games || {}) };
      const board = { ...(games[gameId] || {}) };
      const prev = normalizeEntry(board[key], lowerBetter);
      let scoreVal = n;
      let bornAt = Number(prev?.bornAt) || 0;
      if (gameId === "online-time") {
        if (!bornAt && typeof HubPlays?.getAccountFirstAt === "function") {
          bornAt = Number(HubPlays.getAccountFirstAt()) || 0;
        }
        if (!bornAt && prev) {
          bornAt = Date.now() - Math.max(Number(prev.score) || 0, scoreVal) * 1000;
        }
        if (!bornAt) bornAt = Date.now();
        const cap = Math.max(0, Math.floor((Date.now() - bornAt) / 1000) + 180);
        scoreVal = Math.min(scoreVal, cap);
      }
      if (prev && !isBetter(scoreVal, prev.score, lowerBetter)) {
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
        score: scoreVal,
        at: Date.now(),
        playerId: me,
        lowerBetter,
        ...(bornAt && gameId === "online-time" ? { bornAt } : {}),
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
    let scoreVal = n;
    let bornAt = Number(prev?.bornAt) || 0;
    if (gameId === "online-time") {
      if (!bornAt && typeof HubPlays?.getAccountFirstAt === "function") {
        bornAt = Number(HubPlays.getAccountFirstAt()) || 0;
      }
      if (!bornAt && prev) {
        bornAt = Date.now() - Math.max(Number(prev.score) || 0, scoreVal) * 1000;
      }
      if (!bornAt) bornAt = Date.now();
      const cap = Math.max(0, Math.floor((Date.now() - bornAt) / 1000) + 180);
      scoreVal = Math.min(scoreVal, cap);
    }
    if (prev && !isBetter(scoreVal, prev.score, lowerBetter)) return false;
    const me = getPlayerId();
    if (me) {
      Object.keys(board).forEach((k) => {
        if (k === key) return;
        if (board[k]?.playerId === me) delete board[k];
      });
    }
    board[key] = {
      name,
      score: scoreVal,
      at: Date.now(),
      playerId: me,
      lowerBetter,
      ...(bornAt && gameId === "online-time" ? { bornAt } : {})
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
      if (gameId === "fishing") {
        const f = entry.fishing;
        if (f && typeof f === "object") {
          const id = String(f.id || "").toLowerCase();
          const rarity = String(f.rarity || "").toLowerCase();
          if (id === "soultwin" || rarity === "exclusive") return;
        }
      }
      best = Math.max(best, Number(entry.score) || 0);
    });
    return best;
  }

  function getMyEntry(gameId) {
    if (!GAME_META[gameId]) return null;
    const lowerBetter = meta(gameId).lowerBetter;
    const board = ((cache.games || {})[gameId]) || {};
    const meName = nameKey(getPlayerName());
    const meId = getPlayerId();
    let best = null;
    Object.values(board).forEach((raw) => {
      const entry = normalizeEntry(raw, lowerBetter);
      if (!entry) return;
      const mine =
        (meName && nameKey(entry.name) === meName) ||
        (meId && entry.playerId && entry.playerId === meId);
      if (!mine) return;
      if (!best || isBetter(entry.score, best.score, lowerBetter)) best = entry;
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
    getMyEntry,
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
