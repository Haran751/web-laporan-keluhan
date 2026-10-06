'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ArrowLeft,
  Calendar,
  User,
  Hash,
  Building,
  MapPin,
  Clock,
  CheckCircle2,
  FileText,
  AlertCircle,
  Eye,
  MessageSquare,
  Share2,
  Printer
} from 'lucide-react';
import { ComplaintPublic } from '@/types';
import { StatusBadge } from '@/components/StatusBadge';
import { PhotoLightbox } from '@/components/PhotoLightbox';
import { LoadingState } from '@/components/LoadingState';
import { formatDate } from '@/lib/utils';

export default function DetailKeluhanPage() {
  const params = useParams();
  const id = params?.id as string;

  const [complaint, setComplaint] = useState<ComplaintPublic | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Lightbox State
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  useEffect(() => {
    async function loadDetail() {
      if (!id) return;
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`/api/complaints/${id}`);
        const json = await res.json();

        if (!res.ok) {
          throw new Error(json.error || 'Laporan tidak ditemukan');
        }

        setComplaint(json.data);
      } catch (err: any) {
        setError(err.message || 'Gagal memuat rincian keluhan');
      } finally {
        setLoading(false);
      }
    }

    loadDetail();
  }, [id]);

  const openLightbox = (index: number) => {
    setLightboxIndex(index);
    setLightboxOpen(true);
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16">
        <LoadingState message="Memuat Rincian Laporan..." subMessage="Mengambil data tiket pengaduan..." />
      </div>
    );
  }

  if (error || !complaint) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center">
        <div className="p-8 bg-white border border-red-200 rounded-3xl shadow-sm flex flex-col items-center">
          <AlertCircle size={44} className="text-red-500 mb-3" />
          <h2 className="text-2xl font-black text-slate-900">Laporan Tidak Ditemukan</h2>
          <p className="mt-2 text-base text-slate-600">{error || 'Data laporan tidak tersedia.'}</p>
          <Link
            href="/"
            className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-kemenkes-900 text-white font-bold text-sm hover:bg-kemenkes-800 transition"
          >
            <ArrowLeft size={16} />
            <span>Kembali ke Daftar Laporan</span>
          </Link>
        </div>
      </div>
    );
  }

  const photos = complaint.photos || [];

  return (
    <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 py-10 pb-20">
      {/* Tombol Kembali & Aksi Header */}
      <div className="flex items-center justify-between gap-4 mb-6">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-slate-600 hover:text-kemenkes-900 font-bold text-base transition"
        >
          <ArrowLeft size={20} />
          <span>Kembali ke Daftar</span>
        </Link>

        <div className="flex items-center gap-2">
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 bg-white hover:bg-slate-50 text-sm font-semibold transition"
          >
            <Printer size={16} />
            <span className="hidden sm:inline">Cetak Dokumen</span>
          </button>
        </div>
      </div>

      {/* Kartu Detail Utama */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        {/* Header Status & No. Tiket */}
        <div className="p-6 sm:p-8 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Nomor Tiket Kerusakan
            </span>
            <div className="text-2xl sm:text-3xl font-mono font-black text-kemenkes-900 mt-0.5">
              #{complaint.nomor_laporan}
            </div>
          </div>
          <div>
            <StatusBadge status={complaint.status} size="lg" />
          </div>
        </div>

        {/* Isi Informasi Laporan */}
        <div className="p-6 sm:p-8 flex flex-col gap-8">
          {/* Uraian Barang */}
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-kemenkes-700">
              Fasilitas / Sarana Rusak
            </span>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 mt-1">
              {complaint.nama_barang}
            </h1>
          </div>

          {/* Grid Informasi Detail */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 p-5 rounded-2xl border border-slate-100">
            <div className="flex flex-col gap-1">
              <span className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1">
                <User size={14} /> Nama Pelapor
              </span>
              <span className="text-base font-bold text-slate-900">{complaint.nama}</span>
              <span className="text-xs font-mono text-slate-600">
                NIP (Disamarkan): {complaint.nip}
              </span>
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1">
                <Building size={14} /> Tim Kerja / Unit
              </span>
              <span className="text-base font-semibold text-slate-800">{complaint.tim_kerja}</span>
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1">
                <MapPin size={14} /> Lokasi Penempatan
              </span>
              <span className="text-base font-semibold text-slate-800">{complaint.lokasi}</span>
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1">
                <Calendar size={14} /> Waktu Pengaduan
              </span>
              <span className="text-base font-semibold text-slate-800">
                {formatDate(complaint.tanggal_keluhan)}
              </span>
            </div>

            {complaint.tanggal_selesai && (
              <div className="flex flex-col gap-1 sm:col-span-2 pt-2 border-t border-slate-200">
                <span className="text-xs font-bold text-emerald-700 uppercase flex items-center gap-1">
                  <CheckCircle2 size={14} /> Tanggal Penyelesaian Teknis
                </span>
                <span className="text-base font-bold text-emerald-900">
                  {formatDate(complaint.tanggal_selesai)}
                </span>
              </div>
            )}
          </div>

          {/* Deskripsi Kerusakan */}
          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700">
              Deskripsi Kerusakan
            </h3>
            <div className="p-5 rounded-2xl bg-white border border-slate-200 text-base text-slate-800 leading-relaxed whitespace-pre-wrap">
              {complaint.deskripsi}
            </div>
          </div>

          {/* Catatan Admin / Teknisi */}
          {complaint.catatan_admin ? (
            <div className="flex flex-col gap-2">
              <h3 className="text-sm font-bold uppercase tracking-wider text-kemenkes-900 flex items-center gap-1.5">
                <MessageSquare size={16} /> Catatan Petugas Pemeliharaan
              </h3>
              <div className="p-5 rounded-2xl bg-teal-50 border border-teal-200 text-teal-950 text-base leading-relaxed">
                {complaint.catatan_admin}
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-slate-500 text-sm">
              Belum ada catatan tindak lanjut dari admin sarana prasarana.
            </div>
          )}

          {/* Galeri Foto Bukti Visual */}
          <div className="flex flex-col gap-3 pt-4 border-t border-slate-200">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">
                Foto Bukti Visual ({photos.length})
              </h3>
              <span className="text-xs text-slate-500">Klik foto untuk membuka layar penuh</span>
            </div>

            {photos.length === 0 ? (
              <p className="text-sm text-slate-500 italic">Tidak ada foto terlampir.</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {photos.map((photo, idx) => (
                  <div
                    key={photo.id || idx}
                    onClick={() => openLightbox(idx)}
                    className="group relative h-48 rounded-2xl overflow-hidden bg-slate-100 border border-slate-200 cursor-pointer shadow-sm hover:shadow-md transition-all"
                  >
                    <img
                      src={photo.url}
                      alt={`Bukti kerusakan ${idx + 1}`}
                      loading={idx === 0 ? 'eager' : 'lazy'}
                      decoding="async"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                      <Eye size={28} />
                    </div>
                    <span className="absolute bottom-2 left-2 px-2 py-0.5 rounded bg-black/60 text-white font-mono text-xs font-bold">
                      Foto {idx + 1}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Lightbox Modal */}
      <PhotoLightbox
        isOpen={lightboxOpen}
        photos={photos}
        initialIndex={lightboxIndex}
        onClose={() => setLightboxOpen(false)}
      />
    </div>
  );
}
