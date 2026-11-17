begin;
select set_config('lighthouse.test_a', gen_random_uuid()::text, true);
select set_config('lighthouse.test_b', gen_random_uuid()::text, true);
insert into auth.users(id, aud, role, email) values
  (current_setting('lighthouse.test_a')::uuid,'authenticated','authenticated','lighthouse-qa-a@example.invalid'),
  (current_setting('lighthouse.test_b')::uuid,'authenticated','authenticated','lighthouse-qa-b@example.invalid');
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub',current_setting('lighthouse.test_a'),'role','authenticated')::text, true);
do $$
declare mutation uuid := gen_random_uuid(); next_mutation uuid := gen_random_uuid(); v bigint;
begin
  select version into v from public.save_lighthouse_workspace(0,'{"schemaVersion":1,"cases":{},"followUps":{}}',mutation);
  if v <> 1 then raise exception 'Initial version failed'; end if;
  select version into v from public.save_lighthouse_workspace(0,'{"schemaVersion":1,"cases":{},"followUps":{}}',mutation);
  if v <> 1 then raise exception 'Retry not idempotent'; end if;
  begin
    perform public.save_lighthouse_workspace(0,'{"schemaVersion":1,"cases":{},"followUps":{}}',next_mutation);
    raise exception 'Stale write was accepted';
  exception when serialization_failure then null; end;
  begin
    perform public.save_lighthouse_workspace(1,'{"schemaVersion":1}',next_mutation);
    raise exception 'Incomplete payload accepted';
  exception when check_violation then null; end;
  select version into v from public.save_lighthouse_workspace(1,'{"schemaVersion":1,"cases":{},"followUps":{}}',next_mutation);
  if v <> 2 then raise exception 'Update version failed'; end if;
  begin
    update public.lighthouse_workspaces set user_id=current_setting('lighthouse.test_b')::uuid;
    raise exception 'Owner reassignment was accepted';
  exception when insufficient_privilege then null; end;
end;
$$;
select set_config('request.jwt.claims', json_build_object('sub',current_setting('lighthouse.test_b'),'role','authenticated')::text, true);
do $$
declare changed integer;
begin
  if exists(select 1 from public.lighthouse_workspaces) then raise exception 'Cross-user read leak'; end if;
  update public.lighthouse_workspaces set payload='{"schemaVersion":1,"cases":{},"followUps":{}}';
  get diagnostics changed = row_count;
  if changed <> 0 then raise exception 'Cross-user update leak'; end if;
  begin
    insert into public.lighthouse_workspaces(user_id,payload,last_mutation_id) values(current_setting('lighthouse.test_a')::uuid,'{"schemaVersion":1,"cases":{},"followUps":{}}',gen_random_uuid());
    raise exception 'Cross-user insert leak';
  exception when insufficient_privilege then null; end;
end;
$$;
reset role;
set local role anon;
select set_config('request.jwt.claims','{}',true);
do $$
begin
  begin
    perform * from public.lighthouse_workspaces;
    raise exception 'Anonymous table access';
  exception when insufficient_privilege then null; end;
  begin
    perform public.save_lighthouse_workspace(0,'{"schemaVersion":1,"cases":{},"followUps":{}}',gen_random_uuid());
    raise exception 'Anonymous function access';
  exception when insufficient_privilege then null; end;
end;
$$;
reset role;
select 'PASS: ownership, anonymous denial, version conflict, idempotent retry, payload validation' as verification;
rollback;
