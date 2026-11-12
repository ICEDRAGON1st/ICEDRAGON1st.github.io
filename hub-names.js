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

  function applyChange(hub, change, rows) {
    const nextRows = mergeContributionRows(rows, change);
    const current =
      hub && typeof hub === "object" && !Array.isArray(hub)
        ? hub.names && typeof hub.names === "object"
          ? hub.names
          : hub
        : {};
    return {
      names: mergeNameMaps(current, rowsToNameMap(nextRows)),
      rows: nextRows
    };
  }

  const TITLE_DEFS = {
    owner: { id: "owner", label: "OWNER", className: "player-title-owner" },
    og: { id: "og", label: "OG", className: "player-title-og" },
    tester: { id: "tester", label: "TESTER", className: "player-title-tester" },
    legend: { id: "legend", label: "LEGEND", className: "player-title-legend" },
    master_fisher: {
      id: "master_fisher",
      label: "MASTER FISHER",
      className: "player-title-master-fisher"
    },
    cheesy: { id: "cheesy", label: "CHEESY LIL GUY", className: "player-title-cheesy" },
    hub1: { id: "hub1", label: "#1", className: "player-title-hub1" },
    hub2: { id: "hub2", label: "#2", className: "player-title-hub2" },
    hub3: { id: "hub3", label: "#3", className: "player-title-hub3" },
    clutch: { id: "clutch", label: "CLUTCH", className: "player-title-clutch" },
    lefty: { id: "lefty", label: "LEFTY", className: "player-title-lefty" },
    silly_hat: { id: "silly_hat", label: "SILLY HAT", className: "player-title-silly-hat" },
    centerless: { id: "centerless", label: "CENTERLESS", className: "player-title-centerless" },
    zen_farmer: { id: "zen_farmer", label: "ZEN FARMER", className: "player-title-zen-farmer" },
    inviter: { id: "inviter", label: "INVITER", className: "player-title-inviter" },
    pacifist: { id: "pacifist", label: "PACIFIST", className: "player-title-pacifist" }
  };

  const TITLE_COLORS = {
    owner: "#1c7ed6",
    og: "#2f9e44",
    tester: "#e03131",
    legend: "#f1c40f",
    master_fisher: "#2ec4b6",
    cheesy: "#f0b429",
    hub1: "#fbbf24",
    hub2: "#94a3b8",
    hub3: "#d97706",
    clutch: "#f97316",
    lefty: "#22c55e",
    silly_hat: "#e879f9",
    centerless: "#38bdf8",
    zen_farmer: "#a3e635",
    pacifist: "#94a3b8",
    inviter: "#7c3aed"
  };

  const HUB_POINTS_TITLE_IDS = ["hub1", "hub2", "hub3"];

  const EXTRA_COLORS = {
    aurora: {
      id: "aurora",
      label: "Aurora",
      className: "player-color-aurora",
      nameClass: "player-name-aurora",
      titleClass: "player-title-aurora",
      animated: true
    },
    mono: {
      id: "mono",
      label: "Mono",
      className: "player-color-mono",
      nameClass: "player-name-mono",
      titleClass: "player-title-mono",
      animated: true
    },
    tide: {
      id: "tide",
      label: "Tide",
      className: "player-color-tide",
      nameClass: "player-name-tide",
      titleClass: "player-title-tide",
      animated: true
    }
  };

  const EXTRA_COLOR_GRANTS = {
    aurora: new Set(["ice_dragon", "oscarvr29"]),
    mono: new Set(["ice_dragon", "hjalte"]),
    tide: new Set(["ice_dragon", "oscarvr29"])
  };

  const COLOR_OPTIONS = [
    { id: "default", label: "Default", value: "" },
    { id: "blue", label: "Blue", value: "#1c7ed6" },
    { id: "green", label: "Green", value: "#2f9e44" },
    { id: "yellow", label: "Yellow", value: "#f1c40f" },
    { id: "red", label: "Red", value: "#e03131" },
    { id: "orange", label: "Orange", value: "#f76707" },
    { id: "purple", label: "Purple", value: "#9c36b5" },
    { id: "pink", label: "Pink", value: "#d6336c" },
    { id: "cyan", label: "Cyan", value: "#15aabf" },
    { id: "white", label: "White", value: "#f1f3f5" }
  ];

  function sanitizeColor(raw) {
    const value = String(raw || "")
      .trim()
      .toLowerCase();
    if (!value) return "";
    if (/^#[0-9a-f]{6}$/.test(value)) return value;
    return "";
  }

  function contrastText(bg) {
    const hex = sanitizeColor(bg);
    if (!hex) return "#ffffff";
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const luma = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luma > 0.62 ? "#1a1a1a" : "#ffffff";
  }

  function extraColorIdsForName(nameKeyValue) {
    const key = String(nameKeyValue || "");
    return Object.keys(EXTRA_COLOR_GRANTS).filter((id) => EXTRA_COLOR_GRANTS[id].has(key));
  }

  function isCheesyColor(raw) {
    const value = String(raw || "")
      .trim()
      .toLowerCase();
    return value === TITLE_COLORS.cheesy || value === "#f0b429";
  }

  async function fetchNicknameClaimRows(api) {
    if (!api?.listNicknameClaims) return null;
    try {
      const rows = await api.listNicknameClaims();
      if (!rows) return null;
      return Array.isArray(rows) ? rows : [];
    } catch {
      return null;
    }
  }

  async function persistNicknameClaim(api, playerId, claim) {
    const me = String(playerId || "").trim();
    if (!api?.upsertNicknameClaim || !me) return false;
    const cleaned = cleanClaim(claim, me);
    if (!cleaned?.name) return false;
    try {
      await api.upsertNicknameClaim({
        playerId: me,
        nameKey: nameKey(cleaned.name),
        claim: cleaned
      });
      return true;
    } catch (err) {
      if (err && err.nameTaken) return "taken";
      return false;
    }
  }

  async function pushNicknameClaims(api, playerId, names) {
    const me = String(playerId || "").trim();
    const mine = findClaimByPlayerId(names, me);
    const tableResult = mine ? await persistNicknameClaim(api, me, mine) : false;
    if (tableResult === "taken") {
      const err = new Error("nickname taken");
      err.nameTaken = true;
      throw err;
    }
    return tableResult === true;
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
    rowsToNameMap,
    applyChange,
    fetchNicknameClaimRows,
    persistNicknameClaim,
    pushNicknameClaims,
    TITLE_DEFS,
    TITLE_COLORS,
    EXTRA_COLORS,
    EXTRA_COLOR_GRANTS,
    COLOR_OPTIONS,
    HUB_POINTS_TITLE_IDS,
    sanitizeColor,
    contrastText,
    extraColorIdsForName,
    isCheesyColor
  };
  if (root) root.HubNames = api;
  if (typeof module === "object" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : typeof globalThis !== "undefined" ? globalThis : null);
