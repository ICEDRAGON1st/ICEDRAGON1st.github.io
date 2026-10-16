begin;

-- Authenticated postgres_changes for the all-time player roster.
-- Replica identity full so UPDATE/DELETE payloads include player_id and first/last seen.
alter table public.alltime_roster replica identity full;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'alltime_roster'
  ) then
    execute 'alter publication supabase_realtime add table public.alltime_roster';
  end if;
end $$;

commit;
