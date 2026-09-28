'use client';
import { useState } from 'react';
import { MonthGrid } from './MonthGrid';
import { WeekGrid } from './WeekGrid';
import { AgendaView } from './AgendaView';
import { MonthNav } from './MonthNav';
import { PropertyFilter } from './PropertyFilter';
import { BookingSheet } from '@/components/booking/BookingSheet';
import type { StayRow } from '@/lib/queries/operations';
import type { PropertyStatus } from '@/lib/calculations';

type View = 'month' | 'week' | 'agenda';

export function CalendarBody({ month, day, stays, properties, onOpen }: {
  month: Date; day: string; stays: StayRow[];
  properties: { id: string; name: string; status: PropertyStatus; capacity: number }[];
  onOpen: (id: string) => void;
}) {
  const [view, setView] = useState<View>('month');
  const [propertyId, setPropertyId] = useState('all');
  const [draftDate, setDraftDate] = useState<Date | null>(null);

  const filtered = propertyId === 'all' ? stays : stays.filter(s => s.propertyId === propertyId);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="flex gap-1">
          {(['month', 'week', 'agenda'] as View[]).map(v => (
            <button key={v} onClick={() => setView(v)}
              className={`px-3 py-1.5 text-meta font-medium rounded-sm border capitalize ${
                view === v
                  ? 'bg-ink dark:bg-inkD text-ivory-50 dark:text-night-50 border-ink dark:border-inkD'
                  : 'border-rule dark:border-ruleD text-ink-muted dark:text-inkD-muted'
              }`}>
              {v}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <PropertyFilter properties={properties} value={propertyId} onChange={setPropertyId} />
          {(view === 'month' || view === 'week') && <MonthNav month={month} />}
        </div>
      </div>

      {view === 'month' && <MonthGrid month={month} stays={filtered} onOpen={onOpen} onEmptyClick={setDraftDate} />}
      {view === 'week' && <WeekGrid day={day} stays={filtered} onOpen={onOpen} />}
      {view === 'agenda' && <AgendaView stays={filtered} day={day} onOpen={onOpen} />}

      {draftDate && (
        <BookingSheet
          mode="create" date={draftDate}
          propertyId={propertyId !== 'all' ? propertyId : undefined}
          properties={properties}
          onClose={() => setDraftDate(null)}
          onSaved={() => setDraftDate(null)}
        />
      )}
    </div>
  );
}
