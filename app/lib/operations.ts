/** A deterministic, inspectable baseline. No model, employer data, or external writes. */
export const ENGINE_VERSION = 'operations-v1';
export const SCENARIO_TIME = '2026-11-15T14:00:00.000Z';
export type Currency = 'USD' | 'CAD' | 'MXN';
export type PaymentState = 'missing' | 'pending' | 'cleared';
export type Decision = 'blocked' | 'needs_information' | 'ready_for_review';
export type ReviewStatus = 'approved' | 'changes_requested';
export type OperationCase = {
  id: string; account: string; initials: string; color: string; scenario: string; description: string;
  asOf: string; owner: string; approvedEntity: string; orderId: string;
  orderAmountCents: number; orderCurrency: Currency; tickets: number; deadline: string;
  invoice: { id: string; entity: string; amountCents: number; currency: Currency };
  duplicateInvoiceId: string;
  payment: { status: PaymentState; amountCents: number; currency: Currency; reference: string };
  crmPaymentStatus: PaymentState;
};
export type EvidenceDocument = { id: string; title: string; source: string; fields: { label: string; value: string }[] };
export type Finding = { id: string; title: string; detail: string; severity: 'blocker' | 'attention'; sources: string[]; action: string; owner: string };
export type Check = { id: string; name: string; outcome: string; sources: string[] };
export type Drafts = { internal: string; client: string };
export type Assessment = {
  engineVersion: string; caseId: string; inputSignature: string; decision: Decision; headline: string;
  summary: string; findings: Finding[]; checks: Check[]; drafts: Drafts;
  recommendation: string; owner: string; deadlineHours: number;
};
export type AuditEntry = { id: string; at: string; event: string; detail: string };
export type CaseReview = { status: ReviewStatus; reviewer: string; note: string; at: string; inputSignature: string; draftSignature: string };
export type DraftOrigin = { model: string; runId: string; completedAt: string };
export type CaseWorkspace = { input: OperationCase; analyzed: boolean; drafts?: Drafts; draftOrigin?: DraftOrigin; review?: CaseReview; history: AuditEntry[] };
export const decisionLabels: Record<Decision, string> = { blocked: 'Action needed', needs_information: 'Evidence needed', ready_for_review: 'Ready for review' };

export function money(cents: number, currency: Currency) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, currencyDisplay: 'code', maximumFractionDigits: 2 }).format(cents / 100);
}
export function scenarioDate(iso: string) {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York', timeZoneName: 'short' }).format(new Date(iso));
}
const hoursAfter = (hours: number) => new Date(Date.parse(SCENARIO_TIME) + hours * 3_600_000).toISOString();
function sample(n: number, account: string, initials: string, scenario: string, description: string): OperationCase {
  return {
    id: `OPS-${100 + n}`, account, initials, color: ['#177a70', '#386cc4', '#9a5aa6', '#ae6939'][n % 4], scenario, description,
    asOf: SCENARIO_TIME, owner: 'Partner Operations', approvedEntity: `${account} US, Inc.`,
    orderId: `ORD-${2400 + n}`, orderAmountCents: 4_800_000, orderCurrency: 'USD', tickets: 160, deadline: hoursAfter(72),
    invoice: { id: `INV-${7600 + n}`, entity: `${account} US, Inc.`, amountCents: 4_800_000, currency: 'USD' },
    duplicateInvoiceId: '', payment: { status: 'cleared', amountCents: 4_800_000, currency: 'USD', reference: `PAY-${5300 + n}` }, crmPaymentStatus: 'cleared',
  };
}
export const operationCases: OperationCase[] = (() => {
  const a = sample(1, 'Portside Collectibles', 'PC', 'Invoice entity mismatch', 'The partner cannot process its ticket invoice because the billing entity differs from the approved account record.');
  a.invoice.entity = 'Portside Collectibles Canada, Ltd.'; a.payment.status = 'pending'; a.crmPaymentStatus = 'pending'; a.deadline = hoursAfter(20);
  const b = sample(2, 'Atlas Sports', 'AS', 'Missing payment evidence', 'An order is waiting for payment confirmation, but the payment ledger contains no matching receipt.');
  b.payment = { status: 'missing', amountCents: 0, currency: 'USD', reference: '' }; b.crmPaymentStatus = 'missing';
  const c = sample(3, 'Mariner Hospitality', 'MH', 'Conflicting payment records', 'The CRM marks this order paid while the finance ledger still shows a pending transfer.');
  c.payment.status = 'pending';
  const d = sample(4, 'Cedar Events', 'CE', 'Deadline approaching', 'The invoice and order match, but the transfer is pending and the allocation deadline is four hours away.');
  d.payment.status = 'pending'; d.crmPaymentStatus = 'pending'; d.deadline = hoursAfter(4);
  const e = sample(5, 'Northstar Media', 'NM', 'Ready for release review', 'The approved entity, invoice, order, and cleared payment agree. A person still needs to review release.');
  const f = sample(6, 'Bayview Partners', 'BP', 'Partial payment', 'A cleared payment is linked to the right order, but the received amount does not cover the full invoice.');
  f.payment.amountCents = 3_000_000;
  const g = sample(7, 'Solstice Travel', 'ST', 'Currency mismatch', 'The order is denominated in USD while the invoice and payment record are denominated in CAD.');
  g.invoice.currency = 'CAD'; g.payment.currency = 'CAD';
  const h = sample(8, 'Coastline Foods', 'CF', 'Duplicate active invoice', 'Two active invoice IDs are attached to the same order. Finance must establish which one is valid.');
  h.duplicateInvoiceId = 'INV-7608-B';
  const i = sample(9, 'Meridian Sponsors', 'MS', 'Missing approved entity', 'The account record has no approved billing entity, so the invoice cannot be verified against it.');
  i.approvedEntity = '';
  const j = sample(10, 'Harbor City Events', 'HC', 'Deadline elapsed', 'Payment is cleared, but the allocation deadline has passed. Availability and any exception require a fresh decision.');
  j.deadline = hoursAfter(-3);
  return [a,b,c,d,e,f,g,h,i,j];
})();

