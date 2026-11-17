const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, filename);
const { CloudReplica, emptySnapshot, normalizeSnapshot, mergeDeviceSnapshot } = require('../app/lib/cloud-workspace.ts');
const { applyFollowUpAction } = require('../app/lib/follow-ups.ts');
const { operationCases, assessCase } = require('../app/lib/operations.ts');
const clone = value => structuredClone(value);
const tick = () => new Promise(resolve => setImmediate(resolve));
const at = '2026-11-17T03:00:00.000Z';
function task(snapshot, title = 'Confirm cleared funds') {
  return {...snapshot, followUps: applyFollowUpAction(snapshot.followUps, 'partner-OPS-101', snapshot.followUps['partner-OPS-101']?.revision ?? 0, {kind:'save', draft:{title,owner:'Finance',dueDate:'2026-11-18'}}, at, title)};
}
function cache(initial = null) { let raw = initial; return {read:()=>raw,write:value=>{raw=value;},clear:()=>{raw=null;}}; }
function server() {
  let row = {version:0,payload:emptySnapshot(),last_mutation_id:null};
  return {read:async()=>clone(row), save:async mutation=>{
    if (row.last_mutation_id===mutation.id) return {version:row.version};
    if (row.version!==mutation.version) throw {code:'40001'};
    row={version:row.version+1,payload:clone(mutation.payload),last_mutation_id:mutation.id}; return {version:row.version};
  }};
}
let id=0;
const make=(gateway=server(),storage=cache(),owner='user-a')=>new CloudReplica(owner,gateway,storage,()=>`mutation-${++id}`);

