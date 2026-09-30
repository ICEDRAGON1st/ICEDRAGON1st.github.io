(function () {
  const STORAGE_KEY = "hub-daily-streak";
  const STREAK_WINDOW_MS = 48 * 60 * 60 * 1000;
  /** One-time streak restores for specific players (achievements stay separate). */
  const NAME_STREAK_SET = {
    hjalte: { streak: 2, version: "set-2-v1" },
    ice_dragon: { streak: 28, version: "set-28-v3" }
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
    try {
      window.HubAccountBag?.snapshot?.();
    } catch {}
  }

  function effectiveStreak(data) {
    if (!data.lastPlayedAt || !isWithinStreakWindow(data.lastPlayedAt)) return 0;
    return data.streak;
  }

  function grantFlag(key, grant) {
    return `hub-streak-name-set-${key}-${grant.version}`;
  }

  /**
   * Restore a named player's streak. Survives account-bag soft sync wiping the value:
   * if storage looks wiped/broken after a grant, re-apply; if it expired for real after
   * a successful restore, leave it alone.
   */
  function applyNameStreakSet(opts = {}) {
    const key = currentNameKey();
    const grant = NAME_STREAK_SET[key];
    if (!grant) return false;
    const flag = grantFlag(key, grant);
    let marked = false;
    try {
      marked = localStorage.getItem(flag) === "1";
    } catch {
      marked = false;
    }

    const data = load();
    const streak = Number(data.streak) || 0;
    const within = isWithinStreakWindow(data.lastPlayedAt);
    const healthy = streak >= grant.streak && within;

    if (healthy) {
      try {
        localStorage.setItem(flag, "1");
      } catch {}
      return false;
    }

    // Legitimate post-restore life: they have an active streak below the grant
    if (marked && !opts.force && within && streak >= 1 && streak < grant.streak) {
      return false;
    }

    // Legitimate expiry after a successful restore (still holds the old count, window gone)
    if (
      marked &&
      !opts.force &&
      !within &&
      streak >= grant.streak
    ) {
      return false;
    }

    data.streak = grant.streak;
    data.lastDate = todayLocal();
    data.lastPlayedAt = Date.now();
    data.best = Math.max(Number(data.best) || 0, grant.streak);
    save(data);
    try {
      localStorage.setItem(flag, "1");
    } catch {}
    try {
      document.dispatchEvent(
        new CustomEvent("hub-streak-restored", {
          detail: { name: key, streak: grant.streak }
        })
      );
    } catch {}
    return true;
  }

  function recordPlay() {
    applyNameStreakSet();
    const today = todayLocal();
    const now = Date.now();
    const data = load();

    if (data.lastDate === today && isWithinStreakWindow(data.lastPlayedAt)) {
      data.lastPlayedAt = now;
      save(data);
      applyNameStreakSet();
      const finalOk = load();
      return {
        streak: finalOk.streak,
        extended: false,
        best: finalOk.best,
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
    // If a name-grant should still win (e.g. wiped to 1 by bag), put it back
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
      hoursLeft:
        data.lastPlayedAt && isWithinStreakWindow(data.lastPlayedAt)
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

  function refreshFromHub() {
    const changed = applyNameStreakSet({ force: false });
    try {
      if (changed) document.dispatchEvent(new CustomEvent("hub-streak-changed"));
    } catch {}
    return getStatus();
  }

  window.HubStreak = {
    recordPlay,
    getStatus,
    clearCelebration,
    refreshFromHub,
    applyNameStreakSet,
    effectiveStreak: () => {
      applyNameStreakSet();
      return effectiveStreak(load());
    }
  };

  function onHubIdentityReady() {
    refreshFromHub();
    try {
      if (typeof window.renderDailyStreak === "function") window.renderDailyStreak();
    } catch {}
  }

  document.addEventListener("hub-username-ready", onHubIdentityReady);
  document.addEventListener("hub-player-changed", onHubIdentityReady);
  document.addEventListener("hub-account-bag-applied", () => {
    // Bag soft-sync often restores a stale/zero streak after a grant — re-check
    setTimeout(onHubIdentityReady, 0);
    setTimeout(onHubIdentityReady, 400);
    setTimeout(onHubIdentityReady, 1500);
  });
  setTimeout(onHubIdentityReady, 300);
  setTimeout(onHubIdentityReady, 1200);
  setTimeout(onHubIdentityReady, 3000);
})();
