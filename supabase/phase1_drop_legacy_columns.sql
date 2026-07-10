-- Phase 1 (Single Source of Truth) — final cleanup. DESTRUCTIVE.
--
-- Only run this after:
--   1. phase1_audit.sql + phase1_backfill.sql have been run and re-audited (0 orphans left).
--   2. The updated index.html has been deployed and verified end-to-end:
--      - Finanzas → Resumen totals match Finanzas → Pagos totals.
--      - Creating/editing a reservation with a price creates/updates the right compra + pagos.
--      - Marking an installment paid doesn't get clobbered by editing the reservation.
--
-- There is no built-in undo once this runs — take a Supabase backup/point-in-time
-- snapshot first if you're not fully confident.

alter table public.reservas
  drop column if exists precio,
  drop column if exists "payStatus",
  drop column if exists "whoPaid",
  drop column if exists installments,
  drop column if exists "payDue";
