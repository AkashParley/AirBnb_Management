'use client';
import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { format } from 'date-fns';
import { Trash2 } from 'lucide-react';
import type { BookingListRow } from '@/lib/queries/operations';
import type { PropertyStatus } from '@/lib/calculations';
import { Money, Tag, EmptyState } from '@/components/ui/primitives';
import { StaySheet } from '@/components/stay/StaySheet';
import { DeleteBookingDialog } from './DeleteBookingDialog';

const STATUS_TONE: Record<string, 'ready' | 'attend' | 'info' | 'fault'> = {
  CONFIRMED: 'info', IN_STAY: 'ready', CHECKED_OUT: 'attend', CANCELLED: 'fault',
};

/**
 * Owns which booking is open; the list itself stays a plain server-rendered table/cards.
 * `?open=<bookingId>` (used by global search's "open the Stay Workspace" navigation) is
 * read on mount to auto-open that booking, independent of whatever filters currently
 * apply to the visible list — the sheet doesn't require the booking to be a rendered row.
 */
export function BookingsPageClient({ rows, properties }: {
  rows: BookingListRow[];
  properties: { id: string; name: string; status: PropertyStatus; capacity: number }[];
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [openId, setOpenId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<BookingListRow | null>(null);

  useEffect(() => {
    const target = params.get('open');
    if (target) setOpenId(target);
  }, [params]);

  const close = () => {
    setOpenId(null);
    if (params.get('open')) {
      const next = new URLSearchParams(params.toString());
      next.delete('open');
      router.replace(next.toString() ? `?${next.toString()}` : '?');
    }
  };

  return (
    <>
      {!rows.length ? (
        <EmptyState title="No bookings match" body="Try a different search or clear the filters." />
      ) : (
        <>
          {/* Desktop table */}
          <table className="w-full hidden md:table border border-rule dark:border-ruleD rounded overflow-hidden bg-white dark:bg-night-100">
            <thead>
              <tr className="text-micro uppercase text-ink-faint dark:text-inkD-faint text-left">
                <th className="px-3 py-2 font-semibold">Guest</th>
                <th className="px-3 py-2 font-semibold">Property</th>
                <th className="px-3 py-2 font-semibold">Check-in</th>
                <th className="px-3 py-2 font-semibold">Check-out</th>
                <th className="px-3 py-2 font-semibold text-right">Guests</th>
                <th className="px-3 py-2 font-semibold text-right">Total</th>
                <th className="px-3 py-2 font-semibold text-right">Remaining</th>
                <th className="px-3 py-2 font-semibold">Status</th>
                <th className="px-2 py-2 w-10"><span className="sr-only">Action</span></th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id} onClick={() => setOpenId(r.id)}
                  className="border-t border-rule-soft dark:border-ruleD-soft cursor-pointer hover:bg-ivory-100 dark:hover:bg-night-200/50">
                  <td className="px-3 py-2.5 font-medium">{r.guestName}</td>
                  <td className="px-3 py-2.5 text-ink-muted dark:text-inkD-muted">{r.propertyName}</td>
                  <td className="px-3 py-2.5 tabular-nums">{format(new Date(r.checkinDate), 'd MMM yyyy')}</td>
                  <td className="px-3 py-2.5 tabular-nums">{format(new Date(r.checkoutDate), 'd MMM yyyy')}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{r.guestCount}</td>
                  <td className="px-3 py-2.5 text-right"><Money value={r.payment.total} /></td>
                  <td className="px-3 py-2.5 text-right"><Money value={r.payment.remaining} muted={r.payment.remaining === 0} /></td>
                  <td className="px-3 py-2.5"><Tag tone={STATUS_TONE[r.status] ?? 'info'}>{r.status.replace('_', ' ')}</Tag></td>
                  <td className="px-2 py-2.5 text-right">
                    <button aria-label={`Delete booking for ${r.guestName}`} title="Delete booking"
                      onClick={e => { e.stopPropagation(); setDeleting(r); }}
                      className="p-1.5 rounded-sm text-ink-faint dark:text-inkD-faint hover:text-state-fault dark:hover:text-stateD-fault hover:bg-state-faultBg/60 dark:hover:bg-stateD-faultBg/60 transition-colors">
                      <Trash2 size={15} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Mobile compact rows */}
          <ul className="md:hidden border border-rule dark:border-ruleD rounded bg-white dark:bg-night-100 divide-y divide-rule-soft dark:divide-ruleD-soft overflow-hidden">
            {rows.map(r => (
              <li key={r.id} className="flex items-stretch">
                <button onClick={() => setOpenId(r.id)} className="flex-1 min-w-0 text-left px-3.5 py-3 active:bg-ivory-200 dark:active:bg-night-200">
                  <div className="flex justify-between">
                    <span className="font-medium">{r.guestName}</span>
                    <Money value={r.payment.total} />
                  </div>
                  <div className="flex justify-between mt-1">
                    <span className="text-meta text-ink-muted dark:text-inkD-muted">{r.propertyName}</span>
                    <Tag tone={STATUS_TONE[r.status] ?? 'info'}>{r.status.replace('_', ' ')}</Tag>
                  </div>
                  <p className="text-meta text-ink-faint dark:text-inkD-faint mt-1 tabular-nums">
                    {format(new Date(r.checkinDate), 'd MMM')} → {format(new Date(r.checkoutDate), 'd MMM yyyy')}
                    {r.payment.remaining > 0 && <> · ₹{r.payment.remaining.toLocaleString('en-IN')} due</>}
                  </p>
                </button>
                <span className="flex items-center pr-2">
                  <button aria-label={`Delete booking for ${r.guestName}`} title="Delete booking"
                      onClick={e => { e.stopPropagation(); setDeleting(r); }}
                      className="p-1.5 rounded-sm text-ink-faint dark:text-inkD-faint hover:text-state-fault dark:hover:text-stateD-fault hover:bg-state-faultBg/60 dark:hover:bg-stateD-faultBg/60 transition-colors">
                      <Trash2 size={15} />
                    </button>
                </span>
              </li>
            ))}
          </ul>
        </>
      )}

      {deleting && <DeleteBookingDialog booking={deleting} onClose={() => setDeleting(null)} />}
      {openId && <StaySheet bookingId={openId} properties={properties} onClose={close} />}
    </>
  );
}