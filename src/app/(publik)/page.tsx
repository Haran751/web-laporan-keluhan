'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Search,
  Calendar,
  RotateCcw,
  PlusCircle,
  Eye,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  CheckCircle2,
  Clock,
  Wrench,
  X,
  FileSpreadsheet,
  Loader2
} from 'lucide-react';
import { ComplaintPublic, ComplaintStats } from '@/types';
import { StatusBadge } from '@/components/StatusBadge';
import { LoadingState } from '@/components/LoadingState';
import { EmptyState } from '@/components/EmptyState';
import { formatDate } from '@/lib/utils';

export default function HomePage() {
  const [complaints, setComplaints] = useState<ComplaintPublic[]>([]);
  const [stats, setStats] = useState<ComplaintStats>({
    total: 0,
    menunggu: 0,
    diproses: 0,
    selesai: 0,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filter States
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Debounce pencarian 300ms. Tanpa ini setiap huruf yang diketik langsung
  // memicu satu request API (search jadi dependency dari fetchComplaints).
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchComplaints = useCallback(async () => {
    try {
      setRefreshing(true);
      setError(null);

      const params = new URLSearchParams();
      if (debouncedSearch.trim()) params.append('search', debouncedSearch.trim());
      if (statusFilter && statusFilter !== 'all') params.append('status', statusFilter);
      if (startDate) params.append('start_date', startDate);
      if (endDate) params.append('end_date', endDate);
      params.append('page', page.toString());
      params.append('limit', '10');

      const res = await fetch(`/api/complaints?${params.toString()}`);
      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || 'Gagal memuat data keluhan');
      }

      setComplaints(json.data || []);
      setTotalPages(json.pagination?.totalPages || 1);
      setTotalCount(json.pagination?.total || 0);
      if (json.stats) {
        setStats(json.stats);
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Terjadi kesalahan jaringan.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [debouncedSearch, statusFilter, startDate, endDate, page]);

  useEffect(() => {
    fetchComplaints();
  }, [fetchComplaints]);

  const handleResetFilters = () => {
    setSearch('');
    setDebouncedSearch('');
    setStatusFilter('all');
    setStartDate('');
    setEndDate('');
    setPage(1);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    // Flush debounce langsung, tanpa memicu fetch kedua.
    setDebouncedSearch(search);
  };

  return (
    <div className="w-full pb-16">
      {/* 1. Header Banner & Statistik Ringkas */}
      <section className="w-full bg-gradient-to-r from-kemenkes-900 via-kemenkes-800 to-kemenkes-700 text-white py-12 px-4 sm:px-6 lg:px-8 shadow-md">
        <div className="max-w-7xl mx-auto flex flex-col lg:flex-row lg:items-center justify-between gap-8">
          <div className="flex flex-col gap-3 max-w-2xl">
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight leading-tight">
              Daftar Pengaduan Kerusakan Fasilitas Kantor
            </h1>
            <p className="text-base sm:text-lg text-teal-50 leading-relaxed font-normal">
              Pantau status penanganan dan tindak lanjut perbaikan sarana prasarana kerja aparatur secara terpadu.
            </p>
          </div>

          {/* Quick Action Button */}
          <div className="flex flex-wrap items-center gap-4 shrink-0">
            <Link
              href="/lapor"
              className="inline-flex items-center gap-2.5 px-6 py-3.5 rounded-xl bg-kemenkes-lime text-slate-950 text-base sm:text-lg font-black hover:bg-lime-400 transition shadow-lg hover:scale-[1.02] active:scale-[0.98]"
            >
              <PlusCircle size={22} className="stroke-[2.5]" />
              <span>Laporkan Kerusakan</span>
            </Link>
          </div>
        </div>
      </section>

      {/* 2. Kartu Statistik Ringkas */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Total Aduan</p>
              <p className="text-2xl sm:text-3xl font-black text-slate-900 mt-1">{stats.total}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700">
              <FileSpreadsheet size={24} />
            </div>
          </div>

          <div className="bg-white p-5 rounded-xl border border-amber-200 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-amber-700">Menunggu</p>
              <p className="text-2xl sm:text-3xl font-black text-amber-900 mt-1">{stats.menunggu}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center text-amber-700">
              <Clock size={24} />
            </div>
          </div>

          <div className="bg-white p-5 rounded-xl border border-sky-200 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-sky-700">Diproses</p>
              <p className="text-2xl sm:text-3xl font-black text-sky-900 mt-1">{stats.diproses}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-sky-50 flex items-center justify-center text-sky-700">
              <Wrench size={24} />
            </div>
          </div>

          <div className="bg-white p-5 rounded-xl border border-emerald-200 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-emerald-700">Selesai</p>
              <p className="text-2xl sm:text-3xl font-black text-emerald-900 mt-1">{stats.selesai}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-700">
              <CheckCircle2 size={24} />
            </div>
          </div>
        </div>
      </div>

      {/* 3. Filter & Pencarian */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-5">
          {/* Baris Pertama: Tab Status & Search Box */}
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
            {/* Status Pills */}
            <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100 rounded-xl">
              {[
                { key: 'all', label: 'Semua', count: stats.total },
                { key: 'menunggu', label: 'Menunggu', count: stats.menunggu },
                { key: 'diproses', label: 'Diproses', count: stats.diproses },
                { key: 'selesai', label: 'Selesai', count: stats.selesai },
              ].map((tab) => {
                const isActive = statusFilter === tab.key;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => {
                      setStatusFilter(tab.key);
                      setPage(1);
                    }}
                    className={`px-4 py-2 rounded-lg text-sm sm:text-base font-bold transition-all ${
                      isActive
                        ? 'bg-kemenkes-900 text-white shadow-sm'
                        : 'text-slate-700 hover:text-slate-900 hover:bg-white/80'
                    }`}
                  >
                    <span>{tab.label}</span>
                    <span
                      className={`ml-2 text-xs px-2 py-0.5 rounded-full ${
                        isActive
                          ? 'bg-kemenkes-400 text-slate-950 font-black'
                          : 'bg-slate-200 text-slate-700'
                      }`}
                    >
                      {tab.count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Kotak Pencarian */}
            <form onSubmit={handleSearchSubmit} className="flex-1 max-w-lg relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Search size={20} />
              </div>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari no. tiket, pelapor, tim, barang, lokasi..."
                className="w-full pl-11 pr-10 py-2.5 rounded-xl border border-slate-300 text-base text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-kemenkes-500 focus:border-transparent transition"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => {
                    setSearch('');
                    setPage(1);
                  }}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-700"
                >
                  <X size={18} />
                </button>
              )}
            </form>
          </div>

          {/* Baris Kedua: Filter Rentang Tanggal & Tombol Reset */}
          <div className="flex flex-wrap items-center justify-between gap-4 pt-3 border-t border-slate-100 text-sm">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 text-slate-700 font-semibold">
                <Calendar size={18} className="text-kemenkes-700" />
                <span>Rentang Tanggal:</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    setPage(1);
                  }}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-kemenkes-500"
                />
                <span className="text-slate-400">—</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value);
                    setPage(1);
                  }}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-kemenkes-500"
                />
              </div>
            </div>

            <div className="flex items-center gap-3">
              {(search || statusFilter !== 'all' || startDate || endDate) && (
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="inline-flex items-center gap-1.5 text-sm font-bold text-kemenkes-700 hover:text-kemenkes-900 transition"
                >
                  <RotateCcw size={16} />
                  <span>Reset Saringan</span>
                </button>
              )}
              <span className="text-slate-600 font-medium text-sm">
                Menampilkan <strong className="text-slate-900">{complaints.length}</strong> dari{' '}
                <strong className="text-slate-900">{totalCount}</strong> laporan
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Daftar Laporan (Tabel Desktop & Kartu Mobile) */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
        {/* Refresh ringan: data lama tetap tampil, tidak diganti skeleton penuh */}
        {refreshing && !loading && (
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-kemenkes-700">
            <Loader2 size={15} className="animate-spin" />
            <span>Memperbarui data...</span>
          </div>
        )}
        {loading ? (
          <LoadingState message="Memuat Data Pengaduan..." subMessage="Menghubungkan ke basis data..." />
        ) : error && complaints.length === 0 ? (
          <div className="p-8 text-center bg-red-50 border border-red-200 rounded-2xl text-red-800">
            <AlertCircle size={36} className="mx-auto mb-2 text-red-600" />
            <h3 className="text-lg font-bold">Terjadi Kesalahan</h3>
            <p className="mt-1 text-sm text-red-700">{error}</p>
            <button
              onClick={() => fetchComplaints()}
              className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition"
            >
              Muat Ulang
            </button>
          </div>
        ) : complaints.length === 0 ? (
          <EmptyState
            title="Tidak Ada Laporan Ditemukan"
            description="Belum ada keluhan yang sesuai dengan saringan atau kata kunci Anda."
            actionText="Laporkan Kerusakan Baru"
            actionHref="/lapor"
          />
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            {/* Desktop Table View */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-100/90 text-slate-800 text-sm font-bold uppercase tracking-wider border-b border-slate-200">
                    <th className="py-4 px-5">No. Laporan</th>
                    <th className="py-4 px-5">Tgl Keluhan</th>
                    <th className="py-4 px-5">Pelapor &amp; NIP</th>
                    <th className="py-4 px-5">Tim Kerja</th>
                    <th className="py-4 px-5">Fasilitas Rusak</th>
                    <th className="py-4 px-5">Lokasi</th>
                    <th className="py-4 px-5 text-center">Status</th>
                    <th className="py-4 px-5">Tgl Selesai</th>
                    <th className="py-4 px-5 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-base">
                  {complaints.map((item) => (
                    <tr
                      key={item.id}
                      className="hover:bg-teal-50/50 transition-colors group"
                    >
                      <td className="py-4 px-5 font-mono font-bold text-kemenkes-900 whitespace-nowrap">
                        <Link
                          href={`/keluhan/${item.id}`}
                          className="hover:underline flex items-center gap-1.5"
                        >
                          #{item.nomor_laporan}
                        </Link>
                      </td>
                      <td className="py-4 px-5 whitespace-nowrap text-slate-600">
                        {formatDate(item.tanggal_keluhan)}
                      </td>
                      <td className="py-4 px-5">
                        <span className="font-semibold text-slate-900 block">{item.nama}</span>
                        <span className="text-xs font-mono text-slate-600 block">
                          NIP: {item.nip}
                        </span>
                      </td>
                      <td className="py-4 px-5 text-slate-700 whitespace-nowrap">
                        {item.tim_kerja}
                      </td>
                      <td className="py-4 px-5 max-w-xs">
                        <div className="font-bold text-slate-900 truncate">{item.nama_barang}</div>
                        <p className="text-xs text-slate-600 line-clamp-1 mt-0.5">{item.deskripsi}</p>
                      </td>
                      <td className="py-4 px-5 text-slate-700 max-w-[180px] truncate">
                        {item.lokasi}
                      </td>
                      <td className="py-4 px-5 text-center whitespace-nowrap">
                        <StatusBadge status={item.status} size="sm" />
                      </td>
                      <td className="py-4 px-5 whitespace-nowrap text-slate-600">
                        {item.tanggal_selesai ? formatDate(item.tanggal_selesai) : '—'}
                      </td>
                      <td className="py-4 px-5 text-right whitespace-nowrap">
                        <Link
                          href={`/keluhan/${item.id}`}
                          className="inline-flex items-center gap-1 px-3.5 py-1.5 rounded-lg bg-kemenkes-50 hover:bg-kemenkes-100 text-kemenkes-900 font-semibold text-sm transition border border-kemenkes-200"
                        >
                          <Eye size={16} />
                          <span>Rincian</span>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="lg:hidden divide-y divide-slate-100">
              {complaints.map((item) => (
                <div key={item.id} className="p-4 sm:p-5 flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-kemenkes-900 text-base">
                      #{item.nomor_laporan}
                    </span>
                    <StatusBadge status={item.status} size="sm" />
                  </div>

                  <div>
                    <h4 className="text-lg font-bold text-slate-900">{item.nama_barang}</h4>
                    <p className="text-sm text-slate-600 line-clamp-2 mt-1">{item.deskripsi}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <div>
                      <span className="text-slate-600 font-bold block">Pelapor:</span>
                      <span className="font-semibold text-slate-800">{item.nama}</span>
                      <span className="text-slate-600 font-mono block">NIP: {item.nip}</span>
                    </div>
                    <div>
                      <span className="text-slate-600 font-bold block">Lokasi:</span>
                      <span className="font-semibold text-slate-800">{item.lokasi}</span>
                      <span className="text-slate-600 block">{item.tim_kerja}</span>
                    </div>
                    <div>
                      <span className="text-slate-600 font-bold block">Tgl Masuk:</span>
                      <span>{formatDate(item.tanggal_keluhan)}</span>
                    </div>
                    <div>
                      <span className="text-slate-600 font-bold block">Tgl Selesai:</span>
                      <span>{item.tanggal_selesai ? formatDate(item.tanggal_selesai) : '—'}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-end pt-1">
                    <Link
                      href={`/keluhan/${item.id}`}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-kemenkes-900 text-white font-semibold text-sm hover:bg-kemenkes-800 transition"
                    >
                      <Eye size={16} />
                      <span>Lihat Rincian Laporan</span>
                    </Link>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-5 bg-slate-50/70 border-t border-slate-200">
                <span className="text-sm text-slate-600 font-medium">
                  Halaman <strong className="text-slate-900">{page}</strong> dari{' '}
                  <strong className="text-slate-900">{totalPages}</strong>
                </span>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="inline-flex items-center gap-1 px-4 py-2 rounded-lg border border-slate-300 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
                  >
                    <ChevronLeft size={16} />
                    <span>Sebelumnya</span>
                  </button>

                  <div className="hidden sm:flex items-center gap-1">
                    {Array.from({ length: totalPages }, (_, i) => i + 1)
                      .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
                      .map((p, idx, arr) => {
                        const prev = arr[idx - 1];
                        return (
                          <React.Fragment key={p}>
                            {prev && p - prev > 1 && <span className="px-2 text-slate-400">...</span>}
                            <button
                              onClick={() => setPage(p)}
                              className={`w-9 h-9 rounded-lg text-sm font-bold transition ${
                                p === page
                                  ? 'bg-kemenkes-900 text-white'
                                  : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50'
                              }`}
                            >
                              {p}
                            </button>
                          </React.Fragment>
                        );
                      })}
                  </div>

                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="inline-flex items-center gap-1 px-4 py-2 rounded-lg border border-slate-300 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
                  >
                    <span>Berikutnya</span>
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
