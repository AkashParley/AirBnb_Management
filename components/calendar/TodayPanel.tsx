import Link from 'next/link';
import { ArrowUpRight, ArrowDownRight, ArrowLeftRight, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import type { StayRow } from '@/lib/queries/operations';
import { StatusTag } from '@/components/ui/primitives';
import type { PropertyStatus } from '@/lib/calculations';

export function TodayPanel({ day, stays, properties }: {
  day: string; stays: StayRow[];
  properties: { id: string; name: string; status: PropertyStatus }[];
}) {
  const checkins = stays.filter(s => s.checkinDate === day).length;
  const checkouts = stays.filter(s => s.checkoutDate === day).length;
  const turnovers = stays.filter(s => s.turnover.sameDay).length;
  const pending = stays.filter(s => s.payment.remaining > 0).length;

  return (
    <aside className="w-full md:w-72 shrink-0 space-y-5">
      <div>
        <h2 className="text-title font-semibold">Today</h2>
        <p className="text-meta text-ink-faint dark:text-inkD-faint uppercase">{format(new Date(day), 'EEE d MMM yyyy')}</p>
        <ul className="mt-3 space-y-2">
          <Stat Icon={ArrowUpRight} tone="text-state-ready dark:text-stateD-ready" label="Check-ins" value={checkins} />
          <Stat Icon={ArrowDownRight} tone="text-state-fault dark:text-stateD-fault" label="Check-outs" value={checkouts} />
          <Stat Icon={ArrowLeftRight} tone="text-state-info dark:text-stateD-info" label="Turnover" value={turnovers} />
          <Stat Icon={AlertCircle} tone="text-state-attend dark:text-stateD-attend" label="Pending payments" value={pending} />
        </ul>
      </div>

      <div>
        <div className="flex items-baseline justify-between">
          <h3 className="text-micro font-semibold uppercase text-ink-faint dark:text-inkD-faint">Property status</h3>
          <Link href="/properties" className="text-micro text-ink-muted dark:text-inkD-muted underline underline-offset-2">View all</Link>
        </div>
        <ul className="mt-2 border border-rule dark:border-ruleD rounded bg-white dark:bg-night-100 divide-y divide-rule-soft dark:divide-ruleD-soft">
          {properties.map(p => (
            <li key={p.id} className="flex items-center justify-between px-3 py-2.5">
              <span className="text-body">{p.name}</span>
              <StatusTag status={p.status} />
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}

function Stat({ Icon, tone, label, value }: { Icon: typeof ArrowUpRight; tone: string; label: string; value: number }) {
  return (
    <li className="flex items-center gap-2.5 text-body">
      <Icon size={15} className={tone} strokeWidth={2} />
      <span className="tabular-nums font-semibold">{value}</span>
      <span className="text-ink-muted dark:text-inkD-muted">{label}</span>
    </li>
  );
}
