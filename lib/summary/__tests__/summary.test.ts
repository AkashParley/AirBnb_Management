import { describe, it, expect } from 'vitest';
import { buildWhatsAppSummary, type SummaryData } from '../index';

const base: SummaryData = {
  guestName: 'Sneha Deshpande', propertyName: 'Riverside Cottage',
  checkinDate: '2026-09-20', checkoutDate: '2026-09-23',
  checkinTime: '14:00', checkoutTime: '11:00',
  payment: { total: 20800, received: 12000, remaining: 8800, status: 'PARTIAL' },
};
const row = (o: Partial<SummaryData['inventory'] extends (infer R)[] | undefined ? R : never> = {}) => ({
  itemName: 'Towel', givenQty: 4, returnedQty: 4, condition: 'GOOD' as const, note: null, ...o,
});

describe('buildWhatsAppSummary', () => {
  it('greets by first name only, even with a multi-word guest name', () => {
    expect(buildWhatsAppSummary('checkin', base)).toMatch(/^Hello Sneha 👋/);
  });

  it('includes the property, dates, and formatted times', () => {
    const s = buildWhatsAppSummary('checkin', base);
    expect(s).toContain('Riverside Cottage');
    expect(s).toContain('20 Sep 2026 → 23 Sep 2026');
    expect(s).toContain('20 Sep 2026, 2:00 PM');
    expect(s).toContain('23 Sep 2026, 11:00 AM');
  });

  it('shows Paid without a remaining line when fully paid', () => {
    const s = buildWhatsAppSummary('checkin', {
      ...base, payment: { total: 20800, received: 20800, remaining: 0, status: 'PAID' },
    });
    expect(s).toContain('Status: Paid');
    expect(s).not.toContain('Remaining:');
  });

  it('shows Partial with the remaining amount', () => {
    const s = buildWhatsAppSummary('checkin', base);
    expect(s).toContain('Status: Partial');
    expect(s).toContain('Remaining: ₹8,800');
  });

  it('checkin mode never mentions inventory at all', () => {
    expect(buildWhatsAppSummary('checkin', base)).not.toMatch(/Inventory|Missing|Checkout/);
  });

  it('checkout mode with nothing missing shows the all-clear line', () => {
    const s = buildWhatsAppSummary('checkout', {
      ...base, inventory: [row(), row({ itemName: 'Pillow' })],
      checklistDone: 8, checklistTotal: 8,
    });
    expect(s).toContain('✅ Inventory');
    expect(s).toContain('All items returned correctly.');
    expect(s).not.toContain('⚠️');
  });

  it('checkout mode lists a missing item with the correct count (given − returned)', () => {
    const s = buildWhatsAppSummary('checkout', {
      ...base, inventory: [row({ returnedQty: 3 }), row({ itemName: 'Plate', givenQty: 8, returnedQty: 7 })],
    });
    expect(s).toContain('Items given: 12');
    expect(s).toContain('Items returned: 10');
    expect(s).toContain('• 1 Towel');
    expect(s).toContain('• 1 Plate');
  });

  it('checkout mode lists a damaged item with its note', () => {
    const s = buildWhatsAppSummary('checkout', {
      ...base, inventory: [row({ itemName: 'Glass', condition: 'DAMAGED', note: 'cracked rim' })],
    });
    expect(s).toContain('• Glass damaged (cracked rim)');
  });

  it('includes checklist progress only when totals are provided', () => {
    const withChecklist = buildWhatsAppSummary('checkout', { ...base, inventory: [row()], checklistDone: 5, checklistTotal: 8 });
    const without = buildWhatsAppSummary('checkout', { ...base, inventory: [row()] });
    expect(withChecklist).toContain('Checkout checklist: 5/8 completed');
    expect(without).not.toContain('Checkout checklist');
  });

  it('never invents data — total/received always come from the input, unmodified', () => {
    const s = buildWhatsAppSummary('checkin', { ...base, payment: { total: 999, received: 111, remaining: 888, status: 'PARTIAL' } });
    expect(s).toContain('Total: ₹999');
    expect(s).toContain('Paid: ₹111');
  });
});

describe('signature — Phase 4.4', () => {
  it('8. ends with the Shradha signature', () => {
    expect(buildWhatsAppSummary('checkin', base)).toContain('Shradha (Managing Partner)');
    expect(buildWhatsAppSummary('checkout', { ...base, inventory: [] })).toContain('Shradha (Managing Partner)');
  });
  it('9. never mentions KEEYSTAY anywhere in the message', () => {
    expect(buildWhatsAppSummary('checkin', base)).not.toContain('KEEYSTAY');
    expect(buildWhatsAppSummary('checkout', { ...base, inventory: [] })).not.toContain('KEEYSTAY');
  });
});
