'use client';
import { useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { motion, useReducedMotion } from 'framer-motion';
import { X, Trash2 } from 'lucide-react';
import { format, addDays } from 'date-fns';
import {
  validateBooking, summarisePayments, nights, formatINR,
  validateTotalAgainstReceived, validatePaymentAddition, type BookingDraft,
} from '@/lib/calculations';
import { createBooking, updateBooking, cancelBooking, addPayment } from '@/app/actions/stay';
import { getBookingForEdit } from '@/app/actions/read';
import { GuestPicker } from './GuestPicker';
import { ErrorState, Skeleton } from '@/components/ui/primitives';

type Source = 'DIRECT' | 'AIRBNB' | 'OTHER';
type Method = 'CASH' | 'UPI' | 'BANK_TRANSFER' | 'OTHER';
type Intent = 'PENDING' | 'PARTIAL' | 'PAID';

interface FormState {
  propertyId: string; guestName: string; guestPhone: string;
  checkinDate: string; checkoutDate: string; guestCount: number;
  totalAmount: number; amountReceived: number; paymentMethod: Method; paymentIntent: Intent;
  source: Source; notes: string;
}

const empty = (propertyId: string, checkin: string): FormState => ({
  propertyId, guestName: '', guestPhone: '',
  checkinDate: checkin, checkoutDate: format(addDays(new Date(checkin), 1), 'yyyy-MM-dd'),
  guestCount: 2, totalAmount: 0, amountReceived: 0, paymentMethod: 'UPI', paymentIntent: 'PENDING',
  source: 'DIRECT', notes: '',
});

/**
 * One sheet, two modes. Desktop: dialog. Mobile: full-height sheet with a sticky save
 * bar. All the payment/duration/status math is imported from lib/calculations, never
 * recomputed here — this component only wires that math to inputs and the server actions.
 */
export function BookingSheet({ mode, bookingId, date, propertyId, properties, onClose, onSaved }: {
  mode: 'create' | 'edit';
  bookingId?: string;                    // required for edit
  date?: Date;                            // prefill check-in for create
  propertyId?: string;                    // prefill property for create
  properties: { id: string; name: string; capacity: number; checkin_time?: string; checkout_time?: string }[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const reduce = useReducedMotion();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [loading, setLoading] = useState(mode === 'edit');
  const [error, setError] = useState<string | null>(null);
  const [receivedSoFar, setReceivedSoFar] = useState(0);
  const [status, setStatus] = useState<string>('CONFIRMED');
  const [extraPayment, setExtraPayment] = useState({ amount: '', method: 'UPI' as Method });
  const [confirmCancel, setConfirmCancel] = useState(false);

  const [form, setForm] = useState<FormState>(() =>
    empty(propertyId ?? properties[0]?.id ?? '', date ? format(date, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd')));

  useEffect(() => {
    if (mode !== 'edit' || !bookingId) return;
    getBookingForEdit(bookingId).then(r => {
      if (!r.ok) { setError(r.error); setLoading(false); return; }
      const b = r.data;
      setForm({
        propertyId: b.propertyId, guestName: b.guestName, guestPhone: b.guestPhone ?? '',
        checkinDate: b.checkinDate, checkoutDate: b.checkoutDate, guestCount: b.guestCount,
        totalAmount: b.totalAmount, amountReceived: 0, paymentMethod: 'UPI', paymentIntent: 'PENDING',
        source: b.source, notes: b.notes ?? '',
      });
      setReceivedSoFar(b.received);
      setStatus(b.status);
      setLoading(false);
    });
  }, [mode, bookingId]);

  const capacity = properties.find(p => p.id === form.propertyId)?.capacity ?? 20;
  const draft: BookingDraft = {
    propertyId: form.propertyId, guestName: form.guestName,
    checkinDate: new Date(form.checkinDate), checkoutDate: new Date(form.checkoutDate),
    guestCount: form.guestCount, totalAmount: form.totalAmount,
    // In edit mode amountReceived is always 0 here — receivedSoFar is real, already-persisted
    // money, not a form field being typed into, so validateBooking's create-time
    // "received can't exceed total" check doesn't apply to it. The edit-specific version of that
    // rule is totalError below, computed with the same function the server uses.
    amountReceived: mode === 'create' ? form.amountReceived : 0,
  };
  const errors = useMemo(() => validateBooking(draft, capacity), [draft, capacity]);
  const totalError = mode === 'edit' ? validateTotalAgainstReceived(form.totalAmount, receivedSoFar) : null;
  const stayNights = form.checkinDate && form.checkoutDate
    ? nights(new Date(form.checkinDate), new Date(form.checkoutDate)) : 0;
  const summary = summarisePayments(form.totalAmount, [
    { amount: mode === 'create' ? form.amountReceived : receivedSoFar },
  ]);

  const locked = mode === 'edit' && status === 'CHECKED_OUT'; // dates/property frozen server-side too

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm(f => ({ ...f, [k]: v }));
  const setIntent = (intent: Intent) => setForm(f => ({
    ...f, paymentIntent: intent,
    amountReceived: intent === 'PAID' ? f.totalAmount : intent === 'PENDING' ? 0 : f.amountReceived,
  }));
  const selectedProperty = properties.find(p => p.id === form.propertyId);

  const submit = () => start(async () => {
    if (Object.keys(errors).length) { setError(Object.values(errors)[0]); return; }
    if (totalError) { setError(totalError); return; }
    const payload = {
      propertyId: form.propertyId, guestName: form.guestName.trim(), guestPhone: form.guestPhone || undefined,
      checkinDate: form.checkinDate, checkoutDate: form.checkoutDate, guestCount: form.guestCount,
      totalAmount: form.totalAmount, source: form.source, notes: form.notes || undefined,
    };
    const r = mode === 'create'
      ? await createBooking({ ...payload, amountReceived: form.amountReceived, paymentMethod: form.paymentMethod })
      : await updateBooking(bookingId!, payload);
    if (!r.ok) { setError(r.error); return; }
    router.refresh();
    onSaved();
  });

  const recordPayment = () => start(async () => {
    const amt = Number(extraPayment.amount);
    if (!(amt > 0)) { setError('Enter an amount above zero.'); return; }
    const addError = validatePaymentAddition(amt, summary.remaining);
    if (addError) { setError(addError); return; }
    const r = await addPayment(bookingId!, amt, extraPayment.method);
    if (!r.ok) { setError(r.error); return; }
    setReceivedSoFar(v => v + amt);
    setExtraPayment({ amount: '', method: 'UPI' });
    router.refresh();
  });

  const doCancel = () => start(async () => {
    const r = await cancelBooking(bookingId!);
    if (!r.ok) { setError(r.error); return; }
    router.refresh();
    onSaved();
  });

  return (
    <div role="dialog" aria-modal="true" aria-label={mode === 'create' ? 'New booking' : 'Edit booking'} className="fixed inset-0 z-50">
      <button aria-label="Close" onClick={onClose} className="absolute inset-0 bg-ink/35 dark:bg-black/60" />
      <motion.div
        initial={reduce ? false : { y: 24 }} animate={{ y: 0 }}
        transition={{ duration: 0.22, ease: [0.22, 0.61, 0.36, 1] }}
        className="absolute inset-x-0 bottom-0 max-h-[94dvh] overflow-auto bg-ivory-50 dark:bg-night-100 rounded-t-sheet shadow-sheet dark:shadow-sheetD
                   md:inset-y-0 md:right-0 md:left-auto md:w-[480px] md:max-h-none md:rounded-none md:border-l md:border-rule dark:md:border-ruleD"
      >
        <div className="sticky top-0 bg-ivory-50 dark:bg-night-100 border-b border-rule dark:border-ruleD px-gutter pt-2.5 pb-2.5 flex items-start justify-between gap-3 z-10">
          <div>
            <h2 className="text-title font-semibold">{mode === 'create' ? 'New booking' : 'Edit booking'}</h2>
            {stayNights > 0 && <p className="text-meta text-ink-muted dark:text-inkD-muted">{stayNights} night{stayNights > 1 ? 's' : ''}</p>}
          </div>
          <button onClick={onClose} aria-label="Close" className="p-1.5 -mr-1.5"><X size={18} /></button>
        </div>

        {loading ? <div className="p-gutter"><Skeleton rows={5} /></div> : (
          <div className="p-gutter space-y-4 pb-20">
            {error && <ErrorState message={error} />}

            <section className="space-y-2.5">
              <h3 className="text-micro font-semibold uppercase text-ink-faint dark:text-inkD-faint">Booking</h3>
              <div>
                <label className="block text-micro font-semibold uppercase text-ink-faint dark:text-inkD-faint mb-1">Property</label>
                <select value={form.propertyId} disabled={locked} onChange={e => set('propertyId', e.target.value)}
                  className="w-full border border-rule dark:border-ruleD rounded px-2.5 py-1.5 bg-white dark:bg-night-100 disabled:opacity-50">
                  {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <GuestPicker name={form.guestName} phone={form.guestPhone}
                onChange={(n, p) => setForm(f => ({ ...f, guestName: n, guestPhone: p }))} />
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-micro font-semibold uppercase text-ink-faint dark:text-inkD-faint mb-1">Check-in</label>
                  <input type="date" value={form.checkinDate} disabled={locked}
                    onChange={e => set('checkinDate', e.target.value)}
                    className="w-full border border-rule dark:border-ruleD rounded px-2.5 py-1.5 bg-white dark:bg-night-100 disabled:opacity-50" />
                </div>
                <div>
                  <label className="block text-micro font-semibold uppercase text-ink-faint dark:text-inkD-faint mb-1">Check-out</label>
                  <input type="date" value={form.checkoutDate} disabled={locked}
                    onChange={e => set('checkoutDate', e.target.value)}
                    aria-invalid={!!errors.checkoutDate}
                    className={`w-full border rounded px-2.5 py-1.5 bg-white dark:bg-night-100 disabled:opacity-50 ${
                      errors.checkoutDate ? 'border-state-fault dark:border-stateD-fault' : 'border-rule dark:border-ruleD'}`} />
                </div>
              </div>
              {errors.checkoutDate && (
                <p role="alert" className="text-meta text-state-fault dark:text-stateD-fault">{errors.checkoutDate}</p>
              )}
              {selectedProperty?.checkin_time && selectedProperty?.checkout_time && (
                <p className="text-meta text-ink-faint dark:text-inkD-faint">
                  This property's standard times: check-in {selectedProperty.checkin_time.slice(0, 5)},
                  checkout {selectedProperty.checkout_time.slice(0, 5)}
                </p>
              )}
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-micro font-semibold uppercase text-ink-faint dark:text-inkD-faint mb-1">Guests</label>
                  <input type="number" min={1} value={form.guestCount}
                    onChange={e => set('guestCount', Number(e.target.value))}
                    className="w-full border border-rule dark:border-ruleD rounded px-2.5 py-1.5 bg-white dark:bg-night-100" />
                </div>
                <div>
                  <label className="block text-micro font-semibold uppercase text-ink-faint dark:text-inkD-faint mb-1">Source</label>
                  <select value={form.source} onChange={e => set('source', e.target.value as Source)}
                    className="w-full border border-rule dark:border-ruleD rounded px-2.5 py-1.5 bg-white dark:bg-night-100">
                    <option value="DIRECT">Direct</option><option value="AIRBNB">Airbnb</option><option value="OTHER">Other</option>
                  </select>
                </div>
              </div>
            </section>

            <section className="space-y-2.5">
              <h3 className="text-micro font-semibold uppercase text-ink-faint dark:text-inkD-faint">Payment</h3>
              <div>
                <label className="block text-micro font-semibold uppercase text-ink-faint dark:text-inkD-faint mb-1">Total amount</label>
                <input type="number" min={0} value={form.totalAmount}
                  onChange={e => {
                    const total = Number(e.target.value);
                    setForm(f => ({ ...f, totalAmount: total, amountReceived: f.paymentIntent === 'PAID' ? total : f.amountReceived }));
                  }}
                  className="w-full border border-rule dark:border-ruleD rounded px-2.5 py-1.5 bg-white dark:bg-night-100" />
              </div>

              {mode === 'create' ? (
                <div className="space-y-3">
                  <div className="flex gap-1.5">
                    {(['PENDING', 'PARTIAL', 'PAID'] as Intent[]).map(i => (
                      <button key={i} type="button" onClick={() => setIntent(i)}
                        className={`flex-1 px-2 py-1.5 text-meta font-medium rounded-sm border capitalize ${
                          form.paymentIntent === i
                            ? 'bg-ink dark:bg-inkD text-ivory-50 dark:text-night-50 border-ink dark:border-inkD'
                            : 'border-rule dark:border-ruleD text-ink-muted dark:text-inkD-muted'}`}>
                        {i.toLowerCase()}
                      </button>
                    ))}
                  </div>
                  {form.paymentIntent !== 'PENDING' && (
                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-micro font-semibold uppercase text-ink-faint dark:text-inkD-faint mb-1">
                          {form.paymentIntent === 'PAID' ? 'Amount received' : 'Received now'}
                        </label>
                        <input type="number" min={0} value={form.amountReceived} disabled={form.paymentIntent === 'PAID'}
                          onChange={e => set('amountReceived', Number(e.target.value))}
                          className="w-full border border-rule dark:border-ruleD rounded px-2.5 py-1.5 bg-white dark:bg-night-100 disabled:opacity-60" />
                      </div>
                      <div>
                        <label className="block text-micro font-semibold uppercase text-ink-faint dark:text-inkD-faint mb-1">Method</label>
                        <select value={form.paymentMethod} onChange={e => set('paymentMethod', e.target.value as Method)}
                          className="w-full border border-rule dark:border-ruleD rounded px-2.5 py-1.5 bg-white dark:bg-night-100">
                          <option value="UPI">UPI</option><option value="CASH">Cash</option>
                          <option value="BANK_TRANSFER">Bank transfer</option><option value="OTHER">Other</option>
                        </select>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="border border-rule dark:border-ruleD rounded p-3 space-y-3">
                  <div className="space-y-1">
                    <Row label="Total amount" value={formatINR(form.totalAmount)} />
                    <Row label="Already received" value={formatINR(receivedSoFar)} muted />
                    <Row label="Remaining" value={formatINR(summary.remaining)} strong />
                  </div>
                  {totalError && (
                    <p role="alert" className="text-meta text-state-fault dark:text-stateD-fault">{totalError}</p>
                  )}
                  <div>
                    <p className="text-micro font-semibold uppercase text-ink-faint dark:text-inkD-faint mb-1.5">Add payment</p>
                    <div className="flex gap-2">
                      <input type="number" min={0} placeholder="Amount" value={extraPayment.amount}
                        onChange={e => setExtraPayment(p => ({ ...p, amount: e.target.value }))}
                        className="flex-1 border border-rule dark:border-ruleD rounded px-2.5 py-1.5 bg-white dark:bg-night-100" />
                      <select value={extraPayment.method} onChange={e => setExtraPayment(p => ({ ...p, method: e.target.value as Method }))}
                        className="border border-rule dark:border-ruleD rounded px-2 py-1.5 bg-white dark:bg-night-100">
                        <option value="UPI">UPI</option><option value="CASH">Cash</option>
                        <option value="BANK_TRANSFER">Bank transfer</option><option value="OTHER">Other</option>
                      </select>
                      <button type="button" onClick={recordPayment} disabled={pending}
                        className="px-3 rounded border border-rule dark:border-ruleD text-meta font-medium disabled:opacity-40">Add</button>
                    </div>
                    <p className="text-micro text-ink-faint dark:text-inkD-faint mt-1.5">
                      Adds a new payment record — existing payments are never rewritten.
                    </p>
                  </div>
                </div>
              )}

              {mode === 'create' && (
                <div className="flex items-center justify-between text-meta pt-1">
                  <span className="text-ink-muted dark:text-inkD-muted">Remaining</span>
                  <span className="font-semibold tabular-nums">{formatINR(summary.remaining)} · {summary.status}</span>
                </div>
              )}
            </section>

            <section>
              <h3 className="text-micro font-semibold uppercase text-ink-faint dark:text-inkD-faint mb-2">Notes</h3>
              <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={3}
                className="w-full border border-rule dark:border-ruleD rounded px-2.5 py-1.5 bg-white dark:bg-night-100 text-body" />
            </section>

            {mode === 'edit' && status !== 'CHECKED_OUT' && status !== 'CANCELLED' && (
              <section className="border-t border-rule dark:border-ruleD pt-4">
                {!confirmCancel ? (
                  <button type="button" onClick={() => setConfirmCancel(true)}
                    className="flex items-center gap-2 text-meta text-state-fault dark:text-stateD-fault font-medium">
                    <Trash2 size={14} /> Cancel this booking
                  </button>
                ) : (
                  <div className="border border-state-fault dark:border-stateD-fault rounded p-3">
                    <p className="text-meta">
                      This marks the booking CANCELLED — it stays in your records but frees these dates for
                      another guest. This can't be undone from here. Continue?
                    </p>
                    <div className="flex gap-2 mt-2">
                      <button onClick={doCancel} disabled={pending}
                        className="px-3 py-1.5 rounded bg-state-fault dark:bg-stateD-fault text-white text-meta font-medium">
                        Yes, cancel booking
                      </button>
                      <button onClick={() => setConfirmCancel(false)}
                        className="px-3 py-1.5 rounded border border-rule dark:border-ruleD text-meta">Keep it</button>
                    </div>
                  </div>
                )}
              </section>
            )}
          </div>
        )}

        {!loading && (
          <div className="sticky bottom-0 bg-ivory-50 dark:bg-night-100 border-t border-rule dark:border-ruleD p-gutter">
            <button onClick={submit} disabled={pending || !!errors.checkoutDate || !!totalError}
              title={errors.checkoutDate || totalError || undefined}
              className="w-full rounded bg-ink dark:bg-inkD text-ivory-50 dark:text-night-50 py-3 font-medium disabled:opacity-40">
              {pending ? 'Saving…' : mode === 'create' ? 'Create booking' : 'Save changes'}
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}

function Row({ label, value, muted, strong }: { label: string; value: string; muted?: boolean; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between text-meta">
      <span className="text-ink-muted dark:text-inkD-muted">{label}</span>
      <span className={`tabular-nums ${strong ? 'font-semibold' : muted ? 'text-ink-muted dark:text-inkD-muted' : ''}`}>{value}</span>
    </div>
  );
}
