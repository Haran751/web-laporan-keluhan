-- ============================================================================
-- SIPeKa - Supabase Database Migration
-- Jalankan di Supabase SQL Editor (Dashboard → SQL Editor → New Query)
-- ============================================================================

-- 1. EXTENSIONS
-- ============================================================================
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- 2. TABLE: complaints
-- ============================================================================
create table if not exists public.complaints (
    id uuid primary key default gen_random_uuid(),
    nomor_laporan text unique not null default 'LP-' || to_char(now(), 'YYYYMMDD') || '-' || upper(substr(gen_random_uuid()::text, 1, 6)),
    nama text not null,
    nip text not null,
    tim_kerja text not null,
    nama_barang text not null,
    lokasi text not null,
    deskripsi text not null,
    tanggal_keluhan date not null,
    status text not null default 'menunggu' check (status in ('menunggu', 'diproses', 'selesai')),
    tanggal_selesai date,
    catatan_admin text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- Indexes untuk performa query
create index if not exists idx_complaints_status on public.complaints(status);
create index if not exists idx_complaints_tanggal_keluhan on public.complaints(tanggal_keluhan desc);
create index if not exists idx_complaints_created_at on public.complaints(created_at desc);
create index if not exists idx_complaints_nip on public.complaints(nip);
create index if not exists idx_complaints_nomor_laporan on public.complaints(nomor_laporan);

-- Trigger updated_at
create or replace function public.handle_updated_at()
returns trigger language plpgsql as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

drop trigger if exists trigger_complaints_updated_at on public.complaints;
create trigger trigger_complaints_updated_at
    before update on public.complaints
    for each row execute function public.handle_updated_at();

-- 3. TABLE: complaint_photos
-- ============================================================================
create table if not exists public.complaint_photos (
    id uuid primary key default gen_random_uuid(),
    complaint_id uuid not null references public.complaints(id) on delete cascade,
    storage_path text not null,
    url text not null,
    created_at timestamptz not null default now()
);

create index if not exists idx_complaint_photos_complaint_id on public.complaint_photos(complaint_id);

-- 4. TABLE: admins
-- ============================================================================
create table if not exists public.admins (
    id uuid primary key references auth.users(id) on delete cascade,
    email text not null unique,
    created_at timestamptz not null default now()
);

-- 5. TABLE: ip_rate_limits
-- ============================================================================
create table if not exists public.ip_rate_limits (
    id bigint generated always as identity primary key,
    ip_hash text not null,
    created_at timestamptz not null default now()
);

create index if not exists idx_ip_rate_limits_ip_hash_created on public.ip_rate_limits(ip_hash, created_at desc);

-- Auto-cleanup old rate limit entries (optional, via pg_cron or manual)
-- delete from ip_rate_limits where created_at < now() - interval '24 hours';

-- 6. VIEW: complaints_public (NIP disamarkan untuk akses publik)
-- ============================================================================
create or replace view public.complaints_public as
select
    id,
    nomor_laporan,
    nama,
    -- Masking NIP: tampilkan 4 digit awal + 4 digit akhir, sisanya bintang
    concat(
        substr(nip, 1, 4),
        repeat('*', greatest(0, length(nip) - 8)),
        substr(nip, -4)
    ) as nip,
    tim_kerja,
    nama_barang,
    lokasi,
    deskripsi,
    tanggal_keluhan,
    status,
    tanggal_selesai,
    catatan_admin,
    created_at,
    updated_at
from public.complaints;

-- 7. ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS pada semua tabel
alter table public.complaints enable row level security;
alter table public.complaint_photos enable row level security;
alter table public.admins enable row level security;
alter table public.ip_rate_limits enable row level security;

-- ---- COMPLAINTS ----
-- Public (anon): Hanya bisa SELECT via view complaints_public (bukan tabel langsung)
-- Service role (admin): Full access

-- Policy: Public read via view (dihandle di API route pakai view, jadi tabel complaints tidak perlu policy public select)
-- Tapi kalau mau allow anon select langsung ke tabel (dengan masking manual), uncomment bawah:
-- create policy "Public can view masked complaints" on public.complaints
--     for select using (true)
--     with check (false);

-- Policy: Service role full access (untuk admin API via service role key)
create policy "Service role full access complaints" on public.complaints
    for all using (auth.role() = 'service_role')
    with check (auth.role() = 'service_role');

-- ---- COMPLAINT_PHOTOS ----
create policy "Service role full access photos" on public.complaint_photos
    for all using (auth.role() = 'service_role')
    with check (auth.role() = 'service_role');

-- ---- ADMINS ----
-- Admin bisa liat daftar admin lain (via server client dengan session)
create policy "Authenticated admins can view admins" on public.admins
    for select using (
        exists (
            select 1 from public.admins a where a.id = auth.uid()
        )
    );

-- Service role full access (untuk create/delete admin via admin API)
create policy "Service role full access admins" on public.admins
    for all using (auth.role() = 'service_role')
    with check (auth.role() = 'service_role');

-- ---- IP_RATE_LIMITS ----
-- Hanya service role yang boleh insert/select (rate limiter di server)
create policy "Service role full access rate limits" on public.ip_rate_limits
    for all using (auth.role() = 'service_role')
    with check (auth.role() = 'service_role');

-- 8. STORAGE BUCKET: complaint-photos
-- ============================================================================
-- Jalankan di Storage UI atau via SQL:
-- insert into storage.buckets (id, name, public) values ('complaint-photos', 'complaint-photos', true)
-- on conflict (id) do nothing;

-- Storage Policies (jalankan setelah bucket dibuat)
-- Public read access untuk foto
-- create policy "Public read access" on storage.objects
--     for select using (bucket_id = 'complaint-photos');

-- Service role full access untuk upload/delete
-- create policy "Service role full access storage" on storage.objects
--     for all using (bucket_id = 'complaint-photos' and auth.role() = 'service_role')
--     with check (bucket_id = 'complaint-photos' and auth.role() = 'service_role');

-- 9. GRANTS (opsional, supabase biasanya handle otomatis)
-- ============================================================================
grant usage on schema public to anon, authenticated, service_role;
grant select on public.complaints_public to anon, authenticated;
grant all on public.complaints to service_role;
grant all on public.complaint_photos to service_role;
grant all on public.admins to service_role;
grant all on public.ip_rate_limits to service_role;

-- ============================================================================
-- SELESAI
-- ============================================================================
-- Verifikasi:
-- select * from public.complaints limit 5;
-- select * from public.complaints_public limit 5;
-- select * from public.admins;
-- select * from storage.buckets where id = 'complaint-photos';