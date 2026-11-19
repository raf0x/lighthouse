import { accounts, calculateHealthScore, bandLabel } from './lighthouse';
import {
  ENGINE_VERSION, MAX_WORKSPACE_CHARACTERS, assessCase, currentReview, decisionLabels, inputSignature,
  operationCases, recordReview, restoreWorkspaces,
  type Assessment, type AuditEntry, type CaseReview, type CaseWorkspace, type Currency,
  type Drafts, type OperationCase, type ReviewStatus,
} from './operations';
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
  return [removed.length ? `No longer flagged: ${removed.join('; ')}.` : '', added.length ? `New: ${added.join('; ')}.` : '', !removed.length && !added.length ? `${evidence.changes.length} field${evidence.changes.length === 1 ? '' : 's'} changed; the findings stayed the same.` : '', evidence.previousReview ? 'Previous approval or review cleared.' : ''].filter(Boolean).join(' ');
}

/** The exact case and both messages visible when a human opens a review. */
export type ReviewSnapshot = { caseId: string; inputSignature: string; draftSignature: string };
export const STALE_REVIEW_MESSAGE = 'This case evidence or its message drafts changed. Review the current version and open a new confirmation.';
export class StaleReviewError extends Error {
  constructor() { super(STALE_REVIEW_MESSAGE); this.name = 'StaleReviewError'; }
}
export function captureReviewSnapshot(input: OperationCase, drafts: Drafts): ReviewSnapshot {
  return { caseId: input.id, inputSignature: inputSignature(input), draftSignature: JSON.stringify(drafts) };
}
export function matchesReviewSnapshot(snapshot: ReviewSnapshot, input: OperationCase, drafts?: Drafts): boolean {
  return Boolean(drafts && snapshot.caseId === input.id &&
    snapshot.inputSignature === inputSignature(input) &&
    snapshot.draftSignature === JSON.stringify(drafts));
}

/** Read, compare, and write the authoritative browser-local case synchronously.
 * An unrelated case may change while a form is open; its saved update survives.
 */
export function writeCurrentReview(
  storage: Pick<Storage, 'getItem' | 'setItem'>,
  snapshot: ReviewSnapshot, reviewer: string, status: ReviewStatus, note: string, at: string,
): { workspaces: Workspaces; serialized: string; review: CaseReview } {
  const raw = storage.getItem(WORKSPACE_STORAGE_KEY);
  const latest = restoreWorkspaces(raw);
  const saved = latest[snapshot.caseId];
  if (!raw || !saved?.analyzed || !matchesReviewSnapshot(snapshot, saved.input, saved.drafts)) {
    throw new StaleReviewError();
  }
  const review = recordReview(saved.input, assessCase(saved.input), saved.drafts!, reviewer, status, note, at);
  const entry: AuditEntry = {
    id: Date.now() + '-' + Math.random().toString(36).slice(2, 8),
    at, event: status === 'approved' ? 'Plan approved locally' : 'Changes requested',
    detail: review.reviewer + ': ' + (review.note || 'Reviewed this evidence and these drafts.') + ' Nothing sent or released.',
  };
  const workspaces: Workspaces = {
    ...latest, [snapshot.caseId]: {
      ...saved, review, history: [...saved.history, entry].slice(-100),
    },
  };
  const serialized = JSON.stringify({ version: ENGINE_VERSION, cases: workspaces });
  if (serialized.length > MAX_WORKSPACE_CHARACTERS) throw new Error('Workspace size limit. The review was not recorded.');
  storage.setItem(WORKSPACE_STORAGE_KEY, serialized);
  return { workspaces, serialized, review };
}
