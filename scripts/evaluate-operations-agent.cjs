// Bounded live evaluation against the protected preview. No provider key is needed locally.
// Read {"url":"<share URL>","caseIds":["OPS-101"],"output":"docs/evals/...json"} from stdin.
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,filename);
const { operationCases } = require('../app/lib/operations.ts');
const expected = {
  'OPS-101':['blocked',['entity_mismatch','payment_pending','deadline_near']],
  'OPS-102':['needs_information',['payment_missing']], 'OPS-103':['needs_information',['payment_conflict','payment_pending']],
  'OPS-104':['blocked',['payment_pending','deadline_near']], 'OPS-105':['ready_for_review',[]],
  'OPS-106':['blocked',['payment_amount']], 'OPS-107':['blocked',['invoice_currency','payment_currency']],
  'OPS-108':['blocked',['duplicate_invoice']], 'OPS-109':['needs_information',['entity_missing']], 'OPS-110':['blocked',['deadline_elapsed']],
};
async function main(config) {
  const url=new URL(config.url);
  if(url.protocol!=='https:'||!url.hostname.endsWith('.vercel.app')||url.hostname==='lighthouse-alpha-two.vercel.app')throw new Error('Use a protected Vercel preview URL.');
  const cookieJar = new Map();
  async function call(target, options={}) {
    for(let redirect=0;redirect<5;redirect++) {
      const response=await fetch(target,{...options,redirect:'manual',headers:{...options.headers,Cookie:[...cookieJar].map(([k,v])=>`${k}=${v}`).join('; ')},signal:AbortSignal.timeout(100000)});
      for(const cookie of response.headers.getSetCookie()) {const pair=cookie.split(';')[0];const i=pair.indexOf('=');cookieJar.set(pair.slice(0,i),pair.slice(i+1));}
      if([301,302,303,307,308].includes(response.status)) {const next=new URL(response.headers.get('location'),target);if(next.origin!==url.origin)throw new Error('Preview access redirected away; no live requests made.');target=next;continue;}
      return response;
    }
    throw new Error('Preview redirect limit reached.');
  }
  const access=await call(url);
  if(!access.ok)throw new Error(`Preview access failed (${access.status}).`);
  const configResponse=await call(new URL('/api/operations/investigate',url));
  const availability=await configResponse.json();
  if(!availability.enabled)throw new Error('Live investigation is disabled.');
  const chosen=config.caseIds||operationCases.map(c=>c.id);
  if(!Array.isArray(chosen)||!chosen.length||chosen.length>10||new Set(chosen).size!==chosen.length||chosen.some(id=>!expected[id]))throw new Error('Choose 1–10 unique known cases.');
  const output=path.resolve(config.output||'docs/evals/operations-agent-live.json');
  if(!output.startsWith(path.resolve('docs/evals')+path.sep))throw new Error('Evaluation reports must be written below docs/evals.');
  const report={version:'lighthouse-agent-eval-v1',startedAt:new Date().toISOString(),model:availability.model,scope:'Synthetic fixtures only; category/citation validation is automatic, narrative needs human review.',cases:[],totals:{passed:0,failed:0,inputTokens:0,outputTokens:0,estimatedUsd:0}};
  fs.mkdirSync(path.dirname(output),{recursive:true});
  for(const id of chosen){
    const input=operationCases.find(c=>c.id===id);const [decision,ids]=expected[id];
    const response=await call(new URL('/api/operations/investigate',url),{method:'POST',headers:{Origin:url.origin,'Content-Type':'application/json'},body:JSON.stringify({case:input})});
    const data=await response.json();
    const matched=response.ok&&data.run?.report.decision===decision&&JSON.stringify(data.run.report.findings.map(f=>f.id).sort())===JSON.stringify([...ids].sort());
    const usage=data.run?.usage||data.usage;
    report.cases.push({caseId:id,passed:Boolean(matched),expected:{decision,findingIds:ids},status:response.status,...data});
    report.totals[matched?'passed':'failed']++;
    if(usage){report.totals.inputTokens+=usage.inputTokens;report.totals.outputTokens+=usage.outputTokens;report.totals.estimatedUsd+=usage.estimatedUsd;}
    report.updatedAt=new Date().toISOString();fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');
    console.log(`${id}: ${matched?'PASS':'FAIL'}${data.code?' ('+data.code+')':''}; calls ${usage?.modelCalls??'?'}; estimated $${(usage?.estimatedUsd??0).toFixed(4)}`);
    if(!response.ok&&['provider_access','provider_request','provider_limit'].includes(data.code)){console.log('Stopping: provider account/access issue.');break;}
  }
  console.log(JSON.stringify({output,totals:report.totals}));
  if(report.totals.failed)process.exitCode=1;
}
let input='';process.stdin.setEncoding('utf8');process.stdin.on('data',chunk=>input+=chunk);process.stdin.on('end',()=>{try{main(JSON.parse(input)).catch(e=>{console.error(e.message);process.exitCode=1;});}catch{console.error('Provide the evaluation config as JSON on stdin.');process.exitCode=1;}});
