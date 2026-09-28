'use client';
import { useEffect, useMemo, useState, useTransition } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { X, Pencil, Plus, AlertTriangle, Phone } from 'lucide-react';
import { format } from 'date-fns';
import {
  setInventoryCount, setTaskState, completeCheckout, confirmCheckin, addAdhocItem, markDamage,
  loadPropertyInventory,
} from '@/app/actions/stay';
import { loadPropertyChecklist } from '@/app/actions/checklist';
import { getStayDetail } from '@/app/actions/read';
import type { StayDetail } from '@/lib/queries/operations';
import type { PropertyStatus } from '@/lib/calculations';
import { buildWhatsAppSummary } from '@/lib/summary';
import { Skeleton, ErrorState, SectionLabel, Money } from '@/components/ui/primitives';
import { BookingSheet } from '@/components/booking/BookingSheet';
import { AddItemDialog } from '@/components/inventory/AddItemDialog';
import { CheckoutSummary } from './CheckoutSummary';
import { WhatsAppButton } from './WhatsAppButton';
import { PhotoGallery } from '@/components/photos/PhotoGallery';

type Tab = 'checkin' | 'checkout';
const PAY_ICON = { PAID: '✓', PARTIAL: '◐', PENDING: '○' } as const;
const PAY_TONE = {
  PAID: 'text-state-ready dark:text-stateD-ready', PARTIAL: 'text-state-attend dark:text-stateD-attend',
  PENDING: 'text-state-fault dark:text-stateD-fault',
} as const;

/**
 * Bottom sheet on mobile, right-hand workspace on desktop. Two tabs: Check-in
 * (given quantities + confirmation) and Checkout (returned quantities + reconciliation
 * summary + photos + checklist). Client/property/payment header sits above both, since
 * that context matters regardless of which tab is open.
 */
