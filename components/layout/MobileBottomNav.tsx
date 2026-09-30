'use client';
import Link from 'next/link';
import type { Route } from 'next';
import { usePathname } from 'next/navigation';
import { PRIMARY } from './Sidebar';

// Brief-requested display order for mobile; PRIMARY itself (route/icon/label) is the
// single shared source of truth also used by the desktop Sidebar — only the order here
// is presentation-specific, nothing is redefined.
const MOBILE_ORDER = ['/bookings', '/calendar', '/properties', '/reports'];
const items = MOBILE_ORDER
  .map(href => PRIMARY.find(p => p.href === href))
  .filter((p): p is typeof PRIMARY[number] => Boolean(p));

/**
 * Fixed bottom navigation shown only below the `md` breakpoint — the same breakpoint the
 * desktop Sidebar already uses (`hidden md:flex`), so the two are never visible together
 * and never fight over the same screen space. z-30 is deliberately lower than every
 * existing sheet/dialog in the app (z-40 and up), so an open Stay Workspace, booking
 * sheet, or any dialog's full-screen backdrop naturally covers this nav rather than
 * needing special-case code to hide it.
 */
export function MobileBottomNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Primary" className="md:hidden fixed inset-x-0 bottom-0 z-30
        bg-white dark:bg-night-100 border-t border-rule dark:border-ruleD
        pb-[env(safe-area-inset-bottom)]">
      <div className="grid grid-cols-4">
        {items.map(({ href, label, Icon }) => {
          const active = pathname === href || pathname?.startsWith(href + '/');
          return (
            <Link key={href} href={href as Route} aria-label={label} aria-current={active ? 'page' : undefined}
              className="flex flex-col items-center justify-center gap-1 py-2 min-h-11">
              <Icon size={20} strokeWidth={active ? 2.2 : 1.8}
                className={active ? 'text-ink dark:text-inkD' : 'text-ink-faint dark:text-inkD-faint'} />
              <span className={`text-micro leading-none ${active
                ? 'font-semibold text-ink dark:text-inkD'
                : 'font-normal text-ink-faint dark:text-inkD-faint'}`}>
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

/**
 * The bottom padding a page's scrollable content needs so its last row never sits under
 * the fixed nav: nav content height (~52px) + the safe-area inset, only below `md`. One
 * shared class string so every page adds the exact same amount, exported rather than
 * hand-typed per file.
 */
export const MOBILE_NAV_CLEARANCE = 'pb-[calc(52px+env(safe-area-inset-bottom))] md:pb-0';