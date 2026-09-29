'use client';
import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import type { ReportsData } from '@/lib/queries/operations';
import { formatINRCompact } from '@/lib/calculations';
import { EmptyState } from '@/components/ui/primitives';

const W = 860, H = 280, PAD_L = 8, PAD_R = 8, PAD_T = 16, PAD_B = 26;

/**
 * Revenue vs Collected — the hero analytical section (Phase 5.2: given more height and
 * visual weight than any other chart on the page, matching its status as the most
 * important section). The gap between the two lines IS the outstanding-payment signal;
 * rather than add a third "Outstanding" series (redundant with that gap, and the brief
 * explicitly warned against clutter), the gap itself is now shaded so the relationship
 * reads at a glance instead of requiring the eye to compare two line heights.
 */
export function RevenueChart({ revenue, collected, granularity }: {
  revenue: ReportsData['revenueSeries']; collected: ReportsData['collectedSeries']; granularity: 'day' | 'month';
}) {
  const [hover, setHover] = useState<number | null>(null);

  const { revPath, colPath, bandPath, points } = useMemo(() => {
    if (!revenue.length) return { revPath: '', colPath: '', bandPath: '', points: [] as { x: number; ry: number; cy: number }[] };
    const max = Math.max(...revenue.map(s => s.value), ...collected.map(s => s.value), 1);
    const innerW = W - PAD_L - PAD_R, innerH = H - PAD_T - PAD_B;
    const step = revenue.length > 1 ? innerW / (revenue.length - 1) : 0;
    const y = (v: number) => PAD_T + innerH - (v / max) * innerH;
    const points = revenue.map((s, i) => ({ x: PAD_L + i * step, ry: y(s.value), cy: y(collected[i]?.value ?? 0) }));
    const revPath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.ry.toFixed(1)}`).join(' ');
    const colPath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.cy.toFixed(1)}`).join(' ');
    // Outstanding band: the shape between the two curves — forward along revenue, back along collected.
    const bandPath = [
      ...points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.ry.toFixed(1)}`),
      ...[...points].reverse().map(p => `L ${p.x.toFixed(1)} ${p.cy.toFixed(1)}`),
      'Z',
    ].join(' ');
    return { revPath, colPath, bandPath, points };
  }, [revenue, collected]);

  if (!revenue.length) return <EmptyState title="No revenue in this period" body="Bookings with a check-in date in this range will appear here." />;

  const labelEvery = Math.max(1, Math.ceil(revenue.length / 8));
  // noUncheckedIndexedAccess: indexed reads are `T | undefined`, so resolve the hovered
  // bucket once, up front, instead of re-indexing (and asserting) at each use below.
  const hoverPoint = hover !== null ? points[hover] : undefined;
  const hoverRevenue = hover !== null ? revenue[hover] : undefined;
  const hoverCollected = hover !== null ? collected[hover] : undefined;
  const fmtLabel = (label: string) => granularity === 'day' ? format(new Date(label), 'd MMM') : format(new Date(label + '-01'), 'MMM yyyy');
  const totalOutstanding = revenue.reduce((a, s, i) => a + Math.max(0, s.value - (collected[i]?.value ?? 0)), 0);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 mb-3 text-meta">
        <span className="flex items-center gap-1.5 text-ink-muted dark:text-inkD-muted">
          <span className="inline-block w-3 h-[2px] bg-state-info dark:bg-stateD-info" /> Revenue
        </span>
        <span className="flex items-center gap-1.5 text-ink-muted dark:text-inkD-muted">
          <svg width="12" height="2"><line x1="0" y1="1" x2="12" y2="1" stroke="currentColor" strokeWidth="2" strokeDasharray="3 2" /></svg>
          Collected
        </span>
        <span className="flex items-center gap-1.5 text-ink-muted dark:text-inkD-muted">
          <span className="inline-block w-3 h-2.5 bg-state-attend dark:bg-stateD-attend opacity-25 rounded-[1px]" /> Outstanding
        </span>
        <span className="ml-auto tabular-nums font-medium">
          {hoverRevenue
            ? `${fmtLabel(hoverRevenue.label)} · ${formatINRCompact(hoverRevenue.value)} rev · ${formatINRCompact(hoverCollected?.value ?? 0)} collected`
            : totalOutstanding > 0 ? `${formatINRCompact(totalOutstanding)} outstanding across this period` : 'Fully collected this period'}
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Revenue vs collected"
        onMouseLeave={() => setHover(null)}>
        <path d={bandPath} className="fill-state-attend dark:fill-stateD-attend" fillOpacity="0.12" stroke="none" />
        <path d={revPath} fill="none" className="text-state-info dark:text-stateD-info" stroke="currentColor"
          strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        <path d={colPath} fill="none" className="text-state-ready dark:text-stateD-ready" stroke="currentColor"
          strokeWidth="1.75" strokeDasharray="4 3" strokeLinecap="round" />
        {points.map((p, i) => (
          <rect key={i} x={p.x - (W / points.length) / 2} y={PAD_T} width={W / points.length} height={H - PAD_T - PAD_B}
            fill="transparent" onMouseEnter={() => setHover(i)} />
        ))}
        {hoverPoint && <line x1={hoverPoint.x} x2={hoverPoint.x} y1={PAD_T} y2={H - PAD_B} stroke="currentColor" strokeOpacity="0.15" />}
        {revenue.map((s, i) => {
          const p = points[i];
          if (!p || i % labelEvery !== 0) return null;
          return (
            <text key={s.label} x={p.x} y={H - 8} textAnchor="middle"
              className="fill-ink-faint dark:fill-inkD-faint" style={{ font: '10px inherit' }}>
              {fmtLabel(s.label)}
            </text>
          );
        })}
      </svg>
    </div>
  );
}