import React from 'react';
import { Loader2 } from 'lucide-react';

interface LoadingStateProps {
  message?: string;
  subMessage?: string;
}

export function LoadingState({
  message = 'Memuat Data...',
  subMessage = 'Sedang menyinkronkan data dengan sistem',
}: LoadingStateProps) {
  return (
    <div className="flex flex-col items-center justify-center p-16 text-center bg-white border border-slate-200 rounded-xl shadow-sm">
      <div className="relative flex items-center justify-center mb-4">
        <div className="w-14 h-14 rounded-full border-4 border-kemenkes-100 border-t-kemenkes-700 animate-spin"></div>
        <div className="absolute w-3 h-3 rounded-full bg-kemenkes-400"></div>
      </div>
      <h4 className="text-lg font-bold text-slate-800 tracking-tight">{message}</h4>
      <p className="mt-1 text-sm text-slate-500">{subMessage}</p>
    </div>
  );
}
