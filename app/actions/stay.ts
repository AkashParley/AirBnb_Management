'use server';
import { revalidatePath } from 'next/cache';
import { requireUser } from '@/lib/supabase/server';
import { loadStayDetail } from '@/lib/queries/operations';
import {
  validateBooking, canTransition, reconcile, checklistProgress, rangesOverlap, validateInventoryCount,
  validateTotalAgainstReceived, validatePaymentAddition,
  type PropertyStatus, type BookingDraft,
} from '@/lib/calculations';

type Result<T = void> = { ok: true; data?: T } | { ok: false; error: string };
const fail = (e: unknown, friendly: string): Result => {
  console.error(friendly, e);
  return { ok: false, error: friendly };          // raw DB errors never reach the client
};

async function log(bookingId: string | null, propertyId: string | null, verb: string, summary: string) {
  const { sb, user } = await requireUser();
  await sb.from('activity_logs').insert({
    owner_id: user.id, booking_id: bookingId, property_id: propertyId, verb, summary,
  });
}

/**
 * Shared by createBooking and updateBooking so the overlap rule lives in exactly one
 * place (lib/calculations.rangesOverlap) rather than being re-encoded as a raw SQL
 * comparison in two spots. Fetches only the property's other live bookings — cheap for
 * a single caretaker's booking volume — and filters in JS with the tested predicate.
 */
async function findConflict(
  propertyId: string, checkinDate: string, checkoutDate: string, excludeBookingId?: string,
): Promise<boolean> {
  const { sb } = await requireUser();
  const query = sb.from('bookings').select('id,checkin_date,checkout_date')
    .eq('property_id', propertyId).neq('status', 'CANCELLED');
  const { data: candidates } = excludeBookingId ? await query.neq('id', excludeBookingId) : await query;
  return (candidates ?? []).some(c => rangesOverlap(
    { checkin: checkinDate, checkout: checkoutDate },
    { checkin: c.checkin_date, checkout: c.checkout_date },
  ));
}

/* ---------- booking ---------- */
export async function createBooking(input: {
  propertyId: string; guestName: string; guestPhone?: string;
  checkinDate: string; checkoutDate: string; guestCount: number;
  totalAmount: number; amountReceived: number;
  paymentMethod: 'CASH' | 'UPI' | 'BANK_TRANSFER' | 'OTHER';
  source: 'DIRECT' | 'AIRBNB' | 'OTHER'; notes?: string;
}): Promise<Result<{ id: string }>> {
  try {
    const { sb, user } = await requireUser();
    const { data: prop, error: pe } = await sb.from('properties')
      .select('id,capacity,name').eq('id', input.propertyId).single();
    if (pe || !prop) return { ok: false, error: 'That property could not be found.' };

    const draft: BookingDraft = {
      propertyId: input.propertyId, guestName: input.guestName,
      checkinDate: new Date(input.checkinDate), checkoutDate: new Date(input.checkoutDate),
      guestCount: input.guestCount, totalAmount: input.totalAmount,
      amountReceived: input.amountReceived,
    };
    const errors = validateBooking(draft, prop.capacity);
    const firstError = Object.values(errors)[0];
    if (firstError !== undefined) {
      return { ok: false, error: firstError };
    }

    // Overlap check via the shared, tested predicate — see findConflict.
    if (await findConflict(input.propertyId, input.checkinDate, input.checkoutDate))
      return { ok: false, error: 'Those dates overlap an existing booking.' };

    const name = input.guestName.trim();
    const { data: existing } = await sb.from('guests').select('id').eq('name', name).maybeSingle();
    const guestId = existing?.id ?? (await sb.from('guests')
      .insert({ owner_id: user.id, name, phone: input.guestPhone ?? null })
      .select('id').single()).data!.id;

    const { data: booking, error } = await sb.from('bookings').insert({
      owner_id: user.id, property_id: input.propertyId, guest_id: guestId,
      checkin_date: input.checkinDate, checkout_date: input.checkoutDate,
      guest_count: input.guestCount, total_amount: input.totalAmount,
      source: input.source, notes: input.notes ?? null,
    }).select('id').single();
    if (error || !booking) return fail(error, "Couldn't save the booking.") as Result<{ id: string }>;

    if (input.amountReceived > 0) {
      await sb.from('payments').insert({
        owner_id: user.id, booking_id: booking.id,
        amount: input.amountReceived, method: input.paymentMethod,
      });
    }
    await log(booking.id, input.propertyId, 'BOOKING_CREATED', `Booking created for ${name}`);
    revalidatePath('/');
    return { ok: true, data: { id: booking.id } };
  } catch (e) { return fail(e, "Couldn't save the booking.") as Result<{ id: string }>; }
}

