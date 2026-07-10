-- Phase 1 (Single Source of Truth) — read-only audit.
-- Run this FIRST in the Supabase SQL Editor and review the results before
-- running phase1_backfill.sql. Nothing here mutates data.

-- 0) Check the actual column types of the id/FK columns involved.
--    phase1_backfill.sql adds `compras.paid_by` as `bigint references personas(id)`,
--    assuming personas.id is bigint (matching the String()-coercion pattern the app
--    already uses for reserva_id/compra_id, which implies int8). If personas.id
--    shows as `uuid` below, edit phase1_backfill.sql to use `uuid` instead.
select table_name, column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and (
    (table_name = 'personas'  and column_name = 'id') or
    (table_name = 'reservas'  and column_name = 'id') or
    (table_name = 'compras'   and column_name in ('id','reserva_id')) or
    (table_name = 'pagos'     and column_name in ('id','compra_id'))
  )
order by table_name, column_name;

-- 1) Reservas with a legacy price that have NO matching compra yet.
--    These are the rows phase1_backfill.sql will create a compra + pagos for.
select r.id, r.nombre, r.ciudad, r.precio, r."payStatus", r."whoPaid", r.installments, r."payDue"
from public.reservas r
where coalesce(r.precio, 0) > 0
  and not exists (select 1 from public.compras c where c.reserva_id = r.id)
order by r.ciudad, r.nombre;

-- 2) Reservas whose whoPaid text does not match any persona name.
--    Fix these names (or add the persona) before backfilling paid_by, otherwise
--    that reserva's compra will be backfilled with paid_by = NULL.
select r.id, r.nombre, r."whoPaid"
from public.reservas r
where r."whoPaid" is not null and r."whoPaid" <> ''
  and not exists (
    select 1 from public.personas p
    where lower(p.nombre) = lower(r."whoPaid")
  )
order by r."whoPaid";

-- 3) Cached-column drift check: compras.cuotas_pagadas / faltante_total vs.
--    what pagos actually says. Non-zero diff_* means the cache is stale today —
--    this is the reason compraFinancials() must always read pagos live.
select
  c.id as compra_id,
  c.reserva_id,
  c.descripcion,
  c.cuotas_pagadas as cached_cuotas_pagadas,
  count(*) filter (where p.pagado) as live_cuotas_pagadas,
  c.faltante_total as cached_faltante_total,
  c.valor_total - coalesce(sum(p.valor_cuota) filter (where p.pagado), 0) as live_faltante_total,
  c.cuotas_pagadas - count(*) filter (where p.pagado) as diff_cuotas_pagadas,
  c.faltante_total - (c.valor_total - coalesce(sum(p.valor_cuota) filter (where p.pagado), 0)) as diff_faltante_total
from public.compras c
left join public.pagos p on p.compra_id = c.id
group by c.id, c.reserva_id, c.descripcion, c.cuotas_pagadas, c.faltante_total, c.valor_total
having c.cuotas_pagadas <> count(*) filter (where p.pagado)
    or c.faltante_total <> (c.valor_total - coalesce(sum(p.valor_cuota) filter (where p.pagado), 0))
order by c.reserva_id;

-- 4) Reservas with MORE THAN ONE linked compra — the app's auto-reconciliation
--    (create/resize pagos on save) intentionally skips these and just links to
--    "Gestionar pagos" instead, since it's ambiguous which compra to edit.
select r.id as reserva_id, r.nombre, count(c.id) as compra_count
from public.reservas r
join public.compras c on c.reserva_id = r.id
group by r.id, r.nombre
having count(c.id) > 1
order by compra_count desc;
