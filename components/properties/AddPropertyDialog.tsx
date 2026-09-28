'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { X } from 'lucide-react';
import { createProperty } from '@/app/actions/property';

export function AddPropertyDialog({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [name, setName] = useState('');
  const [capacity, setCapacity] = useState('2');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = () => start(async () => {
    const r = await createProperty({ name, capacity: Number(capacity), address, notes });
    if (!r.ok) { setError(r.error); return; }
    router.refresh();
    onClose();
  });

  return (
    <div role="dialog" aria-modal="true" aria-label="New property" className="fixed inset-0 z-50 grid place-items-center px-gutter">
      <button aria-label="Close" onClick={onClose} className="absolute inset-0 bg-ink/35 dark:bg-black/60" />
      <div className="relative w-full max-w-sm bg-white dark:bg-night-100 border border-rule dark:border-ruleD rounded p-5">
        <div className="flex items-start justify-between mb-3">
          <h2 className="text-title font-semibold">New property</h2>
          <button onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>

        {error && <p role="alert" className="text-meta text-state-fault dark:text-stateD-fault mb-2">{error}</p>}

        <div className="space-y-3">
          <div>
            <label className="block text-micro font-semibold uppercase text-ink-faint dark:text-inkD-faint mb-1">Property name</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Riverside Villa" autoFocus
              className="w-full border border-rule dark:border-ruleD rounded px-2.5 py-1.5 bg-white dark:bg-night-100" />
          </div>
          <div>
            <label className="block text-micro font-semibold uppercase text-ink-faint dark:text-inkD-faint mb-1">Sleeps up to</label>
            <input type="number" min={1} max={50} value={capacity} onChange={e => setCapacity(e.target.value)}
              className="w-24 border border-rule dark:border-ruleD rounded px-2.5 py-1.5 bg-white dark:bg-night-100" />
          </div>
          <div>
            <label className="block text-micro font-semibold uppercase text-ink-faint dark:text-inkD-faint mb-1">Location (optional)</label>
            <input value={address} onChange={e => setAddress(e.target.value)} placeholder="Dehradun"
              className="w-full border border-rule dark:border-ruleD rounded px-2.5 py-1.5 bg-white dark:bg-night-100" />
          </div>
          <div>
            <label className="block text-micro font-semibold uppercase text-ink-faint dark:text-inkD-faint mb-1">Notes (optional)</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
              className="w-full border border-rule dark:border-ruleD rounded px-2.5 py-1.5 bg-white dark:bg-night-100" />
          </div>
        </div>

        <button onClick={submit} disabled={pending || !name.trim()}
          className="mt-4 w-full rounded bg-ink dark:bg-inkD text-ivory-50 dark:text-night-50 py-2.5 font-medium disabled:opacity-40">
          {pending ? 'Creating…' : 'Create property'}
        </button>
      </div>
    </div>
  );
}
