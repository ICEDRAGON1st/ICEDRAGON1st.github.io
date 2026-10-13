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
    start: document.getElementById("start-btn"),
    resume: document.getElementById("resume-btn"),
    retry: document.getElementById("retry-btn"),
    games: document.getElementById("games-btn")
  };

  /**
   * Each classic level uses a different layout + hazard style.
   * Hazards: none | both | top | bot | gate | diamond
   */
  const LEVELS = [
    { id: 1, name: "Warmup", diff: "easy", speed: 255, theme: "#5ce1ff", path: buildWarmup() },
    { id: 2, name: "Steps", diff: "easy", speed: 270, theme: "#5dff9f", path: buildSteps() },
    { id: 3, name: "Breath", diff: "easy", speed: 280, theme: "#7aefff", path: buildBreath() },
    { id: 4, name: "Teeth", diff: "medium", speed: 290, theme: "#ffd24a", path: buildTeeth() },
    { id: 5, name: "Gates", diff: "medium", speed: 300, theme: "#ffb347", path: buildGates() },
    { id: 6, name: "Slalom", diff: "medium", speed: 310, theme: "#ff9f6b", path: buildSlalom() },
    { id: 7, name: "Saw", diff: "hard", speed: 320, theme: "#ff7a96", path: buildSaw() },
    { id: 8, name: "Diamonds", diff: "hard", speed: 330, theme: "#ff5a78", path: buildDiamonds() },
    { id: 9, name: "Shelf", diff: "hard", speed: 335, theme: "#ff4fd8", path: buildShelf() },
    { id: 10, name: "Weave", diff: "extreme", speed: 345, theme: "#d46bff", path: buildWeave() },
    { id: 11, name: "Gauntlet", diff: "extreme", speed: 355, theme: "#a78bfa", path: buildGauntlet() },
    { id: 12, name: "Singularity", diff: "extreme", speed: 365, theme: "#ff4fd8", path: buildSingularity() }
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
        diaS: p.diaS
      };
    });
  }

  function fillPath(len, step, fn) {
    const pts = [];
    for (let x = 0; x <= len; x += step) pts.push(fn(x));
    return finalizePath(pts);
  }

  /** 1 — gentle open tunnel */
  function buildWarmup() {
    return fillPath(2800, 36, (x) => {
      const mid = 0.5 + Math.sin(x * 0.002) * 0.06;
      const c = corridor(mid, 0.44);
      return { x, ...c, haz: null };
    });
  }

  /** 2 — terrace / step midlines (unique feel) */
  function buildSteps() {
    return fillPath(3200, 28, (x) => {
      const step = Math.floor(x / 380);
      const mid = 0.5 + ((step % 2 === 0 ? -1 : 1) * 0.1);
      const c = corridor(mid, 0.4);
      return { x, ...c, haz: null };
    });
  }

  /** 3 — breathing / squeezing corridor, no spikes */
  function buildBreath() {
    return fillPath(3400, 28, (x) => {
      const wave = (Math.sin(x * 0.0026) + 1) / 2;
      const gap = lerp(0.44, 0.33, wave);
      const mid = 0.5 + Math.sin(x * 0.0014) * 0.07;
      const c = corridor(mid, gap);
      return { x, ...c, haz: null };
    });
  }

  /** 4 — alternating top/bottom teeth only */
  function buildTeeth() {
    return fillPath(3600, 22, (x) => {
      const mid = 0.5 + Math.sin(x * 0.002) * 0.08;
      const c = corridor(mid, 0.38);
      let haz = null;
      if (x > 480 && x % 340 < 40) haz = x % 680 < 340 ? "top" : "bot";
      return { x, ...c, haz };
    });
  }

  /** 5 — floating gate bars (weave above/below) */
  function buildGates() {
    return fillPath(3800, 24, (x) => {
      const mid = 0.5 + Math.sin(x * 0.0016) * 0.05;
      const c = corridor(mid, 0.4);
      let haz = null;
      let gateY;
      let gateH = 0.08;
      if (x > 520 && x % 420 < 46) {
        haz = "gate";
        const n = Math.floor(x / 420) % 2;
        gateY = n === 0 ? mid - 0.09 : mid + 0.09;
      }
      return { x, ...c, haz, gateY, gateH };
    });
  }

  /** 6 — slalom: corridor shifts hard L/R with spaced gates */
  function buildSlalom() {
    return fillPath(4000, 24, (x) => {
      const phase = Math.sin(x * 0.0042);
      const mid = 0.5 + phase * 0.14;
      const c = corridor(mid, 0.36);
      let haz = null;
      let gateY;
      let gateH = 0.075;
      if (x > 600 && x % 500 < 42) {
        haz = "gate";
        gateY = mid - phase * 0.06;
      }
      return { x, ...c, haz, gateY, gateH };
    });
  }

  /** 7 — dense alternating teeth on a mild zig */
  function buildSaw() {
    return fillPath(4200, 22, (x) => {
      const t = (x % 360) / 360;
      const tri = t < 0.5 ? t * 2 : 2 - t * 2;
      const mid = 0.5 + (tri - 0.5) * 0.22;
      const c = corridor(mid, 0.34);
      let haz = null;
      if (x > 500 && x % 220 < 34) haz = Math.floor(x / 220) % 2 === 0 ? "top" : "bot";
      return { x, ...c, haz };
    });
  }

  /** 8 — diamond blocks floating in the tunnel */
  function buildDiamonds() {
    return fillPath(4400, 24, (x) => {
      const mid = 0.5 + Math.sin(x * 0.0022) * 0.07;
      const c = corridor(mid, 0.38);
      let haz = null;
      let diaY;
      let diaS = 0.055;
      if (x > 560 && x % 460 < 48) {
        haz = "diamond";
        diaY = mid + (Math.floor(x / 460) % 2 === 0 ? -0.07 : 0.07);
      }
      return { x, ...c, haz, diaY, diaS };
    });
  }

  /** 9 — shelf: corridor jumps to high/low terraces with edge teeth */
  function buildShelf() {
    return fillPath(4600, 24, (x) => {
      const base = 0.5 + Math.sin(x * 0.0012) * 0.04;
      let mid = base;
      let gap = 0.36;
      let haz = null;
      if (x > 400) {
        const local = (x - 400) % 520;
        if (local < 180) {
          mid = base + 0.09;
          gap = 0.34;
          if (local < 36) haz = "top";
        } else if (local > 260 && local < 440) {
          mid = base - 0.09;
          gap = 0.34;
          if (local < 300) haz = "bot";
        }
      }
      const c = corridor(mid, gap);
      return { x, ...c, haz };
    });
  }

  /** 10 — weave: gates + gentle sine */
  function buildWeave() {
    return fillPath(4800, 22, (x) => {
      const mid = 0.5 + Math.sin(x * 0.0035) * 0.11;
      const c = corridor(mid, 0.33);
      let haz = null;
      let gateY;
      let gateH = 0.07;
      if (x > 580 && x % 380 < 40) {
        haz = "gate";
        gateY = mid + (Math.floor(x / 380) % 2 === 0 ? 0.08 : -0.08);
      }
      return { x, ...c, haz, gateY, gateH };
    });
  }

  /** 11 — gauntlet: teeth then diamond then gate repeating */
  function buildGauntlet() {
    return fillPath(5000, 22, (x) => {
      const mid = 0.5 + Math.sin(x * 0.002) * 0.08;
      const c = corridor(mid, 0.32);
      let haz = null;
      let gateY;
      let gateH = 0.07;
      let diaY;
      let diaS = 0.05;
      if (x > 620) {
        const slot = Math.floor(x / 300) % 3;
        const local = x % 300;
        if (local < 36) {
          if (slot === 0) haz = Math.floor(x / 900) % 2 === 0 ? "top" : "bot";
          if (slot === 1) {
            haz = "diamond";
            diaY = mid + (Math.floor(x / 300) % 2 === 0 ? -0.06 : 0.06);
          }
          if (slot === 2) {
            haz = "gate";
            gateY = mid - (Math.floor(x / 300) % 2 === 0 ? 0.07 : -0.07);
          }
        }
      }
      return { x, ...c, haz, gateY, gateH, diaY, diaS };
    });
  }

  /** 12 — singularity: tighter mix, still clears MIN_GAP */
  function buildSingularity() {
    return fillPath(5200, 20, (x) => {
      const mid = 0.5 + Math.sin(x * 0.0038) * 0.1 + Math.sin(x * 0.0011) * 0.04;
      const gap = lerp(0.36, 0.31, (Math.sin(x * 0.002) + 1) / 2);
      const c = corridor(mid, gap);
      let haz = null;
      let gateY;
      let gateH = 0.065;
      let diaY;
      let diaS = 0.048;
      if (x > 700) {
        const local = x % 260;
        if (local < 32) {
          const kind = Math.floor(x / 260) % 4;
          if (kind === 0) haz = "top";
          else if (kind === 1) haz = "bot";
          else if (kind === 2) {
            haz = "diamond";
            diaY = mid;
          } else {
            haz = "gate";
            gateY = mid + (Math.floor(x / 520) % 2 === 0 ? 0.07 : -0.07);
          }
        }
      }
      return { x, ...c, haz, gateY, gateH, diaY, diaS };
    });
  }

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
    const near = t < 0.5 ? a : b;
    return {
      top: lerp(a.top, b.top, t),
      bot: lerp(a.bot, b.bot, t),
      haz: near.haz || null,
      gateY: near.gateY,
      gateH: near.gateH,
      diaY: near.diaY,
      diaS: near.diaS
    };
  }

  let mode = "classic";
  let levelIndex = 0;
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

  function persistHigh(n) {
    bestDist = Math.max(bestDist, Math.floor(n));
    try {
      localStorage.setItem(HIGH_KEY, String(bestDist));
    } catch {}
    try {
      window.HubLeaderboard?.submit?.(GAME_ID, bestDist);
    } catch {}
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
    els.mode.textContent = mode === "endless" ? "Endless" : `Lv ${currentLevel().id}`;
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
    els.picker.innerHTML = "";
    els.picker.classList.toggle("hidden", mode !== "classic");
    if (mode !== "classic") return;
    LEVELS.forEach((lv, i) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `lvl-btn is-${lv.diff}` + (i === levelIndex ? " active" : "");
      btn.textContent = String(lv.id);
      btn.title = `${lv.name} · ${lv.diff}`;
      btn.addEventListener("click", () => {
        levelIndex = i;
        renderLevelPicker();
        paintHud();
      });
      els.picker.appendChild(btn);
    });
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
      buildBreath,
      buildTeeth,
      buildGates,
      buildSlalom,
      buildSaw,
      buildDiamonds,
      buildShelf,
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
    paused = true;
    els.overlay.classList.remove("hidden");
    els.resume.classList.add("hidden");
    els.retry.classList.add("hidden");
    if (kind === "pause") {
      els.title.textContent = "Paused";
      els.text.textContent = "Hold to rise, release to fall. Watch for teeth, gates, and diamonds.";
      els.resume.classList.remove("hidden");
      els.start.textContent = "Restart";
    } else if (kind === "dead") {
      const dist = Math.floor(worldX);
      els.title.textContent = "Crashed";
      els.text.textContent =
        mode === "endless"
          ? `You made it ${dist}m. Instant retry — find the rhythm.`
          : `Reached ${Math.floor(clamp((worldX / pathEnd()) * 100, 0, 99))}% of ${currentLevel().name}.`;
      els.retry.classList.remove("hidden");
      els.start.textContent = mode === "classic" ? "Pick level" : "Play again";
    } else if (kind === "win") {
      els.title.textContent = "Cleared!";
      els.text.textContent = `${currentLevel().name} complete. Next tunnel awaits.`;
      els.retry.classList.remove("hidden");
      els.retry.textContent = "Replay";
      els.start.textContent = levelIndex < LEVELS.length - 1 ? "Next level" : "Play again";
      try {
        window.HubConfetti?.burst?.();
      } catch {}
    } else {
      els.title.textContent = "Space Waves";
      els.text.textContent =
        "Hold to fly up, release to drop. Each level has unique hazards — teeth, gates, diamonds, shelves.";
      els.start.textContent = "Play";
      els.retry.textContent = "Retry";
    }
    renderLevelPicker();
    paintHud();
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
    try {
      localStorage.setItem(BEST_LEVEL_KEY, String(Math.max(levelIndex + 1, Number(localStorage.getItem(BEST_LEVEL_KEY) || 0))));
    } catch {}
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
    // A touch larger than the original tiny arrow
    return { x: sx, y: sy, r: Math.max(7, h * 0.018), scale: Math.max(1.05, h * 0.0026) };
  }

  function collide() {
    const h = canvas.clientHeight;
    const sample = samplePath(activePath(), worldX);
    const topY = sample.top * h;
    const botY = sample.bot * h;
    const box = shipHitbox();
    if (box.y - box.r < topY || box.y + box.r > botY) return true;

    const gap = botY - topY;
    const spikeH = Math.min(gap * 0.3, h * 0.075);
    const hw = 11;

    if (sample.haz === "top" || sample.haz === "both") {
      const tip = topY + spikeH;
      if (pointInTri(box.x, box.y, box.x - hw, topY, box.x + hw, topY, box.x, tip)) return true;
    }
    if (sample.haz === "bot" || sample.haz === "both") {
      const tip = botY - spikeH;
      if (pointInTri(box.x, box.y, box.x - hw, botY, box.x + hw, botY, box.x, tip)) return true;
    }
    if (sample.haz === "gate" && sample.gateY != null) {
      const gy = sample.gateY * h;
      const gh = Math.max(10, (sample.gateH || 0.08) * h);
      if (box.y + box.r > gy - gh / 2 && box.y - box.r < gy + gh / 2) return true;
    }
    if (sample.haz === "diamond" && sample.diaY != null) {
      const dy = sample.diaY * h;
      const ds = Math.max(10, (sample.diaS || 0.05) * h);
      if (Math.abs(box.y - dy) < box.r + ds * 0.85) return true;
    }
    return false;
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

    // hazards
    for (let x = Math.floor(viewLeft / 20) * 20; x <= viewRight; x += 20) {
      const s = samplePath(path, x);
      if (!s.haz) continue;
      const sx = x - viewLeft;
      const topY = s.top * h;
      const botY = s.bot * h;
      const gap = botY - topY;
      const spikeH = Math.min(gap * 0.3, h * 0.075);

      if (s.haz === "top" || s.haz === "both") {
        ctx.fillStyle = theme;
        ctx.beginPath();
        ctx.moveTo(sx - 11, topY);
        ctx.lineTo(sx + 11, topY);
        ctx.lineTo(sx, topY + spikeH);
        ctx.closePath();
        ctx.fill();
      }
      if (s.haz === "bot" || s.haz === "both") {
        ctx.fillStyle = theme;
        ctx.beginPath();
        ctx.moveTo(sx - 11, botY);
        ctx.lineTo(sx + 11, botY);
        ctx.lineTo(sx, botY - spikeH);
        ctx.closePath();
        ctx.fill();
      }
      if (s.haz === "gate" && s.gateY != null) {
        const gy = s.gateY * h;
        const gh = Math.max(10, (s.gateH || 0.08) * h);
        const gw = Math.max(12, h * 0.032);
        ctx.fillStyle = theme;
        ctx.shadowColor = theme;
        ctx.shadowBlur = 10;
        ctx.fillRect(sx - gw, gy - gh / 2, gw * 2, gh);
        ctx.shadowBlur = 0;
        ctx.fillStyle = "rgba(5,8,20,0.55)";
        ctx.fillRect(sx - gw + 3, gy - gh / 2 + 2, gw * 2 - 6, gh - 4);
      }
      if (s.haz === "diamond" && s.diaY != null) {
        const dy = s.diaY * h;
        const ds = Math.max(10, (s.diaS || 0.05) * h);
        ctx.fillStyle = theme;
        ctx.shadowColor = theme;
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.moveTo(sx, dy - ds);
        ctx.lineTo(sx + ds, dy);
        ctx.lineTo(sx, dy + ds);
        ctx.lineTo(sx - ds, dy);
        ctx.closePath();
        ctx.fill();
        ctx.shadowBlur = 0;
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
      renderLevelPicker();
      paintHud();
    });
  });

  els.start.addEventListener("click", () => {
    if (won && mode === "classic" && levelIndex < LEVELS.length - 1 && els.start.textContent.includes("Next")) {
      levelIndex += 1;
    }
    startGame();
  });
  els.retry.addEventListener("click", () => startGame());
  els.resume.addEventListener("click", () => {
    if (!running && !dead && !won) startGame();
    else {
      hideOverlay();
      lastTs = performance.now();
      if (!running && !dead && !won) running = true;
      // if paused mid-run
      if (!dead && !won) running = true;
    }
  });
  els.menu.addEventListener("click", () => {
    if (running && !dead && !won) showOverlay("pause");
    else showOverlay("menu");
  });
  els.games.addEventListener("click", () => {
    window.location.href = "../index.html#games";
  });

  window.addEventListener("resize", resize);

  // boot
  resize();
  renderLevelPicker();
  paintHud();
  showOverlay("menu");
  raf = requestAnimationFrame(loop);
})();
