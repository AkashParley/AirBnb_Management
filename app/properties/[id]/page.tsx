import { Suspense } from 'react';
import { fetchPropertyPage } from '@/app/actions/read';
import { listProperties } from '@/lib/queries/operations';
import { Sidebar } from '@/components/layout/Sidebar';
import { MobileBottomNav, MOBILE_NAV_CLEARANCE } from '@/components/layout/MobileBottomNav';
import { Topbar } from '@/components/layout/Topbar';
import { Skeleton, ErrorState, StatusTag } from '@/components/ui/primitives';
import { PropertyDetailClient } from '@/components/properties/PropertyDetailClient';
import type { PropertyStatus } from '@/lib/calculations';

export const dynamic = 'force-dynamic';

export default function PropertyPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <div className="flex min-h-dvh bg-ivory-50 dark:bg-night-50">
      <Sidebar />
      <div className="flex-1 min-w-0">
        <Topbar />
        <div className={`p-gutter ${MOBILE_NAV_CLEARANCE}`}>
          <Suspense fallback={<Skeleton rows={6} />}>
            <Body params={params} />
          </Suspense>
        </div>
      </div>
      <MobileBottomNav />
    </div>
  );
}

async function Body({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [pageResult, allProperties] = await Promise.all([fetchPropertyPage(id), listProperties()]);
  if (!pageResult.ok) return <ErrorState message={pageResult.error} />;
  const { property, current, recent } = pageResult.data;
  const typedProps = allProperties as { id: string; name: string; status: PropertyStatus; capacity: number }[];

  return (
    <>
      <div className="flex items-baseline gap-3 mb-1">
        <h1 className="text-title font-semibold">{property.name}</h1>
        <StatusTag status={property.status as PropertyStatus} />
      </div>
      {property.address && <p className="text-meta text-ink-muted dark:text-inkD-muted mb-5">{property.address}</p>}
      <PropertyDetailClient propertyId={id} current={current} recent={recent} properties={typedProps} />
    </>
  );
}