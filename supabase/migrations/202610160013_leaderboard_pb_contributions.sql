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
