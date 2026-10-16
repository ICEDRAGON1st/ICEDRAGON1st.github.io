begin;

-- Per-account fishing community casts. Anyone signed in can read; only you can write your row.
-- Replaces rewriting the shared hub_docs fishing-community meter once this table is live.
create table if not exists public.community_cast_contributions (
  user_id uuid not null references auth.users (id) on delete cascade,
  player_id text not null,
  week_key text not null,
  casts bigint not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id),
  constraint community_cast_contributions_player_id_format
    check (player_id ~ '^p-[a-z0-9][a-z0-9-]{6,80}$'),
  constraint community_cast_contributions_player_id_unique unique (player_id),
  constraint community_cast_contributions_week_key_len
    check (char_length(week_key) between 1 and 64),
  constraint community_cast_contributions_casts_range
    check (casts >= 0 and casts <= 10000)
);

alter table public.community_cast_contributions enable row level security;
alter table public.community_cast_contributions force row level security;

revoke all on table public.community_cast_contributions from anon, authenticated;
grant select, insert, update, delete on table public.community_cast_contributions to authenticated;

drop policy if exists community_cast_contributions_read_authenticated on public.community_cast_contributions;
create policy community_cast_contributions_read_authenticated
  on public.community_cast_contributions
  for select
  to authenticated
  using ((select auth.uid()) is not null);

drop policy if exists community_cast_contributions_insert_own on public.community_cast_contributions;
create policy community_cast_contributions_insert_own
  on public.community_cast_contributions
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists community_cast_contributions_update_own on public.community_cast_contributions;
create policy community_cast_contributions_update_own
  on public.community_cast_contributions
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists community_cast_contributions_delete_own on public.community_cast_contributions;
create policy community_cast_contributions_delete_own
  on public.community_cast_contributions
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

commit;
