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

  function cleanThread(key, thread, opts) {
    if (!thread || typeof thread !== "object") return null;
    if (key === "global") {
      if (!(opts && opts.includeGlobal)) return null;
      const messages = cleanMessages(thread.messages);
      if (!messages.length) return null;
      return { type: "global", messages };
    }
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

  function mergeMessages(a, b) {
    const map = {};
    [...(a || []), ...(b || [])].forEach((raw) => {
      const msg = cleanMessage(raw);
      if (!msg) return;
      const prev = map[msg.id];
      if (!prev || msg.at >= prev.at) map[msg.id] = msg;
    });
    return Object.values(map)
      .sort((x, y) => x.at - y.at)
      .slice(-MAX_MESSAGES);
  }

  function mergeMembers(a, b) {
    const out = { ...(a || {}) };
    Object.entries(b || {}).forEach(([id, name]) => {
      if (!id) return;
      out[id] = String(name || out[id] || "Player").slice(0, 16);
    });
    return out;
  }

  function mergeThreads(a, b) {
    const out = { ...(a || {}) };
    Object.entries(b || {}).forEach(([key, thread]) => {
      if (!thread || typeof thread !== "object") return;
      const left = out[key] || {};
      const right = thread;
      const messages = mergeMessages(left.messages, right.messages);
      if (key === "global") {
        out[key] = { type: "global", messages };
        return;
      }
      if (isGroupKey(key)) {
        const leftMembers = left.members && typeof left.members === "object" ? left.members : {};
        const rightMembers =
          right.members && typeof right.members === "object" ? right.members : {};
        const members = mergeMembers(leftMembers, rightMembers);
        const safeMembers =
          Object.keys(members).length > 0
            ? members
            : Object.keys(leftMembers).length
              ? leftMembers
              : rightMembers;
        const name =
          String(right.name || "")
            .trim()
            .slice(0, 24) ||
          String(left.name || "")
            .trim()
            .slice(0, 24) ||
          "Group";
        out[key] = {
          type: "group",
          name,
          members: safeMembers,
          createdBy: String(right.createdBy || left.createdBy || ""),
          createdAt: Math.min(
            Number(right.createdAt) || Infinity,
            Number(left.createdAt) || Infinity
          ),
          messages
        };
        if (!Number.isFinite(out[key].createdAt)) out[key].createdAt = Date.now();
        return;
      }
      out[key] = { messages };
    });
    return out;
  }

  function threadActivity(thread) {
    const list = Array.isArray(thread?.messages) ? thread.messages : [];
    if (!list.length) return Number(thread?.createdAt) || 0;
    return Number(list[list.length - 1]?.at) || 0;
  }

  function capThreads(threads) {
    const src = threads && typeof threads === "object" ? threads : {};
    const keys = Object.keys(src);
    if (keys.length <= 40) return src;
    const kept = {};
    if (src.global) kept.global = src.global;
    keys
      .filter((key) => key !== "global")
      .sort((a, b) => threadActivity(src[b]) - threadActivity(src[a]))
      .slice(0, src.global ? 39 : 40)
      .forEach((key) => {
        kept[key] = src[key];
      });
    return kept;
  }

  function readMine(payload, opts) {
    const threads = {};
    Object.entries(
      payload?.threads && typeof payload.threads === "object" ? payload.threads : {}
    ).forEach(([key, raw]) => {
      const thread = cleanThread(key, raw, opts);
      if (thread) threads[key] = thread;
    });
    return {
      playerId: String(payload?.playerId || "").trim(),
      threads,
      updatedAt: Number(payload?.updatedAt) || 0
    };
  }

  function collectMine(data, playerId, opts) {
    const me = String(playerId || "").trim();
    const includeGlobal = !!(opts && opts.includeGlobal);
    const threads = {};
    Object.entries(
      data && data.threads && typeof data.threads === "object" ? data.threads : {}
    ).forEach(([key, raw]) => {
      if (key === "global") {
        if (!includeGlobal) return;
      } else if (!involvesMe(key, raw, me)) return;
      const thread = cleanThread(key, raw, { includeGlobal });
      if (thread) threads[key] = thread;
    });
    return {
      playerId: me,
      threads: includeGlobal ? capThreads(threads) : threads,
      updatedAt: Date.now()
    };
  }

  function collectTableMine(data, playerId) {
    return collectMine(data, playerId, { includeGlobal: true });
  }

  function overlayChatData(hub, rows) {
    let threads = { ...((hub && hub.threads) || {}) };
    (Array.isArray(rows) ? rows : []).forEach((row) => {
      const owned = readMine(
        {
          playerId: row?.player_id || row?.playerId,
          threads: row?.threads,
          updatedAt: Date.parse(row?.updated_at || "") || Number(row?.updatedAt) || 0
        },
        { includeGlobal: true }
      );
      if (!owned.playerId) return;
      threads = mergeThreads(threads, owned.threads);
    });
    return { threads };
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

  function applyChange(hub, change) {
    const data = unwrapChange(change);
    const type = String(data.type || data.eventType || change?.event || "").toUpperCase();
    const current = hub && typeof hub === "object" ? hub : { threads: {} };
    if (type === "DELETE") return { threads: { ...(current.threads || {}) } };
    const record = data.record || data.new || {};
    if (!record || typeof record !== "object") return { threads: { ...(current.threads || {}) } };
    return overlayChatData(current, [record]);
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
    mergeMessages,
    mergeThreads,
    readMine,
    collectMine,
    collectTableMine,
    overlayChatData,
    applyChange,
    applyMine
  };
  if (root) root.HubChatMine = api;
  if (typeof module === "object" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : typeof globalThis !== "undefined" ? globalThis : null);
