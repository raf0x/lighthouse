'use client';
import Link from 'next/link';
import Header from '../Header';
import { useWorkspace } from '../WorkspaceProvider';
import styles from './workspace.module.css';

export default function WorkspaceShell({ children }: { children: React.ReactNode }) {
  const { storageError } = useWorkspace();
  return <div className={`app-canvas ${styles.canvas}`}><div className={styles.shell}><Header /><main>{storageError && <p role="alert" className={styles.error}>Changes are kept in this session only. Browser storage is unavailable; export your case before leaving.</p>}{children}</main><footer className={styles.footer}><span>Demo workspace · saved on this device · nothing sent or released</span><Link href="/demo">Guided demo ↗</Link></footer></div></div>;
}
