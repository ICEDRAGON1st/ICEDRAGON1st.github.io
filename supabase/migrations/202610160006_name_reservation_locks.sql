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
