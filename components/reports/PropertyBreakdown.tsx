import type { ReportsData } from '@/lib/queries/operations';
import { Money, EmptyState, SectionLabel } from '@/components/ui/primitives';

/** Answers "which properties are being used most" — sorted by revenue, plain list, no chart-per-row. */
export function PropertyBreakdown({ rows }: { rows: ReportsData['perProperty'] }) {
  const active = rows.filter(r => r.bookings > 0);
  return (
    <section>
      <SectionLabel>By property</SectionLabel>
      {!active.length ? (
        <EmptyState title="No bookings in this period" body="Property performance will appear here once there are stays to measure." />
      ) : (
        <ul className="border border-rule dark:border-ruleD rounded bg-white dark:bg-night-100 divide-y divide-rule-soft dark:divide-ruleD-soft">
          {active.map(r => (
            <li key={r.propertyId} className="flex items-center justify-between px-3.5 py-2.5">
              <span>{r.propertyName}</span>
              <span className="flex items-center gap-3 text-meta text-ink-muted dark:text-inkD-muted tabular-nums">
                <span>{r.bookings} booking{r.bookings !== 1 ? 's' : ''}</span>
                <span>{r.nights} night{r.nights !== 1 ? 's' : ''}</span>
                <Money value={r.revenue} />
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
