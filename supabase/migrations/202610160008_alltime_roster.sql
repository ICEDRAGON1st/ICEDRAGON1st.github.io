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
