'use strict';
/*
 * REVIEW-ONLY bridge: independently rehearsed backup + complete local site
 * recovery -> exact-old-head contract -> uncertain Save interpretation.
 *
 * Input report is development-only evidence and never proof of an authorised
 * real GitHub mutation. No remote GitHub client, credential, editor file write,
 * commit creation, Save invocation or release capability exists here.
 */
const {makeGuard,reviewCurrentHead}=
  require('./plan-exact-head-save-guard.cjs');
const {reconcile}=require('./plan-uncertain-save-outcome.cjs');
const {EXPECTED_REPO,EXPECTED_BRANCH}=
  require('./rehearse-remote-github-head-preflight.cjs');
const HEX40=/^[a-f0-9]{40}$/;
const HEX64=/^[a-f0-9]{64}$/;
const FORMAT='naxx-private-backup-bound-uncertain-save-decision-v1';
function checkReport(report,reviewedCommit){
  if(!report||typeof report!=='object'||Array.isArray(report)||
     report.format!=='naxx-private-restore-tested-backup-bound-review-v1'||
     report.reviewedOriginalGitCommit!==reviewedCommit||
     report.originalTrackedFileFingerprintMatched!==true||
     report.actualGitHistoryBundleSavedAndRestoredTwice!==true||
     report.backupReceiptAndBundleMatchedReviewedCommit!==true||
     report.actualBrowserZIPValidated!==true||
     report.fullTrackedSitePreservedAndRolledBack!==true||
     report.completeProposedResourceOverlayFiles!==415||
     report.allOriginalCustomScriptsAndAssetsPreserved!==true||
     report.realGitCheckoutUnchanged!==true||
     report.backupOnlyTemporary!==true||
     report.durableOwnerBackupRetained!==false||
     report.backupOfGitHubAccountSettingsOrServices!==false||
     report.finalSourceLayoutApproved!==false||
     report.realAuthenticatedSaveOrRemoteAtomicUpdate!==false||
     report.ownerApproved!==false||
     report.canApply!==false||report.canPush!==false||
     report.canMerge!==false||report.canPublish!==false||
     report.originalRepositoryFilesWritten!==0||
     report.gitHubWrites!==0)
    throw Error('Source review or restored backup evidence is missing or contradictory.');
}
function decide({
  backupEvidence,reviewedCommit,proposedCommit,expectedWebsiteSha256,
  observedHead=null,responseKind='unknown',candidateMetadata=null
}={}){
  if(!HEX40.test(reviewedCommit||'')||
     !HEX40.test(proposedCommit||'')||
     reviewedCommit===proposedCommit||
     !HEX64.test(expectedWebsiteSha256||''))
    throw Error('Independent reviewed and proposed Git identities are required.');
  checkReport(backupEvidence,reviewedCommit);
  const guard=makeGuard({
    repo:EXPECTED_REPO,branch:EXPECTED_BRANCH,
    reviewedHead:reviewedCommit,proposedHead:proposedCommit
  });
  // A pre-update observation of a moved branch is a hard refusal.
  // The actual CAS must still be enforced by the GitHub server, not here.
  const observed=observedHead===null?null:
    reviewCurrentHead(guard,observedHead,reviewedCommit);
  const interpretation=reconcile({
    guard,independentReviewedHead:reviewedCommit,
    expectedSiteSha256:expectedWebsiteSha256,
    observedHead,responseKind,
    verifiedCandidate:candidateMetadata
  });
  const status=observed&&observed.stale&&
    observedHead!==proposedCommit?
      'stale-branch-refused':
      interpretation.status;
  return Object.freeze({
    format:FORMAT,
    status,
    reviewedCommit,proposedCommit,
    backupBoundToExactReviewedCommit:true,
    completeTrackedSiteRestorationRehearsed:true,
    proposedCompatibilitySha256:expectedWebsiteSha256,
    branchReadNotALock:true,
    gitHubCASMechanismRequired:guard.requiredGitHubMechanism,
    serverEnforcedBeforeOidRequired:true,
    earlierBackupWasTemporaryAndDeleted:true,
    originalDraftMustBeRetained:interpretation.retainOriginalDraft,
    manualInvestigationRequired:true,
    neverAutomaticallyRetry:interpretation.automaticRetryAllowed===false,
    sourceLayoutOwnerApproved:false,
    durableReleaseBackupAvailable:false,
    actualRemoteMutationAttempted:false,
    authenticatedGitHubEvidenceCollected:false,
    reportCanProveRealSave:false,
    canApply:false,canRetry:false,canForce:false,canPush:false,
    canMerge:false,canPublish:false,
    githubWrites:0,networkRequests:0
  });
}
module.exports=Object.freeze({FORMAT,checkReport,decide});
