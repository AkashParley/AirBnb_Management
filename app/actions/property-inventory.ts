'use server';
import { revalidatePath } from 'next/cache';
import { requireUser } from '@/lib/supabase/server';

type Result = { ok: true } | { ok: false; error: string };
const fail = (e: unknown, friendly: string): Result => { console.error(friendly, e); return { ok: false, error: friendly }; };

/**
 * Property inventory template CRUD — the one piece Phase 1/2 never built. Reuses
 * inventory_items and property_inventory_templates exactly as they already exist;
 * no new tables. Removing a template row never touches inventory_items itself, since
 * the same catalog item may be templated on other properties too.
 */
export async function addTemplateItem(propertyId: string, input: {
  itemId?: string; newItemName?: string; unit?: string; replacementCost?: number; expectedQty: number;
}): Promise<Result> {
  try {
    if (!Number.isInteger(input.expectedQty) || input.expectedQty <= 0)
      return { ok: false, error: 'Enter a quantity above zero.' };
    if (!input.itemId && !input.newItemName?.trim())
      return { ok: false, error: 'Choose an item or name a new one.' };

    const { sb, user } = await requireUser();
    let itemId = input.itemId;
    if (!itemId) {
      const name = input.newItemName!.trim();
      const { data: existing } = await sb.from('inventory_items').select('id').eq('name', name).maybeSingle();
      itemId = existing?.id ?? (await sb.from('inventory_items').insert({
        owner_id: user.id, name, unit: input.unit || 'pc', replacement_cost: input.replacementCost ?? 0,
      }).select('id').single()).data!.id;
    }

    const { error } = await sb.from('property_inventory_templates').upsert(
      { property_id: propertyId, item_id: itemId, expected_qty: input.expectedQty },
      { onConflict: 'property_id,item_id' },
    );
    if (error) return fail(error, "Couldn't add that item to the template.");
    revalidatePath(`/properties/${propertyId}`);
    return { ok: true };
  } catch (e) { return fail(e, "Couldn't add that item to the template."); }
}

export async function updateTemplateItemQty(templateRowId: string, expectedQty: number): Promise<Result> {
  try {
    if (!Number.isInteger(expectedQty) || expectedQty <= 0)
      return { ok: false, error: 'Enter a quantity above zero.' };
    const { sb } = await requireUser();
    const { error } = await sb.from('property_inventory_templates')
      .update({ expected_qty: expectedQty }).eq('id', templateRowId);
    if (error) return fail(error, "Couldn't update that quantity.");
    revalidatePath('/properties');
    return { ok: true };
  } catch (e) { return fail(e, "Couldn't update that quantity."); }
}

/** Removes the item from THIS property's template only — inventory_items itself is untouched. */
export async function removeTemplateItem(templateRowId: string): Promise<Result> {
  try {
    const { sb } = await requireUser();
    const { error } = await sb.from('property_inventory_templates').delete().eq('id', templateRowId);
    if (error) return fail(error, "Couldn't remove that item.");
    revalidatePath('/properties');
    return { ok: true };
  } catch (e) { return fail(e, "Couldn't remove that item."); }
}
