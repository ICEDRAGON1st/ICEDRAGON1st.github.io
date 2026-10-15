begin;

-- Compatibility document store. Clients may read after Auth; they cannot write
-- admin, economy, or announcement documents. Legacy public-write policies are
-- never recreated.
create table if not exists public.hub_docs (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  constraint hub_docs_id_format
    check (id ~ '^[a-z0-9][a-z0-9:_-]{1,95}$'),
  constraint hub_docs_payload_limit
    check (octet_length(data::text) <= 1048576)
);

alter table public.hub_docs enable row level security;
alter table public.hub_docs force row level security;

revoke all on table public.hub_docs from anon, authenticated;
grant select on table public.hub_docs to authenticated;
grant insert, update on table public.hub_docs to authenticated;

drop policy if exists "hub_docs_select" on public.hub_docs;
drop policy if exists "hub_docs_insert" on public.hub_docs;
drop policy if exists "hub_docs_update" on public.hub_docs;
drop policy if exists hub_docs_select on public.hub_docs;
drop policy if exists hub_docs_insert on public.hub_docs;
drop policy if exists hub_docs_update on public.hub_docs;

create policy hub_docs_read_authenticated
  on public.hub_docs
  for select
  to authenticated
  using ((select auth.uid()) is not null);

create policy hub_docs_insert_non_admin
  on public.hub_docs
  for insert
  to authenticated
  with check (
    (select auth.uid()) is not null
    and id not in (
      'fishing-admin-events',
      'fishing-admin-audit',
      'hub-admin-announce',
      'hub-admin-maintenance',
      'hub-admin-moderation',
      'hub-admin-grants',
      'hub-discord-site-updates'
    )
  );

create policy hub_docs_update_non_admin
  on public.hub_docs
  for update
  to authenticated
  using (
    (select auth.uid()) is not null
    and id not in (
      'fishing-admin-events',
      'fishing-admin-audit',
      'hub-admin-announce',
      'hub-admin-maintenance',
      'hub-admin-moderation',
      'hub-admin-grants',
      'hub-discord-site-updates'
    )
  )
  with check (
    (select auth.uid()) is not null
    and id not in (
      'fishing-admin-events',
      'fishing-admin-audit',
      'hub-admin-announce',
      'hub-admin-maintenance',
      'hub-admin-moderation',
      'hub-admin-grants',
      'hub-discord-site-updates'
    )
  );

drop trigger if exists hub_docs_set_updated_at on public.hub_docs;
create trigger hub_docs_set_updated_at
before update on public.hub_docs
for each row execute function public.set_row_updated_at();

insert into public.hub_docs (id, data) values
  ('leaderboards', '{"games":{},"resets":{}}'::jsonb),
  ('plays-log', '{"plays":[],"counts":{}}'::jsonb),
  ('name-registry', '{"names":{}}'::jsonb),
  ('player-codes', '{"codes":{}}'::jsonb),
  ('name-reservations', '{"reservations":{}}'::jsonb),
  ('presence', '{"players":{}}'::jsonb),
  ('players-alltime', '{"players":{},"total":0}'::jsonb),
  ('friend-chat', '{"threads":{}}'::jsonb),
  ('friends', '{"profiles":{},"invites":{}}'::jsonb),
  ('player-feedback', '{"items":[]}'::jsonb),
  ('online-matches', '{"rooms":{}}'::jsonb),
  ('fishing-community', '{}'::jsonb),
  ('fishing-gifts', '{"token":"ice-fish-gift-9f3a","gifts":{}}'::jsonb),
  ('fishing-player-mail', '{"token":"ice-fish-mail-9f3a","gifts":{},"trades":{}}'::jsonb),
  ('fishing-aquariums', '{"token":"ice-fish-aqua-9f3a","tanks":{}}'::jsonb)
on conflict (id) do nothing;

commit;
