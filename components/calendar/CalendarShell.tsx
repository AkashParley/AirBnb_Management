'use client';
import { useState } from 'react';
import type { StayRow, AttentionItem, MonthStats } from '@/lib/queries/operations';
import type { PropertyStatus } from '@/lib/calculations';
import { AttentionList } from './AttentionList';
import { StatsStrip } from './StatsStrip';
import { TodayPanel } from './TodayPanel';
import { CalendarBody } from './CalendarBody';
import { StaySheet } from '@/components/stay/StaySheet';

/**
 * The one client boundary for the home page. It receives only plain, serialisable
 * data as props from the server — never a function — and owns the "which stay is
 * open" state itself, so no render-prop needs to cross the server/client line.
 */
export function CalendarShell({ day, month, stays, properties, stats, attention }: {
  day: string; month: string; stays: StayRow[];
  properties: { id: string; name: string; status: PropertyStatus; capacity: number }[];
  stats: MonthStats; attention: AttentionItem[];
}) {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <div className="flex flex-col md:flex-row gap-5">
      <div className="flex-1 min-w-0">
        <StatsStrip stats={stats} />
        <div className="mt-4">
          <CalendarBody month={new Date(month)} day={day} stays={stays} properties={properties} onOpen={setOpenId} />
        </div>
        <div className="mt-5">
          <AttentionList items={attention} />
        </div>
      </div>
      <TodayPanel day={day} stays={stays} properties={properties} />
      {openId && <StaySheet bookingId={openId} properties={properties} onClose={() => setOpenId(null)} />}
    </div>
  );
}
