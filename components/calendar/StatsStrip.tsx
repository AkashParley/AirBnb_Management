import { Wallet, TrendingUp, ClipboardList, Wrench, ArrowLeftRight } from 'lucide-react';
import type { MonthStats } from '@/lib/queries/operations';

/** A thin metric row, not a card grid — each figure earns its place by answering a real question. */
export function StatsStrip({ stats }: { stats: MonthStats }) {
  const items = [
    { Icon: Wallet, label: 'Revenue', value: `₹${stats.revenue.toLocaleString('en-IN')}` },
    { Icon: TrendingUp, label: 'Occupancy', value: `${stats.occupancyPct}%` },
    { Icon: ClipboardList, label: 'Active bookings', value: stats.activeBookings },
    { Icon: Wrench, label: 'Maintenance', value: stats.maintenanceOpen },
    { Icon: ArrowLeftRight, label: 'Same-day turnovers', value: stats.sameDayTurnovers },
  ];
  return (
    <div className="flex flex-wrap gap-5 border-t border-rule dark:border-ruleD pt-3 mt-3">
      {items.map(({ Icon, label, value }) => (
        <div key={label} className="flex items-center gap-2">
          <Icon size={15} className="text-ink-faint dark:text-inkD-faint" strokeWidth={1.8} />
          <span className="tabular-nums font-semibold">{value}</span>
          <span className="text-meta text-ink-muted dark:text-inkD-muted">{label}</span>
        </div>
      ))}
    </div>
  );
}
