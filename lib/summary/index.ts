/**
 * Pure WhatsApp-summary text generation. No I/O, no React — one function, two modes,
 * per the brief's instruction not to build two separate summary systems. Every value
 * comes from the data passed in; nothing here invents a number.
 */
import { formatINR, missingQty, type PaymentStatus, type InventoryRow } from '@/lib/calculations';

export interface SummaryInventoryRow extends InventoryRow { itemName: string; note: string | null }
export interface SummaryData {
  guestName: string;
  propertyName: string;
  checkinDate: string; checkoutDate: string;   // 'yyyy-MM-dd'
  checkinTime: string; checkoutTime: string;    // 'HH:mm:ss' or 'HH:mm'
  payment: { total: number; received: number; remaining: number; status: PaymentStatus };
  inventory?: SummaryInventoryRow[];             // present for checkout mode
  checklistDone?: number; checklistTotal?: number; // present for checkout mode
}

const STATUS_LABEL: Record<PaymentStatus, string> = { PAID: 'Paid', PARTIAL: 'Partial', PENDING: 'Pending' };

function fmtDate(iso: string): string {
  const parts = iso.split('-').map(Number);
  const y = parts[0] ?? 0, m = parts[1] ?? 1, d = parts[2] ?? 1;
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${d} ${months[m - 1] ?? ''} ${y}`;
}
function fmtTime(hhmm: string): string {
  const [hStr, mStr] = hhmm.split(':');
  let h = Number(hStr); const m = mStr ?? '00';
  const suffix = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${m} ${suffix}`;
}

export function buildWhatsAppSummary(mode: 'checkin' | 'checkout', d: SummaryData): string {
  const firstName = d.guestName.trim().split(/\s+/)[0] || d.guestName;
  const lines: string[] = [
    `Hello ${firstName} 👋`, '',
    `Here is the ${mode === 'checkin' ? 'stay' : 'checkout'} summary for ${d.propertyName}.`, '',
    `🏡 Property`, d.propertyName, '',
    `📅 Stay`, `${fmtDate(d.checkinDate)} → ${fmtDate(d.checkoutDate)}`, '',
    `🕐 Check-in`, `${fmtDate(d.checkinDate)}, ${fmtTime(d.checkinTime)}`, '',
    `🕐 Check-out`, `${fmtDate(d.checkoutDate)}, ${fmtTime(d.checkoutTime)}`, '',
    `💳 Payment`,
    `Total: ${formatINR(d.payment.total)}`,
    `Paid: ${formatINR(d.payment.received)}`,
  ];
  if (d.payment.status !== 'PAID') lines.push(`Remaining: ${formatINR(d.payment.remaining)}`);
  lines.push(`Status: ${STATUS_LABEL[d.payment.status]}`, '');

  if (mode === 'checkout' && d.inventory) {
    const totalGiven = d.inventory.reduce((a, r) => a + (r.givenQty ?? 0), 0);
    const totalReturned = d.inventory.reduce((a, r) => a + (r.returnedQty ?? 0), 0);
    const missing = d.inventory.filter(r => missingQty(r) > 0);
    const damaged = d.inventory.filter(r => r.condition === 'DAMAGED');

    if (!missing.length && !damaged.length) {
      lines.push(`✅ Inventory`, 'All items returned correctly.', '');
    } else {
      lines.push(`📦 Inventory`, `Items given: ${totalGiven}`, `Items returned: ${totalReturned}`, '');
      lines.push(`⚠️ Missing / damaged`);
      for (const r of missing) lines.push(`• ${missingQty(r)} ${r.itemName}`);
      for (const r of damaged) lines.push(`• ${r.itemName} damaged${r.note ? ` (${r.note})` : ''}`);
      lines.push('');
    }

    lines.push(`✅ Checkout`, 'Inventory reconciliation completed');
    if (d.checklistTotal) lines.push(`Checkout checklist: ${d.checklistDone ?? 0}/${d.checklistTotal} completed`);
    lines.push('');
  }

  lines.push('Thank you!', '', 'Shradha (Managing Partner)');
  return lines.join('\n');
}