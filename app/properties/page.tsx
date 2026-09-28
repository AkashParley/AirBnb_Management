import Link from 'next/link';
import { Suspense } from 'react';
import { listProperties } from '@/lib/queries/operations';
import { Sidebar } from '@/components/layout/Sidebar';
import { Topbar } from '@/components/layout/Topbar';
import { Skeleton, ErrorState, StatusTag } from '@/components/ui/primitives';
import { AddPropertyButton } from '@/components/properties/AddPropertyButton';
import type { PropertyStatus } from '@/lib/calculations';

export const dynamic = 'force-dynamic';

export default function PropertiesPage() {
  return (
    <div className="flex min-h-dvh bg-ivory-50 dark:bg-night-50">
      <Sidebar />
      <div className="flex-1 min-w-0">
        <Topbar />
        <div className="p-gutter">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-title font-semibold">Properties</h1>
            <AddPropertyButton />
          </div>
          <Suspense fallback={<Skeleton rows={4} />}><List /></Suspense>
        </div>
      </div>
    </div>
  );
}

async function List() {
  try {
    const properties = await listProperties();
    return (
      <ul className="border border-rule dark:border-ruleD rounded bg-white dark:bg-night-100 divide-y divide-rule-soft dark:divide-ruleD-soft max-w-lg">
        {properties.map(p => (
          <li key={p.id}>
            <Link href={`/properties/${p.id}`}
              className="flex items-center justify-between px-3.5 py-3 hover:bg-ivory-100 dark:hover:bg-night-200/50">
              <span className="font-medium">{p.name}</span>
              <StatusTag status={p.status as PropertyStatus} />
            </Link>
          </li>
        ))}
      </ul>
    );
  } catch (e) {
    console.error('PropertiesPage', e);
    return <ErrorState message="Couldn't load properties." />;
  }
}
