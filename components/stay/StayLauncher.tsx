'use client';
import { useState, type ReactNode } from 'react';
import { StaySheet } from './StaySheet';

/** Holds the open-stay id so the agenda stays a pure presentational component. */
export function StayLauncher({ children }: { children: (open: (id: string) => void) => ReactNode }) {
  const [id, setId] = useState<string | null>(null);
  return (
    <>
      {children(setId)}
      {id && <StaySheet bookingId={id} onClose={() => setId(null)} />}
    </>
  );
}
