'use strict';
/*
 * REAL LOCAL GIT COMMIT + COMPARE-AND-SWAP REHEARSAL.
 *
 * Original browser ZIP -> verified 415-file candidate -> independent proposed
 * Git tree SHA -> commit in a NEW OS-private local Git clone -> actual
 * git update-ref <new> <expected-old> -> stale refusal -> exact ref recovery.
 *
 * Absolutely no GitHub endpoint, credentials, push, original checkout edits,
 * main branch mutation or source-layout adoption. Disposable tests only.
 */
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const cp=require('node:child_process');
const {withFullSiteRollback,read}=
  require('./rehearse-browser-zip-full-site-rollback.cjs');
const {verifyCheckout}=require('./plan-mixed-editor-update.cjs');
const {deriveIntent}=require('./rehearse-browser-zip-git-tree-intent.cjs');
const {filePaths,COUNT}=require('./rehearse-resource-only-overlay.cjs');
const FORMAT='naxx-disposable-conditional-local-git-save-v1';
const SHA=/^[0-9a-f]{40}$/,REF='refs/heads/editor-saves/disposable-only';
const ZERO='0'.repeat(40);
const resourcePaths=filePaths();
function git(root,args,options={}) {
  if(typeof root!=='string'||!path.isAbsolute(root)||!Array.isArray(args))
    throw Error('Git rehearsal requires an absolute, checked local directory.');
  const result=cp.spawnSync('git',['-C',root,...args],{
    encoding:'utf8',maxBuffer:32*1024*1024,timeout:120000,
    stdio:['ignore','pipe','pipe'],...options
  });
  if(result.error)throw Error('Disposable Git command failed.');
  if(result.status!==0)throw Error('Disposable Git operation was refused.');
  return result.stdout.trim();
}
function gitMayFail(root,args){
  const result=cp.spawnSync('git',['-C',root,...args],{
    encoding:'utf8',maxBuffer:4*1024*1024,timeout:30000,
    stdio:['ignore','pipe','pipe']
  });
  if(result.error)throw Error('Disposable Git refusal check was not executed.');
  return result.status!==0;
}
function assertCleanPrivateClone(clone,commit){
  if(git(clone,['rev-parse','HEAD'])!==commit ||
     git(clone,['status','--porcelain=v1','--untracked-files=all'])!=='')
    throw Error('The disposable clone is not the exact clean reviewed source.');
}
function performLocalCommit(checkout,view,expectedCommit){
  if(!SHA.test(expectedCommit||'')||!view||
     typeof view.verifyStaged!=='function'||
     typeof view.verifyBackup!=='function'||
     !(view.changeSet instanceof Set))
    throw Error('Real pinned original-site review is required.');
  view.verifyBackup();
  view.verifyStaged();
  const intent=deriveIntent(checkout,view.site,view.stage,
    view.trackedNames,view.changeSet,expectedCommit);
  if(intent.reviewedGitCommit!==expectedCommit||
     intent.sourceLayoutOwnerApproved!==false||
     intent.newOverlayGitBlobs!==COUNT+1||
     intent.allOriginalFileModesPreserved!==true)
    throw Error('The independently reviewed temporary Git tree is not ready.');
  const staged=new Set([...resourcePaths,...view.changeSet]);
  if(staged.size!==resourcePaths.size+view.changeSet.size||
     staged.size!==intent.newOverlayGitBlobs+intent.changedExistingGitBlobs)
    throw Error('The temporary candidate changed-path inventory is unsafe.');
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'naxx-conditional-local-git-'));
  fs.chmodSync(temp,0o700);
  const clone=path.join(temp,'disposable-checkout');
  let receipt;
  try{
    // No network, no shared Git worktree, no reuse of the original .git objects
    // as writable hardlinks and no original repository checkout changes.
    git(temp,['clone','--local','--no-hardlinks','--no-checkout','-q',
      checkout,clone]);
    git(clone,['checkout','--detach','-q',expectedCommit]);
    assertCleanPrivateClone(clone,expectedCommit);
    // This ref exists ONLY in the private clone; never update any source ref.
    git(clone,['update-ref',REF,expectedCommit,ZERO]);
    const paths=[...staged].sort();
    for(const relative of paths){
      const target=path.join(clone,...relative.split('/'));
      const expectedBytes=read(view.site,relative);
      if(!expectedBytes.equals(read(view.stage,relative)))
        throw Error('Physical private Git staging does not match reviewed bytes.');
      if(resourcePaths.has(relative)){
        if(fs.existsSync(target))
          throw Error('Proposed overlay collides with a tracked Git path.');
        fs.mkdirSync(path.dirname(target),{recursive:true,mode:0o700});
        fs.writeFileSync(target,expectedBytes,{flag:'wx',mode:0o600});
      }else{
        if(!fs.existsSync(target)||!fs.lstatSync(target).isFile()||
           fs.lstatSync(target).isSymbolicLink())
          throw Error('Tracked source replacement would alter an unsafe file.');
        fs.writeFileSync(target,expectedBytes,{flag:'w'});
      }
    }
    git(clone,['add','--',...paths]);
    const changed=cp.execFileSync('git',['-C',clone,'diff','--cached',
      '--name-only','-z'],{encoding:'utf8',timeout:30000,
      maxBuffer:4*1024*1024}).split('\0').filter(Boolean).sort();
    if(changed.length!==paths.length||
       changed.some((rel,index)=>rel!==paths[index]))
      throw Error('Git staged an unexpected or missing candidate path.');
    const stagedTree=git(clone,['write-tree']);
    if(stagedTree!==intent.proposedTreeOidCalculatedInMemory)
      throw Error('Real Git index tree disagrees with independent full-source proof.');
    git(clone,['-c','user.name=Naxxramas Private QA',
      '-c','user.email=private-qa@example.invalid',
      '-c','commit.gpgsign=false','-c','core.hooksPath=/dev/null',
      'commit','-q','--no-verify','-m',
      'Disposable, never-push 415-file editor Save verification']);
    const candidateCommit=git(clone,['rev-parse','HEAD']);
    if(candidateCommit===expectedCommit||!SHA.test(candidateCommit)||
       git(clone,['rev-parse','HEAD^'])!==expectedCommit||
       git(clone,['rev-parse','HEAD^{tree}'])!==stagedTree||
       git(clone,['status','--porcelain=v1','--untracked-files=all'])!=='')
      throw Error('Actual disposable Git commit differs from reviewed content.');
    // Server-enforced local Git CAS: exact expected old ref, not a force push.
    git(clone,['update-ref',REF,candidateCommit,expectedCommit]);
    if(git(clone,['rev-parse',REF])!==candidateCommit)
      throw Error('Exact-old commit ref update was not verified.');
    // An independent second editor using the same outdated old commit MUST
    // be refused. Ref remains the first verified commit.
    const staleRejected=gitMayFail(clone,
      ['update-ref',REF,expectedCommit,expectedCommit]);
    if(!staleRejected||git(clone,['rev-parse',REF])!==candidateCommit)
      throw Error('A stale second Git Save was not refused correctly.');
    // Only in the throwaway clone, reset test ref to original for recovery.
    git(clone,['update-ref',REF,expectedCommit,candidateCommit]);
    if(git(clone,['rev-parse',REF])!==expectedCommit)
      throw Error('The original disposable Git commit was not recovered.');
    view.verifyStaged();
    view.verifyBackup();
    receipt=Object.freeze({
      format:FORMAT,onlyDisposableGitClone:true,
      originalReviewedCommit:expectedCommit,
      candidateGitCommitCreatedAndVerified:true,
      originalGitTreeOid:intent.originalTreeOid,
      candidateGitTreeOid:stagedTree,
      independentTreeShaMatched:true,
      unchangedGitBlobsPreserved:intent.unchangedTrackedGitBlobsPreserved,
      changedOriginalGitBlobs:intent.changedExistingGitBlobs,
      resourceSourceBlobs:intent.newOverlayGitBlobs,
      stagedPathsVerified:changed.length,
      exactOldLocalRefAdvanceVerified:true,
      staleSecondLocalSaveRejected:true,
      originalLocalRefRecovered:true,
      originalRepositoryWritten:false,githubWrites:0,
      githubSaveEnabled:false,githubRemoteCASProven:false,
      ownerHeldBackupRetained:false,sourceLayoutApproved:false,
      canPush:false,canMerge:false,canPublish:false
    });
  }finally{
    fs.rmSync(temp,{recursive:true,force:true});
  }
  if(fs.existsSync(temp)||!receipt)
    throw Error('Disposable Git history was not deleted.');
  return Object.freeze({...receipt,privateGitCloneDeleted:true});
}
async function rehearse(checkout,zip,commit) {
  if(typeof checkout!=='string'||!path.isAbsolute(checkout)||
     !Buffer.isBuffer(zip)||!SHA.test(commit||''))
    throw Error('Real private browser ZIP, checkout, and independently selected commit required.');
  const before=verifyCheckout(checkout,commit);
  let proof;
  const rollback=await withFullSiteRollback(checkout,zip,commit,async view=>{
    proof=performLocalCommit(checkout,view,commit);
  });
  if(!proof||rollback.privateRollbackExact!==true||
     rollback.originalRepositoryCheckoutUnchanged!==true||
     rollback.allTemporarySiteCopiesDeleted!==true)
    throw Error('Original complete website rollback evidence was not verified.');
  const after=verifyCheckout(checkout,commit);
  if(after.fingerprintSha256!==before.fingerprintSha256)
    throw Error('Protected website checkout changed during disposable Git Save.');
  return Object.freeze({...proof,originalSiteRollbackVerified:true,
    originalSourceCommitUnchanged:true,
    temporaryCandidateDeleted:true});
}
module.exports=Object.freeze({FORMAT,performLocalCommit,rehearse});
