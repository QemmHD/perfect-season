-- Implemented by Codex. Explicitly document the browser roles' deny-by-default access model.
-- The signed Edge Function is the only public API; service_role stays server-side.
create policy ps_totals_client_deny on public.ps_card_totals for all to anon,authenticated using(false) with check(false);
create policy ps_receipts_client_deny on public.ps_pack_receipts for all to anon,authenticated using(false) with check(false);
