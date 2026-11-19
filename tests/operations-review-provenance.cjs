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
  LEGACY_WORKSPACE_STORAGE_KEY, initializeWorkspaceStore, inspectLegacyWorkspace, readAuthoritativeWorkspace, createAuthoritativeReviewPacket,
} = require('../app/lib/workspace.ts');

const { addImportedCase, parseCaseCsv, CSV_TEMPLATE } = require('../app/lib/operations-import.ts');
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

function legacyRaw(cases = seed()) {
  return JSON.stringify({ version: ENGINE_VERSION, cases });
}
function savedReview(store, id = 'OPS-105') {
  const w = restoreWorkspaces(store.raw(WORKSPACE_STORAGE_KEY))[id];
  return w.review && currentReview(w.input, w.drafts, w.review) ? w.review : undefined;
}
test('one-time migration preserves imported evidence, custom drafts, full history, and clears old approval', async () => {
  const cases = seed();
  const builtIn = cases['OPS-105'];
  builtIn.review = recordReview(builtIn.input, assessCase(builtIn.input), builtIn.drafts, 'Old reviewer', 'approved', '', at);
  builtIn.history.push({ id: 'h1', at, event: 'Plan approved locally', detail: 'Previous local review' });
  builtIn.drafts.internal += ' Custom legacy internal text.';
  builtIn.drafts.client += ' Custom legacy client text.';

  const imported = parseCaseCsv(CSV_TEMPLATE, {
    id: 'IMP-00000000-0000-4000-8000-000000000002',
    fileName: 'legacy-case.csv', at,
  }).input;
  assert.ok(imported);
  const importedCases = addImportedCase(cases, imported, { id: 'import-h1', at, event: 'Case imported', detail: 'CSV added' });
  const previous = legacyRaw(importedCases);
  const store = twoKeyStorage({ [LEGACY_WORKSPACE_STORAGE_KEY]: previous });
  const migrated = await initializeWorkspaceStore(store);
  assert.equal(migrated.migrated, true);
  assert.equal(store.raw(LEGACY_WORKSPACE_STORAGE_KEY), previous);
  const authoritative = readAuthoritativeWorkspace(store);
  assert.equal(authoritative.workspaces['OPS-105'].input.payment.amountCents, 4800000);
  assert.match(authoritative.workspaces['OPS-105'].drafts.internal, /Custom legacy internal/);
  assert.match(authoritative.workspaces['OPS-105'].drafts.client, /Custom legacy client/);
  assert.deepEqual(authoritative.workspaces['OPS-105'].history, builtIn.history);
  assert.equal(authoritative.workspaces['OPS-105'].review, undefined);
  assert.equal(authoritative.workspaces[imported.id].importedOriginal.orderId, imported.orderId);
  assert.deepEqual(authoritative.workspaces[imported.id].history, importedCases[imported.id].history);
  assert.match(authoritative.legacyBaseline, /^[0-9a-f]{64}$/);
  assert.equal((await inspectLegacyWorkspace(store)).status, 'unchanged');
  assert.equal((await initializeWorkspaceStore(store)).migrated, false);
  assert.equal(store.writes().filter(w => w.key === WORKSPACE_STORAGE_KEY).length, 1);
});

test('legacy writes before migration are included; writes during migration are quarantined', async () => {
  const initial = legacyRaw(seed());
  const updated = seed();
  updated['OPS-105'].input.payment.amountCents = 4799999;
  const changed = legacyRaw(updated);
  const before = twoKeyStorage({ [LEGACY_WORKSPACE_STORAGE_KEY]: changed });
  await initializeWorkspaceStore(before);
  assert.equal(readAuthoritativeWorkspace(before).workspaces['OPS-105'].input.payment.amountCents, 4799999);
  assert.equal((await inspectLegacyWorkspace(before)).status, 'unchanged');

  const middle = twoKeyStorage({ [LEGACY_WORKSPACE_STORAGE_KEY]: initial });
  let injected = false;
  const interrupted = {
    getItem(key) {
      const value = middle.getItem(key);
      if (key === LEGACY_WORKSPACE_STORAGE_KEY && !injected) {
        injected = true;
        middle.setItem(LEGACY_WORKSPACE_STORAGE_KEY, changed);
      }
      return value;
    },
    setItem: middle.setItem,
  };
  await initializeWorkspaceStore(interrupted);
  assert.equal(readAuthoritativeWorkspace(middle).workspaces['OPS-105'].input.payment.amountCents, 4800000);
  assert.equal(middle.raw(LEGACY_WORKSPACE_STORAGE_KEY), changed);
  assert.equal((await inspectLegacyWorkspace(middle)).status, 'changed');
  assert.equal(middle.writes().filter(w => w.key === WORKSPACE_STORAGE_KEY).length, 1);
});

