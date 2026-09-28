import { describe, it, expect } from 'vitest';
import {
  summarisePayments, formatINR, missingQty, reconcile, checklistProgress,
  detectTurnover, validateBooking, canTransition, rangesOverlap, validateInventoryCount,
  validateTotalAgainstReceived, validatePaymentAddition, formatINRCompact,
  occupiedNightsInRange, occupancyPercent, aggregatePaymentStatuses, type InventoryRow,
} from '../index';

const row = (o: Partial<InventoryRow> = {}): InventoryRow => ({
  expectedQty: 4, givenQty: 4, returnedQty: 4, condition: 'GOOD', replacementCost: 450, ...o,
});

describe('payments', () => {
  it('is PENDING with nothing received', () => {
    expect(summarisePayments(12000, []).status).toBe('PENDING');
  });
  it('is PARTIAL and computes the remainder', () => {
    const s = summarisePayments(12000, [{ amount: 5000 }, { amount: 3000 }]);
    expect(s).toMatchObject({ received: 8000, remaining: 4000, status: 'PARTIAL' });
  });
  it('is PAID and never shows negative remaining on overpayment', () => {
    const s = summarisePayments(12000, [{ amount: 13000 }]);
    expect(s.remaining).toBe(0);
    expect(s.status).toBe('PAID');
  });
  it('handles paise without float drift', () => {
    expect(summarisePayments(0.3, [{ amount: 0.1 }, { amount: 0.2 }]).status).toBe('PAID');
  });
  it('formats INR with Indian grouping', () => {
    expect(formatINR(1250000)).toBe('₹12,50,000');
  });
});

describe('inventory', () => {
  it('measures missing against given, not expected', () => {
    expect(missingQty(row({ expectedQty: 4, givenQty: 3, returnedQty: 3 }))).toBe(0);
    expect(missingQty(row({ givenQty: 4, returnedQty: 3 }))).toBe(1);
  });
  it('returns 0 while a stay is still open', () => {
    expect(missingQty(row({ returnedQty: null }))).toBe(0);
  });
  it('prices missing plus damaged units', () => {
    const s = reconcile([
      row({ returnedQty: 3 }),
      row({ condition: 'DAMAGED', replacementCost: 800 }),
      row(),
    ]);
    expect(s.totalMissing).toBe(1);
    expect(s.damagedRows).toBe(1);
    expect(s.estimatedCost).toBe(1250);
    expect(s.clean).toBe(false);
  });
});

describe('checklist', () => {
  it('counts skipped as progress but keeps READY blocked', () => {
    const p = checklistProgress([
      { state: 'COMPLETED', required: true },
      { state: 'SKIPPED', required: true },
      { state: 'PENDING', required: false },
    ]);
    expect(p).toMatchObject({ done: 2, total: 3, percent: 67, requiredOutstanding: 1, blocksReady: true });
  });
  it('does not divide by zero on an empty list', () => {
    expect(checklistProgress([]).percent).toBe(0);
  });
});

describe('turnover', () => {
  const out = new Date('2026-09-17T10:00:00+05:30');
  it('flags a tight same-day window', () => {
    const t = detectTurnover(out, new Date('2026-09-17T14:00:00+05:30'));
    expect(t).toMatchObject({ sameDay: true, minutes: 240, tight: true });
    expect(t.label).toBe('4h turnaround');
  });
  it('is same-day but not tight at six hours', () => {
    expect(detectTurnover(out, new Date('2026-09-17T16:00:00+05:30')).tight).toBe(false);
  });
  it('ignores next-day arrivals', () => {
    expect(detectTurnover(out, new Date('2026-09-18T14:00:00+05:30')).sameDay).toBe(false);
  });
});

describe('booking validation', () => {
  const base = {
    propertyId: 'p1', guestName: 'Rahul Sharma',
    checkinDate: new Date('2026-09-19'), checkoutDate: new Date('2026-09-22'),
    guestCount: 2, totalAmount: 12000, amountReceived: 8000,
  };
  it('accepts a sound draft', () => {
    expect(validateBooking(base, 6)).toEqual({});
  });
  it('rejects checkout on or before check-in', () => {
    expect(validateBooking({ ...base, checkoutDate: new Date('2026-09-19') }, 6))
      .toHaveProperty('checkoutDate');
  });
  it('rejects over-capacity and negative amounts', () => {
    expect(validateBooking({ ...base, guestCount: 9 }, 6)).toHaveProperty('guestCount');
    expect(validateBooking({ ...base, totalAmount: -1 }, 6)).toHaveProperty('totalAmount');
  });
  it('rejects received above total', () => {
    expect(validateBooking({ ...base, amountReceived: 20000 }, 6))
      .toHaveProperty('amountReceived');
  });
});

