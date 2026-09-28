import type { ReportsData } from '@/lib/queries/operations';
import { SectionLabel, EmptyState } from '@/components/ui/primitives';

/** Overall occupancy + a compact per-property comparison. Check-out is treated as an
 *  exclusive boundary throughout — the same semantics the Calendar's layout engine uses. */
export function OccupancyPanel({ data }: { data: ReportsData }) {
  const rows = [...data.perProperty].sort((a, b) => b.occupancyPct - a.occupancyPct);
  return (
    <section>
      <div className="flex items-baseline justify-between mb-2">
        <SectionLabel>Occupancy</SectionLabel>
        <span className="text-title font-semibold tabular-nums">{data.occupancyPct}%</span>
      </div>
      {!rows.some(r => r.occupiedNights > 0) ? (
        <EmptyState title="No occupied nights" body="Occupancy by property will appear here once stays overlap this period." />
      ) : (
        <ul className="space-y-2">
          {rows.map(r => (
            <li key={r.propertyId} className="flex items-center gap-3">
              <span className="w-32 shrink-0 truncate text-meta">{r.propertyName}</span>
              <div className="flex-1 h-1.5 bg-rule dark:bg-ruleD rounded-xs overflow-hidden">
                <div className="h-full bg-state-ready dark:bg-stateD-ready" style={{ width: `${r.occupancyPct}%` }} />
              </div>
              <span className="w-10 text-right text-meta tabular-nums text-ink-muted dark:text-inkD-muted">{r.occupancyPct}%</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}