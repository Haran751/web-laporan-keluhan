// ==============================================================================
// MASTER DATA PEGAWAI
// Sumber kebenaran untuk verifikasi Nama + NIP dan penentuan Tim Kerja.
// Nama & NIP yang tidak terdaftar di sini tidak dapat mengirim laporan.
// ==============================================================================

export interface Pegawai {
  nip: string;
  nama: string;
  timKerja: string;
}

export const DAFTAR_PEGAWAI: Pegawai[] = [
  { nip: '260100010000000001', nama: 'Aditya Pratama', timKerja: 'IT Support' },
  { nip: '260100010000000002', nama: 'Salsabila Putri', timKerja: 'Keuangan' },
  { nip: '260100010000000003', nama: 'Rizky Maulana', timKerja: 'HRD' },
  { nip: '260100010000000004', nama: 'Nabila Azzahra', timKerja: 'Administrasi' },
  { nip: '260100010000000005', nama: 'Fajar Ramadhan', timKerja: 'IT Support' },
  { nip: '260100010000000006', nama: 'Dinda Maharani', timKerja: 'Keuangan' },
  { nip: '260100010000000007', nama: 'Bagas Saputra', timKerja: 'Operasional' },
  { nip: '260100010000000008', nama: 'Alya Safitri', timKerja: 'HRD' },
  { nip: '260100010000000009', nama: 'Reza Firmansyah', timKerja: 'Marketing' },
  { nip: '260100010000000010', nama: 'Citra Lestari', timKerja: 'Administrasi' },
  { nip: '260100010000000011', nama: 'Ilham Kurniawan', timKerja: 'Operasional' },
  { nip: '260100010000000012', nama: 'Zahra Amalia', timKerja: 'Marketing' },
  { nip: '260100010000000013', nama: 'Arif Hidayat', timKerja: 'IT Support' },
  { nip: '260100010000000014', nama: 'Tiara Anindita', timKerja: 'Keuangan' },
  { nip: '260100010000000015', nama: 'Dimas Setiawan', timKerja: 'Logistik' },
  { nip: '260100010000000016', nama: 'Putri Amelia', timKerja: 'Administrasi' },
  { nip: '260100010000000017', nama: 'Farhan Akbar', timKerja: 'Logistik' },
  { nip: '260100010000000018', nama: 'Nadya Permata', timKerja: 'HRD' },
  { nip: '260100010000000019', nama: 'Galih Nugraha', timKerja: 'Operasional' },
  { nip: '260100010000000020', nama: 'Intan Maharani', timKerja: 'Marketing' },
];

/**
 * Menormalkan nama untuk perbandingan yang toleran:
 * - huruf kecil
 * - spasi berlebih dirapikan
 * - tanda baca umum (titik/koma) diabaikan
 */
export function normalisasiNama(nama: string): string {
  return nama
    .toLowerCase()
    .replace(/[.,]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Mencari pegawai berdasarkan NIP (angka saja). */
export function cariPegawai(nip: string): Pegawai | undefined {
  const cleanNip = nip.replace(/\D/g, '');
  return DAFTAR_PEGAWAI.find((p) => p.nip === cleanNip);
}

export type StatusIdentitas = 'kosong' | 'nip_tidak_ditemukan' | 'nama_tidak_cocok' | 'valid';

export interface HasilVerifikasiIdentitas {
  status: StatusIdentitas;
  pegawai?: Pegawai;
  /** Tim kerja yang harus dipakai bila status 'valid'. */
  timKerja?: string;
  /** Pesan siap tampil untuk pengguna. */
  message: string;
}

/**
 * Memverifikasi bahwa NIP terdaftar dan nama cocok dengan NIP tersebut.
 * Dipakai di sisi klien (UX) maupun di server (validasi final).
 */
export function validasiPegawai(nama: string, nip: string): HasilVerifikasiIdentitas {
  const cleanNama = normalisasiNama(nama);
  const cleanNip = nip.replace(/\D/g, '');

  if (!cleanNama || !cleanNip) {
    return {
      status: 'kosong',
      message: 'Lengkapi Nama Lengkap dan NIP untuk verifikasi otomatis data pegawai.',
    };
  }

  const pegawai = cariPegawai(cleanNip);

  if (!pegawai) {
    return {
      status: 'nip_tidak_ditemukan',
      message: 'NIP tidak terdaftar dalam data pegawai resmi. Periksa kembali 18 digit NIP Anda.',
    };
  }

  if (normalisasiNama(pegawai.nama) !== cleanNama) {
    return {
      status: 'nama_tidak_cocok',
      message:
        'Nama tidak cocok dengan NIP tersebut. Pastikan penulisan nama sama dengan data pegawai resmi.',
    };
  }

  return {
    status: 'valid',
    pegawai,
    timKerja: pegawai.timKerja,
    message: `Identitas terverifikasi: ${pegawai.nama} (${pegawai.timKerja}).`,
  };
}
