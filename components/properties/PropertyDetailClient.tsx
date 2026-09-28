'use client';
import { useState } from 'react';
import { format } from 'date-fns';
import type { PropertyStayRow } from '@/lib/queries/operations';
import type { PropertyStatus } from '@/lib/calculations';
import { StatusTag, SectionLabel, EmptyState } from '@/components/ui/primitives';
import { StaySheet } from '@/components/stay/StaySheet';
import { TemplateEditor } from './TemplateEditor';
import { ChecklistEditor } from './ChecklistEditor';

export function PropertyDetailClient({ propertyId, current, recent, properties }: {
  propertyId: string;
  current: PropertyStayRow | null;
  recent: PropertyStayRow[];
  properties: { id: string; name: string; status: PropertyStatus; capacity: number }[];
}) {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <div className="space-y-6 max-w-2xl">
      <section>
        <SectionLabel>Current stay</SectionLabel>
        {current ? (
          <button onClick={() => setOpenId(current.id)}
            className="w-full text-left border border-rule dark:border-ruleD rounded bg-white dark:bg-night-100 p-3.5 hover:bg-ivory-100 dark:hover:bg-night-200/50">
            <span className="block font-medium">{current.guestName}</span>
            <span className="block text-meta text-ink-muted dark:text-inkD-muted tabular-nums">
              {format(new Date(current.checkinDate), 'd MMM')} → {format(new Date(current.checkoutDate), 'd MMM yyyy')}
            </span>
          </button>
        ) : (
          <EmptyState title="No one checked in" body="This property has no active stay right now." />
        )}
      </section>

      <section>
        <TemplateEditor propertyId={propertyId} />
      </section>

      <section>
        <ChecklistEditor propertyId={propertyId} />
      </section>

      <section>
        <SectionLabel>Recent stays</SectionLabel>
        {!recent.length ? (
          <EmptyState title="No stays yet" body="Completed and upcoming stays will show up here." />
        ) : (
          <ul className="border border-rule dark:border-ruleD rounded bg-white dark:bg-night-100 divide-y divide-rule-soft dark:divide-ruleD-soft">
            {recent.map(s => (
              <li key={s.id}>
                <button onClick={() => setOpenId(s.id)} className="w-full text-left px-3.5 py-2.5 flex items-center justify-between hover:bg-ivory-100 dark:hover:bg-night-200/50">
                  <span>
                    <span className="block">{s.guestName}</span>
                    <span className="block text-meta text-ink-muted dark:text-inkD-muted tabular-nums">
                      {format(new Date(s.checkinDate), 'd MMM')} → {format(new Date(s.checkoutDate), 'd MMM yyyy')}
                    </span>
                  </span>
                  {s.recon && (
                    <span className={`text-meta font-medium ${s.recon.clean ? 'text-state-ready dark:text-stateD-ready' : 'text-state-attend dark:text-stateD-attend'}`}>
                      {s.recon.clean ? '✓ Reconciled' : `⚠ ${s.recon.totalMissing + s.recon.damagedRows} issue(s)`}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {openId && <StaySheet bookingId={openId} properties={properties} onClose={() => setOpenId(null)} />}
    </div>
  );
}
