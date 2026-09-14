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

  // Companion wipe if hub scripts weren't loaded first.
  try {
    if (localStorage.getItem("hub-ramp-local-wipe-v1") !== "done") {
      localStorage.removeItem(HIGH_SCORE_KEY);
      localStorage.setItem("hub-ramp-local-wipe-v1", "done");
    }
  } catch {}

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
  const TRACK_HALF = 3.55;

  let best = Math.max(0, Math.floor(Number(localStorage.getItem(HIGH_SCORE_KEY)) || 0));
  let running = false;
  let paused = false;
  let dead = false;
  let waitingStart = true;
  let score = 0;
  let speed = 20;
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
  let onArchPath = false;
  const BASE_SPEED = 20;
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
    if (score >= 5 || best >= 5) HubAchievements.unlock("ramp_score_25");
    if (score >= 12 || best >= 12) HubAchievements.unlock("ramp_score_75");
    if (score >= 25 || best >= 25) HubAchievements.unlock("ramp_score_150");
    if (best >= 40) HubAchievements.unlock("ramp_score_250");
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

  function ptsToSegs(pts) {
    // Spawn spacing still uses the old distance-point scale (~0.55 per world unit).
    return Math.max(5, Math.round(pts / 0.55 / SEGMENT_LEN));
  }

  function hazardGapSegs() {
    return ptsToSegs(15);
  }

  function distancePoints() {
    return worldZ * 0.55;
  }

  function markKillGroupEnd() {
    if (!pendingSegs.length) return;
    pendingSegs[pendingSegs.length - 1].killGroupEnd = true;
  }

  function awardPassedKillGroups() {
    if (falling || dead) return;
    const pz = worldZ + PLAYER_Z;
    for (const seg of segments) {
      if (seg.killGroupEnd && !seg.scored && pz >= seg.z + SEGMENT_LEN) {
        seg.scored = true;
        score += 1;
      }
    }
  }

  function mkBlock(x, w, h, y) {
    return { x, w, h, y: y || 0 };
  }

  function enqueueHazardPattern(difficulty) {
    const lane = Math.max(1.5, Math.min(2.6, 2.35 - difficulty * 0.08));
    const roll = Math.random();
    let added = 0;
    if (roll < 0.22) {
      // Gate: left + right, open center
      pendingSegs.push({
        raise: 0,
        blocks: [mkBlock(-lane, 1.15, 1.05, 0), mkBlock(lane, 1.15, 1.05, 0)]
      });
      added = 1;
    } else if (roll < 0.42) {
      // Zigzag: left then right
      pendingSegs.push({ raise: 0, blocks: [mkBlock(-lane * 0.95, 1.2, 1.0, 0)] });
      pendingSegs.push({ raise: 0 });
      pendingSegs.push({ raise: 0, blocks: [mkBlock(lane * 0.95, 1.2, 1.0, 0)] });
      added = 3;
    } else if (roll < 0.62) {
      // Diagonal steps across the road
      pendingSegs.push({ raise: 0, blocks: [mkBlock(-lane, 1.05, 0.95, 0)] });
      pendingSegs.push({ raise: 0, blocks: [mkBlock(0, 1.05, 0.95, 0)] });
      pendingSegs.push({ raise: 0, blocks: [mkBlock(lane, 1.05, 0.95, 0)] });
      added = 3;
    } else if (roll < 0.8) {
      // Twin stagger + center closer
      pendingSegs.push({
        raise: 0,
        blocks: [mkBlock(-lane * 0.85, 1.0, 0.9, 0), mkBlock(lane * 0.85, 1.0, 0.9, 0)]
      });
      pendingSegs.push({ raise: 0 });
      pendingSegs.push({ raise: 0, blocks: [mkBlock(0, 1.15, 1.1, 0)] });
      added = 3;
    } else {
      // Wall with a side lane open
      const side = Math.random() < 0.5 ? -1 : 1;
      pendingSegs.push({
        raise: 0,
        blocks: [
          mkBlock(-side * 0.15, 2.2, 1.05, 0),
          mkBlock(side * lane * 0.35, 1.0, 1.05, 0)
        ]
      });
      added = 1;
    }
    markKillGroupEnd();
    featureCooldown = added + hazardGapSegs();
  }

  function enqueueArch() {
    const thick = 0.5;
    const roofH = rand(2.35, 2.75);
    const top = roofH + thick;
    const lane = 1.55;
    const openHalf = 2.2;
    // Longer, gentler side ramps so height changes continuously (no teleports).
    pendingSegs.push({ archApproach: { h0: 0, h1: top * 0.33, lane }, raise: 0 });
    pendingSegs.push({ archApproach: { h0: top * 0.33, h1: top * 0.66, lane }, raise: 0 });
    pendingSegs.push({ archApproach: { h0: top * 0.66, h1: top, lane }, raise: 0 });
    pendingSegs.push({ arch: { roofH, openHalf, thick, top }, raise: 0 });
    pendingSegs.push({ arch: { roofH, openHalf, thick, top }, raise: 0 });
    pendingSegs.push({ archApproach: { h0: top, h1: top * 0.5, lane }, raise: 0 });
    pendingSegs.push({ archApproach: { h0: top * 0.5, h1: 0, lane }, raise: 0 });
    featureCooldown = 7 + ptsToSegs(rand(45, 75));
  }

  function enqueueJump(difficulty) {
    const peak = rand(1.35, 2.35 + Math.min(0.8, difficulty * 0.12));
    const voidCount = Math.max(2, Math.min(4, Math.floor(rand(2.1, 3.0 + difficulty * 0.2))));
    pendingSegs.push({ ramp: { h0: 0, h1: peak * 0.4 }, raise: 0, boost: true });
    pendingSegs.push({ ramp: { h0: peak * 0.4, h1: peak }, raise: 0, boost: true });
    // Floating killer patterns in the jump lane (not every void segment).
    const airPattern = Math.floor(rand(0, 3.99));
    let hasKillBlocks = false;
    for (let i = 0; i < voidCount; i += 1) {
      const spec = { void: true, width: Math.max(3.7, 7.0 - difficulty * 0.25) };
      if (i === 1 && airPattern === 0) {
        spec.blocks = [
          mkBlock(-1.2, 0.95, 0.9, peak * 0.55),
          mkBlock(1.2, 0.95, 0.9, peak * 0.55)
        ];
        hasKillBlocks = true;
      } else if (i === 1 && airPattern === 1) {
        spec.blocks = [mkBlock(0, 1.15, 1.0, peak * 0.65)];
        hasKillBlocks = true;
      } else if (i >= 1 && i <= 2 && airPattern === 2) {
        spec.blocks = [mkBlock(i === 1 ? -1.15 : 1.15, 1.0, 0.95, peak * (0.45 + i * 0.12))];
        hasKillBlocks = true;
      }
      pendingSegs.push(spec);
    }
    pendingSegs.push({ raise: rand(0, 0.4), width: Math.max(3.7, 7.3 - difficulty * 0.2) });
    if (hasKillBlocks) markKillGroupEnd();
    featureCooldown = voidCount + 2 + hazardGapSegs();
  }

  function segBlocks(seg) {
    if (!seg) return [];
    if (seg.blocks && seg.blocks.length) return seg.blocks;
    if (seg.block) return [seg.block];
    return [];
  }

  function makeSegment(z, difficulty) {
    const baseW = Math.max(3.5, 7.8 - difficulty * 0.35);
    let gap = null;
    let block = null;
    let taper = 0;
    let raise = 0;
    let ramp = null;
    let isVoid = false;
    let width = baseW;
    let pendingBoost = false;
    let pendingBlocks = null;
    let pendingArch = null;
    let pendingApproach = null;
    let pendingKillEnd = false;

    if (pendingSegs.length) {
      const spec = pendingSegs.shift();
      if (spec.void) {
        return {
          z,
          width: spec.width || baseW,
          gap: null,
          block: spec.block || null,
          blocks: spec.blocks || (spec.block ? [spec.block] : null),
          ramp: null,
          raise: 0,
          void: true,
          killGroupEnd: !!spec.killGroupEnd,
          scored: false,
          stripe: Math.floor(z / SEGMENT_LEN) % 2
        };
      }
      ramp = spec.ramp || null;
      raise = spec.raise || 0;
      block = spec.block || null;
      if (spec.width) width = spec.width;
      pendingBoost = !!spec.boost || !!ramp;
      pendingBlocks = spec.blocks || (spec.block ? [spec.block] : null);
      block = pendingBlocks && pendingBlocks.length === 1 ? pendingBlocks[0] : null;
      pendingArch = spec.arch || null;
      pendingApproach = spec.archApproach || null;
      pendingKillEnd = !!spec.killGroupEnd;
    } else if (difficulty > 0.35 && featureCooldown <= 0) {
      const pick = Math.random();
      if (difficulty > 1.35 && pick < 0.08) enqueueArch();
      else if (difficulty > 0.85 && pick < 0.42) enqueueJump(difficulty);
      else enqueueHazardPattern(difficulty);
      return makeSegment(z, difficulty);
    } else {
      const kindRoll = Math.random();
      if (difficulty > 0.4 && kindRoll < 0.16) {
        const side = Math.random() < 0.5 ? -1 : 1;
        const gw = rand(1.1, 1.8);
        gap = { x: side * (baseW * 0.5 - gw * 0.35), w: gw };
      } else if (difficulty > 1.2 && kindRoll < 0.28) {
        taper = rand(0.35, 0.9);
        width = baseW - taper;
      }
    }

    if (featureCooldown > 0) featureCooldown -= 1;

    return {
      z,
      width,
      gap,
      block: pendingBlocks && pendingBlocks.length === 1 ? pendingBlocks[0] : block,
      blocks: pendingBlocks && pendingBlocks.length ? pendingBlocks : (block ? [block] : null),
      ramp,
      raise,
      boost: pendingBoost || !!ramp,
      arch: pendingArch,
      archApproach: pendingApproach,
      killGroupEnd: pendingKillEnd,
      scored: false,
      void: isVoid,
      stripe: Math.floor(z / SEGMENT_LEN) % 2
    };
  }

  function resetWorld() {
    score = 0;
    speed = BASE_SPEED;
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
    onArchPath = false;
    speed = BASE_SPEED;

    // Old distance-point scale: first hazard ~20 pts, then every ~15 pts.
    const firstHazardScore = 20;
    const safeCount = Math.max(3, Math.floor(firstHazardScore / 0.55 / SEGMENT_LEN));
    for (let i = 0; i < safeCount; i += 1) {
      segments.push(makeSegment(nextSegZ, 0));
      nextSegZ += SEGMENT_LEN;
    }

    // First encounter around the 20-point mark, then every 15 distance-points.
    const first = Math.random();
    if (first < 0.08) enqueueArch();
    else if (first < 0.45) enqueueJump(0.9);
    else enqueueHazardPattern(0.9);

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

  function smoothstep(a, b, x) {
    if (b <= a) return x >= b ? 1 : 0;
    const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
    return t * t * (3 - 2 * t);
  }

  function surfaceHeight(z) {
    const seg = segmentAt(z);
    if (!seg || seg.void) return null;
    if (seg.archApproach) {
      const t = Math.max(0, Math.min(1, (z - seg.z) / SEGMENT_LEN));
      const h = seg.archApproach.h0 + (seg.archApproach.h1 - seg.archApproach.h0) * t;
      const lane = seg.archApproach.lane;
      const sideBlend = smoothstep(lane - 0.65, lane + 0.25, Math.abs(ballX));
      const w = onArchPath ? 1 : sideBlend;
      return h * w;
    }
    if (seg.arch) {
      const top = seg.arch.top != null ? seg.arch.top : seg.arch.roofH + (seg.arch.thick || 0.5);
      if (onArchPath || ballH >= top - 0.85) return top;
      return 0;
    }
    if (seg.ramp) {
      const t = Math.max(0, Math.min(1, (z - seg.z) / SEGMENT_LEN));
      return seg.ramp.h0 + (seg.ramp.h1 - seg.ramp.h0) * t;
    }
    return seg.raise || 0;
  }

  function rampSlope(z) {
    const seg = segmentAt(z);
    if (!seg) return 0;
    if (seg.archApproach) {
      const lane = seg.archApproach.lane;
      const sideBlend = smoothstep(lane - 0.65, lane + 0.25, Math.abs(ballX));
      const w = onArchPath ? 1 : sideBlend;
      if (w > 0.05) {
        return ((seg.archApproach.h1 - seg.archApproach.h0) / SEGMENT_LEN) * w;
      }
      return 0;
    }
    if (!seg.ramp) return 0;
    return (seg.ramp.h1 - seg.ramp.h0) / SEGMENT_LEN;
  }

  function fillAhead() {
    const difficulty = Math.min(4.5, distancePoints() / 40);
    while (segments.length && segments[0].z + SEGMENT_LEN < worldZ - 6) {
      const gone = segments.shift();
      if (gone.killGroupEnd && !gone.scored) {
        gone.scored = true;
        if (!falling && !dead) score += 1;
      }
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
    // Update arch path stickiness from the current segment only.
    if (seg && seg.archApproach) {
      const lane = seg.archApproach.lane;
      const sideBlend = smoothstep(lane - 0.65, lane + 0.25, Math.abs(ballX));
      const t = Math.max(0, Math.min(1, (pz - seg.z) / SEGMENT_LEN));
      const h = seg.archApproach.h0 + (seg.archApproach.h1 - seg.archApproach.h0) * t;
      if (sideBlend > 0.55 && h > 0.35) onArchPath = true;
      if (onArchPath && h <= 0.08 && ballH < 0.35) onArchPath = false;
    } else if (seg && seg.arch) {
      const top = seg.arch.top != null ? seg.arch.top : seg.arch.roofH + (seg.arch.thick || 0.5);
      if (ballH >= top - 0.85 || onArchPath) onArchPath = true;
    } else if (onArchPath && ballH < 0.3) {
      onArchPath = false;
    }
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
    awardPassedKillGroups();
    if (speedLabelEl) speedLabelEl.textContent = "1.0×";

    if (!airborne) {
      if (surf == null) {
        airborne = true;
        ballVH = Math.min(ballVH, 1.5);
      } else {
        // Follow the surface smoothly instead of hard-snapping (fixes arch teleports).
        const dh = surf - ballH;
        if (Math.abs(dh) > 1.25) {
          // Still a real drop/gap — become airborne rather than teleport.
          airborne = true;
          ballVH = Math.min(ballVH, 1.2);
        } else {
          ballH += dh * Math.min(1, 14 * dt);
          if (Math.abs(surf - ballH) < 0.03) ballH = surf;
        }
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

    // Hit the arch pillars if you clip the sides while going through.
    if (seg.arch && ballH < seg.arch.roofH - 0.35) {
      if (Math.abs(ballX) > seg.arch.openHalf) {
        spawnSparks(W * 0.5, H * 0.7);
        die("You hit the arch.");
        return;
      }
    }

    const hazards = segBlocks(seg);
    if (hazards.length) {
      const baseH = seg.void ? 0 : (seg.ramp ? Math.max(seg.ramp.h0, seg.ramp.h1) : seg.raise || 0);
      const ballBottom = ballH;
      const ballTop = ballH + 0.85;
      for (const blk of hazards) {
        const bHalf = blk.w * 0.5;
        const bBottom = baseH + (blk.y || 0);
        const bTop = bBottom + blk.h;
        const overlapX = Math.abs(ballX - blk.x) < bHalf + 0.22;
        const overlapY = ballTop > bBottom + 0.05 && ballBottom < bTop - 0.05;
        if (overlapX && overlapY) {
          spawnSparks(W * 0.5, H * 0.7);
          die("You hit a hazard block.");
          return;
        }
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

    if (score > 0) checkAchievements();
    updateHud();
  }

  function drawPlanet(cx, cy, r, kind) {
    // Soft atmospheric halo
    const halo = ctx.createRadialGradient(cx, cy, r * 0.7, cx, cy, r * 2.4);
    if (kind === "gas") {
      halo.addColorStop(0, "rgba(210, 170, 120, 0.2)");
      halo.addColorStop(0.45, "rgba(160, 110, 70, 0.08)");
    } else if (kind === "ice") {
      halo.addColorStop(0, "rgba(160, 200, 255, 0.22)");
      halo.addColorStop(0.45, "rgba(80, 130, 200, 0.07)");
    } else {
      halo.addColorStop(0, "rgba(120, 170, 255, 0.18)");
      halo.addColorStop(0.45, "rgba(40, 80, 160, 0.06)");
    }
    halo.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 2.4, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.clip();

    if (kind === "gas") {
      const base = ctx.createLinearGradient(cx, cy - r, cx, cy + r);
      base.addColorStop(0, "#c9a078");
      base.addColorStop(0.25, "#a8744a");
      base.addColorStop(0.5, "#d4b08a");
      base.addColorStop(0.75, "#8f5a38");
      base.addColorStop(1, "#6a3d28");
      ctx.fillStyle = base;
      ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
      for (let i = 0; i < 7; i += 1) {
        const yy = cy - r + (i + 0.5) * (r * 2 / 7);
        ctx.fillStyle = i % 2 ? "rgba(255,220,180,0.12)" : "rgba(60,30,15,0.16)";
        ctx.fillRect(cx - r, yy - r * 0.07, r * 2, r * 0.14);
      }
    } else if (kind === "ice") {
      const body = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.35, r * 0.1, cx, cy, r);
      body.addColorStop(0, "#e8f2ff");
      body.addColorStop(0.45, "#8eb0d8");
      body.addColorStop(1, "#3a5578");
      ctx.fillStyle = body;
      ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    } else {
      const body = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.4, r * 0.1, cx, cy, r);
      body.addColorStop(0, "#d8e4f2");
      body.addColorStop(0.35, "#6f8fbc");
      body.addColorStop(1, "#243552");
      ctx.fillStyle = body;
      ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
      for (let i = 0; i < 8; i += 1) {
        const ang = i * 1.7;
        const cr = r * (0.08 + (i % 3) * 0.04);
        const px = cx + Math.cos(ang) * r * 0.45;
        const py = cy + Math.sin(ang) * r * 0.4;
        ctx.beginPath();
        ctx.arc(px, py, cr, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(20, 30, 45, 0.28)";
        ctx.fill();
      }
    }

    // Night-side terminator
    const shade = ctx.createLinearGradient(cx - r, cy, cx + r, cy);
    shade.addColorStop(0, "rgba(0,0,0,0)");
    shade.addColorStop(0.45, "rgba(0,0,0,0.05)");
    shade.addColorStop(0.72, "rgba(0,0,0,0.35)");
    shade.addColorStop(1, "rgba(0,0,0,0.72)");
    ctx.fillStyle = shade;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    ctx.restore();

    if (kind === "gas") {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(-0.25);
      ctx.scale(1, 0.22);
      ctx.beginPath();
      ctx.ellipse(0, 0, r * 2.05, r * 2.05, 0, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(220, 190, 140, 0.28)";
      ctx.lineWidth = Math.max(2, r * 0.22);
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(0, 0, r * 1.65, r * 1.65, 0, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(255, 240, 200, 0.12)";
      ctx.lineWidth = Math.max(1, r * 0.1);
      ctx.stroke();
      ctx.restore();
      // front limb over rings
      ctx.beginPath();
      ctx.arc(cx, cy, r, Math.PI * 1.05, Math.PI * 1.95);
      const front = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.1, cx, cy, r);
      front.addColorStop(0, "#d4b08a");
      front.addColorStop(1, "#8f5a38");
      ctx.fillStyle = front;
      ctx.fill();
    }
  }

  function drawBackground() {
    // Full-canvas deep space
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, "#02040c");
    sky.addColorStop(0.4, "#050914");
    sky.addColorStop(0.75, "#070b16");
    sky.addColorStop(1, "#04060f");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    // Milky Way band across the whole frame
    ctx.save();
    ctx.translate(W * 0.5, H * 0.42);
    ctx.rotate(-0.55);
    const band = ctx.createLinearGradient(0, -H * 0.15, 0, H * 0.15);
    band.addColorStop(0, "rgba(0,0,0,0)");
    band.addColorStop(0.35, "rgba(90, 110, 160, 0.08)");
    band.addColorStop(0.5, "rgba(180, 190, 220, 0.14)");
    band.addColorStop(0.65, "rgba(90, 110, 160, 0.08)");
    band.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = band;
    ctx.fillRect(-W, -H * 0.18, W * 2, H * 0.36);
    for (let i = 0; i < 160; i += 1) {
      const bx = -W * 0.7 + (i * 97.1 + worldZ * 0.4) % (W * 1.4);
      const by = ((i * 41.3) % (H * 0.28)) - H * 0.14;
      ctx.fillStyle = "rgba(230,235,255," + (0.08 + (i % 5) * 0.04) + ")";
      ctx.fillRect(bx, by, 1.1, 1.1);
    }
    ctx.restore();

    // Soft nebula clouds over full height
    const nebulae = [
      [W * 0.2, H * 0.18, W * 0.5, "rgba(55, 40, 120, 0.14)", "rgba(20, 50, 110, 0.04)"],
      [W * 0.82, H * 0.32, W * 0.45, "rgba(90, 30, 70, 0.12)", "rgba(40, 20, 80, 0.03)"],
      [W * 0.35, H * 0.72, W * 0.55, "rgba(30, 70, 120, 0.1)", "rgba(10, 30, 60, 0.03)"],
      [W * 0.7, H * 0.85, W * 0.4, "rgba(60, 40, 100, 0.09)", "rgba(20, 20, 50, 0.02)"]
    ];
    for (const [nx, ny, nr, a, b] of nebulae) {
      const g = ctx.createRadialGradient(nx, ny, 4, nx, ny, nr);
      g.addColorStop(0, a);
      g.addColorStop(0.55, b);
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(nx, ny, nr, 0, Math.PI * 2);
      ctx.fill();
    }

    // Dense stars covering the entire canvas
    for (let i = 0; i < 420; i += 1) {
      const layer = i % 3;
      const drift = worldZ * (0.08 + layer * 0.14);
      const sx = ((i * 97.3 + drift * (10 + layer * 8)) % W + W) % W;
      const sy = ((i * 71.9 + i * i * 0.07 + drift * (3 + layer)) % H + H) % H;
      const twinkle = 0.4 + 0.6 * Math.abs(Math.sin(worldZ * 0.035 + i * 0.7));
      const a = (0.12 + (i % 8) * 0.07) * twinkle;
      const size = layer === 0 ? 0.9 : layer === 1 ? 1.35 : 1.9;
      ctx.fillStyle = i % 13 === 0
        ? "rgba(170,210,255," + a + ")"
        : i % 11 === 0
          ? "rgba(255,220,190," + a + ")"
          : "rgba(235,240,255," + a + ")";
      ctx.fillRect(sx, sy, size, size);
      if (i % 23 === 0) {
        ctx.fillStyle = "rgba(255,255,255," + (a * 0.45) + ")";
        ctx.fillRect(sx - 1.4, sy + size * 0.3, size + 2.8, 0.6);
        ctx.fillRect(sx + size * 0.3, sy - 1.4, 0.6, size + 2.8);
      }
    }

    // Realistic planets across the full backdrop
    const drift = worldZ * 0.22;
    drawPlanet(
      W * 0.14 + Math.sin(drift * 0.01) * 8,
      H * 0.22,
      26,
      "rock"
    );
    drawPlanet(
      W * 0.78 + Math.cos(drift * 0.008) * 10,
      H * 0.16,
      38,
      "gas"
    );
    drawPlanet(
      W * 0.88,
      H * 0.58,
      14,
      "ice"
    );
    drawPlanet(
      W * 0.22,
      H * 0.78,
      11,
      "rock"
    );

    // Distant moons / dwarf worlds
    for (let i = 0; i < 8; i += 1) {
      const mx = ((i * 143 + 30 - worldZ * (0.12 + i * 0.03)) % (W + 30) + W + 30) % (W + 30) - 15;
      const my = ((i * 97 + worldZ * 0.05) % H + H) % H;
      const mr = 1.6 + (i % 4) * 0.7;
      const mg = ctx.createRadialGradient(mx - mr * 0.3, my - mr * 0.3, 0, mx, my, mr);
      mg.addColorStop(0, "rgba(230,235,245,0.7)");
      mg.addColorStop(1, "rgba(90,100,120,0.55)");
      ctx.beginPath();
      ctx.arc(mx, my, mr, 0, Math.PI * 2);
      ctx.fillStyle = mg;
      ctx.fill();
    }

    // Occasional comet across full height
    const cometPhase = (worldZ * 0.5) % 520;
    if (cometPhase < 180) {
      const cx = -40 + cometPhase * 2.4;
      const cy = H * 0.08 + cometPhase * 0.35;
      const tail = ctx.createLinearGradient(cx, cy, cx - 90, cy - 18);
      tail.addColorStop(0, "rgba(210, 230, 255, 0.55)");
      tail.addColorStop(1, "rgba(210, 230, 255, 0)");
      ctx.strokeStyle = tail;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx - 90, cy - 18);
      ctx.stroke();
      ctx.fillStyle = "rgba(255,255,255,0.92)";
      ctx.beginPath();
      ctx.arc(cx, cy, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }

    // Very light vignette only — keep space visible everywhere
    const vig = ctx.createRadialGradient(W * 0.5, H * 0.4, H * 0.2, W * 0.5, H * 0.5, H * 0.85);
    vig.addColorStop(0, "rgba(0,0,0,0)");
    vig.addColorStop(1, "rgba(0,0,0,0.28)");
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, W, H);
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
    const step = 2.6;
    const towerStep = 5.2;

    for (let z = Math.floor((worldZ + 2) / step) * step; z < worldZ + 72; z += step) {
      const fade = Math.max(0.2, 1 - (z - worldZ) * 0.012);
      const z1 = z + step;
      for (const side of [-1, 1]) {
        const x = side * (TRACK_HALF + 0.12);
        const a0 = project(x, 0.04, z);
        const a1 = project(x, 0.04, z1);
        drawNeonLine(
          a0,
          a1,
          "rgba(60, 220, 255," + (0.85 * fade) + ")",
          Math.max(1.5, (a0 && a0.scale ? a0.scale : 20) * 0.055),
          "rgba(40, 160, 255," + (0.2 * fade) + ")"
        );
      }
    }

    // Blue grid towers like Slope's green city blocks
    for (let z = Math.floor((worldZ + 3) / towerStep) * towerStep; z < worldZ + 78; z += towerStep) {
      const fade = Math.max(0.15, 1 - (z - worldZ) * 0.011);
      const h = 1.7 + ((Math.floor(z / towerStep) * 17) % 5) * 0.9;
      const depth = towerStep * 0.7;
      for (const side of [-1, 1]) {
        const x0 = side * (TRACK_HALF + 0.55);
        const x1 = side * (TRACK_HALF + 1.6 + (Math.floor(z / towerStep) % 3) * 0.22);
        const z1 = z + depth;
        drawSlopeGridFace(
          [
            project(Math.min(x0, x1), 0, z),
            project(Math.max(x0, x1), 0, z),
            project(Math.max(x0, x1), h, z),
            project(Math.min(x0, x1), h, z)
          ],
          {
            fill: "rgba(0,0,0," + (0.94 * fade) + ")",
            line: "rgba(55, 210, 255," + (0.8 * fade) + ")",
            uDiv: 3,
            vDiv: Math.max(3, Math.floor(h * 2.2))
          }
        );
        drawSlopeGridFace(
          [
            project(x1, 0, z),
            project(x1, 0, z1),
            project(x1, h, z1),
            project(x1, h, z)
          ],
          {
            fill: "rgba(0,0,0," + (0.9 * fade) + ")",
            line: "rgba(45, 190, 255," + (0.55 * fade) + ")",
            uDiv: 2,
            vDiv: Math.max(3, Math.floor(h * 2.2))
          }
        );
      }
    }

    const fog = ctx.createRadialGradient(W * 0.5, HORIZON + 40, 40, W * 0.5, H * 0.7, H);
    fog.addColorStop(0, "rgba(0, 0, 0, 0)");
    fog.addColorStop(1, "rgba(0, 0, 0, 0.18)");
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
    ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
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
      for (const blk of segBlocks(seg)) drawHazardBlock(seg, blk, 0, 0);
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

    if (seg.archApproach) drawArchApproach(seg, half);
    if (seg.arch) drawArchTunnel(seg, half);
    for (const blk of segBlocks(seg)) drawHazardBlock(seg, blk, h0, h1);
  }

  const SLOPE_BLUE = {
    fill: "rgba(0, 0, 0, 0.96)",
    line: "rgba(55, 210, 255, 0.95)",
    soft: "rgba(40, 170, 255, 0.35)",
    glow: "rgba(30, 140, 255, 0.2)"
  };

  function drawSlopeGridFace(corners, opts = {}) {
    if (!corners.every(Boolean)) return;
    const fill = opts.fill || SLOPE_BLUE.fill;
    const line = opts.line || SLOPE_BLUE.line;
    const uDiv = opts.uDiv || 4;
    const vDiv = opts.vDiv || 3;
    ctx.beginPath();
    ctx.moveTo(corners[0].x, corners[0].y);
    ctx.lineTo(corners[1].x, corners[1].y);
    ctx.lineTo(corners[2].x, corners[2].y);
    ctx.lineTo(corners[3].x, corners[3].y);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = SLOPE_BLUE.glow;
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.strokeStyle = line;
    ctx.lineWidth = 1.4;
    ctx.stroke();
    const lerp4 = (a, b, c, d, u, v) => {
      const abx = a.x + (b.x - a.x) * u;
      const aby = a.y + (b.y - a.y) * u;
      const dcx = d.x + (c.x - d.x) * u;
      const dcy = d.y + (c.y - d.y) * u;
      return { x: abx + (dcx - abx) * v, y: aby + (dcy - aby) * v };
    };
    ctx.strokeStyle = SLOPE_BLUE.soft;
    ctx.lineWidth = 1;
    for (let i = 1; i < uDiv; i += 1) {
      const u = i / uDiv;
      const p0 = lerp4(corners[0], corners[1], corners[2], corners[3], u, 0);
      const p1 = lerp4(corners[0], corners[1], corners[2], corners[3], u, 1);
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(p1.x, p1.y);
      ctx.stroke();
    }
    for (let j = 1; j < vDiv; j += 1) {
      const v = j / vDiv;
      const p0 = lerp4(corners[0], corners[1], corners[2], corners[3], 0, v);
      const p1 = lerp4(corners[0], corners[1], corners[2], corners[3], 1, v);
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(p1.x, p1.y);
      ctx.stroke();
    }
  }

  function archPoint(open, roof, ang) {
    return {
      x: Math.cos(ang) * open,
      y: Math.max(0.02, Math.sin(ang) * roof)
    };
  }

  function drawArchApproach(seg, half) {
    const z0 = seg.z;
    const z1 = seg.z + SEGMENT_LEN;
    const lane = seg.archApproach.lane;
    const h0 = seg.archApproach.h0;
    const h1 = seg.archApproach.h1;
    for (const side of [-1, 1]) {
      const x0 = side * lane;
      const x1 = side * half;
      drawSlopeGridFace(
        [
          project(Math.min(x0, x1), h0, z0),
          project(Math.max(x0, x1), h0, z0),
          project(Math.max(x0, x1), h1, z1),
          project(Math.min(x0, x1), h1, z1)
        ],
        { uDiv: 3, vDiv: 4 }
      );
      drawSlopeGridFace(
        [
          project(x0, 0, z0),
          project(x0, h0, z0),
          project(x0, h1, z1),
          project(x0, 0, z1)
        ],
        { uDiv: 2, vDiv: 4 }
      );
    }
  }

  function drawArchTunnel(seg, half) {
    // Classic Slope arched tunnel (same shape as the green ref), in blue.
    const z0 = seg.z;
    const z1 = seg.z + SEGMENT_LEN;
    const roof = seg.arch.roofH;
    const thick = seg.arch.thick || 0.55;
    const open = Math.min(seg.arch.openHalf, half * 0.92);
    const steps = 10;
    const outer = open + 1.05;

    for (let i = 0; i < steps; i += 1) {
      const a0 = Math.PI - (i / steps) * Math.PI;
      const a1 = Math.PI - ((i + 1) / steps) * Math.PI;
      const pA = archPoint(outer, roof + thick, a0);
      const pB = archPoint(outer, roof + thick, a1);
      drawSlopeGridFace(
        [
          project(pA.x, pA.y, z0),
          project(pB.x, pB.y, z0),
          project(pB.x, pB.y, z1),
          project(pA.x, pA.y, z1)
        ],
        { uDiv: 2, vDiv: 3 }
      );
    }

    for (let i = 0; i < steps; i += 1) {
      const a0 = Math.PI - (i / steps) * Math.PI;
      const a1 = Math.PI - ((i + 1) / steps) * Math.PI;
      const pA = archPoint(open, roof * 0.98, a0);
      const pB = archPoint(open, roof * 0.98, a1);
      drawSlopeGridFace(
        [
          project(pA.x, pA.y, z0),
          project(pB.x, pB.y, z0),
          project(pB.x, pB.y, z1),
          project(pA.x, pA.y, z1)
        ],
        { fill: "rgba(0,0,0,0.93)", uDiv: 2, vDiv: 2 }
      );
    }

    for (const zz of [z0 + 0.04, z1 - 0.04]) {
      for (let i = 0; i < steps; i += 1) {
        const a0 = Math.PI - (i / steps) * Math.PI;
        const a1 = Math.PI - ((i + 1) / steps) * Math.PI;
        const iA = archPoint(open, roof, a0);
        const iB = archPoint(open, roof, a1);
        const oA = archPoint(outer, roof + thick, a0);
        const oB = archPoint(outer, roof + thick, a1);
        drawSlopeGridFace(
          [
            project(iA.x, iA.y, zz),
            project(iB.x, iB.y, zz),
            project(oB.x, oB.y, zz),
            project(oA.x, oA.y, zz)
          ],
          { uDiv: 2, vDiv: 2 }
        );
      }
    }

    for (const side of [-1, 1]) {
      const x = side * open;
      const r0 = project(x, 0.02, z0);
      const r1 = project(x, 0.02, z1);
      const r2 = project(x, roof * 0.78, z1);
      const r3 = project(x, roof * 0.78, z0);
      if (r0 && r1 && r2 && r3) {
        ctx.beginPath();
        ctx.moveTo(r0.x, r0.y);
        ctx.lineTo(r1.x, r1.y);
        ctx.lineTo(r2.x, r2.y);
        ctx.lineTo(r3.x, r3.y);
        ctx.closePath();
        ctx.fillStyle = "rgba(150, 30, 45, 0.92)";
        ctx.fill();
      }
    }

    drawSlopeGridFace(
      [
        project(-outer, roof + thick, z0),
        project(outer, roof + thick, z0),
        project(outer, roof + thick, z1),
        project(-outer, roof + thick, z1)
      ],
      { uDiv: 8, vDiv: 4 }
    );

    ctx.beginPath();
    let started = false;
    for (let i = 0; i <= steps; i += 1) {
      const ang = Math.PI - (i / steps) * Math.PI;
      const pt = archPoint(open, roof, ang);
      const pr = project(pt.x, pt.y, z0 + 0.1);
      if (!pr) continue;
      if (!started) {
        ctx.moveTo(pr.x, pr.y);
        started = true;
      } else ctx.lineTo(pr.x, pr.y);
    }
    if (started) {
      ctx.strokeStyle = "rgba(90, 230, 255, 0.95)";
      ctx.lineWidth = 2.8;
      ctx.stroke();
    }
  }

  function drawHazardBlock(seg, blk, h0, h1) {
    const z0 = seg.z;
    const z1 = seg.z + SEGMENT_LEN;
    const bh = blk.w * 0.5;
    const base = Math.max(h0, h1) + (blk.y || 0);
    const top = base + blk.h;
    const corners = [
      project(blk.x - bh, base, z0 + 0.8),
      project(blk.x + bh, base, z0 + 0.8),
      project(blk.x + bh, base, z1 - 0.8),
      project(blk.x - bh, base, z1 - 0.8),
      project(blk.x - bh, top, z0 + 0.8),
      project(blk.x + bh, top, z0 + 0.8),
      project(blk.x + bh, top, z1 - 0.8),
      project(blk.x - bh, top, z1 - 0.8)
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
    // Hazard pattern stripes on the top face
    ctx.beginPath();
    ctx.moveTo(corners[4].x, corners[4].y);
    ctx.lineTo(corners[5].x, corners[5].y);
    ctx.lineTo(corners[6].x, corners[6].y);
    ctx.lineTo(corners[7].x, corners[7].y);
    ctx.closePath();
    ctx.save();
    ctx.clip();
    for (let i = 0; i < 5; i += 1) {
      const t0 = project(blk.x - bh, top + 0.01, z0 + 0.9 + i * 0.55);
      const t1 = project(blk.x + bh, top + 0.01, z0 + 0.9 + i * 0.55);
      if (t0 && t1) {
        ctx.beginPath();
        ctx.moveTo(t0.x, t0.y);
        ctx.lineTo(t1.x, t1.y);
        ctx.strokeStyle = i % 2 ? "rgba(255,220,230,0.35)" : "rgba(120,20,40,0.35)";
        ctx.lineWidth = Math.max(1.5, t0.scale * 0.05);
        ctx.stroke();
      }
    }
    ctx.restore();
    ctx.beginPath();
    ctx.moveTo(corners[0].x, corners[0].y);
    ctx.lineTo(corners[1].x, corners[1].y);
    ctx.lineTo(corners[5].x, corners[5].y);
    ctx.lineTo(corners[4].x, corners[4].y);
    ctx.closePath();
    ctx.fillStyle = "#c43b55";
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(corners[1].x, corners[1].y);
    ctx.lineTo(corners[2].x, corners[2].y);
    ctx.lineTo(corners[6].x, corners[6].y);
    ctx.lineTo(corners[5].x, corners[5].y);
    ctx.closePath();
    ctx.fillStyle = "#a8324a";
    ctx.fill();
    if ((blk.y || 0) > 0.2) {
      const stem = project(blk.x, Math.max(0, base - 1.2), (z0 + z1) * 0.5);
      const foot = project(blk.x, 0.02, (z0 + z1) * 0.5);
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
