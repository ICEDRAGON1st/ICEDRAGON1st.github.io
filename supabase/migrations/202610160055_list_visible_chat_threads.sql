begin;

-- Return global chat and threads this signed-in player is in.
-- Keep the table read so older clients still load chat until a later
-- migration limits those reads to the owner.

create or replace function public.list_visible_chat_threads()
returns table (
  player_id text,
  threads jsonb,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  viewer text;
begin
  if auth.uid() is null then
    return;
  end if;

  select owned.player_id
    into viewer
  from (
    select p.player_id
    from public.player_profiles p
    where p.user_id = auth.uid()
    union all
    select s.payload->>'playerId'
    from public.player_saves s
    where s.user_id = auth.uid()
      and s.save_key = 'identity-bind'
    union all
    select c.player_id
    from public.chat_thread_contributions c
    where c.user_id = auth.uid()
    union all
    select g.player_id
    from public.presence_pings g
    where g.user_id = auth.uid()
  ) owned
  where owned.player_id ~ '^p-[a-z0-9][a-z0-9-]{6,80}$'
  limit 1;

  if viewer is null then
    return;
  end if;

  return query
  select c.player_id, visible.threads, c.updated_at
  from public.chat_thread_contributions c
  cross join lateral (
    select coalesce(jsonb_object_agg(e.key, e.value), '{}'::jsonb) as threads
    from jsonb_each(c.threads) e
    where e.key = 'global'
      or (
        e.key like 'group:%'
        and jsonb_typeof(e.value->'members') = 'object'
        and jsonb_exists(e.value->'members', viewer)
      )
      or (
        e.key <> 'global'
        and e.key not like 'group:%'
        and exists (
          select 1
          from unnest(string_to_array(e.key, ':')) as part
          where part = viewer
        )
      )
  ) visible
  where visible.threads <> '{}'::jsonb;
end;
$$;

revoke all on function public.list_visible_chat_threads() from public, anon;
grant execute on function public.list_visible_chat_threads() to authenticated;

commit;
