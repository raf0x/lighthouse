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
  imported?: { format: 'case-csv-v1'; fileName: string; at: string; row: 2 };
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
export type EvidenceChange = { field: string; label: string; before: string; after: string };
export type EvidenceAudit = {
  source: 'csv' | 'manual' | 'restore'; fileName?: string; changes: EvidenceChange[];
  before: { decision: Decision; findings: string[] }; after: { decision: Decision; findings: string[] };
  previousReview?: { status: ReviewStatus; reviewer: string; at: string };
};
export type AuditEntry = { id: string; at: string; event: string; detail: string; evidence?: EvidenceAudit };
export type CaseReview = { status: ReviewStatus; reviewer: string; note: string; at: string; inputSignature: string; draftSignature: string };
export type DraftOrigin = { model: string; runId: string; completedAt: string };
export type CaseWorkspace = { input: OperationCase; importedOriginal?: OperationCase; analyzed: boolean; drafts?: Drafts; draftOrigin?: DraftOrigin; review?: CaseReview; history: AuditEntry[] };
export const MAX_IMPORTED_CASES = 20;
export const MAX_WORKSPACE_CHARACTERS = 2_000_000;
export const decisionLabels: Record<Decision, string> = { blocked: 'Action needed', needs_information: 'Evidence needed', ready_for_review: 'Ready for review' };
export const EVIDENCE_LABELS = {
  partner: 'Partner', approved_entity: 'Approved billing entity', order_id: 'Order ID', order_amount: 'Order amount', order_currency: 'Order currency', tickets: 'Ticket quantity',
  scenario_clock: 'Scenario clock (ISO)', allocation_deadline: 'Allocation deadline (ISO)', invoice_id: 'Invoice ID', invoice_entity: 'Entity on invoice', invoice_amount: 'Invoice amount', invoice_currency: 'Invoice currency',
  other_active_invoice_id: 'Other active invoice ID', payment_status: 'Finance ledger status', payment_amount: 'Recorded payment amount', payment_currency: 'Payment currency', payment_reference: 'Payment reference', crm_payment_status: 'CRM payment status',
} as const;
export function evidenceValues(c: OperationCase): Record<keyof typeof EVIDENCE_LABELS, string> {
  return { partner: c.account, approved_entity: c.approvedEntity, order_id: c.orderId, order_amount: (c.orderAmountCents / 100).toFixed(2), order_currency: c.orderCurrency, tickets: String(c.tickets),
    scenario_clock: c.asOf, allocation_deadline: c.deadline, invoice_id: c.invoice.id, invoice_entity: c.invoice.entity, invoice_amount: (c.invoice.amountCents / 100).toFixed(2), invoice_currency: c.invoice.currency,
    other_active_invoice_id: c.duplicateInvoiceId, payment_status: c.payment.status, payment_amount: (c.payment.amountCents / 100).toFixed(2), payment_currency: c.payment.currency, payment_reference: c.payment.reference, crm_payment_status: c.crmPaymentStatus };
}
export function evidenceChanges(before: OperationCase, after: OperationCase): EvidenceChange[] {
  const a = evidenceValues(before), b = evidenceValues(after);
  return (Object.keys(EVIDENCE_LABELS) as (keyof typeof EVIDENCE_LABELS)[]).filter(field => a[field] !== b[field]).map(field => ({ field, label: EVIDENCE_LABELS[field], before: a[field], after: b[field] }));
}
export function evidenceAudit(before: OperationCase, after: OperationCase, source: EvidenceAudit['source'], review?: CaseReview): EvidenceAudit {
  const outcome = (c: OperationCase) => { const result = assessCase(c); return { decision: result.decision, findings: result.findings.map(f => f.title) }; };
  return { source, ...(source === 'csv' ? { fileName: after.imported?.fileName } : {}), changes: evidenceChanges(before, after), before: outcome(before), after: outcome(after),
    ...(review && review.inputSignature === inputSignature(before) ? { previousReview: { status: review.status, reviewer: review.reviewer, at: review.at } } : {}) };
}
function validEvidenceAudit(value: unknown): value is EvidenceAudit {
  const e = value as EvidenceAudit;
  const text = (v: unknown, max: number): v is string => typeof v === 'string' && v.length <= max && !/[\u0000-\u001f\u007f]/.test(v);
  const outcome = (v: EvidenceAudit['before']) => v && Object.hasOwn(decisionLabels, v.decision) && Array.isArray(v.findings) && v.findings.length <= 20 && v.findings.every(f => text(f, 150));
  return Boolean(e && ['csv', 'manual', 'restore'].includes(e.source) && (e.source !== 'csv' || (text(e.fileName, 200) && e.fileName.toLowerCase().endsWith('.csv')))
    && Array.isArray(e.changes) && e.changes.length <= 18 && new Set(e.changes.map(c => c?.field)).size === e.changes.length
    && e.changes.every(c => c && Object.hasOwn(EVIDENCE_LABELS, c.field) && c.label === EVIDENCE_LABELS[c.field as keyof typeof EVIDENCE_LABELS] && text(c.before, 500) && text(c.after, 500))
    && outcome(e.before) && outcome(e.after) && (!e.previousReview || (['approved', 'changes_requested'].includes(e.previousReview.status) && text(e.previousReview.reviewer, 100) && e.previousReview.reviewer.trim() && normalizedTimestamp(e.previousReview.at))));
}
function exportActivity(e: AuditEntry) {
  const a = e.evidence;
  return `- ${e.at} · ${e.event}: ${e.detail}` + (a ? `\n  Policy: ${decisionLabels[a.before.decision]} → ${decisionLabels[a.after.decision]}\n  Before findings: ${a.before.findings.join('; ') || 'None'}\n  After findings: ${a.after.findings.join('; ') || 'None'}${a.previousReview ? `\n  Previous review cleared: ${a.previousReview.status} by ${a.previousReview.reviewer} at ${a.previousReview.at}` : ''}\n${a.changes.map(change => `  ${change.label}: ${JSON.stringify(change.before)} → ${JSON.stringify(change.after)}`).join('\n')}` : '');
}

