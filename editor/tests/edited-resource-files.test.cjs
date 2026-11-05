'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {rehearseEditedTitle,validateStagedEdit}=require('../tools/rehearse-edited-resource-files.cjs');
const {withTemporaryPackage,resourcePath}=require('../tools/rehearse-resource-files.cjs');
const {replaceTitleInRecord}=require('../tools/rehearse-title-edit.cjs');
const {splitInMemory}=require('../tools/check-legacy-roundtrip.cjs');
const original=fs.readFileSync(path.resolve(__dirname,'..','site-content.html'));

for(const position of [0,413]){
  test('one edited temporary resource at position '+position+' rebuilds exactly and cleans up',()=>{
    const report=rehearseEditedTitle(original,position,'Safe Temporary Rehearsal Title');
    assert.equal(report.separateFragmentsRead,414);
    assert.equal(report.changedResourceFragments,1);
    assert.equal(report.unchangedResourceFragments,413);
    assert.equal(report.exactCompatibilityOutput,true);
    assert.equal(report.originalNonResourceBytesPreserved,true);
    assert.equal(report.originalManifestRejectedModifiedFragment,true);
    assert.equal(report.temporaryFolderDeletedAfterTest,true);
    assert.equal(report.repositoryFilesWritten,0);
    assert.equal(report.published,false);
    assert.equal(report.contentOrIdsEmitted,false);
    assert.notEqual(report.stagedSourceSha256,report.originalSha256);
  });
}
test('modified unrelated fragment fails closed and disposable package is deleted',()=>{
  const split=splitInMemory(original);
  let root;
  assert.throws(()=>withTemporaryPackage(original,(temp,manifest)=>{
    root=temp;
    const edited=replaceTitleInRecord(split.records[0],'Safe Temporary Rehearsal Title').record;
    fs.writeFileSync(path.join(temp,resourcePath(0)),edited);
    fs.appendFileSync(path.join(temp,resourcePath(3)),'unexpected');
    validateStagedEdit(temp,manifest,original,0,'Safe Temporary Rehearsal Title');
  }),/Unexpected change outside approved/);
  assert.equal(fs.existsSync(root),false);
});
test('edited title verification rejects unexpected changes to the target resource',()=>{
  let root;
  assert.throws(()=>withTemporaryPackage(original,(temp,manifest)=>{
    root=temp;
    fs.appendFileSync(path.join(temp,resourcePath(0)),' unexpected');
    validateStagedEdit(temp,manifest,original,0,'Safe Temporary Rehearsal Title');
  }),/Unexpected edit to the selected resource/);
  assert.equal(fs.existsSync(root),false);
});
test('rehearsal refuses invalid positions and unsafe text without any export',()=>{
  for(const title of ['','<script>unsafe</script>','Unsafe\nnewline'])
    assert.throws(()=>rehearseEditedTitle(original,0,title));
  assert.throws(()=>rehearseEditedTitle(original,414,'Valid'));
  assert.throws(()=>rehearseEditedTitle(Buffer.concat([original,Buffer.from('x')]),0,'Valid'));
});
