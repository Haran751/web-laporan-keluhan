import React from 'react';
import { ComplaintStatus } from '@/types';
import { Clock, Wrench, CheckCircle2 } from 'lucide-react';

interface StatusBadgeProps {
  status: ComplaintStatus | string;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
}

export function StatusBadge({ status, size = 'md', showIcon = true }: StatusBadgeProps) {
  const normStatus = (status || 'menunggu').toLowerCase();

  const config = {
    menunggu: {
      label: 'Menunggu',
      bg: 'bg-amber-50 text-amber-900 border-amber-300 ring-amber-200/50',
      dot: 'bg-amber-500',
      icon: Clock,
    },
    diproses: {
      label: 'Diproses',
      bg: 'bg-sky-50 text-sky-900 border-sky-300 ring-sky-200/50',
      dot: 'bg-sky-500',
      icon: Wrench,
    },
    selesai: {
      label: 'Selesai',
      bg: 'bg-emerald-50 text-emerald-900 border-emerald-300 ring-emerald-200/50',
      dot: 'bg-emerald-600',
      icon: CheckCircle2,
    },
  }[normStatus] || {
    label: normStatus,
    bg: 'bg-slate-100 text-slate-800 border-slate-300 ring-slate-200/50',
    dot: 'bg-slate-500',
    icon: Clock,
  };

  const IconComponent = config.icon;

  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs font-semibold gap-1',
    md: 'px-3 py-1 text-sm font-semibold gap-1.5',
    lg: 'px-4 py-1.5 text-base font-bold gap-2',
  }[size];

  const iconSizes = {
    sm: 12,
    md: 14,
    lg: 18,
  }[size];

  return (
    <span
      className={`inline-flex items-center rounded-full border shadow-sm ${config.bg} ${sizeClasses}`}
    >
      {showIcon && <IconComponent size={iconSizes} className="shrink-0" />}
      <span className="capitalize">{config.label}</span>
    </span>
  );
}
