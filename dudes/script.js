(function () {
  const HIGH_SCORE_KEY = "lemmings-high-score";
  const LEVEL_KEY = "lemmings-max-level-v1";
  const CURRENT_KEY = "lemmings-current-level-v1";
  const SCORE_KEY = "lemmings-session-score-v1";
  const TILE = 16;
  const COLS = 40;
  const ROWS = 22;
  const W = COLS * TILE;
  const H = ROWS * TILE;
  const LEM_W = 10;
  const LEM_H = 14;
  const MAX_FALL = 8 * TILE;
  const SPAWN_GAP = 1.0;

  const SKILLS = [
    { id: "blocker", name: "Block", ico: "🛑", tip: "Stops and turns other walkers around" },
    { id: "builder", name: "Build", ico: "🪜", tip: "Builds a bridge forward across gaps" },
    { id: "basher", name: "Bash", ico: "🥊", tip: "Digs sideways through dirt walls" },
    { id: "digger", name: "Dig", ico: "⛏️", tip: "Digs straight down through dirt" },
    { id: "floater", name: "Float", ico: "🪂", tip: "Opens an umbrella so long falls are safe" },
    { id: "bomber", name: "Bomb", ico: "💥", tip: "Explodes after a short countdown" },
    { id: "climber", name: "Climb", ico: "🧗", tip: "Gives that walker the ability to climb walls forever" }
  ];

  const SKIN_KEY = "dudes-skin-v1";
  /** Tiny walker looks — palette + hat/extra. coinItem ties to HubCoins shop. */
  const SKINS = {
    classic: {
      label: "Classic",
      body: "#22c55e",
      hat: "#14532d",
      face: "#fde68a",
      hatStyle: "flat"
    },
    blue: {
      label: "Blue crew",
      body: "#3b82f6",
      hat: "#1e3a8a",
      face: "#fde68a",
      hatStyle: "flat"
    },
    sunset: {
      label: "Sunset",
      body: "#fb7185",
      hat: "#9f1239",
      face: "#ffedd5",
      hatStyle: "flat",
      coinItem: "skin:dudes-sunset",
      coinCost: 200,
      locked: true
    },
    midnight: {
      label: "Midnight",
      body: "#334155",
      hat: "#0f172a",
      face: "#a5f3fc",
      hatStyle: "flat",
      coinItem: "skin:dudes-midnight",
      coinCost: 250,
      locked: true
    },
    honey: {
      label: "Honey",
      body: "#f59e0b",
      hat: "#78350f",
      face: "#fef3c7",
      hatStyle: "flat",
      coinItem: "skin:dudes-honey",
      coinCost: 200,
      locked: true
    },
    mint: {
      label: "Mint ice",
      body: "#6ee7b7",
      hat: "#047857",
      face: "#ecfdf5",
      hatStyle: "pom",
      coinItem: "skin:dudes-mint",
      coinCost: 200,
      locked: true
    },
    beanie: {
      label: "Beanie",
      body: "#22c55e",
      hat: "#7c3aed",
      face: "#fde68a",
      hatStyle: "beanie",
      coinItem: "skin:dudes-beanie",
      coinCost: 250,
      locked: true
    },
    hardhat: {
      label: "Hard hat",
      body: "#22c55e",
      hat: "#facc15",
      face: "#fde68a",
      hatStyle: "hardhat",
      coinItem: "skin:dudes-hardhat",
      coinCost: 300,
      locked: true
    },
    bandana: {
      label: "Bandana",
      body: "#16a34a",
      hat: "#dc2626",
      face: "#fde68a",
      hatStyle: "bandana",
      coinItem: "skin:dudes-bandana",
      coinCost: 300,
      locked: true
    },
    propeller: {
      label: "Propeller",
      body: "#22c55e",
      hat: "#0ea5e9",
      face: "#fde68a",
      hatStyle: "propeller",
      coinItem: "skin:dudes-propeller",
      coinCost: 350,
      locked: true
    },
    crown: {
      label: "Crown",
      body: "#22c55e",
      hat: "#eab308",
      face: "#fde68a",
      hatStyle: "crown",
      coinItem: "skin:dudes-crown",
      coinCost: 450,
      locked: true
    },
    builder: {
      label: "Builder",
      body: "#ea580c",
      hat: "#facc15",
      face: "#fde68a",
      hatStyle: "hardhat",
      vest: "#fb923c",
      coinItem: "skin:dudes-builder",
      coinCost: 300,
      locked: true
    },
    bomber: {
      label: "Bomber",
      body: "#64748b",
      hat: "#1e293b",
      face: "#fde68a",
      hatStyle: "flat",
      fuse: true,
      coinItem: "skin:dudes-bomber",
      coinCost: 350,
      locked: true
    },
    floater: {
      label: "Floater",
      body: "#38bdf8",
      hat: "#0369a1",
      face: "#fde68a",
      hatStyle: "flat",
      floatStriped: true,
      coinItem: "skin:dudes-floater",
      coinCost: 300,
      locked: true
    },
    climber: {
      label: "Climber",
      body: "#22c55e",
      hat: "#14532d",
      face: "#fde68a",
      hatStyle: "flat",
      pack: true,
      coinItem: "skin:dudes-climber",
      coinCost: 300,
      locked: true
    },
    blocker: {
      label: "Blocker",
      body: "#f97316",
      hat: "#9a3412",
      face: "#fde68a",
      hatStyle: "flat",
      stopSign: true,
      coinItem: "skin:dudes-blocker",
      coinCost: 300,
      locked: true
    },
    ghost: {
      label: "Ghost",
      body: "rgba(248,250,252,0.88)",
      hat: "rgba(226,232,240,0.5)",
      face: "#e2e8f0",
      hatStyle: "none",
      special: "ghost",
      coinItem: "skin:dudes-ghost",
      coinCost: 450,
      locked: true
    },
    robot: {
      label: "Robot",
      body: "#94a3b8",
      hat: "#475569",
      face: "#22d3ee",
      hatStyle: "flat",
      special: "robot",
      coinItem: "skin:dudes-robot",
      coinCost: 500,
      locked: true
    },
    cat: {
      label: "Cat",
      body: "#a78bfa",
      hat: "#6d28d9",
      face: "#fde68a",
      hatStyle: "ears",
      whiskers: true,
      coinItem: "skin:dudes-cat",
      coinCost: 400,
      locked: true
    },
    duck: {
      label: "Duck",
      body: "#facc15",
      hat: "#eab308",
      face: "#fef08a",
      hatStyle: "beak",
      coinItem: "skin:dudes-duck",
      coinCost: 400,
      locked: true
    },
    rainbow: {
      label: "Rainbow",
      body: "#22c55e",
      hat: "#14532d",
      face: "#fde68a",
      hatStyle: "flat",
      special: "rainbow",
      coinItem: "skin:dudes-rainbow",
      coinCost: 500,
      locked: true
    }
  };

  const HOW_TO_HTML = `<ol class="how-list">
    <li><strong>Green walkers</strong> drop from the yellow <strong>IN</strong> box and walk on their own.</li>
    <li>Get enough of them into the green <strong>OUT</strong> door to clear the level.</li>
    <li>Tap a <strong>skill</strong>, then tap a walker. Numbers are uses left — not ladders on the map.</li>
    <li><strong>Climb</strong> = ability to scale walls. <strong>Build</strong> = make a bridge. You don’t place ladder rungs.</li>
  </ol>`;

  // Keep every row exactly COLS chars. # dirt  = steel  . air  ~ water  E in  X out
  const LEVELS = [
    {
      name: "Just Walk",
      tip: "Level 1: do nothing — they walk by themselves to the green OUT door. Save 5.",
      release: 10,
      need: 5,
      rate: 1.0,
      skills: { blocker: 0, builder: 0, basher: 0, digger: 0, floater: 0, bomber: 0, climber: 0 },
      map: [
        "........................................",
        "........................................",
        "........................................",
        "........................................",
        "......E............................X....",
        "........................................",
        "########################################",
        "########################################",
        "........................................",
        "........................................",
        "........................................",
        "........................................",
        "........................................",
        "........................................",
        "........................................",
        "........................................",
        "........................................",
        "........................................",
        "........................................",
        "........................................",
        "########################################",
        "########################################"
      ]
    },
    {
      name: "Mind the Gap",
      tip: "Gap over water! Select Build, then tap a walker near the edge to make a bridge.",
      release: 12,
      need: 7,
      rate: 0.95,
      skills: { blocker: 2, builder: 8, basher: 0, digger: 0, floater: 0, bomber: 0, climber: 0 },
      map: [
        "........................................",
        "........................................",
        "........................................",
        "....E..............................X....",
        "........................................",
        "################........################",
        "################........################",
        "........................................",
        "........................................",
        "........................................",
        "........................................",
        "........................................",
        "........................................",
        "........................................",
        "................~~~~~~~~~~~~~~~~........",
        "................~~~~~~~~~~~~~~~~........",
        "........................................",
        "........................................",
        "........................................",
        "........................................",
        "########################################",
        "########################################"
      ]
    },
    {
      name: "Bash Through",
      tip: "Dirt wall blocks the path. Select Bash, tap a walker facing the wall.",
      release: 12,
      need: 8,
      rate: 0.95,
      skills: { blocker: 1, builder: 0, basher: 12, digger: 0, floater: 0, bomber: 1, climber: 0 },
      map: [
        "........................................",
        "........................................",
        "........................................",
        "...E..............####................X.",
        "..................####..................",
        "########################################",
        "########################################",
        "........................................",
        "........................................",
        "........................................",
        "........................................",
        "........................................",
        "........................................",
        "........................................",
        "........................................",
        "........................................",
        "........................................",
        "........................................",
        "........................................",
        "........................................",
        "########################################",
        "########################################"
      ]
    },
    {
      name: "Dig Down",
      tip: "Exit is below. Select Dig, tap a walker standing over the open tunnel (the dotted gap).",
      release: 14,
      need: 9,
      rate: 0.9,
      skills: { blocker: 2, builder: 0, basher: 0, digger: 8, floater: 4, bomber: 1, climber: 0 },
      map: [
        "........................................",
        ".................E......................",
        "........................................",
        "########################################",
        "########################################",
        "################......##################",
        "################......##################",
        "################......X#################",
        "################......##################",
        "########################################",
        "########################################",
        "........................................",
        "........................................",
        "........................................",
        "........................................",
        "........................................",
        "........................................",
        "........................................",
        "........................................",
        "........................................",
        "########################################",
        "########################################"
      ]
    },
    {
      name: "Floaters",
      tip: "Long drop! Select Float, tap walkers before they fall so they don’t splat.",
      release: 12,
      need: 8,
      rate: 0.95,
      skills: { blocker: 0, builder: 0, basher: 0, digger: 0, floater: 12, bomber: 0, climber: 0 },
      map: [
        ".........E..............................",
        "........................................",
        "##########..............................",
        "##########..............................",
        "........................................",
        "........................................",
        "........................................",
        "........................................",
        "........................................",
        "........................................",
        "........................................",
        "........................................",
        "........................................",
        ".....................................X..",
        "........................................",
        "########################################",
        "########################################",
        "........................................",
        "........................................",
        "........................................",
        "########################################",
        "########################################"
      ]
    },
    {
      name: "Climb Up",
      tip: "Climb is not ladders — tap Climb, then tap walkers. They climb the green wall alone. Need 7 (you have Climb for all 12).",
      release: 12,
      need: 7,
      rate: 0.9,
      skills: { blocker: 1, builder: 2, basher: 0, digger: 0, floater: 2, bomber: 0, climber: 12 },
      map: [
        "........................................",
        "........................................",
        ".....................................X..",
        "........................................",
        "..........................==============",
        "..........................==============",
        "........................##..............",
        "........................##..............",
        "........................##..............",
        "........................##..............",
        "........................##..............",
        "........................##..............",
        "....E...................##..............",
        "##########################..............",
        "##########################..............",
        "........................................",
        "........................................",
        "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
        "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
        "........................................",
        "########################################",
        "########################################"
      ]
    },
    {
      name: "Turn Around",
      tip: "They walk right into water! Block one near the right edge so the rest turn left toward OUT.",
      release: 12,
      need: 8,
      rate: 0.95,
      skills: { blocker: 3, builder: 0, basher: 0, digger: 0, floater: 0, bomber: 0, climber: 0 },
      map: [
        "........................................",
        "........................................",
        "........................................",
        ".X.............E........................",
        "........................................",
        "##############################..........",
        "##############################..........",
        "........................................",
        "........................................",
        "........................................",
        "........................................",
        "........................................",
        "........................................",
        "........................................",
        "..............................~~~~~~~~~~",
        "..............................~~~~~~~~~~",
        "........................................",
        "........................................",
        "........................................",
        "........................................",
        "########################################",
        "########################################"
      ]
    },
    {
      name: "Double Gap",
      tip: "Two gaps — Build across each one. Take the first gap like Mind the Gap, then the short one.",
      release: 12,
      need: 6,
      rate: 0.85,
      skills: { blocker: 3, builder: 14, basher: 0, digger: 0, floater: 0, bomber: 0, climber: 0 },
      map: [
        "........................................",
        "........................................",
        "........................................",
        "...E................................X...",
        "........................................",
        "################........############...#",
        "################........############...#",
        "........................................",
        "........................................",
        "........................................",
        "........................................",
        "........................................",
        "........................................",
        "........................................",
        "................~~~~~~~~............~~~.",
        "................~~~~~~~~............~~~.",
        "........................................",
        "........................................",
        "........................................",
        "........................................",
        "########################################",
        "########################################"
      ]
    },
    {
      name: "Bomb the Plug",
      tip: "Steel floor — Bash won't help. Bomb a walker against the dirt wall to open the path.",
      release: 12,
      need: 7,
      rate: 0.95,
      skills: { blocker: 2, builder: 0, basher: 0, digger: 0, floater: 0, bomber: 4, climber: 0 },
      map: [
        "........................................",
        "........................................",
        "........................................",
        "...E...............##.................X.",
        "...................##...................",
        "========================================",
        "========================================",
        "........................................",
        "........................................",
        "........................................",
        "........................................",
        "........................................",
        "........................................",
        "........................................",
        "........................................",
        "........................................",
        "........................................",
        "........................................",
        "........................................",
        "........................................",
        "########################################",
        "########################################"
      ]
    },
    {
      name: "Shaft Drop",
      tip: "Dig a shaft down, then Float so the long fall to OUT doesn't splat them.",
      release: 12,
      need: 7,
      rate: 0.9,
      skills: { blocker: 2, builder: 0, basher: 0, digger: 6, floater: 12, bomber: 0, climber: 0 },
      map: [
        "........................................",
        "..............E.........................",
        "........................................",
        "########################################",
        "########################################",
        "########################################",
        "########################################",
        "##############......####################",
        "##############......####################",
        "##############......####################",
        "##############......####################",
        "........................................",
        "........................................",
        ".....................................X..",
        "........................................",
        "========================================",
        "========================================",
        "........................................",
        "........................................",
        "........................................",
        "########################################",
        "########################################"
      ]
    },
    {
      name: "Tunnel Job",
      tip: "Bash a long tunnel through the thick dirt wall to reach OUT.",
      release: 14,
      need: 9,
      rate: 0.9,
      skills: { blocker: 2, builder: 0, basher: 24, digger: 0, floater: 0, bomber: 1, climber: 0 },
      map: [
        "........................................",
        "........................................",
        "........................................",
        "...E.............##########..........X..",
        ".................##########.............",
        "########################################",
        "########################################",
        "########################################",
        "########################################",
        "........................................",
        "........................................",
        "........................................",
        "........................................",
        "........................................",
        "........................................",
        "........................................",
        "........................................",
        "........................................",
        "........................................",
        "........................................",
        "########################################",
        "########################################"
      ]
    },
    {
      name: "High Road",
      tip: "Climb the short wall onto the steel road, then walk to OUT.",
      release: 12,
      need: 7,
      rate: 0.9,
      skills: { blocker: 2, builder: 8, basher: 0, digger: 0, floater: 2, bomber: 0, climber: 12 },
      map: [
        "........................................",
        "........................................",
        ".....................................X..",
        "........................................",
        "..................======================",
        "..................======================",
        "..................##....................",
        "..................##....................",
        "....E.............##....................",
        "####################......##############",
        "####################......##############",
        "........................................",
        "........................................",
        "........................................",
        "......................~~~~~~............",
        "......................~~~~~~............",
        "........................................",
        "........................................",
        "........................................",
        "........................................",
        "########################################",
        "########################################"
      ]
    }
  ];

  LEVELS.forEach((lvl) => {
    lvl.map = lvl.map.map((row) => {
      const r = String(row || "").slice(0, COLS);
      return r.length >= COLS ? r : r + ".".repeat(COLS - r.length);
    });
    while (lvl.map.length < ROWS) lvl.map.push(".".repeat(COLS));
    lvl.map = lvl.map.slice(0, ROWS);
  });

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const skillsEl = document.getElementById("skills");
  const levelTitleEl = document.getElementById("level-title");
  const goalLabelEl = document.getElementById("goal-label");
  const outCountEl = document.getElementById("out-count");
  const savedCountEl = document.getElementById("saved-count");
  const bestScoreEl = document.getElementById("best-score");
  const overlay = document.getElementById("overlay");
  const overlayTitle = document.getElementById("overlay-title");
  const overlayText = document.getElementById("overlay-text");
  const overlayBest = document.getElementById("overlay-best");
  const startBtn = document.getElementById("start-btn");
  const gamesBtn = document.getElementById("games-btn");
  const menuBtn = document.getElementById("menu-btn");
  const restartBtn = document.getElementById("restart-btn");
  const restartMenuBtn = document.getElementById("restart-menu-btn");
  const helpBtn = document.getElementById("help-btn");
  const levelsBtn = document.getElementById("levels-btn");
  const levelsMenuBtn = document.getElementById("levels-menu-btn");
  const levelSelectEl = document.getElementById("level-select");
  const levelTipEl = document.getElementById("level-tip");
  const hintEl = document.getElementById("hint");
  const skinPicker = document.getElementById("skin-picker");

  canvas.width = W;
  canvas.height = H;

  function ownsSkin(id) {
    const s = SKINS[id];
    if (!s) return false;
    if (!s.locked && !s.coinItem) return true;
    const itemId = s.coinItem;
    if (!itemId) return false;
    try {
      if (window.HubCoins?.hasPurchase?.(itemId)) return true;
    } catch {}
    return false;
  }

  function isCoinSkin(id) {
    const s = SKINS[id];
    return !!(s && (s.locked || s.coinItem));
  }

  function loadSkin() {
    try {
      const id = localStorage.getItem(SKIN_KEY) || "classic";
      if (!SKINS[id]) return "classic";
      if (isCoinSkin(id) && !ownsSkin(id)) return "classic";
      return id;
    } catch {
      return "classic";
    }
  }

  let skinId = loadSkin();

  function skin() {
    return SKINS[skinId] || SKINS.classic;
  }

  function setSkinHint(msg) {
    const el = document.getElementById("skin-lock-hint");
    if (el) el.textContent = msg || "";
  }

  function updateSkinPicker() {
    skinPicker?.querySelectorAll("[data-skin]").forEach((btn) => {
      const id = btn.dataset.skin;
      const s = SKINS[id];
      if (!s) return;
      const locked = isCoinSkin(id) && !ownsSkin(id);
      btn.classList.toggle("active", id === skinId);
      btn.classList.toggle("skin-btn-locked", locked);
      if (isCoinSkin(id)) {
        const short = s.label || id;
        btn.textContent = locked ? `${short} · ${s.coinCost || "?"}🪙` : short;
        btn.title = locked
          ? `Buy with hub coins (${s.coinCost || "?"})`
          : `${short} unlocked`;
      } else {
        btn.textContent = s.label || id;
      }
    });
  }

  function setSkin(id) {
    if (!SKINS[id]) return false;
    if (!ownsSkin(id)) {
      const s = SKINS[id];
      setSkinHint(
        `${s.label || id} is locked — tap again to buy for ${s.coinCost || "?"} coins.`
      );
      return false;
    }
    skinId = id;
    try {
      localStorage.setItem(SKIN_KEY, id);
    } catch {}
    setSkinHint(isCoinSkin(id) ? `${SKINS[id].label} equipped.` : "");
    updateSkinPicker();
    draw();
    return true;
  }

  function tryBuySkin(id) {
    if (ownsSkin(id)) {
      setSkin(id);
      return;
    }
    const s = SKINS[id];
    if (!s?.coinItem) return;
    if (typeof window.HubCoins === "undefined") {
      setSkinHint("Coins aren't loaded — open the hub Coin shop to buy this skin.");
      return;
    }
    const res = HubCoins.buy(s.coinItem);
    if (!res.ok) {
      setSkinHint(res.error || HubCoins.NEED_MORE || "You need more coins for this item!");
      return;
    }
    setSkinHint(`${s.label} unlocked!`);
    setSkin(id);
  }

  let best = Math.max(0, Math.floor(Number(localStorage.getItem(HIGH_SCORE_KEY)) || 0));
  let maxLevel = Math.max(0, Math.floor(Number(localStorage.getItem(LEVEL_KEY)) || 0));
  let levelIndex = Math.max(
    0,
    Math.min(
      LEVELS.length - 1,
      Math.floor(Number(localStorage.getItem(CURRENT_KEY)) || 0)
    )
  );
  // Don't start past what is unlocked (maxLevel = next unlocked index / cleared count).
  levelIndex = Math.min(levelIndex, Math.min(maxLevel, LEVELS.length - 1));
  let terrain = [];
  let lemmings = [];
  let particles = [];
  let skillsLeft = {};
  let selectedSkill = "blocker";
  let released = 0;
  let saved = 0;
  let dead = 0;
  let toRelease = 0;
  let need = 0;
  let spawnTimer = 0;
  let entrance = { x: 1, y: 1 };
  let exit = { x: COLS - 3, y: ROWS - 4 };
  let playing = false;
  let paused = false;
  let levelDone = false;
  let sessionScore = Math.max(0, Math.floor(Number(localStorage.getItem(SCORE_KEY)) || 0));
  let sessionStarted = false;
  let lastSubmitAt = 0;
  let lastTs = 0;

  function persistProgress() {
    try {
      localStorage.setItem(LEVEL_KEY, String(maxLevel));
      localStorage.setItem(CURRENT_KEY, String(levelIndex));
      localStorage.setItem(SCORE_KEY, String(sessionScore));
      if (best > 0) localStorage.setItem(HIGH_SCORE_KEY, String(best));
    } catch {}
  }

  function continueLevelIndex() {
    if (maxLevel >= LEVELS.length) return Math.min(levelIndex, LEVELS.length - 1);
    return Math.min(Math.max(levelIndex, 0), Math.min(maxLevel, LEVELS.length - 1));
  }

  function highestUnlocked() {
    return Math.min(Math.max(0, maxLevel), LEVELS.length - 1);
  }

  function isLevelUnlocked(i) {
    return i >= 0 && i <= highestUnlocked();
  }

  function renderLevelSelect() {
    if (!levelSelectEl) return;
    levelSelectEl.innerHTML = "";
    const label = document.createElement("p");
    label.className = "level-select-label";
    label.textContent = "Choose a level you’ve unlocked";
    levelSelectEl.appendChild(label);
    const grid = document.createElement("div");
    grid.className = "level-select-grid";
    LEVELS.forEach((lvl, i) => {
      const unlocked = isLevelUnlocked(i);
      const cleared = maxLevel > i || maxLevel >= LEVELS.length;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `level-pick${unlocked ? "" : " locked"}${i === levelIndex ? " current" : ""}`;
      btn.disabled = !unlocked;
      btn.innerHTML = `<span class="lp-num">${i + 1}</span><span class="lp-name">${
        unlocked ? lvl.name : "Locked"
      }</span>${cleared && unlocked ? '<span class="lp-done">✓</span>' : ""}`;
      if (unlocked) {
        btn.addEventListener("click", () => {
          window.HubSound?.play?.("click");
          startCampaign(i);
        });
      }
      grid.appendChild(btn);
    });
    levelSelectEl.appendChild(grid);
  }

  function openLevelSelect(pauseGame) {
    if (pauseGame && playing && !levelDone) paused = true;
    if (overlayTitle) overlayTitle.textContent = "Levels";
    if (overlayText) {
      overlayText.innerHTML =
        `<p style="margin:0;color:var(--muted);line-height:1.45;text-align:center">Tap any unlocked level to play it. Cleared levels stay open.</p>`;
    }
    renderLevelSelect();
    updateSkinPicker();
    if (startBtn) startBtn.textContent = playButtonLabel();
    overlay?.classList.remove("hidden");
  }

  function ensureSession() {
    if (sessionStarted) return;
    sessionStarted = true;
    window.HubPlays?.record?.("lemmings");
    window.HubStreak?.recordPlay?.();
  }

  function inBounds(tx, ty) {
    return tx >= 0 && ty >= 0 && tx < COLS && ty < ROWS;
  }

  function tile(tx, ty) {
    if (!inBounds(tx, ty)) return "=";
    return terrain[ty][tx];
  }

  function solidAt(tx, ty) {
    const c = tile(tx, ty);
    return c === "#" || c === "=";
  }

  function steelAt(tx, ty) {
    return tile(tx, ty) === "=";
  }

  function waterAt(tx, ty) {
    return tile(tx, ty) === "~";
  }

  function setTile(tx, ty, ch) {
    if (!inBounds(tx, ty)) return;
    if (terrain[ty][tx] === "=") return;
    terrain[ty][tx] = ch;
  }

  function loadLevel(idx) {
    levelIndex = Math.max(0, Math.min(LEVELS.length - 1, idx));
    const lvl = LEVELS[levelIndex];
    terrain = lvl.map.map((row) => row.split(""));
    entrance = { x: 2, y: 2 };
    exit = { x: COLS - 3, y: ROWS - 5 };
    for (let y = 0; y < ROWS; y += 1) {
      for (let x = 0; x < COLS; x += 1) {
        if (terrain[y][x] === "E") {
          entrance = { x, y };
          terrain[y][x] = ".";
        }
        if (terrain[y][x] === "X") {
          exit = { x, y };
          terrain[y][x] = ".";
        }
      }
    }
    lemmings = [];
    particles = [];
    skillsLeft = { ...lvl.skills };
    selectedSkill = SKILLS.find((s) => (skillsLeft[s.id] || 0) > 0)?.id || "blocker";
    released = 0;
    saved = 0;
    dead = 0;
    toRelease = lvl.release;
    need = lvl.need;
    spawnTimer = 0.35;
    levelDone = false;
    paused = false;
    persistProgress();
    renderSkills();
    updateHud();
    updateLevelTip();
  }

  function spawnLemming() {
    lemmings.push({
      x: entrance.x * TILE + 3,
      y: entrance.y * TILE,
      dir: 1,
      state: "fall",
      fallDist: 0,
      buildLeft: 0,
      bashLeft: 0,
      actionTimer: 0,
      turnCd: 0,
      climb: false,
      float: false,
      bombTimer: 0,
      frame: Math.random(),
      dead: false,
      saved: false
    });
    released += 1;
  }

  function centerX(lem) {
    return lem.x + LEM_W / 2;
  }

  function footY(lem) {
    return lem.y + LEM_H;
  }

  function onGround(lem) {
    const fx = Math.floor(centerX(lem) / TILE);
    const fy = Math.floor(footY(lem) / TILE);
    // Standing on the tile below the feet line
    return solidAt(fx, fy);
  }

  function snapToGround(lem) {
    const fx = Math.floor(centerX(lem) / TILE);
    let fy = Math.floor(footY(lem) / TILE);
    if (solidAt(fx, fy)) {
      lem.y = fy * TILE - LEM_H;
    }
  }

  function killLemming(lem, reason) {
    if (lem.dead || lem.saved) return;
    lem.dead = true;
    lem.state = reason || "dead";
    dead += 1;
    for (let i = 0; i < 7; i += 1) {
      particles.push({
        x: centerX(lem),
        y: lem.y + 6,
        vx: (Math.random() - 0.5) * 90,
        vy: -50 - Math.random() * 50,
        life: 0.35 + Math.random() * 0.25,
        color: reason === "bomb" ? "#fb7185" : "#86efac"
      });
    }
    window.HubSound?.play?.("error");
  }

  function saveLemming(lem) {
    if (lem.dead || lem.saved) return;
    lem.saved = true;
    lem.state = "saved";
    saved += 1;
    sessionScore += 100;
    saveBest();
    checkAchievements();
    window.HubSound?.play?.("merge");
  }

  function assignSkill(lem, skill) {
    if (!lem || lem.dead || lem.saved) return false;
    if (lem.state === "blocker") return false;
    const left = skillsLeft[skill] || 0;
    if (left <= 0) return false;

    if (skill === "floater") {
      if (lem.float) return false;
      lem.float = true;
      skillsLeft.floater -= 1;
      window.HubSound?.play?.("click");
      return true;
    }
    if (skill === "climber") {
      if (lem.climb) return false;
      lem.climb = true;
      skillsLeft.climber -= 1;
      window.HubSound?.play?.("click");
      return true;
    }
    if (skill === "bomber") {
      if (lem.bombTimer > 0) return false;
      lem.bombTimer = 1.25;
      // Freeze so they explode on the spot (against a wall / plug)
      if (lem.state === "walk" || lem.state === "builder" || lem.state === "basher" || lem.state === "digger") {
        lem.state = "walk";
        lem._bombFreeze = true;
      }
      skillsLeft.bomber -= 1;
      window.HubSound?.play?.("click");
      return true;
    }
    if (skill === "blocker") {
      if (lem.state !== "walk" || !onGround(lem)) return false;
      lem.state = "blocker";
      snapToGround(lem);
      skillsLeft.blocker -= 1;
      window.HubSound?.play?.("click");
      return true;
    }
    if (skill === "builder") {
      if (lem.state !== "walk") return false;
      lem.state = "builder";
      lem.buildLeft = 14;
      lem.actionTimer = 0;
      skillsLeft.builder -= 1;
      window.HubSound?.play?.("click");
      return true;
    }
    if (skill === "basher") {
      if (lem.state !== "walk") return false;
      lem.state = "basher";
      lem.bashLeft = 36;
      lem.actionTimer = 0;
      skillsLeft.basher -= 1;
      window.HubSound?.play?.("click");
      return true;
    }
    if (skill === "digger") {
      if (lem.state !== "walk") return false;
      lem.state = "digger";
      lem.actionTimer = 0;
      skillsLeft.digger -= 1;
      window.HubSound?.play?.("click");
      return true;
    }
    return false;
  }

  function explode(lem) {
    const tx = Math.floor(centerX(lem) / TILE);
    const ty = Math.floor((lem.y + 7) / TILE);
    for (let dy = -2; dy <= 2; dy += 1) {
      for (let dx = -2; dx <= 2; dx += 1) {
        if (Math.abs(dx) + Math.abs(dy) > 3) continue;
        if (!steelAt(tx + dx, ty + dy)) setTile(tx + dx, ty + dy, ".");
      }
    }
    killLemming(lem, "bomb");
  }

  function nearExit(lem) {
    const ex = exit.x * TILE + TILE / 2;
    const ey = exit.y * TILE + TILE / 2;
    return Math.abs(centerX(lem) - ex) < 22 && Math.abs(lem.y + 7 - ey) < 28;
  }

  /** Bounce off a blocker face once and push clear so they don't jitter. */
  function turnFromBlocker(lem) {
    const cx = centerX(lem);
    const nose = cx + lem.dir * 6;
    const half = 9;
    for (const other of lemmings) {
      if (other === lem || other.dead || other.saved || other.state !== "blocker") continue;
      if (Math.abs(other.y - lem.y) > 16) continue;
      const bx = centerX(other);
      const left = bx - half;
      const right = bx + half;
      if (lem.dir > 0 && nose >= left && cx <= bx) {
        lem.dir = -1;
        lem.x = left - LEM_W / 2 - 1;
        lem.turnCd = 0.18;
        return true;
      }
      if (lem.dir < 0 && nose <= right && cx >= bx) {
        lem.dir = 1;
        lem.x = right - LEM_W / 2 + 1;
        lem.turnCd = 0.18;
        return true;
      }
    }
    return false;
  }

  function updateLemming(lem, dt) {
    if (lem.dead || lem.saved) return;
    lem.frame += dt;

    if (lem.bombTimer > 0) {
      lem.bombTimer -= dt;
      if (lem.bombTimer <= 0) {
        explode(lem);
        return;
      }
    }

    if (nearExit(lem) && lem.state !== "fall" && lem.state !== "blocker") {
      saveLemming(lem);
      return;
    }

    if (lem.state === "blocker") {
      if (!onGround(lem)) {
        lem.state = "fall";
        lem.fallDist = 0;
      }
      return;
    }

    if (lem.turnCd > 0) lem.turnCd -= dt;

    if (lem.state === "builder") {
      lem.actionTimer += dt;
      if (lem.actionTimer >= 0.2) {
        lem.actionTimer = 0;
        // Same height as the floor under their feet — a walkable bridge, not a wall
        const step = TILE;
        const tx = Math.floor((centerX(lem) + lem.dir * (step * 0.75)) / TILE);
        const ty = Math.floor(footY(lem) / TILE);
        if (!solidAt(tx, ty)) setTile(tx, ty, "#");
        lem.x += lem.dir * step;
        snapToGround(lem);
        if (!onGround(lem)) {
          // Keep them on the brick we just laid
          lem.y = ty * TILE - LEM_H;
        }
        lem.buildLeft -= 1;
        const face = Math.floor((centerX(lem) + lem.dir * 6) / TILE);
        const mid = Math.floor((lem.y + 8) / TILE);
        if (lem.buildLeft <= 0 || solidAt(face, mid) || solidAt(face, ty)) lem.state = "walk";
      }
      return;
    }

    if (lem.state === "basher") {
      lem.actionTimer += dt;
      if (lem.actionTimer >= 0.14) {
        lem.actionTimer = 0;
        const tx = Math.floor((centerX(lem) + lem.dir * 10) / TILE);
        const body = Math.floor((lem.y + 8) / TILE);
        const top = body - 1;
        if (steelAt(tx, body) || steelAt(tx, top)) {
          lem.state = "walk";
        } else if (!solidAt(tx, body) && !solidAt(tx, top)) {
          // Keep walking forward so Bash assigned before the wall still reaches it
          lem.x += lem.dir * 6;
          lem.bashLeft -= 1;
          if (lem.bashLeft <= 0 || !onGround(lem)) {
            lem.state = onGround(lem) ? "walk" : "fall";
            if (lem.state === "fall") lem.fallDist = 0;
          }
        } else {
          if (!steelAt(tx, body)) setTile(tx, body, ".");
          if (!steelAt(tx, top)) setTile(tx, top, ".");
          lem.x += lem.dir * 6;
          lem.bashLeft -= 1;
          if (lem.bashLeft <= 0) lem.state = "walk";
        }
      }
      return;
    }

    if (lem.state === "digger") {
      lem.actionTimer += dt;
      if (lem.actionTimer >= 0.16) {
        lem.actionTimer = 0;
        const tx = Math.floor(centerX(lem) / TILE);
        let ty = Math.floor(footY(lem) / TILE);
        // After the last dig we sit in empty air — dig the solid under the hole
        if (!solidAt(tx, ty) && solidAt(tx, ty + 1)) ty += 1;
        if (steelAt(tx, ty) || !solidAt(tx, ty)) {
          lem.state = "fall";
          lem.fallDist = 0;
        } else {
          // Dig under feet (and one neighbor) for a passable shaft
          for (const dx of [0, lem.dir]) {
            if (!steelAt(tx + dx, ty) && solidAt(tx + dx, ty)) setTile(tx + dx, ty, ".");
          }
          // Snap feet onto the next tile so dig continues instead of a 1-deep pit
          lem.y = (ty + 1) * TILE - LEM_H;
        }
      }
      return;
    }

    if (lem.state === "climb") {
      const face = Math.floor((centerX(lem) + lem.dir * (LEM_W / 2 + 3)) / TILE);
      const headTy = Math.floor((lem.y + 2) / TILE);
      const bodyTy = Math.floor((lem.y + 9) / TILE);

      if (solidAt(face, bodyTy)) {
        // Clear air at/above the head means we reached the lip — hoist over
        if (!solidAt(face, headTy) && !solidAt(face, headTy - 1)) {
          lem.y -= 100 * dt;
          lem.x += lem.dir * 70 * dt;
          if (onGround(lem) || !solidAt(face, Math.floor((lem.y + 8) / TILE))) {
            lem.x += lem.dir * 12;
            if (onGround(lem)) snapToGround(lem);
            lem.state = "walk";
          }
        } else {
          // Wall still above — keep climbing
          lem.y -= 75 * dt;
          if (lem.dir > 0) lem.x = face * TILE - LEM_W - 1;
          else lem.x = face * TILE + TILE + 1;
        }
      } else {
        // No wall against the body — step forward onto the top or fall
        lem.x += lem.dir * 12;
        if (onGround(lem)) {
          snapToGround(lem);
          lem.state = "walk";
        } else {
          lem.state = "fall";
          lem.fallDist = 0;
        }
      }
      if (lem.y < -24) {
        lem.y = -24;
        lem.dir *= -1;
        lem.state = "fall";
        lem.fallDist = 0;
      }
      return;
    }

    // Fall / walk
    if (!onGround(lem)) {
      if (lem.state !== "fall") {
        lem.state = "fall";
        lem.fallDist = 0;
      }
      const speed = lem.float ? 42 : 120;
      lem.y += speed * dt;
      lem.fallDist += speed * dt;
      if (onGround(lem)) {
        snapToGround(lem);
        if (!lem.float && lem.fallDist > MAX_FALL) {
          killLemming(lem, "splat");
          return;
        }
        lem.state = "walk";
        lem.fallDist = 0;
      }
      const fx = Math.floor(centerX(lem) / TILE);
      const fy = Math.floor(footY(lem) / TILE);
      if (waterAt(fx, fy) || lem.y > H + 30) killLemming(lem, "drown");
      return;
    }

    // Walk
    if (lem._bombFreeze && lem.bombTimer > 0) {
      snapToGround(lem);
      return;
    }
    lem.state = "walk";
    lem.x += lem.dir * 36 * dt;

    // Blocker faces first; short turnCd stops left/right jitter
    const hitBlock = !(lem.turnCd > 0) && turnFromBlocker(lem);
    if (!hitBlock) {
      const nose = Math.floor((centerX(lem) + lem.dir * 6) / TILE);
      const mid = Math.floor((lem.y + 8) / TILE);
      const head = Math.floor((lem.y + 3) / TILE);
      if (solidAt(nose, mid) || solidAt(nose, head)) {
        if (lem.climb) {
          lem.state = "climb";
          // Hug the wall so climb raycasts stay on the face
          if (lem.dir > 0) lem.x = nose * TILE - LEM_W - 1;
          else lem.x = nose * TILE + TILE + 1;
        } else {
          lem.dir *= -1;
          lem.x += lem.dir * 3;
          lem.turnCd = 0.12;
        }
      }
    }

    // Keep inside map horizontally
    if (lem.x < 2) {
      lem.x = 2;
      lem.dir = 1;
    }
    if (lem.x > W - LEM_W - 2) {
      lem.x = W - LEM_W - 2;
      lem.dir = -1;
    }

    const fx = Math.floor(centerX(lem) / TILE);
    const fy = Math.floor(footY(lem) / TILE);
    if (waterAt(fx, fy)) killLemming(lem, "drown");
  }

  function updateParticles(dt) {
    particles = particles.filter((p) => {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 180 * dt;
      return p.life > 0;
    });
  }

  function checkLevelEnd() {
    if (levelDone) return;
    const spawning = released < toRelease;
    const leftover = lemmings.filter((l) => !l.dead && !l.saved);
    const movers = leftover.filter((l) => l.state !== "blocker");

    // Quota met — don't strand the player on leftover blockers
    if (saved >= need && !spawning && movers.length === 0) {
      winLevel();
      return;
    }

    // Nobody left who can still reach OUT
    if (!spawning && leftover.length === 0) {
      if (saved >= need) winLevel();
      else failLevel();
      return;
    }

    if (!spawning && movers.length === 0 && leftover.length > 0 && saved < need) {
      failLevel();
    }
  }

  function winLevel() {
    levelDone = true;
    playing = false;
    sessionScore += 250 + saved * 25;
    saveBest();
    maxLevel = Math.max(maxLevel, levelIndex + 1);
    const next = levelIndex + 1;
    if (next < LEVELS.length) levelIndex = next;
    persistProgress();
    checkAchievements();
    window.HubConfetti?.burst?.();
    window.HubSound?.play?.("merge");
    if (overlayTitle) overlayTitle.textContent = "Level clear!";
    if (overlayText) {
      overlayText.textContent =
        next < LEVELS.length
          ? `Saved ${saved}/${toRelease}. Score ${sessionScore}. Progress saved — next: ${LEVELS[next].name}`
          : `All levels cleared! Final score ${sessionScore}. Progress saved.`;
    }
    if (startBtn) startBtn.textContent = next < LEVELS.length ? "Next level" : "Play again";
    renderLevelSelect();
    overlay?.classList.remove("hidden");
  }

  function failLevel() {
    levelDone = true;
    playing = false;
    persistProgress();
    saveBest();
    if (overlayTitle) overlayTitle.textContent = "Oh no";
    if (overlayText) overlayText.textContent = `Saved ${saved}/${need} needed. Score ${sessionScore}. Progress kept — retry this level.`;
    if (startBtn) startBtn.textContent = "Retry";
    renderLevelSelect();
    overlay?.classList.remove("hidden");
    window.HubSound?.play?.("error");
  }

  function saveBest() {
    if (sessionScore > best) {
      best = sessionScore;
    }
    persistProgress();
    updateHud();
    if (best > 0) maybeSubmit(true);
  }

  function updateLevelTip() {
    const lvl = LEVELS[levelIndex];
    if (levelTipEl) levelTipEl.textContent = lvl.tip || `Get ${need} walkers to the green OUT door.`;
    if (hintEl) {
      const active = SKILLS.find((s) => s.id === selectedSkill);
      const hasSkills = SKILLS.some((s) => (skillsLeft[s.id] || 0) > 0);
      hintEl.textContent = hasSkills
        ? active
          ? `${active.ico} ${active.name}: ${active.tip}. Then tap a walker.`
          : "Tap a skill, then tap a green walker."
        : "No skills this level — just let them walk to OUT.";
    }
  }

  function showHowTo(title) {
    if (overlayTitle) overlayTitle.textContent = title || "How to play";
    if (overlayText) overlayText.innerHTML = HOW_TO_HTML;
    renderLevelSelect();
    updateSkinPicker();
    if (startBtn) startBtn.textContent = playButtonLabel();
    overlay?.classList.remove("hidden");
  }

  function updateHud() {
    const lvl = LEVELS[levelIndex];
    if (levelTitleEl) levelTitleEl.textContent = `Level ${levelIndex + 1}: ${lvl.name}`;
    if (goalLabelEl) goalLabelEl.textContent = `Need ${need} saved (${toRelease} come out)`;
    if (outCountEl) outCountEl.textContent = String(Math.max(0, released - saved - dead));
    if (savedCountEl) savedCountEl.textContent = String(saved);
    if (bestScoreEl) bestScoreEl.textContent = String(best);
    if (overlayBest) overlayBest.textContent = String(best);
  }

  function playButtonLabel() {
    if (paused && playing && !levelDone) return "Resume";
    if (maxLevel > 0 || levelIndex > 0 || sessionScore > 0) {
      return `Continue L${continueLevelIndex() + 1}`;
    }
    return "Play";
  }

  function startCampaign(fromLevel, opts) {
    ensureSession();
    const resetScore = opts && opts.resetScore;
    if (resetScore) sessionScore = 0;
    loadLevel(fromLevel);
    playing = true;
    paused = false;
    persistProgress();
    overlay?.classList.add("hidden");
  }

  function restartLevel() {
    ensureSession();
    loadLevel(levelIndex);
    playing = true;
    paused = false;
    levelDone = false;
    persistProgress();
    overlay?.classList.add("hidden");
    window.HubSound?.play?.("click");
  }

  function showMenu(pause) {
    if (pause && playing && !levelDone) paused = true;
    if (overlayTitle) overlayTitle.textContent = paused ? "Paused" : "Dudes";
    if (overlayText) {
      if (paused) {
        overlayText.innerHTML =
          `<p style="margin:0 0 0.6rem;color:var(--muted);line-height:1.45">Paused. Resume to keep playing this level, or pick another unlocked level below.</p>${HOW_TO_HTML}`;
      } else {
        const cleared = Math.min(maxLevel, LEVELS.length);
        overlayText.innerHTML =
          `${HOW_TO_HTML}<p style="margin:0.75rem 0 0;color:var(--muted);font-size:0.88rem;text-align:center">Progress: unlocked through level ${highestUnlocked() + 1} · cleared ${cleared}/${LEVELS.length}</p>`;
      }
    }
    renderLevelSelect();
    updateSkinPicker();
    if (startBtn) startBtn.textContent = playButtonLabel();
    overlay?.classList.remove("hidden");
  }

  function maybeSubmit(force) {
    if (best <= 0 || !window.HubLeaderboard) return;
    const now = Date.now();
    if (!force && now - lastSubmitAt < 6000) return;
    lastSubmitAt = now;
    HubLeaderboard.submit("lemmings", best).catch?.(() => {});
  }

  function checkAchievements() {
    if (!window.HubAchievements) return;
    if (saved >= 1) HubAchievements.unlock("lemmings_save_1");
    if (maxLevel >= 1) HubAchievements.unlock("lemmings_level_1");
    if (maxLevel >= 3) HubAchievements.unlock("lemmings_level_3");
    if (maxLevel >= LEVELS.length) HubAchievements.unlock("lemmings_all_levels");
    if (best >= 2000) HubAchievements.unlock("lemmings_score_2000");
  }

  function renderSkills() {
    if (!skillsEl) return;
    skillsEl.innerHTML = "";
    SKILLS.forEach((s) => {
      const n = skillsLeft[s.id] || 0;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `skill-btn${selectedSkill === s.id ? " selected" : ""}`;
      btn.disabled = n <= 0;
      btn.dataset.skill = s.id;
      btn.title = s.tip;
      btn.innerHTML = `<span class="skill-ico">${s.ico}</span><span class="skill-name">${s.name}</span><span class="skill-count">${n}</span>`;
      skillsEl.appendChild(btn);
    });
  }

  function resolveDudeColors(sk, lem) {
    let body = sk.body;
    let hat = sk.hat;
    let face = sk.face;
    if (sk.special === "rainbow") {
      const hue = (performance.now() / 18 + (lem.frame || 0) * 40) % 360;
      body = `hsl(${hue}, 78%, 52%)`;
      hat = `hsl(${(hue + 40) % 360}, 70%, 32%)`;
      face = "#fff7ed";
    }
    if (lem.state === "blocker" && sk.special !== "ghost") {
      body = sk.stopSign ? body : "#f97316";
    }
    return { body, hat, face };
  }

  function drawHat(sk, hatColor, lem) {
    const style = sk.hatStyle || "flat";
    if (style === "none") return;
    ctx.fillStyle = hatColor;
    if (style === "beanie") {
      ctx.beginPath();
      ctx.ellipse(0, -9, 6, 4.5, 0, Math.PI, 0);
      ctx.fill();
      ctx.fillRect(-5.5, -9, 11, 3);
      return;
    }
    if (style === "hardhat") {
      ctx.fillRect(-6, -9, 12, 4);
      ctx.fillRect(-4, -11, 8, 3);
      return;
    }
    if (style === "crown") {
      ctx.beginPath();
      ctx.moveTo(-5, -6);
      ctx.lineTo(-5, -11);
      ctx.lineTo(-2, -8);
      ctx.lineTo(0, -12);
      ctx.lineTo(2, -8);
      ctx.lineTo(5, -11);
      ctx.lineTo(5, -6);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#fef08a";
      ctx.fillRect(-1, -10, 2, 2);
      return;
    }
    if (style === "propeller") {
      ctx.fillRect(-5, -9, 10, 4);
      const a = (lem.frame || 0) * 14;
      ctx.strokeStyle = "#e2e8f0";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * 6, -12 + Math.sin(a) * 2);
      ctx.lineTo(Math.cos(a + Math.PI) * 6, -12 + Math.sin(a + Math.PI) * 2);
      ctx.stroke();
      ctx.fillStyle = "#94a3b8";
      ctx.fillRect(-1, -13, 2, 4);
      return;
    }
    if (style === "bandana") {
      ctx.fillRect(-5, -9, 10, 4);
      ctx.fillStyle = "#fef2f2";
      ctx.fillRect(-2, -9, 3, 4);
      ctx.fillStyle = hatColor;
      ctx.beginPath();
      ctx.moveTo(5, -7);
      ctx.lineTo(9, -4);
      ctx.lineTo(5, -5);
      ctx.fill();
      return;
    }
    if (style === "pom") {
      ctx.fillRect(-5, -9, 10, 4);
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(0, -12, 2.4, 0, Math.PI * 2);
      ctx.fill();
      return;
    }
    if (style === "ears") {
      ctx.fillRect(-5, -9, 10, 4);
      ctx.beginPath();
      ctx.moveTo(-5, -9);
      ctx.lineTo(-7, -14);
      ctx.lineTo(-2, -9);
      ctx.moveTo(5, -9);
      ctx.lineTo(7, -14);
      ctx.lineTo(2, -9);
      ctx.fill();
      return;
    }
    if (style === "beak") {
      ctx.fillRect(-5, -9, 10, 4);
      ctx.fillStyle = "#ea580c";
      ctx.beginPath();
      ctx.moveTo(2, -4);
      ctx.lineTo(8, -2);
      ctx.lineTo(2, 0);
      ctx.closePath();
      ctx.fill();
      return;
    }
    // flat
    ctx.fillRect(-5, -9, 10, 4);
  }

  function drawDude(lem) {
    const sk = skin();
    const bob = Math.sin(lem.frame * 12) * 1.1;
    const cols = resolveDudeColors(sk, lem);
    ctx.save();
    ctx.translate(centerX(lem), lem.y + 8 + bob);
    if (lem.dir < 0) ctx.scale(-1, 1);

    if (sk.special === "ghost") {
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = cols.body;
      ctx.beginPath();
      ctx.ellipse(0, -1, 6, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#0f172a";
      ctx.fillRect(-3, -4, 2, 2);
      ctx.fillRect(1, -4, 2, 2);
    } else if (sk.special === "robot") {
      ctx.fillStyle = cols.body;
      ctx.fillRect(-5, -6, 10, 12);
      ctx.fillStyle = cols.hat;
      ctx.fillRect(-5, -9, 10, 4);
      ctx.fillStyle = cols.face;
      ctx.fillRect(0, -5, 5, 4);
      ctx.fillStyle = "#0ea5e9";
      ctx.fillRect(1, -4, 2, 2);
    } else {
      ctx.fillStyle = cols.body;
      ctx.fillRect(-5, -6, 10, 12);
      if (sk.vest) {
        ctx.fillStyle = sk.vest;
        ctx.fillRect(-4, -2, 8, 5);
      }
      drawHat(sk, cols.hat, lem);
      ctx.fillStyle = cols.face;
      ctx.fillRect(0, -5, 5, 5);
      if (sk.whiskers) {
        ctx.strokeStyle = "rgba(255,255,255,0.75)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(1, -2);
        ctx.lineTo(7, -3);
        ctx.moveTo(1, -1);
        ctx.lineTo(7, 0);
        ctx.stroke();
      }
    }

    if (sk.stopSign || lem.state === "blocker") {
      ctx.fillStyle = "#ef4444";
      ctx.fillRect(-3, -1, 6, 6);
      ctx.fillStyle = "#fff";
      ctx.fillRect(-2, 1, 4, 2);
    }

    if (sk.fuse || lem.bombTimer > 0) {
      ctx.fillStyle = "#fbbf24";
      ctx.fillRect(-1, -13, 2, 4);
      ctx.fillStyle = "#fb7185";
      ctx.beginPath();
      ctx.arc(0, -14, 1.8 + (Math.sin(lem.frame * 20) + 1) * 0.4, 0, Math.PI * 2);
      ctx.fill();
    }

    if (lem.float) {
      if (sk.floatStriped) {
        ctx.fillStyle = "#f8fafc";
        ctx.beginPath();
        ctx.arc(0, -14, 7, Math.PI, 0);
        ctx.fill();
        ctx.fillStyle = "#ef4444";
        ctx.fillRect(-6, -14, 3, 4);
        ctx.fillStyle = "#3b82f6";
        ctx.fillRect(-1, -14, 3, 4);
        ctx.fillStyle = "#f8fafc";
        ctx.fillRect(4, -14, 2, 4);
        ctx.strokeStyle = "#94a3b8";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, -10);
        ctx.lineTo(0, -6);
        ctx.stroke();
      } else {
        ctx.fillStyle = "#e2e8f0";
        ctx.beginPath();
        ctx.arc(0, -14, 7, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    if (sk.pack || lem.climb) {
      ctx.fillStyle = "#38bdf8";
      ctx.fillRect(-7, 0, 3, 6);
      ctx.strokeStyle = "#7dd3fc";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(-6, 0);
      ctx.lineTo(-6, -5);
      ctx.stroke();
    }

    if (lem.bombTimer > 0) {
      ctx.fillStyle = "#fb7185";
      ctx.font = "bold 11px Outfit,sans-serif";
      ctx.fillText(String(Math.ceil(lem.bombTimer)), -3, -16);
    }

    ctx.restore();
  }

  function draw() {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#7eb6e8");
    g.addColorStop(1, "#c5e3f6");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    for (let y = 0; y < ROWS; y += 1) {
      for (let x = 0; x < COLS; x += 1) {
        const c = terrain[y][x];
        if (c === "." ) continue;
        if (c === "~") {
          ctx.fillStyle = "#1d4ed8";
          ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
          ctx.fillStyle = "rgba(125,211,252,0.4)";
          ctx.fillRect(x * TILE, y * TILE, TILE, 3);
        } else if (c === "=") {
          ctx.fillStyle = "#64748b";
          ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
          ctx.fillStyle = "#94a3b8";
          ctx.fillRect(x * TILE + 2, y * TILE + 2, TILE - 4, 3);
        } else if (c === "#") {
          ctx.fillStyle = y > ROWS * 0.55 ? "#3f7d3a" : "#5aa34a";
          ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
          ctx.fillStyle = "rgba(0,0,0,0.15)";
          ctx.fillRect(x * TILE, y * TILE + TILE - 3, TILE, 3);
        }
      }
    }

    // Entrance hatch (yellow) — walkers drop from here
    const ix = entrance.x * TILE;
    const iy = entrance.y * TILE;
    ctx.fillStyle = "#92400e";
    ctx.fillRect(ix - 4, iy - 8, 24, 6);
    ctx.fillStyle = "#f59e0b";
    ctx.fillRect(ix - 2, iy - 4, 20, 16);
    ctx.fillStyle = "#1c1917";
    ctx.fillRect(ix + 3, iy - 1, 10, 10);
    ctx.fillStyle = "#fde68a";
    ctx.font = "bold 11px Outfit,sans-serif";
    ctx.fillText("IN", ix + 2, iy - 12);

    // Exit door (bright green arch) — goal
    const ox = exit.x * TILE;
    const oy = exit.y * TILE;
    ctx.fillStyle = "#14532d";
    ctx.fillRect(ox - 4, oy - 10, 24, 26);
    ctx.fillStyle = "#4ade80";
    ctx.fillRect(ox, oy - 6, 16, 20);
    ctx.fillStyle = "#052e16";
    ctx.fillRect(ox + 4, oy + 2, 8, 12);
    ctx.fillStyle = "#bbf7d0";
    ctx.font = "bold 11px Outfit,sans-serif";
    ctx.fillText("OUT", ox - 4, oy - 14);

    lemmings.forEach((lem) => {
      if (lem.dead || lem.saved) return;
      drawDude(lem);
    });

    particles.forEach((p) => {
      ctx.globalAlpha = Math.max(0, p.life * 2);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x, p.y, 3, 3);
      ctx.globalAlpha = 1;
    });
  }

  function tick(ts) {
    requestAnimationFrame(tick);
    if (!lastTs) lastTs = ts;
    let dt = (ts - lastTs) / 1000;
    lastTs = ts;
    if (dt > 0.05) dt = 0.05;

    if (playing && !paused && !levelDone) {
      const lvl = LEVELS[levelIndex];
      if (released < toRelease) {
        spawnTimer -= dt;
        if (spawnTimer <= 0) {
          spawnLemming();
          spawnTimer = Math.max(0.4, SPAWN_GAP * (lvl.rate || 1));
        }
      }
      lemmings.forEach((lem) => updateLemming(lem, dt));
      updateParticles(dt);
      updateHud();
      checkLevelEnd();
    }
    draw();
  }

  function canvasPos(e) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) * W) / rect.width,
      y: ((e.clientY - rect.top) * H) / rect.height
    };
  }

  function pickLemming(x, y) {
    let bestLem = null;
    let bestD = 24;
    lemmings.forEach((lem) => {
      if (lem.dead || lem.saved) return;
      const d = Math.hypot(centerX(lem) - x, lem.y + 7 - y);
      if (d < bestD) {
        bestD = d;
        bestLem = lem;
      }
    });
    return bestLem;
  }

  skillsEl?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-skill]");
    if (!btn || btn.disabled) return;
    selectedSkill = btn.dataset.skill;
    renderSkills();
    updateLevelTip();
  });

  canvas.addEventListener("pointerdown", (e) => {
    if (!playing || paused || levelDone) return;
    const { x, y } = canvasPos(e);
    const lem = pickLemming(x, y);
    if (!lem) return;
    if (assignSkill(lem, selectedSkill)) renderSkills();
  });

  startBtn?.addEventListener("click", () => {
    if (paused && playing && !levelDone) {
      paused = false;
      overlay?.classList.add("hidden");
      return;
    }
    if (levelDone && saved >= need) {
      // levelIndex already advanced on win when possible
      if (maxLevel >= LEVELS.length && levelIndex >= LEVELS.length - 1 && saved >= need) {
        // Finished all — start over from 1 but keep best; reset run score
        startCampaign(0, { resetScore: true });
        return;
      }
      startCampaign(continueLevelIndex());
      return;
    }
    if (levelDone) {
      restartLevel();
      return;
    }
    startCampaign(continueLevelIndex());
  });

  function onRestartClick() {
    restartLevel();
  }

  restartBtn?.addEventListener("click", onRestartClick);
  restartMenuBtn?.addEventListener("click", onRestartClick);

  window.addEventListener("keydown", (e) => {
    if (e.key === "r" || e.key === "R") {
      if (e.target && /input|textarea/i.test(e.target.tagName)) return;
      e.preventDefault();
      restartLevel();
    }
  });

  helpBtn?.addEventListener("click", () => {
    if (playing && !levelDone) paused = true;
    showHowTo("How to play");
  });

  levelsBtn?.addEventListener("click", () => openLevelSelect(true));
  levelsMenuBtn?.addEventListener("click", () => openLevelSelect(true));

  menuBtn?.addEventListener("click", () => showMenu(true));
  gamesBtn?.addEventListener("click", () => {
    window.location.href = "../index.html#games";
  });

  skinPicker?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-skin]");
    if (!btn) return;
    const id = btn.dataset.skin;
    if (!SKINS[id]) return;
    if (ownsSkin(id)) setSkin(id);
    else tryBuySkin(id);
  });

  loadLevel(continueLevelIndex());
  if (startBtn) startBtn.textContent = playButtonLabel();
  renderLevelSelect();
  updateSkinPicker();
  updateLevelTip();
  draw();
  requestAnimationFrame(tick);
  maybeSubmit(false);
  window.addEventListener("beforeunload", () => {
    persistProgress();
    maybeSubmit(true);
  });
  document.addEventListener("hub-username-ready", () => {
    if (isCoinSkin(skinId) && !ownsSkin(skinId)) skinId = "classic";
    updateSkinPicker();
  });
  window.HubLifecycle?.onHiddenPause?.(() => {
    if (playing && !paused && !levelDone) showMenu(true);
  });
})();
