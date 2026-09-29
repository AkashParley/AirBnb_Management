'use client';
import { useMemo } from 'react';
import { startOfWeek, endOfWeek, eachDayOfInterval, isToday, format } from 'date-fns';
import { layoutSegments, laneCount } from '@/lib/calendar/layout';
import type { StayRow } from '@/lib/queries/operations';
import { StatusDot } from './StatusDot';

const DAY_HEADER = 44;   // fixed-height layer for the weekday/date label — see MonthGrid for why
const LANE_H = 30;
const LANE_GAP = 4;

const PALETTE = [
  'bg-booking-pink/[0.14] text-booking-pink hover:bg-booking-pink/[0.22]',
  'bg-booking-amber/[0.16] text-booking-amber hover:bg-booking-amber/[0.24]',
  'bg-booking-green/[0.14] text-booking-green hover:bg-booking-green/[0.22]',
] as const;

/**
 * One-week zoom of the same layout engine as MonthGrid. Day labels and booking bars are
 * two independent layers (fixed-height header grid, then a separately-offset bar layer)
 * for the same reason documented in MonthGrid.tsx: a single grid stretches its one row to
 * fill the container, which pushes stretched day cells behind/under the bars.
 */
export function WeekGrid({ day, stays, onOpen }: {
  day: string; stays: StayRow[]; onOpen: (id: string) => void;
}) {
  const weekStart = startOfWeek(new Date(day), { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: weekStart, end: endOfWeek(weekStart, { weekStartsOn: 1 }) });

  const colorFor = useMemo(() => {
    const map = new Map<string, string>();
    return (propertyId: string) => {
      if (!map.has(propertyId)) map.set(propertyId, PALETTE[map.size % PALETTE.length]!);
      return map.get(propertyId)!;
    };
  }, [stays]);

  const segments = useMemo(
    () => layoutSegments(stays.map(s => ({ ...s, start: new Date(s.checkinDate), end: new Date(s.checkoutDate) })))
      .filter(s => s.weekStart.getTime() === weekStart.getTime()),
    [stays, weekStart],
  );
  const lanes = laneCount(segments, weekStart);
  const barsHeight = Math.max(lanes, 1) * (LANE_H + LANE_GAP) + 6;

  return (
    <div className="border border-rule dark:border-ruleD rounded-lg overflow-hidden bg-white dark:bg-night-100">
      {/* Layer 1: day labels — fixed height, always visible. */}
      <div className="grid grid-cols-7 border-b border-rule-soft dark:border-ruleD-soft" style={{ height: DAY_HEADER }}>
        {days.map(d => (
          <div key={d.toISOString()} className="border-r border-rule-soft dark:border-ruleD-soft last:border-r-0 px-2 pt-2">
            <p className="text-micro uppercase text-ink-faint dark:text-inkD-faint font-semibold">{format(d, 'EEE')}</p>
            <p className={`text-body tabular-nums ${isToday(d)
              ? 'inline-flex items-center justify-center font-semibold text-ivory-50 dark:text-night-50 bg-ink dark:bg-inkD w-6 h-6 rounded-sm'
              : 'text-ink-muted dark:text-inkD-muted'}`}>
              {isToday(d) ? format(d, 'd') : format(d, 'd MMM')}
            </p>
          </div>
        ))}
      </div>
      {/* Layer 2: booking bars — its own positioning context, never sharing a row with layer 1. */}
      <div className="relative" style={{ height: barsHeight }}>
        {segments.map(seg => (
          <button key={`${seg.item.id}-wk`} onClick={() => onOpen(seg.item.id)}
            title={`${seg.item.guestName} · ${seg.item.propertyName} · ${seg.item.status}`}
            className={`absolute truncate text-left text-meta font-medium px-2 flex items-center gap-1.5 transition-colors ${colorFor(seg.item.propertyId)}
              ${seg.isStart ? 'rounded-l-sm' : ''} ${seg.isEnd ? 'rounded-r-sm' : ''}`}
            style={{
              left: `calc(${(seg.startCol / 7) * 100}% + ${seg.isStart ? 3 : 0}px)`,
              width: `calc(${(seg.span / 7) * 100}% - ${(seg.isStart ? 3 : 0) + (seg.isEnd ? 3 : 0)}px)`,
              top: seg.lane * (LANE_H + LANE_GAP),
              height: LANE_H,
            }}>
            <StatusDot status={seg.item.status} />
            <span className="truncate">{seg.item.guestName} · {seg.item.propertyName}</span>
          </button>
        ))}
      </div>
    </div>
  );
}