begin;

-- One-row password lookup. Keep the existing table read so older clients
-- still sign in until a later migration limits those reads to the owner.

create or replace function public.lookup_player_password_hash(p_hash text)
returns table (
  player_id text,
  password_hash text,
  code text,
  display_name text,
  hashed_at timestamptz,
  cleared boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select h.player_id, h.password_hash, h.code, h.display_name, h.hashed_at, h.cleared
  from public.player_password_hashes h
  where h.cleared = false
    and h.password_hash = p_hash
    and (
      h.password_hash ~ '^[0-9a-f]{64}$'
      or h.password_hash ~ '^f:[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{16}$'
    )
  limit 1;
$$;

revoke all on function public.lookup_player_password_hash(text) from public, anon;
grant execute on function public.lookup_player_password_hash(text) to authenticated;

commit;
