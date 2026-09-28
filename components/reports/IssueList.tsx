import { format } from 'date-fns';
import type { ReportsData } from '@/lib/queries/operations';
import { EmptyState, SectionLabel } from '@/components/ui/primitives';

/** Answers "what inventory issues happened" — every checked-out stay that wasn't clean. */
export function IssueList({ rows }: { rows: ReportsData['issueStays'] }) {
  return (
    <section>
      <SectionLabel>Inventory issues</SectionLabel>
      {!rows.length ? (
        <EmptyState title="Nothing to flag" body="Every completed checkout in this period was fully reconciled." />
      ) : (
        <ul className="border border-rule dark:border-ruleD rounded bg-white dark:bg-night-100 divide-y divide-rule-soft dark:divide-ruleD-soft">
          {rows.map(r => (
            <li key={r.id} className="border-l-[3px] border-l-state-attend dark:border-l-stateD-attend px-3.5 py-2.5">
              <p>{r.guestName} · {r.propertyName}</p>
              <p className="text-meta text-ink-muted dark:text-inkD-muted tabular-nums">
                Checked out {format(new Date(r.checkoutDate), 'd MMM yyyy')}
                {r.missing > 0 && ` · ${r.missing} missing`}
                {r.damaged > 0 && ` · ${r.damaged} damaged`}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
