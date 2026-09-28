'use client';
import { useState } from 'react';
import { MessageCircle, Check } from 'lucide-react';

/**
 * Copies text to the clipboard. Never claims success it didn't achieve — if the
 * Clipboard API is unavailable or blocked (common on http/older mobile browsers),
 * falls back to a selectable text box rather than a fake "✓ Copied".
 */
export function WhatsAppButton({ label, text }: { label: string; text: string }) {
  const [copied, setCopied] = useState(false);
  const [fallback, setFallback] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setFallback(true);
    }
  };

  return (
    <>
      <button onClick={copy}
        className="w-full flex items-center justify-center gap-2 rounded border border-rule dark:border-ruleD py-2.5 font-medium text-meta hover:bg-ivory-100 dark:hover:bg-night-200/50">
        {copied ? <><Check size={15} className="text-state-ready dark:text-stateD-ready" /> Copied</>
                : <><MessageCircle size={15} /> {label}</>}
      </button>
      {fallback && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 grid place-items-center px-gutter">
          <button aria-label="Close" onClick={() => setFallback(false)} className="absolute inset-0 bg-ink/35 dark:bg-black/60" />
          <div className="relative w-full max-w-sm bg-white dark:bg-night-100 border border-rule dark:border-ruleD rounded p-4">
            <p className="text-meta text-ink-muted dark:text-inkD-muted mb-2">
              Couldn't copy automatically — select the text below and copy it manually.
            </p>
            <textarea readOnly value={text} rows={10} onFocus={e => e.currentTarget.select()}
              className="w-full border border-rule dark:border-ruleD rounded px-3 py-2 bg-ivory-50 dark:bg-night-50 text-meta" />
            <button onClick={() => setFallback(false)} className="mt-2 w-full rounded border border-rule dark:border-ruleD py-2 text-meta">Close</button>
          </div>
        </div>
      )}
    </>
  );
}
