const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,filename);
const sdkPath=require.resolve('@anthropic-ai/sdk'); require(sdkPath);
let created=0;
require.cache[sdkPath].exports=class TestClient { constructor(options){created++;assert.equal(options.maxRetries,0);this.messages={create:async()=>{throw new Error('Unexpected live call');}};} };
const runner=require('../app/lib/operations-agent-runner.ts');
const route=require('../app/api/operations/investigate/route.ts');
const legacyRoute=require('../app/api/analyze/route.ts');
const { operationCases }=require('../app/lib/operations.ts');
const { AGENT_PROTOCOL_VERSION }=require('../app/lib/operations-agent.ts');
const originalEnv={VERCEL_ENV:process.env.VERCEL_ENV,LIGHTHOUSE_AGENT_ENABLED:process.env.LIGHTHOUSE_AGENT_ENABLED,ANTHROPIC_API_KEY:process.env.ANTHROPIC_API_KEY};
test.after(()=>{for(const[k,v]of Object.entries(originalEnv))if(v===undefined)delete process.env[k];else process.env[k]=v;});
const enable=()=>Object.assign(process.env,{VERCEL_ENV:'preview',LIGHTHOUSE_AGENT_ENABLED:'true',ANTHROPIC_API_KEY:'not-a-real-key'});
const request=(body={case:operationCases[0]},headers={})=>new Request('https://preview.example/api/operations/investigate',{method:'POST',headers:{Origin:'https://preview.example','Content-Type':'application/json','X-Lighthouse-Agent-Protocol':AGENT_PROTOCOL_VERSION,...headers},body:typeof body==='string'?body:JSON.stringify(body)});
test('route disables production before reading a body or creating a provider client',async()=>{
  enable();process.env.VERCEL_ENV='production';const before=created;
  assert.equal((await route.POST(request())).status,403);assert.equal(created,before);
  const config=await route.GET().json();assert.equal(config.enabled,false);assert.ok(!JSON.stringify(config).includes('not-a-real-key'));
});
test('legacy analysis also disables public production and unenabled previews before any provider call',async()=>{
  const before=created;
  for(const environment of ['production','preview']) {
    enable();process.env.VERCEL_ENV=environment;
    if(environment==='preview')delete process.env.LIGHTHOUSE_AGENT_ENABLED;
    const response=await legacyRoute.POST(request('{invalid'));
    assert.equal(response.status,403);assert.equal(response.headers.get('Cache-Control'),'no-store');
    assert.equal((await response.json()).code,'disabled');
  }
  assert.equal(created,before);
});
test('route rejects foreign origins, non-json, malformed, invalid, and oversize bodies without spending',async()=>{
  enable();const before=created;
  assert.equal((await route.POST(request({}, {Origin:'https://outside.example'}))).status,403);
  assert.equal((await route.POST(request({}, {'Content-Type':'text/plain'}))).status,403);
  assert.equal((await route.POST(request('{broken'))).status,400);
  assert.equal((await route.POST(request({case:{...operationCases[0],orderAmountCents:1}}))).status,400);
  assert.equal((await route.POST(request('x'.repeat(12001)))).status,413);assert.equal(created,before);
});
test('outdated tabs are rejected before any provider call, including pages open across a deployment',async()=>{
  enable();const before=created;
  for(const version of ['', 'investigator-wire-old']) {
    const req=request(undefined, {'X-Lighthouse-Agent-Protocol':version});
    if(!version)req.headers.delete('X-Lighthouse-Agent-Protocol');
    const response=await route.POST(req), data=await response.json();
    assert.equal(response.status,409);assert.equal(data.code,'outdated_page');assert.match(data.error,/Refresh/);
  }
  assert.equal(created,before);
  const config=await route.GET().json();assert.equal(config.protocolVersion,AGENT_PROTOCOL_VERSION);
});
test('route has no-store responses and a per-worker concurrency guard',async()=>{
  enable();let release;let entered;
  const started=new Promise(r=>entered=r);
  runner.runInvestigation=async()=>{entered();await new Promise(r=>release=r);return {caseId:'OPS-101',report:{}};};
  const first=route.POST(request());await started;
  assert.equal((await route.POST(request())).status,429);release();
  const response=await first;assert.equal(response.status,200);assert.equal(response.headers.get('Cache-Control'),'no-store');
});
test('route exposes safe run errors and always clears its worker lock',async()=>{
  enable();runner.runInvestigation=async()=>{throw new runner.AgentRunError('provider_access','Account could not authorize model.',[],{modelCalls:1,inputTokens:0,outputTokens:0,estimatedUsd:0});};
  const response=await route.POST(request());assert.equal(response.status,502);assert.equal((await response.json()).code,'provider_access');
  runner.runInvestigation=async()=>{throw new Error('SECRET test provider body');};
  const again=await route.POST(request());assert.equal(again.status,500);assert.ok(!(await again.text()).includes('SECRET'));
});
