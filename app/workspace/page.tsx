'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import WorkspaceShell from '../components/workspace/WorkspaceShell';
import { useCloudWorkspace } from '../components/CloudWorkspaceProvider';
import { getSupabase } from '../lib/supabase-browser';
import styles from '../components/workspace/workspace.module.css';
export default function WorkspacePage() {
  const cloud = useCloudWorkspace();
  const [email, setEmail] = useState(''), [sent, setSent] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('');
  useEffect(() => {
    const query = new URLSearchParams(window.location.search), fragment = new URLSearchParams(window.location.hash.slice(1));
    if (query.has('error') || fragment.has('error')) setError('This sign-in link could not be used. Request a new link and open it in the same browser.');
  }, []);
  async function signIn(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const client = getSupabase(); if (!client) throw new Error('Sign-in is not configured yet.');
      const { error } = await client.auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: `${window.location.origin}/workspace` } });
      if (error) throw error;
      setSent(true);
    } catch { setError('We could not send a sign-in link. Check your email address and try again shortly.'); }
    finally { setBusy(false); }
  }
  function importDevice() { try { const result = cloud.importDevice(); setNotice(`${result.added} records added. ${result.skipped ? `${result.skipped} existing cloud records kept.` : 'Your device copy is unchanged.'}`); setError(''); } catch (e) { setError(e instanceof Error ? e.message : 'Transfer could not finish.'); } }
  return <WorkspaceShell><div className={styles.authPanel}>
    <p className={styles.eyebrow}>YOUR LIGHTHOUSE</p><h1>{cloud.user ? 'My workspace' : 'Pick up where you left off.'}</h1>
    {!cloud.enabled ? <p>Cloud saving is being set up. You can continue using the demo on this device.</p> : !cloud.authReady ? <p>Checking sign-in…</p> : cloud.user ? <>
      <p>Signed in as <strong>{cloud.user.email}</strong>. Your cases, follow-ups, notes and plan reviews belong to this account.</p>
      <Link className={styles.primary} href="/today">Open my workspace</Link>
      <details className={styles.accountActivity}><summary>Bring work from this device</summary><p className={styles.muted}>Copy this device’s saved cases and follow-ups into your private workspace. Existing cloud records are kept. Your device copy stays here.</p><button className={styles.secondary} disabled={!cloud.loaded || cloud.state.dirty || cloud.state.status !== 'ready'} onClick={importDevice}>Copy device work</button></details>
      <button className={styles.quietButton} disabled={busy} onClick={async () => { setBusy(true); const failure = await cloud.signOut(); setError(failure ?? ''); setBusy(false); }}>Sign out</button>
    </> : sent ? <div role="status"><h2>Check your email</h2><p>Open the sign-in link in this same browser to continue. It was sent to <strong>{email}</strong>.</p><button className={styles.quietButton} onClick={() => setSent(false)}>Use another email</button></div> : <>
      <p>Sign in to keep your work together on phone and desktop.</p>
      <form className={styles.followUpForm} onSubmit={signIn}><label>Email<input type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" /></label><button disabled={busy} className={styles.primary} type="submit">{busy ? 'Sending…' : 'Email me a sign-in link'}</button></form>
      <p className={styles.cardNote}>Sign-in is currently available to approved project-team email addresses. Public sign-up is not open yet.</p>
    </>}
    {error && <p role="alert" className={styles.error}>{error}</p>}{notice && <p role="status" className={styles.muted}>{notice}</p>}
    <Link className={styles.quietLink} href="/">Explore the demo →</Link>
  </div></WorkspaceShell>;
}
