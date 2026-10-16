/**
 * Shared unique-nickname claim merge for hub-plays.js.
 * First claimer keeps the name; same-player titles merge.
 */
(function (root) {
  function parseNameRegistry(data) {
    if (!data || typeof data !== "object") return {};
    const names = data.names && typeof data.names === "object" ? data.names : data;
    const out = {};
    Object.entries(names).forEach(([key, claim]) => {
      if (claim && typeof claim === "object" && claim.playerId && claim.name) out[key] = claim;
    });
    return out;
  }

  function findClaimByPlayerId(names, playerId) {
    const id = String(playerId || "");
    if (!id) return null;
    let found = null;
    Object.values(names || {}).forEach((claim) => {
      if (!claim || claim.playerId !== id) return;
      if (!found || (Number(claim.claimedAt) || 0) < (Number(found.claimedAt) || 0)) {
        found = claim;
      }
    });
    return found;
  }

  function mergeNameMaps(a, b) {
    const out = { ...(a || {}) };
    Object.entries(b || {}).forEach(([key, claim]) => {
      if (!claim || !claim.playerId) return;
      const existing = out[key];
      if (!existing) {
        out[key] = claim;
        return;
      }
      if (existing.playerId === claim.playerId) {
        const existingUpdated = Number(existing.profileUpdatedAt) || 0;
        const claimUpdated = Number(claim.profileUpdatedAt) || 0;
        const newer = claimUpdated >= existingUpdated ? claim : existing;
        const older = newer === claim ? existing : claim;
        const pickStyle = (field) => {
          if (newer[field] != null && newer[field] !== "") return newer[field];
          if (older[field] != null && older[field] !== "") return older[field];
          if (Object.prototype.hasOwnProperty.call(newer, field)) return newer[field] || "";
          if (Object.prototype.hasOwnProperty.call(older, field)) return older[field] || "";
          return "";
        };
        out[key] = {
          ...older,
          ...newer,
          legend: !!(existing.legend || claim.legend),
          legendAt:
            Math.max(Number(existing.legendAt) || 0, Number(claim.legendAt) || 0) || undefined,
          masterFisher: !!(existing.masterFisher || claim.masterFisher),
          masterFisherAt:
            Math.max(Number(existing.masterFisherAt) || 0, Number(claim.masterFisherAt) || 0) ||
            undefined,
          activeTitle: pickStyle("activeTitle"),
          accentTitle: pickStyle("accentTitle"),
          accentColor: pickStyle("accentColor"),
          profileUpdatedAt: Math.max(existingUpdated, claimUpdated) || undefined,
          claimedAt: Math.min(
            Number(existing.claimedAt) || Infinity,
            Number(claim.claimedAt) || Infinity
          )
        };
        if (out[key].claimedAt === Infinity) {
          out[key].claimedAt = newer.claimedAt || older.claimedAt;
        }
        if (!out[key].legendAt) delete out[key].legendAt;
        if (!out[key].masterFisherAt) delete out[key].masterFisherAt;
        if (!out[key].profileUpdatedAt) delete out[key].profileUpdatedAt;
        return;
      }
      if ((claim.claimedAt || 0) < (existing.claimedAt || 0)) out[key] = claim;
    });
    return out;
  }

  function purgeNameRegistry(names, opts) {
    const isPurgedKey = typeof opts?.isPurgedKey === "function" ? opts.isPurgedKey : () => false;
    const isPurgedPlayer =
      typeof opts?.isPurgedPlayer === "function" ? opts.isPurgedPlayer : () => false;
    const out = { ...(names || {}) };
    let changed = false;
    Object.keys(out).forEach((key) => {
      const claim = out[key];
      if (isPurgedKey(key) || isPurgedPlayer(claim?.playerId, claim?.name || key)) {
        delete out[key];
        changed = true;
        return;
      }
      if (!claim || typeof claim !== "object") return;
      const accentTitle = String(claim.accentTitle || "").toLowerCase();
      const accentColor = String(claim.accentColor || "").toLowerCase();
      if (accentTitle === "rainbow" || accentColor === "rainbow") {
        out[key] = {
          ...claim,
          accentTitle: accentTitle === "rainbow" ? "" : claim.accentTitle || "",
          accentColor: accentColor === "rainbow" ? "" : claim.accentColor || ""
        };
        changed = true;
      }
    });
    return { names: out, changed };
  }

  const SAVE_KEY = "names-mine";

  function sanitizeName(raw) {
    return root.HubIdentity?.sanitizeName
      ? root.HubIdentity.sanitizeName(raw)
      : String(raw || "")
          .replace(/[<>&"'`]/g, "")
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 16);
  }

  function nameKey(name) {
    return root.HubIdentity?.nameKey
      ? root.HubIdentity.nameKey(name)
      : sanitizeName(name).toLowerCase();
  }

  function normalizePlayerCode(raw) {
    return root.HubIdentity?.normalizePlayerCode
      ? root.HubIdentity.normalizePlayerCode(raw)
      : String(raw || "")
          .toUpperCase()
          .replace(/[^23456789ABCDEFGHJKLMNPQRSTUVWXYZ]/g, "")
          .slice(0, 8);
  }

  function isPoisonPlayerCode(raw) {
    return root.HubIdentity?.isPoisonPlayerCode ? root.HubIdentity.isPoisonPlayerCode(raw) : false;
  }

  function cleanClaim(raw, playerId) {
    if (!raw || typeof raw !== "object") return null;
    const me = String(playerId || raw.playerId || "").trim();
    const name = sanitizeName(raw.name || "");
    if (!me || !name || (raw.playerId && String(raw.playerId) !== me)) return null;
    const code = normalizePlayerCode(raw.playerCode || "");
    const claim = {
      playerId: me,
      name,
      claimedAt: Number(raw.claimedAt) || 0,
      legend: !!raw.legend,
      masterFisher: !!raw.masterFisher,
      inviter: !!raw.inviter,
      inviteCount: Math.max(0, Math.floor(Number(raw.inviteCount) || 0)),
      activeTitle: String(raw.activeTitle || "").slice(0, 32),
      accentTitle: String(raw.accentTitle || "").slice(0, 32),
      accentColor: String(raw.accentColor || "").slice(0, 32),
      profileUpdatedAt: Number(raw.profileUpdatedAt) || 0,
      playerCode: me && code.length === 8 && !isPoisonPlayerCode(code) ? code : ""
    };
    if (raw.legendAt) claim.legendAt = Number(raw.legendAt) || 0;
    if (raw.masterFisherAt) claim.masterFisherAt = Number(raw.masterFisherAt) || 0;
    if (raw.inviterAt) claim.inviterAt = Number(raw.inviterAt) || 0;
    if (!claim.inviteCount) delete claim.inviteCount;
    if (!claim.playerCode) delete claim.playerCode;
    if (!claim.legendAt) delete claim.legendAt;
    if (!claim.masterFisherAt) delete claim.masterFisherAt;
    if (!claim.inviterAt) delete claim.inviterAt;
    if (!claim.profileUpdatedAt) delete claim.profileUpdatedAt;
    return claim;
  }

  function readMine(payload) {
    const playerId = String(payload?.playerId || "").trim();
    const claim = cleanClaim(payload?.claim, playerId);
    return {
      playerId,
      key: claim ? nameKey(claim.name) : String(payload?.key || "").toLowerCase(),
      claim,
      updatedAt: Number(payload?.updatedAt) || 0
    };
  }

  function collectMine(claim, playerId) {
    const cleaned = cleanClaim(claim, playerId);
    const me = String(playerId || cleaned?.playerId || "").trim();
    return {
      playerId: me,
      key: cleaned ? nameKey(cleaned.name) : "",
      claim: cleaned,
      updatedAt: Date.now()
    };
  }

  function rowsToNameMap(rows) {
    const out = {};
    (Array.isArray(rows) ? rows : []).forEach((row) => {
      if (!row || typeof row !== "object") return;
      const playerId = String(row.player_id || row.playerId || "").trim();
      const claim = cleanClaim(row.claim, playerId);
      const key = String(row.name_key || row.nameKey || "")
        .toLowerCase()
        .trim()
        .slice(0, 16);
      const mappedKey = key || (claim ? nameKey(claim.name) : "");
      if (!mappedKey || !claim) return;
      out[mappedKey] = claim;
    });
    return out;
  }

  function applyMine(names, mine, playerId) {
    const owned = readMine(mine);
    const me = String(playerId || owned.playerId || "").trim();
    if (!owned.claim || !me || owned.playerId !== me) return names || {};
    const key = owned.key || nameKey(owned.claim.name);
    if (!key) return names || {};
    const existing = (names || {})[key];
    if (existing?.playerId && existing.playerId !== me) return names || {};
    return mergeNameMaps(names || {}, { [key]: owned.claim });
  }

  const api = {
    parseNameRegistry,
    findClaimByPlayerId,
    mergeNameMaps,
    purgeNameRegistry,
    SAVE_KEY,
    cleanClaim,
    readMine,
    collectMine,
    applyMine,
    rowsToNameMap
  };
  if (root) root.HubNames = api;
  if (typeof module === "object" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : typeof globalThis !== "undefined" ? globalThis : null);
