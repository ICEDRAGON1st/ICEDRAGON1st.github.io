(function () {
  const HIGH_SCORE_KEY = "guac-a-mole-high-score";
  const ROUND_SECS = 45;
  const HOLE_COUNT = 9;

  const board = document.getElementById("board");
  const scoreEl = document.getElementById("score");
  const highScoreEl = document.getElementById("high-score");
  const timerEl = document.getElementById("timer");
  const comboEl = document.getElementById("combo");
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
  let combo = 0;
  let timeLeft = ROUND_SECS;
  let running = false;
  let paused = false;
  let sessionStarted = false;
  let lastSubmitAt = 0;
  let spawnTimer = 0;
  let tickTimer = 0;
  let holes = [];

  function ensureSession() {
    if (sessionStarted) return;
    sessionStarted = true;
    window.HubPlays?.record?.("guac");
    window.HubStreak?.recordPlay?.();
  }

  function updateHud() {
    if (scoreEl) scoreEl.textContent = String(score);
    if (highScoreEl) highScoreEl.textContent = String(best);
    if (overlayBest) overlayBest.textContent = String(best);
    if (timerEl) timerEl.textContent = String(Math.max(0, Math.ceil(timeLeft)));
    if (comboEl) comboEl.textContent = String(combo);
  }

  function maybeSubmit(force = false) {
    if (best <= 0 || !window.HubLeaderboard) return;
    const now = Date.now();
    if (!force && now - lastSubmitAt < 4000) return;
    lastSubmitAt = now;
    HubLeaderboard.submit("guac", best).catch?.(() => {});
  }

  function checkAchievements() {
    if (!window.HubAchievements) return;
    if (score >= 10 || best >= 10) HubAchievements.unlock("guac_score_10");
    if (score >= 30 || best >= 30) HubAchievements.unlock("guac_score_30");
    if (score >= 60 || best >= 60) HubAchievements.unlock("guac_score_60");
    if (combo >= 5) HubAchievements.unlock("guac_combo_5");
    if (best >= 100) HubAchievements.unlock("guac_score_100");
  }

  function buildBoard() {
    board.innerHTML = "";
    holes = [];
    for (let i = 0; i < HOLE_COUNT; i += 1) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "hole";
      btn.setAttribute("aria-label", `Hole ${i + 1}`);
      btn.innerHTML = `
        <div class="avocado" aria-hidden="true">
          <div class="avo-body">
            <div class="avo-flesh"></div>
            <div class="avo-pit"></div>
          </div>
        </div>
        <div class="hole-bowl" aria-hidden="true"></div>
        <span class="smash-burst" aria-hidden="true"></span>
      `;
      const hole = {
        el: btn,
        up: false,
        rotten: false,
        hideAt: 0,
        burstEl: btn.querySelector(".smash-burst")
      };
      btn.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        whack(hole);
      });
      holes.push(hole);
      board.appendChild(btn);
    }
  }

  function hideHole(hole) {
    hole.up = false;
    hole.rotten = false;
    hole.hideAt = 0;
    hole.el.classList.remove("up", "rotten", "hit");
  }

  function showHole(hole, rotten) {
    hole.up = true;
    hole.rotten = !!rotten;
    const stay = Math.max(750, 1350 - score * 6 + Math.random() * 280);
    hole.hideAt = performance.now() + stay;
    hole.el.classList.toggle("rotten", hole.rotten);
    hole.el.classList.remove("hit", "burst");
    hole.el.classList.add("up");
  }

  function spawnOne() {
    const upCount = holes.filter((h) => h.up).length;
    if (upCount >= 2) return;
    const free = holes.filter((h) => !h.up);
    if (!free.length) return;
    const hole = free[Math.floor(Math.random() * free.length)];
    const rottenChance = Math.min(0.28, 0.08 + score * 0.0025);
    showHole(hole, Math.random() < rottenChance);
  }

  function whack(hole) {
    if (!running || paused || !hole.up) return;
    ensureSession();
    const rotten = hole.rotten;
    hole.el.classList.add("hit");
    hole.up = false;
    hole.hideAt = 0;

    if (rotten) {
      combo = 0;
      score = Math.max(0, score - 2);
      if (hole.burstEl) hole.burstEl.textContent = "Ew!";
      hole.el.classList.add("burst");
      window.HubSound?.play?.("miss");
      setTimeout(() => {
        hole.el.classList.remove("up", "hit", "rotten", "burst");
      }, 160);
      updateHud();
      return;
    }

    const gain = 1 + Math.min(4, Math.floor(combo / 3));
    combo += 1;
    score += gain;
    if (hole.burstEl) hole.burstEl.textContent = `+${gain}`;
    hole.el.classList.add("burst");
    window.HubSound?.play?.("click");
    setTimeout(() => {
      hole.el.classList.remove("up", "hit", "rotten", "burst");
    }, 160);

    if (score > best) {
      best = score;
      try {
        localStorage.setItem(HIGH_SCORE_KEY, String(best));
      } catch {}
    }
    checkAchievements();
    updateHud();
  }

  function endRound() {
    running = false;
    paused = false;
    clearInterval(spawnTimer);
    clearInterval(tickTimer);
    spawnTimer = 0;
    tickTimer = 0;
    holes.forEach(hideHole);
    if (score > best) {
      best = score;
      try {
        localStorage.setItem(HIGH_SCORE_KEY, String(best));
      } catch {}
    }
    checkAchievements();
    maybeSubmit(true);
    updateHud();
    if (score >= 40) window.HubConfetti?.burst?.();
    if (overlayTitle) overlayTitle.textContent = "Guac's done";
    if (overlayText) {
      overlayText.textContent = `You mashed ${score} points of avocado. Best ${best}.`;
    }
    resumeBtn?.classList.add("hidden");
    overlay?.classList.remove("hidden");
  }

  function tickHoles(now) {
    for (const hole of holes) {
      if (hole.up && now >= hole.hideAt) {
        if (!hole.rotten) combo = 0;
        hideHole(hole);
        updateHud();
      }
    }
  }

  function startRound() {
    ensureSession();
    score = 0;
    combo = 0;
    timeLeft = ROUND_SECS;
    running = true;
    paused = false;
    holes.forEach(hideHole);
    updateHud();
    overlay?.classList.add("hidden");
    resumeBtn?.classList.add("hidden");

    clearInterval(spawnTimer);
    clearInterval(tickTimer);
    spawnTimer = setInterval(() => {
      if (!running || paused) return;
      const upCount = holes.filter((h) => h.up).length;
      if (upCount === 0) spawnOne();
      else if (upCount === 1 && score > 45 && Math.random() < 0.14) spawnOne();
    }, 900);
    tickTimer = setInterval(() => {
      if (!running || paused) return;
      tickHoles(performance.now());
      timeLeft -= 0.1;
      if (timeLeft <= 0) {
        timeLeft = 0;
        updateHud();
        endRound();
        return;
      }
      updateHud();
    }, 100);
  }

  function togglePause() {
    if (!running) {
      overlay?.classList.remove("hidden");
      if (overlayTitle) overlayTitle.textContent = "Guac-A-Mole";
      if (overlayText) {
        overlayText.textContent =
          "Avocados pop from the dirt bowls. Whack the ripe ones for points — leave the brown ones alone.";
      }
      resumeBtn?.classList.add("hidden");
      return;
    }
    paused = !paused;
    if (paused) {
      if (overlayTitle) overlayTitle.textContent = "Paused";
      if (overlayText) overlayText.textContent = "Kitchen break. Resume when you're ready to smash more guac.";
      resumeBtn?.classList.remove("hidden");
      overlay?.classList.remove("hidden");
    } else {
      overlay?.classList.add("hidden");
    }
  }

  startBtn?.addEventListener("click", startRound);
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
      if (overlayText) overlayText.textContent = "Kitchen break. Resume when you're ready to smash more guac.";
      resumeBtn?.classList.remove("hidden");
      overlay?.classList.remove("hidden");
    }
  });

  buildBoard();
  updateHud();
  maybeSubmit(false);
})();
