import React from 'react';
import { Building2, ShieldCheck, HeartPulse } from 'lucide-react';

export function Footer() {
  return (
    <footer className="w-full bg-slate-900 text-slate-300 border-t border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xl font-black tracking-tight text-white uppercase">
                PADUKA
              </span>
              <span className="px-2 py-0.5 text-xs font-bold uppercase rounded bg-kemenkes-900 text-kemenkes-400 border border-kemenkes-700">
                Fasilitas Kantor
              </span>
            </div>
            <p className="text-sm text-slate-400 max-w-xl">
              Portal Pelaporan &amp; Pemantauan Penanganan Kerusakan Sarana Prasarana Kerja. Terpadu, transparan, dan akuntabel.
            </p>
          </div>

          <div className="flex flex-col md:items-end gap-1.5 text-xs sm:text-sm text-slate-400">
            <div className="flex items-center gap-2">
              <ShieldCheck size={16} className="text-kemenkes-400" />
              <span>Privasi Terjaga: NIP Publik Disamarkan</span>
            </div>
            <p className="text-slate-500">
              © {new Date().getFullYear()} Biro Umum &amp; Pengelolaan Barang Milik Negara (BMN).
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
