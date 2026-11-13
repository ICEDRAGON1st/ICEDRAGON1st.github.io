begin;

-- Return broadcast fish gifts plus direct gifts that include this player.
-- Keep the table read so older clients still load gifts until a later
-- migration limits those reads to the owner.

create or replace function public.list_visible_fishing_gifts()
returns table (
  player_id text,
  gifts jsonb,
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
    select f.player_id
    from public.fishing_gift_contributions f
    where f.user_id = auth.uid()
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
  select f.player_id, visible.gifts, f.updated_at
  from public.fishing_gift_contributions f
  cross join lateral (
    select coalesce(jsonb_object_agg(e.key, e.value), '{}'::jsonb) as gifts
    from jsonb_each(f.gifts) e
    where (e.value->'broadcast') = 'true'::jsonb
       or lower(coalesce(e.value->>'toName', '')) in (
         '*', 'everyone', 'everybody', 'all', 'all players', 'global', 'players'
       )
       or e.value->>'fromId' = viewer
       or e.value->>'toPlayerId' = viewer
  ) visible
  where visible.gifts <> '{}'::jsonb;
end;
$$;

revoke all on function public.list_visible_fishing_gifts() from public, anon;
grant execute on function public.list_visible_fishing_gifts() to authenticated;

commit;
