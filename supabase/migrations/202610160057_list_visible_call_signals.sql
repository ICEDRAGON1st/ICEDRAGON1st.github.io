begin;

-- Return call rooms whose peer list includes this signed-in player.
-- Keep the table read so older clients still load calls until a later
-- migration limits those reads to the owner.

create or replace function public.list_visible_call_signals()
returns table (
  player_id text,
  rooms jsonb
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
    from public.call_signal_contributions c
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
  select c.player_id, visible.rooms
  from public.call_signal_contributions c
  cross join lateral (
    select coalesce(jsonb_object_agg(e.key, e.value), '{}'::jsonb) as rooms
    from jsonb_each(c.rooms) e
    where jsonb_typeof(e.value->'peers') = 'object'
      and jsonb_exists(e.value->'peers', viewer)
  ) visible
  where visible.rooms <> '{}'::jsonb;
end;
$$;

revoke all on function public.list_visible_call_signals() from public, anon;
grant execute on function public.list_visible_call_signals() to authenticated;

commit;
