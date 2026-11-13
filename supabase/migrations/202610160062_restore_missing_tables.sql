-- Re-apply contribution tables the live API cannot see.
-- Safe to run again: tables are created only when missing, then grants and policies are restored.

-- source: 202610160005_nickname_claims.sql
begin;

-- Per-account unique nicknames. Anyone signed in can read; only you can write your row.
-- Replaces rewriting the shared hub_docs name-registry map once this table is live.
create table if not exists public.nickname_claims (
  user_id uuid not null references auth.users (id) on delete cascade,
  player_id text not null,
  name_key text not null,
  claim jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id),
  constraint nickname_claims_player_id_format
    check (player_id ~ '^p-[a-z0-9][a-z0-9-]{6,80}$'),
  constraint nickname_claims_player_id_unique unique (player_id),
  constraint nickname_claims_name_key_len
    check (char_length(name_key) between 1 and 16),
  constraint nickname_claims_name_key_unique unique (name_key),
  constraint nickname_claims_claim_object
    check (jsonb_typeof(claim) = 'object')
);

alter table public.nickname_claims enable row level security;
alter table public.nickname_claims force row level security;

revoke all on table public.nickname_claims from anon, authenticated;
grant select, insert, update, delete on table public.nickname_claims to authenticated;

drop policy if exists nickname_claims_read_authenticated on public.nickname_claims;
create policy nickname_claims_read_authenticated
  on public.nickname_claims
  for select
  to authenticated
  using ((select auth.uid()) is not null);

drop policy if exists nickname_claims_insert_own on public.nickname_claims;
create policy nickname_claims_insert_own
  on public.nickname_claims
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists nickname_claims_update_own on public.nickname_claims;
create policy nickname_claims_update_own
  on public.nickname_claims
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists nickname_claims_delete_own on public.nickname_claims;
create policy nickname_claims_delete_own
  on public.nickname_claims
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

commit;

-- source: 202610160006_name_reservation_locks.sql
begin;

-- Per-account code-locked nicknames. Anyone signed in can read; only you can write your row.
-- Replaces rewriting the shared hub_docs name-reservations map once this table is live.
create table if not exists public.name_reservation_locks (
  user_id uuid not null references auth.users (id) on delete cascade,
  player_id text not null,
  name_key text not null,
  code text not null,
  display_name text not null default '',
  locked_at timestamptz not null default now(),
  primary key (user_id),
  constraint name_reservation_locks_player_id_format
    check (player_id ~ '^p-[a-z0-9][a-z0-9-]{6,80}$'),
  constraint name_reservation_locks_player_id_unique unique (player_id),
  constraint name_reservation_locks_name_key_len
    check (char_length(name_key) between 1 and 16),
  constraint name_reservation_locks_name_key_unique unique (name_key),
  constraint name_reservation_locks_code_format
    check (code ~ '^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{8}$'),
  constraint name_reservation_locks_name_length
    check (char_length(display_name) <= 32)
);

alter table public.name_reservation_locks enable row level security;
alter table public.name_reservation_locks force row level security;

revoke all on table public.name_reservation_locks from anon, authenticated;
grant select, insert, update, delete on table public.name_reservation_locks to authenticated;

drop policy if exists name_reservation_locks_read_authenticated on public.name_reservation_locks;
create policy name_reservation_locks_read_authenticated
  on public.name_reservation_locks
  for select
  to authenticated
  using ((select auth.uid()) is not null);

drop policy if exists name_reservation_locks_insert_own on public.name_reservation_locks;
create policy name_reservation_locks_insert_own
  on public.name_reservation_locks
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists name_reservation_locks_update_own on public.name_reservation_locks;
create policy name_reservation_locks_update_own
  on public.name_reservation_locks
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists name_reservation_locks_delete_own on public.name_reservation_locks;
create policy name_reservation_locks_delete_own
  on public.name_reservation_locks
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

commit;

-- source: 202610160007_player_password_hashes.sql
begin;

-- Per-account login password hashes (never plaintext). Anyone signed in can look a
-- hash up; only you can write your row. Replaces rewriting the shared hub_docs
-- player-passwords map once this table is live.
create table if not exists public.player_password_hashes (
  user_id uuid not null references auth.users (id) on delete cascade,
  player_id text not null,
  password_hash text,
  code text not null default '',
  display_name text not null default '',
  cleared boolean not null default false,
  hashed_at timestamptz not null default now(),
  primary key (user_id),
  constraint player_password_hashes_player_id_format
    check (player_id ~ '^p-[a-z0-9][a-z0-9-]{6,80}$'),
  constraint player_password_hashes_player_id_unique unique (player_id),
  constraint player_password_hashes_hash_format
    check (
      password_hash is null
      or password_hash ~ '^[0-9a-f]{64}$'
      or password_hash ~ '^f:[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{16}$'
    ),
  constraint player_password_hashes_hash_unique unique (password_hash),
  constraint player_password_hashes_hash_or_cleared
    check (
      (cleared = true and password_hash is null)
      or (cleared = false and password_hash is not null)
    ),
  constraint player_password_hashes_code_format
    check (
      code = ''
      or code ~ '^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{8}$'
    ),
  constraint player_password_hashes_name_length
    check (char_length(display_name) <= 32)
);

alter table public.player_password_hashes enable row level security;
alter table public.player_password_hashes force row level security;

revoke all on table public.player_password_hashes from anon, authenticated;
grant select, insert, update, delete on table public.player_password_hashes to authenticated;

drop policy if exists player_password_hashes_read_authenticated on public.player_password_hashes;
create policy player_password_hashes_read_authenticated
  on public.player_password_hashes
  for select
  to authenticated
  using ((select auth.uid()) is not null);

drop policy if exists player_password_hashes_insert_own on public.player_password_hashes;
create policy player_password_hashes_insert_own
  on public.player_password_hashes
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists player_password_hashes_update_own on public.player_password_hashes;
create policy player_password_hashes_update_own
  on public.player_password_hashes
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists player_password_hashes_delete_own on public.player_password_hashes;
create policy player_password_hashes_delete_own
  on public.player_password_hashes
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

commit;

-- source: 202610160008_alltime_roster.sql
begin;

