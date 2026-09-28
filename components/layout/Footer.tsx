/**
 * Application-shell footer. Plain document flow (not fixed/sticky), so it sits at the
 * true end of a page's content rather than floating over anything or forcing extra
 * scroll space — the same reason it never causes horizontal overflow on mobile.
 */
export function Footer() {
  return (
    <footer className="py-4 text-center">
      <p className="text-micro text-ink-faint dark:text-inkD-faint tracking-wide">
        Developed by <span className="font-medium">PARLE</span> with love ❤️
      </p>
    </footer>
  );
}
