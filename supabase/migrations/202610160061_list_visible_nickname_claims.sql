begin;

-- Public nicknames stay readable. Login codes inside a claim stay on the
-- owner's row, and on every row when the signed-in player owns ice_dragon.
-- Older clients can still read the table until a later migration limits that.

create or replace function public.list_visible_nickname_claims()
returns table (
  player_id text,
  name_key text,
  claim jsonb
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  ice boolean;
begin
  if auth.uid() is null then
    return;
  end if;

  ice := exists (
    select 1
    from public.nickname_claims owned
    where owned.user_id = auth.uid()
      and owned.name_key = 'ice_dragon'
  );

  return query
  select
    f.player_id,
    f.name_key,
    case
      when f.user_id = auth.uid() or ice then f.claim
      else coalesce(f.claim, '{}'::jsonb) - 'playerCode'
    end
  from public.nickname_claims f;
end;
$$;

revoke all on function public.list_visible_nickname_claims() from public, anon;
grant execute on function public.list_visible_nickname_claims() to authenticated;

commit;
