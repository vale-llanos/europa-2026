-- ============================================================================
-- RESERVATION TRAVEL DOCUMENTS
-- Adds the reserva_documentos table + a public 'travel-documents' Storage
-- bucket so admins can attach booking confirmations, boarding passes,
-- vouchers, tickets, QR codes, etc. to a reserva. Anyone can view/download;
-- only admins (profiles.is_admin) can upload/replace/delete.
-- Run this in your Supabase SQL Editor.
-- ============================================================================

create table if not exists public.reserva_documentos (
  id             bigint generated always as identity primary key,
  reservation_id bigint not null references public.reservas(id) on delete cascade,
  file_name      text not null,
  storage_path   text not null,           -- path inside the 'travel-documents' bucket
  mime_type      text not null,
  file_size      bigint not null,          -- bytes
  document_type  text default 'other',     -- 'pdf' | 'image' | 'other' — drives the icon shown in the UI
  uploaded_by    uuid references auth.users(id),
  created_at     timestamptz default now()
);

create index if not exists idx_reserva_documentos_reservation_id
  on public.reserva_documentos(reservation_id);

alter table public.reserva_documentos enable row level security;

create policy "Reserva_documentos: Public read"
  on public.reserva_documentos for select
  using (true);

create policy "Reserva_documentos: Admin insert"
  on public.reserva_documentos for insert
  with check ((select is_admin from public.profiles where id = auth.uid()));

create policy "Reserva_documentos: Admin update"
  on public.reserva_documentos for update
  using ((select is_admin from public.profiles where id = auth.uid()))
  with check ((select is_admin from public.profiles where id = auth.uid()));

create policy "Reserva_documentos: Admin delete"
  on public.reserva_documentos for delete
  using ((select is_admin from public.profiles where id = auth.uid()));

-- Enable realtime so other open tabs/devices see uploads/deletes live.
alter publication supabase_realtime add table public.reserva_documentos;

-- ============================================================================
-- STORAGE BUCKET: travel-documents
-- Public read; bucket-level file_size_limit / allowed_mime_types are the
-- real backend enforcement for type/size (RLS policies can't inspect file
-- content), client-side checks are just fast UX feedback.
-- ============================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'travel-documents', 'travel-documents', true,
  10485760, -- 10 MB
  array['application/pdf','image/png','image/jpeg']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Storage RLS on storage.objects, scoped to this bucket only — without the
-- bucket_id filter these policies would apply to every bucket in the project.
create policy "travel-documents: Public read"
  on storage.objects for select
  using (bucket_id = 'travel-documents');

create policy "travel-documents: Admin insert"
  on storage.objects for insert
  with check (
    bucket_id = 'travel-documents'
    and (select is_admin from public.profiles where id = auth.uid())
  );

create policy "travel-documents: Admin update"
  on storage.objects for update
  using (
    bucket_id = 'travel-documents'
    and (select is_admin from public.profiles where id = auth.uid())
  )
  with check (
    bucket_id = 'travel-documents'
    and (select is_admin from public.profiles where id = auth.uid())
  );

create policy "travel-documents: Admin delete"
  on storage.objects for delete
  using (
    bucket_id = 'travel-documents'
    and (select is_admin from public.profiles where id = auth.uid())
  );
