'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {createCompanion,makeReviewResult,parseArgs}=require('../tools/local-save-companion.cjs');
const sha='a'.repeat(40);
const mockPlan={
  format:'naxx-private-browser-zip-to-git-review-v1',
  reviewOnly:true,gitHubReady:false,expectedGitCommit:sha,
  cleanGitCheckoutBeforeAndAfter:true,checkedResourceCount:414,
  canApply:false,canPush:false,canPublish:false,
  repositoryFilesWritten:0,gitHubWrites:0,
  existingPageAndNavigationChanges:2,proposedResourceChanges:3
};
async function session(review,run){
  const server=createCompanion({review,editorDir:path.resolve(__dirname,'..')});
  await new Promise((ok,bad)=>server.once('error',bad).listen(0,'127.0.0.1',ok));
  const base='http://127.0.0.1:'+server.address().port;
  try{return await run(base);}
  finally {
    server.closeAllConnections();
    await new Promise(ok=>server.close(ok));
  }
}
async function status(base){
  const resp=await fetch(base+'/api/editor/status');
  assert.equal(resp.status,200);
  return resp.json();
}
function headers(base,token){
  return {
    Origin:base,'X-Naxx-Csrf-Token':token,
    'X-Naxx-Editor-Protocol':'naxx-local-review-v1',
    'Content-Type':'application/zip'
  };
}
const payload=Buffer.alloc(64,65);
test('local GET is read-only; status refuses real Save but offers source review',async()=>{
  await session(async()=>makeReviewResult(mockPlan,sha),async(base)=>{
    const info=await status(base);
    assert.equal(info.format,'naxx-editor-local-save-capability-v1');
    assert.equal(info.ready,false);
    assert.equal(info.authenticated,false);
    assert.equal(info.backupVerified,false);
    assert.equal(info.exactOldHeadEnforced,false);
    assert.equal(info.reviewReady,true);
    assert.match(info.csrfToken,/^[0-9a-f]{64}$/);
    assert.equal(info.branch,null);
    assert.equal(info.expectedHead,null);
  });
});
test('serves only explicit editor files; never arbitrary repo source or secrets',async()=>{
  await session(null,async(base)=>{
    const html=await fetch(base+'/editor/index.html');
    assert.equal(html.status,200);
    assert.match(await html.text(),/Naxxramas — Local Website Editor/);
    const js=await fetch(base+'/editor/github-save-client.js');
    assert.equal(js.status,200);
    assert.match(await js.text(),/NaxxGitHubSaveClient/);
    for(const url of ['/site-content.html','/editor/../site-content.html',
      '/editor/tools/local-save-companion.cjs','/editor/README.md',
      '/.git/config','/api/editor/save']) {
      const r=await fetch(base+url);
      assert.notEqual(r.status,200);
    }
  });
});
test('protected GitHub Save always refuses even with valid local session',async()=>{
  let count=0;
  await session(async()=>{count++;return makeReviewResult(mockPlan,sha);},async(base)=>{
    const info=await status(base);
    const resp=await fetch(base+'/api/editor/save',{
      method:'POST',headers:headers(base,info.csrfToken),body:payload
    });
    assert.equal(resp.status,423);
    const body=await resp.json();
    assert.match(body.error,/disabled/);
    assert.equal(count,0);
  });
});
test('a local ZIP review calls injected read-only validator once, and returns metadata only',async()=>{
  let count=0;
  await session(async(zip)=>{
    count++;
    assert.equal(Buffer.isBuffer(zip),true);
    assert.equal(zip.equals(payload),true);
    return makeReviewResult(mockPlan,sha);
  },async(base)=>{
    const info=await status(base);
    const resp=await fetch(base+'/api/editor/review',{
      method:'POST',headers:headers(base,info.csrfToken),body:payload
    });
    assert.equal(resp.status,200);
    const result=await resp.json();
    assert.equal(result.reviewOnly,true);
    assert.equal(result.sourceChecked,true);
    assert.equal(result.gitHubWrite,false);
    assert.equal(result.published,false);
    assert.equal(result.checkedResourceCount,414);
    assert.equal(result.changedResources,3);
    assert.equal(result.changedPageAndNavigationFiles,2);
    assert.equal(result.expectedGitCommit,sha);
    assert.equal(count,1);
  });
});
test('refuses missing CSRF, wrong Origin, wrong protocol, and unsuitable content types',async()=>{
  let count=0;
  await session(async()=>{count++;return makeReviewResult(mockPlan,sha);},async(base)=>{
    const info=await status(base);
    const good=headers(base,info.csrfToken);
    for(const badHeaders of [
      {...good,'X-Naxx-Csrf-Token':'0'.repeat(64)},
      {...good,Origin:'https://malicious.invalid'},
      {...good,'X-Naxx-Editor-Protocol':'naxx-local-save-v1'},
      {...good,'Content-Type':'application/json'},
    ]) {
      const resp=await fetch(base+'/api/editor/review',{
        method:'POST',headers:badHeaders,body:payload
      });
      assert.ok(resp.status>=400);
    }
    assert.equal(count,0);
  });
});
test('does not trust Host headers, cross-origin preflights or another URL path',async()=>{
  await session(async()=>makeReviewResult(mockPlan,sha),async(base)=>{
    const wrong=await fetch(base+'/api/editor/status',{headers:{Host:'website.evil.invalid'}});
    assert.equal(wrong.status,403);
    const preflight=await fetch(base+'/api/editor/review',{
      method:'OPTIONS',headers:{Origin:'https://evil.invalid'}
    });
    assert.equal(preflight.status,403);
    const unexpected=await fetch(base+'/api/editor/not-a-route');
    assert.equal(unexpected.status,404);
  });
});
test('rejects oversize or undeclared ZIP and does not invoke reviewer',async()=>{
  let count=0;
  await session(async()=>{count++;return makeReviewResult(mockPlan,sha);},async(base)=>{
    const info=await status(base);
    const large=Buffer.alloc(20*1024*1024+1);
    const tooLarge=await fetch(base+'/api/editor/review',{
      method:'POST',headers:headers(base,info.csrfToken),body:large
    });
    assert.equal(tooLarge.status,413);
    const empty=await fetch(base+'/api/editor/review',{
      method:'POST',headers:headers(base,info.csrfToken),body:Buffer.alloc(4)
    });
    assert.equal(empty.status,413);
    assert.equal(count,0);
  });
});
test('malformed or falsely published reviewer results are refused, never called a Save',async()=>{
  await session(async()=>({...makeReviewResult(mockPlan,sha),published:true}),async(base)=>{
    const info=await status(base);
    const resp=await fetch(base+'/api/editor/review',{
      method:'POST',headers:headers(base,info.csrfToken),body:payload
    });
    assert.equal(resp.status,422);
    const body=await resp.json();
    assert.match(body.error,/No GitHub files were changed/);
  });
});
test('exact pinned source plan cannot claim writes, changed source or no edits',()=>{
  assert.equal(makeReviewResult(mockPlan,sha).reviewOnly,true);
  for(const bad of [
    {...mockPlan,canApply:true},{...mockPlan,gitHubWrites:1},
    {...mockPlan,repositoryFilesWritten:1},{...mockPlan,expectedGitCommit:'b'.repeat(40)},
    {...mockPlan,proposedResourceChanges:0,existingPageAndNavigationChanges:0},
    {...mockPlan,checkedResourceCount:413},
    {...mockPlan,cleanGitCheckoutBeforeAndAfter:false}
  ])assert.throws(()=>makeReviewResult(bad,sha));
});
test('CLI arguments and source files cannot enable real remote Save',()=>{
  assert.deepEqual(parseArgs(['--checkout','/tmp/example','--commit',sha]),
    {checkout:'/tmp/example',commit:sha});
  assert.throws(()=>parseArgs(['--checkout','/tmp/example']));
  assert.throws(()=>parseArgs(['--checkout','/tmp/example','--checkout','/tmp/again']));
  const src=fs.readFileSync(path.join(__dirname,'..','tools','local-save-companion.cjs'),'utf8');
  assert.doesNotMatch(src,/update_ref|updateRefs|git\s+push|github\.com\/repos\/.*\/git\/refs/);
  assert.match(src,/Real GitHub Save remains disabled/);
});
