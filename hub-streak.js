(function () {
  const STORAGE_KEY = "hub-daily-streak";
  const STREAK_WINDOW_MS = 48 * 60 * 60 * 1000;
  /** One-time streak values for specific players (achievements stay separate). */
  const NAME_STREAK_SET = {
    hjalte: { streak: 2, version: "set-2-v1" }
  };

  function todayLocal() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  function parseLocalDate(str) {
    const [y, m, day] = str.split("-").map(Number);
    return new Date(y, m - 1, day);
  }

  function isWithinStreakWindow(timestamp) {
    if (!timestamp) return false;
    return Date.now() - timestamp < STREAK_WINDOW_MS;
  }

  function currentNameKey() {
    try {
      if (typeof HubPlays === "undefined" || !HubPlays.getName) return "";
      return String(HubPlays.getName() || "")
        .trim()
        .toLowerCase();
    } catch {
      return "";
    }
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return { streak: 0, lastDate: null, lastPlayedAt: null, best: 0, celebrate: false };
      }
      const data = JSON.parse(raw);
      const lastDate = data.lastDate || null;
      let lastPlayedAt = Number(data.lastPlayedAt) || null;
      if (!lastPlayedAt && lastDate) {
        lastPlayedAt = parseLocalDate(lastDate).getTime() + 12 * 60 * 60 * 1000;
      }
      return {
        streak: Number(data.streak) || 0,
        lastDate,
        lastPlayedAt,
        best: Number(data.best) || 0,
        celebrate: !!data.celebrate
      };
    } catch {
      return { streak: 0, lastDate: null, lastPlayedAt: null, best: 0, celebrate: false };
    }
  }

  function save(data) {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        streak: data.streak,
        lastDate: data.lastDate,
        lastPlayedAt: data.lastPlayedAt,
        best: data.best,
        celebrate: !!data.celebrate
      })
    );
  }

  function effectiveStreak(data) {
    if (!data.lastPlayedAt || !isWithinStreakWindow(data.lastPlayedAt)) return 0;
    return data.streak;
  }

  function applyNameStreakSet() {
    const key = currentNameKey();
    const grant = NAME_STREAK_SET[key];
    if (!grant) return;
    const flag = `hub-streak-name-set-${key}-${grant.version}`;
    try {
      if (localStorage.getItem(flag)) return;
    } catch {
      return;
    }
    const data = load();
    data.streak = grant.streak;
    data.lastDate = todayLocal();
    data.lastPlayedAt = Date.now();
    data.best = Math.max(Number(data.best) || 0, grant.streak);
    save(data);
    try {
      localStorage.setItem(flag, "1");
    } catch {}
  }

  function recordPlay() {
    applyNameStreakSet();
    const today = todayLocal();
    const now = Date.now();
    const data = load();

    if (data.lastDate === today && isWithinStreakWindow(data.lastPlayedAt)) {
      data.lastPlayedAt = now;
      save(data);
      return {
        streak: data.streak,
        extended: false,
        best: data.best,
        playedToday: true
      };
    }

    let extended = false;
    if (!data.lastPlayedAt || !isWithinStreakWindow(data.lastPlayedAt)) {
      data.streak = 1;
      extended = true;
    } else if (data.lastDate !== today) {
      data.streak += 1;
      extended = true;
    }

    data.lastDate = today;
    data.lastPlayedAt = now;
    data.best = Math.max(data.best, data.streak);
    if (extended) data.celebrate = true;
    save(data);
    applyNameStreakSet();

    const finalData = load();
    return {
      streak: finalData.streak,
      extended,
      best: finalData.best,
      playedToday: true
    };
  }

  function getStatus() {
    applyNameStreakSet();
    const data = load();
    return {
      streak: effectiveStreak(data),
      best: data.best,
      playedToday: data.lastDate === todayLocal(),
      celebrate: data.celebrate,
      hoursLeft: data.lastPlayedAt && isWithinStreakWindow(data.lastPlayedAt)
        ? Math.max(0, (STREAK_WINDOW_MS - (Date.now() - data.lastPlayedAt)) / (60 * 60 * 1000))
        : 0
    };
  }

  function clearCelebration() {
    const data = load();
    if (!data.celebrate) return;
    data.celebrate = false;
    save(data);
  }

  window.HubStreak = {
    recordPlay,
    getStatus,
    clearCelebration,
    effectiveStreak: () => {
      applyNameStreakSet();
      return effectiveStreak(load());
    }
  };
})();
