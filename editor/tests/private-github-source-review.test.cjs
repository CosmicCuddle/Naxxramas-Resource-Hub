'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {SOURCE_SHA}=require('../tools/audit-source-storage-budget.cjs');
const {recordPath,MANIFEST}=require('../tools/rehearse-resource-only-overlay.cjs');
const {withTemporaryVersions,verify,draftFrom,save,plan}=
  require('../tools/rehearse-versioned-resource-sessions.cjs');
const {proposedReceipt,privateDemonstration,RUNTIME}=
  require('../tools/plan-private-github-source-review.cjs');
const {restoreInMemory}=require('../tools/check-legacy-roundtrip.cjs');
const original=fs.readFileSync(path.resolve(__dirname,'..','..','site-content.html'));
const sha=buf=>crypto.createHash('sha256').update(buf).digest('hex');
test('dry-run single edit lists only proposed fragment, manifest and generated runtime',async()=>{
  await withTemporaryVersions(original,dir=>{
    const before=verify(dir,original);
    const draft=draftFrom(before,[{index:0,title:'Private review-only changed title'}]);
    const report=proposedReceipt(dir,original,draft);
    assert.equal(report.format,'naxx-private-github-changeset-review-v1');
    assert.equal(report.currentRevision,0);
    assert.equal(report.proposedRevision,1);
    assert.equal(report.originalBaselineSha256,SOURCE_SHA);
    assert.equal(report.physicallyVerifiedResources,414);
    assert.equal(report.physicalSourceFiles,415);
    assert.equal(report.editedResourceCount,1);
    assert.equal(report.unchangedResourceCount,413);
    assert.equal(report.proposedFileCount,3);
    assert.deepEqual(new Set(report.proposedPaths.map(x=>x.path)),
      new Set([recordPath(0),MANIFEST,RUNTIME]));
    assert.equal(report.proposedPaths.every(x=>
      /^[a-f0-9]{64}$/.test(x.expectedOldSha256)&&
      /^[a-f0-9]{64}$/.test(x.proposedNewSha256)&&
      x.oldBytes>0&&x.newBytes>0),true);
    assert.equal(report.proposedPaths.some(x=>/Private review/.test(JSON.stringify(x))),false);
    assert.equal(report.approved,false);
    assert.equal(report.githubReady,false);
    assert.equal(report.trustedGitCommitChecked,false);
    assert.equal(report.privateGitRecoveryBackupVerified,false);
    assert.equal(report.realAdminWriteFlowVerified,false);
    assert.equal(report.newSourceBytesIncluded,false);
    assert.equal(report.canApply,false);
    assert.equal(report.canMerge,false);
    assert.equal(report.canPublish,false);
    assert.equal(report.repoFilesWritten,0);
    assert.equal(report.gitActionsTaken,0);
    assert.equal(Object.isFrozen(report),true);
    assert.equal(Object.isFrozen(report.proposedPaths),true);
    assert.equal(verify(dir,original).manifest.revision,0);
  });
});
test('multi-record receipt computes exactly the same proposed HTML and fragment fingerprints as the independent planner',async()=>{
  await withTemporaryVersions(original,dir=>{
    const before=verify(dir,original);
    const draft=draftFrom(before,[{index:0,title:'First private title'},
      {index:413,content:'Private multiline content.\n\nSecond paragraph.'}]);
    const receipt=proposedReceipt(dir,original,draft);
    const expected=plan(before,draft);
    const rebuilt=restoreInMemory(before.split,expected.newRecords);
    assert.equal(receipt.proposedRevision,1);
    assert.equal(receipt.proposedFileCount,4);
    assert.equal(receipt.editedResourceCount,2);
    assert.equal(receipt.unchangedResourceCount,412);
    assert.equal(receipt.sourceBytesBefore,original.length);
    assert.equal(receipt.expectedCurrentSourceSha256,SOURCE_SHA);
    assert.equal(receipt.proposedFullSiteSha256,sha(rebuilt));
    const fileMap=new Map(receipt.proposedPaths.map(x=>[x.path,x]));
    assert.equal(fileMap.get(RUNTIME).proposedNewSha256,sha(rebuilt));
    assert.equal(fileMap.get(MANIFEST).proposedNewSha256,
      sha(Buffer.from(JSON.stringify(expected.manifest)+'\n')));
    assert.equal(fileMap.get(recordPath(0)).proposedNewSha256,
      sha(Buffer.from(expected.newRecords[0])));
    assert.equal(fileMap.get(recordPath(413)).proposedNewSha256,
      sha(Buffer.from(expected.newRecords[413])));
    assert.equal(receipt.proposedPaths.every(x=>
      !x.path.includes('..')&&!x.path.startsWith('/')),true);
    assert.equal(verify(dir,original).manifest.revision,0);
  });
});
test('stale draft rejected, and fresh version-one dry-run advertises next revision without overwriting anything',async()=>{
  await withTemporaryVersions(original,dir=>{
    const before=verify(dir,original);
    const stale=draftFrom(before,[{index:0,title:'Do not auto-merge'}]);
    save(dir,original,draftFrom(before,[{index:413,title:'Changed elsewhere'}]));
    assert.throws(()=>proposedReceipt(dir,original,stale),
      /not eligible for a dry-run review/);
    const current=verify(dir,original);
    const fresh=draftFrom(current,[{index:0,title:'Private review on revision one'}]);
    const result=proposedReceipt(dir,original,fresh);
    assert.equal(result.currentRevision,1);
    assert.equal(result.proposedRevision,2);
    assert.equal(result.expectedCurrentSourceSha256,current.manifest.sourceSha256);
    assert.notEqual(result.proposedFullSiteSha256,result.expectedCurrentSourceSha256);
    assert.equal(verify(dir,original).manifest.revision,1);
  });
});
test('broken physical resource and unsupported resource-v2 draft both refuse a proposed change receipt',async()=>{
  await withTemporaryVersions(original,dir=>{
    const current=verify(dir,original);
    const draft=draftFrom(current,[{index:0,title:'Private allowed draft'}]);
    const file=path.join(dir,...recordPath(200).split('/'));
    const saved=fs.readFileSync(file);
    fs.writeFileSync(file,'corrupted file');
    assert.throws(()=>proposedReceipt(dir,original,draft),
      /fragment does not match its manifest checksum/);
    fs.writeFileSync(file,saved);
    assert.throws(()=>proposedReceipt(dir,original,{
      format:'naxx-local-resource-draft-v2',baselineSha256:SOURCE_SHA,
      changes:[{index:0,title:'Old draft is not version bound'}]
    }),/Versioned resource draft structure is invalid/);
    assert.equal(proposedReceipt(dir,original,draft).proposedFileCount,3);
  });
});
test('temporary rehearsal demonstrates two version-safe proposals and deletes all source files afterwards',async()=>{
  const data=await privateDemonstration(original);
  assert.equal(data.format,'naxx-private-github-changeset-demo-v1');
  assert.equal(data.firstReview.from,0);
  assert.equal(data.firstReview.to,1);
  assert.equal(data.firstReview.proposedPaths,3);
  assert.equal(data.secondReview.from,1);
  assert.equal(data.secondReview.to,2);
  assert.equal(data.secondReview.proposedPaths,3);
  assert.equal(data.staleDraftRejected,true);
  assert.equal(data.physicallyVerifiedResources,414);
  assert.equal(data.temporaryDataDeleted,true);
  assert.equal(data.githubFilesWritten,0);
  assert.equal(data.liveWebsiteChanged,false);
  assert.equal(data.githubReady,false);
});

test('review old manifest fingerprint reflects actual bytes even when verified JSON formatting changes',async()=>{
  await withTemporaryVersions(original,dir=>{
    const state=verify(dir,original);
    const manifestPath=path.join(dir,...MANIFEST.split('/'));
    const formatted=Buffer.from(JSON.stringify(state.manifest,null,2)+'\n');
    fs.writeFileSync(manifestPath,formatted);
    const draft=draftFrom(verify(dir,original),[
      {index:1,title:'Private formatting-aware receipt'}
    ]);
    const report=proposedReceipt(dir,original,draft);
    const item=report.proposedPaths.find(x=>x.path===MANIFEST);
    assert.equal(item.expectedOldSha256,sha(formatted));
    assert.equal(item.oldBytes,formatted.length);
    assert.equal(report.proposedFileCount,3);
    assert.equal(verify(dir,original).manifest.revision,0);
  });
});