test('old unlocked v1 writes never overwrite authoritative v2, approvals or activity', async () => {
  const store = twoKeyStorage({ [LEGACY_WORKSPACE_STORAGE_KEY]: legacyRaw() });
  await initializeWorkspaceStore(store);
  const before = readAuthoritativeWorkspace(store).workspaces;
  const edited = clone(before);
  edited['OPS-105'].input.payment.amountCents = 4799999;
  edited['OPS-105'].analyzed = false;
  edited['OPS-105'].drafts = undefined;
  edited['OPS-105'].history.push({ id: 'v2-change', at, event: 'Evidence updated', detail: 'Payment corrected' });
  writeWorkspaceChange(store, before, edited);
  const saved = store.raw(WORKSPACE_STORAGE_KEY);
  const stale = seed();
  stale['OPS-105'].review = recordReview(stale['OPS-105'].input, assessCase(stale['OPS-105'].input),
    stale['OPS-105'].drafts, 'Outdated tab', 'approved', '', at);
  store.setItem(LEGACY_WORKSPACE_STORAGE_KEY, legacyRaw(stale));
  assert.equal(store.raw(WORKSPACE_STORAGE_KEY), saved);
  const v2 = readAuthoritativeWorkspace(store).workspaces['OPS-105'];
  assert.equal(v2.input.payment.amountCents, 4799999);
  assert.equal(v2.review, undefined);
  assert.deepEqual(v2.history.map(e => e.event), ['Evidence updated']);
  assert.equal((await inspectLegacyWorkspace(store)).status, 'changed');
  assert.equal((await initializeWorkspaceStore(store)).migrated, false);
  assert.equal(store.raw(WORKSPACE_STORAGE_KEY), saved);
});

test('legacy-only write during an open confirmation leaves fresh v2 review approvable', async () => {
  const store = twoKeyStorage({ [LEGACY_WORKSPACE_STORAGE_KEY]: legacyRaw() });
  await initializeWorkspaceStore(store);
  const w = readAuthoritativeWorkspace(store).workspaces['OPS-105'];
  const snapshot = captureReviewSnapshot(w.input, w.drafts);
  const old = seed(); old['OPS-105'].drafts.client += ' Legacy only change';
  store.setItem(LEGACY_WORKSPACE_STORAGE_KEY, legacyRaw(old));
  const result = writeCurrentReview(store, snapshot, 'QA Reviewer', 'approved', '', at);
  assert.ok(currentReview(result.workspaces['OPS-105'].input, result.workspaces['OPS-105'].drafts, result.review));
  assert.equal(savedReview(store).reviewer, 'QA Reviewer');
  assert.equal(result.workspaces['OPS-105'].history.at(-1).event, 'Plan approved locally');
  assert.equal((await inspectLegacyWorkspace(store)).status, 'changed');
  const packet = exportCase(result.workspaces['OPS-105'].input, assessCase(result.workspaces['OPS-105'].input),
    result.workspaces['OPS-105'].drafts, result.review, result.workspaces['OPS-105'].history);
  assert.match(packet, /approved by QA Reviewer/);
  assert.match(packet, /Local activity/);
  assert.match(packet, /No external action was executed/);
});

