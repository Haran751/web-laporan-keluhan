import { LoadingState } from '@/components/LoadingState';

export default function Loading() {
  return (
    <div className="w-full bg-slate-50 min-h-[70vh] flex items-center justify-center px-4">
      <LoadingState
        message="Memuat Halaman..."
        subMessage="Menyiapkan daftar pengaduan kerusakan fasilitas kantor"
      />
    </div>
  );
}
