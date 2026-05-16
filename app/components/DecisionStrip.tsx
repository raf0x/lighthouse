'use client';

import * as React from 'react';
import type { Account } from './types';
import { calculateHealthScore } from '@/app/lib/lighthouse';

export default function DecisionStrip({ account }: { account: Account }) {
  const health = calculateHealthScore(account);
  const mauDelta = ((account.mau[4] - account.mau[0]) / account.mau[0]) * 100;
  const daysToRenewal = Math.floor((new Date(account.contract_end).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  
  const renewalRisk = health < 30 ? 'Critical' : health < 50 ? 'High' : health < 70 ? 'Medium' : 'Low';
  const confidence = health < 30 ? 94 : health < 50 ? 89 : health < 70 ? 82 : 91;
  const primaryDriver = mauDelta < -15 ? 'Adoption Decline' : 
                       account.tickets_30d > 15 ? 'Support Burden' :
                       account.nps < 40 ? 'Satisfaction Drop' :
                       mauDelta > 10 ? 'Usage Growth' : 'Seat Expansion';
  const motion = health < 50 ? 'Executive Escalation' : 
                 health < 70 ? 'Proactive Check-in' : 'Expansion Review';
  const urgency = daysToRenewal < 0 ? 'OVERDUE' :
               daysToRenewal < 60 ? `${daysToRenewal} Days` :
               health < 30 ? '14 Days' :
               health < 50 ? '30 Days' : '60 Days';

  const riskColor = renewalRisk === 'Critical' ? 'var(--critical-fg)' :
                   renewalRisk === 'High' ? 'var(--high-fg)' :
                   renewalRisk === 'Medium' ? 'var(--medium-fg)' : 'var(--healthy-fg)';

  return (
    <div style={{
      display: 'flex',
      gap: 16,
      padding: '16px 20px',
      background: 'var(--surface-inset)',
      border: '1px solid var(--border-subtle)',
      borderRadius: 12,
      marginBottom: 24,
    }}>
      <div style={{ flex: 1 }}>
        <div className="eyebrow" style={{ marginBottom: 6 }}>Renewal Risk</div>
        <div style={{ fontSize: 18, fontWeight: 700, color: riskColor }}>{renewalRisk}</div>
      </div>
      <div style={{ width: 1, background: 'var(--border-subtle)' }} />
      <div style={{ flex: 1 }}>
        <div className="eyebrow" style={{ marginBottom: 6 }}>Confidence</div>
        <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--beam-300)', fontFamily: 'var(--font-mono)' }}>
          {confidence}%
        </div>
      </div>
      <div style={{ width: 1, background: 'var(--border-subtle)' }} />
      <div style={{ flex: 1.5 }}>
        <div className="eyebrow" style={{ marginBottom: 6 }}>Primary Driver</div>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--fg-1)' }}>{primaryDriver}</div>
      </div>
      <div style={{ width: 1, background: 'var(--border-subtle)' }} />
      <div style={{ flex: 1.5 }}>
        <div className="eyebrow" style={{ marginBottom: 6 }}>Recommended Motion</div>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--fg-1)' }}>{motion}</div>
      </div>
      <div style={{ width: 1, background: 'var(--border-subtle)' }} />
      <div style={{ flex: 1 }}>
        <div className="eyebrow" style={{ marginBottom: 6 }}>Urgency Window</div>
        <div style={{ fontSize: 14, fontWeight: 700, color: health < 50 ? 'var(--critical-fg)' : 'var(--fg-1)', fontFamily: 'var(--font-mono)' }}>
          {urgency}
        </div>
      </div>
    </div>
  );
}
