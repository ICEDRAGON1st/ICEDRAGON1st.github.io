(() => {
  const GAME_ID = "waves";
  const HIGH_KEY = "space-waves-high-score";
  const BEST_LEVEL_KEY = "space-waves-best-level";

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");

  const els = {
    menu: document.getElementById("menu-btn"),
    mode: document.getElementById("hud-mode"),
    progress: document.getElementById("progress"),
    high: document.getElementById("high-score"),
    hint: document.getElementById("hint"),
    overlay: document.getElementById("overlay"),
    title: document.getElementById("overlay-title"),
    text: document.getElementById("overlay-text"),
    best: document.getElementById("overlay-best"),
    picker: document.getElementById("level-picker"),
    classicPanel: document.getElementById("classic-panel"),
    levelMeta: document.getElementById("level-meta"),
    start: document.getElementById("start-btn"),
    resume: document.getElementById("resume-btn"),
    retry: document.getElementById("retry-btn"),
    games: document.getElementById("games-btn")
  };

  /**
   * Each classic level has a unique corridor shape + hazard grammar.
   * Early = one idea. Mid = tighter. Late = dense but fair (MIN_GAP).
   * Hazards: none | top | bot | both | gate | diamond | door
   */
  const LEVELS = [
    { id: 1, name: "Glide", diff: "easy", speed: 250, theme: "#6ec8ff", style: "smooth", path: null },
    { id: 2, name: "Ridge", diff: "easy", speed: 265, theme: "#7dffb2", style: "ridge", path: null },
    { id: 3, name: "Bite", diff: "easy", speed: 275, theme: "#ff9a5c", style: "teeth", path: null },
    { id: 4, name: "Needle", diff: "medium", speed: 285, theme: "#ffd56e", style: "needle", path: null },
    { id: 5, name: "Slalom", diff: "medium", speed: 295, theme: "#b48cff", style: "slalom", path: null },
    { id: 6, name: "Shelf", diff: "medium", speed: 305, theme: "#5ce1ff", style: "shelf", path: null },
    { id: 7, name: "Gate", diff: "hard", speed: 315, theme: "#ff6b9d", style: "gate", path: null },
    { id: 8, name: "Prism", diff: "hard", speed: 325, theme: "#9dff6e", style: "prism", path: null },
    { id: 9, name: "Saw", diff: "hard", speed: 335, theme: "#ff5c5c", style: "saw", path: null },
    { id: 10, name: "Door", diff: "expert", speed: 345, theme: "#c9a0ff", style: "door", path: null },
    { id: 11, name: "Weave", diff: "expert", speed: 355, theme: "#5cffd0", style: "weave", path: null },
    { id: 12, name: "Core", diff: "expert", speed: 365, theme: "#ff8c42", style: "core", path: null }
  ];

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function clamp(n, a, b) {
    return Math.max(a, Math.min(b, n));
  }

  function corridor(mid, gap) {
    return { top: mid - gap / 2, bot: mid + gap / 2 };
  }

  function finalizePath(pts) {
    const MIN_GAP = 0.3;
    return pts.map((p) => {
      let top = p.top;
      let bot = p.bot;
      let mid = (top + bot) / 2;
      let gap = bot - top;
      if (gap < MIN_GAP) {
        gap = MIN_GAP;
        top = mid - gap / 2;
        bot = mid + gap / 2;
      }
      top = clamp(top, 0.06, 0.6);
      bot = clamp(bot, top + MIN_GAP, 0.94);
      return {
        x: p.x,
        top,
        bot,
        haz: p.haz || null,
        gateY: p.gateY,
        gateH: p.gateH,
        diaY: p.diaY,
        diaS: p.diaS,
        doorY: p.doorY,
        doorH: p.doorH
      };
    });
  }

  function fillPath(len, step, fn) {
    const pts = [];
    for (let x = 0; x <= len; x += step) pts.push(fn(x));
    return finalizePath(pts);
  }

  /** 1 Glide — wide soft S, no hazards */
  function buildGlide() {
    return fillPath(2600, 36, (x) => {
      const mid = 0.5 + Math.sin(x * 0.0018) * 0.07;
      const c = corridor(mid, 0.46);
      return { x, ...c, haz: null };
    });
  }

  /** 2 Ridge — flat floor, roof dips + top spikes only */
  function buildRidge() {
    return fillPath(3000, 28, (x) => {
      const dip = x > 400 && x < 2600 ? Math.max(0, Math.sin((x - 400) * 0.008)) * 0.1 : 0;
      const mid = 0.52 - dip * 0.4;
      const gap = 0.42 - dip * 0.5;
      const c = corridor(mid, gap);
      let haz = null;
      if (dip > 0.07 && x % 120 < 28) haz = "top";
      return { x, ...c, haz };
    });
  }

  /** 3 Bite — calm tunnel with spaced fang pairs */
  function buildBite() {
    const fangs = [500, 780, 1100, 1450, 1800, 2200, 2550];
    return fillPath(3000, 24, (x) => {
      const mid = 0.5 + Math.sin(x * 0.0022) * 0.05;
      const c = corridor(mid, 0.4);
      let haz = null;
      for (const f of fangs) {
        if (Math.abs(x - f) < 20) haz = x < f ? "top" : "bot";
        if (Math.abs(x - (f + 40)) < 20) haz = "bot";
        if (Math.abs(x - (f - 40)) < 20) haz = "top";
      }
      return { x, ...c, haz };
    });
  }

  /** 4 Needle — long thin corridor, rare single spikes */
  function buildNeedle() {
    return fillPath(3400, 22, (x) => {
      const mid = 0.5 + Math.sin(x * 0.0015) * 0.09;
      const c = corridor(mid, 0.34);
      let haz = null;
      if (x > 500 && x < 3000 && x % 280 < 22) {
        haz = Math.floor(x / 280) % 2 === 0 ? "top" : "bot";
      }
      return { x, ...c, haz };
    });
  }

  /** 5 Slalom — big amplitude swings you ride */
  function buildSlalom() {
    return fillPath(3600, 26, (x) => {
      const mid = 0.5 + Math.sin(x * 0.0045) * 0.16;
      const c = corridor(mid, 0.36);
      let haz = null;
      if (x > 450 && Math.abs(Math.sin(x * 0.0045)) > 0.88 && x % 100 < 26) haz = "both";
      return { x, ...c, haz };
    });
  }

  /** 6 Shelf — terrace steps (hold / dump altitude) */
  function buildShelf() {
    return fillPath(3600, 24, (x) => {
      const step = Math.floor(x / 420);
      const mid = 0.5 + ((step % 2 === 0 ? -1 : 1) * 0.12);
      const c = corridor(mid, 0.36);
      let haz = null;
      if (x > 500 && x % 420 > 300 && x % 420 < 330) haz = step % 2 === 0 ? "bot" : "top";
      return { x, ...c, haz };
    });
  }

  /** 7 Gate — vertical bars to thread */
  function buildGate() {
    const gates = [
      [600, 0.38],
      [950, 0.58],
      [1300, 0.4],
      [1650, 0.6],
      [2000, 0.45],
      [2350, 0.55],
      [2700, 0.48],
      [3050, 0.52]
    ];
    return fillPath(3600, 20, (x) => {
      const mid = 0.5 + Math.sin(x * 0.002) * 0.06;
      const c = corridor(mid, 0.4);
      let haz = null;
      let gateY;
      let gateH = 0.09;
      for (const g of gates) {
        if (Math.abs(x - g[0]) < 18) {
          haz = "gate";
          gateY = g[1];
          gateH = 0.085;
        }
      }
      return { x, ...c, haz, gateY, gateH };
    });
  }

  /** 8 Prism — floating diamonds only */
  function buildPrism() {
    const dias = [
      [550, 0.4],
      [900, 0.58],
      [1250, 0.38],
      [1600, 0.55],
      [1950, 0.42],
      [2300, 0.6],
      [2650, 0.45],
      [3000, 0.52],
      [3300, 0.48]
    ];
    return fillPath(3800, 22, (x) => {
      const mid = 0.5 + Math.sin(x * 0.0024) * 0.07;
      const c = corridor(mid, 0.38);
      let haz = null;
      let diaY;
      let diaS = 0.052;
      for (const d of dias) {
        if (Math.abs(x - d[0]) < 18) {
          haz = "diamond";
          diaY = d[1];
        }
      }
      return { x, ...c, haz, diaY, diaS };
    });
  }

  /** 9 Saw — zig-zag walls + mixed spikes */
  function buildSaw() {
    return fillPath(4000, 20, (x) => {
      const tooth = ((Math.floor(x / 140) % 2) * 2 - 1) * 0.11;
      const mid = 0.5 + tooth;
      const c = corridor(mid, 0.33);
      let haz = null;
      if (x > 500 && x < 3600) {
        if (x % 140 < 20) haz = tooth > 0 ? "bot" : "top";
        else if (x % 280 < 20) haz = "both";
      }
      return { x, ...c, haz };
    });
  }

  /** 10 Door — narrowing necks with pass windows */
  function buildDoor() {
    const doors = [
      [700, 0.4, 0.2],
      [1100, 0.58, 0.2],
      [1500, 0.38, 0.19],
      [1900, 0.6, 0.19],
      [2300, 0.45, 0.19],
      [2700, 0.55, 0.2],
      [3100, 0.48, 0.2],
      [3500, 0.52, 0.2]
    ];
    return fillPath(4000, 18, (x) => {
      let mid = 0.5 + Math.sin(x * 0.0018) * 0.05;
      let gap = 0.4;
      let haz = null;
      let doorY;
      let doorH;
      for (const d of doors) {
        const dist = Math.abs(x - d[0]);
        if (dist < 90) {
          const u = 1 - dist / 90;
          gap = lerp(0.4, 0.32, u);
          mid = lerp(mid, d[1], u * 0.35);
          if (dist < 16) {
            haz = "door";
            doorY = d[1];
            doorH = d[2];
          }
        }
      }
      const c = corridor(mid, gap);
      return { x, ...c, haz, doorY, doorH };
    });
  }

  /** 11 Weave — criss-cross spikes on a snake path (sparse, not solid bands) */
  function buildWeave() {
    return fillPath(4200, 18, (x) => {
      const mid = 0.5 + Math.sin(x * 0.0055) * 0.14 + Math.sin(x * 0.0018) * 0.04;
      const c = corridor(mid, 0.32);
      let haz = null;
      if (x > 500 && x < 3800 && x % 95 < 16) {
        const kind = Math.floor(x / 95) % 3;
        haz = kind === 0 ? "top" : kind === 1 ? "bot" : "both";
      }
      return { x, ...c, haz };
    });
  }

  /** 12 Core — finale mix: teeth → gates → diamonds → doors, spaced */
  function buildCore() {
    const events = [
      { x: 550, haz: "top" },
      { x: 700, haz: "bot" },
      { x: 900, haz: "gate", gateY: 0.4, gateH: 0.08 },
      { x: 1150, haz: "diamond", diaY: 0.55, diaS: 0.05 },
      { x: 1400, haz: "both" },
      { x: 1650, haz: "gate", gateY: 0.58, gateH: 0.075 },
      { x: 1900, haz: "door", doorY: 0.45, doorH: 0.2 },
      { x: 2150, haz: "diamond", diaY: 0.4, diaS: 0.048 },
      { x: 2400, haz: "top" },
      { x: 2550, haz: "bot" },
      { x: 2800, haz: "gate", gateY: 0.5, gateH: 0.07 },
      { x: 3050, haz: "both" },
      { x: 3300, haz: "door", doorY: 0.52, doorH: 0.2 },
      { x: 3550, haz: "diamond", diaY: 0.48, diaS: 0.05 },
      { x: 3800, haz: "gate", gateY: 0.42, gateH: 0.075 },
      { x: 4050, haz: "both" }
    ];
    return fillPath(4500, 16, (x) => {
      const mid = 0.5 + Math.sin(x * 0.0032) * 0.1 + Math.sin(x * 0.001) * 0.03;
      const gap = lerp(0.36, 0.31, (Math.sin(x * 0.002) + 1) / 2);
      const c = corridor(mid, gap);
      let haz = null;
      let gateY;
      let gateH;
      let diaY;
      let diaS;
      let doorY;
      let doorH;
      for (const e of events) {
        if (Math.abs(x - e.x) < 14) {
          haz = e.haz;
          if (e.gateY != null) {
            gateY = e.gateY;
            gateH = e.gateH;
          }
          if (e.diaY != null) {
            diaY = e.diaY;
            diaS = e.diaS;
          }
          if (e.doorY != null) {
            doorY = e.doorY;
            doorH = e.doorH;
          }
        }
      }
      return { x, ...c, haz, gateY, gateH, diaY, diaS, doorY, doorH };
    });
  }

  // Endless chunk aliases (distinct shapes)
  const buildBreath = buildGlide;
  const buildTeeth = buildBite;
  const buildGates = buildGate;
  const buildDiamonds = buildPrism;
  const buildSteps = buildShelf;
  const buildGauntlet = buildWeave;
  const buildSingularity = buildCore;
  const buildWarmup = buildGlide;

  LEVELS[0].path = buildGlide();
  LEVELS[1].path = buildRidge();
  LEVELS[2].path = buildBite();
  LEVELS[3].path = buildNeedle();
  LEVELS[4].path = buildSlalom();
  LEVELS[5].path = buildShelf();
  LEVELS[6].path = buildGate();
  LEVELS[7].path = buildPrism();
  LEVELS[8].path = buildSaw();
  LEVELS[9].path = buildDoor();
  LEVELS[10].path = buildWeave();
  LEVELS[11].path = buildCore();

  // Hazards only count when the ship is this close in world-X to a marked point
  const HAZ_X = 11;

  function samplePath(path, x) {
    const empty = { top: 0.2, bot: 0.8, haz: null };
    if (!path.length) return empty;
    if (x <= path[0].x) return path[0];
    if (x >= path[path.length - 1].x) return path[path.length - 1];
    let lo = 0;
    let hi = path.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (path[mid].x <= x) lo = mid;
      else hi = mid;
    }
    const a = path[lo];
    const b = path[hi];
    const t = (x - a.x) / Math.max(1, b.x - a.x);
    // Prefer the point that actually has a hazard, but only while close to it
    let hazSrc = null;
    if (a.haz && Math.abs(x - a.x) <= HAZ_X) hazSrc = a;
    else if (b.haz && Math.abs(x - b.x) <= HAZ_X) hazSrc = b;
    return {
      top: lerp(a.top, b.top, t),
      bot: lerp(a.bot, b.bot, t),
      haz: hazSrc ? hazSrc.haz : null,
      hazX: hazSrc ? hazSrc.x : undefined,
      gateY: hazSrc ? hazSrc.gateY : undefined,
      gateH: hazSrc ? hazSrc.gateH : undefined,
      diaY: hazSrc ? hazSrc.diaY : undefined,
      diaS: hazSrc ? hazSrc.diaS : undefined,
      doorY: hazSrc ? hazSrc.doorY : undefined,
      doorH: hazSrc ? hazSrc.doorH : undefined
    };
  }


  let mode = "classic";
  let levelIndex = 0;
  let overlayKind = "menu"; // menu | pause | dead | win
  let running = false;
  let paused = false;
  let dead = false;
  let won = false;
  let recordedPlay = false;
  let holding = false;
  let worldX = 0;
  let shipY = 0.5;
  let shipVy = 0;
  let trail = [];
  let endlessPath = [];
  let endlessGenX = 0;
  let bestDist = readHigh();
  let bestLevel = readBestLevel(); // highest level id cleared (1..12)
  let flash = 0;
  let raf = 0;
  let lastTs = 0;
  let shake = 0;

  const SHIP_SCREEN_X = 0.22;
  // Snappy vertical flight
  const CLIMB_VY = -1.15;
  const FALL_VY = 1.2;
  const STEER = 20; // how fast velocity snaps to climb/fall
  const MAX_VY = 1.35;
  const MOVE_SCALE = 195;

  function readHigh() {
    try {
      const n = Number(localStorage.getItem(HIGH_KEY));
      return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
    } catch {
      return 0;
    }
  }

  function readBestLevel() {
    try {
      const n = Number(localStorage.getItem(BEST_LEVEL_KEY));
      return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
    } catch {
      return 0;
    }
  }

  function persistBestLevel(clearedId) {
    bestLevel = Math.max(bestLevel, Math.floor(clearedId));
    try {
      localStorage.setItem(BEST_LEVEL_KEY, String(bestLevel));
    } catch {}
  }

  /** All classic levels are freely selectable; bestLevel only tracks progress */
  function isLevelUnlocked(_index) {
    return true;
  }

  function persistHigh(n) {
    bestDist = Math.max(bestDist, Math.floor(n));
    try {
      localStorage.setItem(HIGH_KEY, String(bestDist));
    } catch {}
    try {
      window.HubLeaderboard?.submit?.(GAME_ID, bestDist);
    } catch {}
  }

  function syncStartLabel() {
    if (overlayKind === "pause") {
      els.start.textContent = "Restart";
      return;
    }
    if (overlayKind === "win" && mode === "classic" && levelIndex < LEVELS.length - 1) {
      els.start.textContent = `Next · ${LEVELS[levelIndex + 1].name}`;
      return;
    }
    if (mode === "endless") {
      els.start.textContent = overlayKind === "dead" || overlayKind === "win" ? "Play again" : "Play Endless";
      return;
    }
    const lv = currentLevel();
    els.start.textContent = `Play ${lv.id} · ${lv.name}`;
  }

  function currentLevel() {
    return LEVELS[levelIndex] || LEVELS[0];
  }

  function activePath() {
    return mode === "endless" ? endlessPath : currentLevel().path;
  }

  function pathEnd() {
    const p = activePath();
    return p.length ? p[p.length - 1].x : 1000;
  }

  function speed() {
    if (mode === "endless") return 240 + Math.min(140, worldX / 55);
    return currentLevel().speed;
  }

  function themeColor() {
    if (mode === "endless") return "#5ce1ff";
    return currentLevel().theme || "#5ce1ff";
  }

  function resize() {
    const wrap = canvas.parentElement;
    const w = Math.max(320, Math.floor(wrap?.clientWidth || window.innerWidth || 960));
    const h = Math.max(240, Math.floor(wrap?.clientHeight || window.innerHeight || 540));
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function paintHud() {
    els.mode.textContent = mode === "endless" ? "Endless" : `Lv ${currentLevel().id} ${currentLevel().name}`;
    els.high.textContent = String(bestDist);
    els.best.textContent = String(bestDist);
    if (mode === "endless") {
      els.progress.textContent = `${Math.floor(worldX)}m`;
    } else {
      const pct = clamp((worldX / pathEnd()) * 100, 0, 100);
      els.progress.textContent = `${Math.floor(pct)}%`;
    }
  }

  function renderLevelPicker() {
    const classic = mode === "classic";
    if (els.classicPanel) els.classicPanel.classList.toggle("hidden", !classic);
    els.picker.innerHTML = "";
    if (!classic) {
      if (els.levelMeta) els.levelMeta.textContent = "How far can you go?";
      syncStartLabel();
      return;
    }

    const cur = currentLevel();
    if (els.levelMeta) {
      els.levelMeta.textContent = `${cur.id} · ${cur.name} · ${cur.diff}`;
    }

    LEVELS.forEach((lv, i) => {
      const cleared = lv.id <= bestLevel;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className =
        `lvl-btn is-${lv.diff}` +
        (i === levelIndex ? " active" : "") +
        (cleared ? " cleared" : "");
      btn.title = `${lv.name} · ${lv.diff}${cleared ? " · cleared" : ""}`;
      btn.innerHTML = `<span class="lvl-num">${lv.id}</span><span class="lvl-name">${lv.name}</span>`;
      btn.addEventListener("click", () => {
        levelIndex = i;
        // Selecting a level cancels "Next level" auto-advance
        if (overlayKind === "win" || overlayKind === "dead") overlayKind = "menu";
        renderLevelPicker();
        paintHud();
        syncStartLabel();
      });
      els.picker.appendChild(btn);
    });
    syncStartLabel();
  }

  function resetRun() {
    worldX = 80;
    shipY = 0.5;
    shipVy = 0;
    trail = [];
    dead = false;
    won = false;
    flash = 0;
    shake = 0;
    holding = false;
    if (mode === "endless") {
      endlessPath = [];
      endlessGenX = 0;
      extendEndless(2500);
    }
  }

  function extendEndless(untilX) {
    const builders = [
      buildGlide,
      buildRidge,
      buildBite,
      buildNeedle,
      buildSlalom,
      buildShelf,
      buildGate,
      buildPrism,
      buildSaw,
      buildDoor,
      buildWeave
    ];
    while (endlessGenX < untilX) {
      const start = endlessGenX;
      const builder = builders[Math.floor(Math.random() * builders.length)];
      const chunk = builder();
      const len = chunk.length ? chunk[chunk.length - 1].x : 1200;
      chunk.forEach((p) => {
        endlessPath.push({
          ...p,
          x: start + p.x,
          haz: start > 350 ? p.haz : null
        });
      });
      endlessGenX = start + len;
    }
  }

  function recordPlayOnce() {
    if (recordedPlay) return;
    recordedPlay = true;
    try {
      window.HubPlays?.record?.(GAME_ID);
    } catch {}
    try {
      window.HubStreak?.recordPlay?.();
    } catch {}
  }

  function startGame() {
    recordPlayOnce();
    resetRun();
    running = true;
    paused = false;
    hideOverlay();
    lastTs = performance.now();
    if (!raf) raf = requestAnimationFrame(loop);
    els.hint.textContent = "Hold to rise · release to fall";
  }

  function showOverlay(kind) {
    overlayKind = kind || "menu";
    paused = true;
    els.overlay.classList.remove("hidden");
    els.resume.classList.add("hidden");
    els.retry.classList.add("hidden");
    els.retry.textContent = "Retry";

    if (overlayKind === "pause") {
      els.title.textContent = "Paused";
      els.text.textContent = "Hold = up · release = down. Or restart from the beginning.";
      els.resume.classList.remove("hidden");
    } else if (overlayKind === "dead") {
      const dist = Math.floor(worldX);
      els.title.textContent = "Crashed";
      els.text.textContent =
        mode === "endless"
          ? `You flew ${dist}m. Hit Retry to go again.`
          : `You reached ${Math.floor(clamp((worldX / pathEnd()) * 100, 0, 99))}% of ${currentLevel().name}.`;
      els.retry.classList.remove("hidden");
    } else if (overlayKind === "win") {
      els.title.textContent = "Level cleared!";
      const next = LEVELS[levelIndex + 1];
      els.text.textContent = next
        ? `${currentLevel().name} done — ${next.name} is unlocked.`
        : `${currentLevel().name} done — you finished every level!`;
      els.retry.classList.remove("hidden");
      els.retry.textContent = "Replay";
      try {
        window.HubConfetti?.burst?.();
      } catch {}
    } else {
      els.title.textContent = "Space Waves";
      els.text.textContent = "Hold to fly up. Let go to fall. Reach the green finish line.";
    }

    // Sync mode buttons with current mode
    document.querySelectorAll("[data-mode]").forEach((b) => {
      b.classList.toggle("active", b.dataset.mode === mode);
    });

    renderLevelPicker();
    paintHud();
    syncStartLabel();
  }

  function hideOverlay() {
    els.overlay.classList.add("hidden");
    paused = false;
  }

  function kill() {
    if (dead || won) return;
    dead = true;
    running = false;
    shake = 10;
    flash = 1;
    persistHigh(worldX);
    paintHud();
    try {
      window.HubSound?.play?.("error");
    } catch {}
    setTimeout(() => showOverlay("dead"), 280);
  }

  function finishLevel() {
    if (dead || won) return;
    won = true;
    running = false;
    persistHigh(pathEnd());
    persistBestLevel(currentLevel().id);
    paintHud();
    try {
      window.HubSound?.play?.("success");
    } catch {}
    showOverlay("win");
  }

  function shipHitbox() {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    const sx = w * SHIP_SCREEN_X;
    const sy = shipY * h;
    // Match the drawn arrow — slightly forgiving vs walls
    return { x: sx, y: sy, r: Math.max(5, h * 0.011), scale: Math.max(1.05, h * 0.0026) };
  }

  function collide() {
    const h = canvas.clientHeight;
    const sample = samplePath(activePath(), worldX);
    const topY = sample.top * h;
    const botY = sample.bot * h;
    const box = shipHitbox();
    // Small pad so you don't die a few pixels before the neon edge
    const wallR = box.r * 0.7;
    if (box.y - wallR < topY || box.y + wallR > botY) return true;

    if (!sample.haz || sample.hazX == null) return false;

    const w = canvas.clientWidth;
    const viewLeft = worldX - w * SHIP_SCREEN_X;
    const hx = sample.hazX - viewLeft;
    // Must actually reach the hazard's X (not just share the lane)
    if (Math.abs(box.x - hx) > Math.max(14, box.r + 10)) return false;

    const gap = botY - topY;
    const spikeH = Math.min(gap * 0.22, h * 0.055);
    const hw = 9;

    if (sample.haz === "top" || sample.haz === "both") {
      const tip = topY + spikeH;
      if (circleHitsTri(box.x, box.y, box.r * 0.85, hx - hw, topY, hx + hw, topY, hx, tip)) return true;
    }
    if (sample.haz === "bot" || sample.haz === "both") {
      const tip = botY - spikeH;
      if (circleHitsTri(box.x, box.y, box.r * 0.85, hx - hw, botY, hx + hw, botY, hx, tip)) return true;
    }
    if (sample.haz === "gate" && sample.gateY != null) {
      const gy = sample.gateY * h;
      const gh = Math.max(10, (sample.gateH || 0.08) * h);
      const gw = Math.max(12, h * 0.032);
      if (
        box.x + box.r * 0.8 > hx - gw &&
        box.x - box.r * 0.8 < hx + gw &&
        box.y + box.r * 0.8 > gy - gh / 2 &&
        box.y - box.r * 0.8 < gy + gh / 2
      ) {
        return true;
      }
    }
    if (sample.haz === "diamond" && sample.diaY != null) {
      const dy = sample.diaY * h;
      const ds = Math.max(8, (sample.diaS || 0.05) * h);
      const dx = box.x - hx;
      const dyv = box.y - dy;
      if (dx * dx + dyv * dyv < (box.r + ds * 0.55) * (box.r + ds * 0.55)) return true;
    }
    if (sample.haz === "door" && sample.doorY != null) {
      const dy = sample.doorY * h;
      const dh = Math.max(gap * 0.62, (sample.doorH || 0.18) * h);
      const dw = Math.max(16, h * 0.03);
      const openTop = dy - dh / 2;
      const openBot = dy + dh / 2;
      if (Math.abs(box.x - hx) > dw + box.r * 0.5) return false;
      // Safe only inside the lit opening
      if (box.y - box.r * 0.7 < openTop || box.y + box.r * 0.7 > openBot) return true;
    }
    return false;
  }

  function circleHitsTri(cx, cy, r, x1, y1, x2, y2, x3, y3) {
    if (pointInTri(cx, cy, x1, y1, x2, y2, x3, y3)) return true;
    // Cheap edge proximity
    return (
      distToSeg(cx, cy, x1, y1, x2, y2) < r ||
      distToSeg(cx, cy, x2, y2, x3, y3) < r ||
      distToSeg(cx, cy, x3, y3, x1, y1) < r
    );
  }

  function distToSeg(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len2 = dx * dx + dy * dy || 1;
    let t = ((px - x1) * dx + (py - y1) * dy) / len2;
    t = clamp(t, 0, 1);
    return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
  }

  function dist2(ax, ay, bx, by) {
    const dx = ax - bx;
    const dy = ay - by;
    return dx * dx + dy * dy;
  }

  function pointInTri(px, py, x1, y1, x2, y2, x3, y3) {
    const d1 = sign(px, py, x1, y1, x2, y2);
    const d2 = sign(px, py, x2, y2, x3, y3);
    const d3 = sign(px, py, x3, y3, x1, y1);
    const hasNeg = d1 < 0 || d2 < 0 || d3 < 0;
    const hasPos = d1 > 0 || d2 > 0 || d3 > 0;
    return !(hasNeg && hasPos);
  }

  function sign(px, py, x1, y1, x2, y2) {
    return (px - x2) * (y1 - y2) - (x1 - x2) * (py - y2);
  }

  function update(dt) {
    if (!running || paused || dead || won) return;
    const h = canvas.clientHeight;
    worldX += speed() * dt;
    if (mode === "endless") extendEndless(worldX + 2200);

    const targetVy = holding ? CLIMB_VY : FALL_VY;
    shipVy += (targetVy - shipVy) * Math.min(1, STEER * dt);
    shipVy = clamp(shipVy, -MAX_VY, MAX_VY);
    shipY += (shipVy * dt * MOVE_SCALE) / h;
    shipY = clamp(shipY, 0.02, 0.98);

    trail.push({ x: worldX, y: shipY });
    if (trail.length > 28) trail.shift();

    if (mode === "classic" && worldX >= pathEnd() - 20) {
      finishLevel();
      return;
    }
    if (collide()) kill();
    paintHud();
    if (flash > 0) flash = Math.max(0, flash - dt * 3);
    if (shake > 0) shake = Math.max(0, shake - dt * 30);
  }

  function draw() {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    const theme = themeColor();
    const ox = shake ? (Math.random() - 0.5) * shake : 0;
    const oy = shake ? (Math.random() - 0.5) * shake : 0;

    ctx.save();
    ctx.translate(ox, oy);
    ctx.clearRect(-20, -20, w + 40, h + 40);

    // stars
    ctx.fillStyle = "#04060f";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "rgba(200,220,255,0.55)";
    for (let i = 0; i < 40; i++) {
      const sx = ((i * 97 + worldX * 0.15) % (w + 40)) - 20;
      const sy = (i * 53) % h;
      ctx.fillRect(sx, sy, i % 5 === 0 ? 2 : 1, i % 5 === 0 ? 2 : 1);
    }

    const path = activePath();
    const viewLeft = worldX - w * SHIP_SCREEN_X;
    const viewRight = viewLeft + w + 40;

    // open tunnel band
    ctx.beginPath();
    let started = false;
    for (let x = viewLeft; x <= viewRight; x += 10) {
      const s = samplePath(path, x);
      const sx = x - viewLeft;
      if (!started) {
        ctx.moveTo(sx, s.top * h);
        started = true;
      } else ctx.lineTo(sx, s.top * h);
    }
    for (let x = viewRight; x >= viewLeft; x -= 10) {
      const s = samplePath(path, x);
      ctx.lineTo(x - viewLeft, s.bot * h);
    }
    ctx.closePath();
    const glow = ctx.createLinearGradient(0, 0, w, 0);
    glow.addColorStop(0, "rgba(20, 40, 80, 0.35)");
    glow.addColorStop(0.5, "rgba(40, 20, 70, 0.22)");
    glow.addColorStop(1, "rgba(20, 40, 80, 0.35)");
    ctx.fillStyle = glow;
    ctx.fill();

    // solid walls (outside the tunnel)
    ctx.fillStyle = "#070b18";
    ctx.beginPath();
    ctx.moveTo(0, 0);
    for (let x = viewLeft; x <= viewRight; x += 8) {
      const s = samplePath(path, x);
      ctx.lineTo(x - viewLeft, s.top * h);
    }
    ctx.lineTo(w, 0);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(0, h);
    for (let x = viewLeft; x <= viewRight; x += 8) {
      const s = samplePath(path, x);
      ctx.lineTo(x - viewLeft, s.bot * h);
    }
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fill();

    // neon edges
    ctx.strokeStyle = theme;
    ctx.lineWidth = 3;
    ctx.shadowColor = theme;
    ctx.shadowBlur = 12;
    ctx.beginPath();
    for (let x = viewLeft; x <= viewRight; x += 8) {
      const s = samplePath(path, x);
      const sx = x - viewLeft;
      if (x === viewLeft) ctx.moveTo(sx, s.top * h);
      else ctx.lineTo(sx, s.top * h);
    }
    ctx.stroke();
    ctx.beginPath();
    for (let x = viewLeft; x <= viewRight; x += 8) {
      const s = samplePath(path, x);
      const sx = x - viewLeft;
      if (x === viewLeft) ctx.moveTo(sx, s.bot * h);
      else ctx.lineTo(sx, s.bot * h);
    }
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Draw one hazard per marked path point (matches collide X window)
    for (let i = 0; i < path.length; i++) {
      const p = path[i];
      if (!p.haz || p.x < viewLeft - 30 || p.x > viewRight + 30) continue;
      // Skip duplicate marks for the same hazard cluster
      if (i > 0 && path[i - 1].haz === p.haz && Math.abs(path[i - 1].x - p.x) < HAZ_X) continue;
      const sx = p.x - viewLeft;
      const topY = p.top * h;
      const botY = p.bot * h;
      const gap = botY - topY;
      const spikeH = Math.min(gap * 0.22, h * 0.055);

      if (p.haz === "top" || p.haz === "both") {
        ctx.fillStyle = theme;
        ctx.beginPath();
        ctx.moveTo(sx - 9, topY);
        ctx.lineTo(sx + 9, topY);
        ctx.lineTo(sx, topY + spikeH);
        ctx.closePath();
        ctx.fill();
      }
      if (p.haz === "bot" || p.haz === "both") {
        ctx.fillStyle = theme;
        ctx.beginPath();
        ctx.moveTo(sx - 9, botY);
        ctx.lineTo(sx + 9, botY);
        ctx.lineTo(sx, botY - spikeH);
        ctx.closePath();
        ctx.fill();
      }
      if (p.haz === "gate" && p.gateY != null) {
        const gy = p.gateY * h;
        const gh = Math.max(10, (p.gateH || 0.08) * h);
        const gw = Math.max(12, h * 0.032);
        ctx.fillStyle = theme;
        ctx.shadowColor = theme;
        ctx.shadowBlur = 10;
        ctx.fillRect(sx - gw, gy - gh / 2, gw * 2, gh);
        ctx.shadowBlur = 0;
        ctx.fillStyle = "rgba(5,8,20,0.55)";
        ctx.fillRect(sx - gw + 3, gy - gh / 2 + 2, gw * 2 - 6, gh - 4);
      }
      if (p.haz === "diamond" && p.diaY != null) {
        const dy = p.diaY * h;
        const ds = Math.max(8, (p.diaS || 0.05) * h);
        ctx.fillStyle = "#fff6c8";
        ctx.shadowColor = theme;
        ctx.shadowBlur = 14;
        ctx.beginPath();
        ctx.moveTo(sx, dy - ds);
        ctx.lineTo(sx + ds, dy);
        ctx.lineTo(sx, dy + ds);
        ctx.lineTo(sx - ds, dy);
        ctx.closePath();
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = theme;
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      if (p.haz === "door" && p.doorY != null) {
        const dy = p.doorY * h;
        const dh = Math.max(gap * 0.62, (p.doorH || 0.18) * h);
        const dw = Math.max(16, h * 0.03);
        const openTop = dy - dh / 2;
        const openBot = dy + dh / 2;
        ctx.fillStyle = theme;
        ctx.globalAlpha = 0.92;
        ctx.shadowColor = theme;
        ctx.shadowBlur = 12;
        ctx.fillRect(sx - dw, topY, dw * 2, Math.max(0, openTop - topY));
        ctx.fillRect(sx - dw, openBot, dw * 2, Math.max(0, botY - openBot));
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;
        ctx.strokeStyle = "#fff6c8";
        ctx.lineWidth = 2;
        ctx.strokeRect(sx - dw, openTop, dw * 2, dh);
      }
    }

    // finish line
    if (mode === "classic") {
      const end = pathEnd();
      const fx = end - viewLeft;
      if (fx > -20 && fx < w + 20) {
        ctx.strokeStyle = "#5dff9f";
        ctx.lineWidth = 4;
        ctx.setLineDash([10, 8]);
        ctx.beginPath();
        ctx.moveTo(fx, 0);
        ctx.lineTo(fx, h);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    // trail
    const box = shipHitbox();
    const s = box.scale;
    for (let i = 0; i < trail.length; i++) {
      const t = trail[i];
      const tx = t.x - viewLeft;
      const ty = t.y * h;
      const a = (i + 1) / trail.length;
      ctx.fillStyle = `rgba(92, 225, 255, ${a * 0.4})`;
      ctx.beginPath();
      ctx.arc(tx, ty, (3.5 + a * 3.5) * Math.min(1.2, s * 0.7), 0, Math.PI * 2);
      ctx.fill();
    }

    // ship arrow (scaled up)
    const ang = Math.atan2(shipVy * 0.9, 1.6);
    ctx.save();
    ctx.translate(box.x, box.y);
    ctx.rotate(ang);
    ctx.scale(s, s);
    ctx.fillStyle = "#fff";
    ctx.shadowColor = theme;
    ctx.shadowBlur = 18;
    ctx.beginPath();
    ctx.moveTo(16, 0);
    ctx.lineTo(-12, 9);
    ctx.lineTo(-7, 0);
    ctx.lineTo(-12, -9);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = theme;
    ctx.beginPath();
    ctx.moveTo(4, 0);
    ctx.lineTo(-8, 5);
    ctx.lineTo(-5, 0);
    ctx.lineTo(-8, -5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    if (flash > 0) {
      ctx.fillStyle = `rgba(255,80,120,${flash * 0.35})`;
      ctx.fillRect(0, 0, w, h);
    }

    ctx.restore();
  }

  function loop(ts) {
    raf = requestAnimationFrame(loop);
    const dt = Math.min(0.033, (ts - lastTs) / 1000 || 0.016);
    lastTs = ts;
    update(dt);
    draw();
  }

  function setHold(v) {
    holding = !!v;
  }

  function isTypingTarget(el) {
    if (!el) return false;
    const tag = String(el.tagName || "").toUpperCase();
    return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || !!el.isContentEditable;
  }

  function isFlyKey(e) {
    return (
      e.code === "Space" ||
      e.key === " " ||
      e.key === "Spacebar" ||
      e.code === "KeyW" ||
      e.code === "ArrowUp" ||
      e.key === "w" ||
      e.key === "W" ||
      e.key === "ArrowUp"
    );
  }

  function onFlyKeyDown(e) {
    if (!isFlyKey(e)) {
      if (e.code === "KeyP" || e.key === "p" || e.key === "P") {
        if (isTypingTarget(e.target)) return;
        if (running && !dead && !won) {
          e.preventDefault();
          if (paused) {
            hideOverlay();
            lastTs = performance.now();
          } else showOverlay("pause");
        }
      }
      return;
    }
    if (isTypingTarget(e.target)) return;
    e.preventDefault();
    if (typeof e.stopPropagation === "function") e.stopPropagation();
    if (e.repeat) {
      setHold(true);
      return;
    }
    // Mid-run pause: Space resumes and rises
    if (paused && running && !dead && !won) {
      hideOverlay();
      lastTs = performance.now();
      setHold(true);
      return;
    }
    // Menu / crash / win screen: Space starts a run
    if (!running || dead || won) {
      startGame();
      setHold(true);
      return;
    }
    setHold(true);
  }

  function onFlyKeyUp(e) {
    if (!isFlyKey(e)) return;
    if (isTypingTarget(e.target)) return;
    e.preventDefault();
    setHold(false);
  }

  // Capture so Space isn't eaten by focused buttons / page scroll
  window.addEventListener("keydown", onFlyKeyDown, true);
  window.addEventListener("keyup", onFlyKeyUp, true);

  canvas.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    canvas.setPointerCapture?.(e.pointerId);
    if (!running || dead || won) startGame();
    setHold(true);
  });
  canvas.addEventListener("pointerup", () => setHold(false));
  canvas.addEventListener("pointercancel", () => setHold(false));
  canvas.addEventListener("lostpointercapture", () => setHold(false));
  window.addEventListener("blur", () => setHold(false));

  document.querySelectorAll("[data-mode]").forEach((btn) => {
    btn.addEventListener("click", () => {
      mode = btn.dataset.mode || "classic";
      document.querySelectorAll("[data-mode]").forEach((b) => b.classList.toggle("active", b === btn));
      if (overlayKind === "win" || overlayKind === "dead") overlayKind = "menu";
      renderLevelPicker();
      paintHud();
      syncStartLabel();
    });
  });

  els.start.addEventListener("click", () => {
    // Win screen primary button advances one level (picking a tile cancels this)
    if (overlayKind === "win" && mode === "classic" && levelIndex < LEVELS.length - 1) {
      levelIndex += 1;
    }
    startGame();
  });
  els.retry.addEventListener("click", () => startGame());
  els.resume.addEventListener("click", () => {
    if (dead || won || !running) {
      startGame();
      return;
    }
    hideOverlay();
    lastTs = performance.now();
    running = true;
    paused = false;
  });
  els.menu.addEventListener("click", () => {
    if (running && !dead && !won) showOverlay("pause");
    else showOverlay("menu");
  });
  els.games.addEventListener("click", () => {
    window.location.href = "../index.html#games";
  });

  window.addEventListener("resize", resize);

  // boot — start on first unlocked unfinished level
  if (bestLevel > 0 && bestLevel < LEVELS.length) {
    levelIndex = bestLevel; // next unlocked (0-based: cleared id N → index N)
  } else if (bestLevel >= LEVELS.length) {
    levelIndex = 0;
  }

  resize();
  renderLevelPicker();
  paintHud();
  showOverlay("menu");
  raf = requestAnimationFrame(loop);
})();
