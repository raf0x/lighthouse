const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
// Compile local TypeScript modules for dependency-free data checks.
require.extensions['.ts'] = (module, filename) => {
  module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, filename);
};
const { caseIds, getStory, isCaseId } = require('../app/lib/live-stories.ts');
const { accounts, calculateHealthScore } = require('../app/lib/lighthouse.ts');
assert.equal(accounts.reduce((sum, account) => sum + account.arr, 0), 4010000);
assert.equal(isCaseId('unrelated'), false);
assert.equal(isCaseId(null), false);
const expected = {ACC003: [49,48,-22], ACC007: [56,52,-12], ACC008: [88,94,6]};
for (const id of caseIds) {
  const story = getStory(id);
  assert.equal(story.account.id, id);
  assert.equal(story.score, calculateHealthScore(story.account));
  assert.deepEqual([story.score, story.utilization, story.change], expected[id]);
  assert.equal(story.events.length, 6);
  assert.equal(new Set(story.events.map(e => e.agent)).size, 6);
  assert.equal(story.events[5].agent, 'harbor');
  assert.ok(story.events.every(e => e.input && e.output));
  assert.ok(story.recommendation.includes(story.account.exec));
  assert.ok(story.usage.includes(story.account.mau.join(' → ')));
}
console.log('PASS: all 3 stories match source accounts, scores, utilization, trends, six-stage handoffs, and $4.01M portfolio.');
