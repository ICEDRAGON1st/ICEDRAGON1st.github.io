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

  // Into-the-screen pseudo-3D (tuned so near objects read big & bright)
  const CAM_D = 240;
  const HORIZON = H * 0.22;
  const NEAR_Y = H * 0.9;
  const PATH_HALF = 190;
  const PLAYER_Z = 36;
  const GRAVITY = 2600;
  const JUMP_V = -920;
  const STAND_H = 72;
  const DUCK_H = 34;
  const Y_BOOST = 1.55; // vertical screen presence

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
    flakes = Array.from({ length: 42 }, (_, i) => ({
      x: ((i * 97) % 240) - 120,
      y: 30 + (i * 37) % 140,
      z: 60 + (i * 53) % 780,
      r: 1.4 + (i % 4) * 0.5
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
    const lane = (Math.random() - 0.5) * PATH_HALF * 1.05;
    if (score > 80 && roll < 0.34) {
      obstacles.push({
        type: "bat",
        mustDuck: true,
        x: lane * 0.4,
        y: 52,
        z: 980,
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
      x: lane,
      y: 0,
      z: 980,
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
    overlayTitle.textContent = canResume ? "Paused" : "Runosaur 3D";
    overlayText.textContent = canResume
      ? "The dragon is still behind you…"
      : "Run into the ice cave — jump frost crystals, hold ↓ / S to duck under hanging bats, strafe with A/D.";
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
    roadPhase += speed * dt;
    score += speed * dt * 0.09;

    flakes.forEach((f) => {
      f.z -= speed * 0.55 * dt;
      f.x += Math.sin(anim + f.z * 0.01) * 8 * dt;
      if (f.z < 20) {
        f.z = 760 + Math.random() * 220;
        f.x = (Math.random() - 0.5) * 240;
        f.y = 30 + Math.random() * 120;
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
      if (o.z < PLAYER_Z + 55 && o.z > PLAYER_Z - 25) {
        const dx = Math.abs(o.x - dino.x);
        const reach = o.type === "bat" ? 58 : o.twin ? 72 : 46;
        if (dx < reach) {
          if (o.type === "bat") {
            if (hitTop > o.y - 4 && hitBot < o.y + o.h) die();
          } else if (dino.y < o.h - 10) {
            die();
          }
        }
      }
    });
    obstacles = obstacles.filter((o) => o.z > -40);

    updateHud();
    checkAchievements();
    if (Math.floor(score) % 25 === 0) maybeSubmit(false);
  }

  /* ——— rendering ——— */
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

  function project(x, y, z) {
    const zz = Math.max(14, z);
    const scale = CAM_D / (CAM_D + zz);
    const t = 1 - scale;
    const groundY = HORIZON + (NEAR_Y - HORIZON) * Math.pow(t, 0.85);
    return {
      x: W * 0.5 + x * scale,
      y: groundY - y * scale * Y_BOOST,
      s: scale,
      groundY
    };
  }

  function pathEdgeX(z, side) {
    return project(side * PATH_HALF, 0, z).x;
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

  /** Box: bottom-center (x,y,z), size w×h×d in world units */
  function drawBoxAt(x, y, z, w, h, d, color, alpha = 1) {
    const x0 = x - w / 2;
    const x1 = x + w / 2;
    const y0 = y;
    const y1 = y + h;
    const z0 = z;
    const z1 = z + Math.max(10, d);

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
    drawPoly([blb, brb, brt, blt], shade(color, 0.58));
    drawPoly([flb, blb, blt, flt], shade(color, 0.74));
    drawPoly([frb, brb, brt, frt], shade(color, 0.82));
    drawPoly([flb, frb, frt, flt], shade(color, 0.98));
    drawPoly([flt, frt, brt, blt], shade(color, 1.18), "rgba(255,255,255,0.45)");
    ctx.restore();
  }

  function drawCrystalAt(x, z, w, h, color) {
    const tip = project(x, h, z + w * 0.25);
    const fl = project(x - w / 2, 0, z);
    const fr = project(x + w / 2, 0, z);
    const bl = project(x - w * 0.35, 0, z + w * 0.85);
    const br = project(x + w * 0.35, 0, z + w * 0.85);
    // soft glow
    ctx.save();
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(tip.x, tip.y + h * tip.s * 0.3, Math.max(8, w * tip.s * 1.2), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    drawPoly([tip, bl, br], shade(color, 0.62));
    drawPoly([tip, fl, bl], shade(color, 0.88));
    drawPoly([tip, fr, br], shade(color, 1.0));
    drawPoly([tip, fl, fr], shade(color, 1.22), "rgba(255,255,255,0.55)");
  }

  function drawBackdrop() {
    const skyTop = deepCave ? "#071018" : "#0e2040";
    const skyBot = deepCave ? "#122438" : "#1c4a72";
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, skyTop);
    g.addColorStop(0.4, deepCave ? "#0c1c30" : "#163858");
    g.addColorStop(1, skyBot);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // Bright tunnel mouth
    const glow = ctx.createRadialGradient(W * 0.5, HORIZON + 8, 6, W * 0.5, HORIZON + 20, W * 0.48);
    glow.addColorStop(0, deepCave ? "rgba(70,120,170,0.7)" : "rgba(140,200,255,0.65)");
    glow.addColorStop(0.35, deepCave ? "rgba(40,80,120,0.3)" : "rgba(80,150,210,0.28)");
    glow.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, NEAR_Y);

    const wall = deepCave ? "#1a3048" : "#2a5680";
    const wallDeep = deepCave ? "#0c1828" : "#143050";
    const nearL = pathEdgeX(16, -1);
    const nearR = pathEdgeX(16, 1);
    const farL = pathEdgeX(980, -1);
    const farR = pathEdgeX(980, 1);

    drawPoly(
      [
        { x: 0, y: 0 },
        { x: farL, y: HORIZON - 4 },
        { x: nearL, y: NEAR_Y },
        { x: 0, y: H }
      ],
      wallDeep
    );
    drawPoly(
      [
        { x: W, y: 0 },
        { x: farR, y: HORIZON - 4 },
        { x: nearR, y: NEAR_Y },
        { x: W, y: H }
      ],
      wallDeep
    );

    // Scrolling ice pillars on walls
    const pillarPhase = roadPhase * 0.35;
    for (let i = 0; i < 14; i++) {
      const z = 50 + ((i * 70 + pillarPhase) % 900);
      const tall = 70 + (i % 4) * 18;
      drawBoxAt(-PATH_HALF - 38, 0, z, 28, tall, 36, wall, 0.95);
      drawBoxAt(PATH_HALF + 38, 0, z + 20, 28, tall * 0.9, 36, wall, 0.95);
      // ice highlight chunks
      drawBoxAt(-PATH_HALF - 30, tall * 0.55, z + 4, 14, 16, 14, deepCave ? "#6a98c0" : "#9ed0f5", 0.85);
      drawBoxAt(PATH_HALF + 30, tall * 0.5, z + 24, 14, 16, 14, deepCave ? "#6a98c0" : "#9ed0f5", 0.85);
    }

    // Ceiling crystals
    for (let i = 0; i < 16; i++) {
      const z = 40 + ((i * 55 + roadPhase * 0.2) % 850);
      const cx = ((i * 47) % 9 - 4) * 22;
      const p = project(cx, 118, z);
      const s = Math.max(0.15, p.s);
      ctx.fillStyle = deepCave ? "rgba(150,190,230,0.45)" : "rgba(200,235,255,0.55)";
      ctx.beginPath();
      ctx.moveTo(p.x - 16 * s, HORIZON - 6);
      ctx.lineTo(p.x, p.y - 8);
      ctx.lineTo(p.x + 16 * s, HORIZON - 6);
      ctx.fill();
    }
  }

  function drawRoad() {
    const iceTop = deepCave ? "#5a8ab0" : "#a8daf8";
    const iceMid = deepCave ? "#3d6a90" : "#6eb8e0";
    const iceEdge = deepCave ? "#2a5070" : "#4a90b8";

    const nearL = project(-PATH_HALF, 0, 14);
    const nearR = project(PATH_HALF, 0, 14);
    const farL = project(-PATH_HALF, 0, 960);
    const farR = project(PATH_HALF, 0, 960);

    // Main bright ice slab
    const grad = ctx.createLinearGradient(0, farL.y, 0, nearL.y);
    grad.addColorStop(0, shade(iceMid, 0.85));
    grad.addColorStop(1, iceTop);
    drawPoly([nearL, nearR, farR, farL], grad);

    // Thick 3D curbs
    drawPoly(
      [
        nearL,
        farL,
        { x: farL.x - 22, y: farL.y + 8 },
        { x: nearL.x - 48, y: nearL.y + 22 }
      ],
      iceEdge
    );
    drawPoly(
      [
        nearR,
        farR,
        { x: farR.x + 22, y: farR.y + 8 },
        { x: nearR.x + 48, y: nearR.y + 22 }
      ],
      shade(iceEdge, 0.9)
    );

    // Front lip
    drawPoly(
      [
        nearL,
        nearR,
        { x: nearR.x + 10, y: nearR.y + 26 },
        { x: nearL.x - 10, y: nearL.y + 26 }
      ],
      shade(iceTop, 0.75)
    );

    // Grid
    ctx.lineWidth = 2;
    const spacing = 64;
    const phase = roadPhase % spacing;
    for (let z = 18 + (spacing - phase); z < 920; z += spacing) {
      const a = project(-PATH_HALF + 4, 1, z);
      const b = project(PATH_HALF - 4, 1, z);
      const fade = Math.min(1, (z - 18) / 80) * Math.max(0.15, 1 - z / 1000);
      ctx.strokeStyle = `rgba(255,255,255,${0.55 * fade})`;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    // Center line dashes
    for (let z = 18 + ((spacing * 0.5 - phase + spacing) % spacing); z < 900; z += spacing) {
      const a = project(-10, 1.5, z);
      const b = project(10, 1.5, z + 26);
      ctx.strokeStyle = deepCave ? "rgba(200,230,255,0.5)" : "rgba(255,255,255,0.75)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }

    ctx.strokeStyle = deepCave ? "rgba(180,220,255,0.55)" : "rgba(255,255,255,0.8)";
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(nearL.x, nearL.y);
    ctx.lineTo(farL.x, farL.y);
    ctx.moveTo(nearR.x, nearR.y);
    ctx.lineTo(farR.x, farR.y);
    ctx.stroke();
  }

  function drawFlake(f) {
    const p = project(f.x, f.y, f.z);
    const r = f.r * Math.max(0.8, p.s * 2.8);
    ctx.fillStyle = deepCave ? "rgba(190,220,250,0.55)" : "rgba(255,255,255,0.85)";
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  /** Big chase dragon — screen-space so it never sits on the path */
  function drawChaseDragon() {
    const bob = Math.sin(anim * 2.4) * 10;
    const threat = Math.min(1, score / 450);
    const baseX = 8 + threat * 28;
    const baseY = H - 150 + bob;
    const body = deepCave ? "#2a1838" : "#3d2460";
    const wing = deepCave ? "#1a1028" : "#2a1848";

    ctx.save();
    // Shadow blob
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = "#000";
    ctx.beginPath();
    ctx.ellipse(baseX + 90, H - 40, 100, 18, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    // Extruded body (screen-space isometric)
    const skew = 18;
    function box(sx, sy, sw, sh, sd, col) {
      const fl = { x: sx, y: sy + sh };
      const fr = { x: sx + sw, y: sy + sh };
      const ft = { x: sx, y: sy };
      const ftr = { x: sx + sw, y: sy };
      const bl = { x: sx + skew, y: sy + sh - sd };
      const br = { x: sx + sw + skew, y: sy + sh - sd };
      const bt = { x: sx + skew, y: sy - sd };
      const btr = { x: sx + sw + skew, y: sy - sd };
      drawPoly([bl, br, btr, bt], shade(col, 0.55));
      drawPoly([fr, br, btr, ftr], shade(col, 0.78));
      drawPoly([fl, fr, ftr, ft], shade(col, 0.95));
      drawPoly([ft, ftr, btr, bt], shade(col, 1.12), "rgba(255,255,255,0.25)");
    }

    box(baseX, baseY + 30, 120, 55, 28, body);
    box(baseX + 95, baseY + 18, 70, 42, 24, body);
    box(baseX + 150, baseY + 10, 44, 34, 20, shade(body, 1.1));
    // Horns
    ctx.fillStyle = deepCave ? "#8eb4d4" : "#c5e8ff";
    ctx.beginPath();
    ctx.moveTo(baseX + 168, baseY + 12);
    ctx.lineTo(baseX + 160, baseY - 18);
    ctx.lineTo(baseX + 178, baseY + 10);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(baseX + 182, baseY + 14);
    ctx.lineTo(baseX + 190, baseY - 10);
    ctx.lineTo(baseX + 192, baseY + 16);
    ctx.fill();
    // Eye
    ctx.fillStyle = "#ff3b3b";
    ctx.beginPath();
    ctx.arc(baseX + 178, baseY + 26, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(baseX + 176, baseY + 24, 1.5, 0, Math.PI * 2);
    ctx.fill();
    // Wing flap
    const flap = Math.sin(anim * 5) * 16;
    box(baseX + 30, baseY - 10 + flap * 0.3, 70, 14, 50 + flap, wing);

    if (Math.sin(chaseBreath * 3) > 0.45) {
      const ox = baseX + 195;
      const oy = baseY + 28;
      const breath = ctx.createLinearGradient(ox, oy, ox + 110, oy - 8);
      breath.addColorStop(0, "rgba(180,230,255,0.65)");
      breath.addColorStop(1, "rgba(180,230,255,0)");
      ctx.fillStyle = breath;
      ctx.beginPath();
      ctx.moveTo(ox, oy - 6);
      ctx.quadraticCurveTo(ox + 55, oy - 22, ox + 110, oy - 4);
      ctx.quadraticCurveTo(ox + 55, oy + 18, ox, oy + 8);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawRunner() {
    if (!dino) return;
    const x = dino.x;
    const y = dino.y;
    const z = PLAYER_Z;
    const ducking = dino.ducking;
    const onGround = dino.onGround;
    const leg = onGround ? Math.floor(anim * speed * 0.028) % 2 : 0;
    const body = deepCave ? "#d8ecff" : "#f4fbff";
    const accent = deepCave ? "#5a9aef" : "#3a8aef";
    const belly = deepCave ? "#a8c8e8" : "#c0dff8";
    const wingC = deepCave ? "#7ab0ff" : "#68b0ff";

    const sh = project(x, 0.8, z + 6);
    ctx.save();
    ctx.globalAlpha = Math.max(0.18, 0.5 - y * 0.0035);
    ctx.fillStyle = "#041018";
    ctx.beginPath();
    ctx.ellipse(sh.x, sh.groundY + 2, 58 * sh.s, 18 * sh.s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Large rear-view block dino so it reads clearly into the cave
    if (ducking) {
      drawBoxAt(x, y + 2, z, 96, 40, 58, accent);
      drawBoxAt(x + 18, y + 10, z + 10, 50, 24, 42, body);
      drawBoxAt(x - 38, y + 12, z + 14, 32, 14, 24, accent);
    } else {
      drawBoxAt(x - 20, y, z + 8, 24, 28 + (leg ? 6 : 0), 24, accent);
      drawBoxAt(x + 20, y, z + 14, 24, 28 + (leg ? 0 : 6), 24, accent);
      drawBoxAt(x, y + 24, z, 76, 56, 58, accent);
      drawBoxAt(x, y + 30, z + 8, 50, 34, 44, belly);
      drawBoxAt(x + 4, y + 72, z + 6, 56, 44, 48, body);
      drawBoxAt(x + 26, y + 82, z + 18, 28, 22, 30, accent);
      drawBoxAt(x - 6, y + 108, z + 14, 16, 24, 16, "#d0f0ff");
      drawBoxAt(x + 16, y + 112, z + 18, 14, 20, 14, "#d0f0ff");
      const wing = Math.sin(anim * 11) * 8;
      drawBoxAt(x - 36, y + 44 + wing * 0.25, z - 8, 30, 12, 62, wingC);
      drawBoxAt(x - 44, y + 38, z + 16, 36, 16, 22, accent);
      const eyeL = project(x - 8, y + 94, z + 48);
      const eyeR = project(x + 20, y + 94, z + 50);
      ctx.fillStyle = "#0a1520";
      ctx.beginPath();
      ctx.arc(eyeL.x, eyeL.y, 5.5, 0, Math.PI * 2);
      ctx.arc(eyeR.x, eyeR.y, 5.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(eyeL.x - 1.5, eyeL.y - 1.5, 1.7, 0, Math.PI * 2);
      ctx.arc(eyeR.x - 1.5, eyeR.y - 1.5, 1.7, 0, Math.PI * 2);
      ctx.fill();
    }

    const rim = project(x, y + (ducking ? 26 : 60), z + 8);
    ctx.save();
    ctx.globalAlpha = 0.25;
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(rim.x, rim.y, (ducking ? 42 : 58) * rim.s * 1.45, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  function drawSpike(o) {
    const tip = deepCave ? "#a8d0f0" : "#e8f8ff";
    drawCrystalAt(o.x, o.z, o.w, o.h, tip);
    if (o.twin) drawCrystalAt(o.x + o.w * 0.95, o.z + 10, o.w * 0.85, o.h - 10, tip);
  }

  function drawBat(o) {
    const flap = Math.sin(anim * 14) > 0;
    const color = deepCave ? "#b0d0ea" : "#d8f0ff";
    const mid = project(o.x, o.y + o.h, o.z);
    ctx.strokeStyle = deepCave ? "rgba(170,210,245,0.65)" : "rgba(220,240,255,0.85)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(mid.x - 10, HORIZON + 2);
    ctx.lineTo(mid.x - 5, mid.y);
    ctx.moveTo(mid.x + 10, HORIZON + 2);
    ctx.lineTo(mid.x + 5, mid.y);
    ctx.stroke();

    drawBoxAt(o.x, o.y, o.z, o.w * 0.6, o.h * 0.75, 34, color);
    const wingW = flap ? 42 : 26;
    drawBoxAt(o.x - 32, o.y + 12, o.z + 4, wingW, 10, 24, shade(color, 0.88));
    drawBoxAt(o.x + 32, o.y + 12, o.z + 4, wingW, 10, 24, shade(color, 0.88));

    if (dino && o.z < 300 && o.z > PLAYER_Z && !dino.ducking) {
      const label = project(o.x, o.y + o.h + 18, o.z);
      ctx.fillStyle = "rgba(255, 220, 100, 0.95)";
      ctx.font = "700 15px Outfit, sans-serif";
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

    const sorted = obstacles.slice().sort((a, b) => b.z - a.z);
    sorted.forEach((o) => (o.type === "bat" ? drawBat(o) : drawSpike(o)));

    drawRunner();
    drawChaseDragon();

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
      ctx.fillText("Press Space / Tap to flee into the cave", W / 2, H * 0.46);
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

  let swipeX0 = null;
  canvas?.addEventListener(
    "pointerdown",
    (e) => {
      swipeX0 = e.clientX;
    },
    true
  );
  canvas?.addEventListener(
    "pointerup",
    (e) => {
      if (swipeX0 == null || !dino || !running || paused || dead) {
        swipeX0 = null;
        return;
      }
      const dx = e.clientX - swipeX0;
      if (Math.abs(dx) > 40) {
        dino.x = Math.max(-PATH_HALF * 0.65, Math.min(PATH_HALF * 0.65, dino.x + Math.sign(dx) * 36));
      }
      swipeX0 = null;
    },
    true
  );

  resetWorld();
  waitingStart = true;
  updateHud();
  maybeSubmit(true);
  openMenu(false);
  raf = requestAnimationFrame(frame);
  window.addEventListener("beforeunload", () => maybeSubmit(true));
})();
