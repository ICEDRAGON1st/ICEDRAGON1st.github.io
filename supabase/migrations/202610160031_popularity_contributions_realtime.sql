begin;

-- Authenticated postgres_changes for per-account play counts.
-- Replica identity full so UPDATE/DELETE payloads include player_id and games.
alter table public.popularity_contributions replica identity full;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'popularity_contributions'
  ) then
    execute 'alter publication supabase_realtime add table public.popularity_contributions';
  end if;
end $$;

commit;
