'use strict';
/*
 * Complete sandbox-only editor Save pipeline:
 * independently reviewed source bytes -> verified Git objects ->
 * exact-old remote ref advance -> independent head/commit/tree readback.
 *
 * The injected adapters may represent a fictional disposable repository.
 * The actual Resource Hub repository is explicitly rejected by both stages.
 * This is NOT connected to the browser or local companion's /save endpoint.
 * It cannot access GitHub credentials, create an authenticated remote
 * connection, publish the website, or turn a mock success into authority.
 */
const {checkedCandidate,stageSandboxGitObjects}=
  require('./stage-sandbox-git-objects.cjs');
const {createSandboxProposal,attemptSandboxLease,checkRefObservation,
  safeBranch}=require('./conditional-remote-ref-transport.cjs');
const FORMAT='naxx-disposable-end-to-end-remote-save-rehearsal-v1';
function validateOptions(options) {
  if(!options || typeof options!=='object' || Array.isArray(options) ||
     typeof options.repositoryId!=='string' ||
     options.repositoryId.length<3 || options.repositoryId.length>180 ||
     !/^[A-Za-z0-9_=+-]+$/.test(options.repositoryId) ||
     !safeBranch(options.branch) ||
     options.disposableTestOnly!==true ||
     options.publishDisabled!==true ||
     options.ownerBackupNotClaimed!==true ||
     !options.candidate)
    throw Error('A deliberately isolated, non-publishing source verification is required.');
  const source=checkedCandidate(options.candidate);
  return Object.freeze({
    source,repositoryId:options.repositoryId,
    branch:options.branch
  });
}
async function rehearseSandboxRemoteSave(options,adapters) {
  const selected=validateOptions(options);
  if(!adapters||typeof adapters!=='object'||
     !adapters.objects||!adapters.refs||
     typeof adapters.refs.readRef!=='function')
    throw Error('Independent sandbox Git-object and ref adapters are required.');
  // Avoid uploading ~415 Git blobs if this branch has ALREADY moved.
  // This pre-read is not a lock: updateRefs.beforeOid remains mandatory.
  const prior={targetRepository:selected.source.targetRepository,
    branch:selected.branch};
  const old=checkRefObservation(await adapters.refs.readRef(),prior);
  if(old!==selected.source.parent)
    throw Error('The sandbox branch is stale; no blobs or commit were uploaded.');
  // The previously source-reviewed Git object builder is the only way to
  // obtain the candidate commit identity. Never accept an independent,
  // caller-supplied arbitrary new commit SHA here.
  const staged=await stageSandboxGitObjects(options.candidate,adapters.objects);
  if(staged.targetRepository!==selected.source.targetRepository||
     staged.reviewedParentOid!==selected.source.parent||
     staged.originalTreeOid!==selected.source.baseTree||
     staged.verifiedProposedTreeOid!==selected.source.expectedNextTree||
     staged.fullSourceBlobsVerified!==
       selected.source.overlayFiles+selected.source.changedTracked||
     staged.exactOneParentVerified!==true||
     staged.gitRefAdvanced!==false||
     staged.realWebsiteRepositoryWritten!==false||
     staged.productionSaveAuthorized!==false||
     staged.canPush!==false||staged.canPublish!==false)
    throw Error('The staged sandbox Git objects were not independently consistent.');
  const proposal=createSandboxProposal({
    targetRepository:selected.source.targetRepository,
    repositoryId:selected.repositoryId,branch:selected.branch,
    oldCommit:staged.reviewedParentOid,
    newCommit:staged.proposedCommitOid,
    parentCommit:staged.reviewedParentOid,
    expectedTree:staged.verifiedProposedTreeOid,
    actualTree:selected.source.expectedNextTree,
    fullSiteVerified:true,originalGitHistoryVerified:true,
    disposableTestOnly:true,boundedSourcePathsVerified:true
  });
  // A branch move during object creation is caught by the second read
  // inside attemptSandboxLease(). On any timeout or unknown result the
  // pipeline STOPs without a retry or a claimed successful Save.
  const advance=await attemptSandboxLease(proposal,adapters.refs);
  if(advance.targetRepository!==selected.source.targetRepository||
     advance.verifiedNewHead!==staged.proposedCommitOid||
     advance.independentlyVerifiedTree!==selected.source.expectedNextTree||
     advance.branch!==selected.branch||
     advance.refAndCommitReadBackVerified!==true||
     advance.expectedOldHeadSent!==true||
     advance.force!==false||
     advance.productionGitHubSaveProven!==false||
     advance.canPublish!==false)
    throw Error('The sandbox branch did not advance to the reviewed source.');
  return Object.freeze({
    format:FORMAT,
    sandboxOnly:true,repository:selected.source.targetRepository,
    branch:selected.branch,previousCommit:staged.reviewedParentOid,
    newCommit:staged.proposedCommitOid,
    verifiedCompleteSiteTree:selected.source.expectedNextTree,
    blobsVerified:staged.fullSourceBlobsVerified,
    unchangedSourceChecked:true,
    exactOldHeadVerifiedAtMutation:true,
    remoteHeadAndTreeIndependentlyReadBack:true,
    sourceRepositoryNotTouched:true,canPublish:false,
    productionSaveEnabled:false,ownerHeldBackupVerified:false
  });
}
module.exports=Object.freeze({FORMAT,validateOptions,rehearseSandboxRemoteSave});
