'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowRight, ChevronRight, Download, FileText, Upload, X } from 'lucide-react';
import { assessCase, decisionLabels, evidenceChanges, inputSignature, type EvidenceAudit, type EvidenceChange, type OperationCase } from '../lib/operations';
import { caseToCsv, evidenceUpdateProblem, exampleFollowUp, IMPORT_MAX_BYTES, parseCaseCsv } from '../lib/operations-import';
import styles from './operations.module.css';

export function EvidenceChanges({ changes }: { changes: EvidenceChange[] }) {
  return <dl className={styles.evidenceChanges}>{changes.map(change => <div key={change.field}>
    <dt>{change.label}</dt><dd><span>Before</span>{change.before || <em>Not supplied</em>}</dd><dd><span>After</span>{change.after || <em>Not supplied</em>}</dd>
  </div>)}</dl>;
}

export function EvidenceHistory({ audit }: { audit: EvidenceAudit }) {
  return <details className={styles.checks}><summary><FileText size={15} /> View {audit.changes.length} field changes <ChevronRight size={14} /></summary>
    <div className={styles.evidenceOutcome}><span>Policy outcome</span><strong>{decisionLabels[audit.before.decision]} <ArrowRight size={14} /> {decisionLabels[audit.after.decision]}</strong></div>
    <div className={styles.findingComparison}><div><strong>Before findings</strong><p>{audit.before.findings.join(' · ') || 'None'}</p></div><div><strong>After findings</strong><p>{audit.after.findings.join(' · ') || 'None'}</p></div></div>
    <EvidenceChanges changes={audit.changes} />
    {audit.previousReview && <p className={styles.small}>Previous review cleared: {audit.previousReview.status === 'approved' ? 'plan approved' : 'changes requested'} by {audit.previousReview.reviewer}. The earlier review remains in the timeline.</p>}
  </details>;
}

