(function () {
  const HIGH_SCORE_KEY = "cafe-queue-high-score";
  const ITEMS = [
    { id: "coffee", emoji: "☕", name: "Coffee" },
    { id: "tea", emoji: "🍵", name: "Tea" },
    { id: "pastry", emoji: "🥐", name: "Pastry" },
    { id: "cake", emoji: "🍰", name: "Cake" },
    { id: "juice", emoji: "🧃", name: "Juice" },
    { id: "cookie", emoji: "🍪", name: "Cookie" }
  ];
  const FACES = ["😀", "😎", "🤓", "😊", "🙂", "🤗", "😺"];

  const queueEl = document.getElementById("queue");
  const menuEl = document.getElementById("menu");
  const scoreEl = document.getElementById("score");
  const highScoreEl = document.getElementById("high-score");
  const servedEl = document.getElementById("served");
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
  let served = 0;
  let combo = 0;
  let lives = 3;
  let queue = [];
  let running = false;
  let paused = false;
  let sessionStarted = false;
  let lastSubmitAt = 0;
  let tick = 0;
  let spawnAcc = 0;

  function ensureSession() {
    if (sessionStarted) return;
    sessionStarted = true;
    window.HubPlays?.record?.("cafe");
    window.HubStreak?.recordPlay?.();
  }

  function updateHud() {
    if (scoreEl) scoreEl.textContent = String(score);
    if (highScoreEl) highScoreEl.textContent = String(best);
    if (overlayBest) overlayBest.textContent = String(best);
    if (servedEl) servedEl.textContent = String(served);
    if (comboEl) comboEl.textContent = String(combo);
  }

  function maybeSubmit(force = false) {
    if (best <= 0 || !window.HubLeaderboard) return;
    const now = Date.now();
    if (!force && now - lastSubmitAt < 4000) return;
    lastSubmitAt = now;
    HubLeaderboard.submit("cafe", best).catch?.(() => {});
  }

  function checkAchievements() {
    if (!window.HubAchievements) return;
    if (served >= 10 || best >= 40) HubAchievements.unlock("cafe_serve_10");
    if (score >= 80 || best >= 80) HubAchievements.unlock("cafe_score_80");
    if (combo >= 5) HubAchievements.unlock("cafe_combo_5");
    if (best >= 200) HubAchievements.unlock("cafe_score_200");
  }

  function buildMenu() {
    menuEl.innerHTML = "";
    ITEMS.forEach((item) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "item-btn";
      btn.innerHTML = `<span class="emoji">${item.emoji}</span><span>${item.name}</span>`;
      btn.addEventListener("click", () => serve(item.id));
      menuEl.appendChild(btn);
    });
  }

  function makeGuest() {
    const item = ITEMS[Math.floor(Math.random() * ITEMS.length)];
    return {
      id: `${Date.now()}-${Math.random()}`,
      face: FACES[Math.floor(Math.random() * FACES.length)],
      orderId: item.id,
      orderEmoji: item.emoji,
      patience: 1,
      decay: 0.009 + Math.min(0.006, score * 0.000035)
    };
  }

  function renderQueue() {
    queueEl.innerHTML = "";
    queue.forEach((g, i) => {
      const card = document.createElement("div");
      card.className = "guest" + (i === 0 ? " active" : "");
      card.innerHTML = `
        <div class="guest-face">${g.face}</div>
        <div class="guest-order">${g.orderEmoji}</div>
        <div class="guest-bar"><span style="transform:scaleX(${Math.max(0, g.patience)})"></span></div>
      `;
      queueEl.appendChild(card);
    });
  }

  function serve(itemId) {
    if (!running || paused || !queue.length) return;
    ensureSession();
    const guest = queue[0];
    if (guest.orderId !== itemId) {
      combo = 0;
      lives -= 1;
      window.HubSound?.play?.("miss");
      updateHud();
      if (lives <= 0) endShift("Too many wrong tickets.");
      return;
    }
    const perfect = guest.patience > 0.55;
    const tip = 8 + Math.floor(combo * 2) + (perfect ? 6 : 0);
    score += tip;
    served += 1;
    combo = perfect ? combo + 1 : Math.max(0, combo);
    queue.shift();
    if (score > best) {
      best = score;
      try {
        localStorage.setItem(HIGH_SCORE_KEY, String(best));
      } catch {}
    }
    window.HubSound?.play?.("click");
    checkAchievements();
    updateHud();
    renderQueue();
  }

  function endShift(reason) {
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
    if (score >= 100) window.HubConfetti?.burst?.();
    if (overlayTitle) overlayTitle.textContent = "Cafe closed";
    if (overlayText) overlayText.textContent = `${reason} Score ${score}. Served ${served}. Best ${best}.`;
    resumeBtn?.classList.add("hidden");
    overlay?.classList.remove("hidden");
  }

  function startShift() {
    ensureSession();
    score = 0;
    served = 0;
    combo = 0;
    lives = 3;
    spawnAcc = 0;
    queue = [makeGuest(), makeGuest()];
    running = true;
    paused = false;
    updateHud();
    renderQueue();
    overlay?.classList.add("hidden");
    resumeBtn?.classList.add("hidden");
    clearInterval(tick);
    tick = setInterval(() => {
      if (!running || paused) return;
      queue.forEach((g) => {
        g.patience -= g.decay;
      });
      if (queue.length && queue[0].patience <= 0) {
        queue.shift();
        combo = 0;
        lives -= 1;
        window.HubSound?.play?.("miss");
        if (lives <= 0) {
          endShift("A guest walked out angry.");
          return;
        }
      }
      spawnAcc += 1;
      if (spawnAcc >= Math.max(6, 12 - Math.floor(score / 40)) && queue.length < 5) {
        spawnAcc = 0;
        queue.push(makeGuest());
      }
      updateHud();
      renderQueue();
    }, 100);
  }

  function togglePause() {
    if (!running) {
      overlay?.classList.remove("hidden");
      if (overlayTitle) overlayTitle.textContent = "Cafe Queue";
      if (overlayText) {
        overlayText.textContent =
          "Serve drinks and snacks as the line grows. Keep combos alive for bigger tips.";
      }
      resumeBtn?.classList.add("hidden");
      return;
    }
    paused = !paused;
    if (paused) {
      if (overlayTitle) overlayTitle.textContent = "Paused";
      if (overlayText) overlayText.textContent = "Break time. Resume when the espresso’s ready.";
      resumeBtn?.classList.remove("hidden");
      overlay?.classList.remove("hidden");
    } else {
      overlay?.classList.add("hidden");
    }
  }

  startBtn?.addEventListener("click", startShift);
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
      if (overlayText) overlayText.textContent = "Break time. Resume when the espresso’s ready.";
      resumeBtn?.classList.remove("hidden");
      overlay?.classList.remove("hidden");
    }
  });

  buildMenu();
  updateHud();
  maybeSubmit(false);
})();
