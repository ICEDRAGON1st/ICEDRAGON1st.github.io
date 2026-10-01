/**
 * Force-apply Mine Depth leaderboard wipe on Supabase immediately.
 */
const SUPABASE_URL = "https://clkamsflzyvdcepvelks.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNsa2Ftc2Zsenl2ZGNlcHZlbGtzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAxNjE3ODEsImV4cCI6MjEwNTczNzc4MX0.s-k2d37X0gByK2-SLnsLWhkbQb15_sDuKpvZs7ABM3g";
const DOC = "leaderboards";
const WIPE_KEY = "mine:full-reset-20261001b";
const WIPE_AT = Date.UTC(2026, 9, 1, 14, 20, 0);

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
  const data = rows?.[0]?.data && typeof rows[0].data === "object" ? rows[0].data : { games: {}, resets: {} };
  const games = data.games && typeof data.games === "object" ? { ...data.games } : {};
  const resets = data.resets && typeof data.resets === "object" ? { ...data.resets } : {};
  resets[WIPE_KEY] = WIPE_AT;

  let removed = 0;
  ["mine", "mine-ore"].forEach((gameId) => {
    const board = { ...(games[gameId] || {}) };
    const before = Object.keys(board).length;
    Object.keys(board).forEach((key) => {
      const at = Number(board[key]?.at) || 0;
      if (at <= WIPE_AT) delete board[key];
    });
    removed += before - Object.keys(board).length;
    games[gameId] = board;
  });

  const payload = { games, resets, updatedAt: Date.now() };
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
  console.log("ok wiped", removed, "mine entries; remaining", {
    mine: Object.keys(games.mine || {}).length,
    "mine-ore": Object.keys(games["mine-ore"] || {}).length
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
