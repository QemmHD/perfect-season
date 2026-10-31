-- Implemented by Codex. All counter/copy/receipt writes roll back.
begin;
do $$
declare a jsonb;b jsonb;c jsonb; n bigint;
begin
 a:=public.ps_registry_copy(repeat('1',64),'sqlserial','nba','copy-a','nba:season:2024:sql:CHI');
 b:=public.ps_registry_copy(repeat('1',64),'sqlserial','nba','copy-a','nba:season:2024:sql:CHI');
 if a->'mint'<>b->'mint' or (a#>>'{mint,serial}')::int<>1 then raise exception 'Registration retry failed'; end if;
 c:=public.ps_registry_copy(repeat('2',64),'sqlserial','nba','copy-b','nba:season:2024:sql:CHI');
 if (c#>>'{mint,serial}')::int<>2 or (c->>'active')::int<>2 then raise exception 'Global serial failed'; end if;
 a:=public.ps_registry_copy(repeat('1',64),'sqlserial','nba','copy-a','nba:season:2024:sql:CHI','sold');
 b:=public.ps_registry_copy(repeat('1',64),'sqlserial','nba','copy-a','nba:season:2024:sql:CHI','sold');
 if (a->>'active')::int<>1 or (b->>'active')::int<>1 then raise exception 'Retirement retry double counted'; end if;
 c:=public.ps_registry_copy(repeat('3',64),'sqlserial','nba','copy-c','nba:season:2024:sql:CHI');
 if (c#>>'{mint,serial}')::int<>3 or (c->>'active')::int<>2 then raise exception 'Serial reused after retirement'; end if;
 c:=public.ps_registry_copy(repeat('2',64),'sqlserial','nba','copy-b','nba:season:2024:sql:CHI','sbc');
 c:=public.ps_registry_copy(repeat('3',64),'sqlserial','nba','copy-c','nba:season:2024:sql:CHI','sbc');
 if (c->>'active')::int<>0 then raise exception 'Zero circulation failed'; end if;
 c:=public.ps_registry_copy(repeat('1',64),'sqlserial','nba','copy-a','nba:season:2024:sql:CHI');
 if not (c->>'retired')::boolean or (c->>'active')::int<>0 then raise exception 'Retry resurrected retired copy'; end if;
 a:=public.ps_registry_open(repeat('4',64),'sqlserial','nba','44444444-4444-4444-8444-444444444444','spotlight','nba:goat:1996:jordami01:CHI','goat','fixture');
 begin
  perform public.ps_registry_copy(repeat('5',64),'sqlserial','nba','registered:44444444-4444-4444-8444-444444444444:7','nba:goat:1996:jordami01:CHI','sold');
  raise exception 'Wrong owner accepted';
 exception when others then if sqlerrm='Wrong owner accepted' then raise; end if; end;
 b:=public.ps_registry_copy(repeat('4',64),'sqlserial','nba','registered:44444444-4444-4444-8444-444444444444:7','nba:goat:1996:jordami01:CHI','sbc');
 if (b->>'active')::int<>0 then raise exception 'Original numbered pack not retired'; end if;
 if has_function_privilege('anon','public.ps_registry_copy(text,text,text,text,text,text)','EXECUTE') or has_table_privilege('anon','public.ps_card_copies','SELECT') or has_table_privilege('anon','public.ps_pack_receipts','SELECT') then raise exception 'Private registry access exposed'; end if;
 if not has_table_privilege('anon','public.ps_card_totals','SELECT') then raise exception 'Aggregate realtime read missing'; end if;
end $$;
rollback;
