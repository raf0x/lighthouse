// app/lib/lighthouse.ts
// Typed accounts + health helpers + mock agent fallback.

import type { Account, AnalysisType, Analysis, Band } from '@/app/components/types';

export const accounts: Account[] = [
  { id: 'ACC001', name: 'Meridian Financial',   arr: 450000, contract_end: '2026-06-01', seats_total: 500,  seats_active: 420, mau: [380, 395, 420, 415, 410], tickets_30d: 12, nps: 42, last_qbr: '2025-01-15', exec: 'Sarah Chen, CTO',           industry: 'Financial Services' },
  { id: 'ACC002', name: 'Atlas Logistics',      arr: 680000, contract_end: '2026-03-15', seats_total: 800,  seats_active: 720, mau: [650, 680, 710, 720, 715], tickets_30d:  8, nps: 68, last_qbr: '2025-02-20', exec: 'Michael Rodriguez, VP Ops',  industry: 'Supply Chain' },
  { id: 'ACC003', name: 'Velocity Healthcare',  arr: 320000, contract_end: '2027-01-10', seats_total: 300,  seats_active: 145, mau: [180, 165, 150, 145, 140], tickets_30d: 22, nps: 28, last_qbr: '2024-10-05', exec: 'Dr. Lisa Patel, CMO',        industry: 'Healthcare' },
  { id: 'ACC004', name: 'Quantum Media',        arr: 520000, contract_end: '2026-09-01', seats_total: 600,  seats_active: 580, mau: [540, 555, 570, 580, 575], tickets_30d:  5, nps: 72, last_qbr: '2025-03-10', exec: 'James Park, CDO',            industry: 'Media' },
  { id: 'ACC005', name: 'Sterling Insurance',   arr: 410000, contract_end: '2026-04-20', seats_total: 450,  seats_active: 380, mau: [360, 370, 380, 375, 380], tickets_30d: 14, nps: 55, last_qbr: '2025-01-28', exec: 'Karen Liu, SVP Tech',        industry: 'Insurance' },
  { id: 'ACC006', name: 'Nexus Manufacturing',  arr: 290000, contract_end: '2027-02-15', seats_total: 350,  seats_active: 310, mau: [285, 295, 305, 310, 308], tickets_30d:  9, nps: 61, last_qbr: '2025-02-01', exec: 'Robert Hassan, Dir Ops',     industry: 'Manufacturing' },
  { id: 'ACC007', name: 'Horizon Retail',       arr: 750000, contract_end: '2026-08-01', seats_total: 1000, seats_active: 520, mau: [580, 560, 540, 520, 510], tickets_30d: 18, nps: 38, last_qbr: '2024-11-15', exec: 'Amanda Foster, CIO',         industry: 'Retail' },
  { id: 'ACC008', name: 'Cascade Energy',       arr: 590000, contract_end: '2026-07-01', seats_total: 650,  seats_active: 610, mau: [580, 590, 600, 610, 615], tickets_30d:  6, nps: 65, last_qbr: '2025-03-05', exec: 'Thomas Wright, VP Eng',      industry: 'Energy' },
];

export function calculateHealthScore(acc: Account): number {
  const seatUtil = acc.seats_active / acc.seats_total;
  const mauTrend = (acc.mau[4] - acc.mau[0]) / acc.mau[0];
  const ticketPenalty = Math.min(acc.tickets_30d / 20, 1);
  const npsNormalized = (acc.nps + 100) / 200;
  const score = (seatUtil * 30) + (Math.max(mauTrend + 1, 0) * 20) + ((1 - ticketPenalty) * 20) + (npsNormalized * 30);
  return Math.round(Math.min(Math.max(score, 0), 100));
}

export function healthBand(score: number): Band {
  if (score >= 70) return 'healthy';
  if (score >= 50) return 'watch';
  if (score >= 30) return 'high';
  return 'critical';
}

export function bandLabel(score: number): string {
  if (score >= 70) return 'Healthy';
  if (score >= 50) return 'Watch';
  if (score >= 30) return 'High Risk';
  return 'Critical Risk';
}

export function bandColor(band: Band): string {
  const map = { critical: 'var(--critical-fg)', high: 'var(--high-fg)', watch: 'var(--medium-fg)', healthy: 'var(--healthy-fg)' };
  return map[band];
}