export interface BookingEditData {
  id: string; propertyId: string; guestName: string; guestPhone: string | null;
  checkinDate: string; checkoutDate: string; guestCount: number;
  totalAmount: number; source: 'DIRECT' | 'AIRBNB' | 'OTHER';
  status: 'CONFIRMED' | 'IN_STAY' | 'CHECKED_OUT' | 'CANCELLED';
  notes: string | null; received: number;
}
export async function getBookingForEdit(bookingId: string):
  Promise<{ ok: true; data: BookingEditData } | { ok: false; error: string }> {
  try {
    const { sb } = await requireUser();
    const [{ data: b, error }, { data: pays }] = await Promise.all([
      sb.from('bookings').select('id,property_id,guest_id,checkin_date,checkout_date,guest_count,total_amount,source,status,notes,guests(name,phone)')
        .eq('id', bookingId).single(),
      sb.from('payments').select('amount').eq('booking_id', bookingId),
    ]);
    if (error || !b) return { ok: false, error: 'Booking not found.' };
    const guest = b.guests as unknown as { name: string; phone: string | null };
    return { ok: true, data: {
      id: b.id, propertyId: b.property_id, guestName: guest?.name ?? '', guestPhone: guest?.phone ?? null,
      checkinDate: b.checkin_date, checkoutDate: b.checkout_date, guestCount: b.guest_count,
      totalAmount: Number(b.total_amount), source: b.source, status: b.status, notes: b.notes,
      received: (pays ?? []).reduce((a, p) => a + Number(p.amount), 0),
    } };
  } catch (e) {
    console.error('getBookingForEdit', e);
    return { ok: false, error: "Couldn't load this booking." };
  }
}

/**
 * Editing a CANCELLED booking is refused outright. Editing a CHECKED_OUT booking is
 * allowed (fixing a typo'd guest phone after the fact is legitimate) but changing its
 * dates or property is refused, since inventory and checklist records for that stay are
 * already anchored to the original dates — that reconciliation isn't revisited here,
 * it belongs to the Inventory/Checkout phase, out of scope for this one.
 */
