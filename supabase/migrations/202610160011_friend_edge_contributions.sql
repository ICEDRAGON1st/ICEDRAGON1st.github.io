begin;

-- Per-account friend lists and game invites. Anyone signed in can read; only you can write your row.
-- Replaces rewriting the shared hub_docs friends board once this table is live.
create table if not exists public.friend_edge_contributions (
  user_id uuid not null references auth.users (id) on delete cascade,
  player_id text not null,
  display_name text not null default '',
  friends jsonb not null default '{}'::jsonb,
  outgoing jsonb not null default '{}'::jsonb,
  incoming jsonb not null default '{}'::jsonb,
  invites jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id),
  constraint friend_edge_contributions_player_id_format
    check (player_id ~ '^p-[a-z0-9][a-z0-9-]{6,80}$'),
  constraint friend_edge_contributions_player_id_unique unique (player_id),
  constraint friend_edge_contributions_name_length
    check (char_length(display_name) <= 32),
  constraint friend_edge_contributions_friends_object
    check (jsonb_typeof(friends) = 'object'),
  constraint friend_edge_contributions_outgoing_object
    check (jsonb_typeof(outgoing) = 'object'),
  constraint friend_edge_contributions_incoming_object
    check (jsonb_typeof(incoming) = 'object'),
  constraint friend_edge_contributions_invites_object
    check (jsonb_typeof(invites) = 'object')
);

alter table public.friend_edge_contributions enable row level security;
alter table public.friend_edge_contributions force row level security;

revoke all on table public.friend_edge_contributions from anon, authenticated;
grant select, insert, update, delete on table public.friend_edge_contributions to authenticated;

drop policy if exists friend_edge_contributions_read_authenticated on public.friend_edge_contributions;
create policy friend_edge_contributions_read_authenticated
  on public.friend_edge_contributions
  for select
  to authenticated
  using ((select auth.uid()) is not null);

drop policy if exists friend_edge_contributions_insert_own on public.friend_edge_contributions;
create policy friend_edge_contributions_insert_own
  on public.friend_edge_contributions
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists friend_edge_contributions_update_own on public.friend_edge_contributions;
create policy friend_edge_contributions_update_own
  on public.friend_edge_contributions
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists friend_edge_contributions_delete_own on public.friend_edge_contributions;
create policy friend_edge_contributions_delete_own
  on public.friend_edge_contributions
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

commit;
