// Shared types for the Lighthouse dashboard.

export type Account = {
  id: string;
  name: string;
  arr: number;
  contract_end: string;
  seats_total: number;
  seats_active: number;
  mau: number[];               // 5-month trailing
  tickets_30d: number;
  nps: number;
  last_qbr: string;
  exec: string;
  industry: string;
};

export type Band = 'critical' | 'high' | 'watch' | 'healthy';
export type AnalysisType = 'health' | 'expansion' | 'briefing' | 'email';

export type Risk = { title: string; description: string; severity: 'Critical' | 'High' | 'Medium' };
export type Positive = { title: string; description: string };
export type Opportunity = {
  title: string;
  description?: string;
  business_case?: string;
  arr_lift?: string;
  approach?: string;
};
export type Recommendation = { title: string; description: string; cta?: string };

export type Analysis = {
  summary?: string;
  risks?: Risk[];
  positives?: Positive[];
  opportunities?: Opportunity[];
  next_actions?: string[];
  recommendation?: Recommendation;
  subject?: string;
  body?: string;
};
