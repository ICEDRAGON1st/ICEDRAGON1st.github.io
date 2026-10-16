begin;

-- Per-account recent play rows. Anyone signed in can read; only you can write your row.
-- Replaces rewriting the shared hub_docs plays-log document once this table is live.
create table if not exists public.play_log_contributions (
  user_id uuid not null references auth.users (id) on delete cascade,
  player_id text not null,
  plays jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id),
  constraint play_log_contributions_player_id_format
    check (player_id ~ '^p-[a-z0-9][a-z0-9-]{6,80}$'),
  constraint play_log_contributions_player_id_unique unique (player_id),
  constraint play_log_contributions_plays_array
    check (jsonb_typeof(plays) = 'array'),
  constraint play_log_contributions_plays_cap
    check (jsonb_array_length(plays) <= 40)
);

alter table public.play_log_contributions enable row level security;
alter table public.play_log_contributions force row level security;

revoke all on table public.play_log_contributions from anon, authenticated;
grant select, insert, update, delete on table public.play_log_contributions to authenticated;

drop policy if exists play_log_contributions_read_authenticated on public.play_log_contributions;
create policy play_log_contributions_read_authenticated
  on public.play_log_contributions
  for select
  to authenticated
  using ((select auth.uid()) is not null);

drop policy if exists play_log_contributions_insert_own on public.play_log_contributions;
create policy play_log_contributions_insert_own
  on public.play_log_contributions
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists play_log_contributions_update_own on public.play_log_contributions;
create policy play_log_contributions_update_own
  on public.play_log_contributions
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists play_log_contributions_delete_own on public.play_log_contributions;
create policy play_log_contributions_delete_own
  on public.play_log_contributions
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

commit;
