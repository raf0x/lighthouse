'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, ArrowUpRight, Check, ChevronRight, FileText, RotateCcw, ShieldCheck, X } from 'lucide-react';
import Header from '../components/Header';
import { accounts } from '../lib/lighthouse';
import { assessCase, evidenceFor, money, scenarioDate, type EvidenceDocument } from '../lib/operations';
import { demoCase, demoStages, type DemoStage } from '../lib/operations-demo';
import type { AgentRun } from '../lib/operations-agent';
import styles from './demo.module.css';

const tabs = ['Saved investigation', 'Resolve the case', 'How it works'] as const;
type View = typeof tabs[number];

function SourceDialog({ document, onClose }: { document: EvidenceDocument; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current, trigger = window.document.activeElement;
    dialog?.showModal();
    return () => { dialog?.close(); if (trigger instanceof HTMLElement) trigger.focus(); };
  }, []);
  return <dialog ref={ref} className={styles.dialog} onCancel={onClose} aria-labelledby="demo-source-title">
    <div className={styles.dialogHeading}><div><span className={styles.eyebrow}>ORIGINAL SAMPLE RECORD</span><h2 id="demo-source-title">{document.title}</h2></div><button onClick={onClose} className={styles.iconButton} aria-label="Close source record"><X size={20} /></button></div>
    <p className={styles.note}>{document.source}</p><dl className={styles.fields}>{document.fields.map(field => <div key={field.label}><dt>{field.label}</dt><dd>{field.value}</dd></div>)}</dl>
    <button className={styles.secondary} onClick={onClose}>Close record</button>
  </dialog>;
}