-- Per-account all-time roster rows. Anyone signed in can read; only you can write your row.
-- Replaces rewriting the shared hub_docs players-alltime map once this table is live.
create table if not exists public.alltime_roster (
  user_id uuid not null references auth.users (id) on delete cascade,
  player_id text not null,
  display_name text not null default '',
  first_at bigint not null,
  last_at bigint not null,
  primary key (user_id),
  constraint alltime_roster_player_id_format
    check (player_id ~ '^p-[a-z0-9][a-z0-9-]{6,80}$'),
  constraint alltime_roster_player_id_unique unique (player_id),
  constraint alltime_roster_first_at_positive
    check (first_at > 0),
  constraint alltime_roster_last_at_order
    check (last_at >= first_at),
  constraint alltime_roster_name_length
    check (char_length(display_name) <= 32)
);

alter table public.alltime_roster enable row level security;
alter table public.alltime_roster force row level security;

revoke all on table public.alltime_roster from anon, authenticated;
grant select, insert, update, delete on table public.alltime_roster to authenticated;

drop policy if exists alltime_roster_read_authenticated on public.alltime_roster;
create policy alltime_roster_read_authenticated
  on public.alltime_roster
  for select
  to authenticated
  using ((select auth.uid()) is not null);

drop policy if exists alltime_roster_insert_own on public.alltime_roster;
create policy alltime_roster_insert_own
  on public.alltime_roster
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists alltime_roster_update_own on public.alltime_roster;
create policy alltime_roster_update_own
  on public.alltime_roster
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists alltime_roster_delete_own on public.alltime_roster;
create policy alltime_roster_delete_own
  on public.alltime_roster
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

commit;

-- source: 202610160009_play_log_contributions.sql
begin;

-- Per-account recent play rows. Anyone signed in can read; only you can write your row.
-- Replaces rewriting the shared hub_docs plays-log document once this table is live.
create table if not exists public.play_log_contributions (
  user_id uuid not null references auth.users (id) on delete cascade,
  player_id text not null,
  plays jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id),
  constraint play_log_contributions_player_id_format
    check (player_id ~ '^p-[a-z0-9][a-z0-9-]{6,80}$'),
  constraint play_log_contributions_player_id_unique unique (player_id),
  constraint play_log_contributions_plays_array
    check (jsonb_typeof(plays) = 'array'),
  constraint play_log_contributions_plays_cap
    check (jsonb_array_length(plays) <= 40)
);

alter table public.play_log_contributions enable row level security;
alter table public.play_log_contributions force row level security;

revoke all on table public.play_log_contributions from anon, authenticated;
grant select, insert, update, delete on table public.play_log_contributions to authenticated;

drop policy if exists play_log_contributions_read_authenticated on public.play_log_contributions;
create policy play_log_contributions_read_authenticated
  on public.play_log_contributions
  for select
  to authenticated
  using ((select auth.uid()) is not null);

drop policy if exists play_log_contributions_insert_own on public.play_log_contributions;
create policy play_log_contributions_insert_own
  on public.play_log_contributions
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists play_log_contributions_update_own on public.play_log_contributions;
create policy play_log_contributions_update_own
  on public.play_log_contributions
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists play_log_contributions_delete_own on public.play_log_contributions;
create policy play_log_contributions_delete_own
  on public.play_log_contributions
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

commit;

-- source: 202610160010_call_signal_contributions.sql
begin;

-- Per-account voice-call rooms. Anyone signed in can read; only you can write your row.
-- Replaces rewriting the shared hub_docs hub-calls board once this table is live.
create table if not exists public.call_signal_contributions (
  user_id uuid not null references auth.users (id) on delete cascade,
  player_id text not null,
  rooms jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id),
  constraint call_signal_contributions_player_id_format
    check (player_id ~ '^p-[a-z0-9][a-z0-9-]{6,80}$'),
  constraint call_signal_contributions_player_id_unique unique (player_id),
  constraint call_signal_contributions_rooms_object
    check (jsonb_typeof(rooms) = 'object')
);

alter table public.call_signal_contributions enable row level security;
alter table public.call_signal_contributions force row level security;

revoke all on table public.call_signal_contributions from anon, authenticated;
grant select, insert, update, delete on table public.call_signal_contributions to authenticated;

drop policy if exists call_signal_contributions_read_authenticated on public.call_signal_contributions;
create policy call_signal_contributions_read_authenticated
  on public.call_signal_contributions
  for select
  to authenticated
  using ((select auth.uid()) is not null);

drop policy if exists call_signal_contributions_insert_own on public.call_signal_contributions;
create policy call_signal_contributions_insert_own
  on public.call_signal_contributions
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists call_signal_contributions_update_own on public.call_signal_contributions;
create policy call_signal_contributions_update_own
  on public.call_signal_contributions
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists call_signal_contributions_delete_own on public.call_signal_contributions;
create policy call_signal_contributions_delete_own
  on public.call_signal_contributions
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

commit;

-- source: 202610160011_friend_edge_contributions.sql
begin;

-- Per-account friend lists and game invites. Anyone signed in can read; only you can write your row.
-- Replaces rewriting the shared hub_docs friends board once this table is live.
create table if not exists public.friend_edge_contributions (
  user_id uuid not null references auth.users (id) on delete cascade,
  player_id text not null,
  display_name text not null default '',
  friends jsonb not null default '{}'::jsonb,
  outgoing jsonb not null default '{}'::jsonb,
  incoming jsonb not null default '{}'::jsonb,
  invites jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id),
  constraint friend_edge_contributions_player_id_format
    check (player_id ~ '^p-[a-z0-9][a-z0-9-]{6,80}$'),
  constraint friend_edge_contributions_player_id_unique unique (player_id),
  constraint friend_edge_contributions_name_length
    check (char_length(display_name) <= 32),
  constraint friend_edge_contributions_friends_object
    check (jsonb_typeof(friends) = 'object'),
  constraint friend_edge_contributions_outgoing_object
    check (jsonb_typeof(outgoing) = 'object'),
  constraint friend_edge_contributions_incoming_object
    check (jsonb_typeof(incoming) = 'object'),
  constraint friend_edge_contributions_invites_object
    check (jsonb_typeof(invites) = 'object')
);

alter table public.friend_edge_contributions enable row level security;
alter table public.friend_edge_contributions force row level security;

