const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, filename);
const { CSV_TEMPLATE, parseCaseCsv, addImportedCase, caseToCsv, exampleFollowUp, evidenceUpdateProblem, acceptEvidenceUpdate } = require('../app/lib/operations-import.ts');
const { ENGINE_VERSION, assessCase, evidenceFor, evidenceChanges, evidenceValues, inputSignature, recordReview, currentReview, restoreWorkspaces, exportCase, evidenceAudit } = require('../app/lib/operations.ts');
const { runInvestigation } = require('../app/lib/operations-agent-runner.ts');
const { SOURCE_IDS, REVIEW_NOTICE, restoreAgentRun } = require('../app/lib/operations-agent.ts');
const id = 'IMP-00000000-0000-4000-8000-000000000010';
const origin = { id, fileName:'initial.csv', at:'2026-11-16T19:00:00.000Z' };
const entry = { id:'follow-up',at:'2026-11-16T19:10:00.000Z',event:'',detail:'' };
const original = () => parseCaseCsv(CSV_TEMPLATE,origin).input;
const proposal = (c, edit = {}) => parseCaseCsv(caseToCsv({...c,...edit}),{...origin,fileName:'follow-up.csv',at:entry.at}).input;
const save = cases => JSON.stringify({version:ENGINE_VERSION,cases});
function workspace() {
  const c=original(), a=assessCase(c);const cases=addImportedCase({},c,{...entry,id:'import',event:'Case imported',detail:'initial.csv'});
  cases[id].analyzed=true;cases[id].drafts={...a.drafts,client:'Human-edited client draft'};cases[id].draftOrigin={model:'test-model',runId:'old-run',completedAt:origin.at};
  cases[id].review=recordReview(c,a,cases[id].drafts,'QA Reviewer','approved','Original plan.',origin.at);
  cases[id].history.push({...entry,id:'review',event:'Plan approved',detail:'QA Reviewer: Original plan.'});
  return cases;
}
test('current CSV round-trips all 18 values including quoted names and exact cents',()=>{
  const c=original();c.account='Seabrook "Live", Inc.';c.payment.amountCents=29;c.payment.reference='';
  assert.deepEqual(evidenceValues(proposal(c)),evidenceValues(c));
});
test('preview is read-only and shows only actual field changes',()=>{
  const cases=workspace(), before=structuredClone(cases), c=cases[id].input;
  const next=proposal(c,{invoice:{...c.invoice,entity:c.approvedEntity}});
  assert.equal(evidenceUpdateProblem(c,next),null);assert.deepEqual(evidenceChanges(c,next).map(x=>x.field),['invoice_entity']);
  assert.deepEqual(cases,before);assert.ok(currentReview(c,cases[id].drafts,cases[id].review));
});
test('accepting a partial correction keeps payment blocked and clears old approval and AI drafts',()=>{
  const cases=workspace(), before=structuredClone(cases), c=cases[id].input;
  const next=proposal(c,{invoice:{...c.invoice,entity:c.approvedEntity}});
  const result=acceptEvidenceUpdate(cases,id,next,inputSignature(c),entry), w=result[id];
  assert.deepEqual(cases,before);assert.deepEqual(w.importedOriginal,c);assert.equal(w.review,undefined);assert.equal(w.draftOrigin,undefined);
  assert.equal(w.analyzed,true);assert.deepEqual(w.drafts,assessCase(next).drafts);assert.equal(assessCase(w.input).decision,'blocked');
  assert.deepEqual(assessCase(w.input).findings.map(f=>f.id),['payment_pending','deadline_near']);
  const audit=w.history.at(-1).evidence;assert.equal(audit.previousReview.reviewer,'QA Reviewer');assert.equal(audit.before.decision,'blocked');assert.equal(audit.after.decision,'blocked');assert.equal(audit.changes[0].before,'Seabrook Events Canada, Ltd.');
});
test('successive invoice and payment updates reach review, and a later expiry returns to blocked',()=>{
  let cases=workspace(), c=cases[id].input;
  let next=proposal(c,{invoice:{...c.invoice,id:'INV-9001-R',entity:c.approvedEntity}});
  cases=acceptEvidenceUpdate(cases,id,next,inputSignature(c),entry);c=cases[id].input;
  next=proposal(c,{asOf:'2026-11-15T16:00:00.000Z',payment:{...c.payment,status:'cleared'},crmPaymentStatus:'cleared'});
  cases=acceptEvidenceUpdate(cases,id,next,inputSignature(c),{...entry,id:'payment'});c=cases[id].input;
  assert.equal(assessCase(c).decision,'ready_for_review');assert.equal(assessCase(c).deadlineHours,18);assert.equal(cases[id].review,undefined);
  next=proposal(c,{asOf:'2026-11-16T11:00:00.000Z'});cases=acceptEvidenceUpdate(cases,id,next,inputSignature(c),{...entry,id:'expiry'});
  assert.equal(assessCase(cases[id].input).decision,'blocked');assert.deepEqual(assessCase(cases[id].input).findings.map(f=>f.id),['deadline_elapsed']);
  assert.equal(cases[id].history.filter(e=>e.evidence).length,3);assert.equal(cases[id].importedOriginal.invoice.id,'INV-9001');
});
test('order identity changes are rejected without changing stored work',()=>{
  const cases=workspace(), c=cases[id].input, before=structuredClone(cases);
  for(const edit of [{account:'Someone else'},{orderId:'ORD-OTHER'},{orderAmountCents:1},{orderCurrency:'CAD'},{tickets:2}]){
    const next=proposal(c,edit);assert.match(evidenceUpdateProblem(c,next),/identity/);
    assert.throws(()=>acceptEvidenceUpdate(cases,id,next,inputSignature(c),entry),/identity/);
  }
  assert.deepEqual(cases,before);
});
test('an earlier scenario, wrong case ID, malformed record, or stale comparison cannot be accepted',()=>{
  const cases=workspace(), c=cases[id].input, before=structuredClone(cases), next=proposal(c,{payment:{...c.payment,status:'cleared'}});
  assert.throws(()=>acceptEvidenceUpdate(cases,id,proposal(c,{asOf:'2026-11-15T13:00:00.000Z'}),inputSignature(c),entry),/earlier/);
  assert.throws(()=>acceptEvidenceUpdate(cases,id,{...next,id:'IMP-00000000-0000-4000-8000-000000000099'},inputSignature(c),entry),/existing imported case/);
  assert.throws(()=>acceptEvidenceUpdate(cases,id,{...next,payment:{}},inputSignature(c),entry),/invalid/);
  assert.throws(()=>acceptEvidenceUpdate(cases,id,next,'old-signature',entry),/case changed/);
  assert.deepEqual(cases,before);
});
test('identical values from a renamed file are a no-op that preserves approval',()=>{
  const cases=workspace(), c=cases[id].input,before=structuredClone(cases),next=proposal(c);
  assert.notEqual(inputSignature(c),inputSignature(next));assert.deepEqual(evidenceChanges(c,next),[]);
  assert.throws(()=>acceptEvidenceUpdate(cases,id,next,inputSignature(c),entry),/No evidence changes/);assert.deepEqual(cases,before);
});
test('a later reviewed CSV replaces locally edited values, including explicitly blank evidence',()=>{
  const cases=workspace(), c=cases[id].input;c.payment.reference='LOCAL-EDIT';
  const next=proposal(c,{payment:{...c.payment,reference:''}}), result=acceptEvidenceUpdate(cases,id,next,inputSignature(c),entry);
  assert.equal(result[id].input.payment.reference,'');assert.ok(assessCase(next).findings.some(f=>f.id==='reference_missing'));
  assert.deepEqual(result[id].history.at(-1).evidence.changes[0],{field:'payment_reference',label:'Payment reference',before:'LOCAL-EDIT',after:''});
});
test('updated provenance, clock, invoice ID, comparison and new review survive reload',()=>{
  const cases=workspace(), c=cases[id].input;
  const next=proposal(c,{asOf:'2026-11-15T16:00:00.000Z',invoice:{...c.invoice,id:'INV-REISSUED',entity:c.approvedEntity},payment:{...c.payment,status:'cleared'},crmPaymentStatus:'cleared'});
  const updated=acceptEvidenceUpdate(cases,id,next,inputSignature(c),entry),w=updated[id],a=assessCase(w.input);
  w.review=recordReview(w.input,a,w.drafts,'New reviewer','approved','',entry.at);
  const restored=restoreWorkspaces(save(updated))[id];assert.deepEqual(restored,w);assert.equal(restored.importedOriginal.imported.fileName,'initial.csv');
  assert.ok(evidenceFor(restored.input).slice(0,5).every(d=>d.source.includes('follow-up.csv')));
  const exported=exportCase(restored.input,a,restored.drafts,restored.review,restored.history);
  for(const s of ['Before findings: Invoice names a different entity','After findings: Allocation deadline is approaching','Previous review cleared: approved by QA Reviewer','"pending" → "cleared"','INV-REISSUED','follow-up.csv','New reviewer']) assert.ok(exported.includes(s),s);
});
test('bad saved comparison details are discarded without dropping the valid case or other history',()=>{
  const cases=workspace(),c=cases[id].input,next=proposal(c,{invoice:{...c.invoice,entity:c.approvedEntity}});
  const updated=acceptEvidenceUpdate(cases,id,next,inputSignature(c),entry);updated[id].history.at(-1).evidence.changes[0].field='policy';
  const restored=restoreWorkspaces(save(updated))[id];assert.ok(restored);assert.equal(restored.history.length,3);assert.equal(restored.history.at(-1).evidence,undefined);
});
test('manual edits and original restore record comparisons without modifying the import baseline',()=>{
  const c=original(),next=proposal(c,{invoice:{...c.invoice,entity:c.approvedEntity}}), baseline=structuredClone(c);
  assert.equal(evidenceAudit(c,next,'manual').changes[0].after,c.approvedEntity);
  const reset=evidenceAudit(next,c,'restore');assert.equal(reset.changes[0].after,c.invoice.entity);assert.equal(reset.after.decision,'blocked');assert.deepEqual(c,baseline);
});
test('one-click example follow-up is restricted to the exact fictional starter records',()=>{
  const c=original(),example=exampleFollowUp(c);assert.ok(example);assert.equal(assessCase(parseCaseCsv(example,origin).input).decision,'ready_for_review');
  assert.equal(exampleFollowUp({...c,account:'Actual company'}),null);assert.equal(exampleFollowUp({...c,orderId:'ORD-OTHER'}),null);
});
test('the earlier agent result is not reused after accepted evidence changes',async()=>{
  const c=original(),a=assessCase(c);const report={decision:a.decision,summary:'Invoice differs and payment is pending.',recommendation:'Finance must reconcile the invoice and funds.',owner:'Finance',findings:a.findings.map(f=>({id:f.id,explanation:f.detail,sourceIds:f.sources})),citations:evidenceFor(c).map(d=>({sourceId:d.id,field:d.fields[0].label,value:d.fields[0].value})),questions:[],drafts:{internal:REVIEW_NOTICE,client:REVIEW_NOTICE}};
  let calls=0;const run=await runInvestigation(c,async()=>({id:'test-'+calls,role:'assistant',type:'message',model:'claude-sonnet-4-6',stop_reason:'tool_use',usage:{input_tokens:100,output_tokens:50},content:[{type:'tool_use',id:'tool-'+(++calls),name:calls===1?'read_records':'submit_investigation',input:calls===1?{sourceIds:SOURCE_IDS}:report}]}),new AbortController().signal);
  assert.ok(restoreAgentRun(run,c));
  const next=proposal(c,{invoice:{...c.invoice,entity:c.approvedEntity}});assert.equal(restoreAgentRun(run,next),null);
});
