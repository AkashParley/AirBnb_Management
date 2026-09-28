import { Suspense } from 'react';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { loadMonthOverview, loadAttention } from '@/lib/queries/operations';
import { Sidebar } from '@/components/layout/Sidebar';
import { Topbar } from '@/components/layout/Topbar';
import { Skeleton } from '@/components/ui/primitives';
import { CalendarShell } from '@/components/calendar/CalendarShell';
import type { PropertyStatus } from '@/lib/calculations';

export const dynamic = 'force-dynamic';   // per-user data, never statically cached

export default async function Home({ searchParams }: { searchParams: Promise<{ d?: string }> }) {
  const { d } = await searchParams;
  const day = d ?? new Date().toISOString().slice(0, 10);
  const monthFrom = format(startOfMonth(new Date(day)), 'yyyy-MM-dd');
  const monthTo = format(endOfMonth(new Date(day)), 'yyyy-MM-dd');

  return (
    <div className="flex min-h-dvh bg-ivory-50 dark:bg-night-50">
      <Sidebar />
      <div className="flex-1 min-w-0">
        <Topbar />
        <div className="p-gutter">
          <h1 className="text-title font-semibold mb-1">{format(new Date(day), 'MMMM yyyy')}</h1>
          <Suspense fallback={<Skeleton rows={4} />}>
            <Body day={day} monthFrom={monthFrom} monthTo={monthTo} />
          </Suspense>
        </div>
      </div>
    </div>
  );
}

async function Body({ day, monthFrom, monthTo }: { day: string; monthFrom: string; monthTo: string }) {
  const [{ properties, stays, stats }, attention] = await Promise.all([
    loadMonthOverview(monthFrom, monthTo), loadAttention(),
  ]);
  const typedProps = properties as { id: string; name: string; status: PropertyStatus; capacity: number }[];

  return (
    <CalendarShell
      day={day} month={monthFrom} stays={stays}
      properties={typedProps} stats={stats} attention={attention}
    />
  );
}
