'use client';

import { Moon, Sun } from 'lucide-react';

export default function ThemeToggle() {
  const toggle = () => {
    const root = document.documentElement;
    const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
    root.dataset.theme = next;
    try {
      localStorage.setItem('lighthouse-theme', next);
    } catch {
      // Theme switching still works when storage is unavailable.
    }
  };

  return (
    <button type="button" className="theme-toggle" onClick={toggle}>
      <span className="theme-toggle-action theme-toggle-action--to-dark">
        <Moon size={16} aria-hidden="true" />
        <span aria-hidden="true">Dark</span>
        <span className="theme-toggle-screen-reader">Switch to dark mode</span>
      </span>
      <span className="theme-toggle-action theme-toggle-action--to-light">
        <Sun size={16} aria-hidden="true" />
        <span aria-hidden="true">Light</span>
        <span className="theme-toggle-screen-reader">Switch to light mode</span>
      </span>
    </button>
  );
}