revoke all on table public.friend_edge_contributions from anon, authenticated;
grant select, insert, update, delete on table public.friend_edge_contributions to authenticated;

drop policy if exists friend_edge_contributions_read_authenticated on public.friend_edge_contributions;
create policy friend_edge_contributions_read_authenticated
  on public.friend_edge_contributions
  for select
  to authenticated
  using ((select auth.uid()) is not null);

drop policy if exists friend_edge_contributions_insert_own on public.friend_edge_contributions;
create policy friend_edge_contributions_insert_own
  on public.friend_edge_contributions
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists friend_edge_contributions_update_own on public.friend_edge_contributions;
create policy friend_edge_contributions_update_own
  on public.friend_edge_contributions
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists friend_edge_contributions_delete_own on public.friend_edge_contributions;
create policy friend_edge_contributions_delete_own
  on public.friend_edge_contributions
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

commit;

-- source: 202610160012_chat_thread_contributions.sql
begin;

-- Per-account DMs, groups, and global chat. Anyone signed in can read; only you can write your row.
-- Replaces rewriting the shared hub_docs friend-chat board once this table is live.
create table if not exists public.chat_thread_contributions (
  user_id uuid not null references auth.users (id) on delete cascade,
  player_id text not null,
  threads jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id),
  constraint chat_thread_contributions_player_id_format
    check (player_id ~ '^p-[a-z0-9][a-z0-9-]{6,80}$'),
  constraint chat_thread_contributions_player_id_unique unique (player_id),
  constraint chat_thread_contributions_threads_object
    check (jsonb_typeof(threads) = 'object')
);

alter table public.chat_thread_contributions enable row level security;
alter table public.chat_thread_contributions force row level security;

revoke all on table public.chat_thread_contributions from anon, authenticated;
grant select, insert, update, delete on table public.chat_thread_contributions to authenticated;

drop policy if exists chat_thread_contributions_read_authenticated on public.chat_thread_contributions;
create policy chat_thread_contributions_read_authenticated
  on public.chat_thread_contributions
  for select
  to authenticated
  using ((select auth.uid()) is not null);

drop policy if exists chat_thread_contributions_insert_own on public.chat_thread_contributions;
create policy chat_thread_contributions_insert_own
  on public.chat_thread_contributions
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists chat_thread_contributions_update_own on public.chat_thread_contributions;
create policy chat_thread_contributions_update_own
  on public.chat_thread_contributions
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists chat_thread_contributions_delete_own on public.chat_thread_contributions;
create policy chat_thread_contributions_delete_own
  on public.chat_thread_contributions
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

commit;

-- source: 202610160013_leaderboard_pb_contributions.sql
begin;

-- Per-account personal bests. Anyone signed in can read; only you can write your row.
-- Replaces rewriting the shared hub_docs leaderboards board once this table is live.
create table if not exists public.leaderboard_pb_contributions (
  user_id uuid not null references auth.users (id) on delete cascade,
  player_id text not null,
  games jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id),
  constraint leaderboard_pb_contributions_player_id_format
    check (player_id ~ '^p-[a-z0-9][a-z0-9-]{6,80}$'),
  constraint leaderboard_pb_contributions_player_id_unique unique (player_id),
  constraint leaderboard_pb_contributions_games_object
    check (jsonb_typeof(games) = 'object')
);

alter table public.leaderboard_pb_contributions enable row level security;
alter table public.leaderboard_pb_contributions force row level security;

revoke all on table public.leaderboard_pb_contributions from anon, authenticated;
grant select, insert, update, delete on table public.leaderboard_pb_contributions to authenticated;

drop policy if exists leaderboard_pb_contributions_read_authenticated on public.leaderboard_pb_contributions;
create policy leaderboard_pb_contributions_read_authenticated
  on public.leaderboard_pb_contributions
  for select
  to authenticated
  using ((select auth.uid()) is not null);

drop policy if exists leaderboard_pb_contributions_insert_own on public.leaderboard_pb_contributions;
create policy leaderboard_pb_contributions_insert_own
  on public.leaderboard_pb_contributions
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists leaderboard_pb_contributions_update_own on public.leaderboard_pb_contributions;
create policy leaderboard_pb_contributions_update_own
  on public.leaderboard_pb_contributions
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists leaderboard_pb_contributions_delete_own on public.leaderboard_pb_contributions;
create policy leaderboard_pb_contributions_delete_own
  on public.leaderboard_pb_contributions
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

commit;

-- source: 202610160014_match_room_contributions.sql
begin;

-- Per-account online match rooms. Anyone signed in can read; only you can write your row.
-- Replaces rewriting the shared hub_docs online-matches board once this table is live.
create table if not exists public.match_room_contributions (
  user_id uuid not null references auth.users (id) on delete cascade,
  player_id text not null,
  rooms jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id),
  constraint match_room_contributions_player_id_format
    check (player_id ~ '^p-[a-z0-9][a-z0-9-]{6,80}$'),
  constraint match_room_contributions_player_id_unique unique (player_id),
  constraint match_room_contributions_rooms_object
    check (jsonb_typeof(rooms) = 'object')
);

alter table public.match_room_contributions enable row level security;
alter table public.match_room_contributions force row level security;

revoke all on table public.match_room_contributions from anon, authenticated;
grant select, insert, update, delete on table public.match_room_contributions to authenticated;

drop policy if exists match_room_contributions_read_authenticated on public.match_room_contributions;
create policy match_room_contributions_read_authenticated
  on public.match_room_contributions
  for select
  to authenticated
  using ((select auth.uid()) is not null);

drop policy if exists match_room_contributions_insert_own on public.match_room_contributions;
create policy match_room_contributions_insert_own
  on public.match_room_contributions
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists match_room_contributions_update_own on public.match_room_contributions;
create policy match_room_contributions_update_own
  on public.match_room_contributions
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists match_room_contributions_delete_own on public.match_room_contributions;
create policy match_room_contributions_delete_own
  on public.match_room_contributions
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

commit;

-- source: 202610160015_feedback_item_contributions.sql
begin;

