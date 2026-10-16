"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const ROOT = path.resolve(__dirname, "../..");

const NO_OLD_BACKUP_FILES = [
  "hub-plays.js",
  "hub-leaderboard.js",
  "hub-chat.js",
  "hub-calls.js",
  "hub-friends.js",
  "hub-feedback.js",
  "hub-online-match.js",
  "hub-fishing-gifts.js",
  "hub-fishing-mail.js",
  "fishing/script.js"
];

test("shared boards do not talk to the old backup host", () => {
  for (const relative of NO_OLD_BACKUP_FILES) {
    const text = fs.readFileSync(path.join(ROOT, relative), "utf8");
    assert.equal(
      text.includes("mantledb.sh"),
      false,
      `${relative} still mentions the old backup host`
    );
  }
  const net = fs.readFileSync(path.join(ROOT, "hub-net.js"), "utf8");
  assert.match(net, /mantledb\.sh/);
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

test("community cast realtime publication stays authenticated and replica-identity full", () => {
  const sql = fs.readFileSync(
    path.join(ROOT, "supabase/migrations/202610160028_community_cast_contributions_realtime.sql"),
    "utf8"
  );
  assert.match(sql, /alter table public\.community_cast_contributions replica identity full/i);
  assert.match(sql, /alter publication supabase_realtime add table public\.community_cast_contributions/i);
  assert.doesNotMatch(sql, /to anon/i);
});

test("aquarium tank realtime publication stays authenticated and replica-identity full", () => {
  const sql = fs.readFileSync(
    path.join(ROOT, "supabase/migrations/202610160027_aquarium_tank_contributions_realtime.sql"),
    "utf8"
  );
  assert.match(sql, /alter table public\.aquarium_tank_contributions replica identity full/i);
  assert.match(sql, /alter publication supabase_realtime add table public\.aquarium_tank_contributions/i);
  assert.doesNotMatch(sql, /to anon/i);
});

test("fishing gift realtime publication stays authenticated and replica-identity full", () => {
  const sql = fs.readFileSync(
    path.join(ROOT, "supabase/migrations/202610160026_fishing_gift_contributions_realtime.sql"),
    "utf8"
  );
  assert.match(sql, /alter table public\.fishing_gift_contributions replica identity full/i);
  assert.match(sql, /alter publication supabase_realtime add table public\.fishing_gift_contributions/i);
  assert.doesNotMatch(sql, /to anon/i);
});

test("fishing mail realtime publication stays authenticated and replica-identity full", () => {
  const sql = fs.readFileSync(
    path.join(ROOT, "supabase/migrations/202610160025_fishing_mail_contributions_realtime.sql"),
    "utf8"
  );
  assert.match(sql, /alter table public\.fishing_mail_contributions replica identity full/i);
  assert.match(sql, /alter publication supabase_realtime add table public\.fishing_mail_contributions/i);
  assert.doesNotMatch(sql, /to anon/i);
});

test("match room realtime publication stays authenticated and replica-identity full", () => {
  const sql = fs.readFileSync(
    path.join(ROOT, "supabase/migrations/202610160024_match_room_contributions_realtime.sql"),
    "utf8"
  );
  assert.match(sql, /alter table public\.match_room_contributions replica identity full/i);
  assert.match(sql, /alter publication supabase_realtime add table public\.match_room_contributions/i);
  assert.doesNotMatch(sql, /to anon/i);
});

test("call signal realtime publication stays authenticated and replica-identity full", () => {
  const sql = fs.readFileSync(
    path.join(ROOT, "supabase/migrations/202610160023_call_signal_contributions_realtime.sql"),
    "utf8"
  );
  assert.match(sql, /alter table public\.call_signal_contributions replica identity full/i);
  assert.match(sql, /alter publication supabase_realtime add table public\.call_signal_contributions/i);
  assert.doesNotMatch(sql, /to anon/i);
});

test("friend edge realtime publication stays authenticated and replica-identity full", () => {
  const sql = fs.readFileSync(
    path.join(ROOT, "supabase/migrations/202610160022_friend_edge_contributions_realtime.sql"),
    "utf8"
  );
  assert.match(sql, /alter table public\.friend_edge_contributions replica identity full/i);
  assert.match(sql, /alter publication supabase_realtime add table public\.friend_edge_contributions/i);
  assert.doesNotMatch(sql, /to anon/i);
});

test("chat thread realtime publication stays authenticated and replica-identity full", () => {
  const sql = fs.readFileSync(
    path.join(ROOT, "supabase/migrations/202610160021_chat_thread_contributions_realtime.sql"),
    "utf8"
  );
  assert.match(sql, /alter table public\.chat_thread_contributions replica identity full/i);
  assert.match(sql, /alter publication supabase_realtime add table public\.chat_thread_contributions/i);
  assert.doesNotMatch(sql, /to anon/i);
});

test("presence pings realtime publication stays authenticated and replica-identity full", () => {
  const sql = fs.readFileSync(
    path.join(ROOT, "supabase/migrations/202610160020_presence_pings_realtime.sql"),
    "utf8"
  );
  assert.match(sql, /alter table public\.presence_pings replica identity full/i);
  assert.match(sql, /alter publication supabase_realtime add table public\.presence_pings/i);
  assert.doesNotMatch(sql, /to anon/i);
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

test("play log contributions are readable by signed-in players and only writable by the owner", () => {
  const sql = fs.readFileSync(
    path.join(ROOT, "supabase/migrations/202610160009_play_log_contributions.sql"),
    "utf8"
  );
  assert.match(sql, /create table if not exists public\.play_log_contributions/);
  assert.match(sql, /enable row level security/i);
  assert.match(sql, /force row level security/i);
  assert.match(sql, /play_log_contributions_read_authenticated/);
  assert.match(sql, /play_log_contributions_insert_own/);
  assert.match(sql, /play_log_contributions_update_own/);
  assert.match(
    sql,
    /grant select, insert, update, delete on table public\.play_log_contributions to authenticated/
  );
  assert.match(sql, /revoke all on table public\.play_log_contributions from anon, authenticated/);
});

test("call signal contributions are readable by signed-in players and only writable by the owner", () => {
  const sql = fs.readFileSync(
    path.join(ROOT, "supabase/migrations/202610160010_call_signal_contributions.sql"),
    "utf8"
  );
  assert.match(sql, /create table if not exists public\.call_signal_contributions/);
  assert.match(sql, /enable row level security/i);
  assert.match(sql, /force row level security/i);
  assert.match(sql, /call_signal_contributions_read_authenticated/);
  assert.match(sql, /call_signal_contributions_insert_own/);
  assert.match(sql, /call_signal_contributions_update_own/);
  assert.match(
    sql,
    /grant select, insert, update, delete on table public\.call_signal_contributions to authenticated/
  );
  assert.match(sql, /revoke all on table public\.call_signal_contributions from anon, authenticated/);
});

test("friend edge contributions are readable by signed-in players and only writable by the owner", () => {
  const sql = fs.readFileSync(
    path.join(ROOT, "supabase/migrations/202610160011_friend_edge_contributions.sql"),
    "utf8"
  );
  assert.match(sql, /create table if not exists public\.friend_edge_contributions/);
  assert.match(sql, /enable row level security/i);
  assert.match(sql, /force row level security/i);
  assert.match(sql, /friend_edge_contributions_read_authenticated/);
  assert.match(sql, /friend_edge_contributions_insert_own/);
  assert.match(sql, /friend_edge_contributions_update_own/);
  assert.match(
    sql,
    /grant select, insert, update, delete on table public\.friend_edge_contributions to authenticated/
  );
  assert.match(sql, /revoke all on table public\.friend_edge_contributions from anon, authenticated/);
});

test("leaderboard personal-best contributions are readable by signed-in players and only writable by the owner", () => {
  const sql = fs.readFileSync(
    path.join(ROOT, "supabase/migrations/202610160013_leaderboard_pb_contributions.sql"),
    "utf8"
  );
  assert.match(sql, /create table if not exists public\.leaderboard_pb_contributions/);
  assert.match(sql, /enable row level security/i);
  assert.match(sql, /force row level security/i);
  assert.match(sql, /leaderboard_pb_contributions_read_authenticated/);
  assert.match(sql, /leaderboard_pb_contributions_insert_own/);
  assert.match(sql, /leaderboard_pb_contributions_update_own/);
  assert.match(
    sql,
    /grant select, insert, update, delete on table public\.leaderboard_pb_contributions to authenticated/
  );
  assert.match(sql, /revoke all on table public\.leaderboard_pb_contributions from anon, authenticated/);
});

test("chat thread contributions are readable by signed-in players and only writable by the owner", () => {
  const sql = fs.readFileSync(
    path.join(ROOT, "supabase/migrations/202610160012_chat_thread_contributions.sql"),
    "utf8"
  );
  assert.match(sql, /create table if not exists public\.chat_thread_contributions/);
  assert.match(sql, /enable row level security/i);
  assert.match(sql, /force row level security/i);
  assert.match(sql, /chat_thread_contributions_read_authenticated/);
  assert.match(sql, /chat_thread_contributions_insert_own/);
  assert.match(sql, /chat_thread_contributions_update_own/);
  assert.match(
    sql,
    /grant select, insert, update, delete on table public\.chat_thread_contributions to authenticated/
  );
  assert.match(sql, /revoke all on table public\.chat_thread_contributions from anon, authenticated/);
});

test("match room contributions are readable by signed-in players and only writable by the owner", () => {
  const sql = fs.readFileSync(
    path.join(ROOT, "supabase/migrations/202610160014_match_room_contributions.sql"),
    "utf8"
  );
  assert.match(sql, /create table if not exists public\.match_room_contributions/);
  assert.match(sql, /enable row level security/i);
  assert.match(sql, /force row level security/i);
  assert.match(sql, /match_room_contributions_read_authenticated/);
  assert.match(sql, /match_room_contributions_insert_own/);
  assert.match(sql, /match_room_contributions_update_own/);
  assert.match(
    sql,
    /grant select, insert, update, delete on table public\.match_room_contributions to authenticated/
  );
  assert.match(sql, /revoke all on table public\.match_room_contributions from anon, authenticated/);
});

test("feedback item contributions are readable by signed-in players and only writable by the owner", () => {
  const sql = fs.readFileSync(
    path.join(ROOT, "supabase/migrations/202610160015_feedback_item_contributions.sql"),
    "utf8"
  );
  assert.match(sql, /create table if not exists public\.feedback_item_contributions/);
  assert.match(sql, /enable row level security/i);
  assert.match(sql, /force row level security/i);
  assert.match(sql, /feedback_item_contributions_read_authenticated/);
  assert.match(sql, /feedback_item_contributions_insert_own/);
  assert.match(sql, /feedback_item_contributions_update_own/);
  assert.match(
    sql,
    /grant select, insert, update, delete on table public\.feedback_item_contributions to authenticated/
  );
  assert.match(sql, /revoke all on table public\.feedback_item_contributions from anon, authenticated/);
});

test("aquarium tank contributions are readable by signed-in players and only writable by the owner", () => {
  const sql = fs.readFileSync(
    path.join(ROOT, "supabase/migrations/202610160019_aquarium_tank_contributions.sql"),
    "utf8"
  );
  assert.match(sql, /create table if not exists public\.aquarium_tank_contributions/);
  assert.match(sql, /enable row level security/i);
  assert.match(sql, /force row level security/i);
  assert.match(sql, /aquarium_tank_contributions_read_authenticated/);
  assert.match(sql, /aquarium_tank_contributions_insert_own/);
  assert.match(sql, /aquarium_tank_contributions_update_own/);
  assert.match(
    sql,
    /grant select, insert, update, delete on table public\.aquarium_tank_contributions to authenticated/
  );
  assert.match(sql, /revoke all on table public\.aquarium_tank_contributions from anon, authenticated/);
});

test("fishing gift contributions are readable by signed-in players and only writable by the owner", () => {
  const sql = fs.readFileSync(
    path.join(ROOT, "supabase/migrations/202610160018_fishing_gift_contributions.sql"),
    "utf8"
  );
  assert.match(sql, /create table if not exists public\.fishing_gift_contributions/);
  assert.match(sql, /enable row level security/i);
  assert.match(sql, /force row level security/i);
  assert.match(sql, /fishing_gift_contributions_read_authenticated/);
  assert.match(sql, /fishing_gift_contributions_insert_own/);
  assert.match(sql, /fishing_gift_contributions_update_own/);
  assert.match(
    sql,
    /grant select, insert, update, delete on table public\.fishing_gift_contributions to authenticated/
  );
  assert.match(sql, /revoke all on table public\.fishing_gift_contributions from anon, authenticated/);
});

test("fishing mail contributions are readable by signed-in players and only writable by the owner", () => {
  const sql = fs.readFileSync(
    path.join(ROOT, "supabase/migrations/202610160017_fishing_mail_contributions.sql"),
    "utf8"
  );
  assert.match(sql, /create table if not exists public\.fishing_mail_contributions/);
  assert.match(sql, /enable row level security/i);
  assert.match(sql, /force row level security/i);
  assert.match(sql, /fishing_mail_contributions_read_authenticated/);
  assert.match(sql, /fishing_mail_contributions_insert_own/);
  assert.match(sql, /fishing_mail_contributions_update_own/);
  assert.match(
    sql,
    /grant select, insert, update, delete on table public\.fishing_mail_contributions to authenticated/
  );
  assert.match(sql, /revoke all on table public\.fishing_mail_contributions from anon, authenticated/);
});

test("community cast contributions are readable by signed-in players and only writable by the owner", () => {
  const sql = fs.readFileSync(
    path.join(ROOT, "supabase/migrations/202610160016_community_cast_contributions.sql"),
    "utf8"
  );
  assert.match(sql, /create table if not exists public\.community_cast_contributions/);
  assert.match(sql, /enable row level security/i);
  assert.match(sql, /force row level security/i);
  assert.match(sql, /community_cast_contributions_read_authenticated/);
  assert.match(sql, /community_cast_contributions_insert_own/);
  assert.match(sql, /community_cast_contributions_update_own/);
  assert.match(
    sql,
    /grant select, insert, update, delete on table public\.community_cast_contributions to authenticated/
  );
  assert.match(sql, /revoke all on table public\.community_cast_contributions from anon, authenticated/);
});
