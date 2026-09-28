/** KEEYSTAY domain calculations. Pure functions — no I/O, no React, no Supabase. */
import { differenceInCalendarDays, differenceInMinutes, isSameDay } from 'date-fns';

export type PaymentStatus = 'PENDING' | 'PARTIAL' | 'PAID';
export type TaskState = 'PENDING' | 'COMPLETED' | 'SKIPPED';

/* ---------- money ---------- */
const round2 = (n: number) => Math.round(n * 100) / 100;

export interface PaymentSummary {
  total: number; received: number; remaining: number; status: PaymentStatus;
}
export function summarisePayments(total: number, payments: { amount: number }[]): PaymentSummary {
  if (total < 0) throw new RangeError('total must be >= 0');
  const received = round2(payments.reduce((a, p) => a + p.amount, 0));
  const remaining = round2(Math.max(0, total - received));
  const status: PaymentStatus =
    received <= 0 ? 'PENDING' : remaining <= 0 ? 'PAID' : 'PARTIAL';
  return { total: round2(total), received, remaining, status };
}
export const formatINR = (n: number) =>
  '₹' + new Intl.NumberFormat('en-IN', { maximumFractionDigits: n % 1 ? 2 : 0 }).format(n);

/** ₹1.85L / ₹42.1K style, for chart axes and dense KPI rows where formatINR would be too wide. */
export function formatINRCompact(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 10_000_000) return `₹${(n / 10_000_000).toFixed(2)}Cr`;
  if (abs >= 100_000) return `₹${(n / 100_000).toFixed(2)}L`;
  if (abs >= 1_000) return `₹${(n / 1_000).toFixed(1)}K`;
  return formatINR(n);
}

/* ---------- reports math (Phase 5.1) ----------
 * Extracted out of the Supabase-coupled loadReports() so these specific rules — the ones
 * the brief explicitly asked to have tested — are pure and unit-testable, and so
 * loadReports calls the same one implementation rather than duplicating the arithmetic
 * across its overall-occupancy and per-property-occupancy code paths (it used to). */

/**
 * Nights a single stay occupies within [rangeFrom, rangeTo], with checkout treated as an
 * EXCLUSIVE boundary — the same semantics as lib/calendar/layout.ts. A stay that starts
 * before the range or ends after it is clamped to the overlapping portion only.
 */
export function occupiedNightsInRange(
  checkinISO: string, checkoutISO: string, rangeFromISO: string, rangeToISO: string,
): number {
  const DAY = 86_400_000;
  const start = Math.max(new Date(checkinISO).getTime(), new Date(rangeFromISO).getTime());
  const end = Math.min(new Date(checkoutISO).getTime(), new Date(rangeToISO).getTime() + DAY);
  return Math.max(0, (end - start) / DAY);
}

export function occupancyPercent(occupiedNights: number, propertyCount: number, rangeDays: number): number {
  if (propertyCount <= 0 || rangeDays <= 0) return 0;
  return Math.round((occupiedNights / (propertyCount * rangeDays)) * 100);
}

/** Counts how many bookings derive to each payment status, reusing summarisePayments per booking. */
export function aggregatePaymentStatuses(
  bookings: { total: number; received: number }[],
): { PAID: number; PARTIAL: number; PENDING: number } {
  const dist = { PAID: 0, PARTIAL: 0, PENDING: 0 };
  for (const b of bookings) dist[summarisePayments(b.total, [{ amount: b.received }]).status]++;
  return dist;
}

/* ---------- inventory ---------- */
export interface InventoryRow {
  expectedQty: number;
  givenQty: number | null;
  returnedQty: number | null;
  condition: 'GOOD' | 'FAIR' | 'DAMAGED' | 'MISSING';
  replacementCost: number;
}
/** Missing is measured against what was actually handed over, not the template. */
export function missingQty(r: InventoryRow): number {
  if (r.givenQty === null || r.returnedQty === null) return 0;
  return Math.max(0, r.givenQty - r.returnedQty);
}
export function rowLiability(r: InventoryRow): number {
  const damaged = r.condition === 'DAMAGED' ? 1 : 0;
  return round2((missingQty(r) + damaged) * r.replacementCost);
}

