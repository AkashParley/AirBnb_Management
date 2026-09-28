import type { ReportsData } from '@/lib/queries/operations';
import { Money, EmptyState, SectionLabel } from '@/components/ui/primitives';

/**
 * "Property performance" — a horizontal bar per property (revenue, relative to the top
 * performer) plus the exact numbers alongside, per the brief's explicit instruction that
 * values must stay readable even with a chart present. No "best/worst" labeling — just
 * the metrics, sorted by revenue.
 */
export function PropertyPerformance({ rows }: { rows: ReportsData['perProperty'] }) {
  const active = rows.filter(r => r.bookings > 0);
  const maxRevenue = Math.max(...active.map(r => r.revenue), 1);

  return (
    <section>
      <SectionLabel>Property performance</SectionLabel>
      {!active.length ? (
        <EmptyState title="No bookings in this period" body="Property performance will appear here once there are stays to measure." />
      ) : (
        <ul className="border border-rule dark:border-ruleD rounded bg-white dark:bg-night-100 divide-y divide-rule-soft dark:divide-ruleD-soft">
          {active.map(r => (
            <li key={r.propertyId} className="px-3.5 py-2.5">
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-medium">{r.propertyName}</span>
                <span className="text-body font-semibold tabular-nums"><Money value={r.revenue} /></span>
              </div>
              <div className="h-1.5 bg-rule dark:bg-ruleD rounded-xs overflow-hidden mb-1.5">
                <div className="h-full bg-state-info dark:bg-stateD-info" style={{ width: `${(r.revenue / maxRevenue) * 100}%` }} />
              </div>
              <div className="flex flex-wrap gap-x-4 text-meta text-ink-muted dark:text-inkD-muted tabular-nums">
                <span>{r.bookings} booking{r.bookings !== 1 ? 's' : ''}</span>
                <span>{r.occupiedNights} night{r.occupiedNights !== 1 ? 's' : ''}</span>
                <span>{r.occupancyPct}% occupancy</span>
                <span>Collected <Money muted value={r.collected} /></span>
                {r.outstanding > 0 && <span className="text-state-attend dark:text-stateD-attend">Outstanding <Money value={r.outstanding} /></span>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}