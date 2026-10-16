begin;

-- Per-account online pings. Anyone signed in can read; only you can write your row.
-- Replaces rewriting the shared hub_docs presence map once this table is live.
create table if not exists public.presence_pings (
  user_id uuid not null references auth.users (id) on delete cascade,
  player_id text not null,
  display_name text not null default '',
  game text not null default '',
  pinged_at timestamptz not null default now(),
  primary key (user_id),
  constraint presence_pings_player_id_format
    check (player_id ~ '^p-[a-z0-9][a-z0-9-]{6,80}$'),
  constraint presence_pings_player_id_unique unique (player_id),
  constraint presence_pings_name_length
    check (char_length(display_name) <= 32),
  constraint presence_pings_game_length
    check (char_length(game) <= 32)
);

alter table public.presence_pings enable row level security;
alter table public.presence_pings force row level security;

revoke all on table public.presence_pings from anon, authenticated;
grant select, insert, update, delete on table public.presence_pings to authenticated;

drop policy if exists presence_pings_read_authenticated on public.presence_pings;
create policy presence_pings_read_authenticated
  on public.presence_pings
  for select
  to authenticated
  using ((select auth.uid()) is not null);

drop policy if exists presence_pings_insert_own on public.presence_pings;
create policy presence_pings_insert_own
  on public.presence_pings
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists presence_pings_update_own on public.presence_pings;
create policy presence_pings_update_own
  on public.presence_pings
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists presence_pings_delete_own on public.presence_pings;
create policy presence_pings_delete_own
  on public.presence_pings
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

commit;
