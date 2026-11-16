'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, ArrowUpRight, Check, CheckCheck, ChevronRight, CircleAlert, Clock3, Download, FileText, FolderOpen, ListChecks, PencilLine, Play, RotateCcw, Search, ShieldCheck, X } from 'lucide-react';
import Header from '../components/Header';
import AgentInvestigation from './AgentInvestigation';
import type { AgentRun } from '../lib/operations-agent';
import { accounts } from '../lib/lighthouse';
import {
  ENGINE_VERSION, SCENARIO_TIME, operationCases, assessCase, currentReview, decisionLabels,
  evidenceFor, exportCase, inputSignature, money, recordReview, restoreWorkspaces, scenarioDate, validCase,
  type AuditEntry, type CaseWorkspace, type Currency, type Drafts, type OperationCase, type PaymentState, type ReviewStatus,
} from '../lib/operations';
import styles from './operations.module.css';

const STORAGE_KEY = 'lighthouse-operations-v1';
const tabs = ['Assessment', 'Investigator', 'Source records', 'Message drafts', 'Activity'] as const;
type Tab = typeof tabs[number];
const dateTime = (at: string) => new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' }).format(new Date(at));
function activity(event: string, detail: string): AuditEntry {
  return { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, at: new Date().toISOString(), event, detail };
}

function EvidenceEditor({ input, onClose, onSave }: { input: OperationCase; onClose: () => void; onSave: (next: OperationCase) => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [error, setError] = useState('');
  useEffect(() => { ref.current?.showModal(); }, []);
  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const get = (name: string) => String(values.get(name) ?? '').trim();
    const amount = (name: string) => /^\d+(\.\d{1,2})?$/.test(get(name)) ? Math.round(Number(get(name)) * 100) : NaN;
    const hours = Number(get('deadlineHours'));
    if (!Number.isFinite(hours) || hours < -168 || hours > 720) { setError('Set a deadline between 168 hours before and 720 hours after the scenario clock.'); return; }
    const next: OperationCase = {
      ...input, approvedEntity: get('approvedEntity'), duplicateInvoiceId: get('duplicateInvoiceId'),
      deadline: new Date(Date.parse(input.asOf) + hours * 3_600_000).toISOString(),
      invoice: { ...input.invoice, entity: get('invoiceEntity'), amountCents: amount('invoiceAmount'), currency: get('invoiceCurrency') as Currency },
      payment: { status: get('paymentStatus') as PaymentState, amountCents: amount('paymentAmount'), currency: get('paymentCurrency') as Currency, reference: get('paymentReference') },
      crmPaymentStatus: get('crmStatus') as PaymentState,
    };
    if (!validCase(next)) { setError('Enter valid amounts with up to two decimal places. Invoice amount must be greater than zero.'); return; }
    onSave(next);
  }
  const statusSelect = (name: string, value: PaymentState, label: string) => <label>{label}<select name={name} defaultValue={value}><option value="missing">Missing</option><option value="pending">Pending</option><option value="cleared">Cleared</option></select></label>;
  const currencySelect = (name: string, value: Currency, label: string) => <label>{label}<select name={name} defaultValue={value}>{['USD', 'CAD', 'MXN'].map(c => <option key={c}>{c}</option>)}</select></label>;
  return <dialog ref={ref} className={styles.dialog} onCancel={onClose} aria-labelledby="evidence-editor-title">
    <form onSubmit={submit}>
      <div className={styles.dialogHeading}><div><span className={styles.eyebrow}>TRY A DIFFERENT OUTCOME</span><h2 id="evidence-editor-title">Edit the sample evidence</h2></div><button type="button" className={styles.iconButton} onClick={onClose} aria-label="Close evidence editor"><X size={20} /></button></div>
      <p className={styles.muted}>Change the facts and run the checks again. Saving clears the current assessment and review. The original scenario stays available to restore.</p>
      <fieldset><legend>Account & invoice</legend><div className={styles.formGrid}>
        <label className={styles.wide}>Approved billing entity<input name="approvedEntity" defaultValue={input.approvedEntity} maxLength={200} placeholder="Leave blank to test missing evidence" /></label>
        <label className={styles.wide}>Entity on invoice<input name="invoiceEntity" defaultValue={input.invoice.entity} maxLength={200} /></label>
        <label>Invoice amount<input name="invoiceAmount" defaultValue={(input.invoice.amountCents / 100).toFixed(2)} inputMode="decimal" required /></label>
        {currencySelect('invoiceCurrency', input.invoice.currency, 'Invoice currency')}
        <label className={styles.wide}>Other active invoice ID<input name="duplicateInvoiceId" defaultValue={input.duplicateInvoiceId} maxLength={100} placeholder="Blank means no duplicate" /></label>
      </div></fieldset>
      <fieldset><legend>Payment evidence</legend><div className={styles.formGrid}>
        {statusSelect('paymentStatus', input.payment.status, 'Finance ledger status')}{statusSelect('crmStatus', input.crmPaymentStatus, 'CRM status')}
        <label>Recorded payment amount<input name="paymentAmount" defaultValue={(input.payment.amountCents / 100).toFixed(2)} inputMode="decimal" required /></label>
        {currencySelect('paymentCurrency', input.payment.currency, 'Payment currency')}
        <label className={styles.wide}>Payment reference<input name="paymentReference" defaultValue={input.payment.reference} maxLength={100} /></label>
      </div></fieldset>
      <fieldset><legend>Allocation window</legend><label>Hours after the scenario clock<input type="number" name="deadlineHours" step="0.5" min="-168" max="720" defaultValue={(Date.parse(input.deadline) - Date.parse(input.asOf)) / 3_600_000} required /></label><p className={styles.small}>Scenario clock: {scenarioDate(input.asOf)}. Use a negative value for an elapsed deadline.</p></fieldset>
      {error && <p role="alert" className={styles.error}>{error}</p>}
      <div className={styles.dialogActions}><button type="button" className={styles.secondary} onClick={onClose}>Cancel</button><button className={styles.primary} type="submit">Save evidence <ArrowRight size={15} /></button></div>
    </form>
  </dialog>;
}

