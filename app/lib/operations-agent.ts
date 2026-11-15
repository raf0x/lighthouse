import { assessCase, evidenceFor, inputSignature, operationCases, validCase, type Decision, type Drafts, type OperationCase } from './operations';

export const AGENT_VERSION = 'investigator-v3';
export const REVIEW_NOTICE = 'Ticket release is not confirmed and requires human review.';
export const AGENT_MODEL = 'claude-sonnet-4-6';
export const AGENT_LIMITS = { modelCalls: 4, outputTokensPerCall: 2400, contextCharacters: 60000, timeoutMs: 90000, bodyBytes: 12000 } as const;
export const SOURCE_IDS = ['account', 'order', 'invoice', 'payment', 'crm', 'policy'] as const;
export const FINDING_IDS = ['entity_missing', 'entity_mismatch', 'duplicate_invoice', 'invoice_currency', 'invoice_amount', 'payment_conflict', 'payment_missing', 'payment_pending', 'reference_missing', 'payment_currency', 'payment_amount', 'deadline_elapsed', 'deadline_near'] as const;
export const OWNERS = ['Finance', 'Partner Operations', 'Ticketing Operations'] as const;
export type AgentCitation = { sourceId: string; field: string; value: string };
export type AgentReport = {
  decision: Decision; summary: string;
  findings: { id: string; explanation: string; sourceIds: string[] }[];
  citations: AgentCitation[];
  questions: { findingId: string; question: string; owner: string }[];
  recommendation: string; owner: string; drafts: Drafts;
};
export type AgentTrace = { step: number; kind: 'model' | 'tool' | 'validation'; name: string; detail: string; ok: boolean };
export type AgentUsage = { inputTokens: number; outputTokens: number; modelCalls: number; estimatedUsd: number };
export type AgentRun = {
  version: typeof AGENT_VERSION; runId: string; caseId: string; inputSignature: string; model: string;
  completedAt: string; elapsedMs: number; report: AgentReport; trace: AgentTrace[]; usage: AgentUsage;
  validationAttempts: number; firstSubmissionPassed: boolean;
};
export type AgentFailure = { error: string; code: string; trace?: AgentTrace[]; usage?: AgentUsage };
export type AgentAvailability = { enabled: boolean; reason: string; model: string; limits: typeof AGENT_LIMITS };

const object = (v: unknown): v is Record<string, unknown> => Boolean(v && typeof v === 'object' && !Array.isArray(v));
const text = (v: unknown, max: number) => typeof v === 'string' && v.trim().length > 0 && v.length <= max;
const normalizeQuote = (s: string) => s.trim().replace(/\s+/g, ' ');
export function canonicalAgentCase(value: unknown): OperationCase | null {
  if (!validCase(value)) return null;
  const original = operationCases.find(c => c.id === value.id)!;
  const hours = (Date.parse(value.deadline) - Date.parse(original.asOf)) / 3_600_000;
  if (hours < -168 || hours > 720) return null;
  // Allow only the fields exposed by the evidence editor. Never forward arbitrary client properties.
  return { ...original, approvedEntity: value.approvedEntity, deadline: value.deadline,
    invoice: { ...original.invoice, entity: value.invoice.entity, amountCents: value.invoice.amountCents, currency: value.invoice.currency },
    payment: { status: value.payment.status, amountCents: value.payment.amountCents, currency: value.payment.currency, reference: value.payment.reference },
    duplicateInvoiceId: value.duplicateInvoiceId, crmPaymentStatus: value.crmPaymentStatus };
}

