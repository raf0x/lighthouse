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
  const health = calculateHealthScore(account);
  const summary = `${account.name}: sample health ${health}/100 (${bandLabel(health)}), ${seatPct}% seats active, NPS ${account.nps}, and ${account.tickets_30d} tickets in the sample 30-day window. Usage changes ${mauDelta > 0 ? '+' : ''}${mauDelta}% across five sample periods; these figures do not establish a cause or predict renewal.`;
  const nextActions = [
    `Ask ${account.exec.split(',')[0]} to validate the sample signals and identify one current priority.`,
    health < 70 ? 'Agree on one adoption or support recovery milestone before discussing expansion.' : 'Confirm value delivered and unmet needs before discussing expansion.',
    'Validate contract dates, budget, and decision makers with the customer; no current deadline is inferred from historical fields.',
  ];
  if (type === 'email') return {
    subject: `Account review — ${account.name}`,
    body: `Hi ${account.exec.split(',')[0]},\n\nIn this fictional example, ${seatPct}% of seats are active and usage changes ${mauDelta}% across five sample periods. I would like to understand whether these figures reflect your team's experience and which outcome matters most to you next.\n\nCould we review the context and agree on one useful next step?\n\nBest,\nThe CSM team`,
  };
  if (type === 'expansion') return {
    summary: `${summary} Pricing, budget, and purchase intent are not supplied, so no ARR lift is estimated.`,
    opportunities: [{ title: health < 70 ? 'Validate value before expansion' : 'Explore unmet needs', business_case: 'A discovery conversation is a hypothesis to test, not an identified sales opportunity.', approach: nextActions[1] }],
  };
  if (type === 'briefing') return { summary, next_actions: nextActions };
  return {
    summary,
    risks: mauDelta < 0 ? [{ title: 'Sample usage decline', description: `${Math.abs(mauDelta)}% fewer monthly active users between the first and last sample periods. The cause is unknown.`, severity: 'Medium' }] : [],
    positives: mauDelta >= 0 ? [{ title: 'Sample usage growth', description: `${mauDelta}% more monthly active users between the first and last sample periods. Validate continued value with the customer.` }] : [],
    recommendation: { title: 'Validate the story with the customer', description: nextActions.join(' ') },
  };
}
