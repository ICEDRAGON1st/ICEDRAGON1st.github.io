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
  const DUCK_H = 48;
  const STAND_H = 74;
  const DINO_W = 62;

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
      r: 1.2 + (i % 4)
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
    if (!dino.onGround) return;
    dino.ducking = !!on;
    dino.h = on ? DUCK_H : STAND_H;
    dino.y = GROUND_Y - dino.h;
  }

  function spawnObstacle() {
    const roll = Math.random();
    if (score > 180 && roll < 0.28) {
      obstacles.push({
        type: "bat",
        x: W + 20,
        y: GROUND_Y - (Math.random() < 0.5 ? 112 : 68),
        w: 64,
        h: 38,
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
    return {
      x: dinoBox.x + 10,
      y: dinoBox.y + 8,
      w: dinoBox.w - 18,
      h: dinoBox.h - 14
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
    overlayTitle.textContent = canResume ? "Paused" : "Runosaur";
    overlayText.textContent = canResume
      ? "The dragon is still behind you…"
      : "Race through ice caves — jump frost spikes, duck crystal bats, and stay ahead of the dragon.";
    startBtn.textContent = canResume || dead ? "Play again" : "Play";
    resumeBtn?.classList.toggle("hidden", !canResume);
    overlay?.classList.remove("hidden");
  }

  function update(dt) {
    if (!running || paused || dead) return;
    anim += dt;
    speed = Math.min(720, 340 + score * 0.55);
    deepCave = Math.floor(score / 400) % 2 === 1;
    chaseBreath += dt;
    groundX = (groundX - speed * dt) % 48;
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

  function drawCaveBackdrop() {
    const top = deepCave ? "#070b18" : "#122038";
    const mid = deepCave ? "#10182c" : "#1a3358";
    const bot = deepCave ? "#1a2438" : "#2a4a72";
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, top);
    g.addColorStop(0.55, mid);
    g.addColorStop(1, bot);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // Ice ceiling teeth
    ctx.fillStyle = deepCave ? "rgba(140, 180, 220, 0.22)" : "rgba(180, 220, 255, 0.28)";
    for (let x = -20 + (groundX * 0.4) % 70; x < W + 40; x += 70) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + 18, 28 + (x % 40));
      ctx.lineTo(x + 36, 0);
      ctx.fill();
    }

    // Distant ice walls
    ctx.fillStyle = deepCave ? "rgba(60, 90, 130, 0.35)" : "rgba(90, 140, 190, 0.25)";
    ctx.beginPath();
    ctx.moveTo(0, GROUND_Y - 40);
    for (let x = 0; x <= W; x += 80) {
      const y = GROUND_Y - 90 - Math.sin((x + groundX) * 0.02) * 28;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(W, GROUND_Y);
    ctx.lineTo(0, GROUND_Y);
    ctx.fill();
  }

  function drawChaseDragon() {
    const bob = Math.sin(anim * 2.2) * 10;
    const x = -30 + Math.min(18, score * 0.04);
    const y = GROUND_Y - 130 + bob;
    ctx.save();
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = deepCave ? "#1c1028" : "#241438";
    // Body
    ctx.beginPath();
    ctx.ellipse(x + 70, y + 40, 70, 32, -0.15, 0, Math.PI * 2);
    ctx.fill();
    // Neck + head
    ctx.beginPath();
    ctx.moveTo(x + 110, y + 30);
    ctx.quadraticCurveTo(x + 150, y + 10, x + 168, y + 28);
    ctx.quadraticCurveTo(x + 150, y + 48, x + 118, y + 46);
    ctx.fill();
    // Horns
    ctx.fillStyle = deepCave ? "#6a8cb0" : "#9ec5e8";
    ctx.beginPath();
    ctx.moveTo(x + 148, y + 18);
    ctx.lineTo(x + 142, y - 8);
    ctx.lineTo(x + 156, y + 16);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x + 158, y + 20);
    ctx.lineTo(x + 168, y - 4);
    ctx.lineTo(x + 164, y + 22);
    ctx.fill();
    // Eye
    ctx.fillStyle = "#ff6b6b";
    ctx.beginPath();
    ctx.arc(x + 158, y + 28, 3.5, 0, Math.PI * 2);
    ctx.fill();
    // Wing
    const flap = Math.sin(anim * 5) * 18;
    ctx.fillStyle = deepCave ? "rgba(40, 20, 60, 0.7)" : "rgba(60, 30, 90, 0.65)";
    ctx.beginPath();
    ctx.moveTo(x + 50, y + 30);
    ctx.quadraticCurveTo(x + 20, y - 10 + flap, x - 10, y + 20);
    ctx.quadraticCurveTo(x + 30, y + 50, x + 55, y + 42);
    ctx.fill();
    // Frost breath pulse
    if (Math.sin(chaseBreath * 3) > 0.55) {
      const breath = ctx.createLinearGradient(x + 168, y + 30, x + 230, y + 30);
      breath.addColorStop(0, "rgba(180, 230, 255, 0.55)");
      breath.addColorStop(1, "rgba(180, 230, 255, 0)");
      ctx.fillStyle = breath;
      ctx.beginPath();
      ctx.moveTo(x + 168, y + 26);
      ctx.quadraticCurveTo(x + 200, y + 18, x + 228, y + 30);
      ctx.quadraticCurveTo(x + 200, y + 42, x + 168, y + 34);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawGround() {
    const ice = ctx.createLinearGradient(0, GROUND_Y, 0, H);
    ice.addColorStop(0, deepCave ? "#3d5a78" : "#7eb6d9");
    ice.addColorStop(0.35, deepCave ? "#2a4058" : "#5a9bc4");
    ice.addColorStop(1, deepCave ? "#1a2838" : "#3a6e94");
    ctx.fillStyle = ice;
    ctx.fillRect(0, GROUND_Y, W, H - GROUND_Y);

    ctx.strokeStyle = deepCave ? "#a8c8e0" : "#d8f0ff";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, GROUND_Y);
    ctx.lineTo(W, GROUND_Y);
    ctx.stroke();

    ctx.fillStyle = deepCave ? "rgba(200, 230, 255, 0.25)" : "rgba(255, 255, 255, 0.45)";
    for (let x = groundX; x < W + 64; x += 64) {
      ctx.beginPath();
      ctx.moveTo(x + 8, GROUND_Y + 8);
      ctx.lineTo(x + 18, GROUND_Y + 22);
      ctx.lineTo(x + 4, GROUND_Y + 22);
      ctx.fill();
      ctx.fillRect(x + 36, GROUND_Y + 28, 14, 3);
    }
  }

  function drawFlake(f) {
    ctx.fillStyle = deepCave ? "rgba(180, 210, 240, 0.35)" : "rgba(255, 255, 255, 0.7)";
    ctx.beginPath();
    ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawRunner() {
    if (!dino) return;
    const { x, y, w, h, ducking, onGround } = dino;
    const leg = onGround ? Math.floor(anim * speed * 0.02) % 2 : 0;
    const body = deepCave ? "#c5d8ec" : "#e8f4ff";
    const accent = deepCave ? "#5b8fd4" : "#3d7ecc";
    const belly = deepCave ? "#8aa8c8" : "#b8d4f0";

    ctx.fillStyle = accent;
    if (ducking) {
      // Low glide — wings tucked
      ctx.beginPath();
      ctx.ellipse(x + w * 0.45, y + h * 0.55, w * 0.55, h * 0.38, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = body;
      ctx.beginPath();
      ctx.ellipse(x + w * 0.85, y + h * 0.45, 16, 12, 0.1, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#1a2a40";
      ctx.fillRect(x + w + 8, y + h * 0.38, 5, 5);
      // Tail
      ctx.fillStyle = accent;
      ctx.beginPath();
      ctx.moveTo(x + 4, y + h * 0.5);
      ctx.lineTo(x - 16, y + h * 0.35);
      ctx.lineTo(x + 2, y + h * 0.65);
      ctx.fill();
    } else {
      // Body
      ctx.beginPath();
      ctx.ellipse(x + 28, y + 40, 22, 20, -0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = belly;
      ctx.beginPath();
      ctx.ellipse(x + 30, y + 46, 14, 12, -0.15, 0, Math.PI * 2);
      ctx.fill();
      // Head
      ctx.fillStyle = body;
      ctx.beginPath();
      ctx.ellipse(x + 52, y + 22, 16, 13, -0.25, 0, Math.PI * 2);
      ctx.fill();
      // Snout
      ctx.fillStyle = accent;
      ctx.beginPath();
      ctx.ellipse(x + 66, y + 26, 9, 6, 0.1, 0, Math.PI * 2);
      ctx.fill();
      // Eye
      ctx.fillStyle = "#0a1520";
      ctx.beginPath();
      ctx.arc(x + 56, y + 18, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(x + 55, y + 17, 1.2, 0, Math.PI * 2);
      ctx.fill();
      // Horn
      ctx.fillStyle = "#9ec5e8";
      ctx.beginPath();
      ctx.moveTo(x + 48, y + 12);
      ctx.lineTo(x + 44, y - 2);
      ctx.lineTo(x + 54, y + 12);
      ctx.fill();
      // Wing (small flap)
      const wing = Math.sin(anim * 10) * 8;
      ctx.fillStyle = deepCave ? "rgba(100, 140, 200, 0.85)" : "rgba(90, 150, 220, 0.9)";
      ctx.beginPath();
      ctx.moveTo(x + 22, y + 32);
      ctx.quadraticCurveTo(x + 8, y + 8 + wing, x - 6, y + 28);
      ctx.quadraticCurveTo(x + 14, y + 40, x + 24, y + 38);
      ctx.fill();
      // Legs
      ctx.fillStyle = accent;
      ctx.fillRect(x + 18, y + h - 14, 10, 14 + (leg ? 3 : 0));
      ctx.fillRect(x + 36, y + h - 14, 10, 14 + (leg ? 0 : 3));
      // Tail
      ctx.beginPath();
      ctx.moveTo(x + 10, y + 42);
      ctx.quadraticCurveTo(x - 8, y + 36, x - 18, y + 48);
      ctx.quadraticCurveTo(x - 2, y + 50, x + 12, y + 48);
      ctx.fill();
    }
  }

  function drawSpike(o) {
    const tip = deepCave ? "#8eb4d4" : "#d8f2ff";
    const base = deepCave ? "#4a6e90" : "#6a9ec4";
    const drawOne = (ox, oy, ow, oh) => {
      const g = ctx.createLinearGradient(ox, oy, ox + ow, oy + oh);
      g.addColorStop(0, tip);
      g.addColorStop(1, base);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(ox + ow * 0.5, oy);
      ctx.lineTo(ox + ow, oy + oh);
      ctx.lineTo(ox, oy + oh);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.35)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(ox + ow * 0.5, oy + 4);
      ctx.lineTo(ox + ow * 0.5, oy + oh - 6);
      ctx.stroke();
    };
    drawOne(o.x, o.y, o.w, o.h);
    if (o.twin) drawOne(o.x + o.w + 8, o.y + 6, o.w, o.h - 6);
  }

  function drawBat(o) {
    const flap = Math.sin(anim * 14) > 0;
    ctx.fillStyle = deepCave ? "#9bb8d4" : "#c5e0f5";
    ctx.beginPath();
    ctx.ellipse(o.x + 32, o.y + 20, 16, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = deepCave ? "#6a90b8" : "#7eb0d8";
    ctx.beginPath();
    if (flap) {
      ctx.moveTo(o.x + 28, o.y + 18);
      ctx.quadraticCurveTo(o.x + 10, o.y - 8, o.x - 4, o.y + 16);
      ctx.quadraticCurveTo(o.x + 16, o.y + 22, o.x + 28, o.y + 22);
    } else {
      ctx.moveTo(o.x + 28, o.y + 20);
      ctx.quadraticCurveTo(o.x + 12, o.y + 40, o.x - 2, o.y + 24);
      ctx.quadraticCurveTo(o.x + 16, o.y + 24, o.x + 28, o.y + 24);
    }
    ctx.fill();
    ctx.beginPath();
    if (flap) {
      ctx.moveTo(o.x + 36, o.y + 18);
      ctx.quadraticCurveTo(o.x + 54, o.y - 8, o.x + 68, o.y + 16);
      ctx.quadraticCurveTo(o.x + 48, o.y + 22, o.x + 36, o.y + 22);
    } else {
      ctx.moveTo(o.x + 36, o.y + 20);
      ctx.quadraticCurveTo(o.x + 52, o.y + 40, o.x + 66, o.y + 24);
      ctx.quadraticCurveTo(o.x + 48, o.y + 24, o.x + 36, o.y + 24);
    }
    ctx.fill();
    // Crystal shard body glow
    ctx.fillStyle = "rgba(180, 230, 255, 0.5)";
    ctx.beginPath();
    ctx.moveTo(o.x + 32, o.y + 10);
    ctx.lineTo(o.x + 38, o.y + 22);
    ctx.lineTo(o.x + 26, o.y + 22);
    ctx.fill();
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    drawCaveBackdrop();
    drawChaseDragon();
    flakes.forEach(drawFlake);
    drawGround();
    obstacles.forEach((o) => (o.type === "bat" ? drawBat(o) : drawSpike(o)));
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
      ctx.font = "700 30px Outfit, sans-serif";
      ctx.fillText("Press Space / Tap to flee", W / 2, H * 0.42);
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
      groundX = (groundX - 40 * dt) % 48;
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
    jump();
  });

  window.addEventListener("keydown", (e) => {
    if (e.code === "Space" || e.code === "ArrowUp" || e.code === "KeyW" || e.key === " ") {
      e.preventDefault();
      jump();
    } else if (e.code === "ArrowDown" || e.code === "KeyS") {
      e.preventDefault();
      setDuck(true);
    } else if (e.code === "Escape") {
      pauseGame();
    }
  });
  window.addEventListener("keyup", (e) => {
    if (e.code === "ArrowDown" || e.code === "KeyS") setDuck(false);
  });

  resetWorld();
  waitingStart = true;
  updateHud();
  maybeSubmit(true);
  openMenu(false);
  raf = requestAnimationFrame(frame);
  window.addEventListener("beforeunload", () => maybeSubmit(true));
})();
