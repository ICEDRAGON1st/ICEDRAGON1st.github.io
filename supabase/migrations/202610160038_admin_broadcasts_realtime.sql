begin;

-- Authenticated postgres_changes for hub admin broadcasts.
-- Replica identity full so UPDATE/DELETE payloads include doc_id and data.
-- Do not add hub_docs to supabase_realtime.
alter table public.admin_broadcasts replica identity full;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'admin_broadcasts'
  ) then
    execute 'alter publication supabase_realtime add table public.admin_broadcasts';
  end if;
end $$;

commit;
