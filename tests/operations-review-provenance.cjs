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
  ENGINE_VERSION, operationCases, assessCase, currentReview, recordReview, exportCase, restoreWorkspaces,
} = require('../app/lib/operations.ts');
const {
  WORKSPACE_STORAGE_KEY, StaleReviewError, captureReviewSnapshot, matchesReviewSnapshot,
  writeCurrentReview, writeWorkspaceChange, withWorkspaceWriteLock, WORKSPACE_WRITE_LOCK, WorkspaceWriteError,
  LEGACY_WORKSPACE_STORAGE_KEY, initializeWorkspaceStore, legacyCaseVersion,
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

function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}
function lockManager() {
  let queue = Promise.resolve();
  const entries = [];
  return {
    entries,
    request(name, options, callback) {
      assert.equal(name, WORKSPACE_WRITE_LOCK);
      assert.equal(options.mode, 'exclusive');
      const prior = queue;
      const release = deferred();
      queue = release.promise;
      return prior.then(async () => {
        entries.push(name);
        try { return await callback(); } finally { release.resolve(); }
      });
    },
  };
}
function changePayment(store, inputBefore, amountCents) {
  const next = structuredClone(inputBefore);
  next.input.payment.amountCents = amountCents;
  next.analyzed = false;
  next.drafts = undefined;
  next.review = undefined;
  const before = store.cases();
  const after = { ...before, 'OPS-105': next };
  const change = latest => ({
    ...latest, 'OPS-105': {
      ...latest['OPS-105'],
      input: next.input, analyzed: false, drafts: undefined, review: undefined,
      history: [...latest['OPS-105'].history, { id: 'change', at, event: 'Evidence updated', detail: 'Payment changed.' }],
    },
  });
  return () => writeWorkspaceChange(store, before, after, change);
}
test('cross-tab exclusive lock queues review behind an in-flight one-cent evidence write', async () => {
  const store = mockStore(), locks = lockManager(), snapshot = capture(store);
  const entered = deferred(), release = deferred();
  const before = store.cases()['OPS-105'];
  const edit = withWorkspaceWriteLock(locks, async () => {
    entered.resolve();
    await release.promise;
    return changePayment(store, before, before.input.payment.amountCents - 1)();
  });
  await entered.promise;
  const approval = withWorkspaceWriteLock(locks, () => submit(store, snapshot));
  release.resolve();
  await edit;
  await assert.rejects(approval, StaleReviewError);
  const caseAfter = store.cases()['OPS-105'];
  assert.equal(caseAfter.input.payment.amountCents, before.input.payment.amountCents - 1);
  assert.equal(caseAfter.review, undefined);
  assert.equal(caseAfter.history.some(e => e.event === 'Plan approved locally'), false);
});
test('review holding the same lock cannot overwrite a queued evidence edit', async () => {
  const store = mockStore(), locks = lockManager(), snapshot = capture(store);
  const before = store.cases()['OPS-105'];
  const entered = deferred(), release = deferred();
  const approval = withWorkspaceWriteLock(locks, async () => {
    entered.resolve();
    await release.promise;
    return submit(store, snapshot);
  });
  await entered.promise;
  const edit = withWorkspaceWriteLock(locks, changePayment(store, before, before.input.payment.amountCents - 1));
  // The edit cannot reach storage until the approval critical section exits.
  assert.equal(store.writes(), 0);
  release.resolve();
  await approval; await edit;
  const current = store.cases()['OPS-105'];
  assert.equal(current.input.payment.amountCents, before.input.payment.amountCents - 1);
  assert.equal(current.review, undefined);
  assert.equal(assessCase(current.input).decision, 'blocked');
  assert.equal(current.history.at(-1).event, 'Evidence updated');
  assert.ok(!currentReview(current.input, assessCase(current.input).drafts, current.review));
});
test('sequential latest-state case mutation preserves unrelated concurrent edits', async () => {
  const cases = seed(), second = structuredClone(operationCases[0]), assessment = assessCase(second);
  cases[second.id] = { input: second, analyzed: true, drafts: assessment.drafts, history: [] };
  const storage = mockStore(cases), locks = lockManager();
  const before = storage.cases();
  const changeA = { ...before, 'OPS-105': { ...before['OPS-105'], drafts: { ...before['OPS-105'].drafts, internal: 'Fresh local draft' } } };
  const changeB = { ...before, 'OPS-101': { ...before['OPS-101'], input: { ...before['OPS-101'].input, owner: 'Another owner' } } };
  await Promise.all([
    withWorkspaceWriteLock(locks, () => writeWorkspaceChange(storage, before, changeA, latest => ({ ...latest, 'OPS-105': { ...latest['OPS-105'], drafts: changeA['OPS-105'].drafts } }))),
    withWorkspaceWriteLock(locks, () => writeWorkspaceChange(storage, before, changeB, latest => ({ ...latest, 'OPS-101': { ...latest['OPS-101'], input: changeB['OPS-101'].input } }))),
  ]);
  assert.equal(storage.cases()['OPS-105'].drafts.internal, 'Fresh local draft');
  assert.equal(storage.cases()['OPS-101'].input.owner, 'Another owner');
});
test('a second tab cannot overwrite an already saved same-case edit with an older version', async () => {
  const store = mockStore(), before = store.cases();
  const change1 = structuredClone(before); change1['OPS-105'].drafts.client += ' First change';
  const change2 = structuredClone(before); change2['OPS-105'].drafts.client += ' Stale change';
  const locks = lockManager();
  await withWorkspaceWriteLock(locks, () => writeWorkspaceChange(store, before, change1));
  const written = store.getItem(WORKSPACE_STORAGE_KEY), writes = store.writes();
  await assert.rejects(
    withWorkspaceWriteLock(locks, () => writeWorkspaceChange(store, before, change2)),
    WorkspaceWriteError,
  );
  assert.equal(store.getItem(WORKSPACE_STORAGE_KEY), written);
  assert.equal(store.writes(), writes);
});
test('review and case editing fail closed if native cross-tab locking is unavailable', async () => {
  const store = mockStore(), snapshot = capture(store);
  await assert.rejects(withWorkspaceWriteLock(undefined, () => submit(store, snapshot)), WorkspaceWriteError);
  await assert.rejects(withWorkspaceWriteLock(undefined, () => changePayment(store, store.cases()['OPS-105'], 1)()), WorkspaceWriteError);
  assert.equal(store.writes(), 0);
});

