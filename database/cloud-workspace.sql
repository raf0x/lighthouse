-- Lighthouse personal workspaces. Apply only to the dedicated Lighthouse project.
create table public.lighthouse_workspaces (
  user_id uuid primary key references auth.users(id) on delete cascade,
  version bigint not null default 1 check (version > 0),
  payload jsonb not null check (coalesce(
    jsonb_typeof(payload) = 'object' and payload->>'schemaVersion' = '1'
    and jsonb_typeof(payload->'cases') = 'object'
    and jsonb_typeof(payload->'followUps') = 'object'
    and octet_length(payload::text) <= 17000000
  , false)),
  last_mutation_id uuid not null,
  updated_at timestamptz not null default now()
);
alter table public.lighthouse_workspaces enable row level security;
revoke all on public.lighthouse_workspaces from anon, authenticated;
grant select, insert, update on public.lighthouse_workspaces to authenticated;
create policy own_workspace_read on public.lighthouse_workspaces for select to authenticated
  using ((select auth.uid()) = user_id);
create policy own_workspace_insert on public.lighthouse_workspaces for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy own_workspace_update on public.lighthouse_workspaces for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create function public.save_lighthouse_workspace(p_expected_version bigint, p_payload jsonb, p_mutation_id uuid)
returns table(version bigint, updated_at timestamptz, last_mutation_id uuid)
language plpgsql security invoker set search_path = '' as $$
declare v_row public.lighthouse_workspaces; v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'Sign in required' using errcode = '42501'; end if;
  if p_expected_version < 0 or p_expected_version is null or p_mutation_id is null then
    raise exception 'Invalid workspace version' using errcode = '22023';
  end if;
  if p_expected_version = 0 then
    insert into public.lighthouse_workspaces(user_id, payload, last_mutation_id)
      values(v_uid, p_payload, p_mutation_id) on conflict(user_id) do nothing;
  end if;
  select * into v_row from public.lighthouse_workspaces w where w.user_id = v_uid for update;
  -- A retry after a lost response is safe, even if the expected version is now old.
  if v_row.last_mutation_id = p_mutation_id then
    if v_row.payload <> p_payload then raise exception 'Mutation already used' using errcode = '22023'; end if;
    return query select v_row.version, v_row.updated_at, v_row.last_mutation_id; return;
  end if;
  if v_row.user_id is null or v_row.version <> p_expected_version then
    raise exception 'Workspace changed on another device' using errcode = '40001';
  end if;
  update public.lighthouse_workspaces w set payload = p_payload, version = w.version + 1,
    updated_at = now(), last_mutation_id = p_mutation_id where w.user_id = v_uid returning w.* into v_row;
  return query select v_row.version, v_row.updated_at, v_row.last_mutation_id;
end;
$$;
revoke all on function public.save_lighthouse_workspace(bigint,jsonb,uuid) from public, anon;
grant execute on function public.save_lighthouse_workspace(bigint,jsonb,uuid) to authenticated;