test('cloud follow-up completion preserves evidence blockers and reviews',async()=>{
  const gateway=server(), replica=make(gateway); await replica.start();
  replica.edit(s=>task({...s,cases:{'OPS-101':{input:operationCases[0],analyzed:true,history:[]}}})); await tick();
  const evidence=clone(replica.state.snapshot.cases);
  replica.edit(s=>({...s,followUps:applyFollowUpAction(s.followUps,'partner-OPS-101',1,{kind:'complete'},at,'complete')}));await tick();
  assert.deepEqual(replica.state.snapshot.cases,evidence);assert.equal(assessCase(evidence['OPS-101'].input).decision,'blocked');
  assert.equal((await gateway.read()).payload.followUps['partner-OPS-101'].followUp.status,'completed');
});
test('a second device reads the saved workspace and cannot silently replace newer changes',async()=>{
  const gateway=server(),a=make(gateway),b=make(gateway);await a.start();await b.start();
  a.edit(s=>task(s));await tick();b.edit(s=>task(s,'Older device change'));await tick();
  assert.equal(b.state.status,'conflict');assert.equal(b.state.dirty,true);
  assert.equal((await gateway.read()).payload.followUps['partner-OPS-101'].followUp.title,'Confirm cleared funds');
  await b.loadLatest();assert.equal(b.state.dirty,false);assert.deepEqual(b.state.snapshot,a.state.snapshot);
});
test('edits during a save are sent sequentially using the acknowledged version',async()=>{
  const underlying=server(); let release;let calls=0;
  const gateway={read:underlying.read,save:async m=>{if(++calls===1)await new Promise(r=>release=r);return underlying.save(m);}};
  const a=make(gateway);await a.start();a.edit(s=>task(s,'First'));a.edit(s=>task(s,'Second'));release();await tick();await tick();
  assert.equal(calls,2);assert.equal(a.state.status,'ready');assert.equal(a.state.dirty,false);assert.equal((await underlying.read()).payload.followUps['partner-OPS-101'].followUp.title,'Second');
});
test('offline drafts survive reload and save after reconnect',async()=>{
  const backing=server(),storage=cache();let offline=true;
  const gateway={read:backing.read,save:m=>offline?Promise.reject(new Error('offline')):backing.save(m)};
  const a=make(gateway,storage);await a.start();a.edit(s=>task(s));await tick();assert.equal(a.state.status,'error');assert.ok(storage.read());a.dispose();
  offline=false;const b=make(gateway,storage);await b.start();await tick();assert.equal(b.state.status,'ready');assert.equal(b.state.dirty,false);assert.equal(storage.read(),null);assert.equal((await backing.read()).version,1);
});
test('a lost save response retries the same mutation without duplicating activity',async()=>{
  const backing=server();let fail=true;
  const gateway={read:backing.read,save:async m=>{const result=await backing.save(m);if(fail){fail=false;throw new Error('response lost');}return result;}};
  const a=make(gateway);await a.start();a.edit(s=>task(s));await tick();assert.equal(a.state.status,'error');await a.retry();
  assert.equal((await backing.read()).version,1);assert.equal(a.state.snapshot.followUps['partner-OPS-101'].activity.length,1);assert.equal(a.state.dirty,false);
});
test('reload reconciles a save that succeeded before its response was lost',async()=>{
  const backing=server(),storage=cache();const a=make({read:backing.read,save:async m=>{await backing.save(m);throw new Error('lost');}},storage);
  await a.start();a.edit(s=>task(s));await tick();a.dispose();const b=make(backing,storage);await b.start();await tick();assert.equal(b.state.version,1);assert.equal(b.state.dirty,false);
});
test('a late background read cannot erase an edit made while it was in flight',async()=>{
  const backing=server();let delay=false,release;
  const gateway={save:backing.save,read:async()=>{const row=await backing.read();if(delay)await new Promise(r=>release=r);return row;}};
  const a=make(gateway);await a.start();delay=true;const refreshing=a.refresh();await tick();a.edit(s=>task(s));await tick();release();await refreshing;
  assert.equal(a.state.version,1);assert.ok(a.state.snapshot.followUps['partner-OPS-101']);
});
test('a disposed account ignores late reads and another account ignores its recovery cache',async()=>{
  let resolve;const a=make({read:()=>new Promise(r=>resolve=r),save:async()=>({version:1})});const starting=a.start();a.dispose();resolve({version:4,payload:task(emptySnapshot()),last_mutation_id:null});await starting;assert.equal(a.state.version,0);
  const foreign=cache(JSON.stringify({userId:'user-a',version:0,snapshot:task(emptySnapshot()),pending:null}));const b=make(server(),foreign,'user-b');await b.start();assert.deepEqual(b.state.snapshot,emptySnapshot());
});
test('device import retains cloud records, imports missing records and preserves the device copy',()=>{
  const cloud=task(emptySnapshot(),'Cloud task'),device=task({...emptySnapshot(),cases:{'OPS-101':{input:operationCases[0],analyzed:false,history:[]}}},'Device task'),before=clone(device);
  const result=mergeDeviceSnapshot(cloud,device);assert.equal(result.skipped,1);assert.equal(result.snapshot.followUps['partner-OPS-101'].followUp.title,'Cloud task');assert.ok(result.snapshot.cases['OPS-101']);assert.deepEqual(device,before);
});
test('unsupported or malformed cloud snapshots fail instead of replacing work with empty data',()=>{
  assert.throws(()=>normalizeSnapshot({schemaVersion:2,cases:{},followUps:{}}));assert.throws(()=>normalizeSnapshot({schemaVersion:1,cases:{bad:{}},followUps:{}}));assert.throws(()=>normalizeSnapshot({schemaVersion:1,cases:{},followUps:{bad:{}}}));
});
test('browser storage failure remains visible while keeping unsaved data in memory',async()=>{
  const backing=server();const a=make({read:backing.read,save:async()=>{throw new Error('offline');}}, {read:()=>null,write:()=>{throw new Error('quota');},clear:()=>{}});await a.start();a.edit(s=>task(s));await tick();assert.equal(a.state.cacheError,true);assert.equal(a.state.dirty,true);assert.ok(a.state.snapshot.followUps['partner-OPS-101']);
});
test('out-of-order refresh responses cannot move a clean replica backwards',async()=>{
  const backing=server();let calls=0,release;
  const a=make({save:backing.save,read:async()=>{const row=await backing.read();if(++calls===2)await new Promise(r=>release=r);return row;}});
  await a.start();const old=a.refresh();await tick();
  await backing.save({version:0,payload:task(emptySnapshot(),'New server data'),id:'server-write'});
  await a.refresh();release();await old;
  assert.equal(a.state.version,1);assert.equal(a.state.snapshot.followUps['partner-OPS-101'].followUp.title,'New server data');
});
test('load latest cannot discard changes made after the recovery download',async()=>{
  const backing=server();let delay=false,release;
  const a=make({save:async()=>{throw new Error('offline');},read:async()=>{const row=await backing.read();if(delay)await new Promise(r=>release=r);return row;}});
  await a.start();a.edit(s=>task(s,'First draft'));await tick();
  delay=true;const latest=a.loadLatest();await tick();a.edit(s=>task(s,'Newer draft'));await tick();release();
  await assert.rejects(latest);assert.equal(a.state.snapshot.followUps['partner-OPS-101'].followUp.title,'Newer draft');assert.equal(a.state.dirty,true);
});
test('a failed response after account disposal cannot alter the recovery cache',async()=>{
  let reject;const storage=cache(),a=make({read:server().read,save:()=>new Promise((_,r)=>reject=r)},storage);
  await a.start();a.edit(s=>task(s));a.dispose();storage.write('replacement recovery state');reject(new Error('late failure'));await tick();
  assert.equal(storage.read(),'replacement recovery state');
});
