(function () {
  const HIGH_SCORE_KEY = "bubble-pop-high-score";
  const COLS = 8;
  const ROWS = 12;
  const COLORS = 5;

  const boardEl = document.getElementById("board");
  const dangerEl = document.getElementById("danger");
  const scoreEl = document.getElementById("score");
  const highScoreEl = document.getElementById("high-score");
  const clearedEl = document.getElementById("cleared");
  const overlay = document.getElementById("overlay");
  const overlayTitle = document.getElementById("overlay-title");
  const overlayText = document.getElementById("overlay-text");
  const overlayBest = document.getElementById("overlay-best");
  const startBtn = document.getElementById("start-btn");
  const resumeBtn = document.getElementById("resume-btn");
  const gamesBtn = document.getElementById("games-btn");
  const menuBtn = document.getElementById("menu-btn");

  let best = Math.max(0, Math.floor(Number(localStorage.getItem(HIGH_SCORE_KEY)) || 0));
  let score = 0;
  let cleared = 0;
  let grid = [];
  let rise = 0;
  let running = false;
  let paused = false;
  let sessionStarted = false;
  let lastSubmitAt = 0;
  let tick = 0;
  let spawnAcc = 0;

  function ensureSession() {
    if (sessionStarted) return;
    sessionStarted = true;
    window.HubPlays?.record?.("bubble");
    window.HubStreak?.recordPlay?.();
  }

  function updateHud() {
    if (scoreEl) scoreEl.textContent = String(score);
    if (highScoreEl) highScoreEl.textContent = String(best);
    if (overlayBest) overlayBest.textContent = String(best);
    if (clearedEl) clearedEl.textContent = String(cleared);
    if (dangerEl) dangerEl.style.height = `${8 + rise * 6}%`;
  }

  function maybeSubmit(force = false) {
    if (best <= 0 || !window.HubLeaderboard) return;
    const now = Date.now();
    if (!force && now - lastSubmitAt < 4000) return;
    lastSubmitAt = now;
    HubLeaderboard.submit("bubble", best).catch?.(() => {});
  }

  function checkAchievements() {
    if (!window.HubAchievements) return;
    if (score >= 50 || best >= 50) HubAchievements.unlock("bubble_score_50");
    if (score >= 150 || best >= 150) HubAchievements.unlock("bubble_score_150");
    if (cleared >= 40) HubAchievements.unlock("bubble_clear_40");
    if (best >= 300) HubAchievements.unlock("bubble_score_300");
  }

  function emptyGrid() {
    grid = Array.from({ length: ROWS }, () => Array(COLS).fill(-1));
  }

  function randColor() {
    return Math.floor(Math.random() * COLORS);
  }

  function dropInColumn(c, color) {
    for (let r = ROWS - 1; r >= 0; r -= 1) {
      if (grid[r][c] < 0) {
        grid[r][c] = color;
        return true;
      }
    }
    return false;
  }

  function seedBoard() {
    emptyGrid();
    for (let i = 0; i < 28; i += 1) {
      dropInColumn(Math.floor(Math.random() * COLS), randColor());
    }
  }

  function neighbors(r, c) {
    return [
      [r - 1, c],
      [r + 1, c],
      [r, c - 1],
      [r, c + 1]
    ].filter(([rr, cc]) => rr >= 0 && rr < ROWS && cc >= 0 && cc < COLS);
  }

  function flood(r, c) {
    const color = grid[r][c];
    if (color < 0) return [];
    const seen = new Set();
    const out = [];
    const stack = [[r, c]];
    while (stack.length) {
      const [cr, cc] = stack.pop();
      const key = cr * COLS + cc;
      if (seen.has(key)) continue;
      if (grid[cr][cc] !== color) continue;
      seen.add(key);
      out.push([cr, cc]);
      neighbors(cr, cc).forEach(([nr, nc]) => stack.push([nr, nc]));
    }
    return out;
  }

  function gravity() {
    for (let c = 0; c < COLS; c += 1) {
      const stack = [];
      for (let r = ROWS - 1; r >= 0; r -= 1) {
        if (grid[r][c] >= 0) stack.push(grid[r][c]);
      }
      for (let r = ROWS - 1; r >= 0; r -= 1) {
        grid[r][c] = stack.length ? stack.shift() : -1;
      }
    }
  }

  function renderBoard() {
    boardEl.innerHTML = "";
    for (let r = 0; r < ROWS; r += 1) {
      for (let c = 0; c < COLS; c += 1) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "cell";
        const color = grid[r][c];
        if (color >= 0) {
          const bub = document.createElement("div");
          bub.className = `bubble c${color}`;
          btn.appendChild(bub);
          btn.addEventListener("pointerdown", (e) => {
            e.preventDefault();
            popAt(r, c);
          });
        } else {
          btn.disabled = true;
        }
        boardEl.appendChild(btn);
      }
    }
  }

  function popAt(r, c) {
    if (!running || paused) return;
    ensureSession();
    const group = flood(r, c);
    if (group.length < 2) {
      window.HubSound?.play?.("miss");
      return;
    }
    group.forEach(([rr, cc]) => {
      grid[rr][cc] = -1;
    });
    const gain = group.length * group.length;
    score += gain;
    cleared += group.length;
    rise = Math.max(0, rise - group.length * 0.035);
    if (score > best) {
      best = score;
      try {
        localStorage.setItem(HIGH_SCORE_KEY, String(best));
      } catch {}
    }
    window.HubSound?.play?.("click");
    gravity();
    checkAchievements();
    updateHud();
    renderBoard();
  }

  function topOccupied() {
    return grid[0].some((v) => v >= 0);
  }

  function endGame(reason) {
    running = false;
    paused = false;
    clearInterval(tick);
    tick = 0;
    if (score > best) {
      best = score;
      try {
        localStorage.setItem(HIGH_SCORE_KEY, String(best));
      } catch {}
    }
    checkAchievements();
    maybeSubmit(true);
    updateHud();
    if (score >= 120) window.HubConfetti?.burst?.();
    if (overlayTitle) overlayTitle.textContent = "Tank flooded";
    if (overlayText) overlayText.textContent = `${reason} Score ${score}. Best ${best}.`;
    resumeBtn?.classList.add("hidden");
    overlay?.classList.remove("hidden");
  }

  function startGame() {
    ensureSession();
    score = 0;
    cleared = 0;
    rise = 0;
    spawnAcc = 0;
    running = true;
    paused = false;
    seedBoard();
    updateHud();
    renderBoard();
    overlay?.classList.add("hidden");
    resumeBtn?.classList.add("hidden");
    clearInterval(tick);
    tick = setInterval(() => {
      if (!running || paused) return;
      rise += 0.012 + score * 0.00002;
      spawnAcc += 1;
      if (spawnAcc >= Math.max(4, 9 - Math.floor(score / 80))) {
        spawnAcc = 0;
        const ok = dropInColumn(Math.floor(Math.random() * COLS), randColor());
        if (!ok || topOccupied() || rise >= 1) {
          endGame(rise >= 1 ? "The tide won." : "Bubbles reached the top.");
          return;
        }
        gravity();
        renderBoard();
      }
      updateHud();
      if (rise >= 1) endGame("The tide won.");
    }, 420);
  }

  function togglePause() {
    if (!running) {
      overlay?.classList.remove("hidden");
      if (overlayTitle) overlayTitle.textContent = "Bubble Pop Relay";
      if (overlayText) {
        overlayText.textContent = "Pop matching clusters before the rising line swallows the tank.";
      }
      resumeBtn?.classList.add("hidden");
      return;
    }
    paused = !paused;
    if (paused) {
      if (overlayTitle) overlayTitle.textContent = "Paused";
      if (overlayText) overlayText.textContent = "Bubbles can wait. Resume when ready.";
      resumeBtn?.classList.remove("hidden");
      overlay?.classList.remove("hidden");
    } else {
      overlay?.classList.add("hidden");
    }
  }

  startBtn?.addEventListener("click", startGame);
  resumeBtn?.addEventListener("click", () => {
    if (!running) return;
    paused = false;
    overlay?.classList.add("hidden");
  });
  menuBtn?.addEventListener("click", togglePause);
  gamesBtn?.addEventListener("click", () => {
    window.location.href = "../index.html";
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && running && !paused) {
      paused = true;
      if (overlayTitle) overlayTitle.textContent = "Paused";
      if (overlayText) overlayText.textContent = "Bubbles can wait. Resume when ready.";
      resumeBtn?.classList.remove("hidden");
      overlay?.classList.remove("hidden");
    }
  });

  updateHud();
  maybeSubmit(false);
})();