const currencies: string[] = ['USD', 'CAD', 'MXN'];
const states: string[] = ['missing', 'pending', 'cleared'];
const shortText = (v: unknown) => typeof v === 'string' && v.length <= 500;
const cents = (v: unknown) => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0 && v <= 1_000_000_000;
export function validCase(value: unknown): value is OperationCase {
  const c = value as OperationCase;
  if (!c || typeof c !== 'object' || !c.invoice || !c.payment) return false;
  const original = operationCases.find(item => item.id === c.id);
  if (!original) return false;
  return c.account === original.account && c.asOf === original.asOf && c.orderId === original.orderId
    && c.orderAmountCents === original.orderAmountCents && c.orderCurrency === original.orderCurrency && c.tickets === original.tickets
    && [c.approvedEntity, c.invoice.entity, c.invoice.id, c.duplicateInvoiceId, c.payment.reference, c.owner].every(shortText)
    && c.invoice.id === original.invoice.id && cents(c.invoice.amountCents) && c.invoice.amountCents > 0 && cents(c.payment.amountCents)
    && currencies.includes(c.invoice.currency) && currencies.includes(c.payment.currency)
    && states.includes(c.payment.status) && states.includes(c.crmPaymentStatus)
    && typeof c.deadline === 'string' && Number.isFinite(Date.parse(c.deadline)) && c.deadline.length <= 30;
}
export function inputSignature(c: OperationCase) {
  // Keep exact evidence, rather than a collision-prone short hash, for local review provenance.
  return JSON.stringify([ENGINE_VERSION, c.id, c.asOf, c.approvedEntity, c.orderId, c.orderAmountCents, c.orderCurrency, c.tickets, c.deadline, c.invoice.id, c.invoice.entity, c.invoice.amountCents, c.invoice.currency, c.duplicateInvoiceId, c.payment.status, c.payment.amountCents, c.payment.currency, c.payment.reference, c.crmPaymentStatus, c.owner]);
}
export function evidenceFor(c: OperationCase): EvidenceDocument[] {
  return [
    { id: 'account', title: 'Account record', source: 'Synthetic partner account', fields: [
      { label: 'Partner', value: c.account }, { label: 'Approved billing entity', value: c.approvedEntity || 'Not supplied' }, { label: 'Account owner', value: c.owner },
    ] },
    { id: 'order', title: 'Ticket order', source: c.orderId, fields: [
      { label: 'Order total', value: money(c.orderAmountCents, c.orderCurrency) }, { label: 'Ticket quantity', value: String(c.tickets) },
      { label: 'Allocation deadline', value: scenarioDate(c.deadline) }, { label: 'Scenario clock', value: scenarioDate(c.asOf) },
    ] },
    { id: 'invoice', title: 'Invoice register', source: c.invoice.id, fields: [
      { label: 'Billed entity', value: c.invoice.entity || 'Not supplied' }, { label: 'Invoice total', value: money(c.invoice.amountCents, c.invoice.currency) },
      { label: 'Linked order', value: c.orderId }, { label: 'Other active invoice', value: c.duplicateInvoiceId || 'None in this sample' },
    ] },
    { id: 'payment', title: 'Payment ledger', source: 'Synthetic finance ledger', fields: [
      { label: 'Ledger status', value: c.payment.status }, { label: 'Recorded amount', value: money(c.payment.amountCents, c.payment.currency) },
      { label: 'Payment reference', value: c.payment.reference || 'Not supplied' }, { label: 'Linked order', value: c.orderId },
    ] },
    { id: 'crm', title: 'CRM payment note', source: 'Synthetic CRM snapshot', fields: [{ label: 'Payment status', value: c.crmPaymentStatus }, { label: 'Linked order', value: c.orderId }] },
    { id: 'policy', title: 'Release policy', source: 'Demo policy · v1', fields: [
      { label: 'Entity', value: 'Invoice entity must match the approved account entity. Missing entities require clarification.' },
      { label: 'Invoice', value: 'Exactly one active invoice must match the order amount and currency.' },
      { label: 'Payment', value: 'A referenced, cleared payment for the exact order amount and currency is required. Conflicting records need Finance review.' },
      { label: 'Deadline', value: 'Escalate deadlines within 24 hours. After expiry, obtain a new allocation decision; never assume an extension.' },
      { label: 'Human review', value: 'A reviewer approves the proposed plan. This demo cannot send messages, change invoices, or release tickets.' },
    ] },
  ];
}

