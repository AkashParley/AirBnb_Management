'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CalendarDays, Building2, ClipboardList, BarChart3, Settings } from 'lucide-react';

/**
 * Simplified per Phase 5: Attention, Payments, Maintenance, Guests, Inventory and Photos
 * are deliberately not standalone sidebar destinations — their functionality still exists
 * exactly where it did (Stay Workspace, Property page), just not as separate top-level
 * pages. No backend/table was touched to make this true; this is a navigation-only change.
 */
const BUILT = new Set(['/calendar', '/bookings', '/properties', '/reports']);
const PRIMARY = [
  { href: '/calendar', label: 'Calendar', Icon: CalendarDays },
  { href: '/properties', label: 'Properties', Icon: Building2 },
  { href: '/bookings', label: 'Bookings', Icon: ClipboardList },
  { href: '/reports', label: 'Reports', Icon: BarChart3 },
];
const SECONDARY = [
  { href: '/settings', label: 'Settings', Icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  const Row = ({ href, label, Icon }: typeof PRIMARY[number]) => {
    const built = BUILT.has(href);
    const active = built && (pathname === href || pathname?.startsWith(href + '/'));
    const inner = (
      <span className={`flex items-center gap-2.5 px-2.5 py-2 rounded-sm text-body transition-colors ${
        active ? 'font-medium' : ''}`}>
        <Icon size={16} strokeWidth={active ? 2.1 : 1.8}
          className={!built ? 'text-ink-faint dark:text-inkD-faint' : active ? 'text-ink dark:text-inkD' : 'text-ink-muted dark:text-inkD-muted'} />
        <span className={!built ? 'text-ink-faint dark:text-inkD-faint' : active ? 'text-ink dark:text-inkD' : 'text-ink-muted dark:text-inkD-muted'}>
          {label}
        </span>
      </span>
    );
    return built ? (
      <Link key={href} href={href as import('next').Route}
        className={`block rounded-sm transition-colors ${active ? 'bg-ivory-100 dark:bg-night-200' : 'hover:bg-ivory-100/60 dark:hover:bg-night-200/60'}`}>
        {inner}
      </Link>
    ) : (
      <span key={href} aria-disabled className="block cursor-default opacity-70">{inner}</span>
    );
  };

  return (
    <aside className="hidden md:flex md:flex-col w-56 shrink-0 border-r border-rule dark:border-ruleD bg-white dark:bg-night-100 px-3 py-4 h-dvh sticky top-0">
      <div className="flex items-center gap-2 px-2 pb-4">
        <span className="text-title font-semibold tracking-tight">K</span>
        <span className="text-body font-semibold">Keeystay</span>
      </div>
      <nav className="space-y-0.5">{PRIMARY.map(Row)}</nav>
      <div className="flex-1" />
      <div className="h-px bg-rule dark:bg-ruleD my-3" />
      <nav className="space-y-0.5">{SECONDARY.map(Row)}</nav>
    </aside>
  );
}