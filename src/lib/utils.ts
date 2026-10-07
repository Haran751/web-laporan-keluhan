import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(dateStr: string | null | undefined, includeTime: boolean = false): string {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;

    const options: Intl.DateTimeFormatOptions = {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: 'Asia/Jakarta',
    };

    if (includeTime) {
      options.hour = '2-digit';
      options.minute = '2-digit';
    }

    return new Intl.DateTimeFormat('id-ID', options).format(d);
  } catch {
    return dateStr;
  }
}

/**
 * Tanggal hari ini dalam zona waktu Asia/Jakarta (UTC+7) format YYYY-MM-DD.
 * Penting: tidak memakai toISOString() yang berbasis UTC — di WIB setelah
 * sekitar pukul 19.00, tanggal UTC sudah berjalan maju satu hari.
 */
export function todayJakartaISO(): string {
  try {
    const now = new Date();
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Jakarta',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(now);

    const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
    return `${get('year')}-${get('month')}-${get('day')}`;
  } catch {
    return new Date().toISOString().split('T')[0];
  }
}

export function maskNip(nip: string): string {
  if (!nip) return '-';
  const clean = nip.replace(/\D/g, '');
  if (clean.length === 18) {
    return `${clean.substring(0, 4)}****${clean.substring(16, 18)}`;
  }
  if (clean.length > 6) {
    return `${clean.substring(0, 4)}****${clean.substring(clean.length - 2)}`;
  }
  return '****';
}

export interface CsvComplaintRecord {
  nomor_laporan: string;
  tanggal_keluhan: string;
  nama: string;
  nip: string;
  tim_kerja: string;
  nama_barang: string;
  lokasi: string;
  status: string;
  tanggal_selesai: string | null;
  deskripsi: string;
  catatan_admin: string | null;
  foto_urls?: string;
}

export function downloadComplaintsCsv(records: CsvComplaintRecord[], filename: string = 'laporan-kerusakan.csv') {
  const headers = [
    'Nomor Laporan',
    'Tanggal Keluhan',
    'Nama Pelapor',
    'NIP Pegawai',
    'Tim Kerja / Unit',
    'Nama Fasilitas',
    'Lokasi / Ruangan',
    'Status',
    'Tanggal Selesai',
    'Deskripsi Kerusakan',
    'Catatan Admin',
    'Link Foto'
  ];

  const escapeCsv = (val: string | null | undefined): string => {
    if (val === null || val === undefined) return '""';
    const stringVal = String(val).replace(/"/g, '""');
    return `"${stringVal}"`;
  };

  const rows = records.map((r) => [
    escapeCsv(r.nomor_laporan),
    escapeCsv(r.tanggal_keluhan),
    escapeCsv(r.nama),
    // PENTING: NIP ditulis format formula string ='1987...' agar Microsoft Excel tidak mengubahnya jadi scientific notation (notasi ilmiah)
    `="""${r.nip}"""`,
    escapeCsv(r.tim_kerja),
    escapeCsv(r.nama_barang),
    escapeCsv(r.lokasi),
    escapeCsv(r.status),
    escapeCsv(r.tanggal_selesai || '-'),
    escapeCsv(r.deskripsi),
    escapeCsv(r.catatan_admin || '-'),
    escapeCsv(r.foto_urls || '-')
  ]);

  // Tambahkan Byte Order Mark (BOM) UTF-8 (\uFEFF) agar terbaca benar di Microsoft Excel Windows tanpa encoding rusak
  const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
