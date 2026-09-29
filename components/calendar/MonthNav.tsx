'use client';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { addMonths, subMonths, format } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * Prev/Next/Today navigation. Works for any month — nothing here is hardcoded to a
 * specific date. Navigating writes the `d` search param the server component reads.
 */
export function MonthNav({ month }: { month: Date }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const go = (d: Date) => {
    const next = new URLSearchParams(params.toString());
    next.set('d', format(d, 'yyyy-MM-dd'));
    router.push(`${pathname}?${next.toString()}` as import('next').Route);
  };

  return (
    <div className="flex items-center gap-1">
      <button aria-label="Previous month" onClick={() => go(subMonths(month, 1))}
        className="p-1.5 rounded-sm border border-rule dark:border-ruleD text-ink-muted dark:text-inkD-muted hover:text-ink dark:hover:text-inkD">
        <ChevronLeft size={15} />
      </button>
      <button onClick={() => go(new Date())}
        className="px-2.5 py-1.5 text-meta font-medium rounded-sm border border-rule dark:border-ruleD text-ink-muted dark:text-inkD-muted hover:text-ink dark:hover:text-inkD">
        Today
      </button>
      <button aria-label="Next month" onClick={() => go(addMonths(month, 1))}
        className="p-1.5 rounded-sm border border-rule dark:border-ruleD text-ink-muted dark:text-inkD-muted hover:text-ink dark:hover:text-inkD">
        <ChevronRight size={15} />
      </button>
    </div>
  );
}
