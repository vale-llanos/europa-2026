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
--    faltante_total is a generated column (Postgres computes it) — not inserted.
--    pagos rows are NOT inserted here either: a DB trigger (crear_pagos_compra)
--    auto-creates them (one per cuotas_totales, monthly-spaced from fecha_pago,
--    using this row's valor_cuota) right after this INSERT runs.
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
)
insert into public.compras (reserva_id, descripcion, valor_total, valor_cuota, cuotas_totales, cuotas_pagadas, fecha_pago, paid_by)
select
  o.id,
  o.nombre,
  o.precio_cop,
  floor((o.precio_cop / greatest(coalesce(o.installments, 1), 1)) * 100) / 100,
  greatest(coalesce(o.installments, 1), 1),
  case when o."payStatus" = 'paid' then greatest(coalesce(o.installments, 1), 1) else 0 end,
  coalesce(o."payDue", o.fecha, current_date),
  mp.persona_id
from orphans o
join matched_persona mp on mp.reserva_id = o.id;

-- 3) The trigger above always creates pagos as unpaid. This is a SEPARATE
--    statement (not a CTE tacked onto the INSERT above) on purpose: within a
--    single combined statement, Postgres does not guarantee that a later part
--    sees rows an earlier part's trigger just created in a different table —
--    which is exactly why the first version of this script silently marked
--    nothing paid. It also runs against ALL matching compras (not just ones
--    from step 2), so it retroactively fixes any compras a previous partial
--    run already created. Safe to re-run.
update public.pagos p
set pagado = true, fecha_pagado = coalesce(p.fecha_pagado, now())
from public.compras c
join public.reservas r on r.id = c.reserva_id
where p.compra_id = c.id
  and r."payStatus" = 'paid'
  and p.pagado is not true;

commit;

-- After running, re-run phase1_audit.sql query #1 — it should return 0 rows,
-- and this should now return 0 rows too (no unpaid pagos left under a
-- reserva that was marked payStatus = 'paid'):
--
-- select r.id, r.nombre
-- from public.reservas r
-- join public.compras c on c.reserva_id = r.id
-- join public.pagos p on p.compra_id = c.id
-- where r."payStatus" = 'paid' and p.pagado is not true;