export function assessCase(c: OperationCase): Assessment {
  if (!validCase(c)) throw new Error('Case evidence is invalid. Restore the sample or correct the fields.');
  const findings: Finding[] = [];
  const add = (id: string, title: string, detail: string, sources: string[], action: string, owner = 'Finance', severity: Finding['severity'] = 'blocker') => findings.push({ id, title, detail, sources, action, owner, severity });
  const normalize = (text: string) => text.trim().replace(/\s+/g, ' ').toLocaleLowerCase('en-US');
  if (!c.approvedEntity.trim() || !c.invoice.entity.trim()) {
    add('entity_missing', 'Billing entity cannot be verified', 'The approved account entity or invoice entity is missing. No entity is inferred from the partner name.', ['account', 'invoice', 'policy'], 'Obtain written confirmation of the approved billing entity and complete the invoice record.', 'Partner Operations');
  } else if (normalize(c.approvedEntity) !== normalize(c.invoice.entity)) {
    add('entity_mismatch', 'Invoice names a different entity', `The invoice names “${c.invoice.entity}”; the account approves “${c.approvedEntity}”.`, ['account', 'invoice', 'policy'], `Ask Finance to validate and reissue ${c.invoice.id} against the approved entity; involve Legal if entity approval must change.`);
  }
  if (c.duplicateInvoiceId.trim()) add('duplicate_invoice', 'More than one active invoice', `${c.invoice.id} and ${c.duplicateInvoiceId} are both linked to ${c.orderId}.`, ['invoice', 'order', 'policy'], 'Confirm the valid invoice and void or reconcile the duplicate before any release decision.');
  if (c.invoice.currency !== c.orderCurrency) add('invoice_currency', 'Invoice currency differs from the order', `Invoice: ${c.invoice.currency}. Order: ${c.orderCurrency}. No exchange rate or conversion is assumed.`, ['invoice', 'order', 'policy'], 'Reconcile the invoice currency against the approved order with Finance.');
  if (c.invoice.currency === c.orderCurrency && c.invoice.amountCents !== c.orderAmountCents) add('invoice_amount', 'Invoice amount differs from the order', `Invoice: ${money(c.invoice.amountCents, c.invoice.currency)}. Order: ${money(c.orderAmountCents, c.orderCurrency)}.`, ['invoice', 'order', 'policy'], 'Confirm the authorized order total and correct the invoice amount.');
  if (c.payment.status !== c.crmPaymentStatus) add('payment_conflict', 'CRM and Finance disagree', `CRM says ${c.crmPaymentStatus}; the finance ledger says ${c.payment.status}. Neither is silently treated as reconciled.`, ['crm', 'payment', 'policy'], 'Ask Finance to reconcile the status and provide a matching payment reference.');
  if (c.payment.status === 'missing') add('payment_missing', 'Payment evidence is missing', 'There is no payment record that establishes receipt of funds for this order.', ['payment', 'policy'], 'Request remittance evidence and have Finance locate and match the payment.');
  if (c.payment.status === 'pending') add('payment_pending', 'Payment has not cleared', 'The ledger records a pending transfer. A pending amount does not establish cleared funds.', ['payment', 'policy'], 'Obtain Finance confirmation of cleared funds before release review.');
  if (c.payment.status !== 'missing' && !c.payment.reference.trim()) add('reference_missing', 'Payment reference is missing', 'The payment status cannot be tied to a verifiable receipt without its reference.', ['payment', 'policy'], 'Request the payment reference and match it to the order.');
  if (c.payment.status !== 'missing' && c.payment.currency !== c.orderCurrency) add('payment_currency', 'Payment currency differs from the order', `Payment: ${c.payment.currency}. Order: ${c.orderCurrency}. Amounts in different currencies are not treated as equivalent.`, ['payment', 'order', 'policy'], 'Ask Finance to reconcile the payment currency without assuming an exchange rate.');
  if (c.payment.status === 'cleared' && c.payment.currency === c.orderCurrency && c.payment.amountCents !== c.orderAmountCents) {
    const delta = c.orderAmountCents - c.payment.amountCents;
    add('payment_amount', delta > 0 ? 'Cleared payment is short' : 'Cleared payment exceeds the order', `${money(c.payment.amountCents, c.payment.currency)} is cleared against ${money(c.orderAmountCents, c.orderCurrency)}. Difference: ${money(Math.abs(delta), c.orderCurrency)}.`, ['payment', 'order', 'policy'], delta > 0 ? 'Confirm the outstanding balance with Finance and request the remaining payment.' : 'Ask Finance to reconcile the excess payment before approving the order.');
  }
  const deadlineHours = (Date.parse(c.deadline) - Date.parse(c.asOf)) / 3_600_000;
  if (deadlineHours <= 0) add('deadline_elapsed', 'Allocation deadline has elapsed', `The deadline was ${scenarioDate(c.deadline)}. This assessment uses the scenario clock, ${scenarioDate(c.asOf)}.`, ['order', 'policy'], 'Escalate to Ticketing Operations for a fresh availability and allocation decision. Do not promise an extension.', 'Ticketing Operations');
  else if (deadlineHours <= 24) add('deadline_near', 'Allocation deadline is approaching', `${deadlineHours.toFixed(1).replace(/\.0$/, '')} hours remain at the scenario clock. The deadline is ${scenarioDate(c.deadline)}.`, ['order', 'policy'], 'Alert the account owner and Ticketing Operations to the deadline while the evidence is resolved.', 'Partner Operations', 'attention');
  const blockers = findings.filter(f => f.severity === 'blocker');
  const unknown = findings.some(f => ['entity_missing', 'payment_missing', 'payment_conflict', 'reference_missing'].includes(f.id));
  const decision: Decision = blockers.length ? (unknown ? 'needs_information' : 'blocked') : 'ready_for_review';
  const headline = unknown ? 'Establish the facts before release.' : blockers.length ? 'Resolve the blockers before release.' : 'The evidence supports a release review.';
  const summary = blockers.length ? `${blockers.length} blocking ${blockers.length === 1 ? 'finding needs' : 'findings need'} attention for ${c.orderId}. Ticket release remains on hold.` : 'Entity, invoice, cleared payment, and allocation window pass the demo policy checks. Human release review is still required.';
  const recommendation = blockers.length ? blockers[0].action : 'Ask Ticketing Operations to review release against the verified order and payment evidence.';
  const owner = blockers.length ? blockers[0].owner : 'Ticketing Operations';
  const checks: Check[] = [
    { id: 'read', name: 'Read source records', outcome: '6 synthetic source records loaded for this case.', sources: ['account', 'order', 'invoice', 'payment', 'crm', 'policy'] },
    { id: 'invoice', name: 'Compare entity and invoice', outcome: `${findings.filter(f => ['entity_missing', 'entity_mismatch', 'duplicate_invoice', 'invoice_currency', 'invoice_amount'].includes(f.id)).length} findings from account, invoice, and order comparisons.`, sources: ['account', 'invoice', 'order', 'policy'] },
    { id: 'payment', name: 'Reconcile payment evidence', outcome: `${findings.filter(f => f.id.startsWith('payment_') || f.id === 'reference_missing').length} findings from payment and CRM comparisons.`, sources: ['payment', 'crm', 'order', 'policy'] },
    { id: 'deadline', name: 'Check allocation window', outcome: deadlineHours <= 0 ? 'Deadline elapsed at the scenario clock.' : `${deadlineHours.toFixed(1).replace(/\.0$/, '')} hours remain at the scenario clock.`, sources: ['order', 'policy'] },
    { id: 'review', name: 'Prepare a review plan', outcome: `${decisionLabels[decision]}. Two editable message templates prepared; no external action taken.`, sources: ['policy'] },
  ];
  const findingText = findings.length ? findings.map(f => `- ${f.title}: ${f.detail} [${f.sources.join(', ')}]`).join('\n') : '- All release prerequisites pass the supplied demo policy. [account, order, invoice, payment, crm, policy]';
  const drafts: Drafts = {
    internal: `Subject: ${c.orderId} — ${decisionLabels[decision]}\n\nHi ${owner},\n\nPlease review ${c.account}’s order for ${c.tickets} tickets (${money(c.orderAmountCents, c.orderCurrency)}).\n\n${findingText}\n\nRequested next step: ${recommendation}\n\nAllocation deadline: ${scenarioDate(c.deadline)}. Assessment as of ${scenarioDate(c.asOf)}.\n\nPlease confirm the outcome before any ticket release or client commitment.\n\nPartner Operations`,
    client: `Subject: Update on your ticket order ${c.orderId}\n\nHi ${c.account} team,\n\n${blockers.length ? 'Your order is awaiting review of the following items:\n\n' + blockers.map(f => `- ${f.title}.`).join('\n') : 'The supplied invoice and payment records meet the checks for release review. Ticket release still requires confirmation from Ticketing Operations.'}\n\n${deadlineHours <= 0 ? 'The allocation deadline has passed. Availability and any exception need a fresh decision, so we cannot confirm an extension or release.' : `The recorded allocation deadline is ${scenarioDate(c.deadline)}. We will need confirmation of the next step before making any release commitment.`}\n\nWe will share a further update after the relevant team confirms the outcome.\n\nPartner Operations`,
  };
  return { engineVersion: ENGINE_VERSION, caseId: c.id, inputSignature: inputSignature(c), decision, headline, summary, findings, checks, drafts, recommendation, owner, deadlineHours };
}

