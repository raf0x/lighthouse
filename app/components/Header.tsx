'use client';

import * as React from 'react';
import LighthouseBrandMark from './LighthouseBrandMark';
import { usePathname, useRouter } from 'next/navigation';
import type { Account } from './types';
import ThemeToggle from './ThemeToggle';

export default function Header({ accounts }: { accounts: Account[] }) {
  const totalArr = accounts.reduce((s, a) => s + a.arr, 0);
  const pathname = usePathname();
  const router = useRouter();

  return (
    <header className="app-header">
      <div className="brand">
        <LighthouseBrandMark size={56} />
        <div>
          <div className="brand-name">Lighthouse</div>
          <div className="brand-tagline">Account intelligence demo · fictional accounts · nothing sent</div>
        </div>
      </div>

      <div className="header-controls">
        {/* Navigation */}
        <nav className="primary-nav" aria-label="Main navigation">
          <button type="button" onClick={() => router.push('/live')} aria-current={pathname === '/live' ? 'page' : undefined} className="btn nav-color-btn nav-color-btn--dashboard">Dashboard</button>
          <button type="button" onClick={() => router.push('/')} aria-current={pathname === '/' ? 'page' : undefined} className="btn nav-color-btn nav-color-btn--accounts">Accounts</button>
          <button type="button" onClick={() => router.push('/portfolio')} aria-current={pathname === '/portfolio' ? 'page' : undefined} className="btn nav-color-btn nav-color-btn--portfolio">Portfolio</button>
        </nav>

        {/* Stats */}
        <div className="live-strip">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>

            <span style={{ color: 'var(--healthy-fg)', fontSize: 12, fontWeight: 600, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Demo</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: 'var(--fg-3)', fontSize: 12 }}>Portfolio</span>
            <span style={{ color: 'var(--fg-1)', fontSize: 12, fontWeight: 600, fontFamily: 'var(--font-mono)' }}>{accounts.length} accounts</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: 'var(--fg-3)', fontSize: 12 }}>Sample ARR</span>
            <span style={{ color: 'var(--fg-1)', fontSize: 12, fontWeight: 600, fontFamily: 'var(--font-mono)' }}>${(totalArr / 1_000_000).toFixed(2)}M</span>
          </div>
        </div>
        <ThemeToggle />
      </div>
    </header>
  );
}
