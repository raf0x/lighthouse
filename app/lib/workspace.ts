import { accounts, calculateHealthScore, bandLabel } from './lighthouse';
import { assessCase, currentReview, decisionLabels, operationCases, type Assessment, type AuditEntry, type CaseWorkspace, type Currency, type OperationCase } from './operations';
import type { Account } from '../components/types';

export const WORKSPACE_STORAGE_KEY = 'lighthouse-operations-v1';
export type Workspaces = Record<string, CaseWorkspace>;
export type CaseSummary = { input: OperationCase; assessment: Assessment; analyzed: boolean; planApproved: boolean; history: AuditEntry[] };
export type WorkspaceAccount = { id: string; name: string; initials: string; kind: 'partner' | 'customer'; cases: CaseSummary[]; customer?: Account };

// Explicit identity: an imported case gets its own account. Never merge customers by name.
export const accountIdForCase = (id: string) => `partner-${id}`;
export const accountHref = (id: string) => `/accounts?account=${encodeURIComponent(id)}`;
export const caseHref = (id: string, tab?: 'Activity' | 'Message drafts') => `/operations?case=${encodeURIComponent(id)}${tab ? `&tab=${encodeURIComponent(tab)}` : ''}`;
export function workspaceCases(workspaces: Workspaces): CaseSummary[] {
  const originals = [...Object.values(workspaces).flatMap(w => w.importedOriginal ? [w.importedOriginal] : []), ...operationCases];
  return originals.map(original => {
    const saved = workspaces[original.id], input = saved?.input ?? original;
    return { input, assessment: assessCase(input), analyzed: Boolean(saved?.analyzed), history: saved?.history ?? [],
      planApproved: Boolean(saved?.analyzed && saved.drafts && saved.review?.status === 'approved' && currentReview(input, saved.drafts, saved.review)) };
  });
}
export function workspaceAccounts(workspaces: Workspaces): WorkspaceAccount[] {
  return [...workspaceCases(workspaces).map(c => ({ id: accountIdForCase(c.input.id), name: c.input.account, initials: c.input.initials, kind: 'partner' as const, cases: [c] })),
    ...accounts.map(customer => ({ id: customer.id, name: customer.name, initials: customer.name.split(' ').slice(0, 2).map(n => n[0]).join(''), kind: 'customer' as const, cases: [], customer }))];
}
export function accountStatus(a: WorkspaceAccount) {
  if (a.customer) return bandLabel(calculateHealthScore(a.customer));
  const decision = a.cases.some(c => c.assessment.decision === 'blocked') ? 'blocked' : a.cases.some(c => c.assessment.decision === 'needs_information') ? 'needs_information' : 'ready_for_review';
  return decisionLabels[decision];
}
export function priorityCases(cases: CaseSummary[]) {
  const rank = (c: CaseSummary) => c.assessment.deadlineHours <= 0 ? 0 : c.assessment.decision !== 'ready_for_review' && c.assessment.deadlineHours <= 24 ? 1 : c.assessment.decision !== 'ready_for_review' ? 2 : 3;
  return cases.filter(c => !(c.planApproved && c.assessment.decision === 'ready_for_review')).sort((a,b) => rank(a) - rank(b) || a.assessment.deadlineHours - b.assessment.deadlineHours || a.input.id.localeCompare(b.input.id));
}
export function caseReason(c: CaseSummary) {
  const blockers = c.assessment.findings.filter(f => f.severity === 'blocker');
  return blockers.length ? blockers.map(f => f.title).join(' · ') : c.planApproved ? 'Plan reviewed. Ticket release still requires human review.' : 'The supplied evidence is ready for human review.';
}
export function deadlineLabel(c: CaseSummary) {
  const hours = c.assessment.deadlineHours;
  return hours <= 0 ? 'Deadline passed' : `${Number(hours.toFixed(1))}h remaining`;
}
export function portfolioTotals(cases: CaseSummary[]) {
  const currencies: Currency[] = ['USD', 'CAD', 'MXN'];
  return currencies.map(currency => {
    const matching = cases.filter(c => c.input.orderCurrency === currency);
    return { currency, total: matching.reduce((sum,c) => sum + c.input.orderAmountCents, 0), blocked: matching.filter(c => c.assessment.decision !== 'ready_for_review').reduce((sum,c) => sum + c.input.orderAmountCents, 0), count: matching.length };
  }).filter(t => t.count);
}
export function recentChanges(cases: CaseSummary[]) {
  return cases.flatMap(c => c.history.filter(e => e.evidence?.changes.length).map(event => ({ key: `${c.input.id}:${event.id}`, input: c.input, event })))
    .sort((a,b) => Date.parse(b.event.at) - Date.parse(a.event.at) || a.key.localeCompare(b.key));
}
export function changeSummary(event: AuditEntry) {
  const evidence = event.evidence;
  if (!evidence) return event.detail;
  const removed = evidence.before.findings.filter(f => !evidence.after.findings.includes(f));
  const added = evidence.after.findings.filter(f => !evidence.before.findings.includes(f));
  return [removed.length ? `Cleared: ${removed.join('; ')}.` : '', added.length ? `New: ${added.join('; ')}.` : '', !removed.length && !added.length ? `${evidence.changes.length} field${evidence.changes.length === 1 ? '' : 's'} changed; the findings stayed the same.` : '', evidence.previousReview ? 'Previous approval or review cleared.' : ''].filter(Boolean).join(' ');
}
