'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import WorkspaceShell from '../components/workspace/WorkspaceShell';
import { useWorkspace } from '../components/WorkspaceProvider';
import { accountHref, accountIdForCase, caseReason, deadlineLabel, portfolioTotals, workspaceCases } from '../lib/workspace';
import { decisionLabels, money } from '../lib/operations';
import styles from '../components/workspace/workspace.module.css';

export default function Portfolio() {
  const { workspaces, loaded } = useWorkspace();
  const cases = useMemo(() => workspaceCases(workspaces), [workspaces]);
  const [filter,setFilter] = useState('all');
  const totals = portfolioTotals(cases);
  const shown = cases.filter(c => filter === 'all' || (filter === 'attention' ? c.assessment.decision !== 'ready_for_review' : c.assessment.decision === 'ready_for_review'));
  return <WorkspaceShell><div className={styles.pageHeading}><div><h1>Portfolio</h1><p>Current partner orders, all using the same evidence as Operations.</p></div><Link href="/insights/portfolio" className={styles.quietLink}>Sample account signals <ArrowUpRight size={15} /></Link></div>
    {!loaded ? <p className={styles.loading} role="status">Loading your portfolio…</p> : <>
      <div className={styles.overview}><div><strong>{cases.length}</strong><span>partner orders</span></div><div><strong>{cases.filter(c => c.assessment.decision !== 'ready_for_review').length}</strong><span>need attention</span></div><div><strong>{cases.filter(c => c.assessment.decision === 'ready_for_review').length}</strong><span>ready for human review</span></div></div>
      <div className={styles.valueSummary}>{totals.map(t => <div key={t.currency}><span>Order value needing attention</span><strong>{money(t.blocked,t.currency)}</strong><small>of {money(t.total,t.currency)} in {t.currency} orders</small></div>)}</div>
      <section className={styles.card}><div className={styles.sectionHeading}><h2>Partner orders</h2><div className={styles.filters} aria-label="Filter portfolio">{[['all','All'],['attention','Needs attention'],['ready','Ready for review']].map(([value,label]) => <button key={value} aria-pressed={filter===value} onClick={() => setFilter(value)}>{label}</button>)}</div></div>
      <div className={styles.portfolioRows}>{shown.map(c => <Link key={c.input.id} href={accountHref(accountIdForCase(c.input.id))} className={styles.portfolioRow}><div><strong>{c.input.account}</strong><small>{caseReason(c)}</small></div><span className={styles.status} data-tone={c.assessment.decision === 'ready_for_review' ? 'good' : 'attention'}>{decisionLabels[c.assessment.decision]}</span><span className={styles.orderValue}>{money(c.input.orderAmountCents,c.input.orderCurrency)}<small>{deadlineLabel(c)}</small></span><ArrowUpRight size={16} /></Link>)}</div>{!shown.length && <p className={styles.empty}>No orders in this view.</p>}<p className={styles.cardNote}>Order values are not lost revenue or savings. Currencies stay separate. Deadlines use each case’s scenario clock. Approval of a plan does not clear its blockers.</p></section>
    </>}
  </WorkspaceShell>;
}
