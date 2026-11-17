'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowUpRight, Search, X } from 'lucide-react';
import LighthouseBrandMark from './LighthouseBrandMark';
import ThemeToggle from './ThemeToggle';
import type { Account } from './types';
import { useWorkspace } from './WorkspaceProvider';
import { accountHref, workspaceAccounts } from '../lib/workspace';
import styles from './workspace/workspace.module.css';
import { WorkspaceAccountLink } from './workspace/CloudStatus';

export default function Header(_props: { accounts?: Account[]; operations?: boolean }) {
  const pathname = usePathname();
  const { workspaces, loaded } = useWorkspace();
  const directory = useMemo(() => workspaceAccounts(workspaces), [workspaces]);
  const [searching, setSearching] = useState(false), [query, setQuery] = useState('');
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  const results = directory.filter(a => `${a.name} ${a.id} ${a.cases.map(c => `${c.input.id} ${c.input.orderId} ${c.input.invoice.id} ${c.input.payment.reference}`).join(' ')}`.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 8);
  useEffect(() => { if (searching) { dialog.current?.showModal(); searchInput.current?.focus(); } }, [searching]);
  useEffect(() => { setSearching(false); }, [pathname]);
  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => { if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); setSearching(true); } };
    window.addEventListener('keydown', shortcut); return () => window.removeEventListener('keydown', shortcut);
  }, []);
  const close = () => { setSearching(false); requestAnimationFrame(() => trigger.current?.focus()); };
  return <>
    <header className={`app-header ${styles.header}`}>
      <Link href="/" className={styles.brand} aria-label="Lighthouse home"><LighthouseBrandMark size={40} /><span>Lighthouse</span></Link>
      <nav className={styles.nav} aria-label="Main navigation">{[['/live', 'Dashboard'], ['/today', 'Today'], ['/accounts', 'Accounts'], ['/operations', 'Operations'], ['/portfolio', 'Portfolio']].map(([href,label]) => <Link key={href} href={href} aria-current={pathname === href ? 'page' : undefined}>{label}</Link>)}</nav>
      <div className={styles.headerTools}><button ref={trigger} className={styles.searchTrigger} onClick={() => { setQuery(''); setSearching(true); }} aria-label="Search accounts and orders"><Search size={18} /><span>Search</span></button><WorkspaceAccountLink /><ThemeToggle /></div>
    </header>
    {searching && <dialog ref={dialog} className={styles.searchDialog} onCancel={event => { event.preventDefault(); close(); }} aria-labelledby="global-search-title"><div className={styles.sectionHeading}><h2 id="global-search-title">Find an account or order</h2><button className={styles.iconButton} onClick={close} aria-label="Close search"><X size={20} /></button></div><label className={styles.searchField}><Search size={18} /><input ref={searchInput} aria-label="Search accounts and orders" placeholder="Account name, order or invoice…" value={query} onChange={e => setQuery(e.target.value)} /></label><div className={styles.searchResults}>{!loaded ? <p>Loading your workspace…</p> : results.length ? results.map(a => <Link key={a.id} href={accountHref(a.id)} onClick={close}><span><strong>{a.name}</strong><small>{a.cases.map(c => c.input.orderId).join(', ') || 'Sample account signals'}</small></span><ArrowUpRight size={16} /></Link>) : <p>No matches. Try a partner name or order ID.</p>}</div></dialog>}
  </>;
}
