/**
 * Pure upload validation — mirrors the Storage bucket's own constraints
 * (supabase/migrations/0002_rls.sql: allowed_mime_types, file_size_limit) so a bad file
 * is rejected instantly client-side with a clear message, rather than failing opaquely
 * at the Storage layer. The bucket-level check remains the actual security boundary;
 * this is a UX improvement, not a replacement for it.
 */
export const ALLOWED_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'] as const;
export const MAX_PHOTO_BYTES = 10 * 1024 * 1024; // matches the bucket's file_size_limit

export function validatePhotoFile(file: { type: string; size: number }): string | null {
  if (!ALLOWED_PHOTO_TYPES.includes(file.type as typeof ALLOWED_PHOTO_TYPES[number]))
    return 'Only JPEG, PNG, WEBP or HEIC images are allowed.';
  if (file.size > MAX_PHOTO_BYTES) return 'Photos must be under 10 MB.';
  if (file.size <= 0) return 'That file looks empty.';
  return null;
}
