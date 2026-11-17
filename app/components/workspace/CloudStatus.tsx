'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useCloudWorkspace } from '../CloudWorkspaceProvider';
import styles from './workspace.module.css';
export function WorkspaceAccountLink() {
  const cloud = useCloudWorkspace();
  return cloud.enabled ? <Link className={styles.quietButton} href="/workspace">{cloud.user ? 'My workspace' : 'Sign in'}</Link> : null;
}
export function saveLabel(status: string, dirty: boolean) { return status === 'loading' ? 'Loading workspace…' : status === 'conflict' ? 'Sync needs attention' : status === 'error' ? 'Not synced' : dirty || status === 'saving' ? 'Saving…' : 'Saved to your workspace'; }
export default function CloudStatus() {
  const cloud = useCloudWorkspace(); const [error, setError] = useState('');
  if (!cloud.user) return null;
  const { state, replica } = cloud;
  const needsAttention = state.status === 'conflict' || state.status === 'error';
  function download() {
    const url = URL.createObjectURL(new Blob([JSON.stringify(state.snapshot, null, 2)], { type: 'application/json' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'lighthouse-workspace.json'; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function latest() { download(); try { await replica?.loadLatest(); setError(''); } catch { setError('The latest workspace could not load. Your changes are still here.'); } }
  return <section className={styles.cloudStatus} aria-label="Workspace sync" role={needsAttention ? 'alert' : 'status'}>
    <div><strong>{saveLabel(state.status, state.dirty)}</strong>{state.message && <p>{state.message}</p>}{state.cacheError && <p>This device could not keep a recovery copy. Keep this page open until saving finishes.</p>}{error && <p>{error}</p>}</div>
    {state.status === 'error' && <button className={styles.secondary} onClick={() => void replica?.retry()}>Retry</button>}
    {state.dirty && needsAttention && <><button className={styles.secondary} onClick={download}>Download my changes</button><button className={styles.secondary} onClick={() => void latest()}>Download & load latest</button></>}
  </section>;
}
