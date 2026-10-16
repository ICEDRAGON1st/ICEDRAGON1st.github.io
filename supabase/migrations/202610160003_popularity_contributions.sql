begin;

-- Per-account play-count contributions. Anyone signed in can read; only you can write your row.
-- Replaces rewriting the shared hub_docs popularity map once this table is live.
create table if not exists public.popularity_contributions (
  user_id uuid not null references auth.users (id) on delete cascade,
  player_id text not null,
  games jsonb not null default '{}'::jsonb,
  reset_at bigint not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id),
  constraint popularity_contributions_player_id_format
    check (player_id ~ '^p-[a-z0-9][a-z0-9-]{6,80}$'),
  constraint popularity_contributions_player_id_unique unique (player_id),
  constraint popularity_contributions_games_object
    check (jsonb_typeof(games) = 'object'),
  constraint popularity_contributions_reset_at_nonneg
    check (reset_at >= 0)
);

alter table public.popularity_contributions enable row level security;
alter table public.popularity_contributions force row level security;

revoke all on table public.popularity_contributions from anon, authenticated;
grant select, insert, update, delete on table public.popularity_contributions to authenticated;

drop policy if exists popularity_contributions_read_authenticated on public.popularity_contributions;
create policy popularity_contributions_read_authenticated
  on public.popularity_contributions
  for select
  to authenticated
  using ((select auth.uid()) is not null);

drop policy if exists popularity_contributions_insert_own on public.popularity_contributions;
create policy popularity_contributions_insert_own
  on public.popularity_contributions
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists popularity_contributions_update_own on public.popularity_contributions;
create policy popularity_contributions_update_own
  on public.popularity_contributions
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists popularity_contributions_delete_own on public.popularity_contributions;
create policy popularity_contributions_delete_own
  on public.popularity_contributions
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

commit;
