'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, X, Loader2 } from 'lucide-react';
import { globalSearch, type SearchResults } from '@/app/actions/search';

type Flat = { kind: 'booking' | 'property' | 'guest'; key: string; go: () => void; primary: string; secondary: string };

/**
 * Compact command-palette style search, not a search page. Reuses the existing Bookings
 * page's own filter for guest results (there's no separate guest destination in this
 * app), the Stay Workspace for bookings (via /bookings?open=<id>, read by
 * BookingsPageClient), and /properties/[id] for properties — no new pages.
 */
export function GlobalSearch() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setOpen(true); }
      if (e.key === 'Escape') setOpen(false);
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 10); }, [open]);
  useEffect(() => { if (!open) { setQuery(''); setResults(null); setError(null); setActiveIndex(0); } }, [open]);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    if (query.trim().length < 2) { setResults(null); setLoading(false); return; }
    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      const r = await globalSearch(query);
      if (r.ok) { setResults(r.data); setError(null); } else setError(r.error);
      setLoading(false);
      setActiveIndex(0);
    }, 220);
    return () => clearTimeout(debounceRef.current);
  }, [query]);

  const flat: Flat[] = results ? [
    ...results.bookings.map(b => ({
      kind: 'booking' as const, key: `b-${b.id}`, primary: b.guestName,
      secondary: `${b.propertyName} · ${b.checkinDate} → ${b.checkoutDate}`,
      go: () => router.push(`/bookings?open=${b.id}`),
    })),
    ...results.properties.map(p => ({
      kind: 'property' as const, key: `p-${p.id}`, primary: p.name, secondary: 'Property',
      go: () => router.push(`/properties/${p.id}`),
    })),
    ...results.guests.map(g => ({
      kind: 'guest' as const, key: `g-${g.name}`, primary: g.name, secondary: g.phone ?? 'Guest',
      go: () => router.push(`/bookings?q=${encodeURIComponent(g.name)}`),
    })),
  ] : [];

  const choose = (item: Flat) => { item.go(); setOpen(false); };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIndex(i => Math.min(i + 1, flat.length - 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIndex(i => Math.max(i - 1, 0)); }
    if (e.key === 'Enter' && flat[activeIndex]) { e.preventDefault(); choose(flat[activeIndex]); }
  };

  return (
    <>
      <button onClick={() => setOpen(true)}
        className="flex-1 max-w-md flex items-center gap-2 text-left pl-3 pr-3 py-2 text-meta border border-rule dark:border-ruleD rounded bg-ivory-50 dark:bg-night-50 text-ink-faint dark:text-inkD-faint hover:border-ink-faint dark:hover:border-inkD-faint">
        <Search size={15} />
        <span className="flex-1">Search bookings, guests, properties…</span>
        <kbd className="text-micro border border-rule dark:border-ruleD rounded-xs px-1.5 py-0.5">⌘K</kbd>
      </button>

      {open && (
        <div role="dialog" aria-modal="true" aria-label="Global search" className="fixed inset-0 z-[60]">
          <button aria-label="Close search" onClick={() => setOpen(false)} className="absolute inset-0 bg-ink/35 dark:bg-black/60" />
          <div className="absolute left-1/2 top-24 -translate-x-1/2 w-[min(560px,92vw)] bg-white dark:bg-night-100 border border-rule dark:border-ruleD rounded-lg shadow-sheet dark:shadow-sheetD overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-rule dark:border-ruleD">
              <Search size={16} className="text-ink-faint dark:text-inkD-faint shrink-0" />
              <input ref={inputRef} value={query} onChange={e => setQuery(e.target.value)} onKeyDown={onKeyDown}
                placeholder="Search bookings, guests, properties…"
                className="flex-1 bg-transparent outline-none text-body" />
              {loading && <Loader2 size={15} className="animate-spin text-ink-faint dark:text-inkD-faint" />}
              {query && !loading && (
                <button aria-label="Clear" onClick={() => setQuery('')} className="text-ink-faint dark:text-inkD-faint">
                  <X size={15} />
                </button>
              )}
            </div>

            <div className="max-h-[60vh] overflow-auto py-1.5">
              {error && <p className="px-4 py-3 text-meta text-state-fault dark:text-stateD-fault">{error}</p>}
              {!error && query.trim().length < 2 && (
                <p className="px-4 py-6 text-meta text-ink-faint dark:text-inkD-faint text-center">Keep typing to search…</p>
              )}
              {!error && query.trim().length >= 2 && !loading && results && flat.length === 0 && (
                <p className="px-4 py-6 text-meta text-ink-faint dark:text-inkD-faint text-center">No results for "{query}"</p>
              )}
              {!error && results && (
                <>
                  <Group label="Bookings" items={flat.filter(f => f.kind === 'booking')} flat={flat} activeIndex={activeIndex} onChoose={choose} onHover={setActiveIndex} />
                  <Group label="Properties" items={flat.filter(f => f.kind === 'property')} flat={flat} activeIndex={activeIndex} onChoose={choose} onHover={setActiveIndex} />
                  <Group label="Guests" items={flat.filter(f => f.kind === 'guest')} flat={flat} activeIndex={activeIndex} onChoose={choose} onHover={setActiveIndex} />
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Group({ label, items, flat, activeIndex, onChoose, onHover }: {
  label: string; items: Flat[]; flat: Flat[]; activeIndex: number;
  onChoose: (item: Flat) => void; onHover: (i: number) => void;
}) {
  if (!items.length) return null;
  return (
    <div className="px-1.5 py-1">
      <p className="text-micro font-semibold uppercase text-ink-faint dark:text-inkD-faint px-2.5 py-1">{label}</p>
      {items.map(item => {
        const i = flat.indexOf(item);
        return (
          <button key={item.key} onMouseEnter={() => onHover(i)} onClick={() => onChoose(item)}
            className={`w-full text-left px-2.5 py-2 rounded-sm ${i === activeIndex ? 'bg-ivory-100 dark:bg-night-200' : ''}`}>
            <p className="text-body">{item.primary}</p>
            <p className="text-meta text-ink-muted dark:text-inkD-muted truncate">{item.secondary}</p>
          </button>
        );
      })}
    </div>
  );
}