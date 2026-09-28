'use client';
import { useMemo } from 'react';
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, eachWeekOfInterval,
  isSameMonth, isToday, isWeekend, format,
} from 'date-fns';
import { layoutSegments, laneCount, type Segment } from '@/lib/calendar/layout';
import type { StayRow } from '@/lib/queries/operations';
import { StatusDot } from './StatusDot';

const DAY_HEADER = 26;   // px reserved for the date number row — a fixed-height layer, never stretched
const LANE_H = 24;       // px per booking-bar lane
const LANE_GAP = 3;

/** KEEYSTAY's three brand booking colors, cycled per property for visual identification —
 *  never the sole signal of anything (StatusDot still carries booking status separately).
 *  Full literal class strings, not interpolated — Tailwind's compiler only detects classes
 *  it can find as complete strings in source, so `bg-${c}` would silently produce no CSS. */
const PALETTE = [
  'bg-booking-pink/[0.14] text-booking-pink hover:bg-booking-pink/[0.22]',
  'bg-booking-amber/[0.16] text-booking-amber hover:bg-booking-amber/[0.24]',
  'bg-booking-green/[0.14] text-booking-green hover:bg-booking-green/[0.22]',
] as const;

export function MonthGrid({ month, stays, onOpen, onEmptyClick }: {
  month: Date; stays: StayRow[]; onOpen: (id: string) => void; onEmptyClick?: (date: Date) => void;
}) {
  const weeks = useMemo(
    () => eachWeekOfInterval(
      { start: startOfMonth(month), end: endOfMonth(month) }, { weekStartsOn: 1 },
    ),
    [month],
  );

  const colorFor = useMemo(() => {
    const map = new Map<string, string>();
    return (propertyId: string) => {
      if (!map.has(propertyId)) map.set(propertyId, PALETTE[map.size % PALETTE.length]);
      return map.get(propertyId)!;
    };
  }, [stays]);

  const segments = useMemo(
    () => layoutSegments(stays.map(s => ({ ...s, start: new Date(s.checkinDate), end: new Date(s.checkoutDate) }))),
    [stays],
  );

  return (
    <div className="border border-rule dark:border-ruleD rounded-lg overflow-hidden bg-white dark:bg-night-100">
      <div className="grid grid-cols-7 border-b border-rule dark:border-ruleD">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => (
          <div key={d} className="text-micro uppercase text-ink-faint dark:text-inkD-faint font-semibold text-center py-2">{d}</div>
        ))}
      </div>
      {weeks.map(weekStart => {
        const days = eachDayOfInterval({ start: weekStart, end: endOfWeek(weekStart, { weekStartsOn: 1 }) });
        const weekSegs = segments.filter(s => s.weekStart.getTime() === weekStart.getTime());
        const lanes = laneCount(segments, weekStart);
        const barsHeight = lanes === 0 ? 0 : lanes * (LANE_H + LANE_GAP) + 4;

        return (
          <div key={weekStart.toISOString()} className="border-b border-rule-soft dark:border-ruleD-soft last:border-b-0">
            {/* Layer 1: date numbers — a fixed-height grid, always on top, never covered. */}
            <div className="grid grid-cols-7">
              {days.map(day => {
                const dim = !isSameMonth(day, month);
                const weekend = isWeekend(day);
                return (
                  <button key={day.toISOString()} onClick={() => onEmptyClick?.(day)}
                    style={{ height: DAY_HEADER }}
                    className={`text-left border-r border-rule-soft dark:border-ruleD-soft last:border-r-0 px-1.5 pt-0.5 hover:bg-ivory-100 dark:hover:bg-night-200/50 transition-colors ${
                    dim ? 'bg-ivory-50/60 dark:bg-night-50/60' : weekend ? 'bg-ivory-100/50 dark:bg-night-200/25' : ''}`}>
                    <span className={`inline-flex items-center justify-center text-meta tabular-nums rounded-sm ${
                      isToday(day)
                        ? 'font-semibold text-ivory-50 dark:text-night-50 bg-ink dark:bg-inkD w-5 h-5 -ml-0.5'
                        : dim ? 'text-ink-faint dark:text-inkD-faint' : 'text-ink-muted dark:text-inkD-muted'}`}>
                      {format(day, 'd')}
                    </span>
                  </button>
                );
              })}
            </div>
            {/* Layer 2: booking bars — its own positioning context, offset below layer 1. */}
            <div className="relative" style={{ height: barsHeight }}>
              {weekSegs.map((seg: Segment<typeof stays[number]>) => {
                const c = colorFor(seg.item.propertyId);
                return (
                  <button
                    key={`${seg.item.id}-${seg.weekStart.toISOString()}`}
                    onClick={() => onOpen(seg.item.id)}
                    title={`${seg.item.guestName} · ${seg.item.propertyName} · ${seg.item.status}`}
                    className={`absolute truncate text-left text-micro font-medium px-2 flex items-center gap-1 transition-colors
                      ${c} ${seg.isStart ? 'rounded-l-sm' : ''} ${seg.isEnd ? 'rounded-r-sm' : ''}`}
                    style={{
                      left: `calc(${(seg.startCol / 7) * 100}% + ${seg.isStart ? 2 : 0}px)`,
                      width: `calc(${(seg.span / 7) * 100}% - ${(seg.isStart ? 2 : 0) + (seg.isEnd ? 2 : 0)}px)`,
                      top: seg.lane * (LANE_H + LANE_GAP),
                      height: LANE_H,
                    }}
                  >
                    {seg.isStart && <StatusDot status={seg.item.status} />}
                    <span className="truncate">{seg.isStart ? `${seg.item.guestName} · ${seg.item.propertyName}` : seg.item.guestName}</span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}