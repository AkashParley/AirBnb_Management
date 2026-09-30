import { Suspense } from 'react';
import { format, startOfMonth } from 'date-fns';
import { fetchReports } from '@/app/actions/read';
import { Sidebar } from '@/components/layout/Sidebar';
import { MobileBottomNav, MOBILE_NAV_CLEARANCE } from '@/components/layout/MobileBottomNav';
import { Topbar } from '@/components/layout/Topbar';
import { Skeleton, ErrorState } from '@/components/ui/primitives';
import { PeriodSelector } from '@/components/reports/PeriodSelector';
import { ReportsKpiStrip } from '@/components/reports/ReportsKpiStrip';
import { SecondaryKpiRow } from '@/components/reports/SecondaryKpiRow';
import { RevenueChart } from '@/components/reports/RevenueChart';
import { PropertyPerformance } from '@/components/reports/PropertyPerformance';
import { OccupancyPanel } from '@/components/reports/OccupancyPanel';
import { PaymentAnalytics } from '@/components/reports/PaymentAnalytics';
import { InventoryAnalytics } from '@/components/reports/InventoryAnalytics';

export const dynamic = 'force-dynamic';

type SP = { from?: string; to?: string };

/**
 * Management analytics — not a duplicate of the Calendar's operational Attention feed
 * and not a second Calendar. Phase 5.2: Revenue Performance is now the visually dominant
 * section (its own elevated panel, more height, more weight) rather than sitting level
 * with everything else; spacing loosened throughout so the page reads as a workspace,
 * not a dense spreadsheet. DOM order matches the brief's exact mobile stacking priority
 * (KPIs -> Revenue -> Property -> Occupancy -> Payments -> Inventory); the desktop grid
 * pairs adjacent sections (Property+Occupancy, Payments+Inventory) rather than reordering
 * anything visually, so one order serves both layouts.
 */
export default function ReportsPage({ searchParams }: { searchParams: Promise<SP> }) {
  return (
    <div className="flex min-h-dvh bg-ivory-50 dark:bg-night-50">
      <Sidebar />
      <div className="flex-1 min-w-0">
        <Topbar />
        <div className={`p-gutter ${MOBILE_NAV_CLEARANCE}`}>
          <Suspense fallback={<div className="mt-2"><Skeleton rows={6} /></div>}>
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
  const from = sp.from ?? format(startOfMonth(new Date()), 'yyyy-MM-dd');
  const to = sp.to ?? format(new Date(), 'yyyy-MM-dd');

  const result = await fetchReports(from, to);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-title font-semibold">Reports</h1>
        <PeriodSelector from={from} to={to} />
      </div>

      {!result.ok ? <ErrorState message={result.error} /> : (
        <>
          <div className="space-y-4">
            <ReportsKpiStrip data={result.data} />
            <SecondaryKpiRow data={result.data} />
          </div>

          {/* Hero — Revenue Performance is the one section given its own elevated panel. */}
          <section className="border border-rule dark:border-ruleD rounded-lg bg-white dark:bg-night-100 p-5">
            <h2 className="text-body font-semibold mb-4">Revenue performance</h2>
            <RevenueChart revenue={result.data.revenueSeries} collected={result.data.collectedSeries} granularity={result.data.bucketGranularity} />
          </section>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-x-8 gap-y-8">
            <PropertyPerformance rows={result.data.perProperty} />
            <OccupancyPanel data={result.data} />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-x-8 gap-y-8">
            <PaymentAnalytics data={result.data} />
            <InventoryAnalytics data={result.data} />
          </div>
        </>
      )}
    </div>
  );
}