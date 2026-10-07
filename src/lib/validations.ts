import { z } from 'zod';
import { validasiPegawai } from './pegawai';

export const ALLOWED_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const MAX_PHOTO_COUNT = 6;
export const MIN_PHOTO_COUNT = 3;

// Schema permintaan Signed Upload URL
export const uploadUrlRequestSchema = z.object({
  files: z
    .array(
      z.object({
        filename: z.string().min(1, 'Nama file wajib ada'),
        fileType: z.string().refine(
          (type) => ALLOWED_PHOTO_TYPES.includes(type),
          'Format file harus berupa JPG, PNG, atau WEBP'
        ),
      })
    )
    .min(MIN_PHOTO_COUNT, `Wajib mengunggah minimal ${MIN_PHOTO_COUNT} foto`)
    .max(MAX_PHOTO_COUNT, `Maksimal foto adalah ${MAX_PHOTO_COUNT} berkas`),
});

// Schema pembuatan laporan pengaduan baru
export const createComplaintSchema = z
  .object({
    nama: z
      .string()
      .trim()
      .min(2, 'Nama pelapor minimal 2 karakter')
      .max(100, 'Nama pelapor maksimal 100 karakter'),
    nip: z
      .string()
      .trim()
      .regex(/^[0-9]{18}$/, 'NIP harus tepat 18 angka numerik'),
    tim_kerja: z
      .string()
      .trim()
      .min(2, 'Tim kerja / Unit wajib diisi')
      .max(150, 'Tim kerja maksimal 150 karakter'),
    nama_barang: z
      .string()
      .trim()
      .min(2, 'Nama barang wajib diisi')
      .max(150, 'Nama barang maksimal 150 karakter'),
    lokasi: z
      .string()
      .trim()
      .min(2, 'Lokasi / ruangan wajib diisi')
      .max(150, 'Lokasi maksimal 150 karakter'),
    deskripsi: z
      .string()
      .trim()
      .min(10, 'Deskripsi kerusakan minimal 10 karakter')
      .max(2000, 'Deskripsi kerusakan maksimal 2000 karakter'),
    tanggal_keluhan: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal tidak valid (YYYY-MM-DD)'),
    photos: z
      .array(
        z.object({
          storage_path: z.string().min(1),
          url: z.string().url('URL foto tidak valid'),
        })
      )
      .min(MIN_PHOTO_COUNT, `Wajib mengunggah minimal ${MIN_PHOTO_COUNT} foto`)
      .max(MAX_PHOTO_COUNT, `Maksimal ${MAX_PHOTO_COUNT} foto`),
    honeypot: z.string().optional(), // Harus kosong untuk manusia
  })
  .refine((data) => validasiPegawai(data.nama, data.nip).status === 'valid', {
    message: 'Nama dan NIP tidak sesuai dengan data pegawai resmi',
    path: ['nip'],
  });

// Schema update keluhan oleh admin
export const updateComplaintSchema = z
  .object({
    status: z.enum(['menunggu', 'diproses', 'selesai']),
    tanggal_keluhan: z.string().optional(),
    tanggal_selesai: z.string().nullable().optional(),
    catatan_admin: z.string().nullable().optional(),
  })
  .refine(
    (data) => {
      // Validasi tanggal selesai tidak boleh sebelum tanggal keluhan
      if (data.status === 'selesai' && data.tanggal_selesai && data.tanggal_keluhan) {
        return new Date(data.tanggal_selesai) >= new Date(data.tanggal_keluhan);
      }
      return true;
    },
    {
      message: 'Tanggal selesai tidak boleh lebih awal dari tanggal keluhan',
      path: ['tanggal_selesai'],
    }
  );

// Schema penambahan admin baru
export const createAdminSchema = z.object({
  email: z.string().email('Format email tidak valid'),
  password: z.string().min(8, 'Password admin minimal 8 karakter'),
});
