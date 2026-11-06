'use strict';
/*
 * BOTH UNAPPROVED RESOURCE LAYOUTS FROM ONE REAL BROWSER REVIEW ZIP.
 * Pure read-only reconciliation against a clean local Git checkout.
 * Neither 418-file nor 415-file source tree is adopted or saved.
 */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {verifyCheckout}=require('./plan-mixed-editor-update.cjs');
const {inspectArchive,planFromReviewZip,privateZip}=
  require('./review-private-combined-zip.cjs');
const {reviewCombined,layoutInventory}=
  require('./reconcile-mixed-source-layouts.cjs');
const {recordPath,MANIFEST}=require('./rehearse-resource-only-overlay.cjs');
const {RUNTIME}=require('./plan-private-github-source-review.cjs');
const {PAGES,NAV}=require('./plan-page-draft.cjs');
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const FORMAT='naxx-private-browser-zip-both-layouts-v1';
const GIT=/^[a-f0-9]{40}$/;
const pageSet=new Set([...PAGES,NAV]);
function checkPaths(source,comparison){
  const all=comparison.proposedFiles;
  if(!Array.isArray(all)||all.length!==comparison.unifiedProposedFileCount)
    throw Error('Combined layout proof has missing proposed paths.');
  const runtime=all.filter(p=>p.path===RUNTIME);
  const manifest=all.filter(p=>p.path===MANIFEST);
  if(runtime.length!==1||manifest.length!==1||
     runtime[0].newSha256!==source.proposedCompatibilitySha256)
    throw Error('The reconstructed website and candidate manifest do not agree.');
  const oldPaths=source.proposedPaths;
  const tracked=oldPaths.filter(p=>p.trackedInGit);
  if(tracked.length!==source.existingPageAndNavigationChanges||
     tracked.some(item=>!pageSet.has(item.path)))
    throw Error('Reviewed page/navigation changes are incomplete.');
  for(const item of tracked){
    const paired=all.filter(p=>p.path===item.path&&
      p.domain==='existing-page-or-navigation');
    if(paired.length!==1||
       paired[0].oldSha256!==item.oldSha256||
       paired[0].newSha256!==item.newSha256)
      throw Error('Page or navigation changed across proposed source layouts.');
  }
  const legacy=oldPaths.filter(p=>!p.trackedInGit);
  if(legacy.length!==source.proposedResourceChanges)
    throw Error('Original resource change count is inconsistent.');
  for(const entry of legacy){
    const match=/^content\/legacy\/resources\/(\d{4})\.fragment$/.exec(entry.path);
    if(!match)throw Error('Unexpected original candidate resource path.');
    const idx=Number(match[1])-1;
    if(idx<0||idx>=414)throw Error('Original candidate resource index is unsafe.');
    const selected=recordPath(idx);
    const paired=all.filter(p=>p.path===selected&&p.domain==='candidate-resource');
    if(paired.length!==1||
       paired[0].oldSha256!==entry.oldSha256||
       paired[0].newSha256!==entry.newSha256)
      throw Error('Resource field bytes changed between candidate source layouts.');
  }
  if(all.length!==tracked.length+legacy.length+2||
     new Set(all.map(x=>x.path)).size!==all.length)
    throw Error('A proposed layout added, duplicated or dropped source paths.');
  return Object.freeze({
    verifiedTrackedChanges:tracked.length,
    matchingResourceChanges:legacy.length,
    generatedCompatibilityMatches:true,
    pathInventoriesConsistent:true
  });
}
async function compareBrowserZipLayouts(checkout,zip,reviewedCommit){
  if(typeof checkout!=='string'||!path.isAbsolute(checkout)||
     !Buffer.isBuffer(zip)||zip.length<22||
     !GIT.test(reviewedCommit||''))
    throw Error('Choose a local absolute checkout, private ZIP and reviewed 40-character commit.');
  const before=verifyCheckout(checkout,reviewedCommit);
  const reviewed=await inspectArchive(zip);
  if(!reviewed.hasPageDraft||!reviewed.hasResourceDraft)
    throw Error('Both page and resource drafts are needed for this dual-layout comparison.');
  const old=await planFromReviewZip(checkout,zip,reviewedCommit);
  const comparison=await reviewCombined(checkout,{
    expectedCommit:reviewedCommit,
    pagesDraft:Buffer.from(reviewed.pageDraftText,'utf8'),
    resourcesDraft:Buffer.from(reviewed.resourceDraftText,'utf8')
  });
  const verification=checkPaths(old,comparison);
  const after=verifyCheckout(checkout,reviewedCommit);
  if(before.fingerprintSha256!==after.fingerprintSha256||
     old.cleanGitCheckoutBeforeAndAfter!==true||
     old.expectedGitCommit!==reviewedCommit||
     comparison.reviewedLocalGitCommit!==reviewedCommit||
     !comparison.independentFullSiteSha256Matched||
     comparison.completeGeneratedSiteSha256!==old.proposedCompatibilitySha256||
     comparison.localCheckoutVerified!==true||
     comparison.sourceLayoutApproved!==false||
     comparison.repositoryFilesWritten!==0||
     comparison.githubWrites!==0)
    throw Error('Independent proposed layouts or local checkout changed during review.');
  const choices=layoutInventory();
  if(choices.resourceCount!==414||choices.fullSourceTreeFileCount!==418||
     choices.versionedResourceOnlyFileCount!==415||choices.approved!==false)
    throw Error('The expected two candidate storage inventories changed.');
  return Object.freeze({
    format:FORMAT,reviewOnly:true,readOnly:true,
    reviewedGitCommit:reviewedCommit,reviewZipSha256:sha(zip),
    originalWebsiteSha256:old.originalResourceRuntimeSha256,
    generatedWebsiteSha256:old.proposedCompatibilitySha256,
    existingPageAndNavigationChanges:verification.verifiedTrackedChanges,
    editedResourceCount:verification.matchingResourceChanges,
    proposedChangedFileCount:comparison.unifiedProposedFileCount,
    fullSourceTreeCandidateFiles:choices.fullSourceTreeFileCount,
    versionedResourceOnlyCandidateFiles:choices.versionedResourceOnlyFileCount,
    sourceTreeDifferenceFiles:choices.fullSourceTreeFileCount-
      choices.versionedResourceOnlyFileCount,
    generatedCompatibilityMatches:verification.generatedCompatibilityMatches,
    pathInventoriesConsistent:verification.pathInventoriesConsistent,
    original414ResourcesVerified:true,
    localGitCheckoutVerifiedBeforeAndAfter:true,
    candidate418UsedInPrivateRehearsal:true,
    candidate415UsedInPrivateRehearsal:true,
    eitherCanonicalLayoutApproved:false,
    userSourceEdited:false,ownerApproved:false,
    liveGitHubSourceUpdated:false,originalWebsiteModified:false,
    realAdminSaveOrRestoreVerified:false,completeIndependentBackupVerified:false,
    canApply:false,canPush:false,canMerge:false,canPublish:false,
    repositoryFilesWritten:0,githubWrites:0
  });
}
async function compareSavedZipLayouts(checkout,archiveFile,commit){
  const selected=privateZip(checkout,archiveFile);
  const result=await compareBrowserZipLayouts(selected.root,selected.bytes,commit);
  const after=privateZip(checkout,archiveFile);
  if(after.file!==selected.file||sha(after.bytes)!==sha(selected.bytes))
    throw Error('Private review ZIP changed during layout comparison.');
  return result;
}
if(require.main===module){
  (async()=>{
    const {parseArgs}=require('./review-private-combined-zip.cjs');
    const args=parseArgs(process.argv.slice(2));
    const result=await compareSavedZipLayouts(args.checkout,args.archive,args.expectedCommit);
    process.stdout.write(JSON.stringify(result,null,2)+'\n');
  })().catch(()=>{
    process.stderr.write('Private ZIP dual-layout review refused safely. Nothing was saved.\n');
    process.exitCode=1;
  });
}
module.exports=Object.freeze({
  FORMAT,checkPaths,compareBrowserZipLayouts,compareSavedZipLayouts
});
