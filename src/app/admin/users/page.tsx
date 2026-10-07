'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  Users,
  UserPlus,
  Trash2,
  Mail,
  Lock,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  Loader2,
  X,
  AlertTriangle,
  Eye,
  EyeOff
} from 'lucide-react';
import { AdminUser } from '@/types';
import { formatDate } from '@/lib/utils';
import { LoadingState } from '@/components/LoadingState';

export default function AdminUsersPage() {
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal Add Admin State
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  // Modal Delete Admin State
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [adminToDelete, setAdminToDelete] = useState<AdminUser | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Load Current User ID
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setCurrentUserId(user.id);
      }
    });
  }, []);

  const fetchAdmins = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/admin/users');
      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || 'Gagal memuat daftar admin');
      }

      setAdmins(json.data || []);
    } catch (err: any) {
      setError(err.message || 'Terjadi kesalahan');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAdmins();
  }, [fetchAdmins]);

  // Handle Add Admin
  const handleAddAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    if (newPassword.length < 8) {
      setFormError('Kata sandi harus minimal 8 karakter');
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: newEmail.trim(),
          password: newPassword,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || 'Gagal menambahkan admin');
      }

      setFormSuccess('Admin baru berhasil dibuat dan didaftarkan.');
      setNewEmail('');
      setNewPassword('');
      setShowNewPassword(false);
      setTimeout(() => {
        setAddModalOpen(false);
        setFormSuccess(null);
        fetchAdmins();
      }, 1500);
    } catch (err: any) {
      setFormError(err.message || 'Gagal menambahkan admin baru');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Delete Admin
  const handleDeleteAdmin = async () => {
    if (!adminToDelete) return;

    if (adminToDelete.id === currentUserId) {
      alert('Anda tidak dapat menghapus akun Anda sendiri.');
      return;
    }

    setIsDeleting(true);

    try {
      const res = await fetch(`/api/admin/users?id=${adminToDelete.id}`, {
        method: 'DELETE',
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || 'Gagal menghapus admin');
      }

      setDeleteModalOpen(false);
      setAdminToDelete(null);
      fetchAdmins();
    } catch (err: any) {
      alert(`Gagal menghapus admin: ${err.message}`);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="flex flex-col gap-8 pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">
            Manajemen Administrator
          </h1>
          <p className="text-base text-slate-600 mt-1">
            Kelola akun petugas yang berwenang menindaklanjuti dan memutakhirkan laporan sarpras.
          </p>
        </div>

        <button
          onClick={() => {
            setFormError(null);
            setFormSuccess(null);
            setShowNewPassword(false);
            setAddModalOpen(true);
          }}
          className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-kemenkes-900 hover:bg-kemenkes-800 text-white font-bold text-sm shadow-md transition"
        >
          <UserPlus size={18} className="text-kemenkes-lime" />
          <span>Tambah Admin Baru</span>
        </button>
      </div>

      {/* Tabel Admin */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <LoadingState message="Memuat Akun Administrator..." />
        ) : error ? (
          <div className="p-8 text-center text-red-600 font-bold">{error}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-slate-100/90 text-slate-800 font-bold uppercase tracking-wider text-xs border-b border-slate-200">
                  <th className="py-4 px-6">Email Administrator</th>
                  <th className="py-4 px-6">Status Akses</th>
                  <th className="py-4 px-6">Tanggal Didaftarkan</th>
                  <th className="py-4 px-6 text-right">Tindakan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-base">
                {admins.map((adm) => {
                  const isSelf = adm.id === currentUserId;
                  return (
                    <tr key={adm.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-4 px-6 font-semibold text-slate-900">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-kemenkes-100 text-kemenkes-900 flex items-center justify-center font-bold text-xs">
                            {adm.email.substring(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <span className="block">{adm.email}</span>
                            {isSelf && (
                              <span className="text-xs font-bold text-kemenkes-700 bg-kemenkes-50 px-2 py-0.5 rounded border border-kemenkes-200">
                                Akun Anda Saat Ini
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-900 border border-emerald-300">
                          <ShieldCheck size={14} />
                          <span>Admin Resmi</span>
                        </span>
                      </td>
                      <td className="py-4 px-6 text-slate-600 text-sm">
                        {formatDate(adm.created_at, true)}
                      </td>
                      <td className="py-4 px-6 text-right">
                        {isSelf ? (
                          <span className="text-xs text-slate-400 font-medium italic">
                            Tidak dapat dihapus
                          </span>
                        ) : (
                          <button
                            onClick={() => {
                              setAdminToDelete(adm);
                              setDeleteModalOpen(true);
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 font-semibold text-xs transition"
                            title="Hapus akun admin ini"
                          >
                            <Trash2 size={15} />
                            <span>Hapus</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL: TAMBAH ADMIN BARU */}
      {addModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl flex flex-col gap-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <UserPlus size={20} className="text-kemenkes-700" />
                <h3 className="text-xl font-bold text-slate-900">Tambah Admin Baru</h3>
              </div>
              <button
                onClick={() => setAddModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700"
              >
                <X size={20} />
              </button>
            </div>

            {formError && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-start gap-2">
                <AlertCircle size={18} className="shrink-0 mt-0.5" />
                <span>{formError}</span>
              </div>
            )}

            {formSuccess && (
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-start gap-2">
                <CheckCircle2 size={18} className="shrink-0 mt-0.5" />
                <span>{formSuccess}</span>
              </div>
            )}

            <form onSubmit={handleAddAdmin} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                  <Mail size={16} className="text-kemenkes-700" />
                  <span>Email Petugas Baru</span>
                </label>
                <input
                  type="email"
                  required
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="admin.sarpras@kemenkes.go.id"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-kemenkes-500"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                  <Lock size={16} className="text-kemenkes-700" />
                  <span>Kata Sandi (Min. 8 Karakter)</span>
                </label>
                <div className="relative">
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    required
                    minLength={8}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Minimal 8 karakter unik"
                    className="w-full px-4 py-2.5 pr-11 rounded-xl border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-kemenkes-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword((prev) => !prev)}
                    aria-label={showNewPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
                    title={showNewPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
                    className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 hover:text-kemenkes-700 transition"
                  >
                    {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 mt-2">
                <button
                  type="button"
                  onClick={() => setAddModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-100"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2.5 rounded-xl bg-kemenkes-900 hover:bg-kemenkes-800 text-white font-bold text-sm shadow-md transition flex items-center gap-2"
                >
                  {isSubmitting && <Loader2 size={16} className="animate-spin text-kemenkes-lime" />}
                  <span>Daftarkan Admin</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: KONFIRMASI HAPUS ADMIN */}
      {deleteModalOpen && adminToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl flex flex-col items-center text-center">
            <div className="w-16 h-16 rounded-full bg-red-100 text-red-600 flex items-center justify-center mb-4">
              <AlertTriangle size={32} />
            </div>

            <h3 className="text-xl font-bold text-slate-900">Cabut Akses Admin?</h3>
            <p className="text-sm text-slate-600 mt-2">
              Akun <strong>{adminToDelete.email}</strong> tidak akan dapat lagi masuk ke dashboard pengawasan sarana kantor.
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
                onClick={handleDeleteAdmin}
                disabled={isDeleting}
                className="flex-1 py-2.5 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-bold transition flex items-center justify-center gap-2"
              >
                {isDeleting && <Loader2 size={16} className="animate-spin" />}
                <span>Hapus Akses</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
