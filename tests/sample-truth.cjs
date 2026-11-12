const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, filename);
const { accounts, calculateHealthScore, bandLabel, mockAnalysis } = require('../app/lib/lighthouse.ts');
assert.deepEqual([29,30,49,50,69,70].map(bandLabel), ['Critical Risk','High Risk','High Risk','Watch','Watch','Healthy']);
for (const account of accounts) {
  const health = mockAnalysis(account, 'health');
  assert.ok(health.summary.includes(`${calculateHealthScore(account)}/100 (${bandLabel(calculateHealthScore(account))})`));
  assert.equal(health.confidence, undefined);
  const expansion = mockAnalysis(account, 'expansion');
  assert.ok(expansion.opportunities.every(o => !o.arr_lift));
  for (const type of ['health','expansion','briefing','email']) {
    const text = JSON.stringify(mockAnalysis(account, type));
    assert.ok(!/FY25|2\.1×|48 hours|90 days|cohort|confidence|arr_lift/.test(text));
  }
}
const read = p => fs.readFileSync(require('node:path').join(__dirname, '..', p), 'utf8');
assert.ok(!/Date\.now|daysToRenewal|Overdue|confidence =/.test(read('app/components/DecisionStrip.tsx')));
assert.ok(!/Date\.now|daysToRenewal|overdue/.test(read('app/portfolio/page.tsx')));
assert.ok(!/RelativeTime|18%|company avg/.test(read('app/components/AccountDetail.tsx')));
assert.ok(!/142ms|88ms|will scan/.test(read('app/components/AgentPanel.tsx')));
assert.ok(!/Send via Gmail|Snooze|est\. ARR saved/.test(read('app/components/AgentResponse.tsx')));
console.log('PASS: sample health bands, evidence-bounded fallback output, historical dates, no fabricated confidence/deltas/tool traces/actions.');
