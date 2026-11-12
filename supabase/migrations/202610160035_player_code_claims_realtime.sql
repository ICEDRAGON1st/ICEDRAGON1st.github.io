begin;

-- Authenticated postgres_changes for unique player codes.
-- Replica identity full so UPDATE/DELETE payloads include player_id and code.
alter table public.player_code_claims replica identity full;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'player_code_claims'
  ) then
    execute 'alter publication supabase_realtime add table public.player_code_claims';
  end if;
end $$;

commit;
