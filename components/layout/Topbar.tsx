import { ThemeToggle } from './ThemeToggle';
import { GlobalSearch } from './GlobalSearch';

export function Topbar() {
  return (
    <header className="border-b border-rule dark:border-ruleD bg-white dark:bg-night-100 px-gutter py-3 flex items-center gap-4">
      <GlobalSearch />
      <ThemeToggle />
      <div className="text-meta text-ink-muted dark:text-inkD-muted">Caretaker</div>
    </header>
  );
}