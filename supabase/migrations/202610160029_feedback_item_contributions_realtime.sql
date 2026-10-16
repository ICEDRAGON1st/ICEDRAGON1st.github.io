begin;

-- Authenticated postgres_changes for Feedback tickets.
-- Replica identity full so UPDATE/DELETE payloads include player_id and items.
alter table public.feedback_item_contributions replica identity full;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'feedback_item_contributions'
  ) then
    execute 'alter publication supabase_realtime add table public.feedback_item_contributions';
  end if;
end $$;

commit;
