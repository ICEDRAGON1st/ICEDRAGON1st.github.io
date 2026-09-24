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
  const PLAYER_Z = 22;
  const GRAVITY = 2600;
  const JUMP_V = -920;
  const STAND_H = 72;
  const DUCK_H = 34;
  const Y_BOOST = 1.35; // vertical screen presence
  const STRAFE_SPEED = 220;

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
  const keys = { left: false, right: false };
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
      const steer = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
      if (steer) {
        dino.x = Math.max(
          -PATH_HALF * 0.65,
          Math.min(PATH_HALF * 0.65, dino.x + steer * STRAFE_SPEED * dt)
        );
      }
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

  function project(x, y, z) {
    const zz = Math.max(14, z);
    const scale = CAM_D / (CAM_D + zz);
    // t=0 at camera (near / bottom of screen), t→1 at horizon (far / top)
    const t = 1 - scale;
    const groundY = NEAR_Y + (HORIZON - NEAR_Y) * Math.pow(t, 0.85);
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

    // Front lip (near edge sits at bottom of screen)
    drawPoly(
      [
        nearL,
        nearR,
        { x: nearR.x + 14, y: Math.min(H - 2, nearR.y + 28) },
        { x: nearL.x - 14, y: Math.min(H - 2, nearL.y + 28) }
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

  /** Big chase dragon — screen-space, tucked in the left margin (not on the path) */
  function drawChaseDragon() {
    const bob = Math.sin(anim * 2.4) * 8;
    const threat = Math.min(1, score / 450);
    // Keep it in the letterbox margin so it never covers the runner.
    const baseX = -70 + threat * 36;
    const baseY = H - 130 + bob;
    const body = deepCave ? "#2a1838" : "#3d2460";
    const wing = deepCave ? "#1a1028" : "#2a1848";
    const alpha = 0.55 + threat * 0.4;

    ctx.save();
    ctx.globalAlpha = alpha;
    // Shadow blob
    ctx.globalAlpha = alpha * 0.35;
    ctx.fillStyle = "#000";
    ctx.beginPath();
    ctx.ellipse(baseX + 90, H - 36, 88, 14, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = alpha;

    // Extruded body (screen-space isometric)
    const skew = 16;
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

    box(baseX, baseY + 30, 100, 48, 24, body);
    box(baseX + 82, baseY + 18, 58, 36, 20, body);
    box(baseX + 128, baseY + 10, 38, 30, 18, shade(body, 1.1));
    // Horns
    ctx.fillStyle = deepCave ? "#8eb4d4" : "#c5e8ff";
    ctx.beginPath();
    ctx.moveTo(baseX + 142, baseY + 12);
    ctx.lineTo(baseX + 134, baseY - 14);
    ctx.lineTo(baseX + 152, baseY + 10);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(baseX + 154, baseY + 14);
    ctx.lineTo(baseX + 162, baseY - 8);
    ctx.lineTo(baseX + 164, baseY + 16);
    ctx.fill();
    // Eye
    ctx.fillStyle = "#ff3b3b";
    ctx.beginPath();
    ctx.arc(baseX + 150, baseY + 24, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(baseX + 148, baseY + 22, 1.4, 0, Math.PI * 2);
    ctx.fill();
    // Wing flap
    const flap = Math.sin(anim * 5) * 12;
    box(baseX + 24, baseY - 6 + flap * 0.3, 58, 12, 42 + flap, wing);

    if (Math.sin(chaseBreath * 3) > 0.45) {
      const ox = baseX + 168;
      const oy = baseY + 26;
      const breath = ctx.createLinearGradient(ox, oy, ox + 90, oy - 8);
      breath.addColorStop(0, "rgba(180,230,255,0.55)");
      breath.addColorStop(1, "rgba(180,230,255,0)");
      ctx.fillStyle = breath;
      ctx.beginPath();
      ctx.moveTo(ox, oy - 5);
      ctx.quadraticCurveTo(ox + 45, oy - 18, ox + 90, oy - 3);
      ctx.quadraticCurveTo(ox + 45, oy + 14, ox, oy + 7);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawRunner() {
    if (!dino) return;
    // Screen-space isometric dino anchored at projected feet (world boxes vanished into the path).
    const foot = project(dino.x, 0, PLAYER_Z);
    const lift = dino.y * foot.s * Y_BOOST;
    const sx = foot.x;
    const sy = foot.groundY - lift;
    const sc = Math.max(0.7, foot.s * 1.55);
    const ducking = dino.ducking;
    const onGround = dino.onGround;
    const leg = onGround ? Math.floor(anim * speed * 0.028) % 2 : 0;
    const body = deepCave ? "#e8f4ff" : "#ffffff";
    const accent = deepCave ? "#3d7fd4" : "#1e6ad4";
    const belly = deepCave ? "#9ec4ef" : "#7eb6f0";
    const wingC = deepCave ? "#5a9aef" : "#4a9cff";
    const crest = deepCave ? "#fff6c8" : "#ffe566";
    const skew = 14 * sc;

    ctx.save();
    ctx.globalAlpha = Math.max(0.25, 0.55 - dino.y * 0.0035);
    ctx.fillStyle = "#041018";
    ctx.beginPath();
    ctx.ellipse(sx, foot.groundY + 2, 58 * sc, 16 * sc, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    function box(px, py, pw, ph, pd, col) {
      const fl = { x: px, y: py + ph };
      const fr = { x: px + pw, y: py + ph };
      const ft = { x: px, y: py };
      const ftr = { x: px + pw, y: py };
      const bl = { x: px + skew, y: py + ph - pd };
      const br = { x: px + pw + skew, y: py + ph - pd };
      const bt = { x: px + skew, y: py - pd };
      const btr = { x: px + pw + skew, y: py - pd };
      drawPoly([bl, br, btr, bt], shade(col, 0.55));
      drawPoly([fr, br, btr, ftr], shade(col, 0.78));
      drawPoly([fl, fr, ftr, ft], shade(col, 1.02));
      drawPoly([ft, ftr, btr, bt], shade(col, 1.18), "rgba(255,255,255,0.35)");
    }

    function outlined(px, py, pw, ph, pd, col) {
      box(px - 2 * sc, py - 2 * sc, pw + 4 * sc, ph + 4 * sc, pd + 2 * sc, "#0a1a30");
      box(px, py, pw, ph, pd, col);
    }

    if (ducking) {
      const baseY = sy - 42 * sc;
      outlined(sx - 52 * sc, baseY + 8 * sc, 100 * sc, 34 * sc, 22 * sc, accent);
      outlined(sx - 18 * sc, baseY + 12 * sc, 56 * sc, 26 * sc, 18 * sc, body);
      outlined(sx - 58 * sc, baseY + 14 * sc, 32 * sc, 16 * sc, 14 * sc, accent);
      outlined(sx + 22 * sc, baseY + 6 * sc, 26 * sc, 18 * sc, 12 * sc, crest);
      ctx.fillStyle = "#0a1520";
      ctx.beginPath();
      ctx.arc(sx + 28 * sc, baseY + 18 * sc, 5 * sc, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(sx + 27 * sc, baseY + 17 * sc, 1.6 * sc, 0, Math.PI * 2);
      ctx.fill();
    } else {
      const baseY = sy - 118 * sc;
      const legH = (30 + (leg ? 6 : 0)) * sc;
      const legH2 = (30 + (leg ? 0 : 6)) * sc;
      outlined(sx - 36 * sc, sy - legH, 24 * sc, legH, 14 * sc, accent);
      outlined(sx + 8 * sc, sy - legH2, 24 * sc, legH2, 14 * sc, accent);
      outlined(sx - 40 * sc, baseY + 52 * sc, 78 * sc, 52 * sc, 24 * sc, accent);
      outlined(sx - 28 * sc, baseY + 58 * sc, 52 * sc, 34 * sc, 18 * sc, belly);
      outlined(sx - 30 * sc, baseY + 18 * sc, 58 * sc, 44 * sc, 20 * sc, body);
      outlined(sx + 8 * sc, baseY + 28 * sc, 28 * sc, 22 * sc, 14 * sc, accent);
      outlined(sx - 22 * sc, baseY - 4 * sc, 16 * sc, 24 * sc, 10 * sc, crest);
      outlined(sx + 4 * sc, baseY - 2 * sc, 14 * sc, 20 * sc, 10 * sc, crest);
      const wing = Math.sin(anim * 11) * 6 * sc;
      outlined(sx - 62 * sc, baseY + 48 * sc + wing, 32 * sc, 14 * sc, 28 * sc, wingC);
      outlined(sx - 68 * sc, baseY + 42 * sc, 34 * sc, 16 * sc, 12 * sc, accent);
      ctx.fillStyle = "#0a1520";
      ctx.beginPath();
      ctx.arc(sx - 8 * sc, baseY + 36 * sc, 5.5 * sc, 0, Math.PI * 2);
      ctx.arc(sx + 16 * sc, baseY + 36 * sc, 5.5 * sc, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(sx - 9.2 * sc, baseY + 34.5 * sc, 1.7 * sc, 0, Math.PI * 2);
      ctx.arc(sx + 14.8 * sc, baseY + 34.5 * sc, 1.7 * sc, 0, Math.PI * 2);
      ctx.fill();
    }
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
      keys.left = true;
    } else if (e.code === "ArrowRight" || e.code === "KeyD") {
      e.preventDefault();
      keys.right = true;
    } else if (e.code === "Escape") {
      pauseGame();
    }
  });
  window.addEventListener("keyup", (e) => {
    if (e.code === "ArrowDown" || e.code === "KeyS") {
      duckKeyHeld = false;
      syncDuck();
    } else if (e.code === "ArrowLeft" || e.code === "KeyA") {
      keys.left = false;
    } else if (e.code === "ArrowRight" || e.code === "KeyD") {
      keys.right = false;
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
