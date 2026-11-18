import React from 'react';
import { CheckCircle2, Clock, AlertCircle, Send, Eye, XCircle, Ban } from 'lucide-react';

interface StatusLabelProps {
  status: string;
  label?: string;
}

export const StatusLabel: React.FC<StatusLabelProps> = ({ status, label }) => {
  const s = status.toUpperCase();
  const display = label || status;

  if (['PAID', 'ACTIVE', 'COMPLETED', 'PUBLISHED', 'DELIVERED', 'READ'].includes(s)) {
    const Icon = s === 'READ' ? Eye : CheckCircle2;
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-400 whitespace-nowrap">
        <Icon className="w-3.5 h-3.5 shrink-0" />
        <span>{display}</span>
      </span>
    );
  }

  if (['PARTIAL', 'QUEUED', 'SENT', 'OPEN'].includes(s)) {
    const Icon = s === 'SENT' ? Send : Clock;
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700 dark:text-amber-400 whitespace-nowrap">
        <Icon className="w-3.5 h-3.5 shrink-0" />
        <span>{display}</span>
      </span>
    );
  }

  if (['UNPAID', 'FAILED', 'REVERSED', 'VOID', 'INACTIVE'].includes(s)) {
    const Icon = s === 'UNPAID' ? AlertCircle : s === 'INACTIVE' ? Ban : XCircle;
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-red-700 dark:text-red-400 whitespace-nowrap">
        <Icon className="w-3.5 h-3.5 shrink-0" />
        <span>{display}</span>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 whitespace-nowrap">
      <span>{display}</span>
    </span>
  );
};
