"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const ROOT = path.resolve(__dirname, "../..");

const REMAINING_MANTLE_DOMAINS = {
  "hub-plays.js": [
    "plays-log",
    "name-registry",
    "player-codes",
    "player-passwords",
    "name-reservations",
    "presence",
    "players-alltime",
    "hub-game-popularity"
  ],
  "hub-leaderboard.js": ["leaderboards"],
  "hub-chat.js": ["friend-chat"],
  "hub-calls.js": ["hub-calls"],
  "hub-friends.js": ["friends", "name-registry"],
  "hub-feedback.js": ["player-feedback"],
  "hub-online-match.js": ["online-matches"],
  "hub-fishing-gifts.js": ["fishing-gifts"],
  "hub-fishing-mail.js": ["fishing-player-mail"],
  "fishing/script.js": [
    "fishing-admin-events",
    "fishing-admin-announce",
    "fishing-gifts",
    "fishing-player-mail",
    "fishing-aquariums",
    "fishing-community",
    "name-registry"
  ]
};

function collectMantlePaths(text) {
  const fromUrls = [
    ...text.matchAll(/mantledb\.sh\/v2\/(?:[^/"'`\s]+|\$\{NS\})\/([A-Za-z0-9-]+)/g)
  ].map((match) => match[1]);
  const fromConsts = [...text.matchAll(/const [A-Z_]*PATH = "([A-Za-z0-9-]+)"/g)].map(
    (match) => match[1]
  );
  return [...fromUrls, ...fromConsts];
}

test("remaining Mantle domains stay on the known retirement list", () => {
  const seen = new Set();
  for (const [relative, expected] of Object.entries(REMAINING_MANTLE_DOMAINS)) {
    const text = fs.readFileSync(path.join(ROOT, relative), "utf8");
    const paths = [...new Set(collectMantlePaths(text))].sort();
    assert.deepEqual(paths, [...expected].sort(), `${relative} changed Mantle domains`);
    paths.forEach((name) => seen.add(name));
  }

  assert.equal(seen.has("player-passwords"), true);
  assert.equal(
    fs.readFileSync(path.join(ROOT, "hub-plays.js"), "utf8").includes("player-passwords"),
    true
  );
});

test("locked migrations keep admin hub_docs writes off the anon role", () => {
  const locked = fs.readFileSync(
    path.join(ROOT, "supabase/migrations/202610150002_hub_docs_locked.sql"),
    "utf8"
  );
  for (const id of [
    "fishing-admin-events",
    "fishing-admin-audit",
    "hub-admin-announce",
    "hub-admin-maintenance",
    "hub-admin-moderation",
    "hub-admin-grants",
    "hub-discord-site-updates"
  ]) {
    assert.match(locked, new RegExp(id.replaceAll("-", "\\-")));
  }
  assert.match(locked, /authenticated/i);
  assert.doesNotMatch(locked, /to anon/i);
});

test("admin hub_docs RPC stays authenticated and locked to admin document ids", () => {
  const rpc = fs.readFileSync(
    path.join(ROOT, "supabase/migrations/202610160001_admin_hub_doc_rpc.sql"),
    "utf8"
  );
  assert.match(rpc, /security definer/i);
  assert.match(rpc, /grant execute on function public\.upsert_admin_hub_doc/);
  assert.match(rpc, /to authenticated/i);
  assert.match(rpc, /revoke all on function public\.upsert_admin_hub_doc[\s\S]*from public, anon/i);
  for (const id of [
    "fishing-admin-events",
    "fishing-admin-audit",
    "hub-admin-announce",
    "hub-admin-maintenance",
    "hub-admin-moderation",
    "hub-admin-grants",
    "hub-discord-site-updates"
  ]) {
    assert.match(rpc, new RegExp(id.replaceAll("-", "\\-")));
  }
  assert.doesNotMatch(rpc, /to anon/i);
});

test("presence pings are readable by signed-in players and only writable by the owner", () => {
  const sql = fs.readFileSync(
    path.join(ROOT, "supabase/migrations/202610160002_presence_pings.sql"),
    "utf8"
  );
  assert.match(sql, /create table if not exists public\.presence_pings/);
  assert.match(sql, /enable row level security/i);
  assert.match(sql, /force row level security/i);
  assert.match(sql, /presence_pings_read_authenticated/);
  assert.match(sql, /presence_pings_insert_own/);
  assert.match(sql, /presence_pings_update_own/);
  assert.match(sql, /grant select, insert, update, delete on table public\.presence_pings to authenticated/);
  assert.match(sql, /revoke all on table public\.presence_pings from anon, authenticated/);
});

test("popularity contributions are readable by signed-in players and only writable by the owner", () => {
  const sql = fs.readFileSync(
    path.join(ROOT, "supabase/migrations/202610160003_popularity_contributions.sql"),
    "utf8"
  );
  assert.match(sql, /create table if not exists public\.popularity_contributions/);
  assert.match(sql, /enable row level security/i);
  assert.match(sql, /force row level security/i);
  assert.match(sql, /popularity_contributions_read_authenticated/);
  assert.match(sql, /popularity_contributions_insert_own/);
  assert.match(sql, /popularity_contributions_update_own/);
  assert.match(
    sql,
    /grant select, insert, update, delete on table public\.popularity_contributions to authenticated/
  );
  assert.match(sql, /revoke all on table public\.popularity_contributions from anon, authenticated/);
});

test("player code claims are readable by signed-in players and only writable by the owner", () => {
  const sql = fs.readFileSync(
    path.join(ROOT, "supabase/migrations/202610160004_player_code_claims.sql"),
    "utf8"
  );
  assert.match(sql, /create table if not exists public\.player_code_claims/);
  assert.match(sql, /enable row level security/i);
  assert.match(sql, /force row level security/i);
  assert.match(sql, /player_code_claims_read_authenticated/);
  assert.match(sql, /player_code_claims_insert_own/);
  assert.match(sql, /player_code_claims_update_own/);
  assert.match(
    sql,
    /grant select, insert, update, delete on table public\.player_code_claims to authenticated/
  );
  assert.match(sql, /revoke all on table public\.player_code_claims from anon, authenticated/);
});

test("nickname claims are readable by signed-in players and only writable by the owner", () => {
  const sql = fs.readFileSync(
    path.join(ROOT, "supabase/migrations/202610160005_nickname_claims.sql"),
    "utf8"
  );
  assert.match(sql, /create table if not exists public\.nickname_claims/);
  assert.match(sql, /enable row level security/i);
  assert.match(sql, /force row level security/i);
  assert.match(sql, /nickname_claims_read_authenticated/);
  assert.match(sql, /nickname_claims_insert_own/);
  assert.match(sql, /nickname_claims_update_own/);
  assert.match(
    sql,
    /grant select, insert, update, delete on table public\.nickname_claims to authenticated/
  );
  assert.match(sql, /revoke all on table public\.nickname_claims from anon, authenticated/);
});

test("name reservation locks are readable by signed-in players and only writable by the owner", () => {
  const sql = fs.readFileSync(
    path.join(ROOT, "supabase/migrations/202610160006_name_reservation_locks.sql"),
    "utf8"
  );
  assert.match(sql, /create table if not exists public\.name_reservation_locks/);
  assert.match(sql, /enable row level security/i);
  assert.match(sql, /force row level security/i);
  assert.match(sql, /name_reservation_locks_read_authenticated/);
  assert.match(sql, /name_reservation_locks_insert_own/);
  assert.match(sql, /name_reservation_locks_update_own/);
  assert.match(
    sql,
    /grant select, insert, update, delete on table public\.name_reservation_locks to authenticated/
  );
  assert.match(sql, /revoke all on table public\.name_reservation_locks from anon, authenticated/);
});

test("player password hashes are readable by signed-in players and only writable by the owner", () => {
  const sql = fs.readFileSync(
    path.join(ROOT, "supabase/migrations/202610160007_player_password_hashes.sql"),
    "utf8"
  );
  assert.match(sql, /create table if not exists public\.player_password_hashes/);
  assert.match(sql, /enable row level security/i);
  assert.match(sql, /force row level security/i);
  assert.match(sql, /player_password_hashes_read_authenticated/);
  assert.match(sql, /player_password_hashes_insert_own/);
  assert.match(sql, /player_password_hashes_update_own/);
  assert.match(
    sql,
    /grant select, insert, update, delete on table public\.player_password_hashes to authenticated/
  );
  assert.match(sql, /revoke all on table public\.player_password_hashes from anon, authenticated/);
  assert.match(sql, /never plaintext/i);
  assert.doesNotMatch(sql, /plaintext_password/);
});

test("all-time roster rows are readable by signed-in players and only writable by the owner", () => {
  const sql = fs.readFileSync(
    path.join(ROOT, "supabase/migrations/202610160008_alltime_roster.sql"),
    "utf8"
  );
  assert.match(sql, /create table if not exists public\.alltime_roster/);
  assert.match(sql, /enable row level security/i);
  assert.match(sql, /force row level security/i);
  assert.match(sql, /alltime_roster_read_authenticated/);
  assert.match(sql, /alltime_roster_insert_own/);
  assert.match(sql, /alltime_roster_update_own/);
  assert.match(
    sql,
    /grant select, insert, update, delete on table public\.alltime_roster to authenticated/
  );
  assert.match(sql, /revoke all on table public\.alltime_roster from anon, authenticated/);
});
