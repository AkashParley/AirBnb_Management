'use client';
import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { BookingSheet } from '@/components/booking/BookingSheet';
import type { PropertyStatus } from '@/lib/calculations';

/**
 * Reuses BookingSheet exactly as Calendar's empty-date click does — no second form, no
 * new action. Opened from here, no date or property is prefilled; the caretaker picks both.
 */
export function NewBookingButton({ properties }: {
  properties: { id: string; name: string; status: PropertyStatus; capacity: number }[];
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  return (
    <>
      <button onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded bg-ink dark:bg-inkD text-ivory-50 dark:text-night-50 px-3 py-1.5 text-meta font-medium">
        <Plus size={14} /> New Booking
      </button>
      {open && (
        <BookingSheet
          mode="create" properties={properties}
          onClose={() => setOpen(false)}
          onSaved={() => { setOpen(false); router.refresh(); }}
        />
      )}
    </>
  );
}