-- Per-account feedback tickets. Anyone signed in can read; only you can write your row.
-- Replaces rewriting the shared hub_docs player-feedback board once this table is live.
create table if not exists public.feedback_item_contributions (
  user_id uuid not null references auth.users (id) on delete cascade,
  player_id text not null,
  items jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id),
  constraint feedback_item_contributions_player_id_format
    check (player_id ~ '^p-[a-z0-9][a-z0-9-]{6,80}$'),
  constraint feedback_item_contributions_player_id_unique unique (player_id),
  constraint feedback_item_contributions_items_array
    check (jsonb_typeof(items) = 'array'),
  constraint feedback_item_contributions_items_cap
    check (jsonb_array_length(items) <= 40)
);

alter table public.feedback_item_contributions enable row level security;
alter table public.feedback_item_contributions force row level security;

revoke all on table public.feedback_item_contributions from anon, authenticated;
grant select, insert, update, delete on table public.feedback_item_contributions to authenticated;

drop policy if exists feedback_item_contributions_read_authenticated on public.feedback_item_contributions;
create policy feedback_item_contributions_read_authenticated
  on public.feedback_item_contributions
  for select
  to authenticated
  using ((select auth.uid()) is not null);

drop policy if exists feedback_item_contributions_insert_own on public.feedback_item_contributions;
create policy feedback_item_contributions_insert_own
  on public.feedback_item_contributions
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists feedback_item_contributions_update_own on public.feedback_item_contributions;
create policy feedback_item_contributions_update_own
  on public.feedback_item_contributions
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists feedback_item_contributions_delete_own on public.feedback_item_contributions;
create policy feedback_item_contributions_delete_own
  on public.feedback_item_contributions
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

commit;

-- source: 202610160017_fishing_mail_contributions.sql
begin;

-- Per-account Fishing player mail (gifts + trades). Anyone signed in can read; only you can write your row.
-- Replaces rewriting the shared hub_docs fishing-player-mail board once this table is live.
create table if not exists public.fishing_mail_contributions (
  user_id uuid not null references auth.users (id) on delete cascade,
  player_id text not null,
  gifts jsonb not null default '{}'::jsonb,
  trades jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id),
  constraint fishing_mail_contributions_player_id_format
    check (player_id ~ '^p-[a-z0-9][a-z0-9-]{6,80}$'),
  constraint fishing_mail_contributions_player_id_unique unique (player_id),
  constraint fishing_mail_contributions_gifts_object
    check (jsonb_typeof(gifts) = 'object'),
  constraint fishing_mail_contributions_trades_object
    check (jsonb_typeof(trades) = 'object')
);

alter table public.fishing_mail_contributions enable row level security;
alter table public.fishing_mail_contributions force row level security;

revoke all on table public.fishing_mail_contributions from anon, authenticated;
grant select, insert, update, delete on table public.fishing_mail_contributions to authenticated;

drop policy if exists fishing_mail_contributions_read_authenticated on public.fishing_mail_contributions;
create policy fishing_mail_contributions_read_authenticated
  on public.fishing_mail_contributions
  for select
  to authenticated
  using ((select auth.uid()) is not null);

drop policy if exists fishing_mail_contributions_insert_own on public.fishing_mail_contributions;
create policy fishing_mail_contributions_insert_own
  on public.fishing_mail_contributions
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists fishing_mail_contributions_update_own on public.fishing_mail_contributions;
create policy fishing_mail_contributions_update_own
  on public.fishing_mail_contributions
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists fishing_mail_contributions_delete_own on public.fishing_mail_contributions;
create policy fishing_mail_contributions_delete_own
  on public.fishing_mail_contributions
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

commit;

-- source: 202610160019_aquarium_tank_contributions.sql
begin;

-- Per-account Fishing aquarium tanks. Anyone signed in can read; only you can write your row.
-- Replaces rewriting the shared hub_docs fishing-aquariums board once this table is live.
create table if not exists public.aquarium_tank_contributions (
  user_id uuid not null references auth.users (id) on delete cascade,
  player_id text not null,
  tank jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id),
  constraint aquarium_tank_contributions_player_id_format
    check (player_id ~ '^p-[a-z0-9][a-z0-9-]{6,80}$'),
  constraint aquarium_tank_contributions_player_id_unique unique (player_id),
  constraint aquarium_tank_contributions_tank_object
    check (jsonb_typeof(tank) = 'object')
);

alter table public.aquarium_tank_contributions enable row level security;
alter table public.aquarium_tank_contributions force row level security;

revoke all on table public.aquarium_tank_contributions from anon, authenticated;
grant select, insert, update, delete on table public.aquarium_tank_contributions to authenticated;

drop policy if exists aquarium_tank_contributions_read_authenticated on public.aquarium_tank_contributions;
create policy aquarium_tank_contributions_read_authenticated
  on public.aquarium_tank_contributions
  for select
  to authenticated
  using ((select auth.uid()) is not null);

drop policy if exists aquarium_tank_contributions_insert_own on public.aquarium_tank_contributions;
create policy aquarium_tank_contributions_insert_own
  on public.aquarium_tank_contributions
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists aquarium_tank_contributions_update_own on public.aquarium_tank_contributions;
create policy aquarium_tank_contributions_update_own
  on public.aquarium_tank_contributions
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists aquarium_tank_contributions_delete_own on public.aquarium_tank_contributions;
create policy aquarium_tank_contributions_delete_own
  on public.aquarium_tank_contributions
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

commit;

-- source: 202610160021_chat_thread_contributions_realtime.sql
begin;

-- Authenticated postgres_changes for DMs, groups, and global chat.
-- Replica identity full so UPDATE/DELETE payloads include player_id and threads.
alter table public.chat_thread_contributions replica identity full;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'chat_thread_contributions'
  ) then
    execute 'alter publication supabase_realtime add table public.chat_thread_contributions';
  end if;
end $$;

commit;

-- source: 202610160022_friend_edge_contributions_realtime.sql
begin;

-- Authenticated postgres_changes for friend lists and game invites.
-- Replica identity full so UPDATE/DELETE payloads include player_id and edges.
alter table public.friend_edge_contributions replica identity full;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'friend_edge_contributions'
  ) then
    execute 'alter publication supabase_realtime add table public.friend_edge_contributions';
  end if;
end $$;

commit;

-- source: 202610160023_call_signal_contributions_realtime.sql
begin;

