
const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const ts = require('typescript');

require.extensions['.ts'] = (module, filename) => module._compile(
  ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true},
  }).outputText, filename,
);

const {
  ENGINE_VERSION, operationCases, assessCase, inputSignature, currentReview, recordReview, restoreWorkspaces,
} = require('../app/lib/operations.ts');
const {
  WORKSPACE_STORAGE_KEY, LEGACY_WORKSPACE_STORAGE_KEY,
  withWorkspaceWriteLock, WorkspaceWriteError, verifyUnchangedEvidence, writeWorkspaceChange,
} = require('../app/lib/workspace.ts');

const clone = structuredClone;
const original = () => clone(operationCases.find(c => c.id === 'OPS-105'));
const at = '2026-11-19T19:00:00.000Z';
function seed() {
  const input=original();
  const drafts=assessCase(input).drafts;
  const review=recordReview(input,assessCase(input),drafts,'Previously approved','approved','Reviewed the plan',at);
  return {'OPS-105':{
    input, analyzed:true, drafts,
    draftOrigin:{model:'SyntheticTest',runId:'l2-seed',completedAt:at},
    review, history:[
      {id:'initial',at,event:'Case analyzed',detail:'Checked evidence.'},
      {id:'review',at,event:'Plan approved locally',detail:'Human plan review.'},
    ]
  }};
}
function store(cases=seed()) {
  const map=new Map([[WORKSPACE_STORAGE_KEY,JSON.stringify({version:ENGINE_VERSION,cases})]]);
  let writes=0;
  return {
    getItem(k){return map.get(k)??null;},
    setItem(k,v){writes++;map.set(k,v);},
    writes(){return writes;},
    raw(){return map.get(WORKSPACE_STORAGE_KEY);},
    workspaces(){return restoreWorkspaces(map.get(WORKSPACE_STORAGE_KEY));},
  };
}
test('unchanged manual evidence requires zero storage writes and preserves exact approved record',()=>{
  const s=store(),before=s.raw(),current=s.workspaces()['OPS-105'];
  const proposed=clone(current.input);
  // Rebuild the same submitted form representation.
  proposed.deadline=new Date(Date.parse(proposed.deadline)).toISOString();
  proposed.payment.amountCents=Math.round(Number((proposed.payment.amountCents/100).toFixed(2))*100);
  assert.equal(inputSignature(current.input),inputSignature(proposed));
  verifyUnchangedEvidence(s,current.input,proposed,current);
  assert.equal(s.writes(),0);
  assert.equal(s.raw(),before);
  const after=s.workspaces()['OPS-105'];
  assert.deepEqual(after,current);
  assert.ok(currentReview(after.input,after.drafts,after.review));
});
test('editing a field and restoring its original value is a no-op',()=>{
  const s=store(),current=s.workspaces()['OPS-105'];
  const proposed=clone(current.input);
  proposed.payment.amountCents--;
  proposed.payment.amountCents++;
  verifyUnchangedEvidence(s,current.input,proposed,current);
  assert.equal(s.writes(),0);
  assert.deepEqual(s.workspaces()['OPS-105'],current);
});
test('a change to payment by one cent is never considered unchanged',()=>{
  const s=store(),current=s.workspaces()['OPS-105'],proposed=clone(current.input);
  proposed.payment.amountCents-=1;
  assert.notEqual(inputSignature(current.input),inputSignature(proposed));
  assert.throws(()=>verifyUnchangedEvidence(s,current.input,proposed,current),WorkspaceWriteError);
  assert.equal(s.writes(),0);
});
test('a genuinely changed manual evidence write keeps the existing L1 invalidation behavior',()=>{
  const s=store(),before=s.workspaces(),previous=before['OPS-105'],next=clone(previous);
  next.input.payment.amountCents-=1;
  next.analyzed=false;next.drafts=undefined;next.draftOrigin=undefined;next.review=undefined;
  next.history.push({id:'edit',at,event:'Evidence updated',detail:'Previous review cleared.'});
  const result=writeWorkspaceChange(s,before,{...before,'OPS-105':next});
  assert.equal(result.workspaces['OPS-105'].input.payment.amountCents,previous.input.payment.amountCents-1);
  assert.equal(s.workspaces()['OPS-105'].review,undefined);
  assert.equal(s.workspaces()['OPS-105'].drafts,undefined);
  assert.equal(s.workspaces()['OPS-105'].analyzed,false);
  assert.equal(s.workspaces()['OPS-105'].history.length,previous.history.length+1);
  assert.equal(s.writes(),1);
});
test('an unrelated-case update does not invalidate a no-op review or get overwritten',()=>{
  const cases=seed(),other=clone(operationCases.find(c=>c.id==='OPS-101'));
  cases[other.id]={input:other,analyzed:false,history:[]};
  const s=store(cases),stale=s.workspaces()['OPS-105'];
  const changed=s.workspaces();
  changed['OPS-101'].input.owner='Changed elsewhere';
  s.setItem(WORKSPACE_STORAGE_KEY,JSON.stringify({version:ENGINE_VERSION,cases:changed}));
  const prior=s.raw(),count=s.writes();
  verifyUnchangedEvidence(s,stale.input,clone(stale.input),stale);
  assert.equal(s.writes(),count);
  assert.equal(s.raw(),prior);
  assert.equal(s.workspaces()['OPS-101'].input.owner,'Changed elsewhere');
  assert.ok(s.workspaces()['OPS-105'].review);
});
test('stale no-op after a concurrent same-case evidence edit fails closed',()=>{
  const s=store(),stale=s.workspaces()['OPS-105'];
  const changed=s.workspaces();changed['OPS-105'].input.payment.amountCents-=1;
  changed['OPS-105'].analyzed=false;changed['OPS-105'].review=undefined;
  changed['OPS-105'].drafts=undefined;
  s.setItem(WORKSPACE_STORAGE_KEY,JSON.stringify({version:ENGINE_VERSION,cases:changed}));
  const prior=s.raw(),count=s.writes();
  assert.throws(()=>verifyUnchangedEvidence(s,stale.input,clone(stale.input),stale),WorkspaceWriteError);
  assert.equal(s.writes(),count);
  assert.equal(s.raw(),prior);
  assert.equal(s.workspaces()['OPS-105'].input.payment.amountCents,stale.input.payment.amountCents-1);
});
test('a no-op on a built-in unassessed sample requires no write',()=>{
  const s=store({});
  const unchanged=original();
  verifyUnchangedEvidence(s,unchanged,clone(unchanged));
  assert.equal(s.writes(),0);
  assert.equal(s.raw(),JSON.stringify({version:ENGINE_VERSION,cases:{}}));
});
test('legacy v1 edits are isolated, not imported into a no-op v2 check',()=>{
  const s=store(),w=s.workspaces()['OPS-105'];
  const backup=seed();backup['OPS-105'].input.payment.amountCents-=1;
  s.setItem(LEGACY_WORKSPACE_STORAGE_KEY,JSON.stringify({version:ENGINE_VERSION,cases:backup}));
  const before=s.raw(),count=s.writes();
  verifyUnchangedEvidence(s,w.input,clone(w.input),w);
  assert.equal(s.writes(),count);
  assert.equal(s.raw(),before);
});
test('corrupted authoritative v2 storage blocks no-op verification',()=>{
  const s={getItem:()=>'{'};
  assert.throws(()=>verifyUnchangedEvidence(s,original(),original()),WorkspaceWriteError);
});
test('missing native cross-tab locks fails closed even for a no-op',async()=>{
  const s=store(),w=s.workspaces()['OPS-105'];
  await assert.rejects(withWorkspaceWriteLock(undefined,()=>verifyUnchangedEvidence(s,w.input,w.input)),WorkspaceWriteError);
  assert.equal(s.writes(),0);
});

