'use client';

import * as React from 'react';
import Link from 'next/link';
import { isCaseId } from './lib/live-stories';
import { accounts, calculateHealthScore } from '@/app/lib/lighthouse';
import Header from './components/Header';
import PortfolioSidebar from './components/PortfolioSidebar';
import AccountDetail from './components/AccountDetail';
import AgentPanel from './components/AgentPanel';

export default function Home() {
  const sorted = [...accounts].sort((a, b) => calculateHealthScore(a) - calculateHealthScore(b));
  const [selectedId, setSelectedId] = React.useState(sorted[0].id);
  React.useEffect(() => {
    const sync = () => {
      const id = new URLSearchParams(window.location.search).get('account');
      setSelectedId(accounts.some(account => account.id === id) ? id! : sorted[0].id);
    };
    sync(); window.addEventListener('popstate', sync);
    return () => window.removeEventListener('popstate', sync);
  }, []);
  function selectAccount(id: string) {
    setSelectedId(id);
    const url = new URL(window.location.href); url.searchParams.set('account', id);
    window.history.pushState({}, '', url);
  }
  const selected = accounts.find(a => a.id === selectedId)!;

  return (
    <div className="app-canvas">
      <div className="app-shell">
        <Header accounts={accounts} />
        <div className="mobile-account-picker">
          <label htmlFor="lighthouse-mobile-account">Selected account</label>
          <select id="lighthouse-mobile-account" value={selectedId} onChange={e => selectAccount(e.target.value)}>
            {sorted.map(acc => (
              <option key={acc.id} value={acc.id}>{acc.name}</option>
            ))}
          </select>
        </div>
        <div className="app-grid">
          <PortfolioSidebar accounts={accounts} selectedId={selectedId} onSelect={selectAccount} />
          <div>
            {isCaseId(selected.id) && <div className="card" style={{marginBottom:16,padding:'14px 18px',display:'flex',flexWrap:'wrap',alignItems:'center',justifyContent:'space-between',gap:12}}>
              <span>Fictional account · scripted walkthrough · no AI request</span>
              <Link href={`/live?account=${selected.id}`} style={{color:'var(--beam-300)',fontWeight:650}}>Watch {selected.name}’s story →</Link>
            </div>}
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
