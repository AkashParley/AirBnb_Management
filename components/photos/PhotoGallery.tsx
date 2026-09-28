'use client';
import { useEffect, useRef, useState, useTransition } from 'react';
import { Plus, X, Trash2 } from 'lucide-react';
import { uploadPhoto, listPhotosWithUrls, deletePhoto, type PhotoWithUrl } from '@/app/actions/photos';
import { validatePhotoFile } from '@/lib/photos';
import { Skeleton } from '@/components/ui/primitives';

const KINDS = ['CHECKIN', 'CHECKOUT', 'DAMAGE'] as const;

/**
 * Thumbnails only, click to preview, no gallery app. Photos are private — every URL here
 * is a short-lived signed URL fetched fresh, never a public bucket path.
 */
export function PhotoGallery({ bookingId, defaultKind = 'CHECKIN' }: { bookingId: string; defaultKind?: typeof KINDS[number] }) {
  const [photos, setPhotos] = useState<PhotoWithUrl[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<PhotoWithUrl | null>(null);
  const [kind, setKind] = useState<typeof KINDS[number]>(defaultKind);
  const [pending, start] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  const refresh = () => listPhotosWithUrls(bookingId)
    .then(r => r.ok ? (setPhotos(r.data), setError(null)) : setError(r.error))
    .catch(() => setError("Couldn't load photos."));

  useEffect(() => { refresh(); }, [bookingId]);

  const onPick = (file: File | undefined) => {
    if (!file) return;
    const invalid = validatePhotoFile({ type: file.type, size: file.size });
    if (invalid) { setError(invalid); return; }
    start(async () => {
      const fd = new FormData();
      fd.set('file', file); fd.set('bookingId', bookingId); fd.set('kind', kind);
      const r = await uploadPhoto(fd);
      if (!r.ok) setError(r.error);
      await refresh();
    });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-micro font-semibold uppercase text-ink-faint dark:text-inkD-faint">Photos</p>
        <div className="flex items-center gap-2">
          <select value={kind} onChange={e => setKind(e.target.value as typeof KINDS[number])}
            className="text-meta border border-rule dark:border-ruleD rounded-sm bg-white dark:bg-night-100 px-1.5 py-1">
            {KINDS.map(k => <option key={k} value={k}>{k[0] + k.slice(1).toLowerCase()}</option>)}
          </select>
          <button onClick={() => inputRef.current?.click()} disabled={pending}
            className="flex items-center gap-1 text-meta font-medium text-ink-muted dark:text-inkD-muted hover:text-ink dark:hover:text-inkD">
            <Plus size={14} /> Add photo
          </button>
          <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp,image/heic" capture="environment"
            hidden onChange={e => { onPick(e.target.files?.[0]); e.target.value = ''; }} />
        </div>
      </div>

      {error && <p className="text-meta text-state-fault dark:text-stateD-fault mb-2">{error}</p>}
      {!photos ? <Skeleton rows={1} /> : !photos.length ? (
        <p className="text-meta text-ink-faint dark:text-inkD-faint">No photos yet.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {photos.map(p => p.url && (
            <button key={p.id} onClick={() => setPreview(p)} className="relative size-16 rounded-xs overflow-hidden border border-rule dark:border-ruleD">
              {/* eslint-disable-next-line @next/next/no-img-element -- signed URLs expire in 10 min, not a fit for next/image's cache */}
              <img src={p.url} alt={p.kind} className="w-full h-full object-cover" loading="lazy" />
              <span className="absolute bottom-0 inset-x-0 bg-ink/60 text-white text-[9px] uppercase text-center py-0.5">{p.kind}</span>
            </button>
          ))}
        </div>
      )}

      {preview && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 grid place-items-center px-gutter">
          <button aria-label="Close" onClick={() => setPreview(null)} className="absolute inset-0 bg-black/80" />
          <div className="relative max-w-lg w-full">
            {/* eslint-disable-next-line @next/next/no-img-element -- same reason as the thumbnail above */}
            {preview.url && <img src={preview.url} alt={preview.kind} className="w-full rounded" />}
            <div className="flex justify-between mt-2">
              <button onClick={() => start(async () => { await deletePhoto(preview.id); setPreview(null); await refresh(); })}
                className="flex items-center gap-1.5 text-meta text-white/90"><Trash2 size={14} /> Delete</button>
              <button onClick={() => setPreview(null)} className="text-white/90"><X size={18} /></button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
