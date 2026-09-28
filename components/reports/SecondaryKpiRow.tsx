import type { ReportsData } from '@/lib/queries/operations';
import { formatINRCompact } from '@/lib/calculations';

/** Level 2/3 secondary metrics — compact, no icons, deliberately quieter than the primary row. */
export function SecondaryKpiRow({ data }: { data: ReportsData }) {
  const items = [
    { label: 'Avg. booking value', value: formatINRCompact(data.avgBookingValue) },
    { label: 'Avg. stay length', value: `${data.avgStayNights}n` },
    { label: 'Revenue / occupied night', value: formatINRCompact(data.revenuePerOccupiedNight) },
    { label: 'Paid in full', value: `${data.paidPct}%` },
    { label: 'Partial', value: data.partialCount },
    { label: 'Pending', value: data.pendingCount },
    { label: 'Check-ins', value: data.checkinsCount },
    { label: 'Check-outs', value: data.checkoutsCount },
    { label: 'Same-day turnovers', value: data.sameDayTurnovers },
  ];
  return (
    <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-meta text-ink-muted dark:text-inkD-muted">
      {items.map(({ label, value }) => (
        <div key={label} className="flex items-baseline gap-1.5">
          <span className="tabular-nums">{value}</span>
          <span className="text-ink-faint dark:text-inkD-faint">{label}</span>
        </div>
      ))}
    </div>
  );
}