/**
 * The two hard rules for recording a count: given can't exceed what the template expects,
 * returned can't exceed what was actually given. Extracted from app/actions/stay.ts's
 * setInventoryCount so the rule is unit-testable and lives in exactly one place.
 */
export function validateInventoryCount(
  field: 'given' | 'returned', value: number, expectedQty: number, givenQty: number | null,
): string | null {
  if (!Number.isInteger(value) || value < 0) return 'Invalid quantity.';
  if (field === 'given' && value > expectedQty) return `Only ${expectedQty} expected.`;
  if (field === 'returned' && givenQty !== null && value > givenQty) return `Only ${givenQty} were handed over.`;
  return null;
}
export interface ReconSummary {
  accountedFor: number; totalGiven: number; totalMissing: number;
  damagedRows: number; estimatedCost: number; clean: boolean;
}
export function reconcile(rows: InventoryRow[]): ReconSummary {
  const totalGiven = rows.reduce((a, r) => a + (r.givenQty ?? 0), 0);
  const totalMissing = rows.reduce((a, r) => a + missingQty(r), 0);
  const damagedRows = rows.filter(r => r.condition === 'DAMAGED').length;
  return {
    totalGiven, totalMissing, damagedRows,
    accountedFor: totalGiven - totalMissing,
    estimatedCost: round2(rows.reduce((a, r) => a + rowLiability(r), 0)),
    clean: totalMissing === 0 && damagedRows === 0,
  };
}

/* ---------- checklist ---------- */
export interface ChecklistRow { state: TaskState; required: boolean }
export interface ChecklistProgress {
  done: number; total: number; percent: number;
  requiredOutstanding: number; blocksReady: boolean;
}
/** Skipped counts as resolved for progress, but a skipped *required* task still blocks READY. */
export function checklistProgress(rows: ChecklistRow[]): ChecklistProgress {
  const total = rows.length;
  const done = rows.filter(r => r.state !== 'PENDING').length;
  const requiredOutstanding = rows.filter(r => r.required && r.state !== 'COMPLETED').length;
  return {
    done, total,
    percent: total === 0 ? 0 : Math.round((done / total) * 100),
    requiredOutstanding,
    blocksReady: requiredOutstanding > 0,
  };
}

/* ---------- turnover ---------- */
export interface Turnover {
  sameDay: boolean; minutes: number; label: string; tight: boolean;
}
export function detectTurnover(
  checkoutAt: Date, nextCheckinAt: Date | null, tightThresholdMinutes = 300,
): Turnover {
  if (!nextCheckinAt || !isSameDay(checkoutAt, nextCheckinAt))
    return { sameDay: false, minutes: 0, label: '', tight: false };
  const minutes = Math.max(0, differenceInMinutes(nextCheckinAt, checkoutAt));
  const h = Math.floor(minutes / 60), m = minutes % 60;
  return {
    sameDay: true, minutes,
    label: m ? `${h}h ${m}m turnaround` : `${h}h turnaround`,
    tight: minutes <= tightThresholdMinutes,
  };
}

/* ---------- booking validation ---------- */
export interface BookingDraft {
  propertyId: string; guestName: string;
  checkinDate: Date; checkoutDate: Date;
  guestCount: number; totalAmount: number; amountReceived: number;
}
export function validateBooking(d: BookingDraft, capacity: number): Record<string, string> {
  const e: Record<string, string> = {};
  if (!d.propertyId) e.propertyId = 'Choose a property.';
  if (!d.guestName.trim()) e.guestName = 'Guest name is required.';
  if (differenceInCalendarDays(d.checkoutDate, d.checkinDate) < 1)
    e.checkoutDate = 'Checkout must be at least one night after check-in.';
  if (!Number.isInteger(d.guestCount) || d.guestCount < 1)
    e.guestCount = 'At least one guest.';
  else if (d.guestCount > capacity) e.guestCount = `This property sleeps ${capacity}.`;
  if (d.totalAmount < 0) e.totalAmount = 'Amount cannot be negative.';
  if (d.amountReceived < 0) e.amountReceived = 'Amount cannot be negative.';
  if (d.amountReceived > d.totalAmount)
    e.amountReceived = 'Received cannot exceed the total.';
  return e;
}
export const nights = (a: Date, b: Date) => differenceInCalendarDays(b, a);

