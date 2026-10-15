/**
 * Shared all-time roster merge helpers for hub-plays.js.
 */
(function (root) {
  const MAX_ALLTIME = 5000;
  const LAST_AT_WRITE_GAP_MS = 5 * 60_000;

  function preferName(a, b) {
    const left = String(a || "").trim();
    const right = String(b || "").trim();
    if (!left) return right || "Guest";
    return left;
  }

  function resolvePrefer(fn) {
    return typeof fn === "function" ? fn : preferName;
  }

  function parseRemotePlayers(data, opts) {
    const sanitize = typeof opts?.sanitizeName === "function" ? opts.sanitizeName : String;
    const isPurged = typeof opts?.isPurgedPlayer === "function" ? opts.isPurgedPlayer : () => false;
    if (!data || typeof data !== "object") return {};
    const players = data.players && typeof data.players === "object" ? data.players : data;
    const out = {};
    Object.entries(players).forEach(([id, p]) => {
      if (!id || id === "players" || id === "total") return;
      if (!p || typeof p !== "object") return;
      const firstAt = Number(p.firstAt) || Number(p.at) || 0;
      if (!firstAt) return;
      const lastAt = Math.max(Number(p.lastAt) || 0, Number(p.at) || 0, firstAt);
      const name = sanitize(p.name || "") || "Guest";
      if (isPurged(id, name)) return;
      out[id] = { firstAt, lastAt, name };
    });
    return out;
  }

  function parseMilestoneSeed(data) {
    if (!data || typeof data !== "object") return null;
    return {
      count: Math.max(0, Math.floor(Number(data.count) || 0)),
      games: Math.max(0, Math.floor(Number(data.games) || 0)),
      mostPlayed: String(data.mostPlayed || "").trim(),
      achievements: Math.max(0, Math.floor(Number(data.achievements) || 0)),
      note: String(data.note || "").trim()
    };
  }

  function mergeAllTime(a, b, preferPlayerName) {
    const pick = resolvePrefer(preferPlayerName);
    const out = { ...(a || {}) };
    Object.entries(b || {}).forEach(([id, p]) => {
      if (!p) return;
      const existing = out[id];
      const incomingFirst = Number(p.firstAt) || Number(p.at) || 0;
      const incomingLast = Math.max(Number(p.lastAt) || 0, Number(p.at) || 0, incomingFirst);
      if (!existing) {
        out[id] = {
          firstAt: incomingFirst || Date.now(),
          lastAt: incomingLast || incomingFirst || Date.now(),
          name: pick(p.name, "")
        };
        return;
      }
      const firstAt = Math.min(existing.firstAt || Infinity, incomingFirst || Infinity);
      const lastAt = Math.max(
        Number(existing.lastAt) || 0,
        incomingLast || 0,
        Number(existing.firstAt) || 0
      );
      out[id] = {
        firstAt: firstAt === Infinity ? Date.now() : firstAt,
        lastAt: lastAt || (firstAt === Infinity ? Date.now() : firstAt),
        name: pick(existing.name, p.name)
      };
    });
    return out;
  }

  function mergeAllTimePreferRemoteLast(remote, local, preferPlayerName) {
    const pick = resolvePrefer(preferPlayerName);
    const merged = mergeAllTime(remote || {}, local || {}, pick);
    Object.entries(remote || {}).forEach(([id, p]) => {
      if (!merged[id] || !p) return;
      const remoteFirst = Number(p.firstAt) || 0;
      const remoteLast = Math.max(Number(p.lastAt) || 0, remoteFirst);
      const localFirst = Number(merged[id].firstAt) || remoteFirst;
      merged[id] = {
        ...merged[id],
        firstAt:
          Math.min(localFirst || remoteFirst, remoteFirst || localFirst) ||
          remoteFirst ||
          localFirst,
        lastAt: remoteLast || Number(merged[id].lastAt) || remoteFirst || localFirst,
        name: pick(p.name, merged[id].name)
      };
    });
    return merged;
  }

  function clampLastAtForWrite(remote, next, myId, preferPlayerName) {
    const pick = resolvePrefer(preferPlayerName);
    const out = {};
    const me = String(myId || "");
    Object.entries(next || {}).forEach(([id, p]) => {
      if (!p) return;
      const r = remote?.[id];
      const firstAt =
        Math.min(Number(r?.firstAt) || Infinity, Number(p.firstAt) || Infinity) === Infinity
          ? Number(p.firstAt) || Number(r?.firstAt) || Date.now()
          : Math.min(Number(r?.firstAt) || Date.now(), Number(p.firstAt) || Date.now());
      let lastAt;
      if (id === me) {
        lastAt = Math.max(Number(r?.lastAt) || 0, Number(p.lastAt) || 0, firstAt);
      } else if (r) {
        lastAt = Math.max(Number(r.lastAt) || 0, Number(r.firstAt) || 0) || firstAt;
      } else {
        lastAt = Math.max(Number(p.lastAt) || 0, firstAt) || firstAt;
      }
      out[id] = {
        firstAt,
        lastAt,
        name: pick(p.name, r?.name)
      };
    });
    return out;
  }

  function trimAllTime(map, max = MAX_ALLTIME) {
    const entries = Object.entries(map || {});
    const limit = Math.max(1, Number(max) || MAX_ALLTIME);
    if (entries.length <= limit) return map || {};
    entries.sort((a, b) => (a[1].firstAt || 0) - (b[1].firstAt || 0));
    const out = {};
    entries.slice(0, limit).forEach(([id, p]) => {
      out[id] = p;
    });
    return out;
  }

  function allTimeNeedsWrite(remote, next, myId, preferPlayerName, gapMs = LAST_AT_WRITE_GAP_MS) {
    const pick = resolvePrefer(preferPlayerName);
    const remoteKeys = Object.keys(remote || {});
    const nextKeys = Object.keys(next || {});
    const me = String(myId || "");
    if (nextKeys.length < remoteKeys.length) return false;
    if (nextKeys.length !== remoteKeys.length) return true;
    for (const id of nextKeys) {
      if (!remote[id]) return true;
      if (pick(remote[id].name, "") !== pick(next[id].name, "")) return true;
      const remoteFirst = Number(remote[id].firstAt) || 0;
      const nextFirst = Number(next[id].firstAt) || 0;
      if (nextFirst && remoteFirst && nextFirst < remoteFirst) return true;
      if (id === me) {
        const remoteLast = Number(remote[id].lastAt) || 0;
        const nextLast = Number(next[id].lastAt) || 0;
        if (nextLast - remoteLast >= gapMs) return true;
      }
    }
    return false;
  }

  function namesFromPlays(plays, preferPlayerName) {
    const pick = resolvePrefer(preferPlayerName);
    const fromPlays = {};
    (plays || []).forEach((p) => {
      if (!p || !p.playerId) return;
      const prev = fromPlays[p.playerId];
      const at = Number(p.at) || Date.now();
      const firstAt = Math.min(prev?.firstAt || Infinity, at);
      const lastAt = Math.max(prev?.lastAt || 0, at);
      fromPlays[p.playerId] = {
        firstAt: firstAt === Infinity ? at : firstAt,
        lastAt: lastAt || at,
        name: pick(prev?.name, p.name)
      };
    });
    return fromPlays;
  }

  function namesFromRegistry(names, opts) {
    const pick = resolvePrefer(opts?.preferPlayerName);
    const sanitize = typeof opts?.sanitizeName === "function" ? opts.sanitizeName : String;
    const isPlaceholder =
      typeof opts?.isPlaceholderName === "function" ? opts.isPlaceholderName : () => false;
    const out = {};
    Object.values(names || {}).forEach((claim) => {
      if (!claim || !claim.playerId) return;
      const name = sanitize(claim.name || "");
      if (isPlaceholder(name)) return;
      const prev = out[claim.playerId];
      const claimedAt = Number(claim.claimedAt) || Date.now();
      const firstAt = Math.min(prev?.firstAt || Infinity, claimedAt);
      const lastAt = Math.max(prev?.lastAt || 0, claimedAt);
      out[claim.playerId] = {
        firstAt: firstAt === Infinity ? claimedAt : firstAt,
        lastAt: lastAt || claimedAt,
        name: pick(prev?.name, name)
      };
    });
    return out;
  }

  function repairMassStampedLastAt(players, minDupes = 5) {
    const cleaned = {};
    const stampCounts = new Map();
    Object.entries(players || {}).forEach(([id, p]) => {
      if (!p) return;
      const lastAt = Number(p.lastAt) || 0;
      if (lastAt) stampCounts.set(lastAt, (stampCounts.get(lastAt) || 0) + 1);
      cleaned[id] = p;
    });
    const mass = new Set();
    stampCounts.forEach((n, t) => {
      if (n >= minDupes) mass.add(t);
    });
    if (mass.size) {
      Object.keys(cleaned).forEach((id) => {
        const p = cleaned[id];
        const lastAt = Number(p.lastAt) || 0;
        if (!mass.has(lastAt)) return;
        const firstAt = Number(p.firstAt) || lastAt;
        cleaned[id] = { ...p, lastAt: firstAt };
      });
    }
    return cleaned;
  }

  const api = {
    MAX_ALLTIME,
    LAST_AT_WRITE_GAP_MS,
    parseRemotePlayers,
    parseMilestoneSeed,
    mergeAllTime,
    mergeAllTimePreferRemoteLast,
    clampLastAtForWrite,
    trimAllTime,
    allTimeNeedsWrite,
    namesFromPlays,
    namesFromRegistry,
    repairMassStampedLastAt
  };
  if (root) root.HubAllTime = api;
  if (typeof module === "object" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : typeof globalThis !== "undefined" ? globalThis : null);
