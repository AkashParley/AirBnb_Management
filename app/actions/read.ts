'use server';
import {
  loadStayDetail, listBookings, searchGuests, listInventoryItems, listPropertyTemplate, loadPropertyPage, listPropertyChecklist, loadReports, loadAttention,
  type StayDetail, type BookingListFilters,
} from '@/lib/queries/operations';
import { getBookingForEdit as _getBookingForEdit } from '@/app/actions/stay';

/** Read wrappers so client components never hold a Supabase session themselves. */

export async function getStayDetail(bookingId: string):
  Promise<{ ok: true; data: StayDetail } | { ok: false; error: string }> {
  try {
    return { ok: true, data: await loadStayDetail(bookingId) };
  } catch (e) {
    console.error('loadStayDetail', e);
    return { ok: false, error: "Couldn't load this stay." };
  }
}

export async function fetchBookings(filters: BookingListFilters) {
  try {
    return { ok: true as const, data: await listBookings(filters) };
  } catch (e) {
    console.error('listBookings', e);
    return { ok: false as const, error: "Couldn't load bookings." };
  }
}

export async function fetchGuestSuggestions(query: string) {
  try {
    return { ok: true as const, data: await searchGuests(query) };
  } catch (e) {
    console.error('searchGuests', e);
    return { ok: false as const, data: [] as { name: string; phone: string | null }[] };
  }
}

export async function getBookingForEdit(bookingId: string) {
  return _getBookingForEdit(bookingId);
}

export async function fetchInventoryItems() {
  try { return { ok: true as const, data: await listInventoryItems() }; }
  catch (e) { console.error('listInventoryItems', e); return { ok: false as const, error: "Couldn't load the item catalog." }; }
}

export async function fetchPropertyTemplate(propertyId: string) {
  try { return { ok: true as const, data: await listPropertyTemplate(propertyId) }; }
  catch (e) { console.error('listPropertyTemplate', e); return { ok: false as const, error: "Couldn't load the inventory template." }; }
}

export async function fetchPropertyPage(propertyId: string) {
  try { return { ok: true as const, data: await loadPropertyPage(propertyId) }; }
  catch (e) { console.error('loadPropertyPage', e); return { ok: false as const, error: "Couldn't load this property." }; }
}

export async function fetchPropertyChecklist(propertyId: string) {
  try { return { ok: true as const, data: await listPropertyChecklist(propertyId) }; }
  catch (e) { console.error('listPropertyChecklist', e); return { ok: false as const, error: "Couldn't load the checklist." }; }
}

export async function fetchReports(fromISO: string, toISO: string) {
  try { return { ok: true as const, data: await loadReports(fromISO, toISO) }; }
  catch (e) { console.error('loadReports', e); return { ok: false as const, error: "Couldn't load reports." }; }
}

export async function fetchAttentionSummary() {
  try { return { ok: true as const, data: await loadAttention() }; }
  catch (e) { console.error('loadAttention', e); return { ok: false as const, error: "Couldn't load attention items." }; }
}
