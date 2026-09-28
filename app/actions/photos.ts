'use server';
import { revalidatePath } from 'next/cache';
import { requireUser } from '@/lib/supabase/server';
import { validatePhotoFile } from '@/lib/photos';

type Result = { ok: true } | { ok: false; error: string };
const fail = (e: unknown, friendly: string): Result => { console.error(friendly, e); return { ok: false, error: friendly }; };

const BUCKET = 'keeystay';
const SIGNED_URL_TTL = 60 * 10; // 10 minutes — long enough to view/preview, never stored or logged

/**
 * Uploads happen entirely server-side: the browser has no Supabase session in this
 * single-user build (auth was removed earlier in the project), so the file is sent to
 * this action as FormData and written to Storage using the server's service-role client.
 * The service role key never reaches client code — only this file touches it, same as
 * every other action in the app.
 */
export async function uploadPhoto(formData: FormData): Promise<Result> {
  try {
    const file = formData.get('file');
    const bookingId = formData.get('bookingId');
    const kind = formData.get('kind');
    if (!(file instanceof File) || typeof bookingId !== 'string' || typeof kind !== 'string')
      return { ok: false, error: 'Missing file or context.' };

    const invalid = validatePhotoFile({ type: file.type, size: file.size });
    if (invalid) return { ok: false, error: invalid };

    const { sb, user } = await requireUser();
    const { data: b } = await sb.from('bookings').select('property_id').eq('id', bookingId).single();
    if (!b) return { ok: false, error: 'Booking not found.' };

    const ext = file.name.split('.').pop() || 'jpg';
    const path = `${user.id}/${bookingId}/${kind}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const bytes = new Uint8Array(await file.arrayBuffer());

    const { error: upErr } = await sb.storage.from(BUCKET).upload(path, bytes, { contentType: file.type });
    if (upErr) return fail(upErr, "Couldn't upload that photo.");

    const { error: dbErr } = await sb.from('photos').insert({
      owner_id: user.id, kind, storage_path: path,
      booking_id: bookingId, property_id: b.property_id, bytes: file.size,
    });
    if (dbErr) {
      await sb.storage.from(BUCKET).remove([path]); // don't leave an orphaned file if the DB row fails
      return fail(dbErr, "Couldn't save that photo's details.");
    }

    revalidatePath('/');
    return { ok: true };
  } catch (e) { return fail(e, "Couldn't upload that photo."); }
}

export interface PhotoWithUrl { id: string; kind: string; caption: string | null; createdAt: string; url: string | null }

/** Signed URLs are generated fresh on every call — never stored, never logged, expire in 10 minutes. */
export async function listPhotosWithUrls(bookingId: string):
  Promise<{ ok: true; data: PhotoWithUrl[] } | { ok: false; error: string }> {
  try {
    const { sb } = await requireUser();
    const { data: rows, error } = await sb.from('photos')
      .select('id,kind,storage_path,caption,created_at').eq('booking_id', bookingId).order('created_at', { ascending: false });
    if (error) throw error;

    const withUrls = await Promise.all((rows ?? []).map(async r => {
      const { data: signed } = await sb.storage.from(BUCKET).createSignedUrl(r.storage_path, SIGNED_URL_TTL);
      return { id: r.id, kind: r.kind, caption: r.caption, createdAt: r.created_at, url: signed?.signedUrl ?? null };
    }));
    return { ok: true, data: withUrls };
  } catch (e) {
    console.error('listPhotosWithUrls', e); // never logs the storage path itself
    return { ok: false, error: "Couldn't load photos." };
  }
}

export async function deletePhoto(photoId: string): Promise<Result> {
  try {
    const { sb } = await requireUser();
    const { data: row } = await sb.from('photos').select('storage_path').eq('id', photoId).single();
    if (!row) return { ok: false, error: 'Photo not found.' };
    await sb.storage.from(BUCKET).remove([row.storage_path]);
    const { error } = await sb.from('photos').delete().eq('id', photoId);
    if (error) return fail(error, "Couldn't delete that photo.");
    revalidatePath('/');
    return { ok: true };
  } catch (e) { return fail(e, "Couldn't delete that photo."); }
}