-- Authenticated postgres_changes for voice-call rooms.
-- Replica identity full so UPDATE/DELETE payloads include player_id and rooms.
alter table public.call_signal_contributions replica identity full;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'call_signal_contributions'
  ) then
    execute 'alter publication supabase_realtime add table public.call_signal_contributions';
  end if;
end $$;

commit;

-- source: 202610160024_match_room_contributions_realtime.sql
begin;

-- Authenticated postgres_changes for online match rooms.
-- Replica identity full so UPDATE/DELETE payloads include player_id and rooms.
alter table public.match_room_contributions replica identity full;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'match_room_contributions'
  ) then
    execute 'alter publication supabase_realtime add table public.match_room_contributions';
  end if;
end $$;

commit;

-- source: 202610160025_fishing_mail_contributions_realtime.sql
begin;

-- Authenticated postgres_changes for Fishing player mail (gifts + trades).
-- Replica identity full so UPDATE/DELETE payloads include player_id, gifts, and trades.
alter table public.fishing_mail_contributions replica identity full;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'fishing_mail_contributions'
  ) then
    execute 'alter publication supabase_realtime add table public.fishing_mail_contributions';
  end if;
end $$;

commit;

-- source: 202610160027_aquarium_tank_contributions_realtime.sql
begin;

-- Authenticated postgres_changes for Fishing aquarium tanks.
-- Replica identity full so UPDATE/DELETE payloads include player_id and tank.
alter table public.aquarium_tank_contributions replica identity full;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'aquarium_tank_contributions'
  ) then
    execute 'alter publication supabase_realtime add table public.aquarium_tank_contributions';
  end if;
end $$;

commit;

-- source: 202610160029_feedback_item_contributions_realtime.sql
begin;

-- Authenticated postgres_changes for Feedback tickets.
-- Replica identity full so UPDATE/DELETE payloads include player_id and items.
alter table public.feedback_item_contributions replica identity full;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'feedback_item_contributions'
  ) then
    execute 'alter publication supabase_realtime add table public.feedback_item_contributions';
  end if;
end $$;

commit;

-- source: 202610160030_leaderboard_pb_contributions_realtime.sql
begin;

-- Authenticated postgres_changes for leaderboard personal bests.
-- Replica identity full so UPDATE/DELETE payloads include player_id and games.
alter table public.leaderboard_pb_contributions replica identity full;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'leaderboard_pb_contributions'
  ) then
    execute 'alter publication supabase_realtime add table public.leaderboard_pb_contributions';
  end if;
end $$;

commit;

-- source: 202610160032_play_log_contributions_realtime.sql
begin;

-- Authenticated postgres_changes for recent play rows.
-- Replica identity full so UPDATE/DELETE payloads include player_id and plays.
alter table public.play_log_contributions replica identity full;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'play_log_contributions'
  ) then
    execute 'alter publication supabase_realtime add table public.play_log_contributions';
  end if;
end $$;

commit;

-- source: 202610160033_nickname_claims_realtime.sql
begin;

-- Authenticated postgres_changes for unique nicknames.
-- Replica identity full so UPDATE/DELETE payloads include player_id, name_key, and claim.
alter table public.nickname_claims replica identity full;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'nickname_claims'
  ) then
    execute 'alter publication supabase_realtime add table public.nickname_claims';
  end if;
end $$;

commit;

-- source: 202610160034_alltime_roster_realtime.sql
begin;

-- Authenticated postgres_changes for the all-time player roster.
-- Replica identity full so UPDATE/DELETE payloads include player_id and first/last seen.
alter table public.alltime_roster replica identity full;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'alltime_roster'
  ) then
    execute 'alter publication supabase_realtime add table public.alltime_roster';
  end if;
end $$;

commit;

-- source: 202610160036_name_reservation_locks_realtime.sql
begin;

-- Authenticated postgres_changes for code-locked nicknames.
-- Replica identity full so UPDATE/DELETE payloads include player_id, name_key, and code.
alter table public.name_reservation_locks replica identity full;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'name_reservation_locks'
  ) then
    execute 'alter publication supabase_realtime add table public.name_reservation_locks';
  end if;
end $$;

commit;

-- source: 202610160037_admin_broadcasts.sql
begin;

-- Dedicated admin board for hub announcements, maintenance, bans, and grants.
-- Authenticated players can read; writes stay on the trusted RPC (not anon REST).
-- Do not put hub_docs on Realtime — this table is the live channel instead.
create table if not exists public.admin_broadcasts (
  doc_id text primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  constraint admin_broadcasts_doc_id_allowed check (
    doc_id in (
      'hub-admin-announce',
      'hub-admin-maintenance',
      'hub-admin-moderation',
      'hub-admin-grants'
    )
  )
);

alter table public.admin_broadcasts enable row level security;
alter table public.admin_broadcasts force row level security;

revoke all on table public.admin_broadcasts from anon, authenticated;
grant select on table public.admin_broadcasts to authenticated;

drop policy if exists admin_broadcasts_read_authenticated on public.admin_broadcasts;
create policy admin_broadcasts_read_authenticated
  on public.admin_broadcasts
  for select
  to authenticated
  using ((select auth.uid()) is not null);

insert into public.admin_broadcasts as b (doc_id, data, updated_at)
select h.id, coalesce(h.data, '{}'::jsonb), coalesce(h.updated_at, now())
from public.hub_docs h
where h.id in (
  'hub-admin-announce',
  'hub-admin-maintenance',
  'hub-admin-moderation',
  'hub-admin-grants'
)
on conflict (doc_id) do nothing;

