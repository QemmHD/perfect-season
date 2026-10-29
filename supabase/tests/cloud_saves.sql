-- Codex: reversible assertions. No real account or save is touched.
begin;
do $$
declare a text:=repeat('a',64); b text:=repeat('b',64); p jsonb:='{"v":1,"salt":"AAAAAAAAAAAAAAAAAAAAAA==","iv":"AAAAAAAAAAAAAAAA","cipher":"AAAAAAAAAAAAAAAAAAAAAAAA"}';r jsonb;first_id uuid:=gen_random_uuid();next_id uuid:=gen_random_uuid();history_count integer;
begin
 r:=public.ps_cloud_write(a,'qacloud',first_id,0,repeat('1',64),p);
 assert (r->>'revision')::int=1,'First revision must be 1';
 r:=public.ps_cloud_write(a,'qacloud',first_id,0,repeat('1',64),p);
 assert (r->>'revision')::int=1,'Retry must not increment revision';
 r:=public.ps_cloud_write(a,'qacloud',next_id,1,repeat('2',64),p);
 assert (r->>'revision')::int=2,'Next revision missing';
 assert exists(select 1 from public.ps_cloud_save_history where namespace='qacloud' and actor=a and digest=repeat('1',64)),'Previous server save must be retained';
 r:=public.ps_cloud_write(a,'qacloud',gen_random_uuid(),1,repeat('3',64),p);
 assert (r->>'conflict')::boolean,'Stale writer must pause';
 assert (select digest from public.ps_cloud_saves where namespace='qacloud' and actor=a)=repeat('2',64),'Stale writer replaced progress';
 r:=public.ps_cloud_write(a,'qacloud',gen_random_uuid(),0,repeat('4',64),p,true);
 assert (r->>'archived')::boolean,'Device conflict copy missing';
 assert exists(select 1 from public.ps_cloud_save_history where namespace='qacloud' and actor=a and reason='conflict' and digest=repeat('4',64)),'Device conflict was not kept';
 assert not exists(select 1 from public.ps_cloud_saves where actor=b and namespace='qacloud'),'Different actor can see no save row';
 r:=public.ps_cloud_write(b,'qacloud',gen_random_uuid(),0,repeat('5',64),p);
 assert (r->>'revision')::int=1,'Another actor must have independent revisions';
 assert (select digest from public.ps_cloud_saves where actor=a and namespace='qacloud')=repeat('2',64),'Another player changed original save';
 assert not has_table_privilege('anon','public.ps_cloud_saves','SELECT'),'Anonymous read grant';
 assert not has_table_privilege('authenticated','public.ps_cloud_save_history','SELECT'),'Browser history read grant';
 assert not has_function_privilege('anon','public.ps_cloud_write(text,text,uuid,bigint,text,jsonb,boolean)','EXECUTE'),'Anonymous write grant';
 assert (select relrowsecurity from pg_class where oid='public.ps_cloud_saves'::regclass),'RLS missing';
 assert (select relrowsecurity from pg_class where oid='public.ps_cloud_save_history'::regclass),'History RLS missing';
 -- Rate limiting remains effective after the automatic history is pruned to eight rows.
 for i in 3..59 loop r:=public.ps_cloud_write(a,'qacloud',gen_random_uuid(),i-1,repeat('6',64),p); end loop;
 begin
  r:=public.ps_cloud_write(a,'qacloud',gen_random_uuid(),59,repeat('7',64),p);
  raise exception 'Expected rate limit';
 exception when others then if sqlerrm not like 'Save rate limit reached%' then raise;end if;end;
 select count(*) into history_count from public.ps_cloud_save_history where actor=a and namespace='qacloud' and reason='autosave';
 assert history_count=8,'Automatic history must be bounded to eight versions';
 assert exists(select 1 from public.ps_cloud_save_history where actor=a and namespace='qacloud' and reason='conflict'),'History cleanup deleted a conflict copy';
end $$;
rollback;
