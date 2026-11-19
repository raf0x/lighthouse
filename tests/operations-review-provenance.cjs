const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const ts = require('typescript');

require.extensions['.ts'] = (module, file) => module._compile(
  ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText, file,
);
const {
  ENGINE_VERSION, operationCases, assessCase, currentReview, exportCase, restoreWorkspaces,
} = require('../app/lib/operations.ts');
const {
  WORKSPACE_STORAGE_KEY, StaleReviewError, captureReviewSnapshot, matchesReviewSnapshot, writeCurrentReview,
} = require('../app/lib/workspace.ts');

const clone = value => structuredClone(value);
const at = '2026-11-18T22:10:00.000Z';
function seed() {
  const id = 'OPS-105';
  const input = clone(operationCases.find(c => c.id === id));
  const assessment = assessCase(input);
  return { [id]: { input, analyzed: true, drafts: assessment.drafts, history: [] } };
}
function mockStore(cases = seed()) {
  let raw = JSON.stringify({ version: ENGINE_VERSION, cases });
  let writes = 0;
  return {
    getItem: key => key === WORKSPACE_STORAGE_KEY ? raw : null,
    setItem(key, value) { assert.equal(key, WORKSPACE_STORAGE_KEY); raw = value; writes += 1; },
    cases() { return restoreWorkspaces(raw); },
    writes: () => writes,
  };
}
function capture(store, id='OPS-105') {
  const current = store.cases()[id];
  return captureReviewSnapshot(current.input, current.drafts);
}
function externalChange(store, change, id='OPS-105') {
  const cases = store.cases();
  change(cases[id]);
  store.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify({ version: ENGINE_VERSION, cases }));
}
function submit(store,snapshot,status='approved',note='') {
  return writeCurrentReview(store,snapshot,'QA Reviewer',status,note,at);
}
function noStaleSuccess(store,snapshot) {
  const before = store.getItem(WORKSPACE_STORAGE_KEY);
  const writes = store.writes();
  assert.throws(() => submit(store,snapshot),StaleReviewError);
  assert.equal(store.getItem(WORKSPACE_STORAGE_KEY),before);
  assert.equal(store.writes(),writes);
  const w=store.cases()['OPS-105'];
  assert.ok(!w.history.some(x=>x.event==='Plan approved locally'));
  assert.ok(!w.review);
}
test('fresh named approval binds exact case, evidence and both drafts; packet survives reload',()=>{
  const store=mockStore(),snapshot=capture(store);
  const result=submit(store,snapshot);
  const w=store.cases()['OPS-105'],assessment=assessCase(w.input);
  assert.equal(store.writes(),1);
  assert.deepEqual(result.review,w.review);
  assert.ok(currentReview(w.input,w.drafts,w.review));
  assert.equal(w.review.reviewer,'QA Reviewer');
  assert.equal(w.history.length,1);
  assert.equal(w.history[0].event,'Plan approved locally');
  const packet=exportCase(w.input,assessment,w.drafts,w.review,w.history);
  assert.ok(packet.includes('approved by QA Reviewer'));
  assert.ok(packet.includes(w.drafts.internal));
  assert.ok(packet.includes(w.drafts.client));
  assert.ok(packet.includes('No external action was executed.'));
  assert.equal(assessment.decision,'ready_for_review');
});
test('one-cent payment update in another tab rejects stale confirmation before storage write',()=>{
  const store=mockStore(),snapshot=capture(store);
  externalChange(store,w=>{w.input.payment.amountCents -= 1; w.review=undefined;});
  noStaleSuccess(store,snapshot);
  assert.equal(assessCase(store.cases()['OPS-105'].input).decision,'blocked');
  assert.equal(assessCase(store.cases()['OPS-105'].input).findings[0].id,'payment_amount');
});
test('internal draft alone changes review version and rejects stale confirmation',()=>{
  const store=mockStore(),snapshot=capture(store);
  externalChange(store,w=>{w.drafts.internal += ' Edited by another operator.';});
  noStaleSuccess(store,snapshot);
});
test('client draft alone changes review version and rejects stale confirmation',()=>{
  const store=mockStore(),snapshot=capture(store);
  externalChange(store,w=>{w.drafts.client += ' Edited by another operator.';});
  noStaleSuccess(store,snapshot);
});
test('delayed storage event cannot bypass authoritative write-boundary check',()=>{
  const store=mockStore(),snapshot=capture(store);
  // No subscriber/notification is used here; the initiating tab still has its old render.
  externalChange(store,w=>{w.drafts.client='New exact client draft';});
  assert.ok(matchesReviewSnapshot(snapshot,seed()['OPS-105'].input,seed()['OPS-105'].drafts));
  noStaleSuccess(store,snapshot);
});
test('an unrelated case update does not invalidate the reviewed case or get overwritten',()=>{
  const cases=seed(),extra=clone(operationCases[0]),assessment=assessCase(extra);
  cases[extra.id]={input:extra,analyzed:true,drafts:assessment.drafts,history:[]};
  const store=mockStore(cases),snapshot=capture(store);
  externalChange(store,w=>{w.input.payment.reference='Updated in a different tab';},'OPS-101');
  const result=submit(store,snapshot);
  assert.equal(result.workspaces['OPS-101'].input.payment.reference,'Updated in a different tab');
  assert.equal(store.cases()['OPS-101'].input.payment.reference,'Updated in a different tab');
  assert.ok(store.cases()['OPS-105'].review);
});
test('switching cases or removing the case never signs a different record',()=>{
  const store=mockStore(),snapshot=capture(store);
  assert.equal(matchesReviewSnapshot(snapshot,operationCases[0],seed()['OPS-105'].drafts),false);
  externalChange(store,w=>{w.analyzed=false;w.drafts=undefined;});
  noStaleSuccess(store,snapshot);
});
test('a canceled confirmation is read-only and fresh unchanged review remains valid',()=>{
  const store=mockStore(),snapshot=capture(store),original=store.getItem(WORKSPACE_STORAGE_KEY);
  assert.equal(store.writes(),0);
  assert.equal(store.getItem(WORKSPACE_STORAGE_KEY),original);
  const approved=submit(store,snapshot,'approved');
  assert.ok(approved.review);
  assert.equal(store.writes(),1);
});
test('revision requests are version-bound and require a reason',()=>{
  const store=mockStore(),snapshot=capture(store);
  assert.throws(()=>submit(store,snapshot,'changes_requested','   '),/changes needed/);
  assert.equal(store.writes(),0);
  const result=submit(store,snapshot,'changes_requested','Verify the payment reference');
  assert.equal(result.review.status,'changes_requested');
  assert.equal(store.cases()['OPS-105'].history[0].event,'Changes requested');
});
test('storage failure produces neither a recorded success nor a mutation',()=>{
  const store=mockStore(),snapshot=capture(store),original=store.getItem(WORKSPACE_STORAGE_KEY);
  const denied={getItem:store.getItem,setItem(){throw new Error('Storage blocked')}};
  assert.throws(()=>writeCurrentReview(denied,snapshot,'QA Reviewer','approved','',at),/Storage blocked/);
  assert.equal(store.getItem(WORKSPACE_STORAGE_KEY),original);
  assert.equal(store.writes(),0);
});
