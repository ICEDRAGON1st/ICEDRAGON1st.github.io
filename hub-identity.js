/**
 * Shared player name/code helpers for hub-plays.js.
 */
(function (root) {
  const CODE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

  function sanitizeName(raw) {
    let s = String(raw ?? "")
      .replace(/[<>&"'`]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 16);
    const lower = s.toLowerCase();
    if (!s || lower === "undefined" || lower === "null" || lower === "nan") return "";
    return s;
  }

  function nameKey(name) {
    return sanitizeName(name).toLowerCase();
  }

  function makeId() {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function normalizePlayerCode(raw) {
    return String(raw ?? "")
      .toUpperCase()
      .replace(/[^23456789ABCDEFGHJKLMNPQRSTUVWXYZ]/g, "")
      .slice(0, 8);
  }

  function isPoisonPlayerCode(raw) {
    const asStr = String(raw ?? "")
      .trim()
      .toLowerCase()
      .replace(/-/g, "");
    if (!asStr) return false;
    if (asStr === "undefined" || asStr === "null" || asStr === "nan") return true;
    if (asStr === "undefned" || asStr === "undefine") return true;
    const norm = normalizePlayerCode(raw);
    if (!norm) return false;
    if (norm === normalizePlayerCode("undefined")) return true;
    if (norm.length === 8 && norm === "UNDEFNED") return true;
    return false;
  }

  function formatPlayerCode(norm) {
    if (norm == null || norm === "") return "";
    if (isPoisonPlayerCode(norm)) return "";
    const n = normalizePlayerCode(norm);
    if (n.length !== 8) return n;
    return `${n.slice(0, 4)}-${n.slice(4)}`;
  }

  function hashToCodeParts(str, salt = "") {
    const src = `${str}::${salt}`;
    let h1 = 2166136261;
    let h2 = 16777619;
    for (let i = 0; i < src.length; i += 1) {
      h1 ^= src.charCodeAt(i);
      h1 = Math.imul(h1, 16777619);
      h2 ^= src.charCodeAt(src.length - 1 - i);
      h2 = Math.imul(h2, 2166136261);
    }
    let n = ((h1 >>> 0) * 0x9e3779b1) ^ (h2 >>> 0);
    let out = "";
    for (let i = 0; i < 8; i += 1) {
      out += CODE_ALPHABET[n % CODE_ALPHABET.length];
      n = Math.imul(n ^ (n >>> 7), 0x85ebca6b) >>> 0;
    }
    return out;
  }

  function randomCodeParts() {
    let out = "";
    for (let i = 0; i < 8; i += 1) {
      out += CODE_ALPHABET[(Math.random() * CODE_ALPHABET.length) | 0];
    }
    return out;
  }

  function looksLikePlayerCode(raw) {
    const s = String(raw || "").trim();
    if (!s || /^MG1:/i.test(s)) return false;
    return /^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{4}-?[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{4}$/i.test(
      s
    );
  }

  function formatAccountTransferKey(code, playerId, name) {
    const norm = normalizePlayerCode(code);
    const id = String(playerId || "").trim();
    if (norm.length !== 8 || !id || isPoisonPlayerCode(norm)) return "";
    return `MG1:${norm}:${id}:${sanitizeName(name || "")}`;
  }

  function parseAccountTransferKey(raw) {
    const s = String(raw || "").trim();
    const m = /^MG1:([A-Z0-9]{8}):([^:\s]+):(.*)$/i.exec(s);
    if (!m) return null;
    const norm = normalizePlayerCode(m[1]);
    if (norm.length !== 8 || isPoisonPlayerCode(norm)) return null;
    const playerId = String(m[2] || "").trim();
    if (!playerId) return null;
    return {
      code: norm,
      playerId,
      name: sanitizeName(m[3] || "")
    };
  }

  function parseCodesMap(data) {
    if (!data || typeof data !== "object") return {};
    const codes = data.codes && typeof data.codes === "object" ? data.codes : data;
    const out = {};
    Object.entries(codes).forEach(([k, v]) => {
      const key = normalizePlayerCode(k);
      if (key.length !== 8 || isPoisonPlayerCode(key) || !v || typeof v !== "object") return;
      const playerId = String(v.playerId || "").trim();
      if (!playerId) return;
      out[key] = {
        playerId,
        name: sanitizeName(v.name || ""),
        at: Number(v.at) || 0
      };
    });
    return out;
  }

  function rowsToCodesMap(rows) {
    const out = {};
    (Array.isArray(rows) ? rows : []).forEach((row) => {
      if (!row || typeof row !== "object") return;
      const key = normalizePlayerCode(row.code || "");
      if (key.length !== 8 || isPoisonPlayerCode(key)) return;
      const playerId = String(row.player_id || row.playerId || "").trim();
      if (!playerId) return;
      out[key] = {
        playerId,
        name: sanitizeName(row.display_name || row.name || ""),
        at: Date.parse(row.claimed_at || row.claimedAt || "") || Number(row.at) || 0
      };
    });
    return out;
  }

  function mergeCodesMaps(a, b) {
    const out = { ...(a || {}) };
    Object.entries(b || {}).forEach(([code, entry]) => {
      if (!entry?.playerId) return;
      const existing = out[code];
      if (!existing) {
        out[code] = entry;
        return;
      }
      if (existing.playerId !== entry.playerId) return;
      const left = Number(existing.at) || 0;
      const right = Number(entry.at) || 0;
      out[code] = {
        playerId: existing.playerId,
        name: sanitizeName(entry.name || existing.name || ""),
        at: left && right ? Math.min(left, right) : left || right
      };
    });
    return out;
  }

  function reservationAllows(res, playerId, code) {
    if (!res?.playerId) return true;
    if (res.playerId === playerId) return true;
    const locked = normalizePlayerCode(res.code || "");
    const mine = normalizePlayerCode(code || "");
    return !!(locked && mine && locked === mine);
  }

  const IDENTITY_MINE_KEY = "identity-mine";

  function readIdentityMine(payload) {
    const playerId = String(payload?.playerId || "").trim();
    const code = normalizePlayerCode(payload?.code || "");
    return {
      playerId,
      code: playerId && code.length === 8 && !isPoisonPlayerCode(code) ? code : "",
      name: playerId ? sanitizeName(payload?.name || "") : "",
      locked: !!(playerId && payload?.locked),
      updatedAt: Number(payload?.updatedAt) || 0
    };
  }

  function collectIdentityMine(state, playerId) {
    const me = String(playerId || "").trim();
    const code = normalizePlayerCode(state?.code || "");
    return {
      playerId: me,
      code: me && code.length === 8 && !isPoisonPlayerCode(code) ? code : "",
      name: me ? sanitizeName(state?.name || "") : "",
      locked: !!(me && state?.locked),
      updatedAt: Date.now()
    };
  }

  function applyIdentityMine(local, mine) {
    const playerId = String(local?.playerId || "").trim();
    const owned = readIdentityMine(mine);
    const localCode = normalizePlayerCode(local?.code || "");
    const localName = sanitizeName(local?.name || "");
    const keepLocalCode = localCode.length === 8 && !isPoisonPlayerCode(localCode);
    if (!playerId || !owned.playerId || owned.playerId !== playerId) {
      return {
        playerId,
        code: keepLocalCode ? localCode : "",
        name: localName,
        locked: !!local?.locked
      };
    }
    return {
      playerId,
      code: keepLocalCode ? localCode : owned.code,
      name: localName || owned.name,
      locked: !!local?.locked || owned.locked
    };
  }

  function parseReservationsMap(data) {
    if (!data || typeof data !== "object") return {};
    const map =
      data.reservations && typeof data.reservations === "object" ? data.reservations : data;
    const out = {};
    Object.entries(map).forEach(([k, v]) => {
      const key = String(k || "").toLowerCase();
      if (!key || !v || typeof v !== "object" || !v.playerId) return;
      out[key] = {
        playerId: String(v.playerId),
        code: normalizePlayerCode(v.code || ""),
        name: sanitizeName(v.name || key),
        lockedAt: Number(v.lockedAt) || 0
      };
    });
    return out;
  }

  const PASSWORD_MINE_KEY = "password-mine";

  function normalizePasswordHash(raw) {
    const hash = String(raw || "").trim();
    if (/^[0-9a-f]{64}$/i.test(hash)) return hash.toLowerCase();
    if (/^f:[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{16}$/.test(hash)) return hash;
    return "";
  }

  function cleanPasswordEntry(raw, playerId) {
    if (!raw || typeof raw !== "object") return null;
    const me = String(playerId || "").trim();
    const owner = String(raw.playerId || "").trim();
    if (!me || owner !== me) return null;
    const code = normalizePlayerCode(raw.code || "");
    return {
      playerId: me,
      code: code.length === 8 && !isPoisonPlayerCode(code) ? code : "",
      name: sanitizeName(raw.name || ""),
      at: Number(raw.at) || 0
    };
  }

  function cleanPasswordMap(map, playerId) {
    const me = String(playerId || "").trim();
    const out = {};
    if (!me || !map || typeof map !== "object") return out;
    Object.entries(map).forEach(([rawHash, raw]) => {
      const hash = normalizePasswordHash(rawHash);
      const entry = cleanPasswordEntry(raw, me);
      if (!hash || !entry) return;
      out[hash] = entry;
    });
    return out;
  }

  function readPasswordMine(payload) {
    const playerId = String(payload?.playerId || "").trim();
    return {
      playerId,
      hashes: cleanPasswordMap(payload?.hashes, playerId),
      cleared: !!(playerId && payload?.cleared),
      updatedAt: Number(payload?.updatedAt) || 0
    };
  }

  function collectPasswordMine(passwords, playerId, opts) {
    const me = String(playerId || "").trim();
    const hashes = cleanPasswordMap(passwords, me);
    const cleared = !!(opts && opts.cleared);
    return {
      playerId: me,
      hashes: cleared ? {} : hashes,
      cleared,
      updatedAt: Date.now()
    };
  }

  function applyPasswordMine(localPasswords, mine, playerId) {
    const owned = readPasswordMine(mine);
    const me = String(playerId || owned.playerId || "").trim();
    const local = {};
    Object.entries(
      localPasswords && typeof localPasswords === "object" ? localPasswords : {}
    ).forEach(([hash, raw]) => {
      if (!raw || typeof raw !== "object" || !raw.playerId) return;
      local[String(hash)] = raw;
    });
    if (!me || owned.playerId !== me) return local;
    if (owned.cleared) {
      Object.keys(local).forEach((hash) => {
        if (local[hash]?.playerId === me) delete local[hash];
      });
      return local;
    }
    if (!Object.keys(owned.hashes).length) return local;
    Object.keys(local).forEach((hash) => {
      if (local[hash]?.playerId === me) delete local[hash];
    });
    Object.entries(owned.hashes).forEach(([hash, entry]) => {
      if (local[hash]?.playerId && local[hash].playerId !== me) return;
      local[hash] = entry;
    });
    return local;
  }

  const RESERVATIONS_MINE_KEY = "reservations-mine";

  function cleanReservation(raw, playerId) {
    if (!raw || typeof raw !== "object") return null;
    const me = String(playerId || "").trim();
    const owner = String(raw.playerId || "").trim();
    if (!me || owner !== me) return null;
    const name = sanitizeName(raw.name || "");
    const code = normalizePlayerCode(raw.code || "");
    if (!name || code.length !== 8 || isPoisonPlayerCode(code)) return null;
    return {
      playerId: me,
      code,
      name,
      lockedAt: Number(raw.lockedAt) || 0
    };
  }

  function cleanReservationMap(map, playerId) {
    const me = String(playerId || "").trim();
    const out = {};
    if (!me || !map || typeof map !== "object") return out;
    Object.entries(map).forEach(([rawKey, raw]) => {
      const entry = cleanReservation(raw, me);
      const key = nameKey(rawKey || entry?.name || "");
      if (!key || !entry) return;
      out[key] = entry;
    });
    return out;
  }

  function readReservationsMine(payload) {
    const playerId = String(payload?.playerId || "").trim();
    return {
      playerId,
      reservations: cleanReservationMap(payload?.reservations, playerId),
      updatedAt: Number(payload?.updatedAt) || 0
    };
  }

  function collectReservationsMine(reservations, playerId) {
    const me = String(playerId || "").trim();
    return {
      playerId: me,
      reservations: cleanReservationMap(reservations, me),
      updatedAt: Date.now()
    };
  }

  function applyReservationsMine(localMap, mine, playerId) {
    const owned = readReservationsMine(mine);
    const me = String(playerId || owned.playerId || "").trim();
    const local = { ...(localMap && typeof localMap === "object" ? localMap : {}) };
    if (!me || owned.playerId !== me) return local;
    Object.entries(owned.reservations).forEach(([key, entry]) => {
      const existing = local[key];
      if (
        existing?.playerId &&
        existing.playerId !== me &&
        !reservationAllows(existing, me, entry.code)
      ) {
        return;
      }
      if (existing?.playerId === me) {
        const left = Number(existing.lockedAt) || 0;
        const right = Number(entry.lockedAt) || 0;
        local[key] = {
          ...entry,
          lockedAt: left && right ? Math.min(left, right) : left || right
        };
        return;
      }
      local[key] = entry;
    });
    return local;
  }

  const api = {
    CODE_ALPHABET,
    sanitizeName,
    nameKey,
    makeId,
    normalizePlayerCode,
    isPoisonPlayerCode,
    formatPlayerCode,
    hashToCodeParts,
    randomCodeParts,
    looksLikePlayerCode,
    formatAccountTransferKey,
    parseAccountTransferKey,
    parseCodesMap,
    rowsToCodesMap,
    mergeCodesMaps,
    reservationAllows,
    parseReservationsMap,
    IDENTITY_MINE_KEY,
    readIdentityMine,
    collectIdentityMine,
    applyIdentityMine,
    PASSWORD_MINE_KEY,
    normalizePasswordHash,
    cleanPasswordEntry,
    readPasswordMine,
    collectPasswordMine,
    applyPasswordMine,
    RESERVATIONS_MINE_KEY,
    cleanReservation,
    readReservationsMine,
    collectReservationsMine,
    applyReservationsMine
  };
  root.HubIdentity = api;
  if (typeof module === "object" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
