'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const core=require('../restore-preflight-core.js');
const files=require('../restore-file-check-core.js');
const {withTemporaryVersions,verify,draftFrom,save}=
  require('../tools/rehearse-versioned-resource-sessions.cjs');
const {MANIFEST}=require('../tools/rehearse-resource-only-overlay.cjs');
const original=fs.readFileSync(path.resolve(__dirname,'..','..','site-content.html'));
const fake=()=>({
  format:core.MANIFEST,privateOnly:true,publishable:false,deployable:false,
  originalSha256:core.BASE,revision:0,parentSha256:null,
  sourceSha256:core.BASE,sourceBytes:original.length,
  resources:Array.from({length:core.COUNT},(_,i)=>({
    index:i,path:core.pathFor(i),sha256:String(i+1).padStart(64,'0')
  }))
});
const fakeDraft=m=>({
  format:core.DRAFT,sourceBaselineSha256:core.BASE,
  revision:m.revision,sourceSha256:m.sourceSha256,
  changes:[{index:0,expectedSha256:m.resources[0].sha256,
    title:'Unpublished private test title'}]
});
const inspect=(m,d)=>files.inspect(JSON.stringify(m),JSON.stringify(d));
test('file checks have bounded JSON size limits and return no save/publish capabilities',()=>{
  assert.equal(files.MAX_MANIFEST_BYTES,262144);
  assert.equal(files.MAX_DRAFT_BYTES,16777216);
  for(const answer of [files.missing(),files.tooLarge(),files.readFailed()]){
    assert.equal(answer.isBlocked,true);
    assert.equal(answer.canApply,false);
    assert.equal(answer.canPublish,false);
    assert.equal(answer.canAutoMerge,false);
    assert.equal(answer.readOnly,true);
    assert.equal(Object.isFrozen(answer),true);
  }
  assert.equal(files.bounds(0,100),false);
  assert.equal(files.bounds(100,100),true);
  assert.equal(files.bounds(101,100),false);
  assert.equal(files.bounds(NaN,100),false);
});
test('matching local JSON is only reviewable and never exposes resource text',()=>{
  const m=fake(),d=fakeDraft(m),answer=inspect(m,d);
  assert.equal(answer.code,'review-only');
  assert.equal(answer.isBlocked,false);
  assert.equal(answer.canApply,false);
  assert.equal(answer.canPublish,false);
  assert.equal(answer.requestedResourceCount,1);
  assert.equal(JSON.stringify(answer).includes(d.changes[0].title),false);
});
test('outdated JSON draft is rejected even if only a different resource changed',()=>{
  const m=fake(),d=fakeDraft(m);
  m.revision=1;m.parentSha256=core.BASE;m.sourceSha256='a'.repeat(64);
  m.resources[413].sha256='c'.repeat(64);
  const answer=inspect(m,d);
  assert.equal(answer.code,'stale');
  assert.equal(answer.changedTargetCount,0);
});
test('changed target checksum is rejected even when revision matches',()=>{
  const m=fake(),d=fakeDraft(m);
  m.resources[0].sha256='d'.repeat(64);
  assert.equal(inspect(m,d).code,'record-conflict');
});
test('malformed JSON and unsupported old v2 draft fail closed',()=>{
  const m=fake(),d=fakeDraft(m);
  assert.equal(files.inspect('{',JSON.stringify(d)).code,'invalid-source');
  assert.equal(files.inspect(JSON.stringify(m),'{').code,'invalid-draft');
  assert.equal(files.inspect(null,JSON.stringify(d)).code,'read-failed');
  assert.equal(files.inspect(JSON.stringify(m),null).code,'read-failed');
  const old={format:'naxx-local-resource-draft-v2',
    baselineSha256:core.BASE,changes:[{index:0,title:'Older draft'}]};
  assert.equal(inspect(m,old).code,'invalid-draft');
  assert.equal(files.inspect(' ',JSON.stringify(d)).code,'invalid-source');
});
test('oversized or empty inputs are rejected without parsing',()=>{
  const m=fake(),d=fakeDraft(m);
  assert.equal(files.inspect('x'.repeat(files.MAX_MANIFEST_BYTES+1),
    JSON.stringify(d)).code,'size-limit');
  assert.equal(files.inspect(JSON.stringify(m),
    'x'.repeat(files.MAX_DRAFT_BYTES+1)).code,'size-limit');
  assert.equal(files.inspect('',JSON.stringify(d)).code,'size-limit');
});
test('real test-only saved manifest and v1 draft stay private, detect subsequent saves',async()=>{
  await withTemporaryVersions(original,dir=>{
    const state0=verify(dir,original);
    const firstDraft=draftFrom(state0,[{index:0,title:'Private versioned test edit'}]);
    const rawM=fs.readFileSync(path.join(dir,...MANIFEST.split('/')),'utf8');
    assert.equal(files.inspect(rawM,JSON.stringify(firstDraft)).code,'review-only');
    save(dir,original,draftFrom(state0,[{index:413,title:'Revised unrelated title'}]));
    const fresh=verify(dir,original);
    const rawFresh=fs.readFileSync(path.join(dir,...MANIFEST.split('/')),'utf8');
    assert.equal(files.inspect(rawFresh,JSON.stringify(firstDraft)).code,'stale');
    assert.equal(files.inspect(rawFresh,JSON.stringify(draftFrom(fresh,[
      {index:0,title:'Second reviewed version'}]))).code,'review-only');
  });
});
test('standalone local-file UI has two bounded choices, no upload/save, restrictive CSP',()=>{
  const dir=path.resolve(__dirname,'..');
  const html=fs.readFileSync(path.join(dir,'restore-file-check.html'),'utf8');
  const js=fs.readFileSync(path.join(dir,'restore-file-check.js'),'utf8');
  assert.match(html,/connect-src 'none'/);
  assert.match(html,/form-action 'none'/);
  assert.match(html,/id="manifest-file" type="file"/);
  assert.match(html,/id="draft-file" type="file"/);
  assert.match(html,/aria-live="polite"/);
  assert.match(html,/Maximum 256 KiB/);
  assert.match(html,/Maximum 16 MiB/);
  assert.match(html,/Matching metadata is not permission to save/);
  assert.equal(html.includes('<form'),false);
  assert.equal(html.includes('<iframe'),false);
  assert.equal(html.includes('multiple'),false);
  for(const word of ['fetch(', 'XMLHttpRequest','sendBeacon(','.innerHTML=','localStorage','sessionStorage','indexedDB','.download=','.submit('])
    assert.equal(js.includes(word),false,word+' forbidden in file-review script');
  assert.doesNotThrow(()=>new vm.Script(js));
});
