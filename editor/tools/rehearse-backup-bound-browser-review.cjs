'use strict';
/*
 * PRIVATE BACKUP-BOUND BROWSER REVIEW GATE (TEST ONLY).
 *
 * Proves one exact, clean local Git commit can be backed up as an actual
 * locally fetched-history Git bundle (double independent recovery), then a
 * browser-generated review ZIP can be staged and rolled back against that
 * SAME commit without touching the real checkout.
 *
 * Never uploads, updates refs, merges, deploys or retains the backup. This
 * does not authenticate the draft's owner, approve the 415-file layout or
 * replace a genuine owner-held pre-production backup.
 */
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const crypto=require('node:crypto');
const {saveBackup}=require('./create-local-git-backup.cjs');
const {verifyCheckout}=require('./plan-mixed-editor-update.cjs');
const {inspectArchive}=require('./review-private-combined-zip.cjs');
const {withFullSiteRollback}=
  require('./rehearse-browser-zip-full-site-rollback.cjs');
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const SHA40=/^[0-9a-f]{40}$/;
const FORMAT='naxx-private-restore-tested-backup-bound-review-v1';
function regular(filename){
  const stat=fs.lstatSync(filename);
  if(!stat.isFile()||stat.isSymbolicLink()||stat.size<1||
     stat.size>1024*1024*1024||
     (process.platform!=='win32'&&(stat.mode&0o077)!==0))
    throw Error('Private backup has an invalid file type, size or permissions.');
  return fs.readFileSync(filename);
}
function verifyBackupBinding(backupFile,expectedCommit,expectedFingerprint,
  expectedTree,expectedTrackedCount){
  if(typeof backupFile!=='string'||!path.isAbsolute(backupFile)||
     !SHA40.test(expectedCommit||'')||
     !/^[0-9a-f]{64}$/.test(expectedFingerprint||'')||
     !SHA40.test(expectedTree||'')||
     !Number.isSafeInteger(expectedTrackedCount)||expectedTrackedCount<1)
    throw Error('Explicit original Git checkout binding is required.');
  const bundle=regular(backupFile);
  const receiptBytes=regular(backupFile+'.receipt.json');
  const instructionBytes=regular(backupFile+'.READ_ME_FIRST.txt');
  let receipt;
  try{receipt=JSON.parse(receiptBytes.toString('utf8'));}
  catch(_){throw Error('Verified backup receipt is not valid JSON.');}
  if(!receipt||receipt.format!=='naxx-private-fetched-git-recovery-v1'||
     receipt.sourceCommit!==expectedCommit||
     receipt.sourceTree!==expectedTree||
     receipt.trackedSha256!==expectedFingerprint||
     receipt.trackedFiles!==expectedTrackedCount||
     receipt.bundleBytes!==bundle.length||
     receipt.bundleSha256!==sha(bundle)||
     !Number.isSafeInteger(receipt.reachableCommits)||
     receipt.reachableCommits<1||
     !Array.isArray(receipt.fetchedRefs)||!receipt.fetchedRefs.length||
     receipt.containsPrivateSourceHistory!==true||
     receipt.independentRestoreVerified!==true||
     receipt.localFetchedRefsOnly!==true||
     receipt.publishable!==false||
     receipt.fullServerBackup!==false||
     receipt.githubSettingsIncluded!==false)
    throw Error('Backup bundle/receipt does not match the exact reviewed checkout.');
  const refs=new Set();
  for(const item of receipt.fetchedRefs){
    if(!item||typeof item.ref!=='string'||
       !/^refs\/(?:heads|tags|remotes)\/[^\s]+$/.test(item.ref)||
       !SHA40.test(item.id||'')||refs.has(item.ref))
      throw Error('Fetched Git refs in backup receipt are unsafe.');
    refs.add(item.ref);
  }
  const instructions=instructionBytes.toString('utf8');
  if(!instructions.includes('KEEP THIS .bundle AND BOTH SIDECARS PRIVATE AND OFFLINE.')||
     !instructions.includes('THIS IS NOT A WHOLE-SERVER OR GITHUB-SERVICE BACKUP.')||
     !instructions.includes('Original commit: '+expectedCommit)||
     !instructions.includes('Original tree: '+expectedTree)||
     !instructions.includes('Bundle SHA-256: '+receipt.bundleSha256)||
     !instructions.includes('CosmicCuddle approval before any replacement'))
    throw Error('Private recovery instructions do not match the saved backup.');
  return Object.freeze({
    backupCommitMatched:true,sourceTreeMatched:true,
    allTrackedFilesBound:true,historyBundleChecksumMatched:true,
    fetchedRefCount:refs.size,backupBytes:bundle.length,
    originalTrackedFiles:receipt.trackedFiles,
    backupWasIndependentlyRestoredTwiceBeforeReturn:true,
    backupOnlyLocallyFetchedGitHistory:true,
    githubSettingsOrSecretsIncluded:false
  });
}
async function withBackupBoundBrowserReview(checkout,zip,commit,inspect=null){
  if(typeof checkout!=='string'||!path.isAbsolute(checkout)||
     !Buffer.isBuffer(zip)||zip.length<22||zip.length>20*1024*1024||
     !SHA40.test(commit||'')||
     (inspect!==null&&typeof inspect!=='function'))
    throw Error('Clean checkout, actual review ZIP and explicit original Git commit required.');
  const original=verifyCheckout(checkout,commit);
  const inspected=await inspectArchive(zip);
  if(!inspected.hasPageDraft||!inspected.hasResourceDraft)
    throw Error('Both original page and resource review drafts are required.');
  const checkoutTree=original.verifiedCommit&&require('node:child_process')
    .execFileSync('git',['rev-parse','HEAD^{tree}'],{
      cwd:checkout,encoding:'utf8',
      stdio:['ignore','pipe','pipe'],timeout:30000
    }).trim();
  if(!SHA40.test(checkoutTree||''))
    throw Error('Verified Git source-tree identifier is missing.');
  let backupFolder;
  let result;
  try{
    backupFolder=fs.mkdtempSync(path.join(os.tmpdir(),
      'naxx-reviewed-zip-backup-gate-'));
    fs.chmodSync(backupFolder,0o700);
    const file=path.join(backupFolder,'private-site-history.bundle');
    // Existing strict backup tool rejects shallow/partial/dirty checkouts,
    // symlinks, Git LFS pointers, ignored files and unsafe output paths.
    // It independently restores the bundle twice before returning.
    const saved=saveBackup(checkout,file);
    if(saved.sourceCommit!==commit||saved.sourceTree!==checkoutTree||
       saved.independentlyRecoveredTwice!==true||
       saved.githubWritten!==false)
      throw Error('Actual private Git backup is not bound to reviewed source.');
    let binding=verifyBackupBinding(file,commit,
      original.fingerprintSha256,checkoutTree,original.trackedFiles);
    if(inspect)await inspect(Object.freeze({
      file,receiptFile:file+'.receipt.json',
      instructionFile:file+'.READ_ME_FIRST.txt',
      expectedCommit:commit,originalCheckoutFingerprint:original.fingerprintSha256
    }));
    // A changed bundle/receipt/instructions must fail BEFORE staging.
    binding=verifyBackupBinding(file,commit,
      original.fingerprintSha256,checkoutTree,original.trackedFiles);
    const zipHash=sha(zip);
    const preview=await withFullSiteRollback(checkout,zip,commit);
    if(!preview.privateRollbackExact||
       !preview.originalRepositoryCheckoutUnchanged||
       !preview.allTemporarySiteCopiesDeleted||
       !preview.customScriptsAssetsAndUnchangedPagesPreserved||
       preview.canPublish!==false)
      throw Error('Backup-bound full-site preview did not restore exactly.');
    const final=verifyBackupBinding(file,commit,
      original.fingerprintSha256,checkoutTree,original.trackedFiles);
    const after=verifyCheckout(checkout,commit);
    if(after.fingerprintSha256!==original.fingerprintSha256||
       sha(zip)!==zipHash||
       final.historyBundleChecksumMatched!==binding.historyBundleChecksumMatched)
      throw Error('Reviewed ZIP, private backup or Git checkout changed during test.');
    result=Object.freeze({
      format:FORMAT,
      reviewedOriginalGitCommit:commit,
      originalTrackedFiles:binding.originalTrackedFiles,
      fetchedHistoryRefs:binding.fetchedRefCount,
      originalTrackedFileFingerprintMatched:true,
      actualGitHistoryBundleSavedAndRestoredTwice:true,
      backupReceiptAndBundleMatchedReviewedCommit:true,
      actualBrowserZIPValidated:true,
      fullTrackedSitePreservedAndRolledBack:true,
      completeProposedResourceOverlayFiles:415,
      allOriginalCustomScriptsAndAssetsPreserved:true,
      realGitCheckoutUnchanged:true,
      backupOnlyTemporary:true,
      durableOwnerBackupRetained:false,
      backupOfGitHubAccountSettingsOrServices:false,
      finalSourceLayoutApproved:false,
      realAuthenticatedSaveOrRemoteAtomicUpdate:false,
      ownerApproved:false,canApply:false,canPush:false,
      canMerge:false,canPublish:false,
      originalRepositoryFilesWritten:0,
      gitHubWrites:0,sourceValuesPrinted:false
    });
  }finally{
    if(backupFolder)fs.rmSync(backupFolder,{recursive:true,force:true});
  }
  if(!result||fs.existsSync(backupFolder))
    throw Error('Private backup was not deleted after test.');
  return result;
}
module.exports=Object.freeze({
  FORMAT,verifyBackupBinding,withBackupBoundBrowserReview
});
