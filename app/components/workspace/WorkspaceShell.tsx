'use client';
import Link from 'next/link';
import Header from '../Header';
import { useFollowUps } from '../FollowUpProvider';
import { FOLLOW_UP_VERSION } from '../../lib/follow-ups';
import { useWorkspace } from '../WorkspaceProvider';
import styles from './workspace.module.css';
import CloudStatus from './CloudStatus';
import { useCloudWorkspace } from '../CloudWorkspaceProvider';

export default function WorkspaceShell({ children }: { children: React.ReactNode }) {
  const { storageError } = useWorkspace();
  const cloud = useCloudWorkspace();
  const { accountWork, storageError: followUpStorageError } = useFollowUps();
  function exportFollowUps() {
    const url = URL.createObjectURL(new Blob([JSON.stringify({ version: FOLLOW_UP_VERSION, accounts: accountWork }, null, 2)], { type: 'application/json' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'lighthouse-follow-ups.json'; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <div className={`app-canvas ${styles.canvas}`}><div className={styles.shell}><Header /><main><CloudStatus />{storageError && <p role="alert" className={styles.error}>Changes are kept in this session only. Browser storage is unavailable; export your case before leaving.</p>}{followUpStorageError && <div role="alert" className={styles.error}>Follow-ups are saved in this session only. Browser storage is unavailable. <button onClick={exportFollowUps} className={styles.secondary}>Download follow-ups</button></div>}{children}</main><footer className={styles.footer}><span>{cloud.user ? 'Private workspace · no messages sent or tickets released' : 'Demo workspace · saved on this device · nothing sent or released'}</span><Link href="/demo">Guided demo ↗</Link></footer></div></div>;
}
