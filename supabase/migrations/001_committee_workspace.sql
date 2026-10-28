begin;

-- One shared workspace. Only explicitly approved Supabase Auth users can access it.
create table if not exists public.committee_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create or replace function public.committee_valid_payload(payload jsonb)
returns boolean language sql immutable set search_path = '' as $$
  select coalesce(
    jsonb_typeof(payload) = 'object'
    and payload -> 'version' = '1'::jsonb
    and jsonb_typeof(payload -> 'members') = 'array'
    and jsonb_typeof(payload -> 'meetings') = 'array'
    and jsonb_typeof(payload -> 'agendas') = 'array'
    and jsonb_typeof(payload -> 'invites') = 'array'
    and jsonb_typeof(payload -> 'allowances') = 'array'
    and octet_length(payload::text) <= 5242880, false
  );
$$;

create table if not exists public.committee_workspace (
  id integer primary key default 1 check (id = 1),
  data jsonb not null check (public.committee_valid_payload(data)),
  revision integer not null default 0 check (revision >= 0),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

-- Start empty. Never upload the local demo or existing browser data automatically.
insert into public.committee_workspace (id, data) values (
  1, '{"version":1,"members":[],"meetings":[],"agendas":[],"invites":[],"allowances":[]}'::jsonb
) on conflict (id) do nothing;

alter table public.committee_admins enable row level security;
alter table public.committee_workspace enable row level security;

revoke all on public.committee_admins from anon, authenticated;
revoke all on public.committee_workspace from anon, authenticated;
grant select on public.committee_admins, public.committee_workspace to authenticated;

drop policy if exists committee_admin_self on public.committee_admins;
create policy committee_admin_self on public.committee_admins for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists committee_workspace_admin_read on public.committee_workspace;
create policy committee_workspace_admin_read on public.committee_workspace for select to authenticated
  using (exists (select 1 from public.committee_admins a where a.user_id = (select auth.uid())));

-- Atomic compare-and-swap: a stale editor cannot overwrite a newer administrator's work.
-- Table writes are not granted to API roles. This function performs its own authorization.
create or replace function public.save_committee_workspace(expected_revision integer, next_data jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare saved public.committee_workspace;
begin
  if auth.uid() is null or not exists (select 1 from public.committee_admins where user_id = auth.uid()) then
    raise exception 'Administrator approval required' using errcode = '42501';
  end if;
  if not public.committee_valid_payload(next_data) then
    raise exception 'Invalid workspace data' using errcode = '22023';
  end if;
  update public.committee_workspace
    set data = next_data, revision = revision + 1, updated_at = now(), updated_by = auth.uid()
    where id = 1 and revision = expected_revision returning * into saved;
  if not found then
    raise exception 'Workspace changed. Reload before saving.' using errcode = '40001';
  end if;
  return to_jsonb(saved);
end;
$$;

revoke all on function public.save_committee_workspace(integer, jsonb) from public, anon;
grant execute on function public.save_committee_workspace(integer, jsonb) to authenticated;
revoke all on function public.committee_valid_payload(jsonb) from public, anon;
grant execute on function public.committee_valid_payload(jsonb) to authenticated;
commit;

-- After creating an Auth user, approve that user's UUID with a separate SQL query:
-- insert into public.committee_admins (user_id) values ('UUID_FROM_AUTH_USERS') on conflict do nothing;
