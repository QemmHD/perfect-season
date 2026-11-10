-- Read-only: every copy the 2026-11-01 QA throwaway identity holds in the LIVE (empty) namespace, both sports.
-- Tables/columns from supabase/migrations/20261030092417_live_card_circulation.sql and 20261028223504_perfect_season_card_registry.sql.
select c.sport,
       c.copy_uid,
       c.card_id,
       c.serial,
       c.request_id,
       c.created_at,
       c.retired_at,
       c.retired_reason,
       t.total        as edition_total_issued,
       t.active_total as edition_active_now
from public.ps_card_copies c
join public.ps_card_totals t
  on t.namespace = c.namespace and t.sport = c.sport and t.card_id = c.card_id
where c.namespace = ''
  and c.actor = '45133da812ab923a3de46da60bc1156a3ea54aa47bd447dc302ea06e91b09a92'
order by c.sport, c.created_at, c.copy_uid;
