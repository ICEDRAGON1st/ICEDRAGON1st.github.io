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

  function mintPlayerId() {
    return `p-${makeId()}`;
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

  function mintGuestAccount() {
    return {
      playerId: mintPlayerId(),
      code: formatPlayerCode(randomCodeParts())
    };
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

  function firstRestoreName(...parts) {
    for (const part of parts) {
      const name = sanitizeName(part || "");
      if (name) return name;
    }
    return "";
  }

  function resolveRestoreEntry({ transfer, localHit, localCode, remote, norm } = {}) {
    const key = normalizePlayerCode(norm || transfer?.code || localHit?.code || "");
    const remoteEntry = key && remote && typeof remote === "object" ? remote[key] : null;
    if (transfer?.playerId) {
      return {
        playerId: String(transfer.playerId).trim(),
        name: firstRestoreName(transfer.name, localHit?.name, localCode?.name, remoteEntry?.name),
        at: Date.now()
      };
    }
    if (localHit?.playerId) {
      return {
        playerId: String(localHit.playerId).trim(),
        name: firstRestoreName(localHit.name, localCode?.name, remoteEntry?.name),
        at: localHit.savedAt || 0
      };
    }
    if (localCode?.playerId) {
      return {
        playerId: String(localCode.playerId).trim(),
        name: firstRestoreName(localCode.name, remoteEntry?.name),
        at: localCode.at || 0
      };
    }
    if (remoteEntry?.playerId) {
      return {
        playerId: String(remoteEntry.playerId).trim(),
        name: sanitizeName(remoteEntry.name || ""),
        at: remoteEntry.at || 0
      };
    }
    return null;
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

  function contributionRowKey(row) {
    return String(row?.player_id || row?.playerId || "").trim();
  }

  function unwrapChange(change) {
    const payload = change && typeof change === "object" ? change : {};
    if (payload.data && typeof payload.data === "object") return payload.data;
    if (payload.payload && typeof payload.payload === "object") {
      const inner = payload.payload;
      if (inner.data && typeof inner.data === "object") return inner.data;
      return inner;
    }
    return payload;
  }

  function mergeContributionRows(rows, change) {
    const data = unwrapChange(change);
    const type = String(data.type || data.eventType || change?.event || "").toUpperCase();
    const list = Array.isArray(rows) ? rows.slice() : [];
    if (type === "DELETE") return list;
    const record = data.record || data.new || {};
    if (!record || typeof record !== "object") return list;
    const pid = contributionRowKey(record);
    if (!pid) return list;
    const idx = list.findIndex((row) => contributionRowKey(row) === pid);
    if (idx >= 0) list[idx] = record;
    else list.push(record);
    return list;
  }

  function applyCodeChange(hub, change, rows) {
    const nextRows = mergeContributionRows(rows, change);
    const current =
      hub && typeof hub === "object" && !Array.isArray(hub)
        ? hub.codes && typeof hub.codes === "object"
          ? hub.codes
          : hub
        : {};
    return {
      codes: mergeCodesMaps(current, rowsToCodesMap(nextRows)),
      rows: nextRows
    };
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

  async function hashPassword(rawPassword) {
    const pw = String(rawPassword || "").trim();
    if (!pw) return "";
    const payload = `ice-hub-pw-v1:${pw}`;
    try {
      if (globalThis.crypto?.subtle && typeof TextEncoder !== "undefined") {
        const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(payload));
        return Array.from(new Uint8Array(buf))
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("");
      }
    } catch {}
    return `f:${hashToCodeParts(payload, "pw1")}${hashToCodeParts(payload, "pw2")}`;
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

  function rowsToPasswordMap(rows) {
    const out = {};
    (Array.isArray(rows) ? rows : []).forEach((row) => {
      if (!row || typeof row !== "object" || row.cleared) return;
      const playerId = String(row.player_id || row.playerId || "").trim();
      const hash = normalizePasswordHash(row.password_hash || row.passwordHash || row.hash || "");
      const entry = cleanPasswordEntry(
        {
          playerId,
          code: row.code || "",
          name: row.display_name || row.name || "",
          at: Date.parse(row.hashed_at || row.hashedAt || "") || Number(row.at) || 0
        },
        playerId
      );
      if (!hash || !entry) return;
      out[hash] = entry;
    });
    return out;
  }

  function mergePasswordMaps(a, b) {
    const out = { ...(a && typeof a === "object" ? a : {}) };
    Object.entries(b && typeof b === "object" ? b : {}).forEach(([hash, entry]) => {
      const key = normalizePasswordHash(hash) || String(hash || "");
      if (!key || !entry || typeof entry !== "object" || !entry.playerId) return;
      if (out[key]?.playerId) return;
      out[key] = entry;
    });
    return out;
  }

  function overlayPasswordMaps(hubMap, rows) {
    const claimed = new Set();
    (Array.isArray(rows) ? rows : []).forEach((row) => {
      const playerId = String(row?.player_id || row?.playerId || "").trim();
      if (playerId) claimed.add(playerId);
    });
    const kept = {};
    Object.entries(hubMap && typeof hubMap === "object" ? hubMap : {}).forEach(([hash, entry]) => {
      if (!entry || typeof entry !== "object" || !entry.playerId) return;
      if (claimed.has(String(entry.playerId))) return;
      kept[String(hash)] = entry;
    });
    return mergePasswordMaps(kept, rowsToPasswordMap(rows));
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

  function rowsToReservationsMap(rows) {
    const out = {};
    (Array.isArray(rows) ? rows : []).forEach((row) => {
      if (!row || typeof row !== "object") return;
      const playerId = String(row.player_id || row.playerId || "").trim();
      const entry = cleanReservation(
        {
          playerId,
          code: row.code || "",
          name: row.display_name || row.name || "",
          lockedAt: Date.parse(row.locked_at || row.lockedAt || "") || Number(row.lockedAt) || 0
        },
        playerId
      );
      const key = String(row.name_key || row.nameKey || "")
        .toLowerCase()
        .trim()
        .slice(0, 16);
      const mappedKey = key || (entry ? nameKey(entry.name) : "");
      if (!mappedKey || !entry) return;
      out[mappedKey] = entry;
    });
    return out;
  }

  function mergeReservationMaps(a, b) {
    const out = { ...(a || {}) };
    Object.entries(b || {}).forEach(([key, entry]) => {
      if (!entry?.playerId) return;
      const existing = out[key];
      if (!existing) {
        out[key] = entry;
        return;
      }
      if (
        existing.playerId !== entry.playerId &&
        !reservationAllows(existing, entry.playerId, entry.code)
      ) {
        return;
      }
      if (existing.playerId === entry.playerId) {
        const left = Number(existing.lockedAt) || 0;
        const right = Number(entry.lockedAt) || 0;
        out[key] = {
          ...existing,
          ...entry,
          playerId: existing.playerId,
          lockedAt: left && right ? Math.min(left, right) : left || right
        };
        return;
      }
      out[key] = entry;
    });
    return out;
  }

  function applyReservationChange(hub, change, rows) {
    const nextRows = mergeContributionRows(rows, change);
    const current =
      hub && typeof hub === "object" && !Array.isArray(hub)
        ? hub.reservations && typeof hub.reservations === "object"
          ? hub.reservations
          : hub
        : {};
    return {
      reservations: mergeReservationMaps(current, rowsToReservationsMap(nextRows)),
      rows: nextRows
    };
  }

  const ACCOUNTS_KEY = "hub-accounts-v1";
  const MAX_SAVED_ACCOUNTS = 12;

  function defaultAccountStorage() {
    try {
      if (typeof localStorage === "undefined") return null;
      return localStorage;
    } catch {
      return null;
    }
  }

  function cleanSavedAccount(raw) {
    if (!raw || typeof raw !== "object") return null;
    const code = formatPlayerCode(raw.code || "");
    const playerId = String(raw.playerId || "").trim();
    if (!playerId || normalizePlayerCode(code).length !== 8 || isPoisonPlayerCode(code)) return null;
    return {
      code,
      playerId,
      name: sanitizeName(raw.name || ""),
      savedAt: Number(raw.savedAt) || 0,
      hasPassword: !!raw.hasPassword
    };
  }

  function readSavedAccounts(storage) {
    const store = storage || defaultAccountStorage();
    if (!store?.getItem) return [];
    try {
      const raw = JSON.parse(store.getItem(ACCOUNTS_KEY) || "[]");
      if (!Array.isArray(raw)) return [];
      const cleaned = raw.map(cleanSavedAccount).filter(Boolean).slice(0, MAX_SAVED_ACCOUNTS);
      if (cleaned.length !== raw.length) writeSavedAccounts(cleaned, store);
      return cleaned;
    } catch {
      return [];
    }
  }

  function writeSavedAccounts(list, storage) {
    const store = storage || defaultAccountStorage();
    const cleaned = (Array.isArray(list) ? list : [])
      .map(cleanSavedAccount)
      .filter(Boolean)
      .slice(0, MAX_SAVED_ACCOUNTS);
    if (!store?.setItem) return cleaned;
    try {
      store.setItem(ACCOUNTS_KEY, JSON.stringify(cleaned));
    } catch {}
    return cleaned;
  }

  function rememberSavedAccount(entry, list) {
    const cleaned = cleanSavedAccount({ ...(entry || {}), savedAt: Number(entry?.savedAt) || Date.now() });
    if (!cleaned) return (Array.isArray(list) ? list : []).slice(0, MAX_SAVED_ACCOUNTS);
    const norm = normalizePlayerCode(cleaned.code);
    const next = (Array.isArray(list) ? list : []).filter(
      (row) => normalizePlayerCode(row?.code) !== norm
    );
    next.unshift(cleaned);
    return next.slice(0, MAX_SAVED_ACCOUNTS);
  }

  async function fetchPasswordHashRows(api, hash) {
    const norm = normalizePasswordHash(hash);
    if (!norm || !api?.listPlayerPasswordHashes) return [];
    try {
      const rows = await api.listPlayerPasswordHashes(norm);
      if (!rows) return null;
      return Array.isArray(rows) ? rows : [];
    } catch {
      return null;
    }
  }

  async function persistPlayerPasswordHash(api, playerId, hash, entry, opts) {
    const me = String(playerId || "").trim();
    if (!api?.upsertPlayerPasswordHash || !me) return false;
    const cleared = !!(opts && opts.cleared);
    const cleaned = !cleared ? cleanPasswordEntry(entry, me) : null;
    const norm = normalizePasswordHash(hash);
    if (!cleared && (!norm || !cleaned)) return false;
    try {
      await api.upsertPlayerPasswordHash({
        playerId: me,
        passwordHash: cleared ? "" : norm,
        code: cleaned?.code || "",
        displayName: cleaned?.name || "",
        hashedAt: cleaned?.at || Date.now(),
        cleared
      });
      return true;
    } catch (err) {
      if (err && err.hashTaken) return "taken";
      return false;
    }
  }

  async function pushPasswordHashes(api, playerId, passwords) {
    const me = String(playerId || "").trim();
    let tableWrote = false;
    const mine = Object.entries(passwords || {}).filter(([, entry]) => entry?.playerId === me);
    for (const [hash, entry] of mine) {
      const result = await persistPlayerPasswordHash(api, me, hash, entry);
      if (result === "taken") {
        const err = new Error("password hash taken");
        err.hashTaken = true;
        throw err;
      }
      if (result === true) tableWrote = true;
    }
    return tableWrote;
  }

  async function fetchCodeClaimRows(api) {
    if (!api?.listPlayerCodeClaims) return null;
    try {
      const rows = await api.listPlayerCodeClaims();
      if (!rows) return null;
      return Array.isArray(rows) ? rows : [];
    } catch {
      return null;
    }
  }

  async function persistPlayerCodeClaim(api, playerId, norm, name) {
    const me = String(playerId || "").trim();
    if (!api?.upsertPlayerCodeClaim || !me) return false;
    try {
      await api.upsertPlayerCodeClaim({
        playerId: me,
        code: norm,
        displayName: name || ""
      });
      return true;
    } catch (err) {
      if (err && err.codeTaken) return "taken";
      return false;
    }
  }

  async function fetchReservationLockRows(api) {
    if (!api?.listNameReservationLocks) return null;
    try {
      const rows = await api.listNameReservationLocks();
      if (!rows) return null;
      return Array.isArray(rows) ? rows : [];
    } catch {
      return null;
    }
  }

  async function persistNameReservationLock(api, playerId, key, entry) {
    const me = String(playerId || "").trim();
    if (!api?.upsertNameReservationLock || !me || !entry) return false;
    const cleaned = cleanReservation(entry, me);
    if (!cleaned?.code || !cleaned?.name) return false;
    try {
      await api.upsertNameReservationLock({
        playerId: me,
        nameKey: String(key || nameKey(cleaned.name) || "").toLowerCase(),
        code: cleaned.code,
        displayName: cleaned.name,
        lockedAt: cleaned.lockedAt
      });
      return true;
    } catch (err) {
      if (err && err.nameTaken) return "taken";
      return false;
    }
  }

  function removeSavedAccount(rawCode, list) {
    const norm = normalizePlayerCode(rawCode);
    const current = Array.isArray(list) ? list : [];
    if (norm.length !== 8) return current.slice();
    return current.filter((row) => normalizePlayerCode(row?.code) !== norm);
  }

  async function persistOwnedSave(api, key, snapshot) {
    const saveKey = String(key || "").trim();
    if (!api?.upsertSave || !saveKey || snapshot == null) return false;
    await api.upsertSave(saveKey, snapshot, 1);
    return true;
  }

  async function readOwnedSave(api, key) {
    const saveKey = String(key || "").trim();
    if (!api?.getSave || !saveKey) return null;
    return api.getSave(saveKey);
  }

  async function persistIdentityOwned(api, playerId, local) {
    const me = String(playerId || "").trim();
    if (!me) return false;
    return persistOwnedSave(api, IDENTITY_MINE_KEY, collectIdentityMine(local, me));
  }

  async function readIdentityOwned(api) {
    return readOwnedSave(api, IDENTITY_MINE_KEY);
  }

  async function persistPasswordOwned(api, playerId, passwords, opts) {
    const me = String(playerId || "").trim();
    if (!me) return false;
    const snapshot = collectPasswordMine(passwords, me, opts);
    if (!Object.keys(snapshot.hashes || {}).length && !snapshot.cleared) return false;
    return persistOwnedSave(api, PASSWORD_MINE_KEY, snapshot);
  }

  async function readPasswordOwned(api) {
    return readOwnedSave(api, PASSWORD_MINE_KEY);
  }

  async function persistReservationsOwned(api, playerId, reservations) {
    const me = String(playerId || "").trim();
    if (!me) return false;
    const snapshot = collectReservationsMine(reservations, me);
    if (!Object.keys(snapshot.reservations || {}).length) return false;
    return persistOwnedSave(api, RESERVATIONS_MINE_KEY, snapshot);
  }

  async function readReservationsOwned(api) {
    return readOwnedSave(api, RESERVATIONS_MINE_KEY);
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
    mintPlayerId,
    mintGuestAccount,
    normalizePlayerCode,
    isPoisonPlayerCode,
    formatPlayerCode,
    hashToCodeParts,
    randomCodeParts,
    looksLikePlayerCode,
    formatAccountTransferKey,
    parseAccountTransferKey,
    resolveRestoreEntry,
    parseCodesMap,
    rowsToCodesMap,
    mergeCodesMaps,
    applyCodeChange,
    reservationAllows,
    parseReservationsMap,
    IDENTITY_MINE_KEY,
    readIdentityMine,
    collectIdentityMine,
    applyIdentityMine,
    PASSWORD_MINE_KEY,
    hashPassword,
    normalizePasswordHash,
    cleanPasswordEntry,
    readPasswordMine,
    collectPasswordMine,
    applyPasswordMine,
    rowsToPasswordMap,
    mergePasswordMaps,
    overlayPasswordMaps,
    fetchPasswordHashRows,
    persistPlayerPasswordHash,
    pushPasswordHashes,
    fetchCodeClaimRows,
    persistPlayerCodeClaim,
    fetchReservationLockRows,
    persistNameReservationLock,
    RESERVATIONS_MINE_KEY,
    cleanReservation,
    readReservationsMine,
    collectReservationsMine,
    applyReservationsMine,
    rowsToReservationsMap,
    mergeReservationMaps,
    applyReservationChange,
    ACCOUNTS_KEY,
    MAX_SAVED_ACCOUNTS,
    cleanSavedAccount,
    readSavedAccounts,
    writeSavedAccounts,
    rememberSavedAccount,
    removeSavedAccount,
    persistOwnedSave,
    readOwnedSave,
    persistIdentityOwned,
    readIdentityOwned,
    persistPasswordOwned,
    readPasswordOwned,
    persistReservationsOwned,
    readReservationsOwned
  };
  root.HubIdentity = api;
  if (typeof module === "object" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