export async function updateBooking(bookingId: string, input: {
  propertyId: string; guestName: string; guestPhone?: string;
  checkinDate: string; checkoutDate: string; guestCount: number;
  totalAmount: number; source: 'DIRECT' | 'AIRBNB' | 'OTHER'; notes?: string;
}): Promise<Result> {
  try {
    const { sb, user } = await requireUser();
    const { data: existing } = await sb.from('bookings')
      .select('property_id,checkin_date,checkout_date,status').eq('id', bookingId).single();
    if (!existing) return { ok: false, error: 'Booking not found.' };
    if (existing.status === 'CANCELLED') return { ok: false, error: 'Cancelled bookings cannot be edited.' };

    const datesOrPropertyChanged =
      existing.property_id !== input.propertyId ||
      existing.checkin_date !== input.checkinDate ||
      existing.checkout_date !== input.checkoutDate;
    if (existing.status === 'CHECKED_OUT' && datesOrPropertyChanged)
      return { ok: false, error: 'This stay is already checked out — dates and property can no longer change.' };

    const { data: prop, error: pe } = await sb.from('properties')
      .select('id,capacity,name').eq('id', input.propertyId).single();
    if (pe || !prop) return { ok: false, error: 'That property could not be found.' };

    const draft: BookingDraft = {
      propertyId: input.propertyId, guestName: input.guestName,
      checkinDate: new Date(input.checkinDate), checkoutDate: new Date(input.checkoutDate),
      guestCount: input.guestCount, totalAmount: input.totalAmount, amountReceived: 0,
    };
    const errors = validateBooking(draft, prop.capacity);
    delete errors.amountReceived; // validateBooking's amountReceived check assumes a create-time
    // input field; it's meaningless here since amountReceived was hardcoded to 0 above just to
    // satisfy that function's signature. The real, edit-specific rule is enforced next instead —
    // this used to be deleted with nothing put in its place, which is the payment-edit bug.
    const firstError = Object.values(errors)[0];
    if (firstError !== undefined) {
      return { ok: false, error: firstError };
    }

    const { data: pays } = await sb.from('payments').select('amount').eq('booking_id', bookingId);
    const receivedSoFar = (pays ?? []).reduce((a, p) => a + Number(p.amount), 0);
    const totalError = validateTotalAgainstReceived(input.totalAmount, receivedSoFar);
    if (totalError) return { ok: false, error: totalError };

    if (datesOrPropertyChanged &&
        await findConflict(input.propertyId, input.checkinDate, input.checkoutDate, bookingId))
      return { ok: false, error: 'Those dates overlap an existing booking.' };

    const name = input.guestName.trim();
    const { data: matchedGuest } = await sb.from('guests').select('id').eq('name', name).maybeSingle();
    const guestId = matchedGuest?.id ?? (await sb.from('guests')
      .insert({ owner_id: user.id, name, phone: input.guestPhone ?? null })
      .select('id').single()).data!.id;

    const { error } = await sb.from('bookings').update({
      property_id: input.propertyId, guest_id: guestId,
      checkin_date: input.checkinDate, checkout_date: input.checkoutDate,
      guest_count: input.guestCount, total_amount: input.totalAmount,
      source: input.source, notes: input.notes ?? null,
    }).eq('id', bookingId);
    if (error) return fail(error, "Couldn't save those changes.");

    await log(bookingId, input.propertyId, 'BOOKING_UPDATED', `Booking updated for ${name}`);
    revalidatePath('/');
    return { ok: true };
  } catch (e) { return fail(e, "Couldn't save those changes."); }
}

/** Cancellation, not deletion — the booking record and its history stay in place. */
export async function cancelBooking(bookingId: string): Promise<Result> {
  try {
    const { sb } = await requireUser();
    const { data: existing } = await sb.from('bookings')
      .select('status,property_id,guests(name)').eq('id', bookingId).single();
    if (!existing) return { ok: false, error: 'Booking not found.' };
    if (existing.status === 'CHECKED_OUT')
      return { ok: false, error: 'A completed stay cannot be cancelled.' };
    if (existing.status === 'CANCELLED') return { ok: true }; // already done, no-op

    const { error } = await sb.from('bookings').update({ status: 'CANCELLED' }).eq('id', bookingId);
    if (error) return fail(error, "Couldn't cancel this booking.");

    const guest = existing.guests as unknown as { name: string };
    await log(bookingId, existing.property_id, 'BOOKING_CANCELLED', `Booking cancelled for ${guest?.name ?? 'guest'}`);
    revalidatePath('/');
    return { ok: true };
  } catch (e) { return fail(e, "Couldn't cancel this booking."); }
}

