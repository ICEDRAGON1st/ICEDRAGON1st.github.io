begin;

-- Authenticated postgres_changes for DMs, groups, and global chat.
-- Replica identity full so UPDATE/DELETE payloads include player_id and threads.
alter table public.chat_thread_contributions replica identity full;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'chat_thread_contributions'
  ) then
    execute 'alter publication supabase_realtime add table public.chat_thread_contributions';
  end if;
end $$;

commit;