describe('readiness', () => {
  const dirty = { checklist: checklistProgress([{ state: 'PENDING', required: true }]), openUrgentMaintenance: false };
  it('blocks READY while required tasks remain', () => {
    const r = canTransition('CLEANING', 'READY', dirty);
    expect(r.ok).toBe(false);
    expect(r.reason).toContain('required checkout task');
  });
  it('allows an explicit override', () => {
    expect(canTransition('CLEANING', 'READY', { ...dirty, override: true }).ok).toBe(true);
  });
  it('blocks READY on urgent maintenance', () => {
    expect(canTransition('MAINTENANCE', 'READY', { checklist: checklistProgress([]), openUrgentMaintenance: true }).ok).toBe(false);
  });
  it('refuses illegal jumps', () => {
    expect(canTransition('OCCUPIED', 'READY', { checklist: checklistProgress([]), openUrgentMaintenance: false }).ok).toBe(false);
  });
});

describe('rangesOverlap', () => {
  it('allows a same-day turnover: one checkout, another check-in, same date', () => {
    // A: Jun 5 -> Jun 10, B: Jun 10 -> Jun 14
    expect(rangesOverlap(
      { checkin: '2026-06-05', checkout: '2026-06-10' },
      { checkin: '2026-06-10', checkout: '2026-06-14' },
    )).toBe(false);
  });
  it('detects a genuine overlap even by one day', () => {
    // A: Jun 5 -> Jun 11, B: Jun 10 -> Jun 14 — overlaps on the 10th
    expect(rangesOverlap(
      { checkin: '2026-06-05', checkout: '2026-06-11' },
      { checkin: '2026-06-10', checkout: '2026-06-14' },
    )).toBe(true);
  });
  it('is symmetric', () => {
    const a = { checkin: '2026-06-05', checkout: '2026-06-11' };
    const b = { checkin: '2026-06-10', checkout: '2026-06-14' };
    expect(rangesOverlap(a, b)).toBe(rangesOverlap(b, a));
  });
  it('detects one range fully containing another', () => {
    expect(rangesOverlap(
      { checkin: '2026-06-01', checkout: '2026-06-20' },
      { checkin: '2026-06-05', checkout: '2026-06-10' },
    )).toBe(true);
  });
  it('allows two ranges that are not adjacent at all', () => {
    expect(rangesOverlap(
      { checkin: '2026-06-01', checkout: '2026-06-05' },
      { checkin: '2026-06-10', checkout: '2026-06-14' },
    )).toBe(false);
  });
});

describe('inventory — Phase 3 scenarios', () => {
  it('is clean when every item is fully returned in good condition', () => {
    const s = reconcile([
      row({ returnedQty: 4 }), row({ returnedQty: 4, expectedQty: 4, givenQty: 4 }),
    ]);
    expect(s).toMatchObject({ totalMissing: 0, damagedRows: 0, estimatedCost: 0, clean: true });
  });

  it('flags a missing-item stay without touching damage', () => {
    const s = reconcile([row({ returnedQty: 3 }), row({ returnedQty: 4 })]);
    expect(s.totalMissing).toBe(1);
    expect(s.damagedRows).toBe(0);
    expect(s.clean).toBe(false);
  });

  it('flags a damaged-item stay even when the count fully matches', () => {
    const s = reconcile([row({ condition: 'DAMAGED', returnedQty: 4 })]);
    expect(s.totalMissing).toBe(0);
    expect(s.damagedRows).toBe(1);
    expect(s.clean).toBe(false);
  });
});

describe('validateInventoryCount', () => {
  it('accepts a given quantity within the expected amount', () => {
    expect(validateInventoryCount('given', 4, 6, null)).toBeNull();
  });
  it('rejects given exceeding what the template expects', () => {
    expect(validateInventoryCount('given', 7, 6, null)).toMatch(/Only 6 expected/);
  });
  it('accepts a returned quantity within what was given', () => {
    expect(validateInventoryCount('returned', 3, 6, 4)).toBeNull();
  });
  it('rejects returned exceeding what was actually given (not the template expectation)', () => {
    expect(validateInventoryCount('returned', 5, 6, 4)).toMatch(/Only 4 were handed over/);
  });
  it('rejects negative and non-integer quantities', () => {
    expect(validateInventoryCount('given', -1, 6, null)).toBe('Invalid quantity.');
    expect(validateInventoryCount('given', 2.5, 6, null)).toBe('Invalid quantity.');
  });
});