export default function DemoExperience({ recording }: { recording: AgentRun }) {
  const [view, setView] = useState<View>('Saved investigation');
  const [stage, setStage] = useState<DemoStage>('blocked');
  const [sourceId, setSourceId] = useState<string | null>(null);
  const original = demoCase('blocked');
  const documents = evidenceFor(original);
  const document = documents.find(d => d.id === sourceId);
  const originalAssessment = assessCase(original);
  const current = demoCase(stage);
  const assessment = assessCase(current);
  const blockers = assessment.findings.filter(f => f.severity === 'blocker');
  const stageIndex = demoStages.indexOf(stage);
  const report = recording.report;
  function chooseView(next: View) { setView(next); }
  function download() {
    const data = { ...recording, sourceRecords: documents, presentation: 'Saved real Claude run on fictional records. Viewing or resolving the demo makes no model calls.', humanReviewRequired: true };
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    const link = window.document.createElement('a'); link.href = url; link.download = 'Lighthouse-saved-investigation-OPS-101.json'; link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <div className={`app-canvas ${styles.canvas}`}><div className={styles.frame}>
    <Header accounts={accounts} operations />
    <main>
      <section className={styles.hero}>
        <div><span className={styles.eyebrow}>AN AI OPERATIONS CASE STUDY</span><h1>Two blockers.<br /><em>One clear next step.</em></h1><p>Inspect a real AI investigation of a fictional ticket order. Follow the evidence, then try resolving the case yourself.</p></div>
        <aside className={styles.caseCard} aria-label="Example case"><span className={styles.eyebrow}>PORTSIDE COLLECTIBLES · {original.orderId}</span><strong>{money(original.orderAmountCents, original.orderCurrency)}</strong><p>{original.tickets} tickets held for an invoice mismatch and pending payment.</p><span className={styles.caseFoot}><ShieldCheck size={15} /> Human review before release</span></aside>
      </section>
      <div className={styles.context}><span><span className={styles.dot} /> Saved Claude run</span><span>Fictional records</span><span>Explore without AI credits</span></div>
      <section className={styles.experience} aria-label="Lighthouse case study">
        <div className={styles.tabs} role="tablist" aria-label="Explore the case study">{tabs.map((name, index) => <button key={name} id={`demo-tab-${index}`} role="tab" aria-selected={view === name} aria-controls="demo-panel" tabIndex={view === name ? 0 : -1} onClick={() => chooseView(name)} onKeyDown={event => {
          const next = event.key === 'ArrowRight' ? (index + 1) % tabs.length : event.key === 'ArrowLeft' ? (index + tabs.length - 1) % tabs.length : event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : null;
          if (next === null) return; event.preventDefault(); chooseView(tabs[next]); window.document.getElementById(`demo-tab-${next}`)?.focus();
        }}><span>0{index + 1}</span>{name}</button>)}</div>
        <div id="demo-panel" role="tabpanel" aria-labelledby={`demo-tab-${tabs.indexOf(view)}`} tabIndex={0} className={styles.panel}>
          {view === 'Saved investigation' && <>
            <div className={styles.sectionHeading}><div><span className={styles.eyebrow}>RECORDED RESULT · CLAUDE SONNET 4.6</span><h2>What is holding the order back?</h2></div><span className={styles.savedBadge}>Saved example</span></div>
            <p className={styles.note}>This is the original model output, saved on {scenarioDate(recording.completedAt)} ({new Date(recording.completedAt).getUTCFullYear()}). Viewing it does not start a new investigation.</p>
            <div className={styles.result}><span className={styles.status}>Action needed</span><h3>2 blockers <span>· 1 deadline warning</span></h3><p>{report.summary}</p></div>
            <div className={styles.nextStep}><span className={styles.eyebrow}>NEXT STEP · {report.owner}</span><p>{report.recommendation}</p></div>
            <div className={styles.messages}><h3>Proposed messages</h3><p className={styles.note}>Original drafts for human review. Nothing has been sent.</p>{(['internal', 'client'] as const).map(kind => <details key={kind} className={styles.disclosure}><summary><FileText size={16} />{kind === 'internal' ? 'Internal escalation' : 'Client update'}<ChevronRight size={17} /></summary><p className={styles.draftText}>{report.drafts[kind]}</p></details>)}</div>
            <details className={styles.disclosure}><summary><ShieldCheck size={16} /> Evidence & checks · {report.citations.length} citations<ChevronRight size={17} /></summary>
              <p className={styles.note}>Decision and finding categories match the policy; quotations match the records. These checks do not verify every sentence.</p>
              {report.findings.map(finding => <article key={finding.id} className={styles.finding}><h4>{originalAssessment.findings.find(f => f.id === finding.id)?.title}</h4><p>{finding.explanation}</p><div className={styles.sources}>{finding.sourceIds.map(id => <button key={id} onClick={() => setSourceId(id)}><FileText size={13} />{documents.find(d => d.id === id)?.title}</button>)}</div></article>)}
              <details className={styles.disclosure}><summary>Exact quotations<ChevronRight size={17} /></summary><dl className={styles.fields}>{report.citations.map((quote, index) => <div key={index}><dt><button className={styles.sourceLink} onClick={() => setSourceId(quote.sourceId)}>{documents.find(d => d.id === quote.sourceId)?.title} · {quote.field}</button></dt><dd>{quote.value}</dd></div>)}</dl></details>
            </details>
            <details className={styles.disclosure}><summary><FileText size={16} /> Original run & tool activity<ChevronRight size={17} /></summary>
              <dl className={styles.metrics}><div><dt>Model calls</dt><dd>{recording.usage.modelCalls}</dd></div><div><dt>Original run time</dt><dd>{(recording.elapsedMs / 1000).toFixed(1)}s</dd></div><div><dt>Original cost estimate</dt><dd>${recording.usage.estimatedUsd.toFixed(4)}</dd></div></dl>
              <p className={styles.note}>{recording.firstSubmissionPassed ? 'The first submission passed the local checks.' : 'The first submission was rejected by the policy checks. Claude corrected its report before acceptance.'} These are recorded events, not a live replay.</p>
              <ol className={styles.trace}>{recording.trace.map(event => <li key={event.step}><span data-ok={event.ok}>{event.ok ? '✓' : '!'}</span><div><strong>{event.name}</strong><p>{event.detail}</p></div></li>)}</ol>
              <p className={styles.note}>{recording.usage.inputTokens.toLocaleString('en-US')} input / {recording.usage.outputTokens.toLocaleString('en-US')} output tokens. Historical cost estimate uses standard token rates; it is not a current charge or an account balance.</p>
              <button className={styles.secondary} onClick={download}>Download saved run <ArrowUpRight size={15} /></button>
            </details>
            <div className={styles.continue}><p>What changes when Finance resolves the blockers?</p><button className={styles.primary} onClick={() => chooseView('Resolve the case')}>Try resolving this case <ArrowRight size={16} /></button></div>
          </>}
          {view === 'Resolve the case' && <>
            <div className={styles.sectionHeading}><div><span className={styles.eyebrow}>LOCAL WHAT-IF · NO MODEL CALLS</span><h2>Change the facts. Check the outcome.</h2></div><button className={styles.reset} onClick={() => setStage('blocked')} disabled={stage === 'blocked'}><RotateCcw size={14} /> Reset</button></div>
            <p className={styles.note}>These buttons change a temporary copy of the fictional records. Results below come from the policy engine; the saved AI investigation stays unchanged.</p>
            <ol className={styles.progress} aria-label="Resolution progress">{['Blocked order', 'Invoice corrected', 'Payment cleared'].map((label, index) => <li key={label} aria-current={stageIndex === index ? 'step' : undefined} data-complete={stageIndex >= index}><span>{stageIndex > index ? <Check size={15} /> : index + 1}</span>{label}</li>)}</ol>
            <div className={styles.resolutionGrid}>
              <section aria-label="Current sample evidence"><h3>Current sample evidence</h3><dl className={styles.fields}><div><dt>Approved account entity</dt><dd>{current.approvedEntity}</dd></div><div data-changed={stage !== 'blocked'}><dt>Invoice billed entity</dt><dd>{current.invoice.entity}</dd></div><div data-changed={stage === 'payment_cleared'}><dt>Finance ledger / CRM status</dt><dd>{current.payment.status} / {current.crmPaymentStatus}</dd></div><div><dt>Allocation deadline</dt><dd>{scenarioDate(current.deadline)}<small>20 hours after the fixed scenario clock</small></dd></div></dl></section>
              <section className={styles.resolutionResult} aria-label="Local policy result" aria-live="polite" aria-atomic="true" data-ready={blockers.length === 0}>
                <span className={styles.eyebrow}>LOCAL POLICY RESULT</span><h3>{blockers.length ? `${blockers.length} ${blockers.length === 1 ? 'blocker remains' : 'blockers remain'}` : 'Ready for human review'}</h3>
                {blockers.length ? <ul>{blockers.map(f => <li key={f.id}>{f.title}</li>)}</ul> : <p>The invoice entity matches and payment is cleared in both records. Ticketing Operations can now review release.</p>}
                <p className={styles.deadlineNote}>The 20-hour deadline warning still applies.</p>
                {stage === 'blocked' ? <button className={styles.primary} onClick={() => setStage('invoice_corrected')}>Apply sample invoice correction <ArrowRight size={15} /></button> : stage === 'invoice_corrected' ? <button className={styles.primary} onClick={() => setStage('payment_cleared')}>Simulate Finance confirming payment <ArrowRight size={15} /></button> : <div className={styles.humanGate}><ShieldCheck size={24} /><div><strong>Harbor · human gate</strong><p>A person still reviews the evidence and proposed messages. This result does not approve or release tickets.</p></div></div>}
              </section>
            </div>
            <div className={styles.continue}><p>Try other evidence changes, edit drafts, and record a local plan review.</p><Link href="/operations" className={styles.secondary}>Open the full workspace <ArrowUpRight size={15} /></Link></div>
          </>}
          {view === 'How it works' && <>
            <div className={styles.sectionHeading}><div><span className={styles.eyebrow}>BUILT BY RAFAEL LEMOR</span><h2>Make the reasoning reviewable.</h2></div></div>
            <p className={styles.about}>Lighthouse draws on my experience coordinating partner ticketing, invoice exceptions, and payment follow-ups. It turns a familiar operations problem into an inspectable AI workflow using entirely fictional records and a demo policy.</p>
            <div className={styles.roles}>
              <article><span>01 · INVESTIGATE</span><h3>Claude reads and proposes</h3><p>One investigator reads six records through tools, identifies issues, cites exact fields, and drafts internal and client messages.</p></article>
              <article><span>02 · VERIFY</span><h3>Code checks the evidence</h3><p>Local rules calculate the decision and blockers. Quotes must match source fields. Invalid submissions receive bounded correction feedback.</p></article>
              <article><span>03 · REVIEW</span><h3>A person owns the decision</h3><p>Harbor records a review of the plan and drafts. It cannot send messages, change invoices, or release tickets. Editing evidence or drafts invalidates their approval.</p></article>
            </div>
            <div className={styles.method}><h3>Scope and limits</h3><p>The saved run shows real model responses, tool reads, and a policy-guided correction. It does not establish perfect first-attempt reasoning. Structured checks cannot certify every sentence; drafts still need a human reader.</p><p>The resolution exercise uses local rules only. Live AI investigations remain in the protected review environment. There are no real customer records or external write tools in this prototype.</p></div>
            <div className={styles.continue}><a className={styles.secondary} href="https://github.com/raf0x/lighthouse" target="_blank" rel="noreferrer">View the source <ArrowUpRight size={15} /></a><Link href="/operations" className={styles.primary}>Explore the workspace <ArrowRight size={15} /></Link></div>
          </>}
        </div>
      </section>
      <footer className={styles.footer}><span>Independent prototype · fictional partners, records, and policies</span><Link href="/live">Explore the scripted agent walkthrough <ArrowUpRight size={13} /></Link></footer>
    </main>
  </div>{document && <SourceDialog key={document.id} document={document} onClose={() => setSourceId(null)} />}</div>;
}
