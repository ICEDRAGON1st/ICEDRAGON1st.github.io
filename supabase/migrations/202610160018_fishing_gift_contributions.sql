begin;

-- Per-account Fishing admin gifts. Anyone signed in can read; only you can write your row.
-- Replaces rewriting the shared hub_docs fishing-gifts board once this table is live.
create table if not exists public.fishing_gift_contributions (
  user_id uuid not null references auth.users (id) on delete cascade,
  player_id text not null,
  gifts jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id),
  constraint fishing_gift_contributions_player_id_format
    check (player_id ~ '^p-[a-z0-9][a-z0-9-]{6,80}$'),
  constraint fishing_gift_contributions_player_id_unique unique (player_id),
  constraint fishing_gift_contributions_gifts_object
    check (jsonb_typeof(gifts) = 'object')
);

alter table public.fishing_gift_contributions enable row level security;
alter table public.fishing_gift_contributions force row level security;

revoke all on table public.fishing_gift_contributions from anon, authenticated;
grant select, insert, update, delete on table public.fishing_gift_contributions to authenticated;

drop policy if exists fishing_gift_contributions_read_authenticated on public.fishing_gift_contributions;
create policy fishing_gift_contributions_read_authenticated
  on public.fishing_gift_contributions
  for select
  to authenticated
  using ((select auth.uid()) is not null);

drop policy if exists fishing_gift_contributions_insert_own on public.fishing_gift_contributions;
create policy fishing_gift_contributions_insert_own
  on public.fishing_gift_contributions
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists fishing_gift_contributions_update_own on public.fishing_gift_contributions;
create policy fishing_gift_contributions_update_own
  on public.fishing_gift_contributions
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists fishing_gift_contributions_delete_own on public.fishing_gift_contributions;
create policy fishing_gift_contributions_delete_own
  on public.fishing_gift_contributions
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

commit;
