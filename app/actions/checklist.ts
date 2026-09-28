'use server';
import { revalidatePath } from 'next/cache';
import { requireUser } from '@/lib/supabase/server';

type Result = { ok: true } | { ok: false; error: string };
const fail = (e: unknown, friendly: string): Result => { console.error(friendly, e); return { ok: false, error: friendly }; };

/**
 * Reuses checklist_templates/checklist_items/booking_checklist_items exactly as they
 * already existed since Phase 1 — no new tables. A property gets at most one CHECKOUT
 * template, created lazily on the first item added, matching the brief's "simple,
 * property-specific, editable later" requirement without a template-picker UI.
 */
async function ensureTemplate(propertyId: string): Promise<string> {
  const { sb, user } = await requireUser();
  const { data: existing } = await sb.from('checklist_templates')
    .select('id').eq('property_id', propertyId).eq('kind', 'CHECKOUT').maybeSingle();
  if (existing) return existing.id;
  const { data, error } = await sb.from('checklist_templates')
    .insert({ property_id: propertyId, name: 'Checkout', kind: 'CHECKOUT' }).select('id').single();
  if (error) throw error;
  return data.id;
}

export async function addChecklistItem(propertyId: string, input: {
  category: string; label: string; required: boolean;
}): Promise<Result> {
  try {
    if (!input.label.trim()) return { ok: false, error: 'Enter a task description.' };
    const { sb } = await requireUser();
    const templateId = await ensureTemplate(propertyId);
    const { count } = await sb.from('checklist_items').select('id', { count: 'exact', head: true }).eq('template_id', templateId);
    const { error } = await sb.from('checklist_items').insert({
      template_id: templateId, category: input.category.trim() || 'General',
      label: input.label.trim(), required: input.required, sort_order: count ?? 0,
    });
    if (error) return fail(error, "Couldn't add that task.");
    revalidatePath('/properties');
    return { ok: true };
  } catch (e) { return fail(e, "Couldn't add that task."); }
}

export async function updateChecklistItem(itemId: string, input: { label?: string; required?: boolean }): Promise<Result> {
  try {
    const { sb } = await requireUser();
    const patch: Record<string, unknown> = {};
    if (input.label !== undefined) patch.label = input.label.trim();
    if (input.required !== undefined) patch.required = input.required;
    const { error } = await sb.from('checklist_items').update(patch).eq('id', itemId);
    if (error) return fail(error, "Couldn't update that task.");
    revalidatePath('/properties');
    return { ok: true };
  } catch (e) { return fail(e, "Couldn't update that task."); }
}

export async function removeChecklistItem(itemId: string): Promise<Result> {
  try {
    const { sb } = await requireUser();
    const { error } = await sb.from('checklist_items').delete().eq('id', itemId);
    if (error) return fail(error, "Couldn't remove that task.");
    revalidatePath('/properties');
    return { ok: true };
  } catch (e) { return fail(e, "Couldn't remove that task."); }
}

/**
 * Copies the property's current checklist into this booking's own snapshot — same
 * pattern as loadPropertyInventory. Safe to call more than once: existing rows for
 * this booking are left as-is (matched by checklist_item_id), only missing ones are added.
 */
export async function loadPropertyChecklist(bookingId: string): Promise<Result> {
  try {
    const { sb } = await requireUser();
    const { data: b } = await sb.from('bookings').select('property_id').eq('id', bookingId).single();
    if (!b) return { ok: false, error: 'Booking not found.' };
    const { data: tmpl } = await sb.from('checklist_templates')
      .select('id').eq('property_id', b.property_id).eq('kind', 'CHECKOUT').maybeSingle();
    if (!tmpl) return { ok: false, error: 'This property has no checkout checklist set up yet.' };

    const [{ data: items }, { data: existing }] = await Promise.all([
      sb.from('checklist_items').select('id,category,label,required,sort_order').eq('template_id', tmpl.id).order('sort_order'),
      sb.from('booking_checklist_items').select('checklist_item_id').eq('booking_id', bookingId),
    ]);
    const already = new Set((existing ?? []).map(e => e.checklist_item_id));
    const toInsert = (items ?? []).filter(i => !already.has(i.id));
    if (toInsert.length) {
      const { error } = await sb.from('booking_checklist_items').insert(toInsert.map(i => ({
        booking_id: bookingId, checklist_item_id: i.id, category: i.category,
        label: i.label, required: i.required, sort_order: i.sort_order,
      })));
      if (error) return fail(error, "Couldn't load the checklist.");
    }
    revalidatePath('/');
    return { ok: true };
  } catch (e) { return fail(e, "Couldn't load the checklist."); }
}
