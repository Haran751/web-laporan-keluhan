'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import imageCompression from 'browser-image-compression';
import {
  UploadCloud,
  X,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Copy,
  Check,
  ArrowRight,
  ShieldCheck,
  FileText,
  Calendar,
  User,
  Hash,
  Building,
  MapPin,
  HelpCircle,
  Loader2,
  Image as ImageIcon
} from 'lucide-react';
import { ALLOWED_PHOTO_TYPES, MIN_PHOTO_COUNT, MAX_PHOTO_COUNT } from '@/lib/validations';
import { validasiPegawai } from '@/lib/pegawai';

interface PhotoItem {
  id: string;
  file: File;
  previewUrl: string;
  originalSize: number;
  compressedSize: number;
  compressedFile: File;
}

export default function LaporPage() {
  const router = useRouter();

  // Form State
  const [nama, setNama] = useState('');
  const [nip, setNip] = useState('');
  const [timKerja, setTimKerja] = useState('');
  const [namaBarang, setNamaBarang] = useState('');
  const [lokasi, setLokasi] = useState('');
  const [deskripsi, setDeskripsi] = useState('');
  const [tanggalKeluhan, setTanggalKeluhan] = useState('');
  const [honeypot, setHoneypot] = useState(''); // Anti-bot field

  // Photo Upload State
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [isCompressing, setIsCompressing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string>('');
  const [formError, setFormError] = useState<string | null>(null);
  const [photoWarning, setPhotoWarning] = useState<string | null>(null);

  // Success Confirmation State
  const [submittedData, setSubmittedData] = useState<{
    id: string;
    nomor_laporan: string;
    nama: string;
    nama_barang: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const namaRef = useRef<HTMLInputElement>(null);
  const nipRef = useRef<HTMLInputElement>(null);
  const timKerjaRef = useRef<HTMLInputElement>(null);
  const namaBarangRef = useRef<HTMLInputElement>(null);
  const lokasiRef = useRef<HTMLInputElement>(null);
  const tanggalRef = useRef<HTMLInputElement>(null);
  const deskripsiRef = useRef<HTMLTextAreaElement>(null);
  const photosSectionRef = useRef<HTMLDivElement>(null);

  // Set default date to today
  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    setTanggalKeluhan(today);
  }, []);

  // Verifikasi identitas pelapor terhadap master data pegawai resmi
  const identitas = validasiPegawai(nama, nip);

  // Isi otomatis Tim Kerja saat Nama & NIP terverifikasi; kosongkan bila tidak
  useEffect(() => {
    if (identitas.status === 'valid' && identitas.timKerja) {
      setTimKerja(identitas.timKerja);
    } else {
      setTimKerja('');
    }
  }, [identitas.status, identitas.timKerja]);

  // Handle NIP input: allow digits only, max 18
  const handleNipChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, '');
    if (val.length <= 18) {
      setNip(val);
    }
  };

  // Format file size helper
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  // Handle File Selection and Compression
  const handleFiles = async (selectedFiles: FileList | null) => {
    if (!selectedFiles || selectedFiles.length === 0) return;

    setFormError(null);
    setPhotoWarning(null);

    const incoming = Array.from(selectedFiles);
    const remainingSlots = MAX_PHOTO_COUNT - photos.length;

    // Peringatan: kuota maksimal sudah penuh
    if (remainingSlots <= 0) {
      setPhotoWarning(
        `Jumlah foto sudah mencapai batas maksimal ${MAX_PHOTO_COUNT}. Hapus salah satu foto terlebih dahulu untuk menambah yang baru.`
      );
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    // Bila berkas yang dipilih melebihi kapasitas, ambil sejumlah slot yang tersisa saja
    const accepted = incoming.slice(0, remainingSlots);
    const skippedByQuota = incoming.length - accepted.length;

    const newPhotos: PhotoItem[] = [];
    let rejectedType = 0;
    let rejectedSize = 0;

    setIsCompressing(true);

    try {
      for (const file of accepted) {
        // Validasi tipe berkas
        if (!ALLOWED_PHOTO_TYPES.includes(file.type)) {
          rejectedType += 1;
          continue;
        }

        // Validasi ukuran maks 5MB sebelum kompres
        if (file.size > 5 * 1024 * 1024) {
          rejectedSize += 1;
          continue;
        }

        // Kompresi di sisi peramban (browser-image-compression)
        // Target: maks ~1MB, lebar maks 1600px
        const options = {
          maxSizeMB: 1,
          maxWidthOrHeight: 1600,
          useWebWorker: true,
          fileType: file.type,
        };

        const compressed = await imageCompression(file, options);
        const preview = URL.createObjectURL(compressed);

        newPhotos.push({
          id: Math.random().toString(36).substring(2, 9),
          file,
          previewUrl: preview,
          originalSize: file.size,
          compressedSize: compressed.size,
          compressedFile: compressed,
        });
      }

      setPhotos((prev) => [...prev, ...newPhotos].slice(0, MAX_PHOTO_COUNT));

      // Susun pesan peringatan bila ada berkas yang tidak diterima
      const warnings: string[] = [];
      if (skippedByQuota > 0) {
        warnings.push(
          `${skippedByQuota} foto tidak ditambahkan karena melebihi batas maksimal ${MAX_PHOTO_COUNT} foto.`
        );
      }
      if (rejectedType > 0) {
        warnings.push(
          `${rejectedType} berkas diabaikan karena formatnya tidak didukung (hanya JPG, PNG, atau WEBP).`
        );
      }
      if (rejectedSize > 0) {
        warnings.push(`${rejectedSize} berkas diabaikan karena melebihi batas 5MB.`);
      }
      if (warnings.length > 0) {
        setPhotoWarning(warnings.join(' '));
      }
    } catch (err: any) {
      console.error('Compression error:', err);
      setPhotoWarning('Gagal mengompresi gambar. Coba pilih berkas foto lain.');
    } finally {
      setIsCompressing(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const removePhoto = (id: string) => {
    setPhotoWarning(null);
    setPhotos((prev) => {
      const removed = prev.find((p) => p.id === id);
      if (removed) {
        URL.revokeObjectURL(removed.previewUrl);
      }
      return prev.filter((p) => p.id !== id);
    });
  };

  // Form Validation Check — seluruh kolom wajib terpenuhi sebelum laporan dapat dikirim.
  const isNipValid = nip.length === 18;
  const isIdentitasValid = identitas.status === 'valid';
  const hasEnoughPhotos = photos.length >= MIN_PHOTO_COUNT;

  // Setiap syarat dipetakan ke elemen terkait agar bisa di-scroll otomatis saat ada yang kurang.
  const requirements: {
    label: string;
    ok: boolean;
    ref: React.RefObject<HTMLElement>;
  }[] = [
    { label: 'Nama lengkap pelapor (min. 2 karakter)', ok: nama.trim().length >= 2, ref: namaRef },
    { label: 'NIP tepat 18 angka', ok: isNipValid, ref: nipRef },
    { label: 'Nama & NIP sesuai data pegawai', ok: isIdentitasValid, ref: nipRef },
    {
      label: 'Tim kerja / unit organisasi (otomatis)',
      ok: timKerja.trim().length >= 2,
      ref: timKerjaRef,
    },
    { label: 'Nama / jenis fasilitas rusak', ok: namaBarang.trim().length >= 2, ref: namaBarangRef },
    { label: 'Lokasi gedung / ruangan', ok: lokasi.trim().length >= 2, ref: lokasiRef },
    { label: 'Tanggal kejadian / temuan', ok: !!tanggalKeluhan, ref: tanggalRef },
    { label: 'Deskripsi gejala (min. 10 karakter)', ok: deskripsi.trim().length >= 10, ref: deskripsiRef },
    { label: `Foto bukti minimal ${MIN_PHOTO_COUNT} foto`, ok: hasEnoughPhotos, ref: photosSectionRef },
  ];
  const missingRequirements = requirements.filter((r) => !r.ok);

  // Gulir otomatis ke kolom pertama yang belum lengkap dan fokuskan bila berupa input.
  const scrollToFirstMissing = () => {
    const first = missingRequirements[0];
    if (!first) return;
    const el = first.ref.current;
    if (!el) return;

    el.scrollIntoView({ behavior: 'smooth', block: 'center' });

    if (
      el instanceof HTMLInputElement ||
      el instanceof HTMLTextAreaElement ||
      el instanceof HTMLSelectElement
    ) {
      el.focus({ preventScroll: true });
    } else {
      // Untuk area foto (non-input), beri sorotan singkat agar mudah ditemukan.
      el.classList.add('ring-2', 'ring-amber-400', 'rounded-2xl');
      setTimeout(() => el.classList.remove('ring-2', 'ring-amber-400'), 2200);
    }
  };

  // Handle Form Submit (Direct-to-Storage with Signed URLs)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    // Bot detection via honeypot
    if (honeypot.trim() !== '') {
      console.warn('Bot detected via honeypot');
      return;
    }

    // Bila masih ada kolom kurang, arahkan (scroll) otomatis ke bagian tersebut.
    if (missingRequirements.length > 0) {
      setFormError('Laporan belum lengkap. Formulir diarahkan otomatis ke bagian yang masih perlu dilengkapi.');
      scrollToFirstMissing();
      return;
    }

    setIsSubmitting(true);
    const uploadedPaths: string[] = [];

    try {
      // -------------------------------------------------------------
      // LANGKAH 1: Minta Signed Upload URL ke Server Next.js
      // -------------------------------------------------------------
      setUploadProgress('Mempersiapkan jalur unggah aman...');

      const urlReqRes = await fetch('/api/upload-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          files: photos.map((p) => ({
            filename: p.file.name,
            fileType: p.compressedFile.type || 'image/jpeg',
          })),
        }),
      });

      const urlReqJson = await urlReqRes.json();

      if (!urlReqRes.ok) {
        throw new Error(urlReqJson.error || 'Gagal memperoleh izin upload');
      }

      const signedDataList = urlReqJson.data;

      // -------------------------------------------------------------
      // LANGKAH 2: Upload Langsung ke Supabase Storage via Signed URL
      // (Bypass Vercel body limit 4.5MB)
      // -------------------------------------------------------------
      // Unggah semua foto secara PARALEL agar jauh lebih cepat.
      // Sebelumnya berurutan, sehingga total waktu = jumlah foto x waktu per foto.
      const finalUploadedPhotos: { storage_path: string; url: string }[] = new Array(
        photos.length
      );
      let uploadedCount = 0;

      await Promise.all(
        photos.map(async (photo, i) => {
          const signedTarget = signedDataList[i];

          // Unggah langsung berkas biner ke Supabase Storage menggunakan PUT
          const uploadRes = await fetch(signedTarget.signedUrl, {
            method: 'PUT',
            headers: {
              'Content-Type': photo.compressedFile.type,
            },
            body: photo.compressedFile,
          });

          if (!uploadRes.ok) {
            throw new Error(`Gagal mengunggah foto ke-${i + 1} (${photo.file.name})`);
          }

          uploadedPaths.push(signedTarget.storagePath);
          finalUploadedPhotos[i] = {
            storage_path: signedTarget.storagePath,
            url: signedTarget.publicUrl,
          };

          uploadedCount += 1;
          setUploadProgress(`Mengunggah foto ${uploadedCount} dari ${photos.length}...`);
        })
      );

      // -------------------------------------------------------------
      // LANGKAH 3: Simpan Data Laporan & Referensi Foto ke Server
      // -------------------------------------------------------------
      setUploadProgress('Menyimpan data laporan resmi...');

      const complaintRes = await fetch('/api/complaints', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nama: nama.trim(),
          nip: nip.trim(),
          tim_kerja: timKerja.trim(),
          nama_barang: namaBarang.trim(),
          lokasi: lokasi.trim(),
          deskripsi: deskripsi.trim(),
          tanggal_keluhan: tanggalKeluhan,
          photos: finalUploadedPhotos,
          honeypot: honeypot,
        }),
      });

      const complaintJson = await complaintRes.json();

      if (!complaintRes.ok) {
        throw new Error(complaintJson.error || 'Gagal menyimpan laporan');
      }

      // Sukses! Tampilkan layar konfirmasi
      setSubmittedData({
        id: complaintJson.data.id,
        nomor_laporan: complaintJson.data.nomor_laporan,
        nama: complaintJson.data.nama,
        nama_barang: complaintJson.data.nama_barang,
      });
    } catch (err: any) {
      console.error('Submission failed:', err);
      setFormError(err.message || 'Terjadi kesalahan sistem saat mengirim laporan.');

      // -------------------------------------------------------------
      // LANGKAH 4: Pembersihan Foto Jika Terjadi Kegagalan di Tengah Jalan
      // -------------------------------------------------------------
      if (uploadedPaths.length > 0) {
        fetch('/api/cleanup-photos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ paths: uploadedPaths }),
        }).catch((cleanErr) => console.warn('Pembersihan gagal:', cleanErr));
      }
    } finally {
      setIsSubmitting(false);
      setUploadProgress('');
    }
  };

  const copyTicketNumber = () => {
    if (!submittedData) return;
    navigator.clipboard.writeText(submittedData.nomor_laporan);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  // ==============================================================
  // TAMPILAN 1: HALAMAN KONFIRMASI SUKSES SETELAH KIRIM LAPORAN
  // ==============================================================
  if (submittedData) {
    return (
      <div className="w-full max-w-3xl mx-auto px-4 sm:px-6 py-12">
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xl p-8 sm:p-12 text-center flex flex-col items-center">
          <div className="w-20 h-20 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mb-6 ring-8 ring-emerald-50">
            <CheckCircle2 size={44} className="stroke-[2.5]" />
          </div>

          <span className="px-3.5 py-1 rounded-full bg-kemenkes-100 text-kemenkes-900 font-bold text-xs uppercase tracking-widest border border-kemenkes-200">
            Laporan Diterima
          </span>

          <h2 className="text-3xl sm:text-4xl font-black text-slate-900 mt-4 tracking-tight">
            Laporan Berhasil Diajukan!
          </h2>

          <p className="mt-2 text-base sm:text-lg text-slate-600 max-w-lg">
            Terima kasih, <strong>{submittedData.nama}</strong>. Laporan kerusakan{' '}
            <strong>{submittedData.nama_barang}</strong> telah dicatat ke dalam sistem kendali pemeliharaan.
          </p>

          {/* Kotak Nomor Tiket Menonjol */}
          <div className="w-full max-w-md my-8 p-6 rounded-2xl bg-gradient-to-br from-kemenkes-900 to-kemenkes-800 text-white shadow-lg flex flex-col items-center gap-3">
            <span className="text-xs font-bold uppercase tracking-wider text-kemenkes-300">
              Nomor Laporan / Tiket Anda:
            </span>
            <div className="text-3xl sm:text-4xl font-mono font-black tracking-wider text-kemenkes-lime">
              #{submittedData.nomor_laporan}
            </div>
            <button
              type="button"
              onClick={copyTicketNumber}
              className="mt-2 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-sm font-semibold transition border border-white/20 active:scale-95"
            >
              {copied ? <Check size={16} className="text-kemenkes-lime" /> : <Copy size={16} />}
              <span>{copied ? 'Nomor Berhasil Disalin!' : 'Salin Nomor Laporan'}</span>
            </button>
          </div>

          {/* Navigasi Aksi */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 w-full">
            <Link
              href={`/keluhan/${submittedData.id}`}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-kemenkes-900 text-white font-bold text-base hover:bg-kemenkes-800 transition shadow-sm"
            >
              <span>Lihat Detail Laporan</span>
              <ArrowRight size={18} />
            </Link>

            <Link
              href="/"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-slate-100 text-slate-800 font-bold text-base hover:bg-slate-200 transition"
            >
              <span>Kembali ke Beranda</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ==============================================================
  // TAMPILAN 2: FORMULIR PELAPORAN RESMI
  // ==============================================================
  return (
    <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 py-10 pb-20">
      {/* Header Formulir */}
      <div className="mb-8">
        <div className="flex items-center gap-2 text-kemenkes-700 font-bold text-xs uppercase tracking-widest mb-1.5">
          <FileText size={16} />
          <span>Formulir Pengaduan Kerusakan Fasilitas Kantor</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
          Laporkan Kerusakan Fasilitas Kantor
        </h1>
        <p className="mt-2 text-base text-slate-600">
          Sampaikan data kerusakan perlengkapan kantor secara rinci agar petugas dapat menindaklanjuti dengan cepat.
        </p>
      </div>

      {formError && (
        <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 flex items-start gap-3">
          <AlertCircle size={22} className="text-red-600 shrink-0 mt-0.5" />
          <div>
            <h4 className="font-bold text-sm">Pengajuan Belum Lengkap</h4>
            <p className="text-sm mt-0.5">{formError}</p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-8">
        {/* Anti-Bot Honeypot Field (Tersembunyi) */}
        <div className="hidden" aria-hidden="true">
          <label htmlFor="website_url">Website (Jangan diisi)</label>
          <input
            id="website_url"
            name="website_url"
            type="text"
            tabIndex={-1}
            autoComplete="off"
            value={honeypot}
            onChange={(e) => setHoneypot(e.target.value)}
          />
        </div>

        {/* Bagian 1: Identitas Pelapor */}
        <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-6">
          <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
            <span className="w-8 h-8 rounded-lg bg-kemenkes-100 text-kemenkes-900 font-black flex items-center justify-center text-sm">
              1
            </span>
            <h3 className="text-xl font-bold text-slate-900">Identitas Pelapor</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Nama */}
            <div className="flex flex-col gap-2">
              <label className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                <User size={16} className="text-kemenkes-700" />
                <span>Nama Lengkap Pelapor *</span>
              </label>
              <input
                ref={namaRef}
                type="text"
                required
                value={nama}
                onChange={(e) => setNama(e.target.value)}
                placeholder="Contoh: Andi Wijaya"
                className="w-full px-4 py-3 rounded-xl border border-slate-300 text-base text-slate-900 focus:outline-none focus:ring-2 focus:ring-kemenkes-500 focus:border-transparent transition"
              />
            </div>

            {/* NIP (18 Digit) */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                  <Hash size={16} className="text-kemenkes-700" />
                  <span>NIP Pegawai (18 Digit) *</span>
                </label>
                <span
                  className={`text-xs font-mono font-bold ${
                    nip.length === 18 ? 'text-emerald-600' : 'text-slate-400'
                  }`}
                >
                  {nip.length}/18
                </span>
              </div>
              <input
                ref={nipRef}
                type="text"
                required
                maxLength={18}
                value={nip}
                onChange={handleNipChange}
                placeholder="Contoh: 123456789123456789"
                className="w-full px-4 py-3 rounded-xl border border-slate-300 text-base font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-kemenkes-500 focus:border-transparent transition"
              />
              <p className="text-xs text-slate-500">
                Hanya angka. <strong>NIP otomatis disamarkan</strong> di daftar publik demi privasi.
              </p>
            </div>
          </div>

          {/* Status Verifikasi Identitas Pegawai */}
          {nip.length === 18 && nama.trim().length >= 2 && (
            <div
              className={`flex items-start gap-2.5 p-3.5 rounded-xl border text-sm ${
                identitas.status === 'valid'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-red-50 border-red-200 text-red-800'
              }`}
            >
              {identitas.status === 'valid' ? (
                <CheckCircle2 size={18} className="shrink-0 mt-0.5" />
              ) : (
                <AlertCircle size={18} className="shrink-0 mt-0.5" />
              )}
              <span>{identitas.message}</span>
            </div>
          )}

          {/* Tim Kerja (otomatis dari data pegawai) */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
              <Building size={16} className="text-kemenkes-700" />
              <span>Tim Kerja / Bagian / Unit Organisasi</span>
              <span className="px-2 py-0.5 rounded-full bg-kemenkes-100 text-kemenkes-900 text-[10px] font-bold uppercase tracking-wider border border-kemenkes-200">
                Otomatis
              </span>
            </label>
            <div className="relative">
              <input
                ref={timKerjaRef}
                type="text"
                readOnly
                value={timKerja}
                placeholder="Terisi otomatis setelah Nama & NIP terverifikasi"
                className="w-full px-4 py-3 pr-11 rounded-xl border border-slate-300 text-base text-slate-900 bg-slate-50 cursor-not-allowed focus:outline-none transition"
              />
              <span className="absolute inset-y-0 right-0 flex items-center px-3.5 text-slate-400">
                {isIdentitasValid ? (
                  <CheckCircle2 size={18} className="text-emerald-600" />
                ) : (
                  <ShieldCheck size={18} />
                )}
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Terisi otomatis dari <strong>data pegawai resmi</strong> berdasarkan NIP &amp; nama yang terverifikasi.
            </p>
          </div>
        </div>

        {/* Bagian 2: Rincian Kerusakan & Lokasi */}
        <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-6">
          <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
            <span className="w-8 h-8 rounded-lg bg-kemenkes-100 text-kemenkes-900 font-black flex items-center justify-center text-sm">
              2
            </span>
            <h3 className="text-xl font-bold text-slate-900">Rincian Barang &amp; Lokasi</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Nama Barang */}
            <div className="flex flex-col gap-2">
              <label className="text-sm font-bold text-slate-800">Nama / Jenis Fasilitas Rusak *</label>
              <input
                ref={namaBarangRef}
                type="text"
                required
                value={namaBarang}
                onChange={(e) => setNamaBarang(e.target.value)}
                placeholder="Contoh: AC Split Daikin 2 PK / Lampu Rapat"
                className="w-full px-4 py-3 rounded-xl border border-slate-300 text-base text-slate-900 focus:outline-none focus:ring-2 focus:ring-kemenkes-500 focus:border-transparent transition"
              />
            </div>

            {/* Lokasi Ruangan */}
            <div className="flex flex-col gap-2">
              <label className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                <MapPin size={16} className="text-kemenkes-700" />
                <span>Lokasi Gedung / Ruangan *</span>
              </label>
              <input
                ref={lokasiRef}
                type="text"
                required
                value={lokasi}
                onChange={(e) => setLokasi(e.target.value)}
                placeholder="Contoh: Gedung A Lt. 3 - Ruang Rapat Melati"
                className="w-full px-4 py-3 rounded-xl border border-slate-300 text-base text-slate-900 focus:outline-none focus:ring-2 focus:ring-kemenkes-500 focus:border-transparent transition"
              />
            </div>
          </div>

          {/* Tanggal Keluhan */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                <Calendar size={16} className="text-kemenkes-700" />
                <span>Tanggal Kejadian / Temuan *</span>
              </label>
              <input
                ref={tanggalRef}
                type="date"
                required
                value={tanggalKeluhan}
                onChange={(e) => setTanggalKeluhan(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-300 text-base text-slate-900 focus:outline-none focus:ring-2 focus:ring-kemenkes-500 focus:border-transparent transition"
              />
              <span className="text-xs text-slate-500">Otomatis diisi hari ini, dapat disesuaikan bila perlu.</span>
            </div>
          </div>

          {/* Deskripsi Kerusakan */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-bold text-slate-800">
                Deskripsi Gejala Kerusakan *
              </label>
              <span className="text-xs text-slate-400">Minimal 10 karakter</span>
            </div>
            <textarea
              ref={deskripsiRef}
              required
              rows={4}
              value={deskripsi}
              onChange={(e) => setDeskripsi(e.target.value)}
              placeholder="Ceritakan kondisi kerusakan barang, suara tidak wajar, tetesan air, atau kendala operasional yang dialami..."
              className="w-full px-4 py-3 rounded-xl border border-slate-300 text-base text-slate-900 focus:outline-none focus:ring-2 focus:ring-kemenkes-500 focus:border-transparent transition"
            />
          </div>
        </div>

        {/* Bagian 3: Unggah Foto Kerusakan (Wajib 3-6 Foto) */}
        <div
          ref={photosSectionRef}
          className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-6"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <span className="w-8 h-8 rounded-lg bg-kemenkes-100 text-kemenkes-900 font-black flex items-center justify-center text-sm">
                3
              </span>
              <h3 className="text-xl font-bold text-slate-900">Bukti Foto Kerusakan</h3>
            </div>
            <span
              className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                photos.length >= MIN_PHOTO_COUNT
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                  : 'bg-amber-100 text-amber-800 border border-amber-300'
              }`}
            >
              {photos.length} dari minimal {MIN_PHOTO_COUNT} foto (Maks {MAX_PHOTO_COUNT})
            </span>
          </div>

          {/* Penjelasan Ringkas Kompresi */}
          <div className="p-4 rounded-xl bg-teal-50/70 border border-teal-200 text-teal-900 text-sm flex items-start gap-2.5">
            <ShieldCheck size={20} className="text-kemenkes-700 shrink-0 mt-0.5" />
            <p>
              Foto otomatis <strong>dikompresi di peramban Anda</strong> (maks ~1MB) sebelum diunggah langsung ke penyimpanan agar cepat dan hemat kuota.
            </p>
          </div>

          {/* Notifikasi jumlah foto */}
          {photoWarning && (
            <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm">
              <AlertTriangle size={18} className="shrink-0 mt-0.5" />
              <span>{photoWarning}</span>
            </div>
          )}

          {photos.length > 0 && photos.length < MIN_PHOTO_COUNT && (
            <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm">
              <AlertTriangle size={18} className="shrink-0 mt-0.5" />
              <span>
                Foto bukti <strong>kurang dari minimal {MIN_PHOTO_COUNT}</strong>. Anda baru
                menambahkan {photos.length} foto — tambahkan {MIN_PHOTO_COUNT - photos.length} foto
                lagi.
              </span>
            </div>
          )}

          {photos.length >= MIN_PHOTO_COUNT && photos.length < MAX_PHOTO_COUNT && (
            <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm">
              <CheckCircle2 size={18} className="shrink-0 mt-0.5" />
              <span>
                Jumlah foto sudah memenuhi syarat ({photos.length}/{MAX_PHOTO_COUNT}). Anda masih bisa
                menambah {MAX_PHOTO_COUNT - photos.length} foto lagi.
              </span>
            </div>
          )}

          {photos.length >= MAX_PHOTO_COUNT && (
            <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-sky-50 border border-sky-200 text-sky-800 text-sm">
              <AlertCircle size={18} className="shrink-0 mt-0.5" />
              <span>
                Sudah mencapai batas maksimal <strong>{MAX_PHOTO_COUNT} foto</strong>. Hapus salah satu
                foto untuk menggantinya.
              </span>
            </div>
          )}

          {/* Area Drop Zone Upload */}
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-slate-300 hover:border-kemenkes-600 hover:bg-slate-50/60 rounded-2xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              onChange={(e) => handleFiles(e.target.files)}
              className="hidden"
            />
            <div className="w-16 h-16 rounded-full bg-kemenkes-50 text-kemenkes-700 flex items-center justify-center mb-3">
              <UploadCloud size={32} />
            </div>
            <p className="text-lg font-bold text-slate-800">
              Pilih atau Tarik Berkas Foto ke Sini
            </p>
            <p className="text-sm text-slate-500 mt-1">
              Format: JPG, PNG, WEBP • Maks 5MB per berkas • Wajib {MIN_PHOTO_COUNT}–{MAX_PHOTO_COUNT} foto
            </p>
          </div>

          {isCompressing && (
            <div className="flex items-center justify-center gap-2 p-4 bg-slate-100 rounded-xl text-slate-700 text-sm font-semibold animate-pulse">
              <Loader2 size={18} className="animate-spin text-kemenkes-700" />
              <span>Sedang mengompresi foto di peramban Anda...</span>
            </div>
          )}

          {/* Galeri Pratinjau Foto */}
          {photos.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mt-2">
              {photos.map((item, index) => (
                <div
                  key={item.id}
                  className="group relative rounded-xl border border-slate-200 overflow-hidden bg-slate-50 flex flex-col shadow-sm"
                >
                  <div className="relative h-44 w-full bg-slate-200">
                    <img
                      src={item.previewUrl}
                      alt={`Foto ke-${index + 1}`}
                      decoding="async"
                      className="w-full h-full object-cover"
                    />
                    <span className="absolute top-2 left-2 px-2 py-0.5 rounded bg-black/60 text-white font-mono text-xs font-bold">
                      Foto {index + 1}
                    </span>
                    <button
                      type="button"
                      onClick={() => removePhoto(item.id)}
                      className="absolute top-2 right-2 p-1.5 rounded-full bg-red-600 hover:bg-red-700 text-white transition shadow-md"
                      title="Hapus foto ini"
                    >
                      <X size={16} />
                    </button>
                  </div>
                  <div className="p-3 bg-white flex flex-col gap-1">
                    <p className="text-xs font-semibold text-slate-800 truncate">
                      {item.file.name}
                    </p>
                    <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono">
                      <span>Asli: {formatFileSize(item.originalSize)}</span>
                      <span className="text-emerald-700 font-bold">
                        ↓ {formatFileSize(item.compressedSize)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Tombol Kirim */}
        <div className="flex justify-center sm:justify-end p-6 bg-white rounded-2xl border border-slate-200 shadow-sm">
          <button
            type="submit"
            disabled={isSubmitting || isCompressing}
            className={`w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-8 py-4 rounded-xl text-base font-black uppercase tracking-wider transition-all shadow-md ${
              isSubmitting || isCompressing
                ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                : 'bg-kemenkes-900 hover:bg-kemenkes-800 text-white hover:scale-[1.02] active:scale-[0.98]'
            }`}
          >
            {isSubmitting ? (
              <>
                <Loader2 size={20} className="animate-spin text-kemenkes-lime" />
                <span>{uploadProgress || 'Mengirim Laporan...'}</span>
              </>
            ) : (
              <>
                <span>Kirimkan Laporan</span>
                <ArrowRight size={20} />
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
