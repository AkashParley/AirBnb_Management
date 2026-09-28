'use client';
import { useEffect, useRef, useState } from 'react';
import { fetchGuestSuggestions } from '@/app/actions/read';

/**
 * A minimal autocomplete over existing guests — not a Guests management page (out of
 * scope this phase). Typing a name that doesn't match anything is fine: the booking
 * actions create a new guest record on save if no exact match exists.
 */
export function GuestPicker({ name, phone, onChange }: {
  name: string; phone: string;
  onChange: (name: string, phone: string) => void;
}) {
  const [suggestions, setSuggestions] = useState<{ name: string; phone: string | null }[]>([]);
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    clearTimeout(timer.current);
    if (name.trim().length < 2) { setSuggestions([]); return; }
    timer.current = setTimeout(async () => {
      const r = await fetchGuestSuggestions(name.trim());
      if (r.ok) setSuggestions(r.data);
    }, 200);
    return () => clearTimeout(timer.current);
  }, [name]);

  return (
    <div className="grid grid-cols-2 gap-3 relative">
      <div>
        <label className="block text-micro font-semibold uppercase text-ink-faint dark:text-inkD-faint mb-1">Guest</label>
        <input value={name} onFocus={() => setOpen(true)}
          onChange={e => { onChange(e.target.value, phone); setOpen(true); }}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          placeholder="Guest name" autoComplete="off"
          className="w-full border border-rule dark:border-ruleD rounded px-3 py-2 bg-white dark:bg-night-100 text-body" />
        {open && suggestions.length > 0 && (
          <ul className="absolute z-10 mt-1 w-1/2 border border-rule dark:border-ruleD rounded bg-white dark:bg-night-100 shadow-raise dark:shadow-raiseD max-h-40 overflow-auto">
            {suggestions.map(g => (
              <li key={g.name}>
                <button type="button" onMouseDown={() => onChange(g.name, g.phone ?? '')}
                  className="w-full text-left px-3 py-2 text-meta hover:bg-ivory-100 dark:hover:bg-night-200">
                  {g.name}{g.phone && <span className="text-ink-faint dark:text-inkD-faint"> · {g.phone}</span>}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div>
        <label className="block text-micro font-semibold uppercase text-ink-faint dark:text-inkD-faint mb-1">Phone (optional)</label>
        <input value={phone} onChange={e => onChange(name, e.target.value)}
          placeholder="+91…" autoComplete="off"
          className="w-full border border-rule dark:border-ruleD rounded px-3 py-2 bg-white dark:bg-night-100 text-body" />
      </div>
    </div>
  );
}
