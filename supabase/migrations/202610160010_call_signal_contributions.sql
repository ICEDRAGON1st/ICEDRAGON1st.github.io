begin;

-- Per-account voice-call rooms. Anyone signed in can read; only you can write your row.
-- Replaces rewriting the shared hub_docs hub-calls board once this table is live.
create table if not exists public.call_signal_contributions (
  user_id uuid not null references auth.users (id) on delete cascade,
  player_id text not null,
  rooms jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id),
  constraint call_signal_contributions_player_id_format
    check (player_id ~ '^p-[a-z0-9][a-z0-9-]{6,80}$'),
  constraint call_signal_contributions_player_id_unique unique (player_id),
  constraint call_signal_contributions_rooms_object
    check (jsonb_typeof(rooms) = 'object')
);

alter table public.call_signal_contributions enable row level security;
alter table public.call_signal_contributions force row level security;

revoke all on table public.call_signal_contributions from anon, authenticated;
grant select, insert, update, delete on table public.call_signal_contributions to authenticated;

drop policy if exists call_signal_contributions_read_authenticated on public.call_signal_contributions;
create policy call_signal_contributions_read_authenticated
  on public.call_signal_contributions
  for select
  to authenticated
  using ((select auth.uid()) is not null);

drop policy if exists call_signal_contributions_insert_own on public.call_signal_contributions;
create policy call_signal_contributions_insert_own
  on public.call_signal_contributions
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists call_signal_contributions_update_own on public.call_signal_contributions;
create policy call_signal_contributions_update_own
  on public.call_signal_contributions
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists call_signal_contributions_delete_own on public.call_signal_contributions;
create policy call_signal_contributions_delete_own
  on public.call_signal_contributions
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

commit;