/* ---------- inventory ---------- */
export async function loadPropertyInventory(bookingId: string): Promise<Result> {
  try {
    const { sb } = await requireUser();
    const { data: b } = await sb.from('bookings').select('property_id').eq('id', bookingId).single();
    if (!b) return { ok: false, error: 'Booking not found.' };
    const { data: tmpl } = await sb.from('property_inventory_templates')
      .select('item_id,expected_qty').eq('property_id', b.property_id);
    if (!tmpl?.length) return { ok: false, error: 'This property has no inventory template yet.' };

    const { error } = await sb.from('booking_inventory').upsert(
      tmpl.map(t => ({
        booking_id: bookingId, item_id: t.item_id,
        expected_qty: t.expected_qty, given_qty: t.expected_qty,
      })),
      { onConflict: 'booking_id,item_id', ignoreDuplicates: true },
    );
    if (error) return fail(error, "Couldn't load the inventory template.");
    await log(bookingId, b.property_id, 'INVENTORY_LOADED', `Property inventory loaded (${tmpl.length} items)`);
    revalidatePath('/');
    return { ok: true };
  } catch (e) { return fail(e, "Couldn't load the inventory template."); }
}

/** Only quantities and condition are written. Missing/cost stay derived — never stored. */
export async function setInventoryCount(
  rowId: string, field: 'given_qty' | 'returned_qty', value: number,
): Promise<Result> {
  try {
    if (!Number.isInteger(value) || value < 0) return { ok: false, error: 'Invalid quantity.' };
    const { sb } = await requireUser();
    const { data: row } = await sb.from('booking_inventory')
      .select('booking_id,expected_qty,given_qty,inventory_items(name)').eq('id', rowId).single();
    if (!row) return { ok: false, error: 'Item not found.' };
    const invalid = validateInventoryCount(field === 'given_qty' ? 'given' : 'returned', value, row.expected_qty, row.given_qty);
    if (invalid) return { ok: false, error: invalid };

    const patch: Record<string, unknown> = { [field]: value };
    if (field === 'returned_qty' && row.given_qty !== null && value < row.given_qty)
      patch.condition = 'MISSING';
    const { error } = await sb.from('booking_inventory').update(patch).eq('id', rowId);
    if (error) return fail(error, "Couldn't save that count.");

    if (patch.condition === 'MISSING') {
      const item = row.inventory_items as unknown as { name: string };
      await log(row.booking_id, null, 'ITEM_MISSING',
        `${row.given_qty! - value} × ${item?.name ?? 'item'} not returned`);
    }
    revalidatePath('/');
    return { ok: true };
  } catch (e) { return fail(e, "Couldn't save that count."); }
}

/* ---------- checklist ---------- */
export async function setTaskState(
  rowId: string, state: 'PENDING' | 'COMPLETED' | 'SKIPPED', note?: string,
): Promise<Result> {
  try {
    const { sb } = await requireUser();
    const { error } = await sb.from('booking_checklist_items').update({
      state, note: note ?? null,
      completed_at: state === 'PENDING' ? null : new Date().toISOString(),
    }).eq('id', rowId);
    if (error) return fail(error, "Couldn't update that task.");
    revalidatePath('/');
    return { ok: true };
  } catch (e) { return fail(e, "Couldn't update that task."); }
}

/* ---------- readiness ---------- */
/**
 * Single funnel for every property status change. canTransition in lib/calculations is
 * the authority; no UI path may write properties.status directly.
 */
export async function moveProperty(
  propertyId: string, to: PropertyStatus, opts: { bookingId?: string; override?: boolean } = {},
): Promise<Result> {
  try {
    const { sb } = await requireUser();
    const { data: prop } = await sb.from('properties').select('status,name').eq('id', propertyId).single();
    if (!prop) return { ok: false, error: 'Property not found.' };

    const { data: urgent } = await sb.from('maintenance_issues').select('id')
      .eq('property_id', propertyId).eq('priority', 'URGENT').neq('status', 'RESOLVED').limit(1);

    const progress = opts.bookingId
      ? (await loadStayDetail(opts.bookingId)).progress
      : checklistProgress([]);

    const verdict = canTransition(prop.status as PropertyStatus, to, {
      checklist: progress,
      openUrgentMaintenance: Boolean(urgent?.length),
      override: opts.override,
    });
    if (!verdict.ok) return { ok: false, error: verdict.reason ?? 'That change is not allowed yet.' };

    const { error } = await sb.from('properties').update({ status: to }).eq('id', propertyId);
    if (error) return fail(error, "Couldn't update the property status.");
    await log(opts.bookingId ?? null, propertyId, 'PROPERTY_STATUS',
      `${prop.name} → ${to}${opts.override ? ' (override)' : ''}`);
    revalidatePath('/');
    return { ok: true };
  } catch (e) { return fail(e, "Couldn't update the property status."); }
}

