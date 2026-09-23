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

  // Into-the-screen pseudo-3D
  const CAM_D = 280;
  const HORIZON = H * 0.28;
  const NEAR_Y = H * 0.92;
  const PATH_HALF = 160;
  const PLAYER_Z = 42;
  const GRAVITY = 2400;
  const JUMP_V = -820;
  const STAND_H = 58;
  const DUCK_H = 28;

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
  let roadPhase = 0;
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
    roadPhase = 0;
    obstacles = [];
    spawnTimer = 1.2;
    anim = 0;
    deepCave = false;
    chaseBreath = 0;
    dead = false;
    dino = {
      x: 0,
      y: 0,
      vy: 0,
      h: STAND_H,
      onGround: true,
      ducking: false
    };
    flakes = Array.from({ length: 36 }, (_, i) => ({
      x: ((i * 97) % 200) - 100,
      y: 20 + (i * 37) % 120,
      z: 80 + (i * 53) % 700,
      r: 1.2 + (i % 4) * 0.4
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
    const lane = (Math.random() - 0.5) * PATH_HALF * 1.1;
    if (score > 80 && roll < 0.34) {
      obstacles.push({
        type: "bat",
        mustDuck: true,
        x: lane * 0.35,
        y: 48,
        z: 920,
        w: 70,
        h: 36,
        passed: false
      });
      return;
    }
    const tall = Math.random() < 0.45;
    const twin = !tall && Math.random() < 0.35;
    obstacles.push({
      type: "spike",
      x: lane,
      y: 0,
      z: 920,
      w: tall ? 38 : 28,
      h: tall ? 70 : 48,
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
    overlayTitle.textContent = canResume ? "Paused" : "Runosaur 3D";
    overlayText.textContent = canResume
      ? "The dragon is still behind you…"
      : "Run into the ice cave — jump frost crystals, hold ↓ / S to duck under hanging bats, and stay ahead of the dragon.";
    startBtn.textContent = canResume || dead ? "Play again" : "Play";
    resumeBtn?.classList.toggle("hidden", !canResume);
    overlay?.classList.remove("hidden");
  }

  /** World (x across, y up, z forward) → screen + scale */
  function project(x, y, z) {
    const zz = Math.max(8, z);
    const scale = CAM_D / (CAM_D + zz);
    const groundY = HORIZON + (NEAR_Y - HORIZON) * (1 - scale * 0.92);
    return {
      x: W * 0.5 + x * scale,
      y: groundY - y * scale,
      s: scale,
      groundY
    };
  }

  function pathEdgeX(z, side) {
    const p = project(side * PATH_HALF, 0, z);
    return p.x;
  }

  function update(dt) {
    if (!running || paused || dead) return;
    anim += dt;
    speed = Math.min(640, 280 + score * 0.5);
    deepCave = score >= 400;
    chaseBreath += dt;
    roadPhase += speed * dt;
    score += speed * dt * 0.09;

    flakes.forEach((f) => {
      f.z -= speed * 0.55 * dt;
      f.x += Math.sin(anim + f.z * 0.01) * 8 * dt;
      if (f.z < 20) {
        f.z = 700 + Math.random() * 200;
        f.x = (Math.random() - 0.5) * 220;
        f.y = 30 + Math.random() * 100;
      }
    });

    if (dino) {
      dino.vy += GRAVITY * dt;
      dino.y += dino.vy * dt;
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
    obstacles.forEach((o) => {
      o.z -= speed * dt;
      if (!o.passed && o.z < PLAYER_Z - 8) o.passed = true;

      // Collision band near the player
      if (o.z < PLAYER_Z + 55 && o.z > PLAYER_Z - 25) {
        const dx = Math.abs(o.x - dino.x);
        const reach = o.type === "bat" ? 55 : o.twin ? 70 : 42;
        if (dx < reach) {
          if (o.type === "bat") {
            // Must duck: hits if standing head is high enough
            if (hitTop > o.y - 4 && hitBot < o.y + o.h) die();
          } else {
            // Ground crystal: jump over
            if (dino.y < o.h - 8) die();
          }
        }
      }
    });
    obstacles = obstacles.filter((o) => o.z > -40);

    updateHud();
    checkAchievements();
    if (Math.floor(score) % 25 === 0) maybeSubmit(false);
  }

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

  function drawPoly(points, fill, stroke) {
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
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }
  }

  /** Box standing on path: bottom center at (x,0,z), size w×h×d */
  function drawBoxAt(x, y, z, w, h, d, color, alpha = 1) {
    const z0 = z;
    const z1 = z + d;
    const y0 = y;
    const y1 = y + h;
    const x0 = x - w / 2;
    const x1 = x + w / 2;

    const flb = project(x0, y0, z0);
    const frb = project(x1, y0, z0);
    const blb = project(x0, y0, z1);
    const brb = project(x1, y0, z1);
    const flt = project(x0, y1, z0);
    const frt = project(x1, y1, z0);
    const blt = project(x0, y1, z1);
    const brt = project(x1, y1, z1);

    ctx.save();
    ctx.globalAlpha = alpha;
    // Far
    drawPoly([blb, brb, brt, blt], shade(color, 0.55));
    // Left / right
    drawPoly([flb, blb, blt, flt], shade(color, 0.72));
    drawPoly([frb, brb, brt, frt], shade(color, 0.78));
    // Near front
    drawPoly([flb, frb, frt, flt], shade(color, 0.92));
    // Top
    drawPoly([flt, frt, brt, blt], shade(color, 1.15), "rgba(255,255,255,0.35)");
    ctx.restore();
  }

  function drawCrystalAt(x, z, w, h, color) {
    const tip = project(x, h, z + w * 0.2);
    const fl = project(x - w / 2, 0, z);
    const fr = project(x + w / 2, 0, z);
    const bl = project(x - w / 2, 0, z + w * 0.7);
    const br = project(x + w / 2, 0, z + w * 0.7);
    drawPoly([tip, bl, br], shade(color, 0.65));
    drawPoly([tip, fl, bl], shade(color, 0.85));
    drawPoly([tip, fr, br], shade(color, 0.95));
    drawPoly([tip, fl, fr], shade(color, 1.18), "rgba(255,255,255,0.45)");
  }

  function drawBackdrop() {
    const top = deepCave ? "#04060e" : "#0a1528";
    const mid = deepCave ? "#0c1424" : "#143048";
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, top);
    g.addColorStop(0.35, mid);
    g.addColorStop(1, deepCave ? "#101828" : "#1a3858");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // Tunnel vanishing point glow
    const glow = ctx.createRadialGradient(W * 0.5, HORIZON, 4, W * 0.5, HORIZON, W * 0.42);
    glow.addColorStop(0, deepCave ? "rgba(40,70,110,0.55)" : "rgba(90,150,210,0.45)");
    glow.addColorStop(0.45, deepCave ? "rgba(20,40,70,0.2)" : "rgba(40,80,130,0.18)");
    glow.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, NEAR_Y);

    // Cave walls (perspective strips)
    const wallColor = deepCave ? "#1a2a40" : "#2a4a6e";
    const wallDark = deepCave ? "#0e1624" : "#183048";
    const nearL = pathEdgeX(18, -1);
    const nearR = pathEdgeX(18, 1);
    const farL = pathEdgeX(900, -1);
    const farR = pathEdgeX(900, 1);
    drawPoly(
      [
        { x: 0, y: 0 },
        { x: farL, y: HORIZON },
        { x: nearL, y: NEAR_Y },
        { x: 0, y: H }
      ],
      wallDark
    );
    drawPoly(
      [
        { x: W, y: 0 },
        { x: farR, y: HORIZON },
        { x: nearR, y: NEAR_Y },
        { x: W, y: H }
      ],
      wallDark
    );
    // Inner ice wall ribs
    for (let i = 0; i < 8; i++) {
      const z0 = 60 + i * 100;
      const z1 = z0 + 40;
      const a = project(-PATH_HALF - 30, 0, z0);
      const b = project(-PATH_HALF - 10, 90 + (i % 3) * 20, z0);
      const c = project(-PATH_HALF - 10, 90 + (i % 3) * 20, z1);
      const d = project(-PATH_HALF - 30, 0, z1);
      drawPoly([a, b, c, d], shade(wallColor, 0.9 + (i % 2) * 0.1), "rgba(140,190,230,0.15)");
      const a2 = project(PATH_HALF + 30, 0, z0);
      const b2 = project(PATH_HALF + 10, 90 + (i % 3) * 20, z0);
      const c2 = project(PATH_HALF + 10, 90 + (i % 3) * 20, z1);
      const d2 = project(PATH_HALF + 30, 0, z1);
      drawPoly([a2, b2, c2, d2], shade(wallColor, 0.9 + (i % 2) * 0.1), "rgba(140,190,230,0.15)");
    }

    // Ceiling ice fangs converging to horizon
    for (let i = 0; i < 12; i++) {
      const z = 40 + i * 70;
      const p = project(((i % 5) - 2) * 28, 130, z);
      const s = p.s;
      ctx.fillStyle = deepCave ? "rgba(120,160,200,0.35)" : "rgba(180,220,255,0.4)";
      ctx.beginPath();
      ctx.moveTo(p.x - 14 * s, HORIZON - 10);
      ctx.lineTo(p.x, p.y - 40 * s);
      ctx.lineTo(p.x + 14 * s, HORIZON - 10);
      ctx.fill();
    }
  }

  function drawRoad() {
    const ice = deepCave ? "#3d5a78" : "#7eb8dc";
    const iceDark = deepCave ? "#2a4058" : "#5a98c0";
    const nearL = project(-PATH_HALF, 0, 12);
    const nearR = project(PATH_HALF, 0, 12);
    const farL = project(-PATH_HALF, 0, 880);
    const farR = project(PATH_HALF, 0, 880);
    drawPoly([nearL, nearR, farR, farL], shade(ice, 1.05));

    // Side curb thickness
    drawPoly(
      [
        nearL,
        farL,
        { x: farL.x - 18, y: farL.y + 6 },
        { x: nearL.x - 36, y: nearL.y + 18 }
      ],
      shade(iceDark, 0.8)
    );
    drawPoly(
      [
        nearR,
        farR,
        { x: farR.x + 18, y: farR.y + 6 },
        { x: nearR.x + 36, y: nearR.y + 18 }
      ],
      shade(iceDark, 0.75)
    );

    // Scrolling center dashes + cross lines
    ctx.strokeStyle = deepCave ? "rgba(200,230,255,0.25)" : "rgba(255,255,255,0.4)";
    ctx.lineWidth = 2;
    const spacing = 70;
    const phase = roadPhase % spacing;
    for (let z = 20 + (spacing - phase); z < 850; z += spacing) {
      const a = project(-PATH_HALF, 0.5, z);
      const b = project(PATH_HALF, 0.5, z);
      ctx.globalAlpha = Math.min(1, z / 120);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      const c0 = project(-8, 0.5, z);
      const c1 = project(8, 0.5, z + 28);
      ctx.beginPath();
      ctx.moveTo(c0.x, c0.y);
      ctx.lineTo(c1.x, c1.y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // Lane edges
    ctx.strokeStyle = deepCave ? "rgba(160,200,240,0.45)" : "rgba(220,245,255,0.65)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(nearL.x, nearL.y);
    ctx.lineTo(farL.x, farL.y);
    ctx.moveTo(nearR.x, nearR.y);
    ctx.lineTo(farR.x, farR.y);
    ctx.stroke();
  }

  function drawFlake(f) {
    const p = project(f.x, f.y, f.z);
    ctx.fillStyle = deepCave ? "rgba(180,210,240,0.45)" : "rgba(255,255,255,0.75)";
    ctx.beginPath();
    ctx.arc(p.x, p.y, f.r * Math.max(0.6, p.s * 2.2), 0, Math.PI * 2);
    ctx.fill();
  }

  function drawChaseDragon() {
    // Looms just behind the camera / sides — scale pulses with chase
    const bob = Math.sin(anim * 2.2) * 6;
    const threat = Math.min(1, score / 500);
    const z = 8;
    const body = deepCave ? "#241430" : "#3a2458";
    drawBoxAt(-110 - threat * 10, 40 + bob, z, 90, 50, 40, body, 0.7);
    drawBoxAt(-70, 55 + bob, z + 10, 50, 34, 30, body, 0.75);
    drawCrystalAt(-55, z + 20, 14, 28, deepCave ? "#6a8cb0" : "#9ec5e8");
    const eye = project(-48, 70 + bob, z + 35);
    ctx.fillStyle = "#ff5050";
    ctx.beginPath();
    ctx.arc(eye.x, eye.y, 4, 0, Math.PI * 2);
    ctx.fill();

    if (Math.sin(chaseBreath * 3) > 0.5) {
      const o = project(-30, 60 + bob, z + 40);
      const breath = ctx.createLinearGradient(o.x, o.y, o.x + 90, o.y - 10);
      breath.addColorStop(0, "rgba(180,230,255,0.5)");
      breath.addColorStop(1, "rgba(180,230,255,0)");
      ctx.fillStyle = breath;
      ctx.beginPath();
      ctx.moveTo(o.x, o.y);
      ctx.quadraticCurveTo(o.x + 50, o.y - 18, o.x + 95, o.y - 4);
      ctx.quadraticCurveTo(o.x + 50, o.y + 14, o.x, o.y + 8);
      ctx.fill();
    }
  }

  function drawRunner() {
    if (!dino) return;
    const x = dino.x;
    const y = dino.y;
    const z = PLAYER_Z;
    const ducking = dino.ducking;
    const onGround = dino.onGround;
    const leg = onGround ? Math.floor(anim * speed * 0.025) % 2 : 0;
    const body = deepCave ? "#c5d8ec" : "#e8f4ff";
    const accent = deepCave ? "#5b8fd4" : "#3d7ecc";
    const belly = deepCave ? "#8aa8c8" : "#b8d4f0";

    // Shadow
    const sh = project(x, 0.5, z);
    ctx.save();
    ctx.globalAlpha = Math.max(0.12, 0.4 - y * 0.004);
    ctx.fillStyle = "#061018";
    ctx.beginPath();
    ctx.ellipse(sh.x, sh.y, 28 * sh.s * 2.5, 10 * sh.s * 2.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    if (ducking) {
      drawBoxAt(x, y + 4, z, 54, DUCK_H * 0.85, 36, accent);
      drawBoxAt(x + 16, y + 8, z + 6, 28, 16, 24, body);
      drawBoxAt(x - 22, y + 10, z + 8, 18, 10, 14, accent);
    } else {
      drawBoxAt(x - 10, y, z + 4, 12, 14 + (leg ? 3 : 0), 12, accent);
      drawBoxAt(x + 10, y, z + 8, 12, 14 + (leg ? 0 : 3), 12, accent);
      drawBoxAt(x, y + 12, z, 40, 34, 32, accent);
      drawBoxAt(x, y + 16, z + 4, 26, 20, 24, belly);
      drawBoxAt(x + 8, y + 38, z + 4, 28, 22, 26, body);
      drawBoxAt(x + 22, y + 42, z + 10, 14, 12, 16, accent);
      drawBoxAt(x + 4, y + 58, z + 8, 8, 14, 8, "#9ec5e8");
      const wing = Math.sin(anim * 10) * 5;
      drawBoxAt(x - 18, y + 28 + wing * 0.2, z - 4, 16, 8, 34, deepCave ? "#6a90c8" : "#5a96dc");
      drawBoxAt(x - 24, y + 22, z + 10, 20, 10, 12, accent);
      const eye = project(x + 14, y + 52, z + 28);
      ctx.fillStyle = "#0a1520";
      ctx.beginPath();
      ctx.arc(eye.x, eye.y, 3.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(eye.x - 1, eye.y - 1, 1.1, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawSpike(o) {
    const tip = deepCave ? "#8eb4d4" : "#d8f2ff";
    drawCrystalAt(o.x, o.z, o.w, o.h, tip);
    if (o.twin) drawCrystalAt(o.x + o.w * 0.9, o.z + 8, o.w * 0.85, o.h - 8, tip);
  }

  function drawBat(o) {
    const flap = Math.sin(anim * 14) > 0;
    const color = deepCave ? "#9bb8d4" : "#c5e0f5";
    // Tether to ceiling
    const top = project(o.x, 140, o.z);
    const mid = project(o.x, o.y + o.h, o.z);
    ctx.strokeStyle = deepCave ? "rgba(160,200,240,0.5)" : "rgba(210,235,255,0.7)";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(top.x - 8, HORIZON + 4);
    ctx.lineTo(mid.x - 4, mid.y);
    ctx.moveTo(top.x + 8, HORIZON + 4);
    ctx.lineTo(mid.x + 4, mid.y);
    ctx.stroke();

    drawBoxAt(o.x, o.y, o.z, o.w * 0.55, o.h * 0.7, 28, color);
    const wingW = flap ? 36 : 22;
    drawBoxAt(o.x - 28, o.y + 10, o.z + 4, wingW, 8, 20, shade(color, 0.85));
    drawBoxAt(o.x + 28, o.y + 10, o.z + 4, wingW, 8, 20, shade(color, 0.85));

    if (dino && o.z < 280 && o.z > PLAYER_Z && !dino.ducking) {
      const label = project(o.x, o.y + o.h + 16, o.z);
      ctx.fillStyle = "rgba(255, 220, 120, 0.95)";
      ctx.font = "700 14px Outfit, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("↓ DUCK", label.x, label.y);
    }
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    ctx.imageSmoothingEnabled = true;
    drawBackdrop();
    drawRoad();
    flakes.forEach(drawFlake);

    // Painter's algorithm: far → near
    const sorted = obstacles.slice().sort((a, b) => b.z - a.z);
    sorted.forEach((o) => (o.type === "bat" ? drawBat(o) : drawSpike(o)));

    drawChaseDragon();
    drawRunner();

    ctx.fillStyle = "#e8f4ff";
    ctx.font = "700 26px Outfit, sans-serif";
    ctx.textAlign = "right";
    ctx.shadowColor = "rgba(0,20,40,0.5)";
    ctx.shadowBlur = 6;
    ctx.fillText(String(Math.floor(score)).padStart(5, "0"), W - 24, 40);
    ctx.shadowBlur = 0;
    if (waitingStart && !dead) {
      ctx.textAlign = "center";
      ctx.font = "700 28px Outfit, sans-serif";
      ctx.fillText("Press Space / Tap to flee into the cave", W / 2, H * 0.48);
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
      roadPhase += 35 * dt;
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
    } else if (e.code === "ArrowLeft" || e.code === "KeyA") {
      e.preventDefault();
      if (dino && running && !paused && !dead) dino.x = Math.max(-PATH_HALF * 0.65, dino.x - 28);
    } else if (e.code === "ArrowRight" || e.code === "KeyD") {
      e.preventDefault();
      if (dino && running && !paused && !dead) dino.x = Math.min(PATH_HALF * 0.65, dino.x + 28);
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

  // Touch: swipe left/right to strafe
  let swipeX0 = null;
  canvas?.addEventListener("pointerdown", (e) => {
    swipeX0 = e.clientX;
  }, true);
  canvas?.addEventListener("pointerup", (e) => {
    if (swipeX0 == null || !dino || !running || paused || dead) {
      swipeX0 = null;
      return;
    }
    const dx = e.clientX - swipeX0;
    if (Math.abs(dx) > 40) {
      dino.x = Math.max(-PATH_HALF * 0.65, Math.min(PATH_HALF * 0.65, dino.x + Math.sign(dx) * 36));
    }
    swipeX0 = null;
  }, true);

  resetWorld();
  waitingStart = true;
  updateHud();
  maybeSubmit(true);
  openMenu(false);
  raf = requestAnimationFrame(frame);
  window.addEventListener("beforeunload", () => maybeSubmit(true));
})();