export function mockAnalysis(account: Account, type: AnalysisType): Analysis {
  const seatPct = Math.round((account.seats_active / account.seats_total) * 100);
  const mauDelta = Math.round(((account.mau[4] - account.mau[0]) / account.mau[0]) * 100);
  const declining = mauDelta < 0;
  const health = calculateHealthScore(account);
  const critical = health < 30;

  if (type === 'health') {
    return {
      summary: `${account.name} is ${critical ? 'critically at-risk' : (health < 70 ? 'showing early warning signals' : 'in healthy territory')} with ${declining ? `a ${Math.abs(mauDelta)}% decline` : `${mauDelta}% growth`} in monthly active users, ${seatPct}% seat utilization, and an NPS of ${account.nps}.`,
      risks: critical || health < 50 ? [
        { title: 'Accelerating MAU Decline', description: `${Math.abs(mauDelta)}% drop over 5 months — engagement falling across all cohorts.`, severity: 'Critical' },
        { title: 'Severe Seat Underutilization', description: `${100 - seatPct}% of licensed seats are inactive — value perception eroding.`, severity: 'High' },
        { title: 'Elevated Support Burden', description: `${account.tickets_30d} open tickets in 30d · NPS ${account.nps}`, severity: 'High' },
      ] : [],
      positives: !critical ? [
        { title: 'Stable executive sponsorship', description: `${account.exec} engaged via QBR in the last cycle.` },
        { title: 'Above-cohort NPS', description: `NPS ${account.nps} sits in the top tertile of the portfolio.` },
      ] : [],
      recommendation: {
        title: critical ? 'Escalate to executive sponsor' : 'Schedule expansion-readiness review',
        description: critical
          ? `${account.exec} has not been in active contact since the last QBR (${account.last_qbr}). A direct executive ask now is the highest-leverage move before renewal conversations begin.`
          : `${account.name} shows expansion-ready signals. Propose a value review to confirm budget and timeline for FY25.`,
        cta: critical ? 'View Action Plan' : 'Open Expansion Brief',
      },
    };
  }

  if (type === 'expansion') {
    return {
      summary: `${account.name} has ${critical ? 'limited near-term expansion capacity' : 'two material expansion paths'} given current usage patterns and industry benchmark.`,
      opportunities: [
        { title: 'Seat True-up', business_case: `Active users have plateaued ${seatPct < 80 ? 'below' : 'near'} contracted seat count — true-up clauses are due at renewal.`, arr_lift: `+$${Math.round(account.arr * 0.18 / 1000)}K`, approach: 'Anchor on contractual true-up; surface usage data in the QBR deck.' },
        { title: 'Premium Tier Upgrade', business_case: `${account.industry} cohort accounts on premium see 2.1× the NPS uplift of standard.`, arr_lift: `+$${Math.round(account.arr * 0.32 / 1000)}K`, approach: 'Pilot premium for 90 days against a single business unit.' },
      ],
    };
  }

  if (type === 'briefing') {
    return {
      summary: `${account.name} (${account.industry}) — ARR $${(account.arr / 1000).toFixed(0)}K, health ${health}/100. ${critical ? 'IMMEDIATE intervention recommended.' : (health < 70 ? 'On watch list.' : 'Performing in line with portfolio.')}`,
      risks: critical ? [{ title: 'Renewal at risk', description: 'Renewal cycle begins in 90 days against falling engagement.', severity: 'Critical' }] : [],
      opportunities: !critical ? [{ title: 'Premium tier expansion', description: `Industry cohort suggests upside of $${Math.round(account.arr * 0.32 / 1000)}K.` }] : [],
      next_actions: [
        critical ? 'Executive escalation within 48 hours' : 'Confirm expansion budget',
        'Schedule QBR with sponsor',
        'Surface usage report ahead of next renewal touch',
      ],
    };
  }

  return {
    subject: critical ? `Velocity check — ${account.name} renewal preparation` : `Q2 partnership review — ${account.name}`,
    body: critical
      ? `Hi ${account.exec.split(',')[0]},\n\nIt's been since ${account.last_qbr} that we last connected formally, and I wanted to flag a few patterns we're seeing on the ${account.name} account before the renewal cycle ramps up.\n\nMonthly active users have declined ${Math.abs(mauDelta)}% over the last five months, and seat utilization is sitting at ${seatPct}%. I'd like to put 30 minutes on the calendar this week to walk through the data and align on a path forward — including any blockers from your side we should know about.\n\nI'll send a few times shortly. Thanks for the partnership.\n\nBest,\nthe CSM team`
      : `Hi ${account.exec.split(',')[0]},\n\nQuick note as we approach the next QBR — the ${account.name} engagement continues to track well, with MAU up ${mauDelta}% and NPS of ${account.nps}.\n\nWe think there's a clear case for expanding into the Premium tier next cycle. Would you have 20 minutes in the next two weeks to review?\n\nBest,\nthe CSM team`,
  };
}
