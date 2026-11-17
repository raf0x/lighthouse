'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, CheckCheck, CircleAlert, Download, FileText, LoaderCircle, Search, ShieldCheck, Square } from 'lucide-react';
import { assessCase, decisionLabels, evidenceFor, type OperationCase } from '../lib/operations';
import { AGENT_VERSION, AGENT_PROTOCOL_VERSION, AGENT_REFRESH_MESSAGE, checkAgentRun, restoreAgentRun, type AgentRun, type AgentFailure, type AgentAvailability } from '../lib/operations-agent';
import styles from './operations.module.css';
import { useCloudWorkspace } from '../components/CloudWorkspaceProvider';

export default function AgentInvestigation({ input, onSource, onApply }: { input: OperationCase; onSource: (id: string) => void; onApply: (run: AgentRun) => void }) {
  const { user } = useCloudWorkspace();
  const [availability, setAvailability] = useState<AgentAvailability | null>(null);
  const [run, setRun] = useState<AgentRun | null>(null);
  const [failure, setFailure] = useState<AgentFailure | null>(null);
  const [running, setRunning] = useState(false);
  const [storageError, setStorageError] = useState(false);
  const [confirmReplace, setConfirmReplace] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const abortRef = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  const key = user ? `lighthouse-${user.id}-${AGENT_VERSION}-${input.id}` : `lighthouse-${AGENT_VERSION}-${input.id}`;
  const documents = evidenceFor(input);
  const assessment = assessCase(input);
  const blockerCount = assessment.findings.filter(f => f.severity === 'blocker').length;
  const attentionCount = assessment.findings.length - blockerCount;
  const outdated = availability !== null && availability.protocolVersion !== AGENT_PROTOCOL_VERSION;
  useEffect(() => {
    mounted.current = true;
    const configAbort = new AbortController();
    fetch('/api/operations/investigate', { signal: configAbort.signal, cache: 'no-store' }).then(r => r.ok ? r.json() : Promise.reject()).then(setAvailability).catch(() => { if (!configAbort.signal.aborted) setFailure({ code: 'configuration', error: 'Could not check live investigation availability. Local policy checks still work.' }); });
    try { const stored = localStorage.getItem(key); if (stored) setRun(restoreAgentRun(JSON.parse(stored), input)); } catch { setStorageError(true); }
    return () => { mounted.current = false; configAbort.abort(); abortRef.current?.abort(); };
  // This component is keyed by the exact evidence signature in its parent.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { if (!running) return; const start = Date.now(); const timer = window.setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 1000); return () => clearInterval(timer); }, [running]);
  async function investigate() {
    if (running || !availability?.enabled || outdated) return;
    const abort = new AbortController(); abortRef.current = abort;
    setRunning(true); setFailure(null); setElapsed(0); setConfirmReplace(false);
    try {
      const response = await fetch('/api/operations/investigate', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Lighthouse-Agent-Protocol': AGENT_PROTOCOL_VERSION }, body: JSON.stringify({ case: input }), signal: abort.signal });
      const data = await response.json();
      if (!mounted.current) return;
      if (!response.ok) { setFailure({ error: data.error || 'The investigation failed. No drafts were applied.', code: data.code || 'request_failed', trace: data.trace, usage: data.usage }); return; }
      const checked = checkAgentRun(data.run, input);
      if (checked.failure) { setFailure(checked.failure); return; }
      setRun(checked.run);
      try { localStorage.setItem(key, JSON.stringify(checked.run)); setStorageError(false); } catch { setStorageError(true); }
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
    <p className={styles.muted}>Find what needs attention and prepare two messages for review.</p>
    <div className={styles.agentControls}>
      <button className={styles.primary} onClick={investigate} disabled={!availability?.enabled || outdated || failure?.code === 'outdated_page' || running}>{running ? <LoaderCircle size={16} className={styles.spinner} /> : <Search size={16} />}{running ? `Investigating · ${elapsed}s` : run ? 'Run a new investigation' : 'Investigate with Claude'}</button>
      {running && <button className={styles.secondary} onClick={() => abortRef.current?.abort()}><Square size={13} /> Stop</button>}
      {(outdated || failure?.code === 'outdated_page') && <button className={styles.secondary} onClick={() => window.location.reload()}>Refresh page</button>}
    </div>
    <p role="status" aria-live="polite" className={styles.small}>{running ? 'Reading six records and checking findings…' : outdated ? AGENT_REFRESH_MESSAGE : availability ? availability.enabled ? input.imported ? 'Sends these case fields to Anthropic and uses your API credits. No external actions are taken.' : 'Uses your Anthropic credits. Nothing is sent or changed.' : availability.reason : 'Checking live availability…'}</p>
    {availability && !availability.enabled && <Link href="/demo" className={styles.textButton}>Explore a saved Claude investigation <ArrowRight size={14} /></Link>}
    {storageError && <p className={styles.small}>This result is available for this session. Download it before leaving.</p>}
    {failure && <div role="alert" className={styles.agentError}><CircleAlert size={18} /><div><strong>Investigation not completed</strong><p>{failure.error}</p>{run && <p>The previous successful result is retained below for this same evidence.</p>}</div></div>}
    {run && <>
      <div className={`${styles.result} ${styles.agentOutcome}`} data-decision={run.report.decision} aria-live="polite"><span className={styles.resultTag}><ShieldCheck size={15} />{decisionLabels[run.report.decision]}</span><h3>{blockerCount ? `${blockerCount} ${blockerCount === 1 ? 'blocker' : 'blockers'}` : 'No blockers'}{attentionCount > 0 && <span> · {attentionCount} deadline warning</span>}</h3><p>{run.report.summary}</p></div>
      <div className={styles.agentAction}><span className={styles.eyebrow}>NEXT STEP · {run.report.owner}</span><p>{run.report.recommendation}</p></div>
      <div className={styles.agentDrafts}><h4>Proposed messages</h4><p className={styles.small}>Review before applying. Replacing drafts clears their approval.</p>{(['internal','client'] as const).map(kind => <details className={styles.checks} key={kind}><summary><FileText size={15} />{kind === 'internal' ? 'Internal escalation' : 'Client update'} <ArrowRight size={13} /></summary><p className={styles.agentDraftText}>{run.report.drafts[kind]}</p></details>)}
        {!confirmReplace ? <button className={styles.secondary} disabled={running} onClick={() => setConfirmReplace(true)}>Use these message drafts <ArrowRight size={14} /></button> : <div className={styles.agentReplace}><p>Replace both current drafts and clear their approval?</p><button className={styles.primary} onClick={() => { onApply(run); setConfirmReplace(false); }}>Replace drafts</button><button className={styles.textButton} onClick={() => setConfirmReplace(false)}>Keep current drafts</button></div>}
      </div>
      <details className={styles.checks}><summary><CheckCheck size={16} /> Evidence & checks · {run.report.citations.length} citations <ArrowRight size={13} /></summary>
        <p className={styles.small}>Decision and finding categories match the local policy. Quoted fields match the records. These checks do not verify every sentence; review the wording before use.</p>
        {run.report.findings.map(f => <article className={styles.agentFinding} key={f.id}><h4>{assessment.findings.find(expected => expected.id === f.id)?.title}</h4><p>{f.explanation}</p><div className={styles.citations}>{f.sourceIds.map(id => <button key={id} onClick={() => onSource(id)}><FileText size={12} />{documents.find(d => d.id === id)?.title}</button>)}</div></article>)}
        {run.report.questions.length > 0 && <div className={styles.agentQuestions}><h4>Information to request</h4><ul>{run.report.questions.map((q, i) => <li key={i}><strong>{q.owner}</strong><p>{q.question}</p></li>)}</ul></div>}
        <details className={styles.checks}><summary><FileText size={16} /> Exact field quotations <ArrowRight size={13} /></summary><div className={styles.agentCitations}>{run.report.citations.map((c, i) => <div key={i}><button onClick={() => onSource(c.sourceId)}>{documents.find(d => d.id === c.sourceId)?.title} · {c.field}</button><p>{c.value}</p></div>)}</div></details>
      </details>
    </>}
    <details className={styles.checks}><summary><Search size={16} /> Run details{usage && ` · $${usage.estimatedUsd.toFixed(4)} estimated`} <ArrowRight size={13} /></summary>
      <p className={styles.small}>Up to four model calls per run; no automatic network retries. No email, invoice, payment, or ticket-release tools.</p>
      {usage && <><dl className={styles.agentUsage}><div><dt>Model calls</dt><dd>{usage.modelCalls}</dd></div><div><dt>Tokens in / out</dt><dd>{usage.inputTokens.toLocaleString()} / {usage.outputTokens.toLocaleString()}</dd></div>{run && !failure && <div><dt>Run time</dt><dd>{(run.elapsedMs / 1000).toFixed(1)}s</dd></div>}</dl><p className={styles.small}>Estimate uses standard Sonnet 4.6 token rates; excludes taxes and account-specific pricing. Not an account balance or a global spending cap.{failure ? ' Usage includes reported completed responses only; failed or cancelled requests may add charges.' : ''}</p></>}
      {trace && <><h4 className={styles.agentTraceTitle}>Actual tool activity</h4><ol>{trace.map(t => <li key={t.step}><span>{t.ok ? '✓' : '!'}</span><div><strong>{t.name}</strong><p>{t.detail}</p></div></li>)}</ol><p className={styles.small}>Recorded responses, tool reads, and validation outcomes.</p></>}
      {run && <button className={styles.download} onClick={download}><Download size={15} /> Download agent run</button>}
    </details>
  </section>;
}
