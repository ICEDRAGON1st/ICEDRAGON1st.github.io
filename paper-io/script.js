(function () {
  const HIGH_KEY = "paper-io-best-pct";
  const WORLD = 360;
  const VIEW_SPAN_MIN = 72; // slightly wider than tight paper.io zoom
  const VIEW_SPAN_MAX = 160;
  const LAND_PX = 8; // hi-res land texture so zoom stays smooth
  const SPEED = 24;
  const TURN_RATE = 10.5; // rad/s — sharp cuts, not huge arcs
  const TURN_RATE_HARD = 16; // extra snap for big direction changes
  const PLAYER_R = 1.55;
  const TRAIL_W = 1.2;
  const START_R = 6.5;
  const SPAWN_MIN_DIST = 72; // keep players/NPCs well apart on spawn
  const SPAWN_MIN_DIST_RELAXED = 48;
  const SPAWN_CLEAR_R = START_R + 5;
  const TRAIL_STEP = 0.85; // slightly longer steps = fewer points, still continuous
  const TRAIL_IMMUNE_DIST = 18; // can't hit your own recent trail (paper.io)
  const MIN_TRAIL_FOR_SUICIDE = 22;
  const TRAIL_SOFT_CAP = 640; // compact older points above this (trail stays connected)
  const TRAIL_KEEP_TAIL = 140; // recent tip stays dense for fair cutting
  const SPAWN_GRACE_MS = 2500;
  const MAX_PLAYERS = 8;
  const NET_POLL_MS = 120;
  const DOC_PREFIX = "paper-io-room-";
  const LOBBY_DOC = "paper-io-lobbies";
  const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

  const COLORS = [
    { fill: "#3ec6ff", soft: "rgba(62,198,255,0.78)", name: "Cyan" },
    { fill: "#ff6b5a", soft: "rgba(255,107,90,0.78)", name: "Coral" },
    { fill: "#7dff9a", soft: "rgba(125,255,154,0.78)", name: "Mint" },
    { fill: "#ffd166", soft: "rgba(255,209,102,0.78)", name: "Gold" },
    { fill: "#c792ff", soft: "rgba(199,146,255,0.78)", name: "Violet" },
    { fill: "#ff9ecd", soft: "rgba(255,158,205,0.78)", name: "Pink" },
    { fill: "#5eead4", soft: "rgba(94,234,212,0.78)", name: "Teal" },
    { fill: "#fda4af", soft: "rgba(253,164,175,0.78)", name: "Rose" }
  ];

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d", { alpha: false });
  const landLayer = document.createElement("canvas");
  const landCtx = landLayer.getContext("2d");
  const miniLayer = document.createElement("canvas");
  const miniCtx = miniLayer.getContext("2d", { alpha: false });
  let landDirty = true;
  let miniDirty = true;

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
  let aimDirX = 1;
  let aimDirY = 0;
  let pendingAngle = 0;
  const AIM_DEADZONE_PX = 36; // ignore mouse when it's on/near your blob
  let camX = WORLD / 2;
  let camY = WORLD / 2;
  let viewSpan = VIEW_SPAN_MIN;

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
    miniDirty = true;
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

  function spawnAreaClear(cx, cy, r) {
    const r2 = (r + 0.75) * (r + 0.75);
    const x0 = Math.max(0, Math.floor(cx - r - 1));
    const x1 = Math.min(WORLD - 1, Math.ceil(cx + r + 1));
    const y0 = Math.max(0, Math.floor(cy - r - 1));
    const y1 = Math.min(WORLD - 1, Math.ceil(cy + r + 1));
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const dx = x + 0.5 - cx;
        const dy = y + 0.5 - cy;
        if (dx * dx + dy * dy > r2) continue;
        if (grid[idx(x, y)] !== 0) return false;
      }
    }
    return true;
  }

  function spawnTooClose(x, y, avoid, minDist) {
    for (const p of avoid) {
      if (!p || !p.alive) continue;
      if (Math.hypot(p.x - x, p.y - y) < minDist) return true;
    }
    return false;
  }

  function findSpawn(avoid, minDist = SPAWN_MIN_DIST) {
    const margin = Math.max(SPAWN_CLEAR_R + 12, START_R + 18);
    for (let tries = 0; tries < 400; tries++) {
      const x = margin + Math.random() * (WORLD - margin * 2);
      const y = margin + Math.random() * (WORLD - margin * 2);
      if (!spawnAreaClear(x, y, SPAWN_CLEAR_R)) continue;
      if (spawnTooClose(x, y, avoid, minDist)) continue;
      return { x, y };
    }
    // Fallback: scan for any empty pocket far enough from others
    for (let y = margin; y < WORLD - margin; y += 5) {
      for (let x = margin; x < WORLD - margin; x += 5) {
        if (!spawnAreaClear(x, y, SPAWN_CLEAR_R)) continue;
        if (spawnTooClose(x, y, avoid, minDist)) continue;
        return { x, y };
      }
    }
    return null;
  }

  /** Last resort: farthest clear spot from every living player. */
  function findFarthestSpawn(avoid) {
    const margin = Math.max(SPAWN_CLEAR_R + 12, START_R + 18);
    let best = null;
    let bestScore = -1;
    for (let tries = 0; tries < 500; tries++) {
      const x = margin + Math.random() * (WORLD - margin * 2);
      const y = margin + Math.random() * (WORLD - margin * 2);
      if (!spawnAreaClear(x, y, SPAWN_CLEAR_R)) continue;
      let nearest = Infinity;
      for (const p of avoid) {
        if (!p || !p.alive) continue;
        nearest = Math.min(nearest, Math.hypot(p.x - x, p.y - y));
      }
      if (!Number.isFinite(nearest)) nearest = WORLD;
      if (nearest > bestScore) {
        bestScore = nearest;
        best = { x, y };
      }
    }
    return best;
  }

  function pickSpawn(avoid) {
    return (
      findSpawn(avoid, SPAWN_MIN_DIST) ||
      findSpawn(avoid, SPAWN_MIN_DIST_RELAXED) ||
      findFarthestSpawn(avoid)
    );
  }

  function makePlayer(id, name, color, human) {
    const spot = pickSpawn(players) || { x: WORLD / 2, y: WORLD / 2 };
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
      botAngle: ang,
      botMode: "raid",
      botRaidUntil: 0
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
    viewSpan = VIEW_SPAN_MIN;
    const me = localPlayer();
    if (me) {
      camX = me.x;
      camY = me.y;
    } else {
      camX = WORLD / 2;
      camY = WORLD / 2;
    }
    updateCamera(1);
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

  let stealNote = "";
  let stealUntil = 0;

  /** Steal victim's territory (+ unused trail paint) into the killer's color. */
  function transferTerritory(killer, victim) {
    if (!killer || !victim || killer === victim) {
      clearPlayerCells(victim);
      return 0;
    }
    const from = idHash(victim.id);
    const to = idHash(killer.id);
    let stolen = 0;
    for (let i = 0; i < grid.length; i++) {
      if (grid[i] === from) {
        grid[i] = to;
        stolen++;
      }
    }
    // Convert open trail into claimed land for the killer
    if (victim.trail.length) {
      let px = victim.trail[0].x;
      let py = victim.trail[0].y;
      for (let i = 1; i < victim.trail.length; i++) {
        paintStroke(to, px, py, victim.trail[i].x, victim.trail[i].y, TRAIL_W * 1.1);
        px = victim.trail[i].x;
        py = victim.trail[i].y;
      }
      paintStroke(to, px, py, victim.x, victim.y, TRAIL_W * 1.1);
    }
    victim.trail = [];
    markLandDirty();
    return stolen;
  }

  function kill(p, reason, killer) {
    if (!p.alive) return;
    const beforePct = killer && killer.alive ? pctFor(killer) : 0;
    p.alive = false;
    p.outside = false;
    let stolen = 0;
    if (killer && killer !== p && killer.alive) {
      stolen = transferTerritory(killer, p);
    } else {
      clearPlayerCells(p);
    }
    // NPCs can come back; humans are game-over
    if (!p.human) {
      p.respawnAt = performance.now() + 2200;
    } else {
      p.respawnAt = 0;
    }
    if (killer && killer.id === localId && killer !== p) {
      window.HubSound?.play?.("score");
      const pct = pctFor(killer);
      const gained = Math.max(0, Math.round((pct - beforePct) * 10) / 10);
      stealNote = stolen > 0 ? `Took ${p.name}'s land! +${gained}%` : `Eliminated ${p.name}`;
      stealUntil = performance.now() + 2200;
      maybeSubmit(pct);
      checkAchievements(pct);
      window.HubConfetti?.burst?.();
    }
    if (p.id === localId) {
      window.HubSound?.play?.("hit");
      showDeathFlash(reason);
      gameOver(reason);
    }
  }

  function gameOver(reason) {
    if (!running) return;
    running = false;
    paused = false;
    pointerAim = false;
    const me = localPlayer();
    const pct = me ? pctFor(me) : 0;
    maybeSubmit(pct);
    checkAchievements(pct);
    resumeBtn.classList.add("hidden");
    overlayTitle.textContent = "Game Over";
    overlayText.textContent = `${reason || "You were eliminated"}. Area claimed: ${pct}%. Hit Play to try again.`;
    startBtn.textContent = "Play again";
    overlay.classList.remove("hidden");
    cancelAnimationFrame(animId);
    draw();
    updateHud();
  }

  function capture(p) {
    const hid = idHash(p.id);
    const wasMine = new Uint8Array(grid.length);
    for (let i = 0; i < grid.length; i++) {
      if (grid[i] === hid) wasMine[i] = 1;
    }
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

    // Kill rivals trapped in newly claimed cells (enemy/empty land you just took)
    for (const other of players) {
      if (!other.alive || other === p || other.id === p.id) continue;
      // Never kill the capturer (guards against duplicate player rows)
      if (p.id === localId && other.id === localId) continue;
      const cx = clamp(other.x | 0, 0, WORLD - 1);
      const cy = clamp(other.y | 0, 0, WORLD - 1);
      const i = idx(cx, cy);
      if (grid[i] === hid && !wasMine[i]) {
        kill(other, `${p.name} enclosed ${other.name}`, p);
      }
    }

    // Snip rival trails that ran through the land you just stole
    for (const other of players) {
      if (!other.alive || other === p || !other.trail.length) continue;
      other.trail = other.trail.filter((pt) => {
        const i = idx(clamp(pt.x | 0, 0, WORLD - 1), clamp(pt.y | 0, 0, WORLD - 1));
        return !(grid[i] === hid && !wasMine[i]);
      });
      if (other.trail.length < 2) {
        other.trail = [];
        if (isOwnLand(other, other.x, other.y)) other.outside = false;
      }
    }
  }

  function compactTrail(trail) {
    if (!trail || trail.length <= TRAIL_SOFT_CAP) return trail;
    const head = trail[0];
    const tailStart = Math.max(1, trail.length - TRAIL_KEEP_TAIL);
    const budget = Math.max(8, TRAIL_SOFT_CAP - TRAIL_KEEP_TAIL - 1);
    const midLen = Math.max(0, tailStart - 1);
    const stride = Math.max(1, Math.ceil(midLen / budget));
    const out = [head];
    for (let i = 1; i < tailStart; i += stride) {
      out.push(trail[i]);
    }
    // Keep the joint into the dense tip so the path stays sealed to home
    const joint = trail[tailStart - 1];
    if (joint && out[out.length - 1] !== joint) out.push(joint);
    for (let i = tailStart; i < trail.length; i++) out.push(trail[i]);
    return out;
  }

  function maybeCompactTrail(p) {
    if (p.trail.length > TRAIL_SOFT_CAP) {
      p.trail = compactTrail(p.trail);
    }
  }

  function trailDrawStride(len) {
    if (len <= 400) return 1;
    if (len <= 900) return 2;
    return Math.max(3, Math.floor(len / 400));
  }

  function pointInTrailLoop(trail, x, y, headX, headY) {
    if (!trail || trail.length < 3) return false;
    // Ray-cast against open trail + current head
    let inside = false;
    let x0 = headX;
    let y0 = headY;
    for (let i = 0; i <= trail.length; i++) {
      const pt = i < trail.length ? trail[i] : { x: headX, y: headY };
      const x1 = pt.x;
      const y1 = pt.y;
      const cross =
        y0 > y !== y1 > y &&
        x < ((x1 - x0) * (y - y0)) / (y1 - y0 || 1e-9) + x0;
      if (cross) inside = !inside;
      x0 = x1;
      y0 = y1;
    }
    return inside;
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
    const hitR = ignoreRecent
      ? PLAYER_R * 0.8 + TRAIL_W * 0.3
      : PLAYER_R * 1.35 + TRAIL_W * 0.85; // easier to cut rivals
    const trail = p.trail;

    function hitSeg(ax, ay, bx, by) {
      // Cheap AABB reject before exact segment distance
      const minX = (ax < bx ? ax : bx) - hitR;
      const maxX = (ax > bx ? ax : bx) + hitR;
      const minY = (ay < by ? ay : by) - hitR;
      const maxY = (ay > by ? ay : by) + hitR;
      if (ox < minX || ox > maxX || oy < minY || oy > maxY) return false;
      return distToSeg(ox, oy, ax, ay, bx, by) <= hitR;
    }

    // Always test the live tip (last sample → current body)
    if (trail.length >= 1) {
      const tip = trail[trail.length - 1];
      const tipDist = Math.hypot(p.x - tip.x, p.y - tip.y);
      if (!ignoreRecent || tipDist > TRAIL_IMMUNE_DIST * 0.35) {
        if (hitSeg(tip.x, tip.y, p.x, p.y)) {
          if (!ignoreRecent) return true;
          if (tipDist > TRAIL_IMMUNE_DIST * 0.5) return true;
        }
      }
    }

    if (trail.length < 2) return false;

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
      let total = 0;
      for (let i = 1; i < trail.length; i++) {
        total += Math.hypot(trail[i].x - trail[i - 1].x, trail[i].y - trail[i - 1].y);
      }
      if (total < MIN_TRAIL_FOR_SUICIDE) return false;
      for (let i = 1; i < cut; i++) {
        if (hitSeg(trail[i - 1].x, trail[i - 1].y, trail[i].x, trail[i].y)) return true;
      }
      return false;
    }

    // Recent tip: every segment. Older path: strided (still continuous enough to cut)
    const denseFrom = Math.max(1, trail.length - 160);
    for (let i = denseFrom; i < trail.length; i++) {
      if (hitSeg(trail[i - 1].x, trail[i - 1].y, trail[i].x, trail[i].y)) return true;
    }
    const stride = trail.length > 500 ? 3 : trail.length > 250 ? 2 : 1;
    for (let i = stride; i < denseFrom; i += stride) {
      const a = trail[i - stride];
      const b = trail[i];
      if (hitSeg(a.x, a.y, b.x, b.y)) return true;
    }
    return false;
  }

  function respawn(p) {
    const spot = pickSpawn(players.filter((o) => o.alive && o !== p));
    if (!spot) {
      // Map too full — try again shortly instead of landing in someone's land
      p.respawnAt = performance.now() + 1200;
      return;
    }
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
    // Big redirects (side / reverse) turn faster so you can cut short
    const rate = Math.abs(diff) > 1.1 ? TURN_RATE_HARD : TURN_RATE;
    const maxStep = rate * dt;
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
      // Screen-relative aim — stable with camera follow; deadzone avoids spin
      p.wantAngle = Math.atan2(aimDirY, aimDirX);
    }
    pendingAngle = p.wantAngle;
  }

  function botDecide(p, now) {
    if (now < p.botThink) {
      p.wantAngle = p.botAngle;
      return;
    }
    // Think often, with jitter so packs don't sync
    p.botThink = now + 120 + Math.random() * 380;

    if (!p.botMode) p.botMode = "raid";
    if (!p.botRaidUntil) p.botRaidUntil = 0;

    const home = isOwnLand(p, p.x, p.y);
    const trailLen = p.trail.length;
    const origin = trailLen ? p.trail[0] : null;
    const outDist = origin ? Math.hypot(p.x - origin.x, p.y - origin.y) : 0;

    // Sometimes chase a nearby exposed rival tip
    if (Math.random() < 0.4) {
      let hunt = null;
      let huntD = 36 + Math.random() * 28;
      for (const other of players) {
        if (other === p || !other.alive || !other.outside || other.trail.length < 3) {
          continue;
        }
        const tip = other.trail[other.trail.length - 1];
        const d = Math.hypot(tip.x - p.x, tip.y - p.y);
        if (d < huntD) {
          huntD = d;
          hunt = tip;
        }
      }
      if (hunt) {
        p.botMode = "raid";
        p.botRaidUntil = Math.max(p.botRaidUntil, now + 900 + Math.random() * 1600);
        p.botAngle = Math.atan2(hunt.y - p.y, hunt.x - p.x) + (Math.random() - 0.5) * 0.35;
        p.wantAngle = p.botAngle;
        return;
      }
    }

    if (home) {
      // Push out of base — commit to a longer raid
      p.botMode = "raid";
      p.botRaidUntil = now + 2800 + Math.random() * 7000; // ~3–10s out
      p.botAngle = Math.random() * Math.PI * 2;
      // Prefer leaving toward open map, not staying in base
      p.botAngle += (Math.random() - 0.5) * 0.5;
    } else if (
      p.botMode === "raid" &&
      now < p.botRaidUntil &&
      trailLen < 520 &&
      outDist < 110 + Math.random() * 50
    ) {
      // Stay out exploring — wiggly / sudden new headings
      if (Math.random() < 0.22) {
        p.botAngle = Math.random() * Math.PI * 2;
      } else {
        p.botAngle += (Math.random() - 0.5) * 1.6;
      }
      // Rare mid-raid spiral cut to make tasty loops
      if (Math.random() < 0.08) {
        p.botAngle += (Math.random() < 0.5 ? 1 : -1) * (0.8 + Math.random() * 1.2);
      }
    } else {
      // Head home, but not in a perfect laser line
      p.botMode = "return";
      let best = null;
      let bestD = 1e9;
      const hid = idHash(p.id);
      const step = 5 + ((idHash(p.id) * 3) % 4);
      for (let y = 2; y < WORLD; y += step) {
        for (let x = 2; x < WORLD; x += step) {
          if (grid[idx(x, y)] !== hid) continue;
          const d = Math.hypot(x + 0.5 - p.x, y + 0.5 - p.y);
          if (d < bestD) {
            bestD = d;
            best = { x: x + 0.5, y: y + 0.5 };
          }
        }
      }
      if (best) {
        p.botAngle =
          Math.atan2(best.y - p.y, best.x - p.x) + (Math.random() - 0.5) * 0.75;
      } else {
        p.botAngle += (Math.random() - 0.5) * 1.1;
      }
      // After a successful return, plan another raid soon
      if (home) {
        p.botMode = "raid";
        p.botRaidUntil = now + 2000 + Math.random() * 5000;
      }
    }

    // Soft edge avoidance
    const margin = 16;
    if (p.x < margin) p.botAngle = 0.15 + Math.random() * 0.4;
    if (p.x > WORLD - margin) p.botAngle = Math.PI - (0.15 + Math.random() * 0.4);
    if (p.y < margin) p.botAngle = Math.PI / 2 + (Math.random() - 0.5) * 0.5;
    if (p.y > WORLD - margin) p.botAngle = -Math.PI / 2 + (Math.random() - 0.5) * 0.5;

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

    const nxRaw = p.x + Math.cos(p.angle) * SPEED * dt;
    const nyRaw = p.y + Math.sin(p.angle) * SPEED * dt;
    const grace = inSpawnGrace(p);

    // Walls are solid — slide along them, never KO
    const edge = PLAYER_R + 0.35;
    let nx = clamp(nxRaw, edge, WORLD - edge);
    let ny = clamp(nyRaw, edge, WORLD - edge);
    if (nx !== nxRaw) {
      // bounce horizontal component
      p.angle = Math.atan2(Math.sin(p.angle), -Math.cos(p.angle));
      p.wantAngle = p.angle;
    }
    if (ny !== nyRaw) {
      p.angle = Math.atan2(-Math.sin(p.angle), Math.cos(p.angle));
      p.wantAngle = p.angle;
    }

    // Combat:
    // - Open field: both exposed (with inside-loop cut protection)
    // - Home defense: kill anyone currently on your land
    if (!grace) {
      const myHid = idHash(p.id);
      const meHome = isOwnLand(p, p.x, p.y) || isOwnLand(p, nx, ny);
      for (const other of players) {
        if (other === p || !other.alive) continue;
        if (inSpawnGrace(other)) continue;

        const otherOnMyLand = cellAt(other.x, other.y) === myHid;
        let canKill = false;
        if (otherOnMyLand && meHome) {
          // Defend your territory — bump/cut invaders on your land
          canKill = true;
        } else if (p.outside && other.outside) {
          // Open-field fight; don't cut someone from inside their open loop
          if (
            other.trail.length >= 3 &&
            pointInTrailLoop(other.trail, p.x, p.y, other.x, other.y)
          ) {
            canKill = false;
          } else {
            canKill = true;
          }
        }
        if (!canKill) continue;

        const bodyHit = Math.hypot(nx - other.x, ny - other.y) < PLAYER_R * 2.1;
        const hitTrail = other.outside && trailHit(other, nx, ny, false);
        if (bodyHit || hitTrail) {
          kill(other, `${p.name} eliminated ${other.name}`, p);
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
      }
      maybeCompactTrail(p);
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
        // Only NPCs respawn; humans stay out until Play again
        if (!p.human && p.respawnAt && now >= p.respawnAt) {
          p.respawnAt = 0;
          respawn(p);
        }
        continue;
      }
      stepPlayer(p, dt);
    }

    // Body bump: mutual when both exposed, or defender cleans invaders on their land
    for (let i = 0; i < players.length; i++) {
      const a = players[i];
      if (!a.alive) continue;
      for (let j = i + 1; j < players.length; j++) {
        const b = players[j];
        if (!b.alive) continue;
        if (Math.hypot(a.x - b.x, a.y - b.y) >= PLAYER_R * 1.7) continue;
        if (inSpawnGrace(a) || inSpawnGrace(b)) continue;

        const aHome = isOwnLand(a, a.x, a.y);
        const bHome = isOwnLand(b, b.x, b.y);
        const bOnA = cellAt(b.x, b.y) === idHash(a.id);
        const aOnB = cellAt(a.x, a.y) === idHash(b.id);

        if (aHome && bOnA) {
          kill(b, `${a.name} eliminated ${b.name}`, a);
          continue;
        }
        if (bHome && aOnB) {
          kill(a, `${b.name} eliminated ${a.name}`, b);
          continue;
        }

        if (a.outside && b.outside) {
          const aInB =
            b.trail.length >= 3 && pointInTrailLoop(b.trail, a.x, a.y, b.x, b.y);
          const bInA =
            a.trail.length >= 3 && pointInTrailLoop(a.trail, b.x, b.y, a.x, a.y);
          if (aInB || bInA) continue;
          kill(a, "Head-on");
          kill(b, "Head-on");
        }
      }
    }
  }

  function worldToScreen(x, y) {
    const s = Math.min(canvas.width, canvas.height) / viewSpan;
    return {
      x: (x - camX) * s + canvas.width / 2,
      y: (y - camY) * s + canvas.height / 2
    };
  }

  function screenToWorld(sx, sy) {
    const rect = canvas.getBoundingClientRect();
    const s = Math.min(canvas.width, canvas.height) / viewSpan;
    const cx = ((sx - rect.left) / rect.width) * canvas.width;
    const cy = ((sy - rect.top) / rect.height) * canvas.height;
    return {
      x: (cx - canvas.width / 2) / s + camX,
      y: (cy - canvas.height / 2) / s + camY
    };
  }

  function updateCamera(dt) {
    const me = typeof localPlayer === "function" ? localPlayer() : null;
    if (me) {
      const pct = Math.max(0, pctFor(me)) / 100;
      const targetSpan = clamp(
        VIEW_SPAN_MIN + pct * (VIEW_SPAN_MAX - VIEW_SPAN_MIN) * 1.15,
        VIEW_SPAN_MIN,
        VIEW_SPAN_MAX
      );
      const k = 1 - Math.exp(-Math.max(0.001, dt || 0.016) * 9);
      viewSpan += (targetSpan - viewSpan) * k;
      camX += (me.x - camX) * k;
      camY += (me.y - camY) * k;
    }
    if (viewSpan >= WORLD) {
      camX = WORLD / 2;
      camY = WORLD / 2;
    } else {
      const half = viewSpan / 2;
      camX = clamp(camX, half, WORLD - half);
      camY = clamp(camY, half, WORLD - half);
    }
  }

  function paintLandLayer() {
    const W = WORLD * LAND_PX;
    if (landLayer.width !== W || landLayer.height !== W) {
      landLayer.width = W;
      landLayer.height = W;
      landDirty = true;
    }
    if (!landDirty) return;
    landDirty = false;
    landCtx.clearRect(0, 0, W, W);
    landCtx.imageSmoothingEnabled = true;
    // Soft overlapping disks at hi-res merge into smooth blobs when zoomed
    const rad = LAND_PX * 0.78;
    for (let y = 0; y < WORLD; y++) {
      for (let x = 0; x < WORLD; x++) {
        const owner = grid[idx(x, y)];
        if (!owner) continue;
        const pid = idFromHash(owner);
        const pl = players.find((p) => p.id === pid);
        const color = COLORS[(pl ? pl.color : owner - 1) % COLORS.length];
        landCtx.fillStyle = color.soft;
        landCtx.beginPath();
        landCtx.arc((x + 0.5) * LAND_PX, (y + 0.5) * LAND_PX, rad, 0, Math.PI * 2);
        landCtx.fill();
      }
    }
  }

  function paintMiniLayer() {
    if (miniLayer.width !== WORLD || miniLayer.height !== WORLD) {
      miniLayer.width = WORLD;
      miniLayer.height = WORLD;
      miniDirty = true;
    }
    if (!miniDirty) return;
    miniDirty = false;
    miniCtx.fillStyle = "#0c1a2a";
    miniCtx.fillRect(0, 0, WORLD, WORLD);
    for (let y = 0; y < WORLD; y++) {
      for (let x = 0; x < WORLD; x++) {
        const owner = grid[idx(x, y)];
        if (!owner) continue;
        const pid = idFromHash(owner);
        const pl = players.find((p) => p.id === pid);
        const color = COLORS[(pl ? pl.color : owner - 1) % COLORS.length];
        miniCtx.fillStyle = color.fill;
        miniCtx.fillRect(x, y, 1, 1);
      }
    }
  }

  function drawMinimap(w, h) {
    const size = Math.round(Math.min(w, h) * 0.2);
    const pad = Math.round(Math.min(w, h) * 0.022);
    const x0 = w - size - pad;
    const y0 = h - size - pad;
    const inset = 4;
    const mapX = x0 + inset;
    const mapY = y0 + inset;
    const mapS = size - inset * 2;
    const cell = mapS / WORLD;

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
    ctx.lineCap = "butt";
    ctx.lineJoin = "miter";

    // Panel chrome
    ctx.fillStyle = "rgba(6, 12, 20, 0.88)";
    ctx.strokeStyle = "rgba(62, 198, 255, 0.5)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    const r = 10;
    ctx.moveTo(x0 + r, y0);
    ctx.arcTo(x0 + size, y0, x0 + size, y0 + size, r);
    ctx.arcTo(x0 + size, y0 + size, x0, y0 + size, r);
    ctx.arcTo(x0, y0 + size, x0, y0, r);
    ctx.arcTo(x0, y0, x0 + size, y0, r);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Clip map contents so nothing bleeds past the frame
    ctx.save();
    ctx.beginPath();
    ctx.rect(mapX, mapY, mapS, mapS);
    ctx.clip();

    paintMiniLayer();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(miniLayer, 0, 0, WORLD, WORLD, mapX, mapY, mapS, mapS);

    // Trails — subsample so long trails don't flicker/overdraw
    for (const p of players) {
      if (!p.alive || p.trail.length < 2) continue;
      const c = COLORS[p.color % COLORS.length];
      const step = Math.max(1, Math.floor(p.trail.length / 80));
      ctx.strokeStyle = c.fill;
      ctx.globalAlpha = 0.85;
      ctx.lineWidth = Math.max(1.25, cell * 1.4);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(mapX + p.trail[0].x * cell, mapY + p.trail[0].y * cell);
      for (let i = step; i < p.trail.length; i += step) {
        ctx.lineTo(mapX + p.trail[i].x * cell, mapY + p.trail[i].y * cell);
      }
      ctx.lineTo(mapX + p.x * cell, mapY + p.y * cell);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // Players
    for (const p of players) {
      if (!p.alive) continue;
      const c = COLORS[p.color % COLORS.length];
      const px = mapX + p.x * cell;
      const py = mapY + p.y * cell;
      const isMe = p.id === localId;
      const pr = isMe ? 3.2 : 2.2;
      ctx.fillStyle = c.fill;
      ctx.beginPath();
      ctx.arc(px, py, pr, 0, Math.PI * 2);
      ctx.fill();
      if (isMe) {
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }

    ctx.restore(); // end clip

    ctx.strokeStyle = "rgba(62, 198, 255, 0.4)";
    ctx.lineWidth = 1;
    ctx.strokeRect(mapX + 0.5, mapY + 0.5, mapS - 1, mapS - 1);
    ctx.restore();
  }

  function draw() {
    const w = canvas.width;
    const h = canvas.height;
    const scale = Math.min(w, h) / viewSpan;

    const bg = ctx.createRadialGradient(w * 0.5, h * 0.45, w * 0.08, w * 0.5, h * 0.5, w * 0.75);
    bg.addColorStop(0, "#102338");
    bg.addColorStop(1, "#060d16");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.scale(scale, scale);
    ctx.translate(-camX, -camY);

    // Soft border (walls don't kill) — world units
    ctx.strokeStyle = "rgba(62,198,255,0.35)";
    ctx.lineWidth = 1.1;
    ctx.strokeRect(0.5, 0.5, WORLD - 1, WORLD - 1);

    // Faint grid so zoomed view keeps depth
    ctx.strokeStyle = "rgba(62,198,255,0.06)";
    ctx.lineWidth = 0.08;
    ctx.beginPath();
    for (let g = 0; g <= WORLD; g += 10) {
      ctx.moveTo(g, 0);
      ctx.lineTo(g, WORLD);
      ctx.moveTo(0, g);
      ctx.lineTo(WORLD, g);
    }
    ctx.stroke();

    paintLandLayer();
    ctx.imageSmoothingEnabled = true;
    try {
      ctx.imageSmoothingQuality = "high";
    } catch {}
    // Light screen-space soften so cell edges don't read as pixels when zoomed
    if (typeof ctx.filter === "string") {
      ctx.filter = `blur(${(0.22 * scale).toFixed(2)}px)`;
      ctx.drawImage(landLayer, 0, 0, landLayer.width, landLayer.height, 0, 0, WORLD, WORLD);
      ctx.filter = "none";
      ctx.globalAlpha = 0.65;
      ctx.drawImage(landLayer, 0, 0, landLayer.width, landLayer.height, 0, 0, WORLD, WORLD);
      ctx.globalAlpha = 1;
    } else {
      ctx.drawImage(landLayer, 0, 0, landLayer.width, landLayer.height, 0, 0, WORLD, WORLD);
    }

    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (const p of players) {
      if (!p.alive || p.trail.length < 1) continue;
      const c = COLORS[p.color % COLORS.length];
      const stride = trailDrawStride(p.trail.length);
      ctx.strokeStyle = c.fill;
      ctx.globalAlpha = 0.92;
      ctx.lineWidth = TRAIL_W * 1.15;
      // Shadows on huge trails crush FPS — only glow short ones
      if (p.trail.length < 220) {
        ctx.shadowColor = c.fill;
        ctx.shadowBlur = 1.4;
      } else {
        ctx.shadowBlur = 0;
      }
      ctx.beginPath();
      ctx.moveTo(p.trail[0].x, p.trail[0].y);
      for (let i = stride; i < p.trail.length; i += stride) {
        ctx.lineTo(p.trail[i].x, p.trail[i].y);
      }
      const last = p.trail[p.trail.length - 1];
      if (last) ctx.lineTo(last.x, last.y);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
    }

    for (const p of players) {
      if (!p.alive) continue;
      const c = COLORS[p.color % COLORS.length];
      const r = PLAYER_R * 1.15;

      ctx.shadowColor = c.fill;
      ctx.shadowBlur = r * 1.8;
      ctx.fillStyle = c.fill;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      ctx.fillStyle = "rgba(255,255,255,0.35)";
      ctx.beginPath();
      ctx.arc(p.x - r * 0.28, p.y - r * 0.28, r * 0.32, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = "rgba(255,255,255,0.7)";
      ctx.lineWidth = 0.22;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x + Math.cos(p.angle) * r * 1.35, p.y + Math.sin(p.angle) * r * 1.35);
      ctx.stroke();

      if (p.id === localId) {
        ctx.strokeStyle = "rgba(255,255,255,0.95)";
        ctx.lineWidth = 0.28;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r + 0.35, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.fillStyle = "rgba(6,12,20,0.72)";
      ctx.font = "bold 1.85px Outfit,sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      ctx.fillText(p.name.slice(0, 10), p.x, p.y - r - 0.45);
    }

    ctx.restore();

    drawMinimap(w, h);

    if (performance.now() < stealUntil) {
      ctx.fillStyle = "rgba(0,0,0,0.4)";
      ctx.fillRect(0, h * 0.12, w, h * 0.12);
      ctx.fillStyle = "#7dff9a";
      ctx.font = "bold 26px Outfit,sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(stealNote, w / 2, h * 0.18);
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
    updateCamera(dt);
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
    startBtn.textContent = mode === "online" && isHost ? "Start match" : "Play";
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
        "Free-move like paper.io — diagonals, mouse aim, claim loops. Walls bounce you; get cut and it’s game over.";
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
    const me = localPlayer();
    if (!me || !me.alive) {
      const w = screenToWorld(pt.clientX, pt.clientY);
      aimX = w.x;
      aimY = w.y;
      pointerAim = true;
      return;
    }
    const rect = canvas.getBoundingClientRect();
    const sx = ((pt.clientX - rect.left) / rect.width) * canvas.width;
    const sy = ((pt.clientY - rect.top) / rect.height) * canvas.height;
    const ps = worldToScreen(me.x, me.y);
    const dx = sx - ps.x;
    const dy = sy - ps.y;
    const dist = Math.hypot(dx, dy);
    // Keep last aim while cursor sits on you / your nearby land under the blob
    if (dist < AIM_DEADZONE_PX) return;
    const len = dist || 1;
    aimDirX = dx / len;
    aimDirY = dy / len;
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
