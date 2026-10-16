begin;

-- Per-account player codes. Anyone signed in can look a code up; only you can write your row.
-- Replaces rewriting the shared hub_docs player-codes map once this table is live.
create table if not exists public.player_code_claims (
  user_id uuid not null references auth.users (id) on delete cascade,
  player_id text not null,
  code text not null,
  display_name text not null default '',
  claimed_at timestamptz not null default now(),
  primary key (user_id),
  constraint player_code_claims_player_id_format
    check (player_id ~ '^p-[a-z0-9][a-z0-9-]{6,80}$'),
  constraint player_code_claims_player_id_unique unique (player_id),
  constraint player_code_claims_code_format
    check (code ~ '^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{8}$'),
  constraint player_code_claims_code_unique unique (code),
  constraint player_code_claims_name_length
    check (char_length(display_name) <= 32)
);

alter table public.player_code_claims enable row level security;
alter table public.player_code_claims force row level security;

revoke all on table public.player_code_claims from anon, authenticated;
grant select, insert, update, delete on table public.player_code_claims to authenticated;

drop policy if exists player_code_claims_read_authenticated on public.player_code_claims;
create policy player_code_claims_read_authenticated
  on public.player_code_claims
  for select
  to authenticated
  using ((select auth.uid()) is not null);

drop policy if exists player_code_claims_insert_own on public.player_code_claims;
create policy player_code_claims_insert_own
  on public.player_code_claims
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists player_code_claims_update_own on public.player_code_claims;
create policy player_code_claims_update_own
  on public.player_code_claims
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists player_code_claims_delete_own on public.player_code_claims;
create policy player_code_claims_delete_own
  on public.player_code_claims
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

commit;