create or replace function public.upsert_admin_hub_doc(doc_id text, doc_data jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  allowed constant text[] := array[
    'fishing-admin-events',
    'fishing-admin-audit',
    'hub-admin-announce',
    'hub-admin-maintenance',
    'hub-admin-moderation',
    'hub-admin-grants',
    'hub-discord-site-updates'
  ];
  live constant text[] := array[
    'hub-admin-announce',
    'hub-admin-maintenance',
    'hub-admin-moderation',
    'hub-admin-grants'
  ];
  tok text;
begin
  if (select auth.uid()) is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if doc_id is null or doc_id <> all (allowed) then
    raise exception 'bad admin doc' using errcode = '22023';
  end if;
  tok := coalesce(doc_data ->> 'token', '');
  if not (
    public.has_app_role('owner')
    or public.has_app_role('admin')
    or tok in ('ice-fish-evt-9f3a', 'ice-hub-admin-9f3a')
  ) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  insert into public.hub_docs as h (id, data, updated_at)
  values (doc_id, coalesce(doc_data, '{}'::jsonb), now())
  on conflict (id) do update
    set data = excluded.data,
        updated_at = now();
  if doc_id = any (live) then
    insert into public.admin_broadcasts as b (doc_id, data, updated_at)
    values (doc_id, coalesce(doc_data, '{}'::jsonb), now())
    on conflict (doc_id) do update
      set data = excluded.data,
          updated_at = now();
  end if;
end;
$$;

revoke all on function public.upsert_admin_hub_doc(text, jsonb) from public, anon;
grant execute on function public.upsert_admin_hub_doc(text, jsonb) to authenticated;

commit;

-- source: 202610160038_admin_broadcasts_realtime.sql
begin;

-- Authenticated postgres_changes for hub admin broadcasts.
-- Replica identity full so UPDATE/DELETE payloads include doc_id and data.
-- Do not add hub_docs to supabase_realtime.
alter table public.admin_broadcasts replica identity full;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'admin_broadcasts'
  ) then
    execute 'alter publication supabase_realtime add table public.admin_broadcasts';
  end if;
end $$;

commit;

-- source: 202610160039_admin_broadcasts_fishing_events.sql
begin;

-- Live Fishing admin-event bundles on admin_broadcasts (not hub_docs Realtime).
alter table public.admin_broadcasts drop constraint if exists admin_broadcasts_doc_id_allowed;
alter table public.admin_broadcasts
  add constraint admin_broadcasts_doc_id_allowed check (
    doc_id in (
      'hub-admin-announce',
      'hub-admin-maintenance',
      'hub-admin-moderation',
      'hub-admin-grants',
      'fishing-admin-events'
    )
  );

insert into public.admin_broadcasts as b (doc_id, data, updated_at)
select h.id, coalesce(h.data, '{}'::jsonb), coalesce(h.updated_at, now())
from public.hub_docs h
where h.id = 'fishing-admin-events'
on conflict (doc_id) do nothing;

create or replace function public.upsert_admin_hub_doc(doc_id text, doc_data jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  allowed constant text[] := array[
    'fishing-admin-events',
    'fishing-admin-audit',
    'hub-admin-announce',
    'hub-admin-maintenance',
    'hub-admin-moderation',
    'hub-admin-grants',
    'hub-discord-site-updates'
  ];
  live constant text[] := array[
    'hub-admin-announce',
    'hub-admin-maintenance',
    'hub-admin-moderation',
    'hub-admin-grants',
    'fishing-admin-events'
  ];
  tok text;
begin
  if (select auth.uid()) is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if doc_id is null or doc_id <> all (allowed) then
    raise exception 'bad admin doc' using errcode = '22023';
  end if;
  tok := coalesce(doc_data ->> 'token', '');
  if not (
    public.has_app_role('owner')
    or public.has_app_role('admin')
    or tok in ('ice-fish-evt-9f3a', 'ice-hub-admin-9f3a')
  ) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  insert into public.hub_docs as h (id, data, updated_at)
  values (doc_id, coalesce(doc_data, '{}'::jsonb), now())
  on conflict (id) do update
    set data = excluded.data,
        updated_at = now();
  if doc_id = any (live) then
    insert into public.admin_broadcasts as b (doc_id, data, updated_at)
    values (doc_id, coalesce(doc_data, '{}'::jsonb), now())
    on conflict (doc_id) do update
      set data = excluded.data,
          updated_at = now();
  end if;
end;
$$;

revoke all on function public.upsert_admin_hub_doc(text, jsonb) from public, anon;
grant execute on function public.upsert_admin_hub_doc(text, jsonb) to authenticated;

commit;

-- source: 202610160040_admin_broadcasts_fishing_announce.sql
begin;

-- Lock Fishing popups onto the trusted RPC and the live admin_broadcasts table.
-- Do not put hub_docs on Realtime.
alter table public.admin_broadcasts drop constraint if exists admin_broadcasts_doc_id_allowed;
alter table public.admin_broadcasts
  add constraint admin_broadcasts_doc_id_allowed check (
    doc_id in (
      'hub-admin-announce',
      'hub-admin-maintenance',
      'hub-admin-moderation',
      'hub-admin-grants',
      'fishing-admin-events',
      'fishing-admin-announce'
    )
  );

insert into public.admin_broadcasts as b (doc_id, data, updated_at)
select h.id, coalesce(h.data, '{}'::jsonb), coalesce(h.updated_at, now())
from public.hub_docs h
where h.id = 'fishing-admin-announce'
on conflict (doc_id) do nothing;

drop policy if exists hub_docs_insert_non_admin on public.hub_docs;
create policy hub_docs_insert_non_admin
  on public.hub_docs
  for insert
  to authenticated
  with check (
    (select auth.uid()) is not null
    and id not in (
      'fishing-admin-events',
      'fishing-admin-audit',
      'fishing-admin-announce',
      'hub-admin-announce',
      'hub-admin-maintenance',
      'hub-admin-moderation',
      'hub-admin-grants',
      'hub-discord-site-updates'
    )
  );

drop policy if exists hub_docs_update_non_admin on public.hub_docs;
create policy hub_docs_update_non_admin
  on public.hub_docs
  for update
  to authenticated
  using (
    (select auth.uid()) is not null
    and id not in (
      'fishing-admin-events',
      'fishing-admin-audit',
      'fishing-admin-announce',
      'hub-admin-announce',
      'hub-admin-maintenance',
      'hub-admin-moderation',
      'hub-admin-grants',
      'hub-discord-site-updates'
    )
  )
  with check (
    (select auth.uid()) is not null
    and id not in (
      'fishing-admin-events',
      'fishing-admin-audit',
      'fishing-admin-announce',
      'hub-admin-announce',
      'hub-admin-maintenance',
      'hub-admin-moderation',
      'hub-admin-grants',
      'hub-discord-site-updates'
    )
  );

create or replace function public.upsert_admin_hub_doc(doc_id text, doc_data jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  allowed constant text[] := array[
    'fishing-admin-events',
    'fishing-admin-audit',
    'fishing-admin-announce',
    'hub-admin-announce',
    'hub-admin-maintenance',
    'hub-admin-moderation',
    'hub-admin-grants',
    'hub-discord-site-updates'
  ];
  live constant text[] := array[
    'hub-admin-announce',
    'hub-admin-maintenance',
    'hub-admin-moderation',
    'hub-admin-grants',
    'fishing-admin-events',
    'fishing-admin-announce'
  ];
  tok text;
begin
  if (select auth.uid()) is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if doc_id is null or doc_id <> all (allowed) then
    raise exception 'bad admin doc' using errcode = '22023';
  end if;
  tok := coalesce(doc_data ->> 'token', '');
  if not (
    public.has_app_role('owner')
    or public.has_app_role('admin')
    or tok in ('ice-fish-evt-9f3a', 'ice-hub-admin-9f3a')
  ) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  insert into public.hub_docs as h (id, data, updated_at)
  values (doc_id, coalesce(doc_data, '{}'::jsonb), now())
  on conflict (id) do update
    set data = excluded.data,
        updated_at = now();
  if doc_id = any (live) then
    insert into public.admin_broadcasts as b (doc_id, data, updated_at)
    values (doc_id, coalesce(doc_data, '{}'::jsonb), now())
    on conflict (doc_id) do update
      set data = excluded.data,
          updated_at = now();
  end if;
end;
$$;

revoke all on function public.upsert_admin_hub_doc(text, jsonb) from public, anon;
grant execute on function public.upsert_admin_hub_doc(text, jsonb) to authenticated;

commit;

-- source: 202610160041_referral_contributions.sql
begin;

-- Per-account invite credits. Anyone signed in can read; only you can write your row.
-- Replaces rewriting the shared hub_docs hub-referrals-v1 board once this table is live.
create table if not exists public.referral_contributions (
  user_id uuid not null references auth.users (id) on delete cascade,
  player_id text not null,
  inviter_id text not null,
  inviter_code text not null,
  invitee_name text not null default '',
  credited_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id),
  constraint referral_contributions_player_id_format
    check (player_id ~ '^p-[a-z0-9][a-z0-9-]{6,80}$'),
  constraint referral_contributions_inviter_id_format
    check (inviter_id ~ '^p-[a-z0-9][a-z0-9-]{6,80}$'),
  constraint referral_contributions_player_id_unique unique (player_id),
  constraint referral_contributions_not_self
    check (player_id <> inviter_id),
  constraint referral_contributions_code_format
    check (inviter_code ~ '^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{8}$'),
  constraint referral_contributions_name_length
    check (char_length(invitee_name) <= 16)
);

alter table public.referral_contributions enable row level security;
alter table public.referral_contributions force row level security;

revoke all on table public.referral_contributions from anon, authenticated;
grant select, insert, update, delete on table public.referral_contributions to authenticated;

drop policy if exists referral_contributions_read_authenticated on public.referral_contributions;
create policy referral_contributions_read_authenticated
  on public.referral_contributions
  for select
  to authenticated
  using ((select auth.uid()) is not null);

drop policy if exists referral_contributions_insert_own on public.referral_contributions;
create policy referral_contributions_insert_own
  on public.referral_contributions
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists referral_contributions_update_own on public.referral_contributions;
create policy referral_contributions_update_own
  on public.referral_contributions
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists referral_contributions_delete_own on public.referral_contributions;
create policy referral_contributions_delete_own
  on public.referral_contributions
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

commit;

-- source: 202610160042_referral_contributions_realtime.sql
begin;

-- Authenticated postgres_changes for invite credits.
-- Replica identity full so UPDATE/DELETE payloads include player_id and inviter_id.
alter table public.referral_contributions replica identity full;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'referral_contributions'
  ) then
    execute 'alter publication supabase_realtime add table public.referral_contributions';
  end if;
