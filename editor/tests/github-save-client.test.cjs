'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const client=require('../github-save-client.js');
const location={protocol:'http:',hostname:'127.0.0.1'};
const sha='a'.repeat(40),next='b'.repeat(40),digest='c'.repeat(64);
const branch='editor-saves/private-review-01';
const capability={format:'naxx-editor-local-save-capability-v1',ready:true,
  authenticated:true,repository:'CosmicCuddle/Naxxramas-Resource-Hub',
  publishDisabled:true,backupVerified:true,exactOldHeadEnforced:true,
  branch,expectedHead:sha};
const receipt={format:'naxx-editor-local-save-result-v1',
  result:'saved-and-independently-verified',
  repository:capability.repository,branch,parentCommit:sha,commit:next,
  fullSiteSha256:digest,remoteRefVerified:true,
  sourceFilesVerified:true,backupVerified:true,published:false};
const response=(value,ok=true)=>({ok,json:async()=>value});
const fakePackage={blob:new Blob(['x'.repeat(80)],{type:'application/zip'}),
  manifest:{githubReady:false,publishable:false}};
function inputs(fetchFn){return {location,fetchFn,
  getPageDraft:()=>({format:'test-page'}),
  getResourceDraft:()=>({format:'test-resource'}),
  build:async()=>fakePackage,zipTools:{}};}

test('direct Save refuses file pages, non-loopback domains and HTTPS deployment origins',async()=>{
  for(const bad of [{protocol:'file:',hostname:''},
    {protocol:'https:',hostname:'cosmiccuddle.github.io'},
    {protocol:'http:',hostname:'127.0.0.1.attacker.invalid'},
    {protocol:'https:',hostname:'127.0.0.1'}]){
    assert.equal(client.allowedHost(bad),false);
    await assert.rejects(client.save({...inputs(()=>{throw Error('must not fetch');}),location:bad}),/trusted local/);
  }
  assert.equal(client.allowedHost(location),true);
});

test('capabilities reject public branches, missing backups, no CAS and release permissions',()=>{
  assert.equal(client.validateCapability(capability).branch,branch);
  const invalid=[
    {...capability,branch:'main'},
    {...capability,branch:'feature/multi-file-editor-export-2026-11-05'},
    {...capability,branch:'editor-saves/../main'},
    {...capability,branch:'editor-saves/a.lock'},
    {...capability,branch:'editor-saves/a//b'},
    {...capability,backupVerified:false},
    {...capability,exactOldHeadEnforced:false},
    {...capability,publishDisabled:false},
    {...capability,authenticated:false},
    {...capability,expectedHead:'not-a-commit'},
    {...capability,repository:'outside/elsewhere'}
  ];
  for(const bad of invalid)assert.throws(()=>client.validateCapability(bad));
});

test('a valid Save packages existing in-memory drafts and posts once to local server, never GitHub or main',async()=>{
  const calls=[];
  const fetchFn=async(url,opts)=>{
    calls.push({url,opts});
    return url.endsWith('/status')?response(capability):response(receipt);
  };
  let pageCalls=0,resourceCalls=0,buildCalls=0;
  const result=await client.save({...inputs(fetchFn),
    getPageDraft:()=>{pageCalls++;return {page:true};},
    getResourceDraft:()=>{resourceCalls++;return {resource:true};},
    build:async(p,r)=>{buildCalls++;assert.deepEqual(p,{page:true});assert.deepEqual(r,{resource:true});return fakePackage;}});
  assert.equal(pageCalls,2);assert.equal(resourceCalls,2);assert.equal(buildCalls,1);
  assert.equal(calls.length,2);
  assert.equal(calls[0].url,'/api/editor/status');
  assert.equal(calls[0].opts.method,'GET');
  assert.equal(calls[1].url,'/api/editor/save');
  assert.equal(calls[1].opts.method,'POST');
  assert.equal(calls[1].opts.credentials,'same-origin');
  assert.equal(calls[1].opts.headers['X-Naxx-Expected-Head'],sha);
  assert.equal(calls[1].opts.body,fakePackage.blob);
  assert.equal(result.commit,next);assert.equal(result.published,false);
});

test('invalid status, no drafts and damaged package fail before any Save POST',async()=>{
  let posts=0;
  const fetchFn=async(url)=>{
    if(url.endsWith('/save')){posts++;return response(receipt);}
    return response(capability);
  };
  await assert.rejects(client.save({...inputs(fetchFn),build:async()=>{throw Error('No applied edits');}}),/No applied/);
  await assert.rejects(client.save({...inputs(fetchFn),build:async()=>({blob:new Blob(['x']),manifest:{githubReady:false,publishable:false}})}),/bounded/);
  await assert.rejects(client.save({...inputs(fetchFn),build:async()=>({...fakePackage,manifest:{githubReady:true,publishable:false}})}),/bounded/);
  await assert.rejects(client.save({...inputs(async()=>response({...capability,backupVerified:false}))}),/not ready/);
  assert.equal(posts,0);
});

test('timeouts, response errors or forged success produce uncertain result and never auto-retry',async()=>{
  for(const outcome of [
    async()=>{throw Error('network error');},
    async()=>response({error:'failed'},false),
    async()=>response({...receipt,published:true}),
    async()=>response({...receipt,branch:'main'}),
    async()=>response({...receipt,remoteRefVerified:false}),
    async()=>response({...receipt,parentCommit:'f'.repeat(40)}),
    async()=>response({...receipt,commit:sha})]){
    let saves=0;
    const fetchFn=async(url)=>{
      if(url.endsWith('/status'))return response(capability);
      saves++;
      return outcome();
    };
    await assert.rejects(client.save(inputs(fetchFn)),/uncertain or refused/);
    assert.equal(saves,1,'Save was never replayed');
  }
});

test('browser adapter cannot contain GitHub tokens, direct GitHub endpoints or hidden automatic retries',()=>{
  const text=fs.readFileSync(path.join(__dirname,'..','github-save-client.js'),'utf8');
  assert.doesNotMatch(text,/https:\/\/api\.github\.com|Bearer\s+|Authorization\s*:/);
  assert.doesNotMatch(text,/localStorage|sessionStorage|setInterval\s*\(|git\s+push/);
  assert.match(text,/do NOT retry automatically/);
});

test('edits typed during an in-flight Save are explicitly marked unsaved, without a second POST',async()=>{
  const current={format:'test-page',files:[{path:'rules/content.html',edits:{'T:1':'Original'}}],
    navigation:null,createdAt:'time-1'};
  let posts=0;
  const fetchFn=async(url)=>{
    if(url.endsWith('/status'))return response(capability);
    posts++;
    current.files[0].edits['T:1']='Typed during network request';
    return response(receipt);
  };
  const result=await client.save({...inputs(fetchFn),getPageDraft:()=>current,
    getResourceDraft:()=>null});
  assert.equal(result.changedDuringSave,true);
  assert.equal(posts,1);
});
test('fresh timestamps alone do not make an unchanged draft appear unsaved',async()=>{
  let tick=0;
  const fetchFn=async(url)=>response(url.endsWith('/status')?capability:receipt);
  const result=await client.save({...inputs(fetchFn),
    getPageDraft:()=>({files:[{path:'rules/content.html',edits:{'T:1':'Same'}}],
      navigation:null,createdAt:String(++tick)}),getResourceDraft:()=>null});
  assert.equal(result.changedDuringSave,false);
});
