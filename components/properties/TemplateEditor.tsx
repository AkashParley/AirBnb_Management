'use client';
import { useEffect, useState, useTransition } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { fetchPropertyTemplate } from '@/app/actions/read';
import { addTemplateItem, updateTemplateItemQty, removeTemplateItem } from '@/app/actions/property-inventory';
import type { TemplateRow } from '@/lib/queries/operations';
import { AddItemDialog } from '@/components/inventory/AddItemDialog';
import { Skeleton, ErrorState, EmptyState } from '@/components/ui/primitives';

/** The property's master inventory list — this is what loadPropertyInventory copies into a stay. */
export function TemplateEditor({ propertyId }: { propertyId: string }) {
  const [rows, setRows] = useState<TemplateRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [pending, start] = useTransition();

  const refresh = () => fetchPropertyTemplate(propertyId)
    .then(r => r.ok ? (setRows(r.data), setError(null)) : setError(r.error))
    .catch(() => setError("Couldn't load the inventory template."));

  useEffect(() => { refresh(); }, [propertyId]);

  const act = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    start(async () => { const r = await fn(); if (!r.ok) setError(r.error ?? 'That did not work.'); await refresh(); });

  if (error && !rows) return <ErrorState message={error} retry={refresh} />;
  if (!rows) return <Skeleton rows={4} />;

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-micro font-semibold uppercase text-ink-faint dark:text-inkD-faint">Inventory template</p>
        <button onClick={() => setAdding(true)}
          className="flex items-center gap-1 text-meta font-medium text-ink-muted dark:text-inkD-muted hover:text-ink dark:hover:text-inkD">
          <Plus size={14} /> Add item
        </button>
      </div>
      {error && <p className="text-meta text-state-fault dark:text-stateD-fault mb-2">{error}</p>}
      {!rows.length ? (
        <EmptyState title="No items yet" body="Add the items this property hands over to every guest." />
      ) : (
        <ul className="border border-rule dark:border-ruleD rounded bg-white dark:bg-night-100 divide-y divide-rule-soft dark:divide-ruleD-soft">
          {rows.map(r => (
            <li key={r.id} className="flex items-center justify-between px-3.5 py-2.5">
              <span>{r.itemName}</span>
              <span className="flex items-center gap-3">
                <span className="flex items-center gap-2">
                  <button aria-label="Decrease" disabled={pending} onClick={() => act(() => updateTemplateItemQty(r.id, Math.max(1, r.expectedQty - 1)))}
                    className="size-7 border border-rule dark:border-ruleD rounded-sm bg-white dark:bg-night-200">−</button>
                  <b className="min-w-5 text-center tabular-nums">{r.expectedQty}</b>
                  <button aria-label="Increase" disabled={pending} onClick={() => act(() => updateTemplateItemQty(r.id, r.expectedQty + 1))}
                    className="size-7 border border-rule dark:border-ruleD rounded-sm bg-white dark:bg-night-200">+</button>
                </span>
                <button aria-label={`Remove ${r.itemName}`} disabled={pending} onClick={() => act(() => removeTemplateItem(r.id))}
                  className="text-ink-faint dark:text-inkD-faint hover:text-state-fault dark:hover:text-stateD-fault">
                  <Trash2 size={14} />
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
      {adding && (
        <AddItemDialog context="template" onClose={() => setAdding(false)}
          onSubmit={async input => {
            const r = await addTemplateItem(propertyId, {
              itemId: input.itemId, newItemName: input.newItemName, unit: input.unit,
              replacementCost: input.replacementCost, expectedQty: input.qty,
            });
            if (!r.ok) { setError(r.error); return; }
            setAdding(false);
            await refresh();
          }} />
      )}
    </div>
  );
}
