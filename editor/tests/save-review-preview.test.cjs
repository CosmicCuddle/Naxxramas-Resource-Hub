'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const core=require('../save-review-core.js');
const sample=require('../save-review-examples.js');
const preflight=require('../restore-preflight-core.js');
const {withTemporaryVersions,verify,draftFrom,save}=
  require('../tools/rehearse-versioned-resource-sessions.cjs');
const {proposedReceipt}=require('../tools/plan-private-github-source-review.cjs');
const original=fs.readFileSync(path.resolve(__dirname,'..','..','site-content.html'));

test('fictional matching receipt displays exact proposed paths, never source values or save permission',()=>{
  const {manifest,receipt}=sample.generate();
  assert.equal(core.validReceipt(receipt),true);
  const output=core.inspect(manifest,receipt);
  assert.equal(output.code,'review-only');
  assert.equal(output.latestRevision,0);
  assert.equal(output.proposedRevision,1);
  assert.equal(output.editedResources,1);
  assert.equal(output.unchangedResources,413);
  assert.equal(output.proposedFileCount,3);
  assert.deepEqual(new Set(output.files.map(x=>x.path)),
    new Set([preflight.pathFor(0),core.MANIFEST,core.RUNTIME]));
  assert.equal(output.files[0].label,'Resource 0001');
  assert.equal(output.actualSourceFilesVerified,false);
  assert.equal(output.fullHtmlReconstructed,false);
  assert.equal(output.remoteHeadAuthenticated,false);
  assert.equal(output.ownerApprovalChecked,false);
  assert.equal(output.canApply,false);
  assert.equal(output.canMerge,false);
  assert.equal(output.canPublish,false);
  assert.equal(output.noDataSaved,true);
  assert.ok(Object.isFrozen(output.files));
  assert.ok(!JSON.stringify(output).includes(receipt.proposedFullSiteSha256));
});
test('older draft is clearly blocked without losing the list of proposed changes',()=>{
  const {stale,receipt}=sample.generate();
  const output=core.inspect(stale,receipt);
  assert.equal(output.code,'stale');
  assert.match(output.message,/Keep the draft/);
  assert.match(output.message,/Nothing was overwritten/);
  assert.equal(output.proposedFileCount,3);
  assert.equal(output.canApply,false);
});
test('same full-source revision with altered resource fingerprint is explicitly flagged',()=>{
  const {changed,receipt}=sample.generate();
  const output=core.inspect(changed,receipt);
  assert.equal(output.code,'resource-conflict');
  assert.equal(output.files[0].label,'Resource 0001');
  assert.equal(output.canApply,false);
});
test('explicit preview rejection is reversible and preserves all draft-file ownership',()=>{
  const out=core.rejected();
  assert.equal(out.code,'rejected');
  assert.match(out.message,/selected JSON files and saved drafts were not deleted/);
  assert.equal(out.files.length,0);
  assert.equal(out.proposedFileCount,0);
  assert.equal(out.metadataChecked,false);
  assert.equal(out.canApply,false);
  assert.equal(out.canPublish,false);
  const {manifest,receipt}=sample.generate();
  assert.equal(core.inspect(manifest,receipt).code,'review-only');
});
test('unsupported manifest or previous editor drafts cannot be misread as release receipts',()=>{
  const {manifest,receipt}=sample.generate();
  assert.equal(core.inspect({...manifest,resources:[]},receipt).code,'invalid-source');
  assert.equal(core.inspect(manifest,{
    format:'naxx-local-resource-draft-v2',baselineSha256:preflight.BASE,
    changes:[{index:0,title:'Older editor text'}]
  }).code,'invalid-receipt');
  assert.equal(core.inspect(manifest,{
    format:'naxx-local-draft-v3',files:[]
  }).code,'invalid-receipt');
  assert.equal(core.inspectJSON('{',JSON.stringify(receipt)).code,'invalid-source');
  assert.equal(core.inspectJSON(JSON.stringify(manifest),'{').code,'invalid-receipt');
});
test('unsafe, injected, missing or duplicate resource paths and extra fields are refused',()=>{
  const {manifest,receipt}=sample.generate();
  for(const altered of [
    '../index.html','index.html',
    'content/resource-overlays/resources/0415.fragment',
    'content/resource-overlays/resources/0000.fragment',
    '<script>alert(1)</script>'
  ]){
    const fake={...receipt,proposedPaths:receipt.proposedPaths.map(x=>({...x}))};
    fake.proposedPaths[0].path=altered;
    assert.equal(core.inspect(manifest,fake).code,'invalid-receipt',altered);
  }
  const repeated={...receipt,proposedPaths:receipt.proposedPaths.map(x=>({...x}))};
  repeated.proposedPaths[0].path=core.MANIFEST;
  assert.equal(core.inspect(manifest,repeated).code,'invalid-receipt');
  assert.equal(core.inspect(manifest,{...receipt,extra:'untrusted'}).code,'invalid-receipt');
  const nested={...receipt,proposedPaths:receipt.proposedPaths.map(x=>({...x}))};
  nested.proposedPaths[0].evil='<img onerror=alert(1)>';
  assert.equal(core.inspect(manifest,nested).code,'invalid-receipt');
});
test('a forged receipt that claims permission, verified backup, real commits or included bytes is refused',()=>{
  const {manifest,receipt}=sample.generate();
  const disallowed=[
    ['approved',true],['githubReady',true],['canApply',true],
    ['canPublish',true],['canMerge',true],
    ['trustedGitCommitChecked',true],
    ['privateGitRecoveryBackupVerified',true],
    ['realAdminWriteFlowVerified',true],
    ['newSourceBytesIncluded',true],['repoFilesWritten',1],
    ['gitActionsTaken',1],['canonicalLayoutApproved',true]
  ];
  for(const [key,value] of disallowed){
    const forged={...receipt,[key]:value};
    assert.equal(core.inspect(manifest,forged).code,'invalid-receipt',key);
  }
});
test('inconsistent full-site digest, revision, record count and source byte sizes fail closed',()=>{
  const {manifest,receipt}=sample.generate();
  for(const edited of [
    {...receipt,proposedRevision:7},
    {...receipt,editedResourceCount:2},
    {...receipt,unchangedResourceCount:411},
    {...receipt,proposedFileCount:4},
    {...receipt,proposedFullSiteSha256:'not-a-hash'},
    {...receipt,sourceBytesAfter:0}
  ])assert.equal(core.inspect(manifest,edited).code,'invalid-receipt');
  const wrongRuntime={...receipt,proposedPaths:receipt.proposedPaths.map(x=>({...x}))};
  wrongRuntime.proposedPaths.find(x=>x.path===core.RUNTIME).proposedNewSha256='f'.repeat(64);
  assert.equal(core.inspect(manifest,wrongRuntime).code,'invalid-receipt');
  const wrongSize={...receipt,proposedPaths:receipt.proposedPaths.map(x=>({...x}))};
  wrongSize.proposedPaths.find(x=>x.path===core.RUNTIME).newBytes=1;
  assert.equal(core.inspect(manifest,wrongSize).code,'invalid-receipt');
});
test('manifest revision and source size must match the reviewed baseline, not just a claimed title',()=>{
  const {manifest,receipt}=sample.generate();
  const newer={...manifest,revision:1,parentSha256:preflight.BASE,
    sourceSha256:'e'.repeat(64)};
  assert.equal(core.inspect(newer,receipt).code,'stale');
  const changedBytes={...manifest,sourceBytes:manifest.sourceBytes+1};
  assert.equal(core.inspect(changedBytes,receipt).code,'stale');
});
test('JSON input bounds prevent massive metadata receipts and never include raw private field values',()=>{
  const {manifest,receipt}=sample.generate();
  assert.equal(core.inspectJSON(JSON.stringify(manifest),JSON.stringify(receipt)).code,
    'review-only');
  assert.equal(core.inspectJSON('a'.repeat(core.MAX_MANIFEST_BYTES+1),
    JSON.stringify(receipt)).code,'invalid-source');
  assert.equal(core.inspectJSON(JSON.stringify(manifest),
    'x'.repeat(core.MAX_RECEIPT_BYTES+1)).code,'invalid-receipt');
  assert.equal(core.size(0,262144),false);
  assert.equal(core.size(262145,262144),false);
  assert.equal(core.size(262144,262144),true);
});
test('real physical 414-resource planner receipt agrees with this independent browser review model',async()=>{
  await withTemporaryVersions(original,async dir=>{
    const current=verify(dir,original);
    const draft=draftFrom(current,[{index:0,title:'Private exact-source review'}]);
    const receipt=proposedReceipt(dir,original,draft);
    const output=core.inspect(current.manifest,receipt);
    assert.equal(output.code,'review-only');
    assert.equal(output.proposedFileCount,3);
    assert.equal(output.editedResources,1);
    assert.equal(output.files.some(x=>x.path===core.RUNTIME),true);
    save(dir,original,draft);
    const newer=verify(dir,original);
    const stale=core.inspect(newer.manifest,receipt);
    assert.equal(stale.code,'stale');
    assert.equal(stale.canApply,false);
  });
});
test('private preview page is accessible, offline and never offers source modification',()=>{
  const base=path.resolve(__dirname,'..');
  const html=fs.readFileSync(path.join(base,'save-review-preview.html'),'utf8');
  const js=fs.readFileSync(path.join(base,'save-review.js'),'utf8');
  const demo=fs.readFileSync(path.join(base,'save-review-examples.js'),'utf8');
  assert.match(html,/id="sample-current"/);
  assert.match(html,/id="sample-stale"/);
  assert.match(html,/id="sample-conflict"/);
  assert.match(html,/id="reject-review"/);
  assert.match(html,/does not delete your files or reject a real GitHub pull request/);
  assert.match(js,/update\(core\.rejected\(\)\)/);
  assert.match(html,/id="current-manifest"/);
  assert.match(html,/id="planned-receipt"/);
  assert.match(html,/aria-live="polite"/);
  assert.match(html,/connect-src 'none'/);
  assert.match(html,/form-action 'none'/);
  assert.match(html,/READ ONLY/);
  assert.match(html,/not authenticate its contents/);
  assert.match(js,/textContent=file\.path/);
  for(const needle of ['<form','<iframe','type="submit"']){
    assert.equal(html.includes(needle),false);
  }
  for(const needle of ['fetch(', 'sendBeacon(', 'localStorage.',
    'sessionStorage.','XMLHttpRequest','indexedDB',
    '.innerHTML=', '.submit(', '.download=']){
    assert.equal(js.includes(needle),false,needle);
  }
  assert.doesNotThrow(()=>new Function(js));
  assert.doesNotThrow(()=>new Function(demo));
});
