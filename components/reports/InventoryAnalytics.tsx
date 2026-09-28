import { format } from 'date-fns';
import { CircleCheck } from 'lucide-react';
import type { ReportsData } from '@/lib/queries/operations';
import { Money, SectionLabel } from '@/components/ui/primitives';

/**
 * The operational section that matters specifically to KEEYSTAY's core purpose. Kept
 * compact and factual — this is a summary, not the Calendar's attention feed, and not a
 * full maintenance/claims list.
 */
export function InventoryAnalytics({ data }: { data: ReportsData }) {
  const r = data.reconciliation;
  const stats: { label: string; value: number | null; money?: number }[] = [
    { label: 'Completed stays', value: r.completedStays },
    { label: 'Fully reconciled', value: r.fullyReconciled },
    { label: 'With missing items', value: r.missingStays },
    { label: 'With damage', value: r.damagedStays },
    { label: 'Missing units', value: r.missingQtyTotal },
    ...(r.estimatedValue > 0 ? [{ label: 'Est. value', value: null, money: r.estimatedValue }] : []),
  ];

  return (
    <section>
      <SectionLabel>Inventory reconciliation</SectionLabel>
      <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-meta mb-3">
        {stats.map(s => (
          <span key={s.label} className="flex items-baseline gap-1.5">
            <span className="tabular-nums font-medium">{s.money !== undefined ? <Money value={s.money} /> : s.value}</span>
            <span className="text-ink-faint dark:text-inkD-faint">{s.label}</span>
          </span>
        ))}
      </div>

      {!data.recentIssues.length ? (
        r.completedStays > 0 ? (
          <p className="flex items-center gap-1.5 text-meta text-state-ready dark:text-stateD-ready">
            <CircleCheck size={14} /> All completed stays reconciled
          </p>
        ) : (
          <p className="text-meta text-ink-faint dark:text-inkD-faint">No completed checkouts in this period yet.</p>
        )
      ) : (
        <>
          <p className="text-micro font-semibold uppercase text-ink-faint dark:text-inkD-faint mb-1.5">Recent inventory issues</p>
          <ul className="border border-rule dark:border-ruleD rounded bg-white dark:bg-night-100 divide-y divide-rule-soft dark:divide-ruleD-soft">
            {data.recentIssues.map((r, i) => (
              <li key={i} className={`border-l-[3px] px-3.5 py-2 text-meta ${r.issue === 'Damaged' ? 'border-l-state-fault dark:border-l-stateD-fault' : 'border-l-state-attend dark:border-l-stateD-attend'}`}>
                <div className="flex justify-between">
                  <span>{r.itemName} <span className="text-ink-faint dark:text-inkD-faint">— {r.issue.toLowerCase()}</span></span>
                  {r.cost !== null && <Money muted value={r.cost} />}
                </div>
                <p className="text-ink-muted dark:text-inkD-muted tabular-nums">
                  {r.propertyName} · {r.guestName} · {format(new Date(r.date), 'd MMM yyyy')}
                </p>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}