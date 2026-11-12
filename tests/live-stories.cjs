const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
// Compile local TypeScript modules for dependency-free data checks.
require.extensions['.ts'] = (module, filename) => {
  module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, filename);
};
const { caseIds, getStory, isCaseId, accountIdentity } = require('../app/lib/live-stories.ts');
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

assert.equal(new Set(caseIds.map(id => accountIdentity[id].color)).size, 3);
assert.equal(new Set(caseIds.map(id => accountIdentity[id].code)).size, 3);
assert.deepEqual(accountIdentity.ACC003.concerns, ['seats', 'nps', 'tickets']);
assert.deepEqual(accountIdentity.ACC007.concerns, ['seats']);
assert.deepEqual(accountIdentity.ACC008.concerns, []);
console.log('PASS: distinct account identities and explicitly scoped scenario concerns.');
const page = fs.readFileSync(require('node:path').join(__dirname, '../app/live/page.tsx'), 'utf8');
assert.ok(page.includes('React.useState(2)'));
assert.ok(page.includes('CURRENT CASE STEP'));
assert.ok(page.includes('<strong>{stage + 1}</strong>'));
assert.ok(!page.includes('[55, 57, 56, 62, 67, 66, 71, 75]'));
assert.ok(page.includes('Not in this case'));
assert.ok(page.includes('if (!isActive) return null;'));
assert.ok(!page.slice(page.indexOf('function inspectAgent'), page.indexOf('const pendingCases')).includes('setPlaying'));
assert.ok(page.includes('reviewedCases[activeCase]'));
assert.ok(!page.includes('setApproved(false)'));
console.log('PASS: source guards for 2x default, consistent step count, nonparticipant labels, active-only spoke, continuous inspection and persistent review state.');
const { isPreviousReviewPass } = require('../app/lib/live-stories.ts');
assert.equal(isPreviousReviewPass(undefined, '0:0', 'ACC003', 'ACC003'), false);
assert.equal(isPreviousReviewPass('0:0', '0:0', 'ACC003', 'ACC003'), false);
assert.equal(isPreviousReviewPass('0:0', '0:1', 'ACC003', 'ACC003'), true);
assert.equal(isPreviousReviewPass('0:0', '1:0', 'ACC003', 'ACC003'), true);
assert.equal(isPreviousReviewPass('0:0', '0:0', 'ACC003', 'ACC007'), true);
assert.ok(!page.includes('7 SIMULATED AI AGENTS + HUMAN GATE'));
console.log('PASS: review provenance distinguishes current pass, later loop, restarted playback and another account.');

assert.ok(page.includes('styles.instrumentGrid'), 'network-first composition must remain');
assert.ok(page.includes('styles.mobileJourney'), 'mobile must have a case-ordered journey');
assert.ok(page.includes('scene.events.map((event,index) =>'), 'mobile sequence uses actual story order');
assert.ok(page.includes('sampleScore={scene.score}'), 'hub must reflect current fictional account');
assert.ok(page.includes('caseAgents.slice(0, visited.length + 1)'), 'path must reflect completed case stages');
assert.ok(!page.includes('className={styles.metrics}'), 'large redundant KPI tiles must not return');
assert.ok(!page.includes('className={styles.feed}'), 'duplicated always-visible activity feed must not return');
assert.ok(!page.includes('className={styles.bottomGrid}'), 'repeated bottom panels must not return');
assert.ok(page.includes('reviewReady ? <section'), 'review brief only shown when available');
assert.ok(page.includes("setPlaying(v => !v)"), 'playback remains user controllable');
console.log('PASS: network-first composition, case-ordered mobile journey, semantic hub and gated human review.');
