'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {createCompanion}=require('../tools/local-save-companion.cjs');
const {checkedSetup,checkedReceipt,REPOSITORY}=require('../tools/protected-save-contract.cjs');
const old='a'.repeat(40),next='b'.repeat(40),token='f'.repeat(64),branch='editor-saves/owner-drafts';
const receipt={
  format:'naxx-editor-local-save-result-v1',
  result:'saved-and-independently-verified',repository:REPOSITORY,branch,
  parentCommit:old,commit:next,fullSiteSha256:'c'.repeat(64),
  remoteRefVerified:true,sourceFilesVerified:true,backupVerified:true,
  published:false
};
function approved(write){
  return {repository:REPOSITORY,branch,expectedHead:old,
    publishDisabled:true,ownerApprovedDevelopmentBranchSave:true,
    independentlyRestoredOwnerBackup:true,authenticatedScopedWriter:true,
    exactOldHeadEnforced:true,write};
}
async function service(config,run){
  const server=createCompanion({protectedSave:config,editorDir:path.resolve(__dirname,'..')});
  await new Promise((ok,no)=>server.once('error',no).listen(0,'127.0.0.1',ok));
  const base='http://127.0.0.1:'+server.address().port;
  try{return await run(base);}
  finally{server.closeAllConnections();await new Promise(ok=>server.close(ok));}
}
async function status(base){const r=await fetch(base+'/api/editor/status');assert.equal(r.status,200);return r.json();}
function headers(base,csrf,expected=old){
  return {Origin:base,'X-Naxx-Editor-Protocol':'naxx-local-save-v1',
    'X-Naxx-Expected-Head':expected,
    'X-Naxx-Csrf-Token':csrf,'Content-Type':'application/zip'};
}
const zip=Buffer.alloc(64,67);
test('save contract refuses main, foreign repositories, missing backup or invalid permission',()=>{
  for(const bad of [
    {...approved(()=>receipt),branch:'main'},
    {...approved(()=>receipt),branch:'feature/draft'},
    {...approved(()=>receipt),repository:'Other/repo'},
    {...approved(()=>receipt),ownerApprovedDevelopmentBranchSave:false},
    {...approved(()=>receipt),independentlyRestoredOwnerBackup:false},
    {...approved(()=>receipt),authenticatedScopedWriter:false},
    {...approved(()=>receipt),exactOldHeadEnforced:false},
    {...approved(()=>receipt),publishDisabled:false},
    {...approved(()=>receipt),expectedHead:'not-a-commit'},
    {...approved(()=>receipt),write:null}
  ])assert.throws(()=>checkedSetup(bad));
  assert.equal(checkedSetup(approved(()=>receipt)).branch,branch);
});
test('Save receipts must match verified branch, original head, full site hash and unpublished outcome',()=>{
  const setup=checkedSetup(approved(()=>receipt));
  assert.equal(checkedReceipt(receipt,setup).commit,next);
  for(const changed of [
    {...receipt,repository:'Other/repo'},
    {...receipt,branch:'main'},
    {...receipt,parentCommit:'d'.repeat(40)},
    {...receipt,commit:old},
    {...receipt,fullSiteSha256:'wrong'},
    {...receipt,remoteRefVerified:false},
    {...receipt,sourceFilesVerified:false},
    {...receipt,backupVerified:false},
    {...receipt,published:true},
    {...receipt,result:'saved'}
  ])assert.throws(()=>checkedReceipt(changed,setup));
});
test('default companion continues to refuse Save and never exposes an enabled connection',async()=>{
  await service(null,async base=>{
    const s=await status(base);
    assert.equal(s.ready,false);
    assert.equal(s.authenticated,false);
    const r=await fetch(base+'/api/editor/save',{method:'POST',
      headers:headers(base,s.csrfToken),body:zip});
    assert.equal(r.status,423);
  });
});
test('an explicit writer receives ONE validated ZIP, expected branch and parent; independent receipt returned',async()=>{
  let writes=0;
  await service(approved(async(bytes,context)=>{
    writes++;
    assert.ok(Buffer.isBuffer(bytes));
    assert.ok(bytes.equals(zip));
    assert.deepEqual(context,{repository:REPOSITORY,branch,
      expectedHead:old,publishDisabled:true});
    return receipt;
  }),async base=>{
    const s=await status(base);
    assert.equal(s.ready,true);
    assert.equal(s.authenticated,true);
    assert.equal(s.backupVerified,true);
    assert.equal(s.branch,branch);
    assert.equal(s.expectedHead,old);
    const r=await fetch(base+'/api/editor/save',{method:'POST',
      headers:headers(base,s.csrfToken),body:zip});
    assert.equal(r.status,200);
    const saved=await r.json();
    assert.deepEqual(saved,receipt);
    assert.equal(writes,1);
    const after=await status(base);
    assert.equal(after.ready,false);
    const second=await fetch(base+'/api/editor/save',{method:'POST',
      headers:headers(base,s.csrfToken),body:zip});
    assert.equal(second.status,423);
    assert.equal(writes,1);
  });
});
test('wrong origin, protocol, CSRF, branch parent or content type never reaches the writer',async()=>{
  let writes=0;
  await service(approved(()=>{writes++;return receipt;}),async base=>{
    const s=await status(base),good=headers(base,s.csrfToken);
    for(const bad of [
      {...good,Origin:'http://malicious.invalid'},
      {...good,'X-Naxx-Csrf-Token':token},
      {...good,'X-Naxx-Editor-Protocol':'naxx-local-review-v1'},
      {...good,'X-Naxx-Expected-Head':'d'.repeat(40)},
      {...good,'Content-Type':'application/json'}
    ]){
      const r=await fetch(base+'/api/editor/save',{method:'POST',headers:bad,body:zip});
      assert.ok(r.status>=400);
    }
    assert.equal(writes,0);
  });
});
test('failed, throwing or falsely acknowledged remote Save is uncertain, never retried',async()=>{
  for(const writer of [
    async()=>{throw Error('network failure');},
    async()=>({...receipt,remoteRefVerified:false}),
    async()=>({...receipt,published:true})
  ]){
    let count=0;
    await service(approved(async()=>{count++;return writer();}),async base=>{
      const s=await status(base);
      const r=await fetch(base+'/api/editor/save',{method:'POST',
        headers:headers(base,s.csrfToken),body:zip});
      assert.equal(r.status,503);
      assert.match((await r.json()).error,/SAVE_OUTCOME_UNCERTAIN/);
      const after=await status(base);
      assert.equal(after.ready,false);
      const again=await fetch(base+'/api/editor/save',{method:'POST',
        headers:headers(base,s.csrfToken),body:zip});
      assert.equal(again.status,423);
      assert.equal(count,1);
    });
  }
});
test('normal CLI cannot enable remote Save and protected route contains no GitHub write client',()=>{
  const src=fs.readFileSync(path.join(__dirname,'..','tools','local-save-companion.cjs'),'utf8');
  assert.match(src,/Real GitHub Save remains disabled/);
  assert.match(src,/protectedSave=options.protectedSave/);
  assert.doesNotMatch(src,/https\.request|git\s+push|updateRefs\(|GITHUB_TOKEN/);
  const contract=fs.readFileSync(path.join(__dirname,'..','tools','protected-save-contract.cjs'),'utf8');
  assert.doesNotMatch(contract,/https\.request|git\s+push|updateRefs\(|GITHUB_TOKEN/);
});
