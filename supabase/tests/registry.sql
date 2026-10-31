-- Implemented by Codex. Run in SQL editor/execute_sql. All writes roll back, including counters.
begin;
do $$
declare a jsonb; b jsonb; c jsonb;
begin
  a:=public.ps_registry_open(repeat('a',64),'sqltest','nba','11111111-1111-4111-8111-111111111111','spotlight','nba:goat:1996:jordami01:CHI','goat','first-seed');
  b:=public.ps_registry_open(repeat('a',64),'sqltest','nba','11111111-1111-4111-8111-111111111111','spotlight','nba:goat:1996:jordami01:CHI','goat','changed-seed');
  c:=public.ps_registry_open(repeat('b',64),'sqltest','nba','22222222-2222-4222-8222-222222222222','spotlight','nba:goat:1996:jordami01:CHI','goat','next-seed');
  if a<>b or (a->>'serial')::int<>1 or (c->>'serial')::int<>2 then raise exception 'Serial/retry contract failed'; end if;
  if (select total from public.ps_card_totals where namespace='sqltest' and sport='nba' and card_id='nba:goat:1996:jordami01:CHI')<>2 then raise exception 'Counter incremented incorrectly'; end if;
  if has_function_privilege('anon','public.ps_registry_open(text,text,text,uuid,text,text,text,text)','EXECUTE') then raise exception 'Public mint permission'; end if;
  if has_table_privilege('anon','public.ps_pack_receipts','SELECT') then raise exception 'Private receipt exposure'; end if;
  if exists(select from pg_class where oid in ('public.ps_pack_receipts'::regclass,'public.ps_card_totals'::regclass) and not relrowsecurity) then raise exception 'RLS missing'; end if;
end $$;
rollback;
