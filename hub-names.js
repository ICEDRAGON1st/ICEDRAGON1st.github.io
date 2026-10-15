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

  const api = {
    parseNameRegistry,
    findClaimByPlayerId,
    mergeNameMaps,
    purgeNameRegistry
  };
  if (root) root.HubNames = api;
  if (typeof module === "object" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : typeof globalThis !== "undefined" ? globalThis : null);
