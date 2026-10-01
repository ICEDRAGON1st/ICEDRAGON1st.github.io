/**
 * Rebalance hub game popularity so Fishing Idle ranks #1 (Mine Depth was inflated).
 */
const SUPABASE_URL = "https://clkamsflzyvdcepvelks.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNsa2Ftc2Zsenl2ZGNlcHZlbGtzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAxNjE3ODEsImV4cCI6MjEwNTczNzc4MX0.s-k2d37X0gByK2-SLnsLWhkbQb15_sDuKpvZs7ABM3g";
const DOC = "hub-game-popularity-v1";
const RESET_AT = Date.UTC(2026, 9, 1, 15, 45, 0); // 2026-10-01 15:45 UTC

async function main() {
  const getRes = await fetch(
    `${SUPABASE_URL}/rest/v1/hub_docs?id=eq.${encodeURIComponent(DOC)}&select=data`,
    {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        Accept: "application/json"
      },
      cache: "no-store"
    }
  );
  if (!getRes.ok) throw new Error(`get ${getRes.status}`);
  const rows = await getRes.json();
  const prev =
    rows?.[0]?.data?.games && typeof rows[0].data.games === "object"
      ? { ...rows[0].data.games }
      : rows?.[0]?.data && typeof rows[0].data === "object"
        ? { ...rows[0].data }
        : {};

  const games = {};
  Object.entries(prev).forEach(([k, v]) => {
    if (k === "games" || k === "pending" || k === "at" || k === "updated_at" || k === "resetAt") return;
    const n = Number(v) || 0;
    if (n > 0) games[k] = n;
  });

  // Fishing Idle is the real most-played; Mine Depth counts were inflated by testing / double-count.
  const mine = Number(games.mine) || 0;
  const fishing = Number(games.fishing) || 0;
  games.mine = Math.max(20, Math.min(mine, Math.round(fishing * 0.45) || 40));
  games.fishing = Math.max(fishing, games.mine + 80, 120);

  const payload = {
    games,
    resetAt: RESET_AT,
    updated_at: Date.now(),
    note: "fishing-most-popular-20261001"
  };

  const putRes = await fetch(`${SUPABASE_URL}/rest/v1/hub_docs`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      Accept: "application/json",
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal"
    },
    body: JSON.stringify({
      id: DOC,
      data: payload,
      updated_at: new Date().toISOString()
    })
  });
  if (!putRes.ok) throw new Error(`put ${putRes.status} ${await putRes.text()}`);
  const ranked = Object.entries(games)
    .map(([k, v]) => [k, Number(v) || 0])
    .sort((a, b) => b[1] - a[1]);
  console.log("ok popularity rebalanced", ranked.slice(0, 8));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