function twoKeyStorage(initial = {}) {
  const keys = new Map(Object.entries(initial));
  let writes = [];
  return {
    getItem(k) { return keys.get(k) ?? null; },
    setItem(k,v) { keys.set(k,v); writes.push({key:k,value:v}); },
    writes() { return writes.slice(); },
    raw(k) { return keys.get(k) ?? null; },
  };
}
test('first v2 migration retains evidence, drafts and history, but requires fresh review', () => {
  const cases = seed();
  const assessed = assessCase(cases['OPS-105'].input);
  cases['OPS-105'].review = recordReview(cases['OPS-105'].input,assessed,cases['OPS-105'].drafts,'Original reviewer','approved','',at);
  cases['OPS-105'].history.push({id:'h1',at,event:'Plan approved locally',detail:'Earlier review'});
  cases['OPS-105'].drafts.client += ' Custom wording';
  // The old review signature is intentionally not valid for the new draft.
  const previous = JSON.stringify({version:ENGINE_VERSION,cases});
  const store = twoKeyStorage({[LEGACY_WORKSPACE_STORAGE_KEY]:previous});
  const copied = initializeWorkspaceStore(store);
  assert.equal(copied.migrated,true);
  assert.equal(copied.workspaces['OPS-105'].input.payment.amountCents,4800000);
  assert.equal(copied.workspaces['OPS-105'].drafts.client.endsWith('Custom wording'),true);
  assert.equal(copied.workspaces['OPS-105'].history.length,1);
  assert.equal(copied.workspaces['OPS-105'].review,undefined);
  assert.equal(store.raw(LEGACY_WORKSPACE_STORAGE_KEY),previous);
  assert.ok(store.raw(WORKSPACE_STORAGE_KEY));
});
test('old open tabs cannot overwrite new authoritative evidence after migration', () => {
  const oldState = seed();
  const original = JSON.stringify({version:ENGINE_VERSION,cases:oldState});
  const store = twoKeyStorage({[LEGACY_WORKSPACE_STORAGE_KEY]:original});
  initializeWorkspaceStore(store);
  const latest = restoreWorkspaces(store.raw(WORKSPACE_STORAGE_KEY));
  const modified = structuredClone(latest);
  modified['OPS-105'].input.payment.amountCents=4799999;
  modified['OPS-105'].analyzed=false;modified['OPS-105'].drafts=undefined;
  writeWorkspaceChange(store,latest,modified);
  const authoritativeBefore = store.raw(WORKSPACE_STORAGE_KEY);
  // Simulates the exact legacy unlocked full-workspace save after a pause.
  const staleWriter = seed();
  staleWriter['OPS-105'].review = recordReview(staleWriter['OPS-105'].input,
    assessCase(staleWriter['OPS-105'].input),staleWriter['OPS-105'].drafts,'Stale tab','approved','',at);
  store.setItem(LEGACY_WORKSPACE_STORAGE_KEY,JSON.stringify({version:ENGINE_VERSION,cases:staleWriter}));
  assert.equal(store.raw(WORKSPACE_STORAGE_KEY),authoritativeBefore);
  const current = restoreWorkspaces(store.raw(WORKSPACE_STORAGE_KEY))['OPS-105'];
  assert.equal(current.input.payment.amountCents,4799999);
  assert.equal(current.review,undefined);
  assert.equal(current.history.some(x=>x.event==='Plan approved locally'),false);
  assert.equal(store.raw(LEGACY_WORKSPACE_STORAGE_KEY)===original,false);
});
test('second new tab never migrates old key again or rolls back a newer v2 edit', () => {
  const store=twoKeyStorage({[LEGACY_WORKSPACE_STORAGE_KEY]:JSON.stringify({version:ENGINE_VERSION,cases:seed()})});
  initializeWorkspaceStore(store);
  const before=restoreWorkspaces(store.raw(WORKSPACE_STORAGE_KEY)),edited=structuredClone(before);
  edited['OPS-105'].drafts.client+=' V2 edit';
  writeWorkspaceChange(store,before,edited);
  const stable=store.raw(WORKSPACE_STORAGE_KEY);
  store.setItem(LEGACY_WORKSPACE_STORAGE_KEY,JSON.stringify({version:ENGINE_VERSION,cases:seed()}));
  const second=initializeWorkspaceStore(store);
  assert.equal(second.migrated,false);
  assert.equal(second.workspaces['OPS-105'].drafts.client.endsWith('V2 edit'),true);
  assert.equal(store.raw(WORKSPACE_STORAGE_KEY),stable);
});
test('invalid or changing old data never replaces a protected v2 record', () => {
  const store=twoKeyStorage({[LEGACY_WORKSPACE_STORAGE_KEY]:'not json'});
  assert.throws(()=>initializeWorkspaceStore(store),/could not be read safely/);
  assert.equal(store.raw(WORKSPACE_STORAGE_KEY),null);
  store.setItem(WORKSPACE_STORAGE_KEY,'not valid');
  assert.throws(()=>initializeWorkspaceStore(store),/JSON/);
  assert.equal(store.raw(WORKSPACE_STORAGE_KEY),'not valid');
});

