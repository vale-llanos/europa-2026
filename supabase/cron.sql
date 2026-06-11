-- Schedule the reminder function to run once a day.
-- Run this in the Supabase SQL Editor AFTER the function is deployed and the
-- secrets are set. Replace YOUR_CRON_SECRET with the same value you stored in
-- the function's CRON_SECRET secret.
--
-- 13:00 UTC ≈ 8:00 AM in Bogotá (≈ 3:00 PM in Europe during the trip).
-- Adjust the cron expression if you want a different hour.

-- Enable the extensions used to call the function over HTTP on a schedule.
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'payment-reminders-daily',
  '0 13 * * *',
  $$
  select net.http_post(
    url     := 'https://xkgwzbqwmczvgspbasis.supabase.co/functions/v1/send-payment-reminders',
    headers := jsonb_build_object(
                 'Content-Type',  'application/json',
                 'Authorization', 'sdjkLHEFIP075ksiweg78'
               )
  );
  $$
);

-- Handy management commands:
--   select * from cron.job;                              -- list jobs
--   select cron.unschedule('payment-reminders-daily');   -- remove this job
