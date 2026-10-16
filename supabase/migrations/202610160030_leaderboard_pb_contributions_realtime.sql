begin;

-- Authenticated postgres_changes for leaderboard personal bests.
-- Replica identity full so UPDATE/DELETE payloads include player_id and games.
alter table public.leaderboard_pb_contributions replica identity full;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'leaderboard_pb_contributions'
  ) then
    execute 'alter publication supabase_realtime add table public.leaderboard_pb_contributions';
  end if;
end $$;

commit;
