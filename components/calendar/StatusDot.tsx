import { Clock, CircleDot, CircleCheck } from 'lucide-react';

/**
 * Booking-status indicator distinct from the property color already carried by the bar —
 * never color alone. CANCELLED never reaches the UI: lib/queries/operations excludes it
 * at the query level, so there is nothing here to render for that state.
 */
export function StatusDot({ status }: { status: string }) {
  if (status === 'IN_STAY') return <CircleDot size={11} className="shrink-0 opacity-80" strokeWidth={2.4} />;
  if (status === 'CHECKED_OUT') return <CircleCheck size={11} className="shrink-0 opacity-70" strokeWidth={2.2} />;
  return <Clock size={11} className="shrink-0 opacity-60" strokeWidth={2} />; // CONFIRMED / upcoming
}
