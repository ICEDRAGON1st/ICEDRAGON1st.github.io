/**
 * hub-supabase.js — shared Supabase REST helpers for the hub.
 * Uses the public anon key (safe in the browser when RLS is enabled).
 *
 * Prefer getPrefer / pushPrefer. The old backup is not read or written.
 * Doc ids match former Mantle paths (plays-log, presence, fishing-admin-events, …).
 */
(function (root) {
  const SUPABASE_URL = "https://uqyhomsydmnglbaemwbu.supabase.co";
  const SUPABASE_ANON_KEY =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVxeWhvbXN5ZG1uZ2xiYWVtd2J1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIwOTEyODcsImV4cCI6MjEwNzY2NzI4N30.Eht_HnywiURfHKRZu6rmdCatdFiT0TwC0J9Xh-CEp5o";
  const SESSION_KEY = "hub-supabase-session-v1";
  const PLAYER_ID_STORAGE_KEY = "hub-player-id";
  const IDENTITY_SAVE_KEY = "identity-bind";
  let sessionPromise = null;

  function netBlocked() {
    try {
      if (window.HubNet?.shouldBlock?.(SUPABASE_URL)) return true;
      if (window.HubNet?.isPaused?.()) return true;
      if (window.HubNet && HubNet.isOnline && !HubNet.isOnline()) return true;
    } catch {}
    return false;
  }

  const DOCS = {
    leaderboards: "leaderboards",
    plays: "plays-log",
    names: "name-registry",
    codes: "player-codes",
    reservations: "name-reservations",
    presence: "presence",
    alltime: "players-alltime",
    chat: "friend-chat",
    friends: "friends",
    feedback: "player-feedback",
    matches: "online-matches",
    fishingAdmin: "fishing-admin-events",
    fishingAdminAudit: "fishing-admin-audit",
    fishingCommunity: "fishing-community",
    fishingGifts: "fishing-gifts",
    fishingMail: "fishing-player-mail",
    fishingAquariums: "fishing-aquariums",
    calls: "hub-calls",
    hubAdminAnnounce: "hub-admin-announce",
    hubAdminMaintenance: "hub-admin-maintenance",
    hubAdminModeration: "hub-admin-moderation",
    hubAdminGrants: "hub-admin-grants"
  };

  const ADMIN_DOC_IDS = [
    "fishing-admin-events",
    "fishing-admin-audit",
    "hub-admin-announce",
    "hub-admin-maintenance",
    "hub-admin-moderation",
    "hub-admin-grants",
    "hub-discord-site-updates"
  ];

  function isAdminDoc(id) {
    return ADMIN_DOC_IDS.includes(String(id || "").trim());
  }

  function headers(extra, accessToken) {
    return {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${accessToken || SUPABASE_ANON_KEY}`,
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(extra || {})
    };
  }

  function readSession() {
    try {
      const raw = JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
      if (!raw || typeof raw !== "object") return null;
      const accessToken = String(raw.access_token || "");
      const refreshToken = String(raw.refresh_token || "");
      if (!accessToken || !refreshToken) return null;
      return raw;
    } catch {
      return null;
    }
  }

  function writeSession(data) {
    try {
      if (!data?.access_token || !data?.refresh_token) {
        localStorage.removeItem(SESSION_KEY);
        return null;
      }
      localStorage.setItem(SESSION_KEY, JSON.stringify(data));
      return data;
    } catch {
      return data || null;
    }
  }

  function sessionUserId(session) {
    try {
      const payload = JSON.parse(atob(String(session?.access_token || "").split(".")[1] || ""));
      return String(payload.sub || "").trim();
    } catch {
      return "";
    }
  }

  function parseProfile(row) {
    if (!row || typeof row !== "object") return null;
    const userId = String(row.user_id || "").trim();
    const playerId = String(row.player_id || "").trim();
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) {
      return null;
    }
    if (!/^p-[a-z0-9]{12,64}$/.test(playerId)) return null;
    const displayName = String(row.display_name || "")
      .replace(/[<>&"'`]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 32);
    return { userId, playerId, displayName };
  }

  /** Local hub ids may include hyphens; never treat those as missing. */
  function parseLocalPlayerId(raw) {
    const id = String(raw || "").trim();
    if (!/^p-[a-z0-9][a-z0-9-]{6,80}$/i.test(id)) return "";
    if (/(?:undefined|null|nan)/i.test(id.replace(/-/g, ""))) return "";
    return id;
  }

  function resolveBoundPlayerId({ localId, boundId, metadataId } = {}) {
    const local = parseLocalPlayerId(localId);
    if (local) return { playerId: local, source: "local", persist: true };
    const bound = parseLocalPlayerId(boundId);
    if (bound) return { playerId: bound, source: "bound", persist: false };
    const meta = parseLocalPlayerId(metadataId);
    if (meta) return { playerId: meta, source: "metadata", persist: false };
    return { playerId: "", source: "", persist: false };
  }

  function peekBoundPlayerId() {
    const session = readSession();
    return (
      parseLocalPlayerId(session?.profile?.localPlayerId) ||
      parseLocalPlayerId(session?.user?.user_metadata?.hub_player_id) ||
      parseLocalPlayerId(session?.user?.raw_user_meta_data?.hub_player_id)
    );
  }

  function readStoredPlayerId() {
    try {
      return parseLocalPlayerId(localStorage.getItem(PLAYER_ID_STORAGE_KEY));
    } catch {
      return "";
    }
  }

  function writeStoredPlayerId(playerId) {
    const id = parseLocalPlayerId(playerId);
    if (!id) return "";
    try {
      localStorage.setItem(PLAYER_ID_STORAGE_KEY, id);
    } catch {}
    return id;
  }

  function metadataPlayerId(session) {
    return (
      parseLocalPlayerId(session?.user?.user_metadata?.hub_player_id) ||
      parseLocalPlayerId(session?.user?.raw_user_meta_data?.hub_player_id)
    );
  }

  function localDisplayName() {
    try {
      return String(localStorage.getItem("hub-player-name") || "")
        .replace(/[<>&"'`]/g, "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 32);
    } catch {
      return "";
    }
  }

  async function fetchOwnProfile(session) {
    const userId = sessionUserId(session);
    if (!userId || !session?.access_token) return null;
    const url = `${SUPABASE_URL}/rest/v1/player_profiles?user_id=eq.${encodeURIComponent(userId)}&select=user_id,player_id,display_name`;
    const res = await fetch(url, {
      headers: headers({}, session.access_token),
      cache: "no-store"
    });
    if (!res.ok) return null;
    const rows = await res.json();
    return parseProfile(Array.isArray(rows) ? rows[0] : null);
  }

  async function syncDisplayName(session, profile) {
    if (!session?.access_token || !profile?.userId || profile.displayName) return profile;
    const nextName = localDisplayName();
    if (!nextName) return profile;
    const url = `${SUPABASE_URL}/rest/v1/player_profiles?user_id=eq.${encodeURIComponent(profile.userId)}`;
    const res = await fetch(url, {
      method: "PATCH",
      headers: headers({ Prefer: "return=representation" }, session.access_token),
      body: JSON.stringify({ display_name: nextName })
    });
    if (!res.ok) return { ...profile, displayName: nextName };
    const rows = await res.json().catch(() => null);
    return (
      parseProfile(Array.isArray(rows) ? rows[0] : null) || { ...profile, displayName: nextName }
    );
  }

  async function fetchIdentityBind(session) {
    const userId = sessionUserId(session);
    if (!userId || !session?.access_token) return null;
    const url =
      `${SUPABASE_URL}/rest/v1/player_saves?user_id=eq.${encodeURIComponent(userId)}` +
      `&save_key=eq.${encodeURIComponent(IDENTITY_SAVE_KEY)}&select=save_key,payload,schema_version,updated_at`;
    const res = await fetch(url, {
      headers: headers({}, session.access_token),
      cache: "no-store"
    });
    if (!res.ok) return null;
    const rows = await res.json();
    return parseSave(Array.isArray(rows) ? rows[0] : null)?.payload || null;
  }

  async function persistIdentityBind(session, playerId) {
    const userId = sessionUserId(session);
    const id = parseLocalPlayerId(playerId);
    if (!userId || !session?.access_token || !id) return;
    await fetch(`${SUPABASE_URL}/rest/v1/player_saves`, {
      method: "POST",
      headers: headers(
        { Prefer: "resolution=merge-duplicates,return=minimal" },
        session.access_token
      ),
      body: JSON.stringify({
        user_id: userId,
        save_key: IDENTITY_SAVE_KEY,
        payload: { playerId: id, boundAt: Date.now() },
        schema_version: 1
      })
    });
  }

  async function persistUserMetadata(session, playerId) {
    const id = parseLocalPlayerId(playerId);
    if (!session?.access_token || !id) return;
    await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      method: "PUT",
      headers: headers({}, session.access_token),
      body: JSON.stringify({ data: { hub_player_id: id } })
    });
  }

  async function bindLocalPlayerId(session) {
    const bootLocal = readStoredPlayerId();
    let boundPayload = null;
    try {
      boundPayload = await fetchIdentityBind(session);
    } catch {
      boundPayload = null;
    }
    const resolved = resolveBoundPlayerId({
      localId: bootLocal,
      boundId: boundPayload?.playerId,
      metadataId: metadataPlayerId(session)
    });
    let playerId = resolved.playerId || readStoredPlayerId();
    if (!bootLocal && playerId) writeStoredPlayerId(playerId);
    if (playerId && resolved.persist) {
      const already = parseLocalPlayerId(boundPayload?.playerId);
      if (!already) {
        try {
          await persistIdentityBind(session, playerId);
        } catch {}
        persistUserMetadata(session, playerId).catch(() => {});
      }
    }
    return playerId;
  }

  async function attachProfile(session) {
    if (!session) return session;
    try {
      let profile = await fetchOwnProfile(session);
      if (profile) profile = await syncDisplayName(session, profile);
      const localPlayerId = await bindLocalPlayerId(session);
      if (profile || localPlayerId) {
        session.profile = {
          ...(profile || {}),
          localPlayerId: localPlayerId || profile?.playerId || ""
        };
      }
    } catch {
      /* guest play continues with the local player id */
    }
    return writeSession(session) || session;
  }

  async function refreshSession(existing) {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ refresh_token: existing.refresh_token })
    });
    if (!res.ok) return null;
    const next = await res.json();
    return writeSession(next);
  }

  async function signInAnonymously() {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ data: {} })
    });
    if (!res.ok) return null;
    const next = await res.json();
    return writeSession({
      access_token: next.access_token,
      refresh_token: next.refresh_token,
      user: next.user || null
    });
  }

  async function ensureSession() {
    if (sessionPromise) return sessionPromise;
    sessionPromise = (async function () {
      const existing = readSession();
      if (existing) {
        let exp = 0;
        try {
          exp = Number(JSON.parse(atob(existing.access_token.split(".")[1] || "e30=")).exp) || 0;
        } catch {}
        if (exp * 1000 > Date.now() + 60_000) return attachProfile(existing);
        const refreshed = await refreshSession(existing);
        if (refreshed) return attachProfile(refreshed);
      }
      const created = await signInAnonymously();
      return created ? attachProfile(created) : null;
    })().catch(() => {
      sessionPromise = null;
      return null;
    });
    return sessionPromise;
  }

  async function accessToken() {
    const session = await ensureSession();
    return session?.access_token || "";
  }

  async function adoptSession(tokens) {
    const access = String(tokens?.access_token || "").trim();
    const refresh = String(tokens?.refresh_token || "").trim();
    if (!access) return null;
    const existing = readSession() || {};
    sessionPromise = (async function () {
      const next = writeSession({
        access_token: access,
        refresh_token: refresh || existing.refresh_token,
        user: tokens.user || existing.user || null,
        profile: existing.profile || null
      });
      return next ? attachProfile(next) : null;
    })().catch(() => {
      sessionPromise = null;
      return null;
    });
    return sessionPromise;
  }

  function isReady() {
    return true;
  }

  function parseSave(row) {
    if (!row || typeof row !== "object") return null;
    const saveKey = String(row.save_key || "").trim();
    if (!/^[a-z0-9][a-z0-9:_-]{0,95}$/.test(saveKey)) return null;
    const payload = row.payload && typeof row.payload === "object" ? row.payload : null;
    if (!payload) return null;
    const schemaVersion = Number(row.schema_version);
    return {
      saveKey,
      payload,
      schemaVersion: schemaVersion >= 1 && schemaVersion <= 100000 ? schemaVersion : 1,
      updatedAt: row.updated_at || ""
    };
  }

  async function getSave(saveKey) {
    if (netBlocked()) {
      const err = new Error("hub-net-blocked");
      err.hubNetBlocked = true;
      throw err;
    }
    const session = await ensureSession();
    const userId = sessionUserId(session);
    const key = String(saveKey || "").trim();
    if (!userId || !session?.access_token || !/^[a-z0-9][a-z0-9:_-]{0,95}$/.test(key)) return null;
    const url =
      `${SUPABASE_URL}/rest/v1/player_saves?user_id=eq.${encodeURIComponent(userId)}` +
      `&save_key=eq.${encodeURIComponent(key)}&select=save_key,payload,schema_version,updated_at`;
    const res = await fetch(url, {
      headers: headers({}, session.access_token),
      cache: "no-store"
    });
    if (!res.ok) return null;
    const rows = await res.json();
    return parseSave(Array.isArray(rows) ? rows[0] : null)?.payload ?? null;
  }

  async function upsertSave(saveKey, payload, schemaVersion) {
    const session = await ensureSession();
    const userId = sessionUserId(session);
    const key = String(saveKey || "").trim();
    if (!userId || !session?.access_token) throw new Error("supabase save needs a session");
    if (!/^[a-z0-9][a-z0-9:_-]{0,95}$/.test(key)) throw new Error("bad save key");
    if (netBlocked()) {
      const err = new Error("hub-net-blocked");
      err.hubNetBlocked = true;
      throw err;
    }
    const res = await fetch(`${SUPABASE_URL}/rest/v1/player_saves`, {
      method: "POST",
      headers: headers(
        {
          Prefer: "resolution=merge-duplicates,return=minimal"
        },
        session.access_token
      ),
      body: JSON.stringify({
        user_id: userId,
        save_key: key,
        payload: payload && typeof payload === "object" ? payload : {},
        schema_version: Number(schemaVersion) >= 1 ? Number(schemaVersion) : 1
      })
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`supabase save ${res.status} ${text}`);
    }
  }

  async function listPresencePings() {
    if (netBlocked()) {
      const err = new Error("hub-net-blocked");
      err.hubNetBlocked = true;
      throw err;
    }
    const session = await ensureSession();
    if (!session?.access_token) return null;
    const since = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const url =
      `${SUPABASE_URL}/rest/v1/presence_pings?pinged_at=gte.${encodeURIComponent(since)}` +
      `&select=player_id,display_name,game,pinged_at`;
    const res = await fetch(url, {
      headers: headers({}, session.access_token),
      cache: "no-store"
    });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`supabase presence list ${res.status}`);
    const rows = await res.json();
    return Array.isArray(rows) ? rows : [];
  }

  async function upsertPresencePing(row) {
    const session = await ensureSession();
    const userId = sessionUserId(session);
    const playerId = parseLocalPlayerId(row?.playerId);
    if (!userId || !session?.access_token) throw new Error("supabase presence needs a session");
    if (!playerId) throw new Error("bad presence player id");
    if (netBlocked()) {
      const err = new Error("hub-net-blocked");
      err.hubNetBlocked = true;
      throw err;
    }
    const res = await fetch(`${SUPABASE_URL}/rest/v1/presence_pings`, {
      method: "POST",
      headers: headers(
        {
          Prefer: "resolution=merge-duplicates,return=minimal"
        },
        session.access_token
      ),
      body: JSON.stringify({
        user_id: userId,
        player_id: playerId,
        display_name: String(row?.displayName || "")
          .replace(/[<>&"'`]/g, "")
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 32),
        game: String(row?.game || "hub")
          .trim()
          .slice(0, 32),
        pinged_at: new Date().toISOString()
      })
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`supabase presence upsert ${res.status} ${text}`);
    }
  }

  async function deletePresencePing() {
    const session = await ensureSession();
    const userId = sessionUserId(session);
    if (!userId || !session?.access_token) return;
    if (netBlocked()) {
      const err = new Error("hub-net-blocked");
      err.hubNetBlocked = true;
      throw err;
    }
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/presence_pings?user_id=eq.${encodeURIComponent(userId)}`,
      {
        method: "DELETE",
        headers: headers({}, session.access_token)
      }
    );
    if (!res.ok && res.status !== 404) {
      const text = await res.text().catch(() => "");
      throw new Error(`supabase presence delete ${res.status} ${text}`);
    }
  }

  let presenceSocket = null;
  let presenceHeartbeatTimer = null;
  let presenceReconnectTimer = null;
  let presenceListeners = new Set();
  let presenceRef = 0;
  let presenceWanted = false;
  let presenceBackoffMs = 1000;
  let presenceConnecting = false;

  function presenceWsUrl() {
    return (
      `${SUPABASE_URL.replace(/^http/i, "ws")}/realtime/v1/websocket` +
      `?apikey=${encodeURIComponent(SUPABASE_ANON_KEY)}&vsn=1.0.0`
    );
  }

  function stopPresenceRealtime() {
    presenceWanted = false;
    presenceConnecting = false;
    if (presenceHeartbeatTimer) {
      clearInterval(presenceHeartbeatTimer);
      presenceHeartbeatTimer = null;
    }
    if (presenceReconnectTimer) {
      clearTimeout(presenceReconnectTimer);
      presenceReconnectTimer = null;
    }
    const ws = presenceSocket;
    presenceSocket = null;
    try {
      ws?.close?.();
    } catch {}
  }

  function parsePresenceRealtimeMessage(raw) {
    let msg = raw;
    if (typeof raw === "string") {
      try {
        msg = JSON.parse(raw);
      } catch {
        return null;
      }
    }
    if (!msg || typeof msg !== "object") return null;
    const event = String(msg.event || "");
    const payload = msg.payload && typeof msg.payload === "object" ? msg.payload : {};
    if (event === "postgres_changes") {
      return payload.data && typeof payload.data === "object" ? payload.data : payload;
    }
    if (event === "INSERT" || event === "UPDATE" || event === "DELETE") {
      return {
        type: event,
        record: payload.record || payload.new || {},
        old_record: payload.old_record || payload.old || {}
      };
    }
    return null;
  }

  function notifyPresenceChange(change) {
    presenceListeners.forEach((fn) => {
      try {
        fn(change);
      } catch {}
    });
  }

  function schedulePresenceReconnect() {
    if (!presenceWanted || !presenceListeners.size) return;
    if (presenceReconnectTimer) return;
    const wait = presenceBackoffMs;
    presenceBackoffMs = Math.min(30_000, presenceBackoffMs * 2);
    presenceReconnectTimer = setTimeout(() => {
      presenceReconnectTimer = null;
      startPresenceSocket();
    }, wait);
  }

  function startPresenceSocket() {
    if (presenceSocket || presenceConnecting || !presenceWanted || !presenceListeners.size) return;
    if (typeof WebSocket === "undefined") return;
    if (netBlocked()) return;
    presenceConnecting = true;
    Promise.resolve(ensureSession())
      .then((session) => {
        if (!presenceWanted || !presenceListeners.size) {
          presenceConnecting = false;
          return;
        }
        const token = session?.access_token;
        if (!token || netBlocked()) {
          presenceConnecting = false;
          schedulePresenceReconnect();
          return;
        }
        let ws;
        try {
          ws = new WebSocket(presenceWsUrl());
        } catch {
          presenceConnecting = false;
          schedulePresenceReconnect();
          return;
        }
        presenceSocket = ws;
        const channel = "realtime:presence-pings";
        ws.onopen = () => {
          presenceConnecting = false;
          presenceBackoffMs = 1000;
          presenceRef += 1;
          try {
            ws.send(
              JSON.stringify({
                topic: channel,
                event: "phx_join",
                payload: {
                  config: {
                    broadcast: { ack: false, self: false },
                    presence: { key: "" },
                    postgres_changes: [
                      { event: "*", schema: "public", table: "presence_pings" }
                    ]
                  },
                  access_token: token
                },
                ref: String(presenceRef)
              })
            );
          } catch {
            try {
              ws.close();
            } catch {}
            return;
          }
          if (presenceHeartbeatTimer) clearInterval(presenceHeartbeatTimer);
          presenceHeartbeatTimer = setInterval(() => {
            if (!presenceSocket || presenceSocket.readyState !== 1) return;
            presenceRef += 1;
            try {
              presenceSocket.send(
                JSON.stringify({
                  topic: "phoenix",
                  event: "heartbeat",
                  payload: {},
                  ref: String(presenceRef)
                })
              );
            } catch {}
          }, 25_000);
        };
        ws.onmessage = (ev) => {
          const change = parsePresenceRealtimeMessage(ev && ev.data);
          if (!change) return;
          notifyPresenceChange(change);
        };
        ws.onclose = () => {
          if (presenceSocket === ws) presenceSocket = null;
          presenceConnecting = false;
          if (presenceHeartbeatTimer) {
            clearInterval(presenceHeartbeatTimer);
            presenceHeartbeatTimer = null;
          }
          schedulePresenceReconnect();
        };
        ws.onerror = () => {
          try {
            ws.close();
          } catch {}
        };
      })
      .catch(() => {
        presenceConnecting = false;
        schedulePresenceReconnect();
      });
  }

  function subscribePresencePings(onChange) {
    if (typeof onChange !== "function") return () => {};
    presenceListeners.add(onChange);
    presenceWanted = true;
    startPresenceSocket();
    return () => {
      presenceListeners.delete(onChange);
      if (!presenceListeners.size) stopPresenceRealtime();
    };
  }

  async function listPopularityContributions(resetAt) {
    if (netBlocked()) {
      const err = new Error("hub-net-blocked");
      err.hubNetBlocked = true;
      throw err;
    }
    const session = await ensureSession();
    if (!session?.access_token) return null;
    const reset = Number(resetAt) || 0;
    let url =
      `${SUPABASE_URL}/rest/v1/popularity_contributions?select=player_id,games,reset_at`;
    if (reset > 0) url += `&reset_at=eq.${encodeURIComponent(String(reset))}`;
    const res = await fetch(url, {
      headers: headers({}, session.access_token),
      cache: "no-store"
    });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`supabase popularity list ${res.status}`);
    const rows = await res.json();
    return Array.isArray(rows) ? rows : [];
  }

  async function upsertPopularityContribution(row) {
    const session = await ensureSession();
    const userId = sessionUserId(session);
    const playerId = parseLocalPlayerId(row?.playerId);
    if (!userId || !session?.access_token) throw new Error("supabase popularity needs a session");
    if (!playerId) throw new Error("bad popularity player id");
    if (netBlocked()) {
      const err = new Error("hub-net-blocked");
      err.hubNetBlocked = true;
      throw err;
    }
    const games =
      row?.games && typeof row.games === "object" && !Array.isArray(row.games) ? row.games : {};
    const res = await fetch(`${SUPABASE_URL}/rest/v1/popularity_contributions`, {
      method: "POST",
      headers: headers(
        {
          Prefer: "resolution=merge-duplicates,return=minimal"
        },
        session.access_token
      ),
      body: JSON.stringify({
        user_id: userId,
        player_id: playerId,
        games,
        reset_at: Number(row?.resetAt) >= 0 ? Math.floor(Number(row.resetAt)) : 0,
        updated_at: new Date().toISOString()
      })
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`supabase popularity upsert ${res.status} ${text}`);
    }
  }

  function sanitizePlayLog(plays, playerId) {
    const out = [];
    const seen = new Set();
    (Array.isArray(plays) ? plays : []).forEach((raw) => {
      if (!raw || typeof raw !== "object") return;
      const id = String(raw.id || "")
        .trim()
        .slice(0, 64);
      const fromId = String(raw.playerId || "").trim();
      const at = Math.floor(Number(raw.at) || 0);
      const game = String(raw.game || "")
        .trim()
        .slice(0, 32);
      if (!id || !at || !game) return;
      if (fromId && fromId !== playerId) return;
      if (seen.has(id)) return;
      seen.add(id);
      out.push({
        id,
        playerId,
        name: String(raw.name || "")
          .replace(/[<>&"'`]/g, "")
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 16) || "Player",
        game,
        gameName: String(raw.gameName || game)
          .trim()
          .slice(0, 48) || game,
        at
      });
    });
    return out.sort((a, b) => b.at - a.at).slice(0, 40);
  }

  async function listPlayLogContributions() {
    if (netBlocked()) {
      const err = new Error("hub-net-blocked");
      err.hubNetBlocked = true;
      throw err;
    }
    const session = await ensureSession();
    if (!session?.access_token) return null;
    const url = `${SUPABASE_URL}/rest/v1/play_log_contributions?select=player_id,plays`;
    const res = await fetch(url, {
      headers: headers({}, session.access_token),
      cache: "no-store"
    });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`supabase play log list ${res.status}`);
    const rows = await res.json();
    return Array.isArray(rows) ? rows : [];
  }

  async function upsertPlayLogContribution(row) {
    const session = await ensureSession();
    const userId = sessionUserId(session);
    const playerId = parseLocalPlayerId(row?.playerId);
    if (!userId || !session?.access_token) throw new Error("supabase play log needs a session");
    if (!playerId) throw new Error("bad play log player id");
    if (netBlocked()) {
      const err = new Error("hub-net-blocked");
      err.hubNetBlocked = true;
      throw err;
    }
    const plays = sanitizePlayLog(row?.plays, playerId);
    const res = await fetch(`${SUPABASE_URL}/rest/v1/play_log_contributions`, {
      method: "POST",
      headers: headers(
        {
          Prefer: "resolution=merge-duplicates,return=minimal"
        },
        session.access_token
      ),
      body: JSON.stringify({
        user_id: userId,
        player_id: playerId,
        plays,
        updated_at: new Date().toISOString()
      })
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`supabase play log upsert ${res.status} ${text}`);
    }
  }

  async function listPlayerCodeClaims() {
    if (netBlocked()) {
      const err = new Error("hub-net-blocked");
      err.hubNetBlocked = true;
      throw err;
    }
    const session = await ensureSession();
    if (!session?.access_token) return null;
    const url = `${SUPABASE_URL}/rest/v1/player_code_claims?select=player_id,code,display_name,claimed_at`;
    const res = await fetch(url, {
      headers: headers({}, session.access_token),
      cache: "no-store"
    });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`supabase player code list ${res.status}`);
    const rows = await res.json();
    return Array.isArray(rows) ? rows : [];
  }

  async function getPlayerCodeClaim(code) {
    const session = await ensureSession();
    if (!session?.access_token) return null;
    const norm = String(code || "")
      .toUpperCase()
      .replace(/[^23456789ABCDEFGHJKLMNPQRSTUVWXYZ]/g, "")
      .slice(0, 8);
    if (norm.length !== 8) return null;
    if (netBlocked()) {
      const err = new Error("hub-net-blocked");
      err.hubNetBlocked = true;
      throw err;
    }
    const url =
      `${SUPABASE_URL}/rest/v1/player_code_claims?code=eq.${encodeURIComponent(norm)}` +
      `&select=player_id,code,display_name,claimed_at`;
    const res = await fetch(url, {
      headers: headers({}, session.access_token),
      cache: "no-store"
    });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`supabase player code get ${res.status}`);
    const rows = await res.json();
    return Array.isArray(rows) && rows[0] ? rows[0] : null;
  }

  async function upsertPlayerCodeClaim(row) {
    const session = await ensureSession();
    const userId = sessionUserId(session);
    const playerId = parseLocalPlayerId(row?.playerId);
    const code = String(row?.code || "")
      .toUpperCase()
      .replace(/[^23456789ABCDEFGHJKLMNPQRSTUVWXYZ]/g, "")
      .slice(0, 8);
    if (!userId || !session?.access_token) throw new Error("supabase player code needs a session");
    if (!playerId) throw new Error("bad player code player id");
    if (code.length !== 8) throw new Error("bad player code");
    if (netBlocked()) {
      const err = new Error("hub-net-blocked");
      err.hubNetBlocked = true;
      throw err;
    }
    const res = await fetch(`${SUPABASE_URL}/rest/v1/player_code_claims`, {
      method: "POST",
      headers: headers(
        {
          Prefer: "resolution=merge-duplicates,return=minimal"
        },
        session.access_token
      ),
      body: JSON.stringify({
        user_id: userId,
        player_id: playerId,
        code,
        display_name: String(row?.displayName || "")
          .replace(/[<>&"'`]/g, "")
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 32),
        claimed_at: new Date().toISOString()
      })
    });
    if (res.status === 409) {
      const err = new Error("player code taken");
      err.codeTaken = true;
      throw err;
    }
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`supabase player code upsert ${res.status} ${text}`);
    }
  }

  async function listNicknameClaims() {
    if (netBlocked()) {
      const err = new Error("hub-net-blocked");
      err.hubNetBlocked = true;
      throw err;
    }
    const session = await ensureSession();
    if (!session?.access_token) return null;
    const url = `${SUPABASE_URL}/rest/v1/nickname_claims?select=player_id,name_key,claim`;
    const res = await fetch(url, {
      headers: headers({}, session.access_token),
      cache: "no-store"
    });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`supabase nickname list ${res.status}`);
    const rows = await res.json();
    return Array.isArray(rows) ? rows : [];
  }

  async function upsertNicknameClaim(row) {
    const session = await ensureSession();
    const userId = sessionUserId(session);
    const playerId = parseLocalPlayerId(row?.playerId);
    const nameKey = String(row?.nameKey || "")
      .toLowerCase()
      .trim()
      .slice(0, 16);
    if (!userId || !session?.access_token) throw new Error("supabase nickname needs a session");
    if (!playerId) throw new Error("bad nickname player id");
    if (!nameKey) throw new Error("bad nickname key");
    if (netBlocked()) {
      const err = new Error("hub-net-blocked");
      err.hubNetBlocked = true;
      throw err;
    }
    const claim =
      row?.claim && typeof row.claim === "object" && !Array.isArray(row.claim) ? row.claim : {};
    const res = await fetch(`${SUPABASE_URL}/rest/v1/nickname_claims`, {
      method: "POST",
      headers: headers(
        {
          Prefer: "resolution=merge-duplicates,return=minimal"
        },
        session.access_token
      ),
      body: JSON.stringify({
        user_id: userId,
        player_id: playerId,
        name_key: nameKey,
        claim,
        updated_at: new Date().toISOString()
      })
    });
    if (res.status === 409) {
      const err = new Error("nickname taken");
      err.nameTaken = true;
      throw err;
    }
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`supabase nickname upsert ${res.status} ${text}`);
    }
  }

  async function listNameReservationLocks() {
    if (netBlocked()) {
      const err = new Error("hub-net-blocked");
      err.hubNetBlocked = true;
      throw err;
    }
    const session = await ensureSession();
    if (!session?.access_token) return null;
    const url =
      `${SUPABASE_URL}/rest/v1/name_reservation_locks?select=player_id,name_key,code,display_name,locked_at`;
    const res = await fetch(url, {
      headers: headers({}, session.access_token),
      cache: "no-store"
    });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`supabase reservation list ${res.status}`);
    const rows = await res.json();
    return Array.isArray(rows) ? rows : [];
  }

  async function upsertNameReservationLock(row) {
    const session = await ensureSession();
    const userId = sessionUserId(session);
    const playerId = parseLocalPlayerId(row?.playerId);
    const nameKey = String(row?.nameKey || "")
      .toLowerCase()
      .trim()
      .slice(0, 16);
    const code = String(row?.code || "")
      .toUpperCase()
      .replace(/[^23456789ABCDEFGHJKLMNPQRSTUVWXYZ]/g, "")
      .slice(0, 8);
    if (!userId || !session?.access_token) throw new Error("supabase reservation needs a session");
    if (!playerId) throw new Error("bad reservation player id");
    if (!nameKey) throw new Error("bad reservation name");
    if (code.length !== 8) throw new Error("bad reservation code");
    if (netBlocked()) {
      const err = new Error("hub-net-blocked");
      err.hubNetBlocked = true;
      throw err;
    }
    const res = await fetch(`${SUPABASE_URL}/rest/v1/name_reservation_locks`, {
      method: "POST",
      headers: headers(
        {
          Prefer: "resolution=merge-duplicates,return=minimal"
        },
        session.access_token
      ),
      body: JSON.stringify({
        user_id: userId,
        player_id: playerId,
        name_key: nameKey,
        code,
        display_name: String(row?.displayName || "")
          .replace(/[<>&"'`]/g, "")
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 32),
        locked_at: row?.lockedAt
          ? new Date(Number(row.lockedAt) || Date.now()).toISOString()
          : new Date().toISOString()
      })
    });
    if (res.status === 409) {
      const err = new Error("reservation taken");
      err.nameTaken = true;
      throw err;
    }
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`supabase reservation upsert ${res.status} ${text}`);
    }
  }

  async function listPlayerPasswordHashes() {
    if (netBlocked()) {
      const err = new Error("hub-net-blocked");
      err.hubNetBlocked = true;
      throw err;
    }
    const session = await ensureSession();
    if (!session?.access_token) return null;
    const url =
      `${SUPABASE_URL}/rest/v1/player_password_hashes?select=player_id,password_hash,code,display_name,hashed_at,cleared`;
    const res = await fetch(url, {
      headers: headers({}, session.access_token),
      cache: "no-store"
    });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`supabase password list ${res.status}`);
    const rows = await res.json();
    return Array.isArray(rows) ? rows : [];
  }

  function normalizeStoredPasswordHash(raw) {
    const hash = String(raw || "").trim();
    if (/^[0-9a-f]{64}$/i.test(hash)) return hash.toLowerCase();
    if (/^f:[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{16}$/.test(hash)) return hash;
    return "";
  }

  async function upsertPlayerPasswordHash(row) {
    const session = await ensureSession();
    const userId = sessionUserId(session);
    const playerId = parseLocalPlayerId(row?.playerId);
    const cleared = !!row?.cleared;
    const passwordHash = cleared ? null : normalizeStoredPasswordHash(row?.passwordHash);
    if (!userId || !session?.access_token) throw new Error("supabase password needs a session");
    if (!playerId) throw new Error("bad password player id");
    if (!cleared && !passwordHash) throw new Error("bad password hash");
    if (netBlocked()) {
      const err = new Error("hub-net-blocked");
      err.hubNetBlocked = true;
      throw err;
    }
    const code = String(row?.code || "")
      .toUpperCase()
      .replace(/[^23456789ABCDEFGHJKLMNPQRSTUVWXYZ]/g, "")
      .slice(0, 8);
    const res = await fetch(`${SUPABASE_URL}/rest/v1/player_password_hashes`, {
      method: "POST",
      headers: headers(
        {
          Prefer: "resolution=merge-duplicates,return=minimal"
        },
        session.access_token
      ),
      body: JSON.stringify({
        user_id: userId,
        player_id: playerId,
        password_hash: passwordHash,
        code: code.length === 8 ? code : "",
        display_name: String(row?.displayName || "")
          .replace(/[<>&"'`]/g, "")
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 32),
        cleared,
        hashed_at: row?.hashedAt
          ? new Date(Number(row.hashedAt) || Date.now()).toISOString()
          : new Date().toISOString()
      })
    });
    if (res.status === 409) {
      const err = new Error("password hash taken");
      err.hashTaken = true;
      throw err;
    }
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`supabase password upsert ${res.status} ${text}`);
    }
  }

  async function listAlltimeRoster() {
    if (netBlocked()) {
      const err = new Error("hub-net-blocked");
      err.hubNetBlocked = true;
      throw err;
    }
    const session = await ensureSession();
    if (!session?.access_token) return null;
    const url =
      `${SUPABASE_URL}/rest/v1/alltime_roster?select=player_id,display_name,first_at,last_at`;
    const res = await fetch(url, {
      headers: headers({}, session.access_token),
      cache: "no-store"
    });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`supabase alltime list ${res.status}`);
    const rows = await res.json();
    return Array.isArray(rows) ? rows : [];
  }

  async function upsertAlltimeRoster(row) {
    const session = await ensureSession();
    const userId = sessionUserId(session);
    const playerId = parseLocalPlayerId(row?.playerId);
    const firstAt = Math.floor(Number(row?.firstAt) || 0);
    const lastAt = Math.max(Math.floor(Number(row?.lastAt) || 0), firstAt);
    if (!userId || !session?.access_token) throw new Error("supabase alltime needs a session");
    if (!playerId) throw new Error("bad alltime player id");
    if (!firstAt) throw new Error("bad alltime first_at");
    if (netBlocked()) {
      const err = new Error("hub-net-blocked");
      err.hubNetBlocked = true;
      throw err;
    }
    const res = await fetch(`${SUPABASE_URL}/rest/v1/alltime_roster`, {
      method: "POST",
      headers: headers(
        {
          Prefer: "resolution=merge-duplicates,return=minimal"
        },
        session.access_token
      ),
      body: JSON.stringify({
        user_id: userId,
        player_id: playerId,
        display_name: String(row?.displayName || "")
          .replace(/[<>&"'`]/g, "")
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 32),
        first_at: firstAt,
        last_at: lastAt
      })
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`supabase alltime upsert ${res.status} ${text}`);
    }
  }

  function sanitizeCallRooms(rooms, playerId) {
    const me = String(playerId || "");
    const out = {};
    if (!me || !rooms || typeof rooms !== "object" || Array.isArray(rooms)) return out;
    Object.entries(rooms).forEach(([id, room]) => {
      if (Object.keys(out).length >= 20) return;
      const key = String(id || "")
        .trim()
        .slice(0, 96);
      if (!key || !room || typeof room !== "object" || Array.isArray(room)) return;
      const peers = room.peers && typeof room.peers === "object" && !Array.isArray(room.peers)
        ? room.peers
        : {};
      if (!Object.prototype.hasOwnProperty.call(peers, me)) return;
      out[key] = {
        kind: String(room.kind || "").slice(0, 16),
        channelId: String(room.channelId || "").slice(0, 80),
        createdAt: Number(room.createdAt) || 0,
        updatedAt: Number(room.updatedAt) || 0,
        peers,
        signals: Array.isArray(room.signals) ? room.signals.slice(-40) : [],
        links: room.links && typeof room.links === "object" && !Array.isArray(room.links)
          ? room.links
          : {}
      };
    });
    return out;
  }

  async function listCallSignalContributions() {
    if (netBlocked()) {
      const err = new Error("hub-net-blocked");
      err.hubNetBlocked = true;
      throw err;
    }
    const session = await ensureSession();
    if (!session?.access_token) return null;
    const url = `${SUPABASE_URL}/rest/v1/call_signal_contributions?select=player_id,rooms`;
    const res = await fetch(url, {
      headers: headers({}, session.access_token),
      cache: "no-store"
    });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`supabase call list ${res.status}`);
    const rows = await res.json();
    return Array.isArray(rows) ? rows : [];
  }

  async function upsertCallSignalContribution(row) {
    const session = await ensureSession();
    const userId = sessionUserId(session);
    const playerId = parseLocalPlayerId(row?.playerId);
    if (!userId || !session?.access_token) throw new Error("supabase call needs a session");
    if (!playerId) throw new Error("bad call player id");
    if (netBlocked()) {
      const err = new Error("hub-net-blocked");
      err.hubNetBlocked = true;
      throw err;
    }
    const rooms = sanitizeCallRooms(row?.rooms, playerId);
    const res = await fetch(`${SUPABASE_URL}/rest/v1/call_signal_contributions`, {
      method: "POST",
      headers: headers(
        {
          Prefer: "resolution=merge-duplicates,return=minimal"
        },
        session.access_token
      ),
      body: JSON.stringify({
        user_id: userId,
        player_id: playerId,
        rooms,
        updated_at: new Date().toISOString()
      })
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`supabase call upsert ${res.status} ${text}`);
    }
  }

  function sanitizeFriendMap(map) {
    const out = {};
    Object.entries(map && typeof map === "object" && !Array.isArray(map) ? map : {}).forEach(
      ([id, raw]) => {
        if (Object.keys(out).length >= 200) return;
        const playerId = String(id || "")
          .trim()
          .slice(0, 96);
        if (!playerId || !raw || typeof raw !== "object") return;
        const edge = {
          name: String(raw.name || "Player")
            .replace(/[<>&"'`]/g, "")
            .replace(/\s+/g, " ")
            .trim()
            .slice(0, 32) || "Player"
        };
        const at = Number(raw.at) || 0;
        const since = Number(raw.since) || 0;
        if (at) edge.at = at;
        if (since) edge.since = since;
        out[playerId] = edge;
      }
    );
    return out;
  }

  function sanitizeFriendInvites(map, playerId) {
    const out = {};
    Object.entries(map && typeof map === "object" && !Array.isArray(map) ? map : {}).forEach(
      ([id, raw]) => {
        if (Object.keys(out).length >= 80) return;
        if (!raw || typeof raw !== "object") return;
        const inviteId = String(raw.id || id || "")
          .trim()
          .slice(0, 64);
        const fromId = String(raw.fromId || "").trim();
        const toId = String(raw.toId || "").trim();
        if (!inviteId || !fromId || !toId) return;
        if (fromId !== playerId && toId !== playerId) return;
        out[inviteId] = {
          id: inviteId,
          fromId,
          fromName: String(raw.fromName || "Player")
            .replace(/[<>&"'`]/g, "")
            .replace(/\s+/g, " ")
            .trim()
            .slice(0, 32) || "Player",
          toId,
          toName: String(raw.toName || "Player")
            .replace(/[<>&"'`]/g, "")
            .replace(/\s+/g, " ")
            .trim()
            .slice(0, 32) || "Player",
          game: String(raw.game || "").trim().slice(0, 32),
          roomId: String(raw.roomId || "").trim().slice(0, 64),
          code: String(raw.code || "").trim().slice(0, 32),
          status: String(raw.status || "pending").trim().slice(0, 16) || "pending",
          at: Number(raw.at) || 0,
          respondedAt: Number(raw.respondedAt) || 0
        };
      }
    );
    return out;
  }

  async function listFriendEdgeContributions() {
    if (netBlocked()) {
      const err = new Error("hub-net-blocked");
      err.hubNetBlocked = true;
      throw err;
    }
    const session = await ensureSession();
    if (!session?.access_token) return null;
    const url =
      `${SUPABASE_URL}/rest/v1/friend_edge_contributions?select=player_id,display_name,friends,outgoing,incoming,invites,updated_at`;
    const res = await fetch(url, {
      headers: headers({}, session.access_token),
      cache: "no-store"
    });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`supabase friends list ${res.status}`);
    const rows = await res.json();
    return Array.isArray(rows) ? rows : [];
  }

  async function upsertFriendEdgeContribution(row) {
    const session = await ensureSession();
    const userId = sessionUserId(session);
    const playerId = parseLocalPlayerId(row?.playerId);
    if (!userId || !session?.access_token) throw new Error("supabase friends needs a session");
    if (!playerId) throw new Error("bad friends player id");
    if (netBlocked()) {
      const err = new Error("hub-net-blocked");
      err.hubNetBlocked = true;
      throw err;
    }
    const res = await fetch(`${SUPABASE_URL}/rest/v1/friend_edge_contributions`, {
      method: "POST",
      headers: headers(
        {
          Prefer: "resolution=merge-duplicates,return=minimal"
        },
        session.access_token
      ),
      body: JSON.stringify({
        user_id: userId,
        player_id: playerId,
        display_name: String(row?.displayName || row?.name || "")
          .replace(/[<>&"'`]/g, "")
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 32),
        friends: sanitizeFriendMap(row?.friends),
        outgoing: sanitizeFriendMap(row?.outgoing),
        incoming: sanitizeFriendMap(row?.incoming),
        invites: sanitizeFriendInvites(row?.invites, playerId),
        updated_at: new Date().toISOString()
      })
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`supabase friends upsert ${res.status} ${text}`);
    }
  }

  function sanitizeChatMessage(raw) {
    if (!raw || typeof raw !== "object") return null;
    const id = String(raw.id || "")
      .trim()
      .slice(0, 64);
    const from = String(raw.from || "").trim();
    const text = String(raw.text || "")
      .replace(/[<>&"'`]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 200);
    const at = Number(raw.at) || 0;
    if (!id || !from || !text || !at) return null;
    return {
      id,
      from,
      name: String(raw.name || "")
        .replace(/[<>&"'`]/g, "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 16),
      text,
      at
    };
  }

  function sanitizeChatThreads(threads, playerId) {
    const me = String(playerId || "");
    const out = {};
    if (!me || !threads || typeof threads !== "object" || Array.isArray(threads)) return out;
    const entries = Object.entries(threads);
    const scored = entries
      .map(([key, thread]) => {
        const id = String(key || "")
          .trim()
          .slice(0, 96);
        if (!id || !thread || typeof thread !== "object" || Array.isArray(thread)) return null;
        const messages = (Array.isArray(thread.messages) ? thread.messages : [])
          .map(sanitizeChatMessage)
          .filter(Boolean)
          .sort((a, b) => a.at - b.at)
          .slice(-100);
        if (id === "global") {
          if (!messages.length) return null;
          return { key: id, activity: messages[messages.length - 1].at, value: { type: "global", messages } };
        }
        if (id.startsWith("group:")) {
          const members = {};
          Object.entries(
            thread.members && typeof thread.members === "object" && !Array.isArray(thread.members)
              ? thread.members
              : {}
          ).forEach(([memberId, name]) => {
            const pid = String(memberId || "").trim();
            if (!pid) return;
            members[pid] = String(name || "Player")
              .replace(/[<>&"'`]/g, "")
              .replace(/\s+/g, " ")
              .trim()
              .slice(0, 16) || "Player";
          });
          if (!Object.prototype.hasOwnProperty.call(members, me)) return null;
          if (!messages.length && !Object.keys(members).length) return null;
          return {
            key: id,
            activity: messages.length ? messages[messages.length - 1].at : Number(thread.createdAt) || 0,
            value: {
              type: "group",
              name:
                String(thread.name || "Group")
                  .replace(/[<>&"'`]/g, "")
                  .replace(/\s+/g, " ")
                  .trim()
                  .slice(0, 24) || "Group",
              members,
              createdBy: String(thread.createdBy || "").slice(0, 96),
              createdAt: Number(thread.createdAt) || 0,
              messages
            }
          };
        }
        const parts = id.split(":");
        if (parts.length !== 2 || (parts[0] !== me && parts[1] !== me)) return null;
        if (!messages.length) return null;
        return {
          key: id,
          activity: messages[messages.length - 1].at,
          value: { messages }
        };
      })
      .filter(Boolean)
      .sort((a, b) => {
        if (a.key === "global") return -1;
        if (b.key === "global") return 1;
        return b.activity - a.activity;
      })
      .slice(0, 40);
    scored.forEach((item) => {
      out[item.key] = item.value;
    });
    return out;
  }

  async function listChatThreadContributions() {
    if (netBlocked()) {
      const err = new Error("hub-net-blocked");
      err.hubNetBlocked = true;
      throw err;
    }
    const session = await ensureSession();
    if (!session?.access_token) return null;
    const url = `${SUPABASE_URL}/rest/v1/chat_thread_contributions?select=player_id,threads,updated_at`;
    const res = await fetch(url, {
      headers: headers({}, session.access_token),
      cache: "no-store"
    });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`supabase chat list ${res.status}`);
    const rows = await res.json();
    return Array.isArray(rows) ? rows : [];
  }

  async function upsertChatThreadContribution(row) {
    const session = await ensureSession();
    const userId = sessionUserId(session);
    const playerId = parseLocalPlayerId(row?.playerId);
    if (!userId || !session?.access_token) throw new Error("supabase chat needs a session");
    if (!playerId) throw new Error("bad chat player id");
    if (netBlocked()) {
      const err = new Error("hub-net-blocked");
      err.hubNetBlocked = true;
      throw err;
    }
    const threads = sanitizeChatThreads(row?.threads, playerId);
    const res = await fetch(`${SUPABASE_URL}/rest/v1/chat_thread_contributions`, {
      method: "POST",
      headers: headers(
        {
          Prefer: "resolution=merge-duplicates,return=minimal"
        },
        session.access_token
      ),
      body: JSON.stringify({
        user_id: userId,
        player_id: playerId,
        threads,
        updated_at: new Date().toISOString()
      })
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`supabase chat upsert ${res.status} ${text}`);
    }
  }

  function sanitizeLeaderboardEntry(raw, playerId) {
    if (!raw || typeof raw !== "object") return null;
    const score = Number(raw.score);
    const name = String(raw.name || "")
      .replace(/[<>&"'`]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 16);
    if (!name || !Number.isFinite(score)) return null;
    const owner = String(raw.playerId || "").trim();
    if (owner && owner !== playerId) return null;
    const out = {
      name,
      score,
      at: Number(raw.at) || 0,
      playerId,
      lowerBetter: !!raw.lowerBetter
    };
    if (Number(raw.bornAt) > 0) out.bornAt = Number(raw.bornAt);
    if (raw.fishing && typeof raw.fishing === "object") {
      out.fishing = {
        id: String(raw.fishing.id || "").slice(0, 64),
        name: String(raw.fishing.name || "").slice(0, 48),
        rarity: String(raw.fishing.rarity || "").slice(0, 24),
        value: Number(raw.fishing.value) || 0,
        variant: String(raw.fishing.variant || "").slice(0, 24),
        shiny: !!raw.fishing.shiny,
        mutation: String(raw.fishing.mutation || "").slice(0, 24)
      };
    }
    return out;
  }

  function sanitizeLeaderboardGames(games, playerId) {
    const out = {};
    const me = String(playerId || "");
    if (!me || !games || typeof games !== "object" || Array.isArray(games)) return out;
    Object.entries(games).forEach(([gameId, raw]) => {
      if (Object.keys(out).length >= 80) return;
      const id = String(gameId || "")
        .trim()
        .slice(0, 32);
      if (!id) return;
      const entry = sanitizeLeaderboardEntry(raw, me);
      if (entry) out[id] = entry;
    });
    return out;
  }

  async function listLeaderboardPbContributions() {
    if (netBlocked()) {
      const err = new Error("hub-net-blocked");
      err.hubNetBlocked = true;
      throw err;
    }
    const session = await ensureSession();
    if (!session?.access_token) return null;
    const url = `${SUPABASE_URL}/rest/v1/leaderboard_pb_contributions?select=player_id,games,updated_at`;
    const res = await fetch(url, {
      headers: headers({}, session.access_token),
      cache: "no-store"
    });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`supabase leaderboard list ${res.status}`);
    const rows = await res.json();
    return Array.isArray(rows) ? rows : [];
  }

  async function upsertLeaderboardPbContribution(row) {
    const session = await ensureSession();
    const userId = sessionUserId(session);
    const playerId = parseLocalPlayerId(row?.playerId);
    if (!userId || !session?.access_token) throw new Error("supabase leaderboard needs a session");
    if (!playerId) throw new Error("bad leaderboard player id");
    if (netBlocked()) {
      const err = new Error("hub-net-blocked");
      err.hubNetBlocked = true;
      throw err;
    }
    const games = sanitizeLeaderboardGames(row?.games, playerId);
    const res = await fetch(`${SUPABASE_URL}/rest/v1/leaderboard_pb_contributions`, {
      method: "POST",
      headers: headers(
        {
          Prefer: "resolution=merge-duplicates,return=minimal"
        },
        session.access_token
      ),
      body: JSON.stringify({
        user_id: userId,
        player_id: playerId,
        games,
        updated_at: new Date().toISOString()
      })
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`supabase leaderboard upsert ${res.status} ${text}`);
    }
  }

  function sanitizeMatchSeat(seat) {
    if (!seat || typeof seat !== "object") return null;
    const playerId = String(seat.playerId || "").trim();
    if (!playerId) return null;
    return {
      playerId,
      name:
        String(seat.name || "Player")
          .replace(/[<>&"'`]/g, "")
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 16) || "Player"
    };
  }

  function sanitizeMatchRooms(rooms, playerId) {
    const me = String(playerId || "");
    const out = {};
    if (!me || !rooms || typeof rooms !== "object" || Array.isArray(rooms)) return out;
    Object.entries(rooms).forEach(([id, raw]) => {
      if (Object.keys(out).length >= 20) return;
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) return;
      const roomId = String(raw.id || id || "")
        .trim()
        .slice(0, 64);
      const game = String(raw.game || "").trim();
      if (!roomId || (game !== "tictactoe" && game !== "connect-four")) return;
      const host = sanitizeMatchSeat(raw.host);
      const guest = sanitizeMatchSeat(raw.guest);
      if (!host) return;
      if (host.playerId !== me && (!guest || guest.playerId !== me)) return;
      const status = String(raw.status || "waiting");
      if (status !== "waiting" && status !== "playing" && status !== "finished") return;
      out[roomId] = {
        id: roomId,
        game,
        code: String(raw.code || "").trim().slice(0, 8),
        queue: raw.queue === "quick" ? "quick" : "private",
        status,
        state: raw.state && typeof raw.state === "object" ? raw.state : {},
        turn: raw.turn === 2 ? 2 : 1,
        host,
        guest,
        result: raw.result == null ? null : raw.result,
        createdAt: Number(raw.createdAt) || 0,
        updatedAt: Number(raw.updatedAt) || Number(raw.createdAt) || 0
      };
    });
    return out;
  }

  async function listMatchRoomContributions() {
    if (netBlocked()) {
      const err = new Error("hub-net-blocked");
      err.hubNetBlocked = true;
      throw err;
    }
    const session = await ensureSession();
    if (!session?.access_token) return null;
    const url = `${SUPABASE_URL}/rest/v1/match_room_contributions?select=player_id,rooms,updated_at`;
    const res = await fetch(url, {
      headers: headers({}, session.access_token),
      cache: "no-store"
    });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`supabase match list ${res.status}`);
    const rows = await res.json();
    return Array.isArray(rows) ? rows : [];
  }

  async function upsertMatchRoomContribution(row) {
    const session = await ensureSession();
    const userId = sessionUserId(session);
    const playerId = parseLocalPlayerId(row?.playerId);
    if (!userId || !session?.access_token) throw new Error("supabase match needs a session");
    if (!playerId) throw new Error("bad match player id");
    if (netBlocked()) {
      const err = new Error("hub-net-blocked");
      err.hubNetBlocked = true;
      throw err;
    }
    const rooms = sanitizeMatchRooms(row?.rooms, playerId);
    const res = await fetch(`${SUPABASE_URL}/rest/v1/match_room_contributions`, {
      method: "POST",
      headers: headers(
        {
          Prefer: "resolution=merge-duplicates,return=minimal"
        },
        session.access_token
      ),
      body: JSON.stringify({
        user_id: userId,
        player_id: playerId,
        rooms,
        updated_at: new Date().toISOString()
      })
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`supabase match upsert ${res.status} ${text}`);
    }
  }

  function sanitizeFeedbackItems(items, playerId) {
    const me = String(playerId || "");
    const out = [];
    const seen = new Set();
    if (!me) return out;
    (Array.isArray(items) ? items : []).forEach((raw) => {
      if (out.length >= 40) return;
      if (!raw || typeof raw !== "object") return;
      const id = String(raw.id || "")
        .trim()
        .slice(0, 64);
      const fromId = String(raw.fromId || me).trim();
      const text = String(raw.text || "")
        .replace(/[<>&"'`]/g, "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 400);
      const at = Number(raw.at) || 0;
      if (!id || !text || !at || fromId !== me || seen.has(id)) return;
      seen.add(id);
      const type = String(raw.type || "idea").toLowerCase();
      out.push({
        id,
        fromId: me,
        fromName:
          String(raw.fromName || "Player")
            .replace(/[<>&"'`]/g, "")
            .replace(/\s+/g, " ")
            .trim()
            .slice(0, 16) || "Player",
        type: type === "bug" || type === "idea" || type === "other" ? type : "idea",
        game: String(raw.game || "")
          .replace(/[<>&"'`]/g, "")
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 32),
        text,
        at
      });
    });
    return out.sort((a, b) => b.at - a.at).slice(0, 40);
  }

  async function listFeedbackItemContributions() {
    if (netBlocked()) {
      const err = new Error("hub-net-blocked");
      err.hubNetBlocked = true;
      throw err;
    }
    const session = await ensureSession();
    if (!session?.access_token) return null;
    const url = `${SUPABASE_URL}/rest/v1/feedback_item_contributions?select=player_id,items,updated_at`;
    const res = await fetch(url, {
      headers: headers({}, session.access_token),
      cache: "no-store"
    });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`supabase feedback list ${res.status}`);
    const rows = await res.json();
    return Array.isArray(rows) ? rows : [];
  }

  async function upsertFeedbackItemContribution(row) {
    const session = await ensureSession();
    const userId = sessionUserId(session);
    const playerId = parseLocalPlayerId(row?.playerId);
    if (!userId || !session?.access_token) throw new Error("supabase feedback needs a session");
    if (!playerId) throw new Error("bad feedback player id");
    if (netBlocked()) {
      const err = new Error("hub-net-blocked");
      err.hubNetBlocked = true;
      throw err;
    }
    const items = sanitizeFeedbackItems(row?.items, playerId);
    const res = await fetch(`${SUPABASE_URL}/rest/v1/feedback_item_contributions`, {
      method: "POST",
      headers: headers(
        {
          Prefer: "resolution=merge-duplicates,return=minimal"
        },
        session.access_token
      ),
      body: JSON.stringify({
        user_id: userId,
        player_id: playerId,
        items,
        updated_at: new Date().toISOString()
      })
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`supabase feedback upsert ${res.status} ${text}`);
    }
  }

  function sanitizeCommunityWeekKey(raw) {
    return String(raw || "")
      .replace(/[^a-zA-Z0-9-]/g, "")
      .slice(0, 64);
  }

  function sanitizeCommunityCasts(raw) {
    const n = Math.floor(Number(raw) || 0);
    if (n < 0) return 0;
    return Math.min(10000, n);
  }

  async function listCommunityCastContributions() {
    if (netBlocked()) {
      const err = new Error("hub-net-blocked");
      err.hubNetBlocked = true;
      throw err;
    }
    const session = await ensureSession();
    if (!session?.access_token) return null;
    const url = `${SUPABASE_URL}/rest/v1/community_cast_contributions?select=player_id,week_key,casts,updated_at`;
    const res = await fetch(url, {
      headers: headers({}, session.access_token),
      cache: "no-store"
    });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`supabase community list ${res.status}`);
    const rows = await res.json();
    return Array.isArray(rows) ? rows : [];
  }

  async function upsertCommunityCastContribution(row) {
    const session = await ensureSession();
    const userId = sessionUserId(session);
    const playerId = parseLocalPlayerId(row?.playerId);
    const weekKey = sanitizeCommunityWeekKey(row?.weekKey);
    if (!userId || !session?.access_token) throw new Error("supabase community needs a session");
    if (!playerId) throw new Error("bad community player id");
    if (!weekKey) throw new Error("bad community week key");
    if (netBlocked()) {
      const err = new Error("hub-net-blocked");
      err.hubNetBlocked = true;
      throw err;
    }
    const casts = sanitizeCommunityCasts(row?.casts);
    const res = await fetch(`${SUPABASE_URL}/rest/v1/community_cast_contributions`, {
      method: "POST",
      headers: headers(
        {
          Prefer: "resolution=merge-duplicates,return=minimal"
        },
        session.access_token
      ),
      body: JSON.stringify({
        user_id: userId,
        player_id: playerId,
        week_key: weekKey,
        casts,
        updated_at: new Date().toISOString()
      })
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`supabase community upsert ${res.status} ${text}`);
    }
  }

  function sanitizeFishingMailItem(raw) {
    if (!raw || typeof raw !== "object") return null;
    const kind = String(raw.kind || "").toLowerCase();
    if (kind === "fish") {
      const fishId = String(raw.fishId || "")
        .trim()
        .slice(0, 32);
      if (!fishId) return null;
      return {
        kind: "fish",
        fishId,
        variant: String(raw.variant || "")
          .toLowerCase()
          .slice(0, 16),
        shiny: !!raw.shiny,
        mutation: String(raw.mutation || "")
          .toLowerCase()
          .slice(0, 16),
        perfect: !!raw.perfect
      };
    }
    if (kind === "chest") {
      return {
        kind: "chest",
        chestKind: String(raw.chestKind || "money") === "luck" ? "luck" : "money",
        count: Math.min(50, Math.max(1, Math.floor(Number(raw.count) || 1)))
      };
    }
    if (kind === "luckyblock") {
      const t = String(raw.lbType || "absolute").toLowerCase();
      return {
        kind: "luckyblock",
        lbType: t === "zenith" || t === "astral" ? t : "absolute",
        count: Math.min(50, Math.max(1, Math.floor(Number(raw.count) || 1)))
      };
    }
    return null;
  }

  function sanitizeFishingMailGifts(gifts, playerId) {
    const me = String(playerId || "");
    const out = {};
    if (!me) return out;
    Object.entries(gifts && typeof gifts === "object" && !Array.isArray(gifts) ? gifts : {}).forEach(
      ([key, raw]) => {
        if (Object.keys(out).length >= 40) return;
        if (!raw || typeof raw !== "object") return;
        const id = String(raw.id || key || "")
          .trim()
          .slice(0, 64);
        const fromId = String(raw.fromId || "").trim();
        const toPlayerId = String(raw.toPlayerId || "").trim();
        if (!id || (fromId !== me && toPlayerId !== me)) return;
        const items = (Array.isArray(raw.items) ? raw.items : [])
          .map(sanitizeFishingMailItem)
          .filter(Boolean)
          .slice(0, 8);
        if (!items.length) return;
        out[id] = {
          id,
          fromId,
          fromName: String(raw.fromName || "").slice(0, 48),
          toPlayerId,
          toName: String(raw.toName || "")
            .toLowerCase()
            .slice(0, 48),
          toDisplay: String(raw.toDisplay || "").slice(0, 48),
          items,
          at: Math.max(0, Number(raw.at) || 0),
          claimed: !!raw.claimed,
          claimedBy: String(raw.claimedBy || "").slice(0, 64),
          claimedAt: Math.max(0, Number(raw.claimedAt) || 0)
        };
      }
    );
    return out;
  }

  function sanitizeFishingMailTrades(trades, playerId) {
    const me = String(playerId || "");
    const out = {};
    if (!me) return out;
    Object.entries(trades && typeof trades === "object" && !Array.isArray(trades) ? trades : {}).forEach(
      ([key, raw]) => {
        if (Object.keys(out).length >= 20) return;
        if (!raw || typeof raw !== "object") return;
        const id = String(raw.id || key || "")
          .trim()
          .slice(0, 64);
        const aId = String(raw.aId || "").trim();
        const bId = String(raw.bId || "").trim();
        if (!id || !aId || !bId || (aId !== me && bId !== me)) return;
        const statusRaw = String(raw.status || "open");
        out[id] = {
          id,
          aId,
          aName: String(raw.aName || "").slice(0, 48),
          bId,
          bName: String(raw.bName || "").slice(0, 48),
          aItems: (Array.isArray(raw.aItems) ? raw.aItems : [])
            .map(sanitizeFishingMailItem)
            .filter(Boolean)
            .slice(0, 8),
          bItems: (Array.isArray(raw.bItems) ? raw.bItems : [])
            .map(sanitizeFishingMailItem)
            .filter(Boolean)
            .slice(0, 8),
          aAccept: !!raw.aAccept,
          bAccept: !!raw.bAccept,
          status: statusRaw === "done" || statusRaw === "cancelled" ? statusRaw : "open",
          at: Math.max(0, Number(raw.at) || 0),
          updatedAt: Math.max(0, Number(raw.updatedAt) || Number(raw.at) || 0),
          appliedBy:
            raw.appliedBy && typeof raw.appliedBy === "object" && !Array.isArray(raw.appliedBy)
              ? raw.appliedBy
              : {},
          restoredBy:
            raw.restoredBy && typeof raw.restoredBy === "object" && !Array.isArray(raw.restoredBy)
              ? raw.restoredBy
              : {},
          note: String(raw.note || "").slice(0, 32)
        };
      }
    );
    return out;
  }

  async function listFishingMailContributions() {
    if (netBlocked()) {
      const err = new Error("hub-net-blocked");
      err.hubNetBlocked = true;
      throw err;
    }
    const session = await ensureSession();
    if (!session?.access_token) return null;
    const url = `${SUPABASE_URL}/rest/v1/fishing_mail_contributions?select=player_id,gifts,trades,updated_at`;
    const res = await fetch(url, {
      headers: headers({}, session.access_token),
      cache: "no-store"
    });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`supabase fishing mail list ${res.status}`);
    const rows = await res.json();
    return Array.isArray(rows) ? rows : [];
  }

  async function upsertFishingMailContribution(row) {
    const session = await ensureSession();
    const userId = sessionUserId(session);
    const playerId = parseLocalPlayerId(row?.playerId);
    if (!userId || !session?.access_token) throw new Error("supabase fishing mail needs a session");
    if (!playerId) throw new Error("bad fishing mail player id");
    if (netBlocked()) {
      const err = new Error("hub-net-blocked");
      err.hubNetBlocked = true;
      throw err;
    }
    const gifts = sanitizeFishingMailGifts(row?.gifts, playerId);
    const trades = sanitizeFishingMailTrades(row?.trades, playerId);
    const res = await fetch(`${SUPABASE_URL}/rest/v1/fishing_mail_contributions`, {
      method: "POST",
      headers: headers(
        {
          Prefer: "resolution=merge-duplicates,return=minimal"
        },
        session.access_token
      ),
      body: JSON.stringify({
        user_id: userId,
        player_id: playerId,
        gifts,
        trades,
        updated_at: new Date().toISOString()
      })
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`supabase fishing mail upsert ${res.status} ${text}`);
    }
  }

  function isAdminBroadcastGift(g) {
    if (!g || typeof g !== "object") return false;
    if (g.broadcast) return true;
    const toName = String(g.toName || "").toLowerCase();
    return (
      toName === "*" ||
      toName === "everyone" ||
      toName === "everybody" ||
      toName === "all" ||
      toName === "all players" ||
      toName === "global" ||
      toName === "players"
    );
  }

  function sanitizeAdminFishGifts(gifts, playerId) {
    const me = String(playerId || "");
    const out = {};
    if (!me) return out;
    Object.entries(gifts && typeof gifts === "object" && !Array.isArray(gifts) ? gifts : {}).forEach(
      ([key, raw]) => {
        if (Object.keys(out).length >= 40) return;
        if (!raw || typeof raw !== "object") return;
        const id = String(raw.id || key || "")
          .trim()
          .slice(0, 64);
        const fishId = String(raw.fishId || "").slice(0, 32);
        const item = String(raw.item || "").slice(0, 32);
        if (!id || (!fishId && !item)) return;
        const fromId = String(raw.fromId || "").trim();
        const toPlayerId = String(raw.toPlayerId || "").trim();
        const broadcast = isAdminBroadcastGift(raw);
        const claimedByObj =
          raw.claimedBy && typeof raw.claimedBy === "object" && !Array.isArray(raw.claimedBy)
            ? raw.claimedBy
            : null;
        const claimedMe = !!(
          (claimedByObj && claimedByObj[me]) ||
          String(raw.claimedBy || "").trim() === me
        );
        if (fromId !== me && toPlayerId !== me && !(broadcast && claimedMe)) return;
        const claimedAt = Math.max(0, Number(raw.claimedAt) || 0);
        out[id] = {
          id,
          toName: String(raw.toName || "")
            .toLowerCase()
            .slice(0, 48),
          toPlayerId,
          toDisplay: String(raw.toDisplay || "").slice(0, 48),
          from: String(raw.from || "ICE_DRAGON").slice(0, 48),
          fromId,
          fishId,
          item,
          variant: String(raw.variant || "")
            .toLowerCase()
            .slice(0, 16),
          shiny: !!raw.shiny,
          mutation: String(raw.mutation || "")
            .toLowerCase()
            .slice(0, 16),
          perfect: !!raw.perfect,
          count: Math.min(50, Math.max(1, Math.floor(Number(raw.count) || 1))),
          at: Math.max(0, Number(raw.at) || 0),
          broadcast,
          onlineOnly: !!raw.onlineOnly,
          onlineIds: Array.isArray(raw.onlineIds) ? raw.onlineIds.map(String).slice(0, 80) : [],
          onlineNames: Array.isArray(raw.onlineNames)
            ? raw.onlineNames.map((name) => String(name || "").toLowerCase()).slice(0, 80)
            : [],
          claimed: broadcast ? false : !!raw.claimed,
          claimedBy: broadcast
            ? claimedByObj || {}
            : String(raw.claimedBy || "").slice(0, 64),
          claimedAt
        };
      }
    );
    return out;
  }

  async function listFishingGiftContributions() {
    if (netBlocked()) {
      const err = new Error("hub-net-blocked");
      err.hubNetBlocked = true;
      throw err;
    }
    const session = await ensureSession();
    if (!session?.access_token) return null;
    const url = `${SUPABASE_URL}/rest/v1/fishing_gift_contributions?select=player_id,gifts,updated_at`;
    const res = await fetch(url, {
      headers: headers({}, session.access_token),
      cache: "no-store"
    });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`supabase fishing gift list ${res.status}`);
    const rows = await res.json();
    return Array.isArray(rows) ? rows : [];
  }

  async function upsertFishingGiftContribution(row) {
    const session = await ensureSession();
    const userId = sessionUserId(session);
    const playerId = parseLocalPlayerId(row?.playerId);
    if (!userId || !session?.access_token) throw new Error("supabase fishing gift needs a session");
    if (!playerId) throw new Error("bad fishing gift player id");
    if (netBlocked()) {
      const err = new Error("hub-net-blocked");
      err.hubNetBlocked = true;
      throw err;
    }
    const gifts = sanitizeAdminFishGifts(row?.gifts, playerId);
    const res = await fetch(`${SUPABASE_URL}/rest/v1/fishing_gift_contributions`, {
      method: "POST",
      headers: headers(
        {
          Prefer: "resolution=merge-duplicates,return=minimal"
        },
        session.access_token
      ),
      body: JSON.stringify({
        user_id: userId,
        player_id: playerId,
        gifts,
        updated_at: new Date().toISOString()
      })
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`supabase fishing gift upsert ${res.status} ${text}`);
    }
  }

  function sanitizeAquariumTank(tank, playerId) {
    const me = String(playerId || "");
    if (!me || !tank || typeof tank !== "object" || Array.isArray(tank)) return {};
    const tankId = String(tank.playerId || me).trim();
    if (tankId !== me) return {};
    const fish = [];
    (Array.isArray(tank.fish) ? tank.fish : []).forEach((raw) => {
      if (fish.length >= 80) return;
      if (!raw || typeof raw !== "object") return;
      const id = String(raw.id || "")
        .trim()
        .slice(0, 32);
      if (!id) return;
      fish.push({
        id,
        variant: String(raw.variant || "").slice(0, 16),
        shiny: !!raw.shiny,
        mutation: String(raw.mutation || "").slice(0, 16)
      });
    });
    return {
      playerId: me,
      name:
        String(tank.name || "Player")
          .trim()
          .slice(0, 48) || "Player",
      updatedAt: Math.max(0, Number(tank.updatedAt) || Date.now()),
      level: Math.max(0, Math.floor(Number(tank.level) || 0)),
      fish,
      base: tank.base && typeof tank.base === "object" && !Array.isArray(tank.base) ? tank.base : null
    };
  }

  async function listAquariumTankContributions() {
    if (netBlocked()) {
      const err = new Error("hub-net-blocked");
      err.hubNetBlocked = true;
      throw err;
    }
    const session = await ensureSession();
    if (!session?.access_token) return null;
    const url = `${SUPABASE_URL}/rest/v1/aquarium_tank_contributions?select=player_id,tank,updated_at`;
    const res = await fetch(url, {
      headers: headers({}, session.access_token),
      cache: "no-store"
    });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`supabase aquarium list ${res.status}`);
    const rows = await res.json();
    return Array.isArray(rows) ? rows : [];
  }

  async function upsertAquariumTankContribution(row) {
    const session = await ensureSession();
    const userId = sessionUserId(session);
    const playerId = parseLocalPlayerId(row?.playerId);
    if (!userId || !session?.access_token) throw new Error("supabase aquarium needs a session");
    if (!playerId) throw new Error("bad aquarium player id");
    if (netBlocked()) {
      const err = new Error("hub-net-blocked");
      err.hubNetBlocked = true;
      throw err;
    }
    const tank = sanitizeAquariumTank(row?.tank, playerId);
    const res = await fetch(`${SUPABASE_URL}/rest/v1/aquarium_tank_contributions`, {
      method: "POST",
      headers: headers(
        {
          Prefer: "resolution=merge-duplicates,return=minimal"
        },
        session.access_token
      ),
      body: JSON.stringify({
        user_id: userId,
        player_id: playerId,
        tank,
        updated_at: new Date().toISOString()
      })
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`supabase aquarium upsert ${res.status} ${text}`);
    }
  }

  async function getDoc(id) {
    if (netBlocked()) {
      const err = new Error("hub-net-blocked");
      err.hubNetBlocked = true;
      throw err;
    }
    const url = `${SUPABASE_URL}/rest/v1/hub_docs?id=eq.${encodeURIComponent(id)}&select=data`;
    const res = await fetch(url, { headers: headers({}, await accessToken()), cache: "no-store" });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`supabase get ${res.status}`);
    const rows = await res.json();
    if (!Array.isArray(rows) || !rows.length) return null;
    return rows[0]?.data ?? null;
  }

  async function upsertDoc(id, data) {
    if (netBlocked()) {
      const err = new Error("hub-net-blocked");
      err.hubNetBlocked = true;
      throw err;
    }
    const url = `${SUPABASE_URL}/rest/v1/hub_docs`;
    const res = await fetch(url, {
      method: "POST",
      headers: headers(
        {
          Prefer: "resolution=merge-duplicates,return=minimal"
        },
        await accessToken()
      ),
      body: JSON.stringify({
        id,
        data,
        updated_at: new Date().toISOString()
      })
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`supabase upsert ${res.status} ${text}`);
    }
  }

  /**
   * Write RLS-locked admin hub_docs through the trusted RPC.
   * Direct REST upserts on those ids are rejected after the locked migration.
   */
  async function upsertAdminDoc(id, data) {
    const session = await ensureSession();
    const userId = sessionUserId(session);
    const key = String(id || "").trim();
    if (!userId || !session?.access_token) throw new Error("supabase admin doc needs a session");
    if (!isAdminDoc(key)) throw new Error("not an admin doc");
    if (netBlocked()) {
      const err = new Error("hub-net-blocked");
      err.hubNetBlocked = true;
      throw err;
    }
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/upsert_admin_hub_doc`, {
      method: "POST",
      headers: headers({}, session.access_token),
      body: JSON.stringify({
        doc_id: key,
        doc_data: data && typeof data === "object" ? data : {}
      })
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`supabase admin upsert ${res.status} ${text}`);
    }
  }

  /**
   * Never GET the old backup. A missing account-server row is "not fetched"
   * (null), not an empty map — callers must skip the shared rewrite.
   * Empty objects from an existing row still count as a hit.
   */
  function shouldReadMantleBackup(_supabaseHit) {
    return false;
  }

  /**
   * Read the account server only. Missing rows return null (do not seed from
   * the old backup). Errors still throw so a later save cannot mix a stale map.
   */
  async function getPrefer(docId, _mantleUrl) {
    if (netBlocked()) {
      const err = new Error("hub-net-blocked");
      err.hubNetBlocked = true;
      throw err;
    }
    try {
      const data = await getDoc(docId);
      if (data != null) return data;
    } catch (err) {
      if (err && err.hubNetBlocked) throw err;
      console.warn("[HubSupabase] getPrefer", docId, err);
      throw err;
    }
    return null;
  }

  /**
   * Never POST the old backup. A failed account-server save must not park a
   * partial map on the leftover store for a later mix-in.
   */
  function shouldWriteMantleBackup(_supabaseWrote) {
    return false;
  }

  /**
   * Write the account server only. Callers already skip the shared rewrite
   * after a table row succeeds, so a failed upsert stays local.
   */
  async function pushPrefer(docId, data, _mantleUrl) {
    if (netBlocked()) {
      const err = new Error("hub-net-blocked");
      err.hubNetBlocked = true;
      throw err;
    }
    try {
      await upsertDoc(docId, data);
    } catch (err) {
      if (err && err.hubNetBlocked) throw err;
      console.warn("[HubSupabase] pushPrefer", docId, err);
      throw new Error("push failed");
    }
  }

  const api = {
    url: SUPABASE_URL,
    DOCS,
    ADMIN_DOC_IDS,
    isAdminDoc,
    getDoc,
    upsertDoc,
    upsertAdminDoc,
    getPrefer,
    pushPrefer,
    shouldReadMantleBackup,
    shouldWriteMantleBackup,
    ensureSession,
    parseProfile,
    parseLocalPlayerId,
    parseSave,
    resolveBoundPlayerId,
    peekBoundPlayerId,
    adoptSession,
    getSave,
    upsertSave,
    listPresencePings,
    upsertPresencePing,
    deletePresencePing,
    subscribePresencePings,
    stopPresenceRealtime,
    listPopularityContributions,
    upsertPopularityContribution,
    listPlayLogContributions,
    upsertPlayLogContribution,
    listPlayerCodeClaims,
    getPlayerCodeClaim,
    upsertPlayerCodeClaim,
    listNicknameClaims,
    upsertNicknameClaim,
    listNameReservationLocks,
    upsertNameReservationLock,
    listPlayerPasswordHashes,
    upsertPlayerPasswordHash,
    listAlltimeRoster,
    upsertAlltimeRoster,
    listCallSignalContributions,
    upsertCallSignalContribution,
    listFriendEdgeContributions,
    upsertFriendEdgeContribution,
    listChatThreadContributions,
    upsertChatThreadContribution,
    listLeaderboardPbContributions,
    upsertLeaderboardPbContribution,
    listMatchRoomContributions,
    upsertMatchRoomContribution,
    listFeedbackItemContributions,
    upsertFeedbackItemContribution,
    listCommunityCastContributions,
    upsertCommunityCastContribution,
    listFishingMailContributions,
    upsertFishingMailContribution,
    listFishingGiftContributions,
    upsertFishingGiftContribution,
    listAquariumTankContributions,
    upsertAquariumTankContribution,
    profile: () => {
      const raw = readSession()?.profile;
      const parsed = parseProfile(raw);
      const localPlayerId = parseLocalPlayerId(raw?.localPlayerId);
      if (!parsed && !localPlayerId) return raw || null;
      return { ...(parsed || raw || {}), localPlayerId };
    },
    userId: () => sessionUserId(readSession()),
    ready: true,
    isReady
  };
  if (root) root.HubSupabase = api;
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  if (typeof localStorage !== "undefined") {
    ensureSession().catch(() => {});
  }
})(typeof window !== "undefined" ? window : typeof globalThis !== "undefined" ? globalThis : null);
