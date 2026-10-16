begin;

-- Per-account feedback tickets. Anyone signed in can read; only you can write your row.
-- Replaces rewriting the shared hub_docs player-feedback board once this table is live.
create table if not exists public.feedback_item_contributions (
  user_id uuid not null references auth.users (id) on delete cascade,
  player_id text not null,
  items jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id),
  constraint feedback_item_contributions_player_id_format
    check (player_id ~ '^p-[a-z0-9][a-z0-9-]{6,80}$'),
  constraint feedback_item_contributions_player_id_unique unique (player_id),
  constraint feedback_item_contributions_items_array
    check (jsonb_typeof(items) = 'array'),
  constraint feedback_item_contributions_items_cap
    check (jsonb_array_length(items) <= 40)
);

alter table public.feedback_item_contributions enable row level security;
alter table public.feedback_item_contributions force row level security;

revoke all on table public.feedback_item_contributions from anon, authenticated;
grant select, insert, update, delete on table public.feedback_item_contributions to authenticated;

drop policy if exists feedback_item_contributions_read_authenticated on public.feedback_item_contributions;
create policy feedback_item_contributions_read_authenticated
  on public.feedback_item_contributions
  for select
  to authenticated
  using ((select auth.uid()) is not null);

drop policy if exists feedback_item_contributions_insert_own on public.feedback_item_contributions;
create policy feedback_item_contributions_insert_own
  on public.feedback_item_contributions
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists feedback_item_contributions_update_own on public.feedback_item_contributions;
create policy feedback_item_contributions_update_own
  on public.feedback_item_contributions
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists feedback_item_contributions_delete_own on public.feedback_item_contributions;
create policy feedback_item_contributions_delete_own
  on public.feedback_item_contributions
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

commit;