test('1.2-second interrupted-read/write: both v2-first and v1-first orders remain truthful', async () => {
  for (const ordering of ['v1-first', 'v2-first']) {
    const store = twoKeyStorage({ [LEGACY_WORKSPACE_STORAGE_KEY]: legacyRaw() });
    await initializeWorkspaceStore(store);
    const locks = lockManager(), opened = deferred(), release = deferred();
    const current = readAuthoritativeWorkspace(store).workspaces;
    const snapshot = captureReviewSnapshot(current['OPS-105'].input, current['OPS-105'].drafts);
    const pendingV2 = withWorkspaceWriteLock(locks, async () => {
      opened.resolve();
      await release.promise;
      return writeCurrentReview(store, snapshot, 'QA Reviewer', 'approved', '', at);
    });
    await opened.promise;
    assert.equal(savedReview(store), undefined);
    // The old tab is not patched and never acquires v2 Web Locks.
    const old = seed(); old['OPS-105'].input.payment.amountCents -= 1;
    if (ordering === 'v1-first') {
      store.setItem(LEGACY_WORKSPACE_STORAGE_KEY, legacyRaw(old));
    }
    await new Promise(resolve => setTimeout(resolve, 1200));
    release.resolve();
    const approved = await pendingV2;
    assert.ok(currentReview(approved.workspaces['OPS-105'].input, approved.workspaces['OPS-105'].drafts, approved.review));
    if (ordering === 'v2-first') store.setItem(LEGACY_WORKSPACE_STORAGE_KEY, legacyRaw(old));
    assert.equal(savedReview(store).reviewer, 'QA Reviewer');
    assert.equal((await inspectLegacyWorkspace(store)).status, 'changed');
    assert.equal(readAuthoritativeWorkspace(store).workspaces['OPS-105'].history.length, 1);
  }
});

test('v2 evidence and draft changes invalidate prior approval; v1-only changes do not', async () => {
  const store = twoKeyStorage({ [LEGACY_WORKSPACE_STORAGE_KEY]: legacyRaw() });
  await initializeWorkspaceStore(store);
  const first = readAuthoritativeWorkspace(store).workspaces;
  writeCurrentReview(store, captureReviewSnapshot(first['OPS-105'].input, first['OPS-105'].drafts),
    'QA Reviewer', 'approved', '', at);
  const old = seed(); old['OPS-105'].drafts.internal += ' unsynchronized v1';
  store.setItem(LEGACY_WORKSPACE_STORAGE_KEY, legacyRaw(old));
  assert.ok(savedReview(store));
  assert.equal((await inspectLegacyWorkspace(store)).status, 'changed');

  const v2 = readAuthoritativeWorkspace(store).workspaces;
  const next = clone(v2);
  next['OPS-105'].drafts.client += ' v2 changed';
  next['OPS-105'].review = undefined;
  next['OPS-105'].history.push({ id: 'v2-edit', at, event: 'Drafts edited', detail: 'V2 draft updated' });
  writeWorkspaceChange(store, v2, next);
  assert.equal(savedReview(store), undefined);
  const saved = readAuthoritativeWorkspace(store).workspaces['OPS-105'];
  assert.equal(saved.history.at(-1).event, 'Drafts edited');
  const packet = exportCase(saved.input, assessCase(saved.input), saved.drafts, saved.review, saved.history);
  assert.match(packet, /Pending human review/);
  assert.doesNotMatch(packet, /approved by QA Reviewer/);
  assert.equal((await inspectLegacyWorkspace(store)).status, 'changed');
});

test('reload shows persistent, accurate legacy warning and permits read-only exact backup', async () => {
  const store = twoKeyStorage({ [LEGACY_WORKSPACE_STORAGE_KEY]: legacyRaw() });
  await initializeWorkspaceStore(store);
  const before = store.raw(WORKSPACE_STORAGE_KEY);
  const old = seed(); old['OPS-105'].history.push({ id: 'later-v1', at, event: 'Legacy only', detail: 'Old tab change' });
  const exact = legacyRaw(old);
  store.setItem(LEGACY_WORKSPACE_STORAGE_KEY, exact);
  const observation = await inspectLegacyWorkspace(store);
  assert.equal(observation.status, 'changed');
  assert.equal(observation.raw, exact);
  assert.equal(observation.cases['OPS-105'].history[0].event, 'Legacy only');
  assert.equal((await inspectLegacyWorkspace(store)).status, 'changed');
  assert.equal(readAuthoritativeWorkspace(store).workspaces['OPS-105'].history.length, 0);
  assert.equal(store.raw(WORKSPACE_STORAGE_KEY), before);
});

