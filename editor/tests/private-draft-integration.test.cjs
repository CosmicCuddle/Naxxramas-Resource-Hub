'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const path=require('node:path');
const {createCompanion}=require('../tools/local-save-companion.cjs');
const client=require('../github-save-client.js');
const repo='CosmicCuddle/Naxxramas-Editor-Save-Sandbox-01';
const OLD='a'.repeat(40),NEXT='b'.repeat(40);
const zip=Buffer.alloc(64,67);
zip[0]=0x50;zip[1]=0x4b;zip[2]=0x03;zip[3]=0x04;
function stub(){
  let current=OLD,stored=null,writes=0,fail=false;
  return {repository:repo,
    async status(){return {repository:repo,branch:'main',expectedHead:current,
      privateVerified:true,draftExists:!!stored};},
    async save(bytes,expected){
      writes++;
      if(fail)throw Error('unknown remote result');
      assert.equal(expected,current);
      assert.ok(bytes.equals(zip));
      const previous=current;current=NEXT;stored=Buffer.from(bytes);
      return {repository:repo,branch:'main',commit:current,parentCommit:previous,
        result:'private-draft-saved-and-verified',gitBlobSha:'c'.repeat(40),
        privateVerified:true,websiteSourceUnchanged:true,published:false};
    },
    async load(){return stored?{bytes:stored,commit:current,published:false}:null;},
    get writes(){return writes;},
    setFailure(x){fail=x;}
  };
}
async function session(store,fn){
  const server=createCompanion({privateDraftStore:store,
    editorDir:path.resolve(__dirname,'..')});
  await new Promise((ok,bad)=>server.once('error',bad).listen(0,'127.0.0.1',ok));
  const base='http://127.0.0.1:'+server.address().port;
  try{return await fn(base);}
  finally{server.closeAllConnections();await new Promise(done=>server.close(done));}
}
async function status(base){
  const response=await fetch(base+'/api/editor/status');
  assert.equal(response.status,200);return response.json();
}
function saveHeaders(base,info){
  return {Origin:base,'X-Naxx-Editor-Protocol':'naxx-local-save-v1',
    'X-Naxx-Expected-Head':info.expectedHead,
    'X-Naxx-Csrf-Token':info.csrfToken,'Content-Type':'application/zip'};
}
test('local server shows private draft capability without enabling original public repository Save',async()=>{
  await session(stub(),async base=>{
    const value=await status(base);
    assert.equal(value.repository,repo);
    assert.equal(value.storageMode,'private-draft-zip');
    assert.equal(value.ready,true);
    assert.equal(value.draftExists,false);
    assert.equal(value.branch,'main');
    assert.equal(value.backupVerified,false);
    assert.equal(value.publishDisabled,true);
    const capability=client.validateCapability(value);
    assert.equal(capability.storageMode,'private-draft-zip');
  });
});
test('one Save writes only to private provider, then its ZIP is retrievable with session CSRF',async()=>{
  const store=stub();
  await session(store,async base=>{
    const a=await status(base);
    const save=await fetch(base+'/api/editor/save',{
      method:'POST',headers:saveHeaders(base,a),body:zip
    });
    assert.equal(save.status,200);
    const receipt=await save.json();
    assert.equal(receipt.format,'naxx-editor-private-draft-save-v1');
    assert.equal(receipt.parentCommit,OLD);
    assert.equal(receipt.commit,NEXT);
    assert.equal(receipt.published,false);
    assert.equal(store.writes,1);
    const again=await status(base);
    assert.equal(again.draftExists,true);
    assert.equal(again.expectedHead,NEXT);
    const r=await fetch(base+'/api/editor/latest-draft',{
      method:'POST',headers:{
        Origin:base,'X-Naxx-Csrf-Token':a.csrfToken,
        'X-Naxx-Editor-Protocol':'naxx-local-load-private-draft-v1'
      }
    });
    assert.equal(r.status,200);
    const data=await r.json();
    assert.equal(data.format,'naxx-editor-private-draft-load-v1');
    assert.ok(Buffer.from(data.zipBase64,'base64').equals(zip));
  });
});
test('private Save refuses stale old head, missing origin and CSRF before invoking writer',async()=>{
  const store=stub();
  await session(store,async base=>{
    const a=await status(base);
    for(const headers of [
      {...saveHeaders(base,a),'X-Naxx-Expected-Head':'d'.repeat(40)},
      {...saveHeaders(base,a),Origin:'https://evil.example'},
      {...saveHeaders(base,a),'X-Naxx-Csrf-Token':'0'.repeat(64)},
      {...saveHeaders(base,a),'X-Naxx-Editor-Protocol':'naxx-local-review-v1'}
    ]){
      const r=await fetch(base+'/api/editor/save',{method:'POST',headers,body:zip});
      assert.ok(r.status>=400);
    }
    assert.equal(store.writes,0);
  });
});
test('ambiguous private GitHub Save freezes this local session rather than retrying',async()=>{
  const store=stub();store.setFailure(true);
  await session(store,async base=>{
    const s=await status(base);
    const first=await fetch(base+'/api/editor/save',{method:'POST',
      headers:saveHeaders(base,s),body:zip});
    assert.equal(first.status,503);
    assert.match((await first.json()).error,/SAVE_OUTCOME_UNCERTAIN/);
    const after=await status(base);
    assert.equal(after.ready,false);
    const second=await fetch(base+'/api/editor/save',{method:'POST',
      headers:saveHeaders(base,s),body:zip});
    assert.equal(second.status,423);
    assert.equal(store.writes,1);
  });
});
test('browser client accepts private draft Save and load, never confuses it with public site',async()=>{
  const cap={format:'naxx-editor-local-save-capability-v1',
    storageMode:'private-draft-zip',ready:true,authenticated:true,
    repository:repo,branch:'main',expectedHead:OLD,csrfToken:'f'.repeat(64),
    publishDisabled:true,backupVerified:false,exactOldHeadEnforced:true,
    draftExists:true};
  const saved={format:'naxx-editor-private-draft-save-v1',
    result:'saved-private-draft',repository:repo,branch:'main',
    parentCommit:OLD,commit:NEXT,gitBlobSha:'c'.repeat(40),published:false};
  const loaded={format:'naxx-editor-private-draft-load-v1',
    repository:repo,branch:'main',commit:NEXT,zipBase64:zip.toString('base64'),
    published:false};
  const calls=[],fetchFn=async(url,options)=>{
    calls.push({url,options});
    return {ok:true,json:async()=>url.endsWith('/status')?cap:
      url.endsWith('/save')?saved:loaded};
  };
  const loc={protocol:'http:',hostname:'127.0.0.1'};
  const fakeZip={blob:new Blob([zip]),manifest:{githubReady:false,publishable:false}};
  const result=await client.save({location:loc,fetchFn,
    getPageDraft:()=>({files:[{path:'rules/content.html',edits:{'T1':'edit'}}]}),
    getResourceDraft:()=>null,build:async()=>fakeZip,zipTools:{}});
  assert.equal(result.storageMode,'private-draft-zip');
  assert.equal(result.published,false);
  const restored=await client.loadPrivateDraft({location:loc,fetchFn});
  assert.deepEqual(Array.from(restored.bytes),Array.from(zip));
  assert.equal(restored.published,false);
  assert.ok(calls.some(c=>c.url==='/api/editor/latest-draft'&&
    c.options.headers['X-Naxx-Csrf-Token']==='f'.repeat(64)));
});
