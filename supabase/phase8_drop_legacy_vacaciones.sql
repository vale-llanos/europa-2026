-- Phase 8 (Data Model normalization) — final cleanup. DESTRUCTIVE.
--
-- Only run this after phase8_normalize_actividades.sql has been run and the
-- app (now reading es_vacaciones everywhere instead of vacaciones) has been
-- verified: marking/unmarking vacation days works and shows correctly on
-- city cards, the vacation list, and the calendar.
--
-- fecha/dia/categoria are NOT dropped — they remain the display source for
-- the itinerary/calendar and (for categoria) the detailed category text shown
-- in the UI. Only `vacaciones` becomes fully redundant after this phase.
--
-- There is no built-in undo once this runs — take a Supabase backup/point-in-time
-- snapshot first if you're not fully confident.

alter table public.actividades
  drop column if exists vacaciones;
