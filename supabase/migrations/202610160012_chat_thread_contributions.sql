begin;

-- Per-account DMs, groups, and global chat. Anyone signed in can read; only you can write your row.
-- Replaces rewriting the shared hub_docs friend-chat board once this table is live.
create table if not exists public.chat_thread_contributions (
  user_id uuid not null references auth.users (id) on delete cascade,
  player_id text not null,
  threads jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id),
  constraint chat_thread_contributions_player_id_format
    check (player_id ~ '^p-[a-z0-9][a-z0-9-]{6,80}$'),
  constraint chat_thread_contributions_player_id_unique unique (player_id),
  constraint chat_thread_contributions_threads_object
    check (jsonb_typeof(threads) = 'object')
);

alter table public.chat_thread_contributions enable row level security;
alter table public.chat_thread_contributions force row level security;

revoke all on table public.chat_thread_contributions from anon, authenticated;
grant select, insert, update, delete on table public.chat_thread_contributions to authenticated;

drop policy if exists chat_thread_contributions_read_authenticated on public.chat_thread_contributions;
create policy chat_thread_contributions_read_authenticated
  on public.chat_thread_contributions
  for select
  to authenticated
  using ((select auth.uid()) is not null);

drop policy if exists chat_thread_contributions_insert_own on public.chat_thread_contributions;
create policy chat_thread_contributions_insert_own
  on public.chat_thread_contributions
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists chat_thread_contributions_update_own on public.chat_thread_contributions;
create policy chat_thread_contributions_update_own
  on public.chat_thread_contributions
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists chat_thread_contributions_delete_own on public.chat_thread_contributions;
create policy chat_thread_contributions_delete_own
  on public.chat_thread_contributions
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

commit;
