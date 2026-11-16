const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, filename);
const { operationCases, assessCase, evidenceFor } = require('../app/lib/operations.ts');
const { restoreAgentRun } = require('../app/lib/operations-agent.ts');
const { demoCase, demoStages } = require('../app/lib/operations-demo.ts');
const recording = require('../docs/evals/operations-agent-browser-fix-ui.json');

test('published recording remains a valid real run with its original correction trace', () => {
  const restored = restoreAgentRun(recording, demoCase('blocked'));
  assert.ok(restored);
  assert.deepEqual(restored.report, recording.report);
  assert.deepEqual(restored.trace, recording.trace);
  assert.equal(restored.firstSubmissionPassed, false);
  assert.equal(restored.usage.modelCalls, 3);
  // The earlier browser export can contain nonbreaking display spaces.
  const normalize = value => JSON.stringify(value).replace(/\u00a0|\u202f/g, ' ');
  assert.equal(normalize(evidenceFor(demoCase('blocked'))), normalize(recording.sourceRecords));
});

test('resolving sample records removes only the resolved blockers and retains the human gate', () => {
  const expected = [
    ['blocked', ['entity_mismatch', 'payment_pending']],
    ['blocked', ['payment_pending']],
    ['ready_for_review', []],
  ];
  demoStages.forEach((stage, i) => {
    const current = demoCase(stage), result = assessCase(current);
    assert.equal(result.decision, expected[i][0]);
    assert.deepEqual(result.findings.filter(f => f.severity === 'blocker').map(f => f.id), expected[i][1]);
    assert.equal(result.findings.find(f => f.id === 'deadline_near')?.severity, 'attention');
    assert.equal(current.approvedEntity, operationCases[0].approvedEntity);
    assert.equal(current.crmPaymentStatus, current.payment.status);
  });
});

test('what-if and reset cannot change the saved AI result or the original sample records', () => {
  const original = JSON.stringify(operationCases), saved = JSON.stringify(recording);
  for (const stage of demoStages) {
    const copy = demoCase(stage);
    copy.invoice.entity = 'Changed in isolated demo';
    copy.payment.status = 'cleared';
  }
  assert.equal(JSON.stringify(operationCases), original);
  assert.equal(JSON.stringify(recording), saved);
  assert.deepEqual(demoCase('blocked'), operationCases[0]);
  assert.equal(restoreAgentRun(recording, demoCase('payment_cleared')), null);
});
