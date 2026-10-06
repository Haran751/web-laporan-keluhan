'use client';

import React, { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Lock, Mail, Building2, ArrowRight, AlertCircle, Loader2, ArrowLeft } from 'lucide-react';

function LoginFormContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectPath = searchParams.get('redirect') || '/admin';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setLoading(true);

    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password,
      });

      if (error) {
        throw new Error(
          error.message === 'Invalid login credentials'
            ? 'Email atau password salah. Pastikan kredensial telah benar.'
            : error.message
        );
      }

      if (!data.user) {
        throw new Error('Gagal mendapatkan sesi pengguna.');
      }

      // Pastikan user terdaftar di tabel public.admins
      const { data: adminRecord, error: adminErr } = await supabase
        .from('admins')
        .select('id')
        .eq('id', data.user.id)
        .single();

      if (adminErr || !adminRecord) {
        // Sign out segera jika bukan admin resmi
        await supabase.auth.signOut();
        throw new Error(
          'Akun Anda terdaftar tetapi tidak memiliki hak akses administrator sarana kantor.'
        );
      }

      // Login berhasil! Alihkan ke dashboard admin
      router.push(redirectPath);
      router.refresh();
    } catch (err: any) {
      setErrorMessage(err.message || 'Terjadi kesalahan saat masuk');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md bg-white rounded-3xl border border-slate-200 shadow-xl p-8 sm:p-10 flex flex-col">
      {/* Header Logo & Title */}
      <div className="flex flex-col items-center text-center mb-8">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-kemenkes-900 to-kemenkes-700 text-white flex items-center justify-center shadow-lg mb-4">
          <Building2 size={34} className="text-kemenkes-400" />
        </div>
        <span className="px-3 py-0.5 rounded-full bg-kemenkes-100 text-kemenkes-900 font-bold text-xs uppercase tracking-widest border border-kemenkes-200">
          Khusus Petugas
        </span>
        <h1 className="text-2xl sm:text-3xl font-black text-slate-900 mt-2 tracking-tight">
          Masuk Akses Admin
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Gunakan akun resmi pengelola sarana prasarana dinas
        </p>
      </div>

      {errorMessage && (
        <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 flex items-start gap-3">
          <AlertCircle size={20} className="text-red-600 shrink-0 mt-0.5" />
          <p className="text-sm leading-snug">{errorMessage}</p>
        </div>
      )}

      {/* Form Login */}
      <form onSubmit={handleLogin} className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <label className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
            <Mail size={16} className="text-kemenkes-700" />
            <span>Email Resmi Petugas</span>
          </label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="admin@kemenkes.go.id"
            className="w-full px-4 py-3 rounded-xl border border-slate-300 text-base text-slate-900 focus:outline-none focus:ring-2 focus:ring-kemenkes-500 focus:border-transparent transition"
          />
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
            <Lock size={16} className="text-kemenkes-700" />
            <span>Kata Sandi (Password)</span>
          </label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="w-full px-4 py-3 rounded-xl border border-slate-300 text-base text-slate-900 focus:outline-none focus:ring-2 focus:ring-kemenkes-500 focus:border-transparent transition"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="mt-3 w-full py-3.5 px-6 rounded-xl bg-kemenkes-900 hover:bg-kemenkes-800 text-white font-bold text-base transition-all shadow-md flex items-center justify-center gap-2 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <>
              <Loader2 size={20} className="animate-spin text-kemenkes-lime" />
              <span>Memverifikasi Akun...</span>
            </>
          ) : (
            <>
              <span>Masuk ke Dashboard</span>
              <ArrowRight size={18} />
            </>
          )}
        </button>
      </form>

      <div className="mt-8 pt-6 border-t border-slate-100 text-center">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-kemenkes-900 font-semibold transition"
        >
          <ArrowLeft size={16} />
          <span>Kembali ke Halaman Publik</span>
        </Link>
      </div>
    </div>
  );
}

export default function AdminLoginPage() {
  return (
    <div className="min-h-[85vh] flex items-center justify-center px-4 py-12">
      <Suspense
        fallback={
          <div className="w-full max-w-md bg-white rounded-3xl p-12 text-center shadow-lg border border-slate-200">
            <Loader2 size={32} className="animate-spin text-kemenkes-700 mx-auto" />
            <p className="mt-4 text-sm font-semibold text-slate-600">Menyiapkan halaman login...</p>
          </div>
        }
      >
        <LoginFormContent />
      </Suspense>
    </div>
  );
}
