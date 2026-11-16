'use client';
import { Suspense, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowLeft, ArrowRight, ArrowUpRight, Check, Search } from 'lucide-react';
import WorkspaceShell from '../components/workspace/WorkspaceShell';
import { useWorkspace } from '../components/WorkspaceProvider';
import { accountHref, accountStatus, caseHref, changeSummary, deadlineLabel, recentChanges, workspaceAccounts } from '../lib/workspace';
import { decisionLabels, money, scenarioDate } from '../lib/operations';
import { calculateHealthScore } from '../lib/lighthouse';
import styles from '../components/workspace/workspace.module.css';

function Accounts() {
  const { workspaces, loaded } = useWorkspace();
  const directory = useMemo(() => workspaceAccounts(workspaces), [workspaces]);
  const params = useSearchParams(), requested = params.get('account');
  const selected = directory.find(a => a.id === (requested || 'partner-OPS-101'));
  const [query, setQuery] = useState('');
  const visible = directory.filter(a => `${a.name} ${a.cases.map(c => c.input.orderId).join(' ')}`.toLowerCase().includes(query.toLowerCase()));
  const latest = selected ? recentChanges(selected.cases)[0] : undefined;
  return <WorkspaceShell><div className={styles.pageHeading}><div><h1>Accounts</h1><p>Each account connects its current status, evidence and next step.</p></div></div>
    {!loaded ? <p role="status" className={styles.loading}>Loading your saved accounts…</p> : <div className={styles.accountLayout} data-detail={Boolean(requested)}>
      <aside className={styles.directory} aria-label="Account directory"><label className={styles.searchField}><Search size={17} /><input aria-label="Find an account" placeholder="Find an account…" value={query} onChange={e => setQuery(e.target.value)} /></label><div className={styles.directoryCaption}>{visible.length} accounts</div><div className={styles.directoryList}>{visible.map(a => <Link key={a.id} href={accountHref(a.id)} aria-current={selected?.id === a.id ? 'true' : undefined}><span className={styles.avatar}>{a.initials}</span><span><strong>{a.name}</strong><small>{a.kind === 'customer' ? 'Sample account signals' : accountStatus(a)}</small></span></Link>)}{!visible.length && <p className={styles.empty}>No matching accounts.</p>}</div></aside>
      <section className={styles.accountDetail} aria-label="Selected account"><Link href="/accounts" className={styles.mobileBack}><ArrowLeft size={16} /> All accounts</Link>{!selected ? <div className={styles.card}><h2>Account not available</h2><p>This account may have been removed or saved on another device.</p><Link className={styles.quietLink} href="/accounts">Choose an account <ArrowRight size={16} /></Link></div> : <>
        <div className={styles.accountHeading}><span className={styles.avatarLarge}>{selected.initials}</span><div><span className={styles.eyebrow}>{selected.customer ? 'SAMPLE ACCOUNT' : selected.cases[0]?.input.imported ? 'IMPORTED ACCOUNT' : 'SAMPLE PARTNER'}</span><h2>{selected.name}</h2></div></div>
        {selected.cases.map(c => <div key={c.input.id} className={styles.card}>
          <div className={styles.sectionHeading}><span className={styles.status} data-tone={c.assessment.decision === 'ready_for_review' ? 'good' : 'attention'}>{decisionLabels[c.assessment.decision]}</span><span className={styles.muted}>{c.input.orderId}</span></div>
          <h3 className={styles.accountConclusion}>{c.assessment.decision === 'ready_for_review' ? 'The evidence is ready. A person reviews the plan.' : `${c.assessment.findings.filter(f => f.severity === 'blocker').length} ${c.assessment.findings.filter(f => f.severity === 'blocker').length === 1 ? 'issue needs' : 'issues need'} attention.`}</h3>
          <ul className={styles.findingList}>{c.assessment.findings.map(f => <li key={f.id}><span className={styles.findingDot} data-warning={f.severity === 'attention'} /><span>{f.title}</span></li>)}</ul>
          <dl className={styles.accountFacts}><div><dt>Order value</dt><dd>{money(c.input.orderAmountCents,c.input.orderCurrency)}</dd></div><div><dt>Next owner</dt><dd>{c.assessment.owner}</dd></div><div><dt>Allocation window</dt><dd>{deadlineLabel(c)}</dd></div><div><dt>Plan review</dt><dd>{c.planApproved ? 'Approved locally' : 'Not yet approved'}</dd></div></dl>
          <div className={styles.nextAction}><div><span className={styles.eyebrow}>NEXT STEP</span><p>{c.analyzed ? c.assessment.recommendation : 'Open the case to check its evidence and prepare a plan.'}</p></div><Link className={styles.primary} href={caseHref(c.input.id)}>{c.analyzed ? 'Open case' : 'Check this case'} <ArrowRight size={16} /></Link></div>
          <p className={styles.cardNote}>Scenario clock: {scenarioDate(c.input.asOf)}. {c.input.imported ? 'Imported records are user supplied.' : 'Fictional records for this demo.'} Plan approval does not release tickets.</p>
        </div>)}
        {selected.customer && <div className={styles.card}><div className={styles.sectionHeading}><h3>Account signals</h3><span className={styles.status}>{accountStatus(selected)}</span></div><p className={styles.detailIntro}>A snapshot of usage, support and the customer relationship.</p><dl className={styles.accountFacts}><div><dt>Sample health</dt><dd>{calculateHealthScore(selected.customer)}/100</dd></div><div><dt>Sample ARR</dt><dd>{money(selected.customer.arr * 100,'USD')}</dd></div><div><dt>Executive contact</dt><dd>{selected.customer.exec}</dd></div><div><dt>Active seats</dt><dd>{selected.customer.seats_active} / {selected.customer.seats_total}</dd></div></dl><div className={styles.nextAction}><p>No operational cases are linked to this account.</p><Link className={styles.primary} href={`/insights?account=${selected.customer.id}`}>Explore signals <ArrowRight size={15} /></Link></div><p className={styles.cardNote}>Static fictional data. Health is a decision aid, not a prediction.</p></div>}
        {latest && <div className={styles.latestChange}><span className={styles.eyebrow}>LATEST EVIDENCE UPDATE</span><p>{changeSummary(latest.event)}</p><Link className={styles.quietLink} href={caseHref(latest.input.id,'Activity')}>See what changed <ArrowUpRight size={15} /></Link></div>}
        {selected.cases.some(c => c.planApproved) && <p className={styles.reviewNote}><Check size={16} /> Review is recorded against the current evidence and drafts.</p>}
      </>}</section>
    </div>}
  </WorkspaceShell>;
}
export default function Page() { return <Suspense fallback={<p>Loading accounts…</p>}><Accounts /></Suspense>; }
