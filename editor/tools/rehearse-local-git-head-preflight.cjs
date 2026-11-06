'use strict';
/*
 * READ-ONLY LOCAL GIT SNAPSHOT GUARD — NOT A REMOTE BRANCH LOCK.
 *
 * Tests a review receipt against the exact commit and Git blob contents in
 * a local repository. A caller must supply an independently reviewed commit
 * SHA. This tool does NOT fetch, authenticate GitHub, acquire a remote lock,
 * write a commit, push or authorize a save. The CLI uses a disposable,
 * entirely synthetic git repository for its branch-movement test.
 */
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const crypto=require('node:crypto');
const {execFileSync}=require('node:child_process');
const {SOURCE_SHA}=require('./audit-source-storage-budget.cjs');
const {FORMAT,RUNTIME}=require('./plan-private-github-source-review.cjs');
const {MANIFEST,recordPath,COUNT}=require('./rehearse-resource-only-overlay.cjs');
const HEX=/^[0-9a-f]{40}$|^[0-9a-f]{64}$/;
const HASH=/^[0-9a-f]{64}$/;
const MAX_GIT_BLOB=35*1024*1024;
const sha=data=>crypto.createHash('sha256').update(data).digest('hex');
function runGit(repo,args,opts={}){
  try{return execFileSync('git',['-C',repo,...args],{
    encoding:opts.binary?null:'utf8',maxBuffer:MAX_GIT_BLOB,
    stdio:['ignore','pipe','pipe'],env:{
      ...process.env,GIT_CONFIG_NOSYSTEM:'1',GIT_OPTIONAL_LOCKS:'0'
    }
  });}
  catch(_){throw Error('A required local Git object or ref could not be read.');}
}
function validBranch(value){
  return typeof value==='string'&&value.length>0&&value.length<150&&
    /^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(value)&&
    !value.split('/').some(x=>!x||x==='.'||x==='..'||x.endsWith('.lock'))&&
    !value.includes('..')&&!value.endsWith('/')&&!value.endsWith('.');
}
function approvedResourcePath(p){
  if(p===RUNTIME||p===MANIFEST)return true;
  const m=/^content\/resource-overlays\/resources\/([0-9]{4})\.fragment$/.exec(p);
  return !!m&&Number(m[1])>=1&&Number(m[1])<=COUNT&&
    p===recordPath(Number(m[1])-1);
}
function validateReceipt(receipt){
  if(!receipt||receipt.format!==FORMAT||receipt.reviewOnly!==true||
     receipt.githubReady!==false||receipt.canApply!==false||
     receipt.canPublish!==false||receipt.canMerge!==false||
     receipt.trustedGitCommitChecked!==false||
     receipt.originalBaselineSha256!==SOURCE_SHA||
     !HASH.test(receipt.expectedCurrentSourceSha256)||
     !HASH.test(receipt.proposedFullSiteSha256)||
     !Number.isSafeInteger(receipt.currentRevision)||
     !Number.isSafeInteger(receipt.proposedRevision)||
     receipt.proposedRevision!==receipt.currentRevision+1||
     !Number.isSafeInteger(receipt.editedResourceCount)||
     receipt.editedResourceCount<1||receipt.editedResourceCount>COUNT||
     !Array.isArray(receipt.proposedPaths)||
     receipt.proposedPaths.length!==receipt.editedResourceCount+2||
     receipt.proposedFileCount!==receipt.proposedPaths.length)
    throw Error('Dry-run receipt shape or source revision is not trusted.');
  const paths=new Set(),kinds=new Set();
  for(const item of receipt.proposedPaths){
    if(!item||!approvedResourcePath(item.path)||paths.has(item.path)||
       !HASH.test(item.expectedOldSha256)||
       !HASH.test(item.proposedNewSha256)||
       item.expectedOldSha256===item.proposedNewSha256||
       !Number.isSafeInteger(item.oldBytes)||item.oldBytes<1||
       !Number.isSafeInteger(item.newBytes)||item.newBytes<1)
      throw Error('Proposed Git path or its blob precondition is invalid.');
    if(item.path===RUNTIME&&item.kind!=='proposed-generated-runtime'||
       item.path===MANIFEST&&item.kind!=='proposed-source-manifest'||
       item.path!==RUNTIME&&item.path!==MANIFEST&&
         item.kind!=='proposed-resource-fragment')
      throw Error('Proposed Git path kind does not match its intended role.');
    paths.add(item.path);kinds.add(item.kind);
  }
  if(!paths.has(RUNTIME)||!paths.has(MANIFEST)||
     receipt.proposedPaths.filter(x=>x.kind==='proposed-resource-fragment').length!==
       receipt.editedResourceCount||
     receipt.proposedPaths.find(x=>x.path===RUNTIME).expectedOldSha256!==
       receipt.expectedCurrentSourceSha256||
     receipt.proposedPaths.find(x=>x.path===RUNTIME).proposedNewSha256!==
       receipt.proposedFullSiteSha256)
    throw Error('Review receipt does not cover the expected source files.');
  return receipt;
}
function getBlob(repo,head,relative){
  const listing=runGit(repo,['ls-tree','--full-tree',head,'--',relative]).trim();
  const match=/^(100644|100755|120000) blob ([a-f0-9]{40,64})\t(.+)$/.exec(listing);
  if(!match||match[3]!==relative||match[1]!=='100644')
    throw Error('Expected an ordinary tracked Git file at this path.');
  const data=runGit(repo,['cat-file','blob',match[2]],{binary:true});
  if(!Buffer.isBuffer(data)||data.length===0||data.length>MAX_GIT_BLOB)
    throw Error('A tracked file is outside the permitted review size.');
  return data;
}
function verifyPinnedLocalBranch(repo,branch,expectedHead,receipt){
  if(!validBranch(branch)||!HEX.test(expectedHead)||
     !fs.statSync(repo).isDirectory())
    throw Error('Invalid local Git branch or expected commit.');
  validateReceipt(receipt);
  // Exact refs/heads branch, not the loosely named HEAD or cached FETCH_HEAD.
  // This does not prove anything about the *remote* GitHub branch tip.
  const actualHead=runGit(repo,['rev-parse','--verify',
    'refs/heads/'+branch+'^{commit}']).trim();
  if(actualHead!==expectedHead)
    throw Error('Stale local branch: reviewed head no longer matches.');
  // Check the actual tracked Git blobs, never the potentially dirty
  // working-tree copies. Require all resource candidate paths to exist.
  for(const expected of receipt.proposedPaths){
    const value=getBlob(repo,actualHead,expected.path);
    if(value.length!==expected.oldBytes||sha(value)!==expected.expectedOldSha256)
      throw Error('The reviewed Git file changed or was not the expected baseline.');
  }
  // Re-check the ref after reading blobs. A remote can STILL race before
  // a future push, hence this remains a read-only preflight, not CAS.
  const second=runGit(repo,['rev-parse','--verify',
    'refs/heads/'+branch+'^{commit}']).trim();
  if(second!==expectedHead)
    throw Error('Local Git branch moved while checking source files.');
  return Object.freeze({
    format:'naxx-local-git-head-preflight-v1',
    checkedLocalCommit:true,expectedHeadSha256OrSha1:expectedHead,
    checkedBranch:branch,checkedTrackedBlobs:receipt.proposedFileCount,
    localBranchStableDuringCheck:true,remoteGitHubTipVerified:false,
    githubAuthenticated:false,atomicRemoteUpdateGuaranteed:false,
    candidateLayoutApproved:false,reviewOnly:true,
    canApply:false,canPush:false,canMerge:false,canPublish:false,
    sourceValuesPrinted:false,gitSourceWrites:0
  });
}
function initSyntheticRepo(repo){
  function write(relative,data){
    const file=path.join(repo,...relative.split('/'));
    fs.mkdirSync(path.dirname(file),{recursive:true,mode:0o700});
    fs.writeFileSync(file,data,{mode:0o600});
  }
  runGit(repo,['init','-q','-b','private-review-check']);
  const contents=[
    [RUNTIME,'<main>synthetic test content</main>\n'],
    [MANIFEST,'{"revision":0,"private":true}\n'],
    [recordPath(0),'synthetic resource record\n']
  ];
  for(const [relative,value] of contents)write(relative,value);
  runGit(repo,['add','--',...contents.map(x=>x[0])]);
  runGit(repo,['-c','user.name=Local Test','-c','user.email=local@invalid.test',
    'commit','-q','-m','synthetic baseline']);
  return contents;
}
function syntheticReceipt(contents){
  const files=contents.map(([relative,value])=>({
    path:relative,kind:relative===RUNTIME?'proposed-generated-runtime':
      relative===MANIFEST?'proposed-source-manifest':'proposed-resource-fragment',
    oldBytes:Buffer.byteLength(value),
    newBytes:Buffer.byteLength(value)+1,
    expectedOldSha256:sha(Buffer.from(value)),
    proposedNewSha256:sha(Buffer.from(value+'x'))
  }));
  return {format:FORMAT,reviewOnly:true,githubReady:false,
    canApply:false,canPublish:false,canMerge:false,
    trustedGitCommitChecked:false,
    originalBaselineSha256:SOURCE_SHA,currentRevision:0,proposedRevision:1,
    editedResourceCount:1,proposedFileCount:3,proposedPaths:files,
    expectedCurrentSourceSha256:files.find(x=>x.path===RUNTIME).expectedOldSha256,
    proposedFullSiteSha256:files.find(x=>x.path===RUNTIME).proposedNewSha256};
}
function demonstrate(){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'naxx-git-head-review-'));
  fs.chmodSync(dir,0o700);
  try{
    const files=initSyntheticRepo(dir),receipt=syntheticReceipt(files);
    const baseline=runGit(dir,['rev-parse','HEAD']).trim();
    const checked=verifyPinnedLocalBranch(dir,'private-review-check',baseline,receipt);
    fs.writeFileSync(path.join(dir,'unrelated.txt'),'simulated separate commit\n');
    runGit(dir,['add','--','unrelated.txt']);
    runGit(dir,['-c','user.name=Local Test','-c','user.email=local@invalid.test',
      'commit','-q','-m','unrelated test change']);
    let staleRejected=false;
    try{verifyPinnedLocalBranch(dir,'private-review-check',baseline,receipt);}
    catch(e){staleRejected=/Stale local branch/.test(e.message);}
    if(!staleRejected)throw Error('Stale Git ref was not refused.');
    const newHead=runGit(dir,['rev-parse','HEAD']).trim();
    const confirmed=verifyPinnedLocalBranch(dir,'private-review-check',newHead,receipt);
    if(confirmed.remoteGitHubTipVerified||checked.canPush)
      throw Error('Local check falsely claimed remote authority.');
    return {format:'naxx-private-git-head-demo-v1',
      initialRefVerified:checked.checkedLocalCommit,
      refMoveRejected:staleRejected,
      newExplicitHeadReviewAccepted:confirmed.checkedLocalCommit,
      checkedFilePaths:confirmed.checkedTrackedBlobs,
      githubRemoteChecked:false,githubFilesWritten:0,
      branchMutationsOnlyInDisposableRepo:true,
      temporaryRepoDeleted:true,ownerApproved:false};
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
}
if(require.main===module){
  try{process.stdout.write(JSON.stringify(demonstrate(),null,2)+'\n');}
  catch(_){
    process.stderr.write('Read-only branch-head rehearsal failed closed.\n');
    process.exitCode=1;
  }
}
module.exports={validBranch,approvedResourcePath,validateReceipt,
  verifyPinnedLocalBranch,getBlob,initSyntheticRepo,syntheticReceipt,demonstrate,runGit};
