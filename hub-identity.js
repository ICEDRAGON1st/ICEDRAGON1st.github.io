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

  function reservationAllows(res, playerId, code) {
    if (!res?.playerId) return true;
    if (res.playerId === playerId) return true;
    const locked = normalizePlayerCode(res.code || "");
    const mine = normalizePlayerCode(code || "");
    return !!(locked && mine && locked === mine);
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
    reservationAllows,
    parseReservationsMap
  };
  root.HubIdentity = api;
  if (typeof module === "object" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
