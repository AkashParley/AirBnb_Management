import { describe, it, expect } from 'vitest';
import { layoutSegments, laneCount, type DateSpan } from '../layout';

const d = (s: string) => new Date(s + 'T00:00:00');
interface Booking extends DateSpan { id: string }
const b = (id: string, start: string, end: string): Booking => ({ id, start: d(start), end: d(end) });

/**
 * Checkout is an EXCLUSIVE boundary — a stay from the 21st to the 24th occupies the
 * 21st/22nd/23rd only. This file was rewritten for that semantic (Phase 4.1); the old
 * version asserted the inclusive-checkout behavior that caused bars to visually overrun
 * their actual stay range.
 */
describe('layoutSegments — checkout as exclusive boundary', () => {
  it('A: a one-night stay is a one-day-wide segment', () => {
    const segs = layoutSegments([b('a', '2026-09-21', '2026-09-22')]);
    expect(segs).toHaveLength(1);
    expect(segs[0]?.span).toBe(1);
  });

  it('B: 21st -> 24th occupies 21/22/23 and terminates at the 24th boundary', () => {
    // Both dates fall in the same Mon-Sun week (Mon 2026-09-21).
    const segs = layoutSegments([b('a', '2026-09-21', '2026-09-24')]);
    expect(segs).toHaveLength(1);
    expect(segs[0]).toMatchObject({ startCol: 0, span: 3, isStart: true, isEnd: true });
  });

  it('C: 21st -> 30th terminates exactly at the 30th boundary (9 occupied days)', () => {
    const segs = layoutSegments([b('a', '2026-09-21', '2026-09-30')]);
    const totalSpan = segs.reduce((n, s) => n + s.span, 0);
    expect(totalSpan).toBe(9); // 21..29 inclusive
    const last = segs.find(s => s.isEnd)!;
    expect(last).toBeDefined();
  });

  it('D: a stay crossing the month boundary splits without extending past checkout', () => {
    const segs = layoutSegments([b('a', '2026-09-28', '2026-10-03')]);
    const totalSpan = segs.reduce((n, s) => n + s.span, 0);
    expect(totalSpan).toBe(5); // Sep28,29,30,Oct1,Oct2 — Oct 3 itself is the exclusive checkout
    expect(segs.some(s => s.isEnd)).toBe(true);
  });

  it('E: a checkout and a same-day check-in meet at the boundary without overlapping', () => {
    const segs = layoutSegments([
      b('a', '2026-09-21', '2026-09-24'), // occupies 21,22,23
      b('b', '2026-09-24', '2026-09-27'), // occupies 24,25,26
    ]);
    const segA = segs.find(s => s.item.id === 'a')!;
    const segB = segs.find(s => s.item.id === 'b')!;
    const aEndCol = segA.startCol + segA.span - 1;
    expect(aEndCol).toBeLessThan(segB.startCol); // no shared column
    expect(segA.lane).toBe(segB.lane); // and since they don't overlap, they can share a lane
  });

  it('F: genuinely overlapping bookings still use separate lanes', () => {
    const segs = layoutSegments([
      b('a', '2026-09-21', '2026-09-26'), // occupies 21-25
      b('b', '2026-09-23', '2026-09-25'), // occupies 23-24, inside A's range
    ]);
    const segA = segs.find(s => s.item.id === 'a')!;
    const segB = segs.find(s => s.item.id === 'b')!;
    expect(segA.lane).not.toBe(segB.lane);
  });

  it('splits a booking crossing a week boundary into two segments, each excluding checkout', () => {
    const segs = layoutSegments([b('a', '2026-09-18', '2026-09-22')]); // Fri..Mon(excl) -> occupies Fri,Sat,Sun,Mon(18-21)
    expect(segs.length).toBeGreaterThanOrEqual(2);
    const total = segs.reduce((n, s) => n + s.span, 0);
    expect(total).toBe(4); // 18,19,20,21 — the 22nd is the exclusive checkout
  });

  it('reports the lane count a week needs for the grid to reserve room', () => {
    const segs = layoutSegments([
      b('a', '2026-09-15', '2026-09-19'),
      b('b', '2026-09-16', '2026-09-18'),
      b('c', '2026-09-16', '2026-09-18'),
    ]);
    const first = segs[0];
    if (!first) throw new Error('expected at least one segment');
    expect(laneCount(segs, first.weekStart)).toBe(3);
  });
});