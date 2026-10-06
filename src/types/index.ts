export type ComplaintStatus = 'menunggu' | 'diproses' | 'selesai';

export interface ComplaintPhoto {
  id: string;
  complaint_id: string;
  storage_path: string;
  url: string;
  created_at: string;
}

export interface ComplaintPublic {
  id: string;
  nomor_laporan: string;
  nama: string;
  nip: string; // Disamarkan (e.g. 1987****21)
  tim_kerja: string;
  nama_barang: string;
  lokasi: string;
  deskripsi: string;
  tanggal_keluhan: string;
  tanggal_selesai: string | null;
  status: ComplaintStatus;
  catatan_admin: string | null;
  created_at: string;
  updated_at: string;
  photos?: ComplaintPhoto[];
}

export interface ComplaintAdmin {
  id: string;
  nomor_laporan: string;
  nama: string;
  nip: string; // Lengkap (18 digit)
  tim_kerja: string;
  nama_barang: string;
  lokasi: string;
  deskripsi: string;
  tanggal_keluhan: string;
  tanggal_selesai: string | null;
  status: ComplaintStatus;
  catatan_admin: string | null;
  created_at: string;
  updated_at: string;
  photos?: ComplaintPhoto[];
}

export interface AdminUser {
  id: string;
  email: string;
  created_at: string;
}

export interface ComplaintStats {
  total: number;
  menunggu: number;
  diproses: number;
  selesai: number;
}
