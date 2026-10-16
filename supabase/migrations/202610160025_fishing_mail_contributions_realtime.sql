begin;

-- Authenticated postgres_changes for Fishing player mail (gifts + trades).
-- Replica identity full so UPDATE/DELETE payloads include player_id, gifts, and trades.
alter table public.fishing_mail_contributions replica identity full;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'fishing_mail_contributions'
  ) then
    execute 'alter publication supabase_realtime add table public.fishing_mail_contributions';
  end if;
end $$;

commit;
