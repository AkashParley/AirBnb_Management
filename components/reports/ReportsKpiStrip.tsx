import { Wallet, CircleCheck, AlertCircle, ClipboardList, TrendingUp } from 'lucide-react';
import type { ReportsData } from '@/lib/queries/operations';
import { formatINRCompact } from '@/lib/calculations';

/** Level 1 — business overview. Five numbers, not a card grid. */
export function ReportsKpiStrip({ data }: { data: ReportsData }) {
  const items = [
    { Icon: Wallet, label: 'Total revenue', value: formatINRCompact(data.revenue) },
    { Icon: CircleCheck, label: 'Collected', value: formatINRCompact(data.collected) },
    { Icon: AlertCircle, label: 'Outstanding', value: formatINRCompact(data.outstanding) },
    { Icon: ClipboardList, label: 'Bookings', value: data.bookingsCount },
    { Icon: TrendingUp, label: 'Occupancy', value: `${data.occupancyPct}%` },
  ];
  return (
    <div className="flex flex-wrap gap-x-8 gap-y-2 border-y border-rule dark:border-ruleD py-3.5">
      {items.map(({ Icon, label, value }) => (
        <div key={label} className="flex items-center gap-2">
          <Icon size={16} className="text-ink-faint dark:text-inkD-faint" strokeWidth={1.8} />
          <span className="text-display tabular-nums font-semibold">{value}</span>
          <span className="text-meta text-ink-muted dark:text-inkD-muted">{label}</span>
        </div>
      ))}
    </div>
  );
}