export default function OperationsWorkspace() {
  const [selectedId, setSelectedId] = useState(operationCases[0].id);
  const [workspaces, setWorkspaces] = useState<Record<string, CaseWorkspace>>({});
  const [loaded, setLoaded] = useState(false);
  const [storageError, setStorageError] = useState(false);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [tab, setTab] = useState<Tab>('Assessment');
  const [editing, setEditing] = useState(false);
  const [sourceId, setSourceId] = useState('invoice');
  const [reviewer, setReviewer] = useState('');
  const [reviewNote, setReviewNote] = useState('');
  const [reviewMode, setReviewMode] = useState<ReviewStatus | null>(null);
  const [notice, setNotice] = useState('');
  const [reviewError, setReviewError] = useState('');
  const [resetting, setResetting] = useState(false);
  const base = operationCases.find(c => c.id === selectedId) ?? operationCases[0];
  const saved = workspaces[base.id];
  const input = saved?.input ?? base;
  const assessment = useMemo(() => saved?.analyzed ? assessCase(input) : null, [saved?.analyzed, input]);
  const drafts = saved?.drafts ?? assessment?.drafts;
  const review = drafts && currentReview(input, drafts, saved?.review) ? saved?.review : undefined;
  const documents = useMemo(() => evidenceFor(input), [input]);
  const document = documents.find(d => d.id === sourceId) ?? documents[0];
  const countReviewed = Object.values(workspaces).filter(w => w.analyzed && w.drafts && w.review?.status === 'approved' && currentReview(w.input, w.drafts, w.review)).length;
  const countAnalyzed = Object.values(workspaces).filter(w => w.analyzed).length;
  const filtered = operationCases.filter(c => {
    const w = workspaces[c.id];
    const approved = w?.review?.status === 'approved' && w.drafts && currentReview(w.input, w.drafts, w.review);
    return `${c.account} ${c.scenario} ${c.id}`.toLowerCase().includes(query.toLowerCase()) && (filter === 'all' || (filter === 'reviewed' ? approved : !approved));
  });

  useEffect(() => {
    try { setWorkspaces(restoreWorkspaces(localStorage.getItem(STORAGE_KEY))); } catch { setStorageError(true); }
    const id = new URLSearchParams(window.location.search).get('case');
    if (operationCases.some(c => c.id === id)) setSelectedId(id!);
    setLoaded(true);
    const navigate = () => {
      const next = new URLSearchParams(window.location.search).get('case');
      setSelectedId(operationCases.some(c => c.id === next) ? next! : operationCases[0].id);
      setTab('Assessment'); setReviewMode(null); setEditing(false); setResetting(false); setNotice(''); setReviewError('');
    };
    window.addEventListener('popstate', navigate);
    return () => window.removeEventListener('popstate', navigate);
  }, []);
  useEffect(() => {
    if (!loaded) return;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: ENGINE_VERSION, cases: workspaces })); setStorageError(false); } catch { setStorageError(true); }
  }, [workspaces, loaded]);

  function selectCase(id: string) {
    setSelectedId(id); setTab('Assessment'); setReviewMode(null); setReviewNote(''); setReviewError(''); setNotice(''); setResetting(false);
    const url = new URL(window.location.href); url.searchParams.set('case', id); window.history.pushState({}, '', url);
  }
  function update(next: Partial<CaseWorkspace>, entry?: AuditEntry) {
    setWorkspaces(previous => {
      const current = previous[base.id] ?? { input: base, analyzed: false, history: [] };
      return { ...previous, [base.id]: { ...current, ...next, history: [...current.history, ...(entry ? [entry] : [])].slice(-100) } };
    });
  }
  function analyze() {
    const result = assessCase(input);
    update({ analyzed: true, drafts: result.drafts, draftOrigin: undefined, review: undefined }, activity('Case analyzed', `${result.findings.length} findings. ${decisionLabels[result.decision]}. Checked with ${ENGINE_VERSION}.`));
    setTab('Assessment'); setReviewMode(null); setReviewError(''); setNotice('Checks complete. Review the evidence and proposed next step.');
  }
  function applyAgentDrafts(run: AgentRun) {
    if (run.inputSignature !== inputSignature(input)) { setNotice('The evidence changed. Run a new investigation before using its drafts.'); return; }
    update({ analyzed: true, drafts: run.report.drafts, draftOrigin: { model: run.model, runId: run.runId, completedAt: run.completedAt }, review: undefined }, activity('AI drafts applied', `Drafts from ${run.model}, run ${run.runId}. Policy checks remain authoritative; human review required.`));
    setTab('Message drafts'); setReviewMode(null); setReviewError(''); setNotice('AI drafts applied. Review and edit them, then complete Harbor review. Previous approval cleared.');
  }
  function openSource(id: string) { setSourceId(id); setTab('Source records'); }
  function saveEvidence(next: OperationCase) {
    update({ input: next, analyzed: false, drafts: undefined, draftOrigin: undefined, review: undefined }, activity('Evidence updated', 'Previous assessment and review cleared. New analysis required.'));
    setEditing(false); setReviewMode(null); setReviewError(''); setTab('Assessment'); setNotice('Evidence saved. Run the checks to assess the updated case.');
  }
  function editDraft(kind: keyof Drafts, text: string) {
    if (!drafts) return;
    const entry = saved?.history[saved.history.length - 1]?.event === 'Drafts edited' ? undefined : activity('Drafts edited', 'Message text changed. Any prior review cleared.');
    update({ drafts: { ...drafts, [kind]: text }, review: undefined }, entry);
    setReviewMode(null); setNotice('Draft saved locally. Human review is required for this version.');
  }
  function submitReview(event: React.FormEvent) {
    event.preventDefault();
    if (!assessment || !drafts || !reviewMode) return;
    try {
      const recorded = recordReview(input, assessment, drafts, reviewer, reviewMode, reviewNote, new Date().toISOString());
      update({ review: recorded }, activity(reviewMode === 'approved' ? 'Plan approved locally' : 'Changes requested', `${recorded.reviewer}: ${recorded.note || 'Reviewed this evidence and these drafts.'} Nothing sent or released.`));
      setReviewMode(null); setReviewError(''); setNotice(reviewMode === 'approved' ? 'Plan approval recorded on this device. No messages sent, invoices changed, or tickets released.' : 'Revision request recorded. Update the evidence or drafts, then review again.');
    } catch (err) { setReviewError(err instanceof Error ? err.message : 'Review could not be recorded.'); }
  }
  function download() {
    if (!assessment || !drafts) return;
    const blob = new Blob([exportCase(input, assessment, drafts, review, saved?.history ?? [], saved?.draftOrigin)], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob); const a = window.document.createElement('a');
    a.href = url; a.download = `Lighthouse-${input.id}-review.md`; window.document.body.appendChild(a); a.click(); a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNotice('Review packet downloaded with the source records and current review status.');
  }
  function reset() {
    update({ input: base, analyzed: false, drafts: undefined, draftOrigin: undefined, review: undefined }, activity('Sample restored', 'Original evidence restored. Previous review cleared.'));
    setResetting(false); setReviewMode(null); setTab('Assessment'); setNotice('Original sample restored.');
  }
  return <div className={`app-canvas ${styles.canvas}`}>
    <div className={styles.frame}>
      <Header accounts={accounts} operations />
      <main>
        <section className={styles.intro}>
          <div><span className={styles.eyebrow}>PARTNER OPERATIONS</span><h1>From a blocked order<br className={styles.mobileBreak} /> to <em>a clear next step.</em></h1><p>Inspect the evidence. Resolve the exception. Keep the decision human.</p><Link href="/demo" className={styles.textButton}>Start with the saved investigation <ArrowRight size={14} /></Link></div>
          <div className={styles.mode}><span><span className={styles.modeDot} /> Interactive prototype</span><small>Synthetic cases · policy checks + AI review<br />Human approval · no external actions</small></div>
        </section>
        <div className={styles.overview} aria-label="Workspace summary"><div><FolderOpen size={17} /><strong>10</strong><span>sample cases</span></div><div><ListChecks size={17} /><strong>{countAnalyzed}</strong><span>analyzed</span></div><div><ShieldCheck size={17} /><strong>{countReviewed}</strong><span>plans approved locally</span></div><div className={styles.saveStatus}><span className={styles.statusDot} data-error={storageError} />{!loaded ? 'Loading workspace…' : storageError ? 'Session only · storage unavailable' : 'Saved on this device'}</div></div>
        {storageError && <p role="alert" className={styles.error}>Browser storage is unavailable. Your work remains in this session; download a review packet before leaving.</p>}
        <div className={styles.workspace}>
          <aside className={styles.queue} aria-label="Case queue">
            <div className={styles.queueTitle}><h2>Case queue</h2><span>{filtered.length}</span></div>
            <label className={styles.search}><Search size={15} /><span className={styles.srOnly}>Search cases</span><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Find a partner or exception" /></label>
            <div className={styles.filters} role="group" aria-label="Filter cases">{[['all', 'All'], ['open', 'To review'], ['reviewed', 'Approved']].map(([value, label]) => <button key={value} aria-pressed={filter === value} onClick={() => setFilter(value)}>{label}</button>)}</div>
            <div className={styles.caseList}>{filtered.map(c => {
              const w = workspaces[c.id]; const done = w?.review?.status === 'approved' && w.drafts && currentReview(w.input, w.drafts, w.review);
              return <button key={c.id} className={`${styles.caseItem} ${selectedId === c.id ? styles.selected : ''}`} onClick={() => selectCase(c.id)} aria-pressed={selectedId === c.id}>
                <span className={styles.avatar} style={{ '--case-color': c.color } as React.CSSProperties}>{c.initials}</span><span className={styles.caseText}><strong>{c.account}</strong><span>{c.scenario}</span><small>{c.id} <i /> {done ? 'Plan approved' : w?.review?.status === 'changes_requested' ? 'Changes requested' : w?.analyzed ? 'Awaiting review' : 'Not analyzed'}</small></span>{done ? <Check size={15} className={styles.success} /> : <ChevronRight size={15} />}
              </button>;
            })}{!filtered.length && <div className={styles.emptyQueue}><Search size={22} /><p>No cases match this view.</p><button className={styles.textButton} onClick={() => { setQuery(''); setFilter('all'); }}>Show all cases</button></div>}</div>
            <div className={styles.queueFooter}><Clock3 size={14} /><span>Fixed scenario clock<br /><strong>{scenarioDate(SCENARIO_TIME)}</strong></span></div>
          </aside>
          <section className={styles.caseWorkspace} aria-label={`${input.account} case workspace`}>
            <div className={styles.caseHeading}>
              <div><div className={styles.breadcrumb}>{input.id} <span>/</span> {input.orderId}</div><h2>{input.account}</h2><p>{input.description}</p></div>
              <button className={styles.secondary} onClick={() => setEditing(true)} disabled={!loaded}><PencilLine size={15} /> Edit evidence</button>
            </div>
            <dl className={styles.facts}><div><dt>Order value</dt><dd>{money(input.orderAmountCents, input.orderCurrency)}</dd></div><div><dt>Tickets</dt><dd>{input.tickets}</dd></div><div><dt>Allocation deadline</dt><dd>{scenarioDate(input.deadline)}</dd></div><div><dt>Owner</dt><dd>{input.owner}</dd></div></dl>
            <div className={styles.flow} aria-label="Case workflow">{['Source records', 'Policy checks', 'Proposed action', 'Harbor · human review'].map((step, i) => <div key={step} data-complete={i === 0 || Boolean(assessment && (i < 3 || review))}><span>{(i === 0 || Boolean(assessment && (i < 3 || review))) ? <Check size={12} /> : i + 1}</span><strong>{step}</strong>{i < 3 && <ChevronRight size={13} className={styles.flowArrow} />}</div>)}</div>
            <div className={styles.tabBar} role="tablist" aria-label="Case information">{tabs.map(item => <button key={item} id={`tab-${item.replaceAll(' ', '-')}`} role="tab" aria-selected={tab === item} aria-controls="case-panel" tabIndex={tab === item ? 0 : -1} onClick={() => setTab(item)} onKeyDown={e => {
              let index = tabs.indexOf(item);
              if (e.key === 'ArrowRight') index = (index + 1) % tabs.length; else if (e.key === 'ArrowLeft') index = (index + tabs.length - 1) % tabs.length; else if (e.key === 'Home') index = 0; else if (e.key === 'End') index = tabs.length - 1; else return;
              e.preventDefault(); setTab(tabs[index]); window.document.getElementById(`tab-${tabs[index].replaceAll(' ', '-')}`)?.focus();
            }}>{item}{item === 'Source records' && <span>6</span>}</button>)}</div>
            <div className={styles.notice} role="status" aria-live="polite">{notice}</div>
            <div className={styles.contentGrid}>
              <div id="case-panel" role="tabpanel" aria-labelledby={`tab-${tab.replaceAll(' ', '-')}`} className={styles.panel} tabIndex={0}>
                {tab === 'Assessment' && (!assessment ? <div className={styles.startState}>
                  <div className={styles.startIcon}><Search size={28} /></div><span className={styles.eyebrow}>EVIDENCE BEFORE ACTION</span><h3>What is holding this order back?</h3><p>Compare six source records against the release policy. Lighthouse will surface blockers, identify missing information, and prepare a plan for your review.</p>
                  <div className={styles.sourcePills}>{documents.slice(0, 4).map(doc => <button key={doc.id} onClick={() => openSource(doc.id)}><FileText size={13} />{doc.title}</button>)}</div>
                  <button className={styles.primary} onClick={analyze} disabled={!loaded}><Play size={15} /> Analyze this case</button><small>Runs locally against the supplied records. No AI API usage.</small>
                </div> : <>
                  <div className={styles.result} data-decision={assessment.decision}><span className={styles.resultTag}>{assessment.decision === 'ready_for_review' ? <ShieldCheck size={15} /> : <CircleAlert size={15} />}{decisionLabels[assessment.decision]}</span><h3>{assessment.headline}</h3><p>{assessment.summary}</p></div>
                  <div className={styles.sectionTitle}><h3>Findings & evidence</h3><span>{assessment.findings.length} {assessment.findings.length === 1 ? 'finding' : 'findings'}</span></div>
                  {assessment.findings.length ? assessment.findings.map((f, index) => <article className={styles.finding} key={f.id} data-severity={f.severity}><span className={styles.findingNumber}>{String(index + 1).padStart(2, '0')}</span><div><div className={styles.findingTitle}><h4>{f.title}</h4><span>{f.severity === 'blocker' ? 'Blocker' : 'Time-sensitive'}</span></div><p>{f.detail}</p><div className={styles.citations}>{f.sources.map(id => <button key={id} onClick={() => openSource(id)} aria-label={`View ${documents.find(d => d.id === id)?.title} source`}><FileText size={12} />{documents.find(d => d.id === id)?.title}<ArrowUpRight size={11} /></button>)}</div><div className={styles.nextStep}><strong>{f.owner}</strong><span>{f.action}</span></div></div></article>) : <div className={styles.passed}><CheckCheck size={22} /><div><strong>No blockers found in the supplied evidence.</strong><p>Human review is required. This result does not release tickets.</p></div></div>}
                  <details className={styles.checks}><summary><ListChecks size={16} /> View the {assessment.checks.length} completed checks <ChevronRight size={15} /></summary><ol>{assessment.checks.map(check => <li key={check.id}><Check size={14} /><div><strong>{check.name}</strong><p>{check.outcome}</p></div></li>)}</ol><p className={styles.small}>These are executed rules and source comparisons, not an AI reasoning transcript.</p></details>
                </>)}
                {tab === 'Investigator' && loaded && <AgentInvestigation key={inputSignature(input)} input={input} onSource={openSource} onApply={applyAgentDrafts} />}
                {tab === 'Source records' && <div><div className={styles.sectionTitle}><h3>Inspect the source</h3><span>All records are synthetic</span></div><div className={styles.sourceTabs} role="group" aria-label="Source document">{documents.map(doc => <button key={doc.id} aria-pressed={document.id === doc.id} onClick={() => setSourceId(doc.id)}><FileText size={14} />{doc.title}</button>)}</div><article className={styles.document}><div className={styles.documentHeading}><FileText size={23} /><div><span className={styles.eyebrow}>{document.source}</span><h3>{document.title}</h3></div></div><dl>{document.fields.map(field => <div key={field.label}><dt>{field.label}</dt><dd>{field.value}</dd></div>)}</dl><footer>Source reference: [{document.id}] · {input.id}</footer></article><p className={styles.small}>Editing sample evidence changes the next assessment. The policy and order totals remain fixed so results can be compared.</p></div>}
                {tab === 'Message drafts' && (drafts ? <div><div className={styles.sectionTitle}><h3>Prepare the conversation</h3><span>{saved?.draftOrigin ? 'AI-assisted drafts · review required' : 'Editable templates · nothing sent'}</span></div><p className={styles.muted}>Review and edit both drafts. Changing either clears any previous approval.{saved?.draftOrigin && ` Origin: ${saved.draftOrigin.model}. AI wording has not been fact-checked sentence by sentence.`}</p>{([['internal', 'Internal escalation'], ['client', 'Client update']] as const).map(([key, label]) => <label className={styles.draft} key={key}><span><FileText size={16} />{label}</span><textarea aria-label={label} value={drafts[key]} onChange={e => editDraft(key, e.target.value)} maxLength={20000} spellCheck /></label>)}</div> : <div className={styles.emptyPanel}><FileText size={28} /><h3>Drafts follow the evidence.</h3><p>Analyze the case to prepare the internal and client message templates.</p><button className={styles.primary} onClick={analyze} disabled={!loaded}>Analyze this case <ArrowRight size={15} /></button></div>)}
                {tab === 'Activity' && <div><div className={styles.sectionTitle}><h3>Local activity</h3><span>{saved?.history.length ?? 0} events</span></div><p className={styles.muted}>Actual actions in this browser, separate from the fixed scenario clock. This is a local demo record, not a shared or tamper-proof audit log.</p>{saved?.history.length ? <ol className={styles.history}>{[...saved.history].reverse().map(event => <li key={event.id}><span /><div><strong>{event.event}</strong><p>{event.detail}</p><time dateTime={event.at}>{dateTime(event.at)} ET</time></div></li>)}</ol> : <div className={styles.emptyPanel}><Clock3 size={26} /><h3>No actions recorded yet.</h3><p>Run an assessment to start this case’s activity history.</p></div>}</div>}
              </div>
              <aside className={styles.reviewRail} aria-label="Harbor human review">
                <div className={styles.reviewHeading}><div className={styles.harborIcon}><ShieldCheck size={22} /></div><div><span className={styles.eyebrow}>HARBOR</span><h3>Human review</h3></div><span className={styles.humanTag}>You</span></div>
                {!assessment ? <><h4>A clear handoff, ready for you.</h4><p>Run the assessment to see the recommended next step, its owner, and the messages to review.</p><div className={styles.railPlaceholder}><FileText size={18} /><span>Proposed action<br /><small>Available after analysis</small></span></div></> : <>
                  {tab === 'Investigator' ? <><span className={styles.eyebrow}>YOUR REVIEW</span><h4>Review and apply the proposed messages.</h4><p>Plan approval covers the current drafts, not ticket release.</p></> : <><span className={styles.eyebrow}>PROPOSED NEXT STEP</span><h4>{assessment.recommendation}</h4><div className={styles.owner}><span>Owner</span><strong>{assessment.owner}</strong></div><button className={styles.textButton} onClick={() => setTab('Investigator')}>Ask the case investigator <ArrowRight size={14} /></button></>}
                  <button className={styles.textButton} onClick={() => setTab('Message drafts')}>Review message drafts <ArrowRight size={14} /></button>
                  {review && <div className={styles.reviewRecorded} data-approved={review.status === 'approved'}><ShieldCheck size={18} /><div><strong>{review.status === 'approved' ? 'Plan approved locally' : 'Changes requested'}</strong><p>{review.reviewer} · {dateTime(review.at)} ET</p>{review.note && <p>{review.note}</p>}</div></div>}
                  {!reviewMode && <div className={styles.reviewActions}><button className={styles.primary} onClick={() => { setReviewMode('approved'); setReviewError(''); }} disabled={review?.status === 'approved'}><Check size={15} />{review?.status === 'approved' ? 'Approval recorded' : 'Approve plan'}</button><button className={styles.secondary} onClick={() => { setReviewMode('changes_requested'); setReviewError(''); }}>Request changes</button></div>}
                  {reviewMode && <form className={styles.reviewForm} onSubmit={submitReview}><h4>{reviewMode === 'approved' ? 'Confirm this review' : 'What needs to change?'}</h4><p>{reviewMode === 'approved' ? 'You are approving the proposed plan and current message drafts. This does not approve or execute ticket release.' : 'Record the missing detail or correction needed before this plan can be approved.'}</p><label>Reviewer name<input autoFocus value={reviewer} onChange={e => setReviewer(e.target.value)} maxLength={100} required placeholder="Your name" /></label><label>{reviewMode === 'changes_requested' ? 'Required changes' : 'Review note (optional)'}<textarea value={reviewNote} onChange={e => setReviewNote(e.target.value)} required={reviewMode === 'changes_requested'} maxLength={2000} rows={3} /></label>{reviewError && <p role="alert" className={styles.error}>{reviewError}</p>}<button className={styles.primary} type="submit">{reviewMode === 'approved' ? 'Confirm plan approval' : 'Record revision request'}</button><button className={styles.textButton} type="button" onClick={() => setReviewMode(null)}>Cancel</button></form>}
                </>}
                <div className={styles.boundary}><ShieldCheck size={14} /><p>Review is saved on this device. No message is sent, invoice changed, or ticket released.</p></div>
                {assessment && <button className={styles.download} onClick={download}><Download size={15} /> Download review packet</button>}
              </aside>
            </div>
            <footer className={styles.caseFooter}><span>{assessment ? 'Assessment follows the current source records.' : 'Six sources. One decision you can inspect.'}</span>{!resetting ? <button className={styles.textButton} onClick={() => setResetting(true)} disabled={!loaded}><RotateCcw size={13} /> Restore sample</button> : <span className={styles.resetConfirm}>Clear this case’s edits and review?<button className={styles.textButton} onClick={reset}>Restore</button><button className={styles.textButton} onClick={() => setResetting(false)}>Cancel</button></span>}</footer>
          </section>
        </div>
        <footer className={styles.pageFooter}><span>An independent Lighthouse prototype. Fictional partners, invoices, and policies.</span><Link href="/live">Explore the original walkthrough <ArrowUpRight size={13} /></Link></footer>
      </main>
    </div>
    {editing && <EvidenceEditor key={input.id} input={input} onClose={() => setEditing(false)} onSave={saveEvidence} />}
  </div>;
}
