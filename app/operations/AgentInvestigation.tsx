'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowRight, CheckCheck, CircleAlert, Download, FileText, LoaderCircle, Search, ShieldCheck, Square } from 'lucide-react';
import { decisionLabels, evidenceFor, type OperationCase } from '../lib/operations';
import { AGENT_VERSION, restoreAgentRun, type AgentRun, type AgentFailure, type AgentAvailability } from '../lib/operations-agent';
import styles from './operations.module.css';

export default function AgentInvestigation({ input, onSource, onApply }: { input: OperationCase; onSource: (id: string) => void; onApply: (run: AgentRun) => void }) {
  const [availability, setAvailability] = useState<AgentAvailability | null>(null);
  const [run, setRun] = useState<AgentRun | null>(null);
  const [failure, setFailure] = useState<AgentFailure | null>(null);
  const [running, setRunning] = useState(false);
  const [storageError, setStorageError] = useState(false);
  const [confirmReplace, setConfirmReplace] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const abortRef = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  const key = `lighthouse-${AGENT_VERSION}-${input.id}`;
  const documents = evidenceFor(input);
  useEffect(() => {
    mounted.current = true;
    const configAbort = new AbortController();
    fetch('/api/operations/investigate', { signal: configAbort.signal }).then(r => r.ok ? r.json() : Promise.reject()).then(setAvailability).catch(() => { if (!configAbort.signal.aborted) setFailure({ code: 'configuration', error: 'Could not check live investigation availability. Local policy checks still work.' }); });
    try { const stored = localStorage.getItem(key); if (stored) setRun(restoreAgentRun(JSON.parse(stored), input)); } catch { setStorageError(true); }
    return () => { mounted.current = false; configAbort.abort(); abortRef.current?.abort(); };
  // This component is keyed by the exact evidence signature in its parent.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { if (!running) return; const start = Date.now(); const timer = window.setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 1000); return () => clearInterval(timer); }, [running]);
  async function investigate() {
    if (running || !availability?.enabled) return;
    const abort = new AbortController(); abortRef.current = abort;
    setRunning(true); setFailure(null); setElapsed(0); setConfirmReplace(false);
    try {
      const response = await fetch('/api/operations/investigate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ case: input }), signal: abort.signal });
      const data = await response.json();
      if (!mounted.current) return;
      if (!response.ok) { setFailure({ error: data.error || 'The investigation failed. No drafts were applied.', code: data.code || 'request_failed', trace: data.trace, usage: data.usage }); return; }
      const checked = restoreAgentRun(data.run, input);
      if (!checked) { setFailure({ code: 'invalid_response', error: 'The response did not match the current evidence and was rejected.' }); return; }
      setRun(checked);
      try { localStorage.setItem(key, JSON.stringify(checked)); setStorageError(false); } catch { setStorageError(true); }
    } catch {
      if (mounted.current) setFailure({ code: abort.signal.aborted ? 'cancelled' : 'connection', error: abort.signal.aborted ? 'Stopped waiting for this investigation. An in-flight provider request may still incur usage. No drafts were applied.' : 'The connection was interrupted. No automatic retry was made; any completed provider calls may still incur usage.' });
    } finally { if (mounted.current) setRunning(false); abortRef.current = null; }
  }
  function download() {
    if (!run) return;
    const blob = new Blob([JSON.stringify({ ...run, sourceRecords: documents, humanReviewRequired: true, limitations: 'Validation checks decision/category agreement and exact field citations. It does not prove every narrative statement. Local record; not authenticated provenance.' }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `Lighthouse-${input.id}-agent-run.json`; a.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const trace = failure?.trace ?? run?.trace;
  const usage = failure?.usage ?? run?.usage;
  return <section aria-label="AI case investigation" className={styles.agentSection}>
    <div className={styles.sectionTitle}><h3>Case investigator</h3><span>Claude · read-only tools</span></div>
    <p className={styles.muted}>Ask the agent to inspect the six records, explain the blockers, and draft a response. Local policy checks remain the release reference.</p>
    <div className={styles.agentControls}>
      <button className={styles.primary} onClick={investigate} disabled={!availability?.enabled || running}>{running ? <LoaderCircle size={16} className={styles.spinner} /> : <Search size={16} />}{running ? `Investigating · ${elapsed}s` : run ? 'Run a new investigation' : 'Investigate with Claude'}</button>
      {running && <button className={styles.secondary} onClick={() => abortRef.current?.abort()}><Square size={13} /> Stop</button>}
    </div>
    <p role="status" aria-live="polite" className={styles.small}>{running ? 'Claude is reading records and submitting its findings for validation. Drafts change only when you apply them.' : availability ? availability.enabled ? 'Uses your Anthropic account. Up to four model calls per run; no automatic network retries. No emails, invoice changes, or ticket release.' : availability.reason : 'Checking live availability…'}</p>
    {storageError && <p className={styles.small}>This result is available for this session. Download it before leaving.</p>}
    {failure && <div role="alert" className={styles.agentError}><CircleAlert size={18} /><div><strong>Investigation not completed</strong><p>{failure.error}</p>{run && <p>The previous successful result is retained below for this same evidence.</p>}</div></div>}
    {run && <>
      <div className={styles.agentVerified}><CheckCheck size={18} /><div><strong>Policy and citation checks passed</strong><p>Decision and finding categories match the rules. Quoted fields match the records. Read the explanation and drafts before using them.</p></div></div>
      <div className={styles.result} data-decision={run.report.decision}><span className={styles.resultTag}><ShieldCheck size={15} />{decisionLabels[run.report.decision]}</span><h3>Investigation summary</h3><p>{run.report.summary}</p></div>
      {run.report.findings.map(f => <article className={styles.agentFinding} key={f.id}><h4>{f.id.replaceAll('_', ' ')}</h4><p>{f.explanation}</p><div className={styles.citations}>{f.sourceIds.map(id => <button key={id} onClick={() => onSource(id)}><FileText size={12} />{documents.find(d => d.id === id)?.title}</button>)}</div></article>)}
      <div className={styles.agentAction}><span className={styles.eyebrow}>SUGGESTED NEXT ACTION · {run.report.owner}</span><p>{run.report.recommendation}</p></div>
      {run.report.questions.length > 0 && <div className={styles.agentQuestions}><h4>Information to request</h4><ul>{run.report.questions.map((q, i) => <li key={i}><strong>{q.owner}</strong><p>{q.question}</p></li>)}</ul></div>}
      <details className={styles.checks}><summary><FileText size={16} /> Inspect {run.report.citations.length} field citations <ArrowRight size={13} /></summary><div className={styles.agentCitations}>{run.report.citations.map((c, i) => <div key={i}><button onClick={() => onSource(c.sourceId)}>{documents.find(d => d.id === c.sourceId)?.title} · {c.field}</button><p>{c.value}</p></div>)}</div></details>
      <div className={styles.agentDrafts}><h4>Proposed message drafts</h4><p className={styles.small}>Review these before replacing the current drafts. Applying them clears any previous Harbor approval.</p>{(['internal','client'] as const).map(kind => <details className={styles.checks} key={kind}><summary><FileText size={15} />{kind === 'internal' ? 'Internal escalation' : 'Client update'} <ArrowRight size={13} /></summary><p className={styles.agentDraftText}>{run.report.drafts[kind]}</p></details>)}
        {!confirmReplace ? <button className={styles.secondary} disabled={running} onClick={() => setConfirmReplace(true)}>Use these message drafts <ArrowRight size={14} /></button> : <div className={styles.agentReplace}><p>Replace both current drafts and clear their approval?</p><button className={styles.primary} onClick={() => { onApply(run); setConfirmReplace(false); }}>Replace drafts</button><button className={styles.textButton} onClick={() => setConfirmReplace(false)}>Keep current drafts</button></div>}
      </div>
      <button className={styles.download} onClick={download}><Download size={15} /> Download agent run</button>
    </>}
    {usage && <dl className={styles.agentUsage}><div><dt>Model calls</dt><dd>{usage.modelCalls}</dd></div><div><dt>Tokens in / out</dt><dd>{usage.inputTokens.toLocaleString()} / {usage.outputTokens.toLocaleString()}</dd></div><div><dt>Estimated usage</dt><dd>${usage.estimatedUsd.toFixed(4)}</dd></div>{run && !failure && <div><dt>Run time</dt><dd>{(run.elapsedMs / 1000).toFixed(1)}s</dd></div>}</dl>}
    {usage && <p className={styles.small}>Estimate uses standard Haiku 4.5 token rates; excludes taxes and account-specific pricing. Not an account balance or a global spending cap.{failure ? ' Usage includes reported completed responses only; failed or cancelled requests may add charges.' : ''}</p>}
    {trace && <details className={styles.checks}><summary><Search size={16} /> Actual tool activity <ArrowRight size={13} /></summary><ol>{trace.map(t => <li key={t.step}><span>{t.ok ? '✓' : '!'}</span><div><strong>{t.name}</strong><p>{t.detail}</p></div></li>)}</ol><p className={styles.small}>Recorded API responses, tool reads, and validation outcomes. No hidden reasoning transcript.</p></details>}
  </section>;
}
