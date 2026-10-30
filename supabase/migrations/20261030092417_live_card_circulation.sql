-- Implemented by Codex. Additive circulation ledger; old serials, receipts and cumulative totals survive.
alter table public.ps_card_totals add column active_total bigint not null default 0, add column revision bigint not null default 1;
update public.ps_card_totals set active_total=total;
alter table public.ps_card_totals add constraint ps_active_total_bounds check(active_total>=0 and active_total<=total);
create table public.ps_card_copies (
 namespace text not null, sport text not null check(sport in ('nba','nfl')),
 actor text not null check(actor ~ '^[a-f0-9]{64}$'), copy_uid text not null check(length(copy_uid) between 1 and 200),
 card_id text not null, serial bigint not null check(serial>0), request_id uuid not null,
 created_at timestamptz not null default now(), retired_at timestamptz,
 retired_reason text check(retired_reason in ('sold','sbc')),
 primary key(namespace,sport,actor,copy_uid), unique(namespace,sport,card_id,serial),
 foreign key(namespace,sport,card_id) references public.ps_card_totals(namespace,sport,card_id)
);
create index ps_copies_actor_time on public.ps_card_copies(actor,created_at);
alter table public.ps_card_copies enable row level security;
revoke all on public.ps_card_copies from public,anon,authenticated;
grant select,insert,update on public.ps_card_copies to service_role;
create policy ps_copies_client_deny on public.ps_card_copies for all to anon,authenticated using(false) with check(false);
-- Event rewards contain a single card; paid Spotlight packs put the chase in slot 7 / 15.
insert into public.ps_card_copies(namespace,sport,actor,copy_uid,card_id,serial,request_id,created_at)
select namespace,sport,actor,'registered:'||request_id::text||':'||case when kind like 'event-%' then '0' when sport='nba' then '7' else '15' end,
 receipt->>'cardId',(receipt->>'serial')::bigint,request_id,created_at
from public.ps_pack_receipts where receipt->>'tier' in ('goat','spotlight') and (receipt->>'serial')::bigint>0;
-- Only aggregate counts are public. Private copies, ownership and receipts remain inaccessible.
grant select on public.ps_card_totals to anon,authenticated;
create policy ps_totals_public_read on public.ps_card_totals for select to anon,authenticated using(true);
do $$ begin if not exists(select from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='ps_card_totals') then alter publication supabase_realtime add table public.ps_card_totals; end if; end $$;

create function public.ps_registry_copy(p_actor text,p_namespace text,p_sport text,p_uid text,p_card text,p_reason text default null)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare c public.ps_card_copies%rowtype; t public.ps_card_totals%rowtype; minted boolean:=false;
begin
 if p_actor !~ '^[a-f0-9]{64}$' or p_namespace !~ '^[a-z0-9]{0,16}$' or p_sport not in ('nba','nfl') or length(p_uid) not between 1 and 200 or p_card not like p_sport||':%' or (p_reason is not null and p_reason not in ('sold','sbc')) then raise exception 'Invalid copy request'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_actor,0));
 select * into c from public.ps_card_copies where namespace=p_namespace and sport=p_sport and actor=p_actor and copy_uid=p_uid for update;
 if found then
  if c.card_id<>p_card then raise exception 'Copy edition mismatch'; end if;
 else
  -- GOAT/Spotlight can only originate in the server-authorized pack function.
  if p_card like p_sport||':goat:%' or p_card like p_sport||':spotlight:%' then raise exception 'Numbered chase receipt required'; end if;
  if (select count(*) from public.ps_card_copies where actor=p_actor and created_at>now()-interval '1 day')>=2000 then raise exception 'Registry copy limit reached. Try again later.'; end if;
  insert into public.ps_card_totals(namespace,sport,card_id,total,active_total,revision) values(p_namespace,p_sport,p_card,1,1,1)
  on conflict(namespace,sport,card_id) do update set total=public.ps_card_totals.total+1,active_total=public.ps_card_totals.active_total+1,revision=public.ps_card_totals.revision+1 returning * into t;
  insert into public.ps_card_copies(namespace,sport,actor,copy_uid,card_id,serial,request_id)
  values(p_namespace,p_sport,p_actor,p_uid,p_card,t.total,gen_random_uuid()) returning * into c;
  minted:=true;
 end if;
 if p_reason is not null and c.retired_at is null then
  update public.ps_card_copies set retired_at=now(),retired_reason=p_reason where namespace=p_namespace and sport=p_sport and actor=p_actor and copy_uid=p_uid returning * into c;
  update public.ps_card_totals set active_total=active_total-1,revision=revision+1 where namespace=p_namespace and sport=p_sport and card_id=p_card returning * into t;
 else
  select * into t from public.ps_card_totals where namespace=p_namespace and sport=p_sport and card_id=p_card;
 end if;
 return jsonb_build_object('uid',p_uid,'cardId',p_card,'retired',c.retired_at is not null,'mint',jsonb_build_object('serial',c.serial,'totalAtPull',greatest(c.serial,t.total),'activeAtPull',t.active_total,'requestId',c.request_id,'namespace',p_namespace),'active',t.active_total,'revision',t.revision,'created',minted);
