'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {SOURCE_SHA}=require('../tools/audit-source-storage-budget.cjs');
const {recordPath,MANIFEST,COUNT}=require('../tools/rehearse-resource-only-overlay.cjs');
const {verify,save,draftFrom,withTemporaryVersions}=
  require('../tools/rehearse-versioned-resource-sessions.cjs');
const {RUNTIME}=require('../tools/plan-private-github-source-review.cjs');
const {
  checkedPackagePath,verifyPackage,withReviewedPackage,demonstrate
}=require('../tools/rehearse-reviewed-source-package.cjs');
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const original=fs.readFileSync(
  path.resolve(__dirname,'..','..','site-content.html'));
const packageFile=(root,rel)=>path.join(root,...rel.split('/'));

test('a single reviewed edit creates exactly three private, byte-exact GitHub candidate files',async()=>{
  let temporary;
  await withTemporaryVersions(original,async source=>{
    const before=verify(source,original);
    const draft=draftFrom(before,[{index:0,title:'Private package test title'}]);
    await withReviewedPackage(source,original,draft,({root,receipt,verified})=>{
      temporary=root;
      const expected=new Set([RUNTIME,MANIFEST,recordPath(0)]);
      assert.deepEqual(new Set(receipt.proposedPaths.map(x=>x.path)),expected);
      assert.equal(verified.format,'naxx-private-verified-file-package-v1');
      assert.equal(verified.stagedFileCount,3);
      assert.equal(verified.editedResourceFiles,1);
      assert.equal(verified.unchangedResourceFiles,413);
      assert.equal(verified.completeHtmlSha256Matched,true);
      assert.equal(verified.originalNonResourceShellPreserved,true);
      assert.equal(verified.reconstructedWebsiteBytes,receipt.sourceBytesAfter);
      assert.equal(verified.newSourceRevision,1);
      assert.equal(verified.backedUpSeparately,false);
      assert.equal(verified.githubReady,false);
      assert.equal(verified.canApply,false);
      assert.equal(verified.canPush,false);
      assert.equal(verified.canPublish,false);
      assert.equal(verified.repositoryFilesWritten,0);
      assert.equal(verified.gitHubWrites,0);
      assert.equal(sha(fs.readFileSync(packageFile(root,RUNTIME))),
        receipt.proposedFullSiteSha256);
      for(const info of receipt.proposedPaths){
        const bytes=fs.readFileSync(packageFile(root,info.path));
        assert.equal(bytes.length,info.newBytes);
        assert.equal(sha(bytes),info.proposedNewSha256);
      }
      assert.equal(verify(source,original).manifest.revision,0);
      assert.equal(sha(original),SOURCE_SHA);
    });
  });
  assert.equal(fs.existsSync(temporary),false);
});

test('two resource edits stage four files while the other 412 fragments never appear in the package',async()=>{
  await withTemporaryVersions(original,async source=>{
    const current=verify(source,original);
    const draft=draftFrom(current,[
      {index:0,title:'First independent reviewed change'},
      {index:413,content:'Private multiline example.\n\nSecond paragraph.'}
    ]);
    await withReviewedPackage(source,original,draft,({root,receipt,verified})=>{
      assert.deepEqual(new Set(receipt.proposedPaths.map(x=>x.path)),
        new Set([recordPath(0),recordPath(413),MANIFEST,RUNTIME]));
      assert.equal(verified.stagedFileCount,4);
      assert.equal(verified.editedResourceFiles,2);
      assert.equal(verified.unchangedResourceFiles,412);
      assert.equal(verified.completeHtmlRebuilt,true);
      assert.equal(verified.githubReady,false);
      assert.equal(verified.gitHubWrites,0);
    });
  });
});

