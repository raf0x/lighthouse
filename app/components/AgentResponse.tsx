'use client';

import * as React from 'react';
import { IconAlert, IconCheckCircle, IconTrendUp, IconTrendDown, IconZap } from './icons';
import type { Account, Analysis, AnalysisType } from './types';

const MAUChart: React.FC<{ values: number[] }> = ({ values }) => {
  const months = ['Feb', 'Mar', 'Apr', 'May', 'Jun'];
  const W = 600, H = 160, P = 36;
  const min = Math.min(...values), max = Math.max(...values);
  const range = max - min || 1;
  const trending = values[values.length - 1] < values[0];
  const stroke = trending ? '#FF6B6B' : '#3DDC97';
  const points: [number, number][] = values.map((v, i) => {
    const x = P + (i / (values.length - 1)) * (W - P * 2);
    const y = H - P - ((v - min) / range) * (H - P * 2);
    return [x, y];
  });
  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0]} ${p[1]}`).join(' ');
  const areaD = pathD + ` L ${points[points.length - 1][0]} ${H - P} L ${points[0][0]} ${H - P} Z`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block' }}>
      <defs>
        <linearGradient id="mauArea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.25" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0.25, 0.5, 0.75].map(t => (
        <line key={t} x1={P} y1={P + t * (H - P * 2)} x2={W - P} y2={P + t * (H - P * 2)} stroke="#1A2640" strokeWidth="1" />
      ))}
      <path d={areaD} fill="url(#mauArea)" />
      <path d={pathD} fill="none" stroke={stroke} strokeWidth="2" />
      {points.map((p, i) => (<circle key={`d-${i}`} cx={p[0]} cy={p[1]} r="3.5" fill={stroke} />))}
      {points.map((p, i) => (<text key={`m-${i}`} x={p[0]} y={H - 12} fill="#8C99B5" fontSize="11" fontFamily="Geist Mono, monospace" textAnchor="middle">{months[i]}</text>))}
      {points.map((p, i) => (<text key={`v-${i}`} x={p[0]} y={p[1] - 10} fill="#C6CFE2" fontSize="10" fontFamily="Geist Mono, monospace" textAnchor="middle">{values[i]}</text>))}
    </svg>
  );
};

type Props = { analysis: Analysis; account: Account; type: AnalysisType };

export default function AgentResponse({ analysis, account, type }: Props) {
  if (!analysis) return null;

  return (
    <div>
      {analysis.summary && (
        <div className="r-card summary">
          <div className="r-card-title">
            <span className="pill pill--agent">✦ Agent</span>
            <span style={{ fontSize: 12, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)' }}>2-sentence summary</span>
          </div>
          <div className="text">"{analysis.summary}"</div>
        </div>
      )}

      {type === 'health' && account && (
        <div className="r-card">
          <div className="r-card-title">
            <IconTrendDown size={16} style={{ color: 'var(--critical-fg)' }} />
            Monthly Active Users
            <span className="count">5 mo · trailing</span>
          </div>
          <MAUChart values={account.mau} />
        </div>
      )}

      {analysis.risks && analysis.risks.length > 0 && (
        <div className="r-card">
          <div className="r-card-title">
            <IconAlert size={16} style={{ color: 'var(--critical-fg)' }} />
            Risks
            <span className="count">{analysis.risks.length}</span>
          </div>
          {analysis.risks.map((r, i) => (
            <div key={i} className="risk-item" style={{
              borderLeftColor: r.severity === 'Critical' ? 'var(--critical-fg)' : r.severity === 'High' ? 'var(--high-fg)' : 'var(--medium-fg)',
              background: r.severity === 'Critical' ? 'rgba(255,92,92,0.05)' : r.severity === 'High' ? 'rgba(255,155,71,0.05)' : 'rgba(255,209,102,0.05)',
            }}>
              <div>
                <div className="title">{r.title}</div>
                <div className="desc">{r.description}</div>
              </div>
              <span className={`pill pill--${r.severity === 'Critical' ? 'critical' : r.severity === 'High' ? 'high' : 'watch'}`}>{r.severity}</span>
            </div>
          ))}
        </div>
      )}

      {analysis.positives && analysis.positives.length > 0 && (
        <div className="r-card">
          <div className="r-card-title">
            <IconCheckCircle size={16} style={{ color: 'var(--healthy-fg)' }} />
            Positive Indicators
            <span className="count">{analysis.positives.length}</span>
          </div>
          {analysis.positives.map((p, i) => (
            <div key={i} className="pos-item">
              <div>
                <div className="title">{p.title}</div>
                <div className="desc">{p.description}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {analysis.opportunities && analysis.opportunities.length > 0 && (
        <div className="r-card">
          <div className="r-card-title">
            <IconTrendUp size={16} style={{ color: 'var(--beam-300)' }} />
            Expansion Opportunities
            <span className="count">{analysis.opportunities.length}</span>
          </div>
          {analysis.opportunities.map((o, i) => (
            <div key={i} className="opp-item">
              <div>
                <div className="title">{o.title}</div>
                <div className="desc">{o.description || o.business_case}</div>
                {o.arr_lift && <span className="lift">EST. LIFT · {o.arr_lift}</span>}
                {o.approach && <div className="desc" style={{ marginTop: 6, color: 'var(--fg-4)' }}>Approach: {o.approach}</div>}
              </div>
            </div>
          ))}
        </div>
      )}

      {analysis.next_actions && (
        <div className="r-card">
          <div className="r-card-title">
            <IconZap size={16} style={{ color: 'var(--beam-300)' }} />
            Next Actions
          </div>
          <ol style={{ paddingLeft: 22, color: 'var(--fg-2)', fontSize: 13, lineHeight: 1.8 }}>
            {analysis.next_actions.map((a, i) => (<li key={i}>{a}</li>))}
          </ol>
        </div>
      )}

      {analysis.recommendation && (
        <div className="recommend">
          <div className="meta">
            <span className="pill pill--agent">✦ Agent Recommended</span>
            <span style={{ fontSize: 11, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)' }}>priority · P0 · 48h SLA</span>
          </div>
          <div className="title">"{analysis.recommendation.title}"</div>
          <div className="desc">{analysis.recommendation.description}</div>
          <div className="actions">
            <button className="btn btn--critical">{analysis.recommendation.cta || 'View Action Plan'} →</button>
            <button className="btn btn--secondary">Snooze · 24h</button>
            <span className="arr-saved">est. ARR saved · ${(account.arr / 1000).toFixed(0)}K</span>
          </div>
        </div>
      )}

      {analysis.subject && analysis.body && (
        <div className="r-card email-card">
          <div className="email-head">
            <div className="eyebrow" style={{ marginBottom: 4 }}>Draft email · to {account.exec}</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--fg-1)' }}>{analysis.subject}</div>
          </div>
          <div className="email-body">{analysis.body}</div>
          <div style={{ display: 'flex', gap: 8, padding: '0 18px 18px' }}>
            <button className="btn btn--primary">Send via Gmail</button>
            <button className="btn btn--secondary">Edit draft</button>
            <button className="btn btn--ghost">Regenerate</button>
          </div>
        </div>
      )}
    </div>
  );
}
