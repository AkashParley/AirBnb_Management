/**
 * Pure grid-positioning math for a true multi-day month calendar: which row (week) and
 * which column-span each booking occupies, with vertical "lanes" so overlapping bookings
 * on the same property/week stack instead of colliding. No React, no dates-as-strings math
 * left to components — this is the single source of truth an agent should extend.
 */
import { startOfWeek, endOfWeek, differenceInCalendarDays, addDays, max, min } from 'date-fns';

export interface DateSpan { start: Date; end: Date; }

export interface Segment<T> {
  item: T;
  weekStart: Date;      // the Monday of the week this segment falls in
  startCol: number;      // 0=Mon .. 6=Sun
  span: number;           // number of days this segment covers within its week (1..7)
  isStart: boolean;       // true if this segment contains the booking's actual check-in
  isEnd: boolean;         // true if this segment contains the last OCCUPIED day (checkout − 1)
  lane: number;           // vertical stacking row within the week, assigned to avoid overlap
}

/**
 * Splits every item's date range into one segment per calendar week it touches (a booking
 * crossing a week or month boundary becomes multiple segments, each independently laid out),
 * then assigns each segment a lane within its week so overlapping items stack rather than
 * overlap visually. weekStartsOn: 1 = Monday, matching MonthGrid.
 *
 * Checkout is an EXCLUSIVE boundary (standard hotel-style date semantics), not a fully
 * occupied day. A stay from the 21st to the 24th occupies the 21st, 22nd and 23rd, and the
 * bar terminates at the 24th's left edge — it does not fill the 24th's cell. This also
 * matters for same-day turnovers: a checkout on the 24th and a different booking's check-in
 * on the 24th must not visually overlap by a day, which they would if checkout were treated
 * as inclusive.
 */
export function layoutSegments<T extends DateSpan>(items: T[]): Segment<T>[] {
  const segments: Segment<T>[] = [];

  for (const item of items) {
    const lastOccupiedDay = addDays(item.end, -1); // checkout itself is never rendered as occupied
    let cursor = startOfWeek(item.start, { weekStartsOn: 1 });

    while (cursor <= lastOccupiedDay) {
      const weekStart = cursor;
      const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
      const segStart = max([item.start, weekStart]);
      const segEnd = min([lastOccupiedDay, weekEnd]);

      segments.push({
        item, weekStart,
        startCol: differenceInCalendarDays(segStart, weekStart),
        span: differenceInCalendarDays(segEnd, segStart) + 1,
        isStart: segStart.getTime() === item.start.getTime(),
        isEnd: segEnd.getTime() === lastOccupiedDay.getTime(),
        lane: 0, // assigned below
      });

      cursor = new Date(weekEnd.getTime() + 86_400_000); // next week
    }
  }

  // Assign lanes per week: greedily give each segment the lowest lane that doesn't
  // collide (by column range) with another segment already placed in that lane.
  const byWeek = new Map<number, Segment<T>[]>();
  for (const s of segments) {
    const key = s.weekStart.getTime();
    (byWeek.get(key) ?? byWeek.set(key, []).get(key)!).push(s);
  }

  for (const weekSegs of byWeek.values()) {
    weekSegs.sort((a, b) => a.startCol - b.startCol || b.span - a.span);
    const lanes: { endCol: number }[] = [];
    for (const seg of weekSegs) {
      const segEndCol = seg.startCol + seg.span - 1;
      let lane = lanes.findIndex(l => l.endCol < seg.startCol);
      const reusable = lane === -1 ? undefined : lanes[lane];
      if (reusable) { reusable.endCol = segEndCol; }
      else { lane = lanes.length; lanes.push({ endCol: segEndCol }); }
      seg.lane = lane;
    }
  }

  return segments;
}

/** How many lanes a given week needs, so the grid can reserve enough vertical room. */
export function laneCount<T>(segments: Segment<T>[], weekStart: Date): number {
  const here = segments.filter(s => s.weekStart.getTime() === weekStart.getTime());
  return here.length ? Math.max(...here.map(s => s.lane)) + 1 : 0;
}