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
  const GROUND_Y = H - 56;
  const GRAVITY = 2400;
  const JUMP_V = -760;
  const DUCK_H = 34;
  const STAND_H = 52;
  const DINO_W = 44;

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
  let clouds = [];
  let spawnTimer = 0;
  let lastTs = 0;
  let night = false;
  let anim = 0;
  let sessionStarted = false;
  let lastSubmitAt = 0;
  let raf = 0;

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
    night = false;
    dead = false;
    dino = {
      x: 72,
      y: GROUND_Y - STAND_H,
      vy: 0,
      w: DINO_W,
      h: STAND_H,
      onGround: true,
      ducking: false
    };
    clouds = Array.from({ length: 4 }, (_, i) => ({
      x: 120 + i * 220,
      y: 36 + (i % 3) * 28,
      s: 0.35 + (i % 3) * 0.12
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
        type: "bird",
        x: W + 20,
        y: GROUND_Y - (Math.random() < 0.5 ? 78 : 48),
        w: 46,
        h: 28,
        passed: false
      });
      return;
    }
    const tall = Math.random() < 0.45;
    const twin = !tall && Math.random() < 0.35;
    const h = tall ? 58 : 40;
    const w = tall ? 22 : 18;
    obstacles.push({
      type: "cactus",
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
      x: dinoBox.x + 8,
      y: dinoBox.y + 6,
      w: dinoBox.w - 14,
      h: dinoBox.h - 10
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
    overlayTitle.textContent = "Game over";
    overlayText.textContent = `You ran ${Math.floor(score)} points. Jump again to retry.`;
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
    overlayTitle.textContent = canResume ? "Paused" : "Dino Run";
    overlayText.textContent = canResume
      ? "Take a breath, then keep running."
      : "Jump over cacti, duck under birds, and see how far you can go.";
    startBtn.textContent = canResume || dead ? "Play again" : "Play";
    resumeBtn?.classList.toggle("hidden", !canResume);
    overlay?.classList.remove("hidden");
  }

  function update(dt) {
    if (!running || paused || dead) return;
    anim += dt;
    speed = Math.min(720, 340 + score * 0.55);
    night = Math.floor(score / 400) % 2 === 1;
    groundX = (groundX - speed * dt) % 48;
    score += speed * dt * 0.085;

    clouds.forEach((c) => {
      c.x -= c.s * speed * 0.15 * dt;
      if (c.x < -80) {
        c.x = W + 40 + Math.random() * 120;
        c.y = 28 + Math.random() * 70;
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
        o.type === "cactus" && o.twin
          ? { x: o.x, y: o.y, w: o.w * 2 + 8, h: o.h }
          : { x: o.x, y: o.y, w: o.w, h: o.h };
      if (overlaps(box, ob)) die();
    });
    obstacles = obstacles.filter((o) => o.x > -80);

    updateHud();
    checkAchievements();
    if (Math.floor(score) % 25 === 0) maybeSubmit(false);
  }

  function drawGround() {
    ctx.fillStyle = night ? "#2b3035" : "#d8cbb5";
    ctx.fillRect(0, GROUND_Y, W, H - GROUND_Y);
    ctx.strokeStyle = night ? "#868e96" : "#8b7355";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, GROUND_Y);
    ctx.lineTo(W, GROUND_Y);
    ctx.stroke();
    ctx.fillStyle = night ? "#495057" : "#b79a78";
    for (let x = groundX; x < W + 48; x += 48) {
      ctx.fillRect(x, GROUND_Y + 10, 18, 3);
      ctx.fillRect(x + 24, GROUND_Y + 22, 12, 3);
    }
  }

  function drawCloud(c) {
    ctx.fillStyle = night ? "rgba(173, 181, 189, 0.35)" : "rgba(255, 255, 255, 0.85)";
    const y = c.y;
    ctx.beginPath();
    ctx.arc(c.x, y, 14, 0, Math.PI * 2);
    ctx.arc(c.x + 16, y - 6, 16, 0, Math.PI * 2);
    ctx.arc(c.x + 34, y, 13, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawDino() {
    if (!dino) return;
    const { x, y, w, h, ducking, onGround } = dino;
    const leg = onGround ? Math.floor(anim * speed * 0.02) % 2 : 0;
    ctx.fillStyle = night ? "#e9ecef" : "#3d3429";
    if (ducking) {
      ctx.fillRect(x, y + 8, w + 8, h - 8);
      ctx.fillRect(x + w - 2, y + 10, 16, 14);
      ctx.fillRect(x + w + 8, y + 12, 4, 4);
    } else {
      ctx.fillRect(x + 8, y + 16, 28, h - 22);
      ctx.fillRect(x + 26, y, 22, 22);
      ctx.fillRect(x + 42, y + 8, 5, 5);
      ctx.fillStyle = night ? "#212529" : "#f4efe4";
      ctx.fillRect(x + 40, y + 5, 4, 4);
      ctx.fillStyle = night ? "#e9ecef" : "#3d3429";
      ctx.fillRect(x + 10, y + h - 8, 8, 8 + (leg ? 2 : 0));
      ctx.fillRect(x + 26, y + h - 8, 8, 8 + (leg ? 0 : 2));
      ctx.fillRect(x + 4, y + 20, 10, 6);
    }
  }

  function drawCactus(o) {
    ctx.fillStyle = night ? "#adb5bd" : "#3f6b3a";
    ctx.fillRect(o.x + o.w * 0.35, o.y, o.w * 0.3, o.h);
    ctx.fillRect(o.x, o.y + o.h * 0.35, o.w * 0.45, o.w * 0.28);
    ctx.fillRect(o.x, o.y + o.h * 0.2, o.w * 0.22, o.h * 0.28);
    ctx.fillRect(o.x + o.w * 0.55, o.y + o.h * 0.45, o.w * 0.45, o.w * 0.28);
    ctx.fillRect(o.x + o.w * 0.78, o.y + o.h * 0.28, o.w * 0.22, o.h * 0.3);
    if (o.twin) {
      const x2 = o.x + o.w + 8;
      ctx.fillRect(x2 + o.w * 0.35, o.y + 6, o.w * 0.3, o.h - 6);
      ctx.fillRect(x2, o.y + o.h * 0.4, o.w * 0.4, o.w * 0.25);
    }
  }

  function drawBird(o) {
    const flap = Math.floor(anim * 10) % 2;
    ctx.fillStyle = night ? "#ced4da" : "#3d3429";
    ctx.fillRect(o.x + 8, o.y + 10, 28, 12);
    ctx.fillRect(o.x + 30, o.y + 8, 10, 8);
    ctx.beginPath();
    if (flap) {
      ctx.moveTo(o.x + 14, o.y + 12);
      ctx.lineTo(o.x + 24, o.y - 2);
      ctx.lineTo(o.x + 30, o.y + 12);
    } else {
      ctx.moveTo(o.x + 14, o.y + 14);
      ctx.lineTo(o.x + 24, o.y + 26);
      ctx.lineTo(o.x + 30, o.y + 14);
    }
    ctx.fill();
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    const skyTop = night ? "#1a1d21" : "#efe6d6";
    const skyBot = night ? "#2c3136" : "#f7f1e6";
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, skyTop);
    g.addColorStop(1, skyBot);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    clouds.forEach(drawCloud);
    drawGround();
    obstacles.forEach((o) => (o.type === "bird" ? drawBird(o) : drawCactus(o)));
    drawDino();

    ctx.fillStyle = night ? "#f8f9fa" : "#3d3429";
    ctx.font = "700 18px Outfit, sans-serif";
    ctx.textAlign = "right";
    ctx.fillText(String(Math.floor(score)).padStart(5, "0"), W - 18, 28);
    if (waitingStart && !dead) {
      ctx.textAlign = "center";
      ctx.font = "700 22px Outfit, sans-serif";
      ctx.fillText("Press Space / Tap to start", W / 2, H * 0.42);
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