end $$;

commit;

-- source: 202610160045_admin_broadcasts_leaderboard_resets.sql
begin;

-- ICE high-score wipes on the signed-in admin channel.
-- Do not put hub_docs on Realtime. Personal bests stay on leaderboard_pb_contributions.
alter table public.admin_broadcasts drop constraint if exists admin_broadcasts_doc_id_allowed;
alter table public.admin_broadcasts
  add constraint admin_broadcasts_doc_id_allowed check (
    doc_id in (
      'hub-admin-announce',
      'hub-admin-maintenance',
      'hub-admin-moderation',
      'hub-admin-grants',
      'fishing-admin-events',
      'fishing-admin-announce',
      'hub-leaderboard-resets'
    )
  );

insert into public.admin_broadcasts as b (doc_id, data, updated_at)
select
  'hub-leaderboard-resets',
  jsonb_build_object(
    'token', 'ice-hub-admin-9f3a',
    'resets', coalesce(h.data -> 'resets', '{}'::jsonb)
  ),
  coalesce(h.updated_at, now())
from public.hub_docs h
where h.id = 'leaderboards'
on conflict (doc_id) do nothing;

create or replace function public.upsert_admin_hub_doc(doc_id text, doc_data jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  allowed constant text[] := array[
    'fishing-admin-events',
    'fishing-admin-audit',
    'fishing-admin-announce',
    'hub-admin-announce',
    'hub-admin-maintenance',
    'hub-admin-moderation',
    'hub-admin-grants',
    'hub-discord-site-updates',
    'hub-leaderboard-resets'
  ];
  live constant text[] := array[
    'hub-admin-announce',
    'hub-admin-maintenance',
    'hub-admin-moderation',
    'hub-admin-grants',
    'fishing-admin-events',
    'fishing-admin-announce',
    'hub-leaderboard-resets'
  ];
  tok text;
begin
  if (select auth.uid()) is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if doc_id is null or doc_id <> all (allowed) then
    raise exception 'bad admin doc' using errcode = '22023';
  end if;
  tok := coalesce(doc_data ->> 'token', '');
  if not (
    public.has_app_role('owner')
    or public.has_app_role('admin')
    or tok in ('ice-fish-evt-9f3a', 'ice-hub-admin-9f3a')
  ) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  insert into public.hub_docs as h (id, data, updated_at)
  values (doc_id, coalesce(doc_data, '{}'::jsonb), now())
  on conflict (id) do update
    set data = excluded.data,
        updated_at = now();
  if doc_id = any (live) then
    insert into public.admin_broadcasts as b (doc_id, data, updated_at)
    values (doc_id, coalesce(doc_data, '{}'::jsonb), now())
    on conflict (doc_id) do update
      set data = excluded.data,
          updated_at = now();
  end if;
end;
$$;

revoke all on function public.upsert_admin_hub_doc(text, jsonb) from public, anon;
grant execute on function public.upsert_admin_hub_doc(text, jsonb) to authenticated;

commit;

-- source: 202610160046_admin_broadcasts_feedback_deletes.sql
begin;

-- ICE Feedback deletes on the signed-in admin channel.
-- Do not put hub_docs on Realtime. Tickets stay on feedback_item_contributions.
alter table public.admin_broadcasts drop constraint if exists admin_broadcasts_doc_id_allowed;
alter table public.admin_broadcasts
  add constraint admin_broadcasts_doc_id_allowed check (
    doc_id in (
      'hub-admin-announce',
      'hub-admin-maintenance',
      'hub-admin-moderation',
      'hub-admin-grants',
      'fishing-admin-events',
      'fishing-admin-announce',
      'hub-leaderboard-resets',
      'hub-feedback-deletes'
    )
  );

insert into public.admin_broadcasts as b (doc_id, data, updated_at)
select
  'hub-feedback-deletes',
  jsonb_build_object(
    'token', 'ice-hub-admin-9f3a',
    'deletedIds', coalesce(h.data -> 'deletedIds', '[]'::jsonb)
  ),
  coalesce(h.updated_at, now())
from public.hub_docs h
where h.id = 'player-feedback'
on conflict (doc_id) do nothing;

create or replace function public.upsert_admin_hub_doc(doc_id text, doc_data jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  allowed constant text[] := array[
    'fishing-admin-events',
    'fishing-admin-audit',
    'fishing-admin-announce',
    'hub-admin-announce',
    'hub-admin-maintenance',
    'hub-admin-moderation',
    'hub-admin-grants',
    'hub-discord-site-updates',
    'hub-leaderboard-resets',
    'hub-feedback-deletes'
  ];
  live constant text[] := array[
    'hub-admin-announce',
    'hub-admin-maintenance',
    'hub-admin-moderation',
    'hub-admin-grants',
    'fishing-admin-events',
    'fishing-admin-announce',
    'hub-leaderboard-resets',
    'hub-feedback-deletes'
  ];
  tok text;
begin
  if (select auth.uid()) is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if doc_id is null or doc_id <> all (allowed) then
    raise exception 'bad admin doc' using errcode = '22023';
  end if;
  tok := coalesce(doc_data ->> 'token', '');
  if not (
    public.has_app_role('owner')
    or public.has_app_role('admin')
    or tok in ('ice-fish-evt-9f3a', 'ice-hub-admin-9f3a')
  ) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  insert into public.hub_docs as h (id, data, updated_at)
  values (doc_id, coalesce(doc_data, '{}'::jsonb), now())
  on conflict (id) do update
    set data = excluded.data,
        updated_at = now();
  if doc_id = any (live) then
    insert into public.admin_broadcasts as b (doc_id, data, updated_at)
    values (doc_id, coalesce(doc_data, '{}'::jsonb), now())
    on conflict (doc_id) do update
      set data = excluded.data,
          updated_at = now();
  end if;
end;
$$;

revoke all on function public.upsert_admin_hub_doc(text, jsonb) from public, anon;
grant execute on function public.upsert_admin_hub_doc(text, jsonb) to authenticated;

commit;

-- source: 202610160050_admin_broadcasts_no_hub_docs.sql
begin;

-- Admin writes stay on admin_broadcasts. Do not copy leftover hub_docs.
-- Fishing admin logs join the live channel. Do not put hub_docs on Realtime.
alter table public.admin_broadcasts drop constraint if exists admin_broadcasts_doc_id_allowed;
alter table public.admin_broadcasts
  add constraint admin_broadcasts_doc_id_allowed check (
    doc_id in (
      'hub-admin-announce',
      'hub-admin-maintenance',
      'hub-admin-moderation',
      'hub-admin-grants',
      'fishing-admin-events',
      'fishing-admin-announce',
      'fishing-admin-audit',
      'hub-leaderboard-resets',
      'hub-feedback-deletes'
    )
  );

insert into public.admin_broadcasts as b (doc_id, data, updated_at)
select h.id, coalesce(h.data, '{}'::jsonb), coalesce(h.updated_at, now())
from public.hub_docs h
where h.id = 'fishing-admin-audit'
on conflict (doc_id) do nothing;

create or replace function public.upsert_admin_hub_doc(doc_id text, doc_data jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  allowed constant text[] := array[
    'fishing-admin-events',
    'fishing-admin-audit',
    'fishing-admin-announce',
    'hub-admin-announce',
    'hub-admin-maintenance',
    'hub-admin-moderation',
    'hub-admin-grants',
    'hub-discord-site-updates',
    'hub-leaderboard-resets',
    'hub-feedback-deletes'
  ];
  live constant text[] := array[
    'hub-admin-announce',
    'hub-admin-maintenance',
    'hub-admin-moderation',
    'hub-admin-grants',
    'fishing-admin-events',
    'fishing-admin-announce',
    'fishing-admin-audit',
    'hub-leaderboard-resets',
    'hub-feedback-deletes'
  ];
  tok text;
begin
  if (select auth.uid()) is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if doc_id is null or doc_id <> all (allowed) then
    raise exception 'bad admin doc' using errcode = '22023';
  end if;
  tok := coalesce(doc_data ->> 'token', '');
  if not (
    public.has_app_role('owner')
    or public.has_app_role('admin')
    or tok in ('ice-fish-evt-9f3a', 'ice-hub-admin-9f3a')
  ) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if doc_id = any (live) then
    insert into public.admin_broadcasts as b (doc_id, data, updated_at)
    values (doc_id, coalesce(doc_data, '{}'::jsonb), now())
    on conflict (doc_id) do update
      set data = excluded.data,
          updated_at = now();
  end if;
end;
$$;

revoke all on function public.upsert_admin_hub_doc(text, jsonb) from public, anon;
grant execute on function public.upsert_admin_hub_doc(text, jsonb) to authenticated;

commit;
