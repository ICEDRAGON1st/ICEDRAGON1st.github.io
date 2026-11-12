/**
 * Mine Depth leaderboard wipe.
 * Leftover shared boards are closed. Apply the wipe from Hub Admin so it lands
 * on signed-in hub-leaderboard-resets.
 *
 * WIPE_KEY = "mine:full-reset-20261001b"
 * WIPE_AT = Date.UTC(2026, 9, 1, 14, 20, 0)
 */
console.error(
  "leftover-locked — Mine Depth wipes stay on signed-in hub-leaderboard-resets via Hub Admin"
);
process.exit(1);
