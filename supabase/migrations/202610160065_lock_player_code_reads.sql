begin;

-- Login still uses lookup_player_by_code. The code column should not be
-- readable as a list. The other columns stay readable.

revoke select on table public.player_code_claims from anon, authenticated;

grant select (user_id, player_id, display_name, claimed_at)
  on table public.player_code_claims to authenticated;

commit;
