'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { deleteBooking } from '@/app/actions/stay';
import type { BookingListRow } from '@/lib/queries/operations';

export function DeleteBookingDialog({ booking, onClose }: { booking: BookingListRow; onClose: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const confirm = () => start(async () => {
    const r = await deleteBooking(booking.id);
    if (!r.ok) { setError(r.error); return; }
    router.refresh();
    onClose();
  });

  return (
    <div role="alertdialog" aria-modal="true" aria-labelledby="del-title" className="fixed inset-0 z-50 grid place-items-center px-gutter">
      <button aria-label="Cancel" onClick={onClose} className="absolute inset-0 bg-ink/35 dark:bg-black/60" />
      <div className="relative w-full max-w-sm bg-white dark:bg-night-100 border border-rule dark:border-ruleD rounded-lg p-5">
        <h2 id="del-title" className="text-title font-semibold mb-3">Delete booking?</h2>
        <dl className="text-body space-y-1 mb-3">
          <div className="flex gap-2"><dt className="text-ink-muted dark:text-inkD-muted w-20 shrink-0">Guest</dt><dd className="font-medium">{booking.guestName}</dd></div>
          <div className="flex gap-2"><dt className="text-ink-muted dark:text-inkD-muted w-20 shrink-0">Property</dt><dd>{booking.propertyName}</dd></div>
          <div className="flex gap-2"><dt className="text-ink-muted dark:text-inkD-muted w-20 shrink-0">Stay</dt>
            <dd className="tabular-nums">{format(new Date(booking.checkinDate), 'd MMM yyyy')} → {format(new Date(booking.checkoutDate), 'd MMM yyyy')}</dd></div>
        </dl>
        <p className="text-meta text-ink-muted dark:text-inkD-muted">This action cannot be undone.</p>
        {error && <p role="alert" className="text-meta text-state-fault dark:text-stateD-fault mt-2">{error}</p>}
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} disabled={pending}
            className="px-3.5 py-2 rounded border border-rule dark:border-ruleD text-meta font-medium disabled:opacity-40">Cancel</button>
          <button onClick={confirm} disabled={pending}
            className="px-3.5 py-2 rounded bg-state-fault dark:bg-stateD-fault text-white dark:text-night-50 text-meta font-medium disabled:opacity-40">
            {pending ? 'Deleting…' : 'Delete booking'}
          </button>
        </div>
      </div>
    </div>
  );
}