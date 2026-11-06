'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {SOURCE_SHA}=require('../tools/audit-source-storage-budget.cjs');
const {recordPath,MANIFEST}=require('../tools/rehearse-resource-only-overlay.cjs');
const {withTemporaryVersions,verify,draftFrom}=
  require('../tools/rehearse-versioned-resource-sessions.cjs');
const {proposedReceipt}=require('../tools/plan-private-github-source-review.cjs');
const {
  validBranch,approvedResourcePath,validateReceipt,
  verifyPinnedLocalBranch,initSyntheticRepo,syntheticReceipt,
  demonstrate,runGit
}=require('../tools/rehearse-local-git-head-preflight.cjs');
const original=fs.readFileSync(path.resolve(__dirname,'..','..','site-content.html'));
function withFakeGit(fn){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'naxx-git-branch-test-'));
  try {
    const files=initSyntheticRepo(dir),receipt=syntheticReceipt(files);
    const head=runGit(dir,['rev-parse','HEAD']).trim();
    return fn({dir,files,receipt,head});
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
}
function commit(dir,name){
  runGit(dir,['add','--',name]);
  runGit(dir,['-c','user.name=Local Test','-c','user.email=local@invalid.test',
    'commit','-q','-m','synthetic private edit']);
  return runGit(dir,['rev-parse','HEAD']).trim();
}
test('a pinned local branch checks all expected Git blobs without ever granting publication authority',()=>{
  withFakeGit(({dir,receipt,head})=>{
    const report=verifyPinnedLocalBranch(dir,'private-review-check',head,receipt);
    assert.equal(report.format,'naxx-local-git-head-preflight-v1');
    assert.equal(report.checkedLocalCommit,true);
    assert.equal(report.localBranchStableDuringCheck,true);
    assert.equal(report.checkedTrackedBlobs,3);
    assert.equal(report.remoteGitHubTipVerified,false);
    assert.equal(report.githubAuthenticated,false);
    assert.equal(report.atomicRemoteUpdateGuaranteed,false);
    assert.equal(report.candidateLayoutApproved,false);
    assert.equal(report.canApply,false);
    assert.equal(report.canPush,false);
    assert.equal(report.canMerge,false);
    assert.equal(report.canPublish,false);
    assert.equal(report.gitSourceWrites,0);
    assert.equal(report.sourceValuesPrinted,false);
    assert.ok(Object.isFrozen(report));
  });
});
test('an unrelated branch advance invalidates an old review even when its proposed paths did not change',()=>{
  withFakeGit(({dir,receipt,head})=>{
    fs.writeFileSync(path.join(dir,'unrelated.txt'),'unrelated later work');
    const newer=commit(dir,'unrelated.txt');
    assert.notEqual(newer,head);
    assert.throws(()=>verifyPinnedLocalBranch(dir,'private-review-check',head,receipt),
      /Stale local branch/);
    assert.equal(verifyPinnedLocalBranch(dir,'private-review-check',newer,receipt)
      .checkedLocalCommit,true);
  });
});
test('a dirty working-tree copy cannot fool committed Git object verification',()=>{
  withFakeGit(({dir,receipt,head})=>{
    fs.writeFileSync(path.join(dir,'site-content.html'),'uncommitted local changed file');
    assert.equal(verifyPinnedLocalBranch(dir,'private-review-check',head,receipt)
      .checkedTrackedBlobs,3);
  });
});
test('tracked runtime changed at a new revision must match old blob precondition or review stops',()=>{
  withFakeGit(({dir,receipt,head})=>{
    fs.writeFileSync(path.join(dir,'site-content.html'),'different committed synthetic runtime');
    const newer=commit(dir,'site-content.html');
    assert.notEqual(newer,head);
    assert.throws(()=>verifyPinnedLocalBranch(dir,'private-review-check',newer,receipt),
      /reviewed Git file changed/);
  });
});
test('missing Git path or symlinked tracked Git path cannot pass a review',()=>{
  withFakeGit(({dir,receipt})=>{
    const tracked=path.join(dir,...recordPath(0).split('/'));
    fs.rmSync(tracked);
    runGit(dir,['rm','-q','--',recordPath(0)]);
    const updated=runGit(dir,['-c','user.name=Local Test','-c','user.email=local@invalid.test',
      'commit','-q','-m','remove expected synthetic fragment']);
    const sha=runGit(dir,['rev-parse','HEAD']).trim();
    assert.throws(()=>verifyPinnedLocalBranch(dir,'private-review-check',sha,receipt),
      /Expected an ordinary tracked Git file/);
  });
  withFakeGit(({dir,receipt})=>{
    const tracked=path.join(dir,...recordPath(0).split('/'));
    fs.rmSync(tracked);
    fs.symlinkSync(path.join(dir,'site-content.html'),tracked);
    const sha=commit(dir,recordPath(0));
    assert.throws(()=>verifyPinnedLocalBranch(dir,'private-review-check',sha,receipt),
      /Expected an ordinary tracked Git file/);
  });
});
test('invalid branch, wrong commit, forged path and malformed receipt are all refused',()=>{
  withFakeGit(({dir,receipt,head})=>{
    for(const name of ['../main','main..old','-danger','other//branch',
      'test.lock','@{0}','branch.','a/../b']){
      assert.equal(validBranch(name),false,name);
      assert.throws(()=>verifyPinnedLocalBranch(dir,name,head,receipt),/Invalid local Git branch/);
    }
    assert.equal(validBranch('private-review-check'),true);
    assert.equal(approvedResourcePath(recordPath(0)),true);
    assert.equal(approvedResourcePath(recordPath(413)),true);
    assert.equal(approvedResourcePath('content/resource-overlays/resources/0415.fragment'),false);
    assert.equal(approvedResourcePath('../index.html'),false);
    assert.throws(()=>verifyPinnedLocalBranch(dir,'private-review-check','a'.repeat(40),receipt),
      /Stale local branch/);
    assert.throws(()=>verifyPinnedLocalBranch(dir,'private-review-check','not-a-sha',receipt),
      /Invalid local Git branch/);
    const forged={...receipt,proposedPaths:receipt.proposedPaths.map(x=>({...x}))};
    forged.proposedPaths[0].path='../index.html';
    assert.throws(()=>verifyPinnedLocalBranch(dir,'private-review-check',head,forged),
      /Proposed Git path/);
    const badDigest={...receipt,proposedPaths:receipt.proposedPaths.map(x=>({...x}))};
    badDigest.proposedPaths[0].expectedOldSha256='a'.repeat(64);
    assert.throws(()=>verifyPinnedLocalBranch(dir,'private-review-check',head,badDigest),
      /reviewed Git file changed/);
    const duplicate={...receipt,proposedPaths:receipt.proposedPaths.map(x=>({...x}))};
    duplicate.proposedPaths[1].path=duplicate.proposedPaths[0].path;
    assert.throws(()=>validateReceipt(duplicate),/Proposed Git path/);
    const wronglyReady={...receipt,githubReady:true};
    assert.throws(()=>validateReceipt(wronglyReady),/receipt shape/);
  });
});
test('actual 414-fragment physical source dry-run receipt checks against a private tracked Git tree',async()=>{
  await withTemporaryVersions(original,dir=>{
    const initial=verify(dir,original);
    const draft=draftFrom(initial,[{index:0,title:'Synthetic Git head source review'}]);
    const receipt=proposedReceipt(dir,original,draft);
    // All Git mutations are in the OS-private temporary source overlay only,
    // after the complete verified source receipt has already been calculated.
    fs.writeFileSync(path.join(dir,'site-content.html'),original);
    runGit(dir,['init','-q','-b','private-reviewed-snapshot']);
    runGit(dir,['add','--','content/resource-overlays','site-content.html']);
    runGit(dir,['-c','user.name=Local Test','-c','user.email=local@invalid.test',
      'commit','-q','-m','source snapshot for private review only']);
    const head=runGit(dir,['rev-parse','HEAD']).trim();
    const result=verifyPinnedLocalBranch(dir,'private-reviewed-snapshot',head,receipt);
    assert.equal(result.checkedTrackedBlobs,3);
    assert.equal(result.checkedLocalCommit,true);
    assert.equal(result.canPush,false);
    assert.equal(result.remoteGitHubTipVerified,false);
    assert.equal(receipt.physicallyVerifiedResources,414);
    assert.equal(receipt.expectedCurrentSourceSha256,SOURCE_SHA);
  });
});
test('synthetic standalone demonstration deletes repository and refuses changed heads',()=>{
  const report=demonstrate();
  assert.equal(report.format,'naxx-private-git-head-demo-v1');
  assert.equal(report.initialRefVerified,true);
  assert.equal(report.refMoveRejected,true);
  assert.equal(report.newExplicitHeadReviewAccepted,true);
  assert.equal(report.checkedFilePaths,3);
  assert.equal(report.githubRemoteChecked,false);
  assert.equal(report.githubFilesWritten,0);
  assert.equal(report.temporaryRepoDeleted,true);
  assert.equal(report.ownerApproved,false);
});
