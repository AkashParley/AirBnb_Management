'use server';
import { revalidatePath } from 'next/cache';
import { requireUser } from '@/lib/supabase/server';

type Result<T = void> = { ok: true; data?: T } | { ok: false; error: string };
const fail = (e: unknown, friendly: string): Result => { console.error(friendly, e); return { ok: false, error: friendly }; };

/**
 * properties.capacity is NOT NULL with a check(1..50) constraint — not optional in the
 * schema even though the brief's minimum-fields list didn't mention it. Rather than pick
 * a silent default (risking a property that actually sleeps 10 getting capped at some
 * guessed number, which would then wrongly reject real bookings later), it's collected
 * as a small required field here. checkin_time/checkout_time/status all have sensible
 * database defaults ('14:00'/'11:00'/'READY') and are correctly left unset.
 */
export async function createProperty(input: {
  name: string; capacity: number; address?: string; notes?: string;
}): Promise<Result<{ id: string }>> {
  try {
    const name = input.name.trim();
    if (!name) return { ok: false, error: 'Enter a property name.' };
    if (!Number.isInteger(input.capacity) || input.capacity < 1 || input.capacity > 50)
      return { ok: false, error: 'Capacity must be between 1 and 50 guests.' };

    const { sb, user } = await requireUser();
    const { data: existing } = await sb.from('properties').select('id').eq('name', name).maybeSingle();
    if (existing) return { ok: false, error: 'A property with this name already exists.' };

    const { data, error } = await sb.from('properties').insert({
      owner_id: user.id, name, capacity: input.capacity,
      address: input.address?.trim() || null, notes: input.notes?.trim() || null,
    }).select('id').single();
    if (error || !data) return fail(error, "Couldn't create that property.") as Result<{ id: string }>;

    await sb.from('activity_logs').insert({
      owner_id: user.id, property_id: data.id, verb: 'PROPERTY_CREATED', summary: `Property created: ${name}`,
    });
    revalidatePath('/properties');
    return { ok: true, data: { id: data.id } };
  } catch (e) { return fail(e, "Couldn't create that property.") as Result<{ id: string }>; }
}