export default function EvidenceUpdate({ input, original, onAccept, onClose }: {
  input: OperationCase; original: OperationCase; onAccept: (next: OperationCase, expectedSignature: string) => string | null; onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const attempt = useRef(0);
  const [baseline] = useState(input);
  const [candidate, setCandidate] = useState<OperationCase | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [reading, setReading] = useState(false);
  const example = exampleFollowUp(original);
  useEffect(() => {
    const dialog = ref.current, trigger = document.activeElement; dialog?.showModal();
    return () => { attempt.current++; dialog?.close(); if (trigger instanceof HTMLElement) trigger.focus(); };
  }, []);
  function parse(text: string, fileName: string) {
    const result = parseCaseCsv(text, { id: baseline.id, fileName, at: new Date().toISOString() });
    setCandidate(result.input ?? null); setErrors(result.errors ?? []);
  }
  async function chooseFile(file?: File) {
    const token = ++attempt.current; setCandidate(null); setErrors([]); setReading(false);
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.csv')) { setErrors(['Choose a .csv file with the same columns as the original import.']); return; }
    if (file.size > IMPORT_MAX_BYTES) { setErrors(['Use a CSV file no larger than 64 KB.']); return; }
    setReading(true);
    try { const text = await file.text(); if (attempt.current === token) parse(text, file.name); }
    catch { if (attempt.current === token) setErrors(['This file could not be read. Choose it again.']); }
    finally { if (attempt.current === token) setReading(false); }
  }
  function downloadCurrent() {
    const url = URL.createObjectURL(new Blob([caseToCsv(baseline)], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a'); a.href = url; a.download = `lighthouse-current-${baseline.orderId.replace(/[^A-Za-z0-9._-]/g, '-')}.csv`; a.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const problem = inputSignature(input) !== inputSignature(baseline) ? 'The case changed while this file was being reviewed. Close this window and compare the file again.' : candidate ? evidenceUpdateProblem(baseline, candidate) : null;
  const changes = candidate ? evidenceChanges(baseline, candidate) : [];
  const before = assessCase(baseline), after = candidate && !problem ? assessCase(candidate) : null;
  const canAccept = Boolean(candidate && !problem && !reading && changes.length);
  return <dialog ref={ref} className={`${styles.dialog} ${styles.importDialog}`} onCancel={onClose} aria-labelledby="evidence-update-title">
    <div className={styles.dialogHeading}><div><span className={styles.eyebrow}>{baseline.orderId} · FOLLOW-UP RECORDS</span><h2 id="evidence-update-title">Update evidence</h2></div><button className={styles.iconButton} onClick={onClose} aria-label="Close evidence update"><X size={20} /></button></div>
    <p className={styles.muted}>Compare a complete follow-up CSV with the current case. Nothing changes until you accept. The original import stays available to restore.</p>
    <div className={styles.importTools}><button className={styles.secondary} onClick={downloadCurrent}><Download size={15} /> Download current CSV</button>{example && <button className={styles.textButton} onClick={() => { attempt.current++; setReading(false); parse(example, 'seabrook-follow-up-example.csv'); }}>Try example update <ArrowRight size={14} /></button>}</div>
    {example && <p className={styles.small}>The fictional Seabrook follow-up corrects the invoice and records cleared payment, two scenario hours later.</p>}
    <label className={styles.importFile}><span><Upload size={17} /> Choose updated CSV</span><input type="file" accept=".csv,text/csv" onClick={event => { event.currentTarget.value = ''; }} onChange={event => { void chooseFile(event.target.files?.[0]); }} aria-describedby="update-file-help" /></label>
    <p id="update-file-help" className={styles.small}>Same 18 columns, one case row, up to 64 KB. Partner, order ID, total, currency and ticket quantity must match. Blank fields replace existing values with missing evidence.</p>
    {reading && <p role="status">Reading the file…</p>}
    {errors.length > 0 && <div className={styles.error} role="alert"><strong>Update not accepted</strong><ul>{errors.map((error, i) => <li key={i}>{error}</li>)}</ul><p>The existing case has not changed.</p></div>}
    {problem && <p className={styles.error} role="alert">{problem}</p>}
    {candidate && !problem && <section className={styles.importPreview} aria-labelledby="evidence-comparison-title">
      <div className={styles.sectionTitle}><h3 id="evidence-comparison-title">{changes.length ? `${changes.length} field changes to review` : 'No evidence changes'}</h3><span>{candidate.imported!.fileName} · row 2</span></div>
      {changes.length ? <><div className={styles.evidenceOutcome}><span>Policy preview</span><strong>{decisionLabels[before.decision]} <ArrowRight size={14} /> {decisionLabels[after!.decision]}</strong><p>{after!.findings.filter(f => f.severity === 'blocker').length} blockers · {after!.findings.filter(f => f.severity === 'attention').length} deadline warnings</p></div><EvidenceChanges changes={changes} />
        <details className={styles.checks}><summary><FileText size={15} /> Findings after this update <ChevronRight size={14} /></summary><ul className={styles.updateFindings}>{after!.findings.map(f => <li key={f.id}>{f.title}</li>)}</ul>{!after!.findings.length && <p className={styles.small}>No policy findings. Human release review is still required.</p>}</details>
        <p className={styles.small}>Accepting replaces the case evidence and drafts, clears any prior approval, and reruns local policy checks. This does not verify the file against external systems or release tickets.</p></> : <p className={styles.muted}>The values match the current case. Its assessment, drafts and approval will be kept.</p>}
    </section>}
    <div className={styles.dialogActions}><button className={styles.secondary} onClick={onClose}>Cancel</button><button className={styles.primary} disabled={!canAccept} onClick={() => { if (!candidate || !canAccept) return; const error = onAccept(candidate, inputSignature(baseline)); if (error) setErrors([error]); }}>Accept changes & recheck <ArrowRight size={15} /></button></div>
    <p className={styles.small}>Runs in this browser. No AI call or external action.</p>
  </dialog>;
}
