-- Implemented by Codex. Exactly one aggregate SELECT policy; explicit write denial stays separate.
drop policy ps_totals_client_deny on public.ps_card_totals;
create policy ps_totals_insert_deny on public.ps_card_totals for insert to anon,authenticated with check(false);
create policy ps_totals_update_deny on public.ps_card_totals for update to anon,authenticated using(false) with check(false);
create policy ps_totals_delete_deny on public.ps_card_totals for delete to anon,authenticated using(false);
