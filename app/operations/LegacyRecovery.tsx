'use client';

import { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import { inspectLegacyWorkspace, type LegacyRecovery, type LegacyRecoveryStatus } from '../lib/workspace';
import styles from './operations.module.css';

const messages: Partial<Record<LegacyRecoveryStatus, string>> = {
  changed: 'Unsynchronized changes were detected in older v1 browser storage. They have NOT been merged into the current v2 workspace. Close outdated tabs and inspect or download a local backup before deciding what to recover.',
  unverified: 'An older v1 workspace exists, but this v2 record predates migration tracking. Its changes cannot be verified. Inspect or download it separately; v2 remains authoritative.',
  corrupt: 'Older v1 browser storage is unreadable or invalid. The protected v2 workspace remains authoritative. Download the exact older text before attempting recovery.',
  changing: 'An outdated tab is changing older v1 storage during inspection. Close outdated tabs and inspect again. No changes have been merged into v2.',
  unavailable: 'Older v1 storage could not be inspected safely. Do not rely on an outdated tab’s save messages; v2 remains the authority when available.',
};

export default function LegacyRecovery({ status }: { status: LegacyRecoveryStatus }) {
  const [open, setOpen] = useState(false);
  const [inspection, setInspection] = useState<LegacyRecovery | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    let active = true;
    // Reinspect when a legacy storage event or a resumed tab updates status.
    // No recovery operation ever modifies v1 or v2.
    void inspectLegacyWorkspace(localStorage)
      .then(result => { if (active) { setInspection(result); setError(''); setLoading(false); } })
      .catch(() => { if (active) { setError('Older local storage cannot be read. No backup was created.'); setLoading(false); } });
    return () => { active = false; };
  }, [open, status]);

  if (status === 'none') return null;

  async function refresh() {
    setLoading(true);
    try {
      const result = await inspectLegacyWorkspace(localStorage);
      setInspection(result);
      setError('');
    } catch {
      setError('Older local storage cannot be read. No backup was created.');
    } finally {
      setLoading(false);
    }
  }

  async function downloadBackup() {
    try {
      // Re-read at click time, instead of exporting a potentially stale preview.
      const result = await inspectLegacyWorkspace(localStorage);
      setInspection(result);
      if (result.status === 'changing') {
        setError('The legacy workspace changed while reading it. Close the older tab, then retry the download.');
        return;
      }
      if (result.raw === null) {
        setError('No older workspace contents are available to download.');
        return;
      }
      const blob = new Blob([result.raw], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = result.status === 'corrupt'
        ? 'lighthouse-legacy-v1-raw-backup.txt'
        : 'lighthouse-legacy-v1-local-backup.json';
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setError('');
    } catch {
      setError('The local backup could not be created. The older workspace was not changed.');
    }
  }

  return <section className={styles.legacyRecovery} aria-label="Older workspace recovery">
    {messages[status] && <p role="alert" className={styles.error}>{messages[status]}</p>}
    <details onToggle={event => { setOpen(event.currentTarget.open); if (event.currentTarget.open) setLoading(true); }}>
      <summary>Inspect older v1 workspace (read-only)</summary>
      {open && <div className={styles.legacyRecoveryBody}>
        <p className={styles.muted}>These are nonauthoritative records from older Lighthouse tabs. Nothing here is automatically imported, approved, or saved into v2. The backup contains the exact older localStorage text observed at download time.</p>
        <div className={styles.legacyRecoveryActions}>
          <button type="button" className={styles.secondary} onClick={() => void refresh()} disabled={loading}>Inspect current v1 data</button>
          <button type="button" className={styles.secondary} onClick={() => void downloadBackup()} disabled={loading}><Download size={15} /> Download local v1 backup</button>
        </div>
        {loading && <p role="status" className={styles.small}>Reading older local storage…</p>}
        {error && <p role="alert" className={styles.error}>{error}</p>}
        {inspection?.error && <p role="alert" className={styles.error}>{inspection.error}</p>}
        {inspection && inspection.status !== 'changing' && <>
          <p className={styles.small}>Inspection: {inspection.status}. {Object.keys(inspection.cases).length} readable legacy case records. Current v2 approvals are not affected by this inspection.</p>
          {Object.entries(inspection.cases).map(([id, workspace]) => <details key={id} className={styles.legacyCase}>
            <summary>{workspace.input.account} · {id} (older, not authoritative)</summary>
            <pre>{JSON.stringify(workspace, null, 2)}</pre>
          </details>)}
          {inspection.raw !== null && !Object.keys(inspection.cases).length && <p className={styles.small}>No readable legacy case records are available. Download the raw backup for offline inspection.</p>}
        </>}
      </div>}
    </details>
  </section>;
}
