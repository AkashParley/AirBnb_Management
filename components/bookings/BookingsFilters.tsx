'use client';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Search } from 'lucide-react';

const STATUSES = ['CONFIRMED', 'IN_STAY', 'CHECKED_OUT', 'CANCELLED'];

export function BookingsFilters({ properties }: { properties: { id: string; name: string }[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get('q') ?? '');
  const [, start] = useTransition();

  const push = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) v === null ? next.delete(k) : next.set(k, v);
    next.delete('page');
    start(() => router.push(`${pathname}?${next.toString()}` as import('next').Route));
  };

  return (
    <div className="flex flex-wrap gap-2 mb-4">
      <div className="relative flex-1 min-w-[180px]">
        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-faint dark:text-inkD-faint" />
        <input value={q} placeholder="Search guest or property…"
          onChange={e => setQ(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && push({ q: q || null })}
          onBlur={() => push({ q: q || null })}
          className="w-full pl-8 pr-3 py-2 text-meta border border-rule dark:border-ruleD rounded bg-white dark:bg-night-100" />
      </div>
      <select defaultValue={params.get('status') ?? ''} onChange={e => push({ status: e.target.value || null })}
        className="text-meta border border-rule dark:border-ruleD rounded px-2 py-2 bg-white dark:bg-night-100">
        <option value="">All statuses</option>
        {STATUSES.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
      </select>
      <select defaultValue={params.get('property') ?? ''} onChange={e => push({ property: e.target.value || null })}
        className="text-meta border border-rule dark:border-ruleD rounded px-2 py-2 bg-white dark:bg-night-100">
        <option value="">All properties</option>
        {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>
    </div>
  );
}
