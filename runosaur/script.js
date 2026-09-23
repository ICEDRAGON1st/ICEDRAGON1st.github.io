(function () {
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const scoreEl = document.getElementById("score");
  const highScoreEl = document.getElementById("high-score");
  const overlayBestEl = document.getElementById("overlay-best");
  const overlay = document.getElementById("overlay");
  const overlayTitle = document.getElementById("overlay-title");
  const overlayText = document.getElementById("overlay-text");
  const startBtn = document.getElementById("start-btn");
  const resumeBtn = document.getElementById("resume-btn");
  const gamesBtn = document.getElementById("games-btn");
  const menuBtn = document.getElementById("menu-btn");

  const HIGH_SCORE_KEY = "dino-run-high-score";
  const W = canvas.width;
  const H = canvas.height;
  const GROUND_Y = H - 78;
  const GRAVITY = 2800;
  const JUMP_V = -900;
  const DUCK_H = 42;
  const STAND_H = 74;
  const DINO_W = 62;
  // Overhead hazards must sit in this band: hits standing, clears ducking
  // Stand hitbox top ≈ GROUND_Y - 66; duck hitbox top ≈ GROUND_Y - 34
  const OVERHEAD_BOTTOM = 52;
  const OVERHEAD_H = 44;

  // Iso extrusion (matches Tower Stack feel, side-scroller layout)
  const ISO_X = 0.62;
  const ISO_Y = 0.36;
  const PATH_Z = 56;

  let best = Math.max(0, Math.floor(Number(localStorage.getItem(HIGH_SCORE_KEY)) || 0));
  let running = false;
  let paused = false;
  let dead = false;
  let waitingStart = true;
  let score = 0;
  let speed = 340;
  let groundX = 0;
  let dino = null;
  let obstacles = [];
  let flakes = [];
  let spawnTimer = 0;
  let lastTs = 0;
  let deepCave = false;
  let anim = 0;
  let sessionStarted = false;
  let lastSubmitAt = 0;
  let raf = 0;
  let chaseBreath = 0;
  let duckKeyHeld = false;
  let duckBtnHeld = false;
  let pointerGesture = null;
  const jumpBtn = document.getElementById("jump-btn");
  const duckBtn = document.getElementById("duck-btn");

  function wrapMod(n, m) {
    const mod = Number(m) || 1;
    return ((Number(n) % mod) + mod) % mod;
  }

  function px(n) {
    return Math.round(Number(n) || 0);
  }

  const SCROLL_WRAP = 6720;

  function scrollPos(scale, period) {
    return wrapMod(groundX * scale, period);
  }

  function duckHeld() {
    return duckKeyHeld || duckBtnHeld || !!pointerGesture?.ducked;
  }

  function syncDuck() {
    setDuck(duckHeld());
  }

  function ensureSession() {
    if (sessionStarted) return;
    sessionStarted = true;
    if (window.HubPlays) HubPlays.record("dino");
    if (window.HubStreak) HubStreak.recordPlay();
  }

  function resetWorld() {
    score = 0;
    speed = 340;
    groundX = 0;
    obstacles = [];
    spawnTimer = 1.1;
    anim = 0;
    deepCave = false;
    chaseBreath = 0;
    dead = false;
    dino = {
      x: 100,
      y: GROUND_Y - STAND_H,
      vy: 0,
      w: DINO_W,
      h: STAND_H,
      onGround: true,
      ducking: false
    };
    flakes = Array.from({ length: 28 }, (_, i) => ({
      x: (i * 97) % W,
      y: (i * 53) % (GROUND_Y - 40),
      s: 0.4 + (i % 5) * 0.18,
      r: 1.2 + (i % 4),
      z: 8 + (i % 7) * 6
    }));
    updateHud();
  }

  function updateHud() {
    if (scoreEl) scoreEl.textContent = String(Math.floor(score));
    if (highScoreEl) highScoreEl.textContent = String(best);
    if (overlayBestEl) overlayBestEl.textContent = String(best);
  }

  function saveBest() {
    const n = Math.floor(score);
    if (n <= best) return;
    best = n;
    try {
      localStorage.setItem(HIGH_SCORE_KEY, String(best));
    } catch {}
    updateHud();
    maybeSubmit(true);
    if (best >= 100) window.HubConfetti?.burst?.();
  }

  function maybeSubmit(force) {
    if (best <= 0 || !window.HubLeaderboard) return;
    const now = Date.now();
    if (!force && now - lastSubmitAt < 6000) return;
    lastSubmitAt = now;
    HubLeaderboard.submit("dino", best).catch?.(() => {});
  }

  function checkAchievements() {
    if (!window.HubAchievements) return;
    const n = Math.floor(score);
    if (n >= 20) HubAchievements.unlock("dino_score_20");
    if (n >= 50) HubAchievements.unlock("dino_score_50");
    if (n >= 100) HubAchievements.unlock("dino_score_100");
    if (best >= 200) HubAchievements.unlock("dino_score_200");
  }

  function jump() {
    if (!dino || dead) return;
    if (waitingStart) {
      startRun();
      return;
    }
    if (!running || paused) return;
    if (!dino.onGround) return;
    dino.vy = JUMP_V;
    dino.onGround = false;
    dino.ducking = false;
    dino.h = STAND_H;
    dino.y = Math.min(dino.y, GROUND_Y - dino.h);
    window.HubSound?.play?.("click");
  }

  function setDuck(on) {
    if (!dino || dead || !running || paused || waitingStart) return;
    if (!dino.onGround && on) return;
    dino.ducking = !!on;
    dino.h = on ? DUCK_H : STAND_H;
    dino.y = GROUND_Y - dino.h;
  }

  function spawnObstacle() {
    const roll = Math.random();
    if (score > 90 && roll < 0.32) {
      obstacles.push({
        type: "bat",
        mustDuck: true,
        x: W + 20,
        y: GROUND_Y - OVERHEAD_BOTTOM - OVERHEAD_H,
        w: 72,
        h: OVERHEAD_H,
        passed: false
      });
      return;
    }
    const tall = Math.random() < 0.45;
    const twin = !tall && Math.random() < 0.35;
    const h = tall ? 82 : 56;
    const w = tall ? 34 : 26;
    obstacles.push({
      type: "spike",
      x: W + 20,
      y: GROUND_Y - h,
      w,
      h,
      twin,
      passed: false
    });
  }

  function hitbox(dinoBox) {
    const topPad = dinoBox.ducking ? 4 : 8;
    const bottomPad = 10;
    return {
      x: dinoBox.x + 10,
      y: dinoBox.y + topPad,
      w: dinoBox.w - 18,
      h: Math.max(16, dinoBox.h - topPad - bottomPad)
    };
  }

  function overlaps(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  function die() {
    if (dead) return;
    dead = true;
    running = false;
    saveBest();
    checkAchievements();
    maybeSubmit(true);
    window.HubSound?.play?.("miss");
    overlayTitle.textContent = "Caught!";
    overlayText.textContent = `You fled ${Math.floor(score)} points through the ice caves. Jump again to retry.`;
    startBtn.textContent = "Play again";
    resumeBtn?.classList.add("hidden");
    overlay?.classList.remove("hidden");
  }

  function startRun() {
    ensureSession();
    resetWorld();
    waitingStart = false;
    running = true;
    paused = false;
    dead = false;
    lastTs = 0;
    overlay?.classList.add("hidden");
    updateHud();
  }

  function pauseGame() {
    if (!running || dead || waitingStart) {
      openMenu(false);
      return;
    }
    paused = true;
    openMenu(true);
  }

  function resumeGame() {
    if (!paused) return;
    paused = false;
    lastTs = 0;
    overlay?.classList.add("hidden");
  }

  function openMenu(canResume) {
    overlayTitle.textContent = canResume ? "Paused" : "Runosaur 3D";
    overlayText.textContent = canResume
      ? "The dragon is still behind you…"
      : "Race the 3D ice caves — jump frost crystals, hold ↓ / S to duck under hanging bats, and stay ahead of the dragon.";
    startBtn.textContent = canResume || dead ? "Play again" : "Play";
    resumeBtn?.classList.toggle("hidden", !canResume);
    overlay?.classList.remove("hidden");
  }

  function update(dt) {
    if (!running || paused || dead) return;
    anim += dt;
    speed = Math.min(720, 340 + score * 0.55);
    deepCave = score >= 400;
    chaseBreath += dt;
    groundX -= speed * dt;
    if (groundX < -SCROLL_WRAP * 8) groundX = wrapMod(groundX, SCROLL_WRAP) - SCROLL_WRAP;
    score += speed * dt * 0.085;

    flakes.forEach((f) => {
      f.x -= f.s * speed * 0.12 * dt;
      f.y += Math.sin(anim * 2 + f.x * 0.01) * 8 * dt;
      if (f.x < -20) {
        f.x = W + 20 + Math.random() * 80;
        f.y = 20 + Math.random() * (GROUND_Y - 60);
      }
    });

    if (dino) {
      dino.vy += GRAVITY * dt;
      dino.y += dino.vy * dt;
      if (dino.y >= GROUND_Y - dino.h) {
        dino.y = GROUND_Y - dino.h;
        dino.vy = 0;
        dino.onGround = true;
        if (duckHeld()) setDuck(true);
      } else {
        dino.onGround = false;
      }
    }

    spawnTimer -= dt;
    if (spawnTimer <= 0) {
      spawnObstacle();
      const gap = Math.max(0.75, 1.55 - score * 0.0018);
      spawnTimer = gap + Math.random() * 0.55;
    }

    const box = hitbox(dino);
    obstacles.forEach((o) => {
      o.x -= speed * dt;
      if (!o.passed && o.x + o.w < dino.x) o.passed = true;
      const ob =
        o.type === "spike" && o.twin
          ? { x: o.x, y: o.y, w: o.w * 2 + 8, h: o.h }
          : { x: o.x, y: o.y, w: o.w, h: o.h };
      if (overlaps(box, ob)) die();
    });
    obstacles = obstacles.filter((o) => o.x > -80);

    updateHud();
    checkAchievements();
    if (Math.floor(score) % 25 === 0) maybeSubmit(false);
  }

  /* ——— 3D helpers ——— */
  function hexToRgb(hex) {
    const h = String(hex || "").replace("#", "");
    const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }

  function shade(hex, f) {
    const { r, g, b } = hexToRgb(hex);
    const t = (c) => Math.max(0, Math.min(255, Math.round(c * f)));
    return `rgb(${t(r)},${t(g)},${t(b)})`;
  }

  /** World: x along run, y up from ground, z into scene (0 = near). */
  function iso(x, y, z) {
    return {
      x: x + z * ISO_X,
      y: GROUND_Y - y - z * ISO_Y
    };
  }

  function drawPoly(points, fill) {
    if (!points.length) return;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
  }

  /**
   * Axis-aligned box in world space.
   * x,y,z = min corner; w,h,d = size. y is up from ground.
   */
  function drawBox3(b, alpha = 1) {
    const x0 = b.x;
    const x1 = b.x + b.w;
    const y0 = b.y;
    const y1 = b.y + b.h;
    const z0 = b.z;
    const z1 = b.z + b.d;

    const p000 = iso(x0, y0, z0);
    const p100 = iso(x1, y0, z0);
    const p010 = iso(x0, y1, z0);
    const p110 = iso(x1, y1, z0);
    const p001 = iso(x0, y0, z1);
    const p101 = iso(x1, y0, z1);
    const p011 = iso(x0, y1, z1);
    const p111 = iso(x1, y1, z1);

    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, alpha));

    // Far face (back) — slightly visible for depth
    drawPoly([p000, p100, p110, p010], shade(b.color, 0.55));
    // Left (+ toward -x) when visible
    drawPoly([p000, p001, p011, p010], shade(b.color, 0.72));
    // Front (+z toward camera-right / near edge of path)
    drawPoly([p001, p101, p111, p011], shade(b.color, 0.88));
    // Right
    drawPoly([p100, p101, p111, p110], shade(b.color, 0.78));
    // Top
    drawPoly([p010, p110, p111, p011], shade(b.color, 1.12));

    ctx.globalAlpha = Math.max(0, Math.min(1, alpha)) * 0.35;
    ctx.beginPath();
    ctx.moveTo(p010.x, p010.y);
    ctx.lineTo(p110.x, p110.y);
    ctx.lineTo(p111.x, p111.y);
    ctx.lineTo(p011.x, p011.y);
    ctx.closePath();
    ctx.strokeStyle = "rgba(255,255,255,0.55)";
    ctx.lineWidth = 1.1;
    ctx.stroke();
    ctx.restore();
  }

  /** Crystal pyramid / spike spike standing on ground. */
  function drawCrystal(x, baseY, w, h, d, color) {
    const y0 = GROUND_Y - baseY - h;
    const worldY0 = baseY;
    // tip at top center
    const tip = iso(x + w * 0.5, worldY0 + h, d * 0.5);
    const fl = iso(x, worldY0, 0);
    const fr = iso(x + w, worldY0, 0);
    const bl = iso(x, worldY0, d);
    const br = iso(x + w, worldY0, d);
    void y0;
    drawPoly([tip, bl, br], shade(color, 0.7));
    drawPoly([tip, fl, bl], shade(color, 0.85));
    drawPoly([tip, fr, br], shade(color, 0.95));
    drawPoly([tip, fl, fr], shade(color, 1.15));
    ctx.strokeStyle = "rgba(255,255,255,0.4)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(tip.x, tip.y);
    ctx.lineTo((fl.x + fr.x) / 2, (fl.y + fr.y) / 2);
    ctx.stroke();
  }

  function drawCaveBackdrop() {
    const top = deepCave ? "#050812" : "#0c1a30";
    const mid = deepCave ? "#0c1424" : "#163050";
    const bot = deepCave ? "#152038" : "#264868";
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, top);
    g.addColorStop(0.5, mid);
    g.addColorStop(1, bot);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // Far cave mouth / tunnel depth
    const tunnel = ctx.createRadialGradient(W * 0.55, GROUND_Y * 0.42, 20, W * 0.55, GROUND_Y * 0.5, W * 0.55);
    tunnel.addColorStop(0, deepCave ? "rgba(8,12,22,0.95)" : "rgba(12,22,40,0.75)");
    tunnel.addColorStop(0.55, "rgba(20,40,70,0.25)");
    tunnel.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = tunnel;
    ctx.fillRect(0, 0, W, GROUND_Y);

    // Ceiling ice slabs (3D)
    const ceilPeriod = 78;
    const ceilScroll = -scrollPos(0.32, ceilPeriod);
    const ceilColor = deepCave ? "#4a6588" : "#7aa8cc";
    const ceilStart = Math.floor((-80 - ceilScroll) / ceilPeriod) - 1;
    const ceilEnd = Math.ceil((W + 80 - ceilScroll) / ceilPeriod) + 1;
    for (let i = ceilStart; i <= ceilEnd; i += 1) {
      const ix = i * ceilPeriod + ceilScroll;
      const tipH = 18 + ((i % 5) + 5) % 5 * 6;
      drawBox3(
        {
          x: ix,
          y: GROUND_Y - tipH - 24,
          z: 10 + (i % 3) * 8,
          w: 42,
          h: tipH,
          d: 28,
          color: ceilColor
        },
        deepCave ? 0.55 : 0.7
      );
    }

    // Side cave walls as stacked 3D pillars
    const wallPhase = groundX * 0.4;
    const wallColor = deepCave ? "#2a3e58" : "#3d6288";
    for (let i = -1; i < 10; i++) {
      const bx = wrapMod(i * 140 + wallPhase * 0.15, W + 160) - 80;
      drawBox3(
        {
          x: bx - 20,
          y: 40 + Math.sin(i * 1.7) * 12,
          z: PATH_Z + 18,
          w: 36,
          h: GROUND_Y - 90 - Math.sin(i * 1.7) * 20,
          d: 40,
          color: wallColor
        },
        0.55
      );
    }
  }

  function drawGround3D() {
    const iceTop = deepCave ? "#4a6a88" : "#8ec4e8";
    const iceSide = deepCave ? "#2e4860" : "#5a98c0";
    const iceFront = deepCave ? "#3a5878" : "#6eb0d8";

    // Perspective path slab
    const nearZ = 0;
    const farZ = PATH_Z;
    const pad = 40;
    const a = iso(-pad, 0, nearZ);
    const b = iso(W + pad, 0, nearZ);
    const c = iso(W + pad, 0, farZ);
    const d = iso(-pad, 0, farZ);
    drawPoly([a, b, c, d], shade(iceTop, 1.05));

    // Front thickness edge
    const a2 = { x: a.x, y: a.y + 28 };
    const b2 = { x: b.x, y: b.y + 28 };
    drawPoly([a, b, b2, a2], shade(iceFront, 0.9));
    const b3 = { x: c.x, y: c.y + 18 };
    drawPoly([b, c, b3, b2], shade(iceSide, 0.75));

    // Grid lines scrolling along the path
    const tile = 56;
    const scroll = -scrollPos(1, tile);
    ctx.strokeStyle = deepCave ? "rgba(180,210,240,0.22)" : "rgba(255,255,255,0.35)";
    ctx.lineWidth = 1.2;
    const start = Math.floor((-tile - scroll) / tile) - 1;
    const end = Math.ceil((W + tile - scroll) / tile) + 1;
    for (let i = start; i <= end; i += 1) {
      const x = i * tile + scroll;
      const p0 = iso(x, 0.5, nearZ);
      const p1 = iso(x, 0.5, farZ);
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(p1.x, p1.y);
      ctx.stroke();
    }
    for (let zi = 0; zi <= 4; zi++) {
      const z = (zi / 4) * farZ;
      const p0 = iso(-pad, 0.5, z);
      const p1 = iso(W + pad, 0.5, z);
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(p1.x, p1.y);
      ctx.stroke();
    }

    // Frost chunks on the path
    ctx.fillStyle = deepCave ? "rgba(200,230,255,0.2)" : "rgba(255,255,255,0.4)";
    for (let i = start; i <= end; i += 2) {
      const x = i * tile + scroll + 12;
      drawBox3(
        {
          x,
          y: 0,
          z: 8 + (i % 3) * 6,
          w: 10,
          h: 4,
          d: 10,
          color: deepCave ? "#9bb8d0" : "#d8f0ff"
        },
        0.85
      );
    }
  }

  function drawFlake(f) {
    const p = iso(f.x, GROUND_Y - f.y, f.z || 20);
    ctx.fillStyle = deepCave ? "rgba(180, 210, 240, 0.4)" : "rgba(255, 255, 255, 0.75)";
    ctx.beginPath();
    ctx.arc(px(p.x), px(p.y), f.r, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawChaseDragon() {
    const bob = Math.sin(anim * 2.2) * 8;
    const baseX = -40 + Math.min(22, score * 0.04);
    const lift = 55 + bob;
    const z = 22;
    const body = deepCave ? "#2a1838" : "#3a2458";
    const wing = deepCave ? "#1a1028" : "#2a1840";
    const horn = deepCave ? "#6a8cb0" : "#9ec5e8";

    // Body blocks
    drawBox3({ x: baseX, y: lift, z, w: 90, h: 36, d: 34, color: body }, 0.75);
    drawBox3({ x: baseX + 78, y: lift + 10, z: z + 4, w: 48, h: 26, d: 26, color: body }, 0.8);
    drawBox3({ x: baseX + 118, y: lift + 14, z: z + 6, w: 28, h: 20, d: 20, color: shade(body, 1.1) }, 0.85);
    // Horns
    drawCrystal(baseX + 128, lift + 34, 10, 22, 10, horn);
    drawCrystal(baseX + 138, lift + 32, 8, 18, 8, horn);
    // Eye
    const eye = iso(baseX + 136, lift + 26, z + 22);
    ctx.fillStyle = "#ff5a5a";
    ctx.beginPath();
    ctx.arc(eye.x, eye.y, 3.5, 0, Math.PI * 2);
    ctx.fill();
    // Wing flap
    const flap = Math.sin(anim * 5) * 14;
    drawBox3(
      {
        x: baseX + 20,
        y: lift + 28 + flap * 0.3,
        z: z - 8,
        w: 50,
        h: 8,
        d: 48 + flap * 0.4,
        color: wing
      },
      0.65
    );
    if (Math.sin(chaseBreath * 3) > 0.55) {
      const breathOrigin = iso(baseX + 148, lift + 22, z + 18);
      const breath = ctx.createLinearGradient(breathOrigin.x, breathOrigin.y, breathOrigin.x + 70, breathOrigin.y);
      breath.addColorStop(0, "rgba(180, 230, 255, 0.55)");
      breath.addColorStop(1, "rgba(180, 230, 255, 0)");
      ctx.fillStyle = breath;
      ctx.beginPath();
      ctx.moveTo(breathOrigin.x, breathOrigin.y - 4);
      ctx.quadraticCurveTo(breathOrigin.x + 36, breathOrigin.y - 12, breathOrigin.x + 68, breathOrigin.y);
      ctx.quadraticCurveTo(breathOrigin.x + 36, breathOrigin.y + 12, breathOrigin.x, breathOrigin.y + 4);
      ctx.fill();
    }
  }

  function drawRunner() {
    if (!dino) return;
    const x = dino.x;
    const footY = GROUND_Y - dino.y - dino.h;
    const h = dino.h;
    const w = dino.w;
    const ducking = dino.ducking;
    const onGround = dino.onGround;
    const leg = onGround ? Math.floor(anim * speed * 0.02) % 2 : 0;
    const z = 16;
    const body = deepCave ? "#c5d8ec" : "#e8f4ff";
    const accent = deepCave ? "#5b8fd4" : "#3d7ecc";
    const belly = deepCave ? "#8aa8c8" : "#b8d4f0";
    const shadowA = Math.max(0.12, 0.35 - (dino.y < GROUND_Y - dino.h ? (GROUND_Y - dino.h - dino.y) * 0.002 : 0));

    // Shadow on path
    ctx.save();
    ctx.globalAlpha = shadowA;
    drawPoly(
      [
        iso(x + 8, 0.5, z + 4),
        iso(x + w - 4, 0.5, z + 4),
        iso(x + w - 4, 0.5, z + 28),
        iso(x + 8, 0.5, z + 28)
      ],
      "#0a1520"
    );
    ctx.restore();

    if (ducking) {
      drawBox3({ x: x + 4, y: footY + 6, z, w: w * 0.85, h: h * 0.7, d: 34, color: accent }, 1);
      drawBox3({ x: x + w * 0.55, y: footY + 10, z: z + 4, w: 28, h: h * 0.45, d: 26, color: body }, 1);
      drawBox3({ x: x - 10, y: footY + 12, z: z + 8, w: 18, h: 10, d: 14, color: accent }, 1);
      const eye = iso(x + w * 0.9, footY + h * 0.55, z + 28);
      ctx.fillStyle = "#0a1520";
      ctx.fillRect(eye.x, eye.y, 4, 4);
    } else {
      // Legs
      drawBox3(
        { x: x + 16, y: footY, z: z + 6, w: 12, h: 16 + (leg ? 3 : 0), d: 14, color: accent },
        1
      );
      drawBox3(
        { x: x + 34, y: footY, z: z + 10, w: 12, h: 16 + (leg ? 0 : 3), d: 14, color: accent },
        1
      );
      // Body
      drawBox3({ x: x + 10, y: footY + 14, z, w: 36, h: 32, d: 30, color: accent }, 1);
      drawBox3({ x: x + 16, y: footY + 18, z: z + 4, w: 24, h: 18, d: 22, color: belly }, 1);
      // Head
      drawBox3({ x: x + 38, y: footY + 36, z: z + 4, w: 26, h: 22, d: 24, color: body }, 1);
      drawBox3({ x: x + 58, y: footY + 40, z: z + 8, w: 14, h: 12, d: 16, color: accent }, 1);
      // Horn
      drawCrystal(x + 44, footY + 56, 10, 16, 10, "#9ec5e8");
      // Wing
      const wing = Math.sin(anim * 10) * 6;
      drawBox3(
        {
          x: x + 6,
          y: footY + 28 + wing * 0.2,
          z: z - 6,
          w: 18,
          h: 8,
          d: 36 + wing * 0.3,
          color: deepCave ? "#6a90c8" : "#5a96dc"
        },
        0.92
      );
      // Tail
      drawBox3({ x: x - 8, y: footY + 22, z: z + 10, w: 22, h: 10, d: 12, color: accent }, 1);
      // Eye
      const eye = iso(x + 52, footY + 50, z + 28);
      ctx.fillStyle = "#0a1520";
      ctx.beginPath();
      ctx.arc(eye.x, eye.y, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(eye.x - 1, eye.y - 1, 1.1, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawSpike(o) {
    const tip = deepCave ? "#8eb4d4" : "#d8f2ff";
    const baseH = o.h;
    const worldY = GROUND_Y - o.y - o.h;
    void worldY;
    drawCrystal(o.x, 0, o.w, baseH, 28, tip);
    if (o.twin) drawCrystal(o.x + o.w + 8, 0, o.w, baseH - 6, 24, tip);
  }

  function drawBat(o) {
    const flap = Math.sin(anim * 14) > 0;
    const baseY = GROUND_Y - o.y - o.h;
    const z = 20;
    const color = deepCave ? "#9bb8d4" : "#c5e0f5";
    // Ice tether from ceiling
    const top = iso(o.x + o.w * 0.5, GROUND_Y - 8, z + 10);
    const mid = iso(o.x + o.w * 0.5, baseY + o.h, z + 10);
    ctx.strokeStyle = deepCave ? "rgba(160,200,240,0.55)" : "rgba(210,235,255,0.7)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(top.x - 10, 4);
    ctx.lineTo(mid.x - 6, mid.y);
    ctx.moveTo(top.x + 10, 4);
    ctx.lineTo(mid.x + 6, mid.y);
    ctx.stroke();

    drawBox3(
      {
        x: o.x + 10,
        y: baseY + 8,
        z,
        w: o.w - 20,
        h: o.h - 12,
        d: 28,
        color
      },
      1
    );
    // Wings
    const wingD = flap ? 40 : 22;
    drawBox3(
      { x: o.x - 8, y: baseY + 14, z: z + 4, w: 22, h: 8, d: wingD, color: shade(color, 0.85) },
      0.9
    );
    drawBox3(
      {
        x: o.x + o.w - 14,
        y: baseY + 14,
        z: z + 4,
        w: 22,
        h: 8,
        d: wingD,
        color: shade(color, 0.85)
      },
      0.9
    );

    if (dino && o.x < dino.x + 220 && o.x + o.w > dino.x - 20 && !dino.ducking) {
      const label = iso(o.x + o.w * 0.5, baseY + o.h + 10, z);
      ctx.fillStyle = "rgba(255, 220, 120, 0.9)";
      ctx.font = "700 14px Outfit, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("↓ DUCK", label.x, label.y);
    }
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    ctx.imageSmoothingEnabled = true;
    ctx.shadowBlur = 0;
    ctx.shadowColor = "transparent";
    drawCaveBackdrop();
    drawChaseDragon();
    flakes.forEach(drawFlake);
    drawGround3D();
    obstacles.forEach((o) => (o.type === "bat" ? drawBat(o) : drawSpike(o)));
    drawRunner();

    ctx.fillStyle = "#e8f4ff";
    ctx.font = "700 26px Outfit, sans-serif";
    ctx.textAlign = "right";
    ctx.shadowColor = "rgba(0,20,40,0.5)";
    ctx.shadowBlur = 6;
    ctx.fillText(String(Math.floor(score)).padStart(5, "0"), W - 24, 40);
    ctx.shadowBlur = 0;
    ctx.shadowColor = "transparent";
    if (waitingStart && !dead) {
      ctx.textAlign = "center";
      ctx.font = "700 30px Outfit, sans-serif";
      ctx.fillText("Press Space / Tap to flee", W / 2, H * 0.38);
    }
  }

  function frame(ts) {
    raf = requestAnimationFrame(frame);
    if (!lastTs) lastTs = ts;
    let dt = (ts - lastTs) / 1000;
    lastTs = ts;
    dt = Math.min(0.035, dt);
    if (running && !paused && !dead) update(dt);
    else if (!running && !dead) {
      anim += dt;
      groundX -= 40 * dt;
      if (groundX < -SCROLL_WRAP * 8) groundX = wrapMod(groundX, SCROLL_WRAP) - SCROLL_WRAP;
    }
    draw();
  }

  startBtn?.addEventListener("click", () => startRun());
  resumeBtn?.addEventListener("click", () => resumeGame());
  menuBtn?.addEventListener("click", () => pauseGame());
  gamesBtn?.addEventListener("click", () => {
    window.location.href = "../index.html#games";
  });

  canvas?.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    if (waitingStart || dead) {
      jump();
      return;
    }
    pointerGesture = { y: e.clientY, ducked: false, id: e.pointerId };
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch {}
  });
  canvas?.addEventListener("pointermove", (e) => {
    if (!pointerGesture || pointerGesture.id !== e.pointerId) return;
    const dy = e.clientY - pointerGesture.y;
    if (dy > 22) {
      pointerGesture.ducked = true;
      syncDuck();
    }
  });
  canvas?.addEventListener("pointerup", (e) => {
    if (!pointerGesture || pointerGesture.id !== e.pointerId) return;
    const dy = e.clientY - pointerGesture.y;
    const ducked = pointerGesture.ducked || dy > 22;
    pointerGesture = null;
    syncDuck();
    if (!ducked && Math.abs(dy) < 20) jump();
  });
  canvas?.addEventListener("pointercancel", () => {
    pointerGesture = null;
    syncDuck();
  });

  function bindHoldButton(btn, onHold, onRelease) {
    if (!btn) return;
    const down = (e) => {
      e.preventDefault();
      onHold();
    };
    const up = (e) => {
      e.preventDefault();
      onRelease();
    };
    btn.addEventListener("pointerdown", down);
    btn.addEventListener("pointerup", up);
    btn.addEventListener("pointercancel", up);
    btn.addEventListener("pointerleave", (e) => {
      if (e.buttons === 0) up(e);
    });
  }

  bindHoldButton(
    jumpBtn,
    () => {
      jumpBtn?.classList.add("is-held");
      jump();
    },
    () => jumpBtn?.classList.remove("is-held")
  );
  bindHoldButton(
    duckBtn,
    () => {
      duckBtnHeld = true;
      duckBtn?.classList.add("is-held");
      syncDuck();
    },
    () => {
      duckBtnHeld = false;
      duckBtn?.classList.remove("is-held");
      syncDuck();
    }
  );

  window.addEventListener("keydown", (e) => {
    if (e.code === "Space" || e.code === "ArrowUp" || e.code === "KeyW" || e.key === " ") {
      e.preventDefault();
      duckKeyHeld = false;
      syncDuck();
      jump();
    } else if (e.code === "ArrowDown" || e.code === "KeyS") {
      e.preventDefault();
      duckKeyHeld = true;
      syncDuck();
    } else if (e.code === "Escape") {
      pauseGame();
    }
  });
  window.addEventListener("keyup", (e) => {
    if (e.code === "ArrowDown" || e.code === "KeyS") {
      duckKeyHeld = false;
      syncDuck();
    }
  });

  resetWorld();
  waitingStart = true;
  updateHud();
  maybeSubmit(true);
  openMenu(false);
  raf = requestAnimationFrame(frame);
  window.addEventListener("beforeunload", () => maybeSubmit(true));
})();
