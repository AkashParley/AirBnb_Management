import Link from 'next/link';
import type { PropertyStatus } from '@/lib/calculations';
import { StatusTag, SectionLabel } from '@/components/ui/primitives';

export function PropertyRail({ properties }: {
  properties: { id: string; name: string; status: PropertyStatus }[];
}) {
  return (
    <section>
      <SectionLabel>Properties</SectionLabel>
      <ul className="flex gap-2 overflow-x-auto -mx-gutter px-gutter pb-0.5 [scrollbar-width:none] md:grid md:grid-cols-4 md:mx-0 md:px-0">
        {properties.map(p => (
          <li key={p.id} className="shrink-0 w-rail md:w-auto">
            <Link href={`/properties/${p.id}`}
              className="block border border-rule rounded bg-white p-3 hover:shadow-raise transition-shadow duration-fast focus-visible:outline-2 focus-visible:outline-ink">
              <span className="block text-body font-medium truncate">{p.name}</span>
              <span className="block mt-1.5"><StatusTag status={p.status} /></span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