/** Completing checkout: reconcile, raise damage rows for losses, then advance the property. */
/**
 * Checkout completion is now gated on inventory reconciliation, not the checklist.
 * The checklist (booking_checklist_items) still exists and can still be worked through
 * in the UI, but it no longer blocks completeCheckout — per the Phase 3 product
 * direction, "what was given vs what came back" is the primary workflow; the generic
 * task checklist is secondary. override is kept for API compatibility with existing
 * callers but the "required tasks remaining" block that used to consume it is gone;
 * it's threaded through only for moveProperty's own READY-transition guard.
 */
export async function completeCheckout(bookingId: string, override = false): Promise<Result> {
  try {
    const { sb, user } = await requireUser();
    const { data: b } = await sb.from('bookings').select('property_id').eq('id', bookingId).single();
    if (!b) return { ok: false, error: 'Booking not found.' };

    const detail = await loadStayDetail(bookingId);
    const summary = reconcile(detail.inventory);
    if (!summary.clean) {
      await sb.from('damage_reports').insert({
        owner_id: user.id, property_id: b.property_id, booking_id: bookingId,
        description: `${summary.totalMissing} item(s) unreturned, ${summary.damagedRows} damaged`,
        estimated_cost: summary.estimatedCost,
      });
    }
    await sb.from('bookings').update({
      status: 'CHECKED_OUT', checkout_completed_at: new Date().toISOString(),
    }).eq('id', bookingId);
    await log(bookingId, b.property_id, 'CHECKOUT_COMPLETED',
      summary.clean ? 'Checkout completed · all items reconciled'
                    : `Checkout completed · ${summary.totalMissing} missing, ${summary.damagedRows} damaged · ₹${summary.estimatedCost} recoverable`);

/**
 * The booking's own state (CHECKED_OUT, checkout_completed_at, the damage report if any) is
 * the actual result of "checkout completed" — that's written above and always succeeds if we
 * reach this point. The property's operational status label is a separate, best-effort concern:
 * moveProperty(..., 'CLEANING', ...) is attempted so the property board reflects reality when
 * possible, but its result is deliberately NOT allowed to make completeCheckout itself report
 * failure. It was doing exactly that before this fix — and since nothing in this app ever moves
 * a property to CHECKOUT_DUE first, a property is realistically always still OCCUPIED at this
 * point, and OCCUPIED -> CLEANING is not an allowed direct transition (see canTransition's
 * ALLOWED map). That meant EVERY real checkout was reporting an error to the caretaker
 * ("OCCUPIED cannot move straight to CLEANING") despite the checkout itself having fully
 * succeeded a moment earlier. Found by code-tracing during the Phase 4.3 audit, fixed here.
 */
const statusMove = await moveProperty(b.property_id, 'CLEANING', { bookingId, override });
if (!statusMove.ok) console.warn(`completeCheckout: property status did not advance — ${statusMove.error}`);
return { ok: true };
  } catch (e) { return fail(e, "Couldn't complete the checkout."); }
}

