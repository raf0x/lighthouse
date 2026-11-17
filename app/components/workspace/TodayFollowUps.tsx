'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Check } from 'lucide-react';
import { useWorkspace } from '../WorkspaceProvider';
import { useFollowUps } from '../FollowUpProvider';
import { accountHref, workspaceAccounts } from '../../lib/workspace';
import { dueInfo, openFollowUps } from '../../lib/follow-ups';
import useLocalToday from './useLocalToday';
import styles from './workspace.module.css';

export default function TodayFollowUps() {
  const { workspaces } = useWorkspace();
  const { accountWork, loaded } = useFollowUps();
  const [showAll, setShowAll] = useState(false);
  const today = useLocalToday();
  const accounts = useMemo(() => workspaceAccounts(workspaces), [workspaces]);
  const tasks = useMemo(() => openFollowUps(accountWork, accounts.map(a => a.id)), [accountWork, accounts]);
  const due = tasks.filter(t => t.followUp.dueDate <= today), upcoming = tasks.filter(t => t.followUp.dueDate > today);
  if (!loaded || !today) return null;
  function rows(items: typeof tasks) {
    return items.map(({ accountId, followUp }) => {
      const timing = dueInfo(followUp.dueDate, today);
      return <li className={styles.followUpRow} key={accountId}><div><div className={styles.inline}><strong>{accounts.find(a => a.id === accountId)!.name}</strong><span className={styles.dueBadge} data-tone={timing.tone}>{timing.label}</span></div><p>{followUp.title}</p><small>Owner: {followUp.owner}</small></div><Link className={styles.secondary} href={`${accountHref(accountId)}#follow-up`}>Open account <ArrowRight size={15} /></Link></li>;
    });
  }
  return <section className={`${styles.card} ${styles.todayFollowUps}`} aria-labelledby="today-follow-ups-title">
    <div className={styles.sectionHeading}><div><h2 id="today-follow-ups-title">Follow-ups</h2><p>{due.length ? `${due.length} due or overdue · earliest first` : 'Your next actions, in one place.'}</p></div><Link className={styles.quietLink} href="/accounts">Accounts <ArrowRight size={15} /></Link></div>
    {due.length > 0 ? <><ul className={styles.followUpList}>{rows(showAll ? due : due.slice(0,5))}</ul>{due.length > 5 && <button className={styles.quietButton} onClick={() => setShowAll(!showAll)}>{showAll ? 'Show fewer' : `Show all ${due.length} due follow-ups`}</button>}</> : <p className={styles.followUpEmpty}>{tasks.length ? <><Check size={16} /> Nothing due today.</> : <>No follow-ups yet. <Link className={styles.quietLink} href={`${accountHref('partner-OPS-101')}#follow-up`}>Add one to Portside Collectibles <ArrowRight size={14} /></Link></>}</p>}
    {upcoming.length > 0 && <details className={styles.upcomingFollowUps}><summary>Upcoming · {upcoming.length}</summary><ul className={styles.followUpList}>{rows(upcoming)}</ul></details>}
    {tasks.length > 0 && <p className={styles.cardNote}>Follow-ups use your local calendar, separate from the sample case deadlines.</p>}
  </section>;
}
