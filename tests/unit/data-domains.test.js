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
  const plays = fs.readFileSync(path.join(ROOT, "hub-plays.js"), "utf8");
  assert.doesNotMatch(plays, /async function fetchDoc/);
  assert.doesNotMatch(plays, /async function pushDoc/);
  assert.equal(plays.includes("player-passwords"), false);
  assert.doesNotMatch(
    plays.slice(
      plays.indexOf("async function fetchPasswordsRemote"),
      plays.indexOf("async function pushPasswordsRemote")
    ),
    /fetchDoc/
  );
  assert.doesNotMatch(
    plays.slice(
      plays.indexOf("async function pushPasswordsRemote"),
      plays.indexOf("function markVaultHasPassword")
    ),
    /pushDoc/
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

test("admin broadcasts stay readable by signed-in players and writable only through the trusted RPC", () => {
  const sql = fs.readFileSync(
    path.join(ROOT, "supabase/migrations/202610160037_admin_broadcasts.sql"),
    "utf8"
  );
  assert.match(sql, /create table if not exists public\.admin_broadcasts/);
  assert.match(sql, /enable row level security/i);
  assert.match(sql, /force row level security/i);
  assert.match(sql, /admin_broadcasts_read_authenticated/);
  assert.match(sql, /grant select on table public\.admin_broadcasts to authenticated/i);
  assert.match(sql, /revoke all on table public\.admin_broadcasts from anon, authenticated/);
  assert.match(sql, /insert into public\.admin_broadcasts/);
  assert.match(sql, /security definer/i);
  assert.doesNotMatch(sql, /grant select, insert/i);
  assert.doesNotMatch(sql, /to anon/i);
  assert.doesNotMatch(sql, /add table public\.hub_docs/i);
  for (const id of [
    "hub-admin-announce",
    "hub-admin-maintenance",
    "hub-admin-moderation",
    "hub-admin-grants"
  ]) {
    assert.match(sql, new RegExp(id.replaceAll("-", "\\-")));
  }
});

test("fishing admin events join admin_broadcasts without publishing hub_docs", () => {
  const sql = fs.readFileSync(
    path.join(ROOT, "supabase/migrations/202610160039_admin_broadcasts_fishing_events.sql"),
    "utf8"
  );
  assert.match(sql, /fishing-admin-events/);
  assert.match(sql, /admin_broadcasts_doc_id_allowed/);
  assert.match(sql, /security definer/i);
  assert.match(sql, /grant execute on function public\.upsert_admin_hub_doc/);
  assert.match(sql, /to authenticated/i);
  assert.doesNotMatch(sql, /add table public\.hub_docs/i);
  assert.doesNotMatch(sql, /to anon/i);
});

test("trusted admin writes stay on admin_broadcasts without leftover hub_docs", () => {
  const sql = fs.readFileSync(
    path.join(ROOT, "supabase/migrations/202610160050_admin_broadcasts_no_hub_docs.sql"),
    "utf8"
  );
  assert.match(sql, /fishing-admin-audit/);
  assert.match(sql, /admin_broadcasts_doc_id_allowed/);
  assert.match(sql, /security definer/i);
  assert.match(sql, /grant execute on function public\.upsert_admin_hub_doc/);
  assert.match(sql, /to authenticated/i);
  assert.match(sql, /insert into public\.admin_broadcasts/);
  assert.doesNotMatch(sql, /insert into public\.hub_docs/);
  assert.doesNotMatch(sql, /add table public\.hub_docs/i);
  assert.doesNotMatch(sql, /to anon/i);
  for (const id of [
    "hub-admin-announce",
    "fishing-admin-events",
    "fishing-admin-announce",
    "fishing-admin-audit",
    "hub-leaderboard-resets",
    "hub-feedback-deletes"
  ]) {
    assert.match(sql, new RegExp(`'${id.replaceAll("-", "\\-")}'`));
  }
});

test("feedback deletes join admin_broadcasts without publishing hub_docs", () => {
  const sql = fs.readFileSync(
    path.join(ROOT, "supabase/migrations/202610160046_admin_broadcasts_feedback_deletes.sql"),
    "utf8"
  );
  assert.match(sql, /hub-feedback-deletes/);
  assert.match(sql, /admin_broadcasts_doc_id_allowed/);
  assert.match(sql, /security definer/i);
  assert.match(sql, /grant execute on function public\.upsert_admin_hub_doc/);
  assert.match(sql, /to authenticated/i);
  assert.doesNotMatch(sql, /add table public\.hub_docs/i);
  assert.doesNotMatch(sql, /to anon/i);
});

test("leaderboard wipes join admin_broadcasts without publishing hub_docs", () => {
  const sql = fs.readFileSync(
    path.join(ROOT, "supabase/migrations/202610160045_admin_broadcasts_leaderboard_resets.sql"),
    "utf8"
  );
  assert.match(sql, /hub-leaderboard-resets/);
  assert.match(sql, /admin_broadcasts_doc_id_allowed/);
  assert.match(sql, /security definer/i);
  assert.match(sql, /grant execute on function public\.upsert_admin_hub_doc/);
  assert.match(sql, /to authenticated/i);
  assert.doesNotMatch(sql, /add table public\.hub_docs/i);
  assert.doesNotMatch(sql, /to anon/i);
});

test("Discord /link looks up signed-in player codes without leftover hub_docs", () => {
  const sql = fs.readFileSync(
    path.join(ROOT, "supabase/migrations/202610160051_discord_links.sql"),
    "utf8"
  );
  const bot = fs.readFileSync(path.join(ROOT, "discord-bot/index.js"), "utf8");
  assert.match(sql, /create table if not exists public\.discord_links/);
  assert.match(sql, /function public\.lookup_player_by_code/);
  assert.match(sql, /function public\.upsert_discord_link/);
  assert.match(sql, /security definer/i);
  assert.match(sql, /grant execute on function public\.lookup_player_by_code\(text\) to anon, authenticated/);
  assert.match(
    sql,
    /grant execute on function public\.upsert_discord_link\(text, text, text\) to anon, authenticated/
  );
  assert.match(sql, /'discord-links-v1'/);
  assert.doesNotMatch(sql, /add table public\.hub_docs/i);
  assert.doesNotMatch(sql, /add table public\.discord_links/i);
  assert.doesNotMatch(sql, /grant select, insert/i);
  assert.match(bot, /lookup_player_by_code/);
  assert.match(bot, /upsert_discord_link/);
  assert.doesNotMatch(bot, /hub_docs/);
  assert.doesNotMatch(bot, /player-codes/);
  assert.doesNotMatch(bot, /name-registry/);
  assert.doesNotMatch(bot, /discord-links-v1/);
});

test("remaining leftover tables paste includes meter, Paper, Discord /link, and schema reload", () => {
  const sql = fs.readFileSync(
    path.join(ROOT, "supabase/migrations/202610160052_remaining_leftover.sql"),
    "utf8"
  );
  assert.match(sql, /community_meter_state/);
  assert.match(sql, /paper_room_contributions/);
  assert.match(sql, /community_cast_contributions/);
  assert.match(sql, /discord_links/);
  assert.match(sql, /reload_postgrest_schema/);
  assert.match(sql, /notify pgrst, 'reload schema'/);
  assert.match(sql, /grant execute on function public\.reload_postgrest_schema\(\) to authenticated/);
  assert.doesNotMatch(sql, /grant execute on function public\.reload_postgrest_schema\(\) to anon/);
  assert.doesNotMatch(sql, /add table public\.hub_docs/i);
});

test("contracted leftover boards skip hub_docs on the client after meter and Paper tables are live", () => {
  const src = fs.readFileSync(path.join(ROOT, "hub-supabase.js"), "utf8");
  const plays = fs.readFileSync(path.join(ROOT, "hub-plays.js"), "utf8");
  assert.match(src, /function isLeftoverLockedDoc/);
  assert.match(src, /function isLeftoverOpenDoc/);
  assert.match(src, /Leftover hub_docs is closed/);
  assert.match(src, /"discord-links-v1"/);
  assert.match(src, /if \(!isLeftoverOpenDoc\(id\) \|\| isLeftoverLockedDoc\(id\)\) return null;/);
  assert.match(src, /throw new Error\("leftover-locked"\)/);
  assert.doesNotMatch(plays, /const PLAYS_PATH|const NAMES_PATH|const CODES_PATH|const PRESENCE_PATH/);
  const getDocSrc = src.slice(src.indexOf("async function getDoc"), src.indexOf("async function upsertDoc"));
  const upsertDocSrc = src.slice(
    src.indexOf("async function upsertDoc"),
    src.indexOf("async function upsertAdminDoc")
  );
  assert.doesNotMatch(getDocSrc, /rest\/v1\/hub_docs|hubFetch/);
  assert.doesNotMatch(upsertDocSrc, /rest\/v1\/hub_docs|hubFetch/);
});

test("contracted leftover boards cannot be rewritten on hub_docs", () => {
  const sql = fs.readFileSync(
    path.join(ROOT, "supabase/migrations/202610160049_lock_contracted_hub_docs.sql"),
    "utf8"
  );
  assert.match(sql, /hub_docs_insert_non_admin/);
  assert.match(sql, /hub_docs_update_non_admin/);
  assert.match(sql, /id not like 'account-bag:%'/);
  for (const id of [
    "leaderboards",
    "player-feedback",
    "plays-log",
    "name-registry",
    "player-codes",
    "name-reservations",
    "presence",
    "players-alltime",
    "friend-chat",
    "friends",
    "online-matches",
    "fishing-gifts",
    "fishing-player-mail",
    "fishing-aquariums",
    "hub-calls",
    "hub-referrals-v1",
    "hub-game-popularity-v1",
    "player-passwords",
    "hub-leaderboard-resets",
    "hub-feedback-deletes"
  ]) {
    assert.match(sql, new RegExp(`'${id.replaceAll("-", "\\-")}'`));
  }
  assert.doesNotMatch(sql, /'fishing-community'/);
  assert.doesNotMatch(sql, /'paper-io-/);
});

test("Fishing weekend luck and Paper Claim leftover boards lock after signed-in tables are live", () => {
  const sql = fs.readFileSync(
    path.join(ROOT, "supabase/migrations/202610160053_lock_community_paper_hub_docs.sql"),
    "utf8"
  );
  assert.match(sql, /hub_docs_insert_non_admin/);
  assert.match(sql, /hub_docs_update_non_admin/);
  assert.match(sql, /'fishing-community'/);
  assert.match(sql, /id not like 'paper-io-%'/);
  assert.doesNotMatch(sql, /to anon/i);
  assert.doesNotMatch(sql, /add table public\.hub_docs/i);
});

test("fishing admin announce locks hub_docs writes and joins admin_broadcasts without publishing hub_docs", () => {
  const sql = fs.readFileSync(
    path.join(ROOT, "supabase/migrations/202610160040_admin_broadcasts_fishing_announce.sql"),
    "utf8"
  );
  assert.match(sql, /fishing-admin-announce/);
  assert.match(sql, /admin_broadcasts_doc_id_allowed/);
  assert.match(sql, /hub_docs_insert_non_admin/);
  assert.match(sql, /hub_docs_update_non_admin/);
  assert.match(sql, /security definer/i);
  assert.match(sql, /grant execute on function public\.upsert_admin_hub_doc/);
  assert.doesNotMatch(sql, /add table public\.hub_docs/i);
  assert.doesNotMatch(sql, /to anon/i);
});

test("referral contributions realtime publication stays authenticated and replica-identity full", () => {
  const sql = fs.readFileSync(
    path.join(ROOT, "supabase/migrations/202610160042_referral_contributions_realtime.sql"),
    "utf8"
  );
  assert.match(sql, /alter table public\.referral_contributions replica identity full/i);
  assert.match(
    sql,
    /alter publication supabase_realtime add table public\.referral_contributions/i
  );
  assert.doesNotMatch(sql, /add table public\.hub_docs/i);
  assert.doesNotMatch(sql, /to anon/i);
});

test("admin broadcasts realtime publication stays authenticated and replica-identity full", () => {
  const sql = fs.readFileSync(
    path.join(ROOT, "supabase/migrations/202610160038_admin_broadcasts_realtime.sql"),
    "utf8"
  );
  assert.match(sql, /alter table public\.admin_broadcasts replica identity full/i);
  assert.match(sql, /alter publication supabase_realtime add table public\.admin_broadcasts/i);
  assert.doesNotMatch(sql, /add table public\.hub_docs/i);
  assert.doesNotMatch(sql, /to anon/i);
});

test("player code claims realtime publication stays authenticated and replica-identity full", () => {
  const sql = fs.readFileSync(
    path.join(ROOT, "supabase/migrations/202610160035_player_code_claims_realtime.sql"),
    "utf8"
  );
  assert.match(sql, /alter table public\.player_code_claims replica identity full/i);
  assert.match(sql, /alter publication supabase_realtime add table public\.player_code_claims/i);
  assert.doesNotMatch(sql, /to anon/i);
});

test("name reservation locks realtime publication stays authenticated and replica-identity full", () => {
  const sql = fs.readFileSync(
    path.join(ROOT, "supabase/migrations/202610160036_name_reservation_locks_realtime.sql"),
    "utf8"
  );
  assert.match(sql, /alter table public\.name_reservation_locks replica identity full/i);
  assert.match(
    sql,
    /alter publication supabase_realtime add table public\.name_reservation_locks/i
  );
  assert.doesNotMatch(sql, /to anon/i);
});

test("nickname claims realtime publication stays authenticated and replica-identity full", () => {
  const sql = fs.readFileSync(
    path.join(ROOT, "supabase/migrations/202610160033_nickname_claims_realtime.sql"),
    "utf8"
  );
  assert.match(sql, /alter table public\.nickname_claims replica identity full/i);
  assert.match(sql, /alter publication supabase_realtime add table public\.nickname_claims/i);
  assert.doesNotMatch(sql, /to anon/i);
});

test("all-time roster realtime publication stays authenticated and replica-identity full", () => {
  const sql = fs.readFileSync(
    path.join(ROOT, "supabase/migrations/202610160034_alltime_roster_realtime.sql"),
    "utf8"
  );
  assert.match(sql, /alter table public\.alltime_roster replica identity full/i);
  assert.match(sql, /alter publication supabase_realtime add table public\.alltime_roster/i);
  assert.doesNotMatch(sql, /to anon/i);
});

test("popularity realtime publication stays authenticated and replica-identity full", () => {
  const sql = fs.readFileSync(
    path.join(ROOT, "supabase/migrations/202610160031_popularity_contributions_realtime.sql"),
    "utf8"
  );
  assert.match(sql, /alter table public\.popularity_contributions replica identity full/i);
  assert.match(
    sql,
    /alter publication supabase_realtime add table public\.popularity_contributions/i
  );
  assert.doesNotMatch(sql, /to anon/i);
});

test("play log realtime publication stays authenticated and replica-identity full", () => {
  const sql = fs.readFileSync(
    path.join(ROOT, "supabase/migrations/202610160032_play_log_contributions_realtime.sql"),
    "utf8"
  );
  assert.match(sql, /alter table public\.play_log_contributions replica identity full/i);
  assert.match(
    sql,
    /alter publication supabase_realtime add table public\.play_log_contributions/i
  );
  assert.doesNotMatch(sql, /to anon/i);
});

test("leaderboard pb realtime publication stays authenticated and replica-identity full", () => {
  const sql = fs.readFileSync(
    path.join(ROOT, "supabase/migrations/202610160030_leaderboard_pb_contributions_realtime.sql"),
    "utf8"
  );
  assert.match(sql, /alter table public\.leaderboard_pb_contributions replica identity full/i);
  assert.match(
    sql,
    /alter publication supabase_realtime add table public\.leaderboard_pb_contributions/i
  );
  assert.doesNotMatch(sql, /to anon/i);
});

test("feedback item realtime publication stays authenticated and replica-identity full", () => {
  const sql = fs.readFileSync(
    path.join(ROOT, "supabase/migrations/202610160029_feedback_item_contributions_realtime.sql"),
    "utf8"
  );
  assert.match(sql, /alter table public\.feedback_item_contributions replica identity full/i);
  assert.match(
    sql,
    /alter publication supabase_realtime add table public\.feedback_item_contributions/i
  );
  assert.doesNotMatch(sql, /to anon/i);
});

test("community cast realtime publication stays authenticated and replica-identity full", () => {
  const sql = fs.readFileSync(
    path.join(ROOT, "supabase/migrations/202610160028_community_cast_contributions_realtime.sql"),
    "utf8"
  );
  assert.match(sql, /alter table public\.community_cast_contributions replica identity full/i);
  assert.match(
    sql,
    /alter publication supabase_realtime add table public\.community_cast_contributions/i
  );
  assert.doesNotMatch(sql, /to anon/i);
});

test("community meter realtime publication stays authenticated and replica-identity full", () => {
  const sql = fs.readFileSync(
    path.join(ROOT, "supabase/migrations/202610160044_community_meter_state_realtime.sql"),
    "utf8"
  );
  assert.match(sql, /alter table public\.community_meter_state replica identity full/i);
  assert.match(
    sql,
    /alter publication supabase_realtime add table public\.community_meter_state/i
  );
  assert.doesNotMatch(sql, /to anon/i);
});

test("aquarium tank realtime publication stays authenticated and replica-identity full", () => {
  const sql = fs.readFileSync(
    path.join(ROOT, "supabase/migrations/202610160027_aquarium_tank_contributions_realtime.sql"),
    "utf8"
  );
  assert.match(sql, /alter table public\.aquarium_tank_contributions replica identity full/i);
  assert.match(
    sql,
    /alter publication supabase_realtime add table public\.aquarium_tank_contributions/i
  );
  assert.doesNotMatch(sql, /to anon/i);
});

test("fishing gift realtime publication stays authenticated and replica-identity full", () => {
  const sql = fs.readFileSync(
    path.join(ROOT, "supabase/migrations/202610160026_fishing_gift_contributions_realtime.sql"),
    "utf8"
  );
  assert.match(sql, /alter table public\.fishing_gift_contributions replica identity full/i);
  assert.match(
    sql,
    /alter publication supabase_realtime add table public\.fishing_gift_contributions/i
  );
  assert.doesNotMatch(sql, /to anon/i);
});

test("fishing mail realtime publication stays authenticated and replica-identity full", () => {
  const sql = fs.readFileSync(
    path.join(ROOT, "supabase/migrations/202610160025_fishing_mail_contributions_realtime.sql"),
    "utf8"
  );
  assert.match(sql, /alter table public\.fishing_mail_contributions replica identity full/i);
  assert.match(
    sql,
    /alter publication supabase_realtime add table public\.fishing_mail_contributions/i
  );
  assert.doesNotMatch(sql, /to anon/i);
});

test("match room realtime publication stays authenticated and replica-identity full", () => {
  const sql = fs.readFileSync(
    path.join(ROOT, "supabase/migrations/202610160024_match_room_contributions_realtime.sql"),
    "utf8"
  );
  assert.match(sql, /alter table public\.match_room_contributions replica identity full/i);
  assert.match(
    sql,
    /alter publication supabase_realtime add table public\.match_room_contributions/i
  );
  assert.doesNotMatch(sql, /to anon/i);
});

test("paper room realtime publication stays authenticated and replica-identity full", () => {
  const sql = fs.readFileSync(
    path.join(ROOT, "supabase/migrations/202610160048_paper_room_contributions_realtime.sql"),
    "utf8"
  );
  assert.match(sql, /alter table public\.paper_room_contributions replica identity full/i);
  assert.match(
    sql,
    /alter publication supabase_realtime add table public\.paper_room_contributions/i
  );
  assert.doesNotMatch(sql, /to anon/i);
});

test("call signal realtime publication stays authenticated and replica-identity full", () => {
  const sql = fs.readFileSync(
    path.join(ROOT, "supabase/migrations/202610160023_call_signal_contributions_realtime.sql"),
    "utf8"
  );
  assert.match(sql, /alter table public\.call_signal_contributions replica identity full/i);
  assert.match(
    sql,
    /alter publication supabase_realtime add table public\.call_signal_contributions/i
  );
  assert.doesNotMatch(sql, /to anon/i);
});

test("friend edge realtime publication stays authenticated and replica-identity full", () => {
  const sql = fs.readFileSync(
    path.join(ROOT, "supabase/migrations/202610160022_friend_edge_contributions_realtime.sql"),
    "utf8"
  );
  assert.match(sql, /alter table public\.friend_edge_contributions replica identity full/i);
  assert.match(
    sql,
    /alter publication supabase_realtime add table public\.friend_edge_contributions/i
  );
  assert.doesNotMatch(sql, /to anon/i);
});

test("chat thread realtime publication stays authenticated and replica-identity full", () => {
  const sql = fs.readFileSync(
    path.join(ROOT, "supabase/migrations/202610160021_chat_thread_contributions_realtime.sql"),
    "utf8"
  );
  assert.match(sql, /alter table public\.chat_thread_contributions replica identity full/i);
  assert.match(
    sql,
    /alter publication supabase_realtime add table public\.chat_thread_contributions/i
  );
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
  assert.match(
    sql,
    /grant select, insert, update, delete on table public\.presence_pings to authenticated/
  );
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
  assert.match(
    sql,
    /revoke all on table public\.popularity_contributions from anon, authenticated/
  );
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
  assert.match(
    sql,
    /revoke all on table public\.call_signal_contributions from anon, authenticated/
  );
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
  assert.match(
    sql,
    /revoke all on table public\.friend_edge_contributions from anon, authenticated/
  );
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
  assert.match(
    sql,
    /revoke all on table public\.leaderboard_pb_contributions from anon, authenticated/
  );
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
  assert.match(
    sql,
    /revoke all on table public\.chat_thread_contributions from anon, authenticated/
  );
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
  assert.match(
    sql,
    /revoke all on table public\.match_room_contributions from anon, authenticated/
  );
});

test("paper room contributions are readable by signed-in players and only writable by the owner", () => {
  const sql = fs.readFileSync(
    path.join(ROOT, "supabase/migrations/202610160047_paper_room_contributions.sql"),
    "utf8"
  );
  assert.match(sql, /create table if not exists public\.paper_room_contributions/);
  assert.match(sql, /enable row level security/i);
  assert.match(sql, /force row level security/i);
  assert.match(sql, /paper_room_contributions_read_authenticated/);
  assert.match(sql, /paper_room_contributions_insert_own/);
  assert.match(sql, /paper_room_contributions_update_own/);
  assert.match(
    sql,
    /grant select, insert, update, delete on table public\.paper_room_contributions to authenticated/
  );
  assert.match(
    sql,
    /revoke all on table public\.paper_room_contributions from anon, authenticated/
  );
  assert.doesNotMatch(sql, /add table public\.hub_docs/i);
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
  assert.match(
    sql,
    /revoke all on table public\.feedback_item_contributions from anon, authenticated/
  );
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
  assert.match(
    sql,
    /revoke all on table public\.aquarium_tank_contributions from anon, authenticated/
  );
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
  assert.match(
    sql,
    /revoke all on table public\.fishing_gift_contributions from anon, authenticated/
  );
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
  assert.match(
    sql,
    /revoke all on table public\.fishing_mail_contributions from anon, authenticated/
  );
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
  assert.match(
    sql,
    /revoke all on table public\.community_cast_contributions from anon, authenticated/
  );
});

test("community meter state is readable and writable by signed-in players", () => {
  const sql = fs.readFileSync(
    path.join(ROOT, "supabase/migrations/202610160043_community_meter_state.sql"),
    "utf8"
  );
  assert.match(sql, /create table if not exists public\.community_meter_state/);
  assert.match(sql, /enable row level security/i);
  assert.match(sql, /force row level security/i);
  assert.match(sql, /community_meter_state_read_authenticated/);
  assert.match(sql, /community_meter_state_insert_authenticated/);
  assert.match(sql, /community_meter_state_update_authenticated/);
  assert.match(
    sql,
    /grant select, insert, update on table public\.community_meter_state to authenticated/
  );
  assert.match(
    sql,
    /revoke all on table public\.community_meter_state from anon, authenticated/
  );
  assert.doesNotMatch(sql, /add table public\.hub_docs/i);
});

test("referral contributions are readable by signed-in players and only writable by the owner", () => {
  const sql = fs.readFileSync(
    path.join(ROOT, "supabase/migrations/202610160041_referral_contributions.sql"),
    "utf8"
  );
  assert.match(sql, /create table if not exists public\.referral_contributions/);
  assert.match(sql, /enable row level security/i);
  assert.match(sql, /force row level security/i);
  assert.match(sql, /referral_contributions_read_authenticated/);
  assert.match(sql, /referral_contributions_insert_own/);
  assert.match(sql, /referral_contributions_update_own/);
  assert.match(
    sql,
    /grant select, insert, update, delete on table public\.referral_contributions to authenticated/
  );
  assert.match(sql, /revoke all on table public\.referral_contributions from anon, authenticated/);
  assert.doesNotMatch(sql, /add table public\.hub_docs/i);
});
