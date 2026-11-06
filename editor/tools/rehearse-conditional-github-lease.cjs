'use strict';
/*
 * PRIVATE CONDITIONAL GITHUB BRANCH LEASE REHEARSAL — IN MEMORY ONLY.
 *
 * This is NOT a GitHub API client, staging format, save pipeline or
 * production compare-and-swap implementation. It only models a hypothetical
 * atomic expected-head update against fictional checksummed file metadata.
 * No real file contents, Git objects, network activity or GitHub writes.
 *
 * A remote double-GET is useful but NOT sufficient: a ref may change after
 * the second observation. Refusal requires a server-enforced expected-head
 * condition at the actual update boundary.
 */
const crypto=require('node:crypto');
const {validateReceipt}=require('./rehearse-local-git-head-preflight.cjs');
const {RUNTIME}=require('./plan-private-github-source-review.cjs');
const {recordPath,MANIFEST,COUNT}=require('./rehearse-resource-only-overlay.cjs');
const {SOURCE_SHA}=require('./audit-source-storage-budget.cjs');
const {observeRemoteHead,EXPECTED_REPO,EXPECTED_BRANCH,fakeResponse}=
  require('./rehearse-remote-github-head-preflight.cjs');

const SHA40=/^[0-9a-f]{40}$/,SHA256=/^[0-9a-f]{64}$/;
const sha=value=>crypto.createHash('sha256').update(value).digest('hex');
const commitId=value=>crypto.createHash('sha1').update(value).digest('hex');
const FORMAT='naxx-private-conditional-github-lease-simulation-v1';

