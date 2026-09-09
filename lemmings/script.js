(function () {
  const HIGH_SCORE_KEY = "lemmings-high-score";
  const LEVEL_KEY = "lemmings-max-level-v1";
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
    { id: "blocker", name: "Block", ico: "🛑" },
    { id: "builder", name: "Build", ico: "🪜" },
    { id: "basher", name: "Bash", ico: "🥊" },
    { id: "digger", name: "Dig", ico: "⛏️" },
    { id: "floater", name: "Float", ico: "🪂" },
    { id: "bomber", name: "Bomb", ico: "💥" },
    { id: "climber", name: "Climb", ico: "🧗" }
  ];

  // Keep every row exactly COLS chars. # dirt  = steel  . air  ~ water  E in  X out
  const LEVELS = [
    {
      name: "Just Walk",
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
      release: 12,
      need: 7,
      rate: 0.95,
      skills: { blocker: 2, builder: 8, basher: 0, digger: 0, floater: 0, bomber: 0, climber: 0 },
      map: [
        "........................................",
        "........................................",
        "........................................",
        "....E.................................X.",
        "........................................",
        "##############............##############",
        "##############............##############",
        "........................................",
        "........................................",
        "........................................",
        "........................................",
        "........................................",
        "........................................",
        "........................................",
        "~~~~~~~~~~~~~~~~~~~~~~~~~~~~............",
        "~~~~~~~~~~~~~~~~~~~~~~~~~~~~............",
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
      release: 14,
      need: 9,
      rate: 0.9,
      skills: { blocker: 2, builder: 0, basher: 0, digger: 8, floater: 0, bomber: 1, climber: 0 },
      map: [
        "........................................",
        ".........E..............................",
        "........................................",
        "########################################",
        "########################################",
        "########################################",
        "########################################",
        "########################################",
        "########################################",
        "########################################",
        "################......##################",
        "################......##################",
        "################......##################",
        "################......X#################",
        "################......##################",
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
      name: "Floaters",
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
        "########################################"
      ]
    },
    {
      name: "Climb Up",
      release: 12,
      need: 7,
      rate: 0.9,
      skills: { blocker: 1, builder: 2, basher: 0, digger: 0, floater: 2, bomber: 0, climber: 10 },
      map: [
        "........................................",
        "........................................",
        ".....................................X..",
        "........................................",
        "##########################==============",
        "##########################==============",
        "........................##..............",
        "........................##..............",
        "........................##..............",
        "........................##..............",
        "........................##..............",
        "....E...................##..............",
        "........................##..............",
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

  canvas.width = W;
  canvas.height = H;

  let best = Math.max(0, Math.floor(Number(localStorage.getItem(HIGH_SCORE_KEY)) || 0));
  let maxLevel = Math.max(0, Math.floor(Number(localStorage.getItem(LEVEL_KEY)) || 0));
  let levelIndex = 0;
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
  let sessionScore = 0;
  let sessionStarted = false;
  let lastSubmitAt = 0;
  let lastTs = 0;

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
    renderSkills();
    updateHud();
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
      lem.bombTimer = 2.0;
      skillsLeft.bomber -= 1;
      window.HubSound?.play?.("click");
      return true;
    }
    if (skill === "blocker") {
      if (lem.state !== "walk") return false;
      lem.state = "blocker";
      skillsLeft.blocker -= 1;
      window.HubSound?.play?.("click");
      return true;
    }
    if (skill === "builder") {
      if (lem.state !== "walk") return false;
      lem.state = "builder";
      lem.buildLeft = 12;
      lem.actionTimer = 0;
      skillsLeft.builder -= 1;
      window.HubSound?.play?.("click");
      return true;
    }
    if (skill === "basher") {
      if (lem.state !== "walk") return false;
      lem.state = "basher";
      lem.bashLeft = 20;
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
    for (let dy = -1; dy <= 1; dy += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        if (!steelAt(tx + dx, ty + dy)) setTile(tx + dx, ty + dy, ".");
      }
    }
    killLemming(lem, "bomb");
  }

  function nearExit(lem) {
    const ex = exit.x * TILE + TILE / 2;
    const ey = exit.y * TILE + TILE / 2;
    return Math.abs(centerX(lem) - ex) < 18 && Math.abs(lem.y + 7 - ey) < 20;
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

    if (nearExit(lem) && lem.state !== "fall" && lem.state !== "climb") {
      saveLemming(lem);
      return;
    }

    if (lem.state === "blocker") return;

    if (lem.state === "builder") {
      lem.actionTimer += dt;
      if (lem.actionTimer >= 0.26) {
        lem.actionTimer = 0;
        const tx = Math.floor((centerX(lem) + lem.dir * 12) / TILE);
        const ty = Math.floor(footY(lem) / TILE) - 1;
        if (!solidAt(tx, ty)) setTile(tx, ty, "#");
        lem.x += lem.dir * 5;
        lem.y -= 5;
        lem.buildLeft -= 1;
        const face = Math.floor((centerX(lem) + lem.dir * 8) / TILE);
        const head = Math.floor((lem.y + 4) / TILE);
        if (lem.buildLeft <= 0 || solidAt(face, head)) lem.state = "walk";
      }
      return;
    }

    if (lem.state === "basher") {
      lem.actionTimer += dt;
      if (lem.actionTimer >= 0.16) {
        lem.actionTimer = 0;
        const tx = Math.floor((centerX(lem) + lem.dir * 10) / TILE);
        const ty = Math.floor((lem.y + 8) / TILE);
        if (steelAt(tx, ty) || (!solidAt(tx, ty) && !solidAt(tx, ty - 1))) {
          lem.state = "walk";
        } else {
          if (!steelAt(tx, ty)) setTile(tx, ty, ".");
          if (!steelAt(tx, ty - 1)) setTile(tx, ty - 1, ".");
          lem.x += lem.dir * 4;
          lem.bashLeft -= 1;
          if (lem.bashLeft <= 0) lem.state = "walk";
        }
      }
      return;
    }

    if (lem.state === "digger") {
      lem.actionTimer += dt;
      if (lem.actionTimer >= 0.2) {
        lem.actionTimer = 0;
        const tx = Math.floor(centerX(lem) / TILE);
        const ty = Math.floor(footY(lem) / TILE);
        if (steelAt(tx, ty) || !solidAt(tx, ty)) {
          lem.state = "fall";
          lem.fallDist = 0;
        } else {
          setTile(tx, ty, ".");
          lem.y += 4;
        }
      }
      return;
    }

    if (lem.state === "climb") {
      const face = Math.floor((centerX(lem) + lem.dir * 7) / TILE);
      const head = Math.floor((lem.y + 2) / TILE);
      if (solidAt(face, head)) {
        // top of wall?
        if (!solidAt(face, head - 1)) {
          lem.y -= 50 * dt;
          if (!solidAt(face, Math.floor((lem.y + 6) / TILE))) {
            lem.x += lem.dir * 10;
            lem.state = "walk";
          }
        } else {
          lem.dir *= -1;
          lem.state = "fall";
          lem.fallDist = 0;
        }
      } else {
        lem.state = "walk";
        lem.x += lem.dir * 4;
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
    lem.state = "walk";
    lem.x += lem.dir * 36 * dt;

    // Turn for blockers
    for (const other of lemmings) {
      if (other === lem || other.dead || other.saved || other.state !== "blocker") continue;
      if (Math.abs(other.x - lem.x) < 12 && Math.abs(other.y - lem.y) < 14) {
        if ((lem.dir > 0 && lem.x < other.x) || (lem.dir < 0 && lem.x > other.x)) {
          lem.dir *= -1;
          lem.x += lem.dir * 5;
        }
      }
    }

    // Wall / climb
    const nose = Math.floor((centerX(lem) + lem.dir * 6) / TILE);
    const mid = Math.floor((lem.y + 8) / TILE);
    if (solidAt(nose, mid)) {
      if (lem.climb) lem.state = "climb";
      else {
        lem.dir *= -1;
        lem.x += lem.dir * 4;
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
    const alive = lemmings.some((l) => !l.dead && !l.saved);
    const spawning = released < toRelease;
    if (!spawning && !alive) {
      if (saved >= need) winLevel();
      else failLevel();
    }
  }

  function winLevel() {
    levelDone = true;
    playing = false;
    sessionScore += 250 + saved * 25;
    saveBest();
    maxLevel = Math.max(maxLevel, levelIndex + 1);
    try {
      localStorage.setItem(LEVEL_KEY, String(maxLevel));
    } catch {}
    checkAchievements();
    window.HubConfetti?.burst?.();
    window.HubSound?.play?.("merge");
    const next = levelIndex + 1;
    if (overlayTitle) overlayTitle.textContent = "Level clear!";
    if (overlayText) {
      overlayText.textContent =
        next < LEVELS.length
          ? `Saved ${saved}/${toRelease}. Score ${sessionScore}. Next: ${LEVELS[next].name}`
          : `All levels cleared! Final score ${sessionScore}.`;
    }
    if (startBtn) startBtn.textContent = next < LEVELS.length ? "Next level" : "Play again";
    overlay?.classList.remove("hidden");
  }

  function failLevel() {
    levelDone = true;
    playing = false;
    saveBest();
    if (overlayTitle) overlayTitle.textContent = "Oh no";
    if (overlayText) overlayText.textContent = `Saved ${saved}/${need} needed. Score ${sessionScore}. Try again!`;
    if (startBtn) startBtn.textContent = "Retry";
    overlay?.classList.remove("hidden");
    window.HubSound?.play?.("error");
  }

  function saveBest() {
    if (sessionScore <= best) {
      updateHud();
      return;
    }
    best = sessionScore;
    try {
      localStorage.setItem(HIGH_SCORE_KEY, String(best));
    } catch {}
    updateHud();
    maybeSubmit(true);
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

  function updateHud() {
    const lvl = LEVELS[levelIndex];
    if (levelTitleEl) levelTitleEl.textContent = `Level ${levelIndex + 1}: ${lvl.name}`;
    if (goalLabelEl) goalLabelEl.textContent = `Save ${need} / ${toRelease}`;
    if (outCountEl) outCountEl.textContent = String(Math.max(0, released - saved - dead));
    if (savedCountEl) savedCountEl.textContent = String(saved);
    if (bestScoreEl) bestScoreEl.textContent = String(best);
    if (overlayBest) overlayBest.textContent = String(best);
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
      btn.innerHTML = `<span class="skill-ico">${s.ico}</span><span class="skill-name">${s.name}</span><span class="skill-count">${n}</span>`;
      skillsEl.appendChild(btn);
    });
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

    // Entrance
    ctx.fillStyle = "#1e293b";
    ctx.fillRect(entrance.x * TILE - 2, entrance.y * TILE - 6, 20, 18);
    ctx.fillStyle = "#020617";
    ctx.fillRect(entrance.x * TILE + 2, entrance.y * TILE - 2, 12, 12);
    ctx.fillStyle = "#fbbf24";
    ctx.font = "bold 10px Outfit,sans-serif";
    ctx.fillText("IN", entrance.x * TILE, entrance.y * TILE - 10);

    // Exit
    ctx.fillStyle = "#14532d";
    ctx.fillRect(exit.x * TILE - 2, exit.y * TILE - 8, 20, 24);
    ctx.fillStyle = "#22c55e";
    ctx.fillRect(exit.x * TILE + 2, exit.y * TILE - 4, 12, 16);
    ctx.fillStyle = "#86efac";
    ctx.fillText("OUT", exit.x * TILE - 4, exit.y * TILE - 12);

    lemmings.forEach((lem) => {
      if (lem.dead || lem.saved) return;
      const bob = Math.sin(lem.frame * 12) * 1.1;
      ctx.save();
      ctx.translate(centerX(lem), lem.y + 8 + bob);
      if (lem.dir < 0) ctx.scale(-1, 1);
      ctx.fillStyle = lem.state === "blocker" ? "#f97316" : "#22c55e";
      ctx.fillRect(-5, -6, 10, 12);
      ctx.fillStyle = "#14532d";
      ctx.fillRect(-5, -9, 10, 4);
      ctx.fillStyle = "#fde68a";
      ctx.fillRect(0, -5, 5, 5);
      if (lem.float) {
        ctx.fillStyle = "#e2e8f0";
        ctx.beginPath();
        ctx.arc(0, -14, 7, 0, Math.PI * 2);
        ctx.fill();
      }
      if (lem.climb) {
        ctx.fillStyle = "#38bdf8";
        ctx.fillRect(-7, 1, 3, 5);
      }
      if (lem.bombTimer > 0) {
        ctx.fillStyle = "#fb7185";
        ctx.font = "bold 11px Outfit,sans-serif";
        ctx.fillText(String(Math.ceil(lem.bombTimer)), -3, -14);
      }
      ctx.restore();
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

  function startCampaign(fromLevel) {
    ensureSession();
    if (fromLevel === 0) sessionScore = 0;
    loadLevel(fromLevel);
    playing = true;
    paused = false;
    overlay?.classList.add("hidden");
  }

  function showMenu(pause) {
    if (pause && playing && !levelDone) paused = true;
    if (overlayTitle) overlayTitle.textContent = "Lemmings";
    if (overlayText) {
      overlayText.textContent = paused
        ? "Paused. Resume or restart this level."
        : "Pick a skill, tap a lemming, and get them to the green OUT hatch.";
    }
    if (startBtn) startBtn.textContent = paused ? "Resume" : "Play";
    overlay?.classList.remove("hidden");
  }

  skillsEl?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-skill]");
    if (!btn || btn.disabled) return;
    selectedSkill = btn.dataset.skill;
    renderSkills();
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
      const next = levelIndex + 1;
      startCampaign(next < LEVELS.length ? next : 0);
      return;
    }
    // Always restart current / start from beginning if fresh
    if (levelDone) startCampaign(levelIndex);
    else startCampaign(0);
  });

  menuBtn?.addEventListener("click", () => showMenu(true));
  gamesBtn?.addEventListener("click", () => {
    window.location.href = "../index.html#games";
  });

  updateHud();
  loadLevel(0);
  draw();
  requestAnimationFrame(tick);
  maybeSubmit(false);
  window.addEventListener("beforeunload", () => maybeSubmit(true));
})();
