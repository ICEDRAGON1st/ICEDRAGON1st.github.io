begin;

-- ICE Feedback deletes on the signed-in admin channel.
-- Do not put hub_docs on Realtime. Tickets stay on feedback_item_contributions.
alter table public.admin_broadcasts drop constraint if exists admin_broadcasts_doc_id_allowed;
alter table public.admin_broadcasts
  add constraint admin_broadcasts_doc_id_allowed check (
    doc_id in (
      'hub-admin-announce',
      'hub-admin-maintenance',
      'hub-admin-moderation',
      'hub-admin-grants',
      'fishing-admin-events',
      'fishing-admin-announce',
      'hub-leaderboard-resets',
      'hub-feedback-deletes'
    )
  );

insert into public.admin_broadcasts as b (doc_id, data, updated_at)
select
  'hub-feedback-deletes',
  jsonb_build_object(
    'token', 'ice-hub-admin-9f3a',
    'deletedIds', coalesce(h.data -> 'deletedIds', '[]'::jsonb)
  ),
  coalesce(h.updated_at, now())
from public.hub_docs h
where h.id = 'player-feedback'
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
    'fishing-admin-announce',
    'hub-admin-announce',
    'hub-admin-maintenance',
    'hub-admin-moderation',
    'hub-admin-grants',
    'hub-discord-site-updates',
    'hub-leaderboard-resets',
    'hub-feedback-deletes'
  ];
  live constant text[] := array[
    'hub-admin-announce',
    'hub-admin-maintenance',
    'hub-admin-moderation',
    'hub-admin-grants',
    'fishing-admin-events',
    'fishing-admin-announce',
    'hub-leaderboard-resets',
    'hub-feedback-deletes'
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
