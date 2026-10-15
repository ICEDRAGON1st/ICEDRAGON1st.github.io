/**
 * Per-player friend edges and invites.
 * Shared friends stay on hub_docs; this row is auth-owned player_saves.
 */
(function (root) {
  const SAVE_KEY = "friends-edges";

  function cleanEdge(info) {
    if (!info || typeof info !== "object") return null;
    const name =
      String(info.name || "Player")
        .trim()
        .slice(0, 32) || "Player";
    const out = { name };
    const at = Number(info.at) || 0;
    const since = Number(info.since) || 0;
    if (at) out.at = at;
    if (since) out.since = since;
    return out;
  }

  function cleanMap(map) {
    const out = {};
    Object.entries(map && typeof map === "object" ? map : {}).forEach(([id, raw]) => {
      const playerId = String(id || "").trim();
      if (!playerId) return;
      const edge = cleanEdge(raw);
      if (edge) out[playerId] = edge;
    });
    return out;
  }

  function cleanInvite(inv) {
    if (!inv || typeof inv !== "object") return null;
    const id = String(inv.id || "").trim();
    const fromId = String(inv.fromId || "").trim();
    const toId = String(inv.toId || "").trim();
    if (!id || !fromId || !toId) return null;
    const status = String(inv.status || "pending").trim() || "pending";
    const out = {
      id,
      fromId,
      fromName:
        String(inv.fromName || "Player")
          .trim()
          .slice(0, 32) || "Player",
      toId,
      toName:
        String(inv.toName || "Player")
          .trim()
          .slice(0, 32) || "Player",
      game: String(inv.game || "")
        .trim()
        .slice(0, 32),
      roomId: String(inv.roomId || "")
        .trim()
        .slice(0, 64),
      code: String(inv.code || "")
        .trim()
        .slice(0, 32),
      status,
      at: Number(inv.at) || 0
    };
    if (Number(inv.respondedAt) > 0) out.respondedAt = Number(inv.respondedAt);
    return out;
  }

  function profileMaps(profile) {
    return {
      friends: cleanMap(profile && profile.friends),
      outgoing: cleanMap(profile && profile.outgoing),
      incoming: cleanMap(profile && profile.incoming)
    };
  }

  function isEmptyProfile(profile) {
    if (!profile || typeof profile !== "object") return true;
    const maps = profileMaps(profile);
    return (
      !Object.keys(maps.friends).length &&
      !Object.keys(maps.outgoing).length &&
      !Object.keys(maps.incoming).length
    );
  }

  function readEdges(payload) {
    const playerId = String(payload?.playerId || "").trim();
    const invites = {};
    Object.entries(
      payload?.invites && typeof payload.invites === "object" ? payload.invites : {}
    ).forEach(([id, raw]) => {
      const inv = cleanInvite({ ...(raw || {}), id: raw?.id || id });
      if (inv) invites[inv.id] = inv;
    });
    return {
      playerId,
      name: String(payload?.name || "").trim(),
      ...profileMaps(payload),
      invites,
      updatedAt: Number(payload?.updatedAt) || 0
    };
  }

  function collectMine(data, playerId) {
    const me = String(playerId || "").trim();
    const profile = (data && data.profiles && data.profiles[me]) || {};
    const invites = {};
    Object.entries(
      data && data.invites && typeof data.invites === "object" ? data.invites : {}
    ).forEach(([id, raw]) => {
      const inv = cleanInvite({ ...(raw || {}), id: raw?.id || id });
      if (!inv || (inv.fromId !== me && inv.toId !== me)) return;
      invites[inv.id] = inv;
    });
    return {
      playerId: me,
      name: String(profile.name || "").trim(),
      ...profileMaps(profile),
      invites,
      updatedAt: Date.now()
    };
  }

  function applyMine(data, mine, playerId) {
    const me = String(playerId || mine?.playerId || "").trim();
    const owned = readEdges(mine);
    const next = {
      profiles: { ...((data && data.profiles) || {}) },
      invites: { ...((data && data.invites) || {}) }
    };
    if (me && owned.playerId && owned.playerId !== me) {
      return next;
    }
    if (me && isEmptyProfile(next.profiles[me]) && !isEmptyProfile(owned)) {
      const existing = next.profiles[me] || {};
      next.profiles[me] = {
        name: owned.name || existing.name || "Player",
        friends: owned.friends,
        outgoing: owned.outgoing,
        incoming: owned.incoming,
        updatedAt: owned.updatedAt || Date.now()
      };
    }
    Object.entries(owned.invites || {}).forEach(([id, inv]) => {
      if (!next.invites[id]) next.invites[id] = inv;
    });
    return next;
  }

  const api = {
    SAVE_KEY,
    cleanEdge,
    cleanInvite,
    isEmptyProfile,
    readEdges,
    collectMine,
    applyMine
  };
  if (root) root.HubFriendsEdges = api;
  if (typeof module === "object" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : typeof globalThis !== "undefined" ? globalThis : null);
