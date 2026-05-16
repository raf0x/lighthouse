'use client';

import * as React from 'react';

type ConfidenceLevel = 'high' | 'medium' | 'low' | 'limited';

export default function ConfidenceBadge({ level, reason }: { level: ConfidenceLevel; reason?: string }) {
  const config = {
    high: { label: 'High Confidence', color: 'var(--healthy-fg)', bg: 'var(--healthy-bg)' },
    medium: { label: 'Medium Confidence', color: 'var(--medium-fg)', bg: 'var(--medium-bg)' },
    low: { label: 'Low Confidence', color: 'var(--high-fg)', bg: 'var(--high-bg)' },
    limited: { label: 'Limited Data', color: 'var(--fg-3)', bg: 'var(--surface-2)' },
  };

  const { label, color, bg } = config[level];

  return (
    <div style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      padding: '6px 10px',
      background: bg,
      border: `1px solid ${color}40`,
      borderRadius: 6,
      fontSize: 11,
      fontFamily: 'var(--font-mono)',
      color: color,
      fontWeight: 600,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: 99, background: color }} />
      {label}
      {reason && <span style={{ color: 'var(--fg-3)', marginLeft: 4 }}>· {reason}</span>}
    </div>
  );
}