function copyMetadata(metadata){
  if(!metadata||typeof metadata!=='object'||Array.isArray(metadata))
    throw Error('Synthetic tree metadata is invalid.');
  const files=new Map();
  for(const [file,data] of Object.entries(metadata)){
    if(typeof file!=='string'||!data||!SHA256.test(data.sha256)||
       !Number.isSafeInteger(data.bytes)||data.bytes<1)
      throw Error('Synthetic file metadata has an invalid hash or size.');
    files.set(file,Object.freeze({sha256:data.sha256,bytes:data.bytes}));
  }
  if(!files.has(RUNTIME)||!files.has(MANIFEST))
    throw Error('Synthetic source requires the runtime and manifest.');
  return files;
}
function makeFakeTree(){
  const metadata={
    [RUNTIME]:{sha256:SOURCE_SHA,bytes:30976969},
    [MANIFEST]:{sha256:sha('fictional manifest v0'),bytes:35},
    'other/unchanged-documentation.md':{sha256:sha('unrelated'),bytes:9}
  };
  for(let i=0;i<COUNT;i++){
    metadata[recordPath(i)]={sha256:sha('fictional fragment '+i),bytes:40+i};
  }
  return metadata;
}
function makeFakeReceipt(tree,revision,indices){
  if(!Array.isArray(indices)||indices.length<1||
     new Set(indices).size!==indices.length||
     indices.some(x=>!Number.isInteger(x)||x<0||x>=COUNT))
    throw Error('Synthetic edit selection is invalid.');
  const names=[...indices.map(recordPath),MANIFEST,RUNTIME];
  const files=names.map((relative,i)=>{
    const old=tree[relative];
    if(!old)throw Error('Required old synthetic source path is missing.');
    const kind=relative===RUNTIME?'proposed-generated-runtime':
      relative===MANIFEST?'proposed-source-manifest':'proposed-resource-fragment';
    return Object.freeze({
      path:relative,kind,expectedOldSha256:old.sha256,
      proposedNewSha256:sha(['fictional new source',revision,relative,
        old.sha256,i].join('|')),
      oldBytes:old.bytes,newBytes:old.bytes+1
    });
  });
  const runtime=files.find(x=>x.path===RUNTIME);
  const receipt={
    format:'naxx-private-github-changeset-review-v1',
    reviewOnly:true,githubReady:false,canApply:false,canPublish:false,
    canMerge:false,trustedGitCommitChecked:false,
    originalBaselineSha256:SOURCE_SHA,
    expectedCurrentSourceSha256:runtime.expectedOldSha256,
    proposedFullSiteSha256:runtime.proposedNewSha256,
    currentRevision:revision,proposedRevision:revision+1,
    editedResourceCount:indices.length,
    proposedFileCount:files.length,proposedPaths:files
  };
  validateReceipt(receipt);
  return receipt;
}
function createFakeRemote({initialHead,tree,initialRevision=0}){
  if(!SHA40.test(initialHead)||!Number.isSafeInteger(initialRevision)||
     initialRevision<0)
    throw Error('Simulated initial branch identity is invalid.');
  const source=copyMetadata(tree);
  let head=initialHead,revision=initialRevision;
  let attempts=0,accepted=0;
  const events=[];
  const descriptor=()=>{
    const copy={};
    for(const [file,info] of source)copy[file]={...info};
    return copy;
  };
  const readRef=async (repo,branch)=>{
    if(repo!==EXPECTED_REPO||branch!==EXPECTED_BRANCH)
      throw Error('Synthetic ref request targets an unapproved branch.');
    return fakeResponse(EXPECTED_BRANCH,head);
  };
  function makeCandidate(expectedHead,receipt){
    validateReceipt(receipt);
    if(!SHA40.test(expectedHead)||receipt.currentRevision!==revision)
      throw Error('Review source revision or expected commit is invalid.');
    if(expectedHead!==head)
      throw Error('The synthetic branch changed since review.');
    const updates=receipt.proposedPaths.map(x=>{
      const current=source.get(x.path);
      if(!current||current.sha256!==x.expectedOldSha256||
         current.bytes!==x.oldBytes)
        throw Error('Current synthetic blob does not match the review receipt.');
      return Object.freeze({
        path:x.path,previousSha256:x.expectedOldSha256,
        nextSha256:x.proposedNewSha256,
        nextBytes:x.newBytes
      });
    });
    const candidate={
      parentCommit:expectedHead,revisionFrom:revision,
      revisionTo:revision+1,
      proposedCommit:commitId(JSON.stringify({
        parent:expectedHead,revisionFrom:revision,updates
      })),updates:Object.freeze(updates)
    };
    return Object.freeze(candidate);
  }
  function tryConditionalAdvance({expectedHead,receipt,candidate}){
    attempts++;
    // All of this method runs synchronously against a private JS Map.
    // It models an atomic CAS; it does NOT call update_ref or GitHub.
    if(!SHA40.test(expectedHead)||head!==expectedHead){
      events.push('refused-stale-head');
      throw Error('Simulated stale branch: expected commit does not match.');
    }
    validateReceipt(receipt);
    if(!candidate||candidate.parentCommit!==expectedHead||
       !SHA40.test(candidate.proposedCommit)||
       candidate.revisionFrom!==revision||
       candidate.revisionTo!==revision+1||
       receipt.currentRevision!==revision||
       receipt.proposedRevision!==revision+1||
       !Array.isArray(candidate.updates)||
       candidate.updates.length!==receipt.proposedPaths.length){
      events.push('refused-invalid-candidate');
      throw Error('Simulated candidate parent/revision/path count is invalid.');
    }
    const changes=new Map();
    for(const item of candidate.updates){
      if(!item||changes.has(item.path)){
        events.push('refused-duplicate-path');
        throw Error('Simulated candidate has duplicate paths.');
      }
      changes.set(item.path,item);
    }
    for(const expected of receipt.proposedPaths){
      const got=changes.get(expected.path),before=source.get(expected.path);
      if(!got||!before||
         before.sha256!==expected.expectedOldSha256||
         before.bytes!==expected.oldBytes||
         got.previousSha256!==expected.expectedOldSha256||
         got.nextSha256!==expected.proposedNewSha256||
         got.nextBytes!==expected.newBytes){
        events.push('refused-blob-mismatch');
        throw Error('Simulated candidate blob hash or size is invalid.');
      }
    }
    const canonical=commitId(JSON.stringify({
      parent:expectedHead,revisionFrom:revision,
      updates:receipt.proposedPaths.map(x=>changes.get(x.path))
    }));
    if(candidate.proposedCommit!==canonical){
      events.push('refused-commit-id');
      throw Error('Simulated candidate commit identity is invalid.');
    }
    // The only mutation in this entire module is in this *fake* memory.
    for(const expected of receipt.proposedPaths){
      source.set(expected.path,Object.freeze({
        sha256:expected.proposedNewSha256,bytes:expected.newBytes
      }));
    }
    head=candidate.proposedCommit;
    revision++;
    accepted++;
    events.push('accepted-fictional-update');
    return Object.freeze({
      status:'accepted-in-memory-only',simulatedBranchAdvanced:true,
      newFakeHead:head,revision,
      githubRepositoryWrites:0,canPush:false,
      canPublish:false,realCASVerified:false
    });
  }
  return Object.freeze({
    readRef,makeCandidate,tryConditionalAdvance,
    head:()=>head,revision:()=>revision,
    snapshot:()=>descriptor(),
    metrics:()=>Object.freeze({
      attempts,accepted,refused:attempts-accepted,
      eventCodes:[...events],remoteNetworkRequests:0,githubWrites:0
    })
  });
}
async function reviewThenSimulate({remote,expectedHead,receipt,beforeConditional}){
  if(!remote||typeof remote.readRef!=='function'||
     typeof remote.makeCandidate!=='function'||
     typeof remote.tryConditionalAdvance!=='function')
    throw Error('Missing synthetic branch capabilities.');
  validateReceipt(receipt);
  if(!SHA40.test(expectedHead))
    throw Error('Pinned synthetic commit has invalid format.');
  // Do not let a source match alone grant any production privileges.
  await observeRemoteHead({
    repo:EXPECTED_REPO,branch:EXPECTED_BRANCH,expectedSha:expectedHead,
    readRef:remote.readRef,
    checkCheckout:async shaValue=>({
      checkedOutCommitMatched:shaValue===expectedHead,
      originalWebsiteSha256Matched:true,
      canPush:false,canPublish:false
    })
  });
  const candidate=remote.makeCandidate(expectedHead,receipt);
  // The hook deliberately models a race AFTER both remote reads.
  if(beforeConditional)await beforeConditional(candidate);
  const simulated=remote.tryConditionalAdvance({
    expectedHead,receipt,candidate
  });
  return Object.freeze({
    format:FORMAT,
    simulatedResult:simulated.status,
    wouldRefuseStaleHead:true,
    simulatedRevision:simulated.revision,
    hypotheticalCASInMemory:true,
    actualGitHubCASVerified:false,
    productionCommitCreated:false,
    authenticatedGitHubBranchLocked:false,
    sourceBytesWritten:0,githubRepositoryWrites:0,
    canApply:false,canPush:false,canMerge:false,canPublish:false,
    ownerApprovalObtained:false
  });
}
async function demonstrate(){
  const initialHead='a'.repeat(40);
  const remote=createFakeRemote({initialHead,tree:makeFakeTree()});
  const tree0=remote.snapshot();
  const first=makeFakeReceipt(tree0,0,[0]);
  const other=makeFakeReceipt(tree0,0,[413]);
  const accepted=await reviewThenSimulate({
    remote,expectedHead:initialHead,receipt:first
  });
  let staleSecond=false;
  try{await reviewThenSimulate({
    remote,expectedHead:initialHead,receipt:other
  });}catch(e){staleSecond=/advanced before/.test(e.message);}
  if(!staleSecond)throw Error('Second outdated fictional session was not refused.');
  const nextHead=remote.head();
  const newer=makeFakeReceipt(remote.snapshot(),remote.revision(),[413]);
  let betweenReadAndUpdate=false;
  try{await reviewThenSimulate({
    remote,expectedHead:nextHead,receipt:newer,
    beforeConditional:()=>remote.tryConditionalAdvance({
      expectedHead:nextHead,receipt:newer,
      candidate:remote.makeCandidate(nextHead,newer)
    })
  });}catch(e){betweenReadAndUpdate=/Simulated stale branch/.test(e.message);}
  if(!betweenReadAndUpdate)
    throw Error('A last-moment fictional branch race was not refused.');
  const stats=remote.metrics();
  if(stats.accepted!==2||stats.refused!==1||
     !staleSecond||accepted.canPush)
    throw Error('In-memory branch lease rehearsal did not preserve the guard.');
  return {
    format:FORMAT,
    firstFictionalUpdateAccepted:accepted.simulatedResult==='accepted-in-memory-only',
    staleSecondSessionRefused:staleSecond,
    movedAfterLastReadRefused:betweenReadAndUpdate,
    simulatedAttemptCount:stats.attempts,
    simulatedAccepted:stats.accepted,
    simulatedStaleRefusals:stats.refused,
    everyWriteWasInMemory:true,
    externalNetworkCalls:stats.remoteNetworkRequests,
    realGitHubWrites:stats.githubWrites,
    remoteBranchLocked:false,realCASVerified:false,
    ownerApproved:false,canApply:false,canPush:false,canPublish:false
  };
}
if(require.main===module){
  demonstrate().then(value=>process.stdout.write(
    JSON.stringify(value,null,2)+'\n'
  )).catch(_=>{
    process.stderr.write('Private in-memory conditional branch simulation refused safely.\n');
    process.exitCode=1;
  });
}
module.exports={
  FORMAT,makeFakeTree,makeFakeReceipt,createFakeRemote,
  reviewThenSimulate,demonstrate
};
