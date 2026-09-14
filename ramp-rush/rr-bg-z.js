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
  const FOV = 300;
  const CAM_HEIGHT = 2.6;
  const CAM_BACK = 5.7;
  const HORIZON = H * 0.2;
  const SEGMENT_LEN = 4.5;
  const LOOK_AHEAD = 30;
  /** World Y drop per unit of Z — steep enough to read without breaking projection. */
  const HILL_SLOPE = 0.78;
  const GRAVITY_ACCEL = 4.4;
  const PLAYER_Z = 2.2;
  const AIR_GRAVITY = 26;
  const TRACK_HALF = 3.25;

  let best = Math.max(0, Math.floor(Number(localStorage.getItem(HIGH_SCORE_KEY)) || 0));
  let running = false;
  let paused = false;
  let dead = false;
  let waitingStart = true;
  let score = 0;
  let speed = 14;
  let ballX = 0;
  let ballVX = 0;
  let ballH = 0;
  let ballVH = 0;
  let airborne = false;
  let worldZ = 0;
  let segments = [];
  let nextSegZ = 0;
  let pendingSegs = [];
  let featureCooldown = 0;
  let lastTs = 0;
  let raf = 0;
  let sessionStarted = false;
  let lastSubmitAt = 0;
  let keys = { left: false, right: false };
  let touchLeft = false;
  let touchRight = false;
  let shake = 0;
  let sparks = [];
  let falling = false;
  let deathReason = "";
  let fallTimer = 0;
  let camX = 0;
  let camFollowY = 0;
  let boostT = 0;
  const BASE_SPEED = 14;
  const BOOST_MUL = 2.2;

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
    if (speedLabelEl) speedLabelEl.textContent = "1.0×";
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
    return -HILL_SLOPE * z;
  }

  function camPose() {
    const camZ = worldZ + PLAYER_Z - CAM_BACK;
    return {
      x: camX,
      z: camZ,
      y: groundY(camZ) + CAM_HEIGHT + camFollowY
    };
  }

  function project(x, y, z) {
    const cam = camPose();
    const relZ = z - cam.z;
    if (relZ <= 0.7) return null;
    const worldY = groundY(z) + y;
    const relY = worldY - cam.y;
    const scale = FOV / relZ;
    return {
      x: W * 0.5 + (x - cam.x) * scale,
      y: HORIZON - relY * scale,
      scale,
      z: relZ
    };
  }

  function updateCamera(dt) {
    // Slope-style chase cam: keep the ball near center and ride its height.
    const xRate = falling ? 7 : 11;
    const yRate = falling ? 6 : 8;
    camX += (ballX - camX) * Math.min(1, xRate * dt);
    const targetY = falling
      ? Math.min(0, ballH * 0.95 - 0.35)
      : ballH * 0.78;
    camFollowY += (targetY - camFollowY) * Math.min(1, yRate * dt);
  }

  function rand(a, b) {
    return a + Math.random() * (b - a);
  }

  function enqueueJump(difficulty) {
    const peak = rand(1.35, 2.35 + Math.min(0.8, difficulty * 0.12));
    const voidCount = Math.max(2, Math.min(4, Math.floor(rand(2.1, 3.0 + difficulty * 0.2))));
    pendingSegs.push({ ramp: { h0: 0, h1: peak * 0.4 }, raise: 0, boost: true });
    pendingSegs.push({ ramp: { h0: peak * 0.4, h1: peak }, raise: 0, boost: true });
    for (let i = 0; i < voidCount; i += 1) {
      const spec = { void: true, width: Math.max(3.4, 6.5 - difficulty * 0.25) };
      // Floating red killers in the jump lane.
      if (i > 0 && Math.random() < 0.55 + Math.min(0.25, difficulty * 0.05)) {
        spec.block = {
          x: rand(-1.4, 1.4),
          w: rand(0.75, 1.35),
          h: rand(0.7, 1.25),
          y: rand(peak * 0.35, peak * 0.95 + 0.6)
        };
      }
      pendingSegs.push(spec);
    }
    pendingSegs.push({ raise: rand(0, 0.4), width: Math.max(3.4, 6.8 - difficulty * 0.2) });
    featureCooldown = voidCount + 24;
  }

  function makeSegment(z, difficulty) {
    const baseW = Math.max(3.2, 7.2 - difficulty * 0.35);
    let gap = null;
    let block = null;
    let taper = 0;
    let raise = 0;
    let ramp = null;
    let isVoid = false;
    let width = baseW;
    let pendingBoost = false;

    if (pendingSegs.length) {
      const spec = pendingSegs.shift();
      if (spec.void) {
        return {
          z,
          width: spec.width || baseW,
          gap: null,
          block: spec.block || null,
          ramp: null,
          raise: 0,
          void: true,
          stripe: Math.floor(z / SEGMENT_LEN) % 2
        };
      }
      ramp = spec.ramp || null;
      raise = spec.raise || 0;
      block = spec.block || null;
      if (spec.width) width = spec.width;
      pendingBoost = !!spec.boost || !!ramp;
    } else if (difficulty > 0.85 && featureCooldown <= 0 && Math.random() < 0.065) {
      enqueueJump(difficulty);
      return makeSegment(z, difficulty);
    } else {
      const kindRoll = Math.random();
      if (difficulty > 0.4 && kindRoll < 0.18) {
        const side = Math.random() < 0.5 ? -1 : 1;
        const gw = rand(1.1, 1.8);
        gap = { x: side * (baseW * 0.5 - gw * 0.35), w: gw };
      } else if (difficulty > 0.2 && kindRoll < 0.45) {
        // Ground killers only on normal track — air blocks spawn on jump voids.
        block = {
          x: rand(-baseW * 0.35, baseW * 0.35),
          w: rand(0.7, 1.25),
          h: rand(0.55, 1.15),
          y: 0
        };
      } else if (difficulty > 1.2 && kindRoll < 0.55) {
        taper = rand(0.35, 0.9);
        width = baseW - taper;
      }
    }

    if (featureCooldown > 0) featureCooldown -= 1;

    return {
      z,
      width,
      gap,
      block,
      ramp,
      raise,
      boost: pendingBoost || !!ramp,
      void: isVoid,
      stripe: Math.floor(z / SEGMENT_LEN) % 2
    };
  }

  function resetWorld() {
    score = 0;
    speed = 14;
    ballX = 0;
    ballVX = 0;
    ballH = 0;
    ballVH = 0;
    airborne = false;
    worldZ = 0;
    nextSegZ = 0;
    segments = [];
    pendingSegs = [];
    sparks = [];
    shake = 0;
    dead = false;
    falling = false;
    deathReason = "";
    fallTimer = 0;
    camX = 0;
    camFollowY = 0;
    boostT = 0;
    speed = BASE_SPEED;

    // Score ≈ 0.55 * worldZ, so ~20 points ≈ this many safe segments.
    const firstHazardScore = 20;
    const safeCount = Math.max(3, Math.floor(firstHazardScore / 0.55 / SEGMENT_LEN));
    for (let i = 0; i < safeCount; i += 1) {
      segments.push(makeSegment(nextSegZ, 0));
      nextSegZ += SEGMENT_LEN;
    }

    // First encounter: jump ramp or red killer around the 20-point mark.
    if (Math.random() < 0.5) {
      enqueueJump(0.9);
    } else {
      pendingSegs.push({
        raise: 0,
        block: {
          x: rand(-1.3, 1.3),
          w: rand(0.85, 1.3),
          h: rand(0.7, 1.15),
          y: 0
        }
      });
      featureCooldown = 22;
    }

    while (segments.length < LOOK_AHEAD) {
      segments.push(makeSegment(nextSegZ, 0.5));
      nextSegZ += SEGMENT_LEN;
    }
    updateHud();
  }

  function segmentAt(z) {
    for (const seg of segments) {
      if (z >= seg.z && z < seg.z + SEGMENT_LEN) return seg;
    }
    return segments[0] || null;
  }

  function currentSegment() {
    return segmentAt(worldZ + PLAYER_Z);
  }

  function surfaceHeight(z) {
    const seg = segmentAt(z);
    if (!seg || seg.void) return null;
    if (seg.ramp) {
      const t = Math.max(0, Math.min(1, (z - seg.z) / SEGMENT_LEN));
      return seg.ramp.h0 + (seg.ramp.h1 - seg.ramp.h0) * t;
    }
    return seg.raise || 0;
  }

  function rampSlope(z) {
    const seg = segmentAt(z);
    if (!seg || !seg.ramp) return 0;
    return (seg.ramp.h1 - seg.ramp.h0) / SEGMENT_LEN;
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

  function finishWipeout(reason) {
    if (dead) return;
    dead = true;
    falling = false;
    running = false;
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

  function beginFall(reason, opts = {}) {
    if (dead || falling) return;
    falling = true;
    deathReason = reason;
    fallTimer = 0;
    airborne = true;
    if (opts.fling !== false) {
      const side = ballX === 0 ? (Math.random() < 0.5 ? -1 : 1) : Math.sign(ballX);
      // Soft Slope-style tip-off — keep most of your sideways speed, no hard fling.
      ballVX = side * Math.max(Math.abs(ballVX) * 0.85, 2.2);
      if (ballVH > 1) ballVH *= 0.35;
      else ballVH = Math.min(ballVH, 0.4);
    }
    shake = Math.max(shake, 3);
    window.HubSound?.play?.("miss");
    const puff = project(ballX, ballH + 0.4, worldZ + PLAYER_Z);
    if (puff) spawnSparks(puff.x, puff.y);
  }

  function die(reason) {
    if (dead || falling) return;
    shake = 10;
    window.HubSound?.play?.("miss");
    finishWipeout(reason);
  }

  function updateFall(dt) {
    fallTimer += dt;
    // Still allow a little steering during the tip so it feels less sudden.
    const steer = (keys.left || touchLeft ? -1 : 0) + (keys.right || touchRight ? 1 : 0);
    ballVX += steer * 18 * dt;
    ballVX *= Math.pow(0.7, dt);
    ballX += ballVX * dt;
    ballVH -= AIR_GRAVITY * 0.95 * dt;
    ballH += ballVH * dt;
    // Keep drifting forward so the neon road slips away above you.
    worldZ += Math.max(6, BASE_SPEED * 0.75) * dt;
    fillAhead();
    updateCamera(dt);

    shake = Math.max(0, shake - dt * 10);
    if (Math.random() < dt * 10) {
      const puff = project(ballX, ballH + 0.3, worldZ + PLAYER_Z);
      if (puff) {
        sparks.push({
          x: puff.x,
          y: puff.y,
          vx: rand(-80, 80),
          vy: rand(-40, 60),
          life: rand(0.18, 0.4)
        });
      }
    }
    for (let i = sparks.length - 1; i >= 0; i -= 1) {
      const p = sparks[i];
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 420 * dt;
      if (p.life <= 0) sparks.splice(i, 1);
    }

    if (fallTimer > 1.9 || ballH < -22 || camFollowY < -18) {
      finishWipeout(deathReason || "You fell into the void.");
    }
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
    if (paused || dead) return;
    if (falling) {
      updateFall(dt);
      return;
    }
    if (!running) return;
    ensureSession();

    const steer = (keys.left || touchLeft ? -1 : 0) + (keys.right || touchRight ? 1 : 0);
    // Faster sideways only — does not raise forward speed.
    ballVX += steer * 58 * dt;
    ballVX *= Math.pow(0.22, dt);
    ballX += ballVX * dt;
    updateCamera(dt);

    fillAhead();

    const pz = worldZ + PLAYER_Z;
    const seg = currentSegment();
    const surf = surfaceHeight(pz);
    const slope = rampSlope(pz);

    // Constant 1× downhill; ramps are speed-boost pads.
    const onBoost = !airborne && seg && seg.boost;
    if (onBoost) {
      boostT = 1.05;
      if (Math.random() < dt * 18) {
        const puff = project(ballX, ballH + 0.2, pz);
        if (puff) spawnSparks(puff.x, puff.y);
      }
    } else if (boostT > 0) {
      boostT = Math.max(0, boostT - dt);
    }
    const travel = BASE_SPEED * (boostT > 0 ? BOOST_MUL : 1);
    speed = BASE_SPEED;
    worldZ += travel * dt;
    score += travel * dt * 0.55;
    if (speedLabelEl) speedLabelEl.textContent = "1.0×";

    if (!airborne) {
      if (surf == null) {
        airborne = true;
        ballVH = Math.min(ballVH, 1.5);
      } else {
        ballH = surf;
        const ahead = surfaceHeight(pz + 1.35);
        // Launch off a rising ramp into open void.
        if (ahead == null && slope > 0.12) {
          airborne = true;
          ballVH = Math.max(9, slope * speed * 1.55 + 3.5);
          window.HubSound?.play?.("click");
        }
      }
    } else {
      ballVH -= AIR_GRAVITY * dt;
      ballH += ballVH * dt;
      if (surf != null && ballH <= surf + 0.05 && ballVH <= 2) {
        ballH = surf;
        ballVH = 0;
        airborne = false;
        const land = project(ballX, ballH, pz);
        if (land) spawnSparks(land.x, land.y);
      } else if (ballH < -4.5) {
        beginFall("You fell into the void.", { fling: false });
        return;
      }
    }

    if (!seg) return;
    const half = seg.width * 0.5;
    // Slope-style lip: hang past the neon edge and steer back before tipping off.
    const lip = 0.72;
    const dropOff = half + lip;

    if (!airborne) {
      const ax = Math.abs(ballX);
      if (ax > half) {
        const side = Math.sign(ballX) || 1;
        const over = ax - half;
        // Soft resistance near the lip — easier to recover toward center.
        const steer = (keys.left || touchLeft ? -1 : 0) + (keys.right || touchRight ? 1 : 0);
        if (steer && Math.sign(steer) !== side) {
          ballVX += -side * 38 * dt;
        } else {
          // Slow outward creep only when deep on the lip.
          ballVX += side * Math.min(4.5, over * 3.2) * dt;
        }
        // Slight tip look without killing yet.
        ballH = Math.max(-0.12, (surf == null ? 0 : surf) - over * 0.08);
        if (ax > dropOff) {
          beginFall("You rolled off the ramp.");
          return;
        }
      }
      if (seg.gap) {
        const gHalf = seg.gap.w * 0.5;
        // Need to be more centered in the gap before falling through.
        if (Math.abs(ballX - seg.gap.x) < gHalf - 0.35) {
          beginFall("You fell through a gap.", { fling: false });
          ballVH = Math.min(ballVH, 0.6);
          return;
        }
      }
    } else if (Math.abs(ballX) > half + 2.6) {
      beginFall("You drifted into the void.");
      return;
    }

    if (seg.block) {
      const bHalf = seg.block.w * 0.5;
      const baseH = seg.void ? 0 : (seg.ramp ? Math.max(seg.ramp.h0, seg.ramp.h1) : seg.raise || 0);
      const bBottom = baseH + (seg.block.y || 0);
      const bTop = bBottom + seg.block.h;
      const ballBottom = ballH;
      const ballTop = ballH + 0.85;
      const overlapX = Math.abs(ballX - seg.block.x) < bHalf + 0.22;
      const overlapY = ballTop > bBottom + 0.05 && ballBottom < bTop - 0.05;
      if (overlapX && overlapY) {
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

  function drawPlanet(cx, cy, r, c0, c1, ring) {
    const glow = ctx.createRadialGradient(cx - r * 0.25, cy - r * 0.3, r * 0.1, cx, cy, r * 1.9);
    glow.addColorStop(0, "rgba(255,255,255,0.2)");
    glow.addColorStop(0.35, c0);
    glow.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 1.9, 0, Math.PI * 2);
    ctx.fill();

    const body = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.4, r * 0.12, cx, cy, r);
    body.addColorStop(0, "#ffffff");
    body.addColorStop(0.22, c0);
    body.addColorStop(1, c1);
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = body;
    ctx.fill();

    if (ring) {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(1, 0.28);
      ctx.beginPath();
      ctx.ellipse(0, 0, r * 1.9, r * 1.9, 0, 0, Math.PI * 2);
      ctx.strokeStyle = ring;
      ctx.lineWidth = Math.max(1.5, r * 0.2);
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(0, 0, r * 1.55, r * 1.55, 0, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(255,255,255,0.14)";
      ctx.lineWidth = Math.max(1, r * 0.08);
      ctx.stroke();
      ctx.restore();
      ctx.beginPath();
      ctx.arc(cx, cy, r, Math.PI * 1.02, Math.PI * 1.98);
      ctx.fillStyle = body;
      ctx.fill();
    }
  }

  function drawBackground() {
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, "#010208");
    sky.addColorStop(0.35, "#050816");
    sky.addColorStop(0.65, "#0a1024");
    sky.addColorStop(1, "#10182e");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    const nebulae = [
      [W * 0.18, HORIZON * 0.35, W * 0.42, "rgba(70, 40, 160, 0.16)", "rgba(30, 120, 255, 0.05)"],
      [W * 0.78, HORIZON * 0.45, W * 0.36, "rgba(180, 40, 120, 0.14)", "rgba(80, 20, 140, 0.04)"],
      [W * 0.52, HORIZON * 0.18, W * 0.28, "rgba(40, 180, 200, 0.1)", "rgba(20, 60, 140, 0.03)"]
    ];
    for (const [nx, ny, nr, a, b] of nebulae) {
      const g = ctx.createRadialGradient(nx, ny, 2, nx, ny, nr);
      g.addColorStop(0, a);
      g.addColorStop(0.55, b);
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(nx, ny, nr, 0, Math.PI * 2);
      ctx.fill();
    }

    const skyH = Math.max(20, HORIZON + 8);
    for (let i = 0; i < 240; i += 1) {
      const layer = i % 3;
      const drift = worldZ * (0.12 + layer * 0.18);
      const sx = ((i * 97.3 + drift * (12 + layer * 9)) % W + W) % W;
      const sy = (i * 53.1 + i * i * 0.13) % skyH;
      const twinkle = 0.35 + 0.65 * Math.abs(Math.sin(worldZ * 0.04 + i));
      const a = (0.16 + (i % 7) * 0.09) * twinkle;
      const size = layer === 0 ? 1 : layer === 1 ? 1.45 : 2;
      ctx.fillStyle = i % 11 === 0
        ? "rgba(180,220,255," + a + ")"
        : i % 9 === 0
          ? "rgba(255,210,240," + a + ")"
          : "rgba(230,240,255," + a + ")";
      ctx.fillRect(sx, sy, size, size);
      if (i % 17 === 0) {
        ctx.fillStyle = "rgba(255,255,255," + (a * 0.55) + ")";
        ctx.fillRect(sx - 1.2, sy + size * 0.25, size + 2.4, 0.7);
        ctx.fillRect(sx + size * 0.25, sy - 1.2, 0.7, size + 2.4);
      }
    }

    const driftX = (worldZ * 0.35) % (W + 200);
    drawPlanet(
      ((W * 0.16 - driftX * 0.15) % (W + 120) + W + 120) % (W + 120) - 40,
      HORIZON * 0.42,
      18,
      "rgba(90, 200, 255, 0.95)",
      "rgba(20, 60, 140, 1)",
      null
    );
    drawPlanet(
      ((W * 0.72 + driftX * 0.08) % (W + 160) + W + 160) % (W + 160) - 40,
      HORIZON * 0.28,
      28,
      "rgba(255, 170, 110, 0.95)",
      "rgba(120, 45, 30, 1)",
      "rgba(255, 210, 150, 0.35)"
    );
    drawPlanet(
      ((W * 0.88 - driftX * 0.05) % (W + 100) + W + 100) % (W + 100) - 30,
      HORIZON * 0.55,
      10,
      "rgba(200, 140, 255, 0.9)",
      "rgba(70, 30, 120, 1)",
      null
    );

    for (let i = 0; i < 6; i += 1) {
      const mx = ((i * 155 + 40 - worldZ * (0.2 + i * 0.05)) % (W + 40) + W + 40) % (W + 40) - 20;
      const my = 10 + (i * 17) % Math.max(10, HORIZON - 22);
      const mr = 2 + (i % 3);
      ctx.beginPath();
      ctx.arc(mx, my, mr, 0, Math.PI * 2);
      ctx.fillStyle = i % 2 ? "rgba(200, 210, 230, 0.55)" : "rgba(160, 190, 255, 0.45)";
      ctx.fill();
    }

    const cometPhase = (worldZ * 0.55) % 420;
    if (cometPhase < 150) {
      const cx = W * 0.08 + cometPhase * 2.15;
      const cy = 16 + cometPhase * 0.17;
      const tail = ctx.createLinearGradient(cx, cy, cx - 78, cy - 14);
      tail.addColorStop(0, "rgba(200, 240, 255, 0.6)");
      tail.addColorStop(1, "rgba(200, 240, 255, 0)");
      ctx.strokeStyle = tail;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx - 78, cy - 14);
      ctx.stroke();
      ctx.fillStyle = "rgba(255,255,255,0.95)";
      ctx.beginPath();
      ctx.arc(cx, cy, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }

    for (let i = 0; i < 28; i += 1) {
      const lx = W * 0.08 + i * (W * 0.032) + Math.sin(worldZ * 0.02 + i) * 3;
      const ly = HORIZON + 3 + (i % 4);
      ctx.fillStyle = i % 3 !== 1 ? "rgba(80, 240, 255, 0.5)" : "rgba(255, 70, 180, 0.4)";
      ctx.fillRect(lx, ly, 2, 2);
    }

    const streakCount = running ? 28 : 10;
    for (let i = 0; i < streakCount; i += 1) {
      const y = HORIZON + 24 + ((i * 41 + worldZ * 10) % (H - HORIZON - 50));
      const len = 18 + (i % 5) * 10;
      const x = ((i * 109 - worldZ * (running ? 48 : 8)) % (W + len) + W + len) % (W + len) - len;
      ctx.strokeStyle = i % 4 !== 2
        ? "rgba(60, 230, 255," + (0.05 + (i % 3) * 0.025) + ")"
        : "rgba(255, 60, 170," + (0.04 + (i % 3) * 0.02) + ")";
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + len, y);
      ctx.stroke();
    }

    const haze = ctx.createLinearGradient(0, HORIZON, 0, H);
    haze.addColorStop(0, "rgba(8, 14, 30, 0)");
    haze.addColorStop(0.55, "rgba(3, 8, 18, 0.35)");
    haze.addColorStop(1, "rgba(0, 0, 0, 0.65)");
    ctx.fillStyle = haze;
    ctx.fillRect(0, HORIZON, W, H - HORIZON);
  }

  function rockQuad(x0, y0, z0, x1, y1, z1, x2, y2, z2, x3, y3, z3, fill, stroke) {
    const a = project(x0, y0, z0);
    const b = project(x1, y1, z1);
    const c = project(x2, y2, z2);
    const d = project(x3, y3, z3);
    if (!(a && b && c && d)) return false;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.lineTo(c.x, c.y);
    ctx.lineTo(d.x, d.y);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }
    return true;
  }

  function drawNeonLine(p0, p1, color, width, glow) {
    if (!p0 || !p1) return;
    ctx.beginPath();
    ctx.moveTo(p0.x, p0.y);
    ctx.lineTo(p1.x, p1.y);
    ctx.strokeStyle = glow;
    ctx.lineWidth = width * 3.2;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(p0.x, p0.y);
    ctx.lineTo(p1.x, p1.y);
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.stroke();
  }

  function drawDescentScenery() {
    const nearZ = worldZ + 2.0;
    const farZ = worldZ + 90;
    const step = 2.6;
    const lampStep = 7.0;

    for (let z = farZ; z >= nearZ; z -= step * 2) {
      const z1 = z + step * 2;
      const fade = Math.max(0.25, 1 - (z - worldZ) * 0.01);
      rockQuad(
        -TRACK_HALF - 1.4, -3.8, z,
        TRACK_HALF + 1.4, -3.8, z,
        TRACK_HALF + 1.4, -3.8, z1,
        -TRACK_HALF - 1.4, -3.8, z1,
        "rgba(0,0,0," + (0.6 * fade) + ")",
        null
      );
    }

    // Continuous neon edge rails (Slope vibe)
    for (let z = Math.floor((worldZ + 2) / step) * step; z < worldZ + 72; z += step) {
      const fade = Math.max(0.2, 1 - (z - worldZ) * 0.012);
      const z1 = z + step;
      for (const side of [-1, 1]) {
        const x = side * (TRACK_HALF + 0.12);
        const a0 = project(x, 0.04, z);
        const a1 = project(x, 0.04, z1);
        const pink = side > 0;
        const core = pink
          ? "rgba(255, 70, 190," + (0.75 * fade) + ")"
          : "rgba(60, 240, 255," + (0.8 * fade) + ")";
        const halo = pink
          ? "rgba(255, 40, 160," + (0.18 * fade) + ")"
          : "rgba(40, 200, 255," + (0.2 * fade) + ")";
        drawNeonLine(a0, a1, core, Math.max(1.5, (a0 && a0.scale ? a0.scale : 20) * 0.055), halo);

        // Vertical neon ticks
        if (Math.floor(z / step) % 2 === 0) {
          const t0 = project(x, 0.02, z + 0.2);
          const t1 = project(x, 0.85, z + 0.2);
          drawNeonLine(t0, t1, core, Math.max(1.2, (t0 && t0.scale ? t0.scale : 20) * 0.04), halo);
        }
      }
    }

    // Neon lamp posts
    for (let z = Math.floor((worldZ + 4) / lampStep) * lampStep; z < worldZ + 75; z += lampStep) {
      const fade = Math.max(0.18, 1 - (z - worldZ) * 0.011);
      const side = Math.floor(z / lampStep) % 2 === 0 ? -1 : 1;
      const pink = side > 0;
      const x = side * (TRACK_HALF + 0.7);
      const poleTop = 2.2;
      const core = pink ? "rgba(255, 80, 200," + (0.85 * fade) + ")" : "rgba(70, 245, 255," + (0.9 * fade) + ")";
      const halo = pink ? "rgba(255, 40, 170," + (0.2 * fade) + ")" : "rgba(40, 210, 255," + (0.22 * fade) + ")";

      const p0 = project(x, -0.05, z);
      const p1 = project(x, poleTop, z);
      drawNeonLine(p0, p1, core, Math.max(1.4, (p0 && p0.scale ? p0.scale : 20) * 0.05), halo);

      const arm0 = project(x, poleTop, z);
      const arm1 = project(x - side * 0.75, poleTop + 0.08, z);
      drawNeonLine(arm0, arm1, core, Math.max(1.2, (arm0 && arm0.scale ? arm0.scale : 20) * 0.045), halo);

      const bulb = project(x - side * 0.7, poleTop + 0.1, z);
      const pool = project(x - side * 0.35, 0.03, z + 0.5);
      if (bulb) {
        const r = Math.max(3, bulb.scale * 0.2);
        const g = ctx.createRadialGradient(bulb.x, bulb.y, 0, bulb.x, bulb.y, r * 5);
        g.addColorStop(0, pink ? "rgba(255, 160, 230," + (0.45 * fade) + ")" : "rgba(160, 245, 255," + (0.45 * fade) + ")");
        g.addColorStop(0.4, pink ? "rgba(255, 60, 180," + (0.14 * fade) + ")" : "rgba(40, 200, 255," + (0.14 * fade) + ")");
        g.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(bulb.x, bulb.y, r * 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(bulb.x, bulb.y, r, 0, Math.PI * 2);
        ctx.fillStyle = pink ? "rgba(255, 220, 245," + (0.95 * fade) + ")" : "rgba(210, 255, 255," + (0.95 * fade) + ")";
        ctx.fill();
      }
      if (pool) {
        const pr = Math.max(10, pool.scale * 1.5);
        const puddle = ctx.createRadialGradient(pool.x, pool.y, 0, pool.x, pool.y, pr);
        puddle.addColorStop(0, pink ? "rgba(255, 90, 200," + (0.2 * fade) + ")" : "rgba(60, 230, 255," + (0.22 * fade) + ")");
        puddle.addColorStop(0.5, pink ? "rgba(255, 40, 160," + (0.06 * fade) + ")" : "rgba(30, 180, 255," + (0.07 * fade) + ")");
        puddle.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = puddle;
        ctx.beginPath();
        ctx.ellipse(pool.x, pool.y, pr, pr * 0.32, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    const fog = ctx.createRadialGradient(W * 0.5, HORIZON + 30, 30, W * 0.5, H * 0.55, H * 0.9);
    fog.addColorStop(0, "rgba(8, 16, 28, 0)");
    fog.addColorStop(0.7, "rgba(2, 6, 14, 0.12)");
    fog.addColorStop(1, "rgba(0, 0, 0, 0.4)");
    ctx.fillStyle = fog;
    ctx.fillRect(0, 0, W, H);
  }
  function drawVoidPlate(z0, z1, half) {
    const deep = -3.5;
    const corners = [
      project(-half, deep, z0),
      project(half, deep, z0),
      project(half, deep, z1),
      project(-half, deep, z1)
    ];
    if (!corners.every(Boolean)) return;
    ctx.beginPath();
    ctx.moveTo(corners[0].x, corners[0].y);
    ctx.lineTo(corners[1].x, corners[1].y);
    ctx.lineTo(corners[2].x, corners[2].y);
    ctx.lineTo(corners[3].x, corners[3].y);
    ctx.closePath();
    ctx.fillStyle = "rgba(0, 0, 0, 0.9)";
    ctx.fill();
    ctx.strokeStyle = "rgba(40, 200, 255, 0.28)";
    ctx.lineWidth = 1.4;
    ctx.stroke();
  }

  function drawSegment(seg) {
    const z0 = seg.z;
    const z1 = seg.z + SEGMENT_LEN;
    const half = seg.width * 0.5;

    if (seg.void) {
      drawVoidPlate(z0, z1, half + 0.6);
      if (seg.block) drawHazardBlock(seg, 0, 0);
      return;
    }

    const h0 = seg.ramp ? seg.ramp.h0 : seg.raise || 0;
    const h1 = seg.ramp ? seg.ramp.h1 : seg.raise || 0;
    const p0l = project(-half, h0, z0);
    const p0r = project(half, h0, z0);
    const p1l = project(-half, h1, z1);
    const p1r = project(half, h1, z1);
    if (!p0l || !p0r || !p1l || !p1r) return;

    // Thickness / cliff edge into the void under the ramp.
    const under0l = project(-half, h0 - 0.85, z0);
    const under0r = project(half, h0 - 0.85, z0);
    const under1l = project(-half, h1 - 0.85, z1);
    const under1r = project(half, h1 - 0.85, z1);
    if (under0l && under0r && under1l && under1r) {
      ctx.beginPath();
      ctx.moveTo(p0l.x, p0l.y);
      ctx.lineTo(p1l.x, p1l.y);
      ctx.lineTo(under1l.x, under1l.y);
      ctx.lineTo(under0l.x, under0l.y);
      ctx.closePath();
      ctx.fillStyle = "#121214";
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(p0r.x, p0r.y);
      ctx.lineTo(p1r.x, p1r.y);
      ctx.lineTo(under1r.x, under1r.y);
      ctx.lineTo(under0r.x, under0r.y);
      ctx.closePath();
      ctx.fillStyle = "#121214";
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(under0l.x, under0l.y);
      ctx.lineTo(under0r.x, under0r.y);
      ctx.lineTo(under1r.x, under1r.y);
      ctx.lineTo(under1l.x, under1l.y);
      ctx.closePath();
      ctx.fillStyle = "rgba(8, 8, 10, 0.94)";
      ctx.fill();
    }

    // Dark Slope-style track deck
    ctx.beginPath();
    ctx.moveTo(p0l.x, p0l.y);
    ctx.lineTo(p0r.x, p0r.y);
    ctx.lineTo(p1r.x, p1r.y);
    ctx.lineTo(p1l.x, p1l.y);
    ctx.closePath();
    const shade = Math.max(0.4, 1 - p0l.z * 0.011);
    const ramp = !!seg.ramp;
    if (ramp || seg.boost) {
      ctx.fillStyle = `rgba(${Math.floor((20 + (seg.stripe ? 10 : 0)) * shade)}, ${Math.floor((90 + (seg.stripe ? 16 : 0)) * shade)}, ${Math.floor((55 + (seg.stripe ? 12 : 0)) * shade)}, 1)`;
    } else {
      const base = seg.stripe ? 34 : 26;
      ctx.fillStyle = `rgba(${Math.floor(base * shade)}, ${Math.floor((base + 8) * shade)}, ${Math.floor((base + 22) * shade)}, 1)`;
    }
    ctx.fill();

    // Speed-boost chevrons on ramp pads
    if (seg.boost) {
      for (let i = 0; i < 3; i += 1) {
        const zt = z0 + 0.7 + i * 1.15;
        const hh = h0 + (h1 - h0) * ((zt - z0) / SEGMENT_LEN) + 0.03;
        const a = project(-half * 0.35, hh, zt);
        const b = project(0, hh + 0.02, zt + 0.55);
        const c = project(half * 0.35, hh, zt);
        if (a && b && c) {
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.lineTo(c.x, c.y);
          ctx.strokeStyle = "rgba(120, 255, 170, " + (0.55 * shade) + ")";
          ctx.lineWidth = Math.max(2, a.scale * 0.06);
          ctx.stroke();
        }
      }
    }

    // Neon edge rails on the road
    const edgeCore = ramp || seg.boost ? "rgba(90, 255, 160, 0.9)" : "rgba(70, 245, 255, 0.85)";
    const edgeGlow = ramp || seg.boost ? "rgba(40, 220, 120, 0.28)" : "rgba(40, 200, 255, 0.25)";
    drawNeonLine(p0l, p1l, edgeCore, Math.max(1.6, p0l.scale * 0.06), edgeGlow);
    drawNeonLine(p0r, p1r, edgeCore, Math.max(1.6, p0l.scale * 0.06), edgeGlow);

    // Neon grid seam
    if (!ramp && seg.stripe) {
      const s0 = project(-half * 0.95, h0 + 0.015, z0 + 0.12);
      const s1 = project(half * 0.95, h0 + 0.015, z0 + 0.12);
      drawNeonLine(s0, s1, "rgba(70, 230, 255, 0.45)", Math.max(1, p0l.scale * 0.035), "rgba(40, 180, 255, 0.12)");
    }

    // Center neon dashes
    const midH0 = h0 + 0.025;
    const midH1 = h1 + 0.025;
    const c0 = project(0, midH0, z0 + 0.55);
    const c1 = project(0, midH1, z1 - 0.55);
    if (c0 && c1 && Math.floor(seg.z / SEGMENT_LEN) % 2 === 0) {
      drawNeonLine(
        c0,
        c1,
        ramp ? "rgba(255, 230, 120, 0.7)" : "rgba(180, 255, 255, 0.55)",
        Math.max(1.2, c0.scale * 0.045),
        ramp ? "rgba(255, 180, 50, 0.18)" : "rgba(60, 220, 255, 0.16)"
      );
    }

    if (seg.gap) {
      const gh = seg.gap.w * 0.5;
      const g0l = project(seg.gap.x - gh, h0 - 0.02, z0);
      const g0r = project(seg.gap.x + gh, h0 - 0.02, z0);
      const g1l = project(seg.gap.x - gh, h1 - 0.02, z1);
      const g1r = project(seg.gap.x + gh, h1 - 0.02, z1);
      if (g0l && g0r && g1l && g1r) {
        ctx.beginPath();
        ctx.moveTo(g0l.x, g0l.y);
        ctx.lineTo(g0r.x, g0r.y);
        ctx.lineTo(g1r.x, g1r.y);
        ctx.lineTo(g1l.x, g1l.y);
        ctx.closePath();
        ctx.fillStyle = "#000000";
        ctx.fill();
      }
    }

    if (seg.block) {
      drawHazardBlock(seg, h0, h1);
    }
  }

  function drawHazardBlock(seg, h0, h1) {
    const z0 = seg.z;
    const z1 = seg.z + SEGMENT_LEN;
    const bh = seg.block.w * 0.5;
    const base = Math.max(h0, h1) + (seg.block.y || 0);
    const top = base + seg.block.h;
    const corners = [
      project(seg.block.x - bh, base, z0 + 0.8),
      project(seg.block.x + bh, base, z0 + 0.8),
      project(seg.block.x + bh, base, z1 - 0.8),
      project(seg.block.x - bh, base, z1 - 0.8),
      project(seg.block.x - bh, top, z0 + 0.8),
      project(seg.block.x + bh, top, z0 + 0.8),
      project(seg.block.x + bh, top, z1 - 0.8),
      project(seg.block.x - bh, top, z1 - 0.8)
    ];
    if (!corners.every(Boolean)) return;
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
    // Side face so floating killers read in mid-air.
    ctx.beginPath();
    ctx.moveTo(corners[1].x, corners[1].y);
    ctx.lineTo(corners[2].x, corners[2].y);
    ctx.lineTo(corners[6].x, corners[6].y);
    ctx.lineTo(corners[5].x, corners[5].y);
    ctx.closePath();
    ctx.fillStyle = "#a8324a";
    ctx.fill();
    if ((seg.block.y || 0) > 0.2) {
      const stem = project(seg.block.x, Math.max(0, base - 1.2), (z0 + z1) * 0.5);
      const foot = project(seg.block.x, 0.02, (z0 + z1) * 0.5);
      if (stem && foot) {
        ctx.beginPath();
        ctx.moveTo(foot.x, foot.y);
        ctx.lineTo(stem.x, stem.y);
        ctx.strokeStyle = "rgba(255, 93, 122, 0.35)";
        ctx.lineWidth = Math.max(1, stem.scale * 0.04);
        ctx.stroke();
      }
    }
  }

  function drawBall() {
    const pz = worldZ + PLAYER_Z;
    const p = project(ballX, ballH + 0.45, pz);
    if (!p) return;
    const r = Math.max(4, p.scale * 0.38);
    const surf = surfaceHeight(pz);
    const shadowH = surf == null ? Math.max(-1.5, ballH - 2.5) : surf + 0.02;
    const shadow = project(ballX, shadowH, pz);
    if (shadow) {
      const shrink = airborne ? Math.max(0.25, 1 - Math.min(2.5, Math.abs(ballH - (surf ?? ballH))) * 0.28) : 1;
      ctx.beginPath();
      ctx.ellipse(shadow.x, shadow.y, r * 1.1 * shrink, r * 0.35 * shrink, 0, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(0, 0, 0, ${0.22 + 0.2 * shrink})`;
      ctx.fill();
    }
    const halo = ctx.createRadialGradient(p.x, p.y, r * 0.2, p.x, p.y, r * 2.4);
    halo.addColorStop(0, "rgba(80, 240, 255, 0.35)");
    halo.addColorStop(0.45, "rgba(40, 180, 255, 0.1)");
    halo.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r * 2.4, 0, Math.PI * 2);
    ctx.fill();
    const grad = ctx.createRadialGradient(p.x - r * 0.3, p.y - r * 0.35, r * 0.1, p.x, p.y, r);
    grad.addColorStop(0, "#ffffff");
    grad.addColorStop(0.3, "#7dfff2");
    grad.addColorStop(1, "#1a8f9e");
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.strokeStyle = "rgba(160, 255, 255, 0.55)";
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  function draw() {
    ctx.save();
    if (shake > 0) {
      ctx.translate((Math.random() - 0.5) * shake * 2, (Math.random() - 0.5) * shake * 2);
    }
    drawBackground();
    drawDescentScenery();
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
    falling = false;
    overlay?.classList.add("hidden");
    resumeBtn?.classList.add("hidden");
    if (overlayTitle) overlayTitle.textContent = "Ramp Rush";
    window.HubSound?.play?.("click");
    ensureSession();
    updateHud();
  }

  function pauseGame() {
    if (falling) return;
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