test('malformed legacy, deleted legacy and pre-fix v2 stores remain isolated and inspectable', async () => {
  const store = twoKeyStorage({ [LEGACY_WORKSPACE_STORAGE_KEY]: legacyRaw() });
  await initializeWorkspaceStore(store);
  store.setItem(LEGACY_WORKSPACE_STORAGE_KEY, '{bad-legacy');
  const inspected = await inspectLegacyWorkspace(store);
  assert.equal(inspected.status, 'corrupt');
  assert.equal(inspected.raw, '{bad-legacy');
  assert.deepEqual(inspected.cases, {});
  assert.equal(readAuthoritativeWorkspace(store).workspaces['OPS-105'].input.payment.amountCents, 4800000);

  const missingLegacy = twoKeyStorage({ [LEGACY_WORKSPACE_STORAGE_KEY]: legacyRaw() });
  await initializeWorkspaceStore(missingLegacy);
  missingLegacy.getItem = key => key === LEGACY_WORKSPACE_STORAGE_KEY ? null : store.getItem(key);
  // Separately test the state using a valid v2 envelope and no v1 entry.
  assert.equal((await inspectLegacyWorkspace(missingLegacy)).status, 'changed');

  const preFix = twoKeyStorage({
    [WORKSPACE_STORAGE_KEY]: legacyRaw(),
    [LEGACY_WORKSPACE_STORAGE_KEY]: legacyRaw(),
  });
  assert.equal((await initializeWorkspaceStore(preFix)).migrated, false);
  assert.equal((await inspectLegacyWorkspace(preFix)).status, 'unverified');
  assert.equal(preFix.writes().length, 0);
});

test('invalid v1 before migration and invalid v2 after migration fail closed', async () => {
  const store = twoKeyStorage({ [LEGACY_WORKSPACE_STORAGE_KEY]: '{bad' });
  await assert.rejects(initializeWorkspaceStore(store), /could not be migrated safely/);
  assert.equal(store.raw(WORKSPACE_STORAGE_KEY), null);
  store.setItem(WORKSPACE_STORAGE_KEY, '{bad');
  await assert.rejects(initializeWorkspaceStore(store), /could not be read safely/);
  assert.equal(store.raw(WORKSPACE_STORAGE_KEY), '{bad');
  const before = seed(), changed = clone(before);
  changed['OPS-105'].drafts.internal += ' attempted write';
  assert.throws(() => writeWorkspaceChange(store, before, changed), /could not be read safely/);
  assert.equal(store.raw(WORKSPACE_STORAGE_KEY), '{bad');
});

test('storage failures and unavailable locks never acknowledge migration or review', async () => {
  const previous = legacyRaw();
  const store = twoKeyStorage({ [LEGACY_WORKSPACE_STORAGE_KEY]: previous });
  const denied = { getItem: store.getItem, setItem() { throw new Error('Write denied'); } };
  await assert.rejects(initializeWorkspaceStore(denied), /Write denied/);
  assert.equal(store.raw(WORKSPACE_STORAGE_KEY), null);
  const locks = lockManager();
  await withWorkspaceWriteLock(locks, () => initializeWorkspaceStore(store));
  const snapshot = captureReviewSnapshot(readAuthoritativeWorkspace(store).workspaces['OPS-105'].input,
    readAuthoritativeWorkspace(store).workspaces['OPS-105'].drafts);
  await assert.rejects(withWorkspaceWriteLock(undefined, () => writeCurrentReview(store,snapshot,'QA Reviewer','approved','',at)), WorkspaceWriteError);
  assert.equal(savedReview(store), undefined);
  await assert.rejects(withWorkspaceWriteLock(locks, () => writeCurrentReview(denied,snapshot,'QA Reviewer','approved','',at)), /Write denied/);
  assert.equal(savedReview(store), undefined);
});

test('silent localStorage write drop never acknowledges migration, v2 edit or approval', async () => {
  const first = twoKeyStorage({ [LEGACY_WORKSPACE_STORAGE_KEY]: legacyRaw() });
  const noOpMigration = {
    getItem: first.getItem,
    setItem() { /* Simulated storage adapter silently drops writes */ },
  };
  await assert.rejects(initializeWorkspaceStore(noOpMigration), /could not be verified/);
  assert.equal(first.raw(WORKSPACE_STORAGE_KEY), null);
  assert.equal(first.raw(LEGACY_WORKSPACE_STORAGE_KEY), legacyRaw());

  await initializeWorkspaceStore(first);
  const before = readAuthoritativeWorkspace(first).workspaces;
  const noOp = { getItem: first.getItem, setItem() {} };
  const signature = captureReviewSnapshot(before['OPS-105'].input, before['OPS-105'].drafts);
  const rawBefore = first.raw(WORKSPACE_STORAGE_KEY);
  assert.throws(() => writeCurrentReview(noOp, signature, 'Browser QA', 'approved', '', at), /could not be verified/);
  assert.equal(first.raw(WORKSPACE_STORAGE_KEY), rawBefore);
  assert.equal(readAuthoritativeWorkspace(first).workspaces['OPS-105'].review, undefined);

  const edited = clone(before);
  edited['OPS-105'].drafts.internal += ' New v2 text';
  edited['OPS-105'].review = undefined;
  assert.throws(() => writeWorkspaceChange(noOp, before, edited), /could not be verified/);
  assert.equal(first.raw(WORKSPACE_STORAGE_KEY), rawBefore);
});

