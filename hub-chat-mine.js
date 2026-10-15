/**
 * Per-player DM and group chat snapshot.
 * Shared friend-chat stays on hub_docs; this row is auth-owned player_saves.
 * Global chat is not copied here.
 */
(function (root) {
  const SAVE_KEY = "chat-mine";
  const MAX_MESSAGES = 100;
  const MAX_TEXT = 200;

  function cleanMessage(msg) {
    if (!msg || typeof msg !== "object") return null;
    const id = String(msg.id || "").trim();
    const from = String(msg.from || "").trim();
    const text = String(msg.text || "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, MAX_TEXT);
    const at = Number(msg.at) || 0;
    if (!id || !from || !text || !at) return null;
    return {
      id,
      from,
      name: String(msg.name || "").slice(0, 16),
      text,
      at
    };
  }

  function cleanMembers(members) {
    const out = {};
    Object.entries(members && typeof members === "object" ? members : {}).forEach(([id, name]) => {
      const playerId = String(id || "").trim();
      if (!playerId) return;
      out[playerId] = String(name || "Player").slice(0, 16);
    });
    return out;
  }

  function cleanMessages(list) {
    return (Array.isArray(list) ? list : [])
      .map(cleanMessage)
      .filter(Boolean)
      .sort((a, b) => a.at - b.at)
      .slice(-MAX_MESSAGES);
  }

  function isGroupKey(key) {
    return String(key || "").startsWith("group:");
  }

  function involvesMe(key, thread, playerId) {
    const me = String(playerId || "").trim();
    if (!me || key === "global") return false;
    if (isGroupKey(key)) {
      const members =
        thread && thread.members && typeof thread.members === "object" ? thread.members : {};
      return !!members[me];
    }
    return String(key).split(":").includes(me);
  }

  function isEmptyThread(thread) {
    if (!thread || typeof thread !== "object") return true;
    const messages = cleanMessages(thread.messages);
    const members = cleanMembers(thread.members);
    return messages.length === 0 && Object.keys(members).length === 0;
  }

  function cleanThread(key, thread) {
    if (!thread || typeof thread !== "object" || key === "global") return null;
    const messages = cleanMessages(thread.messages);
    if (isGroupKey(key)) {
      const members = cleanMembers(thread.members);
      if (!messages.length && !Object.keys(members).length) return null;
      return {
        type: "group",
        name:
          String(thread.name || "Group")
            .trim()
            .slice(0, 24) || "Group",
        members,
        createdBy: String(thread.createdBy || ""),
        createdAt: Number(thread.createdAt) || 0,
        messages
      };
    }
    if (!messages.length) return null;
    return { messages };
  }

  function readMine(payload) {
    const threads = {};
    Object.entries(
      payload?.threads && typeof payload.threads === "object" ? payload.threads : {}
    ).forEach(([key, raw]) => {
      const thread = cleanThread(key, raw);
      if (thread) threads[key] = thread;
    });
    return {
      playerId: String(payload?.playerId || "").trim(),
      threads,
      updatedAt: Number(payload?.updatedAt) || 0
    };
  }

  function collectMine(data, playerId) {
    const me = String(playerId || "").trim();
    const threads = {};
    Object.entries(
      data && data.threads && typeof data.threads === "object" ? data.threads : {}
    ).forEach(([key, raw]) => {
      if (!involvesMe(key, raw, me)) return;
      const thread = cleanThread(key, raw);
      if (thread) threads[key] = thread;
    });
    return {
      playerId: me,
      threads,
      updatedAt: Date.now()
    };
  }

  function applyMine(data, mine, playerId) {
    const me = String(playerId || mine?.playerId || "").trim();
    const owned = readMine(mine);
    const next = { threads: { ...((data && data.threads) || {}) } };
    if (me && owned.playerId && owned.playerId !== me) return next;
    Object.entries(owned.threads || {}).forEach(([key, thread]) => {
      if (!involvesMe(key, thread, me || owned.playerId)) return;
      if (!isEmptyThread(next.threads[key])) return;
      next.threads[key] = thread;
    });
    return next;
  }

  const api = {
    SAVE_KEY,
    cleanMessage,
    involvesMe,
    isEmptyThread,
    readMine,
    collectMine,
    applyMine
  };
  if (root) root.HubChatMine = api;
  if (typeof module === "object" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : typeof globalThis !== "undefined" ? globalThis : null);
