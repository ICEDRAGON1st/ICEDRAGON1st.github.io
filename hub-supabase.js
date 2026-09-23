/**
 * hub-supabase.js — shared Supabase REST helpers for the hub.
 * Uses the public anon key (safe in the browser when RLS is enabled).
 */
(function () {
  const SUPABASE_URL = "https://clkamsflzyvdcepvelks.supabase.co";
  const SUPABASE_ANON_KEY =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNsa2Ftc2Zsenl2ZGNlcHZlbGtzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAxNjE3ODEsImV4cCI6MjEwNTczNzc4MX0.s-k2d37X0gByK2-SLnsLWhkbQb15_sDuKpvZs7ABM3g";

  function headers(extra) {
    return {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(extra || {})
    };
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

  window.HubSupabase = {
    url: SUPABASE_URL,
    getDoc,
    upsertDoc,
    ready: true
  };
})();
