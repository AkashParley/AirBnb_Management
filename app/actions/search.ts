'use server';
import { requireUser } from '@/lib/supabase/server';

export interface SearchResults {
  bookings: { id: string; guestName: string; propertyName: string; checkinDate: string; checkoutDate: string }[];
  properties: { id: string; name: string }[];
  guests: { name: string; phone: string | null }[];
}

/**
 * Global search across existing tables only — no separate search index/table. Guests
 * have no standalone destination in this app (removed from the sidebar in an earlier
 * phase; guest info lives attached to bookings), so a guest result routes to the existing
 * Bookings page filtered by that name, reusing the filter that already exists there
 * rather than inventing a guest page.
 */
export async function globalSearch(query: string): Promise<{ ok: true; data: SearchResults } | { ok: false; error: string }> {
  const q = query.trim();
  if (q.length < 2) return { ok: true, data: { bookings: [], properties: [], guests: [] } };
  try {
    const { sb } = await requireUser();
    const like = `%${q}%`;

    const [{ data: byGuest }, { data: byProperty }, { data: properties }, { data: guests }] = await Promise.all([
      sb.from('bookings')
        .select('id,checkin_date,checkout_date,guests!inner(name,phone),properties(name)')
        .neq('status', 'CANCELLED')
        .or(`name.ilike.${like},phone.ilike.${like}`, { referencedTable: 'guests' })
        .order('checkin_date', { ascending: false }).limit(6),
      sb.from('bookings')
        .select('id,checkin_date,checkout_date,guests(name,phone),properties!inner(name)')
        .neq('status', 'CANCELLED')
        .ilike('properties.name', like)
        .order('checkin_date', { ascending: false }).limit(6),
      sb.from('properties').select('id,name').ilike('name', like).limit(5),
      sb.from('guests').select('name,phone').or(`name.ilike.${like},phone.ilike.${like}`).limit(5),
    ]);

    const seen = new Set<string>();
    const bookings: SearchResults['bookings'] = [];
    for (const b of [...(byGuest ?? []), ...(byProperty ?? [])]) {
      if (seen.has(b.id)) continue;
      seen.add(b.id);
      const guest = b.guests as unknown as { name: string; phone: string | null };
      const prop = b.properties as unknown as { name: string };
      bookings.push({
        id: b.id, guestName: guest?.name ?? 'Guest', propertyName: prop?.name ?? '',
        checkinDate: b.checkin_date, checkoutDate: b.checkout_date,
      });
    }

    return {
      ok: true,
      data: { bookings: bookings.slice(0, 6), properties: properties ?? [], guests: guests ?? [] },
    };
  } catch (e) {
    console.error('globalSearch', e);
    return { ok: false, error: "Search isn't working right now." };
  }
}