'use client';
import { useState } from 'react';
import { Plus } from 'lucide-react';
import { AddPropertyDialog } from './AddPropertyDialog';

export function AddPropertyButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded bg-ink dark:bg-inkD text-ivory-50 dark:text-night-50 px-3 py-1.5 text-meta font-medium">
        <Plus size={14} /> Add Property
      </button>
      {open && <AddPropertyDialog onClose={() => setOpen(false)} />}
    </>
  );
}
