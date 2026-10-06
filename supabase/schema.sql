-- ==============================================================================
-- SCHEMA SISTEM PENGADUAN KERUSAKAN BARANG KANTOR (SiPeKa)
-- Kemenkes Aesthetic Modern Office Equipment Complaint Management System
-- ==============================================================================

-- 1. ENUM STATUS LAPORAN
DO $$ BEGIN
    CREATE TYPE complaint_status AS ENUM ('menunggu', 'diproses', 'selesai');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. SEQUENCE UNTUK NOMOR LAPORAN
CREATE SEQUENCE IF NOT EXISTS complaint_number_seq START WITH 1;

-- 3. TABEL UTAMA: COMPLAINTS
CREATE TABLE IF NOT EXISTS complaints (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nomor_laporan TEXT NOT NULL UNIQUE,
    nama TEXT NOT NULL,
    nip VARCHAR(18) NOT NULL,
    tim_kerja TEXT NOT NULL,
    nama_barang TEXT NOT NULL,
    lokasi TEXT NOT NULL,
    deskripsi TEXT NOT NULL,
    tanggal_keluhan DATE NOT NULL DEFAULT CURRENT_DATE,
    tanggal_selesai DATE NULL,
    status complaint_status NOT NULL DEFAULT 'menunggu',
    catatan_admin TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_nip_digits CHECK (nip ~ '^[0-9]{18}$'),
    CONSTRAINT chk_tanggal_selesai CHECK (tanggal_selesai IS NULL OR tanggal_selesai >= tanggal_keluhan)
);

-- 4. TABEL FOTO: COMPLAINT_PHOTOS
CREATE TABLE IF NOT EXISTS complaint_photos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    complaint_id UUID NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
    storage_path TEXT NOT NULL,
    url TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. TABEL DAFTAR ADMIN RESMI
CREATE TABLE IF NOT EXISTS admins (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. TABEL RATE LIMITING BERDASARKAN HASH IP
CREATE TABLE IF NOT EXISTS ip_rate_limits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ip_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ip_rate_limits_hash_time ON ip_rate_limits (ip_hash, created_at);
CREATE INDEX IF NOT EXISTS idx_complaints_status ON complaints(status);
CREATE INDEX IF NOT EXISTS idx_complaints_tanggal_keluhan ON complaints(tanggal_keluhan DESC);

-- 7. FUNGSI GENERATOR NOMOR TIKET OTOMATIS (FORMAT: PK-YYYY-XXXX)
CREATE OR REPLACE FUNCTION generate_complaint_number()
RETURNS TRIGGER AS $$
DECLARE
    next_val BIGINT;
    year_str TEXT;
BEGIN
    IF NEW.nomor_laporan IS NULL OR NEW.nomor_laporan = '' THEN
        next_val := nextval('complaint_number_seq');
        year_str := to_char(CURRENT_DATE, 'YYYY');
        NEW.nomor_laporan := 'PK-' || year_str || '-' || lpad(next_val::TEXT, 4, '0');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_generate_complaint_number ON complaints;
CREATE TRIGGER trg_generate_complaint_number
BEFORE INSERT ON complaints
FOR EACH ROW
EXECUTE FUNCTION generate_complaint_number();

-- 8. TRIGGER UPDATE TIMESTAMP
CREATE OR REPLACE FUNCTION update_timestamp_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_complaints_timestamp ON complaints;
CREATE TRIGGER trg_update_complaints_timestamp
BEFORE UPDATE ON complaints
FOR EACH ROW
EXECUTE FUNCTION update_timestamp_column();

-- 9. VIEW PUBLIK: complaints_public
-- Menyembunyikan 12 digit tengah NIP demi privasi (UU Perlindungan Data Pribadi)
-- Hanya menampilkan 4 digit depan + **** + 2 digit belakang
CREATE OR REPLACE VIEW complaints_public AS
SELECT
    c.id,
    c.nomor_laporan,
    c.nama,
    CASE 
        WHEN length(c.nip) = 18 THEN substring(c.nip FROM 1 FOR 4) || '****' || substring(c.nip FROM 17 FOR 2)
        WHEN length(c.nip) > 6 THEN substring(c.nip FROM 1 FOR 4) || '****' || substring(c.nip FROM length(c.nip) - 1 FOR 2)
        ELSE '****'
    END AS nip,
    c.tim_kerja,
    c.nama_barang,
    c.lokasi,
    c.deskripsi,
    c.tanggal_keluhan,
    c.tanggal_selesai,
    c.status,
    c.catatan_admin,
    c.created_at,
    c.updated_at
FROM complaints c;

-- 10. ROW LEVEL SECURITY (RLS)
ALTER TABLE complaints ENABLE ROW LEVEL SECURITY;
ALTER TABLE complaint_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE ip_rate_limits ENABLE ROW LEVEL SECURITY;

-- Helper function: cek apakah user saat ini adalah admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM admins WHERE admins.id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Policy untuk complaints:
-- Publik hanya membaca lewat view complaints_public atau service role.
-- Admin berhak membaca semua data (termasuk NIP utuh), mengupdate status/catatan, dan menghapus.
DROP POLICY IF EXISTS "Admin can read complaints" ON complaints;
CREATE POLICY "Admin can read complaints"
ON complaints FOR SELECT
TO authenticated
USING (is_admin());

DROP POLICY IF EXISTS "Admin can update complaints" ON complaints;
CREATE POLICY "Admin can update complaints"
ON complaints FOR UPDATE
TO authenticated
USING (is_admin())
WITH CHECK (is_admin());

DROP POLICY IF EXISTS "Admin can delete complaints" ON complaints;
CREATE POLICY "Admin can delete complaints"
ON complaints FOR DELETE
TO authenticated
USING (is_admin());

-- Policy untuk complaint_photos:
-- Publik dan Admin bisa membaca foto
DROP POLICY IF EXISTS "Public can view complaint photos" ON complaint_photos;
CREATE POLICY "Public can view complaint photos"
ON complaint_photos FOR SELECT
TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS "Admin can delete complaint photos" ON complaint_photos;
CREATE POLICY "Admin can delete complaint photos"
ON complaint_photos FOR DELETE
TO authenticated
USING (is_admin());

-- Policy untuk admins table:
DROP POLICY IF EXISTS "Admin can view admins list" ON admins;
CREATE POLICY "Admin can view admins list"
ON admins FOR SELECT
TO authenticated
USING (is_admin());

-- Policy untuk ip_rate_limits:
-- Hanya service role yang mengakses langsung di server.

-- 11. GRANT PERMISSIONS KE VIEW PUBLIK
-- Izinkan anon dan authenticated membaca view publik & tabel foto
GRANT SELECT ON complaints_public TO anon, authenticated;
GRANT SELECT ON complaint_photos TO anon, authenticated;

-- 12. STORAGE BUCKET: complaint-photos
-- Masukkan konfigurasi bucket public-read jika belum ada
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'complaint-photos',
    'complaint-photos',
    true,
    5242880, -- 5MB limit
    ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
    public = true,
    file_size_limit = 5242880,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp'];

-- Storage Object Policies
DROP POLICY IF EXISTS "Public can view complaint photos storage" ON storage.objects;
CREATE POLICY "Public can view complaint photos storage"
ON storage.objects FOR SELECT
USING (bucket_id = 'complaint-photos');

DROP POLICY IF EXISTS "Admins can delete complaint photos storage" ON storage.objects;
CREATE POLICY "Admins can delete complaint photos storage"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'complaint-photos' AND is_admin());
