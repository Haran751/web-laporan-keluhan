'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  FileSpreadsheet,
  Download,
  Search,
  Calendar,
  RotateCcw,
  Edit3,
  Trash2,
  Eye,
  AlertTriangle,
  Clock,
  Wrench,
  CheckCircle2,
  X,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Building,
  User,
  Hash,
  MessageSquare
} from 'lucide-react';
import { ComplaintAdmin, ComplaintStats, ComplaintStatus } from '@/types';
import { StatusBadge } from '@/components/StatusBadge';
import { LoadingState } from '@/components/LoadingState';
import { EmptyState } from '@/components/EmptyState';
import { formatDate, downloadComplaintsCsv } from '@/lib/utils';

export default function AdminDashboardPage() {
  const [complaints, setComplaints] = useState<ComplaintAdmin[]>([]);
  const [stats, setStats] = useState<ComplaintStats>({
    total: 0,
    menunggu: 0,
    diproses: 0,
    selesai: 0,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Debounce pencarian 300ms — mencegah satu request API per huruf yang diketik.
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Modal Update State
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedComplaint, setSelectedComplaint] = useState<ComplaintAdmin | null>(null);
  const [editStatus, setEditStatus] = useState<ComplaintStatus>('menunggu');
  const [editTanggalSelesai, setEditTanggalSelesai] = useState<string>('');
  const [editCatatan, setEditCatatan] = useState<string>('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);

  // Modal Delete State
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [complaintToDelete, setComplaintToDelete] = useState<ComplaintAdmin | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchAdminComplaints = useCallback(async () => {
    try {
      setRefreshing(true);
      setError(null);

      const params = new URLSearchParams();
      if (debouncedSearch.trim()) params.append('search', debouncedSearch.trim());
      if (statusFilter && statusFilter !== 'all') params.append('status', statusFilter);
      if (startDate) params.append('start_date', startDate);
      if (endDate) params.append('end_date', endDate);
      params.append('page', page.toString());
      params.append('limit', '15');

      const res = await fetch(`/api/admin/complaints?${params.toString()}`);
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
      setError(err.message || 'Terjadi kesalahan');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [debouncedSearch, statusFilter, startDate, endDate, page]);

  useEffect(() => {
    fetchAdminComplaints();
  }, [fetchAdminComplaints]);

  // Open Edit Modal
  const openEditModal = (c: ComplaintAdmin) => {
    setSelectedComplaint(c);
    setEditStatus(c.status);
    setEditTanggalSelesai(c.tanggal_selesai || '');
    setEditCatatan(c.catatan_admin || '');
    setUpdateError(null);
    setEditModalOpen(true);
  };

  // Status Change Handler with Auto-Date Logic
  const handleStatusChange = (newStatus: ComplaintStatus) => {
    setEditStatus(newStatus);
    if (newStatus === 'selesai' && !editTanggalSelesai) {
      // Otomatis: jika status diubah ke Selesai dan tanggal selesai kosong, isi hari ini
      const today = new Date().toISOString().split('T')[0];
      setEditTanggalSelesai(today);
    } else if (newStatus !== 'selesai' && editTanggalSelesai) {
      setEditTanggalSelesai('');
    }
  };

  // Submit Update
  const handleUpdateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedComplaint) return;

    setUpdateError(null);

    // Validasi: tanggal selesai tidak boleh sebelum tanggal keluhan
    if (editStatus === 'selesai' && editTanggalSelesai) {
      if (new Date(editTanggalSelesai) < new Date(selectedComplaint.tanggal_keluhan)) {
        setUpdateError('Tanggal penyelesaian tidak boleh mendahului tanggal keluhan dilaporkan.');
        return;
      }
    }

    setIsUpdating(true);

    try {
      const res = await fetch(`/api/complaints/${selectedComplaint.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: editStatus,
          tanggal_selesai: editTanggalSelesai || null,
          catatan_admin: editCatatan.trim() || null,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Gagal memperbarui status');
      }

      setEditModalOpen(false);
      fetchAdminComplaints();
    } catch (err: any) {
      setUpdateError(err.message || 'Gagal menyimpan perubahan');
    } finally {
      setIsUpdating(false);
    }
  };

  // Confirm Delete
  const handleDeleteConfirm = async () => {
    if (!complaintToDelete) return;
    setIsDeleting(true);

    try {
      const res = await fetch(`/api/complaints/${complaintToDelete.id}`, {
        method: 'DELETE',
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Gagal menghapus laporan');
      }

      setDeleteModalOpen(false);
      setComplaintToDelete(null);
      fetchAdminComplaints();
    } catch (err: any) {
      alert(`Gagal menghapus: ${err.message}`);
    } finally {
      setIsDeleting(false);
    }
  };

  // Ekspor CSV
  const handleExportCsv = () => {
    if (complaints.length === 0) {
      alert('Tidak ada data yang dapat diekspor sesuai saringan saat ini.');
      return;
    }

    const exportData = complaints.map((c) => ({
      nomor_laporan: c.nomor_laporan,
      tanggal_keluhan: c.tanggal_keluhan,
      nama: c.nama,
      nip: c.nip, // Full unmasked NIP
      tim_kerja: c.tim_kerja,
      nama_barang: c.nama_barang,
      lokasi: c.lokasi,
      status: c.status,
      tanggal_selesai: c.tanggal_selesai,
      deskripsi: c.deskripsi,
      catatan_admin: c.catatan_admin,
      foto_urls: (c.photos || []).map((p) => p.url).join(' ; '),
    }));

    const filename = `arsip-kerusakan-bmn-${new Date().toISOString().split('T')[0]}.csv`;
    downloadComplaintsCsv(exportData, filename);
  };

  return (
    <div className="flex flex-col gap-8 pb-16">
      {/* 1. Header & Statistik Ringkas */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">
            Penanganan Pengaduan Kerusakan Fasilitas Kantor
          </h1>
          <p className="text-base text-slate-600 mt-1">
            Pusat kendali, validasi status, dan inventarisasi aduan sarana prasarana dinas.
          </p>
        </div>

        {/* Tombol Ekspor CSV */}
        <button
          onClick={handleExportCsv}
          disabled={complaints.length === 0}
          className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-kemenkes-900 hover:bg-kemenkes-800 text-white font-bold text-sm shadow-md transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Download size={18} className="text-kemenkes-lime" />
          <span>Ekspor CSV (Excel UTF-8)</span>
        </button>
      </div>

      {/* Grid Statistik */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase text-slate-500">Semua Laporan</p>
            <p className="text-3xl font-black text-slate-900 mt-1">{stats.total}</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700">
            <FileSpreadsheet size={24} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-amber-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase text-amber-700">Menunggu Respon</p>
            <p className="text-3xl font-black text-amber-900 mt-1">{stats.menunggu}</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center text-amber-700">
            <Clock size={24} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-sky-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase text-sky-700">Dalam Penanganan</p>
            <p className="text-3xl font-black text-sky-900 mt-1">{stats.diproses}</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-sky-50 flex items-center justify-center text-sky-700">
            <Wrench size={24} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-emerald-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase text-emerald-700">Tuntas Selesai</p>
            <p className="text-3xl font-black text-emerald-900 mt-1">{stats.selesai}</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-700">
            <CheckCircle2 size={24} />
          </div>
        </div>
      </div>

      {/* 2. Filter Bar */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-4">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
          {/* Status Tabs */}
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
                  className={`px-3.5 py-1.5 rounded-lg text-sm font-bold transition-all ${
                    isActive
                      ? 'bg-kemenkes-900 text-white shadow-sm'
                      : 'text-slate-700 hover:text-slate-900'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span
                    className={`ml-1.5 text-xs px-2 py-0.5 rounded-full ${
                      isActive ? 'bg-kemenkes-400 text-slate-950 font-black' : 'bg-slate-200'
                    }`}
                  >
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Quick Search */}
          <div className="flex-1 max-w-md relative">
            <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Cari NIP, pelapor, tiket, barang, unit..."
              className="w-full pl-10 pr-10 py-2 rounded-xl border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-kemenkes-500"
            />
            {search && (
              <button
                onClick={() => {
                  setSearch('');
                  setPage(1);
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
              >
                <X size={16} />
              </button>
            )}
          </div>
        </div>

        {/* Date Filter & Reset */}
        <div className="flex flex-wrap items-center justify-between gap-4 pt-3 border-t border-slate-100 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-600">Rentang Tanggal:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setPage(1);
              }}
              className="px-2.5 py-1 rounded-lg border border-slate-300 text-xs text-slate-800"
            />
            <span className="text-slate-400">—</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setPage(1);
              }}
              className="px-2.5 py-1 rounded-lg border border-slate-300 text-xs text-slate-800"
            />
          </div>

          <div className="flex items-center gap-3">
            {(search || statusFilter !== 'all' || startDate || endDate) && (
              <button
                onClick={() => {
                  setSearch('');
                  setDebouncedSearch('');
                  setStatusFilter('all');
                  setStartDate('');
                  setEndDate('');
                  setPage(1);
                }}
                className="text-kemenkes-700 hover:text-kemenkes-900 font-bold flex items-center gap-1"
              >
                <RotateCcw size={14} />
                <span>Reset Saringan</span>
              </button>
            )}
            <span className="text-slate-500">
              Total {totalCount} laporan tercatat
            </span>
          </div>
        </div>
      </div>

      {/* 3. Tabel Data Laporan (Dengan NIP LENGKAP) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <LoadingState message="Memuat Data Admin..." subMessage="Mengambil log laporan dan foto..." />
        ) : error && complaints.length === 0 ? (
          <div className="p-8 text-center text-red-600">
            <p className="font-bold">{error}</p>
          </div>
        ) : complaints.length === 0 ? (
          <EmptyState
            title="Tidak Ada Laporan"
            description="Tidak ada data yang cocok dengan kriteria pencarian admin saat ini."
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-100/90 text-slate-800 font-bold uppercase tracking-wider text-xs border-b border-slate-200">
                    <th className="py-3.5 px-4">No. Laporan</th>
                    <th className="py-3.5 px-4">Tgl Masuk</th>
                    <th className="py-3.5 px-4">Pelapor &amp; NIP Lengkap</th>
                    <th className="py-3.5 px-4">Unit Kerja</th>
                    <th className="py-3.5 px-4">Fasilitas Rusak</th>
                    <th className="py-3.5 px-4">Lokasi</th>
                    <th className="py-3.5 px-4 text-center">Status</th>
                    <th className="py-3.5 px-4">Tgl Selesai</th>
                    <th className="py-3.5 px-4 text-right">Tindakan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {complaints.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-bold text-kemenkes-900 whitespace-nowrap">
                        <Link href={`/keluhan/${item.id}`} target="_blank" className="hover:underline">
                          #{item.nomor_laporan}
                        </Link>
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap text-slate-600">
                        {formatDate(item.tanggal_keluhan)}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="font-bold text-slate-900 block">{item.nama}</span>
                        {/* PENTING: NIP LENGKAP DITAMPILKAN DI ADMIN */}
                        <span className="font-mono text-xs font-bold text-kemenkes-800 bg-kemenkes-50 px-1.5 py-0.5 rounded border border-kemenkes-200 inline-block mt-0.5">
                          {item.nip}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-700 whitespace-nowrap">
                        {item.tim_kerja}
                      </td>
                      <td className="py-3.5 px-4 max-w-xs">
                        <div className="font-bold text-slate-900 truncate">{item.nama_barang}</div>
                        <p className="text-xs text-slate-500 line-clamp-1">{item.deskripsi}</p>
                      </td>
                      <td className="py-3.5 px-4 text-slate-700 max-w-[150px] truncate">
                        {item.lokasi}
                      </td>
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <StatusBadge status={item.status} size="sm" />
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap text-slate-600">
                        {item.tanggal_selesai ? formatDate(item.tanggal_selesai) : '—'}
                      </td>
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          {/* Tombol Edit / Update Status */}
                          <button
                            onClick={() => openEditModal(item)}
                            className="p-1.5 rounded-lg bg-teal-50 hover:bg-teal-100 text-teal-800 transition"
                            title="Tindak lanjut / Ubah status"
                          >
                            <Edit3 size={16} />
                          </button>

                          {/* Tombol Lihat Detail Publik */}
                          <Link
                            href={`/keluhan/${item.id}`}
                            target="_blank"
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
                            title="Lihat rincian & foto"
                          >
                            <Eye size={16} />
                          </Link>

                          {/* Tombol Hapus */}
                          <button
                            onClick={() => {
                              setComplaintToDelete(item);
                              setDeleteModalOpen(true);
                            }}
                            className="p-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 transition"
                            title="Hapus laporan & foto"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between p-4 bg-slate-50 border-t border-slate-200 text-sm">
                <span className="text-slate-600">
                  Halaman <strong>{page}</strong> dari <strong>{totalPages}</strong>
                </span>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="p-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-40"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="p-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-40"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* 4. MODAL DIALOG: TINDAK LANJUT & UBAH STATUS */}
      {editModalOpen && selectedComplaint && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-8 shadow-2xl flex flex-col gap-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Edit3 size={20} className="text-kemenkes-700" />
                <h3 className="text-xl font-bold text-slate-900">
                  Tindak Lanjut Laporan #{selectedComplaint.nomor_laporan}
                </h3>
              </div>
              <button
                onClick={() => setEditModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700"
              >
                <X size={20} />
              </button>
            </div>

            {updateError && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
                {updateError}
              </div>
            )}

            <form onSubmit={handleUpdateSubmit} className="flex flex-col gap-5">
              {/* Info Singkat Objek */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-sm flex flex-col gap-1">
                <p className="font-bold text-slate-900">{selectedComplaint.nama_barang}</p>
                <p className="text-slate-600">Pelapor: {selectedComplaint.nama} (NIP: {selectedComplaint.nip})</p>
                <p className="text-slate-500">Tgl Lapor: {formatDate(selectedComplaint.tanggal_keluhan)}</p>
              </div>

              {/* Status Selector */}
              <div className="flex flex-col gap-2">
                <label className="text-sm font-bold text-slate-800">Status Penanganan</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['menunggu', 'diproses', 'selesai'] as ComplaintStatus[]).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => handleStatusChange(s)}
                      className={`py-2.5 px-3 rounded-xl text-sm font-bold capitalize border transition-all ${
                        editStatus === s
                          ? s === 'menunggu'
                            ? 'bg-amber-500 text-white border-amber-600 shadow-sm'
                            : s === 'diproses'
                            ? 'bg-sky-600 text-white border-sky-700 shadow-sm'
                            : 'bg-emerald-600 text-white border-emerald-700 shadow-sm'
                          : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tanggal Selesai (Aktif jika status selesai atau ingin diatur) */}
              <div className="flex flex-col gap-2">
                <label className="text-sm font-bold text-slate-800 flex items-center justify-between">
                  <span>Tanggal Penyelesaian Teknis</span>
                  {editStatus === 'selesai' && (
                    <span className="text-xs text-kemenkes-700 font-normal">
                      (Otomatis terisi tanggal hari ini)
                    </span>
                  )}
                </label>
                <input
                  type="date"
                  value={editTanggalSelesai}
                  onChange={(e) => setEditTanggalSelesai(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-kemenkes-500"
                />
                <span className="text-xs text-slate-500">
                  Tidak boleh lebih awal dari tanggal keluhan ({formatDate(selectedComplaint.tanggal_keluhan)}).
                </span>
              </div>

              {/* Catatan Petugas */}
              <div className="flex flex-col gap-2">
                <label className="text-sm font-bold text-slate-800">
                  Catatan Petugas / Teknisi Sarpras
                </label>
                <textarea
                  rows={3}
                  value={editCatatan}
                  onChange={(e) => setEditCatatan(e.target.value)}
                  placeholder="Misal: Teknisi telah memeriksa unit, modul kontrol diganti dan berfungsi normal kembali..."
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-kemenkes-500"
                />
              </div>

              {/* Tombol Aksi Modal */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-100"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isUpdating}
                  className="px-6 py-2.5 rounded-xl bg-kemenkes-900 hover:bg-kemenkes-800 text-white font-bold text-sm shadow-md transition flex items-center gap-2"
                >
                  {isUpdating && <Loader2 size={16} className="animate-spin text-kemenkes-lime" />}
                  <span>Simpan Perubahan</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. MODAL DIALOG: KONFIRMASI HAPUS */}
      {deleteModalOpen && complaintToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl flex flex-col items-center text-center">
            <div className="w-16 h-16 rounded-full bg-red-100 text-red-600 flex items-center justify-center mb-4">
              <AlertTriangle size={32} />
            </div>

            <h3 className="text-xl font-bold text-slate-900">Hapus Laporan Ini?</h3>
            <p className="text-sm text-slate-600 mt-2">
              Laporan <strong>#{complaintToDelete.nomor_laporan}</strong> ({complaintToDelete.nama_barang}) beserta seluruh berkas fotonya di Supabase Storage akan <strong>dihapus secara permanen</strong>.
            </p>

            <div className="flex items-center justify-center gap-3 mt-6 w-full">
              <button
                type="button"
                onClick={() => setDeleteModalOpen(false)}
                className="flex-1 py-2.5 px-4 rounded-xl border border-slate-300 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                disabled={isDeleting}
                className="flex-1 py-2.5 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-bold transition flex items-center justify-center gap-2"
              >
                {isDeleting && <Loader2 size={16} className="animate-spin" />}
                <span>Hapus Permanen</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
