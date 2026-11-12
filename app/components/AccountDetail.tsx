'use client';

import * as React from 'react';
import { calculateHealthScore, healthBand, bandLabel, bandColor } from '@/app/lib/lighthouse';
import { IconAlert } from './icons';
import MetricTile from './MetricTile';
import DecisionStrip from './DecisionStrip';
import type { Account } from './types';

export default function AccountDetail({ account }: { account: Account }) {
  const health = calculateHealthScore(account);
  const band = healthBand(health);
  const label = bandLabel(health);
  const color = bandColor(band);
  const seatPct = Math.round((account.seats_active / account.seats_total) * 100);
  const mauDelta = Math.round(((account.mau[4] - account.mau[0]) / account.mau[0]) * 100);

  return (
    <div className="card" style={{ marginBottom: 20 }}>
      <DecisionStrip account={account} />
      
      <div className="acc-detail-head">
        <div>
          <div className="acc-title">{account.name}</div>
          <div className="acc-subtitle">{account.industry} · {account.exec}</div>
          <span className={`pill pill--${band}`} style={{ marginTop: 14 }}>
            {band === 'critical' && <IconAlert size={11} />}
            {label}
          </span>
        </div>
        <div className="acc-score-block">
          <div className="eyebrow">Health Score</div>
          <div className="score" style={{ color }}>
            {health}<span className="score-deno">/100</span>
          </div>
          <div className="band-label" style={{ color }}>
            {label}
          </div>
        </div>
      </div>

      <p style={{ color: 'var(--fg-2)', fontSize: 13, lineHeight: 1.6, marginBottom: 16 }}>
        Fictional account. Health is a weighted sample score, not a churn probability or validated prediction.
        Bands: Healthy 70–100 · Watch 50–69 · High Risk 30–49 · Critical Risk 0–29.
      </p>
      <div className="metric-strip">
        <MetricTile eyebrow="Sample ARR" prefix="$" value={account.arr.toLocaleString()} sub="No revenue history supplied" />
        <MetricTile eyebrow="Seats active" value={seatPct} suffix="%" sub={`${account.seats_active} / ${account.seats_total} sample seats`} />
        <MetricTile eyebrow="Sample NPS" value={account.nps} sub="No comparison baseline supplied" />
        <MetricTile eyebrow="Support tickets" value={account.tickets_30d} sub="Sample 30-day count" />
      </div>
      <div className="confidence-strip">
        <div className="cs-chip"><span className="lbl">Data source</span><span className="val">Static fictional dataset</span></div>
        <div className="cs-chip"><span className="lbl">Usage change</span><span className="val" style={{ color: mauDelta < 0 ? 'var(--high-fg)' : 'var(--healthy-fg)' }}>{mauDelta > 0 ? '+' : ''}{mauDelta}% over five sample periods</span></div>
        <div className="cs-chip"><span className="lbl">Contract date</span><span className="val">{account.contract_end} · historical field, not a deadline</span></div>
      </div>
    </div>
  );
}