export function validateAgentReport(value: unknown, input: OperationCase, readIds: ReadonlySet<string>): { report?: AgentReport; errors: string[] } {
  if (!object(value)) return { errors: ['Submit an object matching the report schema.'] };
  const expected = assessCase(input);
  const errors: string[] = [];
  if (SOURCE_IDS.some(id => !readIds.has(id))) errors.push('Read all six source records in an earlier tool turn before submitting.');
  if (value.decision !== expected.decision) errors.push(`Decision must be ${expected.decision} under the supplied policy. Recheck the underlying findings and revise all affected prose.`);
  if (!text(value.summary, 1200) || !text(value.recommendation, 1000)) errors.push('Provide a concise summary and action within the text limits.');
  if (value.owner !== expected.owner) errors.push(`The first blocking category assigns the primary owner to ${expected.owner}; do not copy the account owner.`);
  if (!object(value.drafts) || !text(value.drafts.internal, 4000) || !text(value.drafts.client, 3000)) errors.push('Provide both bounded, nonempty message drafts.');
  else if (![value.drafts.internal, value.drafts.client].every(d => typeof d === 'string' && d.includes(REVIEW_NOTICE))) errors.push(`Both drafts must include this exact boundary: "${REVIEW_NOTICE}" Do not contradict it elsewhere.`);
  const findings = value.findings;
  if (!Array.isArray(findings) || findings.length > FINDING_IDS.length) errors.push('Findings must be a bounded array.');
  else {
    const ids = findings.map(f => object(f) ? f.id : undefined);
    const expectedIds = expected.findings.map(f => f.id);
    const missing = expectedIds.filter(id => !ids.includes(id));
    const unsupported = ids.filter(id => !expectedIds.includes(id as string)).map(id => FINDING_IDS.includes(id as typeof FINDING_IDS[number]) ? id : 'unknown category');
    if (new Set(ids).size !== ids.length) errors.push('Remove duplicate finding categories.');
    if (missing.length || unsupported.length) errors.push(`Reconcile finding categories with the records: missing [${missing.join(', ')}]; unsupported [${unsupported.join(', ')}]. Re-read relevant records and revise the explanation, questions, action, and drafts; do not only change category labels.`);
    for (const f of findings) {
      if (!object(f) || !text(f.explanation, 800) || !Array.isArray(f.sourceIds) || !f.sourceIds.length || f.sourceIds.length > 6 || f.sourceIds.some(id => typeof id !== 'string' || !readIds.has(id))) { errors.push('Each finding needs a concise explanation and source IDs that were read.'); continue; }
      const matching = expected.findings.find(e => e.id === f.id);
      if (matching && matching.sources.some(id => !(f.sourceIds as unknown[]).includes(id))) errors.push(`Finding ${f.id} must cite its relevant records and release policy.`);
    }
  }
  const docs = evidenceFor(input);
  const citations = value.citations;
  if (!Array.isArray(citations) || citations.length < 6 || citations.length > 30) errors.push('Supply 6–30 exact field citations covering all six sources.');
  else {
    const seen = new Set<string>();
    for (const citation of citations) {
      if (!object(citation) || !text(citation.sourceId, 30) || !text(citation.field, 100) || !text(citation.value, 700)) { errors.push('A citation is malformed.'); continue; }
      const doc = docs.find(d => d.id === citation.sourceId);
      const field = doc?.fields.find(f => f.label === citation.field);
      if (!readIds.has(String(citation.sourceId)) || !field || normalizeQuote(field.value) !== normalizeQuote(String(citation.value))) errors.push(`Citation does not match the supplied record: ${citation.sourceId}/${citation.field}.`);
      else seen.add(String(citation.sourceId));
    }
    if (SOURCE_IDS.some(id => !seen.has(id))) errors.push('Citations must cover each of the six source records.');
  }
  const questions = value.questions;
  if (!Array.isArray(questions) || questions.length > 8) errors.push('Questions must be a bounded array.');
  else {
    for (const q of questions) if (!object(q) || !expected.findings.some(f => f.id === q.findingId) || !text(q.question, 500) || !OWNERS.includes(q.owner as typeof OWNERS[number])) errors.push('Questions must identify an actual finding and a responsible team.');
    for (const f of expected.findings.filter(f => ['entity_missing', 'payment_missing', 'payment_conflict', 'reference_missing'].includes(f.id))) if (!questions.some(q => object(q) && q.findingId === f.id)) errors.push(`Ask a specific clarification question for ${f.id}.`);
  }
  const narrative = [value.summary, value.recommendation, ...(Array.isArray(findings) ? findings.map(f => f?.explanation) : []), ...(Array.isArray(questions) ? questions.map(q => q?.question) : []), object(value.drafts) && value.drafts.internal, object(value.drafts) && value.drafts.client].filter(v => typeof v === 'string').join('\n');
  if (/https?:\/\/|\b(?:I|we) (?:have |already )?(?:sent|released|issued|updated|reissued|refunded)\b/i.test(narrative)) errors.push('Do not invent external links or claim that actions have been executed.');
  if (/\b(?:tickets?|allocation|order)\b[^.!?\n]{0,45}\b(?:are|is|have been|has been) (?:already )?approved\b|\b(?:we|I) (?:will|can|shall) (?:(?:proceed with|be) )?(?:releas\w*|approv\w*)\b|\b(?:we|I) (?:will|can|shall) confirm (?:the )?ticket release\b|\bproceed with (?:the )?ticket release\b|\b(?:approve|authorize) (?:the )?ticket allocation\b|\b(?:release|allocation) (?:is|has been) (?:confirmed|approved|guaranteed)\b/i.test(narrative)) errors.push('The proposed text implies approval or promises ticket release. Only propose a human release review; never approve allocation, promise release, or say approval already exists.');
  if (/[<>]/.test(narrative)) errors.push('Use plain prose without markup fragments or angle brackets.');
  if (/"(?:decision|summary|owner|drafts|internal|client|findings|citations)"\s*:/.test(narrative)) errors.push('A prose field contains serialized report properties. Keep each value in its own schema field; return a complete report with plain-language text.');
  if (errors.length) return { errors: [...new Set(errors)] };
  // Project the permitted fields; unknown model-generated properties never enter application state.
  const r = value as unknown as AgentReport;
  return { errors: [], report: { decision: r.decision, summary: r.summary, recommendation: r.recommendation, owner: r.owner,
    findings: r.findings.map(f => ({ id: f.id, explanation: f.explanation, sourceIds: [...new Set(f.sourceIds)] })),
    citations: r.citations.map(c => ({ sourceId: c.sourceId, field: c.field, value: c.value })),
    questions: r.questions.map(q => ({ findingId: q.findingId, question: q.question, owner: q.owner })), drafts: { internal: r.drafts.internal, client: r.drafts.client } } };
}