export function StaySheet({ bookingId, properties, onClose }: {
  bookingId: string;
  properties: { id: string; name: string; status: PropertyStatus; capacity: number; checkin_time?: string; checkout_time?: string }[];
  onClose: () => void;
}) {
  const reduce = useReducedMotion();
  const [detail, setDetail] = useState<StayDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState(false);
  const [addingItem, setAddingItem] = useState(false);
  const [damaging, setDamaging] = useState<{ id: string; name: string } | null>(null);
  const [damageDesc, setDamageDesc] = useState('');
  const [manualTab, setManualTab] = useState<Tab | null>(null);

  const refresh = () => getStayDetail(bookingId)
    .then(r => (r.ok ? (setDetail(r.data!), setError(null)) : setError(r.error)))
    .catch(() => setError("Couldn't load this stay."));

  useEffect(() => { refresh(); }, [bookingId]);
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    addEventListener('keydown', esc);
    return () => removeEventListener('keydown', esc);
  }, [onClose]);

  const activeTab: Tab = manualTab ?? (detail?.checkinCompletedAt ? 'checkout' : 'checkin');

  const act = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) setError(r.error ?? 'That did not work.');
      await refresh();
    });

  const summaryText = useMemo(() => {
    if (!detail) return '';
    return buildWhatsAppSummary(activeTab === 'checkout' ? 'checkout' : 'checkin', {
      guestName: detail.guestName, propertyName: detail.propertyName,
      checkinDate: detail.checkinDate, checkoutDate: detail.checkoutDate,
      checkinTime: detail.checkinTime, checkoutTime: detail.checkoutTime,
      payment: detail.payment,
      ...(activeTab === 'checkout' ? {
        inventory: detail.inventory,
        checklistDone: detail.checklist.filter(t => t.state === 'COMPLETED').length,
        checklistTotal: detail.checklist.length || undefined,
      } : {}),
    });
  }, [detail, activeTab]);

  return (
    <div role="dialog" aria-modal="true" aria-label="Stay workspace" className="fixed inset-0 z-40">
      <button aria-label="Close" onClick={onClose} className="absolute inset-0 bg-ink/35 dark:bg-black/60" />
      <motion.div
        initial={reduce ? false : { y: 24 }} animate={{ y: 0 }}
        transition={{ duration: 0.22, ease: [0.22, 0.61, 0.36, 1] }}
        className="absolute inset-x-0 bottom-0 max-h-[92dvh] overflow-auto bg-ivory-50 dark:bg-night-100 rounded-t-sheet shadow-sheet dark:shadow-sheetD
                   md:inset-y-0 md:right-0 md:left-auto md:w-[520px] md:max-h-none md:rounded-none md:border-l md:border-rule dark:md:border-ruleD"
      >
        <div className="sticky top-0 bg-ivory-50 dark:bg-night-100 border-b border-rule dark:border-ruleD px-gutter pt-3 pb-3 z-10">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-title font-semibold">{detail?.guestName ?? 'Stay workspace'}</h2>
              {detail && <p className="text-meta text-ink-muted dark:text-inkD-muted">{detail.propertyName}</p>}
            </div>
            <button onClick={onClose} aria-label="Close workspace" className="p-1.5 -mr-1.5"><X size={18} /></button>
          </div>
          {detail && (
            <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-meta">
              {detail.guestPhone && (
                <span className="flex items-center gap-1 text-ink-muted dark:text-inkD-muted">
                  <Phone size={12} /> {detail.guestPhone}
                </span>
              )}
              <span className="text-ink-muted dark:text-inkD-muted tabular-nums">
                {format(new Date(detail.checkinDate), 'd MMM')} → {format(new Date(detail.checkoutDate), 'd MMM yyyy')}
              </span>
              <span className={`flex items-center gap-1 font-medium ${PAY_TONE[detail.payment.status]}`}>
                {PAY_ICON[detail.payment.status]} {detail.payment.status[0] + detail.payment.status.slice(1).toLowerCase()}
                <span className="tabular-nums">· <Money value={detail.payment.received} /> / <Money muted value={detail.payment.total} /></span>
              </span>
              <button onClick={() => setEditing(true)}
                className="flex items-center gap-1 text-ink-muted dark:text-inkD-muted hover:text-ink dark:hover:text-inkD">
                <Pencil size={12} /> Edit
              </button>
            </div>
          )}
        </div>

        <div role="tablist" className="flex gap-1 px-gutter border-b border-rule dark:border-ruleD mt-2">
          {(['checkin', 'checkout'] as Tab[]).map(t => (
            <button key={t} role="tab" aria-selected={activeTab === t} onClick={() => setManualTab(t)}
              className={`px-2.5 py-2 text-meta border-b-2 -mb-px capitalize ${activeTab === t ? 'border-ink dark:border-inkD font-semibold' : 'border-transparent text-ink-muted dark:text-inkD-muted'}`}>
              {t === 'checkin' ? 'Check-in' : 'Checkout'}
            </button>
          ))}
        </div>

        <div className="px-gutter py-4 space-y-5">
          {error && <ErrorState message={error} retry={refresh} />}
          {!detail && !error && <Skeleton rows={5} />}

          {detail && activeTab === 'checkin' && (
            <section aria-busy={pending} className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <SectionLabel>Items given</SectionLabel>
                  {detail.inventory.length > 0 && (
                    <button onClick={() => setAddingItem(true)}
                      className="flex items-center gap-1 text-meta font-medium text-ink-muted dark:text-inkD-muted hover:text-ink dark:hover:text-inkD">
                      <Plus size={14} /> Add item
                    </button>
                  )}
                </div>
                {!detail.inventory.length ? (
                  <div className="border border-dashed border-rule dark:border-ruleD rounded px-4 py-6 text-center">
                    <p className="text-meta text-ink-muted dark:text-inkD-muted mb-3">Nothing loaded for this stay yet.</p>
                    <button
                      onClick={() => act(async () => {
                        const r = await loadPropertyInventory(bookingId);
                        if (!r.ok) return r;
                        return loadPropertyChecklist(bookingId); // best-effort; inventory result still stands if this fails
                      })}
                      disabled={pending}
                      className="rounded bg-ink dark:bg-inkD text-ivory-50 dark:text-night-50 px-4 py-2 text-meta font-medium disabled:opacity-40">
                      Load property inventory
                    </button>
                  </div>
                ) : (
                  <ul className="border border-rule dark:border-ruleD rounded bg-white dark:bg-night-100 divide-y divide-rule-soft dark:divide-ruleD-soft">
                    {detail.inventory.map(r => (
                      <li key={r.id} className="flex items-center justify-between px-3.5 py-2.5">
                        <span>{r.itemName}</span>
                        <Stepper value={r.givenQty ?? 0} max={Math.max(r.expectedQty, r.givenQty ?? 0)}
                          onChange={v => act(() => setInventoryCount(r.id, 'given_qty', v))} />
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {detail.inventory.length > 0 && (
                detail.checkinCompletedAt ? (
                  <p className="text-meta text-ink-muted dark:text-inkD-muted">
                    Check-in confirmed. Quantities above can still be corrected if needed.
                  </p>
                ) : (
                  <button onClick={() => act(() => confirmCheckin(bookingId))} disabled={pending}
                    className="w-full rounded bg-ink dark:bg-inkD text-ivory-50 dark:text-night-50 py-3 font-medium disabled:opacity-40">
                    Confirm check-in
                  </button>
                )
              )}

              <PhotoGallery bookingId={bookingId} defaultKind="CHECKIN" />

              <div>
                <SectionLabel>Communication</SectionLabel>
                <WhatsAppButton label="Copy WhatsApp summary" text={summaryText} />
              </div>
            </section>
          )}

          {detail && activeTab === 'checkout' && (
            <section aria-busy={pending} className="space-y-4">
              <div className="flex items-center justify-between">
                <SectionLabel>Items returned</SectionLabel>
                <button onClick={() => setAddingItem(true)}
                  className="flex items-center gap-1 text-meta font-medium text-ink-muted dark:text-inkD-muted hover:text-ink dark:hover:text-inkD">
                  <Plus size={14} /> Add item
                </button>
              </div>
              <table className="w-full border border-rule dark:border-ruleD rounded bg-white dark:bg-night-100 overflow-hidden">
                <thead>
                  <tr className="text-micro uppercase text-ink-faint dark:text-inkD-faint">
                    <th className="text-left font-semibold px-2.5 py-2">Item</th>
                    <th className="font-semibold px-2.5 py-2">Given</th>
                    <th className="font-semibold px-2.5 py-2">Returned</th>
                    <th className="text-right font-semibold px-2.5 py-2">Missing</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.inventory.map(r => {
                    const missing = r.givenQty !== null && r.returnedQty !== null
                      ? Math.max(0, r.givenQty - r.returnedQty) : 0;
                    return (
                      <tr key={r.id} className={`border-t border-rule-soft dark:border-ruleD-soft ${missing || r.condition === 'DAMAGED' ? 'bg-state-faultBg/60 dark:bg-stateD-faultBg/60' : ''}`}>
                        <td className="px-2.5 py-2">
                          {r.itemName}
                          {r.condition === 'DAMAGED' && <span className="ml-1.5 text-micro text-state-fault dark:text-stateD-fault font-semibold uppercase">damaged</span>}
                        </td>
                        <td className="px-2.5 py-2 text-center tabular-nums text-ink-muted dark:text-inkD-muted">{r.givenQty ?? '—'}</td>
                        <td className="px-2.5 py-2">
                          <Stepper value={r.returnedQty ?? 0} max={r.givenQty ?? r.expectedQty}
                            onChange={v => act(() => setInventoryCount(r.id, 'returned_qty', v))} />
                        </td>
                        <td className={`px-2.5 py-2 text-right tabular-nums ${missing ? 'text-state-fault dark:text-stateD-fault font-semibold' : 'text-ink-faint dark:text-inkD-faint'}`}>
                          {missing || '—'}
                        </td>
                        <td className="pr-2">
                          <button title="Mark damaged" onClick={() => { setDamaging({ id: r.id, name: r.itemName }); setDamageDesc(''); }}
                            className="text-ink-faint dark:text-inkD-faint hover:text-state-fault dark:hover:text-stateD-fault">
                            <AlertTriangle size={14} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              <CheckoutSummary detail={detail} />

              <div>
                <SectionLabel>Checkout checklist</SectionLabel>
                {!detail.checklist.length ? (
                  <button onClick={() => act(() => loadPropertyChecklist(bookingId))} disabled={pending}
                    className="text-meta text-ink-muted dark:text-inkD-muted underline underline-offset-2">
                    Load this property's checklist
                  </button>
                ) : (
                  <>
                    <ul className="border border-rule dark:border-ruleD rounded bg-white dark:bg-night-100 divide-y divide-rule-soft dark:divide-ruleD-soft">
                      {detail.checklist.map(t => (
                        <li key={t.id}>
                          <button onClick={() => act(() => setTaskState(t.id, t.state === 'COMPLETED' ? 'PENDING' : 'COMPLETED'))}
                            className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left">
                            <span className={`size-[18px] shrink-0 grid place-items-center rounded-xs border text-white text-[11px]
                              ${t.state === 'COMPLETED' ? 'bg-state-ready dark:bg-stateD-ready border-state-ready dark:border-stateD-ready' : 'border-rule dark:border-ruleD'}`}>
                              {t.state === 'COMPLETED' ? '✓' : ''}
                            </span>
                            <span className={t.state === 'COMPLETED' ? 'text-ink-faint dark:text-inkD-faint line-through' : ''}>{t.label}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                    <p className="text-meta text-ink-faint dark:text-inkD-faint mt-1.5 tabular-nums">
                      {detail.checklist.filter(t => t.state === 'COMPLETED').length} / {detail.checklist.length} completed
                      — this doesn't block completing checkout; inventory reconciliation above is what matters.
                    </p>
                  </>
                )}
              </div>

              <PhotoGallery bookingId={bookingId} defaultKind="CHECKOUT" />

              {detail.bookingStatus !== 'CHECKED_OUT' ? (
                <button onClick={() => act(() => completeCheckout(bookingId))} disabled={pending}
                  className="w-full rounded bg-ink dark:bg-inkD text-ivory-50 dark:text-night-50 py-3 font-medium disabled:opacity-40">
                  Complete checkout
                </button>
              ) : (
                <p className="text-meta text-ink-muted dark:text-inkD-muted">Checkout completed.</p>
              )}

              <div>
                <SectionLabel>Communication</SectionLabel>
                <WhatsAppButton label="Copy checkout summary" text={summaryText} />
              </div>
            </section>
          )}
        </div>
      </motion.div>

      {editing && (
        <BookingSheet mode="edit" bookingId={bookingId} properties={properties}
          onClose={() => setEditing(false)} onSaved={() => { setEditing(false); refresh(); }} />
      )}

      {addingItem && (
        <AddItemDialog context="checkin" onClose={() => setAddingItem(false)}
          onSubmit={async input => {
            const r = await addAdhocItem(bookingId, {
              itemId: input.itemId, newItemName: input.newItemName, unit: input.unit,
              replacementCost: input.replacementCost, givenQty: input.qty, addToTemplate: input.addToTemplate,
            });
            if (!r.ok) { setError(r.error); return; }
            setAddingItem(false);
            await refresh();
          }} />
      )}

      {damaging && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 grid place-items-center px-gutter">
          <button aria-label="Close" onClick={() => setDamaging(null)} className="absolute inset-0 bg-ink/35 dark:bg-black/60" />
          <div className="relative w-full max-w-sm bg-white dark:bg-night-100 border border-rule dark:border-ruleD rounded p-5">
            <h3 className="text-title font-semibold mb-1">Mark damaged</h3>
            <p className="text-meta text-ink-muted dark:text-inkD-muted mb-3">{damaging.name}</p>
            <textarea value={damageDesc} onChange={e => setDamageDesc(e.target.value)} rows={3}
              placeholder="What's wrong with it?"
              className="w-full border border-rule dark:border-ruleD rounded px-3 py-2 bg-white dark:bg-night-100 mb-3" />
            <button
              onClick={() => act(async () => {
                const r = await markDamage(damaging.id, damageDesc);
                if (r.ok) setDamaging(null);
                return r;
              })}
              disabled={pending}
              className="w-full rounded bg-state-fault dark:bg-stateD-fault text-white py-2.5 font-medium disabled:opacity-40">
              Mark damaged
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Stepper({ value, max, onChange }: { value: number; max: number; onChange: (v: number) => void }) {
  return (
    <span className="flex items-center justify-center gap-2">
      <button aria-label="Decrease" onClick={() => onChange(Math.max(0, value - 1))}
        className="size-8 border border-rule dark:border-ruleD rounded-sm bg-white dark:bg-night-200">−</button>
      <b className="min-w-5 text-center tabular-nums font-semibold">{value}</b>
      <button aria-label="Increase" onClick={() => onChange(Math.min(max, value + 1))}
        className="size-8 border border-rule dark:border-ruleD rounded-sm bg-white dark:bg-night-200">+</button>
    </span>
  );
}
