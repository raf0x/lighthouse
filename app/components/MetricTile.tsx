'use client';

import * as React from 'react';

export const Sparkline: React.FC<{ values: number[]; color?: string }> = ({ values, color = 'var(--critical-fg)' }) => {
  if (!values?.length) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const points = values.map((v, i) => {
    const x = (i / (values.length - 1)) * 54;
    const y = 18 - ((v - min) / range) * 16 - 1;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  return (
    <svg className="metric-spark" viewBox="0 0 54 18">
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" />
    </svg>
  );
};

type MetricTileProps = {
  eyebrow: string;
  value: React.ReactNode;
  delta?: string;
  deltaColor?: string;
  sub?: string;
  alarm?: boolean;
  spark?: number[];
  sparkColor?: string;
  prefix?: string;
  suffix?: string;
};

export default function MetricTile({ eyebrow, value, delta, deltaColor, sub, alarm, spark, sparkColor, prefix, suffix }: MetricTileProps) {
  return (
    <div className={`metric ${alarm ? 'metric--alarm' : ''}`}>
      <div className="metric-eyebrow">{eyebrow}</div>
      <div className="metric-value">{prefix}{value}{suffix && <span style={{ color: 'var(--fg-3)', fontSize: 16 }}>{suffix}</span>}</div>
      {delta && <div className="metric-delta" style={{ color: deltaColor || 'var(--fg-3)' }}>{delta}</div>}
      {sub && <div className="metric-sub">{sub}</div>}
      {spark && <Sparkline values={spark} color={sparkColor} />}
    </div>
  );
}
