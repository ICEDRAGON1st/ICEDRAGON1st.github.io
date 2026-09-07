(function () {
  const SAVE_KEY = "fishing-save-v2";
  const HIGH_SCORE_KEY = "fishing-high-score-v1";
  const TICK_MS = 100;
  const COOLER_BASE = 12;

  const RARITY_WEIGHT = {
    common: 52,
    uncommon: 24,
    rare: 12,
    epic: 7,
    legendary: 3.5,
    mythic: 1.2
  };

  const FISH = [
    // Common
    { id: "minnow", name: "Minnow", rarity: "common", value: 3 },
    { id: "perch", name: "Perch", rarity: "common", value: 5 },
    { id: "bluegill", name: "Bluegill", rarity: "common", value: 6 },
    { id: "sardine", name: "Sardine", rarity: "common", value: 4 },
    { id: "smelt", name: "Smelt", rarity: "common", value: 5 },
    { id: "carp", name: "Carp", rarity: "common", value: 7 },
    { id: "roach", name: "Roach", rarity: "common", value: 4 },
    { id: "goby", name: "Goby", rarity: "common", value: 6 },
    // Uncommon
    { id: "trout", name: "Trout", rarity: "uncommon", value: 14 },
    { id: "bass", name: "Bass", rarity: "uncommon", value: 18 },
    { id: "catfish", name: "Catfish", rarity: "uncommon", value: 22 },
    { id: "walleye", name: "Walleye", rarity: "uncommon", value: 20 },
    { id: "snapper", name: "Snapper", rarity: "uncommon", value: 24 },
    { id: "mackerel", name: "Mackerel", rarity: "uncommon", value: 16 },
    { id: "cod", name: "Cod", rarity: "uncommon", value: 19 },
    { id: "flounder", name: "Flounder", rarity: "uncommon", value: 21 },
    // Rare
    { id: "salmon", name: "Salmon", rarity: "rare", value: 45 },
    { id: "pike", name: "Pike", rarity: "rare", value: 55 },
    { id: "mahi", name: "Mahi-Mahi", rarity: "rare", value: 60 },
    { id: "grouper", name: "Grouper", rarity: "rare", value: 70 },
    { id: "barracuda", name: "Barracuda", rarity: "rare", value: 65 },
    { id: "sturgeon", name: "Sturgeon", rarity: "rare", value: 80 },
    { id: "eel", name: "Moray Eel", rarity: "rare", value: 58 },
    // Epic
    { id: "tuna", name: "Tuna", rarity: "epic", value: 120 },
    { id: "marlin", name: "Marlin", rarity: "epic", value: 180 },
    { id: "swordfish", name: "Swordfish", rarity: "epic", value: 200 },
    { id: "shark", name: "Reef Shark", rarity: "epic", value: 240 },
    { id: "ray", name: "Manta Ray", rarity: "epic", value: 220 },
    { id: "octopus", name: "Giant Octopus", rarity: "epic", value: 260 },
    // Legendary
    { id: "golden", name: "Golden Koi", rarity: "legendary", value: 500 },
    { id: "leviathan", name: "Leviathan Fry", rarity: "legendary", value: 900 },
    { id: "moonfish", name: "Moonfish", rarity: "legendary", value: 650 },
    { id: "dragonet", name: "Sea Dragonet", rarity: "legendary", value: 780 },
    { id: "crystal", name: "Crystal Pike", rarity: "legendary", value: 850 },
    // Mythic
    { id: "tidelord", name: "Tide Lord", rarity: "mythic", value: 2500 },
    { id: "abyssking", name: "Abyss King", rarity: "mythic", value: 4000 },
    { id: "starwhale", name: "Star Whale", rarity: "mythic", value: 6000 },
    { id: "worldfin", name: "Worldfin", rarity: "mythic", value: 9000 }
  ];

  const SPOTS = [
    {
      id: "creek",
      name: "Creek",
      cost: 0,
      wait: [1.4, 2.8],
      valueMult: 0.7,
      rarity: 0,
      blurb: "All fish · commons dominate · low pay"
    },
    {
      id: "pond",
      name: "Pond",
      cost: 120,
      wait: [1.3, 2.6],
      valueMult: 0.9,
      rarity: 1,
      blurb: "All fish · slightly better odds"
    },
    {
      id: "river",
      name: "River",
      cost: 800,
      wait: [1.2, 2.4],
      valueMult: 1.15,
      rarity: 2,
      blurb: "All fish · uncommon/rare more often"
    },
    {
      id: "lake",
      name: "Lake",
      cost: 4500,
      wait: [1.1, 2.2],
      valueMult: 1.45,
      rarity: 3,
      blurb: "All fish · solid rare/epic odds"
    },
    {
      id: "harbor",
      name: "Harbor",
      cost: 25000,
      wait: [1.0, 2.0],
      valueMult: 1.9,
      rarity: 4,
      blurb: "All fish · epic/legendary/mythic friendlier"
    },
    {
      id: "deep",
      name: "Deep Sea",
      cost: 150000,
      wait: [0.9, 1.8],
      valueMult: 2.6,
      rarity: 5,
      blurb: "All fish · best odds, pay & mythics"
    }
  ];

  const GEAR = [
    { id: "rod1", name: "Willow Rod", desc: "+0.05s bite window", cost: 40, kind: "window", amount: 0.05 },
    { id: "rod2", name: "Oak Rod", desc: "+0.08s bite window", cost: 180, kind: "window", amount: 0.08 },
    { id: "rod3", name: "Carbon Rod", desc: "+0.12s bite window", cost: 900, kind: "window", amount: 0.12 },
    { id: "rod4", name: "Pro Rod", desc: "+0.15s bite window", cost: 4500, kind: "window", amount: 0.15 },
    { id: "rod5", name: "Myth Rod", desc: "+0.2s bite window", cost: 22000, kind: "window", amount: 0.2 },
    { id: "bait1", name: "Worms", desc: "Faster bites (−12% wait)", cost: 60, kind: "speed", amount: 0.12 },
    { id: "bait2", name: "Crickets", desc: "Faster bites (−15% wait)", cost: 350, kind: "speed", amount: 0.15 },
    { id: "bait3", name: "Spinner", desc: "Faster bites (−18% wait)", cost: 1800, kind: "speed", amount: 0.18 },
    { id: "bait4", name: "Live Bait", desc: "Faster bites (−22% wait)", cost: 9000, kind: "speed", amount: 0.22 },
    { id: "luck1", name: "Lucky Hook", desc: "+rarity luck", cost: 120, kind: "luck", amount: 8 },
    { id: "luck2", name: "Tide Charm", desc: "+rarity luck", cost: 700, kind: "luck", amount: 12 },
    { id: "luck3", name: "Pearl Lure", desc: "+rarity luck", cost: 4000, kind: "luck", amount: 16 },
    { id: "luck4", name: "Siren Bell", desc: "+rarity luck", cost: 20000, kind: "luck", amount: 22 },
    { id: "cooler1", name: "Ice Pack", desc: "+4 cooler slots", cost: 200, kind: "cooler", amount: 4 },
    { id: "cooler2", name: "Big Cooler", desc: "+6 cooler slots", cost: 1500, kind: "cooler", amount: 6 },
    { id: "cooler3", name: "Dock Freezer", desc: "+10 cooler slots", cost: 12000, kind: "cooler", amount: 10 },
    { id: "boat1", name: "Canoe Hand", desc: "Auto-catch every 12s", cost: 250, kind: "boat", amount: 12 },
    { id: "boat2", name: "Skiff Crew", desc: "Auto-catch every 8s", cost: 2000, kind: "boat", amount: 8 },
    { id: "boat3", name: "Trawler", desc: "Auto-catch every 5s", cost: 15000, kind: "boat", amount: 5 },
    { id: "boat4", name: "Harbor Fleet", desc: "Auto-catch every 3s", cost: 80000, kind: "boat", amount: 3 }
  ];

  const coinCountEl = document.getElementById("coin-count");
  const spotLabelEl = document.getElementById("spot-label");
  const windowLabelEl = document.getElementById("window-label");
  const boatsLabelEl = document.getElementById("boats-label");
  const hudSpotEl = document.getElementById("hud-spot");
  const hudCoolerEl = document.getElementById("hud-cooler");
  const hudBestEl = document.getElementById("hud-best");
  const castBtn = document.getElementById("cast-btn");
  const castBtnText = document.getElementById("cast-btn-text");
  const biteFill = document.getElementById("bite-fill");
  const biteMeter = document.querySelector(".bite-meter");
  const catchLineEl = document.getElementById("catch-line");
  const coolerList = document.getElementById("cooler-list");
  const coolerCountEl = document.getElementById("cooler-count");
  const coolerMaxEl = document.getElementById("cooler-max");
  const sellBtn = document.getElementById("sell-btn");
  const autoSellEl = document.getElementById("auto-sell");
  const shopList = document.getElementById("shop-list");
  const spotList = document.getElementById("spot-list");
  const overlay = document.getElementById("overlay");
  const overlayBestEl = document.getElementById("overlay-best");
  const startBtn = document.getElementById("start-btn");
  const gamesBtn = document.getElementById("games-btn");
  const menuBtn = document.getElementById("menu-btn");
  const guideBtn = document.getElementById("guide-btn");
  const menuGuideBtn = document.getElementById("menu-guide-btn");
  const guideOverlay = document.getElementById("guide-overlay");
  const guideClose = document.getElementById("guide-close");
  const guideBody = document.getElementById("guide-body");
  const guideSpotMult = document.getElementById("guide-spot-mult");
  const guideSpotName = document.getElementById("guide-spot-name");
  const floatLayer = document.getElementById("float-layer");

  let state = defaultState();
  let sessionStarted = false;
  let lastSaveAt = 0;
  let lastSubmitAt = 0;
  let phase = "ready"; // ready | waiting | bite | result
  let waitTimer = null;
  let biteTimer = null;
  let biteEndsAt = 0;
  let boatAcc = {};

  function defaultState() {
    const owned = {};
    GEAR.forEach((g) => {
      owned[g.id] = false;
    });
    return {
      coins: 25,
      lifetime: 0,
      spotId: "creek",
      unlocked: { creek: true },
      owned,
      cooler: [],
      autoSell: false,
      catches: 0,
      perfects: 0,
      lastTick: Date.now()
    };
  }

  function fishById(id) {
    return FISH.find((f) => f.id === id);
  }

  function currentSpot() {
    return SPOTS.find((s) => s.id === state.spotId) || SPOTS[0];
  }

  function ownedGear(kind) {
    return GEAR.filter((g) => g.kind === kind && state.owned[g.id]);
  }

  function biteWindow() {
    const bonus = ownedGear("window").reduce((s, g) => s + g.amount, 0);
    return Math.min(1.35, 0.45 + bonus);
  }

  function waitScale() {
    const cut = ownedGear("speed").reduce((s, g) => s + g.amount, 0);
    return Math.max(0.35, 1 - cut);
  }

  function luckBonus() {
    return ownedGear("luck").reduce((s, g) => s + g.amount, 0);
  }

  function coolerMax() {
    return COOLER_BASE + ownedGear("cooler").reduce((s, g) => s + g.amount, 0);
  }

  function boats() {
    return ownedGear("boat");
  }

  function loadState() {
    try {
      const raw = JSON.parse(localStorage.getItem(SAVE_KEY) || "null");
      if (!raw || typeof raw !== "object") return defaultState();
      const next = defaultState();
      next.coins = Math.max(0, Number(raw.coins) || 0);
      next.lifetime = Math.max(0, Number(raw.lifetime) || 0);
      next.spotId = SPOTS.some((s) => s.id === raw.spotId) ? raw.spotId : "creek";
      next.autoSell = !!raw.autoSell;
      next.catches = Math.max(0, Math.floor(Number(raw.catches) || 0));
      next.perfects = Math.max(0, Math.floor(Number(raw.perfects) || 0));
      next.lastTick = Math.max(0, Number(raw.lastTick) || Date.now());
      SPOTS.forEach((s) => {
        next.unlocked[s.id] = s.id === "creek" || !!raw.unlocked?.[s.id];
      });
      GEAR.forEach((g) => {
        next.owned[g.id] = !!raw.owned?.[g.id];
      });
      next.cooler = Array.isArray(raw.cooler)
        ? raw.cooler
            .map((id) => String(id))
            .filter((id) => fishById(id))
            .slice(0, coolerMaxFromOwned(next.owned))
        : [];
      return next;
    } catch {
      return defaultState();
    }
  }

  function coolerMaxFromOwned(owned) {
    return (
      COOLER_BASE +
      GEAR.filter((g) => g.kind === "cooler" && owned[g.id]).reduce((s, g) => s + g.amount, 0)
    );
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

  const SUFFIXES = ["", "K", "M", "B", "T", "Qa", "Qi", "Sx", "Sp", "Oc", "No", "Dc"];

  function formatNum(n) {
    let v = Math.abs(Number(n) || 0);
    if (!Number.isFinite(v)) return "0";
    if (v < 1000) return String(Math.floor(v));
    let tier = 0;
    while (v >= 1000 && tier < SUFFIXES.length - 1) {
      v /= 1000;
      tier += 1;
    }
    const text = v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(1) : v.toFixed(2);
    return `${text.replace(/\.0+$/, "").replace(/(\.\d*[1-9])0+$/, "$1")}${SUFFIXES[tier]}`;
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
    if (best > getStoredBest()) {
      try {
        localStorage.setItem(HIGH_SCORE_KEY, String(best));
      } catch {}
    }
    const now = Date.now();
    if (!force && now - lastSubmitAt < 4000) return;
    if (window.HubLeaderboard) {
      lastSubmitAt = now;
      HubLeaderboard.submit("fishing", best).catch?.(() => {});
    }
  }

  function checkAchievements() {
    if (!window.HubAchievements) return;
    const life = state.lifetime;
    if (life >= 100) HubAchievements.unlock("fishing_100");
    if (life >= 1000) HubAchievements.unlock("fishing_1k");
    if (life >= 100000) HubAchievements.unlock("fishing_100k");
    if (life >= 1000000) HubAchievements.unlock("fishing_1m");
    if (boats().length >= 1) HubAchievements.unlock("fishing_fps_10");
    if (boats().length >= 3) HubAchievements.unlock("fishing_fps_100");
    if (state.unlocked.deep) HubAchievements.unlock("fishing_voyage_1");
  }

  function ensureSession() {
    if (sessionStarted) return;
    sessionStarted = true;
    window.HubStreak?.recordPlay?.();
    window.HubPlays?.record?.("fishing");
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

  function setPhase(next) {
    phase = next;
    castBtn.classList.remove("phase-ready", "phase-waiting", "phase-bite", "phase-result");
    castBtn.classList.add(`phase-${next === "ready" ? "ready" : next}`);
    biteMeter?.classList.toggle("active", next === "bite");
    if (next === "ready") {
      castBtnText.textContent = "Cast";
      castBtn.disabled = false;
    } else if (next === "waiting") {
      castBtnText.textContent = "Cancel";
      castBtn.disabled = false;
    } else if (next === "bite") {
      castBtnText.textContent = "Reel!";
      castBtn.disabled = false;
    } else {
      castBtnText.textContent = "…";
      castBtn.disabled = true;
    }
  }

  function clearTimers() {
    if (waitTimer) clearTimeout(waitTimer);
    if (biteTimer) clearTimeout(biteTimer);
    waitTimer = null;
    biteTimer = null;
  }

  function rarityFactor(rarity, spotRarity) {
    // Worse spots (low rarity) heavily favor commons; better spots open up rares+.
    const t = Math.max(0, Math.min(5, Number(spotRarity) || 0)) / 5;
    if (rarity === "common") return 1.55 - t * 0.85;
    if (rarity === "uncommon") return 0.45 + t * 0.7;
    if (rarity === "rare") return 0.12 + t * 1.05;
    if (rarity === "epic") return 0.04 + t * 1.15;
    if (rarity === "legendary") return 0.01 + t * 1.25;
    if (rarity === "mythic") return 0.004 + t * 1.4;
    return 1;
  }

  function fishWeight(fish, spot, forBoat = false) {
    const luck = luckBonus() * (forBoat ? 0.55 : 1);
    let w = (RARITY_WEIGHT[fish.rarity] || 10) * rarityFactor(fish.rarity, spot.rarity);
    if (fish.rarity === "uncommon") w += luck * 0.35;
    if (fish.rarity === "rare") w += luck * 0.5;
    if (fish.rarity === "epic") w += luck * 0.4;
    if (fish.rarity === "legendary") w += luck * 0.3;
    if (fish.rarity === "mythic") w += luck * 0.22;
    // Worse spots still suppress luck on top rarities
    const t = Math.max(0, Math.min(5, Number(spot.rarity) || 0)) / 5;
    if (fish.rarity === "epic" || fish.rarity === "legendary") w *= 0.35 + t * 0.65;
    if (fish.rarity === "mythic") w *= 0.18 + t * 0.82;
    return Math.max(0.05, w);
  }

  function rollFish(spot, forBoat = false) {
    const pool = FISH;
    const weights = pool.map((f) => fishWeight(f, spot, forBoat));
    const total = weights.reduce((a, b) => a + b, 0);
    let r = Math.random() * total;
    for (let i = 0; i < pool.length; i += 1) {
      r -= weights[i];
      if (r <= 0) return pool[i];
    }
    return pool[pool.length - 1];
  }

  function chancePct(fish, spot) {
    const total = FISH.reduce((s, f) => s + fishWeight(f, spot, false), 0);
    const w = fishWeight(fish, spot, false);
    return total > 0 ? (100 * w) / total : 0;
  }

  function fishValue(fish, spot) {
    return Math.max(1, Math.floor(fish.value * (spot?.valueMult || 1)));
  }

  function addToCooler(fish, opts = {}) {
    if (!fish) return false;
    if (state.autoSell || opts.forceSell) {
      const val = fishValue(fish, currentSpot());
      addCoins(val);
      if (!opts.silent) {
        setCatchLine(`Sold ${fish.name} for ${formatNum(val)}`, catchTone(fish.rarity));
      }
      return true;
    }
    if (state.cooler.length >= coolerMax()) {
      if (!opts.silent) setCatchLine("Cooler full — sell or enable auto-sell", "miss");
      window.HubSound?.play?.("miss");
      return false;
    }
    state.cooler.push(fish.id);
    return true;
  }

  function setCatchLine(text, cls = "") {
    if (!catchLineEl) return;
    catchLineEl.textContent = text;
    catchLineEl.classList.remove("miss", "legend", "mythic");
    if (cls) catchLineEl.classList.add(cls);
  }

  function isShowcaseRarity(rarity) {
    return rarity === "legendary" || rarity === "mythic";
  }

  function catchTone(rarity) {
    if (rarity === "mythic") return "mythic";
    if (rarity === "legendary") return "legend";
    return "";
  }

  function startCast() {
    if (phase !== "ready") return;
    if (state.cooler.length >= coolerMax() && !state.autoSell) {
      setCatchLine("Cooler full — sell fish first", "miss");
      window.HubSound?.play?.("miss");
      return;
    }
    ensureSession();
    clearTimers();
    const spot = currentSpot();
    const [lo, hi] = spot.wait;
    const waitMs = (lo + Math.random() * (hi - lo)) * 1000 * waitScale();
    setPhase("waiting");
    setCatchLine("Line is out… tap again to cancel");
    window.HubSound?.play?.("flap");
    waitTimer = setTimeout(() => openBite(), waitMs);
    saveSoon();
  }

  function cancelCast() {
    if (phase !== "waiting") return;
    clearTimers();
    setPhase("ready");
    setCatchLine("Line reeled in");
    window.HubSound?.play?.("miss");
  }

  function openBite() {
    if (phase !== "waiting") return;
    const windowSec = biteWindow();
    biteEndsAt = performance.now() + windowSec * 1000;
    setPhase("bite");
    setCatchLine("Bite! Tap Reel now!", "");
    window.HubSound?.play?.("click");
    if (biteFill) {
      biteFill.style.transition = "none";
      biteFill.style.transform = "scaleX(1)";
      requestAnimationFrame(() => {
        biteFill.style.transition = `transform ${windowSec}s linear`;
        biteFill.style.transform = "scaleX(0)";
      });
    }
    biteTimer = setTimeout(() => missBite(), windowSec * 1000);
  }

  function missBite() {
    if (phase !== "bite") return;
    clearTimers();
    setPhase("result");
    setCatchLine("It got away…", "miss");
    window.HubSound?.play?.("miss");
    setTimeout(() => {
      setPhase("ready");
      setCatchLine("Ready to cast");
      render(false);
    }, 700);
  }

  function reelIn(evt) {
    if (phase === "ready") {
      startCast();
      return;
    }
    if (phase === "waiting") {
      cancelCast();
      return;
    }
    if (phase !== "bite") return;
    clearTimers();
    const remaining = Math.max(0, biteEndsAt - performance.now());
    const windowMs = biteWindow() * 1000;
    const perfect = remaining / windowMs > 0.55;
    const spot = currentSpot();
    const fish = rollFish(spot, false);
    state.catches += 1;
    if (perfect) state.perfects += 1;

    const ok = addToCooler(fish);
    setPhase("result");
    if (ok) {
      const tip = perfect ? "Perfect reel! " : "";
      setCatchLine(
        `${tip}Caught ${fish.name} (${fish.rarity})`,
        catchTone(fish.rarity)
      );
      window.HubSound?.play?.(perfect || isShowcaseRarity(fish.rarity) ? "win" : "click");
      if (isShowcaseRarity(fish.rarity)) window.HubConfetti?.burst?.();
      const rect = castBtn.getBoundingClientRect();
      spawnFloat(
        evt?.clientX ?? rect.left + rect.width / 2,
        evt?.clientY ?? rect.top + 20,
        fish.name
      );
    }
    checkAchievements();
    setTimeout(() => {
      setPhase("ready");
      render(false);
      saveSoon();
    }, 650);
  }

  function sellCooler() {
    if (!state.cooler.length) return;
    ensureSession();
    const spot = currentSpot();
    let total = 0;
    state.cooler.forEach((id) => {
      const fish = fishById(id);
      if (fish) total += fishValue(fish, spot);
    });
    state.cooler = [];
    addCoins(total);
    setCatchLine(`Sold catch for ${formatNum(total)} coins`);
    window.HubSound?.play?.("win");
    render(false);
    saveSoon();
  }

  function buyGear(id) {
    const item = GEAR.find((g) => g.id === id);
    if (!item || state.owned[id] || state.coins < item.cost) return;
    ensureSession();
    state.coins -= item.cost;
    state.owned[id] = true;
    window.HubSound?.play?.("click");
    if (item.kind === "boat") window.HubConfetti?.burst?.();
    checkAchievements();
    render();
    saveSoon();
  }

  function unlockOrSelectSpot(id) {
    const spot = SPOTS.find((s) => s.id === id);
    if (!spot) return;
    if (state.unlocked[id]) {
      state.spotId = id;
      setCatchLine(`Fishing at ${spot.name}`);
      render();
      saveSoon();
      return;
    }
    if (state.coins < spot.cost) return;
    ensureSession();
    state.coins -= spot.cost;
    state.unlocked[id] = true;
    state.spotId = id;
    setCatchLine(`Unlocked ${spot.name}!`);
    window.HubSound?.play?.("win");
    window.HubConfetti?.burst?.();
    checkAchievements();
    render();
    saveSoon();
  }

  function boatCatch(boat) {
    const spot = currentSpot();
    const fish = rollFish(spot, true);
    if (state.autoSell || state.cooler.length < coolerMax()) {
      addToCooler(fish, { silent: true });
      state.catches += 1;
    }
  }

  function tickBoats(dt) {
    boats().forEach((boat) => {
      const interval = boat.amount;
      boatAcc[boat.id] = (boatAcc[boat.id] || 0) + dt;
      while (boatAcc[boat.id] >= interval) {
        boatAcc[boat.id] -= interval;
        boatCatch(boat);
      }
    });
  }

  function applyOffline() {
    const now = Date.now();
    const elapsed = Math.min(6 * 3600 * 1000, Math.max(0, now - (state.lastTick || now)));
    if (elapsed < 8000) {
      state.lastTick = now;
      return;
    }
    const list = boats();
    if (!list.length) {
      state.lastTick = now;
      return;
    }
    let gained = 0;
    const spot = currentSpot();
    list.forEach((boat) => {
      const count = Math.floor(elapsed / 1000 / boat.amount);
      for (let i = 0; i < Math.min(count, 400); i += 1) {
        const fish = rollFish(spot, true);
        if (state.autoSell) {
          gained += fishValue(fish, spot);
        } else if (state.cooler.length < coolerMax()) {
          state.cooler.push(fish.id);
        } else {
          gained += fishValue(fish, spot);
        }
      }
    });
    if (gained > 0) addCoins(gained);
    if (gained > 0 || state.cooler.length) {
      setCatchLine(
        gained > 0
          ? `While away your boats earned ${formatNum(gained)} coins`
          : "Boats filled part of your cooler while away"
      );
    }
    state.lastTick = now;
  }

  function renderCooler() {
    if (coolerCountEl) coolerCountEl.textContent = String(state.cooler.length);
    if (coolerMaxEl) coolerMaxEl.textContent = String(coolerMax());
    if (hudCoolerEl) hudCoolerEl.textContent = `${state.cooler.length}/${coolerMax()}`;
    if (sellBtn) sellBtn.disabled = state.cooler.length === 0;
    if (autoSellEl) autoSellEl.checked = !!state.autoSell;
    if (!coolerList) return;
    coolerList.innerHTML = state.cooler
      .map((id) => {
        const fish = fishById(id);
        if (!fish) return "";
        return `<span class="fish-chip ${fish.rarity}">${fish.name}</span>`;
      })
      .join("");
  }

  function renderSpots() {
    if (!spotList) return;
    spotList.innerHTML = SPOTS.map((spot) => {
      const unlocked = !!state.unlocked[spot.id];
      const active = state.spotId === spot.id;
      let action;
      if (active) action = `<button type="button" class="spot-btn is-active" disabled>Here</button>`;
      else if (unlocked)
        action = `<button type="button" class="spot-btn" data-spot="${spot.id}">Fish</button>`;
      else
        action = `<button type="button" class="spot-btn" data-spot="${spot.id}" ${
          state.coins >= spot.cost ? "" : "disabled"
        }>${formatNum(spot.cost)}</button>`;
      return `<div class="spot-item ${active ? "active" : ""}" role="listitem">
        <div class="spot-item-main">
          <div class="spot-item-name">${spot.name}</div>
          <p class="spot-item-desc">${unlocked ? `${spot.blurb} · sell ×${spot.valueMult}` : "Locked spot"}</p>
        </div>
        ${action}
      </div>`;
    }).join("");
  }

  function renderShop() {
    if (!shopList) return;
    shopList.innerHTML = GEAR.map((item) => {
      const owned = !!state.owned[item.id];
      return `<div class="shop-item" role="listitem">
        <div class="shop-item-main">
          <div class="shop-item-name">${item.name}</div>
          <p class="shop-item-desc">${item.desc}</p>
          <div class="shop-item-owned">${owned ? "Owned" : "Not owned"}</div>
        </div>
        <button type="button" class="buy-btn" data-buy="${item.id}" ${
          owned || state.coins < item.cost ? "disabled" : ""
        }>${owned ? "✓" : formatNum(item.cost)}</button>
      </div>`;
    }).join("");
  }

  function renderStats() {
    const spot = currentSpot();
    const best = Math.max(getStoredBest(), Math.floor(state.lifetime));
    if (coinCountEl) coinCountEl.textContent = formatNum(state.coins);
    if (spotLabelEl) spotLabelEl.textContent = spot.name;
    if (hudSpotEl) hudSpotEl.textContent = spot.name;
    if (windowLabelEl) windowLabelEl.textContent = `${biteWindow().toFixed(2)}s`;
    if (boatsLabelEl) boatsLabelEl.textContent = String(boats().length);
    if (hudBestEl) hudBestEl.textContent = formatNum(best);
    if (overlayBestEl) overlayBestEl.textContent = formatNum(best);
  }

  function render(full = true) {
    renderStats();
    renderCooler();
    if (full) {
      renderSpots();
      renderShop();
    } else {
      // refresh affordability without full rebuild when possible
      spotList?.querySelectorAll("[data-spot]").forEach((btn) => {
        const spot = SPOTS.find((s) => s.id === btn.dataset.spot);
        if (!spot || state.unlocked[spot.id]) return;
        btn.disabled = state.coins < spot.cost;
        btn.textContent = formatNum(spot.cost);
      });
      shopList?.querySelectorAll("[data-buy]").forEach((btn) => {
        const id = btn.dataset.buy;
        if (state.owned[id]) {
          btn.disabled = true;
          btn.textContent = "✓";
          return;
        }
        const item = GEAR.find((g) => g.id === id);
        if (!item) return;
        btn.disabled = state.coins < item.cost;
        btn.textContent = formatNum(item.cost);
      });
    }
  }

  function saveSoon() {
    const now = Date.now();
    if (now - lastSaveAt < 700) return;
    lastSaveAt = now;
    saveState();
  }

  function tick() {
    tickBoats(TICK_MS / 1000);
    renderCooler();
    renderStats();
    saveSoon();
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

  function rarityOrder(r) {
    return { common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4, mythic: 5 }[r] ?? 0;
  }

  function formatChance(pct) {
    if (pct >= 10) return `${pct.toFixed(0)}%`;
    if (pct >= 1) return `${pct.toFixed(1)}%`;
    if (pct >= 0.1) return `${pct.toFixed(2)}%`;
    return "<0.1%";
  }

  function renderGuide() {
    const spot = currentSpot();
    if (guideSpotMult) guideSpotMult.textContent = `×${spot.valueMult}`;
    if (guideSpotName) guideSpotName.textContent = spot.name;
    if (!guideBody) return;
    const rows = [...FISH].sort(
      (a, b) => rarityOrder(a.rarity) - rarityOrder(b.rarity) || a.value - b.value
    );
    guideBody.innerHTML = rows
      .map((fish) => {
        const here = fishValue(fish, spot);
        const chance = formatChance(chancePct(fish, spot));
        return `<tr class="at-spot">
          <td class="guide-fish-name">${fish.name}</td>
          <td class="guide-rarity ${fish.rarity}">${fish.rarity}</td>
          <td>${formatNum(fish.value)}</td>
          <td class="guide-here">${formatNum(here)}</td>
          <td class="guide-spots">${chance} here</td>
        </tr>`;
      })
      .join("");
  }

  function openGuide() {
    renderGuide();
    guideOverlay?.classList.remove("hidden");
  }

  function closeGuide() {
    guideOverlay?.classList.add("hidden");
  }

  castBtn?.addEventListener("pointerup", (e) => {
    // Prefer pointerup so cancel works reliably on touch while waiting
    if (e.button != null && e.button !== 0) return;
    reelIn(e);
  });
  // Keep click as fallback for keyboard activation
  castBtn?.addEventListener("click", (e) => {
    if (e.detail === 0) reelIn(e);
  });
  sellBtn?.addEventListener("click", () => sellCooler());
  autoSellEl?.addEventListener("change", () => {
    state.autoSell = !!autoSellEl.checked;
    saveSoon();
  });
  shopList?.addEventListener("pointerdown", (e) => {
    const btn = e.target.closest("[data-buy]");
    if (!btn || btn.disabled) return;
    e.preventDefault();
    buyGear(btn.dataset.buy);
  });
  spotList?.addEventListener("pointerdown", (e) => {
    const btn = e.target.closest("[data-spot]");
    if (!btn || btn.disabled) return;
    e.preventDefault();
    unlockOrSelectSpot(btn.dataset.spot);
  });
  startBtn?.addEventListener("click", closeMenu);
  menuBtn?.addEventListener("click", openMenu);
  guideBtn?.addEventListener("click", openGuide);
  menuGuideBtn?.addEventListener("click", () => {
    closeMenu();
    openGuide();
  });
  guideClose?.addEventListener("click", closeGuide);
  guideOverlay?.addEventListener("click", (e) => {
    if (e.target === guideOverlay) closeGuide();
  });
  window.addEventListener("keydown", (e) => {
    if (e.code !== "Escape") return;
    if (guideOverlay && !guideOverlay.classList.contains("hidden")) {
      e.preventDefault();
      closeGuide();
      return;
    }
    if (overlay && !overlay.classList.contains("hidden")) {
      e.preventDefault();
      closeMenu();
    }
  });
  gamesBtn?.addEventListener("click", () => {
    saveState();
    maybeSubmitBest(true);
    window.location.href = "../index.html#games";
  });

  state = loadState();
  applyOffline();
  setPhase("ready");
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
