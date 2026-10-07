# PADUKA - Pengaduan Kerusakan Fasilitas Kantor

Aplikasi web modern berbasis **Next.js (App Router)**, **TypeScript**, **Tailwind CSS**, dan **Supabase** untuk pelaporan dan pemantauan penanganan kerusakan sarana prasarana dinas. Didesain dengan palet warna resmi khas Kementerian Kesehatan (Kemenkes: teal, mint `#40ff8c`, dan lime `#ccff00`), tipografi berukuran besar dan terbaca jelas, serta alur kerja yang rapi dan aman.

---

## 🌟 Fitur Utama

1. **Portal Publik Transparan (Tanpa Perlu Login)**
   - **Daftar Keluhan (`/`)**: Tabel dan kartu responsif menampilkan riwayat aduan, tanggal, nama pelapor, **NIP yang disamarkan (masking)** (contoh: `2601****01`), unit kerja, barang, lokasi, tanggal selesai, serta badge status (*Menunggu*, *Diproses*, *Selesai*).
   - **Pencarian & Saringan**: Cari cepat berdasarkan nama barang, nomor tiket, nama pelapor, lokasi, serta filter status dan rentang tanggal.
   - **Formulir Pengaduan (`/lapor`)**:
     - **Verifikasi Identitas Pegawai**: Nama lengkap dan **NIP 18 digit** harus cocok dengan master data pegawai resmi. Bila nama dan NIP tidak sesuai, laporan **tidak dapat dikirim**.
     - **Tim Kerja Otomatis**: Bagian tim kerja terisi otomatis begitu nama dan NIP terverifikasi.
     - **Auto-Scroll Validasi**: Saat menekan "Kirimkan Laporan" dan masih ada kolom yang kurang, halaman otomatis menggulir (scroll) ke kolom tersebut.
     - **Bukti Foto Kerusakan**: Wajib 3–6 foto, lengkap dengan **notifikasi** bila foto kurang dari 3 atau melebihi 6.
     - **Kompresi Gambar Sisi Klien (Browser)**: Berkas foto dikompresi otomatis (`<1MB`, lebar maks 1600px) sebelum diunggah sehingga hemat bandwidth dan responsif.
     - **Arsitektur Direct-to-Storage**: Berkas foto diunggah langsung ke Supabase Storage via *Signed Upload URL* secara paralel, melewati batas ukuran body 4.5MB Vercel Serverless.
     - **Perlindungan Anti-Bot Honeypot & Rate Limiting** (maksimal 5 laporan per jam per koneksi IP).
     - **Halaman Konfirmasi**: Menampilkan nomor tiket resmi (contoh: `#PK-2026-0001`) beserta tombol salin nomor tiket.
   - **Detail Laporan (`/keluhan/[id]`)**: Rincian aduan lengkap, status tindak lanjut, catatan teknisi, dan galeri foto dengan modal **Lightbox** interaktif (bisa diperbesar dan dinavigasi).
   - **Master Data Pegawai (`src/lib/pegawai.ts`)**: Daftar NIP, nama, dan tim kerja yang menjadi acuan verifikasi identitas pelapor.

2. **Panel Khusus Petugas / Administrator (`/admin`)**
   - **Login Petugas (`/admin/login`)**: Autentikasi aman melalui Supabase Auth, dengan tombol **tampilkan/sembunyikan kata sandi**.
   - **Proteksi Middleware**: Seluruh rute `/admin/*` diproteksi ketat di sisi server.
   - **Dashboard Kendali (`/admin`)**:
     - Statistik ringkas total aduan, menunggu, diproses, dan selesai.
     - Tabel lengkap yang menampilkan **NIP UTUH (18 digit)** untuk keperluan verifikasi kedinasan.
     - **Tindak Lanjut & Ubah Status**: Dialog pembaruan status, tanggal penyelesaian teknis (otomatis terisi hari ini bila status selesai), dan catatan resmi petugas.
     - **Hapus Laporan**: Menghapus catatan di basis data sekaligus membersihkan berkas foto terkait di Supabase Storage secara permanen.
     - **Ekspor Laporan (Excel CSV, Word DOCX, PDF)**: Mengunduh data terfilter dalam tiga format — **Excel CSV** memakai **UTF-8 BOM** (terbaca rapi di Microsoft Excel Windows tanpa karakter rusak) dan NIP diformat sebagai teks (tidak berubah menjadi notasi ilmiah); **Word DOCX** menghasilkan dokumen resmi berkop PADUKA dengan tabel rekapitulasi lengkap (termasuk tautan foto); **PDF** menghasilkan laporan landscape siap cetak dengan format tabel rapi.
   - **Kelola Admin (`/admin/users`)**:
     - Menambah admin baru menggunakan `supabase.auth.admin` di sisi server, dengan tombol **tampilkan/sembunyikan kata sandi**.
     - Menghapus admin lain (dengan proteksi: admin tidak dapat menghapus dirinya sendiri).

