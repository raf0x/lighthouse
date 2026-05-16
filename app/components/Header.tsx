'use client';

import * as React from 'react';
import { IconLogo } from './icons';
import { usePathname, useRouter } from 'next/navigation';
import type { Account } from './types';

export default function Header({ accounts }: { accounts: Account[] }) {
  const totalArr = accounts.reduce((s, a) => s + a.arr, 0);
  const pathname = usePathname();
  const router = useRouter();

  return (
    <header className="app-header">
      <div className="brand">
        <IconLogo size={56} />
        <div>
          <div className="brand-name">Lighthouse</div>
          <div className="brand-tagline">AI account intelligence — keeping watch on your portfolio</div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        {/* Navigation */}
        <nav style={{ display: 'flex', gap: 8, marginRight: 16 }}>
          <button
            onClick={() => router.push('/')}
            className={pathname === '/' ? 'btn btn--secondary' : 'btn btn--ghost'}
            style={{ fontSize: 13, padding: '8px 14px' }}
          >
            Accounts
          </button>
          <button
            onClick={() => router.push('/portfolio')}
            className={pathname === '/portfolio' ? 'btn btn--secondary' : 'btn btn--ghost'}
            style={{ fontSize: 13, padding: '8px 14px' }}
          >
            Portfolio
          </button>
        </nav>

        {/* Stats */}
        <div className="live-strip">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="live-dot" />
            <span style={{ color: 'var(--healthy-fg)', fontSize: 12, fontWeight: 600, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Live</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: 'var(--fg-3)', fontSize: 12 }}>Portfolio</span>
            <span style={{ color: 'var(--fg-1)', fontSize: 12, fontWeight: 600, fontFamily: 'var(--font-mono)' }}>{accounts.length} accounts</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: 'var(--fg-3)', fontSize: 12 }}>Total ARR</span>
            <span style={{ color: 'var(--fg-1)', fontSize: 12, fontWeight: 600, fontFamily: 'var(--font-mono)' }}>${(totalArr / 1_000_000).toFixed(2)}M</span>
          </div>
        </div>
      </div>
    </header>
  );
}
