import { format } from 'date-fns';
import type { ReportsData } from '@/lib/queries/operations';
import { Money, EmptyState, SectionLabel } from '@/components/ui/primitives';

/** Item-level inventory issues, straight from ReportsData['recentIssues']. */
export function IssueList({ rows }: { rows: ReportsData['recentIssues'] }) {
  return (
    <section>
      <SectionLabel>Inventory issues</SectionLabel>
      {!rows.length ? (
        <EmptyState title="Nothing to flag" body="Every completed checkout in this period was fully reconciled." />
      ) : (
        <ul className="border border-rule dark:border-ruleD rounded bg-white dark:bg-night-100 divide-y divide-rule-soft dark:divide-ruleD-soft">
          {rows.map((r, i) => (
            <li key={`${r.date}-${r.guestName}-${r.itemName}-${r.issue}-${i}`}
              className="border-l-[3px] border-l-state-attend dark:border-l-stateD-attend px-3.5 py-2.5">
              <div className="flex justify-between">
                <p>{r.itemName} <span className="text-ink-faint dark:text-inkD-faint">— {r.issue.toLowerCase()}</span></p>
                {r.cost !== null && <Money muted value={r.cost} />}
              </div>
              <p className="text-meta text-ink-muted dark:text-inkD-muted tabular-nums">
                {r.propertyName} · {r.guestName} · {format(new Date(r.date), 'd MMM yyyy')}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}