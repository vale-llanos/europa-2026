-- ============================================================================
-- SUPABASE AUTHENTICATION & ADMIN SETUP
-- Run this in your Supabase SQL Editor to set up user authentication
-- ============================================================================

-- 1. Create profiles table to track admin status
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  is_admin boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.profiles enable row level security;

-- Profiles: Anyone can read, users can update their own, admins can update anyone
create policy "Public profiles are viewable by everyone"
  on public.profiles for select
  using (true);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "Admins can update any profile"
  on public.profiles for update
  using ((select is_admin from public.profiles where id = auth.uid()))
  with check ((select is_admin from public.profiles where id = auth.uid()));

-- ============================================================================
-- ENABLE RLS ON EXISTING TABLES
-- ============================================================================

-- Personas table
alter table public.personas enable row level security;

create policy "Personas: Public read"
  on public.personas for select
  using (true);

create policy "Personas: Admin write"
  on public.personas for insert
  using ((select is_admin from public.profiles where id = auth.uid()))
  with check ((select is_admin from public.profiles where id = auth.uid()));

create policy "Personas: Admin update"
  on public.personas for update
  using ((select is_admin from public.profiles where id = auth.uid()))
  with check ((select is_admin from public.profiles where id = auth.uid()));

create policy "Personas: Admin delete"
  on public.personas for delete
  using ((select is_admin from public.profiles where id = auth.uid()));

-- ============================================================================
-- Compras table
alter table public.compras enable row level security;

create policy "Compras: Public read"
  on public.compras for select
  using (true);

create policy "Compras: Admin write"
  on public.compras for insert
  using ((select is_admin from public.profiles where id = auth.uid()))
  with check ((select is_admin from public.profiles where id = auth.uid()));

create policy "Compras: Admin update"
  on public.compras for update
  using ((select is_admin from public.profiles where id = auth.uid()))
  with check ((select is_admin from public.profiles where id = auth.uid()));

create policy "Compras: Admin delete"
  on public.compras for delete
  using ((select is_admin from public.profiles where id = auth.uid()));

-- ============================================================================
-- Pagos table
alter table public.pagos enable row level security;

create policy "Pagos: Public read"
  on public.pagos for select
  using (true);

create policy "Pagos: Admin write"
  on public.pagos for insert
  using ((select is_admin from public.profiles where id = auth.uid()))
  with check ((select is_admin from public.profiles where id = auth.uid()));

create policy "Pagos: Admin update"
  on public.pagos for update
  using ((select is_admin from public.profiles where id = auth.uid()))
  with check ((select is_admin from public.profiles where id = auth.uid()));

create policy "Pagos: Admin delete"
  on public.pagos for delete
  using ((select is_admin from public.profiles where id = auth.uid()));

-- ============================================================================
-- Reservas table
alter table public.reservas enable row level security;

create policy "Reservas: Public read"
  on public.reservas for select
  using (true);

create policy "Reservas: Admin write"
  on public.reservas for insert
  using ((select is_admin from public.profiles where id = auth.uid()))
  with check ((select is_admin from public.profiles where id = auth.uid()));

create policy "Reservas: Admin update"
  on public.reservas for update
  using ((select is_admin from public.profiles where id = auth.uid()))
  with check ((select is_admin from public.profiles where id = auth.uid()));

create policy "Reservas: Admin delete"
  on public.reservas for delete
  using ((select is_admin from public.profiles where id = auth.uid()));

-- ============================================================================
-- Compra_participantes table
alter table public.compra_participantes enable row level security;

create policy "Compra_participantes: Public read"
  on public.compra_participantes for select
  using (true);

create policy "Compra_participantes: Admin write"
  on public.compra_participantes for insert
  using ((select is_admin from public.profiles where id = auth.uid()))
  with check ((select is_admin from public.profiles where id = auth.uid()));

create policy "Compra_participantes: Admin update"
  on public.compra_participantes for update
  using ((select is_admin from public.profiles where id = auth.uid()))
  with check ((select is_admin from public.profiles where id = auth.uid()));

create policy "Compra_participantes: Admin delete"
  on public.compra_participantes for delete
  using ((select is_admin from public.profiles where id = auth.uid()));

-- ============================================================================
-- Push_subscriptions table (allow anyone to create, users manage their own)
alter table public.push_subscriptions enable row level security;

create policy "Push_subscriptions: Public read"
  on public.push_subscriptions for select
  using (true);

create policy "Push_subscriptions: Anyone can create"
  on public.push_subscriptions for insert
  using (true)
  with check (true);

create policy "Push_subscriptions: Admins can delete"
  on public.push_subscriptions for delete
  using ((select is_admin from public.profiles where id = auth.uid()) or true);

-- ============================================================================
-- Create initial admin user (UPDATE THESE VALUES!)
-- ============================================================================
-- Step 1: Create the user via Supabase Auth UI (or via API)
-- Step 2: Then run this to mark them as admin:
-- 
-- INSERT INTO public.profiles (id, email, full_name, is_admin)
-- VALUES ('{USER_UUID}', '{USER_EMAIL}', '{USER_NAME}', true)
-- ON CONFLICT (id) DO UPDATE SET is_admin = true;
--
-- You can find the user UUID in Supabase → Authentication → Users

-- Enable realtime for profiles changes
alter publication supabase_realtime add table public.profiles;