describe('payment edit bug — Phase 4.4', () => {
  // 1. Existing payment ₹2,400 + total ₹10,000 → remaining ₹7,600
  it('computes remaining correctly against real received-so-far', () => {
    const s = summarisePayments(10000, [{ amount: 2400 }]);
    expect(s).toMatchObject({ received: 2400, remaining: 7600, status: 'PARTIAL' });
  });

  // 2. Add payment ₹1,000 → received ₹3,400
  it('a new payment adds to the total received, never replacing it', () => {
    const s = summarisePayments(10000, [{ amount: 2400 }, { amount: 1000 }]);
    expect(s.received).toBe(3400);
  });

  // 3. Add payment that exceeds remaining → rejected
  it('rejects a payment that would exceed the remaining balance', () => {
    expect(validatePaymentAddition(8000, 7600)).toMatch(/exceed the remaining balance/);
  });
  it('accepts a payment that exactly clears the remaining balance', () => {
    expect(validatePaymentAddition(7600, 7600)).toBeNull();
  });

  // 4. Total less than existing received → rejected with clear validation
  it('rejects lowering the total below what has already been received', () => {
    const msg = validateTotalAgainstReceived(1000, 2400);
    expect(msg).toMatch(/Total cannot be less than the amount already received/);
    expect(msg).toContain('₹2,400');
  });
  it('allows raising the total to at least the amount already received', () => {
    expect(validateTotalAgainstReceived(2400, 2400)).toBeNull();
    expect(validateTotalAgainstReceived(3000, 2400)).toBeNull();
  });

  // 5/6/7. Status derivation — reusing summarisePayments, not a new function.
  it('5. fully paid → PAID', () => {
    expect(summarisePayments(10000, [{ amount: 10000 }]).status).toBe('PAID');
  });
  it('6. partially paid → PARTIAL', () => {
    expect(summarisePayments(10000, [{ amount: 3400 }]).status).toBe('PARTIAL');
  });
  it('7. no payment → PENDING', () => {
    expect(summarisePayments(10000, []).status).toBe('PENDING');
  });
});

describe('formatINRCompact', () => {
  it('leaves small amounts as plain formatINR', () => {
    expect(formatINRCompact(850)).toBe('₹850');
  });
  it('formats thousands with K', () => {
    expect(formatINRCompact(42100)).toBe('₹42.1K');
  });
  it('formats lakhs with L', () => {
    expect(formatINRCompact(185000)).toBe('₹1.85L');
  });
  it('formats crores with Cr', () => {
    expect(formatINRCompact(12000000)).toBe('₹1.20Cr');
  });
  it('handles zero', () => {
    expect(formatINRCompact(0)).toBe('₹0');
  });
});

describe('occupiedNightsInRange — Phase 5.1 reports math', () => {
  it('a stay fully inside the range counts its exclusive-checkout nights', () => {
    // Sep21 -> Sep24 = 3 nights (checkout is exclusive, matches the calendar layout engine)
    expect(occupiedNightsInRange('2026-09-21', '2026-09-24', '2026-09-01', '2026-09-30')).toBe(3);
  });
  it('clamps a stay that starts before the range', () => {
    expect(occupiedNightsInRange('2026-08-28', '2026-09-03', '2026-09-01', '2026-09-30')).toBe(2); // Sep1,2
  });
  it('clamps a stay that ends after the range', () => {
    expect(occupiedNightsInRange('2026-09-29', '2026-10-03', '2026-09-01', '2026-09-30')).toBe(1); // Sep29 only (30th is checkout)
  });
  it('a stay entirely outside the range contributes zero', () => {
    expect(occupiedNightsInRange('2026-01-01', '2026-01-05', '2026-09-01', '2026-09-30')).toBe(0);
  });
  it('a one-night stay counts as one night', () => {
    expect(occupiedNightsInRange('2026-09-10', '2026-09-11', '2026-09-01', '2026-09-30')).toBe(1);
  });
});

describe('occupancyPercent', () => {
  it('computes nights against property-count * range-days', () => {
    expect(occupancyPercent(15, 3, 30)).toBe(17); // 15 / 90 = 16.67% -> rounds to 17
  });
  it('is zero with no properties', () => {
    expect(occupancyPercent(10, 0, 30)).toBe(0);
  });
  it('is zero with a zero-length range', () => {
    expect(occupancyPercent(10, 3, 0)).toBe(0);
  });
  it('can reach 100% when fully booked', () => {
    expect(occupancyPercent(30, 1, 30)).toBe(100);
  });
});

describe('aggregatePaymentStatuses', () => {
  it('buckets bookings into PAID/PARTIAL/PENDING using the same rule as summarisePayments', () => {
    const dist = aggregatePaymentStatuses([
      { total: 10000, received: 10000 }, // PAID
      { total: 10000, received: 4000 },  // PARTIAL
      { total: 10000, received: 0 },     // PENDING
      { total: 5000, received: 5000 },   // PAID
    ]);
    expect(dist).toEqual({ PAID: 2, PARTIAL: 1, PENDING: 1 });
  });
  it('returns all zeros for an empty list', () => {
    expect(aggregatePaymentStatuses([])).toEqual({ PAID: 0, PARTIAL: 0, PENDING: 0 });
  });
});