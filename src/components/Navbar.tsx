'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ShieldAlert, PlusCircle, LayoutDashboard, Menu, X, FileText, Building2 } from 'lucide-react';

export function Navbar() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isActive = (path: string) => {
    if (path === '/' && pathname === '/') return true;
    if (path !== '/' && pathname.startsWith(path)) return true;
    return false;
  };

  const navLinks = [
    { label: 'Daftar Keluhan', href: '/', icon: FileText },
    { label: 'Buat Laporan', href: '/lapor', icon: PlusCircle },
  ];

  return (
    <header className="sticky top-0 z-40 w-full bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          {/* Logo & Identitas Resmi */}
          <Link href="/" className="flex items-center gap-3.5 group">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-kemenkes-900 to-kemenkes-700 flex items-center justify-center text-white shadow-md group-hover:scale-105 transition-transform">
              <Building2 size={26} className="text-kemenkes-400" />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 uppercase">
                  SiPeKa
                </span>
                <span className="px-2 py-0.5 text-xs font-bold uppercase tracking-wider rounded bg-kemenkes-100 text-kemenkes-900 border border-kemenkes-300">
                  Resmi
                </span>
              </div>
              <span className="text-xs sm:text-sm text-slate-600 font-medium hidden sm:inline-block">
                Pengaduan Kerusakan Barang Kantor
              </span>
            </div>
          </Link>

          {/* Navigasi Desktop */}
          <nav className="hidden md:flex items-center gap-2">
            {navLinks.map((item) => {
              const active = isActive(item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-base font-semibold transition-all ${
                    active
                      ? 'bg-kemenkes-50 text-kemenkes-900 border border-kemenkes-200'
                      : 'text-slate-700 hover:text-kemenkes-900 hover:bg-slate-100'
                  }`}
                >
                  <Icon size={18} className={active ? 'text-kemenkes-700' : 'text-slate-500'} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* Tombol Akses Admin */}
          <div className="hidden md:flex items-center gap-3">
            <Link
              href="/admin"
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-kemenkes-900 text-white text-base font-semibold hover:bg-kemenkes-800 transition shadow-sm hover:shadow"
            >
              <LayoutDashboard size={18} className="text-kemenkes-lime" />
              <span>Akses Admin</span>
            </Link>
          </div>

          {/* Hamburger Mobile Menu Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2.5 rounded-lg text-slate-700 hover:text-slate-900 hover:bg-slate-100 focus:outline-none"
            aria-label="Menu"
          >
            {mobileMenuOpen ? <X size={26} /> : <Menu size={26} />}
          </button>
        </div>
      </div>

      {/* Navigasi Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-white border-b border-slate-200 px-4 pt-3 pb-5 space-y-2 shadow-lg">
          <p className="px-3 py-1 text-xs font-bold text-slate-600 uppercase tracking-wider">
            Menu Utama
          </p>
          {navLinks.map((item) => {
            const active = isActive(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-3 px-3 py-3 rounded-lg text-base font-semibold ${
                  active
                    ? 'bg-kemenkes-100 text-kemenkes-900 font-bold'
                    : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                <Icon size={20} className={active ? 'text-kemenkes-700' : 'text-slate-500'} />
                <span>{item.label}</span>
              </Link>
            );
          })}

          <div className="pt-3 border-t border-slate-100">
            <Link
              href="/admin"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center justify-center gap-2 w-full px-4 py-3 rounded-lg bg-kemenkes-900 text-white font-bold text-base"
            >
              <LayoutDashboard size={18} className="text-kemenkes-lime" />
              <span>Akses Admin</span>
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
