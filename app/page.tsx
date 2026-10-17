'use client';

import * as React from 'react';
import { accounts, calculateHealthScore } from '@/app/lib/lighthouse';
import Header from './components/Header';
import PortfolioSidebar from './components/PortfolioSidebar';
import AccountDetail from './components/AccountDetail';
import AgentPanel from './components/AgentPanel';

export default function Home() {
  const sorted = [...accounts].sort((a, b) => calculateHealthScore(a) - calculateHealthScore(b));
  const [selectedId, setSelectedId] = React.useState(sorted[0].id);
  const selected = accounts.find(a => a.id === selectedId)!;

  return (
    <div className="app-canvas">
      <div className="app-shell">
        <Header accounts={accounts} />
        <div className="mobile-account-picker">
          <label htmlFor="lighthouse-mobile-account">Selected account</label>
          <select id="lighthouse-mobile-account" value={selectedId} onChange={e => setSelectedId(e.target.value)}>
            {sorted.map(acc => (
              <option key={acc.id} value={acc.id}>{acc.name}</option>
            ))}
          </select>
        </div>
        <div className="app-grid">
          <PortfolioSidebar accounts={accounts} selectedId={selectedId} onSelect={setSelectedId} />
          <div>
            <AccountDetail account={selected} />
            <AgentPanel account={selected} />
          </div>
        </div>
      </div>
      <div className="kbd-hint">
        Press <kbd>ESC</kbd> to clear analysis
      </div>
    </div>
  );
}
