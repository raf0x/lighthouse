const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, filename);
const { operationCases, evidenceFor, inputSignature, scenarioDate, money } = require('../app/lib/operations.ts');
const { checkAgentRun, restoreAgentRun } = require('../app/lib/operations-agent.ts');
const read = name => JSON.parse(fs.readFileSync(require.resolve(`../docs/evals/${name}`), 'utf8'));
const selected = [
  read('operations-agent-concise-v4-ui.json'),
  read('operations-agent-concise-v4-final.json').cases[0].run,
  read('operations-agent-concise-v4.json').cases.find(c => c.caseId === 'OPS-105').run,
  read('operations-agent-concise-v4-plain.json').cases.find(c => c.caseId === 'OPS-110').run,
];

test('the same server runs and source records validate despite alternate Intl display patterns', () => {
  const DateFormat = Intl.DateTimeFormat, NumberFormat = Intl.NumberFormat;
  const before = operationCases.map(evidenceFor);
  // Reproduce the failure mode, not an iPhone browser: display strings/literals
  // can differ while the numeric parts and underlying records stay identical.
  Intl.DateTimeFormat = function(...args) {
    const original = new DateFormat(...args);
    return {
      format: date => original.format(date).replace(/, /g, ' at ').replace('EST', 'GMT-5'),
      formatToParts: date => original.formatToParts(date).map(part => part.type === 'literal' ? {...part, value:' / '} : part).reverse(),
    };
  };
  Intl.NumberFormat = function() { return { format: () => '48.000,00 USD' }; };
  try {
    assert.deepEqual(operationCases.map(evidenceFor), before);
    for (const run of selected) {
      const input = operationCases.find(c => c.id === run.caseId);
      assert.equal(inputSignature(input), run.inputSignature);
      assert.equal(restoreAgentRun(run, input)?.runId, run.runId, run.caseId);
    }
  } finally { Intl.DateTimeFormat = DateFormat; Intl.NumberFormat = NumberFormat; }
});

test('canonical Eastern dates preserve DST transitions, midnight, noon, and year rollover', () => {
  for (const [iso, expected] of [
    ['2026-11-16T10:00:00.000Z', 'Nov 16, 5:00 AM EST'],
    ['2026-03-08T06:59:00.000Z', 'Mar 8, 1:59 AM EST'],
    ['2026-03-08T07:00:00.000Z', 'Mar 8, 3:00 AM EDT'],
    ['2026-11-01T05:59:00.000Z', 'Nov 1, 1:59 AM EDT'],
    ['2026-11-01T06:00:00.000Z', 'Nov 1, 1:00 AM EST'],
    ['2026-11-16T05:00:00.000Z', 'Nov 16, 12:00 AM EST'],
    ['2026-11-16T17:00:00.000Z', 'Nov 16, 12:00 PM EST'],
    ['2026-01-01T04:59:00.000Z', 'Dec 31, 11:59 PM EST'],
  ]) assert.equal(scenarioDate(iso), expected);
});

test('canonical money preserves exact cents and currency without locale formatting', () => {
  assert.equal(money(1, 'USD'), 'USD 0.01');
  assert.equal(money(101, 'CAD'), 'CAD 1.01');
  assert.equal(money(4800000, 'USD'), 'USD 48,000.00');
  assert.equal(money(999999999, 'MXN'), 'MXN 9,999,999.99');
  assert.equal(money(0, 'USD'), 'USD 0.00');
});

test('response diagnostics distinguish stale pages, changed evidence, and failed citations', () => {
  const run = selected[0], input = operationCases[0];
  assert.equal(checkAgentRun({...run, version:'investigator-old'}, input).failure.code, 'outdated_page');
  const changed = {...input, approvedEntity:'A different approved entity'};
  assert.equal(checkAgentRun(run, changed).failure.code, 'evidence_changed');
  assert.equal(restoreAgentRun(run, changed), null);
  const bad = JSON.parse(JSON.stringify(run)); bad.report.citations[0].value = 'Wrong entity';
  const checked = checkAgentRun(bad, input);
  assert.equal(checked.failure.code, 'citation_mismatch');
  assert.equal(checked.failure.usage.modelCalls, run.usage.modelCalls);
  assert.equal(restoreAgentRun(bad, input), null);
  bad.report = {...run.report, decision:'ready_for_review'};
  assert.equal(checkAgentRun(bad,input).failure.code, 'report_rejected');
});
