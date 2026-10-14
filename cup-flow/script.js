(() => {
  const GAME_ID = "cup";
  const HIGH_KEY = "cup-flow-high-score";
  const BEST_LEVEL_KEY = "cup-flow-best-level";
  const SPEED_KEY = "cup-flow-speed-scale";

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");

  const els = {
    menu: document.getElementById("menu-btn"),
    level: document.getElementById("hud-level"),
    fill: document.getElementById("hud-fill"),
    ink: document.getElementById("hud-ink"),
    best: document.getElementById("hud-best"),
    hint: document.getElementById("hint"),
    undo: document.getElementById("undo-btn"),
    clear: document.getElementById("clear-btn"),
    pour: document.getElementById("pour-btn"),
    reset: document.getElementById("reset-btn"),
    overlay: document.getElementById("overlay"),
    title: document.getElementById("overlay-title"),
    text: document.getElementById("overlay-text"),
    overlayBest: document.getElementById("overlay-best"),
    picker: document.getElementById("level-picker"),
    levelMeta: document.getElementById("level-meta"),
    start: document.getElementById("start-btn"),
    resume: document.getElementById("resume-btn"),
    retry: document.getElementById("retry-btn"),
    games: document.getElementById("games-btn")
  };

  /**
   * 100 levels from levels-data.js (generated + verified by tools/gen-cup-levels.js).
   * Coords are normalized 0–1 of the playfield.
   */
  const LEVELS =
    Array.isArray(window.CUP_FLOW_LEVELS) && window.CUP_FLOW_LEVELS.length
      ? window.CUP_FLOW_LEVELS
      : [
          {
            id: 1,
            name: "First Drop",
            ink: 1.4,
            need: 28,
            tap: { x: 0.22, y: 0.12 },
            cup: { x: 0.72, y: 0.78, w: 0.12, h: 0.14 },
            blocks: []
          }
        ];

  function clamp(n, a, b) {
    return Math.max(a, Math.min(b, n));
  }

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

  let levelIndex = 0;
  let overlayKind = "menu";
  let running = false;
  let paused = false;
  let won = false;
  let pouring = false;
  let recordedPlay = false;
  let bestLevel = readBestLevel();
  let bestScore = readHigh();

  let strokes = []; // [{points:[{x,y}...]}] world 0-1
  let draft = null;
  let drops = [];
  let filled = 0;
  let inkUsed = 0;
  let pourAcc = 0;
  let spill = 0;
  let shake = 0;
  let flash = 0;
  let raf = 0;
  let lastTs = 0;
  let drawing = false;
  let speedScale = readSpeedScale(); // 1 | 0.5 | ~0.333

  function readSpeedScale() {
    try {
      const n = Number(localStorage.getItem(SPEED_KEY));
      if (Math.abs(n - 0.5) < 0.01) return 0.5;
      if (Math.abs(n - 1 / 3) < 0.02) return 1 / 3;
      return 1;
    } catch {
      return 1;
    }
  }

  function setSpeedScale(scale) {
    if (scale <= 0.34) speedScale = 1 / 3;
    else if (scale <= 0.6) speedScale = 0.5;
    else speedScale = 1;
    try {
      localStorage.setItem(SPEED_KEY, String(speedScale));
    } catch {}
    syncSpeedButtons();
  }

  function syncSpeedButtons() {
    document.querySelectorAll(".speed-btn").forEach((btn) => {
      const v = Number(btn.dataset.speed);
      const active =
        (speedScale === 1 && v === 1) ||
        (speedScale === 0.5 && v === 0.5) ||
        (speedScale < 0.4 && v < 0.4);
      btn.classList.toggle("active", active);
    });
  }

  const GRAVITY = 1.55;
  const MAX_DROPS = 220;
  const DROP_R = 0.007;
  const LINE_HALF = 0.011; // collision thickness (matches chunky drawn stroke)
  const MAX_SPEED = 1.75; // fast enough to crest small uphill bits
  const AIR_DRAG = 0.12; // per-second horizontal drag (gentle)
  const SURFACE_DRAG = 0.35; // per-second along strokes (keeps momentum)

  function currentLevel() {
    return LEVELS[levelIndex] || LEVELS[0];
  }

  function inkBudget() {
    return currentLevel().ink || 1;
  }

  function inkLeft() {
    return clamp(1 - inkUsed / inkBudget(), 0, 1);
  }

  function persistBest(levelId) {
    bestLevel = Math.max(bestLevel, levelId);
    bestScore = Math.max(bestScore, levelId);
    try {
      localStorage.setItem(BEST_LEVEL_KEY, String(bestLevel));
      localStorage.setItem(HIGH_KEY, String(bestScore));
    } catch {}
    try {
      window.HubLeaderboard?.submit?.(GAME_ID, bestScore);
    } catch {}
  }

  function paintHud() {
    const lv = currentLevel();
    els.level.textContent = String(lv.id);
    els.fill.textContent = `${Math.floor(clamp((filled / lv.need) * 100, 0, 100))}%`;
    els.ink.textContent = `${Math.floor(inkLeft() * 100)}%`;
    els.best.textContent = String(bestScore);
    els.overlayBest.textContent = String(bestScore);
  }

  function syncPourBtn() {
    els.pour.textContent = pouring ? "Stop" : "Pour";
    els.pour.classList.toggle("is-on", pouring);
  }

  /** Level index unlocked if it's 1 or the previous level was cleared */
  function isLevelUnlocked(index) {
    const id = (LEVELS[index] && LEVELS[index].id) || index + 1;
    return id <= bestLevel + 1;
  }

  function syncStartLabel() {
    if (overlayKind === "pause") {
      els.start.textContent = "Restart";
      return;
    }
    if (overlayKind === "win" && levelIndex < LEVELS.length - 1 && isLevelUnlocked(levelIndex + 1)) {
      els.start.textContent = `Next · ${LEVELS[levelIndex + 1].name}`;
      return;
    }
    const lv = currentLevel();
    els.start.textContent = isLevelUnlocked(levelIndex)
      ? `Play ${lv.id} · ${lv.name}`
      : "Locked";
  }

  function renderLevelPicker() {
    els.picker.innerHTML = "";
    if (!isLevelUnlocked(levelIndex)) {
      levelIndex = Math.min(bestLevel, LEVELS.length - 1);
      levelIndex = Math.max(0, levelIndex);
    }
    const cur = currentLevel();
    if (els.levelMeta) {
      els.levelMeta.textContent = isLevelUnlocked(levelIndex)
        ? `${cur.id} · ${cur.name}`
        : `${cur.id} · Locked`;
    }
    LEVELS.forEach((lv, i) => {
      const unlocked = isLevelUnlocked(i);
      const cleared = lv.id <= bestLevel;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className =
        `lvl-btn` +
        (i === levelIndex ? " active" : "") +
        (cleared ? " cleared" : "") +
        (unlocked ? "" : " locked");
      btn.disabled = !unlocked;
      btn.title = unlocked ? lv.name : `Beat level ${lv.id - 1} to unlock`;
      btn.innerHTML = unlocked
        ? `<span class="lvl-num">${lv.id}</span><span class="lvl-name">${lv.name}</span>`
        : `<span class="lvl-num">${lv.id}</span><span class="lvl-name">Locked</span>`;
      btn.addEventListener("click", () => {
        if (!isLevelUnlocked(i)) return;
        levelIndex = i;
        if (overlayKind === "win" || overlayKind === "dead") overlayKind = "menu";
        renderLevelPicker();
        paintHud();
        syncStartLabel();
      });
      els.picker.appendChild(btn);
    });
    syncStartLabel();
  }

  function strokeLength(pts) {
    let len = 0;
    for (let i = 1; i < pts.length; i++) {
      const dx = pts[i].x - pts[i - 1].x;
      const dy = pts[i].y - pts[i - 1].y;
      len += Math.hypot(dx, dy);
    }
    return len;
  }

  function resetDrops() {
    drops = [];
    filled = 0;
    spill = 0;
    pourAcc = 0;
    pouring = false;
    won = false;
    syncPourBtn();
  }

  function resetInk() {
    strokes = [];
    draft = null;
    inkUsed = 0;
    drawing = false;
  }

  function resetLevel() {
    resetInk();
    resetDrops();
    flash = 0;
    shake = 0;
    paintHud();
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
    resetLevel();
    running = true;
    paused = false;
    hideOverlay();
    lastTs = performance.now();
    if (!raf) raf = requestAnimationFrame(loop);
    els.hint.textContent = "Draw a path · tap Pour · fill the cup";
  }

  function showOverlay(kind) {
    overlayKind = kind || "menu";
    paused = true;
    pouring = false;
    syncPourBtn();
    els.overlay.classList.remove("hidden");
    els.resume.classList.add("hidden");
    els.retry.classList.add("hidden");
    els.retry.textContent = "Retry";

    if (overlayKind === "pause") {
      els.title.textContent = "Paused";
      els.text.textContent = "Keep drawing, clear lines, or restart the level.";
      els.resume.classList.remove("hidden");
    } else if (overlayKind === "dead") {
      els.title.textContent = "Spilled!";
      els.text.textContent = "Too much water missed the cup. Redraw and try again.";
      els.retry.classList.remove("hidden");
    } else if (overlayKind === "win") {
      els.title.textContent = "Cup full!";
      const next = LEVELS[levelIndex + 1];
      els.text.textContent = next
        ? `${currentLevel().name} cleared — next up: ${next.name}.`
        : `${currentLevel().name} cleared — you finished every pour!`;
      els.retry.classList.remove("hidden");
      els.retry.textContent = "Replay";
      try {
        window.HubConfetti?.burst?.();
      } catch {}
    } else {
      els.title.textContent = "Cup Flow";
      els.text.textContent =
        "Draw lines to guide water into the cup. Beat each level to unlock the next (100 total).";
    }
    renderLevelPicker();
    paintHud();
    syncStartLabel();
  }

  function hideOverlay() {
    els.overlay.classList.add("hidden");
    paused = false;
  }

  function finishWin() {
    if (won) return;
    // Must have drawn something — no free wins from an empty board
    if (!strokes.length || inkUsed < 0.04) return;
    won = true;
    pouring = false;
    syncPourBtn();
    running = false;
    persistBest(currentLevel().id);
    try {
      window.HubSound?.play?.("success");
    } catch {}
    try {
      window.HubCoins?.earn?.(25, "win");
    } catch {}
    showOverlay("win");
  }

  function failSpill() {
    if (won || !running) return;
    pouring = false;
    syncPourBtn();
    running = false;
    shake = 8;
    flash = 1;
    try {
      window.HubSound?.play?.("error");
    } catch {}
    setTimeout(() => showOverlay("dead"), 320);
  }

  function resize() {
    const wrap = canvas.parentElement;
    const cssW = Math.max(320, Math.floor(wrap?.clientWidth || 900));
    const cssH = Math.max(200, Math.floor(cssW * (560 / 900)));
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.floor(cssW * dpr);
    canvas.height = Math.floor(cssH * dpr);
    canvas.style.width = `${cssW}px`;
    canvas.style.height = `${cssH}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function canvasSize() {
    return { w: canvas.clientWidth || 900, h: canvas.clientHeight || 560 };
  }

  function toNorm(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: clamp((clientX - rect.left) / Math.max(1, rect.width), 0, 1),
      y: clamp((clientY - rect.top) / Math.max(1, rect.height), 0, 1)
    };
  }

  function strokeSegments() {
    const segs = [];
    const pushStroke = (pts) => {
      for (let i = 1; i < pts.length; i++) {
        segs.push({ a: pts[i - 1], b: pts[i] });
      }
    };
    strokes.forEach((s) => pushStroke(s.points));
    if (draft && draft.points.length > 1) pushStroke(draft.points);
    return segs;
  }

  /** Rotated blocks still use edge segments; AABB blocks are solid boxes */
  function rotatedBlockSegments() {
    const segs = [];
    (currentLevel().blocks || []).forEach((b) => {
      const rot = b.rot || 0;
      if (Math.abs(rot) < 0.001) return;
      const cx = b.x + b.w / 2;
      const cy = b.y + b.h / 2;
      const hw = b.w / 2;
      const hh = b.h / 2;
      const cos = Math.cos(rot);
      const sin = Math.sin(rot);
      const corners = [
        [-hw, -hh],
        [hw, -hh],
        [hw, hh],
        [-hw, hh]
      ].map(([lx, ly]) => ({
        x: cx + lx * cos - ly * sin,
        y: cy + lx * sin + ly * cos
      }));
      for (let i = 0; i < 4; i++) {
        segs.push({ a: corners[i], b: corners[(i + 1) % 4] });
      }
    });
    return segs;
  }

  function solidBlocks() {
    return (currentLevel().blocks || []).filter((b) => Math.abs(b.rot || 0) < 0.001);
  }

  function distToSeg(px, py, ax, ay, bx, by) {
    const dx = bx - ax;
    const dy = by - ay;
    const len2 = dx * dx + dy * dy || 1;
    let t = ((px - ax) * dx + (py - ay) * dy) / len2;
    t = clamp(t, 0, 1);
    const qx = ax + t * dx;
    const qy = ay + t * dy;
    return { d: Math.hypot(px - qx, py - qy), qx, qy, t, nx: -dy, ny: dx };
  }

  function cross2(ax, ay, bx, by) {
    return ax * by - ay * bx;
  }

  function segHitT(ax, ay, bx, by, cx, cy, dx, dy) {
    const rx = bx - ax;
    const ry = by - ay;
    const sx = dx - cx;
    const sy = dy - cy;
    const den = cross2(rx, ry, sx, sy);
    if (Math.abs(den) < 1e-10) return null;
    const qpx = cx - ax;
    const qpy = cy - ay;
    const t = cross2(qpx, qpy, sx, sy) / den;
    const u = cross2(qpx, qpy, rx, ry) / den;
    if (t >= 0 && t <= 1 && u >= 0 && u <= 1) return t;
    return null;
  }

  function clampSpeed(d) {
    const sp = Math.hypot(d.vx, d.vy);
    if (sp > MAX_SPEED) {
      d.vx = (d.vx / sp) * MAX_SPEED;
      d.vy = (d.vy / sp) * MAX_SPEED;
    }
  }

  /** @returns {{nx,ny}|null} contact normal if touching */
  function resolveAgainstSeg(d, s, radius) {
    const hit = distToSeg(d.x, d.y, s.a.x, s.a.y, s.b.x, s.b.y);
    // Mild shrink near endpoints so corners don’t pocket — keep enough thickness
    const endFade = hit.t < 0.1 || hit.t > 0.9 ? 0.78 : 1;
    const rad = radius * endFade;
    if (hit.d >= rad) return null;

    let nx = hit.nx;
    let ny = hit.ny;
    const nlen = Math.hypot(nx, ny) || 1;
    nx /= nlen;
    ny /= nlen;

    const toDropX = d.x - hit.qx;
    const toDropY = d.y - hit.qy;
    if (toDropX * nx + toDropY * ny < 0) {
      nx = -nx;
      ny = -ny;
    } else if (Math.abs(toDropX) + Math.abs(toDropY) < 1e-8) {
      if (d.vx * nx + d.vy * ny > 0) {
        nx = -nx;
        ny = -ny;
      }
    }

    d.x = hit.qx + nx * rad;
    d.y = hit.qy + ny * rad;

    // Kill only penetrating normal — keep full tangential momentum
    // (downhill builds speed via gravity; uphill bleeds it naturally)
    const vn = d.vx * nx + d.vy * ny;
    if (vn < 0) {
      d.vx -= vn * nx;
      d.vy -= vn * ny;
    }

    // Soft settle only on nearly flat floors when almost stopped
    const spd = Math.hypot(d.vx, d.vy);
    if (ny < -0.85 && spd < 0.05 && d.vy > -0.02) d.vy = 0;

    clampSpeed(d);
    return { nx, ny };
  }

  /**
   * Solid box collision.
   * Thin shelves must never let a drop tunnel underneath — if we entered from
   * above (or swept through the top face), always eject to the top.
   */
  function resolveAABB(d, b, r, prevY) {
    const left = b.x - r;
    const right = b.x + b.w + r;
    const top = b.y - r;
    const bot = b.y + b.h + r;
    const overX = d.x > b.x - r * 0.2 && d.x < b.x + b.w + r * 0.2;

    // Swept top-face hit: was above, now at/below top while still over the slab
    if (
      prevY != null &&
      overX &&
      prevY <= top + 0.0005 &&
      d.y > top &&
      d.x > left &&
      d.x < right
    ) {
      d.y = top;
      if (d.vy > 0) d.vy *= 0.12;
      if (d.x > b.x + b.w) d.x = b.x + b.w + r + 0.001;
      else if (d.x < b.x) d.x = b.x - r - 0.001;
      clampSpeed(d);
      return true;
    }

    if (d.x <= left || d.x >= right || d.y <= top || d.y >= bot) return false;

    const ol = d.x - left;
    const orr = right - d.x;
    const ot = d.y - top;
    const ob = bot - d.y;
    let m = Math.min(ol, orr, ot, ob);

    // Coming from above → always land on top (never resolve "under")
    const fromAbove = prevY != null && prevY <= b.y + 0.002 && overX;
    const nearTopCorner = ot < r * 2.2 && (ol < r * 2 || orr < r * 2);
    if (fromAbove || (nearTopCorner && ot <= Math.min(ol, orr) + r * 0.5)) {
      m = ot;
    }
    // Deep tunnel case: fully below center of a flat shelf → snap back to top
    if (b.h < 0.09 && overX && d.y < b.y + b.h + r && prevY != null && prevY < b.y + 0.05) {
      m = ot;
    }

    if (m === ot) {
      d.y = top;
      if (d.vy > 0) d.vy *= 0.12;
      if (d.x > b.x + b.w) d.x = b.x + b.w + r + 0.001;
      else if (d.x < b.x) d.x = b.x - r - 0.001;
    } else if (m === ob) {
      // Only allow underside contact when clearly rising into the block from below
      if (prevY != null && prevY >= bot - 0.001 && d.vy < 0) {
        d.y = bot;
        if (d.vy < 0) d.vy = 0;
      } else if (overX) {
        d.y = top;
        if (d.vy > 0) d.vy *= 0.12;
      } else {
        d.y = bot;
        if (d.vy < 0) d.vy = 0;
      }
    } else if (m === ol) {
      if (d.y < b.y + r * 0.95 || fromAbove) {
        d.y = top;
        if (d.vy > 0) d.vy *= 0.12;
      } else {
        d.x = left;
        if (d.vx > 0) d.vx = 0;
      }
    } else if (d.y < b.y + r * 0.95 || fromAbove) {
      d.y = top;
      if (d.vy > 0) d.vy *= 0.12;
    } else {
      d.x = right;
      if (d.vx < 0) d.vx = 0;
    }
    clampSpeed(d);
    return true;
  }

  function inCup(x, y) {
    const c = currentLevel().cup;
    return x > c.x && x < c.x + c.w && y > c.y && y < c.y + c.h;
  }

  function spawnDrop() {
    if (drops.length >= MAX_DROPS) return;
    const t = currentLevel().tap;
    drops.push({
      x: t.x + (Math.random() - 0.5) * 0.01,
      y: t.y + 0.02,
      vx: (Math.random() - 0.5) * 0.015,
      vy: 0.04 + Math.random() * 0.03,
      alive: true,
      stuck: 0
    });
  }

  function updatePhysics(dt) {
    const segs = strokeSegments().concat(rotatedBlockSegments());
    const boxes = solidBlocks();
    const radius = DROP_R + LINE_HALF;
    const steps = Math.max(6, Math.ceil(dt / 0.005));
    const h = dt / steps;
    const airF = Math.pow(1 - AIR_DRAG, dt);
    const surfF = Math.pow(1 - SURFACE_DRAG, dt);

    for (const d of drops) {
      if (!d.alive) continue;
      let touchedStroke = false;

      for (let step = 0; step < steps; step++) {
        d.vy += GRAVITY * h;
        clampSpeed(d);

        const ox = d.x;
        const oy = d.y;
        const nx = d.x + d.vx * h;
        const ny = d.y + d.vy * h;

        let bestT = 1;
        let bestSeg = null;
        for (let i = 0; i < segs.length; i++) {
          const s = segs[i];
          const t = segHitT(ox, oy, nx, ny, s.a.x, s.a.y, s.b.x, s.b.y);
          if (t != null && t < bestT) {
            bestT = t;
            bestSeg = s;
          }
        }

        if (bestSeg && bestT < 1) {
          const stop = Math.max(0, bestT * 0.9);
          d.x = ox + (nx - ox) * stop;
          d.y = oy + (ny - oy) * stop;
          if (resolveAgainstSeg(d, bestSeg, radius)) touchedStroke = true;
        } else {
          d.x = nx;
          d.y = ny;
        }

        for (let pass = 0; pass < 3; pass++) {
          let hitAny = false;
          for (let i = 0; i < boxes.length; i++) {
            if (resolveAABB(d, boxes[i], DROP_R + 0.004, oy)) hitAny = true;
          }
          for (let i = 0; i < segs.length; i++) {
            if (resolveAgainstSeg(d, segs[i], radius)) {
              hitAny = true;
              touchedStroke = true;
            }
          }
          if (!hitAny) break;
        }
      }

      // Drag once per frame (not per sub-step) so downhill speed can carry uphill
      if (touchedStroke) {
        d.vx *= surfF;
        d.vy *= surfF;
      } else {
        d.vx *= airF;
      }
      clampSpeed(d);

      // Gentle unstick — tiny push, never a launch
      const speed = Math.hypot(d.vx, d.vy);
      if (speed < 0.03) {
        d.stuck = (d.stuck || 0) + dt;
        if (d.stuck > 0.4) {
          d.vy = Math.max(d.vy, 0.06);
          d.vx += (Math.random() - 0.5) * 0.05;
          d.stuck = 0;
          clampSpeed(d);
        }
      } else {
        d.stuck = 0;
      }

      if (inCup(d.x, d.y)) {
        d.alive = false;
        filled += 1;
        if (filled >= currentLevel().need) finishWin();
        continue;
      }

      if (d.y > 1.05 || d.x < -0.05 || d.x > 1.05) {
        d.alive = false;
        spill += 1;
        if (spill > currentLevel().need * 1.6 && filled < currentLevel().need * 0.45) {
          failSpill();
        }
      }
    }

    drops = drops.filter((d) => d.alive);
  }

  function update(dt) {
    if (!running || paused || won) return;

    const simDt = dt * speedScale;

    if (pouring) {
      pourAcc += simDt;
      while (pourAcc > 0.055) {
        pourAcc -= 0.055;
        spawnDrop();
      }
    }

    updatePhysics(simDt);
    paintHud();
    if (flash > 0) flash = Math.max(0, flash - dt * 2.5);
    if (shake > 0) shake = Math.max(0, shake - dt * 28);
  }

  function drawTap(w, h, tap) {
    const x = tap.x * w;
    const y = tap.y * h;
    ctx.fillStyle = "#7a8898";
    ctx.fillRect(x - 18, y - 28, 36, 14);
    ctx.fillRect(x - 6, y - 18, 12, 22);
    ctx.beginPath();
    ctx.arc(x, y + 6, 7, 0, Math.PI * 2);
    ctx.fillStyle = "#5a6a7a";
    ctx.fill();
    if (pouring) {
      ctx.fillStyle = "rgba(43,183,255,0.55)";
      ctx.fillRect(x - 2, y + 10, 4, 16);
    }
  }

  function drawCup(w, h, cup, fillAmt) {
    const x = cup.x * w;
    const y = cup.y * h;
    const cw = cup.w * w;
    const ch = cup.h * h;
    const fillH = ch * clamp(fillAmt, 0, 1);

    // water in cup
    if (fillH > 0) {
      ctx.fillStyle = "rgba(43,183,255,0.75)";
      ctx.beginPath();
      ctx.moveTo(x + 4, y + ch - fillH);
      ctx.lineTo(x + cw - 4, y + ch - fillH);
      ctx.lineTo(x + cw - 2, y + ch - 2);
      ctx.lineTo(x + 2, y + ch - 2);
      ctx.closePath();
      ctx.fill();
    }

    ctx.strokeStyle = "#ff8c42";
    ctx.lineWidth = 4;
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 3, y + ch);
    ctx.lineTo(x + cw - 3, y + ch);
    ctx.lineTo(x + cw, y);
    ctx.stroke();

    // handle
    ctx.beginPath();
    ctx.arc(x + cw + 2, y + ch * 0.45, ch * 0.22, -Math.PI * 0.55, Math.PI * 0.55);
    ctx.stroke();
  }

  function drawBlocks(w, h) {
    const blocks = currentLevel().blocks || [];
    ctx.fillStyle = "#9eb6cc";
    ctx.strokeStyle = "#5f7a94";
    ctx.lineWidth = 2;
    blocks.forEach((b) => {
      const rot = b.rot || 0;
      if (Math.abs(rot) < 0.001) {
        ctx.fillRect(b.x * w, b.y * h, b.w * w, b.h * h);
        ctx.strokeRect(b.x * w, b.y * h, b.w * w, b.h * h);
      } else {
        const cx = (b.x + b.w / 2) * w;
        const cy = (b.y + b.h / 2) * h;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(rot);
        ctx.fillRect((-b.w / 2) * w, (-b.h / 2) * h, b.w * w, b.h * h);
        ctx.strokeRect((-b.w / 2) * w, (-b.h / 2) * h, b.w * w, b.h * h);
        ctx.restore();
      }
    });
  }

  function drawStroke(pts, w, h, color) {
    if (!pts || pts.length < 2) return;
    ctx.strokeStyle = color;
    // Visual width ≈ 2 * LINE_HALF in world space
    ctx.lineWidth = Math.max(6, LINE_HALF * 2 * h);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(pts[0].x * w, pts[0].y * h);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x * w, pts[i].y * h);
    ctx.stroke();
  }

  function draw() {
    const { w, h } = canvasSize();
    const ox = shake ? (Math.random() - 0.5) * shake : 0;
    const oy = shake ? (Math.random() - 0.5) * shake : 0;
    ctx.save();
    ctx.translate(ox, oy);
    ctx.clearRect(-20, -20, w + 40, h + 40);

    // paper bg + dots
    ctx.fillStyle = "#eef7ff";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "rgba(120,160,190,0.18)";
    for (let i = 0; i < 48; i++) {
      ctx.beginPath();
      ctx.arc((i * 97) % w, (i * 53) % h, 1.2, 0, Math.PI * 2);
      ctx.fill();
    }

    drawBlocks(w, h);

    strokes.forEach((s) => drawStroke(s.points, w, h, "#14304a"));
    if (draft) drawStroke(draft.points, w, h, "#2bb7ff");

    const lv = currentLevel();
    drawTap(w, h, lv.tap);
    drawCup(w, h, lv.cup, filled / lv.need);

    // drops
    for (const d of drops) {
      ctx.beginPath();
      ctx.arc(d.x * w, d.y * h, Math.max(3, DROP_R * h * 1.6), 0, Math.PI * 2);
      ctx.fillStyle = "rgba(43,183,255,0.9)";
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.45)";
      ctx.beginPath();
      ctx.arc(d.x * w - 1.2, d.y * h - 1.2, Math.max(1.2, DROP_R * h * 0.55), 0, Math.PI * 2);
      ctx.fill();
    }

    if (flash > 0) {
      ctx.fillStyle = `rgba(231,76,111,${flash * 0.28})`;
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

  function canDraw() {
    return running && !paused && !won && !pouring;
  }

  function onPointerDown(e) {
    if (!canDraw()) return;
    e.preventDefault();
    canvas.setPointerCapture?.(e.pointerId);
    drawing = true;
    const p = toNorm(e.clientX, e.clientY);
    draft = { points: [p] };
  }

  function onPointerMove(e) {
    if (!drawing || !draft) return;
    e.preventDefault();
    const p = toNorm(e.clientX, e.clientY);
    const last = draft.points[draft.points.length - 1];
    const dist = Math.hypot(p.x - last.x, p.y - last.y);
    if (dist < 0.005) return;

    const usedNow = inkUsed + strokeLength(draft.points) + dist;
    if (usedNow > inkBudget()) {
      drawing = false;
      if (draft.points.length > 1) {
        strokes.push(draft);
        inkUsed += strokeLength(draft.points);
      }
      draft = null;
      paintHud();
      els.hint.textContent = "Out of ink — Undo / Clear or Pour";
      return;
    }
    // Resample long jumps so collision segments stay short
    if (dist > 0.03) {
      const steps = Math.ceil(dist / 0.02);
      for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        draft.points.push({
          x: last.x + (p.x - last.x) * t,
          y: last.y + (p.y - last.y) * t
        });
      }
    } else {
      draft.points.push(p);
    }
  }

  function onPointerUp() {
    if (!drawing) return;
    drawing = false;
    if (draft && draft.points.length > 1) {
      strokes.push(draft);
      inkUsed += strokeLength(draft.points);
    }
    draft = null;
    paintHud();
  }

  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerup", onPointerUp);
  canvas.addEventListener("pointercancel", onPointerUp);
  canvas.addEventListener("lostpointercapture", onPointerUp);

  els.undo.addEventListener("click", () => {
    if (!running || paused || won || pouring) return;
    const last = strokes.pop();
    if (last) {
      inkUsed = Math.max(0, inkUsed - strokeLength(last.points));
      paintHud();
    }
  });

  els.clear.addEventListener("click", () => {
    if (!running || paused || won) return;
    resetInk();
    resetDrops();
    paintHud();
    els.hint.textContent = "Draw a path · tap Pour · fill the cup";
  });

  document.querySelectorAll(".speed-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      setSpeedScale(Number(btn.dataset.speed) || 1);
    });
  });

  els.pour.addEventListener("click", () => {
    if (!running || paused || won) return;
    if (pouring) {
      // Stop → reset the pour (water + fill), keep your drawn path
      resetDrops();
      paintHud();
      els.hint.textContent = "Reset — tweak your path or Pour again";
      return;
    }
    if (!strokes.length) {
      els.hint.textContent = "Draw a path first — then Pour";
      return;
    }
    pouring = true;
    syncPourBtn();
    els.hint.textContent = "Water flowing — Stop to reset";
    try {
      window.HubSound?.play?.("click");
    } catch {}
  });

  els.reset.addEventListener("click", () => {
    if (!running || paused) return;
    resetLevel();
    els.hint.textContent = "Draw a path · tap Pour · fill the cup";
  });

  els.start.addEventListener("click", () => {
    if (overlayKind === "win" && levelIndex < LEVELS.length - 1 && isLevelUnlocked(levelIndex + 1)) {
      levelIndex += 1;
    }
    if (!isLevelUnlocked(levelIndex)) {
      levelIndex = Math.max(0, Math.min(bestLevel, LEVELS.length - 1));
    }
    startGame();
  });
  els.retry.addEventListener("click", () => startGame());
  els.resume.addEventListener("click", () => {
    if (!running || won) {
      startGame();
      return;
    }
    hideOverlay();
    lastTs = performance.now();
    running = true;
    paused = false;
  });
  els.menu.addEventListener("click", () => {
    if (running && !won && !paused) showOverlay("pause");
    else showOverlay("menu");
  });
  els.games.addEventListener("click", () => {
    window.location.href = "../index.html#games";
  });

  window.addEventListener("keydown", (e) => {
    if (e.code === "KeyP" || e.key === "p" || e.key === "P") {
      if (running && !won) {
        e.preventDefault();
        if (paused) {
          hideOverlay();
          lastTs = performance.now();
        } else showOverlay("pause");
      }
    }
    if (e.code === "Space") {
      if (els.overlay.classList.contains("hidden") && running && !paused && !won) {
        e.preventDefault();
        els.pour.click();
      } else if (!running || won || paused) {
        // let menu Space be handled lightly — start if menu open
        if (!els.overlay.classList.contains("hidden") && overlayKind !== "pause") {
          e.preventDefault();
          if (overlayKind === "win" && levelIndex < LEVELS.length - 1 && isLevelUnlocked(levelIndex + 1)) {
            levelIndex += 1;
          }
          if (!isLevelUnlocked(levelIndex)) {
            levelIndex = Math.max(0, Math.min(bestLevel, LEVELS.length - 1));
          }
          startGame();
        }
      }
    }
  });

  window.addEventListener("resize", resize);

  if (bestLevel > 0 && bestLevel < LEVELS.length) levelIndex = bestLevel;
  else if (bestLevel >= LEVELS.length) levelIndex = 0;

  resize();
  syncSpeedButtons();
  renderLevelPicker();
  paintHud();
  showOverlay("menu");
  raf = requestAnimationFrame(loop);
})();
