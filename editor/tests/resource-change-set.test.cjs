'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {planChangeSet,verifyStagedPackage,rehearseDraft}=
  require('../tools/rehearse-resource-change-set.cjs');
const {withTemporaryPackage,resourcePath}=require('../tools/rehearse-resource-files.cjs');
const original=fs.readFileSync(path.resolve(__dirname,'..','..','site-content.html'));
const SHA='34455f6d901c538e2491a8c16681692e4c02d918b1984d7d0ba081aacb1049e8';
const digest=value=>crypto.createHash('sha256').update(value).digest('hex');
function draft(changes){
  return {format:'naxx-local-resource-draft-v2',baselineSha256:SHA,changes};
}
const edits=draft([
  {index:0,title:'Changed First Resource',content:'First line\n\nThird line.'},
  {index:213,content:'Changed middle resource content.'},
  {index:413,title:'Changed Last Resource'}
]);
test('multi-fragment change-set is deterministic, source-pinned and preserves full site in memory',async()=>{
  const plan=await planChangeSet(original,edits);
  const {manifest,fragments,expected}=plan;
  assert.equal(manifest.format,'naxx-temporary-resource-changes-v1');
  assert.equal(manifest.publishable,false);
  assert.equal(manifest.githubReady,false);
  assert.equal(manifest.deployable,false);
  assert.equal(manifest.recordCount,414);
  assert.equal(manifest.resources.length,414);
  assert.equal(manifest.originalSourceSha256,SHA);
  assert.equal(manifest.stagedSourceSha256,digest(expected));
  assert.equal(manifest.stagedSourceBytes,expected.length);
  assert.equal(fragments.size,3);
  assert.deepEqual(manifest.changes.map(x=>x.position),[1,214,414]);
  assert.deepEqual(manifest.changes.map(x=>x.path),[
    'resources/0001.fragment','resources/0214.fragment','resources/0414.fragment'
  ]);
  assert.deepEqual(manifest.changes[0].fields,['content','title']);
  assert.deepEqual(manifest.changes[1].fields,['content']);
  assert.deepEqual(manifest.changes[2].fields,['title']);
  assert.equal(plan.split.records.every((value,index)=>
    fragments.has(index)?fragments.get(index)!==value:true),true);
  assert.notEqual(digest(expected),SHA);
  const repeat=await planChangeSet(original,edits);
  assert.deepEqual(repeat.manifest,manifest);
  assert.equal(repeat.expected.equals(expected),true);
});
test('three modified fragments are accepted only in a disposable full-site reconstruction',async()=>{
  const result=await rehearseDraft(original,edits);
  assert.equal(result.changedFragments,3);
  assert.equal(result.unchangedFragments,411);
  assert.equal(result.sourceReconstructedExactly,true);
  assert.equal(result.nonResourceSourcePreserved,true);
  assert.equal(result.allChangedPathsVerified,true);
  assert.equal(result.originalManifestRejectedChangedFragments,true);
  assert.equal(result.temporaryFilesDeleted,true);
  assert.equal(result.filesAddedToRepository,0);
  assert.equal(result.published,false);
  assert.equal(result.resourceValuesPrinted,false);
});
test('changed fragments fail closed if a reviewer changes even one staged byte',async()=>{
  const plan=await planChangeSet(original,edits);
  let temporary;
  assert.throws(()=>withTemporaryPackage(original,(root)=>{
    temporary=root;
    for(const [index,value] of plan.fragments)
      fs.writeFileSync(path.join(root,resourcePath(index)),value,'utf8');
    fs.appendFileSync(path.join(root,resourcePath(213)),'unexpected');
    verifyStagedPackage(root,original,edits,plan);
  }),/checksum|differs/);
  assert.equal(fs.existsSync(temporary),false);
});
test('an unrelated fourth resource mutation must be rejected',async()=>{
  const plan=await planChangeSet(original,edits);
  let temporary;
  assert.throws(()=>withTemporaryPackage(original,(root)=>{
    temporary=root;
    for(const [index,value] of plan.fragments)
      fs.writeFileSync(path.join(root,resourcePath(index)),value,'utf8');
    fs.appendFileSync(path.join(root,resourcePath(89)),'unexpected');
    verifyStagedPackage(root,original,edits,plan);
  }),/checksum|differs/);
  assert.equal(fs.existsSync(temporary),false);
});
test('the recorded fragment path and checksum cannot be forged',async()=>{
  const plan=await planChangeSet(original,edits);
  let temporary;
  assert.throws(()=>withTemporaryPackage(original,(root)=>{
    temporary=root;
    for(const [index,value] of plan.fragments)
      fs.writeFileSync(path.join(root,resourcePath(index)),value,'utf8');
    plan.manifest.changes[0].path='index.html';
    verifyStagedPackage(root,original,edits,plan);
  }),/manifest entry invalid/);
  assert.equal(fs.existsSync(temporary),false);
});
test('wrong source hash, malformed draft and invalid value stop before staging anything',async()=>{
  await assert.rejects(planChangeSet(Buffer.concat([original,Buffer.from('x')]),edits),/hash mismatch/);
  await assert.rejects(planChangeSet(original,draft([])),/No resource/);
  await assert.rejects(planChangeSet(original,{
    ...edits,baselineSha256:'0'.repeat(64)
  }),/mismatched|Unsupported/);
  await assert.rejects(planChangeSet(original,draft([
    {index:0,title:'Edited Title',content:'<script>unsafe</script>'}
  ])),/Invalid|Unsupported/);
  await assert.rejects(planChangeSet(original,draft([
    {index:0,title:'Duplicated'},{index:0,title:'Repeated'}
  ])),/duplicate|Invalid/i);
  await assert.rejects(planChangeSet(original,{
    format:'naxx-local-resource-title-draft-v1',baselineSha256:SHA,
    changes:[{index:0,title:'Old format'}]
  }),/Only explicit protected v2/);
});
test('manifest and fragments do not include any private source ID or title labels',async()=>{
  const {manifest}=await planChangeSet(original,draft([{index:0,title:'Safe Test Title'}]));
  const rendered=JSON.stringify(manifest);
  assert.equal(rendered.includes('Safe Test Title'),false);
  assert.equal(Object.hasOwn(manifest,'sourceText'),false);
  assert.equal(Object.hasOwn(manifest,'html'),false);
  assert.equal(manifest.changes[0].path,'resources/0001.fragment');
  assert.equal(manifest.changes[0].fields.length,1);
});