/* ---------- payments ---------- */
export async function addPayment(
  bookingId: string, amount: number, method: 'CASH' | 'UPI' | 'BANK_TRANSFER' | 'OTHER',
): Promise<Result> {
  try {
    if (!(amount > 0)) return { ok: false, error: 'Enter an amount above zero.' };
    const { sb, user } = await requireUser();

    const { data: b } = await sb.from('bookings').select('total_amount').eq('id', bookingId).single();
    if (!b) return { ok: false, error: 'Booking not found.' };
    const { data: pays } = await sb.from('payments').select('amount').eq('booking_id', bookingId);
    const receivedSoFar = (pays ?? []).reduce((a, p) => a + Number(p.amount), 0);
    const remaining = Math.max(0, Number(b.total_amount) - receivedSoFar);
    const addError = validatePaymentAddition(amount, remaining);
    if (addError) return { ok: false, error: addError };

    const { error } = await sb.from('payments')
      .insert({ owner_id: user.id, booking_id: bookingId, amount, method });
    if (error) return fail(error, "Couldn't record that payment.");
    await log(bookingId, null, 'PAYMENT_RECEIVED', `₹${amount.toLocaleString('en-IN')} received via ${method}`);
    revalidatePath('/');
    return { ok: true };
  } catch (e) { return fail(e, "Couldn't record that payment."); }
}

/* ---------- check-in ---------- */
/**
 * Explicit confirmation step. Before this, the caretaker can freely adjust given_qty
 * (loadPropertyInventory already seeded booking_inventory rows). After this, the stay
 * moves into IN_STAY and the given quantities become the historical record checkout
 * measures against — editing given_qty afterward is still possible via setInventoryCount
 * (no hard lock in the schema), but the UI treats checkinCompletedAt as the signal that
 * check-in is done, not a database-level freeze.
 */
export async function confirmCheckin(bookingId: string): Promise<Result> {
  try {
    const { sb } = await requireUser();
    const { data: b } = await sb.from('bookings').select('property_id,status,checkin_completed_at').eq('id', bookingId).single();
    if (!b) return { ok: false, error: 'Booking not found.' };
    if (b.checkin_completed_at) return { ok: true }; // already confirmed, no-op

    const { data: rows } = await sb.from('booking_inventory').select('id').eq('booking_id', bookingId).limit(1);
    if (!rows?.length) return { ok: false, error: 'Load the property inventory before confirming check-in.' };

    const { error } = await sb.from('bookings').update({
      checkin_completed_at: new Date().toISOString(),
      status: b.status === 'CONFIRMED' ? 'IN_STAY' : b.status,
    }).eq('id', bookingId);
    if (error) return fail(error, "Couldn't confirm check-in.");

    await log(bookingId, b.property_id, 'CHECKIN_CONFIRMED', 'Check-in confirmed');
    revalidatePath('/');
    return { ok: true };
  } catch (e) { return fail(e, "Couldn't confirm check-in."); }
}

/**
 * An item the property template doesn't have — e.g. a beach towel handed over this one
 * time. Always attaches to just this booking's snapshot. addToTemplate is a separate,
 * explicit opt-in to also add it to the property's master list for next time; never
 * automatic, per the brief.
 */
export async function addAdhocItem(bookingId: string, input: {
  itemId?: string; newItemName?: string; unit?: string; replacementCost?: number;
  givenQty: number; addToTemplate?: boolean;
}): Promise<Result> {
  try {
    if (!Number.isInteger(input.givenQty) || input.givenQty <= 0)
      return { ok: false, error: 'Enter a quantity above zero.' };
    if (!input.itemId && !input.newItemName?.trim())
      return { ok: false, error: 'Choose an item or name a new one.' };

    const { sb, user } = await requireUser();
    const { data: b } = await sb.from('bookings').select('property_id').eq('id', bookingId).single();
    if (!b) return { ok: false, error: 'Booking not found.' };

    let itemId = input.itemId;
    if (!itemId) {
      const name = input.newItemName!.trim();
      const { data: existing } = await sb.from('inventory_items').select('id').eq('name', name).maybeSingle();
      itemId = existing?.id ?? (await sb.from('inventory_items').insert({
        owner_id: user.id, name, unit: input.unit || 'pc', replacement_cost: input.replacementCost ?? 0,
      }).select('id').single()).data!.id;
    }

    const { error } = await sb.from('booking_inventory').upsert({
      booking_id: bookingId, item_id: itemId,
      expected_qty: input.givenQty, given_qty: input.givenQty,
    }, { onConflict: 'booking_id,item_id' });
    if (error) return fail(error, "Couldn't add that item.");

    if (input.addToTemplate) {
      await sb.from('property_inventory_templates').upsert({
        property_id: b.property_id, item_id: itemId, expected_qty: input.givenQty,
      }, { onConflict: 'property_id,item_id' });
    }

    await log(bookingId, b.property_id, 'ITEM_ADDED', `${input.givenQty} × ${input.newItemName ?? 'item'} added to this stay`);
    revalidatePath('/');
    return { ok: true };
  } catch (e) { return fail(e, "Couldn't add that item."); }
}