/**
 * Two rules specific to editing an already-existing booking, distinct from
 * validateBooking's amountReceived check (which is a CREATE-time field the caretaker is
 * actively typing into). In edit mode "received" isn't a form field at all — it's the
 * real, already-persisted sum of payment rows, and the two things that can go wrong are
 * structurally different from a create-time typo:
 *
 * 1. Lowering the total below what's already been paid — never silently allowed, and
 *    never resolved by rewriting or deleting the historical payment rows.
 * 2. Adding a new payment that would push received above the total.
 *
 * Both the BookingSheet form and the corresponding server actions (updateBooking,
 * addPayment) call these same two functions, so the client can give instant feedback
 * and the server enforces the identical rule authoritatively — no duplicated logic,
 * no drift between what the UI blocks and what the database actually allows.
 */
export function validateTotalAgainstReceived(totalAmount: number, receivedSoFar: number): string | null {
  if (totalAmount < receivedSoFar)
    return `Total cannot be less than the amount already received (${formatINR(receivedSoFar)}).`;
  return null;
}

export function validatePaymentAddition(amount: number, remaining: number): string | null {
  if (amount > remaining) return 'Payment would exceed the remaining balance.';
  return null;
}

/* ---------- readiness state machine ---------- */
export type PropertyStatus =
  | 'OCCUPIED' | 'CHECKOUT_DUE' | 'CLEANING' | 'INSPECTION'
  | 'MAINTENANCE' | 'READY' | 'BLOCKED';

const ALLOWED: Record<PropertyStatus, PropertyStatus[]> = {
  OCCUPIED: ['CHECKOUT_DUE', 'MAINTENANCE', 'BLOCKED'],
  CHECKOUT_DUE: ['INSPECTION', 'CLEANING', 'MAINTENANCE', 'BLOCKED'],
  INSPECTION: ['CLEANING', 'MAINTENANCE', 'BLOCKED'],
  CLEANING: ['INSPECTION', 'READY', 'MAINTENANCE', 'BLOCKED'],
  MAINTENANCE: ['CLEANING', 'INSPECTION', 'READY', 'BLOCKED'],
  READY: ['OCCUPIED', 'MAINTENANCE', 'BLOCKED'],
  BLOCKED: ['READY', 'MAINTENANCE'],
};

export interface TransitionContext {
  checklist: ChecklistProgress;
  openUrgentMaintenance: boolean;
  override?: boolean;
}
export interface TransitionResult { ok: boolean; reason?: string }

export function canTransition(
  from: PropertyStatus, to: PropertyStatus, ctx: TransitionContext,
): TransitionResult {
  if (from === to) return { ok: true };
  if (!ALLOWED[from].includes(to))
    return { ok: false, reason: `${from} cannot move straight to ${to}.` };
  if (to === 'READY' && !ctx.override) {
    if (ctx.openUrgentMaintenance)
      return { ok: false, reason: 'Urgent maintenance is still open.' };
    if (ctx.checklist.blocksReady)
      return { ok: false, reason: `${ctx.checklist.requiredOutstanding} required checkout task(s) remaining.` };
  }
  return { ok: true };
}

/* ---------- booking conflicts ---------- */
export interface DateRange { checkin: string; checkout: string } // ISO 'YYYY-MM-DD' — lexical order matches chronological order

/**
 * Two stays on the same property conflict only if their date ranges actually overlap.
 * A checkout and a check-in on the same calendar date is a same-day turnover, not a
 * conflict — `a.checkout > b.checkin` (strict) is what makes that boundary case allowed.
 * This is the single source of truth for the rule; both createBooking and updateBooking
 * fetch the property's other live bookings and filter with this, rather than each
 * re-encoding the boundary condition as a raw comparison.
 */
export function rangesOverlap(a: DateRange, b: DateRange): boolean {
  return a.checkin < b.checkout && a.checkout > b.checkin;
}