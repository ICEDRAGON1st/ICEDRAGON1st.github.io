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

  // Classic 2D side-scroller layout (Fishing Idle–style camera)
  const GROUND_Y = H * 0.78;
  const PLAYER_X = W * 0.22;
  const GRAVITY = 2600;
  const JUMP_V = 920; // positive = up (y is height above ground)
  const STAND_H = 72;
  const DUCK_H = 34;
  const MAX_JUMP_Y = 220;

  let best = Math.max(0, Math.floor(Number(localStorage.getItem(HIGH_SCORE_KEY)) || 0));
  let running = false;
  let paused = false;
  let dead = false;
  let waitingStart = true;
  let score = 0;
  let speed = 280;
  let dino = null;
  let obstacles = [];
  let flakes = [];
  let hills = [];
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
  let scrollX = 0;
  const jumpBtn = document.getElementById("jump-btn");
  const duckBtn = document.getElementById("duck-btn");

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
    speed = 280;
    scrollX = 0;
    obstacles = [];
    spawnTimer = 1.2;
    anim = 0;
    deepCave = false;
    chaseBreath = 0;
    dead = false;
    dino = {
      y: 0,
      vy: 0,
      h: STAND_H,
      onGround: true,
      ducking: false
    };
    flakes = Array.from({ length: 36 }, (_, i) => ({
      x: (i * 73) % W,
      y: 20 + (i * 41) % (GROUND_Y - 80),
      r: 1.2 + (i % 4) * 0.55,
      drift: 18 + (i % 5) * 8
    }));
    hills = Array.from({ length: 8 }, (_, i) => ({
      x: i * 220,
      w: 160 + (i % 3) * 40,
      h: 40 + (i % 4) * 22
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
    window.HubSound?.play?.("click");
  }

  function setDuck(on) {
    if (!dino || dead || !running || paused || waitingStart) return;
    if (!dino.onGround && on) return;
    dino.ducking = !!on;
    dino.h = on ? DUCK_H : STAND_H;
    if (on) dino.y = 0;
  }

  function spawnObstacle() {
    const roll = Math.random();
    if (score > 80 && roll < 0.34) {
      obstacles.push({
        type: "bat",
        mustDuck: true,
        x: W + 40,
        y: 52,
        w: 78,
        h: 40,
        passed: false
      });
      return;
    }
    const tall = Math.random() < 0.45;
    const twin = !tall && Math.random() < 0.35;
    obstacles.push({
      type: "spike",
      x: W + 40,
      y: 0,
      w: tall ? 44 : 32,
      h: tall ? 78 : 54,
      twin,
      passed: false
    });
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
    overlayTitle.textContent = canResume ? "Paused" : "Runosaur";
    overlayText.textContent = canResume
      ? "The dragon is still behind you…"
      : "Side-view ice cave chase — jump frost crystals, hold ↓ / S to duck under hanging bats.";
    startBtn.textContent = canResume || dead ? "Play again" : "Play";
    resumeBtn?.classList.toggle("hidden", !canResume);
    overlay?.classList.remove("hidden");
  }

  function update(dt) {
    if (!running || paused || dead) return;
    anim += dt;
    speed = Math.min(640, 280 + score * 0.5);
    deepCave = score >= 400;
    chaseBreath += dt;
    scrollX += speed * dt;
    score += speed * dt * 0.09;

    flakes.forEach((f) => {
      f.x -= f.drift * dt * (speed / 280);
      f.y += Math.sin(anim * 2 + f.x * 0.02) * 10 * dt;
      if (f.x < -10) {
        f.x = W + 10;
        f.y = 20 + Math.random() * (GROUND_Y - 90);
      }
    });

    hills.forEach((h) => {
      h.x -= speed * 0.18 * dt;
      if (h.x + h.w < -40) h.x += 8 * 220;
    });

    if (dino) {
      // y = height above ground; gravity pulls vy down
      dino.vy -= GRAVITY * dt;
      dino.y += dino.vy * dt;
      if (dino.y > MAX_JUMP_Y) {
        dino.y = MAX_JUMP_Y;
        if (dino.vy > 0) dino.vy = 0;
      }
      if (dino.y <= 0) {
        dino.y = 0;
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
      const gap = Math.max(0.7, 1.45 - score * 0.0016);
      spawnTimer = gap + Math.random() * 0.5;
    }

    const hitTop = dino.y + dino.h;
    const hitBot = dino.y + (dino.ducking ? 4 : 10);
    const px0 = PLAYER_X - 28;
    const px1 = PLAYER_X + 36;
    obstacles.forEach((o) => {
      o.x -= speed * dt;
      if (!o.passed && o.x + o.w < px0) o.passed = true;
      const ox0 = o.x;
      const ox1 = o.x + (o.twin ? o.w * 1.9 : o.w);
      if (ox1 > px0 && ox0 < px1) {
        if (o.type === "bat") {
          const by0 = o.y;
          const by1 = o.y + o.h;
          if (hitTop > by0 - 4 && hitBot < by1) die();
        } else if (dino.y < o.h - 10) {
          die();
        }
      }
    });
    obstacles = obstacles.filter((o) => o.x > -120);

    updateHud();
    checkAchievements();
    if (Math.floor(score) % 25 === 0) maybeSubmit(false);
  }

  /* ——— shaded 2D drawing ——— */
  function hexToRgb(hex) {
    const s = String(hex || "").trim();
    const rgb = s.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i);
    if (rgb) {
      return {
        r: Math.round(Number(rgb[1]) || 0),
        g: Math.round(Number(rgb[2]) || 0),
        b: Math.round(Number(rgb[3]) || 0)
      };
    }
    const h = s.replace("#", "");
    const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
    if (!Number.isFinite(n)) return { r: 200, g: 220, b: 240 };
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }

  function shade(hex, f) {
    const { r, g, b } = hexToRgb(hex);
    const t = (c) => Math.max(0, Math.min(255, Math.round(c * f)));
    return `rgb(${t(r)},${t(g)},${t(b)})`;
  }

  function drawPoly(points, fill, stroke, lineW) {
    if (!points.length) return;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
    ctx.closePath();
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fill();
    }
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = lineW || 1.25;
      ctx.stroke();
    }
  }

  /** Flat 2D “extruded” box with lit top / dark bottom / side depth */
  function drawShadeBox(x, y, w, h, color, depth = 10) {
    const d = Math.max(4, depth);
    // Right depth face
    drawPoly(
      [
        { x: x + w, y: y },
        { x: x + w + d, y: y - d * 0.55 },
        { x: x + w + d, y: y + h - d * 0.55 },
        { x: x + w, y: y + h }
      ],
      shade(color, 0.72)
    );
    // Top depth face
    drawPoly(
      [
        { x: x, y: y },
        { x: x + d, y: y - d * 0.55 },
        { x: x + w + d, y: y - d * 0.55 },
        { x: x + w, y: y }
      ],
      shade(color, 1.18),
      "rgba(255,255,255,0.35)"
    );
    // Front face with vertical shade
    const g = ctx.createLinearGradient(x, y, x, y + h);
    g.addColorStop(0, shade(color, 1.08));
    g.addColorStop(0.45, color);
    g.addColorStop(1, shade(color, 0.78));
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w, h);
    // Specular rim
    ctx.fillStyle = "rgba(255,255,255,0.22)";
    ctx.fillRect(x + 2, y + 2, Math.max(2, w * 0.18), Math.max(2, h - 4));
  }

  function drawBackdrop() {
    const skyTop = deepCave ? "#071018" : "#0e2040";
    const skyMid = deepCave ? "#0c1c30" : "#163858";
    const skyBot = deepCave ? "#122438" : "#1c4a72";
    const g = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
    g.addColorStop(0, skyTop);
    g.addColorStop(0.55, skyMid);
    g.addColorStop(1, skyBot);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // Soft cave light
    const glow = ctx.createRadialGradient(W * 0.55, GROUND_Y * 0.35, 20, W * 0.55, GROUND_Y * 0.4, W * 0.55);
    glow.addColorStop(0, deepCave ? "rgba(70,120,170,0.35)" : "rgba(140,200,255,0.28)");
    glow.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, GROUND_Y);

    // Parallax ice hills
    hills.forEach((h) => {
      const base = deepCave ? "#1a3048" : "#2a5680";
      const tipY = GROUND_Y - h.h;
      drawPoly(
        [
          { x: h.x, y: GROUND_Y },
          { x: h.x + h.w * 0.35, y: tipY },
          { x: h.x + h.w * 0.55, y: tipY + 12 },
          { x: h.x + h.w, y: GROUND_Y }
        ],
        shade(base, 0.85)
      );
      drawPoly(
        [
          { x: h.x + h.w * 0.35, y: tipY },
          { x: h.x + h.w * 0.42, y: tipY - 8 },
          { x: h.x + h.w * 0.55, y: tipY + 12 }
        ],
        deepCave ? "rgba(150,190,230,0.45)" : "rgba(200,235,255,0.55)"
      );
    });

    // Ceiling icicles
    const ice = deepCave ? "#6a98c0" : "#9ed0f5";
    for (let i = 0; i < 18; i++) {
      const x = ((i * 90 - scrollX * 0.25) % (W + 80)) - 40;
      const len = 18 + (i % 5) * 10;
      drawPoly(
        [
          { x: x - 8, y: 0 },
          { x: x, y: len },
          { x: x + 8, y: 0 }
        ],
        ice
      );
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      ctx.fillRect(x - 2, 2, 3, len * 0.55);
    }
  }

  function drawGround() {
    const iceTop = deepCave ? "#5a8ab0" : "#a8daf8";
    const iceMid = deepCave ? "#3d6a90" : "#6eb8e0";
    const iceDark = deepCave ? "#2a5070" : "#3a7aa0";

    // Ground slab
    const slab = ctx.createLinearGradient(0, GROUND_Y, 0, H);
    slab.addColorStop(0, iceTop);
    slab.addColorStop(0.2, iceMid);
    slab.addColorStop(1, iceDark);
    ctx.fillStyle = slab;
    ctx.fillRect(0, GROUND_Y, W, H - GROUND_Y);

    // Lit top edge
    ctx.fillStyle = shade(iceTop, 1.15);
    ctx.fillRect(0, GROUND_Y, W, 6);
    ctx.fillStyle = "rgba(255,255,255,0.45)";
    ctx.fillRect(0, GROUND_Y, W, 2);

    // Front depth lip
    ctx.fillStyle = shade(iceDark, 0.85);
    ctx.fillRect(0, H - 18, W, 18);
    ctx.fillStyle = shade(iceMid, 0.7);
    ctx.fillRect(0, H - 18, W, 4);

    // Scrolling frost cracks
    ctx.strokeStyle = deepCave ? "rgba(200,230,255,0.28)" : "rgba(255,255,255,0.45)";
    ctx.lineWidth = 2;
    const spacing = 72;
    const phase = scrollX % spacing;
    for (let x = -phase; x < W + 20; x += spacing) {
      ctx.beginPath();
      ctx.moveTo(x, GROUND_Y + 10);
      ctx.lineTo(x + 28, GROUND_Y + 10);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x + 14, GROUND_Y + 22);
      ctx.lineTo(x + 40, GROUND_Y + 22);
      ctx.stroke();
    }
  }

  function drawFlake(f) {
    ctx.fillStyle = deepCave ? "rgba(190,220,250,0.55)" : "rgba(255,255,255,0.85)";
    ctx.beginPath();
    ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawChaseDragon() {
    const bob = Math.sin(anim * 2.4) * 6;
    const threat = Math.min(1, score / 450);
    const baseX = -20 + threat * 28;
    const baseY = GROUND_Y - 110 + bob;
    const body = deepCave ? "#2a1838" : "#3d2460";
    const wing = deepCave ? "#1a1028" : "#2a1848";
    const alpha = 0.55 + threat * 0.4;

    ctx.save();
    ctx.globalAlpha = alpha * 0.35;
    ctx.fillStyle = "#000";
    ctx.beginPath();
    ctx.ellipse(baseX + 90, GROUND_Y + 8, 88, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = alpha;

    drawShadeBox(baseX, baseY + 36, 96, 44, body, 12);
    drawShadeBox(baseX + 78, baseY + 22, 54, 34, body, 10);
    drawShadeBox(baseX + 120, baseY + 14, 36, 28, shade(body, 1.08), 8);

    ctx.fillStyle = deepCave ? "#8eb4d4" : "#c5e8ff";
    ctx.beginPath();
    ctx.moveTo(baseX + 132, baseY + 16);
    ctx.lineTo(baseX + 126, baseY - 10);
    ctx.lineTo(baseX + 142, baseY + 14);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(baseX + 144, baseY + 18);
    ctx.lineTo(baseX + 152, baseY - 4);
    ctx.lineTo(baseX + 154, baseY + 20);
    ctx.fill();

    ctx.fillStyle = "#ff3b3b";
    ctx.beginPath();
    ctx.arc(baseX + 142, baseY + 28, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(baseX + 140.5, baseY + 26.5, 1.4, 0, Math.PI * 2);
    ctx.fill();

    const flap = Math.sin(anim * 5) * 10;
    drawShadeBox(baseX + 22, baseY + 4 + flap * 0.25, 56, 12, wing, 18 + flap * 0.3);

    if (Math.sin(chaseBreath * 3) > 0.45) {
      const ox = baseX + 158;
      const oy = baseY + 30;
      const breath = ctx.createLinearGradient(ox, oy, ox + 80, oy - 6);
      breath.addColorStop(0, "rgba(180,230,255,0.55)");
      breath.addColorStop(1, "rgba(180,230,255,0)");
      ctx.fillStyle = breath;
      ctx.beginPath();
      ctx.moveTo(ox, oy - 5);
      ctx.quadraticCurveTo(ox + 40, oy - 16, ox + 80, oy - 2);
      ctx.quadraticCurveTo(ox + 40, oy + 12, ox, oy + 6);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawRunner() {
    if (!dino) return;
    const lift = dino.y;
    const sx = PLAYER_X;
    const sy = GROUND_Y - lift;
    const ducking = dino.ducking;
    const onGround = dino.onGround;
    const leg = onGround ? Math.floor(anim * speed * 0.028) % 2 : 0;
    const body = deepCave ? "#e8f4ff" : "#ffffff";
    const accent = deepCave ? "#3d7fd4" : "#1e6ad4";
    const belly = deepCave ? "#9ec4ef" : "#7eb6f0";
    const wingC = deepCave ? "#5a9aef" : "#4a9cff";
    const crest = deepCave ? "#fff6c8" : "#ffe566";

    // Ground shadow
    ctx.save();
    ctx.globalAlpha = Math.max(0.2, 0.45 - dino.y * 0.003);
    ctx.fillStyle = "#041018";
    ctx.beginPath();
    ctx.ellipse(sx + 6, GROUND_Y + 4, 42, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    if (ducking) {
      const baseY = sy - 38;
      drawShadeBox(sx - 48, baseY + 6, 96, 32, accent, 10);
      drawShadeBox(sx - 14, baseY + 10, 52, 24, body, 8);
      drawShadeBox(sx - 54, baseY + 12, 28, 14, accent, 6);
      drawShadeBox(sx + 20, baseY + 4, 24, 16, crest, 6);
      ctx.fillStyle = "#0a1520";
      ctx.beginPath();
      ctx.arc(sx + 26, baseY + 16, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(sx + 25, baseY + 15, 1.5, 0, Math.PI * 2);
      ctx.fill();
    } else {
      const baseY = sy - 108;
      const legH = 28 + (leg ? 6 : 0);
      const legH2 = 28 + (leg ? 0 : 6);
      drawShadeBox(sx - 30, sy - legH, 22, legH, accent, 7);
      drawShadeBox(sx + 6, sy - legH2, 22, legH2, accent, 7);
      drawShadeBox(sx - 36, baseY + 48, 72, 48, accent, 11);
      drawShadeBox(sx - 24, baseY + 54, 48, 30, belly, 8);
      drawShadeBox(sx - 26, baseY + 16, 54, 40, body, 10);
      drawShadeBox(sx + 8, baseY + 26, 26, 20, accent, 7);
      drawShadeBox(sx - 18, baseY - 2, 14, 22, crest, 5);
      drawShadeBox(sx + 4, baseY, 12, 18, crest, 5);
      const wing = Math.sin(anim * 11) * 5;
      drawShadeBox(sx - 58, baseY + 44 + wing, 28, 12, wingC, 14);
      drawShadeBox(sx - 62, baseY + 38, 30, 14, accent, 6);
      ctx.fillStyle = "#0a1520";
      ctx.beginPath();
      ctx.arc(sx - 6, baseY + 34, 5, 0, Math.PI * 2);
      ctx.arc(sx + 16, baseY + 34, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(sx - 7, baseY + 32.5, 1.6, 0, Math.PI * 2);
      ctx.arc(sx + 15, baseY + 32.5, 1.6, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawCrystal(x, groundY, w, h, color) {
    const tipX = x + w * 0.5;
    const tipY = groundY - h;
    // Soft glow
    ctx.save();
    ctx.globalAlpha = 0.28;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(tipX, tipY + h * 0.35, w * 0.9, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Dark back facet
    drawPoly(
      [
        { x: tipX, y: tipY },
        { x: x + w * 0.15, y: groundY },
        { x: x + w * 0.55, y: groundY }
      ],
      shade(color, 0.62)
    );
    // Mid facet
    drawPoly(
      [
        { x: tipX, y: tipY },
        { x: x, y: groundY },
        { x: x + w * 0.35, y: groundY }
      ],
      shade(color, 0.88)
    );
    // Lit front facet
    drawPoly(
      [
        { x: tipX, y: tipY },
        { x: x + w * 0.45, y: groundY },
        { x: x + w, y: groundY }
      ],
      shade(color, 1.12),
      "rgba(255,255,255,0.45)"
    );
    // Specular edge
    ctx.strokeStyle = "rgba(255,255,255,0.55)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(tipX, tipY);
    ctx.lineTo(x + w * 0.72, groundY - 4);
    ctx.stroke();
  }

  function drawSpike(o) {
    const tip = deepCave ? "#a8d0f0" : "#e8f8ff";
    // Shadow
    ctx.save();
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = "#041018";
    ctx.beginPath();
    ctx.ellipse(o.x + o.w * 0.5, GROUND_Y + 4, o.w * 0.7, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    drawCrystal(o.x, GROUND_Y, o.w, o.h, tip);
    if (o.twin) drawCrystal(o.x + o.w * 0.95, GROUND_Y, o.w * 0.85, o.h - 10, tip);
  }

  function drawBat(o) {
    const flap = Math.sin(anim * 14) > 0;
    const color = deepCave ? "#b0d0ea" : "#d8f0ff";
    const by = GROUND_Y - o.y - o.h;

    // Hang strings from ceiling
    ctx.strokeStyle = deepCave ? "rgba(170,210,245,0.55)" : "rgba(220,240,255,0.75)";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(o.x + o.w * 0.35, 0);
    ctx.lineTo(o.x + o.w * 0.4, by + 6);
    ctx.moveTo(o.x + o.w * 0.65, 0);
    ctx.lineTo(o.x + o.w * 0.6, by + 6);
    ctx.stroke();

    drawShadeBox(o.x + o.w * 0.2, by, o.w * 0.6, o.h * 0.75, color, 8);
    const wingW = flap ? 34 : 22;
    drawShadeBox(o.x - 4, by + 10, wingW, 10, shade(color, 0.9), 6);
    drawShadeBox(o.x + o.w - wingW + 4, by + 10, wingW, 10, shade(color, 0.9), 6);

    if (dino && o.x < PLAYER_X + 220 && o.x > PLAYER_X && !dino.ducking) {
      ctx.fillStyle = "rgba(255, 220, 100, 0.95)";
      ctx.font = "700 15px Outfit, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("↓ DUCK", o.x + o.w * 0.5, by - 10);
    }
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    ctx.imageSmoothingEnabled = true;
    drawBackdrop();
    drawGround();
    flakes.forEach(drawFlake);

    const sorted = obstacles.slice().sort((a, b) => a.x - b.x);
    sorted.forEach((o) => (o.type === "bat" ? drawBat(o) : drawSpike(o)));

    drawChaseDragon();
    drawRunner();

    ctx.fillStyle = "#e8f4ff";
    ctx.font = "700 26px Outfit, sans-serif";
    ctx.textAlign = "right";
    ctx.shadowColor = "rgba(0,20,40,0.55)";
    ctx.shadowBlur = 6;
    ctx.fillText(String(Math.floor(score)).padStart(5, "0"), W - 24, 40);
    ctx.shadowBlur = 0;
    if (waitingStart && !dead) {
      ctx.textAlign = "center";
      ctx.font = "700 28px Outfit, sans-serif";
      ctx.fillStyle = "#e8f4ff";
      ctx.fillText("Press Space / Tap to run", W / 2, H * 0.42);
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
      scrollX += 35 * dt;
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
    if (e.clientY - pointerGesture.y > 22) {
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
