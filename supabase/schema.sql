-- Stores one row per device/browser that opted into push notifications.
-- Run this once in the Supabase SQL Editor (supabase.com → your project → SQL Editor).

create table if not exists public.push_subscriptions (
  endpoint   text primary key,        -- unique per device/browser
  p256dh     text not null,           -- public key from the browser subscription
  auth       text not null,           -- auth secret from the browser subscription
  persona    text,                    -- which person's payments to send ('all' = everyone)
  created_at timestamptz default now()
);

-- The app writes subscriptions with the anon key. The other tables in this
-- project run with RLS disabled, so match that here.
alter table public.push_subscriptions disable row level security;
