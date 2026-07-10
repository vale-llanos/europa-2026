-- Phase 1 (Single Source of Truth) — backfill.
-- Run AFTER reviewing phase1_audit.sql's output. Idempotent: safe to re-run,
-- it only inserts a compra for a reserva that doesn't already have one, and
-- only inserts pagos for a compra it just created.
--
-- CURRENCY: compras.valor_total / pagos.valor_cuota are COP (the app's real
-- source of truth — matches the existing Pagos tab). reservas.precio (being
-- retired) was a EUR budget estimate. Since these orphan reservas never had a
-- real COP payment recorded, we convert precio -> COP using the EUR/COP rate
-- as of 2026-07-10 (1 EUR = 3774.09233271 COP, per
-- https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/eur.min.json).
-- Edit eur_cop_rate below if you'd rather use a different rate.

begin;

-- Rate used to convert legacy EUR precio -> COP for this one-time backfill.
create temporary table _fx (eur_cop_rate numeric) on commit drop;
insert into _fx values (3774.09233271);

-- 1) Proper FK replacement for reservas."whoPaid" (free text) — a purchase is
--    normally fronted by one person, so this lives on compras.
--    personas.id is uuid (reservas.id/compras.reserva_id are int8 — different
--    id spaces, this column follows personas, not reservas).
alter table public.compras
  add column if not exists paid_by uuid references public.personas(id);

-- 2) Create a compra for every reserva that has a legacy price but no compra yet.
with orphans as (
  select r.*, r.precio * (select eur_cop_rate from _fx) as precio_cop
  from public.reservas r
  where coalesce(r.precio, 0) > 0
    and not exists (select 1 from public.compras c where c.reserva_id = r.id)
),
matched_persona as (
  select o.id as reserva_id, p.id as persona_id
  from orphans o
  left join public.personas p on lower(p.nombre) = lower(o."whoPaid")
),
inserted_compras as (
  insert into public.compras (reserva_id, descripcion, valor_total, cuotas_totales, cuotas_pagadas, faltante_total, fecha_pago, paid_by)
  select
    o.id,
    o.nombre,
    o.precio_cop,
    greatest(coalesce(o.installments, 1), 1),
    case when o."payStatus" = 'paid' then greatest(coalesce(o.installments, 1), 1) else 0 end,
    case when o."payStatus" = 'paid' then 0 else o.precio_cop end,
    o."payDue",
    mp.persona_id
  from orphans o
  join matched_persona mp on mp.reserva_id = o.id
  returning id, reserva_id, valor_total, cuotas_totales
)
-- 3) Generate the pagos rows for each newly created compra: an even split of
--    valor_total across cuotas_totales installments (remainder on the last one).
insert into public.pagos (compra_id, numero_cuota, valor_cuota, pagado, fecha_pago, fecha_pagado)
select
  ic.id,
  n,
  case
    when n = ic.cuotas_totales
      then ic.valor_total - ((floor((ic.valor_total / ic.cuotas_totales) * 100) / 100) * (ic.cuotas_totales - 1))
    else floor((ic.valor_total / ic.cuotas_totales) * 100) / 100
  end,
  o."payStatus" = 'paid',
  o."payDue",
  case when o."payStatus" = 'paid' then now() else null end
from inserted_compras ic
join public.reservas o on o.id = ic.reserva_id
cross join lateral generate_series(1, ic.cuotas_totales) as n;

commit;

-- After running, re-run phase1_audit.sql query #1 — it should return 0 rows.
