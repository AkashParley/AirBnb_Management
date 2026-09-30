import { Suspense } from 'react';
import { listBookings, listProperties } from '@/lib/queries/operations';
import { Sidebar } from '@/components/layout/Sidebar';
import { MobileBottomNav, MOBILE_NAV_CLEARANCE } from '@/components/layout/MobileBottomNav';
import { Topbar } from '@/components/layout/Topbar';
import { Skeleton, ErrorState } from '@/components/ui/primitives';
import { BookingsFilters } from '@/components/bookings/BookingsFilters';
import { BookingsPageClient } from '@/components/bookings/BookingsPageClient';
import { NewBookingButton } from '@/components/bookings/NewBookingButton';
import type { PropertyStatus } from '@/lib/calculations';

export const dynamic = 'force-dynamic';

type SP = { q?: string; status?: string; property?: string; page?: string };

export default function BookingsPage({ searchParams }: { searchParams: Promise<SP> }) {
  return (
    <div className="flex min-h-dvh bg-ivory-50 dark:bg-night-50">
      <Sidebar />
      <div className="flex-1 min-w-0">
        <Topbar />
        <div className={`p-gutter ${MOBILE_NAV_CLEARANCE}`}>
          <Suspense fallback={<div className="mt-4"><Skeleton rows={6} /></div>}>
            <Body searchParams={searchParams} />
          </Suspense>
        </div>
      </div>
      <MobileBottomNav />
    </div>
  );
}

async function Body({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  try {
    const [{ rows }, properties] = await Promise.all([
      listBookings({
        search: sp.q, status: sp.status, propertyId: sp.property,
        page: sp.page ? Number(sp.page) : 1,
      }),
      listProperties(),
    ]);
    const typedProps = properties as { id: string; name: string; status: PropertyStatus; capacity: number }[];
    return (
      <>
        <div className="flex items-center justify-between mb-1">
          <h1 className="text-title font-semibold">Bookings</h1>
          <NewBookingButton properties={typedProps} />
        </div>
        <BookingsFilters properties={typedProps} />
        <BookingsPageClient rows={rows} properties={typedProps} />
      </>
    );
  } catch (e) {
    console.error('BookingsPage', e);
    return <ErrorState message="Couldn't load bookings." />;
  }
}