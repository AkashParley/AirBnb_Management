import { redirect } from 'next/navigation';

/**
 * Root now opens on Bookings (Phase 4.1). The Calendar's implementation lives at
 * /calendar — moved, not duplicated; this file is a plain redirect, nothing else.
 */
export default function RootRedirect() {
  redirect('/bookings');
}
