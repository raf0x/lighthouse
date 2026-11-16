'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowRight, ChevronRight, Download, FileText, Upload, X } from 'lucide-react';
import { evidenceFor, type CaseWorkspace, type OperationCase } from '../lib/operations';
import { CSV_TEMPLATE, IMPORT_MAX_BYTES, importProblem, parseCaseCsv } from '../lib/operations-import';
import styles from './operations.module.css';

export default function CaseImport({ workspaces, onAdd, onClose }: { workspaces: Record<string, CaseWorkspace>; onAdd: (input: OperationCase) => void; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const attempt = useRef(0);
  const [input, setInput] = useState<OperationCase | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [reading, setReading] = useState(false);
  useEffect(() => {
    const dialog = ref.current, trigger = document.activeElement; dialog?.showModal();
    return () => { attempt.current++; dialog?.close(); if (trigger instanceof HTMLElement) trigger.focus(); };
  }, []);
  function parse(text: string, fileName: string) {
    const result = parseCaseCsv(text, { id: `IMP-${crypto.randomUUID()}`, fileName, at: new Date().toISOString() });
    setInput(result.input ?? null); setErrors(result.errors ?? []);
  }
  async function chooseFile(file?: File) {
    const thisAttempt = ++attempt.current;
    setInput(null); setErrors([]); setReading(false);
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.csv')) { setErrors(['Choose a .csv file using the downloaded template. PDF and Excel workbook files are not supported yet.']); return; }
    if (file.size > IMPORT_MAX_BYTES) { setErrors(['Use a CSV file no larger than 64 KB.']); return; }
    setReading(true);
    try { const text = await file.text(); if (attempt.current === thisAttempt) parse(text, file.name); }
    catch { if (attempt.current === thisAttempt) setErrors(['This file could not be read. Choose it again.']); }
    finally { if (attempt.current === thisAttempt) setReading(false); }
  }
  function downloadTemplate() {
    const url = URL.createObjectURL(new Blob([CSV_TEMPLATE], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a'); a.href = url; a.download = 'lighthouse-case-template.csv'; a.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const problem = input ? importProblem(input, workspaces) : null;
  return <dialog ref={ref} className={`${styles.dialog} ${styles.importDialog}`} onCancel={onClose} aria-labelledby="case-import-title">
    <div className={styles.dialogHeading}><div><span className={styles.eyebrow}>YOUR SAMPLE RECORDS</span><h2 id="case-import-title">Import a case</h2></div><button type="button" className={styles.iconButton} onClick={onClose} aria-label="Close case import"><X size={20} /></button></div>
    <p className={styles.muted}>Use fictional or anonymized records. The CSV is read in this browser and checked against Lighthouse’s fixed demo policy. Nothing is sent to AI when you import.</p>
    <div className={styles.importSteps}><span><b>1</b> Choose CSV</span><span><b>2</b> Review fields</span><span><b>3</b> Add to queue</span></div>
    <div className={styles.importTools}><button className={styles.secondary} onClick={downloadTemplate}><Download size={15} /> Download CSV template</button><button className={styles.textButton} onClick={() => { attempt.current++; setReading(false); parse(CSV_TEMPLATE, 'lighthouse-case-template.csv'); }}>Try the example file <ArrowRight size={14} /></button></div>
    <label className={styles.importFile}><span><Upload size={17} /> Choose case CSV</span><input type="file" accept=".csv,text/csv" onChange={event => { void chooseFile(event.target.files?.[0]); event.target.value = ''; }} aria-describedby="import-file-help" /></label>
    <p id="import-file-help" className={styles.small}>One header row + one case row · up to 64 KB. Keep the template column names. Amounts use decimals (12500.00); dates include a time zone.</p>
    <details className={styles.checks}><summary>CSV format and missing evidence</summary><p className={styles.small}>One row supplies the account, order, invoice, Finance ledger and CRM fields. These are five views of your file, not five independently verified systems. The sixth record is Lighthouse’s fixed policy.</p><p className={styles.small}>Use USD, CAD or MXN. Payment and CRM status must be missing, pending or cleared. For missing payment evidence, enter missing and an amount of 0. Blank approved entities, invoice entities and payment references remain missing; they are never filled in automatically. Leave other_active_invoice_id blank when there is no duplicate. Dates must fall within 2000–2100; the deadline must be within 7 days before to 30 days after the scenario clock.</p></details>
    {reading && <p role="status" className={styles.muted}>Reading the file…</p>}
    {errors.length > 0 && <div className={styles.error} role="alert"><strong>The file needs a correction</strong><ul>{errors.map((error, index) => <li key={index}>{error}</li>)}</ul><p>Nothing was added. Update the file and choose it again.</p></div>}
    {input && <section className={styles.importPreview} aria-labelledby="import-review-title"><div className={styles.sectionTitle}><h3 id="import-review-title">Review imported records</h3><span>{input.imported!.fileName} · row 2</span></div><p className={styles.muted}>{input.account} · {input.orderId}. Review the mapped fields below before adding this case. No assessment or approval has been created.</p>
      {evidenceFor(input).map(doc => <details key={doc.id} className={styles.checks} open={doc.id === 'account' || doc.id === 'order'}><summary><FileText size={15} /><span>{doc.title}</span><ChevronRight size={14} /></summary><dl className={styles.importFields}>{doc.fields.map(field => <div key={field.label}><dt>{field.label}</dt><dd>{field.value}</dd></div>)}</dl></details>)}
    </section>}
    {problem && <p role="alert" className={styles.error}>{problem}</p>}
    <p className={styles.small}>Added cases and edits are saved on this browser. A live investigation, when available, separately sends the case fields to Anthropic.</p>
    <div className={styles.dialogActions}><button className={styles.secondary} onClick={onClose}>Cancel</button><button className={styles.primary} disabled={!input || Boolean(problem) || reading} onClick={() => { if (input && !problem) onAdd(input); }}>Add case to queue <ArrowRight size={15} /></button></div>
  </dialog>;
}
