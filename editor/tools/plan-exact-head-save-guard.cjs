'use strict';
/*
 * EXACT-OLD-HEAD GITHUB SAVE GUARD — NON-EXECUTABLE REHEARSAL.
 *
 * GitHub REST PATCH /git/refs force:false checks fast-forward ancestry;
 * it does NOT include an old-head equality condition in its documented
 * request fields. GitHub GraphQL updateRefs supports RefUpdate.beforeOid.
 *
 * This module models the required exact compare-and-swap (CAS) boundary.
 * It contains NO GitHub API calls, GraphQL mutation, source bytes, token,
 * filesystem writer, server authorization or actual Save implementation.
 * A read-only match cannot grant permission to publish or merge.
 */
const {EXPECTED_REPO,EXPECTED_BRANCH}=
  require('./rehearse-remote-github-head-preflight.cjs');
const FORMAT='naxx-private-exact-head-save-contract-v1';
const OID=/^[a-f0-9]{40}$/;
const PREFIX='refs/heads/';
const keys=(obj,expected)=>!!obj&&typeof obj==='object'&&!Array.isArray(obj)&&
  Object.keys(obj).sort().join(',')===expected.slice().sort().join(',');

function makeGuard({
  repo,branch,reviewedHead,proposedHead
}={}){
  if(repo!==EXPECTED_REPO||branch!==EXPECTED_BRANCH||
     !OID.test(reviewedHead||'')||!OID.test(proposedHead||'')||
     proposedHead===reviewedHead)
    throw Error('Exact-head rehearsal identity is invalid or unapproved.');
  return Object.freeze({
    format:FORMAT,
    readOnly:true,sourceLayoutApproved:false,ownerApprovalRecorded:false,
    repository:repo,refName:PREFIX+branch,
    expectedOldOid:reviewedHead,proposedNewOid:proposedHead,
    // Contract for FUTURE evaluation only, never a live mutation:
    requiredGitHubMechanism:'GraphQL updateRefs RefUpdate.beforeOid',
    requiredExpectedOidField:'beforeOid',
    requiredDestinationOidField:'afterOid',
    requiredForce:false,
    exactOldHeadAtUpdateRequired:true,
    twoRemoteReadsAreNotALock:true,
    restFastForwardAloneIsInsufficient:true,
    authorizationVerified:false,
    realGitHubCASVerified:false,
    realFileChangesCommitted:false,
    stagedSourceBytesIncluded:false,
    canExecute:false,canApply:false,canPush:false,
    canMerge:false,canPublish:false,githubWrites:0
  });
}
function reviewCurrentHead(guard,observedHead,independentlyReviewedHead){
  if(!guard||guard.format!==FORMAT||!keys(guard,[
    'format','readOnly','sourceLayoutApproved','ownerApprovalRecorded',
    'repository','refName','expectedOldOid','proposedNewOid',
    'requiredGitHubMechanism','requiredExpectedOidField',
    'requiredDestinationOidField','requiredForce',
    'exactOldHeadAtUpdateRequired','twoRemoteReadsAreNotALock',
    'restFastForwardAloneIsInsufficient','authorizationVerified',
    'realGitHubCASVerified','realFileChangesCommitted',
    'stagedSourceBytesIncluded','canExecute','canApply','canPush',
    'canMerge','canPublish','githubWrites'
  ])||
     guard.repository!==EXPECTED_REPO||
     guard.refName!==PREFIX+EXPECTED_BRANCH||
     !OID.test(guard.expectedOldOid)||
     !OID.test(guard.proposedNewOid)||
     guard.expectedOldOid===guard.proposedNewOid||
     guard.requiredGitHubMechanism!=='GraphQL updateRefs RefUpdate.beforeOid'||
     guard.requiredForce!==false||
     guard.requiredExpectedOidField!=='beforeOid'||
     guard.requiredDestinationOidField!=='afterOid'||
     guard.readOnly!==true||guard.canExecute!==false||
     guard.canApply!==false||guard.canPush!==false||
     guard.canMerge!==false||guard.canPublish!==false||
     guard.sourceLayoutApproved!==false||
     guard.ownerApprovalRecorded!==false||
     guard.githubWrites!==0||
     guard.exactOldHeadAtUpdateRequired!==true||
     guard.twoRemoteReadsAreNotALock!==true||
     guard.restFastForwardAloneIsInsufficient!==true||
     guard.authorizationVerified!==false||
     guard.realFileChangesCommitted!==false||
     guard.stagedSourceBytesIncluded!==false||
     guard.realGitHubCASVerified!==false)
    throw Error('Untrusted or modified exact-head contract refused.');
  // A syntactically correct receipt is untrusted. Demand the independently
  // pinned, verified source commit as a separate caller argument so a
  // modified receipt cannot silently change the expected old Git head.
  // The caller STILL must authenticate that source commit independently.
  if(!OID.test(independentlyReviewedHead||'')||
     independentlyReviewedHead!==guard.expectedOldOid)
    throw Error('Exact-head contract does not match independent source review.');
  if(!OID.test(observedHead||''))
    throw Error('Remote head observation has an invalid identity.');
  return Object.freeze({
    sameAsReviewedHead:observedHead===guard.expectedOldOid,
    stale:observedHead!==guard.expectedOldOid,
    // Even matching read-only observations are NOT server-enforced CAS.
    branchLocked:false,realAtomicUpdateProven:false,
    canApply:false,canPush:false,canPublish:false,
    networkRequests:0,gitHubWrites:0
  });
}
function simulateAtomicUpdate(guard,currentHead,independentlyReviewedHead){
  const preview=reviewCurrentHead(guard,currentHead,independentlyReviewedHead);
  // This returns a purely fictional state transition for a single ref.
  // An actual GitHub operation must enforce beforeOid on the server.
  if(preview.stale)throw Error('Exact old head mismatch at simulated update boundary.');
  return Object.freeze({
    fakeHeadAfter:guard.proposedNewOid,
    acceptedOnlyInMemory:true,realGitHubCASVerified:false,
    repositoryWrites:0,canPublish:false
  });
}
module.exports=Object.freeze({
  FORMAT,makeGuard,reviewCurrentHead,simulateAtomicUpdate
});