end $$;
revoke all on function public.ps_registry_copy(text,text,text,text,text,text) from public,anon,authenticated;
grant execute on function public.ps_registry_copy(text,text,text,text,text,text) to service_role;

create or replace function public.ps_registry_open(p_actor text,p_namespace text,p_sport text,p_request uuid,p_kind text,p_card text,p_tier text,p_seed text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare existing jsonb; label text; total_now bigint; active_now bigint; result jsonb; copy_uid text;
begin
 if p_actor !~ '^[a-f0-9]{64}$' or p_namespace !~ '^[a-z0-9]{0,16}$' or p_sport not in ('nba','nfl') then raise exception 'Invalid request'; end if;
 if p_kind<>'spotlight' and p_kind not in ('event-spotlight:dynasty','event-spotlight:deep-range','event-spotlight:immortals') then raise exception 'Unknown pack'; end if;
 label:=case when p_kind='spotlight' then p_request::text else p_kind end;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_actor,0));
 select receipt into existing from public.ps_pack_receipts where namespace=p_namespace and sport=p_sport and actor=p_actor and entitlement=label;
 if found then return existing; end if;
 if (select count(*) from public.ps_pack_receipts where actor=p_actor and created_at>now()-interval '1 hour')>=30 or (select count(*) from public.ps_pack_receipts where actor=p_actor and created_at>now()-interval '1 day')>=100 then raise exception 'Registry pack limit reached. Try again later.'; end if;
 if p_tier not in ('goat','spotlight','legend','promo','gold') or (p_kind<>'spotlight' and p_tier<>'spotlight') then raise exception 'Invalid tier'; end if;
 if p_tier<>'gold' and (p_card is null or p_card not like p_sport||':'||p_tier||':%') then raise exception 'Invalid edition'; end if;
 if p_tier in ('goat','spotlight') then
  insert into public.ps_card_totals(namespace,sport,card_id,total,active_total,revision) values(p_namespace,p_sport,p_card,1,1,1)
  on conflict(namespace,sport,card_id) do update set total=public.ps_card_totals.total+1,active_total=public.ps_card_totals.active_total+1,revision=public.ps_card_totals.revision+1 returning total,active_total into total_now,active_now;
  copy_uid:='registered:'||p_request::text||':'||case when p_kind like 'event-%' then '0' when p_sport='nba' then '7' else '15' end;
  insert into public.ps_card_copies(namespace,sport,actor,copy_uid,card_id,serial,request_id) values(p_namespace,p_sport,p_actor,copy_uid,p_card,total_now,p_request);
 end if;
 result:=jsonb_build_object('id',p_request,'kind',p_kind,'sport',p_sport,'namespace',p_namespace,'tier',p_tier,'cardId',p_card,'seed',p_seed,'serial',total_now,'totalAtPull',total_now,'activeAtPull',active_now);
 insert into public.ps_pack_receipts(namespace,sport,actor,request_id,entitlement,kind,receipt) values(p_namespace,p_sport,p_actor,p_request,label,p_kind,result);
 return result;
end $$;
