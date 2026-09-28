import type { ReportsData } from '@/lib/queries/operations';
import { Money, SectionLabel } from '@/components/ui/primitives';

/** Analytics only — no payment history, no per-booking drill-down. That's the Stay Workspace's job. */
export function PaymentAnalytics({ data }: { data: ReportsData }) {
  const total = data.bookingsCount || 1;
  const dist = data.paymentDistribution;
  const seg = (n: number) => Math.round((n / total) * 100);

  return (
    <section>
      <SectionLabel>Payments</SectionLabel>
      <div className="border border-rule dark:border-ruleD rounded bg-white dark:bg-night-100 p-3.5">
        <div className="flex justify-between text-meta mb-3">
          <span className="text-ink-muted dark:text-inkD-muted">Total value</span>
          <Money value={data.revenue} />
        </div>
        <div className="flex justify-between text-meta mb-1">
          <span className="text-ink-muted dark:text-inkD-muted">Collected</span>
          <Money value={data.collected} />
        </div>
        <div className="flex justify-between text-meta mb-3">
          <span className="text-ink-muted dark:text-inkD-muted">Outstanding</span>
          <Money value={data.outstanding} />
        </div>

        <div className="h-2 rounded-xs overflow-hidden flex mb-2">
          <div className="bg-state-ready dark:bg-stateD-ready" style={{ width: `${seg(dist.PAID)}%` }} />
          <div className="bg-state-attend dark:bg-stateD-attend" style={{ width: `${seg(dist.PARTIAL)}%` }} />
          <div className="bg-state-fault dark:bg-stateD-fault" style={{ width: `${seg(dist.PENDING)}%` }} />
        </div>
        <div className="flex flex-wrap gap-x-4 text-meta tabular-nums">
          <span className="flex items-center gap-1.5"><Dot tone="ready" /> Paid {dist.PAID}</span>
          <span className="flex items-center gap-1.5"><Dot tone="attend" /> Partial {dist.PARTIAL}</span>
          <span className="flex items-center gap-1.5"><Dot tone="fault" /> Pending {dist.PENDING}</span>
        </div>
      </div>
    </section>
  );
}

function Dot({ tone }: { tone: 'ready' | 'attend' | 'fault' }) {
  const map = { ready: 'bg-state-ready dark:bg-stateD-ready', attend: 'bg-state-attend dark:bg-stateD-attend', fault: 'bg-state-fault dark:bg-stateD-fault' };
  return <span className={`inline-block size-2 rounded-full ${map[tone]}`} />;
}