'use client';

import * as React from 'react';
import { useSearchParams } from 'next/navigation';
import { accounts, calculateHealthScore } from '@/app/lib/lighthouse';
import Header from './components/Header';
import PortfolioSidebar from './components/PortfolioSidebar';
import AccountDetail from './components/AccountDetail';
import AgentPanel from './components/AgentPanel';

export default function Home() {
  const searchParams = useSearchParams();
  const accountIdFromUrl = searchParams.get('account');
  
  const sorted = [...accounts].sort((a, b) => calculateHealthScore(a) - calculateHealthScore(b));
  const defaultAccount = accountIdFromUrl 
    ? accounts.find(a => a.id === accountIdFromUrl) || sorted[0]
    : sorted[0];
    
  const [selectedId, setSelectedId] = React.useState(defaultAccount.id);
  const selected = accounts.find(a => a.id === selectedId)!;

  return (
    <div className="app-canvas">
      <div className="app-shell">
        <Header accounts={accounts} />
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
