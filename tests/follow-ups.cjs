const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, filename);
const { applyFollowUpAction, restoreFollowUps, openFollowUps, dueInfo, validDueDate, localDateKey, tomorrowKey, FOLLOW_UP_VERSION } = require('../app/lib/follow-ups.ts');
const { operationCases, assessCase } = require('../app/lib/operations.ts');
const { workspaceCases, portfolioTotals } = require('../app/lib/workspace.ts');
const account = 'partner-OPS-101', at = '2026-11-17T03:00:00.000Z';
const draft = { title: 'Confirm cleared payment', owner: 'Finance', dueDate: '2026-11-17' };
const act = (store, action, revision = store[account]?.revision ?? 0, id = `event-${revision}`) => applyFollowUpAction(store, account, revision, action, at, id);
const create = () => act({}, { kind: 'save', draft });
const roundtrip = store => restoreFollowUps(JSON.stringify({ version: FOLLOW_UP_VERSION, accounts: store }));

test('one open follow-up can be edited without replacing its identity or mutating earlier data', () => {
  const first = create(), original = structuredClone(first);
  const next = act(first, { kind: 'save', draft: { ...draft, dueDate: '2026-11-18', owner: 'Rafa' } });
  assert.deepEqual(first, original);
  assert.equal(next[account].followUp.id, first[account].followUp.id);
  assert.equal(next[account].activity.length, 2);
  assert.equal(next[account].activity[0].task.owner, 'Finance');
  assert.equal(next[account].activity[1].task.owner, 'Rafa');
  assert.equal(openFollowUps(next, [account]).length, 1);
});
test('complete, reload and reopen preserve the task and its activity trail', () => {
  const done = roundtrip(act(create(), { kind: 'complete' }));
  assert.equal(done[account].followUp.status, 'completed');
  assert.equal(done[account].followUp.completedAt, at);
  assert.equal(openFollowUps(done, [account]).length, 0);
  const reopened = act(done, { kind: 'reopen' });
  assert.equal(reopened[account].followUp.status, 'open');
  assert.equal(reopened[account].followUp.completedAt, undefined);
  assert.equal(openFollowUps(reopened, [account]).length, 1);
  assert.deepEqual(reopened[account].activity.map(e => e.kind), ['created', 'completed', 'reopened']);
});
test('a new follow-up after completion retains the previous task in history', () => {
  const done = act(create(), { kind: 'complete' });
  const next = act(done, { kind: 'save', draft: { ...draft, title: 'Request human release review' } });
  assert.notEqual(next[account].followUp.id, done[account].followUp.id);
  assert.equal(next[account].activity[1].task.title, draft.title);
  assert.equal(next[account].followUp.status, 'open');
});
test('completed follow-ups never clear case evidence, blockers, approval or portfolio exposure', () => {
  const caseState = { [operationCases[0].id]: { input: structuredClone(operationCases[0]), analyzed: true, history: [] } };
  const before = structuredClone(caseState);
  const totals = portfolioTotals(workspaceCases(caseState));
  act(create(), { kind: 'complete' });
  assert.deepEqual(caseState, before);
  assert.equal(assessCase(caseState['OPS-101'].input).decision, 'blocked');
  assert.deepEqual(portfolioTotals(workspaceCases(caseState)), totals);
});
test('stale edits and duplicate completions are rejected rather than overwriting newer work', () => {
  const updated = act(create(), { kind: 'save', draft: { ...draft, owner: 'Rafa' } });
  assert.throws(() => act(updated, { kind: 'save', draft }, 1), /changed in another view/);
  const done = act(updated, { kind: 'complete' });
  assert.throws(() => act(done, { kind: 'complete' }), /already changed/);
  assert.throws(() => act({}, { kind: 'save', draft }, 1), /changed in another view/);
});
test('calendar dates handle month boundaries, leap years and daylight saving without UTC shifting', () => {
  assert.equal(validDueDate('2026-02-29'), false);
  assert.equal(validDueDate('2028-02-29'), true);
  assert.equal(validDueDate('2026-13-01'), false);
  assert.equal(dueInfo('2026-11-16', '2026-11-17').label, '1 day overdue');
  assert.equal(dueInfo('2026-11-17', '2026-11-17').label, 'Due today');
  assert.equal(dueInfo('2026-11-18', '2026-11-17').label, 'Due tomorrow');
  assert.equal(dueInfo('2026-03-09', '2026-03-08').days, 1);
  assert.equal(tomorrowKey(new Date(2026,11,31,23,59)), '2027-01-01');
  assert.equal(localDateKey(new Date(2026,10,16,20,30)), '2026-11-16');
});
test('Today lists only active accounts, sorts overdue before upcoming and excludes completed work', () => {
  let store = create();
  store = applyFollowUpAction(store, 'ACC001', 0, { kind: 'save', draft: { ...draft, dueDate: '2026-11-15' } }, at, 'earlier');
  store = applyFollowUpAction(store, 'partner-OPS-102', 0, { kind: 'save', draft: { ...draft, dueDate: '2026-11-20' } }, at, 'later');
  store = applyFollowUpAction(store, 'partner-IMP-removed', 0, { kind: 'save', draft: { ...draft, dueDate: '2026-11-01' } }, at, 'orphan');
  assert.deepEqual(openFollowUps(store, ['ACC001',account,'partner-OPS-102']).map(t => t.accountId), ['ACC001',account,'partner-OPS-102']);
});
test('notes persist independently of follow-ups and history stays bounded', () => {
  let store = act({}, { kind: 'note', note: 'Finance is checking the reference.' });
  assert.equal(store[account].followUp, undefined);
  for (let i = 0; i < 55; i++) store = act(store, { kind: 'note', note: `Update ${i}` });
  const restored = roundtrip(store);
  assert.equal(restored[account].activity.length, 50);
  assert.equal(restored[account].activity.at(-1).note, 'Update 54');
});
test('invalid storage, forged account keys and invalid tasks are not restored', () => {
  assert.deepEqual(restoreFollowUps('not JSON'), {});
  assert.deepEqual(restoreFollowUps(JSON.stringify({ version: 99, accounts: create() })), {});
  const invalid = create(); invalid[account].followUp.dueDate = '2026-02-30';
  assert.deepEqual(roundtrip(invalid), {});
  assert.throws(() => applyFollowUpAction({}, '__proto__', 0, {kind:'save',draft}, at, 'id'), /could not be saved/);
  assert.throws(() => act({}, { kind:'save', draft: {...draft, title:'   '} }), /Enter a task/);
  assert.throws(() => act({}, { kind:'note', note:' ' }), /Write a note/);
  const badEvent = create(); badEvent[account].activity.push({id:'bad',at:'yesterday',kind:'note',note:'bad'});
  assert.equal(roundtrip(badEvent)[account].activity.length, 1);
});
test('saving identical fields does not generate repetitive activity', () => {
  const store = create(); assert.equal(act(store, {kind:'save',draft}), store);
});
