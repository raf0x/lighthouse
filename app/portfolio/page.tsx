'use client';

import * as React from 'react';
import { accounts, calculateHealthScore, healthBand } from '@/app/lib/lighthouse';
import { IconAlert, IconTrendUp, IconTrendDown } from '@/app/components/icons';
import { useRouter } from 'next/navigation';

type SortKey = 'health' | 'arr' | 'renewal' | 'delta';

export default function PortfolioPage() {
  const router = useRouter();
  const [sortBy, setSortBy] = React.useState<SortKey>('health');
  const [sortAsc, setSortAsc] = React.useState(true);

  const portfolioData = accounts.map(acc => {
    const health = calculateHealthScore(acc);
    const band = healthBand(health);
    const mauDelta = ((acc.mau[4] - acc.mau[0]) / acc.mau[0]) * 100;
    const daysToRenewal = Math.floor((new Date(acc.contract_end).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    
    return {
      ...acc,
      health,
      band,
      mauDelta,
      daysToRenewal,
      healthDelta: mauDelta,
    };
  });

  const escalations = portfolioData.filter(acc => acc.health < 50);
  const totalArr = accounts.reduce((sum, acc) => sum + acc.arr, 0);
  const avgHealth = portfolioData.reduce((sum, acc) => sum + acc.health, 0) / portfolioData.length;

  const sorted = [...portfolioData].sort((a, b) => {
    let comparison = 0;
    switch (sortBy) {
      case 'health': comparison = a.health - b.health; break;
      case 'arr': comparison = a.arr - b.arr; break;
      case 'renewal': comparison = a.daysToRenewal - b.daysToRenewal; break;
      case 'delta': comparison = a.healthDelta - b.healthDelta; break;
    }
    return sortAsc ? comparison : -comparison;
  });

  const handleSort = (key: SortKey) => {
    if (sortBy === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortBy(key);
      setSortAsc(key === 'health' || key === 'delta');
    }
  };

  const SortButton: React.FC<{ column: SortKey; label: string }> = ({ column, label }) => (
    <button
      onClick={() => handleSort(column)}
      className="eyebrow"
      style={{
        cursor: 'pointer',
        color: sortBy === column ? 'var(--beam-300)' : 'var(--fg-3)',
        display: 'flex',
        alignItems: 'center',
        gap: 4,
      }}
    >
      {label}
      {sortBy === column && <span style={{ fontSize: 10 }}>{sortAsc ? '↑' : '↓'}</span>}
    </button>
  );

  return (
    <div className="app-canvas">
      <div className="app-shell">
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontSize: 40, fontWeight: 600, color: 'var(--fg-1)', marginBottom: 8 }}>
            Portfolio Overview
          </h1>
          <div style={{ display: 'flex', gap: 32, marginTop: 16 }}>
            <div>
              <div className="eyebrow" style={{ marginBottom: 4 }}>Total Accounts</div>
              <div style={{ fontSize: 32, fontWeight: 600, color: 'var(--fg-1)', fontFamily: 'var(--font-mono)' }}>
                {accounts.length}
              </div>
            </div>
            <div>
              <div className="eyebrow" style={{ marginBottom: 4 }}>Total ARR</div>
              <div style={{ fontSize: 32, fontWeight: 600, color: 'var(--fg-1)', fontFamily: 'var(--font-mono)' }}>
                ${(totalArr / 1_000_000).toFixed(2)}M
              </div>
            </div>
            <div>
              <div className="eyebrow" style={{ marginBottom: 4 }}>Avg Health</div>
              <div style={{ fontSize: 32, fontWeight: 600, color: 'var(--beam-300)', fontFamily: 'var(--font-mono)' }}>
                {Math.round(avgHealth)}/100
              </div>
            </div>
            <div>
              <div className="eyebrow" style={{ marginBottom: 4 }}>Escalations</div>
              <div style={{ fontSize: 32, fontWeight: 600, color: 'var(--critical-fg)', fontFamily: 'var(--font-mono)' }}>
                {escalations.length}
              </div>
            </div>
          </div>
        </div>

        {escalations.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <IconAlert size={20} style={{ color: 'var(--critical-fg)' }} />
              <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--fg-1)' }}>
                This Week's Escalations
              </h2>
              <span className="pill pill--critical">{escalations.length}</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 12 }}>
              {escalations.map(acc => (
                <button
                  key={acc.id}
                  onClick={() => router.push(`/?account=${acc.id}`)}
                  className="card"
                  style={{
                    padding: 16,
                    textAlign: 'left',
                    cursor: 'pointer',
                    borderColor: 'var(--critical-line)',
                    background: 'linear-gradient(135deg, rgba(255,92,92,0.08), var(--surface-1))',
                    transition: 'all 150ms ease-out',
                  }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--critical-fg)'}
                  onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--critical-line)'}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--fg-1)' }}>{acc.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--fg-3)', marginTop: 2 }}>{acc.industry}</div>
                    </div>
                    <div className="pill pill--critical">
                      {acc.health}/100
                    </div>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--fg-2)', display: 'flex', gap: 16 }}>
                    <span>${(acc.arr / 1000).toFixed(0)}K ARR</span>
                    <span>•</span>
                    <span>{acc.daysToRenewal}d to renewal</span>
                    <span>•</span>
                    <span style={{ color: 'var(--critical-fg)' }}>
                      {acc.mauDelta < 0 ? '↓' : '↑'} {Math.abs(Math.round(acc.mauDelta))}% MAU
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-subtle)' }}>
            <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--fg-1)' }}>
              All Accounts
            </h2>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-subtle)', background: 'var(--surface-inset)' }}>
                <th style={{ padding: '12px 24px', textAlign: 'left' }}>
                  <div className="eyebrow">Account</div>
                </th>
                <th style={{ padding: '12px 16px', textAlign: 'left' }}>
                  <SortButton column="health" label="Health" />
                </th>
                <th style={{ padding: '12px 16px', textAlign: 'left' }}>
                  <SortButton column="delta" label="Trend" />
                </th>
                <th style={{ padding: '12px 16px', textAlign: 'right' }}>
                  <SortButton column="arr" label="ARR" />
                </th>
                <th style={{ padding: '12px 16px', textAlign: 'left' }}>
                  <div className="eyebrow">NPS</div>
                </th>
                <th style={{ padding: '12px 16px', textAlign: 'right' }}>
                  <SortButton column="renewal" label="Renewal" />
                </th>
                <th style={{ padding: '12px 24px', textAlign: 'left' }}>
                  <div className="eyebrow">Executive</div>
                </th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(acc => {
                const healthColor = acc.band === 'critical' ? 'var(--critical-fg)' :
                                   acc.band === 'high' ? 'var(--high-fg)' :
                                   acc.band === 'watch' ? 'var(--medium-fg)' : 'var(--healthy-fg)';
                return (
                  <tr
                    key={acc.id}
                    onClick={() => router.push(`/?account=${acc.id}`)}
                    style={{
                      borderBottom: '1px solid var(--border-subtle)',
                      cursor: 'pointer',
                      transition: 'background 120ms ease-out',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-2)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <td style={{ padding: '16px 24px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: 99,
                            background: healthColor,
                            boxShadow: acc.band === 'critical' ? `0 0 8px ${healthColor}` : 'none',
                          }}
                        />
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--fg-1)' }}>{acc.name}</div>
                          <div style={{ fontSize: 11, color: 'var(--fg-3)', marginTop: 2 }}>{acc.industry}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '16px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span
                          style={{
                            fontSize: 16,
                            fontWeight: 600,
                            color: healthColor,
                            fontFamily: 'var(--font-mono)',
                          }}
                        >
                          {acc.health}
                        </span>
                        <span style={{ fontSize: 12, color: 'var(--fg-4)' }}>/100</span>
                      </div>
                    </td>
                    <td style={{ padding: '16px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        {acc.mauDelta < -5 ? (
                          <IconTrendDown size={14} style={{ color: 'var(--critical-fg)' }} />
                        ) : acc.mauDelta > 5 ? (
                          <IconTrendUp size={14} style={{ color: 'var(--healthy-fg)' }} />
                        ) : (
                          <span style={{ fontSize: 14, color: 'var(--fg-4)' }}>⟶</span>
                        )}
                        <span
                          style={{
                            fontSize: 13,
                            fontFamily: 'var(--font-mono)',
                            color: acc.mauDelta < 0 ? 'var(--critical-fg)' : 'var(--healthy-fg)',
                          }}
                        >
                          {acc.mauDelta > 0 ? '+' : ''}{Math.round(acc.mauDelta)}%
                        </span>
                      </div>
                    </td>
                    <td style={{ padding: '16px 16px', textAlign: 'right' }}>
                      <span style={{ fontSize: 14, fontWeight: 600, fontFamily: 'var(--font-mono)', color: 'var(--fg-1)' }}>
                        ${(acc.arr / 1000).toFixed(0)}K
                      </span>
                    </td>
                    <td style={{ padding: '16px 16px' }}>
                      <span
                        style={{
                          fontSize: 13,
                          fontFamily: 'var(--font-mono)',
                          color: acc.nps < 40 ? 'var(--critical-fg)' : acc.nps < 60 ? 'var(--fg-2)' : 'var(--healthy-fg)',
                        }}
                      >
                        {acc.nps}
                      </span>
                    </td>
                    <td style={{ padding: '16px 16px', textAlign: 'right' }}>
                      <div>
                        <div
                          style={{
                            fontSize: 13,
                            fontFamily: 'var(--font-mono)',
                            color: acc.daysToRenewal < 90 ? 'var(--critical-fg)' : 'var(--fg-2)',
                          }}
                        >
                          {acc.daysToRenewal}d
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--fg-4)', marginTop: 2 }}>
                          {new Date(acc.contract_end).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '16px 24px' }}>
                      <div style={{ fontSize: 12, color: 'var(--fg-2)' }}>{acc.exec.split(',')[0]}</div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