export function agentAvailability(env: Record<string, string | undefined>): AgentAvailability {
  const enabled = env.VERCEL_ENV !== 'production' && env.LIGHTHOUSE_AGENT_ENABLED === 'true' && Boolean(env.ANTHROPIC_API_KEY);
  return { enabled, reason: enabled ? 'Live investigation is enabled in this review environment.' : env.VERCEL_ENV === 'production' ? 'Live investigation is available in the private review preview. Local policy checks remain available here.' : 'Live investigation is not enabled in this environment.', model: AGENT_MODEL, limits: AGENT_LIMITS };
}
export function estimateUsage(inputTokens: number, outputTokens: number, modelCalls: number): AgentUsage {
  // Standard uncached Sonnet 4.6 list prices, verified 2026-11-15. Not an invoice or account-wide cap.
  return { inputTokens, outputTokens, modelCalls, estimatedUsd: (inputTokens * 3 + outputTokens * 15) / 1_000_000 };
}
export function restoreAgentRun(value: unknown, input: OperationCase): AgentRun | null {
  if (!object(value) || value.version !== AGENT_VERSION || value.caseId !== input.id || value.inputSignature !== inputSignature(input) || value.model !== AGENT_MODEL || !text(value.runId, 100) || !text(value.completedAt, 40) || !Number.isFinite(Date.parse(String(value.completedAt))) || typeof value.elapsedMs !== 'number' || value.elapsedMs < 0 || !object(value.usage)) return null;
  const u = value.usage;
  if (![u.inputTokens, u.outputTokens, u.modelCalls, value.validationAttempts].every(n => Number.isSafeInteger(n) && Number(n) >= 0) || Number(u.modelCalls) < 1 || Number(u.modelCalls) > AGENT_LIMITS.modelCalls || Number(u.outputTokens) > AGENT_LIMITS.modelCalls * AGENT_LIMITS.outputTokensPerCall || typeof value.firstSubmissionPassed !== 'boolean') return null;
  if (!Array.isArray(value.trace) || value.trace.length > 40 || !value.trace.every(t => object(t) && Number.isInteger(t.step) && ['model','tool','validation'].includes(String(t.kind)) && text(t.name, 100) && text(t.detail, 2000) && typeof t.ok === 'boolean')) return null;
  const checked = validateAgentReport(value.report, input, new Set(SOURCE_IDS));
  if (!checked.report) return null;
  return { ...(value as unknown as AgentRun), report: checked.report, usage: estimateUsage(Number(u.inputTokens), Number(u.outputTokens), Number(u.modelCalls)) };
}