export function money(cents: number, currency: Currency) {
  // Evidence strings are a wire contract: locale display patterns vary by browser.
  const absolute = Math.abs(cents);
  const whole = String(Math.trunc(absolute / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${cents < 0 ? '-' : ''}${currency} ${whole}.${String(absolute % 100).padStart(2, '0')}`;
}
export function scenarioDate(iso: string) {
  const date = new Date(iso);
  // Use Intl only for time-zone arithmetic, never its browser-specific punctuation,
  // month/day-period strings, or time-zone labels in exact field citations.
  const parts = new Intl.DateTimeFormat('en-US', { calendar: 'gregory', numberingSystem: 'latn', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', hourCycle: 'h23', timeZone: 'America/New_York' }).formatToParts(date);
  const number = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find(part => part.type === type)!.value);
  const year = number('year'), month = number('month'), day = number('day'), hour = number('hour') % 24, minute = number('minute');
  const offset = (Date.UTC(year, month - 1, day, hour, minute) - Math.floor(date.getTime() / 60000) * 60000) / 60000;
  const zone = offset === -300 ? 'EST' : offset === -240 ? 'EDT' : 'ET';
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[month - 1]} ${day}, ${hour % 12 || 12}:${String(minute).padStart(2, '0')} ${hour < 12 ? 'AM' : 'PM'} ${zone}`;
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
/** Explicitly zoned timestamps only; reject rolled dates such as February 30. */
export function normalizedTimestamp(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?(Z|[+-]\d{2}:\d{2})$/.exec(value);
  if (!m) return null;
  const [year, month, day, hour, minute, second] = m.slice(1, 7).map(v => Number(v || 0));
  if (year < 2000 || year > 2100 || month < 1 || month > 12 || day < 1 || day > new Date(Date.UTC(year, month, 0)).getUTCDate() || hour > 23 || minute > 59 || second > 59) return null;
  if (m[8] !== 'Z') { const [h, min] = m[8].slice(1).split(':').map(Number); if (h > 14 || min > 59 || (h === 14 && min !== 0)) return null; }
  const time = Date.parse(value);
  return Number.isFinite(time) ? new Date(time).toISOString() : null;
}
const importText = (value: unknown, max = 200, required = false): value is string => typeof value === 'string' && value.length <= max && !/[\u0000-\u001f\u007f]/.test(value) && (!required || value.trim().length > 0);
/** Imported records are user-supplied data, never policy or authenticated Finance evidence. */
export function canonicalImportedCase(value: unknown): OperationCase | null {
  const c = value as OperationCase;
  if (!c || typeof c !== 'object' || !c.invoice || !c.payment || !c.imported || !/^IMP-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(c.id)) return null;
  if (c.imported.format !== 'case-csv-v1' || c.imported.row !== 2 || !importText(c.imported.fileName, 200, true) || !c.imported.fileName.toLowerCase().endsWith('.csv') || !normalizedTimestamp(c.imported.at)) return null;
  if (!importText(c.account, 200, true) || ![c.orderId, c.invoice.id].every(v => typeof v === 'string' && /^[A-Za-z0-9][A-Za-z0-9._/-]{0,79}$/.test(v)) || ![c.approvedEntity, c.invoice.entity, c.duplicateInvoiceId, c.payment.reference].every(v => importText(v))) return null;
  if (!cents(c.orderAmountCents) || c.orderAmountCents === 0 || !cents(c.invoice.amountCents) || c.invoice.amountCents === 0 || !cents(c.payment.amountCents) || !Number.isSafeInteger(c.tickets) || c.tickets < 1 || c.tickets > 1_000_000) return null;
  if (![c.orderCurrency, c.invoice.currency, c.payment.currency].every(v => currencies.includes(v)) || ![c.payment.status, c.crmPaymentStatus].every(v => states.includes(v))) return null;
  const asOf = normalizedTimestamp(c.asOf), deadline = normalizedTimestamp(c.deadline);
  if (!asOf || !deadline) return null;
  const hours = (Date.parse(deadline) - Date.parse(asOf)) / 3_600_000;
  if (hours < -168 || hours > 720) return null;
  return { id: c.id, account: c.account, initials: c.account.trim().split(/\s+/).slice(0, 2).map(w => Array.from(w)[0]).join('').toUpperCase(), color: '#177a70', scenario: 'Imported case', description: 'User-supplied CSV records assessed against the Lighthouse demo policy.', owner: 'Partner Operations', asOf, deadline,
    approvedEntity: c.approvedEntity, orderId: c.orderId, orderAmountCents: c.orderAmountCents, orderCurrency: c.orderCurrency, tickets: c.tickets,
    invoice: { id: c.invoice.id, entity: c.invoice.entity, amountCents: c.invoice.amountCents, currency: c.invoice.currency }, duplicateInvoiceId: c.duplicateInvoiceId,
    payment: { status: c.payment.status, amountCents: c.payment.amountCents, currency: c.payment.currency, reference: c.payment.reference }, crmPaymentStatus: c.crmPaymentStatus,
    imported: { format: 'case-csv-v1', fileName: c.imported.fileName, at: normalizedTimestamp(c.imported.at)!, row: 2 } };
}
export function sameCaseIdentity(a: OperationCase, b: OperationCase) {
  // Follow-up files may advance the scenario clock or replace an invoice. The order stays fixed.
  const identity = (c: OperationCase) => JSON.stringify([c.id, c.account, c.orderId, c.orderAmountCents, c.orderCurrency, c.tickets]);
  return identity(a) === identity(b);
}
export function validCase(value: unknown): value is OperationCase {
  const c = value as OperationCase;
  if (!c || typeof c !== 'object' || !c.invoice || !c.payment) return false;
  if (c.imported || (typeof c.id === 'string' && c.id.startsWith('IMP-'))) return canonicalImportedCase(c) !== null;
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
  return JSON.stringify([ENGINE_VERSION, c.id, c.asOf, c.approvedEntity, c.orderId, c.orderAmountCents, c.orderCurrency, c.tickets, c.deadline, c.invoice.id, c.invoice.entity, c.invoice.amountCents, c.invoice.currency, c.duplicateInvoiceId, c.payment.status, c.payment.amountCents, c.payment.currency, c.payment.reference, c.crmPaymentStatus, c.owner, ...(c.imported ? [c.account, c.imported] : [])]);
}
export function evidenceFor(c: OperationCase): EvidenceDocument[] {
  const docs: EvidenceDocument[] = [
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
  if (c.imported) {
    for (const doc of docs.filter(d => d.id !== 'policy')) doc.source = `Imported CSV · ${c.imported.fileName} · row 2 · ${doc.title}`;
    docs.find(d => d.id === 'order')!.fields.push({ label: 'Order ID', value: c.orderId }, { label: 'Scenario clock (ISO)', value: c.asOf }, { label: 'Allocation deadline (ISO)', value: c.deadline });
    docs.find(d => d.id === 'invoice')!.fields.push({ label: 'Invoice ID', value: c.invoice.id });
  }
  return docs;
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
    { id: 'read', name: 'Read source records', outcome: c.imported ? '5 record views mapped from one user-supplied CSV row, plus the fixed demo policy. No external system was queried.' : '6 synthetic source records loaded for this case.', sources: ['account', 'order', 'invoice', 'payment', 'crm', 'policy'] },
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
  if (!raw || raw.length > MAX_WORKSPACE_CHARACTERS) return {};
  try {
    const parsed = JSON.parse(raw);
    if (parsed.version !== ENGINE_VERSION || !parsed.cases || typeof parsed.cases !== 'object') return {};
    const result: Record<string, CaseWorkspace> = {};
    const importedBases = Object.values(parsed.cases).map((w: any) => canonicalImportedCase(w?.importedOriginal)).filter((c): c is OperationCase => Boolean(c)).slice(0, MAX_IMPORTED_CASES);
    const orderIds = new Set(operationCases.map(c => c.orderId.toLowerCase()));
    for (const base of [...operationCases, ...importedBases]) {
      const saved = parsed.cases[base.id];
      if (!saved || !validCase(saved.input) || saved.input.id !== base.id) continue;
      if (base.imported && (orderIds.has(base.orderId.toLowerCase()) || !sameCaseIdentity(base, saved.input))) continue;
      if (base.imported) orderIds.add(base.orderId.toLowerCase());
      const input = base.imported ? canonicalImportedCase(saved.input)! : { ...base, approvedEntity: saved.input.approvedEntity, owner: saved.input.owner, deadline: saved.input.deadline, invoice: { ...saved.input.invoice }, duplicateInvoiceId: saved.input.duplicateInvoiceId, payment: { ...saved.input.payment }, crmPaymentStatus: saved.input.crmPaymentStatus };
      const analyzed = saved.analyzed === true;
      const drafts = analyzed && saved.drafts && ['internal', 'client'].every(key => typeof saved.drafts[key] === 'string' && saved.drafts[key].length <= 20000) ? { internal: saved.drafts.internal, client: saved.drafts.client } : undefined;
      const review = saved.review;
      const validReview = analyzed && drafts && review && ['approved', 'changes_requested'].includes(review.status) && typeof review.reviewer === 'string' && review.reviewer.trim() && review.reviewer.length <= 100 && typeof review.note === 'string' && review.note.length <= 2000 && typeof review.at === 'string' && Number.isFinite(Date.parse(review.at)) && currentReview(input, drafts, review);
      const history = Array.isArray(saved.history) ? saved.history.filter((e: AuditEntry) => e && typeof e.id === 'string' && e.id.length <= 100 && typeof e.at === 'string' && Number.isFinite(Date.parse(e.at)) && typeof e.event === 'string' && e.event.length <= 100 && typeof e.detail === 'string' && e.detail.length <= 3000).slice(-100).map((e: AuditEntry) => ({ id: e.id, at: e.at, event: e.event, detail: e.detail, ...(validEvidenceAudit(e.evidence) ? { evidence: e.evidence } : {}) })) : [];
      const origin = saved.draftOrigin;
      const draftOrigin = drafts && origin && typeof origin.model === 'string' && origin.model.length <= 100 && typeof origin.runId === 'string' && origin.runId.length <= 100 && typeof origin.completedAt === 'string' && Number.isFinite(Date.parse(origin.completedAt)) ? { model: origin.model, runId: origin.runId, completedAt: origin.completedAt } : undefined;
      result[base.id] = { input, ...(base.imported ? { importedOriginal: base } : {}), analyzed, drafts, draftOrigin, review: validReview ? { ...review } : undefined, history };
    }
    return result;
  } catch { return {}; }
}

export function exportCase(c: OperationCase, assessment: Assessment, drafts: Drafts, review: CaseReview | undefined, history: AuditEntry[], draftOrigin?: DraftOrigin) {
  const reviewed = currentReview(c, drafts, review) ? review : undefined;
  return `# Lighthouse · ${c.id}\n\n${c.imported ? `Imported CSV: ${c.imported.fileName} · row 2 · imported ${c.imported.at}\nUser-supplied records; not verified against external systems. Fixed Lighthouse demo policy.` : 'Synthetic scenario'} · rules-based assessment · nothing sent or released\n${draftOrigin ? `AI-assisted drafts (possibly edited): ${draftOrigin.model}\nRun: ${draftOrigin.runId} · ${draftOrigin.completedAt}\nHuman review of narrative remains required.` : 'Current drafts originate from local templates; no AI model calls were needed to generate them.'}\n\n## Case\n${c.account} · ${c.orderId}\nScenario time: ${scenarioDate(c.asOf)}\nEngine: ${ENGINE_VERSION}\n\n## Assessment\n${assessment.headline}\n${assessment.summary}\n\n${assessment.findings.map(f => `- ${f.title}: ${f.detail}\n  Sources: ${f.sources.join(', ')}\n  Next step (${f.owner}): ${f.action}`).join('\n')}\n\n## Source records\n${evidenceFor(c).map(doc => `### ${doc.title} [${doc.id}]\nSource: ${doc.source}\n${doc.fields.map(f => `- ${f.label}: ${f.value}`).join('\n')}`).join('\n\n')}\n\n## Internal draft\n${drafts.internal}\n\n## Client draft\n${drafts.client}\n\n## Plan review\n${reviewed ? `${reviewed.status} by ${reviewed.reviewer} at ${reviewed.at}\n${reviewed.note}\nThis records review of a plan only. No external action was executed.` : 'Pending human review.'}\n\n## Case activity\n${history.map(exportActivity).join('\n')}\n`;
}