export function recordReview(c: OperationCase, assessment: Assessment, drafts: Drafts, reviewer: string, status: ReviewStatus, note: string, at: string): CaseReview {
  if (assessment.inputSignature !== inputSignature(c)) throw new Error('The evidence changed. Analyze the case again before review.');
  if (!reviewer.trim()) throw new Error('Enter a reviewer name.');
  if (status === 'changes_requested' && !note.trim()) throw new Error('Describe the changes needed.');
  if (!drafts.internal.trim() || !drafts.client.trim()) throw new Error('Both message drafts must contain text.');
  return { status, reviewer: reviewer.trim().slice(0, 100), note: note.trim().slice(0, 2000), at, inputSignature: inputSignature(c), draftSignature: JSON.stringify(drafts) };
}
export function currentReview(c: OperationCase, drafts: Drafts, review?: CaseReview): boolean {
  return Boolean(review && review.inputSignature === inputSignature(c) && review.draftSignature === JSON.stringify(drafts));
}

export function restoreWorkspaces(raw: string | null): Record<string, CaseWorkspace> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (parsed.version !== ENGINE_VERSION || !parsed.cases || typeof parsed.cases !== 'object') return {};
    const result: Record<string, CaseWorkspace> = {};
    for (const base of operationCases) {
      const saved = parsed.cases[base.id];
      if (!saved || !validCase(saved.input) || saved.input.id !== base.id) continue;
      const input = { ...base, approvedEntity: saved.input.approvedEntity, owner: saved.input.owner, deadline: saved.input.deadline, invoice: { ...saved.input.invoice }, duplicateInvoiceId: saved.input.duplicateInvoiceId, payment: { ...saved.input.payment }, crmPaymentStatus: saved.input.crmPaymentStatus };
      const analyzed = saved.analyzed === true;
      const drafts = analyzed && saved.drafts && ['internal', 'client'].every(key => typeof saved.drafts[key] === 'string' && saved.drafts[key].length <= 20000) ? { internal: saved.drafts.internal, client: saved.drafts.client } : undefined;
      const review = saved.review;
      const validReview = analyzed && drafts && review && ['approved', 'changes_requested'].includes(review.status) && typeof review.reviewer === 'string' && review.reviewer.trim() && review.reviewer.length <= 100 && typeof review.note === 'string' && review.note.length <= 2000 && typeof review.at === 'string' && Number.isFinite(Date.parse(review.at)) && currentReview(input, drafts, review);
      const history = Array.isArray(saved.history) ? saved.history.filter((e: AuditEntry) => e && typeof e.id === 'string' && typeof e.at === 'string' && Number.isFinite(Date.parse(e.at)) && typeof e.event === 'string' && e.event.length <= 100 && typeof e.detail === 'string' && e.detail.length <= 3000).slice(-100) : [];
      const origin = saved.draftOrigin;
      const draftOrigin = drafts && origin && typeof origin.model === 'string' && origin.model.length <= 100 && typeof origin.runId === 'string' && origin.runId.length <= 100 && typeof origin.completedAt === 'string' && Number.isFinite(Date.parse(origin.completedAt)) ? { model: origin.model, runId: origin.runId, completedAt: origin.completedAt } : undefined;
      result[base.id] = { input, analyzed, drafts, draftOrigin, review: validReview ? { ...review } : undefined, history };
    }
    return result;
  } catch { return {}; }
}

