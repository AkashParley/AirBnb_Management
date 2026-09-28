import { createClient } from '@supabase/supabase-js';

/**
 * Single-user mode: no auth screen, no session. The server always acts as one
 * fixed owner using the service role key, which bypasses RLS by design here.
 * This file is imported only from server actions / server components — the
 * service role key must never reach a client bundle.
 */
const OWNER_ID = process.env.KEEYSTAY_OWNER_ID;

export async function requireUser() {
  if (!OWNER_ID) {
    throw new Error(
      'KEEYSTAY_OWNER_ID is not set. Create one user (Supabase dashboard → ' +
      'Authentication → Users → Add user) and put their UID in .env.local.',
    );
  }
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
  return { sb, user: { id: OWNER_ID } };
}

export async function supabaseServer() {
  return (await requireUser()).sb;
}
