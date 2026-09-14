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
    return -HILL_SLOPE * z;
  }

  function camPose() {
    const camZ = worldZ + PLAYER_Z - CAM_BACK;
    return { z: camZ, y: groundY(camZ) + CAM_HEIGHT };
  }

  function project(x, y, z) {
    const cam = camPose();
    const relZ = z - cam.z;
    if (relZ <= 0.7) return null;
    const worldY = groundY(z) + y;
    const relY = worldY - cam.y;
    const scale = FOV / relZ;
    return {
      x: W * 0.5 + x * scale,
      y: HORIZON - relY * scale,
      scale,
      z: relZ
    };
  }

  function rand(a, b) {
    return a + Math.random() * (b - a);
  }

  function enqueueJump(difficulty) {
    const peak = rand(1.35, 2.35 + Math.min(0.8, difficulty * 0.12));
    const voidCount = Math.max(2, Math.min(4, Math.floor(rand(2.1, 3.0 + difficulty * 0.2))));
    pendingSegs.push({ ramp: { h0: 0, h1: peak * 0.4 }, raise: 0 });
    pendingSegs.push({ ramp: { h0: peak * 0.4, h1: peak }, raise: 0 });
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
    speed += HILL_SLOPE * 10 * dt;
    if (speed > 48) speed = 48;
    worldZ += speed * dt;
    score += speed * dt * 0.55;
    fillAhead();

    const pz = worldZ + PLAYER_Z;
    const seg = currentSegment();
    const surf = surfaceHeight(pz);
    const slope = rampSlope(pz);

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
      } else if (ballH < -5) {
        die("You fell into the void.");
        return;
      }
    }

    if (!seg) return;
    const half = seg.width * 0.5;

    if (!airborne) {
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
    } else if (Math.abs(ballX) > half + 1.8) {
      die("You drifted into the void.");
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

  function drawBackground() {
    // Open night descent — no canyon.
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, "#05070d");
    sky.addColorStop(0.35, "#0c1422");
    sky.addColorStop(0.62, "#182636");
    sky.addColorStop(0.82, "#243244");
    sky.addColorStop(1, "#2e3a48");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    const glow = ctx.createRadialGradient(W * 0.5, HORIZON + 20, 4, W * 0.5, HORIZON + 20, W * 0.55);
    glow.addColorStop(0, "rgba(120, 160, 190, 0.22)");
    glow.addColorStop(0.45, "rgba(60, 90, 120, 0.08)");
    glow.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);

    for (let layer = 0; layer < 2; layer += 1) {
      const baseY = HORIZON + 28 + layer * 26;
      const amp = 14 + layer * 10;
      ctx.beginPath();
      ctx.moveTo(0, H);
      ctx.lineTo(0, baseY + 20);
      for (let x = 0; x <= W; x += 20) {
        const n =
          Math.sin(x * 0.008 + worldZ * (0.004 + layer * 0.002) + layer) * amp +
          Math.sin(x * 0.02 + layer * 2) * (amp * 0.35);
        ctx.lineTo(x, baseY - Math.abs(n));
      }
      ctx.lineTo(W, H);
      ctx.closePath();
      ctx.fillStyle =
        "rgba(" +
        (14 + layer * 6) +
        "," +
        (18 + layer * 7) +
        "," +
        (26 + layer * 8) +
        "," +
        (0.35 + layer * 0.2) +
        ")";
      ctx.fill();
    }

    for (let i = 0; i < 55; i += 1) {
      const sx = ((i * 89 + worldZ * 0.6) % W + W) % W;
      const sy = ((i * 47) % Math.max(8, HORIZON - 8)) + 4;
      ctx.fillStyle = "rgba(220,230,245," + (0.1 + (i % 5) * 0.06) + ")";
      ctx.fillRect(sx, sy, 1.2, 1.2);
    }

    for (let i = 0; i < 18; i += 1) {
      const lx = W * 0.18 + i * (W * 0.035) + Math.sin(worldZ * 0.02 + i) * 3;
      const ly = HORIZON + 8 + (i % 3);
      ctx.fillStyle = i % 2 === 0 ? "rgba(255, 210, 140, 0.35)" : "rgba(160, 200, 255, 0.28)";
      ctx.fillRect(lx, ly, 2, 2);
    }

    const streakCount = running ? 28 : 12;
    for (let i = 0; i < streakCount; i += 1) {
      const y = HORIZON + 30 + ((i * 37 + worldZ * 8) % (H - HORIZON - 40));
      const len = 18 + (i % 5) * 10;
      const x = ((i * 113 - worldZ * (running ? 40 : 8)) % (W + len) + W + len) % (W + len) - len;
      ctx.strokeStyle = "rgba(180, 200, 220," + (0.04 + (i % 4) * 0.02) + ")";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + len, y);
      ctx.stroke();
    }

    const haze = ctx.createLinearGradient(0, HORIZON, 0, H);
    haze.addColorStop(0, "rgba(20, 28, 40, 0)");
    haze.addColorStop(0.55, "rgba(8, 12, 18, 0.25)");
    haze.addColorStop(1, "rgba(0, 0, 0, 0.55)");
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

  function drawDescentScenery() {
    const nearZ = worldZ + 2.0;
    const farZ = worldZ + 90;
    const step = 3.0;

    for (let z = farZ; z >= nearZ; z -= step * 2) {
      const z1 = z + step * 2;
      const fade = Math.max(0.25, 1 - (z - worldZ) * 0.01);
      rockQuad(
        -TRACK_HALF - 1.2, -3.8, z,
        TRACK_HALF + 1.2, -3.8, z,
        TRACK_HALF + 1.2, -3.8, z1,
        -TRACK_HALF - 1.2, -3.8, z1,
        "rgba(0,0,0," + (0.55 * fade) + ")",
        null
      );
    }

    for (let z = Math.floor((worldZ + 3) / step) * step; z < worldZ + 70; z += step) {
      const fade = Math.max(0.25, 1 - (z - worldZ) * 0.012);
      const z1 = z + step * 0.85;
      for (const side of [-1, 1]) {
        const x = side * (TRACK_HALF + 0.35);
        rockQuad(
          x - side * 0.08, 0.05, z,
          x + side * 0.12, 0.05, z,
          x + side * 0.12, 0.55, z1,
          x - side * 0.08, 0.55, z1,
          "rgba(" + Math.floor(70 * fade) + "," + Math.floor(78 * fade) + "," + Math.floor(88 * fade) + ",0.9)",
          null
        );
        if (Math.floor(z / step) % 2 === 0) {
          rockQuad(
            x - side * 0.06, -0.15, z + 0.2,
            x + side * 0.06, -0.15, z + 0.2,
            x + side * 0.06, 0.7, z + 0.45,
            x - side * 0.06, 0.7, z + 0.45,
            "rgba(" + Math.floor(55 * fade) + "," + Math.floor(60 * fade) + "," + Math.floor(68 * fade) + ",0.95)",
            null
          );
          const lamp = project(x + side * 0.05, 0.85, z + 0.32);
          if (lamp) {
            ctx.beginPath();
            ctx.arc(lamp.x, lamp.y, Math.max(1.2, lamp.scale * 0.08), 0, Math.PI * 2);
            ctx.fillStyle = "rgba(220, 200, 150," + (0.25 * fade) + ")";
            ctx.fill();
          }
        }
      }
    }

    const fog = ctx.createRadialGradient(W * 0.5, HORIZON + 30, 30, W * 0.5, H * 0.55, H * 0.9);
    fog.addColorStop(0, "rgba(10, 14, 20, 0)");
    fog.addColorStop(0.7, "rgba(4, 6, 10, 0.12)");
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
    ctx.fillStyle = "rgba(0, 0, 0, 0.86)";
    ctx.fill();
    ctx.strokeStyle = "rgba(70, 70, 75, 0.25)";
    ctx.lineWidth = 1;
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

    // Asphalt deck
    ctx.beginPath();
    ctx.moveTo(p0l.x, p0l.y);
    ctx.lineTo(p0r.x, p0r.y);
    ctx.lineTo(p1r.x, p1r.y);
    ctx.lineTo(p1l.x, p1l.y);
    ctx.closePath();
    const shade = Math.max(0.42, 1 - p0l.z * 0.011);
    const ramp = !!seg.ramp;
    if (ramp) {
      ctx.fillStyle = `rgba(${Math.floor((92 + (seg.stripe ? 10 : 0)) * shade)}, ${Math.floor((78 + (seg.stripe ? 8 : 0)) * shade)}, ${Math.floor((42 + (seg.stripe ? 4 : 0)) * shade)}, 1)`;
    } else {
      const base = seg.stripe ? 58 : 48;
      ctx.fillStyle = `rgba(${Math.floor(base * shade)}, ${Math.floor((base - 2) * shade)}, ${Math.floor((base - 4) * shade)}, 1)`;
    }
    ctx.fill();

    // Soft road edge (concrete curb), not neon outline
    ctx.beginPath();
    ctx.moveTo(p0l.x, p0l.y);
    ctx.lineTo(p1l.x, p1l.y);
    ctx.strokeStyle = ramp ? "rgba(170, 140, 80, 0.35)" : "rgba(120, 120, 118, 0.35)";
    ctx.lineWidth = Math.max(1, p0l.scale * 0.045);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(p0r.x, p0r.y);
    ctx.lineTo(p1r.x, p1r.y);
    ctx.strokeStyle = ramp ? "rgba(170, 140, 80, 0.35)" : "rgba(120, 120, 118, 0.35)";
    ctx.lineWidth = Math.max(1, p0l.scale * 0.045);
    ctx.stroke();

    // Worn center dashes
    const midH0 = h0 + 0.02;
    const midH1 = h1 + 0.02;
    const c0 = project(0, midH0, z0 + 0.55);
    const c1 = project(0, midH1, z1 - 0.55);
    if (c0 && c1 && Math.floor(seg.z / SEGMENT_LEN) % 2 === 0) {
      ctx.beginPath();
      ctx.moveTo(c0.x, c0.y);
      ctx.lineTo(c1.x, c1.y);
      ctx.strokeStyle = ramp ? "rgba(210, 185, 110, 0.4)" : "rgba(210, 205, 185, 0.32)";
      ctx.lineWidth = Math.max(1, c0.scale * 0.05);
      ctx.stroke();
    }

    // Subtle seam every other stripe (asphalt join)
    if (!ramp && seg.stripe) {
      const s0 = project(-half * 0.92, h0 + 0.01, z0 + 0.15);
      const s1 = project(half * 0.92, h0 + 0.01, z0 + 0.15);
      if (s0 && s1) {
        ctx.beginPath();
        ctx.moveTo(s0.x, s0.y);
        ctx.lineTo(s1.x, s1.y);
        ctx.strokeStyle = "rgba(255,255,255,0.04)";
        ctx.lineWidth = 1;
        ctx.stroke();
      }
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
    const grad = ctx.createRadialGradient(p.x - r * 0.3, p.y - r * 0.35, r * 0.1, p.x, p.y, r);
    grad.addColorStop(0, "#e8ecef");
    grad.addColorStop(0.35, "#8a9aa3");
    grad.addColorStop(1, "#3a454c");
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.strokeStyle = "rgba(220, 230, 235, 0.35)";
    ctx.lineWidth = 1.5;
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
      ctx.fillStyle = "#c8d0d4";
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
