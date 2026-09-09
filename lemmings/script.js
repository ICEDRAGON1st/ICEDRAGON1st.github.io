(function () {
  const HIGH_SCORE_KEY = "lemmings-high-score";
  const LEVEL_KEY = "lemmings-max-level-v1";
  const TILE = 16;
  const COLS = 60;
  const ROWS = 30;
  const W = COLS * TILE;
  const H = ROWS * TILE;
  const MAX_FALL = 9 * TILE;
  const SPAWN_GAP = 1.05;

  const SKILLS = [
    { id: "blocker", name: "Block", ico: "🛑" },
    { id: "builder", name: "Build", ico: "🪜" },
    { id: "basher", name: "Bash", ico: "🥊" },
    { id: "digger", name: "Dig", ico: "⛏️" },
    { id: "floater", name: "Float", ico: "🪂" },
    { id: "bomber", name: "Bomb", ico: "💥" },
    { id: "climber", name: "Climb", ico: "🧗" }
  ];

  // Map legend: # solid  = steel  . empty  E entrance  X exit  ~ water hazard
  const LEVELS = [
    {
      name: "Just Walk",
      release: 10,
      need: 5,
      rate: 1.1,
      skills: { blocker: 0, builder: 0, basher: 0, digger: 0, floater: 0, bomber: 0, climber: 0 },
      map: [
        "............................................................",
        "............................................................",
        "............................................................",
        "............................................................",
        "............................................................",
        "..............E.............................................",
        "............................................................",
        "######################################......................",
        "######################################......................",
        "............................................................",
        "............................................................",
        "..............................................X.............",
        "..............................................##############",
        "..............................................##############",
        "............................................................",
        "............................................................",
        "............................................................",
        "............................................................",
        "............................................................",
        "............................................................",
        "............................................................",
        "............................................................",
        "............................................................",
        "............................................................",
        "............................................................",
        "............................................................",
        "............................................................",
        "............................................................",
        "############################################################",
        "############################################################"
      ]
    },
    {
      name: "Hold the Line",
      release: 12,
      need: 7,
      rate: 0.95,
      skills: { blocker: 2, builder: 0, basher: 5, digger: 0, floater: 0, bomber: 1, climber: 0 },
      map: [
        "............................................................",
        "............................................................",
        "........E...................................................",
        "............................................................",
        "######################......................................",
        "######################......................................",
        "....................##......................................",
        "....................##......................................",
        "....................##......................X...............",
        "....................##......................################",
        "....................##......................################",
        "....................##......................................",
        "....................##......................................",
        "....................##......................................",
        "............................................................",
        "............................................................",
        "............................................................",
        "............................................................",
        "............................................................",
        "............................................................",
        "............................................................",
        "............................................................",
        "............................................................",
        "............................................................",
        "............................................................",
        "............................................................",
        "............................................................",
        "............................................................",
        "############################################################",
        "############################################################"
      ]
    },
    {
      name: "Bridge Builders",
      release: 14,
      need: 8,
      rate: 0.9,
      skills: { blocker: 2, builder: 8, basher: 0, digger: 0, floater: 0, bomber: 0, climber: 0 },
      map: [
        "............................................................",
        "............................................................",
        ".........E..................................................",
        "............................................................",
        "################............................................",
        "################............................................",
        "............................................................",
        "............................................................",
        "............................................................",
        "..............................................X.............",
        "..............................................##############",
        "..............................................##############",
        "............................................................",
        "............................................................",
        "............................................................",
        "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
        "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
        "............................................................",
        "............................................................",
        "............................................................",
        "............................................................",
        "............................................................",
        "............................................................",
        "............................................................",
        "............................................................",
        "............................................................",
        "............................................................",
        "............................................................",
        "############################################################",
        "############################################################"
      ]
    },
    {
      name: "Tunnel Time",
      release: 16,
      need: 10,
      rate: 0.85,
      skills: { blocker: 2, builder: 2, basher: 6, digger: 4, floater: 0, bomber: 1, climber: 0 },
      map: [
        "............................................................",
        "........E...................................................",
        "............................................................",
        "############################################################",
        "############################################################",
        "##############################..............################",
        "##############################..............################",
        "##############################..............################",
        "##############################..............################",
        "##############################..............################",
        "##############################..............################",
        "##############################..............####X###########",
        "##############################..............################",
        "##############################..............################",
        "############################################################",
        "############################################################",
        "............................................................",
        "............................................................",
        "............................................................",
        "............................................................",
        "............................................................",
        "............................................................",
        "............................................................",
        "............................................................",
        "............................................................",
        "............................................................",
        "............................................................",
        "............................................................",
        "############################################################",
        "############################################################"
      ]
    },
    {
      name: "Long Drop",
      release: 15,
      need: 9,
      rate: 0.9,
      skills: { blocker: 1, builder: 4, basher: 0, digger: 0, floater: 8, bomber: 0, climber: 0 },
      map: [
        "..............E.............................................",
        "............................................................",
        "##############..............................................",
        "##############..............................................",
        "............................................................",
        "............................................................",
        "............................................................",
        "............................................................",
        "............................................................",
        "............................................................",
        "............................................................",
        "............................................................",
        "............................................................",
        "............................................................",
        "............................................................",
        "............................................................",
        "............................................................",
        "............................................................",
        "............................................................",
        "..............................................X.............",
        "..............................................##############",
        "..............................................##############",
        "............................................................",
        "............................................................",
        "............................................................",
        "............................................................",
        "............................................................",
        "............................................................",
        "############################################################",
        "############################################################"
      ]
    },
    {
      name: "Wall Climbers",
      release: 14,
      need: 8,
      rate: 0.9,
      skills: { blocker: 1, builder: 2, basher: 2, digger: 0, floater: 2, bomber: 1, climber: 6 },
      map: [
        "............................................................",
        "......E.....................................................",
        "............................................................",
        "############................................................",
        "############................................................",
        "..........##................................................",
        "..........##................................................",
        "..........##................................................",
        "..........##................................................",
        "..........##...................................X............",
        "..........##...................................##############",
        "..........##...................................##############",
        "..........##................................................",
        "..........##................................................",
        "..........####################..............................",
        "..........####################..............................",
        "............................................................",
        "............................................................",
        "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
        "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
        "............................................................",
        "............................................................",
        "............................................................",
        "............................................................",
        "............................................................",
        "............................................................",
        "............................................................",
        "............................................................",
        "############################################################",
        "############################################################"
      ]
    }
  ];

  // Fix maps that accidentally have wrong width
  LEVELS.forEach((lvl) => {
    lvl.map = lvl.map.map((row) => {
      const r = row.slice(0, COLS);
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
  let entrance = { x: 0, y: 0 };
  let exit = { x: 0, y: 0 };
  let playing = false;
  let paused = false;
  let levelDone = false;
  let sessionScore = 0;
  let sessionStarted = false;
  let lastSubmitAt = 0;
  let lastTs = 0;
  let raf = 0;
  let nukeTimer = 0;

  function ensureSession() {
    if (sessionStarted) return;
    sessionStarted = true;
    if (window.HubPlays) HubPlays.record("lemmings");
    if (window.HubStreak) HubStreak.recordPlay();
  }

  function solidAt(tx, ty) {
    if (ty < 0 || tx < 0 || tx >= COLS || ty >= ROWS) return true;
    const c = terrain[ty][tx];
    return c === "#" || c === "=";
  }

  function steelAt(tx, ty) {
    if (ty < 0 || tx < 0 || tx >= COLS || ty >= ROWS) return true;
    return terrain[ty][tx] === "=";
  }

  function waterAt(tx, ty) {
    if (ty < 0 || tx < 0 || tx >= COLS || ty >= ROWS) return false;
    return terrain[ty][tx] === "~";
  }

  function setTile(tx, ty, ch) {
    if (ty < 0 || tx < 0 || tx >= COLS || ty >= ROWS) return;
    if (terrain[ty][tx] === "=") return;
    terrain[ty][tx] = ch;
  }

  function loadLevel(idx) {
    levelIndex = Math.max(0, Math.min(LEVELS.length - 1, idx));
    const lvl = LEVELS[levelIndex];
    terrain = lvl.map.map((row) => row.split(""));
    entrance = { x: 2, y: 2 };
    exit = { x: COLS - 4, y: ROWS - 4 };
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
    spawnTimer = 0.4;
    levelDone = false;
    nukeTimer = 0;
    paused = false;
    renderSkills();
    updateHud();
  }

  function spawnLemming() {
    lemmings.push({
      x: entrance.x * TILE + 4,
      y: entrance.y * TILE,
      vx: 28,
      dir: 1,
      state: "fall",
      fallDist: 0,
      skill: null,
      actionTimer: 0,
      buildLeft: 0,
      bashLeft: 0,
      climb: false,
      float: false,
      bombTimer: 0,
      frame: 0,
      dead: false,
      saved: false
    });
    released += 1;
  }

  function feetTile(lem) {
    return {
      tx: Math.floor((lem.x + 6) / TILE),
      ty: Math.floor((lem.y + 15) / TILE)
    };
  }

  function bodyTile(lem) {
    return {
      tx: Math.floor((lem.x + 6) / TILE),
      ty: Math.floor((lem.y + 8) / TILE)
    };
  }

  function onGround(lem) {
    const { tx, ty } = feetTile(lem);
    return solidAt(tx, ty + 1) || solidAt(tx, Math.floor((lem.y + 16) / TILE));
  }

  function killLemming(lem, reason) {
    if (lem.dead || lem.saved) return;
    lem.dead = true;
    lem.state = reason || "dead";
    dead += 1;
    for (let i = 0; i < 8; i += 1) {
      particles.push({
        x: lem.x + 6,
        y: lem.y + 8,
        vx: (Math.random() - 0.5) * 80,
        vy: -40 - Math.random() * 60,
        life: 0.4 + Math.random() * 0.3,
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
    if (lem.state === "blocker" || lem.state === "bomb") return false;
    const left = skillsLeft[skill] || 0;
    if (left <= 0 && skill !== "nuke") return false;

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
      lem.bombTimer = 2.2;
      lem.state = "bomb";
      skillsLeft.bomber -= 1;
      window.HubSound?.play?.("click");
      return true;
    }
    if (skill === "blocker") {
      if (lem.state !== "walk") return false;
      lem.state = "blocker";
      lem.vx = 0;
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
      lem.bashLeft = 18;
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
    const { tx, ty } = bodyTile(lem);
    for (let dy = -1; dy <= 1; dy += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        if (!steelAt(tx + dx, ty + dy)) setTile(tx + dx, ty + dy, ".");
      }
    }
    killLemming(lem, "bomb");
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

    // Exit check
    const cx = lem.x + 6;
    const cy = lem.y + 10;
    if (
      Math.abs(cx - (exit.x * TILE + 8)) < 14 &&
      Math.abs(cy - (exit.y * TILE + 8)) < 18 &&
      lem.state !== "fall"
    ) {
      saveLemming(lem);
      return;
    }

    if (lem.state === "blocker") {
      // Blockers turn walkers
      return;
    }

    if (lem.state === "builder") {
      lem.actionTimer += dt;
      if (lem.actionTimer >= 0.28) {
        lem.actionTimer = 0;
        const tx = Math.floor((lem.x + 6 + lem.dir * 10) / TILE);
        const ty = Math.floor((lem.y + 14) / TILE);
        if (!solidAt(tx, ty)) setTile(tx, ty, "#");
        lem.x += lem.dir * 4;
        lem.y -= 4;
        lem.buildLeft -= 1;
        if (lem.buildLeft <= 0 || solidAt(Math.floor((lem.x + 6 + lem.dir * 8) / TILE), Math.floor((lem.y + 4) / TILE))) {
          lem.state = "walk";
        }
      }
      return;
    }

    if (lem.state === "basher") {
      lem.actionTimer += dt;
      if (lem.actionTimer >= 0.18) {
        lem.actionTimer = 0;
        const tx = Math.floor((lem.x + 6 + lem.dir * 12) / TILE);
        const ty = Math.floor((lem.y + 8) / TILE);
        if (steelAt(tx, ty) || !solidAt(tx, ty)) {
          lem.state = "walk";
        } else {
          setTile(tx, ty, ".");
          setTile(tx, ty - 1, ".");
          lem.x += lem.dir * 4;
          lem.bashLeft -= 1;
          if (lem.bashLeft <= 0) lem.state = "walk";
        }
      }
      return;
    }

    if (lem.state === "digger") {
      lem.actionTimer += dt;
      if (lem.actionTimer >= 0.22) {
        lem.actionTimer = 0;
        const tx = Math.floor((lem.x + 6) / TILE);
        const ty = Math.floor((lem.y + 16) / TILE);
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

    // Climbing
    if (lem.climb && lem.state === "walk") {
      const faceX = Math.floor((lem.x + 6 + lem.dir * 8) / TILE);
      const faceY = Math.floor((lem.y + 8) / TILE);
      if (solidAt(faceX, faceY) && !solidAt(faceX, faceY - 1)) {
        lem.state = "climb";
      }
    }

    if (lem.state === "climb") {
      const faceX = Math.floor((lem.x + 6 + lem.dir * 8) / TILE);
      const headY = Math.floor((lem.y + 2) / TILE);
      if (!solidAt(faceX, headY)) {
        lem.y -= 40 * dt;
        lem.x += lem.dir * 8 * dt;
        if (!solidAt(faceX, Math.floor((lem.y + 8) / TILE))) {
          lem.state = "walk";
          lem.x += lem.dir * 6;
        }
      } else {
        lem.dir *= -1;
        lem.state = "fall";
        lem.fallDist = 0;
      }
      return;
    }

    // Gravity / fall
    const ground = onGround(lem);
    if (!ground && lem.state !== "climb") {
      if (lem.state !== "fall") {
        lem.state = "fall";
        lem.fallDist = 0;
      }
      const fallSpeed = lem.float ? 38 : 110;
      lem.y += fallSpeed * dt;
      lem.fallDist += fallSpeed * dt;
      // Snap to ground
      if (onGround(lem)) {
        lem.y = Math.floor((lem.y + 15) / TILE) * TILE;
        if (!lem.float && lem.fallDist > MAX_FALL) {
          killLemming(lem, "splat");
          return;
        }
        lem.state = "walk";
        lem.fallDist = 0;
      }
      // Water / void
      const { tx, ty } = feetTile(lem);
      if (waterAt(tx, ty) || waterAt(tx, ty + 1) || lem.y > H + 20) {
        killLemming(lem, "drown");
      }
      return;
    }

    // Walk
    lem.state = "walk";
    const speed = 34;
    lem.x += lem.dir * speed * dt;

    // Turn at blockers
    for (const other of lemmings) {
      if (other === lem || other.dead || other.saved || other.state !== "blocker") continue;
      if (Math.abs(other.x - lem.x) < 10 && Math.abs(other.y - lem.y) < 12) {
        if ((lem.dir > 0 && lem.x < other.x) || (lem.dir < 0 && lem.x > other.x)) {
          lem.dir *= -1;
          lem.x += lem.dir * 4;
        }
      }
    }

    // Wall ahead
    const noseX = Math.floor((lem.x + 6 + lem.dir * 7) / TILE);
    const noseY = Math.floor((lem.y + 8) / TILE);
    if (solidAt(noseX, noseY)) {
      if (lem.climb) lem.state = "climb";
      else {
        lem.dir *= -1;
        lem.x += lem.dir * 3;
      }
    }

    // Edge: keep walking off into fall (handled next frame)
    const { tx, ty } = feetTile(lem);
    if (waterAt(tx, ty + 1)) killLemming(lem, "drown");
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
    if (saved >= need && !alive && !spawning) {
      winLevel();
      return;
    }
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
    checkAchievements();
    maxLevel = Math.max(maxLevel, levelIndex + 1);
    try {
      localStorage.setItem(LEVEL_KEY, String(maxLevel));
    } catch {}
    window.HubConfetti?.burst?.();
    window.HubSound?.play?.("merge");
    const next = levelIndex + 1;
    if (overlayTitle) overlayTitle.textContent = "Level clear!";
    if (overlayText) {
      overlayText.textContent =
        next < LEVELS.length
          ? `Saved ${saved}/${toRelease}. Score ${sessionScore}. Ready for ${LEVELS[next].name}?`
          : `You cleared every level! Final score ${sessionScore}.`;
    }
    if (startBtn) startBtn.textContent = next < LEVELS.length ? "Next level" : "Play again";
    overlay?.classList.remove("hidden");
  }

  function failLevel() {
    levelDone = true;
    playing = false;
    saveBest();
    if (overlayTitle) overlayTitle.textContent = "Oh no";
    if (overlayText) {
      overlayText.textContent = `Only saved ${saved}/${need} needed. Score ${sessionScore}. Try again!`;
    }
    if (startBtn) startBtn.textContent = "Retry";
    overlay?.classList.remove("hidden");
    window.HubSound?.play?.("error");
  }

  function saveBest() {
    if (sessionScore <= best) return;
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
    // Sky
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#7eb6e8");
    g.addColorStop(1, "#c5e3f6");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // Terrain
    for (let y = 0; y < ROWS; y += 1) {
      for (let x = 0; x < COLS; x += 1) {
        const c = terrain[y][x];
        if (c === "." || c === "E" || c === "X") continue;
        if (c === "~") {
          ctx.fillStyle = "#1d4ed8";
          ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
          ctx.fillStyle = "rgba(125,211,252,0.35)";
          ctx.fillRect(x * TILE, y * TILE, TILE, 4);
        } else if (c === "=") {
          ctx.fillStyle = "#64748b";
          ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
        } else {
          ctx.fillStyle = y > ROWS / 2 ? "#3f7d3a" : "#5a9a4a";
          ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
          ctx.fillStyle = "rgba(0,0,0,0.12)";
          ctx.fillRect(x * TILE, y * TILE + TILE - 3, TILE, 3);
        }
      }
    }

    // Entrance
    ctx.fillStyle = "#334155";
    ctx.fillRect(entrance.x * TILE - 4, entrance.y * TILE - 8, 24, 20);
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(entrance.x * TILE, entrance.y * TILE - 2, 16, 14);
    ctx.fillStyle = "#fbbf24";
    ctx.font = "bold 10px Outfit, sans-serif";
    ctx.fillText("IN", entrance.x * TILE - 2, entrance.y * TILE - 12);

    // Exit
    ctx.fillStyle = "#14532d";
    ctx.fillRect(exit.x * TILE - 4, exit.y * TILE - 10, 24, 26);
    ctx.fillStyle = "#22c55e";
    ctx.fillRect(exit.x * TILE, exit.y * TILE - 4, 16, 18);
    ctx.fillStyle = "#86efac";
    ctx.font = "bold 10px Outfit, sans-serif";
    ctx.fillText("OUT", exit.x * TILE - 6, exit.y * TILE - 14);

    // Lemmings
    lemmings.forEach((lem) => {
      if (lem.dead || lem.saved) return;
      const bob = Math.sin(lem.frame * 10) * 1.2;
      ctx.save();
      ctx.translate(lem.x + 6, lem.y + 8 + bob);
      if (lem.dir < 0) ctx.scale(-1, 1);

      // body
      ctx.fillStyle = lem.state === "blocker" ? "#f97316" : "#22c55e";
      ctx.fillRect(-5, -6, 10, 12);
      // hair
      ctx.fillStyle = "#14532d";
      ctx.fillRect(-5, -9, 10, 4);
      // face
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
        ctx.fillRect(-6, 2, 3, 5);
      }
      if (lem.bombTimer > 0) {
        ctx.fillStyle = "#fb7185";
        ctx.font = "bold 11px Outfit, sans-serif";
        ctx.fillText(String(Math.ceil(lem.bombTimer)), -4, -14);
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
    raf = requestAnimationFrame(tick);
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
          spawnTimer = Math.max(0.35, SPAWN_GAP * (lvl.rate || 1));
        }
      }
      lemmings.forEach((lem) => updateLemming(lem, dt));
      updateParticles(dt);
      updateHud();
      renderSkills();
      checkLevelEnd();
    }
    draw();
  }

  function canvasPos(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = W / rect.width;
    const scaleY = H / rect.height;
    const clientX = e.clientX ?? e.touches?.[0]?.clientX;
    const clientY = e.clientY ?? e.touches?.[0]?.clientY;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY
    };
  }

  function pickLemming(x, y) {
    let bestLem = null;
    let bestD = 22;
    lemmings.forEach((lem) => {
      if (lem.dead || lem.saved) return;
      const dx = lem.x + 6 - x;
      const dy = lem.y + 8 - y;
      const d = Math.hypot(dx, dy);
      if (d < bestD) {
        bestD = d;
        bestLem = lem;
      }
    });
    return bestLem;
  }

  function startCampaign(fromLevel) {
    ensureSession();
    sessionScore = Math.max(sessionScore, 0);
    if (fromLevel === 0) sessionScore = 0;
    loadLevel(fromLevel);
    playing = true;
    paused = false;
    overlay?.classList.add("hidden");
  }

  function showMenu(pause) {
    if (pause && playing) paused = true;
    if (overlayTitle) overlayTitle.textContent = "Lemmings";
    if (overlayText) {
      overlayText.textContent = paused
        ? "Paused. Resume or restart this level."
        : "Assign skills to guide little walkers from the hatch to the exit. Save enough to clear each level.";
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

  canvas?.addEventListener("pointerdown", (e) => {
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
      if (next < LEVELS.length) startCampaign(next);
      else startCampaign(0);
      return;
    }
    startCampaign(levelDone ? levelIndex : Math.min(maxLevel, LEVELS.length - 1));
  });

  menuBtn?.addEventListener("click", () => showMenu(true));
  gamesBtn?.addEventListener("click", () => {
    window.location.href = "../index.html#games";
  });

  canvas.width = W;
  canvas.height = H;
  updateHud();
  renderSkills();
  loadLevel(0);
  draw();
  raf = requestAnimationFrame(tick);
  maybeSubmit(false);

  window.addEventListener("beforeunload", () => maybeSubmit(true));
})();
