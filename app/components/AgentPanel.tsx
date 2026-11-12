'use client';

import * as React from 'react';
import { mockAnalysis } from '@/app/lib/lighthouse';
import { IconRobot, IconTrendUp, IconBriefing, IconMail } from './icons';
import AgentResponse from './AgentResponse';
import type { Account, Analysis, AnalysisType } from './types';

type TabDef = { type: AnalysisType; label: string; Icon: React.FC<{ size?: number }>; thinking: string };

const AGENT_TABS: TabDef[] = [
  { type: 'health',    label: 'Analyze sample health', Icon: IconRobot,    thinking: 'Reviewing usage, support, and engagement signals…' },
  { type: 'expansion', label: 'Expansion Plays',    Icon: IconTrendUp,  thinking: 'Reviewing fictional usage signals for discovery questions…' },
  { type: 'briefing',  label: 'Executive Briefing', Icon: IconBriefing, thinking: 'Synthesizing executive summary with strategic recommendations…' },
  { type: 'email',     label: 'Draft Email',        Icon: IconMail,     thinking: 'Composing personalized outreach based on recent activity…' },
];

export default function AgentPanel({ account }: { account: Account }) {
  const [activeType, setActiveType] = React.useState<AnalysisType | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [analysis, setAnalysis] = React.useState<Analysis | null>(null);
  const requestVersion = React.useRef(0);
  const [source, setSource] = React.useState<'ai' | 'demo' | null>(null);

  React.useEffect(() => {
    requestVersion.current += 1;
    setLoading(false);
    setAnalysis(null);
    setActiveType(null);
    setSource(null);
  }, [account.id]);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        requestVersion.current += 1;
        setLoading(false);
        setSource(null);
        setAnalysis(null);
        setActiveType(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const run = async (type: AnalysisType) => {
    const version = ++requestVersion.current;
    setActiveType(type);
    setLoading(true);
    setAnalysis(null);
    setSource(null);
    let result: Analysis | null = null;
    let usedAI = false;
    try {
      const r = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ account, type }),
      });
      const data = await r.json();
      if (r.ok && data.analysis) {
        result = data.analysis as Analysis;
        usedAI = true;
      }
    } catch (err) {
      console.warn('/api/analyze failed, using mock', err);
    }
    if (!result) {
      await new Promise(r => setTimeout(r, 800));
      result = mockAnalysis(account, type);
    }
    if (version !== requestVersion.current) return;
    setSource(usedAI ? 'ai' : 'demo');
    setAnalysis(result);
    setLoading(false);
  };

  const activeMeta = AGENT_TABS.find(t => t.type === activeType);

  return (
    <div className="card card--elevated">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{
            width: 28, height: 28, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            borderRadius: 8, background: 'var(--agent-bg)', border: '1px solid var(--agent-line)', color: 'var(--beam-300)',
          }}>✦</span>
          <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--fg-1)' }}>Optional sample analysis</h3>
          <span className="pill pill--agent" style={{ marginLeft: 4 }}>{source === 'ai' ? 'AI result' : source === 'demo' ? 'Scripted fallback' : 'On demand'}</span>
        </div>
        {analysis && (
          <button className="btn btn--ghost" style={{ padding: '4px 10px', fontSize: 11 }}
                  onClick={() => { requestVersion.current += 1; setLoading(false); setSource(null); setAnalysis(null); setActiveType(null); }}>
            Clear (ESC)
          </button>
        )}
      </div>

      <div className="agent-tabs">
        {AGENT_TABS.map(t => (
          <button
            key={t.type}
            className={`agent-tab ${activeType === t.type ? 'agent-tab--active' : ''}`}
            onClick={() => run(t.type)}
            disabled={loading}
          >
            <t.Icon />
            {t.label}
          </button>
        ))}
      </div>

      {!loading && !analysis && (
        <div style={{
          textAlign: 'center', padding: '40px 20px',
          background: 'var(--surface-inset)', border: '1px dashed var(--border-default)', borderRadius: 10,
        }}>
          <div style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 20, color: 'var(--fg-2)', marginBottom: 8 }}>
            Choose an analysis to request.
          </div>
          <div style={{ fontSize: 13, color: 'var(--fg-3)' }}>
            Only the displayed fictional data for <strong style={{ color: 'var(--beam-300)' }}>{account.name}</strong> is sent to the optional AI service when you click. No CRM is scanned. If unavailable, a clearly labeled scripted example appears. Nothing is sent to a customer.
          </div>
        </div>
      )}

      {loading && activeMeta && (
        <div className="thinking">
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div className="thinking-ring" />
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--fg-1)' }}>Analyzing {account.name}</div>
              <div style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 13, color: 'var(--fg-3)', marginTop: 2 }}>{activeMeta.thinking}</div>
            </div>
            <span className="pill pill--agent" style={{ marginLeft: 'auto' }}>Request pending</span>
          </div>
          <p style={{ marginTop: 14, color: 'var(--fg-2)', fontSize: 13 }}>Requesting an analysis of the static sample only. No background monitoring or external data lookup.</p>
        </div>
      )}

      {!loading && analysis && activeType && (
        <>
          <p role="status" style={{ fontSize: 12, lineHeight: 1.5, color: 'var(--fg-3)', marginBottom: 12 }}>
            {source === 'demo'
              ? 'Demo example generated from fictional account data. The live AI request was unavailable.'
              : 'AI-generated analysis of fictional account data. Recommendations and future outcomes require human validation.'}
          </p>
          <AgentResponse analysis={analysis} account={account} type={activeType} />
        </>
      )}
    </div>
  );
}
