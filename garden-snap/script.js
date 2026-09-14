(function () {
  const HIGH_SCORE_KEY = "garden-snap-high-score";
  const PLOT_COUNT = 9;
  const SEASON_SECS = 40;
  const CROPS = [
    { emoji: "🥕", ripe: "🥕", points: 8 },
    { emoji: "🌽", ripe: "🌽", points: 10 },
    { emoji: "🍅", ripe: "🍅", points: 9 },
    { emoji: "🥬", ripe: "🥬", points: 7 },
    { emoji: "🍓", ripe: "🍓", points: 12 }
  ];

  const plotsEl = document.getElementById("plots");
  const scoreEl = document.getElementById("score");
  const highScoreEl = document.getElementById("high-score");
  const seasonEl = document.getElementById("season");
  const timerEl = document.getElementById("timer");
  const overlay = document.getElementById("overlay");
  const overlayTitle = document.getElementById("overlay-title");
  const overlayText = document.getElementById("overlay-text");
  const overlayBest = document.getElementById("overlay-best");
  const startBtn = document.getElementById("start-btn");
  const resumeBtn = document.getElementById("resume-btn");
  const gamesBtn = document.getElementById("games-btn");
  const menuBtn = document.getElementById("menu-btn");
  const toolBtns = [...document.querySelectorAll(".tool")];

  let best = Math.max(0, Math.floor(Number(localStorage.getItem(HIGH_SCORE_KEY)) || 0));
  let score = 0;
  let season = 1;
  let timeLeft = SEASON_SECS;
  let tool = "plant";
  let plots = [];
  let harvests = 0;
  let running = false;
  let paused = false;
  let sessionStarted = false;
  let lastSubmitAt = 0;
  let tick = 0;

  function ensureSession() {
    if (sessionStarted) return;
    sessionStarted = true;
    window.HubPlays?.record?.("garden");
    window.HubStreak?.recordPlay?.();
  }

  function updateHud() {
    if (scoreEl) scoreEl.textContent = String(score);
    if (highScoreEl) highScoreEl.textContent = String(best);
    if (overlayBest) overlayBest.textContent = String(best);
    if (seasonEl) seasonEl.textContent = String(season);
    if (timerEl) timerEl.textContent = String(Math.max(0, Math.ceil(timeLeft)));
  }

  function maybeSubmit(force = false) {
    if (best <= 0 || !window.HubLeaderboard) return;
    const now = Date.now();
    if (!force && now - lastSubmitAt < 4000) return;
    lastSubmitAt = now;
    HubLeaderboard.submit("garden", best).catch?.(() => {});
  }

  function checkAchievements() {
    if (!window.HubAchievements) return;
    if (harvests >= 8 || best >= 40) HubAchievements.unlock("garden_harvest_8");
    if (score >= 60 || best >= 60) HubAchievements.unlock("garden_score_60");
    if (season >= 3) HubAchievements.unlock("garden_season_3");
    if (best >= 150) HubAchievements.unlock("garden_score_150");
  }

  function emptyPlots() {
    plots = Array.from({ length: PLOT_COUNT }, () => ({
      stage: "empty",
      crop: null,
      thirst: 0,
      grow: 0
    }));
  }

  function renderPlots() {
    plotsEl.innerHTML = "";
    plots.forEach((p, i) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "plot" + (p.stage === "ripe" ? " ready" : "");
      let emoji = "";
      let tag = "soil";
      if (p.stage === "seed") {
        emoji = "🌱";
        tag = "seed";
      } else if (p.stage === "growing") {
        emoji = p.crop?.emoji || "🌿";
        tag = p.thirst > 0.55 ? "thirsty" : "growing";
      } else if (p.stage === "ripe") {
        emoji = p.crop?.ripe || "✨";
        tag = "ripe";
      } else if (p.stage === "wilt") {
        emoji = "🥀";
        tag = "wilt";
      }
      btn.innerHTML = `${emoji}<span class="tag">${tag}</span>`;
      btn.addEventListener("click", () => useTool(i));
      plotsEl.appendChild(btn);
    });
  }

  function useTool(i) {
    if (!running || paused) return;
    ensureSession();
    const p = plots[i];
    if (tool === "plant") {
      if (p.stage !== "empty" && p.stage !== "wilt") {
        window.HubSound?.play?.("miss");
        return;
      }
      p.stage = "seed";
      p.crop = CROPS[Math.floor(Math.random() * CROPS.length)];
      p.thirst = 0.35;
      p.grow = 0;
      window.HubSound?.play?.("click");
    } else if (tool === "water") {
      if (p.stage !== "seed" && p.stage !== "growing") {
        window.HubSound?.play?.("miss");
        return;
      }
      p.thirst = Math.max(0, p.thirst - 0.55);
      if (p.stage === "seed") p.stage = "growing";
      window.HubSound?.play?.("click");
    } else if (tool === "harvest") {
      if (p.stage !== "ripe") {
        window.HubSound?.play?.("miss");
        return;
      }
      const gain = (p.crop?.points || 8) + season * 2;
      score += gain;
      harvests += 1;
      p.stage = "empty";
      p.crop = null;
      p.thirst = 0;
      p.grow = 0;
      if (score > best) {
        best = score;
        try {
          localStorage.setItem(HIGH_SCORE_KEY, String(best));
        } catch {}
      }
      window.HubSound?.play?.("win");
      checkAchievements();
    }
    updateHud();
    renderPlots();
  }

  function endSeason(final = false) {
    if (final) {
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
      if (score >= 80) window.HubConfetti?.burst?.();
      if (overlayTitle) overlayTitle.textContent = "Harvest done";
      if (overlayText) {
        overlayText.textContent = `Season ${season} finished. Score ${score}. Best ${best}.`;
      }
      resumeBtn?.classList.add("hidden");
      overlay?.classList.remove("hidden");
      return;
    }
    season += 1;
    timeLeft = Math.max(28, SEASON_SECS - (season - 1) * 3);
    emptyPlots();
    checkAchievements();
    updateHud();
    renderPlots();
  }

  function startGame() {
    ensureSession();
    score = 0;
    season = 1;
    harvests = 0;
    timeLeft = SEASON_SECS;
    tool = "plant";
    toolBtns.forEach((b) => b.classList.toggle("active", b.dataset.tool === tool));
    emptyPlots();
    running = true;
    paused = false;
    updateHud();
    renderPlots();
    overlay?.classList.add("hidden");
    resumeBtn?.classList.add("hidden");
    clearInterval(tick);
    tick = setInterval(() => {
      if (!running || paused) return;
      timeLeft -= 0.1;
      plots.forEach((p) => {
        if (p.stage === "seed" || p.stage === "growing") {
          p.thirst += 0.018 + season * 0.002;
          if (p.thirst < 0.7) p.grow += 0.028;
          if (p.thirst >= 1.15) p.stage = "wilt";
          else if (p.grow >= 1 && p.stage === "growing") p.stage = "ripe";
        }
      });
      if (timeLeft <= 0) {
        if (season >= 4) endSeason(true);
        else endSeason(false);
        return;
      }
      updateHud();
      renderPlots();
    }, 100);
  }

  function togglePause() {
    if (!running) {
      overlay?.classList.remove("hidden");
      if (overlayTitle) overlayTitle.textContent = "Garden Snap";
      if (overlayText) {
        overlayText.textContent = "Race through short seasons — plant, water, and harvest for points.";
      }
      resumeBtn?.classList.add("hidden");
      return;
    }
    paused = !paused;
    if (paused) {
      if (overlayTitle) overlayTitle.textContent = "Paused";
      if (overlayText) overlayText.textContent = "Sun can wait. Resume when you’re ready to dig in.";
      resumeBtn?.classList.remove("hidden");
      overlay?.classList.remove("hidden");
    } else {
      overlay?.classList.add("hidden");
    }
  }

  toolBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      tool = btn.dataset.tool;
      toolBtns.forEach((b) => b.classList.toggle("active", b === btn));
    });
  });
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
      if (overlayText) overlayText.textContent = "Sun can wait. Resume when you’re ready to dig in.";
      resumeBtn?.classList.remove("hidden");
      overlay?.classList.remove("hidden");
    }
  });

  emptyPlots();
  renderPlots();
  updateHud();
  maybeSubmit(false);
})();
