interface StatusBadgeProps {
  status: string;
}

const statusColorClassByValue: Record<string, string> = {
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  active: 'bg-green-100 text-green-800',
  revoked: 'bg-red-100 text-red-800',
  expired: 'bg-slate-200 text-slate-600',
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const normalizedStatus = status.trim().toLowerCase();
  const colorClass =
    statusColorClassByValue[normalizedStatus] ??
    'bg-yellow-100 text-yellow-800';

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${colorClass}`}
    >
      {normalizedStatus || 'pending'}
    </span>
  );
}
