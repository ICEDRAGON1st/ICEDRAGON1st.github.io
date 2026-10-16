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
