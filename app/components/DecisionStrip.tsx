'use client';

import * as React from 'react';
import type { Account } from './types';
import { calculateHealthScore, bandLabel, bandColor, healthBand } from '@/app/lib/lighthouse';

export default function DecisionStrip({ account }: { account: Account }) {
  const health = calculateHealthScore(account);
  const mauDelta = Math.round(((account.mau[4] - account.mau[0]) / account.mau[0]) * 100);
  const fields = [
    ['Sample health band', bandLabel(health)],
    ['Score basis', 'Weighted sample signals'],
    ['Usage change', `${mauDelta > 0 ? '+' : ''}${mauDelta}% · five sample periods`],
    ['Suggested review', health < 70 ? 'Understand adoption blockers' : 'Validate continued value'],
    ['Contract field', `${account.contract_end} · historical sample`],
  ];
  return <div className="decision-strip">
    {fields.map(([label, value], index) => <React.Fragment key={label}>
      {index > 0 && <div className="decision-divider" aria-hidden="true" />}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="eyebrow" style={{ marginBottom: 6 }}>{label}</div>
        <div style={{ fontSize: index === 0 ? 18 : 14, fontWeight: 600, color: index === 0 ? bandColor(healthBand(health)) : 'var(--fg-1)' }}>{value}</div>
      </div>
    </React.Fragment>)}
  </div>;
}
