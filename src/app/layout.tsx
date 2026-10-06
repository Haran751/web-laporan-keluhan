import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'PADUKA - Daftar Pengaduan Kerusakan Fasilitas Kantor',
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
      <body className="flex flex-col min-h-screen">{children}</body>
    </html>
  );
}
