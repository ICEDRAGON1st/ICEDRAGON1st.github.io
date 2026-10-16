begin;

-- Authenticated postgres_changes for voice-call rooms.
-- Replica identity full so UPDATE/DELETE payloads include player_id and rooms.
alter table public.call_signal_contributions replica identity full;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'call_signal_contributions'
  ) then
    execute 'alter publication supabase_realtime add table public.call_signal_contributions';
  end if;
end $$;

commit;
