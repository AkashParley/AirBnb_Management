'use client';
import type { Route } from 'next';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useState, useMemo } from 'react';
import {
  format, startOfWeek, startOfMonth, endOfMonth, subMonths, startOfYear, subDays,
} from 'date-fns';

const PRESETS = ['Today', 'This week', 'This month', 'Last month', 'Last 3 months', 'This year', 'Custom'] as const;
type Preset = typeof PRESETS[number];

function rangeFor(preset: Preset): { from: string; to: string } | null {
  const today = new Date();
  const iso = (d: Date) => format(d, 'yyyy-MM-dd');
  switch (preset) {
    case 'Today': return { from: iso(today), to: iso(today) };
    case 'This week': return { from: iso(startOfWeek(today, { weekStartsOn: 1 })), to: iso(today) };
    case 'This month': return { from: iso(startOfMonth(today)), to: iso(today) };
    case 'Last month': { const m = subMonths(today, 1); return { from: iso(startOfMonth(m)), to: iso(endOfMonth(m)) }; }
    case 'Last 3 months': return { from: iso(subDays(today, 90)), to: iso(today) };
    case 'This year': return { from: iso(startOfYear(today)), to: iso(today) };
    default: return null; // Custom — never matched by exact range, always the fallback
  }
}

/**
 * Drives the `from`/`to` search params the Reports page's server component reads.
 * Phase 5.2 fix: the selected preset previously had no visual indication at all — every
 * button looked identical regardless of which range was active. Now the current from/to
 * is compared against each preset's computed range; whichever matches is highlighted,
 * and if none match exactly (a custom range, or one restored from a shared URL), Custom
 * is shown as active instead of leaving every button looking unselected.
 */
export function PeriodSelector({ from, to }: { from: string; to: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [customOpen, setCustomOpen] = useState(false);
  const [customFrom, setCustomFrom] = useState(from);
  const [customTo, setCustomTo] = useState(to);

  const activePreset = useMemo<Preset>(() => {
    for (const p of PRESETS) {
      const r = rangeFor(p);
      if (r && r.from === from && r.to === to) return p;
    }
    return 'Custom';
  }, [from, to]);

  const apply = (f: string, t: string) => {
    const next = new URLSearchParams(params.toString());
    next.set('from', f); next.set('to', t);
    router.push(`${pathname}?${next.toString()}` as Route);
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {PRESETS.map(p => {
        const active = p === activePreset;
        return (
          <button key={p}
            onClick={() => { if (p === 'Custom') { setCustomOpen(v => !v); return; } setCustomOpen(false); const r = rangeFor(p); if (r) apply(r.from, r.to); }}
            aria-pressed={active}
            className={`px-2.5 py-1.5 text-meta font-medium rounded-sm border transition-colors ${
              active
                ? 'bg-ink dark:bg-inkD text-ivory-50 dark:text-night-50 border-ink dark:border-inkD'
                : 'border-rule dark:border-ruleD text-ink-muted dark:text-inkD-muted hover:text-ink dark:hover:text-inkD'}`}>
            {p}
          </button>
        );
      })}
      {(customOpen || activePreset === 'Custom') && (
        <div className="flex items-center gap-1.5 ml-1">
          <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
            className="border border-rule dark:border-ruleD rounded px-2 py-1 text-meta bg-white dark:bg-night-100" />
          <span className="text-meta text-ink-faint dark:text-inkD-faint">to</span>
          <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}
            className="border border-rule dark:border-ruleD rounded px-2 py-1 text-meta bg-white dark:bg-night-100" />
          <button onClick={() => apply(customFrom, customTo)}
            className="px-2.5 py-1 text-meta font-medium rounded-sm bg-ink dark:bg-inkD text-ivory-50 dark:text-night-50">Go</button>
        </div>
      )}
    </div>
  );
}