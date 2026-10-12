(() => {
  const GAME_ID = "waves";
  const HIGH_KEY = "space-waves-high-score";
  const BEST_LEVEL_KEY = "space-waves-best-level";

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");

  const els = {
    menu: document.getElementById("menu-btn"),
    mode: document.getElementById("hud-mode"),
    progress: document.getElementById("progress"),
    high: document.getElementById("high-score"),
    hint: document.getElementById("hint"),
    overlay: document.getElementById("overlay"),
    title: document.getElementById("overlay-title"),
    text: document.getElementById("overlay-text"),
    best: document.getElementById("overlay-best"),
    picker: document.getElementById("level-picker"),
    start: document.getElementById("start-btn"),
    resume: document.getElementById("resume-btn"),
    retry: document.getElementById("retry-btn"),
    games: document.getElementById("games-btn")
  };

  /** Handcrafted levels: segments of corridor (world units). */
  const LEVELS = [
    {
      id: 1,
      name: "Warmup",
      diff: "easy",
      speed: 280,
      theme: "#5ce1ff",
      path: easyPath(3200, 0.35)
    },
    {
      id: 2,
      name: "Ripple",
      diff: "easy",
      speed: 300,
      theme: "#5dff9f",
      path: sinePath(3800, 70, 0.004, 0.4)
    },
    {
      id: 3,
      name: "Needle",
      diff: "easy",
      speed: 310,
      theme: "#7aefff",
      path: squeezePath(4000, 0.38, 0.28)
    },
    {
      id: 4,
      name: "Zig",
      diff: "medium",
      speed: 330,
      theme: "#ffd24a",
      path: zigPath(4500, 90, 420, 0.32)
    },
    {
      id: 5,
      name: "Thorns",
      diff: "medium",
      speed: 340,
      theme: "#ffb347",
      path: spikePath(4800, 0.3, 280)
    },
    {
      id: 6,
      name: "Pulse",
      diff: "medium",
      speed: 355,
      theme: "#ff9f6b",
      path: sinePath(5000, 110, 0.0055, 0.28)
    },
    {
      id: 7,
      name: "Crush",
      diff: "hard",
      speed: 370,
      theme: "#ff7a96",
      path: squeezePath(5200, 0.3, 0.2)
    },
    {
      id: 8,
      name: "Saw",
      diff: "hard",
      speed: 385,
      theme: "#ff5a78",
      path: zigPath(5400, 120, 300, 0.24)
    },
    {
      id: 9,
      name: "Orbit",
      diff: "hard",
      speed: 400,
      theme: "#ff4fd8",
      path: spikePath(5600, 0.22, 220)
    },
    {
      id: 10,
      name: "Nova",
      diff: "extreme",
      speed: 420,
      theme: "#d46bff",
      path: sinePath(6000, 130, 0.007, 0.2)
    },
    {
      id: 11,
      name: "Void",
      diff: "extreme",
      speed: 440,
      theme: "#a78bfa",
      path: zigPath(6200, 140, 260, 0.2)
    },
    {
      id: 12,
      name: "Singularity",
      diff: "extreme",
      speed: 460,
      theme: "#ff4fd8",
      path: spikePath(6500, 0.18, 180)
    }
  ];

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function clamp(n, a, b) {
    return Math.max(a, Math.min(b, n));
  }

  function easyPath(len, gap) {
    const pts = [];
    for (let x = 0; x <= len; x += 40) {
      const mid = 0.5 + Math.sin(x * 0.0022) * 0.08;
      pts.push({ x, top: mid - gap / 2, bot: mid + gap / 2, spike: false });
    }
    return finalizePath(pts);
  }

  function sinePath(len, ampPx, freq, gap) {
    const pts = [];
    for (let x = 0; x <= len; x += 28) {
      const mid = 0.5 + (Math.sin(x * freq) * ampPx) / 540;
      pts.push({ x, top: mid - gap / 2, bot: mid + gap / 2, spike: x > 400 && x % 360 < 40 });
    }
    return finalizePath(pts);
  }

  function zigPath(len, ampPx, period, gap) {
    const pts = [];
    for (let x = 0; x <= len; x += 24) {
      const t = (x % period) / period;
      const tri = t < 0.5 ? t * 2 : 2 - t * 2;
      const mid = 0.5 + ((tri - 0.5) * 2 * ampPx) / 540;
      pts.push({ x, top: mid - gap / 2, bot: mid + gap / 2, spike: x > 500 && Math.floor(x / (period / 2)) % 2 === 0 && x % 80 < 28 });
    }
    return finalizePath(pts);
  }

  function squeezePath(len, openGap, tightGap) {
    const pts = [];
    for (let x = 0; x <= len; x += 30) {
      const wave = (Math.sin(x * 0.0035) + 1) / 2;
      const gap = lerp(openGap, tightGap, wave);
      const mid = 0.5 + Math.sin(x * 0.0018) * 0.12;
      pts.push({ x, top: mid - gap / 2, bot: mid + gap / 2, spike: wave > 0.75 && x % 200 < 36 });
    }
    return finalizePath(pts);
  }

  function spikePath(len, gap, spacing) {
    const pts = [];
    for (let x = 0; x <= len; x += 22) {
      const mid = 0.5 + Math.sin(x * 0.003) * 0.14 + Math.sin(x * 0.0011) * 0.06;
      pts.push({
        x,
        top: mid - gap / 2,
        bot: mid + gap / 2,
        spike: x > 350 && x % spacing < 50
      });
    }
    return finalizePath(pts);
  }

  function finalizePath(pts) {
    return pts.map((p) => ({
      x: p.x,
      top: clamp(p.top, 0.04, 0.7),
      bot: clamp(p.bot, 0.3, 0.96),
      spike: !!p.spike
    }));
  }

  function samplePath(path, x) {
    if (!path.length) return { top: 0.2, bot: 0.8, spike: false };
    if (x <= path[0].x) return path[0];
    if (x >= path[path.length - 1].x) return path[path.length - 1];
    let lo = 0;
    let hi = path.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (path[mid].x <= x) lo = mid;
      else hi = mid;
    }
    const a = path[lo];
    const b = path[hi];
    const t = (x - a.x) / Math.max(1, b.x - a.x);
    return {
      top: lerp(a.top, b.top, t),
      bot: lerp(a.bot, b.bot, t),
      spike: t < 0.5 ? a.spike : b.spike
    };
  }

  let mode = "classic";
  let levelIndex = 0;
  let running = false;
  let paused = false;
  let dead = false;
  let won = false;
  let recordedPlay = false;
  let holding = false;
  let worldX = 0;
  let shipY = 0.5;
  let shipVy = 0;
  let trail = [];
  let endlessPath = [];
  let endlessGenX = 0;
  let bestDist = readHigh();
  let flash = 0;
  let raf = 0;
  let lastTs = 0;
  let shake = 0;

  const SHIP_SCREEN_X = 0.22;
  // Tighter flight: pull toward a climb/fall speed instead of slippery accel
  const CLIMB_VY = -0.72;
  const FALL_VY = 0.78;
  const STEER = 14; // how fast velocity snaps to climb/fall (higher = less slippery)
  const MAX_VY = 0.95;
  const MOVE_SCALE = 145;

  function readHigh() {
    try {
      const n = Number(localStorage.getItem(HIGH_KEY));
      return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
    } catch {
      return 0;
    }
  }

  function persistHigh(n) {
    bestDist = Math.max(bestDist, Math.floor(n));
    try {
      localStorage.setItem(HIGH_KEY, String(bestDist));
    } catch {}
    try {
      window.HubLeaderboard?.submit?.(GAME_ID, bestDist);
    } catch {}
  }

  function currentLevel() {
    return LEVELS[levelIndex] || LEVELS[0];
  }

  function activePath() {
    return mode === "endless" ? endlessPath : currentLevel().path;
  }

  function pathEnd() {
    const p = activePath();
    return p.length ? p[p.length - 1].x : 1000;
  }

  function speed() {
    // Slightly slower scroll so steering has more time to react
    if (mode === "endless") return 250 + Math.min(180, worldX / 48);
    return currentLevel().speed * 0.88;
  }

  function themeColor() {
    if (mode === "endless") return "#5ce1ff";
    return currentLevel().theme || "#5ce1ff";
  }

  function resize() {
    const wrap = canvas.parentElement;
    const w = Math.max(320, Math.floor(wrap?.clientWidth || window.innerWidth || 960));
    const h = Math.max(240, Math.floor(wrap?.clientHeight || window.innerHeight || 540));
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function paintHud() {
    els.mode.textContent = mode === "endless" ? "Endless" : `Lv ${currentLevel().id}`;
    els.high.textContent = String(bestDist);
    els.best.textContent = String(bestDist);
    if (mode === "endless") {
      els.progress.textContent = `${Math.floor(worldX)}m`;
    } else {
      const pct = clamp((worldX / pathEnd()) * 100, 0, 100);
      els.progress.textContent = `${Math.floor(pct)}%`;
    }
  }

  function renderLevelPicker() {
    els.picker.innerHTML = "";
    els.picker.classList.toggle("hidden", mode !== "classic");
    if (mode !== "classic") return;
    LEVELS.forEach((lv, i) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `lvl-btn is-${lv.diff}` + (i === levelIndex ? " active" : "");
      btn.textContent = String(lv.id);
      btn.title = `${lv.name} · ${lv.diff}`;
      btn.addEventListener("click", () => {
        levelIndex = i;
        renderLevelPicker();
        paintHud();
      });
      els.picker.appendChild(btn);
    });
  }

  function resetRun() {
    worldX = 80;
    shipY = 0.5;
    shipVy = 0;
    trail = [];
    dead = false;
    won = false;
    flash = 0;
    shake = 0;
    holding = false;
    if (mode === "endless") {
      endlessPath = [];
      endlessGenX = 0;
      extendEndless(2500);
    }
  }

  function extendEndless(untilX) {
    while (endlessGenX < untilX) {
      const start = endlessGenX;
      const len = 900 + Math.random() * 700;
      const gap = clamp(0.38 - endlessGenX / 28000, 0.16, 0.38);
      const amp = 60 + Math.min(100, endlessGenX / 80);
      const kind = Math.floor(Math.random() * 3);
      let chunk;
      if (kind === 0) chunk = sinePath(len, amp, 0.004 + Math.random() * 0.003, gap);
      else if (kind === 1) chunk = zigPath(len, amp, 280 + Math.random() * 160, gap);
      else chunk = spikePath(len, gap, 200 + Math.random() * 120);
      chunk.forEach((p) => {
        endlessPath.push({
          x: start + p.x,
          top: p.top,
          bot: p.bot,
          spike: p.spike && start > 200
        });
      });
      endlessGenX = start + len;
    }
  }

  function recordPlayOnce() {
    if (recordedPlay) return;
    recordedPlay = true;
    try {
      window.HubPlays?.record?.(GAME_ID);
    } catch {}
    try {
      window.HubStreak?.recordPlay?.();
    } catch {}
  }

  function startGame() {
    recordPlayOnce();
    resetRun();
    running = true;
    paused = false;
    hideOverlay();
    lastTs = performance.now();
    if (!raf) raf = requestAnimationFrame(loop);
    els.hint.textContent = "Hold to rise · release to fall";
  }

  function showOverlay(kind) {
    paused = true;
    els.overlay.classList.remove("hidden");
    els.resume.classList.add("hidden");
    els.retry.classList.add("hidden");
    if (kind === "pause") {
      els.title.textContent = "Paused";
      els.text.textContent = "Hold to rise, release to fall. Neon walls and spikes will end the run.";
      els.resume.classList.remove("hidden");
      els.start.textContent = "Restart";
    } else if (kind === "dead") {
      const dist = Math.floor(worldX);
      els.title.textContent = "Crashed";
      els.text.textContent =
        mode === "endless"
          ? `You made it ${dist}m. Instant retry — find the rhythm.`
          : `Reached ${Math.floor(clamp((worldX / pathEnd()) * 100, 0, 99))}% of ${currentLevel().name}.`;
      els.retry.classList.remove("hidden");
      els.start.textContent = mode === "classic" ? "Pick level" : "Play again";
    } else if (kind === "win") {
      els.title.textContent = "Cleared!";
      els.text.textContent = `${currentLevel().name} complete. Next tunnel awaits.`;
      els.retry.classList.remove("hidden");
      els.retry.textContent = "Replay";
      els.start.textContent = levelIndex < LEVELS.length - 1 ? "Next level" : "Play again";
      try {
        window.HubConfetti?.burst?.();
      } catch {}
    } else {
      els.title.textContent = "Space Waves";
      els.text.textContent =
        "Hold to fly up, release to drop. Guide the arrow through neon tunnels — don’t clip the walls or spikes.";
      els.start.textContent = "Play";
      els.retry.textContent = "Retry";
    }
    renderLevelPicker();
    paintHud();
  }

  function hideOverlay() {
    els.overlay.classList.add("hidden");
    paused = false;
  }

  function kill() {
    if (dead || won) return;
    dead = true;
    running = false;
    shake = 10;
    flash = 1;
    persistHigh(worldX);
    paintHud();
    try {
      window.HubSound?.play?.("error");
    } catch {}
    setTimeout(() => showOverlay("dead"), 280);
  }

  function finishLevel() {
    if (dead || won) return;
    won = true;
    running = false;
    persistHigh(pathEnd());
    try {
      localStorage.setItem(BEST_LEVEL_KEY, String(Math.max(levelIndex + 1, Number(localStorage.getItem(BEST_LEVEL_KEY) || 0))));
    } catch {}
    paintHud();
    try {
      window.HubSound?.play?.("success");
    } catch {}
    showOverlay("win");
  }

  function shipHitbox() {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    const sx = w * SHIP_SCREEN_X;
    const sy = shipY * h;
    // Collision a bit smaller than the drawn arrow so the bigger ship still feels fair
    return { x: sx, y: sy, r: Math.max(10, h * 0.026), scale: Math.max(1.55, h * 0.0042) };
  }

  function collide() {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    const worldShipX = worldX;
    const sample = samplePath(activePath(), worldShipX);
    const topY = sample.top * h;
    const botY = sample.bot * h;
    const box = shipHitbox();
    if (box.y - box.r < topY || box.y + box.r > botY) return true;

    if (sample.spike) {
      const gap = botY - topY;
      const spikeH = Math.min(gap * 0.42, h * 0.12);
      // top spike pointing down
      const topTip = topY + spikeH;
      const botTip = botY - spikeH;
      if (pointInTri(box.x, box.y, box.x - 14, topY, box.x + 14, topY, box.x, topTip)) return true;
      if (pointInTri(box.x, box.y, box.x - 14, botY, box.x + 14, botY, box.x, botTip)) return true;
      // radius soft check near tips
      if (dist2(box.x, box.y, box.x, topTip) < box.r * box.r * 1.2) return true;
      if (dist2(box.x, box.y, box.x, botTip) < box.r * box.r * 1.2) return true;
    }
    return false;
  }

  function dist2(ax, ay, bx, by) {
    const dx = ax - bx;
    const dy = ay - by;
    return dx * dx + dy * dy;
  }

  function pointInTri(px, py, x1, y1, x2, y2, x3, y3) {
    const d1 = sign(px, py, x1, y1, x2, y2);
    const d2 = sign(px, py, x2, y2, x3, y3);
    const d3 = sign(px, py, x3, y3, x1, y1);
    const hasNeg = d1 < 0 || d2 < 0 || d3 < 0;
    const hasPos = d1 > 0 || d2 > 0 || d3 > 0;
    return !(hasNeg && hasPos);
  }

  function sign(px, py, x1, y1, x2, y2) {
    return (px - x2) * (y1 - y2) - (x1 - x2) * (py - y2);
  }

  function update(dt) {
    if (!running || paused || dead || won) return;
    const h = canvas.clientHeight;
    worldX += speed() * dt;
    if (mode === "endless") extendEndless(worldX + 2200);

    const targetVy = holding ? CLIMB_VY : FALL_VY;
    shipVy += (targetVy - shipVy) * Math.min(1, STEER * dt);
    shipVy = clamp(shipVy, -MAX_VY, MAX_VY);
    shipY += (shipVy * dt * MOVE_SCALE) / h;
    shipY = clamp(shipY, 0.02, 0.98);

    trail.push({ x: worldX, y: shipY });
    if (trail.length > 28) trail.shift();

    if (mode === "classic" && worldX >= pathEnd() - 20) {
      finishLevel();
      return;
    }
    if (collide()) kill();
    paintHud();
    if (flash > 0) flash = Math.max(0, flash - dt * 3);
    if (shake > 0) shake = Math.max(0, shake - dt * 30);
  }

  function draw() {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    const theme = themeColor();
    const ox = shake ? (Math.random() - 0.5) * shake : 0;
    const oy = shake ? (Math.random() - 0.5) * shake : 0;

    ctx.save();
    ctx.translate(ox, oy);
    ctx.clearRect(-20, -20, w + 40, h + 40);

    // stars
    ctx.fillStyle = "#04060f";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "rgba(200,220,255,0.55)";
    for (let i = 0; i < 40; i++) {
      const sx = ((i * 97 + worldX * 0.15) % (w + 40)) - 20;
      const sy = (i * 53) % h;
      ctx.fillRect(sx, sy, i % 5 === 0 ? 2 : 1, i % 5 === 0 ? 2 : 1);
    }

    const path = activePath();
    const viewLeft = worldX - w * SHIP_SCREEN_X;
    const viewRight = viewLeft + w + 40;

    // open tunnel band
    ctx.beginPath();
    let started = false;
    for (let x = viewLeft; x <= viewRight; x += 10) {
      const s = samplePath(path, x);
      const sx = x - viewLeft;
      if (!started) {
        ctx.moveTo(sx, s.top * h);
        started = true;
      } else ctx.lineTo(sx, s.top * h);
    }
    for (let x = viewRight; x >= viewLeft; x -= 10) {
      const s = samplePath(path, x);
      ctx.lineTo(x - viewLeft, s.bot * h);
    }
    ctx.closePath();
    const glow = ctx.createLinearGradient(0, 0, w, 0);
    glow.addColorStop(0, "rgba(20, 40, 80, 0.35)");
    glow.addColorStop(0.5, "rgba(40, 20, 70, 0.22)");
    glow.addColorStop(1, "rgba(20, 40, 80, 0.35)");
    ctx.fillStyle = glow;
    ctx.fill();

    // solid walls (outside the tunnel)
    ctx.fillStyle = "#070b18";
    ctx.beginPath();
    ctx.moveTo(0, 0);
    for (let x = viewLeft; x <= viewRight; x += 8) {
      const s = samplePath(path, x);
      ctx.lineTo(x - viewLeft, s.top * h);
    }
    ctx.lineTo(w, 0);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(0, h);
    for (let x = viewLeft; x <= viewRight; x += 8) {
      const s = samplePath(path, x);
      ctx.lineTo(x - viewLeft, s.bot * h);
    }
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fill();

    // neon edges
    ctx.strokeStyle = theme;
    ctx.lineWidth = 3;
    ctx.shadowColor = theme;
    ctx.shadowBlur = 12;
    ctx.beginPath();
    for (let x = viewLeft; x <= viewRight; x += 8) {
      const s = samplePath(path, x);
      const sx = x - viewLeft;
      if (x === viewLeft) ctx.moveTo(sx, s.top * h);
      else ctx.lineTo(sx, s.top * h);
    }
    ctx.stroke();
    ctx.beginPath();
    for (let x = viewLeft; x <= viewRight; x += 8) {
      const s = samplePath(path, x);
      const sx = x - viewLeft;
      if (x === viewLeft) ctx.moveTo(sx, s.bot * h);
      else ctx.lineTo(sx, s.bot * h);
    }
    ctx.stroke();
    ctx.shadowBlur = 0;

    // spikes
    ctx.fillStyle = theme;
    for (let x = Math.floor(viewLeft / 22) * 22; x <= viewRight; x += 22) {
      const s = samplePath(path, x);
      if (!s.spike) continue;
      const sx = x - viewLeft;
      const topY = s.top * h;
      const botY = s.bot * h;
      const gap = botY - topY;
      const spikeH = Math.min(gap * 0.42, h * 0.12);
      ctx.beginPath();
      ctx.moveTo(sx - 12, topY);
      ctx.lineTo(sx + 12, topY);
      ctx.lineTo(sx, topY + spikeH);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(sx - 12, botY);
      ctx.lineTo(sx + 12, botY);
      ctx.lineTo(sx, botY - spikeH);
      ctx.closePath();
      ctx.fill();
    }

    // finish line
    if (mode === "classic") {
      const end = pathEnd();
      const fx = end - viewLeft;
      if (fx > -20 && fx < w + 20) {
        ctx.strokeStyle = "#5dff9f";
        ctx.lineWidth = 4;
        ctx.setLineDash([10, 8]);
        ctx.beginPath();
        ctx.moveTo(fx, 0);
        ctx.lineTo(fx, h);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    // trail
    const box = shipHitbox();
    const s = box.scale;
    for (let i = 0; i < trail.length; i++) {
      const t = trail[i];
      const tx = t.x - viewLeft;
      const ty = t.y * h;
      const a = (i + 1) / trail.length;
      ctx.fillStyle = `rgba(92, 225, 255, ${a * 0.4})`;
      ctx.beginPath();
      ctx.arc(tx, ty, (4 + a * 5) * Math.min(1.4, s * 0.55), 0, Math.PI * 2);
      ctx.fill();
    }

    // ship arrow (scaled up)
    const ang = Math.atan2(shipVy * 0.9, 1.6);
    ctx.save();
    ctx.translate(box.x, box.y);
    ctx.rotate(ang);
    ctx.scale(s, s);
    ctx.fillStyle = "#fff";
    ctx.shadowColor = theme;
    ctx.shadowBlur = 18;
    ctx.beginPath();
    ctx.moveTo(18, 0);
    ctx.lineTo(-14, 11);
    ctx.lineTo(-8, 0);
    ctx.lineTo(-14, -11);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = theme;
    ctx.beginPath();
    ctx.moveTo(5, 0);
    ctx.lineTo(-9, 6);
    ctx.lineTo(-5.5, 0);
    ctx.lineTo(-9, -6);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    if (flash > 0) {
      ctx.fillStyle = `rgba(255,80,120,${flash * 0.35})`;
      ctx.fillRect(0, 0, w, h);
    }

    ctx.restore();
  }

  function loop(ts) {
    raf = requestAnimationFrame(loop);
    const dt = Math.min(0.033, (ts - lastTs) / 1000 || 0.016);
    lastTs = ts;
    update(dt);
    draw();
  }

  function setHold(v) {
    holding = !!v;
  }

  function isTypingTarget(el) {
    if (!el) return false;
    const tag = String(el.tagName || "").toUpperCase();
    return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || !!el.isContentEditable;
  }

  function isFlyKey(e) {
    return (
      e.code === "Space" ||
      e.key === " " ||
      e.key === "Spacebar" ||
      e.code === "KeyW" ||
      e.code === "ArrowUp" ||
      e.key === "w" ||
      e.key === "W" ||
      e.key === "ArrowUp"
    );
  }

  function onFlyKeyDown(e) {
    if (!isFlyKey(e)) {
      if (e.code === "KeyP" || e.key === "p" || e.key === "P") {
        if (isTypingTarget(e.target)) return;
        if (running && !dead && !won) {
          e.preventDefault();
          if (paused) {
            hideOverlay();
            lastTs = performance.now();
          } else showOverlay("pause");
        }
      }
      return;
    }
    if (isTypingTarget(e.target)) return;
    e.preventDefault();
    if (typeof e.stopPropagation === "function") e.stopPropagation();
    if (e.repeat) {
      setHold(true);
      return;
    }
    // Mid-run pause: Space resumes and rises
    if (paused && running && !dead && !won) {
      hideOverlay();
      lastTs = performance.now();
      setHold(true);
      return;
    }
    // Menu / crash / win screen: Space starts a run
    if (!running || dead || won) {
      startGame();
      setHold(true);
      return;
    }
    setHold(true);
  }

  function onFlyKeyUp(e) {
    if (!isFlyKey(e)) return;
    if (isTypingTarget(e.target)) return;
    e.preventDefault();
    setHold(false);
  }

  // Capture so Space isn't eaten by focused buttons / page scroll
  window.addEventListener("keydown", onFlyKeyDown, true);
  window.addEventListener("keyup", onFlyKeyUp, true);

  canvas.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    canvas.setPointerCapture?.(e.pointerId);
    if (!running || dead || won) startGame();
    setHold(true);
  });
  canvas.addEventListener("pointerup", () => setHold(false));
  canvas.addEventListener("pointercancel", () => setHold(false));
  canvas.addEventListener("lostpointercapture", () => setHold(false));
  window.addEventListener("blur", () => setHold(false));

  document.querySelectorAll("[data-mode]").forEach((btn) => {
    btn.addEventListener("click", () => {
      mode = btn.dataset.mode || "classic";
      document.querySelectorAll("[data-mode]").forEach((b) => b.classList.toggle("active", b === btn));
      renderLevelPicker();
      paintHud();
    });
  });

  els.start.addEventListener("click", () => {
    if (won && mode === "classic" && levelIndex < LEVELS.length - 1 && els.start.textContent.includes("Next")) {
      levelIndex += 1;
    }
    startGame();
  });
  els.retry.addEventListener("click", () => startGame());
  els.resume.addEventListener("click", () => {
    if (!running && !dead && !won) startGame();
    else {
      hideOverlay();
      lastTs = performance.now();
      if (!running && !dead && !won) running = true;
      // if paused mid-run
      if (!dead && !won) running = true;
    }
  });
  els.menu.addEventListener("click", () => {
    if (running && !dead && !won) showOverlay("pause");
    else showOverlay("menu");
  });
  els.games.addEventListener("click", () => {
    window.location.href = "../index.html#games";
  });

  window.addEventListener("resize", resize);

  // boot
  resize();
  renderLevelPicker();
  paintHud();
  showOverlay("menu");
  raf = requestAnimationFrame(loop);
})();
