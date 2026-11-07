'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {SOURCE_SHA}=require('../tools/audit-source-storage-budget.cjs');
const {recordPath,MANIFEST}=require('../tools/rehearse-resource-only-overlay.cjs');
const {verify,draftFrom,plan,save,rollback,withTemporaryVersions,rehearse}=
  require('../tools/rehearse-versioned-resource-sessions.cjs');
const original=fs.readFileSync(path.resolve(__dirname,'..','..','site-content.html'));
const relative=(folder,name)=>path.join(folder,...name.split('/'));
test('two saved editing sessions use distinct compatibility hashes and restore exact original bytes',async()=>{
  const report=await rehearse(original);
  assert.equal(report.format,'naxx-private-two-session-save-test-v1');
  assert.deepEqual(report.revisions,[1,2]);
  assert.deepEqual(report.changedPerSession,[1,1]);
  assert.equal(report.staleRejected,true);
  assert.equal(report.finalCompatibilitySha256Verified,true);
  assert.equal(report.totalFiles,415);
  assert.equal(report.originalShellCopied,false);
  assert.equal(report.restored.restored,2);
  assert.equal(report.restored.exactOriginal,true);
  assert.equal(report.temporaryDataDeleted,true);
  assert.equal(report.originalWebsiteUnchanged,true);
  assert.equal(report.siteFilesWritten,0);
  assert.equal(report.published,false);
  assert.equal(report.deployable,false);
  assert.equal(report.ownerApproved,false);
});
test('stale same-resource and disjoint-resource drafts are both blocked without changing version',async()=>{
  await withTemporaryVersions(original,dir=>{
    const initial=verify(dir,original);
    const staleSame=draftFrom(initial,[{index:0,title:'Outdated same-resource text'}]);
    const staleOther=draftFrom(initial,[{index:41,title:'Outdated other-resource text'}]);
    const first=save(dir,original,draftFrom(initial,[{index:0,title:'New saved text'}]));
    for(const stale of [staleSame,staleOther])
      assert.throws(()=>save(dir,original,stale),/Stale save/);
    const stable=verify(dir,original);
    assert.equal(stable.manifest.revision,1);
    assert.equal(stable.manifest.sourceSha256,first.after.manifest.sourceSha256);
    assert.equal(stable.records[41],initial.records[41]);
    assert.equal(stable.records[0],first.after.records[0]);
    const second=save(dir,original,draftFrom(stable,[
      {index:413,content:'Second reviewed session with a\nnew line.'}]));
    assert.equal(second.after.manifest.revision,2);
    assert.equal(second.after.records[0],first.after.records[0]);
    assert.equal(second.after.records[41],initial.records[41]);
  });
});
test('forged expected record SHA and invalid draft fields are refused with no writes',async()=>{
  await withTemporaryVersions(original,dir=>{
    const before=verify(dir,original),draft=draftFrom(before,[{index:1,title:'Preview'}]);
    assert.throws(()=>save(dir,original,{
      ...draft,changes:[{...draft.changes[0],expectedSha256:'0'.repeat(64)}]
    }),/Resource checksum conflict/);
    assert.throws(()=>save(dir,original,{
      ...draft,changes:[{...draft.changes[0],unexpected:'injection'}]
    }),/Unsafe or duplicated/);
    assert.throws(()=>save(dir,original,{
      ...draft,changes:[draft.changes[0],draft.changes[0]]
    }),/Unsafe or duplicated/);
    assert.throws(()=>save(dir,original,{
      ...draft,sourceSha256:'0'.repeat(64)
    }),/Stale save/);
    assert.equal(verify(dir,original).manifest.revision,0);
    assert.equal(verify(dir,original).manifest.sourceSha256,SOURCE_SHA);
  });
});
test('malformed input, unsafe edits and no-op saves are rejected',async()=>{
  await withTemporaryVersions(original,dir=>{
    const before=verify(dir,original),valid=draftFrom(before,[{index:0,title:'Safe'}]);
    assert.throws(()=>plan(before,{...valid,extra:true}),/Invalid version-bound/);
    assert.throws(()=>save(dir,original,draftFrom(before,[
      {index:0,title:'<script>alert(1)</script>'}
    ])),/plain text/);
    assert.throws(()=>save(dir,original,draftFrom(before,[
      {index:0,content:'<script>bad</script>'}
    ])),/plain text/);
    assert.throws(()=>draftFrom(before,[{index:414,title:'Invalid'}]),
      /Invalid or repeated resource index/);
    assert.throws(()=>draftFrom(before,[
      {index:0,title:'Duplicate'},{index:0,title:'Duplicate again'}
    ]),/Invalid or repeated resource index/);
    // Same exact quoted title reconstructed by a previous simulated save.
    const first=save(dir,original,valid),current=verify(dir,original);
    assert.throws(()=>save(dir,original,draftFrom(current,[
      {index:0,title:'Safe'}
    ])),/No change requested/);
    assert.equal(verify(dir,original).manifest.sourceSha256,
      first.after.manifest.sourceSha256);
  });
});
test('missing/swapped fragments, forged manifest and unknown files fail before a save',async()=>{
  await withTemporaryVersions(original,dir=>{
    const baseline=verify(dir,original);
    const approved=draftFrom(baseline,[{index:0,title:'Protected'}]);
    const first=relative(dir,recordPath(0));
    const intact=fs.readFileSync(first);
    fs.writeFileSync(first,'tampered test only');
    assert.throws(()=>save(dir,original,approved),/checksum or encoding conflict/);
    fs.writeFileSync(first,intact);
    const manifest=relative(dir,MANIFEST);
    const saved=fs.readFileSync(manifest);
    fs.writeFileSync(manifest,'{}');
    assert.throws(()=>verify(dir,original),/Invalid versioned source manifest/);
    fs.writeFileSync(manifest,saved);
    const extra=path.join(dir,'unexpected.txt');
    fs.writeFileSync(extra,'unsafe file');
    assert.throws(()=>save(dir,original,approved),/missing or unexpected/i);
    fs.rmSync(extra);
    assert.equal(verify(dir,original).manifest.revision,0);
    assert.equal(save(dir,original,approved).after.manifest.revision,1);
  });
});
test('revision-one manifest and source-sha mismatch are both rejected',async()=>{
  await withTemporaryVersions(original,dir=>{
    const before=verify(dir,original);
    const saved=save(dir,original,draftFrom(before,[{index:0,title:'First'}]));
    const file=relative(dir,MANIFEST),raw=fs.readFileSync(file);
    const json=JSON.parse(raw.toString('utf8'));
    json.sourceSha256='0'.repeat(64);
    fs.writeFileSync(file,JSON.stringify(json)+'\n');
    assert.throws(()=>verify(dir,original),/cannot reconstruct its claimed|does not match complete/);
    fs.writeFileSync(file,raw);
    assert.equal(verify(dir,original).manifest.sourceSha256,
      saved.after.manifest.sourceSha256);
    assert.equal(rollback(dir,original).exactOriginal,true);
    assert.equal(verify(dir,original).manifest.sourceSha256,SOURCE_SHA);
  });
});
test('incorrect source baseline cannot start a multi-session rehearsal',async()=>{
  const wrong=Buffer.from(original);wrong[0]^=1;
  await assert.rejects(withTemporaryVersions(wrong,()=>{}),
    /Exact original non-resource website shell/);
});
