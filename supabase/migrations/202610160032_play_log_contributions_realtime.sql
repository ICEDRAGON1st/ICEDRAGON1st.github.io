begin;

-- Authenticated postgres_changes for recent play rows.
-- Replica identity full so UPDATE/DELETE payloads include player_id and plays.
alter table public.play_log_contributions replica identity full;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'play_log_contributions'
  ) then
    execute 'alter publication supabase_realtime add table public.play_log_contributions';
  end if;
end $$;

commit;
