/**
 * hub-supabase.js — shared Supabase REST helpers for the hub.
 * Uses the public anon key (safe in the browser when RLS is enabled).
 *
 * Prefer getPrefer / pushPrefer so modules survive Mantle rate limits.
 * Doc ids match former Mantle paths (plays-log, presence, fishing-admin-events, …).
 */
(function () {
  const SUPABASE_URL = "https://clkamsflzyvdcepvelks.supabase.co";
  const SUPABASE_ANON_KEY =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNsa2Ftc2Zsenl2ZGNlcHZlbGtzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAxNjE3ODEsImV4cCI6MjEwNTczNzc4MX0.s-k2d37X0gByK2-SLnsLWhkbQb15_sDuKpvZs7ABM3g";

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
    calls: "hub-calls"
  };

  function headers(extra) {
    return {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(extra || {})
    };
  }

  function isReady() {
    return true;
  }

  async function getDoc(id) {
    const url = `${SUPABASE_URL}/rest/v1/hub_docs?id=eq.${encodeURIComponent(id)}&select=data`;
    const res = await fetch(url, { headers: headers(), cache: "no-store" });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`supabase get ${res.status}`);
    const rows = await res.json();
    if (!Array.isArray(rows) || !rows.length) return null;
    return rows[0]?.data ?? null;
  }

  async function upsertDoc(id, data) {
    const url = `${SUPABASE_URL}/rest/v1/hub_docs`;
    const res = await fetch(url, {
      method: "POST",
      headers: headers({
        Prefer: "resolution=merge-duplicates,return=minimal"
      }),
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
    try {
      const data = await getDoc(docId);
      if (data != null) return data;
    } catch (err) {
      console.warn("[HubSupabase] getPrefer", docId, err);
    }
    if (!mantleUrl) return null;
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
    let ok = false;
    try {
      await upsertDoc(docId, data);
      ok = true;
    } catch (err) {
      console.warn("[HubSupabase] pushPrefer", docId, err);
    }
    if (mantleUrl) {
      try {
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

  window.HubSupabase = {
    url: SUPABASE_URL,
    DOCS,
    getDoc,
    upsertDoc,
    getPrefer,
    pushPrefer,
    ready: true,
    isReady
  };
})();
