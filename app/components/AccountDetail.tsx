'use client';

import * as React from 'react';
import { calculateHealthScore, healthBand, bandLabel, bandColor } from '@/app/lib/lighthouse';
import { IconAlert } from './icons';
import MetricTile from './MetricTile';
import type { Account } from './types';

export default function AccountDetail({ account }: { account: Account }) {
  const health = calculateHealthScore(account);
  const band = healthBand(health);
  const label = bandLabel(health);
  const color = bandColor(band);
  const seatPct = Math.round((account.seats_active / account.seats_total) * 100);
  const mauDelta = Math.round(((account.mau[4] - account.mau[0]) / account.mau[0]) * 100);
  const alarm = band === 'critical' || band === 'high';

  return (
    <div className="card" style={{ marginBottom: 20 }}>
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
            {band === 'critical' ? '↓ Trending down' : band === 'healthy' ? '↑ Holding strong' : '◇ Watch'}
          </div>
        </div>
      </div>

      <div className="metric-strip">
        <MetricTile
          eyebrow="ARR"
          prefix="$"
          value={account.arr.toLocaleString()}
          delta={alarm ? '↓ 18%' : '↑ 6%'}
          deltaColor={alarm ? 'var(--critical-fg)' : 'var(--healthy-fg)'}
          sub="vs prior 90 days"
          alarm={alarm}
          spark={account.mau}
          sparkColor={alarm ? 'var(--critical-fg)' : 'var(--healthy-fg)'}
        />
        <MetricTile
          eyebrow="Seat Utilization"
          value={seatPct}
          suffix="%"
          delta={`${mauDelta < 0 ? '↓' : '↑'} ${Math.abs(mauDelta)}%`}
          deltaColor={mauDelta < 0 ? 'var(--critical-fg)' : 'var(--healthy-fg)'}
          sub={`${account.seats_active} / ${account.seats_total} seats`}
          alarm={seatPct < 60}
        />
        <MetricTile
          eyebrow="NPS"
          value={account.nps}
          delta={account.nps < 50 ? `↓ ${50 - account.nps}` : `↑ ${account.nps - 50}`}
          deltaColor={account.nps < 50 ? 'var(--critical-fg)' : 'var(--healthy-fg)'}
          sub="vs company avg."
          alarm={account.nps < 40}
        />
        <MetricTile
          eyebrow="Support Load"
          value={account.tickets_30d}
          delta={account.tickets_30d > 15 ? '↑ elevated' : 'normal'}
          deltaColor={account.tickets_30d > 15 ? 'var(--critical-fg)' : 'var(--fg-3)'}
          sub="tickets (30d)"
          alarm={account.tickets_30d > 15}
        />
      </div>

      <div className="confidence-strip">
        <div className="cs-chip">
          <span className="lbl">Analysis Confidence</span>
          <span className="val" style={{ color: 'var(--healthy-fg)' }}>High</span>
        </div>
        <div className="cs-chip">
          <span className="lbl">Data Quality</span>
          <span className="val" style={{ color: 'var(--healthy-fg)' }}>Complete</span>
        </div>
        <div className="cs-chip">
          <span className="live-dot" />
          <span className="lbl">Last Updated</span>
          <span className="val" style={{ fontFamily: 'var(--font-mono)' }}>2m ago</span>
        </div>
        <div className="cs-chip">
          <span className="lbl">Renewal</span>
          <span className="val" style={{ fontFamily: 'var(--font-mono)' }}>{account.contract_end}</span>
        </div>
      </div>
    </div>
  );
}
