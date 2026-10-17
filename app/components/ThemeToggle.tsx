'use client';

import * as React from 'react';
import { Moon, Sun } from 'lucide-react';

type Theme = 'light' | 'dark';

export default function ThemeToggle() {
  const [theme, setTheme] = React.useState<Theme>('light');

  React.useEffect(() => {
    const current = document.documentElement.dataset.theme;
    setTheme(current === 'dark' ? 'dark' : 'light');
  }, []);

  const toggle = () => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    setTheme(next);
    try {
      localStorage.setItem('lighthouse-theme', next);
    } catch {
      // Theme switching still works when storage is unavailable.
    }
  };

  return (
    <button
      type="button"
      className="theme-toggle"
      role="switch"
      aria-label="Dark mode"
      aria-checked={theme === 'dark'}
      title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      onClick={toggle}
    >
      {theme === 'dark' ? <Moon size={16} aria-hidden="true" /> : <Sun size={16} aria-hidden="true" />}
      <span>{theme === 'dark' ? 'Dark' : 'Light'}</span>
    </button>
  );
}
