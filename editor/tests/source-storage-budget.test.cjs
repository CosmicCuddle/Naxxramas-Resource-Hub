'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {auditStorage}=require('../tools/audit-source-storage-budget.cjs');
const {expectedPaths,withCandidateTree}=require('../tools/rehearse-proposed-resource-tree.cjs');
const root=path.resolve(__dirname,'..','..');
const original=fs.readFileSync(path.join(root,'site-content.html'));
let checked;
function report(){return checked||(checked=auditStorage(original));}
test('source storage audit accounts for every baseline byte and never authorizes migration',()=>{
  const x=report();
  assert.equal(x.format,'naxx-source-storage-budget-audit-v1');
  assert.equal(x.originalCompatibilityBytes,30976969);
  assert.equal(x.baselineVerified,true);
  assert.equal(x.canRebuildOriginalByteExact,true);
  assert.equal(x.records,414);
  assert.equal(x.completeCandidateFiles,418);
  assert.equal(x.completeCandidateFiles,expectedPaths().size);
  assert.equal(x.originalResourceFragmentBytes+x.originalNonResourceCompatibilityBytes,
    x.originalCompatibilityBytes);
  assert.equal(x.fragmentOnlyExtraBytesLowerBound,x.originalResourceFragmentBytes);
  assert.equal(x.completeTreePlusRuntimeBytes,
    x.originalCompatibilityBytes+x.completeCandidateTreeBytes);
  assert.equal(x.completeCandidateLayoutAndManifestBytes,
    x.completeCandidateTreeBytes-x.originalResourceFragmentBytes);
  assert.equal(x.fragmentOnlyRequiresOriginalShell,true);
  assert.equal(x.approvedStorageStrategy,false);
  assert.equal(x.actualGitCompressionOrDeploymentStorageNotMeasured,true);
  assert.equal(x.repositoryFilesWritten,0);
  assert.equal(x.exportFilesWritten,0);
  assert.equal(x.sourceValuesOrIndividualHashesPrinted,false);
  assert.equal(typeof x.originalResourceFragmentBytes,'number');
  assert.ok(x.originalResourceFragmentBytes>0);
  assert.ok(x.completeCandidateTreeBytes>x.originalResourceFragmentBytes);
});
test('candidate 418-file source tree size equals exact storage budget',async()=>{
  const x=report();
  const bytes=await withCandidateTree(original,null,(directory)=>{
    let size=0,count=0;
    for(const rel of expectedPaths()){
      const file=path.join(directory,...rel.split('/'));
      size+=fs.statSync(file).size;
      count++;
    }
    assert.equal(count,x.completeCandidateFiles);
    return size;
  });
  assert.equal(bytes,x.completeCandidateTreeBytes);
});
test('storage audit fails closed for altered baseline or non-Buffer input',()=>{
  const damaged=Buffer.from(original);
  damaged[123]=damaged[123]===0?1:0;
  assert.throws(()=>auditStorage(damaged),/Unexpected original source checksum/);
  assert.throws(()=>auditStorage('not a valid source'),/Unexpected original source checksum/);
  assert.throws(()=>auditStorage(Buffer.alloc(0)),/Unexpected original source checksum/);
});