test('legacy same-case edit after a review opens rejects confirmation without touching v2', () => {
  const store=twoKeyStorage({[LEGACY_WORKSPACE_STORAGE_KEY]:JSON.stringify({version:ENGINE_VERSION,cases:seed()})});
  initializeWorkspaceStore(store);
  const w=restoreWorkspaces(store.raw(WORKSPACE_STORAGE_KEY))['OPS-105'];
  const snapshot=captureReviewSnapshot(w.input,w.drafts,legacyCaseVersion(store,'OPS-105'));
  const newer=seed();newer['OPS-105'].input.payment.amountCents=4799999;
  newer['OPS-105'].analyzed=false;newer['OPS-105'].drafts=undefined;
  store.setItem(LEGACY_WORKSPACE_STORAGE_KEY,JSON.stringify({version:ENGINE_VERSION,cases:newer}));
  const before=store.raw(WORKSPACE_STORAGE_KEY);
  assert.throws(()=>writeCurrentReview(store,snapshot,'QA Reviewer','approved','',at),StaleReviewError);
  assert.equal(store.raw(WORKSPACE_STORAGE_KEY),before);
  assert.equal(store.writes().filter(x=>x.key===WORKSPACE_STORAGE_KEY).length,1);
});

test('a legacy writer interleaved after authoritative v2 read is caught at commit', () => {
  const seedRaw=JSON.stringify({version:ENGINE_VERSION,cases:seed()});
  const stable=twoKeyStorage({[LEGACY_WORKSPACE_STORAGE_KEY]:seedRaw});
  initializeWorkspaceStore(stable);
  const workspace=restoreWorkspaces(stable.raw(WORKSPACE_STORAGE_KEY))['OPS-105'];
  const snapshot=captureReviewSnapshot(workspace.input,workspace.drafts,legacyCaseVersion(stable,'OPS-105'));
  const changed=seed();changed['OPS-105'].input.payment.amountCents=4799999;
  const nextLegacy=JSON.stringify({version:ENGINE_VERSION,cases:changed});
  let injected=false;
  const storage={
    getItem(key) {
      const result=stable.getItem(key);
      if(key===WORKSPACE_STORAGE_KEY&&!injected) {
        injected=true;
        stable.setItem(LEGACY_WORKSPACE_STORAGE_KEY,nextLegacy);
      }
      return result;
    },
    setItem:stable.setItem,
  };
  const before=stable.raw(WORKSPACE_STORAGE_KEY);
  assert.throws(()=>writeCurrentReview(storage,snapshot,'QA Reviewer','approved','',at),StaleReviewError);
  assert.equal(stable.raw(WORKSPACE_STORAGE_KEY),before);
  assert.equal(stable.writes().filter(w=>w.key===WORKSPACE_STORAGE_KEY).length,1);
});
