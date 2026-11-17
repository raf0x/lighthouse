'use client';
import { useMemo } from 'react';
import Link from 'next/link';
import { ArrowRight, ArrowUpRight, Check, Clock3 } from 'lucide-react';
import { useWorkspace } from '../WorkspaceProvider';
import { accountHref, accountIdForCase, caseHref, caseReason, changeSummary, deadlineLabel, priorityCases, recentChanges, workspaceCases } from '../../lib/workspace';
import { decisionLabels } from '../../lib/operations';
import WorkspaceShell from './WorkspaceShell';
import TodayFollowUps from './TodayFollowUps';
import styles from './workspace.module.css';

export default function Today() {
  const { workspaces, loaded } = useWorkspace();
  const cases = useMemo(() => workspaceCases(workspaces), [workspaces]);
  const priorities = useMemo(() => priorityCases(cases), [cases]);
  const changes = useMemo(() => recentChanges(cases), [cases]);
  const blocked = cases.filter(c => c.assessment.decision !== 'ready_for_review').length;
  const review = cases.filter(c => c.assessment.decision === 'ready_for_review' && !c.planApproved).length;
  return <WorkspaceShell>
    <div className={styles.pageHeading}><div><h1>Today</h1><p>See what needs attention. Open an account. Take the next step.</p></div><Link className={styles.quietLink} href="/operations?import=1">Import a case <ArrowUpRight size={15} /></Link></div>
    {!loaded ? <p className={styles.loading} role="status">Loading your saved workspace…</p> : <>
      <div className={styles.overview} aria-label="Current case summary"><div><strong>{blocked}</strong><span>cases need attention</span></div><div><strong>{review}</strong><span>ready for plan review</span></div><div><strong>{cases.filter(c => c.planApproved).length}</strong><span>plans reviewed</span></div></div>
      <TodayFollowUps />
      <section className={styles.card} aria-labelledby="priorities-title"><div className={styles.sectionHeading}><div><h2 id="priorities-title">Cases to check</h2><p>Deadline issues first, then unresolved blockers.</p></div><Link className={styles.quietLink} href="/operations">All cases <ArrowRight size={16} /></Link></div>
        <div className={styles.priorities}>{priorities.slice(0,3).map((c,index) => <article className={styles.priorityRow} key={c.input.id}><span className={styles.rowNumber}>{String(index + 1).padStart(2,'0')}</span><div className={styles.priorityText}><div className={styles.inline}><h3>{c.input.account}</h3><span className={styles.status} data-tone={c.assessment.decision === 'ready_for_review' ? 'good' : 'attention'}>{decisionLabels[c.assessment.decision]}</span></div><p>{caseReason(c)}</p><div className={styles.meta}><span><Clock3 size={13} />{deadlineLabel(c)}</span><span>{c.assessment.owner}</span><span>{c.input.orderId}</span></div></div><Link className={index === 0 ? styles.primary : styles.secondary} href={accountHref(accountIdForCase(c.input.id))}>View account <ArrowRight size={15} /></Link></article>)}</div>
        {!priorities.length && <p className={styles.empty}><Check size={20} /> All current plans have been reviewed. Ticket release still requires a human decision.</p>}
        <p className={styles.cardNote}>Deadlines use the scenario clock in each case, not the current time.</p>
      </section>
      <section className={styles.changes} aria-labelledby="changes-title"><div className={styles.sectionHeading}><div><h2 id="changes-title">What changed</h2><p>Recent evidence updates, with the details one click away.</p></div></div>{changes.length ? <div className={styles.changeList}>{changes.slice(0,3).map(({key,input,event}) => <Link key={key} href={caseHref(input.id,'Activity')} className={styles.changeRow}><div><strong>{input.account}</strong><p>{changeSummary(event)}</p><small>At this update: {decisionLabels[event.evidence!.after.decision]} · {new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit',timeZone:'America/New_York'}).format(new Date(event.at))} ET</small></div><ArrowUpRight size={17} /></Link>)}</div> : <div className={styles.emptyChanges}><p>When you update evidence, you’ll see what changed here.</p><Link href={accountHref(accountIdForCase('OPS-101'))}>New here? Start with Portside Collectibles <ArrowRight size={15} /></Link></div>}</section>
    </>}
  </WorkspaceShell>;
}
