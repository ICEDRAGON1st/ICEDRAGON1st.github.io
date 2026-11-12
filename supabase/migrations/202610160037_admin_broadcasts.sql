begin;

-- Dedicated admin board for hub announcements, maintenance, bans, and grants.
-- Authenticated players can read; writes stay on the trusted RPC (not anon REST).
-- Do not put hub_docs on Realtime — this table is the live channel instead.
create table if not exists public.admin_broadcasts (
  doc_id text primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  constraint admin_broadcasts_doc_id_allowed check (
    doc_id in (
      'hub-admin-announce',
      'hub-admin-maintenance',
      'hub-admin-moderation',
      'hub-admin-grants'
    )
  )
);

alter table public.admin_broadcasts enable row level security;
alter table public.admin_broadcasts force row level security;

revoke all on table public.admin_broadcasts from anon, authenticated;
grant select on table public.admin_broadcasts to authenticated;

drop policy if exists admin_broadcasts_read_authenticated on public.admin_broadcasts;
create policy admin_broadcasts_read_authenticated
  on public.admin_broadcasts
  for select
  to authenticated
  using ((select auth.uid()) is not null);

insert into public.admin_broadcasts as b (doc_id, data, updated_at)
select h.id, coalesce(h.data, '{}'::jsonb), coalesce(h.updated_at, now())
from public.hub_docs h
where h.id in (
  'hub-admin-announce',
  'hub-admin-maintenance',
  'hub-admin-moderation',
  'hub-admin-grants'
)
on conflict (doc_id) do nothing;

create or replace function public.upsert_admin_hub_doc(doc_id text, doc_data jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  allowed constant text[] := array[
    'fishing-admin-events',
    'fishing-admin-audit',
    'hub-admin-announce',
    'hub-admin-maintenance',
    'hub-admin-moderation',
    'hub-admin-grants',
    'hub-discord-site-updates'
  ];
  live constant text[] := array[
    'hub-admin-announce',
    'hub-admin-maintenance',
    'hub-admin-moderation',
    'hub-admin-grants'
  ];
  tok text;
begin
  if (select auth.uid()) is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if doc_id is null or doc_id <> all (allowed) then
    raise exception 'bad admin doc' using errcode = '22023';
  end if;
  tok := coalesce(doc_data ->> 'token', '');
  if not (
    public.has_app_role('owner')
    or public.has_app_role('admin')
    or tok in ('ice-fish-evt-9f3a', 'ice-hub-admin-9f3a')
  ) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  insert into public.hub_docs as h (id, data, updated_at)
  values (doc_id, coalesce(doc_data, '{}'::jsonb), now())
  on conflict (id) do update
    set data = excluded.data,
        updated_at = now();
  if doc_id = any (live) then
    insert into public.admin_broadcasts as b (doc_id, data, updated_at)
    values (doc_id, coalesce(doc_data, '{}'::jsonb), now())
    on conflict (doc_id) do update
      set data = excluded.data,
          updated_at = now();
  end if;
end;
$$;

revoke all on function public.upsert_admin_hub_doc(text, jsonb) from public, anon;
grant execute on function public.upsert_admin_hub_doc(text, jsonb) to authenticated;

commit;
