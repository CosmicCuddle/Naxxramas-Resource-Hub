'use strict';
/*
 * OWNER-BACKUP-BOUND SANDBOX SOURCE PREFLIGHT — STRICTLY READ-ONLY.
 *
 * Every future actual remote Save must start from a complete clean checkout
 * with a separately retained private, restored-and-reverified Git bundle.
 * This module binds that existing bundle to exactly the source version in
 * the browser-generated review ZIP, without changing any Git ref or file.
 *
 * No GitHub credentials/API, no production Save endpoint, no default CLI.
 * This is not approval of source layout or proof of an off-machine backup.
 */
const {verifyRetainedBackup}=require('./verify-retained-backup.cjs');
const {prepareSandboxSource}=require('./prepare-sandbox-source-from-zip.cjs');
const {ensureRepo}=require('./github-sandbox-api.cjs');
const FORMAT='naxx-backup-bound-source-preparation-v1';
const SHA=/^[0-9a-f]{40}$/;
async function prepareWithRetainedBackup(options) {
  if(!options||typeof options!=='object'||Array.isArray(options)||
     typeof options.checkout!=='string'||
     typeof options.backupFile!=='string'||
     !Buffer.isBuffer(options.zip)||
     !SHA.test(options.expectedCommit||'')||
     typeof options.repository!=='string'||
     options.testOnly!==true||
     options.ownerRemoteWriteApprovalGiven!==false||
     options.sourceLayoutApproved!==false)
    throw Error('Source preparation requires an explicit private backup and a non-writing test-only scope.');
  ensureRepo(options.repository);
  const before=verifyRetainedBackup(options.checkout,options.backupFile);
  if(before.format!=='naxx-existing-private-git-backup-verified-v1'||
     before.verifiedOriginalCommit!==options.expectedCommit||
     before.exactGitCheckoutBound!==true||
     before.existingBundleAndSidecarsIntact!==true||
     before.restoredAgainFromExistingBundle!==true||
     before.originalCheckoutUnchanged!==true||
     before.ownerOffMachineCopyConfirmed!==false||
     before.realSaveEnabled!==false||
     before.githubWrites!==0)
    throw Error('An intact retained backup of this exact Git source is required.');
  const prepared=await prepareSandboxSource(
    options.checkout,options.zip,options.expectedCommit,options.repository
  );
  if(prepared.format!=='naxx-original-browser-zip-to-sandbox-source-v1'||
     prepared.originalSourceCommit!==options.expectedCommit||
     prepared.candidate.targetRepository!==options.repository||
     prepared.candidate.expectedParent!==options.expectedCommit||
     prepared.candidate.proof.reviewedGitCommit!==options.expectedCommit||
     prepared.originalSourceCheckoutPreserved!==true||
     prepared.localTemporarySiteRolledBackAndDeleted!==true||
     prepared.productionGitHubWriteAuthorized!==false||
     prepared.canonical415SourceLayoutApproved!==false||
     prepared.canPublish!==false)
    throw Error('The source candidate does not match the retained backup and reviewed Git commit.');
  // Recheck AFTER source staging, not only before it. A moved Git head or
  // edited backup in the interval must invalidate the complete preparation.
  const after=verifyRetainedBackup(options.checkout,options.backupFile);
  if(after.verifiedOriginalCommit!==before.verifiedOriginalCommit||
     after.verifiedOriginalTree!==before.verifiedOriginalTree||
     after.verifiedTrackedFiles!==before.verifiedTrackedFiles||
     after.verifiedFetchedRefs!==before.verifiedFetchedRefs||
     after.existingBundleAndSidecarsIntact!==true||
     after.restoredAgainFromExistingBundle!==true||
     after.originalCheckoutUnchanged!==true||
     after.githubWrites!==0)
    throw Error('Retained backup or website Git source changed during source preparation.');
  return Object.freeze({
    format:FORMAT,
    candidate:prepared.candidate,
    exactOriginalGitCommit:options.expectedCommit,
    verifiedSandboxRepository:options.repository,
    originalGitHistoryReverifiedBeforeAndAfter:true,
    savedPrivateBundleActuallyRestoredTwiceAgain:true,
    originalCheckoutUnchanged:true,
    completeOriginalSiteRebuiltAndRolledBack:true,
    originalSourceFilesInPublicSiteUnaffected:true,
    approvedCanonicalSourceLayout:false,
    ownerHeldOffMachineCopyVerified:false,
    actualGitHubSandboxWriteAuthorized:false,
    liveGitHubSaveEnabled:false,
    githubWrites:0,canPublish:false
  });
}
module.exports=Object.freeze({FORMAT,prepareWithRetainedBackup});
