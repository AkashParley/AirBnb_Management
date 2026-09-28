import { CircleCheck, TriangleAlert } from 'lucide-react';
import type { StayDetail } from '@/lib/queries/operations';
import { missingQty } from '@/lib/calculations';
import { Money } from '@/components/ui/primitives';

/**
 * "One of the most important screens in KEEYSTAY" per the brief — big, obvious, mobile-first.
 * Built entirely from detail.recon (lib/calculations.reconcile), no numbers computed here.
 */
export function CheckoutSummary({ detail }: { detail: StayDetail }) {
  const { recon, inventory } = detail;
  const totalGiven = inventory.reduce((a, r) => a + (r.givenQty ?? 0), 0);
  const missingRows = inventory.filter(r => missingQty(r) > 0);
  const damagedRows = inventory.filter(r => r.condition === 'DAMAGED');

  return (
    <div className={`rounded border p-4 ${recon.clean
      ? 'border-state-ready dark:border-stateD-ready bg-state-readyBg dark:bg-stateD-readyBg'
      : 'border-state-attend dark:border-stateD-attend bg-state-attendBg dark:bg-stateD-attendBg'}`}>
      <div className="flex items-center gap-2">
        {recon.clean
          ? <CircleCheck size={20} className="text-state-ready dark:text-stateD-ready shrink-0" />
          : <TriangleAlert size={20} className="text-state-attend dark:text-stateD-attend shrink-0" />}
        <p className="text-title font-semibold">{recon.clean ? 'All items reconciled' : 'Attention required'}</p>
      </div>
      <p className="text-meta text-ink-muted dark:text-inkD-muted mt-1 tabular-nums">
        {recon.accountedFor} / {totalGiven} items returned
      </p>

      {missingRows.length > 0 && (
        <div className="mt-3">
          <p className="text-micro font-semibold uppercase text-ink-faint dark:text-inkD-faint mb-1">Missing</p>
          <ul className="text-body space-y-0.5">
            {missingRows.map(r => <li key={r.id}>{missingQty(r)} × {r.itemName}</li>)}
          </ul>
        </div>
      )}
      {damagedRows.length > 0 && (
        <div className="mt-3">
          <p className="text-micro font-semibold uppercase text-ink-faint dark:text-inkD-faint mb-1">Damaged</p>
          <ul className="text-body space-y-0.5">
            {damagedRows.map(r => <li key={r.id}>{r.itemName}{r.note && <span className="text-ink-muted dark:text-inkD-muted"> — {r.note}</span>}</li>)}
          </ul>
        </div>
      )}
      {!recon.clean && (
        <p className="text-meta text-ink-muted dark:text-inkD-muted mt-3">
          Estimated <Money value={recon.estimatedCost} /> recoverable, filed as a damage report.
        </p>
      )}
    </div>
  );
}