test('tampered candidate files, unexpected files, missing files and symlinks fail closed',async()=>{
  await withTemporaryVersions(original,async source=>{
    const snap=verify(source,original);
    const draft=draftFrom(snap,[{index:1,title:'Private corruption test'}]);
    await withReviewedPackage(source,original,draft,({root,receipt})=>{
      const resource=packageFile(root,recordPath(1));
      const saved=fs.readFileSync(resource);
      fs.writeFileSync(resource,'invalid modified candidate');
      assert.throws(()=>verifyPackage(root,source,original,draft,receipt),
        /Packaged source bytes or file hash/);
      fs.writeFileSync(resource,saved);
      const extra=packageFile(root,'unapproved.txt');
      fs.writeFileSync(extra,'not part of this change');
      assert.throws(()=>verifyPackage(root,source,original,draft,receipt),
        /Missing or unexpected files/);
      fs.rmSync(extra);
      fs.rmSync(resource);
      assert.throws(()=>verifyPackage(root,source,original,draft,receipt),
        /Missing or unexpected files/);
      fs.symlinkSync(packageFile(root,RUNTIME),resource);
      assert.throws(()=>verifyPackage(root,source,original,draft,receipt),
        /Symlink in private package/);
      fs.rmSync(resource);
      fs.writeFileSync(resource,saved);
      assert.equal(verifyPackage(root,source,original,draft,receipt).stagedFileCount,3);
    });
  });
});

test('a stale source or changed review receipt cannot be packaged or silently rebased',async()=>{
  await withTemporaryVersions(original,async source=>{
    const originalState=verify(source,original);
    const old=draftFrom(originalState,[{index:0,title:'Old reviewed title'}]);
    await withReviewedPackage(source,original,old,({root,receipt})=>{
      const altered={...receipt,proposedFullSiteSha256:'a'.repeat(64)};
      assert.throws(()=>verifyPackage(root,source,original,old,altered),
        /Review receipt does not cover|Package receipt was changed/);
    });
    save(source,original,draftFrom(originalState,[
      {index:413,title:'Another separate session'}
    ]));
    await assert.rejects(withReviewedPackage(source,original,old,()=>{}),
      /not eligible for a dry-run review/);
    assert.equal(verify(source,original).manifest.revision,1);
  });
});

test('unsafe paths are refused and the package module has no GitHub write or publication API',()=>{
  assert.throws(()=>checkedPackagePath('/tmp/private','../index.html'),
    /Unapproved proposed package path/);
  assert.throws(()=>checkedPackagePath('/tmp/private','/site-content.html'),
    /Unapproved proposed package path/);
  assert.throws(()=>checkedPackagePath('/tmp/private','content/../site-content.html'),
    /Unapproved proposed package path/);
  assert.throws(()=>checkedPackagePath('/tmp/private','other/credentials.env'),
    /Unapproved proposed package path/);
  const src=fs.readFileSync(path.resolve(__dirname,
    '../tools/rehearse-reviewed-source-package.cjs'),'utf8');
  for(const needle of [
    'https.request(', 'fetch(', 'GITHUB_TOKEN','update_ref(',
    'create_commit(', 'execFileSync(', 'localStorage', 'process.env.GITHUB_TOKEN'
  ])assert.equal(src.includes(needle),false,needle);
  assert.match(src,/fs\.mkdtempSync\(path\.join\(os\.tmpdir\(\)/);
  assert.match(src,/fs\.rmSync\(root,\{recursive:true,force:true\}\)/);
});

test('two-session private demonstration stages only proposed files and deletes each temporary package',async()=>{
  const result=await demonstrate(original);
  assert.equal(result.format,'naxx-private-reviewed-package-demo-v1');
  assert.equal(result.first.filesVerified,3);
  assert.equal(result.first.editedResources,1);
  assert.equal(result.first.completeHtmlSha256Matched,true);
  assert.equal(result.staleDraftRejected,true);
  assert.equal(result.second.filesVerified,3);
  assert.equal(result.second.nextRevision,2);
  assert.equal(result.physicalResourcesPreserved,414);
  assert.equal(result.tempStagingDeleted,true);
  assert.equal(result.generatedSiteWasStagedOnly,true);
  assert.equal(result.gitHubWrites,0);
  assert.equal(result.productionSiteWrites,0);
  assert.equal(result.canApply,false);
  assert.equal(result.canPublish,false);
});
