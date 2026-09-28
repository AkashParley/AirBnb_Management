'use client';
import { motion, useReducedMotion } from 'framer-motion';
import type { StayRow } from '@/lib/queries/operations';
import { timeLabel } from '@/lib/time';
import { Money, EmptyState, SectionLabel, Tag } from '@/components/ui/primitives';

/** Mobile-first: one chronological spine, not a squeezed month grid. */
export function AgendaView({ stays, day, onOpen }: {
  stays: StayRow[]; day: string; onOpen: (id: string) => void;
}) {
  const reduce = useReducedMotion();
  const events = stays.flatMap(s => [
    ...(s.checkinDate === day ? [{ at: s.checkinAt, kind: 'in' as const, stay: s }] : []),
    ...(s.checkoutDate === day ? [{ at: s.checkoutAt, kind: 'out' as const, stay: s }] : []),
  ]).sort((a, b) => a.at.getTime() - b.at.getTime());

  // In-house stays that neither start nor end today — context, not actions for today.
  const hosting = stays.filter(s => s.checkinDate < day && s.checkoutDate > day);

  if (!events.length && !hosting.length) return (
    <section>
      <SectionLabel>Schedule</SectionLabel>
      <EmptyState title="No arrivals or departures" body="Your calendar is clear for this day." />
    </section>
  );

  return (
    <section className="space-y-5">
      {events.length > 0 && <EventList events={events} onOpen={onOpen} reduce={!!reduce} />}
      {hosting.length > 0 && (
        <div>
          <SectionLabel>Currently hosting · {hosting.length}</SectionLabel>
          <ul className="border border-rule dark:border-ruleD rounded bg-white dark:bg-night-100 divide-y divide-rule-soft dark:divide-ruleD-soft overflow-hidden">
            {hosting.map(s => (
              <li key={s.id}>
                <button onClick={() => onOpen(s.id)}
                  className="w-full flex justify-between gap-3 px-3.5 py-2.5 text-left active:bg-ivory-200 dark:active:bg-night-200">
                  <span>
                    <span className="block font-medium">{s.guestName}</span>
                    <span className="block text-meta text-ink-muted dark:text-inkD-muted">{s.propertyName}</span>
                  </span>
                  <span className="text-meta text-ink-faint dark:text-inkD-faint self-center">until {s.checkoutDate}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function EventList({ events, onOpen, reduce }: {
  events: { at: Date; kind: 'in' | 'out'; stay: StayRow }[]; onOpen: (id: string) => void; reduce: boolean;
}) {
  return (
    <div>
      <SectionLabel>Schedule</SectionLabel>
      <ul className="border border-rule dark:border-ruleD rounded bg-white dark:bg-night-100 divide-y divide-rule-soft dark:divide-ruleD-soft overflow-hidden">
        {events.map((e, i) => {
          const pay = e.stay.payment;
          return (
            <motion.li key={`${e.stay.id}-${e.kind}`}
              initial={reduce ? false : { opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.12, delay: reduce ? 0 : i * 0.02 }}>
              <button onClick={() => onOpen(e.stay.id)}
                className="w-full flex gap-3 px-3.5 py-3.5 text-left active:bg-ivory-200 dark:active:bg-night-200 focus-visible:outline-2 focus-visible:outline-ink dark:focus-visible:outline-inkD">
                <span className="w-12 shrink-0 text-meta text-ink-muted dark:text-inkD-muted">
                  <strong className="block text-body font-semibold tabular-nums text-ink dark:text-inkD">{timeLabel(e.at)}</strong>
                  {e.kind === 'in' ? 'in' : 'out'}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block font-medium">{e.stay.guestName}</span>
                  <span className="block text-meta text-ink-muted dark:text-inkD-muted truncate">
                    {e.stay.propertyName} · {e.stay.guestCount} guests · {e.stay.source}
                  </span>
                  <span className="mt-1.5 flex flex-wrap gap-1.5">
                    <Tag tone={pay.status === 'PAID' ? 'ready' : pay.status === 'PARTIAL' ? 'attend' : 'fault'}>
                      {pay.status === 'PAID' ? 'Paid' : `${pay.status === 'PARTIAL' ? 'Partial' : 'Unpaid'} · ₹${pay.remaining.toLocaleString('en-IN')} due`}
                    </Tag>
                    {e.stay.turnover.sameDay && <Tag tone="info">Same-day · {e.stay.turnover.label}</Tag>}
                  </span>
                </span>
                <span className="shrink-0 text-meta pt-0.5"><Money muted value={pay.total} /></span>
              </button>
            </motion.li>
          );
        })}
      </ul>
    </div>
  );
}
