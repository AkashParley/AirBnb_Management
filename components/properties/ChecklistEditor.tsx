'use client';
import { useEffect, useState, useTransition } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { fetchPropertyChecklist } from '@/app/actions/read';
import { addChecklistItem, updateChecklistItem, removeChecklistItem } from '@/app/actions/checklist';
import type { ChecklistTemplateRow } from '@/lib/queries/operations';
import { Skeleton, ErrorState, EmptyState } from '@/components/ui/primitives';

/**
 * Simple, flat, property-specific checkout checklist — reuses checklist_templates/
 * checklist_items exactly as they already existed. No workflow engine, no ordering UI,
 * no categories beyond a free-text label per item.
 */
export function ChecklistEditor({ propertyId }: { propertyId: string }) {
  const [rows, setRows] = useState<ChecklistTemplateRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newLabel, setNewLabel] = useState('');
  const [newRequired, setNewRequired] = useState(true);
  const [pending, start] = useTransition();

  const refresh = () => fetchPropertyChecklist(propertyId)
    .then(r => r.ok ? (setRows(r.data), setError(null)) : setError(r.error))
    .catch(() => setError("Couldn't load the checklist."));

  useEffect(() => { refresh(); }, [propertyId]);

  const act = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    start(async () => { const r = await fn(); if (!r.ok) setError(r.error ?? 'That did not work.'); await refresh(); });

  const add = () => {
    if (!newLabel.trim()) { setError('Enter a task.'); return; }
    act(async () => {
      const r = await addChecklistItem(propertyId, { category: 'General', label: newLabel, required: newRequired });
      if (r.ok) setNewLabel('');
      return r;
    });
  };

  if (error && !rows) return <ErrorState message={error} retry={refresh} />;
  if (!rows) return <Skeleton rows={3} />;

  return (
    <div>
      <p className="text-micro font-semibold uppercase text-ink-faint dark:text-inkD-faint mb-2">Checkout checklist</p>
      {error && <p className="text-meta text-state-fault dark:text-stateD-fault mb-2">{error}</p>}
      {!rows.length ? (
        <EmptyState title="No checklist yet" body="Add the tasks a caretaker should confirm before marking this property clean." />
      ) : (
        <ul className="border border-rule dark:border-ruleD rounded bg-white dark:bg-night-100 divide-y divide-rule-soft dark:divide-ruleD-soft mb-2">
          {rows.map(r => (
            <li key={r.id} className="flex items-center justify-between px-3.5 py-2.5">
              <label className="flex items-center gap-2.5">
                <input type="checkbox" checked={r.required} disabled={pending}
                  onChange={e => act(() => updateChecklistItem(r.id, { required: e.target.checked }))} />
                <span>{r.label}</span>
                {!r.required && <span className="text-micro text-ink-faint dark:text-inkD-faint uppercase">optional</span>}
              </label>
              <button aria-label={`Remove ${r.label}`} disabled={pending} onClick={() => act(() => removeChecklistItem(r.id))}
                className="text-ink-faint dark:text-inkD-faint hover:text-state-fault dark:hover:text-stateD-fault">
                <Trash2 size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-2">
        <input value={newLabel} onChange={e => setNewLabel(e.target.value)} placeholder="e.g. Keys collected"
          onKeyDown={e => e.key === 'Enter' && add()}
          className="flex-1 border border-rule dark:border-ruleD rounded px-3 py-2 bg-white dark:bg-night-100 text-meta" />
        <label className="flex items-center gap-1.5 text-meta text-ink-muted dark:text-inkD-muted">
          <input type="checkbox" checked={newRequired} onChange={e => setNewRequired(e.target.checked)} /> required
        </label>
        <button onClick={add} disabled={pending}
          className="flex items-center gap-1 px-3 rounded border border-rule dark:border-ruleD text-meta font-medium disabled:opacity-40">
          <Plus size={14} /> Add
        </button>
      </div>
    </div>
  );
}