test('a concurrent message draft change invalidates a stale no-op confirmation',()=>{
  const s=store(),opened=s.workspaces()['OPS-105'];
  const latest=s.workspaces();latest['OPS-105'].drafts.internal+=' Updated by another tab';
  latest['OPS-105'].review=undefined;
  s.setItem(WORKSPACE_STORAGE_KEY,JSON.stringify({version:ENGINE_VERSION,cases:latest}));
  const before=s.raw(),count=s.writes();
  assert.throws(()=>verifyUnchangedEvidence(s,opened.input,clone(opened.input),opened),WorkspaceWriteError);
  assert.equal(s.raw(),before);assert.equal(s.writes(),count);
});
test('a concurrent review-only change is not mistaken for unchanged saved work',()=>{
  const s=store(),opened=s.workspaces()['OPS-105'];
  const latest=s.workspaces();
  latest['OPS-105'].review={...latest['OPS-105'].review,note:'Re-reviewed by another tab'};
  s.setItem(WORKSPACE_STORAGE_KEY,JSON.stringify({version:ENGINE_VERSION,cases:latest}));
  const before=s.raw();
  assert.throws(()=>verifyUnchangedEvidence(s,opened.input,clone(opened.input),opened),WorkspaceWriteError);
  assert.equal(s.raw(),before);
});