export function exportCase(c: OperationCase, assessment: Assessment, drafts: Drafts, review: CaseReview | undefined, history: AuditEntry[], draftOrigin?: DraftOrigin) {
  const reviewed = currentReview(c, drafts, review) ? review : undefined;
  return `# Lighthouse · ${c.id}\n\nSynthetic scenario · rules-based assessment · nothing sent or released\n${draftOrigin ? `AI-assisted drafts (possibly edited): ${draftOrigin.model}\nRun: ${draftOrigin.runId} · ${draftOrigin.completedAt}\nHuman review of narrative remains required.` : 'Current drafts originate from local templates; no AI model calls were needed to generate them.'}\n\n## Case\n${c.account} · ${c.orderId}\nScenario time: ${scenarioDate(c.asOf)}\nEngine: ${ENGINE_VERSION}\n\n## Assessment\n${assessment.headline}\n${assessment.summary}\n\n${assessment.findings.map(f => `- ${f.title}: ${f.detail}\n  Sources: ${f.sources.join(', ')}\n  Next step (${f.owner}): ${f.action}`).join('\n')}\n\n## Source records\n${evidenceFor(c).map(doc => `### ${doc.title} [${doc.id}]\nSource: ${doc.source}\n${doc.fields.map(f => `- ${f.label}: ${f.value}`).join('\n')}`).join('\n\n')}\n\n## Internal draft\n${drafts.internal}\n\n## Client draft\n${drafts.client}\n\n## Local review\n${reviewed ? `${reviewed.status} by ${reviewed.reviewer} at ${reviewed.at}\n${reviewed.note}\nThis records review of a plan only. No external action was executed.` : 'Pending human review.'}\n\n## Local activity\n${history.map(e => `- ${e.at} · ${e.event}: ${e.detail}`).join('\n')}\n`;
}
