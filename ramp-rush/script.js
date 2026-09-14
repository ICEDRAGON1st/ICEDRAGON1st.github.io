(function () {
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const scoreEl = document.getElementById("score");
  const highScoreEl = document.getElementById("high-score");
  const speedLabelEl = document.getElementById("speed-label");
  const overlayBestEl = document.getElementById("overlay-best");
  const overlay = document.getElementById("overlay");
  const overlayTitle = document.getElementById("overlay-title");
  const overlayText = document.getElementById("overlay-text");
  const startBtn = document.getElementById("start-btn");
  const resumeBtn = document.getElementById("resume-btn");
  const gamesBtn = document.getElementById("games-btn");
  const menuBtn = document.getElementById("menu-btn");
  const leftBtn = document.getElementById("left-btn");
  const rightBtn = document.getElementById("right-btn");

  const HIGH_SCORE_KEY = "ramp-rush-high-score";
  const W = canvas.width;
  const H = canvas.height;
  const FOV = 280;
  const CAM_HEIGHT = 2.55;
  const HORIZON = H * 0.16;
  const SEGMENT_LEN = 4.5;
  const LOOK_AHEAD = 30;
  /** How steep the hill drops ahead of the ball (world Y falls as Z rises). */
  const HILL_SLOPE = 0.55;
  const GRAVITY_ACCEL = 3.8;

  let best = Math.max(0, Math.floor(Number(localStorage.getItem(HIGH_SCORE_KEY)) || 0));
  let running = false;
  let paused = false;
  let dead = false;
  let waitingStart = true;
  let score = 0;
  let speed = 14;
  let ballX = 0;
  let ballVX = 0;
  let worldZ = 0;
  let segments = [];
  let nextSegZ = 0;
  let lastTs = 0;
  let raf = 0;
  let sessionStarted = false;
  let lastSubmitAt = 0;
  let keys = { left: false, right: false };
  let touchLeft = false;
  let touchRight = false;
  let shake = 0;
  let sparks = [];

  function ensureSession() {
    if (sessionStarted) return;
    sessionStarted = true;
    window.HubPlays?.record?.("ramp");
    window.HubStreak?.recordPlay?.();
  }

  function updateHud() {
    if (scoreEl) scoreEl.textContent = String(Math.floor(score));
    if (highScoreEl) highScoreEl.textContent = String(best);
    if (overlayBestEl) overlayBestEl.textContent = String(best);
    if (speedLabelEl) speedLabelEl.textContent = `${(speed / 14).toFixed(1)}×`;
  }

  function maybeSubmit(force = false) {
    if (best <= 0 || !window.HubLeaderboard) return;
    const now = Date.now();
    if (!force && now - lastSubmitAt < 4000) return;
    lastSubmitAt = now;
    HubLeaderboard.submit("ramp", best).catch?.(() => {});
  }

  function checkAchievements() {
    if (!window.HubAchievements) return;
    if (score >= 25 || best >= 25) HubAchievements.unlock("ramp_score_25");
    if (score >= 75 || best >= 75) HubAchievements.unlock("ramp_score_75");
    if (score >= 150 || best >= 150) HubAchievements.unlock("ramp_score_150");
    if (best >= 250) HubAchievements.unlock("ramp_score_250");
  }

  function groundY(z) {
    // Track drops away downhill as you race forward (Y-up).
    return -HILL_SLOPE * (z - worldZ);
  }

  function project(x, y, z) {
    const relZ = z - worldZ;
    if (relZ <= 0.55) return null;
    // y = height above the local track surface. Camera sits above the player.
    const worldY = groundY(z) + y;
    const camY = CAM_HEIGHT;
    const scale = FOV / relZ;
    // Canvas Y grows downward: ground below the camera lands under the horizon,
    // and the slope makes distant track fall farther down the frame.
    return {
      x: W * 0.5 + x * scale,
      y: HORIZON + (camY - worldY) * scale,
      scale,
      z: relZ
    };
  }

  function rand(a, b) {
    return a + Math.random() * (b - a);
  }

  function makeSegment(z, difficulty) {
    const baseW = Math.max(3.2, 7.2 - difficulty * 0.35);
    const kindRoll = Math.random();
    let gap = null;
    let block = null;
    let taper = 0;

    if (difficulty > 0.4 && kindRoll < 0.22) {
      const side = Math.random() < 0.5 ? -1 : 1;
      const gw = rand(1.1, 1.8);
      gap = { x: side * (baseW * 0.5 - gw * 0.35), w: gw };
    } else if (difficulty > 0.2 && kindRoll < 0.48) {
      block = {
        x: rand(-baseW * 0.35, baseW * 0.35),
        w: rand(0.7, 1.25),
        h: rand(0.55, 1.1)
      };
    } else if (difficulty > 1.2 && kindRoll < 0.58) {
      taper = rand(0.35, 0.9);
    }

    return {
      z,
      width: baseW - taper,
      gap,
      block,
      stripe: Math.floor(z / SEGMENT_LEN) % 2
    };
  }

  function resetWorld() {
    score = 0;
    speed = 14;
    ballX = 0;
    ballVX = 0;
    worldZ = 0;
    nextSegZ = 0;
    segments = [];
    sparks = [];
    shake = 0;
    dead = false;
    for (let i = 0; i < LOOK_AHEAD; i += 1) {
      segments.push(makeSegment(nextSegZ, 0));
      nextSegZ += SEGMENT_LEN;
    }
    updateHud();
  }

  function currentSegment() {
    const z = worldZ + 2.2;
    let bestSeg = segments[0];
    let bestDist = Infinity;
    for (const seg of segments) {
      const mid = seg.z + SEGMENT_LEN * 0.5;
      const d = Math.abs(mid - z);
      if (d < bestDist) {
        bestDist = d;
        bestSeg = seg;
      }
    }
    return bestSeg;
  }

  function fillAhead() {
    const difficulty = Math.min(4.5, score / 40);
    while (segments.length && segments[0].z + SEGMENT_LEN < worldZ - 6) {
      segments.shift();
    }
    while (nextSegZ < worldZ + LOOK_AHEAD * SEGMENT_LEN) {
      segments.push(makeSegment(nextSegZ, difficulty));
      nextSegZ += SEGMENT_LEN;
    }
  }

  function die(reason) {
    if (dead) return;
    dead = true;
    running = false;
    shake = 10;
    window.HubSound?.play?.("miss");
    if (score > best) {
      best = Math.floor(score);
      try {
        localStorage.setItem(HIGH_SCORE_KEY, String(best));
      } catch {}
      window.HubConfetti?.burst?.();
    }
    checkAchievements();
    maybeSubmit(true);
    updateHud();
    if (overlayTitle) overlayTitle.textContent = "Wipeout";
    if (overlayText) {
      overlayText.textContent = `${reason} Score ${Math.floor(score)}. Steer smoother next run.`;
    }
    resumeBtn?.classList.add("hidden");
    overlay?.classList.remove("hidden");
    waitingStart = true;
  }

  function spawnSparks(x, y) {
    for (let i = 0; i < 10; i += 1) {
      sparks.push({
        x,
        y,
        vx: rand(-120, 120),
        vy: rand(-160, -40),
        life: rand(0.25, 0.55)
      });
    }
  }

  function update(dt) {
    if (!running || paused || dead) return;
    ensureSession();

    const steer = (keys.left || touchLeft ? -1 : 0) + (keys.right || touchRight ? 1 : 0);
    ballVX += steer * 28 * dt;
    ballVX *= Math.pow(0.08, dt);
    ballX += ballVX * dt;

    // Gravity pulls you down the hill — speed builds like a real descent.
    const targetSpeed = Math.min(48, 12 + score * 0.055);
    speed += (targetSpeed - speed) * Math.min(1, GRAVITY_ACCEL * dt);
    speed += HILL_SLOPE * 8 * dt;
    if (speed > 48) speed = 48;
    worldZ += speed * dt;
    score += speed * dt * 0.55;
    fillAhead();

    const seg = currentSegment();
    const half = seg.width * 0.5;
    if (Math.abs(ballX) > half - 0.18) {
      spawnSparks(W * 0.5 + ballX * 40, H * 0.72);
      die("You rolled off the ramp.");
      return;
    }
    if (seg.gap) {
      const gHalf = seg.gap.w * 0.5;
      if (Math.abs(ballX - seg.gap.x) < gHalf - 0.05) {
        die("You fell through a gap.");
        return;
      }
    }
    if (seg.block) {
      const bHalf = seg.block.w * 0.5;
      if (Math.abs(ballX - seg.block.x) < bHalf + 0.22) {
        spawnSparks(W * 0.5, H * 0.7);
        die("You hit a hazard block.");
        return;
      }
    }

    shake = Math.max(0, shake - dt * 18);
    for (let i = sparks.length - 1; i >= 0; i -= 1) {
      const p = sparks[i];
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 420 * dt;
      if (p.life <= 0) sparks.splice(i, 1);
    }

    if (Math.floor(score) % 25 === 0) checkAchievements();
    updateHud();
  }

  function drawBackground() {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#87b7ff");
    g.addColorStop(0.22, "#3a5f9a");
    g.addColorStop(0.42, "#152446");
    g.addColorStop(1, "#050814");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // Distant mountain ridges below the sky (you're looking down a valley).
    ctx.fillStyle = "#0d1830";
    ctx.beginPath();
    ctx.moveTo(0, HORIZON + 28);
    for (let i = 0; i <= 12; i += 1) {
      const x = (i / 12) * W;
      const y = HORIZON + 18 + Math.sin(i * 1.7 + worldZ * 0.02) * 16 + (i % 3) * 8;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(W, H);
    ctx.lineTo(0, H);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "#101f3c";
    ctx.beginPath();
    ctx.moveTo(0, HORIZON + 54);
    for (let i = 0; i <= 10; i += 1) {
      const x = (i / 10) * W;
      const y = HORIZON + 46 + Math.cos(i * 1.3 + worldZ * 0.03) * 12;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(W, H);
    ctx.lineTo(0, H);
    ctx.closePath();
    ctx.fill();

    for (let i = 0; i < 28; i += 1) {
      const sx = ((i * 97 + worldZ * 5) % W + W) % W;
      const sy = ((i * 53) % Math.max(12, HORIZON - 10)) + 6;
      ctx.fillStyle = `rgba(255, 255, 255, ${0.2 + (i % 4) * 0.1})`;
      ctx.fillRect(sx, sy, 2, 2);
    }
  }

  function drawHillSides() {
    // Soft earth banks beside the ramp so it feels carved into a hillside.
    const nearZ = worldZ + 1.2;
    const farZ = worldZ + LOOK_AHEAD * SEGMENT_LEN * 0.85;
    const leftNear = project(-14, -0.4, nearZ);
    const leftFar = project(-9, -1.8, farZ);
    const rightNear = project(14, -0.4, nearZ);
    const rightFar = project(9, -1.8, farZ);
    if (leftNear && leftFar) {
      ctx.beginPath();
      ctx.moveTo(0, H);
      ctx.lineTo(leftNear.x, leftNear.y);
      ctx.lineTo(leftFar.x, leftFar.y);
      ctx.lineTo(0, HORIZON + 40);
      ctx.closePath();
      ctx.fillStyle = "rgba(28, 48, 32, 0.55)";
      ctx.fill();
    }
    if (rightNear && rightFar) {
      ctx.beginPath();
      ctx.moveTo(W, H);
      ctx.lineTo(rightNear.x, rightNear.y);
      ctx.lineTo(rightFar.x, rightFar.y);
      ctx.lineTo(W, HORIZON + 40);
      ctx.closePath();
      ctx.fillStyle = "rgba(28, 48, 32, 0.55)";
      ctx.fill();
    }
  }

  function drawSegment(seg) {
    const z0 = seg.z;
    const z1 = seg.z + SEGMENT_LEN;
    const half = seg.width * 0.5;
    const p0l = project(-half, 0, z0);
    const p0r = project(half, 0, z0);
    const p1l = project(-half, 0, z1);
    const p1r = project(half, 0, z1);
    if (!p0l || !p0r || !p1l || !p1r) return;

    // Thickness / cliff edge under the ramp.
    const under0l = project(-half, -0.55, z0);
    const under0r = project(half, -0.55, z0);
    const under1l = project(-half, -0.55, z1);
    const under1r = project(half, -0.55, z1);
    if (under0l && under0r && under1l && under1r) {
      ctx.beginPath();
      ctx.moveTo(p0l.x, p0l.y);
      ctx.lineTo(p1l.x, p1l.y);
      ctx.lineTo(under1l.x, under1l.y);
      ctx.lineTo(under0l.x, under0l.y);
      ctx.closePath();
      ctx.fillStyle = "#0a1224";
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(p0r.x, p0r.y);
      ctx.lineTo(p1r.x, p1r.y);
      ctx.lineTo(under1r.x, under1r.y);
      ctx.lineTo(under0r.x, under0r.y);
      ctx.closePath();
      ctx.fillStyle = "#0a1224";
      ctx.fill();
    }

    ctx.beginPath();
    ctx.moveTo(p0l.x, p0l.y);
    ctx.lineTo(p0r.x, p0r.y);
    ctx.lineTo(p1r.x, p1r.y);
    ctx.lineTo(p1l.x, p1l.y);
    ctx.closePath();
    const shade = Math.max(0.35, 1 - seg.z * 0.002);
    ctx.fillStyle = seg.stripe ? `rgba(36, 58, 98, ${shade})` : `rgba(26, 42, 74, ${shade})`;
    ctx.fill();
    ctx.strokeStyle = "rgba(61, 214, 198, 0.4)";
    ctx.lineWidth = 2;
    ctx.stroke();

    const c0 = project(0, 0.03, z0 + 0.4);
    const c1 = project(0, 0.03, z1 - 0.4);
    if (c0 && c1) {
      ctx.beginPath();
      ctx.moveTo(c0.x, c0.y);
      ctx.lineTo(c1.x, c1.y);
      ctx.strokeStyle = "rgba(255, 230, 140, 0.28)";
      ctx.lineWidth = Math.max(1, c0.scale * 0.06);
      ctx.stroke();
    }

    if (seg.gap) {
      const gh = seg.gap.w * 0.5;
      const g0l = project(seg.gap.x - gh, -0.02, z0);
      const g0r = project(seg.gap.x + gh, -0.02, z0);
      const g1l = project(seg.gap.x - gh, -0.02, z1);
      const g1r = project(seg.gap.x + gh, -0.02, z1);
      if (g0l && g0r && g1l && g1r) {
        ctx.beginPath();
        ctx.moveTo(g0l.x, g0l.y);
        ctx.lineTo(g0r.x, g0r.y);
        ctx.lineTo(g1r.x, g1r.y);
        ctx.lineTo(g1l.x, g1l.y);
        ctx.closePath();
        ctx.fillStyle = "#050814";
        ctx.fill();
      }
    }

    if (seg.block) {
      const bh = seg.block.w * 0.5;
      const top = seg.block.h;
      const corners = [
        project(seg.block.x - bh, 0, z0 + 0.8),
        project(seg.block.x + bh, 0, z0 + 0.8),
        project(seg.block.x + bh, 0, z1 - 0.8),
        project(seg.block.x - bh, 0, z1 - 0.8),
        project(seg.block.x - bh, top, z0 + 0.8),
        project(seg.block.x + bh, top, z0 + 0.8),
        project(seg.block.x + bh, top, z1 - 0.8),
        project(seg.block.x - bh, top, z1 - 0.8)
      ];
      if (corners.every(Boolean)) {
        ctx.beginPath();
        ctx.moveTo(corners[4].x, corners[4].y);
        ctx.lineTo(corners[5].x, corners[5].y);
        ctx.lineTo(corners[6].x, corners[6].y);
        ctx.lineTo(corners[7].x, corners[7].y);
        ctx.closePath();
        ctx.fillStyle = "#ff5d7a";
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(corners[0].x, corners[0].y);
        ctx.lineTo(corners[1].x, corners[1].y);
        ctx.lineTo(corners[5].x, corners[5].y);
        ctx.lineTo(corners[4].x, corners[4].y);
        ctx.closePath();
        ctx.fillStyle = "#c43b55";
        ctx.fill();
      }
    }
  }

  function drawBall() {
    const p = project(ballX, 0.45, worldZ + 2.2);
    if (!p) return;
    const r = Math.max(4, p.scale * 0.38);
    const shadow = project(ballX, 0.02, worldZ + 2.2);
    if (shadow) {
      ctx.beginPath();
      ctx.ellipse(shadow.x, shadow.y, r * 1.1, r * 0.35, 0, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
      ctx.fill();
    }
    const grad = ctx.createRadialGradient(p.x - r * 0.3, p.y - r * 0.35, r * 0.1, p.x, p.y, r);
    grad.addColorStop(0, "#ffffff");
    grad.addColorStop(0.35, "#7dfff2");
    grad.addColorStop(1, "#1fa89a");
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.45)";
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  function draw() {
    ctx.save();
    if (shake > 0) {
      ctx.translate((Math.random() - 0.5) * shake * 2, (Math.random() - 0.5) * shake * 2);
    }
    drawBackground();
    drawHillSides();
    const sorted = [...segments].sort((a, b) => b.z - a.z);
    sorted.forEach(drawSegment);
    drawBall();
    for (const p of sparks) {
      ctx.globalAlpha = Math.max(0, p.life * 2);
      ctx.fillStyle = "#7dfff2";
      ctx.fillRect(p.x, p.y, 3, 3);
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  function frame(ts) {
    const dt = Math.min(0.033, (ts - (lastTs || ts)) / 1000);
    lastTs = ts;
    update(dt);
    draw();
    raf = requestAnimationFrame(frame);
  }

  function startGame() {
    resetWorld();
    running = true;
    paused = false;
    waitingStart = false;
    dead = false;
    overlay?.classList.add("hidden");
    resumeBtn?.classList.add("hidden");
    if (overlayTitle) overlayTitle.textContent = "Ramp Rush";
    window.HubSound?.play?.("click");
    ensureSession();
    updateHud();
  }

  function pauseGame() {
    if (!running || dead) {
      overlay?.classList.remove("hidden");
      return;
    }
    paused = true;
    running = false;
    if (overlayTitle) overlayTitle.textContent = "Paused";
    if (overlayText) overlayText.textContent = "Take a breath. The ramp will still be steep.";
    resumeBtn?.classList.remove("hidden");
    overlay?.classList.remove("hidden");
  }

  function resumeGame() {
    if (dead || waitingStart) {
      startGame();
      return;
    }
    paused = false;
    running = true;
    overlay?.classList.add("hidden");
    resumeBtn?.classList.add("hidden");
  }

  function setKey(code, down) {
    if (code === "ArrowLeft" || code === "KeyA") keys.left = down;
    if (code === "ArrowRight" || code === "KeyD") keys.right = down;
  }

  window.addEventListener("keydown", (e) => {
    if (["ArrowLeft", "ArrowRight", "KeyA", "KeyD", "Space"].includes(e.code)) e.preventDefault();
    setKey(e.code, true);
    if (e.code === "Space" || e.code === "Enter") {
      if (overlay && !overlay.classList.contains("hidden")) {
        if (paused && !dead) resumeGame();
        else startGame();
      }
    }
    if (e.code === "Escape") pauseGame();
  });
  window.addEventListener("keyup", (e) => setKey(e.code, false));

  function bindHold(btn, setter) {
    if (!btn) return;
    const on = (e) => {
      e.preventDefault();
      setter(true);
      btn.classList.add("is-held");
    };
    const off = (e) => {
      e.preventDefault();
      setter(false);
      btn.classList.remove("is-held");
    };
    btn.addEventListener("pointerdown", on);
    btn.addEventListener("pointerup", off);
    btn.addEventListener("pointerleave", off);
    btn.addEventListener("pointercancel", off);
  }
  bindHold(leftBtn, (v) => {
    touchLeft = v;
  });
  bindHold(rightBtn, (v) => {
    touchRight = v;
  });

  startBtn?.addEventListener("click", startGame);
  resumeBtn?.addEventListener("click", resumeGame);
  menuBtn?.addEventListener("click", pauseGame);
  gamesBtn?.addEventListener("click", () => {
    maybeSubmit(true);
    window.location.href = "../index.html#games";
  });

  resetWorld();
  updateHud();
  raf = requestAnimationFrame(frame);
  maybeSubmit(true);
})();
