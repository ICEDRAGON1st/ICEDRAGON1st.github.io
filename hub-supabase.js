/**
 * hub-supabase.js — shared Supabase REST helpers for the hub.
 * Uses the public anon key (safe in the browser when RLS is enabled).
 *
 * Prefer getPrefer / pushPrefer so modules survive Mantle rate limits.
 * Doc ids match former Mantle paths (plays-log, presence, fishing-admin-events, …).
 */
(function (root) {
  const SUPABASE_URL = "https://uqyhomsydmnglbaemwbu.supabase.co";
  const SUPABASE_ANON_KEY =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVxeWhvbXN5ZG1uZ2xiYWVtd2J1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIwOTEyODcsImV4cCI6MjEwNzY2NzI4N30.Eht_HnywiURfHKRZu6rmdCatdFiT0TwC0J9Xh-CEp5o";
  const SESSION_KEY = "hub-supabase-session-v1";
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
    return parseProfile(Array.isArray(rows) ? rows[0] : null) || { ...profile, displayName: nextName };
  }

  async function attachProfile(session) {
    if (!session) return session;
    try {
      let profile = await fetchOwnProfile(session);
      if (profile) profile = await syncDisplayName(session, profile);
      if (profile) session.profile = profile;
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

  function isReady() {
    return true;
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
   * Read Supabase first. Falls back to Mantle only if Supabase fails or the row is missing.
   * Empty objects from Supabase count as a hit (no Mantle round-trip).
   */
  async function getPrefer(docId, mantleUrl) {
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
    }
    if (!mantleUrl) return null;
    if (netBlocked()) {
      const err = new Error("hub-net-blocked");
      err.hubNetBlocked = true;
      throw err;
    }
    const res = await fetch(mantleUrl, { cache: "no-store" });
    if (res.status === 404) return null;
    if (res.status === 429) {
      const err = new Error("rate limited");
      err.rateLimited = true;
      throw err;
    }
    if (!res.ok) throw new Error("fetch failed");
    return res.json();
  }

  /**
   * Write Supabase first (source of truth). Best-effort Mantle backup while migrating.
   */
  async function pushPrefer(docId, data, mantleUrl) {
    if (netBlocked()) {
      const err = new Error("hub-net-blocked");
      err.hubNetBlocked = true;
      throw err;
    }
    let ok = false;
    try {
      await upsertDoc(docId, data);
      ok = true;
    } catch (err) {
      if (err && err.hubNetBlocked) throw err;
      console.warn("[HubSupabase] pushPrefer", docId, err);
    }
    if (mantleUrl) {
      try {
        if (netBlocked()) throw new Error("hub-net-blocked");
        const res = await fetch(mantleUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data)
        });
        if (res.ok) ok = true;
      } catch {
        /* Mantle optional */
      }
    }
    if (!ok) throw new Error("push failed");
  }

  const api = {
    url: SUPABASE_URL,
    DOCS,
    getDoc,
    upsertDoc,
    getPrefer,
    pushPrefer,
    ensureSession,
    parseProfile,
    profile: () => parseProfile(readSession()?.profile) || readSession()?.profile || null,
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
