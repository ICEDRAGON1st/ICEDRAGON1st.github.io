begin;

-- Return this player's friend row, plus other rows stripped to the edge
-- that touches them. Keep the table read so older clients still load
-- friends until a later migration limits those reads to the owner.

create or replace function public.list_visible_friend_edges()
returns table (
  player_id text,
  display_name text,
  friends jsonb,
  outgoing jsonb,
  incoming jsonb,
  invites jsonb,
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
    from public.friend_edge_contributions f
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
  select
    f.player_id,
    f.display_name,
    case
      when f.player_id = viewer then f.friends
      when jsonb_exists(f.friends, viewer) then jsonb_build_object(viewer, f.friends->viewer)
      else '{}'::jsonb
    end,
    case
      when f.player_id = viewer then f.outgoing
      when jsonb_exists(f.outgoing, viewer) then jsonb_build_object(viewer, f.outgoing->viewer)
      else '{}'::jsonb
    end,
    case
      when f.player_id = viewer then f.incoming
      when jsonb_exists(f.incoming, viewer) then jsonb_build_object(viewer, f.incoming->viewer)
      else '{}'::jsonb
    end,
    case
      when f.player_id = viewer then f.invites
      else coalesce(touching.invites, '{}'::jsonb)
    end,
    f.updated_at
  from public.friend_edge_contributions f
  left join lateral (
    select jsonb_object_agg(e.key, e.value) as invites
    from jsonb_each(f.invites) e
    where e.value->>'fromId' = viewer
       or e.value->>'toId' = viewer
  ) touching on true
  where f.player_id = viewer
     or jsonb_exists(f.friends, viewer)
     or jsonb_exists(f.outgoing, viewer)
     or jsonb_exists(f.incoming, viewer)
     or touching.invites is not null;
end;
$$;

revoke all on function public.list_visible_friend_edges() from public, anon;
grant execute on function public.list_visible_friend_edges() to authenticated;

commit;
