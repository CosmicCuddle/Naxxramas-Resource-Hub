'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {FMT}=require('../tools/rehearse-browser-zip-full-site-rollback.cjs');
const {FORMAT,checkReport,decide}=
  require('../tools/review-backup-bound-save-outcome.cjs');
const OLD='a'.repeat(40),NEW='b'.repeat(40),OTHER='c'.repeat(40);
const SITE='d'.repeat(64);
function evidence(){
  return {
    format:'naxx-private-restore-tested-backup-bound-review-v1',
    reviewedOriginalGitCommit:OLD,
    originalTrackedFileFingerprintMatched:true,
    actualGitHistoryBundleSavedAndRestoredTwice:true,
    backupReceiptAndBundleMatchedReviewedCommit:true,
    actualBrowserZIPValidated:true,
    fullTrackedSitePreservedAndRolledBack:true,
    completeProposedResourceOverlayFiles:415,
    allOriginalCustomScriptsAndAssetsPreserved:true,
    realGitCheckoutUnchanged:true,backupOnlyTemporary:true,
    durableOwnerBackupRetained:false,
    backupOfGitHubAccountSettingsOrServices:false,
    finalSourceLayoutApproved:false,
    realAuthenticatedSaveOrRemoteAtomicUpdate:false,
    ownerApproved:false,canApply:false,canPush:false,canMerge:false,
    canPublish:false,originalRepositoryFilesWritten:0,gitHubWrites:0
  };
}
const params=()=>({
  backupEvidence:evidence(),reviewedCommit:OLD,
  proposedCommit:NEW,expectedWebsiteSha256:SITE
});
const checked=result=>{
  assert.equal(result.format,FORMAT);
  assert.equal(result.backupBoundToExactReviewedCommit,true);
  assert.equal(result.completeTrackedSiteRestorationRehearsed,true);
  assert.equal(result.serverEnforcedBeforeOidRequired,true);
  assert.equal(result.originalDraftMustBeRetained,true);
  assert.equal(result.neverAutomaticallyRetry,true);
  assert.equal(result.canRetry,false);
  assert.equal(result.canApply,false);
  assert.equal(result.canPush,false);
  assert.equal(result.canForce,false);
  assert.equal(result.canMerge,false);
  assert.equal(result.canPublish,false);
  assert.equal(result.githubWrites,0);
  assert.equal(result.networkRequests,0);
  assert.equal(result.durableReleaseBackupAvailable,false);
  assert.equal(result.reportCanProveRealSave,false);
  assert.equal(result.sourceLayoutOwnerApproved,false);
  assert.equal(Object.isFrozen(result),true);
};
test('backup-bound timeout or missing GitHub response never retries or treats draft as saved',()=>{
  for(const responseKind of [
    'unknown','timeout','connection-lost','acknowledged','rejected','not-sent'
  ]){
    const result=decide({...params(),responseKind});
    assert.equal(result.status,'unresolved-no-head');
    checked(result);
  }
});
test('old branch and changed branch are both refused after uncertain Save',()=>{
  const old=decide({...params(),responseKind:'timeout',observedHead:OLD});
  assert.equal(old.status,'old-head-observed-recheck-required');
  checked(old);
  const changed=decide({...params(),responseKind:'acknowledged',observedHead:OTHER});
  assert.equal(changed.status,'stale-branch-refused');
  checked(changed);
});
test('same new fictional Git head without independent verification cannot prove saved',()=>{
  const partial=decide({...params(),observedHead:NEW,responseKind:'acknowledged'});
  assert.equal(partial.status,'candidate-head-unverified-stop');
  checked(partial);
});
test('even a hypothetical SHA-matching metadata proof does not authenticate or publish',()=>{
  const claimed={
    commit:NEW,sourceSha256:SITE,
    allProposedPathsVerified:true,unchangedPathsVerified:true,
    resourceInventoryVerified:true
  };
  const result=decide({
    ...params(),observedHead:NEW,responseKind:'timeout',
    candidateMetadata:claimed
  });
  assert.equal(result.status,'candidate-head-and-metadata-match-needs-authentication');
  assert.equal(result.authenticatedGitHubEvidenceCollected,false);
  checked(result);
  claimed.sourceSha256='0'.repeat(64);
  const conflict=decide({
    ...params(),observedHead:NEW,responseKind:'acknowledged',
    candidateMetadata:claimed
  });
  assert.equal(conflict.status,'candidate-head-unverified-stop');
  checked(conflict);
});
test('forged backup result, stale bundle identity and false permission are refused',()=>{
  const base=params();
  for(const [key,value] of [
    ['reviewedOriginalGitCommit',OTHER],
    ['actualGitHistoryBundleSavedAndRestoredTwice',false],
    ['backupReceiptAndBundleMatchedReviewedCommit',false],
    ['fullTrackedSitePreservedAndRolledBack',false],
    ['realGitCheckoutUnchanged',false],
    ['durableOwnerBackupRetained',true],
    ['realAuthenticatedSaveOrRemoteAtomicUpdate',true],
    ['finalSourceLayoutApproved',true],
    ['canPush',true],
    ['gitHubWrites',1]
  ]){
    assert.throws(()=>decide({
      ...base,backupEvidence:{...base.backupEvidence,[key]:value}
    }),/Source review or restored backup evidence/);
  }
  assert.throws(()=>decide({
    ...base,proposedCommit:OLD
  }),/Independent reviewed/);
  assert.throws(()=>decide({
    ...base,expectedWebsiteSha256:'INVALID'
  }),/Independent reviewed/);
  assert.throws(()=>decide({
    ...base,observedHead:'INVALID'
  }),/Malformed remote head/);
});
test('bridge cannot read GitHub credentials, send, write, publish or update refs',()=>{
  const src=fs.readFileSync(path.resolve(__dirname,'..','tools',
    'review-backup-bound-save-outcome.cjs'),'utf8');
  for(const word of [
    'https.request(', 'fetch(', 'create_commit(', 'update_ref(',
    'git push','git commit','GITHUB_TOKEN','process.env.',
    'writeFileSync(', 'node:fs','node:child_process'
  ])assert.equal(src.includes(word),false,word);
  assert.match(src,/neverAutomaticallyRetry/);
  assert.match(src,/actualRemoteMutationAttempted:false/);
  assert.match(src,/ownerApproved:false/);
});