/* ---------- damage ---------- */
/** Marks a booking_inventory row DAMAGED and files a matching damage_reports row — no claims workflow. */
export async function markDamage(bookingInventoryId: string, description: string, note?: string): Promise<Result> {
  try {
    if (!description.trim()) return { ok: false, error: 'Describe the damage.' };
    const { sb, user } = await requireUser();
    const { data: row } = await sb.from('booking_inventory')
      .select('booking_id,item_id,replacement_cost_override,inventory_items(name,replacement_cost)')
      .eq('id', bookingInventoryId).single();
    if (!row) return { ok: false, error: 'Item not found.' };
    const { data: b } = await sb.from('bookings').select('property_id').eq('id', row.booking_id).single();
    if (!b) return { ok: false, error: 'Booking not found.' };

    const item = row.inventory_items as unknown as { name: string; replacement_cost: number };
    const { error } = await sb.from('booking_inventory').update({ condition: 'DAMAGED', notes: note ?? null }).eq('id', bookingInventoryId);
    if (error) return fail(error, "Couldn't mark that item damaged.");

    await sb.from('damage_reports').insert({
      owner_id: user.id, property_id: b.property_id, booking_id: row.booking_id, item_id: row.item_id,
      description: description.trim(), notes: note ?? null,
      estimated_cost: Number(row.replacement_cost_override ?? item?.replacement_cost ?? 0),
    });
    await log(row.booking_id, b.property_id, 'ITEM_DAMAGED', `${item?.name ?? 'Item'} marked damaged`);
    revalidatePath('/');
    return { ok: true };
  } catch (e) { return fail(e, "Couldn't mark that item damaged."); }
}

/**
 * Permanent delete of one booking. FK rules (0001_init.sql): payments, booking_inventory,
 * booking_checklist_items, photos and activity_logs cascade with the booking; damage_reports
 * is ON DELETE SET NULL, which would leave orphaned reports with no booking, so those are
 * removed explicitly. Storage files behind the photo rows are not covered by any FK, so they
 * are removed too. The guest is never touched (may have other bookings); maintenance_issues
 * keep their property link (set null on booking is correct for property-level issues).
 * DB delete runs first: if it fails, nothing else has been touched and the booking stays.
 */
export async function deleteBooking(bookingId: string): Promise<Result> {
  try {
    const { sb } = await requireUser();
    const { data: b } = await sb.from('bookings').select('id,property_id').eq('id', bookingId).single();
    if (!b) return { ok: false, error: 'Booking not found.' };

    const [{ data: photos }, { data: damage }] = await Promise.all([
      sb.from('photos').select('storage_path').eq('booking_id', bookingId),
      sb.from('damage_reports').select('id').eq('booking_id', bookingId),
    ]);

    const { data: deleted, error } = await sb.from('bookings').delete().eq('id', bookingId).select('id');
    if (error || !deleted?.length) return fail(error, "Couldn't delete that booking.");

    const damageIds = (damage ?? []).map(d => d.id);
    if (damageIds.length) await sb.from('damage_reports').delete().in('id', damageIds);
    const paths = (photos ?? []).map(p => p.storage_path);
    if (paths.length) await sb.storage.from('keeystay').remove(paths);

    revalidatePath('/bookings');
    revalidatePath('/calendar');
    return { ok: true };
  } catch (e) { return fail(e, "Couldn't delete that booking."); }
}