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
