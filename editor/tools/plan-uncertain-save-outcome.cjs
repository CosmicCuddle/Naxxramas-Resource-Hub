'use strict';
/*
 * UNCERTAIN GITHUB SAVE OUTCOME — PURE, FICTIONAL RECONCILIATION.
 *
 * A timeout after an attempted ref update is NOT permission to retry.
 * Never equate request acknowledgement with a verified GitHub update.
 * All inputs represent externally verified observations supplied by a
 * future, separately approved coordinator. This module has NO transport,
 * credentials, source bytes, filesystem access or GitHub mutation.
 */
const {reviewCurrentHead,FORMAT:HEAD_FORMAT}=
  require('./plan-exact-head-save-guard.cjs');
const FORMAT='naxx-private-uncertain-save-outcome-v1';
const HEX40=/^[0-9a-f]{40}$/;
const HEX64=/^[0-9a-f]{64}$/;
const RESPONSES=new Set(['acknowledged','timeout','connection-lost','rejected','not-sent','unknown']);
function fail(message){throw Error(message);}
function proofValid(proof,expectedCommit,expectedSiteHash){
  return !!proof&&typeof proof==='object'&&!Array.isArray(proof)&&
    Object.keys(proof).sort().join(',')===
      ['commit','sourceSha256','allProposedPathsVerified',
       'unchangedPathsVerified','resourceInventoryVerified'].sort().join(',')&&
    proof.commit===expectedCommit&&
    proof.sourceSha256===expectedSiteHash&&
    proof.allProposedPathsVerified===true&&
    proof.unchangedPathsVerified===true&&
    proof.resourceInventoryVerified===true;
}
function reconcile({guard,independentReviewedHead,expectedSiteSha256,
                    observedHead=null,verifiedCandidate=null,
                    responseKind='unknown'}={}){
  if(!guard||guard.format!==HEAD_FORMAT||
     !HEX40.test(independentReviewedHead||'')||
     !HEX64.test(expectedSiteSha256||'')||
     !RESPONSES.has(responseKind))
    fail('Untrusted save reconciliation inputs.');
  // Validate the contract itself and the separate source identity; a
  // self-asserted guard is not proof of real GitHub authorization.
  reviewCurrentHead(guard,independentReviewedHead,independentReviewedHead);
  if(observedHead!==null&&!HEX40.test(observedHead))
    fail('Malformed remote head observation.');
  if(verifiedCandidate!==null&&
     (typeof verifiedCandidate!=='object'||Array.isArray(verifiedCandidate)))
    fail('Malformed independent candidate verification.');
  const base={
    format:FORMAT,readOnly:true,
    responseKind,expectedOldHead:guard.expectedOldOid,
    proposedHead:guard.proposedNewOid,
    observedHeadKnown:observedHead!==null,
    // Matching supplied evidence has the required shape only.
    // Authentication and actual source/branch verification remain outside.
    externallyAuthenticatedGitHubObservation:false,
    actualGitHubSavePerformedByThisModule:false,
    realRemoteCASValidated:false,
    sourceLayoutApproved:false,ownerApprovalObtained:false,
    retainOriginalDraft:true,automaticRetryAllowed:false,
    forceUpdateAllowed:false,canApply:false,canPush:false,
    canMerge:false,canPublish:false,githubWrites:0,networkRequests:0
  };
  if(observedHead===null)
    return Object.freeze({...base,status:'unresolved-no-head',manualReviewRequired:true,
      candidateEvidenceConsistent:false,branchMayHaveChanged:true});
  if(observedHead===guard.expectedOldOid){
    // It is old at this observation, but can change immediately afterward.
    // Do not replay a possibly attempted request.
    return Object.freeze({...base,status:'old-head-observed-recheck-required',
      manualReviewRequired:true,candidateVerified:false,branchMayHaveChanged:true});
  }
  if(observedHead!==guard.proposedNewOid)
    return Object.freeze({...base,status:'conflicting-head-observed',
      manualReviewRequired:true,candidateVerified:false,branchMayHaveChanged:true});
  if(!proofValid(verifiedCandidate,guard.proposedNewOid,expectedSiteSha256))
    return Object.freeze({...base,status:'candidate-head-unverified-stop',
      manualReviewRequired:true,candidateVerified:false,branchMayHaveChanged:true});
  // Even if a separately authenticated checker verifies all paths,
  // this module cannot establish who performed the update or authorize
  // subsequent edits/deployment. Never treat a matching HEAD as a retry key.
  return Object.freeze({...base,status:'candidate-head-and-metadata-match-needs-authentication',
    manualReviewRequired:true,candidateEvidenceConsistent:true,branchMayHaveChanged:true});
}
module.exports=Object.freeze({FORMAT,reconcile});
