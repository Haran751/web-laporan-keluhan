import React from 'react';
import { SearchX, PlusCircle } from 'lucide-react';
import Link from 'next/link';

interface EmptyStateProps {
  title?: string;
  description?: string;
  actionText?: string;
  actionHref?: string;
  onActionClick?: () => void;
}

export function EmptyState({
  title = 'Tidak Ada Data',
  description = 'Belum ada data pengaduan yang sesuai dengan kriteria saringan atau pencarian.',
  actionText,
  actionHref,
  onActionClick,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center bg-white border border-slate-200 rounded-xl shadow-sm">
      <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 mb-4 ring-8 ring-slate-50">
        <SearchX size={32} />
      </div>
      <h3 className="text-xl font-bold text-slate-800 tracking-tight">{title}</h3>
      <p className="mt-1.5 text-base text-slate-600 max-w-md">{description}</p>
      {actionText && (
        <div className="mt-6">
          {actionHref ? (
            <Link
              href={actionHref}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-kemenkes-900 text-white font-medium hover:bg-kemenkes-800 transition shadow-sm hover:shadow"
            >
              <PlusCircle size={18} />
              <span>{actionText}</span>
            </Link>
          ) : (
            <button
              onClick={onActionClick}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-slate-100 text-slate-800 font-medium hover:bg-slate-200 transition"
            >
              <span>{actionText}</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
