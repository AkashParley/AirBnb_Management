'use client';
import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';

export function ThemeToggle() {
  const [dark, setDark] = useState(false);
  useEffect(() => setDark(document.documentElement.classList.contains('dark')), []);

  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle('dark', next);
    try { localStorage.setItem('keeystay-theme', next ? 'dark' : 'light'); } catch {}
  };

  return (
    <button onClick={toggle} aria-label="Toggle dark mode"
      className="p-1.5 rounded-sm border border-rule dark:border-ruleD text-ink-muted dark:text-inkD-muted hover:text-ink dark:hover:text-inkD">
      {dark ? <Sun size={15} /> : <Moon size={15} />}
    </button>
  );
}
