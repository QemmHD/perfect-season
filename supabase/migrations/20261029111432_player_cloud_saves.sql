-- Implemented by Codex. Additive, private server saves; original registry tables are untouched.
create table public.ps_cloud_saves (
 namespace text not null check(namespace ~ '^[a-z0-9]{0,16}$'),
 actor text not null check(actor ~ '^[a-f0-9]{64}$'),
 revision bigint not null check(revision > 0),
 request_id uuid not null,
 digest text not null check(digest ~ '^[a-f0-9]{64}$'),
 payload jsonb not null check(jsonb_typeof(payload)='object' and octet_length(payload::text) <= 7100000),
 updated_at timestamptz not null default now(),
 budget_window timestamptz not null default now(),
 budget_count integer not null default 1 check(budget_count between 1 and 60),
 primary key(namespace,actor)
);
create table public.ps_cloud_save_history (
 namespace text not null check(namespace ~ '^[a-z0-9]{0,16}$'),
 actor text not null check(actor ~ '^[a-f0-9]{64}$'),
 request_id uuid not null,
 digest text not null check(digest ~ '^[a-f0-9]{64}$'),
 payload jsonb not null check(jsonb_typeof(payload)='object' and octet_length(payload::text) <= 7100000),
 reason text not null check(reason in ('autosave','conflict')),
 created_at timestamptz not null default now(),
 primary key(namespace,actor,request_id)
);
create index ps_cloud_history_owner_time on public.ps_cloud_save_history(namespace,actor,created_at desc);
alter table public.ps_cloud_saves enable row level security;
alter table public.ps_cloud_save_history enable row level security;
create policy cloud_saves_client_deny on public.ps_cloud_saves for all to anon,authenticated using(false) with check(false);
create policy cloud_history_client_deny on public.ps_cloud_save_history for all to anon,authenticated using(false) with check(false);
revoke all on public.ps_cloud_saves,public.ps_cloud_save_history from public,anon,authenticated;
grant select,insert,update on public.ps_cloud_saves to service_role;
grant select,insert,delete on public.ps_cloud_save_history to service_role;

create function public.ps_cloud_write(
 p_actor text,p_namespace text,p_request uuid,p_revision bigint,p_digest text,p_payload jsonb,p_archive boolean default false
) returns jsonb language plpgsql security invoker set search_path='' as $$
declare previous public.ps_cloud_saves; current_row public.ps_cloud_saves; count_recent integer; budget_start timestamptz;
begin
 if p_actor !~ '^[a-f0-9]{64}$' or p_namespace !~ '^[a-z0-9]{0,16}$' or p_digest !~ '^[a-f0-9]{64}$' or p_revision < 0
 or p_payload->>'v' <> '1' or not (p_payload ?& array['salt','iv','cipher']) or octet_length(p_payload::text) > 7100000 then raise exception 'Invalid save'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_namespace||':'||p_actor,0));
 select * into previous from public.ps_cloud_saves where namespace=p_namespace and actor=p_actor;
 if not p_archive and previous.request_id=p_request then
  return jsonb_build_object('revision',previous.revision,'digest',previous.digest,'updatedAt',previous.updated_at);
 end if;
 if p_archive and exists(select 1 from public.ps_cloud_save_history where namespace=p_namespace and actor=p_actor and request_id=p_request) then return jsonb_build_object('archived',true); end if;
 if not p_archive and coalesce(previous.revision,0) <> p_revision then
  return jsonb_build_object('conflict',true,'revision',previous.revision,'updatedAt',previous.updated_at);
 end if;
 -- Count independently of history retention, allowing at most 60 new writes per minute.
 budget_start := case when previous.budget_window > now()-interval '1 minute' then previous.budget_window else now() end;
 count_recent := case when previous.budget_window > now()-interval '1 minute' then previous.budget_count else 0 end;
 if count_recent>=60 then raise exception 'Save rate limit reached. Your phone will retry.'; end if;
 if p_archive then
  if previous.actor is null then raise exception 'No server save to preserve'; end if;
  update public.ps_cloud_saves set budget_window=budget_start,budget_count=count_recent+1 where namespace=p_namespace and actor=p_actor;
  insert into public.ps_cloud_save_history(namespace,actor,request_id,digest,payload,reason) values(p_namespace,p_actor,p_request,p_digest,p_payload,'conflict') on conflict do nothing;
  -- Conflict copies are deliberately retained; autosave history alone is bounded below.
  return jsonb_build_object('archived',true);
 end if;
 if previous.actor is not null then
  insert into public.ps_cloud_save_history(namespace,actor,request_id,digest,payload,reason)
  values(p_namespace,p_actor,previous.request_id,previous.digest,previous.payload,'autosave') on conflict do nothing;
 end if;
 insert into public.ps_cloud_saves(namespace,actor,revision,request_id,digest,payload,budget_window,budget_count)
 values(p_namespace,p_actor,coalesce(previous.revision,0)+1,p_request,p_digest,p_payload,budget_start,count_recent+1)
 on conflict(namespace,actor) do update set revision=excluded.revision,request_id=excluded.request_id,digest=excluded.digest,payload=excluded.payload,updated_at=now(),budget_window=excluded.budget_window,budget_count=excluded.budget_count
 returning * into current_row;
 delete from public.ps_cloud_save_history h where h.namespace=p_namespace and h.actor=p_actor and h.reason='autosave' and h.request_id not in
 (select keep.request_id from public.ps_cloud_save_history keep where keep.namespace=p_namespace and keep.actor=p_actor and keep.reason='autosave' order by keep.created_at desc,keep.request_id desc limit 8);
 return jsonb_build_object('revision',current_row.revision,'digest',current_row.digest,'updatedAt',current_row.updated_at);
end $$;
revoke all on function public.ps_cloud_write(text,text,uuid,bigint,text,jsonb,boolean) from public,anon,authenticated;
grant execute on function public.ps_cloud_write(text,text,uuid,bigint,text,jsonb,boolean) to service_role;
