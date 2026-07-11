-- Phase 8 (Data Model normalization) — additive, non-destructive.
-- Adds real DATE/boolean/enum columns to actividades alongside the existing
-- free-text ones (fecha/dia/categoria/vacaciones all stay put). Run this once
-- in the Supabase SQL Editor. Idempotent: safe to re-run.
--
-- Scope (see the approved plan for the full reasoning):
--   fecha_date      date     — canonical date, replaces string-parsing "25-Jul" for sorting
--   es_vacaciones   boolean  — canonical vacation flag, replaces 'Si'/'No' text
--   categoria_tipo  text     — the same 5-bucket classification classifyCategory() already
--                              computes in JS, stored here too for direct SQL reporting
-- horario/transporte are deliberately NOT touched (see plan: "Todo el día" doesn't fit a
-- TIME column without an extra flag, and transporte has no filtering/sorting riding on it).

begin;

alter table public.actividades
  add column if not exists fecha_date date,
  add column if not exists es_vacaciones boolean not null default false,
  add column if not exists categoria_tipo text;

-- 1) fecha_date: parse "DD-Mon" (English Jan-Dec, plus the Spanish Ene/Abr/Ago/Dic
--    the app already treats as legacy-compat in its own MONTH_NUM table). Year is
--    hardcoded 2026 — the same assumption fechaToISO() makes everywhere in the app
--    today, not a new limitation introduced here.
update public.actividades
set fecha_date = make_date(
  2026,
  case split_part(fecha, '-', 2)
    when 'Jan' then 1 when 'Feb' then 2 when 'Mar' then 3  when 'Apr' then 4
    when 'May' then 5 when 'Jun' then 6 when 'Jul' then 7  when 'Aug' then 8
    when 'Sep' then 9 when 'Oct' then 10 when 'Nov' then 11 when 'Dec' then 12
    when 'Ene' then 1 when 'Abr' then 4 when 'Ago' then 8  when 'Dic' then 12
  end,
  split_part(fecha, '-', 1)::int
)
where fecha is not null and fecha_date is null
  and split_part(fecha, '-', 1) ~ '^[0-9]+$';

-- 2) es_vacaciones: straight 1:1 mapping from the legacy text flag.
update public.actividades
set es_vacaciones = (vacaciones = 'Si')
where vacaciones is not null;

-- 3) categoria_tipo: mirrors classifyCategory()'s substring-match order exactly
--    (work -> food -> tourism -> transport -> rest default) so the DB and app
--    never disagree on what bucket a given categoria falls into.
update public.actividades
set categoria_tipo = case
  when upper(categoria) like '%TRABAJO%' then 'work'
  when upper(categoria) like '%COMIDA%' or upper(categoria) like '%MERCADO%' or upper(categoria) like '%NIGHTLIFE%' then 'food'
  when upper(categoria) like '%TURISMO%' or upper(categoria) like '%ARTE%' or upper(categoria) like '%MUSEO%'
    or upper(categoria) like '%ARQUITECTURA%' or upper(categoria) like '%HISTÓRICO%' or upper(categoria) like '%PARQUE%'
    or upper(categoria) like '%FÚTBOL%' or upper(categoria) like '%SHOPPING%' or upper(categoria) like '%VINTAGE%'
    or upper(categoria) like '%NATURA%' then 'tourism'
  when upper(categoria) like '%TRANSPORTE%' or upper(categoria) like '%LOGÍSTICA%' or upper(categoria) like '%LOGISTICA%' then 'transport'
  else 'rest'
end;

-- Constraint added after backfill so it never has to reject a transient value.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'actividades_categoria_tipo_check') then
    alter table public.actividades
      add constraint actividades_categoria_tipo_check
      check (categoria_tipo is null or categoria_tipo in ('work','food','tourism','transport','rest'));
  end if;
end $$;

commit;

-- After running, spot-check: this should return 0 rows (every activity with a
-- fecha should now have a matching fecha_date).
-- select id, fecha, fecha_date from public.actividades where fecha is not null and fecha_date is null;
