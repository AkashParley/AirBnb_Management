import type { ReactNode } from 'react';
import { CircleCheck, CircleDot, Clock, Sparkles, Wrench, Ban, Search } from 'lucide-react';
import type { PropertyStatus } from '@/lib/calculations';

/* Status is icon + text + colour. Never colour alone. Bright variants activate under .dark. */
const STATUS = {
  READY:        { label: 'Ready',        Icon: CircleCheck, tone: 'text-state-ready dark:text-stateD-ready' },
  OCCUPIED:     { label: 'Occupied',     Icon: CircleDot,   tone: 'text-state-info dark:text-stateD-info' },
  CHECKOUT_DUE: { label: 'Checkout due', Icon: Clock,       tone: 'text-state-attend dark:text-stateD-attend' },
  CLEANING:     { label: 'Cleaning',     Icon: Sparkles,    tone: 'text-state-attend dark:text-stateD-attend' },
  INSPECTION:   { label: 'Inspection',   Icon: Search,      tone: 'text-state-info dark:text-stateD-info' },
  MAINTENANCE:  { label: 'Maintenance',  Icon: Wrench,      tone: 'text-state-fault dark:text-stateD-fault' },
  BLOCKED:      { label: 'Blocked',      Icon: Ban,         tone: 'text-state-fault dark:text-stateD-fault' },
} satisfies Record<PropertyStatus, { label: string; Icon: typeof CircleDot; tone: string }>;

export function StatusTag({ status }: { status: PropertyStatus }) {
  const { label, Icon, tone } = STATUS[status];
  return (
    <span className={`inline-flex items-center gap-1.5 text-meta font-medium ${tone}`}>
      <Icon aria-hidden size={13} strokeWidth={2.2} />{label}
    </span>
  );
}

export function Money({ value, muted }: { value: number; muted?: boolean }) {
  return (
    <span className={`tabular-nums font-medium ${muted ? 'text-ink-muted dark:text-inkD-muted' : 'text-ink dark:text-inkD'}`}>
      ₹{new Intl.NumberFormat('en-IN').format(value)}
    </span>
  );
}

export const SectionLabel = ({ children }: { children: ReactNode }) =>
  <h2 className="text-micro font-semibold uppercase text-ink-faint dark:text-inkD-faint mb-2">{children}</h2>;

export function EmptyState({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <div className="border border-dashed border-rule dark:border-ruleD rounded px-6 py-10 text-center">
      <p className="text-body font-medium">{title}</p>
      <p className="text-meta text-ink-muted dark:text-inkD-muted mt-1">{body}</p>
      {action && <div className="mt-4 inline-flex">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, retry }: { message: string; retry?: () => void }) {
  return (
    <div role="alert" className="border border-rule dark:border-ruleD rounded px-4 py-5 bg-state-faultBg/40 dark:bg-stateD-faultBg/40">
      <p className="text-body">{message}</p>
      {retry && <button onClick={retry} className="mt-3 text-meta font-medium underline underline-offset-4">Try again</button>}
    </div>
  );
}

export function Skeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="divide-y divide-rule-soft dark:divide-ruleD-soft border border-rule dark:border-ruleD rounded overflow-hidden" aria-busy="true">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-3 px-3.5 py-3.5">
          <div className="h-8 w-11 rounded-xs bg-ivory-200 dark:bg-night-200 animate-pulse" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-1/3 rounded-xs bg-ivory-200 dark:bg-night-200 animate-pulse" />
            <div className="h-3 w-2/3 rounded-xs bg-ivory-200 dark:bg-night-200 animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function Progress({ done, total, percent }: { done: number; total: number; percent: number }) {
  return (
    <div>
      <div className="h-[3px] bg-rule dark:bg-ruleD rounded-xs overflow-hidden">
        <div className="h-full bg-state-ready dark:bg-stateD-ready transition-[width] duration-fast" style={{ width: `${percent}%` }} />
      </div>
      <p className="text-meta text-ink-muted dark:text-inkD-muted mt-1.5 tabular-nums">{done} / {total} complete · {percent}%</p>
    </div>
  );
}

export function Tag({ tone, children }: { tone: 'ready' | 'attend' | 'fault' | 'info'; children: ReactNode }) {
  const map = {
    ready:  'bg-state-readyBg text-state-ready dark:bg-stateD-readyBg dark:text-stateD-ready',
    attend: 'bg-state-attendBg text-state-attend dark:bg-stateD-attendBg dark:text-stateD-attend',
    fault:  'bg-state-faultBg text-state-fault dark:bg-stateD-faultBg dark:text-stateD-fault',
    info:   'bg-state-infoBg text-state-info dark:bg-stateD-infoBg dark:text-stateD-info',
  } as const;
  return <span className={`px-1.5 py-0.5 rounded-xs text-micro font-semibold ${map[tone]}`}>{children}</span>;
}
