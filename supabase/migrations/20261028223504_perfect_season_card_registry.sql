-- Implemented by Codex. Isolated registry; no original game/player tables are modified.
create table public.ps_card_totals (
  namespace text not null check (namespace ~ '^[a-z0-9]{0,16}$'),
  sport text not null check (sport in ('nba','nfl')),
  card_id text not null,
  total bigint not null check (total > 0),
  primary key (namespace,sport,card_id)
);
create table public.ps_pack_receipts (
  namespace text not null,
  sport text not null check (sport in ('nba','nfl')),
  actor text not null check (actor ~ '^[a-f0-9]{64}$'),
  request_id uuid not null,
  entitlement text not null,
  kind text not null,
  receipt jsonb not null,
  created_at timestamptz not null default now(),
  primary key(namespace,sport,actor,request_id),
  unique(namespace,sport,actor,entitlement)
);
create index ps_receipt_actor_time on public.ps_pack_receipts(actor,created_at desc);
alter table public.ps_card_totals enable row level security;
alter table public.ps_pack_receipts enable row level security;
revoke all on public.ps_card_totals,public.ps_pack_receipts from anon,authenticated;
grant select,insert,update on public.ps_card_totals to service_role;
grant select,insert on public.ps_pack_receipts to service_role;

create function public.ps_registry_open(
 p_actor text,p_namespace text,p_sport text,p_request uuid,p_kind text,
 p_card text,p_tier text,p_seed text
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare existing jsonb; label text; total_now bigint; result jsonb;
begin
 if p_actor !~ '^[a-f0-9]{64}$' or p_namespace !~ '^[a-z0-9]{0,16}$' or p_sport not in ('nba','nfl') then raise exception 'Invalid request'; end if;
 if p_kind <> 'spotlight' and p_kind not in ('event-spotlight:dynasty','event-spotlight:deep-range','event-spotlight:immortals') then raise exception 'Unknown pack'; end if;
 label := case when p_kind = 'spotlight' then p_request::text else p_kind end;
 -- Serializes retries and per-player rate checks; the counter UPSERT serializes global mints.
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_actor,0));
 select receipt into existing from public.ps_pack_receipts where namespace=p_namespace and sport=p_sport and actor=p_actor and entitlement=label;
 if found then return existing; end if;
 if (select count(*) from public.ps_pack_receipts where actor=p_actor and created_at > now()-interval '1 hour') >= 30
 or (select count(*) from public.ps_pack_receipts where actor=p_actor and created_at > now()-interval '1 day') >= 100 then raise exception 'Registry pack limit reached. Try again later.'; end if;
 if p_tier not in ('goat','spotlight','legend','promo','gold') or (p_kind <> 'spotlight' and p_tier <> 'spotlight') then raise exception 'Invalid tier'; end if;
 if p_tier <> 'gold' and (p_card is null or p_card not like p_sport||':'||p_tier||':%') then raise exception 'Invalid edition'; end if;
 if p_tier in ('goat','spotlight') then
   insert into public.ps_card_totals(namespace,sport,card_id,total) values(p_namespace,p_sport,p_card,1)
   on conflict(namespace,sport,card_id) do update set total=public.ps_card_totals.total+1 returning total into total_now;
 end if;
 result := jsonb_build_object('id',p_request,'kind',p_kind,'sport',p_sport,'namespace',p_namespace,'tier',p_tier,'cardId',p_card,'seed',p_seed,
  'serial',total_now,'totalAtPull',total_now);
 insert into public.ps_pack_receipts(namespace,sport,actor,request_id,entitlement,kind,receipt) values(p_namespace,p_sport,p_actor,p_request,label,p_kind,result);
 return result;
end $$;
revoke all on function public.ps_registry_open(text,text,text,uuid,text,text,text,text) from public,anon,authenticated;
grant execute on function public.ps_registry_open(text,text,text,uuid,text,text,text,text) to service_role;
