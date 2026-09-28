'use client';
import type { PropertyStatus } from '@/lib/calculations';

export function PropertyFilter({ properties, value, onChange }: {
  properties: { id: string; name: string; status: PropertyStatus }[];
  value: string; onChange: (id: string) => void;
}) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)}
      className="text-meta border border-rule dark:border-ruleD rounded-sm bg-white dark:bg-night-100 px-2 py-1.5 text-ink dark:text-inkD">
      <option value="all">All properties</option>
      {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
    </select>
  );
}
