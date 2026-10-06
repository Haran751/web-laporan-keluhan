import { LoadingState } from '@/components/LoadingState';

export default function AdminLoading() {
  return (
    <div className="w-full min-h-[70vh] flex items-center justify-center px-4">
      <LoadingState message="Memuat Panel Admin..." subMessage="Memeriksa sesi petugas" />
    </div>
  );
}
