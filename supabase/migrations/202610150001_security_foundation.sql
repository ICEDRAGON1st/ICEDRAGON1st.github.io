begin;

-- Auth-owned player identity. Browser clients never choose another user's user_id.
create table if not exists public.player_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  player_id text not null unique,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint player_profiles_player_id_format
    check (player_id ~ '^p-[a-z0-9]{12,64}$'),
  constraint player_profiles_display_name_length
    check (display_name is null or char_length(display_name) between 1 and 32)
);

alter table public.player_profiles enable row level security;
alter table public.player_profiles force row level security;

revoke all on table public.player_profiles from anon, authenticated;
grant select on table public.player_profiles to authenticated;
grant update (display_name) on table public.player_profiles to authenticated;

drop policy if exists player_profiles_read_authenticated on public.player_profiles;
create policy player_profiles_read_authenticated
  on public.player_profiles
  for select
  to authenticated
  using ((select auth.uid()) is not null);

drop policy if exists player_profiles_update_own on public.player_profiles;
create policy player_profiles_update_own
  on public.player_profiles
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Server-managed roles. There is deliberately no browser insert/update/delete grant.
create table if not exists public.user_roles (
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null,
  granted_by uuid references auth.users (id) on delete set null,
  granted_at timestamptz not null default now(),
  primary key (user_id, role),
  constraint user_roles_known_role
    check (role in ('owner', 'admin', 'moderator', 'support'))
);

alter table public.user_roles enable row level security;
alter table public.user_roles force row level security;

revoke all on table public.user_roles from anon, authenticated;
grant select on table public.user_roles to authenticated;

drop policy if exists user_roles_read_own on public.user_roles;
create policy user_roles_read_own
  on public.user_roles
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create or replace function public.has_app_role(required_role text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = (select auth.uid())
      and role = required_role
  );
$$;

revoke all on function public.has_app_role(text) from public, anon;
grant execute on function public.has_app_role(text) to authenticated;

-- Account-scoped saves replace public account-bag JSON documents incrementally.
create table if not exists public.player_saves (
  user_id uuid not null references auth.users (id) on delete cascade,
  save_key text not null,
  payload jsonb not null default '{}'::jsonb,
  schema_version integer not null default 1,
  updated_at timestamptz not null default now(),
  primary key (user_id, save_key),
  constraint player_saves_key_format
    check (save_key ~ '^[a-z0-9][a-z0-9:_-]{0,95}$'),
  constraint player_saves_schema_version
    check (schema_version between 1 and 100000),
  constraint player_saves_payload_limit
    check (octet_length(payload::text) <= 1048576)
);

alter table public.player_saves enable row level security;
alter table public.player_saves force row level security;

revoke all on table public.player_saves from anon, authenticated;
grant select, insert, update, delete on table public.player_saves to authenticated;

drop policy if exists player_saves_read_own on public.player_saves;
create policy player_saves_read_own
  on public.player_saves
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists player_saves_insert_own on public.player_saves;
create policy player_saves_insert_own
  on public.player_saves
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists player_saves_update_own on public.player_saves;
create policy player_saves_update_own
  on public.player_saves
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists player_saves_delete_own on public.player_saves;
create policy player_saves_delete_own
  on public.player_saves
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- Security/economy operations are service-only and auditable.
create table if not exists public.admin_audit_log (
  id bigint generated always as identity primary key,
  actor_user_id uuid references auth.users (id) on delete set null,
  action text not null,
  target_type text,
  target_id text,
  request_id uuid not null default gen_random_uuid() unique,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint admin_audit_action_length
    check (char_length(action) between 1 and 96),
  constraint admin_audit_details_limit
    check (octet_length(details::text) <= 65536)
);

alter table public.admin_audit_log enable row level security;
alter table public.admin_audit_log force row level security;

revoke all on table public.admin_audit_log from anon, authenticated;
grant select on table public.admin_audit_log to authenticated;

drop policy if exists admin_audit_read_privileged on public.admin_audit_log;
create policy admin_audit_read_privileged
  on public.admin_audit_log
  for select
  to authenticated
  using (
    public.has_app_role('owner')
    or public.has_app_role('admin')
  );

create table if not exists public.request_rate_limits (
  bucket text not null,
  subject text not null,
  window_started_at timestamptz not null,
  request_count integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (bucket, subject),
  constraint request_rate_limits_count
    check (request_count >= 0)
);

alter table public.request_rate_limits enable row level security;
alter table public.request_rate_limits force row level security;
revoke all on table public.request_rate_limits from anon, authenticated;

create or replace function public.set_row_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function public.set_row_updated_at() from public, anon, authenticated;

drop trigger if exists player_profiles_set_updated_at on public.player_profiles;
create trigger player_profiles_set_updated_at
before update on public.player_profiles
for each row execute function public.set_row_updated_at();

drop trigger if exists player_saves_set_updated_at on public.player_saves;
create trigger player_saves_set_updated_at
before update on public.player_saves
for each row execute function public.set_row_updated_at();

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_name text;
begin
  requested_name := nullif(trim(new.raw_user_meta_data ->> 'display_name'), '');
  if requested_name is not null and char_length(requested_name) > 32 then
    requested_name := left(requested_name, 32);
  end if;

  insert into public.player_profiles (user_id, player_id, display_name)
  values (
    new.id,
    'p-' || replace(gen_random_uuid()::text, '-', ''),
    requested_name
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;

revoke all on function public.handle_new_auth_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();

-- Backfill profiles if Auth users existed before this migration.
insert into public.player_profiles (user_id, player_id, display_name)
select
  users.id,
  'p-' || replace(gen_random_uuid()::text, '-', ''),
  case
    when nullif(trim(users.raw_user_meta_data ->> 'display_name'), '') is null then null
    else left(trim(users.raw_user_meta_data ->> 'display_name'), 32)
  end
from auth.users as users
on conflict (user_id) do nothing;

commit;
