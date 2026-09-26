(function () {
  const HIGH_KEY = "paper-io-best-pct";
  const WORLD = 220;
  const SPEED = 24;
  const TURN_RATE = 4.2; // rad/s — smooth steering, not instant snap
  const PLAYER_R = 1.55;
  const TRAIL_W = 1.2;
  const START_R = 6.5;
  const TRAIL_STEP = 0.5;
  const TRAIL_IMMUNE_DIST = 18; // can't hit your own recent trail (paper.io)
  const MIN_TRAIL_FOR_SUICIDE = 22;
  const SPAWN_GRACE_MS = 2500;
  const MAX_TRAIL = 500;
  const MAX_PLAYERS = 8;
  const NET_POLL_MS = 120;
  const DOC_PREFIX = "paper-io-room-";
  const LOBBY_DOC = "paper-io-lobbies";
  const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

  const COLORS = [
    { fill: "#3ec6ff", soft: "rgba(62,198,255,0.58)", name: "Cyan" },
    { fill: "#ff6b5a", soft: "rgba(255,107,90,0.58)", name: "Coral" },
    { fill: "#7dff9a", soft: "rgba(125,255,154,0.58)", name: "Mint" },
    { fill: "#ffd166", soft: "rgba(255,209,102,0.58)", name: "Gold" },
    { fill: "#c792ff", soft: "rgba(199,146,255,0.58)", name: "Violet" },
    { fill: "#ff9ecd", soft: "rgba(255,158,205,0.58)", name: "Pink" },
    { fill: "#5eead4", soft: "rgba(94,234,212,0.58)", name: "Teal" },
    { fill: "#fda4af", soft: "rgba(253,164,175,0.58)", name: "Rose" }
  ];

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d", { alpha: false });
  const landLayer = document.createElement("canvas");
  const landCtx = landLayer.getContext("2d");
  let landDirty = true;

  const scoreEl = document.getElementById("score");
  const highEl = document.getElementById("high-score");
  const hudMode = document.getElementById("hud-mode");
  const liveBoard = document.getElementById("leaderboard");
  const overlay = document.getElementById("overlay");
  const overlayTitle = document.getElementById("overlay-title");
  const overlayText = document.getElementById("overlay-text");
  const overlayBest = document.getElementById("overlay-best");
  const startBtn = document.getElementById("start-btn");
  const resumeBtn = document.getElementById("resume-btn");
  const gamesBtn = document.getElementById("games-btn");
  const menuBtn = document.getElementById("menu-btn");
  const modePicker = document.getElementById("mode-picker");
  const npcPanel = document.getElementById("npc-panel");
  const onlinePanel = document.getElementById("online-panel");
  const onlineStatus = document.getElementById("online-status");
  const onlineCode = document.getElementById("online-code");
  const onlineQuickBtn = document.getElementById("online-quick-btn");
  const onlineCreateBtn = document.getElementById("online-create-btn");
  const onlineJoinBtn = document.getElementById("online-join-btn");
  const onlineJoinInput = document.getElementById("online-join-input");
  const onlineCancelBtn = document.getElementById("online-cancel-btn");

  let bestPct = Math.max(0, Math.floor(Number(localStorage.getItem(HIGH_KEY)) || 0));
  let mode = "npc";
  let botCount = 4;
  let running = false;
  let paused = false;
  let sessionStarted = false;
  let lastSubmitAt = 0;
  let animId = 0;
  let lastFrame = 0;

  /** Ownership bitmap — same resolution as world for simple mapping */
  /** @type {Int16Array} */
  let grid = new Int16Array(WORLD * WORLD);
  /** @type {any[]} */
  let players = [];
  let localId = "";
  let nextBotId = 1;

  const keys = { up: false, down: false, left: false, right: false };
  let pointerAim = false;
  let aimX = WORLD / 2;
  let aimY = WORLD / 2;
  let pendingAngle = 0;

  let roomCode = "";
  let isHost = false;
  let netPollTimer = 0;
  let netBusy = false;
  let lobbyAwaiting = false;
  let lobbyWatch = 0;

  let deathNote = "";
  let deathUntil = 0;

  const idMap = new Map();
  let idSeq = 1;

  function idx(x, y) {
    return y * WORLD + x;
  }

  function clamp(v, a, b) {
    return Math.max(a, Math.min(b, v));
  }

  function cellAt(x, y) {
    const cx = clamp(x | 0, 0, WORLD - 1);
    const cy = clamp(y | 0, 0, WORLD - 1);
    return grid[idx(cx, cy)];
  }

  function idHash(id) {
    if (idMap.has(id)) return idMap.get(id);
    const n = idSeq++;
    idMap.set(id, n);
    return n;
  }

  function idFromHash(n) {
    for (const [k, v] of idMap) if (v === n) return k;
    return "";
  }

  function playerName() {
    if (typeof HubPlays === "undefined") return "You";
    const name = HubPlays.sanitizeName
      ? HubPlays.sanitizeName(HubPlays.getName() || "")
      : String(HubPlays.getName() || "").trim();
    if (!name || /^guest-/i.test(name) || name.toLowerCase() === "player") return "You";
    return name.slice(0, 16);
  }

  function playerId() {
    return typeof HubPlays !== "undefined" && HubPlays.getPlayerId
      ? HubPlays.getPlayerId()
      : `local-${Math.random().toString(36).slice(2, 8)}`;
  }

  function makeCode() {
    let code = "";
    for (let i = 0; i < 4; i++) code += CODE_CHARS[(Math.random() * CODE_CHARS.length) | 0];
    return code;
  }

  function updateBestHud() {
    if (highEl) highEl.textContent = `${bestPct}%`;
    if (overlayBest) overlayBest.innerHTML = `Best claim: <strong>${bestPct}%</strong>`;
  }

  function ensureSession() {
    if (sessionStarted) return;
    sessionStarted = true;
    window.HubPlays?.record?.("paper");
    window.HubStreak?.recordPlay?.();
  }

  function maybeSubmit(pct) {
    if (pct > bestPct) {
      bestPct = Math.floor(pct);
      try {
        localStorage.setItem(HIGH_KEY, String(bestPct));
      } catch {}
      updateBestHud();
    }
    if (bestPct <= 0 || !window.HubLeaderboard) return;
    const now = Date.now();
    if (now - lastSubmitAt < 5000) return;
    lastSubmitAt = now;
    HubLeaderboard.submit("paper", bestPct).catch?.(() => {});
  }

  function checkAchievements(pct) {
    if (!window.HubAchievements) return;
    if (pct >= 5) HubAchievements.unlock("paper_claim_5");
    if (pct >= 15) HubAchievements.unlock("paper_claim_15");
    if (pct >= 30) HubAchievements.unlock("paper_claim_30");
  }

  function markLandDirty() {
    landDirty = true;
  }

  function clearGrid() {
    grid.fill(0);
    markLandDirty();
  }

  function paintDisk(hid, cx, cy, r) {
    const r2 = r * r;
    const x0 = Math.max(0, Math.floor(cx - r));
    const x1 = Math.min(WORLD - 1, Math.ceil(cx + r));
    const y0 = Math.max(0, Math.floor(cy - r));
    const y1 = Math.min(WORLD - 1, Math.ceil(cy + r));
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const dx = x + 0.5 - cx;
        const dy = y + 0.5 - cy;
        if (dx * dx + dy * dy <= r2) grid[idx(x, y)] = hid;
      }
    }
    markLandDirty();
  }

  function paintStroke(hid, x0, y0, x1, y1, half) {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const len = Math.hypot(dx, dy) || 1;
    const steps = Math.ceil(len / 0.45);
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      paintDisk(hid, x0 + dx * t, y0 + dy * t, half);
    }
  }

  function findSpawn(avoid) {
    const margin = START_R + 18;
    for (let tries = 0; tries < 90; tries++) {
      const x = margin + Math.random() * (WORLD - margin * 2);
      const y = margin + Math.random() * (WORLD - margin * 2);
      let ok = true;
      for (const p of avoid) {
        if (Math.hypot(p.x - x, p.y - y) < 22) {
          ok = false;
          break;
        }
      }
      if (ok) return { x, y };
    }
    return { x: WORLD / 2, y: WORLD / 2 };
  }

  function makePlayer(id, name, color, human) {
    const spot = findSpawn(players);
    const ang = Math.random() * Math.PI * 2;
    const p = {
      id,
      name,
      color,
      x: spot.x,
      y: spot.y,
      angle: ang,
      wantAngle: ang,
      alive: true,
      human,
      trail: /** @type {{x:number,y:number}[]} */ ([]),
      distAcc: 0,
      outside: false,
      respawnAt: 0,
      spawnAt: performance.now(),
      botThink: 0,
      botAngle: ang
    };
    paintDisk(idHash(id), spot.x, spot.y, START_R);
    return p;
  }

  function resetArena(humans, bots) {
    clearGrid();
    idMap.clear();
    idSeq = 1;
    players = [];
    nextBotId = 1;
    for (let i = 0; i < humans.length; i++) {
      const h = humans[i];
      players.push(makePlayer(h.id, h.name, i % COLORS.length, true));
    }
    for (let i = 0; i < bots; i++) {
      const color = (humans.length + i) % COLORS.length;
      players.push(makePlayer(`bot-${nextBotId++}`, `NPC ${i + 1}`, color, false));
    }
  }

  function localPlayer() {
    return players.find((p) => p.id === localId) || players.find((p) => p.human) || null;
  }

  function territoryCount(hash) {
    let n = 0;
    for (let i = 0; i < grid.length; i++) if (grid[i] === hash) n++;
    return n;
  }

  function pctFor(p) {
    if (!p) return 0;
    return Math.round((1000 * territoryCount(idHash(p.id))) / grid.length) / 10;
  }

  function isOwnLand(p, x, y) {
    return cellAt(x, y) === idHash(p.id);
  }

  function showDeathFlash(reason) {
    deathNote = reason || "KO";
    deathUntil = performance.now() + 1400;
  }

  function clearPlayerCells(p) {
    const hid = idHash(p.id);
    for (let i = 0; i < grid.length; i++) if (grid[i] === hid) grid[i] = 0;
    p.trail = [];
    markLandDirty();
  }

  function kill(p, reason) {
    if (!p.alive) return;
    p.alive = false;
    p.trail = [];
    p.outside = false;
    clearPlayerCells(p);
    p.respawnAt = performance.now() + (p.human ? 1800 : 2400);
    if (p.id === localId) {
      window.HubSound?.play?.("hit");
      showDeathFlash(reason);
    }
  }

  function capture(p) {
    const hid = idHash(p.id);
    if (p.trail.length) {
      let px = p.trail[0].x;
      let py = p.trail[0].y;
      for (let i = 1; i < p.trail.length; i++) {
        paintStroke(hid, px, py, p.trail[i].x, p.trail[i].y, TRAIL_W * 0.85);
        px = p.trail[i].x;
        py = p.trail[i].y;
      }
      paintStroke(hid, px, py, p.x, p.y, TRAIL_W * 0.85);
    }
    p.trail = [];
    p.outside = false;

    const visited = new Uint8Array(WORLD * WORLD);
    const qx = new Int16Array(WORLD * WORLD);
    const qy = new Int16Array(WORLD * WORLD);
    let qh = 0;
    let qt = 0;
    function push(x, y) {
      if (x < 0 || y < 0 || x >= WORLD || y >= WORLD) return;
      const i = idx(x, y);
      if (visited[i] || grid[i] === hid) return;
      visited[i] = 1;
      qx[qt] = x;
      qy[qt] = y;
      qt++;
    }
    for (let x = 0; x < WORLD; x++) {
      push(x, 0);
      push(x, WORLD - 1);
    }
    for (let y = 0; y < WORLD; y++) {
      push(0, y);
      push(WORLD - 1, y);
    }
    while (qh < qt) {
      const x = qx[qh];
      const y = qy[qh++];
      push(x + 1, y);
      push(x - 1, y);
      push(x, y + 1);
      push(x, y - 1);
    }
    for (let i = 0; i < grid.length; i++) {
      if (!visited[i] && grid[i] !== hid) grid[i] = hid;
    }
    markLandDirty();
  }

  function distToSeg(px, py, ax, ay, bx, by) {
    const abx = bx - ax;
    const aby = by - ay;
    const apx = px - ax;
    const apy = py - ay;
    const ab2 = abx * abx + aby * aby || 1;
    let t = (apx * abx + apy * aby) / ab2;
    t = clamp(t, 0, 1);
    const cx = ax + abx * t;
    const cy = ay + aby * t;
    return Math.hypot(px - cx, py - cy);
  }

  function trailHit(p, ox, oy, ignoreRecent) {
    const hitR = PLAYER_R * 0.85 + TRAIL_W * 0.35;
    const trail = p.trail;
    if (trail.length < 3) return false;

    let start = 1;
    if (ignoreRecent) {
      let dist = 0;
      let cut = trail.length;
      for (let i = trail.length - 1; i > 0; i--) {
        dist += Math.hypot(trail[i].x - trail[i - 1].x, trail[i].y - trail[i - 1].y);
        if (dist >= TRAIL_IMMUNE_DIST) {
          cut = i;
          break;
        }
        cut = i;
      }
      // Also skip if overall trail is still short
      let total = 0;
      for (let i = 1; i < trail.length; i++) {
        total += Math.hypot(trail[i].x - trail[i - 1].x, trail[i].y - trail[i - 1].y);
      }
      if (total < MIN_TRAIL_FOR_SUICIDE) return false;
      // only test segments before the immune tail
      for (let i = 1; i < cut; i++) {
        const a = trail[i - 1];
        const b = trail[i];
        if (distToSeg(ox, oy, a.x, a.y, b.x, b.y) <= hitR) return true;
      }
      return false;
    }

    for (let i = start; i < trail.length; i++) {
      const a = trail[i - 1];
      const b = trail[i];
      if (distToSeg(ox, oy, a.x, a.y, b.x, b.y) <= hitR) return true;
    }
    return false;
  }

  function respawn(p) {
    const spot = findSpawn(players.filter((o) => o.alive && o !== p));
    p.x = spot.x;
    p.y = spot.y;
    p.alive = true;
    p.trail = [];
    p.outside = false;
    p.distAcc = 0;
    p.angle = Math.random() * Math.PI * 2;
    p.wantAngle = p.angle;
    p.spawnAt = performance.now();
    paintDisk(idHash(p.id), spot.x, spot.y, START_R);
  }

  function steerFromKeys() {
    let dx = 0;
    let dy = 0;
    if (keys.left) dx -= 1;
    if (keys.right) dx += 1;
    if (keys.up) dy -= 1;
    if (keys.down) dy += 1;
    if (!dx && !dy) return null;
    const len = Math.hypot(dx, dy) || 1;
    return Math.atan2(dy / len, dx / len);
  }

  function shortestAngleDiff(from, to) {
    let d = to - from;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return d;
  }

  function applyTurn(p, dt) {
    const diff = shortestAngleDiff(p.angle, p.wantAngle);
    const maxStep = TURN_RATE * dt;
    if (Math.abs(diff) <= maxStep) p.angle = p.wantAngle;
    else p.angle += Math.sign(diff) * maxStep;
  }

  function setLocalSteer(p) {
    if (p.id !== localId) return;
    const keyAng = steerFromKeys();
    if (keyAng != null) {
      p.wantAngle = keyAng;
      pointerAim = false;
    } else if (pointerAim) {
      p.wantAngle = Math.atan2(aimY - p.y, aimX - p.x);
    }
    pendingAngle = p.wantAngle;
  }

  function botDecide(p, now) {
    if (now < p.botThink) {
      p.wantAngle = p.botAngle;
      return;
    }
    p.botThink = now + 220 + Math.random() * 480;

    // Hunt nearby enemy trails
    for (const other of players) {
      if (other === p || !other.alive || other.trail.length < 3) continue;
      const tip = other.trail[other.trail.length - 1];
      if (Math.hypot(tip.x - p.x, tip.y - p.y) < 28) {
        p.botAngle = Math.atan2(tip.y - p.y, tip.x - p.x);
        p.wantAngle = p.botAngle;
        return;
      }
    }

    const home = isOwnLand(p, p.x, p.y);
    if (home) {
      // Venture out in a sweeping curve
      p.botAngle += (Math.random() - 0.5) * 0.9;
    } else {
      // Seek nearest own land
      let best = null;
      let bestD = 1e9;
      const hid = idHash(p.id);
      for (let y = 2; y < WORLD; y += 4) {
        for (let x = 2; x < WORLD; x += 4) {
          if (grid[idx(x, y)] !== hid) continue;
          const d = Math.hypot(x - p.x, y - p.y);
          if (d < bestD) {
            bestD = d;
            best = { x, y };
          }
        }
      }
      if (best) p.botAngle = Math.atan2(best.y - p.y, best.x - p.x);
      else p.botAngle += (Math.random() - 0.5) * 0.8;
    }

    // Soft edge avoidance (still die if you actually hit)
    const margin = 14;
    if (p.x < margin) p.botAngle = 0;
    if (p.x > WORLD - margin) p.botAngle = Math.PI;
    if (p.y < margin) p.botAngle = Math.PI / 2;
    if (p.y > WORLD - margin) p.botAngle = -Math.PI / 2;

    p.wantAngle = p.botAngle;
  }

  function inSpawnGrace(p) {
    return performance.now() - (p.spawnAt || 0) < SPAWN_GRACE_MS;
  }

  function stepPlayer(p, dt) {
    if (!p.alive) return;

    if (p.human) {
      if (mode === "online" && p.id !== localId) {
        // angle set from net inputs → wantAngle
      } else {
        setLocalSteer(p);
      }
      applyTurn(p, dt);
    } else {
      botDecide(p, performance.now());
      applyTurn(p, dt);
    }

    const nx = p.x + Math.cos(p.angle) * SPEED * dt;
    const ny = p.y + Math.sin(p.angle) * SPEED * dt;
    const grace = inSpawnGrace(p);

    // Soft bounce near edges during grace; hard KO after
    const edge = PLAYER_R + 0.4;
    if (nx < edge || ny < edge || nx > WORLD - edge || ny > WORLD - edge) {
      if (grace) {
        // Push inward and turn away
        p.x = clamp(p.x, edge + 1, WORLD - edge - 1);
        p.y = clamp(p.y, edge + 1, WORLD - edge - 1);
        p.wantAngle = Math.atan2(WORLD / 2 - p.y, WORLD / 2 - p.x);
        return;
      }
      kill(p, "Hit the edge");
      return;
    }

    // Own trail suicide (long immunity on the tip)
    if (!grace && p.outside && trailHit(p, nx, ny, true)) {
      kill(p, "Hit your trail");
      return;
    }

    // Cut enemy trails
    if (!grace) {
      for (const other of players) {
        if (other === p || !other.alive || !other.outside) continue;
        if (inSpawnGrace(other)) continue;
        if (trailHit(other, nx, ny, false)) {
          kill(other, `${p.name} cut their trail`);
          if (p.id === localId) window.HubSound?.play?.("score");
        }
      }
    }

    const wasHome = isOwnLand(p, p.x, p.y);
    const nowHome = isOwnLand(p, nx, ny);

    const ox = p.x;
    const oy = p.y;
    p.x = nx;
    p.y = ny;

    // Only leave a trail once you actually leave your land
    if (wasHome && !nowHome) {
      p.outside = true;
      p.trail = [{ x: ox, y: oy }, { x: nx, y: ny }];
      p.distAcc = 0;
    } else if (p.outside && !nowHome) {
      p.distAcc += Math.hypot(nx - ox, ny - oy);
      while (p.distAcc >= TRAIL_STEP) {
        p.distAcc -= TRAIL_STEP;
        p.trail.push({ x: p.x, y: p.y });
        if (p.trail.length > MAX_TRAIL) p.trail.shift();
      }
    } else if (p.outside && nowHome && p.trail.length >= 2) {
      capture(p);
      if (p.id === localId) {
        window.HubSound?.play?.("score");
        const pct = pctFor(p);
        maybeSubmit(pct);
        checkAchievements(pct);
        if (pct >= 20) window.HubConfetti?.burst?.();
      }
    } else if (wasHome && nowHome) {
      p.outside = false;
      p.trail = [];
    }
  }

  function tick(dt) {
    const now = performance.now();
    for (const p of players) {
      if (!p.alive) {
        if (p.respawnAt && now >= p.respawnAt) {
          p.respawnAt = 0;
          respawn(p);
        }
        continue;
      }
      stepPlayer(p, dt);
    }

    // Body bump while both exposed
    for (let i = 0; i < players.length; i++) {
      const a = players[i];
      if (!a.alive) continue;
      for (let j = i + 1; j < players.length; j++) {
        const b = players[j];
        if (!b.alive) continue;
        if (Math.hypot(a.x - b.x, a.y - b.y) < PLAYER_R * 1.7) {
          if (a.outside && b.outside && !inSpawnGrace(a) && !inSpawnGrace(b)) {
            kill(a, "Head-on");
            kill(b, "Head-on");
          }
        }
      }
    }
  }

  function worldToScreen(x, y) {
    return {
      x: (x / WORLD) * canvas.width,
      y: (y / WORLD) * canvas.height
    };
  }

  function screenToWorld(sx, sy) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((sx - rect.left) / rect.width) * WORLD,
      y: ((sy - rect.top) / rect.height) * WORLD
    };
  }

  function paintLandLayer() {
    const w = canvas.width;
    const h = canvas.height;
    if (landLayer.width !== w || landLayer.height !== h) {
      landLayer.width = w;
      landLayer.height = h;
      landDirty = true;
    }
    if (!landDirty) return;
    landDirty = false;
    landCtx.clearRect(0, 0, w, h);
    const sx = w / WORLD;
    const sy = h / WORLD;
    for (let y = 0; y < WORLD; y++) {
      for (let x = 0; x < WORLD; x++) {
        const owner = grid[idx(x, y)];
        if (!owner) continue;
        const pid = idFromHash(owner);
        const pl = players.find((p) => p.id === pid);
        const color = COLORS[(pl ? pl.color : owner - 1) % COLORS.length];
        landCtx.fillStyle = color.soft;
        landCtx.beginPath();
        landCtx.arc((x + 0.5) * sx, (y + 0.5) * sy, Math.max(sx, sy) * 0.82, 0, Math.PI * 2);
        landCtx.fill();
      }
    }
  }

  function draw() {
    const w = canvas.width;
    const h = canvas.height;
    const scale = w / WORLD;

    const bg = ctx.createRadialGradient(w * 0.5, h * 0.45, w * 0.08, w * 0.5, h * 0.5, w * 0.75);
    bg.addColorStop(0, "#102338");
    bg.addColorStop(1, "#060d16");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    // Edge danger band
    ctx.strokeStyle = "rgba(255,107,90,0.35)";
    ctx.lineWidth = Math.max(2, scale * 1.2);
    ctx.strokeRect(scale * 0.8, scale * 0.8, w - scale * 1.6, h - scale * 1.6);

    paintLandLayer();
    ctx.save();
    if (typeof ctx.filter === "string") {
      ctx.filter = "blur(2px)";
      ctx.drawImage(landLayer, 0, 0);
      ctx.filter = "none";
      ctx.globalAlpha = 0.5;
      ctx.drawImage(landLayer, 0, 0);
      ctx.globalAlpha = 1;
    } else {
      ctx.drawImage(landLayer, 0, 0);
    }
    ctx.restore();

    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (const p of players) {
      if (!p.alive || p.trail.length < 1) continue;
      const c = COLORS[p.color % COLORS.length];
      ctx.strokeStyle = c.fill;
      ctx.globalAlpha = 0.92;
      ctx.lineWidth = Math.max(3, TRAIL_W * scale * 1.15);
      ctx.shadowColor = c.fill;
      ctx.shadowBlur = scale * 1.4;
      ctx.beginPath();
      const s0 = worldToScreen(p.trail[0].x, p.trail[0].y);
      ctx.moveTo(s0.x, s0.y);
      for (let i = 1; i < p.trail.length; i++) {
        const s = worldToScreen(p.trail[i].x, p.trail[i].y);
        ctx.lineTo(s.x, s.y);
      }
      const tip = worldToScreen(p.x, p.y);
      ctx.lineTo(tip.x, tip.y);
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
    }

    for (const p of players) {
      if (!p.alive) continue;
      const c = COLORS[p.color % COLORS.length];
      const s = worldToScreen(p.x, p.y);
      const r = PLAYER_R * scale * 1.15;

      ctx.shadowColor = c.fill;
      ctx.shadowBlur = r * 1.8;
      ctx.fillStyle = c.fill;
      ctx.beginPath();
      ctx.arc(s.x, s.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      ctx.fillStyle = "rgba(255,255,255,0.35)";
      ctx.beginPath();
      ctx.arc(s.x - r * 0.28, s.y - r * 0.28, r * 0.32, 0, Math.PI * 2);
      ctx.fill();

      // nose showing direction
      ctx.strokeStyle = "rgba(255,255,255,0.7)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(s.x + Math.cos(p.angle) * r * 1.35, s.y + Math.sin(p.angle) * r * 1.35);
      ctx.stroke();

      if (p.id === localId) {
        ctx.strokeStyle = "rgba(255,255,255,0.95)";
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(s.x, s.y, r + 2, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.fillStyle = "rgba(6,12,20,0.72)";
      ctx.font = `bold ${Math.max(11, scale * 1.7)}px Outfit,sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      ctx.fillText(p.name.slice(0, 10), s.x, s.y - r - 4);
    }

    if (performance.now() < deathUntil) {
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      ctx.fillRect(0, h * 0.42, w, h * 0.16);
      ctx.fillStyle = "#ffb4ab";
      ctx.font = "bold 28px Outfit,sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(deathNote, w / 2, h * 0.5);
    }
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function updateHud() {
    const me = localPlayer();
    const pct = me ? pctFor(me) : 0;
    if (scoreEl) scoreEl.textContent = `${pct}%`;
    maybeSubmit(pct);
    if (liveBoard) {
      const ranked = players
        .map((p) => ({ p, pct: pctFor(p) }))
        .sort((a, b) => b.pct - a.pct)
        .slice(0, 6);
      liveBoard.innerHTML = ranked
        .map(({ p, pct: v }) => {
          const c = COLORS[p.color % COLORS.length].fill;
          const mark = p.id === localId ? "★ " : "";
          const dead = p.alive ? "" : " (out)";
          return `<span class="lb-item"><span class="swatch" style="background:${c}"></span>${mark}${escapeHtml(
            p.name
          )} ${v}%${dead}</span>`;
        })
        .join("");
    }
  }

  function loop(ts) {
    if (!running) return;
    animId = requestAnimationFrame(loop);
    if (paused) {
      draw();
      return;
    }
    if (!lastFrame) lastFrame = ts;
    let dt = (ts - lastFrame) / 1000;
    lastFrame = ts;
    if (dt > 0.05) dt = 0.05;
    if (mode !== "online" || isHost) tick(dt);
    draw();
    updateHud();
  }

  function startNpc(opts) {
    ensureSession();
    localId = opts.localId || playerId();
    const humans = opts.humans || [{ id: localId, name: playerName() }];
    const bots = opts.bots ?? botCount;
    pointerAim = false;
    keys.up = keys.down = keys.left = keys.right = false;
    resetArena(humans, bots);
    running = true;
    paused = false;
    lastFrame = 0;
    overlay.classList.add("hidden");
    resumeBtn.classList.add("hidden");
    if (hudMode) {
      hudMode.textContent =
        mode === "online" ? (isHost ? `Online host · ${roomCode}` : `Online · ${roomCode}`) : `vs ${bots} NPC`;
    }
    cancelAnimationFrame(animId);
    animId = requestAnimationFrame(loop);
    window.HubSound?.play?.("start");
  }

  function openMenu(fromPause) {
    if (running && !fromPause) {
      paused = true;
      resumeBtn.classList.remove("hidden");
      overlayTitle.textContent = "Paused";
      overlayText.textContent = "Resume, or start a fresh arena.";
    } else if (!running) {
      resumeBtn.classList.add("hidden");
      overlayTitle.textContent = "Paper Claim";
      overlayText.textContent =
        "Free-move like paper.io — diagonals, mouse aim, claim loops. Touching the map edge KO's you.";
    }
    overlay.classList.remove("hidden");
  }

  function setMode(next) {
    mode = next;
    modePicker.querySelectorAll(".pick-btn").forEach((b) => {
      b.classList.toggle("active", b.dataset.mode === mode);
    });
    npcPanel.classList.toggle("hidden", mode !== "npc");
    onlinePanel.classList.toggle("hidden", mode !== "online");
  }

  // —— Networking ——
  async function sbGet(id) {
    if (!window.HubSupabase?.getDoc) return null;
    try {
      return await HubSupabase.getDoc(id);
    } catch {
      return null;
    }
  }

  async function sbPut(id, data) {
    if (!window.HubSupabase?.upsertDoc) throw new Error("no supabase");
    await HubSupabase.upsertDoc(id, data);
  }

  function encodeGrid() {
    const parts = [];
    let i = 0;
    while (i < grid.length) {
      const v = grid[i];
      let n = 1;
      while (i + n < grid.length && grid[i + n] === v && n < 9999) n++;
      parts.push(`${v}:${n}`);
      i += n;
    }
    return parts.join(",");
  }

  function decodeGrid(rle) {
    if (!rle) return;
    const out = new Int16Array(WORLD * WORLD);
    let i = 0;
    for (const part of String(rle).split(",")) {
      const [vs, ns] = part.split(":");
      const v = Number(vs) || 0;
      const n = Number(ns) || 0;
      for (let k = 0; k < n && i < out.length; k++) out[i++] = v;
    }
    grid = out;
    markLandDirty();
  }

  function snapshotPlayers() {
    return players.map((p) => ({
      id: p.id,
      name: p.name,
      color: p.color,
      x: +p.x.toFixed(2),
      y: +p.y.toFixed(2),
      angle: +p.angle.toFixed(3),
      alive: p.alive,
      human: p.human,
      outside: p.outside,
      trail: p.trail.slice(-160).map((t) => [+t.x.toFixed(2), +t.y.toFixed(2)]),
      respawnAt: p.respawnAt ? Date.now() + (p.respawnAt - performance.now()) : 0
    }));
  }

  function applySnapshot(snap) {
    if (!snap) return;
    if (snap.grid) decodeGrid(snap.grid);
    if (snap.idMap) {
      idMap.clear();
      for (const [k, v] of Object.entries(snap.idMap)) {
        idMap.set(k, Number(v));
        idSeq = Math.max(idSeq, Number(v) + 1);
      }
    }
    if (Array.isArray(snap.players)) {
      players = snap.players.map((raw) => ({
        id: raw.id,
        name: raw.name,
        color: raw.color | 0,
        x: Number(raw.x) || 0,
        y: Number(raw.y) || 0,
        angle: Number(raw.angle) || 0,
        wantAngle: Number(raw.angle) || 0,
        alive: !!raw.alive,
        human: !!raw.human,
        outside: !!raw.outside,
        trail: Array.isArray(raw.trail)
          ? raw.trail.map((t) => (Array.isArray(t) ? { x: t[0], y: t[1] } : t))
          : [],
        distAcc: 0,
        respawnAt: raw.respawnAt ? performance.now() + Math.max(0, raw.respawnAt - Date.now()) : 0,
        botThink: 0,
        botAngle: Number(raw.angle) || 0
      }));
    }
  }

  function roomDocId(code) {
    return DOC_PREFIX + String(code || "").toUpperCase();
  }

  async function pushHostState() {
    if (!isHost || !roomCode) return;
    const idMapObj = {};
    for (const [k, v] of idMap) idMapObj[k] = v;
    const doc = await sbGet(roomDocId(roomCode));
    if (!doc) return;
    const inputs = doc.inputs || {};
    for (const p of players) {
      if (!p.human || p.id === localId) continue;
      const ang = inputs[p.id];
      if (typeof ang === "number" && Number.isFinite(ang)) {
        p.wantAngle = ang;
      }
    }
    await sbPut(roomDocId(roomCode), {
      ...doc,
      updatedAt: Date.now(),
      status: "playing",
      hostId: localId,
      snap: {
        grid: encodeGrid(),
        idMap: idMapObj,
        players: snapshotPlayers(),
        t: Date.now()
      },
      inputs: { ...(doc.inputs || {}), [localId]: pendingAngle }
    });
  }

  async function pushGuestInput() {
    if (isHost || !roomCode) return;
    const doc = await sbGet(roomDocId(roomCode));
    if (!doc) return;
    await sbPut(roomDocId(roomCode), {
      ...doc,
      updatedAt: Date.now(),
      inputs: { ...(doc.inputs || {}), [localId]: pendingAngle }
    });
    if (doc.snap) applySnapshot(doc.snap);
  }

  async function netTick() {
    if (mode !== "online" || !roomCode || !running || netBusy) return;
    netBusy = true;
    try {
      if (isHost) await pushHostState();
      else await pushGuestInput();
    } catch (err) {
      console.warn("[paper-io] net", err);
    } finally {
      netBusy = false;
    }
  }

  function stopNet() {
    clearInterval(netPollTimer);
    netPollTimer = 0;
  }

  function startNet() {
    stopNet();
    netPollTimer = setInterval(() => netTick(), NET_POLL_MS);
  }

  async function createOnlineRoom() {
    const me = playerId();
    const name = playerName();
    if (!name || name === "You") {
      onlineStatus.textContent = "Set a nickname on the hub first.";
      return;
    }
    localId = me;
    roomCode = makeCode();
    isHost = true;
    lobbyAwaiting = true;
    await sbPut(roomDocId(roomCode), {
      code: roomCode,
      hostId: me,
      status: "waiting",
      createdAt: Date.now(),
      updatedAt: Date.now(),
      seats: { [me]: { name, color: 0, joinedAt: Date.now() } },
      inputs: {},
      snap: null
    });
    try {
      const lobbies = (await sbGet(LOBBY_DOC)) || { rooms: {} };
      lobbies.rooms = lobbies.rooms || {};
      lobbies.rooms[roomCode] = { code: roomCode, hostId: me, status: "waiting", updatedAt: Date.now() };
      const now = Date.now();
      for (const [k, r] of Object.entries(lobbies.rooms)) {
        if (!r || now - (r.updatedAt || 0) > 10 * 60 * 1000) delete lobbies.rooms[k];
      }
      await sbPut(LOBBY_DOC, lobbies);
    } catch {}
    onlineCode.classList.remove("hidden");
    onlineCode.textContent = `Room ${roomCode} — waiting for players…`;
    onlineCancelBtn.classList.remove("hidden");
    onlineStatus.textContent = "Share the code. Press Play when ready (bots fill empty slots).";
    startBtn.textContent = "Start match";
  }

  async function joinOnlineRoom(code) {
    const want = String(code || "")
      .trim()
      .toUpperCase();
    if (!want) {
      onlineStatus.textContent = "Enter a room code.";
      return;
    }
    const me = playerId();
    const name = playerName();
    if (!name || name === "You") {
      onlineStatus.textContent = "Set a nickname on the hub first.";
      return;
    }
    const doc = await sbGet(roomDocId(want));
    if (!doc || (doc.status !== "waiting" && doc.status !== "playing")) {
      onlineStatus.textContent = "Room not found.";
      return;
    }
    const seats = { ...(doc.seats || {}) };
    const seatCount = Object.keys(seats).length;
    if (!seats[me] && seatCount >= MAX_PLAYERS) {
      onlineStatus.textContent = "Room is full.";
      return;
    }
    seats[me] = { name, color: seatCount % COLORS.length, joinedAt: Date.now() };
    await sbPut(roomDocId(want), { ...doc, seats, updatedAt: Date.now() });
    roomCode = want;
    localId = me;
    isHost = doc.hostId === me;
    lobbyAwaiting = doc.status === "waiting";
    onlineCode.classList.remove("hidden");
    onlineCode.textContent = isHost ? `Room ${roomCode}` : `Joined ${roomCode}`;
    onlineCancelBtn.classList.remove("hidden");
    onlineStatus.textContent = isHost ? "You are host. Press Play to start." : "Waiting for host to start…";
    startBtn.textContent = isHost ? "Start match" : "Waiting…";
    if (!isHost) watchLobbyStart();
  }

  function watchLobbyStart() {
    clearInterval(lobbyWatch);
    lobbyWatch = setInterval(async () => {
      if (!roomCode || isHost) return;
      const doc = await sbGet(roomDocId(roomCode));
      if (!doc) return;
      if (doc.status === "playing" && doc.snap) {
        clearInterval(lobbyWatch);
        lobbyAwaiting = false;
        applySnapshot(doc.snap);
        running = true;
        paused = false;
        lastFrame = 0;
        overlay.classList.add("hidden");
        if (hudMode) hudMode.textContent = `Online · ${roomCode}`;
        cancelAnimationFrame(animId);
        animId = requestAnimationFrame(loop);
        startNet();
        window.HubSound?.play?.("start");
      }
    }, 500);
  }

  async function quickPlay() {
    onlineStatus.textContent = "Searching…";
    try {
      const lobbies = (await sbGet(LOBBY_DOC)) || { rooms: {} };
      const now = Date.now();
      const open = Object.values(lobbies.rooms || {}).filter(
        (r) => r && r.status === "waiting" && now - (r.updatedAt || 0) < 3 * 60 * 1000
      );
      if (open.length) {
        await joinOnlineRoom(open[0].code);
        return;
      }
    } catch {}
    await createOnlineRoom();
  }

  async function leaveOnline() {
    stopNet();
    clearInterval(lobbyWatch);
    lobbyAwaiting = false;
    if (roomCode && isHost) {
      try {
        const lobbies = (await sbGet(LOBBY_DOC)) || { rooms: {} };
        if (lobbies.rooms) delete lobbies.rooms[roomCode];
        await sbPut(LOBBY_DOC, lobbies);
        await sbPut(roomDocId(roomCode), { code: roomCode, status: "closed", updatedAt: Date.now() });
      } catch {}
    }
    roomCode = "";
    isHost = false;
    onlineCode.classList.add("hidden");
    onlineCancelBtn.classList.add("hidden");
    onlineStatus.textContent = "Match with others, or host a room code.";
    startBtn.textContent = "Play";
  }

  async function startOnlineMatch() {
    if (!roomCode) {
      onlineStatus.textContent = "Create or join a room first.";
      return;
    }
    const doc = await sbGet(roomDocId(roomCode));
    if (!doc) {
      onlineStatus.textContent = "Room expired.";
      return;
    }
    if (!isHost) {
      onlineStatus.textContent = "Waiting for host…";
      watchLobbyStart();
      return;
    }
    const seats = doc.seats || {};
    const humans = Object.entries(seats).map(([id, s]) => ({
      id,
      name: s.name || "Player"
    }));
    const bots = Math.max(0, Math.min(6, MAX_PLAYERS - humans.length));
    localId = playerId();
    startNpc({ localId, humans, bots });
    for (const p of players) {
      const seat = seats[p.id];
      if (seat && seat.color != null) p.color = seat.color % COLORS.length;
    }
    lobbyAwaiting = false;
    const idMapObj = {};
    for (const [k, v] of idMap) idMapObj[k] = v;
    await sbPut(roomDocId(roomCode), {
      ...doc,
      status: "playing",
      updatedAt: Date.now(),
      hostId: localId,
      snap: {
        grid: encodeGrid(),
        idMap: idMapObj,
        players: snapshotPlayers(),
        t: Date.now()
      },
      inputs: {}
    });
    try {
      const lobbies = (await sbGet(LOBBY_DOC)) || { rooms: {} };
      if (lobbies.rooms?.[roomCode]) {
        lobbies.rooms[roomCode].status = "playing";
        lobbies.rooms[roomCode].updatedAt = Date.now();
        await sbPut(LOBBY_DOC, lobbies);
      }
    } catch {}
    startNet();
  }

  // —— Input ——
  const keyMap = {
    ArrowUp: "up",
    ArrowDown: "down",
    ArrowLeft: "left",
    ArrowRight: "right",
    w: "up",
    W: "up",
    s: "down",
    S: "down",
    a: "left",
    A: "left",
    d: "right",
    D: "right"
  };

  window.addEventListener("keydown", (e) => {
    const k = keyMap[e.key];
    if (!k) return;
    e.preventDefault();
    keys[k] = true;
  });
  window.addEventListener("keyup", (e) => {
    const k = keyMap[e.key];
    if (!k) return;
    keys[k] = false;
  });

  function aimFromEvent(e) {
    if (!running || paused) return;
    const pt = e.touches ? e.touches[0] : e;
    if (!pt) return;
    const w = screenToWorld(pt.clientX, pt.clientY);
    aimX = w.x;
    aimY = w.y;
    pointerAim = true;
  }

  canvas.addEventListener("pointerdown", (e) => {
    if (!running || paused) return;
    canvas.setPointerCapture?.(e.pointerId);
    aimFromEvent(e);
  });
  canvas.addEventListener("pointermove", (e) => {
    if (!running || paused) return;
    if (e.buttons || e.pointerType === "touch" || pointerAim) aimFromEvent(e);
  });
  canvas.addEventListener("mousemove", (e) => {
    if (!running || paused) return;
    if (!keys.up && !keys.down && !keys.left && !keys.right) {
      aimFromEvent(e);
    }
  });

  modePicker?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-mode]");
    if (!btn) return;
    setMode(btn.dataset.mode);
  });

  npcPanel?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-bots]");
    if (!btn) return;
    botCount = Number(btn.dataset.bots) || 4;
    npcPanel.querySelectorAll(".pick-btn").forEach((b) => {
      b.classList.toggle("active", b === btn);
    });
  });

  startBtn?.addEventListener("click", async () => {
    if (mode === "npc") {
      stopNet();
      leaveOnline().catch(() => {});
      startNpc({ bots: botCount });
      return;
    }
    await startOnlineMatch();
  });

  resumeBtn?.addEventListener("click", () => {
    paused = false;
    overlay.classList.add("hidden");
  });

  menuBtn?.addEventListener("click", () => openMenu(false));
  gamesBtn?.addEventListener("click", () => {
    location.href = "../index.html#games";
  });

  onlineQuickBtn?.addEventListener("click", () => quickPlay());
  onlineCreateBtn?.addEventListener("click", () => createOnlineRoom());
  onlineJoinBtn?.addEventListener("click", () => joinOnlineRoom(onlineJoinInput?.value));
  onlineJoinInput?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") joinOnlineRoom(onlineJoinInput.value);
  });
  onlineCancelBtn?.addEventListener("click", () => leaveOnline());

  document.addEventListener("visibilitychange", () => {
    if (document.hidden && running) {
      paused = true;
      openMenu(true);
    }
  });

  updateBestHud();
  setMode("npc");
  draw();
})();
