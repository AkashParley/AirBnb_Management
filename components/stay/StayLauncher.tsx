'use client';
import { useState, type ComponentProps, type ReactNode } from 'react';
import { StaySheet } from './StaySheet';

/**
 * Holds the open-stay id so the agenda stays a pure presentational component. StaySheet
 * requires the property list (for its embedded booking editor), so it is a required prop
 * here too — typed from StaySheet itself so the two can never drift apart.
 */
export function StayLauncher({ properties, children }: {
  properties: ComponentProps<typeof StaySheet>['properties'];
  children: (open: (id: string) => void) => ReactNode;
}) {
  const [id, setId] = useState<string | null>(null);
  return (
    <>
      {children(setId)}
      {id && <StaySheet bookingId={id} properties={properties} onClose={() => setId(null)} />}
    </>
  );
}