test('export of a current approved v2 review uses exact saved evidence and drafts', () => {
  const store=mockStore(), snapshot=capture(store);
  submit(store,snapshot);
  const report=createAuthoritativeReviewPacket(store,'OPS-105');
  const current=store.cases()['OPS-105'];
  assert.equal(report.currentStatus,'approved');
  assert.equal(report.filename,'Lighthouse-OPS-105-review.md');
  assert.match(report.content,/approved by QA Reviewer/);
  assert.ok(report.content.includes(current.drafts.internal));
  assert.ok(report.content.includes(current.drafts.client));
  assert.equal(report.content.includes('Pending human review.'),false);
});
test('stale React approval must never determine payment evidence export', () => {
  const store=mockStore(), snapshot=capture(store);
  submit(store,snapshot);
  const tabARender=store.cases()['OPS-105'];
  externalChange(store, w=>{
    w.input.payment.amountCents=4799999;
    w.analyzed=false;
    w.drafts=undefined;
    w.review=undefined;
  });
  // Tab A never received a storage event; its previous render is still approved.
  assert.ok(tabARender.review);
  const report=createAuthoritativeReviewPacket(store,'OPS-105');
  assert.equal(report.currentStatus,'pending');
  assert.match(report.content,/Pending human review/);
  assert.match(report.content,/47,999\.99/);
  assert.doesNotMatch(report.content,/approved by QA Reviewer/);
  assert.match(report.content,/unreviewed templates below were generated/);
  assert.equal(store.cases()['OPS-105'].review,undefined);
});
for(const kind of ['internal','client']){
  test('stale React approval cannot export old '+kind+' message draft as approved',()=>{
    const store=mockStore(),snapshot=capture(store);
    submit(store,snapshot);
    const earlier=store.cases()['OPS-105'][ 'drafts' ][kind];
    externalChange(store,w=>{w.drafts[kind] += ' UPDATED IN OTHER TAB';w.review=undefined;});
    const report=createAuthoritativeReviewPacket(store,'OPS-105');
    assert.equal(report.currentStatus,'pending');
    assert.match(report.content,/Pending human review/);
    assert.ok(report.content.includes(earlier+' UPDATED IN OTHER TAB'));
    assert.doesNotMatch(report.content,/approved by QA Reviewer/);
  });
}
test('authoritative export does not read legacy v1 data after strict cutover',async()=>{
  const store=twoKeyStorage({[LEGACY_WORKSPACE_STORAGE_KEY]:JSON.stringify({version:ENGINE_VERSION,cases:seed()})});
  await initializeWorkspaceStore(store);
  const old=JSON.parse(store.getItem(LEGACY_WORKSPACE_STORAGE_KEY));
  old.cases['OPS-105'].input.payment.amountCents=4799999;
  store.setItem(LEGACY_WORKSPACE_STORAGE_KEY,JSON.stringify(old));
  const packet=createAuthoritativeReviewPacket(store,'OPS-105');
  assert.equal(packet.currentStatus,'pending');
  assert.match(packet.content,/48,000\.00/);
  assert.doesNotMatch(packet.content,/47,999\.99/);
});
test('authoritative export fails closed if case is absent or v2 storage is corrupt',()=>{
  const store=mockStore();
  assert.throws(()=>createAuthoritativeReviewPacket(store,'OPS-NOT-FOUND'),WorkspaceWriteError);
  const broken={getItem:()=>'{',setItem(){}};
  assert.throws(()=>createAuthoritativeReviewPacket(broken,'OPS-105'),WorkspaceWriteError);
});
