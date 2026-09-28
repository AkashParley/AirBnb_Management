'use client';
import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { fetchInventoryItems } from '@/app/actions/read';

interface Item { id: string; name: string; unit: string; replacement_cost: number }

/**
 * Shared by check-in (ad-hoc item, this stay only) and the property template editor
 * (this property's master list). `context` only changes labels/the optional "also add
 * to template" checkbox — the underlying inventory_items catalog is the same table either way.
 */
export function AddItemDialog({ context, onClose, onSubmit }: {
  context: 'checkin' | 'template';
  onClose: () => void;
  onSubmit: (input: { itemId?: string; newItemName?: string; unit?: string; replacementCost?: number; qty: number; addToTemplate?: boolean }) => Promise<void>;
}) {
  const [items, setItems] = useState<Item[]>([]);
  const [mode, setMode] = useState<'existing' | 'new'>('existing');
  const [itemId, setItemId] = useState('');
  const [newName, setNewName] = useState('');
  const [unit, setUnit] = useState('pc');
  const [cost, setCost] = useState('0');
  const [qty, setQty] = useState('1');
  const [addToTemplate, setAddToTemplate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { fetchInventoryItems().then(r => { if (r.ok) setItems(r.data); }); }, []);

  const submit = async () => {
    setError(null);
    const q = Number(qty);
    if (!Number.isInteger(q) || q <= 0) { setError('Enter a quantity above zero.'); return; }
    if (mode === 'existing' && !itemId) { setError('Choose an item.'); return; }
    if (mode === 'new' && !newName.trim()) { setError('Name the new item.'); return; }
    setSaving(true);
    try {
      await onSubmit(
        mode === 'existing'
          ? { itemId, qty: q, addToTemplate }
          : { newItemName: newName.trim(), unit, replacementCost: Number(cost) || 0, qty: q, addToTemplate },
      );
    } finally { setSaving(false); }
  };

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 grid place-items-center px-gutter">
      <button aria-label="Close" onClick={onClose} className="absolute inset-0 bg-ink/35 dark:bg-black/60" />
      <div className="relative w-full max-w-sm bg-white dark:bg-night-100 border border-rule dark:border-ruleD rounded p-5">
        <div className="flex items-start justify-between mb-3">
          <h3 className="text-title font-semibold">Add item</h3>
          <button onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>

        <div className="flex gap-1 mb-3">
          <button onClick={() => setMode('existing')}
            className={`px-2.5 py-1 text-meta rounded-sm border ${mode === 'existing' ? 'bg-ink dark:bg-inkD text-ivory-50 dark:text-night-50 border-ink dark:border-inkD' : 'border-rule dark:border-ruleD text-ink-muted dark:text-inkD-muted'}`}>
            Existing item
          </button>
          <button onClick={() => setMode('new')}
            className={`px-2.5 py-1 text-meta rounded-sm border ${mode === 'new' ? 'bg-ink dark:bg-inkD text-ivory-50 dark:text-night-50 border-ink dark:border-inkD' : 'border-rule dark:border-ruleD text-ink-muted dark:text-inkD-muted'}`}>
            New item
          </button>
        </div>

        {mode === 'existing' ? (
          <select value={itemId} onChange={e => setItemId(e.target.value)}
            className="w-full border border-rule dark:border-ruleD rounded px-3 py-2 bg-white dark:bg-night-100 mb-3">
            <option value="">Choose an item…</option>
            {items.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
          </select>
        ) : (
          <div className="space-y-2 mb-3">
            <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Item name"
              className="w-full border border-rule dark:border-ruleD rounded px-3 py-2 bg-white dark:bg-night-100" />
            <div className="grid grid-cols-2 gap-2">
              <input value={unit} onChange={e => setUnit(e.target.value)} placeholder="Unit (pc, set…)"
                className="w-full border border-rule dark:border-ruleD rounded px-3 py-2 bg-white dark:bg-night-100" />
              <input type="number" min={0} value={cost} onChange={e => setCost(e.target.value)} placeholder="Replacement ₹"
                className="w-full border border-rule dark:border-ruleD rounded px-3 py-2 bg-white dark:bg-night-100" />
            </div>
          </div>
        )}

        <label className="block text-micro font-semibold uppercase text-ink-faint dark:text-inkD-faint mb-1">
          {context === 'checkin' ? 'Given quantity' : 'Expected quantity'}
        </label>
        <input type="number" min={1} value={qty} onChange={e => setQty(e.target.value)}
          className="w-full border border-rule dark:border-ruleD rounded px-3 py-2 bg-white dark:bg-night-100 mb-3" />

        {context === 'checkin' && (
          <label className="flex items-center gap-2 text-meta text-ink-muted dark:text-inkD-muted mb-3">
            <input type="checkbox" checked={addToTemplate} onChange={e => setAddToTemplate(e.target.checked)} />
            Also add to this property's template for next time
          </label>
        )}

        {error && <p className="text-meta text-state-fault dark:text-stateD-fault mb-2">{error}</p>}
        <button onClick={submit} disabled={saving}
          className="w-full rounded bg-ink dark:bg-inkD text-ivory-50 dark:text-night-50 py-2.5 font-medium disabled:opacity-40">
          {saving ? 'Adding…' : 'Add item'}
        </button>
      </div>
    </div>
  );
}
