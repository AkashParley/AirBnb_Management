import type { AttentionItem } from '@/lib/queries/operations';
import { EmptyState, SectionLabel } from '@/components/ui/primitives';

const RULE = {
  fault: 'border-l-state-fault dark:border-l-stateD-fault',
  attend: 'border-l-state-attend dark:border-l-stateD-attend',
  info: 'border-l-state-info dark:border-l-stateD-info',
} as const;

/** Left-ruled list, deliberately not a card grid. */
export function AttentionList({ items }: { items: AttentionItem[] }) {
  if (!items.length) return (
    <section>
      <SectionLabel>Needs attention</SectionLabel>
      <EmptyState title="Nothing needs you" body="Every property is on track." />
    </section>
  );
  return (
    <section>
      <SectionLabel>Needs attention · {items.length}</SectionLabel>
      <ul className="border border-rule dark:border-ruleD rounded bg-white dark:bg-night-100 px-3.5 divide-y divide-rule-soft dark:divide-ruleD-soft">
        {items.map(i => (
          <li key={i.key} className={`border-l-[3px] pl-3 py-2.5 ${RULE[i.severity]}`}>
            <p className="text-body font-medium">{i.title}</p>
            <p className="text-meta text-ink-muted dark:text-inkD-muted">{i.context}</p>
            <p className="text-meta text-ink-muted dark:text-inkD-muted tabular-nums">{i.detail}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
