'use client';

import * as React from 'react';
import { calculateHealthScore, healthBand, bandColor } from '@/app/lib/lighthouse';
import type { Account } from './types';

type Props = {
  accounts: Account[];
  selectedId: string;
  onSelect: (id: string) => void;
};

export default function PortfolioSidebar({ accounts, selectedId, onSelect }: Props) {
  const rows = accounts
    .map(a => ({ ...a, h: calculateHealthScore(a) }))
    .sort((a, b) => a.h - b.h);

  return (
    <aside className="card sidebar">
      <div className="sidebar-head">
        <div className="eyebrow">Portfolio Health</div>
        <span className="eyebrow" style={{ color: 'var(--fg-4)' }}>{rows.length}</span>
      </div>
      <div>
        {rows.map(acc => {
          const band = healthBand(acc.h);
          const sel = acc.id === selectedId;
          const color = bandColor(band);
          return (
            <button
              key={acc.id}
              className={`acc-row acc-row--${band} ${sel ? 'acc-row--selected' : ''}`}
              onClick={() => onSelect(acc.id)}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                <span className="acc-name">{acc.name}</span>
                <span style={{ 
                  width: 6, 
                  height: 6, 
                  borderRadius: 99, 
                  background: color,
                  boxShadow: band === 'critical' ? `0 0 8px ${color}` : 'none' 
                }} />
              </div>
              <div className="acc-meta">
                <span className="acc-score" style={{ color }}>{acc.h}<span style={{ color: 'var(--fg-4)' }}>/100</span></span>
                <span className="acc-arr">${(acc.arr / 1000).toFixed(0)}K ARR</span>
              </div>
            </button>
          );
        })}
      </div>
    </aside>
  );
}
