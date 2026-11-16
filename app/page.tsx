'use client';
import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import LiveDashboard from './live/page';
import dynamic from 'next/dynamic';
const LegacyAccounts = dynamic(() => import('./insights/LegacyAccounts'));
import { accounts } from './lib/lighthouse';
function Home() {
  const params = useSearchParams();
  // Keep existing account walkthrough links working.
  return accounts.some(a => a.id === params.get('account')) ? <LegacyAccounts /> : <LiveDashboard />;
}
export default function Page() { return <Suspense fallback={<p>Loading Lighthouse…</p>}><Home /></Suspense>; }
