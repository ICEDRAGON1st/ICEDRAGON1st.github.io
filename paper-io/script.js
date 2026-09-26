(function () {
  const HIGH_KEY = "paper-io-best-pct";
  const SIZE = 72;
  const TICK_MS = 72;
  const START_SIZE = 3;
  const MAX_PLAYERS = 8;
  const NET_POLL_MS = 140;
  const NET_PUSH_MS = 160;
  const DOC_PREFIX = "paper-io-room-";
  const LOBBY_DOC = "paper-io-lobbies";
  const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

  const COLORS = [
    { fill: "#3ec6ff", soft: "rgba(62,198,255,0.45)", name: "Cyan" },
    { fill: "#ff6b5a", soft: "rgba(255,107,90,0.45)", name: "Coral" },
    { fill: "#7dff9a", soft: "rgba(125,255,154,0.45)", name: "Mint" },
    { fill: "#ffd166", soft: "rgba(255,209,102,0.45)", name: "Gold" },
    { fill: "#c792ff", soft: "rgba(199,146,255,0.45)", name: "Violet" },
    { fill: "#ff9ecd", soft: "rgba(255,158,205,0.45)", name: "Pink" },
    { fill: "#5eead4", soft: "rgba(94,234,212,0.45)", name: "Teal" },
    { fill: "#fda4af", soft: "rgba(253,164,175,0.45)", name: "Rose" }
  ];

  const DIRS = {
    up: { x: 0, y: -1 },
    down: { x: 0, y: 1 },
    left: { x: -1, y: 0 },
    right: { x: 1, y: 0 }
  };
  const OPP = { up: "down", down: "up", left: "right", right: "left" };

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
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
  let tickTimer = 0;
  let animId = 0;
  let lastFrame = 0;

  /** @type {Int16Array} */
  let grid = new Int16Array(SIZE * SIZE);
  /** @type {Player[]} */
  let players = [];
  let localId = "";
  let nextBotId = 1;

  // Online
  let roomCode = "";
  let isHost = false;
  let netPollTimer = 0;
  let netPushTimer = 0;
  let netBusy = false;
  let pendingDir = "";
  let lobbyAwaiting = false;

  /**
   * @typedef {{
   *  id: string, name: string, color: number, x: number, y: number,
   *  dir: string, nextDir: string, alive: boolean, human: boolean,
   *  trail: number[], respawnAt: number, botThink: number, botTarget: string
   * }} Player
   */

  function idx(x, y) {
    return y * SIZE + x;
  }

  function inBounds(x, y) {
    return x >= 0 && y >= 0 && x < SIZE && y < SIZE;
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
      bestPct = pct;
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

  function clearGrid() {
    grid.fill(0);
  }

  function claimRect(pid, cx, cy, half) {
    for (let y = cy - half; y <= cy + half; y++) {
      for (let x = cx - half; x <= cx + half; x++) {
        if (inBounds(x, y)) grid[idx(x, y)] = pid;
      }
    }
  }

  function findSpawn(avoid) {
    for (let tries = 0; tries < 80; tries++) {
      const half = (START_SIZE / 2) | 0;
      const x = half + 2 + ((Math.random() * (SIZE - START_SIZE - 4)) | 0);
      const y = half + 2 + ((Math.random() * (SIZE - START_SIZE - 4)) | 0);
      let ok = true;
      for (const p of avoid) {
        if (Math.hypot(p.x - x, p.y - y) < 10) {
          ok = false;
          break;
        }
      }
      if (ok) return { x, y };
    }
    return { x: (SIZE / 2) | 0, y: (SIZE / 2) | 0 };
  }

  function makePlayer(id, name, color, human) {
    const spot = findSpawn(players);
    const dirs = Object.keys(DIRS);
    const dir = dirs[(Math.random() * dirs.length) | 0];
    /** @type {Player} */
    const p = {
      id,
      name,
      color,
      x: spot.x,
      y: spot.y,
      dir,
      nextDir: dir,
      alive: true,
      human,
      trail: [],
      respawnAt: 0,
      botThink: 0,
      botTarget: dir
    };
    claimRect(idHash(id), spot.x, spot.y, (START_SIZE / 2) | 0);
    return p;
  }

  /** Stable small positive id for grid cells (1..) */
  const idMap = new Map();
  let idSeq = 1;
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

  function setDir(p, dir) {
    if (!DIRS[dir]) return;
    if (OPP[dir] === p.dir && p.trail.length) return;
    p.nextDir = dir;
  }

  function isOwnLand(p, x, y) {
    return grid[idx(x, y)] === idHash(p.id);
  }

  function capture(p) {
    const hid = idHash(p.id);
    for (let i = 0; i < p.trail.length; i += 2) {
      const x = p.trail[i];
      const y = p.trail[i + 1];
      if (inBounds(x, y)) grid[idx(x, y)] = hid;
    }
    p.trail = [];

    const visited = new Uint8Array(SIZE * SIZE);
    const qx = [];
    const qy = [];
    function push(x, y) {
      if (!inBounds(x, y)) return;
      const i = idx(x, y);
      if (visited[i] || grid[i] === hid) return;
      visited[i] = 1;
      qx.push(x);
      qy.push(y);
    }
    for (let x = 0; x < SIZE; x++) {
      push(x, 0);
      push(x, SIZE - 1);
    }
    for (let y = 0; y < SIZE; y++) {
      push(0, y);
      push(SIZE - 1, y);
    }
    for (let qi = 0; qi < qx.length; qi++) {
      const x = qx[qi];
      const y = qy[qi];
      push(x + 1, y);
      push(x - 1, y);
      push(x, y + 1);
      push(x, y - 1);
    }
    for (let i = 0; i < grid.length; i++) {
      if (!visited[i] && grid[i] !== hid) grid[i] = hid;
    }
  }

  function clearPlayerCells(p) {
    const hid = idHash(p.id);
    for (let i = 0; i < grid.length; i++) if (grid[i] === hid) grid[i] = 0;
    p.trail = [];
  }

  function kill(p, reason) {
    if (!p.alive) return;
    p.alive = false;
    p.trail = [];
    clearPlayerCells(p);
    p.respawnAt = performance.now() + (p.human ? 1800 : 2200);
    if (p.id === localId) {
      window.HubSound?.play?.("hit");
      showDeathFlash(reason);
    }
  }

  let deathNote = "";
  let deathUntil = 0;
  function showDeathFlash(reason) {
    deathNote = reason || "KO";
    deathUntil = performance.now() + 1400;
  }

  function trailOwnerAt(x, y) {
    for (const p of players) {
      if (!p.alive || !p.trail.length) continue;
      for (let i = 0; i < p.trail.length; i += 2) {
        if (p.trail[i] === x && p.trail[i + 1] === y) return p;
      }
    }
    return null;
  }

  function respawn(p) {
    const spot = findSpawn(players.filter((o) => o.alive && o !== p));
    p.x = spot.x;
    p.y = spot.y;
    p.alive = true;
    p.trail = [];
    const dirs = Object.keys(DIRS);
    p.dir = dirs[(Math.random() * dirs.length) | 0];
    p.nextDir = p.dir;
    claimRect(idHash(p.id), spot.x, spot.y, (START_SIZE / 2) | 0);
  }

  function botDecide(p, now) {
    if (now < p.botThink) return;
    p.botThink = now + 180 + Math.random() * 420;
    const onLand = isOwnLand(p, p.x, p.y);
    const options = Object.keys(DIRS).filter((d) => d !== OPP[p.dir]);

    // Prefer cutting nearby enemy trails
    for (const other of players) {
      if (other === p || !other.alive || other.trail.length < 4) continue;
      const tx = other.trail[other.trail.length - 2];
      const ty = other.trail[other.trail.length - 1];
      if (Math.hypot(tx - p.x, ty - p.y) < 14) {
        if (Math.abs(tx - p.x) > Math.abs(ty - p.y)) {
          p.botTarget = tx > p.x ? "right" : "left";
        } else {
          p.botTarget = ty > p.y ? "down" : "up";
        }
        setDir(p, p.botTarget);
        return;
      }
    }

    if (onLand) {
      // Venture out sometimes
      if (Math.random() < 0.55) {
        p.botTarget = options[(Math.random() * options.length) | 0];
      }
    } else {
      // Seek own land or close loop
      let best = null;
      let bestD = 1e9;
      const hid = idHash(p.id);
      for (let y = 0; y < SIZE; y += 2) {
        for (let x = 0; x < SIZE; x += 2) {
          if (grid[idx(x, y)] !== hid) continue;
          const d = Math.hypot(x - p.x, y - p.y);
          if (d < bestD) {
            bestD = d;
            best = { x, y };
          }
        }
      }
      if (best) {
        if (Math.abs(best.x - p.x) > Math.abs(best.y - p.y)) {
          p.botTarget = best.x > p.x ? "right" : "left";
        } else {
          p.botTarget = best.y > p.y ? "down" : "up";
        }
      } else if (Math.random() < 0.3) {
        p.botTarget = options[(Math.random() * options.length) | 0];
      }
      // Don't wander too far
      if (p.trail.length > 40 && Math.random() < 0.5) {
        /* keep seeking home */
      }
    }

    // Edge avoidance
    const look = DIRS[p.botTarget] || DIRS[p.dir];
    const nx = p.x + look.x;
    const ny = p.y + look.y;
    if (!inBounds(nx, ny) || nx < 1 || ny < 1 || nx > SIZE - 2 || ny > SIZE - 2) {
      p.botTarget = options[(Math.random() * options.length) | 0];
    }
    setDir(p, p.botTarget || p.dir);
  }

  function stepPlayer(p) {
    if (!p.alive) return;
    p.dir = p.nextDir;
    const d = DIRS[p.dir];
    const nx = p.x + d.x;
    const ny = p.y + d.y;

    if (!inBounds(nx, ny)) {
      kill(p, "Hit the edge");
      return;
    }

    // Own trail collision (skip last cell we just left)
    for (let i = 0; i < p.trail.length - 2; i += 2) {
      if (p.trail[i] === nx && p.trail[i + 1] === ny) {
        kill(p, "Hit your trail");
        return;
      }
    }

    const victim = trailOwnerAt(nx, ny);
    if (victim && victim !== p) {
      kill(victim, `${p.name} cut their trail`);
      if (p.id === localId) window.HubSound?.play?.("score");
    }

    const wasHome = isOwnLand(p, p.x, p.y);
    const nowHome = isOwnLand(p, nx, ny);

    if (!wasHome || !nowHome) {
      // leaving or outside: drop trail on previous cell if outside after move prep
    }

    if (!wasHome) {
      // already outside — trail grows from previous position
      p.trail.push(p.x, p.y);
    } else if (!nowHome) {
      // just left home
      p.trail.push(p.x, p.y);
    }

    p.x = nx;
    p.y = ny;

    if (!wasHome && nowHome && p.trail.length) {
      capture(p);
      if (p.id === localId) {
        window.HubSound?.play?.("score");
        const pct = pctFor(p);
        maybeSubmit(pct);
        checkAchievements(pct);
        if (pct >= 20) window.HubConfetti?.burst?.();
      }
    }
  }

  function tick(now) {
    for (const p of players) {
      if (!p.alive) {
        if (p.respawnAt && now >= p.respawnAt) {
          p.respawnAt = 0;
          respawn(p);
        }
        continue;
      }
      if (!p.human) botDecide(p, now);
      stepPlayer(p);
    }

    // Head-on: same cell, both alive outside
    for (let i = 0; i < players.length; i++) {
      const a = players[i];
      if (!a.alive) continue;
      for (let j = i + 1; j < players.length; j++) {
        const b = players[j];
        if (!b.alive) continue;
        if (a.x === b.x && a.y === b.y) {
          const aOut = !isOwnLand(a, a.x, a.y) || a.trail.length;
          const bOut = !isOwnLand(b, b.x, b.y) || b.trail.length;
          if (aOut && bOut) {
            kill(a, "Head-on");
            kill(b, "Head-on");
          }
        }
      }
    }
  }

  function draw() {
    const w = canvas.width;
    const h = canvas.height;
    const cell = w / SIZE;
    ctx.fillStyle = "#071018";
    ctx.fillRect(0, 0, w, h);

    // soft checker
    ctx.fillStyle = "rgba(255,255,255,0.03)";
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        if ((x + y) & 1) ctx.fillRect(x * cell, y * cell, cell, cell);
      }
    }

    // territory
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        const owner = grid[idx(x, y)];
        if (!owner) continue;
        const pid = idFromHash(owner);
        const pl = players.find((p) => p.id === pid);
        const color = COLORS[(pl ? pl.color : owner - 1) % COLORS.length];
        ctx.fillStyle = color.soft;
        ctx.fillRect(x * cell, y * cell, cell + 0.5, cell + 0.5);
      }
    }

    // trails
    for (const p of players) {
      if (!p.alive || !p.trail.length) continue;
      const c = COLORS[p.color % COLORS.length];
      ctx.fillStyle = c.fill;
      for (let i = 0; i < p.trail.length; i += 2) {
        const x = p.trail[i];
        const y = p.trail[i + 1];
        ctx.globalAlpha = 0.85;
        ctx.fillRect(x * cell + cell * 0.15, y * cell + cell * 0.15, cell * 0.7, cell * 0.7);
      }
      ctx.globalAlpha = 1;
    }

    // players
    for (const p of players) {
      if (!p.alive) continue;
      const c = COLORS[p.color % COLORS.length];
      const cx = (p.x + 0.5) * cell;
      const cy = (p.y + 0.5) * cell;
      ctx.fillStyle = c.fill;
      ctx.beginPath();
      ctx.arc(cx, cy, cell * 0.42, 0, Math.PI * 2);
      ctx.fill();
      if (p.id === localId) {
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.font = `bold ${Math.max(10, cell * 0.9)}px Outfit,sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText(p.name.slice(0, 10), cx, cy - cell * 0.7);
    }

    if (performance.now() < deathUntil) {
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      ctx.fillRect(0, h * 0.42, w, h * 0.16);
      ctx.fillStyle = "#ffb4ab";
      ctx.font = "bold 28px Outfit,sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(deathNote, w / 2, h * 0.52);
    }
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

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function loop(ts) {
    if (!running) return;
    animId = requestAnimationFrame(loop);
    if (paused) {
      draw();
      return;
    }
    if (!lastFrame) lastFrame = ts;
    let acc = ts - lastFrame;
    // Cap catch-up
    if (acc > 250) acc = 250;
    while (acc >= TICK_MS) {
      // Online guests don't simulate — host does
      if (mode !== "online" || isHost) tick(performance.now());
      acc -= TICK_MS;
      lastFrame = ts - acc;
    }
    draw();
    updateHud();
  }

  function startNpc(opts) {
    ensureSession();
    localId = opts.localId || playerId();
    const humans = opts.humans || [{ id: localId, name: playerName() }];
    const bots = opts.bots ?? botCount;
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
        "Paint the map like paper.io — claim territory, cut enemy trails, and survive.";
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

  // —— Networking (host-authoritative via Supabase hub_docs) ——
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
    // RLE: "hash:count,hash:count,..."
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
    const out = new Int16Array(SIZE * SIZE);
    let i = 0;
    for (const part of String(rle).split(",")) {
      const [vs, ns] = part.split(":");
      const v = Number(vs) || 0;
      const n = Number(ns) || 0;
      for (let k = 0; k < n && i < out.length; k++) out[i++] = v;
    }
    grid = out;
  }

  function snapshotPlayers() {
    return players.map((p) => ({
      id: p.id,
      name: p.name,
      color: p.color,
      x: p.x,
      y: p.y,
      dir: p.dir,
      nextDir: p.nextDir,
      alive: p.alive,
      human: p.human,
      trail: p.trail.slice(-120),
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
        x: raw.x | 0,
        y: raw.y | 0,
        dir: raw.dir || "right",
        nextDir: raw.nextDir || raw.dir || "right",
        alive: !!raw.alive,
        human: !!raw.human,
        trail: Array.isArray(raw.trail) ? raw.trail.slice() : [],
        respawnAt: raw.respawnAt ? performance.now() + Math.max(0, raw.respawnAt - Date.now()) : 0,
        botThink: 0,
        botTarget: raw.dir || "right"
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
    // Merge guest inputs
    const inputs = doc.inputs || {};
    for (const p of players) {
      if (!p.human || p.id === localId) continue;
      const d = inputs[p.id];
      if (d && DIRS[d]) setDir(p, d);
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
      inputs: { ...(doc.inputs || {}), [localId]: pendingDir || localPlayer()?.nextDir }
    });
  }

  async function pushGuestInput() {
    if (isHost || !roomCode) return;
    const doc = await sbGet(roomDocId(roomCode));
    if (!doc) return;
    await sbPut(roomDocId(roomCode), {
      ...doc,
      updatedAt: Date.now(),
      inputs: { ...(doc.inputs || {}), [localId]: pendingDir || localPlayer()?.nextDir || "right" }
    });
    if (doc.snap) {
      applySnapshot(doc.snap);
      const me = localPlayer();
      if (me && pendingDir) setDir(me, pendingDir);
    }
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
    clearInterval(netPushTimer);
    netPollTimer = 0;
    netPushTimer = 0;
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
    // Register in lobby list for quick play
    try {
      const lobbies = (await sbGet(LOBBY_DOC)) || { rooms: {} };
      lobbies.rooms = lobbies.rooms || {};
      lobbies.rooms[roomCode] = { code: roomCode, hostId: me, status: "waiting", updatedAt: Date.now() };
      // prune old
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
    await sbPut(roomDocId(want), {
      ...doc,
      seats,
      updatedAt: Date.now()
    });
    roomCode = want;
    localId = me;
    isHost = doc.hostId === me;
    lobbyAwaiting = doc.status === "waiting";
    onlineCode.classList.remove("hidden");
    onlineCode.textContent = isHost ? `Room ${roomCode}` : `Joined ${roomCode}`;
    onlineCancelBtn.classList.remove("hidden");
    onlineStatus.textContent = isHost
      ? "You are host. Press Play to start."
      : "Waiting for host to start…";
    startBtn.textContent = isHost ? "Start match" : "Waiting…";
    if (!isHost) watchLobbyStart();
  }

  let lobbyWatch = 0;
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
        await sbPut(roomDocId(roomCode), {
          code: roomCode,
          status: "closed",
          updatedAt: Date.now()
        });
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
    const humans = Object.entries(seats).map(([id, s], i) => ({
      id,
      name: s.name || "Player",
      color: i
    }));
    // Ensure host color assignment sticks
    humans.forEach((h, i) => {
      /* color via index in resetArena */
    });
    const bots = Math.max(0, Math.min(6, MAX_PLAYERS - humans.length));
    localId = playerId();
    startNpc({ localId, humans, bots });
    // fix colors from seats
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
    const dir = keyMap[e.key];
    if (!dir) return;
    e.preventDefault();
    const me = localPlayer();
    if (!me || !running || paused) return;
    setDir(me, dir);
    pendingDir = dir;
  });

  // Touch swipe
  let touchX = 0;
  let touchY = 0;
  canvas.addEventListener(
    "touchstart",
    (e) => {
      const t = e.changedTouches[0];
      touchX = t.clientX;
      touchY = t.clientY;
    },
    { passive: true }
  );
  canvas.addEventListener(
    "touchend",
    (e) => {
      const t = e.changedTouches[0];
      const dx = t.clientX - touchX;
      const dy = t.clientY - touchY;
      if (Math.hypot(dx, dy) < 24) return;
      let dir;
      if (Math.abs(dx) > Math.abs(dy)) dir = dx > 0 ? "right" : "left";
      else dir = dy > 0 ? "down" : "up";
      const me = localPlayer();
      if (!me || !running || paused) return;
      setDir(me, dir);
      pendingDir = dir;
    },
    { passive: true }
  );

  // UI
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
  // Empty preview grid
  ctx.fillStyle = "#071018";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
})();
