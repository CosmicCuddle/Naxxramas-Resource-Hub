'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {SOURCE_SHA,auditStorage}=require('../tools/audit-source-storage-budget.cjs');
const {recordPath,filePaths,withOverlay,verifyOverlay,rollbackOverlay,
  rehearseOverlay}=require('../tools/rehearse-resource-only-overlay.cjs');
const original=fs.readFileSync(path.resolve(__dirname,'..','..','site-content.html'));
const draft={
  format:'naxx-local-resource-draft-v2',baselineSha256:SOURCE_SHA,
  changes:[{index:0,title:'Private first overlay test'},
    {index:413,content:'Private last overlay test.\n\nAnother line.'}]
};
const pathOf=(root,rel)=>path.join(root,...rel.split('/'));
test('resource-only overlay stores 414 independent fragments without copying original non-resource website shell',async()=>{
  const budget=auditStorage(original);
  const report=await rehearseOverlay(original,draft);
  assert.equal(report.format,'naxx-resource-overlay-storage-rehearsal-v1');
  assert.equal(report.staged.resourceFiles,414);
  assert.equal(report.staged.overlayFiles,415);
  assert.equal(filePaths().size,415);
  assert.equal(report.staged.changedFragments,2);
  assert.equal(report.staged.unchangedFragments,412);
  assert.equal(report.staged.originalShellCopiedToOverlay,false);
  assert.equal(report.staged.shellAndImageDuplicationAvoided,true);
  assert.equal(report.staged.versionAwareRebuildNotYetDesigned,true);
  assert.equal(report.staged.byteExactIntendedReconstruction,true);
  assert.equal(report.rollback.exactOriginalRestored,true);
  assert.equal(report.tempDirectoryDeleted,true);
  assert.equal(report.originalFileUnmodified,true);
  assert.equal(report.staged.resourceFragmentBytes,
    report.staged.overlayTreeBytes-report.staged.manifestBytes);
  assert.ok(report.staged.overlayTreeBytes<budget.completeCandidateTreeBytes);
  assert.equal(report.canonicalSourceAdoptionApproved,false);
  assert.equal(report.published,false);
  assert.equal(report.githubFilesWritten,0);
});
test('baseline-only overlay reconstructs exact original source and refuses changed fragment bytes',async()=>{
  await withOverlay(original,null,async(root)=>{
    const b=verifyOverlay(root,original,null);
    assert.equal(b.exactOriginalRestored,true);
    assert.equal(b.overlayTreeBytes,1072527);
    assert.equal(b.manifestBytes,77339);
    const location=pathOf(root,recordPath(0));
    const intact=fs.readFileSync(location);
    fs.writeFileSync(location,'changed unreviewed data');
    assert.throws(()=>verifyOverlay(root,original,null),
      /Overlay resource fragment changed or was reordered/);
    fs.writeFileSync(location,intact);
    assert.equal(verifyOverlay(root,original,null).exactOriginalRestored,true);
  });
});
test('overlay validation refuses swapped source files, unexpected files and manifest drift',async()=>{
  await withOverlay(original,draft,async(root,plan)=>{
    const originalBytes=fs.readFileSync(pathOf(root,recordPath(1)));
    const first=fs.readFileSync(pathOf(root,recordPath(0)));
    fs.writeFileSync(pathOf(root,recordPath(1)),first);
    assert.throws(()=>verifyOverlay(root,original,plan),
      /Overlay resource fragment changed or was reordered/);
    fs.writeFileSync(pathOf(root,recordPath(1)),originalBytes);
    const extra=path.join(root,'unapproved.txt');
    fs.writeFileSync(extra,'should fail');
    assert.throws(()=>verifyOverlay(root,original,plan),
      /Overlay has missing or unexpected files/);
    fs.rmSync(extra);
    const manifest=pathOf(root,'content/resource-overlays/manifest.json');
    const saved=fs.readFileSync(manifest);
    fs.writeFileSync(manifest,'{}');
    assert.throws(()=>verifyOverlay(root,original,plan),
      /Overlay manifest mismatches/);
    fs.writeFileSync(manifest,saved);
    const recovered=rollbackOverlay(root,original,plan);
    assert.equal(recovered.exactOriginalRestored,true);
  });
});
test('overlays reject wrong original source and missing resource without spilling file data',async()=>{
  const corrupt=Buffer.from(original);corrupt[0]=corrupt[0]===65?66:65;
  await assert.rejects(withOverlay(corrupt,draft,()=>true),/Exact original compatibility source/);
  await withOverlay(original,null,async(root)=>{
    fs.rmSync(pathOf(root,recordPath(10)));
    assert.throws(()=>verifyOverlay(root,original),/Overlay has missing or unexpected files/);
  });
});
