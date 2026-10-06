import type { Metadata } from 'next';
import './globals.css';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';

export const metadata: Metadata = {
  title: 'SiPeKa - Sistem Pengaduan Kerusakan Barang Kantor',
  description:
    'Layanan aspirasi dan pelaporan terpadu pemeliharaan sarana, prasarana, dan perlengkapan kantor kedinasan.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id">
      <body className="flex flex-col min-h-screen">
        <Navbar />
        <main className="flex-1 w-full bg-slate-50">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
