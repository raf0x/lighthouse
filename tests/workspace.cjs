const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, filename);
const { operationCases, assessCase, recordReview, evidenceAudit, restoreWorkspaces, ENGINE_VERSION } = require('../app/lib/operations.ts');
const { workspaceCases, workspaceAccounts, accountIdForCase, accountStatus, priorityCases, portfolioTotals, recentChanges, changeSummary, deadlineLabel, caseHref } = require('../app/lib/workspace.ts');
const clone = x => structuredClone(x);
function state(c, approved=false) {
  const a=assessCase(c);
  return {[c.id]:{input:c,analyzed:true,drafts:a.drafts,history:[],...(approved ? {review:recordReview(c,a,a.drafts,'QA Reviewer','approved','', '2026-11-16T17:00:00.000Z')} : {})}};
}
test('directory preserves distinct partner and customer identities and stable case links',()=>{
  const all=workspaceAccounts({}); assert.equal(all.length,18);assert.equal(new Set(all.map(a=>a.id)).size,18);
  assert.equal(all.find(a=>a.id===accountIdForCase('OPS-101')).name,'Portside Collectibles');
  assert.equal(all.find(a=>a.id==='ACC001').cases.length,0);
  assert.equal(caseHref('OPS-101','Activity'),'/operations?case=OPS-101&tab=Activity');
});
test('correcting evidence updates the account, priority queue and portfolio together without mutation',()=>{
  const original=clone(operationCases[0]), changed=clone(original);
  changed.invoice.entity=changed.approvedEntity;changed.payment.status=changed.crmPaymentStatus='cleared';
  const saved=state(changed), before=clone(saved);
  assert.equal(accountStatus(workspaceAccounts(saved).find(a=>a.id===accountIdForCase(changed.id))),'Ready for review');
  assert.equal(workspaceCases(saved).find(c=>c.input.id===changed.id).assessment.decision,'ready_for_review');
  assert.equal(portfolioTotals(workspaceCases({}))[0].blocked-portfolioTotals(workspaceCases(saved))[0].blocked,original.orderAmountCents);
  assert.deepEqual(saved,before);
});
test('approving a blocked remediation plan never clears portfolio exposure or hides it from priorities',()=>{
  const saved=state(clone(operationCases[0]),true), cases=workspaceCases(saved);
  assert.equal(cases.find(c=>c.input.id==='OPS-101').planApproved,true);
  assert.equal(accountStatus(workspaceAccounts(saved).find(a=>a.id===accountIdForCase('OPS-101'))),'Action needed');
  assert.ok(priorityCases(cases).some(c=>c.input.id==='OPS-101'));
  assert.deepEqual(portfolioTotals(cases),portfolioTotals(workspaceCases({})));
});
test('only a current reviewed ready plan leaves the action queue; changed drafts bring it back',()=>{
  const saved=state(clone(operationCases[4]),true);
  assert.ok(!priorityCases(workspaceCases(saved)).some(c=>c.input.id==='OPS-105'));
  saved['OPS-105'].drafts.internal+=' changed';
  assert.ok(priorityCases(workspaceCases(saved)).some(c=>c.input.id==='OPS-105'));
});
test('deadline ordering uses scenario time and preserves expired, urgent and later priorities',()=>{
  assert.deepEqual(priorityCases(workspaceCases({})).slice(0,3).map(c=>c.input.id),['OPS-110','OPS-104','OPS-101']);
  assert.equal(deadlineLabel(workspaceCases({}).find(c=>c.input.id==='OPS-110')),'Deadline passed');
  assert.equal(deadlineLabel(workspaceCases({}).find(c=>c.input.id==='OPS-104')),'4h remaining');
});
test('portfolio sums order cents once per case and never mixes currencies or invoice denominations',()=>{
  const cases=workspaceCases({});
  assert.deepEqual(portfolioTotals(cases),[{currency:'USD',total:48000000,blocked:43200000,count:10}]);
  const mixed=clone(cases.slice(0,2));mixed[1].input.orderCurrency='CAD';
  assert.equal(portfolioTotals(mixed).length,2);assert.equal(portfolioTotals(mixed)[0].total,4800000);
});
test('evidence change brief survives reload, excludes routine clicks and preserves historical outcome',()=>{
  const original=clone(operationCases[0]), changed=clone(original);changed.invoice.entity=changed.approvedEntity;
  const saved=state(changed);saved[changed.id].history=[{id:'analysis',at:'2026-11-16T17:00:00.000Z',event:'Analyzed',detail:'Checked'},{id:'edit',at:'2026-11-16T17:01:00.000Z',event:'Evidence updated',detail:'Updated',evidence:evidenceAudit(original,changed,'manual')}];
  const restored=restoreWorkspaces(JSON.stringify({version:ENGINE_VERSION,cases:saved}));
  const changes=recentChanges(workspaceCases(restored));assert.equal(changes.length,1);assert.equal(changes[0].event.evidence.after.decision,'blocked');
  assert.match(changeSummary(changes[0].event),/Invoice names a different entity/);
  assert.doesNotMatch(changeSummary(changes[0].event),/Payment has not cleared/);
});
test('restoring original evidence returns blockers to all views and records new findings',()=>{
  const original=clone(operationCases[0]), resolved=clone(original);resolved.invoice.entity=resolved.approvedEntity;resolved.payment.status=resolved.crmPaymentStatus='cleared';
  const saved=state(original);saved[original.id].history=[{id:'restore',at:'2026-11-16T17:00:00.000Z',event:'Sample restored',detail:'Restored',evidence:evidenceAudit(resolved,original,'restore')}];
  const changes=recentChanges(workspaceCases(saved));assert.match(changeSummary(changes[0].event),/New:.*Invoice names a different entity/);
  assert.equal(portfolioTotals(workspaceCases(saved))[0].blocked,43200000);
});
