'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import {
  Building2,
  LayoutDashboard,
  Users,
  LogOut,
  ExternalLink,
  ShieldCheck,
  Menu,
  X
} from 'lucide-react';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Jangan tampilkan layout navigasi admin jika di halaman login
  const isLoginPage = pathname === '/admin/login';

  useEffect(() => {
    if (isLoginPage) return;

    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setUserEmail(user.email || null);
      }
    });
  }, [isLoginPage]);

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/admin/login');
    router.refresh();
  };

  if (isLoginPage) {
    return <>{children}</>;
  }

  const navLinks = [
    { label: 'Kelola Laporan', href: '/admin', icon: LayoutDashboard },
    { label: 'Kelola Admin', href: '/admin/users', icon: Users },
  ];

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      {/* Admin Top Navigation Bar */}
      <header className="bg-slate-900 text-white sticky top-0 z-30 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-18 py-3">
            {/* Logo Admin */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-kemenkes-900 border border-kemenkes-500/40 flex items-center justify-center text-kemenkes-400">
                <ShieldCheck size={22} />
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <span className="font-black text-lg tracking-tight uppercase">Admin Panel</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-kemenkes-lime text-slate-950 font-bold uppercase">
                    Petugas
                  </span>
                </div>
                <span className="text-xs text-slate-400 font-mono truncate max-w-[200px] sm:max-w-none">
                  {userEmail || 'Memuat akun...'}
                </span>
              </div>
            </div>

            {/* Navigasi Desktop */}
            <div className="hidden md:flex items-center gap-2">
              {navLinks.map((item) => {
                const isActive = pathname === item.href;
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                      isActive
                        ? 'bg-kemenkes-800 text-white'
                        : 'text-slate-300 hover:text-white hover:bg-slate-800'
                    }`}
                  >
                    <Icon size={18} className={isActive ? 'text-kemenkes-400' : 'text-slate-400'} />
                    <span>{item.label}</span>
                  </Link>
                );
              })}

              <div className="w-px h-6 bg-slate-700 mx-2"></div>

              <Link
                href="/"
                target="_blank"
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800 transition"
              >
                <span>Halaman Publik</span>
                <ExternalLink size={14} />
              </Link>

              <button
                onClick={handleLogout}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-red-300 hover:text-white hover:bg-red-900/40 transition ml-1"
              >
                <LogOut size={16} />
                <span>Keluar</span>
              </button>
            </div>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800"
            >
              {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-slate-800 border-t border-slate-700 px-4 py-3 space-y-2">
            {navLinks.map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-bold ${
                    isActive ? 'bg-kemenkes-800 text-white' : 'text-slate-300'
                  }`}
                >
                  <Icon size={18} />
                  <span>{item.label}</span>
                </Link>
              );
            })}

            <div className="pt-2 border-t border-slate-700 flex items-center justify-between">
              <Link
                href="/"
                target="_blank"
                className="text-xs font-semibold text-slate-300 hover:text-white flex items-center gap-1"
              >
                <span>Lihat Web Publik</span>
                <ExternalLink size={14} />
              </Link>

              <button
                onClick={handleLogout}
                className="text-xs font-bold text-red-400 hover:text-red-300 flex items-center gap-1"
              >
                <LogOut size={14} />
                <span>Keluar</span>
              </button>
            </div>
          </div>
        )}
      </header>

      {/* Main Content Area */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
}
