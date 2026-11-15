const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, filename);
const { ENGINE_VERSION, operationCases, assessCase, evidenceFor, validCase, currentReview, recordReview, restoreWorkspaces, exportCase } = require('../app/lib/operations.ts');
const clone = value => JSON.parse(JSON.stringify(value));
const expected = [
  ['OPS-101', 'blocked', ['entity_mismatch', 'payment_pending', 'deadline_near']],
  ['OPS-102', 'needs_information', ['payment_missing']],
  ['OPS-103', 'needs_information', ['payment_conflict', 'payment_pending']],
  ['OPS-104', 'blocked', ['payment_pending', 'deadline_near']],
  ['OPS-105', 'ready_for_review', []],
  ['OPS-106', 'blocked', ['payment_amount']],
  ['OPS-107', 'blocked', ['invoice_currency', 'payment_currency']],
  ['OPS-108', 'blocked', ['duplicate_invoice']],
  ['OPS-109', 'needs_information', ['entity_missing']],
  ['OPS-110', 'blocked', ['deadline_elapsed']],
];
for (const [id, decision, findingIds] of expected) test(`${id}: ${decision} with the expected operational evidence`, () => {
  const c = operationCases.find(c => c.id === id);
  const before = clone(c); const result = assessCase(c);
  assert.equal(result.decision, decision);
  assert.deepEqual(result.findings.map(f => f.id), findingIds);
  assert.equal(result.checks.length, 5);
  const sources = evidenceFor(c).map(d => d.id);
  for (const finding of result.findings) {
    assert.ok(finding.sources.length > 0);
    assert.ok(finding.sources.every(id => sources.includes(id)));
    assert.ok(finding.action && finding.owner);
  }
  assert.ok(result.drafts.internal.includes(c.orderId));
  assert.ok(result.drafts.client.includes(c.orderId));
  assert.deepEqual(c, before, 'analysis must not mutate source evidence');
});
test('corrected invoice and cleared payment change the outcome without changing case identity', () => {
  const c = clone(operationCases[0]);
  c.invoice.entity = c.approvedEntity; c.payment.status = c.crmPaymentStatus = 'cleared';
  const result = assessCase(c);
  assert.equal(result.decision, 'ready_for_review');
  assert.deepEqual(result.findings.map(f => f.id), ['deadline_near']);
  assert.equal(result.caseId, operationCases[0].id);
});
test('partial cleared payment reports the exact outstanding balance', () => {
  const result = assessCase(operationCases[5]);
  assert.match(result.findings[0].detail, /18,000\.00/);
  assert.match(result.drafts.client, /Cleared payment is short/);
});
test('overpayment requires reconciliation too', () => {
  const c = clone(operationCases[4]); c.payment.amountCents += 1;
  assert.equal(assessCase(c).decision, 'blocked');
  assert.match(assessCase(c).findings[0].title, /exceeds/);
});
test('missing payment reference cannot pass release checks', () => {
  const c = clone(operationCases[4]); c.payment.reference = '  ';
  assert.equal(assessCase(c).decision, 'needs_information');
  assert.equal(assessCase(c).findings[0].id, 'reference_missing');
});
test('pending transfers are not treated as cleared funds', () => {
  const c = clone(operationCases[4]); c.payment.status = c.crmPaymentStatus = 'pending';
  assert.equal(assessCase(c).decision, 'blocked');
});
test('invoice amount mismatch blocks release even with a fully paid order', () => {
  const c = clone(operationCases[4]); c.invoice.amountCents -= 100;
  assert.equal(assessCase(c).findings[0].id, 'invoice_amount');
});
test('name comparison tolerates case and spacing without merging distinct entities', () => {
  const c = clone(operationCases[4]); c.invoice.entity = '  NORTHSTAR  MEDIA US, INC. ';
  assert.equal(assessCase(c).decision, 'ready_for_review');
  c.invoice.entity = 'Northstar Media Canada, Inc.';
  assert.equal(assessCase(c).decision, 'blocked');
});
test('deadline equality is expired and exactly 24 hours is time-sensitive', () => {
  const c = clone(operationCases[4]); c.deadline = c.asOf;
  assert.equal(assessCase(c).findings[0].id, 'deadline_elapsed');
  c.deadline = new Date(Date.parse(c.asOf) + 24 * 3600000).toISOString();
  assert.equal(assessCase(c).findings[0].id, 'deadline_near');
  c.deadline = new Date(Date.parse(c.asOf) + 24 * 3600000 + 1).toISOString();
  assert.equal(assessCase(c).findings.length, 0);
});
test('elapsed deadline draft does not promise an extension', () => {
  assert.match(assessCase(operationCases[9]).drafts.client, /cannot confirm an extension or release/);
});
test('invalid, negative, fractional, and non-finite monetary inputs are rejected', () => {
  for (const bad of [-1, 1.1, NaN, Infinity, '4800000', 1_000_000_001]) {
    const c = clone(operationCases[4]); c.payment.amountCents = bad;
    assert.equal(validCase(c), false); assert.throws(() => assessCase(c), /invalid/);
  }
});
test('zero invoice amount and unknown currency are rejected', () => {
  const c = clone(operationCases[4]); c.invoice.amountCents = 0; assert.equal(validCase(c), false);
  c.invoice.amountCents = 100; c.invoice.currency = 'BTC'; assert.equal(validCase(c), false);
});
test('source edits invalidate earlier assessment and review', () => {
  const c = clone(operationCases[4]); const a = assessCase(c);
  const review = recordReview(c, a, a.drafts, 'Demo reviewer', 'approved', '', '2026-11-15T16:00:00Z');
  assert.equal(currentReview(c, a.drafts, review), true);
  c.invoice.entity = 'Different company';
  assert.equal(currentReview(c, a.drafts, review), false);
  assert.throws(() => recordReview(c, a, a.drafts, 'Demo reviewer', 'approved', '', '2026-11-15T16:00:00Z'), /evidence changed/);
});
test('draft edits invalidate an approval', () => {
  const c = operationCases[4]; const a = assessCase(c);
  const review = recordReview(c, a, a.drafts, 'Demo reviewer', 'approved', '', '2026-11-15T16:00:00Z');
  assert.equal(currentReview(c, { ...a.drafts, client: 'Updated message' }, review), false);
});
test('a reviewer name, revision reason, and nonempty drafts are required', () => {
  const c = operationCases[4]; const a = assessCase(c);
  assert.throws(() => recordReview(c, a, a.drafts, ' ', 'approved', '', '2026-11-15T16:00:00Z'), /reviewer name/);
  assert.throws(() => recordReview(c, a, a.drafts, 'Rafa', 'changes_requested', ' ', '2026-11-15T16:00:00Z'), /changes needed/);
  assert.throws(() => recordReview(c, a, { ...a.drafts, client: ' ' }, 'Rafa', 'approved', '', '2026-11-15T16:00:00Z'), /Both message drafts/);
});
test('reviewing a blocked case approves its remediation plan and never changes its status', () => {
  const c = operationCases[0]; const a = assessCase(c);
  const review = recordReview(c, a, a.drafts, 'Rafa', 'approved', 'Ask Finance first.', '2026-11-15T16:00:00Z');
  assert.equal(review.status, 'approved'); assert.equal(assessCase(c).decision, 'blocked');
  assert.ok(exportCase(c, a, a.drafts, review, []).includes('No external action was executed.'));
});
test('valid edited evidence, drafts, and review round-trip through browser storage', () => {
  const c = clone(operationCases[4]); c.invoice.entity = 'NORTHSTAR MEDIA US, INC.'; const a = assessCase(c);
  const review = recordReview(c, a, a.drafts, 'Rafa', 'approved', '', '2026-11-15T16:00:00Z');
  const saved = { input: c, analyzed: true, drafts: a.drafts, review, history: [] };
  const restored = restoreWorkspaces(JSON.stringify({ version: ENGINE_VERSION, cases: { [c.id]: saved } }));
  assert.equal(restored[c.id].input.invoice.entity, c.invoice.entity);
  assert.deepEqual(restored[c.id].review, review);
});
test('malformed or old stored state cannot crash the workspace', () => {
  for (const raw of [null, '{', 'null', '[]', JSON.stringify({ version: 'old', cases: {} }), JSON.stringify({ version: ENGINE_VERSION, cases: { 'OPS-101': { input: {} } } })]) assert.deepEqual(restoreWorkspaces(raw), {});
});
test('tampered immutable order data is rejected when restoring state', () => {
  const c = clone(operationCases[4]); c.orderAmountCents = 1;
  assert.deepEqual(restoreWorkspaces(JSON.stringify({ version: ENGINE_VERSION, cases: { [c.id]: { input: c, analyzed: true } } })), {});
});
test('stale review is dropped when persisted evidence changes', () => {
  const c = clone(operationCases[4]); const a = assessCase(c);
  const review = recordReview(c, a, a.drafts, 'Rafa', 'approved', '', '2026-11-15T16:00:00Z');
  c.payment.status = 'pending';
  const restored = restoreWorkspaces(JSON.stringify({ version: ENGINE_VERSION, cases: { [c.id]: { input: c, analyzed: true, drafts: a.drafts, review, history: [] } } }));
  assert.equal(restored[c.id].review, undefined);
});
test('export includes all cited records, scenario clock, edited draft, and review scope', () => {
  const c = operationCases[0]; const a = assessCase(c);
  const packet = exportCase(c, a, { ...a.drafts, client: 'A personally reviewed message.' }, undefined, []);
  for (const d of evidenceFor(c)) assert.ok(packet.includes(`[${d.id}]`));
  assert.ok(packet.includes('A personally reviewed message.'));
  assert.ok(packet.includes('Pending human review.'));
  assert.ok(packet.includes('no AI model calls'));
});