---

## 🛠️ Panduan Langkah Demi Langkah Dari Nol (Untuk Pemula)

### Langkah 1: Buat Project di Supabase
1. Buka [https://supabase.com](https://supabase.com) dan login/daftar akun gratis.
2. Klik tombol **New Project**.
3. Isi informasi project:
   - **Name**: `paduka-kantor` (atau nama lain sesuai kebutuhan).
   - **Database Password**: Buat password yang kuat dan catat password ini.
   - **Region**: Pilih region terdekat (misal: `Singapore`).
4. Klik **Create new project** dan tunggu 1-2 menit hingga database selesai disiapkan.

---

### Langkah 2: Jalankan Script SQL Schema & Storage
1. Di dashboard Supabase Anda, buka menu **SQL Editor** pada navigasi sebelah kiri.
2. Klik **New query**.
3. Buka berkas `supabase/schema.sql` pada project ini, salin seluruh kodenya, lalu tempelkan ke SQL Editor Supabase.
4. Klik tombol **Run** (atau tekan `Ctrl + Enter`).
5. Script ini akan otomatis membuat:
   - Tipe data enum `complaint_status`
   - Tabel `complaints`, `complaint_photos`, `admins`, dan `ip_rate_limits`
   - Sequence dan trigger nomor tiket otomatis `#PK-YYYY-XXXX`
   - View publik `complaints_public` dengan penyusutan/masking NIP otomatis
   - Row Level Security (RLS) policies
   - Bucket Supabase Storage `complaint-photos` beserta kebijakan akses publiknya.

> **Catatan**: Daftar pegawai yang berhak mengirim laporan (NIP, nama, tim kerja) dikelola di berkas `src/lib/pegawai.ts`. Sesuaikan isinya dengan data pegawai instansi Anda sebelum digunakan.

---

### Langkah 3: Dapatkan API Keys Supabase
1. Di dashboard Supabase, buka menu **Project Settings** (ikon gerigi di kiri bawah).
2. Pilih submenu **API**.
3. Temukan data berikut:
   - **Project URL**: Salin URL ini (contoh: `https://xyzcompany.supabase.co`).
   - **anon / public key**: Salin kunci publik ini.
   - **service_role key**: Klik tombol reveal lalu salin kunci rahasia ini. *(Perhatian: Kunci ini bersifat rahasia dan hanya berjalan di server)*.

---

### Langkah 4: Konfigurasi Environment Variable Lokal
1. Di folder proyek lokal Anda, buat berkas `.env.local` (atau salin dari `.env.example`):
   ```bash
   cp .env.example .env.local
   ```
2. Isi nilai yang didapat dari Langkah 3:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
   SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...
   ```

---

### Langkah 5: Buat Akun Administrator Pertama
Karena belum ada admin di sistem, jalankan script bootstrap yang sudah disediakan:
```bash
node scripts/create-admin.mjs admin@kemenkes.go.id Password123!
```
*(Ganti email dan password di atas sesuai kredensial yang Anda inginkan)*.

Script ini akan otomatis mendaftarkan akun di Supabase Auth dan memberinya status admin resmi di tabel `admins`.

---

### Langkah 6: Jalankan di Komputer Lokal
1. Pasang dependensi:
   ```bash
   npm install
   ```
2. Jalankan server pengembangan lokal:
   ```bash
   npm run dev
   ```
3. Buka browser di:
   - Halaman Publik: [http://localhost:3000](http://localhost:3000)
   - Formulir Lapor: [http://localhost:3000/lapor](http://localhost:3000/lapor)
   - Login Petugas: [http://localhost:3000/admin/login](http://localhost:3000/admin/login)

---

## 🔒 Catatan Keamanan Penting
- **Service Role Key**: Jangan pernah menambahkan prefix `NEXT_PUBLIC_` pada `SUPABASE_SERVICE_ROLE_KEY`. Kunci ini hanya digunakan di API routes server.
- **Penyimpanan Foto**: Pengguna mengunggah gambar langsung ke bucket storage melalui URL sementara bertanda tangan (*Signed Upload URL*) yang berlaku selama 15 menit.
- **Privasi NIP**: Publik hanya dapat melihat potongan NIP (contoh `2601****01`). NIP lengkap 18 digit hanya dapat dilihat oleh admin yang terotentikasi di `/admin`.
- **Verifikasi Identitas**: Nama dan NIP pelapor diverifikasi terhadap master data pegawai di sisi klien maupun server, sehingga laporan dari identitas yang tidak terdaftar akan ditolak.
- **Anti-Bot & Rate Limiting**: Formulir dilengkapi honeypot field tersembunyi dan pembatasan maksimal 5 pengiriman aduan per jam per koneksi IP.
